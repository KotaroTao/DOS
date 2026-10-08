// 迷宮の盤面を歩く「操霊師」(プレイヤーの分身) — 頭巾つきの外套をまとった4方向のドット絵
//
// ユーザー提供の原画 (ChatGPT 製) を格子推定 → 本来の解像度へ戻し → 減色してドット化したもの。
// 向き: down=正面 / up=背面 / left=左向き / right=右向き。どの向きも同じ大きさ・同じ足元の高さ。
// 盤面では直前に動いた向きを向く (既定は正面)。描くときは整数倍・補間なしで。
//
// 装い (色) は設定「操霊師の装い」で変えられる (端末の好み PREFS.walkerLook = {cloak, trim})。
// 既定は街の一枚絵 (ロアダルの夜道に立つ操霊師) に合わせた、金の縁取りの黒い外套。
// 絵の文字ごとの役割: 外套 = 7/2/C/5/9/H (明→暗の6段) / 縁取り・目 = 1/A/6/E/B/F (明→暗) /
//                     革 (鞄・帯・長靴) = 8/I/G/J / 手袋・靴底 = 3/D/4 / 0 = 輪郭
const BASE = {
  "0": "#16131a", "3": "#8f7f70", "4": "#4a3c36", "8": "#8a5a34", "D": "#76685d",
  "G": "#5e3a26", "I": "#704626", "J": "#3a261d",
};
const CLOAK_KEYS = ["7", "2", "C", "5", "9", "H"];
const TRIM_KEYS = ["1", "A", "6", "E", "B", "F"];

// 外套の色 (明→暗の6段)。key はセーブ (端末の好み) に残るので変えない・足すだけ
export const WALKER_CLOAKS = [
  { key: "night", name: "夜の黒", ramp: ["#716c72", "#524e56", "#423f47", "#38353d", "#2f2c34", "#27242b"] },
  { key: "crimson", name: "緋", ramp: ["#e26442", "#d63235", "#a22027", "#8d1e24", "#711720", "#60141c"] },
  { key: "navy", name: "紺", ramp: ["#5f7bb4", "#3e5791", "#2f4474", "#283a63", "#213052", "#1b2743"] },
  { key: "forest", name: "深緑", ramp: ["#6f9a5c", "#4a7341", "#385a33", "#2f4c2b", "#273f24", "#1f331d"] },
  { key: "violet", name: "紫", ramp: ["#9a6fb3", "#74498f", "#5a3772", "#4c2e61", "#3f2650", "#331f42"] },
  { key: "ash", name: "灰白", ramp: ["#e4e1d8", "#c4c0b5", "#a29e94", "#8d897f", "#77736b", "#625f58"] },
  { key: "earth", name: "土", ramp: ["#a8835c", "#86643f", "#6b4f31", "#5c432a", "#4d3823", "#3f2e1d"] },
];
// 縁取り (刺繍) と目の光の色 (明→暗の6段)
export const WALKER_TRIMS = [
  { key: "gold", name: "金", ramp: ["#f9cd79", "#f2be64", "#e5a958", "#db9f4e", "#d49649", "#bc8342"] },
  { key: "silver", name: "銀", ramp: ["#f1f3f7", "#dde2ea", "#c6ccd6", "#b4bbc7", "#a4acb9", "#8a92a1"] },
  { key: "copper", name: "銅", ramp: ["#f3b38a", "#e39a6c", "#cf8258", "#bf744c", "#b06a45", "#95563a"] },
  { key: "jade", name: "翠", ramp: ["#bff0c9", "#9ee3b0", "#7fcf98", "#6bbf87", "#5db07a", "#4a9566"] },
];
export const WALKER_LOOK_DEFAULT = { cloak: "night", trim: "gold" };

const pick = (list, key) => list.find((o) => o.key === key) || list[0];
// 好みの値を正しい形に直す (知らない key は既定へ)
export function normalizeLook(look) {
  const l = look && typeof look === "object" ? look : {};
  return { cloak: pick(WALKER_CLOAKS, l.cloak).key, trim: pick(WALKER_TRIMS, l.trim).key };
}
const _looks = new Map();
// 装いに合わせて塗り直した4方向の絵 { down, up, left, right } (各 {name, palette, art})。装いごとに一度だけ作る
export function walkerLook(look) {
  const l = normalizeLook(look);
  const id = `${l.cloak}/${l.trim}`;
  let w = _looks.get(id);
  if (w) return w;
  const palette = { ...BASE };
  pick(WALKER_CLOAKS, l.cloak).ramp.forEach((c, i) => { palette[CLOAK_KEYS[i]] = c; });
  pick(WALKER_TRIMS, l.trim).ramp.forEach((c, i) => { palette[TRIM_KEYS[i]] = c; });
  // 手提げの角灯の位置は金の縁取りの明るい黄から求める (game.js walkerLampSpot) ので、ほかの縁取りは金の絵を手本にする
  const ref = l.trim === WALKER_TRIMS[0].key ? null : walkerLook({ cloak: l.cloak, trim: WALKER_TRIMS[0].key });
  w = {};
  for (const [dir, art] of Object.entries(FRAMES)) w[dir] = { name: "操霊師", palette, art, look: id, ...(ref ? { lampRef: ref[dir] } : {}) };
  _looks.set(id, w);
  return w;
}

const FRAMES = {
  // 正面
  down: [
    "........0000........",
    ".......022CC0.......",
    "......02222CC0......",
    ".....022222CCC0.....",
    "....022222CCCCC0....",
    "....022222CCCCC0....",
    "...0522C11EFCCC50...",
    "...0C22E000EFCCC0...",
    "..0CC1E00000FECC50..",
    "..0C6B00000000BCC0..",
    ".0CCE00A000A000BCC0.",
    ".0CA000100010000EC0.",
    ".0E8000100010000B50.",
    "..09EH00000000GB90..",
    "...006G00000HB800...",
    "....006GHHHGE000....",
    "...0CH0EGHBB0H950...",
    "..022CH0AEI0HC2CC0..",
    "..0119CH0B0HC911E0..",
    ".0200E02909CHE000C0.",
    "022C00GJ11BJJ00H2C0.",
    "02CC90G010B0J09CCC50",
    "0AC9G0550A0990I2CEF0",
    "00AB0HCEJ0JC990AAE00",
    ".4440C210JJBCC0J44J.",
    ".0440C210JJ3B5H04J0.",
    "...0CCCA0BB06CHH0...",
    "..05ECEA00000EG9I0..",
    "...00E00J00JJ0EF0...",
    ".....044J0044J00....",
    ".....0000.00000.....",
  ],
  // 背面
  up: [
    "........000.........",
    ".......022C0........",
    "......02222C0.......",
    ".....02222CCC0......",
    "....022222CCCC0.....",
    "....02C22CCC9C0.....",
    "...HH2C22CCCHCH0....",
    "...02CCC2CCCH5C00...",
    "...02CCCCCC5HHC00...",
    "..02CC9CCCHHHHCCH0..",
    "..02CCHCC9HHHHCC50..",
    ".0CCCCHCCHHHHHCCC50.",
    ".059CCCHHHHHHCC5550.",
    "..0HHHCCCCHHCCHH00..",
    "...0009CCCCC9000....",
    "...05H00HCH00H9H0...",
    "..022C900000H5CC90..",
    "..011CCCHHH5CC66E0..",
    "..0006CCCCCCCE0000..",
    ".0C9006ECCCCEF0HC50.",
    ".02C0H00ACEE0HHHCCH.",
    "02C90CHH0E00H9505C50",
    "06500C5HH0HHHC50HFB0",
    "00B0CC5C9HHC9CCHDB00",
    ".000CC5CCHHCCCCH000.",
    "..0C2CHCCCHCCCCCH0..",
    ".0C22CHC2CHHCCCE890.",
    ".0CBA89C2C9IEEEEG90.",
    "..00000E1EEJ000000..",
    "....0JJ00000JJ00....",
    "....00000..0000.....",
  ],
  // 左向き
  left: [
    "........00000.......",
    "......002222C00.....",
    ".....022222CCCC0....",
    "...J02222CCCCHCC0...",
    ".00HC222CCCCCH0CC0..",
    "011222C22CCCCC0000..",
    "011622C222CCCC0000..",
    "000A6CCC22CCCC0..0..",
    ".000A6CCCCCCCCC0....",
    "..00001ECCCCHHC0....",
    "..000I0FBCCCHHCC0...",
    "..000A00BECHHH9C0...",
    "...001000BCHHCCCC0..",
    "...00000BIHHC5HC90..",
    "....000B90000H9H0...",
    "....00B000CCC000....",
    "....0BB0522CHC0.....",
    "...0EB0C222295C0....",
    "...0E09211E2CHC0....",
    "...00C95005EE9C0....",
    "....0H9002C0EB9C0...",
    "...03JG022C90BBC0...",
    "...03JJ01ECC00B50...",
    "....09C001650H0BH0..",
    "....06C0D00B0HH090..",
    "....01C90DD0H950C0..",
    ".....015000HH550CC0.",
    ".....01CCCC509C90C0.",
    "....000AECCC00250B0.",
    "...0D4JJ0000..000000",
    "...000000000........",
  ],
  // 右向き
  right: [
    ".......00000........",
    ".....00C222200......",
    "....0CCCC222220.....",
    "...0CCHCCCC22220....",
    "..0CC0HCCCCC222C00..",
    "..0000CCCCC22C22110.",
    "..0000CCCC222C27110.",
    "..0..0CCCC22CCCA000.",
    "....0CCCCCCCCC6000..",
    "....0CHHCCCCE10000..",
    "...0CCHHCCCEF0A000..",
    "...0CHHHHCEE001000..",
    "..0CCCHHHCE000100...",
    "..0HCHCCHHIB00000...",
    "...0HHH00009B000....",
    "....000CCC000B00....",
    ".....0CHC2250BB0....",
    "....0C552222C0BB....",
    "....0CHC7611290E0...",
    "....0C96A9C0G950....",
    "...0C5B80C2009H0....",
    "...0CEF09C220GJ30...",
    "...05B00CCEA0JJ30...",
    "..0HB0H0CE100CH0....",
    "..090HH0B00D0CE0....",
    "..0C095H0DD0CC10....",
    ".0CC09CHH000C10.....",
    ".0C095905CCCC10.....",
    ".0B09200CCCEA000....",
    "000000..0000JJ4D0...",
    "....J0..000000000...",
  ],
};

export const WALKER = walkerLook(WALKER_LOOK_DEFAULT);
