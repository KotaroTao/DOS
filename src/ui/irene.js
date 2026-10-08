// ===== 人業の館の主イレーヌ — 初訪問の挨拶 (会話の場面) と、来館ごとのひとこと =====
// 人業の館 (隊タブ) の下段の挿絵と台詞 (party.js の keeperPanel) が使う。
//   ・初めて館を訪れた時: playIreneScene(greetingPages()) で挨拶と館の案内を語る (全画面の会話の場面)
//   ・館に入るたび: nextLine({ entry: true }) が、いま話せる話題からひとつ選ぶ (タップで次の話)
// 話題 (LINES) は when(c) で開く。ゲームが進み要素が解放されるたびに、話せることが増えていく。
//   kind: chat = 他愛のない話 / hint = 仕組みの助言 / now = いまの状況への助言 (当てはまる時だけ)
//   fresh = 開いた直後の来館で、真っ先に話す (新しく解放された要素の知らせ)
//   must = 当てはまる間は必ずこれを話す (人業がまだいない時の案内)
//   bond / until / 段ごとの say = 親しさ。口調は全段でです・ます調。最初はよそよそしく、層を進めるほど親密になる (よそよそしい話は、打ち解けたらもうしない)
// 状態は G.irene = { greeted, visits, seen: {id: 回数}, last } (セーブされる)。
// game.js は import しない (ctx.js の UI / game を通す)。

import { game, UI } from "./ctx.js";
import { el } from "./kit.js";
import { nav } from "./nav.js";
import { animate, reduced } from "./motion.js";
import { SFX } from "../audio.js";
import { soulByUid, soulLevelCapOf, soulRankOf, SOUL_CLASSES, soulSeriesName } from "../souls.js";
import { MAX_ITEMS, weaponRange } from "../items.js";

export const IRENE_WHO = "人業の館の主　イレーヌ";
export const IRENE_ART = "./art/mansion_irene.jpg"; // ユーザーの原画 (ドット絵にせずそのまま)

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* 音は演出のみ */ } };

// ---------- 状態 ----------
export function ireneState() {
  const G = game.G;
  if (!G) return { greeted: true, visits: 0, seen: {}, last: null };
  if (!G.irene || typeof G.irene !== "object") G.irene = { greeted: false, visits: 0, seen: {}, last: null };
  if (!G.irene.seen || typeof G.irene.seen !== "object") G.irene.seen = {};
  return G.irene;
}
export function isGreeted() { return !!ireneState().greeted; }

// ---------- いまの状況 (話題の鍵) ----------
const safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };

function ctxNow() {
  const G = game.G || {};
  const party = (G.party || []).filter(Boolean);
  const reserve = (G.reserve || []).filter(Boolean);
  const dolls = [...party, ...reserve].filter((d) => !d.isEmpty);
  const items = [];
  for (const d of [...party, ...reserve]) {
    for (const it of (d.items || [])) if (it) items.push(it);
    for (const k in (d.equip || {})) if (d.equip[k]) items.push(d.equip[k]);
  }
  const ms = G.msq || {};
  const stats = G.stats || {};
  const cleared = safe(() => game.clearedDungeonCount(), 0);
  const reported = safe(() => game.reportedDungeonCount(), 0);
  const chapters = safe(() => game.chaptersDone(), 0);
  const w = safe(() => game.worldState(), {}) || {};
  const feature = (k) => safe(() => !!game.featureUnlocked(k), false);
  const worn = (uid) => dolls.some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const souls = (G.souls || []).filter(Boolean);
  return {
    G, party, reserve, dolls, items, ms, stats, cleared,
    visits: ireneState().visits || 0,
    chapters,                                            // 結びを迎えた章の数 (章ごとの台詞は when: (c) => c.chapters >= n で)
    bond: bondOf(reported, chapters, ireneState().visits || 0), // 親しさの段 (0〜5)
    act: ms.n || 0,                                      // 0 = 第0章の途中 / 1 = 師を捜す旅の途中
    open: (id) => !!(w.open && w.open[id]),              // 迷宮が地図にあるか (world.js の id)
    done: (id) => !!(w.cleared && w.cleared[id]),        // 迷宮を踏破したか
    found: (k) => !!(w.found && w.found[k]),             // 師の手がかり (物語マス) を見つけたか
    beat: (k) => !!(w.beats && w.beats[k]),              // 主の記憶・館の語り・章の結びを語り終えたか
    revealed: !!(w.beats && w.beats.irene_reveal),       // 自分が人業だと明かした後か
    sealed: safe(() => !!game.contentSealed(), false),
    fusion: feature("fusion"),
    rumor: feature("rumor"),
    order: feature("order"),
    subs: safe(() => game.unlockedSubSlots(), 0),
    deaths: stats.deaths || 0,
    bossKills: stats.bossKills || 0,
    maxRank: souls.reduce((m, s) => Math.max(m, safe(() => soulRankOf(s), 1)), 0),
    freeSouls: souls.filter((s) => !worn(s.uid)),
    hasUnid: items.some((it) => it.unidentified),
    hasCursed: items.some((it) => it.cursed && !it.unidentified),
    hasRare: items.some((it) => ["r", "sr", "lr"].includes(it.rar)),
    hasSR: items.some((it) => ["sr", "lr"].includes(it.rar)),
    hasLR: Object.keys(G.lrOwned || {}).length > 0,
    hasElem: items.some((it) => it.eAtk || it.eDef) || Object.keys(stats.elemKills || {}).length > 0,
    hasWeapon: items.some((it) => it.slot === "weapon"),
  };
}

// いまの状況への助言で使う、当てはまる人業 (最初のひとり)
const deadDoll = (c) => c.dolls.find((d) => d.alive === false) || null;
const hurtDoll = (c) => c.party.find((d) => d.alive !== false && d.maxhp > 0 && d.hp < d.maxhp * 0.5) || null;
const fullBag = (c) => c.party.find((d) => (d.items || []).length >= MAX_ITEMS) || null;
const backMelee = (c) => c.party.find((d, i) => i >= 3 && d.primary != null && d.equip && d.equip.weapon && !d.equip.weapon.unidentified && weaponRange(d.equip.weapon) === "near") || null;
function trainable(c) {
  const pts = c.G.soulPts || 0;
  for (const d of c.party) {
    const s = d.primary != null ? soulByUid(d.primary) : null;
    if (!s) continue;
    const cost = safe(() => game.soulTrainCost(s.level), Infinity);
    if (s.level < safe(() => soulLevelCapOf(s), 0) && pts >= cost) return s;
  }
  return null;
}
function fusable(c) {
  if (!c.fusion) return null;
  for (const d of c.party) {
    if (d.primary == null) continue;
    if (safe(() => game.fuseCandidates(d.primary).length, 0) > 0) return soulByUid(d.primary);
  }
  return null;
}
const canMake = (c) => c.party.length < 6 && c.freeSouls.length > 0 && (c.G.redSoul || 0) >= safe(() => game.emptyDollCost(), Infinity);
// 第0章で仕立てる残りの数 (最初は三体、報告後は四体)。
const tutLeft = (c) => (c.ms.n === 0 && c.ms.granted && c.dolls.length) ? Math.max(0, (c.ms.stage === "fourth" ? 4 : 3) - c.dolls.length) : 0;
const jobName = (s) => (s && SOUL_CLASSES[s.clsKey] ? soulSeriesName(s.clsKey) : "宿した");

// ---------- 親しさ (よそよそしい → 親密) ----------
// 段 0〜5 = min(2, 王に報告した本筋の迷宮の数) + 結びを報告した章の数。章の結びごとに1段ずつ打ち解ける。
// 報告の総数でなく章の結びで数えるので、迷宮を回る順 (黒水の取水口を後回しにする等) でずれない。
// 依頼の迷宮は数えない (寄り道の多少で口調が変わらないように)。ただし館に通った回数でも頭打ちにする
// (記録の深い所から初めて館に来ても、出会いはよそよそしい所から始まる)。
//   0 他人行儀 (です・ます、冷ややか) / 1 顔見知り (最初の報告。丁寧だが少し和らぐ) / 2 打ち解け (2つ目の報告。丁寧なまま親しみが増す)
//   3 親しみ (第一章の結び。名で呼ばせる) / 4 親密 (第二章の結び。身の上を語る) / 5 特別 (第三章の結び。秘密を明かす)
// 第四章からは段を増やさず、章ごとの話題 (LINES の when: (c) => c.chapters >= 3 など) で深める
const BOND_VISITS = [0, 2, 4, 6, 9, 12];   // その段に要る来館数
export const BOND_NAME = ["他人行儀", "顔見知り", "打ち解け", "親しみ", "親密", "特別"];
const stageOf = (v, th) => { let s = 0; for (let i = 0; i < th.length; i++) if (v >= th[i]) s = i; return s; };
function bondOf(reported, chapters, visits) { return Math.min(5, Math.min(2, reported) + chapters, stageOf(visits, BOND_VISITS)); }
export function ireneBond() { const c = ctxNow(); return c.bond; }

// ---------- 話題 ----------
// say: [1行目, 2行目] / (c) => [..] (人業の名などを差し込む時) /
//      { 段: [..] か (c) => [..], … } = 親しさの段ごとの表現 (いまの段以下で、いちばん高い段の言い方を使う)
// bond = 話しはじめる段 (既定 0) / until = この段を越えたら、もう話さない (よそよそしい頃だけの話)
const LINES = [
  // ---- 親しさの節目 (その段になった直後の来館で、ほかの新しい話題より先に話す) ----
  { id: "m_bond1", kind: "chat", fresh: true, bond: 1, until: 1,
    say: ["……また、来られたのですね。", "いえ。この館へ二度来る操霊師は、珍しいものですから。"] },
  { id: "m_bond2", kind: "chat", fresh: true, bond: 2, until: 2,
    say: ["……もう、そんなに堅苦しくしなくて大丈夫です。", "わたしも、少し肩の力を抜きますね。"] },
  { id: "m_bond3", kind: "chat", fresh: true, bond: 3, until: 3,
    say: ["イレーヌ、と呼んでくださって構いませんよ。", "様なんて付けられると、背中がむずがゆくなるのです。"] },
  { id: "m_bond4", kind: "chat", fresh: true, bond: 4, until: 4,
    say: ["あなたが来ると、館の蝋燭が少し明るくなるのです。", "……本当です。人業たちも、そう言っています。"] },
  { id: "m_bond5", kind: "chat", fresh: true, bond: 5,
    say: ["最初に会った日のこと、覚えていますか。", "あんなに冷たくして……ごめんなさい。怖かったのです。"] },

  // ---- いまの状況 (当てはまる時だけ。上ほど急ぎ) ----
  { id: "n_nodoll", kind: "now", must: true, when: (c) => !c.dolls.length, say: {
    0: ["では、宿す魂をひとつお選びください。", "器はこちらで仕立てます。オルド様のお弟子さまですから、最初の三体にお代は要りません。"],
    2: ["さあ、宿す魂をひとつ選んでください。", "器はわたしが仕立てます。"] } },
  // 第0章「人業の生成」: 三体、報告後は四体。揃うまで必ず数を告げる
  { id: "n_tut4", kind: "now", must: true, when: (c) => tutLeft(c) > 0 && canMake(c), say: {
    0: (c) => [`王命は人業を${c.ms.stage === "fourth" ? "四" : "三"}体、でございましたね。あと${tutLeft(c)}体です。`, "残る魂を、ひとつずつ器にお宿しください。"],
    2: (c) => [`王様の命は${c.ms.stage === "fourth" ? "四" : "三"}体でしたね。あと${tutLeft(c)}体です。`, "残る魂も、器に宿してあげてください。"] } },
  { id: "n_dead", kind: "now", when: (c) => !!deadDoll(c), say: {
    0: (c) => deadDoll(c).reviveAt ? [`${deadDoll(c).name}の器は、まだ迷宮に残されたままです。`, "時が経てば連れ帰られます。赤い魂で迎えを早めることもできます。"]
      : [`${deadDoll(c).name}の器が、砕けたままです。`, "その子を選べば、金貨で砕けた魂を修復いたします。"],
    2: (c) => deadDoll(c).reviveAt ? [`${deadDoll(c).name}の器、まだ迷宮に残されたままですね……`, "時が経てば連れ帰られるけれど、赤い魂で迎えを早めることもできます。"]
      : [`${deadDoll(c).name}の器が、砕けたままですね……`, "その子を選んでください。金貨さえあれば、砕けた魂を繕います。"],
    4: (c) => deadDoll(c).reviveAt ? [`${deadDoll(c).name}……また無茶をさせたのですね。`, "迎えは赤い魂で早められます。届いたら、魂はわたしが繕います。"]
      : [`${deadDoll(c).name}……また無茶をさせたのですね。`, "選んでくれれば、魂はわたしが繕います。……あなたも、少し休んでください。"] } },
  { id: "n_hurt", kind: "now", when: (c) => !!hurtDoll(c), say: {
    0: (c) => [`${hurtDoll(c).name}の器が傷んでいます。`, "潜る前に、宿屋で休ませるのがよいと思います。"],
    2: (c) => [`${hurtDoll(c).name}、ずいぶん傷んでいます。`, "潜る前に、宿屋で休ませてあげてください。"],
    4: (c) => [`${hurtDoll(c).name}の傷、見ていられません。`, "宿屋へ連れていってください。……あなたの顔色も、よくありませんよ。"] } },
  { id: "n_unid", kind: "now", when: (c) => c.hasUnid, say: {
    0: ["伏せ名の品をお持ちですね。", "商会で鑑定なされば、身に着けられるようになります。"],
    2: ["伏せ名の品を持っていますね。", "商会で鑑定すれば、正体を明かして身に着けられます。"] } },
  { id: "n_better", kind: "now", when: () => safe(() => UI.betterGearCount() > 0, false), say: {
    0: ["袋の中に、より相応しい品があるようです。", "『最適装備』をお使いください。"],
    2: ["もっと似合う衣が、袋の中で眠っています。", "『最適装備』を押してみてください。"],
    4: ["あら、その子にはもっと似合う衣がありますよ。", "『最適装備』……わたしに選ばせてくれてもいいのですよ。"] } },
  { id: "n_train", kind: "now", when: (c) => !!trainable(c), say: {
    0: (c) => ["✦Soulが貯まっています。", `『魂』の区分で、${jobName(trainable(c))}の魂を強化できます。`],
    2: (c) => ["✦Soulが貯まっていますね。", `『魂』の区分で、${jobName(trainable(c))}の魂を強化してあげてください。`] } },
  { id: "n_make", kind: "now", when: (c) => c.dolls.length > 0 && canMake(c), say: {
    0: ["宿り手のいない魂がございます。", "器をお仕立てになるなら、お申しつけください。"],
    2: ["宿り手のいない魂が、まだ眠っています。", "器を仕立てて、目覚めさせてあげましょう。"] } },
  { id: "n_fuse", kind: "now", when: (c) => !!fusable(c), say: {
    0: (c) => [`${jobName(fusable(c))}の魂が、ひとつ余っています。`, "『魂』の区分で魂融合すれば、魂の格が上がります。"],
    2: (c) => [`${jobName(fusable(c))}の魂が、もうひとつ余っていますね。`, "『魂』の区分で魂融合すれば、魂の格が上がります。"] } },
  { id: "n_backmelee", kind: "now", when: (c) => !!backMelee(c), say: {
    0: (c) => [`後衛の${backMelee(c).name}に、刃の短い得物は不向きです。`, "届くのは敵の前衛のみ。力も半分になります。"],
    2: (c) => [`後衛の${backMelee(c).name}に、刃の短い得物は不向きです。`, "届くのは敵の前衛だけです。それも力は半分になります。"] } },
  { id: "n_bag", kind: "now", when: (c) => !!fullBag(c), say: {
    0: (c) => [`${fullBag(c).name}の袋が一杯です。`, "不要な品は、商会でお手放しください。"],
    2: (c) => [`${fullBag(c).name}の袋が、もう一杯ですね。`, "要らない品は、商会で手放しておいてください。"] } },
  { id: "n_embers", kind: "now", when: (c) => (c.G.embers || 0) > 0, say: {
    0: ["魂の残火をお持ちですね。", "『魂』の区分で、魂の育つ限りを押し広げられます。"],
    2: ["魂の残火を持っていますね。", "『魂』の区分で使えば、魂の育つ限りを押し広げられます。"] } },
  { id: "n_solo", kind: "now", when: (c) => c.party.length === 1 && !canMake(c), say: {
    0: ["一体きりで迷宮へ……ですか。", "差し出がましいようですが、仲間をお勧めします。"],
    2: ["一体きりで迷宮へ行くのですか。", "……背中を預けられる仲間がいれば、魂も心強いと思いますよ。"] } },

  // ---- 仕組みの助言 (使えるようになったら話す) ----
  { id: "h_core", kind: "hint", when: (c) => c.dolls.length > 0, say: {
    0: ["人業とは、魂に刻まれた力のかたちです。", "迷われた時は、前衛と後衛の役割をお見直しください。"],
    2: ["人業とは、魂に刻まれた力のかたちです。", "迷った時は、前衛と後衛の役割を見直してみてください。"] } },
  { id: "h_gear", kind: "hint", when: (c) => c.dolls.length > 0, say: {
    0: ["装備は器の衣です。", "似合わぬ衣は、魂を窮屈にさせるだけですので。"],
    2: ["装備は器の衣です。", "似合わぬ衣は、魂を窮屈にさせるだけです。"] } },
  { id: "h_rows", kind: "hint", when: (c) => c.dolls.length > 0, say: {
    0: ["前衛は刃を受け、後衛は受ける傷も与える傷も半分になります。", "力ある器は前へ、術者と射手は後ろへ並べてください。"],
    2: ["前衛は刃を受け止める盾です。後衛は、受ける傷も与える傷も半分になります。", "力自慢は前へ、術者と射手は後ろへ並べてください。"],
    4: ["前は盾、後ろは牙です。……ふふ、もう言うまでもありませんね。", "それでも、あなたの子たちの並びを見るのは好きです。"] } },
  { id: "h_form", kind: "hint", when: (c) => c.party.length >= 2, say: {
    0: ["隊列の札は、長く押せば並べ替えられます。", "並びひとつで、人業の運命は変わりますので。"],
    2: ["隊列の札は、長く押して並べ替えられます。", "並びひとつで、人業の運命は変わるものです。"] } },
  { id: "h_auto", kind: "hint", when: (c) => c.dolls.length > 0, say: {
    0: ["装備にお迷いなら『最適装備』をお使いください。", "器に相応しい品を、こちらで見繕います。"],
    2: ["装備に迷ったら『最適装備』を押してください。", "器に似合う衣を、わたしが見繕います。"],
    4: ["装備はわたしにお任せください。『最適装備』です。", "あなたの子たちのことなら、目を閉じていても選べます。"] } },
  { id: "h_range", kind: "hint", when: (c) => c.hasWeapon, say: {
    0: ["剣や斧が届くのは、敵の前衛のみです。", "槍は前衛から奥まで、弓はどこへでも届きます。"],
    2: ["剣や斧が届くのは、敵の前衛だけです。", "槍なら前衛から奥まで、弓ならどこへでも届きます。"] } },
  { id: "h_train", kind: "hint", when: (c) => c.act >= 1 && c.dolls.length > 0, say: {
    0: ["迷宮で集めた✦Soulは、魂を育てる糧です。", "強くなるのは器ではなく、宿った魂そのものです。"],
    2: ["迷宮で集めた✦Soulは、魂を育てる糧です。", "器ではなく、宿った魂そのものが強くなるのです。"] } },
  { id: "h_inn", kind: "hint", when: (c) => c.act >= 1, say: {
    0: ["傷んだ器は、宿屋で休ませるのがよいと思います。", "疲れた魂は、器の中できしみますので。"],
    2: ["傷ついた器は、宿屋で休ませてください。", "疲れた魂は、器の中できしむものです。"] } },
  { id: "h_spell", kind: "hint", when: (c) => c.act >= 1, say: {
    0: ["術は、前に立っても後ろに立っても力を落としません。", "後衛の魔導士は、隊の鋭い牙となりましょう。"],
    2: ["術は、隊列の前でも後ろでも力を落としません。", "後衛の魔導士こそ、隊のいちばん鋭い牙です。"] } },
  { id: "h_unid", kind: "hint", when: (c) => c.hasUnid || c.items.some((it) => it.slot && it.slot !== "use" && it.slot !== "misc"), say: {
    0: ["迷宮で拾われた品は、伏せ名のままです。", "正体を明かすまでは、身に着けられません。"],
    2: ["迷宮で拾った品は、伏せ名のままです。", "正体を明かすまでは、身に着けられないのです。"] } },
  { id: "h_curse", kind: "hint", fresh: true, when: (c) => c.hasCursed, say: {
    0: ["呪われた品は、一度身に着ければ外れません。", "……お気をつけください。"],
    2: ["呪われた品は、一度身に着けたら外れません。", "……着せる前に、よく見定めてください。"] } },
  { id: "h_rarity", kind: "hint", fresh: true, when: (c) => c.hasRare, say: {
    0: ["品の名の色は、格の証です。", "白、緑、青、橙、そして赤。赤い名には、滅多に出会えません。"],
    2: ["品の名の色は、格の証です。", "白、緑、青、橙……赤い名の品に出会えたら、それは運命です。"] } },
  { id: "h_sr", kind: "hint", when: (c) => c.hasSR, say: {
    0: ["橙の名の品をお持ちですね。", "器の格まで引き上げる品です。"],
    2: ["橙の名の品を手に入れたのですね。", "ああいう品は、器の格まで引き上げてくれます。"] } },
  { id: "h_lr", kind: "hint", fresh: true, when: (c) => c.hasLR, say: {
    0: ["赤い名の品……レジェンドレアは、世にひとつきりです。", "持ち主を選ぶ品です。大切にしてください。"],
    2: ["赤い名の品……レジェンドレアは、世にひとつきりです。", "持ち主を選ぶ品です。大切にしてください。"],
    4: ["その赤い名の品……あなたを選んだのですね。", "妬けますね。わたしの人業たちより、ずっと一途です。"] } },
  { id: "h_reserve", kind: "hint", fresh: true, when: (c) => c.reserve.length > 0, say: {
    0: ["控えの器も、見ておりますよ。", "右上の『控え』から、隊と入れ替えられます。"],
    2: ["控えの子たちも、ちゃんと見ています。", "右上の『控え』から、いつでも隊と入れ替えられるのです。"] } },
  { id: "h_rescue", kind: "hint", fresh: true, when: (c) => c.deaths > 0, say: {
    0: ["砕けた器は、街へ戻っても自然には目覚めません。この館で、金貨と引き換えに砕けた魂を修復いたします。", "皆が倒れた時は、器はほかの冒険者が時を経て連れ帰ります。深い階ほど、時がかかります。"],
    2: ["砕けた器は、街へ戻っても自然には目覚めないのです。この館で、金貨と引き換えに魂を繕います。", "皆が倒れた時は、ほかの冒険者が器を連れ帰ってくれます。深い階ほど、時がかかります。"] } },
  { id: "h_embers", kind: "hint", when: (c) => (c.G.embers || 0) > 0 || c.cleared >= 2, say: {
    0: ["魂の残火は、死者が遺した最後の熱です。", "育ちきった魂に与えれば、もう一歩先へ伸びます。"],
    2: ["魂の残火は、死者が遺した最後の熱です。", "育ちきった魂に与えれば、もう一歩先へ伸びられます。"] } },
  { id: "h_boss", kind: "hint", when: (c) => c.act >= 1 && c.cleared < 5, say: {
    0: ["層の底には、主が棲むと聞きます。", "挑まれる前に、傷と装備をお整えください。"],
    2: ["層の底には、主が棲んでいるそうです。", "挑む前に、傷と装備を整えておいてください。"] } },
  { id: "h_elem", kind: "hint", fresh: true, when: (c) => c.hasElem, say: {
    0: ["火は風を、風は土を、土は水を、水は火を制します。", "光と闇は、互いを喰らい合います。"],
    2: ["火は風を、風は土を、土は水を、水は火を制します。", "光と闇は、互いを喰らい合います。属性を味方につけてください。"] } },
  { id: "h_fusion", kind: "hint", fresh: true, when: (c) => c.fusion, say: {
    0: ["同じ職の魂を、ひとつに束ねられるようになりました。", "魂融合を重ねるほど格が上がり、新たな加護を覚えます。"],
    2: ["同じ職の魂を、ひとつに束ねられるようになりました。", "魂融合を重ねるほど格が上がり、新たな加護を覚えるのです。"] } },
  { id: "h_rank", kind: "hint", fresh: true, when: (c) => c.maxRank >= 2, say: {
    0: ["格の上がった魂は、器に新たな加護を授けます。", "束ねた魂が多いほど、魂の育つ限りも高くなります。"],
    2: ["格の上がった魂は、器に新たな加護を授けます。", "束ねた魂が多いほど、魂の育つ限りも高くなるのです。"] } },
  { id: "h_subs", kind: "hint", fresh: true, when: (c) => c.subs >= 1, say: {
    0: ["器に、もうひとつ魂を宿せるようになりました。", "宿し技……ほかの職の秘技を、借りられます。"],
    2: ["器に、もうひとつ魂を宿せるようになりました。", "宿し技……ほかの職の秘技を、借りられるのです。"] } },
  { id: "h_subs2", kind: "hint", fresh: true, when: (c) => c.subs >= 2, say: {
    0: ["宿し技の枠が、ふたつに増えました。", "三つの魂を抱く器……お見事です。"],
    2: ["宿し技の枠が、ふたつに増えました。", "三つの魂を抱く器……あなたの手も、ずいぶん慣れてきましたね。"] } },
  { id: "h_order", kind: "hint", fresh: true, when: (c) => c.order, say: {
    0: ["隊に加えていない魂も、無駄にはなりません。", "控えの結社に席を与えれば、その力をみなに分けてくれます。"],
    2: ["隊に加えていない魂も、無駄にはならないのです。", "控えの結社に席を与えれば、その力をみんなに分けてくれます。"] } },
  { id: "h_rumor", kind: "hint", fresh: true, when: (c) => c.rumor, say: {
    0: ["酒場の噂が、迷宮の様子を変えることがあるそうです。", "耳は澄ませておかれるとよいでしょう。"],
    2: ["酒場の噂が、迷宮の様子を変えることがあるそうですね。", "宝の噂か、罠の噂か……耳は澄ませておいてください。"] } },

  // ---- よそよそしい頃だけの話 (打ち解けたら、もう話さない) ----
  { id: "f_busy", kind: "chat", until: 0, say: ["ご用件はお済みですか。", "でしたら、人業たちを起こさぬよう、お静かにお願いします。"] },
  { id: "f_touch", kind: "chat", until: 1, say: ["棚の人業には、お手を触れないでください。", "あの子たちは、まだ誰の魂も知りませんので。"] },
  { id: "f_name", kind: "chat", until: 0, say: ["わたしの名ですか。", "……イレーヌ。それ以上は、お仕事に要りませんでしょう。"] },
  { id: "f_tea", kind: "chat", until: 1, say: ["お茶はお出ししておりません。", "ここは工房であって、客間ではございませんので。"] },
  { id: "f_king", kind: "chat", until: 1, when: (c) => c.dolls.length > 0,
    say: ["王さまにお会いになったのですね。", "オルド様は……いえ。あの方のことは、迷宮が教えてくれるでしょう。"] },
  { id: "f_candle", kind: "chat", until: 1, say: ["奥の燭台の灯は、オルド様の魂に結んだ灯です。", "消えていないかぎり、あの方は、まだどこかにいるはずです。"] },
  { id: "s1_ask", kind: "chat", bond: 1, until: 1, when: (c) => c.cleared >= 1,
    say: ["迷宮は、いかがでしたか。", "……いえ。器の傷み具合を伺っただけです。"] },
  { id: "s1_hair", kind: "chat", bond: 1, until: 1,
    say: ["人業の髪をとかすのが、わたしの日課です。", "……魂のない子ほど、よく眠るのですよ。"] },
  { id: "s1_wood", kind: "chat", bond: 1, until: 1,
    say: ["器の木は、墓地の古いニレから削り出しています。", "死者を見送ってきた木は、魂を拒みませんので。"] },

  // ---- 打ち解けてから (親しみのある世間話) ----
  { id: "c_hair", kind: "chat", bond: 2, say: ["人業たちの髪をとかすのが、わたしの日課なのです。", "……魂のない子ほど、よく眠るのです。"] },
  { id: "c_candle", kind: "chat", bond: 2, say: ["燭台の灯、今夜も揺れていますね。", "あの方の魂が、まだこの世にある証です。……消えたら、なんて考えたくありません。"] },
  { id: "c_wood", kind: "chat", bond: 2, say: ["器の木は、墓地の古いニレから削り出すのです。", "死者を見送ってきた木は、魂を拒まないのです。"] },
  { id: "c_steps", kind: "chat", bond: 2, say: ["夜更けに、二階の人業が歩く音がするのです。", "怖がらなくて大丈夫です。あの子たちは、ただ寂しいだけなのです。"] },
  { id: "c_orb", kind: "chat", bond: 2, say: ["机の上の水晶玉ですか。あれは魂の揺りかごです。", "器を待つ魂が、ときどき中で寝返りを打つのです。"] },
  { id: "c_honest", kind: "chat", bond: 2, when: (c) => c.dolls.length > 0,
    say: ["器は嘘をつきません。", "傷もひびも、宿した魂の生き様そのものです。"] },
  { id: "c_firstdoll", kind: "chat", bond: 2, when: (c) => c.dolls.length > 0,
    say: ["あなたが最初に仕立てた子、覚えていますか。", "初めての器には、操霊師の癖がいちばん出るものです。"] },
  { id: "c_grave", kind: "chat", when: (c) => c.open("w01") && !c.done("w03"), say: {
    0: ["墓地の迷宮へ行かれるのですね。", "あそこの死者は眠りが浅いのです。足音はお静かにお願いします。"],
    2: ["墓地の迷宮へ行くのですね。", "あそこの死者は眠りが浅いのです。足音は静かにお願いします。"] } },
  // ---- 師の手がかり (物語の進みに合わせて) ----
  { id: "m_lamp", kind: "chat", fresh: true, when: (c) => c.found("w01_lantern"), say: {
    0: ["……オルド様の、ランタン。", "魂火がまだ揺れています。あの方は、まだ還っていません。"],
    2: ["オルド様のランタンを見つけたのですね。", "魂火がまだ揺れています。……よかったです。本当に、よかったです。"] } },
  { id: "m_key", kind: "chat", fresh: true, when: (c) => c.found("w02_sigil"), say: {
    0: ["取水口の鍵を見つけられたのですね。", "……あの方は昔から、黙って一人で行ってしまいます。"],
    2: ["『イレーヌには言うな』というのですか。", "……あの方らしいですね。言われなくても、わかっているのですが。"] } },
  { id: "m_sera", kind: "chat", bond: 1, when: (c) => c.revealed,
    say: ["セラは、わたしより背の高い子でした。", "オルド様の後ろを、いつも黙ってついていく子でした。……あの腕は、館に置いておきます。"] },
  { id: "m_joint", kind: "chat", bond: 1, when: (c) => c.revealed,
    say: ["手袋の下を見ても、もう驚かないのですね。", "……ありがとうございます。あなたの人業たちと、わたしは同じです。"] },
  { id: "m_abbot", kind: "chat", fresh: true, when: (c) => c.beat("mem_w03"), say: {
    0: ["修道院長が、オルド様を見ていたのですね。", "坑口……あの方は、封じられた坑へ向かったのですね。"],
    2: ["修道院長の記憶に、オルド様がいたのですね。", "灯を抱いた人業がついていた……それがセラです。"] } },
  { id: "m_camp", kind: "chat", fresh: true, when: (c) => c.beat("mem_w05"), say: {
    0: ["手記を、読ませていただけますか。", "……『灯を絶やすな』。ええ、絶やすものですか。"],
    3: ["あの方の手記、読ませてくれてありがとうございます。", "『灯を絶やすな』……ええ、何があっても、あなたが連れ戻してくれるまで灯を守ります。"] } },
  { id: "c_back", kind: "chat", fresh: true, when: (c) => c.cleared >= 1, say: {
    0: ["初めての迷宮から、戻られたのですね。", "器に残った土の匂い……嫌いではありません。"],
    2: ["初めての迷宮から、よく戻りましたね。", "器に残った土の匂い……嫌いではありません。"] } },
  // 銀業 (金属の魔物・第3層から): 人業になりそこねた魂のなれの果て。館の主には「同業の子ども」のようなもの
  { id: "c_ginkyo", kind: "chat", fresh: true, when: (c) => c.open("w05"), say: {
    0: ["廃坑で、手のひらほどの銀の人業を見かけませんでしたか。", "銀業(ぎんぎょう)。器になりそこねた魂が、銀の聖具に溶けたものです。"],
    2: ["廃坑で、ちいさな銀の人業に会いませんでしたか。", "銀業(ぎんぎょう)と呼ぶのです。器になりそこねた魂が、銀に溶けた子です。"] } },
  { id: "c_ginkyo2", kind: "chat", bond: 2, when: (c) => c.open("w05"),
    say: ["銀業の肌は、剣も呪文も弾いてしまうのです。", "でも会心の一撃だけは芯まで届きます。……逃げ足が速いから、迷わずにお願いします。"] },
  { id: "c_ginkyo3", kind: "chat", bond: 3, when: (c) => c.done("w05"),
    say: ["銀業がたくさん集まると、王さまになるという噂、知っていますか。", "王冠をちょこんと載せて……ふふ、一度でいいから仕立ててみたいです。"] },
  { id: "c_vos", kind: "chat", bond: 2, when: (c) => c.cleared >= 1,
    say: ["黒鉄商会のヴォスですか。 あの人、わたしの人業まで値踏みするのです。", "……売り物ではないと、何度言ったらわかるのでしょうか。"] },
  { id: "c_ilsa", kind: "chat", bond: 2, when: (c) => c.cleared >= 2,
    say: ["宿のイルザとは古い仲です。", "あの白狼の毛皮、一枚だけ分けてもらったことがあるのです。"] },
  { id: "c_gram", kind: "chat", bond: 2, when: (c) => c.cleared >= 3,
    say: ["酒場のグラムは、わたしの館に一歩も入らないのです。", "人業の目が怖いんだそうです。……可愛いでしょうか。"] },
  { id: "c_king", kind: "chat", bond: 2, when: (c) => c.cleared >= 3,
    say: ["王はあなたを気に入ったようですね。", "オルド様も昔、そう言われていました。……駒が役に立つ時だけ、あの方は笑うのです。"] },
  { id: "c_broken", kind: "chat", when: (c) => c.deaths > 0, say: {
    0: ["砕けた器を見るのは、何度でも慣れません。", "……魂さえ戻れば、また立ち上がれますが。"],
    2: ["砕けた器を見るのは、何度目でも慣れません。", "……でも魂さえ戻れば、また立ち上がれます。"] } },
  { id: "c_spill", kind: "chat", bond: 2, when: (c) => c.deaths >= 3,
    say: ["壊れた器は直せても、こぼれた魂は戻りません。", "無理をさせてはいけません。"] },
  { id: "c_boss", kind: "chat", fresh: true, when: (c) => c.bossKills > 0, say: {
    0: ["迷宮の主を討たれたそうですね。", "……館の人業たちが、今夜はざわめいております。"],
    3: ["迷宮の主を討ったそうですね。", "館の人業たちまで、今夜はざわめいています。……わたしもです。"] } },
  { id: "c_full", kind: "chat", when: (c) => c.party.length >= 6, say: {
    0: ["六体、揃いましたね。", "……壮観です。"],
    2: ["六体そろうと、壮観ですね。", "並んだ背中が、まるで本当の家族のようです。"] } },
  { id: "c_paid", kind: "chat", when: (c) => (c.G.dollsPurchased || 0) >= 4, say: {
    0: ["仕立ての代は、赤い魂で頂いております。", "最初の三体は、オルド様のお弟子さまゆえの特別でした。"],
    2: ["仕立ての代は、赤い魂で頂いています。", "最初の三体は特別でしたよ。覚えておいてくださいね。"] } },
  { id: "c_sealed", kind: "chat", fresh: true, when: (c) => c.sealed, say: {
    0: ["捨て砦へ続く大門は、まだ封じられていると聞きます。", "今のうちに、器をお磨きください。"],
    3: ["捨て砦への大門は、まだ封じられているそうですね。", "……少し、ほっとしているのです。あなたまで遠くへ行ってしまわずに済みますから。"] } },
  { id: "c_layer2", kind: "chat", bond: 1, fresh: true, when: (c) => c.open("w04"), say: {
    1: ["取水口へ降りられるのですね。", "湿気は木の器の大敵です。お戻りになったら、よく乾かしてあげてください。"],
    2: ["取水口へ降りるのですね。", "湿気は木の器の大敵です。帰ったら、よく乾かしてあげてください。"] } },
  { id: "h_sewer", kind: "hint", bond: 1, when: (c) => c.open("w04") && !c.done("w04"), say: {
    1: ["取水口の魔物は、たいてい水の気を帯びています。", "土は水をせき止めます。土の加護を帯びた品なら、牙も鈍り、刃も通りやすいはずです。"],
    2: ["取水口の魔物は、たいてい水の気を帯びています。", "土は水をせき止めます。土の加護を帯びた品なら、牙も鈍るし、刃も通りやすいはずです。"] } },
  { id: "c_layer3", kind: "chat", bond: 1, fresh: true, when: (c) => c.open("w05"), say: {
    1: ["坑口の通行証を賜ったのですね。", "……あそこは、いまの人業たちにはまだ深すぎるかもしれません。"],
    2: ["坑口の通行証をもらったのですね。", "地の底の闇は、魂の灯をいちばん欲しがるのです。……無理はしないでください。"] } },
  { id: "h_mine", kind: "hint", bond: 1, when: (c) => c.open("w05") && !c.done("w05"), say: {
    1: ["坑道の魔物は、ほとんどが土の気を帯びています。", "風は土を削るものです。風の加護を帯びた品なら、岩の殻も砕け、岩の拳も逸らせるはずです。"],
    2: ["坑道の魔物は、ほとんどが土の気を帯びています。", "風は土を削るものです。風の加護を帯びた品なら、岩の殻も砕けるし、岩の拳も逸らせるはずです。"] } },
  { id: "h_overlv", kind: "hint", bond: 1, when: (c) => c.open("w05") && !c.done("w05"), say: {
    1: ["格上の魔物には、眠りも毒も、ほとんど効きません。", "術で楽をしようとせず、まずは器をお鍛えください。"],
    2: ["格上の魔物には、眠りも毒も、ほとんど効かないのです。", "術で楽をしようとせず、まずは器を鍛えてあげてください。"] } },
  { id: "c_convict", kind: "chat", bond: 2, when: (c) => c.done("w05"),
    say: ["坑道で鎖に繋がれたまま死んだ人たちがいるのですね。", "……器に縛られた魂と、どこが違うのでしょうか。いいえ、なんでもありません。"] },
  { id: "c_layer4", kind: "chat", bond: 2, when: (c) => c.beat("mem_w05"),
    say: ["捨て砦には、器に宿り損ねた魂が溜まっているそうです。", "……オルド様は、そこへ。いつか、連れて帰ってあげてください。"] },
  // ---- 第二章「捨て砦」 ----
  { id: "c_fort", kind: "chat", bond: 1, fresh: true, when: (c) => c.open("w06"), say: {
    1: ["捨て砦は、国境の古い砦です。", "百年前に見捨てられて……守備隊は、いまも持ち場を守っていると聞きます。"],
    2: ["捨て砦へ行くのですね。", "百年も持ち場を守っている兵隊さんたち……せめて、静かに休ませてあげてください。"] } },
  { id: "h_ranks", kind: "hint", bond: 1, when: (c) => c.open("w06") && !c.done("w06"), say: {
    1: ["外郭の亡兵は、必ず三体以上の隊列で来ます。", "ひとりずつ斬るより、まとめてなぎ払う技や術が役に立つでしょう。鼓を打つ亡霊は、仲間を癒します。先に。"],
    2: ["外郭の亡兵は、いつも三体以上で隊列を組んできます。", "まとめてなぎ払う技や術が効くはずです。鼓を打つ亡霊は仲間を治すから、先に黙らせてください。"] } },
  { id: "m_roll", kind: "chat", fresh: true, when: (c) => c.found("w06_roll"), say: {
    0: ["『守備隊の諸君に、敬礼を』……あの方らしい書き置きです。", "地下牢の鍵まで借りたのですね。……いったい何を探しているのでしょう。"],
    2: ["『守備隊の諸君に、敬礼を』だそうです。", "……あの方、死んだ人にはいつも礼儀正しいのです。生きている人には、ぶっきらぼうなのですが。"] } },
  { id: "h_prison", kind: "hint", bond: 1, when: (c) => c.open("w07") && !c.done("w07"), say: {
    1: ["地下牢の扉は、内からは開きません。どの戦いからも逃げられないのです。", "器が傷んだら、帰還の陣で早めに引き返してください。骸が多いぶん、魂は拾えるはずです。"],
    2: ["地下牢では、どの戦いからも逃げられないのです。", "傷んだら、帰還の陣で早めに引き返してください。……その代わり、獄死した人の骸が多いから、魂は拾いやすいです。"] } },
  { id: "m_names", kind: "chat", fresh: true, bond: 1, when: (c) => c.found("w07_names"), say: {
    1: ["牢の壁に、操霊師たちの名が……。", "ヴェルナー様は、オルド様の師です。わたしが作られる前に、いなくなったと聞いていました。"],
    3: ["ヴェルナー様の名が、牢の壁にあったのですか。", "……オルド様は知っていたのですね。だから、誰にも言わずに行ったのですね。次は自分の番だと思ったのでしょう。"] } },
  { id: "m_sera2", kind: "chat", bond: 1, when: (c) => c.beat("irene_sera"),
    say: ["セラの頭は、燭台の傍に置いてあるのです。", "夜になると、ときどき瞼が動くのです。……オルド様の灯が揺れるのと、同じ時なのです。"] },
  { id: "h_storm", kind: "hint", bond: 1, when: (c) => c.open("w08") && !c.done("w08"), say: {
    1: ["大手門の雷雨の中では、魔物がみな雷の気を帯びます。", "火は風を焼くものです。火の加護を帯びた品なら、刃は通り、雷も逸れるはずです。雷鳴に紛れた奇襲にも、お気をつけください。"],
    2: ["大手門では、魔物がみんな雷の気を帯びているそうです。", "火は風を焼きます。火の加護の品を持っていってください。……雷鳴に紛れて襲ってくるから、背中にも気をつけてくださいね。"] } },
  { id: "h_council", kind: "hint", bond: 1, when: (c) => c.open("w09") && !c.done("w09"), say: {
    1: ["本丸には、将の亡霊が陣を敷いているそうです。", "強敵の気配のする階が多いでしょう。そのぶん、良い品も眠っています。"],
    2: ["本丸は、将の亡霊だらけなんだそうです。", "強敵の階が多いです。手強いけれど、そのぶん良い品も落ちているはずです。"] } },
  { id: "c_forest", kind: "chat", bond: 1, fresh: true, when: (c) => c.open("ws3"), say: {
    1: ["捨て砦の裏の森へ行かれるのですね。", "霧は木の器を湿らせます。胞子の床と、霧に紛れた奇襲に、お気をつけください。"],
    2: ["あの霧の森へ行くのですか。", "胞子の床に気をつけてください。……霧の奥に泉が湧いているそうです。迷ったら、そこで休んでください。"] } },
  { id: "c_king2", kind: "chat", bond: 2, fresh: true, when: (c) => c.beat("ch2_end"), say: {
    2: ["王さまが、百年も……。", "オルド様は、それを知っていて仕えていたのですね。……わたしには、一度も話してくれませんでした。"],
    4: ["王さまは百年も生きてきたのですね。", "……あの。人業のわたしと、魂脈で生きながらえた王さまと、どちらが本当に生きているのでしょうか。"] } },
  // ---- 第三章「魂脈の根」 ----
  { id: "c_roots", kind: "chat", bond: 1, fresh: true, when: (c) => c.open("w10"), say: {
    1: ["大穴の下へ降りるのですね。", "魂が木になる森……オルド様の手記に、そんな言葉がありました。"],
    2: ["大穴の下へ降りるのですね。", "魂が木になる森だそうです。……あなたの人業たちが根を張ってしまわないよう、ちゃんと連れて帰ってきてください。"] } },
  { id: "h_shaft", kind: "hint", bond: 1, when: (c) => c.open("w10") && !c.done("w10"), say: {
    1: ["縦穴は足場が脆く、落とし穴だらけと聞きます。", "落ちても傷は負いませんが、その階は探れません。浮遊の術があれば、宝箱まで歩けます。"],
    2: ["縦穴は落とし穴だらけなんだそうです。", "落ちても怪我はしないけれど、その階の宝箱は置き去りです。浮遊の術があると便利ですね。"] } },
  { id: "h_shifting", kind: "hint", bond: 1, when: (c) => c.open("w11") && !c.done("w11"), say: {
    1: ["底の森は、霧が階ごとに姿を変えるそうです。", "黄金の蔵に当たる日もあれば、瘴気の階に当たる日もあります。……運試しですね。"],
    2: ["底の森の霧は、階ごとに森の姿を変えるのです。", "黄金の蔵に当たるか、瘴気の階に当たるか。運しだいですね。……無理はしないでください。"] } },
  { id: "m_hut", kind: "chat", fresh: true, bond: 1, when: (c) => c.found("w11_hut"), say: {
    1: ["ヴェルナー様の小屋が、底の森に……。", "オルド様は、あの方を探してもいたのですね。"],
    3: ["ヴェルナー様、牢を抜けていたのですね。", "『先生。来ました』……オルド様、間に合わなかったのですね。でも、ちゃんと会えたのです。"] } },
  { id: "h_sap", kind: "hint", bond: 1, when: (c) => c.open("w12") && !c.done("w12"), say: {
    1: ["苗床の樹液は、勝つたびに傷を癒してくれます。", "ですが魔物も同じ樹液を吸って再生します。長引かせず、一気に倒してください。"],
    2: ["苗床の樹液は、戦いのあとの傷を癒してくれます。", "でも魔物も樹液で再生するのです。戦いを長引かせず、一気に倒してくださいね。"] } },
  { id: "h_omokage", kind: "hint", bond: 1, fresh: true, when: (c) => c.beat("irene_omokage") && !c.dolls.some((d) => d.face),
    say: ["面影を写したくなったら、肖像を押してください。", "魂が新しいランクにたどり着くたびに、写せる顔も増えていきます。"] },
  { id: "c_omokage", kind: "chat", bond: 1, when: (c) => c.dolls.some((d) => d.face),
    say: ["面影を写した子、よく似合っています。", "魂を付け替えても、顔はそのまま。……セラも、そうでした。"] },
  { id: "m_sera3", kind: "chat", bond: 1, when: (c) => c.beat("irene_torso"),
    say: ["セラの頭と腕と胴、燭台の傍に並べてあるのです。", "あとは脚だけです。……全部そろったら、あの子はまた歩けるでしょうか。"] },
  { id: "h_roots", kind: "hint", bond: 1, when: (c) => c.open("w13") && !c.done("w13"), say: {
    1: ["大樹の根は、戦いのたびに魔力を吸うそうです。", "魔力の水薬を多めにお持ちください。術に頼る子ほど、苦しくなります。"],
    2: ["大樹の根元では、戦うたびに根が魔力を吸うのです。", "魔力の水薬を多めに持っていってください。術者の子たちが干上がってしまいます。"] } },
  { id: "c_silver", kind: "chat", bond: 2, fresh: true, when: (c) => c.open("ws4"),
    say: ["銀業の隠れ里だそうですね。", "器になりそこねた子たちの里……。会えたら、よろしく伝えてください。……斬る前にお願いしますね。"] },
  { id: "c_king3", kind: "chat", bond: 2, fresh: true, when: (c) => c.beat("ch3_end"), say: {
    2: ["宰相のモルデン……三百年も、あの木に水をやっていたのですね。", "オルド様は幹を登っていきました。王都の地下へ。……この館の、すぐ近くまで来ているのかもしれません。"],
    4: ["あの。燭台の灯、最近すこし明るいと思いませんか。", "オルド様が近づいている気がするのです。……幹を登って、王都の地下へ。わたしたちの足の下まで来ているのかもしれません。"] } },

  // ---- 親しみ (層の主を討った頃から) ----
  { id: "c_tea", kind: "chat", bond: 3, say: ["お茶はいかがですか。夜咲きのすみれを浮かべました。", "……以前はお出ししませんでしたね。気が変わったのです。"] },
  { id: "c_age", kind: "chat", bond: 3, when: (c) => c.revealed, say: ["わたしの歳ですか。", "……人業に歳を聞く人なんて、あなたが初めてです。"] },
  { id: "c_hands", kind: "chat", bond: 3, say: ["あなたの手、操霊師の手ですね。", "冷たいのに、魂には温かいのです。不思議な手ですね。"] },
  { id: "c_warm", kind: "chat", bond: 3, when: (c) => c.dolls.length >= 2,
    say: ["魂を宿すたび、器はほんの少しだけ温かくなるのです。", "……あなたにも、わかるでしょうか。"] },
  { id: "c_wait", kind: "chat", bond: 3, say: ["あなたが迷宮にいる間、扉の音ばかり気になるのです。", "……人業たちが、ですよ。わたしではありません。"] },
  { id: "v_again", kind: "chat", bond: 3, say: ["また来てくれたのですね。", "この館まで、わたしに会いに来る人は珍しいのです。"] },

  // ---- 親密 (身の上を語る) ----
  { id: "v_steps", kind: "chat", bond: 4, say: ["あなたの足音、もう覚えてしまいました。", "扉を開ける前から、あなただとわかるのです。"] },
  { id: "v_master", kind: "chat", bond: 4, when: (c) => c.revealed, say: ["オルド様は、わたしに名前をくれた人です。", "……あなたの手つき、あの方に少し似てきました。"] },
  { id: "c_mydoll", kind: "chat", bond: 4, say: ["あの、あなたの器も仕立ててあげましょうか。", "……冗談です。あなたには、温かい体のままでいてほしいのです。"] },
  { id: "c_promise", kind: "chat", bond: 4, say: ["深く潜るほど、帰り道は細くなります。", "必ず戻ってきてください。約束ですよ。"] },
  { id: "c_comb", kind: "chat", bond: 4, say: ["たまには、あなたの髪もとかしてあげましょうか。", "……じっとしていられるなら、ですが。"] },

  // ---- 特別 (秘密を明かす) ----
  { id: "v_secret", kind: "chat", bond: 5, when: (c) => c.revealed, say: ["わたしの胸の奥にも、ひとつ魂が眠っているのです。", "誰のものか……いつか、あなたにだけは話します。"] },
  { id: "c_before", kind: "chat", bond: 5, say: ["オルド様は、灯ひとつ残して戻ってきませんでした。", "だからあなたにも、心を開くのが怖かったのです。……もう遅いのですが。"] },
  { id: "c_home", kind: "chat", bond: 5, say: ["あなたが帰ってくる場所が、ここだと嬉しいです。", "……今のは忘れてください。蝋燭の煙が目にしみただけです。"] },
];

const NOW_RECENT = []; // この起動で最近話した「いまの状況」 (同じ助言ばかりにしない)

// 親しさの段に合う言い方 (段ごとの表現が無ければ、その話題はまだ話せない)
function sayFor(l, b) {
  const s = l.say;
  if (Array.isArray(s) || typeof s === "function") return s;
  let best = null, bk = -1;
  for (const k in s) { const n = Number(k); if (n <= b && n > bk) { bk = n; best = s[k]; } }
  return best;
}
const resolve = (l, c) => { const s = sayFor(l, c.bond); return typeof s === "function" ? safe(() => s(c), null) : s; };
function isOpen(l, c) {
  if (c.bond < (l.bond || 0)) return false;
  if (l.until != null && c.bond > l.until) return false;
  if (!sayFor(l, c.bond)) return false;
  return !l.when || safe(() => !!l.when(c), false);
}
function unlocked(c) { return LINES.filter((l) => isOpen(l, c)); }

// 次に話すことをひとつ選ぶ。entry = 館に入った時 (いまの状況の助言を出しやすくする)
export function nextLine({ entry = false } = {}) {
  const st = ireneState();
  const c = ctxNow();
  const ok = unlocked(c);
  let pick = ok.find((l) => l.must) || null;
  if (!pick) pick = ok.find((l) => l.fresh && !st.seen[l.id]) || null;  // 新しく開いた話題を真っ先に
  if (!pick) {
    const now = ok.filter((l) => l.kind === "now" && l.id !== st.last);
    if (now.length && Math.random() < (entry ? 0.6 : 0.35)) {
      pick = now.find((l) => !NOW_RECENT.includes(l.id)) || now[0];
      NOW_RECENT.push(pick.id);
      if (NOW_RECENT.length > 3) NOW_RECENT.shift();
    }
  }
  if (!pick) {
    const pool = ok.filter((l) => l.kind !== "now" && l.id !== st.last);
    let sum = 0;
    const w = pool.map((l) => { const v = st.seen[l.id] ? 1 : 4; sum += v; return v; }); // まだ聞いていない話を多めに
    let r = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { pick = pool[i]; break; } }
    if (!pick) pick = pool[pool.length - 1] || ok[0] || null;
  }
  if (!pick) return { id: null, lines: ["……。", ""] };
  const lines = resolve(pick, c) || ["……。", ""];
  st.seen[pick.id] = (st.seen[pick.id] || 0) + 1;
  st.last = pick.id;
  return { id: pick.id, lines };
}

// その話題がいまも開いているか (状況・親しさが変わった話を替えるため)
export function lineOpen(id) {
  const l = LINES.find((x) => x.id === id);
  return !!l && isOpen(l, ctxNow());
}

// 館に入った (タブを開いた) ことを数える
export function noteVisit() { const st = ireneState(); st.visits = (st.visits || 0) + 1; }

// いま話せる話題の数 / 全体 (確かめ用)
export function topicCount() { const c = ctxNow(); return { bond: c.bond, open: unlocked(c).length, all: LINES.length }; }

// ---------- 初訪問の挨拶 (館の案内)。まだよそよそしい ----------
export function greetingPages() {
  const c = ctxNow();
  const pages = [
    ["オルド様のお弟子さま。", "お待ちしておりました。"],
    ["わたしはイレーヌ。", "オルド様の留守をあずかって、この館で人業の器を仕立てております。"],
    ["あの方は発つ前に、ひとつだけ言い残されました。", "『灯を絶やすな』と。"],
    ["奥の燭台の灯がそれです。オルド様の魂に結んだ灯。", "……この一年、一度も消えておりません。"],
    ["灯が燃えているかぎり、あの方の魂はこの世のどこかにある。", "わたしは、そう信じております。"],
    ["ここに並ぶ人業は、まだみな空の器です。", "死者の魂を宿して、はじめて目を覚まします。"],
    ["器は赤い魂と引き換えに仕立てます。", "ただし最初の三体は、オルド様のお弟子さまですから、お代は頂きません。"],
    ["目覚めた人業は、隊列に並べて迷宮へ。", "前衛に三体、後衛に三体まで連れてゆけます。"],
    ["前衛は刃を受け止める盾。", "後衛は、受ける傷も与える傷も半分になります。"],
    ["力ある器は前へ、術者と射手は後ろへ。", "術だけは、どこに立っても力を落としません。"],
    ["『装備』では器に衣を着せ、『魂』では宿した魂を強化し、", "『能力』では器の力を確かめられます。"],
    ["迷宮で集めた✦Soulを注げば、魂は育ちます。", "強くなるのは器ではなく、宿った魂そのものです。"],
    ["ご用の際は、またお越しください。", "……あの方のお弟子さまが、器を粗末になさるとは思いませんけれど。"],
  ];
  if (!c.dolls.length) pages.push(["では、宿す魂をひとつお選びください。", "器は、わたしが仕立てます。"]);
  return pages;
}

// ---------- 会話の場面 (全画面) ----------
// pages: [[1行目, 2行目], …]。1回目のタップ = 文字を出し切る / 次のタップ = 次のページ / 最後のページで閉じる。
// 「スキップ」で最後まで飛ばす。戻る操作はタップと同じ順 (出し切る → 次 → 閉じる)
let active = null;
export function playIreneScene(pages, done) {
  const list = (pages || []).filter((p) => p && p.length);
  if (!list.length || typeof document === "undefined" || !document.body || active) { if (done) done(); return null; }
  const G = game.G;
  if (G) G.prompt = true;

  const wrap = el("div", "iv-scene");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-label", IRENE_WHO);
  wrap.tabIndex = -1;
  const amb = el("img", "iv-amb");
  amb.src = IRENE_ART; amb.alt = ""; amb.draggable = false;
  wrap.appendChild(amb);
  const art = el("div", "iv-art");
  const img = el("img");
  img.src = IRENE_ART; img.alt = ""; img.draggable = false; img.decoding = "async";
  art.appendChild(img);
  wrap.appendChild(art);
  wrap.appendChild(el("div", "iv-veil"));
  const skip = el("button", "iv-skip", "スキップ");
  skip.type = "button";
  skip.dataset.action = "skip";
  wrap.appendChild(skip);

  const stage = el("div", "iv-stage");
  const dots = el("div", "iv-dots");
  const say = el("div", "pt-kp-say iv-say");
  say.appendChild(el("span", "pt-kp-who", IRENE_WHO));
  const text = el("span", "pt-kp-text");
  say.appendChild(text);
  const nextMark = el("span", "pt-kp-next", "▼");
  say.appendChild(nextMark);
  stage.appendChild(say);
  stage.appendChild(dots);
  wrap.appendChild(stage);

  const st = { i: -1, full: true, timer: null, closed: false };
  active = st;
  const last = () => st.i >= list.length - 1;
  const spans = [];

  const reveal = () => {
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    list[st.i].forEach((t, j) => { if (spans[j]) spans[j].textContent = t; });
    st.full = true;
    nextMark.classList.remove("hidden");
  };
  const show = (k) => {
    st.i = k;
    text.textContent = "";
    spans.length = 0;
    for (let j = 0; j < list[k].length; j++) { const s = el("span", "pt-kp-l"); spans.push(s); text.appendChild(s); }
    dots.textContent = "";
    for (let j = 0; j < list.length; j++) dots.appendChild(el("i", j === k ? "on" : j < k ? "past" : ""));
    if (reduced()) { reveal(); return; }
    st.full = false;
    nextMark.classList.add("hidden");
    // 1文字ずつ (行をまたいで続けて) つづる
    const all = list[k].map((t) => [...(t || "")]);
    let li = 0, ci = 0;
    st.timer = setInterval(() => {
      while (li < all.length && ci >= all[li].length) { li++; ci = 0; }
      if (li >= all.length) { reveal(); return; }
      ci++;
      spans[li].textContent = all[li].slice(0, ci).join("");
    }, 38);
  };
  const advance = () => {
    if (st.closed) return;
    if (!st.full) { reveal(); return; }
    sfx("select");
    if (last()) { finish(); return; }
    show(st.i + 1);
    if (!reduced()) animate(text, [{ opacity: 0.2 }, { opacity: 1 }], { duration: 200, fill: "none" });
  };
  const finish = () => {
    if (st.closed) return;
    st.closed = true;
    if (st.timer) clearInterval(st.timer);
    nav.remove(entry);
    removeEventListener("keydown", onKey, true);
    if (active === st) active = null;
    if (G) G.prompt = false;
    wrap.classList.add("out");
    setTimeout(() => { if (wrap.isConnected) wrap.remove(); }, reduced() ? 120 : 420);
    if (done) { try { done(); } catch (e) { setTimeout(() => { throw e; }); } }
  };
  const entry = nav.push({ id: "irene", onBack: () => advance() });
  const onKey = (e) => {
    if (st.closed) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); advance(); }
  };
  addEventListener("keydown", onKey, true);
  skip.addEventListener("click", (e) => { e.stopPropagation(); sfx("select"); finish(); });
  wrap.addEventListener("click", () => advance());

  document.body.appendChild(wrap);
  show(0);
  try { wrap.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  return { close: finish, el: wrap };
}
export function sceneActive() { return !!active; }

// 確かめ用: 話題の一覧 (id・種類・いま開いているか)
export function _debugTopics() { const c = ctxNow(); return LINES.map((l) => ({ id: l.id, kind: l.kind, open: !l.when || safe(() => !!l.when(c), false), say: resolve(l, c) })); }
