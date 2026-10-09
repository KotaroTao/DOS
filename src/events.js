import { WORLD } from "./dungeons/world.js";

// ===== 迷宮のイベント (出来事マス) =====
// 盤面に置かれる「出来事」(type:"event") の定義と進行。基本は選択式で、
// 出現率が低いもの・危険の大きいものほど見返りが大きい。どの出来事も「立ち去る」は無償 (マスは残り、後で戻れる)。
//
// 出現の格 (tier) — share は格ごとの出現の割合 (その場に出せる格だけで按分):
//   common   (常) … どこでも。小さな賭け         (見返り ≒ 戦果1〜2)
//   uncommon (稀) … やや稀。中くらいの賭け         (≒ 戦果3〜5)
//   rare     (秘) … 1回の潜入で1度まで             (≒ 戦果8〜12)
//   mythic   (極) … セーブで一度きり。選択肢は無く、踏めばその場で恒久の恵みを授かる (gift)
// 「戦果1」= その迷宮の通常戦闘1回ぶんの gold / ✦Soul (game.js の evApi が迷宮の魔物から見積もる)。
// 報酬は既存の経路 (pickLoot / acquireSoul / 宝箱) を通るので、層ごとの出現上限 (lootCapR) は越えない。
// LR と赤い魂はイベントからは出さない。
//
// このモジュールは game.js を import しない (循環を避ける)。盤面・戦闘・報酬の操作は
// game.js が組み立てる API オブジェクト A (evApi) 越しに行う。マスの進行状況はマス自身 (cell.ev*) に持たせ、
// 戦闘を挟む進行は「札 (tag)」で表して保存に乗せる (関数は保存できないため)。

export const EV_TIERS = {
  common:   { key: "common",   label: "常", name: "よくある出来事",   share: 62, banner: "✦ 出来事 ✦",            accent: "#c9a227" },
  uncommon: { key: "uncommon", label: "稀", name: "稀な出来事",       share: 28, banner: "✧ 稀なる出来事 ✧",      accent: "#7fb0ff" },
  rare:     { key: "rare",     label: "秘", name: "秘められた出来事", share: 8,  banner: "★ 秘められた出来事 ★",  accent: "#c08aff" },
  mythic:   { key: "mythic",   label: "極", name: "極めて稀な出来事", share: 2,  banner: "✺ 極めて稀なる出来事 ✺", accent: "#ffcf4a" },
};
// 1階あたりの出来事の出現率 (迷宮1は控えめ・常のみ)。0.42 では行き止まりを寄り道しない遊び方だと1層で数回しか出会えなかった
export const EV_FLOOR_RATE = 0.55;
export const EV_FLOOR_RATE_D1 = 0.25;
// その層の専用イベントは見かけやすく (1.5 では共通の出来事に埋もれ、1層を通しても専用の10種のうち2-3種しか出会えなかった)
const LAYER_W = 3;

// 旧仕様で取得済みの恵み (G.events.flags のキー → 効き目)。新しい極は下の DUNGEON_GIFTS のステータスを授ける
export const EV_BOONS = {
  will:     { soulMul: 0.10, text: "先代の遺志 ― ✦Soul の獲得量 +10%" },
  blackCat: { crit: 0.03,    text: "黒猫の加護 ― 全員の会心率 +3%" },
  sewerMap: {                text: "王都の下水図 ― 第2層ではどの階も階段が最初から見える" },
  temper:   { dmgMul: 1.05,  text: "地の底の焼き入れ ― 全員の与えるダメージ +5%" },
  salute:   { preempt: 0.08, text: "守備隊の敬礼 ― 戦闘で先手を取る確率 +8%" },
  mistEye:  { ambush: 0.5,   text: "霧渡りの目 ― 奇襲を受ける確率が半分になる" },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const pctTxt = (p) => `${Math.round(p * 100)}%`;
// 隊の手当ての要不要 (何も起きない選択肢は出さない)
const anyHurt = (A) => A.aliveList().some((m) => m.hp < m.maxhp);
const anyDrained = (A) => A.aliveList().some((m) => m.mp < m.maxmp);
const anyAiling = (A) => A.aliveList().some((m) => m.ailment);
const needsCare = (A) => anyHurt(A) || anyDrained(A) || anyAiling(A);

// ---- 怨霊の謎かけ ----
const RIDDLES = [
  { q: "朝は四つ、昼は二つ、夜は三つの足で歩くものは？", a: "人", w: ["獣", "影"] },
  { q: "生まれた時から棺を背負い、死ぬまで脱がぬものは？", a: "カタツムリ", w: ["亀", "骸骨"] },
  { q: "使えば使うほど小さくなり、灯れば灯るほど影を消すものは？", a: "蝋燭", w: ["剣", "魂"] },
  { q: "名を呼べば消え、黙れば満ちるものは？", a: "静寂", w: ["闇", "霧"] },
  { q: "持ち主には見えず、他人ばかりが口にするものは？", a: "名前", w: ["顔", "罪"] },
  { q: "鍵を持たぬのに、すべての扉を開けて回るものは？", a: "風", w: ["盗賊", "死"] },
  { q: "眠る者にだけ見え、目覚めた者の手には残らぬものは？", a: "夢", w: ["宝", "月"] },
  { q: "王も乞食も等しく抱き、決して返さぬものは？", a: "墓", w: ["神", "夜"] },
  { q: "歯は無いのに噛みつき、口は無いのにすべてを喰らうものは？", a: "時", w: ["炎", "飢え"] },
  { q: "首は無いのに頭を下げ、足は無いのに立って待つものは？", a: "瓶", w: ["案山子", "墓標"] },
];

// ---- 操霊師の遺書 (層ごとのページ) ----
export const LORE_PAGES = {
  1: ["……墓所の土は温かい。死者は眠ってなどいない、ただ待っているのだ。",
      "私は人業に魂を移す術を、王家の命で磨いた。だが誰の魂を、何のために？",
      "答えを知る前に、私の器は朽ちるだろう。次に灯を継ぐ者よ、墓の声に耳を貸すな。"],
  2: ["……王都の下には、もう一つの王都がある。水は全てを運び、全てを沈める。",
      "流れてきた魂は数え切れない。誰かが上から捨てているのだ、器ごと。",
      "私はそれをすくい上げた。救ったのか、盗んだのか、もう分からない。"],
  3: ["……坑夫たちは銀を掘っていたのではない。眠る『何か』の殻を削っていた。",
      "最初の操霊師は、その殻から最初の魂を抜き取ったという。",
      "ならば我らの術は、盗掘の延長に過ぎぬ。深く掘るほど、底は近づく。"],
  4: ["……砦は捨てられたのではない。差し出されたのだ。",
      "守備隊は最後まで援軍を待った。届いたのは、魂脈の汲み口だけだった。",
      "私の師は、それを王に問うた。そして牢に入った。次は私の番だろう。"],
  5: ["……霧は森の吐息だ。迷い込んだ魂を、森は魂脈より先に呑み込む。",
      "森に呑まれた魂は、木になり、灯になり、やがて霧になる。",
      "魂脈に吸われるよりは、ましな終わりかもしれない。私は、そう思いたい。"],
  0: ["……灯を継ぐ者よ。深く潜るほど、魂は重くなる。",
      "人業の器がきしむのは、魂がまだ自分の体を覚えているからだ。",
      "忘れさせてやるな。それが、私にできなかったことだ。"],
};

// ===== 出来事の定義 =====
// 共通フィールド:
//   id, name, layer (0=共通 / 1..=その層専用), tier, icon (ICONS のキー or "mon:<id>"), accent,
//   minFloor (この階以上), deep (迷宮の後半の階のみ), minLv (その階の推奨Lv の下限), maxSkip (この階から先に必要な階数),
//   once (一度きり: true=セーブで1回 / "layer"=層ごとに1回。極はすべて true), cond(A) 追加条件,
//   intro(A, cell) → 本文の行, choices(A, cell) → 選択肢 [{label, fn, primary?, danger?}],
//   gift(A, cell) → 極の出来事: 選択肢の代わり。踏んだ時に恒久の恵みを授け、結果の行を返す。boon = 図鑑に出す恵みの説明,
//   onWin(A, cell, fight, next) … 出来事の戦闘に勝った後の続き (fight.tag で分岐)
// 選択肢の fn は必ず最後に A.done(cell) か A.back() (または次の画面) へつなぐ。
// 何も起きない選択肢は作らない (「立ち去る」と重なる)。その場で効き目の無い選択肢は出さない。

export const EVENTS = [
  // ================= 共通 (33) =================
  {
    id: "c01", name: "苔むした祭壇", layer: 0, tier: "common", icon: "fountain",
    intro: () => ["苔に覆われた小さな祭壇。供物の皿は空のまま、祈りの跡だけが残っている。"],
    choices: (A, cell) => {
      const cost = A.goldCost(1);
      return [
        A.canPayGold(cost) && (anyHurt(A) || anyDrained(A)) && { label: `金貨を供える (💰${cost}) ― HP・MPが3割回復`, primary: true, fn: () => {
          A.payGold(cost); A.healAll(0.3, 0.3, false);
          A.toast("祭壇が淡く光った ― HP・MPが回復した", "good", "fountain"); A.done(cell);
        } },
        { label: "祈るだけ ― ✦Soul を少し", fn: () => {
          A.sfx("heal"); A.soul(0.5, "祭壇への祈り"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c02", name: "行き倒れの冒険者", layer: 0, tier: "common", icon: "corpse",
    intro: () => ["壁にもたれて息絶えた冒険者。腰の袋はまだ膨らんでいる。", "…だが、指先がかすかに動いた気がした。"],
    choices: (A, cell) => [
      { label: "持ち物を漁る ― 金貨 / 25%で起き上がる", danger: true, fn: () => {
        if (chance(0.25)) {
          A.alarm("死体が起き上がった！", ["漁る手を掴まれた。応戦するしかない。"], "corpse",
            () => A.fight(cell, [{ undead: true }], "rise", { noChest: true }));
          return;
        }
        A.gold(2, "冒険者の袋"); A.done(cell);
      } },
      { label: "弔う ― ✦Soul を少し", fn: () => { A.sfx("heal"); A.soul(1, "弔いの祈り"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "冒険者の袋"); A.done(cell, next); },
  },
  {
    id: "c03", name: "囁く壁", layer: 0, tier: "common", icon: "event",
    intro: () => ["石壁の向こうから、誰かの囁きが漏れてくる。", "「……下へ……下へ……」"],
    choices: (A, cell) => [
      { label: "耳を当てる ― 階段のありか / 20%で麻痺", primary: true, fn: () => {
        A.revealStairs();
        A.toast("囁きが道を教えた ― 階段のありかが見えた", "good", "stairs");
        if (chance(0.2)) { const m = A.randomAlive(); if (m) { A.ail(m, "paralyze"); A.toast(`${m.name}は囁きに当てられ、体が痺れた`, "bad", "trap"); } }
        A.done(cell);
      } },
    ],
  },
  {
    id: "c04", name: "錆びた鉄扉", layer: 0, tier: "common", icon: "chest",
    intro: () => ["錆びついた鉄の扉。小部屋の奥に、何かが仕舞われているようだ。"],
    choices: (A, cell) => {
      const d = A.checkDisarm(), s = A.check("atk");
      return [
        { label: `こじ開ける ― ${d.who ? d.who.name : "誰か"} (成功 ${pctTxt(d.p)}) / 失敗で罠`, primary: true, fn: () => {
          if (d.ok) { A.toast(`${d.who.name}が錠を外した`, "good", "chest"); A.chestHere(cell, { rankUp: 1 }); return; }
          A.log("錠をいじるうちに、仕掛けが作動した！", "dmg");
          A.chestHere(cell, { rankUp: 0 }, null, true); // 扉は開いた (罠で飛ばされても宝箱は残る)
          A.trap(() => A.openChestAt(cell));
        } },
        { label: `叩き壊す ― ${s.who ? s.who.name : "誰か"} (成功 ${pctTxt(s.p)}) / 失敗で魔物`, fn: () => {
          if (s.ok) { A.sfx("hit"); A.toast(`${s.who.name}が扉を叩き割った`, "good", "chest"); A.chestHere(cell, { rankUp: 0 }); return; }
          A.alarm("轟音を聞きつけて魔物が来た！", ["扉は歪んだが開かない。片付けてから開けよう。"], "trap",
            () => A.fight(cell, [{ pool: true, min: 2 }], "door", { noChest: true }));
        } },
      ];
    },
    onWin: (A, cell, f, next) => { A.chestHere(cell, { rankUp: 0 }, next); },
  },
  {
    id: "c05", name: "眠る魔物", layer: 0, tier: "common", icon: "event",
    intro: (A, cell) => [`${A.monName(cell.evKey)}が丸くなって眠っている。`, "その背後に、何かが光っている。"],
    setup: (A, cell) => { cell.evKey = A.poolKey(); },
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: "寝首をかく ― 必ず先制できる戦闘", primary: true, fn: () => A.fight(cell, [{ key: cell.evKey }], "nap", { opening: "preempt", noChest: false }) },
        { label: `忍び足で奥へ ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) / 失敗で奇襲`, fn: () => {
          if (c.ok) { A.toast("気づかれずに奥へ抜けた", "good", "chest"); A.chestHere(cell, { rankUp: 0 }); return; }
          A.alarm("魔物が目を覚ました！", ["背後を取られた。奇襲を受ける！"], "trap",
            () => A.fight(cell, [{ key: cell.evKey }], "nap", { opening: "ambush", noChest: false }));
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.done(cell, next),
  },
  {
    id: "c06", name: "双子の扉", layer: 0, tier: "common", icon: "event",
    setup: (A, cell) => { cell.evGood = chance(0.5) ? "L" : "R"; },
    intro: (A, cell) => {
      const lines = ["瓜二つの扉が並んでいる。片方からは金の匂い、もう片方からは血の匂い。"];
      if (A.sense()) lines.push(`気配を読む者が囁く。「${cell.evGood === "L" ? "左" : "右"}の扉の奥が、ほのかに光っている」`);
      return lines;
    },
    choices: (A, cell) => {
      const open = (side) => () => {
        if (side === cell.evGood) { A.sfx("chest"); A.toast("当たりだ ― 宝箱が眠っていた", "good", "chest"); A.chestHere(cell, { rankUp: 0 }); return; }
        if (chance(0.5)) { A.log("外れの扉には罠が仕掛けられていた！", "dmg"); cell.cleared = true; A.trap(() => A.back()); return; }
        A.alarm("外れだ ― 魔物の巣だった！", ["扉の向こうで何かが牙を剥いた。"], "trap",
          () => A.fight(cell, [{ pool: true, min: 2 }], "twin", { noChest: true }));
      };
      return [
        { label: "左の扉を開ける", fn: open("L") },
        { label: "右の扉を開ける", fn: open("R") },
      ];
    },
    onWin: (A, cell, f, next) => A.done(cell, next),
  },
  {
    id: "c07", name: "魂の天秤", layer: 0, tier: "common", icon: "wisp",
    intro: () => ["黒鉄の天秤が宙に浮いている。皿に載せたものを、別の価値に量り替えるという。"],
    choices: (A, cell) => {
      const g = A.goldCost(2), s = A.soulCost(2);
      return [
        A.canPayGold(g) && { label: `金貨を載せる (💰${g}) → ✦Soul (1.5倍相当)`, fn: () => {
          A.payGold(g); A.sfx("spell"); A.soul(3, "天秤"); A.done(cell);
        } },
        A.canPaySoul(s) && { label: `✦Soul を載せる (✦${s}) → 金貨 (1.5倍相当)`, fn: () => {
          A.paySoul(s); A.sfx("spell"); A.gold(3, "天秤"); A.done(cell);
        } },
        A.embers() >= 1 && { label: "魂の残火を1つ載せる → ✦Soul (大)", fn: () => {
          A.payEmber(1); A.sfx("spell"); A.soul(6, "天秤"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c08", name: "蝙蝠の壺", layer: 0, tier: "common", icon: "mon:bs_spiritbat",
    intro: () => ["口の欠けた大壺。中から冷たい羽音が響き、霊蝙蝠の影が揺れている。底のほうで金貨が光った。"],
    choices: (A, cell) => [
      { label: "手を突っ込む ― 金貨 / 40%で眠り", primary: true, fn: () => {
        const m = A.randomAlive();
        A.gold(2, "壺の底");
        if (m && chance(0.4)) { A.ail(m, "sleep"); A.toast(`${m.name}が冷たい羽音に包まれた ― 眠り`, "bad", "sleep"); }
        A.done(cell);
      } },
      { label: "壺を割る ― 霊蝙蝠の群れと戦い、金貨を多く", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_spiritbat", min: 3 }], "jar", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => { A.gold(3, "割れた壺"); A.done(cell, next); },
  },
  {
    id: "c09", name: "サイコロを振る骸骨", layer: 0, tier: "common", icon: "mon:d01_skeleton",
    intro: () => ["朽ちた卓で、骸骨がサイコロを振り続けている。", "「賭けるかね、生者よ。わしは負けたことがない……一度しかな」"],
    choices: (A, cell) => {
      const g = A.goldCost(2), s = A.soulCost(2);
      return [
        A.canPayGold(g) && { label: `金貨を賭ける (💰${g}) ― 1/2で倍`, fn: () => {
          A.payGold(g);
          if (chance(0.5)) { A.sfx("victory"); A.giveGoldRaw(g * 2, "骸骨との賭け"); }
          else { A.sfx("ng"); A.toast("骸骨はカタカタと笑った ― 負けだ", "bad"); }
          A.done(cell);
        } },
        A.canPaySoul(s) && { label: `魂を賭ける (✦${s}) ― 1/3で3倍`, fn: () => {
          A.paySoul(s);
          if (chance(1 / 3)) { A.sfx("victory"); A.giveSoulRaw(s * 3, "骸骨との賭け"); }
          else { A.sfx("ng"); A.toast("骸骨は魂をすすり、満足げにサイコロを振った ― 負けだ", "bad"); }
          A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c10", name: "古の碑文", layer: 0, tier: "common", icon: "event",
    intro: () => ["見知らぬ文字が刻まれた石板。読み解ければ、魂の糧になる知が得られそうだ。"],
    choices: (A, cell) => {
      const c = A.check("int");
      return [
        { label: `解読する ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) / 失敗でMP半減`, primary: true, fn: () => {
          if (c.ok) { A.sfx("spell"); A.soul(2, `${c.who.name}の解読`); }
          else if (c.who) { c.who.mp = Math.floor(c.who.mp / 2); A.sfx("ng"); A.toast(`${c.who.name}は文字に呑まれかけた ― MPが半減`, "bad"); A.refresh(); }
          A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c11", name: "怨霊の謎かけ", layer: 0, tier: "common", icon: "mon:bs_pettyrevenant", minFloor: 2,
    setup: (A, cell) => { cell.evRiddle = Math.floor(Math.random() * RIDDLES.length); },
    intro: (A, cell) => ["青白い怨霊が道を塞いだ。", `「答えよ。${RIDDLES[cell.evRiddle || 0].q}」`],
    choices: (A, cell) => {
      const r = RIDDLES[cell.evRiddle || 0];
      const answers = [r.a, ...r.w].sort(() => Math.random() - 0.5);
      return answers.map((ans) => ({ label: `「${ans}」`, fn: () => {
        if (ans === r.a) {
          A.sfx("victory");
          A.toast("「……正しい」怨霊は満足げに霧散した", "good");
          A.soul(3, "怨霊の謎かけ"); A.gold(1, "怨霊の謎かけ");
        } else {
          A.sfx("trap"); A.flash("#5a3a8a");
          A.hurtAll(0.10);
          A.toast(`「違う。答えは〈${r.a}〉だ」― 恨みの声が隊を打った`, "bad");
        }
        A.done(cell);
      } }));
    },
  },
  {
    id: "c12", name: "祈りの蝋燭", layer: 0, tier: "common", icon: "event",
    intro: () => ["燭台に、火の消えた蝋燭が一本。灯せば、次の戦いで闇が味方するという。"],
    choices: (A, cell) => {
      const cost = A.goldCost(0.5);
      return [
        A.canPayGold(cost) && { label: `火を灯す (💰${cost}) ― 次の戦闘は必ず先制`, primary: true, fn: () => {
          A.payGold(cost); A.runEv().preempt = (A.runEv().preempt || 0) + 1;
          A.sfx("spell"); A.toast("蝋燭が灯った ― 次の戦闘は必ず先手を取れる", "good"); A.done(cell);
        } },
        { label: "蝋を持ち帰る ― 収集品", fn: () => A.collectible("祈りの燭台", () => A.done(cell)) },
      ];
    },
  },
  {
    id: "c13", name: "瓦礫の下の光", layer: 0, tier: "common", icon: "chest", deep: true,
    intro: () => ["崩れた瓦礫の隙間から、金属の光が覗いている。天井はまだ不穏にきしんでいる。"],
    choices: (A, cell) => [
      { label: "掘り出す ― 宝箱 / 30%で落盤", primary: true, fn: () => {
        if (chance(0.3)) { A.sfx("trap"); A.flash("#8a7a5a"); A.hurtAll(0.15); A.toast("天井が崩れた ― 隊全体が傷を負った", "bad", "trap"); }
        A.chestHere(cell, { rankUp: 0 });
      } },
    ],
  },
  {
    id: "c14", name: "魔物の巣穴", layer: 0, tier: "uncommon", icon: "event", deep: true,
    intro: () => ["獣臭い横穴。奥で幾つもの息遣いがする。巣の主は宝を溜め込む性らしい。", "踏み込めば、休む間もなく3度の戦いになる。"],
    choices: (A, cell) => [
      { label: "踏み込む ― 3連戦 / 制せば上等な宝箱と ✦Soul", danger: true, fn: () => {
        cell.evStage = 1;
        A.fight(cell, [{ pool: true, min: 2 }], "nest", { noChest: true });
      } },
      A.countCells((c) => c.type === "monster" && !c.cleared && !c.elite) >= 2 && { label: "卵を潰す ― この階の魔物が2体減る (報酬なし)", fn: () => {
        const n = A.removeMonsters(2);
        A.sfx("hit"); A.toast(`卵を潰した ― この階の魔物が ${n}体 減った`, "info"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => {
      const st = cell.evStage || 1;
      if (st < 3) {
        cell.evStage = st + 1;
        A.toast(`巣の奥から次の群れが来る (${st + 1}/3)`, "bad");
        A.fight(cell, [{ pool: true, min: 2 + st }], "nest", { noChest: true });
        return;
      }
      A.soul(3, "巣の主");
      A.chestHere(cell, { rankUp: 2 }, next);
    },
  },
  {
    id: "c15", name: "鬼火の案内", layer: 0, tier: "uncommon", icon: "wisp",
    intro: () => ["青白い鬼火が、ついて来いとばかりに揺れている。"],
    choices: (A, cell) => [
      { label: "ついていく ― 70%で宝と死体の在処 / 30%で罠", primary: true, fn: () => {
        if (chance(0.7)) {
          const n = A.revealWhere((c) => (c.type === "chest" || c.type === "corpse") && !c.cleared);
          A.sfx("spell"); A.toast(n ? `鬼火が ${n}か所を照らし出した` : "鬼火は何も見つけられず消えた", n ? "good" : "info", "wisp"); A.done(cell);
          return;
        }
        A.alarm("鬼火は罠だった！", ["誘い込まれた先で、魔物が待ち構えていた。"], "wisp",
          () => A.fight(cell, [{ pool: true, min: 2 }], "wisp", { opening: "ambush", noChest: true }));
      } },
    ],
    onWin: (A, cell, f, next) => A.done(cell, next),
  },
  {
    id: "c16", name: "封印の小箱", layer: 0, tier: "uncommon", icon: "chest", minFloor: 2,
    setup: (A, cell) => { cell.evGood = chance(0.5); },
    intro: (A, cell) => {
      const lines = ["幾重にも封蝋が施された小箱。良い品か、禍々しい何かか。"];
      if (cell.evPeek) lines.push(cell.evGood ? "鑑定の眼が見た ― 中には確かな品が眠っている。" : "鑑定の眼が見た ― 中から邪な気配が漏れている。");
      return lines;
    },
    choices: (A, cell) => {
      const ap = A.appraiser();
      return [
        { label: cell.evPeek ? (cell.evGood ? "開ける ― 良い品だ" : "それでも開ける ― 呪いか強敵") : "開ける ― 半々で上等な品 / 呪いか強敵", danger: !(cell.evPeek && cell.evGood), primary: !!(cell.evPeek && cell.evGood), fn: () => {
          if (cell.evGood) { A.item({ rare: true }, "封印の小箱", () => A.done(cell)); return; }
          if (chance(0.5)) {
            A.sfx("trap"); A.flash("#a01030");
            A.hurtAll(0.20); A.ailAll("poison", 0.4);
            A.toast("封印から呪いがふきだした ― 全員が生気を吸われた", "bad", "trap"); A.done(cell);
            return;
          }
          A.alarm("封印されていた魔物が解き放たれた！", ["打ち倒せば、魔物が守っていた品が残る。"], "trap",
            () => A.fight(cell, [{ pool: true, strong: 1.8 }], "box", { noChest: true }));
        } },
        ap && !cell.evPeek && { label: `${ap.name}に鑑定させる ― 中身の善し悪しが分かる`, fn: () => {
          cell.evPeek = true; A.sfx("appraise"); A.reopen(cell);
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.item({ rare: true }, "封じられていた品", () => A.done(cell, next)),
  },
  {
    id: "c17", name: "さまよう行商人", layer: 0, tier: "uncommon", icon: "gold",
    intro: () => ["骨のロバを連れた行商人が、ランタンを掲げた。", "「こんな所で客とはね。値は張るが、品は本物だよ」"],
    choices: (A, cell) => {
      const herb = A.price("herb") * 3, mana = A.price("manaDrop") * 3, box = A.goldCost(3);
      // 薬草・マナの雫に加えて、この深さで出る道具を2品 (値は町の3倍)
      const wares = A.wares(cell, 2).filter((id) => id !== "herb" && id !== "manaDrop");
      return [
        A.canPayGold(herb) && { label: `薬草を買う (💰${herb})`, fn: () => { A.payGold(herb); A.giveItemId("herb", () => A.reopen(cell)); } },
        A.canPayGold(mana) && { label: `マナの雫を買う (💰${mana})`, fn: () => { A.payGold(mana); A.giveItemId("manaDrop", () => A.reopen(cell)); } },
        ...wares.map((id) => { const pr = A.price(id) * 3; return A.canPayGold(pr) && { label: `${A.itemNameOf(id)}を買う (💰${pr})`, fn: () => { A.payGold(pr); A.giveItemId(id, () => A.reopen(cell)); } }; }),
        A.canPayGold(box) && { label: `中身の分からぬ包みを買う (💰${box}) ― 時に掘り出し物`, fn: () => {
          A.payGold(box); A.item({ chestRank: 4 }, "行商人の包み", () => A.done(cell));
        } },
      ];
    },
    leaveLabel: "立ち去る",
  },
  {
    id: "c18", name: "断末魔の騎士", layer: 0, tier: "uncommon", icon: "mon:d02_soldier", minFloor: 2,
    intro: () => ["鎧の割れた騎士が、血の泡を吹きながらうめいている。", "「……楽にしてくれ……でなければ……せめて、手当てを……」"],
    choices: (A, cell) => {
      const healer = A.best("pie");
      return [
        { label: "介錯する ― 騎士の魂 (前衛の職)", fn: () => {
          A.sfx("hit"); A.soulDrop("front", "介錯した騎士の魂だ。", () => A.done(cell));
        } },
        healer && healer.mp >= 1 && { label: `手当てする (${healer.name}のMPを半分使う) ― 礼の品 (R以上)`, primary: true, fn: () => {
          healer.mp = Math.floor(healer.mp / 2); A.refresh(); A.sfx("heal");
          A.log("騎士は息を吹き返し、己の得物を差し出した。", "win");
          A.itemMinRar("r", "騎士の礼", () => A.done(cell));
        } },
      ];
    },
  },
  {
    id: "c19", name: "檻の中の人業", layer: 0, tier: "uncommon", icon: "mon:bs_cagewarden",
    intro: () => ["鉄の檻に、見知らぬ人業が囚われている。器の奥で魂が助けを求めて瞬いている。", "檻の傍らには、鍵束を提げた看守 ― 檻番の獄卒が控えている。この階の魔物より一段手強い。"],
    choices: (A, cell) => [
      { label: "檻を開ける ― 檻番の獄卒 (この階より1ランク上) と戦い、勝てば希少な魂 (レア以上)", danger: true, fn: () => {
        // 専用の看守。強さは「その階の雑魚の最上位ランク + 1」(どの層でも一段上)
        A.fight(cell, [{ key: "bs_cagewarden", ranked: 1 }], "cage", { noChest: true });
      } },
    ],
    leaveLabel: "立ち去る (見捨てる)",
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "檻から解き放った人業に宿っていた魂だ。", () => A.done(cell, next)),
  },
  {
    id: "c20", name: "魂溜まり", layer: 0, tier: "uncommon", icon: "wisp",
    intro: () => ["行き場を失った人魂が渦を巻いて溜まっている。"],
    choices: (A, cell) => {
      const c = A.check("pie");
      return [
        { label: "魂を吸い込む ― ✦Soul (大) / 吸った者はMPが尽きる", danger: true, fn: () => {
          const m = A.randomAlive();
          A.sfx("spell"); A.soul(5, "魂溜まり");
          if (m) { m.mp = 0; A.refresh(); A.toast(`${m.name}は魂に酔い、MPが尽きた`, "bad"); }
          A.done(cell);
        } },
        { label: `鎮める ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 魂の残火`, fn: () => {
          if (c.ok) { A.sfx("heal"); A.ember(1, "鎮めた魂溜まり"); }
          else { A.sfx("ng"); A.toast("人魂は散り散りに逃げてしまった", "info"); }
          A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c21", name: "亡者の宴", layer: 0, tier: "uncommon", icon: "mon:bs_ghoul", minFloor: 2,
    intro: () => ["朽ちた長卓で、亡者たちが宴を開いている。一つだけ空席がある。", "皿の上のものは……たぶん、食べられる。"],
    choices: (A, cell) => [
      { label: "席に着く ― 半々で全快と力 / 全員が毒", fn: () => {
        if (chance(0.5)) {
          A.healAll(1, 1, true); A.floorEv().mods.push({ src: "c21", name: "亡者の宴", desc: "与えるダメージ +10% (この階)", dmgMul: 1.10 });
          A.sfx("heal"); A.toast("不思議と力が湧いた ― 全快し、この階の間 与ダメ+10%", "good");
        } else {
          A.ailAll("poison", 1); A.sfx("trap"); A.toast("料理は腐っていた ― 全員が毒に侵された", "bad", "poison");
        }
        A.done(cell);
      } },
      { label: "宴を荒らす ― 群れと戦い、金貨を多く", danger: true, fn: () => {
        A.fight(cell, [{ undead: true, min: 4 }], "feast", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => { A.gold(5, "宴の卓"); A.done(cell, next); },
  },
  {
    id: "c22", name: "宝の地図の切れ端", layer: 0, tier: "uncommon", icon: "chest", maxSkip: 1,
    intro: () => ["床に落ちた羊皮紙の切れ端。この下の階の見取り図らしい。×印が一つ。"],
    choices: (A, cell) => [
      { label: "拾う ― 次の階に印の付いた上等な宝箱", primary: true, fn: () => {
        A.runEv().mapChest = (A.runEv().mapChest || 0) + 1;
        A.sfx("itemget"); A.toast("地図を拾った ― 次の階の×印に宝箱が眠る", "good", "chest"); A.done(cell);
      } },
    ],
    leaveLabel: "捨てる",
  },
  {
    id: "c23", name: "誓いの石碑", layer: 0, tier: "uncommon", icon: "event", minFloor: 2,
    cond: (A) => A.countCells((c) => c.type === "monster" && !c.cleared) >= 2,
    intro: () => ["「この地の魔を払う者に、祝福を」と刻まれた石碑。", "誓えば、この階の魔物をすべて討つまで祝福は降りない。破れば報いがある。"],
    choices: (A, cell) => [
      { label: "誓う ― 達成で上等な宝箱と ✦Soul / 未達で降りると次の階が手強い", danger: true, fn: () => {
        A.floorEv().oath = { cell: true };
        cell.evOath = true;
        A.sfx("spell"); A.toast("誓いを立てた ― この階の魔物をすべて討て", "gold"); A.back();
      } },
    ],
    // 誓いの最中に石碑を踏んだ時
    pending: (A, cell) => cell.evOath ? `誓いの最中だ ― 残る魔物 ${A.countCells((c) => c.type === "monster" && !c.cleared)}体` : null,
  },
  {
    id: "c24", name: "血の契約碑", layer: 0, tier: "uncommon", icon: "trap", deep: true,
    intro: () => ["赤黒く濡れた碑。「血を捧げよ。さすれば刃に力を」"],
    choices: (A, cell) => [
      { label: "血を捧げる (全員が今のHPの3割を失う) ― この階の間 与ダメ+25%", danger: true, fn: () => {
        A.hurtAllCur(0.30);
        A.floorEv().mods.push({ src: "c24", name: "血の契約", desc: "与えるダメージ +25% (この階)", dmgMul: 1.25 });
        A.sfx("trap"); A.flash("#a01030"); A.toast("血の契約 ― この階の間、与ダメ+25%", "gold", "trap"); A.done(cell);
      } },
    ],
  },
  {
    id: "c25", name: "鏡の間", layer: 0, tier: "rare", icon: "event", deep: true,
    intro: () => ["四方を鏡に囲まれた部屋。鏡の中の自分たちが、こちらを見てあざ笑った。", "鏡の影は、自分たちの七割の力を持つ。"],
    choices: (A, cell) => [
      { label: "鏡に挑む ― 自分たちの影と戦い、✦Soul (大) と上等な品", danger: true, fn: () => {
        A.fight(cell, [{ shadows: 0.7 }], "mirror", { noChest: true });
      } },
      { label: "鏡を割る ― 鏡の欠片 (収集品) / 全員に小さな傷", fn: () => {
        A.sfx("hit"); A.hurtAll(0.08);
        A.collectible("鏡の欠片", () => A.done(cell));
      } },
    ],
    onWin: (A, cell, f, next) => { A.soul(8, "鏡の影"); A.item({ rare: true }, "鏡の奥", () => A.done(cell, next)); },
  },
  {
    id: "c26", name: "時の止まった部屋", layer: 0, tier: "rare", icon: "event", deep: true,
    intro: (A) => ["ほこりが宙に止まったままの部屋。中央に巨大な砂時計。", `この階で倒した魔物 ${A.countCells((c) => c.type === "monster" && c.cleared && !c.elite)}体 が、時を戻せば蘇る。`],
    choices: (A, cell) => {
      const dead = A.countCells((c) => c.type === "monster" && c.cleared && !c.elite);
      return [
        dead > 0 && { label: `砂時計を返す ― 倒した魔物 ${dead}体 が蘇る (もう一度稼げる)`, danger: true, fn: () => {
          const n = A.reviveMonsters();
          A.sfx("spell"); A.flash("#7fb0ff"); A.toast(`時が巻き戻った ― ${n}体の魔物が蘇った`, "gold"); A.done(cell);
        } },
        needsCare(A) && { label: "砂をすくって飲む ― 全員が全快し、状態異常も消える", primary: true, fn: () => {
          A.healAll(1, 1, true); A.sfx("heal"); A.toast("時の砂が傷を無かったことにした ― 全快", "good"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "c27", name: "呪われた金貨の山", layer: 0, tier: "rare", icon: "gold", deep: true,
    intro: () => ["金貨が山と積まれている。手に取った者を呪うという古い警告文が、山の麓に刺さっている。"],
    choices: (A, cell) => [
      { label: "全部持ち出す ― 金貨 (特大) / この潜入の間 敵の力1.2倍", danger: true, fn: () => {
        A.gold(12, "呪われた金貨");
        A.runEv().mods.push({ src: "c27", name: "金貨の呪い", desc: "敵の力 1.2倍 (この潜入)", enemyMul: 1.2 });
        A.flash("#a08020"); A.toast("呪いがまとわりついた ― この潜入の間、敵の力1.2倍", "bad"); A.done(cell);
      } },
      { label: "一掴みだけ ― 金貨", fn: () => { A.gold(2, "金貨の山"); A.done(cell); } },
    ],
  },
  {
    id: "c28", name: "奈落の縦穴", layer: 0, tier: "rare", icon: "stairs", deep: true, maxSkip: 2,
    intro: () => ["底の見えない縦穴。風が下から吹き上げてくる。", "飛び降りれば2階下へ。だが着地は手荒く、降りた先は強敵の巣だ。"],
    choices: (A, cell) => [
      { label: "飛び降りる ― 2階下へ (最大HPの2割を失う) / 強敵階・宝箱が上等", danger: true, fn: () => {
        A.hurtAll(0.20);
        A.runEv().forceElite = true;
        A.runEv().nextFloorMods = [...(A.runEv().nextFloorMods || []), { src: "c28", name: "縦穴の底", desc: "宝箱が1ランク上等 (この階)", chestRankUp: 1 }];
        cell.cleared = true;
        A.sfx("stairs"); A.skipFloors(1);
      } },
      { label: "石を落として去る", cancel: true, fn: () => { A.toast("……石の落ちる音は、いつまでも聞こえなかった", "info"); A.done(cell); } },
    ],
    noLeave: true,
  },
  {
    id: "c29", name: "封じられた古強者", layer: 0, tier: "rare", icon: "event", deep: true,
    intro: (A) => [`鎖と呪符で封じられた古強者「${A.monName(A.eliteKeyHere())}」。`, "封印を解けば、層を一つ越えた強さで襲ってくるだろう。"],
    choices: (A, cell) => [
      { label: "封印を解く ― 強敵戦 / 勝てば強敵の宝と希少な魂", danger: true, fn: () => {
        A.fight(cell, [{ elite: true, strong: 1.15 }], "ancient", { noChest: false });
      } },
      { label: "封印を強める ― ✦Soul", fn: () => { A.sfx("spell"); A.soul(2, "封印の祈り"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "古強者に囚われていた魂だ。", () => A.done(cell, next)),
  },
  {
    id: "c30", name: "操霊師の遺書", layer: 0, tier: "mythic", icon: "event", once: true,
    boon: EV_BOONS.will.text,
    intro: () => ["朽ちた机に、革表紙の手記。先代の操霊師が遺したものだ。", "頁をめくると、紙に染みた魂が指先から流れ込んできた。"],
    gift: (A) => {
      const L = A.layer;
      A.flags().lore = { ...(A.flags().lore || {}), [L]: true };
      A.flags().will = true;
      A.sfx("spell");
      return [...(LORE_PAGES[L] || LORE_PAGES[0]), `✺ ${EV_BOONS.will.text} (以後ずっと)`];
    },
  },
  // ---- 蘇生の出来事 (倒れた仲間を起こす) ----
  {
    id: "c31", name: "生命の雫", layer: 0, tier: "common", icon: "fountain",
    cond: (A) => A.deadList().length > 0,
    intro: () => ["天井から垂れ下がった石の先から、淡く光る雫が一滴ずつ落ちている。", "一滴だけ受け止められそうだ。倒れた者の口に含ませれば、魂が器へ戻るという。"],
    choices: (A, cell) => A.deadList().map((m) => ({
      label: `${m.name}に雫を含ませる ― HP1で蘇る`, primary: true, fn: () => {
        A.revive(m, false);
        A.sfx("heal"); A.toast(`${m.name}が息を吹き返した (HP1)`, "good", "fountain"); A.done(cell);
      },
    })),
  },
  {
    id: "c32", name: "闇医者", layer: 0, tier: "uncommon", icon: "event",
    cond: (A) => A.deadList().length > 0 || needsCare(A),
    intro: () => ["血の染みた前掛けの男が、灯りの下で器具を研いでいる。", "「迷宮の中じゃ、街の三倍だ。砕けた器でも繋いでやるよ」"],
    choices: (A, cell) => {
      const heal = A.innCost() * 3;
      return [
        needsCare(A) && A.canPayGold(heal) && { label: `手当てを受ける (💰${heal}) ― 生きている者のHP・MP全快と状態異常の回復`, fn: () => {
          A.payGold(heal); A.healAll(1, 1, true);
          A.sfx("heal"); A.toast("荒っぽいが、腕は確かだった ― 全快", "good"); A.reopen(cell);
        } },
        ...A.deadList().map((m) => {
          const cost = A.repairCost(m) * 3;
          return A.canPayGold(cost) && { label: `${m.name}を蘇らせる (💰${cost}) ― HP・MPが満ちて蘇る`, primary: true, fn: () => {
            A.payGold(cost); A.revive(m, true);
            A.sfx("heal"); A.toast(`${m.name}が立ち上がった (💰${cost})`, "good"); A.reopen(cell);
          } };
        }),
      ];
    },
  },
  {
    id: "c33", name: "神聖なる泉", layer: 0, tier: "rare", icon: "fountain", deep: true,
    intro: (A) => ["白く輝く泉が、闇の底で静かに湧いている。水面に触れた苔が花を咲かせた。", "この水は、倒れた者の魂さえ呼び戻すという。",
      ...(A.aliveList && A.deadList().length === 0 && !needsCare(A) ? ["いまは癒すべき傷がない。泉は変わらず湧いている。"] : [])],
    choices: (A, cell) => [
      (A.deadList().length > 0 || needsCare(A)) && { label: "泉に身を浸す ― 倒れた者も蘇り、全員のHP・MPが満ちる", primary: true, fn: () => {
        const dead = A.deadList();
        for (const m of dead) A.revive(m, true);
        A.healAll(1, 1, true);
        A.sfx("heal"); A.flash("#fff3c0");
        A.toast(dead.length ? `泉が魂を呼び戻した ― ${dead.map((m) => m.name).join("・")}が蘇り、全員が全快` : "泉が傷を洗い流した ― 全員が全快", "good", "fountain");
        A.done(cell);
      } },
    ],
  },

  // ================= 第1層「墓地」 (10) =================
  {
    id: "l1_01", name: "掘り返された墓", layer: 1, tier: "common", icon: "corpse",
    intro: () => ["土が掘り返されたばかりの墓。誰かが途中で逃げ出したらしい。"],
    choices: (A, cell) => [
      { label: "掘る ― 副葬品 / 25%で屍が起き上がる", danger: true, fn: () => {
        if (chance(0.25)) {
          A.alarm("墓の主が起き上がった！", ["眠りを妨げた報いだ。"], "corpse", () => A.fight(cell, [{ undead: true }], "grave", { noChest: true }));
          return;
        }
        if (chance(0.5)) A.item({}, "副葬品", () => A.done(cell)); else { A.gold(2, "副葬品"); A.done(cell); }
      } },
      { label: "埋め戻す ― ✦Soul を少し", fn: () => { A.sfx("heal"); A.soul(1, "弔い"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "墓の副葬品"); A.done(cell, next); },
  },
  {
    id: "l1_02", name: "墓守の亡霊", layer: 1, tier: "common", icon: "mon:bs_gravecaller",
    intro: () => ["ランタンを提げた墓守の亡霊。「油が切れてね……灯りさえあれば、この階の墓所はみな見渡せるんだが」"],
    choices: (A, cell) => {
      const cost = A.goldCost(0.5);
      return [
        A.canPayGold(cost) && { label: `灯油を分ける (💰${cost}) ― この階をすべて見通す`, primary: true, fn: () => {
          A.payGold(cost); A.revealWhere(() => true); A.sfx("spell"); A.toast("墓守の灯が階を照らした ― すべてのカードが見える", "good"); A.done(cell);
        } },
        { label: "墓の場所を尋ねる ― 近くの死体に魂が宿る", fn: () => {
          const ok = A.warmCorpse();
          A.sfx("spell"); A.toast(ok ? "「あそこの骸は、まだ温かいよ」― あたたかい死体が見つかった" : "墓守は首を振った", ok ? "good" : "info", "corpseWarm"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "l1_03", name: "開かれた棺", layer: 1, tier: "common", icon: "corpse",
    intro: () => ["蓋のずれた石棺。隙間から、金糸で織った死に装束が覗いている。"],
    choices: (A, cell) => [
      { label: "中を覗く ― 半々で副葬品 / 棺の主が目覚める", danger: true, fn: () => {
        if (chance(0.5)) { A.item({}, "棺の副葬品", () => A.done(cell)); return; }
        A.alarm("棺の主が目覚めた！", ["打ち倒せば、棺の中身は手に入る。"], "corpse", () => A.fight(cell, [{ undead: true, strong: 1.4 }], "coffin", { noChest: true }));
      } },
    ],
    onWin: (A, cell, f, next) => A.chestHere(cell, { rankUp: 0 }, next),
  },
  {
    id: "l1_04", name: "納骨堂の香炉", layer: 1, tier: "common", icon: "fountain",
    intro: () => ["納骨堂の香炉に、乳香の欠片が残っている。死者を鎮める香だという。"],
    choices: (A, cell) => [
      { label: "香を焚く ― この階の間、不死の魔物への与ダメ+30%", primary: true, fn: () => {
        A.floorEv().mods.push({ src: "l1_04", name: "鎮魂の香", desc: "不死・霊の魔物への与ダメージ +30% (この階)", prey: { races: ["undead", "specter"], mul: 1.3 } });
        A.sfx("spell"); A.toast("香煙が満ちた ― 不死の魔物への与ダメ+30%", "good"); A.done(cell);
      } },
      anyAiling(A) && { label: "灰を撒く ― 全員の状態異常を払う", fn: () => {
        A.cureAll(); A.sfx("heal"); A.toast("清めの灰が穢れを払った", "good"); A.done(cell);
      } },
    ],
  },
  {
    id: "l1_05", name: "名を刻まれぬ墓碑", layer: 1, tier: "uncommon", icon: "event",
    intro: () => ["名の刻まれていない真新しい墓碑。のみが添えてある。", "生者の名を刻めば、その者は一度だけ死を拒めるという。代わりに、血を少し差し出すことになる。"],
    choices: (A, cell) => A.aliveList().filter((m) => !A.runEv().saves || !A.runEv().saves[m.uid]).slice(0, 4).map((m) => ({
      label: `${m.name}の名を刻む ― 一度だけ死を免れる (HPを3割失う)`, fn: () => {
        A.hurtOne(m, 0.30);
        A.runEv().saves = { ...(A.runEv().saves || {}), [m.uid]: true };
        A.sfx("spell"); A.toast(`${m.name}の名を刻んだ ― この潜入で一度だけ死を免れる`, "gold"); A.done(cell);
      },
    })),
  },
  {
    id: "l1_06", name: "死者の葬列", layer: 1, tier: "uncommon", icon: "mon:bs_mournshade", minFloor: 2,
    intro: () => ["蝋燭を掲げた亡者の列が、音もなく通り過ぎていく。行き先は、この階の階段のようだ。"],
    choices: (A, cell) => [
      { label: "列に紛れる ― 戦わずに階段の傍まで運ばれる", primary: true, fn: () => {
        cell.cleared = true; A.sfx("step"); A.toast("葬列に紛れて進んだ ― 階段の傍に着いた", "good", "stairs"); A.warpToStairs();
      } },
      { label: "列を襲う ― 3連戦 / ✦Soul (大)", danger: true, fn: () => {
        cell.evStage = 1;
        A.fight(cell, [{ undead: true, min: 3 }], "procession", { noChest: true });
      } },
    ],
    leaveLabel: "やり過ごす",
    onWin: (A, cell, f, next) => {
      const st = cell.evStage || 1;
      if (st < 3) { cell.evStage = st + 1; A.toast(`葬列は止まらない (${st + 1}/3)`, "bad"); A.fight(cell, [{ undead: true, min: 3 }], "procession", { noChest: true }); return; }
      A.soul(6, "葬列"); A.done(cell, next);
    },
  },
  {
    id: "l1_07", name: "喪服の女", layer: 1, tier: "uncommon", icon: "mon:bs_mournshade", minFloor: 2,
    intro: () => ["黒い喪服の女が、墓の前で泣いている。顔はヴェールに隠れて見えない。"],
    choices: (A, cell) => {
      const c = A.check("pie");
      return [
        { label: `慰める ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 次の3戦、開戦時にHP回復`, primary: true, fn: () => {
          if (c.ok) { A.runEv().startHeal = (A.runEv().startHeal || 0) + 3; A.sfx("heal"); A.toast("女は微笑んで消えた ― 次の3戦、開戦時にHP10%回復", "good"); }
          else { A.mpAll(0.2); A.sfx("trap"); A.toast("女は金切り声を上げた ― 全員のMPが削られた", "bad"); }
          A.done(cell);
        } },
        { label: "正体を暴く ― 嘆きの霊と戦い、勝てば希少な魂 (レア以上)", danger: true, fn: () => {
          A.fight(cell, [{ key: "bs_mournshade", strong: 1.8, name: "喪服の女" }], "widow", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "喪服の女に囚われていた魂だ。", () => A.done(cell, next)),
  },
  {
    id: "l1_08", name: "鳴らずの鐘", layer: 1, tier: "uncommon", icon: "event", deep: true,
    intro: (A) => ["錆びた弔鐘。鳴らせば、この階の死者がすべて呼び集められるという。", `いま、この階には魔物が ${A.countCells((c) => c.type === "monster" && !c.cleared && !c.elite)}体 残っている。`],
    choices: (A, cell) => [
      { label: "鐘を鳴らす ― 残る魔物が一斉に襲う大群戦 / 勝てば一掃と宝箱", danger: true, fn: () => {
        const keys = A.monsterKeysLeft();
        if (!keys.length) { A.sfx("ng"); A.toast("鐘の音が虚しく響いた ― もう誰も来ない", "info"); A.soul(1, "鐘の余韻"); A.done(cell); return; }
        A.fight(cell, keys.slice(0, 6).map((k) => ({ key: k, single: true })), "bell", { noChest: true });
      } },
      { label: "鐘舌を外す ― 収集品", fn: () => A.collectible("弔鐘の鐘舌", () => A.done(cell)) },
    ],
    onWin: (A, cell, f, next) => {
      const n = A.clearMonsters();
      A.toast(`鐘に呼ばれた魔物を一掃した (${n}枚)`, "good");
      A.chestHere(cell, { rankUp: 1 }, next);
    },
  },
  {
    id: "l1_09", name: "修道院の告解室", layer: 1, tier: "rare", icon: "event", minLv: 11, deep: true,
    intro: () => ["朽ちた修道院の告解室。格子の向こうに、誰かの気配がある。", "「罪を告げよ。あるいは……院長の秘密を聞くか」"],
    choices: (A, cell) => {
      const cost = A.soulCost(3);
      return [
        A.canPaySoul(cost) && { label: `告解する (✦${cost}を捧げる) ― 魂の残火`, fn: () => {
          A.paySoul(cost); A.sfx("heal"); A.ember(1, "告解"); A.done(cell);
        } },
        { label: "格子の向こうの声を聞く ― 第1層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
          A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 1: true };
          A.sfx("spell");
          A.story("格子の向こうの声", ["「院長は、己の骸を祭壇の下に隠している。", "「その継ぎ目を知る者の刃は、深く入るだろう……」", "第1層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
        } },
      ];
    },
  },
  {
    id: "l1_10", name: "墓地の黒猫", layer: 1, tier: "mythic", icon: "event", once: true,
    boon: EV_BOONS.blackCat.text,
    intro: () => ["金色の目をした黒猫が、墓石の上からこちらを見ている。", "猫は音もなく降りてくると、一人ひとりの足元に身をすり寄せ、喉を鳴らした。"],
    gift: (A) => {
      A.flags().blackCat = true;
      A.sfx("heal");
      return ["顔を上げた時には、もう猫の姿はなかった。", `✺ ${EV_BOONS.blackCat.text} (以後ずっと)`];
    },
  },

  // ================= 第2層「地下水路」 (10) =================
  {
    id: "l2_01", name: "漂着物の山", layer: 2, tier: "common", icon: "chest",
    intro: () => ["流れに運ばれてきた漂着物が、せきに引っかかって山になっている。何かが中でうごめいた。"],
    choices: (A, cell) => [
      { label: "漁る ― 金貨と時に収集品 / 30%で群れに襲われる", danger: true, fn: () => {
        if (chance(0.3)) { A.alarm("群れが飛び出してきた！", ["漂着物の山は巣だった。"], "trap", () => A.fight(cell, [{ pool: true, min: 3 }], "drift", { noChest: true })); return; }
        A.gold(2, "漂着物");
        if (chance(0.3)) A.collectible("漂着物", () => A.done(cell)); else A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "漂着物"); A.done(cell, next); },
  },
  {
    id: "l2_02", name: "渦巻く排水口", layer: 2, tier: "common", icon: "fountain",
    intro: () => ["黒い水が渦を巻いて吸い込まれていく排水口。縁に、何かが引っかかって光っている。"],
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: `手を入れる ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) / 失敗で毒と傷`, primary: true, fn: () => {
          if (c.ok) { A.item({}, "排水口", () => A.done(cell)); return; }
          if (c.who) { A.hurtOne(c.who, 0.15); A.ail(c.who, "poison"); A.toast(`${c.who.name}は渦に腕を取られた ― 傷と毒`, "bad", "poison"); }
          A.done(cell);
        } },
      ];
    },
  },
  {
    id: "l2_03", name: "汚水の浴場", layer: 2, tier: "common", icon: "fountain",
    intro: () => ["古い公衆浴場の跡。湯気の立つ水は、濁っているが温かい。"],
    choices: (A, cell) => [
      { label: "浸かる ― 半々で全快 / 全員が毒", fn: () => {
        if (chance(0.5)) { A.healAll(1, 1, false); A.sfx("heal"); A.toast("湯が骨身に染みた ― 全快", "good", "fountain"); }
        else { A.ailAll("poison", 1); A.sfx("trap"); A.toast("湯は汚れていた ― 全員が毒に侵された", "bad", "poison"); }
        A.done(cell);
      } },
      anyDrained(A) && { label: "こして飲む ― 全員のMPが3割回復", primary: true, fn: () => {
        A.healAll(0, 0.3, false); A.sfx("heal"); A.toast("澄んだ水が魔力を満たした", "good", "fountain"); A.done(cell);
      } },
    ],
  },
  {
    id: "l2_04", name: "密輸人の隠し荷", layer: 2, tier: "common", icon: "chest", minFloor: 2,
    intro: () => ["防水布に包まれた荷が、梁の上に隠されている。密輸人の印がある。"],
    choices: (A, cell) => [
      { label: "盗む ― 上物の品 / 次の戦闘で密輸人の待ち伏せ", danger: true, fn: () => {
        A.runEv().ambushNext = 1;
        A.itemMinRar("uc", "密輸人の荷", () => A.done(cell));
      } },
      { label: "王に告げる ― 帰還したとき報奨金", primary: true, fn: () => {
        A.runEv().bounty = (A.runEv().bounty || 0) + A.goldCost(4);
        A.sfx("select"); A.toast(`密輸の証拠を控えた ― 生きて帰れば報奨金 💰${A.goldCost(4)}`, "gold"); A.done(cell);
      } },
    ],
    leaveLabel: "見逃す",
  },
  {
    id: "l2_05", name: "水門のレバー", layer: 2, tier: "uncommon", icon: "event",
    intro: () => ["錆びた水門のレバー。上げれば水が引き、下げれば階の半分が沈む。"],
    choices: (A, cell) => [
      { label: "上げる ― 毒の床が消え、隠し宝箱が現れる / 30%で鉄砲水", primary: true, fn: () => {
        if (chance(0.3)) { A.sfx("trap"); A.flash("#3a6a9a"); A.hurtAll(0.20); A.toast("鉄砲水だ！ ― 全員が流されかけた", "bad", "fountain"); }
        const n = A.clearPoison();
        A.placeChest({ rankUp: 1, reveal: true });
        A.toast(`水が引いた ― 毒の床 ${n}か所が消え、隠し宝箱が現れた`, "good", "chest"); A.done(cell);
      } },
      { label: "下げる ― 遠い半分が水没し、魔物も宝も消える", fn: () => {
        const n = A.floodHalf();
        A.sfx("trap"); A.toast(`階の半分が沈んだ (${n}か所が水に消えた)`, "info", "fountain"); A.done(cell);
      } },
    ],
    leaveLabel: "触らない",
  },
  {
    id: "l2_06", name: "溺れかけた人業", layer: 2, tier: "uncommon", icon: "event",
    intro: () => ["流れの中で、見知らぬ人業がもがいている。魂の灯がまだ消えていない。"],
    choices: (A, cell) => {
      const c = A.check("agi"), front = A.aliveList()[0];
      return [
        front && { label: `飛び込んで引き上げる (${front.name}が最大HPの25%を失う) ― 希少な魂 (レア以上)`, primary: true, fn: () => {
          A.hurtOne(front, 0.25, true);
          A.soulDrop("rarePlus", "引き上げた人業に宿っていた魂だ。", () => A.done(cell));
        } },
        { label: `縄を投げる ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) / 失敗で沈む`, fn: () => {
          if (c.ok) { A.soulDrop("rarePlus", "縄で引き上げた人業に宿っていた魂だ。", () => A.done(cell)); return; }
          A.sfx("ng"); A.toast("縄は届かなかった ― 人業は黒い水に沈んだ", "bad"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "l2_07", name: "大ワニの骸", layer: 2, tier: "uncommon", icon: "event", deep: true,
    intro: () => ["水路を塞ぐほどの大ワニの骸。膨れた腹の中に、呑まれた冒険者の装備が透けて見える。"],
    choices: (A, cell) => [
      { label: "腹を裂く ― 上等な品 / 25%で中の魔物が飛び出す", danger: true, fn: () => {
        if (chance(0.25)) {
          A.alarm("腹の中から魔物が飛び出した！", ["呑まれてなお生きていた。打ち倒せば品は残る。"], "trap",
            () => A.fight(cell, [{ pool: true, strong: 2.0 }], "gator", { noChest: true }));
          return;
        }
        A.item({ rare: true }, "大ワニの腹", () => A.done(cell));
      } },
      { label: "牙を抜く ― 収集品", fn: () => A.collectible("大ワニの牙", () => A.done(cell)) },
    ],
    onWin: (A, cell, f, next) => A.item({ rare: true }, "大ワニの腹", () => A.done(cell, next)),
  },
  {
    id: "l2_08", name: "鼠の王", layer: 2, tier: "uncommon", icon: "mon:bs_ratking", minFloor: 3,
    intro: () => ["尾の絡み合った鼠の塊が、王のように玉座の残骸に収まっている。", "「チ……チチ……食い物か、戦か」"],
    choices: (A, cell) => {
      const cost = A.goldCost(2);
      return [
        A.canPayGold(cost) && { label: `餌を与える (💰${cost}) ― この潜入の間 獣が現れず、宝箱の在処を1つ`, primary: true, fn: () => {
          A.payGold(cost);
          A.runEv().noBeast = true;
          const n = A.purgeBeasts();
          const shown = A.revealWhere((c) => c.type === "chest" && !c.cleared, 1);
          if (!shown) A.placeChest({ rankUp: 0, reveal: true });
          A.sfx("itemget"); A.toast(`鼠の王は満足した ― 獣は寄りつかず${n ? ` (${n}体が退いた)` : ""}、宝の在処を教えた`, "good", "chest"); A.done(cell);
        } },
        { label: "討つ ― 群れを呼ぶ王と戦い、✦Soul (大)", danger: true, fn: () => {
          A.fight(cell, [{ key: "bs_ratking", strong: 2.0, name: "鼠の王" }], "ratking", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => { A.soul(8, "鼠の王"); A.done(cell, next); },
  },
  {
    id: "l2_09", name: "沈んだ礼拝堂", layer: 2, tier: "rare", icon: "fountain", deep: true,
    intro: () => ["水没した礼拝堂。水底の祭壇に、土の色をした聖印が沈んでいる。", "潜って取れば、水の魔物に抗う土の護りが宿る。息が続かぬ者は溺れるだろう。"],
    choices: (A, cell) => [
      { label: "潜る (各自VIT判定・失敗で最大HPの3割) ― この潜入の間 全員に土の護り", danger: true, fn: () => {
        const hurt = [];
        for (const m of A.aliveList()) if (!A.check("vit", m).ok) { A.hurtOne(m, 0.30, true); hurt.push(m.name); }
        A.runEv().edef = { el: "earth", lv: 1 };
        A.sfx("spell"); A.toast(`土の護りを得た (この潜入)${hurt.length ? ` ― 溺れかけた: ${hurt.join("・")}` : ""}`, "gold"); A.done(cell);
      } },
      needsCare(A) && { label: "水面で祈る ― 全員が全快", primary: true, fn: () => { A.healAll(1, 1, true); A.sfx("heal"); A.toast("水面の祈りが届いた ― 全快", "good", "fountain"); A.done(cell); } },
    ],
  },
  {
    id: "l2_10", name: "王都の下水図", layer: 2, tier: "mythic", icon: "event", once: true,
    boon: EV_BOONS.sewerMap.text,
    intro: () => ["防水筒に収められた古い設計図。王都の下水路の全図だ。", "隅々まで目を通すうち、入り組んだ水路の形がすっかり頭に入った。"],
    gift: (A) => {
      A.flags().sewerMap = true; A.revealStairs();
      A.sfx("victory");
      return [`✺ ${EV_BOONS.sewerMap.text} (以後ずっと)`];
    },
  },

  // ================= 第3層「廃坑」 (10) =================
  {
    id: "l3_01", name: "鉱脈の輝き", layer: 3, tier: "common", icon: "gold",
    intro: () => ["岩肌に銀色の鉱脈が走っている。掘り出せば、それなりの値になりそうだ。"],
    choices: (A, cell) => {
      const c = A.check("atk");
      return [
        { label: `掘る ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 金貨 / 失敗で落盤`, primary: true, fn: () => {
          if (c.ok) { A.sfx("hit"); A.gold(2, "鉱脈"); A.done(cell); return; } // 通常戦闘の約2倍の金貨
          A.sfx("trap"); A.hurtAll(0.10); A.toast("岩が崩れた ― 全員に小さな傷", "bad", "trap"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "l3_02", name: "カナリアの籠", layer: 3, tier: "common", icon: "event",
    setup: (A, cell) => { cell.evAlive = chance(0.55); },
    intro: (A, cell) => ["坑道の分かれ目に、カナリアの籠が吊るされている。", cell.evAlive ? "小鳥は元気にさえずっている。奥の空気は澄んでいるようだ。" : "小鳥は籠の底で動かない……奥には毒の瘴気が溜まっている。", "奥には、置き去りの荷が見える。"],
    choices: (A, cell) => [
      { label: cell.evAlive ? "奥へ進む ― 荷を回収する" : "息を止めて奥へ ― 荷を回収 / 全員が毒", primary: !!cell.evAlive, danger: !cell.evAlive, fn: () => {
        if (!cell.evAlive) { A.ailAll("poison", 1); A.toast("瘴気を吸った ― 全員が毒に侵された", "bad", "poison"); }
        A.chestHere(cell, { rankUp: 0 });
      } },
    ],
    leaveLabel: "引き返す",
  },
  {
    id: "l3_03", name: "坑夫の亡霊", layer: 3, tier: "common", icon: "mon:bs_dustwraith",
    cond: (A) => A.countCells((c) => c.type === "corpse" && !c.cleared) >= 1,
    intro: (A) => ["煤けた坑夫の亡霊が、つるはしにすがって立っている。", `「仲間の亡骸を……この階の亡骸を、すべて弔ってくれ」 (残り ${A.countCells((c) => c.type === "corpse" && !c.cleared)}体)`],
    choices: (A, cell) => [
      { label: "引き受ける ― この階の死体をすべて調べると ✦Soul と魂の残火", primary: true, fn: () => {
        A.floorEv().miner = true; cell.evQuest = true;
        A.sfx("select"); A.toast("坑夫の頼みを引き受けた ― この階の亡骸をすべて調べよ", "gold", "corpse"); A.back();
      } },
    ],
    leaveLabel: "断る",
    pending: (A, cell) => cell.evQuest ? `坑夫の頼みの最中だ ― 残る亡骸 ${A.countCells((c) => c.type === "corpse" && !c.cleared)}体` : null,
  },
  {
    id: "l3_04", name: "置き忘れの爆薬", layer: 3, tier: "uncommon", icon: "trap",
    intro: () => ["坑夫が置き忘れた発破の束。導火線はまだ乾いている。", "薄い岩壁の向こうに、空洞があるようだ。"],
    choices: (A, cell) => [
      { label: "壁を爆破する ― 隠し通路の上等な宝箱 / 20%で誘爆", danger: true, fn: () => {
        A.sfx("fire"); A.flash("#ff9a4a");
        if (chance(0.2)) { A.hurtAll(0.30); A.toast("誘爆した！ ― 全員が爆風を浴びた", "bad", "trap"); }
        A.chestHere(cell, { rankUp: 2 });
      } },
      { label: "持っていく ― 次の戦闘の開幕に敵全体を爆破", primary: true, fn: () => {
        A.runEv().bomb = (A.runEv().bomb || 0) + 1;
        A.sfx("itemget"); A.toast("発破を携えた ― 次の戦闘の開幕に敵全体へ痛打", "good"); A.done(cell);
      } },
    ],
  },
  {
    id: "l3_05", name: "暴走トロッコ", layer: 3, tier: "uncommon", icon: "event", minFloor: 2, maxSkip: 2,
    intro: () => ["線路の上に、鉱石を積んだトロッコ。下り坂の先は、次の階へ続いている。"],
    choices: (A, cell) => [
      { label: "飛び乗る ― この階を捨てて次の階へ直行 / 25%で転覆", danger: true, fn: () => {
        if (chance(0.25)) { A.hurtAll(0.20); A.toast("トロッコが転覆した ― 全員が投げ出された", "bad", "trap"); }
        cell.cleared = true; A.sfx("stairs"); A.skipFloors(0);
      } },
      { label: "荷台を漁る ― 鉱石 (金貨)", primary: true, fn: () => { A.gold(3, "トロッコの鉱石"); A.done(cell); } },
    ],
  },
  {
    id: "l3_06", name: "呪われた紅玉", layer: 3, tier: "uncommon", icon: "event",
    intro: () => ["岩に埋まった、脈打つように赤く光る宝石。触れた者の血を欲しがるという。"],
    choices: (A, cell) => {
      const holder = A.best("atk");
      return [
        holder && !A.runEv().ruby && { label: `${holder.name}が持ち歩く ― 与ダメ+15% / 戦闘のたび最大HPの5%を失う / 持ち帰れば高値`, danger: true, fn: () => {
          A.runEv().ruby = holder.uid;
          A.runEv().rubyGold = A.goldCost(6);
          A.flash("#d01030"); A.toast(`${holder.name}が紅玉を手にした ― 与ダメ+15% (血を吸われ続ける)`, "gold"); A.done(cell);
        } },
        { label: "砕く ― ✦Soul", fn: () => { A.sfx("hit"); A.soul(3, "砕けた紅玉"); A.done(cell); } },
      ];
    },
  },
  {
    id: "l3_07", name: "崩落坑の生存者", layer: 3, tier: "uncommon", icon: "event", deep: true,
    intro: () => ["崩れた坑道の奥から、助けを呼ぶ声がする。瓦礫をどけるには時間がかかりそうだ。", "物音に、魔物が寄ってくるだろう。"],
    choices: (A, cell) => [
      { label: "瓦礫をどける ― 寄ってくる魔物と戦い、生存者の礼 (品か魂)", primary: true, fn: () => {
        A.fight(cell, [{ pool: true }], "survivor", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => {
      if (chance(0.5)) { A.log("生存者は礼に、守り抜いた得物を差し出した。", "win"); A.itemMinRar("r", "生存者の礼", () => A.done(cell, next)); return; }
      A.log("瓦礫の下にいたのは、生者ではなかった……だが魂は残っていた。", "sys");
      A.soulDrop("common", "瓦礫の下の亡霊に宿っていた魂だ。", () => A.done(cell, next));
    },
  },
  {
    id: "l3_08", name: "地底湖の渡し守", layer: 3, tier: "rare", icon: "mon:bs_dustwraith", deep: true,
    intro: () => ["黒い地底湖に、骸の渡し守が小舟を浮かべている。", "「渡し賃を。金なら出口の岸へ、魂なら……秘宝の眠る岸へ」"],
    choices: (A, cell) => {
      const g = A.goldCost(4), s = A.soulCost(4);
      return [
        A.canPayGold(g) && { label: `金貨で渡る (💰${g}) ― 階段の手前の岸へ`, fn: () => {
          A.payGold(g); cell.cleared = true; A.toast("小舟は静かに岸へ着いた", "good", "stairs"); A.warpToStairs();
        } },
        A.canPaySoul(s) && { label: `魂で渡る (✦${s}) ― 秘宝の岸 (上等な品)`, primary: true, fn: () => {
          A.paySoul(s); A.item({ rare: true }, "秘宝の岸", () => A.done(cell));
        } },
      ];
    },
  },
  {
    id: "l3_09", name: "鉱山主の金庫", layer: 3, tier: "rare", icon: "chest", minLv: 24, deep: true,
    intro: (A, cell) => ["鉱山主が遺した黒鉄の金庫。三重の錠前が掛かっている。", `錠前を破れるのは3度まで (残り ${3 - (cell.evTry || 0)}度)。しくじるたび、番兵が目を覚ます。`],
    choices: (A, cell) => {
      const d = A.checkDisarm();
      return [
        (cell.evTry || 0) < 3 && { label: `錠前を破る ― ${d.who ? d.who.name : "誰か"} (成功 ${pctTxt(d.p)}) / 失敗で番兵`, danger: true, fn: () => {
          cell.evTry = (cell.evTry || 0) + 1;
          if (d.ok) { A.sfx("chest"); A.gold(10, "鉱山主の金庫"); A.item({ rare: true }, "鉱山主の金庫", () => A.done(cell)); return; }
          if (cell.evTry >= 3) { A.sfx("ng"); A.toast("錠前は完全に壊れた ― 金庫は二度と開かない", "bad"); A.done(cell); return; }
          A.alarm("番兵が目を覚ました！", ["打ち倒して、もう一度錠前に挑め。"], "trap", () => A.fight(cell, [{ pool: true, min: 2, strong: 1.3 }], "vault", { noChest: true }));
        } },
      ];
    },
    onWin: (A, cell, f, next) => { next && next(); setTimeout(() => A.reopen(cell), 30); },
  },
  {
    id: "l3_10", name: "地の底の鍛冶場", layer: 3, tier: "mythic", icon: "event", once: true, minLv: 25, deep: true,
    boon: EV_BOONS.temper.text,
    intro: () => ["地熱で赤く光る火床。ドワーフの霊が、黙々と槌を振るっている。", "霊は無言で隊の得物を取り上げると、火床にくべ、焼き入れを施して返した。"],
    gift: (A) => {
      A.flags().temper = true;
      A.sfx("victory"); A.flash("#ff9a4a");
      return ["「……これで、少しはましに斬れる」", `✺ ${EV_BOONS.temper.text} (以後ずっと)`];
    },
  },
  // ================= 第4層「捨て砦」 (10) =================
  {
    id: "l4_01", name: "兵糧庫", layer: 4, tier: "common", icon: "chest",
    intro: () => ["籠城のために蓄えられた兵糧庫。樽も木箱も、百年分のほこりをかぶっている。", "奥で、何かをかじる音がする。"],
    choices: (A, cell) => [
      { label: "木箱をこじ開ける ― 品 / 30%で巣食った群れに襲われる", danger: true, fn: () => {
        if (chance(0.3)) { A.alarm("群れが飛び出してきた！", ["兵糧庫は、とうに魔物の巣だった。"], "trap", () => A.fight(cell, [{ pool: true, min: 3 }], "larder", { noChest: true })); return; }
        A.item({}, "兵糧庫の木箱", () => A.done(cell));
      } },
      anyHurt(A) && { label: "封の固い樽を開ける ― 半々で全員のHP3割回復 / 腐っていて全員が毒", fn: () => {
        if (chance(0.5)) { A.healAll(0.3, 0, false); A.sfx("heal"); A.toast("塩漬けの干し肉は、まだ食べられた ― HPが回復した", "good", "fountain"); }
        else { A.ailAll("poison", 0.7); A.sfx("trap"); A.toast("樽の中身は腐っていた ― 毒に当たった", "bad", "poison"); }
        A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.item({}, "兵糧庫の木箱", () => A.done(cell, next)),
  },
  {
    id: "l4_02", name: "点呼の亡霊", layer: 4, tier: "common", icon: "mon:bs_pikewall",
    intro: () => ["槍を立てた亡兵が、壁の名簿を指でなぞっている。", "「……点呼。答えぬ者は、脱走とみなす」"],
    choices: (A, cell) => [
      { label: "名乗りを上げる ― 隊の一員と認められ、この階の与ダメ+15%", primary: true, fn: () => {
        A.floorEv().mods.push({ src: "l4_02", name: "点呼の名乗り", desc: "亡兵に隊の一員と認められた ― 与えるダメージ +15% (この階)", dmgMul: 1.15 });
        A.sfx("spell"); A.toast("「よし。持ち場につけ」― この階の与ダメ+15%", "good"); A.done(cell);
      } },
      { label: "黙って敬礼する ― ✦Soul を少し", fn: () => { A.sfx("heal"); A.soul(1, "亡兵の答礼"); A.done(cell); } },
    ],
  },
  {
    id: "l4_03", name: "放棄された投石機", layer: 4, tier: "common", icon: "trap",
    intro: () => ["城壁の上に、縄の朽ちた投石機が据えられたままになっている。", "傍らには、まだ火薬壺がいくつか残っている。"],
    choices: (A, cell) => {
      const c = A.check("atk");
      return [
        { label: `巻き上げる ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 次の戦闘の開幕に敵全体へ痛打 / 失敗で腕木が跳ねる`, primary: true, fn: () => {
          if (c.ok) { A.runEv().bomb = (A.runEv().bomb || 0) + 1; A.sfx("itemget"); A.toast("投石機に火薬壺を込めた ― 次の戦闘の開幕に敵全体へ痛打", "good"); }
          else if (c.who) { A.hurtOne(c.who, 0.2); A.sfx("trap"); A.toast(`${c.who.name}は跳ねた腕木に打たれた`, "bad", "trap"); }
          A.done(cell);
        } },
        { label: "金具を外す ― 金貨", fn: () => { A.gold(1.5, "投石機の金具"); A.done(cell); } },
      ];
    },
  },
  {
    id: "l4_04", name: "戦死者の名札", layer: 4, tier: "common", icon: "corpse",
    intro: () => ["鎧ごと朽ちた兵の骸。首から下げた真ちゅうの名札だけが、鈍く光っている。"],
    choices: (A, cell) => [
      { label: "名札を持ち帰る ― 収集品", fn: () => A.collectible("戦死者の名札", () => A.done(cell)) },
      { label: "名を呼んで弔う ― ✦Soul と、近くの骸に魂が宿る", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1, "戦死者の弔い");
        if (A.warmCorpse()) A.toast("呼ばれた名に応えて、近くの骸が温もりを取り戻した", "good", "corpseWarm");
        A.done(cell);
      } },
    ],
  },
  {
    id: "l4_05", name: "封じられた武器庫", layer: 4, tier: "uncommon", icon: "chest",
    intro: (A, cell) => ["鉄板で補強された武器庫の扉。錠前には守備隊の紋。", cell.evTry ? "番兵は倒した。錠前はまだそこにある。" : "扉の前に、錆びた鎧が一体、じっと立っている。"],
    choices: (A, cell) => {
      const d = A.checkDisarm();
      return [
        { label: `錠前を外す ― ${d.who ? d.who.name : "誰か"} (成功 ${pctTxt(d.p)}) ― 上等な品 / 失敗で番兵が動く`, primary: true, fn: () => {
          if (d.ok || cell.evTry) { A.sfx("chest"); A.item({ rare: true }, "守備隊の武器庫", () => A.done(cell)); return; }
          A.alarm("番兵が動いた！", ["武器庫の番兵が、錆びた剣を抜いた。打ち倒せば扉は開く。"], "trap", () => A.fight(cell, [{ key: "d03_sentinel", strong: 1.6, name: "武器庫の番兵" }], "armory", { noChest: true }));
        } },
        { label: "扉ごと叩き壊す ― 番兵と戦い、勝てば武器庫の品", danger: true, fn: () => A.fight(cell, [{ key: "d03_sentinel", strong: 1.6, name: "武器庫の番兵" }], "armory", { noChest: true }) },
      ];
    },
    onWin: (A, cell, f, next) => { cell.evTry = 1; A.item({ rare: true }, "守備隊の武器庫", () => A.done(cell, next)); },
  },
  {
    id: "l4_06", name: "脱走兵の亡霊", layer: 4, tier: "uncommon", icon: "mon:d03_ghost", minFloor: 2,
    intro: () => ["城壁の隙間に身を潜めた亡霊が、震える声で囁く。", "「頼む……見逃してくれ。抜け道なら教える。下へ降りる、近道だ」"],
    choices: (A, cell) => [
      { label: "見逃す ― 抜け道を通って階段の傍へ", primary: true, fn: () => {
        cell.cleared = true; A.sfx("step"); A.toast("亡霊の抜け道を抜けた ― 階段の傍に出た", "good", "stairs"); A.warpToStairs();
      } },
      { label: "持ち場へ連れ戻す ― 亡霊と戦い、勝てば希少な魂 (レア以上)", danger: true, fn: () => {
        A.fight(cell, [{ key: "d03_ghost", strong: 1.8, name: "脱走兵の亡霊" }], "deserter", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "持ち場に戻された脱走兵の魂だ。", () => A.done(cell, next)),
  },
  {
    id: "l4_07", name: "軍鼓", layer: 4, tier: "uncommon", icon: "mon:bs_drumwraith", deep: true,
    intro: () => ["城壁の上に、獣の皮を張った大きな軍鼓が据えられている。", "打ち鳴らせば兵は奮い立ち、敵もまた目を覚ますだろう。"],
    choices: (A, cell) => [
      { label: "打ち鳴らす ― この階の与ダメ+25% (敵も昂ぶり強さ×1.15)", danger: true, fn: () => {
        A.floorEv().mods.push({ src: "l4_07", name: "軍鼓の響き", desc: "与えるダメージ +25%・敵の強さ ×1.15 (この階)", dmgMul: 1.25, enemyMul: 1.15 });
        A.sfx("spell"); A.flash("#c9a26a"); A.toast("軍鼓が鳴り響いた ― 与ダメ+25% (敵も昂ぶる)", "gold"); A.done(cell);
      } },
      { label: "皮を裂く ― 亡兵が怯んで退く (この階の魔物 2体が消える)", primary: true, fn: () => {
        const n = A.removeMonsters(2);
        A.sfx("hit"); A.toast(n ? `鼓の音を失った亡兵が、${n}体退いていった` : "退く亡兵は、もういなかった", n ? "good" : "info"); A.done(cell);
      } },
    ],
  },
  {
    id: "l4_08", name: "伝令の亡霊", layer: 4, tier: "uncommon", icon: "mon:bs_bannerwraith", minFloor: 2,
    intro: () => ["封書を握りしめた伝令の亡霊が、同じ廊下を行きつ戻りつしている。", "「援軍の報せだ……王都へ……届けねば……」"],
    choices: (A, cell) => [
      { label: "封書を預かる ― 伝令は安らぎ、階段と宝箱の在処を教える", primary: true, fn: () => {
        A.revealStairs();
        const n = A.revealWhere((c) => c.type === "chest" && !c.cleared, 2);
        A.sfx("heal"); A.toast(`伝令は消えた ― 階段${n ? `と宝箱${n}つ` : ""}の在処が見えた`, "good", "stairs"); A.done(cell);
      } },
      { label: "封書を奪う ― 伝令と戦い、勝てば魂の残火", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_bannerwraith", strong: 1.7, name: "伝令の亡霊" }], "courier", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => { A.ember(1, "伝令の封書に宿っていた残火"); A.done(cell, next); },
  },
  {
    id: "l4_09", name: "処刑台", layer: 4, tier: "rare", icon: "mon:el_headsman", deep: true,
    intro: () => ["中庭の処刑台。吊るされた縄の下で、首の無い亡霊が膝をついている。", "「……わしは、砦の主に門を開けよと進言して、首をはねられた」", "「主の鎧の継ぎ目を、わしは知っておる。縄を断ってくれれば、教えよう」"],
    choices: (A, cell) => [
      { label: "縄を断つ ― 第4層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 4: true };
        A.sfx("spell");
        A.story("首の無い進言者", ["「主の胸当ての左、三枚目の板の下だ。あの男は、そこだけ古傷を庇う」", "「……ありがとう。やっと、首を探しに行ける」", "第4層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "処刑人を呼び出す ― 強敵と戦い、勝てば上等な宝箱と希少な魂", danger: true, fn: () => {
        A.fight(cell, [{ elite: true, key: "el_headsman" }], "headsman", { noChest: true });
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "処刑台に縛られていた魂だ。", () => A.chestHere(cell, { rankUp: 2 }, next)),
  },
  {
    id: "l4_10", name: "最後の点呼", layer: 4, tier: "mythic", icon: "event", once: true, minLv: 34, deep: true,
    boon: EV_BOONS.salute.text,
    intro: () => ["崩れた練兵場に、百年前の守備隊が整列していた。", "隊長の亡霊が一歩進み出て、こちらの隊に向かって剣を掲げた。", "「──援軍、着到。持ち場を、引き継ぐ」"],
    gift: (A) => {
      A.flags().salute = true;
      A.sfx("victory"); A.flash("#c9a26a");
      return ["亡兵たちは一斉に敬礼すると、霧のように消えていった。", `✺ ${EV_BOONS.salute.text} (以後ずっと)`];
    },
  },

  // ================= 第5層「霧の森」 (12) =================
  {
    id: "l5_01", name: "光る茸の輪", layer: 5, tier: "common", icon: "fountain",
    intro: () => ["霧の底に、青白く光る茸が輪を描いて生えている。", "輪の中だけ、霧が晴れている。"],
    choices: (A, cell) => [
      anyDrained(A) && { label: "輪の中で休む ― 半々で全員のMP4割回復 / 胞子を吸って全員が毒", fn: () => {
        if (chance(0.5)) { A.healAll(0, 0.4, false); A.sfx("heal"); A.toast("茸の光が魔力を満たした", "good", "fountain"); }
        else { A.ailAll("poison", 0.8); A.sfx("trap"); A.toast("胞子が舞った ― 毒に侵された", "bad", "poison"); }
        A.done(cell);
      } },
      { label: "茸を摘む ― 収集品", primary: true, fn: () => A.collectible("光る茸", () => A.done(cell)) },
    ],
  },
  {
    id: "l5_02", name: "迷い子の足跡", layer: 5, tier: "common", icon: "event",
    intro: () => ["湿った土に、小さな足跡が続いている。霧の奥へ、まっすぐに。"],
    choices: (A, cell) => [
      { label: "足跡を辿る ― 半々で置き去りの荷 (宝箱) / 霧に潜む群れ", danger: true, fn: () => {
        if (chance(0.5)) { A.chestHere(cell, { rankUp: 0 }); return; }
        A.alarm("足跡の先にいたのは、子どもではなかった！", ["霧に潜む魔物が、獲物を誘っていた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "lure", { noChest: true }));
      } },
    ],
    leaveLabel: "辿らない",
    onWin: (A, cell, f, next) => A.chestHere(cell, { rankUp: 0 }, next),
  },
  {
    id: "l5_03", name: "霧の中の灯", layer: 5, tier: "uncommon", icon: "mon:bs_wisplure",
    intro: () => ["霧の向こうに、ランタンのような灯がひとつ揺れている。", "灯は、ついて来いと言うように遠ざかっていく。"],
    choices: (A, cell) => [
      { label: "灯について行く ― 70%で階段の傍へ / 30%で惑わしの群火の罠", danger: true, fn: () => {
        if (chance(0.7)) { cell.cleared = true; A.sfx("step"); A.toast("灯は、階段の傍で消えた", "good", "stairs"); A.warpToStairs(); return; }
        A.alarm("灯が、牙を剥いた！", ["それは迷い人を喰らう群火だった。"], "trap", () => A.fight(cell, [{ key: "bs_wisplure", strong: 1.6, name: "誘い火" }], "wisp", { noChest: true }));
      } },
      { label: "灯を払い散らす ― ✦Soul", primary: true, fn: () => { A.sfx("spell"); A.soul(2, "散った灯"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => { A.soul(4, "誘い火"); A.done(cell, next); },
  },
  {
    id: "l5_04", name: "古木のうろ", layer: 5, tier: "uncommon", icon: "chest",
    intro: () => ["苔むした古木の幹に、人の頭ほどのうろが開いている。", "奥で、何かが金色に光った。"],
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: `手を入れる ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 上等な品 / 失敗で絞め蔦が目覚める`, primary: true, fn: () => {
          if (c.ok) { A.item({ rare: true }, "古木のうろ", () => A.done(cell)); return; }
          A.alarm("蔦が腕に絡みついた！", ["うろは、絞め蔦の口だった。"], "trap", () => A.fight(cell, [{ key: "bs_stranglevine", strong: 1.5, name: "うろの絞め蔦" }], "hollow", { noChest: true }));
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.item({ rare: true }, "古木のうろ", () => A.done(cell, next)),
  },
  {
    id: "l5_05", name: "狩人の罠小屋", layer: 5, tier: "uncommon", icon: "event",
    intro: () => ["朽ちかけた狩人の小屋。壁には獣用の罠と、毒を塗った矢が掛けてある。"],
    choices: (A, cell) => [
      { label: "罠と毒矢を借りる ― この潜入の間、獣への与ダメ+30%", primary: true, fn: () => {
        A.runEv().mods = [...(A.runEv().mods || []), { src: "l5_05", name: "狩人の罠", desc: "獣への与ダメージ +30% (この潜入)", prey: { races: ["beast"], mul: 1.3 } }];
        A.sfx("itemget"); A.toast("狩人の道具を借りた ― 獣への与ダメ+30%", "good"); A.done(cell);
      } },
      anyHurt(A) && { label: "小屋で一息つく ― 全員のHP2割回復", fn: () => { A.healAll(0.2, 0, false); A.sfx("heal"); A.toast("小屋で傷の手当てをした", "good", "fountain"); A.done(cell); } },
    ],
  },
  {
    id: "l5_06", name: "霧の湖の乙女", layer: 5, tier: "rare", icon: "fountain", deep: true,
    intro: () => ["霧の晴れた湖のほとりに、白い衣の乙女が座っている。足は、水に溶けている。", "「霧の森で迷った者は、みなわたしの湖に来るの。あなたは、何を落としたの?」"],
    choices: (A, cell) => {
      const s = A.soulCost(4);
      return [
        A.canPaySoul(s) && { label: `魂を湖に沈める (✦${s}) ― 魂の残火 ×2`, fn: () => { A.paySoul(s); A.sfx("heal"); A.ember(2, "湖の乙女"); A.done(cell); } },
        { label: "「迷っていない」と答える ― 湖の底の品 (レア以上)", primary: true, fn: () => {
          A.sfx("spell"); A.itemMinRar("r", "湖の乙女", () => A.done(cell));
        } },
        needsCare(A) && { label: "湖の水を飲む ― 全員が全快", fn: () => { A.healAll(1, 1, true); A.sfx("heal"); A.toast("澄んだ水が、霧の毒まで洗い流した", "good", "fountain"); A.done(cell); } },
      ];
    },
  },
  {
    id: "l5_07", name: "森の古老", layer: 5, tier: "mythic", icon: "event", once: true, deep: true,
    boon: EV_BOONS.mistEye.text,
    intro: () => ["霧の中から、苔に覆われた鹿の古老が現れた。角には、無数の小さな灯がともっている。", "古老は隊の一人ひとりの額に、そっと鼻先を寄せた。"],
    gift: (A) => {
      A.flags().mistEye = true;
      A.sfx("heal");
      return ["霧が、ほんの少しだけ薄く見える。", `✺ ${EV_BOONS.mistEye.text} (以後ずっと)`];
    },
  },  // ---- 第三章「魂脈の根」で増やした第5層の出来事 ----
  {
    id: "l5_08", name: "魂の実る木", layer: 5, tier: "common", icon: "fountain",
    intro: () => ["枝という枝に、淡く光る実をつけた木。実のひとつひとつに、小さな顔が浮かんでいる。", "根に呑まれた魂が、ここで実になるのだ。"],
    choices: (A, cell) => [
      { label: "実をもぐ ― ✦Soul / 30%で木の番人が目を覚ます", danger: true, fn: () => {
        if (chance(0.3)) { A.alarm("木が身じろぎした！", ["実を守る番人が、根の中から這い出してきた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "soulfruit", { noChest: true })); return; }
        A.sfx("heal"); A.soul(2, "魂の実"); A.done(cell);
      } },
      { label: "実を土に還す ― 近くの骸に魂が宿る", primary: true, fn: () => {
        const ok = A.warmCorpse();
        A.sfx("spell"); A.toast(ok ? "落ちた実が土に溶け、近くの骸が温もりを取り戻した" : "実は土に溶けて消えた", ok ? "good" : "info", "corpseWarm"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => { A.soul(3, "魂の実"); A.done(cell, next); },
  },
  {
    id: "l5_09", name: "樹液のこぶ", layer: 5, tier: "common", icon: "fountain",
    cond: (A) => A.aliveList().some((m) => m.mp < m.maxmp || m.hp < m.maxhp),
    intro: () => ["根のこぶから、琥珀色の樹液がとろりと滴っている。甘い香り。", "魂が溶けたものだと知っていても、喉が鳴る。"],
    choices: (A, cell) => [
      anyDrained(A) && { label: "樹液をなめる ― 全員のMP5割回復 / 25%で一人が痺れる", primary: true, fn: () => {
        A.healAll(0, 0.5, false); A.sfx("heal");
        if (chance(0.25)) { const m = A.randomAlive(); if (m) { A.ail(m, "paralyze"); A.toast(`${m.name}は樹液に痺れた ― MPは満ちたが…`, "bad", "trap"); } }
        else A.toast("樹液が魔力を満たした", "good", "fountain");
        A.done(cell);
      } },
      anyHurt(A) && { label: "傷に塗る ― 全員のHP3割回復", fn: () => { A.healAll(0.3, 0, false); A.sfx("heal"); A.toast("樹液が傷を塞いだ", "good", "fountain"); A.done(cell); } },
    ],
  },
  {
    id: "l5_10", name: "根の中の声", layer: 5, tier: "uncommon", icon: "event", minFloor: 2,
    intro: () => ["太い根の中から、くぐもった声が聞こえる。誰かが、根の中に閉じ込められている。", "「……出して……まだ、木になりたくない……」"],
    choices: (A, cell) => [
      { label: "根を裂く ― 根の番人と戦い、勝てば希少な魂 (レア以上)", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_stranglevine", strong: 1.7, name: "根の番人" }], "rootvoice", { noChest: true });
      } },
      { label: "声に道を尋ねる ― この階の魔物の居場所がすべて見える", primary: true, fn: () => {
        const n = A.revealWhere((c) => c.type === "monster" && !c.cleared);
        A.sfx("spell"); A.toast(n ? `声が根の震えを教えた ― 魔物 ${n}体の居場所が見えた` : "声は、もう誰もいないと囁いた", n ? "good" : "info"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "根の中に閉じ込められていた魂だ。", () => A.done(cell, next)),
  },
  {
    id: "l5_11", name: "庭師の鋏", layer: 5, tier: "uncommon", icon: "trap", deep: true,
    intro: () => ["根の分かれ目に、金の装飾の大鋏が突き立っている。柄に彫られた紋は──宰相府の印。", "庭師は、ここで根の手入れをしていたのだ。"],
    choices: (A, cell) => [
      { label: "鋏で根を断つ ― この階の植物の魔物への与ダメ+30% (大樹が叫び、全員に小さな傷)", primary: true, fn: () => {
        A.hurtAll(0.08); A.flash("#7a9a50");
        A.floorEv().mods.push({ src: "l5_11", name: "断たれた根", desc: "植物の魔物への与ダメージ +30% (この階)", prey: { races: ["plant"], mul: 1.3 } });
        A.sfx("hit"); A.toast("根を断った ― 大樹の叫びが響く。植物の魔物への与ダメ+30%", "gold"); A.done(cell);
      } },
      { label: "鋏を持ち帰る ― 収集品", fn: () => A.collectible("庭師の鋏", () => A.done(cell)) },
    ],
  },
  {
    id: "l5_12", name: "くさびを打った操霊師", layer: 5, tier: "rare", icon: "event", deep: true, minLv: 46,
    intro: () => ["幹に半ば呑まれた人影。古い操霊師の法衣を着て、手には鉄のくさびと槌を握ったまま、木になりかけている。", "「……わしは、ヴェルナーより前の操霊師。大樹の主にくさびを一本、打ち込んでやった」", "「そのくさびの場所を教えよう。……それとも、わしの杖を持ってゆくか」"],
    choices: (A, cell) => [
      { label: "くさびの場所を聞く ― 第5層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 5: true };
        A.sfx("spell");
        A.story("木になりかけた操霊師", ["「主の胸の、苔の剥げたところだ。くさびはまだ、そこに刺さっておる」", "「……オルドとかいう若いのにも、同じことを教えた。あれは、くさびごと根を断っていった」", "第5層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "杖を受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "操霊師の遺品", () => A.done(cell)); } },
    ],
  },
  // ================= 第6層「沈んだ大神殿」 (10) ── 第四章「王都の地下」。三百年前に沈んだ旧都と、その大神殿 =================
  {
    id: "l6_01", name: "沈んだ供物台", layer: 6, tier: "common", icon: "chest",
    intro: () => ["水の底の参道に、石の供物台が並んでいる。", "皿の上には、三百年前の供物が、苔に包まれたまま残っている。"],
    choices: (A, cell) => {
      const cost = A.goldCost(1);
      return [
        { label: "供物を拾い上げる ― 品 / 30%で供物に化けた魔物の群れ", danger: true, fn: () => {
          if (chance(0.3)) { A.alarm("供物が動いた！", ["皿の上のものは、供物のふりをした魔物だった。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "offering", { noChest: true })); return; }
          A.item({}, "沈んだ供物台", () => A.done(cell));
        } },
        A.canPayGold(cost) && { label: `金貨を供え直す (💰${cost}) ― ✦Soul と、階段の在処`, primary: true, fn: () => {
          A.payGold(cost); A.revealStairs(); A.sfx("heal");
          A.soul(1.5, "供え直した供物"); A.toast("水が静かに揺れ、階段への道を照らした", "good", "stairs"); A.done(cell);
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.item({}, "沈んだ供物台", () => A.done(cell, next)),
  },
  {
    id: "l6_02", name: "水底の聖歌", layer: 6, tier: "common", icon: "mon:bs_choirwraith",
    intro: () => ["どこからか、水にくぐもった歌声が聞こえる。", "沈んだ聖歌隊が、三百年前と同じ節を、いまも歌い続けている。"],
    choices: (A, cell) => [
      anyDrained(A) && { label: "歌に耳を澄ます ― 全員のMP3割回復", fn: () => {
        A.healAll(0, 0.3, false); A.sfx("heal"); A.toast("歌声が、すり減った魔力を満たしていく", "good", "fountain"); A.done(cell);
      } },
      { label: "声を合わせて歌う ― この階の亡霊・不死への与ダメ+30%", primary: true, fn: () => {
        A.floorEv().mods.push({ src: "l6_02", name: "重ねた聖歌", desc: "亡霊・不死の魔物への与ダメージ +30% (この階)", prey: { races: ["specter", "undead"], mul: 1.3 } });
        A.sfx("spell"); A.toast("歌が重なった ― この階の亡霊・不死への与ダメ+30%", "good"); A.done(cell);
      } },
    ],
  },
  {
    id: "l6_03", name: "洗礼の水盤", layer: 6, tier: "common", icon: "fountain",
    intro: () => ["澄んだ水をたたえた、白い石の水盤。王が冠を受ける前に身を清めた水だという。", "底には、巡礼者が投げ入れた品が沈んでいる。"],
    choices: (A, cell) => [
      (anyHurt(A) || anyAiling(A)) && { label: "水を浴びる ― 全員のHP3割回復・状態異常が治る", primary: true, fn: () => {
        A.healAll(0.3, 0, true); A.sfx("heal"); A.toast("洗礼の水が、傷と汚れを洗い流した", "good", "fountain"); A.done(cell);
      } },
      { label: "水盤の底をさらう ― 収集品", fn: () => A.collectible("洗礼の水盤", () => A.done(cell)) },
    ],
  },
  {
    id: "l6_04", name: "膝をつく信徒", layer: 6, tier: "common", icon: "mon:bs_drownedpriest",
    intro: () => ["水底で膝をつき、祈り続ける信徒の亡霊がいる。", "「……神官王さま、冠を……どうか、泉をお守りください……」"],
    choices: (A, cell) => [
      { label: "共に祈る ― ✦Soul", primary: true, fn: () => { A.sfx("heal"); A.soul(1.5, "信徒の祈り"); A.done(cell); } },
      { label: "肩を叩いて起こす ― 半々で抜け道を教わる (階段の傍へ) / 祈りを乱されて襲いかかる", danger: true, fn: () => {
        if (chance(0.5)) { cell.cleared = true; A.sfx("step"); A.toast("信徒は黙って、水の抜け道を指さした ― 階段の傍に出た", "good", "stairs"); A.warpToStairs(); return; }
        A.alarm("信徒が振り向いた！", ["祈りを乱された信徒の目が、昏く濁った。"], "trap", () => A.fight(cell, [{ key: "bs_drownedpriest", strong: 1.4, name: "怒れる信徒" }], "devotee", { noChest: true }));
      } },
    ],
    onWin: (A, cell, f, next) => { A.soul(2, "信徒の魂"); A.done(cell, next); },
  },
  {
    id: "l6_05", name: "神像の涙", layer: 6, tier: "uncommon", icon: "event",
    intro: () => ["半ば崩れた神像が、水の中に立っている。", "片目にはめこまれた青い宝玉から、ひとすじの雫が流れ続けている。"],
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: `宝玉をこじる ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 上等な品 / 失敗で神像の番人が目を覚ます`, primary: true, fn: () => {
          if (c.ok) { A.sfx("itemget"); A.item({ rare: true }, "神像の宝玉", () => A.done(cell)); return; }
          A.alarm("神像の足元が動いた！", ["神像を守る番人が、水の中から立ち上がった。"], "trap", () => A.fight(cell, [{ key: "bs_idolguardian", strong: 1.6, name: "神像の番人" }], "idol", { noChest: true }));
        } },
        needsCare(A) && { label: "涙を受けて飲む ― 全員のHP・MP5割回復・状態異常が治る", fn: () => {
          A.healAll(0.5, 0.5, true); A.sfx("heal"); A.toast("神像の涙は、ほのかに甘かった", "good", "fountain"); A.done(cell);
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.item({ rare: true }, "神像の宝玉", () => A.done(cell, next)),
  },
  {
    id: "l6_06", name: "沈んだ大鐘", layer: 6, tier: "uncommon", icon: "mon:bs_sunkenbell", minFloor: 2,
    intro: () => ["崩れた鐘楼から落ちた大鐘が、水底に傾いて沈んでいる。", "舌はまだ揺れている。鳴らせば、水の底まで響くだろう。"],
    choices: (A, cell) => [
      A.countCells((c) => c.type === "monster" && !c.cleared && !c.elite) > 0 && { label: "鐘を打ち鳴らす ― この階の魔物3体が響きに追われて去る / 35%で大鐘そのものが目を覚ます", danger: true, fn: () => {
        if (chance(0.35)) { A.alarm("鐘が、うなり声を上げた！", ["大鐘そのものが、たたりの魔物だった。"], "trap", () => A.fight(cell, [{ key: "bs_sunkenbell", strong: 1.6, name: "目覚めた大鐘" }], "bell", { noChest: true })); return; }
        const n = A.removeMonsters(3);
        A.sfx("spell"); A.toast(`鐘の響きに追われて、魔物が${n}体去っていった`, "good"); A.done(cell);
      } },
      { label: "鐘の金具を外す ― 金貨", primary: true, fn: () => { A.gold(3, "大鐘の金具"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => { A.gold(4, "大鐘の中の奉納金"); A.done(cell, next); },
  },
  {
    id: "l6_07", name: "水に溶けた写字室", layer: 6, tier: "uncommon", icon: "event", deep: true,
    intro: () => ["神官たちの写字室。棚の巻物は水を吸い、文字がにじんで流れ出している。", "一巻だけ、ろうで封じられた巻物が、乾いたまま残っていた。"],
    choices: (A, cell) => {
      const c = A.check("int");
      return [
        { label: `封を解いて読む ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― ✦Soul と、この階の宝箱の在処 / 失敗で呪いの文字に魔力を吸われる`, primary: true, fn: () => {
          if (!c.ok) { A.mpAll(0.3); A.sfx("trap"); A.toast("にじんだ文字が目に焼きつき、魔力を吸われた ― 全員のMPが減った", "bad", "trap"); A.done(cell); return; }
          A.soul(3, "封じられた巻物");
          const n = A.revealWhere((x) => x.type === "chest" && !x.cleared);
          A.story("封じられた巻物", ["「……泉のほとりに、若い神官が見慣れぬ苗木を植えた。」", "「神官王さまはお怒りになったが、あの方は、ただ微笑むばかりだった……」", "巻物はそこで、水に溶けて読めなくなった。", n ? `余白の地図に、この階の宝箱${n}つの在処が記されていた。` : "余白の地図は、もう読み取れなかった。"], () => A.done(cell));
        } },
        { label: "巻物を持ち帰る ― 収集品", fn: () => A.collectible("封じられた巻物", () => A.done(cell)) },
      ];
    },
  },
  {
    id: "l6_08", name: "引き潮の回廊", layer: 6, tier: "uncommon", icon: "chest", minFloor: 2,
    intro: () => ["回廊の水が、ゆっくりと引いていく。旧都の潮は、いまも満ち引きを繰り返しているらしい。", "水の引いた床に、何かの角が見えはじめた。"],
    choices: (A, cell) => [
      { label: "潮が引くのを待つ ― 床の下から宝箱 (ランク+1) / 40%で待つ間に魔物が寄ってくる", primary: true, fn: () => {
        if (chance(0.4)) { A.alarm("水音が近づいてくる！", ["引き潮に取り残された魔物が、こちらに気づいた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "ebb", { noChest: true })); return; }
        A.chestHere(cell, { rankUp: 1 });
      } },
      { label: "引き潮に乗る ― 水の流れに運ばれて階段の傍へ", fn: () => {
        cell.cleared = true; A.sfx("step"); A.toast("引いていく水に運ばれた ― 階段の傍に出た", "good", "stairs"); A.warpToStairs();
      } },
    ],
    onWin: (A, cell, f, next) => A.chestHere(cell, { rankUp: 1 }, next),
  },
  {
    id: "l6_09", name: "冠を捧げる侍従", layer: 6, tier: "rare", icon: "event", deep: true, minLv: 56,
    intro: () => ["水底の廊下で、冠を捧げ持つ侍従の亡霊が待っていた。", "「……あなた方は、王に会いに来たのですね。あの方はもう、王ではありません。冠が、王を離さないのです」", "「冠のほころびを、わたしは知っています。それとも、わたしが守ってきた宝物をお持ちになりますか」"],
    choices: (A, cell) => [
      { label: "ほころびを聞く ― 第6層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 6: true };
        A.sfx("spell");
        A.story("冠を捧げる侍従", ["「冠の内側、三つ目の宝玉が割れています。泉に苗が植えられた夜、王が自ら握りつぶしたのです」", "「……一年前にも、ひとり、幹を登ってきた操霊師がおりました。王と長く話して、もっと下へ降りてゆかれました」", "第6層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "宝物を受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "侍従の宝物", () => A.done(cell)); } },
    ],
  },
  {
    id: "l6_10", name: "魂の泉のしずく", layer: 6, tier: "rare", icon: "fountain", deep: true,
    intro: () => ["石の割れ目から、青白く光る水が湧き出している。旧都の「魂の泉」から漏れ出た水だ。", "水の中で、無数の小さな灯が揺れている。水底では、泉の番をする何かが身じろぎした。"],
    choices: (A, cell) => [
      { label: "泉の底をさらう ― 泉の番人と戦い、勝てば希少な魂と上等な宝箱", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_tidecaller", strong: 1.8, name: "泉の番人" }], "soulspring", { noChest: true });
      } },
      { label: "器を泉で清める ― 全員が全快し、✦Soul", primary: true, fn: () => {
        A.healAll(1, 1, true); A.sfx("heal"); A.soul(6, "魂の泉"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "泉の底に沈んでいた魂だ。", () => A.chestHere(cell, { rankUp: 2 }, next)),
  },

  // ================= 第7層「灼熱の洞」 (10) ── 第五章。大神殿の底のさらに下、大樹の樹液を煮詰める火の洞 =================
  {
    id: "l7_01", name: "灰の吹きだまり", layer: 7, tier: "common", icon: "gold",
    intro: () => ["天井から降る灰が、通路の隅に吹きだまっている。", "灰の中に、溶けかけた金具がいくつも埋もれている。"],
    choices: (A, cell) => [
      { label: "灰を掘り返す ― 金貨 / 25%で灰の中に潜む魔物", danger: true, fn: () => {
        if (chance(0.25)) { A.alarm("灰が盛り上がった！", ["灰の中に、魔物が身を潜めていた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "ash", { noChest: true })); return; }
        A.gold(1.5, "灰の中の金具"); A.done(cell);
      } },
      { label: "灰の上の品を拾う ― 品", primary: true, fn: () => A.item({}, "灰の吹きだまり", () => A.done(cell)) },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "灰の中の金具"); A.done(cell, next); },
  },
  {
    id: "l7_02", name: "すすけた人業の手", layer: 7, tier: "common", icon: "corpse",
    intro: () => ["焼け焦げた人業の手が、灰の上に落ちている。", "木の指は、何かを握りしめたまま固まっている。"],
    choices: (A, cell) => [
      { label: "指を開く ― 品", fn: () => A.item({}, "すすけた人業の手", () => A.done(cell)) },
      { label: "灰に埋めて弔う ― ✦Soul と、近くの骸に魂が宿る", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1, "人業の弔い");
        if (A.warmCorpse()) A.toast("弔いに応えるように、近くの骸が温もりを取り戻した", "good", "corpseWarm");
        A.done(cell);
      } },
    ],
  },
  {
    id: "l7_03", name: "溶岩の川", layer: 7, tier: "common", icon: "trap",
    intro: () => ["赤く煮えたぎる溶岩の川。向こう岸の岩棚で、何かが光っている。", "飛び石は、どれも熱でゆらいで見える。"],
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: `飛び石を渡る ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 向こう岸の品 / 失敗で足を焼かれる`, primary: true, fn: () => {
          if (c.ok) { A.sfx("step"); A.item({}, "溶岩の向こう岸", () => A.done(cell)); return; }
          if (c.who) { A.hurtOne(c.who, 0.25); A.sfx("trap"); A.toast(`${c.who.name}は足を踏み外し、溶岩に焼かれた`, "bad", "trap"); }
          A.done(cell);
        } },
        { label: "溶岩の熱で刃を焼く ― この階の与ダメ+15% (全員に小さな火傷)", fn: () => {
          A.hurtAll(0.06); A.flash("#e07040");
          A.floorEv().mods.push({ src: "l7_03", name: "焼き直した刃", desc: "与えるダメージ +15% (この階)", dmgMul: 1.15 });
          A.sfx("hit"); A.toast("刃が赤く焼けた ― この階の与ダメ+15%", "gold"); A.done(cell);
        } },
      ];
    },
  },
  {
    id: "l7_04", name: "火を拝む信徒", layer: 7, tier: "common", icon: "event",
    intro: () => ["燃える岩の前に、火を拝む信徒の亡霊がひれ伏している。", "「火は魂を清める。宰相さまは、そうお教えくださった。……おまえたちも、何かくべてゆけ」"],
    choices: (A, cell) => {
      const s = A.soulCost(1);
      return [
        A.canPaySoul(s) && (anyHurt(A) || anyDrained(A)) && { label: `✦Soul を火にくべる (✦${s}) ― 全員のHP・MP4割回復`, primary: true, fn: () => {
          A.paySoul(s); A.healAll(0.4, 0.4, false); A.sfx("heal"); A.toast("炎が高く上がり、隊の体に熱が満ちた", "good", "fountain"); A.done(cell);
        } },
        { label: "信徒の火を踏み消す ― 信徒たちが襲いかかる。勝てば金貨", danger: true, fn: () => {
          A.alarm("信徒たちが立ち上がった！", ["「火を汚す者に、清めの火を！」"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "worship", { noChest: true }));
        } },
      ];
    },
    onWin: (A, cell, f, next) => { A.gold(2.5, "信徒の捧げ物"); A.done(cell, next); },
  },
  {
    id: "l7_05", name: "霊薬の釜", layer: 7, tier: "uncommon", icon: "fountain",
    intro: () => ["小さな釜で、こはく色の液が煮えている。大樹の樹液を煮詰めた霊薬だ。", "釜の縁には、王家の封印の跡がこびりついている。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "霊薬をすする ― 全員が全快 / 30%で強すぎて全員が毒", fn: () => {
        A.healAll(1, 1, true); A.sfx("heal");
        if (chance(0.3)) { A.ailAll("poison", 1); A.toast("霊薬は強すぎた ― 傷は癒えたが、毒が回った", "bad", "poison"); }
        else A.toast("霊薬が、体の芯まで満たした", "good", "fountain");
        A.done(cell);
      } },
      { label: "霊薬を煮詰める ― ✦Soul (霊薬は魂から煮出されたもの)", primary: true, fn: () => { A.sfx("spell"); A.soul(4, "煮詰めた霊薬"); A.done(cell); } },
    ],
  },
  {
    id: "l7_06", name: "焼き印の炉", layer: 7, tier: "uncommon", icon: "trap", minFloor: 2,
    intro: () => ["火を拝む者たちが使った炉。焼き印の鉄が、まだ赤く焼けている。", "炉の脇には、焼き印を押された人業の殻が、いくつも打ち捨てられている。"],
    choices: (A, cell) => [
      { label: "焼き印を武具に押す ― この潜入の間、与ダメ+10% (全員に火傷)", primary: true, fn: () => {
        A.hurtAll(0.12); A.flash("#e07040");
        A.runEv().mods = [...(A.runEv().mods || []), { src: "l7_06", name: "焼き印の武具", desc: "与えるダメージ +10% (この潜入)", dmgMul: 1.1 }];
        A.sfx("hit"); A.toast("武具に焼き印を押した ― この潜入の間、与ダメ+10%", "gold"); A.done(cell);
      } },
      { label: "炉の灰から地金を掘る ― 金貨", fn: () => { A.gold(3.5, "炉の地金"); A.done(cell); } },
    ],
  },
  {
    id: "l7_07", name: "灰の降らぬ岩棚", layer: 7, tier: "uncommon", icon: "event", deep: true,
    intro: () => ["張り出した岩棚の下だけ、灰が降っていない。誰かが野営した跡がある。", "燃え尽きた焚き火のそばに、背負い袋がひとつ置き去りにされている。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "岩棚で休む ― 全員のHP・MP5割回復・状態異常が治る", fn: () => {
        A.healAll(0.5, 0.5, true); A.sfx("heal"); A.toast("灰の降らない岩棚で、しばし息をついた", "good", "fountain"); A.done(cell);
      } },
      { label: "背負い袋を探る ― 置き去りの荷 (宝箱・ランク+1)", primary: true, fn: () => A.chestHere(cell, { rankUp: 1 }) },
    ],
  },
  {
    id: "l7_08", name: "火の虫の巣", layer: 7, tier: "uncommon", icon: "mon:bs_emberswarm", minFloor: 2,
    intro: () => ["岩の割れ目に、火の粉の虫がびっしりと巣を作っている。", "巣の奥には、虫が集めた光り物が山と積まれている。"],
    choices: (A, cell) => [
      { label: "巣を焼き払う ― 虫の群れと戦い、勝てば巣の中の上等な品", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_emberswarm", min: 3 }], "nest", { noChest: true });
      } },
      { label: "巣の外の光り物だけ拾う ― 金貨 / 30%で虫に群がられ全員に火傷", primary: true, fn: () => {
        A.gold(2.5, "虫の光り物");
        if (chance(0.3)) { A.hurtAll(0.1); A.sfx("trap"); A.toast("虫が群がってきた ― 全員が火傷を負った", "bad", "trap"); }
        A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.item({ rare: true }, "火の虫の巣", () => A.done(cell, next)),
  },
  {
    id: "l7_09", name: "釜番の亡霊", layer: 7, tier: "rare", icon: "mon:bs_cinderwraith", deep: true, minLv: 66,
    intro: () => ["大きな釜の前で、すすだらけの亡霊が、見えない薪をくべ続けている。", "「……三百年、わしはこの火の番をしてきた。釜の主の弱みなら、誰よりも知っておる」", "「教えてやろう。それとも、わしが貯めこんだ蓄えを持ってゆくか」"],
    choices: (A, cell) => [
      { label: "弱みを聞く ― 第7層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 7: true };
        A.sfx("spell");
        A.story("釜番の亡霊", ["「主は、釜の火から生まれた。釜の底の左の口から、火が細る。あそこを突けば、主の息が弱る」", "「……宰相さまは、三百年、少しもお変わりにならなかった。釜の火に手をかざしても、汗ひとつかかれなかったよ」", "第7層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "蓄えを受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "釜番の蓄え", () => A.done(cell)); } },
    ],
  },
  {
    id: "l7_10", name: "溶岩に沈む器", layer: 7, tier: "rare", icon: "event", deep: true,
    intro: () => ["溶岩の湖に、巨大な人業の器が胸まで沈んでいる。焼かれずに残った胸の奥で、魂がひとつ、かすかに灯っている。", "器の肩には、黒曜石の番兵がうずくまっている。"],
    choices: (A, cell) => [
      { label: "胸の魂を解き放つ ― 番兵と戦い、勝てば希少な魂と魂の残火", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_obsidianguard", strong: 1.8, name: "器の番兵" }], "vessel", { noChest: true });
      } },
      { label: "器の胸から宝を剥ぐ ― 上等な宝箱 (ランク+2) / 溶岩の熱で全員のHP2割を失う", primary: true, fn: () => {
        A.hurtAll(0.2); A.flash("#e07040"); A.sfx("trap");
        A.chestHere(cell, { rankUp: 2 });
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "溶岩に沈む器に囚われていた魂だ。", () => { A.ember(2, "器の胸の残火"); A.done(cell, next); }),
  },

  // ================= 第8層「氷結回廊」 (10) ── 第六章。奈落の壁にらせん状に張り出した氷の棚と、落ちてくる魂を閉じこめる氷 =================
  {
    id: "l8_01", name: "氷棚の落とし物", layer: 8, tier: "common", icon: "gold",
    intro: () => ["壁から張り出した氷の棚に、上から落ちてきた品がいくつも引っかかっている。", "棚の先は、底の見えない闇だ。下から凍える風が吹き上げてくる。"],
    choices: (A, cell) => {
      const c = A.check("agi");
      return [
        { label: `身を乗り出して拾う ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― 品 / 失敗で足を滑らせ、傷を負う`, primary: true, fn: () => {
          if (c.ok) { A.sfx("step"); A.item({}, "氷棚の落とし物", () => A.done(cell)); return; }
          if (c.who) { A.hurtOne(c.who, 0.2); A.sfx("trap"); A.toast(`${c.who.name}は氷に足を取られ、棚の縁に体を打ちつけた`, "bad", "trap"); }
          A.done(cell);
        } },
        { label: "氷ごと割り取る ― 金貨 / 25%で割れる音に魔物が寄ってくる", danger: true, fn: () => {
          if (chance(0.25)) { A.alarm("氷の割れる音が響いた！", ["音を聞きつけた魔物が、棚づたいに寄ってきた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "ledge", { noChest: true })); return; }
          A.gold(1.5, "氷の中の落とし物"); A.done(cell);
        } },
      ];
    },
    onWin: (A, cell, f, next) => { A.gold(2, "氷の中の落とし物"); A.done(cell, next); },
  },
  {
    id: "l8_02", name: "落ちてくる魂", layer: 8, tier: "common", icon: "wisp",
    intro: () => ["はるか上の闇から、青白い灯がひとつ、ゆっくりと落ちてくる。", "吹き上げる風にあおられて、灯は迷うように揺れている。"],
    choices: (A, cell) => [
      { label: "手のひらで受け止める ― ✦Soul", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1.5, "受け止めた魂の灯"); A.done(cell);
      } },
      { label: "風に乗せて送り出す ― ✦Soul を少しと、近くの骸に魂が宿る", fn: () => {
        A.sfx("heal"); A.soul(0.5, "送り出した魂の灯");
        if (A.warmCorpse()) A.toast("灯は風に乗り、近くの骸へ降りていった", "good", "corpseWarm");
        A.done(cell);
      } },
    ],
  },
  {
    id: "l8_03", name: "凍った泉", layer: 8, tier: "common", icon: "fountain",
    intro: () => ["厚い氷に閉じた泉。氷の下で、水はまだ静かに動いている。", "氷の奥で、誰かが投げ入れた品がにぶく光っている。"],
    choices: (A, cell) => [
      (anyHurt(A) || anyDrained(A)) && { label: "氷を割って水を飲む ― 全員のHP・MP3割回復 / 20%で冷たさに一人の体がしびれる", primary: true, fn: () => {
        A.healAll(0.3, 0.3, false); A.sfx("heal"); A.toast("身を切るように冷たい水が、体の芯を目覚めさせた", "good", "fountain");
        if (chance(0.2)) { const m = A.randomAlive(); if (m) { A.ail(m, "paralyze"); A.toast(`${m.name}は冷たさに手足がしびれた`, "bad", "trap"); } }
        A.done(cell);
      } },
      { label: "氷の下をさらう ― 収集品 / 指がかじかみ、全員のHPが少し減る", fn: () => {
        A.hurtAll(0.05); A.collectible("凍った泉", () => A.done(cell));
      } },
    ],
  },
  {
    id: "l8_04", name: "雪に埋もれた野営地", layer: 8, tier: "common", icon: "corpse",
    intro: () => ["吹きだまった雪の下から、天幕の骨組みがのぞいている。", "誰かがここで夜を明かし、そのまま戻らなかったらしい。"],
    choices: (A, cell) => [
      { label: "雪を掘り返す ― 品 / 25%で雪の下に眠る魔物", danger: true, fn: () => {
        if (chance(0.25)) { A.alarm("雪が盛り上がった！", ["雪の下で眠っていた魔物が、目を覚ました。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "snowcamp", { noChest: true })); return; }
        A.item({}, "雪の下の荷", () => A.done(cell));
      } },
      { label: "天幕の柱に名を刻んで弔う ― ✦Soul を少し", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1, "雪の下の弔い"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.item({}, "雪の下の荷", () => A.done(cell, next)),
  },
  {
    id: "l8_05", name: "氷の鏡", layer: 8, tier: "uncommon", icon: "event", minFloor: 2,
    intro: () => ["磨き上げたような氷の壁に、隊の姿が映っている。", "見つめていると、映った影のひとつが、ひとりでに武器を構えた。"],
    choices: (A, cell) => {
      const c = A.check("int");
      return [
        { label: `氷の奥をのぞきこむ ― ${c.who ? c.who.name : "誰か"} (成功 ${pctTxt(c.p)}) ― ✦Soul と、この階の宝箱の在処 / 失敗で氷に魔力を吸われる`, primary: true, fn: () => {
          if (!c.ok) { A.mpAll(0.3); A.sfx("trap"); A.toast("氷の奥の光に見入るうち、魔力を吸われた ― 全員のMPが減った", "bad", "trap"); A.done(cell); return; }
          A.soul(3, "氷の奥の光");
          const n = A.revealWhere((x) => x.type === "chest" && !x.cleared);
          A.toast(n ? `氷の奥に、この階の宝箱${n}つが映った` : "氷の奥には、もう何も映らなかった", n ? "good" : "info", "chest");
          A.done(cell);
        } },
        { label: "影と斬り結ぶ ― 隊の影 (五割の力) と戦い、勝てば ✦Soul と上等な品", danger: true, fn: () => {
          A.fight(cell, [{ shadows: 0.5 }], "icemirror", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => { A.soul(2, "氷の鏡の影"); A.item({ rare: true }, "氷の鏡の奥", () => A.done(cell, next)); },
  },
  {
    id: "l8_06", name: "氷に閉じこめられた宝箱", layer: 8, tier: "uncommon", icon: "chest",
    intro: () => ["分厚い氷の中に、宝箱がまるごと閉じこめられている。", "氷はかたい。刃で叩けば、大きな音が回廊に響くだろう。"],
    choices: (A, cell) => [
      A.aliveList().some((m) => m.mp > 0) && { label: "魔力の火で溶かす ― 全員のMPを3割使い、宝箱 (ランク+1)", primary: true, fn: () => {
        A.mpAll(0.3); A.sfx("spell"); A.toast("魔力の火が、氷をゆっくりと溶かした", "good", "chest");
        A.chestHere(cell, { rankUp: 1 });
      } },
      { label: "氷を叩き割る ― 宝箱 (ランク+1) / 40%で音を聞きつけた魔物と戦う", danger: true, fn: () => {
        if (chance(0.4)) { A.alarm("音が回廊に響きわたった！", ["氷を割る音を聞きつけて、魔物が集まってきた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "icebox", { noChest: true })); return; }
        A.sfx("hit"); A.chestHere(cell, { rankUp: 1 });
      } },
    ],
    onWin: (A, cell, f, next) => A.chestHere(cell, { rankUp: 1 }, next),
  },
  {
    id: "l8_07", name: "吹き上げる風穴", layer: 8, tier: "uncommon", icon: "stairs", minFloor: 2, maxSkip: 2,
    intro: () => ["床に開いた裂け目から、凍える風がうなりを上げて吹き上げている。", "身を任せれば、下の棚まで運ばれそうだ。ふさいでしまえば、この階は静かになるだろう。"],
    choices: (A, cell) => [
      { label: "風穴に飛びこむ ― ✦Soul と、この階を捨てて次の階へ / 風にもまれ、全員のHP1割を失う", danger: true, fn: () => {
        A.hurtAll(0.1); A.soul(2, "風に舞う魂のかけら");
        cell.cleared = true; A.sfx("stairs"); A.skipFloors(0);
      } },
      { label: "岩で風穴をふさぐ ― この階の間、奇襲を受けにくく (半分)、得る ✦Soul 1.2倍", primary: true, fn: () => {
        A.floorEv().mods.push({ src: "l8_07", name: "ふさいだ風穴", desc: "奇襲を受ける確率が半分・得る ✦Soul 1.2倍 (この階)", ambushMul: 0.5, soulMul: 1.2 });
        A.sfx("hit"); A.toast("風がやんだ ― この階の間、奇襲を受けにくく、得る ✦Soul が増える", "gold"); A.done(cell);
      } },
    ],
  },
  {
    id: "l8_08", name: "凍れる騎士の番所", layer: 8, tier: "uncommon", icon: "mon:bs_frostknight", deep: true,
    intro: () => ["通路の真ん中に、氷に覆われた騎士が槍を立てて立っている。", "兜の奥の目が、こちらを値踏みするように光った。", "「……通るなら、通り賃を置いてゆけ。それとも、腕で通るか」"],
    choices: (A, cell) => {
      const cost = A.goldCost(2);
      return [
        A.canPayGold(cost) && { label: `通り賃を置く (💰${cost}) ― 騎士が道を空け、階段の在処と ✦Soul`, primary: true, fn: () => {
          A.payGold(cost); A.revealStairs(); A.sfx("heal");
          A.soul(3, "番所の騎士の会釈"); A.toast("騎士は槍を引き、回廊の先を指した", "good", "stairs"); A.done(cell);
        } },
        { label: "腕で通る ― 番所の騎士と一騎打ち、勝てば上等な品 (レア以上)", danger: true, fn: () => {
          A.fight(cell, [{ key: "bs_frostknight", strong: 1.5, name: "番所の騎士" }], "gatekeeper", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.itemMinRar("r", "番所の騎士の武具", () => A.done(cell, next)),
  },
  {
    id: "l8_09", name: "氷の冠を見た者", layer: 8, tier: "rare", icon: "mon:bs_frozenexplorer", deep: true, minLv: 75,
    intro: () => ["半ば氷に埋もれた老人が、震える指で回廊の奥を指さしている。凍りきれずに残った、昔の誰かだ。", "「……奥の玉座に、氷の冠をかぶった王がおる。わしらを、ずっと見張っておるのだ」", "「冠のひびを教えてやろう。それとも、わしの持ち物を持ってゆくか」"],
    choices: (A, cell) => [
      { label: "冠のひびを聞く ― 第8層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 8: true };
        A.sfx("spell");
        A.story("氷の冠を見た者", ["「冠の左の、いちばん古い氷が溶けかけておる。あそこだけは、王にも凍らせ直せぬのだ」", "「……一年前にも、上から落ちてきた男がおった。玉座の前で、王と長いこと話しておったよ」", "第8層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "持ち物を受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "老人の持ち物", () => A.done(cell)); } },
    ],
  },
  {
    id: "l8_10", name: "魂をとじこめた氷柱", layer: 8, tier: "rare", icon: "wisp", deep: true,
    intro: () => ["天井から垂れた大きな氷柱の中に、小さな灯がいくつも閉じこめられている。", "灯は外へ出たがるように、氷の内側をたたいている。氷柱の根元には、氷でできた巨体がうずくまっている。"],
    choices: (A, cell) => [
      { label: "氷柱を割って灯を解き放つ ― 氷柱の番人と戦い、勝てば希少な魂と魂の残火", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_icegolem", strong: 1.8, name: "氷柱の番人" }], "icicle", { noChest: true });
      } },
      { label: "根元の黒い岩を砕いて分け合う ― この潜入の間、全員に土の護り (水の攻撃を和らげる) と ✦Soul / 冷気で全員のHP2割を失う", primary: true, fn: () => {
        A.hurtAll(0.2); A.flash("#a0d0f0");
        A.runEv().edef = { el: "earth", lv: 1 };
        A.sfx("spell"); A.soul(4, "氷柱の根の岩"); A.toast("岩のかけらが、冷気から身を守る ― この潜入の間、土の護り", "gold"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "氷柱に閉じこめられていた魂だ。", () => { A.ember(2, "氷柱の中の残火"); A.done(cell, next); }),
  },

  // ================= 第9層「毒沼」 (10) ── 第七章。奈落の底に広がる毒の沼。解けた氷の水が落ちてきて、底でよどむ =================
  {
    id: "l9_01", name: "沈んだ渡し舟", layer: 9, tier: "common", icon: "chest",
    intro: () => ["黒い泥に、古い渡し舟が半ば沈んでいる。舟底には、積み荷の木箱が残っているようだ。", "舟べりの板は、まだしっかりしている。"],
    choices: (A, cell) => [
      { label: "舟底の荷をさらう ― 品 / 25%で泥に潜む魔物", danger: true, fn: () => {
        if (chance(0.25)) { A.alarm("泥が盛り上がった！", ["舟の下の泥に、魔物が潜んでいた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "ferryboat", { noChest: true })); return; }
        A.item({}, "沈んだ渡し舟の荷", () => A.done(cell));
      } },
      A.countCells((c) => c.type === "poison") > 0 && { label: "舟板をはがして渡し板にする ― この階の沼の床 (毒の床) をすべて埋める", primary: true, fn: () => {
        const n = A.clearPoison(); A.sfx("step"); A.refresh();
        A.toast(`舟板を渡して、沼の床${n}か所を埋めた ― この階では毒の床を踏まない`, "good", "poison"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.item({}, "沈んだ渡し舟の荷", () => A.done(cell, next)),
  },
  {
    id: "l9_02", name: "黒いあぶく", layer: 9, tier: "common", icon: "wisp",
    intro: () => ["沼の底から、黒ずんだあぶくが浮かんでは弾けている。", "弾けるたびに、かすかなうめき声が聞こえる。あぶくの芯で、にごった灯がまたたいた。"],
    choices: (A, cell) => [
      { label: "あぶくの芯の灯をすくう ― ✦Soul / 30%で毒気にあたり、一人が毒", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1.5, "にごった灯");
        if (chance(0.3)) { const m = A.randomAlive(); if (m) { A.ail(m, "poison"); A.toast(`${m.name}はあぶくの毒気にあてられた`, "bad", "poison"); } }
        A.done(cell);
      } },
      { label: "あぶくの湧く底を探る ― 収集品 / 毒気で全員のHPが少し減る", fn: () => {
        A.hurtAll(0.05); A.collectible("あぶくの湧く底", () => A.done(cell));
      } },
    ],
  },
  {
    id: "l9_03", name: "白い花の草むら", layer: 9, tier: "common", icon: "fountain",
    intro: () => ["毒の霧の中で、そこだけ白い花が咲いている。", "花の香りをかぐと、のどの奥のひりつきが少し引いた。根元の泥には、何かが埋まっている。"],
    choices: (A, cell) => [
      (anyHurt(A) || anyAiling(A)) && { label: "花をかんで毒を払う ― 全員の状態異常が治り、HP2割回復", primary: true, fn: () => {
        A.healAll(0.2, 0, true); A.sfx("heal"); A.toast("苦い花の汁が、体の毒を洗い流した", "good", "fountain"); A.done(cell);
      } },
      { label: "根元を掘る ― 品 / 25%で花に化けた屍肉花が襲う", danger: true, fn: () => {
        if (chance(0.25)) { A.alarm("花が口を開いた！", ["白い花のあいだに、屍肉花がまぎれていた。"], "trap", () => A.fight(cell, [{ key: "bs_corpseflower", min: 2 }], "whiteflower", { noChest: true })); return; }
        A.item({}, "草むらの根元", () => A.done(cell));
      } },
    ],
    onWin: (A, cell, f, next) => A.item({}, "草むらの根元", () => A.done(cell, next)),
  },
  {
    id: "l9_04", name: "ヒルのたかる骸", layer: 9, tier: "common", icon: "corpse",
    intro: () => ["沼のふちに、旅人の骸が倒れている。体じゅうに、黒いヒルがびっしりとたかっている。", "腰の袋は、まだ重そうだ。"],
    choices: (A, cell) => [
      { label: "ヒルを払って袋を取る ― 金貨 / 30%でヒルの群れが襲う", danger: true, fn: () => {
        if (chance(0.3)) { A.alarm("ヒルが一斉に跳ねた！", ["骸にたかっていたヒルが、隊へ群がってきた。"], "trap", () => A.fight(cell, [{ key: "bs_leechswarm", min: 2 }], "leech", { noChest: true })); return; }
        A.gold(2, "旅人の袋"); A.done(cell);
      } },
      { label: "骸を沼に沈めて弔う ― ✦Soul を少し", primary: true, fn: () => {
        A.sfx("heal"); A.soul(1, "沼の弔い"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "旅人の袋"); A.done(cell, next); },
  },
  {
    id: "l9_05", name: "作りかけの人業", layer: 9, tier: "uncommon", icon: "mon:bs_discardeddoll", minFloor: 2,
    intro: () => ["泥の中に、手足のそろわない人業が横たわっている。", "胸は空っぽで、魂の灯をともす台座だけが、ぽっかりと口を開けている。"],
    choices: (A, cell) => [
      A.embers() > 0 && { label: "胸の台座に魂の残火を1つ灯す ― 器がしばし起き上がり、この階の階段と宝箱の在処を示す・✦Soul", primary: true, fn: () => {
        A.payEmber(1); A.revealStairs();
        const n = A.revealWhere((x) => x.type === "chest" && !x.cleared);
        A.sfx("spell"); A.soul(4, "灯を得た器");
        A.toast(n ? `器は階段と宝箱${n}つを指さし、静かに崩れた` : "器は階段を指さし、静かに崩れた", "good", "stairs");
        A.done(cell);
      } },
      { label: "器をばらして部品を取る ― 上等な品 / 40%で器が起き上がり、襲いかかる", danger: true, fn: () => {
        if (chance(0.4)) { A.alarm("器が起き上がった！", ["空っぽの胸のまま、器は腕を振り上げた。"], "trap", () => A.fight(cell, [{ key: "bs_discardeddoll", strong: 1.3, name: "作りかけの人業" }], "unfinished", { noChest: true })); return; }
        A.item({ rare: true }, "作りかけの人業", () => A.done(cell));
      } },
    ],
    onWin: (A, cell, f, next) => A.item({ rare: true }, "作りかけの人業", () => A.done(cell, next)),
  },
  {
    id: "l9_06", name: "霧の上の枯れ木", layer: 9, tier: "uncommon", icon: "event", minFloor: 2,
    intro: () => ["沼の真ん中から、枯れた大木が突き出している。", "幹のうろは乾いていて、霧も届かない。枝の上まで登れば、沼を見渡せそうだ。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "幹のうろで休む ― 全員のHP・MP5割回復・状態異常が治る", fn: () => {
        A.healAll(0.5, 0.5, true); A.sfx("heal"); A.toast("乾いたうろの中で、しばし息をついた", "good", "fountain"); A.done(cell);
      } },
      { label: "枝の上から沼を見渡す ― この階の魔物と階段の在処が見え、✦Soul", primary: true, fn: () => {
        const n = A.revealWhere((x) => x.type === "monster" && !x.cleared);
        A.revealStairs(); A.sfx("step"); A.soul(2, "霧の上の眺め");
        A.toast(n ? `霧の切れ間に、魔物${n}つと階段が見えた` : "霧の切れ間に、階段が見えた", "good", "stairs");
        A.done(cell);
      } },
    ],
  },
  {
    id: "l9_07", name: "杭の上の小屋", layer: 9, tier: "uncommon", icon: "mon:bs_swamphag", deep: true,
    intro: () => ["沼に打ちこんだ杭の上に、傾いた小屋が建っている。中では、魔女が大きな鍋をかき混ぜている。", "「毒には毒、さ。おまえさんたちの刃に、とびきりのを塗ってやろうか。……ただじゃないがね」"],
    choices: (A, cell) => {
      const cost = A.goldCost(3);
      return [
        A.canPayGold(cost) && { label: `刃に毒を塗ってもらう (💰${cost}) ― この潜入の間、与ダメ+10%`, primary: true, fn: () => {
          A.payGold(cost);
          A.runEv().mods = [...(A.runEv().mods || []), { src: "l9_07", name: "魔女の毒の刃", desc: "与えるダメージ +10% (この潜入)", dmgMul: 1.1 }];
          A.sfx("spell"); A.toast("刃が緑にぬめった ― この潜入の間、与ダメ+10%", "gold"); A.done(cell);
        } },
        { label: "鍋をひっくり返す ― 沼の魔女と一騎打ち、勝てば上等な品 (レア以上)", danger: true, fn: () => {
          A.fight(cell, [{ key: "bs_swamphag", strong: 1.5, name: "小屋の魔女" }], "hagpot", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.itemMinRar("r", "魔女のため込んだ品", () => A.done(cell, next)),
  },
  {
    id: "l9_08", name: "上から落ちる滝", layer: 9, tier: "uncommon", icon: "fountain",
    intro: () => ["はるか上の闇から、細い滝が沼へ落ちてくる。上で解けた氷の水だ。", "落ちてくる水は、まだにごっていない。滝の裏には、小さな洞があるようだ。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "澄んだ滝の水を浴びる ― 全員のHP・MP4割回復・状態異常が治る", primary: true, fn: () => {
        A.healAll(0.4, 0.4, true); A.sfx("heal"); A.toast("冷たく澄んだ水が、沼の毒を洗い流した", "good", "fountain"); A.done(cell);
      } },
      { label: "滝の裏の洞をのぞく ― 宝箱 (ランク+1) / 滝に打たれ、全員のHP1割を失う", fn: () => {
        A.hurtAll(0.1); A.sfx("trap"); A.chestHere(cell, { rankUp: 1 });
      } },
    ],
  },
  {
    id: "l9_09", name: "舟を待つ渡し守", layer: 9, tier: "rare", icon: "mon:bs_bogdrowned", deep: true, minLv: 83,
    intro: () => ["沼の岸の杭に、ずぶぬれの亡霊が腰かけている。手には、消えかけた渡し守の灯。", "「……よどみの底には、主がおる。沼に沈んだものを呑みこんで、ふくれあがった主だ」", "「主の古い傷を教えてやろう。それとも、わしの舟に残った荷を持ってゆくか」"],
    choices: (A, cell) => [
      { label: "古い傷を聞く ― 第9層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 9: true };
        A.sfx("spell");
        A.story("舟を待つ渡し守", ["「主の背の、泥のいちばん薄いところ。あそこだけは、昔の傷がふさがっておらん」", "「……一年前にも、脚を引きずった男が上から降りてきた。わしの舟を借りて、霧の向こうへ渡っていった。舟は、まだ返ってこん」", "第9層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "舟に残った荷を受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "渡し守の舟の荷", () => A.done(cell)); } },
    ],
  },
  {
    id: "l9_10", name: "腐りきらぬ魂の泡", layer: 9, tier: "rare", icon: "wisp", deep: true,
    intro: () => ["沼の底から、大きな泡がゆっくりとふくらんでいる。泡の中には、にごりきらずに残った灯がいくつも閉じこめられている。", "泡の上には、汚泥の巨塊が重たくのしかかっている。"],
    choices: (A, cell) => [
      { label: "泡を割って灯を救う ― 泡の番人と戦い、勝てば希少な魂と上等な宝箱", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_toxicgolem", strong: 1.8, name: "泡の番人" }], "soulbubble", { noChest: true });
      } },
      { label: "泡の膜を切り取って身にまとう ― この潜入の間、全員に風の護り (土の攻撃を和らげる) と ✦Soul / 毒気で全員が毒にかかる", primary: true, fn: () => {
        A.ailAll("poison", 1); A.flash("#7a9a3a");
        A.runEv().edef = { el: "wind", lv: 1 };
        A.sfx("spell"); A.soul(4, "泡の膜"); A.toast("泡の膜が、泥の重さをはじく ― この潜入の間、風の護り", "gold"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "泡の中に閉じこめられていた魂だ。", () => A.chestHere(cell, { rankUp: 2 }, next)),
  },

  // ================= 第10層「嵐の尖塔」 (10) ── 第八章。沼の島の工房の奥から、奈落を上へ伸びる塔。嵐と雷が絶えず渦を巻く =================
  {
    id: "l10_01", name: "落雷の跡", layer: 10, tier: "common", icon: "chest",
    intro: () => ["床の石が、黒く焦げて割れている。雷の落ちた跡だ。", "割れ目の中で、雷に溶かされて固まった、ガラスのようなものが光っている。"],
    choices: (A, cell) => [
      { label: "割れ目を掘る ― 品 / 25%で雷に呼ばれた魔物", danger: true, fn: () => {
        if (chance(0.25)) { A.alarm("また雷が落ちた！", ["青白い光の中から、魔物が飛び出してきた。"], "trap", () => A.fight(cell, [{ pool: true, min: 2 }], "boltmark", { noChest: true })); return; }
        A.item({}, "落雷の跡", () => A.done(cell));
      } },
      { label: "溶けたガラスを拾う ― 収集品", primary: true, fn: () => { A.collectible("落雷の跡", () => A.done(cell)); } },
    ],
    onWin: (A, cell, f, next) => A.item({}, "落雷の跡", () => A.done(cell, next)),
  },
  {
    id: "l10_02", name: "回る風見", layer: 10, tier: "common", icon: "stairs",
    intro: () => ["窓の外の張り出しで、錆びた鉄の風見がきしみながら回っている。", "風見はときどき止まって、同じ方角を指す。風の吹き上げてくる方角だ。"],
    choices: (A, cell) => [
      { label: "風見の指すほうを見る ― この階の階段の在処が見え、✦Soul を少し", primary: true, fn: () => {
        A.revealStairs(); A.sfx("step"); A.soul(1, "風の行方"); A.toast("風の吹き上げる先に、階段が見えた", "good", "stairs"); A.done(cell);
      } },
      { label: "風見を外して持ち帰る ― 金貨 / 30%で突風にあおられ、全員のHP1割を失う", fn: () => {
        if (chance(0.3)) { A.hurtAll(0.1); A.toast("突風にあおられ、手すりに叩きつけられた", "bad"); }
        A.gold(2, "古い鉄の風見"); A.done(cell);
      } },
    ],
  },
  {
    id: "l10_03", name: "雨受けの甕", layer: 10, tier: "common", icon: "fountain",
    intro: () => ["窓の下に、雨水を受ける大きな甕が置かれている。", "水は澄んでいるが、ときどき水面に小さな火花が走る。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "雨水を飲む ― 全員のHP・MP3割回復", primary: true, fn: () => {
        A.healAll(0.3, 0.3); A.sfx("heal"); A.toast("冷たい雨水が、のどを潤した", "good", "fountain"); A.done(cell);
      } },
      { label: "甕の底をさらう ― ✦Soul / 20%で帯電した水に触れ、一人が麻痺", fn: () => {
        A.sfx("heal"); A.soul(1.5, "甕の底の灯");
        if (chance(0.2)) { const m = A.randomAlive(); if (m) { A.ail(m, "paralyze"); A.toast(`${m.name}は水の中の雷に痺れた`, "bad", "paralyze"); } }
        A.done(cell);
      } },
    ],
  },
  {
    id: "l10_04", name: "手すりに掛かった荷", layer: 10, tier: "common", icon: "corpse",
    intro: () => ["吹きさらしの手すりに、旅人の背負い袋が引っかかって揺れている。", "袋のまわりを、黒い鴉が何羽も旋回している。"],
    choices: (A, cell) => [
      { label: "鴉を追い払って袋を取る ― 金貨 / 30%で鴉の群れが襲う", danger: true, fn: () => {
        if (chance(0.3)) { A.alarm("鴉が一斉に舞い降りた！", ["空が黒く染まるほどの群れが、隊へ殺到してきた。"], "trap", () => A.fight(cell, [{ key: "bs_ravenswarm", min: 2 }], "ravenpack", { noChest: true })); return; }
        A.gold(2, "旅人の背負い袋"); A.done(cell);
      } },
      { label: "袋の持ち主を弔う ― ✦Soul を少し", primary: true, fn: () => { A.sfx("heal"); A.soul(1, "風の中の弔い"); A.done(cell); } },
    ],
    onWin: (A, cell, f, next) => { A.gold(2, "旅人の背負い袋"); A.done(cell, next); },
  },
  {
    id: "l10_05", name: "止まった風車", layer: 10, tier: "uncommon", icon: "event", minFloor: 2,
    intro: () => ["塔の壁から、大きな木の風車が突き出している。羽根は止まり、軸には鎖が巻きついている。", "鎖を外せば回りそうだ。軸の奥には、古い歯車が見える。"],
    choices: (A, cell) => [
      A.aliveList().some((m) => m.mp > 0) && { label: "魔力で鎖を焼き切る ― 全員のMPを3割使い、風車が回ってこの階の魔物と宝箱の在処が見え、✦Soul", primary: true, fn: () => {
        A.mpAll(0.3);
        const n = A.revealWhere((x) => (x.type === "monster" || x.type === "chest") && !x.cleared);
        A.sfx("spell"); A.soul(3, "風車の運んだ魂");
        A.toast(n ? `回りだした風車が、風で${n}か所の在処を知らせた` : "回りだした風車が、塔に風を通した", "good", "stairs"); A.done(cell);
      } },
      { label: "軸の歯車を外す ― 上等な品 / 40%で風車の番の雷光の巨像が起き上がる", danger: true, fn: () => {
        if (chance(0.4)) { A.alarm("歯車がうなりを上げた！", ["風車の陰から、雷をまとった巨像が立ち上がった。"], "trap", () => A.fight(cell, [{ key: "bs_lightninggolem", strong: 1.3, name: "風車の番" }], "windmill", { noChest: true })); return; }
        A.item({ rare: true }, "風車の歯車", () => A.done(cell));
      } },
    ],
    onWin: (A, cell, f, next) => A.item({ rare: true }, "風車の歯車", () => A.done(cell, next)),
  },
  {
    id: "l10_06", name: "雷を溜めた甕", layer: 10, tier: "uncommon", icon: "wisp", minFloor: 2,
    intro: () => ["銅の線を巻いた黒い甕が、塔の壁にいくつも並んでいる。", "ふたの隙間から、青白い光がもれている。中に、雷が溜めてあるのだ。"],
    choices: (A, cell) => [
      A.aliveList().some((m) => m.mp > 0) && { label: "甕の雷を武器に移す ― 全員のMPを2割使い、この潜入の間、会心率 +5%", primary: true, fn: () => {
        A.mpAll(0.2); A.runEv().crit = (A.runEv().crit || 0) + 0.05;
        A.sfx("spell"); A.toast("刃に雷が宿った ― この潜入の間、会心率 +5%", "gold"); A.done(cell);
      } },
      { label: "甕を割る ― 宝箱 (ランク+1) / 雷が弾けて全員のHP2割を失う", danger: true, fn: () => {
        A.hurtAll(0.2); A.flash("#d8e0ff"); A.sfx("trap"); A.chestHere(cell, { rankUp: 1 });
      } },
    ],
  },
  {
    id: "l10_07", name: "嵐を読む老婆", layer: 10, tier: "uncommon", icon: "mon:bs_stormhag", deep: true,
    intro: () => ["窓辺の揺り椅子に、雷雲をまとった老婆が座っている。", "「嵐の中で迷う者は、風の読み方を知らんのさ。……教えてやろうか。ただじゃないがね」"],
    choices: (A, cell) => {
      const cost = A.goldCost(3);
      return [
        A.canPayGold(cost) && { label: `風の読み方を教わる (💰${cost}) ― この潜入の間、奇襲を受けにくい (半分)`, primary: true, fn: () => {
          A.payGold(cost);
          A.runEv().mods = [...(A.runEv().mods || []), { src: "l10_07", name: "嵐の読み方", desc: "奇襲を受ける確率が半分 (この潜入)", ambushMul: 0.5 }];
          A.sfx("spell"); A.toast("風の匂いで、魔物の気配がわかるようになった ― この潜入の間、奇襲を受けにくい", "gold"); A.done(cell);
        } },
        { label: "揺り椅子の杖を奪う ― 嵐を読む老婆と一騎打ち、勝てば上等な品 (レア以上)", danger: true, fn: () => {
          A.fight(cell, [{ key: "bs_stormhag", strong: 1.5, name: "嵐を読む老婆" }], "stormhag", { noChest: true });
        } },
      ];
    },
    onWin: (A, cell, f, next) => A.itemMinRar("r", "老婆の杖に吊るされた品", () => A.done(cell, next)),
  },
  {
    id: "l10_08", name: "雲海の見える窓", layer: 10, tier: "uncommon", icon: "fountain",
    intro: () => ["塔の壁に、大きな窓が開いている。窓の外は、一面の雲の海だ。", "雲の下で、雷が音もなく光っている。窓の外の張り出しには、何かが引っかかっている。"],
    choices: (A, cell) => [
      needsCare(A) && { label: "窓辺で雲海を眺めて休む ― 全員のHP・MP4割回復・状態異常が治る", primary: true, fn: () => {
        A.healAll(0.4, 0.4, true); A.sfx("heal"); A.toast("雲の海を眺めるうちに、息が整った", "good", "fountain"); A.done(cell);
      } },
      { label: "窓の外の張り出しへ出る ― 宝箱 (ランク+1) / 突風に吹かれ、一人が麻痺", fn: () => {
        const m = A.randomAlive(); if (m) { A.ail(m, "paralyze"); A.toast(`${m.name}は突風に打たれて痺れた`, "bad", "paralyze"); }
        A.sfx("trap"); A.chestHere(cell, { rankUp: 1 });
      } },
    ],
  },
  {
    id: "l10_09", name: "頂を見上げる鐘番", layer: 10, tier: "rare", icon: "mon:bs_boltarcher", deep: true, minLv: 92,
    intro: () => ["階段の途中に、鐘の綱を握ったままの亡霊が座りこんでいる。", "「……頂には、主がおる。雷雲が寄り集まって、ふくれあがった主だ」", "「主の渦の弱いところを教えてやろう。それとも、わしの鐘番小屋に残った品を持ってゆくか」"],
    choices: (A, cell) => [
      { label: "渦の弱いところを聞く ― 第10層の主の力を削ぐ (最大HP-10%)", primary: true, fn: () => {
        A.flags().bossWeak = { ...(A.flags().bossWeak || {}), 10: true };
        A.sfx("spell");
        A.story("頂を見上げる鐘番", ["「主の渦は、鐘が鳴る一瞬だけ、芯がゆるむ。そこを突け」", "「……一年前にも、杖をなくした男が、鎖を伝って登っていった。わしの鐘の綱を、少しだけ貸してやった」", "第10層の主の最大HPが1割削られる (討つまで有効)。"], () => A.done(cell));
      } },
      { label: "鐘番小屋の品を受け取る ― 上等な品 (レア以上)", fn: () => { A.sfx("itemget"); A.itemMinRar("r", "鐘番小屋の品", () => A.done(cell)); } },
    ],
  },
  {
    id: "l10_10", name: "魂を抱えた像", layer: 10, tier: "rare", icon: "wisp", deep: true,
    intro: () => ["鎖の腕をもつ石の像が、通路をふさいで立っている。", "像の胸の中で、いくつもの魂の光が、出口を探すように渦を巻いている。"],
    choices: (A, cell) => [
      { label: "像を砕いて魂を解き放つ ― 像の番人と戦い、勝てば希少な魂と魂の残火2", danger: true, fn: () => {
        A.fight(cell, [{ key: "bs_soulanchor", strong: 1.8, name: "像の番人" }], "anchorstatue", { noChest: true });
      } },
      { label: "像の鎖を一本外して身に巻く ― この潜入の間、全員に火の護り (風の攻撃を和らげる) と ✦Soul / 鎖の雷で全員のHP2割を失う", primary: true, fn: () => {
        A.hurtAll(0.2); A.flash("#d8e0ff");
        A.runEv().edef = { el: "fire", lv: 1 };
        A.sfx("spell"); A.soul(4, "鎖に残った魂の熱"); A.toast("焼けた鎖が、風の刃をはじく ― この潜入の間、火の護り", "gold"); A.done(cell);
      } },
    ],
    onWin: (A, cell, f, next) => A.soulDrop("rarePlus", "像に縛られていた魂だ。", () => { A.ember(2, "像の胸の残火"); A.done(cell, next); }),
  },
];

// 各迷宮に固有の極を1件。既存IDは見聞録・取得済みセーブのため維持する。
const DUNGEON_GIFTS = [
  ["w02", "hp", 5, "回廊の消えない灯"],
  ["w03", "crit", 0.01, "墓地の黒猫", "l1_10"],
  ["w04", "mp", 5, "王都の下水図", "l2_10"],
  ["w05", "atk", 2, "地の底の鍛冶場", "l3_10"],
  ["w06", "vit", 2, "外郭の守り火"],
  ["w07", "pie", 2, "地下牢の祈り"],
  ["w08", "agi", 2, "雷雨を渡る影"],
  ["w09", "luk", 2, "最後の点呼", "l4_10"],
  ["w10", "hp", 5, "縦穴の命の根"],
  ["w11", "int", 2, "霧森の知恵の灯"],
  ["w12", "mp", 5, "苗床の澄んだ樹液"],
  ["w13", "atk", 2, "大樹の魂の枝"],
  ["ws1", "pie", 2, "操霊師の遺書", "c30"],
  ["ws2", "vit", 2, "石切り場の眠る盾"],
  ["ws3", "agi", 2, "森の古老", "l5_07"],
  ["ws4", "int", 2, "銀業の記憶の結晶"],
  // 第四章・第五章 (第6層・第7層)。件数の少ない会心・LUK から、ほかは1件ずつ
  ["w14", "mp", 5, "参道の沈まぬ灯籠"],
  ["w15", "pie", 2, "聖歌隊長の祈り"],
  ["w16", "hp", 5, "洗礼の泉の一滴"],
  ["w17", "int", 2, "大神殿の古い祈りの書"],
  ["ws5", "luk", 2, "願いの底の古銭"],
  ["w18", "atk", 2, "噴き火に鍛えた鉄"],
  ["w19", "agi", 2, "灰の雨を渡る羽"],
  ["w20", "vit", 2, "焼きしめた器の欠片"],
  ["w21", "crit", 0.01, "大釜の底の火種"],
  // 第六章 (第8層)。件数の少ない LUK・会心から、ほかは HP・MP
  ["w22", "luk", 2, "氷棚に引っかかった古銭"],
  ["w23", "crit", 0.01, "凍れる剣士の最後の一太刀"],
  ["w24", "hp", 5, "極光の命の雫"],
  ["w25", "mp", 5, "凍王の溶けない魔力"],
  // 各層の寄り道 (ws6〜ws8)。どの効果も4件になるよう割り当てる
  ["ws6", "vit", 2, "最後の火の番の盾"],
  ["ws7", "luk", 2, "押収品の古いお守り"],
  ["ws8", "int", 2, "沈んだ書庫の写本"],
  ["ws9", "atk", 2, "黒曜の刃のかけら"],
  ["ws10", "pie", 2, "火守りの最後の祈り"],
  ["ws11", "agi", 2, "白狼の足あと"],
  ["ws12", "crit", 0.01, "氷の割れ目を見抜く目"],
  // 第七章 (第9層)。どの効果も4件だったので、6つの効果を5件に (残る MP・INT・会心は4件)
  ["w26", "vit", 2, "岸に打ち上げられた古い盾"],
  ["w27", "atk", 2, "器の山に埋もれた鉄の拳"],
  ["w28", "agi", 2, "葦を渡る水鳥の羽"],
  ["w29", "hp", 5, "腐らずに残った魂の灯"],
  ["ws13", "pie", 2, "塚の底の弔いの鐘"],
  ["ws14", "luk", 2, "渡し守の銅貨"],
  // 第八章 (第10層)。4件の MP・INT・会心から、ほかは HP・AGI・VIT・PIE (どの効果も5件か6件)
  ["w30", "mp", 5, "螺旋を昇る魔力の風"],
  ["w31", "int", 2, "鐘の銘の古い知恵"],
  ["w32", "crit", 0.01, "稲妻を見切る目"],
  ["w33", "hp", 5, "頂の消えない種火"],
  ["ws15", "agi", 2, "雷鳥の風切り羽"],
  ["ws16", "vit", 2, "避雷針の鉄の芯"],
  ["ws17", "pie", 2, "雲上の庭の祈りの花"],
];
for (const [dungeonId, stat, amount, name, legacyId] of DUNGEON_GIFTS) {
  const dungeon = WORLD.find((d) => d.id === dungeonId);
  // 台帳にまだ無い迷宮 (並行して足している途中) は飛ばす。抜けは tools/balance/event-boons.mjs が件数で見つける
  if (!dungeon) continue;
  const id = legacyId || `mythic_${dungeonId}`;
  let e = EVENTS.find((e) => e.id === id);
  if (!e) {
    e = { id, name, layer: dungeon.layer, tier: "mythic", icon: "event", once: true,
      intro: () => [`${dungeon.name}の奥に、淡く光るものが残されていた。`,
        "手を伸ばすと、古い魂の力が隊の一人ひとりへ流れ込んだ。"] };
    EVENTS.push(e);
  }
  const label = stat === "crit" ? "会心率 +1%" : `${stat.toUpperCase()} +${amount}`;
  e.dungeonId = dungeonId;
  e.statBonus = { [stat]: amount };
  e.boon = `${name} ― 全職業の${label} (永続)`;
  delete e.minLv; delete e.deep;
  e.gift = (A) => {
    // 取得済みIDから導出するため、再計算・再読込で重複加算しない。
    A.flags().statGiftVersion = 1;
    A.recalcPermanent();
    A.sfx("heal");
    return ["授かった力は、街へ戻っても失われない。", `✺ ${e.boon}`];
  };
}

export function permanentEventStats(once = {}) {
  const stats = { hp: 0, mp: 0, atk: 0, vit: 0, agi: 0, int: 0, pie: 0, luk: 0, crit: 0 };
  for (const e of EVENTS) if (e.statBonus && once[e.id]) {
    for (const [key, value] of Object.entries(e.statBonus)) stats[key] += value;
  }
  return stats;
}

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
// 定義の検査 (読み込み時): 重複id・格・層の誤りは即座に知らせる
(() => {
  if (Object.keys(EVENT_MAP).length !== EVENTS.length) throw new Error("events.js: 重複したイベントidがある");
  for (const e of EVENTS) {
    if (!EV_TIERS[e.tier]) throw new Error(`events.js: ${e.id} の tier が不正`);
    if (typeof e.intro !== "function") throw new Error(`events.js: ${e.id} に intro がない`);
    // 極は選択肢なし (gift で恒久の恵みを授ける・セーブで一度きり)、それ以外は選択式
    if (e.tier === "mythic" ? (typeof e.gift !== "function" || e.choices || e.once !== true || !e.boon) : typeof e.choices !== "function") throw new Error(`events.js: ${e.id} の choices/gift が不正`);
  }
})();

// 見聞録の区分 (共通 / 層ごと)
export const EVENT_GROUPS = [
  { key: "0", label: "共通", name: "共通", layer: 0 },
  { key: "1", label: "墓地", name: "第1層 墓地", layer: 1 },
  { key: "2", label: "水路", name: "第2層 地下水路", layer: 2 },
  { key: "3", label: "廃坑", name: "第3層 廃坑", layer: 3 },
  { key: "4", label: "捨て砦", name: "第4層 捨て砦", layer: 4 },
  { key: "5", label: "霧の森", name: "第5層 霧の森", layer: 5 },
  { key: "6", label: "大神殿", name: "第6層 沈んだ大神殿", layer: 6 },
  { key: "7", label: "火の洞", name: "第7層 灼熱の洞", layer: 7 },
  { key: "8", label: "氷回廊", name: "第8層 氷結回廊", layer: 8 },
  { key: "9", label: "毒沼", name: "第9層 毒沼", layer: 9 },
  { key: "10", label: "尖塔", name: "第10層 嵐の尖塔", layer: 10 },
];

// 出現条件の説明 (見聞録用)
export function eventWhereText(e) {
  const parts = [e.dungeonId ? WORLD.find((d) => d.id === e.dungeonId).name + "のみ" : e.layer ? `第${e.layer}層のみ` : "どの層でも"];
  if (e.minLv) parts.push(`推奨Lv${e.minLv}以降`);
  if (e.deep) parts.push("迷宮の後半の階");
  else if (e.minFloor && e.minFloor > 1) parts.push(`B${e.minFloor}F以降`);
  if (e.tier === "rare") parts.push("1回の潜入で1度まで");
  if (e.once === "layer") parts.push("各層で一度きり");
  else if (e.once) parts.push("一度きり");
  return parts.join(" ・ ");
}

// ===== 置き場所と抽選 =====
// st: { dungeonId, layer, lv, first, floor, floors, abyss, runEv, onceDone(e) }。出せるイベントを重み付きで1つ選ぶ (無ければ null)
export function eligibleEvents(st, A) {
  const deepNow = st.floor > st.floors / 2;
  return EVENTS.filter((e) => {
    if (st.abyss) return false;
    if (e.dungeonId && e.dungeonId !== st.dungeonId) return false;
    if (e.layer && e.layer !== st.layer) return false;
    if (st.first && e.tier !== "common") return false;              // 最初の迷宮は常のみ
    if (e.minFloor && st.floor < e.minFloor) return false;
    if (e.deep && !deepNow) return false;
    if (e.minLv && st.lv < e.minLv) return false;
    if (e.maxSkip != null && st.floor + e.maxSkip >= st.floors) return false; // 先に必要な階が無い
    if (e.tier === "rare" && st.runEv.rareUsed && st.runEv.rareUsed[e.id]) return false;
    if (e.once && st.onceDone(e)) return false;
    if (e.cond && A && !e.cond(A)) return false;
    return true;
  });
}
// 2段階の抽選: まず格 (常/稀/秘/極) を EV_TIERS.share の割合で選び (その場に出せる格だけで按分)、
// 次にその格の中から1つ選ぶ (その層の専用イベントは ×LAYER_W)。出来事の数が増えても格の出やすさは変わらない
export function pickEvent(list) {
  if (!list.length) return null;
  const byTier = {};
  for (const e of list) (byTier[e.tier] = byTier[e.tier] || []).push(e);
  const tiers = Object.keys(byTier);
  let tt = 0;
  for (const k of tiers) tt += EV_TIERS[k].share;
  let x = Math.random() * tt, tier = tiers[tiers.length - 1];
  for (const k of tiers) { x -= EV_TIERS[k].share; if (x <= 0) { tier = k; break; } }
  const pool = byTier[tier];
  let total = 0;
  const acc = pool.map((e) => { total += e.layer ? LAYER_W : 1; return [e, total]; });
  const y = Math.random() * total;
  return (acc.find(([, t]) => y <= t) || acc[acc.length - 1])[0];
}
// 一度きりの判定に使う鍵 (層ごと一度なら層つき)
export function onceKey(e, layer) { return e.once === "layer" ? `${e.id}:${layer}` : e.id; }

// ===== 進行 =====
// マスを踏んだ時: 選択の札を出す。戦闘から逃げて戻った時は再戦を問う。
export function runEvent(A, cell) {
  const e = EVENT_MAP[cell.evId];
  if (!e) { A.done(cell); return; }
  // 勝った戦闘の続きが保存されたまま中断していた (勝利直後にアプリが落ちた等)
  if (cell.evFight && cell.evFight.won) { const f = cell.evFight; cell.evFight = null; if (e.onWin) e.onWin(A, cell, f, () => A.back()); else A.done(cell); return; }
  // 出来事の戦闘から逃げて戻ってきた
  if (cell.evFight) {
    const f = cell.evFight;
    A.choice(`${e.name} ― まだ片付いていない`, [
      { label: "再び挑む", danger: true, fn: () => A.refight(cell) },
      { label: "立ち去る (この出来事を諦める)", cancel: true, fn: () => { cell.evFight = null; A.done(cell); } },
    ], A.icon(e), { banner: EV_TIERS[e.tier].banner, accent: e.accent || EV_TIERS[e.tier].accent, lines: [f.tag ? "魔物はまだそこにいる。" : ""].filter(Boolean) });
    return;
  }
  // 誓い・頼みの最中 (石碑や亡霊を踏み直した)
  if (e.pending) {
    const p = e.pending(A, cell);
    if (p) { A.toast(p, "info", e.icon === "event" ? "event" : null); A.back(); return; }
  }
  A.seen(e, cell);
  // 極: 選択肢は無く、踏んだその場で恒久の恵みを授かる (一度きり)。授け済みのマスを踏み直したら片付けるだけ
  if (e.gift) {
    if (cell.evGiven) { A.done(cell); return; }
    cell.evGiven = true;
    A.picked(e, "恵みを授かった");
    const lines = e.gift(A, cell) || [];
    const t = EV_TIERS[e.tier];
    A.gift(e.name, [...e.intro(A, cell), ...lines], A.icon(e), { banner: t.banner, accent: e.accent || t.accent }, () => A.done(cell));
    return;
  }
  const opts = (e.choices(A, cell) || []).filter(Boolean).map((o) => ({ ...o, fn: () => { A.picked(e, o.label); o.fn(); } }));
  if (!e.noLeave) opts.push({ label: e.leaveLabel || "立ち去る", cancel: true, fn: () => { A.log(`${e.name}を後にした。`, "sys"); A.back(); } });
  const tier = EV_TIERS[e.tier];
  A.choice(e.name, opts, A.icon(e), { banner: tier.banner, accent: e.accent || tier.accent, lines: e.intro(A, cell) });
}
// 出来事の戦闘に勝った (戦果シートの後に呼ばれる)
export function eventFightWon(A, cell, next) {
  const e = EVENT_MAP[cell.evId];
  const f = cell.evFight || { tag: null };
  cell.evFight = null;
  if (e && e.onWin) e.onWin(A, cell, f, next);
  else A.done(cell, next);
}
