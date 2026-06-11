// 魂(Soul)と人業(Doll)のデータモデル
//
// 「人業 (Doll)」= 人型の器。頭・右手・左手・胴体・足の5部位があり、
// 各部位に「魂 (Soul)」を封じ込めることで性能が決まる。
// ・5部位中3部位以上を同じ職業の魂で揃えると、その職業の【基本スキル】
// ・5部位すべてを同じ職業で揃えると、さらに【上位スキル】が解放される。
// 魂にはレベルがあり、レベルが上がるほど高位のスキルを覚える。
//
// ステータスは六大ステ (ATK/VIT/AGI/INT/PIE/LUK) に統一。Doll はメンバー
// オブジェクト(hp,maxhp,mp,atk,vit,agi,int,pie,luk,spells,equip,items,alive...)を
// そのまま持ち、recalcDoll() が souls(parts) から base ステータスを算出する。

import { recalc } from "./items.js";

// 人業の5部位 (封印順 = 表示順)
export const PARTS = ["head", "rhand", "lhand", "body", "legs"];
export const PART_LABEL = { head: "頭", rhand: "右手", lhand: "左手", body: "胴体", legs: "足" };

// 魂の職業定義。stat は「1部位あたり / 魂レベル1」の寄与量。
// 5部位そろえた時に従来のプリメイド職とおおよそ釣り合うよう調整。
// stat キーは hp/mp + 六大ステ (atk/vit/agi/int/pie/luk)。
// passive: 職業が発現したとき(職業ランク1以上)に効くステータス倍率。
// 武術系にも少量のMP(気力)を持たせ、技を使えるようにする。
export const SOUL_CLASSES = {
  fighter: {
    label: "戦士", color: "#d4504e", glow: "#ff7a72",
    stat: { hp: 7.0, mp: 0.7, atk: 2.4, vit: 1.6, agi: 1.2, int: 0.3, pie: 0.4, luk: 1.0 },
    passive: { atkMul: 1.18, label: "鬼神の膂力 (ATK+18%)" },
  },
  knight: {
    label: "騎士", color: "#7c93c8", glow: "#a9c0ff",
    stat: { hp: 8.4, mp: 0.6, atk: 2.2, vit: 2.4, agi: 0.8, int: 0.4, pie: 0.8, luk: 0.9 },
    passive: { vitMul: 1.20, label: "鉄壁の構え (VIT+20%)" },
  },
  thief: {
    label: "盗賊", color: "#6fae46", glow: "#9be88a",
    stat: { hp: 4.4, mp: 0.8, atk: 1.8, vit: 1.0, agi: 2.4, int: 0.8, pie: 0.4, luk: 2.0 },
    passive: { agiMul: 1.25, critBonus: 0.12, label: "影駆け (AGI+25%/会心+)" },
  },
  mage: {
    label: "魔術師", color: "#b06bff", glow: "#d3a8ff",
    stat: { hp: 3.6, mp: 2.8, atk: 1.0, vit: 0.6, agi: 1.4, int: 2.8, pie: 0.8, luk: 1.0 },
  },
  priest: {
    label: "僧侶", color: "#e8c47a", glow: "#ffe2a0",
    stat: { hp: 4.8, mp: 2.4, atk: 1.4, vit: 1.0, agi: 1.0, int: 0.9, pie: 2.8, luk: 1.1 },
  },
  bishop: {
    label: "魔導僧", color: "#5fb8d6", glow: "#aef0ff",
    stat: { hp: 4.4, mp: 3.2, atk: 1.2, vit: 0.8, agi: 1.2, int: 2.0, pie: 2.0, luk: 1.0 },
  },
};

// ===== 職業ランク (1〜5) =====
// 上位ランクほど強力なスキルを覚える。各ランクで skills(その段で追加習得する技)、
// passive(発動するパッシブフラグ)、name(称号) を定義。スキルは累積。
export const JOB_RANKS = {
  priest: [
    { name: "見習い僧侶", skills: ["DIOS"] },
    { name: "僧侶",       skills: ["DIOSALL"] },
    { name: "神官",       skills: ["REVIVE"] },
    { name: "聖職者",     skills: ["RESURRECT"] },
    { name: "聖者",       skills: [], flag: "blessing" }, // 全滅時HP1で1回だけ全員復活
  ],
  mage: [
    { name: "見習い魔術師", skills: ["HALITO"] },
    { name: "魔術師",       skills: ["KATINO"] },
    { name: "魔導師",       skills: ["MAHALITO"] },
    { name: "大魔導師",     skills: ["TILTOWAIT"] },
    { name: "大賢者",       skills: [], passive: { agiMul: 1.1 }, flag: "spellMaster" }, // 攻撃呪文+25%
  ],
  bishop: [
    { name: "見習い導師", skills: ["HALITO"] },
    { name: "魔導僧",     skills: ["DIOS"] },
    { name: "導師",       skills: ["MAHALITO"] },
    { name: "大導師",     skills: ["DIAL"] },
    { name: "賢者王",     skills: ["RESURRECT", "TILTOWAIT"], flag: "spellMaster" },
  ],
  fighter: [
    { name: "見習い戦士", skills: ["KYOUGEKI"] },
    { name: "戦士",       skills: ["MIDARE"] },
    { name: "剣士",       skills: [], passive: { critBonus: 0.10 } },
    { name: "剣豪",       skills: [], passive: { atkMul: 1.12 } },
    { name: "剣聖",       skills: [], passive: { atkMul: 1.15, critBonus: 0.12 } },
  ],
  knight: [
    { name: "見習い騎士", skills: [], passive: { vitMul: 1.05 } },
    { name: "騎士",       skills: ["KYOUGEKI"] },
    { name: "重騎士",     skills: [], passive: { vitMul: 1.10, atkMul: 1.06 } },
    { name: "騎士団長",   skills: ["MIDARE"] },
    { name: "聖堂騎士長", skills: [], passive: { vitMul: 1.15 }, flag: "endure" }, // 致死を1回HP1で耐える
  ],
  thief: [
    { name: "見習い盗賊", skills: [], passive: { agiMul: 1.06 } },
    { name: "盗賊",       skills: ["KYOUGEKI"] },
    { name: "ローグ",     skills: [], passive: { agiMul: 1.10, critBonus: 0.08 } },
    { name: "アサシン",   skills: [], passive: { critBonus: 0.16 } },
    { name: "夜刃",       skills: ["MIDARE"], passive: { agiMul: 1.12, critBonus: 0.10 } },
  ],
};

// 魂ランク → 数値 (通常1 / 優秀2 / 偉大3 / 伝説4)
function soulRankNum(s) { return SOUL_RANKS[s.rank || "normal"].order + 1; }

// 人業の支配職の「職業ランク」を判定する。{ clsKey, rank(1-5), count } または null
export function jobRankOf(doll) {
  const dom = dominantClass(doll);
  if (!dom || dom.count < 3) return null;
  const J = dom.clsKey;
  if (!JOB_RANKS[J]) return null;
  // 支配職の各部位の魂ランク(1-4)
  const ranks = [];
  for (const p of PARTS) { const s = doll.parts[p]; if (s && s.clsKey === J) ranks.push(soulRankNum(s)); }
  // base = 「魂ランク>=K の部位が3つ以上」を満たす最大の K (1始まり)
  let base = 1;
  for (let K = 2; K <= 4; K++) if (ranks.filter((r) => r >= K).length >= 3) base = K;
  // 5部位すべて同職なら +1
  const all5 = ranks.length === 5;
  const rank = Math.max(1, Math.min(5, base + (all5 ? 1 : 0)));
  return { clsKey: J, rank, count: dom.count, all5 };
}

export const SOUL_KEYS = Object.keys(SOUL_CLASSES);

// ===== 部位ごとの魂スキル =====
// 各魂は「職業 × 部位」でスキル表を持つ。魂レベルが閾値に達すると習得。
//  head : アクションスキル(技/呪文)。3部位以上同職のとき使用可能になる。
//  rhand/lhand/body/legs : パッシブ(能力強化)。1部位でも常時発動。
// パッシブ add: 六大ステ(atk/vit/agi/int/pie/luk) と hp/mp/crit(会心率) を直接加算。
export const PART_SKILLS = {
  priest: {
    head: [{ lvl: 1, skill: "DIOS" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "BLESS" }, { lvl: 7, skill: "PROTECT" }, { lvl: 10, skill: "DISPEL" }],
    rhand: [{ lvl: 1, add: { atk: 1 } }, { lvl: 3, add: { pie: 2 } }, { lvl: 5, add: { mp: 3 } }, { lvl: 7, add: { atk: 2 } }, { lvl: 10, add: { pie: 5 } }],
    lhand: [{ lvl: 1, add: { pie: 2 } }, { lvl: 3, add: { vit: 1 } }, { lvl: 5, add: { mp: 3 } }, { lvl: 7, add: { pie: 3 } }, { lvl: 10, add: { vit: 3 } }],
    body:  [{ lvl: 1, add: { hp: 8 } }, { lvl: 3, add: { vit: 2 } }, { lvl: 5, add: { hp: 14 } }, { lvl: 7, add: { pie: 2 } }, { lvl: 10, add: { hp: 24 } }],
    legs:  [{ lvl: 1, add: { agi: 1 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { mp: 2 } }, { lvl: 7, add: { agi: 2 } }, { lvl: 10, add: { agi: 3 } }],
  },
  mage: {
    head: [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "KATINO" }, { lvl: 5, skill: "MAHALITO" }, { lvl: 7, skill: "MADALT" }, { lvl: 10, skill: "TILTOWAIT" }],
    rhand: [{ lvl: 1, add: { int: 2 } }, { lvl: 3, add: { mp: 3 } }, { lvl: 5, add: { int: 3 } }, { lvl: 7, add: { mp: 4 } }, { lvl: 10, add: { int: 5 } }],
    lhand: [{ lvl: 1, add: { mp: 3 } }, { lvl: 3, add: { int: 2 } }, { lvl: 5, add: { mp: 4 } }, { lvl: 7, add: { int: 2 } }, { lvl: 10, add: { mp: 6 } }],
    body:  [{ lvl: 1, add: { hp: 4 } }, { lvl: 3, add: { vit: 1 } }, { lvl: 5, add: { hp: 8 } }, { lvl: 7, add: { int: 2 } }, { lvl: 10, add: { hp: 12 } }],
    legs:  [{ lvl: 1, add: { agi: 1 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { mp: 3 } }, { lvl: 7, add: { agi: 2 } }, { lvl: 10, add: { agi: 2 } }],
  },
  bishop: {
    head: [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "MAHALITO" }, { lvl: 7, skill: "DIAL" }, { lvl: 10, skill: "RESURRECT" }],
    rhand: [{ lvl: 1, add: { int: 1 } }, { lvl: 3, add: { pie: 1 } }, { lvl: 5, add: { mp: 3 } }, { lvl: 7, add: { int: 2 } }, { lvl: 10, add: { pie: 3 } }],
    lhand: [{ lvl: 1, add: { pie: 1 } }, { lvl: 3, add: { int: 1 } }, { lvl: 5, add: { mp: 3 } }, { lvl: 7, add: { pie: 2 } }, { lvl: 10, add: { int: 3 } }],
    body:  [{ lvl: 1, add: { hp: 5 } }, { lvl: 3, add: { vit: 1 } }, { lvl: 5, add: { hp: 9 } }, { lvl: 7, add: { mp: 3 } }, { lvl: 10, add: { hp: 14 } }],
    legs:  [{ lvl: 1, add: { agi: 1 } }, { lvl: 3, add: { mp: 2 } }, { lvl: 5, add: { agi: 1 } }, { lvl: 7, add: { int: 1 } }, { lvl: 10, add: { mp: 4 } }],
  },
  fighter: {
    head: [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "DOUBLE" }, { lvl: 5, skill: "MIDARE" }, { lvl: 7, skill: "WARCRY" }, { lvl: 10, skill: "ISSEN" }],
    rhand: [{ lvl: 1, add: { atk: 1 } }, { lvl: 3, add: { atk: 1 } }, { lvl: 5, add: { atk: 2 } }, { lvl: 7, add: { atk: 2 } }, { lvl: 10, add: { atk: 3 } }],
    lhand: [{ lvl: 1, add: { vit: 1 } }, { lvl: 3, add: { atk: 1 } }, { lvl: 5, add: { vit: 2 } }, { lvl: 7, add: { crit: 0.04 } }, { lvl: 10, add: { vit: 3 } }],
    body:  [{ lvl: 1, add: { hp: 10 } }, { lvl: 3, add: { vit: 2 } }, { lvl: 5, add: { hp: 16 } }, { lvl: 7, add: { hp: 20 } }, { lvl: 10, add: { vit: 4 } }],
    legs:  [{ lvl: 1, add: { agi: 1 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { agi: 2 } }, { lvl: 7, add: { agi: 2 } }, { lvl: 10, add: { agi: 3 } }],
  },
  knight: {
    head: [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "GUARDALL" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "IRONWALL" }, { lvl: 10, skill: "MIDARE" }],
    rhand: [{ lvl: 1, add: { atk: 1 } }, { lvl: 3, add: { vit: 2 } }, { lvl: 5, add: { atk: 1 } }, { lvl: 7, add: { vit: 3 } }, { lvl: 10, add: { atk: 2 } }],
    lhand: [{ lvl: 1, add: { vit: 2 } }, { lvl: 3, add: { vit: 2 } }, { lvl: 5, add: { hp: 12 } }, { lvl: 7, add: { vit: 3 } }, { lvl: 10, add: { vit: 5 } }],
    body:  [{ lvl: 1, add: { hp: 14 } }, { lvl: 3, add: { vit: 3 } }, { lvl: 5, add: { hp: 22 } }, { lvl: 7, add: { vit: 3 } }, { lvl: 10, add: { hp: 30 } }],
    legs:  [{ lvl: 1, add: { vit: 1 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { vit: 2 } }, { lvl: 7, add: { agi: 1 } }, { lvl: 10, add: { vit: 3 } }],
  },
  thief: {
    head: [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "POISONSTAB" }, { lvl: 5, skill: "BLIND" }, { lvl: 7, skill: "ASSASSINATE" }, { lvl: 10, skill: "MIDARE" }],
    rhand: [{ lvl: 1, add: { agi: 2 } }, { lvl: 3, add: { atk: 1 } }, { lvl: 5, add: { crit: 0.04 } }, { lvl: 7, add: { agi: 3 } }, { lvl: 10, add: { atk: 2 } }],
    lhand: [{ lvl: 1, add: { luk: 2 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { luk: 3 } }, { lvl: 7, add: { crit: 0.05 } }, { lvl: 10, add: { luk: 4 } }],
    body:  [{ lvl: 1, add: { hp: 6 } }, { lvl: 3, add: { agi: 1 } }, { lvl: 5, add: { hp: 10 } }, { lvl: 7, add: { vit: 1 } }, { lvl: 10, add: { hp: 16 } }],
    legs:  [{ lvl: 1, add: { agi: 2 } }, { lvl: 3, add: { agi: 2 } }, { lvl: 5, add: { agi: 3 } }, { lvl: 7, add: { agi: 3 } }, { lvl: 10, add: { agi: 5 } }],
  },
};

// ===== 混成職業 (ハイブリッド) =====
// 5部位を「ある職業3つ + 別の職業2つ」で組むと、特別な上位職が発現する。
// 発見要素: プレイヤーが自分で組み合わせを見つける楽しみ = ビルド探索の核。
// キーは "base+sub" (base=3部位の職業 / sub=2部位の職業)。
// spell: 追加で習得する技 / passive: ステータス倍率と表示名 / desc: 職業図鑑の解説文。
export const HYBRIDS = {
  "fighter+thief":  { name: "剣豪",     passive: { critBonus: 0.18, agiMul: 1.12, label: "剣豪の冴え (会心/AGI)" }, desc: "斬撃に影の足捌きを織り込んだ剣の極み。研ぎ澄まされた会心で敵を斬り伏せる。" },
  "fighter+mage":   { name: "魔法剣士", spell: "HALITO", passive: { atkMul: 1.12, label: "魔剣の理 (ATK+)" }, desc: "刃に呪文を纏わせる戦い方。剣で攻めながら、届かぬ敵は炎で焼く。" },
  "fighter+priest": { name: "聖戦士",   spell: "DIOS",   passive: { atkMul: 1.08, vitMul: 1.08, label: "聖なる闘気" }, desc: "祈りを力に変える戦士。攻守を高めつつ、自らの傷を癒して戦い続ける。" },
  "fighter+knight": { name: "重戦士",   passive: { atkMul: 1.12, vitMul: 1.10, label: "鉄血 (ATK/VIT)" }, desc: "攻めの剛力と守りの錬度を兼ね備えた、純粋な前衛の完成形。" },
  "knight+priest":  { name: "聖騎士",   spell: "DIAL",   passive: { vitMul: 1.16, label: "守護の誓い (VIT++)" }, desc: "守護の誓いに聖句を重ねた生ける盾。最も堅く、傷を癒す術も持つ。" },
  "knight+fighter": { name: "聖堂騎士", spell: "KYOUGEKI", passive: { vitMul: 1.10, atkMul: 1.08, label: "城壁の構え" }, desc: "城壁の如き構えから強撃を放つ、攻防一体の重装騎士。" },
  "knight+thief":   { name: "斥候騎士", passive: { vitMul: 1.10, agiMul: 1.15, label: "軽装騎士 (VIT/AGI)" }, desc: "重装ながら身軽さを失わぬ偵察騎士。守りを固めつつ先手を取る。" },
  "mage+priest":    { name: "賢者",     spell: "DIAL",   passive: { label: "理を識る者 (全呪文)" }, desc: "魔と聖、二つの理をともに識る者。あらゆる呪文に通じる万能の術士。" },
  "mage+thief":     { name: "魔盗賊",   spell: "MAHALITO", passive: { agiMul: 1.18, critBonus: 0.10, label: "影呪 (AGI/会心)" }, desc: "影に潜んで呪文を放つ異形の術士。素早さと会心が術士の脆さを補う。" },
  "mage+fighter":   { name: "戦技師",   spell: "KYOUGEKI", passive: { atkMul: 1.10, label: "武装魔導" }, desc: "肉体を鍛え上げた魔術師。前線で杖を振るい、武技すら使いこなす。" },
  "priest+mage":    { name: "司教",     spell: "MAHALITO", passive: { label: "二道の信徒 (攻呪+)" }, desc: "聖職にありながら攻撃呪文を修めた二道の信徒。癒しと業火を併せ持つ。" },
  "priest+knight":  { name: "審問官",   spell: "MADIOS",  passive: { vitMul: 1.10, label: "断罪の祈り" }, desc: "断罪の祈りで身を固めた聖職者。打たれ強く、大いなる回復をも担う。" },
  "priest+fighter": { name: "戦僧",     spell: "MIDARE",  passive: { atkMul: 1.12, label: "破邪の拳" }, desc: "拳と祈りで戦う破戒の僧。乱れ斬りの如き連撃で魔を祓う。" },
  "thief+mage":     { name: "呪術師",   spell: "HALITO",  passive: { agiMul: 1.18, label: "呪詛 (AGI++)" }, desc: "盗賊の業に呪詛を混ぜた異端者。圧倒的な素早さで敵を翻弄する。" },
  "thief+fighter":  { name: "野伏",     spell: "KYOUGEKI", passive: { critBonus: 0.14, atkMul: 1.06, label: "不意打ち" }, desc: "野に生きる狩人。不意打ちと会心で、確実に獲物を仕留める。" },
  "thief+priest":   { name: "祓魔師",   spell: "DIOS",    passive: { agiMul: 1.12, critBonus: 0.08, label: "聖盗 (AGI/会心)" }, desc: "聖印を帯びた影。誰よりも速く動き、傷ついた仲間に癒しを届ける。" },
  "bishop+mage":    { name: "大魔導",   spell: "MAHALITO", passive: { label: "深淵の知識 (攻呪++)" }, desc: "深淵の知識に到達した導師。攻撃呪文の極みに立つ者。" },
  "bishop+priest":  { name: "大司教",   spell: "MADIOS",  passive: { label: "聖典の守護者" }, desc: "聖典の守護者にして教団の柱。魔導僧の頂に立つ。" },
};

// ===== 職業図鑑 (王宮書庫) 用の解説文 =====
// 各基本職の由来 (desc) と活用指針 (tips)。発見した職業のみ閲覧できる。
export const JOB_LORE = {
  fighter: {
    desc: "戦場の記憶を宿す魂。剣を握って生き、剣を握って死んだ者たちの執念が、人業の腕に力を与える。",
    tips: "高いATKとHPで前衛の軸となる。頭に宿せば強撃や乱れ斬りで攻め立て、職業ランクが上がるほど会心の刃が冴える。",
  },
  knight: {
    desc: "守りの誓いを抱いたまま朽ちた騎士の魂。盾の重みを、誇りの重みとして覚えている。",
    tips: "随一のHPとVITで仲間の盾となる。守りの号令や鉄壁で隊全体を支え、極まれば致死の一撃すら一度は耐え抜く。",
  },
  thief: {
    desc: "影に生き、影に消えた者の魂。錠前と急所、そして逃げ道の在り処を知り尽くしている。",
    tips: "AGIとLUKで先手と会心を取る遊撃手。毒刃や急所突きで厄介な敵を素早く仕留める。",
  },
  mage: {
    desc: "禁書とともに焼かれた魔術師の魂。灰の中でなお、呪文の韻だけは忘れなかった。",
    tips: "INTが攻撃呪文の威力を決める。マハリトで敵陣を薙ぎ、ティルトウェイトで戦場ごと消し飛ばす。MPの管理が肝要。",
  },
  priest: {
    desc: "祈りの果てに神の沈黙を知った聖職者の魂。それでも祈ることをやめなかった者だけが、癒しの力を残す。",
    tips: "PIEが回復量を決める。蘇生の秘蹟を扱える唯一の系譜であり、聖者に至れば全滅の淵から一度だけ皆を引き戻す。",
  },
  bishop: {
    desc: "魔と聖、二つの道を同時に究めようとした異端者の魂。教会は彼らを破門し、迷宮は彼らを歓迎した。",
    tips: "攻撃呪文と回復呪文を兼ね、一人で二役をこなす。賢者王に至ればリザレクションとティルトウェイトを併せ持つ。",
  },
};

// 職業ランクの特殊効果 (flag) の説明文
export const FLAG_DESC = {
  blessing: "聖者の加護: 全滅時、一度だけ全員がHP1で踏みとどまる",
  endure: "不屈: 致死のダメージを一度だけHP1で耐える",
  spellMaster: "魔道の極み: 攻撃呪文の威力+25%",
};

// 部位タリーから混成職を判定。base(3) と sub(2) のときのみ成立し {key,name,...} を返す
export function findHybrid(counts) {
  let baseK = null;
  for (const k in counts) if (counts[k] === 3) baseK = k;
  if (!baseK) return null;
  let subK = null;
  for (const k in counts) if (k !== baseK && counts[k] === 2) subK = k;
  if (!subK) return null;
  const key = baseK + "+" + subK;
  const h = HYBRIDS[key];
  return h ? { key, baseK, subK, ...h } : null;
}

// 六大ステータス (これが唯一のステータス体系。派生値 こうげき/ぼうぎょ/AC は廃止)
// ATK攻撃 / VIT体力(被ダメ軽減) / AGI敏捷(行動順・回避) / INT知力(呪文威力) / PIE信仰(回復量) / LUK幸運(会心)
export const ATTR_KEYS = ["atk", "vit", "agi", "int", "pie", "luk"];
export const ATTR_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
export const ATTR_NAME = {
  atk: "攻撃力", vit: "体力 (被ダメージ軽減)", agi: "敏捷 (行動順・回避)",
  int: "知力 (攻撃呪文の威力)", pie: "信仰 (回復呪文の威力)", luk: "幸運 (会心率)",
};

let _soulUid = 0;

// ---- 魂のランク ----
// 上位ランクほどステータス係数が高く、初期レベル上限(cap)も高い。
// 優秀以上はダンジョンでのみ入手 (合成では作れない)。
export const SOUL_RANKS = {
  normal: { label: "",       mul: 1.0,  color: null,      order: 0, cap: 20 },
  fine:   { label: "優秀な", mul: 1.25, color: "#7fd0ff", order: 1, cap: 40 },
  great:  { label: "偉大な", mul: 1.6,  color: "#c08aff", order: 2, cap: 60 },
  legend: { label: "伝説の", mul: 2.2,  color: "#ffcf4a", order: 3, cap: 100 },
};
// 限界突破で到達できる上限 (初期cap + 50)
export function soulHardCap(s) { return SOUL_RANKS[s.rank || "normal"].cap + 50; }

// ランク抽選: legend 0.5% / great 1.7% / fine 10% / それ以外 normal
// bonus(0〜): 深い迷宮ほどレア魂が出やすくなる倍率加算
export function rollSoulRank(bonus = 0) {
  const m = 1 + Math.max(0, bonus);
  const pLegend = 0.005 * m;
  const pGreat = 0.017 * m;
  const pFine = Math.min(0.6, 0.10 * (1 + bonus * 0.5));
  const r = Math.random();
  if (r < pLegend) return "legend";
  if (r < pLegend + pGreat) return "great";
  if (r < pLegend + pGreat + pFine) return "fine";
  return "normal";
}

// 魂を生成。clsKey: 職業 / level / part: 対応部位 (省略時ランダム) / rank
export function makeSoul(clsKey, level = 1, part = null, rank = "normal") {
  if (!SOUL_CLASSES[clsKey]) return null;
  if (!part) part = PARTS[Math.floor(Math.random() * PARTS.length)];
  if (!SOUL_RANKS[rank]) rank = "normal";
  const cap = SOUL_RANKS[rank].cap;
  return { uid: ++_soulUid, clsKey, part, rank, level: Math.min(level, cap), cap };
}

// 旧セーブ等で cap 未設定の魂を補正する
export function ensureSoul(s) {
  if (!s) return s;
  if (s.cap == null) s.cap = SOUL_RANKS[s.rank || "normal"].cap;
  if (s.level == null) s.level = 1;
  if (s.level > s.cap) s.level = s.cap;
  return s;
}

// 魂の表示名。例: 「伝説の戦士の魂（頭）Lv3」
export function soulName(s) {
  const rank = SOUL_RANKS[s.rank || "normal"].label;
  const part = s.part ? `（${PART_LABEL[s.part]}）` : "";
  return `${rank}${SOUL_CLASSES[s.clsKey].label}の魂${part} Lv${s.level}`;
}

// レベル係数: 1部位の寄与は (1 + (level-1)*0.12) 倍
function lvlFactor(level) {
  return 1 + (level - 1) * 0.12;
}

// 魂1つの総合係数 (レベル × ランク)
function soulFactor(s) {
  return lvlFactor(s.level) * SOUL_RANKS[s.rank || "normal"].mul;
}

// 魂1つが持つステータス (人業のステータスはこれの合計)
export function soulStats(s) {
  const st = SOUL_CLASSES[s.clsKey].stat;
  const f = soulFactor(s);
  const r1 = (v) => Math.round((v || 0) * f * 10) / 10;
  return {
    hp: Math.round(st.hp * f),
    mp: Math.round(st.mp * f),
    atk: r1(st.atk), vit: r1(st.vit), agi: r1(st.agi),
    int: r1(st.int), pie: r1(st.pie), luk: r1(st.luk),
  };
}

let _dollUid = 0;

// 空の人業を生成 (部位はすべて空)
export function makeDoll(name) {
  return {
    uid: ++_dollUid,
    name,
    isDoll: true,
    parts: { head: null, rhand: null, lhand: null, body: null, legs: null },
    // --- 以下は recalcDoll が埋める従来メンバー互換フィールド ---
    clsKey: "fighter", cls: "無職",
    level: 1,
    hp: 1, maxhp: 1, mp: 0, maxmp: 0,
    atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0,
    base: { hp: 1, mp: 0, atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0 },
    equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
    items: [],
    ailment: null,
    spells: [],
    passives: [],
    alive: true, side: "party",
  };
}

// 封じている魂の配列 (空部位を除く)
export function dollSouls(doll) {
  return PARTS.map((p) => doll.parts[p]).filter(Boolean);
}

// 支配的な職業 { clsKey, count, maxLevel } を返す。魂ゼロなら null
export function dominantClass(doll) {
  const tally = {};
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    tally[s.clsKey] = tally[s.clsKey] || { count: 0, maxLevel: 0 };
    tally[s.clsKey].count++;
    tally[s.clsKey].maxLevel = Math.max(tally[s.clsKey].maxLevel, s.level);
  }
  let best = null;
  for (const k in tally) {
    if (!best || tally[k].count > best.count) best = { clsKey: k, ...tally[k] };
  }
  return best;
}

// 人業の合計ステータス・職業・スキルを魂から再計算し、装備補正を適用
// 人業自体の初期ステータスは 0。宿した魂の合計値がそのまま人業の力になる。
export function recalcDoll(doll) {
  let hp = 0, mp = 0, atk = 0, vit = 0, agi = 0, int = 0, pie = 0, luk = 0;
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (!s) continue;
    const st = soulStats(s);
    hp += st.hp; mp += st.mp; atk += st.atk; vit += st.vit; agi += st.agi;
    int += st.int; pie += st.pie; luk += st.luk;
  }

  const dom = dominantClass(doll);
  const spells = [];
  const passives = [];
  const flags = {};        // blessing / endure / spellMaster
  let crit = 0;
  let clsLabel = "空の器";
  let clsKey = "fighter";

  // 部位ごとの職業数を集計し、混成職(3+2)を判定
  const counts = {};
  for (const p of PARTS) { const s = doll.parts[p]; if (s) counts[s.clsKey] = (counts[s.clsKey] || 0) + 1; }
  const hybrid = findHybrid(counts);
  doll.hybrid = hybrid ? hybrid.name : null;

  // 職業ランク判定 (支配職が3部位以上で発現) — 称号(cls名)に使う
  const jr = jobRankOf(doll);
  doll.jobRank = jr ? jr.rank : 0;

  // パッシブ集計 (頭以外の各部位の魂のスキル表から、魂レベルに応じて累積)
  const pAdd = { atk: 0, vit: 0, agi: 0, int: 0, pie: 0, luk: 0, hp: 0, mp: 0, crit: 0 };
  for (const part of ["rhand", "lhand", "body", "legs"]) {
    const s = doll.parts[part];
    if (!s) continue;
    const tbl = PART_SKILLS[s.clsKey] && PART_SKILLS[s.clsKey][part];
    if (!tbl) continue;
    for (const e of tbl) if (s.level >= e.lvl && e.add) for (const k in e.add) pAdd[k] += e.add[k];
  }
  // パッシブを反映 (六大ステ/hp/mp/crit を直接加算)
  hp  += pAdd.hp;
  mp  += pAdd.mp;
  atk += pAdd.atk;
  vit += pAdd.vit;
  agi += pAdd.agi;
  int += pAdd.int;
  pie += pAdd.pie;
  luk += pAdd.luk;
  crit += pAdd.crit;

  // 職業の素のパッシブ倍率 (発現=同職3部位以上のときフル適用)
  if (jr) {
    clsKey = jr.clsKey;
    clsLabel = JOB_RANKS[clsKey][jr.rank - 1].name;
    const def0 = SOUL_CLASSES[clsKey];
    if (def0.passive) {
      passives.push(def0.passive.label);
      if (def0.passive.atkMul) atk *= def0.passive.atkMul;
      if (def0.passive.vitMul) vit *= def0.passive.vitMul;
      if (def0.passive.agiMul) agi *= def0.passive.agiMul;
      if (def0.passive.critBonus) crit += def0.passive.critBonus;
    }
    passives.push(`職業ランク${jr.rank}: ${clsLabel}`);
  }

  // アクションスキル: 頭の魂の職業が3部位以上のとき、その頭スキルを習得
  const head = doll.parts.head;
  if (head) {
    const J = head.clsKey;
    const tbl = PART_SKILLS[J] && PART_SKILLS[J].head;
    if (tbl && (counts[J] || 0) >= 3) {
      for (const e of tbl) if (head.level >= e.lvl && e.skill && !spells.includes(e.skill)) spells.push(e.skill);
    }
  }

  // 混成職が発現していれば名称を上書きし、追加スキル・補正を付与
  if (hybrid) {
    clsLabel = hybrid.name;
    if (hybrid.spell && !spells.includes(hybrid.spell) && doll.parts.head && counts[hybrid.baseK] >= 3) spells.push(hybrid.spell);
    const hp2 = hybrid.passive || {};
    if (hp2.label) passives.push(hp2.label);
    if (hp2.atkMul) atk *= hp2.atkMul;
    if (hp2.vitMul) vit *= hp2.vitMul;
    if (hp2.agiMul) agi *= hp2.agiMul;
    if (hp2.critBonus) crit += hp2.critBonus;
  }

  doll.clsKey = clsKey;
  doll.cls = clsLabel + (hybrid ? "(混成)" : jr ? `・ランク${jr.rank}` : "");
  doll.tier = jr ? (hybrid ? "hybrid" : "rank" + jr.rank) : "none";
  doll.dominant = dom;
  doll.blessing = false;
  doll.endure = false;
  doll.spellMaster = false;
  // 人業の「レベル」= 封印した魂の平均レベル (表示用)
  const souls = dollSouls(doll);
  doll.level = souls.length ? Math.max(1, Math.round(souls.reduce((a, s) => a + s.level, 0) / souls.length)) : 1;

  doll.base = {
    // 器そのものは 0。魂の合計がそのまま器の力 (HPだけ最低1で即死を防ぐ)
    hp: Math.max(1, Math.round(hp)), mp: Math.round(mp),
    atk: Math.round(atk), vit: Math.round(vit), agi: Math.max(1, Math.round(agi)),
    int: Math.round(int), pie: Math.round(pie), luk: Math.round(luk),
    crit, // 会心率ボーナス (recalc が装備分と合算して critBonus にする)
  };
  doll.spells = spells;
  doll.passives = passives;
  delete doll.attrs; // 旧体系の表示用能力値 (廃止。六大ステに統一)

  // 装備補正を base に重ねて最終ステータス確定 (items.js の recalc を流用)
  recalc(doll);
  return doll;
}

// 部位に魂を封じる。既に封印があれば外して stock へ戻す処理は呼び出し側で。
export function sealSoul(doll, part, soul) {
  doll.parts[part] = soul;
  recalcDoll(doll);
}

// 新規プレイ時の初期編成。3体の人業 + 予備の魂を返す。
// 器そのものは弱いが、魂を鍛え/組み替えて強くしていく導入。
export function createStartingRoster() {
  const dolls = [];

  const garo = makeDoll("ガロ");
  for (const p of PARTS) garo.parts[p] = makeSoul("fighter", 1, p);
  recalcDoll(garo);
  dolls.push(garo);

  const saria = makeDoll("サリア");
  saria.parts.head = makeSoul("mage", 1, "head");
  saria.parts.rhand = makeSoul("mage", 1, "rhand");
  saria.parts.body = makeSoul("mage", 1, "body");
  saria.parts.lhand = makeSoul("thief", 1, "lhand");
  saria.parts.legs = makeSoul("thief", 1, "legs");
  recalcDoll(saria);
  dolls.push(saria);

  const mina = makeDoll("ミナ");
  mina.parts.head = makeSoul("priest", 1, "head");
  mina.parts.rhand = makeSoul("priest", 1, "rhand");
  mina.parts.body = makeSoul("priest", 1, "body");
  mina.parts.lhand = makeSoul("knight", 1, "lhand");
  mina.parts.legs = makeSoul("knight", 1, "legs");
  recalcDoll(mina);
  dolls.push(mina);

  // 予備の魂 (組み替え・新しい人業づくり用)
  const souls = [
    makeSoul("fighter", 1, "rhand"), makeSoul("fighter", 1, "body"),
    makeSoul("knight", 1, "head"),
    makeSoul("thief", 1, "legs"), makeSoul("thief", 1, "lhand"),
    makeSoul("mage", 1, "head"),
    makeSoul("priest", 1, "body"),
  ];

  return { dolls, souls };
}

// 魂のドット絵 (部位スロット/一覧表示用)。職業色の宝珠。
export function soulSprite(clsKey) {
  const c = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  return {
    palette: { "0": "#0a0a12", "1": c.color, "2": c.glow, "3": "#ffffff" },
    art: [
      "....0000....",
      "..00222200..",
      ".02211112 20.",
      ".0211333110.",
      "021133331 20",
      "021113311120",
      "021111111120",
      "021111111120",
      ".0211111120.",
      ".0221111220.",
      "..00222200..",
      "....0000....",
    ],
  };
}
