import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, render, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { BED, ROCK, GLASS, FRAME, MURKGLASS, MURK, CRYSTAL, RIM, cavernFloor, cracks, glints, soot, murkMotes, breathFan, shards } from "../cavern.mjs";
export const meta = { id: "el_oremaw", key: "hd_oremaw", w: 112, h: 128,
  note: "鉱脈喰らい (強敵): 水晶の鉱脈ごと岩盤を喰らって肥え太った、岩塊の大きな四つ足の獣。茶灰の岩の体のあちこちから、喰いこんだ原石 (白青の水晶・紫・赤の色石) が突き出す。裂けた岩の腹の奥で、呑んだ濁った魂がいくつも琥珀に光る。大きな顎を開いて細かい鉱石の粉を吹きつけ、浴びた者は手足から石に変わる (石化・多用)。原石を固めた体は刃をほとんど通さない (物理抵抗75)" };
export function build() {
  const W = 112, H = 128;
  const mats = {
    stone: { ramp: ["#040303", "#0d0b09", "#191512", "#26201b", "#342c25", "#443a31", "#56493e", "#6a5b4e"], spec: 0.3, pow: 20, dither: 0.6,
      shade: p => 0.1 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    xtal: CRYSTAL,
    amethyst: { ramp: ["#08040e", "#1a0e2a", "#2e1a48", "#462a6a", "#64408e", "#8a62b4", "#b494da"], spec: 1.5, pow: 40, specCol: "#f0e0ff", dither: 0.35,
      shade: p => 0.18 * (Math.floor((p.nx * 3 + p.ny * 2) * 2) % 2 ? 0.5 : -0.5) },
    ruby: { ramp: ["#0e0204", "#2a060c", "#4a0c16", "#701824", "#9a2a36", "#c84a52"], spec: 1.5, pow: 40, specCol: "#ffd0d0", dither: 0.35,
      shade: p => 0.18 * (Math.floor((p.nx * 3 + p.ny * 2) * 2) % 2 ? 0.5 : -0.5) },
    maw: { ramp: ["#000000", "#100604", "#221008"], dither: 0.3 },
    pit: { ramp: ["#000000", "#0a0604", "#1a1208"], amb: 0.1, dif: 0.3, noRim: true },
    core: { ramp: MURK.slice(1), noRim: true, emit: p => 0.4 + 0.4 * Math.max(0, p.nz) },
    eye: { ramp: ["#3a2a06", "#d0a040", "#fff0b0"], emit: () => 0.95 },
    bed: BED, rock: ROCK, glass: GLASS, frame: FRAME, murk: MURKGLASS,
  };
  const skin = (x, y, z) => cracks(1.2, 0.2)(x, y, z) + 0.8 * Math.max(0, fbm(x * 0.12, y * 0.12, z * 0.12) - 0.05);
  const torso = Disp(U(7, ellipsoid([62, 72, 0], [34, 22, 20], "stone", -6), ellipsoid([36, 62, 4], [18, 20, 18], "stone", 20)), skin);
  const head = Disp(U(4, ellipsoid([22, 60, 10], [14, 12, 12], "stone", 14), ellipsoid([10, 70, 12], [10, 6, 9], "stone", 24)), skin);
  const jaw = Disp(ellipsoid([12, 82, 12], [12, 4, 8], "stone", 28), skin);
  const maw = ellipsoid([8, 77, 16], [10, 3.6, 7], "maw", 26);
  const legs = [[36, 80, 12, 30, 124, 14], [46, 82, -10, 48, 124, -10], [76, 84, 12, 80, 124, 14], [88, 82, -10, 94, 124, -10]].map(([ax, ay, az, bx, by, bz]) =>
    Disp(U(2, tube([[ax, ay, az, 10], [(ax + bx) / 2, (ay + by) / 2, az, 7.4], [bx, by - 3, bz, 7.6]], "stone", { seg: 2 }), ellipsoid([bx - 2, by - 2, bz], [9, 3.6, 8], "stone")), skin));
  // 腹の裂け目と奥の魂
  const rift = U(0.8, ...[[56, 84, 4], [64, 88, 5], [72, 86, 4.4], [80, 82, 3]].map(([x, y, r]) => ellipsoid([x, y, 20], [r * 1.4, r, 10], "pit")));
  const cores = [[56, 85, 13, 2.2], [64, 89, 14, 2.6], [72, 87, 13, 2], [80, 83, 12, 1.6]].map(([x, y, z, r]) => sphere([x, y, z], r, "core"));
  // 突き出す原石
  const R = rand(14001), gems = [];
  const kinds = ["xtal", "xtal", "xtal", "amethyst", "amethyst", "ruby"];
  for (let i = 0; i < 16; i++) {
    const t = R(), x = 28 + t * 70, y = 52 - Math.sin(t * Math.PI) * 10 + R() * 8 + (t < 0.15 ? 2 : 0), z = (R() - 0.5) * 18;
    const L = 7 + R() * 10, a = -Math.PI / 2 + (R() - 0.5) * 1.2 + (t - 0.5) * 0.7, m = kinds[i % kinds.length];
    gems.push(cone([x, y, z], [x + Math.cos(a) * L, y + Math.sin(a) * L, z], 2.6 + R() * 1.8, 0.4, m));
    if (R() < 0.6) gems.push(cone([x + 2, y + 1, z], [x + 2 + Math.cos(a + 0.5) * L * 0.6, y + Math.sin(a + 0.5) * L * 0.6, z], 1.6, 0.3, m));
  }
  for (const [x, y, z, m] of [[20, 50, 14, "xtal"], [26, 48, 8, "amethyst"], [92, 78, 10, "ruby"], [40, 80, 18, "xtal"]]) gems.push(cone([x, y, z], [x - 3, y - 9, z + 1], 2.2, 0.3, m));
  const eye = sphere([16, 58, 21], 1.3, "eye");
  const scene = U(0, cavernFloor(56, 127, 54, 15, { seed: 14003, rocks: 4, lamps: 2 }), Sub(U(2, torso, head, jaw, ...legs), U(0, maw, rift), 0.4), ...cores, ...gems, eye);
  const r = render(scene, mats, { w: W, h: H, rim: RIM, lights: [{ p: [66, 92, 26], r: 20, k: 0.35 }] });
  const C = new Canvas(r);
  fangs(C, "maw", 0, 16, { step: 2, top: [2, 3], bot: [2, 3], cols: ["#26201b", "#6a5b4e", "#9c8c7c"], seed: 14005 });
  // 鉱石の粉の息 (左下へ)
  breathFan(C, 4, 80, 100, 40, 60, { seed: 14007, cols: ["#191512", "#342c25", "#56493e", "#7a6c5e", "#a89a8a"], dens: 0.9 });
  const R2 = rand(14009);
  for (let k = 0; k < 14; k++) { const t = 0.3 + R2() * 0.7, a = (100 + (R2() - 0.5) * 50) * Math.PI / 180, x = Math.round(4 + Math.cos(a) * 40 * t), y = Math.round(80 + Math.sin(a) * 40 * t); if (x < 0 || y > 126) continue; C.set(x, y, k % 3 ? "#9cc4d6" : "#8a62b4"); }
  glints(C, 14011, ["xtal", "amethyst", "ruby"], 14);
  murkMotes(C, 14013, 16, [40, 92, 60, 24]);
  shards(C, 14015, ["bed"], 18);
  soot(C, 14017, 40);
  return C.toArt();
}
