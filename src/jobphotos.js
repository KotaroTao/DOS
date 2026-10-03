// 職業の全身像 (原画そのまま版): ユーザー提供の原画を、ドット化せずに背景抜き・トリミング・縮小だけして使う。
// JOB_PHOTOS[職業キー][ランク] = { src, w, h, face }。w/h/face はドット絵と同じ「升目」単位 (原画の --per-dot px = 1ドット)。
// 画像は 1ドット = 4px で保存してある (art/jobs/*.webp)。ここに載った職は jobart.js のドット絵より優先される。
// 追加・更新は開発用の tools/jobimg.py が行う (このファイルの該当職の項目を書き換える)。sw.js の ASSETS にも画像を足すこと。
export const PHOTO_RES = 4; // 保存した画像の 1ドット (升目) あたりの px
export const JOB_PHOTOS = {
  fighter: {
    1: { src: "art/jobs/fighter_1.webp", w: 54, h: 73, face: [30, 19] },
    2: { src: "art/jobs/fighter_2.webp", w: 56, h: 73, face: [32, 19] },
    3: { src: "art/jobs/fighter_3.webp", w: 70, h: 73, face: [32, 19] },
    4: { src: "art/jobs/fighter_4.webp", w: 78, h: 74, face: [36, 19] },
    5: { src: "art/jobs/fighter_5.webp", w: 76, h: 76, face: [37, 20] },
  },
  // <<JOB_PHOTOS>>
};
