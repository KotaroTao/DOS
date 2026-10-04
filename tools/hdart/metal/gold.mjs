import { sphere, ellipsoid, torus, slab, U, Disp, render, Canvas, ramp } from "../sdf.mjs";
import { chrome, JOINT, FLOOR, soulGlow, chibi } from "../metalkit.mjs";
import { eyes } from "./silver.mjs";
export const meta = { id: "mt_gold", key: "hd_mt_gold", w: 96, h: 96,
  note: "金業: 金の聖具から生まれた銀業の兄貴分。照り輝く金の肌、腰から金魚の尾びれのようにひらひら翻る紅金の飾り布、翠の魂の双眸" };
const SOUL = ["#06301e", "#13684a", "#2fb688", "#8ff0c8", "#eafff6"];
export function build() {
  const mats = {
    metal: chrome(["#0a0602", "#1e1206", "#3a240a", "#5c3c10", "#86601a", "#b08a2a", "#d4b048", "#f0d878", "#fff4c4"], "#fffbe8", { warm: 0.05 }),
    fin: { ramp: ramp(["#1a0402", "#3e0c04", "#6a1a06", "#9a320c", "#c85a16", "#e88a30", "#f8bc60"], 7), amb: 0.3, dif: 0.7, spec: 0.8, pow: 30, specCol: "#ffe2a0", dither: 0.5,
      shade: p => 0.07 * Math.sin(p.x * 0.35 - p.y * 0.25) + 0.12 * Math.max(0, -p.ny) },
    joint: JOINT, floor: FLOOR, soul: soulGlow(SOUL),
  };
  const d = chibi({ cx: 45, cy: 30, s: 0.95 });
  const [chx, chy, chz] = d.chest;
  const window = torus([chx, chy, chz - 1.2], 3.2, 1.1, "joint", 0, 90);
  const soul = sphere([chx, chy, chz - 1.6], 2.6, "soul");
  // 金魚の尾びれのような飾り布: 腰の後ろから右へ、波打ちながら二股に広がる
  const wave = (x, y, z) => 0.6 * Math.sin(x * 0.45 + y * 0.2);
  const fin1 = Disp(slab([[52, 60], [60, 52], [74, 44], [86, 40], [90, 46], [82, 52], [88, 58], [80, 62], [68, 64], [58, 68]], -4, 1.1, "fin", 0.6), wave);
  const fin2 = Disp(slab([[54, 66], [64, 66], [78, 70], [90, 72], [88, 80], [78, 78], [70, 82], [60, 76]], -6, 1.0, "fin", 0.6), wave);
  // 頭の上の小さな飾りびれ
  const crest = Disp(slab([[40, 13], [46, 6], [54, 3], [58, 6], [52, 10], [48, 14]], 2, 1.0, "fin", 0.5), wave);
  const floor = ellipsoid([47, d.feet + 2.5, 2], [32, 2.2, 13], "floor");
  const r = render(U(0, floor, ...d.nodes, window, soul, fin1, fin2, crest), mats, { w: 96, h: 96, rim: "#8c86a8", zTop: 60 });
  const C = new Canvas(r);
  eyes(C, d.eye, SOUL);
  return C.toArt();
}
