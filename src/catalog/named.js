// 名のある強敵の首級 — 初めて討ったときに必ず手に入る、その強敵だけの品 (スーパーレア・橙)
//
// 「固有ドロップは廃止」の例外 (ユーザーの決定)。ドロップ表には入らない (noDrop) — game.js endBattle が
// 名のある強敵 (dungeons/named.js) を初めて倒した戦闘の宝箱に入れる。全滅で失ったら、次に倒した時にまた落とす。
// 隠しLvは縄張りの迷宮の落とし物の帯の上端あたり。同じ層の逸品 (layerN.js の SR) より一回り強く (pow 1.4〜1.45)、
// 強敵の特色を裏返した効果を持たせる (痺れさせる包丁 → 痺れを与える / 吸血のヒル → 吸血 など)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, G, R } from "./defs.js";

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
];
