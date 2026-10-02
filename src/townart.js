// 街のドット絵: 施設アイコン / 王の肖像 / 街の夜景パノラマ
// sprites.js と同じ形式 ({ palette, art }) で定義する。'.' は透明、'o' は輪郭 (最暗)。
// 全アイコンは 16x16 グリッド・同じ輪郭の太さ・左上光源・素材ごとに 3 階調。

// 共通パレット (全アイコンで同じ色味を使い、セットとしての統一感を出す)
const BASE = {
  o: "#0a0610", // 輪郭
  K: "#040208", // 虚無 (闇の底)
  // 金
  Y: "#ffe58a", G: "#d9a82e", g: "#8a6416",
  // 石
  W: "#d2cbe0", S: "#8c84a4", s: "#4e4766",
  // 木
  T: "#c48a52", B: "#8a5a30", b: "#55341c",
  // 鉄
  I: "#b8c0d0", i: "#6c7388", k: "#363a4c",
  // 骨・羊皮紙・白
  H: "#f4eedc", h: "#bdb39a",
  // 赤い魂
  R: "#ffb08a", r: "#e4554f", d: "#8a1f2e",
  // 青白い魂
  C: "#e8fdff", c: "#6fd6e8", e: "#2c7f9a",
  // 紫
  V: "#c9a6f2", v: "#8a64c0", u: "#4a3272",
  // 屋根 (粘板岩の青紫)
  P: "#7a68a8", p: "#463a6c",
  // 灯
  L: "#fff3b8", l: "#ffb347", n: "#c2621c",
};
const pal = (extra) => ({ ...BASE, ...(extra || {}) });

export const TOWN_ICONS = {
  // 人業の館: 切妻屋根の暗い館。灯る窓に吊られた操り人形の影
  mansion: {
    palette: pal(),
    art: [
      ".......oo.......",
      "......oPPo..ooo.",
      ".....oPPPpo.oBo.",
      "....oPPPPppooBo.",
      "...oPPPPPpppoBo.",
      "..oPPPPPPppppo..",
      ".oPPPPPPPpppppo.",
      "oooooooooooooooo",
      ".oWoLuLLLLuLoSo.",
      ".oWoLuLHHLuLoSo.",
      ".oWoLuLhhLuLoSo.",
      ".oWoluuuuuuloSo.",
      ".oWollluullloSo.",
      ".oWollluullloSo.",
      ".oWollullulloSo.",
      ".oooooooooooooo.",
    ],
  },
  // 酒場「沈まぬ灯」: 泡の溢れるジョッキと吊り灯
  tavern: {
    palette: pal(),
    art: [
      ".............o..",
      "...ooo.ooo..oko.",
      "..oHHHoHHHoolLlo",
      ".oHHHHHHHHoolLlo",
      ".oHHHHHHhho.oko.",
      ".ohHHhhhhho.....",
      ".oIIIIIIiko.....",
      ".oTHBTTBbkoooo..",
      ".oTHBTTBbkoIiko.",
      ".oTTBTTBbkoo.io.",
      ".oTTBTTBbkoo.io.",
      ".oIIIIIIikoIiko.",
      ".oTTBTTBbkoooo..",
      ".oTTBTTBbko.....",
      ".obbbbbbbbo.....",
      "..oooooooo......",
    ],
  },
  // 商店「黒鉄商会」: 口を縛った革の銭袋と積まれた金貨
  shop: {
    palette: pal(),
    art: [
      "................",
      ".....oo..oo.....",
      "....oBTooBbo....",
      ".....oTBBbo.....",
      "....oGYYYGgo....",
      "....okBBBbko....",
      "...oTTBBBBbbo...",
      "..oTTBBBBBBbbo..",
      ".oTTBBBBBBBbbbo.",
      ".oTBBBGYGBbooooo",
      ".oTBBBYbGBboYYGo",
      ".oTBBBGGgBboGGgo",
      ".oBBBBBBBbboYYGo",
      "..obbbbbbbboGGgo",
      "...oooooooooYYGo",
      "...........ooooo",
    ],
  },
  // 宿屋「白狼」: 鉄の腕木に吊られた看板。三日月と白い狼の横顔
  inn: {
    palette: pal(),
    art: [
      "...........oYYo.",
      "....o.....oYGo..",
      "...oHo....oYo...",
      "...oHso...oYGo..",
      "..oHHsHo...oYYo.",
      "..oHHHHHo.....oo",
      "..oHHHHHHo...oKo",
      ".oHHHHHoHHo.oHHo",
      ".oHHHHHHHHHoHHo.",
      "oHoHHHHHHHHHHWo.",
      ".oHHHHHHHHWoooo.",
      "oHHHHHHHHWWo....",
      ".oHHHHHHWWSo....",
      "oHHHHHHWWWSo....",
      "oHHHHHWWWSSo....",
      "oooooooooooo....",
    ],
  },
  // 王宮: 双塔に挟まれた天守。正面に深紅と金の王家の垂れ幕、頂に金の王旗
  palace: {
    palette: pal(),
    art: [
      ".......oooo.....",
      "......SYYYGo....",
      "......SGGgo.....",
      "......S.........",
      "..oo.oSoooo.oo..",
      ".oWo.oWSSSsooWo.",
      "oooooooooooooooo",
      "oWSsoWSSSSSsoWSo",
      "oWSsoWdYYdSsoWSo",
      "oWlsoWdGGdSsoWlo",
      "oWSsoWSddSSsoWSo",
      "oWSsoWSSSSSsoWSo",
      "oWSsoWSooSSsoWSo",
      "oWSsoWoKKoSsoWSo",
      "oWSsoWoKKoSsoWSo",
      "oooooooooooooooo",
    ],
  },
  // 赤い魂の祠: 石の鳥居の下、台座に燃える赤い魂
  shrine: {
    palette: pal(),
    art: [
      "o..............o",
      "oooooooooooooooo",
      "oWWWWWWWWWWWSsso",
      "oooooooooooooooo",
      "..oWo......oSo..",
      ".oooooooooooooo.",
      ".oWSSSSSSSSSSso.",
      ".oooooooooooooo.",
      "..oWo..oo..oSo..",
      "..oWodorRodoSo..",
      "..oWoorRRrooSo..",
      "..oWoorRRrooSo..",
      "..oWoodrrdooSo..",
      "..oWo.oddo.oSo..",
      "..oWooWSSsooSo..",
      "oooooooooooooooo",
    ],
  },
  // 魂の祭壇: 石の祭壇の上に浮かぶ青白い魂
  altar: {
    palette: pal(),
    art: [
      "........o.......",
      ".......oco......",
      ".....o.oCco.....",
      "....oco.oCco....",
      "....ocoocCCco.c.",
      "...ocCcCCCCco...",
      "..c.ocCCCLCCco..",
      "....ocCCLLLCco..",
      "....oecCLLCceo..",
      ".....oecccceo...",
      "..e...oooooo....",
      ".oooooooooooooo.",
      ".oWWWWWWWWWWWSo.",
      ".osssssssssssso.",
      "..oWSoeccoeSso..",
      ".oooooooooooooo.",
    ],
  },
  // パーティ編成: 交差する二振りの剣と盾
  party: {
    palette: pal(),
    art: [
      "oo............oo",
      "oIo..........oIo",
      ".oIo........oIo.",
      "..oIo......oIo..",
      "...oIoooooooIo..",
      "...ooYGGGGGGoo..",
      "...oYvvvVvvvGo..",
      "...oGvvVYVvuGo..",
      "...oGvVYYYVuGo..",
      "...oGvvVYVvuGo..",
      "..ooGvvvVvuuGoo.",
      ".oGooGvvvuuGooGo",
      "oGo.oGvvuuGo.oGo",
      "oo...oGuuGo...oo",
      "......oGGo......",
      ".......oo.......",
    ],
  },
  // 人業保管庫: 立てた棺の中で眠る人形
  manage: {
    palette: pal(),
    art: [
      ".....oooooo.....",
      "....oTTBBBbo....",
      "...oTouuuuobo...",
      "..oTouGYYGuobo..",
      "..oToGHHHHGobo..",
      "..oToGkHHkGobo..",
      "..oToGrHHrGobo..",
      "..oTouuhhuuobo..",
      "...oTovVVvobo...",
      "...oTovVvvobo...",
      "...oTovvvvobo...",
      "....oTouuobo....",
      "....oTouuobo....",
      "....oTBBbbbo....",
      ".....oooooo.....",
      "................",
    ],
  },
  // モンスター図鑑: 角ある髑髏を載せた赤革の書
  codexMon: {
    palette: pal(),
    art: [
      "..o..........o..",
      ".oHo........oHo.",
      ".ohHo.oooo.oHho.",
      "..ohooHHHHoohho.",
      "...ooHHHHHHoo...",
      "....oHKKHKKho...",
      "....oHKKHKKho...",
      "....ohHHoHhho...",
      ".....ohHHhho....",
      "....oooHhHooo...",
      "..oooooooooooo..",
      ".orrrrrrrrrrrdo.",
      ".orRRYrrrrrrddo.",
      ".odddddddddddddo",
      ".oHHHHHHHHHHHHho",
      ".oooooooooooooo.",
    ],
  },
  // アイテム図鑑: 青革の書に立てかけた剣
  codexItem: {
    palette: pal({ N: "#7a9ae0", m: "#3e5aa0", M: "#24305e" }),
    art: [
      "............oo..",
      "...........oIo..",
      "..........oIio..",
      ".........oIio...",
      "........oIio....",
      "...oo..oIio.....",
      "...oGooIio......",
      "....oGIio.......",
      "....oGGo........",
      "...oBoGGo.......",
      "..oBooooooooooo.",
      ".oNNNNNNNNNNNmo.",
      ".oNNYNmmmmmmmMo.",
      ".omMMMMMMMMMMMMo",
      ".oHHHHHHHHHHHHho",
      ".oooooooooooooo.",
    ],
  },
  // 職業図鑑: 封蝋の押された巻物
  codexJob: {
    palette: pal(),
    art: [
      "................",
      "..oooooooooooo..",
      ".oTBHHHHHHHHBbo.",
      ".oBoooooooooobo.",
      "..oHHHHHHHHHho..",
      "..oHsssHsssHho..",
      "..oHHHHHHHHHho..",
      "..oHssHssssHho..",
      "..oHHHHHHHHHho..",
      "..oHsssssHHHho..",
      "..oHHHHHHorroo..",
      "..oHssHHorRrrdo.",
      ".ooooooooRrrdo..",
      ".oTBHHHHHordoo..",
      ".oBbbbbbbbodro..",
      "..oooooooooodo..",
    ],
  },
  // 勲章の間: リボンに吊られた金の勲章
  codexAch: {
    palette: pal(),
    art: [
      "..ooooo.ooooo...",
      "..orrdo.ovuuo...",
      "...orrdovuuo....",
      "...ordrovvuo....",
      "....ordvvuo.....",
      "....ooooooo.....",
      "...oYYYYYGGo....",
      "..oYGGGgGGGgo...",
      "..oYGGgHgGGgo...",
      "..oYggHHHggGo...",
      "..oYgHHHHHgGo...",
      "..oYGgHHHgGgo...",
      "..oYGgHgHgGgo...",
      "...oGgGGGgGo....",
      "....oggggggo....",
      ".....oooooo.....",
    ],
  },
  // 宝物庫: 金貨の溢れる宝箱
  treasury: {
    palette: pal(),
    art: [
      "..ooooooooooooo.",
      "..oTTTTBBBBBBbo.",
      "..oBBBBBBBBBBbo.",
      "..oIiiiiiiiiiko.",
      "..oBBBBBBBBBBbo.",
      ".oYoYYoYGGoYGoo.",
      "oYYGYYGYYGGYGGGo",
      "oGYYGGYYGGYYGGgo",
      "oooooooooooooooo",
      "oTTBBBBoYoBBBBbo",
      "oIIiiiioGoiiiiko",
      "oTBBBBBBoBBBBbbo",
      "oTBBBBBBBBBBBbbo",
      "oIIiiiiiiiiiiiko",
      "obbbbbbbbbbbbbbo",
      "oooooooooooooooo",
    ],
  },
  // 無限迷宮「奈落」: 紫に渦巻く底なしの穴
  abyss: {
    palette: pal(),
    art: [
      "..c.........V...",
      ".....oooooo.....",
      "...ooVVVVvuoo...",
      "..oouuuuuVVvoo..",
      "..ouuvuuuuVVuo..",
      ".ouuVvvvvKuVvuo.",
      ".ouVvKKKuuKvvuo.",
      "ouvVuKuKKuKvvuVo",
      "ouVuuvKKKuKvuuVo",
      "ouVuuvKKKKvvuuVo",
      ".oVuuvKKuvuuuVo.",
      ".oVuuuvKKKuuuVo.",
      "..oVuuvvuuuVVo..",
      "..oouuuvVVVvoo..",
      "...oouuuuuuoo...",
      ".....oooooo.....",
    ],
  },
  // 迷宮へ潜る: 石のアーチと闇へ下る階段
  dive: {
    palette: pal(),
    art: [
      "....oooooooo....",
      "..ooWWWWSSSSoo..",
      ".oWWooooooooSso.",
      ".oWoKKKKKKKKoso.",
      "oWoKKKKKKKKKKoso",
      "oWoKKKKKKKKKKoso",
      "oWoKKKKuuKKKKoso",
      "oSoKKKuuuuKKKoso",
      "oSoKKKKKKKKKKoso",
      "oSoKKssssssKKoso",
      "oSoKKuuuuuuKKoso",
      "oSoKSSSSSSSSKoso",
      "oSoKssssssssKoso",
      "oSoWWWWWWWWWWoso",
      "oSSSSSSSSSSSSsso",
      "oooooooooooooooo",
    ],
  },
  // 施設が閉ざされている: 鉄の錠前
  lock: {
    palette: pal(),
    art: [
      "................",
      ".....oooooo.....",
      "....oIIIIIIo....",
      "...oIIooooIko...",
      "...oIo....oko...",
      "...oIo....oko...",
      "..oooooooooooo..",
      "..oIIIIIIIIIIo..",
      "..oIiiiiiiiiko..",
      "..oIiiiYGiiiko..",
      "..oIiiYKKgiiko..",
      "..oIiiGKKgiiko..",
      "..oIiiiKKiiiko..",
      "..oIiiiggiiiko..",
      "..okkkkkkkkkko..",
      "...oooooooooo...",
    ],
  },
};

// 王の肖像 (物語の対話用の胸像)
export const KING_PORTRAIT = {
  palette: pal({
    F: "#e8b894", f: "#b88466", j: "#7a5040", // 肌
    X: "#f2f0f4", x: "#c4c0cc", z: "#8c8898", // 白い髭・髪
    Z: "#b82838", q: "#7a1626", Q: "#4a0c18", // 深紅の衣
    E: "#f4f0ea", w: "#cfc8c0", // 毛皮の襟 (白貂)
    J: "#5ad0ff", // 王冠の宝石 (青)
  }),
  art: [
    ".............oo.............",
    ".........o..oHHo..o.........",
    "........oHo.oYGo.oHo........",
    ".......o.oYooYGooYo.o.......",
    ".......oYoYGoYGoYGoYo.......",
    ".......oYGYGGYGGYGYGo.......",
    ".....oXoYYYYYYYYYYYGoxo.....",
    "....oXxoGJGrGGGGrGJgoxzo....",
    "....oXxoggggggggggggoxzo....",
    "....oXxxjfffffffffjjxzzo....",
    "...oXxxxFFFFFFFFFfffxxzzo...",
    "...oXxxxXXXxFFFfxXXxxxzzo...",
    "..oXXxxzjjjXxFfxXjjjzxxzzo..",
    "..oXxxxzfHokjFfjkoHfzxxzzo..",
    "..oXxxzzFffFFFfffjffzzxzzo..",
    "..oXxxzzFFFjFFfjffffzzxzzo..",
    "..oxXxzzXXXXXXxxxxxxzzxzzo..",
    "...oxxxzXXXzzzzzzxxzzzzzo...",
    ".oEEEEooXXXXXxXxxxzxoowwwwo.",
    "oEEoEEooXXxXXxXxxzxxoowowwwo",
    "oEEEEoEooXxXXxxxzxxoowwwowwo",
    "oEoEEEEooXXxXxxzxxzoowwwwowo",
    "oZZZZYZZZoXxXxxzxxoqqqYqqqqo",
    "oZZZZZYZZoXXxxzxxzoqqYqqqqQo",
    "oZQZZZZYZZoXxxzxxoqqYqqqQqQo",
    "oZQZZZZZYZZoXxzxoqqYqqqqQqQo",
    "oZQZZZZZZYZZoxzoqqYqqqqqQqQo",
    "oZQZZZZZZZYZZooqqYqqqqqqQqQo",
  ],
};

// ───────────────────────────────────────────────────────────────────────────
// 街の夜景パノラマ「辺境の街 ロアダル」
// 内部解像度 240x84。静的な層 (空・山・王宮・家並み・奈落の穴) は生成時に一度だけ
// 描き、毎フレームは星の瞬き・窓の灯・煙・魂の燐光・灯籠・祠の赤光・王旗だけを重ねる。
// アニメーションは performance.now() からの純関数なので、画面を作り直しても動きが途切れない。
// ───────────────────────────────────────────────────────────────────────────
const SW = 240, SH = 84;
const SCENE_FPS = 12;

// 決定的な乱数 (mulberry32)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const frac = (v) => v - Math.floor(v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// 情景の色 (UI の配色と調和させる)
const SC = {
  bg: "#0b0b12",
  sky: ["#04030f", "#08071a", "#0d0b26", "#141034", "#1c1642", "#261d4e", "#2f2457"],
  star: ["#4a4672", "#8f89c0", "#d8d4f4", "#ffffff"],
  moon: "#ece4c6", moonShade: "#c8bd98", moonCrater: "#d6cbab", moonHalo: "#3a3170",
  farMt: "#211a42", farRidge: "#2f2858",
  nearMt: "#161232", nearRidge: "#231d44",
  hill: "#0e0b1e", hillRidge: "#1b1634",
  palWall: "#0f0c1e", palLit: "#2c2652", palRoof: "#1a1434", palRoofLit: "#3a2f68", palDark: "#06050c",
  gold: "#d9a82e", goldLit: "#ffe58a",
  wall: ["#1d1726", "#211a2b", "#1a1524"], wallLit: "#2b2338", beam: "#110d18",
  roof: ["#261d3e", "#2a2144", "#221a3a"], roofLit: "#40366c", eave: "#0b0912",
  backWall: "#141022", backRoof: "#1b1632", backLit: "#29224a",
  ground: "#0d0a15", path: "#14101d", rock: "#1f1b2c", rockLit: "#34304a", rockHi: "#4a4462",
  hole: "#030207", unlit: "#0c0a12",
  win: ["#5a2a10", "#9a4a16", "#d07a26", "#ffb347", "#ffd98a"],
  soul: ["#6a4d90", "#9a7ad8", "#bfe9f4", "#e8fdff"],
  smoke: "#5a5478", bat: "#05040b",
  red: ["#5a1420", "#8a1f2e", "#e4554f", "#ffb08a"],
  violet: ["#24163e", "#3a2560", "#6a4d90", "#a888e0"],
};

// 地形の高さ
const farRidge = (() => {
  const r = seeded(7), pts = [];
  for (let x = -20; x <= SW + 30; x += 14 + Math.floor(r() * 16)) pts.push([x, 30 + Math.floor(r() * 14)]);
  return (x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return 40;
  };
})();
const nearRidge = (x) => 50 + 3 * Math.sin(x * 0.05 + 1.3) + 2 * Math.sin(x * 0.13 + 0.4) + Math.sin(x * 0.31);
const hillTop = (x) => 60 - 16 * Math.exp(-(((x - 170) / 32) ** 2));
const groundTop = (x) => 64 + Math.round(Math.sin(x * 0.07) * 0.8);

// 奈落の穴 (左手の迷宮の口)
const PIT = { x: 40, y: 64, rx: 21, ry: 5 };
// 赤い魂の祠
const SHRINE = { x: 86, y: 67 };
// 月
const MOON = { x: 206, y: 15, r: 7 };

// 家並み: 後列 (遠い・暗い) と前列
const BACK_HOUSES = [
  { x: 102, w: 14, h: 8, r: 6 }, { x: 117, w: 12, h: 10, r: 5 }, { x: 131, w: 15, h: 7, r: 7, side: true },
  { x: 196, w: 13, h: 9, r: 6 }, { x: 211, w: 12, h: 7, r: 5, side: true }, { x: 225, w: 16, h: 10, r: 6 },
];
const FRONT_HOUSES = [
  { x: 98, w: 17, h: 11, r: 8, chim: 3 },
  { x: 117, w: 22, h: 14, r: 9, chim: 16, tavern: true, side: true },
  { x: 141, w: 15, h: 10, r: 7 },
  { x: 158, w: 20, h: 15, r: 10, chim: 13 },
  { x: 180, w: 14, h: 10, r: 7, side: true },
  { x: 196, w: 20, h: 13, r: 9, chim: 3 },
  { x: 218, w: 23, h: 12, r: 8, side: true, chim: 17 },
];
const HOUSE_BASE = 71, BACK_BASE = 60;

function mkLayer(draw) {
  const cv = document.createElement("canvas");
  cv.width = SW; cv.height = SH;
  draw(cv.getContext("2d"), cv);
  return cv;
}

// 空 (ディザのかかった夜空のグラデーション + 月と暈)
function paintSky(ctx) {
  const img = ctx.createImageData(SW, SH), d = img.data;
  const bands = SC.sky.map(rgbOf), horizon = 56;
  const halo = rgbOf(SC.moonHalo);
  const M = MOON;
  for (let y = 0; y < SH; y++) {
    const v = clamp01(y / horizon) * (bands.length - 1);
    const lo = Math.floor(v), f = v - lo;
    for (let x = 0; x < SW; x++) {
      let col = bands[Math.min(bands.length - 1, f > bayer(x, y) ? lo + 1 : lo)];
      // 月の暈 (同心の輪に量子化して、ドット絵らしい段差で滲ませる)
      const dm = Math.hypot(x - M.x, y - M.y);
      if (dm > M.r && dm < M.r + 16) {
        const a = Math.floor((1 - (dm - M.r) / 16) ** 1.6 * 4 + bayer(x, y) * 0.5) / 4 * 0.7;
        if (a > 0) col = col.map((v, j) => Math.round(v + (halo[j] - v) * a));
      }
      const i = (y * SW + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // 月 (左下にわずかに陰りの残る十四夜の月)
  for (let y = -M.r; y <= M.r; y++) {
    for (let x = -M.r; x <= M.r; x++) {
      if (x * x + y * y > M.r * M.r + M.r * 0.6) continue;
      const shade = (x + M.r * 0.5) ** 2 + (y - M.r * 0.2) ** 2 > (M.r * 1.25) ** 2 && x < 0;
      ctx.fillStyle = shade ? SC.moonShade : SC.moon;
      ctx.fillRect(M.x + x, M.y + y, 1, 1);
    }
  }
  ctx.fillStyle = SC.moonCrater;
  for (const [dx, dy, w] of [[2, -3, 2], [-1, 1, 2], [3, 2, 1], [-3, -2, 1], [0, 4, 1]]) ctx.fillRect(M.x + dx, M.y + dy, w, 1);
}

// 静的な地上 (山並み・丘と王宮・家並み・奈落の穴・祠)。動く光の位置を out に記録する
function paintLand(ctx, out) {
  const px = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const r = seeded(1337);
  // 遠い山並み
  for (let x = 0; x < SW; x++) {
    const y = Math.round(farRidge(x));
    px(SC.farRidge, x, y, 1, 1);
    px(SC.farMt, x, y + 1, 1, SH - y);
  }
  // 近い丘陵
  for (let x = 0; x < SW; x++) {
    const y = Math.round(nearRidge(x));
    px(SC.nearRidge, x, y, 1, 1);
    px(SC.nearMt, x, y + 1, 1, SH - y);
  }
  // 王宮の丘
  for (let x = 104; x < SW; x++) {
    const y = Math.round(hillTop(x));
    px(SC.hillRidge, x, y, 1, 1);
    px(SC.hill, x, y + 1, 1, SH - y);
  }
  paintPalace(ctx, px, out);
  // 後列の家並み (遠景・灯は小さく)
  for (const h of BACK_HOUSES) paintHouse(ctx, px, h, BACK_BASE, true, out, r);
  // 地面
  for (let x = 0; x < SW; x++) {
    const y = groundTop(x);
    px(SC.ground, x, y, 1, SH - y);
  }
  // 奈落から町へ続く踏み分け道
  for (let x = PIT.x + 18; x < 112; x++) {
    const y = 67 + Math.round(Math.sin(x * 0.09) * 1.2 + (x - 60) * 0.03);
    px(SC.path, x, y, 1, 2);
  }
  paintPit(ctx, px, out);
  paintShrine(ctx, px, out);
  // 前列の家並み
  for (const h of FRONT_HOUSES) paintHouse(ctx, px, h, HOUSE_BASE, false, out, r);
}

function paintPalace(ctx, pxRaw, out) {
  const OY = 3; // 王宮全体の縦位置 (旗が上端で切れないよう少し下げる)
  const px = (c, x, y, w, h) => pxRaw(c, x, y + OY, w, h);
  const W = SC.palWall, L = SC.palLit;
  const block = (x, y, w, h) => { px(W, x, y, w, h); px(L, x + w - 1, y, 1, h); };
  const crenel = (x0, x1, y, step) => { for (let x = x0; x <= x1; x += step) px(W, x, y, 2, 2); };
  const cone = (cx, top, base, half) => {
    for (let y = top; y <= base; y++) {
      const hw = Math.round(((y - top) / (base - top)) * half);
      px(SC.palRoof, cx - hw, y, hw + 1, 1);
      px(SC.palRoofLit, cx + 1, y, hw, 1);
    }
    px(SC.gold, cx, top - 1, 1, 1);
  };
  // 城壁
  block(144, 39, 54, 10); crenel(144, 196, 37, 4);
  // 左右の塔
  block(140, 27, 8, 22); cone(143, 19, 27, 5);
  block(193, 29, 8, 20); cone(196, 22, 29, 5);
  // 主塔 (天守)
  block(156, 24, 27, 25); crenel(156, 181, 22, 3);
  // 中央の高塔
  block(165, 14, 9, 10); cone(169, 7, 14, 5);
  px(SC.palDark, 169, 1, 1, 6); // 旗竿
  out.banner = { x: 170, y: 1 + OY };
  // 門 (奥に灯)
  px(SC.palDark, 166, 41, 7, 8); px(SC.palDark, 167, 40, 5, 1);
  out.windows.push({ x: 168, y: 45 + OY, w: 3, h: 2, ph: 0.3, dim: 0.3 });
  // 窓
  for (const [x, y, w, h] of [[160, 29, 1, 2], [169, 29, 1, 2], [178, 29, 1, 2], [163, 35, 1, 2], [175, 35, 1, 2], [169, 17, 1, 2], [143, 31, 1, 2], [196, 33, 1, 2], [150, 42, 1, 1], [188, 42, 1, 1]]) {
    out.windows.push({ x, y: y + OY, w, h, ph: (x * 7.3 + y) % 6.28, dim: 0.75 });
  }
}

function paintHouse(ctx, px, h, base, back, out, r) {
  const top = base - h.h;
  const wall = back ? SC.backWall : SC.wall[h.x % 3];
  const roof = back ? SC.backRoof : SC.roof[h.x % 3];
  const lit = back ? SC.backLit : SC.roofLit;
  // 壁
  px(wall, h.x, top, h.w, h.h);
  if (!back) {
    px(SC.wallLit, h.x + h.w - 1, top, 1, h.h);
    // 木組み (梁)
    px(SC.beam, h.x, top, h.w, 1);
    px(SC.beam, h.x, top + Math.floor(h.h / 2), h.w, 1);
    px(SC.beam, h.x, top, 1, h.h);
    if (h.w > 15) px(SC.beam, h.x + Math.floor(h.w / 2), top, 1, h.h);
  }
  // 屋根: 妻入り (三角) か 平入り (台形)
  for (let i = 0; i < h.r; i++) {
    const y = top - 1 - i;
    let x0, x1;
    if (h.side) { x0 = h.x - 1 + i; x1 = h.x + h.w - i; if (i === h.r - 1) { x0 = h.x + 2; x1 = h.x + h.w - 3; } }
    else {
      const half = (h.w + 2) / 2, k = 1 - i / h.r;
      x0 = Math.round(h.x + h.w / 2 - half * k); x1 = Math.round(h.x + h.w / 2 + half * k) - 1;
    }
    if (x1 < x0) continue;
    px(roof, x0, y, x1 - x0 + 1, 1);
    px(lit, x1, y, 1, 1); // 月光の縁
  }
  if (!back) px(SC.eave, h.x - (h.side ? 1 : 0), top, h.w + (h.side ? 2 : 0), 1); // 軒の影
  // 煙突
  if (h.chim != null) {
    const cx = h.x + h.chim, cy = top - h.r + 1;
    px(roof, cx, cy - 2, 2, 4); px(lit, cx + 1, cy - 2, 1, 4);
    out.chimneys.push({ x: cx + 1, y: cy - 3, seed: h.x });
  }
  // 窓
  const n = back ? 1 + (h.w > 13 ? 1 : 0) : Math.max(1, Math.floor(h.w / 7));
  for (let k = 0; k < n; k++) {
    const wx = h.x + Math.round(((k + 1) * h.w) / (n + 1)) - (back ? 0 : 1);
    const wy = back ? top + 3 : top + 3 + (k % 2 && h.h > 12 ? 5 : 0);
    const lit = r() > (back ? 0.35 : 0.15);
    if (!lit) { px(SC.unlit, wx, wy, back ? 1 : 2, back ? 1 : 2); continue; }
    out.windows.push({ x: wx, y: wy, w: back ? 1 : 2, h: back ? 1 : 2, ph: r() * 6.28, dim: back ? 0.6 : 1 });
  }
  // 酒場「沈まぬ灯」: 戸口と腕木に吊るした灯
  if (h.tavern) {
    px(SC.beam, h.x + 4, base - 6, 4, 6);
    out.windows.push({ x: h.x + 5, y: base - 5, w: 2, h: 5, ph: 1.1, dim: 0.55 });
    const lx = h.x + h.w + 1, ly = top + 4;
    px(SC.beam, h.x + h.w, ly - 2, 3, 1); px(SC.beam, lx + 1, ly - 1, 1, 1);
    out.lantern = { x: lx + 1, y: ly };
  }
}

function paintPit(ctx, px, out) {
  const { x: cx, y: cy, rx, ry } = PIT;
  // 穴と縁石
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
    for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const eo = ((x - cx) / (rx + 3)) ** 2 + ((y - cy) / (ry + 2)) ** 2;
      if (e <= 1) px(SC.hole, x, y);
      else if (eo <= 1) {
        const near = y > cy; // 手前の縁は月明かりを受ける
        const n = (x * 13 + y * 7) % 5;
        px(near ? (n === 0 ? SC.rockHi : SC.rockLit) : (n < 2 ? SC.rockLit : SC.rock), x, y);
      }
    }
  }
  // 崩れた石柱 (百の迷宮の門の名残)
  const pillar = (x, top, base, brk) => { // brk: 欠けた列のビット (その列は 2px 低く折れている)
    for (let i = 0; i < 4; i++) {
      const t = top + ((brk >> i) & 1 ? 2 : 0);
      px(i === 3 ? SC.rockLit : SC.rock, x + i, t, 1, base - t);
    }
    px(SC.rockLit, x - 1, base - 2, 6, 2); // 礎石
  };
  pillar(11, 48, 64, 0b0101);
  pillar(66, 53, 66, 0b1000);
  px(SC.rock, 9, 46, 3, 2); // 傾いた冠石
  px(SC.rockLit, 12, 47, 2, 1);
  out.pit = { x: cx, y: cy, rx, ry };
}

function paintShrine(ctx, px, out) {
  const { x, y } = SHRINE;
  const C = "#2a2234", L = "#3a3048";
  px(C, x - 7, y - 11, 15, 1); px(C, x - 8, y - 12, 2, 1); px(C, x + 7, y - 12, 2, 1); // 笠木 (反り)
  px(L, x - 6, y - 12, 13, 1);
  px(C, x - 5, y - 9, 11, 1); // 貫
  px(C, x - 5, y - 10, 1, 10); px(C, x + 5, y - 10, 1, 10); // 柱
  px(L, x + 5, y - 10, 1, 10);
  px(C, x - 2, y - 2, 5, 2); px(L, x - 2, y - 2, 5, 1); // 台座
  out.shrine = { x, y: y - 5 };
}

// 下端をページ背景 (#0b0b12) へ溶かす (y58 から薄く掛かり、最下 6 行は背景色そのもの)
function paintFade(ctx) {
  const img = ctx.createImageData(SW, SH), d = img.data, bg = rgbOf(SC.bg);
  const y0 = 58;
  for (let y = y0; y < SH; y++) {
    const a = clamp01((y - y0) / (SH - 6 - y0)) ** 1.25;
    for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * 4;
      d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function buildStars() {
  const r = seeded(4242), stars = [];
  while (stars.length < 78) {
    const x = Math.floor(r() * SW), y = Math.floor(r() * 46);
    if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 5) continue; // 月の周りは避ける
    if (y > farRidge(x) - 2) continue;
    stars.push({ x, y, b: r(), sp: 0.6 + r() * 2.2, ph: r() * 6.28, big: r() < 0.08 });
  }
  return stars;
}

export function createTownScene() {
  const c = document.createElement("canvas");
  c.className = "town-scene";
  c.width = SW; c.height = SH;
  if (typeof c.setAttribute === "function") {
    c.setAttribute("role", "img");
    c.setAttribute("aria-label", "辺境の街ロアダルの夜景");
  }
  const ctx = typeof c.getContext === "function" ? c.getContext("2d") : null;
  if (!ctx) return c; // DOM スタブ等 (描画手段なし) ではそのまま返す

  const out = { windows: [], chimneys: [], banner: null, lantern: null, pit: null, shrine: null };
  const sky = mkLayer(paintSky);
  const land = mkLayer((g) => paintLand(g, out));
  const fade = mkLayer(paintFade);
  const stars = buildStars();
  const px = (col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const glow = (col, x, y, rad, alpha) => { // ディザで粒立てた光暈
    ctx.fillStyle = col;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const d = Math.hypot(dx, dy) / rad;
      if (d >= 1) continue;
      if ((1 - d) * (1 - d) * alpha > bayer(x + dx, y + dy)) ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  };

  function draw(t) {
    ctx.drawImage(sky, 0, 0);
    // 星の瞬き
    for (const s of stars) {
      const v = s.b * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      const k = v > 0.85 ? 3 : v > 0.6 ? 2 : v > 0.3 ? 1 : 0;
      px(SC.star[k], s.x, s.y);
      if (s.big && k >= 2) { px(SC.star[1], s.x - 1, s.y); px(SC.star[1], s.x + 1, s.y); px(SC.star[1], s.x, s.y - 1); px(SC.star[1], s.x, s.y + 1); }
    }
    // 流れ星 (およそ 13 秒に一度)
    const sp = t / 13, sk = Math.floor(sp), sf = frac(sp);
    if (sf < 0.05) {
      const p = sf / 0.05, sx = 30 + ((sk * 53) % 150), sy = 4 + ((sk * 17) % 12);
      for (let i = 0; i < 7; i++) {
        const q = p * 26 - i;
        if (q < 0) continue;
        px(SC.star[Math.max(0, 3 - Math.floor(i / 2))], sx - q, sy + q * 0.45);
      }
    }
    // 夜空を横切る蝙蝠 (時折)
    for (let b = 0; b < 2; b++) {
      const cyc = (t + b * 2.6) / 21, ck = Math.floor(cyc), cf = frac(cyc);
      if (cf > 0.75) continue;
      const p = cf / 0.75, dir = ck % 2 ? -1 : 1;
      const bx = dir > 0 ? -6 + p * 252 : 246 - p * 252;
      const by = 18 + ((ck * 11 + b * 7) % 14) + Math.sin(t * 2.1 + b) * 3;
      const up = Math.floor(t * 8 + b * 3) % 2;
      const x = Math.round(bx) + b * 7, y = Math.round(by) + b * 4;
      px(SC.bat, x + 1, y + 1, 3, 1); // 胴
      if (up) { px(SC.bat, x, y, 1, 1); px(SC.bat, x + 4, y, 1, 1); }
      else { px(SC.bat, x, y + 2, 1, 1); px(SC.bat, x + 4, y + 2, 1, 1); }
    }
    ctx.drawImage(land, 0, 0);

    // 王宮と家々の窓の灯 (ゆらぐ)
    for (const w of out.windows) {
      const f = 0.72 + 0.16 * Math.sin(t * 2.3 + w.ph) + 0.12 * Math.sin(t * 5.7 + w.ph * 2.1);
      const k = Math.max(0, Math.min(4, Math.round(f * w.dim * 4)));
      px(SC.win[k], w.x, w.y, w.w, w.h);
      if (w.w >= 2 && w.h === 2) px(SC.win[Math.max(0, k - 2)], w.x, w.y + 1, w.w, 1); // 窓の下半分は少し暗く
    }
    // 奈落の穴の紫光 (奥壁がゆっくり脈打つ)
    if (out.pit) {
      const P = out.pit, pulse = 0.55 + 0.45 * Math.sin(t * 0.9);
      for (let x = -P.rx + 2; x <= P.rx - 2; x++) {
        const yy = P.y - Math.round(P.ry * Math.sqrt(1 - (x / P.rx) ** 2)) + 1;
        const edge = 1 - Math.abs(x) / P.rx;
        const k = edge * pulse > 0.55 ? 3 : edge * pulse > 0.3 ? 2 : 1;
        px(SC.violet[k], P.x + x, yy);
        if (edge * pulse > 0.4) px(SC.violet[k - 1], P.x + x, yy + 1);
        if (edge * pulse > 0.7) px(SC.violet[0], P.x + x, yy + 2);
      }
      // 立ちのぼる魂の燐光
      for (let i = 0; i < 14; i++) {
        const life = frac(t * 0.05 + i / 14 + ((i * 0.37) % 0.08));
        const ox = ((i * 29) % 32) - 16;
        const x = P.x + ox * (1 - life * 0.45) + Math.sin(t * 0.8 + i * 1.7) * 3 * life;
        const y = P.y - 2 - life * 56;
        const a = Math.sin(Math.PI * life);
        if (a < 0.1) continue;
        // 淡い光暈 + 芯 + かすかな尾。生まれたては紫、昇るほど青白く
        ctx.globalAlpha = a * 0.45;
        px(life < 0.3 ? SC.soul[0] : SC.soul[1], x - 1, y, 3, 1);
        px(life < 0.3 ? SC.soul[0] : SC.soul[1], x, y - 1, 1, 3);
        ctx.globalAlpha = a * 0.35;
        px(SC.soul[1], x, y + 2);
        ctx.globalAlpha = Math.min(1, a * 1.3);
        px(life < 0.3 ? SC.soul[1] : a > 0.6 ? SC.soul[3] : SC.soul[2], x, y);
        ctx.globalAlpha = 1;
      }
    }
    // 煙突の煙 (右へ流れる)
    for (const ch of out.chimneys) {
      for (let i = 0; i < 7; i++) {
        const life = frac(t * 0.11 + i / 7 + ch.seed * 0.013);
        const x = ch.x + life * 13 + Math.sin(life * 7 + i + ch.seed) * 1.2;
        const y = ch.y - life * 20;
        const a = (1 - life) * 0.7;
        if (a < 0.08) continue;
        ctx.globalAlpha = a;
        const sz = 1 + Math.floor(life * 3);
        px(SC.smoke, x - (sz >> 1), y - (sz >> 1), sz, sz);
        ctx.globalAlpha = 1;
      }
    }
    // 酒場の灯「沈まぬ灯」
    if (out.lantern) {
      const L = out.lantern, f = 0.8 + 0.2 * Math.sin(t * 7.1) * Math.sin(t * 2.3 + 1);
      glow(SC.win[2], L.x, L.y + 1, 6, 0.55 * f);
      glow(SC.win[3], L.x, L.y + 1, 3, 0.8 * f);
      px(SC.beam, L.x - 1, L.y - 1, 3, 1);
      px(f > 0.85 ? SC.win[4] : SC.win[3], L.x - 1, L.y, 3, 2);
      px(SC.beam, L.x - 1, L.y + 2, 3, 1);
    }
    // 赤い魂の祠
    if (out.shrine) {
      const S = out.shrine, f = 0.6 + 0.4 * Math.sin(t * 1.6) * Math.sin(t * 0.7 + 2);
      glow(SC.red[0], S.x, S.y, 7, 0.7 * (0.7 + f * 0.3));
      glow(SC.red[1], S.x, S.y, 4, 0.8 * f);
      const fl = Math.round(Math.sin(t * 9) * 0.6);
      px(SC.red[2], S.x - 1, S.y - 1, 3, 3);
      px(SC.red[2], S.x + fl, S.y - 2, 1, 1);
      px(SC.red[3], S.x, S.y, 1, 1);
      px(f > 0.7 ? SC.red[3] : SC.red[2], S.x, S.y - 1, 1, 1);
    }
    // 王旗 (金)
    if (out.banner) {
      const B = out.banner;
      for (let i = 0; i < 6; i++) {
        const dy = Math.round(Math.sin(t * 3.2 - i * 0.9) * 0.9 * (i / 5));
        px(i === 0 ? SC.goldLit : SC.gold, B.x + i, B.y + dy, 1, i < 5 ? 2 : 1);
      }
    }
    ctx.drawImage(fade, 0, 0);
  }

  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  draw(reduced ? 6.2 : now() / 1000);
  if (reduced || typeof requestAnimationFrame !== "function") return c;

  // ~12fps に間引いたループ。一度 DOM に繋がった canvas が外されたら自ら止まる。
  // (生成後 15 秒経っても一度も繋がらなければ、漏れを防ぐためにやはり止まる)
  const born = now();
  let last = 0, wasConnected = false;
  const step = (ts) => {
    if (c.isConnected) wasConnected = true;
    else if (wasConnected || ts - born > 15000) return;
    if (ts - last >= 1000 / SCENE_FPS - 2) {
      last = ts;
      // 非表示 (display:none の祖先) の間は描かない
      if (wasConnected && c.getClientRects().length) draw(ts / 1000);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return c;
}
