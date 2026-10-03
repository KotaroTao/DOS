import { tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, MIST, mist, tri } from "../forest.mjs";
export const meta = { id: "bs_thunderbird", key: "hd_thunderbird", w: 96, h: 96,
  note: "雷鳥: 黒雲を背負って翼を大きく広げた猛禽。羽の縁が青白く帯電し、翼の先から地上へ何本もの稲妻が落ちて隊を打つ。鉤の嘴と白く光る眼" };
export function build() {
  const mats = {
    feather: { ramp: ramp(["#030407", "#090c14", "#111724", "#1b2334", "#263146", "#334059", "#45536e", "#5c6c88"], 8), dither: 0.55, spec: 0.5, pow: 20,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5) },
    down: { ramp: ramp(["#06070a", "#10131a", "#1c212b", "#2a303c", "#3c4250", "#525a68", "#6c7482"], 7), dither: 0.7,
      shade: p => 0.12 * Math.sin(p.y * 1.6 + Math.abs(p.x - 48) * 0.5) },
    cloud: { ramp: ramp(["#030305", "#08090d", "#0e1016", "#15181f", "#1d212a", "#272c37"], 6), dither: 0.85, amb: 0.2, dif: 0.6, noRim: true,
      shade: p => 0.18 * fbm(p.x * 0.2, p.y * 0.2, p.z * 0.2) },
    beak: { ramp: ramp(["#080602", "#1e1608", "#3a2c10", "#5e4a1c", "#8a7034", "#b49a54"], 6), spec: 1, pow: 30, specCol: "#e0cc8a", dither: 0.4 },
    eye: { ramp: ["#6ab0e8", "#d8f4ff", "#ffffff"], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) },
    bolt: { ramp: ["#2a4a7a", "#5a90d0", "#a8d8ff", "#eaf8ff"], emit: p => 0.4 + 0.6 * Math.max(0, p.nz) },
    maw: { ramp: ["#000000", "#05070a"], amb: 0.1, dif: 0.2, noRim: true },
  };
  const cx = 48;
  // 羽根 1 枚: 根元→先端の細長い葉形
  const feather = (b, t, w, z, mat = "feather") => {
    const dx = t[0] - b[0], dy = t[1] - b[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
    const m1 = [b[0] + dx * 0.55, b[1] + dy * 0.55];
    const poly = [[b[0] + nx * w * 0.5, b[1] + ny * w * 0.5], [m1[0] + nx * w, m1[1] + ny * w], [t[0] + nx * w * 0.35, t[1] + ny * w * 0.35], [t[0] - dx / l * 1.2, t[1] - dy / l * 1.2],
      [t[0] - nx * w * 0.35, t[1] - ny * w * 0.35], [m1[0] - nx * w, m1[1] - ny * w], [b[0] - nx * w * 0.5, b[1] - ny * w * 0.5]];
    return slab(poly, z, 0.8, mat, 0.5, 0.6);
  };
  // 翼: 肩→手首を太い腕で、手首から風切羽を扇に、腕の下に次列風切を垂らす
  const wing = s => {
    const X = d => cx + s * d;
    const sh = [X(8), 36, -2], el = [X(20), 30, -3], wr = [X(32), 20, -4];
    const parts = [tube([[...sh, 5], [...el, 4], [...wr, 3]], "feather", { seg: 3 })];
    // 雨覆 (腕の上の小羽を重ねた帯)
    parts.push(Disp(slab([[X(8), 30], [X(22), 24], [X(33), 15], [X(36), 20], [X(26), 34], [X(12), 42]], -1, 2.2, "feather", 1), (x, y, z) => 0.5 * Math.abs(Math.sin(x * 0.9 + y * 0.6))));
    // 初列風切: 手首から外へ扇状
    for (let i = 0; i < 7; i++) {
      const a = (-62 + i * 15) * Math.PI / 180, L = 23 - Math.abs(i - 2) * 1.7;
      const b = [X(31 + i * 0.5), 21 + i * 1.6];
      parts.push(feather(b, [b[0] + s * Math.cos(a) * L, b[1] + Math.sin(a) * L], 2.9, -5 - i * 1.3));
    }
    // 次列風切: 腕の下へ垂れる
    for (let i = 0; i < 6; i++) {
      const b = [X(12 + i * 3.6), 38 - i * 2.4];
      parts.push(feather(b, [b[0] + s * (1 + i * 1.2), b[1] + 16 - i * 0.6], 2.8, -3 - (5 - i) * 0.9));
    }
    return parts;
  };
  const body = U(2, ellipsoid([cx, 44, 0], [8.5, 12.5, 7.5], "down"), ellipsoid([cx, 34, 2], [7.5, 6, 6.5], "down"));
  const head = U(1.4, ellipsoid([cx, 25, 4], [5.6, 5.4, 5.4], "feather"), ellipsoid([cx, 21.5, 2], [3, 3.2, 3], "feather"));
  const crest = [cone([cx - 2, 21, 1], [cx - 7, 12, -2], 1.6, 0.3, "feather"), cone([cx + 2, 21, 1], [cx + 7, 12, -2], 1.6, 0.3, "feather"), cone([cx, 20, 0], [cx, 11, -3], 1.6, 0.3, "feather")];
  const brows = [ellipsoid([cx - 3, 23.2, 8.4], [2.6, 1, 1.4], "feather", 18), ellipsoid([cx + 3, 23.2, 8.4], [2.6, 1, 1.4], "feather", -18)];
  const beak = tube([[cx, 26.5, 8.5, 2.2], [cx, 29.5, 11, 1.6], [cx, 32.8, 10.6, 0.9], [cx, 34, 9, 0.3]], "beak", { seg: 3 });
  const eyes = [sphere([cx - 3.2, 25, 8.4], 1.1, "eye"), sphere([cx + 3.2, 25, 8.4], 1.1, "eye")];
  // 尾羽 (扇) と、開いた鉤爪
  const tail = []; for (let i = 0; i < 5; i++) { const a = (90 + (i - 2) * 13) * Math.PI / 180; tail.push(feather([cx, 54], [cx + Math.cos(a) * 20, 54 + Math.sin(a) * 18], 3, -3 - Math.abs(i - 2) * 0.5)); }
  const leg = s => {
    const k = [cx + s * 4, 55, 4], a = [cx + s * 6, 62, 6];
    const t = [tube([[...k, 2.6], [...a, 1]], "down"), tube([[a[0], a[1] - 1, 6, 1], [...a, 0.9]], "beak")];
    for (const d of [-50, -10, 30]) { const r = (90 + d * s) * Math.PI / 180, r2 = r - 0.9 * s;
      t.push(tube([[...a, 0.8], [a[0] + Math.cos(r) * 3, a[1] + Math.sin(r) * 3, 7, 0.6], [a[0] + Math.cos(r) * 3 + Math.cos(r2) * 2.4, a[1] + Math.sin(r) * 3 + Math.sin(r2) * 2.4, 7.5, 0.25]], "beak", { seg: 2 })); }
    return t;
  };
  // 背負う黒雲
  const R = rand(1201);
  const puffs = [];
  for (let i = 0; i < 18; i++) { const x = 4 + i * 5.2 + (R() - 0.5) * 4, y = 9 + Math.sin(i * 1.7) * 4 + R() * 6 + (Math.abs(x - cx) < 20 ? 4 : 0); puffs.push(sphere([x, y, -22 - R() * 4], 4.5 + R() * 5, "cloud")); }
  const clouds = Disp(U(3, ...puffs), (x, y, z) => 1.2 * fbm(x * 0.15, y * 0.15, z * 0.15));
  const bird = U(0, body, U(1.2, head, ...crest, ...brows), beak, ...eyes, ...wing(-1), ...wing(1), ...tail, ...leg(-1), ...leg(1));
  const scene = U(0, clouds, bird);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, inner: 0.9, lights: [{ p: [cx, 28, 30], r: 40, k: 0.25 }] });
  const C = new Canvas(r);
  const B = ["#2a4a7a", "#5a90d0", "#a8d8ff", "#eaf8ff"];
  // 帯電した羽の縁: 翼の外縁 (空き画素に接する羽) を青白く光らせる
  const isF = (x, y) => { const p = C.pix[y * C.W + x]; return p && p.m === "feather"; };
  const edge = [];
  for (let y = 1; y < 95; y++) for (let x = 1; x < 95; x++) {
    if (!isF(x, y)) continue;
    let open = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!C.pix[(y + dy) * C.W + x + dx]) open++;
    if (open && Math.abs(x - cx) > 10) edge.push([x, y, open]);
  }
  for (const [x, y, o] of edge) C.set(x, y, (x * 7 + y * 3) % 5 === 0 ? B[3] : o > 1 ? B[2] : B[1]);
  // 稲妻: 翼から地上へ何本も落ちる (2D のジグザグ、太い芯と淡い外縁)
  const zig = (x, y0, x1, y1, seed, w = 1) => {
    // 翼の下縁から落とす
    let y = y0; while (y < 90 && C.get(Math.round(x), y + 1)) y++;
    const Rz = rand(seed); const steps = Math.ceil((y1 - y) / 5); let px = x, py = y;
    const pts = [[px, py]];
    for (let i = 1; i <= steps; i++) { const t = i / steps; px = x + (x1 - x) * t + (i < steps ? (Rz() - 0.5) * 9 : 0); py = y + (y1 - y) * t; pts.push([px, py]); }
    for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; C.line(a[0] - 1, a[1], b[0] - 1, b[1], B[0]); if (w > 1) C.line(a[0] + 1, a[1], b[0] + 1, b[1], B[1]); C.line(a[0], a[1], b[0], b[1], B[3]); }
    // 分かれ枝
    const k = 1 + Math.floor(Rz() * (pts.length - 2)); const [bx, by] = pts[k];
    const s = Rz() < 0.5 ? -1 : 1; C.line(bx, by, bx + s * 4, by + 3, B[1]); C.line(bx + s * 4, by + 3, bx + s * 5, by + 7, B[0]);
    // 着地の閃光
    for (const [dx, dy, c] of [[0, 0, 3], [-1, 0, 2], [1, 0, 2], [0, -1, 2], [-2, 0, 1], [2, 0, 1], [-3, 1, 0], [3, 1, 0]]) C.set(x1 + dx, y1 + dy, B[c]);
  };
  zig(8, 30, 3, 92, 1211, 2);
  zig(22, 40, 18, 93, 1212);
  zig(34, 40, 32, 90, 1218);
  zig(62, 40, 64, 90, 1219);
  zig(74, 40, 78, 93, 1213);
  zig(88, 30, 92, 92, 1214, 2);
  // 雲の中の稲光
  for (const [x, y, x1, y1] of [[14, 6, 19, 12], [19, 12, 17, 16], [74, 5, 80, 10], [80, 10, 78, 15]]) C.line(x, y, x1, y1, B[1]);
  // 地を這う霧
  mist(C, 1217, 3, [0, 82, 96, 12], 0.4);
  return C.toArt();
}
