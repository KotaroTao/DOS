import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, slime, sores, miasma } from "../swamp.mjs";
export const meta = { id: "bs_pestilenceknight", key: "hd_pestilenceknight", w: 96, h: 96,
  note: "疫病の騎士: 疫病で全滅した軍の、ただ一騎腐り果てて動く騎士。くちばしのように前へ突き出た面頬の兜、錆びと緑青に膿の流れる鎧。刃こぼれした大剣を両手で頭上に振りかぶり、鎧ごと守りを叩き割る (守り崩し・多用)。腐った鎧は刃を半ば阻む (物理50)。肩には裂けた軍旗、足元には泥に沈んだ兵の兜" };
export function build() {
  const mats = {
    steel: { ramp: ramp(["#020202", "#070807", "#0e100d", "#161a14", "#20251c", "#2b3125", "#38402f", "#48503b"], 8), spec: 1.3, pow: 30, specCol: "#9aa47a", dither: 0.5, amb: 0.22,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    rust: { ramp: ramp(["#060302", "#140805", "#26100a", "#3a1a10", "#502616"], 5), dither: 0.6, amb: 0.25 },
    cloth: { ramp: ramp(["#050304", "#100709", "#1c0c10", "#2a1218", "#3a1a20"], 5), dither: 0.6 },
    blade: { ramp: ramp(["#060605", "#16160f", "#2a2a1e", "#424030", "#5e5a44", "#7e7a5e"], 6), spec: 1.4, pow: 40, specCol: "#b8b490", dither: 0.4 },
    hole: { ramp: ["#000000", "#020201"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [ROT[3], ROT[4], ROT[5]], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const J = { head: [46, 30, 4], neck: [47, 36, 3], chest: [48, 46, 1], waist: [49, 58, 1], hip: [50, 66, 1],
    shL: [38, 40, 5], elL: [32, 28, 4], haL: [45, 14, -1], shR: [58, 40, -2], elR: [64, 28, -2], haR: [51, 13, -3],
    hpL: [44, 68, 3], knL: [36, 78, 7], ftL: [30, 90, 7], hpR: [56, 68, -1], knR: [62, 78, 1], ftR: [66, 90, 1] };
  const body = humanoid(J, { skin: "steel" }, { w: { headX: 5.4, headY: 6.4, chestX: 11, chestY: 9, chestZ: 7.4, waistX: 8.4, hipX: 9.4, arm: 3.4, arm2: 3, wrist: 2.4, thigh: 4.2, knee: 3.4, ankle: 2.8 } });
  const pauldrons = [ellipsoid([36, 38, 4], [6.4, 4.6, 6.4], "steel", -25), ellipsoid([60, 38, -2], [6.4, 4.6, 6.4], "steel", 25)];
  // くちばし面頬の兜
  const helm = U(1.2, ellipsoid([46, 29, 3], [6.4, 7.4, 6.6], "steel"), cone([44, 31, 8], [36, 37, 12], 3.4, 0.6, "steel"), cone([46, 23, 2], [48, 14, -2], 1.6, 0.3, "steel"));
  const visor = box([45, 28, 9], [3.4, 0.7, 1.4], "hole", 0, -10);
  const eyes = [sphere([43.6, 28, 8], 0.8, "eye"), sphere([47, 27.6, 8.4], 0.8, "eye")];
  const tassets = [box([45, 68, 6], [4, 5, 1.4], "steel", 0.6, 8), box([55, 68, 4], [4, 5, 1.4], "steel", 0.6, -8)];
  // 振りかぶった大剣 (切っ先は右上)
  const grip = cyl([44, 15, -1], [53, 11, -2], 1.2, "rust");
  const guard = box([54, 10, -2], [1.2, 5.6, 1.4], "rust", 0.4, -25);
  const blade = Disp(cone([56, 9, -2], [90, -4, -4], 3.4, 0.6, "blade"), (x, y, z) => 0.6 * Math.max(0, Math.sin(x * 1.7) * fbm(x * 0.5, 3)));
  // 肩の裂けた軍旗
  const banner = Disp(slab([[60, 36], [64, 34], [82, 48], [80, 64], [74, 58], [70, 72], [64, 56]], -8, 0.8, "cloth", 0.4), (x, y, z) => 1 * Math.sin(x * 0.5 + y * 0.3));
  const pole = cyl([60, 40, -6], [72, 8, -8], 0.8, "rust");
  const helms = [ellipsoid([16, 90, 10], [4.6, 3.6, 4], "rust"), ellipsoid([80, 91, 12], [4, 3, 3.6], "rust")];
  const knight = Paint2(Sub(U(1.2, body, helm, ...pauldrons), visor, 0.3));
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 1, seed: 10701, wet: 0.15, logs: 1 }), banner, pole, knight, ...eyes, ...tassets, grip, guard, blade, ...helms);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [70, 8, 18], r: 26, k: 0.25 }] });
  const C = new Canvas(r);
  sores(C, 31, ["steel"], { th: 0.7, f: 0.5, cols: ["#26100a", "#3a1a10", ROT[2]] });
  slime(C, 10703, ["steel"], 0.1, ["#26100a", ROT[1], ROT[3]]);
  // 刃の欠け
  for (let t = 0.15; t < 0.7; t += 0.16) { const x = 56 + 34 * t, y = 9 - 13 * t; C.set(x + 1, y - 2, null); }
  scum(C, 10705);
  miasma(C, 10707, 2, [0, 56, 96, 30], 0.22);
  motes(C, 10709, 14, [2, 2, 92, 60], true);
  return C.toArt();
}
// 鎧の継ぎ目から下を錆に塗る
function Paint2(n) { return { op: "P", fn: (x, y, z, m) => (m === "steel" && fbm(x * 0.3, y * 0.3, z * 0.3 + 4) > 0.3 ? "rust" : m), kids: [n] }; }
