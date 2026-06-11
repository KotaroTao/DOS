// ダンジョン4「竜の墓所」rank4 — 古竜の眠る最深の墓所。現状の最終ダンジョン。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d04_golem", name: "墓守ゴーレム", race: "construct", artKey: "golem", rank: 4,
    hp: 90, atk: 18, def: 18, spd: 2, exp: 50, gold: 40,
    desc: "墓所を守るために造られた石の番人。鈍重だが、その一撃は石棺を砕く構造体。" },
  { id: "d04_ogre", name: "墓所の巨人", race: "giant", artKey: "ogre", rank: 4,
    hp: 96, atk: 22, def: 10, spd: 4, exp: 54, gold: 46,
    desc: "骸を漁る人喰いの巨人。墓を暴き、近づく者を棍棒で叩き潰す。" },
  { id: "d04_revenant", name: "亡霊騎士", race: "armored", artKey: "knightmare", rank: 5,
    palette: tint(ARTS.knightmare.palette, "#5fb8d6", 0.3),
    hp: 110, atk: 24, def: 16, spd: 7, exp: 70, gold: 56, soulClass: "knight",
    desc: "竜に挑み、敗れた騎士の鎧。死してなお誇りを捨てず、墓所をさまよう。" },
  { id: "d04_grudge", name: "墓所の怨霊", race: "specter", artKey: "wraith", rank: 5,
    palette: tint(ARTS.wraith.palette, "#6a4a8a", 0.4),
    hp: 100, atk: 23, def: 12, spd: 11, exp: 66, gold: 52, soulClass: "mage",
    desc: "竜の宝に取り憑かれ、死しても離れられぬ亡者。濃い瘴気をまとう幽鬼。" },
  { id: "d04_vritra", name: "古竜ヴリトラ", race: "dragon", artKey: "dragon", rank: 6, boss: true,
    palette: tint(ARTS.dragon.palette, "#ffd24a", 0.25),
    hp: 420, atk: 34, def: 16, spd: 10, exp: 900, gold: 1200,
    desc: "墓所の最奥で眠る黄金の古竜。幾多の英雄を屠ってきた、災厄そのものの存在。" },
]);

export const dungeon = {
  id: "d04", name: "竜の墓所", short: "墓所", rank: 4, floors: 9,
  pool: ["d04_golem", "d04_ogre", "d03_sentinel"],
  deepPool: ["d04_revenant", "d04_grudge", "d04_ogre"],
  boss: "d04_vritra", bossScale: 1.0, enemyScale: 2.4,
  trapRate: 0.14, warmChance: 0.5, soulLevelBonus: 3, rankBonus: 1.8, lootTier: 3,
};
