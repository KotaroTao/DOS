// LR (レジェンドレア・専用装備) カタログ — id prefix: lr_
//
// 各職に1つだけ許された「専用武器」。指定職しか装備できないが、ドロップ帯より約5ランク
// 上 (LR5 ≒ 表示ランクR10相当) の破格の性能を持つ。宝箱を開けた瞬間に flat 2% で出現する
// 専用ドロップ層 (game.js pickLR) でのみ手に入る。
//
// 強さの基準: 戦士LR5「フランベルジュ」= 長剣 ATK+90。各カテゴリは W_MUL で按分する
//   ls90 / dg70 / kt95 / ax104 / mc99 / sp94 / bw83 / st(自動 INT≒59・ATK≒64)
// LR装飾品 (鬼神/魔神の腕輪) は %補正 (recalc の乗算レイヤー) を持つ全職共通の品。
//
// id は append-only。lr ティア (5/10/15/20) は将来 LR10〜LR20 を順次追加する。
import { W, R } from "./defs.js";

// LR フラグ付与: tier=5/10/15/20, forJob=指定職 (装飾品は省略=全職共通)
function lr(item, tier, forJob) {
  item.lr = tier;
  item.exclusive = true; // 通常 lootLv 抽選から除外
  if (forJob) item.forJob = forJob;
  return item;
}

export const LR_ITEMS = [
  // ===== LR5 専用武器 (全36職 各1) =====
  lr(W("lr_fighter5", "フランベルジュ", "ls", 90, { cls: ["fighter"], atk: 90, eAtk: ["fire", 1],
    desc: "炎をまとう波打つ刃の大剣。揺らめく刀身が斬撃に灼熱を重ね、戦士の握りにだけ完璧な均衡で応える伝説の業物。" }), 5, "fighter"),
  lr(W("lr_knight5", "騎士王の聖剣", "ls", 90, { cls: ["knight"], atk: 90, eAtk: ["light", 1],
    desc: "亡き騎士王が誓いとともに振るった聖剣。刃に宿る光が不浄を退け、盾を取る者の手にこそ真価を発揮する。" }), 5, "knight"),
  lr(W("lr_priest5", "聖光の戦鎚", "mc", 90, { cls: ["priest"], atk: 99, eAtk: ["light", 1],
    desc: "打ち下ろすたびに聖なる光が爆ぜる祝福の戦鎚。僧侶の祈りに呼応して輝きを増し、闇に巣食う者を浄化で砕く。" }), 5, "priest"),
  lr(W("lr_mage5", "灼熱の魔杖", "st", 90, { cls: ["mage"], eAtk: ["fire", 1],
    desc: "杖頭の宝珠に永遠の業火を封じた魔導士の杖。触れた術式が炎を帯び、唱える攻撃呪文を圧倒的な威力で解き放つ。" }), 5, "mage"),
  lr(W("lr_thief5", "影牙の短剣", "dg", 90, { cls: ["thief"], atk: 70, eAtk: ["dark", 1],
    desc: "光を返さぬ闇鉄の短剣。盗賊の手首に沿って消え、気配を殺したまま影から急所だけを正確に喰い破る。" }), 5, "thief"),
  lr(W("lr_bishop5", "二理の聖杖", "st", 90, { cls: ["bishop"], eAtk: ["light", 1],
    desc: "攻と癒、二つの理を一本に束ねた法杖。司教だけが相反する流れを同時に御し、光の力で術のすべてを底上げする。" }), 5, "bishop"),
  lr(W("lr_samurai5", "妖桜丸", "kt", 90, { cls: ["samurai"], atk: 95, eAtk: ["wind", 1],
    desc: "抜けば刃に桜吹雪のごとき疾風をまとう妖刀。侍の踏み込みに乗って風を裂き、一閃のうちに幾人もを斬り伏せる。" }), 5, "samurai"),
  lr(W("lr_berserker5", "血染めの巨斧", "ax", 90, { cls: ["berserker"], atk: 104, eAtk: ["fire", 1],
    desc: "無数の返り血を吸って黒ずんだ巨斧。狂戦士の怒りに共鳴して刃が熱を帯び、振るうたびに破壊の衝動を煽り立てる。" }), 5, "berserker"),
  lr(W("lr_hunter5", "風裂きの猟弓", "bw", 90, { cls: ["hunter"], atk: 83, eAtk: ["wind", 1],
    desc: "霊樹から削り出した長弓。狩人が弦を引くと風が自ら矢を捕らえ、失速も逸れもなく千里の獲物を射抜く。" }), 5, "hunter"),
  lr(W("lr_shadow5", "宵闇の暗刃", "dg", 90, { cls: ["shadow"], atk: 70, eAtk: ["dark", 1],
    desc: "黄昏時にしか鍛えられぬ闇鉄の刃。暗殺者の手に渡ると周囲の影を喰らい、持ち主の輪郭ごと闇に溶かしてしまう。" }), 5, "shadow"),
  lr(W("lr_paladin5", "聖盟の剣", "ls", 90, { cls: ["paladin"], atk: 90, eAtk: ["light", 1],
    desc: "聖典の頁に記された武装をそのまま鍛えた剣。聖騎士が掲げると刃から経文が溢れ、不浄をことごとく焼き払う。" }), 5, "paladin"),
  lr(W("lr_guardian5", "不動の鉄槌", "mc", 90, { cls: ["guardian"], atk: 99, eAtk: ["earth", 1],
    desc: "大地の重みを宿した守護騎士の戦鎚。一打ごとに足元から岩の加護が立ち上り、味方を守る壁となって敵を圧し潰す。" }), 5, "guardian"),
  lr(W("lr_spellblade5", "魔刃・烈火", "kt", 90, { cls: ["spellblade"], atk: 95, eAtk: ["fire", 1],
    desc: "魔力を炎へ変えて刃に纏わせる魔法剣士の刀。斬撃と呪文が一体となり、振り抜いた軌跡に紅蓮の尾を曳く。" }), 5, "spellblade"),
  lr(W("lr_monk5", "羅漢の金剛杵", "mc", 90, { cls: ["monk"], atk: 99, eAtk: ["wind", 1],
    desc: "悟りに至った武僧が握ったと伝わる金剛杵。打ち込むたびに疾風が渦巻き、気の力を乗せた一撃が鎧ごと相手を貫く。" }), 5, "monk"),
  lr(W("lr_hexer5", "呪詛の黒杖", "st", 90, { cls: ["hexer"], eAtk: ["dark", 1],
    desc: "おびただしい怨念を吸い込んだ漆黒の杖。呪術師の手に握られると蓄えた呪詛が牙を剥き、敵を内側から蝕んでいく。" }), 5, "hexer"),
  lr(W("lr_hermit5", "仙木の杖", "st", 90, { cls: ["hermit"], eAtk: ["earth", 1],
    desc: "千年を生きた霊木から削り出した隠修士の杖。大地の気脈と通じ、唱える術に山のごとき静かな力を与える。" }), 5, "hermit"),
  lr(W("lr_brigand5", "義賊の隠し刃", "dg", 90, { cls: ["brigand"], atk: 70, eAtk: ["wind", 1],
    desc: "袖に仕込んで風のように抜き放つ義賊の刃。軽やかな身のこなしと一体になり、狙った相手だけを音もなく仕留める。" }), 5, "brigand"),
  lr(W("lr_arcthief5", "魔導の盗刃", "dg", 90, { cls: ["arcthief"], atk: 70, eAtk: ["dark", 1],
    desc: "魔力を帯びた刃に呪印を刻んだ魔盗賊の短刀。刺すと同時に相手の魔力を掠め取り、闇へ溶けて逃げ去る。" }), 5, "arcthief"),
  lr(W("lr_crusader5", "聖戦の大剣", "ls", 90, { cls: ["crusader"], atk: 90, eAtk: ["light", 1],
    desc: "聖戦の旗のもとで振るわれた巨大な聖剣。聖戦士が掲げると刃が白く燃え上がり、邪悪を薙ぎ倒す光の刃となる。" }), 5, "crusader"),
  lr(W("lr_battlemage5", "爆炎の魔剣", "ls", 90, { cls: ["battlemage"], atk: 90, eAtk: ["fire", 1],
    desc: "刀身に炎の呪文式を編み込んだ魔闘士の剣。斬りつけた瞬間に式が暴発し、斬撃と爆炎を同時に叩き込む。" }), 5, "battlemage"),
  lr(W("lr_darkknight5", "冥黒の魔剣", "ls", 90, { cls: ["darkknight"], atk: 90, eAtk: ["dark", 1],
    desc: "持ち主の生気を糧に力を増す呪われた魔剣。魔騎士の闇に染まった魂と契りを交わし、斬った相手の命を喰らう。" }), 5, "darkknight"),
  lr(W("lr_templar5", "神殿の聖鎚", "mc", 90, { cls: ["templar"], atk: 99, eAtk: ["light", 1],
    desc: "神殿の祭壇を守るために鋳られた聖なる戦鎚。神殿騎士の信仰に応えて輝き、振り下ろす一撃で結界ごと敵を打ち砕く。" }), 5, "templar"),
  lr(W("lr_exorcist5", "祓いの銀刃", "dg", 90, { cls: ["exorcist"], atk: 70, eAtk: ["light", 1],
    desc: "祓魔の真言を刻んだ銀の短刀。祓魔師が構えると刃が清浄な光を放ち、憑いた悪霊を肉ごと斬り離して浄める。" }), 5, "exorcist"),
  lr(W("lr_warden5", "護法の杖", "st", 90, { cls: ["warden"], eAtk: ["earth", 1],
    desc: "結界の理を封じた護法師の杖。大地の守りの呪を編み、味方を覆う障壁を張りながら攻めの術をも研ぎ澄ます。" }), 5, "warden"),
  lr(W("lr_arcanist5", "秘奥の宝杖", "st", 90, { cls: ["arcanist"], eAtk: ["water", 1],
    desc: "秘術の奥義を結晶化した宝珠を頂く杖。秘術師の指先に応えて澄んだ水の魔力を巡らせ、呪文の精度を極限まで高める。" }), 5, "arcanist"),
  lr(W("lr_inquisitor5", "断罪の鉄槌", "mc", 90, { cls: ["inquisitor"], atk: 99, eAtk: ["fire", 1],
    desc: "異端を裁くために鋳られた審問官の鉄槌。罪を焼く炎が頭に宿り、振り下ろすたびに咎人を業火で断罪する。" }), 5, "inquisitor"),
  lr(W("lr_archbishop5", "大聖堂の錫杖", "st", 90, { cls: ["archbishop"], eAtk: ["light", 1],
    desc: "大聖堂の祭壇に安置されてきた荘厳な錫杖。大司教が振るうと環が天上の音色で鳴り、聖なる光で奇跡を増幅する。" }), 5, "archbishop"),
  lr(W("lr_ascetic5", "修験の金剛杵", "mc", 90, { cls: ["ascetic"], atk: 99, eAtk: ["earth", 1],
    desc: "幾度もの荒行に耐えた修験者の金剛杵。大地に根ざした不屈の気を宿し、打ち込むたびに山が崩れるような重みを伝える。" }), 5, "ascetic"),
  lr(W("lr_hero5", "勇者の聖剣", "ls", 90, { cls: ["hero"], atk: 90, eAtk: ["light", 1],
    desc: "選ばれし者だけが抜けるという伝説の聖剣。勇者の手に握られた刹那、刃は黄金に燃え立ち、いかなる闇をも斬り裂く。" }), 5, "hero"),
  lr(W("lr_asura5", "修羅の妖剣", "ls", 90, { cls: ["asura"], atk: 90, eAtk: ["fire", 1],
    desc: "戦いの果てに鬼と化した者が遺した妖剣。修羅の闘気に呼応して刃が紅蓮に染まり、振るうほどに殺意を研ぎ澄ます。" }), 5, "asura"),
  lr(W("lr_dragonknight5", "竜殺しの剣", "ls", 90, { cls: ["dragonknight"], atk: 90, eAtk: ["wind", 1],
    desc: "古竜の鱗をも断つために鍛えられた竜騎士の剣。刃に竜を狩る風の加護が宿り、空を駆ける巨竜の急所を確実に貫く。" }), 5, "dragonknight"),
  lr(W("lr_necromancer5", "死霊の骨杖", "st", 90, { cls: ["necromancer"], eAtk: ["dark", 1],
    desc: "無数の死者の骨を束ねて作った死霊術師の杖。冥府と通じて尽きせぬ闇の魔力を引き出し、攻撃呪文を死の力で満たす。" }), 5, "necromancer"),
  lr(W("lr_sage5", "賢者の天杖", "st", 90, { cls: ["sage"], eAtk: ["water", 1],
    desc: "天と地の理を究めた賢者の杖。澄んだ水の魔力を湛え、攻めの術にも癒しの術にも淀みなく力を通す万能の法具。" }), 5, "sage"),
  lr(W("lr_cardinal5", "枢機卿の聖杖", "st", 90, { cls: ["cardinal"], eAtk: ["light", 1],
    desc: "教権の頂に立つ枢機卿の聖杖。掲げれば聖堂の鐘が遠く鳴り響くといい、注がれた祈りを天上の光へと変えて放つ。" }), 5, "cardinal"),
  lr(W("lr_archmage5", "大魔導の星杖", "st", 90, { cls: ["archmage"], eAtk: ["dark", 1],
    desc: "天の星々と契約した大魔導の杖。杖頭に小さな暗黒星を宿し、世界の理を歪めるほどの魔力を攻撃呪文へ注ぎ込む。" }), 5, "archmage"),
  lr(W("lr_chaplain5", "護教の聖鎚", "mc", 90, { cls: ["chaplain"], atk: 99, eAtk: ["light", 1],
    desc: "信徒を守る盾として鋳られた護教官の戦鎚。掲げると淡い光の膜が味方を包み、振るえば不浄を打ち払う聖光が爆ぜる。" }), 5, "chaplain"),

  // ===== LR 装飾品 (全職共通・%補正) =====
  lr(R("lr_oni", "鬼神の腕輪", "ring", 90, { mult: { hp: 0.2, atk: 0.2 }, tint: "#cf3b34",
    desc: "鬼神の魂を封じた猛々しい腕輪。嵌めた者の肉体に鬼の膂力が漲り、生命力と一撃の重みを二割も底上げする。" }), 5),
  lr(R("lr_majin", "魔神の腕輪", "amulet", 90, { mult: { mp: 0.2, int: 0.2, pie: 0.2 }, tint: "#7a4ac0",
    desc: "魔神の知を封じた妖しい腕輪。嵌めた者の魂に魔の叡智が流れ込み、魔力と攻・癒の術の冴えを二割も引き上げる。" }), 5),
];
