import { sphere, ellipsoid, cone, box, U, Sub, Disp, render, ramp, Canvas, fbm, vnoise, rand } from "../sdf.mjs";
import { ICE, RIM, SOUL, FROST, iceCracks, hoarfrost, glints, snowfall } from "../ice.mjs";
export const meta = { id: "bs_iciclehorror", key: "hd_iciclehorror", w: 96, h: 96,
  note: "氷柱の魔: 回廊の天井の氷の塊から、無数の鋭い氷柱が垂れ下がってうごめく群体。塊の奥にはいくつもの青白い眼が開き、氷柱は触手のように曲がって下へ伸び、先端で何度も突き刺す (三連撃)。折れた氷柱の破片が下に散る" };
export function build() {
  const mats = {
    ice: ICE,
    deep: { ramp: ramp(["#020306", "#050a12", "#0a1420", "#101e30", "#182a40"], 5), dither: 0.6, spec: 0.8, pow: 30, specCol: "#6a90aa" },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.95 },
    hole: { ramp: ["#000000", "#020408"], amb: 0, dif: 0.05, noRim: true },
  };
  // 天井の氷塊 (上端から垂れる)
  const mass = Disp(U(3, ellipsoid([48, 6, -4], [44, 16, 16], "deep"), ellipsoid([30, 16, 0], [16, 12, 12], "deep"), ellipsoid([66, 18, 0], [16, 12, 12], "deep"), ellipsoid([48, 22, 4], [14, 10, 10], "deep")), iceCracks(1.2, 0.25));
  // 氷柱: 根元から曲がりながら下へ。長いもの (触手) と短いもの
  const R = rand(9201), spikes = [];
  for (let i = 0; i < 17; i++) {
    const x = 8 + i * 4.9 + (R() - 0.5) * 2, top = 14 + Math.abs(x - 48) * -0.15 + R() * 6, long = i % 3 !== 1;
    const len = long ? 34 + R() * 34 : 10 + R() * 10, bend = (R() - 0.5) * 16, z = (R() - 0.5) * 10, r0 = long ? 3.4 + R() * 1.6 : 2.4;
    const mid = [x + bend * 0.4, top + len * 0.5, z + 2], end = [x + bend, top + len, z + 4];
    spikes.push(U(0.6, cone([x, top, z], mid, r0, r0 * 0.55, "ice"), cone(mid, end, r0 * 0.55, 0.2, "ice")));
  }
  const eyeList = [[38, 18, 9], [56, 20, 9], [48, 26, 12], [26, 18, 6], [70, 20, 6]];
  const sockets = U(0, ...eyeList.map(([x, y, z]) => ellipsoid([x, y, z + 1], [2.6, 2, 2], "hole")));
  const eyes = eyeList.map(([x, y, z]) => sphere([x, y, z - 0.2], 1.4, "eye"));
  const scene = U(0, Sub(mass, sockets, 0.5), ...spikes, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  for (const [x, y] of eyeList) C.set(x - 0.5, y - 0.8, SOUL[4]);
  // 床に散った氷柱の破片
  const B = ["#152a44", "#3e6684", "#a8c4dc"];
  for (let i = 0; i < 16; i++) { const x = 10 + R() * 76, y = 88 + R() * 6, l = 1 + Math.floor(R() * 3); for (let k = 0; k < l; k++) if (!C.get(Math.round(x + k), Math.round(y - k * 0.4))) C.set(x + k, y - k * 0.4, B[k === l - 1 ? 2 : 1]); }
  hoarfrost(C, ["deep"], { th: 0.3, seed: 21 });
  glints(C, 9203, ["ice"], 9);
  snowfall(C, 9205, 34);
  return C.toArt();
}
