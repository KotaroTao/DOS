// ダンジョン1「忘れられた地下牢」rank1 — 序盤の入門ダンジョン。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d01_kobold", name: "コボルド", race: "humanoid", artKey: "kobold", rank: 1,
    hp: 18, atk: 9, def: 3, spd: 6, exp: 11, gold: 9, soulClass: "fighter",
    desc: "犬頭の小鬼。粗末な得物を手に、群れで縄張りを守る亜人。" },
  { id: "d01_skeleton", name: "囚人の亡骸", race: "undead", artKey: "skeleton", rank: 2,
    hp: 22, atk: 11, def: 4, spd: 7, exp: 16, gold: 12, soulClass: "thief",
    desc: "牢で朽ち果てた囚人の骨。怨念に動かされ、なお脱獄を試みる不死者。" },
  { id: "d01_gaoler", name: "牢番オーク", race: "humanoid", artKey: "orc", rank: 2, boss: true,
    palette: tint(ARTS.orc.palette, "#3a2a1a", 0.2),
    hp: 70, atk: 16, def: 7, spd: 5, exp: 60, gold: 80, soulClass: "knight",
    desc: "地下牢を統べる巨漢のオーク。錆びた大鍵と棍棒で侵入者を叩き伏せる。" },
]);

export const dungeon = {
  id: "d01", name: "忘れられた地下牢", short: "地下牢", rank: 1, floors: 3,
  pool: ["cm_slime", "cm_bat", "d01_kobold"],
  deepPool: ["d01_kobold", "cm_caverat", "d01_skeleton"],
  boss: "d01_gaoler", bossScale: 1.0, enemyScale: 0.8,
  trapRate: 0.05, warmChance: 0.4, soulLevelBonus: 0, rankBonus: 0, lootTier: 0,
};
