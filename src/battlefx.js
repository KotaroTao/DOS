// 戦闘の演出 (武器・属性・状態異常ごとのエフェクト)。描画だけを受け持ち、戦闘の進行・時間配分には関わらない。
// game.js の applyImpact が着弾の瞬間に spawn* で積み、drawEffects が毎フレーム drawBattleFx を呼ぶ。
// テンポの約束: どのエフェクトも animateResult の余韻 (360ms × spdMul) の内に収まる長さ (base × spd) で描き切る —
// 演出を足しても一手の時間は延ばさない。粒子は fillRect 中心・一つの効果につき数十粒までに抑える。

// 属性ごとの3色 (芯の白み / 本色 / 影色)
export const ELEM_FX_COL = {
  fire:  ["#fff2c0", "#ff8a3c", "#c8301a"],
  water: ["#e6f8ff", "#4fb4ff", "#1a5aa8"],
  wind:  ["#f0fff4", "#7fe0a8", "#2f9a6a"],
  earth: ["#fff0d0", "#c89a5a", "#6a4a2a"],
  light: ["#ffffff", "#ffe9a0", "#d8b040"],
  dark:  ["#f0d0ff", "#a050e0", "#3a1060"],
  none:  ["#ffffff", "#b06bff", "#5a2aa0"],
};
const elCol = (el) => ELEM_FX_COL[el] || ELEM_FX_COL.none;

// 再現性のある疑似乱数 (同じ効果は毎フレーム同じ粒の配置)
const r01 = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function rgba(hex, a) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - (1 - t) * (1 - t);

// 武器の分類 → 物理の演出 (長剣・素手以外)。長剣は game.js 既存の三日月の斬撃
export function weaponFxStyle(weapon) {
  const c = weapon && weapon.cat;
  return c === "dg" ? "cross" : c === "kt" ? "iai" : c === "sp" ? "thrust" : c === "ax" || c === "mc" ? "smash"
    : c === "bw" ? "arrow" : c === "st" ? "blunt" : c === "ls" ? "slash" : weapon ? "slash" : "blunt";
}

// 状態異常の浮き文字 (「魅了!」など) → 演出の種類
export function statusFxKind(status) {
  const s = String(status || "");
  return /魅/.test(s) ? "charm" : /混/.test(s) ? "confuse" : /眠/.test(s) ? "sleep" : /麻/.test(s) ? "para"
    : /毒/.test(s) ? "poison" : /封/.test(s) ? "hex" : null;
}

// 効果を積む: list = G.fx.skill。dur は spd を掛けた実時間 (ms)
export function spawnFx(list, type, x, y, t0, spd, o = {}) {
  const base = BASE_DUR[type] || 300;
  list.push({ type, x, y, t0, dur: o.dur || base * Math.max(0.45, spd), s: o.s || 1, el: o.el || null, crit: !!o.crit, flip: !!o.flip, seed: o.seed || 1, col: o.col || null, trace: !!o.trace,
    v: o.v || 0, rot: o.rot || 0, spin: o.spin || 1, tx: o.tx || 0, ty: o.ty || 0, w: o.w || 0 });
}
const BASE_DUR = {
  cross: 260, iai: 280, thrust: 260, smash: 320, arrow: 300, blunt: 240,
  fire: 340, water: 340, wind: 340, earth: 340, light: 340, dark: 340, none: 320,
  crit: 260, hex: 320, sleep: 300, charm: 300, confuse: 300, para: 280, poison: 300,
  rise: 340, breath: 340, pclaw: 260,
  // 技の組み立て (付く効果の印・全体技・上級の魔法陣)
  drain: 340, pierce: 240, execute: 300, stun: 280, vuln: 320, strip: 320, seal: 320, gravity: 320, steal: 340, doom: 340,
  field: 360, fieldslash: 300, blessing: 360, fieldhex: 340, circle: 300,
};
// 技の角度の揺らぎ (rot) で回してよい効果 (地面に立つもの・画面全体のものは回さない)
const ROTATABLE = new Set(["cross", "iai", "blunt", "crit", "none", "wind", "pierce", "stun", "strip"]);

// 毎フレームの描画。VW/VH は戦場の大きさ
export function drawBattleFx(ctx, list, now, VW, VH, reduced) {
  if (!list || !list.length) return;
  for (const e of list) {
    const t = (now - e.t0) / e.dur;
    if (t < 0 || t > 1) continue;
    const fn = DRAW[e.type];
    if (!fn) continue;
    ctx.save();
    if (e.rot && ROTATABLE.has(e.type)) { ctx.translate(e.x, e.y); ctx.rotate(e.rot); ctx.translate(-e.x, -e.y); }
    fn(ctx, e, t, VW, VH, reduced);
    ctx.restore();
  }
}

// ---- 共通の小物 ----
function glow(ctx, x, y, r, col, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${0.8 * a})`);
  g.addColorStop(0.35, rgba(col, 0.55 * a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function line(ctx, x0, y0, x1, y1, w, col, a) {
  ctx.globalAlpha = clamp01(a);
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
function star4(ctx, x, y, r, col, a) {
  ctx.globalAlpha = clamp01(a);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.22, y - r * 0.22); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.22, y + r * 0.22);
  ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.22, y + r * 0.22); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.22, y - r * 0.22);
  ctx.closePath(); ctx.fill();
}
// 武器の閃き色: 属性があればその色、無ければ白刃 + 紅
const bladeCol = (e) => (e.el && e.el !== "none" ? elCol(e.el)[1] : e.crit ? "#ffb040" : "#ff5a3a");

// 属性の名残 (物理技・属性武器の一撃に小さく重ねる): 呪文の演出を縮めて薄く描く
function elemTrace(ctx, e, t, VW, VH, reduced) {
  if (!e.el || e.el === "none") return;
  const fn = DRAW[e.el];
  if (!fn) return;
  ctx.save();
  ctx.globalAlpha = 1;
  fn(ctx, { ...e, s: 0.55 * e.s, seed: e.seed + 7, trace: true, v: 0 }, Math.min(1, t * 1.1), VW, VH, reduced);
  ctx.restore();
}

const DRAW = {
  // ===== 武器 =====
  // 短剣: 二筋の細い刃が×字に走る
  cross(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e), R = 24 * e.s * (e.crit ? 1.2 : 1);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let k = 0; k < 2; k++) {
      const tk = clamp01((t - k * 0.22) / 0.78);
      if (tk <= 0) continue;
      const sw = Math.min(1, tk / 0.35), fade = tk < 0.35 ? 1 : 1 - (tk - 0.35) / 0.65;
      const d = k ? -1 : 1;
      const x0 = e.x - R * d, y0 = e.y - R, x1 = x0 + 2 * R * d * sw, y1 = y0 + 2 * R * sw;
      line(ctx, x0, y0, x1, y1, 6, col, fade * 0.5);
      line(ctx, x0, y0, x1, y1, 1.6, "#fff6ea", fade);
    }
    elemTrace(ctx, e, t, VW, VH, reduced);
  },
  // 刀: 一閃。長い直線が一瞬で走り、残光が細って消える
  iai(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e), L = 56 * e.s * (e.crit ? 1.25 : 1);
    const sw = Math.min(1, t / 0.2), fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
    const d = e.flip ? -1 : 1;
    const x0 = e.x - L * d, y0 = e.y - L * 0.32, x1 = x0 + 2 * L * d * sw, y1 = y0 + 2 * L * 0.32 * sw;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    line(ctx, x0, y0, x1, y1, 10 * (1 - t) + 2, col, fade * 0.45);
    line(ctx, x0, y0, x1, y1, 2.4 * (1 - t) + 0.6, "#ffffff", fade);
    // 刃の通り道に散る細かな光
    ctx.fillStyle = "#fff6ea";
    for (let i = 0; i < 8; i++) {
      const p = r01(i, e.seed);
      const px = x0 + (x1 - x0) * p, py = y0 + (y1 - y0) * p - t * 14 * r01(i + 9, e.seed);
      ctx.globalAlpha = fade * 0.9;
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    elemTrace(ctx, e, t, VW, VH, reduced);
  },
  // 槍: 下から穂先が突き上がり、刺さった点で光が弾ける
  thrust(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e);
    const p = easeOut(Math.min(1, t / 0.3));
    const tipY = e.y + 70 * e.s * (1 - p) - 4, tailY = tipY + 46 * e.s;
    const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    line(ctx, e.x, tailY, e.x, tipY, 7, col, fade * 0.45);
    line(ctx, e.x, tailY, e.x, tipY, 2, "#fff6ea", fade);
    if (t >= 0.25) {
      const q = (t - 0.25) / 0.75;
      star4(ctx, e.x, tipY, (14 + 10 * (e.crit ? 1 : 0)) * e.s * (1 - q * 0.5), "#fff6ea", 1 - q);
      ctx.strokeStyle = col; ctx.lineWidth = 2 * (1 - q) + 0.4; ctx.globalAlpha = 1 - q;
      ctx.beginPath(); ctx.arc(e.x, tipY, (6 + q * 22) * e.s, 0, Math.PI * 2); ctx.stroke();
    }
    elemTrace(ctx, e, t, VW, VH, reduced);
  },
  // 斧・槌: 重い打撃。地を這う衝撃の環 + 放射の筋 + 砕けた破片
  smash(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e), s = e.s * (e.crit ? 1.25 : 1);
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 40 * s, col, Math.max(0, 1 - t * 2.4));
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = col; ctx.lineWidth = 4 * (1 - t) + 0.6;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 12 * s, (10 + t * 50) * s, (4 + t * 16) * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r01(i, e.seed) * 0.4;
      const r0 = (8 + t * 26) * s, r1 = r0 + (16 * (1 - t) + 4) * s;
      line(ctx, e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * 0.8, e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1 * 0.8, 2, "#fff0d8", (1 - t) * 0.9);
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 10; i++) {
      const vx = (r01(i, e.seed + 3) - 0.5) * 90, vy = -(40 + r01(i + 5, e.seed) * 50);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 3 ? "#5a4a40" : "#a08a70";
      ctx.fillRect(e.x + vx * t, e.y + vy * t + 120 * t * t, 2.6, 2.6);
    }
    elemTrace(ctx, e, t, VW, VH, reduced);
  },
  // 弓: 矢が下から飛び込み、刺さって火花
  arrow(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e);
    const d = e.flip ? -1 : 1;
    const sx = e.x + d * VW * 0.28, sy = VH + 10;
    const p = easeOut(Math.min(1, t / 0.32));
    const hx = sx + (e.x - sx) * p, hy = sy + (e.y - sy) * p;
    const ang = Math.atan2(e.y - sy, e.x - sx);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    if (t < 0.45) {
      const fa = t < 0.32 ? 1 : 1 - (t - 0.32) / 0.13;
      const tx = hx - Math.cos(ang) * 44 * e.s, ty = hy - Math.sin(ang) * 44 * e.s;
      line(ctx, tx, ty, hx, hy, 5, col, fa * 0.4);
      line(ctx, hx - Math.cos(ang) * 16 * e.s, hy - Math.sin(ang) * 16 * e.s, hx, hy, 1.8, "#fff6ea", fa);
    }
    if (t >= 0.3) {
      const q = (t - 0.3) / 0.7;
      for (let i = 0; i < 8; i++) {
        const a = ang + Math.PI + (r01(i, e.seed) - 0.5) * 2.2;
        const r = (6 + q * 26 * (0.6 + r01(i + 4, e.seed))) * e.s;
        ctx.globalAlpha = 1 - q;
        ctx.fillStyle = i % 2 ? col : "#fff6ea";
        ctx.fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 2, 2);
      }
      star4(ctx, e.x, e.y, 12 * e.s * (1 - q), "#ffffff", (1 - q) * 0.9);
    }
    elemTrace(ctx, e, t, VW, VH, reduced);
  },
  // 杖・素手: 打撃の星が弾ける
  blunt(ctx, e, t, VW, VH, reduced) {
    const col = bladeCol(e), s = e.s * (e.crit ? 1.25 : 1);
    const pop = t < 0.15 ? 0.6 + 0.4 * (t / 0.15) : 1;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 30 * s, col, Math.max(0, 1 - t * 2.6));
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const r = (i % 2 ? 8 : 20) * s * pop * (1 + t * 0.4);
      i ? ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r) : ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    star4(ctx, e.x, e.y, 10 * s * pop, "#ffffff", 1 - t);
    elemTrace(ctx, e, t, VW, VH, reduced);
  },

  // ===== 属性の呪文 (物理の名残にも縮めて使う) =====
  // 火: 爆ぜる閃光 + 立ち昇る炎の舌 + 火の粉
  fire(ctx, e, t) {
    const [c0, c1, c2] = elCol("fire"), s = e.s;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 46 * s, c1, Math.max(0, 1 - t * 2.2));
    const n = e.trace ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const ox = (r01(i, e.seed) - 0.5) * 44 * s, h = (24 + r01(i + 3, e.seed) * 30) * s * easeOut(Math.min(1, t / 0.4));
      const w = (5 + r01(i + 6, e.seed) * 4) * s, by = e.y + 14 * s, sway = Math.sin(t * 10 + i) * 4 * s;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.beginPath(); ctx.moveTo(e.x + ox - w, by); ctx.quadraticCurveTo(e.x + ox + sway, by - h * 0.5, e.x + ox + sway * 1.6, by - h); ctx.quadraticCurveTo(e.x + ox + sway, by - h * 0.4, e.x + ox + w, by); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < (e.trace ? 6 : 12); i++) {
      const px = e.x + (r01(i, e.seed + 1) - 0.5) * 56 * s + Math.sin(t * 8 + i) * 3, py = e.y + 10 * s - t * (30 + r01(i, e.seed + 2) * 46) * s;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 3 ? c1 : c0;
      ctx.fillRect(px, py, 2, 2);
    }
  },
  // 水: 水しぶきの冠 + 広がる波紋
  water(ctx, e, t) {
    const [c0, c1, c2] = elCol("water"), s = e.s;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 40 * s, c1, Math.max(0, 1 - t * 2.4));
    for (let k = 0; k < 2; k++) {
      const q = clamp01(t * 1.2 - k * 0.2);
      if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = k ? c0 : c1; ctx.lineWidth = 2.5 * (1 - q) + 0.5;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 14 * s, (8 + q * 46) * s, (3 + q * 14) * s, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < (e.trace ? 7 : 14); i++) {
      const vx = (r01(i, e.seed) - 0.5) * 100 * s, vy = -(60 + r01(i + 7, e.seed) * 70) * s;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 3 ? c1 : c0;
      const sz = i % 3 ? 2.4 : 3;
      ctx.fillRect(e.x + vx * t, e.y + vy * t + 170 * s * t * t, sz, sz + 1);
    }
    ctx.globalAlpha = (1 - t) * 0.6; ctx.fillStyle = c2;
    ctx.fillRect(e.x - 1, e.y - 10 * s, 2, 2);
  },
  // 風: 渦を巻く三筋の弧 + 巻き上がる塵
  wind(ctx, e, t) {
    const [c0, c1] = elCol("wind"), s = e.s;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const a0 = t * 7 + k * 2.09, r = (10 + t * 26 + k * 6) * s;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = c1; ctx.lineWidth = 3.4 * (1 - t) + 0.6;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - k * 6 * s, r, r * 0.55, 0, a0, a0 + 1.7); ctx.stroke();
      ctx.strokeStyle = c0; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - k * 6 * s, r, r * 0.55, 0, a0 + 0.3, a0 + 1.6); ctx.stroke();
    }
    for (let i = 0; i < (e.trace ? 5 : 10); i++) {
      const a = t * 9 + i * 0.63, r = (6 + t * 40 * (0.5 + r01(i, e.seed))) * s;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 2 ? c1 : c0;
      ctx.fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.5 - t * 22 * s, 2, 2);
    }
  },
  // 土: 地から岩の牙が突き上がり、礫が跳ねる
  earth(ctx, e, t) {
    const [c0, c1, c2] = elCol("earth"), s = e.s;
    const by = e.y + 18 * s;
    const grow = Math.min(1, t / 0.28), shrink = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
    const n = e.trace ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const ox = ((i + 0.5) / n - 0.5) * 52 * s + (r01(i, e.seed) - 0.5) * 6 * s;
      const h = (18 + r01(i + 2, e.seed) * 22) * s * (i === (n >> 1) ? 1.3 : 1) * easeOut(grow) * shrink;
      const w = (6 + r01(i + 4, e.seed) * 4) * s;
      ctx.globalAlpha = shrink;
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.moveTo(e.x + ox - w, by); ctx.lineTo(e.x + ox + w * 0.2, by - h); ctx.lineTo(e.x + ox + w, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(e.x + ox - w, by); ctx.lineTo(e.x + ox + w * 0.2, by - h); ctx.lineTo(e.x + ox - w * 0.1, by); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < (e.trace ? 5 : 10); i++) {
      const vx = (r01(i, e.seed + 5) - 0.5) * 80 * s, vy = -(50 + r01(i + 3, e.seed) * 60) * s;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 3 ? c2 : c1;
      ctx.fillRect(e.x + vx * t, by + vy * t + 160 * s * t * t, 3, 3);
    }
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - t) * 0.5;
    ctx.fillStyle = rgba(c0, 0.35);
    ctx.beginPath(); ctx.ellipse(e.x, by, (14 + t * 40) * s, (3 + t * 7) * s, 0, 0, Math.PI * 2); ctx.fill();
  },
  // 光: 天から光の柱が落ち、十字の輝きと光の粒
  light(ctx, e, t) {
    const [c0, c1, c2] = elCol("light"), s = e.s;
    ctx.globalCompositeOperation = "lighter";
    if (!e.trace) {
      const a = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      // 幅の広い淡い光 + 細く強い芯の二重の柱
      for (const [w, k] of [[(30 * (1 - t) + 10) * s, 0.35], [(14 * (1 - t) + 3) * s, 1]]) {
        const g = ctx.createLinearGradient(0, 0, 0, e.y + 20 * s);
        g.addColorStop(0, rgba(c1, 0));
        g.addColorStop(0.7, rgba(c1, 0.45 * a * k));
        g.addColorStop(1, rgba(c0, 0.85 * a * k));
        ctx.fillStyle = g;
        ctx.fillRect(e.x - w / 2, 0, w, e.y + 20 * s);
      }
    }
    glow(ctx, e.x, e.y, 38 * s, c2, Math.max(0, 1 - t * 2));
    const L = 34 * s * Math.sin(Math.PI * Math.min(1, t * 1.4));
    ctx.lineCap = "round";
    line(ctx, e.x - L, e.y, e.x + L, e.y, 1.6, c0, 1 - t);
    line(ctx, e.x, e.y - L * 0.8, e.x, e.y + L * 0.8, 1.6, c0, 1 - t);
    for (let i = 0; i < (e.trace ? 4 : 9); i++) {
      const px = e.x + (r01(i, e.seed) - 0.5) * 60 * s, py = e.y + (r01(i + 5, e.seed) - 0.5) * 50 * s - t * 16 * s;
      star4(ctx, px, py, (3 + r01(i + 2, e.seed) * 3) * s * (1 - t * 0.5), i % 2 ? c1 : c0, (1 - t) * (0.6 + 0.4 * Math.sin(t * 20 + i)));
    }
  },
  // 闇: 環が内へ潰れ、黒い核から触手がのびる
  dark(ctx, e, t) {
    const [c0, c1, c2] = elCol("dark"), s = e.s;
    ctx.globalAlpha = 0.75 * Math.sin(Math.PI * t);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 26 * s);
    g.addColorStop(0, "rgba(8,0,16,0.95)"); g.addColorStop(0.6, rgba(c2, 0.6)); g.addColorStop(1, rgba(c2, 0));
    ctx.fillStyle = g;
    ctx.fillRect(e.x - 26 * s, e.y - 26 * s, 52 * s, 52 * s);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - t * 0.6;
    ctx.strokeStyle = c1; ctx.lineWidth = 3 * (1 - t) + 0.6;
    ctx.beginPath(); ctx.arc(e.x, e.y, (46 * (1 - easeOut(t)) + 4) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = "round";
    for (let i = 0; i < (e.trace ? 3 : 6); i++) {
      const a = (i / 6) * Math.PI * 2 + r01(i, e.seed) * 0.8, L = (14 + t * 26) * s;
      const bend = (r01(i + 3, e.seed) - 0.5) * 1.6;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = i % 2 ? c1 : c2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.quadraticCurveTo(e.x + Math.cos(a + bend) * L * 0.6, e.y + Math.sin(a + bend) * L * 0.6, e.x + Math.cos(a) * L, e.y + Math.sin(a) * L);
      ctx.stroke();
    }
    for (let i = 0; i < (e.trace ? 4 : 8); i++) {
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 2 ? c0 : c1;
      ctx.fillRect(e.x + (r01(i, e.seed + 9) - 0.5) * 50 * s, e.y + 16 * s - t * (24 + r01(i, 4) * 30) * s, 2, 2);
    }
  },
  // 無属性: 魔力の閃光 → 広がる環 → 火花 (従来の演出)
  none(ctx, e, t) {
    const c = e.col || elCol("none")[1], s = e.s;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 46 * s, c, Math.max(0, 1 - t * 2.2));
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = c; ctx.lineWidth = 3.5 * (1 - t) + 0.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, (6 + t * 40) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y, (4 + t * 28) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + t * 2.6, r = (8 + t * 36) * s;
      ctx.fillRect(e.x + Math.cos(a) * r - 1.5, e.y + Math.sin(a) * r - 1.5, 3, 3);
    }
  },

  // ===== 会心: 放射の集中線 + 一瞬の白い閃き =====
  crit(ctx, e, t, VW, VH, reduced) {
    ctx.globalCompositeOperation = "lighter";
    if (!reduced && t < 0.25) {
      ctx.globalAlpha = 0.12 * (1 - t / 0.25);
      ctx.fillStyle = "#fff4dc";
      ctx.fillRect(0, 0, VW, VH);
    }
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r01(i, e.seed) * 0.3;
      const r0 = 16 + t * 34 + r01(i + 3, e.seed) * 8, r1 = r0 + 30 * (1 - t) * (0.6 + r01(i + 6, e.seed) * 0.6);
      line(ctx, e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0, e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1, i % 2 ? 1.4 : 2.4, i % 3 ? "#ffd27a" : "#ffffff", 1 - t);
    }
  },

  // ===== 弱体・状態異常 (敵にかかった時) =====
  // 弱体: 紫の楔が沈み込み、暗い環が締まる
  hex(ctx, e, t) {
    const c = elCol("dark")[1];
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = c; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 16, 30 * (1 - t * 0.5), 9 * (1 - t * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let k = 0; k < 3; k++) {
      const q = clamp01(t * 1.3 - k * 0.15);
      if (q <= 0 || q >= 1) continue;
      const y = e.y - 30 + q * 40 + k * 2, w = 9 - k * 1.5;
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = k ? c : "#e0b8ff"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(e.x - w, y - w * 0.7); ctx.lineTo(e.x, y); ctx.lineTo(e.x + w, y - w * 0.7); ctx.stroke();
    }
  },
  // 眠り: 青い粒と「z」がふわりと昇る
  sleep(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 34, "#9ad1ff", Math.max(0, 0.7 - t * 1.4));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < 3; k++) {
      const q = clamp01(t * 1.2 - k * 0.15);
      if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = Math.sin(Math.PI * q);
      ctx.fillStyle = "#cfe8ff";
      ctx.font = `800 ${10 + k * 4}px serif`;
      ctx.fillText("z", e.x + 10 + k * 9 + Math.sin(q * 6) * 3, e.y - 14 - q * 26 - k * 8);
    }
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = i % 2 ? "#9ad1ff" : "#e6f4ff";
      ctx.fillRect(e.x + (r01(i, e.seed) - 0.5) * 50, e.y + 10 - t * (16 + r01(i + 4, e.seed) * 26), 2, 2);
    }
  },
  // 魅了: 桃色の心が舞い上がる
  charm(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 34, "#ff7ac0", Math.max(0, 0.7 - t * 1.4));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < 5; i++) {
      const q = clamp01(t * 1.15 - i * 0.05);
      ctx.globalAlpha = Math.sin(Math.PI * q);
      ctx.fillStyle = i % 2 ? "#ff9ad0" : "#ffd0ea";
      ctx.font = `800 ${9 + (i % 3) * 3}px serif`;
      ctx.fillText("♥", e.x + (r01(i, e.seed) - 0.5) * 52 + Math.sin(q * 7 + i) * 4, e.y + 6 - q * (24 + r01(i + 3, e.seed) * 18));
    }
  },
  // 混乱: 頭上を星が回る
  confuse(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    const y = e.y - 26;
    for (let i = 0; i < 4; i++) {
      const a = t * 9 + (i / 4) * Math.PI * 2;
      star4(ctx, e.x + Math.cos(a) * 20, y + Math.sin(a) * 6, 4.5, i % 2 ? "#ffe27a" : "#ffffff", Math.sin(Math.PI * t));
    }
    ctx.globalAlpha = (1 - t) * 0.7;
    ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(e.x, y, 20, 6, 0, 0, Math.PI * 2); ctx.stroke();
  },
  // 麻痺: 黄の稲妻が身をはしる
  para(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      if (((t * 12 + k) | 0) % 2) continue; // ちらつき
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = k ? "#ffe27a" : "#ffffff"; ctx.lineWidth = k ? 2.2 : 1.2;
      ctx.beginPath();
      let x = e.x + (k - 1) * 16, y = e.y - 26;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (r01(j + k * 5, e.seed + ((t * 6) | 0)) - 0.5) * 16; y += 13; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },
  // 毒: 緑の泡がぷつぷつ昇る
  poison(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 9; i++) {
      const q = clamp01(t * 1.2 - r01(i, e.seed) * 0.2);
      ctx.globalAlpha = (1 - q) * 0.9;
      ctx.strokeStyle = i % 2 ? "#8cff6a" : "#c8ff9a"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(e.x + (r01(i + 2, e.seed) - 0.5) * 50, e.y + 12 - q * (20 + r01(i + 5, e.seed) * 26), 2 + r01(i + 7, e.seed) * 2.5, 0, Math.PI * 2); ctx.stroke();
    }
  },

  // ===== 回復・強化 (敵味方とも): 下から光の粒が昇る (col = 色) =====
  rise(ctx, e, t) {
    const c = e.col || "#7CFC7C", s = e.s;
    ctx.globalCompositeOperation = "lighter";
    const a = Math.sin(Math.PI * t);
    // 柔らかな光の柱 (縦長の楕円にぼかす)
    ctx.save();
    ctx.translate(e.x, e.y - 6 * s);
    ctx.scale(1, 1.9);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 24 * s);
    g.addColorStop(0, rgba(c, 0.38 * a)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-24 * s, -24 * s, 48 * s, 48 * s);
    ctx.restore();
    for (let i = 0; i < 12; i++) {
      const q = clamp01(t * 1.2 - r01(i, e.seed) * 0.2);
      const px = e.x + (r01(i + 3, e.seed) - 0.5) * 44 * s, py = e.y + 20 * s - q * (30 + r01(i + 6, e.seed) * 30) * s;
      if (i % 3 === 0) star4(ctx, px, py, 3 * s, "#ffffff", 1 - q);
      else { ctx.globalAlpha = 1 - q; ctx.fillStyle = c; ctx.fillRect(px, py, 2, 2); }
    }
  },

  // ===== 敵 → 隊 =====
  // ブレス・全体呪文: 敵から画面下 (隊) へ、属性の奔流が扇に広がって押し寄せる
  breath(ctx, e, t, VW, VH) {
    const [c0, c1, c2] = elCol(e.el);
    const p = easeOut(Math.min(1, t / 0.45)), fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    const y1 = e.y + (VH + 10 - e.y) * p, wTop = 16, wBot = 16 + (VW * 0.62 - 16) * p;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, e.y, 0, y1);
    g.addColorStop(0, rgba(c0, 0.55 * fade)); g.addColorStop(0.5, rgba(c1, 0.4 * fade)); g.addColorStop(1, rgba(c2, 0.25 * fade));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(e.x - wTop, e.y); ctx.lineTo(e.x + wTop, e.y); ctx.lineTo(e.x + wBot, y1); ctx.lineTo(e.x - wBot, y1); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 18; i++) {
      const q = clamp01(p - r01(i, e.seed) * 0.35) / 1;
      if (q <= 0) continue;
      const lane = r01(i + 4, e.seed) - 0.5;
      const py = e.y + (y1 - e.y) * q, half = wTop + (wBot - wTop) * ((py - e.y) / Math.max(1, y1 - e.y));
      ctx.globalAlpha = fade;
      ctx.fillStyle = i % 3 ? c1 : c0;
      ctx.fillRect(e.x + lane * 2 * half, py, 3, 3);
    }
  },
  // 隊の札の上 (戦場の下端) に走る三本の爪痕
  pclaw(ctx, e, t) {
    const c = e.crit ? "#ffb040" : "#ff4a3a";
    const sw = Math.min(1, t / 0.3), fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let k = -1; k <= 1; k++) {
      const x0 = e.x - 14 + k * 9, y0 = e.y - 18, x1 = x0 + 22 * sw, y1 = y0 + 30 * sw;
      line(ctx, x0, y0, x1, y1, 5, c, fade * 0.5);
      line(ctx, x0, y0, x1, y1, 1.4, "#fff0e8", fade);
    }
  },
};

// =====================================================================
// 技ごとの組み立て (全929種の技に、その性質から決まる演出を与える)
//   属性 → 色と基本の形 (属性ごとに3通りの描き分け v = 0/1/2) / 威力・MP → 格 (tier 1-3: 大きさ・上級は魔法陣) /
//   単体か全体か → 全体技は戦場を覆う一枚 (field 系) を重ねる / 付く効果 → 印 (riders) /
//   技の鍵の hash → 描き分け・角度 (rot)・回る向き (spin)・粒の配置 (seed)。同じ性質の技でも見た目がずれる
// =====================================================================
const _profiles = new Map();
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function skillProfile(key, sp) {
  if (!key || !sp) return null;
  let p = _profiles.get(key);
  if (p) return p;
  const h = hashStr(key);
  const mp = sp.mp || 0;
  const tier = sp.kind === "debuff" ? (mp >= 12 ? 3 : mp >= 7 ? 2 : 1) : mp >= 25 ? 3 : mp >= 13 ? 2 : 1;
  const riders = [];
  if (sp.drain) riders.push({ type: "drain", col: "#ff5a5a" });
  if (sp.mpDrain) riders.push({ type: "drain", col: "#6aa8ff" });
  if (sp.pierce) riders.push({ type: "pierce" });
  if (sp.execute) riders.push({ type: "execute", onDeath: true });
  if (sp.flinchChance) riders.push({ type: "stun" });
  if (sp.vuln) riders.push({ type: "vuln" });
  if (sp.strip) riders.push({ type: "strip" });
  if (sp.seal) riders.push({ type: "seal" });
  if (sp.gravity) riders.push({ type: "gravity" });
  if (sp.steal || sp.plunder) riders.push({ type: "steal", onSteal: !!sp.steal });
  if (sp.instakill) riders.push({ type: "doom", onFatal: true });
  if (sp.debuff && sp.kind === "phys") riders.push({ type: "hex", s: 0.7 });
  p = {
    tier, el: sp.element || null, kind: sp.kind,
    all: /all/.test(sp.target || ""), ally: /ally|self/.test(sp.target || ""),
    hits: sp.hits || 1, riders,
    v: h % 3, rot: ((h >>> 3) % 1000 / 1000 - 0.5) * 0.9, spin: (h >>> 13) & 1 ? 1 : -1, seed: (h >>> 7) % 997,
    scale: tier === 3 ? 1.3 : tier === 2 ? 1.08 : 0.88,
  };
  _profiles.set(key, p);
  return p;
}

// ---- 属性ごとの描き分け (v = 1, 2。v = 0 は上の基本形) ----
const VARIANTS = {
  fire: [
    // 火球の炸裂: 炎の塊が環になって弾ける
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("fire"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 50 * s, c1, Math.max(0, 1 - t * 2));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + e.rot, r = (8 + easeOut(t) * 42) * s;
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.75, (6 * (1 - t) + 1.5) * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1 - t; ctx.fillStyle = c0;
      ctx.beginPath(); ctx.arc(e.x, e.y, 9 * s * (1 - t), 0, Math.PI * 2); ctx.fill();
    },
    // 炎の螺旋: 火の粉が渦を巻いて昇る
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("fire"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y + 8 * s, 36 * s, c2, Math.max(0, 1 - t * 1.8));
      for (let i = 0; i < 22; i++) {
        const k = i / 22, a = k * 9 + t * 10 * e.spin, r = (20 - k * 12) * s * (0.6 + 0.4 * t);
        const y = e.y + 18 * s - k * 60 * s * easeOut(Math.min(1, t * 1.6));
        ctx.globalAlpha = (1 - t) * (1 - k * 0.4);
        ctx.fillStyle = i % 3 ? c1 : c0;
        const sz = (3.4 - k * 1.6) * s;
        ctx.fillRect(e.x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3, sz, sz);
      }
    },
  ],
  water: [
    // 水の槍: 上から水の筋が降り注ぎ、着いたところで小さく弾ける
    (ctx, e, t) => {
      const [c0, c1] = elCol("water"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const d = r01(i, e.seed) * 0.35, q = clamp01((t - d) / 0.4);
        if (q <= 0) continue;
        const x = e.x + (r01(i + 3, e.seed) - 0.5) * 56 * s, hy = e.y - 80 * s + q * 92 * s;
        if (q < 1) line(ctx, x, hy - 18 * s, x, hy, 2.4, i % 2 ? c1 : c0, 0.9);
        else {
          const qq = clamp01((t - d - 0.4) / 0.35);
          ctx.globalAlpha = 1 - qq; ctx.strokeStyle = c1; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(x, e.y + 12 * s, (3 + qq * 14) * s, (1 + qq * 4) * s, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    },
    // 渦潮: 渦が内へ巻き込み、しぶきが外へ飛ぶ
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("water"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 4; k++) {
        const r = (40 - k * 8) * s * (1 - t * 0.5), a0 = t * 8 * e.spin + k * 1.4;
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = k % 2 ? c1 : c2; ctx.lineWidth = 2.6 - k * 0.4;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 6 * s, r, r * 0.45, 0, a0, a0 + 2.4); ctx.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 4 * e.spin, r = (10 + t * 46) * s;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = c0;
        ctx.fillRect(e.x + Math.cos(a) * r, e.y + 6 * s + Math.sin(a) * r * 0.45, 2, 2);
      }
    },
  ],
  wind: [
    // 風の刃: 三日月が角度を変えて三度交差する
    (ctx, e, t) => {
      const [c0, c1] = elCol("wind"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        const q = clamp01((t - k * 0.14) / 0.6);
        if (q <= 0) continue;
        const sw = Math.min(1, q / 0.5), fade = q < 0.5 ? 1 : 1 - (q - 0.5) / 0.5;
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(k * 1.05 * e.spin);
        const R = 26 * s, a0 = -1.2, a1 = a0 + 2.4 * sw;
        ctx.globalAlpha = fade * 0.6; ctx.strokeStyle = c1; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.stroke();
        ctx.globalAlpha = fade; ctx.strokeStyle = c0; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, R, a0 + 0.2 * sw, a1); ctx.stroke();
        ctx.restore();
      }
    },
    // 突風: 長い風の筋が横に吹き抜ける
    (ctx, e, t) => {
      const [c0, c1] = elCol("wind"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const y = e.y + (r01(i, e.seed) - 0.5) * 50 * s, d = r01(i + 2, e.seed) * 0.3;
        const q = clamp01((t - d) / 0.6), L = (30 + r01(i + 5, e.seed) * 30) * s;
        if (q <= 0 || q >= 1) continue;
        const hx = e.x + (q - 0.5) * 140 * s * e.spin;
        line(ctx, hx - L * e.spin, y, hx, y, i % 3 ? 1.4 : 2.6, i % 2 ? c1 : c0, Math.sin(Math.PI * q));
      }
    },
  ],
  earth: [
    // 落石: 大岩が落ちて砕ける
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("earth"), s = e.s;
      const p = Math.min(1, t / 0.3);
      if (t < 0.32) {
        const y = e.y - 80 * s + p * p * 80 * s, R = 16 * s;
        ctx.fillStyle = c2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, rr = R * (0.75 + r01(i, e.seed) * 0.35); i ? ctx.lineTo(e.x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(e.x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(e.x - R * 0.3, y - R * 0.3, R * 0.35, 0, Math.PI * 2); ctx.fill();
      } else {
        const q = (t - 0.3) / 0.7;
        for (let i = 0; i < 14; i++) {
          const vx = (r01(i, e.seed + 2) - 0.5) * 110 * s, vy = -(40 + r01(i + 4, e.seed) * 60) * s;
          ctx.globalAlpha = 1 - q; ctx.fillStyle = i % 3 ? c2 : c1;
          const sz = (2.5 + r01(i + 8, e.seed) * 3) * s;
          ctx.fillRect(e.x + vx * q, e.y + vy * q + 150 * s * q * q, sz, sz);
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (1 - q) * 0.6; ctx.fillStyle = rgba(c0, 0.4);
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 14 * s, (16 + q * 46) * s, (4 + q * 10) * s, 0, 0, Math.PI * 2); ctx.fill();
      }
    },
    // 地割れ: 足元から割れ目が走り、礫が跳ねる
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("earth"), s = e.s;
      const by = e.y + 18 * s, p = easeOut(Math.min(1, t / 0.4)), fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.lineJoin = "round";
      for (let k = 0; k < 4; k++) {
        const dir = k % 2 ? 1 : -1, slope = (k < 2 ? 0.12 : -0.18);
        ctx.globalAlpha = fade; ctx.strokeStyle = k < 2 ? "#1a1008" : c2; ctx.lineWidth = k < 2 ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(e.x, by);
        let x = e.x, y = by;
        for (let j = 1; j <= 5; j++) { x = e.x + dir * j * 13 * s * p; y = by + j * 13 * s * p * slope + (r01(j + k * 7, e.seed) - 0.5) * 6 * s; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade * 0.7; ctx.strokeStyle = c1; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.x - 60 * s * p, by); ctx.lineTo(e.x + 60 * s * p, by); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < 10; i++) {
        const x = e.x + (r01(i, e.seed) - 0.5) * 110 * s * p, q = clamp01(t * 1.3 - r01(i + 3, e.seed) * 0.3);
        ctx.globalAlpha = 1 - q; ctx.fillStyle = i % 2 ? c2 : c1;
        ctx.fillRect(x, by - Math.sin(Math.PI * q) * (14 + r01(i + 6, e.seed) * 16) * s, 3, 3);
      }
    },
  ],
  light: [
    // 光輝: 八方に伸びる星が回りながら弾ける
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("light"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 54 * s, c2, Math.max(0, 1 - t * 1.8));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t * 1.6 * e.spin + e.rot);
      const R = (14 + 36 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * s;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, L = k % 2 ? R * 0.55 : R;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = k % 2 ? c1 : c0;
        ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 4 * s, Math.sin(a - 0.12) * 4 * s); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(a + 0.12) * 4 * s, Math.sin(a + 0.12) * 4 * s); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    // 光の矢の雨: 斜めの細い光が次々と降る
    (ctx, e, t) => {
      const [c0, c1] = elCol("light"), s = e.s;
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const ang = Math.PI / 2 + e.rot * 0.6;
      for (let i = 0; i < 8; i++) {
        const d = r01(i, e.seed) * 0.4, q = clamp01((t - d) / 0.35);
        if (q <= 0) continue;
        const tx = e.x + (r01(i + 2, e.seed) - 0.5) * 60 * s, ty = e.y + (r01(i + 5, e.seed) - 0.5) * 30 * s;
        if (q < 1) {
          const hx = tx - Math.cos(ang) * 90 * s * (1 - q), hy = ty - Math.sin(ang) * 90 * s * (1 - q);
          line(ctx, hx - Math.cos(ang) * 26 * s, hy - Math.sin(ang) * 26 * s, hx, hy, 1.8, i % 2 ? c1 : c0, 0.95);
        } else star4(ctx, tx, ty, 6 * s * (1 - clamp01((t - d - 0.35) / 0.3)), c0, 1 - clamp01((t - d - 0.35) / 0.3));
      }
    },
  ],
  dark: [
    // 影の爪: 黒紫の三本の弧が引き裂く
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("dark"), s = e.s;
      const sw = Math.min(1, t / 0.35), fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        const x0 = e.x - 26 * s * e.spin + k * 10 * s, y0 = e.y - 30 * s, x1 = e.x + 26 * s * e.spin + k * 10 * s, y1 = e.y + 26 * s;
        const mx = (x0 + x1) / 2 + 14 * s * e.spin, my = (y0 + y1) / 2;
        const ex = x0 + (x1 - x0) * sw, ey = y0 + (y1 - y0) * sw;
        ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = c2; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade; ctx.strokeStyle = c1; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) { ctx.globalAlpha = 1 - t; ctx.fillStyle = c0; ctx.fillRect(e.x + (r01(i, e.seed) - 0.5) * 50 * s, e.y + (r01(i + 4, e.seed) - 0.5) * 40 * s - t * 14, 2, 2); }
    },
    // 闇の珠: 珠が回りながら寄り集まり、最後に弾ける
    (ctx, e, t) => {
      const [c0, c1, c2] = elCol("dark"), s = e.s;
      const n = 5, conv = Math.min(1, t / 0.7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 7 * e.spin, r = 40 * s * (1 - conv);
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.6;
        ctx.globalAlpha = 0.9; ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(x, y, 5.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x - 1.5 * s, y - 1.5 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      if (t > 0.65) {
        const q = (t - 0.65) / 0.35;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, e.x, e.y, 44 * s, c1, 1 - q);
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = c0; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, (6 + q * 36) * s, 0, Math.PI * 2); ctx.stroke();
      }
    },
  ],
  none: [
    // 魔法陣の星: 回る六芒星が閃く
    (ctx, e, t) => {
      const c = e.col || elCol("none")[1], s = e.s;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 42 * s, c, Math.max(0, 1 - t * 2));
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t * 2.4 * e.spin);
      const R = (12 + 26 * easeOut(t)) * s;
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = c; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2; i ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
        ctx.closePath(); ctx.stroke();
      }
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.08, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    },
    // 魔力の破片: 虹色のかけらが回りながら飛び散る
    (ctx, e, t) => {
      const s = e.s, cols = ["#ff9ad0", "#b06bff", "#7fb8ff", "#9ff0d0", "#ffe27a"];
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 36 * s, "#b06bff", Math.max(0, 1 - t * 2.4));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + r01(i, e.seed), r = (6 + easeOut(t) * 46 * (0.6 + r01(i + 3, e.seed) * 0.5)) * s;
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r, sz = 5 * s * (1 - t * 0.6), rr = t * 9 * e.spin + i;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.moveTo(x + Math.cos(rr) * sz, y + Math.sin(rr) * sz); ctx.lineTo(x + Math.cos(rr + 2.3) * sz * 0.6, y + Math.sin(rr + 2.3) * sz * 0.6); ctx.lineTo(x + Math.cos(rr + 4) * sz * 0.6, y + Math.sin(rr + 4) * sz * 0.6); ctx.closePath(); ctx.fill();
      }
    },
  ],
};
for (const el of Object.keys(VARIANTS)) {
  const base = DRAW[el];
  DRAW[el] = (ctx, e, t, VW, VH, reduced) => (e.v ? VARIANTS[el][e.v - 1] : base)(ctx, e, t, VW, VH, reduced);
}

// ---- 付く効果の印 (riders): 本体の一撃に少し遅れて重ねる ----
Object.assign(DRAW, {
  // 吸収: 敵から隊 (画面下の tx) へ光の粒が流れ込む (col = HP 赤 / MP 青)
  drain(ctx, e, t, VW, VH) {
    const c = e.col || "#ff5a5a", tx = e.tx || VW / 2, ty = VH - 6;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 12; i++) {
      const q = clamp01(t * 1.3 - r01(i, e.seed) * 0.3);
      if (q <= 0 || q >= 1) continue;
      const ox = (r01(i + 4, e.seed) - 0.5) * 40, mx = (e.x + tx) / 2 + (r01(i + 7, e.seed) - 0.5) * 80, my = (e.y + ty) / 2 - 30;
      const u = 1 - q, x = u * u * (e.x + ox) + 2 * u * q * mx + q * q * tx, y = u * u * e.y + 2 * u * q * my + q * q * ty;
      ctx.globalAlpha = Math.sin(Math.PI * q);
      ctx.fillStyle = i % 3 ? c : "#ffffff";
      ctx.fillRect(x - 1.2, y - 1.2, 2.6, 2.6);
    }
  },
  // 防御無視: 一本の光の針が敵を貫く
  pierce(ctx, e, t) {
    const sw = Math.min(1, t / 0.25), fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7, L = 60 * e.s;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    line(ctx, e.x - L, e.y + L * 0.2, e.x - L + 2 * L * sw, e.y + L * 0.2 - 0.4 * L * sw, 5, "#ffd27a", fade * 0.5);
    line(ctx, e.x - L, e.y + L * 0.2, e.x - L + 2 * L * sw, e.y + L * 0.2 - 0.4 * L * sw, 1.4, "#ffffff", fade);
    if (sw >= 1) star4(ctx, e.x + L, e.y - L * 0.2, 7 * (1 - t), "#ffffff", fade);
  },
  // とどめ: 倒した瞬間に紅い×印が刻まれる
  execute(ctx, e, t) {
    const k = 1 + 0.5 * (1 - Math.min(1, t / 0.2)), R = 22 * e.s * k, fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    line(ctx, e.x - R, e.y - R, e.x + R, e.y + R, 7, "#ff2a1a", fade * 0.6);
    line(ctx, e.x + R, e.y - R, e.x - R, e.y + R, 7, "#ff2a1a", fade * 0.6);
    line(ctx, e.x - R, e.y - R, e.x + R, e.y + R, 2, "#ffe0d0", fade);
    line(ctx, e.x + R, e.y - R, e.x - R, e.y + R, 2, "#ffe0d0", fade);
  },
  // 怯み: 頭上に小さな星が弾ける
  stun(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.6, r = 8 + easeOut(t) * 22;
      star4(ctx, e.x + Math.cos(a) * r, e.y - 22 + Math.sin(a) * r * 0.6, 4.5 * (1 - t * 0.4), i % 2 ? "#ffe27a" : "#ffffff", 1 - t);
    }
  },
  // 属性耐性ダウン: 属性色の環がひび割れて砕け散る
  vuln(ctx, e, t) {
    const c = elCol(e.el)[1], R = 26 * e.s;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, off = t < 0.3 ? 0 : (t - 0.3) * 40;
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = i % 2 ? c : "#ffffff";
      ctx.beginPath(); ctx.arc(e.x + Math.cos(a + 0.39) * off, e.y + Math.sin(a + 0.39) * off * 0.6, R, a + 0.06, a + Math.PI / 4 - 0.06); ctx.stroke();
    }
  },
  // 強化打ち消し: 金の殻が割れて欠片が飛ぶ
  strip(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.max(0, 1 - t * 2.5); ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, 28 * e.s, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + r01(i, e.seed) * 0.5, r = (28 + easeOut(t) * 30) * e.s, sz = 4 * (1 - t * 0.5);
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = i % 2 ? "#ffd84a" : "#fff6d0";
      ctx.beginPath(); ctx.moveTo(x, y - sz); ctx.lineTo(x + sz * 0.6, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz * 0.6, y); ctx.closePath(); ctx.fill();
    }
  },
  // 特技封じ: 回る封印の方陣が締まる
  seal(ctx, e, t) {
    const R = (34 - 14 * easeOut(t)) * e.s;
    ctx.globalCompositeOperation = "lighter";
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t * 2.2);
    ctx.globalAlpha = Math.sin(Math.PI * t); ctx.strokeStyle = "#9ab8ff"; ctx.lineWidth = 2;
    ctx.strokeRect(-R, -R, 2 * R, 2 * R);
    ctx.rotate(Math.PI / 4); ctx.strokeStyle = "#c8a0ff"; ctx.strokeRect(-R * 0.8, -R * 0.8, 1.6 * R, 1.6 * R);
    ctx.restore();
    ctx.lineCap = "round";
    line(ctx, e.x - 8, e.y - 8, e.x + 8, e.y + 8, 2.4, "#e0d0ff", Math.sin(Math.PI * t));
    line(ctx, e.x + 8, e.y - 8, e.x - 8, e.y + 8, 2.4, "#e0d0ff", Math.sin(Math.PI * t));
  },
  // 重力: 上から重い輪が押し潰す
  gravity(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const q = clamp01(t * 1.3 - k * 0.15);
      if (q <= 0 || q >= 1) continue;
      const y = e.y - 40 + q * 56, R = 34 * (1 - q * 0.4);
      ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = k ? "#7a4ab0" : "#c8a0ff"; ctx.lineWidth = 3 - k * 0.6;
      ctx.beginPath(); ctx.ellipse(e.x, y, R, R * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.45 * Math.sin(Math.PI * t); ctx.fillStyle = "#14001e";
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 18, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
  },
  // 盗む: 金貨が隊のほうへ跳ねる
  steal(ctx, e, t, VW, VH) {
    const tx = e.tx || VW / 2;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const q = clamp01(t * 1.25 - i * 0.06);
      const x = e.x + (tx - e.x) * q + (i - 2) * 6, y = e.y + (VH - 10 - e.y) * q - Math.sin(Math.PI * q) * 50;
      ctx.globalAlpha = 1 - q * 0.6; ctx.fillStyle = "#ffd84a";
      ctx.beginPath(); ctx.ellipse(x, y, 3.5 * Math.abs(Math.cos(t * 14 + i)) + 0.8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 即死: 黒い炸裂と闇の棘
  doom(ctx, e, t) {
    const s = e.s;
    ctx.globalAlpha = 0.85 * Math.sin(Math.PI * t);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 46 * s);
    g.addColorStop(0, "rgba(0,0,0,0.95)"); g.addColorStop(0.6, "rgba(60,0,20,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(e.x - 46 * s, e.y - 46 * s, 92 * s, 92 * s);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r0 = 10 * s, r1 = (20 + easeOut(t) * 26) * s;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = i % 2 ? "#ff2a3a" : "#6a1030";
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a - 0.1) * r0, e.y + Math.sin(a - 0.1) * r0); ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1); ctx.lineTo(e.x + Math.cos(a + 0.1) * r0, e.y + Math.sin(a + 0.1) * r0); ctx.closePath(); ctx.fill();
    }
  },
});

// ---- 全体技: 戦場を覆う一枚 (x = 中央, y = 敵の列の高さ。e.w = 横幅) ----
Object.assign(DRAW, {
  field(ctx, e, t, VW, VH) {
    const [c0, c1, c2] = elCol(e.el), W = e.w || VW, x0 = e.x - W / 2, s = e.s;
    const a = Math.sin(Math.PI * t);
    ctx.globalCompositeOperation = "lighter";
    if (e.el === "fire") {
      // 炎の帯が下から立ち上がる
      // (両端は低く絞り、下端は透かして、帯の縁が四角く見えないように)
      const by = e.y + 56, rise = easeOut(Math.min(1, t / 0.4)) * 96 * s;
      const g = ctx.createLinearGradient(0, by, 0, by - rise - 20);
      g.addColorStop(0, rgba(c2, 0)); g.addColorStop(0.25, rgba(c2, 0.55 * a)); g.addColorStop(0.65, rgba(c1, 0.35 * a)); g.addColorStop(1, rgba(c0, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, by);
      for (let i = 0; i <= 20; i++) { const x = x0 + (i / 20) * W, env = Math.sin(Math.PI * i / 20); ctx.lineTo(x, by - (rise + Math.sin(i * 1.7 + t * 14) * 10 * s - (i % 2) * 12 * s) * env); }
      ctx.lineTo(x0 + W, by); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 24; i++) { ctx.globalAlpha = 1 - t; ctx.fillStyle = i % 3 ? c1 : c0; ctx.fillRect(x0 + r01(i, e.seed) * W, e.y + 30 - t * (40 + r01(i + 5, e.seed) * 60), 2, 2); }
    } else if (e.el === "water") {
      // 大波が横から押し寄せる
      const p = easeOut(Math.min(1, t / 0.55)), front = e.spin > 0 ? x0 + p * W * 1.2 : x0 + W - p * W * 1.2;
      const g = ctx.createLinearGradient(0, e.y - 40, 0, e.y + 56);
      g.addColorStop(0, rgba(c0, 0)); g.addColorStop(0.35, rgba(c1, 0.4 * a)); g.addColorStop(0.75, rgba(c2, 0.3 * a)); g.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = g;
      const xa = e.spin > 0 ? x0 : front, xb = e.spin > 0 ? front : x0 + W;
      ctx.beginPath(); ctx.moveTo(xa, e.y + 56);
      for (let i = 0; i <= 14; i++) {
        const x = xa + (i / 14) * (xb - xa), u = (x - x0) / W, env = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
        ctx.lineTo(x, e.y + 56 - (74 * s + Math.sin(i * 0.9 + t * 10) * 8 * s) * env);
      }
      ctx.lineTo(xb, e.y + 56); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 16; i++) { ctx.globalAlpha = a; ctx.fillStyle = c0; ctx.fillRect(front - e.spin * r01(i, e.seed) * 30, e.y - 24 * s - r01(i + 3, e.seed) * 26 * s, 2, 2); }
    } else if (e.el === "wind") {
      // 戦場を旋風が横切る
      ctx.lineCap = "round";
      for (let i = 0; i < 10; i++) {
        const y = e.y + (r01(i, e.seed) - 0.5) * 90 * s, q = clamp01(t * 1.2 - r01(i + 2, e.seed) * 0.2), L = 50 + r01(i + 4, e.seed) * 60;
        const hx = e.spin > 0 ? x0 - 60 + q * (W + 120) : x0 + W + 60 - q * (W + 120);
        line(ctx, hx - L * e.spin, y, hx, y + Math.sin(q * 6 + i) * 6, i % 3 ? 1.6 : 3, i % 2 ? c1 : c0, Math.sin(Math.PI * q) * 0.9);
      }
    } else if (e.el === "earth") {
      // 地割れが戦場を横に走り、土煙が上がる
      const p = easeOut(Math.min(1, t / 0.35)), by = e.y + 34 * s;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a; ctx.strokeStyle = "#1a1008"; ctx.lineWidth = 3; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(e.x, by);
      for (let i = 1; i <= 10; i++) ctx.lineTo(e.x - (i / 10) * W * 0.5 * p, by + (r01(i, e.seed) - 0.5) * 8);
      ctx.moveTo(e.x, by);
      for (let i = 1; i <= 10; i++) ctx.lineTo(e.x + (i / 10) * W * 0.5 * p, by + (r01(i + 20, e.seed) - 0.5) * 8);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.save(); ctx.translate(e.x, by); ctx.scale(1, (60 * s) / Math.max(1, W * 0.5 * p));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, W * 0.5 * p));
      g.addColorStop(0, rgba(c1, 0.4 * a)); g.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, Math.max(1, W * 0.5 * p), Math.PI, 0); ctx.fill();
      ctx.restore();
    } else if (e.el === "light") {
      // 天から光が幾筋も差し込む
      ctx.save(); ctx.translate(e.x, e.y * 0.4); ctx.scale(1, (e.y * 0.9) / Math.max(1, W * 0.6));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6);
      g.addColorStop(0, rgba(c1, 0.28 * a)); g.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = g; ctx.fillRect(-W * 0.6, -W * 0.6, W * 1.2, W * 1.2);
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const x = x0 + ((i + 0.5) / 5) * W + (r01(i, e.seed) - 0.5) * 20, w = 10 + r01(i + 3, e.seed) * 10;
        const gg = ctx.createLinearGradient(0, 0, 0, e.y + 30);
        gg.addColorStop(0, rgba(c1, 0)); gg.addColorStop(1, rgba(c0, 0.5 * a));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(x - w * 0.3, 0); ctx.lineTo(x + w * 0.3, 0); ctx.lineTo(x + w, e.y + 30); ctx.lineTo(x - w, e.y + 30); ctx.closePath(); ctx.fill();
      }
    } else if (e.el === "dark") {
      // 画面の縁から闇が這い込む
      ctx.globalCompositeOperation = "source-over";
      const g = ctx.createRadialGradient(VW / 2, e.y, Math.min(VW, VH) * (0.55 - 0.3 * a), VW / 2, e.y, Math.max(VW, VH) * 0.75);
      g.addColorStop(0, "rgba(20,0,40,0)"); g.addColorStop(1, `rgba(20,0,40,${0.75 * a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, y = e.y + (r01(i, e.seed) - 0.5) * 100, L = W * 0.35 * easeOut(Math.min(1, t / 0.5));
        const xs = side > 0 ? x0 + W : x0;
        ctx.globalAlpha = a * 0.8; ctx.strokeStyle = i % 3 ? c1 : c2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xs, y); ctx.quadraticCurveTo(xs - side * L * 0.5, y + (r01(i + 5, e.seed) - 0.5) * 40, xs - side * L, y + (r01(i + 9, e.seed) - 0.5) * 30); ctx.stroke();
      }
    } else {
      // 無属性: 戦場いっぱいの魔力の環
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = e.col || c1; ctx.lineWidth = 3 * (1 - t) + 0.6;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 20, 20 + easeOut(t) * W * 0.5, 6 + easeOut(t) * 40, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 20, 12 + easeOut(t) * W * 0.38, 4 + easeOut(t) * 30, 0, 0, Math.PI * 2); ctx.stroke();
    }
  },
  // 全体の物理技: 戦場を一文字に薙ぐ大きな斬撃
  fieldslash(ctx, e, t, VW) {
    const W = e.w || VW, col = e.el && e.el !== "none" ? elCol(e.el)[1] : e.crit ? "#ffb040" : "#ff6a3a";
    const sw = Math.min(1, t / 0.4), fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
    const R = W * 0.9, cx = e.x, cy = e.y + R * 0.92 + (e.rot * 30);
    const half = Math.asin(Math.min(1, (W * 0.55) / R));
    const a0 = -Math.PI / 2 - half * e.spin, a1 = a0 + 2 * half * e.spin * sw;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.globalAlpha = fade * 0.45; ctx.strokeStyle = col; ctx.lineWidth = 12 * e.s;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    ctx.globalAlpha = fade; ctx.strokeStyle = "#fff6ea"; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
  },
  // 全体の回復・強化 (隊): 天から柔らかな光が降り、隊の上に光の粒が昇る (col = 色)
  blessing(ctx, e, t, VW, VH) {
    const c = e.col || "#7CFC7C", a = Math.sin(Math.PI * t);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
      const x = VW * (i + 0.5) / 4, w = VW * 0.08;
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.22 * a));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w * 0.3, 0); ctx.lineTo(x + w * 0.3, 0); ctx.lineTo(x + w, VH); ctx.lineTo(x - w, VH); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      const q = clamp01(t * 1.2 - r01(i, e.seed) * 0.2), x = r01(i + 3, e.seed) * VW, y = VH - 4 - q * (30 + r01(i + 6, e.seed) * 50);
      if (i % 4 === 0) star4(ctx, x, y, 3.4, "#ffffff", 1 - q);
      else { ctx.globalAlpha = 1 - q; ctx.fillStyle = c; ctx.fillRect(x, y, 2, 2); }
    }
  },
  // 全体の弱体 (敵): 敵の列の足元に紫の大環が締まり、暗く沈む
  fieldhex(ctx, e, t, VW) {
    const W = e.w || VW, a = Math.sin(Math.PI * t);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 - t; ctx.strokeStyle = "#a050e0"; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 26, W * 0.5 * (1 - t * 0.35), 26 * (1 - t * 0.35), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, e.y - 50, 0, e.y + 40);
    g.addColorStop(0, "rgba(40,0,60,0)"); g.addColorStop(1, `rgba(40,0,60,${0.35 * a})`);
    ctx.fillStyle = g; ctx.fillRect(e.x - W / 2, e.y - 50, W, 90);
  },
  // 上級の技: 唱える間 (踏み込み) に足元へ魔法陣が浮かび、着弾とともに消える
  circle(ctx, e, t) {
    const c = elCol(e.el)[1], R = (e.w ? e.w * 0.32 : 34) * e.s;
    const a = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
    ctx.globalCompositeOperation = "lighter";
    ctx.save(); ctx.translate(e.x, e.y + 22 * e.s); ctx.scale(1, 0.38);
    ctx.rotate(t * 2 * e.spin);
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = c;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const ang = (i * 2 / 5) * Math.PI * 2 - Math.PI / 2; i ? ctx.lineTo(Math.cos(ang) * R * 0.78, Math.sin(ang) * R * 0.78) : ctx.moveTo(Math.cos(ang) * R * 0.78, Math.sin(ang) * R * 0.78); }
    ctx.closePath(); ctx.stroke();
    for (let i = 0; i < 16; i++) { const ang = (i / 16) * Math.PI * 2; ctx.fillStyle = i % 2 ? c : "#ffffff"; ctx.fillRect(Math.cos(ang) * R * 0.9 - 1.5, Math.sin(ang) * R * 0.9 - 1.5, 3, 3); }
    ctx.restore();
  },
});
