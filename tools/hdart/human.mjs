// 人型の骨格から SDF を組む: J = 関節の座標 {head:[x,y,z], neck, chest, waist, hip, shL, elL, haL, shR, elR, haR, hpL, knL, ftL, hpR, knR, ftR}
import { tube, sphere, ellipsoid, cone, U } from "./sdf.mjs";
export function humanoid(J, m, o = {}) {
  const s = o.scale || 1, W = o.w || {};
  const w = (k, d) => (W[k] ?? d) * s;
  const parts = [];
  parts.push(ellipsoid(J.head, [w("headX", 4.6), w("headY", 5.8), w("headZ", 5)], m.head || m.skin, o.headRot || 0));
  parts.push(tube([[...J.head.map((v, i) => i === 1 ? v + 3 * s : v), w("neck", 2)], [...J.neck, w("neck", 2.2)]], m.skin));
  parts.push(ellipsoid(J.chest, [w("chestX", 8.5), w("chestY", 7.5), w("chestZ", 5.5)], m.torso || m.skin, o.chestRot || 0));
  parts.push(ellipsoid(J.waist, [w("waistX", 6.5), w("waistY", 6), w("waistZ", 4.6)], m.torso || m.skin, o.waistRot || 0));
  parts.push(ellipsoid(J.hip, [w("hipX", 7.5), w("hipY", 5), w("hipZ", 5)], m.hip || m.torso || m.skin, o.hipRot || 0));
  for (const S of ["L", "R"]) {
    parts.push(tube([[...J["sh" + S], w("arm", 2.6)], [...J["el" + S], w("arm2", 2.1)], [...J["ha" + S], w("wrist", 1.5)]], m.arm || m.skin, { seg: 3 }));
    if (J["hp" + S]) parts.push(tube([[...J["hp" + S], w("thigh", 3.6)], [...J["kn" + S], w("knee", 2.6)], [...J["ft" + S], w("ankle", 1.9)]], m.leg || m.skin, { seg: 3 }));
  }
  return U(o.k ?? 1.6, ...parts);
}
// 指: 手首の位置と向き(度)から n 本
export function fingers(at, deg, mat, { n = 4, len = 5, spread = 22, r = 0.8, curl = 0.3, z = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (deg + (i - (n - 1) / 2) * spread / (n - 1 || 1) * 2) * Math.PI / 180;
    const p1 = [at[0] + Math.cos(a) * len * 0.55, at[1] + Math.sin(a) * len * 0.55, at[2] + z * 0.5];
    const a2 = a + curl;
    const p2 = [p1[0] + Math.cos(a2) * len * 0.5, p1[1] + Math.sin(a2) * len * 0.5, at[2] + z];
    out.push(tube([[...at, r * 1.2], [...p1, r], [...p2, r * 0.55]], mat, { seg: 2 }));
  }
  return out;
}
