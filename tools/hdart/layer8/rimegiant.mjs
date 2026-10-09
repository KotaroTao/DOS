import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, FROST, iceFloor, iceCracks, hoarfrost, icicles, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_rimegiant", key: "hd_rimegiant", w: 96, h: 96,
  note: "氷河の巨人: 灰青の肌が霜でひび割れた、背の丸い巨人。氷棚からもぎ取った巨大な氷河の塊を両腕で頭上に担ぎ上げ、全身に力を溜めて今にも叩きつけようとしている (溜め)。塊の内側には冷気が青く集まり、ひげと眉は凍って氷柱になって垂れる。腰には獣の皮" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#030407", "#0a0e14", "#141c26", "#202c38", "#2e3e4c", "#405262", "#566a7a", "#72869a"], 8), dither: 0.55, spec: 0.3, pow: 16,
      shade: p => 0.08 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    hide: { ramp: ramp(["#040302", "#0e0a07", "#1a140e", "#282016", "#382c1e"], 5), dither: 0.6, shade: p => 0.1 * Math.sin(p.x * 1.6) },
    beard: { ramp: ramp(["#0a121c", "#1e3046", "#34506c", "#527490", "#7c9cb4"], 5), spec: 1, pow: 30, dither: 0.45 },
    core: { ramp: SOUL, noRim: true, emit: p => 0.3 + 0.5 * Math.max(0, p.nz) },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    ice: ICE, shelf: SHELF, snow: SNOW,
  };
  const J = { head: [48, 40, 10], neck: [48, 46, 3], chest: [48, 54, 0], waist: [48, 66, -1], hip: [48, 72, -1],
    shL: [32, 48, 0], elL: [24, 34, 2], haL: [30, 22, 4], shR: [64, 48, 0], elR: [72, 34, 2], haR: [66, 22, 4],
    hpL: [40, 74, 0], knL: [34, 82, 4], ftL: [32, 90, 6], hpR: [56, 74, 0], knR: [62, 82, 4], ftR: [64, 90, 6] };
  const body = humanoid(J, { skin: "skin" }, { w: { headX: 7.4, headY: 7, headZ: 6.4, chestX: 18, chestY: 11, chestZ: 11, waistX: 14, waistY: 9, hipX: 14, arm: 6.4, arm2: 5.6, wrist: 4.4, thigh: 7, knee: 6, ankle: 5, neck: 5 } });
  const brute = Disp(body, (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5, z * 0.5));
  const loin = Disp(ellipsoid([48, 72, 2], [15.5, 6.5, 12], "hide"), (x, y, z) => 0.5 * Math.sin(x * 1.2) * Math.max(0, y - 70) * 0.3);
  // 担ぎ上げた氷河の塊
  const glacier = Disp(U(2, box([48, 12, 2], [30, 10, 12], "ice", 3, -4), box([30, 8, 0], [10, 8, 10], "ice", 2, 20), box([68, 10, 0], [10, 7, 10], "ice", 2, -16)), iceCracks(1.2, 0.22));
  const core = ellipsoid([48, 14, 13], [9, 4, 1.2], "core");
  const brow = ellipsoid([48, 36, 15], [6.4, 1.6, 2.6], "skin");
  const eyes = [sphere([45.2, 38, 15.4], 1, "eye"), sphere([50.8, 38, 15.4], 1, "eye")];
  const beard = []; for (let i = 0; i < 6; i++) { const x = 43 + i * 2; beard.push(cone([x, 43, 15], [x + (i - 2.5) * 0.6, 52 + (i % 2) * 4, 15], 1.8, 0.3, "beard")); }
  const scene = U(0, iceFloor(48, 94, 44, 14, { n: 3, seed: 9901, snow: 0.12 }), brute, loin, glacier, core, brow, ...eyes, ...beard);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 18, 22], r: 26, k: 0.35 }] });
  const C = new Canvas(r);
  // 溜めの冷気: 塊の周りに渦巻く青白い筋
  const R = rand(9903);
  for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, d = 32 + R() * 8, x = 48 + Math.cos(a) * d, y = 12 + Math.sin(a) * d * 0.4; if (!C.get(Math.round(x), Math.round(y))) C.set(x, y, SOUL[1 + Math.floor(R() * 3)]); }
  // 肌の霜のひび
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "skin" && Math.pow(1 - Math.abs(fbm(x * 0.18, y * 0.18, 3)), 12) > 0.6) C.set(x, y, "#72869a"); }
  hoarfrost(C, ["skin", "hide"], { th: 0.35, seed: 33 });
  icicles(C, 9905, ["ice", "skin"], 0.14, 5);
  glints(C, 9907, ["ice"], 7);
  snowfall(C, 9909, 26, [2, 26, 92, 66]);
  return C.toArt();
}
