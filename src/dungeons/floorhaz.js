// 床の仕掛け (足元の害) の見た目と言葉 — 2026-10 ユーザーの指示
// 「どの迷宮も毒の沼と落とし穴では世界観が壊れる。攻略の手間を増やさず、世界観を強めたい」
//
// 仕組みは2つだけ (数値も避け方もこれまでどおり):
//   fall = 落ちる床 (盤面の cell.type "pit")    踏むと1つ下の階へ落ちる。傷は負わない
//   harm = 蝕む床 (盤面の cell.type "poison")   踏むと隊全体が傷む (隠修士のパッシブ「悪路渡り」・浮遊で避けられる)
// 迷宮ごとに「どちらを置くか・何に見せるか」を台帳 (world.js の floorHaz) で決める。置かない迷宮には出ない。
// 奈落は層ごとの既定 (LAYER_FLOOR_HAZ)。見た目は game.js (穴・床の光) と crypt.js (床の染み) が look を読む。
// このファイルは game.js も ui も import しない。キーはセーブに残らない (迷宮の設定から引く) が、名前は全体で重複させない。
//
// 欄:
//   name  画面に出す名前          desc  土地の言葉で一行 (出撃画面の「足元」)
//   fall の look: shape hole (丸い穴) / crack (地割れ) / grate (格子の外れた口) / trapdoor (落とし戸) / square (石組みの四角い口)
//                 deco 縁の飾り roots (穴を渡る根) / timber (坑木の枠) / rubble (崩れた石塊) / snow (縁の雪) — 省略可
//                 rim 縁の石 / chip 縁の欠け / core 穴の闇 [中, 中ほど, 縁] / mote 昇る粒 / glow 穴の照り "r,g,b" (無ければ null) / water 水面の波紋
//                 line 落ちた時の一文
//   harm の look: stain [縁の影, 縁の照り, 中ほど, 芯, 斑点] (r,g,b の配列。床に焼き込む染み) / glow 照りの色 "r,g,b"
//                 fx bubble (泡と靄) / ember (火の粉) / frost (霜のきらめき) / spark (走る火花) / spore (漂う胞子) / glint (光る切っ先) / soul (昇る魂の光)
//                 fxCol 粒の色 / mist 立ちのぼる靄 "r,g,b" (無ければ null)
//                 verb 隊がどうなったか (「隊全体が〜」) / die 倒れた時 (「〇〇は〜」) / flash 画面の明滅 / accent 札の色
//                 toxic 毒を含む (毒消しの書きつけの恵みが効く) / bog 沼 (特別な階「毒の沼」が出る土地)

export const FLOOR_HAZ = {
  // ===== 落ちる床 =====
  grate: { kind: "fall", name: "外れた格子蓋", desc: "錆びて外れた排水の格子。黒い水の音が下から響く",
    look: { shape: "grate", rim: "#2e2c28", chip: "#4a463e", core: ["#000000", "#04070a", "#10161a"], mote: "#6f8f8c", glow: null, water: true },
    line: "格子蓋が外れた！ 隊は黒い水といっしょに、下の階へ流れ落ちた…" },
  mineshaft: { kind: "fall", name: "古い竪坑", desc: "坑木の朽ちた竪坑。鎖の音が、底のほうへ消えていく",
    look: { shape: "hole", deco: "timber", rim: "#3a3022", chip: "#5a4630", core: ["#000000", "#050403", "#141008"], mote: "#8a8070", glow: null },
    line: "坑木が折れた！ 隊は古い竪坑を、下の階まで滑り落ちていく…" },
  quarry: { kind: "fall", name: "石切りの穴", desc: "石を切り出したあとの深い穴。縁の石はもろい",
    look: { shape: "hole", deco: "rubble", rim: "#58544c", chip: "#76716a", core: ["#000000", "#07070a", "#1c1b1a"], mote: "#a8a296", glow: null },
    line: "縁の石が崩れた！ 隊は石切りの穴の底、ひとつ下の階へ落ちていく…" },
  collapse: { kind: "fall", name: "抜け落ちた石床", desc: "百年の重みで抜けた石床。下の階の闇がのぞく",
    look: { shape: "hole", deco: "rubble", rim: "#2a2622", chip: "#4a423a", core: ["#000000", "#050406", "#141012"], mote: "#8a8070", glow: null },
    line: "足元の石床が抜けた！ 隊は瓦礫といっしょに、下の階へ落ちていく…" },
  oubliette: { kind: "fall", name: "忘れ穴の落とし戸", desc: "囚人を落として忘れるための床の戸。留め金がゆるんでいる",
    look: { shape: "trapdoor", rim: "#2c2620", chip: "#5a4632", core: ["#000000", "#040303", "#120e0c"], mote: "#7a7064", glow: null },
    line: "落とし戸が開いた！ 隊は忘れ穴を、ひとつ下の階まで落ちていく…" },
  roothole: { kind: "fall", name: "根の穴", desc: "根が腐って口を開けた穴。湿った土の匂いがする",
    look: { shape: "hole", deco: "roots", rim: "#26301e", chip: "#5a4628", core: ["#000000", "#040603", "#10140a"], mote: "#a8c070", glow: null },
    line: "腐った根が崩れた！ 隊は根の穴を、ひとつ下の階へ転がり落ちていく…" },
  sunken: { kind: "fall", name: "水底の抜け穴", desc: "沈んだ床の抜け穴。水が下の階へ流れ込んでいる",
    look: { shape: "hole", rim: "#24302e", chip: "#3a4a46", core: ["#000206", "#03101a", "#0c2228"], mote: "#7ab8c0", glow: null, water: true },
    line: "床石が水に抜けた！ 隊は流れに呑まれ、下の階へ押し流された…" },
  well: { kind: "fall", name: "井戸の縦穴", desc: "古い井戸から枝分かれした縦穴。願いの品が底へ落ちていく",
    look: { shape: "hole", rim: "#4a4640", chip: "#66605a", core: ["#000206", "#050c12", "#141c20"], mote: "#9ab8c0", glow: null, water: true },
    line: "縦穴の縁が崩れた！ 隊は願いの品といっしょに、下の階へ落ちていく…" },
  floorboard: { kind: "fall", name: "抜けた床板", desc: "水を吸って腐った書庫の床板。踏めば下の書架へ抜ける",
    look: { shape: "trapdoor", rim: "#2a241c", chip: "#5a4a34", core: ["#000000", "#040406", "#121014"], mote: "#b8ac90", glow: null },
    line: "腐った床板が抜けた！ 隊は紙の束といっしょに、下の階へ落ちていく…" },
  fissure: { kind: "fall", name: "地割れ", desc: "赤く脈打つ岩の割れ目。底から熱い風が吹き上げる",
    look: { shape: "crack", rim: "#2a1a14", chip: "#4a2a1a", core: ["#3a0800", "#120200", "#1a0a06"], mote: "#ff9a4a", glow: "255,110,40" },
    line: "岩が割れた！ 隊は熱い風に巻かれながら、地割れを下の階へ落ちていく…" },
  icecrack: { kind: "fall", name: "氷の割れ目", desc: "吹き上げる風に削られた氷棚の割れ目。青い闇が深い",
    look: { shape: "crack", rim: "#4e6a80", chip: "#9ab8cc", core: ["#00040c", "#04101e", "#16304a"], mote: "#dfefff", glow: "120,180,255" },
    line: "氷が割れた！ 隊は青い割れ目を、ひとつ下の棚まで滑り落ちていく…" },
  cornice: { kind: "fall", name: "雪だまりの穴", desc: "吹き溜まった雪がひさしのように張り出し、下は空洞になっている",
    look: { shape: "hole", deco: "snow", rim: "#b8c8d6", chip: "#e0ecf4", core: ["#04080e", "#0c1622", "#2a3a4c"], mote: "#ffffff", glow: null },
    line: "雪だまりが崩れた！ 隊は雪煙といっしょに、下の階へ落ちていく…" },
  mudhole: { kind: "fall", name: "底なしの泥穴", desc: "黒い泥の穴。沈んだものは、ひとつ下の岸に吐き出される",
    look: { shape: "hole", rim: "#2a2a18", chip: "#46442a", core: ["#000000", "#060802", "#14160a"], mote: "#8a9a50", glow: null, water: true },
    line: "泥に足を取られた！ 隊は泥穴に呑まれ、ひとつ下の階へ吐き出された…" },
  moundpit: { kind: "fall", name: "塚の穴", desc: "疫病の死者を投げこんだ塚の穴。奈落の沼まで続いている",
    look: { shape: "hole", deco: "rubble", rim: "#3a3428", chip: "#5a5038", core: ["#000000", "#060602", "#16140c"], mote: "#9aa860", glow: null },
    line: "塚の土が崩れた！ 隊は死者の土といっしょに、下の階へ落ちていく…" },
  stairwell: { kind: "fall", name: "吹き抜け", desc: "螺旋階段のまん中の吹き抜け。風が下から鳴りながら昇ってくる",
    look: { shape: "square", rim: "#2a2e38", chip: "#5a6070", core: ["#000000", "#04050a", "#121620"], mote: "#b8c8ff", glow: null },
    line: "踏み外した！ 隊は吹き抜けを、ひとつ下の踊り場まで落ちていく…" },
  cloudgap: { kind: "fall", name: "雲の切れ間", desc: "庭の崩れたところに、雲の切れ間がのぞく。下には塔の壁",
    look: { shape: "hole", rim: "#c8ccd4", chip: "#eceff4", core: ["#1a2232", "#2a3448", "#5a6478"], mote: "#ffffff", glow: null },
    line: "雲を踏み抜いた！ 隊は雲の切れ間を、下の階まで落ちていく…" },

  // ===== 蝕む床 =====
  sewage: { kind: "harm", name: "汚水のよどみ", desc: "黒い水がよどんだ溜まり。触れた肌がただれる",
    look: { stain: [[22, 26, 20], [70, 84, 60], [40, 48, 34], [52, 62, 42], [120, 140, 100]], glow: "100,150,110", fx: "bubble", fxCol: "#9ab89a", mist: "80,110,90" },
    verb: "肌をただれさせた", die: "汚水に沈んだ…", flash: "#3a5040", accent: "#5a7a5e", toxic: true },
  minegas: { kind: "harm", name: "坑気のたまり", desc: "くぼみに溜まった坑道の悪い気。息を吸えば胸が焼ける",
    look: { stain: [[30, 28, 14], [110, 100, 40], [62, 58, 26], [80, 74, 32], [170, 160, 80]], glow: "200,180,70", fx: "bubble", fxCol: "#d8c878", mist: "170,150,60" },
    verb: "悪い気にむせた", die: "坑気に倒れた…", flash: "#6a6020", accent: "#a89a48", toxic: true },
  caltrop: { kind: "harm", name: "撒かれた鉄菱", desc: "百年前の籠城で撒かれた鉄の菱。錆びても刺さる",
    look: { stain: [[24, 20, 18], [92, 70, 54], [48, 40, 34], [62, 50, 40], [170, 160, 150]], glow: "200,170,140", fx: "glint", fxCol: "#d8d0c4", mist: null },
    verb: "足を刺された", die: "鉄菱に倒れた…", flash: "#5a3a2a", accent: "#9a7a62" },
  cinder: { kind: "harm", name: "くすぶる燃えさし", desc: "百年燃える狼煙の燃えさし。踏めば足が焼ける",
    look: { stain: [[26, 16, 12], [140, 70, 30], [50, 30, 22], [90, 40, 20], [255, 160, 80]], glow: "255,120,50", fx: "ember", fxCol: "#ffa050", mist: "90,80,76" },
    verb: "足を焼かれた", die: "燃えさしに倒れた…", flash: "#7a3010", accent: "#d07040" },
  spore: { kind: "harm", name: "胞子の床", desc: "胞子をふく苔の床。吸いこめば体の奥から蝕まれる",
    look: { stain: [[26, 30, 14], [110, 120, 50], [54, 66, 26], [70, 86, 30], [200, 210, 120]], glow: "170,200,90", fx: "spore", fxCol: "#d8e090", mist: "140,170,80" },
    verb: "胞子を吸い、体を蝕まれた", die: "胞子に倒れた…", flash: "#5a6a20", accent: "#9aac50", toxic: true },
  rootsuck: { kind: "harm", name: "吸い根の床", desc: "床を這う細い根。足に絡み、魂を少しずつ吸う",
    look: { stain: [[22, 18, 22], [90, 60, 90], [44, 32, 40], [60, 40, 56], [190, 150, 220]], glow: "170,120,220", fx: "soul", fxCol: "#c8a8f0", mist: null },
    verb: "根に魂を吸われた", die: "根に魂を吸いつくされた…", flash: "#4a2a5a", accent: "#9a78c0" },
  holywater: { kind: "harm", name: "よどんだ聖水", desc: "三百年よどんだ聖水。祈りは腐り、いまは肌を焼く",
    look: { stain: [[14, 26, 30], [60, 120, 130], [24, 50, 58], [30, 70, 80], [160, 220, 220]], glow: "90,200,210", fx: "bubble", fxCol: "#b8f0f0", mist: "90,170,180" },
    verb: "肌を焼かれた", die: "聖水に沈んだ…", flash: "#1a5a6a", accent: "#5aaab4" },
  scorch: { kind: "harm", name: "灼けた床", desc: "下から火に炙られた岩の床。踏めば足が焼ける",
    look: { stain: [[30, 14, 10], [160, 60, 20], [60, 24, 14], [110, 40, 16], [255, 170, 70]], glow: "255,100,40", fx: "ember", fxCol: "#ff9a40", mist: null },
    verb: "足を焼かれた", die: "炎に倒れた…", flash: "#8a2a08", accent: "#e06a30" },
  hotash: { kind: "harm", name: "降り積もった熱灰", desc: "天井から降り続ける灰。積もった灰の下はまだ熱い",
    look: { stain: [[30, 26, 24], [110, 96, 90], [56, 50, 48], [76, 66, 60], [255, 140, 70]], glow: "230,110,60", fx: "ember", fxCol: "#e8a070", mist: "120,112,108" },
    verb: "灰の熱に焼かれた", die: "灰に埋もれた…", flash: "#5a3a2a", accent: "#b08070" },
  broth: { kind: "harm", name: "こぼれた煮え汁", desc: "釜からあふれた樹液の煮え汁。甘い匂いのまま煮えたぎる",
    look: { stain: [[34, 20, 8], [170, 110, 30], [80, 44, 12], [120, 66, 16], [255, 210, 110]], glow: "255,170,60", fx: "bubble", fxCol: "#ffd080", mist: "200,150,90" },
    verb: "煮え汁を浴びて焼かれた", die: "煮え汁に倒れた…", flash: "#8a5a10", accent: "#e0a040" },
  obsidian: { kind: "harm", name: "黒曜の破片", desc: "割れた黒いガラスの破片。刃物より鋭い",
    look: { stain: [[10, 8, 12], [60, 50, 74], [20, 16, 24], [30, 26, 38], [200, 190, 230]], glow: "160,140,220", fx: "glint", fxCol: "#e0d8ff", mist: null },
    verb: "足を切り裂かれた", die: "破片に倒れた…", flash: "#2a2040", accent: "#8a7ab8" },
  frost: { kind: "harm", name: "凍てつく床", desc: "吹き上げる風で凍りついた床。触れた足から凍えていく",
    look: { stain: [[20, 30, 44], [120, 170, 210], [50, 76, 104], [70, 104, 140], [230, 245, 255]], glow: "150,200,255", fx: "frost", fxCol: "#e8f4ff", mist: "170,210,240" },
    verb: "足から凍えた", die: "凍りついた…", flash: "#3a6a9a", accent: "#8ab8e0" },
  meltwater: { kind: "harm", name: "氷の解け水", desc: "氷の壁から流れる解け水。浸かれば骨まで冷える",
    look: { stain: [[16, 26, 40], [90, 140, 190], [34, 58, 90], [44, 80, 120], [200, 230, 255]], glow: "120,180,240", fx: "frost", fxCol: "#cfe8ff", mist: "140,190,230" },
    verb: "骨まで冷えた", die: "冷たい水に沈んだ…", flash: "#2a5a8a", accent: "#7aa8d8" },
  swamp: { kind: "harm", name: "毒の沼", desc: "底まで落ちて腐った魂の泥。足を取られ、体を蝕む",
    look: { stain: [[26, 34, 12], [96, 128, 30], [48, 78, 18], [66, 104, 22], [150, 200, 70]], glow: "120,210,60", fx: "bubble", fxCol: "#c8f070", mist: "110,170,50" },
    verb: "泥に足を取られ、蝕まれた", die: "毒に沈んだ…", flash: "#5a8a2a", accent: "#5a8a2a", toxic: true, bog: true },
  plague: { kind: "harm", name: "疫病の汚泥", desc: "疫病の死者がとけた泥。いまも病の気を吐いている",
    look: { stain: [[30, 30, 16], [120, 116, 50], [62, 60, 28], [84, 80, 34], [200, 200, 110]], glow: "180,180,70", fx: "bubble", fxCol: "#e0dc90", mist: "150,150,70" },
    verb: "病の気に蝕まれた", die: "病に倒れた…", flash: "#6a6a20", accent: "#a8a450", toxic: true, bog: true },
  charged: { kind: "harm", name: "帯電した床", desc: "雷を吸った鉄の床。踏めば体を雷が走る",
    look: { stain: [[18, 20, 34], [80, 100, 170], [34, 40, 66], [46, 56, 96], [210, 225, 255]], glow: "140,170,255", fx: "spark", fxCol: "#e0e8ff", mist: null },
    verb: "雷に打たれてしびれた", die: "雷に倒れた…", flash: "#3a4aa0", accent: "#8aa0e8" },
};

// 置き場所の既定 (台帳に floorHaz が無い時・奈落の層)。null = その仕掛けを置かない
export const LAYER_FLOOR_HAZ = {
  1: { fall: null, harm: null },                 // 地下墓地: 墓所に沼は無い
  2: { fall: "grate", harm: "sewage" },          // 下水
  3: { fall: "mineshaft", harm: "minegas" },     // 坑道
  4: { fall: "collapse", harm: "caltrop" },      // 捨て砦
  5: { fall: "roothole", harm: "spore" },        // 魂脈の根と霧の森
  6: { fall: "sunken", harm: "holywater" },      // 沈んだ旧都
  7: { fall: "fissure", harm: "scorch" },        // 灼熱の洞
  8: { fall: "icecrack", harm: "frost" },        // 氷結回廊
  9: { fall: "mudhole", harm: "swamp" },         // 毒沼
  10: { fall: "stairwell", harm: "charged" },    // 嵐の尖塔
};
// まだ迷宮の無い層 (第11層から) の奈落は、どの層の既定にも当てはまらないので毒の沼のまま
const FALLBACK = { fall: "collapse", harm: "swamp" };

export function layerFloorHaz(L) {
  return { ...(LAYER_FLOOR_HAZ[Math.max(1, Math.floor(L || 1))] || { fall: null, harm: FALLBACK.harm }) };
}
// その迷宮の仕掛けの定義 (置いていなくても、異変・誓約で敷かれた時のために既定へ落とす)
export function hazSkin(cfg, kind) {
  const k = cfg && cfg.floorHaz ? cfg.floorHaz[kind] : null;
  return FLOOR_HAZ[k] || FLOOR_HAZ[FALLBACK[kind]];
}
// その迷宮が台帳でその仕掛けを置いているか (置いていれば定義を、無ければ null)
export function hazPlaced(cfg, kind) {
  const k = cfg && cfg.floorHaz ? cfg.floorHaz[kind] : null;
  return (k && FLOOR_HAZ[k]) || null;
}

// 読み込み時の検査: 種類・欄の過不足・名前の重複
{
  const names = new Set();
  for (const [id, s] of Object.entries(FLOOR_HAZ)) {
    if (s.kind !== "fall" && s.kind !== "harm") throw new Error(`floorhaz: ${id} の kind が不正`);
    if (!s.name || !s.desc || !s.look) throw new Error(`floorhaz: ${id} に name/desc/look が無い`);
    if (names.has(s.name)) throw new Error(`floorhaz: 名前「${s.name}」が重複`);
    names.add(s.name);
    if (s.kind === "fall") {
      if (!["hole", "crack", "grate", "trapdoor", "square"].includes(s.look.shape) || !s.line || (s.look.deco && !["roots", "timber", "rubble", "snow"].includes(s.look.deco))) throw new Error(`floorhaz: ${id} の shape/line が不正`);
    } else {
      if (!Array.isArray(s.look.stain) || s.look.stain.length !== 5) throw new Error(`floorhaz: ${id} の stain は5色`);
      if (!["bubble", "ember", "frost", "spark", "spore", "glint", "soul"].includes(s.look.fx)) throw new Error(`floorhaz: ${id} の fx が不正`);
      if (!s.verb || !s.die || !s.flash || !s.accent) throw new Error(`floorhaz: ${id} に verb/die/flash/accent が無い`);
    }
  }
  for (const [L, v] of Object.entries(LAYER_FLOOR_HAZ)) for (const kind of ["fall", "harm"]) {
    if (v[kind] != null && (!FLOOR_HAZ[v[kind]] || FLOOR_HAZ[v[kind]].kind !== kind)) throw new Error(`floorhaz: 第${L}層の ${kind} が不正`);
  }
}
