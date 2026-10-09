import { sphere, ellipsoid, cone, tube, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { MUD, POOL, ROTWOOD, RIM, ROT, bogFloor, scum, motes, slime, sores, spikes, miasma } from "../swamp.mjs";
export const meta = { id: "bs_plaguebeast", key: "hd_plaguebeast", w: 96, h: 96,
  note: "疫病の獣: 疫病に冒されて狂った、猪に似た大きな獣。毛は抜け落ちてただれた肌が覗き、あばらが浮き、背には逆立った剛毛のたてがみ (激昂)。黄ばんだ牙の口から毒のよだれを垂らし、噛みついた傷へ病毒を流し込む (毒・多用)。ただれた背からは黄緑の膿が噴く" };
export function build() {
  const mats = {
    hide: { ramp: ramp(["#030202", "#0a0706", "#140f0c", "#201812", "#2e2219", "#3e2f22", "#50402e"], 7), dither: 0.6, amb: 0.22,
      shade: p => 0.1 * Math.sin(p.x * 1.3 + p.y * 2 + 2 * fbm(p.x * 0.3, p.y * 0.3)) },
    raw: { ramp: ramp(["#0a0404", "#1e0a0a", "#341612", "#4e241c", "#6a3428", "#86483a"], 6), dither: 0.5, amb: 0.28, spec: 0.6, pow: 20 },
    bristle: { ramp: ramp(["#020101", "#080605", "#110d0a", "#1c1610", "#2a2218"], 5), dither: 0.6 },
    tusk: { ramp: ramp(["#14100a", "#3a3220", "#6a5e3e", "#a09068", "#d0c49c"], 5), spec: 0.8, pow: 24, dither: 0.4 },
    maw: { ramp: ["#060203", "#1e080a", "#3c1216"], dither: 0.3 },
    eye: { ramp: ["#5a0a06", "#e04018", "#ffb070"], emit: () => 0.95 },
    mud: MUD, pool: POOL, rotwood: ROTWOOD,
  };
  const chest = ellipsoid([36, 56, 2], [16, 16, 13], "hide", 10);
  const barrel = ellipsoid([58, 56, -2], [20, 14, 12], "hide", -4);
  const haunch = ellipsoid([76, 60, -2], [11, 13, 11], "hide", 10);
  const head = ellipsoid([20, 62, 8], [10, 9, 9], "hide", 20);
  const snout = cone([16, 66, 10], [6, 72, 12], 6, 4, "hide");
  const jaw = cone([16, 72, 10], [8, 78, 12], 4, 2.4, "hide");
  const mouth = ellipsoid([8, 74, 14], [4, 2, 3], "maw", 20);
  const ears = [cone([24, 54, 2], [30, 46, -2], 3, 0.4, "hide"), cone([22, 54, 14], [24, 46, 16], 2.6, 0.4, "hide")];
  const legs = [
    tube([[30, 66, 10, 5], [28, 78, 12, 3.6], [26, 90, 12, 3]], "hide", { seg: 3 }), tube([[38, 66, -6, 4.6], [40, 78, -6, 3.4], [38, 90, -6, 2.8]], "hide", { seg: 3 }),
    tube([[76, 66, 6, 6], [80, 78, 7, 3.6], [78, 90, 7, 3]], "hide", { seg: 3 }), tube([[78, 66, -8, 5], [82, 78, -8, 3.2], [80, 90, -8, 2.6]], "hide", { seg: 3 }),
  ];
  const tusks = [tube([[10, 72, 15, 1.4], [6, 66, 16, 1], [8, 60, 15, 0.4]], "tusk"), tube([[13, 73, 6, 1.2], [9, 67, 5, 0.9], [11, 62, 4, 0.3]], "tusk")];
  const eyes = [sphere([18, 58, 15.4], 1.1, "eye")];
  // ただれた肌 (毛の抜けた所)
  const body = Paint(Disp(U(3, chest, barrel, haunch, head, snout, jaw, ...ears, ...legs), (x, y, z) => 0.5 * fbm(x * 0.4, y * 0.4, z * 0.4) - 0.6 * Math.max(0, Math.abs(Math.sin((x - 50) * 0.42)) - 0.85) * (y < 60 ? 1 : 0)),
    (x, y, z, m) => (m === "hide" && fbm(x * 0.12, y * 0.12, z * 0.12 + 3) > 0.12 ? "raw" : m));
  // 背の剛毛のたてがみ (逆立つ)
  const R = rand(9901);
  const bristles = [];
  for (let i = 0; i < 16; i++) { const x = 28 + i * 3.2, y = 42 - Math.sin(i / 15 * Math.PI) * 4 + (x > 60 ? (x - 60) * 0.15 : 0); bristles.push([[x, y + 4, -1 + R() * 2], [x + 3 + R() * 2, y - 6 - R() * 5 - (i > 3 && i < 10 ? 3 : 0), -2], 1.6, 0.2]); }
  const scene = U(0, bogFloor(48, 94, 46, 14, { n: 2, seed: 9903, wet: 0, logs: 1 }), Sub(body, mouth, 0.4), ...tusks, ...eyes, ...spikes(bristles, "bristle"));
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 4, 12, { step: 2, top: [1, 2], bot: [1, 2], cols: ["#3a3220", "#a09068", "#d0c49c"], seed: 9905 });
  sores(C, 21, ["raw"], { th: 0.4, f: 0.5 });
  // 毒のよだれ
  for (const [x, l] of [[6, 9], [9, 6], [12, 4]]) for (let k = 0; k < l; k++) if (!C.get(x, 77 + k)) C.set(x, 77 + k, k === l - 1 ? ROT[4] : ROT[2]);
  // 背から噴く膿
  for (const [x, y] of [[50, 44], [62, 44], [42, 46]]) { for (let k = 1; k < 5; k++) if (!C.get(x, y - k)) C.set(x + (k % 2), y - k, ROT[k > 2 ? 4 : 3]); }
  slime(C, 9907, ["raw"], 0.05, [ROT[1], ROT[2], ROT[3]]);
  scum(C, 9909);
  miasma(C, 9911, 2, [0, 30, 96, 40], 0.2);
  motes(C, 9913, 14, [2, 2, 92, 40], true);
  return C.toArt();
}
