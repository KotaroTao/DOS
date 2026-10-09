import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, AURORA, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall, aurora, breathFan, crystal } from "../ice.mjs";
export const meta = { id: "bs_glaciallord", key: "hd_glaciallord", w: 112, h: 128,
  note: "氷結回廊の主・凍王イザーク (層ボス): 三百年前に王家へ最初に仕えた操霊師。回廊ごと己を凍らせた氷の玉座に座り、ひざまで垂れる凍ったひげと、氷の棘の冠。毛皮の襟の付いた古い法衣は霜で白く、片手に長い杖、もう片手を前へ差し伸べる。口から凍てつく息を吐き (ブレス)、玉座の前には凍てつく先人たちがひざまずく (招来)。玉座の後ろには氷の棘の背もたれと、閉じ込められた魂の光である極光の帳" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    robe: { ramp: ramp(["#020306", "#060a12", "#0c1220", "#141c2e", "#1e2a40", "#2a3a54", "#3a4c6a", "#4e6280"], 6), dither: 0.6, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 0.7 + 2 * fbm(p.x * 0.1, p.y * 0.08)) },
    fur: { ramp: ramp(["#0a0e14", "#1c2632", "#2e3c4c", "#445668", "#5e7286", "#7e94a8", "#a4b8ca"], 5), dither: 0.6, amb: 0.3, shade: p => 0.12 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    skin: { ramp: ramp(["#0c1016", "#222a34", "#3a4652", "#56646e", "#788692", "#9aa8b4"], 5), dither: 0.45, amb: 0.4 },
    beard: { ramp: ramp(["#0c1420", "#203448", "#365470", "#527894", "#7aa0ba", "#a8c8dc", "#dceef8"], 5), spec: 1, pow: 30, specCol: "#ffffff", dither: 0.45,
      shade: p => 0.1 * Math.sin(p.x * 2.2) },
    gold: { ramp: ramp(["#0e0a04", "#2a200c", "#4e3e1a", "#7a6430", "#a48c50", "#d0bc80"], 4), amb: 0.35, spec: 1.2, pow: 30, specCol: "#fff0c0", dither: 0.4 },
    kneel: { ramp: ramp(["#020306", "#070b12", "#0e1520", "#16202e", "#202c3c"], 4), dither: 0.6 },
    maw: { ramp: ["#000000", "#03070c"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    soul: { ramp: SOUL, noRim: true, emit: p => 0.4 + 0.55 * Math.max(0, p.nz) },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  // 玉座: 座面の氷塊と、背の氷の棘
  const R = rand(10101);
  const spikes = [];
  for (let i = 0; i < 11; i++) { const x = 18 + i * 7.6, h = 56 + Math.sin(i / 10 * Math.PI) * 40 - (i % 2) * 14 + R() * 6; spikes.push(cone([x, 92, -18], [x + (x - 56) * 0.08, 92 - h, -20], 5.4, 0.4, "ice")); }
  const seat = Disp(U(2, box([56, 96, -4], [30, 8, 16], "ice", 2), box([26, 80, -2], [6, 16, 12], "ice", 2, -4), box([86, 80, -2], [6, 16, 12], "ice", 2, 4)), iceCracks(0.9, 0.25));
  const throne = Disp(U(1.5, ...spikes), iceCracks(0.6, 0.3));
  // 王: 座った体
  const J = { head: [56, 36, 4], neck: [56, 42, 3], chest: [56, 54, 2], waist: [56, 68, 2], hip: [56, 78, 4],
    shL: [44, 48, 3], elL: [32, 62, 8], haL: [28, 70, 12], shR: [68, 48, 3], elR: [80, 58, 10], haR: [92, 56, 16] };
  const body = humanoid(J, { skin: "robe", head: "skin" }, { w: { headX: 7, headY: 8, headZ: 7, chestX: 14, chestY: 10, chestZ: 9, waistX: 12, hipX: 13, arm: 4.6, arm2: 4, wrist: 3 } });
  const lap = U(2, ellipsoid([48, 84, 12], [8, 5, 12], "robe"), ellipsoid([64, 84, 12], [8, 5, 12], "robe"));
  const shins = U(2, cone([46, 86, 22], [44, 112, 24], 6, 7, "robe"), cone([66, 86, 22], [68, 112, 24], 6, 7, "robe"));
  const furc = Disp(torus([56, 45, 3], 11, 4, "fur", 0, 14), (x, y, z) => 0.6 * fbm(x * 0.8, y * 0.8, z * 0.8));
  const king = Disp(U(1.6, body, lap, shins), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.6 + fbm(x * 0.1, y * 0.1))) * Math.max(0, (y - 70) / 40));
  // ひざまで垂れる凍ったひげ
  const beard = []; for (let i = 0; i < 9; i++) { const x = 50 + i * 1.5; beard.push(cone([x, 40, 10], [x + (i - 4) * 0.9, 66 + (i % 3) * 6 + (4 - Math.abs(i - 4)) * 3, 15], 2, 0.3, "beard")); }
  const mous = U(0, cone([55, 40, 10.4], [46, 44, 10], 1.6, 0.3, "beard"), cone([57, 40, 10.4], [66, 44, 10], 1.6, 0.3, "beard"));
  const brow = ellipsoid([56, 32, 10.5], [6, 1.3, 2], "beard");
  const eyes = [sphere([53, 34.6, 10.4], 1, "eye"), sphere([59, 34.6, 10.4], 1, "eye")];
  const mouth = ellipsoid([56, 41, 10.6], [2.4, 1.4, 1.2], "maw");
  // 氷の棘の冠と金の輪
  const crown = [torus([56, 28, 4], 7.2, 1.1, "gold", 0, 10)];
  for (let i = 0; i < 7; i++) { const a = -2.7 + i * 0.4, x = 56 + Math.cos(a) * 7.2, y = 27 + Math.sin(a) * 1.4; crown.push(cone([x, y, 4 + Math.sin(a + 1.57) * 7], [x + Math.cos(a) * 2, y - 7 - (i === 3 ? 6 : i % 2 ? 1 : 3), 3], 1.4, 0.2, "ice")); }
  // 杖 (画面左の手) と差し伸べる手 (画面右)
  const staff = cyl([26, 112, 14], [30, 14, 12], 1.3, "gold");
  const staffHead = U(1, torus([30, 12, 12], 5, 0.9, "gold", 0, 90), sphere([30, 12, 12], 3, "soul"));
  const handL = [ellipsoid([28, 70, 13], [3, 2.8, 2.6], "skin"), ...fingers([28, 70, 13], 180, "skin", { n: 4, len: 4, spread: 20, r: 0.9, curl: 1.2, z: 0.5 })];
  const handR = [ellipsoid([93, 56, 16], [2.6, 2.4, 2.2], "skin"), ...fingers([94, 56, 16], -10, "skin", { n: 4, len: 6, spread: 40, r: 0.8, curl: -0.3, z: 0.5 })];
  // ひざまずく先人たち
  const devotee = (x, z, dir) => U(1.2, ellipsoid([x, 110, z], [6.4, 7, 6], "kneel", dir * 30), cone([x + dir * 5, 106, z + 1], [x + dir * 10, 112, z + 2], 4, 2.6, "kneel"), cone([x - dir * 3, 114, z], [x - dir * 5, 121, z], 6, 7.4, "kneel"), tube([[x + dir * 2, 108, z + 4, 1.6], [x + dir * 8, 117, z + 6, 1.3]], "kneel"));
  const scene = U(0, iceFloor(56, 124, 54, 18, { n: 3, seed: 10103, snow: 0.05 }), throne, seat, Sub(king, mouth, 0.3), furc, ...beard, mous, brow, ...eyes, ...crown, staff, staffHead, ...handL, ...handR,
    devotee(16, 30, 1), devotee(98, 28, -1));
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [30, 12, 18], r: 24, k: 0.35 }, { p: [56, 46, 26], r: 30, k: 0.25 }] });
  const C = new Canvas(r);
  C.set(53, 34, SOUL[4]); C.set(59, 34, SOUL[4]);
  // 凍てつく息 (口から下へ広がる)
  breathFan(C, 56, 43, 112, 40, 50, { seed: 7, own: ["beard", "robe", "ice", "fur", "kneel", "shelf", "snow", "skin", "gold"], dens: 1.05 });
  // 差し伸べた手の上の氷の結晶 (先人を呼ぶ印)
  crystal(C, 100, 46, 5);
  // 杖の頭の魂の光の輪
  for (let a = 0; a < Math.PI * 2; a += 0.12) { const x = 30 + Math.cos(a) * 8, y = 12 + Math.sin(a) * 8; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 4) > 0) C.set(x, y, SOUL[1]); }
  // 後ろの極光
  aurora(C, [[0, 112, 0, 50, AURORA.green, 2], [20, 92, 4, 34, AURORA.green, 6]], 0.5);
  hoarfrost(C, ["robe", "fur", "kneel"], { th: 0.3, seed: 39, k: 1.2 });
  icicles(C, 10105, ["ice", "robe", "kneel"], 0.1, 4);
  glints(C, 10107, ["ice"], 10);
  snowfall(C, 10109, 50, [2, 40, W - 4, 80]);
  return C.toArt();
}
