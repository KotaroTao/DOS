import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BASALT, CRUST, LAVA, RIM, ASH, lavaFloor, underglow, embers, ash, puffs } from "../lava.mjs";
export const meta = { id: "bs_ashghoul", key: "hd_ashghoul", w: 96, h: 96,
  note: "灰かぶりの信徒: 火に身を捧げて焼け焦げた信徒の亡骸。頭から灰をかぶった痩せた体に、焦げた法衣の切れ端と縄の帯。両手で灰をすくって掲げ、くぼんだ眼に残り火が灯る。後ろには同じ姿の信徒が何体も這い寄り、頭上から灰が降る" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040303", "#0e0b0a", "#1b1715", "#2a2421", "#3b3430", "#4f4742", "#665d57", "#807670"], 8), dither: 0.7, spec: 0.15, pow: 10,
      shade: p => 0.14 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) - (fbm(p.x * 0.3 + 4, p.y * 0.3, p.z * 0.3) > 0.25 ? 0.18 : 0) },
    robe: { ramp: ramp(["#030202", "#0c0706", "#170d0a", "#23130e", "#301a12", "#3e2318"], 6), dither: 0.6,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 0.3 + 2 * fbm(p.x * 0.2, p.y * 0.2)) },
    char: { ramp: ramp(["#020101", "#080404", "#120806"], 3), amb: 0.3, dif: 0.3, noRim: true },
    eye: { ramp: ["#5a0e04", "#c43e0c", "#ffae3a", "#fff0b0"], emit: p => 0.55 + 0.45 * Math.max(0, p.nz) },
    hole: { ramp: ["#000000", "#050202"], amb: 0, dif: 0.1, noRim: true },
    back: { ramp: ramp(["#030202", "#0a0807", "#13100e", "#1d1916", "#28221e"], 5), dither: 0.8, noRim: true },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 前かがみの信徒: 首を突き出し、両手を胸の前で上向きに合わせる
  const J = { head: [40, 30, 4], neck: [42, 36, 3], chest: [46, 45, 2], waist: [50, 56, 1], hip: [52, 64, 0],
    shL: [38, 41, 8], elL: [32, 50, 12], haL: [36, 44, 17], shR: [54, 40, -4], elR: [52, 51, 6], haR: [44, 45, 15],
    hpL: [48, 66, 6], knL: [40, 76, 9], ftL: [42, 88, 9], hpR: [57, 66, -4], knR: [64, 76, -6], ftR: [62, 88, -6] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5, headY: 6, chestX: 7, chestY: 7, waistX: 5.2, hipX: 6.5, arm: 1.9, arm2: 1.6, wrist: 1.3, thigh: 2.8, knee: 2, ankle: 1.5 } });
  // 肋の浮いた胸 (凹凸)
  const lean = Disp(body, (x, y, z) => (y > 39 && y < 52 ? -0.6 * Math.max(0, Math.sin(y * 1.6)) : 0) + 0.25 * fbm(x * 0.7, y * 0.7, z * 0.7));
  // 焦げた法衣: 肩から垂れ、裾は焼け落ちてぎざぎざ
  const robe = Disp(U(2, ellipsoid([50, 50, -1], [10, 13, 7.5], "robe", 18), cone([52, 56, 0], [54, 80, -1], 9, 12, "robe"), ellipsoid([46, 38, 1], [9, 4, 6.5], "robe", 20)),
    (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4, z * 0.4) + (y > 70 ? 2.2 * Math.max(0, vnoise(x * 0.5, 3) + 0.3) * (y - 70) / 10 : 0));
  const robeP = Paint(robe, (x, y, z, m) => (fbm(x * 0.2, y * 0.2, z * 0.2) > 0.2 || y > 74) ? "char" : m);
  const rope = tube([[42, 57, 6.5, 0.9], [50, 59, 8, 0.9], [58, 56, 4, 0.9]], "skin");
  const hands = [...fingers(J.haL, -70, "skin", { n: 4, len: 4, spread: 18, r: 0.6, curl: -0.6, z: 1 }), ...fingers(J.haR, -110, "skin", { n: 4, len: 4, spread: 18, r: 0.6, curl: 0.6, z: 1 })];
  // すくった灰の山
  const handful = Disp(ellipsoid([40, 42, 17], [4.5, 2, 3], "skin"), (x, y, z) => 0.4 * fbm(x, y, z));
  const sockets = U(0, ellipsoid([38, 29, 9], [1.6, 1.3, 2], "hole"), ellipsoid([42.5, 29, 8.5], [1.6, 1.3, 2], "hole"), ellipsoid([40, 34, 8.5], [2, 1.2, 2], "hole"));
  const eyes = [sphere([38, 29.2, 8], 0.9, "eye"), sphere([42.5, 29.2, 7.5], 0.9, "eye")];
  const devotee = Sub(U(1.2, lean, robeP, rope, ...hands, handful), sockets, 0.4);
  // 後ろの信徒たち (影のような姿で這い寄る)
  const backs = [];
  for (const [x, y, z, s] of [[76, 52, -16, 0.85], [18, 58, -18, 0.75], [88, 64, -22, 0.6]]) {
    backs.push(U(2, ellipsoid([x, y - 14 * s, z], [4.5 * s, 5.5 * s, 4 * s], "back"), ellipsoid([x + 2 * s, y, z], [7 * s, 12 * s, 6 * s], "back", -15),
      cone([x + 2 * s, y + 6 * s, z], [x + 3 * s, y + 26 * s, z], 7 * s, 9 * s, "back"), tube([[x - 3 * s, y - 6 * s, z + 3, 1.5 * s], [x - 9 * s, y + 2 * s, z + 4, 1.2 * s]], "back")));
  }
  const scene = U(0, lavaFloor(50, 92, 46, 14, { n: 4, seed: 7301, cracks: 0.9 }), devotee, ...eyes, ...backs);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 後ろの信徒の眼にも残り火
  for (const [x, y] of [[74, 39], [76, 39], [16, 47], [18, 47], [86, 54]]) C.set(x, y, "#c43e0c");
  C.set(38, 29, "#fff0b0"); C.set(42, 29, "#ffae3a");
  underglow(C, { skip: ["eye", "back"] });
  // 掌からこぼれる灰
  puffs(C, [[38, 47, 3], [36, 52, 2.6], [37, 57, 2]], ASH, { dens: 1.1, seed: 7303 });
  ash(C, 7305, 26, [2, 2, 92, 74]);
  embers(C, 7307, 10, [6, 40, 84, 40]);
  return C.toArt();
}
