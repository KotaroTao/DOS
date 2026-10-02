// ===== 王宮 — 勅命・図鑑 (魔物/品/職業)・勲章 (まとめて拝受)・宝物庫・戦績 =====
// 担当: WP-A。Phase 0 では空の受け皿。
// install() で UI 契約・タブ・頁を登録し、Phase 0 が登録したスタブを差し替える
// (game.js の init() が全パッケージの install() を呼ぶ。スタブの登録より後)。
// 提供する契約: UI.openPalace(seg) (Phase 0 のスタブ = 王宮タブを開く)
// game.js は import しない (ctx.js の UI / game / ops を通す。kit.js・itemview.js は自由に使ってよい)。

import { UI, game, ops, registerUI } from "./ctx.js";

export function install() {
  // 例: registerUI({ … });  UI.shell.registerTab("…", { render(root) { … } });
  void UI; void game; void ops; void registerUI;
}
