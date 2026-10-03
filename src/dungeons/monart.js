// 魔物の絵の差し替え口 — ユーザー提供の原画をドット絵化して、魔物 id ごとに上書きする
//
// 魔物の能力値・特徴・出現表は bestiary.js が持ち、絵は artKey (schema.js の ARTS 原型) から引く。
// ここに id → { palette, art } を登録すると、その魔物の絵だけが差し替わる (戦闘・盤面・図鑑のすべて)。
// id・能力値・特徴は変わらないので、セーブや図鑑には影響しない。未登録の魔物は従来の原型のまま。
//
// ── 差し替えの手順 ──
//   1. 原画 (PNG・背景は透過か単色) を用意する
//   2. node tools/monart.mjs <魔物id> <原画.png> [--h 96] [--colors 16] [--preview]
//      → 縮小 (1ドット=1画素)・減色・背景抜きをして、下の登録欄に書き込む (同じ id は上書き)
//      まとめて差し替える時は、原画を「<魔物id>.png」の名で1つのフォルダに置き
//        node tools/monart.mjs --dir <フォルダ> --layer 3     (層ボス/強敵は自動で高さ120、他は96)
//      どの id がどの魔物かは  node tools/monart.mjs --list 3  で一覧できる (差し替え済みかも表示)
//   3. 盤面/戦闘で確認し、sw.js の CACHE を上げる
//   手で描いた {palette, art} をそのまま書いてもよい (art は行の配列・"." が透明・行長は不揃い可)。
//   大きさは自由 (第1層の hd_* は 96×96 前後、強敵/層ボスは 112×128 前後)。drawMonster が表示寸法に揃える。
//
// 書式: 登録欄 (<<MONSTER_ART>> の間) は tools/monart.mjs が丸ごと書き直す。手で直す時も JSON 互換の書式を保つこと。

// 原画待ちの魔物 (層 → id)。差し替えが済んだ id はここから外してよい (表示用の目録で、動作には影響しない)
export const ART_WANTED = {
  // (第1〜4層は hd_* の固有原型で描き終えた。第3層: tools/hdart/layer3/、第4層: tools/hdart/layer4/)
};

// <<MONSTER_ART>>
export const MONSTER_ART = {
};
// <</MONSTER_ART>>

// 登録内容の検査 (読み込み時に1度)。壊れた絵は図鑑や戦闘を巻き込むので、早めに止める
export function validateMonsterArt(id, a) {
  if (!a || !Array.isArray(a.art) || !a.art.length || !a.palette) throw new Error(`monart: ${id} に palette/art がない`);
  for (const row of a.art) {
    if (typeof row !== "string") throw new Error(`monart: ${id} の art に文字列以外の行がある`);
    for (const ch of row) if (ch !== "." && !(ch in a.palette)) throw new Error(`monart: ${id} の art の "${ch}" が palette にない`);
  }
}
