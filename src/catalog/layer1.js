// 第1層「墓地」の逸品 — スーパーレア (橙) とレジェンドレア (赤)
//
// 第1層 (迷宮1-5) のドロップ窓 (基準R1 ±2 = 隠しLv 1-30) に収めた、墓域ゆかりの特別な装備。
// 隠しLvを層の窓より上に置くと、拾った1本で層の敵を大きく追い越してしまう (敵は rank1-3)。
// スーパーレアは同じ隠しレベルの標準装備より大きく強く (pow 1.3-1.4)、属性や副能力を帯びる。
// レジェンドレアは全職共通の1点もので、固有の戦闘効果 (eff) を持つ。実プレイ時間で抽選され
// (平均4〜5時間に1つ)、未鑑定で手に入る — 商店で鑑定するまで正体は伏せられる。
// id は append-only (セーブ/図鑑が参照する)。
import { W, S, A, H, F, G, R } from "./defs.js";

const sr = (it) => { it.rar = "sr"; it.layer = 1; return it; };
// LR: tier 1 = 第1層の帯。exclusive で通常のランク窓抽選から外し、時間抽選でのみ出す
const lr = (it) => { it.rar = "lr"; it.lr = 1; it.layer = 1; it.exclusive = true; return it; };

export const LAYER1_ITEMS = [
  // ===== スーパーレア: 武器 =====
  sr(W("w_sr1_mourningdagger", "弔鐘の短剣", "dg", 6, { pow: 1.35, luk: 4, crit: 0.06, tint: "#b8b0c8",
    desc: "葬送の鐘を鋳潰して鍛えたという細身の短剣。刃を振ると微かに鐘の余韻が鳴り、急所へ吸い寄せられるように滑り込む。" })),
  sr(W("w_sr1_bonereaver", "骨砕きの墓守剣", "ls", 9, { pow: 1.35, eAtk: ["light", 1], tint: "#e8dcb0",
    desc: "代々の墓守が眠りを破った死者を還すために振るった長剣。鍔元に刻まれた祈りの文字が、骸の骨を真っ直ぐに断ち割る。" })),
  sr(W("w_sr1_candlestaff", "葬送の燭台杖", "st", 12, { pow: 1.35, eAtk: ["fire", 1], int: 3, tint: "#e09a50",
    desc: "葬列の先頭で掲げられた燭台を杖に仕立てたもの。決して消えぬ蝋の火が術者の呪文に宿り、闇に潜む者を焼き払う。" })),
  sr(W("w_sr1_sextonaxe", "墓掘りの大斧", "ax", 14, { pow: 1.3, two: true, hp: 12, tint: "#8a7a62",
    desc: "凍てついた墓土をも割る墓掘り人の大斧。幾千の棺を埋めてきた刃は重く、振り下ろせば骸の群れごと地へ還す。" })),
  sr(W("w_sr1_gravekatana", "墓標斬り", "kt", 18, { pow: 1.35, agi: 3, tint: "#c8d0e0",
    desc: "墓標の石さえ一太刀で両断したと伝わる無銘の刀。刃文は月光のように冷たく、抜けば辺りの死者が息を潜める。" })),
  sr(W("w_sr1_censer", "聖灰の香炉鎚", "mc", 22, { pow: 1.3, eAtk: ["light", 1], pie: 5, tint: "#f0e0a0",
    desc: "聖別した灰を詰めた香炉を頭に据えた戦鎚。打ちつけるたびに清めの灰が舞い、不浄なる者の肉と魂を焦がす。" })),
  sr(W("w_sr1_ossuaryspear", "納骨堂の長槍", "sp", 26, { pow: 1.35, vitB: 3, tint: "#d8ccb0",
    desc: "納骨堂の門を守る衛士の長槍。柄には葬られた戦士たちの名が彫られ、突き出すたび彼らの無念が穂先を押し出す。" })),
  sr(W("w_sr1_ravenbow", "鴉羽の弓", "bw", 29, { pow: 1.35, agi: 5, luk: 3, tint: "#5a5070",
    desc: "墓地の大鴉の羽で矢羽を揃えた黒い弓。放たれた矢は音もなく夜を渡り、死肉を啄む鳥のように獲物を逃さない。" })),

  // ===== スーパーレア: 防具 =====
  sr(G("g_sr1_gravediggers", "墓掘りの革手袋", 8, { role: "atk", weight: "light", pow: 1.35, hp: 8, tint: "#9a7048",
    desc: "墓土と雨に晒されて鞣し上がった分厚い革手袋。握った得物を決して離さず、骨を砕く一撃にも手首がぶれない。" })),
  sr(R("r_sr1_bonering", "骨片の指輪", "ring", 12, { pow: 1.35, hp: 18, vit: 3, tint: "#e8dcc0",
    desc: "聖人の指の骨を削り出して作られた指輪。嵌めた者の身体に死者の頑健さが移り、致命の傷をわずかに遠ざける。" })),
  sr(A("a_sr1_shroudrobe", "聖骸布の法衣", 15, { shape: "robe", pow: 1.35, mp: 10, pie: 4, tint: "#e8e4d0",
    desc: "聖者の亡骸を包んだ布を織り直した法衣。触れた祈りが澄みきって届き、纏う者の癒しの業をひときわ強める。" })),
  sr(F("f_sr1_mourners", "会葬者の沓", 18, { weight: "cloth", pow: 1.35, agi: 4, tint: "#4a4458",
    desc: "葬列に連なる者が履く柔らかな黒の沓。足音を殺して墓所を渡り、死者を起こさぬまま素早く間合いを詰められる。" })),
  sr(A("a_sr1_wardenmail", "墓守の鎖帷子", 21, { weight: "light", pow: 1.35, eDef: ["dark", 1], tint: "#8a909c",
    desc: "夜ごと墓域を巡る墓守に与えられた鎖帷子。鎖の一つひとつに魔除けの銀が混ぜられ、闇の爪をよく弾く。" })),
  sr(H("h_sr1_abbotmitre", "修道院長の司教冠", 24, { magStat: "pie", shape: "circlet", weight: "cloth", pow: 1.35, mp: 8, tint: "#e8d080",
    desc: "かつて骸の修道院を治めた長が戴いた司教冠。堕ちる前の主の信仰がまだ金糸に残り、祈る者の心を鎮める。" })),
  sr(S("s_sr1_coffinlid", "棺蓋の大盾", 27, { shape: "kite", pow: 1.35, hp: 14, tint: "#6a5a4a",
    desc: "樫の棺の蓋を鉄で補強した無骨な大盾。中にいた者の恨みが染みついており、受けた刃を重く鈍らせる。" })),
  sr(R("r_sr1_lanternamulet", "鎮魂灯の護符", "amulet", 30, { pow: 1.35, eDef: ["dark", 1], pie: 4, mp: 6, tint: "#9fd8e8",
    desc: "迷える魂を導く鎮魂の灯を封じた護符。胸元で青白く揺れる光が、闇の呪詛から持ち主の魂を守る。" })),

  // ===== レジェンドレア (全職共通・1点もの・固有効果) =====
  lr(R("lr_l1_ravenring", "夜鴉の指輪", "ring", 25, { pow: 1.6, agi: 8, luk: 5, eff: { actFirst: true }, tint: "#3a3050",
    desc: "墓地の夜を統べる大鴉の王が嘴に咥えていた黒い指輪。嵌めた者は誰より先に動き、敵が身構える前に影のように襲いかかる。" })),
  lr(R("lr_l1_phylactery", "魂匣の首飾り", "amulet", 30, { pow: 1.6, hp: 40, eff: { autoRevive: 0.3 }, tint: "#7fd8f0",
    desc: "禁術師が己の魂を封じた小さな匣。持ち主が倒れると匣が砕け、封じられた魂の欠片が一度だけ肉体を引き戻す。" })),
  lr(A("lr_l1_shroudofstillness", "静寂の聖骸布", 32, { shape: "robe", pow: 1.6, mp: 18, pie: 8, eff: { ailmentImmune: true }, tint: "#f4f0e0",
    desc: "千年眠り続けた聖女の亡骸を包んでいた布。いかなる毒も呪いも纏う者には届かず、ただ静寂だけがそこに在る。" })),
  lr(W("lr_l1_saintmace", "聖骸の鉄槌", "mc", 35, { pow: 1.6, eAtk: ["light", 2], pie: 8, eff: { regen: 0.06 }, tint: "#fff0b0",
    desc: "殉教者の遺骨を芯に封じた鉄槌。振るう者の傷を聖なる光が絶えず塞ぎ、打ち据えた不死者を一撃で塵へ還す。" })),
  lr(W("lr_l1_requiemblade", "鎮魂剣レクイエム", "ls", 38, { pow: 1.6, eAtk: ["light", 2], eff: { multistrike: 1 }, tint: "#e0e8ff",
    desc: "百の迷宮が口を開けた夜、最初の墓守が振るったと伝わる剣。刃は二度歌い、一振りのうちに死者を二度眠らせる。" })),
  lr(W("lr_l1_lichstaff", "千魂の杖", "st", 40, { pow: 1.6, eAtk: ["dark", 2], int: 10, mp: 20, eff: { spellCostMul: 0.7 }, tint: "#8a5ad0",
    desc: "千の魂を喰らった屍術師の杖。杖頭に囚われた魂が術者の代わりに呪文の代償を払い、唸り声とともに闇を放つ。" })),
  lr(W("lr_l1_abbotscythe", "骸王の大鎌", "ax", 42, { pow: 1.4, two: true, eAtk: ["dark", 2], eff: { lifesteal: 0.2 }, tint: "#5a4a6a",
    desc: "骸の修道院長が魂を刈り取るのに用いた大鎌。斬った者の生気を刃が啜り、振るう者の傷へと注ぎ込む。" })),
  lr(A("lr_l1_gravewardenplate", "墓守王の黒鎧", 45, { pow: 1.6, hp: 30, eff: { guard: 0.15 }, eDef: ["dark", 2], tint: "#2e2a36",
    desc: "百年墓域を守り抜き、死してなお立ち続けた墓守王の黒い全身鎧。あらゆる刃と呪いを、その黒鉄が肩代わりする。" })),
];
