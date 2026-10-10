# 街の施設の情景の原画 ― 制作の指示書 (Codex 向け)

街の画面の札「酒場」「宿屋」「赤い魂の祠」の絵を、ドット絵から**描き下ろしの高精細な一枚絵**へ替える (2026-10 ユーザーの指示「高画質画像に差し替えて、明かりのゆらめきは残したい」)。

ゲーム側の仕組みはもうある。原画をここへ置いて `python3 tools/townart/build.py` を回せば、そのまま出る:

- `src/townpaint.js` が原画を情景の比率 (16:10) に切り取って高精細に敷き、`points.json` に書いた明かりの位置にだけ、揺らぐ光を重ねる (炉・吊り灯・蝋燭は炎らしく小刻みに、祠の紅い魂はゆっくり脈打つ)。絵そのものは動かさない。
- 同じ絵が、街の札 (ほぼ正方形に切り取られる)・酒場と祠のページの見出し・宿屋のシート・酒場の依頼の報告の背景に出る。
- 原画が無い鍵・読めなかった鍵は、従来のドット絵 (`src/townart.js`) が出る。

## 0. Codex に貼る依頼文

```text
「魂の迷宮（DOS）」の街の施設の絵 (酒場・宿屋・赤い魂の祠) を、ドットではない高精細な描き下ろしの原画で作ってください。

まず docs/art/town/README.md を最初から最後まで読んでください。main を取り込んだ codex/town-art ブランチで作業してください。

・作るのは tavern (酒場「沈まぬ灯」)・inn (宿屋「白狼」)・shrine (赤い魂の祠) の3枚です。描くもの・描かないもの・英語の指示は README の 2〜4 のとおりです。画風は art/story/ の物語の挿絵と同じ世界ですが、ドットの質感を出さない、絵画的で高精細な一枚絵にしてください。参照画像は art/story-review/prologue/road-to-roadal.png (街と画風) と art/story-review/prologue/irene-soul-lamp.png (室内の灯り) を、この順に渡してください。
・どの絵も、街の札ではほぼ正方形に切り取られます。主題 (吊り灯・寝台と狼・紅い魂) は横幅の中央40%に収め、下の2割は暗く落ち着かせてください (札の名前が乗ります)。文字・看板の字・署名は描かないでください。
・3:2 (1536×1024) で作り、docs/art/town/tavern.png・inn.png・shrine.png に置いてください。
・原画で、揺らがせたい明かり (炉の火・吊り灯・蝋燭・紅い魂) の中心を測り、docs/art/town/points.json を書いてください (書式は README の 1.。値は原画の幅・高さに対する割合)。
・python3 tools/townart/build.py を回してください。WebP への変換と、src/townkeyart.js・sw.js への登録をやります。この2つのファイルを手で書かないでください。ゲームのコード (src/ の .js・.css) も変えないでください。原画を art/ の下に置かないでください。
・python3 -m http.server 8000 で http://localhost:8000/?testDungeon=w17&testPlace=town を開き、街の画面の3枚の札を 390×844 と 744×1000 の大きさで撮ってください。酒場の札を押したページの見出しと、祠のページも撮ってください。確かめること: 揺らぐ光が絵の明かりの上に重なっているか / 札の正方形の切り取りで主題が欠けないか / 札の名前が読めるか / 人の手の指・腕の本数 / 文字が入っていないか。
・まず酒場の1枚だけを作って止まり、PR に原画と札のスクリーンショットを載せて、私の確認を待ってください。承認後に宿屋と祠を作ってください。
・mainへのマージは別途指示します。
```

## 1. 置くもの

| ファイル | 中身 |
|---|---|
| `docs/art/town/tavern.png` | 酒場「沈まぬ灯」。3:2 (1536×1024) |
| `docs/art/town/inn.png` | 宿屋「白狼」。3:2 |
| `docs/art/town/shrine.png` | 赤い魂の祠。3:2 |
| `docs/art/town/points.json` | 切り取りの中心と、揺らぐ明かりの位置 |

`points.json` (値はすべて原画の幅・高さに対する割合 0〜1):

```json
{
  "tavern": { "focus": [0.5, 0.48], "lights": [
    { "at": [0.50, 0.22], "r": 0.05, "tone": "lamp" },
    { "at": [0.82, 0.55], "r": 0.09, "tone": "fire" }
  ] },
  "inn": { "lights": [ { "at": [0.40, 0.52], "r": 0.03, "tone": "candle" } ] },
  "shrine": { "lights": [
    { "at": [0.50, 0.40], "r": 0.07, "tone": "crystal" },
    { "at": [0.33, 0.62], "r": 0.025, "tone": "candle" },
    { "at": [0.67, 0.62], "r": 0.025, "tone": "candle" }
  ] }
}
```

| 鍵 | 意味 |
|---|---|
| `focus` | 16:10 に切り取る時の中心 [x, y] (省けば中央) |
| `lights[].at` | 明かりの炎・光の芯の中心 [x, y] |
| `lights[].r` | 光の大きさ (原画の高さに対する半径の割合、既定 0.06)。炎そのものの大きさより少し大きめ |
| `lights[].tone` | `fire` 炉・松明 (大きく揺れる) / `lamp` 吊り灯 (穏やか) / `candle` 蝋燭 (小刻み) / `crystal` 紅い魂 (ゆっくり脈打つ) / `moon` 月光 (ほぼ動かない) |

明かりは1枚に1〜5個。絵の中で光っている所だけに置く (光っていない所に置くと、何も無い所が光って見える)。

## 2. 描くもの

いまのドット絵と同じ場面を、物語の挿絵と同じ世界で描く。どれも夜の室内で、暖かい明かりと冷たい闇の対比。

- **酒場「沈まぬ灯」**: 辺境の街ロアダルの、迷宮帰りの冒険者が集まる古い酒場。天井から鎖で吊るされた鉄の灯籠 (「沈まぬ灯」 — 迷宮から帰らない者のために、店じまいしても消さない灯) が主役で、真ん中の上に。奥の壁に酒瓶の並んだ棚、右奥に石組みの炉の火、手前に長卓と、卓の奥に座る頭巾の客が二人、手前に背を向けた客の肩越しの人影。窓の外は夜。
- **宿屋「白狼」**: 素朴な宿の一室。白狼の毛皮を掛けた寝台が主役で、寝台の足もとに牙を剥いた白狼の頭 (毛皮の頭) が蝋燭のほうを向く。枕元の燭台の蝋燭、月明かりの差す格子の小窓、扉に三本の爪痕。石の床。
- **赤い魂の祠**: 石造りの暗い祠。尖頭アーチの壁龕の中、鉄の環と三本の鉄の帯に抱かれた**紅い魂** (心臓のように脈打つ赤い結晶の光) が主役で、真ん中に。アーチの両肩から鎖が垂れ、段になった台座、その脇に赤い蝋燭が二本、台座のまわりに積まれた頭蓋骨と骨の供物。紅い光が石と骨を下から照らす。

## 3. 画面の決まり

- 3:2 で描くが、ゲームでは 16:10 に、街の札ではさらにほぼ正方形に切り取られる。**主題は横幅の中央40%** に置き、左右の端には大事なものを置かない。
- **下の2割は暗く落ち着かせる** (札の名前と説明が乗る)。
- 人の顔は描きこみすぎない (陰・頭巾・後ろ姿)。いる人は、人の手 (親指＋4本)・腕2本。
- 文字・看板・ロゴ・署名を描かない。

## 4. 英語の指示

前置き (3枚共通):

```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no borders, no text, no letters, no signage, no watermark. Painterly, ultra-detailed high-resolution dark fantasy illustration — NOT pixel art, no pixel or dithered texture; smooth painted light, warm amber light sources against cold deep shadows, cinematic. Same world as the attached Dungeon of Souls illustrations. Keep the main subject inside the central 40% of the width, and keep the bottom 20% dark and calm. Believable hands with a thumb and four fingers, exactly two arms per person.
```

酒場 (tavern):

```text
Interior of an old tavern in a remote frontier town at night, where adventurers back from the labyrinths gather. The hero of the image, upper center: a black iron lantern hanging from the ceiling on chains, glowing warm amber — a lamp that is never put out. Back wall: wooden shelves lined with bottles. Right back: a stone hearth with a roaring fire. Middle: a long heavy wooden table with two hooded patrons sitting behind it, faces in shadow, mugs and a candle on the table. Foreground: the shoulder and back of a patron seen from behind, dark and soft. Night outside a small window. Smoky warm air.
```

宿屋 (inn):

```text
A modest inn room at night. The hero of the image, center: a wooden bed covered with a large white wolf pelt; at the foot of the bed the wolf's head (part of the pelt) bares its fangs, snout turned toward a candle. A single candle in a holder by the pillow gives warm light. A small barred window lets in cold blue moonlight on the left. A heavy wooden door on the right with three deep claw marks. Stone floor, rough plank walls. Quiet, safe, a little eerie.
```

赤い魂の祠 (shrine):

```text
A dark stone shrine at night. The hero of the image, center: inside a gothic pointed-arch wall niche, a pulsing crimson soul — a glowing red crystal like a beating heart — held by an iron ring and three curved iron bands, hanging above a stepped stone pedestal. Chains hang from both shoulders of the arch. Two tall red candles flank the pedestal. Offerings of stacked skulls and bones around the base. The red light from the soul lights the stone and bones from below; everything else falls into cold darkness.
```

## 5. 作業の流れ

1. 原画を描き、`docs/art/town/<鍵>.png` に置く。
2. 原画で明かりの中心を測り、`docs/art/town/points.json` を書く (1.)。
3. `python3 tools/townart/build.py` — WebP を作り、`src/townkeyart.js` と `sw.js` の `ASSETS` の `<<TOWN_ART>>` 欄を書く (手で書かない)。`--check` で食い違いだけを調べられる。
4. `python3 -m http.server 8000` で `?testDungeon=w17&testPlace=town` を開き、街の札・酒場と祠のページ・宿屋のシート (宿屋の札を長押し) を見る。
5. PR にスクリーンショットを載せて、ユーザーの承認を待つ。

## 6. 施設の人物アイコン（追加依頼）

酒場の承認後、ユーザーからグラム・イルザ・祠守の巫女のドットアイコンも高精細な原画へ差し替える依頼を受けた。3人の表示に必要な最小限のゲームコード変更は許可済み。

- 原画: `docs/art/town/keepers/barkeep.png`・`innkeeper.png`・`maiden.png`。正方形の高精細な肩から上の肖像、中央の6:7に切り取っても顔が欠けない構図。
- 参照: 街への道、魂の灯、各人の従来のドット胸像（`<鍵>-reference.png`）の順。
- グラム: 剃り上げた頭、古傷、片眼の眼帯、濃い黒髭、太い首と肩、革の胴着と肩の布巾。
- イルザ: 白狼の頭の毛皮の頭巾、強い顔立ちと古傷、編んだ灰金の髪、毛皮のマント。
- 祠守の巫女: 眼を覆う紅い紗、白い肌、長い黒髪、金の額の帯、下から照らす紅い光。
- ドットの質感・文字・署名なし。手は描かない。
- `python3 tools/townart/build.py` で最大幅640pxのWebPへ変換し、`TOWN_KEEPERART` と `sw.js` を登録する。生成ファイルは手で書かない。
- `keeperCanvas` が480×560の滑らかな静止画で表示。未登録・画像の読み込み失敗は従来のドット胸像へ戻る。他の人物は従来どおり。
- 390×844・744×1000で酒場・宿屋・祠と、胸像を押した人物シートを確認する。施設の明かりの揺らぎは維持する。

## 7. 街の残りの原画（全ドット画像の差し替え）

ユーザーの追加指示で、同じ `src/townart.js` にある人物・情景・紋章をすべて調査し、高精細な原画を登録した。**街の夜景はユーザーが別途制作するため、この変更に含めない。** 既存の酒場・宿屋・祠と3人の肖像は維持する。

新規23枚 = 人物4 + 情景12 + 紋章7。既存6枚を含めゲーム用WebPは29枚。原画はPNGのまま `docs/art/town/` に保存する。出荷するのは `art/town/` のWebPだけ。

| 鍵 | 絵 | 使用場面 |
|---|---|---|
| `king` | 老王 | 勅命・報告などの物語の語り手。通常の対話と旧対話カードの両方 |
| `minister` | 宰相モルデン | 王宮の案内・人物シート。物語の進行後は案内から消える |
| `merchant` | 黒鉄商会ヴォス | 商会の案内・人物シート |
| `binder` | 人形師オルドー | 定義あり。現在の画面からの直接呼び出しなし |
| `palace` | 玉座の間 | 物語の既定背景、出撃のチュートリアル、絵を指定しない物語の見返し |
| `shop` | 黒鉄商会の室内 | 商店のチュートリアルの背景 |
| `mansion` | 人業の館の工房 | 情景APIに定義あり。現在の画面からの固定呼び出しなし |
| `altar` | 魂の祭壇 | 情景APIに定義あり。現在の画面からの直接呼び出しなし |
| `party` | 装備した器の隊 | 同上 |
| `manage` | 器の保管庫 | 同上 |
| `codexMon` | 古書と獣の頭蓋 | 同上（魔物図鑑用の情景） |
| `codexItem` | 古剣・盾・兜 | 同上（品の図鑑用の情景） |
| `codexJob` | 魂の瓶の棚 | 同上（職業図鑑用の情景） |
| `codexAch` | 勲章の展示 | 同上（勲章用の情景） |
| `treasury` | 王冠と宝箱 | 同上（宝物庫用の情景） |
| `abyss`（情景） | 底なしの縦穴と階段 | 同上（奈落用の情景） |
| `gate` | 闇の門 | 出撃シートの未踏破の迷宮 |
| `gateOpen` | 紫の魂火の門 | 出撃シートで選択中の迷宮 |
| `gateDone` | 熾火の門 | 出撃シートの踏破済みの迷宮 |
| `gateSealed` | 格子・鎖・錠前の門 | 出撃シートの未解放の迷宮 |
| `dive` | 髑髏のある墓所の入口 | 下のタブバー中央「迷宮」のボタン |
| `lock` | 錠前 | 定義あり。現在の画面からの直接呼び出しなし |
| `abyss`（紋章） | 紫の光のある穴 | 出撃シートの奈落の入口 |

前の一覧は情景の後半9種類を見落としていた。この表は `VIGNETTES` 全15種類、`KEEPERS` 全6人と王、`ICONS_DEF` 全7種類を調べ直したもの。未使用の原画も登録するが、ゲームの機能や画面は新設しない。

- 情景は1536×1024の原画。従来の120×75と同じ比率の1200×750 canvasへ滑らかに敷く。原画で測った光の芯は `points.json` に割合で記録する。
- 青紫の魂火には `tone: "soul"` を追加。炉・蝋燭・紅い魂など従来の光の種類は維持する。
- 王・宰相は `docs/art/story-refs/king.png`・`morden.png` の基準画像に合わせる。人物は手を描かない肩から上の肖像。王の対話枠は正方形、施設の人物は6:7。
- 紋章の原画は `icons/<鍵>.png`。最大幅384pxのRGBA WebPに変換し、透明背景を維持して元と同じ縦横比のcanvasに収める。門の4状態は同一の石のアーチを基準に作る。
- 登録は `python3 tools/townart/build.py` で生成する。`TOWN_KEYART`・`TOWN_KEEPERART`・`TOWN_ICONART` とSWの `<<TOWN_ART>>` は手で直さない。
- 画像の読み込み失敗時は従来のドット絵へ戻す。夜景の描画と名所の位置は変えない。
- [画面写真・確認記録](review-complete/README.md)。
