import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, tri } from "../mine.mjs";
export const meta = { id: "bs_minebat", key: "hd_minebat", w: 96, h: 96,
  note: "坑道の吸血蝙蝠: 人の背丈ほどの翼を広げて舞い降りる大蝙蝠。裂けた皮膜に浮く指骨、尖った大耳と潰れた鼻、血走った眼、剥いた牙" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030202", "#0b0706", "#150e0b", "#211611", "#2e1f17", "#3e2a1f", "#523829"], 7), dither: 0.6, spec: 0.2, pow: 15,
      shade: p => 0.12 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    skin: { ramp: ramp(["#040202", "#0f0807", "#1c0f0d", "#2a1714", "#3a211c", "#4c2c25", "#623a30"], 7), spec: 0.6, pow: 25, specCol: "#8c5a4c", dither: 0.5 },
    memb: { ramp: ramp(["#030202", "#090505", "#110a09", "#1b100e", "#261714", "#33201b"], 6), dither: 0.6, amb: 0.2, dif: 0.7,
      shade: p => 0.08 * fbm(p.x * 0.3, p.y * 0.3) },
    bone: { ramp: ramp(["#040303", "#120c0a", "#22170f", "#342416", "#4a3420", "#62462c"], 6), spec: 0.5, pow: 25, dither: 0.4 },
    eye: { ramp: ["#2a0000", "#5a0404", "#8c0c08", "#c41c10", "#f04020"], emit: p => 0.45 + 0.5 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0c0203", "#1a0506"], amb: 0.2, dif: 0.2, noRim: true },
  };
  const cx = 48;
  // 胴と頭
  const torso = ellipsoid([cx, 46, 0], [8.5, 12, 7], "fur");
  const head = ellipsoid([cx, 30, 4], [7.5, 6.5, 6.5], "fur");
  const snout = ellipsoid([cx, 34, 10], [4, 3.2, 3], "skin");
  const ears = [cone([cx - 5, 26, 2], [cx - 11, 10, -1], 3.8, 0.4, "skin"), cone([cx + 5, 26, 2], [cx + 11, 10, -1], 3.8, 0.4, "skin")];
  const earHole = [ellipsoid([cx - 8, 18, 1.5], [1.8, 5, 1.5], "maw", -20), ellipsoid([cx + 8, 18, 1.5], [1.8, 5, 1.5], "maw", 20)];
  const eyes = [sphere([cx - 3.6, 29, 9], 1.5, "eye"), sphere([cx + 3.6, 29, 9], 1.5, "eye")];
  const mouth = ellipsoid([cx, 37.5, 10], [3.2, 2, 2.4], "maw");
  // 脚: 胴の下でかぎ爪を縮める
  const legs = [tube([[cx - 4, 56, 0, 2], [cx - 6, 64, 2, 1.5], [cx - 5, 69, 4, 1]], "skin"), tube([[cx + 4, 56, 0, 2], [cx + 6, 64, 2, 1.5], [cx + 5, 69, 4, 1]], "skin")];
  // 翼: 上腕・前腕・長い指骨。皮膜は指の間を縫って縁で裂ける
  const wing = (s) => {
    const X = dx => cx + s * dx;
    const sh = [X(6), 38, -1], el = [X(20), 28, -3], wr = [X(32), 34, -4];
    const fingersTip = [[X(46), 12, -6], [X(47), 36, -6], [X(42), 58, -5], [X(30), 66, -4]];
    const bones = [tube([[...sh, 2.4], [...el, 1.9], [...wr, 1.5]], "bone"), sphere(el, 2.2, "bone"), sphere(wr, 1.8, "bone")];
    for (const f of fingersTip) bones.push(tube([[...wr, 1.2], [(wr[0] + f[0]) / 2, (wr[1] + f[1]) / 2 - 2, -5, 0.8], [...f, 0.35]], "bone"));
    const thumb = cone(wr, [X(31), 29, -2], 1.2, 0.3, "bone");
    // 皮膜の輪郭: 肩→指先→指先…→脇腹。指先と指先の間は内側へえぐれる
    const pts = [[X(6), 34], [X(20), 25], [X(46), 12], [X(44), 22], [X(47), 36], [X(41), 45], [X(42), 58], [X(35), 59], [X(30), 66], [X(20), 60], [X(9), 58]];
    const memb = Disp(slab(pts, -6, 0.9, "memb", 0.5), (x, y, z) => 0.6 * fbm(x * 0.2, y * 0.2));
    return [memb, ...bones, thumb];
  };
  const bat = U(1.2, torso, head, snout, ...ears, ...legs);
  const scene = U(0, Sub(bat, U(0, mouth, ...earHole), 0.6), ...eyes, ...wing(-1), ...wing(1));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 皮膜の裂け目と破れ穴
  for (const [x, y, w, h] of [[14, 50, 3, 4], [80, 22, 2, 5], [74, 52, 2, 3], [19, 27, 2, 2]]) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (C.get(x + i, y + j)) C.set(x + i, y + j, null);
  // 牙
  const F = ["#7a6c58", "#d8ccb0"];
  tri(C, [cx - 2.6, 36.5], [cx - 1.2, 36.5], [cx - 1.9, 40.5], F[1]); tri(C, [cx + 1.2, 36.5], [cx + 2.6, 36.5], [cx + 1.9, 40.5], F[1]);
  C.set(cx - 2, 36, F[0]); C.set(cx + 2, 36, F[0]);
  // 鼻の穴と、口から滴る血
  C.set(cx - 1, 33, "#000000"); C.set(cx + 1, 33, "#000000");
  for (let i = 0; i < 4; i++) C.set(cx + 1, 40 + i, i < 3 ? "#5a0808" : "#a01810");
  return C.toArt();
}
