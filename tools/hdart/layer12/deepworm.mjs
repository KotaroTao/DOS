import { sphere, ellipsoid, cone, tube, box, torus, U, Sub, Disp, render, Canvas, fbm, rand } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, SOOT, RIM, cavernFloor, soot, murkMotes, shards } from "../cavern.mjs";
export const meta = { id: "bs_deepworm", key: "hd_deepworm", w: 96, h: 96,
  note: "地底の大蟲: 灯籠の山の下を掘り進む、果てしなく長い環形の大蟲。床の穴から体節の長い体をS字に起こし、こちらへ向けた円い口のまわりに石の歯が三重の輪に並ぶ (3連撃)。歯のすき間には煤がこびりつき、噛まれた傷から毒が回る (毒)。くすんだ肉色の体節の奥に、呑んだ灯籠の影がうっすら透ける" };
export function build() {
  const mats = {
    flesh: { ramp: ["#060403", "#140d0a", "#241812", "#36241b", "#4a3326", "#604333", "#7a5643", "#946c56"], dither: 0.5, amb: 0.24,
      shade: p => 0.07 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    ring: { ramp: ["#050302", "#120b08", "#20150f", "#2e1f16"], dither: 0.4, amb: 0.2 },
    lip: { ramp: ["#0e0605", "#2a1210", "#4a2018", "#6a3424", "#8a4a34"], dither: 0.4 },
    maw: { ramp: ["#000000", "#0a0303", "#1a0806"], amb: 0.05, dif: 0.2, noRim: true },
    tooth: { ramp: ["#141210", "#3a3630", "#6a6458", "#a29a88", "#cac2ae"], spec: 0.8, pow: 20, dither: 0.35 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 背骨 (床の穴から起き上がって、頭をこちらへ)
  const spine = [[70, 96, -6], [72, 84, -4], [66, 72, -2], [54, 64, 0], [42, 58, 2], [36, 48, 6], [38, 38, 10], [44, 30, 14]];
  const segs = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n * (spine.length - 1), a = Math.floor(t), f = t - a, P = spine[a], Q = spine[Math.min(spine.length - 1, a + 1)];
    const p = P.map((v, k) => v + (Q[k] - v) * f), r = 7.6 + 2 * Math.sin(i * 0.3);
    segs.push(ellipsoid(p, [r, r, r], "flesh"));
    if (i % 2 === 0 && i < n - 1) segs.push(torus(p, r * 0.98, 0.7, "ring", Math.atan2(Q[1] - P[1], Q[0] - P[0]) * 180 / Math.PI + 90, 12));
  }
  // 円い口 (正面を向く大きな円盤) と三重の歯の輪
  const head = U(1.4, ellipsoid([45, 28, 16], [12, 12, 6], "flesh"), torus([45, 28, 20], 9.6, 2.4, "lip", 0, 90));
  const maw = ellipsoid([45, 28, 24], [8.6, 8.6, 6], "maw");
  const teeth = [];
  for (const [R0, N, z, L] of [[8.6, 14, 21, 2.8], [6.4, 11, 19, 2.4], [4.2, 8, 17, 2]]) for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2 + R0;
    teeth.push(cone([45 + Math.cos(a) * R0, 28 + Math.sin(a) * R0, z], [45 + Math.cos(a) * (R0 - L), 28 + Math.sin(a) * (R0 - L), z + 1.2], 1.1, 0.15, "tooth"));
  }
  const hole = Disp(ellipsoid([71, 95, -6], [14, 3, 8], "maw"), (x, y, z) => 0.3 * fbm(x * 0.5, z * 0.5));
  const scene = U(0, Sub(cavernFloor(48, 95, 46, 13, { seed: 12301, rocks: 3, lamps: 2 }), hole, 0.8), Sub(U(2, ...segs, head), maw, 0.3), ...teeth);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 歯のすき間の煤
  for (let k = 0; k < 40; k++) { const R = rand(12303 + k); const a = R() * Math.PI * 2, d = 3 + R() * 6; const X = Math.round(45 + Math.cos(a) * d), Y = Math.round(28 + Math.sin(a) * d); const p = C.pix[Y * 96 + X]; if (p && (p.m === "maw" || p.m === "tooth")) C.set(X, Y, SOOT[R() < 0.5 ? 1 : 2]); }
  // 体節の奥に透ける呑んだ灯籠の影
  for (const [x, y] of [[62, 70], [50, 62]]) for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) { const p = C.pix[(y + dy) * 96 + x + dx]; if (p && p.m === "flesh" && (Math.abs(dx) === 2 || Math.abs(dy) === 3 || dy === 0) && (dx + dy) % 2 === 0) C.set(x + dx, y + dy, "#24180f"); }
  murkMotes(C, 12305, 10, [10, 50, 76, 30]);
  shards(C, 12307, ["bed"], 12);
  soot(C, 12309, 44);
  return C.toArt();
}
