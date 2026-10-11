import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, SOOT, RIM, cavernFloor, lampHeap, spikes, glints, soot, murkMotes, murkHalo, breathFan, shards } from "../cavern.mjs";
export const meta = { id: "bs_cavernlord", key: "hd_cavernlord", w: 112, h: 128,
  note: "大空洞の主 (主): 熊とも狼ともつかない、山のような巨獣。降ってくる黒い灯籠を寝藁がわりに積み上げた寝床の山の上で、伏せから前脚を突いて身を起こす。暗い灰褐色の厚い毛 (物理抵抗50)、背の毛には黒いガラスのかけらが無数に刺さって鈍く光り、ところどころ琥珀の点。大きく開いた口から煤と灯籠の粉の息を吐く (ブレス)。吠え声で目の無い獣を呼び (招来)、手負いで寝床ごと暴れる (激昂)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    fur: { ramp: ["#040302", "#0d0a08", "#18130f", "#241c16", "#31271e", "#403328", "#4f4033", "#5e4d3e"], dither: 0.55, amb: 0.24,
      shade: p => 0.12 * Math.sin(p.x * 0.8 + p.y * 1.1 + 2.4 * fbm(p.x * 0.15, p.y * 0.15)) + 0.06 * fbm(p.x * 0.6, p.y * 0.6, p.z * 0.6) },
    obs: { ramp: ["#010102", "#06060a", "#101016", "#1c1c24", "#2c2c36"], spec: 1.6, pow: 40, specCol: "#a8a8b8", dither: 0.35 },
    claw: { ramp: ["#0c0a07", "#2e2a22", "#5e584a", "#9a927c"], spec: 0.8, pow: 20, dither: 0.3 },
    maw: { ramp: ["#000000", "#160606", "#2e0c0a", "#4a1612"], dither: 0.3 },
    eye: { ramp: MURK.slice(3), emit: () => 0.95 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  // 灯籠の寝床
  const nest = lampHeap(60, 126, -6, 50, 22, { seed: 14201, s: 2.2, lit: 0.3 });
  const furD = (x, y, z) => 0.6 * Math.abs(Math.sin(x * 0.7 + y * 0.4)) * 0.6 + 0.5 * fbm(x * 0.25, y * 0.25, z * 0.25);
  // 身を起こした巨体 (後ろは伏せ、前は前脚を突く)
  const body = Disp(U(8, ellipsoid([70, 84, -4], [32, 20, 22], "fur", -10), ellipsoid([46, 64, 2], [22, 22, 20], "fur", 30), ellipsoid([36, 46, 6], [14, 12, 14], "fur")), furD);
  const head = Disp(U(4, ellipsoid([28, 40, 12], [13, 12, 12], "fur", 10), ellipsoid([16, 48, 16], [10, 7, 9], "fur", 24)), furD);
  const jaw = Disp(ellipsoid([18, 60, 16], [11, 4, 8], "fur", 34), furD);
  const maw = ellipsoid([12, 55, 21], [9, 4, 6], "maw", 30);
  const ears = spikes([[[34, 30, 8], [40, 18, 4], 4, 0.6], [[26, 30, 14], [22, 19, 14], 3.6, 0.6]], "fur");
  const arms = [tube([[44, 70, 14, 10], [36, 92, 18, 8], [30, 116, 20, 7]], "fur", { seg: 3 }), tube([[54, 72, -8, 9], [50, 94, -10, 7.4], [48, 116, -10, 6.4]], "fur", { seg: 3 })];
  const paws = [ellipsoid([28, 118, 22], [9, 4, 8], "fur"), ellipsoid([46, 118, -8], [8, 3.6, 7], "fur")];
  const claws = spikes([[[22, 118, 26], [14, 122, 28], 1.8, 0.2], [[24, 119, 29], [17, 124, 31], 1.7, 0.2], [[28, 119, 30], [24, 125, 32], 1.6, 0.2], [[32, 119, 29], [31, 125, 31], 1.5, 0.2]], "claw");
  // 背に刺さった黒いガラスのかけら
  const R = rand(14203), glassBits = [];
  for (let i = 0; i < 26; i++) {
    const t = R(), x = 30 + t * 70, y = 34 + t * 32 - Math.sin(t * Math.PI) * 10 + R() * 6, z = (R() - 0.5) * 16 + (t < 0.3 ? 8 : 0);
    const L = 4 + R() * 6, a = -Math.PI / 2 - 0.4 + (R() - 0.5) * 1.4 + t * 0.6;
    glassBits.push(cone([x, y, z], [x + Math.cos(a) * L, y + Math.sin(a) * L, z + (R() - 0.5) * 4], 1.4 + R() * 1.2, 0.2, "obs"));
  }
  const eyes = [sphere([22, 38, 23], 1.4, "eye"), sphere([31, 37, 22], 1.3, "eye")];
  const scene = U(0, cavernFloor(56, 127, 55, 15, { seed: 14205, rocks: 2, lamps: 2 }), nest, Sub(U(3, body, head, jaw, ...ears, ...arms, ...paws), maw, 0.4), ...claws, ...glassBits, ...eyes);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [80, 112, 20], r: 30, k: 0.25 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 4, 20, { step: 2, top: [2, 4], bot: [2, 3], cols: ["#2e2a22", "#9a927c", "#d8d0b8"], seed: 14207 });
  // 煤と灯籠の粉の息 (左下へ)
  breathFan(C, 6, 58, 140, 50, 50, { seed: 14209, cols: [SOOT[1], SOOT[2], SOOT[3], SOOT[4], "#5c5046"], dens: 1.1 });
  const R2 = rand(14211);
  for (let k = 0; k < 14; k++) { const t = 0.3 + R2() * 0.7, a = (140 + (R2() - 0.5) * 40) * Math.PI / 180, x = Math.round(6 + Math.cos(a) * 50 * t), y = Math.round(58 + Math.sin(a) * 50 * t); if (x < 0 || x >= W || y >= H) continue; C.set(x, y, k % 4 ? MURK[3] : MURK[5]); }
  glints(C, 14213, ["obs"], 14, ["#5c5c6a", "#d8d8e4"]);
  for (let k = 0; k < 10; k++) { const x = Math.round(36 + R2() * 60), y = Math.round(38 + R2() * 34); const p = C.pix[y * W + x]; if (p && p.m === "fur") C.set(x, y, MURK[R2() < 0.5 ? 3 : 4]); }
  murkHalo(C, 70, 110, 30, MURK.slice(0, 2), 0.4);
  murkMotes(C, 14215, 24, [10, 6, 96, 40]);
  soot(C, 14217, 60);
  return C.toArt();
}
