// 収集品の固有の絵 (100種、1品に1枚)。id → { pal, art }
//  - art: 24 行 × 24 文字のドット絵。"." = 透明。光源は左上、黒縁 k は 1px。
//  - pal: defs.js の共有パレット P (ITEM_PALETTE) に足す/上書きする色 { 文字: "#rrggbb" }。染め (tint) はしない。
//  - lv165 以上の品は defs.js が輪郭の外に燐光を足す。
//  - 見本と検査: node tools/miscart.mjs  (下書きは node tools/miscart.mjs <file.mjs>)
//  - 収集品を足すときは、ここに固有の絵を足す (無いと defs.js の M() が投げる)。
export const MISC_ART = {
};
