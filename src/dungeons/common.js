// 共通モンスター (cm_): 複数のダンジョンに跨って出現する序盤〜汎用の雑魚。
// 各ダンジョンの pool に id を混ぜて再利用する (毎回描き直さないため)。
import { defMonsters, tint, ARTS } from "./schema.js";

export const COMMON_MONSTERS = defMonsters([
  { id: "cm_slime", name: "スライム", race: "amorph", artKey: "slime", rank: 1,
    hp: 14, atk: 5, def: 1, spd: 4, exp: 6, gold: 4,
    desc: "地を這う不定形の魔物。粘体に覆われ、油断した冒険者を包み込む。どこの迷宮にも湧く。" },
  { id: "cm_bat", name: "コウモリ", race: "wing", artKey: "bat", rank: 1,
    hp: 11, atk: 6, def: 2, spd: 9, exp: 7, gold: 3,
    desc: "暗闇を舞う吸血性の翼獣。素早く、群れで現れると厄介だ。" },
  { id: "cm_spider", name: "洞窟蜘蛛", race: "insect", artKey: "spider", rank: 1,
    hp: 13, atk: 7, def: 2, spd: 8, exp: 8, gold: 5,
    desc: "巣を張る大蟲。毒牙を持ち、獲物を糸で搦め捕る。湿った迷宮に多い。" },
  { id: "cm_caverat", name: "洞窟ネズミ", race: "beast", artKey: "beast", rank: 1,
    palette: tint(ARTS.beast.palette, "#888888", 0.25),
    hp: 16, atk: 7, def: 3, spd: 7, exp: 9, gold: 5,
    desc: "牙を剥く灰色の獣。単純だが力強く噛みつく。" },
]);
