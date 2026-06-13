// 魂(Soul)と人業(Doll)のデータモデル — 新仕様 (36職業・ランク1-5・レア度・融合)
//
// 魂のランク = 職業の位階 (1〜5)。同じ職業の魂を3部位以上に宿すと職業発現。
// 上位ランクの魂は下位ランクの代替になり、発現ランクは「rank>=r が3部位以上」を満たす最大の r。
// 5部位すべて同系列職業 (同clsKey) でランクボーナス発生。上位ランクはダンジョンでは出ず、融合で入手。
import { recalc, registerJobGear } from "./items.js";
import { JOB_LORE_RANKS } from "./joblore.js";

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
  archbishop:  { label: "大司教",   rarity: "epic",    color: "#f0d0a0", glow: "#fff0c0", stat: { hp: 5.5, mp: 3.0, atk: 1.0, vit: 1.0, agi: 1.0, int: 1.6, pie: 3.0, luk: 1.0 } },
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
};

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
  hexer:       [{ name: "呪い屋" }, { name: "呪術師" }, { name: "蠱毒師" }, { name: "大呪術師" }, { name: "禍津神" }],
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
  archbishop:  [{ name: "修道院長" }, { name: "大司教" }, { name: "首座大司教" }, { name: "総大司教" }, { name: "聖座の代行者" }],
  ascetic:     [{ name: "行人" }, { name: "修験者" }, { name: "山伏" }, { name: "大先達" }, { name: "権現" }],
  hero:        [{ name: "選定の徒" }, { name: "勇者" }, { name: "大勇者" }, { name: "英雄" }, { name: "救世主" }],
  asura:       [{ name: "武芸者" }, { name: "修羅" }, { name: "羅刹" }, { name: "阿修羅" }, { name: "阿修羅王" }],
  dragonknight:[{ name: "竜の従士" }, { name: "竜騎士" }, { name: "飛竜騎士" }, { name: "竜騎士長" }, { name: "竜帝" }],
  necromancer: [{ name: "屍読み" }, { name: "死霊術師" }, { name: "死霊導師" }, { name: "死霊王" }, { name: "冥導王" }],
  sage:        [{ name: "見習い賢者" }, { name: "賢者" }, { name: "博学者" }, { name: "賢人" }, { name: "全知者" }],
  cardinal:    [{ name: "司祭" }, { name: "枢機卿" }, { name: "大枢機卿" }, { name: "教皇代理" }, { name: "教皇" }],
  archmage:    [{ name: "深淵の徒" }, { name: "大魔導" }, { name: "魔導皇" }, { name: "深淵公" }, { name: "深淵王" }],
  chaplain:    [{ name: "衛教兵" }, { name: "護教官" }, { name: "護教騎士" }, { name: "護教総監" }, { name: "教皇の盾" }],
};

// ===== 魂ランク (1〜5) の係数・表示 =====
// cap: そのランクで到達できる魂レベル上限 / order: 0始まり (UI判定用) / color: 表示色
export const SOUL_RANKS = {
  1: { label: "",         cap: 20,  order: 0, color: null,      mul: 1.0 },
  2: { label: "ランク2の", cap: 40,  order: 1, color: "#7fd0ff", mul: 1.3 },
  3: { label: "ランク3の", cap: 60,  order: 2, color: "#c08aff", mul: 1.9 },
  4: { label: "ランク4の", cap: 80,  order: 3, color: "#ff9a4a", mul: 3.0 },
  5: { label: "ランク5の", cap: 100, order: 4, color: "#ffcf4a", mul: 5.0 },
};

// ===== 集魂ランクアップ (1部位制) =====
// 人業は職業ごとに「吸収した魂の数 (count)」と「魂レベル (level/exp)」を個別に育てる。
// 同じ職業の魂を集めるとステータスが上がり、一定数でランクアップして
// 魂レベルの上限 (SOUL_RANKS[rank].cap) が伸び、新たなスキル・パッシブが解放される。
// RANKUP_NEED[rarity] = [r1→2, r2→3, r3→4, r4→5] に必要な追加の魂数
export const RANKUP_NEED = {
  common: [10, 30, 50, 100],
  rare:   [5, 15, 25, 50],
  epic:   [2, 5, 10, 20],
  legend: [1, 2, 3, 5],
};
// 同じ魂1個ごとの全ステータス上昇 (基礎値に対する%)。1個目は基礎値そのもの
export const SOUL_STAT_UP = { common: 0.01, rare: 0.04, epic: 0.10, legend: 1.00 };

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
const RARITY_MUL = { common: 1.0, rare: 1.15, epic: 1.3, legend: 1.5 };

// 融合強化 (ランク5魂を2体融合するたびに加算): レア度ごとのLv100ステ比率
export const FUSION_STAT_BONUS = { common: 0.02, rare: 0.05, epic: 0.10, legend: 0.20 };

// ランクボーナス (5部位すべて同系列職業のときの全ステ倍率)
export const FIVE_PART_BONUS = { common: 0.10, rare: 0.15, epic: 0.20, legend: 0.25 };

// 合成に必要な空の魂の数
export const RARITY_SYNTH_COST = { common: 1, rare: 5, epic: 10, legend: 20 };

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
  afterMp:       { label: "魔力回路",     scope: "self",  lv: ["戦闘勝利後、MP5%回復", "戦闘勝利後、MP10%回復"] },
  afterBoth:     { label: "法力の灯",     scope: "self",  lv: ["戦闘勝利後、HP3%とMP3%回復", "戦闘勝利後、HP8%とMP8%回復"] },
  purify:        { label: "浄化",         scope: "party", lv: ["戦闘勝利後、隊全体の毒・麻痺を治す"] },
  selfPurify:    { label: "自浄",         scope: "self",  lv: ["戦闘勝利後、自分の毒・麻痺を治す"] },
  mercy:         { label: "慈悲の祈り",   scope: "party", lv: ["戦闘勝利後、倒れた味方1人をHP10%で蘇生 (1探索1回)"] },
  popePrayer:    { label: "教皇の祈り",   scope: "party", lv: ["自分の戦闘後回復を隊全体に適用する"] },
  soulEater:     { label: "魂喰い",       scope: "self",  lv: ["敵を倒した時、MP5%回復"] },
  vigilance:     { label: "周囲警戒",     scope: "party", lv: ["奇襲される確率が半減", "奇襲を受けなくなる"] },
  senseEnemy:    { label: "敵感知",       scope: "party", lv: ["まだめくっていないカードの敵の気配が見える"] },
  senseTreasure: { label: "財宝感知",     scope: "party", lv: ["まだめくっていないカードの財宝の気配が見える"] },
  initiative:    { label: "先制の心得",   scope: "party", lv: ["先制攻撃の発生率+15%"] },
  poisonFloor:   { label: "毒床耐性",     scope: "party", lv: ["毒の床から受けるダメージ半減", "毒の床のダメージを無効化"] },
  fleetFoot:     { label: "逃げ足",       scope: "party", lv: ["逃走の成功率+30%"] },
  goldLuck:      { label: "金運",         scope: "party", lv: ["戦闘で得るゴールド+15%", "戦闘で得るゴールド+30%"] },
  soulLure:      { label: "魂寄せ",       scope: "party", lv: ["戦闘で得るSoul+10%", "戦闘で得るSoul+20%"] },
  appraise:      { label: "目利き",       scope: "party", lv: ["敵の戦利品ドロップ率+15%"] },
  extraHit:      { label: "連撃",         scope: "self",  lv: ["通常攻撃が10%で2撃目を放つ (威力60%)", "通常攻撃が20%で2撃目を放つ (威力60%)"] },
  fightSpirit:   { label: "闘魂",         scope: "self",  lv: ["HP30%以下の時、ATK+25%", "HP30%以下の時、ATK+40%・会心+15%"] },
  spellBlade:    { label: "魔力撃",       scope: "self",  lv: ["通常攻撃にINTの50%を上乗せ", "通常攻撃にINTの100%を上乗せ"] },
  venomBlade:    { label: "毒刃",         scope: "self",  lv: ["通常攻撃が15%で敵を毒にする", "通常攻撃が30%で敵を毒にする"] },
  flinch:        { label: "怯ませ",       scope: "self",  lv: ["通常攻撃が10%で敵を怯ませる (主には効かない)"] },
  smite:         { label: "破邪",         scope: "self",  lv: ["不死・幽鬼・悪魔へのダメージ+30%"] },
  holyEdge:      { label: "聖刃",         scope: "self",  lv: ["不死・幽鬼・悪魔への会心率+15%"] },
  vitalEye:      { label: "急所読み",     scope: "self",  lv: ["会心ダメージ+25%"] },
  gokudoku:      { label: "蠱毒",         scope: "self",  lv: ["毒状態の敵への与ダメージ+30%"] },
  sleepKill:     { label: "寝込み襲い",   scope: "self",  lv: ["睡眠・麻痺中の敵への攻撃が必ず会心"] },
  ambushCrit:    { label: "不意打ち",     scope: "self",  lv: ["先制時、最初の通常攻撃が必ず会心"] },
  kenma:         { label: "剣魔合一",     scope: "self",  lv: ["呪文を唱えた次の通常攻撃が必ず会心"] },
  zanshin:       { label: "残心",         scope: "self",  lv: ["敵を倒した時25%で追加攻撃 (1ラウンド1回)"] },
  twinArts:      { label: "二刀の理",     scope: "self",  lv: ["通常攻撃の後30%でINT×0.6の追撃呪文"] },
  iai:           { label: "居合",         scope: "self",  lv: ["戦闘開始時、敵1体へ自動で抜き打ち (奇襲時は不発)"] },
  openSpell:     { label: "開幕呪撃",     scope: "self",  lv: ["戦闘開始時、敵1体へ無消費の呪撃INT×1.2 (奇襲時は不発)"] },
  asceticism:    { label: "荒行の果て",   scope: "self",  lv: ["HP30%以下の間、与ダメージ・回復量+30%"] },
  taunt:         { label: "挑発",         scope: "self",  lv: ["敵の単体攻撃が自分に向かいやすくなる"] },
  cover:         { label: "かばう",       scope: "party", lv: ["瀕死(HP25%以下)の味方への攻撃を肩代わり (1戦闘1回)", "肩代わりが1戦闘2回になり、その被ダメ-30%"] },
  parry:         { label: "見切り",       scope: "self",  lv: ["敵の物理攻撃を10%で完全回避", "敵の物理攻撃を15%で完全回避"] },
  counter:       { label: "反撃",         scope: "self",  lv: ["物理被弾時15%でATK×0.5の反撃", "物理被弾時25%でATK×0.7の反撃", "物理被弾時35%でATK×1.0の反撃 (会心あり)"] },
  endure:        { label: "不屈",         scope: "self",  lv: ["致死ダメージをHP1で耐える (1戦闘1回)"] },
  barrier:       { label: "魔障壁",       scope: "self",  lv: ["ブレス・呪文の被ダメージ半減 (1戦闘1回)", "ブレス・呪文の被ダメージ半減 (1戦闘2回)"] },
  reflect:       { label: "魔力反射",     scope: "self",  lv: ["魔障壁で防いだ分のダメージを相手に返す"] },
  bigBarrier:    { label: "大結界",       scope: "party", lv: ["敵の全体攻撃を隊全体で半減 (1戦闘1回・自動)"] },
  holyCover:     { label: "聖盾",         scope: "party", lv: ["かばうがブレス等の攻撃も肩代わりできる"] },
  bastion:       { label: "城壁の構え",   scope: "party", lv: ["自分が防御中、隊全体の被ダメージ-10%"] },
  resistAilment: { label: "異常耐性",     scope: "self",  lv: ["毒・麻痺・睡眠の付与率-30%", "毒・麻痺・睡眠-60%、石化・即死-30%"] },
  sanctuary:     { label: "聖域",         scope: "party", lv: ["隊全体に異常耐性Lv1を付与"] },
  martyr:        { label: "殉教の祈り",   scope: "party", lv: ["自分が倒れた時、味方全体をPIE×1.0回復 (1戦闘1回)"] },
  divineCounter: { label: "神罰の鉄槌",   scope: "self",  lv: ["物理被弾時20%でPIE×0.8の聖なる反撃"] },
  scripture:     { label: "聖典の加護",   scope: "self",  lv: ["HP30%以下になった時、PIE×1.2を自動回復 (1戦闘1回)"] },
  chant:         { label: "省詠唱",       scope: "self",  lv: ["呪文・技の消費MP-15%", "呪文・技の消費MP-30%"] },
  spellCrit:     { label: "呪文会心",     scope: "self",  lv: ["攻撃呪文が10%で会心 (×1.5)", "攻撃呪文が18%で会心 (×1.5)"] },
  scan:          { label: "弱点看破",     scope: "party", lv: ["戦闘中、敵の属性が見える"] },
  elemFloor:     { label: "森羅の理",     scope: "self",  lv: ["自分の攻撃呪文に属性の不利が出なくなる"] },
};

export function passiveName(key, lv = 1) {
  const def = PASSIVES[key]; if (!def) return key;
  return def.lv.length > 1 ? `${def.label}Lv${lv}` : def.label;
}
export function passiveDesc(key, lv = 1) {
  const def = PASSIVES[key]; if (!def) return "";
  return def.lv[Math.min(lv, def.lv.length) - 1] || "";
}
const P = (key, lv = 1) => ({ name: passiveName(key, lv), desc: passiveDesc(key, lv), grants: { [key]: lv } });
const U = (name, desc, grants) => ({ name, desc, grants });

// ===== 職業パッシブ表 [ランク2,3,4,5] =====
export const JOB_PASSIVES = {
  // コモン
  fighter:     [P("extraHit", 1), P("fightSpirit", 1), P("extraHit", 2), P("fightSpirit", 2)],
  knight:      [P("taunt"), P("cover", 1), P("cover", 2), P("endure")],
  priest:      [P("afterHeal", 1), P("afterHeal", 2), P("afterHeal", 3), P("afterHeal", 4)],
  mage:        [P("afterMp", 1), P("chant", 1), P("afterMp", 2), P("spellCrit", 2)],
  thief:       [P("vigilance", 1), P("senseEnemy"), P("poisonFloor", 1), P("poisonFloor", 2)],
  bishop:      [P("afterBoth", 1), P("scan"), P("afterBoth", 2), P("purify")],
  // レア
  samurai:     [P("initiative"), P("parry", 1), P("iai"), P("zanshin")],
  berserker:   [P("counter", 1), P("fightSpirit", 1), P("counter", 2), P("fightSpirit", 2)],
  hunter:      [P("ambushCrit"), P("extraHit", 1), P("vitalEye"), P("extraHit", 2)],
  shadow:      [P("vigilance", 1), P("initiative"), P("sleepKill"), P("parry", 2)],
  paladin:     [P("afterHeal", 1), P("cover", 1), P("cover", 2), P("martyr")],
  guardian:    [P("taunt"), P("counter", 1), P("bastion"), P("endure")],
  spellblade:  [P("spellBlade", 1), P("chant", 1), P("spellBlade", 2), P("kenma")],
  monk:        [P("afterHeal", 1), P("smite"), P("afterHeal", 2), P("endure")],
  hexer:       [P("venomBlade", 1), P("gokudoku"), P("venomBlade", 2), P("flinch")],
  hermit:      [P("vigilance", 1), P("poisonFloor", 1), P("fleetFoot"), U("隠形", "奇襲を受けず、逃走の成功率+30%", { vigilance: 2, fleetFoot: 1 })],
  brigand:     [P("goldLuck", 1), P("appraise"), P("goldLuck", 2), P("soulLure", 1)],
  arcthief:    [P("initiative"), P("chant", 1), P("openSpell"), P("spellCrit", 1)],
  // エピック
  crusader:    [P("smite"), P("afterHeal", 1), P("afterHeal", 2), U("神威の加護", "毒・麻痺・睡眠-60%、石化・即死-30%", { resistAilment: 2 })],
  battlemage:  [P("afterMp", 1), P("flinch"), P("afterMp", 2), U("金剛身", "魔障壁Lv2と異常耐性Lv1を得る", { barrier: 2, resistAilment: 1 })],
  darkknight:  [P("barrier", 1), P("cover", 1), P("barrier", 2), P("reflect")],
  templar:     [P("afterHeal", 1), P("selfPurify"), P("cover", 1), P("sanctuary")],
  exorcist:    [P("vigilance", 1), P("holyEdge"), P("purify"), P("smite")],
  warden:      [P("barrier", 1), P("cover", 1), P("barrier", 2), P("bigBarrier")],
  arcanist:    [P("afterMp", 1), P("spellCrit", 1), P("chant", 1), P("spellCrit", 2)],
  inquisitor:  [P("afterHeal", 1), P("resistAilment", 1), P("cover", 1), P("divineCounter")],
  archbishop:  [P("afterHeal", 1), P("selfPurify"), P("afterMp", 1), P("scripture")],
  ascetic:     [P("afterMp", 1), P("poisonFloor", 1), P("barrier", 1), P("asceticism")],
  // レジェンド
  hero:        [P("cover", 1), P("smite"), U("勇者の不屈", "不屈と毒・麻痺・睡眠-60%を得る", { endure: 1, resistAilment: 2 }), P("mercy")],
  asura:       [P("extraHit", 1), P("fightSpirit", 1), P("extraHit", 2), U("阿修羅の型", "連撃Lv2・闘魂Lv2・急所読みを得る", { extraHit: 2, fightSpirit: 2, vitalEye: 1 })],
  dragonknight:[P("taunt"), P("barrier", 1), P("endure"), U("竜鱗の守り", "魔障壁Lv2・不屈・かばうLv1を得る", { barrier: 2, endure: 1, cover: 1 })],
  necromancer: [P("soulEater"), P("soulLure", 1), P("soulLure", 2), P("sleepKill")],
  sage:        [P("afterMp", 1), P("scan"), P("chant", 1), U("森羅万象", "消費MP-30%、攻撃呪文に属性の不利が出ない", { chant: 2, elemFloor: 1 })],
  cardinal:    [P("afterHeal", 1), P("afterMp", 1), P("afterHeal", 2), P("popePrayer")],
  archmage:    [P("afterMp", 1), P("chant", 1), P("spellCrit", 1), U("深淵の理", "消費MP-30%、敵の属性が見える", { chant: 2, scan: 1 })],
  chaplain:    [P("cover", 1), P("barrier", 1), P("resistAilment", 1), U("聖盾", "かばうLv2を得て、ブレス等もかばえる", { cover: 2, holyCover: 1 })],
};

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
export const SKILL_LEVELS = [1, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50];
export const JOB_SKILLS = {
  fighter:     [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "TATEWARI" }, { lvl: 5, skill: "DOUBLE" }, { lvl: 7, skill: "WARCRY" }, { lvl: 10, skill: "NAGIHARAI" }, { lvl: 15, skill: "MIDARE" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "ISSEN" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "KIKOKU" }, { lvl: 50, skill: "ZANTETSU" }],
  knight:      [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "PROTECT" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "KOTE" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "GUARDALL" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "GOUZAN" }, { lvl: 30, skill: "BOUJIN" }, { lvl: 40, skill: "JOUMON" }, { lvl: 50, skill: "OUJOU" }],
  priest:      [{ lvl: 1, skill: "DIOS" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "BLESS" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "DIOSALL" }, { lvl: 15, skill: "DIAL" }, { lvl: 20, skill: "SAINTRAY" }, { lvl: 25, skill: "REVIVE" }, { lvl: 30, skill: "MADIOS" }, { lvl: 40, skill: "DIALALL" }, { lvl: 50, skill: "RESURRECT" }],
  mage:        [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "ICENEEDLE" }, { lvl: 5, skill: "KATINO" }, { lvl: 7, skill: "KAMAITACHI" }, { lvl: 10, skill: "MAHALITO" }, { lvl: 15, skill: "ROCKBLAST" }, { lvl: 20, skill: "MADALT" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "LAHALITO" }, { lvl: 40, skill: "TILTOWAIT" }, { lvl: 50, skill: "SEISAI" }],
  thief:       [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "POISONSTAB" }, { lvl: 5, skill: "BLIND" }, { lvl: 7, skill: "DOUBLE" }, { lvl: 10, skill: "KASUMEGIRI" }, { lvl: 15, skill: "ASSASSINATE" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "KAGENUI" }, { lvl: 30, skill: "TSUJIKAZE" }, { lvl: 40, skill: "OBORO" }, { lvl: 50, skill: "ZETSUEI" }],
  bishop:      [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "ICENEEDLE" }, { lvl: 7, skill: "CURE" }, { lvl: 10, skill: "DIAL" }, { lvl: 15, skill: "MAHALITO" }, { lvl: 20, skill: "DIOSALL" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "MADALT" }, { lvl: 40, skill: "MADIOS" }, { lvl: 50, skill: "TILTOWAIT" }],
  samurai:     [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "TATEWARI" }, { lvl: 5, skill: "POISONSTAB" }, { lvl: 7, skill: "DOUBLE" }, { lvl: 10, skill: "KASUMEGIRI" }, { lvl: 15, skill: "MIDARE" }, { lvl: 20, skill: "ASSASSINATE" }, { lvl: 25, skill: "GOUZAN" }, { lvl: 30, skill: "TSUJIKAZE" }, { lvl: 40, skill: "TSUBAMEGAESHI" }, { lvl: 50, skill: "ZETSUEI" }],
  berserker:   [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "TATEWARI" }, { lvl: 5, skill: "SHIELDBASH" }, { lvl: 7, skill: "DOUBLE" }, { lvl: 10, skill: "NAGIHARAI" }, { lvl: 15, skill: "MIDARE" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "ISSEN" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "KIJINKUDAKI" }, { lvl: 50, skill: "KIKOKU" }],
  hunter:      [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "BLIND" }, { lvl: 5, skill: "POISONSTAB" }, { lvl: 7, skill: "DOUBLE" }, { lvl: 10, skill: "KASUMEGIRI" }, { lvl: 15, skill: "ASSASSINATE" }, { lvl: 20, skill: "OBORO" }, { lvl: 25, skill: "GOUZAN" }, { lvl: 30, skill: "TSUJIKAZE" }, { lvl: 40, skill: "KUBIKARI" }, { lvl: 50, skill: "ZETSUEI" }],
  shadow:      [{ lvl: 1, skill: "BLIND" }, { lvl: 3, skill: "POISONSTAB" }, { lvl: 5, skill: "KASUMEGIRI" }, { lvl: 7, skill: "DOUBLE" }, { lvl: 10, skill: "ASSASSINATE" }, { lvl: 15, skill: "KAGENUI" }, { lvl: 20, skill: "OBORO" }, { lvl: 25, skill: "TSUJIKAZE" }, { lvl: 30, skill: "YOIYAMIUCHI" }, { lvl: 40, skill: "HAJANOTACHI" }, { lvl: 50, skill: "ZETSUEI" }],
  paladin:     [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "PROTECT" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "GUARDALL" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "BOUJIN" }, { lvl: 30, skill: "SAINTRAY" }, { lvl: 40, skill: "SEIHEKINOINORI" }, { lvl: 50, skill: "OUJOU" }],
  guardian:    [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "PROTECT" }, { lvl: 5, skill: "KOTE" }, { lvl: 7, skill: "KYOUGEKI" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "GUARDALL" }, { lvl: 20, skill: "BOUJIN" }, { lvl: 25, skill: "GOUZAN" }, { lvl: 30, skill: "JOUMON" }, { lvl: 40, skill: "KOUBOUITTAI" }, { lvl: 50, skill: "OUJOU" }],
  spellblade:  [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "HALITO" }, { lvl: 5, skill: "DOUBLE" }, { lvl: 7, skill: "ICENEEDLE" }, { lvl: 10, skill: "MIDARE" }, { lvl: 15, skill: "ROCKBLAST" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "MAHALITO" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "MAENZAN" }, { lvl: 50, skill: "ZANTETSU" }],
  monk:        [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "CURE" }, { lvl: 10, skill: "MIDARE" }, { lvl: 15, skill: "BLESS" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "DIOSALL" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "KONGOURENDA" }, { lvl: 50, skill: "ZANTETSU" }],
  hexer:       [{ lvl: 1, skill: "BLIND" }, { lvl: 3, skill: "POISONSTAB" }, { lvl: 5, skill: "KATINO" }, { lvl: 7, skill: "HALITO" }, { lvl: 10, skill: "KAGENUI" }, { lvl: 15, skill: "MAHALITO" }, { lvl: 20, skill: "DISPEL" }, { lvl: 25, skill: "MADALT" }, { lvl: 30, skill: "LAHALITO" }, { lvl: 40, skill: "DOKUGIRI" }, { lvl: 50, skill: "SEISAI" }],
  hermit:      [{ lvl: 1, skill: "DIOS" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "BLIND" }, { lvl: 7, skill: "BLESS" }, { lvl: 10, skill: "DIOSALL" }, { lvl: 15, skill: "KATINO" }, { lvl: 20, skill: "KAGENUI" }, { lvl: 25, skill: "DIAL" }, { lvl: 30, skill: "MADIOS" }, { lvl: 40, skill: "KASUMINOTOBARI" }, { lvl: 50, skill: "RESURRECT" }],
  brigand:     [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "BLIND" }, { lvl: 5, skill: "POISONSTAB" }, { lvl: 7, skill: "KASUMEGIRI" }, { lvl: 10, skill: "ASSASSINATE" }, { lvl: 15, skill: "SHIELDBASH" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "OBORO" }, { lvl: 30, skill: "TSUJIKAZE" }, { lvl: 40, skill: "OIHAGI" }, { lvl: 50, skill: "ZETSUEI" }],
  arcthief:    [{ lvl: 1, skill: "BLIND" }, { lvl: 3, skill: "HALITO" }, { lvl: 5, skill: "KASUMEGIRI" }, { lvl: 7, skill: "ICENEEDLE" }, { lvl: 10, skill: "KATINO" }, { lvl: 15, skill: "MAHALITO" }, { lvl: 20, skill: "KAGENUI" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "OBORO" }, { lvl: 40, skill: "MARYOKUGOUDATSU" }, { lvl: 50, skill: "SEISAI" }],
  crusader:    [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "HOLYRAY" }, { lvl: 5, skill: "DOUBLE" }, { lvl: 7, skill: "BLESS" }, { lvl: 10, skill: "NAGIHARAI" }, { lvl: 15, skill: "SAINTRAY" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "REVIVE" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "SEIKOUZAN" }, { lvl: 50, skill: "ZANTETSU" }],
  battlemage:  [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "HALITO" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "ICENEEDLE" }, { lvl: 10, skill: "MIDARE" }, { lvl: 15, skill: "MAHALITO" }, { lvl: 20, skill: "DISPEL" }, { lvl: 25, skill: "GOUZAN" }, { lvl: 30, skill: "ROCKBLAST" }, { lvl: 40, skill: "HAMANOKEN" }, { lvl: 50, skill: "TILTOWAIT" }],
  darkknight:  [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "PROTECT" }, { lvl: 5, skill: "HALITO" }, { lvl: 7, skill: "KOTE" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "MAHALITO" }, { lvl: 20, skill: "BOUJIN" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "JOUMON" }, { lvl: 40, skill: "MAGUINOTACHI" }, { lvl: 50, skill: "OUJOU" }],
  templar:     [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "PROTECT" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "GUARDALL" }, { lvl: 15, skill: "IRONWALL" }, { lvl: 20, skill: "BOUJIN" }, { lvl: 25, skill: "DIOSALL" }, { lvl: 30, skill: "JOUMON" }, { lvl: 40, skill: "SEIIKINOKANE" }, { lvl: 50, skill: "OUJOU" }],
  exorcist:    [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "HOLYRAY" }, { lvl: 5, skill: "BLIND" }, { lvl: 7, skill: "CURE" }, { lvl: 10, skill: "KASUMEGIRI" }, { lvl: 15, skill: "SAINTRAY" }, { lvl: 20, skill: "ASSASSINATE" }, { lvl: 25, skill: "OBORO" }, { lvl: 30, skill: "TSUJIKAZE" }, { lvl: 40, skill: "HAJANOTACHI" }, { lvl: 50, skill: "ZETSUEI" }],
  warden:      [{ lvl: 1, skill: "PROTECT" }, { lvl: 3, skill: "HALITO" }, { lvl: 5, skill: "BLESS" }, { lvl: 7, skill: "KAMAITACHI" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "ROCKBLAST" }, { lvl: 20, skill: "GUARDALL" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "MADALT" }, { lvl: 40, skill: "KOUSHUNOHOUJIN" }, { lvl: 50, skill: "TILTOWAIT" }],
  arcanist:    [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "ICENEEDLE" }, { lvl: 5, skill: "KAMAITACHI" }, { lvl: 7, skill: "KATINO" }, { lvl: 10, skill: "MAHALITO" }, { lvl: 15, skill: "ROCKBLAST" }, { lvl: 20, skill: "MADALT" }, { lvl: 25, skill: "LAHALITO" }, { lvl: 30, skill: "DISPEL" }, { lvl: 40, skill: "KINJUKAICHOU" }, { lvl: 50, skill: "SEISAI" }],
  inquisitor:  [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "HOLYRAY" }, { lvl: 7, skill: "BLESS" }, { lvl: 10, skill: "KOTE" }, { lvl: 15, skill: "GUARDALL" }, { lvl: 20, skill: "MIDARE" }, { lvl: 25, skill: "DIOSALL" }, { lvl: 30, skill: "SAINTRAY" }, { lvl: 40, skill: "DANZAINOTSUCHI" }, { lvl: 50, skill: "ZANTETSU" }],
  archbishop:  [{ lvl: 1, skill: "DIOS" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "BLESS" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "DIOSALL" }, { lvl: 15, skill: "DIAL" }, { lvl: 20, skill: "REVIVE" }, { lvl: 25, skill: "SAINTRAY" }, { lvl: 30, skill: "MADIOS" }, { lvl: 40, skill: "SEIKUNOKAGO" }, { lvl: 50, skill: "RESURRECT" }],
  ascetic:     [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "MIDARE" }, { lvl: 15, skill: "DIOSALL" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "DIAL" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "SHASHINNOGYOU" }, { lvl: 50, skill: "ZANTETSU" }],
  hero:        [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "HOLYRAY" }, { lvl: 7, skill: "BLESS" }, { lvl: 10, skill: "MIDARE" }, { lvl: 15, skill: "SAINTRAY" }, { lvl: 20, skill: "GUARDALL" }, { lvl: 25, skill: "REVIVE" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "SEIKEN" }, { lvl: 50, skill: "RESURRECT" }],
  asura:       [{ lvl: 1, skill: "KYOUGEKI" }, { lvl: 3, skill: "TATEWARI" }, { lvl: 5, skill: "DOUBLE" }, { lvl: 7, skill: "ASSASSINATE" }, { lvl: 10, skill: "NAGIHARAI" }, { lvl: 15, skill: "MIDARE" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "ISSEN" }, { lvl: 30, skill: "SENPUU" }, { lvl: 40, skill: "ASHURAZAN" }, { lvl: 50, skill: "ZANTETSU" }],
  dragonknight:[{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "PROTECT" }, { lvl: 5, skill: "KYOUGEKI" }, { lvl: 7, skill: "WARCRY" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "BOUJIN" }, { lvl: 20, skill: "GOUZAN" }, { lvl: 25, skill: "ISSEN" }, { lvl: 30, skill: "JOUMON" }, { lvl: 40, skill: "RYUZETSU" }, { lvl: 50, skill: "ZANTETSU" }],
  necromancer: [{ lvl: 1, skill: "BLIND" }, { lvl: 3, skill: "HALITO" }, { lvl: 5, skill: "KATINO" }, { lvl: 7, skill: "DIOS" }, { lvl: 10, skill: "MAHALITO" }, { lvl: 15, skill: "KAGENUI" }, { lvl: 20, skill: "DISPEL" }, { lvl: 25, skill: "MADALT" }, { lvl: 30, skill: "REVIVE" }, { lvl: 40, skill: "MEIKONGURAI" }, { lvl: 50, skill: "TILTOWAIT" }],
  sage:        [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "DIOS" }, { lvl: 5, skill: "ICENEEDLE" }, { lvl: 7, skill: "CURE" }, { lvl: 10, skill: "MAHALITO" }, { lvl: 15, skill: "DIOSALL" }, { lvl: 20, skill: "MADALT" }, { lvl: 25, skill: "REVIVE" }, { lvl: 30, skill: "LAHALITO" }, { lvl: 40, skill: "SHINRANOSABAKI" }, { lvl: 50, skill: "RESURRECT" }],
  cardinal:    [{ lvl: 1, skill: "DIOS" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "BLESS" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "DIOSALL" }, { lvl: 15, skill: "DIAL" }, { lvl: 20, skill: "REVIVE" }, { lvl: 25, skill: "DIALALL" }, { lvl: 30, skill: "MADIOS" }, { lvl: 40, skill: "DAISEIKITOU" }, { lvl: 50, skill: "RESURRECT" }],
  archmage:    [{ lvl: 1, skill: "HALITO" }, { lvl: 3, skill: "ICENEEDLE" }, { lvl: 5, skill: "KAMAITACHI" }, { lvl: 7, skill: "MAHALITO" }, { lvl: 10, skill: "ROCKBLAST" }, { lvl: 15, skill: "MADALT" }, { lvl: 20, skill: "LAHALITO" }, { lvl: 25, skill: "DISPEL" }, { lvl: 30, skill: "TILTOWAIT" }, { lvl: 40, skill: "SHINENNOHADOU" }, { lvl: 50, skill: "SEISAI" }],
  chaplain:    [{ lvl: 1, skill: "SHIELDBASH" }, { lvl: 3, skill: "CURE" }, { lvl: 5, skill: "PROTECT" }, { lvl: 7, skill: "HOLYRAY" }, { lvl: 10, skill: "IRONWALL" }, { lvl: 15, skill: "GUARDALL" }, { lvl: 20, skill: "BOUJIN" }, { lvl: 25, skill: "DIOSALL" }, { lvl: 30, skill: "JOUMON" }, { lvl: 40, skill: "HOUSHOUHEKI" }, { lvl: 50, skill: "OUJOU" }],
};

export function jobSkillTable(jobKey) { return JOB_SKILLS[jobKey] || []; }

// ===== 鑑定スキル (ウィザードリィ風) =====
// 知識・探索系の一部職業は、未鑑定の装備を自前で鑑定できる。ただし成功率は決して
// 100% にならず (上限95%)、失敗するとその品はスキルでは二度と鑑定できなくなる
// (idHardFail フラグが立ち、確実だが有料の商店鑑定に頼ることになる)。
// これにより「育てれば道中で無料鑑定できるが、確実さは商店が握る」という住み分けになる。
//   base: 基準成功率 / perLv: 魂レベル1ごとの上昇 / lvPenalty: 品のlv1ごとの低下
//   minLvl: 習得に必要な魂レベル / floor: 成功率の下限
export const IDENTIFY_JOBS = {
  bishop: { label: "鑑定",   minLvl: 1, base: 0.55, perLv: 0.015, lvPenalty: 0.004, floor: 0.10 }, // 本職: 高精度・高lv品にも強い
  sage:   { label: "看破",   minLvl: 1, base: 0.50, perLv: 0.020, lvPenalty: 0.003, floor: 0.10 }, // 上位: 育つほど万能
  thief:  { label: "目利き", minLvl: 5, base: 0.35, perLv: 0.010, lvPenalty: 0.008, floor: 0.05 }, // 簡易: 序盤の安物専門
};
export const IDENTIFY_CAP = 0.95; // どれだけ育てても 5% は失敗する
// clsKey の職業が魂レベル jobLv で 隠しレベル itemLv の品を鑑定できる確率 (0=不可)
export function identifyChance(clsKey, jobLv, itemLv) {
  const j = IDENTIFY_JOBS[clsKey];
  if (!j || (jobLv || 1) < j.minLvl) return 0;
  const c = j.base + ((jobLv || 1) - 1) * j.perLv - (itemLv || 1) * j.lvPenalty;
  return Math.max(j.floor, Math.min(IDENTIFY_CAP, c));
}
// このメンバーが鑑定スキルを使えるか (職業・習得レベルを満たすか)
export function canIdentify(member) {
  if (!member) return false;
  const j = IDENTIFY_JOBS[member.clsKey];
  return !!j && (member.jobLv || member.level || 1) >= j.minLvl;
}

// ===== 職業図鑑テキスト =====
export const JOB_LORE = {
  fighter:     { desc: "戦場の記憶を宿す魂。剣を握って生き、剣を握って死んだ者たちの執念が、人業の腕に力を与える。", tips: "高いATKとHPで前衛の軸となる。ランクが上がるほど連撃と闘魂が冴え、危機的状況で真価を発揮する。" },
  knight:      { desc: "守りの誓いを抱いたまま朽ちた騎士の魂。盾の重みを、誇りの重みとして覚えている。", tips: "随一のHPとVITで仲間の盾となる。挑発でダメージを引き受け、極まれば致死の一撃すら耐え抜く。" },
  priest:      { desc: "祈りの果てに神の沈黙を知った聖職者の魂。それでも祈ることをやめなかった者だけが、癒しの力を残す。", tips: "PIEが回復量を決める。聖者に至れば全滅の淵から一度だけ皆を引き戻す。" },
  mage:        { desc: "禁書とともに焼かれた魔術師の魂。灰の中でなお、呪文の韻だけは忘れなかった。", tips: "INTが攻撃呪文の威力を決める。MPの管理が肝要。エクスプロージョンで戦場ごと消し飛ばす。" },
  thief:       { desc: "影に生き、影に消えた者の魂。錠前と急所、そして逃げ道の在り処を知り尽くしている。", tips: "AGIとLUKで先手と会心を取る遊撃手。毒刃や急所突きで厄介な敵を素早く仕留める。" },
  bishop:      { desc: "魔と聖、二つの道を同時に究めようとした異端者の魂。教会は彼らを破門し、迷宮は彼らを歓迎した。", tips: "攻撃呪文と回復呪文を兼ね、一人で二役をこなす汎用後衛。" },
  samurai:     { desc: "刃を抜かず相手を制する異国の剣術家の魂。燕返しの型に、先手と追い手のすべてが宿る。", tips: "AGIと先制を高め、居合で口火を切る。燕返しが二度の閃きで確実に敵を断ち切る。" },
  berserker:   { desc: "剣ではなく狂気で戦う狂戦士の魂。血を見るたびに力が増す危うい存在。", tips: "HPが削れるほど闘魂が燃え上がりATKと会心が伸びる。反撃で被弾を火力に変える。" },
  hunter:      { desc: "野を駆けて獲物を追い詰めてきた狩人の魂。不意打ちと急所を熟知している。", tips: "先制時の会心と連撃で序盤に勝負をかける。AGIとLUKを高めるほど猟の精度が上がる。" },
  shadow:      { desc: "影に溶け、標的を確実に仕留める暗殺者の魂。一撃で仕留められなければ退く。", tips: "催眠と急所突きで相手を無力化してから刈り取る。高AGIで先手を確保するのが基本。" },
  paladin:     { desc: "仲間を守ることを誓いに生きた聖騎士の魂。盾と祈りを同時に持つ。", tips: "かばうと回復を一人で賄える稀有な前衛。殉教の祈りが最後の砦になる。" },
  guardian:    { desc: "難攻不落の城壁のごとき守護騎士の魂。攻めの手は持たず、守ることに特化する。", tips: "城壁の構えで隊全体の被ダメを減らし、反撃でわずかに返す。とにかく耐える前衛。" },
  spellblade:  { desc: "刃と呪文を同時に使いこなす魔法剣士の魂。どちらも半端ではない。", tips: "ATKとINTを両方育てて魔力撃の効果を最大化する。剣魔合一で会心をコントロール。" },
  monk:        { desc: "拳と祈りで戦い、己の道を極めた武僧の魂。打ち合うほど祈りが深まる。", tips: "回復もこなせる前衛。金剛連打で手数を稼ぎ、破邪で対魔戦に強い。" },
  hexer:       { desc: "毒と呪いを武器にする呪術師の魂。倒さず、蝕み、弱らせることを是とする。", tips: "毒霧で全体を蝕み、蠱毒で毒の敵への火力を伸ばす。硬い敵ほど毒が活きる。" },
  hermit:      { desc: "俗世を離れ、山奥で自らを鍛えた隠修士の魂。いざとなれば癒しも逃げ足も速い。", tips: "回復と隠行の両方を持つ低リスクの後衛。毒床耐性で危険地帯の踏破向き。" },
  brigand:     { desc: "盗むことで生計を立てながら、弱者に施していた義賊の魂。奪い続けることが強さ。", tips: "金運と追い剥ぎで稼ぎを2倍以上に。戦闘後の実入りを重視したい欲張りな選択。" },
  arcthief:    { desc: "呪文を盗むように操る魔盗賊の魂。先手の呪撃で隊の負担を減らす。", tips: "開幕呪撃で無消費の先手を取り、魔力強奪でMPを補いながら戦う持久型の術士。" },
  crusader:    { desc: "聖なる使命のために剣を握った聖戦士の魂。魔を祓い、その輝きが仲間の命を繋ぐ。", tips: "破邪で不死・幽鬼・悪魔に特効。聖光斬が敵を傷つけながら自分を癒す。" },
  battlemage:  { desc: "拳と法力を組み合わせた変わり者の魂。金剛身が術師との戦いを有利にする。", tips: "魔障壁と異常耐性で術師相手に崩れにくい。破魔の拳で敵の能力を削ぐ。" },
  darkknight:  { desc: "魔術理論を鎧に編み込んだ魔騎士の魂。障壁を盾に魔力をも喰らう。", tips: "魔障壁と魔力反射で呪文・ブレスを受けて返す。魔喰いの太刀でMPが自給する。" },
  templar:     { desc: "神殿を守護する誓いの騎士の魂。聖域の鐘が隊全体の穢れを払う。", tips: "聖域で隊全体に異常耐性を配れる。毒や麻痺をばらまく魔物の巣窟での守りの柱。" },
  exorcist:    { desc: "聖印を帯びた影の祓魔師の魂。神速で動き、光刃で不浄を斬る。", tips: "聖刃の会心で不死・幽鬼を狩る遊撃手。浄化で隊の状態異常も拭える。" },
  warden:      { desc: "守りの法陣を理論の極みまで磨き上げた護法師の魂。大結界が隊を包む。", tips: "大結界が全体攻撃を半減する。深層ボスの全体技を毎回削れるのは大きい。" },
  arcanist:    { desc: "禁断の秘術を収集し続けた秘術師の魂。消費を抑えた呪撃が会心の閃きを宿す。", tips: "呪文会心と省詠唱を両立した攻撃特化型。燃費よく、連戦でも火力が落ちない。" },
  inquisitor:  { desc: "断罪の祈りで暴力に神罰をもって応える審問官の魂。前衛に置ける回復役。", tips: "神罰の鉄槌が物理被弾時の反撃になる。かばうと組み合わせれば強固な前衛兼回復役。" },
  archbishop:  { desc: "瀕死でも味方を引き起こす聖典の加護を宿す大司教の魂。", tips: "聖句の加護で倒れた仲間を不屈付きで蘇生する。回復の専門家として深層での生存率を高める。" },
  ascetic:     { desc: "身を削ることで力を引き出す修験者の魂。捨身の行が窮地を打開する。", tips: "荒行の果てでHP30%以下の時に火力と回復量が上がる。捨身の行で自ら窮地に踏み込む型。" },
  hero:        { desc: "世界の試練に選ばれた者の魂。一人で全てを背負う覚悟が、仲間を生かし続ける。", tips: "隊全体の不屈と異常耐性で壁役を超えた守護者。聖剣奮迅で全体攻撃しながら仲間を癒す万能の柱。" },
  asura:       { desc: "戦いを止めることができなかった修羅の魂。攻撃こそが存在証明。", tips: "連撃と闘魂の二重強化で圧倒的な手数と火力を誇る。阿修羅斬で敵陣を蹂躙する。" },
  dragonknight:{ desc: "竜と盟約を結んだ竜騎士の魂。竜の力で守りを固め、一撃で山を砕く。", tips: "竜鱗の守りで魔・物理の両方に耐え、竜墜としで単体に甚大なダメージを叩き込む。" },
  necromancer: { desc: "死の理を学び、魂を食らうことで力に変える死霊術師の魂。", tips: "魂喰いで戦闘を重ねるほどMPが蓄積する。冥魂喰らいで吸収しながら戦う持久特化型。" },
  sage:        { desc: "魔と聖の両方の理を識り尽くした賢者の魂。属性の壁を超えた裁きを下す。", tips: "森羅万象で属性の不利が消える。どの迷宮でも呪文が安定し、攻守を一人で完結させる。" },
  cardinal:    { desc: "教団の頂から全ての命を見守る枢機卿の魂。その祈りは隊員全員に注がれる。", tips: "教皇の祈りで自分の戦闘後回復を全員に広げる。大聖祈祷で回復と浄化を同時に行う。" },
  archmage:    { desc: "深淵の知識に到達した大魔導の魂。その波動は破壊の理そのもの。", tips: "深淵の理で燃費と弱点看破を両立した呪文砲台。深淵の波動で単体を粉砕する。" },
  chaplain:    { desc: "教えを守るために武装した護教官の魂。法障壁が全ての攻撃を防ぐ。", tips: "聖盾でブレスや呪文まで肩代わりできる。法障壁で隊全体に魔障壁を配る究極の守護聖職者。" },
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
  if (rank <= 1) return `${cls.label}の魂を1つ吸収する`;
  return `${cls.label}の魂を累計 ${t[rank - 1]}個 吸収する`;
}

// 後方互換: ハイブリッド関連 (廃止済みだが import で参照される箇所のため空で残す)
export const HYBRIDS = {};
export function findHybrid() { return null; }

// ===== 職業ギアマトリクス =====
// weapons: 使用可能な武器カテゴリキー (items.js の WEAPON_CATS と同値)
// armor: 装備可能な防具重量の上限 ("heavy"|"light"|"cloth")
// shield: 盾を装備できるか
export const JOB_GEAR = {
  fighter:     { weapons: ["ls","ax","mc","sp","dg"],            armor: "heavy", shield: true  },
  knight:      { weapons: ["ls","mc","sp"],                      armor: "heavy", shield: true  },
  priest:      { weapons: ["mc","st"],                           armor: "light", shield: false },
  mage:        { weapons: ["st","dg"],                           armor: "cloth", shield: false },
  thief:       { weapons: ["dg","bw","ls","sp"],                 armor: "light", shield: false },
  bishop:      { weapons: ["st","mc"],                           armor: "cloth", shield: false },
  samurai:     { weapons: ["kt","ls"],                           armor: "light", shield: false },
  berserker:   { weapons: ["ax","mc","ls","sp"],                 armor: "heavy", shield: false },
  hunter:      { weapons: ["bw","dg","sp"],                      armor: "light", shield: false },
  shadow:      { weapons: ["dg","bw"],                           armor: "light", shield: false },
  paladin:     { weapons: ["ls","mc","sp"],                      armor: "heavy", shield: true  },
  guardian:    { weapons: ["mc","sp","ls"],                      armor: "heavy", shield: true  },
  spellblade:  { weapons: ["kt","ls","st","dg"],                 armor: "light", shield: false },
  monk:        { weapons: ["mc","st","sp"],                      armor: "light", shield: false },
  hexer:       { weapons: ["st","dg"],                           armor: "cloth", shield: false },
  hermit:      { weapons: ["st","mc"],                           armor: "cloth", shield: false },
  brigand:     { weapons: ["dg","bw","ls"],                      armor: "light", shield: false },
  arcthief:    { weapons: ["dg","st","bw"],                      armor: "cloth", shield: false },
  crusader:    { weapons: ["ls","mc","sp","ax"],                 armor: "heavy", shield: true  },
  battlemage:  { weapons: ["ls","ax","st"],                      armor: "heavy", shield: false },
  darkknight:  { weapons: ["ls","ax","mc"],                      armor: "heavy", shield: true  },
  templar:     { weapons: ["mc","ls","sp"],                      armor: "heavy", shield: true  },
  exorcist:    { weapons: ["dg","mc","st"],                      armor: "light", shield: false },
  warden:      { weapons: ["st","mc"],                           armor: "light", shield: false },
  arcanist:    { weapons: ["st","dg"],                           armor: "cloth", shield: false },
  inquisitor:  { weapons: ["mc","ls"],                           armor: "heavy", shield: false },
  archbishop:  { weapons: ["st","mc"],                           armor: "cloth", shield: false },
  ascetic:     { weapons: ["mc","st","ax"],                      armor: "light", shield: false },
  hero:        { weapons: ["ls","kt","mc","sp","ax","dg","st","bw"], armor: "heavy", shield: true },
  asura:       { weapons: ["ls","ax","mc","sp","dg"],            armor: "heavy", shield: false },
  dragonknight:{ weapons: ["ls","sp","ax"],                      armor: "heavy", shield: true  },
  necromancer: { weapons: ["st","dg"],                           armor: "cloth", shield: false },
  sage:        { weapons: ["st","dg","mc"],                      armor: "cloth", shield: false },
  cardinal:    { weapons: ["st","mc"],                           armor: "cloth", shield: false },
  archmage:    { weapons: ["st","dg"],                           armor: "cloth", shield: false },
  chaplain:    { weapons: ["mc","ls","sp"],                      armor: "heavy", shield: true  },
};

// 職業ギアマトリクスを items.js に注入 (循環 import 回避のため遅延バインディング)
registerJobGear(JOB_GEAR);


// ===== 属性・ステータス定義 =====
export const ATTR_KEYS = ["atk", "vit", "agi", "int", "pie", "luk"];
export const ATTR_LABEL = { atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
export const ATTR_NAME  = { atk: "攻撃力", vit: "体力 (被ダメージ軽減)", agi: "敏捷 (行動順・回避)", int: "知力 (攻撃呪文の威力)", pie: "信仰 (回復呪文の威力)", luk: "幸運 (会心率)" };

// ===== 魂 生成・ステータス =====
let _soulUid = 0;

export function makeSoul(clsKey, level = 1, part = null, rank = 1) {
  if (!SOUL_CLASSES[clsKey]) return null;
  if (!part) part = PARTS[Math.floor(Math.random() * PARTS.length)];
  rank = Math.max(1, Math.min(5, parseInt(rank) || 1));
  const cap = SOUL_RANKS[rank].cap;
  return { uid: ++_soulUid, clsKey, part, rank, level: Math.min(Math.max(1, level), cap), cap };
}

export function ensureSoul(s) {
  if (!s) return s;
  // 旧セーブ: rankが文字列なら数値に変換 (normal→1, fine→2, great→3, legend→5)
  if (typeof s.rank === "string") {
    s.rank = ({ normal: 1, fine: 2, great: 3, legend: 5 }[s.rank] || 1);
  }
  s.rank = Math.max(1, Math.min(5, parseInt(s.rank) || 1));
  s.cap = SOUL_RANKS[s.rank].cap;
  if (s.level == null) s.level = 1;
  if (s.level > s.cap) s.level = s.cap;
  return s;
}

// 後方互換: limit-breakthrough は廃止 (cap を超えない)
export function soulHardCap(s) { return SOUL_RANKS[s.rank] ? SOUL_RANKS[s.rank].cap : 10; }

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
// subs (宿し技スロット: 別職の看板スキルだけを借りる、最大 MAX_SUBS 個) を持つ。
let _dollUid = 0;
export const MAX_SUBS = 2;

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
  const rank = soulRankFromCount(s.clsKey, s.count);
  const effLv = Math.min(s.level || 1, rank * 10);
  const out = [];
  for (const t of jobSkillTable(s.clsKey)) if (effLv >= t.lvl && !out.includes(t.skill)) out.push(t.skill);
  return out;
}

export function makeDoll(name) {
  return {
    uid: ++_dollUid, name, isDoll: true,
    primary: null,   // 宿しているメイン魂の uid (祭壇で付け替え)
    subs: [],        // サブ魂スロット: {uid, skill} の配列 (最大 MAX_SUBS)。skill = 借りる技
    clsKey: "fighter", cls: "空の人業", level: 1,
    hp: 1, maxhp: 1, mp: 0, maxmp: 0,
    atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0,
    base: { hp: 1, mp: 0, atk: 0, vit: 0, agi: 1, int: 0, pie: 0, luk: 0 },
    equip: { weapon: null, body: null, shield: null, head: null, hands: null, feet: null, acc1: null, acc2: null },
    items: [], ailment: null, spells: [], passives: [], alive: true, side: "party",
  };
}

// 所持数に応じた魂レベル上限 (ランクが上がるほど伸びる)
export function soulLevelCap(clsKey, count) {
  const r = soulRankFromCount(clsKey, count);
  return (SOUL_RANKS[r] || SOUL_RANKS[1]).cap;
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
// 各職の「看板スキル」= 職業スキル表のLv40固有技。宿しスロットに別職の魂を差すと、
// その看板スキルを借りられる (ステータスは乗らない)。共有ランク2以上で技を、
// ランク4以上でその職のランク2パッシブも借りられる。
export const JOB_SIGNATURE = (() => {
  const out = {};
  for (const k of SOUL_KEYS) {
    const tbl = JOB_SKILLS[k] || [];
    const sig = tbl.find((e) => e.lvl === 40) || tbl[tbl.length - 1];
    if (sig) out[k] = sig.skill;
  }
  return out;
})();
export function signatureSkillOf(clsKey) { return JOB_SIGNATURE[clsKey] || null; }

// ===== 控えの結社 (ベンチの加護) =====
// 編成に出していない (primary/sub いずれにも使っていない) 魂は「結社」として
// 職業テーマ別のパーティ全体パッシブを供給する。共有ランク2以上で Lv1、ランク4以上で Lv2。
// 効果は game.js 側で読むパーティ範囲パッシブ (財宝/金運/魂寄せ/感知/警戒/先制/毒床) に限定する。
export const ORDER_PERK = {
  fighter: "vigilance", knight: "vigilance", priest: "poisonFloor", mage: "senseEnemy", thief: "goldLuck", bishop: "soulLure",
  samurai: "initiative", berserker: "vigilance", hunter: "senseTreasure", shadow: "vigilance", paladin: "poisonFloor",
  guardian: "vigilance", spellblade: "senseEnemy", monk: "poisonFloor", hexer: "appraise", hermit: "poisonFloor",
  brigand: "goldLuck", arcthief: "goldLuck",
  crusader: "initiative", battlemage: "senseEnemy", darkknight: "vigilance", templar: "poisonFloor", exorcist: "senseTreasure",
  warden: "senseEnemy", arcanist: "soulLure", inquisitor: "appraise", archbishop: "soulLure", ascetic: "poisonFloor",
  hero: "initiative", asura: "vigilance", dragonknight: "vigilance", necromancer: "soulLure", sage: "senseEnemy",
  cardinal: "soulLure", archmage: "senseEnemy", chaplain: "poisonFloor",
};
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
// 結社が供給するパーティパッシブ {passiveKey: lv}。編成に出していないランク2以上の魂が対象
export function orderPassiveMap(party) {
  const fielded = fieldedSoulUids(party);
  const map = {};
  for (const s of SOULS) {
    if (!s || fielded.has(s.uid)) continue;
    const rank = soulRankFromCount(s.clsKey, s.count);
    if (rank < 2) continue;
    const perk = ORDER_PERK[s.clsKey];
    if (!perk || !PASSIVES[perk]) continue;
    const lvMax = PASSIVES[perk].lv.length;
    const lv = Math.min(lvMax, rank >= 4 ? 2 : 1);
    map[perk] = Math.max(map[perk] || 0, lv);
  }
  return map;
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
// サブ魂 (subs) が選んだスキルを1つ借りる。進行は所持魂インスタンス (SOULS) が持つ。
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
    // スキルは魂レベルで習得 (ランク×10 が解放上限。ランクアップで先のスキルが見える)
    const effLv = Math.min(pe.level, rank * 10);
    for (const t of jobSkillTable(clsKey)) {
      if (effLv >= t.lvl && !spells.includes(t.skill)) spells.push(t.skill);
    }
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

  // サブ魂: その魂が覚えているスキルから1つ (doll が設定) を借りる。ステ・パッシブは乗らない
  doll.subInfo = [];
  for (const sub of doll.subs) {
    const se = sub ? soulByUid(sub.uid) : null;
    if (!se) continue;
    const sr = soulRankFromCount(se.clsKey, se.count);
    const learned = soulLearnedSkills(se);
    let chosen = sub.skill;
    if (!chosen || !learned.includes(chosen)) { chosen = learned.length ? learned[learned.length - 1] : null; sub.skill = chosen; }
    if (chosen && !spells.includes(chosen)) spells.push(chosen);
    doll.subInfo.push({ uid: se.uid, clsKey: se.clsKey, rank: sr, level: se.level, skill: chosen });
  }

  doll.passiveMap = passiveMap;
  doll.tier = rank ? "rank" + rank : "none";
  doll.dominant = clsKey ? { clsKey, count: pe.count, maxLevel: pe.level } : null;
  doll.endure = (passiveMap.endure || 0) > 0;
  doll.level = doll.jobLv || 1;

  doll.base = {
    hp: Math.max(1, Math.round(st.hp)), mp: Math.round(st.mp),
    atk: Math.round(st.atk), vit: Math.round(st.vit), agi: Math.max(1, Math.round(st.agi)),
    int: Math.round(st.int), pie: Math.round(st.pie), luk: Math.round(st.luk),
    crit: 0,
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
  const cap = SOUL_RANKS[s1.rank] ? SOUL_RANKS[s1.rank].cap : 10;
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
//   4 = 瞳が灯り淡いオーラを纏う / 5 = 冠・光輪を戴き強いオーラを放つ。
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
  // 暗殺者: 平笠の下の光る目、脚のない影の外套と提灯杖
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
  // 魔法剣士: 焔を纏う魔剣を左手に、肩掛けの外套
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
  // 義賊: 鉢巻きと翻る外套、金袋
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
  // 大司教: 高く聳える宝冠と曲頭杖
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
  // 竜騎士: 竜角の兜と軍旗の長槍、翼の外套
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
  // ランク4+: 輪郭の外側1ドットにオーラを纏う。
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

// 人業の顔アイコン: 発現中の職業と職業ランクの姿。未発現は支配職のランク1
export function dollSprite(d) {
  const key = d.jobKey || (d.dominant && d.dominant.clsKey) || d.clsKey || "fighter";
  return jobSprite(key, d.jobRank || 1);
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
