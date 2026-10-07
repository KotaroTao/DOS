// ===== 手ほどき — 層の踏破で解放された要素を、その場で1度ずつ実際に触って覚える =====
// 王への踏破報告で新しい要素 (魂融合 / サブ魂 / 酒場の噂話 / 控えの結社 ― 開く時期は game.js FEATURES) が解放されると、
// 語りを閉じた直後に、その要素の手ほどきが始まる。手ほどきを終えるまで迷宮の門は開かない
// (game.js blockForTutorial ← 出撃シート・departNow・奈落)。
//   流れ: 導入 (館の主イレーヌ / 酒場の情報屋の語り) → 手順 (実際に操作する。イレーヌの台詞で今の手順を案内し、
//         押す所が光る) → 完了のカード。手順の完了は状態 (done) か、UI から届く合図 (on = tutorialEvent) で判定する。
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
import { playIreneScene, sceneActive, isGreeted } from "./irene.js";
import { vignetteCanvas } from "../townart.js";
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
  // 旧セーブの新職業案内は、器を買う手ほどきに切り替える。
  if (t.cur === "changeJob") { t.cur = null; t.step = 0; t.ev = {}; t.base = {}; }
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
// 融合できる人業 (メイン魂に同職の余りがある)。隊 → 控えの順
function fusableDoll() {
  if (!game.fuseCandidates) return null;
  return allDolls().find((d) => d.primary != null && game.fuseCandidates(d.primary).length > 0) || null;
}
function spareSouls() {
  const worn = wornSet();
  return (G_().souls || []).filter((s) => !worn.has(s.uid) && (G_().party || []).some((d) => !game.soulSlotConflict || !game.soulSlotConflict(d, s.uid, "sub0")));
}
// 融合できる魂がどこかにある (宿していない魂どうしでもよい)
function anyFusable() {
  if (!game.fuseCandidates) return false;
  return (G_().souls || []).some((s) => game.fuseCandidates(s.uid).length > 0);
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
  if (UI.openTavern) return UI.openTavern("talk"); // 噂話は「噂と顔ぶれ」の区分
  if (UI.shell && UI.shell.openPage) UI.shell.openPage("tavern", { parentTab: "hub" });
}

function initialJobsReady(jobs) {
  const worn = new Set(allDolls().map((d) => soulByUid(d.primary)?.clsKey));
  return jobs.every((k) => worn.has(k));
}
const fourthReady = () => initialJobsReady(["fighter", "priest", "thief", "mage"]);
const fourthSheetOpen = (selector) => hasDOM() && !!document.querySelector(selector);

function newJobSouls() {
  const initial = new Set(["fighter", "priest", "thief", "mage"]);
  return (game.soulRepresentatives ? game.soulRepresentatives() : G_().souls || []).filter((s) => !initial.has(s.clsKey));
}
function grantNewJobGift() {
  const st = tutState();
  if (st.newJobGift) return;
  game.grantRedSoul(50, "tutorial");
  st.newJobGift = true;
  if (game.autosave) game.autosave(true);
}
let visitTimer = null;
function atMansion() {
  const G = G_();
  return G && G.state === "town" && G.town?.tab === "party" && !G.town.page && !G.town.facility;
}
const MANSION_TARGET = ['.ui-tab[data-key="party"]'];
function mansionVisited() {
  const st = tutState();
  if (!st || !atMansion() || !isGreeted()) return;
  if (!st.done.newJobParty && newJobSouls().length && G_().msq?.n >= 1) st.jobVisit = true;
  if (visitTimer) return;
  visitTimer = setTimeout(() => {
    visitTimer = null;
    if (!atMansion() || busy || sceneActive() || sheetDepth() > 0 || game.isTitleActive?.() || game.isOpeningActive?.()) return;
    const p = pending();
    if (p?.who === "irene" && (!p.started || !tutorialControls()?.target)) resume();
  }, 300);
}

// ---- 手ほどきの定義 (解放の順) ----
//   at = 解放の踏破報告数 / open() = 解放済みか / used() = もう使ったことがある (旧セーブは済み扱い)
//   prepare() = 始める時 (練習用の素材を預ける。導入に添える一言を返す)
//   intro(note) = 導入 / steps = [{ text, hint, go(), target[], done?(), on?, skip?() }] / outro = 完了のカードの行
const TUTS = [
  {
    key: "repairSoul", name: "砕けた魂の修復", who: "irene",
    open: () => !!tutState().repairPending,
    used: () => false,
    intro: () => [
      ["……お帰りなさい。魂の灯が、途切れてしまったのですね。", "けれど、あの子たちとの別れを決めるには、まだ早いのです。"],
      ["器が砕けると、宿っていた魂も砕け、深い眠りに落ちます。", "街へ戻るだけでも、宿で休むだけでも、その灯は戻りません。"],
      ["この館なら、わたしが砕けた魂をつなぎ直せます。", "その子を選び、『砕けた魂を修復』を押してください。金貨を頂きますが、魂も器も、力を取り戻して立ち上がります。"],
      ["皆が倒れた時は、器が迷宮に残されます。ほかの冒険者が連れ帰るまで、お待ちください。", "深い階ほど時がかかります。赤い魂を捧げれば、連れ帰りを早められますが、修復は器が届いてからです。"],
      ["金貨が足りなければ、今すぐ修復しなくても大丈夫です。", "あの子たちの名を、忘れずにいてください。もう一度呼びかける日まで、わたしがお預かりします。"],
    ],
    afterIntro() {
      const d = allDolls().find((d) => d.isDoll && !d.alive);
      if (d && UI.openParty) UI.openParty(d, { context: "town" });
    },
    // 連れ帰り待ち・金貨不足でも、説明を聞けば手ほどきを終えられる。
    steps: [{ text: "砕けた人業の状態を確認する", hint: "器が届いたら、金貨で『砕けた魂を修復』", done: () => true }],
    outro: ["砕けた魂は、人業の館で金貨を払って修復できる。全滅で残された器は、連れ帰りを待とう。"],
  },
  {
    key: "createThree", name: "三体の人業を仕立てる", who: "irene",
    open: () => G_().msq?.n === 0 && G_().msq.granted && G_().msq.stage !== "fourth",
    used: () => initialJobsReady(["fighter", "priest", "thief"]),
    intro: () => [["王さまから授かった三つの魂を、器に宿しましょう。", "最初の三体は無料でお仕立てします。"], ["『人業を仕立てる』から魂を選び、名前を与えてください。", "戦士・僧侶・盗賊が揃ったら、王さまにご報告を。"]],
    steps: [{ text: "戦士・僧侶・盗賊の人業を仕立てる", hint: "人業の館 → 人業を仕立てる → 魂を選ぶ → 名前を決める", go: () => game.goMakeDoll(), target: [".pt-empty button", ".pt-soulrow", ".pt-res-sw button"], done: () => initialJobsReady(["fighter", "priest", "thief"]) }],
    outro: ["三体の人業が目覚めた。王宮で王に報告しよう。"],
  },
  {
    key: "createFourth", name: "赤い魂で四体目を仕立てる", who: "irene",
    open: () => G_().msq?.n === 0 && G_().msq.stage === "fourth",
    used: () => initialJobsReady(["fighter", "priest", "thief", "mage"]),
    intro: () => [["今度は、赤い魂で器をお買い求めください。", "四体目のお代は、赤い魂30です。"], ["新しい器には、王さまから授かった魔導士の魂を宿しましょう。", "名前を与えたら、もう一度王さまにご報告ください。"]],
    steps: [
      { text: "顔アイコンの空き枠『＋』を押す", hint: "後衛の一番左にある『＋』を押してください", lock: true, go: () => UI.enterMansion && UI.enterMansion(), target: ['.pt-form [data-drop="e3"]'], done: () => fourthSheetOpen(".pt-res-sheet, .pt-pick-sheet, .pt-name-sheet") || fourthReady() },
      { text: "『人業を仕立てる』を押す", hint: "赤い魂30で、四体目の器を購入します", lock: true, go: () => UI.openReserve && UI.openReserve(), target: [".pt-res-sheet .pt-res-add"], done: () => fourthSheetOpen(".pt-pick-sheet, .pt-name-sheet") || fourthReady() },
      { text: "魔導士の魂を選ぶ", hint: "光っている『魔導士の魂』を押してください", lock: true, go: () => UI.openCreateDoll && UI.openCreateDoll(), target: ['.pt-pick-sheet .pt-soulrow[data-job="mage"]'], done: () => fourthSheetOpen(".pt-name-sheet") || fourthReady() },
      { text: "名前を決めて『生成する』を押す", hint: "名前を入力し、赤い魂30を支払って仕立てます", lock: true,
        go: () => { const soul = (G_().souls || []).find((s) => s.clsKey === "mage"); if (soul && UI.openCreateName) UI.openCreateName(soul.uid); },
        target: [".pt-name-sheet .ui-sheet-foot .ui-btn.k-primary"],
        allow: [".pt-name-sheet .pt-name-in", ".pt-name-sheet .pt-name-rnd", ".pt-name-sheet .ui-sheet-foot .ui-btn.k-primary"], done: fourthReady },
    ],
    outro: ["四体目の魔導士が目覚めた。王に報告しよう。"],
  },
  {
    key: "buyEquipment", name: "商店で装備を整える", who: "shop", silent: true,
    open: () => G_().msq?.n >= 1 && !(G_().stats?.runs > 0),
    used: () => false,
    intro: () => ["王から授かった金貨500で、人業の装備を整えよう。", "商店の『買う』で武器や防具を選ぶ。『買って装備』なら、そのまま人業に持たせられる。", "購入は任意。必要な分だけ自由に買い、支度ができたら画面下の『迷宮』を選ぼう。"],
    steps: [{ text: "必要な装備を自由に購入する", hint: "購入は任意。支度ができたら画面下の『迷宮』を選ぶ", go: () => UI.openShop && UI.openShop("buy", { cat: "weapon" }), done: () => G_().town?.tab === "shop" }],
    outro: ["支度ができたら、画面下の『迷宮』を選ぼう。"],
  },
  {
    key: "firstDive", name: "初めて迷宮に入る", who: "gate", manual: true,
    open: () => G_().msq?.n >= 1 && !!tutState().done.buyEquipment,
    used: () => (G_().stats?.runs || 0) > 0,
    intro: () => ["四体の人業が揃った。支度ができたら、最初の迷宮へ向かおう。", "出撃の画面で『忘れられた地下墓地』と隊の備えを確認し、『門をくぐる』を押す。"],
    steps: [{ text: "忘れられた地下墓地の門をくぐる", hint: "出撃 → 迷宮と隊の備えを確認 → 門をくぐる", go: () => UI.openDeparture && UI.openDeparture(), target: [".dp-cta"], on: "dungeonEntered" }],
    outro: ["迷宮へ踏み出した。師の足跡を探そう。"],
  },
  {
    key: "newJobParty", name: "新しい器で仲間を増やす", who: "irene", silent: true,
    open: () => G_().msq?.n >= 1 && !!tutState().jobVisit && newJobSouls().length > 0,
    used: () => newJobSouls().some((s) => allDolls().some((d) => d.primary === s.uid)),
    prepare() {
      tutState().base.jobs = newJobSouls().map((s) => s.clsKey);
      grantNewJobGift();
    },
    intro: () => [
      ["新しい職業の魂を持ち帰られたのですね。", "新しい人業の器を購入し、その魂を宿して仲間を増やしましょう。"],
      ["初めての職業の魂を持ち帰ったお祝いに、赤い魂50個をお渡しします。", "この赤い魂で、新しい仲間を迎えてください。"],
      ["器は、この館で赤い魂と引き換えにお仕立てします。", `今のお代は、赤い魂${game.emptyDollCost?.() || 0}です。足りない時は、街の『赤い魂の祠』で入手できます。`],
      ["『人業を仕立てる』を開いたら、宿す魂は自由にお選びください。今は宿さずに閉じてもかまいません。", "パーティには六体まで連れてゆけます。満員なら、新しい仲間は控えで待ちます。"],
      ["同じ職業のメイン魂を宿す仲間は、一つのパーティに一体だけ。", "新しい職業の仲間を加え、迷宮に備えましょう。"],
    ],
    steps: [{
      text: "『人業を仕立てる』で魂の一覧を開く", hint: "人業の館 → 控え・＋ → 人業を仕立てる。その後は自由に選ぶか、閉じてよい",
      go: () => UI.openReserve?.(), target: [".pt-res-add", ".pt-form .pt-empty-slot", ".pt-res-sw button"],
      on: "newJobSoulPickerOpened", skip: () => (G_().redSoul || 0) < (game.emptyDollCost?.() || 0),
    }],
    outro: ["新しい器に新しい職業の魂を宿せば、仲間を増やせる。", "赤い魂が足りない時は祠で集めてから、『控え・＋』の『人業を仕立てる』へ。満員なら控えの仲間と入れ替えよう。"],
  },
  {
    key: "soulChange", name: "魂の付け替え", who: "irene",
    open: () => !!game.worldState?.().reported.w02,
    used: () => false,
    prepare: () => null,
    intro: () => [
      ["宿す魂を変えれば、今いる人業も別の職業として戦えます。魂の育ちは残り、外した魂も失われません。", "まずは『魂を付け替える』の一覧を開いて、閉じてください。実際の付け替えは、その後に自由に行えます。"],
      ["新しい職業で使えない装備は外れます。同じ職業のメイン魂は、パーティに一つだけです。", "詳しい説明は、魂の区分の『魂の扱い方』で、いつでも確かめられます。"],
    ],
    steps: [{ text: "魂の一覧を開いて確認し、閉じる", hint: "人業の館 → 魂 → 魂を付け替える → 閉じる", go: () => goSoulSeg(), target: [".sp-change"], on: "soulChangeViewed" }],
    outro: ["魂の付け替えが解放された。魂の区分の『魂を付け替える』から、いつでも変更できる。"],
  },
  {
    key: "fusion", name: "魂融合", who: "irene",
    open: () => !!(game.featureUnlocked && game.featureUnlocked("fusion")),
    used: () => ((G_().stats || {}).fusions || 0) > 0,
    // 素材の有無に関わらず、戦士の魂を2つ預ける (宿していなくても、2つどうしで融合できる)
    prepare() {
      tutState().base.fusions = (G_().stats || {}).fusions || 0;
      if (!grantSoul("fighter")) return null;
      grantSoul("fighter");
      return `${jobLabel("fighter")}の魂をふたつ`;
    },
    intro: (gift) => [
      ["同じ職の余った魂を融合すると、魂の格が上がり、Lvの上限や技が増えます。素材の魂は消え、その力は残る魂へ移ります。", "『魂』の区分の『魂融合』から、一度試してみてください。"],
      gift ? [`練習に、${gift}お預けします。`, "宿している戦士の魂に溶かしても、ふたつを溶かし合わせてもかまいません。詳しい説明は『魂の扱い方』で読めます。"]
        : ["余っている同じ職の魂を、融合してみてください。", "詳しい説明は、魂の区分の『魂の扱い方』で、いつでも確かめられます。"],
    ],
    steps: [{
      text: "魂融合で、余っている魂を溶かす",
      // 宿している魂に融合できるなら魂の区分の『魂融合』、無ければ『魂を付け替える』の一覧の『魂融合』
      get hint() {
        return fusableDoll() ? "人業の館 → 魂の区分 →『魂融合』→ 素材の魂を選ぶ" : "魂の区分 →『魂を付け替える』→ 戦士の魂の『魂融合』";
      },
      go: () => goSoulSeg(fusableDoll()), target: [".sp-fuse.hot", ".sp-pick-fuse", ".sp-change"],
      done: () => ((G_().stats || {}).fusions || 0) > (tutState().base.fusions || 0),
      skip: () => !anyFusable(),
    }],
    outro: ["魂を融合すると、魂の強さとLv上限が上がる。一定数以上の魂を融合すると魂がランクアップ。"],
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
      ["王さまから伺いました。", "人業に、もうひとつ魂を宿せるようになったのですね。"],
      ["本来の魂 (メイン魂) のほかに、もうひとつ。", "これを『サブ魂』と呼びます。"],
      ["サブ魂は、覚えた技やパッシブを貸してくれます。", "それに、その魂の能力の一部が器に足されます。魂のランクが高いほど多くなります。"],
      ["貸してくれる数は、魂のランクで決まります。", "R1-2はひとつ、R3-4はふたつ、R5なら三つです。"],
      gift ? [`練習に、${gift}お預けします。`, "空いている魂を、サブ魂の枠に宿してみてください。"]
        : ["隊に出していない魂を、", "サブ魂の枠に宿してみてください。"],
      ["宿したら『技』で、借りる技を選びます。", "済ませるまで、王さまは門をお開けになりません。"],
    ],
    steps: [
      {
        text: "サブ魂の枠に魂を宿す", hint: "魂の区分 → サブ魂1 の『＋ 魂を宿す』",
        go: () => goSoulSeg(null), target: [".sp-sub.empty .sp-tile-main", ".sp-sub .sp-tile-main"],
        done: () => !!dollWithSub(),
        skip: () => !dollWithSub() && !spareSouls().length,
      },
      {
        text: "サブ魂から借りる技を選ぶ", hint: "サブ魂の札の『技』→ 選んで閉じる",
        go: () => goSoulSeg(dollWithSub()), target: [".sp-tile-sk"],
        on: "subSkill",
        skip: () => !dollWithSub(),
      },
    ],
    outro: ["メイン魂と別の職の魂を宿せば、職の垣根を越えた一手になる。", "借りる技は、サブ魂の札の『技』からいつでも選び直せる。"],
  },
  {
    key: "tavern", name: "酒場の依頼", who: "tavern",
    open: () => !!game.featureUnlocked?.("tavern"),
    used: () => (G_().stats?.questsDone || 0) > 0 || !!G_().quest?.active?.length || Object.keys(G_().quest?.fixed || {}).length > 0,
    prepare: () => null,
    intro: () => [
      "酒場『沈まぬ灯』へようこそ。掲示板には、迷宮での討伐や品の納品などの依頼が集まる。",
      "依頼の札で条件と報酬を確かめてから受けよう。受けられる依頼は、依頼人の頼みも合わせて六件までだ。",
      "受けた依頼は『受注』で確認できる。条件を満たしたら酒場で報告し、報酬を受け取ろう。掲示板は迷宮から帰るたびに貼り替わるが、受けた依頼は残る。",
    ],
    steps: [{
      text: "酒場の掲示板を見る", hint: "酒場 →『掲示板』",
      go: () => UI.openTavern?.("board"), target: [".fc-qarea"], on: "tavernBoard",
    }],
    outro: ["掲示板の依頼は、札を選ぶと詳しく読める。次の探索で果たせそうな依頼を探そう。", "噂話の情報屋は、さらに王への報告を重ねると口を利くようになる。"],
  },
  {
    key: "rumor", name: "酒場の噂話", who: "tavern",
    open: () => !!(game.featureUnlocked && game.featureUnlocked("rumor")),
    used: () => { const G = G_(); return !!(G.rumor || G.activeRumor || (G.rumorCooldown || 0) > 0); },
    prepare: () => null,
    intro: () => [
      "酒場「沈まぬ灯」の情報屋が、そなたに口を利くようになった。",
      "金貨を握らせれば、次に潜る迷宮で起こる異変 ── 予兆を語ってくれる。噂は、次に潜った迷宮で現実になる。",
      "一度聞けば、次の噂までしばらく間が空く。最初の一度は、情報屋のおごりだ。",
    ],
    steps: [{
      text: "酒場で噂を聞く", hint: "酒場 →『噂を聞く』(初回は無料)",
      go: goTavern, target: [".fc-rumor-btn"],
      done: () => { const G = G_(); return !!(G.rumor || G.activeRumor); },
    }],
    outro: ["情報屋は「いま選んでいる迷宮」を読んで語る。潜る迷宮を選んでから聞こう。"],
  },
  {
    key: "order", name: "控えの結社", who: "irene",
    open: () => !!(game.featureUnlocked && game.featureUnlocked("order")),
    used: () => { const o = G_().order; return !!(o && Array.isArray(o.picks) && o.picks.length); },
    prepare: () => null,
    intro: () => [
      ["控えの結社が開かれたそうですね。"],
      ["隊に出していない魂も、ただ眠っているわけではありません。", "席に着けた魂は、その力の一部を人業のみなに分けてくれます。"],
      ["『魂』の区分の『控えの結社』を開いてみてください。"],
    ],
    steps: [{
      text: "控えの結社を開く", hint: "魂の区分 →『控えの結社』",
      go: () => goSoulSeg(null), target: [".sp-order .sp-tile-main"],
      on: "order",
    }],
    outro: ["席に着けた魂の能力の一部が全員に加わる。ランクが高い魂ほど、分ける割合も大きい。"],
  },
];
const TUT_MAP = Object.fromEntries(TUTS.map((t) => [t.key, t]));

// ---- 進み具合 ----
// 済ませていない手ほどき (解放の順)。始めていない旧セーブの分は、もう使っていれば済み扱い
function dueKeys() {
  if (G_()?.testPlay) return [];
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
  const key = st && st.cur && keys.includes(st.cur) ? st.cur : keys[0];
  if (!key) return null;
  const d = TUT_MAP[key];
  const step = st.cur === key ? d.steps[st.step] || d.steps[0] : d.steps[0];
  const arrival = d.who === "irene" && !atMansion();
  return { key, name: d.name, who: d.who, arrival,
    text: arrival ? "人業の館を選択してください" : step.text,
    hint: arrival ? "画面下の『人業の館』を選ぶと、イレーヌがご案内します" : step.hint,
    started: st.cur === key };

}

// UI.tutorialFree(key): その手ほどきの最中か (酒場の噂の初回を無料にする)
function isFree(key) { const st = tutState(); return !!st && st.cur === key && !st.done[key]; }

// ---- 始める・続ける ----
let busy = false; // 導入の語り・完了のカードの最中
function inTown() { const G = G_(); return !!G && G.state === "town"; }

// UI.tutorialResume(): 済ませていない手ほどきを始める (始めていれば今の手順へ案内する)
function resume() {
  if (!inTown() || busy || sceneActive()) return false;
  const p = pending();
  if (!p) return false;
  const st = tutState();
  const d = TUT_MAP[p.key];
  if (p.arrival) { updateGuidance(); schedule(); return true; }
  if (d.who === "irene" && !isGreeted()) { if (UI.enterMansion) UI.enterMansion(); return true; }
  if (st.cur !== p.key) return start(d);
  // 更新前から進行中の手ほどきにも、お祝いを一度だけ渡す。
  if (d.key === "newJobParty") grantNewJobGift();
  goStep(true);
  return true;
}
function start(d) {
  const st = tutState();
  st.cur = d.key; st.step = 0; st.ev = {}; st.base = {};
  const gift = safe(() => d.prepare(), null);
  if (game.autosave) game.autosave(true);
  busy = true;
  clearGlow(); updateGuidance();
  const after = () => {
    busy = false;
    if (gift) toast(`${gift}預かった (手ほどき用)`, { tone: "good" });
    setTimeout(() => { safe(() => d.afterIntro?.(), null); goStep(true); }, 200); // 語りを閉じたタップが、開いた先の画面に届かないように
  };
  if (d.who === "irene") playIreneScene(d.intro(gift), after);
  else introSheet(d, after);
  return true;
}
// 酒場の手ほどきの導入 (情報屋の札)
function introSheet(d, done) {
  let art = null;
  try { art = vignetteCanvas(d.who === "shop" ? "shop" : d.who === "gate" ? "palace" : "tavern"); } catch (e) { art = null; }
  let fired = false;
  const go = () => { if (fired) return; fired = true; done(); };
  const h = sheet.open({
    kind: "choice", banner: "手ほどき", title: d.name, art, lines: d.intro(),
    footer: [{ label: d.who === "shop" ? "商店へ" : d.who === "gate" ? "出撃へ" : "酒場へ", kind: "primary", size: "lg", onTap: (s) => s.close("ok") }],
    onClose: go,
  });
  if (!h || !h.el) go();
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
  st.cur = null; st.step = 0; st.ev = {}; st.base = {};
  if (d.key === "repairSoul" && st.repairResume) {
    Object.assign(st, st.repairResume);
    delete st.repairResume;
  }
  if (game.autosave) game.autosave(true);
  clearGlow();
  updateGuidance();
  if (d.silent) { schedule(); return; }
  busy = true;
  const after = () => {
    busy = false;
    if (game.renderTown && inTown()) game.renderTown();
    // 続けて済ませる手ほどきがあれば、そのまま始める
    if (pending() && !TUT_MAP[pending().key]?.manual) setTimeout(() => resume(), 240);
  };
  sfx("victory");
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
function afterReturn() {
  const st = tutState();
  if (!st || st.done.repairSoul || !allDolls().some((d) => d.isDoll && !d.alive)) return false;
  st.repairPending = true;
  if (st.cur && st.cur !== "repairSoul") {
    st.repairResume = { cur: st.cur, step: st.step, ev: st.ev, base: st.base };
    st.cur = null; st.step = 0; st.ev = {}; st.base = {};
  }
  if (UI.enterMansion) UI.enterMansion();
  if (game.autosave) game.autosave(true);
  mansionVisited();
  return true;
}

// UI.tutorialEvent(name): UI から届く合図 (サブ魂の技を開いた・結社を開いた…)
function onEvent(name) {
  const st = tutState();
  if (!st || !st.cur) return;
  st.ev[name] = true;
  // 一覧を開いた時点で案内を終え、選択・名前入力・中止を自由にする。
  if (name === "newJobSoulPickerOpened" && st.cur === "newJobParty") {
    finish(TUT_MAP.newJobParty);
    return;
  }
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
  // 更新前のセーブで魂の選択・名前入力まで進んでいる場合も制限を解除する。
  if (tutState()?.cur === "newJobParty" && document.querySelector(".pt-pick-sheet .pt-soulrow, .pt-name-sheet")) {
    onEvent("newJobSoulPickerOpened");
  }
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
    if (target?.closest(".pt-name-sheet")) return ["この子に名前を与えてください。", "『生成する』を押すと、魂を宿した人業が目覚めます。"];
    if (target?.dataset.job) return [`光っている『${jobLabel(target.dataset.job)}の魂』をお選びください。`, "最初の三体は、無料でお仕立てします。"];
    if (target?.classList.contains("pt-res-add")) return ["光っている『人業を仕立てる』を押してください。", "残る魂も、ひとつずつ器に宿しましょう。"];
    if (target?.dataset.drop) return ["顔アイコンの光っている空き枠『＋』を押してください。", "次の人業をお仕立てしましょう。"];
  }
  if (p.key === "createFourth") {
    const index = tutState().cur === p.key ? tutState().step : 0;
    return [
      ["後衛の一番左、顔アイコンの空き枠『＋』を押してください。", "光っているところから、四体目をお仕立てしましょう。"],
      ["光っている『人業を仕立てる』を押してください。", "四体目の器のお代は、赤い魂30です。"],
      ["新しい器には、魔導士の魂を宿しましょう。", "光っている『魔導士の魂』をお選びください。"],
      ["この子に名前を与えてください。", "『生成する』を押すと、赤い魂30で人業が目覚めます。"],
    ][index] || null;
  }
  // 目標札の操作手順ではなく、通常会話と同じ口調で案内する。
  if (p.key === "fusion") return ["『魂融合』を開き、素材にする魂をお選びください。", "余っている同じ職の魂を、ひとつに溶かしましょう。"];
  if (p.key === "newJobParty") return ["『人業を仕立てる』で、魂の一覧を開いてみてください。", "その後は自由に選べます。今は宿さずに閉じてもかまいません。"];
  if (p.key === "soulChange") return ["『魂を付け替える』で、魂の一覧を開いてみてください。", "持っている魂を確かめたら、一覧を閉じてください。"];
  if (p.key === "sub1") return tutState().step === 1 ?
    ["サブ魂の札の『技』を開いてください。", "借りる技を選んだら、閉じてください。"] :
    ["サブ魂の枠を開き、魂をお選びください。", "隊に出していない魂を、宿してみてください。"];
  if (p.key === "order") return ["『魂』の区分の『控えの結社』を開いてみてください。", "席に着けた魂は、みなに力を分けてくれます。"];
  if (p.key === "repairSoul") return ["砕けた人業を選び、状態を確かめてください。", "器が届いたら、わたしが金貨で魂をつなぎ直します。"];
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
  // 商店での支度は自由。迷宮を自分で選ぶまで、次の手ほどきで操作を制限しない。
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
  const forward = () => {
    let nodes = first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled), .ui-sheet-foot .ui-btn.k-danger:not(:disabled)");
    if (!nodes.length) {
      let next = card.querySelector(".tut-next");
      if (!next) {
        next = button({ label: "次へ", kind: "primary", onTap: () => h.close("ok") });
        next.classList.add("tut-next"); h.foot.appendChild(next); h.foot.classList.remove("hidden");
      }
      nodes = [next];
    }
    return choose(nodes);
  };
  if (busy) return card ? forward() : null;
  if (p?.arrival) return choose(first(document, MANSION_TARGET[0]));
  if (!d) return choose(first(document, ".hb-goal-go"));
  const st = tutState(), s = curStep();
  if (card) {
    // 門衛の忠告は、本文のスクロールと支度に戻る操作も受け付ける。
    if (card.classList.contains("dp-brief-sheet")) return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary"), [h.body, ...first(card,".ui-sheet-foot .ui-btn.k-ghost")]);
    if (h.kind === "celebrate" || card.classList.contains("ui-confirm") || stepDone(s)) return forward();
    if (d.key === "newJobParty" && (card.classList.contains("pt-pick-sheet") || card.classList.contains("pt-name-sheet"))) return null;
    if (card.classList.contains("pt-name-sheet")) {
      return choose(first(card, ".ui-sheet-foot .ui-btn.k-primary"), first(card, ".pt-name-in, .pt-name-rnd"));
    }
    if (card.classList.contains("pt-res-sheet")) return choose(first(card, ".pt-res-add"));
    if (card.classList.contains("pt-pick-sheet") && ["createThree", "createFourth"].includes(d.key)) {
      const jobs = d.key === "createFourth" ? ["mage"] : ["fighter", "priest", "thief"];
      const rows = jobs.flatMap((job) => first(card, `.pt-soulrow[data-job="${job}"]`));
      return choose(rows);
    }
    if (h.opts.banner === "魂融合") return choose(first(card, ".sp-fuse-material"), first(card, ".sp-fuse-all"));
    if (h.opts.banner === "宿し技をえらぶ") {
      if (st.ev.subPick) return forward();
      return choose(first(card, ".ui-row"));
    }
    if (d.key === "soulChange" && card.classList.contains("sp-pick-sheet")) return forward();
    if (card.querySelector(".sp-srow")) {
      if (d.key === "fusion") return choose(first(card, ".sp-pick-fuse"));
      let rows = first(card, ".sp-srow:not(.cur) .sp-srow-main:not(:disabled)");
      if (d.key === "changeJob") rows = rows.filter((n) => (st.base.jobs || []).includes(n.closest(".sp-srow").dataset.job));
      return choose(rows);
    }
    // 装備者の選択や取引の確認も、次へ進む1つの選択を示す。
    const primary = first(card, ".ui-sheet-foot .ui-btn.k-primary:not(:disabled)");
    const rows = first(card, ".ui-row");
    return primary.length || rows.length ? choose([...primary, ...rows]) : forward();
  }
  if (d.key === "createThree") {
    const count = allDolls().length;
    return choose(first(document, count ? `.pt-form [data-drop="e${count}"]` : ".pt-empty button"));
  }
  const selectors = d.key === "buyEquipment" ? [".wpc-buy-main:not(:disabled)"] : s?.target || [];
  return choose(selectors.flatMap((selector) => first(document, selector)));
}
// スキップは画面や手順に関わらず操作制限の対象にしない。
function skipControls() {
  return [...document.querySelectorAll('button, [role="button"], [data-action="skip"]')].filter((node) =>
    !node.disabled && node.getClientRects().length &&
    (node.matches('[data-action="skip"], .op-skip, .iv-skip') ||
      unphrase(node.getAttribute("aria-label") || node.textContent || "").includes("スキップ")));
}
function restrictTutorialInput(event) {
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
    tutorialPending: pending,
    tutorialResume: resume,
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
