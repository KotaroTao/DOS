// ダンジョン1「忘れられた地下牢」rank1 — 序盤の入門ダンジョン。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d01_kobold", name: "コボルド", race: "humanoid", element: "none", artKey: "kobold", rank: 1,
    hp: 18, atk: 9, def: 3, spd: 6, soul: 11, gold: 9, soulClass: "fighter",
    ability: "goldSteal", pack: true, // 遺品漁りの手癖 + 数を頼む群れ
    desc: "犬の頭を持つ小鬼。打ち捨てられた牢を住処とし、囚人の遺品を漁って身を飾る。一匹では臆病だが、数を頼みに群れて錆びた得物を振り回し、隙あらば懐の金品をくすねる。" },
  { id: "d01_skeleton", name: "囚人の亡骸", race: "undead", element: "dark", artKey: "skeleton", rank: 2,
    hp: 22, atk: 11, def: 4, spd: 7, soul: 16, gold: 12, soulClass: "thief",
    magWeak: 1.5, // 朽ちて脆い骨は魔法の一撃で砕ける
    desc: "裁きも赦しも無いまま牢で朽ち果てた者の骨。残った怨みだけが関節を軋ませ、出口を求めて鉄格子を掻きむしり続ける。その虚ろな眼窩は、近づく生者を看守と取り違えて襲いかかる。風化した骨は脆く、魔法の一撃で容易く砕け散る。" },
  { id: "d01_gaoler", name: "牢番オーク", race: "humanoid", element: "earth", artKey: "orc", rank: 2, boss: true,
    palette: tint(ARTS.orc.palette, "#3a2a1a", 0.2),
    hp: 70, atk: 16, def: 7, spd: 5, soul: 60, gold: 80, soulClass: "knight",
    desc: "主が去った後も、ただ「番をする」という命令だけを忠実に守り続ける巨漢のオーク。錆びた大鍵を棍棒のように振るい、逃げ出そうとする者を骨ごと砕く。牢の主は、とうの昔にこいつ自身になっていた。" },
]);

export const dungeon = {
  id: "d01", name: "忘れられた地下牢", short: "地下牢", rank: 1, floors: 3,
  pool: ["cm_slime", "cm_bat", "d01_kobold"],
  deepPool: ["d01_kobold", "cm_caverat", "d01_skeleton"],
  boss: "d01_gaoler", bossScale: 1.0, enemyScale: 0.8,
  trapRate: 0.05, warmChance: 0.4, soulLevelBonus: 0, rankBonus: 0, lootTier: 0,
  lootLv: [1, 9], // 出現アイテムの隠しレベル帯 (入口→最深部)
};
