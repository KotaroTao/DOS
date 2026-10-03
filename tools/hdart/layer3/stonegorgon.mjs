import { tube, sphere, ellipsoid, cone, slab, cyl, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_stonegorgon", key: "hd_stonegorgon", w: 96, h: 96,
  note: "石化の眼: 蛇の髪をうねらせる蒼白い女の霊。見開いた双眸から凍てつく光が射し、裾は石の床へ流れ落ちる。足元には石になりかけた坑夫の腕が突き出している" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#040505", "#0e1110", "#191e1c", "#252c29", "#323a36", "#414a44", "#535d55", "#687266", "#828c7e"], 9), spec: 0.8, pow: 30, specCol: "#b4c0b0", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    robe: { ramp: ramp(["#030303", "#080a09", "#0f1311", "#171c19", "#202723", "#2a332d"], 6), dither: 0.6, shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 0.12) },
    snake: { ramp: ramp(["#020301", "#070a04", "#0f1508", "#18210d", "#232f13", "#31401a", "#435424", "#5a6c30"], 8), spec: 1.4, pow: 40, specCol: "#c0d090", dither: 0.45,
      shade: p => (Math.floor(p.x * 0.9 + p.y * 0.9) % 2 ? -0.05 : 0.03) },
    eye: { ramp: ["#20302c", "#4a6c62", "#8ac0b0", "#d4fff0", "#ffffff"], emit: p => 0.6 + 0.4 * Math.max(0, p.nz) },
    petri: { ramp: ramp(["#060606", "#151515", "#262624", "#3a3936", "#504e4a", "#6a6862"], 6), spec: 0.3, pow: 20, dither: 0.6 },
    maw: { ramp: ["#000000", "#060808", "#0c100e"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  const J = { head: [48, 30, 8], neck: [48, 37, 5], chest: [48, 47, 2], waist: [48, 58, 0], hip: [48, 66, -1],
    shL: [39, 42, 4], elL: [30, 52, 10], haL: [24, 44, 16], shR: [57, 42, 3], elR: [66, 52, 10], haR: [72, 44, 16] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 5.4, headY: 6.6, headZ: 5.6, neck: 2.2, chestX: 8.5, chestY: 7, chestZ: 5.5, waistX: 6, waistY: 6, hipX: 8, arm: 2.2, arm2: 1.8, wrist: 1.3 }, k: 1.4 });
  const handL = fingers([24, 44, 16], -110, "skin", { n: 4, len: 4.5, spread: 24, r: 0.75, curl: -0.4, z: 1 });
  const handR = fingers([72, 44, 16], -70, "skin", { n: 4, len: 4.5, spread: 24, r: 0.75, curl: 0.4, z: 1 });
  // 裾: 腰から床へ広がる経帷子
  const robe = Disp(cone([48, 58, -1], [48, 90, -2], 9, 20, "robe"), (x, y, z) => 0.9 * Math.sin(Math.atan2(z + 2, x - 48) * 7 + y * 0.1) * Math.max(0, (y - 62) / 28));
  // 蛇の髪: 頭から放射状にうねる十数匹、先端に頭
  const snakes = [];
  const R = rand(91);
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * 0.95 + i / 12 * Math.PI * 0.9 + (R() - 0.5) * 0.12, L = 15 + R() * 7, w = (R() - 0.5) * 1.2;
    const pts = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5, aa = a + Math.sin(t * 3.2 + i) * 0.35 + w * t; const rr = 4 + t * L; pts.push([48 + Math.cos(aa) * rr * 1.1, 28 + Math.sin(aa) * rr, 6 + Math.sin(t * 2 + i) * 4 - (i % 3) * 2, 1.9 - t * 0.7]); }
    snakes.push(tube(pts, "snake", { seg: 3 }));
    const e = pts[5]; const d = [e[0] - pts[4][0], e[1] - pts[4][1]]; const dl = Math.hypot(...d);
    snakes.push(ellipsoid([e[0] + d[0] / dl * 1.4, e[1] + d[1] / dl * 1.4, e[2]], [2, 1.6, 1.6], "snake", Math.atan2(d[1], d[0]) * 180 / Math.PI));
  }
  const mouth = ellipsoid([48, 34.5, 13], [1.8, 1.4, 2], "maw");
  const eyes = [ellipsoid([45.6, 29.4, 12.6], [1.6, 1.0, 1], "eye"), ellipsoid([50.4, 29.4, 12.6], [1.6, 1.0, 1], "eye")];
  // 石になりかけた坑夫の腕 (床から突き出す)
  const victim = U(1, tube([[18, 92, 6, 2.8], [16, 82, 8, 2.4], [14, 74, 10, 2.0]], "petri"), ...fingers([14, 74, 10], -100, "petri", { n: 4, len: 4, spread: 22, r: 0.8, curl: 0.5, z: 1 }));
  const scene = U(0, rubble(48, 92, 44, 14, { n: 6, seed: 93, big: 3 }), Sub(U(1.2, body, ...handL, ...handR), mouth, 0.5), robe, ...snakes, ...eyes, victim);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 蛇の目
  // 凍てつく視線: 眼から放たれる光の筋
  const Gl = ["#2a4a42", "#4a7c6c", "#8ac0b0"];
  for (const [ex, dir] of [[45, -1], [51, 1]]) for (let k = 2; k < 13; k++) { const x = ex + dir * k * 0.9, y = 29.4 + k * 0.25; if (!C.get(Math.round(x), Math.round(y)) || k > 6) if (k % 2 || k < 5) C.set(x, y, Gl[k < 5 ? 2 : k < 9 ? 1 : 0]); }
  pebbles(C, 37, 48, 91, 40);
  return C.toArt();
}
