# タイトル画面の原画 ― 制作の指示書 (Codex 向け)

タイトル画面の一枚絵「百の迷宮の門」を、ドット絵から**描き下ろしの高精細な一枚絵**へ替える (2026-10 ユーザーの指示「ドットではない超高品質なオープニング画面」)。

ゲーム側の仕組みはもうある。原画をここへ置いて `python3 tools/titleart/build.py` を回せば、そのままタイトルに出る:

- `src/titlepaint.js` が原画を画面の解像度のまま滑らかに敷き、光と粒子だけを重ねて動かす — ゆっくり寄るカメラ、門の魂火の呼吸 (二度打つ鼓動)、門から立ちのぼる魂の粒、ランタンのゆらぎと火の粉、地を這う霧。画面をタップすると門が閃き、魂の粒が噴き上がる。
- ロゴ「百の迷宮と 魂の王」とメニューは今までどおり DOM で上に重なる。**絵に文字を描かない。**
- 原画が無い間・読めなかった時は、従来のドット絵 (`src/titleart.js`) が出る。

## 1. 置くもの

| ファイル | 中身 |
|---|---|
| `docs/art/title/keyart-tall.png` | 縦長の画面 (スマホ・iPad の縦) 用。縦横 2:3 (1024×1536 以上) |
| `docs/art/title/keyart-wide.png` | 横長の画面 (PC・iPad の横) 用。縦横 3:2 (1536×1024 以上) |
| `docs/art/title/points.json` | 光を重ねる位置 (下の 3.) |

- 2枚は**同じ場面の縦構図と横構図** (片方をもう片方から切り出すのではなく、それぞれの比率で構図を組む)。片方だけでも動く (もう片方の画面には、ある方を切り取って出す) が、両方そろえる。
- 大きいほどよい。画像生成の出力が 1536 までなら、絵を崩さない拡大 (高品質なアップスケーラー) で長辺 2400〜2560 にしてから置く。iPad の縦は画面が約 2000px あるので、1536 のままだと少し甘く見える。長辺 2560 を超える分は build.py が縮める。
- 原画は `docs/` (デプロイで外れる)。ゲームが読むのは build.py が作る `art/title/keyart-*.webp` (品質90、1枚 0.5〜1MB 程度) だけ。

## 2. 描くもの

いまのドット絵と同じ場面を、物語の挿絵 (`art/story/`) と同じ世界・人物で描く。

- **場面**: 月夜の大墓所。奥に、地の底へ降りる尖頭アーチの大門が口を開け、その奥の階段から**青白い緑の魂火** (喰われた魂の光) が這い上がってくる。門の両脇に、**顔のない頭巾の巨像**が剣を地に突き立てて立つ (頭巾の奥は闇、目だけかすかに魂火の色)。傾いだ墓標の列、枯れ木と吊り台、鴉。背後に大きな月と雲。
- **主人公**: 手前に、ランタンを提げた操霊師の弟子がひとり、**背を向けて**門を見上げる。正典 (`docs/art/codex-story-art-brief.md` 2-1 の「弟子」): young adult, tousled brown hair, charcoal-black traveling cloak with restrained geometric gold embroidery all over, brown leather crossbody satchel。持つ灯は**温かい橙**の手提げ灯 (師の青いランタンではない — 2-2)。参照: `art/story-review/chapter4/w14_lamp.png`、`art/story-review/prologue/first-descent-gatekeeper.png`。
- **光は3つだけ**: 門の魂火 (主光・下から、青白い緑)、背後の月 (縁の照り返し、冷たい青紫)、ランタンの火 (温かい橙)。
- **画風**: 物語の挿絵と同じ世界観のまま、**ドット・ピクセルの質感を出さない**、絵画的で高精細なダークファンタジーの一枚絵。

## 3. 画面の決まり (ロゴとメニューのため)

- **上の約3割は静かな夜空** (月と雲だけ。細かい建物・明るいものを置かない) — ロゴがここに乗る。
- **下の約3割は暗く落ち着いた地面** (霧・墓標の影・石畳) — メニューと冒険の記録がここに乗る。
- **門と主人公は中央の帯** (縦の 35〜65%) に置く。縦構図では門を左右の中央に。
- 門の魂火の中心を `points.json` に書く。粒子はそこから湧くので、**門の奥の光る口**の中心を測る。

`points.json` (値はすべて原画の幅・高さに対する割合 0〜1):

```json
{
  "tall": { "gate": [0.50, 0.45], "gateR": 0.06, "lamp": [0.58, 0.68], "lampR": 0.025, "fogY": 0.74 },
  "wide": { "gate": [0.50, 0.44], "gateR": 0.06, "lamp": [0.55, 0.70], "lampR": 0.025, "fogY": 0.76 }
}
```

| 鍵 | 意味 |
|---|---|
| `gate` | 門の魂火の中心 [x, y] (必須) |
| `gateR` | その光の大きさ (原画の高さに対する半径の割合、既定 0.06) |
| `lamp` | ランタンの火の中心 [x, y] (無ければ省く) |
| `lampR` | ランタンの光の大きさ (既定 0.05) |
| `fogY` | 地を這う霧の帯の高さ (既定 0.62。主人公の足元あたり) |

## 4. 描かないもの

- 文字・ロゴ・題名・署名・透かし (読めない走り書きも不要)。
- 窓に明かりの灯る建物・街の灯 (無人の墓所なので。光源は上の3つだけ)。
- 師オルド・イレーヌ・セラ・宰相などの人物、先の章の秘密 (地の底の大樹・奈落など)。
- 主人公の顔 (後ろ姿のまま)。

## 5. 英語の指示

縦構図 (keyart-tall):

```text
Create ONE standalone portrait illustration, aspect 2:3, edge-to-edge, no borders, no text, no letters, no logo, no watermark. Painterly, ultra-detailed high-resolution dark fantasy key art — NOT pixel art, no pixel or dithered texture; smooth painted light, atmospheric depth, cinematic. Same world and characters as the attached Dungeon of Souls illustrations. Scene: a vast moonlit necropolis at night. In the middle of the image, a towering gothic pointed-arch gate descends into the earth; from the stairway deep inside it, pale cyan-green soul-fire light crawls upward and glows out of the gate's mouth. On both sides of the gate stand colossal faceless hooded stone statues with swords planted point-down, only a faint cyan-green glint where eyes would be. Leaning gravestones, a dead gnarled tree with crows, an old gibbet. Behind, a huge pale moon among torn clouds. In the foreground lower-center, a lone young adult apprentice seen from behind looking up at the gate: tousled brown hair, charcoal-black traveling cloak with restrained geometric gold embroidery all over, brown leather crossbody satchel, holding a small hand lantern with a warm orange flame away from the body. Only three light sources: the gate's soul-fire (key light, from below, cyan-green), the moon behind (cold blue-violet rim light), the lantern (warm orange). Composition: the top 30% is a calm dark night sky with only the moon and clouds (a title logo goes there); the bottom 30% is dark quiet ground with mist and grave silhouettes (menus go there); the gate and the apprentice sit in the middle band, the gate horizontally centered. No lit windows, no town lights, no other people.
```

横構図 (keyart-wide): 上の文の `portrait illustration, aspect 2:3` を `landscape illustration, aspect 3:2` に替え、`the gate horizontally centered` の後に `, statues framing it left and right, graves spreading wide to both sides` を足す。

## 6. 作業の流れ

1. 縦・横の原画を描き、`docs/art/title/keyart-tall.png`・`keyart-wide.png` に置く。
2. 拡大版で門の光る口とランタンの火の位置を測り、`docs/art/title/points.json` を書く。
3. `python3 tools/titleart/build.py` — WebP を作り、`src/titlekeyart.js` と `sw.js` の `ASSETS` の `<<TITLE_ART>>` の欄を書く (手で書かない)。`--check` で食い違いだけを調べられる。
4. `python3 -m http.server 8000` で開き、縦・横・スマホの幅でタイトルを見る。確かめること: ロゴとボタンの下が静かで読めるか / 魂の粒が門の口から湧くか / ランタンの光が火の位置に乗るか / 主人公が後ろ姿で正典どおりか / 手の指・文字が無いか。
5. PR に縦・横のスクリーンショットを載せて、ユーザーの承認を待つ。
