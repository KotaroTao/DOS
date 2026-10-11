import { sphere, ellipsoid, cone, tube, box, cyl, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, cracks, soot, murkMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "bs_rocktitan", key: "hd_rocktitan", w: 96, h: 96,
  note: "岩の巨人: 大空洞の岩盤がそのまま人の形に立ち上がった巨人。茶灰の岩の塊を積んだ体、小さな頭は肩の間に埋まる。胸の大きな割れ目の奥で、しみこんだ魂がいくつも濁った琥珀に鈍く光る。刃を一つも通さない (物理抵抗100)。両の拳を振り下ろして地団駄を踏み (激昂)、肩から小石がこぼれる" };
export function build() {
  const mats = {
    stone: { ramp: ["#040303", "#0d0b09", "#191512", "#26201b", "#342c25", "#443a31", "#56493e", "#6a5b4e"], spec: 0.3, pow: 20, dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    core: { ramp: MURK.slice(1), noRim: true, emit: p => 0.35 + 0.4 * Math.max(0, p.nz) + 0.25 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    pit: { ramp: ["#000000", "#0a0604", "#1a1208"], amb: 0.1, dif: 0.3, noRim: true },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const J = { head: [48, 26, 0], neck: [48, 32, 0], chest: [48, 44, 0], waist: [48, 60, 0], hip: [48, 66, 0],
    shL: [30, 38, 2], elL: [20, 54, 6], haL: [18, 70, 8], shR: [66, 38, 2], elR: [76, 54, 6], haR: [78, 70, 8],
    hpL: [40, 68, 0], knL: [36, 80, 4], ftL: [32, 92, 4], hpR: [56, 68, 0], knR: [60, 80, 4], ftR: [64, 92, 4] };
  const body = Disp(humanoid(J, { skin: "stone" }, { k: 3, w: { headX: 6, headY: 5.4, headZ: 6, neck: 4, chestX: 19, chestY: 14, chestZ: 12, waistX: 12, waistY: 9, waistZ: 9, hipX: 13, arm: 7, arm2: 6, wrist: 5.4, thigh: 7.4, knee: 6, ankle: 5.4 } }),
    (x, y, z) => cracks(1.2, 0.18)(x, y, z) + 0.9 * Math.max(0, fbm(x * 0.12, y * 0.12, z * 0.12) - 0.1) + 0.5 * Math.abs(Math.sin(x * 0.35) * Math.sin(y * 0.3)));
  const fists = [Disp(ellipsoid([18, 74, 10], [7, 6.4, 7], "stone"), cracks(0.8, 0.3)), Disp(ellipsoid([78, 74, 10], [7, 6.4, 7], "stone"), cracks(0.8, 0.3))];
  const boulders = [Disp(ellipsoid([28, 30, -2], [8, 7, 8], "stone"), cracks(0.8, 0.3)), Disp(ellipsoid([68, 30, -2], [8, 7, 8], "stone"), cracks(0.8, 0.3))];
  // 胸の割れ目と、その奥の魂
  const rift = slabRift();
  const cores = [[46, 41, 9, 2.2], [50, 47, 9.4, 2], [45, 53, 9, 1.6], [50, 34, 9, 1.3], [47, 59, 9, 1.1]].map(([x, y, z, r]) => sphere([x, y, z], r, "core"));
  const eyes = [sphere([45, 26, 5.6], 0.9, "core"), sphere([51, 26, 5.6], 0.9, "core")];
  const scene = U(0, cavernFloor(48, 95, 46, 13, { seed: 12201, rocks: 4, lamps: 2 }), Sub(U(2, body, ...fists, ...boulders), rift, 0.4), ...cores, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 46, 18], r: 20, k: 0.4 }] });
  const C = new Canvas(r);
  // 肩からこぼれる小石
  const R = rand(12203);
  for (let k = 0; k < 10; k++) { const x = Math.round((k < 5 ? 26 : 70) + (R() - 0.5) * 10), y = Math.round(38 + R() * 30); if (!C.get(x, y)) { C.set(x, y, "#443a31"); C.set(x + 1, y, "#191512"); } }
  murkHalo(C, 48, 46, 30, MURK.slice(0, 2));
  murkMotes(C, 12205, 18, [10, 20, 76, 50]);
  shards(C, 12207, ["bed"], 12);
  soot(C, 12209, 40);
  return C.toArt();
}
function slabRift() {
  return U(0.6, ...[[50, 33, 2], [46, 40, 3.6], [50, 47, 3.8], [45, 54, 2.8], [48, 60, 1.4]].map(([x, y, r]) => ellipsoid([x, y, 14], [r, r * 1.4, 7], "pit")));
}
