// ===== 人業の館の主イレーヌ — 初訪問の挨拶 (会話の場面) と、来館ごとのひとこと =====
// 人業の館 (隊タブ) の下段の挿絵と台詞 (party.js の keeperPanel) が使う。
//   ・初めて館を訪れた時: playIreneScene(greetingPages()) で挨拶と館の案内を語る (全画面の会話の場面)
//   ・館に入るたび: nextLine({ entry: true }) が、いま話せる話題からひとつ選ぶ (タップで次の話)
// 話題 (LINES) は when(c) で開く。ゲームが進み要素が解放されるたびに、話せることが増えていく。
//   kind: chat = 他愛のない話 / hint = 仕組みの助言 / now = いまの状況への助言 (当てはまる時だけ)
//   fresh = 開いた直後の来館で、真っ先に話す (新しく解放された要素の知らせ)
//   must = 当てはまる間は必ずこれを話す (人業がまだいない時の案内)
// 状態は G.irene = { greeted, visits, seen: {id: 回数}, last } (セーブされる)。
// game.js は import しない (ctx.js の UI / game を通す)。

import { game, UI } from "./ctx.js";
import { el } from "./kit.js";
import { nav } from "./nav.js";
import { animate, reduced } from "./motion.js";
import { SFX } from "../audio.js";
import { soulByUid, soulLevelCapOf, soulRankOf, SOUL_CLASSES, soulSeriesName } from "../souls.js";
import { MAX_ITEMS, weaponRange } from "../items.js";

export const IRENE_WHO = "人形の館の主　イレーヌ";
export const IRENE_ART = "./art/mansion_irene.png";

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
  const feature = (k) => safe(() => !!game.featureUnlocked(k), false);
  const worn = (uid) => dolls.some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const souls = (G.souls || []).filter(Boolean);
  return {
    G, party, reserve, dolls, items, ms, stats, cleared,
    visits: ireneState().visits || 0,
    act: ms.n || 0,                                      // 勅命の章 (= 迷宮番号)
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
const jobName = (s) => (s && SOUL_CLASSES[s.clsKey] ? soulSeriesName(s.clsKey) : "宿した");

// ---------- 話題 ----------
// say: [1行目, 2行目] か、(c) => [..] (人業の名などを差し込む時)
const LINES = [
  // ---- いまの状況 (当てはまる時だけ。上ほど急ぎ) ----
  { id: "n_nodoll", kind: "now", must: true, when: (c) => !c.dolls.length,
    say: ["さあ、宿す魂をひとつ選んで。", "器はわたしが仕立ててあげる。最初の三体は、お代はいらないわ。"] },
  { id: "n_dead", kind: "now", when: (c) => !!deadDoll(c),
    say: (c) => [`${deadDoll(c).name}の器が、砕けたままね……`, "時が経てば戻るけれど、赤い魂で迎えを早めることもできるわ。"] },
  { id: "n_hurt", kind: "now", when: (c) => !!hurtDoll(c),
    say: (c) => [`${hurtDoll(c).name}、ずいぶん傷んでいるわ。`, "潜る前に、宿屋で休ませてあげて。"] },
  { id: "n_unid", kind: "now", when: (c) => c.hasUnid,
    say: ["伏せ名の品を持っているわね。", "商会で鑑定すれば、正体を明かして身に着けられるわ。"] },
  { id: "n_better", kind: "now", when: () => safe(() => UI.betterGearCount() > 0, false),
    say: ["もっと似合う衣が、袋の中で眠っているわ。", "『最適装備』を押してごらんなさい。"] },
  { id: "n_train", kind: "now", when: (c) => !!trainable(c),
    say: (c) => ["✦Soulが貯まっているわね。", `『魂』の区分で、${jobName(trainable(c))}の魂を鍛えてあげて。`] },
  { id: "n_make", kind: "now", when: (c) => c.dolls.length > 0 && canMake(c),
    say: ["宿り手のいない魂が、まだ眠っているわ。", "器を仕立てて、目覚めさせてあげましょう。"] },
  { id: "n_fuse", kind: "now", when: (c) => !!fusable(c),
    say: (c) => [`${jobName(fusable(c))}の魂が、もうひとつ余っているわね。`, "『魂』の区分で吸わせれば、魂の格が上がるわ。"] },
  { id: "n_backmelee", kind: "now", when: (c) => !!backMelee(c),
    say: (c) => [`後衛の${backMelee(c).name}に、刃の短い得物は不向きよ。`, "届くのは敵の前衛だけ。それも力は半分になるわ。"] },
  { id: "n_bag", kind: "now", when: (c) => !!fullBag(c),
    say: (c) => [`${fullBag(c).name}の袋が、もう一杯ね。`, "要らない品は、商会で手放しておきなさい。"] },
  { id: "n_embers", kind: "now", when: (c) => (c.G.embers || 0) > 0,
    say: ["魂の残火を持っているわね。", "『魂』の区分で使えば、魂の育つ限りを押し広げられるわ。"] },
  { id: "n_solo", kind: "now", when: (c) => c.party.length === 1 && !canMake(c),
    say: ["一体きりで迷宮へ?", "……背中を預けられる仲間がいれば、魂も心強いでしょうに。"] },

  // ---- 仕組みの助言 (使えるようになったら話す) ----
  { id: "h_core", kind: "hint", when: (c) => c.dolls.length > 0,
    say: ["人業とは、魂に刻まれた力のかたち。", "迷った時は、前衛と後衛の役割を見直してみなさい。"] },
  { id: "h_gear", kind: "hint", when: (c) => c.dolls.length > 0,
    say: ["装備は器の衣。", "似合わぬ衣は、魂を窮屈にさせるだけよ。"] },
  { id: "h_rows", kind: "hint", when: (c) => c.dolls.length > 0,
    say: ["前衛は刃を受け止める盾。後衛は、受ける傷も与える傷も半分。", "力自慢は前へ、術者と射手は後ろへ。"] },
  { id: "h_form", kind: "hint", when: (c) => c.party.length >= 2,
    say: ["隊列の札は、長く押して並べ替えられるわ。", "並びひとつで、人業の運命は変わるもの。"] },
  { id: "h_auto", kind: "hint", when: (c) => c.dolls.length > 0,
    say: ["装備に迷ったら『最適装備』を押しなさい。", "器に似合う衣を、わたしが見繕ってあげる。"] },
  { id: "h_range", kind: "hint", when: (c) => c.hasWeapon,
    say: ["剣や斧が届くのは、敵の前衛だけ。", "槍なら前衛から奥まで、弓ならどこへでも届くわ。"] },
  { id: "h_train", kind: "hint", when: (c) => c.act >= 1 && c.dolls.length > 0,
    say: ["迷宮で集めた✦Soulは、魂を育てる糧。", "器ではなく、宿った魂そのものが強くなるのよ。"] },
  { id: "h_inn", kind: "hint", when: (c) => c.act >= 1,
    say: ["傷ついた器は、宿屋で休ませなさい。", "疲れた魂は、器の中で軋むものよ。"] },
  { id: "h_spell", kind: "hint", when: (c) => c.act >= 1,
    say: ["術は、隊列の前でも後ろでも力を落とさない。", "後衛の魔導士こそ、隊のいちばん鋭い牙よ。"] },
  { id: "h_unid", kind: "hint", when: (c) => c.hasUnid || c.items.some((it) => it.slot && it.slot !== "use" && it.slot !== "misc"),
    say: ["迷宮で拾った品は、伏せ名のまま。", "正体を明かすまでは、身に着けられないの。"] },
  { id: "h_curse", kind: "hint", fresh: true, when: (c) => c.hasCursed,
    say: ["呪われた品は、一度身に着けたら外れないわ。", "……着せる前に、よく見定めることね。"] },
  { id: "h_rarity", kind: "hint", fresh: true, when: (c) => c.hasRare,
    say: ["品の名の色は、格の証。", "白、緑、青、橙……赤い名の品に出会えたら、それは運命よ。"] },
  { id: "h_sr", kind: "hint", when: (c) => c.hasSR,
    say: ["橙の名の品を手に入れたのね。", "ああいう品は、器の格まで引き上げてくれるわ。"] },
  { id: "h_lr", kind: "hint", fresh: true, when: (c) => c.hasLR,
    say: ["赤い名の品……レジェンドレアは、世にひとつきり。", "持ち主を選ぶ品よ。大切になさい。"] },
  { id: "h_reserve", kind: "hint", fresh: true, when: (c) => c.reserve.length > 0,
    say: ["控えの子たちも、ちゃんと見ているわ。", "右上の『控え』から、いつでも隊と入れ替えられるのよ。"] },
  { id: "h_rescue", kind: "hint", fresh: true, when: (c) => c.deaths > 0,
    say: ["迷宮で砕けた器は、ほかの冒険者が連れ帰ってくれる。", "深い階で砕けるほど、戻るまでに時がかかるわ。"] },
  { id: "h_embers", kind: "hint", when: (c) => (c.G.embers || 0) > 0 || c.cleared >= 2,
    say: ["魂の残火は、死者が遺した最後の熱。", "育ちきった魂に与えれば、もう一歩先へ伸びられるわ。"] },
  { id: "h_boss", kind: "hint", when: (c) => c.act >= 1 && c.cleared < 5,
    say: ["層の底には、主が棲んでいるそうよ。", "挑む前に、傷と装備を整えておきなさい。"] },
  { id: "h_elem", kind: "hint", fresh: true, when: (c) => c.hasElem,
    say: ["火は風を、風は土を、土は水を、水は火を制する。", "光と闇は、互いを喰らい合う。属性を味方につけなさい。"] },
  { id: "h_fusion", kind: "hint", fresh: true, when: (c) => c.fusion,
    say: ["同じ職の魂を、ひとつに束ねられるようになったわ。", "魂を吸わせるほど格が上がり、新たな加護を覚えるの。"] },
  { id: "h_rank", kind: "hint", fresh: true, when: (c) => c.maxRank >= 2,
    say: ["格の上がった魂は、器に新たな加護を授けるわ。", "束ねた魂が多いほど、魂の育つ限りも高くなるのよ。"] },
  { id: "h_subs", kind: "hint", fresh: true, when: (c) => c.subs >= 1,
    say: ["器に、もうひとつ魂を宿せるようになったわ。", "宿し技……ほかの職の秘技を、借りられるの。"] },
  { id: "h_subs2", kind: "hint", fresh: true, when: (c) => c.subs >= 2,
    say: ["宿し技の枠が、ふたつに増えたわ。", "三つの魂を抱く器……あなたの手も、ずいぶん慣れてきたわね。"] },
  { id: "h_order", kind: "hint", fresh: true, when: (c) => c.order,
    say: ["隊に加えていない魂も、無駄にはならないの。", "控えの結社に席を与えれば、隊のみんなを守ってくれるわ。"] },
  { id: "h_rumor", kind: "hint", fresh: true, when: (c) => c.rumor,
    say: ["酒場の噂が、迷宮の様子を変えることがあるそうね。", "宝の噂か、罠の噂か……耳は澄ませておきなさい。"] },

  // ---- 他愛のない話 (いつでも) ----
  { id: "c_hair", kind: "chat", say: ["人形たちの髪を梳くのが、わたしの日課なの。", "……魂のない子ほど、よく眠るのよ。"] },
  { id: "c_candle", kind: "chat", say: ["この館の蝋燭は、一度も消えたことがないの。", "消えたら何が起きるか……試したくはないわね。"] },
  { id: "c_wood", kind: "chat", say: ["器の木は、墓地の古い楡から削り出すの。", "死者を見送ってきた木は、魂を拒まないから。"] },
  { id: "c_age", kind: "chat", say: ["わたしの歳?", "……人形に歳を訊く人なんて、あなたが初めてよ。"] },
  { id: "c_steps", kind: "chat", say: ["夜更けに、二階の人形が歩く音がするの。", "怖がらなくていいわ。あの子たちは、ただ寂しいだけ。"] },
  { id: "c_hands", kind: "chat", say: ["あなたの手、魂繰りの手ね。", "冷たいのに、魂には温かい。不思議な手。"] },
  { id: "c_tea", kind: "chat", say: ["お茶はいかが? 夜咲きの菫を浮かべたの。", "……迷宮帰りの喉には、少し甘すぎるかしら。"] },
  { id: "c_honest", kind: "chat", when: (c) => c.dolls.length > 0,
    say: ["器は嘘をつかないわ。", "傷もひびも、宿した魂の生き様そのものよ。"] },
  { id: "c_warm", kind: "chat", when: (c) => c.dolls.length >= 2,
    say: ["魂を宿すたび、器はほんの少しだけ温かくなるの。", "……あなたにも、わかるかしら。"] },
  { id: "c_orb", kind: "chat", say: ["机の上の水晶玉? あれは魂の揺りかご。", "器を待つ魂が、ときどき中で寝返りを打つのよ。"] },

  // ---- 他愛のない話 (進むほど増える) ----
  { id: "c_firstdoll", kind: "chat", when: (c) => c.dolls.length > 0,
    say: ["あなたが最初に仕立てた子、覚えている?", "初めての器には、魂繰りの癖がいちばん出るものよ。"] },
  { id: "c_grave", kind: "chat", when: (c) => c.act >= 1 && c.cleared < 5,
    say: ["墓地の迷宮へゆくのね。", "あそこの死者は眠りが浅いの。足音は静かにね。"] },
  { id: "c_back", kind: "chat", fresh: true, when: (c) => c.cleared >= 1,
    say: ["初めての迷宮から、よく戻ったわね。", "器に残った土の匂い……嫌いじゃないわ。"] },
  { id: "c_vos", kind: "chat", when: (c) => c.cleared >= 1,
    say: ["黒鉄商会のヴォス? あの人、わたしの人形まで値踏みするの。", "……売り物じゃないって、何度言ったらわかるのかしら。"] },
  { id: "c_ilsa", kind: "chat", when: (c) => c.cleared >= 2,
    say: ["宿のイルザとは古い仲よ。", "あの白狼の毛皮、一枚だけ分けてもらったことがあるの。"] },
  { id: "c_gram", kind: "chat", when: (c) => c.cleared >= 3,
    say: ["酒場のグラムは、わたしの館に一歩も入らないの。", "人形の目が怖いんですって。……可愛いでしょう?"] },
  { id: "c_king", kind: "chat", when: (c) => c.cleared >= 3,
    say: ["王はあなたを気に入ったみたいね。", "あの方が笑うのは、駒が役に立つ時だけだけれど。"] },
  { id: "c_broken", kind: "chat", when: (c) => c.deaths > 0,
    say: ["砕けた器を見るのは、何度目でも慣れないわ。", "……でも魂さえ戻れば、また立ち上がれる。"] },
  { id: "c_spill", kind: "chat", when: (c) => c.deaths >= 3,
    say: ["壊れた器は直せても、零れた魂は戻らない。", "無理をさせては駄目よ。"] },
  { id: "c_boss", kind: "chat", fresh: true, when: (c) => c.bossKills > 0,
    say: ["迷宮の主を討ったのですって?", "館の人形たちまで、今夜はざわめいているわ。"] },
  { id: "c_full", kind: "chat", when: (c) => c.party.length >= 6,
    say: ["六体そろうと、壮観ね。", "並んだ背中が、まるで本当の家族のよう。"] },
  { id: "c_paid", kind: "chat", when: (c) => (c.G.dollsPurchased || 0) >= 4,
    say: ["仕立ての代は、赤い魂で頂いているわ。", "最初の三体は特別だったのよ? 覚えておいてね。"] },
  { id: "c_sealed", kind: "chat", fresh: true, when: (c) => c.sealed,
    say: ["次の層への門は、まだ封じられているそうね。", "なら今のうちに、器を磨いておきなさい。"] },
  { id: "c_layer2", kind: "chat", when: (c) => c.act >= 6 && !c.sealed,
    say: ["水路へ降りるのね。", "湿気は木の器の大敵よ。帰ったら、よく乾かしてあげて。"] },
  { id: "c_layer3", kind: "chat", when: (c) => c.act >= 11 && !c.sealed,
    say: ["廃坑の石の匂いがするわ。", "地の底の闇は、魂の灯をいちばん欲しがるの。"] },
  { id: "c_layer4", kind: "chat", when: (c) => c.act >= 16 && !c.sealed,
    say: ["捨て砦には、器に宿り損ねた魂が溜まっているそうよ。", "……かわいそうに。いつか、連れて帰ってあげて。"] },

  // ---- 来館を重ねるほど (少しずつ打ち解ける) ----
  { id: "v_again", kind: "chat", when: (c) => c.visits >= 5,
    say: ["また来てくれたのね。", "この館まで、わたしに会いに来る人は珍しいのよ。"] },
  { id: "v_steps", kind: "chat", when: (c) => c.visits >= 15,
    say: ["あなたの足音、もう覚えてしまったわ。", "扉を開ける前から、あなただとわかるの。"] },
  { id: "v_master", kind: "chat", when: (c) => c.visits >= 30,
    say: ["昔、わたしにも魂繰りの師がいたの。", "……その話は、また今度ね。"] },
  { id: "v_secret", kind: "chat", when: (c) => c.visits >= 60,
    say: ["わたしの胸の奥にも、ひとつ魂が眠っているの。", "誰のものかは……あなたにだけ、いつか教えてあげる。"] },
];

const NOW_RECENT = []; // この起動で最近話した「いまの状況」 (同じ助言ばかりにしない)

const resolve = (l, c) => (typeof l.say === "function" ? safe(() => l.say(c), null) : l.say);
function unlocked(c) { return LINES.filter((l) => !l.when || safe(() => !!l.when(c), false)); }

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

// その話題がいまも開いているか (状況が変わった助言を替えるため)
export function lineOpen(id) {
  const l = LINES.find((x) => x.id === id);
  return !!l && (!l.when || safe(() => !!l.when(ctxNow()), false));
}

// 館に入った (タブを開いた) ことを数える
export function noteVisit() { const st = ireneState(); st.visits = (st.visits || 0) + 1; }

// いま話せる話題の数 / 全体 (確かめ用)
export function topicCount() { const c = ctxNow(); return { open: unlocked(c).length, all: LINES.length }; }

// ---------- 初訪問の挨拶 (館の案内) ----------
export function greetingPages() {
  const c = ctxNow();
  const pages = [
    ["あら……新しい魂繰りさんね。", "ようこそ、人業の館へ。"],
    ["わたしはイレーヌ。", "この館の主で、器を仕立てる人形師よ。"],
    ["ここに並ぶ人形は、みんなまだ空っぽの器。", "死者の魂を宿して、はじめて『人業』として目を覚ますの。"],
    ["器は赤い魂と引き換えに仕立てるわ。", "でも最初の三体は、わたしからの餞別。お代はいらない。"],
    ["目覚めた人業は、隊列に並べて迷宮へ連れてゆくの。", "前衛に三体、後衛に三体まで。"],
    ["前衛は刃を受け止める盾。", "後衛は、受ける傷も与える傷も半分になるわ。"],
    ["だから力自慢は前へ、術者と射手は後ろへ。", "術だけは、どこに立っても力を落とさないのよ。"],
    ["『装備』では器に衣を着せ、『魂』では宿した魂を鍛え、", "『能力』では器の力を確かめられるわ。"],
    ["迷宮で集めた✦Soulを注げば、魂は育つ。", "強くなるのは器ではなく、宿った魂そのものよ。"],
    ["迷ったら、いつでもここへ戻っていらっしゃい。", "わたしは、ずっとここにいるから。"],
  ];
  if (!c.dolls.length) pages.push(["さあ、宿す魂をひとつ選んで。", "あなたの最初の人業を、目覚めさせましょう。"]);
  return pages;
}

// ---------- 会話の場面 (全画面) ----------
// pages: [[1行目, 2行目], …]。1回目のタップ = 文字を出し切る / 次のタップ = 次の頁 / 最後の頁で閉じる。
// 「とばす」で最後まで飛ばす。戻る操作はタップと同じ順 (出し切る → 次 → 閉じる)
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
  const skip = el("button", "iv-skip", "とばす");
  skip.type = "button";
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
    // 1文字ずつ (行をまたいで続けて) 綴る
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
