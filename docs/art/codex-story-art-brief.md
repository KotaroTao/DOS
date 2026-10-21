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
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
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
- ストーリー一覧に無い、ゲーム内だけの場面 (未登録の館の語りなど) には絵を付けられない。付けたい時は Claude に一覧の場面を足してもらう。
- 遊ぶ人の端末は、進めている章までの物語の絵と、地図に現れた迷宮の由来の絵だけを裏で先に集める (`sw.js` の warmMedia ← `src/journal.js` の `storyMediaUrls`)。先の章の絵を足しても、まだそこへ着いていない人の通信は増えない。
- 1便ごとに1つの PR。最初の数枚で止まって承認を待つ (各便の依頼文)。Pillow (`pip install pillow`) と Node 22 が要る。

### 1-4. 確かめること (1枚ごと。build.py が見ないもの)

1. prompt.mjs の本文 (一覧用とゲーム内用の両方) を読み直し、各場面の「描くもの」がすべて入り、「描かないもの」が無いこと。
2. 人物が正典 (2章) と基準シート (2-4) と同じに見えること。顔・髪・衣装・持ち物。
3. 手の指 (親指＋4本)、腕と脚の本数。
4. 縮小の見本 (`chapterN-small.jpg`) で主題が読めること。
5. 文字が入っていないこと (書きつけは読めない走り書き)。

## 2. 正典 ― 人物・小道具・時の流れ

**空の方針 (2026-10-14 ユーザーの訂正)**: `report_w33`「百年目の青空」以降の現在の外景は、ロアダルも含め明るい空を描く。従来の暗い空・百年続く曇天へ戻さない。昼は青空、本文に夕方とある時は明るい茜空。本文が夜を明示する場面と過去の記憶は、その時刻・時代に合わせる。「空の上の町」は保存済みの元の青空原画へ復元した。

本文と承認済みの原画から決めた。**ここに書いたことが、これまでの絵とずれていたら、ここが正しい。**

**便0 が済んだら、人物・小道具の参照には `docs/art/story-refs/` の基準シート (2-4) を最優先で渡す。** 下の表の右の列は、そのシートの元にした絵 (シートができるまではこちらを渡す)。

### 2-1. 人物

| 人物 | 姿 (英語の指示に入れる) | 基準画像 (参照として渡す) |
|---|---|---|
| 弟子 (プレイヤー) | young adult, tousled brown hair, charcoal-black traveling cloak with restrained geometric gold embroidery all over, brown leather crossbody satchel; usually seen from behind or in profile | `art/story-review/chapter3/report_w13.png`、`art/story-review/chapter4/w14_lamp.png` |
| イレーヌ (館の主・人業) | long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves; calm, gentle. **第一章 irene_reveal より前の絵では手首の継ぎ目を見せない** | `art/story-review/chapter2/irene_roots.png`、`art/story-review/chapter1/irene_familiar.png` |
| 王 | very old man, long white hair and long white beard, pointed gold crown, red robes, white ermine cape with black spots | `art/story-review/chapter3/report_w12.png` |
| 宰相モルデン | **一人の同じ顔**: long gaunt pale face, sunken dark eyes, thin enigmatic smile, tall black-purple ceremonial hat with a gold band, red inner robe, heavy gold chain of office with a red jewel. **老いない** (しわ・白髪を足さない。三百年前の記憶でも同じ顔)。正体は人業 = 胸に小さな扉があり、中で古い魂の灯が揺れている (第五章 mem_w21 で初めて見せる。それより前の絵では見せない) | `art/story-review/prologue/morden-at-throne.png`、`art/story-review/chapter3/report_w13.png` |
| セラ (師の作った人業) | **ユーザーの指示: 髪は本物の髪。** 職業「灯守」の原画が基準: long wavy very dark brown (near-black) real hair, wooden face with visible wood grain and carved features, brown eyes, small gold lamp-on-palm crest in the center of the forehead, black-iron joint bands with gold rims at shoulders/elbows/wrists/knees/ankles, black choker with a gold setting. 目覚めた後 (第四章の終わり以降) は white draped cloth with a brown sash、胸に青白い魂火の灯。**背中に魂火は付けない**。目覚める前 (第二〜四章) は部品だけで、胸に灯は無い。花の髪飾り・星形の印にしない | `docs/art/sera/sera-r1-final.png` (必ず渡す)、`docs/art/sera/source-comparison.png` |
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
| 館の灯 (師の魂の灯) | **オープニング第六幕の原画 `art/story-review/opening/flame.png` を形の正本にする。** 幅広い段付き円形台座・短い装飾支柱・広い蝋受け皿の真鍮製燭台に、太い白い蝋燭を一本。垂れた蝋・黄白色と橙色の炎。支柱を長くしない。背景の照明・師の青いランタンとは別物。炎の高さは本文に従う。 |
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
| 第八章 | 膝掛け。窓の外の雲を見る | 重い雷雲・稲妻 (この百年、王都の空はいつも重かった) | 脚には短い添え木を残し、切り詰めた木をつないだ杖をつく → 杖は雷に焼かれて踊り場に残す → 杖なしで手すりの鎖をつかんで頂へ這い上がる |
| 第八章 report_w33 以降 | 窓辺で空を見上げる | **百年で初めての青空** (朝) | ― |
| 第九章 | 膝掛け。自分の手を見る | 晴れた空 (昼は青空、夕方は茜) | 杖なし。指先の焼けた手 (手袋は石橋の輪に結んで残した)。片脚を引きずる |
| 第十章 | 膝掛け。玉座の肘掛けを強く握る (report_w41) | 晴れた空 | 第九章と同じ (手袋なし・焼けた指・片脚を引きずる)。**記憶の中だけに出る** (mem_w41)。悪人にも聖人にも見せない — 静かで、決意の固い顔 |
| 第十一章 | 膝掛け。自分の手を見る (report_w44)。町からの古い本を膝に (report_w45) | 晴れた空 (夕方は茜) | 第十章と同じ。**記憶の中だけに出る** (mem_w45: 大書庫の長机で古い記録を読み、余白に書きこむ。町の人業が運んだ椀は手つかず)。迷いのある、静かな顔 |
| 第十二章 | 膝掛け。手の中の王冠を見る (report_w46)。床の杯を見る (report_w47)。顔を覆う (report_w48)。自分の手を見て穏やかに笑う (report_w49) | 晴れた空 (夕方は茜、report_w49 は朝の青空) | 第十一章と同じ姿。**記憶の中だけに出る** (mem_w49: 廟の玉座の前で、ろうと金に覆われた最初の王の「終わらせてくれ」に答えず、玉座の裏の階段を降りる)。悲しみと決意の静かな顔 |

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
| ordo-states.png | 師オルドの章ごとの姿を横に4つ: 第五章 (煤と傷・刃なし) / 第六章 (外套なし・シャツ・氷で固めた脚) / 第七章 (人業の腕の木2本を縄で束ねた添え木・片脚を引きずる) / 第八章 (短い添え木を脚に残し、切り詰めた木をつないだ杖) | ordo.png (承認後) |
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


#### 王宮内部の基準イラスト (2026-10-19 ユーザー依頼)

人物のシート形式ではなく、同じ無人の玉座の間を5方向から描く。各画像は独立した1536×1024の一枚絵。制作後は王宮関連の絵の建築・材質・家具の基準として使う。本文にある人物・時刻・空・杯の位置は各場面に従い、基準画像の無人・夜景をそのまま強制しない。回廊・倉庫は別室とし、玉座や赤い通路を移植しない。

| シート | 中身 (この英語の指示をそのまま使う) | 元にする絵 |
|---|---|---|
| palace-front.png | Camera at eye level on the central aisle, looking straight toward the throne, symmetrical wide establishing view. Show the entire dais, throne, smaller chancellor chair on the east side, paired windows and red banners, foreground carpet and side columns. | `docs/art/town/palace.png`、`art/story-review/chapter3/report_w12.png` |
| palace-left.png | Move the camera to the southwest (entrance-left) side of the SAME room, looking northeast toward the throne in a clearly oblique three-quarter view. The west columns frame the left foreground, the carpet runs diagonally toward the distant dais. Show the throne and the smaller chair on its east side. Preserve all architecture and furniture, change only camera position. | `docs/art/story-refs/palace-front.png` |
| palace-right.png | Move the camera to the southeast (entrance-right) side of the SAME room, looking northwest toward the throne in an opposite oblique three-quarter view. The east columns frame the right foreground. CRITICAL composition: the red carpet enters at the BOTTOM RIGHT CORNER and recedes diagonally UP AND LEFT toward the throne in the LEFT HALF of the image. View the east-facing right sides of the chairs and the east edge of the dais; the small chancellor chair on the east side is nearer the camera than the throne. The left front leg of the dais is more distant. This is the opposite camera position to an entrance-left view. Do not mirror the reference. Preserve all architecture and furniture, change only camera position. | `docs/art/story-refs/palace-front.png` |
| palace-reverse.png | Reverse view from the north dais beside and just behind the throne, looking south along the SAME red carpet toward the closed dark oak main double doors with black iron and gold fittings. Show the carved back of the throne at the right foreground, the smaller chancellor chair on the left foreground (east), the hall stretching away, paired side colonnades and the entrance gallery. No second throne at the far end. Preserve the furniture and room geometry. | `docs/art/story-refs/palace-front.png` |
| palace-high.png | High oblique architectural view from the southwest entrance gallery, looking down northeast into the SAME room, wide enough to understand the rectangular floor plan, central red carpet, north dais with throne and smaller chair on its east side, both colonnades, and clear circulation. This is a believable interior balcony camera, not a cutaway, not an isometric diagram. Preserve every furniture position and the room proportions. | `docs/art/story-refs/palace-front.png` |

### 2-5. 王宮内部の共通指示

**第一章の最新訂正 (2026-10-19)**: 王宮関連6枚をすべて新しい一枚絵に描き直す。同じ背景の再生成・透明人物の固定合成をやめ、倉庫の作業台・地図の寄り・人物の表情・褒美の金貨・宝物庫の手渡し・手記と制止の手に構図を分散する。玉座の間を描く時も建築や家具配置を画角の外へ出し、背景の不一致を見比べられない構図にする。本文と人物の正典は保つ。旧A-49〜A-59よりA-60〜A-65を優先。`palace-fixed.mjs` と旧透明素材は過去の制作記録で、現行6枚には使わない。

方角は制作時の位置合わせ用。北が玉座、南が入口。原画の画面内には文字を入れない。中立の照明見本は既存王宮の夜景に揃える。既存の王宮の材質・金の彫刻・赤い布を引き継ぎ、人物を省いた空間基準にする。

```text
Environment reference illustration of ONE consistent unoccupied royal throne room in Dungeon of Souls. Not a character sheet. No people, no dolls, no human silhouettes, no text, labels, inset panels or borders. Keep the attached palace's exact lavish fine-grained pixel-textured dark fantasy style, grey gothic carved stone, clustered columns, ribbed pointed vaults, dry polished charcoal-black stone floor with restrained amber reflections, black iron and restrained intricate aged-gold ornament, deep burgundy velvet with gold embroidery. This is a maintained inhabited palace, not a ruin and not a frozen dungeon; no ice, snow, frost, overgrowth or debris. Fixed layout: rectangular hall; north end has one broad low dais reached by five shallow steps, one central tall pointed black-and-gold throne with burgundy upholstery, a single smaller lower-backed black-and-gold chancellor chair on its east side (right when facing the throne from the entrance), and one small round black-and-gold side table near the throne. No goblet or map table in this neutral reference. A single straight gold-edged burgundy runner goes from the south entrance up the center of the steps to the throne. A tall clear pointed lancet window stands on each side of the throne, with a long burgundy gold-embroidered banner outward of each window. Matching candle stands flank the dais and clustered stone columns line both side aisles. South end has one closed dark oak double entrance door with black iron and gold fittings and a modest stone gallery above it. Soft cool blue moonlit night outside and warm amber candles inside, balanced so the carvings and floor plan remain readable. Night is only the neutral reference lighting: later narrative scenes must follow their own time and sky. Keep all structural positions identical across the five camera views. No religious crosses, new royal logos, magical flames or extra thrones.
```


## 3. 便1 ― 既存の絵の修正

2026-10-13 序章変更に伴うユーザー指定の描き直し（4枚・済）:
- `three`: 人業の館でイレーヌが弟子と戦士・僧侶・盗賊の3体へ、森の古屋の人業の回収を依頼する。王宮の謁見にはしない。
- `departure`: 弟子と戦士・僧侶・盗賊・魔導士の4体が地下墓地の石段を下り、調査へ向かう。
- `w01_lantern`: ひび割れた鎮魂灯と師のランタンを別々に描く。
- `report_w01`: 王への報告後、王宮の倉庫で眠っていた人業を受け取る。魂の授与にはしない。
- 今回の変更は上記のユーザー指示を優先。旧版は `art/story-review/fixes/<場面ID>-prologue-before.png` に保存。


既存の画像を参照画像として渡し、指示した所だけを直す (`prompt.mjs <場面ID>` が直す元の絵を最初の参照に入れる)。直し終えた項目は、見出し (A) か行 (B) の末尾に「(済)」を付ける — `prompt.mjs --chapter` と確認ページが、残りの修正だけを数える。各項目の「保つもの」は変えない。英語の指示は、1-1 の前置きを付けたうえで、`Edit the attached illustration. Keep the composition, characters, lighting and style unchanged except:` に続けて書く。

### A. 必須 (物語の筋や正典と食い違う)

**A-60. 第一章 report_w01「倉庫の作業台で人業を受け取る」背景を比較させない新構図** `art/story-review/chapter1/report_w01.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/report_w01-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. A close overhead diagonal view inside a modest royal storeroom, NOT a throne room. A complete sleeping adult-sized wooden articulated doll lies diagonally on worn ivory cloth across a low wooden workbench. It has a blank smooth round wooden head with NO carved face, black iron joint bands, exactly two arms and two legs. The apprentice, visible from his tousled brown head down to both forearms at the left edge, carefully slides BOTH hands under the doll shoulders and knees to lift it and take it home. A plain brown-robed elderly palace keeper at the right edge steadies the cloth with one hand. Their hands do not merge. The sleeping doll is the clear central subject. Crop tightly around the workbench and figures: only a small out-of-focus shelf of folded burgundy cloth behind, no door, no windows, no throne, no dais, no carpet, no king, no chancellor, no floating souls, no lantern. The master lantern is put away. Convey careful recovery rather than a magical awakening.
```

**A-61. 第一章 report_w02「地図の上に増える道」背景を比較させない新構図** `art/story-review/chapter1/report_w02.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/report_w02-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. A close almost top-down still life of a parchment route map on a modest dark wooden side table after the second royal report. The map and two human hands dominate the central band: one hand enters from the upper right in the king red-and-gold embroidered sleeve with black-spotted white ermine cuff and indicates a small hand-drawn ruined abbey silhouette at the end of a winding route; the apprentice hand enters from lower left in the black-and-gold embroidered cuff and rests near the beginning of the route. A few simple tunnels and an abbey drawing, NO readable letters or labels, no glowing symbols, no modern map graphics, no keys or permits. The characters heads and bodies are OUTSIDE the crop. One low wax candle at upper left lights curled parchment and richly textured sleeves; cool blue ambient shadows. The background is only the table edge and soft dark negative space. No visible palace architecture, throne, steps, windows, hall, carpet, chancellor or crowds. Let the next journey, not the audience hall, tell the scene.
```

**A-62. 第一章 report_w03「王が宰相から目をそらす」背景を比較させない新構図** `art/story-review/chapter1/report_w03.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/report_w03-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. A tightly framed horizontal cinematic portrait during the report about the abbey memory and the sealed mine. In the LEFT two-thirds, the very old king in three-quarter profile, long white hair and beard, pointed jeweled gold crown, red gold-embroidered robes and black-spotted white ermine cape, turns his troubled gaze DOWN AND LEFT, deliberately AWAY from Morden. His face is the emotional focal point, his mouth closed. In the far RIGHT background the same ageless gaunt pale Morden appears as a narrow cropped waist-up figure, tall black-purple gold-banded ceremonial hat, dark eyes, red inner robe and heavy gold chain with red jewel, expression unreadable, chest completely closed. Use shallow depth of field and dark indistinct burgundy drapery as the entire background. Crop out ALL throne and chair silhouettes, floor, stairs, windows, columns, architectural layout, tables and apprentice. No chest door, no soul light, no keys, no fantasy visions. Intimate tense negative space separates the two faces. The king is still in his earlier first-chapter state, no blanket.
```

**A-63. 第一章 report_w04「問いの代わりに残る金貨」背景を比較させない新構図** `art/story-review/chapter1/report_w04.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/report_w04-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. A low close view over the apprentice shoulder during the report about the underground water flowing toward the royal capital. His black cloak with restrained geometric gold embroidery and a few tousled brown hairs frame the LEFT foreground. His one open natural five-fingered palm, extending from his sleeve, holds a small modest pile of ordinary gold coins at the CENTER foreground, sharply lit: the reward that interrupts his question. In the RIGHT middle distance, show ONLY the king cropped from crown to chest in a turned side profile, long white beard, red embroidered robe and white spotted ermine; his lips part then hesitate. Behind him near the TOP RIGHT, Morden leans slightly toward him as if quietly saying his name: same narrow pale ageless face, tall black-purple gold-banded hat, red inner robe and red-jeweled chain, chest covered. Background is dark soft cloth and candle bokeh only; all furniture, room geometry, windows, stairs, floor and throne are OUT OF FRAME. The coin hand is the visual focal point; no map, no displayed water, no pipes, no soul light or revealed secrets. Natural anatomy, no fused fingers.
```

**A-64. 第一章 minePass「通行証を渡す手元」背景を比較させない新構図** `art/story-review/chapter1/minePass.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/minePass-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. A tight diagonal close-up of a royal permit being handed from the old king to the apprentice in a small treasury receiving alcove, a different room from the throne hall. The king is outside the LEFT crop except one old natural hand, red gold-embroidered sleeve and black-spotted ermine cuff. The apprentice is at the RIGHT edge in partial side profile, tousled brown hair, black gold-embroidered travel cloak; he accepts ONE folded cream parchment pass with both hands at the center. One simple small wax seal, any writing entirely illegible. Make the handoff clear: king fingers hold the left edge, apprentice hands support the right and lower edge, hands do not fuse. Behind them only a softly blurred dark wooden chest with black iron and aged gold fittings and a folded burgundy cloth, suggesting deposited treasure without inventing specific named treasures. No throne, chairs, hall, columns, steps, windows, floor plan, chancellor, map, souls, weapons, keys or glowing permit. The pass is ordinary authorization, not a magic relic. Warm amber intimate light, cool dark corners.
```

**A-65. 第一章 report_w05「手記を閉じずに宰相を退ける」背景を比較させない新構図** `art/story-review/chapter1/report_w05.png` (済)
- 最新のユーザー依頼により全面描き直し。旧構図・背景固定より本項を優先し、本文は変更しない。
- 描くもの・描かないものと画角は下記の生成指示に従う。修正前は `art/story-review/fixes/report_w05-composition-before.png`。
```text
Redraw the ENTIRE first reference as a NEW standalone finished narrative illustration. The old composition and its fixed palace background are superseded by the users latest request. Do NOT preserve the old composition, do NOT make transparent cutouts, do NOT reproduce an establishing throne-room view. Character sheets define identity and costumes only; palace-front defines material palette only, NOT a layout to reproduce. Chapter ONE, before the blue-sky change: cool blue ambient shadows and warm amber candlelight, no snow or frost. Preserve fine-grained pixel-textured dark fantasy style. Show only the characters and objects specifically requested below; no later-chapter revelations. An intimate high-angle diagonal view during the first-chapter final royal report. The king has just read Ordo small worn leather journal and realizes Ordo entered the labyrinth bodily. Put the OPEN JOURNAL on the kings red-and-gold robed knees at the LOWER CENTER, pages entirely illegible scribbles. His long white beard and troubled crown-wearing face occupy the UPPER LEFT, looking past a small ordinary warm candle flame in the far LEFT foreground. His right hand rises palm outward firmly toward Morden, dismissing the interruption; one anatomically natural five-fingered hand, not pointing. The king left hand supports the journal. Morden is only a cropped dark black-purple shoulder and a slim edge of his red-jeweled gold chain in the RIGHT foreground, no face needed and chest fully covered. His presence must not cover the book or raised palm. Tightly crop to king face, chest, hands and knees; behind is only dark indistinct burgundy fabric and shadow. No visible throne back, seat outline, steps, floor, windows, hall, columns, maps, extra books or apprentice. No blanket, no cold later-chapter king state. A strong diagonal from tiny flame through king face to open journal distinguishes this from a formal portrait.
```

**A-55. 第一章 report_w02「王宮背景を固定」人物のみの再制作** `art/story-review/chapter1/report_w02.png` (済)
- ユーザー訂正: 王宮背景は一切変えない。正面基準の原画をそのまま使い、人物と場面の小道具だけを透明レイヤーで重ねる。背景の描き直し・拡縮・色調補正をしない。
- 以下は完成絵ではなく人物素材の生成指示。背景と人物素材の合成で完成原画を作り、透明部分の画素一致を検査する。倉庫の report_w01 は別室として現状を保つ。
```text
...except: This output is NOT a finished scene. Generate ONLY a TRANSPARENT RGBA FOREGROUND CHARACTER ASSET, landscape 1536x1024. The final scene will be assembled on the EXACT UNMODIFIED palace-front.png. The user explicitly forbids repainting even a single architectural feature. The source scene is narrative reference ONLY; do NOT copy its background, chairs or stairs. Draw exactly THREE isolated character cutouts in THREE SEPARATE WIDELY SPACED COLUMNS on true transparent background: LEFT column x=0..500 contains ONE seated king, CENTER column x=520..1010 contains ONE full-length apprentice seen from the back, RIGHT column x=1030..1535 contains ONE Morden. Each figure is complete, not cropped. Keep wide transparent gaps between figures; no overlap, no contact shadows, no floor, no scenery, no chair or stool, no throne, no furniture, no arches, no windows, no candles, no rectangular background, no checkerboard painted into the image. A seated person is drawn in seated posture with clothing naturally draping and their boots beneath, but with the chair COMPLETELY INVISIBLE and transparent. Hands rest naturally at elbow/armrest height without drawing armrests. Match lavish fine-grained pixel-textured dark fantasy artwork, warm amber rim light from both sides and subtle cool frontal fill, as though these characters occupy palace-front.png. King exactly matches king.png, long white hair and beard, gold pointed crown, red gold-embroidered robe and spotted white ermine cape, no lap blanket. Apprentice exactly matches apprentice.png, tousled brown hair, black gold-embroidered cloak, brown leather crossbody satchel on anatomical LEFT hip, no lantern. Morden exactly matches morden.png, same ageless pale gaunt face and dark eyes, black-purple tall ceremonial hat, red inner robe, black-purple outer robe and gold chain with red gem; no chest opening. Keep TWO arms and natural five-fingered hands per person. No text, labels or panels. LEFT KING: seated naturally, right hand making a modest explanatory gesture, left hand resting at armrest height. CENTER APPRENTICE: full-length back three-quarter view, facing slightly right toward king, arms lowered respectfully, satchel at anatomical LEFT hip. RIGHT MORDEN: seated calmly, hands resting on lap, looking slightly left toward king.
```

**A-56. 第一章 report_w03「王宮背景を固定」人物のみの再制作** `art/story-review/chapter1/report_w03.png` (済)
- ユーザー訂正: 王宮背景は一切変えない。正面基準の原画をそのまま使い、人物と場面の小道具だけを透明レイヤーで重ねる。背景の描き直し・拡縮・色調補正をしない。
- 以下は完成絵ではなく人物素材の生成指示。背景と人物素材の合成で完成原画を作り、透明部分の画素一致を検査する。倉庫の report_w01 は別室として現状を保つ。
```text
...except: This output is NOT a finished scene. Generate ONLY a TRANSPARENT RGBA FOREGROUND CHARACTER ASSET, landscape 1536x1024. The final scene will be assembled on the EXACT UNMODIFIED palace-front.png. The user explicitly forbids repainting even a single architectural feature. The source scene is narrative reference ONLY; do NOT copy its background, chairs or stairs. Draw exactly THREE isolated character cutouts in THREE SEPARATE WIDELY SPACED COLUMNS on true transparent background: LEFT column x=0..500 contains ONE seated king, CENTER column x=520..1010 contains ONE full-length apprentice seen from the back, RIGHT column x=1030..1535 contains ONE Morden. Each figure is complete, not cropped. Keep wide transparent gaps between figures; no overlap, no contact shadows, no floor, no scenery, no chair or stool, no throne, no furniture, no arches, no windows, no candles, no rectangular background, no checkerboard painted into the image. A seated person is drawn in seated posture with clothing naturally draping and their boots beneath, but with the chair COMPLETELY INVISIBLE and transparent. Hands rest naturally at elbow/armrest height without drawing armrests. Match lavish fine-grained pixel-textured dark fantasy artwork, warm amber rim light from both sides and subtle cool frontal fill, as though these characters occupy palace-front.png. King exactly matches king.png, long white hair and beard, gold pointed crown, red gold-embroidered robe and spotted white ermine cape, no lap blanket. Apprentice exactly matches apprentice.png, tousled brown hair, black gold-embroidered cloak, brown leather crossbody satchel on anatomical LEFT hip, no lantern. Morden exactly matches morden.png, same ageless pale gaunt face and dark eyes, black-purple tall ceremonial hat, red inner robe, black-purple outer robe and gold chain with red gem; no chest opening. Keep TWO arms and natural five-fingered hands per person. No text, labels or panels. LEFT KING: seated naturally, head turning to his own right (image left), eyes averted from Morden, right hand supporting his beard and left hand resting at armrest height. CENTER APPRENTICE: full-length back view, respectfully waiting with lowered arms, satchel at anatomical LEFT hip. RIGHT MORDEN: seated, hands together in lap, glancing sideways toward the king to image left with a faint enigmatic smile.
```

**A-57. 第一章 report_w04「王宮背景を固定」人物のみの再制作** `art/story-review/chapter1/report_w04.png` (済)
- ユーザー訂正: 王宮背景は一切変えない。正面基準の原画をそのまま使い、人物と場面の小道具だけを透明レイヤーで重ねる。背景の描き直し・拡縮・色調補正をしない。
- 以下は完成絵ではなく人物素材の生成指示。背景と人物素材の合成で完成原画を作り、透明部分の画素一致を検査する。倉庫の report_w01 は別室として現状を保つ。
```text
...except: This output is NOT a finished scene. Generate ONLY a TRANSPARENT RGBA FOREGROUND CHARACTER ASSET, landscape 1536x1024. The final scene will be assembled on the EXACT UNMODIFIED palace-front.png. The user explicitly forbids repainting even a single architectural feature. The source scene is narrative reference ONLY; do NOT copy its background, chairs or stairs. Draw exactly THREE isolated character cutouts in THREE SEPARATE WIDELY SPACED COLUMNS on true transparent background: LEFT column x=0..500 contains ONE seated king, CENTER column x=520..1010 contains ONE full-length apprentice seen from the back, RIGHT column x=1030..1535 contains ONE Morden. Each figure is complete, not cropped. Keep wide transparent gaps between figures; no overlap, no contact shadows, no floor, no scenery, no chair or stool, no throne, no furniture, no arches, no windows, no candles, no rectangular background, no checkerboard painted into the image. A seated person is drawn in seated posture with clothing naturally draping and their boots beneath, but with the chair COMPLETELY INVISIBLE and transparent. Hands rest naturally at elbow/armrest height without drawing armrests. Match lavish fine-grained pixel-textured dark fantasy artwork, warm amber rim light from both sides and subtle cool frontal fill, as though these characters occupy palace-front.png. King exactly matches king.png, long white hair and beard, gold pointed crown, red gold-embroidered robe and spotted white ermine cape, no lap blanket. Apprentice exactly matches apprentice.png, tousled brown hair, black gold-embroidered cloak, brown leather crossbody satchel on anatomical LEFT hip, no lantern. Morden exactly matches morden.png, same ageless pale gaunt face and dark eyes, black-purple tall ceremonial hat, red inner robe, black-purple outer robe and gold chain with red gem; no chest opening. Keep TWO arms and natural five-fingered hands per person. No text, labels or panels. LEFT KING: seated, eyes lowered, left hand against his beard, right hand resting at armrest height. CENTER APPRENTICE: full-length back three-quarter view facing image right, lowered hand holds a small tied brown purse with three gold coins just visible, satchel on anatomical LEFT hip. RIGHT MORDEN: standing full length, right hand extending a restrained open-handed gesture toward king at image left, thin composed smile.
```

**A-58. 第一章 minePass「王宮背景を固定」人物のみの再制作** `art/story-review/chapter1/minePass.png` (済)
- ユーザー訂正: 王宮背景は一切変えない。正面基準の原画をそのまま使い、人物と場面の小道具だけを透明レイヤーで重ねる。背景の描き直し・拡縮・色調補正をしない。
- 以下は完成絵ではなく人物素材の生成指示。背景と人物素材の合成で完成原画を作り、透明部分の画素一致を検査する。倉庫の report_w01 は別室として現状を保つ。
```text
...except: This output is NOT a finished scene. Generate ONLY a TRANSPARENT RGBA FOREGROUND CHARACTER ASSET, landscape 1536x1024. The final scene will be assembled on the EXACT UNMODIFIED palace-front.png. The user explicitly forbids repainting even a single architectural feature. The source scene is narrative reference ONLY; do NOT copy its background, chairs or stairs. Draw exactly THREE isolated character cutouts in THREE SEPARATE WIDELY SPACED COLUMNS on true transparent background: LEFT column x=0..500 contains ONE seated king, CENTER column x=520..1010 contains ONE full-length apprentice seen from the back, RIGHT column x=1030..1535 contains ONE Morden. Each figure is complete, not cropped. Keep wide transparent gaps between figures; no overlap, no contact shadows, no floor, no scenery, no chair or stool, no throne, no furniture, no arches, no windows, no candles, no rectangular background, no checkerboard painted into the image. A seated person is drawn in seated posture with clothing naturally draping and their boots beneath, but with the chair COMPLETELY INVISIBLE and transparent. Hands rest naturally at elbow/armrest height without drawing armrests. Match lavish fine-grained pixel-textured dark fantasy artwork, warm amber rim light from both sides and subtle cool frontal fill, as though these characters occupy palace-front.png. King exactly matches king.png, long white hair and beard, gold pointed crown, red gold-embroidered robe and spotted white ermine cape, no lap blanket. Apprentice exactly matches apprentice.png, tousled brown hair, black gold-embroidered cloak, brown leather crossbody satchel on anatomical LEFT hip, no lantern. Morden exactly matches morden.png, same ageless pale gaunt face and dark eyes, black-purple tall ceremonial hat, red inner robe, black-purple outer robe and gold chain with red gem; no chest opening. Keep TWO arms and natural five-fingered hands per person. No text, labels or panels. LEFT KING: seated, left hand extending ONE small parchment pass with red wax seal toward image right, right hand resting at armrest height. CENTER APPRENTICE: full-length back three-quarter view facing image left, BOTH hands raised together around chest level to respectfully receive the pass from the king to image left; do not draw another pass; satchel at anatomical LEFT hip. RIGHT MORDEN: seated calmly with hands on lap.
```

**A-59. 第一章 report_w05「王宮背景を固定」人物のみの再制作** `art/story-review/chapter1/report_w05.png` (済)
- ユーザー訂正: 王宮背景は一切変えない。正面基準の原画をそのまま使い、人物と場面の小道具だけを透明レイヤーで重ねる。背景の描き直し・拡縮・色調補正をしない。
- 以下は完成絵ではなく人物素材の生成指示。背景と人物素材の合成で完成原画を作り、透明部分の画素一致を検査する。倉庫の report_w01 は別室として現状を保つ。
```text
...except: This output is NOT a finished scene. Generate ONLY a TRANSPARENT RGBA FOREGROUND CHARACTER ASSET, landscape 1536x1024. The final scene will be assembled on the EXACT UNMODIFIED palace-front.png. The user explicitly forbids repainting even a single architectural feature. The source scene is narrative reference ONLY; do NOT copy its background, chairs or stairs. Draw exactly THREE isolated character cutouts in THREE SEPARATE WIDELY SPACED COLUMNS on true transparent background: LEFT column x=0..500 contains ONE seated king, CENTER column x=520..1010 contains ONE full-length apprentice seen from the back, RIGHT column x=1030..1535 contains ONE Morden. Each figure is complete, not cropped. Keep wide transparent gaps between figures; no overlap, no contact shadows, no floor, no scenery, no chair or stool, no throne, no furniture, no arches, no windows, no candles, no rectangular background, no checkerboard painted into the image. A seated person is drawn in seated posture with clothing naturally draping and their boots beneath, but with the chair COMPLETELY INVISIBLE and transparent. Hands rest naturally at elbow/armrest height without drawing armrests. Match lavish fine-grained pixel-textured dark fantasy artwork, warm amber rim light from both sides and subtle cool frontal fill, as though these characters occupy palace-front.png. King exactly matches king.png, long white hair and beard, gold pointed crown, red gold-embroidered robe and spotted white ermine cape, no lap blanket. Apprentice exactly matches apprentice.png, tousled brown hair, black gold-embroidered cloak, brown leather crossbody satchel on anatomical LEFT hip, no lantern. Morden exactly matches morden.png, same ageless pale gaunt face and dark eyes, black-purple tall ceremonial hat, red inner robe, black-purple outer robe and gold chain with red gem; no chest opening. Keep TWO arms and natural five-fingered hands per person. No text, labels or panels. LEFT KING: seated with ONE small open leather journal resting across his knees, pages only illegible scribbles. His left hand rests naturally at armrest height, his right hand raised in a firm but restrained dismissive gesture toward image right. CENTER APPRENTICE: full-length rear view with lowered arms, waiting respectfully, satchel at anatomical LEFT hip. RIGHT MORDEN: standing full length, leaning slightly forward with one hand reaching toward king at image left then pausing at the dismissive gesture, chest covered completely, no second book.
```

**A-49. 第一章 report_w01「鎮魂灯と眠っていた人業」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/report_w01.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/report_w01-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. Redraw the apprentice receiving the sleeping adult-sized wooden articulated doll in the royal storeroom after the audience. A palace keeper opens the door while the apprentice cradles the complete limp doll with BOTH arms. The doll has a blank smooth round wooden head with no face, black iron joints, exactly two arms and two legs, and a simple worn ivory cloth. Maintain the palace reference materials, carved grey stone, black iron, aged gold, restrained burgundy hangings, warm amber candles and cool cloudy night light through a narrow lancet window. This is a separate modest storage room with wooden shelves, old folded cloth, chests and stored armour, NOT the throne room: no throne, dais or central red carpet. No king or chancellor here; no granting souls. No dangling orange lantern; the master blue lantern has been carefully put away. Recompose completely while preserving the narrative. CRITICAL NEW COMPOSITION: a wider side-on view from near the storeroom doorway. Put the apprentice and the cradled doll in the LEFT half, in full-length side profile walking LEFT toward the exit, while the palace keeper stands small in the RIGHT background beside the open door. The doll head lies toward image left and its bent legs toward image right. The back wall has NO window: carved grey stone ribs and shelves of folded burgundy cloth, chests and armour in the RIGHT half. Cool light enters from the open doorway. Do not reuse the original frontal central-figure composition, window placement, pose or shelves layout. Remove ALL hanging lanterns from the apprentice and doll; his satchel is closed at the left hip.
```

**A-50. 第一章 report_w02「祈りの終わらない場所」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/report_w02.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/report_w02-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. The old king sits on the fixed central throne and calmly tells the apprentice about the underground abbey. The apprentice stands respectfully at the foot of the five shallow steps, seen from behind in three-quarter view. The chancellor sits quietly in the smaller chair EAST of the throne. Camera from southwest entrance-left, looking northeast, with a diagonal red runner and the dais in the right half, matching palace-left. No desk or giant map table between the characters. No abbey, ruins or underground dungeon visible outside the palace windows. Focus on the king making a small explanatory gesture, the listening apprentice, and the coherent palace architecture.
```

**A-51. 第一章 report_w03「封じた者の沈黙」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/report_w03.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/report_w03-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. The apprentice reports the abbey memory at the foot of the dais. On the central throne the king has turned his eyes away from the chancellor in troubled silence, one hand against his beard, the other resting naturally on the armrest. Morden sits in the smaller fixed EAST chair and glances sideways at the king with his thin enigmatic smile. A medium-wide frontal composition retains both paired lancet windows, banners, five shallow steps and the central runner. No giant desk, mine entrance, giant key, granted scroll or extra thrones. Focus on the tense distance between the two seated rulers and the apprentice below.
```

**A-52. 第一章 report_w04「答えを飲み込んだ王」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/report_w04.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/report_w04-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. The apprentice has reported the underground black water and stands at the foot of the dais in the left foreground. The king sits in the central throne, pauses and lowers his eyes without answering, one hand near his beard. Morden stands immediately in front of his smaller EAST chair on the kings right as seen from the entrance, making a restrained open-handed interrupting gesture toward the king, a thin composed smile. A small tied purse of gold coins rests in the apprentices visible hand. Camera from southwest entrance-left, northeast toward the dais, matching palace-left. No large map desk, river inside the palace, severed arm on display or second king.
```

**A-53. 第一章 minePass「三つの宝と古い封」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/minePass.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/minePass-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. The old king sits on the central throne and leans slightly forward to hand one small parchment pass with a red wax seal to the apprentice, who stands on the uppermost step and receives it respectfully. Keep the throne on the north dais, the smaller chancellor chair on its EAST side and the small round side table near the throne. On a narrow portable offering stand at the SIDE of the dais are three small velvet-lined trays holding a cyan-glass reliquary, an iron shackle and an old iron key: three kinds of submitted treasures. This is the palace audience after the treasury offering, NOT the mine itself. No enormous mine gate, cave, extra room, map desk or floating soul. Medium-wide frontal three-quarter view with architecture and carpet clearly readable.
```

**A-54. 第一章 report_w05「捨て砦の門が開く」王宮の基準に合わせた全面描き直し** `art/story-review/chapter1/report_w05.png` (済)
- ユーザー指示 (2026-10-19): 第一章の王宮関連6枚を王宮の見本に合わせてすべて描き直す。旧構図の保持より王宮の正面基準を優先。本文と人物の正典は保つ。
- 修正前は `art/story-review/fixes/report_w05-palace-before.png` に保存。倉庫は別室、それ以外は同じ玉座の間。
```text
...except: Redraw the ENTIRE FIRST IMAGE as a new coherent narrative illustration for the users 2026-10-19 palace-standardization request; the old composition and architecture are superseded. Use palace-front.png as the authoritative architecture and furniture reference, and palace-left.png only for camera angle. Match exactly the carved grey gothic stone, clustered columns, dry charcoal-black stone floor, aged gold and black iron, burgundy textiles. In the throne room retain ONE tall pointed black-and-gold burgundy throne on the north dais, FIVE shallow steps, ONE smaller chancellor chair EAST (right when viewed from entrance), paired lancet windows with burgundy banners outward, and the central gold-edged burgundy runner. No giant map desk or extra throne. Chapter ONE, before the hundredth-year blue sky: cloudy cool night outside, warm amber candles indoors; no frost or snow. The king matches king.png, third-chapter-or-earlier version: very old, long white hair and beard, pointed gold crown, red embroidered robes, black-spotted white ermine cape, no lap blanket. The apprentice matches apprentice.png: young adult, tousled brown hair, charcoal-black gold-embroidered traveling cloak and brown satchel at LEFT hip. Morden matches morden.png: ageless gaunt pale unlined face, sunken dark eyes, tall black-purple gold-banded ceremonial hat, red inner robe and heavy gold chain with red jewel; no chest opening or soul light. No readable writing, no added secrets. Exactly two arms per person and anatomically plausible hands. The king sits on the fixed central throne after reading Ordos small leather journal, which lies open across his knees with illegible scribbles. One hand grips the throne armrest; he raises the OTHER hand in a restrained firm gesture dismissing Morden and opening the way to the abandoned fort. Morden stands beside his smaller EAST chair, interrupted in reaching for the journal, his chest entirely covered. The apprentice waits at the foot of the steps in the left foreground. Camera from southwest looking northeast, matching palace-left. Warm candlelight, cool cloudy night beyond the paired lancet windows. No giant desk, map, mine gate, distant fort inside the room, hand-held candle or extra book in Morden hands.
```

**A-48. 第七章 w26_splint「腕の木の添え木」戦士の右脚の位置と太さ** `art/story-review/chapter7/w26_splint.png` (済)
- ユーザー指示: 戦士の右脚の位置と太さを修正。足先だけの補修をやめ、基準シートの戦士の立ち姿に合わせて、腰から二本の細身の腿・同じ高さの膝・同じ長さのすね・足首・足がつながるよう、下半身を描き直す。盾とランタンの陰になる部分は自然に隠す。
- 戦士の上半身・盾・剣・ランタン、他の人物、氷、紙などの小道具、背景と光は保つ。修正前は `art/story-review/fixes/w26_splint-warrior-right-before.png` に保存。
```text
...except: REBUILD THE ENTIRE LOWER-BODY ANATOMY of the red-cloaked warrior doll at far left, from its existing belt and pelvis down to the ground. Use the WARRIOR in the doll reference sheet as the exact model of a simple balanced standing pose and slim articulated legs. The current warrior's legs have different apparent thicknesses, knee heights and shin lengths, and one leg is displaced sideways. Correct this underlying anatomy instead of patching just a boot. Keep the pelvis in its original place under the belt; TWO slim thighs descend from the left and right hip joints into TWO small black-iron knees at the SAME HEIGHT, then TWO equally long slim wooden shins with narrow fitted dark metal greaves, TWO compact ankles and TWO modest feet resting beneath their respective hips. BOTH legs should have matching thickness, adult proportions and structure like the reference, with tapered shins, not thick cylinders. In 1536x1024 coordinates, the hips are centered around x=165,y=245; place the knees approximately x=125 and x=195,y=350, ankles near x=115 and x=195,y=485, and feet near x=110 and x=195,y=510. The exact visible portions may be naturally hidden by the UNCHANGED shield, red cloth and foreground lantern. Knee diameter about 24-28 pixels, lower-leg width about 16-22 pixels, foot length about 35-40 pixels: neither leg should be substantially bulkier than the other. Remove the existing misplaced short thick shin under the outer red hem and any leftover overwide knee, duplicate leg outline, sideways armor or floating foot. The warrior's OWN RIGHT leg is at image-left and must align down from its own right hip rather than splay toward the left edge; also align the companion leg to keep the whole stance coherent. Keep both legs near-vertical and relaxed with only a slight natural outward angle of the feet. Retain the original waist, hanging red-and-white garment and red cloak; adapt their LOWER folds only enough for correct limb anatomy. Do not change the torso, head, arms, hands, sword, shield or lantern. Do not move or resize the warrior. Preserve every other part of the FIRST image: priest, thief, purple-robed mage, apprentice, faces, costumes, pose, ALL foreground ice shards, wood shavings, rope ends, one stone-weighted paper, footprints, waterfall, swamp, architecture, framing, detailed pixel texture, colors and light. Repaint only the exposed small areas where wrong legs were erased with matching cloth or mud. No extra limbs, no horizontal armor, no new objects or readable text. The other images are anatomy and identity references only; edit the FIRST scene image.
```

**A-47. 第七章 w26_splint「腕の木の添え木」戦士の足を体の下へ戻す** `art/story-review/chapter7/w26_splint.png` (済)
- ユーザーの追加指示: 戦士の人業の足の位置を修正。ランタン右奥に残る横向きの脚・靴のような塊を消し、腰から下りたすねのすぐ下に、小さな接地した足を描き直す。足が横に長く伸びる形を残さない。
- 戦士以外の人業・弟子・小道具・背景・光は保つ。修正前は `art/story-review/fixes/w26_splint-warrior-before.png` に保存。
```text
...except: edit ONLY the small patch x=165-310,y=440-555 around the far-left red-cloaked warrior's lower shin and foot behind the orange lantern. Remove the long horizontal armored calf/boot lying across that patch. Replace it with ordinary wet mud, sparse reeds and ONE compact armored foot directly beneath the warrior's vertical shin near x=205,y=465. The foot occupies only x=195-240,y=480-510, planted flat on the bank, pointing slightly toward the viewer. Connect this small foot naturally to that shin; do not extend it sideways toward the priest. Preserve the other leg where the lantern hides it. If TWO scene references are attached: the FIRST is the base image and must be preserved; the SECOND shows the correctly placed compact foot and cleared muddy patch to copy ONLY into that small region of the FIRST. Do not copy any other part of the second image. Everything outside x=165-310,y=440-555 MUST remain exactly as in the FIRST image. In particular, keep ALL the original ice shards and their reflections across the diagonal foreground band x=190-650,y=560-820. Do not remove, move or simplify that ice. Preserve every person, the apprentice's face and cape, all other dolls, the lantern, shavings, rope ends, single note, stone, footprints, background, camera and lighting unchanged. No extra feet, no horizontal armor, no new objects. Return the FIRST image with just this localized foot correction.
```

**A-46. 第七章 w26_splint「腕の木の添え木」後列の人業の脚を整理** `art/story-review/chapter7/w26_splint.png` (済)
- ユーザー指示: 後ろにいる人業の足の位置と本数を修正。四体それぞれの腰から左右一本ずつ、腿・膝・すね・足首・足が自然につながるようにする。弟子や衣装の陰に隠れた脚は隠し、離れた場所に足だけを描かない。
- 保つもの: 四体の顔のない丸い木の頭・上半身・衣装・武器、弟子、ランタン、氷、削りくず、縄の切れ端、石で押さえた一枚の紙、足跡、背景、構図と光。修正前は `art/story-review/fixes/w26_splint-legs-before.png` に保存。
```text
...except: repair ONLY the anatomically confused lower bodies, legs and feet of the FOUR wooden party dolls standing behind the kneeling apprentice. Each doll has exactly ONE pelvis, TWO thighs, TWO knees, TWO shins, TWO ankles and TWO feet, continuously connected with believable black iron articulated joints. Do not force eight feet to be visible: legs genuinely hidden behind the apprentice, the lantern or a robe must stay hidden rather than reappearing as orphan boots elsewhere. The far-left red-cloaked armored warrior stands naturally on two legs beneath its own hips; retain lantern occlusion. Specifically REBUILD the warrior's present sprawled lower body into a simple upright standing pose: two slim armored thighs descend from its own hips around x=150,y=240, knees near x=85 and x=185,y=365, shins descend toward two planted feet near x=80 and x=200,y=520 (1536x1024 coordinates). REMOVE the disconnected sideways armored calf/boot sprawled across x=160-300,y=445-555 immediately behind and to the right of the orange lantern; restore ordinary muddy ground there except the one correctly aligned planted warrior foot. No horizontally lying armored limbs, no crouching warrior, no third knee or spare boot. Keep the lantern and shield unchanged in front of the proper legs. The white-robed priest has two clearly separated slim wooden lower legs descending from its own hips beneath its robe, and just two planted feet immediately below, not a cluster of additional armored boots. The dark-leather thief at center-back has two legs correctly attached to its pelvis, with natural standing alignment and most of the lower body occluded by the apprentice; remove the stray splayed leg and detached dark feet crowded between the priest and the apprentice. The purple-robed mage at rear-right has two anatomically placed legs beneath its robe, mostly concealed by the foreground apprentice; do not add feet protruding from the apprentice or disconnected from the mage. Match the existing dolls reference for wooden limbs, compact black iron knees and ankles, adult proportions, and plain smooth faceless wooden heads. Reconstruct only the small exposed ground or robe folds where false limbs are removed. Preserve the existing camera, framing, all four heads, torsos, arms, hands, costumes above the hips, weapons, shields, the apprentice's exact anatomy and pose, the orange lantern, every half-melted ice fragment, wood shavings, short cut-off rope ends, the ONE stone-weighted note, footprints, waterfall, swamp, architecture, colors, fine pixel texture and lighting. No new characters, no extra limbs, no abandoned doll arms, no new objects, no readable text. Edit the FIRST image; the other references establish identity and doll anatomy only.
```

**A-45. 第七章 w26_splint「腕の木の添え木」持ち去った腕を岸から除く** `art/story-review/chapter7/w26_splint.png` (済)
- 腕の添え木は師が脚に当てて持ち去った。手前の縄で束ねた木の腕二本と、その結び目の紙を除き、木の削りくずと短い縄の切れ端に替える。紙は一枚だけ、平たい石で押さえて泥の上に残す。弟子が手に持つ紙をその一枚として地面へ移し、弟子はその紙に手を伸ばす。氷のかけら・人物・背景・光・画風は保つ。
```text
...except: correct ONLY the evidence on the muddy shore. The master took the two wooden doll arms away strapped to his injured leg; no abandoned wooden arms or intact bundled wooden splint should remain here. Remove the two thick parallel wooden rods with black iron joint rings, their binding rope and the little note tucked into that rope in the lower foreground. Replace those rods with just a small scattering of fine curled wood shavings and a few short cut-off rope ends lying naturally on the wet mud. Remove the folded paper held in the apprentice's raised hand and place that same single paper on the newly exposed muddy ground, partly held down by a small flat grey stone; adapt only that hand so it reaches toward the paper rather than holding another sheet. Keep ONE note total, bearing only illegible scribbles. Preserve the apprentice's face, hair, cloak, pose except that hand, all four party dolls, the orange lantern, ALL half-melted ice fragments, footprints, swamp, waterfall, architecture, framing, fine pixel texture and warm/cool lighting exactly. No Ordo, no wooden arms, no bundled rods, no extra notes, no readable text.
```

**A-44. 第六章 report_w23「済まされていなかった処刑」王宮の凍結を除去** `art/story-review/chapter6/report_w23.png` (済)
- ユーザー指示 (2026-10-17): 王宮を通常の玉座の間へ戻す。氷窟から帰っての報告であり、王宮は凍っていない。
- 直すもの: 床・段・柱・窓枠・彫像・椅子・備品に積もる雪や氷、つらら、白い霜を取り除く。濡れて凍った床は磨かれた濃色の石床へ、窓は霜のない透明なガラスへ戻す。窓の外の王都にも雪や氷を描かない。通常の灰色の石造、黒鉄と金、深紅の織物、暖かな蝋燭の光にそろえる。
- 保つもの: 老王の顔・白い髪とひげ・王冠・赤と白の衣装・灰色の膝掛け、手と羊皮紙、弟子の姿と礼、宰相の空の椅子、画面の構図と細かな画風。第六章なので窓の外は従来の曇った空のまま。修正前は `art/story-review/fixes/report_w23-before.png` に保存。
```text
...except: remove ALL ice, frost, snow and icicles from the throne room, including the floor, steps, columns, statues, window mullions, chair edges and furnishings. This is an ordinary inhabited royal palace, NOT the frozen dungeon the apprentice has just returned from. Restore clean dry grey carved stone, polished dark stone flooring with restrained candle reflections, unfrosted clear glass, black iron and gold details, and deep red textiles. Remove snowy or icy coatings from the city architecture visible outside. Give the room its normal warm amber candlelit atmosphere, retaining subtle cool light from the overcast windows. This chapter takes place before the blue sky returns: preserve the overcast sky rather than adding sunshine. Preserve the king's exact identity, white hair and beard, crown, red and white robes, grey lap blanket, both hands and the parchment; the apprentice's exact identity, costume, bowed pose and hands; the empty chancellor's chair, all furniture locations and the entire composition. Keep the same detailed fine-grained pixel-textured style. The king's white fur and grey blanket are cloth and fur: retain them unchanged. Do not add people, text or new objects.
```

**A-43. 第六章 irene_coat「師の外套」外套の形と印の向き** `art/story-review/chapter6/irene_coat.png` (済)
- ユーザー承認の修正方針 (2026-10-17): 承認済み `docs/art/story-refs/ordo.png` の高い襟・左右の袖・長い身頃がつながる黒外套へ整える。肩と胴を卓上に横たえ、袖を自然に折り、イレーヌが裾を持ち上げる。重なった別の衣や腰帯に見える形を整理する。
- 裾の小さな金糸の印は一つだけ。`docs/art/story-refs/sigil.png` の形を保ち、手首を裾の端へ、炎の先を襟・肩側へ向け、布の傾き・折れに沿わせる。画面の上下を基準に直立させない。
- 保つもの: イレーヌの顔・髪・衣装・手、燭台、背景、構図、暖色と寒色の光、黒布の古びた質感、氷と水滴。
```text
...except: correct ONLY the recovered black travel coat and its single small gold-thread hem crest. Match docs/art/story-refs/ordo.png: ONE empty slim long worn black wool coat, with a high collar, two recognizable long sleeves and continuous long body panels. Make its construction readable on the table: the collar and shoulders lie at image-right beneath Irene's raised hand, the body extends diagonally toward the lower-left foreground, two empty sleeves are naturally folded beside the body, and Irene's lower hand lifts ONE bottom hem corner. Remove confusing redundant garment layers and the loose buckled belt. Keep the coat empty, with no torso, limbs or person inside. Use the approved geometric crest in docs/art/story-refs/sigil.png exactly, with ONE left thumb, THREE parallel right finger projections, a short wrist and ONE detached teardrop flame. Embroider it only once, small, on the lifted bottom hem. Orient the crest in the COAT'S own coordinates: its wrist points toward the nearby bottom hem edge, while its flame tip points along the body toward the collar and shoulders at image-right/upper-right. Rotate and foreshorten the entire symbol with the lifted fabric plane; do not leave it upright relative to the screen and do not mirror it. Preserve Irene's exact face, hair, costume, hands and pose, the existing compact brass candlestick and white candle, framing, background and fine pixel texture, warm amber and cool blue lighting. Keep natural ice on the shoulder and one edge and beads of meltwater. No extra embroidery, gold trim, satchel, text or new people.
```

**A-41. 館の灯をオープニングの燭台へ統一** (済) `art/story-review/prologue/irene-soul-lamp.png`・`art/story-review/chapter1/irene_boons.png`・`art/story-review/chapter1/irene_familiar.png`・`art/story-review/chapter1/irene_fort.png`・`art/story-review/chapter2/irene_roots.png`・`art/story-review/chapter2/irene_sera.png`・`art/story-review/chapter3/irene_undercity.png`・`art/story-review/chapter2/irene_omokage.png`・`art/story-review/chapter3/irene_trust.png`・`art/story-review/chapter3/ch3_end.png`・`art/story-review/chapter4/ch4_end.png`・`art/story-review/chapter5/irene_abyss.png`・`art/story-review/chapter5/irene_furnace.png`・`art/story-review/chapter5/irene_husks.png`・`art/story-review/chapter6/irene_coat.png`・`art/story-review/chapter6/irene_frozen.png`・`art/story-review/chapter6/irene_lineage.png`・`art/story-review/chapter7/irene_order.png`・`art/story-review/chapter8/irene_bell.png`・`art/story-review/chapter8/irene_rain.png`・`art/story-review/chapter10/irene_names.png`・`art/story-review/chapter10/irene_candle.png`・`art/story-review/chapter11/irene_lastpage.png`・`art/story-review/chapter11/irene_onlyonce.png`・`art/story-review/chapter11/irene_why.png`

- ユーザー指定 (2026-10-16): オープニング第六幕「師の灯」を基準に、主役の燭台の台座・支柱・受け皿・白い蝋燭の太さを統一する。人物と本文は保つ。背景の照明と青いランタンは対象外。

```text
...except: standardize ONLY the principal single white candle and its brass candlestick guarded by Irene, using the attached art/story-review/opening/flame.png as the exact physical prop reference. Match the SAME compact polished brass candlestick: a broad stepped circular foot, short turned baluster stem, flared cup socket and wide shallow round wax-catching rim. The metal holder is approximately 1.6 times the candle wax height; its foot is about 2.4 times the candle width. Use ONE thick ivory-white pillar candle with irregular melted upper edge and vertical wax drips, and ONE warm yellow-white flame with amber-orange glow. Replace tall thin shafts and mismatched holders with this compact silhouette. Keep the existing contact point on the tabletop and adapt perspective and scale naturally to the people, with candle width approximately 5-6 cm; restore background exposed by removing a tall shaft. Preserve the flame behavior required by this scene. In the scene with Irene at image-left and the apprentice and departing dolls at the open doorway on the right (ch3_end), make the principal flame conspicuously TALL, about 1.5 times the height of the white wax candle itself, one slender continuous upward yellow-white flame with amber glow. At irene_lastpage keep the flame small and steady. If Irene holds or trims the candle, preserve her hands and their existing interaction. Do not standardize background candles, multi-arm candelabra, hanging lamps, the blue soul-fire hand lantern or Sera's chest light. Preserve all faces, eyes, hair, crests, hands, costumes, wooden doll anatomy, narrative objects, framing, fine pixel texture and warm/cool lighting exactly. Edit the FIRST image only; the opening landscape is only a prop reference and must not become the background. No text or new objects.
```


**A-40. 第三章 report_w11「師の師」王の重複した左腕の修正** `art/story-review/chapter3/report_w11.png` (済)

- ユーザー指定: 「師の師」の王の左手が2本ある。口元に添えた左手を残し、画面右下の肘掛けを握る余分な左手・前腕を取り除く。衣のひだで自然につなぎ、ほかは保つ。

```text
...except: correct ONLY the king's duplicated left arm. Preserve his left hand touching his mouth and its connected bent arm. Remove the extra left hand gripping the armrest at image-right near x=990,y=600 and the attached extra forearm and sleeve below the mouth-touching arm. Replace this extra limb with natural folds of his red embroidered robe and white black-spotted ermine cape lying close to his torso and lap; leave the carved armrest visible and unoccupied. The king's right arm remains concealed behind the open book at image-left; do not add a hand. Preserve his face, crown, beard, pensive posture, apprentice, open book, map, throne, background chair, architecture, composition, fine pixel texture, colors and lighting exactly. Make no other changes.
```



**A-39. 第十章 pre_w41「階段の前の宰相」地面の足跡を除去** `art/story-review/chapter10/pre_w41.png` (済)
- ユーザー指定 (2026-10-16): 画面下部中央やや右の石床にある、足裏の形をした二つの深い跡を消し、周囲と同じ石畳に戻す。本文は変えない。
- 保つもの: 人物・手指・衣装・灯籠・札・書見台・石段・伽藍・構図・画風・光。床の修正範囲外は保つ。
```text
...remove ONLY the TWO conspicuous foot-shaped depressions in the stone floor in the lower center-right of the attached illustration (roughly x=950-1180, y=705-830 on the 1536x1024 image). Completely erase both dark sole silhouettes, their heel/toe indentations, rims and internal shadows. Reconstruct continuous ordinary worn gothic stone paving in those two small regions, matching the surrounding irregular slab texture, joints, cracks, perspective and warm amber/cool cyan lighting. Keep the horizontal step edge in front intact. The finished floor must have no recognizable footprints, shoe prints, sole shapes or paired foot-shaped hollows. Preserve every other part of the illustration exactly: all people, faces, hair, hands, costumes, lanterns, tags, lectern, stairs, architecture, composition, colors, crisp fine pixel texture and lighting. Do not move any object or change the camera. No new objects or readable text.
```

**A-38. 第二章 report_w09「先代という仮面」（ゲーム内「先代の王」）** `art/story-review/chapter2/report_w09.png` (済)
- ユーザー指定 (2026-10-15): 弟子が持つ手紙を、`art/story-review/chapter2/mem_w09.png`「砦を捧げた書状」と同じ書状にする。赤い封蝋を横に二つ並べ、左を金の王冠の王家の紋、右を参照と同じ金の宰相府の紋にし、赤金の組紐も合わせる。手に持つ角度と縮尺に合わせる。
- 保つもの: 王と弟子の顔・姿勢・手・衣装、空の宰相の席、玉座の間、構図、画風、光。本文は変えない。
```text
...except: correct ONLY the parchment letter held by the apprentice in the foreground. Use art/story-review/chapter2/mem_w09.png as the exact reference for the SAME physical letter: aged parchment with illegible ink scribbles and TWO glossy deep red wax seals side by side across its lower portion, each with a gold embossed emblem and matching short red-and-gold twisted cords. The LEFT seal bears the identical gold royal CROWN emblem. The RIGHT seal bears the identical gold chancellery emblem from the reference (the branching upright staff/cross-like heraldic design, not a crown and not a lamp or flame). Replace the current vertically stacked mismatched seals. Match both silhouettes, colors, emblems, relative arrangement and cords to the reference letter, adapted to the perspective and small size of the parchment held in the apprentice's hands. Keep the paper naturally held in the existing hands. Preserve every other part of the original illustration, including the king, apprentice, hands, costumes, empty chancellor chair, architecture, framing, fine pixel texture and lighting. Do not copy the fortress scene. No readable lettering.
```

**A-37. 第一章 irene_reveal「レースの下の継ぎ目」** `art/story-review/chapter1/irene_reveal.png` (済)
- ユーザー指定 (2026-10-14): 手首のレース下のロボット状の機構を除去し、レースを肘までめくって、他の人業と同じ黒鉄の肘の継ぎ目を見せる。白い手首と前腕は滑らかにする。
- 本文もユーザー指示に合わせ「白い手首に、」を「白い手首の先に、」へ変更。一覧の説明も肘の継ぎ目にそろえる。
- 保つもの: イレーヌと弟子の顔・髪・衣装、台のセラの腕、館の背景、構図、画風、光。
```text
...except: Irene lifts and gathers the black lace sleeve of her raised arm all the way up to just above her ELBOW with her other hand, revealing her smooth pale ivory wrist and full forearm and a clearly visible BLACK IRON ARTICULATED ELBOW JOINT. The elbow is located at the lower end of her raised forearm, near the tabletop, anatomically connecting her upper arm and forearm. Match the simple rounded hinge and black iron joint bands of the wooden party dolls reference and the detached wooden arm already on the table. Remove the entire long exposed robotic mechanism currently running along her wrist and forearm: no pistons, rods, gears, wires, exoskeleton or metal forearm plating. Her wrist, hand and forearm remain smooth pale ivory with natural adult proportions; the only exposed black iron mechanism on Irene is the compact rounded joint at the ELBOW. Her opposite hand gently gathers the sleeve above that elbow, rather than pointing at her wrist. Preserve Irene's exact face, purple eyes, hair, jewelry, gown, the apprentice, the detached Sera arm on the table, every background object, framing, detailed pixel texture and warm candlelight/cool moonlight. This is an edit of the existing composition, not a new scene. No lettering.
```

**A-36. 第一章 report_w04「答えを飲み込んだ王」** `art/story-review/chapter1/report_w04.png` (済)
- 直す: 王の手が3本ある。画面右へ差し出した余分な手と、それにつながる腕・袖を消し、赤い衣と白い毛皮の自然な折り目にする。
- 保つもの: 口元に添えた手、机に置いた手、王の顔と姿勢、宰相、弟子、地図、金貨、構図、画風、光。
```text
...except: the seated king currently has THREE hands. Remove ONLY the extra outstretched hand at image-right, centered near x=1015,y=535, and its attached extra arm and sleeve extending from the king's right side. Replace this extra limb with the natural folds of the king's red robe and white black-spotted ermine cape lying close to his body and lap. Preserve exactly the hand touching his mouth and the hand resting on the table near x=690,y=590, with their existing connected arms: these are his only two hands and arms. Preserve his pensive face and posture, the chancellor's gesturing hand, the apprentice, the map, coins, throne, architecture, composition, pixel texture, colors and lighting. Make no other changes.
```

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

**A-10. 第三章 irene_torso「お帰りを重ねる仕事」** `art/story-review/chapter3/irene_torso.png` (済)
- 直す: セラの頭が髪の無い丸い頭 → 正典のセラの頭 (本物の長い黒髪・木の顔・額の印)。胴の印を胸から外す (印は背中)。
- 保つもの: 台の上の頭・腕1本・胴 (脚は無い)、手紙を読むイレーヌ、弟子。
```text
...except: the wooden head on the velvet is Sera's head exactly as in the attached Sera reference: long wavy near-black real hair spread on the velvet, carved wooden face with closed eyes, small gold palm-and-flame crest on the forehead. Remove any emblem from the front of the torso.
```

**A-11. 第三章 w12_torso「軽すぎる帰りの荷」** `art/story-review/chapter3/w12_torso.png` (済)
- 現行本文への改訂 (2026-10-20): 胸に書付はない。根に絡んだ胴と、もう片方の腕を一緒に回収する。開いた胸の扉には溝・金具・内部機構だけを描く。以下の「紙を残す」は以前の制作履歴であり、今後の改訂ではこの現行指定を優先する。
- 追加のユーザー指示: セラの胴全体を `art/story-review/chapter3/irene_torso.png` と同じ造形にそろえる。胸の膨らみを抑えた平らな木製の外殻、金縁の黒鉄の肩・腰の継ぎ目、短い首の受け口、胸中央の丸みのある縦長の扉と内部機構を合わせる。胸の紙は残す。
- 追加のユーザー指示: セラの胴の乳首を消し、胸の面は滑らかな木目にする。胸の扉と中の紙は保つ。
- 追加のユーザー指示: 腹の低い位置の四角い開口を、`chapter3/irene_torso.png` の胸中央の縦長で角の丸い扉へ合わせる。首の下から胸骨に沿う位置とし、腹は滑らかな木肌に戻す。扉の中の折り畳んだ紙は残す。
- 直す: 胴の胸に星形の紋 → 外す。本文は「背に彫られた、灯を掌に載せた手」なので、胴を少し回して背の印 (掌に炎) が見えるようにするか、胸は無地に。胸の扉と中の紙は保つ。
```text
...except: replace ONLY Sera's detached wooden torso with the EXACT SAME torso design seen on the workbench in the attached art/story-review/chapter3/irene_torso.png reference. Match its flat, gently curved continuous pale wooden chest shell WITHOUT sculpted breasts, compact proportions, short neck socket, panel seams and tiny rivets, black iron shoulder and hip joint sockets with gold rims, and central vertically elongated rounded chest hatch with dark rim and brass hardware. The torso must look like the SAME physical object carried from this discovery to that workshop. Match the reference hatch location and broader rounded-rectangular opening, with its door swung toward the viewer’s left and visible delicate internal brass clockwork, bars and circular fittings. Replace the old narrow hatch and empty dark cavity entirely. Show only fine grooves and brass mechanisms inside the chest cavity: NO paper or note, and no soul-fire before awakening. Include the other detached arm recovered from the same roots beside the torso. Keep the existing orientation and perspective in the apprentice's hands, adapting the reference design to that view. Keep the apprentice, hands, roots, background, composition, fine texture, colors and lighting exactly. No nipples, sculpted breasts, front crest, extra parts or readable writing. Use irene_torso.png as the authoritative torso reference, taking precedence over other character sheets for this object.
```

**A-12. 第三章 mem_w13「魂の流れを登る師」** `art/story-review/chapter3/mem_w13.png` (済)
- 直す: 師がランタンを提げ、外套・鞄が弟子と同じ → 正典のオルド (ランタンなし。右手に根を断ったのこぎりのような刃)。
- 判断: 上端の玉座の間は、本文では直後の報告で王が明かす。小さく遠くに見える程度なら残してよい。
```text
...except: the climbing man is master Ordo: about 55, lean, short grey hair, close-cropped grey beard, plain worn black long coat with only one small gold crest on the hem, leather tool belt; no satchel and NO lantern; he grips a long serrated saw-like blade in one hand while climbing. Light comes from the rising cyan soul streams around him.
```

**A-13. 第三章 w11_hut「三代の師弟が残す頁」** `art/story-review/chapter3/w11_hut.png` (済)
- 直す: ゲーム内の本文は「苔むした石の小屋」「机に突っ伏した骸」。ヴェルナーはオルドが訪ねる前に亡くなっていた (1年以上前)。いまの絵は整った木の部屋で、生きて眠る老人に見え、蝋燭が灯っている → 苔むした石の小屋に。ヴェルナーは机に突っ伏した**骸** (乾いて骨ばった手、くぼんだ顔、ほこりと苔。むごくしない)。部屋の蝋燭は消え、光は弟子の灯と窓の外の魂の光だけ。窓の外に灯の集落を描かない。
- 保つもの: 手記を読む弟子、三代の書き込みのある手記、大樹の根の素描。
```text
...except: the hut is a small moss-covered STONE hut, long abandoned, dust and moss everywhere, no lit candles. Werner is a long-dead body slumped face-down over the desk: dried skeletal hands, sunken features under grey hair and worn ochre robes, peaceful and not gory. Light comes only from the apprentice's warm hand lantern and faint cyan soul-light outside. Remove the lantern-lit walkways and dwellings outside the window; only dark giant roots and mist.
```

**A-14. 第三章 ch3_end「帰る場所から、玉座の下へ」** `art/story-review/chapter3/ch3_end.png` (済)
- 直す: 館の灯が大きなガラスの灯器に青い炎 → 燭台に立てた一本の白い蝋燭。本文は「ひときわ高く燃え上がった」ので、炎を高く明るく。
```text
...except: replace the large glass vessel with blue fire by a single white candle on a tall brass candlestick; its warm flame burns unusually high and bright. Irene stands beside it.
```

**A-15. 第四章 mem_w17「水の底の戴冠」** `art/story-review/chapter4/mem_w17.png` (済)
- 直す: 本文は「幹を昇ってきた男が、王の前に膝をついた。手には、根を断った刃だけを握っていた」。いまの絵は立ったまま、師のランタンを提げ、刃が無く、弟子と同じ外套 → 正典のオルドが神官王の前に片膝をつき、右手にのこぎりのような刃だけを握る。ランタンを消す。
```text
...except: the man is master Ordo (about 55, lean, short grey hair, close-cropped grey beard, plain worn black long coat with one small gold crest on the hem, no satchel), kneeling on one knee before the priest-king, holding ONLY a long serrated saw-like blade in his right hand. Remove the lantern entirely.
```

**A-16. 第四章 w15_mural「老いない横顔」** `art/story-review/chapter4/w15_mural.png` (済)
- 直す (1): 壁画の若い神官が、いまのモルデンと「一つも変わらない」顔に見えない → 正典のモルデンと同じ顔 (やせて青白く、薄い笑み)。白い法衣の若い神官として描き、苗木を抱く。
- 直す (2): 冠を授ける王が、いまの王そっくり → 三百年前の神官王 (白と金の法衣、`chapter4/mem_w17.png` の神官王と同じ)。泉の前で冠を掲げる。
- 直す (3): 地下なのに満月の夜空 → 窓を消すか、水没した暗い神殿の壁に。
- 直す (4): 絵の隅に師の短い書き込み (読めない走り書き) を添える。
```text
...except: (1) the young priest in the mural has exactly Morden's face from the attached reference (gaunt, pale, thin smile) but younger clothing: plain white priestly robes, holding a sapling. (2) the crowning king in the mural is the ancient priest-king in white and gold vestments like the attached mem_w17 reference, raising a crown before a sacred spring — NOT the present white-bearded king in red and ermine. (3) remove the window with the moon and night sky; this temple is drowned underground. (4) add a small handwritten scribble in a corner of the mural.
```

**A-17. 第四章 irene_sera_wake「灯が移った夜明け」** `art/story-review/chapter4/irene_sera_wake.png` (済)
- 追加のユーザー指示: 修正前の元画像のセラの目 (青紫の虹彩・まぶた・視線) を採用。腰から骨盤、左右の脚を自然につなげ、腹の前に浮く大きな腿の筒を除去。白い布の下に脚一対が自然に伸びる形に直す。
- 直す: 本文は「彼女が手に取ったのは、地下墓地で見つけた、師のランタンだった」。いまの絵は大きな据え置きのガラス灯器 → イレーヌが師のランタン (`chapter1/w01_lantern.png` の小さな真鍮の手提げランタン、青白い魂火) を手に持ち、その火が筋になってセラの胸へ流れ込む。セラは正典 (本物の黒髪・額の印)。
```text
...except: remove the large standing glass lamp. Irene holds in her hand the small brass hand lantern from the attached w01_lantern reference; a pale blue soul-fire stream flows from it into Sera's chest. Sera matches the attached Sera reference (near-black real hair, carved wooden face, forehead crest) and opens her eyes. Follow-up user correction: restore Sera's eyes exactly from the original before image, including the pale blue-violet irises, eyelids, gaze and expression. Correct her lower-body anatomy: one pelvis connected naturally to the waist, exactly two adult-proportioned wooden legs extending toward the lower-left end of the workbench, each with one knee and ankle. Remove the oversized displaced thigh cylinders near her abdomen. Cover the pelvis and most legs with the existing white embroidered sheet; its folds follow the continuous body beneath. Preserve everything else in the current edited image.
```

**A-18. 第四章 ch4_end「二つ並んだ影」** `art/story-review/chapter4/ch4_end.png` (済)
- 直す (1): 中央の灯が真鍮の杯の青い炎 → 燭台の白い蝋燭 (本文「館の燭台の灯が、セラの木の頬を照らしている」)。
- 直す (2): セラの頬杖の腕の節が一つ多い → 正しい腕 (肩・肘・手首)。
```text
...except: the central light is a single white candle on a brass candlestick with a warm flame lighting Sera's wooden cheek (no blue flame vessel). Fix Sera's arm so it has exactly one elbow joint between shoulder and wrist.
```

**A-19. 第四章 w16_legs「根の中を歩いた脚」** `art/story-review/chapter4/w16_legs.png` (済)
- 直す: すねの正面のランタンの線画 → 消す。**くるぶしの内側**に小さく、掌に炎を載せた手の印。
```text
...except: remove the lantern drawing from the shin; carve a small palm-up hand holding a flame on the INNER ANKLE of one leg.
```

**A-20. 踏破後 lore_w07 (捨て砦の地下牢)** `art/story-review/dungeons/lore_w07.png` (済)
- 直す: セラの頭のそばに木の手・前腕・手足の筒が並び、一体分あるように見える (腕は取水口・胴は苗床・脚は大水槽で見つかる) → 頭だけにする。髪は正典の色、額の印を正典の形に。
```text
...except: remove the wooden hand, forearm and limb pieces; only Sera's detached head remains on the stone ledge in its cloth. Her real wavy hair is near-black dark brown like the attached Sera reference, with a small gold palm-and-flame crest on the forehead.
```

**A-21. 踏破後 lore_w14 (水底の参道)** `art/story-review/dungeons/lore_w14.png` (いまは使われていない) (済)
- 直す: 鳥居・しめ縄・日本式の石灯籠で和風の神社になっている → 旧都はゴシックの都。`chapter4/w14_lamp.png` と同じ、祠の形のゴシックの石灯籠の列が水底の参道に並ぶ。根・沈んだ供物の宝箱は保つ。直したら `tools/storyart/hold.json` の `hold` から外し、`python3 tools/storyart/build.py` を回す (1-3)。
```text
...except: remove the torii gates, shimenawa ropes and Japanese stone lanterns. The drowned processional way is lined with gothic shrine-shaped stone lanterns like the attached w14_lamp reference, leading to a sunken gothic temple; keep the roots and the sunken offering chests.
```

**A-22. 踏破後 lore_w16 (洗礼の大水槽)** `art/story-review/dungeons/lore_w16.png` (いまは使われていない) (済)
- 直す: 本文は「水は少しずつ濁った。澄んだまま残る泉は、誓いの名残だけ」「底に絡まっていたのは、どこかへ帰ろうとしていた器」。いまの絵は全体が澄んだ明るい水 → 大水槽の水は暗く濁らせ、澄んだ泉が二つだけ光る。底の根に木の脚 (セラの脚) がかすかに絡む。直したら同じく `hold` から外して build.py を回す。
```text
...except: the great baptismal cistern water becomes dark and murky; only two small pure springs still glow clear. Faintly visible at the bottom, roots entangle a pair of wooden doll legs with black iron joints.
```

### 一門の印の確認に基づく局所修正 (2026-10-14)

**A-23. 一門の印の局所修正 irene_torso** `art/story-review/chapter3/irene_torso.png` (済)
- 根拠と判定: 原寸の額の印は炎と複数の短い突起が一体化した形で、承認済みの角張った掌・独立した炎と一致しない。額のみ修正。腕の内側は金の継ぎ目と手の向きで印を判別できず追加は保留。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-24. 一門の印の局所修正 w16_legs** `art/story-review/chapter4/w16_legs.png` (済)
- 根拠と判定: 原寸で印が片足の甲にあると確認。正典はくるぶし内側。甲の印を消し、見える内くるぶし近くの木面に小さく配置する。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: remove ONLY the black crest from the TOP OF THE FOOT closest to the viewer, restoring its existing wood grain. Carve one SMALL dark approved crest into the exposed inner ankle-side wooden surface immediately beside/above that foot's black iron ankle joint. Keep all toes, feet, legs, roots, joints, pose, proportions, the apprentice, and the scene exactly as they are. Do not place it on the shin or the top of the foot. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-25. 一門の印の局所修正 ch5_end** `art/story-review/chapter5/ch5_end.png` (済)
- 根拠と判定: 額の原寸では金の炎だけで掌・右の指3本・手首が見えない。額の印を修正。盾の大きな印は配置根拠不足のため要確認として保持。
- 追加のユーザー指示: セラの背中にある青白い灯は本来胸の魂火なので、背中の灯・金枠・取り付け部分を除去し周囲の木肌・髪・白布を補修。見えない胸側へ新しい灯は追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Keep the existing shield and its gold emblem unchanged: that shield placement is still under review. Also remove the misplaced cyan soul-light, its gold frame and attachment on Sera's BACK, restoring the surrounding wooden back, hair and white draped cloth. The soul-light belongs in the chest; do not add a new light to a hidden chest. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-26. 一門の印の局所修正 irene_husks** `art/story-review/chapter5/irene_husks.png` (済)
- 根拠と判定: 額を広く取り直した原寸で、金の印は圧縮した杯状の掌と上向きの突起。承認済みの斜めの平行な指3本・短い手首とは異なるため額のみ修正。先の狭い切り出しでは掌を見落としたため判定を訂正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-27. 一門の印の局所修正 irene_lineage (済)** `art/story-review/chapter6/irene_lineage.png`
- 根拠と判定: 原寸で額の印が杯状の掌と上向きの短い突起の形。基準の角張った斜めの掌・右の平行な指3本へ額のみ修正。関節内側が隠れる箇所は追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-28. 一門の印の局所修正 irene_crest (済)** `art/story-review/chapter7/irene_crest.png`
- 根拠と判定: 原寸で額と肘の内側の主題の印が杯状の別形。額と肘の既存位置の印のみ承認済み幾何学形へ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Also replace ONLY the small gold crest already shown on the inner elbow joint at the center of the picture with the same approved geometric crest, at its existing position and scale. Do not change any joint or hand anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-29. 一門の印の局所修正 irene_order (済)** `art/story-review/chapter7/irene_order.png`
- 根拠と判定: 原寸で額の印が杯状の掌と上向きの短い突起の形。基準の角張った斜めの掌・右の平行な指3本へ額のみ修正。関節内側が隠れる箇所は追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-30. 一門の印の局所修正 irene_rain (済)** `art/story-review/chapter8/irene_rain.png`
- 根拠と判定: 額の原寸は杯状の掌と上向きの短い指で基準形と異なる。額のみ修正。手首内側は関節の帯と手の角度で隠れるため追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-31. 一門の印の局所修正 irene_rest (済)** `art/story-review/chapter9/irene_rest.png`
- 根拠と判定: 額の原寸で杯状の掌と短い上向きの指を確認。基準の斜めの平行な指3本・角張った掌へ額のみ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-32. 一門の印の局所修正 irene_names (済)** `art/story-review/chapter10/irene_names.png`
- 根拠と判定: 額の原寸で杯状の掌と短い上向きの指を確認。基準の斜めの平行な指3本・角張った掌へ額のみ修正。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-33. 一門の印の局所修正 lore_w02** `art/story-review/dungeons/lore_w02.png` (済)
- 根拠と判定: 原寸の回廊の壁は写実的な手と曲線の炎。承認済み幾何学印へ壁の印だけ置き換える。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the realistic hand-and-flame stone relief inside the round medallion on the right wall with the approved geometric crest, as a stone relief of the same size, perspective, lighting and weathering. Keep the circular border and the entire scene unchanged. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-34. 一門の印の局所修正 lore_w07** `art/story-review/dungeons/lore_w07.png`
- 根拠と判定: 壁の原寸印は幾何学基準に一致。セラの額の印は杯状で上向きの短い突起になっているため額のみ修正。壁は保持。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: replace ONLY the small gold crest at the CENTER OF SERA'S FOREHEAD with the approved geometric crest. Keep its existing small scale and gold material, following the plane of her forehead. Preserve her exact face, eyes, expression, hair and anatomy. Keep the approved crest on the WALL unchanged. Use the approved geometric crest exactly as the second reference: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate teardrop flame above. Do not add a fourth finger on the right. Do not use a cup-shaped hand with upright stubs, a star, a flower, a realistic hand, or multiple flames.
```

**A-35. 一門の印の局所修正 lore_w12** `art/story-review/dungeons/lore_w12.png` (済)
- 根拠と判定: 原寸でセラの胴の胸前面に金の枝状の紋を確認。正典と既存の胴の修正指示は前面の紋を外すため、この前面の紋のみ除去。背へは追加しない。
- 保つもの: 印以外の人物・顔・目・衣装・部品・構図・光。要確認の箇所は変更しない。
```text
...except: remove ONLY the decorative gold emblems/branch-like motif from the FRONT of the detached wooden torso at the right foreground. Restore smooth natural wood grain matching the surrounding torso. Do not add a crest anywhere else. Preserve the neck opening, shoulders, iron joints, curved wooden torso anatomy, the open chest hatch and cyan light, roots and the whole scene.
```

**A-36. 一門の印の局所修正 w42_dawn** `art/story-review/chapter11/w42_dawn.png` (済)
- 根拠と判定: 広場の白墨の印が杯状の掌と中抜きの炎になっている。承認済み `docs/art/story-refs/sigil.png` の幾何学印へ修正。
- 保つもの: 白墨の円周・石畳・人物・町・眠り灯・構図・光。印の白墨の質感と床面の遠近を保つ。
```text
...except: replace ONLY the incorrect chalk hand-and-flame crest inside the town square circle with the approved geometric crest in docs/art/story-refs/sigil.png, supplied as the second reference. Use its exact silhouette: an angular cupped palm, ONE thumb projection on the LEFT, THREE parallel slanted finger projections on the RIGHT, a short wrist below, and ONE separate solid teardrop flame above. Do not add a fourth finger on the right. Do not use a symmetrical cup, a hollow flame, extra flames, or a realistic hand. Render the approved silhouette in warm off-white chalk on the cobblestones, matching the existing crest's scale and the perspective of the ground plane. Preserve the circular chalk border and every other part of the original image exactly, including all people, buildings, lanterns and lighting.
```

**A-37. 絵本の閲覧室の脚の局所修正 lore_ws23** `art/story-review/dungeons/lore_ws23.png` (済)
- 根拠と判定: 中央手前でクッションに座る小さな人業の脚のつながりが不自然だった。左右それぞれの太もも・膝・すね・足首・足が自然につながる座り姿へ修正。
- 追加修正 (2026-10-17 ユーザーの指示): 足が背中側を向いているため、中央の人業の骨盤・膝・足先を上半身と同じ絵本側へ向ける。クッションの上で両膝を絵本側へ向けて脚を折り、後ろからは足裏とかかとが見える自然な座り姿に修正。今回の修正前は `art/story-review/fixes/lore_ws23-feet-before.png` に保存。
- 保つもの: 中央の人業の頭・上半身・読書のしぐさ、左右の人業、絵本、閲覧室の構図・画風・光。修正前は `art/story-review/fixes/lore_ws23-before.png` に保存。
```text
...except: correct ONLY the legs of the small wooden articulated doll seated on the cushion in the center foreground. Its back faces the camera and its torso faces the picture book. Correct the backward lower body: seat it naturally on the cushion with BOTH knees directed FORWARD toward the book, away from the camera. Fold the lower legs underneath its body in a natural kneeling sitting pose, with the backs of the heels and soles visible from behind. Do not extend the legs or point the toes backward toward the camera. Exactly two naturally connected wooden legs with black-iron knee and ankle joints. Allow the table to naturally occlude parts of the forward-facing legs. Preserve its leaning upper body and reading gesture, the other dolls, the book, the room, composition, style and lighting.
```

**A-38. 第五章 report_w18「床の下の熱」の床の修正** `art/story-review/chapter5/report_w18.png` (済)
- 直す (2026-10-17 ユーザーの指示): 玉座の間がやけに暑い程度なので、床と階段を通常の石造りに戻す。赤く光る亀裂・溶岩・床からの蒸気と赤い反射光を除去し、暑さは額をぬぐう王の仕草で伝える。
- 保つもの: 王と弟子の姿・衣装・仕草、空いた宰相の席、絨毯、蝋燭、窓外の重い雲、構図・画風。修正前は `art/story-review/fixes/report_w18-before.png` に保存。
```text
...except: restore ONLY the floor and the throne dais steps to ordinary intact dark polished stone masonry with normal non-glowing tile joints. Remove ALL red-orange glowing fissures, lava, molten seams, fiery light from under the floor or steps, red reflections caused by those fissures, and ALL steam or smoke rising from the floor. The room is merely unusually hot, not visibly volcanic or structurally damaged. Normal warm candle reflections on the stone are allowed. Keep the king wiping his brow, the kneeling soot-covered apprentice, their faces, hands, clothes and crests, the empty chancellor chair, the red carpet, candles, gothic architecture, cloudy sky, camera composition, and fine-grained pixel-textured style unchanged. Do not add people or objects.
```

**A-39. 第五章 report_w19「燃やされる器」の床の修正** `art/story-review/chapter5/report_w19.png` (済)
- 直す (2026-10-17 ユーザーの指示): report_w18 と同様に、床と階段を通常の石造りに戻す。赤く光る亀裂・溶岩・床からの蒸気と赤い反射光を取り除く。
- 保つもの: 怒りに肘掛けを握る王、弟子と手に持った焼けた顔の木片、空いた宰相の席、机上の地図・巻物・杯、人物の顔・手・衣装・印、構図・画風・蝋燭・重い雲。修正前は `art/story-review/fixes/report_w19-before.png` に保存。
```text
...except: restore ONLY the floor and ALL stone stairs, including the background steps on BOTH sides of the king, to ordinary intact dark polished stone masonry with normal non-glowing joints. Remove ALL red-orange glowing cracks, lava, molten seams, fire from under the floor or stairs, their red reflected light, and ALL steam or smoke rising from the floor or stairs. This is an unusually hot ordinary throne room, not a volcanic chamber. Normal warm candlelight reflections are allowed. Preserve exactly the angry seated king gripping the armrests, the apprentice holding the charred wooden face fragment, their faces, hands, costumes and crests, the empty chancellor chair, the map, scrolls and goblets on the foreground table, the red textiles, lit candles, gothic architecture, heavy clouds, original composition and fine-grained pixel-textured style. Do not add people or objects.
```

**A-42. 第五章 w20_cup「三百年分の一行」備品の一門の印を除去** `art/story-review/chapter5/w20_cup.png` (済)
- 直す (2026-10-17 ユーザーの指示): 釜やテーブルクロスに表示された一門の印をすべて削除。右上の大釜・左側の大小の釜・遠景の釜、右手前のテーブルクロス、左下の箱にある印も含め、背景・備品に付いた手と炎の印を残さず消す。金属・布・木の質感で自然に埋める。
- 保つもの: 弟子の顔・髪・手・衣装と衣装の一門の印、帳面・筆記・図、金の杯、釜の形と湯気、鎖・足場、構図・画風・光。修正前は `art/story-review/fixes/w20_cup-before.png` に保存。
```text
...except: REMOVE EVERY gold hand-and-flame family crest / palm-and-teardrop emblem from ALL ENVIRONMENTAL OBJECTS in this scene. Remove the large crest from the huge upper-right cauldron, the crests from ALL left-side and distant cauldrons (including the far upper-left cauldron and the mid-left cauldron), the large crest from the dark tablecloth at the lower-right, and ALL such crests from the stacked chests/boxes in the lower-left corner, including the partially cropped bottom one. Inspect the entire image for remaining palm-and-flame motifs on cauldrons, cloth, boxes or any other background object and remove them all. Fill each removed emblem locally with continuous matching unmarked material: dark riveted iron on cauldrons, naturally folded dark fabric on the tablecloth, and worn box panels on chests, preserving existing texture, perspective, edge details, ornamental borders, and amber lighting. Do not replace the crests with other symbols. The apprentice's clothing and the small crests ON HIS CLOTHING must remain exactly unchanged. Preserve the apprentice's face, hair, hands and tracing gesture, the open ledger and its writing and recipe sketch, golden goblet, all object shapes, molten amber sap, steam, chains, cavern, camera composition, fine pixel texture and warm/cool lighting. No other changes, no new people or objects.
```

### B. 任意 (余力があれば。読者が気づきやすい順)

| 場面 | 直すこと |
|---|---|
| 序章 arrival `art/story-review/prologue/royal-audience.png` | 授かる三つの魂の色を職業の色に: 戦士 = 赤、僧侶 = 金、盗賊 = 緑 (紫は後で授かる魔導士の色なので外す) |
| 序章 irene_lamp `art/story-review/prologue/irene-soul-lamp.png` | 弟子を燭台の近くに。本文「弟子は火に手を近づけた」 |
| 序章 first_descent `art/story-review/prologue/first-descent-gatekeeper.png` | 四体が弟子の方を向く。本文「暗い入口を前にしてもこちらを向いている」。門の奥の石段は下りに |
| 第一章 ch1_end `art/story-review/chapter1/ch1_end.png` | 人業を大人の背丈、頭は何も彫られていない丸い木 |
| 第一章 mem_w05 `art/story-review/chapter1/mem_w05.png` | 冷えた焚き火の輪を足す。手記の脇のランタンを消す (師の物に見える) |
| 第一章 report_w01 `art/story-review/chapter1/report_w01.png` | 新しい序章に合わせ、王への報告後に王宮の倉庫で眠っていた人業を受け取る場面へ。王が魂を渡す場面にしない (済) |
| 第一章 w01_lantern `art/story-review/chapter1/w01_lantern.png` | ひび割れた据え付けの鎮魂灯と、傍らの崩れた墓石にある小さな真ちゅう製の師のランタンを別の物として描く (済) |
| 第一章 report_w02 | 窓の外の地上の修道院の廃墟を消す (修道院は地下) |
| 第二章 w06_roll | 発見時の開いた当直簿に、百年前の薄い乱筆とその下の新しい墨の追記を描き分ける（文字は読めない走り書き）。さびた鍵束を帳面の紐に結び、結び直した跡を見せる。窓外の灯る城・集落を暗い荒廃した風景へ替える (済) |
| 第二章 mem_w09 | 書状を握りつぶした形に |
| 第三章 report_w12 | 杯を玉座の肘掛けの上に (本文「肘掛けの杯」)。抱えた包みを胴らしく (黒鉄の継ぎ目をのぞかせる) |
| 第三章 report_w11 | 奥の髑髏飾りの二つ目の玉座を、空いた宰相の椅子らしく小さく |
| 第三章 w10_rope | 縦穴の灯の集落 (足場・吊り灯) を減らし、根の縦穴らしく |
| 第四章 w14_lamp | 灯籠の笠に掌に炎の印 |
| 踏破後 lore_w01 | ランタンの形を `w01_lantern.png` に合わせる (横倒しの筒にしない) |

---

## 4. 便2・便3 ― 第5〜8章の新規 42場面

**irene_boons「手がかりの恵み」** (第1章 / 館の語り)
- 要点: 旧セーブへの案内。燭台の横で紙束と手記を調べ、残された手助けを示すイレーヌ。進行度に関係なく使えるよう、特定の後半章の品や秘密は描かない。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. In the familiar gothic mansion workshop, Irene sits at a broad wooden worktable, carefully reviewing a modest collection of weathered loose notes and a small open leather notebook brought back from the labyrinths. Her left hand gently holds one curled page flat; her right index finger points to a small illegible marginal sketch, as she explains the practical help hidden in these clues to an unseen listener. All notes are unreadable scribbles. The single white candle on a brass candlestick illuminates the notes and her gentle attentive face. Compose a three-quarter view across the papers, with Irene on the right half and the gathered clues readable as the focal collection in the center foreground. Keep her wrists covered with black lace cuffs. Show only modest paper clues and ordinary workshop tools, with no named relic, doll parts, future secrets or magical symbols. This scene must work at any point in the player's progress. No Sera, Ordo, apprentice, or party dolls. No readable text.
```


**irene_undercity「灯の高さ」** (第3章 / 館の語り)
- 要点: 第三章の報告後。燭台の高い暖色の炎を見上げるイレーヌ。セラの未回収部品は進行で異なるため画面に入れない。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. In the same gothic mansion, Irene stands quietly beside a tall brass candlestick holding ONE white wax candle. Its warm amber flame burns noticeably tall and steady, rising above her eye line; she lifts her purple-eyed gaze toward its tip with a small renewed hope. Her hands rest gently together at waist height, away from the flame. Compose a graceful medium-wide side view with Irene on the left and the unusually high candle flame near the center, against the dark vertical carved shelves and cool blue gothic window. The real candle and her upward gaze are the two clear focal details at thumbnail size. The flame is ordinary warm candlelight, not blue soul-fire or a giant magical fire. No doll parts, Sera, Ordo, apprentice, visions of roots, or hidden future revelations. No readable text.
```


**irene_furnace「火の洞へ」** (第5章 / 館の語り)
- 要点: 第五章の入口。イレーヌが小さな芯切りばさみで白い蝋燭の芯を短く整える。館の中の静かな警告で、炎の洞窟や燃える人業は描かない。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. In the familiar mansion workshop, Irene carefully trims the wick of the single white candle on its brass candlestick with small black iron wick scissors. Her right hand naturally grips the small closed scissor handles, with the narrow tips positioned at the charred wick; her left hand lightly steadies the brass base well below the flame. The flame is small, warm amber and controlled. She looks down at the wick with a tender but worried expression, warning an unseen listener about fire. Compose a medium-close three-quarter view from table height, the candle and small wick scissors clearly visible between her face and hands. Keep both lace cuffs covering the wrists. This is an indoor quiet moment; no burning dolls, furnace, lava, threatening fire, dramatic sparks, or blue flame. No Sera, Ordo, apprentice, or party dolls. No readable text.
```


**irene_abyss「落ち続ける灯」** (第5章 / 館の語り)
- 要点: 第五章終了前後。燭台の前で両手を固く組むイレーヌ。セラの覚醒前後どちらの分岐にも使えるよう、セラと部品は画面に入れない。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. Late at night inside the familiar gothic mansion workshop, Irene sits alone before ONE white candle on a brass candlestick, both hands clasped tightly together just below her chin. Show two anatomically natural hands, interlaced with quiet restrained tension, black lace cuffs covering the wrists. Her eyes stay fixed on the small steady warm amber flame, her expression anxious and resolute rather than crying or smiling. Compose an intimate side-on view with Irene on the right and the small candle on the left, deep shadow separating them from the distant cool-blue gothic window. The surrounding darkness suggests the feared endless fall only through mood; the room remains a real workshop. Show neither a literal abyss nor a falling figure. No Sera, doll parts, Ordo, apprentice, chancellor, visions, blue soul-fire, or readable text. This same image must fit both dialogue branches, before and after the companion awakens.
```


**irene_coat「師の外套」** (第6章 / 館の語り)
- 要点: 第六章。燭台のそばで凍った師の外套の氷を溶かすイレーヌ。師の外套は無地の古びた黒、裾に小さな金糸の印ひとつだけ。弟子の全面の金模様と区別する。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. In the same gothic mansion workshop, Irene gently spreads a recovered frozen long travel coat across a wooden worktable beside a single white candle on a brass candlestick, slowly thawing it. The coat is plain worn BLACK wool, with restrained weathering and NO all-over embroidery, no rich gold trim, no purple lining, and no attached satchel. Thin translucent ice clings to its folded shoulder and one edge; a few beads of meltwater glisten on the wood. Irene carefully lifts the coat's hem in one hand and supports the heavy folded cloth with the other, looking down with tenderness and recognition. On the hem show ONLY ONE small GOLD-THREAD approved geometric lamp-on-palm crest: an angular cupped palm, one left thumb projection, three parallel slanted right finger projections, a short wrist below and a separate teardrop flame above. Keep this modest embroidery small but legible, not enlarged into a decorative panel. Compose a medium-wide view with the frozen black coat filling the foreground and Irene behind it; an empty simple coat stand is in the dim background. Warm amber light melts the frost against cool blue window light. No Sera, Ordo, apprentice, human figure inside the coat, injury, blue flame or readable text.
```


**irene_frozen「受け止める手」** (第6章 / 館の語り)
- 要点: 第六章。燭台の炎に開いた両手をかざすイレーヌ。氷の中の操霊師は語られる内容であり、館内に描かない。
- 描かないもの: 読める文字・後の章の秘密・本文にない幻影。
```text
Irene must match the approved Irene reference exactly: long black hair with a purple sheen, purple eyes, gold-and-purple jeweled hair ornament, purple-and-black lace gothic gown with off-shoulder sleeves, natural adult proportions and a calm gentle face. Inside the same gothic mansion workshop, Irene raises her TWO OPEN hands toward the gentle warmth of a single white candle on a brass candlestick. Her palms are curved upward and inward on either side, safely apart from the flame, each natural hand with one thumb and four fingers; neither hand touches the flame or overlaps the other. Her thoughtful gentle face appears above and behind the hands, looking at their softly lit palms as she reflects on hands that catch and shelter falling souls. Compose a close three-quarter frontal view, with the candle at the lower center and the two open cupped hands forming the main narrative shape around its warm amber flame. Lace cuffs cover her wrists. Cool blue moonlight through the familiar gothic window contrasts with the small candle. Keep this a literal moment in the mansion, without magical images, trapped bodies, frozen people, icy cavern, falling souls, extra hands or diagrams. No Sera, Ordo, apprentice, or readable text.
```

**irene_omokage「彫られた顔」** (第二章 / 本筋2報告後の館の語り、絵はイレーヌが語る過去の場面)
- 要点: 第三章の入口。イレーヌが燭台のそばでセラの頭を柔らかい布でぬぐい、人業の顔と「面影の写し」を教える。
- 描くもの: 既存の館の作業台 / イレーヌ / 台の柔らかい布に寝かせたセラの頭と本物の長い黒髪 / 彫られた木の顔・閉じた目・額の小さな金の印 / 真鍮の燭台の一本の白い蝋燭。
- 描かないもの: セラの胴・脚・目覚めた全身、胸の魂火、血や傷、宙に浮く顔、鏡や選択画面、読める文字。師は登場させない。
```text
Inside the same gothic mansion workshop, Irene gently wipes Sera's detached wooden head with a soft ivory cloth beside a single white candle on a brass candlestick. Irene has the exact face, long purple-sheened black hair, purple eyes, gold-and-purple jeweled hair ornament and purple-and-black lace gown of the approved Irene reference. Both her hands are naturally positioned: one steadies the head on the padded cloth on the table, the other holds the wiping cloth against the wooden cheek. Sera is still asleep: ONLY her detached head rests on folded dark velvet, with long wavy near-black REAL hair spread softly across the table, carved wooden facial features, visible wood grain and closed eyelids. Match Sera's face and real hair to the Sera reference, translated into the established adult-proportioned story illustration style. At the center of Sera's forehead, show a small gold approved geometric lamp-on-palm crest: angular cupped palm, one thumb projection on the left, three parallel slanted finger projections on the right, short wrist below, one separate teardrop flame above. The candlelight reveals the carved cheek and the fine real hair, the two narrative focal details, clearly readable at thumbnail size. Frame a tender quiet medium-close scene centered on Irene's careful hands and Sera's head, with Irene's gentle face above and the candle beside them. Rich restrained amber candlelight and cool blue window light, carved wood, purple fabric and gothic stone consistent with the mansion reference. This is a crafted wooden doll part lovingly cared for, with a clean wooden neck base. No torso, legs, awakened Sera, blue soul-fire, gore, floating faces, mirrors, interface, or readable text. No Ordo.
```

### 序章改訂の追加場面（2026-10-13・制作保留）

ユーザー指定により**今回は画像を作成しない**。新版の進行・修正対象の一覧は `docs/prologue-revision.md`。最初の三体は戦士・僧侶・盗賊、四体目は魔導士、五体目は騎士、六体目は司教。下記は後日の制作指示のみ。

**forest_doll「ほこりの下で待つ人業」** (序章 / 森の古屋の人業)

- 修正: 人業4体の頭を `docs/art/story-refs/dolls.png` の目鼻・口・耳のない丸い木の頭にそろえ、盗賊の短剣を右手で柄を握る形に直す。(済)
- 要点: 三体と森を進み、古屋でしばらく使われていない人業を発見する。人業にはまだ魂の灯がなく、壊れていない。
- 描くもの: 森の奥の古屋の室内 / 棚にもたれる、ほこりをかぶった木と黒鉄の人業 / 戦士・僧侶・盗賊の三体 / 弟子。
- 描かないもの: 騎士・魔導士・司教、イレーヌ、宝箱、死体、罠。
```text
Inside a long-unused wooden cottage in a nearby forest, dusty light enters through a cracked shutter. One dormant adult-sized articulated wooden doll rests against a shelf, covered in dust but structurally intact, with black iron joint bands and a smooth blank wooden head. The apprentice gently brushes dust from its shoulder. Exactly three awakened wooden dolls accompany the apprentice: a warrior with a red cloak and round shield, a priest in white robes with a staff, and a thief in dark leather with a dagger. Quiet discovery, no combat, no treasure chest, no corpse, no trap, no knight, no mage, no bishop, no Irene. The dormant doll has no soul light.
```

**w02_broken_doll「回廊の果ての六体目」** (第一章 / 回廊最深部の人業)
- 要点: 五体の隊が回廊最深部で壊れた人業を発見し、館へ連れ帰ろうとする。以前の操霊師の素性は不明。セラではない。
- 描くもの: 静かな石の回廊 / 継ぎ目が傷んで壁にもたれた、灯のない人業 / 弟子と戦士・僧侶・盗賊・騎士・魔導士の五体。
- 描かないもの: 司教、イレーヌ、セラ、師オルド、死体、宝箱、読める文字。
```text
At the deepest end of a quiet stone corridor, the apprentice and exactly five adult-sized articulated wooden dolls discover another wooden doll slumped against the wall. The five companions are a warrior with a red cloak and round shield, a priest in white robes, a thief in dark leather, a knight with armor and a shield, and a mage in purple robes. All have smooth blank wooden heads and black iron joint bands. The found doll has damaged joints and an unlit chest, weathered by a previous journey; it is repairable, not a human corpse and not Sera. The apprentice supports its damaged arm, preparing to carry it home. No bishop, no Irene, no Ordo, no treasure chest, no readable text.
```


いまは第5〜8章の挿絵がコードで描いた小さな仮の絵なので、承認済みの章と同じ画風の原画に置き換える。

- 本文は場面IDで引く: ストーリー一覧 = `src/archive-stories.js` の `scene("<場面ID>", ...)`、ゲーム内 = `src/story.js` (手がかり `STORY_CELLS.<場面ID>`、報告 `REPORTS.w18` = report_w18、主の記憶 `BOSS_MEMORIES.w21` = mem_w21、館の語り `IRENE_BEATS` の id、章の結び `CHAPTER_END[5]` = ch5_end)。**両方を読んで、両方に合う一枚にする。**
- 参照画像: `docs/art/story-refs/` の基準シート (2-4) に加え、玉座の間は `docs/art/story-refs/palace-front.png` と必要なアングル (2-5)、館は `chapter2/irene_roots.png`・`chapter1/irene_familiar.png` を渡す。
- 人物の背景・迷宮の場面には、弟子と隊の人業 (2〜4体) を入れてよい。セラは第五章から隊にいることがある (入れるなら正典の姿)。
- 報告の場面 (report_*) は、玉座の間・王・空いた宰相の席・弟子 (後ろ姿) が基本。窓の外は 2-3 の時の流れに従う。

各場面の英語の指示は、1-1 の前置きのあとに書く (`prompt.mjs` が前置きと合わせて出す)。**新しい場面を足す時もこの形** (`**<場面ID>「題」** (種類)`・箇条書き・```text の英語) — `tools/storyart/brief.mjs` がこの書式を読む。

### 第五章「灼熱の洞」 ― 便2

**w18_blade「手放された刃」** (師の手がかり / 迷宮「火を噴く地割れ」)
- 本文の要点: 赤く脈打つ岩の奥の鉄の扉。のこぎりのように研いだ刃は根元で折れ、柄と分離している。柄に焼け焦げた布、布に煤の字。弟子は柄を脇に置き、残った長い刃を布越しに握って扉をこじる。手で握る位置から扉の支点までは一本につながった金属で、力が伝わるように描く。
- 描くもの: 根元で折れた長い刃 (手から鉄扉までつながっている) / 脇に置いた柄と焦げた布 / 鉄の扉 / 刃を布越しに握って扉をこじる弟子。描かないもの: 折れた柄を握って分離した刃を動かす構図、師本人、扉の向こうの祭場の詳しい様子。
```text
Deep inside a volcanic fissure cave whose rock walls glow and pulse red with magma veins, a massive rusted iron door is set into the rock. A long serrated saw-like blade has snapped at its base and is completely separated from its hilt. The detached hilt, still wrapped in scorched cloth with illegible soot scribbles, lies on a rock beside the apprentice. The apprentice (brown hair, charcoal cloak with restrained gold embroidery, leather satchel) grips the remaining LONG METAL BLADE itself through a thick folded protective cloth and uses it as a pry bar against the iron door jamb. The metal must be continuous and intact between his cloth-protected hands and the tip wedged into the door gap; the jagged broken base is behind his grip, outside the force-bearing span. He is NOT holding the detached hilt. Heat shimmer and drifting embers surround him. Two or three wooden party dolls with blank round heads wait behind in the red glow. Composition centers on the physically plausible blade lever and the separate broken hilt.
```

**report_w18「床の下の熱」** (報告)
- 要点: 玉座の間がひどく暑く、王が何度も額をぬぐう。床の下で何かが煮えている音。弟子は煤だらけ。
- 描くもの: 額を布でぬぐう王 / 通常の石床と階段 (赤い亀裂・発光・蒸気なし) / 空いた宰相の席 / 煤だらけの弟子。
```text
The same gothic throne room. The very old king (long white hair and beard, pointed gold crown, red robes, white ermine with black spots) sits on the throne wiping sweat from his brow with a cloth; the room is unusually hot, conveyed by his gesture, while the floor and dais steps remain ordinary intact dark stone with non-glowing joints, no molten cracks, no red light from below and no steam rising from the floor. The chancellor's chair beside the throne is conspicuously empty. The apprentice, cloak dusted with soot, kneels in rear three-quarter view. Heavy dark clouds outside the tall windows. Candles drooping in the heat.
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
- 描くもの: 怒りに肘掛けを握る王 / 弟子が差し出す、焼けた殻から外した小さな顔の木片 (モルデンに似た顔) / 空いた宰相の席 / 通常の石床と階段 (赤い亀裂・発光・蒸気なし)。
```text
The same throne room, hotter than before, but with ordinary intact dark stone floors and stairs, non-glowing joints, no molten cracks, no red light from below, and no steam or smoke rising from the floor or stairs. The very old king grips the armrest in grim anger, staring at a small charred wooden face fragment that the apprentice holds up — a carved face resembling the gaunt chancellor. The chancellor's chair beside the throne stands empty. Heavy clouds outside.
```

**w20_cup「三百年分の一行」** (手がかり / 迷宮「魂を煮る釜場」)
- 要点: いちばん大きな釜の脇の作業台に、金の杯と、開いたままの分厚い帳面。同じ一行が頁という頁に三百年分。最後の頁に師の字の調合の書きつけ。
- 描くもの: 並ぶ大釜と湯気 / 作業台の金の杯 / 開いた分厚い帳面 (同じ行がびっしり、最後の頁だけ別の筆跡) / 読む弟子。釜・テーブルクロス・箱などの備品に一門の印を描かない。
```text
A vast cavern of soul-boiling cauldrons: rows of enormous iron cauldrons bubbling with glowing amber sap and steam. Beside the largest one stands a worktable holding a single golden goblet and a huge, thick open ledger whose pages are filled with endless identical lines of tiny writing; the last page carries a different, hurried handwriting with a small recipe sketch. The apprentice bends over the ledger, one gloved finger tracing the final page. Warm infernal light, steam, intricate metal and paper detail. Do not place any palm-and-flame family crests on cauldrons, tablecloths, boxes, or other environmental objects; the apprentice clothing retains its own crests.
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
- 要点: 釜の火が消えてから玉座の間がひどく寒い。王は膝掛けを引き寄せながら聞く。師が脚を折っても先へ進んだと聞いて、かすかに笑う。
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
The same ordinary inhabited gothic throne room, with dry carved grey stone, polished dark stone floors, black iron and gold furnishings, deep red textiles, and warm amber candlelight. No ice, frost, snow or icicles anywhere in the palace or on the city buildings outside. The very old king, lap blanket over his knees, sits in long silence holding a parchment listing eleven names; his eyes are closed in grief. The chancellor's chair beside him stands empty, a reminder of the lie. The apprentice waits, head bowed. Clear unfrosted windows, overcast sky.
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
- 要点: イザークの名を聞いて王が思い出す、王宮の回廊に一枚だけ掛かる古い肖像。報告を聞く玉座の間ではなく、肖像のある別の場所を描く。
- 描くもの: 人のいない王宮の石造りの回廊 / 壁に掛かる古い額入りの肖像 (凍る前の若いイザーク、暗い衣、厳しくも優しい目) / 奥へ続くアーチと窓 / 冷たい光と暖かなろうそくの光。
- 描かないもの: 玉座・玉座の間・王・弟子・宰相・空の椅子・ほかの肖像・読める文字。
- 修正 (2026-10-17、済): 玉座で報告を聞く構図をやめ、王宮の回廊に掛かる肖像を主題に描き直した。
```text
An unoccupied stone corridor in the royal palace, a separate place from the audience chamber, visualizing the remembered portrait. The main subject is a single old framed painted portrait hanging directly on the corridor's carved stone wall, large and clearly readable in the central band: young Isaak before he froze, a royal soul-mage in dark robes, with a lean face, dark hair, and stern yet kind eyes. Use the ancient-character reference for his facial identity, but show his younger living appearance inside an aged painting, without ice. An oblique view shows the wall and frame beside a long corridor receding under gothic arches, narrow windows with cold cloudy light, worn polished stone flooring, restrained red drapery and warm amber wall candles. Keep the richly detailed dark fantasy style of the palace reference, using it only for materials, carving and lighting; replace its throne-room composition completely. No throne, dais, audience chamber, chairs, king, apprentice, chancellor, living figures, other portraits, royal crown, ice crown, readable plaque or text. The single hanging portrait and the corridor itself must dominate the illustration, with quiet age and remembrance.
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
- 要点: 雪解けの水が滝になって落ちる岸の泥。氷の添え木は一年前に溶けており、残っていない。岸の岩陰に木の削りくずと短い縄の端、平たい石で保護された古い書きつけが残る。腕の木は師が脚に付けて持ち去ったので描かない。現在の水辺に新しい足跡を描かない。
```text
The bottom of the Abyss: a meltwater waterfall plunges into a black, sickly-green miasmic swamp. In a sheltered rock recess beside the muddy shore lie a few old curled wood shavings and short cut-off rope ends; an aged folded note is protected beneath a flat stone. The ice splint melted a year ago: show no remaining ice splint or ice fragments. The wooden doll arms have been taken away by Ordo as his new leg splint: do not show any abandoned wooden arms, intact wooden splint, bundled rods or spare note tucked into a knot. Do not show fresh footprints: this trace was left a year ago. The apprentice kneels to take the note; party dolls behind. Poison mist, reeds, dim green glow.
```

**report_w26「杯を満たしたもの」** (報告)
- 要点: 沼の水が腐った魂なら、王の杯を満たした魂も途中で拾われたもの。王は長く黙り、「息を詰めて行け」とだけ言う。
```text
The same cold throne room. The very old king, lap blanket over his knees, stares in silence at the golden goblet still lying on the floor beside the throne where he set it down, now dusty and empty. The chancellor's chair stands empty. The apprentice waits. Heavy clouds outside.
```

**w27_crest「仕上がらなかった兄弟」** (手がかり / 迷宮「器の捨て場」)
- 要点: 谷の奥に作りかけの器の山 (腕の無いもの・顔の無いもの・胸の扉が開いたままのもの)。どれも三百年より古い。胸の扉の内側に灯を掌に載せた手の印。山の頂に一体だけ、きれいに座らされた器 (顔は彫りかけ、胸は空)、膝に師の札。
- 2026-10-17 ユーザー指定の修正: 捨てられた人業の胸の扉は、すべて一枚の片開き。構図・人物・光を保ち、両開きの扉を直した (済)。
- 同日の追加修正: 片開きは保ち、弟子の脚・足首・ブーツを自然につながる形に直し、器の山に足を置いて登る姿勢に整えた (済)。
- 同日の追加修正: 足の周りのマントを、背中から続く一枚の布として自然に垂れる裾とひだに直した。脚を囲む筒状の縁や分かれた布片に見せない (済)。
```text
A deep valley by the poison swamp, piled high with ancient unfinished wooden dolls: some armless, some faceless with blank heads, many with small chest doors hanging open, and inside each open door the same carved crest — a palm-up hand holding a flame. Every chest hatch has exactly one full-width wooden door panel hinged on one side only, never two opposing leaves. Everything is grey with age and moss. At the very top of the pile, one doll sits neatly upright, its face only half-carved, its chest empty, a wooden tag resting on its knees. The apprentice climbs the heap toward it. Green miasma, dead reeds.
```

**report_w27「笑わない宰相」** (報告)
- 要点: 王は目を閉じる。宰相は山ほどの捨てられた兄弟の上に立っていた。百年そばに置きながら、王はあの薄い笑みがほどけるところを一度も見たことがなかった (宰相はいつも微笑んでいた。心から笑うのを見たことがない、の意)。
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
- 要点: 王は「魂を、腐らせるな」を何度も口の中でくり返す。大樹も霊薬も釜も、そのためだった。火の洞でモルデンが言った「魂を集めよ」は、言いつけを自分にできる形に言い換えたものだったと王は気づく。命じた者が死んでも命令は死なない。王は顔を上げ、弟子に塔を登れと告げる。
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
- 要点: 螺旋階段の踊り場の床が雷で黒く焦げる。焦げ跡のまん中に、半ばで折れた木の杖 (握りの下に人業の腕の継ぎ目。脚には短い添え木を残し、切り詰めた木をつないだもの)。石で押さえた書きつけ。手すりの鎖に、手でつかんだ跡が上へ続く。吹き抜けを下から風が鳴りながら昇る。
```text
Inside a colossal stone tower: a spiral staircase winds up around a hollow central shaft through which wind roars upward. On a landing, the stone floor is blackened by a lightning strike; in the middle of the scorch lies a wooden walking staff snapped in half, made by joining the trimmed-off lengths of a doll-arm splint, with a black-iron doll-joint ring visible below its grip. Short supports still brace the master's injured leg later; do not imply the entire splint was discarded. A note is weighted by a stone. Along the iron chain handrail, dark handprints continue upward. The apprentice kneels by the broken staff. Rain-wet stone, distant lightning glow from above.
```

**report_w30「鳴りやまぬ雷」** (報告)
- 要点: 王の知るこの百年、この国の空はいつも重く、雷の鳴らない夏は一度もなかった。その雷を鳴らしていたのが地の底の塔。
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
- 描くもの: 火のない灯台 / 鎖の腕の像の輪と渦巻く魂の嵐 / 像を石で割るオルド (腕の木を切り詰めた短い添え木で固めた脚、杖なし) / 抜けていく一つの魂 / 雲の切れ間の石の橋と観客席。
- 描かないもの: 弟子。灯台に火を入れたモルデンの姿 (この絵では描かない)。
```text
A memory scene with storm-grey hazed edges. The summit of the storm tower: a huge dark lighthouse with no fire. Around it stands a ring of stone statues whose long chain-arms reach out and bind countless rising soul-lights, forcing them to swirl around the tower in a churning vortex of storm, lightning and rain. In the foreground, master Ordo (short grey hair, grey beard, gaunt, injured leg still braced with two SHORT wooden supports cut from the doll arms and bound by rope; the trimmed-off lengths became the staff he has already lost, no staff) has crawled up and smashes one statue's chain-arm with a stone; a single freed soul-light streaks upward through the clouds. Through a break in the storm clouds, a long stone bridge leads away toward a sunken bowl-shaped ancient amphitheatre. No apprentice.
```

**report_w33「百年目の青空」** (報告)
- 要点: 嵐の主が鎮まった朝、この空が晴れる (王都からも同じ報せ)。王の知るこの百年で初めての青空。捨て砦の大手門の雷雨も止んだ。王は窓の外の青い空から目を離さない。解かれた魂もいずれ雨となって沼へ落ちる、と王はモルデンのおそれを口にする。「橋の向こうへ行け」。
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

### 第九章「闘技場跡」 ― 便5

第九章の景色: 嵐の尖塔の頂から雲海の上へ架かる長い石の橋の先に、灰に埋もれた古い闘技場の町がある。すり鉢形の石の観客席、血の染みた砂の床、床下の獣の檻と通路。町はずっと昔に焼け、灰が雪のように積もり、ところどころで熾火が赤く点る。雲の上の外景は明るい青空と白い雲海。第八章の結びでロアダルも晴れたので、報告の場面の窓の外も **晴れた空** (昼は青空、本文で夕方と指定された場面は明るい茜空)。

**w34_glove「置いていった手袋」** (手がかり / 迷宮「雲を渡る石橋」)
- 要点: 嵐が晴れたあとの白い雲海の上に伸びる長い石橋。欄干に枷をつなぐ鉄の輪がどこまでも並ぶ。橋のなかほどの輪に、焦げた革の手袋が片方だけ結ばれている (甲に灯の印の刺しゅう、指先は焼けて縮れる)。手袋の中に丸めた書きつけ。橋の先、雲の切れ間に、すり鉢の形の観客席が黒くそびえる。
- 描くもの: 欄干の輪に結ばれた焦げた手袋 / 枷の輪の列 / 手袋を手に取る弟子 / 遠くの観客席。描かないもの: 師本人。
```text
A long ancient stone bridge stretching across a white sea of clouds beneath a bright blue daytime sky, after the century-long storm has ended. Along its parapet runs an endless row of iron rings once used to chain prisoners. On one ring halfway across, a single scorched leather glove is tied, its fingertips burnt and shrivelled, a small embroidered crest on the back of the hand (a palm-up hand holding a flame); a rolled note is tucked inside it. The apprentice reaches for the glove; party dolls wait behind. Far ahead, through a break in the clouds, a huge bowl-shaped stone amphitheatre looms dark against the sky, buried in grey ash.
```

**report_w34「空の上の町」** (報告)
- 要点: 百年晴れぬ空を見上げてきた王は、その上に橋があったと知らなかった。年代記の最初の頁「空の上に、歓声の絶えぬ町があった」。
- 修正 (2026-10-14 ユーザーの訂正): 元の青空の原画に戻す。報告の場所はロアダルの離宮だが、「百年目の青空」以降なので窓の外は明るい青空。人物・年代記・室内の構図と蝋燭の灯を保つ。(済)
```text
The same throne room in the royal retreat at Roadal, with a bright blue daytime sky and small white fair-weather clouds outside the tall windows. Roadal's century-long storm has ended after report_w33. Restore the original blue-sky illustration, preserving its composition, characters, costumes, chronicle, architecture, and warm candlelight. The very old king, lap blanket over his knees, holds open a huge ancient chronicle on his lap, pointing to its first page, and looks up at the high sky through the window. The chancellor's chair stands empty. The apprentice reports.
```

**w35_lamps「番号の灯籠」** (手がかり / 迷宮「闘獣の檻」)
- 要点: 闘技場の床下の檻の奥。天井まで届く棚に、番号の札のついた手のひらほどの古い灯籠が何百と吊るされる。棚の端に闘士の名と勝ち負けの数の板。負けが十を越えた名には赤い線、その灯籠だけガラスが黒く濁る。棚の柱に師の書き足し。
- 描くもの: 灯籠の棚 (火は消えている) / 黒く濁った灯籠 / 名と勝ち負けの板 / 棚を見上げる弟子。
```text
Beneath an ancient arena: a dark stone passage lined with broken, burst-open beast cages leads to towering wooden racks reaching the ceiling, hung with hundreds of small old glass lanterns, each with a numbered tag. All lanterns are unlit; a few have glass clouded pitch-black. At the rack's end, a board lists gladiator names with tallies of wins and losses, some names struck through in red. A handwritten note is chalked on a pillar. The apprentice holds up a lamp and looks up at the racks, awed. Dust, ash, faint cold light.
```

**report_w35「使い回された魂」** (報告)
- 要点: 灯籠の棚の話を聞いた王は、人業の作り方と同じではないかと言い、自分の手を見つめる。「余も、同じことをしてきたのかもしれぬ」。
```text
The same throne room in daylight. The very old king sits slumped, staring down at his own thin, trembling hands in his lap, troubled. Clear sky outside the windows. The chancellor's chair stands empty. The apprentice stands quietly.
```

**w36_nook「灯番の子」** (手がかり / 迷宮「亡き観客の階段席」)
- 要点: 観客席のいちばん下、石段の裏の狭いすき間に小さな寝床。すり切れた毛布、木の椀、壁に日を数えた刻み目が何列も。毛布の上に、胸のくぼみに灯籠のガラスのかけらをはめこんだ手のひらほどの木の人業。壁の端に子どもが彫った「灯を掌に載せた手」の絵と、削り取られた名前。毛布の端に、人業を写した絵と師の字の書きつけ (イレーヌの語り irene_firstdoll の写し絵)。
- 描くもの: 狭い寝床 / 刻み目の壁 / 小さな木の人業 / 子どもの彫った印 / かがみこむ弟子。描かないもの: 子ども本人。
```text
A cramped hollow beneath the stone tiers of an ancient amphitheatre, lit by a small lamp held by the apprentice crouching at its entrance. Inside: a tiny child's bed of a threadbare blanket, a wooden bowl, and rows of tally scratches counting days on the wall. On the blanket sits a palm-sized carved wooden doll with a small hollow in its chest holding a shard of lantern glass that faintly glows. At the end of the tallies, a child's crude carving of a palm-up hand holding a flame; beneath it a name has been scraped away. Grey ash drifts in from above. Quiet, tender, sad.
```

**report_w36「玉座と観客席」** (報告)
- 要点: 試合が終わっても席を立たない観客の話を、王は黙って聞く。「余は百年、玉座から民を眺めてきた。あの観客たちと、何が違ったであろうな」。王は空いた宰相の席を見る。
```text
The same throne room in late-afternoon light. The very old king, lap blanket over his knees, gazes from his throne down the long empty hall as if at an invisible crowd, then glances at the chancellor's empty chair beside him. The apprentice stands below the dais.
```

**irene_firstdoll「最初の人業」** (館の語り)
- 修正 (2026-10-16): イレーヌの余分な手と腕を除き、写し絵を持つ手と工具を使う手の2本にする。セラの胸は基準シートと同じ、金縁で上が尖り下が丸いしずく形の青白い魂火の窓に統一し、箱形の灯器を除く。(済)
- 要点: 師が書き写してきた人業の絵を、イレーヌが長いあいだ見る (胸のくぼみに灯籠のガラス)。セラが自分の胸の扉に手を当てる。その夜、イレーヌは人業の絵を手本にセラの胸の継ぎ目を締め直す。「あったかい」。
```text
The same mansion workshop at night. Irene holds a sketch of a small wooden doll with a lantern-glass shard in its chest, comparing it as she gently tightens the joint of Sera's chest door with a fine tool. Sera (as in the Sera reference) sits on the workbench with a hand over her chest, smiling softly, her chest glowing warm. Single white candle on a brass candlestick.
```

**mem_w37「十三度目の灯」** (主の記憶 / 闘技場の支配者)
- 修正 (2026-10-16 ユーザーの指示): 後ろ姿の子どもが帳面を胸側に抱えて走るように直す。背中側へ回った不自然な手を除き、肩から肘・手首・手が自然につながる左右一本ずつの腕にする。帳面は体の前に抱え、側面から一部が見える形にする。子どもの顔は見せず、脚・背景・構図・画風・光は保つ。(済)
- 要点: 三百年よりずっと前の雲の上の町。倒れた闘士の魂は灯籠に入れられ、新しい体で翌日また砂の上に立つ。灯籠の世話は親のいない子どもの仕事 (灯番の子)。いちばん仲のよかった闘士の灯籠が十三度目に黒く濁り、闘技場の真ん中の穴へ捨てられる。その夜、子は棚を倒して帳面を抱いて逃げ、こぼれた魂の火が町を焼く。焼け落ちる貴賓席で、金の仮面の興行主が自分の魂を灯籠に移す。
- 描くもの: 燃え上がる闘技場の町 / 倒れた灯籠の棚とこぼれる魂の火 / 帳面を抱いて橋へ逃げる小さな子どもの後ろ姿 / 貴賓席の金の仮面の興行主。描かないもの: 弟子・師。子どもの顔 (後ろ姿で)。
```text
A memory scene with ash-grey hazed edges, centuries ago: an ancient amphitheatre town above the clouds is catching fire at night. In the foreground, a toppled rack of small lanterns spills dozens of soul-flames that leap up and spread across the stands and rooftops. A small barefoot child, seen from behind, clutches a worn notebook to their chest and runs toward a long stone bridge leading away over the sea of clouds. High above, in the burning royal box, a towering showman in a golden mask raises a lantern, as if pouring his own soul into it. In the arena's centre, a dark round pit. Embers, smoke, terrible beauty. No apprentice, no Ordo.
```

**report_w37「休みのない百年」** (報告)
- 要点: 三百年より昔から続いた試合が終わった。王は自分の手を見ながら聞く。「余の百年も、休みのない百年であった。霊薬で、魂を休ませずに使い続けてきた」。祖は魂を救おうとして町を焼いた、と王は言う。「そなたの人業は、よく休ませよ」。
```text
The same throne room at dusk, a calm orange sky outside the tall windows. The very old king, gaunt, sets aside an empty elixir cup on the armrest and looks at the apprentice with tired, gentle eyes, raising one hand as if giving a final piece of advice. The chancellor's chair stands empty. The apprentice and one doll stand below.
```

**irene_rest「休む灯」** (館の語り)
- 要点: 「魂は、休ませないと腐る」。イレーヌが並んで眠る人業たちの胸の灯をひとつずつ見て回る。イレーヌも師がいなくなってから一晩も休んでいなかった。セラ「今夜はわたしが灯の番をします」。イレーヌ「あなたも、ですよ」。
- 修正 (2026-10-14 ユーザーの指示): セラの脚を左右一本ずつ、足を二つにする。白い布の下の骨盤から腿・膝・すね・足が自然につながる座り姿に直し、余分な脚と継ぎ目を除く。顔・上半身・イレーヌ・周りの人業・構図・灯りは保つ。(済)
- 追加修正 (2026-10-14 ユーザーの指示): 胸の開き方を `art/story-review/chapter4/irene_sera_wake.png` に合わせる。胸のアクセサリーから見える青白い光はセラ自身の魂であり、別の宝石や二つ目の魂ではない。金縁のアクセサリーと開いた木の胸板を同じ構造として描き、胸の内側の魂を一つだけ見せる。開いた蓋の装飾を別に青く光らせない。修正済みの脚二本と足二つ、顔・髪・腕・周囲の人業・構図・灯りを保つ。(済)
```text
The same mansion at night. A row of wooden dolls rests seated against the wall, eyes closed, small soft lights glowing in their chest doors. Irene walks along the row holding a small lamp, checking each light with tender care. Sera (as in the Sera reference) sits among them, sleepily smiling up at her. The single white candle on its brass candlestick burns quietly in the background.
```

**ch9_end「捨てられた魂の行き先」** (章の結び)
- 要点: 闘技場の歓声はやみ、支配者の背の輪の灯はひとつ残らず静かに消える。闘技場の砂の真ん中に、濁った灯籠を捨てた底の見えない穴が口を開けている。師はその底へ降りていった。
- 描くもの: 静まり返った灰の観客席 / 砂の真ん中の深い穴 / 穴の縁に立って底をのぞく弟子と隊。
```text
A vast ruined amphitheatre after the battle, silent under a cold twilight sky, its stone tiers buried in grey ash and empty of spectators. In the centre of the bloodstained sand, a huge round pit opens into absolute darkness; faint, distant murmurs of countless voices seem to rise from deep below (suggested by a few dim soul-motes far down). The apprentice and the party stand at the pit's edge, looking down. A frayed rope ladder hangs over the rim, left by someone who climbed down before.
```

### 第十章「地底大空洞」 ― 便6

第十章の景色: 闘技場の穴の底に広がる、果ての見えない地底大空洞。三百年よりもずっと昔から、闘技場で使い潰されて黒く濁った灯籠 (手のひらほどの古いガラスの灯籠) が穴から落ち続け、底で黒い山をなしている。灯籠から漏れた濁った魂が、青白い燐光や琥珀の微光になって岩や水ににじむ。巨大なつらら石と石筍、水晶の鉱脈、黒く静まりかえった地底湖、岩壁一面に壁龕を彫った石窟、天井の見えない大伽藍。光は弱く、灯籠の琥珀色と魂の青白さだけ。王都の空は晴れたままなので、報告の場面の窓の外は **晴れた空**。第一部の結びの章。**物語の主題は「正しさとは何か」** — 宰相モルデンも師オルドも、悪人にも聖人にも見せない。

**w38_lamp「名を思い出さない灯」** (手がかり / 迷宮「灯籠の吹き溜まり」)
- 要点: 大空洞の底に、黒く濁った灯籠が山と積もる。踏むとガラスが鳴る。その中に一つだけ、布で何度も拭いたあとが丸く残る澄んだ灯籠。下に石で押さえた師の書きつけ。灯籠の山のあいだに、毎日誰かが歩いた足跡 (古い足跡の上に新しい足跡) が、黒い水の匂いのする奥へ続く。
- 描くもの: 黒い灯籠の山 / 一つだけ澄んだ灯籠と書きつけ / 奥へ続く足跡 / 灯籠を手に取る弟子。上の闘技場の穴から細く差す光。描かないもの: 師・モルデン本人。
```text
The bottom of a colossal underground cavern beneath a pit: a mountain of countless small antique glass lanterns, their glass clouded pitch-black, heaped like drifted snow and crunching underfoot. A thin shaft of dim light falls from a round opening far above. Among the black lanterns, one single lantern has been carefully wiped clean, its glass clear, faint circular cloth-marks on it, a tiny pale soul-light inside; beneath it a handwritten note held down by a stone. The apprentice kneels and lifts the clean lantern. Between the heaps, a trodden path of footprints — old prints overlaid with fresh ones — leads away into the dark toward a distant cold glint of water. Amber and pale-blue light only, deep shadows, vast scale.
```

**report_w38「底で灯を拾う者」** (報告)
- 要点: 三百年よりも前から捨てられ続けた灯籠の山の話を、王は目を閉じて聞く。毎日誰かが底で灯籠を拾っている — 思い当たる顔が一つしかない。
```text
The same throne room in daylight, a clear sky outside the tall windows. The very old king, lap blanket over his knees, sits with his eyes closed, one hand resting on a small blackened antique lantern the apprentice has set on the armrest. The chancellor's chair beside the throne stands empty, and the king's face is turned slightly toward it. The apprentice stands below the dais.
```

**w39_tags「宰相の字」** (手がかり / 迷宮「黒い灯の地底湖」)
- 要点: 黒く静まりかえった地底湖の岸に、濁った灯籠がずらりと湖を向いて並ぶ。灯籠の一つひとつに小さな木札が細い紐で結ばれ、きれいな字で名前が書かれている (名を忘れた魂に、誰かが名をつけた)。その筆跡は宰相モルデンの字。札の山のそばに師の書きつけ。湖面にはどこにもない灯が映る。
- 描くもの: 湖を向いて並ぶ灯籠の列 / 結ばれた木札 (字は読めなくてよい) / 札を手に取って筆跡に気づく弟子 / 湖面の灯の映りこみ。描かないもの: モルデン本人。
```text
The shore of a pitch-black, perfectly still underground lake in a vast cavern. Hundreds of small clouded-black antique lanterns stand in neat rows along the shore, all facing the water, each with a small wooden tag tied on with thin cord, every tag inscribed in the same elegant, careful handwriting. On the mirror-like water, the reflections of lantern lights glow where there are no lanterns. The apprentice holds one tag up to a small lamp, recognising the handwriting with a start. A stone-weighted handwritten note lies beside a pile of tags. Hushed, reverent, cold blue and amber.
```

**report_w39「呼ばれなかった名」** (報告)
- 要点: 札の字がモルデンのものだと聞いて、王は驚かない。百年、同じ字の布告に印を押してきた。捨てられた魂に名をつけてやっていた男に、王は百年そばに置いて礼のひとつも言ったことがなかった。空いた宰相の席を長く見る。
```text
The same throne room in late-afternoon light. The very old king holds a small wooden tag with elegant handwriting next to an old royal decree bearing the same handwriting and a red seal, comparing them, then looks long at the chancellor's empty chair beside the throne. Clear sky outside. The apprentice stands quietly below.
```

**irene_names「名を呼ぶ人」** (館の語り)
- 要点: イレーヌの名は師がつけた。目を開けて最初に聞いたのが自分の名。名を呼ばれると灯が落ち着く。三百年ひとりで札に名を書いてきた宰相を責めきれない。「旧都を沈めた人です。魂を煮た人です。……それなのに、札の字が、あんなにていねいなのです」。セラがいれば「モルデンさん、って呼んであげればいい」。
```text
The same mansion workshop at night. Irene sits before the single white candle on its brass candlestick, holding a small wooden name tag in both hands and gazing at it, troubled and gentle. Sera (as in the Sera reference) leans beside her, looking at the tag too. Warm candlelight, quiet.
```

**w40_eyes「それでも、底へ」** (手がかり / 迷宮「名を刻む石窟」)
- 要点: 岩壁一面に小さなくぼみ (壁龕) が彫られ、どのくぼみにも濁った灯籠が一つずつ眠り、下の石に名が刻まれている (墓)。いちばん奥の空のくぼみに、師のシャツの袖から裂いた布切れと書きつけ (外套は第六章で氷棚に置いてきたので、外套の布ではない)。最後の一行だけ紙が破れかけるほど強く書かれている。
- 描くもの: くぼみの並ぶ岩壁 (上へ何段も) / 刻まれた名 / 空のくぼみの布切れと書きつけ / 書きつけを読む弟子。描かないもの: 師・モルデン本人。
```text
A towering cavern wall carved with hundreds of small niches rising tier upon tier into darkness, each niche holding one small clouded-black antique lantern, a name carved into the stone beneath each. It feels like a vast, tender grave. At the very back, one niche is empty except for a strip of torn dark grey shirt-sleeve cloth and a handwritten note whose last line is pressed so hard the paper is nearly torn. The apprentice reads it by the faint pale glow of the lanterns. Silence, dust, reverence.
```

**report_w40「三百年の墓守」** (報告)
- 要点: 壁龕の灯籠と刻まれた名の話を聞いて、王はそれを墓と呼ぶ。オルドは何をしに底へ行くのかと、自分に問うように呟く。
```text
The same throne room at dusk, orange sky outside. The very old king leans back on the throne, eyes half-closed, one hand over his heart as if mourning, speaking quietly to himself. The chancellor's chair stands empty. The apprentice stands below.
```

**pre_w41_retry「ふたたび階段の前で」** (主との対面 / 宰相モルデン。全滅後の再挑戦)
- 要点: 同じ大伽藍の階段前。モルデンが筆を置き、砕けた器を直して戻った弟子たちを見る。書見台の木札の束は、初対面の時より少し厚い。
- 描くもの: 初対面の絵と同じモルデン・書見台・石段・濁った灯籠 / 増えた木札の束と置いた細筆 / 弟子と修復済みの人業2体。
- 描かないもの: 師オルド、イレーヌ、セラ、壊れた体や遺体、戦闘中の攻撃、開いた胸の扉、読める文字。場面は地下なので空は描かない。
```text
Return to the same deep underground gothic cathedral stairway as the approved first-encounter illustration. This is a NEW medium-close composition for a SECOND encounter: Chancellor Morden has just laid his slender writing brush horizontally on the small dark carved wooden lectern, beside a noticeably thicker short stack of small wooden name tags. The brush is resting flat, not held or floating; make the tags and brush clearly readable as objects in the center foreground at 384x256. Morden stands behind the lectern at the entrance to the descending stone stairs and looks directly toward the returning apprentice with a restrained, grave expression and the faintest thin smile, neither villainous nor saintly. Match his approved character reference exactly: tall lean figure, long gaunt pale face, dark sunken eyes, tall black-purple ceremonial hat with a gold band, dark black-purple gold-embroidered long robe with red inner robe and a heavy gold chain of office with a red jewel. His chest remains covered. One natural empty hand rests on the edge of the lectern and the other hangs at his side. In the near left foreground, the apprentice is seen from the back and three-quarter profile, tousled brown hair, charcoal-black traveling cloak with geometric gold embroidery and a brown leather crossbody satchel at the left hip. Behind the apprentice stand just TWO repaired adult-sized wooden party dolls, a red-cloaked warrior and a white-robed priest, both intact with smooth blank round wooden heads without eyes, mouth or ears and black iron joint bands. Keep the apprentice and companions smaller than Morden, giving him, the brush and increased name-tag stack visual priority. A few cloudy lanterns with dim amber light and tied wooden tags stand in orderly rows beside the same lectern; tags contain only illegible tiny marks. The same worn stone stairs descend into a vast shadowed cathedral beyond him. Cool muted cyan underground ambient light contrasts with restrained warm amber lantern light. No visible sky, no Ordo, Irene or Sera, no corpse, no damaged bodies, no combat effects, no open chest hatch, no readable writing. Show the quiet weight of returning after defeat and being refused passage again.
```

**pre_w41「階段の前の宰相」** (主との対面 / 宰相モルデン。戦いの前)
- 要点: 大伽藍のいちばん奥、さらに下へ降りる石段の手前に小さな書見台。痩せた長身の宰相モルデンが細い筆で木札に名を書き終え、筆を置き、札を灯籠に結んで振り返る。足もとに名札つきの濁った灯籠が行儀よく並ぶ (湖の札・灯籠の山の足跡・壁龕の名と同じ手)。ユーザー指定 (2026-10-16): 石床には足形の跡を描かず、周囲と続く自然な石畳にする (本文は維持)。「ここから先へは、行かせません」。敵意ではなく、静かな拒み。
- 描くもの: 書見台・筆・木札 / 名札つきの灯籠の列 / 石段の前に立つモルデン (正典の顔、胸の扉は閉じている) / 手前に立つ弟子と隊の後ろ姿。描かないもの: 師。底のものの正体 (光だけ)。
```text
The innermost depth of a gigantic cavern-cathedral, ceiling lost in darkness. Before a broad ancient stone stairway descending into an abyss (a faint unearthly light far below) stands a small wooden lectern with a fine brush and a stack of small wooden name tags. The chancellor Morden (exact canon face: gaunt, pale, ageless, thin sad smile, tall black-purple hat with gold band, red inner robe, gold chain with a red jewel) has just set down the brush and turns toward the viewer, one hand tying a tag onto a small clouded lantern. Rows of small clouded-black antique lanterns with wooden name tags stand neatly at his feet. The worn stone floor has ordinary continuous paving, with no footprint-shaped hollows (user correction, 2026-10-16). In the foreground, the apprentice and the party of wooden dolls are seen from behind. Calm, sorrowful, a quiet refusal rather than menace.
```

**mem_w41「階段の前のふたり」** (主の記憶 / 宰相モルデン)
- 要点: 一年前。大伽藍のいちばん奥、さらに下へ続く階段の前で、宰相モルデンと師オルドが向かい合う。モルデンは三百年、地上の務めの合間にこの階段を守ってきた。底に眠るものを手にした者は「魂の王」になる。祖は触れるなと言い残した。師は「それを取りに来た」と言う — 魂を何度でも器へ戻せる仕組みに限りを書き入れ、生き切った魂を誰も引き止められないようにするために (イレーヌ・セラにも及ぶ。大事な者だけを例外にはしない。声を聞く仕組みも書く、書けるかは分からない)。モルデンが恐れるのは悪い王ではなく善い王 (正しい言いつけのために旧都を沈めた自分のように)。師は階段を降り、モルデンは追えない。**どちらも悪人にも聖人にも見せない** — 二人とも正しく、二人とも迷っている。
- 描くもの: 天井の見えない巨大な伽藍 / 下の闇へ続く石段 (底にかすかな光) / 胸の小さな扉を開けて古い灯を見せるモルデン (正典の顔・老いない) / 手袋なし・指先の焼けた手で片脚を引きずる師オルド (第十章の姿) / 二人のまわりに並ぶ名札つきの灯籠。描かないもの: 弟子。底のものの正体 (光だけ)。
```text
A memory scene with faint amber-hazed edges: the innermost depth of a gigantic cavern-cathedral whose ceiling is lost in darkness. At its heart, a broad ancient stone stairway descends into an abyss, a faint unearthly light glowing far below. Before the top step stand two men facing each other in tense, sorrowful silence. On the stair side, the chancellor Morden (exact canon face: gaunt, pale, ageless, thin sad smile, tall black-purple hat with gold band, red inner robe, gold chain with a red jewel) has a small door open in his chest revealing an ancient flickering soul-light; he stands between the stair and the other man, not attacking, pleading. Facing him, Ordo (as in the Ordo reference: tall lean man about 55, short grey hair, grey beard) wearing no coat — a torn, worn dark grey shirt (his coat was left frozen on the ice ledges long before) — gloveless, fingertips burnt, leaning on one leg, calm and resolute. Around them, rows of small clouded lanterns with wooden name tags. Neither looks villainous: both look tired, certain, and grieving.
```

**report_w41「王の資格」** (報告)
- 要点: オルドが魂の王になって、器へ戻す仕組みに限りを書くために底へ降りたと聞き、王は玉座の肘掛けを強く握る。限りのない命を霊薬で百年生きてきた自分に、それを責める資格はない。善い王ほど誰の声も聞かなくなるというモルデンの言葉にも覚えがある。勝った者が正しいとは限らない。「追って、確かめて、そなたの目で決めよ。余の命令ではない」。
```text
The same throne room in daylight, clear sky outside. The very old king grips the armrests of his throne hard, knuckles white, his gaze lowered to his own crown resting on his lap as if questioning what it means to be a king. The chancellor's chair stands empty. The apprentice stands below, with Sera (as in the Sera reference) and a doll beside them. Solemn.
```

**irene_candle「消せない灯」** (館の語り)
- 要点: その夜、イレーヌは燭台の前に座ったまま朝まで動かない。師の書こうとしている限りには、イレーヌもセラも入っている。「灯を絶やすな」と言われて守ってきた灯を守ることは正しいのか — 間違っているのかどうかも、まだ分からない。それでも「灯は絶やしません。あの方に、もう一度会うために」。セラは「まだ休みたくない。でもオルド様に会って、どうしてって聞きたい」。
```text
The same mansion at dawn: grey-blue light creeping in through the window. Irene has sat all night before the single white candle on its brass candlestick, her hands folded in her lap, eyes red but resolute, still watching the flame. Sera (as in the Sera reference) sits beside her on the floor, leaning against her knee. The candle still burns, small and steady.
```

**ch10_end「第一部の終わり」** (章の結び)
- 要点: 宰相モルデンは大伽藍の階段の前で、三百年ぶりの眠りにつく。胸の灯は消えず、小さく静かに揺れる。師は魂の王になるために、さらに下へ降りていった。町を焼いた祖、言いつけを守ったモルデン、王になろうとする師、縛りを解きセラを連れ戻してきた隊 — 語り手は誰が正しいとも言わない。「どのように生きたいのか」という宰相の問いに、隊の誰もまだ答えていない。
- 描くもの: 階段の脇に座って眠るように目を閉じたモルデン (胸の扉の中に小さな灯、まわりに名札つきの灯籠) / 下の闇へ続く階段 / 階段の上に立って下をのぞく弟子と隊。
```text
The same gigantic cavern-cathedral after the battle, quiet. Beside the top of the descending stairway, the chancellor Morden (exact canon face, ageless) sits against a pillar with his eyes closed as if peacefully asleep, his chest door ajar with a small, steady soul-light inside, surrounded by rows of small lanterns with wooden name tags. The apprentice and the party (wooden dolls, Sera) stand at the top step, looking down the endless stairs into the abyss, where a faint unearthly light glows far below. Melancholy, resolve, the end of a long first journey.
```

### 第十一章「夜明けの町」 ― 便7

第十一章の景色: 大伽藍の階段の下に広がる、人業が自分で選んで暮らす町。**地上ではない**: 空のかわりに岩の天井いっぱいに古い鉄の吊り枠が張られ、何千もの澄んだ硝子の灯籠「眠り灯」が吊るされている。眠り灯の中では雨と一緒に流れ着いたくたびれた魂が休んでいて、休む魂は温かな白金色に光る。太陽も雲も無く、影の向きも無い (光は天井一面から柔らかく降る)。町は誰が建てたのかも分からない古い地下の大書庫の跡: 閲覧室や回廊が家や店に、書架の板が床や戸口になっている。洗濯物・店先の硝子・台所の湯気。住民はみな人業 (木の関節人業・のっぺりした丸い頭・黒鉄の継ぎ目。正典の隊の人業と同じ作り)、子どもの姿に作られた小さな人業もいる。町の周りの書庫 (迷宮) は暗く、濡れた本・墨だまり・書架の迷路。第十章までの暗い遺跡や戦場とちがい、**光と暮らし**で見せる章。王都の空は晴れたまま (報告の窓の外は晴れた空)。物語の主題は「誰の意思で、誰の救いを決めるのか」 — 師オルドを悪人にも聖人にも見せない。

町の人物 (どれも人業。顔は彫らない丸い頭に、服と持ち物で見分ける): アデーレ = 老婦人の姿、白い髪を結い上げた灰色の長衣、天蓋守の長い鉤棒 / ピム = 子どもの姿の小さな人業、短い上着 / ミラ = 雨に濡れた外套、硝子の瓶 / ヨルク = インクのしみた指、書き写した紙の束 / ロッテ = 前かけ、絵本。

**w42_dawn「夜明けの町」** (手がかり / 迷宮「書架の大階段」)
- 要点: 長い階段の最後の段を降りると、足もとに影が無い。光は岩の天井いっぱいの眠り灯から降る — 空ではない。灯の下に、崩れた書庫を住まいにした町。洗濯物、台所の湯気、自分の用事に向かう人業たち。駆けてくる小さな人業ピムと、後ろから歩いてくる婦人の人業アデーレ。広場に白墨で描かれた戻り灯の陣 (縁に一門の印)。
- 描くもの: 手前に暗い階段の最後の段と弟子・隊の後ろ姿 / 下に広がる光の町と眠り灯の天井 (吊り枠と鉄鎖が見えて、空ではないと分かること) / 駆けてくるピム / 広場の白墨の陣。描かないもの: 師。太陽・青空・雲。
```text
From the last steps of a long dark stairway carved with bookshelves, the apprentice and a party of wooden dolls look down into a vast underground cavern lit like early morning. The light does not come from any sky: the rock ceiling is covered with old iron chandelier frames and chains from which thousands of clear glass lanterns hang, each glowing a soft warm white-gold; no sun, no clouds, no directional shadows. Below lies a town built into the ruins of an ancient underground library — reading halls turned into houses, shelf planks used as doors and floors, laundry lines, shop fronts with glassware, thin kitchen steam. The townsfolk are all wooden articulated dolls (blank round heads, black iron joint bands) going about their own business. A small child-shaped doll runs up the last step toward the party; behind it walks a doll in the shape of an old woman with neatly tied white hair and a grey robe. In the square, a large chalk circle with a small lamp-on-palm crest at its rim. Warm, hopeful, quietly strange.
```

**report_w42「命令の届かぬ所」** (報告)
- 要点: 主をなくした人業たちが自分の暮らしを選ぶ町 — その多くが王家の操霊師の器だったと聞き、王は長く目を伏せる (百年、その主たちを牢へ送ってきたのは自分)。オルドが救い主と呼ばれていると聞いて少し笑う。「その町では客であれ」。
```text
The same throne room in daylight, clear sky outside the tall windows. The very old king, lap blanket over his knees, sits with his eyes lowered, holding a small glass lantern glowing soft white-gold that the apprentice has brought; a faint, rueful smile at the corner of his mouth. The chancellor's chair beside the throne stands empty. The apprentice stands below the dais.
```

**irene_why「ついて歩く理由」** (館の語り)
- 要点: ピムの問い「どうしてその人について歩いているの？」を持ち帰る。イレーヌは主を選んだことがないと言う。答えるのはセラ — 「名前を呼ばれて、一緒に迷宮へ降りて、一緒に帰ってくる。そうやって生きていたい」。イレーヌは「待つことも、選んでいたのかもしれません」。「あなたが代わりに答えてはいけませんよ」。
```text
The same mansion workshop at night, warm candlelight from the single white candle on its brass candlestick. Sera (as in the Sera reference) stands with one hand on her chest door, answering earnestly; Irene sits beside the candle, her hand stopped halfway to trimming the wick, listening with a soft, surprised look. The apprentice sits a little apart, deliberately silent. Intimate and gentle.
```

**w43_jars「今日の瓶」** (手がかり / 迷宮「雨垂れの書庫」)
- 要点: 濡れた書架のあいだの岩の割れ目から、雨が細い糸になって落ちる。下に硝子の瓶がずらりと並び、中で疲れた小さな魂が丸くなっている。字のにじんだ板 (眠り灯の空き無し、日付と数)。黒くふくらんだ一冊から墨が這い出す。柱に師の書きつけと、その下に別の手の書き足し。
- 描くもの: 割れ目から落ちる雨の糸 / 並ぶ瓶と中の青白い光 / 濡れた書架と墨のにじむ本 / 柱の二枚の書きつけ (読めない走り書き) / 瓶を見る弟子。描かないもの: 師・ミラ本人。
```text
A wing of an ancient underground library: tall shelves of soaked, swollen books. From a crack in the rock ceiling, rain falls in thin silver threads onto a long row of glass jars set on the floor; inside each jar a small, pale, tired soul-light lies curled. A board hangs at the end of the row, covered in blurred tally marks. From one swollen black book on a nearby shelf, ink slowly crawls out like a living thing. On a shelf post, a handwritten note is pinned, with a second smaller note in a different hand beneath it. The apprentice crouches by the jars with a warm orange hand-lamp. Cold blue rain, dim, melancholy, but tender.
```

**report_w43「晴れた空の雨」** (報告)
- 要点: 塔の上で鎖を解いた魂も、雨になってあの町へ流れ着いているのかもしれない。王は窓の外の青空を見上げる。「解いたことを悔やむな。縛られたまま腐るより、眠れる場所を探して流れてくるほうがよい」。
```text
The same throne room. The very old king stands at the tall window (helped by a cane or the window frame), looking up at a bright clear blue sky where a light, sunlit rain is falling. The chancellor's chair stands empty. The apprentice stands behind him. Bittersweet.
```

**w44_glass「一度だけ」** (手がかり / 迷宮「眠り灯の工房」)
- 要点: 冷えた炉の並ぶ古い硝子工房で、ひとつの炉だけが温かい (師が火を入れ直した)。作業台に吹きかけの澄んだ灯籠と細い吹き竿、開いたままの師の帳面 (眠り灯の吹き方・数・一行だけの名前、最後の頁に眠らせるための灯籠の絵)。
- 描くもの: 冷えた炉の列とひとつだけ赤い炉 / 吹きかけの灯籠・吹き竿 / 開いた帳面 (絵と読めない走り書き) / 帳面を読む弟子。描かないもの: 師・ミラ本人。
```text
An ancient glass-blowing workshop deep inside an underground library: a row of cold, dark brick furnaces, only one of them glowing red with a relit fire. On a worn workbench lie a half-blown clear glass lantern, a thin blowpipe, ash and tools, and an open handwritten notebook whose last page shows a careful drawing of a simple lantern. Racks of finished clear lanterns stand dim along the wall. The apprentice leans over the notebook in the furnace glow. Warm amber against cold dark, contemplative.
```

**irene_onlyonce「決めるのは」** (館の語り)
- 要点: 帳面の写しの「一度だけ」の一行を、イレーヌが指でなぞる。師は器へ戻す数に限りを書こうとしている — 自分たちのような器にも。セラ「戻してくれてありがとうって、わたしは言いました」。イレーヌはセラを連れ戻したことを間違いだとは思わない。「いつか眠りたいと思う日が来ても、その日を決めるのがわたしであってほしい」。
```text
The same mansion workshop at night. Irene sits at the worktable tracing one line of a copied notebook page with her fingertip, thoughtful. Sera (as in the Sera reference) leans over her shoulder with a small, determined, almost indignant smile. The single white candle burns steady beside them. Warm, quiet, resolute.
```

**report_w44「一度だけ、と言える者」** (報告)
- 要点: 雨の魂に器を渡し二度目は無いと言った師の話を、王は自分の手のしわを見ながら聞く。「一度だけと言える者が、少しうらやましい」。王が決めれば命令、誰も決めねば使い潰される — オルドはその真ん中で迷っている。
```text
The same throne room in late-afternoon light, clear sky outside. The very old king sits looking down at his own wrinkled, spotted hands held open in his lap, a gold cup set aside on the floor by the throne. The chancellor's chair stands empty. The apprentice stands below. Quiet, self-reproaching.
```

**mem_w45「終わりの頁」** (主の記憶 / 大書庫の主)
- 要点: 記憶の場面。大書庫の長机。読み続けるために器が朽ちるたび自分の魂を新しい器へ移し、そのたびに濁っていった老司書 (痩せたローブの屍のような姿、濁った目、読みかけの本を抱える)。向かいに、片脚を引きずる師オルド (第十章と同じ姿: 外套なし・暗い灰色のシャツ・手袋なし・指先の焼けた手) が古い記録を読み、余白に書きこむ。脇に町の人業が運んだ湯気の立つ椀 (手つかず)。奥に、さらに下へ降りる暗い扉。**悪人にも聖人にも見せない** — 司書の「まだ読みたい」と、師の答えられない沈黙。
- 描くもの: 長机・積まれた古い本・余白に書きこむ師 / 向かいの老司書 / 手つかずの椀 / 奥の扉。描かないもの: 弟子。扉の先のもの。
```text
A memory scene with faint amber-hazed edges: a long reading table in a vast underground library whose towering shelves recede into darkness. On one side sits an ancient gaunt librarian in a dusty robe, clouded eyes, clutching an unfinished book to his chest, looking across the table with a quiet plea. On the other side Ordo (as in the Ordo reference: tall lean man about 55, short grey hair, grey beard), wearing no coat — a torn, worn dark grey shirt — gloveless with burnt fingertips, writing in the margin of the oldest open book by lamplight, pen paused. Beside him a steaming bowl, untouched. Far behind, at the very end of the shelves, a dark plain door leading further down. Melancholy, unresolved.
```

**report_w45「余の終わりの頁」** (報告)
- 要点: 終わりの頁がない術の話を聞き、王は自分の百年にも終わりの頁がなかったと言う。終わりがあれば、とうに死んでいた — それが正しかったのだろう。だが、決めるのは自分であってほしかった。「追え。オルドが何を書こうとしておるのか、そなたの目で読んでこい」。
```text
The same throne room at dusk, a clear amber sky outside. The very old king sits with an old leather-bound book open on his lap (a gift from the town), one hand resting on a blank last page, gazing at it. The chancellor's chair stands empty. The apprentice stands below, ready to leave. Grave, gentle.
```

**irene_lastpage「両方を持って」** (館の語り)
- 要点: 燭台の灯が消える日を、イレーヌは一度も考えたことがなかった。大切な人だから、いつか休ませてあげたい。大切な人だから、もう一度会いたい。まだ選べない。セラ「選ばなくていい。両方持って、会いに行きましょう」。
```text
The same mansion workshop late at night. Irene trims the single white candle, her face lit from below, eyes glistening but calm. Sera (as in the Sera reference) holds Irene's other hand in both of hers. The flame is small and steady. Tender, bittersweet.
```

**ch11_end「同じ天井の下で」** (章の結び)
- 要点: 司書の灯は眠り灯の天井のいちばん静かな所に吊るされた。広場の戻り灯の陣のそばで、師に救われたミラ (「一度だけで十分。先生を信じる」) と、師の決まりに不安を持つヨルク (「生き切ったって、誰が決めるんだ」) が弟子を待つ。ふたりは言い争わず、同じ灯の下で暮らしている。弟子は師が何を書こうとしているのか確かめに行くと決め、陣の白墨の線を靴の先でなぞる。
- 描くもの: 眠り灯の天井 (いちばん静かな所に吊るされる灯籠ひとつ) / 広場の陣 / ミラ (濡れた外套・瓶) とヨルク (インクの指・紙束) / 弟子と隊 / 遠くの台所の湯気と小さな人業たち。描かないもの: 師。
```text
The underground town square under a ceiling of thousands of glowing clear lanterns on iron frames (no sky). One new lantern is being hung in the quietest corner of the frame high above. In the square, beside a large chalk circle with a lamp-on-palm crest, two townsfolk dolls stand side by side facing the apprentice: one in a rain-damp cloak holding a glass jar, the other with ink-stained fingers holding a sheaf of copied pages; their postures differ — one hopeful, one uneasy — but they stand together. The apprentice, with the party of wooden dolls, touches the chalk line with the tip of a boot. Kitchen steam and small child-shaped dolls playing in the distance. Warm light, open question.
```

### 第十二章「王家の廟」 ― 便8

第十二章の景色: 大書庫の底の扉 (師が内側から閂を掛けた) の下に広がる、この国の**王家の廟**。王が死ぬと亡骸に香油を塗り、ろうで固めて、王都の地下の縦穴から綱で降ろし、ここへ葬る。千年分の棺が段をなして並ぶ。**ろうそくは一度も消えない** (壁のくぼみに何千本)、甘い香油の匂い、金の死面と金の飾り、白く固まった亡骸 (屍蝋 = ろうのように白くなった亡骸。木の人業とははっきり見分ける — 人の亡骸で、木目も黒鉄の継ぎ目も無い)。光は温かい琥珀のろうそくの灯だけ。地下なので空は描かない (報告の窓の外は晴れた空)。門の上に古い字の一行「王を終わらせるな」(読める文字にしない — 刻まれた一行として見せる)。主題は「誰の意思で、誰の救いを決めるのか」: 最初の王は千年戻され続け、一度だけ「もう、よい」と言ったが、法だけが残って誰も止めなかった。師はその反対の法を書きに降り、隊は灯に「どうしたいのか」と訊く。**師も最初の王も、悪人にも聖人にも見せない。**

人物の追加 (この章だけ): 最初の王 = 若い頃は痩せた二十代の王 (記憶の中、熱にうなされる)。玉座の姿はろうと香油と金に覆われ、王冠が額に溶けついた千年の亡骸 / 太后 = 王の母、喪の黒いヴェール、王の手を握って泣く (記憶の中だけ) / 防腐師の霊 = 香油の壺と細い刷毛を持つ半透明の職人 / 王子 = 金の針金で編んだ小さな冠 (記憶の中で子ども)。

**w46_bar「王を終わらせるな」** (手がかり / 迷宮「弔い灯の参道」)
- 要点: 消えないろうそくの並ぶ参道を降りきると葬列の歌が途切れ、見上げるほどの石の門。門の上に古い字の一行。門の脇に師の野営の跡 (燃え尽きたランプ、石で重しをした書きつけ)。師は町の眠りを守るため、上の扉に閂を掛けていった。門の向こうから香油の匂い。
- 描くもの: 両側の壁のくぼみに何千と灯るろうそくの参道 / 石の門と刻まれた一行 (読めない) / 野営の跡と書きつけ / 書きつけを拾う弟子。描かないもの: 師。亡骸の大写し。
```text
At the bottom of a long underground processional road whose walls are lined floor-to-ceiling with small niches, each holding a lit candle that never burns down — thousands of warm amber flames receding upward into darkness. Ahead rises a towering ancient stone gate of a royal mausoleum, with a single line of archaic carved letters above the lintel (illegible). Beside the gate, the small remains of a camp: a burnt-out brass hand lamp and a folded handwritten note held down by a flat stone. The apprentice kneels to pick up the note, a warm orange hand-lamp at their side. Faint pale ghost-like mourners in a procession fade away behind. Sweet oily haze, solemn, hushed, golden-dark.
```

**report_w46「即位の日の文句」** (報告)
- 要点: 門の一行を聞いた王は、即位の日にも同じ言葉を聞かされたと打ち明ける (古い儀式の文句だと思っていた)。歴代の王の棺は縦穴から綱で降ろされ、その底を王は知ろうとしなかった。「そこに眠る者は、みな余の祖だ。荒らすでないぞ」。
```text
The same throne room in daylight, clear sky outside the tall windows. The very old king (lap blanket over his knees) sits looking at the crown resting in his hands as if reading something written inside its rim, remembering his coronation. The chancellor's chair beside the throne stands empty. The apprentice stands below the dais. Quiet, troubled.
```

**w47_ledger「最初の器」** (手がかり / 迷宮「香油の仕立て場」)
- 要点: 亡骸を整える作業場。何百もの石の台、香油の壺と刷毛。いちばん奥の古い台の脇の書見台に、鎖でつながれた厚い帳面 (防腐師たちが代々書き継いだ記録)。最初の頁は、若くして死んだ王の亡骸に魂を戻した日の記録。余白に師の書きつけ。
- 描くもの: 石の台の列と香油の壺 / 鎖の帳面と開いた最初の頁 (読めない古い字) / 挟まれた師の書きつけ / 帳面を読む弟子。描かないもの: 師。台の上の亡骸の大写し (布をかけた形だけ)。
```text
An ancient underground embalming workshop: hundreds of worn stone slabs in rows, some with sheet-covered shapes, shelves of sealed oil jars and fine brushes, golden candlelight, a sweet oily haze. At the far end, by the oldest, deeply worn slab, a heavy ledger is chained to a lectern, open to its very first page of faded archaic script (illegible); a small newer handwritten note is tucked in the margin. The apprentice leans over the ledger with a warm orange hand-lamp. Reverent, unsettling, tender.
```

**irene_vessel「木の手のひら」** (館の語り)
- 要点: 最初の器は王自身の亡骸だったと聞き、イレーヌは自分の木の手のひらを見る。一門が木を選んだのは、誰の亡骸も使わずに済むようにか、いつか朽ちてくれるからか。セラ「木でよかった。借り物じゃなく、わたしの体だから」。死なせたくないという気持ちを、間違いとは言いたくない。
```text
The same mansion workshop at night, the single white candle burning steady on its brass candlestick. Irene sits at the worktable looking down at her own open wooden palm, the fine black-iron joint at her wrist visible, thoughtful and gentle. Sera (as in the Sera reference) sits beside her and places her own wooden hand flat next to Irene's, smiling softly. Warm, intimate.
```

**report_w47「術の生まれた所」** (報告)
- 要点: 魂を器へ戻す術はこの国の王家が生んだものだった。霊薬で百年生き延びた自分も、その術の続きにすぎない。死なせたくない者を何人も見送った王は、師の書きつけを責めない。
```text
The same throne room in late-afternoon light, clear sky outside. The very old king grips the armrests of his throne, gazing at the gold cup that sits on the floor beside the throne (he no longer drinks from it). The chancellor's chair stands empty. The apprentice stands below. Heavy, self-reflective.
```

**w48_masks「三枚の死面」** (手がかり / 迷宮「眠らずの近衛廊」)
- 要点: 近衛廊の果ての小部屋に、歴代の王の金の死面が古い順に壁一面。顔は一枚ごとに違うが、いちばん新しい三枚だけが年の違う同じ男 (今の王) の顔。記録官の帳面は三度の葬儀の欄だけ亡骸の名が空いている。
- 描くもの: 壁一面の金の死面 (目を閉じた顔の列) / いちばん新しい三枚 (同じ顔の若い頃・中年・老年。今の王の正典の顔立ちに合わせる) / 台の上の開いた帳面 / 見上げる弟子。描かないもの: 王本人。師。読める文字。
```text
A small vaulted chamber at the end of a long mausoleum corridor guarded by statue-still royal guards. The entire wall is covered with golden death masks of past kings, hung in rows from oldest to newest, every face calm with eyes closed, each face different. The three newest masks at the end of the last row show the same man at three different ages — young, middle-aged, old — matching the very old king's face (long features, later a long beard). On a stand below lies an open register with three blank lines. The apprentice looks up at the three masks, holding a warm orange hand-lamp. Golden candlelight, stunned silence.
```

**irene_masks「留守の帳面」** (館の語り)
- 要点: 死面の話を聞いて、イレーヌは古い帳面を棚から下ろす。師が戻らなかった一年、毎晩つけた留守の記録。どの日も同じ一行「オルド様、留守」— 死んだとは書けなかった。書かないままでは、その人はどこにもいなくなってしまう。
```text
The same mansion workshop at night. Irene sits by the single white candle with an old leather notebook open on her lap, every page filled with the same short line repeated, her finger resting on the latest entry. Sera (as in the Sera reference) leans in to look at the page with a small hopeful face. Soft, melancholy candlelight.
```

**report_w48「尋ねなかった名」** (報告)
- 要点: 弟子が口を開く前に、王は「いちばん新しい三枚は、余の顔であったろう」と言う。百年のあいだに三度死んだことにされ、跡継ぎのふりで玉座に座り直した。棺の中に誰がいるのか、一度も尋ねなかった。「その者たちの名を、余は知りたい」。
```text
The same throne room at dusk, a clear amber sky outside. The very old king sits with his eyes closed and one hand over his face, the other hand open on the armrest, deeply ashamed. On a small table beside the throne lies a stack of old hospice registers. The chancellor's chair stands empty. The apprentice stands below, silent. Grave.
```

**pre_w49「玉座の王」** (主との対面 / 王家の廟の主。戦いの前)
- 要点: 段をなして並ぶ歴代の棺の頂に玉座。ろうと香油と金に覆われた千年の王が座る (王冠は額に溶けつき、手は玉座の飾りと見分けがつかない)。防腐師の霊たちが休みなく刷毛で頬のひびを埋める。濁った目が開き、唇が何か言いかける。近衛が槍を構える。玉座の脇に空の新しい棺。
- 描くもの: 棺の段と玉座 / 王 (恐ろしいより、痛ましい) / 刷毛を動かす半透明の防腐師たち / 槍の近衛 / 空の新しい棺 / 手前の弟子と隊の後ろ姿。描かないもの: 師。戦闘の閃光。
```text
The deepest hall of an underground royal mausoleum: tier upon tier of ancient coffins rising like steps, and at the top a throne. On it sits a thousand-year-old king entirely encased in pale wax, embalming oil and gold, his crown melted into his brow, his hands fused with the ornate armrests — more pitiful than monstrous. Translucent ghostly embalmers with oil jars and fine brushes hurry around him, smoothing cracks on his cheeks. His clouded eyes have just opened and his lips part as if to say something. Royal guards encased in wax lower their spears. Beside the throne stands one new, empty coffin. In the foreground, the apprentice and a party of wooden dolls seen from behind. Thousands of candles flare up. Tragic, solemn.
```

**pre_w49_retry「ふたたび玉座の前で」** (主との対面 / 王家の廟の主。全滅後の再挑戦)
- 要点: 器を直して玉座の間へ戻る。防腐師の霊は前よりせわしなく刷毛を動かし、王の唇はまた何か言いかけて止まる。砕けても直され、灯を戻されて帰ってきたのは隊も同じ。
- 描くもの: pre_w49 と同じ玉座と王を、別の構図 (近め) で / 修復済みの人業2体と弟子。描かないもの: 壊れた体・遺体、師、読める文字。
```text
Return to the same mausoleum throne hall as the first-encounter illustration, in a NEW closer composition for a SECOND encounter. The wax-and-gold encased ancient king on his throne, lips half-parted again as if about to speak; the ghostly embalmers brush oil onto his face more hurriedly than before. In the near foreground the apprentice is seen from behind with just two repaired wooden party dolls (red-cloaked warrior and white-robed priest, smooth blank round heads, black iron joint bands), intact. Quiet weight of returning after defeat — both the party and the king have been "brought back" again.
```

**mem_w49「もう、よい」** (主の記憶 / 王家の廟の主)
- 要点: 記憶の場面。千年よりも昔、熱にうなされる若い王の手を、喪のヴェールの太后が握って泣く (「この子を終わらせてはなりません」)。重ねて、三月前の場面: 玉座の前に立つ師オルドと、「終わらせてくれ」と言う王。師は答えずに玉座の裏の階段を降りる (下から熱い鉄の風)。**悪人にも聖人にも見せない。**
- 描くもの: 左に過去 (寝台の若い王と太后、香油を持つ術者) / 右に三月前 (ろうと金の王の前に立つ師 — 第十一章と同じ姿: 外套なし・暗い灰色のシャツ・手袋なし・指先の焼けた手・片脚を引きずる) / 奥に玉座の裏の暗い階段と赤い熱の光。描かないもの: 弟子。底のものの正体。
```text
A memory scene with faint amber-hazed edges, two moments blending across one wide image. On the left, over a thousand years ago: a feverish young king lies on a canopied bed while his mother, the queen dowager in a black mourning veil, grips his hand and weeps; court practitioners wait with oil jars. On the right, three months ago: the same king now a wax-and-gold encased figure on a throne, lips parted in a plea; before him stands Ordo (as in the Ordo reference: tall lean man about 55, short grey hair, grey beard), no coat — a torn worn dark grey shirt — gloveless with burnt fingertips, leaning on one leg, looking at the king with quiet sorrow and resolve, not answering. Behind the throne, a dark stairway descends, a faint red heat glowing from below. Melancholy, unresolved.
```

**report_w49「余が決めた日に」** (報告)
- 要点: 隊が灯に「どうしたいのか」と訊いたと聞き、王は深く息をつく (命令でしか救えない者も、訊いていては間に合わない者もいる)。玉座の脇の棺のことを聞き、自分の手を見る。「いつか、余はその棺に入る。余が決めた日に、余の足で」。
```text
The same throne room in clear morning light, blue sky outside the tall windows. The very old king sits upright, looking at his own open hands with a calm, almost peaceful faint smile, as if he has made a private decision. The chancellor's chair stands empty. The apprentice stands below. Serene, resolute.
```

**irene_enough「訊く人」** (館の語り)
- 要点: 燭台の芯を整えながら、イレーヌは言えたのに千年聞いてもらえなかった言葉のことを考える。灯に訊くことは法には書けない、訊く人がそこにいなければ。セラ「まだ全然よくない！」— イレーヌは思わず笑う。いつかその日が来たら聞いてほしい。
```text
The same mansion workshop late at night. Irene trims the single white candle, laughing softly despite herself; Sera (as in the Sera reference) stands beside her with fists raised in a lively, indignant "not yet!" gesture. The apprentice sits nearby, smiling. Warm candlelight, tender and light-hearted after sorrow.
```

**ch12_end「答えを聞くまで」** (章の結び)
- 要点: 最初の王の灯は千年ぶりに玉座を離れ、天井の闇へ昇っていく。防腐師たちの刷毛は止まり、参道のろうそくのいくつかが静かに消える。玉座の脇の空の棺。玉座の裏の階段から熱い鉄の匂いの風 (次章の溶鉄炉へ)。
- 描くもの: 空になった玉座と、ほどけた殻の金のかけら / 昇っていく小さな灯 / 刷毛を下ろした防腐師たち / 空の新しい棺 / 玉座の裏の階段と赤い熱の光 / 見上げる弟子と隊。描かないもの: 師。
```text
The deepest hall of the royal mausoleum after the battle, quiet. The throne at the top of the coffin tiers is empty, a heap of broken wax and gold fragments on its seat. A single small soul-light rises slowly from it into the dark vaulted ceiling. Translucent embalmers have lowered their brushes and stand still, watching. Some of the candles along the walls have gone out for the first time. Beside the throne, one new empty coffin. Behind the throne, a dark stairway descends with a faint red glow and heat shimmer rising from below. The apprentice and the party of wooden dolls look up at the rising light. Release, sorrow, an open question.
```

### 館の語りの追加 (2026-10-16)

`irene_boons`・`irene_undercity`・`irene_furnace`・`irene_abyss`・`irene_coat`・`irene_frozen` は一覧へ追加済み。制作指示は4章冒頭。セラの覚醒状態で分岐する語りには、両方に合うイレーヌ中心の絵を使う。

---

### 第十三章「溶鉄炉」

今回の制作対象は本文・設定・ゲームデータのみ。以下は場面IDと本文に対応する引き継ぎ用の指示であり、原画・挿絵・敵・依頼人・景色は別途制作する。描画は今回実行しない。人物は既存の基準を継承し、師の記憶を描く場合は第十二章と同じ姿（三月前、外套なし、片脚を引きずる）。魂を鉄の材料として描かない。

**w50_orders「器を待つ名」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
Empty iron freight yard beneath the royal crypt. Chains carry crates of broken iron vessels past stacks of old metal order tags. One reversed tag shows fine personal scratch marks. No Ordo in the present scene.
```

**w51_mould「型の外の手」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
At the edge of a vast iron casting workshop, a small individual hand mould lies face up among uniform industrial moulds. Its finger lengths differ. No living person inside a mould.
```

**w52_bell「今日は、休む」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
A motionless shift bell without its clapper hangs above stepped quenching tanks. White steam, an old duty roster and a note on dry stone. No swamp.
```

**report_w50「王の数え方」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established elderly king in his throne room studies a copied metal order tag, troubled, tracing the armrest with one hand. Empty chancellor chair.
```

**report_w51「誰のための器」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established elderly king leans forward listening to an account of a hand made for one individual. Quiet throne room; empty chancellor chair.
```

**report_w52「座った侍従」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established elderly king gestures toward a chair as an elderly attendant sits down nearby. A small ordinary pause in a formal throne room.
```

**report_w53「聞こえない声」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established elderly king listens thoughtfully in the throne room, glancing toward an attendant seated nearby. A copied order tag rests on a table.
```

**pre_w53「注文の向こう」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
An immense iron foundry master with a furnace in its chest raises a hammer before a great casting furnace. Old order-tag chains pull at its shoulders. Newly cast golems rise behind it; the small inner soul light is faint.
```

**pre_w53_retry「戻った手」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The same foundry master continues hammering before the great furnace. In the foreground, repaired wooden doll hands show their joints. Order-tag chains, iron forms, heavy fatigue.
```

**mem_w53「明日の鎚」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
Present aftermath: the iron foundry master rests beside a low furnace fire, its small soul light still burning and hammer placed within reach. New-order conveyor chains are detached; cooling water continues flowing. Do not depict a human soul as smelting material.
```

**irene_hands「杯を持つ手」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established Irene in the mansion workshop quietly examines her wooden fingers holding a cup, with a small vase of flowers nearby. Keep her established face and black iron joints.
```

**irene_tomorrow「今日は、ここまで」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
The established Irene and Sera put away tools together in the mansion workshop. An unfinished vessel is covered with cloth; two tea cups wait. The single candle stays lit.
```

**ch13_end「低い火」** (制作待ち)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。
```text
A great foundry at low heat, a quiet hammer within reach of a resting iron vessel, detached order chains and an open cooling channel. A dark stair beyond the furnace leads toward distant prayer. No future-chapter revelation.
```

### 第十四章「深淵の聖堂」

今回の5場面は本文（一覧・ゲーム内）に合わせて制作する。現在の発見の場面であり、師をその場に登場させない。聖堂の人業は木の体と黒鉄の継ぎ目を持つ。後の章の秘密を描かない。

**w54_shoes「二足の木靴」** (手がかり)
- 描くもの: 石段の下の白布の市 / 木の靴職人と木の足 / 作業台の大小二足の木靴と削りくず / 隅の師の書きつけ（読めない）。描かないもの: 現在の師、地上の娘、屋外の空。
```text
Under massive underground cathedral stone stairs, a modest market sheltered by white cloth awnings. Focus on a seated wooden articulated shoemaker with black iron joint bands, plain work apron and visible wooden feet, carefully shaving a wooden clog. On the central bench are exactly two individual wooden clogs, one adult-sized and one much smaller for his daughter; wood shavings and a small carving knife. His posture conveys quiet happiness at working again. A handwritten note and a little hand-drawn route lie at the corner, all marks illegible. A few wooden residents repair a cup and measure an arm in the distant market. Warm task light against cool subterranean stone. No Ordo, no daughter physically present, no sky.
```

**w55_reply「返事のある祈り」** (手がかり)
- 描くもの: 石の回廊の鏡窓 / 老いた姿の人業 / 鏡の中だけの白髪の女とほつれた婚礼の布、祈りの皿 / 直された留め具と書きつけ。描かないもの: 現在の師、鏡を通り抜ける人、普通の鏡像。
```text
A quiet underground gothic stone corridor with small recessed mirror windows. An elderly-looking articulated wooden resident with black iron joint bands leans toward one antique mirror, sharing a tender everyday conversation. Inside the mirror alone appears a white-haired elderly human woman in a modest home, holding frayed wedding cloth beside a prayer dish with a small flame; a flowering garden tree is glimpsed behind her in bright daylight. This is a magical conversation with a distant home, not the doll's reflection. The mirror's repaired metal fastening and a tucked repair note with illegible scribbles are clearly visible. Warm light from the mirror meets cool blue cathedral shadows. No Ordo, no physical crossing through the mirror.
```

**w56_prayer「消されなかった願い」** (手がかり)
- 描くもの: 灰の積もる鐘楼の最上段 / 胸を押さえた小さな人業 / 祈りの紙の炉と外れた細い鎖 / 古い祈りと弔い印の名札、師の紙（読めない）。描かないもの: 師、死体、人業の破壊、戦闘。
```text
At the top landing of an underground cathedral bell tower, paper ash lies on worn stone steps. A small intact wooden articulated resident sits with one hand gently against its chest door, shoulders finally relaxed in relief. Beside it is a small prayer-paper brazier with old papers and an aged name tag bearing only an abstract mourning mark. A fine chain leading from this one brazier toward the bell mechanism has been unhooked and lies visibly slack on the stone. Other distant bells and braziers recede below. An old note behind the brazier has illegible lines, one crossed out. Quiet blue soul-light and low amber embers, compassionate rest rather than death. No Ordo, no corpse, no combat, no damaged doll.
```

**ws30_patterns「縫い直された袖」** (寄り道の発見)
- 描くもの: 倒れた棚の下の開いた箱 / 線を引き直した袖・すその型紙 / 留め具、針と糸、縫い直された袖 / 底の手紙と返事（読めない）。描かないもの: 人物、服を着た幽霊、師。
```text
An intimate still life discovered in an underground cathedral tailoring room: beneath a fallen wooden shelf sits an open box of old garment patterns. Large sleeve and hem patterns have several visibly redrawn contour lines, a fastening position moved to the left. A carefully resewn cloth sleeve rests over the box edge beside thread spools, a needle and different individual clasps. At the bottom lies one letter with a short reply underneath, both entirely illegible scribbles. Cool stone shadows and a warm portable exploration light reveal cloth texture, paper and patient individual adjustments. No people, no ghosts, no Ordo. Make the altered sleeve and patterns readable at small size.
```

**ws31_letters「読まれなかった返事」** (寄り道の発見)
- 描くもの: 納骨室の石の台 / 開いた名簿と間に残った返事 / 隣り合う二通の手紙、古い名札と品。描かないもの: 魂を呼ぶ炎、幽霊、師、読める文字。
```text
A quiet underground cathedral ossuary, close still life on a worn stone ledge. An open old register with thick pages holds a long-undelivered reply between its leaves. Exactly two separate personal letters are laid side by side in the central foreground, one older and one the reply, their sender and recipient marks subtly reversed but entirely illegible scribbles. A small keepsake and an old name tag rest nearby; sealed burial niches recede softly into cool blue darkness. Warm portable exploration light grazes the paper edges. Tender absence and acceptance, no summoning flame, no ghosts, no Ordo, no readable text. The two adjacent letters are the unmistakable focal point.
```

#### 王への報告と主との対面

2026-10-22、ユーザー指定の5場面を制作する。本文は `src/story.js` と `src/archive-stories.js` の実装済みの文を正本とし、変更しない。報告は地上の王宮、主との対面は地下の聖堂。現在の師オルドや先の章の秘密は描かない。

**report_w54「帰りたい者」** (報告)
- 要点: 娘の木靴を作るため戻った職人の話を聞いた王が、自分の足元を見る。師も再会の喜びを知っていたと受け止める。
- 描くもの: 膝掛けを掛けた老王、足元へ落とした視線、聞き手の弟子。描かないもの: 王宮へ運ばれた木靴、靴職人や娘の実体、師、宰相。
```text
The established royal throne room in clear daylight. A medium three-quarter composition, close enough that most of the room architecture stays outside the frame. The very old king, long white hair and beard, pointed gold crown, red robes and white ermine cape, sits on the established carved gold-and-red throne with a grey lap blanket. Having heard about a returned shoemaker making shoes for his daughter, he lowers his gaze toward his own ordinary shod feet just visible below the blanket. His lined face is thoughtful, touched by another person's joy. The apprentice with tousled brown hair, black cloak with restrained geometric gold embroidery and brown leather satchel is seen in profile at the edge of the foreground, quietly reporting. Warm candle highlights against gentle blue daylight, clear blue sky if a narrow window is visible. No wooden shoes or shoemaker in the palace, no Ordo, no chancellor. Other furnishings remain outside the crop. One quiet present-day moment, no memory overlay.
```

**report_w55「同じ日を生きる」** (報告)
- 要点: 生き返れという願いだけでなく、花が咲いたと知らせる祈りもあると知り、王は窓の外へ目を向ける。
- 描くもの: 窓を見つめる老王の横顔、明るい青空、報告する弟子。描かないもの: 王宮の魔法の鏡、窓に映る死者、師、宰相。
```text
The established very old king sits on his gold-and-red throne in the royal palace and turns his face toward a tall gothic window, reflecting on two people who still share news of a flowering garden while living apart. A close side-profile composition with the king's weathered face and flowing white hair at the centre, the pointed gold crown, white ermine and red robe, grey lap blanket partly visible. Beyond the window is luminous clear blue daytime sky and a small glimpse of sunlit green branches, never a storm sky. The apprentice in the established black gold-embroidered cloak stands quietly at the opposite edge, softly out of focus. Preserve the palace's dark carved stone, gold details and red cloth; keep the wide room layout outside the crop. Gentle blue daylight and warm amber candle accents. No magic mirror, no ghost in the window, no Ordo, no chancellor. Tender, contemplative, one present-day scene.
```

**report_w56「願いだけが残る」** (報告)
- 要点: 呼んだ者はもう死んだと聞き、王の指がひじ掛けを握る。隊が眠りたい声を聞いて鎖を外したことを受け止める。
- 描くもの: 玉座のひじ掛けを握る老いた手、王の重い表情、報告する弟子。描かないもの: 王を縛る鎖、王宮に置かれた鐘、眠る人業の実体、師、宰相。
```text
An intimate diagonal close view of the established very old king on his carved gold-and-red throne in the royal palace, reacting to news that the person who kept calling a soul back has already died. His aged right hand grips the ornate armrest firmly, the thumb and four fingers anatomically clear; this hand and his troubled white-bearded face form the visual focus. His other hand rests naturally on the grey blanket over his knees. Pointed gold crown, red embroidered robe, white ermine cape with black spots. At the left edge a partial rear three-quarter view of the apprentice in his black gold-embroidered cloak, reporting that the party unfastened the chains and let the wooden vessel sleep. Clear blue daylight from an off-frame window, warm amber highlights on the gold carving. Crop out most palace architecture. No literal chains binding the king, no bell or sleeping doll in the palace, no Ordo, no chancellor, no ghostly memory overlay. Sober concern and attentive listening.
```

**report_w57「待つ場所」** (報告)
- 要点: 戻ってほしいという願いを否定せず、返事をする時を待つ場所を残した報告。王にも帰ってほしいという願いがある。
- 描くもの: 王と弟子の静かな対話、力を抜いて開いた王の手、穏やかな表情。描かないもの: 聖堂から持ち出された鈴や大司教の灯、師、宰相。
```text
A quiet present-day conversation in the established royal throne room, framed as a balanced medium two-shot rather than a wide architectural view. The very old king sits at the right on the carved gold-and-red throne, grey blanket over his knees, pointed gold crown, long white hair and beard, red robes and white ermine cape. He looks directly toward the apprentice with a restrained, gentle, vulnerable expression, one relaxed hand open above the armrest as he acknowledges his own wish for someone's return and the need to wait for an answer. The apprentice stands at the left in three-quarter rear view, tousled brown hair, black cloak with restrained geometric gold embroidery and brown leather satchel, listening. A calm interval of space between them is central to the composition. Soft clear daytime blue light and warm candlelight, a narrow blue-sky window glimpse only if visible. No bell or archbishop soul-light brought into the palace, no Ordo, no chancellor, no invented props or memory vignette. Patient, humane, unresolved but peaceful.
```

**pre_w57「届いた祈り」** (主との対面)
- 要点: 祭壇の大司教の霊が、戻りたくないという器の声を聞かず、次の祈りを掲げる。帰らせねばという善意と、聞かれない返事を同じ場面に描く。
- 描くもの: 幾重もの白い衣とすそに縫われた祈りの紙、大司教の霊、起き上がる木の器、胸の灯をかばう隊の人業、弟子の後ろ姿。描かないもの: 戦闘の閃光、倒された主、切断済みの鎖、祭壇の小さな鈴、師、地上の空。
```text
Deep underground in the prayer-laden cathedral, before battle. Gothic stone pillars and an ancient altar disappear upward into darkness; no exterior sky or inhabited city. Behind the altar stands the ghost of an elderly archbishop, his translucent calm sorrow-worn face above many layered white ceremonial robes. Numerous small aged prayer papers are sewn onto the robe hems, all marks illegible. He raises the next prayer sheet with a serene, unwavering sense of duty, looking toward the party's soul-light instead of listening to a newly awakened vessel. At his feet, one plain adult-sized articulated wooden vessel with a smooth blank round head and black iron joints struggles to rise from a seated position, one palm raised weakly in refusal. In the near foreground the apprentice, tousled brown hair, black gold-embroidered cloak and leather satchel, is seen from behind beside two adult-sized party dolls from the reference: red-cloaked warrior and white-robed priest, blank smooth wooden heads and black iron joint bands. The warrior turns partly sideways and cups a protective wooden hand over the small blue-white soul-fire inside its open CHEST door, so the chest light and guarding hand are visible, never on its back. Unbroken bell chains descend in the distant upper darkness. Faint pale soul-fire and restrained warm votive candlelight illuminate white cloth, paper, wood and ancient stone. The archbishop, rising vessel and protected chest-light must remain readable at 384x256. Tragic earnestness, no sinister grin or demonic corruption. No battle flashes, no defeated archbishop, no cut chains, no little altar bell yet, no Ordo, no readable text.
```

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
| 2 | ws4 銀業の隠れ里 | 霧の奥の里、銀の小人たち (器になれなかった魂)、彼らを守る空の鎧と石の人業 |
| 2 | ws6 見捨てられた狼煙台 | 砦の扉や旗竿までくべて燃やし続けた狼煙の火の塔、来なかった援軍 |
| 2 | ws7 獄吏の詰所 | 牢番の寝起きした詰所、押収品の箱と鍵束、人を越えた番人 |
| 2 | ws8 沈んだ書庫 | 内から閉ざされた書庫の塔、封をした書の箱、名を墨で塗りつぶした写し |
| 2 | ws9 黒曜の切り場 | 熱で溶けて急に冷えた黒曜の崖、刃を研いだ跡 |
| 2 | ws11 白狼の吹き溜まり | 底まで固まらない雪の吹き溜まり、白霜の狼の巣に埋められた靴・外套・手紙 |
| 2 | ws12 氷河の裂け目 | 解けはじめた氷の裂け目、底へ落ちる細い水、壁の奥で光る凍った魂 |
| 2 | ws14 沈んだ渡し場 | 沼の島へ渡る舟の渡し場、灯をともして客を待ち続けて沈んだ渡し守、沈んだ舟の金貨 |
| 2 | ws16 錆びた避雷針の林 | 塔の張り出しに林のように打たれた錆びた鉄の針 (根元の一門の印)、焼けた旅人の荷 |
| 2 | ws18 勝者の控え所 | 闘技場の外壁の内側の控えの間、壁一面の勝ち星の札 (最後に「休めず」)、勝ち残った闘士の霊 (済) |
| 2 | ws19 決闘の小円形場 | 闘技場の裏手の小さな円い決闘場、入口の石に彫られた一対一の礼の絵 (済) |
| 2 | ws20 大空洞の主の寝床 | 大空洞の脇の天井の高い岩屋、床一面の巨獣の骨、骨の山の上で光るものを一つ抱えて眠る山のような巨獣 (済) |
| 1 | ws21 化石竜の墓所 | 岩盤に丸ごと埋まった山のように大きな竜の骨、骨のすき間をたどる道、頭骨の目のくぼみの奥の小さな灯 (済) |
| 2 | ws22 水晶の鉱脈 | 大空洞の壁を割って走る青白い水晶の鉱脈、闇の中の灯を拾って昼のように明るい奥 (済) |
| 2 | ws25 名の無い墓所 | 灯も届かない小さな墓所。王の名を刻んだ墓碑が並び、そのひとつの下に震える字で別の名が書き足されている。名を探して泣く貴人の霊 (第十二章) |
| 2 | ws26 剥製の大広間 | 天井の高い広間に、香油とろうで固められ牙をむいたまま並ぶ何百もの獣 (王たちの狩りの獲物)。奥に剥製師の作業机 (第十二章) |
| 2 | ws27 王子の墓所 | 小さな墓所の奥で、金の針金の小さな王冠をかぶった老いた王子の骸と従者たち。一度も読み上げられなかった即位の誓いの巻物 (第十二章) |
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
