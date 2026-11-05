import { traceSync, traceWait } from './battle-trace.js';
import { decodeCommandResponse } from "./cloud-command-codec.js";
import { createCloudChange } from "./cloud-change.js";
import { refSerialize, acknowledgedSave } from "./savegraph.js";
let worker, sequence = 0, workerUnavailable = false;
const pending = new Map();
function localWork(op, value, packet, compact) { return traceSync("save.fallback."+op,()=>localWorkTraced(op,value,packet,compact)); }
function localWorkTraced(op, value, packet, compact) {
  // 画面の戦闘フックを上書きしない。Workerを使えない端末は従来のサーバー返答を使う。
  if (op === "replayCommand") return null;
  if (op === "commandReply") return decodeCommandResponse(value, packet);
  if (op === "change") return createCloudChange(value, packet);
  if (op === "encode") return JSON.stringify(refSerialize(value, { compact }));
  return acknowledgedSave(value, packet);
}
function work(op, value, packet, compact) { return traceWait("save.roundtrip."+op,()=>workTraced(op,value,packet,compact)); }
function workTraced(op, value, packet, compact) {
  if (typeof Worker === "undefined" || workerUnavailable) return Promise.resolve(localWork(op, value, packet, compact));
  if (!worker) {
    try { worker = new Worker(new URL("./save-codec-worker.js", import.meta.url), { type: "module" }); }
    catch {
      // Workerの生成が制限された端末でも、従来の同期処理で記録を保つ。
      return Promise.resolve(localWork(op, value, packet, compact));
    }
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id); if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    worker.onerror = worker.onmessageerror = event => {
      event?.preventDefault?.();
      const jobs=[...pending.values()];pending.clear();
      worker?.terminate();worker=null;workerUnavailable=true;
      // モジュールの非同期読込が失敗する端末でも、生成時の失敗と同じ処理で記録を保つ。
      for(const job of jobs)Promise.resolve().then(()=>localWork(job.op,job.value,job.packet,job.compact)).then(job.resolve,job.reject);
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject, op, value, packet, compact });
    try { traceSync("save.postMessage."+op,()=>worker.postMessage({ id, op, value, packet, compact })); }
    catch (e) {
      // 戦果の宝箱などは画面を開く際に操作関数を付ける。従来の保存同様に
      // 関数だけを除外し、個体・共有参照・循環を保った写しで再送する。
      if (op === "encode" && e.name === "DataCloneError") {
        try { traceSync("save.cloneRetry."+op,()=>worker.postMessage({ id, op, value: cloneSaveData(value), packet, compact })); return; }
        catch (retryError) { e = retryError; }
      }
      pending.delete(id); reject(e);
    }
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

// structured cloneで扱えない操作関数がある時だけ使う。通常の行動は写し直さない。
export function cloneSaveData(root) {
  const seen = new Map();
  const copy = value => {
    if (typeof value === "function") return null;
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    const out = Array.isArray(value) ? [] : {};
    seen.set(value, out);
    if (Array.isArray(value)) for (const entry of value) out.push(copy(entry));
    else for (const key of Object.keys(value)) if (typeof value[key] !== "function") {
      Object.defineProperty(out, key, { value: copy(value[key]), enumerable: true, writable: true, configurable: true });
    }
    return out;
  };
  return copy(root);
}

export const encodeCloudChange = (base, next) => work("change", base, next);

export const decodeCloudCommand = (base, response) => work("commandReply", base, response);

export const cloudWorkerReady = () => !!worker;
export const replayCloudCommandPrepared = (graph, command, commandId, forcedTurns = false, ledger = false) => work("replayCommand", graph, { command, commandId, forcedTurns, ledger });
