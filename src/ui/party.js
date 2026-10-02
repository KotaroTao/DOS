// ===== 隊 (統合された人業の画面) — 隊列ストリップ・控え/仕立て・装備/魂/能力・迷宮内のシート =====
// 担当: WP-B。Phase 0 では空の受け皿。
// install() で UI 契約・タブ・頁を登録し、Phase 0 が登録したスタブを差し替える
// (game.js の init() が全パッケージの install() を呼ぶ。スタブの登録より後)。
// 提供する契約: UI.openParty(idx, {context, seg}) / UI.autoEquip(doll|"all") / UI.betterGearCount() / UI.equipItemTo(doll, item) / UI.bestWearer(item)
// game.js は import しない (ctx.js の UI / game / ops を通す。kit.js・itemview.js は自由に使ってよい)。

import { UI, game, ops, registerUI } from "./ctx.js";

export function install() {
  // 例: registerUI({ … });  UI.shell.registerTab("…", { render(root) { … } });
  void UI; void game; void ops; void registerUI;
}
