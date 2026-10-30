import { LEGAL_VERSION, showLegal } from "./legal.js";
import { localSaveKey } from "./local-save.js";
import { CLOUD_CONFIG } from "./cloud-config.js";

const AUTH_KEY = "dos-cloud-auth";
const getJSON = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const putJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
// 記録1のキーは旧版の送信待ちもそのまま回収する。
const slotSuffix = slot => slot === 1 ? "" : ":slot:" + slot;
const pendingKey = (id, slot = 1) => "dos-cloud-pending:" + id + slotSuffix(slot);
const checkpointKey = (id, slot = 1) => "dos-cloud-checkpoint:" + id + slotSuffix(slot);
const session = (a) => ({ ...a, expires_at: a.expires_at || Math.floor(Date.now() / 1000) + (a.expires_in || 3600) });

// Workerが作った記録本文を再び解析・文字列化せず、要求へそのまま包む。
function requestJSON(value) {
  if (typeof value.snapshotRaw !== "string") return JSON.stringify(value);
  const { snapshotRaw, ...header } = value;
  return JSON.stringify(header).slice(0, -1) + ',"snapshot":' + snapshotRaw + '}';
}

export class CloudSaveClient {
  constructor(config, { fetcher = (input, init) => fetch(input, init), storage = localStorage, slot = 1, onBusy = () => {}, onFailure = null, retryDelays = [250, 750, 1500] } = {}) {
    localSaveKey(slot); this.slot = slot;
    this.config = config; this.fetcher = fetcher; this.storage = storage;
    this.onBusy = onBusy; this.onFailure = onFailure; this.retryDelays = retryDelays;
    this.auth = null; this.sessionId = null; this.revision = 0;
    this.tail = Promise.resolve(); this.count = 0; this.busy = false;
    this.refreshing = null; this.waiting = false; this.failureWait = null;
    this.blocking = 0; this.queuedSave = null; this.battleTurn = false; this.compactGraph = false; this.backgroundBattle = false;
    this.checkpointGeneration = 0; this.checkpointPersistedGeneration = 0; this.latestCheckpointId = null; this.checkpointTail = Promise.resolve();
  }
  async fetchJSON(path, options = {}) {
    // 大きな記録の戦闘応答は15秒を超える。認証と保存APIの期限を分ける。
    const timeoutMs = path.startsWith("/functions/") ? 60000 : 15000;
    const ctrl = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
      ctrl.abort(); reject(new DOMException("通信が時間内に終わりませんでした", "AbortError"));
    }, timeoutMs); });
    const work = async () => {
      const r = await this.fetcher(this.config.url.replace(/\/$/, "") + path, { ...options, signal: ctrl.signal });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw Object.assign(new Error(data?.error_description || data?.msg || data?.error || "通信に失敗しました"), { status: r.status, requestId: data?.requestId });
      if (!data) throw Object.assign(new Error("返答を読み取れません"), { status: 502 });
      return data;
    };
    try { return await Promise.race([work(), timeout]); }
    finally { clearTimeout(timer); }
  }

  async authRequest(path, body) {
    return this.fetchJSON("/auth/v1/" + path, { method: "POST",
      headers: { apikey: this.config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async token(force = false) {
    if (!this.auth) throw new Error("ログインしてください");
    if (!force && this.auth.expires_at * 1000 > Date.now() + 60000) return this.auth.access_token;
    if (!this.refreshing) this.refreshing = this.authRequest("token?grant_type=refresh_token", { refresh_token: this.auth.refresh_token })
      .then((a) => { this.auth = session(a); this.storage.setItem(AUTH_KEY, JSON.stringify(this.auth)); return a.access_token; })
      .finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async request(body) {
    if (this.slot !== 1) body = { ...body, slot: this.slot };
    const raw = requestJSON(body);
    const send = async (token) => this.fetchJSON("/functions/v1/game-save", { method: "POST",
      headers: { apikey: this.config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: raw });
    try { return await send(await this.token()); }
    catch (e) { if (e.status === 401) return send(await this.token(true)); throw e; }
  }
  setBusy() { this.busy = this.count > 0; this.onBusy(this.busy); }
  enqueue(op, data = {}) {
    // まだ送っていない連続した保存だけを最新化。送信済みの要求と戦闘の境界は変えない。
    if (op === "save" && this.queuedSave) {
      this.queuedSave.data = data;
      return this.queuedSave.promise;
    }
    const entry = { data, promise: null };
    this.queuedSave = op === "save" ? entry : null;
    if (op === "battle" || op === "turn") this.blocking++;
    this.count++; this.setBusy();
    const task = this.tail.then(async () => {
      // 端末の復旧記録は既に別経路で保管する。連続する操作は半秒単位で束ねる。
      if (op === "save" && this.backgroundBattle) await new Promise(resolve => setTimeout(resolve, 500));
      if (this.queuedSave === entry) this.queuedSave = null;
      const data = typeof entry.data === "function" ? await this.retry(entry.data) : entry.data;
      if (data === null) return;
      const { checkpointId, ...requestData } = data;
      const body = { protocol: this.config.protocol, sessionId: this.sessionId,
        commandId: crypto.randomUUID(), revision: this.revision, op, ...requestData };
      // 送信前に記録する。結果の返答を失っても同じID・同じ内容で再送する。
      const result = await this.retry(async () => {
        this.storage.setItem(pendingKey(this.auth.user.id, this.slot), requestJSON(body));
        return this.request(body);
      });
      this.revision = result.revision;
      this.storage.removeItem(pendingKey(this.auth.user.id, this.slot));
      if (checkpointId) {
        const key = checkpointKey(this.auth.user.id, this.slot);
        if (this.latestCheckpointId === checkpointId) { this.storage.removeItem(key); this.latestCheckpointId = null; }
      }
      return result;
    });
    this.tail = task;
    entry.promise = task.finally(() => {
      if (op === "battle" || op === "turn") this.blocking--;
      this.count--; this.setBusy();
    });
    return entry.promise;
  }
  async retry(fn, { automatic = true } = {}) {
    let attempts = 0;
    for (;;) {
      try { return await fn(); }
      catch (e) {
        if (!this.onFailure) throw e;
        const temporary = e.name !== "AbortError" && (e instanceof TypeError || [408, 429, 500, 502, 503, 504].includes(e.status));
        if (automatic && temporary && attempts < this.retryDelays.length) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempts++]));
          continue;
        }
        attempts = 0;
        if (!this.failureWait) {
          this.waiting = true;
          this.failureWait = Promise.resolve().then(() => this.onFailure(e)).finally(() => {
            this.waiting = false; this.failureWait = null;
          });
        }
        await this.failureWait;
      }
    }
  }
  // 復旧を明示的に選んだ時だけ退避する。退避に失敗したら元の要求を残す。
  async archivePending() {
    const entries = [pendingKey(this.auth.user.id, this.slot), checkpointKey(this.auth.user.id, this.slot)]
      .map(key => [key, this.storage.getItem(key)]).filter(([,raw]) => raw);
    for (const [key, raw] of entries) {
      try { this.storage.setItem(key + ":recovery", raw); }
      catch { await archiveInDatabase(key, raw); }
    }
    for (const [key] of entries) this.storage.removeItem(key);
    this.latestCheckpointId = null;
  }
  savePrepared(prepare) {
    const generation = ++this.checkpointGeneration;
    const previous = this.checkpointTail;
    const prepared = Promise.resolve().then(prepare).then(async snapshot => {
      if (!snapshot) {
        const prior = await previous;
        return prior && this.latestCheckpointId === prior.checkpointId ? prior : null;
      }
      const id = crypto.randomUUID();
      const data = typeof snapshot === "string" ? { snapshotRaw: snapshot } : { snapshot };
      await this.retry(() => {
        if (generation >= this.checkpointPersistedGeneration) {
          this.storage.setItem(checkpointKey(this.auth.user.id, this.slot), requestJSON({ id, sessionId: this.sessionId, ...data }));
          this.latestCheckpointId = id;
          this.checkpointPersistedGeneration = generation;
        }
      });
      return { ...data, checkpointId: id };
    });
    this.checkpointTail = prepared;
    prepared.catch(() => {});
    return this.enqueue("save", () => prepared);
  }
  async checkpoint() {
    for (;;) { const tail = this.checkpointTail; await tail; if (tail === this.checkpointTail) return; }
  }

  save(snapshot) { return this.enqueue("save", { snapshot }); }
  battle(action, snapshot = null) {
    if (snapshot && this.battleTurn) return this.enqueue("turn", { action, snapshot });
    // 旧サーバーにも接続できる。選択保存→行動の順を崩さない。
    if (snapshot) this.save(snapshot);
    return this.enqueue("battle", { action });
  }
  battlePrepared(action, prepare) {
    const data = async () => ({ action, snapshot: await prepare() });
    if (this.battleTurn) return this.enqueue("turn", data);
    this.enqueue("save", async () => ({ snapshot: await prepare() }));
    return this.enqueue("battle", { action });
  }
  renew() { return this.enqueue("renew"); }
  flush() { return this.tail; }
  async claim() {
    const data = await this.request({ protocol: this.config.protocol, sessionId: this.sessionId, op: "claim", compactGraph: true });
    this.revision = data.revision;
    this.battleTurn = data.battleTurn === true;
    this.compactGraph = data.compactGraph === true;
    this.backgroundBattle = data.backgroundBattle === true;
    return data.snapshot;
  }
  async recover() {
    const pending = this.storage.getItem(pendingKey(this.auth.user.id, this.slot));
    if (pending) {
      const body = JSON.parse(pending);
      if (body.sessionId !== this.sessionId) throw new Error("記録の接続が一致しません");
      const result = await this.retry(() => this.request(body), { automatic: false });
      this.revision = result.revision;
      this.storage.removeItem(pendingKey(this.auth.user.id, this.slot));
    }
    // 通信中に進めた最新地点は、以前の要求を確定してから同じ列に保存する。
    const checkpoint = JSON.parse(this.storage.getItem(checkpointKey(this.auth.user.id, this.slot)) || "null");
    if (checkpoint) {
      if (checkpoint.sessionId !== this.sessionId) throw new Error("記録の接続が一致しません");
      this.latestCheckpointId = checkpoint.id;
      await this.enqueue("save", { snapshot: checkpoint.snapshot, checkpointId: checkpoint.id });
    }
  }
}

function archiveInDatabase(key, raw) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("dos-cloud-recovery", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("requests");
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("記録の保管先を開けません"));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("requests", "readwrite");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error("記録を保管できません")); };
      tx.onerror = () => {};
      tx.objectStore("requests").put(raw, key);
    };
  });
}

let leaving = false;
let managing = false;
let gate = null, message = null, controls = null, client = null, ready = false, terminal = false;
function make(tag, text, cls) {
  const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e;
}
function ensureGate() {
  if (gate) return;
  gate = make("div", null, "cloud-gate"); gate.hidden = true;
  gate.setAttribute("role", "dialog"); gate.setAttribute("aria-modal", "true"); gate.setAttribute("aria-label", "冒険の記録");
  const box = make("div", null, "cloud-panel");
  box.append(make("h2", "冒険の記録"));
  message = make("p"); message.setAttribute("role", "status");
  controls = make("div", null, "cloud-controls"); box.append(message, controls); gate.append(box); document.body.append(gate);
  for (const name of ["click", "pointerdown", "pointerup", "touchstart", "touchend", "keydown", "keyup", "wheel"]) {
    window.addEventListener(name, (e) => {
      if (!gate.hidden && !gate.contains(e.target) && !e.target.closest?.(".legal-dialog")) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { capture: true, passive: false });
  }
}
function showGate(text = null) {
  ensureGate(); gate.hidden = false;
  // 通常の待機は見出しも文も出さず、操作が必要な時だけパネルを見せる。
  gate.querySelector(".cloud-panel").hidden = text === null;
  message.textContent = text || ""; controls.replaceChildren();
}
function button(text, fn) {
  const b = make("button", text); b.type = "button"; b.addEventListener("click", fn); controls.append(b);
  if (controls.children.length === 1) b.focus();
  return b;
}
let resumingRecord = false;
async function resumeSavedRecord() {
  if (resumingRecord) return;
  resumingRecord = true;
  const buttons = [...controls.querySelectorAll("button")];
  for (const b of buttons) b.disabled = true;
  try { await client.archivePending(); location.reload(); }
  catch {
    message.textContent = "未送信の操作を保管できませんでした。ブラウザーの保存領域が不足しているか、利用できません。元の操作は残しています。再接続をお試しください。";
    resumingRecord = false;
    for (const b of buttons) b.disabled = false;
  }
}
function failure(e) {
  return new Promise((resolve) => {
    if (e.status === 401 || (e.status === 400 && /refresh|token/i.test(e.message))) {
      showGate("ログインの有効期限が切れました。ログインし直してください。");
      if (cloudGuest()) {
        message.textContent = "ゲストの接続を確認できません。接続情報は保管しています。メール登録済みの場合はログインし直せます。";
        button("再接続", () => location.reload());
      }
      button("ログインし直す", () => {
        if (cloudGuest()) putJSON("dos-cloud-guest-backup", client.auth);
        localStorage.removeItem(AUTH_KEY); location.reload();
      });
    } else if (e.status === 409 && e.message !== "cloud_session_busy") {
      showGate("記録が別の画面で更新されたか、ゲームの版が変わりました。最新の記録から再開してください。");
      button("最新の記録から再開", resumeSavedRecord);
    } else {
      showGate(e.message === "cloud_session_busy" ? "別の端末か画面で冒険中です。そちらを閉じて、しばらくしてから再接続してください。"
        : "記録を保存できません。接続を確かめてください。冒険はここで待っています。");
      const detail = e.name === "AbortError" ? "通信が時間内に終わりませんでした。" : e.status ? `通信エラー: HTTP ${e.status}。` : "通信または端末への保存に失敗しました。";
      message.textContent += ` ${detail}${e.requestId ? ` 問い合わせ番号: ${e.requestId}` : ""}`;
      button("再接続", () => { showGate(); resolve(); });
      if ((getJSON(pendingKey(client.auth.user.id, client.slot)) || getJSON(checkpointKey(client.auth.user.id, client.slot))) && e.message !== "cloud_session_busy") {
        message.textContent += " 再接続しても戻れない場合は、未送信の操作を退避し、保存済みの記録から再開できます。未確定の操作は反映されない場合があります。";
        button("保存済みの記録から再開", resumeSavedRecord);
      }
    }
  });
}

function login(c, { registration = false, linking = false } = {}) {
  return new Promise((resolve) => {
    showGate(linking ? "この冒険の記録を守る — メールアドレスを登録" : registration ? "アカウントを作成" : "ログイン");
    const form = make("form");
    const field = (label, type, autocomplete) => {
      const row = make("label", label), input = make("input");
      input.type = type; input.required = true; input.autocomplete = autocomplete;
      row.append(input); form.append(row); return input;
    };
    const email = field("メールアドレス", "email", "username");
    const password = field("パスワード", "password", registration ? "new-password" : "current-password"); password.minLength = 8;
    const submit = make("button", "ログイン"); submit.type = "submit"; form.append(submit); controls.append(form);
    if (registration) submit.textContent = "アカウントを作成";
    let working = false;
    const perform = async (signup) => {
      if (working || !form.reportValidity()) return;
      working = true; submit.disabled = true; signupButton.disabled = true;
      try {
        if (linking) {
          await updateUser(c, { email: email.value.trim(), password: password.value, ...await captchaBody() });
          showGate("確認メールを送りました。メール内のリンクを開くと登録が完了します。確認前もこの端末で冒険を続けられます。");
          button("冒険へ戻る", () => resolve());
          return;
        }
        const a = await c.authRequest(signup ? "signup" : "token?grant_type=password", { email: email.value.trim(), password: password.value, ...await captchaBody() });
        if (!a.access_token) { message.textContent = "確認メールを送りました。メール内のリンクで確認してからログインしてください。"; return; }
        c.auth = session(a); putJSON(AUTH_KEY, c.auth); resolve();
      } catch { message.textContent = signup ? "登録できませんでした。入力内容と接続を確かめてください。" : "ログインできませんでした。入力内容・メールの確認・接続を確かめてください。"; }
      finally { working = false; submit.disabled = false; signupButton.disabled = false; }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); perform(registration); });
    const signupButton = button(registration ? "ログインへ" : "アカウントを作成", () => {
      if (linking || working) return;
      registration = !registration;
      submit.textContent = registration ? "アカウントを作成" : "ログイン";
      signupButton.textContent = registration ? "ログインへ" : "アカウントを作成";
      password.autocomplete = registration ? "new-password" : "current-password";
      forgotButton.hidden = registration;
    });
    signupButton.hidden = linking;
    button(linking ? "あとで" : "タイトルへ戻る", () => {
      if (working) return;
      if (linking) resolve(); else location.reload();
    });
    const forgotButton = button("パスワードを忘れた", async () => {
      if (working || !email.reportValidity()) return;
      working = true;
      try {
        await c.authRequest("recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: email.value.trim(), ...await captchaBody() });
        message.textContent = "登録済みの場合、パスワード再設定のメールが届きます。";
      } catch { message.textContent = "メールを送信できませんでした。接続を確かめてください。"; }
      finally { working = false; }
    });
    forgotButton.hidden = registration || linking;
    email.focus();
  });
}

async function recoveryLogin(c) {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (!hash.get("access_token")) return false;
  c.auth = { access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600) };
  history.replaceState(null, "", location.pathname + location.search);
  const user = await c.fetchJSON("/auth/v1/user", { headers: { apikey: c.config.anonKey, Authorization: `Bearer ${c.auth.access_token}` } });
  const previous = getJSON(AUTH_KEY);
  if (previous?.user?.is_anonymous && previous.user.id !== user.id) {
    putJSON("dos-cloud-guest-backup", previous);
    await new Promise(resolve => {
      showGate("確認リンクのアカウントを開きます。今のゲストの記録は端末へ保管し、合成・上書きしません。");
      button("確認したアカウントを開く", resolve);
      button("ゲストの冒険へ戻る", () => { putJSON(AUTH_KEY, previous); location.reload(); });
    });
  }
  c.auth.user = user;
  if (hash.get("type") !== "recovery") { putJSON(AUTH_KEY, c.auth); return true; }
  await new Promise((resolve) => {
    showGate("新しいパスワード");
    const form = make("form"), row = make("label", "パスワード"), p = make("input");
    p.type = "password"; p.autocomplete = "new-password"; p.required = true; p.minLength = 8;
    row.append(p); form.append(row); const b = make("button", "パスワードを更新"); b.type = "submit"; form.append(b); controls.append(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!form.reportValidity() || b.disabled) return; b.disabled = true;
      try {
        await c.fetchJSON("/auth/v1/user", { method: "PUT", headers: { apikey: c.config.anonKey,
          Authorization: `Bearer ${c.auth.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: p.value }) });
        putJSON(AUTH_KEY, c.auth); resolve();
      } catch { message.textContent = "更新できませんでした。接続を確かめてください。"; }
      finally { b.disabled = false; }
    });
    p.focus();
  });
  return true;
}

export function cloudEnabled() { return CLOUD_CONFIG.enabled; }
export function cloudHasSession() { return !!getJSON(AUTH_KEY)?.access_token; }
// 接続情報は削除後も残す。タイトルの記録の有無とは分けて扱う。
const emptyRecordKey = id => "dos-cloud-empty:" + id;
export function cloudHasRecord() {
  const auth = getJSON(AUTH_KEY);
  return !!auth?.access_token && (!getJSON(emptyRecordKey(auth.user.id)) || !!getJSON(pendingKey(auth.user.id)) || !!getJSON(checkpointKey(auth.user.id)));
}
export function cloudReady() { return ready; }
export function cloudBusy() { return !!client?.blocking || !!client?.waiting || (!!gate && !gate.hidden); }
export function cloudGuest() { return !!client?.auth?.user?.is_anonymous; }
export function cloudAccount() { return cloudGuest() ? "ゲストで冒険中" : client?.auth?.user?.email || ""; }
export async function cloudSave(snapshot) {
  const result = await client.save(snapshot);
  localStorage.removeItem(emptyRecordKey(client.auth.user.id));
  return result;
}
export function cloudBattle(action, snapshot = null) { return client.battle(action, snapshot); }
export const cloudBattlePrepared = (action, prepare) => client.battlePrepared(action, prepare);
// 通常保存と同じ順序・再送保護で現在の記録だけを削除する。
export async function cloudReset() {
  localStorage.setItem("dos-cloud-deleted", "1");
  await client.enqueue("reset");
  putJSON(emptyRecordKey(client.auth.user.id), true);
}
export function cloudFlush() { return client?.flush() || Promise.resolve(); }
// 終了・更新では、最後の保存を作る前に入力を止める。通常保存は裏で続ける。
export async function cloudPrepareReload(save) {
  if (leaving || managing || !client || !ready || terminal) return false;
  leaving = true;
  showGate();
  try {
    const saved = save();
    if (!saved) { leaving = false; gate.hidden = true; return false; }
    await saved;
    await cloudFlush();
    return true;
  } catch {
    leaving = false;
    cloudFatal();
    return false;
  }
}
export async function cloudSignOut() {
  if (cloudGuest()) { await cloudManageAccount(); return; }
  await cloudFlush(); localStorage.removeItem(AUTH_KEY); location.reload();
}
export function cloudFatal() {
  terminal = true;
  showGate("冒険の記録を処理できませんでした。最新の記録から再開してください。");
  button("再接続", () => location.reload());
}

// 通常の短い待機は無表示。長引く接続は段階を示し、空の幕から復旧できるようにする。
async function connectionStep(label, work) {
  let shown = false;
  const timer = setTimeout(() => {
    if (gate.hidden || !gate.querySelector(".cloud-panel").hidden) return;
    shown = true;
    showGate(`${label}に時間がかかっています。記録はそのまま保管しています。大きな記録の通信は一分まで待ちます。待っても進まない場合は再読み込みしてください。`);
    button("再読み込み", () => location.reload());
  }, 15000);
  try { return await work(); }
  finally { clearTimeout(timer); if (shown && !client?.waiting) showGate(); }
}

export async function connectCloud(localSave, slot = 1, mode = "start") {
  ensureGate(); showGate();
  if (!CLOUD_CONFIG.url || !CLOUD_CONFIG.anonKey || !/^https:\/\//.test(CLOUD_CONFIG.url)) {
    showGate("クラウド保存の接続先が設定されていません。"); throw new Error("クラウド設定が未完了です");
  }
  client = new CloudSaveClient(CLOUD_CONFIG, { slot, onBusy: (busy) => {
    if (terminal || client.waiting || managing || leaving) return;
    // 通常の保存・戦闘・占有延長では画面を覆わず、直前の景色と演出を保つ。
    // 通常保存は裏で続け、戦闘結果待ちと復旧操作だけ入力を止める。
    if (!busy) gate.hidden = true;
  }, onFailure: failure });
  const agreedThisVisit = await agreeToTerms(getJSON(AUTH_KEY)?.user?.id);
  if (!await recoveryLogin(client)) {
    client.auth = getJSON(AUTH_KEY);
    if (client.auth) {
      // 更新失敗で匿名の接続情報を捨てると、ゲストの記録を失う。再接続で保持する。
      await connectionStep("ログインの確認", () => client.retry(async () => {
        await client.token();
        client.auth.user = await currentUser(client);
        putJSON(AUTH_KEY, client.auth);
      }));
    }
    if (mode === "login" && client.auth) {
      showGate(cloudGuest() ? "ゲストの冒険はこの端末に保管してログインします。記録は合成・上書きしません。" : "別のアカウントへログインしますか？");
      await new Promise(resolve => {
        button("今の冒険を続ける", () => resolve());
        button("別のアカウントにログイン", async () => {
          if (cloudGuest()) putJSON("dos-cloud-guest-backup", client.auth);
          await login(client); resolve();
        });
      });
    }
    if (!client.auth) {
      if (mode === "login") await login(client);
      else {
        const choice = await new Promise(resolve => {
          showGate("メール登録なしで遊べます。進行は自動保存されます。ブラウザのデータを削除すると、未登録の記録は復旧できなくなる場合があります。あとから登録して引き継げます。オンライン接続が必要です。");
          button("ゲストではじめる", () => resolve("guest"));
          button("アカウントを作成", () => resolve("register"));
          button("登録済みの方はこちら", () => resolve("login"));
          if (getJSON("dos-cloud-guest-backup")) button("保管したゲストの冒険に戻る", () => resolve("restore"));
          button("タイトルへ戻る", () => location.reload());
        });
        if (choice === "restore") { client.auth = getJSON("dos-cloud-guest-backup"); await client.token(); putJSON(AUTH_KEY, client.auth); }
        else if (choice === "guest") {
          // 自動再送で匿名ユーザーを大量作成しない。失敗時も手動の再接続だけで試す。
          client.auth = session(await client.retry(async () => client.authRequest("signup", { data: { terms_version: LEGAL_VERSION }, ...await captchaBody() })));
          putJSON(AUTH_KEY, client.auth);
        } else await login(client, { registration: choice === "register" });
      }
    }
  }
  if (agreedThisVisit) localStorage.setItem("dos-legal-version:" + client.auth.user.id, LEGAL_VERSION);
  else await agreeToTerms(client.auth.user.id);
  await connectionStep("利用規約の確認", () => client.retry(() => client.request({ protocol: client.config.protocol, op: "consent", version: LEGAL_VERSION })));
  // タブの複製で同じ送信待ちIDが使われても、1画面だけが進められる。
  if (navigator.locks) {
    await connectionStep("この端末の使用確認", () => new Promise((resolve, reject) => {
      navigator.locks.request("dos-cloud:" + client.auth.user.id + slotSuffix(slot), { ifAvailable: true }, async (lock) => {
        if (!lock) { showGate("このアカウントは別の画面で開かれています。"); button("再接続", () => location.reload()); return; }
        resolve(); await new Promise(() => {});
      }).catch(reject);
    }));
  }
  const pending = getJSON(pendingKey(client.auth.user.id, client.slot));
  const checkpoint = getJSON(checkpointKey(client.auth.user.id, client.slot));
  const sessionKey = "dos-cloud-session:" + client.auth.user.id + slotSuffix(slot);
  client.sessionId = pending?.sessionId || checkpoint?.sessionId || localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, client.sessionId);
  showGate();
  let snapshot = await connectionStep("冒険の記録の読み込み", () => client.retry(() => client.claim()));
  if (pending || checkpoint) { await client.recover(); snapshot = await connectionStep("冒険の記録の読み込み", () => client.retry(() => client.claim())); }
  if (mode !== "reset" && !snapshot && localSave && !localStorage.getItem("dos-cloud-deleted")) {
    const useLocal = await new Promise((resolve) => {
      showGate("このアカウントには冒険の記録がありません。この端末の記録を引き継ぎますか？");
      button("端末の記録を引き継ぐ", () => resolve(true)); button("新しい冒険を始める", () => resolve(false));
    });
    if (useLocal) { snapshot = JSON.parse(localSave); await client.save(snapshot); }
  }
  if (snapshot) localStorage.removeItem(emptyRecordKey(client.auth.user.id));
  else putJSON(emptyRecordKey(client.auth.user.id), true);
  const heartbeat = async () => {
    if (!client.busy && !managing && !leaving && document.visibilityState === "visible") {
      client.count++; client.setBusy();
      try { await client.retry(() => client.renew()); }
      finally { client.count--; client.setBusy(); }
    }
  };
  // 実際の保存でも占有期限を延ばす。待機中だけ接続を維持する。
  setInterval(heartbeat, 45000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") heartbeat(); });
  gate.hidden = true;
  ready = true;
  return snapshot;
}

function legalButtons() {
  button("利用規約を読む", () => showLegal("terms"));
  button("プライバシーポリシーを読む", () => showLegal("privacy"));
}
async function agreeToTerms(userId = null) {
  const key = userId ? "dos-legal-version:" + userId : null;
  if (key && localStorage.getItem(key) === LEGAL_VERSION) return false;
  await new Promise(resolve => {
    showGate("冒険を始める前に、利用規約とプライバシーポリシーをご確認ください。");
    legalButtons();
    const label = make("label", null, "cloud-consent"), check = make("input"); check.type = "checkbox";
    label.append(check, document.createTextNode("利用規約に同意し、プライバシーポリシーを確認しました")); controls.append(label);
    const next = button("同意して進む", () => {
      if (!check.checked) return;
      if (key) localStorage.setItem(key, LEGAL_VERSION); resolve();
    });
    next.disabled = true; check.onchange = () => { next.disabled = !check.checked; };
    button("タイトルへ戻る", () => location.reload());
  });
  return true;
}
async function currentUser(c) {
  return c.fetchJSON("/auth/v1/user", { headers: { apikey: c.config.anonKey, Authorization: `Bearer ${await c.token()}` } });
}
async function updateUser(c, body) {
  const user = await c.fetchJSON("/auth/v1/user", { method: "PUT", headers: { apikey: c.config.anonKey,
    Authorization: `Bearer ${await c.token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (user.id !== c.auth.user.id) throw new Error("アカウントが一致しません");
  c.auth.user = user; putJSON(AUTH_KEY, c.auth);
}
// Supabase側でCAPTCHAを有効にする場合は、公開サイトキーも配置する。
async function captchaBody() {
  if (!CLOUD_CONFIG.turnstileSiteKey) return {};
  message.textContent = "安全確認をお願いします。";
  if (!window.turnstile) await new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.onload = resolve; script.onerror = () => reject(new Error("安全確認を読み込めません")); document.head.append(script);
  });
  const target = make("div"); controls.append(target);
  let widget;
  let token;
  try {
    token = await new Promise((resolve, reject) => {
      widget = window.turnstile.render(target, { sitekey: CLOUD_CONFIG.turnstileSiteKey, callback: resolve,
        "error-callback": () => reject(new Error("安全確認に失敗しました")), "expired-callback": () => reject(new Error("安全確認が期限切れです")) });
    });
  } finally {
    if (widget !== undefined) window.turnstile.remove(widget);
    target.remove();
  }
  return { gotrue_meta_security: { captcha_token: token } };
}
export async function cloudManageAccount() {
  if (managing || leaving || !client || !ready) return;
  managing = true;
  showGate();
  try {
    await cloudFlush();
    await new Promise(resolve => {
      const draw = () => {
        showGate(cloudGuest() ? "ゲストの記録をメールアドレスに結び付けると、別の端末でも冒険を続けられます。" : cloudAccount());
        if (cloudGuest()) button("アカウント登録・記録の引き継ぎ", async () => {
          await login(client, { registration: true, linking: true }); resolve();
        });
        else button("ログアウト", () => { localStorage.removeItem(AUTH_KEY); location.reload(); });
        legalButtons();
        button("退会・記録を削除", () => {
          showGate("アカウントと冒険の記録を削除します。復旧できません。削除する場合は「削除」と入力してください。");
          const input = make("input"); input.setAttribute("aria-label", "削除の確認"); controls.append(input);
          const remove = button("アカウントと記録を完全に削除", async () => {
            if (input.value !== "削除" || remove.disabled) return;
            remove.disabled = true;
            try {
              await client.request({ protocol: client.config.protocol, sessionId: client.sessionId, op: "delete-account" });
              // 旧端末記録を次の冒険へ誤って再移行しないよう、削除済みユーザーを覚える。
              localStorage.setItem("dos-cloud-deleted", "1");
              localStorage.removeItem(pendingKey(client.auth.user.id));
              localStorage.removeItem(checkpointKey(client.auth.user.id));
              localStorage.removeItem("dos-cloud-session:" + client.auth.user.id);
              localStorage.removeItem(AUTH_KEY); localStorage.removeItem("dos-cloud-guest-backup"); location.reload();
            } catch { message.textContent = "削除の完了を確認できませんでした。接続を確かめて再試行してください。"; remove.disabled = false; }
          });
          button("やめる", draw);
        });
        button("冒険へ戻る", resolve);
      }; draw();
    });
  } finally { managing = false; if (!terminal) gate.hidden = true; }
}
export async function cloudRegisterPrompt() {
  if (!cloudGuest() || localStorage.getItem("dos-cloud-register-hint:" + client.auth.user.id)) return;
  await cloudFlush();
  localStorage.setItem("dos-cloud-register-hint:" + client.auth.user.id, "1");
  return cloudManageAccount();
}

// 準備中も送信列に予約し、終了・戦闘が保存を追い越さないようにする。
export const cloudCompactGraph = () => !!client?.compactGraph;
export const cloudBackgroundBattle = () => !!client?.backgroundBattle;
export const cloudCheckpoint = () => client.checkpoint();
export async function cloudSavePrepared(prepare) {
  const result = await client.savePrepared(prepare);
  localStorage.removeItem(emptyRecordKey(client.auth.user.id));
  return result;
}
