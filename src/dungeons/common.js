// 共通モンスター (cm_): 複数のダンジョンに跨って出現する序盤〜汎用の雑魚。
// 各ダンジョンの pool に id を混ぜて再利用する (毎回描き直さないため)。
import { defMonsters, tint, ARTS } from "./schema.js";

export const COMMON_MONSTERS = defMonsters([
  { id: "cm_slime", name: "スライム", race: "amorph", element: "water", artKey: "slime", rank: 1,
    hp: 14, atk: 5, def: 1, spd: 4, exp: 6, gold: 4,
    desc: "迷宮の湿気と腐肉が溶け合って生まれた、意思なき粘塊。斬っても潰れて再び寄り集まり、眠る冒険者の口や鼻からゆっくりと体内へ流れ込む。骨だけになって発見された亡骸は、たいていこれの仕業だ。" },
  { id: "cm_bat", name: "黒翼蝙蝠", race: "wing", element: "dark", artKey: "bat", rank: 1,
    hp: 11, atk: 6, def: 2, spd: 9, exp: 7, gold: 3,
    desc: "光を厭い、闇そのものを糧とするように増えた吸血蝙蝠。一匹なら松明で追える。だが闇の中で羽音が二重三重に重なり始めたら、もう手遅れだ。喉笛を裂かれ、血を失ってから己の死に気づく。" },
  { id: "cm_spider", name: "洞窟蜘蛛", race: "insect", element: "earth", artKey: "spider", rank: 1,
    hp: 13, atk: 7, def: 2, spd: 8, exp: 8, gold: 5,
    desc: "坑道の天井いっぱいに灰色の巣を張る大蜘蛛。獲物を麻痺毒で生かしたまま糸に巻き、何日もかけて体液を啜る。巣にぶら下がる繭の中身が、まだ時おり震えているという。" },
  { id: "cm_caverat", name: "洞窟ネズミ", race: "beast", element: "none", artKey: "beast", rank: 1,
    palette: tint(ARTS.beast.palette, "#888888", 0.25),
    hp: 16, atk: 7, def: 3, spd: 7, exp: 9, gold: 5,
    desc: "屍肉を食らって肥え太った灰色の獣。単体では臆病だが、血の匂いを嗅ぎつけると群れで湧き、倒れた者を骨まで漁る。迷宮の掃除屋にして、迷宮が決して飢えない理由。" },
]);
