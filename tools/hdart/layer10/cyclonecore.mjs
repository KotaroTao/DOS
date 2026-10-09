import { sphere, ellipsoid, box, cone, U, Disp, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { STAIR, PUDDLE, TOWER, IRON, RIM, BOLT, SOULS, towerFloor, chain, bolt2d, sparks, rain } from "../storm.mjs";
export const meta = { id: "bs_cyclonecore", key: "hd_cyclonecore", w: 96, h: 96,
  note: "嵐核: 塔の吹き抜けに立つ竜巻の芯で光る、雷のかたまり。まわりの渦に石くれや錆びた鎖、割れた瓦が巻き上げられて回る。核が脈打つたびに低いうなりが響き、塔の魔物たちの力をあおり立てる (鼓舞・多用)。巻き上げた雨と風で崩れた所をすぐに塞ぐ (再生)" };
export function build() {
  const mats = {
    core: { ramp: [SOULS[1], BOLT[1], BOLT[2], BOLT[3], SOULS[4], BOLT[4]], noRim: true, emit: p => 0.2 + 0.8 * Math.max(0, p.nz) ** 1.4 },
    funnel: { ramp: ramp(["#040409", "#09091a", "#10102a", "#1a1a3a", "#262650", "#34346a"], 6), dither: 0.85, amb: 0.36, noRim: true,
      shade: p => 0.2 * Math.sin(p.y * 0.9 + Math.atan2(p.z, p.x - 48) * 2) },
    stair: STAIR, puddle: PUDDLE, tower: TOWER, iron: IRON,
  };
  // 竜巻のじょうご (上が広い)
  const funnel = Disp(cone([48, 94, -10], [48, 2, -10], 6, 28, "funnel"), (x, y, z) => 1.6 * fbm(x * 0.15, y * 0.25, z * 0.15) + 1.2 * Math.sin(y * 0.6 + Math.atan2(z + 10, x - 48) * 3));
  const core = sphere([48, 46, 10], 8, "core");
  // 巻き上げられた石くれ・瓦・鎖
  const R = rand(11401), debris = [];
  for (let i = 0; i < 12; i++) {
    const a = R() * Math.PI * 2, y = 10 + R() * 76, rr = 10 + (94 - y) * 0.26, x = 48 + Math.cos(a) * rr, z = 4 + Math.sin(a) * rr * 0.6, s = 1.4 + R() * 2;
    debris.push(Disp(box([x, y, z], [s, s * 0.7, s * 0.8], "tower", s * 0.3, R() * 90), (X, Y, Z) => 0.3 * fbm(X * 0.7, Y * 0.7, Z * 0.7)));
  }
  const links = [...chain([16, 30, 12], [28, 20, 12], 1.3), ...chain([72, 64, 12], [84, 56, 12], 1.3)];
  const scene = U(0, towerFloor(48, 96, 42, 12, { n: 3, seed: 11403, wet: 0.2 }), funnel, core, ...debris, ...links);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [48, 46, 26], r: 34, k: 0.7 }] });
  const C = new Canvas(r);
  // 脈打つうなりの輪
  for (const [rr, c] of [[12, BOLT[3]], [17, BOLT[2]], [23, BOLT[1]]]) for (let a = 0; a < Math.PI * 2; a += 0.03) {
    const x = 48 + Math.cos(a) * rr, y = 46 + Math.sin(a) * rr * 0.9;
    const p = C.pix[Math.round(y) * 96 + Math.round(x)];
    if (p && p.m !== "funnel") continue;
    if (Math.sin(a * 9 + rr) > -0.2) C.set(x, y, c);
  }
  // 核から渦へ走る稲妻
  for (const [x1, y1, s] of [[16, 18, 1], [84, 24, 2], [20, 74, 3], [80, 80, 4]]) bolt2d(C, 48, 46, x1, y1, { seed: s, jag: 2.4, branch: 1, own: ["funnel"] });
  rain(C, 11405, 50, [0, 0, 96, 96], { slope: 1.2 });
  sparks(C, 11407, 20);
  return C.toArt();
}
