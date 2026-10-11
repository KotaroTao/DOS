import { sphere, ellipsoid, cone, tube, box, cyl, torus, slab, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { fingers } from "../human.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lantern, soot, murkMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "bs_moldern", key: "hd_moldern", w: 112, h: 128,
  note: "宰相モルデン (主): 三百年前、最初の操霊師に作られた最初の人業。痩せた長身で、裾が床に広がる黒い長衣に、宰相の黒紫の高い帽子と金の帯。前の割れた長衣の下に赤い内衣、胸に金の鎖と赤い宝石。青白い老いない顔に細い目と薄い笑み — 首と手首には木の継ぎ目と黒い鉄の関節の帯がのぞく人業の体。胸の小さな両開きの扉が開き、中で古い灯がひとつ、暖かいが弱い琥珀に揺れる。片手を軽く上げて払う仕草で隊の加護を払い落とし (打ち消し・多用)、名を呼んで反響の霊を寄せる (招来)。まわりには名札を結んだ濁った灯籠が並ぶ。長衣の下の木の体は刃を半ば逸らし (物理抵抗50)、一度は倒れない (不屈)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    robe: { ramp: ["#020103", "#07050a", "#0e0b12", "#16121b", "#1f1a26", "#2a2333"], dither: 0.55, amb: 0.22,
      shade: p => 0.12 * Math.sin(p.x * 1.1 + 1.6 * fbm(p.x * 0.12, p.y * 0.12)) },
    hat: { ramp: ["#05020a", "#100720", "#1e0e30", "#2e1644", "#42245a"], dither: 0.45, amb: 0.24, spec: 0.5, pow: 20, specCol: "#6a4c88" },
    red: { ramp: ["#0c0203", "#2a070c", "#4a0f16", "#7a2028"], dither: 0.45, amb: 0.26 },
    gold: { ramp: ["#120c02", "#3a2a0a", "#6a5018", "#a07e2c", "#d4b050", "#f4dc8a"], spec: 1.3, pow: 30, specCol: "#fff6d0", dither: 0.35 },
    gem: { ramp: ["#3a0408", "#8a0e18", "#d0303a", "#ff9a9a"], spec: 1.6, pow: 40, specCol: "#fff0f0", dither: 0.3, emit: p => 0.35 + 0.5 * Math.max(0, p.nz) },
    face: { ramp: ["#0e0d10", "#2a282e", "#46434c", "#6a6770", "#9a98a0", "#c4c2ca", "#e2e0e6"], dither: 0.4, amb: 0.3,
      shade: p => 0.04 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    wood: { ramp: ["#0c0805", "#2a1e12", "#4a3820", "#6e5432", "#9a7c52"], dither: 0.45,
      shade: p => 0.12 * Math.sin(p.y * 2.2 + 2 * fbm(p.x * 0.3, p.y * 0.1)) },
    iron: { ramp: ["#020203", "#08080b", "#121216", "#1e1e24"], spec: 1, pow: 30, specCol: "#5a5a66", dither: 0.4 },
    void: { ramp: ["#000000", "#040202"], amb: 0.02, dif: 0.05, noRim: true },
    flame: { ramp: MURK.slice(3), emit: p => 0.5 + 0.5 * Math.max(0, p.nz), noRim: true },
    eye: { ramp: ["#1a1418", "#3a3038"], amb: 0.2, dif: 0.3, noRim: true },
    tag: { ramp: ["#140e08", "#4a3820", "#8a7450", "#c4ac80"], dither: 0.4, amb: 0.3 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const cx = 54;
  // 黒い長衣: 細い肩から裾が床に広がる。前が割れて赤い内衣がのぞく
  const robe = Disp(Sub(U(3, cone([cx, 124, -2], [cx, 46, -2], 30, 9.5, "robe"), ellipsoid([cx, 44, -2], [12, 5, 8], "robe")), cone([cx - 1, 126, 20], [cx, 56, 10], 9, 1, "robe"), 1.2),
    (x, y, z) => 1.1 * Math.abs(Math.sin((x - cx) * 0.55 + y * 0.02)) * Math.min(1, (y - 50) / 40) + 0.4 * fbm(x * 0.2, y * 0.2));
  const inner = Disp(cone([cx - 1, 122, 5], [cx, 52, 3], 9, 3.6, "red"), (x, y, z) => 0.4 * Math.abs(Math.sin(y * 0.4)));
  // 高い襟 (後ろに立ち、顔は前に出る)
  const collar = U(1, cone([cx, 46, -5], [cx, 34, -8], 8, 12, "robe"));
  // 胸の扉 (両開き、少し開く) と中の古い灯
  const doorBox = box([cx, 62, 9], [4.4, 5.6, 2], "wood", 0.8);
  const doorHole = box([cx, 62, 12], [2.8, 4, 3.6], "void");
  const doors = [box([cx - 5.6, 62, 11.6], [2.4, 4.4, 0.5], "wood", 0.3, 0), box([cx + 5.6, 62, 11.6], [2.4, 4.4, 0.5], "wood", 0.3, 0)];
  const flame = U(0.6, ellipsoid([cx, 63, 8], [1.6, 2.6, 1.4], "flame"), cone([cx, 61.6, 8], [cx, 58, 8], 1.1, 0.2, "flame"));
  // 金の鎖と赤い宝石 (肩から胸の下へ弧)
  const chainPts = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16, x = cx - 9 + t * 18, y = 50 + Math.sin(t * Math.PI) * 22; chainPts.push(torus([x, y, 11 + Math.sin(t * Math.PI) * 4], 1.1, 0.45, "gold", (t - 0.5) * 120, k % 2 ? 0 : 90)); }
  const gem = U(0.4, ellipsoid([cx, 77, 15.6], [2, 2.6, 1.6], "gem"), torus([cx, 77, 15], 2.4, 0.55, "gold", 0, 90));
  // 細い腕: 右手 (画面左) は軽く上げて払う、左手は袖の中で下へ
  const armL = tube([[cx - 9, 48, 0, 4.4], [cx - 18, 58, 6, 4.4], [cx - 26, 48, 12, 4]], "robe", { seg: 3 });
  const cuff = cone([cx - 25, 49, 12], [cx - 29, 45, 13], 4.4, 5.4, "robe");
  const wristL = cyl([cx - 29.4, 44.6, 13], [cx - 30.6, 43.4, 13.4], 1.6, "iron", 0.3);
  const handL = U(0.8, ellipsoid([cx - 33, 41, 14], [2.4, 2.8, 1.6], "wood", -40), ...fingers([cx - 34, 39.4, 14], -130, "wood", { n: 4, len: 4.4, spread: 20, r: 0.65, curl: -0.4 }));
  const armR = tube([[cx + 9, 48, -2, 4.4], [cx + 15, 66, 0, 4.6], [cx + 16, 84, 2, 5.4]], "robe", { seg: 3 });
  const handR = U(0.6, cyl([cx + 16, 87, 2], [cx + 16, 89, 2], 1.4, "iron", 0.3), ellipsoid([cx + 16, 92, 3], [1.8, 2.6, 1.6], "wood"), ...fingers([cx + 16, 93, 3], 95, "wood", { n: 4, len: 3.4, spread: 12, r: 0.55, curl: 0.2 }));
  // 頭: 青白い老いない顔、首に木の継ぎ目と鉄の帯
  const neck = U(0.4, cyl([cx, 40, 0], [cx, 31, 1], 2.6, "wood", 0.4), cyl([cx, 37, 0], [cx, 35.2, 0.2], 3.1, "iron", 0.3));
  const face = Disp(U(1.2, ellipsoid([cx, 25, 3], [6.2, 8, 5.6], "face"), ellipsoid([cx, 31, 4], [4.2, 2.8, 4.2], "face"), cone([cx, 24, 8], [cx, 28.4, 9.2], 1.1, 0.5, "face")),
    (x, y, z) => -0.2 * Math.exp(-((x - cx + 2.6) ** 2 + (y - 23.4) ** 2) / 3) - 0.2 * Math.exp(-((x - cx - 2.6) ** 2 + (y - 23.4) ** 2) / 3));
  const eyes = [box([cx - 2.6, 23.6, 8.2], [1.6, 0.3, 1], "eye", 0.1, 8), box([cx + 2.6, 23.6, 8.2], [1.6, 0.3, 1], "eye", 0.1, -8)];
  // 高い帽子と金の帯
  const hat = U(0.8, cone([cx, 17, 1], [cx + 1.4, -3, -0.4], 7.4, 6.2, "hat"), ellipsoid([cx, 17, 0.4], [9, 1.4, 7.4], "hat"));
  const band = cyl([cx, 14.6, 1], [cx + 0.3, 11, 0.8], 7.45, "gold", 0.4);
  // 名札つきの濁った灯籠 (左右に並ぶ)
  const lampsAt = [[12, 124, 6, 2.4], [26, 126, -6, 2.2], [92, 124, 6, 2.4], [104, 125, -6, 2.1], [6, 104, -10, 1.8], [104, 102, -10, 1.8]];
  const lamps = lampsAt.map(([x, y, z, s], i) => lantern([x, y, z], s, { lit: true, handle: true, broken: i === 3 }));
  const tags = lampsAt.map(([x, y, z, s]) => U(0.2, box([x + 2.6 * s, y - 2.6 * s, z + 2.6 * s], [1.3, 2, 0.3], "tag", 0.2, 12), cyl([x + 1.6 * s, y - 5 * s, z + 2 * s], [x + 2.6 * s, y - 4.4 * s, z + 2.6 * s], 0.25, "tag")));
  const scene = U(0, cavernFloor(cx, 127, 55, 15, { seed: 14301, rocks: 0, lamps: 0 }), Sub(U(1, robe, collar, armL, cuff, armR), U(0, doorHole), 0.2), inner, Sub(doorBox, doorHole, 0.2), ...doors, flame,
    ...chainPts, gem, wristL, handL, handR, neck, face, ...eyes, hat, band, ...lamps, ...tags);
  const lights = [{ p: [cx, 63, 14], r: 14, k: 0.6 }, { p: [cx - 5, 24, 24], r: 20, k: 0.5 }, ...lampsAt.map(([x, y, z, s]) => ({ p: [x, y - 3 * s, z + 10], r: 16, k: 0.25 }))];
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights });
  const C = new Canvas(r);
  // 薄い笑み (口の線の両端を少し上げる)
  for (let dx = -3; dx <= 3; dx++) C.set(cx + dx, 30 - (Math.abs(dx) === 3 ? 1 : 0), Math.abs(dx) < 2 ? "#46434c" : "#2a282e");
  // 顔の木の継ぎ目 (こめかみから頬へ細い線)
  for (let y = 22; y < 31; y++) { C.only(cx - 6 + (y > 27 ? 1 : 0), y, "#46434c"); C.only(cx + 6 - (y > 27 ? 1 : 0), y, "#46434c"); }
  // 払う手の先の、剥がれ落ちる加護の光 (かけらが散る)
  const R = rand(14303);
  for (let k = 0; k < 18; k++) { const a = -2.4 + R() * 1.2, d = 6 + R() * 14, x = Math.round(cx - 36 + Math.cos(a) * d), y = Math.round(38 + Math.sin(a) * d); if (x < 0 || y < 0 || C.get(x, y)) continue; C.set(x, y, k % 3 ? "#8a90c8" : "#d8dcff"); if (k % 2 && !C.get(x + 1, y + 1)) C.set(x + 1, y + 1, "#3a3e66"); }
  for (const rr of [9, 13]) for (let a = -2.9; a < -1.4; a += 0.5 / rr) { const x = cx - 34 + Math.cos(a) * rr, y = 40 + Math.sin(a) * rr; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 14) > -0.3) C.set(x, y, rr < 10 ? "#5a5e8a" : "#2c2e4a"); }
  // 灯のまわりの暖かい光
  murkHalo(C, cx, 62, 9, MURK.slice(1, 3), 0.6);
  for (const [x, y, z, s] of lampsAt) murkHalo(C, x, y - 3.4 * s, 7 + s * 2, MURK.slice(0, 2), 0.5);
  murkMotes(C, 14305, 30, [4, 30, 104, 80]);
  shards(C, 14307, ["bed"], 16);
  soot(C, 14309, 40, [0, 0, W, H], ["#0a0909", "#151313", "#211e1d"]);
  return C.toArt();
}
