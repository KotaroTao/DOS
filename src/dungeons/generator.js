// 迷宮生成器: 全100迷宮の設定を番号 n (1-100) から決定的に生成する。
// ・ランク r = ceil(n/10)。10迷宮ごとに敵ランク帯が1段上がる
// ・帯内の進行は enemyScale (0.7→1.7) が受け持ち、ランク境界の段差を均す
// ・報酬系 (lootLv / rankBonus / soulLevelBonus) は n の連続関数。
//   rankBonus は対数で伸ばし、最深部でも伝説の魂が「稀」であり続けるようにする
import { RANK_POOLS } from "./bestiary.js";

export const DUNGEON_COUNT = 100;

// 名前テーブル: 形容 (帯内の位置で回る) × 場 (ランクごと)
const ADJ = ["忘れられた", "朽ち果てた", "血塗られた", "囁きの", "凍てつく", "燃え盛る", "底知れぬ", "呪われた", "黄昏の", "終末の"];
const PLACE = ["地下墓地", "古坑道", "捨て砦", "霧の森", "沈んだ神殿", "灼熱の洞", "氷結の回廊", "嵐の尖塔", "冥府の門", "竜の玄室"];
const SHORT = ["墓地", "坑道", "砦", "森", "神殿", "灼洞", "氷廊", "尖塔", "冥門", "玄室"];

// n から決定的に並びを崩すための擬似乱数 (生成のたびに変わらないこと)
function hash(n, salt) {
  let h = (n * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; h ^= h >>> 16;
  return h;
}
// 配列から k 体を重複なく決定的に選ぶ
function pick(list, n, salt, k) {
  const out = [];
  const src = [...list];
  for (let i = 0; i < k && src.length; i++) out.push(src.splice(hash(n, salt + i) % src.length, 1)[0]);
  return out;
}

export function generateDungeon(n) {
  const r = Math.min(10, Math.ceil(n / 10));    // 敵ランク帯 (1-10)
  const pos = ((n - 1) % 10) / 9;               // 帯内の進行度 0→1
  const cur = RANK_POOLS[r];
  const next = RANK_POOLS[Math.min(10, r + 1)];

  // 浅層は当該ランクから、深層は帯後半なら一段上のランクを1体混ぜる
  const pool = pick(cur.regular, n, 11, Math.min(3, cur.regular.length));
  const deep = pick(cur.regular, n, 37, Math.min(2, cur.regular.length));
  if (pos > 0.5 && r < 10) deep.push(pick(next.regular, n, 53, 1)[0]);
  else deep.push(pick(cur.regular, n, 53, 1)[0]);

  // 迷宮の属性気配: 約2/3の迷宮はいずれかの属性を帯び、その属性の敵が出やすい。
  // 属性攻撃/防御の装備を迷宮に合わせて組み替える動機になる
  const ELS = ["fire", "water", "wind", "earth", "light", "dark"];
  const element = n % 3 === 0 ? null : ELS[(hash(n, 91) >>> 0) % ELS.length]; // hash は最終XORで負になりうる

  return {
    id: "g" + String(n).padStart(3, "0"),
    name: ADJ[(n - 1) % 10] + PLACE[r - 1],
    short: SHORT[r - 1] + ((n - 1) % 10 + 1),
    rank: r,
    element,
    floors: Math.min(12, 3 + Math.floor((n - 1) / 9)),
    pool,
    deepPool: deep,
    boss: cur.boss[hash(n, 71) % cur.boss.length],
    bossScale: 1.0,
    enemyScale: Math.round((0.7 + pos) * 100) / 100,
    trapRate: Math.min(0.25, 0.04 + n * 0.002),
    warmChance: Math.min(0.7, 0.38 + n * 0.0032),
    // 魂: レベル下駄は √n で緩やかに、レアランク補正は対数で (最深部でも伝説≒3.6%)
    soulLevelBonus: Math.floor((Math.sqrt(n) - 1) * 1.6),
    rankBonus: Math.round(1.15 * Math.log2(1 + n / 2) * 100) / 100,
    // アイテム: 隠しレベル帯 (入口→最深部)。n=100 で 150-200 (神話級の帯)
    lootLv: [Math.max(1, Math.round(n * 1.5)), Math.min(200, Math.round(n * 2))],
    lootTier: Math.ceil(n / 10),
  };
}

export const DUNGEONS = Array.from({ length: DUNGEON_COUNT }, (_, i) => generateDungeon(i + 1));
