// ドット絵モンスターの定義と描画
// 各モンスターは art(文字グリッド) + palette(文字->色) で定義。
// '.' は透明。グリッドは行ごとに任意長でよく、最大幅に右側を透明で揃える。

export const MONSTERS = {
  slime: {
    name: "スライム",
    maxhp: 14, atk: 5, def: 1, spd: 4, soul: 6, gold: 4,
    palette: { "0": "#15431a", "1": "#3fae46", "2": "#9be88a", "3": "#0a0a0a", "4": "#ffffff" },
    art: [
      "....0000....",
      "..00111100..",
      ".0011111100.",
      "001111111100",
      "011211112110",
      "011411114110",
      "011211112110",
      "011111111110",
      "011112211110",
      "001111111100",
      ".0011111100.",
      "..00000000..",
    ],
  },

  bat: {
    name: "ジャイアントバット",
    maxhp: 11, atk: 6, def: 2, spd: 9, soul: 7, gold: 3,
    palette: { "0": "#2a1638", "1": "#6b3fa0", "2": "#b07be0", "3": "#ff3b3b", "4": "#0a0a0a" },
    art: [
      "0..........0....",
      "00........00....",
      "010........010..",
      "0110......0110..",
      "01110.11.01110..",
      "0111101111011.10",
      ".011111441111.0.",
      "..0113443110....",
      "...01133110.....",
      "....011110......",
      ".....0220.......",
      "......00........",
    ],
  },

  kobold: {
    name: "コボルド",
    maxhp: 18, atk: 9, def: 3, spd: 6, soul: 11, gold: 9,
    palette: { "0": "#3a2410", "1": "#8a5a2b", "2": "#c98c4a", "3": "#0a0a0a", "4": "#d4504e", "5": "#b8b8c8" },
    art: [
      "..0......0...",
      "..00....00...",
      "..010..010...",
      "..01111110...",
      ".0111111110..",
      ".0131111310..",
      ".0111441110..",
      ".0011111100..",
      "5.01111110.5.",
      "550111111055.",
      "..0110011.0..",
      "..00....00...",
    ],
  },

  mimic: {
    name: "ミミック",
    maxhp: 30, atk: 12, def: 4, spd: 5, soul: 18, gold: 20,
    desc: "宝箱に化けて獲物を待つ魔物。並の個体より一回り手強いが、倒せば上質な宝箱を残す。",
    palette: {
      "9": "rgba(200,140,70,0.22)", k: "#0b090e", S: "#1a110c", s: "#33231a", n: "#544032", N: "#77604a",
      e: "#1f1e29", g: "#3c3d4b", v: "#646673", O: "#2b1e12", o: "#5e4820", y: "#957a38",
      Y: "#cdb779", d: "#68626d", f: "#928b93", q: "#2e0a0e", r: "#6e1a20", z: "#3f392f",
      B: "#857c66", W: "#c4baa0", K: "#0e0306", E: "#c8a464", H: "#4a2a16", U: "#8a3a3e",
      V: "#4a1420",
    },
    art: [
      ".......eeSSSSSSSSSSSSSSSSSSSSSSSSSSee.......",
      ".....SeveNNNNNNNnNNNNNNNNNNNNNnnnnnvekS.....",
      "...SSNNveNNNNNNNNNNNNNNNNNNNNNnnnnnvesskS...",
      "..SnnnnvennnnnnnnnnnnnnnnnnnnnsssssveSSSSk..",
      ".SnnsnnvennnnnnnnnnnnnnnnnnnnnsssssveSSSSSk.",
      ".SnnnnnvennnnnnnnnnsnnnnnnnnnnsssssveSSSSSk.",
      ".SsssssvesssssssssssssssssssssSSSSSveSSSSSk.",
      ".SSSSSSveSSSSSSSSSSSSSSSSSSSSSSSSSSveSSSSSk.",
      ".SsssssvessssssSssssssssssssssSSSSSveSSSSSk.",
      ".SsssssvessssssssssSssssssssssSSSSSveSSSSSk.",
      ".SsssssvesssssssssssssssssssssSSSSSveSSSSSk.",
      ".egggggvegggggeeeeeeeeeeeeeeeeeeeeeveeeeeek.",
      "..kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk..",
      "..qqqqqqqqqqUqqqqqqqqqqqqUqqqqqqqqqqqqqqqk..",
      "..qKKzKzKKzzKzzKzKKKzKzKKzKKzzKKzKzzKzzKKk..",
      "..qKKzKBKKBzKBzKBKKKzKzKKBKKBzKKBKBzKBzKKk..",
      "..qKKKKWKKBz9BzHBKK9KKKKKBKKBzKKBKBzKBzKKk..",
      "..qKKKKKKKBzKBzEWEHKKKKKKB9HBzH9WKBzKBzKKk..",
      "..qKKKKKKKBz9WzHHKK9KKKKKWKKBKKKKKWKKBWKKk..",
      "..qKKKKKKKBKKBKKKKKKKVUUKKKKWKKKKKBKKWBKKk..",
      "..qKKKKKKKWKKBzKWKKKWVqUUWKKKWKKKKBzKKBzKk..",
      "..qKKWKKWKBKKBzKBKKKVKKqqUKKKBKKWKBzKKBzKk..",
      "..qKKBKKBKBKKBzKBKKKKqqKqVUKKBKKBKBzKKBzKk..",
      "..qKKzKKzKzKKzzKzKKKKKKqKqUUKzKKzKzzKKzzKk..",
      "..qqqqqqqUqqqqqqqqqqqqKKqKqUqUqqqqqqqqqqqk..",
      ".evvvvvvvvqgdqgggqqggqgKKqKVUqgeeqeedeeeeek.",
      ".SnnnnqgesssdsqsssssssssKKKqUSSSSSSgdqSSSSk.",
      ".SnnnnrgesoydoqssssssssssKqqUSSSSSSgfrSSSSk.",
      ".SssssrveoyYfooSSSSSSSSSSKqKUSSSSSSveqSSSSk.",
      ".SnnnnqgeyykkoosssssssssssKKqSSSSSSgeSSSSSk.",
      ".SnnnnngeoykkoOsSssssssSssKKqSSSSSSgeSSSSSk.",
      ".SnnnnngeooykoOsssssssssssKKqSSSSSSgeSSSSSk.",
      ".SsssssgeSoOOOSSSSSSSSSSSSKKUSSSSSSgeSSSSSk.",
      ".SnnnnnvessSssssssssssssssKKUSSSSSSveSSSSSk.",
      ".SnnnnngesssssssssssssssssKqUSSSSSSgeSSSSSk.",
      ".SnnnnngessssssssssSssssssqqSSSSSSSgeSSSSSk.",
      ".eggggggggggeeeeeeeeeeeeeKVUeeeeeeeeeeeeeek.",
      "..ksssskkkkkkkkkkkkkkkkkkKqkkkkkkkkksssskk..",
      "..SSnsSk.................kUk.......SSnsSk...",
      "..zzkzkzk.................k........zzkzkzk..",
    ],
  },

  master_mimic: {
    name: "マスターミミック",
    maxhp: 60, atk: 18, def: 6, spd: 6, soul: 40, gold: 60,
    desc: "金色に輝く宝箱の王。極めて手強いが、討ち倒せば極上の宝箱を必ず残す。",
    palette: {
      "9": "rgba(200,140,70,0.22)", k: "#0b090e", S: "#140509", s: "#270c14", n: "#3d141c", N: "#561f25",
      e: "#1f1e29", O: "#2b1e12", o: "#5e4820", y: "#957a38", Y: "#cdb779", d: "#68626d",
      f: "#928b93", u: "#0d2230", t: "#1f5470", q: "#2e0a0e", r: "#6e1a20", z: "#3f392f",
      B: "#857c66", W: "#c4baa0", K: "#0e0306", E: "#c8a464", H: "#4a2a16", U: "#8a3a3e",
      V: "#4a1420",
    },
    art: [
      "........................O.......................",
      "................O......Ook......O...............",
      "........O......Ook.....Ook.....Ook......O.......",
      ".......Ook.....Ook....OyoOk....Ook.....Ook......",
      ".......OokSSSSOyoOkSSSkyoOkSSSOyoOkSSSSkok......",
      ".....SOyoONNNNNyoONnNNNyoONNNNNyoOnnnnnyoOk.....",
      "...SSNNyONNNNNNNNNNNNNNyONNNNNNNNnnnnnnyOsskS...",
      "..SnnnnyOnnnnnnnnnnnnnnyOnnnnnnnnssssssyOSSSSk..",
      ".SnnnnnyOnnnnnnsnnnnnnnyOnnnnnnnnsssSssyOSSSSSk.",
      ".SnnnnnyOnnnnnnnnnnsnnnyrnnnnnnnnssssssyOSSSSSk.",
      ".SsssssyOssssssssssssssyqssssssssSSSSSSyOSSSSSk.",
      ".SSSSSSyOSSSSSSSSSSSSSSyOSSSSSSSSSSSSSSyOSSSSSk.",
      ".SsssssyOsSssssssssssssyOssssssssSSSSSSyOSSSSSk.",
      ".SssssSyOSssSssssssssssyOssssssssSSSSSSyOSSSSSk.",
      ".SsSsssyOssssssssssssssyOssssssssSSSSSSyOSSSSSk.",
      ".OoooooyOooooooOOOOOOOOyOOOOOOOOOOOOOOOyOOOOOOk.",
      "..kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk..",
      "..qqqqqqUqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqk..",
      "..qKzKKKzzKzKKzKzKKdzKKzKzKKKzKzzKzKKKzKzKKKzzk.",
      "..qKzKKKBzKBKKzKBKKKzKKBKBKKKBKBzKBKKKzKBKKKBzk.",
      "..qKKKKKBz9BHHHKW9KdKKKWKWKKKWKBzHBHKK9KBKKKBzk.",
      "..qKKKKKBzKBEEkEHKKdKKK9HEkH9KKBzEBkEHKKBKKKBzk.",
      "..qKKKKKBz9BHHHKK9KdKKKUUKKKKKKBzHWHKK9KBKKKBzk.",
      "..qKKKKKBzKBKKKKKKKdKKVVUWKKKKKBWKKKKKKKWKKKBzk.",
      "..qKKKKKBKKWKzKKWKKWKVKqUUKKKKKBBKBKKKKKKKKKBk..",
      "..qKKKKKWKKKzzBKBKKBKVqKqUzKKKzzBzzBKKKKWKKKWk..",
      "..qKKKKWKKWzzBKKBKKBKKqqVVUKKWKzzBzzBKKKBKKWKk..",
      "..qKKzKBKKBzBzKKBKKBKKKVKqUKKBKKzBKBzWKKBKKBKk..",
      "..qKKzKzKKWWKzKKzKKzKKKKqqUKKzKKzWWzKWBKzKKzKk..",
      "..qqqUqqqqzBqqUqqqqqqqqKqKVUqqqqqzzqqqzBqqqqqk..",
      ".OyyyyyyyWBooqoooqdooqoKVKqUoqoooqzBOOOWBOdOqOk.",
      ".SnnnnqoOWWsssssssdssssoKKqUsqSSSSSWSSSzBSdSqSk.",
      ".SnnnnroOzByyossssdssssoKKqUSrSSSSSzSSSozSfSrSk.",
      ".SssssryOzBYyyoSSSdSSSSyKKVUSqSSSSSzBSSyeeSSqSk.",
      ".SnnnnqooeerqoyossfssssoKKqUssSSSSSeeSSoOSSSSSk.",
      ".SnnnnnooyrtqqoOsssSsssoKKqSssSSSSSSSSSoOSSSSSk.",
      ".SnnnsnooyquqqoOsssssssoKKUsssSSSSSSrSSoOSSSSSk.",
      ".SsssssoOooqqoOSSSSSSSSoVVUSSSSSSSSSqSSoOSSSSSk.",
      ".SnnnnnyOsoOOOsssssssssKqqssssSSSSSSSSSyOSSSSSk.",
      ".SnnnnnoOssssSsssssssssKqUssssSSSSSSSSSoOSSSSSk.",
      ".SnnnnnoOsssSssssssssssqqUssssSSSSSSSSSoOSSSSSk.",
      ".OooooooooooOOOOOOOOOOKVUOOOOOOOOOOOOOOOOOOOOOk.",
      "..kooookkkkkkkkkkkkkkkKqkkkkkkkkkkkkkkkkkkkooook",
      "..OOooOk..............kUk.................OOooOk",
      "..zzkzkzk..............k..................zzkzkz",
      "...k.k.k...................................k.k.k",
    ],
  },

  skeleton: {
    name: "スケルトン",
    maxhp: 22, atk: 11, def: 4, spd: 7, soul: 16, gold: 12,
    palette: { "0": "#3d3d2a", "1": "#d9d4bf", "2": "#ffffff", "3": "#0a0a0a", "4": "#8a8470" },
    art: [
      "...000000....",
      "..01111110...",
      "..01311310...",
      "..01111110...",
      "..00133100...",
      "...011110....",
      "..0101101.0..",
      ".010111.1010.",
      "..0011110.0..",
      "...01..10....",
      "...01..10....",
      "..010..010...",
    ],
  },

  orc: {
    name: "オーク戦士",
    maxhp: 30, atk: 14, def: 6, spd: 5, soul: 24, gold: 20,
    palette: { "0": "#1f3315", "1": "#4f7a3a", "2": "#79a857", "3": "#0a0a0a", "4": "#d4504e", "5": "#8a8a9a", "6": "#5a3a1a" },
    art: [
      "..2......2...",
      ".021111.1120.",
      "021111111120.",
      "02131113.1120",
      "021111111120.",
      "021144441120.",
      "0211333.31120",
      "0021111110.0.",
      "65021111025.6",
      "6650211.0566.",
      "..0211.1120..",
      ".0220..0220..",
    ],
  },

  wraith: {
    name: "レイス",
    maxhp: 26, atk: 13, def: 5, spd: 10, soul: 22, gold: 18,
    palette: { "0": "#10202e", "1": "#2b5f7a", "2": "#5fb8d6", "3": "#aef0ff", "4": "#0a0a0a", "5": "#ff5577" },
    art: [
      "....0000......",
      "..00111100....",
      ".0011111100...",
      "011151151.110.",
      "011544445110..",
      "011151151110..",
      "01111111.1110.",
      ".01111111.10..",
      ".0211111120...",
      "..02111.1.20..",
      "...021120.....",
      "....0220......",
    ],
  },

  dragon: {
    name: "ヤング・ドラゴン",
    boss: true,
    maxhp: 90, atk: 22, def: 10, spd: 8, soul: 200, gold: 300,
    palette: { "0": "#3a0d0d", "1": "#9c2a2a", "2": "#d65a3a", "3": "#f2c14e", "4": "#0a0a0a", "5": "#ffd24a", "6": "#6b1414" },
    art: [
      "0..........0..",
      "010......010..",
      "0110.33..0110.",
      "01110331101110",
      "0111133221110.",
      "011153522.1110",
      "01115445.21110",
      ".011122221.10.",
      "..0112222.110.",
      "...0112110....",
      "..6601106.6...",
      ".660....066...",
    ],
  },
};

// 主人公トークン (盤面表示用)
export const HERO = {
  name: "ヒーロー",
  palette: { "0": "#1a1a24", "1": "#c8d0e0", "2": "#4a6cd4", "3": "#d4504e", "4": "#e8c47a", "5": "#8a93a8" },
  art: [
    "....33......",
    "....33......",
    "...0110.....",
    "..011110....",
    "..014410....",
    "..011110....",
    "...0220.....",
    "..022220....",
    ".50222205...",
    "..022220....",
    "...0..0.....",
    "..00..00....",
  ],
};

// 主人公戦闘スプライト 32x40 (見習い戦士: 剣・盾・革鎧)
export const HERO_BATTLE = {
  name: "ヒーロー",
  palette: {
    "o": "#201627", // 輪郭
    "S": "#f2c692", // 肌
    "s": "#cf9665", // 肌影
    "E": "#2a1c20", // 目
    "H": "#7a4a26", // 髪
    "h": "#a8703a", // 髪ハイライト
    "R": "#b03030", // 鉢巻
    "r": "#d8554a", // 鉢巻ハイライト
    "M": "#9aa6b2", // 金属
    "m": "#6e7884", // 金属影
    "W": "#e8f0f4", // 金属ハイライト
    "A": "#8a5c34", // 革鎧
    "a": "#644020", // 革鎧影
    "b": "#ab7a46", // 革鎧ハイライト
    "T": "#3f7a52", // 服(緑)
    "t": "#2c5a3c", // 服影
    "P": "#4a4458", // ズボン
    "p": "#342f40", // ズボン影
    "B": "#5c3a24", // ブーツ
    "d": "#3e2718", // ブーツ影
    "G": "#d9a93f", // 金
    "g": "#a87820", // 金影
    "L": "#cdd8e0", // 剣身
    "l": "#97a4b0", // 剣身影
    "C": "rgba(0,0,0,0.275)", // 落ち影
    "k": "#cdaa6e", // 盾木材(明)
    "K": "#a07c46", // 盾木材(暗)
  },
  art: [
    "................................", // 0
    ".....o..........................", // 1
    "....oWo.....oohHHoo.............", // 2
    "....oLlo...ohhHHHHHo............", // 3
    "....oWlo..ohhHHHHHHHo...........", // 4
    "....oWlo..oHHHHHHHHHooo.........", // 5
    "....oLlo..oRrRRRRRRRoRRo........", // 6
    "....oLlo..oHSHSSSHsHo.rRo.......", // 7
    "....oLlo..oSSESSSESso.ooo.......", // 8
    "....oLlo..oSSSSsSSSso...........", // 9
    "....oLlo..osSSsssSSso...........", // 10
    "....oLlo...oSSSSSSSo............", // 11
    "....oLlo....ooSSSoo.............", // 12
    "...oGGGgooooosSSsooooo..........", // 13
    "...oSSSooWMmoAAAAoTTto..........", // 14
    "...oSSSSSMMmobAAaoTtto..........", // 15
    "...ooGoooooobAAAaoooo...........", // 16
    ".....o....obAAAAaokkKo..........", // 17
    "..........obAAAAokGGKKo.........", // 18
    "..........obAAAAokGgKKo.........", // 19
    "..........obAAAAokKKKKo.........", // 20
    "..........oaAAAAaoKKKo..........", // 21
    "..........oaaGgaaoooo...........", // 22
    "..........oPPgGgPpo.............", // 23
    "..........oPPPPPPpo.............", // 24
    "..........oPPoooPPo.............", // 25
    "..........oPPo.oPPo.............", // 26
    "..........oPpo.oPpo.............", // 27
    "..........oPpo.oPpo.............", // 28
    "..........oPpo.oPpo.............", // 29
    "..........oBBo.oBBo.............", // 30
    "..........oBBo.oBBo.............", // 31
    "..........oBdo.oBdo.............", // 32
    ".........oBBdo.oBBdo............", // 33
    ".........oBddo.oBddo............", // 34
    ".........ooooo.ooooo............", // 35
    "................................", // 36
    ".......CCCCCCCCCCCCCCC..........", // 37
    "................................", // 38
    "................................", // 39
  ],
};

// カード用アイコン (24x24。警備兵のみ等身大の 24x46)。盤面カード (~36px) と
// ポップアップ (spriteCanvas(icon, 9) ≒ 108px) の両方で読めるよう、輪郭と明暗をはっきり付けている。
// 半透明の色 (rgba) はかすかな光暈。
export const ICONS = {
  // 宝箱: 鉄帯の木箱。蓋の継ぎ目から金の光が漏れ、縁にかすかな光暈
  chest: {
    palette: {
      "1": "rgba(220,180,90,0.16)", k: "#0b090e", S: "#1a110c", s: "#33231a", n: "#544032", N: "#77604a",
      M: "#9a8166", e: "#1f1e29", g: "#3c3d4b", v: "#646673", w: "#9a9894", x: "#d8d2c4",
      O: "#2b1e12", o: "#5e4820", y: "#957a38", Y: "#cdb779",
    },
    art: [
      "........................",
      "........................",
      ".....11111111111111.....",
      "...11kkkkkkkkkkkkkk11...",
      "..1kkwgMMMMMMMMMMwgkk1..",
      ".1kMMwgMMMMMMMMMMwgNNk1.",
      "1kNNNxgNNNNNNNNNNxgnnnk1",
      "1kNNNwgNNNNNNNNNNwgnnnk1",
      "1kssswgsssssssssswgSSSk1",
      "1knnnxgnnnoyyonnnxgsssk1",
      "1knnnwgnnoYYyyonnwgsssk1",
      "1kvYyyYyyyYkkyoYyyYyyek1",
      "1kNNNvennyykkyOnsvesssk1",
      "1kNNNvennoyykyOnsvesssk1",
      "1knnnxesssoOOOssSxeSSSk1",
      "1kNNNvennnnnnnnnsvesssk1",
      "1kNNNvennnnnnnnnsvesssk1",
      "1knnnvesssssssssSveSSSk1",
      "1kNNNxennnnnnnnnsxesssk1",
      "1kNNNvennnnnnnnnsvesssk1",
      "1knnnvesssssssssSveSSSk1",
      "1kvvvvvvvvggggggggggggk1",
      ".1kkkkkkkkkkkkkkkkkkkk1.",
      "..11111111111111111111..",
    ],
  },
  // 開封済みの空箱: 蓋は後ろへ倒れ、中は空っぽの闇 (蜘蛛の巣)
  chestOpen: {
    palette: {
      k: "#0b090e", S: "#1a110c", s: "#33231a", n: "#544032", N: "#77604a", e: "#1f1e29",
      g: "#3c3d4b", v: "#646673", w: "#9a9894", x: "#d8d2c4", O: "#2b1e12", o: "#5e4820",
      y: "#957a38", Y: "#cdb779", a: "#18161d", b: "#2c2932", c: "#46424c", d: "#68626d",
    },
    art: [
      "......eeSSSSSSSSee......",
      ".....egennnnsssSgek.....",
      "....SngennnnssssgeSk....",
      "...SSSgeSSSSSSSSgeSSk...",
      "..SsnngennnsssssgeSSSk..",
      ".egvvvvvvvvggggggeeeeek.",
      ".Sssssssssssssssssssssk.",
      ".Ssdckcckkkkkkkkkbkdcsk.",
      ".Sskcckkkkkkkkkkkkbbksk.",
      ".Ssckkddkkkkkkkkccbkbsk.",
      ".Sskkkkkddabkakckkkkksk.",
      ".evwwwwwwwvvvvvgggeeeek.",
      ".SNNNvennnnnonnnsvesssk.",
      ".SNNNvennnnononnsvesssk.",
      ".SnnnxesssnyYyssSxeSSSk.",
      ".SNNNvennnnykynnsvesssk.",
      ".SNNNvennnnoyOnnsvesssk.",
      ".SnnnvesssssssssSveSSSk.",
      ".SNNNxennnnnnnnnsxesssk.",
      ".SNNNvennnnnnnnnsvesssk.",
      ".SnnnvesssssssssSveSSSk.",
      ".evvvvvvvvggggggggggggk.",
      "..kkkkkkkkkkkkkkkkkkkk..",
      "........................",
    ],
  },
  // 罠: 呪紋が紅く灯る石板と、割れ目から突き出す鉄の棘
  trap: {
    palette: {
      "5": "rgba(220,90,40,0.22)", k: "#0b090e", n: "#544032", g: "#3c3d4b", v: "#646673", w: "#9a9894",
      a: "#18161d", b: "#2c2932", c: "#46424c", d: "#68626d", r: "#6e1a20", R: "#b0403a",
    },
    art: [
      "........................",
      ".........5..............",
      "........5k5.............",
      ".......5kRk5.5..........",
      ".......5krk55k5.........",
      ".....5.5kwk5kRk5........",
      "....5k5kwngkkrk5.5......",
      "...5kRkkwvgkkwk55k5.....",
      "...5krkkwvgknvgkkRk5....",
      "...5kwkkwngRwvgkkrk5....",
      "..5kwvnkwvgrwvgkkwk5....",
      "..5kwvgdwvgwnvgcwvgk5...",
      "..5kwvgdwnwvgvgcwvnck5..",
      ".5kdwvnrwvwvgvgrwvgcbk5.",
      "5kddwvgcwvwvnvgcwvgaabk5",
      "adddwvgcwnwvgvgbwvnrbabk",
      "adccrcccccwvgrbbwvgrbaak",
      "accarccccbwvnbrbbbbraaak",
      "5kccaarbbbbbbbbbaRraaak5",
      ".5kcbbarrrrrRrrrraaaak5.",
      "..5kbbbbbbbaaaaaaaaak5..",
      "...5kbbbbaaaaaaaaaak5...",
      "....5kkkkkkkkkkkkkk5....",
      ".....55555555555555.....",
    ],
  },
  // 泉: 石の水盤と柱の鉢。光を帯びた水が噴き上がる
  fountain: {
    palette: {
      "2": "rgba(110,190,220,0.26)", "7": "rgba(140,210,235,0.15)", k: "#0b090e", a: "#18161d", b: "#2c2932", c: "#46424c",
      d: "#68626d", f: "#928b93", u: "#0d2230", t: "#1f5470", h: "#5aa0b8", j: "#b4e2ea",
    },
    art: [
      "........................",
      "...........j............",
      "...........kj...........",
      ".........jkjhkj.........",
      "..........ujtk..........",
      "........j.uhtk.j........",
      ".......akukhtkuka.......",
      "......afhhhhhhhhfk......",
      "......uhddddbbbbhk......",
      ".......kkdddbbbkk.......",
      "........7kfdcbk7........",
      "......h77kfdcbk77h......",
      ".....2kkkkfdcbkkkk2.....",
      "...aakfffffdcbffffkaa...",
      ".aafffktttfdcbtttkcccka.",
      "affftthhjjfdcbjjhhttccck",
      "addtthhjjjjjjjjjjhhttaak",
      "addddtthhhhhhhhhhttaaaak",
      ".kddddccccccccbbbbbaaak.",
      ".addddccccccccbbbbbaaak.",
      "..kaaaaaaaaaaaaaaaaaak..",
      "...kkkkkkkkkkkkkkkkkk...",
      "........................",
      "........................",
    ],
  },
  // 下り階段 (深層へ): 枠石の奥、闇へ沈んでいく石段と壁の松明
  stairs: {
    palette: {
      k: "#0b090e", n: "#544032", O: "#2b1e12", o: "#5e4820", y: "#957a38", Y: "#cdb779",
      a: "#18161d", b: "#2c2932", c: "#46424c", d: "#68626d", f: "#928b93", z: "#3f392f",
      B: "#857c66", W: "#c4baa0",
    },
    art: [
      "........................",
      ".....aaaaaaaaaaaaaa.....",
      "....affffdddddccccck....",
      ".....kdckkkkkkkkbak.....",
      ".....adbkkkkkkkkaak.....",
      ".....adbkkkkkkkkaak.....",
      ".....abcaaaaaaaabak.....",
      "..O.adbkkkkkkkkkkbak....",
      ".OYkkbcaaaaaaaaaaaak....",
      ".Oynkbckkkkkkkkkkaak....",
      ".Ookkdcbbbbbbbbbbbak....",
      "..kkbckkkkkkkkkkkkbak...",
      "...adcccccccccccccaak...",
      "...adcaaaaaaaaaaaaaak...",
      "..adcccccccccccWWccbak..",
      "..adcaaaaaaaaaWkWkabak..",
      "..adbddddddbdddzBddaak..",
      "..adbbbbbbbbbbbbbbbaak..",
      ".adbdddddddddddbddddbak.",
      ".adbbbbWBWbbbbbbbbbbbak.",
      ".abcfffffcffffffffffaak.",
      "adbccccccccccccccccccbak",
      ".kkkkkkkkkkkkkkkkkkkkkk.",
      "........................",
    ],
  },
  // 警備兵: 等身大の門衛 (24x46)。面頬の奥は闇、槍と擦り切れた陣羽織、傷だらけの盾
  guard: {
    palette: {
      "8": "rgba(0,0,0,0.45)", k: "#0b090e", S: "#1a110c", s: "#33231a", n: "#544032", e: "#1f1e29",
      g: "#3c3d4b", v: "#646673", w: "#9a9894", O: "#2b1e12", o: "#5e4820", a: "#18161d",
      b: "#2c2932", c: "#46424c", q: "#2e0a0e", r: "#6e1a20",
    },
    art: [
      "...evk......e...........",
      "..ewgk.....evk..........",
      "..ewvek...ewggk.........",
      ".ewwvek..egvgek.........",
      "..kwgk...egkkkk.........",
      "..ewgkqq.eekkkk.........",
      "..Snsrrqk.kekkk.........",
      "..Snsrrqqkkkkke.........",
      "..Snsrqkkkgggeek........",
      "..Snsrkkvvkkkkkek.......",
      "..Snskavvvkkkkkekk......",
      "..Snskagggrrqqkkkkaa....",
      "..SnskgekkrrqqkcbbbakO..",
      "..Snskgeggrrqkocccbbkok.",
      "..SnskgeggrrOkcccobbak..",
      "..SnskgeggrOOObcOoObak..",
      "..SnsgekggrrOkbccobaak..",
      "..SnsgeaggrrOkbcbObaak..",
      "..SnsgeaggrrqkobbObakO..",
      ".eggekeaggrrqkbkbOaakok.",
      ".eggekbassSSosbbbOaakk..",
      "..knskbaggrrqkbbaOakkk..",
      "..SnskbaggrrqqkoaOkkok..",
      "..SnskbaggrrqqkaaOkkk...",
      "..SnskbaggrrqqkkkOkk....",
      "..Snskbaggrrqqkkkkkk....",
      "..Snskbakgrrqkkgkkk.....",
      "..Snskbakgkqkrqgkkk.....",
      "..Snskbakvgkkvgk........",
      "..Snskbakvgkkvgkaa......",
      "..Snskbakvgkkvgkbak.....",
      "..Snskbakvgkkvgkbak.....",
      "..Snskbakvgkkvgkbak.....",
      "..Snskbakvgekvgebak.....",
      "..Snskbakvgkkvgkbak.....",
      "..Snskbakvgkkvgkbak.....",
      "..Snskkakvgkkvgkbak.....",
      "..Snsk.kkvgkkvgkbak.....",
      "..Snsk..evgkkvgkbk......",
      "..Snsk..evgkkvgkk.......",
      "..Snsk..evgkkvgk........",
      "..Snsk..evgkkvgk........",
      "..Snsk.SssSkkssSk.......",
      "..Snsk.SssSkkssSk.......",
      "..Snsk.SssSkkssSk.......",
      "...kk888kkk88kkk8888....",
    ],
  },
  // 帰還魔法陣: 床に刻まれた光の円環と、立ち昇る光の柱
  portal: {
    palette: {
      "7": "rgba(140,210,235,0.15)", k: "#0b090e", x: "#d8d2c4", u: "#0d2230", t: "#1f5470", h: "#5aa0b8",
      j: "#b4e2ea",
    },
    art: [
      "............j...........",
      "........................",
      "...........j............",
      "...........j............",
      ".........j.h.j..........",
      "...........h.j.x........",
      "...........t.h...j......",
      "........j..t.h..........",
      "........j..t.t..j.......",
      "......h.h7jt7tj.j.......",
      "........h7jt7tj7h.......",
      "......uutkhtkthkhk......",
      "...uuuujuuuxuuuujukuu...",
      "..uuuuuuttttttttuuuuuk..",
      ".uuxuttttuutttuuuttuxuk.",
      "uuuuttuuuuuuuutuuuttuuuk",
      "uhjuhuuuuttjxttuuuuhujtk",
      "uhhuhhuuutuujuuuuuhhuttk",
      ".khxuhhuuutttuutthhuxtk.",
      "..khhhuuhhhhhhhhuutttk..",
      "...kkkhjhttuxtttjtkkk...",
      "......kkkkkkkkkkkk......",
      "........................",
      "........................",
    ],
  },
  // 出発点: 色褪せた塔の紋を染めた、擦り切れた燕尾の旗
  start: {
    palette: {
      k: "#0b090e", S: "#1a110c", s: "#33231a", N: "#77604a", O: "#2b1e12", o: "#5e4820",
      y: "#957a38", Y: "#cdb779", Z: "#efe2b8", a: "#18161d", b: "#2c2932", c: "#46424c",
      d: "#68626d", f: "#928b93", q: "#2e0a0e", r: "#6e1a20", R: "#b0403a",
    },
    art: [
      ".....O..................",
      "....OYk.................",
      "...OYZyk......qqqq......",
      "...Ooyok....qqrrrrkq....",
      "....kNsrkqqqrrqqqrrrk...",
      "....SNsRrrrrqqqqqrRRrk..",
      "....SNsRRRoroqoqkrRRRk..",
      "....SNsRRRoooooqqrkkRk..",
      "....SNsRRRRoooqqqrkkk...",
      "....SNsRRRRoyoqqqrRRk...",
      "....SNsRRRRoOoqqqrRRRk..",
      "....SNsRRRRrqqqkqkkRRk..",
      "....SNsRRRRrkqk.k..kRk..",
      "....SNsRRRRrkk......k...",
      "....SNskRkRrk...........",
      "....SNskk.kk............",
      "....SNsk................",
      "....SNsk................",
      "...akNsk................",
      "..adddffk...............",
      ".acddddffk..............",
      "abccccdddk..............",
      "aabbbbcccbk.............",
      ".kkkkkkkkk..............",
    ],
  },
  // 金貨の山 (ゴールド入手用)
  gold: {
    palette: {
      "1": "rgba(220,180,90,0.16)", k: "#0b090e", O: "#2b1e12", o: "#5e4820", y: "#957a38", Y: "#cdb779",
      Z: "#efe2b8", q: "#2e0a0e", r: "#6e1a20", R: "#b0403a",
    },
    art: [
      "........................",
      "........................",
      "........................",
      "........................",
      "..........1111..........",
      ".........1kZkk1.........",
      "........1kYYook1........",
      ".....Z.1kYZZYYok1.......",
      "....ZZZ1kyYYooOk11111...",
      "....1Z11kYYyyoOkkkkkkZ..",
      "...1kkkkkyyooOOkYYYYYk1.",
      "..1kYYookYYyyoOkYYYyOk1.",
      ".1kYZZYYoyyooOOYYYyyyOk1",
      ".1kYYYooOYYyyoOYYyoyyOk1",
      ".1kyyooOOyyooOOYyyOoyOk1",
      ".1kYYyyoOYYyyoOyYyyyOk1.",
      ".1kyyooOOyyooOOoOOOOOk1.",
      ".1kYYyyoOYYyyoORryoyok1.",
      "1kyyyooOOyyooOOrqoyYyok1",
      "1koYYyyoOYYyyoOYoyyYYyk1",
      "1kyYYyoOOyyooOyYYyOYYOk1",
      "1kOYYOoYoyoyoyOYYOoyoYk1",
      ".1kkkkkkkkkkkkkkkkkkkk1.",
      "..11111111111111111111..",
    ],
  },
  // 風化した死体 (魂なし): 骨と襤褸と錆びた剣
  corpse: {
    palette: {
      k: "#0b090e", S: "#1a110c", s: "#33231a", O: "#2b1e12", o: "#5e4820", y: "#957a38",
      a: "#18161d", b: "#2c2932", c: "#46424c", d: "#68626d", z: "#3f392f", B: "#857c66",
      W: "#c4baa0",
    },
    art: [
      "...............Ssk......",
      "...............Ook......",
      "..............OoyOk.....",
      "...............kkdbk....",
      "................adbk....",
      ".................kdbk...",
      ".................adbk...",
      "..................kdbk..",
      "...zzzz...........adbk..",
      "..zWWWWk..........adbk..",
      ".zWWWWWBk..........kdbk.",
      ".zWkkWkBkzzzzzzzz..adbk.",
      ".zWkkWkBWWWWWWWWWk..kdbk",
      ".zBWWBWzBBBBBBBBBk..adbk",
      "..kBkBzkkWkBbWbBBBkzkkk.",
      "...kkkcccWaBbWbBbbBBBk..",
      "...aaccccWbBbWaBbbbabbk.",
      "..aaccccacbbbabbbbabbbbk",
      "..accccWWWWbabbbbabbbbak",
      "..zWWWWcccbabbBBBbbbbak.",
      "...kkkccccabbbbabBBBWk..",
      "......kkkkkbbbakkkkkk...",
      "...........kkkk.........",
      "........................",
    ],
  },
  // まだあたたかい死体 (魂が宿る): 倒れた冒険者と立ち昇る燐光
  corpseWarm: {
    palette: {
      "2": "rgba(110,190,220,0.26)", "3": "rgba(150,215,240,0.45)", "7": "rgba(140,210,235,0.15)", k: "#0b090e", S: "#1a110c", s: "#33231a",
      n: "#544032", e: "#1f1e29", g: "#3c3d4b", v: "#646673", w: "#9a9894", x: "#d8d2c4",
      o: "#5e4820", y: "#957a38", t: "#1f5470", h: "#5aa0b8", j: "#b4e2ea", q: "#2e0a0e",
      r: "#6e1a20", R: "#b0403a",
    },
    art: [
      "........................",
      "........................",
      "............j...........",
      "........................",
      "......2.....2...........",
      "...........2j2.2........",
      "..........2jhj2.........",
      "...........hth..........",
      ".......3...2t2..........",
      ".......777772737........",
      ".7777777kkkkkkk777......",
      "77kkk77kRRRRRrrkk777....",
      "7kxwvkkrrrrrrrrrrkk7777.",
      "ewwvvevgrrqqqqqrrrrkkk77",
      "evkkkevgwwwvggerqrqnsSkS",
      "egggeevgwwwwvvgeeqqnnsSS",
      "7keeekvgvwwwvvggeeqnnsSS",
      "77kvvgekkkkkkkqqqqkkknsS",
      "7kgeekk7777777kkkk777kkk",
      "77kkkkkkkkkkkkkkkk777777",
      ".77kwwwwwwwwwwwynnk7....",
      "..77kggggggggggosk77....",
      "...77kkkkkkkkkkkk77.....",
      "....77777777777777......",
    ],
  },
  // 青い人魂 (まだ魂が宿るあたたかい死体の目印): 揺らぐ冷たい鬼火
  wisp: {
    palette: {
      "2": "rgba(110,190,220,0.26)", "7": "rgba(140,210,235,0.15)", k: "#0b090e", u: "#0d2230", t: "#1f5470", h: "#5aa0b8",
      j: "#b4e2ea",
    },
    art: [
      "........................",
      "........................",
      "........................",
      "........................",
      "...........2............",
      "..........2u2...........",
      "..........2u2..2........",
      "........22u2u22u2.......",
      "......72u2u2u222u2......",
      ".....7kuuuuuuuuuk7......",
      ".....7kuuuuttuuuk2......",
      "....7kuuuuthhtuuuu2.....",
      "....7kuuutthhttuuu2.....",
      ".....7kuuthjjhtuuu2.....",
      "....7kuuuthjjhtuu2......",
      ".....7kkuuthhhtuu2......",
      "......77kuuuhtuuk7......",
      "........7kkuuuuuk7......",
      ".........77kuuuk7.......",
      "...........7kkk7k7......",
      "............777kt22.....",
      ".............7k2ku22....",
      "..............7k72222...",
      "...............7...2....",
    ],
  },
  // 魂の残火 (死体に残る魂の灯。メイン魂のLv上限を上げる)
  ember: {
    palette: {
      "5": "rgba(220,90,40,0.22)", k: "#0b090e", O: "#2b1e12", o: "#5e4820", y: "#957a38", Y: "#cdb779",
      Z: "#efe2b8", a: "#18161d", b: "#2c2932", q: "#2e0a0e", r: "#6e1a20", R: "#b0403a",
    },
    art: [
      ".......r.......R........",
      "............55..........",
      "...........5kk5...y.....",
      ".....R....5kRRk5........",
      ".......5.5kRRRrk5.......",
      "......5k5kRRRRrk55......",
      ".....5kRkRRRRRrk5k5.....",
      ".....5krRyyyyyRkkRk5....",
      "....5krrRyyyyyRrkkk5....",
      "...5krrRyyyyyyRRkkrk5...",
      "...5krrRyyYYYyyRrkk5....",
      "...5krrRyyYYYYyRRrk5....",
      "....5krRRyYYYYyRRrk5....",
      ".....5krRyyZZZyRRrk5....",
      ".....5krRRyZZZyyRrk5....",
      ".....5krrRyZZZyRRk5.....",
      "......5krRyZZZyRrk5.....",
      ".....55krRyZZZyRrk5.....",
      "....5kkaboqROobak5......",
      "...5kabqrRYyRrqbak5.....",
      "..5kabbaqoRrooabbak5....",
      "...5kkkkkkkkkkkkkk5.....",
      "....55555555555555......",
      "........................",
    ],
  },
  // 毒 (毒状態・毒の床用): 黒緑の毒沼に半ば沈んだ髑髏と、病んだ燐光・泡
  // 迷宮のイベント (events.js): 紫に灯る印を刻んだ立石。まわりに燐光が漂う
  event: {
    palette: {
      "1": "rgba(150,100,240,0.16)", k: "#0b090e", S: "#17151f", s: "#2c2937", n: "#45415a", N: "#615c78", M: "#8a85a3",
      m: "#2b3522", v: "#5b2fa8", V: "#a874ff", W: "#efe2ff",
    },
    art: [
      "........................",
      "...........V............",
      "....W..............V....",
      "..........kkkk..........",
      "........kkNMMNkk........",
      ".......kNMMNNnnsk.......",
      "......kNMNNnnnsssk......",
      "......kNNNnnnssssk......",
      "......kNNnnvvvsssk...V..",
      "..V...kNnnvVVVvssk......",
      "......kNnvVWWWVvsk......",
      "......kNnvVWkWVvSk......",
      "......kNnvVWWWVvSk......",
      "......kNnnvVVVvssk......",
      "......kNNnnvVvsssk......",
      "......kNnnnnvssssk......",
      "......kNnnnnvsssSk......",
      ".W....kNnnnnVsssSk......",
      "......kNnnnnvssSSk...W..",
      "......kmNnnnnssSmk......",
      ".....kmmmnnnsssSmmk.....",
      "...11kkkkkkkkkkkkkk11...",
      "....1111111111111111....",
      "........................"
    ],
  },
  poison: {
    palette: {
      "6": "rgba(130,200,80,0.18)", k: "#0b090e", X: "#08100a", G: "#142410", l: "#2f5a22", L: "#6f9a48",
      z: "#3f392f", B: "#857c66", W: "#c4baa0",
    },
    art: [
      "........................",
      "........................",
      "........................",
      "..........zzzzz.........",
      "........zzWWBBBkz.......",
      ".......zWWWWBzBzzk......",
      "......zWWWWWBzBzzzk.....",
      ".....zWWWWWBBBzzzzzk....",
      ".....zWWWBBBBBzzzzzkG...",
      ".....zBBkkkBzzzkkkzk....",
      ".....zBkLkkkzzklkkzk....",
      "....Gzzkklkzzzzkkkzl....",
      "....kBBBBlBBkzzzzzzk....",
      "...66kGGGLGkkkGGGGGk6...",
      ".666kkkGGGGGGGGGGkkk666.",
      "..XklllllXXXXXXXXXGGkX..",
      ".XGGGGGXXXXXXXXXXXGLGGk.",
      "XXXXGGGXXXXXXXXXXGGGXXXk",
      "XXXXXGXGGGGXGGGGGXXXXXXX",
      "kXXXXXXXXXXXXXXXlXXXXXXk",
      ".kkXXXXXXXXXXXXGGGXXXkk.",
      "...kkkkXXXXXXXXXXkkkk...",
      ".......kkkkkkkkkk.......",
      "........................",
    ],
  },
};

// 文字グリッドを正規化して { w, h, rows } を返す
function normalize(art) {
  const rows = art.map((r) => r.split(""));
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const h = rows.length;
  return { w, h, rows };
}

// Canvasコンテキストにドット絵を描く
// cx,cy: 中心座標 / size: 1ドットの大きさ(px)
// size が小数でも隙間が出ないよう、各ドットの矩形は「隣のドットの開始位置まで」
// をピクセル整数に丸めて敷き詰める (位置と幅を別々に丸めると格子状の線が入る)。
export function drawSprite(ctx, mon, cx, cy, size, alpha = 1) {
  const { w, h, rows } = normalize(mon.art);
  const ox = cx - (w * size) / 2;
  const oy = cy - (h * size) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    const y0 = Math.round(oy + y * size), y1 = Math.round(oy + (y + 1) * size);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === " ") continue;
      const col = mon.palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      const x0 = Math.round(ox + x * size), x1 = Math.round(ox + (x + 1) * size);
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }
  ctx.restore();
}

// 解像度の異なるアートを 12 グリッド換算の見かけサイズへ正規化して描く。
// size は「12x12 アートでの 1 ドット px」。32px 級の高解像度アートは
// 同じ見かけの大きさのままドットが細かくなる。
export function drawSpriteFit(ctx, mon, cx, cy, size, alpha = 1) {
  const h = mon.art.length;
  const w = mon.art.reduce((m, r) => Math.max(m, r.length), 0);
  const k = Math.max(12, w, h) / 12;
  drawSprite(ctx, mon, cx, cy, size / k, alpha);
}

// 一覧用の小さなサムネを返す（未使用でも拡張用に公開）
export function spriteList() {
  return Object.keys(MONSTERS);
}

// スプライトを描いた canvas 要素を返す (DOM のアイコン用)
const _artBmp = new WeakMap();
// 1ドット=1pxの写し (高精細の絵を1ドット未満に縮める時の元画像)
function artBitmap(spr) {
  let c = _artBmp.get(spr);
  if (c) return c;
  const { w, h, rows } = normalize(spr.art);
  c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (!ch || ch === "." || ch === " ") continue;
    const col = spr.palette[ch];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }
  _artBmp.set(spr, c);
  return c;
}

// 表示の大きさは box*scale px のまま。高精細の絵 (12ドット超) は端末の画素密度で描き、
// 1ドットが1物理ピクセルを下回る時は等倍の写しを滑らかに縮めて潰れを防ぐ (旧12ドット絵は従来どおり)
// 一辺 size (CSS px) の枠に、ドットを物理ピクセルの整数倍で描いた canvas を返す (肖像・胸像用)。
// 入りきらない大きな絵だけは滑らかに縮める。canvas の CSS 寸法は描いた絵の大きさそのもの
export function crispCanvas(spr, size) {
  const c = document.createElement("canvas");
  c.className = "spr";
  const { w, h } = normalize(spr.art);
  const dpr = Math.min(3, Math.max(1, Math.round((typeof window !== "undefined" && window.devicePixelRatio) || 1)));
  const s = Math.floor((size * dpr) / Math.max(w, h, 1));
  const ctx = c.getContext && c.getContext("2d");
  if (s >= 1) {
    c.width = w * s; c.height = h * s;
    c.style.width = (w * s) / dpr + "px"; c.style.height = (h * s) / dpr + "px";
    c.style.setProperty("--spr-size", (Math.max(w, h) * s) / dpr + "px");
    if (ctx) drawSprite(ctx, spr, c.width / 2, c.height / 2, s);
  } else {
    const px = Math.round(size * dpr), k = px / Math.max(w, h);
    c.width = px; c.height = px;
    c.style.width = size + "px"; c.style.height = size + "px";
    c.style.setProperty("--spr-size", size + "px");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(artBitmap(spr), (px - w * k) / 2, (px - h * k) / 2, w * k, h * k);
    }
  }
  return c;
}

export function spriteCanvas(spr, scale = 4, box = 12) {
  const c = document.createElement("canvas");
  c.className = "spr";
  const css = box * scale;
  const { w, h } = normalize(spr.art);
  const k = Math.max(12, w, h) / 12;
  if (k <= 1) {
    c.width = css;
    c.height = css;
    drawSpriteFit(c.getContext("2d"), spr, css / 2, css / 2, scale);
    return c;
  }
  const dpr = Math.min(3, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
  const px = Math.round(css * dpr);
  c.width = px;
  c.height = px;
  c.style.setProperty("--spr-size", css + "px");
  const ctx = c.getContext("2d");
  const dot = (scale * dpr) / k; // 1ドットあたりの物理ピクセル
  if (dot >= 1) {
    drawSprite(ctx, spr, px / 2, px / 2, Math.floor(dot)); // 整数倍で描く (ドットの幅を揃える)
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const W = w * dot, H = h * dot;
    ctx.drawImage(artBitmap(spr), (px - W) / 2, (px - H) / 2, W, H);
  }
  return c;
}
