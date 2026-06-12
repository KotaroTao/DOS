// モンスター共通スキーマ + 種族定義 + 共有ドット絵ライブラリ
//
// ===== 設計ルール (ダンジョン単位コンテンツの生命線) =====
// 1. ID は「d<番号>_名前」(固有種) / 「cm_名前」(共通種) で名前空間化する。
//    既存IDの変更・並べ替えは禁止 (セーブ/図鑑の参照が壊れる)。追記のみ。
// 2. すべてのモンスターは defMonster() を通して定義する。
//    将来フィールドを足す時はここのデフォルトに足せば全体に行き渡る。
// 3. 1ダンlike1モジュール (d01.js, d02.js, ...)。盤面設定と出現モンスターを同居させ、
//    index.js のレジストリに登録する。

// ===== 種族分類 (16タイプ) — 図鑑のタブ =====
export const MON_RACES = [
  { key: "amorph", label: "不定形" },
  { key: "beast", label: "獣" },
  { key: "wing", label: "飛獣" },
  { key: "avian", label: "鳥人" },
  { key: "insect", label: "虫" },
  { key: "plant", label: "植物" },
  { key: "aquatic", label: "水棲" },
  { key: "reptile", label: "爬虫" },
  { key: "dragon", label: "竜" },
  { key: "humanoid", label: "亜人" },
  { key: "giant", label: "巨人" },
  { key: "undead", label: "不死" },
  { key: "specter", label: "幽鬼" },
  { key: "demon", label: "悪魔" },
  { key: "construct", label: "構造体" },
  { key: "armored", label: "機鎧" },
];
export const RACE_LABEL = (() => {
  const m = {};
  for (const r of MON_RACES) m[r.key] = r.label;
  return m;
})();

// ===== 属性 (エレメント) =====
// 6属性 + 無属性。循環: 火→風→土→水→火。光↔闇は相互に有利。
export const ELEMENTS = {
  none:  { label: "無", color: "#9aa0ac" },
  fire:  { label: "火", color: "#ff6b3a" },
  water: { label: "水", color: "#4aa3ff" },
  wind:  { label: "風", color: "#5fd08a" },
  earth: { label: "土", color: "#c89a4a" },
  light: { label: "光", color: "#ffe27a" },
  dark:  { label: "闇", color: "#9b6bd0" },
};
// A が有利を取る相手 B のリスト
const ELEM_BEATS = {
  fire: ["wind"], wind: ["earth"], earth: ["water"], water: ["fire"],
  light: ["dark"], dark: ["light"],
};
export function elemBeats(a, b) { return !!(ELEM_BEATS[a] && ELEM_BEATS[a].includes(b)); }
// 攻撃属性 atk が 防御属性 def に与えるダメージ倍率
// 有利: 1.5倍 / 不利(相手が有利): 0.5倍 / それ以外: 1.0倍。無属性が絡めば常に1.0
export function elemMult(atk, def) {
  if (!atk || atk === "none" || !def || def === "none") return 1;
  if (elemBeats(atk, def)) return 1.5;   // 光↔闇は双方ここで 1.5 になる
  if (elemBeats(def, atk)) return 0.5;
  return 1;
}

// ===== 属性攻撃 / 属性防御 (装備で得るレベル付きステータス) =====
// 属性攻撃 Lv1=◯: 有利属性へのダメージ+50% / 不利属性へ-50%。Lv2=◎: ±100%。
// 属性防御も同じ計算で受けるダメージを増減する (Lv1=◯ ±50%, Lv2=◎ ±100%)。
//   aE/aLv  : 攻撃側の属性と属性攻撃レベル (呪文・モンスター固有属性は Lv1 扱い)
//   tgtElem : 対象の固有属性 (モンスター)。攻撃側の有利不利はこれと比較する
//   tgtDef  : 対象の属性防御 {el, lv} (装備由来)。攻撃属性との相性で被ダメージを増減
// 光↔闇は相互有利の例外: 攻撃側は常に「有利」、防御側は常に「軽減」扱いになる。
export function elemDmgMult(aE, aLv, tgtElem, tgtDef) {
  if (!aE || aE === "none") return 1;
  let m = 1;
  if (aLv > 0 && tgtElem && tgtElem !== "none") {
    const k = 0.5 * Math.min(2, aLv);
    if (elemBeats(aE, tgtElem)) m *= 1 + k;
    else if (elemBeats(tgtElem, aE)) m *= Math.max(0, 1 - k);
  }
  if (tgtDef && tgtDef.lv > 0 && tgtDef.el && tgtDef.el !== "none") {
    const k = 0.5 * Math.min(2, tgtDef.lv);
    if (elemBeats(tgtDef.el, aE)) m *= Math.max(0, 1 - k); // 防御側が有利 → 軽減
    else if (elemBeats(aE, tgtDef.el)) m *= 1 + k;          // 防御側が不利 → 増加
  }
  return m;
}

// ===== 色ユーティリティ (パレットの部分差し替え用) =====
function hex(n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); }
function parseHex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function blend(a, b, t) {
  if (!a) return a; const A = parseHex(a), B = parseHex(b);
  return "#" + hex(A[0] + (B[0] - A[0]) * t) + hex(A[1] + (B[1] - A[1]) * t) + hex(A[2] + (B[2] - A[2]) * t);
}
// ベースパレットを tint 方向へ amount 混ぜる (新種の固有色を作る時に使う)
export function tint(pal, tintColor, amount) {
  const out = {};
  for (const k in pal) out[k] = pal[k] ? blend(pal[k], tintColor, amount) : pal[k];
  return out;
}

// ===== 共有ドット絵ライブラリ (12x12) =====
// 形ごとの原型。各モンスターは artKey で形を選び、palette で固有の色を持つ。
export const ARTS = {
  slime: { palette: { "0": "#15431a", "1": "#3fae46", "2": "#9be88a", "3": "#0a0a0a", "4": "#ffffff" },
    art: ["....0000....", "..00111100..", ".0011111100.", "001111111100", "011211112110", "011411114110", "011211112110", "011111111110", "011112211110", "001111111100", ".0011111100.", "..00000000.."] },
  bat: { palette: { "0": "#2a1638", "1": "#6b3fa0", "2": "#b07be0", "3": "#ff3b3b", "4": "#0a0a0a" },
    art: ["0..........0", "00........00", "010......010", "0110....0110", "01110.0.1110", "0111101111110", ".01111441110.", "..0113443110.", "...011331110.", "....011110...", ".....0220....", "......00...."] },
  beast: { palette: { "0": "#2a1d12", "1": "#7a5230", "2": "#caa06a", "3": "#0a0a0a", "4": "#d4504e" },
    art: ["..0......0..", "..00....00..", ".0220..0220.", ".0212..2120.", ".0111111110.", ".0113443110.", ".0111111110.", "..02111120..", "..0211 1120..", "...02..20...", "..00....00..", ".0.0....0.0."] },
  kobold: { palette: { "0": "#3a2410", "1": "#8a5a2b", "2": "#c98c4a", "3": "#0a0a0a", "4": "#d4504e", "5": "#b8b8c8" },
    art: ["..0......0..", "..00....00..", "..010..010..", "..01111110..", ".0111111110.", ".0131111310.", ".0111441110.", ".0011111100.", "5.01111110.5", "550111111055", "..0110011 0..", "..00....00.."] },
  skeleton: { palette: { "0": "#3d3d2a", "1": "#d9d4bf", "2": "#ffffff", "3": "#0a0a0a", "4": "#8a8470" },
    art: ["...000000...", "..01111110..", "..01311310..", "..01111110..", "..00133100..", "...011110...", "..010110110..", ".0101111010.", "..00111100..", "...01..10...", "...01..10...", "..010..010.."] },
  orc: { palette: { "0": "#1f3315", "1": "#4f7a3a", "2": "#79a857", "3": "#0a0a0a", "4": "#d4504e", "5": "#8a8a9a", "6": "#5a3a1a" },
    art: ["..2......2..", ".0211111120.", "021111111120", "021311131120", "021111111120", "021144441120", "021133331120", "00211111100", "650211110256", "66502110566", "..021 1120..", ".0220..0220."] },
  golem: { palette: { "0": "#33373b", "1": "#6a727a", "2": "#9aa3ab", "3": "#0a0a0a", "4": "#7fd0e6" },
    art: [".00000000...", ".02222220...", ".02144120...", ".02211220...", ".02222220...", "002222222 00", "022022022 20", "022022022 20", ".00.00.00...", ".22..22.....", ".22..22.....", "022..022...."] },
  wraith: { palette: { "0": "#10202e", "1": "#2b5f7a", "2": "#5fb8d6", "3": "#aef0ff", "4": "#0a0a0a", "5": "#ff5577" },
    art: ["....0000....", "..00111100..", ".0011111100.", "011151151110", "011544445110", "011151151110", "011111111110", ".011111110.", ".0211111120.", "..021111 20..", "...021120...", "....0220...."] },
  imp: { palette: { "0": "#3a0d0d", "1": "#9c2a2a", "2": "#d65a3a", "3": "#0a0a0a", "4": "#f2c14e" },
    art: ["..0....0....", "..00..00....", "..010.010...", "..0111110...", ".011311310.", ".011111110.", ".001111100.", "...01110....", "..0211120...", ".021..120...", ".0.0..0.0...", "............"] },
  lizard: { palette: { "0": "#15401f", "1": "#3a8a3a", "2": "#7fd06a", "3": "#0a0a0a", "4": "#e8c24a" },
    art: ["..00........", ".0110.......", ".0310.0000..", ".0110011110.", "..01111111 0.", "..0111441110", "..0111111110", "...011111110", "....0111100.", "...0110110..", "..0.0..0.0..", "............"] },
  ghost: { palette: { "0": "#1a2630", "1": "#4a6e80", "2": "#9fd6e6", "3": "#ffffff", "4": "#0a0a0a" },
    art: ["....0000....", "..00222200..", ".0233333320.", ".0234334320.", ".0233333320.", ".0233333320.", ".0233333320.", ".0233333320.", ".0202020 20.", ".0.0.0.0.0..", "............", "............"] },
  knightmare: { palette: { "0": "#1a1a24", "1": "#5a5f7a", "2": "#9aa0c0", "3": "#0a0a0a", "4": "#d4504e" },
    art: ["...02220....", "..0212120...", "..0242420...", "..0222220...", ".002222200.", ".021222120.", ".021222120.", ".001222100.", "...02220....", "...02.20....", "..022.220...", ".022..220..."] },
  dragon: { palette: { "0": "#3a0d0d", "1": "#9c2a2a", "2": "#d65a3a", "3": "#f2c14e", "4": "#0a0a0a", "5": "#ffd24a", "6": "#6b1414" },
    art: ["0..........0", "010......010", "0110.33..0110", "01110331101110", "0111133221110", "011153522 1110", "0111544521110", ".011122221 10.", "..01122221 10.", "...0112110...", "..660110666..", ".660....066."] },
  harpy: { palette: { "0": "#5a3a1a", "1": "#caa06a", "2": "#e8c24a", "3": "#d98a5a", "4": "#0a0a0a" },
    art: ["....3443....", "...344443...", "...344443...", "....3443....", "2..011110..2", "22.011110.22", ".2201111022.", "..0111110...", "...01110....", "...0...0....", "..02...20...", ".020...020.."] },
  spider: { palette: { "0": "#1a0f1a", "1": "#4a2d4a", "2": "#7a3a6a", "3": "#d4504e", "4": "#0a0a0a" },
    art: ["0.........0", "00.......00", ".00.....00.", "..0..0..0..", "...00000...", "..0011100..", ".001313100.", ".001111100.", "..0011100..", "...00000...", "..0.....0..", ".00.....00."] },
  mandrake: { palette: { "0": "#143a14", "1": "#3a8a3a", "2": "#8fd06a", "3": "#caa06a", "4": "#0a0a0a", "5": "#e8c24a" },
    art: ["..1..5..1...", "..11.5.11...", "...1151 1...", "....111.....", "...03330....", "..0343430...", "..0331330...", "..0343430...", "...03330....", "....333.....", "...3.3.3....", "..3..3..3..."] },
  sahagin: { palette: { "0": "#0a2a3a", "1": "#1f6a7a", "2": "#4fb0c0", "3": "#9be8e0", "4": "#0a0a0a", "5": "#caa06a" },
    art: ["...2....2...", "...22..22...", "....2002....", "...021120...", "..02141 20..", "..0211120...", "..0211120...", "...02220 5..", "...021205...", "...0210 5...", "..02.020....", ".020..020..."] },
  ogre: { palette: { "0": "#2a1d12", "1": "#7a5a3a", "2": "#b08a5a", "3": "#0a0a0a", "4": "#d4504e", "5": "#8a8a9a" },
    art: ["...02220....", "..0222220...", "..0232320...", "..0222220...", ".5022222205", ".5022222205", "..02222220..", "..02222220..", "..02.0.020..", "..02...020..", ".022...0220.", ".022...0220."] },
};

// ===== ランク基準ステータス =====
// モンスターランク (1-10) から基準ステータスを算出する。全100迷宮のバランスの
// 単一の調整点。個体差は mul (hp/atk などの倍率) で付ける。
// ・hp はプレイヤーの攻撃力カーブ (魂×5部位+武器) に対し通常2-3撃で倒せる量
// ・atk はプレイヤーの VIT 半減則 (combat.js) を踏まえた貫通量
export function monStats(rank, boss = false) {
  const r = Math.max(1, Math.min(10, rank));
  const s = {
    hp: Math.round(30 * Math.pow(r, 1.8)),
    atk: Math.round(12 + 3.2 * r * r),
    def: Math.round(2 * Math.pow(r, 1.5)),
    spd: 4 + Math.round(r * 0.9),
    soul: Math.round(10 * Math.pow(1.65, r - 1)),
    gold: Math.round(8 * Math.pow(1.7, r - 1)),
  };
  if (boss) {
    s.hp = Math.round(s.hp * 3.2);
    s.atk = Math.round(s.atk * 1.3);
    s.def = Math.round(s.def * 1.2);
    s.spd += 2;
    s.soul *= 8;
    s.gold *= 10;
  }
  return s;
}

// ===== モンスター定義ヘルパー =====
// すべてのモンスターはここを通る。スキーマ:
// { id, key, name, race, rank, desc, maxhp, hp, atk, def, spd, soul, gold,
//   art, palette, boss?, dropNormal?, dropRare?, soulClass? }
// soul は撃破時に回収できる Soul 量 (経験値の役割を兼ねる)。
// 注: def/spd は定義用の名前のまま。出現時に六大ステへ写像される
//     (combat.js makeEnemy: atk→ATK, def→VIT, spd→AGI)。
// dropNormal/dropRare は省略可 (省略時は game.js がランクから決定的に割り当てる)。
// soulClass を持つ人型は撃破時にまれに魂を落とす。
export function defMonster(def) {
  if (!def.id) throw new Error("monster id required");
  if (!ARTS[def.artKey || ""] && !def.art) throw new Error("unknown artKey: " + def.artKey + " (" + def.id + ")");
  const base = ARTS[def.artKey] || {};
  const m = {
    id: def.id, key: def.id,
    name: def.name || "???",
    race: def.race || "beast",
    element: def.element || "none",
    rank: def.rank || 1,
    desc: def.desc || "",
    maxhp: def.hp || 10, hp: def.hp || 10,
    atk: def.atk || 1, def: def.def || 0, spd: def.spd || 5,
    soul: def.soul || 5, gold: def.gold || 3,
    art: def.art || base.art,
    palette: def.palette || base.palette,
    boss: !!def.boss,
  };
  if (def.dropNormal) m.dropNormal = def.dropNormal;
  if (def.dropRare) m.dropRare = def.dropRare;
  if (def.soulClass) m.soulClass = def.soulClass;
  return m;
}

// 定義の配列を { id: monster } に変換 (重複IDは即エラー)
export function defMonsters(defs) {
  const out = {};
  for (const d of defs) {
    const m = defMonster(d);
    if (out[m.id]) throw new Error("duplicate monster id: " + m.id);
    out[m.id] = m;
  }
  return out;
}
