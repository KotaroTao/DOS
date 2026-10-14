// 酒場の依頼人の肖像。依頼の番号やセーブには絵の情報を持たせない。
import { el } from "./kit.js";
import { QUEST_PORTRAITS } from "../questportraits.js";

export function questPortrait(who, size = 40, fallback = null) {
  const box = el("span", "qb-portrait");
  box.style.width = box.style.height = `${size}px`;
  const src = who && QUEST_PORTRAITS[who.name];
  const showFallback = () => {
    box.textContent = "";
    const art = fallback && fallback();
    if (art) box.appendChild(art);
    else box.appendChild(el("span", "qb-portrait-fallback", "◆"));
  };
  if (!src) { showFallback(); return box; }
  const img = el("img");
  img.alt = who.name;
  img.src = src;
  img.width = img.height = size;
  img.decoding = "async";
  img.draggable = false;
  img.addEventListener("error", showFallback, { once: true });
  box.appendChild(img);
  return box;
}
