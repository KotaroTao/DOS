import { sphere, ellipsoid, cone, box, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers } from "../lava.mjs";
export const meta = { id: "bs_obsidianguard", key: "hd_obsidianguard", w: 96, h: 96,
  note: "黒曜の番兵: 黒曜石を削り出した、鋭い切り子の面ばかりの番兵。鏡のような面は火を映して赤い照りを走らせ、身の丈ほどの黒曜の大盾を前に突き立てて後ろの者をかばう。飛んできた呪文は磨かれた盾の面で砕け、紫の火花になって弾け散る" };
export function build() {
  const mats = {
    glass: { ramp: ramp(["#010103", "#05040a", "#0b0912", "#13101c", "#1d1828", "#2a2338", "#3a314c"], 7), spec: 1.6, pow: 50, specCol: "#e8d8ff", dither: 0.35, amb: 0.12 },
    face: { ramp: ramp(["#020104", "#08060e", "#120e1a", "#1e1828", "#2c2438", "#40364e", "#5a4e6c"], 7), spec: 1.8, pow: 60, specCol: "#fff0ff", dither: 0.3, amb: 0.1 },
    core: { ramp: ["#5a0e04", "#c43e0c", "#ffae3a", "#fff0b0"], noRim: true, emit: () => 0.8 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 切り子の体: 角の立った箱を回して積み、鋭い肩の棘
  const torso = box([54, 42, -4], [10, 13, 7], "glass", 0.6, 8);
  const chestFacet = box([54, 38, 2], [7, 7, 4], "glass", 0.4, 45);
  const head = U(0.4, box([56, 22, -2], [5, 6, 5], "glass", 0.4, 12), cone([56, 18, -2], [58, 8, -3], 3.6, 0.2, "glass"));
  const shoulder = [cone([44, 30, 0], [36, 18, 2], 4.4, 0.3, "glass"), cone([64, 30, -6], [72, 16, -8], 4.4, 0.3, "glass")];
  const armR = U(0.5, box([68, 44, -6], [3.6, 10, 3.6], "glass", 0.4, -12), box([70, 58, -6], [3.6, 6, 3.6], "glass", 0.4, -4));
  const legs = [box([48, 72, -2], [4.6, 13, 4.6], "glass", 0.4, 4), box([60, 72, -6], [4.6, 13, 4.6], "glass", 0.4, -4)];
  const hips = box([54, 58, -4], [9, 5, 6], "glass", 0.4);
  const body = U(0.6, torso, chestFacet, head, ...shoulder, armR, ...legs, hips);
  // 身の丈ほどの大盾: 切り子に削った黒曜の板 (前に突き立てる)
  const shield = slab([[22, 24], [38, 20], [42, 34], [40, 70], [30, 86], [20, 70], [18, 34]], 10, 3, "face", 0.4, 1.5);
  const ridge = box([30, 52, 13.6], [0.8, 28, 0.8], "face", 0.2, 2);
  const core = sphere([54, 38, 6.4], 1.8, "core");
  const eyes = [box([54.5, 21, 3.2], [1.4, 0.5, 0.4], "core", 0.1, 12), box([58.5, 22, 3.2], [1.2, 0.5, 0.4], "core", 0.1, 12)];
  const scene = U(0, lavaFloor(48, 92, 44, 13, { n: 4, seed: 8601 }), body, shield, ridge, core, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, inner: 2.5, lights: [{ p: [40, 96, 30], r: 60, k: 0.35 }] });
  const C = new Canvas(r);
  // 鏡面に映る溶岩の照り: 盾と体の下寄りの面に赤い斜めの筋
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const p = C.pix[y * 96 + x]; if (!p || (p.m !== "face" && p.m !== "glass")) continue;
    const band = (x * 0.6 + y + 6 * fbm(x * 0.1, y * 0.1, 2)) % 19;
    if (band < 1.1 && p.ny > -0.2 && y > 30) C.set(x, y, y > 60 ? "#c43e0c" : "#7a1a06");
  }
  // 盾の面で砕ける呪文の火花 (紫)
  const SP = ["#3a1a5a", "#7a3ab0", "#c080f0", "#f0d8ff"];
  const R = rand(8603);
  for (const [cx, cy] of [[14, 36], [12, 58]]) {
    C.disc(cx + 2, cy, 1.6, SP[2]); C.set(cx + 2, cy, SP[3]);
    for (let i = 0; i < 10; i++) { const a = Math.PI * (0.55 + R() * 0.9), d = 2 + R() * 7; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SP[Math.floor(R() * 3)]); }
  }
  underglow(C, { skip: ["core"] });
  embers(C, 8605, 18, [4, 2, 88, 40]);
  return C.toArt();
}
