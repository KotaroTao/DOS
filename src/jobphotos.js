// 職業の全身像 (原画そのまま版): ユーザー提供の原画を、ドット化せずに背景抜き・トリミング・縮小だけして使う。
// JOB_PHOTOS[職業キー][ランク] = { src, w, h, face, head }。w/h/face/head はドット絵と同じ「升目」単位 (原画の --per-dot px = 1ドット)。
// head = [顔の中心x, 頭頂y, あご先y]: 胸像 (顔アイコン) は頭の高さ (頭頂〜あご先) が全職同じ長さ・頭頂が同じ高さに来るよう切り出す (souls.js jobBust)。
// 画像は 1ドット = 4px で保存してある (art/jobs/*.webp)。ここに載った職は jobart.js のドット絵より優先される。
// 追加・更新は開発用の tools/jobimg.py が行う (このファイルの該当職の項目を書き換える)。sw.js の ASSETS にも画像を足すこと。
export const PHOTO_RES = 4; // 保存した画像の 1ドット (升目) あたりの px
export const JOB_PHOTOS = {
  exorcist: {
    1: { src: "art/jobs/exorcist_1.webp", w: 55, h: 88, face: [29, 14], head: [28.93, 2.64, 24.79] },
    2: { src: "art/jobs/exorcist_2.webp", w: 61, h: 88, face: [31, 14], head: [30.93, 2.79, 24.93] },
    3: { src: "art/jobs/exorcist_3.webp", w: 76, h: 88, face: [40, 14], head: [40.0, 2.57, 24.71] },
    4: { src: "art/jobs/exorcist_4.webp", w: 78, h: 88, face: [40, 14], head: [40.0, 2.64, 24.79] },
    5: { src: "art/jobs/exorcist_5.webp", w: 86, h: 88, face: [41, 12], head: [40.89, 2.64, 22.14] },
  },
  necromancer: {
    1: { src: "art/jobs/necromancer_1.webp", w: 45, h: 83, face: [19, 11], head: [19.07, 0.0, 21.29] },
    2: { src: "art/jobs/necromancer_2.webp", w: 48, h: 85, face: [22, 11], head: [21.75, 0.0, 21.21] },
    3: { src: "art/jobs/necromancer_3.webp", w: 52, h: 83, face: [22, 10], head: [21.61, 0.0, 20.36] },
    4: { src: "art/jobs/necromancer_4.webp", w: 65, h: 83, face: [24, 10], head: [23.89, 0.0, 20.21] },
    5: { src: "art/jobs/necromancer_5.webp", w: 80, h: 86, face: [35, 14], head: [34.71, 3.86, 24.57] },
  },
  warden: {
    1: { src: "art/jobs/warden_1.webp", w: 61, h: 85, face: [26, 17], head: [26.11, 6.86, 27.0] },
    2: { src: "art/jobs/warden_2.webp", w: 78, h: 86, face: [34, 17], head: [33.68, 6.86, 27.0] },
    3: { src: "art/jobs/warden_3.webp", w: 80, h: 86, face: [36, 18], head: [35.61, 7.57, 27.71] },
    4: { src: "art/jobs/warden_4.webp", w: 86, h: 88, face: [40, 17], head: [40.45, 8.68, 24.38] },
    5: { src: "art/jobs/warden_5.webp", w: 90, h: 88, face: [44, 16], head: [44.2, 10.09, 22.77] },
  },
  arcanist: {
    1: { src: "art/jobs/arcanist_1.webp", w: 52, h: 85, face: [26, 13], head: [25.86, 0.5, 25.29] },
    2: { src: "art/jobs/arcanist_2.webp", w: 57, h: 85, face: [28, 13], head: [28.04, 0.43, 25.36] },
    3: { src: "art/jobs/arcanist_3.webp", w: 62, h: 84, face: [31, 12], head: [31.43, 0.29, 24.36] },
    4: { src: "art/jobs/arcanist_4.webp", w: 71, h: 87, face: [32, 14], head: [31.68, 2.07, 25.86] },
    5: { src: "art/jobs/arcanist_5.webp", w: 79, h: 86, face: [36, 12], head: [35.96, 1.93, 22.79] },
  },
  inquisitor: {
    1: { src: "art/jobs/inquisitor_1.webp", w: 47, h: 80, face: [22, 13], head: [21.93, 1.64, 24.5] },
    2: { src: "art/jobs/inquisitor_2.webp", w: 51, h: 80, face: [23, 13], head: [23.29, 1.64, 24.5] },
    3: { src: "art/jobs/inquisitor_3.webp", w: 67, h: 82, face: [26, 12], head: [26.29, 2.21, 22.07] },
    4: { src: "art/jobs/inquisitor_4.webp", w: 62, h: 81, face: [27, 10], head: [27.46, 1.0, 18.21] },
    5: { src: "art/jobs/inquisitor_5.webp", w: 75, h: 85, face: [32, 12], head: [31.96, 2.0, 21.29] },
  },
  // <<JOB_PHOTOS>>
};
