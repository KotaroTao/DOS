// 無限迷宮「奈落」: D50 で解放されるエンドコンテンツ。
// ・深さに上限はなく、潜るほど敵の力が連続的に増大する (難易度の壁)
// ・3 階ごとに「変異」が積み重なり (主に呪い・稀に恵み)、ランごとに盤面が変わる
// ・10 階ごとに「門番」が立ちはだかる (撃破で先へ)
// ・5 階ごとの帰還魔法陣で「いつでも撤退 = 記録確定」できる (ローグライト的なラン)
// ・潜入前に「誓約」(縛り) を選ぶとスコア倍率が上がる
//
// このモジュールは純粋なデータ/ロジックのみ。演出・状態管理・描画は game.js が担う。

export const ABYSS_BOSS_EVERY = 10;  // 門番が出る周期 (階)
export const ABYSS_MUT_EVERY = 3;    // 変異が積み重なる周期 (階)
export const ABYSS_UNLOCK_DUNGEON = 50; // 解放に必要な踏破数 (D50)

// ===== 誓約 (縛り) — 潜入前に任意で受け入れる。スコア倍率が上がる代わりにラン全体が過酷になる =====
// 効果フィールド (enemyMul/noFlee/packMin/ambushMul…) は game.js の mutNum 集約に流し込まれ、
// 既存の戦闘フックでそのまま効く。special は game.js が個別に解釈する印。
export const ABYSS_MODS = [
  { id: "fierce",  name: "烈戦の誓", sym: "⚔", scoreMul: 1.5, enemyMul: 1.4,
    desc: "奈落の魔物がはじめから猛り狂っている (敵の力 +40%)" },
  { id: "noFlee",  name: "退路断ちの誓", sym: "⛓", scoreMul: 1.25, noFlee: true,
    desc: "いかなる戦闘からも逃走できない" },
  { id: "swarm",   name: "群狼の誓", sym: "Ψ", scoreMul: 1.3, packMin: 3,
    desc: "魔物は常に群れ (3体以上) で現れる" },
  { id: "noItems", name: "無頼の誓", sym: "🚫", scoreMul: 1.4, special: "noItems",
    desc: "道具 (消耗品) を一切使用できない" },
  { id: "ambush",  name: "闇行の誓", sym: "🌘", scoreMul: 1.25, ambushMul: 5,
    desc: "奇襲を受ける危険が跳ね上がる" },
  { id: "cursed",  name: "呪縛の誓", sym: "☠", scoreMul: 1.6, special: "doubleMut",
    desc: "潜入時から変異が2つ宿り、変異の進行も速まる" },
];
export const ABYSS_MOD_MAP = Object.fromEntries(ABYSS_MODS.map((m) => [m.id, m]));

// 誓約の合計スコア倍率
export function abyssScoreMul(modIds) {
  let mul = 1;
  for (const id of modIds || []) { const m = ABYSS_MOD_MAP[id]; if (m) mul *= m.scoreMul; }
  return Math.round(mul * 100) / 100;
}

// スコア = 到達深度 × 100 × 誓約倍率 (門番は通過に撃破が要るので深度に内包される)
export function abyssScore(depth, modIds) {
  return Math.round(depth * 100 * abyssScoreMul(modIds));
}

// ===== 変異 (mutation) — 潜行中に積み重なる修飾子。呪い(curse)が主・恵み(boon)が稀 =====
// 効果フィールドは mutNum 集約へ流れる (enemyMul/soulMul/goldMul は積算、lootBonusLv/chestRankUp/packMin は加算)。
export const ABYSS_MUTATIONS = [
  // --- 呪い ---
  { id: "enrage",   name: "魔物の激昂", sym: "🔥", kind: "curse", accent: "#d4504e", enemyMul: 1.15,
    desc: "魔物の力が +15% される" },
  { id: "bloodlust",name: "血の渇き",   sym: "🩸", kind: "curse", accent: "#c0392b", enemyMul: 1.22,
    desc: "魔物の力が +22% される" },
  { id: "swarming", name: "湧き出る群れ", sym: "Ψ", kind: "curse", accent: "#c08a4a", packMin: 3,
    desc: "魔物が群れ (3体以上) で現れるようになる" },
  { id: "gloom",    name: "濃霧の闇",   sym: "🌫", kind: "curse", accent: "#7a5ad0", ambushMul: 3,
    desc: "奇襲を受けやすくなる" },
  { id: "snare",    name: "退路の封印", sym: "⛓", kind: "curse", accent: "#9aa0ac", noFlee: true, once: true,
    desc: "以降、戦闘から逃走できなくなる" },
  { id: "venom",    name: "蝕む瘴気",   sym: "☣", kind: "curse", accent: "#8a2be2", enemyMul: 1.1, poisonUp: true,
    desc: "毒の床が広がり、魔物の力が +10% される" },
  // --- 恵み (稀) ---
  { id: "soulfont", name: "魂の湧泉",   sym: "✧", kind: "boon", accent: "#7fd0ff", soulMul: 1.5,
    desc: "得られる Soul が 1.5倍 になる" },
  { id: "goldvein", name: "黄金の鉱脈", sym: "💰", kind: "boon", accent: "#ffd84a", goldMul: 1.5,
    desc: "得られるゴールドが 1.5倍 になる" },
  { id: "hoard",    name: "秘蔵の気配", sym: "▣", kind: "boon", accent: "#e8c47a", chestRankUp: 1, lootBonusLv: 12,
    desc: "宝箱が 1ランク上等になり、落ちている装備の質が上がる" },
];
export const ABYSS_MUT_MAP = Object.fromEntries(ABYSS_MUTATIONS.map((m) => [m.id, m]));

// 抽選の重み: 呪いを厚く (恵みは稀)。一度きり (once) の効果は既に宿っていれば候補から外す。
function abyssMutWeight(m) { return m.kind === "boon" ? 3 : 7; }

// 新たな変異を1つ抽選する。rng は 0..1 を返す関数 (週替りは固定シード rng を渡す)。
// existingIds に既にある once 系は除外し、可能な限り重複の呪いも避ける (恵みは重複しても害がない)。
export function rollAbyssMutation(rng, existingIds) {
  const have = new Set(existingIds || []);
  let pool = ABYSS_MUTATIONS.filter((m) => !(m.once && have.has(m.id)));
  // まだ宿していない変異を優先 (出尽くしたら重複も許可 = 呪いの積み増し)
  const fresh = pool.filter((m) => !have.has(m.id));
  if (fresh.length) pool = fresh;
  if (!pool.length) return null;
  let total = 0; for (const m of pool) total += abyssMutWeight(m);
  let r = (rng ? rng() : Math.random()) * total;
  for (const m of pool) { r -= abyssMutWeight(m); if (r < 0) return m.id; }
  return pool[pool.length - 1].id;
}

// ===== 週替りシード — 同条件の挑戦を全プレイヤーで共有する (変異列が固定される) =====
// ISO 風の「年×100 + 週番号」を週IDとする。日付から決定的に算出。
export function weekSeedId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // 木曜日基準で週番号を出す (ISO 8601)
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() * 100 + week;
}

// 決定的乱数 (mulberry32)。週替りの変異列・盤面ゆらぎに使う。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
