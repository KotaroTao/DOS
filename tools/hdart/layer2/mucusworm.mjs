import { cyl, tube, sphere, ellipsoid, cone, slab, U, Sub, Disp, Paint, render, ramp, Canvas, fbm, vnoise, rand, torus } from "../sdf.mjs";
import { RIM } from "../lib.mjs";
export const meta = { id: "bs_mucusworm", key: "hd_mucusworm", w: 96, h: 96,
  note: "粘液の長虫: 錆びた排水管から垂れ下がり、輪を描いて這い出す半透明の環形虫。透ける腸、剛毛、触肢に囲まれた口、糸を引く粘液" };
export function build() {
  const mats = {
    skin: { ramp: ramp(["#05080a", "#0e1814", "#1a2a20", "#2a402c", "#40583a", "#5e7650", "#86986c", "#b8c49a"], 8), spec: 1.6, pow: 60, specCol: "#eef8dc", dither: 0.55, amb: 0.12,
      shade: p => 0.28 * Math.pow(1 - Math.abs(p.nz), 2) - 0.06 }, // 透けた縁が明るい
    gut: { ramp: ramp(["#060404", "#140c08", "#24160c", "#382410", "#4c3416", "#62461e"], 6), spec: 1.2, pow: 60, specCol: "#d8e8c0", dither: 0.6, amb: 0.1 },
    pipe: { ramp: ramp(["#040302", "#120a06", "#24140a", "#3a2210", "#543418", "#6e4a26", "#8e6a40"], 7), spec: 0.6, pow: 25, dither: 0.6, shade: p => 0.12 * fbm(p.x * 0.4, p.y * 0.4, p.z * 0.4) },
    pipeIn: { ramp: ["#000000", "#000000", "#060302", "#120a06"], amb: 0.1, dif: 0.3 },
    maw: { ramp: ["#000000", "#0a0204", "#200810", "#3c1018"], amb: 0.2, dif: 0.4 },
    palp: { ramp: ramp(["#080606", "#22161a", "#40282c", "#64403e", "#8c6058", "#b48a7a"], 6), spec: 1, pow: 40, specCol: "#f0d8cc", dither: 0.5 },
  };
  // 排水管の口 (左上) から垂れ、右下でとぐろを巻いて鎌首を上げる
  const spine = [[15, 12, -8, 7.2], [17, 17, 2, 8], [22, 28, 5, 8.5], [30, 38, 8, 9], [42, 46, 10, 9.5], [58, 48, 6, 9.5], [70, 56, 0, 9], [72, 70, -4, 9], [62, 80, -2, 9], [46, 80, 4, 9], [36, 72, 10, 8.5], [40, 62, 16, 8], [50, 60, 22, 7.5], [56, 66, 26, 7]];
  // 環節の溝
  // 透ける腸: 投影した中心線に近い所を暗く塗る
  const S = []; for (let i = 0; i < spine.length - 1; i++) for (let t = 0; t < 1; t += 0.2) S.push(spine[i].map((v, c) => v + (spine[i + 1][c] - v) * t));
  const gut = (x, y, z, m) => { if (m !== "skin") return m; let best = 1e9, r = 1; for (const s of S) { const d = Math.hypot(x - s[0], y - s[1]); if (d < best && Math.abs(z - s[2]) < s[3] + 2) { best = d; r = s[3]; } } return best < r * 0.32 + 0.6 * vnoise(x * 0.4, y * 0.4) ? "gut" : m; };
  const along = (x, y, z) => { let best = 1e9, a = 0; for (let i = 0; i < S.length; i++) { const s = S[i]; const d = (x - s[0]) ** 2 + (y - s[1]) ** 2 + (z - s[2]) ** 2; if (d < best) { best = d; a = i; } } return a; };
  const ring = (x, y, z) => 0.7 * Math.pow(1 - Math.abs(Math.sin(along(x, y, z) * Math.PI / 4.5)), 4) + 0.12 * fbm(x * 0.6, y * 0.6, z * 0.6);
  const worm = Paint(Disp(tube(spine, "skin", { seg: 5, k: 1.5 }), ring), gut);
  // 口: 管の先を正面へ向け、触肢で囲む
  const head = ellipsoid([57, 67, 29], [7.5, 6.5, 5], "skin", 0, -40);
  const wormH = Sub(U(2, worm, head), ellipsoid([57.5, 68, 34], [4.2, 3.8, 4], "maw", 0, -40), 1);
  const palps = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; const bx = 57.5 + Math.cos(a) * 5.5, by = 68 + Math.sin(a) * 4.8; const ex = 57.5 + Math.cos(a) * 11, ey = 68 + Math.sin(a) * 10;
    palps.push(tube([[bx, by, 33, 1.5], [(bx + ex) / 2 + Math.sin(a) * 2, (by + ey) / 2 - Math.cos(a) * 2, 36, 1.1], [ex, ey, 37, 0.5]], "palp")); }
  // 排水管: 壁から突き出た錆びた土管
  const pipe = Sub(cyl([10, 6, -30], [15, 12, 0], 12, "pipe", 0.8), cyl([9, 5, -40], [15.5, 12.6, 3], 9, "pipeIn"));
  const lip = Sub(cyl([14.6, 11.5, -3], [15, 12, 0], 13.2, "pipe", 0.8), cyl([9, 5, -40], [15.5, 12.6, 3], 9.6, "pipeIn"));
  const scene = U(0, pipe, lip, wormH, ...palps);
  const r = render(scene, mats, { w: 96, h: 96, rim: RIM });
  const C = new Canvas(r);
  // 剛毛: 体の縁から短く突き出る
  const R = rand(21);
  const B = ["#3a4a34", "#7a8a66"];
  for (const s of S) { if (R() > 0.35) continue; const a = R() * Math.PI * 2, x = s[0] + Math.cos(a) * (s[3] + 0.5), y = s[1] + Math.sin(a) * (s[3] + 0.5); if (C.get(Math.round(x), Math.round(y))) continue; C.set(x, y, B[0]); C.set(x + Math.cos(a), y + Math.sin(a), B[1]); }
  // 糸を引いて垂れる粘液
  const M = ["#2a3c2a", "#56704a", "#9cb488", "#dcecc8"];
  for (const [x, y0, l] of [[26, 35, 10], [44, 55, 7], [70, 66, 14], [60, 89, 6], [48, 89, 4], [74, 78, 9]]) { let y = y0; while (C.get(x, y) && y < 95) y++; for (let i = 0; i < l && y + i < 96; i++) C.set(x, y + i, i < l - 2 ? M[1] : M[2]); if (y + l < 96) C.set(x, y + l, M[3]); }
  return C.toArt();
}
