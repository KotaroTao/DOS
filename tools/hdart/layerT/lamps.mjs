import { U, render, Canvas } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, RIM, lantern, lampHeap, cavernFloor } from "../cavern.mjs";
export const meta = { id: "t", key: "t", w: 96, h: 96, note: "" };
export function build() {
  const mats = { bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS };
  const scene = U(0, cavernFloor(48, 95, 46, 13, { seed: 3 }), lantern([16, 50, 0], 3), lantern([44, 50, 0], 2, { lit: true }), lantern([72, 50, 0], 2, { broken: true, rot: 30 }), lampHeap(48, 94, -2, 28, 10, { seed: 5, s: 1.9, lit: 0.35 }));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  return new Canvas(r).toArt();
}
