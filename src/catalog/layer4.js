// 第4層「捨て砦」の逸品 — スーパーレア (橙) とレジェンドレア (赤)
//
// 第4層 (台帳の迷宮 w06〜w09: 難度 n14-20) のドロップ窓 (基準R4、出現上限 R6 = 隠しLv 1-60) に収めた、捨て砦ゆかりの特別な装備。
// 敵は rank5-6 (第3層の主と同格以上) なので、第3層の逸品 (隠しLv 23-49) より一段上の 33-58 に置く。
// layer:4 を持つ品は第4層より浅い所では出ない。
// 砦の敵は人の亡霊 (無属性) と、地下牢の闇・大手門の雷 (風) → 光の属性攻撃 (闇を祓う) と火 (風を焼く) の攻防を多めにする。
// 亡兵は隊伍で来るので、守りの品 (VIT・ブレス/全体攻撃への備え) と、隊伍を崩す追加効果の武器も混ぜる。
// レジェンドレアは全職共通の1点もので固有の戦闘効果 (eff) を持ち、実プレイ時間で抽選される (未鑑定で手に入る)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, F, G, R } from "./defs.js";

const sr = (it) => { it.rar = "sr"; it.layer = 4; return it; };
// LR: tier 4 = 第4層の帯。exclusive で通常のランク窓抽選から外し、時間抽選でのみ出す
const lr = (it) => { it.rar = "lr"; it.lr = 4; it.layer = 4; it.exclusive = true; return it; };

export const LAYER4_ITEMS = [
  // ===== スーパーレア: 武器 =====
  sr(W("w_sr4_bannerpike", "旗手の槍", "sp", 33, { pow: 1.35, two: true, hp: 14, eAtk: ["light", 1], tint: "#c8b080",
    desc: "守備隊の旗手が軍旗を括りつけ、両手で掲げ通した長槍。援軍を待ち続けた百年の祈りが穂先に宿り、闇に堕ちた亡者の身を白く焼く。" })),
  sr(W("w_sr4_garrisonblade", "守備隊長の佩刀", "ls", 36, { pow: 1.35, vitB: 3, hp: 12, tint: "#9a9aa8",
    desc: "砦の守備隊長が最後の夜まで帯びていた長剣。刃こぼれひとつ無いのは、部下の前で一度も退かなかった証だという。" })),
  sr(W("w_sr4_siegebolt", "攻城弩の太矢弓", "bw", 39, { scale: { agi: 0.4 }, pow: 1.35, eAtk: ["fire", 1], luk: 3, tint: "#c07a40",
    desc: "攻城弩の太矢を射るために造り替えられた強弓。鏃に詰めた火薬が着弾と同時に爆ぜ、雷雲の魔物をも炎で包む。" })),
  sr(W("w_sr4_thunderbrand", "雷避けの焼刃", "kt", 42, { pow: 1.35, eAtk: ["fire", 1], agi: 3, tint: "#e08a50",
    desc: "大手門の雷雨の中、落雷を浴びて赤く焼けたまま冷えなかった刀。刃に籠もった熱が、雷をまとった魔物の身を焼き切る。" })),
  sr(W("w_sr4_jailerkeys", "牢番の鍵束槌", "mc", 45, { pow: 1.3, hp: 16, onHit: ["paralyze", 0.15], tint: "#6a6a72",
    desc: "百の鍵を鉄環にまとめた牢番の鈍器。打たれた者は、閉ざされる錠の音を骨で聞き、しばし手足が言うことをきかなくなる。" })),
  sr(W("w_sr4_chaplainstaff", "従軍司祭の聖杖", "st", 48, { scale: { int: 0.3, pie: 0.3 }, magic: true, pow: 1.3, eAtk: ["light", 1], pie: 5, tint: "#e8e0c0",
    desc: "籠城の兵たちに最期の祈りを授けた従軍司祭の杖。死にゆく者を送り続けた灯が杖頭に残り、唱えた呪文を闇祓いの光へ変える。" })),
  sr(W("w_sr4_deserterknife", "脱走兵の匕首", "dg", 37, { scale: { agi: 0.35 }, pow: 1.3, luk: 4, crit: 0.07, tint: "#5a5a60",
    desc: "城壁の隙間から逃げ出した兵が、追手の喉を裂いた匕首。後ろめたさに研ぎ澄まされた刃は、正面ではなく急所だけを探す。" })),
  sr(W("w_sr4_ravageaxe", "城門破りの大斧", "ax", 51, { pow: 1.3, two: true, hp: 20, onHit: ["confuse", 0.12], tint: "#8a4a3a",
    desc: "寄せ手が大手門の閂を叩き割った大斧。轟音とともに打ち込まれた一撃は、隊伍を組む亡兵の陣形ごと揺さぶり、正気を奪う。" })),

  // ===== スーパーレア: 防具 =====
  sr(H("h_sr4_sentryhelm", "見張りの鉢金", 34, { aRes: { confuse: 0.3, sleep: 0.2 }, weight: "light", shape: "hat", pow: 1.35, hp: 12, tint: "#7a7068",
    desc: "百年、城壁の上で夜番に立ち続けた見張りの鉢金。眠りの誘いにも惑わしの声にも揺らがず、ただ遠くの闇だけを見据える。" })),
  sr(A("a_sr4_garrisonmail", "守備隊の鎖帷子", 38, { bRes: 0.15, weight: "heavy", pow: 1.35, hp: 18, tint: "#8a8a92",
    desc: "砦の守備隊に配られた鎖帷子。攻城の火矢と爆風に何度も晒されたが、着た兵を炎の息から守り抜き、輪のひとつも欠けていない。" })),
  sr(G("g_sr4_drumgauntlet", "鼓手の籠手", 41, { role: "atk", weight: "heavy", shape: "gauntlet", pow: 1.35, hp: 10, agi: 2, tint: "#a07050",
    desc: "陣太鼓を打ち続けた鼓手の籠手。拍子を刻む腕は疲れを知らず、振るう得物にも太鼓の重い響きが乗る。" })),
  sr(F("f_sr4_rampartboots", "城壁走りの長靴", 44, { weight: "light", pow: 1.35, agi: 3, eDef: ["fire", 1], tint: "#6a5040",
    desc: "伝令が雷雨の城壁を駆け抜けるのに履いた長靴。焦げた靴底は濡れた石にも滑らず、落雷の閃きより先に足を運ぶ。" })),
  sr(S("s_sr4_pavise", "攻城の置き盾", 47, { shape: "kite", pow: 1.35, hp: 20, bRes: 0.15, tint: "#5a4a3a",
    desc: "弩兵が身を隠した大きな置き盾。矢も火も受け止めるよう厚い板に鉄を打ち重ね、背に隠れた仲間を一斉射から守る。" })),
  sr(S("s_sr4_couriertarge", "伝令の烽火盾", 45, { shape: "buckler", pow: 1.35, eDef: ["fire", 1], aRes: { paralyze: 0.2 }, tint: "#a85a3a",
    desc: "大手門と本丸を走り継いだ伝令の小盾。矢を受け止めず斜めに払い流すよう軽く鍛えられ、表に焼き付けた烽火の紋が、痺れを運ぶ雷の刃を逸らす。" })),
  sr(S("s_sr4_beaconorb", "烽火台の火種玉", 48, { shape: "orb", pow: 1.35, eAtk: ["fire", 1], tint: "#ff9a50",
    desc: "援軍を呼ぶ最後の夜に焚かれ、ついに誰にも見られなかった烽火の火種を水晶に封じた宝珠。呪文を通せば烽火が再び燃え上がり、雷雨をまとう亡兵を焼き払う。" })),
  sr(S("s_sr4_cellbook", "獄中の聖典", 50, { shape: "tome", pow: 1.35, eDef: ["light", 1], aRes: { charm: 0.15 }, tint: "#d8c8a0",
    desc: "地下牢の囚われ人たちが回し読み、余白に祈りと名を書き足していった聖典。読み上げれば幾人もの声が重なって傷を癒し、牢の闇を読み手から遠ざける。" })),
  sr(A("a_sr4_chaplainrobe", "従軍司祭の法衣", 50, { aRes: { charm: 0.3 }, shape: "robe", pow: 1.35, mp: 16, pie: 5, eDef: ["light", 1], tint: "#d8d0b8",
    desc: "従軍司祭が籠城の最後の夜に纏った法衣。煤けた白布には死者のための祈りが縫い込まれ、闇の呪いを寄せつけない。" })),
  sr(H("h_sr4_inquisitorhood", "牢の審問頭巾", 53, { aRes: { charm: 0.25, confuse: 0.25 }, magStat: "int", shape: "circlet", weight: "cloth", pow: 1.35, mp: 12, tint: "#4a3a4a",
    desc: "地下牢で操霊師たちを審問した役人の頭巾。目の部分だけが開いた黒布は、被る者の思考を冷たく研ぎ、心を誰にも覗かせない。" })),
  sr(R("r_sr4_rollcall", "点呼の名札", "amulet", 56, { aRes: { paralyze: 0.3, stone: 0.2 }, hp: 24, vitB: 4, eDef: ["light", 1], tint: "#c8a860",
    desc: "守備隊の兵が首から下げた真鍮の名札。点呼に答えるたびに擦れて文字は消えたが、持ち主の名を呼ぶ声だけは、いまも札に残っている。" })),

  // ===== レジェンドレア (全職共通・1点もの・固有効果) =====
  lr(S("lr_l4_lastbanner", "最後の軍旗の盾", 52, { shape: "kite", pow: 1.6, hp: 34, eff: { guard: 0.12 }, eDef: ["light", 2], tint: "#b04030",
    desc: "援軍の来なかった夜、守備隊が最後に掲げた軍旗を盾に張ったもの。旗の下に立つ者がいるかぎり、仲間に届く刃を引き受け続ける。" })),
  lr(W("lr_l4_lordsword", "砦の主の剣", "ls", 54, { pow: 1.45, eAtk: ["light", 2], hp: 24, eff: { counter: 0.35 }, tint: "#d0c8b0",
    desc: "王都の書状を握り潰した砦の主が、最後まで振るった剣。退くことを知らぬ刃は、受けた一撃に必ず一撃を返す。" })),
  lr(W("lr_l4_stormcleaver", "雷呑みの大太刀", "kt", 55, { pow: 1.45, two: true, eAtk: ["fire", 2], agi: 6, eff: { multistrike: 1 }, tint: "#ff8a40",
    desc: "百年止まぬ雷雨の只中で、雷そのものを鍛え込んだと伝わる大太刀。振れば刃が二度閃き、雷の魔物すら焼き払う。" })),
  lr(H("lr_l4_watchcrown", "不寝番の兜", 56, { weight: "heavy", pow: 1.6, hp: 28, eff: { actFirst: true }, tint: "#7a7a8a",
    desc: "百年眠らずに城壁に立ち続けた見張り頭の兜。被る者は敵の気配を誰よりも早く察し、戦いの初めに必ず先手を取る。" })),
  lr(R("lr_l4_garrisonseal", "守備隊の印章指輪", "ring", 57, { pow: 1.6, hp: 30, vitB: 6, eff: { regen: 0.05 }, tint: "#c8a050",
    desc: "守備隊長が書状に押した印章の指輪。持ち場を守れという最後の命令に応え続けた兵たちの意志が宿り、はめた者の傷を静かに塞いでゆく。" })),
  lr(R("lr_l4_headsmanhood", "処刑人の黒頭巾", "amulet", 58, { pow: 1.6, hp: 26, luk: 8, eff: { lifesteal: 0.12 }, tint: "#2a1a22",
    desc: "百年斧を振るい続けた処刑人の黒い頭巾を、首飾りに縫い直したもの。斬った者の命の残り火を吸い、持ち主の傷を埋める。" })),
];
