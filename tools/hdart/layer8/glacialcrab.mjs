import { sphere, ellipsoid, cone, tube, box, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, rand } from "../sdf.mjs";
import { SHELF, SNOW, ICE, RIM, SOUL, iceFloor, iceCracks, hoarfrost, glints, icicles, snowfall, tri } from "../ice.mjs";
export const meta = { id: "bs_glacialcrab", key: "hd_glacialcrab", w: 96, h: 96,
  note: "氷殻の大蟹: 背に氷河の欠片のような透き通った氷の甲羅を背負う大蟹。片方の巨大なはさみを盾のように前へ立てて仲間をかばい (護衛)、もう片方のはさみを振り上げる。甲羅の上には雪が積もり、縁から氷柱が垂れる。細い眼柄の先の眼が青白く光る" };
export function build() {
  const mats = {
    shell: { ramp: ramp(["#030406", "#0a0e14", "#141c26", "#202c3a", "#2e3e50", "#405468", "#566c82"], 7), spec: 0.9, pow: 26, specCol: "#a8c4d8", dither: 0.5,
      shade: p => 0.08 * fbm(p.x * 0.5, p.y * 0.5, p.z * 0.5) },
    leg: { ramp: ramp(["#030406", "#0c1218", "#182230", "#263446", "#38485c"], 5), spec: 0.6, pow: 22, dither: 0.5 },
    eye: { ramp: [SOUL[2], SOUL[3], SOUL[4]], emit: () => 0.9 },
    shelf: SHELF, snow: SNOW, ice: ICE,
  };
  // 甲羅: 平たい楕円の上に、氷河の欠片のような氷の塊
  const carapace = Disp(ellipsoid([54, 58, -2], [22, 10, 16], "shell"), (x, y, z) => 0.4 * fbm(x * 0.3, y * 0.3, z * 0.3));
  const glacier = Disp(U(1.5, box([56, 44, -6], [14, 9, 10], "ice", 2, -6), box([46, 46, -2], [8, 7, 8], "ice", 1.5, 18), box([66, 48, -4], [8, 6, 8], "ice", 1.5, -20)), iceCracks(0.9, 0.3));
  const eyestalks = [tube([[46, 54, 10, 1], [44, 46, 12, 0.8]], "leg"), tube([[52, 54, 11, 1], [53, 46, 13, 0.8]], "leg")];
  const eyes = [sphere([44, 45, 12.5], 1.4, "eye"), sphere([53, 45, 13.5], 1.4, "eye")];
  const mouth = ellipsoid([48, 62, 12], [5, 2.4, 2], "leg");
  // 脚 (左右4本ずつ、関節で折れる)
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const z = -12 + i * 6;
    legs.push(tube([[36, 60, z, 2.4], [26 - i * 2, 58, z + 1, 2.2], [22 - i * 3, 72, z + 2, 1.7], [20 - i * 3, 88, z + 2, 0.8]], "leg", { seg: 2 }));
    legs.push(tube([[72, 60, z, 2.4], [82 + i * 2, 58, z + 1, 2.2], [86 + i * 2, 72, z + 2, 1.7], [88 + i * 1, 88, z + 2, 0.8]], "leg", { seg: 2 }));
  }
  // 盾のはさみ (画面左・大きく前へ立てる) と振り上げたはさみ (画面右)
  const armL = tube([[40, 64, 8, 3.6], [32, 66, 14, 3.2], [24, 62, 18, 3]], "shell", { seg: 3 });
  const clawL = Disp(U(1.2, ellipsoid([22, 54, 20], [12, 16, 6], "shell", -10), cone([14, 44, 20], [3, 38, 19], 5, 1.2, "shell"), cone([14, 56, 21], [4, 56, 20], 3.4, 0.8, "shell")), (x, y, z) => 0.3 * fbm(x * 0.5, y * 0.5));
  const armR = tube([[68, 56, 6, 3.2], [76, 46, 8, 2.8], [78, 34, 9, 2.6]], "shell", { seg: 3 });
  const clawR = U(1, ellipsoid([78, 28, 9], [5, 7, 4], "shell", -10), cone([76, 24, 9], [72, 12, 9], 2.6, 0.5, "shell"), cone([81, 24, 9], [84, 14, 9], 2, 0.5, "shell"));
  const scene = U(0, iceFloor(54, 92, 44, 14, { n: 2, seed: 8601, snow: 0.08 }), U(1.4, carapace, armL, armR), glacier, ...legs, ...eyestalks, ...eyes, mouth, clawL, clawR);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 盾のはさみの表に張った氷の鏡
  for (let y = 38; y < 70; y++) for (let x = 8; x < 32; x++) { const p = C.pix[y * 96 + x]; if (p && p.m === "shell" && p.z > 22 && (x * 3 + y) % 7 === 0) C.set(x, y, "#5a849e"); }
  hoarfrost(C, ["shell", "ice"], { th: 0.35, seed: 11, k: 1.2 });
  icicles(C, 8603, ["ice", "shell"], 0.14, 4);
  glints(C, 8605, ["ice"], 6);
  snowfall(C, 8607, 36);
  return C.toArt();
}
