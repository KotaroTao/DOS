// 名のある強敵の首級 — 初めて討ったときに必ず手に入る、その強敵だけの品 (スーパーレア・橙)
//
// 「固有ドロップは廃止」の例外 (ユーザーの決定)。ドロップ表には入らない (noDrop) — game.js endBattle が
// 名のある強敵 (dungeons/named.js) を初めて倒した戦闘の宝箱に入れる。全滅で失ったら、次に倒した時にまた落とす。
// 隠しLvは縄張りの迷宮の落とし物の帯の上端あたり。同じ層の逸品 (layerN.js の SR) より一回り強く (pow 1.4〜1.45)、
// 強敵の特色を裏返した効果を持たせる (痺れさせる包丁 → 痺れを与える / 吸血のヒル → 吸血 など)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, G, R } from "./defs.js";

const trophy = (layer, elite, it) => { it.rar = "sr"; it.layer = layer; it.noDrop = true; it.trophy = elite; return it; };

export const NAMED_ITEMS = [
  trophy(1, "el_palebutcher", W("w_nm_palebutcher", "蒼白鬼の肉切り包丁", "ax", 14, { pow: 1.45, onHit: ["paralyze", 0.2], hp: 10, tint: "#d8d0c0",
    desc: "墓守に化けた喰人鬼が研ぎ続けた分厚い包丁。刃に映った自分の顔を見た者は、なぜか足がすくむ。蒼白の首切り鬼の首級。" })),
  trophy(1, "el_cryptlord", R("r_nm_cryptlord", "墓所の君主の指輪", "ring", 22, { pow: 1.4, mp: 12, int: 4, pie: 4, eDef: ["light", 1], eff: { soulUp: 0.2 },
    desc: "最も古い棺の主が嵌めていた黒い印章の指輪。死者に慕われた王の印であり、闇の眷属はこれを嵌めた者に爪を鈍らせ、迷う魂が寄ってくる。墓所の君主の首級。" })),
  trophy(2, "el_bloatqueen", G("g_nm_bloatqueen", "女王ヒルの吸血手甲", 30, { role: "atk", weight: "light", pow: 1.45, hp: 16, eff: { lifesteal: 0.15 },
    desc: "子産みヒルの女王のぬめる皮をなめして仕立てた手甲。斬りつけた相手の血を吸い上げ、着けた者の傷を塞ぐ。子産みヒルの女王の首級。" })),
  trophy(2, "el_drownedpaladin", S("s_nm_drownedpaladin", "沈みし聖騎士の大盾", 32, { shape: "kite", pow: 1.45, hp: 20, eDef: ["earth", 1], eff: { guard: 0.08 },
    desc: "水路を浄めに降りて戻らなかった聖騎士の大盾。仲間を庇って沈んだ騎士の祈りがいまも宿り、受けた傷を和らげる。沈みし聖騎士の首級。" })),
  trophy(3, "el_chainoverseer", W("w_nm_chainoverseer", "坑監の鎖鞭", "mc", 38, { pow: 1.4, eff: { multistrike: 2 }, tint: "#8a8070",
    desc: "罪人たちを坑の奥へ追い立てた鉄の鎖鞭。振るえば鎖が二度、三度とうねって打ちつける。鎖鞭の坑監の首級。" })),
  trophy(3, "el_crystalseer", W("w_nm_crystalseer", "晶眼の杖", "st", 38, { pow: 1.4, int: 6, aRes: { stone: 0.4 }, eAtk: ["wind", 1], eff: { spellCostMul: 0.85 },
    desc: "錬金術師の体から生え出た晶を、そのまま杖頭に据えたもの。晶の眼は石化の呪いをにらみ返し、呪文の消耗を和らげる。晶に憑かれし錬金術師の首級。" })),
  trophy(4, "el_warbanner", W("w_nm_warbanner", "燃える軍旗の槍", "sp", 46, { pow: 1.4, eAtk: ["fire", 2], hp: 24, tint: "#ff8a40",
    desc: "落城の日から燃え続ける軍旗の竿を、穂先ごと槍に仕立てたもの。百年消えなかった火が穂先に宿り、突くたびに炎が走る。軍旗の亡将の首級。" })),
  trophy(4, "el_headsman", W("w_nm_headsman", "処刑人の首斬り斧", "ax", 48, { pow: 1.45, two: true, crit: 0.12, tint: "#9a8a7a",
    desc: "砦の処刑場で幾百の首を落とした大鬼の斧。人なら両腕でようやく持ち上がる重い刃は、振り下ろすたびに自ら急所を探し、一閃で首筋を断つ。処刑人の大鬼の首級。" })),
  trophy(5, "el_eldertreant", S("s_nm_eldertreant", "古樹の樹皮盾", 62, { shape: "kite", pow: 1.45, hp: 30, bRes: 0.25, eDef: ["wind", 2], eff: { regen: 0.04 }, tint: "#6a5a3a",
    desc: "森より古い巨人の樹皮を剥いで張った大盾。吐き出される土砂の嵐をいちばんよく知る皮であり、持ち主の傷をゆっくり癒す。古樹の巨人の首級。" })),
  trophy(5, "el_mistmother", A("a_nm_mistmother", "霧繭の薄衣", 64, { shape: "robe", weight: "cloth", pow: 1.45, mp: 16, agi: 6, aRes: { paralyze: 0.45, sleep: 0.3 }, eDef: ["wind", 1], tint: "#e0e8f0",
    desc: "霧の繭母が紡いだ糸で織った薄衣。霧のように軽く、着た者が糸に絡め取られることは二度とない。霧の繭母の首級。" })),
  trophy(6, "el_heresiarch", W("w_nm_heresiarch", "異端大司教の黒槌", "mc", 76, { pow: 1.45, pie: 6, eAtk: ["light", 1], eff: { lifesteal: 0.15 }, tint: "#6a5a7a",
    desc: "死を福音と説いた大司教が、説教の壇で振るった黒い槌。聴いた者の魂を食らってきた槌は、いまは打った相手の命を持ち主の傷へ流し込み、闇の者を逆に裁く。異端大司教の首級。" })),
  trophy(6, "el_fallenidol", H("h_nm_fallenidol", "堕ちた神像の石冠", 78, { weight: "heavy", pow: 1.45, hp: 26, crit: 0.08, eDef: ["dark", 1], tint: "#d8c890",
    desc: "祈られることに飢えた神像の頭から外した、聖石の冠。かぶる者には急所の在りかが神像の目で見え、光の刃は冠の石に吸われて鈍る。堕ちた神像の首級。" })),
  trophy(7, "el_cinderking", R("r_nm_cinderking", "残り火の王の燃えさし", "amulet", 88, { hp: 34, mp: 18, eDef: ["water", 1], bRes: 0.2, eff: { regen: 0.04 },
    desc: "幾度消えかけても燃え直した残り火の王の、最後の燃えさしを鉄の籠に収めた首飾り。奪うことしか知らなかった火は、いまは持ち主の身をあたため、傷をゆっくり塞ぐ。残り火の王の首級。" })),
  trophy(7, "el_magmawyrm", A("a_nm_magmawyrm", "溶鉄の蛇竜の鱗鎧", 90, { weight: "heavy", pow: 1.45, hp: 36, bRes: 0.3, eDef: ["water", 2], tint: "#8a3a2a",
    desc: "溶けた鉄と一体になった蛇竜の鱗を、冷やし固めてつづった鎧。城門すら溶かす熱の息を浴び続けた鱗は、炎も吐息もほとんど通さない。溶鉄の蛇竜の首級。" })),
  trophy(8, "el_frostsovereign", W("w_nm_frostsovereign", "凍王の影の氷剣", "ls", 96, { pow: 1.45, onHit: ["paralyze", 0.2], eAtk: ["earth", 1], hp: 24, tint: "#a8c8e8",
    desc: "凍王が切り離した影が、回廊を見回るあいだ下げていた氷の剣。斬られた者を芯から凍らせてきた刃は、いまは持ち主の敵の手足を凍えさせ、凍った水の身を岩のように割る。凍王の影の首級。" })),
  trophy(8, "el_glacialmaw", S("s_nm_glacialmaw", "氷河の大顎の牙盾", 98, { shape: "kite", pow: 1.45, hp: 32, bRes: 0.3, eDef: ["earth", 1], eff: { guard: 0.06 }, tint: "#d0e4f0",
    desc: "氷河の大顎から抜いた白い牙を、鉄の枠に並べて組んだ大盾。鎧ごと獲物を噛み砕いてきた顎の牙は、氷の牙も凍える息も受け止めて離さない。氷河の大顎の首級。" })),
  trophy(9, "el_offeringslime", R("r_nm_offeringslime", "るつぼの底の金環", "ring", 106, { pow: 1.4, hp: 30, mp: 14, aRes: { poison: 0.3 }, eDef: ["light", 1], eff: { goldUp: 0.2 }, tint: "#c8a848",
    desc: "千年分の供物を呑みこんだるつぼの底に、ただ一つ溶け残っていた金の環。呑むばかりだったるつぼの名残は、いまは持ち主の手へ金貨を吐き出し、腐った汁の毒も闇の気も寄せつけない。供物のるつぼの首級。" })),
  trophy(9, "el_bogfrogking", W("w_nm_bogfrogking", "蛙王の舌槍", "sp", 108, { pow: 1.45, onHit: ["paralyze", 0.2], eAtk: ["wind", 1], hp: 24, agi: 4, tint: "#8a9a58",
    desc: "沼呑みの蛙王の、骨のように固い舌の芯を柄にした槍。獲物を痺れさせて丸呑みにしてきた舌の粘りが穂先に残り、突かれた敵は手足をしばらく動かせない。沼呑みの蛙王の首級。" })),
];
