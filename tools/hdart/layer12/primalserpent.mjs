import { sphere, ellipsoid, cone, tube, box, torus, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lampHeap, soot, murkMotes, murkHalo } from "../cavern.mjs";
export const meta = { id: "bs_primalserpent", key: "hd_primalserpent", w: 96, h: 96,
  note: "原初の大蛇: 灯籠の山にとぐろを巻いた、黒い鱗の大蛇。太い胴を三重に巻き、鎌首を高くもたげて正面を見下ろす。両の目は濁った灯籠と同じ鈍い琥珀色に光り、見つめられた者は眠りに落ちる (眠り・多用) — 目から琥珀の光の輪。鱗の縁が鈍く光り、灯籠から漏れる濁りを鱗から吸って傷をふさぐ (再生)" };
export function build() {
  const mats = {
    scale: { ramp: ["#020203", "#06060a", "#0d0c12", "#15141c", "#1f1d28", "#2a2836", "#373446"], spec: 1.1, pow: 34, specCol: "#7a7090", dither: 0.4,
      shade: p => { const u = p.x * 0.7 + (Math.floor(p.y * 0.7) % 2) * 0.5; return ((p.y * 0.7) % 1 < 0.25 ? -0.18 : 0) + 0.12 * (0.5 - Math.abs((u % 1) - 0.5)); } },
    belly: { ramp: ["#060504", "#14110c", "#241f16", "#363022", "#4a4230"], dither: 0.45,
      shade: p => (p.y % 3 < 0.7 ? -0.2 : 0) },
    maw: { ramp: ["#000000", "#140606", "#2a0c0a"], dither: 0.3 },
    eye: { ramp: MURK.slice(3), emit: () => 0.95 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const heap = lampHeap(48, 94, -8, 40, 14, { seed: 13901, s: 1.9, lit: 0.35 });
  // 三重のとぐろ
  const coils = [];
  for (const [y, R, r, z] of [[82, 26, 7.4, 0], [72, 20, 6.6, 1], [63, 14, 6, 2]]) coils.push(torus([48, y, z], R, r, "scale", 0, 12));
  // 鎌首 (とぐろの上から立ち上がる)
  const neck = tube([[58, 60, 6, 6], [56, 46, 8, 5.4], [50, 34, 10, 5], [48, 24, 12, 5]], "scale", { seg: 4 });
  const belly = tube([[56, 58, 11, 3.4], [54, 46, 13, 3.4], [49, 34, 15, 3]], "belly", { seg: 3 });
  const head = U(2, ellipsoid([48, 19, 12], [8, 6, 7.4], "scale"), ellipsoid([48, 24, 17], [5.4, 3.4, 5], "scale"));
  const brows = [ellipsoid([44, 15.6, 16], [3, 1.4, 2], "scale", -20), ellipsoid([52, 15.6, 16], [3, 1.4, 2], "scale", 20)];
  const maw = ellipsoid([48, 27, 20], [3.4, 1, 2], "maw");
  const eyes = [sphere([44.6, 17.6, 17.4], 1.3, "eye"), sphere([51.4, 17.6, 17.4], 1.3, "eye")];
  const tail = tube([[22, 84, 10, 4], [12, 88, 12, 2.6], [6, 82, 12, 1.2]], "scale");
  const scene = U(0, cavernFloor(48, 96, 47, 13, { seed: 13903, rocks: 1, lamps: 1 }), heap, ...coils, Sub(U(1.5, neck, head, ...brows), maw, 0.3), belly, ...eyes, tail);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 80, 16], r: 30, k: 0.2 }] });
  const C = new Canvas(r);
  // 目から広がる琥珀の眠りの光の輪
  for (const rr of [8, 12, 16]) for (let a = 0; a < Math.PI * 2; a += 0.5 / rr) { const x = 48 + Math.cos(a) * rr * 1.3, y = 18 + Math.sin(a) * rr * 0.75; if (x < 0 || y < 0 || C.get(Math.round(x), Math.round(y)) || Math.sin(a * 10 + rr) < -0.3) continue; C.set(x, y, rr === 8 ? MURK[4] : rr === 12 ? MURK[3] : MURK[2]); }
  // 舌
  C.set(48, 28, "#8a2a24"); C.set(48, 29, "#8a2a24"); C.set(47, 30, "#5a1a16"); C.set(49, 30, "#5a1a16");
  murkHalo(C, 48, 84, 30, MURK.slice(0, 2), 0.4);
  murkMotes(C, 13905, 18, [6, 30, 84, 40]);
  soot(C, 13907, 30);
  return C.toArt();
}
