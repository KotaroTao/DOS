# 物語の挿絵 ― 修正と新規制作の指示書 (Codex 向け)

2026-10-09、ストーリーの挿絵と本文を全章で照らし合わせた結果をもとにした指示書。Codex はこのファイルだけ読めば作業できるように書いてある。仕様の正本は `CLAUDE.md`。

- **絵の修正と制作は Codex が行う** (この指示書)。
- **本文・絵の割り当て・記録の修正は Claude が済ませた** (このファイルと同じ PR)。Codex は本文を変えない。本文と絵が食い違ったら、絵を本文に合わせる。
- **この指示書は道具が読む** (`tools/storyart/prompt.mjs` が場面ごとの依頼を組み立てる)。見出しの書式 (`**<場面ID>「題」** (種類)`・`**A-n. …**`・表・```text の英語) を崩さない。作業の流れは 1-3。

作業は5つの便に分ける。1便ごとに PR を出し、ユーザーの確認を待ってから次へ進む。**便0 を最初に済ませる** (人物の顔・衣装を1枚の基準に固定してから描くと、場面ごとに人物がぶれず、直しの往復が減る)。

| 便 | 内容 | 枚数 |
|---|---|---|
| 便0 | 人物・小道具の基準シート (場面の絵ではない。出荷しない) | 11枚 |
| 便1 | 既存の絵の修正 (序章〜第4章・踏破後の由来) | 必須 22枚 + 任意 約15枚 |
| 便2 | 第5章・第6章の新規 | 20枚 |
| 便3 | 第7章・第8章の新規 | 22枚 |
| 便4 (任意) | 踏破後の由来の新規 (専用の原画が無い迷宮) | 最大34枚 |

---

## 0. Codex に貼る依頼文

どの便も、作業の流れは同じ (1-3)。**1枚ごとに `node tools/storyart/prompt.mjs <場面ID>` を回し、その出力 (保存先・参照画像・本文・英語の指示) どおりに作る → `python3 tools/storyart/build.py` → PR。** 指示を自分で組み立てない・台帳を手で書かない。

### 便0 (基準シート) の最初に貼る文

```text
「魂の迷宮（DOS）」のストーリーの挿絵で使う、人物と小道具の基準シートを作ってください (便0)。

まず AGENTS.md の「物語の絵」と docs/art/codex-story-art-brief.md を最初から最後まで読んでください。main を取り込んだ codex/story-refs ブランチで作業してください。

・シートごとに node tools/storyart/prompt.mjs ref:<シート名> (例 ref:ordo) を回し、出力の保存先・参照画像・英語の指示どおりに作ってください。
・基準シートは場面の絵ではありません。ゲームには出しません (docs/art/story-refs/ に置くだけ。build.py も要りません)。
・まず ordo (師オルド) だけを、顔立ちや外套の形を少しずつ変えた案3つ (ordo-a.png・ordo-b.png・ordo-c.png) で作り、3つを並べた比較画像 ordo-candidates.png を添えて止まり、私が選ぶのを待ってください。選んだ案を ordo.png にしてから、指示書 2-4 の表の順に残りへ進み、3枚ごとに止まってください。
・docs/art/story-refs/README.md に、シートごとの「名前・元にした絵・状態 (案/承認済み)」の表を書いてください。
・mainへのマージは別途指示します。
```

### 便1 (修正) の最初に貼る文

```text
「魂の迷宮（DOS）」のストーリーの挿絵を修正してください (便1)。

まず AGENTS.md の「物語の絵」と docs/art/codex-story-art-brief.md を最初から最後まで読んでください。main を取り込んだ codex/story-art-fix ブランチで作業してください。

・直す絵の一覧は node tools/storyart/prompt.mjs --chapter <章> で出ます (序章は 0)。1枚ごとに node tools/storyart/prompt.mjs <場面ID> を回し、出力どおりに直してください (直す元の絵を最初の参照画像として渡し、指示した所だけを直す。構図・人物・画風・光は保つ)。
・本文 (src/story.js・src/archive-stories.js・src/journal.js) は変えないでください。絵を本文に合わせます。
・直したら原画を同じ名前で上書きし、修正前を art/story-review/fixes/<場面ID>-before.png に残し、指示書の修正の項目の見出しの末尾に「(済)」を付けてください。
・何枚か直したら python3 tools/storyart/build.py を回してください (変換・登録・確認ページ・検査を全部やります)。
・まず A-1〜A-3 だけを終えたら止まり、PR に art/story-review/review/chapter0.md・chapter1.md と修正前後の比較を載せて、私の確認を待ってください。承認後に残りへ進んでください。
・mainへのマージは別途指示します。
```

### 便2・便3 (第5〜8章の新規) の最初に貼る文

```text
「魂の迷宮（DOS）」第五章・第六章のストーリーの挿絵を新しく作ってください (便2)。

まず AGENTS.md の「物語の絵」と docs/art/codex-story-art-brief.md を最初から最後まで読んでください。main を取り込んだ codex/story-art-ch5-6 ブランチで作業してください。

・作る場面の一覧は node tools/storyart/prompt.mjs --chapter 5 (第六章は 6) で出ます。1枚ごとに node tools/storyart/prompt.mjs <場面ID> を回し、出力の保存先・参照画像 (この順に渡す)・本文 (一覧とゲーム内の両方)・英語の指示どおりに作ってください。
・原画を保存したら python3 tools/storyart/build.py を回してください。WebP への変換・ゲームへの登録・確認ページ (art/story-review/review/chapter5.md)・縮小の見本・検査を全部やります。台帳や sw.js を手で書かないでください。
・まず w18_blade・report_w18・irene_husks の3枚だけを作って止まり、PR に art/story-review/review/chapter5.md と chapter5-small.jpg を載せて、私の確認を待ってください。承認後に残りを作ってください。
・mainへのマージは別途指示します。
```

便3 は上の文の「第五章・第六章」を「第七章・第八章」、ブランチを `codex/story-art-ch7-8`、章の番号を 7・8、最初の3枚を `w26_splint`・`report_w26`・`irene_crest` に置き換える。

### 便4 (任意) の最初に貼る文

```text
踏破した迷宮の由来の絵を作ってください (便4)。AGENTS.md の「物語の絵」と docs/art/codex-story-art-brief.md の「5. 便4」を読み、codex/story-art-lore ブランチで作業してください。迷宮ごとに node tools/storyart/prompt.mjs lore_<迷宮ID> を回して作り、python3 tools/storyart/build.py を回してください。最初に表の上から3迷宮だけ作って止まり、PR に art/story-review/review/dungeons.md を載せて確認を待ってください。
```

---

## 1. 共通の決まり

### 1-1. 画風 (全便共通の前置き)

これまでの承認済みの原画 (`art/story/chapter1/`〜`chapter4/`) と同じ画風。画像生成には毎回、次の前置きを付ける。

```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
```

### 1-2. 画面の決まり

- 1536×1024 (3:2)。ゲームでは縦が画面の4割まで、幅が最大576pxで表示されるので、**主題は中央の帯に置き、384×256 に縮めても読めること**。
- 文字は描かない (書きつけ・帳面・銘・札はすべて読めない走り書き)。
- 無人のはずの場所 (迷宮・廃墟) に、灯った吊り灯・窓に明かりの灯る建物・橋や水車の集落を描かない。光源は、魂火・溶岩・極光・雷・隊の手提げ灯など、その場にあって不自然でないものにする。これまでの原画では無人の地下に集落が描かれがちだった (第三章 w10_rope・w11_hut・w12_torso など)。新しい絵では避ける。
- 先の章の秘密を背景に紛れ込ませない (各場面の「描かないもの」を守る)。

### 1-3. 作業の流れ (自動化の決まり)

人の手が要るのは「描く」と「承認する」だけ。それ以外は道具が行う。

| 段 | だれ | すること |
|---|---|---|
| ① 本文と指示 | Claude | 場面の本文 (`src/archive-stories.js` の `scene()`・`src/story.js`) を書いたら、同じ PR で指示書 4章に、その場面の指示 (見出し・箇条書き・英語の指示) を足す。足し忘れは CI (`prompt.mjs --check`) が止める |
| ② 依頼の組み立て | 道具 | `node tools/storyart/prompt.mjs <場面ID>` が、保存先・参照画像 (基準シートがあればシート、無ければ元にする絵)・本文 (一覧とゲーム内)・描くもの/描かないもの・英語の指示 (前置き込み) を出す。修正は出荷済みの絵に指示書 3章の項目があれば自動で修正の依頼になる。まとめて見るなら `--chapter N`、由来は `lore_<迷宮ID>`、基準シートは `ref:<名前>` |
| ③ 描く | Codex | ②の出力どおりに作り、原画 PNG (1536×1024) を出力の保存先に置く。修正は同じ名前で上書きし、指示書の項目に「(済)」を付ける |
| ④ 仕上げ | 道具 | `python3 tools/storyart/build.py` 一つで、変わった原画だけを WebP (品質88) にし、ゲームへ登録 (`src/storyimages.js`・`sw.js` の `ASSETS`)、確認ページ `art/story-review/review/chapterN.md` (絵と本文の見比べ)・進み具合 `status.md`・縮小の見本 `chapterN-small.jpg` を書き、検査まで回す |
| ⑤ 確認 | Codex → ユーザー | PR に確認ページと縮小の見本を載せて止まる。CI「物語の絵の検査」が登録の漏れ・作り直し忘れ・指示書との食い違いを調べる |
| ⑥ 承認 | ユーザー | PR を main へ取り込めば、そのまま遊ぶ人に届く (登録は済んでいる)。直しの指示は ③ に戻る |

決まり:
- **手で書かないもの**: `src/storyimages.js`、`sw.js` の `<<STORY_ART>>` の欄、`tools/storyart/masters.json` (原画ごとのハッシュ = どの原画から WebP を作ったかの記録)、`art/story-review/review/` の確認ページ。どれも build.py が書く。`sw.js` の `const CACHE = "dos-dev"` も書き換えない。
- **置き場所 = 登録**: 原画 `art/story-review/chapterN/<場面ID>.png` → 出荷 `art/story/chapterN/<場面ID>.webp`。序章は `prologue/` (名前と場面IDの対応は `tools/storyart/register.mjs` の `PROLOGUE`)、由来は `dungeons/lore_<迷宮ID>.png`。場面ID と章は `src/archive-stories.js` の `scene("<場面ID>", N, …)` と一致させる (違えば build.py が止まる)。
- 原画は `art/story-review/` (デプロイで外れる)、ゲームが読むのは `art/story/` の WebP だけ。GitHub Pages は 1GB まで (デプロイは 800MB で止まる)。原画・比較画像・案を `art/story/` に置かない。
- 直しを待つ原画は `tools/storyart/hold.json` の `hold` (いまは由来の w14・w16。build.py は変換しない)、物語の絵ではない原画 (一覧の見本・参照) は `skip`。直し終えたら `hold` から外す。
- ストーリー一覧に無い、ゲーム内だけの場面 (館の語り `irene_abyss` など) には絵を付けられない。付けたい時は Claude に一覧の場面を足してもらう。
- 遊ぶ人の端末は、進めている章までの物語の絵と、地図に現れた迷宮の由来の絵だけを裏で先に集める (`sw.js` の warmMedia ← `src/journal.js` の `storyMediaUrls`)。先の章の絵を足しても、まだそこへ着いていない人の通信は増えない。
- 1便ごとに1つの PR。最初の数枚で止まって承認を待つ (各便の依頼文)。Pillow (`pip install pillow`) と Node 22 が要る。

### 1-4. 確かめること (1枚ごと。build.py が見ないもの)

1. prompt.mjs の本文 (一覧用とゲーム内用の両方) を読み直し、各場面の「描くもの」がすべて入り、「描かないもの」が無いこと。
2. 人物が正典 (2章) と基準シート (2-4) と同じに見えること。顔・髪・衣装・持ち物。
3. 手の指 (親指＋4本)、腕と脚の本数。
4. 縮小の見本 (`chapterN-small.jpg`) で主題が読めること。
5. 文字が入っていないこと (書きつけは読めない走り書き)。

## 2. 正典 ― 人物・小道具・時の流れ

本文と承認済みの原画から決めた。**ここに書いたことが、これまでの絵とずれていたら、ここが正しい。**

**便0 が済んだら、人物・小道具の参照には `docs/art/story-refs/` の基準シート (2-4) を最優先で渡す。** 下の表の右の列は、そのシートの元にした絵 (シートができるまではこちらを渡す)。

### 2-1. 人物

| 人物 | 姿 (英語の指示に入れる) | 基準画像 (参照として渡す) |
|---|---|---|
| 弟子 (プレイヤー) | young adult, tousled brown hair, charcoal-black traveling cloak with restrained geometric gold embroidery all over, brown leather crossbody satchel; usually seen from behind or in profile | `art/story-review/chapter3/report_w13.png`、`art/story-review/chapter4/w14_lamp.png` |
| イレーヌ (館の主・人業) | long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves; calm, gentle. **第一章 irene_reveal より前の絵では手首の継ぎ目を見せない** | `art/story-review/chapter2/irene_roots.png`、`art/story-review/chapter1/irene_familiar.png` |
| 王 | very old man, long white hair and long white beard, pointed gold crown, red robes, white ermine cape with black spots | `art/story-review/chapter3/report_w12.png` |
| 宰相モルデン | **一人の同じ顔**: long gaunt pale face, sunken dark eyes, thin enigmatic smile, tall black-purple ceremonial hat with a gold band, red inner robe, heavy gold chain of office with a red jewel. **老いない** (しわ・白髪を足さない。三百年前の記憶でも同じ顔)。正体は人業 = 胸に小さな扉があり、中で古い魂の灯が揺れている (第五章 mem_w21 で初めて見せる。それより前の絵では見せない) | `art/story-review/prologue/morden-at-throne.png`、`art/story-review/chapter3/report_w13.png` |
| セラ (師の作った人業) | **ユーザーの指示: 髪は本物の髪。** 職業「灯守」の原画が基準: long wavy very dark brown (near-black) real hair, wooden face with visible wood grain and carved features, brown eyes, small gold lamp-on-palm crest in the center of the forehead, black-iron joint bands with gold rims at shoulders/elbows/wrists/knees/ankles, black choker with a gold setting. 目覚めた後 (第四章の終わり以降) は white draped cloth with a brown sash、胸に青白い魂火の灯。目覚める前 (第二〜四章) は部品だけで、胸に灯は無い。花の髪飾り・星形の印にしない | `docs/art/sera/sera-r1-final.png` (必ず渡す)、`docs/art/sera/source-comparison.png` |
| 師オルド | **まだ決まった絵が無いので、ここで決める。弟子と見分けがつくこと**: human man about 55, tall and lean, weathered face, short grey hair swept back, close-cropped grey beard, deep-set grey eyes; plain worn black long travel coat **without** the apprentice's all-over gold embroidery — only one small gold-thread lamp-on-palm crest on the hem; dark grey shirt, leather belt with doll-maker's tools (chisel, awl, small mallet), leather work gloves; **no satchel, no lantern**. 章ごとの持ち物は下の 2-3 | `docs/art/story-refs/ordo.png` (便0 で最初に作る) |
| ヴェルナー (師の師) | elderly human scholar, grey hair, worn ochre-brown robes。第三章の小屋の時点で、もう骸 | `art/story-review/chapter3/w11_hut.png` (顔立ちだけ) |
| 凍王イザーク | 三百年前、王家に最初に仕えた操霊師。gaunt man frozen into a throne of ice, frost-white robes, a crown of ice shards, half embedded in the throne; stern but kind eyes | なし |
| 最初の操霊師 (一門の祖) | 名は伏せる。very old frail man, long white hair, dark robe with the lamp-on-palm crest; 顔ははっきり描きすぎない (陰・後ろ姿・伏せた顔) | なし |
| 人業 (隊の仲間) | adult-sized wooden articulated dolls, **blank smooth round wooden heads with no carved face**, black iron joint bands. 隊の基本4体: warrior (red cloak, round shield), priest (white robe, staff), thief (dark leather, dagger), mage (purple robe, staff)。第五章以降はセラが加わることもある (任意) | `art/story-review/prologue/four-vessels-departure.png`、`art/story-review/chapter3/w10_rope.png` |

### 2-2. 小道具と印

| もの | 決まり |
|---|---|
| 一門の印「灯を掌に載せた手」 | an open hand, palm up, holding a single small teardrop flame。**ユーザー承認: 幾何学案の最初のC**。基準: `docs/art/story-refs/sigil.png`。Use the approved geometric crest exactly: an angular cupped palm with one thumb on the left and three parallel finger projections on the right, a short wrist below, and one separate teardrop flame above. Keep four digit projections in this abstract symbol; do not add a fourth finger on the right. 人物の実際の手は親指と4本の指。旧 `art/story-review/chapter1/w02_sigil.png` は意味の参照。四芒星・十字・花・ランタンの線画にしない |
| 印の場所 | セラ = 額の中央 (金)・手首の内側 (小)・肘の継ぎ目の内側 (小)・胴の**背**・くるぶしの内側。師の外套 = 裾の刺しゅう。器の捨て場の器 = 胸の扉の内側。塔の鐘 = 内側の縁にぐるりと浮き彫り |
| 館の灯 (師の魂の灯) | **燭台に立てた一本の白い蝋燭** (brass candlestick, single white candle, warm flame)。ガラスの灯器・青い炎の器にしない。基準: `art/story-review/prologue/irene-soul-lamp.png`、`art/story-review/chapter2/irene_roots.png` |
| 師のランタン | small brass hand lantern with a pale blue soul-fire inside。基準: `art/story-review/chapter1/w01_lantern.png`。**師は第一章の地下墓地の墓石の上にこれを残して先へ進んだ**。以後、記憶の中の師も、師に従う者も持っていない。弟子が拾い、館に置かれ、第四章でイレーヌがその火をセラの胸へ移す |
| 弟子の手提げ灯 | 迷宮で弟子が持つ灯は、師のランタンと見分けられる温かい橙の灯にする (新しい絵から) |
| 宰相の席 | 玉座の脇の椅子。第四章以降はいつも**空**。宰相は第三章の報告 (report_w13) を最後に玉座の間に現れない |
| 王の杯 | 金の杯。第三章 report_w12 で王は手を伸ばさなくなり、第五章 report_w20 で玉座の脇の床に置く |

### 2-3. 時の流れ

| 章 | 王 | 玉座の間の窓の外 | 師オルド (記憶の中) |
|---|---|---|---|
| 第三章の終わり〜第四章 | 一晩で髪がさらに白くなり、やつれていく | 夜の王都 | 研いだのこぎりのような刃を持つ (第三章で大樹の根を断った刃) |
| 第五章 | 玉座の間が暑く、額をぬぐう (w18)。杯を床に置く (w20)。釜の火が消えて指先が冷える (w21) | 重い雲 | 傷だらけ・煤だらけ。刃は w18 の扉に残して、もう無い |
| 第六章 | 膝掛けを掛け、寒そうに手を組む | 重い雲 | 奈落へ落ち、脚を折る。外套は氷棚に残したので外套が無い (シャツだけ)。凍王に氷で脚を固めてもらう |
| 第七章 | 膝掛け。考えこむ | 重い雲 | 氷の添え木が溶け、捨てられた人業の腕の木2本を縄で束ねて脚を固め直す。片脚を引きずる |
| 第八章 | 膝掛け。窓の外の雲を見る | 重い雷雲・稲妻 (この百年、王都の空はいつも重かった) | 添え木を削った杖をつく → 杖は雷に焼かれて踊り場に残す → 杖なしで手すりの鎖をつかんで頂へ這い上がる |
| 第八章 report_w33 以降 | 窓辺で空を見上げる | **百年で初めての青空** (朝) | ― |

---

### 2-4. 便0 ― 人物・小道具の基準シート

場面ごとに既存の絵を参照に渡すと、構図や光まで引きずられ、顔と衣装は少しずつぶれていく。そこで、人物・小道具ごとに1枚の基準シートを作り、以後のすべての便でこれを参照画像として渡す。

- 置き場所: `docs/art/story-refs/<名前>.png` (デプロイで外れる。`sw.js`・`src/` には登録しない)。一覧と承認の状態は `docs/art/story-refs/README.md`。
- 形: 1536×1024 (3:2)、1-1 の画風。背景は無地の暗い灰青、光は左上からの柔らかい均一な光 (場面の光にしない)。文字・ラベル・寸法線は入れない。
- 人物のシート: 左から **正面・斜め前・横・後ろ** の全身を同じ大きさで並べ、右上に**顔のアップ** (正面と斜め)、右下に**持ち物・印のアップ**。
- 小道具のシート: 一つずつ、正面と斜めの2方向。
- 1枚目 (ordo.png) で止まって確認を待つ。以後も、ユーザーが承認したシートだけを参照に使う。

各シートに付ける英語の指示 (1-1 の前置きの後に):
```text
Character reference sheet on a plain dark slate-blue background with soft even light from the upper left. Full body shown four times at the same scale, left to right: front, three-quarter front, side profile, back. Upper right: two face close-ups (front and three-quarter). Lower right: close-ups of the items and crests listed below. No text, no labels, no measurement lines, no scenery.
```

| シート | 中身 (2-1・2-2 の正典の文を英語の指示に入れる) | 元にする絵 (参照として渡す) |
|---|---|---|
| ordo.png | 師オルド (いつもの姿)。アップ = 外套の裾の金糸の印・腰の道具 (のみ・きり・小槌)・革の手袋 | なし (正典の文から作る) |
| ordo-states.png | 師オルドの章ごとの姿を横に4つ: 第五章 (煤と傷・刃なし) / 第六章 (外套なし・シャツ・氷で固めた脚) / 第七章 (人業の腕の木2本を縄で束ねた添え木・片脚を引きずる) / 第八章 (添え木を削った杖) | ordo.png (承認後) |
| apprentice.png | 弟子。顔は前髪の陰で目元を出しすぎない。アップ = 外套の金の刺しゅう・斜めがけの革鞄・温かい橙の手提げ灯 | `art/story-review/chapter3/report_w13.png`、`art/story-review/chapter4/w14_lamp.png` |
| irene.png | イレーヌ。**手首はレースの袖口で隠し、継ぎ目を見せない** (継ぎ目は irene_reveal 以後の場面の指示で描く)。アップ = 金と紫の髪飾り | `art/story-review/chapter2/irene_roots.png`、`art/story-review/chapter1/irene_familiar.png` |
| sera.png | 目覚めた後のセラ (白い布・茶の帯・胸の青白い魂火)。アップ = 額の金の印・本物の髪・継ぎ目の黒鉄と金の縁 | `docs/art/sera/sera-r1-final.png` (必ず) |
| king.png | 王。右下のアップの代わりに、時の流れ (2-3) の3段: 第三章までの姿 / 第四章の、さらに白くやつれた姿 / 第六章以降の膝掛けの姿 | `art/story-review/chapter3/report_w12.png` |
| morden.png | 宰相モルデン (老いない一人の顔)。**胸の扉は閉じたまま** | `art/story-review/prologue/morden-at-throne.png`、`art/story-review/chapter3/report_w13.png` |
| morden-chest.png | モルデンの胸の小さな扉を開けた上半身と、中で揺れる古い魂の灯のアップ。**第五章 mem_w21 以後の場面にだけ渡す** | morden.png (承認後) |
| dolls.png | 隊の人業4体 (戦士・僧侶・盗賊・魔導士) を正面と後ろで並べる。顔の無い丸い木の頭・黒鉄の継ぎ目 | `art/story-review/prologue/four-vessels-departure.png`、`art/story-review/chapter3/w10_rope.png` |
| ancients.png | 凍王イザーク (氷の玉座に半ば埋もれた姿) と、最初の操霊師 (顔は陰で伏せる)。第六章・第七章から使う | なし (正典の文から作る) |
| props.png | 小道具: 館の燭台の一本の白い蝋燭 / 師の真鍮のランタン (青白い魂火) / 弟子の手提げ灯 (温かい橙) / 一門の印を3つの質感で (石の浮き彫り・金糸の刺しゅう・額の金の象嵌) / 王の金の杯 | `art/story-review/prologue/irene-soul-lamp.png`、`art/story-review/chapter1/w01_lantern.png`、`art/story-review/chapter1/w02_sigil.png` |

---

## 3. 便1 ― 既存の絵の修正

既存の画像を参照画像として渡し、指示した所だけを直す (`prompt.mjs <場面ID>` が直す元の絵を最初の参照に入れる)。直し終えた項目は、見出し (A) か行 (B) の末尾に「(済)」を付ける — `prompt.mjs --chapter` と確認ページが、残りの修正だけを数える。各項目の「保つもの」は変えない。英語の指示は、1-1 の前置きを付けたうえで、`Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except:` に続けて書く。

### A. 必須 (物語の筋や正典と食い違う)

**A-1. 序章 irene_repair「砕けても、名は消えない」** `art/story-review/prologue/irene-repair.png` (済)
- 直す: 作業台の外れた人業の頭と、棚の人業に目鼻が彫られている → 人業の頭は何も彫られていない丸い木 (`src/story.js` の館の語り「人業の頭は、もとは何も彫られていない、丸い木なのです」)。
- 保つもの: 砕けた魂の結晶、イレーヌ、弟子。
```text
...except: the detached doll head on the workbench and every doll on the shelves must have a blank, smooth, round wooden head with NO carved eyes, nose, mouth or face markings at all.
```

**A-2. 第一章 report_w03「封じた者の沈黙」** `art/story-review/chapter1/report_w03.png` (済)
- 直す: 宰相が別人 (茶髪の壮年の顔・司教冠) → 正典のモルデン。基準画像 `art/story-review/prologue/morden-at-throne.png` と `chapter1/report_w01.png` を渡す。
- 保つもの: 王が目をそらし、宰相が横目で王を盗み見る構図。
```text
...except: replace the chancellor with the exact chancellor Morden from the reference: long gaunt pale ageless face, sunken dark eyes, thin enigmatic smile, tall black-purple ceremonial hat with a gold band, red inner robe, heavy gold chain with a red jewel. He still glances sideways at the king.
```

**A-3. 第一章 w02_sigil「水音の向こうへ」** `art/story-review/chapter1/w02_sigil.png` (済)
- 直す: 本文は「格子の錠には鍵が挿したままになっていた。札に一言」。いまの絵は錠も札も無く、鍵が縁石に置いてある → 鉄格子に錆びた錠前を付け、鍵を挿したままにし、鍵に小さな紙の札を結ぶ。
- 保つもの: 壁の一門の印、その下の鉄格子と水路。
```text
...except: add a rusted iron padlock on the grate with an old key still inserted in it, and a small paper tag tied to the key with a string (illegible scribble). Remove the loose key lying on the ledge.
```

**A-4. 第一章 w04_arm「黒い流れが返したもの」** `art/story-review/chapter1/w04_arm.png` (済)
- 直す (1): 弟子を支える人業が、箱形の兜のような頭に弟子と同じ外套を着ている → 隊の4体の一人 (赤い外套の戦士) に。頭は何も彫られていない丸い木。
- 直す (2): 腕の印が前腕の外側に大きく渦巻きの手 → **手首の内側に小さく**、掌に炎を載せた手 (`w02_sigil.png` の印)。
- 保つもの: 黒い流れ・格子・腕を引き上げる弟子。
```text
...except: the wooden doll steadying the apprentice becomes the party's warrior doll: blank smooth round wooden head with no face, black iron joints, red cloak, round shield on its back. On the recovered wooden arm, remove the large carving on the outer forearm; instead carve a small crest on the INNER WRIST: an open palm-up hand holding a small flame, exactly like the wall sigil reference.
```

**A-5. 第一章 mem_w03「止められても進んだ人」** `art/story-review/chapter1/mem_w03.png` (済)
- 直す (1): 師に従う人業が、師のランタンと同じ形のランタンを提げている → 師はランタンを地下墓地に残した後なので、別の灯にする。本文は「灯を抱いて従っていた」 → 両腕で小さな真鍮の皿灯 (炎は温かい橙) を胸に抱える。
- 直す (2): その人業はセラ (第二章で師と一緒だったと分かる)。正典のセラの姿にする (本物の長い黒髪・木の顔・額の印・黒鉄の継ぎ目。この時はまだ壊れていない。白い布の衣)。基準 `docs/art/sera/sera-r1-final.png`。
- 直す (3): 師を正典のオルドに (弟子と同じ外套・鞄にしない。ランタンを持たない。腰に刃)。
- 直す (4): 祭壇のすぐ脇の鎖を巻いた坑口の扉・トロッコの線路を消す (坑口は別の迷宮)。
- 保つもの: 修道院の祭壇、止める修道院長、去っていく二人の構図。
```text
...except: (1) the doll following the man is Sera exactly as in the attached Sera reference (long wavy near-black real hair, carved wooden face, small gold palm-and-flame crest on the forehead, black iron joints, simple white draped cloth); she cradles a small brass dish lamp with a warm amber flame in BOTH arms against her chest — not a hanging lantern, no blue fire. (2) the man is master Ordo: about 55, lean, short grey hair, close-cropped grey beard, plain worn black long coat with only one small gold crest on the hem, leather tool belt, a long serrated saw-like blade at his hip; no satchel, no lantern. (3) remove the chained mine door and the cart rails beside the altar; replace with plain abbey wall.
```

**A-6. 第二章 irene_sera「眠りを守る二つの手」** `art/story-review/chapter2/irene_sera.png` (済)
- 直す (1): 本文は頭だけ (腕は寄り道で見つかるとは限らない) → 台の上の木の腕を消す。布の盛り上がりが全身に見えないよう、頭だけを柔らかい布で包んで枕に載せる形に。
- 直す (2): セラの額の印が四芒星 → 掌に炎を載せた手 (小さく金)。髪は本物の髪のまま、色を正典 (ほぼ黒の焦げ茶) に寄せる。
- 直す (3): 棚の人業の頭に顔が彫られている → 何も彫られていない丸い木。
- 保つもの: 頭に手を添えるイレーヌ、燭台の蝋燭、奥の弟子。
```text
...except: (1) remove the wooden arm from the table; Sera is ONLY a detached head resting on a small pillow, wrapped loosely in soft cloth around the neck, with nothing under the sheet that suggests a body. (2) her forehead crest becomes a small gold open palm-up hand holding a flame; her real wavy hair is near-black dark brown like the attached Sera reference. (3) all heads on the background shelves are blank smooth round wooden heads with no faces.
```

**A-7. 第二章 w07_sera「声の残る独房」** `art/story-review/chapter2/w07_sera.png` (済)
- 直す: 頭を包む布が体ほどの大きさで画面下まで垂れている → 頭だけの大きさに。金の花の髪飾りを外し、額の印を正典の形に。髪の色を正典に寄せる。
- 保つもの: 独房・壁の名・弟子が頭を抱き上げる構図。
```text
...except: the cloth bundle is only the size of a single head (no body shape under it); remove the gold flower hair ornament; the forehead crest is a small gold open palm-up hand holding a flame; her real wavy hair is near-black dark brown like the attached Sera reference.
```

**A-8. 第二章 宰相の姿をそろえる** `art/story-review/chapter2/report_w06.png`・`report_w07.png`・`report_w08.png` (済)
- 直す: report_w06・w07 の宰相は屍のように老けて見え、本文の「歳月の跡が見えない」「白髪の一本も無い頭」と逆。report_w08 は帽子も顔も別人 → 3枚とも正典のモルデン (老いない、やせて青白いが、しわ・たるみ・筋張った首を描かない)。
- 保つもの: 各場面の構図と宰相の仕草。
```text
...except: the chancellor must be exactly Morden from the attached reference (morden-at-throne.png): gaunt pale but AGELESS face with smooth unlined skin, no wrinkles, no sagging, no grey hair, sunken dark eyes, thin smile, tall black-purple hat with a gold band, red inner robe, gold chain with red jewel. Keep his pose.
```

**A-9. 第二章 w09_map「百の井戸」** `art/story-review/chapter2/w09_map.png` (済)
- 直す: 本文は「迷宮のある場所に、ひとつずつ黒い印」「王都の真ん中の井戸がひとつだけ、赤い墨で囲まれていた」(寄り道の迷宮「王都の古井戸」につながる要)。いまの絵は光る城の立体模型で、赤い囲みが無い → 卓上の古い地図に黒い墨の点を打ち、王都の中央の井戸を赤い墨の丸で囲む。地図の線が中央へ集まる構図は保つ。
```text
...except: the dungeons on the war-table map are small black ink dots on parchment, not glowing 3D castle models; at the very center of the capital a single well is circled boldly in red ink. Keep the lines converging toward the center.
```

**A-10. 第三章 irene_torso「お帰りを重ねる仕事」** `art/story-review/chapter3/irene_torso.png`
- 直す: セラの頭が髪の無い丸い頭 → 正典のセラの頭 (本物の長い黒髪・木の顔・額の印)。胴の印を胸から外す (印は背中)。
- 保つもの: 台の上の頭・腕1本・胴 (脚は無い)、手紙を読むイレーヌ、弟子。
```text
...except: the wooden head on the velvet is Sera's head exactly as in the attached Sera reference: long wavy near-black real hair spread on the velvet, carved wooden face with closed eyes, small gold palm-and-flame crest on the forehead. Remove any emblem from the front of the torso.
```

**A-11. 第三章 w12_torso「軽すぎる帰りの荷」** `art/story-review/chapter3/w12_torso.png`
- 直す: 胴の胸に星形の紋 → 外す。本文は「背に彫られた、灯を掌に載せた手」なので、胴を少し回して背の印 (掌に炎) が見えるようにするか、胸は無地に。胸の扉と中の紙は保つ。
```text
...except: remove the star-shaped emblem from the torso's front; if the back is visible, carve the small palm-up hand holding a flame there. Keep the open chest hatch with the folded paper inside.
```

**A-12. 第三章 mem_w13「魂の流れを登る師」** `art/story-review/chapter3/mem_w13.png`
- 直す: 師がランタンを提げ、外套・鞄が弟子と同じ → 正典のオルド (ランタンなし。右手に根を断ったのこぎりのような刃)。
- 判断: 上端の玉座の間は、本文では直後の報告で王が明かす。小さく遠くに見える程度なら残してよい。
```text
...except: the climbing man is master Ordo: about 55, lean, short grey hair, close-cropped grey beard, plain worn black long coat with only one small gold crest on the hem, leather tool belt; no satchel and NO lantern; he grips a long serrated saw-like blade in one hand while climbing. Light comes from the rising cyan soul streams around him.
```

**A-13. 第三章 w11_hut「三代の師弟が残す頁」** `art/story-review/chapter3/w11_hut.png`
- 直す: ゲーム内の本文は「苔むした石の小屋」「机に突っ伏した骸」。ヴェルナーはオルドが訪ねる前に亡くなっていた (1年以上前)。いまの絵は整った木の部屋で、生きて眠る老人に見え、蝋燭が灯っている → 苔むした石の小屋に。ヴェルナーは机に突っ伏した**骸** (乾いて骨ばった手、くぼんだ顔、ほこりと苔。むごくしない)。部屋の蝋燭は消え、光は弟子の灯と窓の外の魂の光だけ。窓の外に灯の集落を描かない。
- 保つもの: 手記を読む弟子、三代の書き込みのある手記、大樹の根の素描。
```text
...except: the hut is a small moss-covered STONE hut, long abandoned, dust and moss everywhere, no lit candles. Werner is a long-dead body slumped face-down over the desk: dried skeletal hands, sunken features under grey hair and worn ochre robes, peaceful and not gory. Light comes only from the apprentice's warm hand lantern and faint cyan soul-light outside. Remove the lantern-lit walkways and dwellings outside the window; only dark giant roots and mist.
```

**A-14. 第三章 ch3_end「帰る場所から、玉座の下へ」** `art/story-review/chapter3/ch3_end.png`
- 直す: 館の灯が大きなガラスの灯器に青い炎 → 燭台に立てた一本の白い蝋燭。本文は「ひときわ高く燃え上がった」ので、炎を高く明るく。
```text
...except: replace the large glass vessel with blue fire by a single white candle on a tall brass candlestick; its warm flame burns unusually high and bright. Irene stands beside it.
```

**A-15. 第四章 mem_w17「水の底の戴冠」** `art/story-review/chapter4/mem_w17.png`
- 直す: 本文は「幹を昇ってきた男が、王の前に膝をついた。手には、根を断った刃だけを握っていた」。いまの絵は立ったまま、師のランタンを提げ、刃が無く、弟子と同じ外套 → 正典のオルドが神官王の前に片膝をつき、右手にのこぎりのような刃だけを握る。ランタンを消す。
```text
...except: the man is master Ordo (about 55, lean, short grey hair, close-cropped grey beard, plain worn black long coat with one small gold crest on the hem, no satchel), kneeling on one knee before the priest-king, holding ONLY a long serrated saw-like blade in his right hand. Remove the lantern entirely.
```

**A-16. 第四章 w15_mural「老いない横顔」** `art/story-review/chapter4/w15_mural.png`
- 直す (1): 壁画の若い神官が、いまのモルデンと「一つも変わらない」顔に見えない → 正典のモルデンと同じ顔 (やせて青白く、薄い笑み)。白い法衣の若い神官として描き、苗木を抱く。
- 直す (2): 冠を授ける王が、いまの王そっくり → 三百年前の神官王 (白と金の法衣、`chapter4/mem_w17.png` の神官王と同じ)。泉の前で冠を掲げる。
- 直す (3): 地下なのに満月の夜空 → 窓を消すか、水没した暗い神殿の壁に。
- 直す (4): 絵の隅に師の短い書き込み (読めない走り書き) を添える。
```text
...except: (1) the young priest in the mural has exactly Morden's face from the attached reference (gaunt, pale, thin smile) but younger clothing: plain white priestly robes, holding a sapling. (2) the crowning king in the mural is the ancient priest-king in white and gold vestments like the attached mem_w17 reference, raising a crown before a sacred spring — NOT the present white-bearded king in red and ermine. (3) remove the window with the moon and night sky; this temple is drowned underground. (4) add a small handwritten scribble in a corner of the mural.
```

**A-17. 第四章 irene_sera_wake「灯が移った夜明け」** `art/story-review/chapter4/irene_sera_wake.png`
- 直す: 本文は「彼女が手に取ったのは、地下墓地で見つけた、師のランタンだった」。いまの絵は大きな据え置きのガラス灯器 → イレーヌが師のランタン (`chapter1/w01_lantern.png` の小さな真鍮の手提げランタン、青白い魂火) を手に持ち、その火が筋になってセラの胸へ流れ込む。セラは正典 (本物の黒髪・額の印)。
```text
...except: remove the large standing glass lamp. Irene holds in her hand the small brass hand lantern from the attached w01_lantern reference; a pale blue soul-fire stream flows from it into Sera's chest. Sera matches the attached Sera reference (near-black real hair, carved wooden face, forehead crest) and opens her eyes.
```

**A-18. 第四章 ch4_end「二つ並んだ影」** `art/story-review/chapter4/ch4_end.png`
- 直す (1): 中央の灯が真鍮の杯の青い炎 → 燭台の白い蝋燭 (本文「館の燭台の灯が、セラの木の頬を照らしている」)。
- 直す (2): セラの頬杖の腕の節が一つ多い → 正しい腕 (肩・肘・手首)。
```text
...except: the central light is a single white candle on a brass candlestick with a warm flame lighting Sera's wooden cheek (no blue flame vessel). Fix Sera's arm so it has exactly one elbow joint between shoulder and wrist.
```

**A-19. 第四章 w16_legs「根の中を歩いた脚」** `art/story-review/chapter4/w16_legs.png`
- 直す: すねの正面のランタンの線画 → 消す。**くるぶしの内側**に小さく、掌に炎を載せた手の印。
```text
...except: remove the lantern drawing from the shin; carve a small palm-up hand holding a flame on the INNER ANKLE of one leg.
```

**A-20. 踏破後 lore_w07 (捨て砦の地下牢)** `art/story-review/dungeons/lore_w07.png`
- 直す: セラの頭のそばに木の手・前腕・手足の筒が並び、一体分あるように見える (腕は取水口・胴は苗床・脚は大水槽で見つかる) → 頭だけにする。髪は正典の色、額の印を正典の形に。
```text
...except: remove the wooden hand, forearm and limb pieces; only Sera's detached head remains on the stone ledge in its cloth. Her real wavy hair is near-black dark brown like the attached Sera reference, with a small gold palm-and-flame crest on the forehead.
```

**A-21. 踏破後 lore_w14 (水底の参道)** `art/story-review/dungeons/lore_w14.png` (いまは使われていない)
- 直す: 鳥居・しめ縄・日本式の石灯籠で和風の神社になっている → 旧都はゴシックの都。`chapter4/w14_lamp.png` と同じ、祠の形のゴシックの石灯籠の列が水底の参道に並ぶ。根・沈んだ供物の宝箱は保つ。直したら `tools/storyart/hold.json` の `hold` から外し、`python3 tools/storyart/build.py` を回す (1-3)。
```text
...except: remove the torii gates, shimenawa ropes and Japanese stone lanterns. The drowned processional way is lined with gothic shrine-shaped stone lanterns like the attached w14_lamp reference, leading to a sunken gothic temple; keep the roots and the sunken offering chests.
```

**A-22. 踏破後 lore_w16 (洗礼の大水槽)** `art/story-review/dungeons/lore_w16.png` (いまは使われていない)
- 直す: 本文は「水は少しずつ濁った。澄んだまま残る泉は、誓いの名残だけ」「底に絡まっていたのは、どこかへ帰ろうとしていた器」。いまの絵は全体が澄んだ明るい水 → 大水槽の水は暗く濁らせ、澄んだ泉が二つだけ光る。底の根に木の脚 (セラの脚) がかすかに絡む。直したら同じく `hold` から外して build.py を回す。
```text
...except: the great baptismal cistern water becomes dark and murky; only two small pure springs still glow clear. Faintly visible at the bottom, roots entangle a pair of wooden doll legs with black iron joints.
```

### B. 任意 (余力があれば。読者が気づきやすい順)

| 場面 | 直すこと |
|---|---|
| 序章 arrival `art/story-review/prologue/royal-audience.png` | 授かる三つの魂の色を職業の色に: 戦士 = 赤、僧侶 = 金、盗賊 = 緑 (紫は後で授かる魔導士の色なので外す) |
| 序章 irene_lamp `art/story-review/prologue/irene-soul-lamp.png` | 弟子を燭台の近くに。本文「弟子は火に手を近づけた」 |
| 序章 first_descent `art/story-review/prologue/first-descent-gatekeeper.png` | 四体が弟子の方を向く。本文「暗い入口を前にしてもこちらを向いている」。門の奥の石段は下りに |
| 第一章 ch1_end `art/story-review/chapter1/ch1_end.png` | 人業を大人の背丈、頭は何も彫られていない丸い木 |
| 第一章 mem_w05 `art/story-review/chapter1/mem_w05.png` | 冷えた焚き火の輪を足す。手記の脇のランタンを消す (師の物に見える) |
| 第一章 report_w01 `art/story-review/chapter1/report_w01.png` | 王に差し出すランタンを `w01_lantern.png` と同じ形に |
| 第一章 w01_lantern `art/story-review/chapter1/w01_lantern.png` | 墓石を崩れたものに、ランタンを真ちゅうらしく |
| 第一章 report_w02 | 窓の外の地上の修道院の廃墟を消す (修道院は地下) |
| 第二章 w06_roll | 鍵束を当直簿をとじた紐に結ぶ。窓の外の灯る城を消す |
| 第二章 mem_w09 | 書状を握りつぶした形に |
| 第三章 report_w12 | 杯を玉座の肘掛けの上に (本文「肘掛けの杯」)。抱えた包みを胴らしく (黒鉄の継ぎ目をのぞかせる) |
| 第三章 report_w11 | 奥の髑髏飾りの二つ目の玉座を、空いた宰相の椅子らしく小さく |
| 第三章 w10_rope | 縦穴の灯の集落 (足場・吊り灯) を減らし、根の縦穴らしく |
| 第四章 w14_lamp | 灯籠の笠に掌に炎の印 |
| 踏破後 lore_w01 | ランタンの形を `w01_lantern.png` に合わせる (横倒しの筒にしない) |

---

## 4. 便2・便3 ― 第5〜8章の新規 42場面

いまは第5〜8章の挿絵がコードで描いた小さな仮の絵なので、承認済みの章と同じ画風の原画に置き換える。

- 本文は場面IDで引く: ストーリー一覧 = `src/archive-stories.js` の `scene("<場面ID>", ...)`、ゲーム内 = `src/story.js` (手がかり `STORY_CELLS.<場面ID>`、報告 `REPORTS.w18` = report_w18、主の記憶 `BOSS_MEMORIES.w21` = mem_w21、館の語り `IRENE_BEATS` の id、章の結び `CHAPTER_END[5]` = ch5_end)。**両方を読んで、両方に合う一枚にする。**
- 参照画像: `docs/art/story-refs/` の基準シート (2-4) に加え、玉座の間は `chapter3/report_w12.png`、館は `chapter2/irene_roots.png`・`chapter1/irene_familiar.png` を渡す。
- 人物の背景・迷宮の場面には、弟子と隊の人業 (2〜4体) を入れてよい。セラは第五章から隊にいることがある (入れるなら正典の姿)。
- 報告の場面 (report_*) は、玉座の間・王・空いた宰相の席・弟子 (後ろ姿) が基本。窓の外は 2-3 の時の流れに従う。

各場面の英語の指示は、1-1 の前置きのあとに書く (`prompt.mjs` が前置きと合わせて出す)。**新しい場面を足す時もこの形** (`**<場面ID>「題」** (種類)`・箇条書き・```text の英語) — `tools/storyart/brief.mjs` がこの書式を読む。

### 第五章「灼熱の洞」 ― 便2

**w18_blade「手放された刃」** (師の手がかり / 迷宮「火を噴く地割れ」)
- 本文の要点: 赤く脈打つ岩の奥の鉄の扉。扉の隙間に、のこぎりのように研いだ刃が突き立ち、根元から折れている。柄に焼け焦げた布、布に煤の字。弟子は折れた刃をてこにして扉を開ける。
- 描くもの: 折れた刃 (折れ口がはっきり) / 柄の焦げた布 / 鉄の扉 / 刃で扉をこじる弟子。描かないもの: 師本人、扉の向こうの祭場の詳しい様子。
```text
Deep inside a volcanic fissure cave whose rock walls glow and pulse red with magma veins, a massive rusted iron door is set into the rock. Jammed in the gap of the door is a long serrated saw-like blade, visibly SNAPPED near the hilt; its hilt is wrapped in a scorched cloth bearing soot scribbles. The apprentice (brown hair, charcoal cloak with restrained gold embroidery, leather satchel) braces against the door and levers it open using the broken blade, heat shimmer and drifting embers around. Two or three wooden party dolls with blank round heads wait behind in the red glow. Composition centers on the broken blade in the door gap.
```

**report_w18「床の下の熱」** (報告)
- 要点: 玉座の間がひどく暑く、王が何度も額をぬぐう。床の下で何かが煮えている音。弟子は煤だらけ。
- 描くもの: 額を布でぬぐう王 / 床石のすき間から漏れる赤い光と陽炎 / 空いた宰相の席 / 煤だらけの弟子。
```text
The same gothic throne room. The very old king (long white hair and beard, pointed gold crown, red robes, white ermine with black spots) sits on the throne wiping sweat from his brow with a cloth; the air wavers with heat shimmer and a faint red glow seeps up through cracks between the floor tiles, as if something boils beneath. The chancellor's chair beside the throne is conspicuously empty. The apprentice, cloak dusted with soot, kneels in rear three-quarter view. Heavy dark clouds outside the tall windows. Candles drooping in the heat.
```

**w19_husks「同じ顔の器」** (手がかり / 迷宮「灰の降る祭場」)
- 要点: 灰の降る祭場の隅に、焼け焦げた人業の殻の山。どれも同じ顔 (宰相モルデンを小さくしたような、痩せて白い顔)。胸の扉はみな空。山の上に師の字の札 (裏に継ぎ目の締め方)。
- 描くもの: 同じ顔の焼けた殻の山 / 開いて空の胸の扉 / 山の上の札 / 降る灰。描かないもの: モルデン本人。
```text
A ritual plaza in a fire cave where grey ash falls like snow. In a corner, a heap of burned and blackened wooden doll husks, dozens of them, every one carved with the SAME face: a small version of the gaunt pale chancellor Morden's face from the reference, with a thin smile. Their small chest doors hang open and empty. On top of the heap lies a single wooden tag with handwritten scribbles. The apprentice reaches up for the tag. In the far haze, a great fire burns on an altar. Ash, embers, charred wood grain rendered in fine detail.
```

**irene_husks「締め直された継ぎ目」** (館の語り)
- 要点: イレーヌが札の手順を指でたどり、その夜セラの継ぎ目を一つずつ締め直す。セラ「体が、軽いです」。
- 描くもの: 小さな工具でセラの肘の継ぎ目を締めるイレーヌ / 片手の札 / 目覚めたセラ (正典、作業台に腰掛け、白い衣、胸の灯) / 燭台の蝋燭。
```text
The same mansion workshop at night. Irene sits beside the workbench, holding a small wooden tag with scribbled instructions in one hand and with the other hand tightening the black-iron joint at Sera's elbow using a tiny brass tool. Sera, exactly as in the attached Sera reference (awake, long wavy near-black real hair, carved wooden face, gold forehead crest, white draped cloth with brown sash, pale blue soul-fire glow at her chest), sits on the workbench with a gentle relieved smile, flexing her fingers. A single white candle on a brass candlestick lights them warmly.
```

**report_w19「燃やされる器」** (報告)
- 要点: 王は、人業は死者に与えられた二度目の生だと言ったのに、それを釜にくべる者がいることを責める。玉座の間の熱は日ごとに強い。
- 描くもの: 怒りに肘掛けを握る王 / 弟子が差し出す、焼けた殻から外した小さな顔の木片 (モルデンに似た顔) / 空いた宰相の席 / 熱気。
```text
The same throne room, hotter than before: heat haze, a red glow from the floor cracks. The very old king grips the armrest in grim anger, staring at a small charred wooden face fragment that the apprentice holds up — a carved face resembling the gaunt chancellor. The chancellor's chair beside the throne stands empty. Heavy clouds outside.
```

**w20_cup「三百年分の一行」** (手がかり / 迷宮「魂を煮る釜場」)
- 要点: いちばん大きな釜の脇の作業台に、金の杯と、開いたままの分厚い帳面。同じ一行が頁という頁に三百年分。最後の頁に師の字の調合の書きつけ。
- 描くもの: 並ぶ大釜と湯気 / 作業台の金の杯 / 開いた分厚い帳面 (同じ行がびっしり、最後の頁だけ別の筆跡) / 読む弟子。
```text
A vast cavern of soul-boiling cauldrons: rows of enormous iron cauldrons bubbling with glowing amber sap and steam. Beside the largest one stands a worktable holding a single golden goblet and a huge, thick open ledger whose pages are filled with endless identical lines of tiny writing; the last page carries a different, hurried handwriting with a small recipe sketch. The apprentice bends over the ledger, one gloved finger tracing the final page. Warm infernal light, steam, intricate metal and paper detail.
```

**report_w20「床に置かれた杯」** (報告)
- 要点: 王は手の中の金の杯を長く見つめ、玉座の脇の床に置く (ゲーム内「今朝から、飲んでおらぬ」)。手が少し震えている。
- 描くもの: 金の杯を床へ置こうとする王の震える手 / 空いた宰相の席 / 帳面を抱えた弟子。
```text
The same throne room. The very old king leans down from the throne and, with a slightly trembling hand, sets his golden goblet down on the floor beside the throne, looking at it for a long moment. The chancellor's chair stands empty. The apprentice holds the thick ledger under one arm. Heat haze is fainter; heavy clouds outside.
```

**mem_w21「大釜の前の二人」** (主の記憶 / 業火の主)
- 要点: 一年前。大釜の前で、傷だらけの男 (オルド) と痩せた長身の男 (モルデン) が向かい合う。モルデンは微笑み、自分の胸の扉を開いて古い魂の灯を見せる。オルドは答えず、釜の脚に組みつき、釜が傾いて樹液があふれ、床が抜けて底の見えない穴へ落ちる。
- 描くもの: 胸の小さな扉を開けて古い灯を見せるモルデン (正典の顔・衣装) / 傷だらけで煤けたオルド (刃は無い) が釜の脚に組みつく瞬間 / 傾き始めた巨大な釜 / 床のひび割れと、下から吹き上げる冷たい風。記憶らしく、縁をにじませた温かい色の霞。
- 描かないもの: 弟子、隊。
```text
A memory scene, edges softly hazed in warm sepia light with drifting embers. At the bottom of a fire cave stands a gigantic iron cauldron of boiling amber sap. Before it, the gaunt pale chancellor Morden (exactly as in the reference: tall black-purple hat with gold band, red inner robe, gold chain) smiles thinly and holds open a small door in his own chest, revealing an old glowing soul-lamp flame inside him. Facing him, master Ordo (about 55, lean, short grey hair, grey beard, plain worn black coat torn and scorched, bleeding scratches, no weapon) throws himself against one of the cauldron's legs; the cauldron begins to tilt and sap spills; the stone floor around it is cracking, cold mist rising from a dark gap below. No apprentice in this memory.
```

**report_w21「冷えていく指先」** (報告)
- 要点: 釜の火が消えた朝から、王の指先が冷たい。モルデンが人業だったと知り、王は長く黙る。大釜の底の穴「奈落」。王は奈落へ降りる許しを出す。
- 描くもの: 冷えた指先を見つめ、両手をこすり合わせる王 (やつれ) / 熱の消えた玉座の間 (冷えた燭台・灰) / 空いた宰相の席 / 弟子。
```text
The same throne room, now cold and dim: the heat is gone, embers in braziers have died to grey ash. The very old king, frailer, stares at his pale fingertips and rubs his cold hands together, silent and shaken. The chancellor's chair beside him stands empty, a draft stirring its cushion's tassels. The apprentice kneels, reporting. Heavy clouds outside.
```

**ch5_end「底のない穴の上で」** (章の結び)
- 要点: 釜の火は消え、床下の熱は引いていく。館の燭台は変わらず燃えている。弟子は人業たちの支度を整え、館の扉の前でイレーヌが見送る。
- 描くもの: 夜の館の戸口で見送るイレーヌ / 室内に見える燭台の一本の蝋燭 / 支度を整えて出立する弟子と人業 (セラを含めてよい)。
```text
Night at the mansion entrance. Irene stands at the open carved door, seeing them off; behind her, inside the warm room, a single white candle on a brass candlestick burns steadily on the workbench. The apprentice, travel satchel ready, glances back at her from the steps; the wooden party dolls and Sera (as in the Sera reference, white cloth, chest soul-glow, round shield) wait on the street below. Cool moonlit cobblestones, heavy clouds over the city.
```

### 第六章「氷結回廊」 ― 便2

**w22_coat「風が受け止めたもの」** (手がかり / 迷宮「奈落の氷棚」)
- 要点: 奈落の壁から張り出す氷の棚。下から風が吹き上げる。黒い旅の外套が氷に半ば呑まれて凍りつき、裂けた裾 (灯を掌に載せた手の刺しゅう) だけが下からの風にはためく。内ポケットに凍った書きつけ。外套のあった壁から、石で削った足がかりが奥へ続く。
```text
Inside the bottomless shaft of the Abyss: spiral ice ledges jut from the dark rock wall, an icy updraft blowing upward carrying snow and faint soul motes. A black travel coat is frozen half into the ice of a ledge; only its torn hem, embroidered with a small gold palm-up hand holding a flame, flutters upward in the wind. The apprentice crouches and pulls a frozen folded note from the coat's inner pocket. From the wall beside the coat, crude footholds chipped by a stone lead away into the ice. Pale blue ice, deep darkness below, faint aurora glow above.
```

**report_w22「寒い玉座の間」** (報告)
- 要点: 釜の火が消えてから玉座の間がひどく寒い。王は膝掛けを引き寄せながら聞く。師が脚を折っても先へ進んだことを「あの男らしい」と言う。
```text
The same throne room, now bitterly cold: frost on the window panes, visible breath, candles burning low. The very old king pulls a thick fur lap blanket over his knees as he listens, a faint fond smile at the corner of his mouth. The chancellor's chair stands empty. The apprentice reports, in rear three-quarter view. Heavy grey clouds outside.
```

**w23_names「空けてあった柱」** (手がかり / 迷宮「凍れる操霊師の間」)
- 要点: 広間の奥に太い氷の柱が**十二本、輪になって**立つ。十一本の中に人 (王家の操霊師たち、男女) が、目を閉じ手を胸の前で組んだまま凍っている。根元に名が刻まれる。**十二本めだけが空**で、ヴェルナーの名と、内側に師の字。
- 描くもの: 輪になった十二本 (数えられること) / 十一人の凍った操霊師 / 一本だけ空の柱の前に立つ弟子。
```text
A vast ice hall. Twelve thick pillars of clear ice stand in a CIRCLE. Inside eleven of them, robed royal soul-mages, men and women of different ages, are frozen upright with eyes closed and hands folded on their chests. The twelfth pillar is clearly EMPTY — a hollow column of ice — with a name carved at its base and faint handwriting scratched inside. The apprentice stands before the empty pillar, one hand on the ice. Cold blue light, frost, drifting snow; all twelve pillars readable.
```

**report_w23「済まされていなかった処刑」** (報告)
- 要点: 王は長く黙る。十二人を牢に入れたのは自分。宰相は「処刑は済ませました」と報告していた。実際は奈落へ投げこまれていた。
```text
The same cold throne room. The very old king, lap blanket over his knees, sits in long silence holding a parchment listing eleven names; his eyes are closed in grief. The chancellor's chair beside him stands empty, a reminder of the lie. The apprentice waits, head bowed. Frost on windows, heavy clouds.
```

**w24_aurora「天井の星」** (手がかり / 迷宮「極光の氷窟」)
- 要点: 氷窟の天井いっぱいの極光は、細かな粒 (落ちきらずに氷に閉じこめられた魂) でできていて、ひとつひとつ瞬く。氷の床に石で押さえた師の紙。
```text
A deep ice cave whose entire ceiling ripples with an aurora that, on close look, is made of countless tiny blinking motes of soul-light trapped in the ice, green and violet. On the glassy ice floor lies a sheet of paper held down by a stone. The apprentice kneels by it, gazing up at the ceiling in wonder; a few old gold coins glint frozen in the ice. Cold, magical, quiet.
```

**report_w24「落ちきらなかった魂」** (報告)
- 要点: 地の底に空の光があったと聞き、王はしばらく天井を見上げる。釜を逃れ、氷に受け止められた魂もあったことを、少し救いのように聞く。
```text
The same cold throne room. The very old king, lap blanket over his knees, gazes upward at the vaulted ceiling as if seeing a distant aurora, a softened, almost relieved expression. A faint greenish reflected light touches the stone above. The chancellor's chair stands empty. The apprentice reports quietly.
```

**mem_w25「氷の玉座の前で」** (主の記憶 / 凍王)
- 要点: 三百年前、イザークは宰相の胸の扉に古い灯を見つけ、誰にも信じられず、奈落へ降りて吹き上げる風を凍らせて堤を張った (自分ごと)。一年前、脚を折った男 (オルド) が氷の玉座の前に座り、凍王が折れた脚を氷で固めてやる。
- 描くもの: 氷の玉座に半ば埋まった凍王イザーク / 玉座の段に腰を下ろし、折れた脚を氷で固めてもらうオルド (外套なし、シャツ) / 氷の堤 (魂の光を閉じこめた氷の壁)。記憶らしい霞。
- 描かないもの: 弟子。
```text
A memory scene with frosted, softly blurred edges. At the end of a great ice corridor stands a throne of ice; frozen into it sits the Frost King Isaak, a gaunt man in frost-white robes with a crown of ice shards, half embedded in the throne, stern yet kind. He extends one hand; ice crystals form a splint around the broken leg of master Ordo, who sits on the throne's icy step without his coat (torn dark grey shirt, short grey hair, grey beard, gaunt and exhausted). Behind them, a vast wall of ice holds countless faint soul-lights like a dam. No apprentice.
```

**report_w25「回廊の肖像」** (報告)
- 要点: イザークの名を聞いて、王は王宮の回廊に一枚だけ残る肖像のことを話す (病で死んだと伝わる、最初の王家の操霊師)。十一人の魂も還った。王は冷えた手を組む。
```text
The same cold throne room. The very old king, lap blanket over his knees, clasps his cold hands and looks toward a single old portrait hanging in the dim corridor beyond an archway: a young royal soul-mage in dark robes (Isaak, before he froze). The chancellor's chair stands empty. The apprentice stands beside, listening. Frost, heavy clouds.
```

**irene_lineage「同じ作り方の灯」** (館の語り)
- 要点: 最初の操霊師が師の一門の祖だと聞き、イレーヌは燭台の灯を長く見つめる。この灯もセラの胸の灯もモルデンの胸の灯も同じ作り方。それでも主は師。セラがイレーヌの手に自分の手を重ねる。
```text
The same mansion workshop at night. Irene gazes long at the single white candle on its brass candlestick, her face thoughtful and resolved. Sera (as in the Sera reference, soul-glow in her chest) gently lays her wooden hand over Irene's hand on the table. The two lights — candle and Sera's chest glow — echo each other. Warm, intimate, quiet.
```

**ch6_end「解けていく堤」** (章の結び)
- 要点: 氷の堤が解け、閉じこめられていた魂がようやく還っていく。解けた水はさらに下の沼へ流れ落ちる。
- 描くもの: 崩れ解けていく氷の壁 / 光の粒が群れになって上へ昇っていく / 解けた水が滝になって暗い下へ落ちる / それを見上げる弟子と隊。
```text
Inside the Abyss shaft, the great ice dam is melting and cracking apart; thousands of freed soul-lights rise upward in luminous streams toward the darkness above, while meltwater pours down from the broken ice in long waterfalls into the black depths below. The apprentice and the party stand on a remaining ice ledge, looking up at the ascending souls. Awe, release, blue and gold light.
```

### 第七章「毒沼」 ― 便3

**w26_splint「腕の木の添え木」** (手がかり / 迷宮「腐れ水の岸」)
- 要点: 雪解けの水が滝になって落ちる岸の泥。脚の形に削られた、溶けかけた氷のかけら (凍王の添え木)。人業の腕の木2本が縄で束ねて捨てられ、結び目に書きつけ。片足を引きずる足跡が谷へ続く。
```text
The bottom of the Abyss: a meltwater waterfall plunges into a black, sickly-green miasmic swamp. On the muddy shore lie half-melted ice fragments carved in the shape of a leg splint, and beside them two wooden doll forearms with black iron joint rings, bound together with rope, discarded; a folded note is tucked into the knot. Uneven footprints — one dragging — lead away toward a valley. The apprentice kneels to take the note; party dolls behind. Poison mist, reeds, dim green glow.
```

**report_w26「杯を満たしたもの」** (報告)
- 要点: 沼の水が腐った魂なら、王の杯を満たした魂も途中で拾われたもの。王は長く黙り、「息を詰めて行け」とだけ言う。
```text
The same cold throne room. The very old king, lap blanket over his knees, stares in silence at the golden goblet still lying on the floor beside the throne where he set it down, now dusty and empty. The chancellor's chair stands empty. The apprentice waits. Heavy clouds outside.
```

**w27_crest「仕上がらなかった兄弟」** (手がかり / 迷宮「器の捨て場」)
- 要点: 谷の奥に作りかけの器の山 (腕の無いもの・顔の無いもの・胸の扉が開いたままのもの)。どれも三百年より古い。胸の扉の内側に灯を掌に載せた手の印。山の頂に一体だけ、きれいに座らされた器 (顔は彫りかけ、胸は空)、膝に師の札。
```text
A deep valley by the poison swamp, piled high with ancient unfinished wooden dolls: some armless, some faceless with blank heads, many with small chest doors hanging open, and inside each open door the same carved crest — a palm-up hand holding a flame. Everything is grey with age and moss. At the very top of the pile, one doll sits neatly upright, its face only half-carved, its chest empty, a wooden tag resting on its knees. The apprentice climbs the heap toward it. Green miasma, dead reeds.
```

**report_w27「笑わない宰相」** (報告)
- 要点: 王は目を閉じる。宰相は山ほどの捨てられた兄弟の上に立っていた。百年そばに置きながら、王は宰相が笑うのを見たことがなかった。
- 描くもの: 目を閉じる王 / 主題は空いた宰相の席 (本文に無い物を置いて意味を足さない) / 弟子。
```text
The same cold throne room. The very old king sits with his eyes closed, lap blanket over his knees. The focus is the empty chancellor's chair beside the throne, cold and unused, lit by a single candle. The apprentice stands in rear view. Heavy clouds.
```

**irene_crest「捨てられなかった器」** (館の語り)
- 要点: イレーヌがセラの腕をそっと持ち上げ、肘の継ぎ目の内側の小さな印を弟子に見せる。古い継ぎ方の書きつけ。セラ「わたし、捨てられた子たちの、妹みたいなものなんですね」。**セラは目覚めて組み上がっている** (部品にしない)。
```text
The same mansion workshop at night. Sera (as in the Sera reference, fully assembled and awake, sitting on the workbench) lets Irene gently lift her arm; Irene shows the apprentice the small palm-and-flame crest carved on the inner side of Sera's elbow joint. Old notes with joint diagrams lie on the bench. Sera's expression is wistful but smiling. Single candle on a brass candlestick.
```

**w28_note「沼を渡る薬」** (手がかり / 迷宮「毒霧の葦原」)
- 要点: 毒霧の葦原の奥、葦を刈り払った小さな跡。焚き火の跡と割れた小瓶、石で押さえた紙。最後の一行は沼の真ん中の島のこと (灯がひとつ、ともっている)。
```text
Deep in towering toxic reeds wreathed in yellow-green poison fog, a small clearing has been cut. A cold campfire ring, several cracked glass vials, and a sheet of paper weighted with a stone. The apprentice kneels reading it, a cloth over the mouth. Far beyond the reeds, across the swamp, a single small warm light glows on a distant island.
```

**report_w28「毒の底の灯」** (報告)
- 要点: 師が薬を作って沼を渡ったと聞き、王は「あの男らしい知恵だ」と言い、島のことを何度も尋ねる。宰相がいなくなった玉座の脇は今も空いたまま。
```text
The same cold throne room. The very old king leans forward with keen interest, lap blanket slipping, asking about a distant island; the apprentice gestures as if describing a far light. The chancellor's chair beside the throne stands empty. Heavy clouds outside.
```

**mem_w29「ただひとつの言いつけ」** (主の記憶 / よどみの主)
- 要点: 三百年よりもっと前。沼の真ん中の島の工房 (扉の上に灯を掌に載せた手の印)。年老いた操霊師が作業台の前に倒れ、そばに若い男の顔をした人業 (モルデン、いまと同じ顔) が膝をつく。「魂を、腐らせるな」。一年前、片脚を引きずる男 (オルド) が同じ作業台の前で古い日記を閉じる。
- 描くもの: 主題は倒れた老いた操霊師と膝をつくモルデン (三百年前、宰相の衣装ではなく素朴な工房の服) / 扉の上の印 / 瘴気。奥の工房の扉の向こうに塔の階段がかすかに。オルドは描かないか、手前に半透明の重ね (同じ作業台で日記を閉じる、腕の木で脚を固めた姿) にとどめる。
- 描かないもの: 祖の顔をはっきり (伏せた顔・陰に)。
```text
A memory scene with green-hazed edges. Inside an old stone workshop on an island in a poisonous swamp, a palm-up-hand-and-flame crest carved above the door. A very old frail soul-mage with long white hair lies collapsed before the workbench, his face turned away in shadow. Kneeling beside him is a finished wooden doll with the ageless gaunt pale face of Morden (as in the reference) but wearing plain workshop clothes, closing his master's eyes with one hand. Poison mist seeps through the cracks. Through an open back door, the first steps of a spiral tower stair are faintly visible. Optional: a faint translucent echo of master Ordo (grey hair, leg splinted with wooden doll arms) closing an old diary at the same bench.
```

**report_w29「死なない命令」** (報告)
- 要点: 王は「魂を、腐らせるな」を何度も口の中でくり返す。大樹も霊薬も釜も、そのためだった。命じた者が死んでも命令は死なない。王は顔を上げ、弟子に塔を登れと告げる。
```text
The same cold throne room. The very old king, lap blanket over his knees, raises his head with a new resolve and points upward, telling the apprentice to climb. On his lap rests an old parchment. The chancellor's chair stands empty. Heavy clouds; a faint rumble of distant thunder.
```

**irene_order「灯を守る理由」** (館の語り)
- 要点: イレーヌが燭台の芯を整えながら、師の言いつけ「灯を、絶やすな」を語る。セラ「毎晩、おやすみを言いに来ますから」。イレーヌは小さく笑う。
```text
The same mansion workshop late at night. Irene trims the wick of the single white candle on its brass candlestick with small scissors, a soft little smile on her lips. Sera (as in the Sera reference) stands at her side in a nightly visit, hands clasped, saying goodnight. Warm candlelight, deep shadows, quiet tenderness.
```

**ch7_end「嵐の鳴る塔へ」** (章の結び)
- 要点: よどみの主が鎮まり、沼の底の魂は静かに眠りはじめる。工房の奥から嵐の鳴る塔が上へ伸びる。師はその階段を登っていった。
```text
The poison swamp now calm and still, faint soul-lights settling softly into the dark water like sleeping fireflies. On the island, the old workshop's back door stands open; behind it a colossal stone tower rises straight up the Abyss shaft into darkness, storm clouds and flickering lightning wrapping its upper levels. The apprentice stands at the foot of the tower stairs, looking up. Party dolls behind.
```

### 第八章「嵐の尖塔」 ― 便3

**w30_stick「雷にくれてやった杖」** (手がかり / 迷宮「風鳴りの螺旋」)
- 要点: 螺旋階段の踊り場の床が雷で黒く焦げる。焦げ跡のまん中に、半ばで折れた木の杖 (握りの下に人業の腕の継ぎ目)。石で押さえた書きつけ。手すりの鎖に、手でつかんだ跡が上へ続く。吹き抜けを下から風が鳴りながら昇る。
```text
Inside a colossal stone tower: a spiral staircase winds up around a hollow central shaft through which wind roars upward. On a landing, the stone floor is blackened by a lightning strike; in the middle of the scorch lies a wooden walking staff snapped in half, a black-iron doll-joint ring visible below its grip. A note is weighted by a stone. Along the iron chain handrail, dark handprints continue upward. The apprentice kneels by the broken staff. Rain-wet stone, distant lightning glow from above.
```

**report_w30「鳴りやまぬ雷」** (報告)
- 要点: この百年、王都の空はいつも重く、雷の鳴らない夏は一度もなかった。その雷を鳴らしていたのが地の底の塔。
```text
The same throne room. Through the tall windows, heavy storm clouds and a flash of lightning over the city. The very old king, lap blanket over his knees, turns toward the window as thunder rolls. The chancellor's chair stands empty. The apprentice reports. Cold blue lightning light against candlelight.
```

**w31_bell「空へ還る鐘」** (手がかり / 迷宮「嵐を鳴らす鐘楼」)
- 要点: 塔の中ほどに大鐘がいくつも吊られ、誰も撞かないのに鳴る。いちばん大きな鐘が床すれすれまで下ろされ、内側の縁に一門の印がぐるりと浮き彫り。銘の続きは削り取られ、その下に師の書き足し。
```text
A storm-swept bell tower inside the great tower: several huge bronze bells hang in the wind, swinging and ringing on their own. The largest bell has been lowered almost to the floor; the apprentice crouches to look up inside it, where a ring of relief crests — palm-up hands holding flames — runs around the inner rim, with an engraved line beside them whose continuation has been scraped away and a small handwritten scribble added below. Rain blows through open arches; lightning outside.
```

**report_w31「同じ問い」** (報告)
- 要点: 鐘の銘の話を聞いて、王は耳を澄ますように目を閉じる。還っているのなら、なぜ嵐はやまないのか。
```text
The same throne room. The very old king sits with eyes closed and head slightly tilted, as if listening for distant bells through the storm. Rain streaks the windows, lightning far away. The chancellor's chair stands empty. The apprentice waits.
```

**irene_bell「鐘の節」** (館の語り)
- 要点: イレーヌが鐘の銘の写しを読みながら、小さく節をつけて口ずさむ。師が継ぎ目を締めながら口ずさんでいた節。セラ「わたしも知っています。眠る前に、オルド様が歌ってくれました」。
```text
The same mansion workshop at night. Irene reads a copied inscription on paper and softly hums, eyes half-closed; Sera (as in the Sera reference) sits beside her, listening and humming along, smiling. Single white candle on a brass candlestick between them.
```

**w32_rod「雷よけの巻き方」** (手がかり / 迷宮「雷の落ちる回廊」)
- 要点: 塔の外壁をめぐる回廊の行き止まり。鉄の手すりに銅の線がぐるぐる巻かれ、壁の割れ目から塔の内側へ引きこまれる。壁のくぼみに、雨に濡れないよう畳んだ紙 (裏に、人業の継ぎ目に銅を巻くやり方の絵)。
```text
An open gallery running around the outside of the storm tower, high above the clouds, in driving rain. At a dead end, copper wire is wound many times around the iron handrail and led into a crack in the wall toward the tower's interior; a bolt of lightning strikes the rail and the current flows into the wall. In a dry niche, a folded paper; the apprentice unfolds it, showing a small diagram of copper wound around a doll's joint (illegible). Party dolls shield themselves behind.
```

**report_w32「地の底に吸われる雷」** (報告)
- 要点: 王は捨て砦の大手門の雷雨を思い出す。雷は地の底に吸われていた。宰相のいない玉座の脇で、王は窓の外の雲を見ている。
```text
The same throne room. The very old king, lap blanket over his knees, gazes out the window at churning storm clouds; lightning forks downward into the earth on the horizon. The chancellor's empty chair stands beside him. The apprentice stands quietly.
```

**mem_w33「縛られた魂」** (主の記憶 / 嵐の主)
- 要点: 頂の、火のない大きな灯台。そのまわりに鎖の腕をもつ像 (魂縛りの像) が輪になり、昇る魂を縛って塔のまわりで渦巻かせ、嵐にしている。一年前、杖を失った男 (オルド) が手すりの鎖を頼りに這い上がり、像のひとつを拾った石で叩き割る。縛られていた魂がひとつ雲の上へ抜ける。雷雲の切れ間に長い石の橋、その向こうにすり鉢の形の古い観客席が黒く沈む。
- 描くもの: 火のない灯台 / 鎖の腕の像の輪と渦巻く魂の嵐 / 像を石で割るオルド (腕の木で固めた脚、杖なし) / 抜けていく一つの魂 / 雲の切れ間の石の橋と観客席。
- 描かないもの: 弟子。灯台に火を入れたモルデンの姿 (この絵では描かない)。
```text
A memory scene with storm-grey hazed edges. The summit of the storm tower: a huge dark lighthouse with no fire. Around it stands a ring of stone statues whose long chain-arms reach out and bind countless rising soul-lights, forcing them to swirl around the tower in a churning vortex of storm, lightning and rain. In the foreground, master Ordo (short grey hair, grey beard, gaunt, leg splinted with two wooden doll arms bound by rope, no staff) has crawled up and smashes one statue's chain-arm with a stone; a single freed soul-light streaks upward through the clouds. Through a break in the storm clouds, a long stone bridge leads away toward a sunken bowl-shaped ancient amphitheatre. No apprentice.
```

**report_w33「百年目の青空」** (報告)
- 要点: 嵐の主が鎮まった朝、王都の空が晴れる。王が生きた百年で初めての青空。捨て砦の大手門の雷雨も止んだ。王は窓の外の青い空を長いあいだ見ている。「橋の向こうへ行け」。
- 描くもの: **朝の澄んだ青空** と差しこむ陽の光 / 窓辺に立って空を見上げる、やつれた王 / 空いた宰相の席 / 弟子。
```text
The same throne room on a bright morning: for the first time, the tall windows show a clear BLUE sky with soft white clouds, and warm sunlight streams across the floor, dust motes glittering. The very old, frail king has risen and stands at the window with a lap blanket over his shoulders, gazing up at the sky in quiet wonder, one hand on the window frame. The chancellor's chair stands empty in the sunlight. The apprentice stands behind.
```

**irene_rain「雨の音」** (館の語り)
- 要点: その夜、ロアダルにも静かな雨 (嵐ではない)。イレーヌは窓を少しだけ開けて雨の音を聞く。セラが窓辺に並び、手のひらで雨粒を受ける。燭台の灯が雨の音に合わせて小さく揺れる。
```text
The same mansion at night with a gentle, quiet rain — not a storm. Irene has opened a window just a little and listens to the rain with a nostalgic smile. Sera (as in the Sera reference) stands beside her at the window, holding out her wooden palm to catch raindrops. Behind them, the single white candle on its brass candlestick flickers softly. Soft rain sheen on the glass and sill.
```

**ch8_end「雲の向こうの橋」** (章の結び)
- 要点: 塔に縛られていた魂は鎖をほどかれ、雲の上へ昇っていく。王都の上の重い雲が切れ、青空がのぞく。頂から、雷雲の向こうへ長い石の橋が架かり、橋の先に古い闘技場の跡が沈んでいる。
- 描くもの: 鎖のほどけた像と、昇っていく魂の光 / 切れた雲と青空 / 長い石の橋とその先の沈んだ観客席 / 頂の端に立つ弟子と隊。
```text
The summit of the storm tower after the storm: the statues' chains hang loose and broken, and countless freed soul-lights rise up through parting clouds into an opening BLUE sky. From the summit, a long ancient stone bridge stretches across a sea of clouds toward a sunken bowl-shaped ruined amphitheatre in the far distance. The apprentice and the party (wooden dolls, optionally Sera) stand at the summit's edge looking toward the bridge. Hopeful light, wind, scale.
```

### 第五章の任意の1枚

- **irene_abyss「落ち続ける灯」** (館の語り。ゲーム内だけで、ストーリー一覧に無い。絵を付けるなら、先に Claude に一覧の場面を足してもらう — 1-3): 燭台の前で両手を固く組むイレーヌ、胸の扉に手を当てて灯を強く燃やすセラ。

---

## 5. 便4 (任意) ― 踏破後の由来の絵

迷宮を踏破すると、ストーリー一覧の「踏破した迷宮」に、その迷宮の由来と秘密 (`src/journal.js` の `DUNGEON_LORE`) が出る。専用の原画があるのは w01〜w13・w15・w17・ws1・ws2 だけ。ほかは次のとおり (Claude が今回直した)。

- 本筋の迷宮: その迷宮の手がかりのコード絵 (小さな仮の絵)。
- 寄り道の迷宮: 出撃画面と同じその迷宮の情景 (`src/backdrops.js` の `drawDungeonVista`)。

専用の原画を作る時は、各迷宮について以下を読み、本文の3段落の中身を一枚にする。
- `DUNGEON_LORE` の本文
- `src/dungeons/world.js` の名前・`about`・掟 (`trait`)
- 出撃画面の情景 (ゲームで出撃シートを開いて見る)

描く時の決まり:
- 迷宮の名前と掟の印象 (例: 雷鳥の巣 = 神速、雲上の庭 = 雨が一滴も落ちない) を外さない。
- その迷宮の章より先の秘密を描かない。特に古井戸 `ws5` は第二章で開くので、旧都・神殿を描かない。
- 弟子や隊は入れなくてよい (情景の絵)。

作り方は 1-3 と同じ: `node tools/storyart/prompt.mjs lore_<迷宮ID>` で依頼を出し、原画を `art/story-review/dungeons/lore_<迷宮ID>.png` に置いて `python3 tools/storyart/build.py`。

| 優先 | 迷宮 | 描く中身 (本文の要点) |
|---|---|---|
| 1 | ws5 王都の古井戸 | 願いと金貨を投げ入れた古い井戸の底。三百年分の金貨と、底で根につながる水。旧都は描かない |
| 1 | ws17 雲上の庭 | 雷雲の上に張り出した庭。雲を眺める向きの石のベンチ、枯れずに咲く花、雲から落ちる泉、花のあいだで憩う魂。雨は一滴も落ちない |
| 1 | ws15 雷鳥の巣 | 塔の外壁の巨大な巣 (落雷で折れた木と、吹き上げられた誰かの持ち物)、目にも止まらぬ雷鳥、奥に集められた光るもの (指輪・ボタン・魂のかけら) |
| 1 | ws13 疫病塚の底 | 城壁の外の塚、底の穴は奈落の沼へ。夜ごと死者が自分で鳴らす弔いの鐘 |
| 1 | ws10 火守りの僧院 | 釜の火を神の火と信じた僧院。炎の中に見える顔、目を閉じて祈る火守り、底の帳面 |
| 2 | ws3 霧の迷い森 | 道を隠す霧、奥の泉の周りの行き来の跡、水辺で誰かを待つ気配 |
| 2 | ws4 銀業の隠れ里 | 霧の奥の里、銀の小人たち (器になれなかった魂)、彼らを守る空の鎧と石の人形 |
| 2 | ws6 見捨てられた狼煙台 | 砦の扉や旗竿までくべて燃やし続けた狼煙の火の塔、来なかった援軍 |
| 2 | ws7 獄吏の詰所 | 牢番の寝起きした詰所、押収品の箱と鍵束、人を越えた番人 |
| 2 | ws8 沈んだ書庫 | 内から閉ざされた書庫の塔、封をした書の箱、名を墨で塗りつぶした写し |
| 2 | ws9 黒曜の切り場 | 熱で溶けて急に冷えた黒曜の崖、刃を研いだ跡 |
| 2 | ws11 白狼の吹き溜まり | 底まで固まらない雪の吹き溜まり、白霜の狼の巣に埋められた靴・外套・手紙 |
| 2 | ws12 氷河の裂け目 | 解けはじめた氷の裂け目、底へ落ちる細い水、壁の奥で光る凍った魂 |
| 2 | ws14 沈んだ渡し場 | 沼の島へ渡る舟の渡し場、灯をともして客を待ち続けて沈んだ渡し守、沈んだ舟の金貨 |
| 2 | ws16 錆びた避雷針の林 | 塔の張り出しに林のように打たれた錆びた鉄の針 (根元の一門の印)、焼けた旅人の荷 |
| 3 | w18〜w33 本筋の16迷宮 | 各迷宮の情景 (`about` と本文)。手がかりの場面と構図を変える |

---

## 6. 照合で見つかったが、絵ではないので Claude が直したもの (参考)

- **セラの髪は本物の髪**: 本文 (`src/story.js` の独房の頭 `w07_sera`、館の語り「彫られた顔」`irene_omokage`) を「木彫りの髪」から「彫られた木の顔に、長い黒髪」「この顔を彫って、髪を植えた」へ。
- **第五〜八章の仮の絵** (コード描画、`src/archive-stories.js`):
  - report_w19・w25・w28・w32 は、いないはずの宰相が描かれていたので、空いた席の絵に替えた。
  - irene_crest は、部品のセラを目覚めた姿の絵に替えた。
- **踏破後の由来**:
  - 寄り道の迷宮が、ほかの迷宮の手がかりの絵を借りていたので、その迷宮の情景に替えた。
  - 用意済みの lore_w15・lore_w17 をつないだ (w14・w16 は便1で直してからつなぐ)。
- **記録**:
  - 第二章・第四章の `scenes.json` と一覧を、いまの本文に合わせた。
  - 踏破後の一覧 `art/story-review/dungeons/index.html` を直した。
  - `docs/story-art-plan.md` を更新した。
