import { sphere, ellipsoid, cone, tube, slab, U, Sub, Disp, render, ramp, Canvas, fbm, rand, fangs } from "../sdf.mjs";
import { RIM, FROST, SOUL, hoarfrost, icicles, snowfall, puffs } from "../ice.mjs";
export const meta = { id: "bs_winterbat", key: "hd_winterbat", w: 96, h: 96,
  note: "霜羽の蝙蝠: 皮膜に霜の結晶が張りついた、青白い大蝙蝠。翼を大きく広げて正面から舞い降り、羽ばたくたびに眠りを誘う冷たい粉雪の靄を撒く。翼の縁からは細い氷柱が垂れ、後ろには同じ群れの小さな影がもう二匹" };
export function build() {
  const mats = {
    body: { ramp: ramp(["#020306", "#070b12", "#0e1622", "#182333", "#243346", "#34465c", "#4a5e76"], 7), dither: 0.6, spec: 0.2,
      shade: p => 0.08 * fbm(p.x * 0.8, p.y * 0.8, p.z * 0.8) },
    wing: { ramp: ramp(["#020306", "#060a12", "#0c1420", "#141f30", "#1e2c42", "#2a3c56", "#3a5070"], 7), dither: 0.65, amb: 0.22,
      shade: p => 0.1 * Math.sin(Math.atan2(p.y - 30, p.x - 48) * 9) },
    bone: { ramp: ramp(["#05070a", "#141a22", "#26303c", "#3c4856", "#566474"], 5), dither: 0.5 },
    far: { ramp: ramp(["#030407", "#080c14", "#0e1520", "#16202e"], 4), dither: 0.6 },
    maw: { ramp: ["#060203", "#200a0e", "#42141a"], dither: 0.4 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
  };
  // 一匹の蝙蝠 (正面、翼を広げる)
  const bat = (cx, cy, z, s, wm, bm) => {
    const P = (x, y) => [cx + x * s, cy + y * s];
    const torso = ellipsoid([cx, cy + 4 * s, z], [7 * s, 10 * s, 6 * s], bm);
    const head = ellipsoid([cx, cy - 8 * s, z + 2], [6 * s, 5.4 * s, 5 * s], bm);
    const ears = [cone([cx - 3 * s, cy - 11 * s, z], [cx - 7 * s, cy - 22 * s, z - 1], 2.6 * s, 0.3, bm), cone([cx + 3 * s, cy - 11 * s, z], [cx + 7 * s, cy - 22 * s, z - 1], 2.6 * s, 0.3, bm)];
    const snout = ellipsoid([cx, cy - 5 * s, z + 6 * s], [3 * s, 2.4 * s, 2 * s], bm);
    const parts = [torso, head, ...ears, snout];
    for (const side of [-1, 1]) {
      // 腕の骨: 肩 → 肘 → 手首、そこから指の骨が扇に3本
      const sh = [cx + side * 6 * s, cy - 2 * s], el = [cx + side * 20 * s, cy - 12 * s], wr = [cx + side * 32 * s, cy - 6 * s];
      parts.push(tube([[...sh, z, 2 * s], [...el, z - 1, 1.6 * s], [...wr, z - 2, 1.2 * s]], "bone"));
      const tips = [[cx + side * 46 * s, cy - 14 * s], [cx + side * 47 * s, cy + 4 * s], [cx + side * 38 * s, cy + 18 * s]];
      for (const t of tips) parts.push(cone([...wr, z - 2], [...t, z - 3], 0.9 * s, 0.3, "bone"));
      // 皮膜: 胴の脇 → 指先 → 指先 (縁は扇の間で内へ反る)
      const poly = [[cx + side * 5 * s, cy + 12 * s], sh, el, wr, tips[0], [cx + side * 40 * s, cy - 2 * s], tips[1], [cx + side * 32 * s, cy + 10 * s], tips[2], [cx + side * 20 * s, cy + 12 * s]];
      parts.push(slab(poly.map(([x, y]) => [x, y]), z - 2.4, 0.6, wm, 0.5, 0.6));
    }
    const feet = [cone([cx - 2 * s, cy + 13 * s, z], [cx - 3 * s, cy + 18 * s, z], 1 * s, 0.4, "bone"), cone([cx + 2 * s, cy + 13 * s, z], [cx + 3 * s, cy + 18 * s, z], 1 * s, 0.4, "bone")];
    return { body: Disp(U(1.2, ...parts, ...feet), (x, y, zz) => 0.15 * fbm(x * 0.6, y * 0.6, zz * 0.6)),
      mouth: ellipsoid([cx, cy - 3.6 * s, z + 7.4 * s], [2.4 * s, 1.4 * s, 1.4 * s], "maw"),
      eyes: [sphere([cx - 2.4 * s, cy - 9 * s, z + 6.4 * s], 0.9 * s, "eye"), sphere([cx + 2.4 * s, cy - 9 * s, z + 6.4 * s], 0.9 * s, "eye")] };
  };
  const A = bat(48, 40, 8, 1, "wing", "body");
  const B = bat(20, 16, -20, 0.38, "far", "far");
  const D = bat(80, 12, -20, 0.32, "far", "far");
  const scene = U(0, Sub(A.body, A.mouth, 0.3), ...A.eyes, B.body, D.body);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  fangs(C, "maw", 46, 50, { step: 2, top: [1, 2], bot: [1, 1], cols: ["#4a5460", "#a8b4c0", "#eef4f8"], seed: 8201 });
  hoarfrost(C, ["wing", "body", "bone"], { th: 0.2, seed: 5, k: 1.2 });
  icicles(C, 8203, ["wing"], 0.2, 4);
  // 羽ばたきで撒かれる眠りの粉雪の靄 (翼の下へ流れる)
  puffs(C, [[20, 76, 9], [34, 84, 8], [62, 84, 8], [76, 76, 9], [48, 90, 7]], ["#0e1622", "#18263a", "#26405a", "#3e6080", "#6a90b0"], { dens: 0.75, seed: 6 });
  snowfall(C, 8205, 46, [2, 50, 92, 44], FROST);
  snowfall(C, 8207, 18, [2, 2, 92, 46]);
  return C.toArt();
}
