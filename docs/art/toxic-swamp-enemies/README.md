# 第七章「毒沼」の敵イラスト

森の古屋の虫3体（`docs/art/prologue-enemies/preview.png` 上段）を直接参照。暗い輪郭、左上の光、落ち着いた土色・苔色、細かな段のある質感をそろえ、図鑑の説明（`src/dungeons/bestiary.js`）と伝承（`src/dungeons/monlore.js`）から未作成21体を制作した。

対象は腐れ水の岸・器の捨て場・毒霧の葦原・よどみの底・疫病塚の底・沈んだ渡し場。本筋と寄り道、主・召喚先を含めて確認する。作成済みの沼呑みの蛙王・供物のるつぼと共通敵は既存原画を共用。能力・技・本文・出現条件は変更しない。

出荷物は `art/monsters/<ID>.webp` の透過・ロスレスWebP。長辺512px以内の本体に4pxの透明余白を付ける。原画は `sheet-a.png`〜`sheet-g.png`（上段左・上段右・下段左の順）。接続した本体をまとめて切り出し、脚・尾・冠を中央線で切断しない。

再変換: `python3 tools/toxic-swamp/build-enemies.py`  
実画面と取得失敗の確認: `node tools/toxic-swamp/verify-enemies.cjs`

確認画像: `preview.png`（実描画の一覧）・`codex-mobile.png`・`board-mobile.png`・`battle-mobile.png`。

|原画|ID|名前|
|---|---|---|
|a|`bs_plaguerat`|疫病鼠の大群|
|a|`bs_rotooze`|腐敗の泥|
|a|`bs_bogdrowned`|沼の溺者|
|b|`bs_leechswarm`|ヒルの群体|
|b|`bs_marshlurker`|沼に潜む顎|
|b|`bs_blightmoth`|枯死の大蛾|
|c|`bs_sludgehydra`|汚泥の多頭|
|c|`bs_gasfiend`|毒気の鬼|
|c|`bs_plaguebeast`|疫病の獣|
|d|`bs_discardeddoll`|捨てられた人業|
|d|`bs_fungalcorpse`|キノコまみれの死人|
|d|`bs_miasmawraith`|瘴気の霊|
|e|`bs_venomspider`|猛毒の大蜘蛛|
|e|`bs_necromancer`|死霊術師|
|e|`bs_toxicgolem`|汚泥の巨塊|
|f|`bs_plaguewraith`|疫病の亡霊|
|f|`bs_corpseflower`|屍肉花|
|f|`bs_swamphag`|沼の魔女|
|g|`bs_pestilenceknight`|疫病の騎士|
|g|`bs_plaguelich`|疫病のリッチ|
|g|`bs_swamplord`|よどみの主|
