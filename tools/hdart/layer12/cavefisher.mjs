import { sphere, ellipsoid, cone, tube, box, slab, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { ROCK, GLASS, FRAME, MURKGLASS, SPORE, RIM, ceiling, spikes, soot, sporeMotes, drips } from "../cavern.mjs";
export const meta = { id: "bs_cavefisher", key: "hd_cavefisher", w: 96, h: 96,
  note: "洞天井の漁り手: 地底湖の上の天井に張りつく、蟹とも虫ともつかない平たい暗い土色の甲殻の魔物。天井の岩から逆さにぶら下がり、関節の脚で岩をつかんで下をのぞく。腹の下から青白く光る長い糸を何本も垂らし、糸の先には拾った灯籠のかけらが餌のように結んである。糸に触れた者はしびれ (麻痺・多用)、宙づりのまま血を吸われる (吸血)。下には地底湖の黒い水面" };
export function build() {
  const mats = {
    shell: { ramp: ["#050302", "#100b07", "#1e150d", "#2c2014", "#3c2c1c", "#4e3a26", "#624a32"], spec: 0.6, pow: 26, specCol: "#8a7458", dither: 0.45,
      shade: p => 0.1 * Math.sin(p.x * 0.8 + p.z * 0.3) * 0.5 + 0.06 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    belly: { ramp: ["#070504", "#16100c", "#261c15", "#382a20"], dither: 0.5, amb: 0.3 },
    eye: { ramp: SPORE.slice(2, 6), emit: () => 0.9 },
    water: { ramp: ["#010203", "#030609", "#070d12", "#0d161c"], spec: 1.6, pow: 70, specCol: "#3a5660", dither: 0.7, amb: 0.5, dif: 0.3, noRim: true },
    rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const roof = ceiling(48, -3, 60, { drops: [[6, 16, 3], [88, 22, 3.2], [74, 12, 2.4]], seed: 3, z: -10 });
  // 天井に逆さに張りつく平たい甲殻 (下面が見える)
  const carapace = Disp(U(3, ellipsoid([52, 17, 0], [26, 11, 18], "shell"), ellipsoid([24, 22, 4], [10, 8, 9], "shell", -14)), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.45)) + 0.3 * fbm(x * 0.4, y * 0.4, z * 0.4));
  const belly = Disp(ellipsoid([52, 24, 6], [20, 5, 12], "belly"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.9)));
  const legs = [];
  for (const [x, s] of [[34, -1], [44, -1], [56, 1], [66, 1], [74, 1]]) for (const zz of [-10, 10]) {
    const kx = x + s * 7, ky = 34, fx = x + s * 14, fy = 6;
    legs.push(tube([[x, 24, zz * 0.8, 2.4], [kx, ky, zz * 1.3, 2], [fx, fy, zz * 1.4, 0.9]], "shell", { seg: 3 }));
  }
  // 頭と大きな鋏 (左)
  const claws = [U(1, tube([[20, 26, 8, 3.2], [12, 36, 12, 2.6]], "shell"), ellipsoid([10, 42, 12], [5, 6, 4], "shell", 30), cone([7, 46, 12], [3, 56, 12], 2, 0.3, "shell"), cone([12, 47, 12], [11, 56, 13], 1.8, 0.3, "shell"))];
  const eyes = [sphere([19, 27, 12.6], 1.2, "eye"), sphere([25, 28, 13], 1.1, "eye"), sphere([22, 30.6, 12], 0.9, "eye")];
  // 地底湖の水面 (下)
  const water = Disp(ellipsoid([48, 98, -4], [60, 6, 16], "water"), (x, y, z) => 0.2 * Math.sin(x * 0.5 + z * 0.3));
  // 糸の先の餌 (灯籠のかけら) [x, 先の y]
  const lines = [[36, 62], [46, 78], [56, 56], [64, 72], [30, 84], [70, 86]];
  const baits = lines.map(([x, y], i) => i % 2 ? Sub(ellipsoid([x, y + 2, 4], [1.8, 2.4, 1.8], "murk"), box([x + 1.6, y, 4], [1.2, 3, 3], "murk")) : U(0.3, ellipsoid([x, y + 2, 4], [1.6, 2, 1.6], "glass"), cone([x, y - 0.6, 4], [x, y + 0.6, 4], 1.6, 0.6, "frame")));
  const scene = U(0, roof, carapace, belly, ...legs, ...claws, ...eyes, water, ...baits);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 60, 12], r: 40, k: 0.25 }] });
  const C = new Canvas(r);
  // 垂れた光る糸 (腹から餌まで、少しゆらぐ)
  lines.forEach(([x, y], i) => { for (let Y = 28; Y < y; Y++) { const X = Math.round(x + Math.sin(Y * 0.15 + i) * 1.2); if (C.get(X, Y) && C.pix[Y * 96 + X]?.m !== "water") continue; C.set(X, Y, Y % 7 === 0 ? SPORE[5] : SPORE[(Y + i) % 3 === 0 ? 4 : 3]); if (!C.get(X + 1, Y) && Y % 2) C.set(X + 1, Y, SPORE[1]); } });
  // 水面の照り返し (糸の光の映り)
  for (const [x] of lines) for (let k = -2; k <= 2; k++) C.only(x + k, 93 + (k & 1), k === 0 ? SPORE[3] : SPORE[1]);
  sporeMotes(C, 13403, 16, [6, 34, 84, 50]);
  drips(C, 13405, 4, [8, 30, 80, 40]);
  soot(C, 13407, 26);
  return C.toArt();
}
