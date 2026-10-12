// ===== 無限迷宮だけの出来事 (docs/infinite-labyrinth.md 13章) =====
// 本編の events.js の出来事は無限迷宮では使わない。ここの出来事は無限迷宮の盤面にだけ置く (game.js evNewFloor → eligibleEvents の st.abyss)。
// 報酬の語彙は「品・魂・回復・この出撃だけの強化・金貨 (回収人で使う)・✦Soul・呪い」に絞る。風だまりの回収人・灯番は出来事ではない。
// 形は events.js の出来事と同じ (id・name・tier・icon・intro・choices・onWin) で、EVENT_MAP に合流する (layer 99 = 無限迷宮の欄)。
// 選択肢は宣言の表 (効果の語彙は下の apply) で書き、どの選択肢も最後に A.done (または宝箱・戦闘) へつなぐ。
// id はセーブ (見聞録) に残るので、改名・使い回し・削除をしない。
//
// 効果の語彙 (選択肢の2つ目):
//   cost: { gold: 戦果, soul: 戦果, hp: 割合, mp: 割合, ember: 数 }  先に払う (払えなければ選択肢を出さない)
//   p: 確率, ok: 効果, ng: 効果                    運の分かれ目
//   check: "luk"|"agi"|"int"|"pie"|"atk"|"vit", ok, ng   隊で一番高い者の能力で判定 (A.check)
//   heal: [HP割合, MP割合, 状態異常も治すか] / revive: true (倒れた者を1人、HP全快で)
//   hurt: 割合 (全員の最大HP) / hurtOne: 割合 / ail: [種類, 確率] / mpLoss: 割合
//   gold: 戦果 / soul: 戦果 / ember: 数 (無限迷宮の残火は本編の2倍 — 2026-10-12 ユーザーの指示。数はここに2倍で書く)
//   item: pickLoot の opts ({} / {rare:true} / {elite:true}) / itemRar: "r"|"sr" (そのレア度以上)
//   soulPick: "normal"|"common"|"rarePlus" (職業の魂を拾う。無限迷宮では同じ職なら自動で融合)。配列なら書いた数だけ拾う (["normal", "normal"] = 2つ)
//   run: この出撃だけの強化・呪い (dmgMul・soulMul・goldMul・enemyMul・packMin・ambushMul・chestRankUp・lootBonusLv・noFlee
//        は修飾子として積む / crit・startHeal・bomb・preempt・ambushNext は回数・値を足す)
//   floor: この階だけの強化・呪い (修飾子) / stairs: true (階段の在処) / chests: 数 (宝箱の在処を見せる)
//   chest: { rankUp } (その場に宝箱) / fight: [出来事の戦闘の spec], win: 勝った後の効果, opening: "preempt"|"ambush" (開幕。強敵の戦いにも効く)
//   ※ 選択肢の文 (「― 」の後) に書いた見返り・代償は、必ずここの効果と同じにする (2026-10-12 ユーザーの指示)
//   say: 結果の一文 (トーストと記録)
import { random } from "./rng.js";

export const INF_EV_LAYER = 99;
// 修飾子の説明 (階の情報の「出来事」の行)
const pct = (v) => `${v >= 1 ? "+" : "−"}${Math.round(Math.abs(v - 1) * 100)}%`;
function modDesc(m, span) {
  const t = [];
  if (m.dmgMul) t.push(`与ダメ ${pct(m.dmgMul)}`);
  if (m.soulMul) t.push(`✦Soul ${pct(m.soulMul)}`);
  if (m.goldMul) t.push(`金貨 ${pct(m.goldMul)}`);
  if (m.enemyMul) t.push(`敵の力 ${pct(m.enemyMul)}`);
  if (m.ambushMul != null) t.push(m.ambushMul === 0 ? "奇襲を受けない" : `奇襲 ${m.ambushMul < 1 ? "が減る" : "が増える"}`);
  if (m.chestRankUp) t.push(`宝箱のランク +${m.chestRankUp}`);
  if (m.lootBonusLv) t.push(`品の質 +${m.lootBonusLv}`);
  if (m.packMin) t.push(`魔物は${m.packMin}体以上の群れ`);
  if (m.noFlee) t.push("逃げられない");
  return `${span} ― ${t.join("・")}`;
}
const RUN_FIELDS = ["crit", "startHeal", "bomb", "preempt", "ambushNext"];

function payable(A, c) {
  if (!c) return true;
  if (c.gold && !A.canPayGold(A.goldCost(c.gold))) return false;
  if (c.soul && !A.canPaySoul(A.soulCost(c.soul))) return false;
  if (c.ember && A.embers() < c.ember) return false;
  return true;
}
function costText(A, c) {
  if (!c) return "";
  const t = [];
  if (c.gold) t.push(`💰${A.goldCost(c.gold)}`);
  if (c.soul) t.push(`✦${A.soulCost(c.soul)}`);
  if (c.ember) t.push(`残火${c.ember}`);
  if (c.hp) t.push(`HP${Math.round(c.hp * 100)}%`);
  if (c.mp) t.push(`MP${Math.round(c.mp * 100)}%`);
  return t.length ? ` (${t.join("・")})` : "";
}
function pay(A, c) {
  if (!c) return;
  if (c.gold) A.payGold(A.goldCost(c.gold));
  if (c.soul) A.paySoul(A.soulCost(c.soul));
  if (c.ember) A.payEmber(c.ember);
  if (c.hp) A.hurtAll(c.hp);
  if (c.mp) A.mpAll(c.mp);
}
// 効果を順に掛け、最後に finish (= A.done)。戦闘・宝箱はその先を自分で片付けるので finish を呼ばない (next = 勝った後の続き)
function apply(A, cell, e, from, finish, next = null) {
  if (!e) { finish(); return; }
  if (e.p != null) { apply(A, cell, random() < e.p ? e.ok : e.ng, from, finish, next); return; }
  if (e.check) { const r = A.check(e.check); if (r.who) A.log(`${r.who.name}が試みた…${r.ok ? "うまくいった。" : "しくじった。"}`, r.ok ? "win" : "dmg"); apply(A, cell, r.ok ? e.ok : e.ng, from, finish, next); return; }
  if (e.heal) A.healAll(e.heal[0] || 0, e.heal[1] || 0, !!e.heal[2]);
  if (e.revive) { const d = A.deadList()[0]; if (d) A.revive(d, true); }
  if (e.hurt) A.hurtAll(e.hurt);
  if (e.hurtOne) A.hurtOne(A.randomAlive(), e.hurtOne);
  if (e.ail) A.ailAll(e.ail[0], e.ail[1]);
  if (e.mpLoss) A.mpAll(e.mpLoss);
  if (e.gold) A.gold(e.gold, from);
  if (e.soul) A.soul(e.soul, from);
  if (e.ember) A.ember(e.ember, from);
  if (e.run) {
    const rv = A.runEv(), mods = { name: from };
    let any = false;
    for (const [k, v] of Object.entries(e.run)) {
      if (RUN_FIELDS.includes(k)) rv[k] = (rv[k] || 0) + v; else { mods[k] = v; any = true; }
    }
    if (any) { mods.desc = modDesc(mods, "この出撃の間"); rv.mods.push(mods); }
  }
  if (e.floor) A.floorEv().mods.push({ name: from, desc: modDesc(e.floor, "この階の間"), ...e.floor });
  if (e.stairs) A.revealStairs();
  if (e.chests) A.revealWhere((c) => c.type === "chest" && !c.cleared, e.chests);
  if (e.say) A.toast(e.say, e.tone || "info");
  if (e.fight) { A.fight(cell, e.fight, e.tag || "w0", e.opening ? { opening: e.opening } : {}); return; }
  // 品・魂は1つずつ見せてから次へ (重なると前の札が消える)
  const gifts = [];
  if (e.item) gifts.push((go) => A.item(e.item, from, go));
  if (e.itemRar) gifts.push((go) => A.itemMinRar(e.itemRar, from, go));
  for (const k of e.soulPick ? [].concat(e.soulPick) : []) gifts.push((go) => A.soulDrop(k, `${from}で拾った魂だ。`, go));
  const end = () => (e.chest ? A.chestHere(cell, e.chest, next) : finish());
  const step = (i) => (i < gifts.length ? gifts[i](() => step(i + 1)) : end());
  step(0);
}
// 回復だけの選択肢 (ほかに得る物が無い) は、癒す者がいなければ出さない
const ONLY_HEAL = new Set(["heal", "say", "cost", "tone"]);
// 選択肢の表 → events.js の choices の形
function makeChoices(ev) {
  return (A, cell) => ev.opts.map(([label, eff, show], i) => {
    const e = eff || {};
    if (show && !show(A)) return null;
    if (!payable(A, e.cost)) return null;
    if (e.heal && Object.keys(e).every((k) => ONLY_HEAL.has(k)) && !(e.heal[2] && A.aliveList().some((m) => m.ailment)) && !A.aliveList().some((m) => (e.heal[0] && m.hp < m.maxhp) || (e.heal[1] && m.mp < m.maxmp))) return null;
    if (e.revive && !A.deadList().length) return null;
    return { label: label + costText(A, e.cost), primary: i === 0, danger: !!(e.fight || e.danger), fn: () => {
      pay(A, e.cost);
      apply(A, cell, e, ev.name, () => A.done(cell));
    } };
  }).filter(Boolean);
}
// 戦闘に勝った後: 戦闘を起こした選択肢の win を掛ける (札 tag = 選択肢の番号)
function makeOnWin(ev) {
  return (A, cell, f, next) => {
    const i = Number(String(f.tag || "").replace(/^w/, ""));
    const find = (e) => (!e ? null : e.fight ? e : find(e.ok) || find(e.ng));
    const opt = ev.opts[i];
    const src = opt ? find(opt[1]) : null;
    const win = src && src.win;
    if (!win) { A.done(cell, next); return; }
    apply(A, cell, win, ev.name, () => A.done(cell, next), next);
  };
}
// 出来事を1つ定義する。tier: c 常 / u 稀 / r 秘 (1回の出撃で1度まで)。from = その階以上
const TIER = { c: "common", u: "uncommon", r: "rare" };
const LIST = [];
function ev(id, name, tier, icon, lines, opts, extra = {}) {
  // 戦闘の札は選択肢の番号 (w0, w1 …)。p / check の枝の中の戦闘にも同じ札を付ける
  opts.forEach(([, e], i) => { const tag = (x) => { if (!x) return; if (x.fight) x.tag = `w${i}`; tag(x.ok); tag(x.ng); }; tag(e); });
  const o = { id, name, layer: INF_EV_LAYER, inf: true, tier: TIER[tier], icon, opts, accent: extra.accent, minFloor: extra.from || 1 };
  o.intro = () => lines;
  o.choices = makeChoices(o);
  o.onWin = makeOnWin(o);
  if (extra.cond) o.cond = extra.cond;
  LIST.push(o);
}
const hurtAny = (A) => A.aliveList().some((m) => m.hp < m.maxhp);
const deadAny = (A) => A.deadList().length > 0;

// ================= 常 (55) =================
ev("inf_c01", "風の止まる窪み", "c", "fountain", ["吹き上げる風が、ここだけ止んでいる。土くれの器の継ぎ目が、少し楽になった気がする。"], [
  ["腰を下ろして休む ― HP・MPが2割戻る", { heal: [0.2, 0.2] }],
  ["風の音に耳を澄ます ― ✦Soul を少し", { soul: 0.8 }],
]);
ev("inf_c02", "砕けた器のかけら", "c", "corpse", ["誰かの仮の器が、ここで崩れたらしい。土くれの山の中に、何かが埋もれている。"], [
  ["掘り返す ― 品 / 30%で魔物が潜んでいる", { p: 0.7, ok: { item: {} }, ng: { fight: [{ min: 1 }], win: { item: {} } } }],
  ["そっと土を寄せて弔う ― ✦Soul を少し", { soul: 0.6 }],
]);
ev("inf_c03", "漂う魂の欠片", "c", "event", ["名もなき魂の欠片が、ひとつだけ風に逆らって漂っている。"], [
  ["手を伸ばす ― 職業の魂 (コモン) / 25%で風にさらわれ、HPを削られる", { p: 0.75, ok: { soulPick: "common" }, ng: { hurt: 0.12, say: "欠片は風にちぎれ、冷たい刃のように隊を打った" } }],
  ["見送る ― ✦Soul を少し", { soul: 0.5 }],
]);
ev("inf_c04", "土くれの小さな祠", "c", "fountain", ["誰が置いたのか、土くれを固めた小さな祠。中に灯の燃え残りがある。"], [
  ["金貨を供える ― この階の戦闘で与ダメ +10%", { cost: { gold: 1 }, floor: { dmgMul: 1.10 }, say: "祠の灯がかすかに強まった ― この階の与ダメ +10%" }],
  ["燃え残りを拾う ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c05", "落ちてきた背嚢", "c", "chest", ["上の階から落ちてきたらしい背嚢が、口を開けて転がっている。"], [
  ["中を探る ― 金貨 / 20%で罠", { p: 0.8, ok: { gold: 1.5 }, ng: { hurt: 0.1, say: "背嚢に仕込まれた針が指を刺した" } }],
  ["蹴って中身を出す ― 品 / 40%で何も無い", { p: 0.6, ok: { item: {} }, ng: { say: "中身は砂だけだった" } }],
]);
ev("inf_c06", "壁の古い傷", "c", "event", ["壁一面に、刃でつけた傷が数えきれないほど並んでいる。誰かが階を数えていたらしい。"], [
  ["傷を数える ― ✦Soul", { soul: 1 }],
  ["自分たちの印も刻む ― この出撃の会心率 +1%", { run: { crit: 0.01 }, say: "隊の印を刻んだ ― 会心率 +1% (この出撃)" }],
]);
ev("inf_c07", "湧き水の溜まり", "c", "fountain", ["岩の割れ目から、澄んだ水が細く湧いている。"], [
  ["飲む ― HP 3割回復 / 20%で腹を下す (毒)", { p: 0.8, ok: { heal: [0.3, 0] }, ng: { heal: [0.3, 0], ail: ["poison", 0.6] } }],
  ["水筒に詰めて売る算段 ― 金貨を少し", { gold: 0.6 }],
]);
ev("inf_c08", "眠る魔物", "c", "event", ["通路の真ん中で、魔物が丸くなって眠っている。"], [
  ["忍び寄って先に打つ ― 戦闘 (先制) / 勝てば✦Soul", { fight: [{ min: 1 }], opening: "preempt", win: { soul: 1.5 } }],
  ["起こさぬように抜ける (AGI) ― 成功で金貨・失敗で奇襲", { check: "agi", ok: { gold: 1 }, ng: { fight: [{ min: 2 }], opening: "ambush", win: { soul: 1 } } }],
]);
ev("inf_c09", "錆びた鎖の束", "c", "trap", ["天井から錆びた鎖が垂れ、何かを吊るしていた跡がある。"], [
  ["鎖を手繰り寄せる ― 品 / 30%で鎖が落ちてくる", { p: 0.7, ok: { item: {} }, ng: { hurt: 0.15 } }],
  ["鎖を売り物にする ― 金貨を少し", { gold: 0.7 }],
]);
ev("inf_c10", "冷えた焚き火の跡", "c", "event", ["前に誰かが野営した跡。灰はとうに冷えている。"], [
  ["火をおこして休む ― HP 2割・MP 1割", { heal: [0.2, 0.1] }],
  ["灰の中を探る ― 金貨 / 魂の残火 2つ (10%)", { p: 0.1, ok: { ember: 2 }, ng: { gold: 1 } }],
]);
ev("inf_c11", "光る苔", "c", "event", ["壁の苔がぼんやり光り、通路の先を照らしている。"], [
  ["苔の光をたどる ― 階段の在処が分かる", { stairs: true, say: "苔の光が、階段の在処を示した" }],
  ["苔を削いで持ち帰る ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c12", "傾いた墓標", "c", "corpse", ["名の削れた墓標が、風に押されて傾いている。"], [
  ["まっすぐに立て直す ― この出撃の戦闘の始めに HP回復 2回", { run: { startHeal: 2 }, say: "誰かの感謝が、隊を見守っている気がする ― 戦闘の始めの回復 2回" }],
  ["根元を掘る ― 品 / 30%で呪い (この階の敵が強くなる)", { p: 0.7, ok: { item: {} }, ng: { floor: { enemyMul: 1.15 }, say: "墓の主が怒った ― この階の魔物が強くなった" } }],
]);
ev("inf_c13", "魔物の食べ残し", "c", "corpse", ["魔物が何かを食い荒らした跡。骨の間に、光るものが混じっている。"], [
  ["拾い上げる ― 金貨 / 25%で持ち主が戻ってくる", { p: 0.75, ok: { gold: 1.5 }, ng: { fight: [{ min: 1 }], win: { gold: 2 } } }],
  ["立ち去る前に一礼 ― ✦Soul を少し", { soul: 0.5 }],
]);
ev("inf_c14", "息をする壁", "c", "event", ["壁の石がゆっくりと膨らみ、また縮む。迷宮そのものが息をしているようだ。"], [
  ["壁に耳を当てる ― ✦Soul", { soul: 1 }],
  ["壁を叩いて黙らせる (STR) ― 成功で金貨・失敗で HP 1割", { check: "atk", ok: { gold: 1.2 }, ng: { hurt: 0.1 } }],
]);
ev("inf_c15", "灯の油壺", "c", "chest", ["古い灯籠の油壺が、満たされたまま置かれている。"], [
  ["油を灯に注ぐ ― MP 3割回復", { heal: [0, 0.3] }],
  ["油壺ごと担いでいく ― 金貨", { gold: 1.2 }],
]);
ev("inf_c16", "うずくまる人業", "c", "corpse", ["見知らぬ人業が、壁際でうずくまったまま動かない。胸の灯は、もう消えている。"], [
  ["胸の扉を開ける ― 職業の魂 / 30%で空", { p: 0.7, ok: { soulPick: "normal" }, ng: { say: "胸の中は空だった" } }],
  ["持ち物を譲り受ける ― 品", { item: {} }],
]);
ev("inf_c17", "砂の流れ落ちる穴", "c", "trap", ["床の小さな穴へ、砂がさらさらと流れ落ちていく。"], [
  ["穴をのぞく ― 金貨 / 20%で砂に足を取られる", { p: 0.8, ok: { gold: 1 }, ng: { hurt: 0.1 } }],
  ["砂の流れを読む (INT) ― 成功で階段の在処", { check: "int", ok: { stairs: true, say: "砂の流れが階段へ向かっている" }, ng: { say: "砂の行方は分からなかった" } }],
]);
ev("inf_c18", "群れの足跡", "c", "event", ["床一面に、大小さまざまな魔物の足跡が残っている。群れが近い。"], [
  ["群れを追う ― 戦闘 (群れ) / 勝てば✦Soul と金貨", { fight: [{ min: 3 }], win: { soul: 1.5, gold: 1 } }],
  ["足跡を消して進む ― この階の奇襲が減る", { floor: { ambushMul: 0.5 }, say: "足跡を消した ― この階は奇襲を受けにくい" }],
]);
ev("inf_c19", "誰かの書き置き", "c", "story", ["「ここまで来た。まだ降りる。」 炭で壁に書かれた、短い書き置き。"], [
  ["続きを書き足す ― ✦Soul", { soul: 1 }],
  ["書き置きの下を探す ― 品 / 半分は金貨を少し", { p: 0.5, ok: { item: {} }, ng: { gold: 0.5 } }],
]);
ev("inf_c20", "割れた水鏡", "c", "event", ["床の水たまりが、割れた鏡のように隊の姿を映している。"], [
  ["のぞき込む ― MP 2割回復 / 20%で混乱", { p: 0.8, ok: { heal: [0, 0.2] }, ng: { ail: ["confuse", 0.5] } }],
  ["水を払って底を見る ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c21", "落とし物の剣帯", "c", "chest", ["剣帯が一本、通路に落ちている。持ち主の姿は無い。"], [
  ["拾う ― 品", { item: {} }],
  ["金具だけ外して持つ ― 金貨を少し", { gold: 0.7 }],
]);
ev("inf_c22", "囁く風穴", "c", "event", ["壁の小さな穴から、風が言葉のような音を立てて吹き出している。"], [
  ["言葉を聞き取る (INT) ― 成功で✦Soul ・失敗で眠り", { check: "int", ok: { soul: 1.5 }, ng: { ail: ["sleep", 0.4] } }],
  ["穴を土でふさぐ ― この階の奇襲が減る", { floor: { ambushMul: 0.6 }, say: "風穴をふさいだ ― この階は奇襲を受けにくい" }],
]);
ev("inf_c23", "古い薬棚", "c", "chest", ["朽ちかけた薬棚に、小瓶がいくつか残っている。"], [
  ["小瓶を飲んでみる ― HP 3割 / 30%で毒", { p: 0.7, ok: { heal: [0.3, 0, true] }, ng: { ail: ["poison", 0.7] } }],
  ["棚ごと調べる ― 品", { item: {} }],
]);
ev("inf_c24", "置き去りの盾", "c", "event", ["盾が一枚、壁に立てかけてある。表には無数の爪痕。"], [
  ["盾の陰で休む ― HP 2割", { heal: [0.2, 0] }],
  ["盾を持っていく ― 品", { item: {} }],
]);
ev("inf_c25", "地鳴り", "c", "trap", ["足の下から、低い地鳴りが近づいてくる。"], [
  ["身を伏せてやり過ごす ― HP 1割を失い、金貨を少し", { hurt: 0.1, say: "揺れが過ぎた。埃の中に、光るものが落ちていた" , gold: 1 }],
  ["揺れに乗じて走る (AGI) ― 成功で✦Soul ・失敗で HP 2割", { check: "agi", ok: { soul: 1.2 }, ng: { hurt: 0.2 } }],
]);
ev("inf_c26", "眠り草の群生", "c", "event", ["甘い匂いの白い草が、通路をふさぐように群れている。"], [
  ["刈り取って進む ― 金貨 / 30%で眠り", { p: 0.7, ok: { gold: 1.2 }, ng: { ail: ["sleep", 0.6], gold: 0.6 } }],
  ["草を燃やす ― この階の戦闘で与ダメ +8%", { floor: { dmgMul: 1.08 }, say: "煙が魔物の目を潰した ― この階の与ダメ +8%" }],
]);
ev("inf_c27", "古い天秤", "c", "event", ["片方の皿に、土くれがひとつ載った天秤。もう片方の皿は空だ。"], [
  ["金貨を載せる ― ✦Soul を多めに", { cost: { gold: 1 }, soul: 2 }],
  ["✦Soul を載せる ― 金貨を多めに", { cost: { soul: 1 }, gold: 2.5 }],
]);
ev("inf_c28", "魂を吸う苔", "c", "poison", ["黒い苔がびっしりと生え、近づくだけで魔力が吸われていく。"], [
  ["苔を焼き払う ― MP 1割を使い、苔の中の品を得る", { cost: { mp: 0.1 }, item: {} }],
  ["苔を避けて回り込む ― 金貨を少し", { gold: 0.5 }],
]);
ev("inf_c29", "迷い込んだ小さな獣", "c", "event", ["痩せた小さな獣が、隊の足元にすり寄ってきた。"], [
  ["食べ物を分けてやる ― この出撃の戦闘で 1度、先制", { run: { preempt: 1 }, say: "獣は先を走り、魔物の居所を教えてくれた ― 先制 1度" }],
  ["追い払う ― ✦Soul を少し", { soul: 0.5 }],
]);
ev("inf_c30", "崩れかけた橋", "c", "trap", ["割れ目の上に、細い石の橋が渡されている。"], [
  ["慎重に渡る (AGI) ― 成功で向こう岸の品・失敗で HP 2割", { check: "agi", ok: { item: {} }, ng: { hurt: 0.2 } }],
  ["橋を叩き落として通り道を変える ― 階段の在処", { stairs: true, say: "崩れた石が転がった先に、階段が見えた" }],
]);
ev("inf_c31", "土くれの人形", "c", "event", ["手のひらほどの土くれの人形が、壁の窪みに並んでいる。誰かが器の練習をしたらしい。"], [
  ["ひとつもらう ― この出撃の会心率 +1%", { run: { crit: 0.01 }, say: "人形が守り札になった ― 会心率 +1%" }],
  ["人形を崩して中を見る ― 金貨 / 魂の残火 2つ (15%)", { p: 0.15, ok: { ember: 2 }, ng: { gold: 1 } }],
]);
ev("inf_c32", "魔物の巣穴", "c", "event", ["壁の穴の奥で、何かが身じろぎした。"], [
  ["引きずり出す ― 戦闘 / 勝てば品", { fight: [{ single: true }], win: { item: {} } }],
  ["穴をふさぐ ― ✦Soul を少し", { soul: 0.5 }],
]);
ev("inf_c33", "朽ちた木箱", "c", "chest", ["湿って朽ちかけた木箱が積まれている。"], [
  ["こじ開ける ― 品 / 25%で罠", { p: 0.75, ok: { item: {} }, ng: { hurt: 0.12 } }],
  ["箱の木を薪にする ― HP 1割・MP 1割", { heal: [0.1, 0.1] }],
]);
ev("inf_c34", "鳴り響く鈴", "c", "event", ["どこからか、鈴の音が近づいては遠ざかる。"], [
  ["音の方へ ― 金貨 / 30%で魔物の群れ", { p: 0.7, ok: { gold: 1.5 }, ng: { fight: [{ min: 2 }], win: { gold: 1.5 } } }],
  ["音から離れる ― この階の奇襲が減る", { floor: { ambushMul: 0.5 } }],
]);
ev("inf_c35", "まだ温かい灯籠", "c", "fountain", ["小さな灯籠が、まだ温かい。少し前まで誰かがいた。"], [
  ["灯籠で手を温める ― HP・MP 2割", { heal: [0.2, 0.2] }],
  ["灯籠の火を分けてもらう ― この階の戦闘で与ダメ +10%", { floor: { dmgMul: 1.10 } }],
]);
ev("inf_c36", "倒れた石柱", "c", "event", ["太い石柱が倒れ、下に何かを挟んでいる。"], [
  ["石柱を持ち上げる (STR) ― 成功で品・失敗で HP 1割", { check: "atk", ok: { item: {} }, ng: { hurt: 0.1 } }],
  ["挟まった物の端だけ拾う ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c37", "魂のこだま", "c", "wisp", ["自分たちの足音が、少し遅れてもう一度聞こえる。"], [
  ["こだまに話しかける ― ✦Soul", { soul: 1.2 }],
  ["こだまを追い越す (AGI) ― 成功で金貨", { check: "agi", ok: { gold: 1.5 }, ng: { say: "こだまは消えた" } }],
]);
ev("inf_c38", "毒の滴る天井", "c", "poison", ["天井から、緑色の滴がぽたぽたと落ちている。"], [
  ["滴を集めて刃に塗る ― この階の戦闘で与ダメ +10% / 30%で毒", { p: 0.7, ok: { floor: { dmgMul: 1.10 } }, ng: { floor: { dmgMul: 1.10 }, ail: ["poison", 0.5] } }],
  ["急いで駆け抜ける ― 金貨を少し", { gold: 0.6 }],
]);
ev("inf_c39", "金貨の詰まった割れ目", "c", "gold", ["壁の割れ目に、古い金貨が詰まって光っている。"], [
  ["指でかき出す ― 金貨 / 20%で指を挟まれる", { p: 0.8, ok: { gold: 2 }, ng: { hurtOne: 0.2, gold: 1 } }],
  ["割れ目を広げる (STR) ― 成功で金貨多め・失敗で崩れる", { check: "atk", ok: { gold: 3 }, ng: { hurt: 0.15 } }],
]);
ev("inf_c40", "風に削られた像", "c", "event", ["風に削られ、顔の無くなった像が立っている。"], [
  ["像に祈る ― 状態異常を治し、HP 1割", { heal: [0.1, 0, true] }],
  ["像の台座を調べる ― 品", { item: {} }],
]);
ev("inf_c41", "うち捨てられた荷車", "c", "chest", ["車輪の外れた荷車が、荷を積んだまま転がっている。"], [
  ["荷をほどく ― 品", { item: {} }],
  ["荷車の金具を集める ― 金貨", { gold: 1.2 }],
]);
ev("inf_c42", "甘い霧", "c", "event", ["甘い匂いの霧が、通路にうっすらと漂っている。"], [
  ["霧を吸い込む ― MP 3割 / 30%で魅了", { p: 0.7, ok: { heal: [0, 0.3] }, ng: { ail: ["charm", 0.4] } }],
  ["霧を散らす ― ✦Soul を少し", { soul: 0.6 }],
]);
ev("inf_c43", "魔物の抜け殻", "c", "corpse", ["大きな魔物の抜け殻が、壁にしがみついたまま残っている。"], [
  ["殻を剥ぎ取る ― 品 / 30%で本体が戻ってくる", { p: 0.7, ok: { item: {} }, ng: { fight: [{ single: true }], win: { item: {} } } }],
  ["殻を砕いて粉にする ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c44", "細い隙間", "c", "event", ["壁の細い隙間の向こうに、別の通路が見える。"], [
  ["体を押し込む (AGI) ― 成功で宝箱の在処・失敗で HP 1割", { check: "agi", ok: { chests: 2, say: "隙間の向こうに宝箱が見えた" }, ng: { hurt: 0.1 } }],
  ["隙間に刃を差し込む ― 金貨を少し", { gold: 0.7 }],
]);
ev("inf_c45", "崩れた祭壇", "c", "fountain", ["祭壇は崩れているが、聖水の器だけが無傷で残っている。"], [
  ["聖水を浴びる ― 状態異常を治し、HP 2割", { heal: [0.2, 0, true] }],
  ["器を持っていく ― 金貨", { gold: 1.2 }],
]);
ev("inf_c46", "吊るされた檻", "c", "trap", ["天井から吊るされた檻の中で、何かが光っている。"], [
  ["檻を落とす ― 品 / 30%で檻の番が現れる", { p: 0.7, ok: { item: {} }, ng: { fight: [{ min: 2 }], win: { item: {} } } }],
  ["鎖をたぐって引き寄せる (STR) ― 成功で金貨", { check: "atk", ok: { gold: 1.5 }, ng: { hurtOne: 0.15 } }],
]);
ev("inf_c47", "響かない部屋", "c", "event", ["声を出しても、まったく響かない部屋。耳が詰まったように静かだ。"], [
  ["しばらく黙って休む ― MP 3割", { heal: [0, 0.3] }],
  ["床を探る ― ✦Soul を少し", { soul: 0.7 }],
]);
ev("inf_c48", "割れた灯籠の山", "c", "event", ["割れた灯籠が、うず高く積まれている。"], [
  ["灯籠の欠片を探す ― 魂の残火 2つ (20%) / 金貨", { p: 0.2, ok: { ember: 2 }, ng: { gold: 1 } }],
  ["灯籠の山を整える ― ✦Soul", { soul: 1 }],
]);
ev("inf_c49", "小さな泉の精", "c", "fountain", ["泉の水面に、小さな光がいくつも跳ねている。"], [
  ["光に触れる ― HP 3割", { heal: [0.3, 0] }],
  ["光を瓶に詰める ― 金貨を少し", { gold: 0.8 }],
]);
ev("inf_c50", "折れた槍の林", "c", "trap", ["床から、折れた槍が何本も突き出ている。"], [
  ["槍の間を抜ける (AGI) ― 成功で奥の品・失敗で HP 2割", { check: "agi", ok: { item: {} }, ng: { hurt: 0.2 } }],
  ["槍を抜いて売り物にする ― 金貨", { gold: 1 }],
]);
ev("inf_c51", "首の無い鎧", "c", "event", ["首の無い鎧が、壁にもたれて座り込んでいる。"], [
  ["鎧を探る ― 品 / 30%で鎧が立ち上がる", { p: 0.7, ok: { item: {} }, ng: { fight: [{ single: true }], win: { item: {} } } }],
  ["鎧に一礼して通る ― この階の戦闘で与ダメ +8%", { floor: { dmgMul: 1.08 } }],
]);
ev("inf_c52", "迷宮の小鳥", "c", "event", ["光の届かない迷宮に、小鳥が一羽迷い込んでいる。"], [
  ["小鳥を追う ― 階段の在処", { stairs: true, say: "小鳥は迷わず階段へ飛んでいった" }],
  ["小鳥を逃がしてやる ― ✦Soul を少し", { soul: 0.6 }],
]);
ev("inf_c53", "埋もれた金庫", "c", "chest", ["土に半分埋もれた、小さな鉄の金庫。"], [
  ["錠を外す (LUK) ― 成功で金貨多め・失敗で罠", { check: "luk", ok: { gold: 2.5 }, ng: { hurt: 0.12 } }],
  ["金庫ごと叩き壊す ― 金貨を少し", { gold: 1 }],
]);
ev("inf_c54", "仮の器の墓場", "c", "corpse", ["崩れた仮の器が、いくつも折り重なっている。ここで多くの隊が倒れたのだ。"], [
  ["器の山を探る ― 職業の魂 (35%) / 品", { p: 0.35, ok: { soulPick: "normal" }, ng: { item: {} } }],
  ["静かに手を合わせる ― 状態異常を治す", { heal: [0, 0, true] }],
]);
ev("inf_c55", "研ぎ石", "c", "event", ["通路の隅に、よく使い込まれた研ぎ石が置いてある。"], [
  ["刃を研ぐ ― この出撃の会心率 +1%", { run: { crit: 0.01 }, say: "刃が冴えた ― 会心率 +1% (この出撃)" }],
  ["研ぎ石を持っていく ― 金貨を少し", { gold: 0.7 }],
]);

// ================= 稀 (30) =================
ev("inf_u01", "回収人の忘れ物", "u", "chest", ["商会の印のついた袋が落ちている。回収人が置き忘れたらしい。"], [
  ["中身をいただく ― レア以上の品", { itemRar: "r" }],
  ["袋のまま届けておく ― ✦Soul と金貨", { soul: 2, gold: 2 }],
]);
ev("inf_u02", "灯番の残した油", "u", "fountain", ["風だまりの灯籠と同じ油が、小さな器に分けて置いてある。"], [
  ["隊で分けて灯に注ぐ ― HP・MP 5割", { heal: [0.5, 0.5] }],
  ["油を身にまとう ― この出撃の戦闘の始めに HP回復 4回", { run: { startHeal: 4 }, say: "油の灯が隊を包む ― 戦闘の始めの回復 4回" }],
]);
ev("inf_u03", "魂の溜まり", "u", "wisp", ["魂の欠片が、窪みにいくつも溜まって淡く光っている。"], [
  ["手ですくう ― 職業の魂 2つ / 30%で隊の魔力が吸われる (MP 3割)", { p: 0.7, ok: { soulPick: ["normal", "normal"] }, ng: { soulPick: ["normal", "normal"], mpLoss: 0.3, say: "欠片が隊の魔力を吸っていった" } }],
  ["光を浴びる ― ✦Soul を多めに", { soul: 3.5 }],
]);
ev("inf_u04", "研ぎ澄まされた刃の祭壇", "u", "event", ["祭壇に、刃だけが何十本も突き立てられている。"], [
  ["血を一滴たらす ― HP 2割を払い、この出撃の与ダメ +5%", { cost: { hp: 0.2 }, run: { dmgMul: 1.05 }, say: "刃が応えた ― 与ダメ +5% (この出撃)" }],
  ["刃を一本抜く ― レア以上の品", { itemRar: "r" }],
]);
ev("inf_u05", "群れの主", "u", "mon", ["ひときわ大きな魔物が、群れを率いて通路をふさいでいる。"], [
  ["群れごと叩く ― 戦闘 (強敵と群れ) / 勝てば品と✦Soul", { fight: [{ elite: true }, { min: 2 }], win: { item: { elite: true }, soul: 2 } }],
  ["群れが去るのを待つ ― HP・MP 2割", { heal: [0.2, 0.2] }],
], { from: 6 });
ev("inf_u06", "鏡の部屋", "u", "event", ["四方の壁が鏡のように磨かれ、隊の姿が果てしなく映っている。"], [
  ["自分の影と戦う ― 戦闘 (隊の写し身) / 勝てば✦Soul を多めに", { fight: [{ shadows: 0.5 }], win: { soul: 4 } }],
  ["鏡を割る ― 金貨 / 30%で破片が刺さる", { p: 0.7, ok: { gold: 3 }, ng: { hurt: 0.15, gold: 1.5 } }],
], { from: 6 });
ev("inf_u07", "風を呼ぶ笛", "u", "event", ["石の台に、骨で作った小さな笛が置いてある。"], [
  ["吹いてみる ― この階の奇襲が無くなる / 30%で魔物を呼ぶ", { p: 0.7, ok: { floor: { ambushMul: 0 }, say: "風が隊の気配を隠した ― この階は奇襲を受けない" }, ng: { fight: [{ min: 3 }], win: { soul: 2 } } }],
  ["笛を持っていく ― 金貨", { gold: 2.5 }],
]);
ev("inf_u08", "壊れた宝箱の列", "u", "chest", ["宝箱がずらりと並び、そのほとんどがこじ開けられている。一つだけ、錠が残っている。"], [
  ["残った箱を開ける ― 宝箱 (1ランク上)", { chest: { rankUp: 1 } }],
  ["開いた箱の底をさらう ― 金貨", { gold: 3 }],
]);
ev("inf_u09", "古い契約の石板", "u", "story", ["石板に「力を貸す。代わりに、少しもらう」とだけ刻まれている。"], [
  ["契約する ― この出撃の与ダメ +8%・この出撃の敵の力 +5%", { run: { dmgMul: 1.08, enemyMul: 1.05 }, say: "契約は結ばれた ― 与ダメ +8%・敵の力 +5% (この出撃)" }],
  ["石板を割る ― ✦Soul", { soul: 3 }],
]);
ev("inf_u10", "生き埋めの冒険者", "u", "corpse", ["崩れた土の下から、弱々しい声が聞こえる。"], [
  ["掘り出す (STR) ― 成功で礼の品・失敗で HP 2割", { check: "atk", ok: { itemRar: "r" }, ng: { hurt: 0.2, gold: 1 } }],
  ["土の隙間に水を流し込んでやる ― ✦Soul", { soul: 2.5 }],
]);
ev("inf_u11", "灯籠の行列", "u", "event", ["小さな灯籠が、一列になって奥へと続いている。"], [
  ["灯籠を追う ― 宝箱の在処と階段の在処", { chests: 3, stairs: true, say: "灯籠の先に、宝箱と階段が見えた" }],
  ["灯籠をひとつ借りる ― この出撃の会心率 +2%", { run: { crit: 0.02 } }],
]);
ev("inf_u12", "倒れた器の隊", "u", "corpse", ["六体の仮の器が、陣を組んだまま崩れている。最後まで戦ったらしい。"], [
  ["形見を受け継ぐ ― 品 2つ", { item: {}, say: "形見を受け継いだ" , itemRar: "r" }],
  ["陣形を学ぶ ― この出撃の戦闘で 2度、先制", { run: { preempt: 2 }, say: "器の陣形を学んだ ― 先制 2度 (この出撃)" }],
]);
ev("inf_u13", "倒れた仲間を呼ぶ声", "u", "fountain", ["澄んだ水の湧く泉。水面に、倒れた仲間の顔が映っている。"], [
  ["倒れた者を水に浸す ― 1人が HP 全快で蘇る", { revive: true, say: "泉の水が、崩れた器をつなぎ直した" }],
  ["水を汲んで飲む ― HP 4割", { heal: [0.4, 0] }],
], { cond: (A) => A.deadList().length > 0 });
ev("inf_u14", "金と魂の両替商", "u", "gold", ["顔の見えない影が、天秤を持って座っている。「両替は、いかが」"], [
  ["金貨を ✦Soul に ― 金貨を払い、✦Soul を多めに", { cost: { gold: 3 }, soul: 5 }],
  ["✦Soul を金貨に ― ✦Soul を払い、金貨を多めに", { cost: { soul: 2 }, gold: 6 }],
]);
ev("inf_u15", "眠る強敵", "u", "mon", ["大きな影が、壁に背を預けて眠っている。"], [
  ["寝込みを襲う ― 戦闘 (強敵・先制) / 勝てば品", { fight: [{ elite: true }], opening: "preempt", win: { item: { elite: true } } }],
  ["そっと横を抜ける (AGI) ― 成功で✦Soul ・失敗で戦闘", { check: "agi", ok: { soul: 3 }, ng: { fight: [{ elite: true }], win: { item: { elite: true } } } }],
], { from: 6 });
ev("inf_u16", "呪いの宝石", "u", "event", ["台座の上で、赤黒い宝石が脈打つように光っている。"], [
  ["手に取る ― 金貨を多めに・この出撃の敵の力 +8%", { gold: 6, run: { enemyMul: 1.08 }, say: "宝石の呪いが迷宮に広がった ― 敵の力 +8% (この出撃)" }],
  ["台座ごと封じる ― ✦Soul", { soul: 3 }],
]);
ev("inf_u17", "迷宮の鍛冶場", "u", "event", ["炉の火はまだ消えていない。金床の上に、打ちかけの品がある。"], [
  ["続きを打つ (STR) ― 成功でレア以上の品・失敗で火傷", { check: "atk", ok: { itemRar: "r" }, ng: { hurt: 0.15, item: {} } }],
  ["炉の火で体を温める ― HP・MP 3割", { heal: [0.3, 0.3] }],
]);
ev("inf_u18", "魂を量る門", "u", "portal", ["門の柱に「重き魂は通さず」と刻まれている。"], [
  ["門をくぐる ― ✦Soul を払い、この出撃の✦Soul +10%", { cost: { soul: 1.5 }, run: { soulMul: 1.10 }, say: "門が魂を軽くした ― ✦Soul +10% (この出撃)" }],
  ["門の脇を掘る ― 品", { item: {} }],
]);
ev("inf_u19", "怨嗟の壁画", "u", "story", ["壁一面に、倒れた器たちの姿が描かれている。目が、こちらを見ている。"], [
  ["壁画に語りかける ― ✦Soul を多めに / 30%で呪い (この階の敵の力)", { p: 0.7, ok: { soul: 4 }, ng: { soul: 2, floor: { enemyMul: 1.2 } } }],
  ["壁画を削り取る ― 金貨", { gold: 3 }],
]);
ev("inf_u20", "見張りの塔", "u", "event", ["崩れかけた見張りの塔。上に登れば、この階を見渡せそうだ。"], [
  ["登る (AGI) ― 成功で階段と宝箱の在処・失敗で落ちる", { check: "agi", ok: { stairs: true, chests: 4, say: "この階が見渡せた" }, ng: { hurt: 0.2, stairs: true } }],
  ["塔の基部を探る ― 品", { item: {} }],
]);
ev("inf_u21", "毒の泉", "u", "poison", ["紫の水が湧く泉。底に、光る物が沈んでいる。"], [
  ["潜って取る ― レア以上の品・隊の全員が毒", { itemRar: "r", ail: ["poison", 1] }],
  ["泉に解毒の祈りを ― 状態異常を治し、HP 3割", { heal: [0.3, 0, true] }],
]);
ev("inf_u22", "封じられた扉", "u", "trap", ["鎖で幾重にも封じられた扉。向こうから、何かが叩いている。"], [
  ["封を解く ― 戦闘 (強敵) / 勝てば宝箱 (1ランク上)", { fight: [{ elite: true }], win: { chest: { rankUp: 1 } } }],
  ["封を強める ― この階の奇襲が減り、✦Soul", { floor: { ambushMul: 0.5 }, soul: 1.5 }],
], { from: 6 });
ev("inf_u23", "赤い月の窓", "u", "event", ["地の底のはずなのに、壁の窓から赤い月が見える。"], [
  ["月の光を浴びる ― この出撃の会心率 +3% / 30%で魅了", { p: 0.7, ok: { run: { crit: 0.03 } }, ng: { run: { crit: 0.03 }, ail: ["charm", 0.5] } }],
  ["窓を閉ざす ― HP・MP 2割", { heal: [0.2, 0.2] }],
]);
ev("inf_u24", "宝の地図の切れ端", "u", "story", ["誰かが残した地図の切れ端。この階の印が描いてある。"], [
  ["印をたどる ― 宝箱 (2ランク上)", { chest: { rankUp: 2 } }],
  ["地図を売る ― 金貨", { gold: 3 }],
]);
ev("inf_u25", "飢えた群れ", "u", "event", ["飢えた魔物の群れが、隊の匂いを嗅ぎつけて集まってくる。"], [
  ["迎え撃つ ― 戦闘 (大きな群れ) / 勝てば✦Soul と金貨を多めに", { fight: [{ min: 4 }], win: { soul: 3, gold: 3 } }],
  ["食料を投げて逃げる ― 金貨を払い、この階の奇襲が減る", { cost: { gold: 1 }, floor: { ambushMul: 0.5 }, say: "群れは食料に群がった ― この階は奇襲を受けにくい" }],
]);
ev("inf_u26", "器職人の作業台", "u", "event", ["土くれをこねる作業台。器の継ぎ目を直す道具が揃っている。"], [
  ["器の継ぎ目を直す ― HP 5割・状態異常を治す", { heal: [0.5, 0, true] }],
  ["道具を借りて器を固める ― この出撃の戦闘の始めに HP回復 3回", { run: { startHeal: 3 } }],
]);
ev("inf_u27", "火薬樽の山", "u", "trap", ["誰かが持ち込んだ火薬の樽が、山と積まれている。"], [
  ["樽を担いでいく ― この出撃の戦闘で 3度、敵全体に痛打", { run: { bomb: 3 }, say: "火薬を手に入れた ― 発破 3回 (この出撃)" }],
  ["樽を崩して中の金貨を探す ― 金貨 / 30%で爆発", { p: 0.7, ok: { gold: 4 }, ng: { hurt: 0.25, gold: 2 } }],
]);
ev("inf_u28", "囚われの魂", "u", "wisp", ["籠の中で、魂の欠片がひとつ、外へ出ようともがいている。"], [
  ["籠を開ける ― 職業の魂 (レア以上が出やすい)", { soulPick: "rarePlus" }],
  ["籠ごと持っていく ― ✦Soul を多めに", { soul: 3.5 }],
], { from: 11 });
ev("inf_u29", "魔物の祭り", "u", "event", ["魔物たちが輪になって、何かを囲んで騒いでいる。"], [
  ["輪に飛び込む ― 戦闘 (群れ) / 勝てばレア以上の品", { fight: [{ min: 3 }, { single: true }], win: { itemRar: "r" } }],
  ["騒ぎに乗じて宝を探す (LUK) ― 成功で宝箱の在処・失敗で見つかる", { check: "luk", ok: { chests: 3 }, ng: { fight: [{ min: 3 }], win: { gold: 3 } } }],
]);
ev("inf_u30", "迷い込んだ回収人の荷", "u", "gold", ["商会の荷車が、荷をこぼしたまま止まっている。御者の姿は無い。"], [
  ["荷を拾い集める ― 品 2つ (1つはレア以上)", { item: {}, itemRar: "r" }],
  ["荷を見張って待つ ― 戻った御者から金貨", { gold: 4 }],
]);

// ================= 秘 (15) — 1回の出撃で1度まで =================
ev("inf_r01", "古い王の宝物庫", "r", "chest", ["崩れた扉の奥に、古い王家の印の宝物庫がある。"], [
  ["中へ入る ― 宝箱 (3ランク上) / 番人との戦闘", { fight: [{ elite: true, strong: 1.2 }], win: { chest: { rankUp: 3 } } }],
  ["入口の飾りだけ外す ― 金貨を多めに", { gold: 8 }],
], { from: 11 });
ev("inf_r02", "魂の泉", "r", "wisp", ["魂の欠片が、泉のように湧き出している。"], [
  ["泉に手を浸す ― 職業の魂 (レア以上) と✦Soul", { soulPick: "rarePlus", soul: 4 }],
  ["泉の水を飲む ― HP・MP 全快", { heal: [1, 1, true] }],
], { from: 11 });
ev("inf_r03", "灯の守り手の墓", "r", "corpse", ["灯籠を抱いたまま眠る、古い人業の墓。"], [
  ["灯籠を受け継ぐ ― この出撃の与ダメ +8%・戦闘の始めに HP回復 5回", { run: { dmgMul: 1.08, startHeal: 5 }, say: "灯の守りを受け継いだ (この出撃)" }],
  ["墓を掘る ― スーパーレア以上の品が出やすい / この出撃の敵の力 +10%", { itemRar: "sr", run: { enemyMul: 1.10 } }],
], { from: 16 });
ev("inf_r04", "竜の骨の間", "r", "event", ["巨大な竜の骨が、部屋いっぱいに横たわっている。骨の奥で、何かが光っている。"], [
  ["骨の奥へ ― スーパーレア以上の品 / 骨の番人との戦闘", { fight: [{ elite: true, strong: 1.3 }], win: { itemRar: "sr" } }],
  ["骨の欠片を拾う ― 魂の残火 4つ", { ember: 4 }],
], { from: 21 });
ev("inf_r05", "時の止まった部屋", "r", "event", ["砂時計の砂が、宙で止まっている。この部屋では、時が流れていない。"], [
  ["ゆっくり休む ― HP・MP 全快・状態異常を治す", { heal: [1, 1, true] }],
  ["止まった砂を集める ― この出撃の戦闘で 4度、先制", { run: { preempt: 4 } }],
]);
ev("inf_r06", "大鏡の試し", "r", "event", ["見上げるほどの大鏡。映った隊が、こちらに剣を向けた。"], [
  ["写し身と戦う ― 戦闘 (隊の写し身) / 勝てばこの出撃の与ダメ +10%", { fight: [{ shadows: 0.7 }], win: { run: { dmgMul: 1.10 }, soul: 4, say: "己に勝った ― 与ダメ +10% (この出撃)" } }],
  ["鏡に背を向ける ― ✦Soul", { soul: 4 }],
], { from: 11 });
ev("inf_r07", "残火の炉", "r", "ember", ["魂の残火が、炉の中で静かに燃え続けている。"], [
  ["残火をすくう ― 魂の残火 6つ / HP 3割を払う", { cost: { hp: 0.3 }, ember: 6 }],
  ["炉の熱で器を焼き締める ― この出撃の戦闘の始めに HP回復 6回", { run: { startHeal: 6 } }],
], { from: 11 });
ev("inf_r08", "契約の悪魔", "r", "event", ["影の中から、角のある何かが笑いかける。「欲しいものを言え。代わりは、後でもらう」"], [
  ["力を願う ― この出撃の与ダメ +15%・この出撃の敵の力 +12%", { run: { dmgMul: 1.15, enemyMul: 1.12 }, say: "悪魔は笑った ― 与ダメ +15%・敵の力 +12% (この出撃)" }],
  ["富を願う ― 金貨を山ほど・この出撃の奇襲が増える", { gold: 12, run: { ambushMul: 1.8 } }],
  ["魂を願う ― 職業の魂 (レア以上)・HP 4割を払う", { cost: { hp: 0.4 }, soulPick: "rarePlus" }],
], { from: 16 });
ev("inf_r09", "風の神殿", "r", "portal", ["吹き上げる風が、ここでは柱の間を静かに巡っている。"], [
  ["風に身を任せる ― この出撃の✦Soul +15%・金貨 +15%", { run: { soulMul: 1.15, goldMul: 1.15 }, say: "風が隊を祝福した (この出撃)" }],
  ["祭壇を調べる ― スーパーレア以上の品", { itemRar: "sr" }],
], { from: 21 });
ev("inf_r10", "迷宮の主の玉座", "r", "mon", ["誰もいない玉座。座面に、まだ温もりが残っている。"], [
  ["玉座に座る ― この出撃の会心率 +4%・この出撃の敵の力 +8%", { run: { crit: 0.04, enemyMul: 1.08 } }],
  ["玉座の主を待つ ― 戦闘 (強敵) / 勝てばスーパーレア以上の品", { fight: [{ elite: true, strong: 1.4 }], win: { itemRar: "sr", soul: 4 } }],
], { from: 26 });
ev("inf_r11", "崩れた器の大墳墓", "r", "corpse", ["数えきれない仮の器が、土に還ろうとしている。魂の欠片が、あちこちで瞬いている。"], [
  ["欠片を拾い集める ― 職業の魂 2つ", { soulPick: ["normal", "normal"], say: "欠片を拾い集めた" }],
  ["墳墓に眠る者たちを弔う ― ✦Soul を多めに・状態異常を治す", { soul: 6, heal: [0.3, 0.3, true] }],
]);
ev("inf_r12", "黄金の間", "r", "gold", ["床も壁も天井も、すべて金貨で覆われている。"], [
  ["持てるだけ持つ ― 金貨を山ほど / 30%で番人が目覚める", { p: 0.7, ok: { gold: 15 }, ng: { fight: [{ elite: true }], win: { gold: 15 } } }],
  ["一枚だけ持っていく ― この出撃の金貨 +20%", { run: { goldMul: 1.20 }, gold: 1 }],
], { from: 6 });
ev("inf_r13", "星の降る井戸", "r", "event", ["井戸の底から、星のような光が昇ってくる。"], [
  ["光を受け止める ― この出撃の会心率 +3%・✦Soul", { run: { crit: 0.03 }, soul: 5 }],
  ["井戸に降りる ― スーパーレア以上の品 / 50%で落ちて HP 3割", { p: 0.5, ok: { itemRar: "sr" }, ng: { hurt: 0.3, itemRar: "r" } }],
], { from: 16 });
ev("inf_r14", "嘆きの合唱", "r", "wisp", ["どこからか、大勢の嘆きの歌が聞こえる。聞いていると、力が抜けていく。"], [
  ["歌に加わる ― MP 5割を払い、この出撃の✦Soul +20%", { cost: { mp: 0.5 }, run: { soulMul: 1.20 } }],
  ["歌の源を断つ ― 戦闘 (群れ) / 勝てば職業の魂 (レア以上)", { fight: [{ min: 4 }], win: { soulPick: "rarePlus" } }],
], { from: 16 });
ev("inf_r15", "回収人の秘密の倉", "r", "chest", ["商会の印の入った、頑丈な隠し倉。鍵は、壊れている。"], [
  ["中を見る ― 宝箱 (2ランク上) と金貨", { gold: 4, chest: { rankUp: 2 } }],
  ["倉のことは黙っておく ― ✦Soul を多めに", { soul: 6 }],
], { from: 11 });

export const INF_EVENTS = LIST;
// 検査: id の重複・数
{
  const seen = new Set();
  for (const e of INF_EVENTS) { if (seen.has(e.id)) throw new Error(`infevents: id の重複 ${e.id}`); seen.add(e.id); }
  if (INF_EVENTS.length < 100) throw new Error(`infevents: 出来事は100種のはず (いま ${INF_EVENTS.length})`);
}
