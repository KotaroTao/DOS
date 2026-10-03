// 点列の弧長パラメータ (最寄りの線分から): 体節の溝などに使う
export function arcParam(spine) {
  const acc = [0]; for (let i = 1; i < spine.length; i++) acc.push(acc[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1], spine[i][2] - spine[i - 1][2]));
  return (x, y, z) => {
    let best = 1e9, s = 0;
    for (let i = 0; i < spine.length - 1; i++) {
      const a = spine[i], b = spine[i + 1]; const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2]; const l2 = ex * ex + ey * ey + ez * ez;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / l2));
      const d = (x - a[0] - ex * t) ** 2 + (y - a[1] - ey * t) ** 2 + (z - a[2] - ez * t) ** 2;
      if (d < best) { best = d; s = acc[i] + t * Math.sqrt(l2); }
    }
    return s;
  };
}
