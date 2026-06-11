// ダンジョン3「奈落の回廊」rank3 — 深淵に通じる回廊。幼竜が眠る。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d03_orc", name: "奈落のオーク", race: "humanoid", artKey: "orc", rank: 3,
    hp: 44, atk: 16, def: 8, spd: 5, exp: 34, gold: 26, soulClass: "knight",
    desc: "深淵の瘴気で凶暴化した大型のオーク。岩塊のような拳で殴りかかる。" },
  { id: "d03_ghost", name: "彷徨う亡霊", race: "specter", artKey: "ghost", rank: 3,
    hp: 38, atk: 15, def: 6, spd: 10, exp: 30, gold: 22,
    desc: "回廊に取り残された魂。生者の温もりを求めて音もなく漂う幽鬼。" },
  { id: "d03_sahagin", name: "深淵のサハギン", race: "aquatic", artKey: "sahagin", rank: 3,
    hp: 42, atk: 16, def: 8, spd: 8, exp: 33, gold: 24,
    desc: "地底湖に潜む半魚人。銛を構え、群れで岸辺の獲物を狙う水棲種。" },
  { id: "d03_mandrake", name: "毒マンドレイク", race: "plant", artKey: "mandrake", rank: 4,
    hp: 52, atk: 17, def: 9, spd: 4, exp: 40, gold: 30,
    desc: "瘴気を糧に育った人型の植物。引き抜かれると絶叫し、毒の胞子を撒く。" },
  { id: "d03_sentinel", name: "無人の甲冑", race: "armored", artKey: "knightmare", rank: 4,
    hp: 60, atk: 19, def: 12, spd: 6, exp: 46, gold: 34, soulClass: "knight",
    desc: "主を失い、回廊を守り続ける鎧。中身は空だが、剣技だけが忠実に残る機鎧。" },
  { id: "d03_whelp", name: "奈落の幼竜", race: "dragon", artKey: "dragon", rank: 4, boss: true,
    palette: tint(ARTS.dragon.palette, "#3a8a3a", 0.35),
    hp: 220, atk: 26, def: 12, spd: 9, exp: 320, gold: 360,
    desc: "深淵で孵った若き竜。未熟ながら、その吐息は回廊を焼き尽くす。" },
]);

export const dungeon = {
  id: "d03", name: "奈落の回廊", short: "奈落", rank: 3, floors: 7,
  pool: ["d03_orc", "d03_ghost", "d03_sahagin"],
  deepPool: ["d03_mandrake", "d03_sentinel", "d03_orc"],
  boss: "d03_whelp", bossScale: 1.0, enemyScale: 1.7,
  trapRate: 0.12, warmChance: 0.45, soulLevelBonus: 2, rankBonus: 1.2, lootTier: 2,
};
