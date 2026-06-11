// ダンジョン3「奈落の回廊」rank3 — 深淵に通じる回廊。幼竜が眠る。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d03_orc", name: "奈落のオーク", race: "humanoid", element: "earth", artKey: "orc", rank: 3,
    hp: 44, atk: 16, def: 8, spd: 5, soul: 34, gold: 26, soulClass: "knight",
    desc: "深淵から立ち昇る瘴気を浴び、肉も殺意も常軌を逸して膨れ上がった大型のオーク。岩塊のような拳の一打で鎧ごと胸郭を陥没させる。痛覚はとうに焼き切れ、四肢を失ってなお這い寄って噛みつく。" },
  { id: "d03_ghost", name: "彷徨う亡霊", race: "specter", element: "dark", artKey: "ghost", rank: 3,
    hp: 38, atk: 15, def: 6, spd: 10, soul: 30, gold: 22,
    desc: "回廊で力尽き、骸さえ見つけてもらえなかった者の魂。生者の体温に飢え、音もなく背後へ回り込んでは冷たい指を肋の隙間へ差し入れる。触れられた箇所から熱が奪われ、心の臓が凍てついていく。" },
  { id: "d03_sahagin", name: "深淵のサハギン", race: "aquatic", element: "water", artKey: "sahagin", rank: 3,
    hp: 42, atk: 16, def: 8, spd: 8, soul: 33, gold: 24,
    desc: "陽の射さぬ地底湖に棲む半魚人。退化した眼の代わりに水の震えで獲物を捉え、骨を削った銛を手に群れで岸辺を囲う。捕えた獲物は湖底の祭壇へ引きずり込み、見たこともない深きものへ捧げる。" },
  { id: "d03_mandrake", name: "毒マンドレイク", race: "plant", element: "earth", artKey: "mandrake", rank: 4,
    hp: 52, atk: 17, def: 9, spd: 4, soul: 40, gold: 30,
    desc: "屍を養分に、人の形を真似て育った歩く毒草。引き抜かれると断末魔の絶叫を放ち、聞いた者の正気を削る。根から撒かれる紫の胞子は肺を腐らせ、やがてその体内が次の苗床になる。" },
  { id: "d03_sentinel", name: "無人の甲冑", race: "armored", element: "light", artKey: "knightmare", rank: 4,
    hp: 60, atk: 19, def: 12, spd: 6, soul: 46, gold: 34, soulClass: "knight",
    desc: "守るべき主も、守るべき意味も失われ、ただ「侵入者を通すな」という最後の誓いだけが宿った無人の鎧。中身は空洞だが、磨き抜かれた剣技は生前のまま冴え渡る。兜の奥で、消えぬ聖光がぼうと灯る。" },
  { id: "d03_whelp", name: "奈落の幼竜", race: "dragon", element: "fire", artKey: "dragon", rank: 4, boss: true,
    palette: tint(ARTS.dragon.palette, "#3a8a3a", 0.35),
    hp: 220, atk: 26, def: 12, spd: 9, soul: 320, gold: 360,
    desc: "深淵の熱泉で孵ったばかりの若き竜。鱗はまだ柔らかく、知恵も浅い。だがその喉から吐き出される炎は回廊の石を飴のように溶かし、未熟ゆえの加減を知らぬ分だけ、かえって容赦がない。" },
]);

export const dungeon = {
  id: "d03", name: "奈落の回廊", short: "奈落", rank: 3, floors: 7,
  pool: ["d03_orc", "d03_ghost", "d03_sahagin"],
  deepPool: ["d03_mandrake", "d03_sentinel", "d03_orc"],
  boss: "d03_whelp", bossScale: 1.0, enemyScale: 1.7,
  trapRate: 0.12, warmChance: 0.45, soulLevelBonus: 2, rankBonus: 1.2, lootTier: 2,
  lootLv: [14, 28], // 出現アイテムの隠しレベル帯 (入口→最深部)
};
