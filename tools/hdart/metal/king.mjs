import { sphere, ellipsoid, torus, slab, cone, cyl, U, Disp, render, Canvas, ramp } from "../sdf.mjs";
import { chrome, JOINT, FLOOR, soulGlow, chibi } from "../metalkit.mjs";
import { eyes } from "./silver.mjs";
export const meta = { id: "mt_king", key: "hd_mt_king", w: 96, h: 96,
  note: "銀業の王: 銀業が寄り集まって溶け合った大きな白金の人業。頭にちょこんと載る小さな金の王冠と紅玉、紅の短い外套、胸の窓には百の魂がまばゆく灯る" };
const SOUL = ["#1c1050", "#3c2c9a", "#7a68e0", "#c4b8ff", "#ffffff"];
export function build() {
  const mats = {
    metal: chrome(["#05070b", "#111620", "#212a38", "#374252", "#536072", "#7a8698", "#a6b0c0", "#d2d9e4", "#f4f7fc"], "#ffffff"),
    gold: chrome(["#0a0602", "#2a1a06", "#5a3c10", "#946a1e", "#c89a36", "#ecc866", "#fff0b8"], "#fffbe8", { env: 0.7 }),
    gem: { ramp: ["#2a0208", "#6a0814", "#b01428", "#ff4a5c", "#ffc0c8"], amb: 0.3, dif: 0.8, spec: 1.5, pow: 40, specCol: "#ffffff", dither: 0.3 },
    cape: { ramp: ramp(["#080102", "#1a0306", "#30060c", "#4a0a14", "#66121c", "#842028"], 6), amb: 0.18, dif: 0.85, spec: 0.3, pow: 14, dither: 0.6,
      shade: p => 0.1 * Math.sin(p.x * 0.8) },
    fur: { ramp: ramp(["#16161a", "#3a3a42", "#6a6a74", "#a0a0aa", "#d8d8e0"], 5), amb: 0.3, dif: 0.8, dither: 0.8, shade: p => 0.12 * Math.sin(p.x * 2.1) * Math.cos(p.y * 1.7) },
    joint: JOINT, floor: FLOOR, soul: soulGlow(SOUL),
  };
  const s = 1.12, cx = 48, cy = 31;
  const d = chibi({ cx, cy, s, armUp: false });
  const [chx, chy, chz] = d.chest;
  const window = torus([chx, chy, chz - 1.6], 4.2, 1.1, "gold", 0, 90);
  const soul = sphere([chx, chy, chz - 2.4], 3.9, "soul");
  // 紅の短い外套 (肩から背へ) と白い毛皮の襟
  const by = cy + 29 * s;
  const cape = Disp(slab([[cx - 14, by - 10], [cx + 15, by - 10], [cx + 27, by + 18], [cx + 16, by + 15], [cx + 4, by + 19], [cx - 8, by + 15], [cx - 21, by + 19], [cx - 28, by + 8]], -7, 1.4, "cape", 0.7), (x, y, z) => 0.5 * Math.sin(x * 0.6));
  const collar = torus([cx + 1, by - 8, 4], 9.5, 2.6, "fur", -4, 14);
  // 頭にちょこんと載る小さな王冠 (少し傾く)
  const top = cy - 17 * s;
  const ring = torus([cx + 3, top + 2.5, 6], 7.2, 1.9, "gold", 12, 8);
  const spikes = [-6, -2, 2, 6].map((dx, i) => cone([cx + 3 + dx, top + 1.5 + dx * 0.21, 6 + (i % 2 ? 4 : 2)], [cx + 3 + dx * 1.15, top - 5 + dx * 0.21, 6 + (i % 2 ? 4 : 2)], 1.7, 0.4, "gold"));
  const balls = [-6, -2, 2, 6].map((dx, i) => sphere([cx + 3 + dx * 1.15, top - 5.6 + dx * 0.21, 6 + (i % 2 ? 4 : 2)], 1.1, "gold"));
  const ruby = sphere([cx + 3, top + 2.4, 12.2], 2.3, "gem");
  // 右手の小さな王笏
  const hx = cx + 22 * s, hy = by + 6 * s;
  const rod = cyl([hx, hy + 8, -2], [hx + 1, hy - 14, -2], 1.1, "gold");
  const orb = sphere([hx + 1, hy - 16.5, -2], 3.2, "gem");
  const floor = ellipsoid([cx, d.feet + 2.5, 2], [34, 2.2, 14], "floor");
  const r = render(U(0, floor, cape, ...d.nodes, collar, window, soul, ring, ...spikes, ...balls, ruby, rod, orb), mats, { w: 96, h: 96, rim: "#8c9ac0", zTop: 60 });
  const C = new Canvas(r);
  eyes(C, d.eye, SOUL, 2.7, 3.8);
  return C.toArt();
}
