// 入手の祝祭だけに使う魂のイラスト。小さな一覧の印は soulIcon のまま。
import { SOUL_CLASSES } from "../souls.js";

let serial = 0;
export function soulAcquisitionArt(jobKey) {
  const box = document.createElement("span");
  box.className = "ui-soul-art";
  box.setAttribute("aria-hidden", "true");
  const glow = (SOUL_CLASSES[jobKey] || SOUL_CLASSES.fighter).glow || "#c9a227";
  const rgb = [1, 3, 5].map((i) => parseInt(glow.slice(i, i + 2), 16) / 255);
  // 暗部は沈め、中間色に職業の色、芯には白い輝きを残す。
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const filter = document.createElementNS(ns, "filter");
  filter.id = `soul-tint-${++serial}`;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const transfer = document.createElementNS(ns, "feComponentTransfer");
  for (const [i, channel] of ["R", "G", "B"].entries()) {
    const fn = document.createElementNS(ns, `feFunc${channel}`);
    fn.setAttribute("type", "table");
    fn.setAttribute("tableValues", `0 ${rgb[i]} 1`);
    transfer.appendChild(fn);
  }
  filter.appendChild(transfer);
  svg.appendChild(filter);
  box.appendChild(svg);
  const img = document.createElement("img");
  img.alt = "";
  img.width = img.height = 176;
  img.style.filter = `url(#${filter.id})`;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  img.src = new URL(`../../art/souls/acquisition${still ? "-still" : ""}.webp`, import.meta.url).href;
  img.onerror = () => { img.remove(); };
  box.appendChild(img);
  return box;
}
