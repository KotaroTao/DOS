import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, SOULS, towerFloor, chain, sparks, rain, clouds } from "../storm.mjs";
export const meta = { id: "bs_harpyqueen", key: "hd_harpyqueen", w: 96, h: 96,
  note: "嵐の鳥女王: 塔の手すりの鎖に鉤爪をかけてとまる、人の上半身と黒い翼をもつ鳥の女王。羽を逆立てた冠、蒼白い顔、白く光る眼。胸をそらして高く歌い、その歌声を聞いた者はうっとりと女王のもとへ歩み寄る (魅了・多用)。歌は鴉の群れを呼び集める (招来)。肩のまわりに小さな鴉がもう二羽" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#0c0a0e", "#1c1820", "#2e2834", "#423b4a", "#585062", "#70687c", "#8a8296", "#a49cb0"], 8), dither: 0.45, amb: 0.3 },
    feather: { ramp: ramp(["#030308", "#08070f", "#100e1d", "#19162c", "#24203d", "#302a50", "#3e3766"], 7), dither: 0.6, amb: 0.22,
      shade: p => 0.16 * (Math.abs(Math.sin(Math.hypot(p.x - 48, p.y - 40) * 0.6)) - 0.5) },
    hair: { ramp: ramp(["#020206", "#08081a", "#12122e", "#1e1e46", "#2c2c60"], 5), dither: 0.5 },
    claw: { ramp: ramp(["#0a0804", "#221c0e", "#3e341c", "#62542e", "#8c7c48"], 5), spec: 0.9, pow: 30 },
    hole: { ramp: ["#000000", "#08060a", "#1a0e14"], amb: 0, dif: 0.1, noRim: true },
    eye: { ramp: [BOLT[2], BOLT[3], BOLT[4]], emit: () => 0.9 },
    far: { ramp: ramp(["#030307", "#080812", "#0e0e1c", "#161628"], 4), dither: 0.6 },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  const torso = U(2, ellipsoid([48, 46, 2], [8, 9, 6], "skin"), ellipsoid([48, 58, 0], [9, 8, 7], "feather"),
    Disp(ellipsoid([48, 50, 3], [8.6, 4, 6.4], "feather"), (x, y, z) => 0.6 * Math.abs(Math.sin(x * 1.3))));
  const neck = tube([[48, 38, 2, 2.6], [48, 32, 3, 2.4]], "skin");
  const head = ellipsoid([48, 26, 4], [5.8, 7, 5.6], "skin", 0, -10);
  // 両肩へ流れ落ちる長い黒髪 (顔のまわりを縁どる)
  const hair = Disp(U(1.4, ellipsoid([48, 22, 1], [7.4, 6, 6], "hair"), tube([[43, 22, 3, 3.4], [40, 32, 4, 3.4], [37, 44, 3, 2.6], [36, 54, 2, 1.2]], "hair"), tube([[53, 22, 3, 3.4], [56, 32, 4, 3.4], [59, 44, 3, 2.6], [60, 54, 2, 1.2]], "hair")), (x, y, z) => 0.4 * fbm(x * 0.5, y * 0.5));
  const face = ellipsoid([48, 27.4, 6.6], [4.2, 5.4, 3.4], "skin");
  // 逆立った羽の冠
  const crown = [];
  for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.36; crown.push(cone([48 + Math.cos(a) * 5, 20 + Math.sin(a) * 2, 0], [48 + Math.cos(a) * 12, 10 + Math.sin(a) * 4 - (i === 3 ? 4 : 0), -2], 1.4, 0.3, "feather")); }
  const mouth = ellipsoid([48, 30.8, 9.6], [1.4, 1.8, 1.4], "hole");
  // 広げた翼 (腕と一つ)
  const wingPoly = (s) => s < 0
    ? [[42, 40], [30, 30], [14, 22], [2, 26], [8, 32], [0, 38], [10, 42], [2, 50], [14, 52], [8, 60], [22, 58], [24, 66], [36, 60], [42, 56]]
    : [[54, 40], [66, 30], [82, 22], [94, 26], [88, 32], [96, 38], [86, 42], [94, 50], [82, 52], [88, 60], [74, 58], [72, 66], [60, 60], [54, 56]];
  const wings = [slab(wingPoly(-1), -1, 1.1, "feather", 0.7, 1), slab(wingPoly(1), -1, 1.1, "feather", 0.7, 1)];
  const arms = [tube([[42, 40, 2, 2.4], [28, 30, 2, 1.8], [14, 23, 2, 1.2]], "feather"), tube([[54, 40, 2, 2.4], [68, 30, 2, 1.8], [82, 23, 2, 1.2]], "feather")];
  const tail = [cone([48, 64, -2], [42, 80, -6], 3.6, 1, "feather"), cone([48, 64, -2], [54, 80, -6], 3.6, 1, "feather")];
  // 鳥の脚と、鎖をつかむ鉤爪
  const legs = [tube([[44, 64, 3, 2.6], [42, 72, 4, 1.6], [40, 78, 4, 1.2]], "claw"), tube([[52, 64, 3, 2.6], [54, 72, 4, 1.6], [56, 78, 4, 1.2]], "claw")];
  const talons = [];
  for (const x of [40, 56]) for (const d of [-2.4, 0, 2.4]) talons.push(cone([x, 78, 4], [x + d, 82, 7], 0.8, 0.3, "claw"));
  const links = chain([4, 82, 4], [92, 80, 4], 1.6);
  const posts = [tube([[6, 82, 2, 2], [6, 94, 2, 2.2]], "iron"), tube([[90, 80, 2, 2], [90, 94, 2, 2.2]], "iron")];
  const eyes = [sphere([46.2, 25.4, 9.4], 0.8, "eye"), sphere([49.8, 25.4, 9.4], 0.8, "eye")];
  // 肩のまわりの小さな鴉
  const crow = (cx, cy, s) => U(0.6, ellipsoid([cx, cy, -14], [3 * s, 2 * s, 2 * s], "far", -10), slab([[cx - 1, cy], [cx - 7 * s, cy - 5 * s], [cx - 9 * s, cy - 1 * s]], -14, 0.4, "far", 0.2), slab([[cx + 1, cy], [cx + 7 * s, cy - 6 * s], [cx + 9 * s, cy - 2 * s]], -14, 0.4, "far", 0.2));
  const scene = U(0, towerFloor(48, 96, 44, 10, { n: 1, seed: 10501, wet: 0.2 }), ...posts, ...links, ...wings, Sub(U(1.2, torso, neck, head, ...arms, ...tail), mouth, 0.2), hair, Sub(face, mouth, 0.2), ...crown, ...legs, ...talons, ...eyes,
    crow(16, 12, 1), crow(80, 10, 0.8));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 26, 24], r: 16, k: 0.3 }] });
  const C = new Canvas(r);
  // 歌声 (口から広がる淡い弧)
  for (const [r0, c] of [[6, SOULS[3]], [10, SOULS[2]], [14, SOULS[1]]]) for (let a = -0.6; a < 0.6; a += 0.06) for (const side of [-1, 1]) {
    const x = 48 + side * Math.cos(a) * r0 * 1.4, y = 30 + Math.sin(a) * r0;
    if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 12 + r0) > -0.3) C.set(x, y, c);
  }
  clouds(C, [[20, 86, 16, 4], [76, 88, 14, 4]], { dens: 0.5, seed: 5 });
  rain(C, 10503, 40);
  sparks(C, 10505, 8);
  return C.toArt();
}
