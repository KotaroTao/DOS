// ダンジョン2「朽ちた城砦」rank2 — 兵の亡霊と魔物が巣食う城。
import { defMonsters, tint, ARTS } from "./schema.js";

export const monsters = defMonsters([
  { id: "d02_armkobold", name: "鎧コボルド", race: "humanoid", element: "none", artKey: "kobold", rank: 2,
    palette: tint(ARTS.kobold.palette, "#9aa3ab", 0.35),
    hp: 26, atk: 12, def: 6, spd: 6, soul: 18, gold: 14, soulClass: "fighter",
    desc: "落城の際に死んだ兵から鎧を剥ぎ取り、身に纏ったコボルド。寸法の合わぬ甲冑を引きずりながら隊列を組む姿は、滅びた守備隊の悪夢のような模倣だ。兜の中から、犬の唸りが響く。" },
  { id: "d02_soldier", name: "朽ちた兵士", race: "undead", element: "dark", artKey: "skeleton", rank: 2,
    palette: tint(ARTS.skeleton.palette, "#5a5f7a", 0.3),
    hp: 30, atk: 13, def: 6, spd: 6, soul: 22, gold: 16, soulClass: "thief",
    desc: "城を守れずに散った衛兵の成れの果て。誰を守るのかも、誰と戦うのかも忘れ、ただ「持ち場を離れるな」という最後の号令だけが骨の髄に焼き付いている。崩れた城壁の前で、永遠に剣を構え続ける。" },
  { id: "d02_harpy", name: "城砦のハーピー", race: "avian", element: "wind", artKey: "harpy", rank: 2,
    hp: 24, atk: 13, def: 4, spd: 11, soul: 20, gold: 15,
    desc: "崩れた尖塔を巣とする、女の貌と猛禽の体を持つ魔物。耳をろうするかん高い声で獲物をすくませ、突風とともに舞い降りてかぎ爪で眼をえぐる。巣には磨かれた指輪や髪飾りが集められ、持ち主はもうどこにもいない。" },
  { id: "d02_imp", name: "小悪魔", race: "demon", element: "fire", artKey: "imp", rank: 2,
    hp: 22, atk: 12, def: 4, spd: 11, soul: 19, gold: 13,
    desc: "城の崩落に引き寄せられ、地獄の裂け目から這い出た下級の悪魔。掌に灯した火種で書物やはりを焼き、人の絶望を肴にあざ笑う。契約を持ちかける口ぶりは巧みだが、署名した者の魂はその場であぶられる。" },
  { id: "d02_lizard", name: "城砦のトカゲ", race: "reptile", element: "earth", artKey: "lizard", rank: 3,
    hp: 34, atk: 14, def: 8, spd: 6, soul: 26, gold: 18,
    desc: "石壁の崩れ目に潜み、冷えた身を岩肌に同化させて獲物を待つ硬鱗の爬虫。微動だにせぬまま何刻も待ち伏せ、間合いに入った瞬間、鉄をも噛み砕く顎で足首を捉えて離さない。" },
  { id: "d02_lord", name: "城主の亡霊", race: "specter", element: "dark", artKey: "wraith", rank: 3, boss: true,
    palette: tint(ARTS.wraith.palette, "#9b59b6", 0.3),
    hp: 130, atk: 20, def: 9, spd: 9, soul: 140, gold: 180, soulClass: "mage",
    desc: "民を見捨てて自らだけ生き延びようとし、その報いに城もろとも呪われた領主の末路。今や瘴気の塊となり、誰もいない玉座の間をさまよい続ける。近づく者を旧臣と見なし、忠誠を試すように冷たい手を伸ばす。" },
]);

export const dungeon = {
  id: "d02", name: "朽ちた城砦", short: "城砦", rank: 2, floors: 5,
  pool: ["d02_armkobold", "cm_bat", "d02_soldier", "d02_harpy"],
  deepPool: ["d02_soldier", "d02_imp", "d02_lizard"],
  boss: "d02_lord", bossScale: 1.0, enemyScale: 1.3,
  trapRate: 0.10, warmChance: 0.42, soulLevelBonus: 1, rankBonus: 0.6, lootTier: 1,
  lootLv: [7, 18], // 出現アイテムの隠しレベル帯 (入口→最深部)
};
