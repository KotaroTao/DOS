// 職業の全身像 (原画そのまま版): ユーザー提供の原画を、ドット化せずに背景抜き・トリミング・縮小だけして使う。
// JOB_PHOTOS[職業キー][ランク] = { src, w, h, face, head }。w/h/face/head はドット絵と同じ「升目」単位 (原画の --per-dot px = 1ドット)。
// head = [顔の中心x, 瞳の中心y, 顔の幅]: 胸像 (顔アイコン) は顔の幅が全職同じ長さ・瞳が同じ高さに来るよう切り出す (souls.js jobBust)。
// 画像は 1ドット = 4px で保存してある (art/jobs/*.webp)。ここに載った職は jobart.js のドット絵より優先される。
// 追加・更新は開発用の tools/jobimg.py が行う (このファイルの該当職の項目を書き換える)。sw.js の ASSETS にも画像を足すこと。
export const PHOTO_RES = 4; // 保存した画像の 1ドット (升目) あたりの px
export const JOB_PHOTOS = {
  fighter: {
    1: { src: "art/jobs/fighter_1.webp", w: 52, h: 71, face: [30, 16], head: [30.0, 16.5, 10.14] },
    2: { src: "art/jobs/fighter_2.webp", w: 54, h: 71, face: [32, 16], head: [32.0, 16.5, 10.14] },
    3: { src: "art/jobs/fighter_3.webp", w: 68, h: 71, face: [32, 16], head: [32.0, 16.5, 10.14] },
    4: { src: "art/jobs/fighter_4.webp", w: 75, h: 71, face: [36, 16], head: [36.21, 16.5, 10.14] },
    5: { src: "art/jobs/fighter_5.webp", w: 73, h: 73, face: [38, 16], head: [37.5, 16.43, 9.86] },
  },
  exorcist: {
    1: { src: "art/jobs/exorcist_1.webp", w: 55, h: 88, face: [29, 19], head: [28.93, 19.07, 11.14] },
    2: { src: "art/jobs/exorcist_2.webp", w: 61, h: 88, face: [31, 19], head: [30.93, 19.21, 11.14] },
    3: { src: "art/jobs/exorcist_3.webp", w: 76, h: 88, face: [40, 19], head: [40.0, 19.0, 11.14] },
    4: { src: "art/jobs/exorcist_4.webp", w: 78, h: 88, face: [40, 19], head: [40.0, 19.07, 11.14] },
    5: { src: "art/jobs/exorcist_5.webp", w: 86, h: 88, face: [41, 17], head: [40.89, 17.0, 10.07] },
  },
  // <<JOB_PHOTOS>>
};
