// 第5層「霧の森」の逸品 — スーパーレア (橙) とレジェンドレア (赤)
//
// 第5層 (台帳の迷宮 w10〜w13・霧の迷い森・銀業の隠れ里: 難度 n18-26) のドロップ窓 (基準R5、出現上限 R7 = 隠しLv 1-70) に収めた、
// 管の根と地の底の森ゆかりの特別な装備。第4層の逸品 (隠しLv 33-58) より一段上の 43-68 に置く。
// layer:5 を持つ品は第5層より浅い所では出ない。
// 森の敵は風 (蛾・梟・雷鳥・霧の古木) と土 (蔦・茸・猪・苔の岩塊) が主 → 火 (風を焼く) と風 (土を削る) の攻防を多めにする。
// 魅了・眠り・混乱・麻痺・石化を「多用」する敵が多いので、状態異常耐性の品も厚めに。
// レジェンドレアは全職共通で固有の戦闘効果 (eff) を持ち、スーパーレアの1/3の割合で落ちる (未鑑定で手に入る)。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, F, G, R } from "./defs.js";

const sr = (it) => { it.rar = "sr"; it.layer = 5; return it; };
// LR: tier 5 = 第5層の帯。layer を持つので、職業専用LR (tier5〜) とは別に lrPool が層と出現上限で絞り、鑑定料も ×20 にしない
const lr = (it) => { it.rar = "lr"; it.lr = 5; it.layer = 5; it.exclusive = true; return it; };

export const LAYER5_ITEMS = [
  // ===== スーパーレア: 武器 =====
  sr(W("w_sr5_pruningblade", "庭師の剪定刀", "ls", 43, { pow: 1.35, eAtk: ["fire", 1], hp: 14, tint: "#c89050",
    desc: "大樹の根を手入れするために鍛えられた剪定刀。刃に焼き入れた火の気が、霧と風の魔物の身を焼き切り、伸びすぎた枝を払うように斬り落とす。" })),
  sr(W("w_sr5_ropehook", "綱掛けの鉤槍", "sp", 46, { pow: 1.35, eAtk: ["wind", 1], agi: 3, tint: "#a08860",
    desc: "縦穴を降りる者が根に綱を掛けた鉄の鉤を、槍の穂先に仕立てたもの。突けば風を切り、岩肌の魔物の継ぎ目に深く食い込む。" })),
  sr(W("w_sr5_owlbow", "霧渡りの梟弓", "bw", 49, { scale: { agi: 0.45 }, magic: true, pow: 1.3, luk: 4, tint: "#9aa8b8",
    desc: "霧の中を音もなく飛ぶ梟の羽を矢羽に、梟の骨を弓幹にした弓。霧の向こうの獲物にも狙いを外さず、矢は魔力を帯びて霊さえも射抜く。" })),
  sr(W("w_sr5_sapstaff", "樹液の灯杖", "st", 52, { scale: { int: 0.3, pie: 0.3 }, magic: true, pow: 1.3, eAtk: ["fire", 1], mp: 18, tint: "#d8b050",
    desc: "魂の樹液を琥珀に封じて杖頭に据えた杖。琥珀の中で燃える灯が、唱えた呪文を霧を焼き払う炎に変える。" })),
  sr(W("w_sr5_thornknife", "茨裂きの短剣", "dg", 45, { scale: { agi: 0.35 }, pow: 1.3, onHit: ["poison", 0.3, 0.05], luk: 3, tint: "#5a7a40",
    desc: "茨の猟犬の牙を研ぎ出した短剣。刃に残る茨の棘が傷口に食い込み、毒がじわじわと獲物の肉を蝕む。" })),
  sr(W("w_sr5_stagaxe", "角の魔獣の斧", "ax", 55, { pow: 1.3, two: true, hp: 22, eAtk: ["wind", 1], tint: "#8a6a4a",
    desc: "森を荒らした角の魔獣の角を斧頭にはめ込んだ大斧。振るえば突風を巻き起こし、苔むした岩の魔物すら叩き割る。" })),
  sr(W("w_sr5_wedgemaul", "くさび打ちの槌", "mc", 58, { pow: 1.3, hp: 18, onHit: ["paralyze", 0.15], tint: "#6a6a70",
    desc: "大樹の主にくさびを打ち込んだ古の操霊師の槌。打たれた者はくさびを打たれた木のように身を強張らせ、しばし動けなくなる。" })),
  sr(W("w_sr5_mistkatana", "霧払い", "kt", 61, { pow: 1.35, eAtk: ["fire", 1], agi: 5, tint: "#e0c0a0",
    desc: "抜けば刃の熱で霧が晴れると伝わる刀。迷い森で道を失った剣士が、この一振りで霧を裂き、生きて森を出たという。" })),

  // ===== スーパーレア: 防具 =====
  sr(H("h_sr5_owlhood", "梟の羽頭巾", 44, { aRes: { sleep: 0.3, confuse: 0.25 }, weight: "light", shape: "hat", pow: 1.35, hp: 14, tint: "#8a8070",
    desc: "霧渡りの梟の羽を編んだ頭巾。夜通し目を開けていた梟の性が宿り、眠りの鱗粉にも惑わしの灯にも心を奪われない。" })),
  sr(A("a_sr5_mossmail", "苔衣のくさりかたびら", 48, { aRes: { stone: 0.3 }, bRes: 0.15, weight: "heavy", pow: 1.35, hp: 22, eDef: ["fire", 1], tint: "#5a7a50",
    desc: "苔に覆われたまま地の底で眠っていたくさりかたびら。湿った苔が炎も吐息も吸い取り、石のにらみすら肌まで届かせない。" })),
  sr(G("g_sr5_ropegloves", "綱握りの手袋", 51, { aRes: { paralyze: 0.3 }, role: "atk", weight: "light", pow: 1.35, hp: 12, agi: 2, tint: "#a08860",
    desc: "縦穴の綱を握り続けた者の革手袋。掌の革は綱の擦れで鉄のように固くなり、痺れにも滑らぬ握りで得物を振るわせる。" })),
  sr(F("f_sr5_rootwalkers", "根渡りの長靴", 54, { weight: "light", pow: 1.35, agi: 4, eDef: ["wind", 1], tint: "#6a5040",
    desc: "絡み合う根の上を跳ぶように渡るための長靴。底に刻んだ溝が根のこぶを掴み、足場の脆い縦穴でも決して踏み外さない。" })),
  sr(S("s_sr5_barkshield", "大樹の樹皮盾", 57, { shape: "round", pow: 1.35, hp: 24, bRes: 0.18, tint: "#7a5a40",
    desc: "魂喰らいの大樹から剥がれ落ちた樹皮で作った円盾。何百年も魂を吸ってきた樹皮は、霧の吐息も呪文の炎も受け流す。" })),
  sr(S("s_sr5_burlbuckler", "木こぶの小盾", 55, { shape: "buckler", pow: 1.35, eDef: ["wind", 1], aRes: { sleep: 0.2 }, tint: "#8a6a40",
    desc: "古木のこぶを輪切りにして削り出した小盾。渦巻く木目が受けた爪や牙を外へ外へと流し、霧に混じる眠りの鱗粉さえ盾の縁で払い落とす。" })),
  sr(S("s_sr5_fireflyorb", "蛍火の宝珠", 58, { shape: "orb", pow: 1.35, eAtk: ["fire", 1], tint: "#d8e070",
    desc: "霧の森で道を照らす蛍を、何百匹と玻璃の球に集めて封じた宝珠。呪文を唱えれば蛍火がいっせいに燃え立ち、霧をまとって飛ぶ羽の魔物を焼き落とす。" })),
  sr(S("s_sr5_herbalbook", "朽ち小屋の薬草帳", 60, { shape: "tome", pow: 1.35, aRes: { charm: 0.2, confuse: 0.2 }, bRes: 0.15, tint: "#7a8a5a",
    desc: "地の底の小屋で、ひとりの老いた操霊師が森の草木を書き留めた薬草帳。読み上げる祈りに薬草の知恵が乗って傷を癒し、霧の惑わしや魅了の囁きから読み手の心を守る。" })),
  sr(A("a_sr5_gardenrobe", "庭師の長衣", 60, { aRes: { charm: 0.3, confuse: 0.2 }, shape: "robe", pow: 1.35, mp: 18, int: 6, eDef: ["fire", 1], tint: "#4a6a50",
    desc: "大樹の根を手入れした庭師がまとった長衣。宰相府の紋がほどかれ、いまはただ、着る者の心を誘いの囁きから守っている。" })),
  sr(H("h_sr5_lampcrown", "灯の木の冠", 63, { aRes: { charm: 0.3, sleep: 0.25 }, magStat: "pie", shape: "circlet", weight: "cloth", pow: 1.35, mp: 14, tint: "#c0e0b0",
    desc: "魂の灯を実らせた木の枝を編んだ冠。灯のひとつひとつが小さく祈りを唱え、着ける者の癒しの力を澄ませる。" })),
  sr(R("r_sr5_soulfruit", "魂の実の首飾り", "amulet", 66, { aRes: { poison: 0.3, paralyze: 0.25 }, hp: 30, pie: 4, eDef: ["wind", 1], tint: "#a0d8a0",
    desc: "魂の実る木から落ちた実を、琥珀に閉じ込めた首飾り。実の中で小さな顔が眠り、持ち主の身に入り込む毒と痺れを代わりに引き受ける。" })),

  // ===== レジェンドレア (全職共通・固有効果) =====
  lr(W("lr_l5_heartcleaver", "心臓断ちの大鉈", "ax", 62, { pow: 1.45, two: true, eAtk: ["fire", 2], hp: 28, eff: { multistrike: 2 }, tint: "#ff7a40",
    desc: "師が大樹の太い根を断ったと伝わる大鉈。振り下ろせば刃は二度閃き、焼けた切り口から霧の魔物を燃やし尽くす。" })),
  lr(W("lr_l5_gardenershears", "庭師の黄金鋏", "dg", 63, { pow: 1.45, eAtk: ["wind", 2], agi: 8, eff: { actFirst: true }, tint: "#e8c050",
    desc: "三百年、大樹の根を切り揃えてきた黄金の鋏の片刃。持ち主の手は庭師のように迷いなく動き、どんな戦いでも真っ先に刃を入れる。" })),
  lr(A("lr_l5_barkplate", "大樹の心材鎧", 64, { pow: 1.6, hp: 34, eff: { regen: 0.06 }, eDef: ["fire", 2], tint: "#6a4a30",
    desc: "大樹の心材を削り出した鎧。いまも樹液がかすかに巡り、着る者の傷を若木の芽吹きのように塞いでいく。" })),
  lr(R("lr_l5_lampseed", "灯の種の指輪", "ring", 65, { pow: 1.6, hp: 26, pie: 8, eff: { autoRevive: 0.3 }, tint: "#b0f0c0",
    desc: "魂の灯を宿したまま眠る種を、銀の台座に据えた指輪。持ち主が倒れると種が芽吹き、一度だけ魂を地上へ引き戻す。" })),
  lr(H("lr_l5_wedgehelm", "くさび打ちの兜", 67, { weight: "heavy", pow: 1.6, hp: 30, eff: { counter: 0.35 }, tint: "#5a5a64",
    desc: "大樹の主にくさびを打ち込んだ操霊師の兜。打たれれば必ず打ち返す槌の執念が宿り、受けた一撃にくさびのような一撃を返す。" })),
  lr(R("lr_l5_silvercore", "銀業の芯", "amulet", 68, { pow: 1.6, hp: 28, luk: 10, eff: { soulUp: 0.3 }, tint: "#d8e0f0",
    desc: "銀業の隠れ里の底で見つかる、銀に溶けた魂の芯。持ち主のまわりに漂う魂を呼び寄せ、より多くの Soul を手元へ集める。" })),
];
