// オープニング — 新規ゲーム開始時に一度だけ流れる導入シーン
//
// 「百の迷宮」「生者は還らない」「人業 (Doll) と魂封じ」「魂繰りたるあなた」を
// 5幕の語りで提示し、最後にタイトルを掲げて街へ送り出す。
// 演出は DOM オーバーレイ + 既存のピクセルアート (drawSprite 系)。
// クリック/タップで行送り、いつでも「とばす」で省略できる。
import { spriteCanvas, ICONS } from "./sprites.js";
import { soulSprite } from "./souls.js";
import { SFX } from "./audio.js";

// 空の人業 — 吊り糸の下、虚ろな目をした木と鋼の器
const DOLL_EMPTY = {
  palette: { "0": "#1a1622", "1": "#8a7456", "2": "#5c4a38", "3": "#2e2638", "4": "#3a4a52" },
  art: [
    "..0......0..",
    "...0....0...",
    "....0000....",
    "...011110...",
    "...033330...",
    "...011110...",
    "..00111100..",
    ".0411111140.",
    ".0401221040.",
    ".4.012210.4.",
    "...02..20...",
    "...00..00...",
  ],
};

// 魂を宿した人業 — 同じ器に、眼と胸の灯がともり、糸は消える
const DOLL_AWAKE = {
  palette: { "0": "#1a1622", "1": "#8a7456", "2": "#5c4a38", "3": "#6fd6e8", "4": "#3a4a52", "5": "#9fe8f4" },
  art: [
    "............",
    "............",
    "....0000....",
    "...011110...",
    "...035530...",
    "...011110...",
    "..00111100..",
    ".0411331140.",
    ".0401351040.",
    ".4.012210.4.",
    "...02..20...",
    "...00..00...",
  ],
};

// 魂繰り — 黒衣のフードの奥に金の双眸、指先から魂の糸を垂らす者
const PUPPETEER = {
  palette: { "0": "#0c0a12", "1": "#2a2438", "2": "#3c3450", "3": "#e8c47a", "4": "#6fd6e8" },
  art: [
    "....0000....",
    "...022220...",
    "..02211220..",
    "..02133120..",
    "..02111120..",
    ".0221111220.",
    ".0211111120.",
    "021111111120",
    "021111111120",
    ".4.011110...",
    ".4..0110....",
    ".44.0000....",
  ],
};

// 5幕構成。sprites: 上段に並べるピクセルアート / lines: 語り / last: タイトル幕
const SCENES = [
  {
    sprites: [ICONS.stairs],
    lines: [
      "この国の地の底には、百の迷宮が口を開けている。",
      "死者の魂を喰らい、夜ごと肥え続ける——底知れぬ病巣。",
      "灯りの届かぬ深みで、喰われた魂は出口を探してさまよい続ける。",
    ],
  },
  {
    sprites: [ICONS.corpse],
    lines: [
      "かつて幾千の生者が、剣を取り、灯を掲げ、闇へ降りた。",
      "還った者は、ひとりもいない。",
      "深淵の瘴気は鎧も祈りも素通りし、生きた魂から順に喰らうのだ。",
    ],
  },
  {
    sprites: [DOLL_EMPTY],
    lines: [
      "ゆえに人は、人ならざる探索者をこしらえた。",
      "木と鋼と祈りで編まれた人型の器——人業（ドール）。",
      "息をせず、夢を見ず、瘴気にも竜の炎にも怯まぬ、空っぽの体。",
      "ただし、空の器はけっして歩かない。",
    ],
  },
  {
    sprites: [soulSprite("priest"), DOLL_AWAKE, soulSprite("fighter")],
    lines: [
      "器を満たすのは、迷宮からすくい上げた死者の魂。",
      "頭に。両の腕に。胴に。足に。——五つの魂を封じたとき、",
      "人業は静かに目を開ける。",
      "戦士の魂は剣を握り、僧の魂は祈りを唱え、",
      "死者たちは二度目の生を、闇の底で戦い抜く。",
    ],
  },
  {
    sprites: [PUPPETEER],
    lines: [
      "魂を繰り、人業を率い、迷宮の腑へと送り込む者。",
      "人はその業を畏れ、こう呼んだ——〈魂繰り〉と。",
      "",
      "いま、老いた王の勅命が、ひとりの魂繰りを辺境の王宮へ召す。",
      "すなわち——あなたを。",
    ],
    last: true,
  },
];

function div(cls, text) {
  const e = document.createElement("div");
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function showOpening(onDone) {
  const wrap = div("op-overlay");
  const stage = div("op-stage");
  wrap.appendChild(stage);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add("op-out");
    setTimeout(() => { wrap.remove(); if (onDone) onDone(); }, 650);
  };

  const skip = document.createElement("button");
  skip.className = "op-skip";
  skip.textContent = "とばす ≫";
  skip.addEventListener("click", (ev) => { ev.stopPropagation(); close(); });
  wrap.appendChild(skip);

  let idx = 0;
  let revealed = false; // 現在の幕の全行が表示済みか

  const renderScene = () => {
    const sc = SCENES[idx];
    revealed = false;
    stage.innerHTML = "";
    stage.classList.remove("op-reveal");

    const row = div("op-sprites");
    for (const spr of sc.sprites) row.appendChild(spriteCanvas(spr, 8));
    stage.appendChild(row);

    let delay = 0.55;
    for (const t of sc.lines) {
      const ln = div("op-line", t || " ");
      ln.style.animationDelay = delay.toFixed(2) + "s";
      delay += t ? 1.15 : 0.35;
      stage.appendChild(ln);
    }

    if (sc.last) {
      const tt = div("op-title", "百の迷宮と 魂の王");
      tt.style.animationDelay = (delay + 0.6).toFixed(2) + "s";
      stage.appendChild(tt);
      const ts = div("op-subtitle", "— Hundred Labyrinths: Rise of the Soul King —");
      ts.style.animationDelay = (delay + 1.4).toFixed(2) + "s";
      stage.appendChild(ts);
      delay += 1.8;
    }

    const next = div("op-next", sc.last ? "▼ 物語を始める" : "▼");
    next.style.animationDelay = (delay + 0.4).toFixed(2) + "s";
    stage.appendChild(next);

    // 最終行のフェードが終わる頃に「全行表示済み」へ
    setTimeout(() => { revealed = true; }, (delay + 0.4) * 1000);
  };

  wrap.addEventListener("click", () => {
    if (closed) return;
    try { SFX.select(); } catch {}
    if (!revealed) {
      // まだ流れている途中なら、全行を即時表示
      stage.classList.add("op-reveal");
      revealed = true;
      return;
    }
    if (idx >= SCENES.length - 1) { close(); return; }
    idx++;
    renderScene();
  });

  renderScene();
  document.body.appendChild(wrap);
}
