import { watchImage } from "./imageloading.js";
// 迷宮ごとの戦闘背景。出撃画面のドット絵とは別に管理する。
export const BATTLE_BACKGROUNDS = Object.freeze({
  "w01": "art/battle/w01.webp",
  "w02": "art/battle/w02.webp",
  "w03": "art/battle/w03.webp",
  "w04": "art/battle/w04.webp",
  "w05": "art/battle/w05.webp",
  "w06": "art/battle/w06.webp",
  "w07": "art/battle/w07.webp",
  "w08": "art/battle/w08.webp",
  "w09": "art/battle/w09.webp",
  "w10": "art/battle/w10.webp",
  "w11": "art/battle/w11.webp",
  "w12": "art/battle/w12.webp",
  "w13": "art/battle/w13.webp",
  "w14": "art/battle/w14.webp",
  "w15": "art/battle/w15.webp",
  "w16": "art/battle/w16.webp",
  "w17": "art/battle/w17.webp",
  "w18": "art/battle/w18.webp",
  "w19": "art/battle/w19.webp",
  "w20": "art/battle/w20.webp",
  "w21": "art/battle/w21.webp",
  "w22": "art/battle/w22.webp",
  "w23": "art/battle/w23.webp",
  "w24": "art/battle/w24.webp",
  "w25": "art/battle/w25.webp",
  "w26": "art/battle/w26.webp",
  "w27": "art/battle/w27.webp",
  "w28": "art/battle/w28.webp",
  "w29": "art/battle/w29.webp",
  "w30": "art/battle/w30.webp",
  "w31": "art/battle/w31.webp",
  "w32": "art/battle/w32.webp",
  "w33": "art/battle/w33.webp",
  "w34": "art/battle/w34.webp",
  "w35": "art/battle/w35.webp",
  "w36": "art/battle/w36.webp",
  "w37": "art/battle/w37.webp",
  "w38": "art/battle/w38.webp",
  "w39": "art/battle/w39.webp",
  "w40": "art/battle/w40.webp",
  "w41": "art/battle/w41.webp",
  "w42": "art/battle/w42.webp",
  "w43": "art/battle/w43.webp",
  "w44": "art/battle/w44.webp",
  "w45": "art/battle/w45.webp",
  "ws1": "art/battle/ws1.webp",
  "ws2": "art/battle/ws2.webp",
  "ws3": "art/battle/ws3.webp",
  "ws4": "art/battle/ws4.webp",
  "ws5": "art/battle/ws5.webp",
  "ws6": "art/battle/ws6.webp",
  "ws7": "art/battle/ws7.webp",
  "ws8": "art/battle/ws8.webp",
  "ws9": "art/battle/ws9.webp",
  "ws10": "art/battle/ws10.webp",
  "ws11": "art/battle/ws11.webp",
  "ws12": "art/battle/ws12.webp",
  "ws13": "art/battle/ws13.webp",
  "ws14": "art/battle/ws14.webp",
  "ws15": "art/battle/ws15.webp",
  "ws16": "art/battle/ws16.webp",
  "ws17": "art/battle/ws17.webp",
  "ws18": "art/battle/ws18.webp",
  "ws19": "art/battle/ws19.webp",
  "ws20": "art/battle/ws20.webp",
  "ws21": "art/battle/ws21.webp",
  "ws22": "art/battle/ws22.webp",
  "ws23": "art/battle/ws23.webp",
  "ws24": "art/battle/ws24.webp",
  "w46": "art/battle/w46.webp",
  "w47": "art/battle/w47.webp",
  "w48": "art/battle/w48.webp",
  "w49": "art/battle/w49.webp",
  "ws25": "art/battle/ws25.webp",
  "ws26": "art/battle/ws26.webp",
  "ws27": "art/battle/ws27.webp",
  "w50": "art/battle/w50.webp",
  "w51": "art/battle/w51.webp",
  "w52": "art/battle/w52.webp",
  "w53": "art/battle/w53.webp",
  "ws28": "art/battle/ws28.webp",
  "ws29": "art/battle/ws29.webp",
  "w00_forest": "art/battle/w00_forest.webp",
  "abyss": "art/battle/abyss.webp",
});

// 読み込み中・失敗時は暗い幕にし、次のフレームで再確認する。
const images = new Map();
const MAX_IMAGES = 6;
function backgroundImage(id, owner) {
  const path = BATTLE_BACKGROUNDS[id];
  if (!path || typeof Image === "undefined") return null;
  let entry = images.get(id);
  if (entry && entry.retryAt && Date.now() >= entry.retryAt) {
    images.delete(id); entry = null;
  }
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false, retryAt: 0 };
    img.onload = () => { entry.ready = img.naturalWidth > 0; };
    img.onerror = () => { entry.retryAt = Date.now() + 30000; };
    images.set(id, entry);
    img.src = new URL("../" + path, import.meta.url).href;
  }
  images.delete(id); images.set(id, entry);
  while (images.size > MAX_IMAGES) images.delete(images.keys().next().value);
  if (owner) watchImage(entry.img, owner, true);
  return entry.ready ? entry.img : null;
}

// 今いる迷宮の背景だけを探索開始時に先読みする。燭台の対象にはしない。
export function preloadBattleBackground(dungeonId) {
  const id = Object.hasOwn(BATTLE_BACKGROUNDS, dungeonId) ? dungeonId : "abyss";
  backgroundImage(id);
}

export function drawIllustratedBattleBackdrop(ctx, w, h, opts = {}) {
  // 迷宮IDがない呼び出し (記録欄など) は従来の情景を使う。
  if (!opts.dungeonId) return false;
  const id = Object.hasOwn(BATTLE_BACKGROUNDS, opts.dungeonId) ? opts.dungeonId : "abyss";
  const img = backgroundImage(id, ctx.canvas);
  if (!img) {
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = "#080a10";
    ctx.fillRect(0, 0, w, h); ctx.restore();
    return true;
  }
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = true;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
  // 魔物・名札・HPの可読性を保つ。縦長の戦場でも床を暗くする。
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(0,0,0,0.12)");
  shade.addColorStop(0.35, "rgba(0,0,0,0.26)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.48)");
  shade.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  if (opts.boss || opts.elite) {
    const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, Math.max(w, h) * 0.7);
    glow.addColorStop(0, "rgba(90,0,20,0)");
    glow.addColorStop(1, opts.boss ? "rgba(150,5,35,0.38)" : "rgba(110,10,20,0.25)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  return true;
}
