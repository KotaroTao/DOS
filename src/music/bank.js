// 楽器サンプルの倉庫 — 必要になったゾーンだけを生成し、AudioBuffer として保持する。
// 生成はモジュールワーカー (music/worker.js) で行い、使えない環境ではメインスレッドで少しずつ行う。
// 使わなくなったサンプルは古い順に捨て、メモリ上限を守る (スマホ対策)。
import { generateZone } from "./instruments.js";

const PRIO = { now: 0, high: 1, low: 2 };

export class Bank {
  constructor() {
    this.ctx = null;           // AudioBuffer 生成用 (コンストラクタ非対応環境の保険)
    this.bufs = new Map();     // key → AudioBuffer
    this.raw = new Map();      // key → { sr, ch } (AudioBuffer にできるまでの一時置き)
    this.waits = new Map();    // key → [resolve...]
    this.queue = [];           // [{ key, prio }]
    this.busy = 0;
    this.used = new Map();     // key → 最終使用時刻
    this.bytes = 0;
    this.budget = 56e6;
    try {
      const dm = typeof navigator !== "undefined" && navigator.deviceMemory;
      if (dm && dm <= 2) this.budget = 30e6;
      else if (dm && dm <= 4) this.budget = 44e6;
    } catch {}
    this.worker = null;
    this.workerOk = false;
    this.workerTried = false;
    this.paused = false;
    this.useWorker = true;
  }
  setContext(ctx) {
    this.ctx = ctx;
    for (const [k, r] of this.raw) { this.store(k, r); }
    this.raw.clear();
  }
  has(key) { return this.bufs.has(key) || this.raw.has(key); }
  get(key) {
    let b = this.bufs.get(key);
    if (!b && this.raw.has(key)) { this.store(key, this.raw.get(key)); this.raw.delete(key); b = this.bufs.get(key); }
    if (b) this.used.set(key, performance.now());
    return b || null;
  }
  store(key, r) {
    let b = null;
    const len = r.ch[0].length;
    try { b = new AudioBuffer({ length: len, numberOfChannels: r.ch.length, sampleRate: r.sr }); } catch {}
    if (!b && this.ctx) { try { b = this.ctx.createBuffer(r.ch.length, len, r.sr); } catch {} }
    if (!b) { this.raw.set(key, r); return; }
    for (let i = 0; i < r.ch.length; i++) b.getChannelData(i).set(r.ch[i]);
    if (!this.bufs.has(key)) this.bytes += len * r.ch.length * 4;
    this.bufs.set(key, b);
    this.used.set(key, performance.now());
  }
  // 必要なサンプルが揃ったら解決する Promise
  ensure(keys, prio = "high") {
    const missing = keys.filter((k) => !this.has(k));
    if (!missing.length) return Promise.resolve();
    const ps = missing.map((k) => new Promise((res) => {
      if (!this.waits.has(k)) this.waits.set(k, []);
      this.waits.get(k).push(res);
    }));
    for (const k of missing) this.enqueue(k, prio);
    this.pump();
    return Promise.all(ps);
  }
  prefetch(keys) { for (const k of keys) if (!this.has(k)) this.enqueue(k, "low"); this.pump(); }
  enqueue(key, prio) {
    const p = PRIO[prio] ?? 2;
    const q = this.queue.find((x) => x.key === key);
    if (q) { q.prio = Math.min(q.prio, p); return; }
    if (this.inflight && this.inflight.has(key)) return;
    this.queue.push({ key, prio: p });
  }
  done(key, r) {
    if (this.inflight) this.inflight.delete(key);
    if (r) this.store(key, r);
    const ws = this.waits.get(key);
    if (ws) { this.waits.delete(key); for (const w of ws) w(); }
  }
  setPaused(p) { this.paused = p; if (!p) this.pump(); }
  pump() {
    if (this.paused) return;
    this.queue.sort((a, b) => a.prio - b.prio);
    if (!this.inflight) this.inflight = new Set();
    if (this.useWorker && !this.workerTried) this.startWorker();
    const max = this.workerOk ? 2 : 1;
    while (this.busy < max && this.queue.length) {
      // 先読み (low) はメモリ上限に余裕がある時だけ
      if (this.queue[0].prio >= PRIO.low && this.bytes > this.budget * 0.9) { this.queue = this.queue.filter((q) => q.prio < PRIO.low); continue; }
      const { key, prio } = this.queue.shift();
      if (this.has(key)) { this.done(key, null); continue; }
      this.busy++;
      this.inflight.add(key);
      if (this.workerOk) this.worker.postMessage({ key });
      else this.runLocal(key, prio);
    }
  }
  startWorker() {
    this.workerTried = true;
    try {
      if (typeof Worker === "undefined") return;
      this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      this.workerOk = true;
      this.worker.onmessage = (e) => {
        const d = e.data;
        this.busy = Math.max(0, this.busy - 1);
        if (d.err) { console.warn("[audio] 生成失敗", d.key, d.err); this.done(d.key, null); }
        else this.done(d.key, { sr: d.sr, ch: d.ch });
        this.pump();
      };
      this.worker.onerror = (e) => {
        // ワーカーが使えない環境: 以後メインスレッドで生成
        console.warn("[audio] worker unavailable, fallback", e && e.message);
        this.workerOk = false;
        try { this.worker.terminate(); } catch {}
        this.worker = null;
        const lost = this.inflight ? [...this.inflight] : [];
        this.inflight.clear();
        this.busy = 0;
        for (const k of lost) if (!this.has(k)) this.queue.unshift({ key: k, prio: 0 });
        this.pump();
      };
    } catch (e) {
      this.workerOk = false;
      this.worker = null;
    }
  }
  runLocal(key) {
    // メインスレッド生成: 1ゾーンずつ間をあけて描画を妨げない
    const go = () => {
      let r = null;
      try { r = generateZone(key); } catch (e) { console.warn("[audio] 生成失敗", key, e); }
      this.busy = Math.max(0, this.busy - 1);
      this.done(key, r);
      setTimeout(() => this.pump(), 4);
    };
    setTimeout(go, 0);
  }
  // 同期生成 (オフライン書き出し・ワーカー無効時の即時用)
  ensureSync(keys) {
    for (const k of keys) if (!this.has(k)) { const r = generateZone(k); this.store(k, r); }
  }
  // メモリ上限を超えたら、protect 以外を古い順に捨てる
  trim(protect) {
    if (this.bytes <= this.budget) return;
    const keep = new Set(protect);
    const list = [...this.bufs.keys()].filter((k) => !keep.has(k)).sort((a, b) => (this.used.get(a) || 0) - (this.used.get(b) || 0));
    for (const k of list) {
      if (this.bytes <= this.budget * 0.85) break;
      const b = this.bufs.get(k);
      this.bytes -= b.length * b.numberOfChannels * 4;
      this.bufs.delete(k);
      this.used.delete(k);
    }
  }
}
