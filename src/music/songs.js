// 楽曲 — 魂の迷宮の音楽 (すべて楽譜データ。音は instruments.js の合成楽器で鳴る)
//
// 主導動機「魂の動機」(ニ短調): D–A | B♭–A–G–F | E–F–D–C♯ | D
//   五度の跳躍のあと短六度 (B♭) から半音で沈むため息。タイトルで提示し、
//   街・宿・館・墓地・戦闘・ボス・オープニングで形を変えて繰り返し現れる。
import { Score, prog, above, nm, voice } from "./score.js";

// ---- 共通ヘルパ ----
// 8分音符の刻み (根音・オクターブ・五度)。和音進行に追従する
function ost(s, id, bar, str, o = {}) {
  const pat = o.pat || [0, 0, 12, 0, 0, 7, 0, 12];
  const step = o.step || 0.5;
  const base = s.B(bar);
  for (const p of prog(str)) {
    if (!p.c) continue;
    const R = above(o.slash ? p.c.bass : p.c.root, o.lo ?? 33);
    const n = Math.round(p.d / step);
    for (let i = 0; i < n; i++) {
      const off = pat[i % pat.length];
      if (off == null) continue;
      const acc = o.acc ? o.acc(i) : (i % 8 === 0 ? 1 : i % 4 === 0 ? 0.86 : 0.62);
      s.n(id, base + p.at + i * step, R + off, o.dur ?? step, (o.v ?? 0.7) * acc, o.o || null);
    }
  }
}
// 根音 (分数和音なら指定ベース) を伸ばす
function roots(s, id, bar, str, lo = 36, v = 0.55, o = {}) {
  const base = s.B(bar);
  for (const p of prog(str)) {
    if (!p.c) continue;
    const m = above(p.c.bass, lo);
    const d = o.d ?? p.d + (o.legato ?? 0.1);
    s.n(id, base + p.at + (o.off || 0), m, d, typeof v === "function" ? v(base + p.at) : v, o.o || null);
    if (o.oct && m - 12 >= 28) s.n(id, base + p.at + (o.off || 0), m - 12, d, (typeof v === "function" ? v(base + p.at) : v) * o.oct, o.o || null);
    if (o.every) for (let k = o.every; k < p.d - 0.01; k += o.every) s.n(id, base + p.at + k, m, o.d ?? o.every, (typeof v === "function" ? v(base + p.at) : v) * (o.ev2 ?? 0.7), o.o || null);
  }
}
// 和音の刻み (金管のスタブなど)。rhythm: [[拍, 長さ, 強さ], ...] を cycle 拍ごとに繰り返す
function stabs(s, id, bar, str, rhythm, o = {}) {
  const base = s.B(bar);
  let prev = null;
  for (const p of prog(str)) {
    if (!p.c) continue;
    const vs = voice(p.c, o.lo ?? 50, o.hi ?? 67, o.n ?? 3, prev);
    prev = vs;
    const cyc = o.cycle ?? 4;
    for (let k = 0; k < p.d - 0.001; k += cyc) {
      for (const [at, d, v] of rhythm) {
        if (k + at >= p.d - 0.001) continue;
        for (const m of vs) s.n(id, base + p.at + k + at, m, d, (o.v ?? 0.8) * v, o.o || null);
      }
    }
  }
}
const tr = (str, n) => str.split(/\s+/).map((t) => {
  if (!t || t === "|" || t.startsWith("r")) return t;
  const [a, b] = t.split(":");
  const mods = a.match(/[!?]$/) ? a.slice(-1) : "";
  const notes = (mods ? a.slice(0, -1) : a).split("+").map((x) => nameOf(nm(x) + n)).join("+");
  return notes + mods + (b != null ? ":" + b : "");
}).join(" ");
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
// 音階上での移調 (scale: 音階の音名クラス配列。音階外の音は直下の音階音として扱う)
const dia = (str, steps, scale) => str.split(/\s+/).map((t) => {
  if (!t || t === "|" || t.startsWith("r")) return t;
  const [a, b] = t.split(":");
  const notes = a.split("+").map((x) => {
    const m = nm(x);
    const pc = m % 12;
    let k = scale.indexOf(pc);
    if (k < 0) { k = scale.findIndex((q, i) => q < pc && (scale[i + 1] == null || scale[i + 1] > pc)); if (k < 0) k = scale.length - 1; }
    let idx = k + steps;
    const oo = Math.floor(idx / scale.length);
    idx -= oo * scale.length;
    const pc2 = scale[idx];
    const base = scale[0];
    const rel = (pc2 - base + 12) % 12, relSrc = (pc - base + 12) % 12;
    let res = m - relSrc + rel + oo * 12;
    if (rel < relSrc && steps > 0 && oo === 0) res += 12;
    if (rel > relSrc && steps < 0 && oo === 0) res -= 12;
    return nameOf(res);
  }).join("+");
  return notes + (b != null ? ":" + b : "");
}).join(" ");
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];

const nameOf = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

// 魂の動機 (ニ短調・4/4・4小節) と、その応答句・高揚句
const SOUL1 = "D4:2 A4:2 | Bb4:1.5 A4:.5 G4:1 F4:1 | E4:1.5 F4:.5 D4:1 C#4:1 | D4:4";
const SOUL2 = "F4:2 C5:2 | D5:1.5 C5:.5 Bb4:1 A4:1 | G4:1.5 A4:.5 F4:1 E4:1 | A4:4";
const SOUL3 = "Bb4:2 F5:2 | G5:1.5 F5:.5 E5:1 D5:1 | C#5:1.5 D5:.5 E5:1 A4:1 | D5:4";

// ===== タイトル「百の迷宮と魂の王」 =====
// ニ短調 68BPM。序奏 (一度だけ) → A: 金管が動機を提示 → B: 合唱と弦が全奏で歌い上げる
// → C: チェロの新しい旋律、ナポリの E♭ で翳り、弔鐘とともに沈んで A へ戻る
function title() {
  const s = new Score({ name: "title", bpm: 68, loop: [4, 28], gain: 0.94, fadeIn: 0.05, delay: { l: 0.75, r: 1, fb: 0.28, lp: 2200 } });
  s.ch("sub", { inst: "drone", vol: 0.2, lp: 380, rev: 0.15 })
    .ch("pad", { inst: "pad", vol: 0.28, lp: 1300, q: 0.9, lfo: { rate: 0.06, depth: 500 }, rev: 0.5 })
    .ch("chO", { inst: "choirO", vol: 0.45, rev: 0.65, pan: -0.12, human: 0.012 })
    .ch("chA", { inst: "choir", vol: 0.55, rev: 0.6, pan: 0.1, human: 0.01 })
    .ch("lo", { inst: "lowstr", vol: 0.45, rev: 0.35, pan: -0.2 })
    .ch("vc", { inst: "lowstr", vol: 0.55, rev: 0.5, pan: 0.12, human: 0.01 })
    .ch("sp", { inst: "spicc", vol: 0.7, rev: 0.18, pan: -0.15, poly: 6, human: 0.004 })
    .ch("str", { inst: "strings", vol: 0.6, rev: 0.45, pan: 0.22, human: 0.01 })
    .ch("hrn", { inst: "brass", vol: 0.55, rev: 0.4, pan: -0.05, human: 0.01 })
    .ch("org", { inst: "organ", vol: 0.28, rev: 0.7 })
    .ch("hp", { inst: "harp", vol: 0.45, rev: 0.45, dly: 0.18, pan: 0.35, cut: true, rel: 0.6 })
    .ch("tmp", { inst: "timp", vol: 0.6, rev: 0.3, pan: 0.1, human: 0.004 })
    .ch("tk", { inst: "taiko", vol: 0.55, rev: 0.25, human: 0.004 })
    .ch("boom", { inst: "boom", vol: 0.6, rev: 0.35 })
    .ch("cym", { inst: "swell", vol: 0.35, rev: 0.4 })
    .ch("crash", { inst: "crash", vol: 0.3, rev: 0.5 })
    .ch("gong", { inst: "tamtam", vol: 0.45, rev: 0.6 })
    .ch("bell", { inst: "bell", vol: 0.7, rev: 0.8, lp: 3500, pan: -0.3 });

  // -- 序奏 (0-3小節): 深淵の底で鐘が鳴り、合唱が目を覚ます
  s.at("boom", 0, 24, 4, 0.9); s.at("gong", 0, 36, 8, 0.6);
  s.at("sub", 0, "D1", 16.5, 0.8); s.at("sub", 0, "D2", 16.5, 0.45);
  s.at("bell", 0, "D3", 4, 0.7); s.at("bell", 2, "A2", 4, 0.5);
  s.n("chO", 2, "D3", 14, 0.5, { att: 3 }); s.n("chO", 2, "A3", 14, 0.45, { att: 3 });
  s.n("lo", 4, "D2", 12.5, 0.55, { att: 3 }); s.n("lo", 4, "A2", 12.5, 0.5, { att: 3 });
  s.chords("pad", 1, "Dm:4 Bb/D:4 A/D:4", { lo: 50, hi: 69, n: 4, v: 0.5 });
  s.n("str", 12, "C#5", 4.4, 0.45, { att: 2.5 }); s.n("str", 12, "E5", 4.4, 0.4, { att: 2.5 });
  s.roll("tmp", 12, 4, "D2", 0.15, 0.7, 6);
  s.swell("cym", 16, 0.7);

  // -- A (4-11): 刻む低弦の上で、金管が魂の動機を告げる
  const progA = "Dm:4 Bb:2 Gm:2 A7sus4:3 A7:1 Dm:4 F:4 Bb:2 Gm:2 Gm:2 Csus4:1 C:1 A:4";
  s.chords("pad", 4, progA, { lo: 50, hi: 69, n: 4, v: 0.45 });
  s.chords("chO", 4, progA, { lo: 50, hi: 65, n: 3, v: 0.32 });
  ost(s, "sp", 4, progA, { v: 0.62 });
  roots(s, "lo", 4, progA, 36, 0.45);
  s.line("hrn", 4, SOUL1, { v: 0.62, legato: 0.06 });
  s.line("hrn", 8, SOUL2, { v: 0.7, legato: 0.06 });
  roots(s, "tmp", 4, progA, 36, 0.55, { d: 1, every: 2, ev2: 0.6 });
  s.at("sub", 4, "D1", 32.5, 0.55);
  s.at("bell", 4, "D3", 4, 0.4);
  s.arp("hp", 8, "F:4 Bb:2 Gm:2 Gm:2 Csus4:1 C:1 A:4", { lo: 53, hi: 81, step: 0.5, pat: [0, 1, 2, 3, 4, 3, 2, 1], v: 0.35 });

  // -- B (12-19): 全奏。合唱と弦が動機を歌い、太鼓とオルガンが支える
  const progB = "Dm:4 Bb:2 Gm:2 A7sus4:3 A7:1 Dm:4 Bb:4 Gm:2 C:2 A7:4 Dm:4";
  s.swell("cym", s.B(12), 0.75); s.swell("cym", s.B(16), 0.75);
  s.at("boom", 12, 24, 4, 0.8); s.at("crash", 12, 60, 4, 0.7); s.at("crash", 16, 60, 4, 0.6);
  s.line("str", 12, SOUL1, { tr: 12, v: 0.68, legato: 0.08 });
  s.line("chA", 12, SOUL1, { v: 0.58, legato: 0.1 });
  s.line("str", 16, SOUL3, { v: 0.75, legato: 0.08 });
  s.line("chA", 16, SOUL3, { tr: -12, v: 0.62, legato: 0.1 });
  stabs(s, "hrn", 12, progB, [[0, 1.8, 1], [2, 1.8, 0.85]], { lo: 50, hi: 65, n: 3, v: 0.6 });
  s.chords("org", 12, progB, { lo: 50, hi: 72, n: 4, v: 0.42 });
  roots(s, "org", 12, progB, 36, 0.45);
  s.chords("pad", 12, progB, { lo: 50, hi: 69, n: 4, v: 0.4 });
  ost(s, "sp", 12, progB, { v: 0.75 });
  roots(s, "lo", 12, progB, 36, 0.55, { oct: 0.6 });
  s.drum("tk", 12, 8, ["X...x.x.X..x.x..", "X...x.x.X..x.x..", "X...x.x.X..x.x..", "X.x.X.x.XxXxXXXX"], { v: 0.8 });
  roots(s, "tmp", 12, progB, 36, 0.65, { d: 1, every: 1, ev2: 0.5 });

  // -- C (20-27): 翳りの間奏。チェロが新しい旋律を歌い、ナポリの E♭ で闇が深まる
  const progC = "Bb:4 F/A:4 Gm:4 Dm/F:4 Eb:4 A7:4 Dm:4 Dm:4";
  s.line("vc", 20, "F4:3 D4:1 | C4:2 A3:2 | Bb3:1.5 A3:.5 G3:1 Bb3:1 | A3:4 | G3:2 Bb3:1.5 Eb4:.5 | C#4:2 E4:1 G4:1 | F4:3 E4:1 | D4:4", { v: 0.62, legato: 0.1 });
  s.chords("pad", 20, progC, { lo: 50, hi: 69, n: 4, v: 0.4 });
  s.chords("chO", 20, progC, { lo: 50, hi: 65, n: 3, v: 0.3 });
  s.chords("org", 20, "Bb:4 F/A:4 Gm:4 Dm/F:4 Eb:4 A7:4", { lo: 55, hi: 74, n: 3, v: 0.28 });
  s.arp("hp", 20, "Bb:4 F/A:4 Gm:4 Dm/F:4", { lo: 46, hi: 77, step: 0.5, pat: [0, 1, 2, 3, 4, 3, 2, 1], v: 0.33 });
  roots(s, "lo", 20, "Bb:4 F/A:4 Gm:4 Dm/F:4 Eb:4 A7:4", 36, 0.42);
  s.chords("hrn", 24, "Eb:4 A7:4", { lo: 51, hi: 64, n: 4, v: 0.62, o: { att: 0.8 } });
  s.at("gong", 24, 36, 8, 0.5); s.at("boom", 24, 24, 4, 0.45);
  s.roll("tmp", s.B(25), 4, "A1", 0.15, 0.6, 6);
  s.at("tmp", 26, "D2", 1, 0.6);
  s.at("sub", 26, "D1", 8.6, 0.6); s.at("sub", 26, "D2", 8.6, 0.35);
  s.at("bell", 26, "D3", 4, 0.5); s.n("bell", s.B(27) + 2, "A2", 4, 0.35);
  s.n("chO", s.B(26), "D3", 8, 0.4); s.n("chO", s.B(26), "A3", 8, 0.36); s.n("chO", s.B(26), "F4", 7, 0.3);
  s.chords("pad", 26, "Dm:8", { lo: 50, hi: 65, n: 3, v: 0.32 });
  return s;
}

// ===== オープニング (語り): 悲しみから戦慄へ =====
// イ短調 60BPM。ピアノが動機を弔うように奏で、合唱が昇り、やがて不協和の弦と鼓動に呑まれる
function opening() {
  const s = new Score({ name: "opening", bpm: 60, loop: [4, 28], gain: 1.72, fadeIn: 0.8, delay: { l: 0.75, r: 1.0, fb: 0.32, lp: 2000 } });
  s.ch("wind", { inst: "wind", vol: 0.22, bp: 500, bpq: 0.7, lfo: { rate: 0.05, depth: 250 }, rev: 0.4 })
    .ch("sub", { inst: "drone", vol: 0.2, lp: 380, rev: 0.2 })
    .ch("pn", { inst: "piano", vol: 0.8, rev: 0.6, dly: 0.12, human: 0.012, cut: true, rel: 0.7 })
    .ch("str", { inst: "strings", vol: 0.38, rev: 0.6, att: 1.4, rel: 1.6, pan: 0.15 })
    .ch("cl", { inst: "strings", vol: 0.32, rev: 0.7, att: 3.5, rel: 3, pan: -0.3 })
    .ch("lo", { inst: "lowstr", vol: 0.5, rev: 0.5, att: 1.2, rel: 1.5, pan: -0.15 })
    .ch("sp", { inst: "spicc", vol: 0.42, rev: 0.35 })
    .ch("chO", { inst: "choirO", vol: 0.5, rev: 0.7, pan: -0.1 })
    .ch("chA", { inst: "choir", vol: 0.48, rev: 0.7, pan: 0.1, human: 0.012 })
    .ch("hrn", { inst: "brass", vol: 0.45, rev: 0.5, att: 1.5 })
    .ch("tmp", { inst: "timp", vol: 0.5, rev: 0.45 })
    .ch("heart", { inst: "heart", vol: 0.55, rev: 0.3 })
    .ch("br", { inst: "breath", vol: 0.35, rev: 0.75, pan: 0.4 })
    .ch("bell", { inst: "bell", vol: 0.7, rev: 0.85, lp: 2600, pan: -0.25 })
    .ch("boom", { inst: "boom", vol: 0.55, rev: 0.4 })
    .ch("gong", { inst: "tamtam", vol: 0.42, rev: 0.6 });

  // -- 序奏: 風と弔鐘
  s.at("wind", 0, 60, 17, 0.7);
  s.at("sub", 0, "A1", 16.5, 0.7);
  s.at("bell", 0, "A2", 4, 0.55); s.at("bell", 2, "E3", 4, 0.4);
  s.chords("str", 2, "Am:8", { lo: 52, hi: 72, n: 3, v: 0.38 });
  s.n("pn", 14, "E5", 2, 0.35);
  // 風は8小節ごとに重ねて途切れさせない
  for (const b of [4, 12, 20]) s.at("wind", b, 60, 34, 0.65);

  // -- 悲しみ (4-11): ピアノが魂の動機を弔う
  const p1 = "Am:4 F:4 Dm:2 E7sus4:1 E7:1 Am:4 C:4 F:4 Dm:2 E:2 E:4";
  s.line("pn", 4, "A4:2 E5:2 | F5:1.5 E5:.5 D5:1 C5:1 | B4:1.5 C5:.5 A4:1 G#4:1 | A4:4 | C5:2 G5:2 | A5:1.5 G5:.5 F5:1 E5:1 | D5:1.5 E5:.5 C5:1 B4:1 | E5:3", { v: 0.55 });
  roots(s, "pn", 4, p1, 33, 0.3, { legato: 0 });
  s.chords("str", 4, p1, { lo: 52, hi: 71, n: 4, v: 0.36 });
  roots(s, "lo", 4, p1, 36, 0.38);
  s.chords("chO", 8, "C:4 F:4 Dm:2 E:2 E:4", { lo: 50, hi: 65, n: 3, v: 0.28 });

  // -- 戦慄が昇る (12-19): 合唱が長い音で動機をなぞり、和声がナポリの B♭ へ翳る
  const p2 = "Am:4 Bb:4 Dm/F:4 E:4 Am/C:4 Bb:4 F#dim:4 E:4";
  s.line("chA", 12, "A4:4 | Bb4:4 | A4:2 F4:2 | E4:4 | E4:2 A4:2 | Bb4:2 D5:2 | C5:2 A4:2 | G#4:4", { v: 0.5, legato: 0.15 });
  s.chords("str", 12, p2, { lo: 52, hi: 72, n: 4, v: (b) => 0.34 + (b - 48) * 0.006 });
  roots(s, "lo", 12, p2, 33, 0.45, { oct: 0.5 });
  ost(s, "sp", 12, p2, { lo: 33, step: 1, pat: [0, 0, 0, 0], v: 0.45, acc: (i) => (i % 4 === 0 ? 1 : 0.6) });
  for (let b = 12; b < 20; b++) s.at("tmp", b, "A1", 1, 0.3 + (b - 12) * 0.04);
  s.roll("tmp", s.B(19), 4, "A1", 0.2, 0.7, 6);
  s.n("pn", s.B(14), "D6", 2, 0.25); s.n("pn", s.B(16) + 2, "C6", 2, 0.22); s.n("pn", s.B(18), "Eb6", 3, 0.25);

  // -- 戦慄 (20-27): 不協和の弦、鼓動、死者の吐息。やがて静まり、ピアノの幻が戻る
  s.at("boom", 20, 24, 4, 0.75); s.at("gong", 20, 36, 8, 0.6);
  s.at("sub", 20, "A1", 32.5, 0.65);
  s.n("hrn", s.B(20), "A1", 15, 0.5); s.n("hrn", s.B(20), "E2", 15, 0.35);
  s.n("cl", s.B(20), "A4", 9, 0.42); s.n("cl", s.B(20), "Bb4", 9, 0.4);
  s.n("lo", s.B(22), "A2", 8, 0.45, { att: 3 }); s.n("lo", s.B(22), "D#3", 8, 0.42, { att: 3 });
  s.n("chA", s.B(24), "E5", 7, 0.4, { att: 3 }); s.n("chA", s.B(24), "F5", 7, 0.38, { att: 3 });
  s.n("cl", s.B(24), "Bb3", 8, 0.35); s.n("cl", s.B(24), "E4", 8, 0.33);
  for (let b = 20; b < 26; b++) s.at("heart", b, 30, 1, 0.75 - (b - 20) * 0.06);
  s.n("br", s.B(21), 60, 3, 0.5); s.n("br", s.B(23) + 2, 60, 3, 0.45); s.n("br", s.B(25), 60, 3, 0.4);
  s.at("bell", 20, "A2", 4, 0.5); s.at("bell", 24, "Bb2", 4, 0.42);
  s.chords("chO", 26, "Am:8", { lo: 45, hi: 60, n: 3, v: 0.3 });
  s.n("pn", s.B(26), "A4", 2, 0.22); s.n("pn", s.B(26) + 2, "E5", 2, 0.2); s.n("pn", s.B(27), "F5", 3, 0.18);
  return s;
}

// ===== 街「ロアダル」の夜 =====
// ニ短調 3/4 76BPM。竪琴の分散和音と弦が魂の動機を三拍子で口ずさみ、
// 後半はヘ長調のぬくもりへ — フィドルが歌い、E♭ の翳りを経て戻る
function town() {
  const s = new Score({ name: "town", bpm: 76, bpb: 3, loop: [2, 34], gain: 1.64, fadeIn: 1.2, delay: { l: 1, r: 1.5, fb: 0.3, lp: 2400 } });
  s.ch("wind", { inst: "wind", vol: 0.22, bp: 650, bpq: 0.8, lfo: { rate: 0.04, depth: 300 }, rev: 0.3 })
    .ch("hp", { inst: "harp", vol: 0.38, rev: 0.45, dly: 0.14, pan: -0.25, human: 0.01, cut: true, rel: 0.6 })
    .ch("lute", { inst: "lute", vol: 0.4, rev: 0.35, pan: 0.28, human: 0.012, cut: true, rel: 0.4 })
    .ch("str", { inst: "strings", vol: 0.65, rev: 0.5, pan: 0.08, human: 0.012 })
    .ch("sec", { inst: "strings", vol: 0.3, rev: 0.55, att: 0.9, pan: -0.1 })
    .ch("fid", { inst: "fiddle", vol: 0.45, rev: 0.45, dly: 0.12, pan: 0.05, human: 0.012 })
    .ch("pad", { inst: "pad", vol: 0.3, lp: 1000, lfo: { rate: 0.05, depth: 300 }, rev: 0.5 })
    .ch("chO", { inst: "choirO", vol: 0.3, rev: 0.65 })
    .ch("lo", { inst: "lowstr", vol: 0.35, rev: 0.4 })
    .ch("pz", { inst: "pizz", vol: 0.5, rev: 0.3, pan: -0.05 })
    .ch("bell", { inst: "bell", vol: 0.8, rev: 0.9, lp: 2200, pan: 0.45 });

  const harpPat = [0, 2, 3, 4, 3, 2];
  // 序奏
  s.arp("hp", 0, "Dm:6", { lo: 43, hi: 79, step: 0.5, pat: harpPat, v: 0.4 });
  s.at("bell", 0, "D4", 3, 0.35);
  s.at("wind", 0, 60, 20, 0.6);
  for (const b of [6, 12, 18, 24, 30]) s.at("wind", b, 60, 21, 0.6);

  // -- A (2-17): 魂の動機を三拍子で
  const pA = "Dm:3 Gm:3 Dm:3 F:3 Gm:3 C:3 A7:3 Dm:3 Bb:3 Gm:3 F:3 F:3 Gm:3 Dm:3 A7:3 Dm:3";
  s.arp("hp", 2, pA, { lo: 43, hi: 79, step: 0.5, pat: harpPat, v: 0.38, acc: 6 });
  s.line("str", 2, "D4:2 A4:1 | Bb4:1.5 A4:.5 G4:1 | F4:2 G4:1 | A4:3 | Bb4:2 A4:1 | G4:1.5 F4:.5 E4:1 | E4:1.5 F4:.5 G4:1 | A4:3 |" +
    " D5:2 C5:1 | Bb4:1.5 A4:.5 G4:1 | A4:2 G4:1 | F4:3 | Bb4:1.5 A4:.5 G4:1 | F4:1 E4:1 D4:1 | E4:2 C#4:1 | D4:3", { v: 0.5, legato: 0.1 });
  roots(s, "pz", 2, pA, 38, 0.5, { legato: 0 });
  s.chords("pad", 2, pA, { lo: 50, hi: 65, n: 3, v: 0.4 });
  s.at("bell", 10, "A3", 3, 0.28);

  // -- B (18-33): ヘ長調のぬくもり。フィドルが歌い、リュートが爪弾く
  const pB = "F:3 C/E:3 Dm:3 Bb:3 Gm:3 C:3 F:3 A7:3 Dm:3 Bb:3 F/A:3 Gm:3 Eb:3 Bb/D:3 A:3 A7:3";
  s.arp("lute", 18, pB, { lo: 45, hi: 72, step: 0.5, pat: [0, 1, 2, 3, 2, 1], v: 0.4, acc: 6 });
  s.line("fid", 18, "A4:2 C5:1 | G4:3 | F4:2 A4:1 | D5:3 | G4:2 Bb4:1 | E4:1.5 F4:.5 G4:1 | A4:3 | C#5:3 |" +
    " D5:2 A4:1 | F4:3 | C5:2 A4:1 | Bb4:1.5 A4:.5 G4:1 | G4:2 Eb4:1 | F4:2 D4:1 | E4:3 | C#4:2 E4:1", { v: 0.58, legato: 0.08 });
  s.chords("sec", 18, pB, { lo: 55, hi: 70, n: 3, v: 0.32 });
  s.chords("chO", 18, pB, { lo: 50, hi: 64, n: 3, v: 0.28 });
  roots(s, "lo", 18, pB, 38, 0.36);
  roots(s, "pz", 18, pB, 38, 0.42, { legato: 0 });
  s.at("bell", 18, "F3", 3, 0.3); s.at("bell", 26, "D4", 3, 0.26);
  return s;
}

// ===== 酒場「沈まぬ灯」: リュートと枠太鼓とフィドルの哀しい舞曲 =====
// イ短調 6/8 (付点4分=90)。拍=8分音符
function tavern() {
  const s = new Score({ name: "tavern", bpm: 270, bpb: 6, loop: [2, 50], gain: 1.67, fadeIn: 0.8, delay: { l: 3, r: 4.5, fb: 0.22, lp: 2600 } });
  s.ch("fid", { inst: "fiddle", vol: 0.5, rev: 0.3, dly: 0.08, pan: 0.12, human: 0.008 })
    .ch("lute", { inst: "lute", vol: 0.65, rev: 0.25, pan: -0.15, human: 0.008, cut: true, rel: 0.3 })
    .ch("acc", { inst: "lute", vol: 0.34, rev: 0.22, pan: -0.35, human: 0.006, cut: true, rel: 0.25 })
    .ch("drm", { inst: "frame", vol: 0.45, rev: 0.2, pan: 0.05, human: 0.005 })
    .ch("drs", { inst: "frameS", vol: 0.55, rev: 0.2, pan: 0.22, human: 0.005 })
    .ch("shk", { inst: "shaker", vol: 0.6, rev: 0.15, pan: 0.42, human: 0.004 })
    .ch("drone", { inst: "drone", vol: 0.12, lp: 650, rev: 0.3 })
    .ch("pz", { inst: "pizz", vol: 0.38, rev: 0.2 });

  // 伴奏: 1拍目に低音、2-3拍目に和音 (ウンパッパ)
  const oompah = (bar, str, v = 1) => {
    const base = s.B(bar);
    for (const p of prog(str)) {
      if (!p.c) continue;
      const R = above(p.c.bass, 40), F = above(p.c.pcs[2] ?? p.c.pcs[1], 40);
      const ch = [above(p.c.pcs[1], 52), above(p.c.pcs[2] ?? p.c.pcs[0], 55)];
      for (let k = 0; k < p.d; k += 3) {
        s.n("acc", base + p.at + k, k % 6 === 0 ? R : F, 1, 0.55 * v);
        for (const m of ch) { s.n("acc", base + p.at + k + 1, m, 1, 0.3 * v); s.n("acc", base + p.at + k + 2, m, 1, 0.26 * v); }
      }
    }
  };
  const drums = (bar, bars, busy = 1) => {
    s.drum("drm", bar, bars, ["X..x..", "X..X.x"], { v: 0.7 * busy });
    s.drum("drs", bar, bars, ["...X..", "..xX.x"], { v: 0.6 * busy });
    s.drum("shk", bar, bars, ["xoxxox"], { v: 0.5 * busy });
  };
  const tuneA = "A4:2 B4:1 C5:2 A4:1 | E5:2 D5:1 C5:2 B4:1 | A4:2 G4:1 E4:2 G4:1 | A4:2 C5:1 B4:2 G4:1 | A4:2 B4:1 C5:2 D5:1 | E5:2 F5:1 E5:2 D5:1 | C5:2 B4:1 A4:2 G#4:1 | A4:3 E4:3";
  const pA = "Am:6 Am:6 G:6 Am:3 G:3 Am:6 Am:3 Dm:3 F:3 E:3 Am:6";
  const tuneB = "C5:2 D5:1 E5:2 C5:1 | D5:2 C5:1 B4:2 G4:1 | C5:2 B4:1 A4:2 F4:1 | E4:3 E4:2 G#4:1 | A4:2 B4:1 C5:2 E5:1 | D5:2 C5:1 B4:2 D5:1 | C5:2 A4:1 B4:2 G#4:1 | A4:6";
  const pB = "C:6 G:6 F:6 E:6 Am:6 G:6 Am:3 E:3 Am:6";

  // 序奏
  oompah(0, "Am:6 E:6");
  s.drum("drm", 0, 2, ["X.....", "X..X.x"], { v: 0.6 });
  // 低い持続 (ハーディ・ガーディ風の空虚五度)
  for (let b = 0; b < 50; b += 8) { s.at("drone", b, "A2", 50, 0.6); s.at("drone", b, "E3", 50, 0.45); }

  // A, A' (2-17)
  s.line("fid", 2, tuneA, { v: 0.6 });
  s.line("fid", 10, tuneA, { v: 0.66 });
  s.line("lute", 10, dia(tuneA, -2, A_MINOR), { v: 0.38 });
  oompah(2, pA + " " + pA);
  drums(2, 16);
  // B, B' (18-33)
  s.line("fid", 18, tuneB, { v: 0.64 });
  s.line("fid", 26, tuneB, { v: 0.7 });
  s.line("lute", 26, tr(tuneB, -12), { v: 0.4 });
  oompah(18, pB + " " + pB);
  drums(18, 16, 1.05);
  // 間奏 (34-49): リュートが主題を静かに、フィドルは長い音で嘆く
  s.line("lute", 34, tuneA, { v: 0.45 });
  oompah(34, pA, 0.8);
  s.drum("drm", 34, 8, ["X.....", "X..x.."], { v: 0.5 });
  s.drum("shk", 34, 8, ["x..x.."], { v: 0.35 });
  s.line("fid", 42, "E5:6 | D5:6 | C5:6 | B4:3 G#4:3 | A4:6 | B4:6 | C5:3 B4:3 | A4:6", { v: 0.5, legato: 0.2 });
  oompah(42, pB, 0.85);
  drums(42, 7, 0.8);
  s.drum("drm", 49, 1, ["XxXxXX"], { v: 0.7 });
  roots(s, "pz", 42, pB, 33, 0.4, { legato: 0, d: 2 });
  return s;
}

// ===== 商店: 値踏みする目。チェンバロと低弦のピッツィカートが忍び歩く =====
// ト短調 96BPM。8小節の固執低音の上で変奏
function shop() {
  const s = new Score({ name: "shop", bpm: 96, loop: [0, 32], gain: 2.07, fadeIn: 0.8, delay: { l: 0.75, r: 1.5, fb: 0.25, lp: 2600 } });
  s.ch("hs", { inst: "harpsi", vol: 0.9, rev: 0.35, dly: 0.1, pan: -0.2, human: 0.008, cut: true, rel: 0.3 })
    .ch("hs2", { inst: "harpsi", vol: 0.75, rev: 0.4, pan: 0.15, human: 0.008, cut: true, rel: 0.3 })
    .ch("pz", { inst: "pizz", vol: 0.5, rev: 0.25, pan: 0.1, human: 0.006 })
    .ch("pad", { inst: "pad", vol: 0.22, lp: 900, lfo: { rate: 0.05, depth: 300 }, rev: 0.5 })
    .ch("cel", { inst: "celesta", vol: 0.8, rev: 0.55, dly: 0.2, pan: 0.3, human: 0.01 })
    .ch("lo", { inst: "lowstr", vol: 0.45, rev: 0.45 })
    .ch("shk", { inst: "shaker", vol: 0.3, rev: 0.2, pan: 0.35 });

  const P = "Gm:4 F:4 Eb:4 D:4 Gm:4 Bb/F:4 Cm:4 D7:4";
  const bass = "G2:1 D3:1 G2:1 Bb2:1 | F2:1 C3:1 F2:1 A2:1 | Eb2:1 Bb2:1 G2:1 Eb2:1 | D2:1 A2:1 F#2:1 D2:1 | G2:1 D3:1 Bb2:1 G2:1 | F2:1 Bb2:1 D3:1 F2:1 | C2:1 G2:1 Eb2:1 C2:1 | D2:1 F#2:1 A2:1 C3:1";
  const alberti = [0, 2, 1, 3, 2, 4, 3, 2];
  for (let k = 0; k < 4; k++) {
    const b = k * 8;
    s.line("pz", b, bass, { v: k === 0 ? 0.42 : 0.5 });
    s.chords("pad", b, P, { lo: 50, hi: 65, n: 3, v: 0.35 });
  }
  // A (0-7): 爪弾き
  s.arp("hs", 0, P, { lo: 55, hi: 79, step: 0.5, pat: alberti, v: 0.32 });
  // B (8-15): チェレスタの忍び足の旋律
  s.arp("hs", 8, P, { lo: 55, hi: 79, step: 0.5, pat: alberti, v: 0.26 });
  const mel = "D5:1.5 C5:.5 Bb4:1 A4:1 | C5:1.5 Bb4:.5 A4:1 F4:1 | G4:1 Bb4:1 Eb5:1.5 D5:.5 | F#4:4 | G4:1.5 A4:.5 Bb4:1 D5:1 | F5:1.5 Eb5:.5 D5:1 Bb4:1 | C5:1 Eb5:1 G4:1.5 A4:.5 | F#4:2 A4:2";
  s.line("cel", 8, mel, { tr: 12, v: 0.42 });
  s.drum("shk", 8, 8, ["..x...x...x...x."], { v: 0.4 });
  // C (16-23): 旋律がチェンバロへ、低弦が支える
  s.line("hs2", 16, mel, { v: 0.42 });
  s.arp("hs", 16, P, { lo: 50, hi: 67, step: 1, pat: [0, 2, 1, 2], v: 0.24 });
  roots(s, "lo", 16, P, 38, 0.32);
  // D (24-31): 静かに和音を置き、チェレスタが問いかけて戻る
  s.arp("hs", 24, P, { lo: 55, hi: 74, step: 2, pat: [0, 2], v: 0.28, dur: 2 });
  s.line("cel", 24, "r:2 D6:1 Bb5:1 | r:2 C6:1 A5:1 | r:2 Bb5:1 G5:1 | r:2 A5:2 | r:2 G5:1 D6:1 | r:2 F6:1 D6:1 | r:2 Eb6:1 C6:1 | r:2 F#5:1 A5:1", { v: 0.32 });
  return s;
}

// ===== 宿屋「白狼」: 消えかけの灯の下の子守唄 =====
// イ短調 3/4 66BPM。オルゴールと竪琴、三番目の句で弦が魂の動機を歌う
function inn() {
  const s = new Score({ name: "inn", bpm: 66, bpb: 3, loop: [0, 32], gain: 1.95, fadeIn: 1.5, delay: { l: 1, r: 1.5, fb: 0.3, lp: 2200 } });
  s.ch("hp", { inst: "harp", vol: 0.55, rev: 0.55, dly: 0.12, pan: -0.2, human: 0.012, cut: true, rel: 0.7 })
    .ch("mb", { inst: "musicbox", vol: 1.0, rev: 0.6, dly: 0.2, pan: 0.22, human: 0.008 })
    .ch("pad", { inst: "pad", vol: 0.2, lp: 800, lfo: { rate: 0.04, depth: 250 }, rev: 0.5 })
    .ch("str", { inst: "strings", vol: 0.6, rev: 0.6, att: 0.8, pan: 0.05, human: 0.012 })
    .ch("lo", { inst: "lowstr", vol: 0.35, rev: 0.5 })
    .ch("org", { inst: "organSoft", vol: 0.4, rev: 0.6 });
  const P1 = "Am:3 Am:3 G:3 Am:3 F:3 E:3 Dm:3 E:3";
  const P2 = "Am:3 C:3 Dm:3 Am:3 G:3 F:3 E:3 Am:3";
  const P3 = "Am:3 Dm:3 Am:3 Am:3 C:3 F:3 C:3 E:3";
  const M1 = "E5:1 C5:1 D5:1 | E5:2 A4:1 | B4:1 C5:1 D5:1 | C5:2 B4:1 | A4:1 B4:1 C5:1 | B4:2 E4:1 | F4:1 G4:1 A4:1 | G#4:3";
  const M2 = "E5:1 C5:1 D5:1 | E5:2 G5:1 | F5:1 E5:1 D5:1 | C5:2 E5:1 | D5:1 C5:1 B4:1 | A4:2 C5:1 | B4:1 A4:1 G#4:1 | A4:3";
  const all = [P1, P2, P3, P1].join(" ");
  s.arp("hp", 0, all, { lo: 45, hi: 72, step: 0.5, pat: [0, 1, 2, 3, 2, 1], v: 0.32, acc: 6 });
  roots(s, "lo", 0, all, 33, 0.3);
  s.chords("pad", 0, all, { lo: 50, hi: 64, n: 3, v: 0.32 });
  s.line("mb", 0, M1, { tr: 12, v: 0.45 });
  s.line("mb", 8, M2, { tr: 12, v: 0.45 });
  // 第3句: 弦が魂の動機 (イ短調・三拍子)、オルゴールは休む
  s.line("str", 16, "A4:2 E5:1 | F5:1.5 E5:.5 D5:1 | C5:2 B4:1 | A4:3 | C5:2 G5:1 | A5:1.5 G5:.5 F5:1 | E5:2 D5:1 | E5:3", { v: 0.48, legato: 0.12 });
  s.chords("org", 16, P3, { lo: 52, hi: 67, n: 3, v: 0.35 });
  // 第4句: 子守唄がもう一度、弦が低くなぞる
  s.line("mb", 24, M1, { tr: 12, v: 0.4 });
  s.line("str", 24, M1, { tr: -12, v: 0.3, legato: 0.1 });
  return s;
}

// ===== 王宮: 石廊に響く葬送の儀 — 金管とオルガンの荘厳なハ短調 =====
function palace() {
  const s = new Score({ name: "palace", bpm: 58, loop: [0, 20], gain: 2.02, fadeIn: 1.0, delay: null });
  s.ch("org", { inst: "organ", vol: 0.36, rev: 0.75 })
    .ch("ped", { inst: "organ", vol: 0.32, rev: 0.6, lp: 900 })
    .ch("brs", { inst: "brass", vol: 0.35, rev: 0.45, pan: -0.1, human: 0.012 })
    .ch("lo", { inst: "lowstr", vol: 0.45, rev: 0.45 })
    .ch("str", { inst: "strings", vol: 0.45, rev: 0.55, att: 1.0, pan: 0.15 })
    .ch("tmp", { inst: "timp", vol: 0.5, rev: 0.4, pan: 0.1 })
    .ch("chO", { inst: "choirO", vol: 0.5, rev: 0.7 })
    .ch("bell", { inst: "bell", vol: 0.6, rev: 0.85, lp: 3000, pan: -0.3 });
  const C1 = "Cm:2 Ab:2 Fm:2 G:2 Cm/Eb:2 Bb:2 Eb:2 G7:2 Ab:2 Fm:2 Db:2 G:2 Cm:2 Ab:2 G:4";
  // コラール (0-7): オルガン
  s.chords("org", 0, C1, { lo: 55, hi: 74, n: 4, v: 0.48 });
  roots(s, "ped", 0, C1, 36, 0.55);
  roots(s, "lo", 0, C1, 36, 0.32);
  // 金管コラール (8-11)
  const C2 = "Cm:2 Ab:2 Fm:2 G:2 Cm/Eb:2 Bb:2 Eb:2 G7:2";
  s.chords("brs", 8, C2, { lo: 46, hi: 65, n: 4, v: 0.55, legato: 0.05 });
  s.chords("org", 8, C2, { lo: 55, hi: 74, n: 3, v: 0.3 });
  roots(s, "ped", 8, C2, 36, 0.5);
  for (let b = 8; b < 12; b++) s.at("tmp", b, "C2", 1, 0.4);
  // 魂の動機 (12-15): 金管、ハ短調で
  const C3 = "Cm:4 Ab:2 Fm:2 G7sus4:3 G7:1 Cm:4";
  s.line("brs", 12, "C4:2 G4:2 | Ab4:1.5 G4:.5 F4:1 Eb4:1 | D4:1.5 Eb4:.5 C4:1 B3:1 | C4:4", { v: 0.68, legato: 0.06 });
  s.chords("org", 12, C3, { lo: 52, hi: 70, n: 4, v: 0.36 });
  s.chords("str", 12, C3, { lo: 60, hi: 79, n: 3, v: 0.3 });
  roots(s, "ped", 12, C3, 36, 0.55);
  roots(s, "tmp", 12, C3, 36, 0.48, { d: 1, every: 2, ev2: 0.6 });
  // 終止 (16-19): ナポリの D♭ を経て半終止、次の巡りへ
  const C4 = "Ab:4 Fm:4 Db:4 G:4";
  s.chords("org", 16, C4, { lo: 55, hi: 74, n: 4, v: 0.42 });
  s.chords("chO", 16, C4, { lo: 50, hi: 65, n: 3, v: 0.3 });
  roots(s, "ped", 16, C4, 36, 0.55);
  roots(s, "lo", 16, C4, 36, 0.36);
  s.at("bell", 16, "C4", 3, 0.35);
  s.roll("tmp", s.B(19), 4, "G1", 0.15, 0.5, 6);
  return s;
}

// ===== 赤い魂の祠: 異形の聖域。空虚五度の聖歌と、うなる鉢の響き =====
// ニ調フリギア 50BPM
function shrine() {
  const s = new Score({ name: "shrine", bpm: 50, loop: [0, 16], gain: 1.36, fadeIn: 1.5, delay: { l: 1, r: 1.5, fb: 0.35, lp: 2000 } });
  s.ch("drone", { inst: "drone", vol: 0.2, lp: 500, rev: 0.35 })
    .ch("chM", { inst: "choir", vol: 0.55, rev: 0.75, pan: -0.15, att: 0.9, human: 0.015 })
    .ch("chM5", { inst: "choir", vol: 0.45, rev: 0.75, pan: 0.15, att: 0.9, human: 0.015 })
    .ch("chF", { inst: "choirO", vol: 0.55, rev: 0.85, pan: 0.25, att: 4, rel: 4 })
    .ch("bowl", { inst: "bowl", vol: 0.7, rev: 0.8, dly: 0.2 })
    .ch("org", { inst: "organSoft", vol: 0.4, rev: 0.75 })
    .ch("br", { inst: "breath", vol: 0.6, rev: 0.8, pan: -0.35 })
    .ch("bell", { inst: "bell", vol: 0.6, rev: 0.9, lp: 2400 })
    .ch("cel", { inst: "celesta", vol: 0.6, rev: 0.75, dly: 0.25, pan: 0.3 });
  for (const b of [0, 8]) { s.at("drone", b, "D2", 33, 0.7); s.at("drone", b, "A2", 33, 0.45); s.at("drone", b, "D1", 33, 0.3); }
  const chant = "D3:2 Eb3:1 D3:1 | C3:2 D3:2 | F3:2 G3:1 F3:1 | Eb3:4 | D3:2 F3:1 G3:1 | A3:2 G3:1 F3:1 | Eb3:2 F3:1 Eb3:1 | D3:4";
  for (const b of [0, 8]) {
    s.line("chM", b, chant, { v: 0.5, legato: 0.15 });
    s.line("chM5", b, chant, { tr: 7, v: 0.42, legato: 0.15 });
  }
  s.line("org", 8, chant, { tr: 17, v: 0.4, legato: 0.1 });
  s.n("chF", s.B(8), "A4", 15, 0.38); s.n("chF", s.B(8), "Bb4", 15, 0.34);
  s.n("chF", s.B(12), "D5", 15, 0.3); s.n("chF", s.B(12), "Eb5", 15, 0.28);
  const bowls = [[0, "D5", 0.5], [2.5, "A4", 0.4], [4, "Eb5", 0.42], [6.25, "A5", 0.38], [9, "D5", 0.45], [11.5, "G5", 0.36], [13, "Eb5", 0.4], [15, "A4", 0.35]];
  for (const [b, m, v] of bowls) s.n("bowl", s.B(b), m, 4, v);
  s.n("br", s.B(3), 60, 3, 0.45); s.n("br", s.B(10) + 2, 60, 3, 0.4);
  s.at("bell", 0, "D3", 4, 0.35); s.at("bell", 8, "A2", 4, 0.3);
  s.line("cel", 8, "D5:4 | A5:4 | Bb5:3 A5:1 | G5:4", { v: 0.3 });
  return s;
}

// ===== 人業の館: 人形の工房。ゆがんだオルゴールのワルツと、きしむ弦 =====
// ホ短調 3/4 84BPM。後半、オルゴールは巻きが切れていき、弦が魂の動機を不穏になぞる
function mansion() {
  const s = new Score({ name: "mansion", bpm: 84, bpb: 3, loop: [0, 32], gain: 2.6, fadeIn: 1.0, delay: { l: 1, r: 1.5, fb: 0.3, lp: 2400 } });
  s.ch("mb", { inst: "musicbox", vol: 0.85, rev: 0.55, dly: 0.15, wow: 18, pan: 0.15, human: 0.01 })
    .ch("mb2", { inst: "musicbox", vol: 0.45, rev: 0.5, wow: 26, pan: -0.2, human: 0.012 })
    .ch("str", { inst: "strings", vol: 0.6, rev: 0.6, att: 0.8, rel: 1.4, human: 0.012 })
    .ch("cl", { inst: "strings", vol: 0.5, rev: 0.7, att: 3, rel: 3, pan: -0.25 })
    .ch("lo", { inst: "lowstr", vol: 0.5, rev: 0.45, att: 2 })
    .ch("pz", { inst: "pizz", vol: 0.3, rev: 0.3 })
    .ch("cel", { inst: "celesta", vol: 0.45, rev: 0.7, wow: 30, pan: 0.35 })
    .ch("creak", { inst: "creak", vol: 0.6, rev: 0.6, pan: -0.4 })
    .ch("pad", { inst: "pad", vol: 0.2, lp: 700, rev: 0.5 });
  const W1 = "B5:1 E6:1 G6:1 | F#6:2 E6:1 | D#6:1 E6:1 F#6:1 | B5:3 | C6:1 B5:1 A5:1 | G5:2 E5:1 | F5:1 E5:1 D#5:1 | E5:3";
  const P1 = "Em:3 B7:3 B7:3 Em:3 Am:3 Em:3 B7:3 Em:3";
  const W2 = "B5:1 E6:1 G6:1 | B6:2 A6:1 | G6:1 F#6:1 E6:1 | D#6:3 | E6:1 C6:1 A5:1 | F#5:2 D#5:1 | E5:1 F5:1 G5:1 | E5:3";
  const P2 = "Em:3 G:3 Em:3 B:3 Am:3 B7:3 C:3 Em:3";
  // ワルツ伴奏: 1拍目ピッツィカート、2-3拍目にオルゴールの和音
  const waltz = (bar, str, v = 1) => {
    const base = s.B(bar);
    for (const p of prog(str)) {
      s.n("pz", base + p.at, above(p.c.bass, 40), 1, 0.5 * v);
      const a = above(p.c.pcs[1], 64), b = above(p.c.pcs[2] ?? p.c.pcs[0], a + 1);
      for (const k of [1, 2]) { s.n("mb2", base + p.at + k, a, 1, 0.3 * v); s.n("mb2", base + p.at + k, b, 1, 0.26 * v); }
    }
  };
  s.line("mb", 0, W1, { v: 0.5 }); waltz(0, P1);
  s.line("mb", 8, W2, { v: 0.5 }); waltz(8, P2);
  s.chords("pad", 0, P1 + " " + P2, { lo: 50, hi: 62, n: 3, v: 0.35 });
  // 16-23: もう一度ワルツ、弦が魂の動機 (ホ短調) を下でなぞる
  s.line("mb", 16, W1, { v: 0.42 }); waltz(16, P1, 0.85);
  s.line("str", 16, "E4:2 B4:1 | C5:1.5 B4:.5 A4:1 | G4:1.5 A4:.5 F#4:1 | E4:3 | E4:2 B4:1 | C5:1.5 B4:.5 A4:1 | G4:1 F4:1 D#4:1 | E4:3", { v: 0.45, legato: 0.12 });
  roots(s, "lo", 16, P1, 28, 0.3);
  // 24-31: 巻きが切れていく。音はまばらに、弦は不協和にきしむ
  const sparse = [[24, "B5", 0.4], [25, "F#6", 0.34], [26, "D#6", 0.3], [27.34, "B5", 0.26], [28.67, "C6", 0.22], [30, "F5", 0.18]];
  for (const [b, m, v] of sparse) s.n("mb", s.B(b), m, 1, v);
  s.n("cl", s.B(24), "E4", 6.5, 0.4); s.n("cl", s.B(24), "F4", 6.5, 0.38);
  s.n("cl", s.B(26), "A#3", 6.5, 0.36); s.n("cl", s.B(26), "E4", 6.5, 0.34);
  s.n("cl", s.B(28), "D#4", 6.5, 0.34); s.n("cl", s.B(28), "E4", 6.5, 0.32);
  s.n("lo", s.B(30), "E2", 6.5, 0.36); s.n("lo", s.B(30), "B2", 6.5, 0.3);
  s.n("creak", s.B(25) + 1, 60, 2, 0.5); s.n("creak", s.B(29), 60, 2, 0.45); s.n("creak", s.B(31) + 1.5, 60, 2, 0.35);
  s.n("cel", s.B(27), "F6", 2, 0.35); s.n("cel", s.B(30), "E6", 2, 0.3);
  return s;
}

// ===== 迷宮 第1層「忘れられた地下墓地」: 墓所の空気そのものを鳴らす =====
// イ調フリギア 60BPM・32小節 (約2分) の長い呼吸。ドローン、死者の吐息、遠い弔鐘、
// きしみと鎖、不協和にふくらむ弦、そしてピアノが魂の動機の亡霊を一度だけ
function layer1() {
  const s = new Score({ name: "layer1", bpm: 60, loop: [0, 32], gain: 1.29, fadeIn: 2.0, delay: { l: 1.5, r: 2.25, fb: 0.38, lp: 1800 } });
  s.ch("drone", { inst: "drone", vol: 0.25, lp: 650, rev: 0.35 })
    .ch("dr2", { inst: "pad", vol: 0.22, lp: 600, q: 1.2, lfo: { rate: 0.045, depth: 280 }, rev: 0.5 })
    .ch("wind", { inst: "wind", vol: 0.3, bp: 420, bpq: 0.8, lfo: { rate: 0.06, depth: 220 }, rev: 0.45 })
    .ch("chO", { inst: "choirO", vol: 0.5, rev: 0.85, att: 4, rel: 4 })
    .ch("br1", { inst: "breath", vol: 0.7, rev: 0.8, pan: -0.55 })
    .ch("br2", { inst: "breath", vol: 0.7, rev: 0.8, pan: 0.55 })
    .ch("bell", { inst: "bell", vol: 0.8, rev: 0.95, lp: 1600, pan: -0.15 })
    .ch("creak", { inst: "creak", vol: 0.7, rev: 0.75, pan: -0.45 })
    .ch("chain", { inst: "chain", vol: 0.7, rev: 0.8, pan: 0.5 })
    .ch("drip", { inst: "drip", vol: 0.5, rev: 0.85, dly: 0.3, pan: 0.25 })
    .ch("str", { inst: "strings", vol: 0.45, rev: 0.75, att: 4, rel: 4, pan: 0.2 })
    .ch("lo", { inst: "lowstr", vol: 0.32, rev: 0.6, att: 3, rel: 3, pan: -0.2 })
    .ch("pn", { inst: "piano", vol: 0.6, rev: 0.9, dly: 0.25, lp: 2600, pan: 0.1, cut: true, rel: 1.2 })
    .ch("tmp", { inst: "timp", vol: 0.42, rev: 0.65, lp: 900 });
  // ドローン: A → F → A → B♭(フリギアの戦慄) → A → G → A
  const dr = [[0, "A1", "E2", 8], [8, "F1", "C2", 4], [12, "A1", "E2", 4], [16, "Bb1", "F2", 4], [20, "A1", "E2", 4], [24, "G1", "D2", 4], [28, "A1", "E2", 4]];
  for (const [b, r, f, len] of dr) { s.n("drone", s.B(b), r, len * 4 + 1.5, 0.7); s.n("drone", s.B(b), f, len * 4 + 1.5, 0.5); }
  const dr2 = [[0, "A2+C3+E3", 8], [8, "F2+A2+C3", 4], [12, "A2+C3+E3", 4], [16, "Bb2+D3+F3", 4], [20, "A2+C3+E3", 4], [24, "G2+Bb2+D3", 4], [28, "A2+C3+E3", 4]];
  for (const [b, ns, len] of dr2) for (const m of ns.split("+")) s.n("dr2", s.B(b), m, len * 4 + 1.5, 0.45);
  for (const b of [0, 8, 16, 24]) s.at("wind", b, 60, 36, 0.7);
  // 弔鐘
  s.at("bell", 0, "A2", 4, 0.5); s.n("bell", s.B(9) + 2, "E3", 4, 0.35); s.at("bell", 17, "A2", 4, 0.45); s.n("bell", s.B(26) + 1, "Bb2", 4, 0.36);
  // 合唱のうなり
  s.n("chO", s.B(4), "A2", 14, 0.42); s.n("chO", s.B(4), "E3", 14, 0.38);
  for (const m of ["A3", "C4", "E4"]) s.n("chO", s.B(12), m, 14, 0.33);
  for (const m of ["Bb3", "D4", "F4"]) s.n("chO", s.B(20), m, 14, 0.34);
  for (const m of ["A3", "E4"]) s.n("chO", s.B(28), m, 14, 0.3);
  // 吐息・きしみ・鎖・雫
  for (const [b, ch] of [[2.5, "br1"], [10, "br2"], [14.75, "br1"], [21.5, "br2"], [27, "br1"], [30.5, "br2"]]) s.n(ch, s.B(b), 60, 3, 0.5);
  for (const b of [3.25, 13.5, 23, 29.75]) s.n("creak", s.B(b), 60, 2, 0.5);
  for (const b of [7, 18.5, 25.5]) s.n("chain", s.B(b), 60, 2, 0.45);
  for (const b of [1.3, 5.7, 11.2, 15.6, 19.9, 24.4, 28.1, 31.2]) s.n("drip", s.B(b), 72, 1, 0.45);
  // 不協和の弦 (ふくらんで消える)
  for (const [b, ns, v] of [[6, "A4+Bb4", 0.4], [14, "E5+F5", 0.3], [22, "Eb4+A4", 0.36], [30, "A4+Bb4", 0.3]]) for (const m of ns.split("+")) s.n("str", s.B(b), m, 10, v);
  for (const [b, ns] of [[10, "A2+Bb2"], [26, "E2+F2"]]) for (const m of ns.split("+")) s.n("lo", s.B(b), m, 8, 0.38);
  // 魂の動機の亡霊 (ピアノ)
  s.line("pn", 12, "A4:2 E5:2 | F5:4", { v: 0.26 });
  s.line("pn", 24, "A4:2 E5:2 | F5:1.5 E5:.5 D5:1 C5:1 | Bb4:1.5 C5:.5 A4:1 G4:1 | A4:4", { v: 0.3 });
  // 遠い地響き
  s.n("tmp", s.B(16), "A1", 1, 0.45); s.n("tmp", s.B(16) + 0.5, "A1", 1, 0.32); s.n("tmp", s.B(31), "A1", 1, 0.35);
  return s;
}

// ===== 戦闘: 太鼓とスピッカートの疾走、金管の咆哮 =====
// イ短調 (フリギアの B♭)。A: 刻み / B: 弦が動機を縮小形で / C: 合唱と金管の雄叫び / D: 崩落と再起 / E: 全奏
function battleSong(name, t = 0, bpm = 150, heavy = 0) {
  const s = new Score({ name, bpm, loop: [2, 42], gain: 0.84, fadeIn: 0.05, delay: { l: 0.75, r: 1.5, fb: 0.2, lp: 2400 } });
  s.ch("tk", { inst: "taiko", vol: 0.3, rev: 0.18, human: 0.003 })
    .ch("tkS", { inst: "taikoS", vol: 0.42, rev: 0.14, pan: 0.25, human: 0.003 })
    .ch("tmp", { inst: "timp", vol: 0.5, rev: 0.2, pan: -0.2, human: 0.003 })
    .ch("sp", { inst: "spicc", vol: 0.55, rev: 0.12, pan: -0.15, poly: 6, human: 0.003, cut: true, rel: 0.14 })
    .ch("sp2", { inst: "spicc", vol: 0.45, rev: 0.16, pan: 0.22, poly: 6, human: 0.003, cut: true, rel: 0.12 })
    .ch("lo", { inst: "lowstr", vol: 0.5, rev: 0.2 })
    .ch("str", { inst: "strings", vol: 0.65, rev: 0.3, att: 0.06, rel: 0.4, pan: 0.18, human: 0.006 })
    .ch("hrn", { inst: "brass", vol: 0.55, rev: 0.25, pan: -0.08, human: 0.006 })
    .ch("chA", { inst: "choir", vol: 0.58, rev: 0.4, att: 0.3, human: 0.008 })
    .ch("crash", { inst: "crash", vol: 0.5, rev: 0.35 })
    .ch("cym", { inst: "swell", vol: 0.3, rev: 0.3 })
    .ch("boom", { inst: "boom", vol: 0.4, rev: 0.3 })
    .ch("pad", { inst: "pad", vol: 0.16, lp: 1200, rev: 0.4 })
    .ch("org", { inst: "organ", vol: heavy ? 0.24 : 0, rev: 0.55 });
  // 和音進行を移調する
  const tp = (str) => t ? str.split(/\s+/).map((tok) => {
    if (!tok || tok === "|" || tok.startsWith("-")) return tok;
    const [c, d] = tok.split(":");
    const sh = (x) => { const mm = /^([A-G][#b]?)(.*)$/.exec(x); return nameOf(nm(mm[1] + "4") + t).replace(/-?\d+$/, "") + mm[2]; };
    return c.split("/").map(sh).join("/") + (d ? ":" + d : "");
  }).join(" ") : str;
  const tm = (str) => (t ? tr(str, t) : str);
  const R = (m) => nm(m) + t;
  // 刻み (A1 を軸に、B♭・C がかみつくフリギアのギャロップ)
  const ostA = [0, 0, 12, 0, 0, 0, 13, 0, 0, 0, 12, 0, 15, 0, 13, 0];
  const ostE = [0, 0, 12, 0, 0, 0, 13, 0, 0, 0, 12, 0, 16, 0, 13, 0]; // 属和音: 長3度 (フリギア属)
  const gallop = (bar, bars, root, v = 0.7, pat = ostA) => {
    for (let b = 0; b < bars; b++) for (let i = 0; i < 16; i++) {
      const off = pat[i];
      const acc = i === 0 ? 1 : i % 4 === 0 ? 0.82 : off ? 0.78 : 0.55;
      s.n("sp", s.B(bar + b) + i * 0.25, root + off, 0.25, v * acc);
    }
  };
  // -- 序奏
  s.at("boom", 0, 24, 4, 0.9); s.at("crash", 0, 60, 4, 0.7);
  for (const m of ["A2", "E3", "A3", "C4"]) s.at("hrn", 0, R(m), 1, 0.9);
  s.drum("tk", 0, 2, ["X.......X...X.X.", "X.X.X.X.XXXXXXXX"], { v: 0.85 });
  s.roll("tmp", s.B(1), 4, R("A1"), 0.3, 0.85, 8);
  s.swell("cym", s.B(2), 0.75);
  // -- A (2-9)
  const pA = tp("Am:4 Am:4 Am:4 Am:4 Bb:4 Bb:4 Am:4 E:4");
  gallop(2, 6, R("A1")); gallop(8, 1, R("A1")); gallop(9, 1, R("E1"), 0.7, ostE);
  s.drum("tk", 2, 8, ["X..x..x.X...x.x.", "X..x..x.X..xX.xx"], { v: 0.8 });
  s.drum("tkS", 2, 8, ["....X.......X..o"], { v: 0.7 });
  roots(s, "tmp", 2, pA, 33, 0.55, { d: 1 });
  roots(s, "lo", 2, pA, 33, 0.42);
  stabs(s, "hrn", 4, tp("Am:4 Am:4 Bb:4 Bb:4 Am:4 E:4"), [[0, 0.5, 1], [1.5, 0.5, 0.75], [3, 1, 0.9]], { lo: 50 + t, hi: 66 + t, n: 3, v: 0.75 });
  if (heavy) s.chords("chA", 2, pA, { lo: 50 + t, hi: 66 + t, n: 3, v: 0.4, art: 0.5 });
  // -- B (10-17): 弦が魂の動機を縮小形で
  const pB = tp("Am:4 E:2 Am:2 C:2 F:2 Dm:2 E:2 Dm:4 Bb:4 Bb:4 E:4");
  s.swell("cym", s.B(10), 0.6); s.at("crash", 10, 60, 4, 0.6);
  const melB = "A4:1 E5:1 F5:.75 E5:.25 D5:.5 C5:.5 | B4:.75 C5:.25 A4:.5 G#4:.5 A4:2 | C5:1 G5:1 A5:.75 G5:.25 F5:.5 E5:.5 | D5:.75 E5:.25 C5:.5 B4:.5 E5:2 | F5:1.5 E5:.5 D5:1 C5:1 | Bb4:1.5 C5:.5 D5:1 E5:1 | F5:1 E5:1 D5:1 Bb4:1 | E5:2 G#5:2";
  s.line("str", 10, tm(melB), { v: 0.72, legato: 0.03 });
  ost(s, "sp", 10, pB, { lo: 33, step: 0.5, v: 0.7, pat: [0, 0, 12, 0, 7, 0, 12, 7] });
  s.chords("hrn", 10, pB, { lo: 50 + t, hi: 65 + t, n: 3, v: 0.48, art: 0.9 });
  roots(s, "lo", 10, pB, 33, 0.45);
  s.drum("tk", 10, 8, ["X..x..x.X...x.x.", "X..x..x.X..xX.xx", "X..x..x.X...x.x.", "X.x.X.x.XxXxXXXX"], { v: 0.82 });
  s.drum("tkS", 10, 8, ["..x.X..x..x.X.x."], { v: 0.6 });
  roots(s, "tmp", 10, pB, 33, 0.5, { d: 1, every: 2, ev2: 0.7 });
  // -- C (18-25): 合唱と金管が動機を拡大形で叫ぶ
  const pC = tp("Am:4 C:4 F:4 Dm:2 Am:2 E:4 Am:2 E:2 F:4 E:4");
  s.at("boom", 18, 24, 4, 0.8); s.at("crash", 18, 60, 4, 0.75); s.swell("cym", s.B(18), 0.7);
  const melC = "A4:4 | E5:4 | F5:3 E5:1 | D5:2 C5:2 | B4:3 C5:1 | A4:2 G#4:2 | A4:4 | E4:4";
  s.line("chA", 18, tm(melC), { v: 0.62, legato: 0.08 });
  s.line("hrn", 18, tr(tm(melC), -12), { v: 0.68, legato: 0.06 });
  s.arp("sp2", 18, pC, { lo: 57 + t, hi: 76 + t, step: 0.25, pat: [0, 1, 2, 3, 4, 3, 2, 1], v: 0.42, dur: 0.25 });
  ost(s, "sp", 18, pC, { lo: 33, step: 0.5, v: 0.72 });
  roots(s, "lo", 18, pC, 33, 0.48, { oct: 0.6 });
  s.drum("tk", 18, 8, ["X.x.X.xxX.x.X.xx", "X.x.X.xxX.x.XxXx"], { v: 0.85 });
  s.drum("tkS", 18, 8, ["....X.......X.x."], { v: 0.7 });
  roots(s, "tmp", 18, pC, 33, 0.55, { d: 1, every: 1, ev2: 0.55 });
  if (heavy) s.chords("org", 18, pC, { lo: 50 + t, hi: 72 + t, n: 4, v: 0.45 });
  // -- D (26-33): 崩落 — 太鼓と低音だけ、そして再起
  const pD = tp("Am:8 Bb:8 F:8 E:4 E:4");
  s.drum("tk", 26, 4, ["X.......X..x....", "X.......X..x..x."], { v: 0.75 });
  s.chords("chA", 26, tp("Am:8 Bb:8"), { lo: 52 + t, hi: 69 + t, n: 3, v: 0.4, o: { att: 1.5 } });
  s.chords("pad", 26, pD, { lo: 45 + t, hi: 64 + t, n: 4, v: 0.5 });
  roots(s, "lo", 26, pD, 33, 0.5, { oct: 0.7 });
  s.n("hrn", s.B(28), R("Bb1"), 7.5, 0.55, { att: 1 }); s.n("hrn", s.B(28), R("F2"), 7.5, 0.45, { att: 1 });
  ost(s, "sp", 26, tp("Am:8 Bb:8"), { lo: 33, step: 1, pat: [0, 0, 12, 0], v: 0.5 });
  gallop(30, 2, R("F1"), 0.6, [0, 0, 12, 0, 0, 0, 14, 0, 0, 0, 12, 0, 16, 0, 14, 0]); gallop(32, 2, R("E1"), 0.7, ostE);
  s.drum("tk", 30, 4, ["X.x.X.x.X.x.X.x.", "X.x.X.x.X.x.XxXx", "XxXxX.x.XxXxX.x.", "XxXxXxXxXXXXXXXX"], { v: 0.82 });
  s.roll("tmp", s.B(33), 4, R("E2"), 0.3, 0.9, 8);
  s.swell("cym", s.B(34), 0.8);
  // -- E (34-41): 全奏の再現
  s.at("boom", 34, 24, 4, 0.85); s.at("crash", 34, 60, 4, 0.8);
  s.line("str", 34, tm(melB), { v: 0.78, legato: 0.03 });
  s.line("chA", 34, tr(tm(melB), -12), { v: 0.5, legato: 0.03 });
  stabs(s, "hrn", 34, pB, [[0, 0.5, 1], [1.5, 0.5, 0.75], [2.5, 1.2, 0.9]], { lo: 50 + t, hi: 66 + t, n: 3, v: 0.72, cycle: 4 });
  ost(s, "sp", 34, pB, { lo: 33, step: 0.5, v: 0.75, pat: [0, 0, 12, 0, 7, 0, 12, 7] });
  roots(s, "lo", 34, pB, 33, 0.5, { oct: 0.6 });
  s.drum("tk", 34, 8, ["X..x..x.X...x.x.", "X..x..x.X..xX.xx", "X..x..x.X...x.x.", "X.x.X.x.XxXxXXXX"], { v: 0.85 });
  s.drum("tkS", 34, 8, ["..x.X..x..x.X.x."], { v: 0.65 });
  roots(s, "tmp", 34, pB, 33, 0.55, { d: 1, every: 2, ev2: 0.7 });
  if (heavy) s.chords("org", 34, pB, { lo: 50 + t, hi: 72 + t, n: 4, v: 0.4 });
  if (heavy > 1) { for (const b of [2, 6, 10, 14, 26, 30]) s.at("boom", b, 24, 4, 0.55); }
  return s;
}

// ===== ボス「骸の修道院長」: 大オルガン・合唱・ティンパニの黒ミサ =====
// ニ調フリギア 126BPM。A: オルガンのトッカータの上で合唱が魂の動機を拡大形で唱える
// B: 金管が修道院長の主題 / C: 足鍵盤が半音で奈落へ / D: 合唱が動機を高く叫ぶ
function bossSong(name, t = 0, bpm = 126, heavy = 0) {
  const s = new Score({ name, bpm, loop: [2, 34], gain: 0.86, fadeIn: 0.05, delay: { l: 0.75, r: 1.5, fb: 0.22, lp: 2200 } });
  s.ch("org", { inst: "organ", vol: 0.6, rev: 0.6, human: 0.003 })
    .ch("ped", { inst: "organ", vol: 0.32, rev: 0.5, lp: 700 })
    .ch("chA", { inst: "choir", vol: 0.55, rev: 0.55, human: 0.008 })
    .ch("chO", { inst: "choirO", vol: 0.5, rev: 0.65 })
    .ch("brs", { inst: "brass", vol: 0.55, rev: 0.35, pan: -0.1, human: 0.006 })
    .ch("lo", { inst: "lowstr", vol: 0.45, rev: 0.3 })
    .ch("sp", { inst: "spicc", vol: 0.7, rev: 0.15, pan: -0.15, poly: 6, human: 0.003, cut: true, rel: 0.16 })
    .ch("str", { inst: "strings", vol: 0.55, rev: 0.35, pan: 0.2 })
    .ch("tmp", { inst: "timp", vol: 0.35, rev: 0.25, human: 0.003 })
    .ch("tk", { inst: "taiko", vol: 0.3, rev: 0.2, human: 0.003 })
    .ch("boom", { inst: "boom", vol: 0.55, rev: 0.35 })
    .ch("gong", { inst: "tamtam", vol: 0.45, rev: 0.6 })
    .ch("crash", { inst: "crash", vol: 0.5, rev: 0.4 })
    .ch("cym", { inst: "swell", vol: 0.3, rev: 0.3 })
    .ch("bell", { inst: "bell", vol: 0.6, rev: 0.7, lp: 3000 });
  const tp = (str) => t ? str.split(/\s+/).map((tok) => {
    if (!tok || tok === "|") return tok;
    const [c, d] = tok.split(":");
    const sh = (x) => { const mm = /^([A-G][#b]?)(.*)$/.exec(x); return nameOf(nm(mm[1] + "4") + t).replace(/-?\d+$/, "") + mm[2]; };
    return c.split("/").map(sh).join("/") + (d ? ":" + d : "");
  }).join(" ") : str;
  const tm = (str) => (t ? tr(str, t) : str);
  const R = (m) => nm(m) + t;
  // オルガンのトッカータ (8分): 根音-5度-8度-5度-(短2度/長2度上)-5度-8度-5度
  const toccata = (bar, str, v = 0.55) => {
    const base = s.B(bar);
    for (const p of prog(str)) {
      const minorish = p.c.pcs[1] === (p.c.root + 3) % 12 || p.c.root === (9 + t + 120) % 12; // 属和音はフリギア属 (短2度)
      const Rr = above(p.c.root, 48);
      const pat = [0, 7, 12, 7, minorish ? 13 : 14, 7, 12, 7];
      for (let i = 0; i < p.d * 2; i++) s.n("org", base + p.at + i * 0.5, Rr + pat[i % 8], 0.5, v * (i % 4 === 0 ? 1 : 0.75));
    }
  };
  // -- 序奏: 黒ミサの開幕
  s.at("boom", 0, 24, 4, 0.95); s.at("gong", 0, 36, 8, 0.7);
  for (const m of ["D2", "A2", "D3", "F3", "A3", "Eb4"]) s.n("org", 0, R(m), 6, 0.9);
  s.n("chA", 0, R("D5"), 6, 0.7, { att: 0.3 }); s.n("chA", 0, R("Eb5"), 6, 0.62, { att: 0.3 });
  s.n("ped", 0, R("D2"), 7, 0.8);
  s.roll("tmp", s.B(1), 4, R("D2"), 0.3, 0.9, 8);
  s.swell("cym", s.B(2), 0.75);
  // -- A (2-9)
  const pA = tp("Dm:4 Dm:4 Bb:4 Gm:4 A:4 A:4 Dm:4 Dm:4");
  toccata(2, pA, 0.5);
  roots(s, "ped", 2, pA, 36, 0.6);
  s.line("chA", 2, tm("D4:4 | A4:4 | Bb4:3 A4:1 | G4:2 F4:2 | E4:3 F4:1 | D4:2 C#4:2 | D4:8"), { v: 0.62, legato: 0.1 });
  s.line("chO", 2, tm("D3:4 | A3:4 | Bb3:3 A3:1 | G3:2 F3:2 | E3:3 F3:1 | D3:2 C#3:2 | D3:8"), { v: 0.45, legato: 0.1 });
  s.drum("tmp", 2, 8, ["X.x.X.x.X.x.XxXx"], { v: 0.6, mm: (b, i) => (i % 4 === 2 ? R("A1") : R("D2")) });
  s.drum("tk", 2, 8, ["X.......X..x....", "X.......X..x..x."], { v: 0.7 });
  ost(s, "sp", 2, pA, { lo: 33, step: 0.5, pat: [0, 0, 0, 0, 0, 0, 12, 0], v: 0.55 });
  // -- B (10-17): 修道院長の主題 (金管)
  const pB = tp("Dm:4 Eb:4 Dm:4 C:4 Bb:4 A:4 Gm:2 Eb:2 A:4");
  s.at("crash", 10, 60, 4, 0.6);
  toccata(10, pB, 0.48);
  roots(s, "ped", 10, pB, 36, 0.6);
  s.line("brs", 10, tm("D4:1.5 Eb4:.5 D4:1 A3:1 | Bb3:1.5 C4:.5 Bb3:1 G3:1 | A3:1 D4:1 F4:1 A4:1 | G4:2 E4:2 | F4:1.5 G4:.5 F4:1 D4:1 | E4:1 C#4:1 A3:2 | Bb3:1 D4:1 G4:1 Bb4:1 | A4:4"), { v: 0.75, legato: 0.04 });
  s.chords("str", 10, pB, { lo: 62 + t, hi: 81 + t, n: 3, v: 0.45 });
  s.chords("chO", 10, pB, { lo: 50 + t, hi: 65 + t, n: 3, v: 0.36 });
  roots(s, "lo", 10, pB, 33, 0.5, { oct: 0.6 });
  s.drum("tk", 10, 8, ["X..x..x.X...x.x.", "X..x..x.X..xX.xx"], { v: 0.78 });
  roots(s, "tmp", 10, pB, 36, 0.55, { d: 1, every: 1, ev2: 0.5 });
  ost(s, "sp", 10, pB, { lo: 33, step: 0.5, v: 0.6 });
  // -- C (18-25): 足鍵盤が半音で奈落へ、合唱の不協和
  s.at("boom", 18, 24, 4, 0.8); s.at("gong", 22, 36, 8, 0.6);
  s.line("ped", 18, tm("D2:4 | C#2:4 | C2:4 | B1:4 | Bb1:4 | A1:4 | Ab1:4 | A1:4"), { v: 0.75, legato: 0.1 });
  s.line("org", 18, tm("D4+F4+A4:8 | C#4+E4+A4:8 | D4+F4+Bb4:8 | C#4+E4+G4:4 Eb4+G4+A4:4"), { v: 0.36 });
  s.n("chA", s.B(18), R("D5"), 15, 0.48, { att: 2 }); s.n("chA", s.B(18), R("Eb5"), 15, 0.44, { att: 2 });
  s.n("chA", s.B(22), R("A4"), 15, 0.5, { att: 2 }); s.n("chA", s.B(22), R("Bb4"), 15, 0.46, { att: 2 });
  s.n("lo", s.B(18), R("D2"), 15, 0.45, { att: 1 }); s.n("lo", s.B(22), R("Ab1"), 15, 0.45, { att: 1 });
  s.drum("tk", 18, 8, ["X.....x.X.......", "X.....x.X.....x."], { v: 0.65 });
  for (const b of [19, 21, 23]) s.roll("tmp", s.B(b) + 2, 2, R("D2"), 0.2, 0.6, 8);
  s.at("bell", 18, R("D3"), 4, 0.45); s.at("bell", 22, R("A2"), 4, 0.42);
  s.roll("tmp", s.B(25), 4, R("A1"), 0.3, 0.9, 8); s.swell("cym", s.B(26), 0.8);
  // -- D (26-33): 合唱が魂の動機を高く叫ぶ
  const pD = tp("Dm:4 Bb:2 Gm:2 A7sus4:3 A7:1 Dm:4 Dm:4 Bb:2 Gm:2 A7sus4:3 A7:1 Dm:4");
  s.at("crash", 26, 60, 4, 0.75); s.at("boom", 26, 24, 4, 0.75); s.at("crash", 30, 60, 4, 0.6);
  s.line("chA", 26, tm(SOUL1), { tr: 12, v: 0.7, legato: 0.08 });
  s.line("chA", 30, tm("D4:2 A4:2 | Bb4:1.5 A4:.5 G4:1 F4:1 | E4:1.5 F4:.5 D4:1 C#4:1 | D4:2 A3:2"), { tr: 12, v: 0.72, legato: 0.08 });
  s.line("str", 26, tm(SOUL1 + " | " + SOUL1), { v: 0.6, legato: 0.06 });
  toccata(26, pD, 0.55);
  roots(s, "ped", 26, pD, 36, 0.65);
  stabs(s, "brs", 26, pD, [[0, 0.75, 1], [1.5, 0.5, 0.8], [2.5, 1.2, 0.9]], { lo: 48 + t, hi: 64 + t, n: 3, v: 0.72 });
  roots(s, "lo", 26, pD, 33, 0.52, { oct: 0.7 });
  s.drum("tk", 26, 8, ["X.x.X.xxX.x.X.xx", "X.x.X.xxX.x.XxXx", "X.x.X.xxX.x.X.xx", "XxXxX.x.XxXxXXXX"], { v: 0.85 });
  roots(s, "tmp", 26, pD, 36, 0.6, { d: 1, every: 1, ev2: 0.55 });
  if (heavy) { for (const b of [2, 6, 10, 14, 26, 30]) s.at("boom", b, 24, 4, 0.5); s.chords("chO", 2, pA, { lo: 48 + t, hi: 62 + t, n: 3, v: 0.35 }); }
  return s;
}

// ===== ジングル (効果音バスで鳴る短い楽曲) =====
// 勝利: ニ短調の金管が駆け上がり、最後はニ長調 (ピカルディの三度) で光が差す
function jVictory() {
  const s = new Score({ name: "j_victory", bpm: 112, gain: 1.0, fadeIn: 0, bars: 3 });
  s.ch("brs", { inst: "brass", vol: 0.6, rev: 0.4, human: 0.004 })
    .ch("tmp", { inst: "timp", vol: 0.6, rev: 0.35 })
    .ch("chA", { inst: "choir", vol: 0.5, rev: 0.6, att: 0.2 })
    .ch("str", { inst: "strings", vol: 0.4, rev: 0.5, att: 0.15 })
    .ch("hp", { inst: "harp", vol: 0.4, rev: 0.5 })
    .ch("crash", { inst: "crash", vol: 0.3, rev: 0.5 })
    .ch("bell", { inst: "bell", vol: 0.28, rev: 0.7 });
  for (const m of ["D3", "A3", "D4", "F4"]) s.n("brs", 0, m, 0.7, 0.85);
  s.n("tmp", 0, "D2", 1, 0.8);
  for (const m of ["C4", "E4", "G4"]) s.n("brs", 0.75, m, 0.25, 0.65);
  for (const m of ["Bb3", "D4", "F4"]) s.n("brs", 1, m, 0.9, 0.75);
  s.n("tmp", 1, "Bb1", 1, 0.65);
  for (const m of ["C4", "E4", "G4"]) s.n("brs", 2, m, 0.9, 0.78);
  s.n("tmp", 2, "C2", 1, 0.7);
  s.roll("tmp", 2.5, 0.5, "A1", 0.4, 0.7, 8);
  for (const [i, m] of ["D4", "F#4", "A4", "D5", "F#5", "A5"].entries()) s.n("hp", 2.5 + i * 0.0833, m, 1, 0.55);
  for (const m of ["D3", "A3", "D4", "F#4", "A4", "D5"]) s.n("brs", 3, m, 3.5, 0.95);
  for (const m of ["D4", "F#4", "A4", "D5"]) s.n("chA", 3, m, 3.5, 0.62);
  for (const m of ["D5", "F#5", "A5"]) s.n("str", 3, m, 3.5, 0.55);
  s.n("tmp", 3, "D2", 1, 0.95); s.n("crash", 3, 60, 4, 0.75); s.n("bell", 3, "D5", 4, 0.45);
  return s;
}
// 魂のランクアップ: ティンパニのロールに乗って金管が「タタタ・ターン」と名乗りを上げ、
// ハ→ヘ→ト と駆け上がった末に、合唱・オルガン・弦・鐘が揃う大きなハ長調で光が満ちる
function jRankup() {
  const s = new Score({ name: "j_rankup", bpm: 100, gain: 1.05, fadeIn: 0, bars: 4 });
  s.ch("brs", { inst: "brass", vol: 0.62, rev: 0.42, human: 0.004 })
    .ch("brs2", { inst: "brass", vol: 0.5, rev: 0.45, human: 0.004 })
    .ch("tmp", { inst: "timp", vol: 0.62, rev: 0.35 })
    .ch("chA", { inst: "choir", vol: 0.52, rev: 0.65, att: 0.2 })
    .ch("org", { inst: "organ", vol: 0.32, rev: 0.6, att: 0.15 })
    .ch("str", { inst: "strings", vol: 0.42, rev: 0.55, att: 0.12 })
    .ch("hp", { inst: "harp", vol: 0.42, rev: 0.5 })
    .ch("cel", { inst: "celesta", vol: 0.36, rev: 0.6 })
    .ch("crash", { inst: "crash", vol: 0.32, rev: 0.5 })
    .ch("cym", { inst: "swell", vol: 0.24, rev: 0.4 })
    .ch("bell", { inst: "bell", vol: 0.3, rev: 0.7 });
  // 序: ティンパニのロールと竪琴の駆け上がり、シンバルのふくらみ
  s.roll("tmp", 0, 2, "G1", 0.25, 0.85, 8);
  ["C3", "E3", "G3", "C4", "E4", "G4", "C5", "E5", "G5", "C6"].forEach((m, i) => s.n("hp", 1 + i * 0.1, m, 1, 0.38 + i * 0.03));
  s.swell("cym", 2, 0.6);
  // 名乗り: G-G-G → C (ハ長調)
  s.n("crash", 2, 60, 3, 0.6); s.n("tmp", 2, "C2", 1, 0.9);
  for (const m of ["C3", "G3", "C4", "E4"]) s.n("brs2", 2, m, 1.9, 0.75);
  for (const b of [2, 2.333, 2.667]) s.n("brs", b, "G4", 0.3, 0.8);
  s.n("brs", 3, "C5", 0.95, 0.9);
  for (const m of ["E4", "G4", "C5"]) s.n("str", 2, m, 2, 0.5);
  // ヘ長調 → ト長調で駆け上がる
  for (const m of ["F3", "A3", "C4", "F4"]) s.n("brs2", 4, m, 0.95, 0.75);
  s.n("tmp", 4, "F1", 1, 0.75);
  s.n("brs", 4, "A4", 0.5, 0.8); s.n("brs", 4.5, "C5", 0.5, 0.85);
  for (const m of ["F4", "A4", "C5"]) s.n("str", 4, m, 1, 0.5);
  for (const m of ["G3", "B3", "D4", "G4"]) s.n("brs2", 5, m, 0.95, 0.8);
  [["G4", 5], ["B4", 5.333], ["D5", 5.667]].forEach(([m, b]) => s.n("brs", b, m, 0.3, 0.85));
  for (const m of ["G4", "B4", "D5"]) s.n("str", 5, m, 1, 0.55);
  s.roll("tmp", 5, 1, "G1", 0.45, 0.9, 8);
  // 頂: 全員でハ長調を高らかに
  for (const m of ["C3", "G3", "C4", "E4", "G4"]) s.n("brs2", 6, m, 4, 0.9);
  s.n("brs", 6, "E5", 1, 0.95); s.n("brs", 7, "D5", 0.5, 0.85); s.n("brs", 7.5, "E5", 0.5, 0.88); s.n("brs", 8, "G5", 2.5, 0.95);
  for (const m of ["C4", "E4", "G4", "C5"]) s.n("chA", 6, m, 4, 0.65);
  for (const m of ["C2", "C3", "G3", "C4", "E4"]) s.n("org", 6, m, 4, 0.55);
  for (const m of ["E5", "G5", "C6"]) s.n("str", 6, m, 4, 0.6);
  s.n("tmp", 6, "C2", 1, 1); s.n("crash", 6, 60, 4, 0.8);
  s.n("bell", 6, "C6", 4, 0.5); s.n("bell", 6.5, "G5", 3.5, 0.4); s.n("bell", 8, "C6", 3, 0.45);
  ["C6", "E6", "G6", "C7", "G6", "E6", "C6", "E6", "G6", "C7"].forEach((m, i) => s.n("cel", 6 + i * 0.25, m, 0.8, 0.45));
  s.roll("tmp", 9, 1, "C2", 0.4, 0.95, 8); s.n("tmp", 10, "C2", 1, 1); s.n("crash", 10, 60, 3, 0.6);
  return s;
}
// レベルアップ: 竪琴が駆け上がり、合唱とチェレスタが光の和音
function jLevelup() {
  const s = new Score({ name: "j_levelup", bpm: 120, gain: 1.35, fadeIn: 0, bars: 2 });
  s.ch("hp", { inst: "harp", vol: 0.45, rev: 0.5 })
    .ch("cel", { inst: "celesta", vol: 0.4, rev: 0.6 })
    .ch("chA", { inst: "choir", vol: 0.5, rev: 0.65, att: 0.25 })
    .ch("str", { inst: "strings", vol: 0.32, rev: 0.6, att: 0.25 })
    .ch("bell", { inst: "bell", vol: 0.25, rev: 0.7 })
    .ch("cym", { inst: "swell", vol: 0.2, rev: 0.4 });
  const gl = ["F3", "A3", "C4", "F4", "G4", "A4", "C5", "F5", "G5", "A5", "C6", "F6"];
  gl.forEach((m, i) => s.n("hp", i * 0.125, m, 1, 0.4 + i * 0.03));
  for (const m of ["F5", "A5", "C6", "E6"]) s.n("cel", 1.5, m, 2, 0.5);
  for (const m of ["F4", "A4", "C5", "E5"]) s.n("chA", 1.5, m, 2.6, 0.55);
  for (const m of ["A4", "C5", "F5"]) s.n("str", 1.5, m, 2.6, 0.45);
  s.n("bell", 1.5, "F5", 3, 0.4);
  s.swell("cym", 1.5, 0.5);
  return s;
}
// 入手: オルゴールのきらめきと低い鐘
function jItem() {
  const s = new Score({ name: "j_item", bpm: 120, gain: 2.0, fadeIn: 0, bars: 1 });
  s.ch("mb", { inst: "musicbox", vol: 0.42, rev: 0.55 })
    .ch("cel", { inst: "celesta", vol: 0.3, rev: 0.6 })
    .ch("hp", { inst: "harp", vol: 0.35, rev: 0.5 })
    .ch("chA", { inst: "choir", vol: 0.32, rev: 0.6, att: 0.15 })
    .ch("bell", { inst: "bell", vol: 0.22, rev: 0.7 });
  ["A5", "D6", "F6", "A6"].forEach((m, i) => s.n("mb", i * 0.25, m, 1, 0.5 + i * 0.05));
  s.n("cel", 1, "E6", 1.5, 0.4); s.n("cel", 1, "A5", 1.5, 0.35);
  s.n("hp", 0, "D3", 2, 0.5); s.n("hp", 0, "A3", 2, 0.4);
  s.n("chA", 0.5, "D5", 1.2, 0.4); s.n("chA", 0.5, "A5", 1.2, 0.34);
  s.n("bell", 0, "D5", 2, 0.3);
  return s;
}
// 全滅: 銅鑼と重低音、低弦と合唱の下降する嘆き、遠い弔鐘
function jGameover() {
  const s = new Score({ name: "j_gameover", bpm: 60, gain: 1.0, fadeIn: 0, bars: 3 });
  s.ch("boom", { inst: "boom", vol: 0.6, rev: 0.4 })
    .ch("gong", { inst: "tamtam", vol: 0.5, rev: 0.6 })
    .ch("lo", { inst: "lowstr", vol: 0.5, rev: 0.55, att: 0.4, rel: 1.5 })
    .ch("chO", { inst: "choirO", vol: 0.45, rev: 0.7, att: 0.6, rel: 2 })
    .ch("str", { inst: "strings", vol: 0.32, rev: 0.65, att: 0.6, rel: 2 })
    .ch("bell", { inst: "bell", vol: 0.32, rev: 0.85, lp: 2500 });
  s.n("boom", 0, 24, 4, 0.9); s.n("gong", 0, 36, 8, 0.65);
  s.line("lo", 0, "A2:1 G2:1 F2:1 E2:1 | D2:4", { v: 0.6, legato: 0.1 });
  s.line("chO", 0, "C4:1 Bb3:1 A3:1 G#3:1 | A3:4", { v: 0.48, legato: 0.12 });
  s.line("chO", 0, "E3:1 D3:1 C3:1 B2:1 | D3:4", { v: 0.4, legato: 0.12 });
  s.line("str", 0, "F4:1 E4:1 D4:1 C#4:1 | D4:4", { v: 0.4, legato: 0.12 });
  s.n("bell", 4, "D3", 4, 0.55);
  return s;
}

// ---- 曲目表 ----
const BUILD = {
  title, opening, town, tavern, shop, inn, palace, shrine, mansion, layer1,
  battle: () => battleSong("battle", 0, 150, 0),
  battle2: () => battleSong("battle2", 5, 156, 1),
  battle3: () => battleSong("battle3", 7, 164, 2),
  boss: () => bossSong("boss", 0, 126, 0),
  boss2: () => bossSong("boss2", -2, 132, 1),
  j_victory: jVictory, j_rankup: jRankup, j_levelup: jLevelup, j_item: jItem, j_gameover: jGameover,
};
const CACHE = new Map();
export function newSong(name) {
  if (!BUILD[name]) return null;
  let s = CACHE.get(name);
  if (!s) { s = BUILD[name]().build(); CACHE.set(name, s); }
  return s;
}
export const NEW_SONGS = Object.keys(BUILD);
