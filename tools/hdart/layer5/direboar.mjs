import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { MOULD, MOSS, ROOT, RIM, forestFloor, mist, spores, leaves, tri } from "../forest.mjs";
export const meta = { id: "bs_direboar", key: "hd_direboar", w: 96, h: 96,
  note: "牙の大猪: 岩のような剛毛に覆われた巨大な猪が頭を低く下げて突進の構え。反り返った太く長い牙、赤く血走った小さな目、鼻から噴く白い湯気。背の剛毛は逆立ち、後ろ脚が土を蹴り上げる" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030202", "#0a0807", "#13100d", "#1d1813", "#28211a", "#352b21", "#44382b", "#564736"], 8), dither: 0.65, spec: 0.25, pow: 16,
      shade: p => 0.12 * Math.sin(p.x * 1.3 - p.y * 2.2 + 2.5 * fbm(p.x * 0.3, p.y * 0.3, p.z * 0.3)) + 0.07 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    bristle: { ramp: ramp(["#030202", "#0c0a08", "#18140f", "#262019", "#362d23", "#4a3e30", "#62543f"], 7), dither: 0.5, spec: 0.5, pow: 25 },
    snout: { ramp: ramp(["#050303", "#140c0b", "#241614", "#36211d", "#4a2e28", "#5e3c33"], 6), spec: 0.9, pow: 30, specCol: "#8c6050", dither: 0.45 },
    tusk: { ramp: ramp(["#0c0a06", "#2e281c", "#564c36", "#847656", "#b4a67e", "#ddd2ac"], 6), spec: 1.2, pow: 35, specCol: "#f4ecd0", dither: 0.4 },
    hoof: { ramp: ramp(["#020202", "#080706", "#121010", "#1e1b18", "#2c2824"], 5), spec: 1, pow: 30, dither: 0.4 },
    eye: { ramp: ["#3a0000", "#7a0806", "#c41a10", "#ff5a30"], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#0a0303", "#160606"], amb: 0.15, dif: 0.2, noRim: true },
    mould: MOULD, moss: MOSS, root: ROOT,
  };
  const R = rand(5409);
  // 胴: 肩が高く盛り上がり、尻へ下がる。頭は低く下げて左手前へ。脚は短く太い
  const hump = ellipsoid([46, 46, 0], [21, 19, 16], "fur", -12);
  const barrel = ellipsoid([64, 55, -2], [24, 17, 15], "fur", 6);
  const rump = ellipsoid([81, 58, -3], [12, 14, 13], "fur");
  const neck = ellipsoid([34, 57, 3], [13, 14, 13], "fur", 30);
  const head = ellipsoid([24, 64, 7], [14, 12, 11], "fur", 24);
  const snoutC = cone([21, 67, 9], [8, 73, 11], 8, 5.6, "snout");
  const disc = ellipsoid([6.5, 74, 11.5], [2.2, 5, 5], "snout", 20);
  const jaw = ellipsoid([16, 74, 9], [9, 4, 7], "fur", 20);
  const ears = [cone([32, 51, 9], [40, 44, 13], 3.6, 0.6, "fur"), cone([35, 50, -3], [43, 44, -5], 3.2, 0.6, "fur")];
  const legs = [
    tube([[30, 70, 8, 7.2], [27, 80, 10, 5.4], [25, 87, 11, 4.4]], "fur", { seg: 3 }),
    tube([[41, 70, -8, 6.4], [40, 80, -8, 5], [39, 87, -8, 4]], "fur", { seg: 3 }),
    tube([[76, 66, 6, 7.4], [83, 76, 7, 5.2], [89, 82, 7, 3.8]], "fur", { seg: 3 }),
    tube([[84, 67, -9, 6.6], [86, 78, -9, 5], [85, 87, -9, 3.8]], "fur", { seg: 3 }),
  ];
  const hooves = [cone([25, 86, 11], [24, 90.5, 11.5], 4.4, 3.8, "hoof"), cone([39, 86, -8], [38.5, 90.5, -8], 4, 3.6, "hoof"),
    cone([89, 81.5, 7], [92, 85, 7], 3.8, 3.2, "hoof"), cone([85, 86, -9], [85, 90.5, -9], 3.8, 3.4, "hoof")];
  // 岩のような剛毛: 後ろへ流れる太い毛束の筋を刻む
  const hairDisp = (x, y, z) => 0.55 * Math.abs(Math.sin(x * 0.9 - y * 1.6 + 3 * fbm(x * 0.25, y * 0.25, z * 0.25))) + 0.45 * Math.max(0, vnoise(x * 0.5, y * 0.5, z * 0.5) - 0.1) - 0.2;
  const body = Disp(U(3.4, hump, barrel, rump, neck, head, jaw, ...ears, ...legs), (x, y, z) => hairDisp(x, y, z) * Math.max(0, 1 - Math.max(0, y - 72) / 10));
  // 背の剛毛: 首から背へ、後ろへ反って逆立つ太い毛の房 (たてがみ)
  const bristles = [];
  const top = x => {
    const e = (cx, cy, rx, ry) => Math.abs(x - cx) < rx ? cy - ry * Math.sqrt(1 - ((x - cx) / rx) ** 2) : 99;
    return Math.min(e(46, 46, 21, 19), e(64, 55, 24, 17), e(81, 58, 12, 14), e(34, 57, 13, 14));
  };
  for (let i = 0; i < 46; i++) {
    const t = i / 45, x = 30 + t * 56 + (R() - 0.5) * 2;
    const h = Math.max(3.5, (1 - Math.abs(t - 0.3) * 1.4) * 11 + 2 + R() * 3);
    const z = (R() - 0.5) * 14;
    const y0 = top(x) + 2.5 + Math.abs(z) * 0.2;
    bristles.push(cone([x, y0, z], [x + h * 0.6, y0 - h, z + (R() - 0.5) * 3], 2.0, 0.3, "bristle"));
  }
  // 反り返った太い牙 (手前と奥)
  const tusks = [
    tube([[14, 74, 14, 3.0], [7, 74, 17, 2.6], [1, 66, 18, 2.0], [2, 55, 17, 1.2], [7, 48, 15, 0.4]], "tusk", { seg: 4 }),
    tube([[15, 73, 4, 2.4], [10, 72, 2, 2.0], [7, 64, 1, 1.5], [9, 56, 1, 0.8], [13, 51, 2, 0.3]], "tusk", { seg: 4 }),
  ];
  const eyeSock = ellipsoid([27, 59.5, 16.5], [2.8, 1.9, 2], "maw", 25);
  const eye = sphere([27.3, 59.8, 15.6], 1.4, "eye");
  const mouth = tube([[9, 76.5, 14, 1], [16, 75.5, 16, 1], [22, 73, 15, 0.8]], "maw");
  const floor = forestFloor(50, 93, 46, 13, { n: 4, roots: 2, seed: 54 });
  const scene = U(0, floor, Sub(U(1.2, body, snoutC, disc), U(0, eyeSock, mouth), 0.5), eye, ...bristles, ...tusks, ...hooves);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 鼻の穴
  C.set(6, 72, "#000000"); C.set(6, 73, "#000000"); C.set(7, 76, "#000000"); C.set(7, 77, "#000000");
  // 眼の上の皺 (怒り)
  C.line(24, 57, 31, 56, mats.fur.ramp[0]); C.line(23, 58, 25, 58, mats.fur.ramp[0]);
  // 鼻から噴く白い湯気
  const S = ["#3a4644", "#5e6c6a", "#8a9896", "#bcc8c4"];
  const BY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const puffs = [[3, 79, 3.2], [5, 84, 4.2], [2, 88, 3.6], [10, 87, 3.4], [15, 90, 2.8], [20, 91.5, 2.2]];
  for (let y = 72; y < 96; y++) for (let x = 0; x < 26; x++) {
    const q = C.pix[y * 96 + x]; if (C.get(x, y) && q && !["mould", "moss", "root"].includes(q.m)) continue;
    let a = 0; for (const [cx, cy, rad] of puffs) a = Math.max(a, 1 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad);
    if (a <= 0) continue;
    a = a * 1.3 + 0.25 * fbm(x * 0.5, y * 0.5, 9);
    if (a < (BY[y & 3][x & 3] + 0.5) / 16 * 0.8) continue;
    C.set(x, y, S[Math.max(0, Math.min(3, Math.floor(a * 3.2)))]);
  }
  // 蹴り上げた土くれ (後ろ脚の後ろ)
  const D = ["#0d110b", "#1c2416", "#2e2a1c", "#3e3424"];
  for (let i = 0; i < 22; i++) {
    const t = R(), x = 88 + t * 7 - R() * 2, y = 86 - t * 22 + (R() - 0.5) * 6;
    if (C.get(Math.round(x), Math.round(y))) continue;
    const c = D[Math.floor(R() * 4)]; C.set(x, y, c); if (R() < 0.4) C.set(x + 1, y, c);
  }
  leaves(C, 55, 50, 92, 44, 18);
  return C.toArt();
}
