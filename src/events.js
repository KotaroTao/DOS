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

// 極の出来事が授ける恒久の恵み (G.events.flags のキー → 効き目)。game.js が戦闘・✦Soul の獲得で読む
export const EV_BOONS = {
  will:     { soulMul: 0.10, text: "先代の遺志 ― ✦Soul の獲得量 +10%" },
  blackCat: { crit: 0.03,    text: "黒猫の加護 ― 全員の会心率 +3%" },
  sewerMap: {                text: "王都の下水図 ― 第2層ではどの階も階段が最初から見える" },
  temper:   { dmgMul: 1.05,  text: "地の底の焼き入れ ― 全員の与えるダメージ +5%" },
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
  0: ["……灯を継ぐ者よ。深く潜るほど、魂は重くなる。",
      "人業の器がきしむのは、魂がまだ自分の体を覚えているからだ。",
      "忘れさせてやるな。それが、私にできなかったことだ。"],
};

// ===== 出来事の定義 =====
// 共通フィールド:
//   id, name, layer (0=共通 / 1..=その層専用), tier, icon (ICONS のキー or "mon:<id>"), accent,
//   minFloor (この階以上), deep (迷宮の後半の階のみ), minDn (迷宮番号の下限), maxSkip (この階から先に必要な階数),
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
      { label: "耳を当てる ― 階段の在処 / 20%で麻痺", primary: true, fn: () => {
        A.revealStairs();
        A.toast("囁きが道を教えた ― 階段の在処が見えた", "good", "stairs");
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
    id: "c08", name: "毒蛇の壺", layer: 0, tier: "common", icon: "poison",
    intro: () => ["口の欠けた大壺。中で何かが擦れる音がする。底のほうで金貨が光った。"],
    choices: (A, cell) => [
      { label: "手を突っ込む ― 金貨 / 40%で毒", primary: true, fn: () => {
        const m = A.randomAlive();
        A.gold(2, "壺の底");
        if (m && chance(0.4)) { A.ail(m, "poison"); A.toast(`${m.name}が噛まれた ― 毒`, "bad", "poison"); }
        A.done(cell);
      } },
      { label: "壺を割る ― 蛇の群れと戦い、金貨を多く", danger: true, fn: () => {
        A.fight(cell, [{ pool: true, min: 3 }], "jar", { noChest: true });
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
      return [
        A.canPayGold(herb) && { label: `薬草を買う (💰${herb})`, fn: () => { A.payGold(herb); A.giveItemId("herb", () => A.reopen(cell)); } },
        A.canPayGold(mana) && { label: `マナの雫を買う (💰${mana})`, fn: () => { A.payGold(mana); A.giveItemId("manaDrop", () => A.reopen(cell)); } },
        A.canPayGold(box) && { label: `中身の分からぬ包みを買う (💰${box}) ― 時に掘り出し物`, fn: () => {
          A.payGold(box); A.item({ chestRank: 4 }, "行商人の包み", () => A.done(cell));
        } },
      ];
    },
    leaveLabel: "立ち去る",
  },
  {
    id: "c18", name: "断末魔の騎士", layer: 0, tier: "uncommon", icon: "mon:d02_soldier", minFloor: 2,
    intro: () => ["鎧の割れた騎士が、血の泡を吹きながら呻いている。", "「……楽にしてくれ……でなければ……せめて、手当てを……」"],
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
    intro: (A) => ["埃が宙に止まったままの部屋。中央に巨大な砂時計。", `この階で倒した魔物 ${A.countCells((c) => c.type === "monster" && c.cleared && !c.elite)}体 が、時を戻せば蘇る。`],
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
        A.flash("#a08020"); A.toast("呪いが纏わりついた ― この潜入の間、敵の力1.2倍", "bad"); A.done(cell);
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
    intro: () => ["天井の鍾乳石から、淡く光る雫が一滴ずつ落ちている。", "一滴だけ受け止められそうだ。倒れた者の口に含ませれば、魂が器へ戻るという。"],
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
    intro: () => ["蓋のずれた石棺。隙間から、金糸の経帷子が覗いている。"],
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
    id: "l1_09", name: "修道院の告解室", layer: 1, tier: "rare", icon: "event", minDn: 4, deep: true,
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
    id: "l3_09", name: "鉱山主の金庫", layer: 3, tier: "rare", icon: "chest", minDn: 13, deep: true,
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
    id: "l3_10", name: "地の底の鍛冶場", layer: 3, tier: "mythic", icon: "event", once: true, minDn: 14, deep: true,
    boon: EV_BOONS.temper.text,
    intro: () => ["地熱で赤く光る火床。ドワーフの霊が、黙々と槌を振るっている。", "霊は無言で隊の得物を取り上げると、火床にくべ、焼き入れを施して返した。"],
    gift: (A) => {
      A.flags().temper = true;
      A.sfx("victory"); A.flash("#ff9a4a");
      return ["「……これで、少しはましに斬れる」", `✺ ${EV_BOONS.temper.text} (以後ずっと)`];
    },
  },
];

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
];

// 出現条件の説明 (見聞録用)
export function eventWhereText(e) {
  const parts = [e.layer ? `第${e.layer}層のみ` : "どの層でも"];
  if (e.minDn) parts.push(`迷宮${e.minDn}以降`);
  if (e.deep) parts.push("迷宮の後半の階");
  else if (e.minFloor && e.minFloor > 1) parts.push(`B${e.minFloor}F以降`);
  if (e.tier === "rare") parts.push("1回の潜入で1度まで");
  if (e.once === "layer") parts.push("各層で一度きり");
  else if (e.once) parts.push("一度きり");
  return parts.join(" ・ ");
}

// ===== 置き場所と抽選 =====
// st: { layer, dn, floor, floors, abyss, runEv, flags, once(id) }。出せるイベントを重み付きで1つ選ぶ (無ければ null)
export function eligibleEvents(st, A) {
  const deepNow = st.floor > st.floors / 2;
  return EVENTS.filter((e) => {
    if (e.layer && e.layer !== st.layer) return false;
    if (st.dn <= 1 && e.tier !== "common") return false;            // 迷宮1は常のみ
    if (e.minFloor && st.floor < e.minFloor) return false;
    if (e.deep && !deepNow) return false;
    if (e.minDn && st.dn < e.minDn) return false;
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
