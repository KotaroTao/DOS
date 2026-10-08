// 第6層「沈んだ神殿」の逸品 — スーパーレア (橙) とレジェンドレア (赤)
//
// 第6層 (台帳の迷宮 w14〜w17・王都の古井戸 ws5: 推奨Lv 52〜61) の落とし物の帯は隠しLv 54〜86 (world.js lootBand)、
// 基準R8〜9・出現上限 R10〜11 (隠しLv 100〜110)。第5層の逸品 (隠しLv 43-68) より一段上の 53-78 に置き、
// どの迷宮でも出現上限の内側に収める。layer:6 を持つ品は第6層より浅い所では出ない。
// 三百年前に沈んだ旧都の大神殿ゆかりの品 (神官王・聖歌隊・洗礼の水・神像・参道の灯籠)。
// 神殿の敵は水 (溺れた信徒・ナーガ・深海の鐘鬼)、闇 (怨霊・魂刈り・リッチ・異端大司教)、光 (堕天使・神のくぐつ・
// 堕ちた神像。聖歌の回廊では掟で全員が光) → 土 (水を削る)・光 (闇を払う)・闇 (光をむしばむ) の攻防を散らす。
// 状態異常は麻痺 (聖歌隊・鐘鬼・藻) と毒 (ナーガ・聖水盤の異形) だけなので、耐性もこの2つ。ブレスの使い手はいない。
// レジェンドレアは全職共通で固有の戦闘効果 (eff) を持ち、スーパーレアの1/3の割合で落ちる (未鑑定で手に入る)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, F, G, R } from "./defs.js";

const sr = (it) => { it.rar = "sr"; it.layer = 6; return it; };
// LR: 層の印 lr:6。layer を持つので、職業専用LR (tier5〜) とは別に lrPool が層と出現上限で絞る
const lr = (it) => { it.rar = "lr"; it.lr = 6; it.layer = 6; it.exclusive = true; return it; };

export const LAYER6_ITEMS = [
  // ===== スーパーレア: 武器 =====
  sr(W("w_sr6_lanternblade", "灯籠守りの剣", "ls", 53, { pow: 1.35, eAtk: ["earth", 1], hp: 16, tint: "#9a9488",
    desc: "水底の参道で灯籠の火を守った衛士の剣。刃は灯籠と同じ石の粉を混ぜて鍛えられ、水を吸って膨れた魔物の身を、石の重みで断ち割る。" })),
  sr(W("w_sr6_tridentguard", "溺れ衛兵の三つ又槍", "sp", 55, { pow: 1.35, agi: 4, hp: 14, tint: "#5a8aa0",
    desc: "大神殿の門を守っていた衛兵が、沈んだ夜も手放さなかった三つ又の槍。さびた穂先は三百年の水に研がれ、鱗の隙間に音もなく滑り込む。" })),
  sr(W("w_sr6_apostateknife", "背教者の短剣", "dg", 56, { scale: { agi: 0.35 }, pow: 1.3, eAtk: ["dark", 1], luk: 4, tint: "#5a4a6a",
    desc: "神殿の地下で、教えを捨てた神官が祭具を削って作った短剣。祈りを裏切った刃は聖なるものを嫌い、光をまとう者ほど深く傷つける。" })),
  sr(W("w_sr6_hymnbow", "聖歌隊のたて琴弓", "bw", 58, { scale: { agi: 0.45 }, magic: true, pow: 1.3, eAtk: ["light", 1], luk: 3, tint: "#e0d090",
    desc: "聖歌隊のたて琴の弦を張り替えて弓にしたもの。弦を引けば澄んだ音が鳴り、放たれた矢は祈りの調べをまとって、闇に沈んだ霊を射抜く。" })),
  sr(W("w_sr6_bellclapper", "大鐘の舌の槌", "mc", 60, { pow: 1.3, hp: 20, onHit: ["paralyze", 0.15], tint: "#8a7a50",
    desc: "たたりの大鐘から外れ落ちた鐘の舌を、そのまま槌にしたもの。打てば鐘の音が骨まで響き、打たれた者はしばし身動きが取れなくなる。" })),
  sr(W("w_sr6_lampstaff", "奉灯の聖杖", "st", 62, { magic: true, pow: 1.3, eAtk: ["light", 1], mp: 20, pie: 4, tint: "#f0e0a0",
    desc: "参道の灯籠に火を移すために神官が携えた杖。杖頭の小さな灯は三百年水に沈んでも消えず、祈りの言葉を闇を払う光に変える。" })),
  sr(W("w_sr6_idolbreaker", "像砕きの大斧", "ax", 64, { pow: 1.3, two: true, hp: 24, eAtk: ["dark", 1], crit: 0.05, tint: "#6a5a70",
    desc: "旧都が沈む前夜、神官王の命に背いた石工が神像の首を落とした大斧。刃こぼれひとつ無い刃は、いまも聖なる石を見ると重くうなる。" })),
  sr(W("w_sr6_tidecutter", "潮断ち", "kt", 67, { pow: 1.35, eAtk: ["earth", 1], agi: 5, tint: "#a0a8a0",
    desc: "洗礼の大水槽の水門を断ち切ったと伝わる刀。刃文は砂を巻いた潮のように荒く、水の魔物の身を砂でこそげるように裂く。" })),

  // ===== スーパーレア: 防具 =====
  sr(F("f_sr6_pilgrimshoes", "参道の巡礼靴", 57, { weight: "light", pow: 1.35, agi: 4, eDef: ["earth", 1], tint: "#7a6a58",
    desc: "灯籠の連なる参道を、裸足同然で歩いた巡礼者の靴。底に縫い込んだ石畳の欠片が足を重く据え、水底の流れにも押し流されない。" })),
  sr(A("a_sr6_templescale", "神殿衛士の鱗鎧", 59, { aRes: { paralyze: 0.3 }, weight: "heavy", pow: 1.35, hp: 24, eDef: ["earth", 1], tint: "#6a8a8a",
    desc: "大神殿の衛士が着た鱗の鎧。鱗の一枚ずつに石の祈り札が裏打ちされ、打ち寄せる水も、鐘の音の痺れも肌までは届かない。" })),
  sr(H("h_sr6_choirhood", "聖歌隊の頭巾", 61, { aRes: { paralyze: 0.3 }, magStat: "int", shape: "hat", weight: "cloth", pow: 1.35, mp: 14, eDef: ["dark", 1], tint: "#c8c0b0",
    desc: "溺れた聖歌隊の少年がかぶっていた頭巾。歌の調べを知り尽くした布は、痺れを呼ぶ歌声を耳もとで打ち消し、まばゆい光の刃もかすめるだけで逸らす。" })),
  sr(S("s_sr6_altarstone", "祭壇石の大盾", 63, { shape: "kite", pow: 1.35, hp: 26, eDef: ["earth", 1], tint: "#8a8478",
    desc: "大樹の幹が突き破った祭壇の、割れた石板を盾に仕立てたもの。三百年の祈りが染みた石は、押し寄せる濁流をも受け止める。" })),
  sr(S("s_sr6_drownedhymnal", "溺れた聖歌集", 66, { shape: "tome", pow: 1.35, aRes: { paralyze: 0.2, poison: 0.2 }, eDef: ["light", 1], tint: "#5a6a8a",
    desc: "水を吸って膨れた聖歌集。紙は貼りついて開かないのに、手に取れば歌が聞こえる。読み手の祈りを支え、闇の爪から身を守る。" })),
  sr(A("a_sr6_baptismrobe", "洗礼の白衣", 70, { aRes: { poison: 0.3 }, shape: "robe", pow: 1.35, mp: 20, pie: 6, eDef: ["light", 1], tint: "#e8e8e0",
    desc: "冠を受ける前の王が、洗礼の水に浸かるときにまとった白衣。三百年の水にも白さを失わず、毒を洗い流し、闇の気を寄せつけない。" })),
  sr(G("g_sr6_chrismgloves", "聖油の手袋", 73, { aRes: { poison: 0.3 }, magStat: "pie", weight: "cloth", pow: 1.35, mp: 12, tint: "#d8c890",
    desc: "神像に聖油を塗る役の神官がはめた手袋。指先に染みた聖油の香りが、傷に触れれば癒しを深め、毒の滴を寄せつけない。" })),
  sr(R("r_sr6_offeringbell", "供物の鈴", "bell", 76, { aRes: { paralyze: 0.25 }, hp: 30, pie: 5, eDef: ["dark", 1], tint: "#d8b860",
    desc: "供物を沈めるときに鳴らされた小さな鈴。水の底でもかすかに鳴り続け、持ち主の身を縛る痺れを解き、光の刃を鈴の音でそらす。" })),

  // ===== レジェンドレア (全職共通・固有効果) =====
  lr(W("lr_l6_crosier", "神官王の牧杖", "st", 72, { magic: true, pow: 1.45, two: true, eAtk: ["light", 2], mp: 26, eff: { regen: 0.05 }, tint: "#f0d870",
    desc: "旧都の神官王が、魂の泉の上で冠を受けた夜に携えていた牧杖。杖頭の光はいまも祈りを返し、持ち主の傷を少しずつ癒していく。" })),
  lr(W("lr_l6_trunkcleaver", "幹裂きの大剣", "ls", 74, { pow: 1.45, two: true, eAtk: ["earth", 2], hp: 30, eff: { lifesteal: 0.15 }, tint: "#b0a080",
    desc: "祭壇を突き破って昇る大樹の幹に、誰かが打ち込んだまま残した大剣。三百年、幹の樹液を吸い続けた刃は、斬った相手の命を持ち主へ流し込む。" })),
  lr(H("lr_l6_cantorcrown", "聖歌隊長の冠", 75, { magStat: "int", shape: "circlet", weight: "cloth", pow: 1.6, mp: 22, aRes: { paralyze: 0.3 }, eff: { spellCostMul: 0.85 }, tint: "#e8e0c0",
    desc: "溺れた聖歌隊を三百年率いてきた隊長の冠。冠をいただく者の唱える言葉は歌のようによどみなく流れ、呪文の消耗が軽くなる。" })),
  lr(A("lr_l6_fontplate", "洗礼泉の聖鎧", 76, { weight: "heavy", pow: 1.6, hp: 34, eDef: ["earth", 2], eff: { guard: 0.10 }, tint: "#a0c0d0",
    desc: "洗礼の大水槽の底で、泉の水を浴び続けた聖なる鎧。継ぎ目からいまも澄んだ水がにじみ、受けた傷を清めるように和らげる。" })),
  lr(S("lr_l6_sunkenaltar", "沈める祭壇の大盾", 77, { shape: "kite", pow: 1.6, hp: 32, eDef: ["light", 2], eff: { counter: 0.3 }, tint: "#c8b890",
    desc: "大神殿の主祭壇を飾っていた金の浮彫りを、そのまま盾に打ち出したもの。闇の一撃を受け止めると、浮彫りの聖者たちが打ち返す。" })),
  lr(R("lr_l6_idoltear", "神像の涙", "amulet", 78, { pow: 1.6, hp: 30, pie: 8, eff: { autoRevive: 0.3 }, tint: "#c0e0f0",
    desc: "沈んだ神殿の神像が、三百年流し続けた涙が固まった石。持ち主が倒れると涙が一粒こぼれ、一度だけ魂を呼び戻す。" })),
];
