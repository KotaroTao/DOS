import { sphere, ellipsoid, cone, tube, box, torus, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { GLOOM, MURK, RIM, soot, murkMotes, afterimage, dissolve } from "../cavern.mjs";
export const meta = { id: "bs_echowraith", key: "hd_echowraith", w: 96, h: 96,
  note: "反響の霊: 壁に何度もはね返るうちに形をなした声の霊。灰紫の半透明の人の上半身が、腰から下は霧にほどけて宙に浮く。顔には口だけがいくつも開き (目も鼻もない)、胸や肩にも小さな口。輪郭はこだまのように何重にもずれて重なり、刃をすり抜ける (回避)。体のまわりに同心円の声の波が広がり、聞いた者は敵と味方の見分けを失う (混乱・多用)" };
export function build() {
  const mats = {
    body: { ramp: GLOOM.slice(1), dither: 0.65, amb: 0.3, shade: p => 0.1 * fbm(p.x * 0.3, p.y * 0.2, p.z * 0.3) },
    lip: { ramp: ["#0c0610", "#1e1226", "#30203c", "#463254", "#5e486e"], dither: 0.4, amb: 0.3 },
    maw: { ramp: ["#000000", "#05030a", "#0e0816"], amb: 0.05, dif: 0.2, noRim: true },
  };
  // 肩の張った細身の上半身 (胸のふくらみは作らず、肩から腰へまっすぐ細る)
  const body = Disp(U(2.4, ellipsoid([48, 25, 3], [7.4, 8.6, 6], "body"), tube([[48, 30, 1, 4], [48, 34, 0, 9]], "body"), box([48, 38, -1], [12, 3.4, 4.4], "body", 3),
    cone([48, 38, -1], [48, 62, 0], 10, 7, "body"),
    tube([[37, 37, 0, 3.4], [26, 46, 6, 2.8], [18, 40, 10, 2.2]], "body", { seg: 3 }), tube([[59, 37, 0, 3.4], [70, 46, 6, 2.8], [78, 40, 10, 2.2]], "body", { seg: 3 })), (x, y, z) => 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const tail = Disp(tube([[48, 60, 0, 7], [46, 72, 0, 6], [50, 82, -2, 4], [46, 90, -2, 1.4]], "body", { seg: 4 }), (x, y, z) => 0.8 * fbm(x * 0.2, y * 0.2, z * 0.2));
  // 口 [x, y, z, 幅, 開き, 傾き]
  const mouths = [[44, 22, 9.4, 2.6, 1.6, -10], [52, 23, 9.4, 2.4, 2, 12], [47, 30, 9, 3.2, 2.6, 0], [37, 37, 3.6, 2, 1.4, -30], [59, 37, 3.6, 2, 1.4, 30], [24, 45, 9, 1.8, 1.2, -50], [72, 45, 9, 1.8, 1.2, 50]];
  const lips = mouths.map(([x, y, z, w, h, a]) => ellipsoid([x, y, z], [w * 1.2, h * 1.2, 1.6], "lip", a));
  const holes = mouths.map(([x, y, z, w, h, a]) => ellipsoid([x, y, z + 1.2], [w, h, 1.6], "maw", a));
  const scene = U(0, Sub(U(1.5, body, tail, ...lips), U(0, ...holes), 0.2));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  dissolve(C, 70, 94, { seed: 13001 });
  // こだまのようにずれて重なる輪郭 (左右に二重・三重)
  afterimage(C, [[-4, 1, 0.55, GLOOM[4]], [4, -1, 0.55, GLOOM[4]], [-8, 2, 0.3, GLOOM[3]], [8, -2, 0.3, GLOOM[3]]], [0, 0, 96, 80]);
  // 声の波 (同心円)
  for (const rr of [30, 36, 42]) for (let a = 0; a < Math.PI * 2; a += 0.5 / rr) {
    const x = 48 + Math.cos(a) * rr, y = 40 + Math.sin(a) * rr * 0.8;
    if (Math.sin(a * 14 + rr) < -0.2) continue;
    if (x < 0 || y < 0 || x >= 96 || y >= 96 || C.get(Math.round(x), Math.round(y))) continue;
    C.set(x, y, rr === 30 ? GLOOM[6] : rr === 36 ? GLOOM[5] : GLOOM[3]);
  }
  murkMotes(C, 13003, 20, [4, 4, 88, 88]);
  soot(C, 13005, 30);
  return C.toArt();
}
