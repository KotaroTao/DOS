// 職業の全身像 (原画そのまま版): ユーザー提供の原画を、ドット化せずに背景抜き・トリミング・縮小だけして使う。
// JOB_PHOTOS[職業キー][ランク] = { src, w, h, face, head }。w/h/face/head はドット絵と同じ「升目」単位 (原画の --per-dot px = 1ドット)。
// head = [顔の中心x, 瞳の中心y, あご先y]: 胸像 (顔アイコン) はこの「瞳〜あご先」が全職同じ長さ・同じ高さに来るよう切り出す (souls.js jobBust)。
// 画像は 1ドット = 4px で保存してある (art/jobs/*.webp)。ここに載った職は jobart.js のドット絵より優先される。
// 追加・更新は開発用の tools/jobimg.py が行う (このファイルの該当職の項目を書き換える)。sw.js の ASSETS にも画像を足すこと。
export const PHOTO_RES = 4; // 保存した画像の 1ドット (升目) あたりの px
export const JOB_PHOTOS = {
  fighter: {
    1: { src: "art/jobs/fighter_1.webp", w: 52, h: 71, face: [30, 17], head: [30.29, 17.36, 21.82] },
    2: { src: "art/jobs/fighter_2.webp", w: 54, h: 71, face: [32, 17], head: [32.29, 17.36, 21.82] },
    3: { src: "art/jobs/fighter_3.webp", w: 68, h: 71, face: [32, 17], head: [32.29, 17.36, 21.82] },
    4: { src: "art/jobs/fighter_4.webp", w: 75, h: 71, face: [36, 17], head: [36.5, 17.36, 21.82] },
    5: { src: "art/jobs/fighter_5.webp", w: 73, h: 73, face: [38, 17], head: [37.57, 17.14, 21.39] },
  },
  // <<JOB_PHOTOS>>
};
