// サブクエスト: 各迷宮の各階に1件ずつ、酒場のNPC依頼人から受けられる依頼。
// 迷宮番号×階から決定的に生成する (約800件)。依頼人・目的・口上はテンプレートの
// 組み合わせで、受注した分だけが G.subQuests に状態つきで保存される。
// 進捗は「その迷宮・その階」でのみ加算される (場所が意味を持つ依頼)。
import { DUNGEONS } from "./dungeons/index.js";
import { MONSTERS } from "./sprites.js";

// 決定的ハッシュ (generator.js と同系)
function hash(n, salt) {
  let h = (n * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

// ===== 酒場の依頼人たち =====
// それぞれが事情を抱えて迷宮に縁がある。口上 (line) はクエスト文の前に付く
export const NPCS = [
  { name: "隻眼のガルム", title: "老傭兵", line: "「右目はあの迷宮に置いてきた。代わりに頼みを置いていく。」" },
  { name: "黒衣のセレス", title: "喪服の婦人", line: "「夫は帰りませんでした。せめて、これだけは…。」" },
  { name: "沈黙のヨル", title: "盗掘屋", line: "「…依頼の話だ。声がデカい奴は信用しない。」" },
  { name: "破戒僧オズワルド", title: "破門された司祭", line: "「神は沈黙している。ならば人の手でやるしかない。」" },
  { name: "リリベル", title: "酒場の情報屋", line: "「タダの噂じゃないよ。金になる話さ。」" },
  { name: "片腕のドルン", title: "鍛冶師", line: "「腕は一本で足りる。だが届かぬ場所がある。」" },
  { name: "盲目のヴェスナ", title: "占い師", line: "「視えるのです。あなたが頷く未来が。」" },
  { name: "墓守のハンス", title: "老墓守", line: "「墓の下が騒がしくてな。眠れんのだよ。」" },
  { name: "脱走兵カイ", title: "若い逃亡兵", line: "「戻れと言われても戻れない。だから、代わりに…。」" },
  { name: "薬婆モルガ", title: "毒草の薬師", line: "「ひっひ…良い素材は、深い闇でしか育たぬ。」" },
  { name: "詩人フェン", title: "落ちぶれた吟遊詩人", line: "「悲劇には続きが要る。お前がその一節になれ。」" },
  { name: "行商人ザッカ", title: "強欲な行商人", line: "「危険? それは値段に含まれている。」" },
];

// ===== クエスト文テンプレート =====
// {dun}=迷宮名 {f}=階 {mon}=モンスター名 {goal}=数
const KILL_TEXTS = [
  { name: "{mon}の首", text: "「{dun}のB{f}Fに巣食う{mon}…あれが仲間の命を喰った。{goal}体、骸に変えてくれ。」" },
  { name: "喰われた者の弔い", text: "「B{f}Fで{mon}に喰われた連中の骨が、まだ転がっている。せめて仇を。{goal}体でいい。」" },
  { name: "夜毎の悪夢", text: "「眠るたびに{mon}の声がする。{dun}のB{f}Fだ。{goal}体斬れば、声は止むはずだ。」" },
  { name: "間引きの依頼", text: "「{dun}B{f}Fの{mon}が増えすぎた。巣ごと焼く前に、{goal}体ほど間引いてほしい。」" },
  { name: "標本の採取", text: "「{mon}の死骸が{goal}体分要る。研究のためだ。…用途は聞くな。B{f}Fにいる。」" },
  { name: "賞金首", text: "「{dun}のB{f}Fの{mon}に賞金が出た。{goal}体。生かしておく理由が、もう無い。」" },
  { name: "供物の調達", text: "「祭壇が{mon}の血を求めている。B{f}Fで{goal}体。神の名は…言えない。」" },
  { name: "復讐の代行", text: "「私の手はもう剣を握れない。{dun}B{f}Fの{mon}を{goal}体、私の代わりに。」" },
];
const SOUL_TEXTS = [
  { name: "還れぬ魂", text: "「{dun}のB{f}Fには、置き去りにされた魂が泣いている。{goal}つ、拾い上げてやってくれ。」" },
  { name: "魂の借金", text: "「死んだ相棒に借りがある。B{f}Fで魂を{goal}つ回収してくれたら、少しは返せた気になれる。」" },
  { name: "亡者の名簿", text: "「教会の名簿に載らぬ死者たち…B{f}Fで魂を{goal}つ。彼らにも名があったのだ。」" },
  { name: "器のための魂", text: "「空の器ばかり増えていく。{dun}B{f}Fで魂を{goal}つ。死者には悪いが、こちらも商売だ。」" },
  { name: "冷たくなる前に", text: "「B{f}Fの死体はまだあたたかいうちに限る。魂を{goal}つ、冷める前に頼む。」" },
];
const CHEST_TEXTS = [
  { name: "置き去りの荷", text: "「{dun}のB{f}Fに荷を置いて逃げた。宝箱を{goal}つ漁ってくれ。中身はやる。記録だけ欲しい。」" },
  { name: "遺品の回収", text: "「死んだ隊の荷が、B{f}Fの宝箱に残っているはずだ。{goal}つ開けて、確かめてほしい。」" },
  { name: "中身より鍵", text: "「宝箱の中身はくれてやる。B{f}Fで{goal}つ、開けた感触だけ教えろ。…探している鍵がある。」" },
  { name: "罠師の検分", text: "「あの迷宮の罠は俺の師匠の仕事だ。B{f}Fの宝箱を{goal}つ開けて、腕前を確かめてくれ。」" },
  { name: "投機の検算", text: "「{dun}B{f}Fの宝の質を知りたい。{goal}箱ぶん開けてこい。儲け話の種になる。」" },
];
const REACH_TEXTS = [
  { name: "灯りを届けて", text: "「{dun}のB{f}Fまで、この祈りを届けてほしい。着けばわかる。闇が少し、薄くなる。」" },
  { name: "道標の確認", text: "「B{f}Fへ降りる道が生きているか確かめてくれ。あの迷宮は、道を喰うことがある。」" },
  { name: "弔いの一歩", text: "「夫が倒れたのは{dun}のB{f}F。同じ場所に立って、一言『見つけた』と…それだけでいいのです。」" },
  { name: "深度の証明", text: "「B{f}Fまで潜って戻った者にだけ話せることがある。まず、潜ってみせろ。」" },
  { name: "視えた場所へ", text: "「視えました…{dun}のB{f}F、冷たい石の間。あなたがそこに立つ姿が。行けば、報酬の意味もわかる。」" },
];
const BOSS_TEXTS = [
  { name: "主の終焉", text: "「{dun}の最深部に座す主…あれが生きている限り、誰も帰ってこない。終わらせてくれ。」" },
  { name: "玉座を空に", text: "「迷宮の主にも玉座があるという。空にしてこい。代金は弾む。」" },
  { name: "深淵の蓋", text: "「あの主は蓋だ。開けば、もっと悪いものが出る。…だが閉じたままでも、人が死ぬ。討て。」" },
  { name: "名も無き王の葬送", text: "「誰も名を知らぬ王が、{dun}の底で朽ちずにいる。葬送の鐘の代わりに、剣を。」" },
  { name: "最後の一節", text: "「この詩は主が死なねば完成しない。頼む、結末を書かせてくれ。」" },
];

// 迷宮の浅階プールから討伐対象を決定的に選ぶ
function pickMonster(dn, h) {
  const pool = [...(dn.pool || []), ...(dn.deepPool || [])].filter((k) => MONSTERS[k] && !MONSTERS[k].boss);
  if (!pool.length) return null;
  return pool[h % pool.length];
}

// dunIdx (0始まり) と floor (1始まり) からサブクエストを決定的に生成する。
// 返すのは「状態を持たない定義」。受注時に state/progress を足して保存する
export function genSubQuest(dunIdx, floor) {
  const dn = DUNGEONS[dunIdx];
  if (!dn || floor < 1 || floor > dn.floors) return null;
  const n = dunIdx + 1;
  const seed = n * 131 + floor * 7;
  const npc = NPCS[hash(seed, 17) % NPCS.length];
  const isLast = floor === dn.floors;

  // 報酬: 迷宮の深さと階で伸びる。深階と主討伐は赤い魂も
  const gold = Math.round((30 + n * 16 + floor * 14) * (isLast ? 2.2 : 1));
  const soulPts = Math.round(12 + n * 5 + floor * 4);
  const reward = { gold, soulPts };
  if (isLast || floor >= 8) reward.redSoul = isLast ? 3 : 1;

  const fill = (tpl, mon, goal) => ({
    name: tpl.name.replace("{mon}", mon || ""),
    text: tpl.text.replaceAll("{dun}", dn.name).replaceAll("{f}", String(floor))
      .replaceAll("{mon}", mon || "").replaceAll("{goal}", String(goal || "")),
  });
  const base = { id: `sq_${n}_${floor}`, dunIdx, floor, npc, reward, sub: true };

  if (isLast) {
    const t = fill(BOSS_TEXTS[hash(seed, 23) % BOSS_TEXTS.length]);
    return { ...base, type: "boss", goal: 1, ...t };
  }
  // 階のクエスト種別: 討伐多め / 魂 / 宝箱 / 到達 (到達はB2F以降のみ)
  const kinds = floor >= 2 ? ["kill", "kill", "kill", "soul", "chest", "reach"] : ["kill", "kill", "soul", "chest"];
  const kind = kinds[hash(seed, 29) % kinds.length];
  if (kind === "kill") {
    const key = pickMonster(dn, hash(seed, 31));
    if (!key) return { ...base, type: "floor", goal: floor, floorReq: null, ...fill(REACH_TEXTS[0]) };
    const goal = 2 + (hash(seed, 37) % 3);
    const t = fill(KILL_TEXTS[hash(seed, 41) % KILL_TEXTS.length], MONSTERS[key].name, goal);
    return { ...base, type: "kill", key, goal, floorReq: floor, ...t };
  }
  if (kind === "soul") {
    const goal = 1 + (hash(seed, 43) % 2);
    const t = fill(SOUL_TEXTS[hash(seed, 47) % SOUL_TEXTS.length], null, goal);
    return { ...base, type: "soul", goal, floorReq: floor, ...t };
  }
  if (kind === "chest") {
    const goal = 1 + (hash(seed, 53) % 2);
    const t = fill(CHEST_TEXTS[hash(seed, 59) % CHEST_TEXTS.length], null, goal);
    return { ...base, type: "chest", goal, floorReq: floor, ...t };
  }
  // reach: その階に到達する
  const t = fill(REACH_TEXTS[hash(seed, 61) % REACH_TEXTS.length]);
  return { ...base, type: "floor", goal: floor, floorReq: null, ...t };
}

// 迷宮1つ分のサブクエスト定義 (全階) を返す
export function dungeonSubQuests(dunIdx) {
  const dn = DUNGEONS[dunIdx];
  if (!dn) return [];
  const out = [];
  for (let f = 1; f <= dn.floors; f++) {
    const q = genSubQuest(dunIdx, f);
    if (q) out.push(q);
  }
  return out;
}
