// ダンジョン2「朽ちた城砦」rank2 — 兵の亡霊と魔物が巣食う城。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d02_armkobold", name: "鎧コボルド", race: "humanoid", artKey: "kobold", rank: 2,
    palette: tint(ARTS.kobold.palette, "#9aa3ab", 0.35),
    hp: 26, atk: 12, def: 6, spd: 6, exp: 18, gold: 14, soulClass: "fighter",
    desc: "拾い集めた鎧で身を固めたコボルド。城砦に居着き、隊列を組んで戦う。" },
  { id: "d02_soldier", name: "朽ちた兵士", race: "undead", artKey: "skeleton", rank: 2,
    palette: tint(ARTS.skeleton.palette, "#5a5f7a", 0.3),
    hp: 30, atk: 13, def: 6, spd: 6, exp: 22, gold: 16, soulClass: "thief",
    desc: "城を守れず散った兵の亡骸。命令も忘れ、ただ剣を振り続ける不死者。" },
  { id: "d02_harpy", name: "城砦のハーピー", race: "avian", artKey: "harpy", rank: 2,
    hp: 24, atk: 13, def: 4, spd: 11, exp: 20, gold: 15,
    desc: "崩れた塔に巣くう女面鳥身の魔物。甲高い声で急降下し、爪で引き裂く。" },
  { id: "d02_imp", name: "小悪魔", race: "demon", artKey: "imp", rank: 2,
    hp: 22, atk: 12, def: 4, spd: 11, exp: 19, gold: 13,
    desc: "城に取り憑いた下級の悪魔。狡猾に立ち回り、人を惑わす。" },
  { id: "d02_lizard", name: "城砦の蜥蜴", race: "reptile", artKey: "lizard", rank: 3,
    hp: 34, atk: 14, def: 8, spd: 6, exp: 26, gold: 18,
    desc: "石壁の隙間に潜む硬鱗の爬虫。冷たい城の闇で獲物を待ち伏せる。" },
  { id: "d02_lord", name: "城主の亡霊", race: "specter", artKey: "wraith", rank: 3, boss: true,
    palette: tint(ARTS.wraith.palette, "#9b59b6", 0.3),
    hp: 130, atk: 20, def: 9, spd: 9, exp: 140, gold: 180, soulClass: "mage",
    desc: "城と運命を共にした領主の成れの果て。怨念をまとい、玉座の間を彷徨う幽鬼。" },
]);

export const dungeon = {
  id: "d02", name: "朽ちた城砦", short: "城砦", rank: 2, floors: 5,
  pool: ["d02_armkobold", "cm_bat", "d02_soldier", "d02_harpy"],
  deepPool: ["d02_soldier", "d02_imp", "d02_lizard"],
  boss: "d02_lord", bossScale: 1.0, enemyScale: 1.3,
  trapRate: 0.10, warmChance: 0.42, soulLevelBonus: 1, rankBonus: 0.6, lootTier: 1,
};
