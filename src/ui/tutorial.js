// ===== 手ほどき — 層の踏破で解放された要素を、その場で1度ずつ実際に触って覚える =====
// 王への踏破報告で新しい要素 (魂融合 / サブ魂 / 酒場の噂話 / 控えの結社 ― 開く時期は game.js FEATURES) が解放されると、
// 語りを閉じた直後に、その要素の手ほどきが始まる。手ほどきを終えるまで迷宮の門は開かない
// (game.js blockForTutorial ← 出撃シート・departNow・奈落)。
//   流れ: 導入 (館の主イレーヌ / 酒場の情報屋の語り) → 手順 (実際に操作する。画面下の札に今の手順、
//         押す所が光る) → 完了のカード。手順の完了は状態 (done) か、UI から届く合図 (on = tutorialEvent) で判定する。
//   練習用の素材は導入で預ける (詰まないように): 魂融合は戦士の魂を必ず2つ (2つどうしでも融合できる)、
//   サブ魂は宿す魂が無ければ1つ。
//   どうしても行えない手順 (素材を使い切った等) は skip で飛ばし、手ほどき自体は必ず終えられる。
// 状態: G.tut = { done: {key:true}, cur, step, ev: {合図}, base: {始めた時の数} } (セーブされる)。
//   旧セーブ: 解放済みで未完の手ほどきは、その要素をもう使っていれば済み扱い、まだなら目標の札から始められる。
// 提供: UI.tutorialPending() / UI.tutorialResume() / UI.tutorialAfterReport() / UI.tutorialEvent(name) / UI.tutorialFree(key)
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, setText, sheet, toast, celebrate, sheetDepth } from "./kit.js";
import { unphrase } from "./phrase.js";
import { playIreneScene, ireneBond, sceneActive } from "./irene.js";
import { vignetteCanvas } from "../townart.js";
import { SOUL_CLASSES, soulByUid } from "../souls.js";

const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";
const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
const jobLabel = (k) => (SOUL_CLASSES[k] || {}).label || k;
// イレーヌの口調: 打ち解ける (親しさ2) までは です・ます
const warm = () => safe(() => ireneBond(), 0) >= 2;
const say = (polite, friendly) => (warm() ? friendly : polite);

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
  return (game.soulRepresentatives ? game.soulRepresentatives() : G_().souls || []).filter((s) => !worn.has(s.uid) && !(G_().party || []).some((d) => game.soulSlotConflict && game.soulSlotConflict(d, s.uid, "sub0")));
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
function newJobSouls() {
  const initial = new Set(["fighter", "priest", "thief", "mage"]);
  return (game.soulRepresentatives ? game.soulRepresentatives() : G_().souls || []).filter((s) => !initial.has(s.clsKey));
}
let visitTimer = null;
function mansionVisited() {
  const st = tutState();
  if (!st || st.done.changeJob || !newJobSouls().length || G_().msq?.n === 0) return;
  st.jobVisit = true;
  if (visitTimer) return;
  visitTimer = setTimeout(() => {
    visitTimer = null;
    if (G_().state !== "town" || G_().town?.tab !== "party" || G_().town?.page || busy || sceneActive() || sheetDepth() > 0) return;
    if (pending()?.key === "changeJob") resume();
  }, 300);
}

// ---- 手ほどきの定義 (解放の順) ----
//   at = 解放の踏破報告数 / open() = 解放済みか / used() = もう使ったことがある (旧セーブは済み扱い)
//   prepare() = 始める時 (練習用の素材を預ける。導入に添える一言を返す)
//   intro(note) = 導入 / steps = [{ text, hint, go(), target[], done?(), on?, skip?() }] / outro = 完了のカードの行
const TUTS = [
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
    steps: [{ text: "赤い魂30で器を買い、魔導士を仕立てる", hint: "人業の館 → 人業を仕立てる → 魔導士の魂 → 名前を決める", go: () => game.goMakeDoll(), target: [".pt-soulrow", ".pt-res-sw button"], done: () => initialJobsReady(["fighter", "priest", "thief", "mage"]) }],
    outro: ["四体目の魔導士が目覚めた。王に報告しよう。"],
  },
  {
    key: "buyEquipment", name: "商店で装備を購入する", who: "shop",
    open: () => G_().msq?.n >= 1 && !(G_().stats?.runs > 0),
    used: () => false,
    intro: () => ["王から授かった金貨500で、人業の装備を整えよう。", "商店の『買う』で武器や防具を選ぶ。『買って装備』なら、そのまま人業に持たせられる。"],
    steps: [{ text: "商店で武器か防具を買う", hint: "商店 → 買う → 武器・防具 → 買って装備", go: () => UI.openShop && UI.openShop("buy", { cat: "weapon" }), target: [".wpc-buy-main", ".wpc-buy-more"], on: "equipmentBought" }],
    outro: ["装備を購入できた。人業に装備させ、迷宮へ向かおう。"],
  },
  {
    key: "firstDive", name: "初めて迷宮に入る", who: "gate",
    open: () => G_().msq?.n >= 1 && !!tutState().done.buyEquipment,
    used: () => (G_().stats?.runs || 0) > 0,
    intro: () => ["四体の人業と装備が揃った。最初の迷宮へ向かおう。", "出撃の画面で『忘れられた地下墓地』と隊の備えを確認し、『門をくぐる』を押す。"],
    steps: [{ text: "忘れられた地下墓地の門をくぐる", hint: "出撃 → 迷宮と隊の備えを確認 → 門をくぐる", go: () => UI.openDeparture && UI.openDeparture(), target: [".dp-cta"], on: "dungeonEntered" }],
    outro: ["迷宮へ踏み出した。師の足跡を探そう。"],
  },
  {
    key: "changeJob", name: "魂を付け替えて職業を変える", who: "irene",
    open: () => G_().msq?.n >= 1 && !!tutState().jobVisit && newJobSouls().length > 0,
    used: () => false,
    prepare() { tutState().base.jobs = newJobSouls().map((s) => s.clsKey); },
    intro: () => [
      ["新しい職業の魂を持ち帰られたのですね。", "魂を宿す器があれば、新たな人業を仕立て、仲間を増やすことができます。"],
      ["人業が増えれば、迷宮の攻略も楽になります。", "パーティには六体まで連れてゆけます。"],
      ["新しい器は、この館で赤い魂と引き換えにお仕立てします。", "赤い魂は、街の『赤い魂の祠』で入手できます。"],
      ["今いる人業の魂を付け替えて、職業を変えることもできます。", "今回は、その方法をお教えしましょう。"], ["『魂』の区分から『魂を付け替える』を開き、新しい魂をお選びください。", "魂の育ちは魂に残ります。外した魂も、失われません。"], ["同じ職業を宿した人業が一緒に迷宮へ入ると、魂同士が干渉し、壊れてしまいます。", "メイン・サブを通じて、同じ職業の魂はパーティに一つだけ。重なる魂は、編成の時点で選べません。"]],
    steps: [{ text: "新しい職業の魂をメイン魂に宿す", hint: "人業の館 → 人業を選ぶ → 魂 → 魂を付け替える", go: () => goSoulSeg(), target: [".sp-change", ".sp-srow-main:not(:disabled)"], done: () => allDolls().some((d) => (tutState().base.jobs || []).includes(soulByUid(d.primary)?.clsKey)), skip: () => !newJobSouls().length }],
    outro: ["魂を付け替えれば、同じ器でも別の職業として戦える。迷宮に合わせて編成を考えよう。"],
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
      say(["王さまから、魂融合のお許しが出たそうですね。", "やり方は、わたしがお教えします。"],
        ["王さまから、魂融合のお許しが出たそうね。", "やり方は、わたしが手ほどきするわ。"]),
      say(["同じ職の魂どうしは、寄り添わせるとひとつに溶け合います。", "素材にした魂は消えますが、その力は残る方へ移ります。"],
        ["同じ職の魂どうしは、寄り添わせるとひとつに溶け合うの。", "素材にした魂は消えるけれど、その力は残る方へ移るわ。"]),
      say(["融合を重ねるほど、魂の格 (ランク) が上がります。", "Lvの上限が伸び、新しい技や加護を覚えますよ。"],
        ["融合を重ねるほど、魂の格 (ランク) が上がるの。", "Lvの上限が伸びて、新しい技や加護を覚えるわ。"]),
      gift ? say([`練習に、${gift}お預けします。`, "宿している戦士の魂に溶かしても、ふたつを溶かし合わせてもかまいません。"],
        [`練習に、${gift}預けておくわね。`, "宿している戦士の魂に溶かしても、ふたつを溶かし合わせてもいいわ。"])
        : say(["同じ職の魂が、もう余っているようですね。", "宿している魂に、溶かしてみてください。"],
          ["同じ職の魂が、もう余っているみたいね。", "宿している魂に、溶かしてごらんなさい。"]),
      say(["『魂』の区分の『魂融合』からです。", "済ませるまで、王さまは門をお開けになりません。"],
        ["『魂』の区分の『魂融合』からよ。", "済ませるまで、王さまは門を開けてくださらないわ。"]),
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
    outro: ["同じ職の魂が手に入ったら、融合して魂の格を上げよう。", "職業ごとの魂は1つだけ。余った同職の魂は、その魂へ融合しよう。"],
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
      say(["王さまから伺いました。", "人業に、もうひとつ魂を宿せるようになったのですね。"],
        ["王さまから聞いたわ。", "人業に、もうひとつ魂を宿せるようになったのね。"]),
      say(["本来の魂 (メイン魂) のほかに、もうひとつ。", "これを『サブ魂』と呼びます。"],
        ["本来の魂 (メイン魂) のほかに、もうひとつ。", "これを『サブ魂』と呼ぶの。"]),
      say(["サブ魂は、覚えた技やパッシブを貸してくれます。", "それに、その魂の能力の一部が器に足されます。魂のランクが高いほど多く。"],
        ["サブ魂は、覚えた技やパッシブを貸してくれるわ。", "それに、その魂の能力の一部が器に足されるの。ランクの高い魂ほど多くね。"]),
      say(["貸してくれる数は、魂のランクで決まります。", "R1-2はひとつ、R3-4はふたつ、R5なら三つ。"],
        ["貸してくれる数は、魂のランクで決まるわ。", "R1-2はひとつ、R3-4はふたつ、R5なら三つよ。"]),
      gift ? say([`練習に、${gift}お預けします。`, "空いている魂を、サブ魂の枠に宿してみてください。"],
        [`練習に、${gift}預けておくわね。`, "空いている魂を、サブ魂の枠に宿してごらんなさい。"])
        : say(["隊に出していない魂を、", "サブ魂の枠に宿してみてください。"],
          ["隊に出していない魂を、", "サブ魂の枠に宿してごらんなさい。"]),
      say(["宿したら『技』で、借りる技を選びます。", "済ませるまで、王さまは門をお開けになりません。"],
        ["宿したら『技』で、借りる技を選ぶの。", "済ませるまで、王さまは門を開けてくださらないわ。"]),
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
      say(["控えの結社が開かれたそうですね。"], ["控えの結社が開かれたそうね。"]),
      say(["隊に出していない魂も、ただ眠っているわけではありません。", "席に着けた魂は、その力の一部を人業のみなに分けてくれます。"],
        ["隊に出していない魂も、ただ眠っているわけじゃないの。", "席に着けた魂は、その力の一部を人業のみんなに分けてくれるわ。"]),
      say(["『魂』の区分の『控えの結社』を開いてみてください。"], ["『魂』の区分の『控えの結社』を開いてごらんなさい。"]),
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
  return { key, name: d.name, text: step.text, hint: step.hint, started: st.cur === key };
}

// UI.tutorialFree(key): その手ほどきの最中か (酒場の噂の初回を無料にする)
function isFree(key) { const st = tutState(); return !!st && st.cur === key && !st.done[key]; }

// ---- 始める・続ける ----
let busy = false; // 導入の語り・完了のカードの最中
function inTown() { const G = G_(); return !!G && G.state === "town"; }

// UI.tutorialResume(): 済ませていない手ほどきを始める (始めていれば今の手順へ案内する)
function resume() {
  if (!inTown() || busy) return false;
  const p = pending();
  if (!p) return false;
  const st = tutState();
  const d = TUT_MAP[p.key];
  if (st.cur !== p.key) return start(d);
  goStep(true);
  return true;
}
function start(d) {
  const st = tutState();
  st.cur = d.key; st.step = 0; st.ev = {}; st.base = {};
  const gift = safe(() => d.prepare(), null);
  if (game.autosave) game.autosave(true);
  busy = true;
  const after = () => {
    busy = false;
    if (gift) toast(`${gift}預かった (手ほどき用)`, { tone: "good" });
    setTimeout(() => goStep(true), 200); // 語りを閉じたタップが、開いた先の画面に届かないように
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

// 今の手順へ: 必要なら行き先を開き、画面下の札と光る所を出す
function goStep(navigate) {
  let s = curStep();
  while (s && (stepDone(s) || safe(() => (s.skip ? s.skip() : false), false))) {
    if (!advance(true)) return;
    s = curStep();
  }
  if (!s) return;
  if (navigate && inTown()) safe(() => s.go(), null);
  toast(`手ほどき ― ${s.text}`, { tone: "info" });
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
    toast(`手ほどき ― ${d.steps[st.step].text}`, { tone: "info" });
  }
  return true;
}
function finish(d) {
  const st = tutState();
  st.done[d.key] = true;
  st.cur = null; st.step = 0; st.ev = {}; st.base = {};
  if (game.autosave) game.autosave(true);
  clearGlow();
  updateBar();
  busy = true;
  const after = () => {
    busy = false;
    if (game.renderTown && inTown()) game.renderTown();
    // 続けて済ませる手ほどきがあれば、そのまま始める
    if (pending()) setTimeout(() => resume(), 240);
  };
  sfx("victory");
  const more = dueKeys().length > 0;
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
  if (!pending()) return false;
  setTimeout(() => resume(), 700); // 報告の知らせ (トースト) を見せてから
  return true;
}

// UI.tutorialEvent(name): UI から届く合図 (サブ魂の技を開いた・結社を開いた…)
function onEvent(name) {
  const st = tutState();
  if (!st || !st.cur) return;
  st.ev[name] = true;
  if (name === "dollCreated" && st.cur === "createThree") {
    setTimeout(() => {
      if (tutState().cur === "createThree" && inTown() && !busy && !sceneActive() && sheetDepth() === 0 && !stepDone(curStep())) goStep(true);
    }, 250);
  }
  if (name === "dungeonEntered" && st.cur === "firstDive") {
    st.done.firstDive = true; st.cur = null; st.step = 0; st.ev = {}; st.base = {};
    clearGlow(); updateBar();
    if (game.autosave) game.autosave(true);
    return;
  }
  schedule();
}

// ---- 見張り: 手順が済んだか・光らせる所・画面下の札 ----
let raf = 0;
function schedule() {
  if (!hasDOM() || raf) return;
  const run = () => { raf = 0; tick(); };
  raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16);
}
function tick() {
  const s = curStep();
  if (s && !busy && inTown()) {
    if (stepDone(s) || safe(() => (s.skip ? s.skip() : false), false)) {
      // 最後の手順: 開いているシート (融合・技の選択・昇格の祝祭…) を閉じてから完了のカードを出す
      const d = curDef();
      const last = d && tutState().step >= d.steps.length - 1;
      if (!(last && sheetDepth() > 0)) { if (advance()) schedule(); return; }
    }
  }
  glow(s && !busy && inTown() ? s.target : null);
  updateBar();
}
function clearGlow() {
  if (!hasDOM()) return;
  for (const n of document.querySelectorAll(".tut-glow")) n.classList.remove("tut-glow");
}
function glow(sels) {
  if (!hasDOM()) return;
  let hit = null;
  for (const q of (sels || [])) { hit = document.querySelector(q); if (hit) break; }
  for (const n of document.querySelectorAll(".tut-glow")) if (n !== hit) n.classList.remove("tut-glow");
  if (hit && !hit.classList.contains("tut-glow")) hit.classList.add("tut-glow");
}
let bar = null;
function updateBar() {
  if (!hasDOM() || !document.body) return;
  const s = curStep();
  const d = curDef();
  const show = !!(s && d && !busy && inTown() && !sceneActive());
  if (!show) { if (bar) bar.classList.add("hidden"); return; }
  if (!bar || !bar.isConnected) {
    bar = el("button", "tut-bar hidden");
    bar.type = "button";
    bar.appendChild(el("span", "tut-bar-k", "手ほどき"));
    const tx = el("span", "tut-bar-tx");
    tx.appendChild(el("span", "tut-bar-t"));
    tx.appendChild(el("span", "tut-bar-s"));
    bar.appendChild(tx);
    bar.addEventListener("click", () => { sfx("select"); goStep(true); });
    document.body.appendChild(bar);
  }
  const st = tutState();
  const t = `${d.name}${d.steps.length > 1 ? ` ${st.step + 1}/${d.steps.length}` : ""} ・ ${s.text}`;
  const tEl = bar.querySelector(".tut-bar-t"), sEl = bar.querySelector(".tut-bar-s");
  if (unphrase(tEl.textContent) !== t) setText(tEl, t);
  if (unphrase(sEl.textContent) !== s.hint) setText(sEl, s.hint);
  bar.setAttribute("aria-label", `手ほどき: ${s.text} (${s.hint})。タップでその場所へ`);
  bar.classList.remove("hidden");
}

export function install() {
  registerUI({
    tutorialMansionVisited: mansionVisited,
    tutorialPending: pending,
    tutorialResume: resume,
    tutorialAfterReport: afterReport,
    tutorialEvent: onEvent,
    tutorialFree: isFree,
  });
  // 画面が描き替わるたびに見張る (手順の完了・光らせる所の付け直し)。属性の変化は見ない (光らせる class で回らないように)
  if (hasDOM() && typeof MutationObserver === "function" && document.body) {
    new MutationObserver(() => { if (tutState() && tutState().cur) schedule(); else if (bar && !bar.classList.contains("hidden")) updateBar(); })
      .observe(document.body, { childList: true, subtree: true });
  }
}

// 確かめ用
export const _TUTS = TUTS;
