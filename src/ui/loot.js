// ===== 品 — 入手の割り込み方針 (トースト/祝祭)・品シート (ItemSheet)・NEW 印 =====
// 担当: WP-C。Phase 0 では空の受け皿。
// install() で UI 契約・タブ・頁を登録し、Phase 0 が登録したスタブを差し替える
// (game.js の init() が全パッケージの install() を呼ぶ。スタブの登録より後)。
// 提供する契約: UI.loot(item, who, {source}, next) / UI.itemSheet(item, {owner, context, actions})
// game.js は import しない (ctx.js の UI / game / ops を通す。kit.js・itemview.js は自由に使ってよい)。

import { UI, game, ops, registerUI } from "./ctx.js";

export function install() {
  // 例: registerUI({ … });  UI.shell.registerTab("…", { render(root) { … } });
  void UI; void game; void ops; void registerUI;
}
