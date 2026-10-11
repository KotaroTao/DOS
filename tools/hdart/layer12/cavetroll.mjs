import { sphere, ellipsoid, cone, tube, box, cyl, torus, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { humanoid, fingers } from "../human.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, RIM, cavernFloor, lantern, chain, soot, murkMotes, murkHalo, shards } from "../cavern.mjs";
export const meta = { id: "bs_cavetroll", key: "hd_cavetroll", w: 96, h: 96,
  note: "洞窟のトロール: 緑灰の肌の大きなトロール。猫背の巨体で両腕を頭上へ振りかぶり、組んだ拳で岩をも砕く一撃を溜める (溜め・多用) — 拳のまわりに力の輪。背中と肩を覆う苔に、拾った灯籠をいくつも紐でぶら下げている (二つは濁った光が残る)。長い鼻と下顎から突き出た牙。斬られた傷はみるみるふさがる (再生)" };
export function build() {
  const mats = {
    skin: { ramp: ["#040503", "#0c0f0a", "#161b12", "#21281b", "#2d3625", "#3b4630", "#4b583d", "#5c6b4c"], dither: 0.5, amb: 0.24,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    moss: { ramp: ["#030602", "#08120a", "#0f2010", "#183018", "#22421f", "#2e5428", "#3c6832"], dither: 0.8, amb: 0.26,
      shade: p => 0.2 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9) },
    tooth: { ramp: ["#2a261c", "#6a6250", "#a8a088", "#d8d0b8"], dither: 0.3 },
    maw: { ramp: ["#000000", "#100604", "#220c08"], dither: 0.3 },
    cord: { ramp: ["#060403", "#160f09", "#281b10"], dither: 0.3 },
    eye: { ramp: ["#3a2a06", "#b08a2a", "#ffe08a"], emit: () => 0.9 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const J = { head: [44, 40, 8], neck: [46, 44, 4], chest: [50, 54, 0], waist: [52, 66, 0], hip: [52, 72, 0],
    shL: [36, 46, 4], elL: [30, 32, 8], haL: [40, 18, 10], shR: [64, 46, 2], elR: [68, 30, 6], haR: [52, 16, 10],
    hpL: [44, 74, 2], knL: [36, 82, 8], ftL: [32, 92, 8], hpR: [60, 74, -2], knR: [66, 82, 4], ftR: [70, 92, 4] };
  const body = humanoid(J, { skin: "skin" }, { k: 3, w: { headX: 6.4, headY: 6, headZ: 6, neck: 4.4, chestX: 16, chestY: 12, chestZ: 11, waistX: 13, waistY: 9, hipX: 13, arm: 5.6, arm2: 4.6, wrist: 4.2, thigh: 6, knee: 4.6, ankle: 4 } });
  const fists = U(2, ellipsoid([41, 15, 10], [5.6, 5.4, 5.6], "skin"), ellipsoid([51, 13, 10], [5.6, 5.4, 5.6], "skin"));
  const nose = cone([42, 41, 12], [36, 46, 15], 2.4, 1, "skin");
  const jaw = ellipsoid([44, 47, 10], [5.4, 2.6, 4.4], "skin");
  const maw = ellipsoid([42, 45.4, 13], [3.6, 1.2, 2], "maw");
  const tusks = [cone([40, 46, 13.4], [39, 41, 14], 0.9, 0.2, "tooth"), cone([47, 46, 13.4], [48, 41, 14], 0.9, 0.2, "tooth")];
  const moss = Disp(U(3, ellipsoid([56, 48, -4], [16, 10, 10], "moss", -10), ellipsoid([38, 44, 0], [8, 5, 7], "moss"), ellipsoid([66, 44, 0], [8, 5, 7], "moss")), (x, y, z) => 0.9 * fbm(x * 0.5, y * 0.5, z * 0.5));
  // 苔に吊るした灯籠
  const hang = [[34, 52, 6, 2.2, true], [60, 62, -12, 2, false], [70, 56, 4, 1.8, true], [76, 50, -6, 1.6, false]];
  const lamps = [], cords = [];
  for (const [x, y, z, s, lit] of hang) { lamps.push(lantern([x, y + 7.4 * s, z], s, { lit, handle: false, rot: (x % 7) - 3 })); cords.push(cyl([x, y - 4, z], [x, y + 1, z], 0.45, "cord")); }
  const eyes = [sphere([41.4, 37.6, 13.6], 0.9, "eye"), sphere([46.6, 37.6, 13.4], 0.9, "eye")];
  const scene = U(0, cavernFloor(50, 95, 46, 13, { seed: 12901, rocks: 3, lamps: 2 }), Sub(U(1.5, body, fists, nose, jaw), maw, 0.3), ...tusks, moss, ...lamps, ...cords, ...eyes);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM, lights: [{ p: [34, 60, 14], r: 14, k: 0.3 }, { p: [70, 64, 12], r: 12, k: 0.25 }] });
  const C = new Canvas(r);
  // 溜めの力の輪 (振りかぶった拳のまわり)
  for (const [rr, c] of [[11, "#4b583d"], [15, "#2d3625"]]) for (let a = 0; a < Math.PI * 2; a += 0.6 / rr) { const x = 46 + Math.cos(a) * rr, y = 14 + Math.sin(a) * rr * 0.7; if (!C.get(Math.round(x), Math.round(y)) && Math.sin(a * 9) > -0.4) C.set(x, y, c); }
  // 再生: 傷がふさがる跡 (薄い縫い目)
  for (const [x0, y0] of [[48, 58], [56, 62]]) for (let k = 0; k < 6; k++) C.only(x0 + k, y0 + (k % 2), "#5c6b4c");
  murkHalo(C, 34, 58, 9); murkHalo(C, 70, 62, 8);
  murkMotes(C, 12903, 14, [10, 40, 76, 40]);
  shards(C, 12905, ["bed"], 14);
  soot(C, 12907, 34);
  return C.toArt();
}
