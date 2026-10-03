import { tube, sphere, ellipsoid, cone, slab, cyl, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { GRAVEL, ROCK, RIM, rubble, pebbles, tri } from "../mine.mjs";
export const meta = { id: "bs_troll", key: "hd_troll", w: 96, h: 96,
  note: "トロール: 背の曲がった痩せぎすの巨人。床に届く長い腕に折れた坑木を握り、垂れた鼻と長い耳、脂じみた髪。灰緑の肌は塞がりかけの裂傷だらけで、火傷の痕だけが黒く残る" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030302", "#090a07", "#12140e", "#1b1f15", "#2a3020", "#363e2a", "#465036", "#5a6646", "#76825c"], 9), spec: 0.8, pow: 25, specCol: "#98a880", dither: 0.55,
      shade: p => 0.12 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    scar: { ramp: ramp(["#050203", "#1a0a0a", "#341414", "#4c2020", "#683028"], 5), spec: 0.8, pow: 30, dither: 0.4 },
    burn: { ramp: ramp(["#020202", "#060505", "#0c0a09", "#141110"], 4), dither: 0.6 },
    hair: { ramp: ramp(["#020202", "#070706", "#0e0d0b", "#161411", "#201d18"], 5), dither: 0.6, spec: 0.8, pow: 40 },
    wood: { ramp: ramp(["#030201", "#0d0805", "#1a110a", "#281a0f", "#372415", "#48301c"], 6), dither: 0.55, shade: p => 0.12 * Math.sin(p.x * 0.5 + p.y * 1.6) },
    eye: { ramp: ["#202800", "#506004", "#90a010", "#d8e840"], emit: p => 0.55 + 0.4 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0a0304", "#140507"], amb: 0.2, dif: 0.2, noRim: true },
    gravel: GRAVEL, rock: ROCK,
  };
  // 猫背: 頭は胸の前に垂れ、腕は長く膝下まで
  const J = { head: [40, 26, 12], neck: [43, 30, 6], chest: [48, 38, 0], waist: [50, 52, -2], hip: [50, 60, -3],
    shL: [36, 32, 2], elL: [24, 50, 8], haL: [20, 72, 12], shR: [62, 32, -2], elR: [72, 52, 4], haR: [74, 72, 8],
    hpL: [44, 62, -2], knL: [40, 76, 4], ftL: [38, 90, 4], hpR: [56, 62, -3], knR: [60, 76, 2], ftR: [62, 90, 0] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 7, headY: 6.6, headZ: 6.6, neck: 4, chestX: 13, chestY: 10, chestZ: 9, waistX: 10, waistY: 9, waistZ: 8, hipX: 10, hipY: 6,
    arm: 4.6, arm2: 3.8, wrist: 2.8, thigh: 4.6, knee: 3.6, ankle: 2.8 }, k: 2.2 });
  const hump = ellipsoid([48, 30, -6], [12, 8, 8], "skin");
  const nose = tube([[40, 25, 18, 2.8], [37, 31, 22, 3], [36, 37, 22, 2.4], [37, 39, 20, 1.6]], "skin");
  const brow = ellipsoid([40, 22, 16], [6.5, 2.2, 3], "skin");
  const ears = [cone([34, 25, 9], [25, 28, 5], 2.2, 0.3, "skin"), cone([47, 24, 8], [55, 26, 3], 2.2, 0.3, "skin")];
  const mouth = ellipsoid([41, 35, 17], [5, 1.4, 3], "maw");
  const eyes = [sphere([36, 25, 17.6], 1.1, "eye"), sphere([43.4, 24.6, 17.6], 1.1, "eye")];
  // 傷: 塞がりかけの裂傷 (赤) と火傷 (黒)
  const marks = (x, y, z, m) => {
    if (m !== "skin") return m;
    const sl = Math.abs((x - 44) * 0.8 - (y - 40)) < 0.7 && x > 40 && x < 54;
    const sl2 = Math.abs((x - 60) + (y - 46) * 0.6) < 0.7 && y > 40 && y < 52;
    if (sl || sl2) return "scar";
    if (Math.hypot(x - 70, y - 60) < 3.6 + fbm(x * 0.6, y * 0.6) * 2) return "burn";
    return m;
  };
  const troll = Paint(Disp(U(2.2, body, hump, nose, brow, ...ears), (x, y, z) => 0.3 * Math.max(0, vnoise(x * 0.6, y * 0.6, z * 0.6) - 0.3) + 0.12 * fbm(x * 0.9, y * 0.9, z * 0.9)), marks);
  // 脂じみた髪
  const hair = [];
  for (let i = 0; i < 9; i++) { const x = 34 + i * 1.6; hair.push(tube([[x, 19, 12 - i * 0.6, 1.1], [x + (i - 4) * 0.8, 24 + (i % 2) * 2, 13 - Math.abs(i - 4), 0.8], [x + (i - 4) * 1.6, 32 + (i % 3) * 3, 11 - Math.abs(i - 4), 0.4]], "hair")); }
  // 折れた坑木の棍棒 (左手で引きずる)
  const club = Disp(cone([20, 72, 14], [8, 92, 12], 2, 4.4, "wood"), (x, y, z) => 0.3 * fbm(x * 0.6, y * 0.6, z * 0.6));
  const splinters = [cone([9, 88, 14], [4, 93, 16], 1, 0.2, "wood"), cone([7, 91, 10], [3, 95, 8], 0.8, 0.2, "wood")];
  const handL = fingers([20, 72, 12], 110, "skin", { n: 4, len: 4.5, spread: 18, r: 1, curl: 0.8, z: 2 });
  const handR = fingers([74, 72, 8], 80, "skin", { n: 4, len: 6, spread: 22, r: 1, curl: 0.3, z: 1 });
  const scene = U(0, rubble(48, 92, 44, 14, { n: 6, seed: 141, big: 3 }), Sub(troll, mouth, 0.5), ...eyes, ...hair, club, ...splinters, ...handL, ...handR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  for (const x of [39, 43, 45]) C.only(x, 36, "#a09870");
  pebbles(C, 61, 48, 91, 40);
  return C.toArt();
}
