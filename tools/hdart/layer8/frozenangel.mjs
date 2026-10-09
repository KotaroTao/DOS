import { sphere, ellipsoid, cone, tube, box, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_frozenangel", key: "hd_frozenangel", w: 96, h: 96,
  note: "氷漬けの堕天: 翼を広げたまま太い氷柱にはりつけにされた、堕ちた天使の像。目を閉じてうなだれ、胸の前で手を組む。広げた翼の羽根は一枚一枚が氷で、はがれ落ちて舞う氷の羽根を浴びた者は、像と同じく氷に固まる (石化)。体を包む厚い氷が呪文を滑らせる" };
export function build() {
  const mats = {
    stone: { ramp: ramp(["#05070a", "#10161e", "#1c2632", "#2a3846", "#3a4c5c", "#4e6474", "#66808e", "#8aa2ae"], 8), spec: 0.5, pow: 20, dither: 0.5, amb: 0.22 },
    feather: { ramp: ramp(["#04070c", "#0c1624", "#162a40", "#22405c", "#325878", "#467494", "#6290aa", "#88b0c4"], 8), spec: 1.2, pow: 34, specCol: "#d8eef8", dither: 0.45 },
    hole: { ramp: ["#000000", "#02040a"], amb: 0, dif: 0.05, noRim: true },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  // 背の太い氷柱
  const pillar = Disp(U(1, cone([48, 96, -12], [48, -4, -12], 10, 7, "ice")), iceCracks(0.8, 0.25));
  const J = { head: [48, 24, 2], neck: [48, 30, 1], chest: [48, 40, 0], waist: [48, 52, 0], hip: [48, 59, 0],
    shL: [40, 35, 1], elL: [40, 45, 6], haL: [46, 48, 8], shR: [56, 35, 1], elR: [56, 45, 6], haR: [50, 48, 8] };
  const body = humanoid(J, { skin: "stone" }, { w: { headX: 4.6, headY: 5.6, chestX: 8, chestY: 7, waistX: 6, hipX: 7, arm: 2.4, arm2: 2, wrist: 1.6 } });
  const gown = Disp(cone([48, 54, 0], [48, 86, -2], 7.5, 13, "stone"), (x, y, z) => 0.6 * Math.sin(Math.atan2(z, x - 48) * 6 + y * 0.1) * Math.max(0, (y - 58) / 28));
  const halo = Disp(tube([[38, 10, -2, 1], [42, 6, -2, 1], [48, 5, -2, 1], [54, 6, -2, 1], [58, 10, -2, 1]], "stone"), (x, y, z) => 0.2 * fbm(x, y, z)); // 欠けた光輪
  const shut = U(0, ellipsoid([46, 24.4, 6.4], [1.4, 0.35, 0.6], "hole"), ellipsoid([50, 24.4, 6.4], [1.4, 0.35, 0.6], "hole"));
  // 翼: 上へ広がる羽根の扇 (左右)
  const wing = (side) => {
    const out = [];
    const feather = (x0, y0, x1, y1, w, z) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
      return slab([[x0, y0], [x0 + dx * 0.35 + nx, y0 + dy * 0.35 + ny], [x1, y1], [x0 + dx * 0.35 - nx, y0 + dy * 0.35 - ny]], z, 0.9, "feather", 0.5, 0.4); };
    // 風切り羽 (長い) と雨覆い (短い) の二段の扇
    for (let i = 0; i < 9; i++) {
      const a = (-178 + i * 12) * Math.PI / 180, len = 30 + Math.sin(i / 8 * Math.PI) * 12;
      const x0 = 48 + side * 8, y0 = 34;
      out.push(feather(x0, y0, x0 + side * Math.abs(Math.cos(a)) * len, y0 + Math.sin(a) * len * 0.85 + 4, 5, -6 - i * 0.3));
    }
    for (let i = 0; i < 6; i++) {
      const a = (-170 + i * 18) * Math.PI / 180, len = 16 + Math.sin(i / 5 * Math.PI) * 6;
      const x0 = 48 + side * 7, y0 = 33;
      out.push(feather(x0, y0, x0 + side * Math.abs(Math.cos(a)) * len, y0 + Math.sin(a) * len * 0.85 + 3, 4.4, -3));
    }
    return out;
  };
  // 手首・胴を縫い留める氷の帯
  const bands = [Disp(box([48, 44, 2], [12, 2, 7], "ice", 1, 4), iceCracks(0.5, 0.5)), Disp(box([48, 70, 0], [11, 2.4, 9], "ice", 1, -6), iceCracks(0.5, 0.5))];
  const scene = U(0, iceFloor(48, 94, 40, 13, { n: 3, seed: 9701, snow: 0.08 }), pillar, ...wing(-1), ...wing(1), Sub(U(1.2, body, gown), shut, 0.2), halo, ...bands);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // うなだれた顔の陰
  for (let y = 26; y < 30; y++) for (let x = 45; x < 52; x++) C.shift(x, y, mats.stone.ramp, -1);
  // 舞い落ちる氷の羽根 (浴びた者を固める)
  const R = rand(9703);
  for (let i = 0; i < 12; i++) {
    const x = 6 + R() * 84, y = 50 + R() * 40; if (C.get(Math.round(x), Math.round(y))) continue;
    const d = R() < 0.5 ? 1 : -1;
    for (let k = 0; k < 4; k++) if (!C.get(Math.round(x + k * d), Math.round(y + k * 0.5))) C.set(x + k * d, y + k * 0.5, k === 0 ? "#88b0c4" : k === 3 ? "#22405c" : "#467494");
  }
  hoarfrost(C, ["stone", "feather"], { th: 0.35, seed: 29 });
  icicles(C, 9705, ["feather", "ice"], 0.12, 4);
  glints(C, 9707, ["ice", "feather"], 7);
  snowfall(C, 9709, 26);
  return C.toArt();
}
