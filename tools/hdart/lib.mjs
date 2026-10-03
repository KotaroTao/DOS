import { ellipsoid, Disp, ramp } from "./sdf.mjs";
// 汚水の水溜まり (足元に敷く)
export const WATER = { ramp: ramp(["#030506", "#081012", "#101c20", "#1a2c30"], 4), spec: 1.2, pow: 80, specCol: "#4a6a6c", dither: 0.8, amb: 0.5, dif: 0.4, noRim: true };
export function puddle(cx, cy, rx, rz = 14, mat = "water") {
  return Disp(ellipsoid([cx, cy, -2], [rx, 3.5, rz], mat), (x, y, z) => 0.25 * Math.sin(Math.hypot(x - cx - 4, (z + 2) * 2.4) * 1.1));
}
export function ripples(C, cx, cy, rx, col = "#2c4446") {
  for (let x = Math.floor(cx - rx); x < cx + rx; x++) { const y = Math.round(cy + 3.0 * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))); if (C.get(x, y) && ((x * 7) % 9) < 4) C.set(x, y, col); }
}
export const RIM = "#4e6470";
