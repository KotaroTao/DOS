import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, SOOT, RIM, cavernFloor, lampHeap, soot, murkMotes, murkHalo, sootCoat } from "../cavern.mjs";
export const meta = { id: "bs_mawofthedeep", key: "hd_mawofthedeep", w: 96, h: 96,
  note: "深淵の顎: 灯籠の山の中にぱっくり開いた、顎だけの巨大な口。縁は山と同じ黒い煤と泥で固まり、踏むまで地面と見分けがつかない (物理抵抗75)。上下の縁にぎざぎざの石の歯、口の中は赤黒い肉で、喉の奥・腹の底に呑まれた灯がいくつも小さく濁った琥珀に光る。かみつくたびに魂の光をかすめ取る (魂奪い・多用)" };
export function build() {
  const mats = {
    lip: { ramp: ["#030202", "#0a0807", "#151110", "#201b18", "#2c2522", "#39302b"], dither: 0.7, amb: 0.3, shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    flesh: { ramp: ["#080202", "#1a0606", "#2e0c0b", "#441412", "#5c1e1a", "#782a24"], dither: 0.5, amb: 0.3, spec: 0.8, pow: 30, specCol: "#a04a3a" },
    throat: { ramp: ["#000000", "#0a0202", "#160404"], amb: 0.05, dif: 0.2, noRim: true },
    core: { ramp: MURK.slice(1), noRim: true, emit: p => 0.4 + 0.4 * Math.max(0, p.nz) },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 灯籠の山
  const heapL = lampHeap(14, 92, -6, 18, 7, { seed: 13701, s: 1.8, lit: 0.2 });
  const heapR = lampHeap(84, 92, -6, 16, 6, { seed: 13703, s: 1.8, lit: 0.2 });
  // 口: 上顎 (後ろへ反る) と下顎 (床に沿う)
  const upper = Disp(Sub(ellipsoid([48, 44, -4], [34, 22, 18], "lip", 0), ellipsoid([48, 54, 4], [28, 16, 18], "flesh"), 1.5), (x, y, z) => 0.9 * fbm(x * 0.2, y * 0.2, z * 0.2));
  const lower = Disp(Sub(ellipsoid([48, 84, -2], [36, 10, 18], "lip"), ellipsoid([48, 76, 4], [30, 9, 18], "flesh"), 1.2), (x, y, z) => 0.8 * fbm(x * 0.2, y * 0.2, z * 0.2));
  const throat = ellipsoid([48, 66, -14], [22, 12, 6], "throat");
  const tongue = Disp(ellipsoid([46, 76, 4], [16, 3, 10], "flesh"), (x, y, z) => 0.4 * Math.sin(x * 0.4));
  const cores = [[40, 64, -8, 1.8], [52, 62, -9, 2.2], [46, 70, -8, 1.4], [60, 68, -8, 1.3], [34, 70, -7, 1.1], [56, 58, -10, 1]].map(([x, y, z, r]) => sphere([x, y, z], r, "core"));
  const scene = U(0, cavernFloor(48, 96, 47, 13, { seed: 13705, rocks: 1, lamps: 1 }), heapL, heapR, upper, lower, throat, tongue, ...cores);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 66, 6], r: 26, k: 0.45 }] });
  const C = new Canvas(r);
  // 上下の縁のぎざぎざの石の歯
  const toothCols = ["#16120e", "#4a443a", "#8a8070", "#b8ae9a"];
  for (let x = 20; x <= 76; x += 3) {
    let yt = -1, yb = -1;
    for (let y = 30; y < 70; y++) { const p = C.pix[y * 96 + x]; if (p && p.m === "flesh") { yt = y; break; } }
    for (let y = 92; y > 60; y--) { const p = C.pix[y * 96 + x]; if (p && p.m === "flesh") { yb = y; break; } }
    const L = 3 + ((x * 7) % 3);
    if (yt > 0) for (let k = 0; k < L; k++) { C.set(x, yt + k, toothCols[k === L - 1 ? 3 : k === 0 ? 0 : 2]); if (k < L - 1) C.set(x + 1, yt + k, toothCols[1]); }
    if (yb > 0) for (let k = 0; k < L - 1; k++) { C.set(x, yb - k, toothCols[k === L - 2 ? 3 : 1]); if (k < L - 2) C.set(x + 1, yb - k, toothCols[1]); }
  }
  sootCoat(C, ["lip"], { th: -0.4, seed: 13707 });
  murkHalo(C, 48, 64, 12, MURK.slice(0, 2), 0.5);
  murkMotes(C, 13709, 16, [10, 4, 76, 24]);
  soot(C, 13711, 44);
  return C.toArt();
}
