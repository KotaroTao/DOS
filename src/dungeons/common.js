// 共通モンスター (cm_): 複数のダンジョンに跨って出現する序盤〜汎用の雑魚。
// 各ダンジョンの pool に id を混ぜて再利用する (毎回描き直さないため)。
import { defMonsters, tint, ARTS } from "./schema.js";

export const COMMON_MONSTERS = defMonsters([
  { id: "cm_slime", name: "スライム", race: "amorph", element: "water", artKey: "slime", rank: 1,
    hp: 14, atk: 5, def: 1, spd: 4, soul: 6, gold: 4,
    // 粘体ゆえ刃が通らない (物理耐性) が、魔法の熱や衝撃には脆い (魔法弱点)
    physResist: 0.6, magWeak: 1.6,
    desc: "迷宮の湿気と腐肉が溶け合って生まれた、意思なき粘塊。刃を通しても潰れて再び寄り集まり、物理ではなかなか倒せない。だが炎や雷の魔法には脆く、ひとたび熱を通せばたちまち煮崩れる。" },
  { id: "cm_bat", name: "黒翼蝙蝠", race: "wing", element: "dark", artKey: "bat", rank: 1,
    hp: 11, atk: 6, def: 2, spd: 9, soul: 7, gold: 3,
    swift: true, evasive: true, // 闇を翔ける俊敏な飛行 — 先手を取り、よくかわす
    desc: "光をいとい、闇そのものを糧とするように増えた吸血蝙蝠。素早く宙を舞い、こちらの一撃をひらりとかわす。闇の中で羽音が二重三重に重なり始めたら、もう手遅れだ。" },
  { id: "cm_spider", name: "洞窟蜘蛛", race: "insect", element: "earth", artKey: "spider", rank: 1,
    hp: 13, atk: 7, def: 2, spd: 8, soul: 8, gold: 5,
    ability: "paralyze", // 麻痺毒の牙
    desc: "坑道の天井いっぱいに灰色の巣を張る大蜘蛛。獲物を麻痺毒で生かしたまま糸に巻き、何日もかけて体液をすする。巣にぶら下がる繭の中身が、まだ時おり震えているという。" },
  { id: "cm_caverat", name: "洞窟ネズミ", race: "beast", element: "none", artKey: "beast", rank: 1,
    palette: tint(ARTS.beast.palette, "#888888", 0.25),
    hp: 16, atk: 7, def: 3, spd: 7, soul: 9, gold: 5,
    role: "summoner", summonKey: "cm_caverat", // 血の匂いで仲間を呼び寄せる
    desc: "屍肉を食らって肥え太った灰色の獣。単体では臆病だが、血の匂いを嗅ぎつけると甲高い声で仲間を呼び、倒れた者を骨まで漁る。迷宮の掃除屋にして、迷宮が決して飢えない理由。" },
]);
