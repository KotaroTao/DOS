// 楽譜記述の小さな言語 (DSL)
// 曲は Score に「チャンネル (楽器+ミキサー設定)」と「音符イベント」を書き込んで作る。
// 位置は小節 (bar, 0始まり。小数可) か拍 (beat) で指定。1拍 = 4分音符 (bpb で拍子)。
//
// 旋律文字列:  "D4:2 A4:2 | Bb4:1.5 A4:.5 G4 F4 | r:2 E4:1! D4:1?"
//   音名:長さ(拍)  長さ省略で直前と同じ / r=休符 / |=小節線(無視)
//   末尾 ! = アクセント(強く)、? = 弱く、@0.8 = ベロシティ直接指定
//   和音: "D4+F4+A4:2"
// 和音進行文字列: "Dm:4 Bb:2 Gm/Bb:2 A7:4 -:4"  (- は休み)

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "Eb3" → 51
export function nm(s) {
  if (typeof s === "number") return s;
  const m = /^([A-G])([#b]*)(-?\d)$/.exec(s);
  if (!m) throw new Error("bad note " + s);
  let pc = PC[m[1]];
  for (const a of m[2]) pc += a === "#" ? 1 : -1;
  return pc + (+m[3] + 1) * 12;
}

const QUAL = {
  "": [0, 4, 7], m: [0, 3, 7], "5": [0, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
  "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], m6: [0, 3, 7, 9], "6": [0, 4, 7, 9],
  add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2], m9: [0, 3, 7, 10, 2], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  "7b9": [0, 4, 7, 10, 1], mmaj7: [0, 3, 7, 11], mb6: [0, 3, 7, 8], "7sus4": [0, 5, 7, 10], b5: [0, 4, 6],
  mb2: [0, 3, 7, 1], phr: [0, 1, 7], cl: [0, 1, 2], tri: [0, 6],
};
// "Gm/Bb" → { root, pcs, bass }
export function chord(sym) {
  const [main, slash] = sym.split("/");
  const m = /^([A-G])([#b]?)(.*)$/.exec(main);
  if (!m) throw new Error("bad chord " + sym);
  const root = (PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const q = QUAL[m[3]];
  if (!q) throw new Error("bad chord quality " + sym);
  const pcs = q.map((i) => (root + i) % 12);
  let bass = root;
  if (slash) { const b = /^([A-G])([#b]?)$/.exec(slash); bass = (PC[b[1]] + (b[2] === "#" ? 1 : b[2] === "b" ? -1 : 0) + 12) % 12; }
  return { root, pcs, bass, sym };
}
// 進行文字列 → [{ at: 拍オフセット, d: 長さ, c: chord|null }]
export function prog(str) {
  const out = [];
  let at = 0, d = 4;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === "|") continue;
    const [s, ds] = tok.split(":");
    if (ds) d = frac(ds);
    out.push({ at, d, c: s === "-" ? null : chord(s) });
    at += d;
  }
  return out;
}
function frac(s) {
  if (s.includes("/")) { const [a, b] = s.split("/"); return (+a || 0) / +b; }
  return +s;
}

// 指定 pc の、m 以上で最も近い音
export function above(pc, m) { return m + ((pc - (m % 12) + 120) % 12); }

// 和音の声部配置 (前の配置から最小移動で滑らかに)
export function voice(c, lo, hi, n, prev) {
  const cands = [];
  for (let m = lo; m <= hi; m++) if (c.pcs.includes(m % 12)) cands.push(m);
  if (!cands.length) return [];
  // 重要な音: 3度 (なければ5度)、根音
  const need = [c.pcs[1] ?? c.pcs[0], c.pcs[0]];
  if (c.pcs.length > 3) need.push(c.pcs[3]);
  let res;
  if (!prev || !prev.length) {
    const start = lo + Math.max(0, Math.round((hi - lo - 7 - n * 2) / 2));
    res = [];
    let cur = start - 1, k = 0;
    // 根音から積む密集配置
    let idx = 0;
    while (res.length < n && k < 60) {
      const pc = c.pcs[idx % c.pcs.length];
      const m = above(pc, cur + 1);
      if (m > hi) break;
      res.push(m); cur = m; idx++; k++;
    }
    while (res.length < n) res.unshift(res[0] - 12 >= lo ? res[0] - 12 : res[0]);
  } else {
    const p = prev.slice(0, n);
    while (p.length < n) p.push(p[p.length - 1] + 4);
    res = p.map((x) => cands.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)));
  }
  // 必要な音が欠けていれば、動きの少ない声部を差し替える
  for (const pc of need) {
    if (res.some((m) => m % 12 === pc)) continue;
    let best = -1, bestCost = 1e9, bestM = 0;
    for (let i = 0; i < res.length; i++) {
      const dupe = res.filter((m) => m % 12 === res[i] % 12).length > 1 || !need.includes(res[i] % 12);
      if (!dupe) continue;
      const m = cands.filter((x) => x % 12 === pc).reduce((a, b) => (Math.abs(b - res[i]) < Math.abs(a - res[i]) ? b : a), 1e9);
      const cost = Math.abs(m - res[i]);
      if (cost < bestCost) { bestCost = cost; best = i; bestM = m; }
    }
    if (best >= 0 && bestM < 1e8) res[best] = bestM;
  }
  res.sort((a, b) => a - b);
  // 同音の重複を避ける
  for (let i = 1; i < res.length; i++) if (res[i] === res[i - 1] && res[i] + 12 <= hi) res[i] += 12;
  return [...new Set(res)].sort((a, b) => a - b);
}

export class Score {
  constructor(o) {
    this.name = o.name || "";
    this.bpm = o.bpm;
    this.bpb = o.bpb || 4;
    this.loopBars = o.loop || null; // [開始小節, 終了小節)
    this.loop = o.loop !== false && !!o.loop;
    this.gain = o.gain ?? 1;
    this.fadeIn = o.fadeIn ?? 1.2;
    this.delay = o.delay || null; // { l, r (拍), fb, lp }
    this.lenBars = o.bars || (o.loop ? o.loop[1] : 0);
    this.chans = [];
    this.cidx = {};
    this.ev = [];
  }
  get spb() { return 60 / this.bpm; }
  B(bar) { return bar * this.bpb; }
  ch(id, o) { this.cidx[id] = this.chans.length; this.chans.push({ id, ...o }); return this; }
  // 生の音符 (拍で位置指定)
  n(id, beat, m, d, v = 0.7, o = null) {
    const c = this.cidx[id];
    if (c == null) throw new Error("no channel " + id);
    const mm = typeof m === "number" ? m : nm(m);
    this.ev.push({ b: beat, c, m: mm, d, v, o });
    return this;
  }
  // 小節位置で音符
  at(id, bar, m, d, v, o) { return this.n(id, this.B(bar), m, d, v, o); }
  // 旋律
  line(id, bar, str, opt = {}) {
    let b = this.B(bar) + (opt.off || 0);
    let d = 1;
    const v0 = opt.v ?? 0.7, tr = opt.tr || 0, leg = opt.legato || 0;
    const toks = str.split(/\s+/).filter((t) => t && t !== "|");
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i];
      let v = v0;
      const at = t.indexOf("@");
      if (at >= 0) { v = +t.slice(at + 1); t = t.slice(0, at); }
      if (t.endsWith("!")) { v = Math.min(1, v * 1.25); t = t.slice(0, -1); }
      else if (t.endsWith("?")) { v *= 0.65; t = t.slice(0, -1); }
      const [ns, ds] = t.split(":");
      if (ds) d = frac(ds);
      if (ns !== "r") {
        const next = toks[i + 1];
        const l = next && !next.startsWith("r") ? leg : 0;
        for (const one of ns.split("+")) this.n(id, b, nm(one) + tr, d * (opt.art || 1) + l, v, opt.o || null);
      }
      b += d;
    }
    return b;
  }
  // 和音を伸ばす (進行から自動配置)
  chords(id, bar, str, opt = {}) {
    const lo = opt.lo ?? 48, hi = opt.hi ?? 72, n = opt.n ?? 4, v = opt.v ?? 0.6;
    let prev = opt.prev || null;
    const base = this.B(bar);
    const out = [];
    for (const p of prog(str)) {
      if (!p.c) continue;
      const vs = opt.fixed ? opt.fixed : voice(p.c, lo, hi, n, prev);
      prev = vs;
      const vv = typeof v === "function" ? v(base + p.at) : v;
      for (const m of vs) this.n(id, base + p.at, m + (opt.tr || 0), p.d * (opt.art || 1) + (opt.legato || 0), vv, opt.o || null);
      if (opt.bass) this.n(opt.bass, base + p.at, above(p.c.bass, opt.bassLo ?? 36), p.d + (opt.legato || 0), opt.bassV ?? vv, null);
      out.push({ at: base + p.at, d: p.d, c: p.c, vs });
    }
    this._prev = prev;
    return out;
  }
  // 分散和音 (pat は和音構成音の番号。負は下のオクターブ、"r" は休み)
  arp(id, bar, str, opt = {}) {
    const lo = opt.lo ?? 48, hi = opt.hi ?? 84, step = opt.step ?? 0.5, v = opt.v ?? 0.55;
    const pat = opt.pat || [0, 1, 2, 3, 2, 1];
    const base = this.B(bar);
    for (const p of prog(str)) {
      if (!p.c) continue;
      // 構成音を lo から積み上げた音列
      const tones = [];
      let cur = above(p.c.bass, lo);
      tones.push(cur);
      const order = [...p.c.pcs].sort((a, b) => ((a - p.c.bass + 12) % 12) - ((b - p.c.bass + 12) % 12));
      let k = 1;
      while (tones.length < 12) {
        const pc = order[k % order.length];
        cur = above(pc, cur + 1);
        if (cur > hi) break;
        tones.push(cur); k++;
      }
      const nSteps = Math.round(p.d / step);
      for (let i = 0; i < nSteps; i++) {
        const ix = pat[i % pat.length];
        if (ix === "r" || ix == null) continue;
        const m = tones[Math.min(tones.length - 1, Math.max(0, ix))];
        const acc = opt.acc && i % opt.acc === 0 ? 1.2 : 1;
        // 既定の長さ: 和音が変わるまで響かせる (チャンネルに cut があればそこで消音)
        const d = opt.dur ?? (p.d - i * step + (opt.ring ?? 0.02));
        this.n(id, base + p.at + i * step, m, d, Math.min(1, v * acc * (opt.vf ? opt.vf(i) : 1)), opt.o || null);
      }
    }
  }
  // 打楽器パターン ("X..x" 文字列。長さで1小節を等分。X=強 x=中 o=弱 .=休)
  drum(id, bar, bars, pat, opt = {}) {
    const pats = Array.isArray(pat) ? pat : [pat];
    const m = opt.m ?? 60, v = opt.v ?? 0.8;
    for (let b = 0; b < bars; b++) {
      const p = pats[b % pats.length].replace(/\s|\|/g, "");
      const step = this.bpb / p.length;
      for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if (ch === ".") continue;
        const vv = ch === "X" ? v : ch === "x" ? v * 0.72 : ch === "o" ? v * 0.45 : v * 0.3;
        this.n(id, this.B(bar + b) + i * step, opt.mm ? opt.mm(b, i) : m, step, vv, opt.o || null);
      }
    }
  }
  // ロール (連打のクレッシェンド)
  roll(id, beat, dur, m, v0, v1, perBeat = 6) {
    const n = Math.max(1, Math.round(dur * perBeat));
    for (let i = 0; i < n; i++) {
      const p = i / n;
      this.n(id, beat + i / perBeat, m, 1 / perBeat, v0 + (v1 - v0) * p * p, null);
    }
  }
  // シンバルのふくらみ: 終端が target 拍に来るよう配置 (len 秒のサンプル)
  swell(id, targetBeat, v = 0.7, len = 2.7) {
    this.n(id, targetBeat - len / this.spb, 60, len / this.spb, v, null);
  }
  build() {
    const ev = this.ev.slice().sort((a, b) => a.b - b.b || a.c - b.c);
    const loopStart = this.loopBars ? this.B(this.loopBars[0]) : 0;
    const loopEnd = this.loopBars ? this.B(this.loopBars[1]) : this.B(this.lenBars) || (ev.length ? Math.max(...ev.map((e) => e.b + e.d)) : 0);
    let loopIdx = ev.findIndex((e) => e.b >= loopStart);
    if (loopIdx < 0) loopIdx = ev.length;
    return {
      name: this.name, bpm: this.bpm, bpb: this.bpb, spb: this.spb, loop: this.loop,
      loopStart, loopEnd, loopIdx, gain: this.gain, fadeIn: this.fadeIn, delay: this.delay,
      chans: this.chans, ev,
    };
  }
}
