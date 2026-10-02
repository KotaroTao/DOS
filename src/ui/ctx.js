// ===== UI の共有窓口 (Phase 0 基盤) =====
// 新しい UI モジュールは game.js を import しない (循環 import と TDZ を避けるため)。
// game.js の内部 (G・描画・単体操作) には init() で結びつけた `game` から触れ、
// パッケージ間の呼び出しは登録制の `UI` を通す。一括操作は `ops` (game.js の OPS ブロックが登録)。
//
//   UI   … パッケージ間の公開API。Phase 0 が全契約に「動くスタブ」を登録し、各パッケージが上書きする
//   game … game.js の内部 (bindGame で init() の冒頭に結ぶ。最初の描画より前)
//   ops  … 一括操作 (宿・鑑定・売却・連れ帰り・拝受・奉納・鍛錬)。単体操作のループで、価格・除外は単体と同一

export const UI = {};
export const game = {};
export const ops = {};

// game.js の内部を結ぶ (同名は上書き)
export function bindGame(obj) {
  Object.assign(game, obj);
  return game;
}

// UI 契約を登録する (後から登録したものが勝つ = 各パッケージがスタブを差し替える)
export function registerUI(obj) {
  Object.assign(UI, obj);
  return UI;
}

// UI 契約を安全に呼ぶ (未登録なら fallback を返す)
export function callUI(name, ...args) {
  const fn = UI[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}
