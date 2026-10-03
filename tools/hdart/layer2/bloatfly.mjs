import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_bloatfly", key: "hd_bloatfly", w: 96, h: 96,
  note: "腐肉蠅の群れ: 拳ほどに肥えた蠅の群れ。手前の一匹は膿で膨れた縞の腹と赤い複眼、透ける翅、毒の鱗粉をまき散らす" };
export function build() {
  const mats = {
    chit: { ramp: ramp(["#030304", "#08080a", "#101014", "#1a1a20", "#26262e", "#363644", "#50506a"], 7), spec: 1.8, pow: 50, specCol: "#c8d0f0", dither: 0.5,
      shade: p => 0.1 * Math.sin(p.x * 0.9 + p.z * 0.4) * 0 },
    belly: { ramp: ramp(["#050403", "#141108", "#26200c", "#3a3212", "#52481a", "#6e6428", "#968a48"], 7), spec: 1.6, pow: 50, specCol: "#f0f0c0", dither: 0.5 },
    band: { ramp: ramp(["#030303", "#0c0a08", "#1a1610", "#2a2418", "#3a3222"], 5), spec: 1, pow: 40, dither: 0.5 },
    eye: { ramp: ramp(["#030101", "#0e0202", "#1c0404", "#300806", "#46100a", "#601c10", "#7e2c1a"], 7), spec: 2.2, pow: 70, specCol: "#ffc8b0", dither: 0.2, amb: 0.15,
      shade: p => 0.16 * ((((Math.floor(p.x * 1.1) + Math.floor(p.y * 1.1)) % 2) + 2) % 2 - 0.5) },
    hair: { ramp: ramp(["#030303", "#0e0c0c", "#1e1a18", "#302a24"], 4), dither: 0.6 },
  };
  // 腹の縞 (節ごとに暗い帯) と膿の筋
  const banded = (cx, cy, rot) => (x, y, z, m) => { if (m !== "belly") return m; const c = Math.cos(rot), s = Math.sin(rot); const u = (x - cx) * c + (y - cy) * s; return Math.abs(Math.sin(u * 0.62)) < 0.28 ? "band" : m; };
  function fly(cx, cy, cz, k, rot) {
    const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const P = (dx, dy, dz = 0) => [cx + (dx * c - dy * s) * k, cy + (dx * s + dy * c) * k, cz + dz * k];
    const thorax = ellipsoid(P(0, 0, 0), [7 * k, 6.5 * k, 6.5 * k], "chit", rot);
    const abd = Paint(ellipsoid(P(12, 3, -2), [12 * k, 9 * k, 9 * k], "belly", rot + 18), banded(...P(12, 3).slice(0, 2), r + 0.31));
    const head = ellipsoid(P(-8, 1, 2), [4.5 * k, 5 * k, 5 * k], "chit", rot);
    const eyes = [ellipsoid(P(-9.5, -2.5, 3.5), [3.2 * k, 4.2 * k, 4 * k], "eye", rot - 20), ellipsoid(P(-9.5, 3.8, 4), [3.2 * k, 4.4 * k, 4 * k], "eye", rot + 20)];
    const legs = [];
    for (const [ax, ay, bx, by, fx, fy] of [[-3, 5, -8, 12, -11, 19], [1, 6, 0, 14, -2, 21], [4, 5, 8, 13, 7, 21]]) {
      legs.push(tube([[...P(ax, ay, 3), 1.1 * k], [...P(bx, by, 5), 0.9 * k], [...P(fx, fy, 6), 0.5 * k]], "chit"));
      legs.push(tube([[...P(ax, ay, -3), 1.0 * k], [...P(bx + 2, by - 1, -5), 0.8 * k], [...P(fx + 3, fy - 2, -6), 0.4 * k]], "chit"));
    }
    return { node: U(0.8 * k, thorax, abd, head, ...legs, ...eyes), P, k };
  }
  const big = fly(42, 46, 10, 1.55, 8);
  const f2 = fly(80, 20, -10, 0.62, -20), f3 = fly(14, 18, -10, 0.55, 25), f4 = fly(82, 74, -6, 0.5, 30), f5 = fly(12, 80, -14, 0.45, -10);
  const scene = U(0, big.node, f2.node, f3.node, f4.node, f5.node);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 翅: 半透明 (市松に間引く) で翅脈を描く
  const wing = (P, k, a0, len, wid, side) => {
    const W = ["#4a5462", "#2a3038", "#7a8696"];
    const bx = P(0, -4 * side)[0], by = P(0, -4 * side)[1];
    const ang = a0 * Math.PI / 180;
    for (let t = 3 * k; t <= len * k; t += 0.5) for (let w = -wid * k; w <= wid * k; w += 0.5) {
      const ell = (t / (len * k) - 0.5) ** 2 * 4 + (w / (wid * k)) ** 2; if (ell > 1) continue;
      const x = Math.round(bx + Math.cos(ang) * t - Math.sin(ang) * w), y = Math.round(by + Math.sin(ang) * t + Math.cos(ang) * w);
      const edge = ell > 0.8, vein = Math.abs(w - t * 0.12) < 0.5 || Math.abs(w + t * 0.25 - 1.5 * k) < 0.5;
      if (edge || vein) C.set(x, y, edge ? W[1] : W[0]); else if ((x + 2 * y) % 3 === 0 && !C.get(x, y)) C.set(x, y, (x * 3 + y) % 11 === 0 ? W[2] : W[1]);
    }
  };
  for (const f of [big, f2, f3, f4, f5]) { wing(f.P, f.k, -42, 24, 6, 1); wing(f.P, f.k, -14, 24, 6, -1); }
  const R = rand(4);
  // 毒の鱗粉と小蠅の点
  const G = ["#3a4a12", "#6a7c1e", "#a4b83a"];
  for (let i = 0; i < 40; i++) { const x = R() * 96, y = R() * 96; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, G[Math.floor(R() * 3)]); }
  for (let i = 0; i < 7; i++) { const x = 4 + R() * 88, y = 4 + R() * 88; if (C.get(Math.round(x), Math.round(y))) continue; C.set(x, y, "#0c0c10"); C.set(x + 1, y, "#0c0c10"); C.set(x, y - 1, "#5c6878"); C.set(x + 1, y - 1, "#5c6878"); }
  return C.toArt();
}
