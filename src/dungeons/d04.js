// ダンジョン4「竜の墓所」rank4 — 古竜の眠る最深の墓所。現状の最終ダンジョン。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d04_golem", name: "墓守ゴーレム", race: "construct", element: "earth", artKey: "golem", rank: 4,
    hp: 90, atk: 18, def: 18, spd: 2, exp: 50, gold: 40,
    desc: "古竜の眠りを守るため、墓所の石材そのものから彫り出された番人。命じた術者はとうに塵となったが、その指は今も「荒らす者を砕け」という最初の一文を律儀になぞる。一打ごとに床が陥み、塵が舞う。" },
  { id: "d04_ogre", name: "墓所の巨人", race: "giant", element: "none", artKey: "ogre", rank: 4,
    hp: 96, atk: 22, def: 10, spd: 4, exp: 54, gold: 46,
    desc: "墓を暴いて骸を喰らううち、屍肉の魔力で異形に肥え太った人喰い鬼。供物のつもりか、棍棒で叩き潰した獲物を古竜の墓前へ並べる悪癖を持つ。足音だけで石棺の蓋が震えるという。" },
  { id: "d04_revenant", name: "亡霊騎士", race: "armored", element: "light", artKey: "knightmare", rank: 5,
    palette: tint(ARTS.knightmare.palette, "#5fb8d6", 0.3),
    hp: 110, atk: 24, def: 16, spd: 7, exp: 70, gold: 56, soulClass: "knight",
    desc: "古竜に挑み、誇り高く敗れた騎士の鎧。死してなお誓いを捨てず、後から来る挑戦者を「竜にふさわしき者か」と試すように斬りかかる。砕けた兜の奥で、贖いを求める弱い光が今も明滅している。" },
  { id: "d04_grudge", name: "墓所の怨霊", race: "specter", element: "dark", artKey: "wraith", rank: 5,
    palette: tint(ARTS.wraith.palette, "#6a4a8a", 0.4),
    hp: 100, atk: 23, def: 12, spd: 11, exp: 66, gold: 52, soulClass: "mage",
    desc: "古竜の財宝に魅入られ、手を伸ばしたまま息絶えた盗掘者たちの妄執が、幾重にも凝り固まった黒い靄。黄金への渇望だけが残り、近づく生者を「宝を奪う敵」と見て呪詛を浴びせる。" },
  { id: "d04_vritra", name: "古竜ヴリトラ", race: "dragon", element: "dark", artKey: "dragon", rank: 6, boss: true,
    palette: tint(ARTS.dragon.palette, "#ffd24a", 0.25),
    hp: 420, atk: 34, def: 16, spd: 10, exp: 900, gold: 1200,
    desc: "墓所の最奥、累々たる英雄の骸を褥に眠る黄金の古竜。幾百年を生き、挑む者すべてを呑み込んできた災厄そのもの。その眼が薄く開いたとき、貴公はようやく悟る——ここは竜の墓ではなく、竜に捧げられた墓場なのだと。" },
]);

export const dungeon = {
  id: "d04", name: "竜の墓所", short: "墓所", rank: 4, floors: 9,
  pool: ["d04_golem", "d04_ogre", "d03_sentinel"],
  deepPool: ["d04_revenant", "d04_grudge", "d04_ogre"],
  boss: "d04_vritra", bossScale: 1.0, enemyScale: 2.4,
  trapRate: 0.14, warmChance: 0.5, soulLevelBonus: 3, rankBonus: 1.8, lootTier: 3,
};
