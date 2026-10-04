// 金属の魔物 (銀業・金業・銀業の王) の共通部品: 鏡のような金属の肌と、ずんぐりした小さな人業の体
// 人業の意匠 (丸い無貌の頭・関節の鋼の帯) を、つるつるの貴金属で小さく可愛く。顔は魂の灯る丸い双眸だけ
import { sphere, ellipsoid, tube, torus, U, ramp } from "./sdf.mjs";
// 鏡面金属: 上 (空) を明るく、水平に暗い帯、下に床の照り返しを映す環境反射 + 強いハイライト
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function chrome(stops, specCol, { env = 1, warm = 0 } = {}) {
  return {
    ramp: ramp(stops, stops.length), amb: 0.12, dif: 0.45, spec: 1.4, pow: 70, specCol, dither: 0.35,
    shade: p => env * (0.62 * clamp(-p.ny * 1.25 - 0.05, 0, 1) - 0.2 * Math.exp(-(((p.ny - 0.12) / 0.2) ** 2)) + (0.45 + warm) * clamp(p.ny - 0.12, 0, 1) - 0.1 * clamp(p.nx, 0, 1)),
  };
}
// 関節の鋼の帯 (人業と同じ黒鋼)
export const JOINT = { ramp: ramp(["#020203", "#08090c", "#13151a", "#20232a", "#30343c"], 5), spec: 0.9, pow: 40, specCol: "#6c7480", dither: 0.4 };
// 床の影だけを落とす石畳 (暗く、縁光なし)
export const FLOOR = { ramp: ramp(["#030303", "#09090b", "#111114", "#1a1a1e"], 4), amb: 0.45, dif: 0.4, dither: 0.8, noRim: true };
// 魂の灯 (双眸・胸の小窓): 光源に依らず自ら光る
export const soulGlow = (cols) => ({ ramp: cols, emit: p => 0.35 + 0.7 * clamp(p.nz, 0, 1), dither: 0.3 });

// ずんぐりした人業。o = { c:[x,y] 頭の中心, s: 大きさ, mat, joint, lean, armUp }
// 返り値: { nodes, eye: [[x,y],[x,y]], chest:[x,y,z] }
export function chibi({ cx, cy, s = 1, mat = "metal", joint = "joint", armUp = true }) {
  const S = (v) => v * s;
  const head = sphere([cx, cy, 6], S(17), mat);
  const neck = torus([cx, cy + S(17.5), 5], S(4.6), S(1.7), joint, 0, 8);
  // 胴: 卵形 (少し前のめりに逃げる姿)
  const by = cy + S(29);
  const body = ellipsoid([cx + S(1), by, 4], [S(10.5), S(12), S(9)], mat, -6);
  const waist = torus([cx + S(1.5), by + S(8), 4], S(7.4), S(1.5), joint, -6, 10);
  // 腕: 左腕 (画面左) は大きく振り上げ、右腕は後ろへ振る
  const shL = [cx - S(9.5), by - S(6), 6], shR = [cx + S(11), by - S(5), 4];
  const armL = armUp
    ? tube([[...shL, S(3.3)], [cx - S(16), by - S(12), 8, S(3)], [cx - S(19), by - S(20), 9, S(2.8)]], mat, { seg: 3 })
    : tube([[...shL, S(3.3)], [cx - S(16), by + S(2), 8, S(3)], [cx - S(17), by + S(8), 9, S(2.8)]], mat, { seg: 3 });
  const handL = armUp ? sphere([cx - S(19.5), by - S(21.5), 9], S(3.6), mat) : sphere([cx - S(17.5), by + S(9.5), 9], S(3.6), mat);
  const armR = tube([[...shR, S(3.3)], [cx + S(17), by + S(1), 1, S(3)], [cx + S(21), by + S(5), -2, S(2.8)]], mat, { seg: 3 });
  const handR = sphere([cx + S(22), by + S(6), -2], S(3.6), mat);
  const jL = sphere(shL, S(3.9), joint), jR = sphere(shR, S(3.9), joint);
  // 脚: 駆け出す途中 (左脚を前へ蹴り上げ、右脚で踏ん張る)
  const hy = by + S(10);
  const legL = tube([[cx - S(5), hy, 5, S(3.6)], [cx - S(9), hy + S(6), 9, S(3.3)], [cx - S(10), hy + S(12), 7, S(3.1)]], mat, { seg: 3 });
  const footL = ellipsoid([cx - S(11), hy + S(14), 9], [S(4.8), S(3), S(5)], mat, -10);
  const legR = tube([[cx + S(6), hy, 3, S(3.6)], [cx + S(9), hy + S(7), 0, S(3.3)], [cx + S(10), hy + S(13), -1, S(3.1)]], mat, { seg: 3 });
  const footR = ellipsoid([cx + S(11.5), hy + S(15.5), 1], [S(4.8), S(2.8), S(5)], mat, 6);
  const kneeL = sphere([cx - S(9), hy + S(6), 9], S(2.6), joint), kneeR = sphere([cx + S(9), hy + S(7), 0], S(2.6), joint);
  const hipJ = [sphere([cx - S(5), hy, 5], S(3.4), joint), sphere([cx + S(6), hy, 3], S(3.4), joint)];
  return {
    nodes: [head, neck, body, waist, armL, handL, armR, handR, jL, jR, legL, footL, legR, footR, kneeL, kneeR, ...hipJ],
    eye: [[cx - S(6), cy + S(1)], [cx + S(5), cy + S(1)]],
    chest: [cx + S(0.5), by - S(2), 4 + S(9)],
    feet: hy + S(17.5),
  };
}
