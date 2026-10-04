// ===== 酒場「沈まぬ灯」の依頼 (クエスト) =====
// 酒場の依頼は2種類:
//   ・フリークエスト (掲示板の依頼) … 何度でも受けられる。掲示板の顔ぶれは迷宮から帰還するたびに入れ替わる
//       (受けた依頼は残る)。受けられるのは同時に FREE_CAP (5) 件まで。新たに受けるには、達成して報告するか放棄する。
//       種類: 討伐 (特定の魔物) / 納品 (特定の品。旧来の「納品依頼」) / 魂 (死体から魂を拾う) / 宝箱 / 到達 (ある迷宮のある階へ)。
//       報酬: 金貨・✦Soul・職業の魂 (納品は品のレア度で魂の格が決まる — DELIVERY_REWARDS)。
//   ・固定クエスト (依頼人の頼み) … 進み具合 (迷宮の報告・踏破・地図) に応じて依頼人が現れる。果たせるのは一度だけ。
//       フリークエストより豪華 (赤い魂・魂の残火・上位の魂)。受注の上限は無く、5件の枠にも数えない。
//       受けることで地図に現れる迷宮もある (opens → world.js の unlock: { quest: id })。
// 報酬の量は「戦果」(その迷宮・階の普通の戦闘1回分の金貨/✦Soul — game.js questUnit) の倍数で決める。
// このファイルは game.js を import しない: 掲示板の生成は ctx (game.js が渡す窓) を通す。
// 依頼の id (固定クエストの id・依頼人の並び) は保存されるので変えない・使い回さない。
import { poolAt } from "./dungeons/world.js";
import { MONSTERS } from "./sprites.js";

export const FREE_CAP = 5;     // 同時に受けられるフリークエストの数
export const BOARD_SIZE = 4;   // 帰還のたびに掲示板に貼られる依頼の数 (うち1件は納品)

// ===== 酒場の依頼人たち =====
// 掲示板の依頼は、この顔ぶれの誰かが貼っていく。口上 (line) は依頼の詳細に添える
export const NPCS = [
  { name: "隻眼のガルム", title: "老傭兵", line: "「右目はあの迷宮に置いてきた。代わりに頼みを置いていく。」" },
  { name: "黒衣のセレス", title: "喪服の婦人", line: "「夫は帰りませんでした。せめて、これだけは…。」" },
  { name: "沈黙のヨル", title: "盗掘屋", line: "「…依頼の話だ。声がデカい奴は信用しない。」" },
  { name: "破戒僧オズワルド", title: "破門された司祭", line: "「神は沈黙している。ならば人の手でやるしかない。」" },
  { name: "リリベル", title: "酒場の情報屋", line: "「タダの噂じゃないよ。金になる話さ。」" },
  { name: "片腕のドルン", title: "鍛冶師", line: "「腕は一本で足りる。だが届かぬ場所がある。」" },
  { name: "盲目のヴェスナ", title: "占い師", line: "「視えるのです。あなたがうなずく未来が。」" },
  { name: "墓守のハンス", title: "老墓守", line: "「墓の下が騒がしくてな。眠れんのだよ。」" },
  { name: "脱走兵カイ", title: "若い逃亡兵", line: "「戻れと言われても戻れない。だから、代わりに…。」" },
  { name: "薬婆モルガ", title: "毒草の薬師", line: "「ひっひ…良い素材は、深い闇でしか育たぬ。」" },
  { name: "詩人フェン", title: "落ちぶれた吟遊詩人", line: "「悲劇には続きが要る。お前がその一節になれ。」" },
  { name: "行商人ザッカ", title: "強欲な行商人", line: "「危険? それは値段に含まれている。」" },
];
export const npcOf = (i) => NPCS[i] || NPCS[0];

// ===== 掲示板の依頼文 =====
// {mon}=魔物の名 {goal}=数 {dun}=迷宮の名 {f}=階 {item}=品の名
const KILL_TEXTS = [
  { name: "{mon}の首", text: "「{mon}…あれが仲間の命を喰った。{goal}体、骸に変えてくれ。」" },
  { name: "喰われた者の弔い", text: "「{mon}に喰われた連中の骨が、まだ転がっている。せめて仇を。{goal}体でいい。」" },
  { name: "夜毎の悪夢", text: "「眠るたびに{mon}の声がする。{goal}体斬れば、声は止むはずだ。」" },
  { name: "間引きの依頼", text: "「{mon}が増えすぎた。巣ごと焼く前に、{goal}体ほど間引いてほしい。」" },
  { name: "標本の採取", text: "「{mon}の死骸が{goal}体分要る。研究のためだ。…用途は聞くな。」" },
  { name: "賞金首", text: "「{mon}に賞金が出た。{goal}体。生かしておく理由が、もう無い。」" },
  { name: "供物の調達", text: "「祭壇が{mon}の血を求めている。{goal}体。神の名は…言えない。」" },
  { name: "復讐の代行", text: "「私の手はもう剣を握れない。{mon}を{goal}体、私の代わりに。」" },
];
const SOUL_TEXTS = [
  { name: "還れぬ魂", text: "「置き去りにされた魂が泣いている。{goal}つ、拾い上げてやってくれ。」" },
  { name: "魂の借金", text: "「死んだ相棒に借りがある。魂を{goal}つ回収してくれたら、少しは返せた気になれる。」" },
  { name: "亡者の名簿", text: "「教会の名簿に載らぬ死者たち…魂を{goal}つ。彼らにも名があったのだ。」" },
  { name: "器のための魂", text: "「空の器ばかり増えていく。魂を{goal}つ。死者には悪いが、こちらも商売だ。」" },
  { name: "冷たくなる前に", text: "「死体はまだあたたかいうちに限る。魂を{goal}つ、冷める前に頼む。」" },
];
const CHEST_TEXTS = [
  { name: "置き去りの荷", text: "「荷を置いて逃げた。宝箱を{goal}つ漁ってくれ。中身はやる。記録だけ欲しい。」" },
  { name: "遺品の回収", text: "「死んだ隊の荷が、宝箱に残っているはずだ。{goal}つ開けて、確かめてほしい。」" },
  { name: "中身より鍵", text: "「宝箱の中身はくれてやる。{goal}つ、開けた感触だけ教えろ。…探している鍵がある。」" },
  { name: "罠師の検分", text: "「迷宮の罠は俺の師匠の仕事だ。宝箱を{goal}つ開けて、腕前を確かめてくれ。」" },
  { name: "投機の検算", text: "「宝の質を知りたい。{goal}箱ぶん開けてこい。儲け話の種になる。」" },
];
const REACH_TEXTS = [
  { name: "灯りを届けて", text: "「{dun}の地下{f}階まで、この祈りを届けてほしい。着けばわかる。闇が少し、薄くなる。」" },
  { name: "道標の確認", text: "「{dun}の地下{f}階へ降りる道が生きているか確かめてくれ。迷宮は、道を喰うことがある。」" },
  { name: "弔いの一歩", text: "「夫が倒れたのは{dun}の地下{f}階。同じ深さに立って、一言『見つけた』と…それだけでいいのです。」" },
  { name: "深度の証明", text: "「{dun}の地下{f}階まで潜って戻った者にだけ話せることがある。まず、潜ってみせろ。」" },
  { name: "視えた場所へ", text: "「視えました…{dun}の地下{f}階、冷たい石の間。あなたがそこに立つ姿が。」" },
];
const DELIVER_TEXTS = [
  { name: "{item}を求む", text: "「{item}を一つ、譲ってほしい。礼は魂で払う。死者の魂だが、質は保証する。」" },
  { name: "形見の買い戻し", text: "「{item}…あいつが持っていたのと同じ品だ。手元に置いておきたい。」" },
  { name: "鍛冶の見本", text: "「{item}を見せてくれ。打ち直すにも、まず手本が要る。」" },
  { name: "祭具の欠け", text: "「祭壇に供える{item}が欠けている。代わりを一つ、頼めるか。」" },
  { name: "転売の種", text: "「{item}が要る。どこへ流すかは…聞かぬが花だ。」" },
];

// ---- 納品の報酬: 納めた品のレア度 (c/uc/r/sr/lr) で、授かる魂の格と数を抽選する ----
// レア度 : [ [魂のレア度, 体数, 確率], … ] (確率は合計1.0)
export const DELIVERY_REWARDS = {
  c:  [["common", 2, 0.70], ["rare", 1, 0.20], ["epic", 1, 0.09], ["legend", 1, 0.01]],
  uc: [["common", 3, 0.60], ["rare", 2, 0.25], ["epic", 1, 0.13], ["legend", 1, 0.02]],
  r:  [["common", 4, 0.45], ["rare", 2, 0.30], ["epic", 1, 0.20], ["legend", 1, 0.05]],
  sr: [["common", 5, 0.40], ["rare", 3, 0.30], ["epic", 2, 0.20], ["legend", 1, 0.10]],
  lr: [["rare", 5, 0.40], ["epic", 3, 0.40], ["legend", 1, 0.20]],
};
export const deliveryRewardRows = (rar) => DELIVERY_REWARDS[rar] || DELIVERY_REWARDS.c;

// ===== 固定クエスト (依頼人の頼み) =====
//   id      保存用の名 (変えない)       giver  依頼人 { name, title }
//   appear  酒場に現れる条件: { reported: 迷宮id } 王に踏破を報告 / { cleared: id } 踏破 / { open: id } 地図にある /
//           { found: 物語マスの鍵 } (複数書けばすべて)
//   goal    { type:"kill", keys:[魔物id], n } 討伐 / { type:"floor", dungeon, n } その迷宮の地下n階へ /
//           { type:"clear", dungeon } 踏破 (最下階・主) / { type:"soul", n } / { type:"chest", n }
//   desc    目的の一行   lines = 依頼の語り (受ける前)   done = 報告の語り
//   ref     報酬の物差しにする迷宮 (戦果 = その迷宮の深部の普通の戦闘1回分)
//   reward  { gold: 戦果の倍数, soul: 戦果の倍数, red, embers, souls: [[魂のレア度, 体数]] }
//   opens   受けた時に地図に現れる迷宮 (world.js の unlock: { quest: この id })
export const FIXED_QUESTS = [
  {
    id: "fq_hans", name: "墓の下の騒ぎ", giver: { name: "墓守のハンス", title: "老墓守" },
    appear: { reported: "w01" },
    goal: { type: "kill", keys: ["bs_grasphand"], n: 6 }, desc: "這い寄る腐手を 6体 倒す",
    ref: "w01", reward: { gold: 10, soul: 10, souls: [["common", 2]] },
    lines: [
      "酒場の隅で、土に汚れた老人が杯を抱えていた。",
      "「…あんたが、オルドさんの弟子かね。わしは墓守のハンス。四十年、ロアダルの墓を守ってきた。」",
      "「近ごろ、墓の下から手が這い出してくる。土を掻く音で、夜も眠れん。」",
      "「這い寄る腐手を六つ、土に還してくれんか。オルドさんも、昔そうしてくれた。」",
    ],
    done: [
      "「…音が止んだ。ゆうべは、久しぶりに朝まで眠れたよ。」",
      "「オルドさんはな、墓の下へ降りる前に、わしに言ったんだ。『この下に、まだ帰っていない者がいる』と。」",
      "「あの人の言う『帰っていない者』が誰のことか…わしには、とうとう聞けなんだ。」",
    ],
  },
  {
    id: "fq_dorn", name: "鍛冶師の見立て", giver: { name: "片腕のドルン", title: "鍛冶師" },
    appear: { reported: "w02" },
    goal: { type: "chest", n: 8 }, desc: "迷宮の宝箱を 8つ 開ける",
    ref: "w02", reward: { gold: 16, soul: 6, souls: [["common", 2], ["rare", 1]] },
    lines: [
      "片腕の大男が、卓に古びた錠前を並べていた。",
      "「俺はドルン。腕は一本で足りるが、迷宮には届かん。」",
      "「迷宮の宝箱には、昔の鍛冶の仕事が眠っている。罠も、錠も、細工も…死んだ職人たちの腕だ。」",
      "「宝箱を八つ開けてこい。中身はくれてやる。開けた手応えだけ、聞かせてくれ。」",
    ],
    done: [
      "「…八つか。どれも、今の鍛冶には真似できん細工だったろう。」",
      "「死んだ職人の腕は、迷宮の中で生き続けている。…魂と同じだな。」",
      "「礼だ。俺の打った品じゃ釣り合わん。だから、これをやる。」",
    ],
  },
  {
    id: "fq_seres", name: "夫の最期の場所", giver: { name: "黒衣のセレス", title: "喪服の婦人" },
    appear: { reported: "w02" },
    goal: { type: "floor", dungeon: "w03", n: 8 }, desc: "「朽ちた骸の修道院」の地下8階へ降りる",
    ref: "w03", reward: { gold: 12, soul: 12, embers: 1, souls: [["rare", 1]] },
    lines: [
      "喪服の婦人が、色褪せた手紙を握りしめていた。",
      "「…夫は、修道院の地下へ降りたきり戻りませんでした。最後の手紙には『八つ目の階段の先』とだけ。」",
      "「亡骸を探してほしいのではありません。あの人が最後に見た場所に、誰かが立ってくれたら…それで。」",
      "「どうか、朽ちた骸の修道院の地下八階まで。」",
    ],
    done: [
      "「…そうですか。冷たくて、静かな場所でしたか。」",
      "「あの人は、寒がりでした。…でも、もう寒くはないのですね。」",
      "「ありがとう。これは、あの人が遺した蓄えです。生きている人のために使ってください。」",
    ],
  },
  {
    id: "fq_fen", name: "白骨の唱導", giver: { name: "詩人フェン", title: "落ちぶれた吟遊詩人" },
    appear: { reported: "w03" },
    goal: { type: "kill", keys: ["bs_bonechanter"], n: 3 }, desc: "白骨の唱導師を 3体 倒す",
    ref: "w03", reward: { gold: 14, soul: 14, souls: [["rare", 1]] },
    lines: [
      "痩せた詩人が、弦の切れたリュートを爪弾いていた。",
      "「修道院の底で、骨が歌っているのを聞いたかね。白骨の唱導師…あれは、私の師が書いた葬送歌を歌っている。」",
      "「盗まれた歌だ。死者に歌わせておくには惜しい。」",
      "「三体、黙らせてくれ。歌の結末は、私が書き直す。」",
    ],
    done: [
      "「…静かになったか。では、ここからは私の番だ。」",
      "「葬送歌はな、死者のためのものではない。残された者が、前へ進むための歌だ。」",
      "「君の師にも、いつか聞かせたい。…生きて戻ったなら、だがね。」",
    ],
  },
  {
    id: "fq_kai", name: "置き去りの戦友", giver: { name: "脱走兵カイ", title: "若い逃亡兵" },
    appear: { reported: "w03" },
    goal: { type: "soul", n: 3 }, desc: "迷宮の死体から魂を 3つ 拾う",
    ref: "w03", reward: { gold: 8, soul: 18, souls: [["rare", 1]] },
    lines: [
      "フードを目深に被った若者が、出口に近い席で縮こまっていた。",
      "「…俺は隊を捨てて逃げた。仲間は迷宮に置き去りだ。」",
      "「あいつらの魂が、まだ迷宮をさまよってるかもしれない。…俺には、拾いに行く勇気がない。」",
      "「三つでいい。誰の魂でもいい。迷宮から、連れ出してやってくれ。」",
    ],
    done: [
      "「…三つ。そうか、三つも。」",
      "「あんたの人業の中で、もう一度生きるんだな。…それなら、あいつらも文句は言わないだろう。」",
      "「俺も、いつか戻る。逃げた場所へ。…その時は、あんたに頼むかもしれない。」",
    ],
  },
  {
    id: "fq_oswald", name: "沈んだ鐘", giver: { name: "破戒僧オズワルド", title: "破門された司祭" },
    appear: { reported: "w04" },
    goal: { type: "clear", dungeon: "ws1" }, desc: "「沈んだ礼拝堂」を踏破する",
    ref: "ws1", reward: { gold: 30, soul: 30, red: 10, embers: 2, souls: [["epic", 1]] },
    opens: ["ws1"],
    lines: [
      "破門の焼き印を額に残した僧が、黒い水の滴る地図を卓に広げた。",
      "「取水口の黒い水は、どこから来ると思う。…その先に、礼拝堂が沈んでいる。」",
      "「わしが破門される前に仕えた礼拝堂だ。水路の主に呑まれ、鐘ごと水の底に沈んだ。」",
      "「夜ごと、水の下から鐘が鳴る。沈んだ信徒たちが、まだ祈らされているのだ。」",
      "「道は教える。水路の主を討ち、鐘を止めてくれ。…わしの手では、もう届かん。」",
    ],
    done: [
      "「…鐘が、止んだか。」",
      "「水路の主は、祈りを喰らって肥えていた。信徒の祈りを、鐘で集めてな。」",
      "「オルドもあの鐘の音を聞いていた。『祈りを吸い上げる管が、この国のどこかにある』と…わしは笑ったものだ。」",
      "「笑うべきではなかった。…受け取れ。破門僧の蓄えだが、穢れてはおらん。」",
    ],
  },
  {
    id: "fq_zakka", name: "銀の小人", giver: { name: "行商人ザッカ", title: "強欲な行商人" },
    appear: { open: "w05" },
    goal: { type: "kill", keys: ["mt_silver", "mt_gold", "mt_king"], n: 1 }, desc: "銀業 (金属の魔物) を 1体 仕留める",
    ref: "w05", reward: { gold: 12, soul: 6, embers: 2 },
    lines: [
      "金貨を指先で弾きながら、行商人が身を乗り出した。",
      "「坑口が開いたそうだな。あそこには銀の小人が出る。銀業(ぎんぎょう)だ。」",
      "「斬っても斬っても掠り傷。術も効かん。だが会心の一撃なら、一発で崩れる。」",
      "「一体仕留めてこい。崩れた銀の欠片は高く売れる…いや、こっちの話だ。」",
    ],
    done: [
      "「仕留めたか！ …欠片は? 持って帰らなかった? …まあいい。」",
      "「仕留めた腕は本物だ。腕の立つ操霊師には、投資しておくに限る。」",
    ],
  },
  {
    id: "fq_morga", name: "石になった鉱夫たち", giver: { name: "薬婆モルガ", title: "毒草の薬師" },
    appear: { reported: "w05" },
    goal: { type: "clear", dungeon: "ws2" }, desc: "「石眠りの石切り場」を踏破する",
    ref: "ws2", reward: { gold: 36, soul: 36, red: 15, embers: 3, souls: [["epic", 1], ["rare", 2]] },
    opens: ["ws2"],
    lines: [
      "薬草の匂いの染みた老婆が、灰色の石の欠片を卓に転がした。",
      "「ひっひ…これが何に見える。石かい。…これはね、人の指だよ。」",
      "「坑口の奥に、古い石切り場がある。そこで働いた鉱夫たちは、皆こうして石になった。」",
      "「石化の眼に睨まれたのさ。眠るように固まって、今も鑿を握ったまま立っている。」",
      "「底まで降りて、石切り場を鎮めておいで。石の粉は、良い薬になるんだよ。ひっひ。」",
    ],
    done: [
      "「戻ったかい。顔色は…まだ石にはなっていないね。」",
      "「あの石切り場の石はね、王都の城壁に使われたのさ。…鉱夫ごと、ね。」",
      "「この国は、死者の上に建っている。あんたの師匠も、それを知っていたよ。」",
      "「持っておいき。年寄りの道楽で貯めたものさ。」",
    ],
  },
];
export const FIXED_BY_ID = Object.fromEntries(FIXED_QUESTS.map((q) => [q.id, q]));

// ===== 掲示板 (フリークエスト) の生成 =====
// ctx = {
//   dungeons: [cfg]          地図にある迷宮 (浅い順)
//   unit(cfg, floor)         その迷宮・階の戦果 { gold, soul }
//   deliverIds: [itemId]     納品に求めてよい品
//   itemName(id)             品の名
//   rand(n)                  0..n-1 の乱数
//   avoid: Set               重ねたくない対象 (受注中の魔物・品の鍵 "k:id" / "i:id")
//   uid()                    依頼の通し番号
// }
// 返すのは掲示板の依頼 [{ uid, type, …, state:"offer" }]
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : ""));
function pickWeighted(list, w, rand) {
  const tot = list.reduce((s, x, i) => s + w(x, i), 0);
  let r = rand(1000) / 1000 * tot;
  for (let i = 0; i < list.length; i++) { if ((r -= w(list[i], i)) < 0) return list[i]; }
  return list[list.length - 1];
}
// 深い迷宮ほど選ばれやすい (いちばん深い迷宮が最多)
const pickDungeon = (ctx, list = ctx.dungeons) => pickWeighted(list, (d, i) => 1 + i * 1.5, ctx.rand);
const round = (v) => Math.max(1, Math.round(v));
// その魔物が初めて現れる階
function firstFloorOf(cfg, key) {
  for (let f = 1; f <= (cfg.floors || 1); f++) if (poolAt(cfg, f).includes(key)) return f;
  return 1;
}
// 迷宮の「深部」(後ろ半分の真ん中あたり) の戦果。魂・宝箱の依頼の物差し
const deepUnit = (ctx, cfg) => ctx.unit(cfg, Math.max(1, Math.ceil((cfg.floors || 1) * 0.6)));

function genKill(ctx) {
  for (let t = 0; t < 8; t++) {
    const cfg = pickDungeon(ctx);
    const floor = 1 + ctx.rand(cfg.floors || 1);
    const pool = poolAt(cfg, floor).filter((k) => MONSTERS[k] && !MONSTERS[k].boss && !MONSTERS[k].elite && !ctx.avoid.has("k:" + k));
    if (!pool.length) continue;
    const key = pool[ctx.rand(pool.length)];
    const m = MONSTERS[key];
    const goal = m.pack ? 6 + ctx.rand(4) : 3 + ctx.rand(4);
    const f1 = firstFloorOf(cfg, key);
    const u = ctx.unit(cfg, f1 + 1);
    const mult = (m.pack ? goal * 0.35 : goal * 0.7) + 2;
    const reward = { gold: round(u.gold * mult), soulPts: round(u.soul * mult) };
    if (ctx.rand(100) < 18) reward.souls = [["common", 1]];
    const tpl = KILL_TEXTS[ctx.rand(KILL_TEXTS.length)];
    ctx.avoid.add("k:" + key);
    return { type: "kill", keys: [key], goal, dungeon: cfg.id, floor: f1,
      name: fill(tpl.name, { mon: m.name }), text: fill(tpl.text, { mon: m.name, goal }),
      desc: `${m.name}を ${goal}体 倒す`, note: `「${cfg.short || cfg.name}」の地下${f1}階から出る`, reward };
  }
  return null;
}
function genSoul(ctx) {
  const cfg = ctx.dungeons[ctx.dungeons.length - 1];
  const goal = 1 + ctx.rand(2);
  const u = deepUnit(ctx, cfg);
  const reward = { soulPts: round(u.soul * (goal * 2 + 1)), souls: [[ctx.rand(100) < 25 ? "rare" : "common", 1]] };
  const tpl = SOUL_TEXTS[ctx.rand(SOUL_TEXTS.length)];
  return { type: "soul", goal, name: tpl.name, text: fill(tpl.text, { goal }), desc: `迷宮の死体から魂を ${goal}つ 拾う`, note: "どの迷宮でもよい", reward };
}
function genChest(ctx) {
  const cfg = ctx.dungeons[ctx.dungeons.length - 1];
  const goal = 2 + ctx.rand(3);
  const u = deepUnit(ctx, cfg);
  const reward = { gold: round(u.gold * (goal * 1.3 + 1.5)), soulPts: round(u.soul * 1.5) };
  const tpl = CHEST_TEXTS[ctx.rand(CHEST_TEXTS.length)];
  return { type: "chest", goal, name: tpl.name, text: fill(tpl.text, { goal }), desc: `迷宮の宝箱を ${goal}つ 開ける`, note: "どの迷宮でもよい", reward };
}
function genReach(ctx) {
  const deep = ctx.dungeons.filter((d) => (d.floors || 1) >= 5 && !ctx.avoid.has("f:" + d.id));
  if (!deep.length) return null;
  const cfg = pickDungeon(ctx, deep);
  const lo = Math.max(3, Math.ceil(cfg.floors * 0.4)), hi = cfg.floors - 1;
  const f = lo + ctx.rand(Math.max(1, hi - lo + 1));
  const u = ctx.unit(cfg, f);
  const reward = { gold: round(u.gold * (f * 0.3 + 1)), soulPts: round(u.soul * (f * 0.5 + 2)) };
  if (ctx.rand(100) < 25) reward.souls = [["common", 1]];
  const tpl = REACH_TEXTS[ctx.rand(REACH_TEXTS.length)];
  ctx.avoid.add("f:" + cfg.id);
  return { type: "floor", goal: f, dungeon: cfg.id, name: tpl.name, text: fill(tpl.text, { dun: cfg.name, f }),
    desc: `「${cfg.short || cfg.name}」の地下${f}階へ降りる`, note: "帰還魔法陣から潜り始めても数える", reward };
}
function genDeliver(ctx) {
  const ids = ctx.deliverIds.filter((id) => !ctx.avoid.has("i:" + id));
  if (!ids.length) return null;
  const itemId = ids[ctx.rand(ids.length)];
  const nm = ctx.itemName(itemId);
  const tpl = DELIVER_TEXTS[ctx.rand(DELIVER_TEXTS.length)];
  ctx.avoid.add("i:" + itemId);
  return { type: "deliver", itemId, goal: 1, name: fill(tpl.name, { item: nm }), text: fill(tpl.text, { item: nm }),
    desc: `「${nm}」を納める`, note: "手持ちか、商会の棚の品で納められる", reward: { deliver: true } };
}

// 掲示板を貼り直す: 1件目は納品、残りは討伐多めに
export function rollBoard(ctx, size = BOARD_SIZE) {
  if (!ctx.dungeons.length) return [];
  const out = [];
  const push = (q) => { if (q) out.push({ ...q, uid: ctx.uid(), npc: ctx.rand(NPCS.length), progress: 0, state: "offer" }); };
  push(genDeliver(ctx));
  const gens = [genKill, genKill, genKill, genSoul, genChest, genReach, genReach];
  for (let t = 0; out.length < size && t < 20; t++) {
    const g = gens[ctx.rand(gens.length)];
    if ((g === genSoul || g === genChest) && out.some((q) => q.type === (g === genSoul ? "soul" : "chest"))) continue;
    push(g(ctx));
  }
  return out;
}
