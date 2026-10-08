import { tube, sphere, ellipsoid, cone, cyl, box, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { RIM, PHOS, bubbles, motes, dissolve } from "../temple.mjs";
export const meta = { id: "bs_choirwraith", key: "hd_choirwraith", w: 96, h: 96,
  note: "水没聖歌隊: 聖歌隊の白い頭巾と襟飾りをつけた三体の霊が寄り添って宙に浮く (群れ)。暗い口を縦に大きく開いて眠りの聖歌を歌い、手には水に濡れた聖歌集。歌声は淡い波の輪となって広がり、裾は水の靄にほどける" };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function build() {
  const mats = {
    robe: { ramp: ramp(["#05070a", "#0d1217", "#161e26", "#212c36", "#2e3c48", "#3e4e5c", "#526474", "#6a7e8c"], 8), dither: 0.6, amb: 0.24,
      shade: p => 0.12 * Math.sin(p.x * 0.9 + p.y * 0.05) + 0.06 * fbm(p.x * 0.4, p.y * 0.4) },
    ruff: { ramp: ramp(["#0a0d10", "#1e252c", "#38434c", "#56626a", "#78868a", "#9caaa8"], 6), dither: 0.5, amb: 0.3, shade: p => 0.16 * Math.sin(Math.atan2(p.z, p.x) * 14) },
    face: { ramp: ramp(["#060809", "#121718", "#202828", "#30393a", "#44504e", "#5c6a66", "#788a84"], 7), dither: 0.45, amb: 0.24 },
    book: { ramp: ramp(["#050302", "#140d07", "#24180c", "#362410"], 4), dither: 0.4 },
    page: { ramp: ramp(["#1a1e1c", "#38403c", "#5a645e", "#7e8a82"], 4), dither: 0.4, amb: 0.3 },
    hole: { ramp: ["#000000", "#000000", "#010303"], amb: 0, dif: 0.05, noRim: true },
    eye: { ramp: [PHOS[1], PHOS[2], PHOS[3]], emit: p => 0.5 + 0.5 * Math.max(0, p.nz) },
  };
  // 一体の聖歌隊員: 頭巾をかぶった顔、縦に開いた口、ひだの襟、聖歌集を持つ手
  const singer = (x, y, z, s, tilt) => {
    const X = d => x + d * s, Y = d => y + d * s;
    const hood = Disp(U(1.4, ellipsoid([X(0), Y(0), z], [7 * s, 8 * s, 6.6 * s], "robe", tilt), cone([X(0), Y(-2), z - 2], [X(-tilt * 0.06), Y(-11), z - 5], 5 * s, 1 * s, "robe")), (a, b, c) => 0.2 * fbm(a * 0.5, b * 0.5));
    const face = ellipsoid([X(0), Y(1.5), z + 3.4 * s], [4.6 * s, 6 * s, 3.4 * s], "face", tilt);
    const cut = U(0, ellipsoid([X(-1.8), Y(-0.6), z + 6.4 * s], [1.3 * s, 0.9 * s, 1 * s], "hole"), ellipsoid([X(1.8), Y(-0.6), z + 6.4 * s], [1.3 * s, 0.9 * s, 1 * s], "hole"),
      ellipsoid([X(0), Y(4.4), z + 6 * s], [1.6 * s, 2.8 * s, 1.6 * s], "hole"));
    const eyes = [sphere([X(-1.8), Y(-0.5), z + 5.4 * s], 0.6 * s, "eye"), sphere([X(1.8), Y(-0.5), z + 5.4 * s], 0.6 * s, "eye")];
    const ruff = Disp(ellipsoid([X(0), Y(9), z + 1], [7.4 * s, 2.4 * s, 6.4 * s], "ruff"), (a, b, c) => 0.4 * Math.abs(Math.sin(Math.atan2(c - z, a - x) * 12)));
    const body = Disp(cone([X(0), Y(10), z], [X(0), Y(46), z - 2], 7.5 * s, 12 * s, "robe"), (a, b, c) => 0.9 * Math.sin(Math.atan2(c - z, a - x) * 6 + b * 0.07) * Math.max(0, (b - Y(14)) / 26));
    const book = U(0.4, box([X(0), Y(18), z + 8 * s], [5 * s, 3.4 * s, 0.9 * s], "book", 0.4, 8), box([X(0), Y(17.6), z + 8.9 * s], [4.4 * s, 3 * s, 0.4 * s], "page", 0.2, 8));
    const hands = [ellipsoid([X(-4.6), Y(19), z + 8 * s], [1.8 * s, 2 * s, 1.6 * s], "face"), ellipsoid([X(4.6), Y(17.8), z + 8 * s], [1.8 * s, 2 * s, 1.6 * s], "face")];
    return U(0, Sub(U(0.8, hood, face), cut, 0.3), ...eyes, ruff, body, book, ...hands);
  };
  const scene = U(0, singer(25, 34, -6, 0.88, 12), singer(71, 32, -6, 0.88, -12), singer(48, 24, 6, 1, 0));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 歌声の波の輪 (口から外へ広がる)
  const W = ["#16282c", "#24424a", "#3a6670"];
  for (const [x, y, n] of [[48, 30, 3], [25, 39, 2], [71, 37, 2]]) {
    for (let k = 1; k <= n; k++) {
      const rr = 6 + k * 5;
      for (let a = -0.9; a <= 0.9; a += 0.03) {
        for (const side of [-1, 1]) {
          const X = Math.round(x + side * Math.cos(a) * rr), Y = Math.round(y + Math.sin(a) * rr * 0.8);
          if (!C.get(X, Y) && Math.abs(a) < 0.8) C.set(X, Y, W[Math.max(0, 2 - k + (Math.abs(a) > 0.5 ? -1 : 0)) < 0 ? 0 : Math.max(0, 2 - k + (Math.abs(a) > 0.5 ? -1 : 0))]);
        }
      }
    }
  }
  // 裾は水の靄にほどける
  dissolve(C, 46, 76, { seed: 7, darken: mats.robe.ramp });
  bubbles(C, 703, 10);
  motes(C, 705, 8, [4, 4, 88, 88], true);
  return C.toArt();
}
