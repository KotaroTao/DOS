import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SAND, BLOOD, ASHBED, STONE, IRON, BRASS, RIM, EMBER, GHOST, sandFloor, ashfall, embers, soulLamp } from "../arena.mjs";
export const meta = { id: "bs_arenalord", key: "hd_arenalord", w: 112, h: 128,
  note: "闘技場の支配者 (層ボス): 貴賓席から降りてきた、金の仮面をつけた巨大な興行主。笑みを刻んだ金の仮面、高い襟と豪奢な深紅の外套。外套の下は空っぽの鎧で、開いた金の胸当ての奥には闇しかない (物理抵抗50)。背には数えきれない小さな灯を吊るした大きな鉄の輪を負い、灯はどれも町を焼いた魂の火で赤く燃える (火)。仮面の眼が薄紅に光るたびに見た者は心を奪われ、仲間どうしで斬り合わされる (魅了)。高く掲げた手を打ち鳴らせば、足元の砂から亡霊剣闘士が起き上がる (招来)。致命の一撃を受けても一度は倒れない (不屈)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    cloak: { ramp: ["#060102", "#140306", "#24060b", "#360a10", "#4a1016", "#60181c"], dither: 0.6, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + 2 * fbm(p.x * 0.15, p.y * 0.15)) },
    gold: BRASS,
    mask: { ramp: ["#120c04", "#3a2a10", "#6a5020", "#9a7c3a", "#c8a85a", "#ecd690"], spec: 1.5, pow: 36, specCol: "#fff4d0", dither: 0.35 },
    void: { ramp: ["#000000", "#030102"], amb: 0, dif: 0.04, noRim: true },
    lamp: { ramp: EMBER.slice(1), noRim: true, emit: p => 0.35 + 0.6 * Math.max(0, p.nz) },
    ghost: { ramp: GHOST.slice(1, 7), dither: 0.6, amb: 0.3 },
    eye: { ramp: ["#5a1a34", "#c8507a", "#ffc0d8"], emit: () => 0.95 },
    sand: SAND, blood: BLOOD, ashbed: ASHBED, stone: STONE, iron: IRON,
  };
  // 背の輪と吊るした灯
  const ring = torus([56, 44, -22], 40, 1.6, "iron");
  const lamps = [], hangers = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (-1.08 + 1.16 * i / (N - 1)) - Math.PI * 0.0;
    const rx = 56 + Math.cos(a) * 40, ry = 44 + Math.sin(a) * 40;
    if (ry > 92) continue;
    const drop = 4 + (i % 3) * 2;
    hangers.push([rx, ry, drop]);
    lamps.push(Sub(U(0.3, ellipsoid([rx, ry + drop + 2, -20], [1.8, 2.4, 1.8], "lamp"), cone([rx, ry + drop, -20], [rx, ry + drop - 1.4, -20], 1.4, 0.4, "iron")), box([rx, ry + drop + 2, -17], [0.5, 1.4, 1.2], "lamp")));
  }
  // 貴賓席の石段 (奥)
  const tiersBack = U(0, box([56, 104, -34], [60, 5, 7], "stone", 0.5), box([56, 92, -46], [64, 5, 7], "stone", 0.5));
  // 外套 (肩から床へ大きく広がる)
  const cloak = Sub(Disp(U(4, cone([56, 124, -2], [56, 50, -2], 34, 14, "cloak"), ellipsoid([56, 50, -2], [22, 8, 12], "cloak")), (x, y, z) => 1.2 * Math.abs(Math.sin(x * 0.45 + y * 0.03)) + 0.6 * fbm(x * 0.2, y * 0.2)),
    cone([56, 130, 26], [56, 56, 14], 18, 4, "void"), 1);
  // 外套の割れ目の奥: 鎧の下には何もない闇
  const hollow = cone([56, 124, 4], [56, 70, 4], 16, 8, "void");
  const trim = [tube([[38, 54, 9, 1.4], [32, 86, 14, 1.6], [26, 122, 16, 1.8]], "gold"), tube([[74, 54, 9, 1.4], [80, 86, 14, 1.6], [86, 122, 16, 1.8]], "gold")];
  // 空っぽの鎧: 金の胸当ての真ん中が開き、奥は闇
  const chest = Sub(Disp(ellipsoid([56, 64, 8], [13, 13, 8], "gold"), (x, y, z) => -0.4 * Math.abs(Math.sin(y * 0.6))), U(0, ellipsoid([56, 70, 16], [5, 12, 8], "void")), 0.6);
  const voidIn = ellipsoid([56, 70, 8], [4.6, 11, 4], "void");
  const tassets = [box([48, 80, 12], [5, 5, 1.2], "gold", 0.6, 12), box([64, 80, 12], [5, 5, 1.2], "gold", 0.6, -12)];
  const collar = Disp(U(1, cone([56, 50, -2], [56, 36, -4], 9, 15, "cloak"), torus([56, 50, 2], 10, 1.2, "gold", 0, 14)), (x, y, z) => 0.5 * Math.abs(Math.sin(Math.atan2(z + 4, x - 56) * 8)));
  // 笑みを刻んだ金の仮面と、頭上の冠
  const mask = Disp(U(1.2, ellipsoid([56, 35, 6], [7.4, 9, 6], "mask"), cone([56, 38, 7], [56, 46, 6], 4.4, 1, "mask")), (x, y, z) => -0.6 * Math.exp(-((x - 52.6) ** 2 + (y - 37) ** 2) / 6) - 0.6 * Math.exp(-((x - 59.4) ** 2 + (y - 37) ** 2) / 6));
  const holes = U(0, ellipsoid([52.6, 32.6, 11.4], [2.2, 0.8, 1.6], "void", 18), ellipsoid([59.4, 32.6, 11.4], [2.2, 0.8, 1.6], "void", -18));
  const smile = Sub(torus([56, 37.4, 11.4], 3.4, 0.45, "void", 0, 90), box([56, 35.4, 11], [6, 3, 2], "void"));
  const eyes = [sphere([52.6, 32.6, 10.6], 0.8, "eye"), sphere([59.4, 32.6, 10.6], 0.8, "eye")];
  const crown = [torus([56, 26, 4], 7, 1, "gold", 0, 12), ...[-6, -3, 0, 3, 6].map(dx => cone([56 + dx, 26, 4 + Math.abs(dx) * -0.3], [56 + dx * 1.15, 19 - (dx ? 0 : 3), 3], 1.2, 0.3, "gold"))];
  // 両腕: 右手は高く掲げて手を打つ構え、左手は隊へ差しのべる
  const armR = tube([[72, 56, 4, 4.6], [86, 44, 8, 3.8], [90, 28, 10, 3.2]], "cloak");
  const armL = tube([[40, 56, 4, 4.6], [26, 62, 10, 3.8], [14, 58, 14, 3.2]], "cloak");
  const gauntR = U(0.8, cyl([89, 32, 10], [91, 24, 10], 3.4, "gold", 1), ...fingers([91, 22, 10], -80, "gold", { n: 4, len: 6, spread: 26, r: 1, curl: 0.2 }));
  const gauntL = U(0.8, cyl([18, 59, 13], [11, 57, 14], 3.4, "gold", 1), ...fingers([10, 57, 14], 175, "gold", { n: 4, len: 6, spread: 30, r: 1, curl: 0.3 }));
  // 砂から起き上がる亡霊剣闘士 (左下)
  const riser = U(1, ellipsoid([18, 114, 8], [5, 5.4, 5], "ghost"), torus([18, 114, 8], 5, 0.9, "ghost", 0, 10), tube([[24, 124, 10, 3.4], [22, 118, 10, 4]], "ghost"),
    tube([[26, 120, 10, 1.8], [30, 110, 12, 1.5], [28, 100, 12, 1.2]], "ghost"), cone([28, 100, 12], [26, 88, 12], 1, 0.3, "ghost"));
  const scene = U(0, sandFloor(56, 127, 54, 16, { seed: 13301, blood: 0.12, ash: 0.15, flags: 1, swords: 1, helms: 1 }), ring, ...lamps, cloak, hollow, ...trim, collar, chest, voidIn, ...tassets, Sub(mask, U(0, holes, smile), 0.2), ...eyes, ...crown, armR, armL, gauntR, gauntL, riser);
  const lights = hangers.filter((_, i) => i % 3 === 1).map(([x, y, d]) => ({ p: [x, y + d + 2, -10], r: 18, k: 0.3 }));
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [...lights, { p: [56, 30, 30], r: 30, k: 0.3 }] });
  const C = new Canvas(r);
  // 灯を吊るす細い鎖と、灯の火のゆらめき
  for (const [x, y, d] of hangers) {
    for (let k = 1; k < d; k++) if (!C.get(Math.round(x), Math.round(y + k)) || C.pix[Math.round(y + k) * W + Math.round(x)]?.m === "stone") C.set(x, y + k, k % 2 ? "#2c1b11" : "#1c110a");
    const lx = Math.round(x), ly = Math.round(y + d + 2);
    if (!C.get(lx, ly - 4)) C.set(lx, ly - 4, EMBER[2]);
    C.set(lx, ly, EMBER[4]);
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -5], [0, 4], [-2, -3], [2, -3], [-2, 3], [2, 3]]) if (!C.get(lx + dx, ly + dy)) C.set(lx + dx, ly + dy, EMBER[0]);
  }
  // 仮面の眼から放たれる薄紅の魅了の光 (左下の隊へ)
  const CH = ["#3a1626", "#6a2a44", "#a8507a", "#e8a0c0"];
  for (const [ex, ey] of [[52.6, 32.6], [59.4, 32.6]]) for (let t = 0; t < 1; t += 0.008) { const x = ex - t * 52, y = ey + t * 50 + Math.sin(t * 16) * 2; if (C.get(Math.round(x), Math.round(y))) continue; C.set(x, y, CH[t < 0.25 ? 3 : t < 0.6 ? 2 : 1]); }
  for (const [x, y] of [[8, 76], [20, 88], [4, 92], [30, 80]]) { C.set(x, y, CH[3]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!C.get(x + dx, y + dy)) C.set(x + dx, y + dy, CH[1]); }
  // 打ち鳴らす手の衝撃 (掲げた右手のまわりに弧)
  for (const rr of [9, 13]) for (let a = -2.6; a < -0.4; a += 0.04) { const x = 91 + Math.cos(a) * rr, y = 18 + Math.sin(a) * rr; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 12) > -0.2) C.set(x, y, rr < 10 ? "#a08040" : "#4a3616"); }
  embers(C, 13303, 40, [0, 0, W, 110]);
  ashfall(C, 13305, 80);
  return C.toArt();
}
