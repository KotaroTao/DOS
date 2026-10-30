import { playtestEvent } from "../playtest.js";
// ===== 手ほどき — 層の踏破で解放された要素を、その場で1度ずつ実際に触って覚える =====
// 王への踏破報告で新しい要素 (魂融合 / サブ魂 / 情報屋の噂 / 控えの結社 ― 開く時期は game.js FEATURES) が解放されると、
// 語りを閉じた直後に、その要素の手ほどきが始まる。手ほどきを終えるまで迷宮の門は開かない
// (game.js blockForTutorial ← 出撃シート・departNow・奈落)。
//   流れ: 導入 (館の主イレーヌ / 酒場の情報屋の語り) → 手順 (実際に操作する。イレーヌの台詞で今の手順を案内し、
//         押す所が光る) → 完了の会話。手順の完了は状態 (done) か、UI から届く合図 (on = tutorialEvent) で判定する。
//   練習用の素材は導入で預ける (詰まないように): 魂融合は戦士の魂を必ず2つ (2つどうしでも融合できる)、
//   サブ魂は宿す魂が無ければ1つ。
//   どうしても行えない手順 (素材を使い切った等) は skip で飛ばし、手ほどき自体は必ず終えられる。
// 状態: G.tut = { done: {key:true}, cur, step, ev: {合図}, base: {始めた時の数} } (セーブされる)。
//   旧セーブ: 解放済みで未完の手ほどきは、その要素をもう使っていれば済み扱い、まだなら目標の札から始められる。
// 提供: UI.tutorialPending() / UI.tutorialResume() / UI.tutorialAfterReport() / UI.tutorialEvent(name) / UI.tutorialFree(key)
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, setText, button, sheet, toast, celebrate, sheetDepth } from "./kit.js";
import { unphrase } from "./phrase.js";
import { playIreneScene, sceneActive, isGreeted, greetingPages } from "./irene.js";
import { playStoryChain } from "./story.js";
import { keeperCanvas, vignetteCanvas } from "../townart.js";
import { SOUL_CLASSES, soulByUid } from "../souls.js";

const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";
const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
const jobLabel = (k) => (SOUL_CLASSES[k] || {}).label || k;

export function tutState() {
  const G = G_();
  if (!G) return null;
  if (!G.tut || typeof G.tut !== "object") G.tut = {};
  const t = G.tut;
  if (!t.done || typeof t.done !== "object") t.done = {};
  if (!t.ev || typeof t.ev !== "object") t.ev = {};
  if (!t.base || typeof t.base !== "object") t.base = {};
  if (typeof t.step !== "number") t.step = 0;
  if (t.cur === undefined) t.cur = null;
  // 旧セーブで途中だった新職業の案内も、魂の付け替えへ引き継ぐ。
  if (["changeJob", "newJobParty"].includes(t.cur)) {
    t.cur = t.done.soulChange ? null : "soulChange";
    t.step = 0; t.ev = {}; t.base = {};
  }
  return t;
}

// ---- 素材の判定 ----
function wornSet() {
  const s = new Set();
  for (const d of allDolls()) {
    if (d.primary != null) s.add(d.primary);
    for (const x of (d.subs || [])) if (x) s.add(x.uid);
  }
  return s;
}
// 手ほどきでは、練習用に渡した戦士の魂を融合する。隊 → 控えの順
function fusableDoll() {
  if (!game.fuseCandidates) return null;
  return allDolls().find((d) => soulByUid(d.primary)?.clsKey === "fighter" && game.fuseCandidates(d.primary).length > 0) || null;
}
function spareSouls() {
  const worn = wornSet();
  return (G_().souls || []).filter((s) => !worn.has(s.uid) && (G_().party || []).some((d) => !game.soulSlotConflict || !game.soulSlotConflict(d, s.uid, "sub0")));
}
// 融合できる戦士の魂がある (宿していない魂どうしでもよい)
function anyFusable() {
  if (!game.fuseCandidates) return false;
  return (G_().souls || []).some((s) => s.clsKey === "fighter" && game.fuseCandidates(s.uid).length > 0);
}
function dollWithSub() {
  return (G_().party || []).find((d) => (d.subs || []).some((s) => s && soulByUid(s.uid))) || null;
}
function grantSoul(clsKey) {
  if (!game.addSoulInstance) return null;
  const s = game.addSoulInstance(clsKey);
  if (game.codexSweepJobs) safe(() => game.codexSweepJobs(), null);
  return s;
}

// ---- 行き先 ----
function goSoulSeg(d) {
  const G = G_();
  const doll = d || (G.party || [])[0] || allDolls()[0] || null;
  if (UI.openParty) UI.openParty(doll, { context: "town", seg: "soul" });
}
function goTavern() {
  if (UI.openTavern) return UI.openTavern("board"); // 噂話は掲示板の区分のいちばん上
  if (UI.shell && UI.shell.openPage) UI.shell.openPage("tavern", { parentTab: "hub" });
}

function initialJobsReady(jobs) {
  const worn = new Set(allDolls().map((d) => soulByUid(d.primary)?.clsKey));
  return jobs.every((k) => worn.has(k));
}

function formationMove() {
  const party = G_().party, job = d => soulByUid(d.primary)?.clsKey;
  const rear = party.slice(3);
  const mover = rear.find(d => job(d) === "knight") || rear.find(d => ["fighter", "thief"].includes(job(d)));
  const target = party.slice(0, 3).find(d => ["priest", "mage"].includes(job(d)));
  return { mover, target, targetJob: target && job(target) };
}
function formationReady() {
  const jobs = G_().party.map(d => soulByUid(d.primary)?.clsKey);
  return ["fighter", "knight", "thief"].every(k => jobs.slice(0, 3).includes(k)) &&
    ["mage", "priest"].every(k => jobs.slice(3).includes(k));
}

function newJobSouls() {
  const initial = new Set(["fighter", "priest", "thief", "knight", "mage", "bishop"]);
  return (game.soulRepresentatives ? game.soulRepresentatives() : G_().souls || []).filter((s) => !initial.has(s.clsKey));
}
const anyBroken = () => allDolls().some((d) => d.isDoll && !d.alive);
function atMansion() { return atFacility("party"); }
const FACILITIES = {
  settings: { name: "設定", target: '.hb-gear, .ui-header .ui-hbtn, #settingsBtn', hint: "歯車の『設定』を選ぶと、図鑑の手ほどきが始まります" },
  party: { name: "人業の館", target: '.ui-tab[data-key="party"]', hint: "画面下の『人業の館』を選ぶと、イレーヌがご案内します" },
  shop: { name: "商会", target: '.ui-tab[data-key="shop"]', hint: "画面下の『商会』を選ぶと、手ほどきが始まります" },
  tavern: { name: "酒場", target: '.hb-tile-tavern', hint: "街の『酒場』を選ぶと、手ほどきが始まります" },
  gate: { name: "迷宮", target: '.ui-tab[data-key="gate"]', hint: "画面下の『迷宮』を選ぶと、出撃の手ほどきが始まります" },
};
const facilityOf = d => d.facility || (d.who === "irene" ? "party" : d.who);
function atFacility(key) {
  if (!inTown()) return false;
  if (key === "settings") return !!G_().settingsOpen || tutState()?.cur === "insight";
  const town = G_().town;
  if (key === "tavern") return town?.page === "tavern";
  // 門はタブではなく出撃シート。入口を押した時に gateVisited で開始する。
  if (key === "gate") return tutState()?.cur === "firstDive";
  return town?.tab === key && !town.page && !town.facility;
}
const facilityVisitTimers = new Map();
function facilityVisited(key) {
  if (!atFacility(key) || facilityVisitTimers.has(key)) return;
  facilityVisitTimers.set(key, setTimeout(() => {
    facilityVisitTimers.delete(key);
    if (!atFacility(key) || busy || sceneActive() || sheetDepth() > 0 || game.isTitleActive?.() || game.isOpeningActive?.()) return;
    const p = pending();
    if (p?.facility === key && (!p.started || !tutorialControls()?.target)) resume();
  }, 300));
}
function mansionVisited() {
  const st = tutState();
  if (!st || !atMansion() || !isGreeted()) return;
  if (!st.done.soulChange && newJobSouls().length && G_().msq?.n >= 1) st.jobVisit = true;
  facilityVisited("party");
}
function gateVisited() {
  const p = pending();
  if (!p || p.facility !== "gate" || p.started || busy || sceneActive()) return false;
  return start(TUT_MAP[p.key]);
}

// ---- 手ほどきの定義 (解放の順) ----
//   at = 解放の踏破報告数 / open() = 解放済みか / used() = もう使ったことがある (旧セーブは済み扱い)
//   prepare() = 始める時 (練習用の素材を預ける。導入に添える一言を返す)
//   intro(note) = 導入 / steps = [{ text, hint, go(), target[], done?(), on?, skip?() }] / outro = 完了時の台詞
const TUTS = [
  {
    key: "insight", name: "図鑑と操霊師の見識", who: "irene", facility: "settings",
    open: () => !!game.featureUnlocked?.("insight"), used: () => false,
    prepare() { game.prepareCodexTutorial?.(); },
    intro: () => [["これまで倒した魔物は、図鑑に記録されています。設定の『図鑑』を押して、一体の情報を見てみましょう。"],
      ["討伐を重ねると能力や生態も分かります。図鑑の充実ぶりを表すのが『操霊師の見識』です。"]],
    steps: [
      { text: "設定の『図鑑』を選ぶ", hint: "設定 → 図鑑", go: () => UI.openSettings?.(), target: [".stg-codex"], on: "codexOpened" },
      { text: "倒した魔物の札を選び、情報を読む", hint: "光っている魔物の札 → 情報を読む → 閉じる", target: [".pl-card[data-tutorial-mon]"], on: "codexMonViewed" },
    ],
    outro: ["倒した魔物の記録は、図鑑が開く前から残っています。", "図鑑は設定からいつでも読めます。まだ伏せられた項目も、討伐を重ねると明らかになります。"],
  },
  {
    key: "repairSoul", name: "砕けた魂の修復", who: "irene",
    open: () => !!tutState().repairPending,
    used: () => false,
    intro: () => [
      ...(anyBroken()
        ? [["……お帰りなさい。魂の灯が、途切れてしまったのですね。", "けれど、あの子たちとの別れを決めるには、まだ早いのです。"]]
        : [["……お帰りなさい。迷宮で、魂の灯が途切れかけたのですね。", "皆さまがこうして立っていてくださって、ほっとしました。次のために、お話ししておきます。"]]),
      ["人業が砕けると、宿っていた魂も砕け、深い眠りに落ちます。", "街へ戻るだけでも、宿で休むだけでも、その灯は戻りません。"],
      ["この館なら、わたしが砕けた魂をつなぎ直せます。", anyBroken()
        ? "その子を選び、『魂を修復』を押してください。修復の費用は、その子の状態と一緒にお確かめください。魂も人業も、力を取り戻して立ち上がります。"
        : "砕けた子がいたら、館でその子を選び、『魂を修復』を押してください。修復の費用は、その子の状態と一緒にお確かめください。魂も人業も、力を取り戻して立ち上がります。"],
      ["皆が倒れた時は、人業が迷宮に残されます。ほかの冒険者が連れ帰るまで、お待ちください。", "深い階ほど時がかかります。『連れ帰る』で必要な赤い魂の数を確かめられます。費用がかからない場合は、そのまま連れ帰れます。修復は人業が届いてからです。"],
      anyBroken()
        ? ["金貨が必要な時も、足りなければ、お待ちします。", "あの子たちの名を、忘れずにいてください。もう一度呼びかける日まで、わたしがお預かりします。"]
        : ["金貨が必要な時も、足りなければ、お待ちします。", "砕けた子は、もう一度呼びかける日まで、わたしがお預かりします。"],
    ],
    afterIntro() {
      const d = allDolls().find((d) => d.isDoll && !d.alive);
      if (d && UI.openParty) UI.openParty(d, { context: "town" });
    },
    // 連れ帰り待ち・金貨不足でも、説明を聞けば手ほどきを終えられる。
    steps: [{ text: "砕けた人業の状態を確認する", hint: "人業が届いたら、費用を確かめて『魂を修復』", done: () => true }],
    outro: ["砕けた魂は、この館でわたしが修復いたします。必要な金貨は、その子を選んでお確かめください。", "全滅で迷宮に残された人業は、連れ帰りを待ちましょう。人業が届いたら、またその子の名を呼んであげてください。"],
  },
  {
    key: "createThree", name: "三体に魂を宿す", who: "irene",
    open: () => game.prologuePhase?.() === "three", used: () => false,
    intro: () => [["では、王さまから授かった魂を宿して、この子たちを目覚めさせましょう。", "戦士・僧侶・盗賊の魂を一つずつ選び、名前を与えてください。"]],
    steps: [{ text: "戦士・僧侶・盗賊の魂を宿す", hint: "人業を仕立てる → 魂 → 名前", go: () => game.goMakeDoll(), target: [".pt-empty button", ".pt-form .pt-empty-slot"], done: () => initialJobsReady(["fighter", "priest", "thief"]) }],
    outro: ["三体とも、目を開けましたね。あなたが与えた名を、これから何度も呼んであげてください。", "近くの森の古屋に、しばらく使っていない人業があるのです。三体と一緒に、連れ帰っていただけますか。", "古屋は二階建てです。二階でその子を探し、この館へお連れください。お待ちしています。"],
  },
  ...[
    { key: "createFourth", phase: "fourth", count: 4, job: "mage", body: "ほこりをかぶった人業", intro: "連れ帰ってくださって、ありがとうございます。ほこりを払えば、この子はまだ働けます。", next: "四体の隊がそろいましたね。王宮へ向かい、依頼をお受けください。" },
    { key: "createFifth", phase: "fifth", count: 5, job: "knight", body: "王宮から受け取った人業", intro: "王宮の倉庫に、この子が眠っていたのですね。この魂を宿してみてください……。", next: "五体の隊がそろいましたね。続いて、前衛と後衛の並べ方をお教えします。" },
    { key: "createSixth", phase: "sixth", count: 6, job: "bishop", body: "壊れた人業", intro: "どこかの操霊師が使っていた人業ですね。継ぎ目を直せば、まだ使えます。館に残っていた司教の魂をお渡しします。", next: "これで六体がそろいましたね。続いて、この司教の力で品を鑑定してみましょう。" },
  ].map(({ key, phase, count, job, body, intro, next }) => ({
    key, get name() { return `${count}体目に${jobLabel(game.prologueJob?.(phase) || job)}の魂を宿す`; }, who: "irene",
    open: () => game.prologuePhase?.() === phase, used: () => false,
    prepare: () => game.preparePrologueDoll?.(),
    intro: () => [[intro], [`${body}に、${jobLabel(game.prologueJob?.(phase) || job)}の魂を宿しましょう。`, "魂を選び、この子に名前を与えてください。"]],
    steps: [{ get text() { return `${jobLabel(game.prologueJob?.(phase) || job)}の魂を宿す`; }, hint: "人業を仕立てる → 魂 → 名前", go: () => game.goMakeDoll(), target: [".pt-form .pt-empty-slot", ".pt-res-add"], done: () => allDolls().length >= count && initialJobsReady([game.prologueJob?.(phase) || job]) }],
    outro: [next],
  })),
  {
    key: "prologueFormation", name: "前衛と後衛の並べ方", who: "irene",
    open: () => game.prologuePhase?.() === "formation", used: () => false,
    intro: () => [
      ["五体がそろいましたね。次は、隊の並びを整えましょう。", "隊列の先頭三体が前衛、続く三体までが後衛です。"],
      ["前衛には、剣や盾で戦う子を。後衛は敵に狙われにくく、受ける物理の傷が半分になります。", "後衛から与える物理の傷も通常は半分ですが、槍や弓は威力が落ちません。術の威力は、前でも後ろでも変わりません。"],
      ["今回は騎士を前衛に、僧侶と魔導士を後衛に置きましょう。", "動かしたい子を選び、『編成』を押してください。次に隊列の中から相手を選ぶと、二体の場所が入れ替わります。光っている札で試しましょう。"],
    ],
    steps: [
      { text: "前衛へ移す人業の『編成』を開く", hint: "光っている隊列", go: () => UI.openParty?.(formationMove().mover, { context: "town" }), target: [".pt-mansion-manage"], on: "formationPickerOpened", done: formationReady },
      { text: "術を使う人業を後衛に置く", hint: "光っている入れ替え相手", go: () => UI.openFormationSheet?.(formationMove().mover), target: ['.pt-sw-card[data-swap-job="priest"]'], done: formationReady },
    ],
    outro: ["隊列が整いましたね。前衛は戦士・騎士・盗賊、後衛は魔導士・僧侶です。", "館の『編成』で二体を選べば、いつでも並べ直せます。隊列の顔を長押しして、替えたい相手へ動かしてもよいのですよ。", "支度が済んだら、王宮で次の依頼をお受けください。"],
  },
  {
    key: "prologueAppraise", name: "司教の鑑定", who: "irene", facility: "shop",
    open: () => game.prologuePhase?.() === "appraise", used: () => false,
    prepare: () => game.preparePrologueAppraisal?.(),
    intro: () => [["司教は鑑定の技を持っています。迷宮で手に入れた品を、街で無料で鑑定できます。", "試しに、この『杖？』を鑑定してみてください。"], ["この商会で『鑑定を試みる』をお選びください。", "表示される成功率を確かめてから、始めましょう。"]],
    steps: [{ text: "商会で『杖？』の鑑定を試みる", hint: "商会 → 売る → 鑑定を試みる", go: () => UI.openShop?.("sell"), target: [".prologue-appraise"], done: () => !!G_().msq?.prologue?.appraised }],
    outro: ["正体がわかりましたね。『杖？』は、品質50の魔法の杖でした。", "王宮で回廊の報告をして、次の依頼をお受けください。この子たちと、ご無事で戻られますように。"],
  },
  {
    key: "buyEquipment", name: "商会で装備を整える", who: "shop",
    open: () => game.prologuePhase?.() === "shop", used: () => false,
    prepare: () => { UI.openShop?.("buy", { cat: "rec", clearFilters: true }); },
    intro: () => [
      "ヴォス「黒鉄商会へようこそ。王から支度金を受け取ったそうだな。まずは『買う』の『おすすめ』を見てくれ。」",
      "ヴォスの下に並ぶ顔から、装備を整える人業を選ぼう。『おすすめ』には、選んだ者の現在装備より役に立つ品が並ぶ。能力の増減と失う特殊効果も確かめ、『買って装備』で一品買ってみよう。金貨を払い、その者に装備できる。",
      "「悪いが、在庫はほとんど切らしていてな。新しい武器や防具は迷宮で探し、街へ持ち帰ってくれ。不要な品は、うちで買い取ろう。」",
      ...(UI.tutorialPurchaseBlock?.() ? [`ヴォス「${UI.tutorialPurchaseBlock()}買い方は覚えたな。今回はこのまま向かうといい。」`] : []),
    ],
    steps: [{ text: "おすすめの装備を一品購入する", hint: "商会 → 買う → おすすめ → 買って装備", go: () => UI.openShop?.("buy", { cat: "rec" }), target: [".wpc-buy-main:not(:disabled)"], on: "equipmentBought", skip: () => !!UI.tutorialPurchaseBlock?.() }],
    outro: ["買い方はつかめたな。棚にない品は、迷宮で探してくれ。生きて持ち帰れば、次の備えになる。", "地下墓地へ向かう支度が済んだら、迷宮の門へ行くといい。"],
  },
  {
    key: "shopAppraise", name: "持ち帰った品の鑑定", who: "shop",
    open: () => !!tutState().appraisePending, used: () => false,
    prepare: () => { UI.openShop?.("sell"); },
    intro: () => [
      "ヴォス「正体のわからない品を持ち帰ったな。『剣？』などと表示される未鑑定の品は、そのままでは装備できない。まずは鑑定して、正体を確かめるんだ。」",
      "「商会の『売る』から鑑定を頼める。金貨はかかるが、必ず正体がわかる。鑑定料と売値は同じ額だ。鑑定して不要なら売れば、鑑定に使った金貨は戻ってくる。」",
      "「買値は売値の二倍だ。売った品は商会の棚に並ぶから、必要になればいつでも買い直せる。ただし通常の品は並の品質になる。大事な品はよく考えてから手放せよ。」",
      "「今は金貨が足りなければ、袋に入れたまま持っていていい。鑑定が済んだら、装備を見直してみるんだな。」",
    ],
    steps: [{ text: "商会で鑑定の説明を聞く", hint: "商会 → 売る → 鑑定", done: () => true }],
    outro: ["未鑑定の品は、正体を確かめてから装備するんだ。鑑定料と売値は同じ額、買値は売値の二倍だ。", "売った品は商会で買い直せる。ただし通常の品は並の品質になる。大事な品は、手放す前によく考えろよ。"],
  },
  {
    key: "trainSoul", name: "魂を強化", who: "irene",
    open: () => !!tutState().trainPending, used: () => false,
    prepare() { tutState().base.uid = UI.trainableList?.()[0]?.uid; },
    intro: () => [
      ["魂を育てるだけの✦Soulを持ち帰られたのですね。", "迷宮で集めた✦Soulは、館で魂の強化に使えます。"],
      ["人業の名前の下で『魂を強化』を押すと、表示された✦Soulを使って、その子のメイン魂のLvが一つ上がります。", "能力が伸び、Lvによっては新しい技も覚えます。実際に一度、強化してみましょう。"],
      ["✦Soulは隊で分け合うものです。育てたい子と必要な数を確かめてから使ってください。", "Lv上限に達した魂は、それ以上強化できません。"],
    ],
    steps: [{ text: "人業のメイン魂を一度強化する", hint: "人業の館 → 魂を強化",
      go: () => goSoulSeg(allDolls().find(d => d.primary === tutState().base.uid) || UI.trainableList?.()[0]?.doll),
      target: [".sp-acts .ui-btn.k-primary:not(:disabled)"], on: "soulTrained",
      skip: () => !(UI.trainableList?.().length > 0),
    }],
    outro: ["✦Soulがたまったら、また館の『魂を強化』で育ててあげてください。", "強化する魂と必要な数は、いつでも確かめられます。どの子に力を分けるか、ゆっくりお考えくださいね。"],
  },
  {
    key: "firstDive", name: "初めて迷宮に入る", who: "gate", manual: true,
    open: () => !game.prologueActive?.() && G_().msq?.n >= 1 && !!tutState().done.buyEquipment,
    used: () => (G_().stats?.runs || 0) > 0, intro: () => ["出撃の画面で迷宮を選び、『門をくぐる』を押す。"],
    steps: [{ text: "迷宮の門をくぐる", hint: "出撃 → 門をくぐる", go: () => UI.openDeparture?.(), target: [".dp-cta"], on: "dungeonEntered" }], outro: ["迷宮へ踏み出した。"],
  },
  {
    key: "soulChange", name: "魂の付け替え", who: "irene",
    open: () => !game.prologueActive?.() && G_().msq?.n >= 1 && !!tutState().jobVisit && newJobSouls().length > 0,
    used: () => false,
    prepare: () => null,
    intro: () => [
      ["新しい職業の魂を持ち帰られたのですね。"],
      ["宿す魂を変えれば、今いる人業も別の職業として戦えます。魂の育ちは残り、外した魂も失われません。", "『魂を交換』から魂の一覧を開き、持ち帰った魂を選んでみてください。能力や技を確かめてから『宿す』で付け替えられます。"],
      ["新しい職業で使えない装備は外れます。同じ職業をメイン魂にできるのは、隊に一体だけです。"],
    ],
    steps: [{ text: "メイン魂の『魂を交換』を開く", hint: "今の職業を変える操作です。光っている『魂を交換』を選ぶ", go: () => goSoulSeg(), target: [".sp-change"], on: "soulPickerOpened" },
      { text: "持ち帰った魂を選び、能力の変化を確認する", hint: "光っている魂 → 能力と技を読む → 宿す、または戻って一覧を閉じる", target: [".sp-change"], done: () => !!tutState().ev.soulPreviewed && !!tutState().ev.soulChangeViewed }],
    outro: ["魂の付け替えは、魂の見出しの『魂を交換』から、いつでも行えます。", "新しい魂を迎えたら、その子にどんな役目を任せたいか、考えてみてください。"],
  },
  {
    key: "fusion", name: "魂融合", who: "irene",
    open: () => !!(game.featureUnlocked?.("fusion") && (tutState().fusionPending || tutState().cur === "fusion")),
    used: () => ((G_().stats || {}).fusions || 0) > 0,
    // 素材の有無に関わらず、戦士の魂を2つ預ける (宿していなくても、2つどうしで融合できる)
    prepare() {
      if (!grantSoul("fighter")) return null;
      grantSoul("fighter");
      return `${jobLabel("fighter")}の魂をふたつ`;
    },
    intro: (gift) => [
      ["魂の付け替えは職業を変えますが、魂融合は同じ職業の魂を重ねて育てる操作です。残す戦士の『魂融合』を開き、素材にする戦士を選びます。素材の魂は消え、残す魂に力が加わります。", "『魂』の区分の『魂融合』から、一度試してみてください。"],
      gift ? [`練習に、${gift}お預けします。`, "宿している戦士の魂に溶かしても、ふたつを溶かし合わせてもかまいません。"]
        : ["余っている戦士の魂を、融合してみてください。"],
    ],
    steps: [{ text: "戦士の『魂融合』を開く", hint: "残す魂は戦士。光っている『魂融合』を選ぶ", go: () => goSoulSeg(fusableDoll()), target: ['.sp-fuse.hot[data-job="fighter"]', '.sp-srow[data-job="fighter"] .sp-pick-fuse', ".sp-change"], on: "fusionOpened" }, {
      text: "素材の戦士を選び、融合後の変化を確認する",
      // 宿している魂に融合できるなら魂の区分の『魂融合』、無ければ『メイン魂』の一覧の『魂融合』
      get hint() {
        return fusableDoll() ? "人業の館 → 戦士 →『魂融合』→ 戦士の魂を選ぶ" : "『魂を交換』→ 戦士の魂の『魂融合』";
      },
      go: () => goSoulSeg(fusableDoll()), target: ['.sp-fuse.hot[data-job="fighter"]', '.sp-srow[data-job="fighter"] .sp-pick-fuse', ".sp-change"],
      on: "soulFused:fighter",
      skip: () => !anyFusable(),
    }],
    outro: ["魂を融合すると、魂の強さとLv上限が上がります。", "一定数以上の魂を融合すれば、魂がランクアップします。これからの旅で出会う魂も、大切にお連れくださいね。"],
  },
  {
    key: "sub1", name: "サブ魂", who: "irene",
    open: () => !!(game.unlockedSubSlots && game.unlockedSubSlots() > 0),
    used: () => allDolls().some((d) => (d.subs || []).some(Boolean)),
    prepare() {
      if (spareSouls().length) return null;
      const have = new Set(allDolls().map((d) => safe(() => soulByUid(d.primary).clsKey, null)));
      const cls = ["knight", "bishop", "priest", "mage", "thief", "fighter"].find((k) => !have.has(k)) || "knight";
      grantSoul(cls);
      return `${jobLabel(cls)}の魂をひとつ`;
    },
    intro: (gift) => [
      ["持ち帰った魂には、もうひとつ使い道があります。", "職業を変えるメイン魂とは別に、サブ魂として宿すこともできます。"],
      ["メイン魂はそのまま、下の『サブ魂1』に別の魂を宿します。職業は変わりません。", "次に『技』を開いて、借りたい技かパッシブを一つ選びましょう。"],
      ["サブ魂は、覚えた技やパッシブを貸してくれます。", "それに、その魂の能力の一部が人業に足されます。魂のランクが高いほど多くなります。"],

      gift ? [`練習に、${gift}お預けします。`, "空いている魂を、サブ魂の枠に宿してみてください。"]
        : ["隊に出していない魂を、", "サブ魂の枠に宿してみてください。"],
      ["メイン魂を付け替えたなら、外した元の魂もサブ魂に使えます。", "宿したら『技』で、借りる技をひとつ選んでみましょう。"],
    ],
    steps: [
      { text: "サブ魂1の枠を開く", hint: "メイン魂はそのまま。下の『サブ魂1』を選ぶ", go: () => goSoulSeg(null), target: [".sp-sub.empty .sp-tile-main", ".sp-sub .sp-tile-main"], on: "subPickerOpened", done: () => !!dollWithSub() },
      {
        text: "一覧からサブ魂を選び、確認して宿す", hint: "人業の館 → サブ魂1 の『＋ 魂を宿す』",
        go: () => goSoulSeg(null), target: [".sp-sub.empty .sp-tile-main", ".sp-sub .sp-tile-main"],
        done: () => !!dollWithSub(),
        skip: () => !dollWithSub() && !spareSouls().length,
      },
      {
        text: "サブ魂から借りる技を選ぶ", hint: "サブ魂の札の『技』→ 選んで閉じる",
        go: () => goSoulSeg(dollWithSub()), target: [".sp-tile-sk"],
        done: () => !!tutState().ev.subPick && !!tutState().ev.subSkill,
        skip: () => !dollWithSub(),
      },
    ],
    outro: ["メイン魂と別の職の魂を宿せば、職の垣根を越えた一手になります。", "借りる技は、サブ魂の札の『技』から、いつでも選び直せます。その子に合う技を探してあげてください。"],
  },
  {
    key: "tavern", name: "酒場の依頼と噂", who: "tavern",
    open: () => !!game.featureUnlocked?.("tavern"),
    used: () => (G_().stats?.questsDone || 0) > 0 || !!G_().quest?.active?.length || Object.keys(G_().quest?.fixed || {}).length > 0,
    prepare: () => null,
    intro: () => [
      "酒場『沈まぬ灯』へようこそ。掲示板には、迷宮での討伐や品の納品などの依頼が集まる。",
      "依頼の札で条件と報酬を確かめてから受けよう。受けられる依頼は、依頼人の頼みも合わせて六件までだ。",
      "受けた依頼も掲示板に『受注中』として並ぶ。条件を満たしたら酒場で報告し、報酬を受け取ろう。掲示板は迷宮から帰るたびに貼り替わるが、受けた依頼は残る。",
    ],
    steps: [{
      text: "酒場の掲示板を見る", hint: "酒場 →『掲示板』",
      go: () => UI.openTavern?.("board"), target: [".fc-qarea"], on: "tavernBoard",
    }],
    outro: ["掲示板の依頼は、札を選べば詳しく読める。次の探索で果たせそうな頼みを探してみな。", "俺の噂も、酒場に来れば無料で聞けるぞ。迷宮から帰るたびに新しい話を仕入れておく。酒場を出入りするだけじゃ、話は変わらんがな。"],
  },
  {
    key: "rumor", name: "情報屋の噂", who: "tavern",
    open: () => false, // 旧手ほどきのIDは残し、通常の案内は酒場へ統合
    used: () => { const G = G_(); return !!(G.rumor || G.activeRumor); },
    prepare: () => null,
    intro: () => [
      "酒場「沈まぬ灯」の情報屋が、そなたに口を利くようになった。",
      "酒場に入れば、情報屋の噂が無料で読める。噂は、名前の出た迷宮に潜った時に現実になる。",
      "迷宮から帰還するたびに、新しい噂に変わる。待ち時間はなく、酒場の出入りだけでは変わらない。",
    ],
    steps: [{
      text: "酒場で噂を聞く", hint: "酒場 →『情報屋の噂』",
      go: goTavern, target: [".fc-rumor"],
      done: () => { const G = G_(); return !!(G.rumor || G.activeRumor); },
    }],
    outro: ["俺が読むのは、あんたの隊の力に見合う迷宮が多い。噂の迷宮には、出撃の地図に『噂』の印が付く。", "迷宮から戻ったら、また顔を出しな。新しい噂を用意しておくよ。"],
  },
  {
    key: "order", name: "控えの結社", who: "irene",
    open: () => !!(game.featureUnlocked && game.featureUnlocked("order")),
    used: () => { const o = G_().order; return !!(o && Array.isArray(o.picks) && o.picks.length); },
    prepare: () => null,
    intro: () => [
      ["控えの結社が開かれたそうですね。"],
      ["隊に出していない魂も、ただ眠っているわけではありません。", "席に着けた魂は、その力の一部を人業のみなに分けてくれます。"],
      ["名前の右の『結社』を開いてみてください。"],
    ],
    steps: [{
      text: "控えの結社を開く", hint: "人業の館 → 名前の右の『結社』",
      go: () => goSoulSeg(null), target: [".pt-order"],
      on: "order",
    }],
    outro: ["席に着いた魂の能力の一部が、隊の皆さまに加わります。", "ランクの高い魂ほど、分けられる力も大きくなります。館に残る子たちの力も、旅のお供にしてくださいね。"],
  },
  {
    key: "orderLearning", name: "結社の伝習", who: "irene",
    open: () => !!game.featureUnlocked?.("orderLearning"),
    used: () => false,
    intro: () => [
      ["毒沼の奥まで、道を開いてくださったのですね。", "館に残る魂にも、皆さまの戦いの学びを届けられるようになりました。『結社の伝習』と呼びましょう。"],
      [`迷宮の戦闘で得た✦Soulの${Math.round(game.orderLearningRate() * 100)}%が、結社の席に着いている魂の経験値にも入ります。`, `たとえば✦100を得た戦いなら、各席の魂がそれぞれ${Math.round(game.orderLearningRate() * 100)}を得ます。皆さまの取り分は減りません。`],
      ["Lv上限に届いた魂も、経験値を蓄えておけます。上限を上げれば、その学びが成長につながります。", "依頼の報酬や、戦闘以外で拾った✦Soulは対象になりません。端数は切り捨てです。"],
      ["いつもの結社の席を使って、学びを届けます。", "『結社』を開いて、これから育てたい魂が席に着いているか、確かめてみてください。"],
    ],
    steps: [{ text: "結社を開き、伝習の説明と席の魂を確認する", hint: "人業の館 →『結社』",
      go: () => goSoulSeg(null), target: [".pt-order"], on: "order" }],
    outro: ["結社の各席の魂には、迷宮の戦闘で得た✦Soulの一定の割合が、経験値として届きます。", "空席には学びが届きません。育てたい魂を席に着けてから、次の迷宮へお向かいください。"],
  },
  {
    key: "enchant", name: "武魂 — 装備に魂を宿す", who: "shop",
    open: () => !!game.featureUnlocked?.("enchant"),
    used: () => false,
    prepare() { UI.openShop?.("enchant"); },
    intro: () => [
      "ヴォス「武魂は、かつての使い手の魂の一部だ。長い年月をかけて少しずつ装備に宿り、凝縮したものなんだ。」",
      "「誰がどう使ったかで、同じ品でも宿る武魂は千差万別だ。達人が生涯使った業物には、人知を超えた力が眠ることもある。」",
      "「商会では、すでに宿った武魂を取り出し、別の装備へ移せる。手始めにHP+10の武魂を一つ預かっている。」",
      "「武魂は商会で自由に宿し、外せる。金貨はいらん。装備を売ったり捨てたり、素材にしても、武魂はすべて商会へ戻る。」",
      "「枠はコモン1・アンコモン2・レア3・SR4・LR5。同じ効果は一つの品に一つまでだ。品が元から持つ効果とは重ねられる。」",
      "「第四章以降の迷宮で、新しく拾うレア以上の装備には武魂が一つ宿る。第四章の本筋を二か所報告すれば合成もできるぞ。」",
    ],
    steps: [{ text: "商会の武魂の手引きを確認する", hint: "商会 → 武魂", done: () => true }],
    outro: ["装備に魂を宿す時は、商会の『武魂』から品を選んでくれ。", "今は使わない武魂も、合成の素材になる。先の備えに残しておくといい。"],
  },
  {
    key: "bukonFusion", name: "武魂合成", who: "shop",
    open: () => !!game.featureUnlocked?.("bukonFusion"), used: () => false,
    prepare() { game.prepareBukonFusionTutorial?.(); UI.openShop?.("enchant"); },
    intro: () => ["ヴォス「武魂合成を教えよう。練習用にHP+10の武魂を三つ預けた。保管中の一覧から、HPの武魂の『合成』を選んでくれ。」", "「Lv1を三つ使うとLv2になる。必ず成功し、最初の合成は100金貨だ。違うLvも素材に混ぜられる。素材にした武魂はなくなるぞ。」"],
    steps: [{ text: "保管中のHPの武魂を合成する", hint: "商会 → 武魂 → 保管中 → HPの合成 → Lv2", go: () => UI.openShop?.("enchant"), target: [".bk-panel button:not(:disabled)", ".bk-panel input", ".ec-sheet button", ".ui-confirm button", ".ec-sheet select"], on: "bukonFused" }],
    outro: ["同じ効果の武魂を合成すれば、その効果を育てられる。", "装着中や保護中の武魂は素材にならん。残したいものには保護をかけておけよ。"],
  },
  {
    key: "extremeAffix", name: "極の特性 — 星の付いた装備", who: "shop",
    open: () => false,
    used: () => false,
    intro: () => [
      "ヴォス「★の印が付いた装備を持ち帰ったな。これは『極』の特性だ。数字を増やすだけでなく、戦い方そのものを変える力がある。品の説明で、発動する条件と効果を確かめてみろ。」",
      "「極の特性も、付呪で巻物に写せる。ただし、書き込めるのは極がまだ付いていない装備だけだ。極の付いた品に、もう一つ極を書き足すことはできない。」",
      "「拾った時から極をいくつも持つ品が、ごくまれに見つかることはある。付呪でその組み合わせを作ることはできない。写し取ると元の品は消え、一つ選んだ特性以外は失われるから、すぐに写さず、品のまま使う道も考えろ。」",
      "「商会の棚にどの特性を残すか選ぶ時は、特性の効果をよく確かめろ。滅多に見つからない強力な特性もあるからな。」",
    ],
    steps: [{ text: "極の特性の使い方を確認する", hint: "品の説明で発動条件と効果を確かめよう", done: () => true }],
    outro: ["極の特性は★が目印だ。付呪で書き込めるのは、極がまだ付いていない装備だけだぞ。", "商会の棚にどの特性を残すか選ぶ時も、効果をよく確かめろ。貴重な品だ。急いで決めることはない。"],
  },
];
const TUT_MAP = Object.fromEntries(TUTS.map((t) => [t.key, t]));

// ---- 進み具合 ----
// 済ませていない手ほどき (解放の順)。始めていない旧セーブの分は、もう使っていれば済み扱い
function dueKeys() {
  if (G_()?.testPlay && !G_().testStoryFlow) {
    const key = G_().testTutorial;
    return key && !tutState().done[key] ? [key] : [];
  }
  const st = tutState();
  if (!st) return [];
  const out = [];
  for (const t of TUTS) {
    if (st.done[t.key] || !safe(t.open, false)) continue;
    if (st.cur !== t.key && safe(t.used, false)) { st.done[t.key] = true; continue; }
    out.push(t.key);
  }
  return out;
}
function curDef() {
  const st = tutState();
  if (!st || !st.cur) return null;
  const d = TUT_MAP[st.cur];
  if (!d || st.done[st.cur]) { st.cur = null; st.step = 0; return null; }
  return d;
}
function curStep() {
  const d = curDef();
  return d ? d.steps[tutState().step] || null : null;
}
function stepDone(s) {
  if (!s) return false;
  if (s.on) return !!tutState().ev[s.on];
  return !!safe(s.done, false);
}

// UI.tutorialPending(): 迷宮の前に済ませる手ほどき { key, name, text } (無ければ null)
function pending() {
  const keys = dueKeys();
  const st = tutState();
  // 開始後に解放条件が変わっても、完了するまでは現在の手順を案内する。
  const key = curDef()?.key || keys[0];
  if (!key) return null;
  const d = TUT_MAP[key];
  const step = st.cur === key ? d.steps[st.step] || d.steps[0] : d.steps[0];
  const facility = facilityOf(d), place = FACILITIES[facility];
  const arrival = !atFacility(facility);
  return { key, name: d.name, who: d.who, facility, arrival,
    text: arrival ? (key === "repairSoul" ? "人業の館で砕けた魂の修復を教わる" : `${place.name}を選択してください`) : step.text,
    hint: arrival ? place.hint : step.hint,
    started: st.cur === key };

}

// UI.tutorialFree(key): その手ほどきの最中か (手ほどき中の費用を調整する)
function isFree(key) { const st = tutState(); return !!st && st.cur === key && !st.done[key]; }

// ---- 始める・続ける ----
let busy = false; // 導入・完了の会話の最中
function inTown() { const G = G_(); return !!G && G.state === "town"; }

// UI.tutorialResume(): 済ませていない手ほどきを始める (始めていれば今の手順へ案内する)
function resume() {
  if (!inTown() || busy || sceneActive() || G_().prompt ||
      (hasDOM() && document.querySelector(".sc-scene:not(.out)"))) return false;
  const p = pending();
  if (!p) return false;
  const st = tutState();
  const d = TUT_MAP[p.key];
  // 館の物語を読み終えてから導入へ。進行中の手ほどきには割り込ませない。
  if (!st.cur && p.facility === "party" && game.pendingIreneBeat?.()) return false;
  if (p.arrival) { updateGuidance(); schedule(); return true; }
  if (p.facility === "party" && !isGreeted()) { if (UI.enterMansion) UI.enterMansion(); return true; }
  if (st.cur !== p.key) return start(d);
  goStep(true);
  return true;
}
// 初訪問の挨拶と三体の操作案内を、同じ会話の中で続ける。
function mansionGreeting(done) {
  if (!atMansion() || isGreeted() || busy || sceneActive() || pending()?.key !== "createThree") return false;
  return start(TUT_MAP.createThree, { prefix: greetingPages(), onIntroEnd: done });
}
function start(d, { prefix = [], onIntroEnd } = {}) {
  const st = tutState();
  st.cur = d.key; st.step = 0; st.ev = {}; st.base = {};
  playtestEvent("手ほどき開始", { id: d.key, name: d.name });
  const gift = safe(() => d.prepare(), null);
  if (game.autosave) game.autosave(true);
  busy = true;
  clearGlow(); updateGuidance();
  const after = () => {
    onIntroEnd?.();
    busy = false;
    if (gift) toast(`${gift}預かった (手ほどき用)`, { tone: "good" });
    setTimeout(() => { safe(() => d.afterIntro?.(), null); goStep(true); }, 200); // 語りを閉じたタップが、開いた先の画面に届かないように
  };
  if (d.who === "irene") playIreneScene([...prefix, ...d.intro(gift)], after);
  else introSheet(d, after);
  return true;
}
// 商会と酒場も、導入から締めくくりまで教え手の会話として進める。
function playTutorialScene(d, lines, done) {
  const shop = d.who === "shop";
  const name = shop ? "ヴォス" : "情報屋";
  const art = () => shop ? keeperCanvas("merchant") : vignetteCanvas("tavern");
  playStoryChain(lines.flat().map(line => ({
    title: d.name, kicker: shop ? "黒鉄商会" : "沈まぬ灯", place: shop ? "shop" : "tavern",
    who: { name, art }, lines: [/^(?:ヴォス)?「/.test(line) ? line : `「${line}」`], btnLabel: "心得た",
  })), done);
}
function introSheet(d, done) {
  if (d.who !== "gate") { playTutorialScene(d, d.intro(), done); return; }
  const h = sheet.open({
    kind: "choice", banner: "手ほどき", title: d.name, lines: d.intro(),
    footer: [{ label: "心得た", kind: "primary", onTap: s => s.close("ok") }], onClose: done,
  });
  if (!h?.el) done();
}

// 今の手順へ: 必要なら行き先を開き、イレーヌの台詞と押す所の光を更新する
function goStep(navigate) {
  let s = curStep();
  while (s && (stepDone(s) || safe(() => (s.skip ? s.skip() : false), false))) {
    if (!advance(true)) return;
    s = curStep();
  }
  if (!s) return;
  if (navigate && inTown()) safe(() => s.go(), null);
  schedule();
}
// 手順を1つ進める。終わりなら完了 (false を返す)
function advance(quiet = false) {
  const st = tutState();
  const d = curDef();
  if (!d) return false;
  st.step++;
  if (st.step >= d.steps.length) { finish(d); return false; }
  if (game.autosave) game.autosave(true);
  if (!quiet) {
    sfx("select");
  }
  return true;
}
function finish(d) {
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  const st = tutState();
  st.done[d.key] = true;
  playtestEvent("手ほどき完了", { id: d.key, name: d.name });
  game.completePrologueTutorial?.(d.key);
  st.cur = null; st.step = 0; st.ev = {}; st.base = {};
  if (d.key === "repairSoul" && st.repairResume) {
    Object.assign(st, st.repairResume);
    delete st.repairResume;
  }
  if (game.autosave) game.autosave(true);
  clearGlow();
  updateGuidance();
  if (d.silent) { if (pending() && !pending().started) UI.shell?.setTab?.("hub"); schedule(); return; }
  busy = true;
  const after = () => {
    busy = false;
    if (game.renderTown && inTown()) game.renderTown();
    // 修道院を踏破済みなら、付け替えの確認からサブ魂へ同じ館で続ける。
    const continueSouls = d.key === "soulChange" && pending()?.key === "sub1";
    if (!continueSouls && pending() && !pending().started) UI.shell?.setTab?.("hub");
    // 次の手ほどきは、街で対象施設の入口を案内する
    if (pending() && !TUT_MAP[pending().key]?.manual) setTimeout(() => resume(), 240);
  };
  sfx("victory");
  // 出撃後は探索を止めず、それ以外は教え手との会話で締める。
  if (d.who === "irene") {
    playIreneScene(d.outro.map(line => [line]), after);
    return;
  }
  if (d.who !== "gate") {
    playTutorialScene(d, d.outro, after);
    return;
  }
  const more = dueKeys().some((key) => !TUT_MAP[key].manual);
  const h = celebrate({
    banner: "手ほどき完了", title: d.name,
    lines: [...d.outro, ...(more ? ["── 続けて、もうひとつ手ほどきがある。"] : [])],
    okLabel: more ? "次の手ほどきへ" : "心得た", sparkle: false,
    onClose: after,
  });
  if (!h || !h.el) after();
}

// UI.tutorialAfterReport(): 王への報告の語りを閉じた後。解放されたばかりの手ほどきを始める
function afterReport() {
  if (!pending() || TUT_MAP[pending().key]?.manual) return false;
  setTimeout(() => resume(), 700); // 報告の知らせ (トースト) を見せてから
  return true;
}

// 初めて砕けた人業を伴って帰還した時。帰還の報告より館の手ほどきを優先する。
// 赤い魂で全員が生還した時・迷宮で蘇った時も、初めて砕けたなら説明する (st.repairFell ← game.js imprintFallen)。
function afterReturn() {
  const st = tutState();
  if (!st) return false;
  // 修道院以降の帰還で、没収されずに持ち帰った職業の魂だけを数える。
  const haul = G_().lastRun;
  if (!game.prologueActive?.() && G_().msq?.n >= 1 && haul?.souls?.length > 0 && !haul.forfeited && haul.outcome !== "wipe" && !haul.soulTutorialHandled) {
    haul.soulTutorialHandled = true;
    if (haul.abbeyRare) st.abbeyRareReturned = true;
    if (!st.done.soulChange && newJobSouls().length > 0) st.jobVisit = true;
    // 同じ帰還の案内を再開しても融合を追加しない。サブ魂を学んだ後の次の持ち帰りで教える。
    if ((haul.sub1LearnedBeforeReturn ?? st.done.sub1) && !st.done.fusion) st.fusionPending = true;
    game.autosave?.(true);
  }
  if (!st.done.trainSoul && UI.trainableList?.().length > 0) {
    st.trainPending = true; game.autosave?.(true);
  }
  if (!st.done.shopAppraise && UI.unidCount?.() > 0) {
    st.appraisePending = true;
    game.autosave?.(true);
  }
  if (!["fourth", "sixth"].includes(game.prologuePhase?.()) && !st.done.repairSoul && (anyBroken() || st.repairFell)) {
    st.repairPending = true;
    delete st.repairFell;
    if (st.cur && st.cur !== "repairSoul") {
      st.repairResume = { cur: st.cur, step: st.step, ev: st.ev, base: st.base };
      st.cur = null; st.step = 0; st.ev = {}; st.base = {};
    }
    if (game.autosave) game.autosave(true);
  }
  if (!pending()) return false;
  // 帰還時は街を描いた後に手ほどきの条件が決まるため、全ての案内で目標を描き直す。
  if (inTown()) game.renderTown?.();
  resume();
  return true;
}

// UI.tutorialEvent(name): UI から届く合図 (サブ魂の技を開いた・結社を開いた…)
function onEvent(name) {
  const st = tutState();
  if (!st || !st.cur) return;
  st.ev[name] = true;
  if (name === "dungeonEntered" && st.cur === "firstDive") {
    st.done.firstDive = true; st.cur = null; st.step = 0; st.ev = {}; st.base = {};
    clearGlow(); updateGuidance();
    if (game.autosave) game.autosave(true);
    return;
  }
  schedule();
}

// ---- 見張り: 手順が済んだか・光らせる所・イレーヌの台詞 ----
let raf = 0, resumeTimer = null;
function schedule() {
  if (!hasDOM() || raf) return;
  const run = () => { raf = 0; tick(); };
  raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16);
}
function tick() {
  const s = curStep();
  if (s && !busy && inTown() && !sceneActive() && !document.querySelector(".sc-scene:not(.out)")) {
    if (stepDone(s) || safe(() => (s.skip ? s.skip() : false), false)) {
      // 最後の手順: 開いているシート (融合・技の選択・昇格の祝祭…) を閉じてから完了のカードを出す
      const d = curDef();
      const last = d && tutState().step >= d.steps.length - 1;
      if (!(last && sheetDepth() > 0)) { if (advance()) schedule(); return; }
    }
  }
  const guide = tutorialControls();
  glowControl(guide?.target);
  if (!guide?.target && curDef() && !busy && inTown() && !sceneActive() && !document.querySelector(".sc-scene:not(.out)") && sheetDepth() === 0 && !game.isTitleActive?.() && !game.isOpeningActive?.() && !resumeTimer) {
    resumeTimer = setTimeout(() => { resumeTimer = null; if (curDef() && !tutorialControls()?.target) resume(); }, 150);
  }
  updateGuidance();
}
function clearGlow() {
  if (!hasDOM()) return;
  for (const n of document.querySelectorAll(".tut-glow")) n.classList.remove("tut-glow");
}
function glowControl(hit) {
  if (!hasDOM()) return;
  const changed = hit && !hit.classList.contains("tut-glow");
  for (const node of document.querySelectorAll(".tut-glow")) if (node !== hit) node.classList.remove("tut-glow");
  if (hit && changed) {
    hit.classList.add("tut-glow");
    if (!hit.matches("button, input, [tabindex]")) hit.tabIndex = 0;
    hit.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}
// 館での操作案内は、既存のイレーヌの台詞欄にまとめる。
function ireneGuidance() {
  const p = pending();
  if (!atMansion() || busy || sceneActive() || p?.who !== "irene") return null;
  const d = TUT_MAP[p.key];
  const s = p.started ? curStep() : d.steps[0];
  if (!s) return null;
  if (p.key === "createThree") {
    const target = tutorialControls()?.target;
    if (target?.closest(".pt-name-sheet")) return ["この子に名前を与えてください。", "『仕立てる』を押すと、魂を宿した人業が目覚めます。"];
    if (target?.dataset.job) return [`光っている『${jobLabel(target.dataset.job)}の魂』をお選びください。`, "選んだ魂を宿す子に、名前を与えましょう。"];
    if (target?.classList.contains("pt-res-add")) return ["光っている『人業を仕立てる』を押してください。", "残る魂も、ひとつずつ人業に宿しましょう。"];
    if (target?.dataset.drop) return ["顔アイコンの光っている空き枠『＋』を押してください。", "次の人業をお仕立てしましょう。"];
  }
  if (["createFourth", "createFifth", "createSixth"].includes(p.key)) return ["『人業を仕立てる』から、お渡しした魂を選んでください。", "この子に名前を与え、魂を宿しましょう。"];
  if (p.key === "prologueFormation") {
    const { mover, target } = formationMove();
    const front = jobLabel(soulByUid(mover?.primary)?.clsKey || "knight");
    const back = jobLabel(soulByUid(target?.primary)?.clsKey || "priest");
    return tutState().step === 0 ?
      [`${front}の『編成』を開いてください。`, `次に${back}を選び、${front}を前衛へ移しましょう。`] :
      [`隊列から${back}を選んでください。`, `${front}が前衛に、${back}が後衛に移ります。`];
  }
  // 目標札の操作手順ではなく、通常会話と同じ口調で案内する。
  if (p.key === "trainSoul") return ["『魂を強化』を押し、✦Soulを魂に注いでください。", "必要な✦Soulと、上がるLvを確かめましょう。"];
  if (p.key === "fusion") return [curStep()?.text || p.text, "残す戦士と、消えて素材になる戦士を確かめましょう。"];
  if (p.key === "soulChange") return [curStep()?.text || p.text, "付け替えると職業が変わります。外した魂は残ります。"];
  if (p.key === "sub1") return tutState().step >= 2 ?
    ["サブ魂の札の『技』を開いてください。", "借りる技を選んだら、閉じてください。"] :
    ["サブ魂の枠を開き、魂をお選びください。", "隊に出していない魂を、宿してみてください。"];
  if (p.key === "order") return ["名前の右の『結社』で、控えの結社を開いてみてください。", "席に着けた魂は、みなに力を分けてくれます。"];
  if (p.key === "repairSoul") return ["砕けた人業を選び、状態を確かめてください。", "人業が届いたら、わたしが金貨で魂をつなぎ直します。"];
  return null;
}
function updateGuidance() {
  if (!hasDOM()) return;
  const lines = ireneGuidance();
  if (!lines) return;
  const text = document.querySelector(".pt-keeper .pt-kp-text");
  if (!text || unphrase(text.textContent) === lines.join("")) return;
  text.textContent = "";
  for (const line of lines) text.appendChild(el("span", "pt-kp-l", line));
  const say = text.closest(".pt-kp-say");
  say?.setAttribute("aria-label", `${lines.join("")}`);
  say?.querySelector(".pt-kp-next")?.classList.add("hidden");
}

// すべての手ほどきで、現在の画面の「次の操作」だけを受け付ける。
function tutorialControls() {
  if (!hasDOM() || !inTown() || game.isTitleActive?.() || game.isOpeningActive?.()) return null;
  const p = pending(), d = curDef();
  if (!p && !d && !busy) return null;
  // 商会での支度は自由。迷宮を自分で選ぶまで、次の手ほどきで操作を制限しない。
  if (!d && !busy && TUT_MAP[p?.key]?.manual) return null;
  const choose = (nodes, allow = []) => {
    const target = nodes.find((n) => n && !n.disabled && n.isConnected && n.getClientRects().length);
    return { target, allowed: [target, ...allow].filter(Boolean) };
  };
  const first = (root, selector) => [...root.querySelectorAll(selector)];
  // 説明の会話は従来どおり、画面全体のタップとスキップを受け付ける。
  if (document.querySelector(".sc-scene:not(.out)") || sceneActive()) return null;
  const h = sheet.top();
  const card = h?.el;
  const forward = (readable = false) => {
    let nodes = first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled), .ui-sheet-foot .ui-btn.k-danger:not(:disabled)");
    if (!nodes.length) {
      let next = card.querySelector(".tut-next");
      if (!next) {
        next = button({ label: "次へ", kind: "primary", onTap: () => h.close("ok") });
        next.classList.add("tut-next"); h.foot.appendChild(next); h.foot.classList.remove("hidden");
      }
      nodes = [next];
    }
    // 導入と完了の説明は、次へ進むボタンに加えて本文のタッチスクロールを許可する。
    return choose(nodes, readable ? [h.body] : []);
  };
  if (busy) return card ? forward(true) : null;
  // 初レア魂で増えた見識などの知らせを閉じてから、館への訪問を案内する。
  if (card && h.kind === "celebrate") return forward(true);
  if (p?.arrival) return choose(first(document, FACILITIES[p.facility].target));
  if (!d) return choose(first(document, ".hb-goal-go"));
  const st = tutState(), s = curStep();
  if (card) {
    if (["insight", "soulChange", "sub1", "fusion"].includes(d.key) && h.body) {
      let note = h.body.querySelector(":scope > .tut-step-note");
      if (!note) { note = el("div", "pt-note tut-step-note"); h.body.prepend(note); }
      const message = `手ほどき ${st.step + 1}/${d.steps.length}：${s.text}。${s.hint}`;
      if (unphrase(note.textContent) !== message) setText(note, message);
    }
    if (d.key === "bukonFusion" && !busy) { const nodes = [...card.querySelectorAll("button:not(:disabled), select, input")]; return choose(nodes, [h.body, ...nodes]); }
    if (["enchant", "bukonFusion"].includes(d.key) && card.classList.contains("ui-confirm")) {
      return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled), .ui-sheet-foot .ui-btn.k-danger:not(:disabled)"), [h.body, ...first(card, ".ui-sheet-foot .ui-btn.k-ghost")]);
    }
    if (["enchant", "bukonFusion"].includes(d.key) && card.classList.contains("ec-sheet")) {
      const actions = first(card, st.step === 0 ? ".ec-extract:not(:disabled)" : ".ec-write:not(:disabled)");
      return choose(actions, [h.body, ...first(card, ".ui-sheet-foot .ui-btn.k-ghost")]);
    }
    if (d.key === "prologueFormation" && card.querySelector(".pt-sw-card")) return choose(first(card, `[data-swap-job="${formationMove().targetJob}"]`));
    if (d.key === "prologueAppraise" && card.classList.contains("ap-sheet")) return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary, .ui-sheet-foot .ui-btn.k-ghost, .ap-stage"));
    // 門衛の忠告は、本文のスクロールと支度に戻る操作も受け付ける。
    if (card.classList.contains("dp-brief-sheet")) return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary"), [h.body, ...first(card,".ui-sheet-foot .ui-btn.k-ghost")]);
    if (d.key === "soulChange" && card.classList.contains("ui-confirm")) {
      return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled)"), [h.body, ...first(card, ".ui-sheet-foot .ui-btn.k-ghost")]);
    }
    if (h.kind === "celebrate" || card.classList.contains("ui-confirm") || stepDone(s)) return forward();
    if (card.classList.contains("pt-name-sheet")) {
      return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary"), first(card, ".pt-name-in, .pt-name-rnd"));
    }
    if (card.classList.contains("pt-res-sheet")) return choose(first(card, ".pt-res-add"));
    if (card.classList.contains("pt-pick-sheet") && ["createThree", "createFourth", "createFifth", "createSixth"].includes(d.key)) {
      const jobs = d.key === "createThree" ? ["fighter", "priest", "thief"] : [game.prologueJob()];
      const rows = jobs.flatMap((job) => first(card, `.pt-soulrow[data-job="${job}"]`));
      return choose(rows);
    }
    if (h.opts.banner === "魂融合") return choose(first(card, ".sp-fuse-material"), first(card, ".sp-fuse-all"));
    if (d.key === "insight") {
      if (card.classList.contains("stg-sheet")) return st.step === 0 ? choose(first(card, ".stg-codex"), [h.body]) : forward(true);
      if (card.classList.contains("cx-sheet") && !st.ev.codexMonViewed) return choose(first(card, ".pl-card[data-tutorial-mon]"), [h.body]);
      return forward(true);
    }
    if (h.opts.banner === "宿し技をえらぶ") {
      const rows = first(card, ".ui-row");
      const close = forward();
      return choose(st.ev.subPick ? [close.target, ...rows] : rows,
        [h.body, ...rows, ...(st.ev.subPick ? close.allowed : [])]);
    }
    if (d.key === "soulChange" && card.classList.contains("sp-pick-sheet")) {
      // 候補の能力を確かめてから、宿すか今の職業のままにするか選ぶ。
      const rows = first(card, ".sp-srow:not(.cur) .sp-srow-main:not(:disabled)");
      const jobs = new Set(newJobSouls().map((soul) => soul.clsKey));
      const fresh = rows.filter((node) => jobs.has(node.closest(".sp-srow").dataset.job));
      const close = forward();
      return choose([...fresh, ...rows, ...(st.ev.soulPreviewed ? [close.target] : [])], [h.body, ...rows, ...(st.ev.soulPreviewed ? close.allowed : [])]);
    }
    if (d.key === "sub1" && card.classList.contains("sp-pick-sheet")) {
      // 魂は一つに決め打ちせず、一覧を動かして好きな候補を選べる。
      const rows = first(card, ".sp-srow:not(.cur) .sp-srow-main:not(:disabled)");
      const spare = rows.filter(node => !node.closest(".sp-srow").classList.contains("taken"));
      const close = forward();
      return choose([...spare, ...rows, close.target], [h.body, ...rows, ...close.allowed, ...first(card, ".ui-sheet-foot .ui-btn:not(:disabled)")]);
    }
    if (card.querySelector(".sp-srow")) {
      if (d.key === "fusion") return choose(first(card, '.sp-srow[data-job="fighter"] .sp-pick-fuse'));
      let rows = first(card, ".sp-srow:not(.cur) .sp-srow-main:not(:disabled)");
      if (d.key === "changeJob") rows = rows.filter((n) => (st.base.jobs || []).includes(n.closest(".sp-srow").dataset.job));
      return choose(rows);
    }
    // 装備者の選択や取引の確認も、次へ進む1つの選択を示す。
    const primary = first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled)");
    const rows = first(card, ".ui-row");
    return primary.length || rows.length ? choose([...primary, ...rows]) : forward();
  }
  if (d.key === "prologueFormation" && st.step === 0) {
    const { mover } = formationMove(), job = soulByUid(mover?.primary)?.clsKey;
    const selected = document.querySelector(".pt-mansion-head")?.dataset.job === job;
    return choose(first(document, selected ? ".pt-mansion-manage" : `.pt-form [data-drop="p${G_().party.indexOf(mover)}"]`));
  }
  if (["createThree", "createFourth", "createFifth", "createSixth"].includes(d.key)) {
    const count = allDolls().length;
    return choose(first(document, count ? `.pt-form [data-drop="e${count}"]` : ".pt-empty button"));
  }
  if (d.key === "bukonFusion") { const nodes = [...document.querySelectorAll(".bk-panel button:not(:disabled), .bk-panel input")]; return choose(nodes, nodes); }
  const selectors = d.key === "buyEquipment" ? [".wpc-buy-main:not(:disabled)"] : s?.target || [];
  return choose(selectors.flatMap((selector) => first(document, selector)));
}
// スキップは画面や手順に関わらず操作制限の対象にしない。
function skipControls() {
  return [...document.querySelectorAll('button, [role="button"], [data-action="skip"]')].filter((node) =>
    !node.disabled && node.getClientRects().length &&
    (node.matches('[data-action="skip"], .op-skip, .iv-skip, .test-play-banner button') ||
      unphrase(node.getAttribute("aria-label") || node.textContent || "").includes("スキップ")));
}
function restrictTutorialInput(event) {
  // 保存・通信復旧・画像再取得などの操作は、手ほどきの指定先より優先する。
  if (event.target?.closest?.(".cloud-gate, .legal-dialog, #local-save-gate, #media-splash, .image-loading, .game-update-notice, #boot-notice")) return;
  if (G_()?.testPlay && event.target?.closest?.(".test-play-banner, .playtest-records")) return;
  const skips = skipControls();
  if (skips.some((node) => node === event.target || node.contains(event.target))) return;
  const guide = tutorialControls();
  if (!guide) return;
  const allowed = [...new Set([...guide.allowed, ...skips])];
  if (event.type === "keydown" && event.key === "Tab") {
    event.preventDefault(); event.stopImmediatePropagation();
    const index = allowed.indexOf(document.activeElement);
    const next = event.shiftKey ? (index - 1 + allowed.length) % allowed.length : (index + 1) % allowed.length;
    allowed[next]?.focus();
    return;
  }
  const inside = allowed.some((node) => node === event.target || node.contains(event.target));
  if (inside && !(event.type === "keydown" && event.key === "Escape")) return;
  if (event.cancelable) event.preventDefault();
  event.stopImmediatePropagation();
}

export function install() {
  registerUI({
    tutorialIreneLines: ireneGuidance,
    tutorialMansionVisited: mansionVisited,
    tutorialMansionGreeting: mansionGreeting,
    tutorialShopVisited: () => facilityVisited("shop"),
    tutorialFacilityVisited: facilityVisited,
    tutorialGateVisited: gateVisited,
    tutorialActive: () => busy || !!curDef(),
    tutorialPending: pending,
    tutorialResume: resume,
    tutorialSettingsVisited: resume,
    tutorialAfterReport: afterReport,
    tutorialAfterReturn: afterReturn,
    tutorialEvent: onEvent,
    tutorialFree: isFree,
  });
  if (hasDOM()) {
    for (const type of ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "contextmenu", "keydown"]) {
      window.addEventListener(type, restrictTutorialInput, { capture: true, passive: false });
    }
  }
  // 画面が描き替わるたびに見張る (手順の完了・光らせる所の付け直し)。属性の変化は見ない (光らせる class で回らないように)
  if (hasDOM() && typeof MutationObserver === "function" && document.body) {
    new MutationObserver(() => { if (tutState() && (tutState().cur || pending() || busy)) schedule();  })
      .observe(document.body, { childList: true, subtree: true });
  }
}

// 確かめ用
export const _TUTS = TUTS;

// 試遊では選択した手ほどきだけを、実際の操作で確かめる。
export const testTutorials = TUTS.map(({ key, name }) => ({ id: "tutorial:" + key, kind: "tutorial", group: "操作の手ほどき", name }));
export function startTestTutorial(key) {
  if (!G_()?.testPlay || !TUT_MAP[key]) return false;
  G_().testTutorial = key;
  UI.shell?.setTab?.("hub");
  game.renderTown?.();
  return resume();
}
