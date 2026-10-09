import { sphere, ellipsoid, cone, tube, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, sores, slime, scum, motes, miasma } from "../swamp.mjs";
export const meta = { id: "bs_plaguerat", key: "hd_plaguerat", w: 96, h: 96,
  note: "疫病鼠の大群: 腫れ物だらけの、毛の抜けた膨れた大鼠の群れ。手前の一匹が前脚を上げて黄色い歯をむき、後ろから何匹もが泥の上を押し寄せる (群棲)。黄緑の膿の斑点、垂れる毒のよだれ、細く長いはげた尾。背後の朽ち木の上にも赤い眼がいくつも光る" };
export function build() {
  const mats = {
    fur: { ramp: ramp(["#030202", "#0a0807", "#15110e", "#211b16", "#2e2620", "#3e342b", "#504438"], 7), dither: 0.6, amb: 0.22,
      shade: p => 0.1 * Math.sin(p.x * 1.8 + p.y * 1.1 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    skin: { ramp: ramp(["#0a0505", "#1e0f0e", "#341c19", "#4c2c26", "#683e34", "#86564a"], 6), dither: 0.5, amb: 0.3 },
    fur2: { ramp: ramp(["#020101", "#070605", "#0e0b09", "#16120f", "#201a15"], 5), dither: 0.6 },
    maw: { ramp: ["#050202", "#160808", "#2c1010"], dither: 0.3 },
    eye: { ramp: ["#5a0a06", "#c02a10", "#ff8a50"], emit: () => 0.9 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const rat = (ox, oy, oz, s, mat, rear = false) => {
    const P = (x, y, z) => [ox + x * s, oy + y * s, oz + z * s];
    const body = ellipsoid(P(8, 0, 0), [15 * s, 10 * s, 10 * s], mat, rear ? -18 : -4);
    const head = ellipsoid(P(-8, rear ? -8 : -2, 2), [8 * s, 6.6 * s, 6.6 * s], mat, rear ? -30 : -10);
    const snout = cone(P(-12, rear ? -10 : -1, 4), P(-20, rear ? -13 : 1, 6), 4.4 * s, 1.4 * s, mat);
    const ears = [sphere(P(-5, rear ? -15 : -8, -2), 3.4 * s, "skin"), sphere(P(-4, rear ? -14 : -7, 6), 3 * s, "skin")];
    const legs = rear
      ? [tube([[...P(-4, -2, 6), 2.4 * s], [...P(-12, -8, 9), 1.8 * s], [...P(-16, -12, 9), 1.2 * s]], "skin"), tube([[...P(-2, 0, -4), 2.2 * s], [...P(-10, -6, -4), 1.6 * s], [...P(-14, -10, -4), 1.1 * s]], "skin"),
        tube([[...P(16, 6, 6), 3.6 * s], [...P(14, 12, 8), 2 * s], [...P(10, 13, 9), 1.4 * s]], "skin")]
      : [tube([[...P(-2, 6, 6), 2.4 * s], [...P(-6, 11, 7), 1.6 * s], [...P(-9, 12, 8), 1.2 * s]], "skin"), tube([[...P(18, 6, 6), 3.4 * s], [...P(20, 11, 7), 2 * s], [...P(16, 12, 8), 1.4 * s]], "skin")];
    const tail = tube([[...P(22, 2, -2), 2 * s], [...P(32, 6, -4), 1.4 * s], [...P(40, 2, -6), 1 * s], [...P(46, 8, -4), 0.5 * s]], "skin");
    const mouth = ellipsoid(P(rear ? -17 : -17, rear ? -9 : 2.4, 7), [4 * s, (rear ? 2.6 : 1.6) * s, 3 * s], "maw", rear ? -20 : 10);
    const eyes = [sphere(P(-12, rear ? -11 : -4, 7.4), 1 * s, "eye")];
    return { b: Sub(Disp(U(2 * s, body, head, snout), (x, y, z) => 0.5 * fbm(x * 0.5, y * 0.5, z * 0.5)), mouth, 0.4), rest: [...ears, ...legs, tail, ...eyes] };
  };
  const A = rat(42, 66, 8, 1.15, "fur", true);
  const B = rat(70, 74, -6, 0.75, "fur2");
  const Cr = rat(18, 82, -10, 0.62, "fur2");
  const D = rat(78, 54, -20, 0.5, "fur2");
  const scene = U(0, bogFloor(48, 92, 46, 14, { n: 2, seed: 9101, wet: -0.05, logs: 2 }), A.b, ...A.rest, B.b, ...B.rest, Cr.b, ...Cr.rest, D.b, ...D.rest);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 20, 26, { step: 2, top: [2, 3], bot: [1, 2], cols: ["#4a4020", "#a89040", "#e8d878"], seed: 9103 });
  sores(C, 7, ["fur", "fur2", "skin"], { th: 0.5, f: 0.45 });
  // 闇の奥に光る眼
  const R = rand(9105);
  for (let i = 0; i < 7; i++) { const x = 4 + R() * 88, y = 30 + R() * 30; if (!C.get(Math.round(x), Math.round(y)) && !C.get(Math.round(x) + 2, Math.round(y))) { C.set(x, y, "#c02a10"); C.set(x + 2, y, "#c02a10"); } }
  slime(C, 9107, ["maw", "fur"], 0.08);
  scum(C, 9109);
  miasma(C, 9111, 2, [0, 30, 96, 40], 0.2);
  motes(C, 9113, 16, [2, 2, 92, 60], true);
  return C.toArt();
}
