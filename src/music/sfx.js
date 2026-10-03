// 効果音 — すべてコードで合成し、短いバッファに焼いてから鳴らす (打撃は複数の揺らぎを持つ)
// 層を重ねた立ち上がり (破裂音+胴鳴り+金属の響き) と残響への送りで、短く重く響かせる。
import {
  rng, modal, white, pink, brown, envExp, fadeEdges, mixInto, peakNorm, softClip,
  applyBq, lp1, hp1, lpSweep, svfSweep, dcBlock,
} from "./dsp.js";

const SR = 32000;
const len = (s) => Math.round(s * SR);
const mono = (x) => ({ sr: SR, ch: [fadeEdges(peakNorm(x, 0.9), SR, 0.0004, 0.02)] });
// ハース効果で左右に広げる (ms 遅らせた複製)
function haas(x, ms = 9, side = 0.85) {
  const d = Math.round(ms / 1000 * SR);
  const R = new Float32Array(x.length);
  for (let i = d; i < x.length; i++) R[i] = x[i - d] * side;
  peakNorm(x, 0.9); peakNorm(R, 0.85);
  return { sr: SR, ch: [fadeEdges(x, SR, 0.0004, 0.02), fadeEdges(R, SR, 0.0004, 0.02)] };
}
// 正弦の掃引 (f(t) 関数)、減衰 t60
function sweep(dur, fAt, t60, att = 0.001) {
  const n = len(dur), x = new Float32Array(n);
  let ph = 0;
  const k = -6.9078 / (t60 * SR), na = Math.max(1, att * SR);
  for (let i = 0; i < n; i++) {
    ph += 6.283185307 * fAt(i / SR) / SR;
    x[i] = Math.sin(ph) * Math.exp(k * i) * Math.min(1, i / na);
  }
  return x;
}
function burst(r, dur, t60, att = 0.0005) { const x = white(len(dur), r); return envExp(x, SR, t60, att); }
function whoosh(r, dur, f0, f1, f2, q = 1.6, peak = 0.4) {
  const x = white(len(dur), r);
  svfSweep(x, SR, (t) => { const p = t / dur; return p < peak ? f0 + (f1 - f0) * (p / peak) : f1 + (f2 - f1) * ((p - peak) / (1 - peak)); }, q);
  for (let i = 0; i < x.length; i++) { const p = i / x.length; const e = p < peak ? Math.sin(Math.PI / 2 * p / peak) : Math.cos(Math.PI / 2 * (p - peak) / (1 - peak)); x[i] *= e * e; }
  return x;
}
function footstep(r, bright = 1) {
  const x = sweep(0.16, (t) => 70 + 30 * Math.exp(-t / 0.015), 0.09);
  const g = white(len(0.09), r);
  for (let i = 0; i < g.length; i++) if (r() > 0.35) g[i] *= 0.25; // ざらつき
  applyBq(g, "bp", 1300 * bright, 0.9, SR); envExp(g, SR, 0.05, 0.002);
  mixInto(x, g, 0, 0.9);
  return x;
}
function vocalTone(dur, f0At, ampAt, formants) {
  // 声のような倍音 (加算合成) をフォルマントで整形
  const n = len(dur), x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f0 = f0At(t);
    ph += f0 / SR;
    let s = 0;
    for (let h = 1; h <= 14; h++) {
      const f = f0 * h;
      let g = 1 / h;
      for (const [F, B] of formants) { const d = F * F - f * f; g *= (F * F) / Math.sqrt(d * d + f * f * B * B); }
      s += Math.sin(6.283185307 * ph * h) * g;
    }
    x[i] = s * ampAt(t);
  }
  return x;
}

// ---- 鑑定 (このゲームの肝) ----
// 「．」のたびに: 鼓動 (段ごとに強く) + 水晶玉の響き (わずかに唸る) + 覗き込む吐息。
// 音は 1→3 段で ラ → ド → レ# と上がり、3段目は増4度の不協和で宙づりのまま答えを待つ
const APPRAISE_NOTE = [440, 523.25, 622.25];
function appraiseTick(r, step) {
  const n = len(1.0), x = new Float32Array(n);
  const k = 0.55 + step * 0.2;
  const beat = (at, f, a) => mixInto(x, sweep(0.24, (t) => f + 34 * Math.exp(-t / 0.018), 0.13), len(at), a);
  beat(0, 56, k); beat(0.15, 48, k * 0.65);
  const f = APPRAISE_NOTE[step - 1];
  mixInto(x, modal(SR, 0.95, [[f, 1, 0.75, 0.004], [f * 1.0045, 0.75, 0.8, 0.004], [f * 2.0, 0.2, 0.4], [f * 2.76, 0.12, 0.22], [f * 5.4, 0.05, 0.1]]), len(0.03), 0.3);
  // 宙づりの土台: 低いラの上で、段が進むほど不協和が濃くなる
  const lo = sweep(0.9, () => 110, 0.7, 0.08);
  for (let i = 0; i < lo.length; i++) lo[i] *= 0.75 + 0.25 * Math.sin(i / SR * 6.28 * (4 + step * 2));
  mixInto(x, lo, 0, 0.12 + step * 0.05);
  if (step === 3) mixInto(x, modal(SR, 0.9, [[f * 0.7071 * 2, 0.6, 0.6, 0.01]]), len(0.05), 0.12); // 増4度の影
  mixInto(x, whoosh(r, 0.55, 900, 3000 + step * 700, 1800, 3.2, 0.5), 0, 0.14 + step * 0.04);
  return haas(x, 8);
}

export const SFX_DEFS = {
  select: { vars: 2, vol: 0.38, rev: 0.12, gen(r) {
    const x = modal(SR, 0.12, [[1180 + r() * 60, 1, 0.05], [2950, 0.4, 0.03], [4800, 0.12, 0.015], [330, 0.25, 0.04]]);
    mixInto(x, hp1(burst(r, 0.003, 0.002), 3000, SR), 0, 0.5);
    return mono(x);
  } },
  flip: { vars: 2, vol: 0.32, rev: 0.12, gen(r) {
    const x = whoosh(r, 0.14, 900, 3600, 1800, 1.2, 0.25);
    mixInto(x, whoosh(r, 0.08, 1800, 4200, 2500, 1.4, 0.3), len(0.04), 0.5);
    return mono(x);
  } },
  step: { vars: 4, vol: 0.28, rev: 0.12, gen(r) { return mono(footstep(r, 0.8 + r() * 0.5)); } },
  swing: { vars: 3, vol: 0.42, rev: 0.12, gen(r) { return mono(whoosh(r, 0.22, 380, 2400 + r() * 500, 800, 1.5, 0.4)); } },
  hit: { vars: 4, vol: 0.6, rev: 0.16, gen(r) {
    const x = sweep(0.3, (t) => 52 + 105 * Math.exp(-t / 0.03), 0.18);
    mixInto(x, hp1(burst(r, 0.012, 0.006), 2500, SR), 0, 0.8);
    const body = burst(r, 0.12, 0.08); applyBq(body, "bp", 550 + r() * 200, 0.8, SR);
    mixInto(x, body, 0, 1.4);
    const f = 1250 + r() * 300;
    mixInto(x, modal(SR, 0.2, [[f, 1, 0.12], [f * 1.65, 0.7, 0.09], [f * 2.6, 0.4, 0.06]]), len(0.002), 0.18);
    softClip(x, 1.7);
    return mono(x);
  } },
  crit: { vars: 2, vol: 0.6, rev: 0.24, gen(r) {
    const n = len(0.75), x = new Float32Array(n);
    mixInto(x, whoosh(r, 0.06, 900, 3500, 2000, 1.4, 0.7), 0, 0.4);
    const at = len(0.045);
    mixInto(x, sweep(0.6, (t) => 38 + 130 * Math.exp(-t / 0.035), 0.32), at, 1);
    mixInto(x, sweep(0.7, (t) => 30 + 35 * Math.exp(-t / 0.2), 0.5), at, 0.7);
    mixInto(x, hp1(burst(r, 0.02, 0.012), 2000, SR), at, 1.0);
    const body = burst(r, 0.2, 0.12); applyBq(body, "bp", 480, 0.7, SR); mixInto(x, body, at, 1.5);
    const f = 1500 + r() * 300;
    mixInto(x, modal(SR, 0.6, [[f, 1, 0.4], [f * 1.48, 0.8, 0.32], [f * 2.31, 0.6, 0.22], [f * 3.9, 0.3, 0.12]]), at, 0.35);
    const sh = burst(r, 0.3, 0.22); applyBq(sh, "bp", 6200, 3, SR); mixInto(x, sh, at, 0.6);
    softClip(x, 2.0);
    return mono(x);
  } },
  miss: { vars: 2, vol: 0.34, rev: 0.12, gen(r) { return mono(whoosh(r, 0.2, 300, 1600 + r() * 300, 500, 1.3, 0.45)); } },
  evade: { vars: 2, vol: 0.34, rev: 0.12, gen(r) {
    const x = whoosh(r, 0.13, 1500, 5500, 3000, 1.8, 0.35);
    const fl = whoosh(r, 0.1, 600, 1400, 900, 1.2, 0.5);
    for (let i = 0; i < fl.length; i++) fl[i] *= 0.6 + 0.4 * Math.sin(i / SR * 6.28 * 38);
    mixInto(x, fl, len(0.02), 0.6);
    return mono(x);
  } },
  spell: { vars: 2, vol: 0.48, rev: 0.45, gen(r) {
    const n = len(1.0), x = new Float32Array(n);
    const sh = white(n, r);
    svfSweep(sh, SR, (t) => 500 + 4200 * Math.min(1, t / 0.4), 5);
    for (let i = 0; i < n; i++) { const t = i / SR; sh[i] *= Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.3) / 0.15); }
    mixInto(x, sh, 0, 0.6);
    const k0 = r() < 0.5 ? 1 : 1.1225;
    const base = [880, 1318.5, 1760, 2093].map((f) => f * k0);
    base.forEach((f, k) => mixInto(x, modal(SR, 0.8, [[f, 1, 0.6], [f * 2.76, 0.25, 0.2], [f * 1.003, 0.5, 0.7]]), len(0.04 * k), 0.35));
    const lo = sweep(0.7, () => 110, 0.6, 0.12);
    for (let i = 0; i < lo.length; i++) lo[i] *= 0.7 + 0.3 * Math.sin(i / SR * 6.28 * 7);
    mixInto(x, lo, 0, 0.5);
    return haas(x, 11);
  } },
  fire: { vars: 2, vol: 0.55, rev: 0.3, gen(r) {
    const n = len(0.85), x = white(n, r);
    lpSweep(x, SR, (t) => (t < 0.15 ? 400 + 2800 * (t / 0.15) : 3200 * Math.exp(-(t - 0.15) / 0.3) + 500));
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.04) * Math.exp(-t / 0.3); }
    for (let k = 0; k < 40; k++) {
      const at = Math.pow(r(), 1.7) * 0.7;
      const c = burst(r, 0.006, 0.003); applyBq(c, "bp", 2000 + r() * 2500, 2, SR);
      mixInto(x, c, len(at), (0.6 + r()) * Math.exp(-at / 0.35));
    }
    const rum = sweep(0.8, () => 62, 0.4, 0.03); mixInto(x, rum, 0, 0.45);
    softClip(x, 1.4);
    return mono(x);
  } },
  heal: { vars: 1, vol: 0.42, rev: 0.5, gen(r) {
    const n = len(1.3), x = new Float32Array(n);
    [880, 1108.7, 1318.5, 1760].forEach((f, k) => mixInto(x, modal(SR, 1.1, [[f, 1, 0.9], [f * 2.0, 0.08, 0.4], [f * 1.002, 0.4, 1.0]]), len(0.07 * k), 0.4));
    const v = pink(n, r), vo = new Float32Array(n);
    for (const [f, q] of [[800, 6], [1200, 7], [2600, 8]]) { const y = v.slice(); applyBq(y, "bp", f, q, SR); mixInto(vo, y, 0, 1); }
    for (let i = 0; i < n; i++) { const t = i / SR; vo[i] *= Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.3) / 0.35); }
    mixInto(x, vo, 0, 0.9);
    const air = white(n, r); hp1(air, 7000, SR); for (let i = 0; i < n; i++) air[i] *= Math.sin(Math.PI * Math.min(1, i / n)) * 0.12;
    mixInto(x, air, 0, 1);
    return haas(x, 9);
  } },
  chest: { vars: 1, vol: 0.52, rev: 0.25, gen(r) {
    const n = len(0.8), x = new Float32Array(n);
    // 蓋のきしみ
    const ex = new Float32Array(len(0.2));
    let t = 0.005;
    while (t < 0.18) { ex[len(t)] = 0.6 + r() * 0.4; t += 1 / (60 + 90 * (t / 0.18)) * (0.8 + r() * 0.4); }
    const cr = new Float32Array(ex.length);
    for (const [f, q, g] of [[420, 12, 1], [930, 10, 0.7], [1800, 8, 0.4]]) { const y = ex.slice(); applyBq(y, "bp", f, q, SR); mixInto(cr, y, 0, g); }
    mixInto(x, cr, 0, 0.5);
    // ゴトリと開く
    const th = sweep(0.2, (tt) => 90 + 60 * Math.exp(-tt / 0.02), 0.12); mixInto(x, th, len(0.2), 0.9);
    const wd = burst(r, 0.08, 0.05); applyBq(wd, "bp", 500, 1, SR); mixInto(x, wd, len(0.2), 0.8);
    // 金貨のきらめき
    for (let k = 0; k < 8; k++) {
      const f = 3000 + r() * 4000;
      mixInto(x, modal(SR, 0.3, [[f, 1, 0.15 + r() * 0.1], [f * 1.51, 0.5, 0.1]]), len(0.25 + r() * 0.3), 0.18 + r() * 0.12);
    }
    return mono(x);
  } },
  trap: { vars: 1, vol: 0.55, rev: 0.25, gen(r) {
    const n = len(0.8), x = new Float32Array(n);
    mixInto(x, modal(SR, 0.05, [[2600, 1, 0.02], [4100, 0.6, 0.015]]), 0, 0.6);
    mixInto(x, modal(SR, 0.05, [[2300, 1, 0.02], [3700, 0.6, 0.015]]), len(0.035), 0.6);
    // 発条のうなり
    const n2 = len(0.55), sp = new Float32Array(n2);
    let ph = 0;
    for (let i = 0; i < n2; i++) {
      const t = i / SR, f = 150 + 70 * Math.exp(-t / 0.08) + 8 * Math.sin(t * 6.28 * 23);
      ph += f / SR;
      sp[i] = (Math.sin(6.283 * ph) + 0.5 * Math.sin(6.283 * ph * 2.3) + 0.3 * Math.sin(6.283 * ph * 4.1)) * Math.exp(-t / 0.13);
    }
    mixInto(x, sp, len(0.06), 0.5);
    mixInto(x, sweep(0.3, (t) => 60 + 70 * Math.exp(-t / 0.03), 0.2), len(0.06), 0.8);
    const hiss = white(len(0.6), r); hp1(hiss, 2500, SR); envExp(hiss, SR, 0.45, 0.02); mixInto(x, hiss, len(0.1), 0.25);
    softClip(x, 1.3);
    return mono(x);
  } },
  stairs: { vars: 1, vol: 0.5, rev: 0.35, gen(r) {
    const n = len(1.0), x = new Float32Array(n);
    [[0, 1, 1], [0.17, 0.75, 0.8], [0.34, 0.55, 0.6]].forEach(([at, a, b]) => {
      const f = footstep(r, b); lp1(f, 2500 * b, SR); mixInto(x, f, len(at), a);
    });
    const w = brown(n, r); lp1(w, 320, SR);
    for (let i = 0; i < n; i++) { const t = i / SR; w[i] *= Math.sin(Math.PI * Math.min(1, t / 0.9)) * 0.9; }
    mixInto(x, w, 0, 0.6);
    return mono(x);
  } },
  die: { vars: 1, vol: 0.5, rev: 0.5, gen(r) {
    const n = len(1.4), x = new Float32Array(n);
    mixInto(x, sweep(0.4, (t) => 40 + 55 * Math.exp(-t / 0.04), 0.28), 0, 1);
    const fall = burst(r, 0.2, 0.14); lp1(fall, 450, SR); mixInto(x, fall, 0, 1.2);
    const bone = burst(r, 0.025, 0.012); applyBq(bone, "bp", 2300, 2, SR); mixInto(x, bone, len(0.01), 0.6);
    const moan = vocalTone(1.2, (t) => 210 * Math.pow(0.5, t / 1.1), (t) => Math.min(1, t / 0.15) * Math.exp(-t / 0.5), [[650, 100], [1050, 120], [2500, 200]]);
    mixInto(x, moan, len(0.12), 0.08);
    softClip(x, 1.2);
    return mono(x);
  } },
  ng: { vars: 1, vol: 0.4, rev: 0.12, gen(r) {
    const x = modal(SR, 0.32, [[180, 1, 0.07], [420, 0.4, 0.04], [760, 0.15, 0.02]]);
    mixInto(x, modal(SR, 0.2, [[163, 1, 0.08], [380, 0.4, 0.05], [700, 0.15, 0.02]]), len(0.11), 1);
    lp1(x, 1600, SR);
    return mono(x);
  } },
  flee: { vars: 1, vol: 0.4, rev: 0.15, gen(r) {
    const n = len(0.65), x = new Float32Array(n);
    for (let k = 0; k < 4; k++) mixInto(x, footstep(r, 1.2), len(k * 0.09), 0.8 - k * 0.12);
    mixInto(x, whoosh(r, 0.3, 400, 2200, 600, 1.3, 0.4), len(0.12), 0.6);
    return mono(x);
  } },
  // 奇襲: 背後から迫る風切り → 腹に響く衝撃と、三全音でぶつかる金属の一撃
  ambush: { vars: 1, vol: 0.62, rev: 0.3, gen(r) {
    const n = len(1.3), x = new Float32Array(n);
    mixInto(x, whoosh(r, 0.3, 300, 3400, 900, 1.8, 0.85), 0, 0.55);
    const at = len(0.26);
    mixInto(x, sweep(0.6, (t) => 46 + 85 * Math.exp(-t / 0.025), 0.35), at, 1.0);
    const thud = burst(r, 0.2, 0.11); lp1(thud, 520, SR); mixInto(x, thud, at, 0.9);
    const clang = burst(r, 0.03, 0.012); applyBq(clang, "bp", 3100, 2.2, SR); mixInto(x, clang, at, 0.45);
    mixInto(x, modal(SR, 1.0, [[466.16, 1, 0.55], [659.26, 0.85, 0.5], [932.33, 0.3, 0.3], [1318.5, 0.22, 0.2], [2510, 0.1, 0.08]]), at, 0.24);
    softClip(x, 1.3);
    return mono(x);
  } },
  appraise1: { vars: 1, vol: 0.5, rev: 0.4, gen(r) { return appraiseTick(r, 1); } },
  appraise2: { vars: 1, vol: 0.52, rev: 0.4, gen(r) { return appraiseTick(r, 2); } },
  appraise3: { vars: 1, vol: 0.55, rev: 0.42, gen(r) { return appraiseTick(r, 3); } },
  // 鑑定成功: 宙づりの和音が長調へ解け、封が砕けて光がこぼれる (吸い込む息 → 鈴の上行 → きらめき)
  appraiseOk: { vars: 1, vol: 0.55, rev: 0.5, gen(r) {
    const n = len(1.8), x = new Float32Array(n);
    mixInto(x, whoosh(r, 0.16, 1500, 8000, 6000, 1.6, 0.92), 0, 0.35);
    const at = 0.13;
    const sh = burst(r, 0.05, 0.03); applyBq(sh, "bp", 5200, 1.5, SR); mixInto(x, sh, len(at), 0.5); // 封が砕ける
    [880, 1108.73, 1318.51, 1760, 2217.46].forEach((f, k2) => mixInto(x, modal(SR, 1.4, [[f, 1, 1.1], [f * 1.003, 0.5, 1.2], [f * 2.76, 0.1, 0.25], [f * 5.4, 0.04, 0.1]]), len(at + 0.055 * k2), 0.26));
    const pad = sweep(1.5, () => 220, 1.1, 0.04); mixInto(x, pad, len(at), 0.22);
    mixInto(x, sweep(1.5, () => 277.18, 1.0, 0.06), len(at), 0.12);
    for (let k2 = 0; k2 < 14; k2++) {
      const f = 3200 + r() * 4500, t = at + 0.05 + Math.pow(r(), 1.4) * 0.9;
      mixInto(x, modal(SR, 0.35, [[f, 1, 0.18 + r() * 0.12], [f * 1.49, 0.4, 0.1]]), len(t), 0.07 + r() * 0.06);
    }
    const air = white(n, r); hp1(air, 6500, SR);
    for (let i = 0; i < n; i++) { const t = i / SR; air[i] *= t < at ? 0 : Math.exp(-(t - at) / 0.4) * 0.12; }
    mixInto(x, air, 0, 1);
    return haas(x, 10);
  } },
  // 鑑定失敗: 水晶の響きが下へ折れて曇り、鈍く閉ざされる (半音の濁り + くぐもった落下)
  appraiseNg: { vars: 1, vol: 0.5, rev: 0.35, gen(r) {
    const n = len(1.3), x = new Float32Array(n);
    const bend = sweep(1.0, (t) => 622.25 - 90 * Math.min(1, t / 0.5), 0.55, 0.003);
    mixInto(x, bend, 0, 0.3);
    mixInto(x, modal(SR, 0.8, [[587.33, 0.7, 0.45], [554.37, 0.5, 0.5]]), len(0.04), 0.18);
    const crack = burst(r, 0.03, 0.015); applyBq(crack, "bp", 2400, 2.5, SR); mixInto(x, crack, 0, 0.35); // ひびの音
    mixInto(x, sweep(0.5, (t) => 44 + 40 * Math.exp(-t / 0.03), 0.3), len(0.08), 0.9);
    const thud = burst(r, 0.2, 0.12); lp1(thud, 380, SR); mixInto(x, thud, len(0.08), 1.0);
    const lo = sweep(1.1, (t) => 110 * Math.pow(0.5, t / 1.2), 0.8, 0.02); mixInto(x, lo, len(0.08), 0.3);
    lp1(x, 3200, SR);
    softClip(x, 1.2);
    return mono(x);
  } },
  // ---- 楽器が未生成の間だけ使う簡易ジングル ----
  _victory: { vars: 1, vol: 0.5, rev: 0.4, gen() {
    const x = new Float32Array(len(2.4));
    const chord = (at, fs, d, a) => fs.forEach((f) => mixInto(x, modal(SR, d + 0.6, [[f, 1, d], [f * 2, 0.4, d * 0.6], [f * 3, 0.2, d * 0.4]]), len(at), a));
    chord(0, [146.8, 220, 293.7, 349.2], 0.5, 0.25); chord(0.55, [233.1, 293.7, 349.2], 0.5, 0.25);
    chord(1.07, [261.6, 329.6, 392], 0.5, 0.25); chord(1.6, [146.8, 293.7, 370, 440, 587.3], 0.9, 0.25);
    return mono(x);
  } },
  _rankup: { vars: 1, vol: 0.5, rev: 0.45, gen() {
    const x = new Float32Array(len(4.4));
    const chord = (at, fs, d, a) => fs.forEach((f) => mixInto(x, modal(SR, d + 0.6, [[f, 1, d], [f * 2, 0.4, d * 0.6], [f * 3, 0.2, d * 0.4]]), len(at), a));
    [0, 0.2, 0.4].forEach((at) => chord(at, [392], 0.18, 0.3));
    chord(0.6, [130.8, 261.6, 329.6, 523.3], 0.6, 0.24);
    chord(1.2, [174.6, 349.2, 440, 523.3], 0.3, 0.24); chord(1.5, [196, 392, 493.9, 587.3], 0.4, 0.24);
    chord(1.9, [130.8, 261.6, 329.6, 392, 523.3, 659.3], 1.8, 0.24);
    [1046.5, 1318.5, 1568, 2093].forEach((f, k) => mixInto(x, modal(SR, 1.2, [[f, 1, 0.8], [f * 2.76, 0.1, 0.2]]), len(1.9 + k * 0.12), 0.2));
    return mono(x);
  } },
  _levelup: { vars: 1, vol: 0.42, rev: 0.45, gen() {
    const x = new Float32Array(len(1.6));
    [349.2, 440, 523.3, 698.5, 880, 1046.5].forEach((f, k) => mixInto(x, modal(SR, 1.2, [[f, 1, 0.8], [f * 2.76, 0.1, 0.2]]), len(k * 0.07), 0.3));
    return mono(x);
  } },
  _itemget: { vars: 1, vol: 0.4, rev: 0.45, gen() {
    const x = new Float32Array(len(1.3));
    [880, 1174.7, 1396.9, 1760].forEach((f, k) => mixInto(x, modal(SR, 1.0, [[f, 1, 0.7], [f * 6.27, 0.15, 0.1]]), len(k * 0.08), 0.35));
    return mono(x);
  } },
  _gameover: { vars: 1, vol: 0.5, rev: 0.5, gen(r) {
    const x = new Float32Array(len(3.5));
    mixInto(x, sweep(2.5, (t) => 30 + 30 * Math.exp(-t / 0.3), 1.6), 0, 1);
    [220, 196, 174.6, 164.8, 146.8].forEach((f, k) => mixInto(x, modal(SR, 1.6, [[f, 1, 1.2], [f * 2, 0.3, 0.6]]), len(0.45 * k), 0.3));
    return mono(x);
  } },
};

const CACHE = new Map();
// 効果音のバッファ (揺らぎのうち1つをランダムに)。ctx は AudioBuffer 作成用
export function sfxBuffer(name, ctx) {
  const def = SFX_DEFS[name];
  if (!def) return null;
  let arr = CACHE.get(name);
  if (!arr) {
    arr = [];
    for (let v = 0; v < (def.vars || 1); v++) {
      const r = rng(0x5f0 + v * 977 + name.length * 31 + name.charCodeAt(0));
      const g = def.gen(r);
      const b = ctx.createBuffer(g.ch.length, g.ch[0].length, g.sr);
      g.ch.forEach((c, i) => b.getChannelData(i).set(c));
      arr.push(b);
    }
    CACHE.set(name, arr);
  }
  return arr[Math.floor(Math.random() * arr.length)];
}
export function sfxDef(name) { return SFX_DEFS[name]; }
