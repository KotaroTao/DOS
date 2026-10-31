// 保存の計測は端末内の数値だけ。認証情報・記録本文・要求IDは残さない。
const KEY = "dos-save-metrics-v1";
const LATENCY_BOUNDS = [100, 500, 1000, 5000, 15000];
const OPS = ["command", "save", "claim", "renew", "battle", "turn", "consent", "reset", "delete-account"];
const empty = () => ({ v: 1, startedAt: new Date().toISOString(), visibleMs: 0, operations: {}, trial: { triggers: 0, samples: 0, snapshotBytes: 0, maxSnapshotBytes: 0 } });
export const utf8Bytes = text => new TextEncoder().encode(text || "").byteLength;
export class SaveMetrics {
  constructor({ storage, now = () => performance.now() } = {}) {
    if (storage === undefined) { try { storage = globalThis.localStorage; } catch { /* 端末保管が禁止されてもメモリで計測 */ } }
    this.storage = storage; this.now = now; this.data = empty(); this.last = now(); this.visible = true; this.dirty = false; this.storageError = false;
    try { const saved = JSON.parse(storage?.getItem(KEY)); if (saved?.v === 1 && saved.operations && saved.trial) this.data = saved; } catch { /* 計測の失敗で冒険を止めない */ }
  }
  tick() { const now = this.now(); if (this.visible) this.data.visibleMs += Math.max(0, now - this.last); this.last = now; }
  visibility(visible) { this.tick(); this.visible = visible; }
  record(op, { sent = 0, received = 0, ms = 0, status = 0, ok = false } = {}) {
    if (!OPS.includes(op)) return;
    this.tick();
    const s = this.data.operations[op] ||= { attempts: 0, successes: 0, failures: 0, sentBytes: 0, receivedBytes: 0, totalMs: 0, maxMs: 0, maxSentBytes: 0, statuses: {}, latencyBuckets: [0, 0, 0, 0, 0, 0] };
    s.attempts++; s[ok ? "successes" : "failures"]++; s.sentBytes += sent; s.receivedBytes += received; s.totalMs += ms;
    s.maxMs = Math.max(s.maxMs, ms); s.maxSentBytes = Math.max(s.maxSentBytes, sent);
    s.statuses[status] = (s.statuses[status] || 0) + 1;
    const bucket = LATENCY_BOUNDS.findIndex(n => ms <= n);
    s.latencyBuckets[bucket < 0 ? 5 : bucket]++;
    this.dirty = true;
  }
  trialTrigger() { this.data.trial.triggers++; this.dirty = true; }
  trialSample(raw) { const bytes = utf8Bytes(raw); const t = this.data.trial; t.samples++; t.snapshotBytes += bytes; t.maxSnapshotBytes = Math.max(t.maxSnapshotBytes, bytes); this.dirty = true; }
  report() {
    this.tick();
    return JSON.parse(JSON.stringify({ ...this.data, exportedAt: new Date().toISOString(), scope: "この端末・同じ公開元の累計。表示中の時間はタイトル・待機を含む。複数タブの同時計測は非対応。", units: "本文のUTF-8バイト。HTTP/TLS・圧縮・画像・認証・DB内部通信・課金転送量は対象外。失敗時の送信量は送信予定本文、受信量は読み取り完了分。", latencyBoundsMs: [100, 500, 1000, 5000, 15000, null], trialNote: "試遊は送信しない。triggersは保存契機、snapshotBytesは最大5秒に1回の圧縮セーブ容量サンプルの合計。送信回数・通信量の実測とは別。", storageError: this.storageError }));
  }
  persist() { this.tick(); try { if (!this.storage) throw new Error("計測の保管先を利用できません"); this.storage.setItem(KEY, JSON.stringify(this.data)); this.storageError = false; this.dirty = false; } catch { this.storageError = true; } }
  clear() { this.data = empty(); this.last = this.now(); this.persist(); }
}
export const saveMetrics = new SaveMetrics();
if (typeof window !== "undefined" && typeof document !== "undefined") {
  saveMetrics.visibility(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", () => { saveMetrics.visibility(document.visibilityState === "visible"); saveMetrics.persist(); });
  window.addEventListener("pagehide", () => saveMetrics.persist());
  setInterval(() => { if (saveMetrics.dirty) saveMetrics.persist(); }, 15000);
}
export function showSaveMetrics() {
  if (document.querySelector(".save-metrics")) return;
  const dialog = document.createElement("dialog"); dialog.className = "playtest-records save-metrics"; dialog.setAttribute("aria-label", "保存と通信の計測");
  const heading = document.createElement("h2"); heading.textContent = "保存と通信の計測";
  const output = document.createElement("textarea"); output.readOnly = true; output.setAttribute("aria-label", "保存と通信の計測結果");
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const draw = () => {
    const r = saveMetrics.report(), rows = Object.entries(r.operations);
    const total = rows.reduce((a, [,s]) => ({ attempts: a.attempts + s.attempts, sent: a.sent + s.sentBytes, received: a.received + s.receivedBytes }), { attempts: 0, sent: 0, received: 0 });
    const minutes = r.visibleMs / 60000;
    output.value = `開始: ${r.startedAt}\n表示中: ${minutes.toFixed(1)}分\n保存API: ${total.attempts}回（${minutes ? (total.attempts / minutes).toFixed(2) : 0}回/分）\n送信本文: ${total.sent} B / 受信本文: ${total.received} B\n\n` + rows.map(([op,s]) => `${op}: ${s.attempts}回 / 成功 ${s.successes} / 失敗 ${s.failures} / 平均 ${(s.totalMs / s.attempts).toFixed(0)} ms / 最大 ${s.maxMs.toFixed(0)} ms / 最大送信 ${s.maxSentBytes} B`).join("\n") + `\n\n試遊: 保存契機 ${r.trial.triggers}回 / 容量サンプル ${r.trial.samples}回 / 平均 ${r.trial.samples ? Math.round(r.trial.snapshotBytes / r.trial.samples) : 0} B / 最大 ${r.trial.maxSnapshotBytes} B\n${r.trialNote}\n\n${r.scope}\n${r.units}`;
    status.textContent = r.storageError ? "端末への保存に失敗しました。JSONを書き出してください。" : "この端末だけに数値を記録します。外部へ自動送信しません。";
  };
  const controls = document.createElement("div"); controls.className = "playtest-controls";
  const button = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = fn; controls.append(b); };
  button("更新", draw);
  button("JSON保存", () => { const url = URL.createObjectURL(new Blob([JSON.stringify(saveMetrics.report(), null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "dos-save-metrics.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  button("計測をリセット", () => { if (window.confirm("保存と通信の計測だけをリセットしますか？冒険の記録は残ります。")) { saveMetrics.clear(); draw(); } });
  button("閉じる", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove()); dialog.addEventListener("keydown", e => e.stopPropagation());
  dialog.append(heading, status, output, controls); document.body.append(dialog); draw(); dialog.showModal();
}
