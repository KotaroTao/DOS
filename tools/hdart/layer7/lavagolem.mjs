import { sphere, ellipsoid, cone, box, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { BASALT, CRUST, LAVA, RIM, lavaFloor, underglow, embers, flame2d } from "../lava.mjs";
export const meta = { id: "bs_lavagolem", key: "hd_lavagolem", w: 96, h: 96,
  note: "溶岩のゴーレム: 背を丸め、巨大な両拳を床につく黒い岩殻の巨人。殻は厚い板が何重にも重なって刃を受け流すが、すでに割れた継ぎ目と胸の大きな裂け目から溶岩がのぞき、背の割れ目からは炎が噴き上がる (割れるほど荒れ狂う)。頭は肩に埋もれ、溶岩の眼がひとつ光る" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#020202", "#080707", "#110f0e", "#1b1816", "#26221f", "#332d29", "#423a35", "#544a43"], 8), spec: 0.4, pow: 18, dither: 0.55,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    eye: { ramp: ["#7a1a06", "#f07a1c", "#ffdc7a", "#fff4c4"], emit: () => 0.9 },
    basalt: BASALT, crust: CRUST, lava: LAVA,
  };
  // 背を丸めた巨体: 盛り上がった肩と背、短い脚、床につく太い腕と拳
  const back = ellipsoid([50, 40, -2], [24, 18, 18], "shell", -8);
  const chest = ellipsoid([46, 52, 4], [18, 14, 14], "shell");
  const hips = ellipsoid([56, 64, -2], [14, 10, 12], "shell");
  const head = ellipsoid([42, 40, 12], [7, 6.5, 6.5], "shell");
  const armL = tube([[30, 38, 6, 8], [20, 56, 10, 6.4], [18, 72, 12, 6.8]], "shell", { seg: 3 });
  const armR = tube([[70, 38, -4, 8], [78, 56, -2, 6.4], [78, 72, -1, 6.8]], "shell", { seg: 3 });
  const fistL = box([18, 80, 12], [8, 6, 7], "shell", 3, 6), fistR = box([79, 80, -1], [8, 6, 7], "shell", 3, -6);
  const legs = [tube([[46, 66, 6, 6.4], [44, 76, 7, 6], [44, 86, 7, 6.4]], "shell"), tube([[64, 66, -6, 6.4], [66, 76, -6, 6], [66, 86, -6, 6.4]], "shell")];
  // 重なった板: 強い稜線ノイズで段差を刻む
  const plates = (x, y, z) => 1.0 * Math.pow(1 - Math.abs(vnoise(x * 0.12, y * 0.12, z * 0.12)), 8) + 0.5 * fbm(x * 0.25, y * 0.25, z * 0.25);
  const body = Disp(U(3, back, chest, hips, head, armL, armR, fistL, fistR, ...legs), plates);
  // 継ぎ目と胸の裂け目に溶岩
  const seam = (x, y, z) => { const w = 2 * fbm(x * 0.06, y * 0.06, z * 0.06); return Math.pow(1 - Math.abs(vnoise(x * 0.12 + w, y * 0.12, z * 0.12 - w)), 7) > 0.8; };
  const rift = (x, y, z) => Math.abs(x - 46 - 3 * Math.sin(y * 0.4)) < 2.2 - Math.abs(y - 52) * 0.15 && y > 42 && y < 62 && z > 8;
  const golem = Paint(body, (x, y, z, m) => (m === "shell" && (seam(x, y, z) || rift(x, y, z))) ? "lava" : m);
  const eye = sphere([41, 40, 18], 1.8, "eye");
  const brow = ellipsoid([41, 37.5, 17], [5, 1.6, 2.6], "shell", -8);
  const scene = U(0, lavaFloor(48, 91, 46, 13, { n: 4, seed: 8001, cracks: 0.84 }), golem, eye, brow);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [46, 54, 22], r: 20, k: 0.3 }] });
  const C = new Canvas(r);
  C.set(40, 39, "#fff4c4");
  // 背の割れ目から噴き上がる炎
  for (const [x, w, h, s] of [[48, 4, 16, 1], [58, 3, 12, 2], [38, 3, 10, 3]]) flame2d(C, x, 24 + Math.abs(x - 50) * 0.2, w, h, { seed: s, own: ["shell"] });
  underglow(C, { skip: ["eye"] });
  embers(C, 8003, 30, [4, 2, 88, 40]);
  return C.toArt();
}
