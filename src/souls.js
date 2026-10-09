import { zeroResists } from "./resistance.js";
// 魂(Soul)と人業(Doll)のデータモデル — 新仕様 (36職業・ランク1-5・レア度・融合)
//
// 魂のランク = 職業の位階 (1〜5)。同じ職業の魂を3部位以上に宿すと職業発現。
// 上位ランクの魂は下位ランクの代替になり、発現ランクは「rank>=r が3部位以上」を満たす最大の r。
// 5部位すべて同系列職業 (同clsKey) でランクボーナス発生。上位ランクはダンジョンでは出ず、融合で入手。
import { recalc, registerJobGear } from "./items.js";
import { JOB_LORE_RANKS } from "./joblore.js";
import { JOB_IMAGES } from "./jobart.js";
import { JOB_PHOTOS, PHOTO_RES } from "./jobphotos.js";
import { ICONS } from "./sprites.js";
import { JOBKIT_TABLES, JOBKIT_PERKS, JOBKIT_AWAKEN } from "./jobkit/index.js";
import { SPELLS } from "./skilldefs.js";
import { itemFitLv } from "./dungeons/world.js";

export const PARTS = ["head", "rhand", "lhand", "body", "legs"];
export const PART_LABEL = { head: "頭", rhand: "右手", lhand: "左手", body: "胴体", legs: "足" };

// ===== 職業定義 (36職) =====
// rarity: common/rare/epic/legend — ドロップ率と合成コスト・ステータス係数に影響
// stat: 1部位・Lv1・ランク1・レア度normalでの基本寄与量
export const SOUL_CLASSES = {
  // ===== コモン (6) =====
  fighter:     { label: "戦士",   rarity: "common",  color: "#d4504e", glow: "#ff7a72", stat: { hp: 7.0, mp: 0.7, atk: 2.4, vit: 1.6, agi: 1.2, int: 0.3, pie: 0.4, luk: 1.0 } },
  knight:      { label: "騎士",   rarity: "common",  color: "#7c93c8", glow: "#a9c0ff", stat: { hp: 8.4, mp: 0.6, atk: 2.2, vit: 2.4, agi: 0.8, int: 0.4, pie: 0.8, luk: 0.9 } },
  priest:      { label: "僧侶",   rarity: "common",  color: "#e8c47a", glow: "#ffe2a0", stat: { hp: 4.8, mp: 2.4, atk: 1.4, vit: 1.0, agi: 1.0, int: 0.9, pie: 2.8, luk: 1.1 } },
  mage:        { label: "魔導士", rarity: "common",  color: "#b06bff", glow: "#d3a8ff", stat: { hp: 3.6, mp: 2.8, atk: 1.0, vit: 0.6, agi: 1.4, int: 2.8, pie: 0.8, luk: 1.0 } },
  thief:       { label: "盗賊",   rarity: "common",  color: "#6fae46", glow: "#9be88a", stat: { hp: 4.4, mp: 0.8, atk: 1.8, vit: 1.0, agi: 2.4, int: 0.8, pie: 0.4, luk: 2.0 } },
  bishop:      { label: "司教",   rarity: "common",  color: "#5fb8d6", glow: "#aef0ff", stat: { hp: 4.4, mp: 3.2, atk: 1.2, vit: 0.8, agi: 1.2, int: 2.0, pie: 2.0, luk: 1.0 } },
  // ===== レア (12) =====
  samurai:     { label: "侍",       rarity: "rare",    color: "#c8a84a", glow: "#f0d070", stat: { hp: 6.0, mp: 0.9, atk: 2.8, vit: 1.4, agi: 2.0, int: 0.4, pie: 0.3, luk: 1.5 } },
  berserker:   { label: "狂戦士",   rarity: "rare",    color: "#c84040", glow: "#ff6060", stat: { hp: 8.0, mp: 0.5, atk: 3.2, vit: 1.8, agi: 1.0, int: 0.2, pie: 0.2, luk: 1.0 } },
  hunter:      { label: "狩人",     rarity: "rare",    color: "#5aaa38", glow: "#88ee60", stat: { hp: 5.2, mp: 1.0, atk: 2.4, vit: 1.0, agi: 2.6, int: 0.6, pie: 0.3, luk: 2.4 } },
  shadow:      { label: "暗殺者",   rarity: "rare",    color: "#6848a8", glow: "#a080e0", stat: { hp: 4.0, mp: 1.2, atk: 2.0, vit: 0.8, agi: 2.8, int: 1.0, pie: 0.3, luk: 2.6 } },
  paladin:     { label: "聖騎士",   rarity: "rare",    color: "#d4c8a0", glow: "#fff0c0", stat: { hp: 7.5, mp: 1.8, atk: 1.8, vit: 2.2, agi: 0.9, int: 0.6, pie: 2.0, luk: 1.0 } },
  guardian:    { label: "守護騎士", rarity: "rare",    color: "#708098", glow: "#a0b8d0", stat: { hp: 9.5, mp: 0.6, atk: 2.0, vit: 2.8, agi: 0.7, int: 0.3, pie: 0.6, luk: 0.8 } },
  spellblade:  { label: "魔法剣士", rarity: "rare",    color: "#9050d0", glow: "#c090ff", stat: { hp: 5.5, mp: 1.8, atk: 2.0, vit: 1.2, agi: 1.4, int: 2.0, pie: 0.5, luk: 1.0 } },
  monk:        { label: "武僧",     rarity: "rare",    color: "#d08050", glow: "#f0b070", stat: { hp: 6.5, mp: 1.6, atk: 2.2, vit: 1.4, agi: 1.2, int: 0.5, pie: 1.8, luk: 1.0 } },
  hexer:       { label: "呪術師",   rarity: "rare",    color: "#50a050", glow: "#80d080", stat: { hp: 4.0, mp: 2.4, atk: 1.4, vit: 0.8, agi: 1.6, int: 1.8, pie: 0.6, luk: 2.2 } },
  hermit:      { label: "隠修士",   rarity: "rare",    color: "#a0b880", glow: "#c8e0a0", stat: { hp: 5.0, mp: 2.0, atk: 1.4, vit: 1.0, agi: 2.0, int: 0.8, pie: 2.0, luk: 1.4 } },
  brigand:     { label: "義賊",     rarity: "rare",    color: "#e08030", glow: "#ffb050", stat: { hp: 5.5, mp: 1.0, atk: 2.2, vit: 1.2, agi: 2.2, int: 0.5, pie: 0.4, luk: 2.4 } },
  arcthief:    { label: "魔盗賊",   rarity: "rare",    color: "#8040c0", glow: "#b070f0", stat: { hp: 4.0, mp: 2.2, atk: 1.6, vit: 0.8, agi: 2.4, int: 2.2, pie: 0.4, luk: 1.8 } },
  // ===== エピック (10) =====
  crusader:    { label: "聖戦士",   rarity: "epic",    color: "#e8d860", glow: "#fff090", stat: { hp: 7.0, mp: 1.4, atk: 2.6, vit: 1.6, agi: 1.2, int: 0.4, pie: 2.0, luk: 1.0 } },
  battlemage:  { label: "魔闘士",   rarity: "epic",    color: "#9060a0", glow: "#c090d0", stat: { hp: 6.0, mp: 2.0, atk: 2.4, vit: 1.4, agi: 1.2, int: 1.8, pie: 0.4, luk: 1.0 } },
  darkknight:  { label: "魔騎士",   rarity: "epic",    color: "#406080", glow: "#70a0c0", stat: { hp: 8.0, mp: 2.0, atk: 2.0, vit: 2.2, agi: 0.9, int: 1.6, pie: 0.6, luk: 0.9 } },
  templar:     { label: "神殿騎士", rarity: "epic",    color: "#d0c880", glow: "#f8f0a0", stat: { hp: 7.5, mp: 2.2, atk: 1.8, vit: 2.4, agi: 0.8, int: 0.5, pie: 1.8, luk: 1.0 } },
  exorcist:    { label: "祓魔師",   rarity: "epic",    color: "#d080a0", glow: "#f0b0c0", stat: { hp: 5.0, mp: 1.6, atk: 2.2, vit: 1.0, agi: 2.4, int: 0.8, pie: 1.6, luk: 2.0 } },
  warden:      { label: "護法師",   rarity: "epic",    color: "#60a080", glow: "#90d0b0", stat: { hp: 5.5, mp: 2.8, atk: 1.2, vit: 1.4, agi: 1.2, int: 2.6, pie: 1.0, luk: 1.0 } },
  arcanist:    { label: "秘術師",   rarity: "epic",    color: "#c080f0", glow: "#e0b0ff", stat: { hp: 4.0, mp: 3.0, atk: 1.0, vit: 0.6, agi: 1.4, int: 3.2, pie: 0.8, luk: 1.2 } },
  inquisitor:  { label: "審問官",   rarity: "epic",    color: "#e08060", glow: "#ffa080", stat: { hp: 6.0, mp: 2.0, atk: 2.0, vit: 1.6, agi: 1.0, int: 0.6, pie: 2.2, luk: 1.2 } },
  archbishop:  { label: "巡礼者",   rarity: "epic",    color: "#f0d0a0", glow: "#fff0c0", stat: { hp: 5.5, mp: 3.0, atk: 1.0, vit: 1.0, agi: 1.0, int: 1.6, pie: 3.0, luk: 1.0 } },
  ascetic:     { label: "修験者",   rarity: "epic",    color: "#a09070", glow: "#c8b890", stat: { hp: 7.0, mp: 2.2, atk: 2.2, vit: 1.4, agi: 1.0, int: 1.0, pie: 2.0, luk: 0.8 } },
  // ===== レジェンド (8) =====
  hero:        { label: "勇者",     rarity: "legend",  color: "#f0e060", glow: "#fff080", stat: { hp: 8.0, mp: 2.0, atk: 2.5, vit: 2.0, agi: 1.5, int: 1.5, pie: 1.5, luk: 1.5 } },
  asura:       { label: "修羅",     rarity: "legend",  color: "#e04040", glow: "#ff6060", stat: { hp: 7.0, mp: 1.0, atk: 3.5, vit: 1.5, agi: 2.0, int: 0.3, pie: 0.2, luk: 2.5 } },
  dragonknight:{ label: "竜騎士",   rarity: "legend",  color: "#40d080", glow: "#80ffa0", stat: { hp: 9.0, mp: 1.8, atk: 2.8, vit: 2.5, agi: 1.2, int: 0.5, pie: 0.5, luk: 1.0 } },
  necromancer: { label: "死霊術師", rarity: "legend",  color: "#8050b0", glow: "#b080e0", stat: { hp: 5.0, mp: 3.5, atk: 1.5, vit: 0.8, agi: 1.5, int: 3.0, pie: 0.6, luk: 1.5 } },
  sage:        { label: "賢者",     rarity: "legend",  color: "#80c0e0", glow: "#b0e8ff", stat: { hp: 5.0, mp: 3.5, atk: 1.0, vit: 0.8, agi: 1.4, int: 3.0, pie: 2.5, luk: 1.0 } },
  cardinal:    { label: "枢機卿",   rarity: "legend",  color: "#c04080", glow: "#f060a0", stat: { hp: 6.0, mp: 3.0, atk: 1.0, vit: 1.2, agi: 1.0, int: 1.5, pie: 3.5, luk: 1.0 } },
  archmage:    { label: "大魔導",   rarity: "legend",  color: "#6040e0", glow: "#9070ff", stat: { hp: 4.5, mp: 4.0, atk: 0.8, vit: 0.6, agi: 1.4, int: 4.0, pie: 0.8, luk: 1.0 } },
  chaplain:    { label: "護教官",   rarity: "legend",  color: "#d0c0f0", glow: "#f0e8ff", stat: { hp: 8.5, mp: 2.5, atk: 1.8, vit: 2.8, agi: 0.8, int: 0.8, pie: 2.0, luk: 0.8 } },
  // ===== 固有 (人業セラだけの専用職。迷宮では拾えず、ほかの人業には宿せず、サブ魂にも貸さない) =====
  // ランクは物語の節目で上がる (game.js seraRankTarget: count = ランク)。レア度 unique の数値は下の表
  sera:        { label: "灯守",     rarity: "unique",  unique: true, color: "#6fb8c8", glow: "#bfeaf4", stat: { hp: 8.0, mp: 1.8, atk: 2.0, vit: 2.6, agi: 1.4, int: 0.6, pie: 1.8, luk: 1.2 } },
};
// 固有の職 (セラの灯守) か。魂の抽選・融合・サブ魂・結社・人業の仕立ての対象から外す
export function isUniqueJob(clsKey) { return !!(SOUL_CLASSES[clsKey] && SOUL_CLASSES[clsKey].unique); }

export const SOUL_KEYS = Object.keys(SOUL_CLASSES);

// ===== 職業ランク (1〜5) 称号 =====
export const JOB_RANKS = {
  fighter:     [{ name: "見習い戦士" }, { name: "戦士" }, { name: "剣士" }, { name: "剣豪" }, { name: "剣聖" }],
  knight:      [{ name: "見習い騎士" }, { name: "騎士" }, { name: "重騎士" }, { name: "騎士団長" }, { name: "大騎士団長" }],
  priest:      [{ name: "見習い僧侶" }, { name: "僧侶" }, { name: "神官" }, { name: "聖職者" }, { name: "聖者" }],
  mage:        [{ name: "見習い魔導士" }, { name: "魔導士" }, { name: "上級魔導士" }, { name: "魔導師" }, { name: "大魔導師" }],
  thief:       [{ name: "見習い盗賊" }, { name: "盗賊" }, { name: "熟練盗賊" }, { name: "怪盗" }, { name: "大怪盗" }],
  bishop:      [{ name: "助祭" }, { name: "司教" }, { name: "主教" }, { name: "府主教" }, { name: "教父" }],
  samurai:     [{ name: "浪人" }, { name: "侍" }, { name: "剣客" }, { name: "侍大将" }, { name: "剣神" }],
  berserker:   [{ name: "荒武者" }, { name: "狂戦士" }, { name: "血戦鬼" }, { name: "大戦鬼" }, { name: "鬼神" }],
  hunter:      [{ name: "見習い狩人" }, { name: "狩人" }, { name: "獣狩り" }, { name: "首狩り" }, { name: "狩猟王" }],
  shadow:      [{ name: "闇稼業" }, { name: "暗殺者" }, { name: "影刃" }, { name: "死神の手" }, { name: "夜刃" }],
  paladin:     [{ name: "聖騎士見習い" }, { name: "聖騎士" }, { name: "聖堂守護" }, { name: "聖騎士長" }, { name: "神盾公" }],
  guardian:    [{ name: "城門衛士" }, { name: "守護騎士" }, { name: "城塞騎士" }, { name: "大城塞騎士" }, { name: "不落の城壁" }],
  spellblade:  [{ name: "魔剣の徒" }, { name: "魔法剣士" }, { name: "魔刃士" }, { name: "大魔剣士" }, { name: "魔剣聖" }],
  monk:        [{ name: "行者" }, { name: "武僧" }, { name: "大武僧" }, { name: "拳聖" }, { name: "金剛力士" }],
  hexer:       [{ name: "呪い屋" }, { name: "呪術師" }, { name: "毒呪師" }, { name: "大呪術師" }, { name: "禍津神" }],
  hermit:      [{ name: "庵主" }, { name: "隠修士" }, { name: "山隠れ" }, { name: "深山の隠者" }, { name: "霞の聖人" }],
  brigand:     [{ name: "小盗" }, { name: "義賊" }, { name: "侠盗" }, { name: "大侠盗" }, { name: "伝説の義賊" }],
  arcthief:    [{ name: "魔盗り" }, { name: "魔盗賊" }, { name: "幻影盗" }, { name: "宵闇の魔手" }, { name: "霧の大盗" }],
  crusader:    [{ name: "聖戦の徒" }, { name: "聖戦士" }, { name: "聖剣士" }, { name: "聖戦将" }, { name: "神威の剣" }],
  battlemage:  [{ name: "闘僧" }, { name: "魔闘士" }, { name: "闘法士" }, { name: "大魔闘士" }, { name: "闘神" }],
  darkknight:  [{ name: "魔盾兵" }, { name: "魔騎士" }, { name: "呪鎧騎士" }, { name: "大魔騎士" }, { name: "魔城公" }],
  templar:     [{ name: "神殿衛士" }, { name: "神殿騎士" }, { name: "聖跡守護" }, { name: "神殿騎士長" }, { name: "法城の盾" }],
  exorcist:    [{ name: "祓い屋" }, { name: "祓魔師" }, { name: "聖影" }, { name: "大祓魔師" }, { name: "宵闇の聖者" }],
  warden:      [{ name: "護法見習い" }, { name: "護法師" }, { name: "結界師" }, { name: "大結界師" }, { name: "法城の賢者" }],
  arcanist:    [{ name: "写本師" }, { name: "秘術師" }, { name: "秘文士" }, { name: "秘奥導師" }, { name: "深淵の秘術師" }],
  inquisitor:  [{ name: "修道士" }, { name: "審問官" }, { name: "断罪官" }, { name: "大審問官" }, { name: "神罰の執行者" }],
  archbishop:  [{ name: "旅の修道士" }, { name: "巡礼者" }, { name: "聖地の巡礼者" }, { name: "大巡礼者" }, { name: "聖泉の聖者" }],
  ascetic:     [{ name: "行人" }, { name: "修験者" }, { name: "山伏" }, { name: "大先達" }, { name: "権現" }],
  hero:        [{ name: "選定の徒" }, { name: "勇者" }, { name: "大勇者" }, { name: "英雄" }, { name: "救世主" }],
  asura:       [{ name: "武芸者" }, { name: "修羅" }, { name: "羅刹" }, { name: "阿修羅" }, { name: "阿修羅王" }],
  dragonknight:[{ name: "竜の従士" }, { name: "竜騎士" }, { name: "飛竜騎士" }, { name: "竜騎士長" }, { name: "竜帝" }],
  necromancer: [{ name: "屍読み" }, { name: "死霊術師" }, { name: "死霊導師" }, { name: "死霊王" }, { name: "冥導王" }],
  sage:        [{ name: "見習い賢者" }, { name: "賢者" }, { name: "博学者" }, { name: "賢人" }, { name: "全知者" }],
  cardinal:    [{ name: "司祭" }, { name: "枢機卿" }, { name: "大枢機卿" }, { name: "教皇代理" }, { name: "教皇" }],
  archmage:    [{ name: "深淵の徒" }, { name: "大魔導" }, { name: "魔導皇" }, { name: "深淵公" }, { name: "深淵王" }],
  chaplain:    [{ name: "衛教兵" }, { name: "護教官" }, { name: "護教騎士" }, { name: "護教総監" }, { name: "教皇の盾" }],
  sera:        [{ name: "灯の人業" }, { name: "灯守" }, { name: "灯の盾" }, { name: "守り灯" }, { name: "永灯の守り手" }],
};

// ===== 職業・ランクの基礎特性 =====
// 主魂だけに適用。各特性はR1で5、R5で25。レベル・レア度・集魂倍率は掛けない。
// 会心は割合、抵抗値は0〜100。サブ魂・結社からは借りない。
export const JOB_BASE_TRAITS = {
  fighter: ["crit", "flinch"],
  knight: ["physResist", "flinch"],
  priest: ["death", "seal"],
  mage: ["magResist", "seal"],
  thief: ["crit", "poison"],
  bishop: ["magResist", "death"],
  samurai: ["crit", "confuse"],
  berserker: ["crit", "flinch"],
  hunter: ["crit", "poison"],
  shadow: ["crit", "sleep"],
  paladin: ["physResist", "death"],
  guardian: ["physResist", "flinch"],
  spellblade: ["crit", "magResist"],
  monk: ["paralyze", "confuse"],
  hexer: ["poison", "seal"],
  hermit: ["sleep", "charm"],
  brigand: ["crit", "confuse"],
  arcthief: ["crit", "magResist"],
  crusader: ["crit", "death"],
  battlemage: ["physResist", "magResist"],
  darkknight: ["magResist", "death"],
  templar: ["physResist", "seal"],
  exorcist: ["crit", "death"],
  warden: ["magResist", "seal"],
  arcanist: ["magResist", "seal"],
  inquisitor: ["charm", "confuse"],
  archbishop: ["death", "seal"],
  ascetic: ["paralyze", "stone"],
  hero: ["crit", "confuse"],
  asura: ["crit", "flinch"],
  dragonknight: ["physResist", "paralyze"],
  necromancer: ["poison", "death"],
  sage: ["magResist", "confuse"],
  cardinal: ["charm", "death"],
  archmage: ["magResist", "seal"],
  chaplain: ["physResist", "death"],
  sera: ["physResist", "charm"],
};
export function jobBaseTraitsOf(clsKey, rank = 1) {
  const resists = zeroResists();
  let crit = 0;
  const value = Math.max(1, Math.min(5, rank || 1)) * 5;
  for (const k of JOB_BASE_TRAITS[clsKey] || []) {
    if (k === "crit") crit = value / 100;
    else resists[k] = value;
  }
  return { crit, resists };
}

// ===== 魂ランク (1〜5) の係数・表示 =====
// cap: そのランクで到達できる魂レベル上限の基準値 (コモン)。実際の上限はレア度でも変わる
//      (RARITY_LEVEL_CAPS / capForRarityRank を参照) / order: 0始まり (UI判定用) / color: 表示色
export const SOUL_RANKS = {
  1: { label: "",         cap: 20,  order: 0, color: null,      mul: 1.0 },
  2: { label: "ランク2の", cap: 40,  order: 1, color: "#7fd0ff", mul: 1.3 },
  3: { label: "ランク3の", cap: 60,  order: 2, color: "#c08aff", mul: 1.9 },
  4: { label: "ランク4の", cap: 80,  order: 3, color: "#ff9a4a", mul: 3.0 },
  5: { label: "ランク5の", cap: 100, order: 4, color: "#ffcf4a", mul: 5.0 },
};

// レア度 × ランク (1〜5) の魂レベル上限。レア度が高い魂ほど上限が高い。
export const RARITY_LEVEL_CAPS = {
  common: [20, 40, 60, 80, 100],
  rare:   [30, 50, 70, 90, 110],
  epic:   [50, 70, 90, 110, 130],
  legend: [70, 90, 110, 130, 150],
  unique: [60, 80, 100, 120, 140], // 固有 (セラ): 第四章の半ばで目覚めるので、ランク1から隊に追いつける上限
};
// レア度とランクから魂レベル上限を引く (ランクは1〜5にクランプ)
export function capForRarityRank(rarity, rank) {
  const caps = RARITY_LEVEL_CAPS[rarity] || RARITY_LEVEL_CAPS.common;
  return caps[Math.max(1, Math.min(5, rank || 1)) - 1];
}

// ===== 集魂ランクアップ (1部位制) =====
// 人業は職業ごとに「吸収した魂の数 (count)」と「魂レベル (level/exp)」を個別に育てる。
// 同じ職業の魂を集めるとステータスと魂レベルの上限 (soulLevelCap) が伸び、一定数でランクアップして
// ランクのパッシブ・基礎特性が強まる。技は魂レベルだけで覚える (ランクでは解放しない)。
// RANKUP_NEED[rarity] = [r1→2, r2→3, r3→4, r4→5] に必要な追加の魂数
export const RANKUP_NEED = {
  common: [10, 30, 50, 100],
  rare:   [5, 15, 25, 50],
  epic:   [2, 5, 10, 20],
  legend: [1, 2, 3, 5],
  unique: [1, 1, 1, 1], // 固有 (セラ): 物語の節目ごとに1つ (count = ランク)
};
// 同じ魂1個ごとの全ステータス上昇 (基礎値に対する%)。1個目は基礎値そのもの
export const SOUL_STAT_UP = { common: 0.01, rare: 0.04, epic: 0.10, legend: 1.00, unique: 0.20 };

// 累計しきい値: [rank1, rank2, …, rank5] に到達する累計所持数 (1個目で rank1)
export function rankThresholds(rarity) {
  const need = RANKUP_NEED[rarity] || RANKUP_NEED.common;
  const t = [1];
  for (const n of need) t.push(t[t.length - 1] + n);
  return t;
}
// 所持数 → ランク (0 = 未所持)
export function soulRankFromCount(clsKey, count) {
  if (!count || count < 1) return 0;
  const cls = SOUL_CLASSES[clsKey];
  const t = rankThresholds(cls ? cls.rarity : "common");
  let r = 1;
  for (let i = 1; i < t.length; i++) if (count >= t[i]) r = i + 1;
  return Math.min(5, r);
}
// 次のランクまでの進捗 { next: 必要累計, prev: 現ランクの累計しきい値 } (rank5なら null)
export function nextRankThreshold(clsKey, count) {
  const cls = SOUL_CLASSES[clsKey];
  const t = rankThresholds(cls ? cls.rarity : "common");
  const r = soulRankFromCount(clsKey, count);
  if (r >= 5) return null;
  return { next: t[r], prev: r > 0 ? t[r - 1] : 0 };
}

// ランク係数 (内部参照用)
const SOUL_RANK_MUL = { 1: 1.0, 2: 1.3, 3: 1.9, 4: 3.0, 5: 5.0 };

// レア度係数
const RARITY_MUL = { common: 1.0, rare: 1.15, epic: 1.3, legend: 1.5, unique: 1.8 };

// 融合強化 (ランク5魂を2体融合するたびに加算): レア度ごとのLv100ステ比率
export const FUSION_STAT_BONUS = { common: 0.02, rare: 0.05, epic: 0.10, legend: 0.20 };

// ランクボーナス (5部位すべて同系列職業のときの全ステ倍率)
export const FIVE_PART_BONUS = { common: 0.10, rare: 0.15, epic: 0.20, legend: 0.25 };

// ===== ドロップ =====
// ダンジョンではランク1〜3のみ。ランク2は約半減、ランク3はさらに半減
export function rollSoulRank(bonus = 0) {
  const m = 1 + Math.max(0, bonus);
  const p3 = Math.min(0.12, 0.04 * m);
  const p2 = Math.min(0.45, 0.22 * m);
  const r = Math.random();
  if (r < p3) return 3;
  if (r < p3 + p2) return 2;
  return 1;
}

// 職業ドロップ: レア度重み (common ~90.9% / rare 8% / epic 1% / legend 0.1%)
const _rarityPools = {};
function rarityPool(r) {
  if (!_rarityPools[r]) _rarityPools[r] = SOUL_KEYS.filter((k) => SOUL_CLASSES[k].rarity === r);
  return _rarityPools[r];
}
export function rollJobClass() {
  // 風化した死体・まだあたたかい死体: コモン70% / レア20% / エピック9% / レジェンド1%
  const r = Math.random();
  let pool;
  if (r < 0.01)        pool = rarityPool("legend");
  else if (r < 0.10)   pool = rarityPool("epic");
  else if (r < 0.30)   pool = rarityPool("rare");
  else                  pool = rarityPool("common");
  return pool[Math.floor(Math.random() * pool.length)];
}
// 偉大なる死体: レア30% / エピック50% / レジェンド20% (コモンは出ない)
export function rollGreatJobClass() {
  const r = Math.random();
  const pool = r < 0.20 ? rarityPool("legend") : r < 0.70 ? rarityPool("epic") : rarityPool("rare");
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== パッシブ カタログ =====
export const PASSIVES = {
  afterHeal:     { label: "戦闘後回復",   scope: "self",  lv: ["戦闘勝利後、HP5%回復", "戦闘勝利後、HP10%回復", "戦闘勝利後、HP20%回復", "戦闘勝利後、HP30%回復"] },
  afterMp:       { label: "魔力回路",     scope: "self",  lv: ["戦闘勝利後、MP3%回復", "戦闘勝利後、MP5%回復"] },
  afterBoth:     { label: "法力の灯",     scope: "party", lv: ["戦闘勝利後、パーティ全体の状態異常をすべて治す"] },
  purify:        { label: "浄化",         scope: "party", lv: ["戦闘勝利後、パーティ全体の毒・麻痺を治す"] },
  selfPurify:    { label: "自浄",         scope: "self",  lv: ["戦闘勝利後、自分の毒・麻痺を治す"] },
  mercy:         { label: "慈悲の祈り",   scope: "party", lv: ["戦闘勝利後、倒れた味方1人をHP10%で蘇生 (1探索1回)"] },
  popePrayer:    { label: "教皇の祈り",   scope: "party", lv: ["自分の戦闘後回復をパーティ全体に適用する"] },
  soulEater:     { label: "魂喰い",       scope: "self",  lv: ["敵を倒した時、MP5%回復"] },
  vigilance:     { label: "周囲警戒",     scope: "party", lv: ["奇襲される確率が半減", "奇襲を受けなくなる", "奇襲を受けず、自分から挑むと先制率+10%"] },
  senseEnemy:    { label: "敵感知",       scope: "party", lv: ["まだめくっていない魔物のカードを1枚、ぼんやり示す", "まだめくっていない魔物のカードを2枚、ぼんやり示す", "まだめくっていない魔物のカードを3枚、ぼんやり示す"] },
  senseTreasure: { label: "財宝感知",     scope: "party", lv: ["まだめくっていない宝箱のカードを1枚、ぼんやり示す", "まだめくっていない宝箱のカードを2枚、ぼんやり示す", "まだめくっていない宝箱のカードを3枚、ぼんやり示す"] },
  initiative:    { label: "先制の心得",   scope: "party", lv: ["先制攻撃の発生率+15%", "先制攻撃の発生率+25%", "先制攻撃の発生率+40%"] },
  poisonFloor:   { label: "毒床耐性",     scope: "party", lv: ["毒の床から受けるダメージ半減", "毒の床のダメージを無効化", "毒の床を無効化し、渡るたびHP2%回復"] },
  fleetFoot:     { label: "逃げ足",       scope: "party", lv: ["逃走の成功率+30%", "逃走の成功率+45%", "逃走の成功率+60%"] },
  goldLuck:      { label: "金運",         scope: "party", lv: ["戦闘で得るゴールド+15%", "戦闘で得るゴールド+30%", "戦闘で得るゴールド+50%"] },
  soulLure:      { label: "魂寄せ",       scope: "party", lv: ["戦闘で得るSoul+10%", "戦闘で得るSoul+20%", "戦闘で得るSoul+35%"] },
  appraise:      { label: "掘り出しの勘", scope: "party", lv: ["敵の戦利品ドロップ率+15%", "敵の戦利品ドロップ率+25%", "敵の戦利品ドロップ率+40%"] },
  cartography:   { label: "踏破の地図",   scope: "party", lv: ["階の開始時、周囲2マスを明らかにする", "階の開始時、周囲3マスを明らかにする", "階の開始時、周囲4マスを明らかにする"] },
  fieldRegen:    { label: "束の間の休息", scope: "party", lv: ["階を移動すると、全員のHPを10%回復", "階を移動すると、全員のHPを20%回復", "階を移動すると、全員のHPを30%回復"] },
  soulTutor:     { label: "魂の薫陶",     scope: "self",  lv: ["自分の宿す魂が得るEXP+10%", "自分の宿す魂が得るEXP+20%", "自分の宿す魂が得るEXP+30%"] },
  trapEye:       { label: "盗賊の眼",     scope: "party", lv: ["宝箱・床の罠の解除率+10% (最大95%)", "宝箱・床の罠の解除率+20% (最大95%)", "宝箱・床の罠の解除率+30% (最大95%)"] },
  // ===== 職ごとのランクのパッシブ (ランク2で目覚め、3・4・5で Lv2・3・4 に強まる。jobkit の awaken) =====
  priestInochi:   { label: "生命の灯", scope: "self", lv: ["蘇生した味方のHPが、さらに最大HPの10%増える", "蘇生した味方のHPが、さらに最大HPの20%増える", "蘇生した味方のHPが、さらに最大HPの30%増える", "蘇生した味方のHPが、さらに最大HPの50%増える"] },
  thiefNukeme:    { label: "抜け目なさ", scope: "party", lv: ["宝箱のランクが一段上がる確率10%", "宝箱のランクが一段上がる確率15%", "宝箱のランクが一段上がる確率20%", "宝箱のランクが一段上がる確率30%"] },
  bishopSeibetsu: { label: "魂の聖別", scope: "party", lv: ["戦闘で得る✦Soul+5%", "戦闘で得る✦Soul+10%", "戦闘で得る✦Soul+15%", "戦闘で得る✦Soul+25%"] },
  samuraiZantetsu: { label: "斬鉄", scope: "self", lv: ["物理攻撃が敵の防御を10%無視", "物理攻撃が敵の防御を20%無視", "物理攻撃が敵の防御を30%無視", "物理攻撃が敵の防御を50%無視"] },
  berserkerKyouhon: { label: "狂奔", scope: "self", lv: ["敵か仲間が倒れるたびSTR+5% (3段まで・その戦闘中)", "敵か仲間が倒れるたびSTR+5% (5段まで)", "敵か仲間が倒れるたびSTR+5% (7段まで)", "敵か仲間が倒れるたびSTR+5% (10段まで)"] },
  hunterSaihai:   { label: "狩りの采配", scope: "party", lv: ["戦闘開始時、敵全体の素早さ×0.9 (3ターン)", "戦闘開始時、敵全体の素早さ×0.8 (3ターン)", "戦闘開始時、敵全体の素早さ×0.7 (3ターン)", "戦闘開始時、敵全体の素早さ×0.6 (3ターン)"] },
  shadowHissatsu: { label: "必殺", scope: "self", lv: ["物理が当たると2%で即死 (主・金属の魔物には効かない)", "物理が当たると3%で即死", "物理が当たると4%で即死", "物理が当たると6%で即死"] },
  paladinIyashi:  { label: "癒しの剣", scope: "self", lv: ["物理で与えたダメージの3%だけ味方全員を回復", "物理で与えたダメージの5%だけ味方全員を回復", "物理で与えたダメージの8%だけ味方全員を回復", "物理で与えたダメージの12%だけ味方全員を回復"] },
  guardianKongou: { label: "金剛の守り", scope: "self", lv: ["敵の物理を5%で完全に受け止める (無傷)", "敵の物理を8%で完全に受け止める", "敵の物理を12%で完全に受け止める", "敵の物理を20%で完全に受け止める"] },
  spellbladeMajin: { label: "魔刃一体", scope: "self", lv: ["物理技に INT の10%を上乗せ", "物理技に INT の20%を上乗せ", "物理技に INT の30%を上乗せ", "物理技に INT の50%を上乗せ"] },
  hexerSae:       { label: "呪いの冴え", scope: "self", lv: ["状態異常の成功率+5%", "状態異常の成功率+10%", "状態異常の成功率+15%", "状態異常の成功率+25%"] },
  hermitSenyaku:  { label: "仙薬", scope: "party", lv: ["道具のHP・MP回復量+20%", "道具のHP・MP回復量+30%", "道具のHP・MP回復量+40%", "道具のHP・MP回復量+60%"] },
  brigandGi:      { label: "義の報い", scope: "party", lv: ["味方のHPが50%以下になった時、1戦闘1回、その味方を最大HPの20%回復", "味方のHPが50%以下になった時、1戦闘1回、その味方を最大HPの40%回復", "味方のHPが50%以下になった時、1戦闘1回、その味方を最大HPの60%回復", "味方のHPが50%以下になった時、1戦闘1回、その味方を最大HPの80%回復"] },
  arcthiefKaeshi: { label: "呪文返し", scope: "self", lv: ["敵の呪文を受けた時、10%で跳ね返す", "敵の呪文を受けた時、15%で跳ね返す", "敵の呪文を受けた時、20%で跳ね返す", "敵の呪文を受けた時、30%で跳ね返す"] },
  crusaderTsuigeki: { label: "聖光の追撃", scope: "self", lv: ["物理が当たると10%で光の追撃 (STR×0.5)", "物理が当たると15%で光の追撃 (STR×0.5)", "物理が当たると20%で光の追撃 (STR×0.5)", "物理が当たると30%で光の追撃 (STR×0.5)"] },
  bmHouken:       { label: "崩拳", scope: "self", lv: ["通常攻撃が10%で敵を怯ませる (主には効かない)", "通常攻撃が15%で敵を怯ませる", "通常攻撃が20%で敵を怯ませる", "通常攻撃が30%で敵を怯ませる"] },
  dkKeiyaku:      { label: "暗黒の契約", scope: "self", lv: ["HPを払う技の代償-20%", "HPを払う技の代償-35%", "HPを払う技の代償-50%", "HPを払う技の代償がなくなる"] },
  templarIkou:    { label: "封魔の威光", scope: "party", lv: ["敵が特技を使う確率-10%", "敵が特技を使う確率-15%", "敵が特技を使う確率-20%", "敵が特技を使う確率-30%"] },
  exorcistJouka:  { label: "浄化の光", scope: "party", lv: ["毎ラウンドの終わりに20%で、味方1人の状態異常と弱体を治す", "毎ラウンドの終わりに40%で、味方1人の状態異常と弱体を治す", "毎ラウンドの終わりに60%で、味方1人の状態異常と弱体を治す", "毎ラウンドの終わりに80%で、味方1人の状態異常と弱体を治す"] },
  wardenKekkai:   { label: "護法の結界", scope: "party", lv: ["隊全員が受ける呪文・ブレスのダメージ-5%", "隊全員が受ける呪文・ブレスのダメージ-8%", "隊全員が受ける呪文・ブレスのダメージ-12%", "隊全員が受ける呪文・ブレスのダメージ-20%"] },
  arcanistShinen: { label: "深淵の知", scope: "self", lv: ["攻撃呪文の会心率+5%", "攻撃呪文の会心率+8%", "攻撃呪文の会心率+12%", "攻撃呪文の会心率+20%"] },
  heroDensetsu:   { label: "伝説の勇者", scope: "party", lv: ["勇者が生きている間、味方全員のSTR・VIT・AGI・INT・PIE+3%", "勇者が生きている間、味方全員のSTR・VIT・AGI・INT・PIE+5%", "勇者が生きている間、味方全員のSTR・VIT・AGI・INT・PIE+8%", "勇者が生きている間、味方全員のSTR・VIT・AGI・INT・PIE+15%"] },
  asuraMugen:     { label: "無限の闘争", scope: "self", lv: ["自分の手番の後、10%でもう一度行動 (1ラウンド1回)", "自分の手番の後、15%でもう一度行動", "自分の手番の後、20%でもう一度行動", "自分の手番の後、30%でもう一度行動"] },
  dragonknightIbuki: { label: "竜の息吹", scope: "self", lv: ["毎ラウンドの初めに15%で、敵全体へ火のブレス (STR×0.5)", "毎ラウンドの初めに20%で、敵全体へ火のブレス (STR×0.6)", "毎ラウンドの初めに25%で、敵全体へ火のブレス (STR×0.8)", "毎ラウンドの初めに40%で、敵全体へ火のブレス (STR×1.2)"] },
  necroSenkoku:   { label: "死の宣告", scope: "party", lv: ["戦闘開始時、主以外の敵それぞれが3%で即死 (金属の魔物には効かない)", "戦闘開始時、主以外の敵それぞれが5%で即死 (金属の魔物には効かない)", "戦闘開始時、主以外の敵それぞれが8%で即死 (金属の魔物には効かない)", "戦闘開始時、主以外の敵それぞれが15%で即死 (金属の魔物には効かない)"] },
  sageKiwami:     { label: "叡智の極み", scope: "self", lv: ["呪文 (技以外) が10%でMPを使わずに唱えられる", "呪文が15%でMPを使わずに唱えられる", "呪文が20%でMPを使わずに唱えられる", "呪文が30%でMPを使わずに唱えられる"] },
  cardinalKiseki: { label: "聖座の奇跡", scope: "party", lv: ["戦闘中1回、最後の1人が倒れる時、全員をHP10%で蘇らせる", "戦闘中1回、最後の1人が倒れる時、全員をHP20%で蘇らせる", "戦闘中1回、最後の1人が倒れる時、全員をHP30%で蘇らせる", "戦闘中1回、最後の1人が倒れる時、全員をHP50%で蘇らせる"] },
  archmageShinen: { label: "魔導の深淵", scope: "self", lv: ["攻撃呪文が敵の魔法抵抗による軽減を25%無視 (魔法無効には効かない)", "攻撃呪文が敵の魔法抵抗による軽減を50%無視", "攻撃呪文が敵の魔法抵抗による軽減を75%無視", "攻撃呪文が敵の魔法抵抗による軽減を100%無視 (魔法無効には効かない)"] },
  // ===== 職ごとの Lv15 の目玉パッシブ (Lv50 で Lv2、Lv100 で Lv3)。効果は game.js / combat.js が読む =====
  // scope party は隊で一番高いLvの1人分だけが効く (重複不可)。self は持ち主だけ
  appraiseEye:   { label: "目利き",       scope: "party", lv: ["鑑定の成功率が上がる (適正Lvのコモン 70%→74%)", "鑑定の成功率がさらに上がる (適正Lvのコモン 70%→78%)", "鑑定の成功率が大きく上がる (適正Lvのコモン 70%→80% (上限)、SR 10%→17%)"] },
  firstGuard:    { label: "加護の祈り",   scope: "self",  lv: ["戦闘中、最初に受ける物理ダメージを1回だけ無効にする", "戦闘中、最初に受ける物理ダメージを2回まで無効にする", "戦闘中、最初に受ける物理ダメージを3回まで無効にする"] },
  toughBody:     { label: "歴戦の体",     scope: "self",  lv: ["最大HP+10%", "最大HP+20%", "最大HP+30%"] },
  nightWatch:    { label: "夜営の番",     scope: "party", lv: ["奇襲される確率-50%", "奇襲される確率-75%", "奇襲を受けなくなる"] },
  manaFlow:      { label: "魔力の循環",   scope: "party", lv: ["階を移動すると、全員のMPを5%回復", "階を移動すると、全員のMPを10%回復", "階を移動すると、全員のMPを15%回復"] },
  stealthStep:   { label: "忍び足",       scope: "party", lv: ["先制攻撃の発生率+10%", "先制攻撃の発生率+15%", "先制攻撃の発生率+20%"] },
  cleanseStep:   { label: "清めの歩み",   scope: "party", lv: ["まだめくっていないカードをめくるたび、全員のHPを2回復", "まだめくっていないカードをめくるたび、全員のHPを4回復", "まだめくっていないカードをめくるたび、全員のHPを6回復"] },
  hexerGosun:    { label: "五寸釘",       scope: "party", lv: ["戦闘の始め、敵1体を動けなくする (その敵の最初の手番を奪う。金属の魔物には効かない)", "戦闘の始め、敵2体を動けなくする (最初の手番を奪う)", "戦闘の始め、敵3体を動けなくする (最初の手番を奪う)"] },
  hermitZokusei: { label: "俗世拒絶",     scope: "self",  lv: ["敵から状態異常 (毒・麻痺・石化・即死・眠り・魅了・混乱) を受ける確率-10%", "敵から状態異常を受ける確率-20%", "敵から状態異常を受ける確率-30%"] },
  crusaderToki:  { label: "聖戦の鬨",     scope: "party", lv: ["戦闘の開始時、味方全員のSTR×1.2 (3ターン)", "戦闘の開始時、味方全員のSTR×1.5 (3ターン)", "戦闘の開始時、味方全員のSTR×1.8 (3ターン)"] },
  bmManaCycle:   { label: "魔力循環",     scope: "self",  lv: ["通常攻撃で与えたダメージの5%だけMPを回復 (1回で最大MPの2%まで)", "通常攻撃で与えたダメージの10%だけMPを回復 (1回で最大MPの3%まで)", "通常攻撃で与えたダメージの15%だけMPを回復 (1回で最大MPの4%まで)"] },
  dkEnchant:     { label: "魔力付与",     scope: "self",  lv: ["通常攻撃に INT×0.8 の固定ダメージを上乗せ (金属の魔物には効かない)", "通常攻撃に INT×1.2 の固定ダメージを上乗せ (金属の魔物には効かない)", "通常攻撃に INT×1.6 の固定ダメージを上乗せ (金属の魔物には効かない)"] },
  spellGuard:    { label: "封の結界",     scope: "self",  lv: ["戦闘中、最初に受ける魔法 (呪文・ブレス) のダメージを1回だけ無効にする", "戦闘中、最初に受ける魔法 (呪文・ブレス) のダメージを2回まで無効にする", "戦闘中、最初に受ける魔法 (呪文・ブレス) のダメージを3回まで無効にする"] },
  inqBrand:      { label: "罪の刻印",     scope: "party", lv: ["戦闘の開始時、敵全体に弱点の属性を1つ刻む (3ターン)", "戦闘の開始時、敵全体に弱点の属性を2つ刻む (3ターン)", "戦闘の開始時、敵全体に弱点の属性を3つ刻む (3ターン)"] },
  riseAgain:     { label: "復活の祈り",   scope: "party", lv: ["戦闘で倒れた味方が、1回だけHP1で起き上がる (1戦闘)", "戦闘で倒れた味方が、2回までHP1で起き上がる (1戦闘)", "戦闘で倒れた味方が、3回までHP1で起き上がる (1戦闘)"] },
  asceticShintou:{ label: "心頭滅却",     scope: "self",  lv: ["属性を帯びた攻撃・ブレス・呪文のダメージ-10%", "属性を帯びた攻撃・ブレス・呪文のダメージ-15%", "属性を帯びた攻撃・ブレス・呪文のダメージ-20%"] },
  heroIji:       { label: "勇者の意地",   scope: "self",  lv: ["戦闘中1回、致死ダメージをHP1で耐える (HP1の時は効かない)", "戦闘中2回まで、致死ダメージをHP1で耐える (HP1の時は効かない)", "戦闘中3回まで、致死ダメージをHP1で耐える (HP1の時は効かない)"] },
  asuraChishio:  { label: "たぎる血潮",   scope: "self",  lv: ["同じ敵に続けて攻撃した手ごとに1段、物理ダメージ+10% (最大+200%・多段の技も1手で1段)。別の敵に当たると0段に戻る", "同じ敵に続けて攻撃した手ごとに1段、物理ダメージ+15% (最大+200%・多段の技も1手で1段)。別の敵に当たると0段に戻る", "同じ敵に続けて攻撃した手ごとに1段、物理ダメージ+20% (最大+200%・多段の技も1手で1段)。別の敵に当たると0段に戻る"] },
  necroLegion:   { label: "死者の軍勢",   scope: "self",  lv: ["自分の手番の終わりに、ランダムな敵へ INT×0.5 の固定ダメージを1回 (金属の魔物には効かない)", "自分の手番の終わりに、ランダムな敵へ INT×0.5 の固定ダメージを2回 (金属の魔物には効かない)", "自分の手番の終わりに、ランダムな敵へ INT×0.5 の固定ダメージを3回 (金属の魔物には効かない)"] },
  archmageChoei: { label: "重詠",         scope: "self",  lv: ["攻撃呪文が20%でもう一度放たれる (2回目はMPを使わない)", "攻撃呪文が40%でもう一度放たれる (2回目はMPを使わない)", "攻撃呪文が60%でもう一度放たれる (2回目はMPを使わない)"] },
  extraHit:      { label: "連撃",         scope: "self",  lv: ["通常攻撃が10%で2撃目を放つ (威力60%)", "通常攻撃が20%で2撃目を放つ (威力60%)", "通常攻撃が30%で2撃目を放つ (威力60%)", "通常攻撃が40%で2撃目を放つ (威力60%)"] },
  fightSpirit:   { label: "闘魂",         scope: "self",  lv: ["HP30%以下の時、STR+25%", "HP30%以下の時、STR+40%・会心+15%", "HP30%以下の時、STR+55%・会心+20%", "HP30%以下の時、STR+70%・会心+25%"] },
  spellBlade:    { label: "魔力撃",       scope: "self",  lv: ["通常攻撃にINTの50%を上乗せ", "通常攻撃にINTの100%を上乗せ"] },
  venomBlade:    { label: "仕込み毒",     scope: "self",  lv: ["通常攻撃が15%で敵を毒にする", "通常攻撃が30%で敵を毒にする"] },
  flinch:        { label: "怯ませ",       scope: "self",  lv: ["通常攻撃が10%で敵を怯ませる (主には効かない)"] },
  smite:         { label: "破邪",         scope: "self",  lv: ["不死・幽鬼・悪魔へのダメージ+30%"] },
  holyEdge:      { label: "聖刃",         scope: "self",  lv: ["不死・幽鬼・悪魔への会心率+15%"] },
  vitalEye:      { label: "急所読み",     scope: "self",  lv: ["会心ダメージ+25%", "会心ダメージ+45%"] },
  gokudoku:      { label: "毒責め",         scope: "self",  lv: ["毒状態の敵への与ダメージ+30%"] },
  sleepKill:     { label: "寝込み襲い",   scope: "self",  lv: ["眠り・麻痺・魅了・混乱中の敵への攻撃が必ず会心"] },
  ambushCrit:    { label: "不意打ち",     scope: "self",  lv: ["先制時、最初の通常攻撃が必ず会心"] },
  kenma:         { label: "剣魔合一",     scope: "self",  lv: ["呪文を唱えた次の通常攻撃が必ず会心"] },
  zanshin:       { label: "残心",         scope: "self",  lv: ["敵を倒した時25%で追加攻撃 (1ラウンド1回)"] },
  twinArts:      { label: "二刀の理",     scope: "self",  lv: ["通常攻撃の後30%でINT×0.6の追撃呪文"] },
  iai:           { label: "居合",         scope: "self",  lv: ["戦闘開始時、敵1体へ自動で抜き打ち (奇襲時は不発)"] },
  openSpell:     { label: "開幕呪撃",     scope: "self",  lv: ["戦闘開始時、敵1体へ無消費の呪撃INT×1.2 (奇襲時は不発)"] },
  asceticism:    { label: "窮地の底力",   scope: "self",  lv: ["HP30%以下の間、与ダメージ・回復量+30%"] },
  taunt:         { label: "矢面の構え",   scope: "self",  lv: ["敵の単体攻撃が自分に向かいやすくなる"] },
  cover:         { label: "かばう",       scope: "party", lv: ["瀕死(HP25%以下)の味方への攻撃を肩代わり (1戦闘1回)", "肩代わりが1戦闘2回になり、その被ダメ-30%", "肩代わりが1戦闘3回になり、その被ダメ-40%"] },
  dynamicVision: { label: "動体視力",     scope: "self",  lv: ["物理攻撃が敵の回避 (素早さの差・回避の体質) を30%打ち消す (重ねがけ不可・一番高いLvだけ。金属の魔物には効かない)", "物理攻撃が敵の回避 (素早さの差・回避の体質) を50%打ち消す (重ねがけ不可・一番高いLvだけ。金属の魔物には効かない)", "物理攻撃が敵の回避 (素早さの差・回避の体質) を70%打ち消す (重ねがけ不可・一番高いLvだけ。金属の魔物には効かない)"] },
  parry:         { label: "見切り",       scope: "self",  lv: ["敵の物理攻撃を10%で完全回避", "敵の物理攻撃を15%で完全回避"] },
  counter:       { label: "反撃",         scope: "self",  lv: ["物理被弾時15%でSTR×0.5の反撃", "物理被弾時25%でSTR×0.7の反撃", "物理被弾時35%でSTR×1.0の反撃 (会心あり)"] },
  endure:        { label: "不屈",         scope: "self",  lv: ["致死ダメージをHP1で耐える (1戦闘1回)", "致死ダメージをHP1で耐える (1戦闘2回)"] },
  barrier:       { label: "魔障壁",       scope: "self",  lv: ["ブレス・呪文の被ダメージ半減 (1戦闘1回)", "ブレス・呪文の被ダメージ半減 (1戦闘2回)"] },
  reflect:       { label: "魔力反射",     scope: "self",  lv: ["魔障壁で防いだ分のダメージを相手に返す"] },
  bigBarrier:    { label: "大結界",       scope: "party", lv: ["敵の全体攻撃をパーティ全体で半減 (1戦闘1回・自動)", "敵の全体攻撃をパーティ全体で半減 (1戦闘2回・自動)"] },
  holyCover:     { label: "聖盾",         scope: "party", lv: ["かばうがブレス等の攻撃も肩代わりできる"] },
  bastion:       { label: "城壁の構え",   scope: "party", lv: ["自分が防御中、パーティ全体の被ダメージ-10%", "自分が防御中、パーティ全体の被ダメージ-18%"] },
  resistAilment: { label: "異常耐性",     scope: "self",  lv: ["毒・麻痺・眠り・魅了・混乱の付与率-30%", "毒・麻痺・眠り・魅了・混乱-60%、石化・即死-30%"] },
  sanctuary:     { label: "聖域",         scope: "party", lv: ["パーティ全体に異常耐性Lv1を付与"] },
  martyr:        { label: "殉教の祈り",   scope: "party", lv: ["自分が倒れた時、味方全体をPIE×1.0回復 (1戦闘1回)"] },
  divineCounter: { label: "神罰の鉄槌",   scope: "self",  lv: ["物理被弾時20%でPIE×0.8の聖なる反撃"] },
  scripture:     { label: "聖典の加護",   scope: "self",  lv: ["HP30%以下になった時、PIE×1.2を自動回復 (1戦闘1回)"] },
  chant:         { label: "省詠唱",       scope: "self",  lv: ["呪文・技の消費MP-15%", "呪文・技の消費MP-30%"] },
  spellCrit:     { label: "呪文会心",     scope: "self",  lv: ["攻撃呪文が10%で会心 (×1.5)", "攻撃呪文が18%で会心 (×1.5)", "攻撃呪文が26%で会心 (×1.5)"] },
  scan:          { label: "弱点看破",     scope: "party", lv: ["戦闘中、敵の属性が見える"] },
  elemFloor:     { label: "森羅の理",     scope: "self",  lv: ["自分の攻撃呪文に属性の不利が出なくなる"] },
  kantei:        { label: "鑑定",         scope: "self",  lv: ["街で未鑑定の装備を無料で鑑定できる (簡易。魂Lvが品に見合うほど、レア度が低いほど成功しやすい。控えにいても担える)", "街で未鑑定の装備を高い精度で鑑定できる (魂Lvが品に見合うほど、レア度が低いほど成功しやすい。控えにいても担える)"] },
};

// 職ごとの固有パッシブ (src/jobkit/<職>.js の perks) を合流する。効果 (fx) は combat.js が読む
for (const key in JOBKIT_PERKS) {
  if (PASSIVES[key]) throw new Error(`souls: 固有パッシブ ${key} が共通のパッシブと重複`);
  const pk = JOBKIT_PERKS[key];
  PASSIVES[key] = { label: pk.label, scope: pk.scope || "self", lv: pk.lv };
}
{
  const seen = {};
  for (const key in PASSIVES) {
    const nm = PASSIVES[key].label;
    if (seen[nm]) console.warn(`souls: パッシブの名前「${nm}」が ${seen[nm]} と ${key} で重複`);
    seen[nm] = key;
  }
}

export function passiveName(key, lv = 1) {
  const def = PASSIVES[key]; if (!def) return key;
  return def.lv.length > 1 ? `${def.label}Lv${lv}` : def.label;
}
export function passiveDesc(key, lv = 1) {
  const def = PASSIVES[key]; if (!def) return "";
  return def.lv[Math.min(lv, def.lv.length) - 1] || "";
}
// 表示名 (「戦闘後回復Lv1」など) から {key, lv} を引く。見つからなければ null
let PASSIVE_BY_NAME = null;
export function passiveByName(name) {
  if (!PASSIVE_BY_NAME) {
    PASSIVE_BY_NAME = {};
    for (const key in PASSIVES) for (let lv = 1; lv <= PASSIVES[key].lv.length; lv++) PASSIVE_BY_NAME[passiveName(key, lv)] = { key, lv };
  }
  return PASSIVE_BY_NAME[name] || null;
}
const P = (key, lv = 1) => ({ name: passiveName(key, lv), desc: passiveDesc(key, lv), grants: { [key]: lv } });
const U = (name, desc, grants) => ({ name, desc, grants });

// ===== 職業パッシブ表 [ランク2,3,4,5] =====
// ランクのパッシブ (jobkit の awaken): ランク2で目覚め、ランク3・4・5で Lv2・3・4 に強まる。
// Lv で覚えるパッシブ (レベルスキル表 JOB_SKILLS) とは別物で、重ならないように選んである
export const JOB_PASSIVES = {};
for (const k in JOBKIT_AWAKEN) {
  const key = JOBKIT_AWAKEN[k];
  if (!PASSIVES[key] || PASSIVES[key].lv.length !== 4) throw new Error(`souls: ${k} のランクのパッシブ ${key} が無いか、4段でない`);
  JOB_PASSIVES[k] = [P(key, 1), P(key, 2), P(key, 3), P(key, 4)]; // ランク2〜5 = Lv1〜4
}

export function jobPassiveTable(jobKey) { return JOB_PASSIVES[jobKey] || []; }
export function passivesUpTo(jobKey, rank) {
  const map = {};
  const tbl = JOB_PASSIVES[jobKey] || [];
  for (let r = 2; r <= rank; r++) {
    const e = tbl[r - 2]; if (!e) continue;
    for (const k in e.grants) map[k] = Math.max(map[k] || 0, e.grants[k]);
  }
  return map;
}
export function pLv(m, key) { return (m && m.passiveMap && m.passiveMap[key]) || 0; }

// ===== 職業スキル表 =====
// 習得レベル: 1,3,5,7,10 のあと5刻みで200まで (全43段)。
// その間の 2,4,8,12,17,22… の段にも、得意属性 (JOB_AFFINITY) の技を置いてある。
// 表の各エントリは「技」 {lvl, skill} か「パッシブ」 {lvl, passive, plv} のいずれか。
// 旧仕様の「ランク×10ゲート」は撤廃し、魂レベルが lvl 以上なら習得する。
export const SKILL_LEVELS = (() => {
  const a = [1, 3, 5, 7, 10];
  for (let lv = 15; lv <= 200; lv += 5) a.push(lv);
  return a;
})();
// 表は「Lv 技キー」または「Lv パッシブキー/パッシブLv」を空白区切りで並べた文字列 (T で展開)。
// 技の中身は skilldefs.js。職ごとの持ち味:
//  AGIの低い物理職 = 命中補正の技 (狙い打ち → 心眼撃 → 必中の大技) と防御無視 / 素早い職 = 連撃・会心・AGIで伸びる技・盗む・逃走 /
//  守り手 = 挑発・仁王立ち・反撃の構え / 呪い手 = 毒・封印・魅了・混乱・属性耐性ダウン・即死 / 祈り手 = 回復・リジェネ・弱体解除
const T = (src) => src.trim().split(/\s+/).reduce((out, tok, i, a) => {
  if (i % 2) return out;
  const lvl = +tok, key = a[i + 1];
  if (key.includes("/")) { const [passive, plv] = key.split("/"); out.push({ lvl, passive, plv: +plv }); }
  else out.push({ lvl, skill: key });
  return out;
}, []);
export const JOB_SKILLS = {};
for (const k in JOBKIT_TABLES) JOB_SKILLS[k] = T(JOBKIT_TABLES[k]);

// ===== 得意属性 =====
// 各職の得意属性 (主・副)。職業図鑑に「得意属性」として出す。属性技は上の表にこの属性のものを置いてある
// (6属性それぞれに物理・呪文の両方の使い手がいるよう配分)。
export const JOB_AFFINITY = {
  fighter: ["fire", "earth"], knight: ["earth", "light"], priest: ["light"], mage: ["fire", "water", "wind", "earth", "dark"],
  thief: ["wind", "dark"], bishop: ["water", "light"],
  samurai: ["water", "wind"], berserker: ["fire", "dark"], hunter: ["wind", "water"], shadow: ["dark", "wind"],
  paladin: ["light", "earth"], guardian: ["earth", "water"], spellblade: ["fire", "water", "wind", "earth", "light", "dark"],
  monk: ["earth", "wind"], hexer: ["dark", "water"], hermit: ["wind", "light"], brigand: ["water", "dark"], arcthief: ["dark", "wind"],
  crusader: ["light", "fire"], battlemage: ["fire", "earth"], darkknight: ["dark", "fire"], templar: ["light", "earth"],
  exorcist: ["water", "light"], warden: ["earth", "water"], arcanist: ["dark"], inquisitor: ["fire", "light"],
  archbishop: ["light", "water"], ascetic: ["earth", "fire"],
  hero: ["wind", "light"], asura: ["fire", "wind"], dragonknight: ["wind", "fire"], necromancer: ["dark"],
  sage: ["water", "wind"], cardinal: ["light"], archmage: ["dark", "earth"], chaplain: ["light", "water"],
  sera: ["light", "water"],
};
export function jobSkillTable(jobKey) { return JOB_SKILLS[jobKey] || []; }

// ===== 鑑定スキル (ウィザードリィ風) =====
// 鑑定は職業スキル「鑑定 (kantei)」として実装。スキルを覚えた人業は未鑑定の装備を
// 街で無料で鑑定できる (迷宮では不可。隊にいなくても控えから担える)。ただし成功率は決して 100% にならず (上限80%)、失敗するとその品は
// スキルでは二度と鑑定できなくなる (idHardFail フラグが立ち、確実だが有料の商店鑑定に頼る)。
// 「育てれば街で無料鑑定できるが、確実さは商店が握る」という住み分け。
//   司教 (bishop)・賢者 (sage) = 鑑定Lv2 (高精度) / 盗賊 (thief) = 鑑定Lv1 (簡易)
// 成功率 (ユーザーの指示、2026-10): 鑑定する者の魂Lv が品の「適正Lv」(world.js itemFitLv = その品が落とし物の帯の
// 真ん中に来る推奨Lv) と同じとき、レア度ごとの基準 IDENTIFY_BASE (コモン70% / アンコモン50% / レア30% / SR10% / LR3%)。
// レジェンドレアも技で鑑定できる (2026-10 ユーザーの指示: ただし SR よりさらに低い)。
// Lv の差はロジット (log(p/(1−p))) に足し、差の効きは tanh で頭打ちにする — Lv をいくら離しても
// ロジット ±IDENTIFY_SWING までしか動かない (コモン 41〜80% (上限) / アンコモン 23〜77% / レア 11〜59% / SR 3〜29% / LR 1〜9%)。
// 差は比で測る ((魂Lv+5) ÷ (適正Lv+5)): 低Lv の数Lv の差も高Lv の数十Lv の差も、同じ「どれだけ上か」で効く。
export const IDENTIFY_BASE = { c: 0.70, uc: 0.50, r: 0.30, sr: 0.10, lr: 0.03 };
export const IDENTIFY_SWING = 1.2;  // Lv の差で動くロジットの上限 (上にも下にも)
export const IDENTIFY_SPAN = 0.7;   // ln(比) がこの値 (≒ Lv が2倍) のとき上限の約76%まで効く
export const IDENTIFY_LV_PAD = 5;   // 比をとる前に両方へ足す (Lv1 と Lv2 で倍とみなさない)
// 鑑定スキルLv (1/2) ごとの表示名と、基準からのロジットのずれ (目利き = 一段落ちる)
export const IDENTIFY_TIERS = {
  1: { label: "目利き", shift: -0.5 }, // 簡易: 適正Lv でコモン 59% / アンコモン 38% / レア 21% / SR 6%
  2: { label: "鑑定",   shift: 0 },    // 高精度: 基準どおり
};
export const IDENTIFY_CAP = 0.80; // どれだけ育てても 20% は失敗する (ユーザーの指示、2026-10)
// メンバーが習得している鑑定スキルのレベル (0=未習得)
export function identifyTier(member) {
  return (member && member.passiveMap && member.passiveMap.kantei) || 0;
}
// このメンバーが鑑定スキルを使えるか
export function canIdentify(member) { return identifyTier(member) > 0; }
// 鑑定スキルの表示名 ("目利き" / "鑑定")
export function identifyLabel(member) {
  const t = IDENTIFY_TIERS[identifyTier(member)];
  return t ? t.label : "鑑定";
}
const logit = (p) => Math.log(p / (1 - p));
// このメンバー (魂Lv jobLv) が品 it (隠しレベル it.lv・レア度 it.rar) を鑑定できる確率 (0=不可)
export function identifyChance(member, it) {
  const j = IDENTIFY_TIERS[identifyTier(member)];
  if (!j) return 0;
  const jobLv = (member && (member.jobLv || member.level)) || 1;
  const fit = itemFitLv((it && it.lv) || 1);
  const ratio = Math.log((jobLv + IDENTIFY_LV_PAD) / (fit + IDENTIFY_LV_PAD));
  const base = IDENTIFY_BASE[it && it.rar] || (it && it.lr ? IDENTIFY_BASE.lr : IDENTIFY_BASE.c);
  const z = logit(base) + j.shift + IDENTIFY_SWING * Math.tanh(ratio / IDENTIFY_SPAN) + appraiseBonus();
  return Math.min(IDENTIFY_CAP, 1 / (1 + Math.exp(-z)));
}
// 目利き (appraiseEye): 鑑定の成功率をロジットで +0.2/0.4/0.6 (適正Lv のコモン 70→74/78/80% (上限)、SR 10→12/14/17%。
// 隊と控えで一番高いLvだけ)。game.js が setAppraiseSource で人業の一覧を渡す
let APPRAISE_SRC = () => [];
export function setAppraiseSource(fn) { APPRAISE_SRC = typeof fn === "function" ? fn : () => []; }
function appraiseBonus() {
  let lv = 0;
  for (const d of (APPRAISE_SRC() || [])) if (d && d.alive !== false) lv = Math.max(lv, pLv(d, "appraiseEye"));
  return [0, 0.2, 0.4, 0.6][Math.min(3, lv)] || 0;
}

// ===== 職業図鑑テキスト =====
export const JOB_LORE = {
  fighter:     { desc: "戦場の記憶を宿す魂。剣を握って生き、剣を握って死んだ者たちの執念が、人業の腕に力を与える。", tips: "高いSTRとHPで前衛の軸となる。ランクが上がるほど連撃と闘魂が冴え、危機的状況で真価を発揮する。" },
  knight:      { desc: "守りの誓いを抱いたまま朽ちた騎士の魂。盾の重みを、誇りの重みとして覚えている。", tips: "随一のHPとVITで仲間の盾となる。挑発でダメージを引き受け、極まれば致死の一撃すら耐え抜く。" },
  priest:      { desc: "祈りの果てに神の沈黙を知った聖職者の魂。それでも祈ることをやめなかった者だけが、癒しの力を残す。", tips: "PIEが回復量を決める。聖者に至れば全滅の淵から一度だけ皆を引き戻す。" },
  mage:        { desc: "禁書とともに焼かれた魔術師の魂。灰の中でなお、呪文の韻だけは忘れなかった。", tips: "INTが攻撃呪文の威力を決める。MPの管理が肝要。エクスプロージョンで戦場ごと消し飛ばす。" },
  thief:       { desc: "影に生き、影に消えた者の魂。錠前と急所、そして逃げ道の在り処を知り尽くしている。", tips: "AGIとLUKで先手と会心を取る遊撃手。毒刃や急所突きで厄介な敵を素早く仕留める。" },
  bishop:      { desc: "魔と聖、二つの道を同時に究めようとした異端者の魂。教会は彼らを破門し、迷宮は彼らを歓迎した。", tips: "攻撃呪文と回復呪文を兼ね、一人で二役をこなす汎用後衛。" },
  samurai:     { desc: "刃を抜かず相手を制する異国の剣術家の魂。燕返しの型に、先手と追い手のすべてが宿る。", tips: "AGIと先制を高め、居合で口火を切る。燕返しが二度の閃きで確実に敵を断ち切る。" },
  berserker:   { desc: "剣ではなく狂気で戦う狂戦士の魂。血を見るたびに力が増す危うい存在。", tips: "HPが削れるほど闘魂が燃え上がりSTRと会心が伸びる。反撃で被弾を火力に変える。" },
  hunter:      { desc: "野を駆けて獲物を追い詰めてきた狩人の魂。不意打ちと急所を熟知している。", tips: "先制時の会心と連撃で序盤に勝負をかける。AGIとLUKを高めるほど猟の精度が上がる。" },
  shadow:      { desc: "影に溶け、標的を確実に仕留める暗殺者の魂。一撃で仕留められなければ退く。", tips: "催眠と急所突きで相手を無力化してから刈り取る。高AGIで先手を確保するのが基本。" },
  paladin:     { desc: "仲間を守ることを誓いに生きた聖騎士の魂。盾と祈りを同時に持つ。", tips: "かばうと回復を一人で賄える稀有な前衛。殉教の祈りが最後の砦になる。" },
  guardian:    { desc: "難攻不落の城壁のごとき守護騎士の魂。攻めの手は持たず、守ることに特化する。", tips: "城壁の構えでパーティ全体の被ダメを減らし、反撃でわずかに返す。とにかく耐える前衛。" },
  spellblade:  { desc: "刃と呪文を同時に使いこなす魔法剣士の魂。どちらも半端ではない。", tips: "STRとINTを両方育てて魔力撃の効果を最大化する。剣魔合一で会心をコントロール。" },
  monk:        { desc: "拳と祈りで戦い、己の道を極めた武僧の魂。打ち合うほど祈りが深まる。", tips: "回復もこなせる前衛。金剛連打で手数を稼ぎ、破邪で対魔戦に強い。" },
  hexer:       { desc: "毒と呪いを武器にする呪術師の魂。倒さず、蝕み、弱らせることを是とする。", tips: "毒霧で全体を蝕み、毒責めで毒の敵への火力を伸ばす。硬い敵ほど毒が活きる。" },
  hermit:      { desc: "俗世を離れ、山奥で自らを鍛えた隠修士の魂。いざとなれば癒しも逃げ足も速い。", tips: "回復と隠行の両方を持つ低リスクの後衛。毒床耐性で危険地帯の踏破向き。" },
  brigand:     { desc: "盗むことで生計を立てながら、弱者に施していた義賊の魂。奪い続けることが強さ。", tips: "金運と追い剥ぎで稼ぎを2倍以上に。戦闘後の実入りを重視したい欲張りな選択。" },
  arcthief:    { desc: "呪文を盗むように操る魔盗賊の魂。先手の呪撃でパーティの負担を減らす。", tips: "開幕呪撃で無消費の先手を取り、魔力強奪でMPを補いながら戦う持久型の術士。" },
  crusader:    { desc: "聖なる使命のために剣を握った聖戦士の魂。魔を祓い、その輝きが仲間の命を繋ぐ。", tips: "破邪で不死・幽鬼・悪魔に特効。聖光斬が敵を傷つけながら自分を癒す。" },
  battlemage:  { desc: "拳と法力を組み合わせた変わり者の魂。金剛身が術師との戦いを有利にする。", tips: "魔障壁と異常耐性で術師相手に崩れにくい。破魔の拳で敵の能力を削ぐ。" },
  darkknight:  { desc: "魔術理論を鎧に編み込んだ魔騎士の魂。障壁を盾に魔力をも喰らう。", tips: "魔障壁と魔力反射で呪文・ブレスを受けて返す。魔喰いの太刀でMPが自給する。" },
  templar:     { desc: "神殿を守護する誓いの騎士の魂。聖域の鐘がパーティ全体の穢れを払う。", tips: "聖域でパーティ全体に異常耐性を配れる。毒や麻痺をばらまく魔物の巣窟での守りの柱。" },
  exorcist:    { desc: "聖印を帯びた影の祓魔師の魂。神速で動き、光刃で不浄を斬る。", tips: "聖刃の会心で不死・幽鬼を狩る遊撃手。浄化でパーティの状態異常も拭える。" },
  warden:      { desc: "守りの法陣を理論の極みまで磨き上げた護法師の魂。大結界がパーティを包む。", tips: "大結界が全体攻撃を半減する。深層ボスの全体技を毎回削れるのは大きい。" },
  arcanist:    { desc: "禁断の秘術を収集し続けた秘術師の魂。消費を抑えた呪撃が会心の閃きを宿す。", tips: "呪文会心と省詠唱を両立した攻撃特化型。燃費よく、連戦でも火力が落ちない。" },
  inquisitor:  { desc: "断罪の祈りで暴力に神罰をもって応える審問官の魂。前衛に置ける回復役。", tips: "神罰の鉄槌が物理被弾時の反撃になる。かばうと組み合わせれば強固な前衛兼回復役。" },
  archbishop:  { desc: "聖典を携えて泉から泉へと巡り、瀕死の味方を引き起こす加護を宿す巡礼者の魂。", tips: "聖句の加護で倒れた仲間を不屈付きで蘇生する。回復の専門家として深層での生存率を高める。" },
  ascetic:     { desc: "身を削ることで力を引き出す修験者の魂。捨身の行が窮地を打開する。", tips: "荒行の果てでHP30%以下の時に火力と回復量が上がる。捨身の行で自ら窮地に踏み込む型。" },
  hero:        { desc: "世界の試練に選ばれた者の魂。一人で全てを背負う覚悟が、仲間を生かし続ける。", tips: "パーティ全体の不屈と異常耐性で壁役を超えた守護者。聖剣奮迅で全体攻撃しながら仲間を癒す万能の柱。" },
  asura:       { desc: "戦いを止めることができなかった修羅の魂。攻撃こそが存在証明。", tips: "連撃と闘魂の二重強化で圧倒的な手数と火力を誇る。阿修羅斬で敵陣を蹂躙する。" },
  dragonknight:{ desc: "竜と盟約を結んだ竜騎士の魂。竜の力で守りを固め、一撃で山を砕く。", tips: "竜鱗の守りで魔・物理の両方に耐え、竜墜としで単体に甚大なダメージを叩き込む。" },
  necromancer: { desc: "死の理を学び、魂を食らうことで力に変える死霊術師の魂。", tips: "魂喰いで戦闘を重ねるほどMPが蓄積する。冥魂喰らいで吸収しながら戦う持久特化型。" },
  sage:        { desc: "魔と聖の両方の理を識り尽くした賢者の魂。属性の壁を超えた裁きを下す。", tips: "森羅万象で属性の不利が消える。どの迷宮でも呪文が安定し、攻守を一人で完結させる。" },
  cardinal:    { desc: "教団の頂から全ての命を見守る枢機卿の魂。その祈りは仲間全員に注がれる。", tips: "教皇の祈りで自分の戦闘後回復を全員に広げる。大聖祈祷で回復と浄化を同時に行う。" },
  archmage:    { desc: "深淵の知識に到達した大魔導の魂。その波動は破壊の理そのもの。", tips: "深淵の理で燃費と弱点看破を両立した呪文砲台。深淵の波動で単体を粉砕する。" },
  chaplain:    { desc: "教えを守るために武装した護教官の魂。法障壁が全ての攻撃を防ぐ。", tips: "聖盾でブレスや呪文まで肩代わりできる。法障壁でパーティ全体に魔障壁を配る究極の守護聖職者。" },
  sera:        { desc: "師オルドが一度で仕上げた人業、セラの魂。師を庇って裂かれ、ばらばらになっても、胸の灯は消えなかった。", tips: "庇い立てと灯の加護で隊の傷を浅くする守り手。胸の魂火が戦いの初めに隊を障壁で包む。セラだけの職で、ランクは物語の節目で上がる。" },
};

// 職業×ランクの説明文・活用法を返す (ランク別が無ければ系列共通の JOB_LORE にフォールバック)
export function jobLoreFor(jobKey, rank) {
  const r = Math.max(1, Math.min(5, rank || 1));
  const arr = JOB_LORE_RANKS[jobKey];
  if (arr && arr[r - 1]) return arr[r - 1];
  return JOB_LORE[jobKey] || {};
}

// ===== 魂ランクの発現条件テキスト (図鑑用) =====
export function jobRankCondText(jobKey, rank) {
  const cls = SOUL_CLASSES[jobKey];
  if (!cls) return "";
  const t = rankThresholds(cls.rarity);
  if (cls.unique) return rank <= 1 ? "人業セラが目を覚ます" : "物語の節目で、セラの魂が強まる";
  if (rank <= 1) return `${cls.label}の魂を1つ吸収する`;
  return `${cls.label}の魂を累計 ${t[rank - 1]}個 吸収する`;
}

// 後方互換: ハイブリッド関連 (廃止済みだが import で参照される箇所のため空で残す)
export const HYBRIDS = {};
export function findHybrid() { return null; }

// ===== 職業ギアマトリクス =====
// weapons: 使用可能な武器カテゴリキー (items.js の WEAPON_CATS と同値)
// armor: 装備可能な防具重量の上限 ("heavy"|"light"|"cloth")
// shields: 持てる盾のジャンル (items.js の SHIELD_KINDS: kite 大盾 / round 円盾 / buckler 小盾 / orb 宝珠 / tome 聖典)。
//   重装の盾職は大盾・円盾・小盾、軽装の職は小盾、攻めの術者は宝珠、癒し手・祈りの職は聖典。
//   侍・暗殺者・狂戦士・修羅は盾を持たない (両手武器で攻める職。左手の副え刃は今後)。修羅は刀も持てる
export const JOB_GEAR = {
  fighter:     { weapons: ["ls","ax","mc","sp","dg"],            armor: "heavy", shields: ["kite","round","buckler"] },
  knight:      { weapons: ["ls","mc","sp"],                      armor: "heavy", shields: ["kite","round","buckler"] },
  priest:      { weapons: ["mc","st"],                           armor: "light", shields: ["buckler","tome"] },
  mage:        { weapons: ["st","dg"],                           armor: "cloth", shields: ["orb"] },
  thief:       { weapons: ["dg","bw","ls","sp"],                 armor: "light", shields: ["buckler"] },
  bishop:      { weapons: ["st","mc"],                           armor: "cloth", shields: ["orb","tome"] },
  samurai:     { weapons: ["kt","ls"],                           armor: "light", shields: [] },
  berserker:   { weapons: ["ax","mc","ls","sp"],                 armor: "heavy", shields: [] },
  hunter:      { weapons: ["bw","dg","sp"],                      armor: "light", shields: ["buckler"] },
  shadow:      { weapons: ["dg","bw"],                           armor: "light", shields: [] },
  paladin:     { weapons: ["ls","mc","sp"],                      armor: "heavy", shields: ["kite","round","buckler","tome"] },
  guardian:    { weapons: ["mc","sp","ls"],                      armor: "heavy", shields: ["kite","round","buckler"] },
  spellblade:  { weapons: ["kt","ls","st","dg"],                 armor: "light", shields: ["buckler","orb"] },
  monk:        { weapons: ["mc","st","sp"],                      armor: "light", shields: ["buckler"] },
  hexer:       { weapons: ["st","dg"],                           armor: "cloth", shields: ["orb"] },
  hermit:      { weapons: ["st","mc"],                           armor: "cloth", shields: ["tome"] },
  brigand:     { weapons: ["dg","bw","ls"],                      armor: "light", shields: ["buckler"] },
  arcthief:    { weapons: ["dg","st","bw"],                      armor: "cloth", shields: ["orb"] },
  crusader:    { weapons: ["ls","mc","sp","ax"],                 armor: "heavy", shields: ["kite","round","buckler"] },
  battlemage:  { weapons: ["ls","ax","st"],                      armor: "heavy", shields: ["buckler","orb"] },
  darkknight:  { weapons: ["ls","ax","mc"],                      armor: "heavy", shields: ["kite","round","buckler"] },
  templar:     { weapons: ["mc","ls","sp"],                      armor: "heavy", shields: ["kite","round","buckler"] },
  exorcist:    { weapons: ["dg","mc","st"],                      armor: "light", shields: ["buckler","tome"] },
  warden:      { weapons: ["st","mc"],                           armor: "light", shields: ["buckler","tome"] },
  arcanist:    { weapons: ["st","dg"],                           armor: "cloth", shields: ["orb"] },
  inquisitor:  { weapons: ["mc","ls"],                           armor: "heavy", shields: ["buckler","tome"] },
  archbishop:  { weapons: ["st","mc"],                           armor: "cloth", shields: ["tome"] },
  ascetic:     { weapons: ["mc","st","ax"],                      armor: "light", shields: ["buckler","tome"] },
  hero:        { weapons: ["ls","kt","mc","sp","ax","dg","st","bw"], armor: "heavy", shields: ["kite","round","buckler","orb","tome"] },
  asura:       { weapons: ["ls","kt","ax","mc","sp","dg"],       armor: "heavy", shields: [] },
  dragonknight:{ weapons: ["ls","sp","ax"],                      armor: "heavy", shields: ["kite","round","buckler"] },
  necromancer: { weapons: ["st","dg"],                           armor: "cloth", shields: ["orb"] },
  sage:        { weapons: ["st","dg","mc"],                      armor: "cloth", shields: ["orb","tome"] },
  cardinal:    { weapons: ["st","mc"],                           armor: "cloth", shields: ["tome"] },
  archmage:    { weapons: ["st","dg"],                           armor: "cloth", shields: ["orb"] },
  chaplain:    { weapons: ["mc","ls","sp"],                      armor: "heavy", shields: ["kite","round","buckler","tome"] },
  sera:        { weapons: ["ls","sp","mc"],                      armor: "heavy", shields: ["kite","round","buckler"] },
};

// 職業ギアマトリクスを items.js に注入 (循環 import 回避のため遅延バインディング)
registerJobGear(JOB_GEAR);


// ===== 属性・ステータス定義 =====
export const ATTR_KEYS = ["atk", "vit", "agi", "int", "pie", "luk"];
export const ATTR_LABEL = { atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
export const ATTR_NAME  = { atk: "筋力", vit: "体力 (被ダメージ軽減)", agi: "敏捷 (行動順・回避)", int: "知力 (攻撃呪文の威力)", pie: "信仰 (回復呪文の威力)", luk: "幸運 (会心率)" };

// ===== 魂 生成・ステータス =====
let _soulUid = 0;

export function makeSoul(clsKey, level = 1, part = null, rank = 1) {
  if (!SOUL_CLASSES[clsKey]) return null;
  if (!part) part = PARTS[Math.floor(Math.random() * PARTS.length)];
  rank = Math.max(1, Math.min(5, parseInt(rank) || 1));
  const cap = capForRarityRank(SOUL_CLASSES[clsKey].rarity, rank);
  return { uid: ++_soulUid, clsKey, part, rank, level: Math.min(Math.max(1, level), cap), cap };
}

export function ensureSoul(s) {
  if (!s) return s;
  // 旧セーブ: rankが文字列なら数値に変換 (normal→1, fine→2, great→3, legend→5)
  if (typeof s.rank === "string") {
    s.rank = ({ normal: 1, fine: 2, great: 3, legend: 5 }[s.rank] || 1);
  }
  s.rank = Math.max(1, Math.min(5, parseInt(s.rank) || 1));
  const rarity = (SOUL_CLASSES[s.clsKey] || {}).rarity || "common";
  s.cap = capForRarityRank(rarity, s.rank);
  if (s.level == null) s.level = 1;
  if (s.level > s.cap) s.level = s.cap;
  return s;
}

// 後方互換: limit-breakthrough は廃止 (cap を超えない)
export function soulHardCap(s) { return capForRarityRank((SOUL_CLASSES[s.clsKey] || {}).rarity || "common", s.rank); }

export function soulName(s) {
  // 魂の名称は系列名のみ (ランクごとの称号は廃止)
  const jobName = (SOUL_CLASSES[s.clsKey] || {}).label || s.clsKey;
  const part = s.part ? `（${PART_LABEL[s.part]}）` : "";
  const fusion = s.fusionBonus ? `+${s.fusionBonus}` : "";
  return `${jobName}の魂${part} Lv${s.level}${fusion}`;
}

// 職業名 (称号) は融合数で上がるランクに応じて変わる (ランク1=見習い戦士 → ランク2=戦士 …)。
// ※ 魂そのものの名称は系列名のみ (soulName / soulSeriesName)。称号と魂名は別物。
export function jobRankName(jobKey, rank) {
  const r = Math.max(1, Math.min(5, rank || 1));
  const rows = JOB_RANKS[jobKey];
  return rows ? rows[r - 1].name : jobKey;
}

// 魂の表示名: 融合した数 (= 魂数 − 1。素材自身も1体と数える) を「+N」で添える。例: 戦士の魂+6
// (+4 と +2 を融合すると、魂数 5+3=8 → +7)
export function soulLabel(s) {
  if (!s) return "";
  const n = isUniqueJob(s.clsKey) ? 0 : Math.max(0, (s.count || 1) - 1); // 固有 (灯守) は物語でランクが上がるだけで、魂を重ねない
  return `${soulSeriesName(s.clsKey)}の魂${n > 0 ? `+${n}` : ""}`;
}
// 次のランクまでの残り「（ランク2まであと4）」。最高ランクなら空
export function soulRankLeft(s) {
  if (!s || isUniqueJob(s.clsKey)) return ""; // 固有 (灯守) のランクは物語で上がる
  const nx = nextRankThreshold(s.clsKey, s.count);
  return nx ? `（ランク${soulRankFromCount(s.clsKey, s.count) + 1}まであと${nx.next - s.count}）` : "";
}
// 魂の系列名 (ランクに依らない。例: "戦士"・"盗賊")
export function soulSeriesName(jobKey) {
  const cls = SOUL_CLASSES[jobKey];
  return cls ? cls.label : jobKey;
}

function lvlFactor(level) { return 1 + (level - 1) * 0.12; }

export function soulStats(s) {
  const cls = SOUL_CLASSES[s.clsKey] || SOUL_CLASSES.fighter;
  const st = cls.stat;
  const rankMul   = SOUL_RANK_MUL[s.rank] || 1.0;
  const rarityMul = RARITY_MUL[cls.rarity] || 1.0;
  const f = lvlFactor(s.level) * rankMul * rarityMul;

  const fusionBonus = s.fusionBonus || 0;
  let fPct = 0;
  if (fusionBonus > 0) {
    // ランク5・Lv100での基準値の N × bonusPct を加算
    const f5 = lvlFactor(100) * (SOUL_RANK_MUL[5] || 1.0) * rarityMul;
    fPct = fusionBonus * (FUSION_STAT_BONUS[cls.rarity] || 0.02);
    const addStat = (v) => (v || 0) * f5 * fPct;
    const r1 = (v) => Math.round(((v || 0) * f + addStat(v)) * 10) / 10;
    return {
      hp: Math.round(st.hp * f + addStat(st.hp)),
      mp: Math.round(st.mp * f + addStat(st.mp)),
      atk: r1(st.atk), vit: r1(st.vit), agi: r1(st.agi),
      int: r1(st.int), pie: r1(st.pie), luk: r1(st.luk),
    };
  }
  const r1 = (v) => Math.round((v || 0) * f * 10) / 10;
  return {
    hp: Math.round(st.hp * f), mp: Math.round(st.mp * f),
    atk: r1(st.atk), vit: r1(st.vit), agi: r1(st.agi),
    int: r1(st.int), pie: r1(st.pie), luk: r1(st.luk),
  };
}

// ===== 人業 (器) =====
// 「本体は魂」: 進行 (count/level/exp) はパーティ共有の魂プール (game.js の G.souls) が持つ。
// 人業はそこから魂を差し込むだけの器で、primary (主魂=職業・ステ・スキル) と
// subs (宿し技スロット: 別職の魂から技/パッシブを借りる、最大 MAX_SUBS 個) を持つ。
let _dollUid = 0;
// 読み込んだ人業の uid に通し番号を合わせる (game.js loadGame)。以前は読み込みのたびに 1 から振り直していたため、
// 読み込み後に仕立てた人業が既存の人業と同じ uid になっていた (最後に使った技・罠の解除役などを取り違える)。
// 重なっている uid は後ろの人業に新しい番号を振り直す。振り直した人業の数を返す
export function syncDollUids(dolls) {
  for (const d of dolls) if (d && Number.isFinite(d.uid) && d.uid > _dollUid) _dollUid = d.uid;
  const used = new Set();
  let fixed = 0;
  for (const d of dolls) {
    if (!d) continue;
    if (!Number.isFinite(d.uid) || used.has(d.uid)) { d.uid = ++_dollUid; fixed++; }
    used.add(d.uid);
  }
  return fixed;
}
export const MAX_SUBS = 2;
// サブ魂 (宿し技) のステータス寄与率: 宿した魂の全ステのこの割合を器に加算する。
// 魂のランクで上がる (R1 10% / R2 15% / R3 20% / R4 25% / R5 30%)。
// 2026-10: 一律30%だとサブ魂の解禁 (D10 の報告後) で隊の能力値が一気に2〜4割跳ね、第3層が易しくなりすぎた (テスト記録)
export const SUB_STAT_RATES = [0, 0.10, 0.15, 0.20, 0.25, 0.30];
export const SUB_STAT_RATE = SUB_STAT_RATES[5]; // 上限 (旧来の一律値。表示の目安用)
export function subStatRateOfRank(rank) { return SUB_STAT_RATES[Math.max(1, Math.min(5, rank || 1))]; }
// サブ魂1つから借りられる技/パッシブの数は、その魂のランクで増える (R1-2=1 / R3-4=2 / R5=3)
export function subPickCapOfRank(rank) { return rank >= 5 ? 3 : rank >= 3 ? 2 : 1; }
export function subPickCap(soul) { return subPickCapOfRank(soul ? soulRankFromCount(soul.clsKey, soul.count) : 0); }
// サブ魂の借用リスト sub.picks = [{skill} | {passive}] を返す。旧形式 {skill, passive} はここで移し替える
export function subPicks(sub) {
  if (!sub) return [];
  if (!Array.isArray(sub.picks)) {
    sub.picks = sub.passive ? [{ passive: sub.passive }] : sub.skill ? [{ skill: sub.skill }] : [];
  }
  delete sub.skill; delete sub.passive;
  // 壊れた要素はその場で取り除く (配列の同一性を保つ: 呼び出し側が手元の参照を使い続けられる)
  for (let i = sub.picks.length - 1; i >= 0; i--) { const p = sub.picks[i]; if (!p || !(p.skill || p.passive)) sub.picks.splice(i, 1); }
  return sub.picks;
}
export function subPickIndex(sub, kind, key) {
  return subPicks(sub).findIndex((p) => (kind === "passive" ? p.passive === key : p.skill === key));
}
// 借用を入れ替える。外す → true / 足す → true / 枠がいっぱいで足せない → false。
// 枠が1つの魂は、選び直すと入れ替える (旧来の「1つだけ借りる」と同じ手触り)。
export function toggleSubPick(sub, kind, key) {
  const picks = subPicks(sub);
  sub.picked = true; // 一度でも選び直したら、空にしても既定の技で埋めない
  const i = subPickIndex(sub, kind, key);
  if (i >= 0) { picks.splice(i, 1); return true; }
  const cap = subPickCap(soulByUid(sub.uid));
  if (picks.length >= cap) {
    if (cap !== 1) return false;
    picks.length = 0;
  }
  picks.push(kind === "passive" ? { passive: key } : { skill: key });
  return true;
}

// 共有魂プールへの参照 (game.js が setSharedSouls で注入)。recalcDoll が読む。
// 新仕様: G.souls は「魂インスタンスの配列」。同じ職業でも1体ずつ個別に Lv/ランクを持つ。
let SOULS = [];
let _soulInstUid = 0;
export function setSharedSouls(s) {
  SOULS = Array.isArray(s) ? s : [];
  for (const so of SOULS) if (so && so.uid > _soulInstUid) _soulInstUid = so.uid;
}
export function allSoulInstances() { return SOULS; }
export function soulByUid(uid) { return uid == null ? null : (SOULS.find((s) => s && s.uid === uid) || null); }
export function makeSoulInstance(clsKey, count = 1, level = 1) {
  return { uid: ++_soulInstUid, clsKey, count: Math.max(1, count), level: Math.max(1, level), exp: 0 };
}
export function soulRankOf(s) { return s ? soulRankFromCount(s.clsKey, s.count) : 0; }
// 魂インスタンスが習得済みのスキル一覧 (自身の Lv とランクで決まる)
export function soulLearnedSkills(s) {
  if (!s) return [];
  // 新仕様: ランク×10ゲートは撤廃。現在の魂レベルで習得 (レベル上限はランク/残火が握る)
  const effLv = s.level || 1;
  const out = [];
  for (const t of jobSkillTable(s.clsKey)) if (t.skill && effLv >= t.lvl && !out.includes(t.skill)) out.push(t.skill);
  return out;
}
// レベルスキル表に織り込まれたパッシブ → {key: lv} (現在の魂レベルまで)
export function jobLevelPassives(jobKey, level) {
  const map = {};
  for (const t of (JOB_SKILLS[jobKey] || [])) {
    if (t.passive && (level || 1) >= t.lvl) map[t.passive] = Math.max(map[t.passive] || 0, t.plv || 1);
  }
  return map;
}
// 魂インスタンスが習得済みのパッシブ {key: lv} (自身の Lv とランクで決まる)。
// レベルスキル表に織り込まれたパッシブ + 旧仕様のランク別パッシブを合算する。
export function soulLearnedPassives(s) {
  if (!s) return {};
  const map = jobLevelPassives(s.clsKey, s.level || 1);
  const rank = soulRankFromCount(s.clsKey, s.count);
  const pmap = passivesUpTo(s.clsKey, rank);
  for (const k in pmap) map[k] = Math.max(map[k] || 0, pmap[k]);
  return map;
}

export function makeDoll(name) {
  return {
    uid: ++_dollUid, name, isDoll: true,
    stability: 100, stabilityAt: Date.now(), // 魂の安定度と回復時計
    primary: null,   // 宿しているメイン魂の uid (祭壇で付け替え)
    subs: [],        // サブ魂スロット: {uid, picks:[{skill}|{passive}], picked} の配列 (最大 MAX_SUBS)。picks=借りる技/パッシブ (数は subPickCap)
    clsKey: "fighter", cls: "空の人業", level: 1,
    hp: 1, maxhp: 1, mp: 0, maxmp: 0,
    atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0,
    resists: zeroResists(), physResist: 0, magResist: 0,
    base: { hp: 1, mp: 0, atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0 },
    equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
    items: [], ailment: null, spells: [], passives: [], alive: true, side: "party",
  };
}

// ===== スキルの並び・戦闘での表示 (隊の「能力」画面で整理する) =====
// 人業ごとに doll.skillOrder (並べた順の技キー) と doll.skillOff (戦闘で出さない技キー) を持つ (セーブ対象)。
// 覚えている技 (doll.spells = 魂・宿し技から recalcDoll が組む) が正で、ここに無い技の設定は無視する。
// 並べ替えた後に覚えた技は末尾に並ぶ。
export function orderedSkills(d) {
  const sp = (d && d.spells) || [];
  const ord = (d && Array.isArray(d.skillOrder)) ? d.skillOrder : null;
  if (!ord || !ord.length) return sp.slice();
  const have = new Set(sp);
  const out = [];
  for (const k of ord) if (have.has(k) && !out.includes(k)) out.push(k);
  for (const k of sp) if (!out.includes(k)) out.push(k);
  return out;
}
export function isSkillOff(d, key) { return !!(d && Array.isArray(d.skillOff) && d.skillOff.includes(key)); }
// 戦闘のスキル一覧に出す技 (並べた順・オフの技を除く)
// 迷宮で唱える技 (kind "field": 浮遊など) は戦闘の一覧に出さない
export function battleSkills(d) { return orderedSkills(d).filter((k) => !isSkillOff(d, k) && !(SPELLS[k] && SPELLS[k].kind === "field")); }
export function setSkillOff(d, key, off) {
  if (!d) return;
  const cur = Array.isArray(d.skillOff) ? d.skillOff.filter((k) => k !== key) : [];
  if (off) cur.push(key);
  d.skillOff = cur;
}
// 技を1つ前 (dir=-1) / 後ろ (dir=+1) へ。動けば true
export function moveSkill(d, key, dir) {
  const list = orderedSkills(d);
  const i = list.indexOf(key), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  d.skillOrder = list;
  return true;
}
export function resetSkillPrefs(d) { if (d) { d.skillOrder = []; d.skillOff = []; d.autoOff = []; } }
// オートで使わない技 (doll.autoOff。セーブ対象)。戦闘で出さない技 (skillOff) もオートは使わない。
// 作戦 (doll.tactic) と組で autotactics.js が読む
export function isAutoOff(d, key) { return !!(d && Array.isArray(d.autoOff) && d.autoOff.includes(key)); }
export function setAutoOff(d, key, off) {
  if (!d) return;
  const cur = Array.isArray(d.autoOff) ? d.autoOff.filter((k) => k !== key) : [];
  if (off) cur.push(key);
  d.autoOff = cur;
}
// オートが選んでよい技 (戦闘の一覧に出ていて、オートを切っていない技)
export function autoSkills(d) { return battleSkills(d).filter((k) => !isAutoOff(d, k)); }

// 同じ職業の魂を吸収するたびに伸びる魂レベル上限の増分 (レア度別)。
// コモン+1 / レア+2 / エピック+5 / レジェンド+10 (吸収数が少なくて済む高レア度ほど1個の伸びが大きい)
export const LEVELCAP_PER_SOUL = { common: 1, rare: 2, epic: 5, legend: 10, unique: 20 };

// 所持数に応じた魂レベル上限。1個目はレア度ごとの基準上限、以降は吸収のたび LEVELCAP_PER_SOUL ぶん伸びる。
// (旧: ランクに応じた段階上限。ランクによる技/パッシブ解放はそのまま、上限だけ吸収数で連続的に伸びる仕様へ)
export function soulLevelCap(clsKey, count) {
  const cls = SOUL_CLASSES[clsKey];
  const rarity = cls ? cls.rarity : "common";
  const base = capForRarityRank(rarity, 1);                 // 1個目 (rank1) の上限を起点にする
  const per = LEVELCAP_PER_SOUL[rarity] || 1;
  return base + per * Math.max(0, (count || 0) - 1);
}
// 魂の残火: Lv上限を1上げるのに要る残火の数 (職業のレア度ごと)
export const EMBER_PER_CAP = { common: 1, rare: 2, epic: 3, legend: 5, unique: 3 };
export function emberCostOf(clsKey) {
  const cls = SOUL_CLASSES[clsKey];
  return EMBER_PER_CAP[cls ? cls.rarity : "common"] || 1;
}
// 魂インスタンスの実効レベル上限: ランク上限 + 魂の残火で得た上乗せ (capBonus)
export function soulLevelCapOf(s) {
  if (!s) return SOUL_RANKS[1].cap;
  return soulLevelCap(s.clsKey, s.count) + (s.capBonus || 0);
}
// 職業ステータス: 基礎値 × レベル係数 × レア度係数 × 集魂ボーナス (1個ごとに基礎値の+N%)
const BASE_FACTOR = 5; // 旧5部位ぶんに相当する基礎係数
export function jobStatsOf(clsKey, entry) {
  const cls = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const st = cls.stat;
  const count = entry ? entry.count || 0 : 1;
  const level = entry ? entry.level || 1 : 1;
  const rarityMul = RARITY_MUL[cls.rarity] || 1.0;
  const up = SOUL_STAT_UP[cls.rarity] || 0.01;
  const f = BASE_FACTOR * lvlFactor(level) * rarityMul * (1 + Math.max(0, count - 1) * up);
  const r1 = (v) => Math.round((v || 0) * f * 10) / 10;
  return {
    hp: Math.round(st.hp * f), mp: Math.round(st.mp * f),
    atk: r1(st.atk), vit: r1(st.vit), agi: r1(st.agi),
    int: r1(st.int), pie: r1(st.pie), luk: r1(st.luk),
  };
}

// ===== 宿し技 (サブ魂) =====
// 各職の「看板スキル」= 職業スキル表のLv40固有技 (職業図鑑などの表示用)。
// サブ魂の借用そのものは看板に限らない: 宿した魂が覚えた技/パッシブから、ランクに応じた数
// (subPickCap: R1-2=1 / R3-4=2 / R5=3) を選べ、その魂のステの10〜30% (ランク別 subStatRateOfRank) も加算される。
export const JOB_SIGNATURE = (() => {
  const out = {};
  for (const k of SOUL_KEYS) {
    const tbl = JOB_SKILLS[k] || [];
    const sig = tbl.find((e) => e.lvl === 40 && e.skill) || [...tbl].reverse().find((e) => e.skill);
    if (sig) out[k] = sig.skill;
  }
  return out;
})();
export function signatureSkillOf(clsKey) { return JOB_SIGNATURE[clsKey] || null; }

// その職の魂がランク rank で得ているランクのパッシブ {key, lv, name, desc}。ランク1なら null
export function awakenPerkOf(clsKey, rank) {
  const r = Math.min(5, rank || 1);
  const e = r >= 2 ? (JOB_PASSIVES[clsKey] || [])[r - 2] : null;
  if (!e) return null;
  const [key, lv] = Object.entries(e.grants)[0];
  return { key, lv, name: e.name, desc: e.desc };
}

// ===== 控えの結社 =====
// 編成に出していない (primary/sub いずれにも使っていない) 魂を「結社」の席に着けると、
// その魂の能力 (jobStatsOf) の一部が人業の全員に加わる (サブ魂の能力加算と同じ形)。技・パッシブは関係しない。
// 割合は魂ランクで決まる (ORDER_STAT_RATES: R1 3% 〜 R5 8%。全員に効くのでサブ魂より薄い)。
// 席数は game.js の orderSeats() (報告5で1, 7で2, 11で3)。席に着いている魂は game.js が setOrderSource で渡す。
export const ORDER_STAT_RATES = [0, 0.03, 0.04, 0.05, 0.06, 0.08];
export function orderStatRateOfRank(rank) { return ORDER_STAT_RATES[Math.max(1, Math.min(5, rank || 1))]; }
let ORDER_SRC = () => [];
export function setOrderSource(fn) { ORDER_SRC = typeof fn === "function" ? fn : () => []; }
// 結社の席の魂が人業1人に足す能力 {hp, mp, atk…} (端数のまま)。uids 省略時は今の席
export function orderStatBonus(uids) {
  const out = { hp: 0, mp: 0, atk: 0, vit: 0, agi: 0, int: 0, pie: 0, luk: 0 };
  for (const uid of (uids || ORDER_SRC() || [])) {
    const s = soulByUid(uid);
    if (!s) continue;
    const st = jobStatsOf(s.clsKey, s), rate = orderStatRateOfRank(soulRankOf(s));
    for (const k in out) out[k] += (st[k] || 0) * rate;
  }
  return out;
}
// 編成中の魂 (primary/sub) の uid 集合を返す
export function fieldedSoulUids(party) {
  const set = new Set();
  for (const d of party || []) {
    if (!d.alive) continue;
    if (d.primary != null) set.add(d.primary);
    for (const s of (d.subs || [])) if (s && s.uid != null) set.add(s.uid);
  }
  return set;
}

export function dollSouls(doll) { return PARTS.map((p) => doll.parts[p]).filter(Boolean); }

export function dominantClass(doll) {
  const tally = {};
  for (const p of PARTS) {
    const s = doll.parts[p]; if (!s) continue;
    tally[s.clsKey] = tally[s.clsKey] || { count: 0, maxLevel: 0 };
    tally[s.clsKey].count++;
    tally[s.clsKey].maxLevel = Math.max(tally[s.clsKey].maxLevel, s.level);
  }
  let best = null;
  for (const k in tally) if (!best || tally[k].count > best.count) best = { clsKey: k, ...tally[k] };
  return best;
}

// 職業発現判定: 同一clsKeyの魂が3部位以上で発現。
// 上位ランクの魂は下位ランクの魂の代替になる
// (rank r の発現には「clsKey一致 かつ rank>=r」の魂が3部位以上必要)。
// 発現ランクは、その条件を満たす最大の r。系統が複数あるときは高ランク優先、
// 同ランクなら宿している魂数が多い系統を採用する。
export function jobRankOf(doll) {
  const byCls = {}; // clsKey -> その系統の魂ランク配列
  for (const p of PARTS) {
    const s = doll.parts[p]; if (!s) continue;
    (byCls[s.clsKey] = byCls[s.clsKey] || []).push(s.rank);
  }
  let best = null;
  for (const clsKey in byCls) {
    const ranks = byCls[clsKey];
    // rank>=r の魂が3部位以上になる最大の r を求める
    for (let r = 5; r >= 1; r--) {
      const cnt = ranks.filter((x) => x >= r).length;
      if (cnt >= 3) {
        if (!best || r > best.rank || (r === best.rank && ranks.length > best.total)) {
          best = { clsKey, rank: r, count: cnt, total: ranks.length };
        }
        break; // この系統の最大発現ランクは確定
      }
    }
  }
  if (!best) return null;
  // ランクボーナス: 5部位すべて同系列職業 (同 clsKey) ならボーナス。
  // 職業発現と同じく上位ランクは下位を兼ねるため、ランクの一致は問わない。
  let total5 = 0;
  for (const p of PARTS) {
    const s = doll.parts[p];
    if (s && s.clsKey === best.clsKey) total5++;
  }
  best.all5 = (total5 === 5);
  return best;
}

export function charLevelOf(doll) {
  const souls = dollSouls(doll);
  if (!souls.length) return 1;
  return Math.max(1, Math.round(souls.reduce((a, s) => a + (s.level || 1), 0) / souls.length));
}

// ===== recalcDoll (器 = 主魂 + 宿し技) =====
// 主魂 (primary) の共有育成エントリ {count, level} から全ステ・スキル・パッシブを導出し、
// サブ魂 (subs) が選んだ技/パッシブを魂のランクに応じた数だけ借りる。進行は所持魂インスタンス (SOULS) が持つ。
let PERMANENT_STAT_SRC = () => ({});
export function setPermanentStatSource(fn) { PERMANENT_STAT_SRC = typeof fn === "function" ? fn : () => ({}); }

export function recalcDoll(doll) {
  if (!doll.subs) doll.subs = [];
  const pe = doll.primary != null ? soulByUid(doll.primary) : null; // メイン魂インスタンス
  const clsKey = pe ? pe.clsKey : null;
  const rank = pe ? soulRankFromCount(clsKey, pe.count) : 0;
  // レベルはランクの上限でクランプ (ランクアップで上限が伸びる)
  if (pe) {
    const cap = soulLevelCapOf(pe);
    if ((pe.level || 1) > cap) pe.level = cap;
    if (!pe.level) pe.level = 1;
  }
  const st = pe ? jobStatsOf(clsKey, pe)
    : { hp: 1, mp: 0, atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0 };
  // 魂の格 (combat.js soulCostAdd): メイン魂そのもののMP。装備・サブ魂・結社・永続強化で足した分は含めない
  doll.soulMp = st.mp || 0;

  const spells = [];
  const passives = [];
  const passiveMap = {};
  doll.jobRank = rank;
  doll.hybrid = null;

  if (clsKey) {
    doll.jobKey = clsKey;
    doll.clsKey = clsKey;
    // 職業の称号はランクで変わる (見習い戦士 → 戦士 → 剣士 …)
    const ranks = JOB_RANKS[clsKey];
    doll.cls = ranks ? ranks[rank - 1].name : SOUL_CLASSES[clsKey].label;
    doll.jobLv = pe.level;
    // スキル/パッシブは魂レベルで習得 (新仕様: ランク×10ゲート撤廃。上限はランク/残火が握る)
    const effLv = pe.level;
    for (const t of jobSkillTable(clsKey)) {
      if (t.skill && effLv >= t.lvl && !spells.includes(t.skill)) spells.push(t.skill);
    }
    // レベルスキル表に織り込まれたパッシブ
    const lpm = jobLevelPassives(clsKey, effLv);
    for (const k in lpm) {
      passiveMap[k] = Math.max(passiveMap[k] || 0, lpm[k]);
      const nm = passiveName(k, lpm[k]);
      if (!passives.includes(nm)) passives.push(nm);
    }
    // 旧仕様のランク別パッシブ (戦士以外。戦士は上のレベル表に統合済み)
    const pmap = passivesUpTo(clsKey, rank);
    for (const k in pmap) passiveMap[k] = Math.max(passiveMap[k] || 0, pmap[k]);
    const tbl = JOB_PASSIVES[clsKey] || [];
    for (let r = 2; r <= rank; r++) if (tbl[r - 2]) passives.push(tbl[r - 2].name);
  } else {
    doll.jobKey = null;
    doll.clsKey = "fighter";
    doll.cls = "空の人業";
    doll.jobLv = 1;
  }

  // サブ魂: その魂が覚えている技/パッシブから、ランクに応じた数 (subPickCap) まで借りる。
  // 借用は sub.picks。覚えていない/上限を超えた分は効かない (外した後の空きは既定で埋めない)。
  // ステータスはその魂のステの subStatRateOfRank(ランク) (R1 10% 〜 R5 30%) を加算する。
  doll.subInfo = [];
  for (const sub of doll.subs) {
    const se = sub ? soulByUid(sub.uid) : null;
    if (!se) continue;
    const sr = soulRankFromCount(se.clsKey, se.count);
    const cap = subPickCapOfRank(sr);
    const learned = soulLearnedSkills(se);
    const learnedPassives = soulLearnedPassives(se);
    const picks = subPicks(sub);
    // 職の技の作り直しで、その魂の表から消えた技・パッシブの借用は外す (全部消えたら既定の技で埋め直す)
    const tbl = jobSkillTable(se.clsKey);
    const had = picks.length;
    for (let i = picks.length - 1; i >= 0; i--) {
      const p = picks[i];
      const awk = awakenPerkOf(se.clsKey, 5);
      if (!tbl.some((t) => (p.skill ? t.skill === p.skill : t.passive === p.passive)) && !(p.passive && awk && awk.key === p.passive)) picks.splice(i, 1);
    }
    if (had && !picks.length) sub.picked = false;
    // 宿したばかり (借用が空で未設定) なら看板スキル相当 (覚えている最後のスキル) を既定にする
    if (!picks.length && !sub.picked && learned.length) picks.push({ skill: learned[learned.length - 1] });
    const used = [];
    for (const p of picks) {
      if (used.length >= cap) break;
      if (p.passive && learnedPassives[p.passive]) {
        const plv = learnedPassives[p.passive];
        passiveMap[p.passive] = Math.max(passiveMap[p.passive] || 0, plv);
        const nm = passiveName(p.passive, plv);
        if (!passives.includes(nm)) passives.push(nm);
        used.push({ passive: p.passive });
      } else if (p.skill && learned.includes(p.skill)) {
        if (!spells.includes(p.skill)) spells.push(p.skill);
        used.push({ skill: p.skill });
      }
    }
    // サブ魂のステータスを、その魂のランクに応じた割合 (subStatRateOfRank) ぶん加算
    const sst = jobStatsOf(se.clsKey, se);
    const rate = subStatRateOfRank(sr);
    for (const k in st) st[k] += (sst[k] || 0) * rate;
    doll.subInfo.push({ uid: se.uid, clsKey: se.clsKey, rank: sr, level: se.level, cap, picks: used, rate });
  }

  // 歴戦の体 (toughBody): 最大HPを割合で底上げ
  if (passiveMap.toughBody) st.hp *= 1 + ([0, 0.10, 0.20, 0.30][Math.min(3, passiveMap.toughBody)] || 0);

  // 控えの結社: 席の魂の能力の一部を全員に加える (魂を宿していない人業は除く)
  doll.orderBonus = null;
  if (pe) {
    const ob = orderStatBonus();
    if (Object.values(ob).some((v) => v > 0)) {
      for (const k in ob) st[k] += ob[k];
      doll.orderBonus = ob;
    }
  }

  doll.passiveMap = passiveMap;
  doll.tier = rank ? "rank" + rank : "none";
  doll.dominant = clsKey ? { clsKey, count: pe.count, maxLevel: pe.level } : null;
  doll.endure = (passiveMap.endure || 0) > 0;
  doll.level = doll.jobLv || 1;

  const permanent = PERMANENT_STAT_SRC();
  if (pe) for (const k of Object.keys(st)) st[k] += permanent[k] || 0;

  const traits = jobBaseTraitsOf(clsKey, rank);
  doll.base = {
    hp: Math.max(1, Math.round(st.hp)), mp: Math.round(st.mp),
    atk: Math.round(st.atk), vit: Math.round(st.vit), agi: Math.max(1, Math.round(st.agi)),
    int: Math.round(st.int), pie: Math.round(st.pie), luk: Math.round(st.luk),
    crit: traits.crit + (pe ? (permanent.crit || 0) : 0), resists: traits.resists,
  };
  doll.spells = spells;
  doll.passives = passives;
  delete doll.attrs;
  delete doll.parts; delete doll.souls; delete doll.soulCls; // 旧フィールドの残骸を除去
  recalc(doll);
  return doll;
}

// ===== 魂融合 =====
// 同職業・同部位・同ランク・LvMAXの魂2体 → 1つ上のランクの魂を生成
// ランク5の場合は fusionBonus を +1 して返す (ステータス強化)
export function fuseSouls(s1, s2) {
  if (!s1 || !s2) return null;
  if (s1.clsKey !== s2.clsKey || s1.part !== s2.part || s1.rank !== s2.rank) return null;
  const cap = capForRarityRank((SOUL_CLASSES[s1.clsKey] || {}).rarity || "common", s1.rank);
  if (s1.level < cap || s2.level < cap) return null; // LvMAX必須

  if (s1.rank >= 5) {
    // ランク5融合: ステータス強化 (s1 を強化して返す、s2 は消費)
    const result = { ...s1, fusionBonus: ((s1.fusionBonus || 0) + 1) };
    return { type: "enhance", soul: result };
  }
  // ランクアップ
  const newRank = s1.rank + 1;
  const newSoul = makeSoul(s1.clsKey, 1, s1.part, newRank);
  return { type: "rankup", soul: newSoul };
}

// ===== 職業キャラアイコン =====
// 36職それぞれの専用12x12キャラドット絵。人業チップ・職業図鑑など「職業」の
// 表示に使う (魂そのものは従来どおり宝珠 soulSprite で表す)。
// 位階 (魂ランク = 職業ランク 1〜5) が上がるほど同じ姿のまま豪華になる:
//   ランク1 = くすんだ見習い装 / 2 = 職業色の正装 / 3 = 金の意匠が入る /
//   4 = 瞳が灯り淡いオーラをまとう / 5 = 冠・光輪を戴き強いオーラを放つ。
//
// 文字の意味: 0=輪郭 1=主色(衣・鎧) 2=明色(襟・帯) 3=肌・手 4=金属(武具)
//   5=紋章(ランク3+で金に変わる) 6=瞳(ランク4+で光る) 7=象嵌(ランク3未満は主色)
//   8=飾り(羽根・聖玉など。ランク3+でのみ出現) 9=冠・光輪(ランク5のみ)
const JOB_ARTS = {
  // --- コモン (6) ---
  // 戦士: 羽根飾りの兜と大剣
  fighter: [
    ".8..99...4..",
    "..800000.4..",
    "..01111104..",
    "..03333304..",
    "..03636304..",
    "...02220.4..",
    "..011111444.",
    "..01151134..",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 騎士: 面頬の兜・カイトシールド・長剣
  knight: [
    ".8..99......",
    "..800000.4..",
    "..04444404..",
    "..00606004..",
    "..04444404..",
    "...02220.4..",
    "04011111444.",
    "0501111134..",
    "040222220...",
    ".0.01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 僧侶: 頭巾と胸の聖印・十字杖
  priest: [
    "....99......",
    "...00000848.",
    "..011110444.",
    "..01333104..",
    "..01636104..",
    "...0222034..",
    "..01111104..",
    "..01151104..",
    "..01555104..",
    ".011151110..",
    ".011111110..",
    ".000000000..",
  ],
  // 魔導士: つば広のとんがり帽と宝珠の杖
  mage: [
    "..9.00.9....",
    "...0110..5..",
    ".8011110.5..",
    ".011111104..",
    "..03636304..",
    "...0222034..",
    "..01111104..",
    "..01151104..",
    ".011111104..",
    ".021111204..",
    ".01111110...",
    ".00000000...",
  ],
  // 盗賊: 目深の頭巾・襟巻き・短剣
  thief: [
    "....99......",
    "....000.....",
    "...01110....",
    "..01111104..",
    "..01606104..",
    "...0222034..",
    ".80111110...",
    "..0115110...",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "..00..00....",
  ],
  // 司教: 宝玉の司教冠と法環の杖
  bishop: [
    "...9.0.9....",
    "..8.010..5..",
    "...01710.5..",
    "..01111104..",
    "..03636304..",
    "...0222034..",
    "..01111104..",
    "..01151104..",
    ".011111104..",
    ".021111204..",
    ".01111110...",
    ".00000000...",
  ],
  // --- レア (12) ---
  // 侍: 陣笠と打刀、広袖の着流し
  samurai: [
    "....99......",
    "..0000008.4.",
    ".0111111104.",
    "..033330.4..",
    "..036360.4..",
    "...0222034..",
    ".011111110..",
    "..0115110...",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 狂戦士: 角兜と肩鎧、両刃の大斧
  berserker: [
    ".8.99...8...",
    "..000000..4.",
    "..044440.444",
    "..046460.444",
    "..044440..4.",
    "..02220...4.",
    "01111111034.",
    ".0115110..4.",
    ".0222220..4.",
    "..01110.....",
    "..01.10.....",
    "..00.00.....",
  ],
  // 狩人: 大弓と羽根飾りの頭巾
  hunter: [
    "....99......",
    "....000.8...",
    "...01110.4..",
    "..0111110.4.",
    "..0160610.4.",
    "...02220344.",
    "..0111110.4.",
    "..0115110.4.",
    "..02222204..",
    "...01110....",
    "...01.10....",
    "..00..00....",
  ],
  // 暗殺者: 平笠の下の光る目、脚のない影のマントと提灯杖
  shadow: [
    "....99......",
    "....000.....",
    "00111111100.",
    ".8.06060.4..",
    "..01111104..",
    "..01111134..",
    ".011111104..",
    ".011151104..",
    ".011111105..",
    ".01111110...",
    ".01111110...",
    ".00000000...",
  ],
  // 聖騎士: 体を覆う十字の大盾
  paladin: [
    "....99......",
    "...00000....",
    ".804444408..",
    "..0464640...",
    "..0444440...",
    "...000000...",
    "..0445440...",
    "..0455540...",
    "..0445440...",
    "...04540....",
    "....040.....",
    "...00.00....",
  ],
  // 守護騎士: 全身を隠す塔盾と鉄槌
  guardian: [
    "....99......",
    "....00000.4.",
    ".88044440444",
    "044006060.4.",
    "044004440.4.",
    "044002220.4.",
    "04500111034.",
    "044001510.4.",
    "044002220...",
    "0440.0110...",
    "0440.01.10..",
    "0000..00.00.",
  ],
  // 魔法剣士: 焔をまとう魔剣を左手に、肩掛けのマント
  spellblade: [
    ".8..99......",
    ".5.00000....",
    ".40111120...",
    "540333330...",
    ".403636302..",
    "54.02220.2..",
    ".430111022..",
    "..01151102..",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 武僧: 錫杖を携えた荒法師、開いた足構え
  monk: [
    "....99......",
    ".5.00000....",
    ".40222220...",
    ".40333330...",
    ".40363630...",
    "54.02220....",
    ".43011110...",
    ".80115110...",
    "..0222220...",
    "..0111110...",
    "..01...10...",
    "..00...00...",
  ],
  // 呪術師: 角つき頭巾と骨面、毒の小瓶
  hexer: [
    "....99......",
    "..8.000.8...",
    "...01110....",
    "..0144410...",
    "..0164610...",
    "...0222035..",
    ".801111108..",
    "..0115110...",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "..00..00....",
  ],
  // 隠修士: 編笠に隠れた顔と遍路の杖
  hermit: [
    "....99......",
    "...00000....",
    "8001111100.8",
    "...06060.4..",
    "..03333304..",
    "...0222034..",
    "..01111104..",
    "..01151104..",
    ".011111104..",
    ".021111204..",
    ".01111110...",
    ".00000000...",
  ],
  // 義賊: 鉢巻きと翻るマント、金袋
  brigand: [
    "....99......",
    "...00000....",
    "..800000....",
    "220333330...",
    ".20363630...",
    "...02220....",
    ".021111120..",
    ".021151120..",
    ".022222205..",
    ".0.01110.0..",
    "...01.10....",
    "...00.00....",
  ],
  // 魔盗賊: 覆面頭巾、短剣と掌中の魔晶
  arcthief: [
    "....99......",
    "....000.....",
    "...01110....",
    "..0111110...",
    "..0163610...",
    "...0222035..",
    ".40111110.8.",
    ".30115110...",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "..00..00....",
  ],
  // --- エピック (10) ---
  // 聖戦士: 翼飾りの大兜と幅広の聖剣、十字の陣羽織
  crusader: [
    "....99..44..",
    "...0000044..",
    ".204444044..",
    "8200606044..",
    ".204444044..",
    "..02220.44..",
    "..011134444.",
    "..01151104..",
    "..0155510...",
    "...01510....",
    "...01.10....",
    "...00.00....",
  ],
  // 魔闘士: 数珠を提げた拳闘の僧兵
  battlemage: [
    "....99......",
    "...00000....",
    "..0222220...",
    "..0333330...",
    "..0363630...",
    ".8.02220.8..",
    ".301111103..",
    "..0151510...",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 魔騎士: 浮遊する魔晶と刻印の魔剣
  darkknight: [
    "....99......",
    "...00000.4..",
    ".804444405..",
    "..04646404..",
    "..04444405..",
    "5..02220.4..",
    "55011111034.",
    "5.01151104..",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 神殿騎士: 聖旗の長柄と鐘の紋
  templar: [
    "....99...4..",
    "...0000044..",
    "..0444440455",
    "..0464640455",
    "..04444404..",
    "...02220.4.8",
    "..01111134..",
    "..01171104..",
    "..02222204..",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 祓魔師: 飛び交う札と聖別の刃
  exorcist: [
    "....99......",
    "....000.....",
    ".8.01110....",
    "5.0111110.5.",
    "..0160610.5.",
    "...0222034..",
    "..01111104..",
    "..01151104..",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "..00..00....",
  ],
  // 護法師: 方形の法冠と浮かぶ結界の法陣
  warden: [
    "....99......",
    "..8000008...",
    "..0111110...",
    "..03333304..",
    "..03636304..",
    ".5.0222034..",
    "5.50111104..",
    ".5.0115104..",
    ".011111104..",
    ".021111204..",
    ".01111110...",
    ".00000000...",
  ],
  // 秘術師: 額の宝珠と宙に開いた禁書
  arcanist: [
    "....99......",
    "....000.....",
    "...01110....",
    "..0117110...",
    "..0160610...",
    "...02220....",
    "..0111110...",
    ".802252208..",
    "..0222220...",
    ".01111110...",
    ".01111110...",
    ".00000000...",
  ],
  // 審問官: 鉄肩当ての修道服と断罪の大槌
  inquisitor: [
    "....99......",
    "..800000....",
    "..0111110444",
    "..0133310444",
    "..0163610.4.",
    "...02220.34.",
    ".40111110.4.",
    "..0115110.4.",
    "..0222220.4.",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 巡礼者: 高く聳える宝冠と曲頭杖
  archbishop: [
    "..90709.44..",
    "...0710.4...",
    ".80111104...",
    "..0333304...",
    "..0363604...",
    "...022034...",
    "..0111104...",
    "..0115104...",
    ".01111110...",
    ".02111120...",
    ".01111110...",
    ".00000000...",
  ],
  // 修験者: 頭襟と錫杖、結袈裟の行者装束
  ascetic: [
    "....99......",
    "....7.......",
    "...00000.5..",
    "..03333305..",
    "..03636304..",
    "...0222034..",
    "8011111104..",
    "..01515104..",
    "..02222204..",
    "...01110.4..",
    "...01.10....",
    "...00.00....",
  ],
  // --- レジェンド (8) ---
  // 勇者: 宝玉の額冠と聖剣、固き小盾
  hero: [
    "....99...4..",
    "..800000.4..",
    "..02252204..",
    "..03333304..",
    "..03636304..",
    "...0222034..",
    "44011111444.",
    "4401151134..",
    "..0222220...",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 修羅: 逆立つ髪と二刀、開いた足構え
  asura: [
    ".4..99...4..",
    ".480.0.084..",
    ".401111104..",
    ".403333304..",
    ".403636304..",
    ".430222034..",
    "..0111110...",
    "..0115110...",
    "..0222220...",
    "...01110....",
    "..01...10...",
    "..00...00...",
  ],
  // 竜騎士: 竜角の兜と軍旗の長槍、翼のマント
  dragonknight: [
    "....99...4..",
    ".8.0000.84..",
    "..04444054..",
    "..04646004..",
    "..04444004..",
    "...0222034..",
    ".201111104..",
    "2201151104..",
    "..02222204..",
    "...01110....",
    "...01.10....",
    "...00.00....",
  ],
  // 死霊術師: 深い頭巾と骨の佩物、曲刃の闇杖
  necromancer: [
    "....99..4...",
    "....000.44..",
    ".8.01110..4.",
    "..0160610.4.",
    "..0111110.4.",
    "...02220.34.",
    "..0111110.4.",
    "..0114110.4.",
    "..0252520.4.",
    ".01111110...",
    ".01111110...",
    ".00000000...",
  ],
  // 賢者: 長い白髭と大宝珠の杖
  sage: [
    "....99...5..",
    "...0000.555.",
    ".8033333055.",
    "..03636304..",
    "..02222204..",
    "...0222034..",
    "..01121104..",
    "..01151104..",
    ".011111104..",
    ".021111204..",
    ".01111110...",
    ".00000000...",
  ],
  // 枢機卿: 広帽と房飾り、二重十字の聖杖
  cardinal: [
    "....99......",
    "..0000000.4.",
    "011111110444",
    ".8033333084.",
    "..0363630444",
    "...02220.34.",
    "..0111110.4.",
    "..0115110.4.",
    ".01111110.4.",
    ".02111120...",
    ".01111110...",
    ".00000000...",
  ],
  // 大魔導: 宙に浮く裾と双つの魔晶、高襟
  archmage: [
    "....99......",
    "....000.....",
    "...01110....",
    "..0161610...",
    ".201111102..",
    "5..02220..5.",
    "55.011110.55",
    "..0115110...",
    "..0111110...",
    "...01110....",
    "..8.010.8...",
    ".....0......",
  ],
  // 護教官: 司教冠に鉄肩当て、聖典と鎚矛
  chaplain: [
    "...9.0.9....",
    "....010.454.",
    "...01110444.",
    "..0111110.4.",
    "..0363630.4.",
    ".8.02220.34.",
    ".40111110.4.",
    "..0117110.4.",
    "..0222220.4.",
    ".01111110...",
    ".01111110...",
    ".00000000...",
  ],
  // 灯守 (セラ): 長い黒髪を模した木彫りの頭、胸に師の灯、円い盾。原画が届くまでの仮の絵
  sera: [
    "....0000....",
    "...000000...",
    "..00333300..",
    "..03633630..",
    "..00333300..",
    "..0022220044",
    "..0111111454",
    "..0115511454",
    "..0111111044",
    "...011110...",
    "...01..10...",
    "...00..00...",
  ],
};

// #rrggbb 同士を t (0-1) で混ぜる
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// #rrggbb → rgba() 文字列 (オーラの半透明用)
function hexA(hex, a) {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}

const _jobSprCache = {};

// 職業キャラアイコンを返す。jobKey は SOUL_CLASSES の36職キー。
// rank は職業ランク = 魂ランク (1〜5)。
export function jobSprite(jobKey, rank = 2) {
  const r = Math.max(1, Math.min(5, Math.round(rank) || 2));
  // ランクごとに選ぶ: そのランクのドット絵があればそれ、無ければ原画そのまま版、どちらも無ければ近いランクのドット絵
  if (JOB_IMAGES[jobKey] && JOB_IMAGES[jobKey][r]) return imageJobSprite(jobKey, r);
  if (JOB_PHOTOS[jobKey]) return photoJobSprite(jobKey, r);
  if (JOB_IMAGES[jobKey]) return imageJobSprite(jobKey, r);
  const key = JOB_ARTS[jobKey] ? jobKey : "fighter";
  const cacheKey = key + ":" + r;
  if (_jobSprCache[cacheKey]) return _jobSprCache[cacheKey];

  const c = SOUL_CLASSES[key] || SOUL_CLASSES.fighter;
  const dull = (x, t) => mixHex(x, "#787c84", t); // 見習い装のくすみ
  const lift = (x, t) => mixHex(x, "#ffffff", t);

  // ランクで深まる色調
  const prim = r === 1 ? dull(c.color, 0.5) : r >= 4 ? mixHex(c.color, c.glow, r === 5 ? 0.28 : 0.15) : c.color;
  const trim = r === 1 ? dull(c.glow, 0.5) : r === 5 ? lift(c.glow, 0.3) : r === 4 ? lift(c.glow, 0.15) : c.glow;
  const accBase = mixHex(c.glow, c.color, 0.3); // 紋章のランク2以下の色
  const acc = r >= 3 ? (r === 5 ? "#ffd95e" : "#e8c24a") : r === 1 ? dull(accBase, 0.4) : accBase;
  const metal = r === 1 ? "#8f949e" : r >= 4 ? mixHex("#c9cfdb", c.glow, 0.25) : "#c9cfdb";
  const eye = r >= 5 ? "#ffffff" : r === 4 ? lift(c.glow, 0.35) : "#16120e";

  const palette = {
    "0": mixHex(c.color, "#07070c", 0.76),
    "1": prim,
    "2": trim,
    "3": r === 1 ? "#d9bd96" : "#ecc89c",
    "4": metal,
    "5": acc,
    "6": eye,
    "7": r >= 3 ? acc : prim, // 象嵌: 低ランクでは主色に沈む
  };
  if (r >= 3) palette["8"] = r === 5 ? "#ffe48a" : acc; // 飾り
  if (r >= 5) palette["9"] = "#ffe48a"; // 冠・光輪

  let art = JOB_ARTS[key];
  // ランク4+: 輪郭の外側1ドットにオーラをまとう。
  // ランク4は市松の煌めき、ランク5は途切れぬ光輪+斜めに散る残光。
  if (r >= 4) {
    const rows = art.map((s) => s.split(""));
    const solid = (y, x) => {
      if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return false;
      const ch = rows[y][x];
      return ch !== "." && palette[ch] != null;
    };
    const out = art.map((s) => s.split(""));
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== ".") continue;
        if (solid(y - 1, x) || solid(y + 1, x) || solid(y, x - 1) || solid(y, x + 1)) {
          if (r >= 5 || (x + y) % 2 === 0) out[y][x] = "a";
        } else if (r >= 5 && (x + y) % 2 === 0 &&
          (solid(y - 1, x - 1) || solid(y - 1, x + 1) || solid(y + 1, x - 1) || solid(y + 1, x + 1))) {
          out[y][x] = "b";
        }
      }
    }
    art = out.map((a) => a.join(""));
    palette["a"] = hexA(c.glow, r === 5 ? 0.3 : 0.26);
    if (r >= 5) palette["b"] = hexA(c.glow, 0.13);
  }

  return (_jobSprCache[cacheKey] = { palette, art });
}

// ---- 原画から起こした全身像 (src/jobart.js) ----
// 全職の絵を同じ枠 (IMG_BOX) に、顔の列を中央・足元を揃えて置く (並べた時に背丈とドットの大きさが揃う)。
// そのランクの絵が無ければ近いランクの絵で代え、ランク1はくすませ、ランク4・5は輪郭の外に職の光をまとわせる。
const IMG_BOX = (() => {
  let w = 0, h = 0;
  for (const set of Object.values(JOB_IMAGES)) for (const im of Object.values(set)) {
    const iw = im.art.reduce((m, row) => Math.max(m, row.length), 0);
    w = Math.max(w, 2 * Math.max(im.face[0], iw - im.face[0]));
    h = Math.max(h, im.art.length);
  }
  // 原画そのまま版 (jobphotos.js) も同じ升目単位で同じ枠に入れる
  for (const set of Object.values(JOB_PHOTOS)) for (const im of Object.values(set)) {
    w = Math.max(w, 2 * Math.max(im.face[0], im.w - im.face[0]));
    h = Math.max(h, im.h);
  }
  return [w + 4, h + 2]; // 光をまとう余白
})();
function pickJobImage(key, r, set = JOB_IMAGES[key]) {
  if (set[r]) return { im: set[r], exact: true };
  const near = Object.keys(set).map(Number).sort((a, b) => Math.abs(a - r) - Math.abs(b - r) || b - a)[0];
  return { im: set[near], exact: false };
}
// 枠 IMG_BOX に収めた art と、その中の顔の位置
function padImage(im) {
  const [W, H] = IMG_BOX;
  const ox = Math.round(W / 2 - im.face[0]), oy = H - 1 - im.art.length;
  const blank = ".".repeat(W);
  const art = [];
  for (let y = 0; y < H; y++) {
    const row = im.art[y - oy];
    art.push(row == null ? blank : (".".repeat(ox) + row).padEnd(W, ".").slice(0, W));
  }
  const out = { art, face: [im.face[0] + ox, im.face[1] + oy] };
  if (im.head) out.head = [im.head[0] + ox, im.head[1] + oy, im.head[2] + oy];
  return out;
}
function imageJobSprite(key, r) {
  const cacheKey = "img:" + key + ":" + r;
  if (_jobSprCache[cacheKey]) return _jobSprCache[cacheKey];
  const c = SOUL_CLASSES[key] || SOUL_CLASSES.fighter;
  const { im, exact } = pickJobImage(key, r);
  const { art: base, face, head } = padImage(im);
  const palette = { ...im.palette };
  // 見習い (ランク1) を上のランクの絵で代える時は、装いをくすませる
  if (!exact && r === 1) for (const k in palette) palette[k] = mixHex(palette[k], "#6e6a66", 0.32);
  let art = base;
  // ランク4・5 (専用の絵が無い間): 輪郭の外側1ドットに職の色の光。5は途切れぬ光輪と斜めの残光
  if (!exact && r >= 4) {
    const rows = base.map((row) => row.split(""));
    const solid = (y, x) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
    const out = base.map((row) => row.split(""));
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== ".") continue;
      if (solid(y - 1, x) || solid(y + 1, x) || solid(y, x - 1) || solid(y, x + 1)) {
        if (r >= 5 || (x + y) % 2 === 0) out[y][x] = "a";
      } else if (r >= 5 && (x + y) % 2 === 0 && (solid(y - 1, x - 1) || solid(y - 1, x + 1) || solid(y + 1, x - 1) || solid(y + 1, x + 1))) out[y][x] = "b";
    }
    art = out.map((a) => a.join(""));
    palette["a"] = hexA(c.glow, r === 5 ? 0.42 : 0.34);
    if (r >= 5) palette["b"] = hexA(c.glow, 0.16);
  }
  return (_jobSprCache[cacheKey] = head ? { palette, art, face, head } : { palette, art, face });
}

// ---- 原画そのまま版 (src/jobphotos.js) ----
// 画像は職・ランクごとに1枚。読み込みは最初に要った時 (以後は使い回す)。
// 返す絵 = { photo: { img, sx, sy, sw, sh }, w, h, face } — 枠 IMG_BOX の升目単位で、顔の列を中央・足元を揃えて置く
// (原画の外にはみ出す切り出し矩形は透明として描かれる)。そのランクの絵が無ければ近いランクの絵をそのまま使う
const _photoImg = {};
function photoImage(src) {
  if (_photoImg[src]) return _photoImg[src];
  let img;
  if (typeof Image !== "undefined") { img = new Image(); img.src = src; }
  else img = { complete: false, naturalWidth: 0 }; // DOM の無い検証環境
  return (_photoImg[src] = img);
}
function photoJobSprite(key, r) {
  const cacheKey = "photo:" + key + ":" + r;
  if (_jobSprCache[cacheKey]) return _jobSprCache[cacheKey];
  const { im } = pickJobImage(key, r, JOB_PHOTOS[key]);
  const [W, H] = IMG_BOX;
  const ox = Math.round(W / 2 - im.face[0]), oy = H - 1 - im.h;
  const R = PHOTO_RES;
  const spr = {
    photo: { img: photoImage(im.src), sx: -ox * R, sy: -oy * R, sw: W * R, sh: H * R },
    w: W, h: H, face: [im.face[0] + ox, im.face[1] + oy],
  };
  if (im.head) spr.head = [im.head[0] + ox, im.head[1] + oy, im.head[2] + oy];
  return (_jobSprCache[cacheKey] = spr);
}

// 職業の胸像 (肖像の小さな額・一覧の札用)。原画のある職は顔を中心に正方形で切り出す。
// 原画の無い職は従来の 12×12 の小さな全身像 (それ自体が額に収まる大きさ) をそのまま返す
const BUST = 36;
// 顔の大きさを全職で揃える基準: 絵ごとに測った head = [顔の中心x, 頭頂y, あご先y] (升目単位) があれば、
// 頭の高さ (頭頂〜あご先) がどの胸像でも BUST_HEAD ドット、頭頂が上から BUST_TOP ドットに来るよう正方形を切り出す。
// 頭頂は髪の塊の上端 (跳ね毛・飾りの先は含めない)。顔の中心x は頬の左右の輪郭の真ん中。
// 職ごと・ランクごとに描かれた縮尺が違っても、頭の大きさと位置が揃う
// (「瞳〜あご」は顔立ちで比が違い、「顔の幅」は髪が頬に掛かると狭く測れて、どちらも見た目の大きさと合わなかった)。
// 値は旧来の戦士の胸像に合わせてある。tools/jobimg.py の同名の定数と同じ値にすること。
const BUST_HEAD = 20.5, BUST_TOP = 1;
// head の無い絵 (原画を受け取る前のドット絵の職) は従来どおり: 戦士の顔を基準に目で合わせた職ごとの倍率で、
// 切り出す正方形を BUST × zoom にし、BUST 角へ縮め/伸ばす。zoom > 1 = 顔が大きく描かれた職 (広く切って縮める) /
// zoom < 1 = 顔が小さい職 (狭く切って伸ばす)。dx/dy = 切り出しの中心を face からずらすドット数 (顔の真ん中へ寄せる)
export const BUST_FIT = {
  thief: { zoom: 1.2 },
  hermit: { zoom: 0.8, dy: -4 },
  hexer: { zoom: 0.65, dx: 2, dy: -7 },
  crusader: { zoom: 1.1, dy: -2 },
  brigand: { zoom: 1.1, dy: 3 },
  battlemage: { zoom: 1.2, dx: 1, dy: 1 },
  darkknight: { zoom: 1.25, dy: 4 },
  templar: { zoom: 1.1, dy: 3 },
};
// 人業に宿す前の魂のアイコン: 青い人魂 (ICONS.wisp) をその職の魂の色 (glow) で染め直す。
// 入手の知らせ (トースト・祝祭の札・戦果) では胸像ではなくこれを使う
const _soulIconCache = {};
export function soulIcon(jobKey) {
  if (_soulIconCache[jobKey]) return _soulIconCache[jobKey];
  const base = ICONS.wisp;
  const cl = SOUL_CLASSES[jobKey];
  const glow = (cl && cl.glow) || "#9fd4e3";
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const g = hex(glow);
  const tint = (col) => {
    let rgb, alpha = null;
    const m = /^rgba?\(([^)]+)\)$/.exec(col);
    if (m) { const v = m[1].split(",").map((x) => parseFloat(x)); rgb = v.slice(0, 3); if (v.length > 3) alpha = v[3]; }
    else rgb = hex(col);
    const L = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    // 暗部は glow を沈め、明部は白へ寄せる (濃淡の段はそのまま)
    const out = L < 0.6 ? g.map((c) => Math.round(c * (0.12 + 0.88 * L / 0.6)))
      : g.map((c) => Math.round(c + (255 - c) * ((L - 0.6) / 0.4)));
    return alpha != null ? `rgba(${out.join(",")},${alpha})` : `rgb(${out.join(",")})`;
  };
  const palette = {};
  for (const k of Object.keys(base.palette)) palette[k] = tint(base.palette[k]);
  return (_soulIconCache[jobKey] = { palette, art: base.art });
}
const _bustCache = {};
export function jobBust(jobKey, rank = 2) {
  const spr = jobSprite(jobKey, rank);
  if (!spr.face) return spr;
  const fit = BUST_FIT[jobKey] || {};
  const zoom = fit.zoom || 1;
  const cacheKey = [jobKey, Math.max(1, Math.min(5, Math.round(rank) || 2)), zoom, fit.dx || 0, fit.dy || 0].join(":");
  if (_bustCache[cacheKey]) return _bustCache[cacheKey];
  let S, x0, y0;
  if (spr.head) {
    // 測った顔の寸法で切り出す (原画版は升目より細かい位置のまま、ドット絵は升目に丸める)
    const [hx, top, chin] = spr.head;
    const fs = (BUST * Math.max(1, chin - top)) / BUST_HEAD;
    const fx = hx - fs / 2, fy = top - (BUST_TOP * fs) / BUST;
    if (spr.photo) { S = fs; x0 = fx; y0 = fy; }
    else { S = Math.max(8, Math.round(fs)); x0 = Math.round(hx - S / 2); y0 = Math.round(top - (BUST_TOP * S) / BUST); }
  } else {
    S = Math.max(8, Math.round(BUST * zoom));
    const cx = spr.face[0] + (fit.dx || 0), cy = spr.face[1] + (fit.dy || 0);
    x0 = Math.round(cx - S / 2); y0 = Math.round(cy - S / 2);
  }
  if (spr.photo) {
    // 原画版: 全身像と同じ画像から、胸像の正方形を切り出す (縮めるのは描く時)
    const p = spr.photo, R = p.sw / spr.w;
    const bust = { photo: { img: p.img, sx: p.sx + x0 * R, sy: p.sy + y0 * R, sw: S * R, sh: S * R }, w: BUST, h: BUST };
    return (_bustCache[cacheKey] = bust);
  }
  const at = (x, y) => { const ch = y < 0 || x < 0 ? "" : (spr.art[y] || "")[x]; return ch || "."; };
  const k = S / BUST;
  const art = [];
  for (let oy = 0; oy < BUST; oy++) {
    const ya = Math.floor(oy * k), yb = Math.max(ya + 1, Math.floor((oy + 1) * k));
    let line = "";
    for (let ox = 0; ox < BUST; ox++) {
      const xa = Math.floor(ox * k), xb = Math.max(xa + 1, Math.floor((ox + 1) * k));
      if (xb - xa === 1 && yb - ya === 1) { line += at(x0 + xa, y0 + ya); continue; }
      // 縮める時は、まとめる升目でいちばん多い色 (透明が過半なら透明)。同数なら左上寄りの色
      const tally = new Map();
      let n = 0, clear = 0;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
        const ch = at(x0 + x, y0 + y);
        n++;
        if (ch === ".") { clear++; continue; }
        tally.set(ch, (tally.get(ch) || 0) + 1);
      }
      let best = ".", bn = 0;
      for (const [ch, c] of tally) if (c > bn) { best = ch; bn = c; }
      line += clear * 2 > n ? "." : best;
    }
    art.push(line);
  }
  return (_bustCache[cacheKey] = { palette: spr.palette, art });
}
// 面影の写し (第三章の入口で館のイレーヌが教える): d.face = {job, rank} を写した人業は、宿す魂に依らずその姿で描く。
//   見た目だけ (職業・能力・枠の光は宿した魂のまま)。写せるのは職業図鑑で到達したランク (game.js omokageRanks)
export function dollFace(d) {
  const f = d && d.face;
  if (!f || !SOUL_CLASSES[f.job]) return null;
  const rank = Math.round(f.rank);
  return rank >= 1 && rank <= 5 ? { job: f.job, rank } : null;
}
function dollLook(d) {
  const f = d && d.vessel === "sera" ? null : dollFace(d); // セラの肖像は灯守に固定 (面影の写しは効かない)
  if (f) return f;
  return { job: d.jobKey || (d.dominant && d.dominant.clsKey) || d.clsKey || "fighter", rank: d.jobRank || 1 };
}
// 肖像の描き直しの鍵 (職業・ランク・面影が変わった時だけ描き直す)
export function dollLookKey(d) {
  const l = dollLook(d);
  return `${l.job}:${l.rank}`;
}
export function dollBust(d) {
  const l = dollLook(d);
  return jobBust(l.job, l.rank);
}

// 人業の顔アイコン: 発現中の職業と職業ランクの姿 (面影を写していればその姿)。未発現は支配職のランク1
export function dollSprite(d) {
  const l = dollLook(d);
  return jobSprite(l.job, l.rank);
}

// ===== スプライト =====
// 魂のドット絵 (部位スロット/一覧表示用)。職業色の宝珠。
// ※職業の表示は jobSprite/dollSprite (キャラアイコン)。魂はあくまで宝珠で表す。
export function soulSprite(clsKey) {
  const c = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  return {
    palette: { "0": "#0a0a12", "1": c.color, "2": c.glow, "3": "#ffffff" },
    art: [
      "....0000....", "..00222200..", ".0221111220.", ".0211333110.",
      "021133331120", "021113311120", "021111111120", "021111111120",
      ".0211111120.", ".0221111220.", "..00222200..", "....0000....",
    ],
  };
}
