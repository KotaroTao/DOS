// 第7層「灼熱の洞」の逸品 — スーパーレア (橙) とレジェンドレア (赤)
//
// 第7層 (台帳の迷宮 w18〜w21: 推奨Lv 61〜70) の落とし物の帯は隠しLv 64〜99 (world.js lootBand)、
// 基準R9〜10・出現上限 R11〜12 (隠しLv 110〜120)。第6層の逸品 (隠しLv 53-78) より一段上の 63-88 に置き、
// どの迷宮でも出現上限の内側に収める。layer:7 を持つ品は第7層より浅い所では出ない。
// 大神殿の底のさらに下、魂の樹液を煮詰めて王の霊薬に変える火の洞ゆかりの品 (溶岩・灰・釜・火を拝む信徒)。
// 洞の敵はほぼすべて火 (闇は影の大鬼・冥府の将だけで1割に届かない。業火の大釜では掟で全員が火) →
// 属性は水 (火を消す) の攻防だけにして、ほかの品はブレス耐性・会心・追加効果で個性を出す。
// 状態異常は毒 (硫黄・溶岩の粘塊・灰の喰屍鬼) と麻痺 (溶岩のエイ) だけ。ブレスの使い手は多い (番犬・デーモン・竜)。
// レジェンドレアは全職共通で固有の戦闘効果 (eff) を持ち、スーパーレアの1/3の割合で落ちる (未鑑定で手に入る)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, F, G, R } from "./defs.js";

const sr = (it) => { it.rar = "sr"; it.layer = 7; return it; };
// LR: 層の印 lr:7。layer を持つので、職業専用LR (tier5〜) とは別に lrPool が層と出現上限で絞る
const lr = (it) => { it.rar = "lr"; it.lr = 7; it.layer = 7; it.exclusive = true; return it; };

export const LAYER7_ITEMS = [
  // ===== スーパーレア: 武器 =====
  sr(W("w_sr7_quenchblade", "水打ちの剣", "ls", 63, { pow: 1.35, eAtk: ["water", 1], hp: 18, tint: "#6a90b0",
    desc: "火の洞へ降りた鍛冶が、最後の湧き水で焼き入れした剣。刃はいまも水の冷たさを覚えていて、触れた炎をじゅうと鳴らして消し止める。" })),
  sr(W("w_sr7_sulfurknife", "硫黄塗りの短剣", "dg", 64, { scale: { agi: 0.35 }, pow: 1.3, onHit: ["poison", 0.3, 0.05], luk: 4, tint: "#c8b840",
    desc: "硫黄の鬼の爪を削って作った短剣。刃に固まった黄色い粉が傷口で燃え、肉を内側からじわじわとむしばむ。" })),
  sr(W("w_sr7_potwardspear", "釜番の長柄槍", "sp", 65, { pow: 1.35, agi: 4, hp: 18, tint: "#8a6a50",
    desc: "釜の火を見張る番人が、煮えたぎる樹液をかき混ぜた長柄を槍に仕立てたもの。柄は焦げても折れず、穂先は熱で鋭く研がれている。" })),
  sr(W("w_sr7_ashbow", "灰かぶりの弓", "bw", 67, { scale: { agi: 0.45 }, pow: 1.3, crit: 0.06, luk: 4, tint: "#8a8480",
    desc: "降りしきる灰の中で、火を拝む者たちを射た狩人の弓。灰にかすむ的を射続けた弓幹は、見えない急所を探り当てる癖がついている。" })),
  sr(W("w_sr7_springstaff", "湧き水の杖", "st", 69, { scale: { int: 0.3, pie: 0.3 }, magic: true, pow: 1.3, eAtk: ["water", 1], mp: 22, tint: "#70b0d0",
    desc: "火の洞でただひとつ枯れなかった湧き水を、水晶の杖頭に汲み入れた杖。唱えた呪文は冷たい水の奔流となり、燃える魔物の火を奪う。" })),
  sr(W("w_sr7_obsidianaxe", "黒曜の大斧", "ax", 72, { pow: 1.3, two: true, hp: 26, crit: 0.08, tint: "#3a3440",
    desc: "黒曜の番兵の腕を割って作った大斧。割れ口はかみそりよりも鋭く、振り下ろせば鎧の継ぎ目を自ら探して断ち割る。" })),
  sr(W("w_sr7_cauldronmaul", "釜叩きの槌", "mc", 75, { pow: 1.3, hp: 22, eAtk: ["water", 1], tint: "#5a7088",
    desc: "割れた釜を叩き直すために、釜直しの職人が使った槌。頭には冷やし水を通す管が巡り、打つたびに湯気を噴いて炎の身を冷やし砕く。" })),
  sr(W("w_sr7_steamcutter", "湯気切り", "kt", 78, { pow: 1.35, eAtk: ["water", 1], agi: 5, tint: "#b0c8d8",
    desc: "抜けば刃のまわりに白い湯気が立つ刀。煮えたぎる釜の湯気さえ二つに裂いたといい、その冷たい刃は溶岩の身にも深く入る。" })),

  // ===== スーパーレア: 防具 =====
  sr(H("h_sr7_sootmask", "すす除けの覆面", 66, { aRes: { poison: 0.3 }, bRes: 0.15, shape: "hat", weight: "light", pow: 1.35, hp: 18, tint: "#5a5450",
    desc: "釜場で働く者が顔に巻いた、厚い布の覆面。硫黄の毒気を吸わせず、吹きつける熱の息からも目と喉を守る。" })),
  sr(S("s_sr7_cauldronlid", "大釜の蓋盾", 68, { shape: "round", pow: 1.35, hp: 26, bRes: 0.2, tint: "#6a5a4a",
    desc: "樹液を煮詰める大釜の蓋を、取っ手ごと盾にしたもの。三百年の湯気と炎に耐えた鉄は、竜の吐く熱も受け流す。" })),
  sr(A("a_sr7_ashplate", "灰被りの重鎧", 70, { bRes: 0.18, weight: "heavy", pow: 1.35, hp: 28, eDef: ["water", 1], tint: "#7a7470",
    desc: "灰の祭場に倒れた騎士の鎧。降り積もった灰が湿って固まり、継ぎ目を塞いで、炎も熱の息も内側へは通さない。" })),
  sr(A("a_sr7_firewardrobe", "火守りの法衣", 71, { aRes: { poison: 0.3 }, shape: "robe", pow: 1.35, mp: 22, int: 6, eDef: ["water", 1], tint: "#4a6a8a",
    desc: "火を拝む信徒のうち、火にのまれぬよう祈った者だけがまとった青い法衣。裾に縫い込んだ水の文字が炎を退け、毒の煙を払う。" })),
  sr(G("g_sr7_tonggauntlet", "火ばさみの籠手", 74, { aRes: { paralyze: 0.25 }, role: "atk", weight: "heavy", shape: "gauntlet", pow: 1.35, hp: 16, tint: "#5a5058",
    desc: "釜の火床から焼けた魂石をつかみ出すための、指の長い鉄の籠手。焼けた石を握っても指は痺れず、その握りのまま得物を振るう。" })),
  sr(S("s_sr7_elixirorb", "霊薬の宝珠", 77, { shape: "orb", pow: 1.35, eAtk: ["water", 1], aRes: { poison: 0.2 }, tint: "#a070c0",
    desc: "王の杯へ送られるはずだった霊薬を、ひとさじだけ水晶の球に閉じ込めた宝珠。球の中で霊薬がゆらぎ、唱えた呪文を炎を消す水に変える。" })),
  sr(F("f_sr7_cinderwalkers", "灰渡りの長靴", 82, { aRes: { paralyze: 0.25 }, weight: "light", pow: 1.35, agi: 5, bRes: 0.12, tint: "#6a5a50",
    desc: "熱い灰の積もる祭場を渡るために、底を幾重にも重ねた長靴。焼けた床もひと跳びで渡り、溶岩のエイの痺れる尾もかわす。" })),
  sr(R("r_sr7_dewring", "露玉の指輪", "ring", 85, { hp: 32, mp: 16, eDef: ["water", 1], bRes: 0.12, tint: "#90c8e0",
    desc: "火の洞の天井に、一晩にひと粒だけ結ぶ露を閉じ込めた指輪。炎の熱が近づくほど露は冷たくなり、持ち主の肌を守る。" })),

  // ===== レジェンドレア (全職共通・固有効果) =====
  lr(W("lr_l7_rainblade", "雨乞いの太刀", "kt", 82, { pow: 1.45, two: true, eAtk: ["water", 2], agi: 8, eff: { actFirst: true }, tint: "#80b0e0",
    desc: "火の洞に雨を呼ぼうとした祈り手の太刀。抜けば刃から雨の匂いが立ち、持ち主は降り出す前の雨粒のように、誰よりも先に動く。" })),
  lr(W("lr_l7_sapseal", "樹液封じの杖", "st", 84, { scale: { int: 0.3, pie: 0.3 }, magic: true, pow: 1.45, eAtk: ["water", 2], mp: 28, eff: { spellCostMul: 0.85 }, tint: "#d0a050",
    desc: "煮詰められる前の魂の樹液を、杖の芯に封じた杖。封じられた魂が唱える者に力を貸し、呪文の消耗を肩代わりする。" })),
  lr(A("lr_l7_quenchplate", "火消しの鎧", 85, { weight: "heavy", pow: 1.6, hp: 36, eDef: ["water", 2], bRes: 0.25, eff: { regen: 0.05 }, tint: "#5a80a0",
    desc: "釜場の火があふれたとき、火を消しに飛び込む役の者が着た鎧。鉄の内側を冷たい水が巡り、焼けた肌を冷やして傷を塞いでいく。" })),
  lr(G("lr_l7_furnacegrip", "炉番の鉄手甲", 86, { role: "atk", weight: "heavy", shape: "gauntlet", pow: 1.6, hp: 24, eff: { multistrike: 2 }, tint: "#8a6050",
    desc: "三百年、炉の火を絶やさなかった炉番の手甲。休むことを知らない腕の癖が宿り、一度の振りで二度打ちつける。" })),
  lr(F("lr_l7_lavagreaves", "溶岩渡りの鉄靴", 87, { shape: "greaves", weight: "heavy", pow: 1.6, agi: 4, eDef: ["water", 1], bRes: 0.15, eff: { guard: 0.08 }, tint: "#6a4a40",
    desc: "溶岩の川を歩いて渡るための、分厚い鉄の脚甲。熱で赤く光っても中の足は焼けず、踏みしめた構えは受けた傷を和らげる。" })),
  lr(R("lr_l7_lastdrop", "最後のしずくの首飾り", "amulet", 88, { pow: 1.6, hp: 32, pie: 8, eff: { autoRevive: 0.35 }, tint: "#e0b0d0",
    desc: "大釜の底に一滴だけ残った、王の霊薬のしずくを封じた首飾り。持ち主が倒れるとしずくがこぼれ、一度だけ魂を呼び戻す。" })),
];
