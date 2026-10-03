import { tube, sphere, ellipsoid, cone, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { arcParam } from "../arc.mjs";
import { GRAVEL, ROCK, RIM, rubble, dust, pebbles, tri, cracks } from "../mine.mjs";
export const meta = { id: "bs_rockworm", key: "hd_rockworm", w: 96, h: 96,
  note: "岩喰いの大蟲: 砕けた岩盤から鎌首をもたげる環形の大蟲。岩のような硬い体節、正面を向いた円い口に幾重もの歯の輪、喉の奥は闇" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030302", "#0a0907", "#14110d", "#1f1a14", "#28211a", "#342b21", "#43382a", "#564836", "#6c5c44"], 9), spec: 0.6, pow: 25, specCol: "#a89474", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    groove: { ramp: ramp(["#020202", "#070605", "#0f0c09", "#18130e", "#211a13"], 5), dither: 0.5 },
    lip: { ramp: ramp(["#060203", "#170809", "#2a0e0e", "#401614", "#5a2018", "#76301f"], 6), spec: 1.4, pow: 40, specCol: "#e0a080", dither: 0.4 },
    maw: { ramp: ["#000000", "#000000", "#0c0304", "#1a0607"], amb: 0.1, dif: 0.35, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 背骨: 地の穴から立ち上がり、手前へ曲がって口を向ける
  const spine = [[22, 94, -12, 12], [18, 78, -8, 12.5], [24, 61, -2, 13.5], [38, 47, 5, 14], [52, 38, 11, 15]];
  const s = arcParam(spine.map(p => p.slice(0, 3)));
  const body = tube(spine, "hide", { seg: 5 });
  const head = ellipsoid([57, 36, 14], [18, 17.5, 13], "hide");
  // 背の節ごとに生えた岩のような棘
  const spikes = [];
  for (const [x, y, z, dx, dy] of [[14, 70, -6, -6, -3], [17, 56, -1, -6, -5], [26, 44, 4, -4, -7], [38, 34, 8, -2, -8], [52, 22, 10, 0, -8], [66, 22, 8, 4, -7], [72, 30, 6, 7, -3]]) spikes.push(cone([x, y, z], [x + dx, y + dy, z - 1], 2.6, 0.3, "hide"));
  // 体節の溝 (くびれ) と、節ごとの硬い板
  const rings = (x, y, z) => 1.8 * Math.max(0, Math.cos(s(x, y, z) * 0.62)) ** 12;
  const crk = cracks(0.8, 0.32);
  const plates = (x, y, z) => crk(x, y, z) + 0.25 * fbm(x * 0.8, y * 0.8, z * 0.8);
  const worm = Paint(Disp(U(4, body, head, ...spikes), (x, y, z) => rings(x, y, z) * (y > 46 ? 1 : 0.3) + plates(x, y, z)), (x, y, z, m) => (m === "hide" && y > 46 && Math.cos(s(x, y, z) * 0.62) > 0.93) ? "groove" : m);
  // 口: 正面の円い穴。縁は赤黒い肉の輪、奥は闇
  const lip = Sub(sphere([58, 36, 23], 12.5, "lip"), sphere([58, 36, 28], 10, "lip"));
  const mouth = Sub(U(1.5, worm, lip), sphere([58, 36, 33], 10.2, "maw"), 1);
  const scene = U(0, rubble(38, 90, 42, 15, { n: 11, seed: 7, big: 4 }), mouth);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 歯の輪: 黄ばんだ三角の歯が、外輪から内輪へ幾重にも中心を向く
  const T = ["#2e2618", "#5c5236", "#8c8058", "#b8ac80"];
  for (const [R0, n, L, w, ph] of [[10.4, 13, 4.4, 1.6, 0], [6.8, 9, 3, 1.2, 0.35], [4.0, 6, 2, 0.9, 0.1]]) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + ph, cx = Math.cos(a), cy = Math.sin(a), px = -cy, py = cx;
      const b1 = [58 + cx * R0 + px * w, 36 + cy * R0 + py * w], b2 = [58 + cx * R0 - px * w, 36 + cy * R0 - py * w], tp = [58 + cx * (R0 - L), 36 + cy * (R0 - L)];
      const lit = cy < 0.2 && cx < 0.5;
      tri(C, b1, b2, tp, (x, y) => ((x - 58) * cx + (y - 36) * cy < R0 - L * 0.55 ? T[lit ? 3 : 2] : T[lit ? 2 : 1]));
      C.set(b2[0], b2[1], T[0]);
    }
  }
  C.disc(58, 36, 2.2, "#000000");
  // 口から垂れる岩粉まじりの唾
  for (const [x, y0, l] of [[52, 48, 7], [63, 48, 5]]) for (let i = 0; i < l; i++) C.set(x, y0 + i, i < l - 1 ? "#2a0e0e" : "#76301f");
  pebbles(C, 3, 38, 89, 38);
  dust(C, 9, 14);
  return C.toArt();
}
