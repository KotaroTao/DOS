// 試遊専用の追記API。本編の保存・認証情報の更新は行わない。
import { CLOUD_CONFIG } from "./cloud-config.js";
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function trialAuth(storage = localStorage, now = Date.now(), config = CLOUD_CONFIG) {
  let auth;
  try { auth = JSON.parse(storage.getItem("dos-cloud-auth")); } catch {}
  if (!config.enabled || !config.url || !config.anonKey) throw Error("この公開元ではクラウド計測を利用できません。");
  if (!auth?.access_token || !auth.user?.id || !(auth.expires_at * 1000 > now + 15000)) throw Error("先にゲームのタイトルから接続してください。ログインの期限が切れた場合も、タイトルで接続し直してください。");
  return auth;
}
export class TrialLedger {
  constructor({ config = CLOUD_CONFIG, storage = localStorage, fetcher = (...args) => fetch(...args), token = null, now = () => performance.now(), onSample = () => {} } = {}) {
    this.config = config; this.storage = storage; this.fetcher = fetcher; this.now = now; this.onSample = onSample; this.token = token;
    this.run = null; this.step = 0; this.pending = null; this.sending = null; this.ended = false; this.closing = null;
  }
  async call(name, body, { keepalive = false } = {}) {
    const auth = this.token ? { access_token: this.token } : trialAuth(this.storage, Date.now(), this.config);
    const raw = JSON.stringify(body), started = this.now(), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let status = 0, received = 0, ok = false;
    try {
      const response = await this.fetcher(this.config.url.replace(/\/$/, "") + "/rest/v1/rpc/dos_choice_trial_" + name, {
        method: "POST", headers: { apikey: this.config.anonKey, Authorization: "Bearer " + auth.access_token, "Content-Type": "application/json" }, body: raw, signal: controller.signal, keepalive,
      });
      status = response.status;
      const text = await response.text(); received = new TextEncoder().encode(text).length;
      let value; try { value = JSON.parse(text); } catch {}
      if (!response.ok) {
        const message = status === 401 ? "接続の期限が切れました。タイトルで接続し直してください。"
          : /rate_limit|too_many_runs/.test(value?.message || "") ? "試遊の回数が上限に達しました。開いている試遊を終了するか、時間を置いてください。"
          : "試遊の通信を確認できません。同じ選択で再接続してください。";
        throw Object.assign(Error(message), { status });
      }
      if (!value) throw Error("試遊の返答を読み取れません。");
      ok = true; return value;
    } finally {
      clearTimeout(timer);
      try { this.onSample({ op: name, ms: Math.max(0, this.now() - started), sentBytes: new TextEncoder().encode(raw).length, receivedBytes: received, status, ok }); } catch {}
    }
  }
  async open(mode, version) {
    const value = await this.call("begin", { p_mode: mode, p_version: version });
    if (!uuid(value.run) || value.step !== 0) throw Error("試遊の開始を確認できません。");
    this.run = value.run; return value;
  }
  key() { return "dos-choice-trial-pending:" + this.run; }
  append(choice) {
    if (!this.run || this.ended) return Promise.reject(Error("試遊が開始されていません。"));
    if (this.pending) return Promise.reject(Error("選択した行動が確定待ちです。"));
    if (this.step >= 256) return Promise.reject(Error("この試遊は256手までです。結果を保存して新しい試遊を始めてください。"));
    const body = { p_run: this.run, p_step: this.step + 1, p_command: crypto.randomUUID(), p_choice: JSON.parse(JSON.stringify(choice)) };
    // 送信前に小さな選択を同期保管する。通信失敗時もID・内容を変えない。
    try { this.storage.setItem(this.key(), JSON.stringify(body)); } catch { return Promise.reject(Error("選択を端末へ保管できません。試遊を進めません。")); }
    this.pending = body;
    return this.retry();
  }
  retry() {
    if (!this.pending) return Promise.reject(Error("再接続する選択がありません。"));
    if (this.sending) return this.sending;
    const body = this.pending;
    this.sending = this.call("append", body).then(value => {
      if (value.step !== body.p_step || !uuid(value.receipt)) throw Error("選択の確定を確認できません。");
      this.step = value.step; this.pending = null;
      try { this.storage.removeItem(this.key()); } catch {}
      return value;
    }).finally(() => { this.sending = null; });
    return this.sending;
  }
  close({ keepalive = false } = {}) {
    this.ended = true;
    if (this.closing) return this.closing;
    if (!this.run) return Promise.resolve();
    this.closing = this.call("close", { p_run: this.run }, { keepalive }).then(value => {
      if (!value.closed) throw Error("試遊の終了を確認できません。");
      try { this.storage.removeItem(this.key()); } catch {}
      this.pending = null; this.run = null;
    }).finally(() => { this.closing = null; });
    return this.closing;
  }
}
export function timingSummary(samples) {
  const values = samples.filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!values.length) return null;
  const at = p => values[Math.max(0, Math.ceil(values.length * p) - 1)];
  return { samples: values.length, meanMs: values.reduce((a, b) => a + b, 0) / values.length, medianMs: values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2, p95Ms: at(.95), maxMs: values.at(-1) };
}
