// サブクエスト: 各迷宮の依頼人から受けられる依頼 (酒場で迷宮ごとに表示)。
// 迷宮番号×階から決定的に生成する (約800件)。依頼人・目的・口上はテンプレートの
// 組み合わせで、受注した分だけが G.subQuests に状態つきで保存される。
// 進捗は迷宮・階を問わず、条件 (討伐/魂/宝箱/到達/主) を満たせば加算される。
// このため依頼文には特定の階 (B○F) を書かない。
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
// {mon}=モンスター名 {goal}=数。場所 (迷宮名・階) は書かない (どこでも達成できる依頼)。
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
  { name: "灯りを届けて", text: "「地下{goal}階まで、この祈りを届けてほしい。着けばわかる。闇が少し、薄くなる。」" },
  { name: "道標の確認", text: "「地下{goal}階へ降りる道が生きているか確かめてくれ。迷宮は、道を喰うことがある。」" },
  { name: "弔いの一歩", text: "「夫が倒れたのは地下{goal}階。同じ深さに立って、一言『見つけた』と…それだけでいいのです。」" },
  { name: "深度の証明", text: "「地下{goal}階まで潜って戻った者にだけ話せることがある。まず、潜ってみせろ。」" },
  { name: "視えた場所へ", text: "「視えました…地下{goal}階、冷たい石の間。あなたがそこに立つ姿が。行けば、報酬の意味もわかる。」" },
];
const BOSS_TEXTS = [
  { name: "主の終焉", text: "「迷宮の最深部に座す主…あれが生きている限り、誰も帰ってこない。どこかの主を一体、終わらせてくれ。」" },
  { name: "玉座を空に", text: "「迷宮の主にも玉座があるという。空にしてこい。代金は弾む。」" },
  { name: "深淵の蓋", text: "「主は蓋だ。開けば、もっと悪いものが出る。…だが閉じたままでも、人が死ぬ。討て。」" },
  { name: "名も無き王の葬送", text: "「誰も名を知らぬ王が、迷宮の底で朽ちずにいる。葬送の鐘の代わりに、剣を。」" },
  { name: "最後の一節", text: "「この詩は主が死なねば完成しない。頼む、結末を書かせてくれ。」" },
];

// 討伐対象を決定的に選ぶ。その迷宮に実際に出現する帯
// (浅階=pool / 深階=deepPool。board.js と同じ判定) から選ぶ
function pickMonster(dn, h, floor) {
  const deep = floor > dn.floors / 2;
  const band = ((deep ? dn.deepPool : dn.pool) || dn.pool || []).filter((k) => MONSTERS[k] && !MONSTERS[k].boss);
  if (!band.length) return null;
  return band[h % band.length];
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
  // クエスト種別: 討伐多め / 魂 / 宝箱 / 到達 (到達は深さ2以降のみ)
  const kinds = floor >= 2 ? ["kill", "kill", "kill", "soul", "chest", "reach"] : ["kill", "kill", "soul", "chest"];
  const kind = kinds[hash(seed, 29) % kinds.length];
  if (kind === "kill") {
    const key = pickMonster(dn, hash(seed, 31), floor);
    if (!key) return { ...base, type: "floor", goal: floor, ...fill(REACH_TEXTS[0], null, floor) };
    const goal = 2 + (hash(seed, 37) % 3);
    const t = fill(KILL_TEXTS[hash(seed, 41) % KILL_TEXTS.length], MONSTERS[key].name, goal);
    return { ...base, type: "kill", key, goal, ...t };
  }
  if (kind === "soul") {
    const goal = 1 + (hash(seed, 43) % 2);
    const t = fill(SOUL_TEXTS[hash(seed, 47) % SOUL_TEXTS.length], null, goal);
    return { ...base, type: "soul", goal, ...t };
  }
  if (kind === "chest") {
    const goal = 1 + (hash(seed, 53) % 2);
    const t = fill(CHEST_TEXTS[hash(seed, 59) % CHEST_TEXTS.length], null, goal);
    return { ...base, type: "chest", goal, ...t };
  }
  // reach: 一定の深さまで潜る (どの迷宮でもよい)
  const t = fill(REACH_TEXTS[hash(seed, 61) % REACH_TEXTS.length], null, floor);
  return { ...base, type: "floor", goal: floor, ...t };
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
