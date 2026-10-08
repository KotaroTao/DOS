// 各職の看板技 (Lv40 の技 = souls.js JOB_SIGNATURE) の専用演出。battlefx.js の登録口 registerFx に足す。
// 組み立て式の演出 (skillProfile) の代わりに描き、付く効果の印 (riders) はそのまま重なる。
// テンポの約束は battlefx.js と同じ: 長さは BASE × spdMul で、一手の余韻 (360ms × spdMul) の内に描き切る。
// mode: hit = 当たった敵ごと (多段は e.v = 何撃目) / field = 敵の列に一枚 (e.pts = 当たった敵の位置) /
//       party = 隊の上に一枚 (e.pts = 隊の札の位置) / ally = 回復した味方の位置
import { registerFx, FX } from "./battlefx.js";

const { r01, rgba, clamp01, easeOut, elCol, glow, line, star4 } = FX;
const TAU = Math.PI * 2;
const fadeAfter = (t, k) => (t < k ? 1 : 1 - (t - k) / (1 - k));
function poly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
// 刃の形 (先の尖った細長い菱形): 中心 (x, y)、向き a、長さ L、幅 w
function blade(ctx, x, y, a, L, w) {
  const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
  poly(ctx, [[x - c * L * 0.5, y - s * L * 0.5], [x + nx * w, y + ny * w], [x + c * L * 0.5, y + s * L * 0.5], [x - nx * w, y - ny * w]]);
}
// 光の粒を昇らせる (共通)
function motes(ctx, e, n, x, y, wid, hgt, t, col) {
  for (let i = 0; i < n; i++) {
    const q = clamp01(t * 1.2 - r01(i, e.seed) * 0.25);
    ctx.globalAlpha = (1 - q) * 0.95;
    ctx.fillStyle = i % 3 ? col : "#ffffff";
    ctx.fillRect(x + (r01(i + 3, e.seed) - 0.5) * wid, y - q * hgt * (0.5 + r01(i + 6, e.seed) * 0.5), 2, 2);
  }
}
// 縦の光の柱 (上から y まで)
function pillar(ctx, x, y, w, col, a) {
  const g = ctx.createLinearGradient(0, 0, 0, y);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.75, rgba(col, 0.4 * a)); g.addColorStop(1, rgba("#ffffff", 0.8 * a));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, 0, w, y);
}

const SIG_DRAW = {
  // ===== 戦士 きこく斬: 天から落ちる紅の大太刀、鬼の泣き声のような霊気が昇る =====
  sig_kikoku(ctx, e, t) {
    const p = easeOut(Math.min(1, t / 0.22)), f = fadeAfter(t, 0.3);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const top = e.y - 110, bot = top + (e.y + 40 - top) * p;
    line(ctx, e.x, top, e.x, bot, 16 * (1 - t) + 4, "#ff2a1a", f * 0.55);
    line(ctx, e.x, top, e.x, bot, 3, "#fff0e0", f);
    if (t > 0.2) {
      const q = (t - 0.2) / 0.8;
      ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#ff5a3a"; ctx.lineWidth = 3 * (1 - q) + 0.5;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 30, 10 + q * 60, 3 + q * 14, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const x = e.x + (i - 2.5) * 12 + Math.sin(q * 8 + i) * 5, y = e.y + 10 - q * (40 + r01(i, e.seed) * 30);
        ctx.globalAlpha = (1 - q) * 0.7; ctx.fillStyle = "#e8d8ff";
        ctx.beginPath(); ctx.ellipse(x, y, 3.5, 7, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = (1 - q) * 0.9; ctx.fillStyle = "#1a0010";
        ctx.fillRect(x - 2, y - 2, 1.4, 1.4); ctx.fillRect(x + 0.6, y - 2, 1.4, 1.4);
      }
    }
  },
  // ===== 騎士 城門崩し: 大盾が下から叩きつけられ、石のひびが走る =====
  sig_joumon(ctx, e, t) {
    const p = easeOut(Math.min(1, t / 0.25)), y = e.y + 60 * (1 - p), f = fadeAfter(t, 0.45);
    ctx.globalAlpha = f * 0.85;
    ctx.fillStyle = "#8a96a8";
    poly(ctx, [[e.x - 20, y - 26], [e.x + 20, y - 26], [e.x + 20, y + 4], [e.x, y + 26], [e.x - 20, y + 4]]); ctx.fill();
    ctx.strokeStyle = "#e8eef8"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#c9a24a"; ctx.fillRect(e.x - 2, y - 20, 4, 30); ctx.fillRect(e.x - 12, y - 10, 24, 4);
    if (t > 0.22) {
      const q = (t - 0.22) / 0.78;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 46, "#c8d8ff", Math.max(0, 1 - q * 2));
      ctx.lineJoin = "round";
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.3;
        ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#f0f4ff"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(e.x, e.y);
        let x = e.x, yy = e.y;
        for (let j = 1; j <= 3; j++) { x += Math.cos(a + (r01(j + k * 3, e.seed) - 0.5)) * 12 * easeOut(q); yy += Math.sin(a + (r01(j + k * 3, e.seed) - 0.5)) * 12 * easeOut(q); ctx.lineTo(x, yy); }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < 8; i++) { ctx.globalAlpha = 1 - q; ctx.fillStyle = "#6a6a72"; ctx.fillRect(e.x + (r01(i, e.seed) - 0.5) * 50, e.y + q * q * 60 + r01(i + 4, e.seed) * 10, 3, 3); }
    }
  },
  // ===== 僧侶 オールハイヒール: 天に光の十字が浮かび、隊へ癒しの雨が降る =====
  sig_dialall(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t);
    ctx.globalCompositeOperation = "lighter";
    const cx = VW / 2, cy = VH * 0.22, L = 30 + 14 * easeOut(t);
    glow(ctx, cx, cy, 70, "#ffe9a0", a * 0.8);
    ctx.lineCap = "round";
    line(ctx, cx, cy - L, cx, cy + L * 1.3, 6, "#ffe9a0", a * 0.6);
    line(ctx, cx - L * 0.8, cy, cx + L * 0.8, cy, 6, "#ffe9a0", a * 0.6);
    line(ctx, cx, cy - L, cx, cy + L * 1.3, 2, "#ffffff", a);
    line(ctx, cx - L * 0.8, cy, cx + L * 0.8, cy, 2, "#ffffff", a);
    for (let i = 0; i < 30; i++) {
      const q = clamp01(t * 1.3 - r01(i, e.seed) * 0.3);
      if (q <= 0 || q >= 1) continue;
      const x = cx + (r01(i + 3, e.seed) - 0.5) * VW * 0.95, y = cy + (VH - cy) * q;
      ctx.globalAlpha = Math.sin(Math.PI * q); ctx.fillStyle = i % 3 ? "#7CFC7C" : "#fff6c8";
      ctx.fillRect(x, y, 2, 5);
    }
  },
  // ===== 魔術師 エクスプロージョン: 戦場の真ん中で白熱の大爆発、衝撃の環が列を走る =====
  sig_explosion(ctx, e, t, VW, VH, reduced) {
    const [c0, c1, c2] = elCol("fire");
    ctx.globalCompositeOperation = "lighter";
    if (!reduced && t < 0.18) { ctx.globalAlpha = 0.35 * (1 - t / 0.18); ctx.fillStyle = "#fff4e0"; ctx.fillRect(0, 0, VW, VH); }
    const R = (20 + easeOut(t) * (e.w || VW) * 0.5);
    glow(ctx, e.x, e.y, R, c1, Math.max(0, 1 - t * 1.4));
    glow(ctx, e.x, e.y, R * 0.45, c0, Math.max(0, 1 - t * 2));
    ctx.globalAlpha = 1 - t; ctx.strokeStyle = c0; ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 20, R, R * 0.28, 0, 0, TAU); ctx.stroke();
    for (const [i, p] of (e.pts || []).entries()) {
      const q = clamp01(t * 1.4 - 0.1 - i * 0.04);
      glow(ctx, p.x, p.y, 34 * Math.sin(Math.PI * q), c1, 1 - q);
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 9; i++) {
      const q = clamp01(t * 1.1 - 0.15);
      ctx.globalAlpha = 0.45 * Math.sin(Math.PI * q); ctx.fillStyle = i % 2 ? "#3a2a24" : "#5a3a2a";
      ctx.beginPath(); ctx.arc(e.x + (i - 4) * 14 + Math.sin(i) * 6, e.y - 20 - q * (30 + (i % 3) * 12), 12 + q * 10, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const a = r01(i, e.seed) * TAU, r = easeOut(t) * (40 + r01(i + 4, e.seed) * 90);
      ctx.globalAlpha = 1 - t; ctx.fillStyle = i % 3 ? c1 : c0;
      ctx.fillRect(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.6 + t * t * 30, 2.4, 2.4);
    }
  },
  // ===== 盗賊 朧抜き: 霞の中に三つの残像の太刀筋が走り、一筋に重なる =====
  sig_oboro(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const q = clamp01((t - k * 0.08) / 0.5);
      if (q <= 0) continue;
      const ox = (k - 1) * 22 * (1 - easeOut(Math.min(1, t / 0.5))), sw = Math.min(1, q / 0.5), f = fadeAfter(q, 0.5) * (k === 1 ? 1 : 0.55);
      const x0 = e.x + ox - 30, y0 = e.y + 22, x1 = x0 + 60 * sw, y1 = y0 - 44 * sw;
      line(ctx, x0, y0, x1, y1, 6, "#9ab8d8", f * 0.4);
      line(ctx, x0, y0, x1, y1, 1.6, "#ffffff", f);
    }
    // 薄い霞 (ぼかした淡い光)
    for (let i = 0; i < 6; i++) {
      const x = e.x + (r01(i, e.seed) - 0.5) * 70 + t * 10, y = e.y + (r01(i + 3, e.seed) - 0.5) * 40, R = 14 + r01(i + 6, e.seed) * 10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(200,212,232,${0.16 * Math.sin(Math.PI * t)})`); g.addColorStop(1, "rgba(200,212,232,0)");
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
  },
  // ===== フルヒール: 味方の上に光の柱が立ち、光の翼が開く =====
  sig_madios(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), y = VH - 18;
    ctx.globalCompositeOperation = "lighter";
    pillar(ctx, e.x, y, 26 * (1 - t * 0.4), "#fff0b0", a);
    const open = easeOut(Math.min(1, t / 0.45));
    for (const d of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const len = (26 - k * 4) * open, ang = -Math.PI / 2 + d * (0.5 + k * 0.32) * open;
        ctx.globalAlpha = a * (0.9 - k * 0.15); ctx.fillStyle = k % 2 ? "#fff6d8" : "#ffe9a0";
        blade(ctx, e.x + Math.cos(ang) * len * 0.55, y - 22 + Math.sin(ang) * len * 0.55, ang, len, 3.2); ctx.fill();
      }
    }
    motes(ctx, e, 12, e.x, y, 40, 50, t, "#7CFC7C");
  },
  // ===== 侍 燕返し: 振り下ろしと返す刀で V の字を刻み、燕が飛び去る (e.v = 何撃目) =====
  sig_tsubame(ctx, e, t) {
    const up = e.v % 2 === 1, sw = Math.min(1, t / 0.25), f = fadeAfter(t, 0.35);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const x0 = up ? e.x : e.x - 30, y0 = up ? e.y + 22 : e.y - 28, x1 = up ? e.x + 30 : e.x, y1 = up ? e.y - 28 : e.y + 22;
    const ex = x0 + (x1 - x0) * sw, ey = y0 + (y1 - y0) * sw;
    line(ctx, x0, y0, ex, ey, 7, "#7fc8ff", f * 0.5);
    line(ctx, x0, y0, ex, ey, 2, "#ffffff", f);
    if (up && t > 0.25) {
      const q = (t - 0.25) / 0.75, bx = e.x + 30 + q * 60, by = e.y - 30 - q * 40;
      ctx.globalAlpha = 1 - q; ctx.fillStyle = "#e8f4ff";
      poly(ctx, [[bx, by], [bx - 10, by - 6], [bx - 4, by], [bx - 10, by + 5]]); ctx.fill();
    }
  },
  // ===== 狂戦士 鬼神砕き: 紅の闘気が噴き、地が陥没して紅い亀裂と炎が立つ =====
  sig_kijin(ctx, e, t) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 60, "#ff2a1a", Math.max(0, 1 - t * 1.6));
    const by = e.y + 24;
    ctx.globalAlpha = 1 - t; ctx.strokeStyle = "#ff3a1a"; ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath(); ctx.ellipse(e.x, by, 12 + easeOut(t) * 56, 4 + easeOut(t) * 15, 0, 0, TAU); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU, L = easeOut(Math.min(1, t / 0.4)) * (30 + r01(k, e.seed) * 26);
      line(ctx, e.x, by, e.x + Math.cos(a) * L, by + Math.sin(a) * L * 0.3, 2, "#ff6a3a", 1 - t);
    }
    for (let i = 0; i < 7; i++) {
      const x = e.x + (i - 3) * 13, h = (20 + r01(i, e.seed) * 26) * Math.sin(Math.PI * Math.min(1, t * 1.4));
      ctx.globalAlpha = (1 - t) * 0.8; ctx.fillStyle = i % 2 ? "#ff3a1a" : "#a00a0a";
      poly(ctx, [[x - 5, by], [x + Math.sin(t * 12 + i) * 3, by - h], [x + 5, by]]); ctx.fill();
    }
  },
  // ===== 狩人 首狩り: 照準が首元へ締まり、一閃が首を払う =====
  sig_kubikari(ctx, e, t) {
    const hy = e.y - 18, close = easeOut(Math.min(1, t / 0.3)), R = 30 - close * 18;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fadeAfter(t, 0.35); ctx.strokeStyle = "#ff4a3a"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(e.x, hy, R, 0, TAU); ctx.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; line(ctx, e.x + Math.cos(a) * (R + 2), hy + Math.sin(a) * (R + 2), e.x + Math.cos(a) * (R + 9), hy + Math.sin(a) * (R + 9), 1.6, "#ff4a3a", fadeAfter(t, 0.35)); }
    if (t > 0.28) {
      const q = (t - 0.28) / 0.72, sw = Math.min(1, q / 0.3);
      ctx.lineCap = "round";
      line(ctx, e.x - 40, hy + 4, e.x - 40 + 80 * sw, hy - 4, 6, "#ffb040", (1 - q) * 0.5);
      line(ctx, e.x - 40, hy + 4, e.x - 40 + 80 * sw, hy - 4, 1.6, "#ffffff", 1 - q);
    }
  },
  // ===== 暗殺者 死の刻印: 紫の死の紋が刻まれ、闇の刃が走る =====
  sig_shinokokuin(ctx, e, t) {
    const [c0, c1, c2] = elCol("dark"), a = Math.sin(Math.PI * Math.min(1, t * 1.2));
    ctx.globalCompositeOperation = "lighter";
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t * 0.8);
    ctx.globalAlpha = a; ctx.strokeStyle = c1; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.stroke();
    poly(ctx, [[0, 20], [-17, -10], [17, -10]]); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = a; ctx.fillStyle = c0;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(e.x, e.y, 1.8, 0, TAU); ctx.fill();
    if (t > 0.35) {
      const q = (t - 0.35) / 0.65, sw = Math.min(1, q / 0.3);
      ctx.lineCap = "round";
      line(ctx, e.x + 34, e.y - 30, e.x + 34 - 68 * sw, e.y - 30 + 60 * sw, 6, c2, (1 - q) * 0.8);
      line(ctx, e.x + 34, e.y - 30, e.x + 34 - 68 * sw, e.y - 30 + 60 * sw, 1.4, c0, 1 - q);
    }
  },
  // ===== 聖騎士 聖光斬: 金の聖剣が天から突き立ち、光が弾けて癒しが戻る =====
  sig_seikouzan(ctx, e, t) {
    const p = easeOut(Math.min(1, t / 0.25)), f = fadeAfter(t, 0.4), y = e.y - 70 + 60 * p;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = f; ctx.fillStyle = "#ffe9a0";
    blade(ctx, e.x, y, Math.PI / 2, 70, 5); ctx.fill();
    ctx.fillStyle = "#ffffff"; blade(ctx, e.x, y, Math.PI / 2, 60, 1.6); ctx.fill();
    ctx.fillStyle = "#c9a24a"; ctx.fillRect(e.x - 12, y - 37, 24, 4);
    if (t > 0.22) glow(ctx, e.x, e.y + 4, 50, "#ffe9a0", 1 - (t - 0.22) / 0.78);
  },
  // ===== 守護者 攻防一体: 隊の前に六角の障壁が重なり、剣と盾の紋が閃く =====
  sig_kouboui(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), cx = VW / 2, cy = VH - 34;
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const R = (26 + k * 14) * (0.8 + 0.2 * easeOut(t));
      ctx.globalAlpha = a * (0.9 - k * 0.25); ctx.strokeStyle = k ? "#7fb8ff" : "#e0ecff"; ctx.lineWidth = 2;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + Math.PI / 6; i ? ctx.lineTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * 0.7) : ctx.moveTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R * 0.7); } ctx.closePath(); ctx.stroke();
    }
    ctx.lineCap = "round";
    line(ctx, cx - 14, cy - 14, cx + 14, cy + 14, 3, "#ffd27a", a);
    line(ctx, cx + 14, cy - 14, cx - 14, cy + 14, 3, "#ffd27a", a);
  },
  // ===== 魔法剣士 魔焔斬: 炎の粒でできた三日月が焼き断ち、火の紋が砕ける =====
  sig_maenzan(ctx, e, t) {
    const [c0, c1, c2] = elCol("fire"), sw = Math.min(1, t / 0.35), f = fadeAfter(t, 0.4);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const k = i / 26; if (k > sw) break;
      const a = -2.2 + 2.8 * k, r = 34 + Math.sin(i * 1.7) * 3;
      ctx.globalAlpha = f * (0.5 + 0.5 * k); ctx.fillStyle = i % 3 ? c1 : c0;
      const sz = 3 + (1 - Math.abs(k - 0.5) * 2) * 3;
      ctx.fillRect(e.x + Math.cos(a) * r - sz / 2, e.y + Math.sin(a) * r - sz / 2 - t * 8, sz, sz);
    }
    if (t > 0.3) {
      const q = (t - 0.3) / 0.7;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, off = q * 26; ctx.globalAlpha = 1 - q; ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * off, e.y + Math.sin(a) * off, 16, a, a + 0.8); ctx.stroke(); }
    }
  },
  // ===== 修行僧 金剛連打: 金色の拳の衝撃が三度、最後は大きく弾ける (e.v = 何撃目) =====
  sig_kongou(ctx, e, t) {
    const big = e.v >= 2 ? 1.5 : 1, ox = [-14, 14, 0][e.v % 3], oy = [-8, 4, 0][e.v % 3];
    const x = e.x + ox, y = e.y + oy, q = easeOut(t);
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, x, y, 30 * big, "#ffd27a", Math.max(0, 1 - t * 2.2));
    ctx.globalAlpha = 1 - t; ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 3 * (1 - t) + 0.8;
    ctx.beginPath(); ctx.arc(x, y, (6 + q * 24) * big, 0, TAU); ctx.stroke();
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, r0 = (10 + q * 16) * big, r1 = r0 + 10 * (1 - t) * big; line(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, 2, "#fff6d8", 1 - t); }
    ctx.globalAlpha = 1 - t; ctx.fillStyle = "#fff6d8";
    ctx.beginPath(); ctx.arc(x, y, 5 * big * (1 - t), 0, TAU); ctx.fill();
  },
  // ===== 呪術師 毒霧: 緑紫の毒の霧が列を覆い、泡が弾ける =====
  sig_dokugiri(ctx, e, t, VW) {
    const W = e.w || VW, a = Math.sin(Math.PI * t);
    for (let i = 0; i < 14; i++) {
      const x = e.x + (r01(i, e.seed) - 0.5) * W + t * 20 * (i % 2 ? 1 : -1), y = e.y + (r01(i + 3, e.seed) - 0.5) * 50;
      const R = (18 + r01(i + 6, e.seed) * 16) * (0.7 + 0.3 * easeOut(t));
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(i % 3 ? "#5aa040" : "#8a50b0", 0.45 * a)); g.addColorStop(1, rgba("#3a6a2a", 0));
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = "lighter";
    for (const [i, p] of (e.pts || []).entries()) {
      for (let k = 0; k < 4; k++) {
        const q = clamp01(t * 1.3 - k * 0.12 - i * 0.03);
        ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = "#a8ff7a"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x + (k - 1.5) * 9, p.y + 6 - q * 26, 2 + k % 2, 0, TAU); ctx.stroke();
      }
    }
  },
  // ===== 仙人 霞の帳: 白い霞の帳が戦場を横に流れ、隊に癒しの粒 =====
  sig_kasumi(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t);
    for (let k = 0; k < 4; k++) {
      const y = VH * (0.25 + k * 0.17), off = (t * 60 + k * 40) % VW;
      const g = ctx.createLinearGradient(0, y - 18, 0, y + 18);
      g.addColorStop(0, "rgba(220,235,255,0)"); g.addColorStop(0.5, `rgba(220,235,255,${0.13 * a})`); g.addColorStop(1, "rgba(220,235,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, y + 18);
      for (let i = 0; i <= 12; i++) { const x = (i / 12) * VW; ctx.lineTo(x, y - 10 + Math.sin(i * 0.9 + off * 0.05 + k) * 8); }
      ctx.lineTo(VW, y + 18); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = "lighter";
    for (const p of e.pts || []) motes(ctx, e, 6, p.x, VH - 6, 30, 40, t, "#9be8c0");
  },
  // ===== 義賊 追い剥ぎ: 素早い×の太刀、金貨が噴き出す =====
  sig_oihagi(ctx, e, t, VW, VH) {
    const sw = Math.min(1, t / 0.2), f = fadeAfter(t, 0.3);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    line(ctx, e.x - 22, e.y - 22, e.x - 22 + 44 * sw, e.y - 22 + 44 * sw, 1.8, "#ffffff", f);
    line(ctx, e.x + 22, e.y - 22, e.x + 22 - 44 * sw, e.y - 22 + 44 * sw, 1.8, "#ffffff", f);
    for (let i = 0; i < 12; i++) {
      const q = clamp01((t - 0.12) * 1.3), vx = (r01(i, e.seed) - 0.5) * 120, vy = -(60 + r01(i + 4, e.seed) * 70);
      ctx.globalAlpha = 1 - q; ctx.fillStyle = i % 3 ? "#ffd84a" : "#fff6c8";
      ctx.beginPath(); ctx.ellipse(e.x + vx * q, e.y + vy * q + 160 * q * q, 3.2 * Math.abs(Math.cos(t * 16 + i)) + 0.6, 3.2, 0, 0, TAU); ctx.fill();
    }
  },
  // ===== 魔盗賊 魔力強奪: 青い魔力の珠が引き抜かれ、渦を巻いて隊へ吸い込まれる =====
  sig_goudatsu(ctx, e, t, VW, VH) {
    const tx = VW / 2, ty = VH - 6;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 34, "#6aa8ff", Math.max(0, 1 - t * 2));
    for (let i = 0; i < 7; i++) {
      const q = clamp01(t * 1.3 - i * 0.05), u = 1 - q;
      const sp = i * 0.9 + q * 8, r = 16 * u;
      const bx = e.x * u + tx * q, by = e.y * u + ty * q - Math.sin(Math.PI * q) * 40;
      const x = bx + Math.cos(sp) * r, y = by + Math.sin(sp) * r * 0.6;
      ctx.globalAlpha = Math.sin(Math.PI * Math.max(0.05, q)); ctx.fillStyle = "#6aa8ff";
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = "#e0f0ff"; ctx.beginPath(); ctx.arc(x - 1.2, y - 1.2, 1.6, 0, TAU); ctx.fill();
    }
  },
  // ===== 聖戦士 十字斬: 縦と横の光の太刀筋が十字を結び、しばし輝く (e.v = 何撃目) =====
  sig_juuji(ctx, e, t) {
    const vert = e.v % 2 === 0, sw = Math.min(1, t / 0.22), f = fadeAfter(t, 0.45), L = 40;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const [x0, y0, x1, y1] = vert ? [e.x, e.y - L, e.x, e.y - L + 2 * L * sw] : [e.x - L * 0.8, e.y - 6, e.x - L * 0.8 + 1.6 * L * sw, e.y - 6];
    line(ctx, x0, y0, x1, y1, 9, "#ffe9a0", f * 0.5);
    line(ctx, x0, y0, x1, y1, 2.4, "#ffffff", f);
    if (!vert && t > 0.2) { glow(ctx, e.x, e.y - 6, 44, "#ffe9a0", 1 - (t - 0.2) / 0.8); star4(ctx, e.x, e.y - 6, 12 * (1 - t), "#ffffff", 1 - t); }
  },
  // ===== 魔闘士 破魔の拳: 青紫の魔力の拳が叩き込まれ、六角の守りが砕ける =====
  sig_hamaken(ctx, e, t) {
    const p = easeOut(Math.min(1, t / 0.2)), x = e.x - 40 * (1 - p);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = fadeAfter(t, 0.3); ctx.fillStyle = "#9a7aff";
    ctx.beginPath(); ctx.arc(x, e.y, 10, 0, TAU); ctx.fill();
    ctx.fillRect(x - 24, e.y - 6, 16, 12);
    if (t > 0.18) {
      const q = (t - 0.18) / 0.82;
      glow(ctx, e.x, e.y, 40, "#9a7aff", 1 - q);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6, a2 = a + TAU / 6, off = easeOut(q) * 22, ox = Math.cos(a + TAU / 12) * off, oy = Math.sin(a + TAU / 12) * off;
        line(ctx, e.x + Math.cos(a) * 26 + ox, e.y + Math.sin(a) * 26 + oy, e.x + Math.cos(a2) * 26 + ox, e.y + Math.sin(a2) * 26 + oy, 2, i % 2 ? "#c8b8ff" : "#ffffff", 1 - q);
      }
    }
  },
  // ===== 魔騎士 魔喰いの太刀: 黒炎をまとう太刀が喰らいつき、魔力の粒が奪われる =====
  sig_magui(ctx, e, t, VW, VH) {
    const [c0, c1, c2] = elCol("dark"), sw = Math.min(1, t / 0.3), f = fadeAfter(t, 0.4);
    ctx.lineCap = "round";
    for (let k = 0; k < 2; k++) {
      const a0 = k ? 0.3 : -2.8, a1 = a0 + (k ? 2.2 : 2.2) * sw;
      ctx.globalAlpha = f * 0.85; ctx.strokeStyle = c2; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(e.x, e.y, 30, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = f; ctx.strokeStyle = c1; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 30, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 8; i++) {
      const q = clamp01(t * 1.2 - 0.2 - i * 0.03), x = e.x + (VW / 2 - e.x) * q + (r01(i, e.seed) - 0.5) * 30 * (1 - q), y = e.y + (VH - 6 - e.y) * q;
      ctx.globalAlpha = Math.sin(Math.PI * q); ctx.fillStyle = i % 2 ? "#6aa8ff" : c0; ctx.fillRect(x, y, 2.4, 2.4);
    }
  },
  // ===== 神殿騎士 聖域の鐘: 天に大鐘が鳴り、音の波紋が隊へ降りる =====
  sig_kane(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), cx = VW / 2, cy = VH * 0.2, sway = Math.sin(t * 14) * 0.18 * (1 - t);
    ctx.save(); ctx.translate(cx, cy - 18); ctx.rotate(sway);
    ctx.globalAlpha = a; ctx.fillStyle = "#c9a24a";
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-12, 10, -20, 34); ctx.lineTo(20, 34); ctx.quadraticCurveTo(12, 10, 6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff0b0"; ctx.fillRect(-20, 31, 40, 3); ctx.beginPath(); ctx.arc(0, 38, 3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 4; k++) {
      const q = clamp01(t * 1.3 - k * 0.12);
      if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = (1 - q) * 0.8; ctx.strokeStyle = "#ffe9a0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 20 + q * (VH - cy - 30), 30 + q * VW * 0.45, 8 + q * 20, 0, 0, Math.PI); ctx.stroke();
    }
  },
  // ===== 祓魔師 破邪の太刀: 護符が輪を描いて舞い、白刃が祓う =====
  sig_haja(ctx, e, t) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 5, r = 34 - easeOut(t) * 10, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.globalAlpha = fadeAfter(t, 0.5); ctx.fillStyle = "#f4ecd8"; ctx.fillRect(-3, -7, 6, 14);
      ctx.fillStyle = "#c82a1a"; ctx.fillRect(-1.5, -4, 3, 3); ctx.fillRect(-0.6, 0, 1.2, 5);
      ctx.restore();
    }
    if (t > 0.3) {
      const q = (t - 0.3) / 0.7, sw = Math.min(1, q / 0.3);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      line(ctx, e.x - 36, e.y - 10, e.x - 36 + 72 * sw, e.y + 10 * sw - 10 + 20 * sw, 7, "#ffffff", (1 - q) * 0.5);
      line(ctx, e.x - 36, e.y - 10, e.x - 36 + 72 * sw, e.y + 10 * sw - 10 + 20 * sw, 2, "#ffffff", 1 - q);
      glow(ctx, e.x, e.y, 40, "#ffffff", (1 - q) * 0.6);
    }
  },
  // ===== 結界師 攻守の法陣: 敵の列の下に方陣が回り、隊の前に守りの環 =====
  sig_houjin(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), W = (e.w || VW) * 0.55;
    ctx.globalCompositeOperation = "lighter";
    ctx.save(); ctx.translate(e.x, e.y + 28); ctx.scale(1, 0.32); ctx.rotate(t * 1.4);
    ctx.globalAlpha = a; ctx.strokeStyle = "#c8a0ff"; ctx.lineWidth = 2.4;
    ctx.strokeRect(-W, -W, 2 * W, 2 * W); ctx.rotate(Math.PI / 4); ctx.strokeStyle = "#9ab8ff"; ctx.strokeRect(-W * 0.8, -W * 0.8, 1.6 * W, 1.6 * W);
    ctx.beginPath(); ctx.arc(0, 0, W * 0.55, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = a; ctx.strokeStyle = "#9be8ff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(VW / 2, VH - 16, VW * 0.42, 14, 0, Math.PI, TAU); ctx.stroke();
  },
  // ===== 秘術師 禁呪開帳: 宙に裂け目が開き、闇の触手が溢れ出す =====
  sig_kinju(ctx, e, t) {
    const [c0, c1, c2] = elCol("dark"), open = Math.sin(Math.PI * Math.min(1, t * 1.15)), H = 40;
    ctx.globalAlpha = 0.95 * open; ctx.fillStyle = "#08000e";
    ctx.beginPath(); ctx.moveTo(e.x, e.y - H); ctx.quadraticCurveTo(e.x + 12 * open, e.y, e.x, e.y + H); ctx.quadraticCurveTo(e.x - 12 * open, e.y, e.x, e.y - H); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = c1; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const y = e.y + (i - 3) * 10, side = i % 2 ? 1 : -1, L = easeOut(Math.min(1, t / 0.5)) * (24 + r01(i, e.seed) * 22);
      ctx.globalAlpha = open * 0.85; ctx.strokeStyle = i % 3 ? c1 : c2; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(e.x, y); ctx.quadraticCurveTo(e.x + side * L * 0.6, y - 14 * Math.sin(t * 9 + i), e.x + side * L, y + 6 * Math.cos(t * 7 + i)); ctx.stroke();
    }
    for (let i = 0; i < 8; i++) { ctx.globalAlpha = open; ctx.fillStyle = c0; ctx.fillRect(e.x + (r01(i, e.seed) - 0.5) * 60, e.y - t * 30 + (r01(i + 3, e.seed) - 0.5) * 50, 2, 2); }
  },
  // ===== 審問官 断罪の鉄槌: 金の大槌が振り下ろされ、衝撃の環が広がる =====
  sig_tettsui(ctx, e, t) {
    // 右下の担い手を支点に、頭上から敵へ振り下ろす
    const p = Math.min(1, t / 0.25), f = fadeAfter(t, 0.35);
    const px = e.x + 50, py = e.y + 30, aEnd = Math.atan2(e.y - py, e.x - px), L = Math.hypot(e.x - px, e.y - py);
    const ang = aEnd + 1.9 * (1 - p * p), hx = px + Math.cos(ang) * L, hy = py + Math.sin(ang) * L;
    ctx.globalAlpha = f; ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    ctx.fillStyle = "#e8c860"; ctx.fillRect(-8, -13, 16, 26); ctx.fillStyle = "#fff6d0"; ctx.fillRect(-8, -13, 16, 4);
    ctx.restore();
    if (t > 0.22) {
      const q = (t - 0.22) / 0.78;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, e.x, e.y, 46, "#ffe9a0", 1 - q);
      for (let k = 0; k < 2; k++) { ctx.globalAlpha = 1 - q; ctx.strokeStyle = k ? "#fff6d0" : "#ffd27a"; ctx.lineWidth = 3 - k; ctx.beginPath(); ctx.ellipse(e.x, e.y + 20, 10 + easeOut(q) * (56 - k * 16), 3 + easeOut(q) * (14 - k * 4), 0, 0, TAU); ctx.stroke(); }
    }
  },
  // ===== 大司教 聖句の加護: 聖句の輪が味方を巡り、頭上に金の光輪 =====
  sig_seiku(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), y = VH - 22;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 18; i++) {
      const an = (i / 18) * TAU + t * 4, x = e.x + Math.cos(an) * 30, yy = y + Math.sin(an) * 10;
      ctx.globalAlpha = a * (Math.sin(an) > 0 ? 1 : 0.45); ctx.fillStyle = "#ffe9a0";
      ctx.fillRect(x - 1.5, yy - 2, 3, i % 3 ? 2 : 4);
    }
    ctx.globalAlpha = a; ctx.strokeStyle = "#fff0b0"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(e.x, y - 34 - 6 * easeOut(t), 16, 5, 0, 0, TAU); ctx.stroke();
    motes(ctx, e, 10, e.x, y + 10, 40, 40, t, "#7CFC7C");
  },
  // ===== 苦行僧 捨身の行: 己の血の気が紅く昇って敵へ注がれ、白紅に弾ける =====
  sig_shashin(ctx, e, t, VW, VH) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 14; i++) {
      const q = clamp01(t * 1.6 - r01(i, e.seed) * 0.4);
      if (q <= 0 || q >= 1) continue;
      const sx = VW / 2 + (r01(i + 3, e.seed) - 0.5) * 80, u = 1 - q;
      const x = sx * u + e.x * q, y = (VH - 4) * u + e.y * q - Math.sin(Math.PI * q) * 30;
      ctx.globalAlpha = 0.9; ctx.fillStyle = i % 3 ? "#ff3a2a" : "#ffd0c0"; ctx.fillRect(x, y, 2.6, 2.6);
    }
    if (t > 0.4) {
      const q = (t - 0.4) / 0.6;
      glow(ctx, e.x, e.y, 52, "#ff3a2a", 1 - q);
      star4(ctx, e.x, e.y, 26 * (1 - q * 0.5), "#ffffff", 1 - q);
    }
  },
  // ===== 勇者 聖剣奮迅: 戦場の中央に聖剣が突き立ち、光が扇に走り、隊に光が降る =====
  sig_seiken(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), p = easeOut(Math.min(1, t / 0.25)), y = e.y - 60 + 60 * p;
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 7; k++) {
      const an = Math.PI * (0.15 + 0.7 * (k / 6)), L = (e.w || VW) * 0.6 * easeOut(clamp01((t - 0.2) / 0.5));
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = "#ffe9a0";
      poly(ctx, [[e.x, e.y + 10], [e.x - Math.cos(an - 0.05) * L, e.y + 10 - Math.sin(an - 0.05) * L * 0.5], [e.x - Math.cos(an + 0.05) * L, e.y + 10 - Math.sin(an + 0.05) * L * 0.5]]); ctx.fill();
    }
    ctx.globalAlpha = fadeAfter(t, 0.5); ctx.fillStyle = "#ffffff";
    blade(ctx, e.x, y, Math.PI / 2, 80, 6); ctx.fill();
    ctx.fillStyle = "#c9a24a"; ctx.fillRect(e.x - 14, y - 42, 28, 5);
    for (const p2 of e.pts || []) glow(ctx, p2.x, p2.y, 30, "#ffe9a0", clamp01((t - 0.25) / 0.2) * (1 - t));
    motes(ctx, e, 20, VW / 2, VH - 4, VW * 0.9, 50, clamp01((t - 0.3) / 0.7), "#7CFC7C");
  },
  // ===== 阿修羅 阿修羅斬: 六本の腕の太刀筋が撃つたびに角度を変えて放射する (e.v = 何撃目) =====
  sig_ashura(ctx, e, t) {
    const a = (e.v * 60 + 15) * Math.PI / 180, sw = Math.min(1, t / 0.22), f = fadeAfter(t, 0.3), L = 36 + e.v * 3;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const x0 = e.x - Math.cos(a) * L, y0 = e.y - Math.sin(a) * L, x1 = x0 + Math.cos(a) * 2 * L * sw, y1 = y0 + Math.sin(a) * 2 * L * sw;
    line(ctx, x0, y0, x1, y1, 8, e.v >= 4 ? "#ffd27a" : "#ff3a2a", f * 0.5);
    line(ctx, x0, y0, x1, y1, 2, "#fff0e0", f);
    if (e.v >= 4 && t > 0.2) { const q = (t - 0.2) / 0.8; glow(ctx, e.x, e.y, 56, "#ff6a2a", 1 - q); ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#ffd27a"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(e.x, e.y, 10 + q * 44, 0, TAU); ctx.stroke(); }
  },
  // ===== 竜騎士 竜墜とし: 天から斜めに急降下する一閃、竜鱗のような光の尾と陥没 =====
  sig_ryuzetsu(ctx, e, t, VW) {
    const p = easeOut(Math.min(1, t / 0.28)), sx = e.x + VW * 0.35, sy = -20;
    const hx = sx + (e.x - sx) * p, hy = sy + (e.y - sy) * p, f = fadeAfter(t, 0.35);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const tx = hx + (sx - e.x) * 0.35, ty = hy + (sy - e.y) * 0.35;
    line(ctx, tx, ty, hx, hy, 12, "#7fd0ff", f * 0.4);
    line(ctx, tx, ty, hx, hy, 2.6, "#ffffff", f);
    for (let i = 0; i < 6; i++) { const k = i / 6, x = hx + (tx - hx) * k, y = hy + (ty - hy) * k; ctx.globalAlpha = f * (1 - k); ctx.fillStyle = "#bfe8ff"; poly(ctx, [[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]]); ctx.fill(); }
    if (t > 0.26) {
      const q = (t - 0.26) / 0.74;
      glow(ctx, e.x, e.y, 50, "#7fd0ff", 1 - q);
      ctx.globalAlpha = 1 - q; ctx.strokeStyle = "#bfe8ff"; ctx.lineWidth = 3 * (1 - q) + 0.6;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 22, 12 + easeOut(q) * 50, 4 + easeOut(q) * 13, 0, 0, TAU); ctx.stroke();
    }
  },
  // ===== 死霊術師 冥魂喰らい: 敵から青白い魂が抜き出され、渦を巻いて術者へ吸われる =====
  sig_meikon(ctx, e, t, VW, VH) {
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, e.x, e.y, 40, "#a050e0", Math.max(0, 1 - t * 1.8));
    for (let i = 0; i < 4; i++) {
      const q = clamp01(t * 1.25 - i * 0.08), u = 1 - q, sp = i * 1.6 + q * 7;
      const bx = e.x * u + (VW / 2) * q, by = e.y * u + (VH - 8) * q - Math.sin(Math.PI * q) * 36;
      const x = bx + Math.cos(sp) * 14 * u, y = by + Math.sin(sp) * 6 * u;
      ctx.globalAlpha = Math.sin(Math.PI * Math.max(0.05, q)) * 0.9; ctx.fillStyle = "#cfe0ff";
      ctx.beginPath(); ctx.ellipse(x, y, 5, 7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.quadraticCurveTo(x - Math.cos(sp) * 10, y + 14, x + Math.sin(sp) * 4, y + 16); ctx.lineTo(x + 4, y + 4); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#14001e"; ctx.fillRect(x - 2.5, y - 2, 1.6, 1.8); ctx.fillRect(x + 1, y - 2, 1.6, 1.8);
      ctx.globalCompositeOperation = "lighter";
    }
  },
  // ===== 賢者 森羅の裁き: 六属性の珠が列の上を巡り、それぞれ敵へ降り注ぐ =====
  sig_shinra(ctx, e, t, VW) {
    const cols = ["#ff8a3c", "#4fb4ff", "#7fe0a8", "#c89a5a", "#ffe9a0", "#a050e0"], W = (e.w || VW) * 0.4, cy = e.y - 50;
    ctx.globalCompositeOperation = "lighter";
    const pts = e.pts && e.pts.length ? e.pts : [{ x: e.x, y: e.y }];
    for (let i = 0; i < 6; i++) {
      const orbit = Math.min(1, t / 0.4), an = (i / 6) * TAU + t * 5;
      const ox = e.x + Math.cos(an) * W, oy = cy + Math.sin(an) * 12;
      if (t < 0.45) {
        ctx.globalAlpha = orbit; ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.arc(ox, oy, 5, 0, TAU); ctx.fill();
        glow(ctx, ox, oy, 12, cols[i], orbit * 0.7);
      } else {
        const q = (t - 0.45) / 0.55, tg = pts[i % pts.length], sw = Math.min(1, q / 0.35);
        ctx.lineCap = "round";
        line(ctx, ox, oy, ox + (tg.x - ox) * sw, oy + (tg.y - oy) * sw, 2.6, cols[i], 1 - q);
        if (sw >= 1) glow(ctx, tg.x + (i - 2.5) * 4, tg.y, 22, cols[i], 1 - q);
      }
    }
    ctx.globalAlpha = Math.sin(Math.PI * t) * 0.6; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(e.x, cy, W, 12, 0, 0, TAU); ctx.stroke();
  },
  // ===== 枢機卿 聖油の秘跡: 金の聖油の雫が隊に滴り、六角の守りがきらめく =====
  sig_seiyu(ctx, e, t, VW, VH) {
    ctx.globalCompositeOperation = "lighter";
    for (const [i, p] of (e.pts || []).entries()) {
      const q = clamp01(t * 1.5 - i * 0.06), y = (VH - 30) * Math.min(1, q / 0.6);
      if (q < 0.6) { ctx.globalAlpha = 1; ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.moveTo(p.x, y - 6); ctx.quadraticCurveTo(p.x + 4, y, p.x, y + 3); ctx.quadraticCurveTo(p.x - 4, y, p.x, y - 6); ctx.fill(); }
      else {
        const qq = (q - 0.6) / 0.4;
        ctx.globalAlpha = 1 - qq; ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(p.x, VH - 26, 4 + qq * 20, 2 + qq * 5, 0, 0, TAU); ctx.stroke();
        glow(ctx, p.x, VH - 26, 24, "#ffe9a0", (1 - qq) * 0.7);
      }
    }
    const a = clamp01((t - 0.5) / 0.2) * fadeAfter(t, 0.7);
    for (let i = 0; i < 9; i++) {
      const x = VW * (i + 0.5) / 9, R = 9;
      ctx.globalAlpha = a * 0.7; ctx.strokeStyle = "#9be8ff"; ctx.lineWidth = 1.2;
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU; k ? ctx.lineTo(x + Math.cos(an) * R, VH - 40 + Math.sin(an) * R) : ctx.moveTo(x + Math.cos(an) * R, VH - 40 + Math.sin(an) * R); } ctx.closePath(); ctx.stroke();
    }
  },
  // ===== 大魔導 深淵の波動: 黒い穴から闇の波紋が幾重にも広がり、封印の紋が締まる =====
  sig_shinen(ctx, e, t) {
    const [c0, c1, c2] = elCol("dark");
    ctx.globalAlpha = 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.2));
    ctx.fillStyle = "#05000a"; ctx.beginPath(); ctx.arc(e.x, e.y, 12 * Math.sin(Math.PI * Math.min(1, t * 1.2)), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 4; k++) {
      const q = clamp01(t * 1.4 - k * 0.12);
      if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = (1 - q) * 0.9; ctx.strokeStyle = k % 2 ? c1 : c2; ctx.lineWidth = 3 * (1 - q) + 0.6;
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + q * 56, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = Math.sin(Math.PI * t); ctx.strokeStyle = c0; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, TAU); ctx.stroke();
  },
  // ===== 法術師 法障壁: 隊の上に六角の板が組み上がり、光の天蓋になる =====
  sig_houshou(ctx, e, t, VW, VH) {
    const a = Math.sin(Math.PI * t), cx = VW / 2, cy = VH + 30, R = VW * 0.5;
    ctx.globalCompositeOperation = "lighter";
    let n = 0;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 9 - row * 2; i++) {
        const k = (i + 0.5) / (9 - row * 2), an = Math.PI + Math.PI * k, rr = R * (1 - row * 0.22);
        const x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.6, show = clamp01(t * 2.2 - n * 0.04);
        n++;
        if (show <= 0) continue;
        ctx.globalAlpha = a * show * 0.75; ctx.strokeStyle = row % 2 ? "#9be8ff" : "#d8f4ff"; ctx.lineWidth = 1.4;
        ctx.beginPath(); for (let s = 0; s < 6; s++) { const ha = (s / 6) * TAU; s ? ctx.lineTo(x + Math.cos(ha) * 10, y + Math.sin(ha) * 10) : ctx.moveTo(x + Math.cos(ha) * 10, y + Math.sin(ha) * 10); } ctx.closePath(); ctx.stroke();
      }
    }
  },
};

const SIG_DUR = {};
for (const k of Object.keys(SIG_DRAW)) SIG_DUR[k] = 340;
Object.assign(SIG_DUR, { sig_tsubame: 260, sig_kongou: 240, sig_juuji: 280, sig_ashura: 230, sig_explosion: 360, sig_dialall: 360, sig_seiken: 360 });

// 技の鍵 → 専用演出 (keys は SPELLS の鍵 = souls.js JOB_SIGNATURE の値)
const SIGS = {
  KIKOKU: { type: "sig_kikoku", mode: "hit" },
  JOUMON: { type: "sig_joumon", mode: "hit" },
  DIALALL: { type: "sig_dialall", mode: "party" },
  TILTOWAIT: { type: "sig_explosion", mode: "field" },
  OBORO: { type: "sig_oboro", mode: "hit" },
  MADIOS: { type: "sig_madios", mode: "ally" },
  TSUBAMEGAESHI: { type: "sig_tsubame", mode: "hit" },
  KIJINKUDAKI: { type: "sig_kijin", mode: "hit" },
  KUBIKARI: { type: "sig_kubikari", mode: "hit" },
  SHINOKOKUIN: { type: "sig_shinokokuin", mode: "hit" },
  SEIKOUZAN: { type: "sig_seikouzan", mode: "hit" },
  KOUBOUITTAI: { type: "sig_kouboui", mode: "party" },
  MAENZAN: { type: "sig_maenzan", mode: "hit" },
  KONGOURENDA: { type: "sig_kongou", mode: "hit" },
  DOKUGIRI: { type: "sig_dokugiri", mode: "field" },
  KASUMINOTOBARI: { type: "sig_kasumi", mode: "party" },
  OIHAGI: { type: "sig_oihagi", mode: "hit" },
  MARYOKUGOUDATSU: { type: "sig_goudatsu", mode: "hit" },
  JUUJIZAN: { type: "sig_juuji", mode: "hit" },
  HAMANOKEN: { type: "sig_hamaken", mode: "hit" },
  MAGUINOTACHI: { type: "sig_magui", mode: "hit" },
  SEIIKINOKANE: { type: "sig_kane", mode: "party" },
  HAJANOTACHI: { type: "sig_haja", mode: "hit" },
  KOUSHUNOHOUJIN: { type: "sig_houjin", mode: "field" },
  KINJUKAICHOU: { type: "sig_kinju", mode: "hit" },
  DANZAINOTSUCHI: { type: "sig_tettsui", mode: "hit" },
  SEIKUNOKAGO: { type: "sig_seiku", mode: "ally" },
  SHASHINNOGYOU: { type: "sig_shashin", mode: "hit" },
  SEIKEN: { type: "sig_seiken", mode: "field" },
  ASHURAZAN: { type: "sig_ashura", mode: "hit" },
  RYUZETSU: { type: "sig_ryuzetsu", mode: "hit" },
  MEIKONGURAI: { type: "sig_meikon", mode: "hit" },
  SHINRANOSABAKI: { type: "sig_shinra", mode: "field" },
  CARDINAL_SEIYU: { type: "sig_seiyu", mode: "party" },
  SHINENNOHADOU: { type: "sig_shinen", mode: "hit" },
  HOUSHOUHEKI: { type: "sig_houshou", mode: "party" },
};

registerFx(SIG_DRAW, SIG_DUR, SIGS);
