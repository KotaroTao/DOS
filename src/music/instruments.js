// 楽器定義 — すべてコードで合成する (外部音源なし)
// 各楽器は「音域ゾーンごとの短いサンプル」を生成し、再生時に playbackRate で音程を合わせる。
//  kind "sus": 持続音 (PADsynth の完全ループ。合唱・弦・オルガン・パッドなど)
//  kind "one": 単発音 (撥弦・鐘・打楽器・環境音。variants 個の揺らぎを持てる)
// gen() は純粋計算なので、ワーカーでもメインスレッドでも同じ結果になる。
import {
  padsynth, sawPartials, bodyEnv, softLP, softHP, rng, hashStr, mtof,
  pluck, modal, white, pink, brown, envExp, fadeEdges, mixInto, peakNorm, softClip,
  applyBq, lp1, hp1, lpSweep, svfSweep, dcBlock,
} from "./dsp.js";

// ---- 声道フォルマント (カスケード型: 低域は素通し、各フォルマントで山) ----
function vocal(fs) {
  return (f) => {
    let g = 1;
    for (const [F, B] of fs) {
      const d = F * F - f * f;
      g *= (F * F) / Math.sqrt(d * d + f * f * B * B);
    }
    return g;
  };
}
const V_MALE_A = [[700, 90], [1100, 110], [2450, 160], [2950, 220], [3600, 300]];
const V_FEM_A = [[820, 100], [1250, 120], [2800, 180], [3500, 260]];
const V_MALE_O = [[420, 70], [760, 90], [2450, 150], [2900, 220]];
const V_FEM_O = [[470, 80], [850, 100], [2800, 170], [3500, 260]];

const mul = (...fs) => (f) => { let g = 1; for (const e of fs) g *= e(f); return g; };

function padZone(o) {
  const r = padsynth(o);
  return { sr: o.sr, ch: r };
}

// ---- 楽器レジストリ ----
export const INST = {
  // 闇のアナログパッド: デチューンした鋸歯の束。チャンネル側のローパス+LFOで揺らす
  pad: {
    kind: "sus", zones: { lo: 24, hi: 84, step: 12 }, att: 1.2, rel: 2.0, gain: 0.55,
    gen(z, v, seed) {
      const sr = z >= 60 ? 32000 : 24000;
      return padZone({ sr, f0: mtof(z), seed, bw: 32, bwScale: 1,
        partials: sawPartials(180, 1.0, 0.75), env: mul(softLP(2400, 2), softHP(35, 2)) });
    },
  },
  // 地を這う持続低音: 少ない倍音のゆっくりしたうなり
  drone: {
    kind: "sus", zones: { lo: 24, hi: 60, step: 12 }, att: 2.0, rel: 3.0, gain: 0.7,
    gen(z, v, seed) {
      return padZone({ sr: 24000, f0: mtof(z), seed, bw: 7, bwScale: 0.6, mono: true,
        partials: [[1, 1], [2, 0.5], [3, 0.3], [4, 0.14], [5, 0.1], [6, 0.05], [7, 0.03], [8, 0.02]],
        env: softLP(1100, 2) });
    },
  },
  // 合唱「アー」: 低いゾーンは男声、高いゾーンは女声のフォルマント
  choir: {
    kind: "sus", zones: { lo: 41, hi: 85, step: 6 }, att: 0.7, rel: 1.4, vib: 2, gain: 0.55,
    gen(z, v, seed) {
      const fem = z >= 58;
      const voc = vocal(fem ? V_FEM_A : V_MALE_A);
      return padZone({ sr: 32000, f0: mtof(z), seed, bw: 38, bwScale: 1,
        partials: sawPartials(140, 1.0), env: mul(voc, softLP(6000, 2), softHP(fem ? 160 : 70, 2)),
        noise: (f) => voc(f) * softHP(1200, 2)(f) * softLP(7000, 2)(f) * 0.1 });
    },
  },
  // 合唱「オー」: 暗く柔らかい
  choirO: {
    kind: "sus", zones: { lo: 41, hi: 85, step: 6 }, att: 0.9, rel: 1.6, vib: 2, gain: 0.6,
    gen(z, v, seed) {
      const fem = z >= 58;
      const voc = vocal(fem ? V_FEM_O : V_MALE_O);
      return padZone({ sr: 32000, f0: mtof(z), seed, bw: 32, bwScale: 1,
        partials: sawPartials(120, 1.1), env: mul(voc, softLP(4200, 2), softHP(fem ? 150 : 60, 2)),
        noise: (f) => voc(f) * softHP(900, 2)(f) * softLP(5000, 2)(f) * 0.07 });
    },
  },
  // 弦楽合奏 (ヴァイオリン〜ヴィオラ)
  strings: {
    kind: "sus", zones: { lo: 52, hi: 94, step: 6 }, att: 0.35, rel: 0.9, vib: 3, gain: 0.5,
    filt: { lo: 1500, hi: 8000, att: 0.22, sus: 0.88, scoop: 0, curve: 1.0 },
    gen(z, v, seed) {
      return padZone({ sr: 32000, f0: mtof(z), seed, bw: 15, bwScale: 1,
        partials: sawPartials(220, 1.0),
        env: mul(bodyEnv([[290, 0.35, 5], [520, 0.3, 2], [1150, 0.5, -3], [2900, 0.55, 3.5], [5200, 0.5, -6]]), softLP(6500, 2), softHP(190, 2)),
        noise: (f) => softHP(1500, 2)(f) * softLP(6000, 2)(f) * 0.08 });
    },
  },
  // 低弦合奏 (チェロ〜コントラバス)
  lowstr: {
    kind: "sus", zones: { lo: 28, hi: 64, step: 6 }, att: 0.3, rel: 0.9, vib: 2, gain: 0.6,
    gen(z, v, seed) {
      return padZone({ sr: 24000, f0: mtof(z), seed, bw: 12, bwScale: 1, mono: true,
        partials: sawPartials(200, 0.95),
        env: mul(bodyEnv([[110, 0.4, 4], [240, 0.4, 3], [700, 0.5, -2], [1500, 0.5, 3], [3200, 0.5, -4]]), softLP(4500, 2), softHP(32, 2)),
        noise: (f) => softHP(900, 2)(f) * softLP(4000, 2)(f) * 0.06 });
    },
  },
  // 低い金管 (ホルン・トロンボーン・テューバの合奏)。声部ごとのローパスで吹き込みを表現
  brass: {
    kind: "sus", zones: { lo: 34, hi: 76, step: 6 }, att: 0.06, rel: 0.35, vib: 2, gain: 0.55,
    filt: { lo: 260, hi: 3600, att: 0.09, sus: 0.62, scoop: -28 },
    gen(z, v, seed) {
      const parts = [];
      for (let h = 1; h <= 60; h++) parts.push([h, 1 / Math.pow(h, 0.55)]);
      return padZone({ sr: 24000, f0: mtof(z), seed, bw: 6, bwScale: 1, mono: true,
        partials: parts, env: mul(bodyEnv([[480, 0.5, 3], [1100, 0.6, 3], [2600, 0.5, -2]]), softLP(3600, 2), softHP(45, 2)) });
    },
  },
  // 大聖堂のパイプオルガン (16'+8'+4'+2 2/3'+2'+ミクスチュア)
  organ: {
    kind: "sus", zones: { lo: 24, hi: 84, step: 12 }, att: 0.06, rel: 0.35, gain: 0.42,
    gen(z, v, seed) {
      const m = new Map();
      const add = (r, a) => m.set(r, (m.get(r) || 0) + a);
      for (let h = 1; h <= 16; h++) add(h, (h === 2 ? 0.7 : 1) / Math.pow(h, 1.25)); // 8' プリンシパル
      add(0.5, 0.75); add(1.5, 0.16); add(2.5, 0.07);                               // 16' ブルドン
      for (const h of [2, 4, 6, 8]) add(h, 0.4 / h);                                  // 4' オクターヴ
      add(3, 0.22); add(4, 0.2);                                                     // 2 2/3', 2'
      for (const h of [6, 8, 12, 16]) add(h, 0.09);                                  // ミクスチュア
      return padZone({ sr: z >= 60 ? 32000 : 24000, f0: mtof(z), seed, bw: 4, bwScale: 1, mono: z < 48,
        partials: [...m.entries()], env: mul(softLP(6500, 2), softHP(28, 2)),
        noise: (f) => softLP(2500, 1)(f) * 0.05 });
    },
  },
  // 柔らかいフルート管 (祠・宿の静けさ)
  organSoft: {
    kind: "sus", zones: { lo: 36, hi: 96, step: 12 }, att: 0.12, rel: 0.5, gain: 0.5,
    gen(z, v, seed) {
      return padZone({ sr: 32000, f0: mtof(z), seed, bw: 3, bwScale: 1,
        partials: [[0.5, 0.2], [1, 1], [2, 0.3], [3, 0.2], [4, 0.07], [5, 0.04], [6, 0.02]],
        env: softLP(4000, 2), noise: (f) => softLP(3000, 1)(f) * softHP(400, 1)(f) * 0.25 });
    },
  },
  // 独奏フィドル (酒場の哀歌)。声部ごとにヴィブラート
  fiddle: {
    kind: "sus", zones: { lo: 55, hi: 91, step: 6 }, att: 0.07, rel: 0.25, vib: 0, ownVib: 16, gain: 0.42,
    gen(z, v, seed) {
      return padZone({ sr: 32000, f0: mtof(z), seed, bw: 1.2, bwScale: 1,
        partials: sawPartials(200, 0.85),
        env: mul(bodyEnv([[280, 0.3, 6], [460, 0.3, 2], [1100, 0.45, -4], [2500, 0.4, 4.5], [3300, 0.3, 2], [5200, 0.5, -8]]), softLP(6500, 2), softHP(200, 2)),
        noise: (f) => softHP(2000, 2)(f) * softLP(7000, 2)(f) * 0.08 });
    },
  },
  // 洞窟の空気・風 (色付き雑音の完全ループ)
  wind: {
    kind: "sus", fixed: 60, att: 2.5, rel: 3.0, gain: 0.8,
    gen(z, v, seed) {
      return padZone({ sr: 24000, n: 131072, f0: 100, seed, partials: [],
        noise: (f) => 1 / (1 + Math.pow(f / 350, 1.4)) * softHP(40, 1)(f) * 40 });
    },
  },

  // ---- 撥弦 ----
  harp: {
    kind: "one", zones: { lo: 36, hi: 96, step: 4 }, gain: 0.55, rel: 0.4,
    gen(z, v, seed) {
      const f = mtof(z), sr = z < 72 ? 24000 : 32000;
      const t60 = Math.max(1.3, Math.min(7, 5.5 * Math.pow(110 / f, 0.45)));
      const x = pluck({ sr, f0: f, dur: Math.min(3.6, t60 * 0.8 + 0.5), t60, bright: 0.32, pick: 0.27, soft: 0.85, seed });
      applyBq(x, "peak", 220, 1.0, sr, 2);
      lp1(x, 7500, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.2)] };
    },
  },
  lute: {
    kind: "one", zones: { lo: 40, hi: 84, step: 4 }, gain: 0.65, rel: 0.25,
    gen(z, v, seed) {
      const f = mtof(z), sr = 24000;
      const t60 = Math.max(0.9, Math.min(4, 3.0 * Math.pow(110 / f, 0.4)));
      const x = pluck({ sr, f0: f, dur: 2.2, t60, bright: 0.55, pick: 0.17, soft: 0.35, seed, courses: [-2.5, 2.5] });
      applyBq(x, "peak", 105, 1.4, sr, 5);
      applyBq(x, "peak", 230, 1.6, sr, 4);
      applyBq(x, "peak", 420, 2.0, sr, 3);
      applyBq(x, "peak", 1900, 1.0, sr, -3);
      hp1(x, 70, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.3)] };
    },
  },
  // ハープシコード風 (8'+4' の明るい爪弾き)
  harpsi: {
    kind: "one", zones: { lo: 41, hi: 89, step: 4 }, gain: 0.9, rel: 0.12,
    gen(z, v, seed) {
      const f = mtof(z), sr = 32000;
      const t60 = Math.max(0.8, Math.min(3.5, 2.6 * Math.pow(220 / f, 0.5)));
      const a = pluck({ sr, f0: f, dur: 2.6, t60, bright: 0.85, pick: 0.07, soft: 0.35, seed });
      const b = pluck({ sr, f0: f * 2, dur: 2.6, t60: t60 * 0.7, bright: 0.8, pick: 0.09, soft: 0.35, seed: seed + 3 });
      mixInto(a, b, 0, 0.35);
      const r = rng(seed + 9);
      const click = white(Math.round(sr * 0.006), r);
      hp1(click, 2500, sr); lp1(click, 7000, sr); envExp(click, sr, 0.006);
      mixInto(a, click, 0, 0.15);
      applyBq(a, "peak", 260, 1.2, sr, 3);
      applyBq(a, "peak", 620, 1.5, sr, 2);
      hp1(a, 90, sr);
      lp1(a, 9000, sr);
      return { sr, ch: [fadeEdges(peakNorm(a, 0.9), sr, 0.0003, 0.3)] };
    },
  },
  // 低弦のピッツィカート
  pizz: {
    kind: "one", zones: { lo: 28, hi: 64, step: 4 }, gain: 0.6, rel: 0.15,
    gen(z, v, seed) {
      const f = mtof(z), sr = 24000;
      const t60 = Math.max(0.5, Math.min(1.6, 1.1 * Math.pow(110 / f, 0.3)));
      const x = pluck({ sr, f0: f, dur: 1.5, t60, bright: 0.25, pick: 0.22, soft: 0.75, seed, courses: [-3, 0, 4] });
      applyBq(x, "peak", 115, 1.2, sr, 4);
      applyBq(x, "peak", 250, 1.4, sr, 3);
      lp1(x, 3500, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.2)] };
    },
  },

  // ---- 鍵盤・金属 ----
  celesta: {
    kind: "one", zones: { lo: 60, hi: 108, step: 6 }, gain: 0.4, rel: 0.3,
    gen(z, v, seed) {
      const f = mtof(z), sr = 32000;
      const t = Math.max(0.8, 2.6 * Math.pow(523 / f, 0.35));
      const x = modal(sr, 3.2, [[f, 1, t], [f * 2, 0.07, t * 0.4], [f * 2.76, 0.1, 0.35], [f * 5.4, 0.04, 0.12], [f * 1.002, 0.25, t * 1.2]]);
      const r = rng(seed);
      const h = white(Math.round(sr * 0.005), r); lp1(h, 3000, sr); envExp(h, sr, 0.005);
      mixInto(x, h, 0, 0.15);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.2)] };
    },
  },
  musicbox: {
    kind: "one", zones: { lo: 60, hi: 108, step: 6 }, gain: 0.38, rel: 0.3,
    gen(z, v, seed) {
      const f = mtof(z), sr = 32000;
      const t = Math.max(0.7, 2.3 * Math.pow(880 / f, 0.3));
      const x = modal(sr, 3.0, [[f, 1, t], [f * 1.0015, 0.35, t * 0.9], [f * 2, 0.05, t * 0.5], [f * 6.27, 0.22, 0.12], [f * 17.55, 0.05, 0.03]]);
      const r = rng(seed);
      const c = white(Math.round(sr * 0.004), r); hp1(c, 4000, sr); envExp(c, sr, 0.004);
      mixInto(x, c, 0, 0.12);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0002, 0.2)] };
    },
  },
  // 教会の大鐘 (打音=ノミナル。ハム・プライム・短三度のティアスが重なり、対の周波数でうなる)
  bell: {
    kind: "one", zones: { lo: 36, hi: 84, step: 6 }, gain: 0.5, rel: 1.0,
    gen(z, v, seed) {
      const N = mtof(z), sr = z < 66 ? 24000 : 32000;
      const k = Math.max(0.55, Math.min(1.6, Math.pow(262 / N, 0.4)));
      const P = [[0.25, 0.55, 10], [0.5, 0.5, 8], [0.6, 0.6, 6], [0.75, 0.25, 4], [1, 0.8, 4.5], [1.25, 0.3, 2.5], [1.5, 0.28, 2], [2, 0.2, 1.5], [2.61, 0.12, 1], [3.2, 0.08, 0.8]];
      const modes = [];
      for (const [r, a, t] of P) {
        modes.push([N * r, a * 0.6, t * k]);
        modes.push([N * r * 1.0013, a * 0.4, t * k * 0.95, 0, 1.3]);
      }
      const dur = Math.min(6.5, 5 * k + 1);
      const x = modal(sr, dur, modes);
      const rr = rng(seed);
      const s = white(Math.round(sr * 0.03), rr); applyBq(s, "bp", 3200, 1.2, sr); envExp(s, sr, 0.03);
      mixInto(x, s, 0, 0.25);
      hp1(x, 35, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.5)] };
    },
  },
  // 祠の鉢・手鐘 (非整数倍音がゆらぐ、不気味な聖性)
  bowl: {
    kind: "one", zones: { lo: 55, hi: 91, step: 6 }, gain: 0.42, rel: 1.0,
    gen(z, v, seed) {
      const f = mtof(z), sr = 32000;
      const P = [[1, 1, 6], [2.71, 0.45, 3.5], [5.15, 0.22, 2], [8.43, 0.08, 1.2]];
      const modes = [];
      for (const [r, a, t] of P) { modes.push([f * r, a * 0.55, t]); modes.push([f * r * (1 + 0.004 / r), a * 0.45, t, 0, 2]); }
      const x = modal(sr, 5, modes);
      const rr = rng(seed);
      const s = white(Math.round(sr * 0.01), rr); lp1(s, 2000, sr); envExp(s, sr, 0.01);
      mixInto(x, s, 0, 0.1);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.001, 0.5)] };
    },
  },
  // 物悲しいピアノ (弦の非調和性・3本弦のうなり・二段減衰)
  piano: {
    kind: "one", zones: { lo: 33, hi: 93, step: 4 }, gain: 0.8, rel: 0.35,
    gen(z, v, seed) {
      const f0 = mtof(z), sr = z < 69 ? 24000 : 32000;
      const B = 0.00025 * Math.pow(f0 / 261.6, 0.6);
      const dur = Math.max(2.2, Math.min(4.2, 3.8 * Math.pow(261.6 / f0, 0.35)));
      const tLong = Math.min(14, 9 * Math.pow(261.6 / f0, 0.6)), tShort = tLong * 0.18;
      const modes = [];
      const rp = rng(seed + 77);
      const lpf = softLP(Math.min(5200, 1800 + f0 * 3), 2);
      for (let n = 1; n <= 28; n++) {
        const fn = n * f0 * Math.sqrt(1 + B * n * n);
        if (fn > sr * 0.45) break;
        const a = (1 / Math.pow(n, 0.75)) * (0.25 + Math.abs(Math.sin(Math.PI * n / 8))) * lpf(fn);
        const tn = 1 / (1 + n * 0.25);
        for (const c of [-1.1, 0, 1.3]) {
          const fc = fn * Math.pow(2, c / 1200);
          const ph = rp() * 6.283;
          modes.push([fc, a * 0.22, tShort * tn, 0, ph]);
          modes.push([fc, a * 0.11, tLong * tn, 0, ph]);
        }
      }
      const x = modal(sr, dur, modes);
      const r = rng(seed);
      const h = white(Math.round(sr * 0.012), r); lp1(h, 1500, sr); envExp(h, sr, 0.012);
      mixInto(x, h, 0, 0.06);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.3)] };
    },
  },
  // スピッカート (低弦の短く刻む弓)
  spicc: {
    kind: "one", zones: { lo: 28, hi: 88, step: 4 }, gain: 0.85, rel: 0.06,
    gen(z, v, seed) {
      const sr = 24000;
      const low = z < 55;
      const [L] = padsynth({ n: 32768, sr, f0: mtof(z), seed, bw: 5, bwScale: 1, mono: true, rms: 0.25,
        partials: sawPartials(160, 0.95),
        env: low ? mul(bodyEnv([[110, 0.4, 4], [240, 0.4, 3], [700, 0.5, -2], [1500, 0.5, 4]]), softLP(5000, 2), softHP(35, 2))
          : mul(bodyEnv([[290, 0.35, 5], [1150, 0.5, -3], [2900, 0.55, 5]]), softLP(8000, 2), softHP(180, 2)) });
      const len = Math.round(sr * 0.6);
      const x = L.slice(0, len);
      const a = Math.round(sr * 0.006);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const e = (i < a ? i / a : 1) * (0.35 + 0.65 * Math.exp(-t / 0.05)) * Math.exp(-t / 0.22);
        x[i] *= e * 1.6;
      }
      const r = rng(seed + 5);
      const bow = white(Math.round(sr * 0.03), r); applyBq(bow, "bp", low ? 1400 : 2600, 1.0, sr); envExp(bow, sr, 0.03, 0.002);
      mixInto(x, bow, 0, 0.18);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.05)] };
    },
  },

  // ---- 打楽器 ----
  timp: {
    kind: "one", zones: { lo: 32, hi: 56, step: 4 }, variants: 2, gain: 0.5, rel: 0.3,
    gen(z, v, seed) {
      const f = mtof(z), sr = 24000, dur = 2.5;
      const len = Math.round(sr * dur);
      const x = new Float32Array(len);
      // 基音と第2・第3モードは打撃直後にわずかに高く、すぐ落ち着く
      const glide = [[1, 1, 2.6], [1.504, 0.5, 1.4], [1.742, 0.22, 0.9]];
      for (const [r, a, t60] of glide) {
        let ph = 0;
        const k = -6.9078 / (t60 * sr);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const fr = f * r * (1 + 0.018 * Math.exp(-t / 0.12));
          ph += 6.283185307 * fr / sr;
          x[i] += Math.sin(ph) * a * Math.exp(k * i);
        }
      }
      modal(sr, dur, [[f * 2, 0.25, 1.0], [f * 2.245, 0.13, 0.7], [f * 2.494, 0.1, 0.6], [f * 2.8, 0.07, 0.5], [f * 2.98, 0.05, 0.4]], x);
      const r = rng(seed + v * 31);
      const m = white(Math.round(sr * 0.04), r); lp1(m, 900 + v * 500, sr); lp1(m, 1400, sr); envExp(m, sr, 0.04);
      mixInto(x, m, 0, 1.4);
      softClip(x, 1.2);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.4)] };
    },
  },
  taiko: {
    kind: "one", fixed: 36, variants: 3, gain: 0.85, rel: 0.2,
    gen(z, v, seed) {
      const sr = 24000, dur = 1.15, len = Math.round(sr * dur);
      const r = rng(seed + v * 17);
      const x = new Float32Array(len);
      const f1 = 100 + r() * 12, f2 = 56 + r() * 5;
      let ph = 0, ph2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = f2 + (f1 - f2) * Math.exp(-t / 0.055);
        ph += 6.283185307 * f / sr; ph2 += 6.283185307 * f * 1.58 / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.32) + Math.sin(ph2) * 0.25 * Math.exp(-t / 0.12);
      }
      const n = white(Math.round(sr * 0.25), r); lp1(n, 650, sr); lp1(n, 650, sr); envExp(n, sr, 0.22);
      mixInto(x, n, 0, 1.6);
      const c = white(Math.round(sr * 0.015), r); applyBq(c, "bp", 1500, 1.0, sr); envExp(c, sr, 0.015);
      mixInto(x, c, 0, 0.35);
      softClip(x, 1.6);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.3)] };
    },
  },
  taikoS: {
    kind: "one", fixed: 48, variants: 3, gain: 0.95, rel: 0.1,
    gen(z, v, seed) {
      const sr = 32000, dur = 0.5, len = Math.round(sr * dur);
      const r = rng(seed + v * 23);
      const x = new Float32Array(len);
      const f1 = 260 + r() * 25, f2 = 185 + r() * 10;
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += 6.283185307 * (f2 + (f1 - f2) * Math.exp(-t / 0.02)) / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.09);
      }
      const c = white(Math.round(sr * 0.05), r); applyBq(c, "bp", 2300, 0.8, sr); envExp(c, sr, 0.04);
      mixInto(x, c, 0, 0.9);
      softClip(x, 1.4);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.1)] };
    },
  },
  // 映画的な重低音の衝撃
  boom: {
    kind: "one", fixed: 24, variants: 2, gain: 0.9, rel: 0.5,
    gen(z, v, seed) {
      const sr = 24000, dur = 3.2, len = Math.round(sr * dur);
      const r = rng(seed + v * 41);
      const x = new Float32Array(len);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += 6.283185307 * (31 + 34 * Math.exp(-t / 0.35)) / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.9);
      }
      const b = white(Math.round(sr * 0.8), r); lp1(b, 240, sr); lp1(b, 240, sr); envExp(b, sr, 0.7, 0.002);
      mixInto(x, b, 0, 2.2);
      const rum = brown(len, r); lp1(rum, 140, sr); envExp(rum, sr, 3.5, 0.05);
      mixInto(x, rum, 0, 0.5);
      const c = white(Math.round(sr * 0.03), r); applyBq(c, "bp", 900, 0.9, sr); envExp(c, sr, 0.03);
      mixInto(x, c, 0, 0.5);
      softClip(x, 2.0);
      hp1(x, 22, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.6)] };
    },
  },
  // シンバルの逆回し的なふくらみ (終端が拍に合うよう配置する)
  swell: {
    kind: "one", fixed: 60, gain: 0.7, rel: 0.05, len: 2.7,
    gen(z, v, seed) {
      const sr = 32000, dur = 2.7, len = Math.round(sr * dur);
      const r = rng(seed);
      const x = white(len, r);
      const y = white(len, r);
      hp1(x, 3500, sr); svfSweep(y, sr, (t) => 1500 + 5000 * (t / dur), 2.5);
      for (let i = 0; i < len; i++) {
        const p = i / len;
        x[i] = (x[i] * 0.7 + y[i] * 0.5) * Math.pow(p, 3.2);
      }
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.01, 0.012)] };
    },
  },
  crash: {
    kind: "one", fixed: 60, variants: 2, gain: 0.6, rel: 0.6,
    gen(z, v, seed) {
      const sr = 32000, dur = 3.6, len = Math.round(sr * dur);
      const r = rng(seed + v * 13);
      const x = white(len, r);
      const metal = new Float32Array(len);
      const fs = [317, 431, 563, 729, 891, 1123].map((f) => f * (1 + r() * 0.04));
      const ph = fs.map(() => r());
      for (let i = 0; i < len; i++) {
        let s = 0;
        for (let k = 0; k < fs.length; k++) { const p = (ph[k] + fs[k] * i / sr) % 1; s += p < 0.5 ? 1 : -1; }
        metal[i] = s / fs.length;
      }
      mixInto(x, metal, 0, 0.7);
      hp1(x, 450, sr); hp1(x, 450, sr);
      lpSweep(x, sr, (t) => 2600 + 11000 * Math.exp(-t / 0.9));
      envExp(x, sr, 3.2, 0.001);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.5)] };
    },
  },
  // 銅鑼 (タムタム): 高い成分ほど遅れて膨らむ
  tamtam: {
    kind: "one", fixed: 36, gain: 0.55, rel: 1.0,
    gen(z, v, seed) {
      const sr = 24000, dur = 6, r = rng(seed);
      const modes = [];
      for (let k = 0; k < 70; k++) {
        const f = 55 * Math.pow(2, r() * 5.6);
        const oct = Math.log2(f / 55);
        modes.push([f, (0.6 + r() * 0.4) / Math.pow(1 + oct, 0.9), 2.5 + r() * 4.5 - oct * 0.25, 0.02 + oct * 0.12 * r(), r() * 6.28]);
      }
      const x = modal(sr, dur, modes);
      let ph = 0;
      for (let i = 0; i < sr * 1.2; i++) { const t = i / sr; ph += 6.283185307 * (62 + 20 * Math.exp(-t / 0.05)) / sr; x[i] += Math.sin(ph) * Math.exp(-t / 0.35) * 1.4; }
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.001, 0.8)] };
    },
  },
  frame: { // 枠太鼓 (低い胴)
    kind: "one", fixed: 40, variants: 3, gain: 0.7, rel: 0.08,
    gen(z, v, seed) {
      const sr = 24000, dur = 0.6, len = Math.round(sr * dur);
      const r = rng(seed + v * 7);
      const x = new Float32Array(len);
      let ph = 0;
      const f1 = 98 + r() * 10;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += 6.283185307 * (f1 * 0.72 + f1 * 0.28 * Math.exp(-t / 0.03)) / sr; x[i] = Math.sin(ph) * Math.exp(-t / 0.14); }
      const n = white(Math.round(sr * 0.12), r); lp1(n, 900, sr); envExp(n, sr, 0.09);
      mixInto(x, n, 0, 0.8);
      softClip(x, 1.3);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0003, 0.08)] };
    },
  },
  frameS: { // 枠太鼓の縁打ち
    kind: "one", fixed: 52, variants: 3, gain: 1.6, rel: 0.05,
    gen(z, v, seed) {
      const sr = 32000, dur = 0.3;
      const r = rng(seed + v * 11);
      const x = modal(sr, dur, [[340 + r() * 30, 0.6, 0.12], [610 + r() * 40, 0.4, 0.08], [1180, 0.2, 0.05]]);
      const n = white(Math.round(sr * 0.05), r); applyBq(n, "bp", 1700 + r() * 400, 1.1, sr); envExp(n, sr, 0.045);
      mixInto(x, n, 0, 1.2);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0002, 0.05)] };
    },
  },
  shaker: { // タンバリン風の鈴
    kind: "one", fixed: 72, variants: 3, gain: 0.7, rel: 0.05,
    gen(z, v, seed) {
      const sr = 32000, dur = 0.25;
      const r = rng(seed + v * 19);
      const modes = [];
      for (let k = 0; k < 8; k++) modes.push([5000 + r() * 4500, 0.2, 0.08 + r() * 0.08, 0, r() * 6]);
      const x = modal(sr, dur, modes);
      const n = white(Math.round(sr * dur), r); hp1(n, 6000, sr); envExp(n, sr, 0.07, 0.003);
      mixInto(x, n, 0, 0.8);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.002, 0.03)] };
    },
  },

  // ---- 迷宮の環境音 ----
  creak: { // 朽ちた扉・梁のきしみ (固着すべり振動)
    kind: "one", fixed: 60, variants: 3, gain: 0.55, rel: 0.2,
    gen(z, v, seed) {
      const sr = 24000, dur = 1.6, len = Math.round(sr * dur);
      const r = rng(seed + v * 29);
      const ex = new Float32Array(len);
      const a = 30 + r() * 25, b = 70 + r() * 60, c = 40 + r() * 30;
      let t = 0.05;
      while (t < dur - 0.15) {
        const p = t / dur;
        const rate = p < 0.5 ? a + (b - a) * (p / 0.5) : b + (c - b) * ((p - 0.5) / 0.5);
        const i = Math.round(t * sr);
        const e = Math.sin(Math.PI * Math.min(1, p * 1.15)) * (0.6 + r() * 0.4);
        if (i < len) ex[i] += e;
        t += (1 / rate) * (0.8 + r() * 0.4);
      }
      const out = new Float32Array(len);
      for (const [f, q, g] of [[380, 14, 1], [860, 12, 0.8], [1650, 9, 0.5], [2900, 6, 0.25]]) {
        const y = ex.slice(); applyBq(y, "bp", f * (0.9 + r() * 0.2), q, sr); mixInto(out, y, 0, g);
      }
      return { sr, ch: [fadeEdges(peakNorm(out, 0.9), sr, 0.01, 0.1)] };
    },
  },
  chain: { // 遠くで鳴る鎖
    kind: "one", fixed: 60, variants: 2, gain: 0.4, rel: 0.2,
    gen(z, v, seed) {
      const sr = 32000, dur = 1.4, len = Math.round(sr * dur);
      const r = rng(seed + v * 37);
      const x = new Float32Array(len);
      let t = 0.01;
      const nk = 9 + Math.floor(r() * 6);
      for (let k = 0; k < nk && t < dur - 0.25; k++) {
        const f = 2100 + r() * 1800, amp = 0.4 + r() * 0.6;
        const clink = modal(sr, 0.25, [[f, 1, 0.08 + r() * 0.1], [f * 1.48, 0.6, 0.07], [f * 2.31, 0.4, 0.05], [f * 3.9, 0.2, 0.03]]);
        mixInto(x, clink, Math.round(t * sr), amp);
        t += 0.02 + Math.pow(r(), 1.5) * 0.11;
      }
      const n = white(len, r); applyBq(n, "bp", 2500, 0.7, sr);
      for (let i = 0; i < len; i++) n[i] *= Math.sin(Math.PI * Math.min(1, i / (t * sr))) * 0.08;
      mixInto(x, n, 0, 1);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.001, 0.15)] };
    },
  },
  breath: { // 死者の吐息 (声道フォルマントを通した囁き)
    kind: "one", fixed: 60, variants: 2, gain: 0.4, rel: 0.4,
    gen(z, v, seed) {
      const sr = 24000, dur = 3.2, len = Math.round(sr * dur);
      const r = rng(seed + v * 43);
      const src = pink(len, r);
      const out = new Float32Array(len);
      const fs = v ? [[420, 5], [780, 6], [2500, 7]] : [[680, 5], [1100, 6], [2500, 7]];
      for (const [f, q] of fs) { const y = src.slice(); applyBq(y, "bp", f, q, sr); mixInto(out, y, 0, 1); }
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const e = t < 1.1 ? Math.pow(t / 1.1, 2) : Math.exp(-(t - 1.1) / 0.6);
        out[i] *= e * (0.85 + 0.15 * Math.sin(t * 9));
      }
      return { sr, ch: [fadeEdges(peakNorm(out, 0.9), sr, 0.01, 0.2)] };
    },
  },
  drip: {
    kind: "one", fixed: 72, variants: 3, gain: 0.55, rel: 0.05,
    gen(z, v, seed) {
      const sr = 32000, dur = 0.35, len = Math.round(sr * dur);
      const r = rng(seed + v * 53);
      const x = new Float32Array(len);
      const f0 = 700 + r() * 500, f1 = f0 * (2.2 + r() * 0.6);
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += 6.283185307 * (f0 + (f1 - f0) * Math.min(1, t / 0.02)) / sr;
        x[i] = Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.001);
      }
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.05)] };
    },
  },
  heart: { // 鼓動
    kind: "one", fixed: 30, gain: 0.8, rel: 0.1,
    gen(z, v, seed) {
      const sr = 24000, dur = 1.0, len = Math.round(sr * dur);
      const x = new Float32Array(len);
      for (const [at, a] of [[0, 1], [0.27, 0.65]]) {
        let ph = 0;
        const s = Math.round(at * sr);
        for (let i = s; i < len; i++) {
          const t = (i - s) / sr;
          ph += 6.283185307 * (44 + 30 * Math.exp(-t / 0.04)) / sr;
          x[i] += Math.sin(ph) * Math.exp(-t / 0.11) * a * Math.min(1, t / 0.004);
        }
      }
      lp1(x, 160, sr);
      return { sr, ch: [fadeEdges(peakNorm(x, 0.9), sr, 0.0005, 0.1)] };
    },
  },
};

// 楽器と音高 → 使うゾーン
export function zoneOf(def, m) {
  if (def.fixed != null) return def.fixed;
  const { lo, hi, step } = def.zones;
  const top = lo + Math.floor((hi - lo) / step) * step;
  const z = lo + Math.round((m - lo) / step) * step;
  return Math.max(lo, Math.min(top, z));
}
export const zoneKey = (inst, z, v = 0) => `${inst}:${z}:${v}`;

// サンプル1つを生成 (ワーカー/メイン共通)
export function generateZone(key) {
  const [inst, zs, vs] = key.split(":");
  const def = INST[inst];
  if (!def) throw new Error("unknown instrument " + inst);
  const z = +zs, v = +vs || 0;
  const seed = hashStr(key);
  const r = def.gen(z, v, seed);
  // 単発音の頭は最低 1ms でなめらかに立ち上げる (ナイキスト付近の段差=クリックを防ぐ)
  if (def.kind === "one") {
    const n = Math.max(2, Math.round(r.sr * 0.001));
    for (const c of r.ch) for (let i = 0; i < n && i < c.length; i++) c[i] *= Math.sin(Math.PI / 2 * i / n);
  }
  return { key, sr: r.sr, ch: r.ch };
}
