# 奉納品61〜80番のWebP原画

`src/catalog/misc.js` の収集品の配列順（道具を除外、1始まり）で61〜80番の20品を描き直した。品の名前・来歴・能力・IDは維持する。

- 原画：`master.png`（画像生成による専用イラスト、5列×4行、左上から配列順）
- 出荷：`art/collectibles/<品ID>.webp`（384×384）
- 変換：`python3 tools/collectibles/build-61-80.py`
- 表示：`src/collectiblephotos.js` で読み込み、装備と同じスプライト差し替え口を通す。対象外の収集品は既存の描画を維持する（41〜60番のWebPも共存）。取得失敗・寸法不一致・4秒の時間切れは既存の固有ドット絵に戻る。
- 確認：HTTPサーバー起動後に `node tools/collectibles/verify-61-80.cjs`。20品の表示・描画内容・対象外88品・画像取得失敗時の復帰を検査する。
- 実描画見本：`game-preview.png`

| 番号 | 品名 | ID |
| --- | --- | --- |
| 61 | 夫を失った女の布 | `m_widows_veil` |
| 62 | 呪われた戦勝貨 | `m_cursed_war_coin` |
| 63 | 錬金術師の残りかす瓶 | `m_alchemist_residue` |
| 64 | こだま貝 | `m_chasm_echo_shell` |
| 65 | 闇のガの粉袋 | `m_void_moth_dust` |
| 66 | 落ちた者の結び縄 | `m_fallen_rope_knot` |
| 67 | 青いちょうちんのガラス | `m_pale_lantern_glass` |
| 68 | 奈落の塩 | `m_abyss_salt` |
| 69 | 水に沈んだたて琴の弦 | `m_drowned_lyre_string` |
| 70 | 水の精のうろこ | `m_nixie_scale` |
| 71 | 潮に縛られた方位磁石 | `m_tidebound_compass` |
| 72 | 海にもぐる女の胸の石 | `m_pearl_diver_lung` |
| 73 | 川の神の涙 | `m_river_god_tear` |
| 74 | 香炉に残った灰 | `m_censer_ash` |
| 75 | 聖歌隊の骨笛 | `m_choir_bone_flute` |
| 76 | 聖者の釘 | `m_reliquary_nail` |
| 77 | 喪のいろガラス | `m_mourning_glass` |
| 78 | 葬送の仮面 | `m_funeral_mask` |
| 79 | すすけた振り香炉 | `m_blackened_thurible` |
| 80 | 竜に挑んだのど当て | `m_knight_gorget` |
