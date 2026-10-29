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
    this.count++; this.setBusy();
    const task = this.tail.then(async () => {
      const body = { protocol: this.config.protocol, sessionId: this.sessionId,
        commandId: crypto.randomUUID(), revision: this.revision, op, ...data };
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
    return task.finally(() => { this.count--; this.setBusy(); });
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
      if (!gate.hidden && !gate.contains(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
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
      button("ログインし直す", () => { localStorage.removeItem(AUTH_KEY); location.reload(); });
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

function login(c) {
  return new Promise((resolve) => {
    showGate("ログイン");
    const form = make("form");
    const field = (label, type, autocomplete) => {
      const row = make("label", label), input = make("input");
      input.type = type; input.required = true; input.autocomplete = autocomplete;
      row.append(input); form.append(row); return input;
    };
    const email = field("メールアドレス", "email", "username");
    const password = field("パスワード", "password", "current-password"); password.minLength = 8;
    const submit = make("button", "ログイン"); submit.type = "submit"; form.append(submit); controls.append(form);
    let working = false;
    const perform = async (signup) => {
      if (working || !form.reportValidity()) return;
      working = true; submit.disabled = true; signupButton.disabled = true;
      try {
        const a = await c.authRequest(signup ? "signup" : "token?grant_type=password", { email: email.value.trim(), password: password.value });
        if (!a.access_token) { message.textContent = "確認メールを送りました。メール内のリンクで確認してからログインしてください。"; return; }
        c.auth = session(a); putJSON(AUTH_KEY, c.auth); resolve();
      } catch { message.textContent = signup ? "登録できませんでした。入力内容と接続を確かめてください。" : "ログインできませんでした。入力内容・メールの確認・接続を確かめてください。"; }
      finally { working = false; submit.disabled = false; signupButton.disabled = false; }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); perform(false); });
    const signupButton = button("アカウントを作成", () => perform(true));
    button("パスワードを忘れた", async () => {
      if (working || !email.reportValidity()) return;
      working = true;
      try {
        await c.authRequest("recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: email.value.trim() });
        message.textContent = "登録済みの場合、パスワード再設定のメールが届きます。";
      } catch { message.textContent = "メールを送信できませんでした。接続を確かめてください。"; }
      finally { working = false; }
    });
    email.focus();
  });
}

async function recoveryLogin(c) {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("type") !== "recovery" || !hash.get("access_token")) return false;
  c.auth = { access_token: hash.get("access_token"), refresh_token: hash.get("refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600) };
  history.replaceState(null, "", location.pathname + location.search);
  const user = await c.fetchJSON("/auth/v1/user", { headers: { apikey: c.config.anonKey, Authorization: `Bearer ${c.auth.access_token}` } });
  c.auth.user = user;
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
export function cloudReady() { return ready; }
export function cloudBusy() { return !!client?.busy || (!!gate && !gate.hidden); }
export function cloudAccount() { return client?.auth?.user?.email || ""; }
export function cloudSave(snapshot) { return client.save(snapshot); }
export function cloudBattle(action) { return client.battle(action); }
export function cloudFlush() { return client?.flush() || Promise.resolve(); }
export async function cloudSignOut() {
  await cloudFlush(); localStorage.removeItem(AUTH_KEY); location.reload();
}
export function cloudFatal() {
  terminal = true;
  showGate("冒険の記録を処理できませんでした。最新の記録から再開してください。");
  button("再接続", () => location.reload());
}

export async function connectCloud(localSave, slot = 1) {
  ensureGate(); showGate("記録に接続しています…");
  if (!CLOUD_CONFIG.url || !CLOUD_CONFIG.anonKey || !/^https:\/\//.test(CLOUD_CONFIG.url)) {
    showGate("クラウド保存の接続先が設定されていません。"); throw new Error("クラウド設定が未完了です");
  }
  client = new CloudSaveClient(CLOUD_CONFIG, { slot, onBusy: (busy) => {
    if (terminal || client.waiting) return;
    // 通常の保存・戦闘・占有延長では画面を覆わず、直前の景色と演出を保つ。
    // 通信順序とcloudBusyによる二重操作防止は表示から独立して維持する。
    if (!busy) gate.hidden = true;
  }, onFailure: failure });
  if (!await recoveryLogin(client)) {
    client.auth = getJSON(AUTH_KEY);
    if (client.auth) {
      try { await client.token(); }
      catch { client.auth = null; localStorage.removeItem(AUTH_KEY); }
    }
    if (!client.auth) await login(client);
  }
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
  if (!snapshot && localSave) {
    const useLocal = await new Promise((resolve) => {
      showGate("このアカウントの選んだ枠には冒険の記録がありません。この端末の記録を引き継ぎますか？");
      button("端末の記録を引き継ぐ", () => resolve(true)); button("新しい冒険を始める", () => resolve(false));
    });
    if (useLocal) { snapshot = JSON.parse(localSave); await client.save(snapshot); }
  }
  const heartbeat = async () => {
    if (!client.busy && document.visibilityState === "visible") {
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
