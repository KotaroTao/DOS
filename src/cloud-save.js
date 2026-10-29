import { LEGAL_VERSION, showLegal } from "./legal.js";
import { localSaveKey } from "./local-save.js";
import { CLOUD_CONFIG } from "./cloud-config.js";

const AUTH_KEY = "dos-cloud-auth";
const getJSON = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const putJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
// 記録1のキーは旧版の送信待ちもそのまま回収する。
const slotSuffix = slot => slot === 1 ? "" : ":slot:" + slot;
const pendingKey = (id, slot = 1) => "dos-cloud-pending:" + id + slotSuffix(slot);
const session = (a) => ({ ...a, expires_at: a.expires_at || Math.floor(Date.now() / 1000) + (a.expires_in || 3600) });

export class CloudSaveClient {
  constructor(config, { fetcher = (input, init) => fetch(input, init), storage = localStorage, slot = 1, onBusy = () => {}, onFailure = null } = {}) {
    localSaveKey(slot); this.slot = slot;
    this.config = config; this.fetcher = fetcher; this.storage = storage;
    this.onBusy = onBusy; this.onFailure = onFailure;
    this.auth = null; this.sessionId = null; this.revision = 0;
    this.tail = Promise.resolve(); this.count = 0; this.busy = false;
    this.refreshing = null; this.waiting = false;
    this.blocking = 0; this.queuedSave = null;
  }
  async fetchJSON(path, options = {}) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await this.fetcher(this.config.url.replace(/\/$/, "") + path, { ...options, signal: ctrl.signal });
      const data = await r.json();
      if (!r.ok) throw Object.assign(new Error(data.error_description || data.msg || data.error || "通信に失敗しました"), { status: r.status });
      return data;
    } finally { clearTimeout(timer); }
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
    const send = async (token) => this.fetchJSON("/functions/v1/game-save", { method: "POST",
      headers: { apikey: this.config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body) });
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
    if (op === "battle") this.blocking++;
    this.count++; this.setBusy();
    const task = this.tail.then(async () => {
      if (this.queuedSave === entry) this.queuedSave = null;
      const body = { protocol: this.config.protocol, sessionId: this.sessionId,
        commandId: crypto.randomUUID(), revision: this.revision, op, ...entry.data };
      // 送信前に記録する。結果の返答を失っても同じID・同じ内容で再送する。
      const result = await this.retry(async () => {
        this.storage.setItem(pendingKey(this.auth.user.id, this.slot), JSON.stringify(body));
        return this.request(body);
      });
      this.revision = result.revision;
      this.storage.removeItem(pendingKey(this.auth.user.id, this.slot));
      return result;
    });
    this.tail = task;
    entry.promise = task.finally(() => {
      if (op === "battle") this.blocking--;
      this.count--; this.setBusy();
    });
    return entry.promise;
  }
  async retry(fn) {
    for (;;) {
      try { return await fn(); }
      catch (e) {
        if (!this.onFailure) throw e;
        this.waiting = true;
        try { await this.onFailure(e); } finally { this.waiting = false; }
      }
    }
  }
  save(snapshot) { return this.enqueue("save", { snapshot }); }
  battle(action) { return this.enqueue("battle", { action }); }
  renew() { return this.enqueue("renew"); }
  flush() { return this.tail; }
  async claim() {
    const data = await this.request({ protocol: this.config.protocol, sessionId: this.sessionId, op: "claim" });
    this.revision = data.revision;
    return data.snapshot;
  }
  async recover() {
    const raw = this.storage.getItem(pendingKey(this.auth.user.id, this.slot));
    if (!raw) return;
    const body = JSON.parse(raw);
    if (body.sessionId !== this.sessionId) throw new Error("記録の接続が一致しません");
    const result = await this.retry(() => this.request(body));
    this.revision = result.revision;
    this.storage.removeItem(pendingKey(this.auth.user.id, this.slot));
  }
}

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
function showGate(text) {
  ensureGate(); gate.hidden = false; message.textContent = text; controls.replaceChildren();
}
function button(text, fn) {
  const b = make("button", text); b.type = "button"; b.addEventListener("click", fn); controls.append(b);
  if (controls.children.length === 1) b.focus();
  return b;
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
      button("最新の記録から再開", () => {
        localStorage.removeItem(pendingKey(client.auth.user.id, client.slot)); location.reload();
      });
    } else {
      showGate(e.message === "cloud_session_busy" ? "別の端末か画面で冒険中です。そちらを閉じて、しばらくしてから再接続してください。"
        : "記録を保存できません。接続を確かめてください。冒険はここで待っています。");
      button("再接続", () => { showGate("記録を確かめています…"); resolve(); });
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
export function cloudReady() { return ready; }
export function cloudBusy() { return !!client?.blocking || !!client?.waiting || (!!gate && !gate.hidden); }
export function cloudGuest() { return !!client?.auth?.user?.is_anonymous; }
export function cloudAccount() { return cloudGuest() ? "ゲストで冒険中" : client?.auth?.user?.email || ""; }
export function cloudSave(snapshot) { return client.save(snapshot); }
export function cloudBattle(action) { return client.battle(action); }
export function cloudFlush() { return client?.flush() || Promise.resolve(); }
export async function cloudSignOut() {
  if (cloudGuest()) { await cloudManageAccount(); return; }
  await cloudFlush(); localStorage.removeItem(AUTH_KEY); location.reload();
}
export function cloudFatal() {
  terminal = true;
  showGate("冒険の記録を処理できませんでした。最新の記録から再開してください。");
  button("再接続", () => location.reload());
}

export async function connectCloud(localSave, slot = 1, mode = "start") {
  ensureGate(); showGate("記録に接続しています…");
  if (!CLOUD_CONFIG.url || !CLOUD_CONFIG.anonKey || !/^https:\/\//.test(CLOUD_CONFIG.url)) {
    showGate("クラウド保存の接続先が設定されていません。"); throw new Error("クラウド設定が未完了です");
  }
  client = new CloudSaveClient(CLOUD_CONFIG, { slot, onBusy: (busy) => {
    if (terminal || client.waiting || managing) return;
    // 通常の保存・戦闘・占有延長では画面を覆わず、直前の景色と演出を保つ。
    // 通常保存は裏で続け、戦闘結果待ちと復旧操作だけ入力を止める。
    if (!busy) gate.hidden = true;
  }, onFailure: failure });
  const agreedThisVisit = await agreeToTerms(getJSON(AUTH_KEY)?.user?.id);
  if (!await recoveryLogin(client)) {
    client.auth = getJSON(AUTH_KEY);
    if (client.auth) {
      // 更新失敗で匿名の接続情報を捨てると、ゲストの記録を失う。再接続で保持する。
      await client.retry(async () => {
        await client.token();
        client.auth.user = await currentUser(client);
        putJSON(AUTH_KEY, client.auth);
      });
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
  await client.retry(() => client.request({ protocol: client.config.protocol, op: "consent", version: LEGAL_VERSION }));
  // タブの複製で同じ送信待ちIDが使われても、1画面だけが進められる。
  if (navigator.locks) {
    await new Promise((resolve) => {
      navigator.locks.request("dos-cloud:" + client.auth.user.id + slotSuffix(slot), { ifAvailable: true }, async (lock) => {
        if (!lock) { showGate("このアカウントは別の画面で開かれています。"); button("再接続", () => location.reload()); return; }
        resolve(); await new Promise(() => {});
      });
    });
  }
  const pending = getJSON(pendingKey(client.auth.user.id, client.slot));
  const sessionKey = "dos-cloud-session:" + client.auth.user.id + slotSuffix(slot);
  client.sessionId = pending?.sessionId || localStorage.getItem(sessionKey) || crypto.randomUUID();
  localStorage.setItem(sessionKey, client.sessionId);
  showGate("記録を読み込んでいます…");
  let snapshot = await client.retry(() => client.claim());
  if (pending) { await client.recover(); snapshot = await client.retry(() => client.claim()); }
  if (!snapshot && localSave && !localStorage.getItem("dos-cloud-deleted")) {
    const useLocal = await new Promise((resolve) => {
      showGate("このアカウントには冒険の記録がありません。この端末の記録を引き継ぎますか？");
      button("端末の記録を引き継ぐ", () => resolve(true)); button("新しい冒険を始める", () => resolve(false));
    });
    if (useLocal) { snapshot = JSON.parse(localSave); await client.save(snapshot); }
  }
  const heartbeat = async () => {
    if (!client.busy && !managing && document.visibilityState === "visible") {
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
  if (managing || !client || !ready) return;
  managing = true;
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
