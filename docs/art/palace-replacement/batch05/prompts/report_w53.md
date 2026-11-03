# report_w53「聞こえない声」 第13章 ── 新規 (制作待ち)

## 保存先
- 原画 (PNG・1536×1024): `art/story-review/chapter13/report_w53.png`
- 出荷 (WebP): `art/story/chapter13/report_w53.webp` ← 自分で作らない。`python3 tools/storyart/build.py` が作って登録する

## 参照画像 (この順に渡す)
1. `docs/art/story-refs/king.png` — 基準: king
2. `docs/art/story-refs/palace-front.png` — 王宮内部の基準 (別室では材質・装飾だけを参照)

### 本文 (ストーリー一覧)
> 師は、一人が決めねば使われ続ける者が出る、その責めを負いに行くと言った。王はその理由が分かると言った。
> それでも、その一人に聞こえない声はどこへ届くのか。今日は休み、明日はまた作るという答えを聞き、王は座った侍従へ目を向けた。
> 明日のことを今日すべて決めずに済んだ。その声を師にも聞かせよと、王は弟子へ告げた。

### 本文 (ゲーム内・王への報告 REPORTS.w53)
> 「大炉を、低い火にしたか。灯は消さずに。」
> 工房長が初めは自分で戻ることを望んだこと。取り消されない注文を捨てられなくなったこと。一枚だけ、まだ待っていると返事があったこと。王は、最後まで黙って聞いていた。
> 「師は、その責めを引き受けに行く、と言うたか。一人が何も決めねば、使われ続ける者が出る。それは、余にも分かる。」
> 「だが、決める者が一人ならば、その者の聞こえぬ声は、どこへ届けばよいのだ。」
> 明日も作りたい、今日は休みたいという声を伝えると、王は、座った侍従へ目を向けた。
> 「明日のことを、今日すべて決めずに済んだか。……それを続けるのも、骨の折れる仕事であろうな。」
> 「{弟子名}よ。追うがよい。その声を、師にも聞かせるのだ。」

## 描くもの・描かないもの (指示書 4章)
- 要点: `src/archive-stories.js` の同名場面と本文を正本とする。次章の正体・祖の名は描かない。

## 画像生成に貼る英語の指示
```text
Create ONE standalone landscape illustration 1536x1024, aspect 3:2, edge-to-edge, no panels, no borders, no labels, no typography, no readable text anywhere (all writing is illegible scribbles). Match the attached Dungeon of Souls artwork exactly: lavish high-quality fine-grained pixel-textured dark fantasy illustration, sophisticated natural adult proportions, meticulously detailed gothic carved stone, embroidered cloth, black iron, carved wood, crisp tiny highlights, rich controlled cool moonlit/cyan light against warm amber candlelight. Believable hands with a thumb and four fingers, exactly two arms and two legs per character. Preserve the reference characters' identity and costumes exactly. Keep the narrative focal object readable when the image is shrunk to 384x256. Do not copy the reference composition; depict the new scene below.
Sky continuity: In present-day scenes from report_w33 (the hundredth-year blue sky) onward, including Roadal, depict bright skies: blue daylight or luminous sunset if the text specifies evening. Do not restore the old dark storm sky. Keep explicitly night-time scenes and historical memories faithful to their stated time.
The established elderly king listens thoughtfully in the throne room, glancing toward an attendant seated nearby. A copied order tag rests on a table.
```

