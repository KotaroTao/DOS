import { refSerialize, acknowledgedSave } from "./savegraph.js";
let worker, sequence = 0;
const pending = new Map();
function work(op, value, packet, compact) {
  if (typeof Worker === "undefined") return Promise.resolve(op === "encode" ? JSON.stringify(refSerialize(value, { compact })) : acknowledgedSave(value, packet));
  if (!worker) {
    worker = new Worker(new URL("./save-codec-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id); if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error("記録の準備に失敗しました"));
      pending.clear(); worker.terminate(); worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    try { worker.postMessage({ id, op, value, packet, compact }); }
    catch (e) { pending.delete(id); reject(e); }
  });
}
export function encodeCloudSave(snapshot, compact) {
  // 戦闘ログの描画関数は保存対象外。人業・対象・袋の共有参照はそのまま渡す。
  const value = { ...snapshot };
  if (value.battle) {
    value.battle = { ...value.battle };
    for (const k of Object.keys(value.battle)) if (typeof value.battle[k] === "function") delete value.battle[k];
  }
  return work("encode", value, null, compact);
}
export const acknowledgeCloudSave = (raw, packet) => work("ack", raw, packet);
