import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, cavernFloor, spikes, glints, soot, murkMotes, shards } from "../cavern.mjs";
export const meta = { id: "bs_obsidianbeast", key: "hd_obsidianbeast", w: 96, h: 96,
  note: "黒曜の獣: 狼に似た大空洞の獣。紫がかった黒の石の毛皮から、鋭く割れた黒曜石の三角のかけらが体じゅうに生え、角にだけ強い光沢。割れた石の爪の前脚を振り上げ、鎧ごと守りを切り裂く (守り崩し・多用)。石の毛皮は刃を半ば弾く (物理抵抗50)。灯籠のガラスをかじるので、開いた口の中まで黒く光る" };
export function build() {
  const OB = { ramp: ["#020103", "#0a0710", "#16121e", "#241e30", "#342c44", "#463c5a", "#5c5074"], spec: 1.6, pow: 40, specCol: "#c8bce0", dither: 0.35,
    shade: p => 0.12 * (Math.floor((p.nx * 4 + p.ny * 3) * 1.5) % 2 ? 0.5 : -0.5) };
  const mats = {
    fur: { ramp: ["#030204", "#09070c", "#110e15", "#1a1620", "#24202c", "#302a3a"], dither: 0.55, amb: 0.22,
      shade: p => 0.08 * fbm(p.x * 0.7, p.y * 0.7, p.z * 0.7) },
    obs: OB,
    maw: { ramp: ["#000000", "#08050c", "#140e1c"], spec: 1.5, pow: 40, specCol: "#6a5a80", dither: 0.3 },
    eye: { ramp: ["#4a2c6a", "#9a6ad0", "#e6d4ff"], emit: () => 0.9 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const torso = Disp(U(4, ellipsoid([56, 58, 0], [20, 11, 11], "fur", -6), ellipsoid([38, 54, 2], [11, 12, 11], "fur", 20)), (x, y, z) => 0.4 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const head = U(2, ellipsoid([24, 44, 6], [8.4, 7, 7.4], "fur", 10), ellipsoid([12, 48, 8], [7.6, 3.6, 5], "fur", 14));
  const jaw = ellipsoid([12, 53, 8], [7, 2, 4], "fur", 24);
  const maw = ellipsoid([9, 51, 11], [7, 2.2, 4], "maw", 18);
  const ears = spikes([[[26, 38, 4], [30, 28, 2], 2.6, 0.3], [[21, 38, 8], [20, 29, 8], 2.4, 0.3]], "fur");
  // 前脚を振り上げ (左前)、もう片方は床に
  const armUp = tube([[36, 58, 8, 5], [28, 64, 12, 3.8], [18, 66, 14, 3]], "fur");
  const legs = [tube([[42, 62, -6, 4.6], [40, 78, -6, 3.4], [40, 92, -6, 2.6]], "fur"), tube([[66, 62, 8, 5], [72, 76, 8, 3.6], [68, 92, 8, 2.6]], "fur"), tube([[70, 60, -6, 4.6], [78, 76, -6, 3.2], [76, 92, -6, 2.4]], "fur")];
  const clawsUp = spikes([[[17, 64, 14], [10, 60, 15], 1.2, 0.2], [[17, 66, 15], [9, 66, 16], 1.2, 0.2], [[18, 68, 13], [11, 72, 14], 1.1, 0.2]], "obs");
  const tail = tube([[74, 54, -2, 4], [86, 50, -3, 3], [94, 56, -3, 1.6]], "fur");
  // 背・肩・腰から生える黒曜石のかけら
  const R = rand(12701), shardsList = [];
  for (let i = 0; i < 18; i++) {
    const t = R(), x = 26 + t * 56, y = 46 - Math.sin(t * Math.PI) * 4 + (t < 0.25 ? -2 : 0) + R() * 4, z = (R() - 0.5) * 12;
    const L = 7 + R() * 8, a = -Math.PI / 2 + (R() - 0.5) * 1.3 + (t - 0.5) * 0.6;
    shardsList.push(cone([x, y, z], [x + Math.cos(a) * L, y + Math.sin(a) * L, z + (R() - 0.5) * 4], 2.2 + R() * 1.4, 0.15, "obs"));
  }
  const eye = sphere([20, 42, 12.6], 1, "eye");
  const scene = U(0, cavernFloor(50, 95, 46, 13, { seed: 12703, rocks: 3, lamps: 2 }), Sub(U(1.6, torso, head, jaw, ...ears, armUp, ...legs, tail), maw, 0.3), ...clawsUp, ...shardsList, eye);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 4, 15, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#16121c", "#3a3046", "#c8bce0"], seed: 12705 });
  // 切り裂きの爪痕
  for (let i = 0; i < 3; i++) for (let t = 0; t < 1; t += 0.03) { const x = 6 + t * 10 + i * 3, y = 60 + t * 16 - i * 1; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, t > 0.3 && t < 0.7 ? "#9a6ad0" : "#2c2436"); }
  glints(C, 12707, ["obs"], 10, ["#6a5a80", "#e6dcff"]);
  murkMotes(C, 12709, 12, [20, 6, 70, 30]);
  shards(C, 12711, ["bed"], 18);
  soot(C, 12713, 30);
  return C.toArt();
}
