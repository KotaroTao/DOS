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

// カード用アイコン。盤面に置く物 (宝箱・罠・泉・階段・魔法陣・死体・人魂・立石) は約 40 ドット四方の
// 陰影つきドット絵 (左上から光・3/4 俯瞰・素材ごとの色ランプと境目だけの順序ディザ)。内容の外接矩形で
// 切り詰めてあり、盤面 (drawBmpFit) でもポップアップ (spriteCanvas) でも箱いっぱいに収まる。
// それ以外 (金貨・残火・毒・旗) は 24x24、警備兵のみ等身大の 24x46。半透明の色 (rgba) はかすかな光暈。
export const ICONS = {
  // 宝箱: 鉄帯と金の鋲を打った木箱 (3/4 俯瞰)。蓋の継ぎ目と錠前から金の光が漏れる
  chest: {
    palette: {
      k: "rgba(230,190,100,0.125)", a: "#0b090e", b: "#735435", c: "#8e6a43", d: "#c9ced4", e: "#808792",
      f: "#4c515b", g: "#5a4029", h: "#43301f", i: "#2f2015", j: "#a2a9b2", l: "#646a75", m: "#383c45",
      n: "#fff1bf", o: "#8d6820", p: "#282b32", q: "#1e140e", r: "#b38a2c", s: "#eccf7c", t: "#d4ad48",
      u: "#030205", v: "#07060b", w: "#0f0a08", x: "#674a17",
    },
    art: [
      ".......kkkkkkkkkkkkkkkkkkkkkkkkkk..",
      "......kaaaaaaaaaaaaaaaaaaaaaaaaaak.",
      ".....kabcbbdefbgbhbgbbbhgggdefbghak",
      "....kagbbbdefbbbbbhbbbbbhbdefbhiiak",
      "...kabcgcdefbgcbcbbhbbbbbdefbbhiiak",
      "..kaccbcdefcbcgcbbbbgbbbdefbbiiiiak",
      ".kagcccdefcccccgcccbcgcdefbhiihiiak",
      ".kacbbjlmbbbbbbbbcbcbcjlmbbbiiiiiak",
      "kabbbbjlmbbbbbbbbgbgggjlmgggiiiiiak",
      "kahghgjnmhhhhhhhhhhhhhjnmhhhiiiiiak",
      "kaggggjomgggggggggggghjomhghiiiiiak",
      "kaggggjlpggggghgggggggjlpgggiiqifak",
      "kahhhhjfpiiiiiiiiiiiiijfpiiiiiifak.",
      "kahhhhenphhhhhhhhhhghhenphhhiifarak",
      "kahhhheophhhnnsttthhhieopihiifariak",
      "kammmmmmmmmmntttttmmmmmmmmmmfariqak",
      "kaeeeeeeeeeettnrrreeeeeeeeeearpiiak",
      "kaosnnsnssnnrrrurrnnnsssnnsorppiiak",
      "kacbbbjfmbcbrrruooggbbjfmbcbhppihak",
      "kagggbelmbgbooovooggggelmgggippqwak",
      "kaggggjsmggggooxxggggijsmhhhippqiak",
      "kaqqqqexmqqqqqxxxqqqqqexmqqqwppiiak",
      "kabbbbjfmgggbbbbbgggbhjfmgggippihak",
      "kahhhhelmhhhhggghhhhhhelmhiiippqwak",
      "kaggghjsmhhhhhhhhhhhhhjsmqiiippimak",
      "kaqqqqexmqqqqqqqqqqqqqexmqqqwppmak.",
      "kaggggjfmhhhhhhhghggghjfmhghhppak..",
      "kathhgesmhhhhhhhiiiihhesmhihimak...",
      "kattlllxlllllllllllllllxllllmak....",
      "kammmmmmmmmmmmmmmmmmmmmmmmmmak.....",
      ".kaaaaaaaaaaaaaaaaaaaaaaaaaak......",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkk.......",
    ],
  },
  // 開封済みの空箱: 蓋は後ろへ開き、中は空っぽの闇。外れた錠前と蜘蛛の巣
  chestOpen: {
    palette: {
      k: "#0b090e", a: "#8e6a43", b: "#646a75", c: "#383c45", d: "#4c515b", e: "#2f2015", f: "#43301f",
      g: "#1e140e", h: "#5a4029", i: "#282b32", j: "#5d5965", l: "#8d8a93", m: "#030205", n: "#07060b",
      o: "#4a4652", p: "#2b2833", q: "#eccf7c", r: "#b38a2c", s: "#735435", t: "#808792", u: "#8d6820",
      v: "#0f0a08", w: "#a2a9b2", x: "#674a17", y: "#d4ad48",
    },
    art: [
      ".........kkkkkkkkkkkkkkkkkkkkkkkkkk.",
      "........kaaaaaaaaaaaaaaaaaaaaaaaaaak",
      "........kbbcddbbbbbbbbbbbbbcddbbbbbk",
      "........keecddeeeeeeeeeffffcddefefk.",
      "........kefcddfeeeeeeeeefefcddeefek.",
      ".......kgeccdggggggggeggggccdeeegk..",
      ".......keeccdeeefffffffffeccdffffk..",
      ".......kffccdfffefefffffffccdffffk..",
      ".......kffccdfffffffeefeffccdffefk..",
      ".......keeccdeeeeeeegegegeccdegggk..",
      ".......kfeccdffffffffffffeccdefefk..",
      ".......kfhccdfffffffffffffccdffffk..",
      "......kfficcffffffffffffficcffffk...",
      "......keeccceeeeeeeeeeeeeccceeeek...",
      "......kfficcffffhfffffffficcffffk...",
      ".....kgfefefefefefefefefefefefehk...",
      "....kggejljejeeeeeeeeeeeeeeeeekhk...",
      "...kggmmjjmjmnmmmmnmmmmnmmmmnkhek...",
      "..kggmmnjjjonmmmmnmmmmnmpmmnkhegk...",
      ".kggmmnjmjmnmmmmnpmmmpmmmmnkhieek...",
      "kaaaaaaaaaaaaaaaaaaaaaaaaaahiieek...",
      "kbbbbbbbbbbbbqrrbbbbbbbbbbbfiiefk...",
      "khhhstbcshshhurrhhhhhtbchhheiigvk...",
      "khhhhwqchhhhhumuhhhhewqcfffeiigek...",
      "kggggtxcgggggxxxgggggtxcgggviieek...",
      "ksssswdchhhssssshhhsfwdchhheiiefk...",
      "kfffftbcffffhhhfffffftbcfeeeiigvk...",
      "khhhfwqcfffffffffffffwqcgeeeiieck...",
      "kggggtxcgggggggggggggtxcgggviick....",
      "khhhhwdcfffffffhfhhhfwdcfhffiik.....",
      "kyffhtqcfffffffeeeefftqcfefeck......",
      "kyybbbxbbbbbbbbbbbbbbbxbbbbck.......",
      "kcccccccccccccccccccccccccck........",
      ".kkkkkkkkkkkkkkkkkkkkkkkkkk.........",
    ],
  },
  // 罠: 紅い呪紋の灯る踏み板と、溝から突き出す血錆びた鉄の棘
  trap: {
    palette: {
      k: "rgba(220,70,40,0.125)", a: "#0b090e", b: "#eef1f3", c: "#9a2a26", d: "#5c1418", e: "#c9ced4",
      f: "#282b32", g: "#a2a9b2", h: "#763519", i: "#1a1c21", j: "#808792", l: "#393641", m: "#383c45",
      n: "#4c515b", o: "#030205", p: "#1f1d26", q: "#4a4652", r: "#7a1d1f", s: "#ea8d28", t: "#2b2833",
      u: "#15131a", v: "#5d5965", w: "#cc6618", x: "#ffde88", y: "#f8b84c",
    },
    art: [
      "......................k..............",
      ".....................kak.............",
      ".............k......kabak............",
      "............kak....kacdak............",
      "...........kabak...kacdak..k.........",
      "..........kaefak..kkagfak.kak........",
      "........k.kagfak.kakagfakkabak.......",
      ".......kakkagfakkabaagfakaefak.k.....",
      "......kabakagfakacdaaghakagfakkak....",
      ".....kacdakagfakacdaagfakagfakabak...",
      ".....kacdakagfakaghaagfakagfaagfak...",
      ".....kagfakagiakagfahgfiaagfaagfak...",
      ".....kagfaagghiaagfaggiiaagfaagfak...",
      ".....kagfiajgiiaggiigjiiajhiiagfak...",
      "....kahgiiagjiiajgiijjiiagjhiggfiak..",
      "...kaljjiiljjmiljjihjhniljjmijjhiak..",
      "...kaljjmiojhnhohjmijjmhojjnijjniak..",
      "..kallppppppppppppppppppppppppppak...",
      "..kalllqqllqrrccqqsllccrrltltutttak..",
      "..kallqqqlrcqqqqqsqsltlllcrttutttak..",
      "..kallqvqrcllqwwssqsswwllqcrlluttak..",
      "..kaqlqqrclllwllsqllsllwlqqcrttttak..",
      ".kaqqqqqrclqwllsllsqlsllwqqcrllllak..",
      ".kaqqqqlrcqqwlssltxyqsstwqqcrlllllak.",
      ".kaqqvqqrcqvqwsqqllqqqswlqqcrlllllak.",
      ".kaqqqvvqrcqqswwwqqlwwwsqqcrqlllltak.",
      ".kaqqqqquqrcqssssssssssslcrqllllllak.",
      "kaqqqllluqqqrrccqqqqqccrrlltltllltak.",
      "kaqqqqquqqqqqqqvqrrrqqlllulllllllllak",
      "kaqlqqqqqlqvvqqvvqqqqqqllluqqlllllqak",
      "kattlltttltttttltttttttlttttlltltltak",
      "kattpttptttptttttptptttttttptttppttak",
      "kattppptptppptttppptptppppppptppptpak",
      ".kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak.",
      "..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..",
    ],
  },
  // 泉: 石の水盤と柱の鉢。光を帯びた水が噴き上がり、鉢の縁からこぼれて水盤に満ちる
  fountain: {
    palette: {
      k: "rgba(120,200,230,0.125)", a: "#0b090e", b: "#d2f1f7", c: "rgba(140,210,235,0.125)",
      d: "rgba(140,210,235,0.25)", e: "#6ab5cb", f: "#aeabb2", g: "#4291ab", h: "#5d5965", i: "#4a4652",
      j: "#8d8a93", l: "#393641", m: "#9dd6e4", n: "#73707a", o: "#2b2833", p: "#1f1d26", q: "#2a6d88",
      r: "#1b4f68", s: "#15131a",
    },
    art: [
      "................kakkkabak..............",
      "...............kabaaakak...............",
      "...............ckaabbakak..............",
      "...............kadabbaabak.............",
      "..............kababbbadakk.............",
      "..............kkaaebeadkkak............",
      ".............kakdaebeadkabak...........",
      "............kabadaebeadckak............",
      ".............kakkaebeakkkk.............",
      "............kkaaaaebeaaaakk............",
      "...........kaaffggebegghhaak...........",
      "..........kaffggggebeggggiiak..........",
      "..........kajjjgggggggggiilak..........",
      "..........kamannnhhhiiiilaamak.........",
      "..........kamhiiiillllooooomak.........",
      "...........kaooooooooppppppak..........",
      "..........kamaaaajjllllaaaamak.........",
      ".........kaeakkkkajhloakkkkaeak........",
      "..........kak.kkkajhloakk..kak.........",
      "........kkaeakaaaajhloaaakkaeak........",
      "......kkaaaeaajfffjhlojjjaaaeaakk......",
      "....kkaafffjfjfffjjlllljjjjjjnnaakk....",
      "...kaaffjfjqqqqqqqjhlorrrqqqnnnnnaak...",
      "..kaffffgggmmggqqgnhlpeeeebbeggnnhnak..",
      ".kafffqggbggggmbggnhlpgbbegggmggqnhnak.",
      "kafffqgqegegmgeeeemeeemeggbgqqeqqghhhak",
      "kafffgggegqgbgqqqeeqmmgggqegggeggqhhhak",
      "kajffjqrqegqgqeegqqqgqqeeqgqqmggehhhlak",
      "kanjjjjjqqreeqrqqggqrrrqqgmerqqhhhhloak",
      "kannjjjjjnjrrrqqqqeeeqgggggqhhhhhllloak",
      "kainnjjjnjnnnnnnnnnnhnhhhhhhihiloooosak",
      "kanlinnnnnjnnnnnnnhnnnhhniillliloosspak",
      "kahhhilhhnnnhnhhhhhhiiiiilllollossppsak",
      "kahihhhllllhhhhhhhhihiiiilllpppsoppssak",
      ".kaiihiiihioolololooooppppspoopoppssak.",
      "..kaaiiihiiiiliiiiillllooooopppppsaak..",
      "...kkaallillllllllolooooppppspssaakk...",
      ".....kkaaaaalllooooooooopppaaaaakk.....",
      ".......kkkkkaaaaaaaaaaaaaaakkkkk.......",
      "............kkkkkkkkkkkkkkk............",
    ],
  },
  // 下り階段 (深層へ): 床に口を開けた切り石の階段井戸。手前の石段ほど明るく、奥は闇と燐光へ沈む。縁に燭台
  stairs: {
    palette: {
      k: "rgba(250,175,90,0.125)", a: "#0b090e", b: "#ea8d28", c: "#fff6d0", d: "#a64712", e: "#cc6618",
      f: "#ffde88", g: "#c3b495", h: "#dccfb2", i: "#646a75", j: "#808792", l: "#4c515b", m: "#383c45",
      n: "#d8c6a6", o: "#5a4a3b", p: "#bea888", q: "#a38c71", r: "#463a2e", s: "#88735c", t: "#352b22",
      u: "#705d4a", v: "#282b32", w: "#251e18", x: "#2f4525", y: "#030205", z: "#0f2f44", A: "#15131a",
      B: "#0a1f2e", C: "#17435c", D: "#18130f", E: "#1f1d26", F: "#2b2833", G: "#393641",
    },
    art: [
      "...kabak...............................",
      "..kkacdak..............................",
      "...aefak...............................",
      "...kagak...............................",
      "....aha................................",
      "...aijla...............................",
      "....ama................................",
      "....ama................................",
      "....amaaaaaaaaaaaaaaaaaaaaaaaaaaaaa....",
      "...anmnopppqpprssqssqtsssssstsuuuuua...",
      "...avmvossqqqqtuuuuuotuoooouwwoooooa...",
      "...appposssqqsrssuuuuwuuuuuutuoouxua...",
      "...aooooaaaaayyyyyzyzyyyyyAAAAAwwtxa...",
      "..apoppqAaAAAyyyyByCyByyyyaaaaAuwsuxa..",
      "..asoqssAAaayDttwwwwDwDwDDDAAAAowoooa..",
      "..asoqqaAaAaDDDaDaaaaaaaaaaaEAEAwuooa..",
      "..arrrrAAAAywrrrrrrrtrrrttttAAAADwwwa..",
      "..apqqqAAAAyDwwwwDwawwDDDaDaEEEAuouwa..",
      "..aqssuAaAaDaDDDaDaDaaaaaaaaaEEErorDa..",
      "..assuuAAAytuuuuuuuouououooooEEAoorDa..",
      ".atrtttEAADttrttttttttwtwwwwwwEEDDDDwa.",
      ".aqqrqAAAyDDwDDDDaDDDaDDDaaaDaFEFuuuua.",
      ".ausrsAEErsssqssssssssssssususuEEooora.",
      ".auuruEEEDorrrrrrrororrrrrrrrrrFFroroa.",
      ".attttAAyDrrrorrtrrrttwrtttttttFFDDwwa.",
      ".assqsEEDwwwwDwDwDwDwDDDDDwaDDDDFouDua.",
      ".auussAyrpppppppppppqpppqqqqpqqqFooDra.",
      ".asusEADsuuuuuuouuuoooororuooooooFowoa.",
      "attwtEyDououooooooooooooootoorrrrFDwDDa",
      "assutEyDwwtwtDwwwwwwwwwDaDwDDawDDGuuuoa",
      "auoxtuusuuowouuuouwurooorDroooooDrroxoa",
      "auxutuuuuuowuwooouwoooooowooorrrDorrrra",
      ".aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.",
      "atssssssssssssssssssssssssssssssssssssa",
      "attrttttDtttttttDrtttttrDtttttrtDrtttta",
      ".awDwwwDwwwDwwwDwwwDwwwDwwwDwwwDwwwDwa.",
      ".awtDwwwwtwwDwwwwwwwDwwwwtwtDwDwwwwwDa.",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa..",
    ],
  },
  // 主の間の扉 (最深部に主が待つ階の階段の代わり): 切り石のアーチに鉄帯を打った両開きの大扉。要石に赤い眼の髑髏、
  // 扉の合わせ目から赤い光が漏れて床を染める。左の柱の松明だけが灯る (左上から光)
  bossDoor: {
    palette: {
      a: "#0b090e", b: "#88735c", c: "#18130f", d: "#705d4a", e: "#3a3128", f: "#5a4a3b",
      g: "#a89a80", h: "#d8ccb0", i: "rgba(250,175,90,0.18)", j: "#f0e8d4", k: "#c8301e", l: "#463a2e",
      m: "#2a0c0a", n: "#6a5d4c", o: "#2b221b", p: "#1d130e", q: "#43120e", r: "#2e1d14",
      s: "#0e0908", t: "#42291c", u: "#621a12", v: "#5a3824", w: "#4a0c0c", x: "#646a75",
      y: "#c9ced4", z: "#5c1e18", A: "#4c515b", B: "#a38c71", C: "#383c45", D: "#3a1414",
      E: "#2c2e36", F: "#bea888", G: "#a64712", H: "#ea8d28", I: "#ffde88", J: "#8a909a",
      K: "#fff6d0", L: "#1e1f26", M: "#f0662c", N: "#8a1a14", O: "#ffb070",
    },
    art: [
      ".............aaabcbbbbbcaaa.............",
      "...........aabdddcdeeeddddfaa...........",
      "..........adbddddgehhhhegfddca..........",
      ".......iaadbcdfdfehjhhhhefffcdaa........",
      "......iabbdddcddfehkkhkkeffcdfdfa.......",
      "......abdddddclllehkkhkkelfffffdfa......",
      ".....iaccdbdflaaamehhnheaacoffffda......",
      "....iadddcdflapqrmenhnhestaloflclfa.....",
      "....abbdbdclatrtqmueeeepmrralocfffda....",
      "...iabdddflattpvtmukwmurstpsacoffffa....",
      "...abbbdblarvtrtqmukwmqrmrrstalffldfa...",
      "...abccblaxxyxxyxzzkwzzAyAAyAAaolflca...",
      "..iaBbbbcaCCCCCCCDDkwDDEEEEEEEaoccffa...",
      "..abbbdffatrttpvtmukwmurstrsttaooflffa..",
      "..abbdbfatvrvtrtqmukwmurmttstrpaolflfa..",
      "..abdbdfavtrttpqtqukwmqmstrprrsaollffa..",
      "iaacccccavvpvtrvqqukwmurmrrstrpaolflfaa.",
      "aFFFbbbbavtrvtpvtqukwmutstrprrsafffffffa",
      "aooooGooatvrvtrvqqukwmurmrtptrpaoooGoooa",
      "iaadGHooattrtvpqtqukwmumstrprrsaolGHlaa.",
      "..acIHccayxxyxxJxzzkwzzACAAyAAyaccIHca..",
      "..aGIKHoaCCCCCCLLDDkwDDLLEEEEEEaoGIKHa..",
      "..aHKIHoatvrvtryJqukwmqxArtptrpalHKIHa..",
      "..aJxCEoavtrttyqtJuMwmxmsArprrsaoACCEa..",
      "..acxAccavtrvtytqJuMwmxrmAtstrpaccCEca..",
      "..adELooavtrttEvtEuMwmErsErsrrsaolELla..",
      "..adLfloavvpvtrEEmuMwmuEEttptrpaloLcfa..",
      "..adcfooavtpttpasquMwmuastrprrsaollcla..",
      "..acccccavtpvtrtqmuMwmurmrrstrpaccccca..",
      "..adfcooayxxyxxyxzzMwzzAyAAyAAyaolclla..",
      "..addcloaCCCCCCCCDDMwDDEEEEEEEEaloclfa..",
      "..adfcooattpttpqtmuMNmqmstrsrrsaolclla..",
      "..acccccattpvtrtqmuMNmqrmtrstrpaccccca..",
      "..adcfooavrrttpvrmuONmurstrsrrsaolocla..",
      "..afcfooattpvtrvqmuONmqrmttstrpalolcfa..",
      "..adcfooattrttpqrmuONmumsrrprrsaolocla..",
      "..acccccattpvtrtqquONmqpmtrstrpaccccca..",
      "aaaffcooatrrttpvrmuONmqrstpsrrsaolcllaaa",
      "abBbBbBBBoBBBBNBNkoMMkkbNbBobbbbbbbbobba",
      "affdodfdfdfdfofNfkkMMkoNfNfffffofffflffa",
      "olflffflfoffffffffofflflflfoflllllllolll",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
  // 帰還魔法陣: 床に刻まれた二重の光環と六芒の紋、立ち昇る光の柱と光の粒
  portal: {
    palette: {
      k: "rgba(120,220,235,0.25)", a: "#9fd4e3", b: "rgba(120,220,235,0.125)", c: "#f0fdff", d: "#c9ecf4",
      e: "rgba(120,220,235,0.375)", f: "#72b8cf", g: "rgba(120,220,235,0.5)", h: "#0a1f2e", i: "#215c78",
      j: "#04101a", l: "#0f2f44", m: "#2f7896",
    },
    art: [
      "..............k....................",
      ".............kak...................",
      ".............bkbbbbbbb.............",
      ".............bbbbbbbbb.k...........",
      ".............bbkkkkkbbkck..........",
      ".............bbkdddkbb.k...........",
      "............kbbkdddkbb.............",
      "...........kdkbedddebb.............",
      "............kbbedddebb........k....",
      ".............kkedddekk.......kfk...",
      ".............kkedddekdk.......k....",
      ".............kkgcccgkk.............",
      ".............kkgcccgkk....k........",
      ".............kkfcccfkk...kdk.......",
      ".............kkfcccfkk....k........",
      ".........k...kkfcccfkk.............",
      "........kdk..kkfcccfkk.............",
      ".....k...k...kkfcccfkk.............",
      "....kfk......kkfcccfkk.............",
      ".....k.......kkfcccfkk......k......",
      "...........bffffcccffffb...kak.....",
      ".......ffdhhhhhacccahhhhhdffk......",
      "....ffhhhhiihhhacccahhhiihjhjff....",
      "..fdhhhahhhhlllacccalllllhhihhhdf..",
      ".ffhhiaaaaaaaaaacccaaaaaaaaaaihhff.",
      "ffhhihhaalllallacccallallhaahhihhff",
      "fhhiilhllaaalllacccalllaaahllhiijhf",
      "adhmmhlllaaalllacccalllaaalllhmmhda",
      "aajhmlhaalllallacccallalhlaahhmhjaa",
      ".aahhmaaaaaaaaaaaaaaaaaaaaaaamhhaa.",
      "..adjhhmhlhlhlhahllahlhlhlhmhhjda..",
      "....aahjhhmmhllhaaahlhhmmhhjhaa....",
      ".......aadjhhhhhhhhhhhhhjdaa.......",
      "............aaaaadaaaaa............",
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
  // 風化した死体 (魂なし): 襤褸の外套に横たわる白骨。頭蓋・肋・骨盤と、手の先に錆びた剣
  corpse: {
    palette: {
      k: "#0b090e", a: "#4c515b", b: "#808792", c: "#c9ced4", d: "#646a75", e: "#7a5334", f: "#c3b495",
      g: "#614028", h: "#934823", i: "#383c45", j: "#a8987c", l: "#372216", m: "#582612", n: "#763519",
      o: "#282b32", p: "#dccfb2", q: "#8a7b64", r: "#6b5e4c", s: "#f0e7d0", t: "#0b0c0c", u: "#4b5850",
      v: "#3e4943", w: "#030205", x: "#141817", y: "#323c37", z: "#07060b", A: "#4f4437", B: "#1d2321",
      C: "#272f2c",
    },
    art: [
      "..............kk......................",
      ".............kabk.....................",
      "........kkk...kbk.....................",
      ".......kcbbkkkkdkkkkkkkkk.............",
      ".......kbdaefggdcchhhcccckkkkkkkkkk...",
      ".......kbaijjflddmnmnddddccchccchhnk..",
      "........kkjjkfkdoooooooooddnmnmnmkk...",
      "....kkkkkjjk.kkikkkkkkkkkooooookk.k...",
      "..kkpqppkjfk.koik........kkkkkk..krk..",
      ".kssspqffjjpk.kk........k.........k...",
      "kspspjppffjfk.kkkkkkkk.kqk............",
      "kpsppppffjjjpkstststsukukkk...........",
      "kpprqpfqrjqjfkptptptpvvuvspk.kkkkkkkk.",
      "kppwwffwwjqvptptptptptpvsppfkjjjsjqqjk",
      "kffwxffwxqrvftftftftftfvffwjfffpfffjjk",
      ".kffwfwwjruppppppppppppyfjjqyyykkykkqk",
      ".kffjzrqqqqpptptptptptpAjjjjyByyCyk.k.",
      "..kjjqqqqvuqjtjtjtjtjtjyffjjyyyCyyk...",
      "...kqpqpqvvyqtqtqtqtqtqyjjwqjyCCCk....",
      "..krwwwwwACyqrqtqtqtqCBCjqzrfqCxCk....",
      "...krjrjryCyjqrtrtrtrCBCBrABBjqBBk....",
      ".k.kArrrAyyyyyjryyyCyCCBCBCBCBjqCkkk..",
      "kqk.kkkkkkyyByyjqqxyyxBBtCCxCBkfrrrqk.",
      ".krk......kCyCCCjrqqqBCBBBCCkBkkjjjqk.",
      "..k........kCkkBBBBBrBrBxkCCkkBkkkkkrk",
      "............k..kkxkkxrrkkkxkkqrk....k.",
      ".................k..kkk...k..kk.......",
    ],
  },
  // まだあたたかい死体 (魂が宿る): うつ伏せに倒れた冒険者 (凹んだ兜・紅の外套・革の脚衣)。届かぬ剣と、背から立ち昇る青い燐光
  corpseWarm: {
    palette: {
      k: "rgba(140,210,235,0.375)", a: "#9fd4e3", b: "#f0fdff", c: "#c9ecf4", d: "rgba(120,200,230,0.25)",
      e: "#72b8cf", f: "#4b98b4", g: "#0b090e", h: "#2f7896", i: "#88302c", j: "#6d2024", l: "#a3433a",
      m: "#215c78", n: "#eef1f3", o: "#7a5334", p: "#4b2f1e", q: "#372216", r: "#c9ced4", s: "#a2a9b2",
      t: "#808792", u: "#614028", v: "#24160e", w: "#5a4029", x: "#43301f", y: "#735435", z: "#030205",
      A: "#282b32", B: "#646a75", C: "#4c515b", D: "#2f2015", E: "#383c45", F: "#53181d", G: "#eccf7c",
      H: "#1e140e", I: "#b38a2c", J: "#3b1117", K: "#8e6a43", L: "#ab8556", M: "#260b10", N: "#d4ad48",
      O: "#674a17", P: "#8d6820",
    },
    art: [
      "................k.....................",
      "...............kak....................",
      "................k..k..................",
      "..................kbk.................",
      ".............k.....k..................",
      "............kck.......................",
      ".............kdcd.....................",
      "..............dad....k................",
      "...............dad..kak...............",
      "...........k....dad..k................",
      "..........kek...ded...................",
      "...........k....ded...................",
      "...............dfd....................",
      "...............dfd.....k..............",
      ".........k....dfd.....kfk.............",
      ".......ggfk...dhd......k..............",
      "......gijg....dhd.....................",
      "...ggglgggggggggmgggg..g...ggg........",
      "..gnnnnnnoooollllmlllggpgggqqqgg.ggg..",
      ".gnnnrrstooouulffflllllvgqqpqqqqgwxyg.",
      "gnznnrsstoouupllfllllilpqqpppqqqwxxxg.",
      "gnzArsstBCuppqlliilliiipqppppgppxxDDDg",
      "grzAsttECEvvvvjiliijiiipjpggg.ggxDDDg.",
      "gszAttBCEpqiiijiiiiFjijGFg......gDHHg.",
      ".gzBBBCEEpqiiFijjjjjijjIjggggg.ggggg..",
      "..gCCEEppqviFjjjFJjjjjJpqpqqqqgvyKLg..",
      ".gAAAAAAAqjjFjjjFJFFjFJppppppppvywwxg.",
      "..ggggpqqgFFFjFFMFJJJJFvuupppppvwwxxg.",
      "...ggppqg.ggFFFFJJJJJJJpJJguuuuvxxxDg.",
      "..gnrrqqgg..gggggMMJMMMpMg.ggggvDDDg..",
      ".gtrstqgGIg......gMMMggMMg....gvggg...",
      ".gCtBCggGIgggggggggMg..gg......g......",
      "..ggNuuuIOrrrrrrrrrgggggggggggggg.....",
      "...gPqqqIOCBCBCBCBCrrrrrrrrrrrrrtg....",
      "....ggggOOgggggggggCBCBCBCBCBCBCg.....",
      ".......gOOg........ggggggggggggg......",
      "........gg............................",
    ],
  },
  // 青い人魂 (まだ魂が宿るあたたかい死体の目印): 白い芯の火の玉から、尾が上へたなびいて巻く
  wisp: {
    palette: {
      k: "rgba(130,205,235,0.375)", a: "#0f2f44", b: "#17435c", c: "#215c78", d: "#2f7896", e: "#4b98b4",
      f: "#9fd4e3", g: "#72b8cf", h: "#c9ecf4", i: "#f0fdff",
    },
    art: [
      ".........k........",
      "........kak.......",
      ".......kabak......",
      "........kaak......",
      "........kacak.....",
      ".........kacak....",
      ".........kacak....",
      ".........kaccak...",
      ".........kacdbak..",
      ".........kacdcak..",
      ".........kacdcak..",
      "........kabddcak..",
      "........kacddcbak.",
      ".......kaccddcbak.",
      "......kaccdedcbak.",
      ".....kaacddedcbak.",
      "....kabcddeddccak.",
      "...kaccdeeedccbak.",
      "..kacdeeffgedccak.",
      ".kacdegffhfgdcbak.",
      "kabceghiiihgeccbak",
      "kabdefhiiihfedcbak",
      "kacdgfiiiiifgdcbak",
      "kabdefhiiihfedccak",
      "kacceghhihfgeccbak",
      "kabcdegfffgedcbbak",
      ".kabcdeegeeddccak.",
      "..kabccdcdccccak..",
      "...kabcccccccak...",
      "....kabbbcbbak....",
      ".....kaaaaaak.....",
      "......kkkkkk......",
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
  // 迷宮のイベント (events.js): 紫に灯る眼の印を刻んだ苔むす立石。まわりに燐光が漂う
  event: {
    palette: {
      k: "rgba(150,100,240,0.125)", a: "#0b090e", b: "rgba(170,120,255,0.25)", c: "#73707a", d: "#5d5965",
      e: "#d6b9ff", f: "#8d8a93", g: "#4a4652", h: "#393641", i: "#9561d8", j: "#7442b4", l: "#2f4525",
      m: "#2b2833", n: "#1f1d26", o: "#b78af0", p: "#aeabb2", q: "#15131a", r: "#f2e8ff", s: "#58318e",
      t: "#030205", u: "#21311b", v: "#405a30", w: "#152012",
    },
    art: [
      ".............kkk................",
      "............kaaakkk..........b..",
      "...........kaccdaaak........beb.",
      ".....b....kacffffghak........b..",
      "....bib..kaffccddfghak..........",
      ".....b..kacfffccdghhhak.........",
      ".......kafffffcdjghhhlak........",
      ".......kafcffccjgghhmmlak...b...",
      ".......kacdffccdjhhhmnlak..bob..",
      "......kapddcccdjghghmnnak...b...",
      "...b..kapdfcccddghghmnnak.......",
      "..beb.kafcfcdddihhggmmnlak......",
      "...b..kafcfccdigimgghmmnak......",
      "......kafcfcdiggmigghmnnak......",
      ".....kafccfciddghgihhmnqak......",
      ".....kafcffiioorooiimmnqak......",
      ".....kafcssifortsohihssqak......",
      ".....kafcffiioorooiimnqaak......",
      ".....kafcpfciddgggihmnnaak......",
      ".....kaccpfcdidgdiggnnqaak....b.",
      ".....kacfpfccdigigghmnnaak...beb",
      ".....kacfpfcdcdigghhmmqaak....b.",
      ".b...kacppfcdccgdghhhmqaak......",
      "bob..kacfffcddgggghhmmaqak......",
      ".b...kacfffcddggjhhhmnaaak......",
      ".....kafffccddhjhghhmnaaak......",
      "......kafffccghhjhghmnaaak.b....",
      "......kaffccddhjhgghnaaaakbib...",
      ".....kkaflfldhuglgghllqalakb....",
      "....kaaafffclluggullnllllaak....",
      "...kavvvuulclullugulllualvlak...",
      "..kallvvuucvlluluhlvnlluulllak..",
      ".kalllvlllvlvulluulluluulluuuak.",
      "..kallululuuluuuuluuuuwuwwwuak..",
      "...kaulululuuuuuuuuwuwuuuwwak...",
      "....kaaaaauuwuuuuwwuwuaaaaak....",
      ".....kkkkkaaaaaaaaaaaakkkkk.....",
      "..........kkkkkkkkkkkk..........",
    ],
  },
  // 毒 (毒状態・毒の床用): 黒緑の毒沼に半ば沈んだ髑髏と、病んだ燐光・泡
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

// ---- 原画そのまま版の絵 (職業の全身像・胸像) ----
// spr.photo = { img, sx, sy, sw, sh } (原画の切り出し矩形。画像の外にはみ出した分は透明)、
// spr.w / spr.h = ドット絵と同じ升目単位の大きさ。ドット絵と同じ関数 (drawSprite / crispCanvas /
// spriteCanvas) で、升目の大きさに合わせて滑らかに拡大縮小して描く。
function photoReady(p) { return !!(p.img && p.img.complete && p.img.naturalWidth > 0); }
// 絵の升目の大きさ (ドット絵は文字グリッド、原画版は w/h)
function dims(spr) {
  if (spr.photo) return { w: spr.w, h: spr.h, rows: null };
  return normalize(spr.art);
}
// 原画の矩形を (dx,dy,dw,dh) へ描く。まだ読み込み中なら false
export function drawPhoto(ctx, spr, dx, dy, dw, dh) {
  const p = spr.photo;
  if (!photoReady(p)) return false;
  const iw = p.img.naturalWidth, ih = p.img.naturalHeight;
  // 切り出し矩形を画像の内側に詰め、はみ出した分だけ描き先も詰める (画像外の指定は描かない)
  const x0 = Math.max(0, p.sx), y0 = Math.max(0, p.sy);
  const x1 = Math.min(iw, p.sx + p.sw), y1 = Math.min(ih, p.sy + p.sh);
  if (x1 <= x0 || y1 <= y0) return true;
  const kx = dw / p.sw, ky = dh / p.sh;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(p.img, x0, y0, x1 - x0, y1 - y0, dx + (x0 - p.sx) * kx, dy + (y0 - p.sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
  ctx.restore();
  return true;
}
// 原画の読み込みを待ってから fn を呼ぶ (読み込み済みなら即座に)
export function whenPhoto(spr, fn) {
  const p = spr.photo;
  if (photoReady(p)) { fn(); return; }
  if (p.img && p.img.addEventListener) p.img.addEventListener("load", fn, { once: true });
}
// 原画版の絵を canvas に描く (読み込み待ちなら読み込み後に描き直す)。滑らかに縮める絵なので pixelated にしない
function photoInto(c, spr, dx, dy, dw, dh) {
  c.style.imageRendering = "auto";
  whenPhoto(spr, () => {
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    drawPhoto(g, spr, dx, dy, dw, dh);
  });
}

// Canvasコンテキストにドット絵を描く
// cx,cy: 中心座標 / size: 1ドットの大きさ(px)
// size が小数でも隙間が出ないよう、各ドットの矩形は「隣のドットの開始位置まで」
// をピクセル整数に丸めて敷き詰める (位置と幅を別々に丸めると格子状の線が入る)。
export function drawSprite(ctx, mon, cx, cy, size, alpha = 1) {
  const { w, h, rows } = dims(mon);
  const ox = cx - (w * size) / 2;
  const oy = cy - (h * size) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (mon.photo) {
    drawPhoto(ctx, mon, ox, oy, w * size, h * size);
    ctx.restore();
    return;
  }
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
  const { w, h } = dims(mon);
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
  const { w, h } = dims(spr);
  const dpr = Math.min(3, Math.max(1, Math.round((typeof window !== "undefined" && window.devicePixelRatio) || 1)));
  if (spr.photo) {
    // 原画版: ドット絵と同じ大きさ (升目を物理ピクセルの整数倍) で、端末の画素密度の解像度に滑らかに描く。
    // 枠いっぱいに伸ばすとドット絵の職より大きく見えて、顔アイコンの大きさが揃わない
    const s = Math.floor((size * dpr) / Math.max(w, h, 1));
    const k = s >= 1 ? s : (size * dpr) / Math.max(w, h, 1);
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.style.width = c.width / dpr + "px"; c.style.height = c.height / dpr + "px";
    c.style.setProperty("--spr-size", size + "px");
    photoInto(c, spr, 0, 0, c.width, c.height);
    return c;
  }
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
  const { w, h } = dims(spr);
  const k = Math.max(12, w, h) / 12;
  if (spr.photo) {
    // 原画版: ドット絵と同じ見かけの大きさ (12升換算) で、端末の画素密度の解像度に滑らかに描く
    const dpr = Math.min(3, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    const px = Math.round(css * dpr);
    c.width = px; c.height = px;
    c.style.setProperty("--spr-size", css + "px");
    const dot = (scale * dpr) / k, W = w * dot, H = h * dot;
    photoInto(c, spr, (px - W) / 2, (px - H) / 2, W, H);
    return c;
  }
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
    // 整数倍で描く (ドットの幅を揃える)。ただし切り捨てで 15% 以上縮む時 (40 ドット級の絵を
    // 小さな枠に描く時など) は小数倍のまま敷き詰めて、枠いっぱいの大きさを保つ
    const d = Math.floor(dot) >= dot * 0.85 ? Math.floor(dot) : dot;
    drawSprite(ctx, spr, px / 2, px / 2, d);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const W = w * dot, H = h * dot;
    ctx.drawImage(artBitmap(spr), (px - W) / 2, (px - H) / 2, W, H);
  }
  return c;
}
