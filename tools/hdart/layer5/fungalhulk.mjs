import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mushrooms, mist, spores, leaves } from "../forest.mjs";
export const meta = { id: "bs_fungalhulk", key: "hd_fungalhulk", w: 96, h: 96,
  note: "キノコ人の巨体: 頭が巨大なキノコの傘になったずんぐりした菌糸の巨人。繊維が束になった弾力のある体と太く短い腕、体中に小さなキノコが群生し、傘の裏には密なひだ、その陰に暗い眼窩" };
export function build() {
  const mats = {
    cap: { ramp: ramp(["#060302", "#140a06", "#22120a", "#341c0f", "#482814", "#5e361c", "#946036"], 7), spec: 0.7, pow: 22, specCol: "#b48858", dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3) },
    wart: { ramp: ramp(["#0c0a08", "#2a261e", "#4a4436", "#6c6450", "#aaa288"], 5), spec: 0.4, pow: 20, dither: 0.4 },
    gill: { ramp: ramp(["#040302", "#120e0a", "#241e15", "#383020", "#4e442e", "#665a3e"], 6), dither: 0.5, amb: 0.3, dif: 0.6, noRim: true,
      shade: p => 0.16 * Math.sin(Math.atan2(p.z, p.x - 48) * 34) },
    myc: { ramp: ramp(["#050504", "#100f0c", "#1e1c17", "#2f2c24", "#433f34", "#5a5546", "#736d5a", "#8e8770"], 8), dither: 0.6, spec: 0.3, pow: 18,
      shade: p => 0.13 * Math.sin(p.x * 1.7 + 0.4 * p.y + 3 * fbm(p.x * 0.15, p.y * 0.08, p.z * 0.15)) + 0.06 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    mcap: { ramp: ramp(["#080403", "#1c0e08", "#341a0c", "#522a12", "#74401c", "#9a5a2a"], 6), spec: 0.8, pow: 25, specCol: "#c89060", dither: 0.45 },
    mstem: { ramp: ramp(["#0a0908", "#24211b", "#3e3a30", "#5c5646", "#7c7660"], 5), dither: 0.4 },
    maw: { ramp: ["#000000", "#040302", "#080604"], amb: 0.1, dif: 0.1, noRim: true },
    eye: { ramp: ["#2a3008", "#5a6a10", "#a0b830", "#dcec80"], emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const R = rand(5207);
  // 菌糸の巨体: ずんぐりした樽のような胴と短い太い四肢
  const torso = ellipsoid([48, 57, 0], [20, 20, 14], "myc");
  const chestB = ellipsoid([48, 46, 3], [17, 11, 12], "myc");
  const neck = ellipsoid([48, 36, 2], [11, 7, 9], "myc");
  const armL = tube([[30, 45, 2, 8.4], [20, 56, 6, 7.4], [17, 67, 9, 6.6]], "myc", { seg: 3 });
  const armR = tube([[66, 45, 2, 8.4], [76, 56, 6, 7.4], [79, 67, 9, 6.6]], "myc", { seg: 3 });
  const fistL = Disp(ellipsoid([15, 74, 11], [8.2, 7.4, 7.4], "myc"), (x, y, z) => 0.6 * Math.max(0, Math.sin(x * 1.3 + 1)));
  const fistR = Disp(ellipsoid([81, 74, 11], [8.2, 7.4, 7.4], "myc"), (x, y, z) => 0.6 * Math.max(0, Math.sin(x * 1.3)));
  const legL = tube([[39, 72, 0, 8], [37, 82, 3, 7.4], [36, 88, 5, 7]], "myc", { seg: 2 });
  const legR = tube([[57, 72, 0, 8], [59, 82, 3, 7.4], [60, 88, 5, 7]], "myc", { seg: 2 });
  const footL = ellipsoid([35, 89.5, 7], [8.4, 3.4, 8], "myc"), footR = ellipsoid([61, 89.5, 7], [8.4, 3.4, 8], "myc");
  // 繊維の束: 縦に走る畝 (弾力のある菌糸の筋)
  const fiber = (x, y, z) => 0.45 * Math.abs(Math.sin(Math.atan2(z, x - 48) * 16 + 0.08 * y + 2 * fbm(x * 0.1, y * 0.1, z * 0.1))) - 0.25;
  const body = Disp(U(0, U(3.2, torso, chestB, neck, legL, legR, footL, footR), U(2, armL, fistL), U(2, armR, fistR)), fiber);
  // 顔: 傘の陰の暗い眼窩と裂けた口
  const sockets = U(0, ellipsoid([42, 37, 10], [3, 2.4, 3], "maw", 15), ellipsoid([54, 37, 10], [3, 2.4, 3], "maw", -15), ellipsoid([48, 44.5, 12.5], [4.8, 1.6, 3], "maw"));
  const eyes = [sphere([42, 37.4, 9], 0.9, "eye"), sphere([54, 37.4, 9], 0.9, "eye")];
  // 巨大な傘: 上は丸く、縁は少し垂れ、裏にひだ
  const TL = 26;
  const capTop = Paint(Disp(ellipsoid([48, 22, -1], [38, 15, 24], "cap", 0, TL), (x, y, z) => 0.5 * fbm(x * 0.15, y * 0.2, z * 0.15)),
    (x, y, z, m) => m === "cap" && vnoise(x * 0.32, y * 0.5, z * 0.32) > 0.5 && y < 28 ? "wart" : m);
  const capCut = ellipsoid([48, 33, 2], [35, 9, 21], "gill", 0, TL);
  const cap = Sub(capTop, capCut, 1.0);
  const gills = Disp(ellipsoid([48, 28.5, 0], [34, 4, 20], "gill", 0, TL), (x, y, z) => 0.35 * Math.abs(Math.sin(Math.atan2(z, x - 48) * 30)));
  // 傘の上の疣
  const warts = [];
  for (let i = 0; i < 16; i++) {
    const x = 18 + R() * 60, ny = 1 - ((x - 48) / 38) ** 2;
    const y = 23 - 16 * Math.sqrt(Math.max(0, ny)) * (0.35 + R() * 0.55);
    warts.push(ellipsoid([x, y + 2, 8 + R() * 12], [1.8 + R() * 1.6, 0.9, 1.8], "wart"));
  }
  // 体に群生する小さなキノコ (肩・腕・胴の脇)
  const tufts = [];
  const tuft = (x, y, z, s, lean) => {
    const a = lean * Math.PI / 180, tx = x + Math.sin(a) * 3 * s, ty = y - Math.cos(a) * 3 * s;
    tufts.push(U(0.3, cone([x, y, z], [tx, ty, z + 0.6], 0.8 * s, 0.55 * s, "mstem"),
      Disp(ellipsoid([tx, ty - 0.3 * s, z + 0.6], [2.3 * s, 1.1 * s, 2.1 * s], "mcap", lean * 0.5), (X, Y, Z) => Math.max(0, (Y - ty) * 0.8))));
  };
  for (const [x, y, z, s, l] of [[28, 44, 6, 1.2, -35], [25, 47, 8, 0.9, -55], [31, 41, 4, 0.8, -15], [68, 44, 6, 1.1, 35], [71, 47, 8, 0.9, 55], [65, 41, 5, 0.75, 15],
    [36, 62, 14, 0.9, -25], [33, 66, 13, 0.7, -50], [61, 64, 14, 1.0, 30], [64, 68, 12, 0.7, 55], [22, 64, 11, 0.8, -70], [76, 62, 11, 0.85, 70], [47, 70, 15, 0.7, 5]])
    tuft(x, y, z, s * 1.8, l);
  const floorShrooms = mushrooms([[16, 91, 6, 1.1], [20, 92, 9, 0.8], [79, 91, 6, 1.2], [83, 92, 9, 0.8], [48, 92, 12, 0.7]], "mcap", "mstem");
  const floor = forestFloor(48, 93, 44, 13, { n: 0, roots: 3, seed: 52 });
  const scene = U(0, floor, Sub(body, sockets, 0.8), ...eyes, cap, gills, ...tufts, ...floorShrooms);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 40, 22], r: 14, k: 0.15 }] });
  const C = new Canvas(r);
  // ひだの陰の暗い線
  for (let x = 12; x < 86; x++) for (let y = 24; y < 40; y++) {
    const p = C.pix[y * 96 + x]; if (!p || p.m !== "gill") continue;
    if (((x * 7 + (y >> 1)) % 3) === 0) C.shift(x, y, mats.gill.ramp, -2);
  }
  // 再生の胞子: 体のまわりに淡い燐光の粒
  spores(C, 91, 30, [4, 30, 88, 56], true);
  leaves(C, 93, 48, 91, 40, 18);
  mist(C, 94, 2, [0, 78, 96, 14], 0.22);
  return C.toArt();
}
