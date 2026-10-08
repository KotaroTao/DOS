// 職業の全身像 (原画そのまま版): ユーザー提供の原画を、ドット化せずに背景抜き・トリミング・縮小だけして使う。
// JOB_PHOTOS[職業キー][ランク] = { src, w, h, face, head }。w/h/face/head はドット絵と同じ「升目」単位 (原画の --per-dot px = 1ドット)。
// head = [顔の中心x, 頭頂y, あご先y]: 胸像 (顔アイコン) は頭の高さ (頭頂〜あご先) が全職同じ長さ・頭頂が同じ高さに来るよう切り出す (souls.js jobBust)。
// 画像は 1ドット = 4px で保存してある (art/jobs/*.webp)。ここに載った職は jobart.js のドット絵より優先される。
// 追加・更新は開発用の tools/jobimg.py が行う (このファイルの該当職の項目を書き換える)。sw.js の ASSETS にも画像を足すこと。
export const PHOTO_RES = 4; // 保存した画像の 1ドット (升目) あたりの px
export const JOB_PHOTOS = {
  fighter: {
    1: { src: "art/jobs/fighter_1.webp", w: 59, h: 84, face: [35, 12], head: [34.78, 1.91, 22.5] },
    2: { src: "art/jobs/fighter_2.webp", w: 66, h: 84, face: [35, 12], head: [35.07, 1.91, 22.5] },
    3: { src: "art/jobs/fighter_3.webp", w: 67, h: 84, face: [36, 12], head: [36.03, 1.91, 22.5] },
    4: { src: "art/jobs/fighter_4.webp", w: 74, h: 84, face: [37, 12], head: [37.13, 1.91, 22.5] },
    5: { src: "art/jobs/fighter_5.webp", w: 74, h: 84, face: [36, 12], head: [36.18, 1.91, 22.5] },
  },
  exorcist: {
    1: { src: "art/jobs/exorcist_1.webp", w: 55, h: 88, face: [29, 14], head: [28.93, 2.64, 24.79] },
    2: { src: "art/jobs/exorcist_2.webp", w: 61, h: 88, face: [31, 14], head: [30.93, 2.79, 24.93] },
    3: { src: "art/jobs/exorcist_3.webp", w: 76, h: 88, face: [40, 14], head: [40.0, 2.57, 24.71] },
    4: { src: "art/jobs/exorcist_4.webp", w: 78, h: 88, face: [40, 14], head: [40.0, 2.64, 24.79] },
    5: { src: "art/jobs/exorcist_5.webp", w: 86, h: 88, face: [41, 12], head: [40.89, 2.64, 22.14] },
  },
  necromancer: {
    1: { src: "art/jobs/necromancer_1.webp", w: 45, h: 83, face: [19, 11], head: [19.07, 0.0, 22.125] },
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
  // 呪術師の胸像は、頭巾の先・角を除いた頭の範囲で他職と大きさを揃える。
  hexer: {
    1: { src: "art/jobs/hexer_1.webp", w: 47, h: 72, face: [23, 12], head: [22.86, 5.5, 24.98] },
    2: { src: "art/jobs/hexer_2.webp", w: 50, h: 72, face: [26, 12], head: [26.3, 5.5, 24.9] },
    3: { src: "art/jobs/hexer_3.webp", w: 58, h: 72, face: [28, 12], head: [28.05, 5.5, 24.9] },
    4: { src: "art/jobs/hexer_4.webp", w: 61, h: 78, face: [29, 21], head: [29.47, 12.5, 33.48] },
    5: { src: "art/jobs/hexer_5.webp", w: 64, h: 80, face: [35, 24], head: [35.11, 12.5, 34.27] },
  },
  ascetic: {
    1: { src: "art/jobs/ascetic_1.webp", w: 40, h: 73, face: [24, 12], head: [24.15, 1.87, 22.27] },
    2: { src: "art/jobs/ascetic_2.webp", w: 42, h: 73, face: [25, 12], head: [25.14, 1.87, 22.27] },
    3: { src: "art/jobs/ascetic_3.webp", w: 44, h: 73, face: [26, 12], head: [25.8, 1.87, 22.27] },
    4: { src: "art/jobs/ascetic_4.webp", w: 48, h: 73, face: [27, 12], head: [26.8, 1.87, 22.27] },
    5: { src: "art/jobs/ascetic_5.webp", w: 45, h: 77, face: [24, 19], head: [23.93, 10.59, 28.12] },
  },
  archbishop: {
    1: { src: "art/jobs/archbishop_1.webp", w: 42, h: 74, face: [25, 20], head: [25.19, 12.72, 27.16] },
    2: { src: "art/jobs/archbishop_2.webp", w: 43, h: 77, face: [25, 22], head: [25.37, 14.57, 29.38] },
    3: { src: "art/jobs/archbishop_3.webp", w: 51, h: 78, face: [26, 23], head: [25.99, 16.05, 30.86] },
    4: { src: "art/jobs/archbishop_4.webp", w: 56, h: 80, face: [26, 25], head: [26.42, 17.41, 32.72] },
    5: { src: "art/jobs/archbishop_5.webp", w: 59, h: 83, face: [24, 28], head: [24.2, 20.37, 35.68] },
  },
  hero: {
    1: { src: "art/jobs/hero_1.webp", w: 44, h: 72, face: [27, 12], head: [27.32, 4.29, 20.24] },
    2: { src: "art/jobs/hero_2.webp", w: 50, h: 72, face: [25, 12], head: [25.42, 4.29, 20.24] },
    3: { src: "art/jobs/hero_3.webp", w: 51, h: 72, face: [28, 12], head: [28.15, 4.29, 20.24] },
    4: { src: "art/jobs/hero_4.webp", w: 53, h: 72, face: [29, 12], head: [28.75, 4.29, 20.24] },
    5: { src: "art/jobs/hero_5.webp", w: 73, h: 72, face: [40, 11], head: [39.76, 3.41, 18.71] },
  },
  hermit: {
    1: { src: "art/jobs/hermit_1.webp", w: 49, h: 72, face: [22, 11], head: [21.89, 0.95, 21.35] },
    2: { src: "art/jobs/hermit_2.webp", w: 48, h: 72, face: [20, 12], head: [19.93, 1.49, 21.89] },
    3: { src: "art/jobs/hermit_3.webp", w: 50, h: 72, face: [22, 12], head: [21.55, 1.49, 21.89] },
    4: { src: "art/jobs/hermit_4.webp", w: 53, h: 72, face: [22, 11], head: [22.5, 1.22, 21.62] },
    5: { src: "art/jobs/hermit_5.webp", w: 57, h: 81, face: [22, 19], head: [22.16, 8.92, 29.32] },
  },
  brigand: {
    1: { src: "art/jobs/brigand_1.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.0, 23.125] },
    2: { src: "art/jobs/brigand_2.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.0, 23.125] },
    3: { src: "art/jobs/brigand_3.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.0, 23.125] },
    4: { src: "art/jobs/brigand_4.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.0, 23.125] },
    5: { src: "art/jobs/brigand_5.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.0, 23.125] },
  },
  arcthief: {
    1: { src: "art/jobs/arcthief_1.webp", w: 49, h: 83, face: [20, 11], head: [20.06, 0.0, 21.3] },
    2: { src: "art/jobs/arcthief_2.webp", w: 56, h: 83, face: [21, 11], head: [20.94, 0.0, 21.29] },
    3: { src: "art/jobs/arcthief_3.webp", w: 65, h: 84, face: [22, 11], head: [21.94, 0.07, 21.32] },
    4: { src: "art/jobs/arcthief_4.webp", w: 67, h: 84, face: [24, 11], head: [23.75, 0.07, 21.35] },
    5: { src: "art/jobs/arcthief_5.webp", w: 70, h: 86, face: [25, 12], head: [25.2, 2.13, 22.48] },
  },
  paladin: {
    1: { src: "art/jobs/paladin_1.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.195, 23.164] },
    2: { src: "art/jobs/paladin_2.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.195, 23.306] },
    3: { src: "art/jobs/paladin_3.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.192, 22.92] },
    4: { src: "art/jobs/paladin_4.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.256, 23.27] },
    5: { src: "art/jobs/paladin_5.webp", w: 90, h: 84, face: [45, 12], head: [45.0, 1.128, 22.95] },
  },
  crusader: {
    1: { src: "art/jobs/crusader_1.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
    2: { src: "art/jobs/crusader_2.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.893] },
    3: { src: "art/jobs/crusader_3.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.918] },
    4: { src: "art/jobs/crusader_4.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.912] },
    5: { src: "art/jobs/crusader_5.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.94] },
  },
  bishop: {
    1: { src: "art/jobs/bishop_1.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
    2: { src: "art/jobs/bishop_2.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
    3: { src: "art/jobs/bishop_3.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
    4: { src: "art/jobs/bishop_4.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
    5: { src: "art/jobs/bishop_5.webp", w: 90, h: 92, face: [45, 20], head: [45.0, 9.0, 30.93] },
  },
  // <<JOB_PHOTOS>>
};
