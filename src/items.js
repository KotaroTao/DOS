import { prepareWeapon } from "./weaponpower.js";
import { zeroResists, clampResist } from "./resistance.js";
// 武器・防具・アクセサリ・消耗品のカタログ (基本品)
// 大量の一点物は src/catalog/ で定義され、game.js が ITEMS に統合する。
// 各アイテムは art(24x24) + 共有パレット P で描く (形は src/catalog/defs.js の ARTS と同じ原型)。説明文・性能・職業制限つき。
//
// slot: head | weapon | shield | body | feet | acc | use | misc
//   weapon→右手, shield→左手, head/body/feet, acc→アクセサリ枠(2), use→消耗品
//   misc→収集品(戦利品。装備/使用不可。売却するか王宮の宝物庫に奉納する)
// twoHanded: 両手武器 (左手 = 盾の欄をふさぐ。能力は片手武器の TWO_MUL 倍)
// sk: 盾のジャンル (kite 大盾 / round 円盾 / buckler 小盾 / orb 宝珠 / tome 聖典)
// classes: 装備可能な職業キー配列 (null=全職)
// cursed: 呪い (一度装備すると外せない)
// 性能キー: atk/vit/agi/int/pie/luk (六大ステ加算) / hp/mp (最大値加算) / crit (会心率加算)
// lv: 隠しレベル (1-200)。迷宮の出現帯・出現率・表示ランクを決める
// cat: 武器のみ。サブカテゴリ (WEAPON_CATS のキー)
// eAtk/eDef: 属性攻撃/属性防御 { el, lv } (lv1=◯ ±50%, lv2=◎ ±100%)
// aRes: 状態異常耐性 { poison/paralyze/sleep/charm/confuse/stone: 付与率カット (0.25 = 25%) }。同じ種類は装備どうしで足し合い、上限 AIL_RES_CAP
// bRes: ブレス耐性 (敵のブレスから受けるダメージのカット率 0.15 = 15%)。装備どうしで足し合い、上限 BREATH_RES_CAP (combat.js)
// onHit: 武器などの追加効果 { k: poison/paralyze/sleep/charm/confuse, chance, pct? }。当てるだけで敵に状態異常を与える
// scale: 武器の能力補正 { atk/agi/int/…: 係数 }。攻撃力 = Σ(参照能力値 × 武器の係数) (attackPower)。物理の攻撃・物理技はこの攻撃力で計算する
// magic: 魔法属性の武器。通常攻撃 (と残心・連撃などの追撃) の威力は攻撃力のまま、物理耐性ではなく魔法耐性を受け、魔法弱点が効く
// price: 装備の値段は起動時に性能から付け直す (src/pricing.js の repriceEquipment)。ここの値は道具・収集品にだけ効く

// 装備部位 (8か所): 武器・盾・鎧・頭・小手・足・装飾x2
export const SLOTS = ["weapon", "shield", "body", "head", "hands", "feet", "acc1", "acc2"];
export const SLOT_LABEL = {
  weapon: "武器", body: "防具", shield: "盾", head: "頭", hands: "小手", feet: "足", acc1: "装飾1", acc2: "装飾2",
};
export const MAX_ITEMS = 8;

// ===== アイテム分類 (商店・図鑑のタブ) =====
export const ITEM_CATS = [
  { key: "use", label: "道具", slots: ["use"] },
  { key: "weapon", label: "武器", slots: ["weapon"] },
  { key: "shield", label: "盾", slots: ["shield"] },
  { key: "body", label: "防具", slots: ["body"] },
  { key: "head", label: "頭", slots: ["head"] },
  { key: "hands", label: "小手", slots: ["hands"] },
  { key: "feet", label: "足", slots: ["feet"] },
  { key: "acc", label: "装飾", slots: ["acc"] },
  { key: "misc", label: "収集品", slots: ["misc"] },
];
// 武器サブカテゴリ (図鑑の武器タブをさらに分ける)
export const WEAPON_CATS = [
  { key: "ls", label: "長剣" },
  { key: "dg", label: "短剣" },
  { key: "kt", label: "刀" },
  { key: "ax", label: "斧" },
  { key: "mc", label: "槌" },
  { key: "sp", label: "槍" },
  { key: "bw", label: "弓" },
  { key: "st", label: "杖" },
];
export const WEAPON_CAT_LABEL = (() => {
  const m = {};
  for (const c of WEAPON_CATS) m[c.key] = c.label;
  return m;
})();
// 武器の持ち方: 両手武器 (twoHanded) は盾の欄をふさぐ代わりに能力が高い。片手武器は盾と併せて持てる
export const HAND_LABEL = { 1: "片手", 2: "両手" };
export function handOf(item) { return item && item.slot === "weapon" ? (item.twoHanded ? 2 : 1) : 0; }
// 盾のジャンル (catalog/defs.js の S ビルダーが形から sk を付ける)。職ごとに持てるジャンルは souls.js の JOB_GEAR.shields
export const SHIELD_KINDS = [
  { key: "kite", label: "大盾" },
  { key: "round", label: "円盾" },
  { key: "buckler", label: "小盾" },
  { key: "orb", label: "宝珠" },
  { key: "tome", label: "聖典" },
];
export const SHIELD_KIND_LABEL = (() => {
  const m = {};
  for (const c of SHIELD_KINDS) m[c.key] = c.label;
  return m;
})();
export function shieldKind(item) {
  if (!item || item.slot !== "shield") return null;
  return item.sk || (item.weight === "light" ? "round" : "kite");
}
// 職が持てる盾のジャンル (配列。持てなければ空)
export function jobShieldKinds(clsKey) {
  const g = _jobGear[clsKey];
  return g && g.shields ? g.shields : [];
}

// 職業ギアマトリクス (souls.js が registerJobGear で注入する)
let _jobGear = {};
export function registerJobGear(map) { _jobGear = map; }
// 鎧重量ランク: heavy(2) ≥ light(1) ≥ cloth(0)。item.weight ≤ job.armor のとき装備可
const ARMOR_RANK = { heavy: 2, light: 1, cloth: 0 };

// ===== 武器の射程 =====
// 近距離: 敵の前衛にしか届かない / 中距離: 自分が前衛なら敵の後衛まで届く /
// 長距離: 後衛からでも敵の後衛まで届く。魔法・ブレスは射程の制約を受けない。
export const RANGE_LABEL = { near: "近距離", mid: "中距離", long: "長距離" };
const CAT_RANGE = { ls: "near", dg: "near", kt: "near", ax: "near", mc: "near", st: "near", sp: "mid", bw: "long" };
// アイテム個別の range 指定 > サブカテゴリの既定値。素手・射程不明は近距離
export function weaponRange(item) {
  if (!item) return "near";
  return item.range || CAT_RANGE[item.cat] || "near";
}

// ===== 攻撃力 (武器の参照能力 × 補正係数の合計) =====
// 武器なしはSTR。武器ありはSTRを無条件に足さず、scaleにある能力だけを使う。
export const SCALE_KEYS = ["atk", "vit", "agi", "int", "pie", "luk"];
export const SCALE_LABEL = { atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
// 能力補正の上乗せ分 (stat = 能力値を返す関数。戦闘ではバフ込みの実効値を渡す)
export function scaleBonus(scale, stat) {
  if (!scale) return 0;
  let s = 0;
  for (const k of SCALE_KEYS) if (scale[k]) s += (stat(k) || 0) * scale[k];
  return s;
}
// 攻撃力 (装備画面・比較・おすすめの物差し)。m = 人業 (recalc 済み) か previewStats の結果
export function attackPower(m) {
  if (!m) return 0;
  return Math.max(1, Math.round(m.wScale ? scaleBonus(m.wScale, (k) => m[k]) : (m.atk || 0)));
}
// ===== 二刀流 (修羅のランクのパッシブ「二刀流」asuraNitou。サブ魂で借りても効く) =====
// 盾の欄 (左手) に片手武器を持てる。左手の攻撃力 = 左手の武器の攻撃力 × ランクの割合 (R2 40% / R3 60% / R4 80% / R5 100%)。
// 通常攻撃は右手の後に左手で一撃 (combat.js)、物理技は左手の攻撃力の DUAL_SKILL_SHARE (半分) を上乗せする。
// member.dualWield (割合) は souls.js の recalcDoll が passiveMap から入れる
export const DUAL_WIELD_RATES = [0, 0.4, 0.6, 0.8, 1.0];
export const DUAL_SKILL_SHARE = 0.5;
// 装備の比べ方 (最適装備・候補の伸び) で左手の攻撃力を何割に数えるか (通常攻撃 = 全部 と 技 = 半分 の間)
export const DUAL_VALUE_SHARE = 0.75;
// 盾の欄にある武器 (左手の武器)
export function offhandOf(m) {
  const it = m && m.equip && m.equip.shield;
  return it && it.slot === "weapon" ? it : null;
}
// 左手に持てる武器か (二刀流を持ち、片手武器で、その職が持てる種類)
export function canOffhand(member, item) {
  return !!(member && member.dualWield > 0 && item && item.slot === "weapon" && !item.twoHanded && canEquip(member, item));
}
// 左手の攻撃力 (左手の武器の参照能力 × 係数 × 二刀流の割合)。二刀流が無ければ 0
export function offhandPower(m) {
  if (!m || !(m.dualRate > 0)) return 0;
  const raw = m.oScale ? scaleBonus(m.oScale, (k) => m[k]) : (m.atk || 0);
  return Math.max(1, Math.round(raw * m.dualRate));
}
// 装備を比べる物差しの攻撃力 (右手 + 左手を DUAL_VALUE_SHARE で)
export function fightPower(m) {
  return attackPower(m) + Math.round(offhandPower(m) * DUAL_VALUE_SHARE);
}
// 能力補正の短い表記: 「AGI×0.4」「STR×0.15 INT×0.3」(無ければ "")
export function scaleText(scale) {
  if (!scale) return "";
  return SCALE_KEYS.filter((k) => scale[k]).map((k) => `${SCALE_LABEL[k]}×${scale[k]}`).join(" ");
}

// ===== 鑑定システム (ウィザードリィ風) =====
// ダンジョンで拾った装備は「未鑑定 (unidentified)」状態で手に入り、伏せ名で表示され
// 鑑定するまで装備できない。鑑定は商店 (有料・確実) か一部職業のスキルで行う。
// 消耗品・収集品 (use/misc) は鑑定済みで出るため対象外。
export const UNIDENT_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
// 武器はサブカテゴリごとに伏せ名を変える (剣・斧・杖… の見当はつく、というていの表記)
const UNIDENT_WEAPON = { ls: "けん？", dg: "ナイフ？", kt: "かたな？", ax: "おの？", mc: "つち？", sp: "やり？", bw: "ゆみ？", st: "つえ？" };
const UNIDENT_SLOT = { weapon: "えもの？", shield: "たて？", body: "よろい？", head: "かぶと？", hands: "こて？", feet: "くつ？", acc: "かざり？" };
// 未鑑定品の伏せ名 (スロット/武器カテゴリ別)
export function unidentName(it) {
  if (!it) return "なぞのしなもの？";
  if (it.slot === "weapon") return UNIDENT_WEAPON[it.cat] || "えもの？";
  return UNIDENT_SLOT[it.slot] || "なぞのしなもの？";
}
// 表示名: 未鑑定なら伏せ名、鑑定済みなら本来の名前
export function itemName(it) { return it && it.unidentified ? unidentName(it) : (it ? it.name + (it.forge ? "＋" + it.forge : "") : ""); }
// ＋N の段 (it.forge。元は迷宮の出来事「地の底の鍛冶場」。第九章「宿敵の再戦」で首級を鍛える予定): 品の正の能力値を 1段につき1割 (最低+1) 底上げする。
// 品の能力はロード時に目録から引き直される (reflattenItemStats) ので、その後にもう一度これを掛ける (品質 applyQuality の後)
export const FORGE_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp"];
export function applyForge(it) {
  if (!it || !it.forge) return it;
  for (const k of FORGE_KEYS) {
    const v = it[k];
    if (typeof v === "number" && v > 0) it[k] = v + Math.max(it.forge, Math.round(v * 0.1 * it.forge));
  }
  if (it.weaponRating) it.weaponRating *= 1 + 0.1 * it.forge;
  if (it.scale) it.scale = Object.fromEntries(Object.entries(it.scale).map(([k, v]) => [k, Math.round(v * (1 + 0.1 * it.forge) * 10000) / 10000]));
  return it;
}

// ===== 品質 (2026-10、ユーザーの指示) =====
// 装備品 (コモン〜LR。道具・収集品は対象外) は手に入れるたびに品質 0〜100 を引き、性能が目録の値の ±QUALITY_SPREAD (20%) で変わる。
// 品質50 = 目録どおり (並品)。拾う品の平均の強さは目録のまま。商会の棚の品は並品 (品質50) で、売った品も並品として棚に戻る。
// 変わるもの: 能力値 (STR…MP・会心)・%補正 (mult)・武器の参照係数 (scale = 攻撃性能)・状態異常耐性 (aRes)・ブレス耐性 (bRes)・抵抗値 (resists)。
//   戦闘効果 (eff)・属性 (eAtk/eDef)・追加効果 (onHit) は変えない。売値・鑑定料は品の種類で決まり、品質に依らない。
// 「鍛え直し」(奈落と同時に開く、game.js reforge*) で金貨を払って品質を引き直す。結果を見て、新しい品質か元のままかを選べる。
// 品の能力はロード時に目録から引き直される (reflattenItemStats) ので、その後にもう一度これを掛ける (＋N の段 applyForge はその後)
export const QUALITY_SPREAD = 0.2;
export const QUALITY_MID = 50;
export const QUALITY_MAX = 100;
const QUALITY_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
const QUALITY_KEYS = ["atk", "vit", "agi", "int", "pie", "luk", "hp", "mp", "crit"];
// 品質を持つ品か (装備品)
export function hasQuality(it) { return !!it && QUALITY_SLOTS.has(it.slot); }
// 品質を引く (0〜100 の整数、どれも同じ確率)
export function rollQuality() { return Math.floor(Math.random() * (QUALITY_MAX + 1)); }
// 品質 → 性能の倍率 (0 = ×0.8 / 50 = ×1 / 100 = ×1.2)
export function qualityMul(q) {
  const v = Math.max(0, Math.min(QUALITY_MAX, q == null ? QUALITY_MID : q));
  return 1 + QUALITY_SPREAD * (v - QUALITY_MID) / QUALITY_MID;
}
// 品質の値 (品質を持たない品・未設定は null。旧セーブの品は読み込みで並品 50 にする)
export function qualityOf(it) { return hasQuality(it) ? (it.q == null ? QUALITY_MID : it.q) : null; }
// 品質で変わる性能を持つ品か (能力値・%補正・参照係数・耐性のどれか。戦闘効果だけの品は false)
export function qualityMatters(it) {
  if (!hasQuality(it)) return false;
  const tmpl = ITEMS[it.id] || it;
  if (QUALITY_KEYS.some((k) => typeof tmpl[k] === "number" && tmpl[k] > 0)) return true;
  return !!(tmpl.scale || tmpl.mult || tmpl.aRes || tmpl.bRes || tmpl.resists);
}
const q3 = (v) => Math.round(v * 1000) / 1000;
// 品 it の性能に品質 it.q を掛ける。目録の値 (引き直した直後) に1回だけ掛けること
export function applyQuality(it) {
  if (!hasQuality(it) || it.q == null || it.q === QUALITY_MID) return it;
  const m = qualityMul(it.q);
  for (const k of QUALITY_KEYS) {
    const v = it[k];
    if (typeof v !== "number" || v <= 0) continue;
    it[k] = k === "crit" ? q3(v * m) : Math.max(1, Math.round(v * m));
  }
  if (it.mult) it.mult = Object.fromEntries(Object.entries(it.mult).map(([k, v]) => [k, typeof v === "number" && v > 0 ? q3(v * m) : v]));
  if (it.scale) it.scale = Object.fromEntries(Object.entries(it.scale).map(([k, v]) => [k, Math.round(v * m * 10000) / 10000]));
  if (it.weaponRating) it.weaponRating = Math.round(it.weaponRating * m * 100) / 100;
  if (it.aRes) it.aRes = Object.fromEntries(Object.entries(it.aRes).map(([k, v]) => [k, typeof v === "number" && v > 0 ? Math.min(1, q3(v * m)) : v]));
  if (typeof it.bRes === "number" && it.bRes > 0) it.bRes = q3(it.bRes * m);
  if (it.resists) it.resists = Object.fromEntries(Object.entries(it.resists).map(([k, v]) => [k, typeof v === "number" && v > 0 ? Math.max(1, Math.min(100, Math.round(v * m))) : v]));
  return it;
}
// 品 it を目録から写し直し、品質 q (省略時 it.q) と＋N の段を掛けた新しい品 (it は変えない)。鍛え直しの見比べに使う
export function itemAtQuality(it, q = it && it.q) {
  const tmpl = it && ITEMS[it.id];
  if (!tmpl) return it ? { ...it } : null;
  const out = { ...it };
  for (const k of [...QUALITY_KEYS, "mult", "scale", "weaponRating", "aRes", "bRes", "resists"]) {
    if (tmpl[k] !== undefined) out[k] = tmpl[k]; else delete out[k];
  }
  out.q = q;
  applyQuality(out);
  if (out.forge) applyForge(out);
  return out;
}

// 隠しレベル → 表示ランク R1-R20 (図鑑の枠色・発見演出に使う)
// lv は 1-200 (全100迷宮の lootLv 帯に対応)。10lv ごとに 1 ランク上がり、
// 1ランクの差で性能が明確に伸びる (R1=lv1-10 … R20=lv191-200)。
export function lvToRank(lv) {
  return Math.min(20, Math.max(1, Math.ceil((lv || 1) / 10)));
}

// slot種別 → 装備キー
export function slotKeyFor(item, member) {
  if (item.slot === "weapon") return "weapon";
  if (item.slot === "shield") return "shield";
  if (item.slot === "body") return "body";
  if (item.slot === "head") return "head";
  if (item.slot === "hands") return "hands";
  if (item.slot === "feet") return "feet";
  if (item.slot === "acc") return member.equip.acc1 ? (member.equip.acc2 ? "acc1" : "acc2") : "acc1";
  return null;
}

// 共有パレット
const P = {
  ".": null,
  k: "#0d0b10", // 黒縁
  // 鋼: 深影 / 影 / 中間 / 明 / 鏡面
  e: "#262433", g: "#4a4a5c", v: "#7c7d88", w: "#b5b2ad", x: "#e9e3d6",
  // 金: 深影 / 影 / 地 / 輝き
  O: "#2e2016", o: "#6b5221", y: "#a88a3e", Y: "#dcc78a",
  // 木: 深影 / 影 / 地 / 明
  S: "#1c130f", s: "#35241a", n: "#574030", N: "#7d6449",
  // 革: 深影 / 影 / 地 / 明
  D: "#241a16", d: "#4b3628", l: "#7a5f45", L: "#a88f70",
  // 赤 (紅玉・血): 影 / 地 / 明
  q: "#3a1016", r: "#7a2028", R: "#b8564a",
  // 青 (蒼玉・水): 影 / 地 / 明
  u: "#1a2234", b: "#34506e", c: "#7aa0b4",
  // 紫: 深影 / 影 / 地 / 明
  J: "#1c1426", j: "#3b2a4c", p: "#66507a", i: "#a08cb0",
  // 緑: 影 / 地 / 明
  t: "#1a2618", G: "#3e5a34", h: "#7d9a62",
  // 骨・象牙: 影 / 地 / 明
  z: "#4a4236", I: "#8f8670", B: "#c9c0a6",
  // 布 (藍鼠。染め色を素直に受ける): 深影 / 影 / 地 / 明
  F: "#17161f", f: "#2c2b3a", C: "#484a5e", A: "#6e7088",
  m: "#a0566a", // 桃 (肉・舌)
};

const sprite = (art) => ({ art, palette: P });

export const ITEMS = {
  // ===== 武器 =====
  dagger: {
    id: "dagger", name: "ダガー", slot: "weapon", cat: "dg", lv: 1, atk: 3, hit: 1, dice: "1d4", swings: 1, price: 30, classes: null,
    desc: "行き倒れの傭兵が最後まで手放さなかったような、ありふれた両刃の短剣。血脂を吸った柄革は黒ずみ、誰の手にも妙に馴染む。",
    ...sprite([
      "........................",
      "........................",
      "....................e...",
      "..................eewk..",
      "................eexwk...",
      "...............ewxwgk...",
      "..............ewxwgk....",
      ".............ewxwgek....",
      "............ewxwgek.....",
      ".........OO.exwgek......",
      "........OYykcbgek.......",
      "........Oyyybukk........",
      ".........kooyk..........",
      "........Dldoyyk.........",
      "......ODLlDkyok.........",
      ".....OYyodk.kk..........",
      "....OYyyok..............",
      "....OoooOk..............",
      ".....kOOk...............",
      "......kk................",
      "........................",
      "........................",
      "........................",
      "........................",
    ]),
  },
  shortSword: {
    id: "shortSword", name: "ショートソード", slot: "weapon", cat: "ls", lv: 3, atk: 6, hit: 2, dice: "1d6+1", swings: 1, price: 120, classes: null,
    desc: "兵士崩れの亡骸からよく見つかる、無銘の片手剣。鍛えは確かで、迷宮の闇の中で数多の持ち主を看取ってきた。",
    ...sprite([
      "........................",
      ".....................e..",
      "...................eewk.",
      ".................eexwk..",
      "................ewxwgk..",
      "...............ewxwgk...",
      "..............evxvgek...",
      ".............evxggek....",
      "............ewxveek.....",
      "......O....ewxveek......",
      ".....Oyk..ewxveek.......",
      "....OYok.ewxgeek........",
      "...Oyoyokwxveek.........",
      "....kkyyyxveek..........",
      "......kyyRrek...........",
      "......DLyrqk............",
      "...OODlddyyokO..........",
      "..OYYolDkkyYYyk.........",
      ".OYYyyOk..kYok..........",
      ".OoyyoOk..Oyk...........",
      ".OoooOOk...k............",
      "..kOOOk.................",
      "...kkk..................",
      "........................",
    ]),
  },
  battleAxe: {
    id: "battleAxe", name: "バトルアックス", slot: "weapon", cat: "ax", lv: 8, atk: 13, hit: 3, dice: "2d6", swings: 1, twoHanded: true, price: 480, classes: null,
    desc: "骨ごと断つことしか考えられていない、無骨な両手斧。刃こぼれの一つ一つが誰かの最期だ。絶大な威力だが盾は持てない。",
    ...sprite([
      ".........eeeeee.........",
      "........exxwwwwk........",
      ".......exwwvvvwk........",
      ".......exwgvvvwk..S.....",
      "......exwgggvvwk.SNk....",
      "......exwggggvvwkNnsk...",
      "......exeeggggeYOssk....",
      "......exeeeegeYYyOk.....",
      ".......kkkeeeYYyook.....",
      "..........kkOYyoovk.....",
      "...........SNOoogvk.....",
      "..........SNnsOgggvk....",
      ".........SNnskkkgggk....",
      "........SNnsk..eggk.....",
      ".......SNnsk....kk......",
      "......SNnsk.............",
      ".....DLnsk..............",
      "....DLdlk...............",
      "...Dldlk................",
      "..DLddk.................",
      "eDLdlk..................",
      "wNdlk...................",
      "wgsk....................",
      "kggk....................",
    ]),
  },
  warHammer: {
    id: "warHammer", name: "ウォーハンマー", slot: "weapon", cat: "mc", lv: 6, atk: 9, pie: 1, hit: 2, dice: "1d8+1", swings: 1, price: 300, classes: null,
    desc: "柄に祈りの文句が刻まれた戦槌。刃を禁じられた聖職者が、骸を「鎮める」ために編み出した得物だという。骨ある敵に重く響く。",
    ...sprite([
      "............ewk.........",
      "...........ewwwk....ee..",
      "..........ewvvwwk.eexgk.",
      ".........ewvvvgwwkxxgk..",
      "........ewvvvgggwYxgk...",
      "........eevgggggYoygk...",
      ".........keggggYyyok....",
      "..........keggYbbovk....",
      "...........keYooovvvk...",
      "...........OYyooggvvvk..",
      "...........SNyokkggvvk..",
      "..........SNskk..kkkvvk.",
      ".........SNsk.......kk..",
      "........SNsk............",
      ".......SNsk.............",
      "......SNsk..............",
      ".....DLsk...............",
      "....Dldk................",
      "...DLdk.................",
      "..Dldk..................",
      "eDLdk...................",
      "wNdk....................",
      "wgk.....................",
      "ggk.....................",
    ]),
  },
  magicStaff: {
    id: "magicStaff", name: "魔法の杖", slot: "weapon", cat: "st", lv: 5, atk: 4, int: 2, hit: 0, dice: "1d4", swings: 1, mp: 4, price: 260, classes: null,
    desc: "蒼い宝玉を戴いた杖。玉の奥では囚われた精霊の光がゆっくりと脈打ち、握る者の魔力と知性を研ぎ澄ます。",
    ...sprite([
      "........................",
      "................uuu.....",
      "..............Ouccbk....",
      ".............OYxxcbbk...",
      ".............uccxcbbuk..",
      ".............ubcbbbuuk..",
      "............OYbbbbuuuk..",
      "............OYYuuuuuok..",
      ".............kyyuuukok..",
      "............SNsokooook..",
      "...........Snskkookkk...",
      "..........SNsk..kk......",
      ".........OYok...........",
      "........SNsk............",
      ".......SNsk.............",
      "......Snsk..............",
      ".....SNsk...............",
      "....SNSk................",
      "...SNsk.................",
      "..SNsk..................",
      ".OYsk...................",
      "Snok....................",
      "Ssk.....................",
      ".k......................",
    ]),
  },

  // ===== 盾 =====
  woodShield: {
    id: "woodShield", name: "木の小盾", slot: "shield", sk: "buckler", weight: "light", lv: 2, vit: 1, agi: 1, hp: 5, price: 80, classes: null,
    desc: "カシの板をびょうで重ねた小さな盾。軽く、拳の先で受け流すように使う。表面には先代の持ち主のものらしい爪痕が走るが、まだ十分に矢と牙をそらせる。",
    ...sprite([
      "...........ee...........",
      ".......eeeewvkeee.......",
      "......ewwwvvvvwwwk......",
      ".....ewvxvvNNvgxvwk.....",
      "....ewvvsSNNSnSSvvwk....",
      "...ewvNNNSNNSNSSNsgek...",
      "..ewvvvvSNvSNgSNggggek..",
      ".evvvNNSNSSNnSNnsssggek.",
      ".ewxSNSNNSnxwnSnsssSwek.",
      ".evvSsSNNxxxwvgssssSgek.",
      ".evvSNNsNxxxwvgsssSSggk.",
      "ewvsSNNnwxwwgvgessSSSgek",
      "ewvnSsnnvwwvggeesSSSSgek",
      ".kvvSnnnnvvggeesSSSSggk.",
      ".ewvSnnnseeeeeesSSSSgek.",
      ".ewxSssssSseeSSSSsSSwek.",
      ".ewvvssssSssSSSSSSSggek.",
      "..kwgvvvvvvvggggggggek..",
      "...kwgSSSSsSSSSSSSgek...",
      "....keggSSSSsSSSggek....",
      ".....kegwggSSggwgek.....",
      "......keeeggggeeek......",
      ".......kkkkeekkkk.......",
      "...........kk...........",
    ]),
  },
  kiteShield: {
    id: "kiteShield", name: "剥げ紋の大盾", slot: "shield", sk: "kite", weight: "heavy", lv: 7, vit: 6, price: 240, classes: null,
    desc: "騎士団の紋章が剥げ落ちた大盾。掲げた誓いは廃れても、鋼の守りは廃れていない。前衛の半身を覆って守る。",
    ...sprite([
      "..eeeeeeeeeeeeeeeeeeee..",
      ".evvvvvvvvvvvgvvgvvvvvk.",
      "evyooooooooooooooooooovk",
      "evoccccccccYycccbbbbuovk",
      "evoYcccccccYocccbbbbYovk",
      "evoccccccccYocccbbbbuovk",
      "evoccccccccRyccbbbbbbovk",
      "evoYYYYYYYRxroYYYYYYyovk",
      "evoyoooooooqoooooooooovk",
      "evoccccccccYobucbucbuovk",
      "evoccccccccYobucbucuuovk",
      "evoYcccccccYoucbucbuYovk",
      ".kvocccccbbYobbucbucovk.",
      ".evocccbbbbYobucbucuovk.",
      "..kvobbbbbbYobucuucovk..",
      "..evobbbbbuYoucuucuovk..",
      "...kgobbbbbYobuuuuovk...",
      "....kvYbbbbYouuuuYvk....",
      ".....kvobbuYouuuovk.....",
      "......kvouuYouuogk......",
      ".......kvouYouovk.......",
      "........kvoyoovk........",
      ".........kvvvvk.........",
      "..........kkkk..........",
    ]),
  },

  // ===== 体 =====
  robe: {
    id: "robe", name: "ローブ", slot: "body", lv: 2, vit: 1, int: 1, mp: 3, price: 90, classes: null, weight: "cloth",
    desc: "魔除けの紋様を縫い込んだマント。糸は月のない夜に紡がれたといい、まとう者の魔力を少しだけ高める。",
    ...sprite([
      "........JJJJJJJJ........",
      ".......Jiipiiiipk.......",
      "......JpjJJJJJJppk......",
      ".....JiipJJJJJJjjJk.....",
      "....JiiiiyFFFFyjjJJk....",
      "...JppiiiiyFFyjjjJJJk...",
      "..JipiiiiiiYypjjjJJjjk..",
      ".JipppipYiiYopjjjJpjjjk.",
      ".JippjpiiiiYopjYjJpjjJk.",
      "JippjpJpiiiYopjjjJjjjjJk",
      "JipyjjJiiiiyopjjjJjjJJJk",
      "JpjjjjJCCCCcbCCCCJJJYJJk",
      "JpjjjJkiiiiYypjjjkjJJJJk",
      "OyyjjJkiiiiYopjjjkjJJYyk",
      ".kooyykiiiiYopjjjkyoook.",
      "..kkkkiiiipYopjjjJkkkk..",
      ".....JiijiiYopjJjJk.....",
      "....JiiYjiiYojjJjJJk....",
      "....JpiijiiYopjJjJJk....",
      "...JpiiijiiYopjJYJJJk...",
      "...JpiiijiiYopjJjJJJk...",
      "..Ooooyyoyoooyyyyyoyyk..",
      "...kkkkkkkkkkkkkkkkkk...",
      "........................",
    ]),
  },
  leatherArmor: {
    id: "leatherArmor", name: "革の鎧", slot: "body", lv: 4, vit: 3, agi: 1, price: 160, classes: null, weight: "light",
    desc: "魔獣の革をなめした軽鎧。幾針もの縫い直しの跡は、これを着て生き延びた者たちの記録だ。軽くて動きやすい。",
    ...sprite([
      "...DDDD..........DDDD...",
      "..DLlLLk........DlddDk..",
      ".DLLlLLLkkkkkkODddddDDk.",
      "DdlllldlykkkkkkoDDDDDDDk",
      "DDDDDDDDyykkkkyoDDDDDDDk",
      "DLLYldDLlLyyyylldLLdYdDk",
      ".kldddDkLLLLdlldllddDkk.",
      ".DLLldDLLLlLdldddLLldDk.",
      "..kldkdllllLdddddDldkk..",
      "...klllllllLdddDDDDDk...",
      "...DdddddddLddDDDDDDk...",
      "...DDddddddldDDDDDDDk...",
      "....kDDDDdDLdDDDDDDk....",
      "....DDDDDDDLdDDDDDDk....",
      ".....klllldyylllldk.....",
      ".....DdDDDDoodDDDDk.....",
      "....DlLLLLLlllddDDDk....",
      "....DdllllldddDDkkkD....",
      "...DlLYLLLLdlldddYDDk...",
      "...DdldlllldddDDDkkkD...",
      "..DllLLLLLlllldddDDDDk..",
      "..DdllllldddddDDDkkkk...",
      "...kkkkkkkkkkkkkk.......",
      "........................",
    ]),
  },
  plateArmor: {
    id: "plateArmor", name: "プレートアーマー", slot: "body", lv: 12, vit: 11, agi: -1, price: 600, classes: null, weight: "heavy",
    desc: "全身を鋼で固めた重鎧。継ぎ目の奥に沈む黒ずみは錆か、それとも前の持ち主の名残か。鉄壁だが少し鈍重になる。",
    ...sprite([
      "..ee.....OOOOOO.....ee..",
      ".exxk...OYyyYYyk...egvk.",
      "ewxxxkeOyyooooookeeggevk",
      "ewwwwwwkyokkkkYokgeeeeek",
      "ggggggggvyyyyyoveeeeeeee",
      "eeeeeeeevwwwwwvgeeeeeeee",
      "kgvvvvvwvwwvvvggveekkkkk",
      "evwwwwwvwwwvvvgggggeeeek",
      ".kvggwwvwwRrRvgggegkkkk.",
      "..kwwwwwwwrrqvgggeegek..",
      "...kvvvvvvvqggeeekkkk...",
      "...evwwwwwwvvvgggeeek...",
      "....kwvvwwvvvggggeek....",
      "....evvvvgvgggeeekk.....",
      "....evvvvvvgggeeeeek....",
      ".....kdddddYydddddk.....",
      "....ewgwgvevevegeek.....",
      "....egwgwgvevegegkek....",
      "...egwgwgwegevegeekek...",
      "...ewgwgwgvevegegkek....",
      "..evgwgvgwevevegeekek...",
      "..eewgwgwgvevegegkekek..",
      "...kkkkkkkkkkkkkk.k.k...",
      "........................",
    ]),
  },

  // ===== 頭 =====
  cap: {
    id: "cap", name: "布の帽子", slot: "head", lv: 1, vit: 1, aRes: { poison: 0.1 }, price: 30, classes: null, weight: "cloth",
    desc: "擦り切れた布の帽子。墓土の冷たさと滴る汚水からは守ってくれる。ないよりはまし、と誰もが言う。",
    ...sprite([
      "........................",
      "........................",
      "..........FFFF..........",
      "........FFAAFCkF........",
      ".......FAAACFAfCk.......",
      "......FAAAAAFACCfk......",
      ".....FAAAAAAFCCCffk.....",
      ".....FAACAACFCffffk.....",
      "....FAAAAffffffffFFk....",
      "....FCAAfkkkkkkffFFk....",
      "....FCCfkFFFFFFkfFFk....",
      "....FCCfkkkkkkkkfFFk....",
      "....FfffkkkkkkkkfFFk....",
      "....FfFffkkkkkkfFFFk....",
      "...FCFFFFfkkkkfFFFFCk...",
      "..FAACFFFFFFFFFFFAACFk..",
      ".FAAAACCfFFyyAACCCCfFFk.",
      ".FCAAFAAAACCCCCfffFFFFk.",
      ".FCAAAAFAACCCCCfFfFFFFk.",
      ".FFfffffffFFFFFFFFFFFFk.",
      "..kkkkkkkkkkkkkkkkkkkk..",
      "........................",
      "........................",
      "........................",
    ]),
  },
  ironHelm: {
    id: "ironHelm", name: "面当ての鉄兜", slot: "head", lv: 5, vit: 3, aRes: { charm: 0.1 }, price: 150, classes: null, weight: "heavy",
    desc: "面当てつきの鉄兜。覗き穴の奥は常に闇で、かぶった者の顔を誰にも思い出させない。頭部をしっかり守る。",
    ...sprite([
      "..............qqq.......",
      "...........qqqRRrk......",
      "..........qrRRRrrqk.....",
      "........eqrRrrrqqk......",
      "......eewwgxgvvvke......",
      ".....ewwvwgxgvvvggk.....",
      "....ewwwwwvxgvvvggek....",
      "...evwwwvwvxgvvvggeek...",
      "...ewwwwwwvxgvvvggeek...",
      "..Oyyyoyyyyyyyyyyyyyyk..",
      "..evwYwwwwvwgvvvggYeek..",
      "..evwkkkkkkwgkkkkkkeek..",
      "..evwwwwwwvwgvvvggeeek..",
      "..evwvwwwwvwkkvvggeeek..",
      "..evwwwwwwvwkkgvgkekek..",
      "..evwwwwwwgwkkvvggeeek..",
      "...kwvwwwwvwkkvvgkekk...",
      "...ewywwwwvvgvvvggYek...",
      "....kwwvwwgwggvvggek....",
      "....OyYYYYYYYYYYYYyk....",
      ".....kyoooooooooook.....",
      "......kkkkkkkkkkkk......",
      "........................",
      "........................",
    ]),
  },

  // ===== 足 =====
  leatherBoots: {
    id: "leatherBoots", name: "革のブーツ", slot: "feet", lv: 2, vit: 1, agi: 2, price: 70, classes: null, weight: "light",
    desc: "丈夫な革の長靴。底に染みた泥は幾層にも重なり、どの層がどの迷宮のものかもう分からない。素早さがわずかに上がる。",
    ...sprite([
      "........................",
      "........................",
      "........................",
      ".............DDDDDDDD...",
      "............DdddddddDk..",
      "............SSSSSSSSSk..",
      ".............kddDDSSk...",
      "......DDDDDDDkddDkSSk...",
      ".....DLlLLLLLlkOkykOk...",
      ".....DDDDDDDDDkdDkSSk...",
      "......kLLlddDkddDDSSk...",
      "......DLLlldDkddDSSSk...",
      "......OoooYookdDDSSSk...",
      "......DLLlldDkDDSSSSk...",
      "......DLLlldDkDDDSSSSk..",
      ".....DLLLlddDkDDDSSSSk..",
      "...DDLLLlldDDkSSSSSSSSk.",
      "..DllLLllddDDkkkkkSSSk..",
      ".DlLLLLlllddDDk...kkk...",
      ".DlLLLllllddDDk.........",
      ".Ssssssssssssssk........",
      "..kssskkkkksssk.........",
      "...kkk.....kkk..........",
      "........................",
    ]),
  },
  ironGreaves: {
    id: "ironGreaves", name: "鉄の脚甲", slot: "feet", lv: 6, vit: 3, price: 180, classes: null, weight: "heavy",
    desc: "鋼のすね当て。骨の散らばる床を踏み砕いて進むためのものであり、自分が踏み砕かれないためのものでもある。",
    ...sprite([
      "........................",
      ".............eeeee......",
      "............exxwvgk.....",
      "...........evvvYggek....",
      "...........eeeeeeeek....",
      "............kwevvgek....",
      "...........egggeekk.....",
      "...........ewewvggek....",
      "...........ewewvggek....",
      "...........egggeekk.....",
      "...........ewewvggek....",
      "...........ewewvggek....",
      "...........OYYYyooOk....",
      "..........ewwwvvgeek....",
      ".........eggggeeekk.....",
      ".......eevwwwvvggeek....",
      ".....eeggggggeeekkk.....",
      "....evwwwwvvvvggeeek....",
      "...egggggggeeeekkkk.....",
      "..ewwwwwwwvvvgggeeek....",
      "...keeeeeeeeeeeeeeek....",
      "....kkkkkkkkkeeeekk.....",
      ".............kkkk.......",
      "........................",
    ]),
  },

  // ===== 小手 =====
  leatherGloves: {
    id: "leatherGloves", name: "革の手袋", slot: "hands", lv: 1, vit: 1, price: 50, classes: null, weight: "light",
    desc: "しなやかな革の手袋。罠の毒針から指先を、冷たい亡者の握手から手首を、わずかながら守ってくれる。",
    ...sprite([
      "........................",
      "........................",
      "..........DD............",
      ".......DDDLdkDD.........",
      "......DLdkLdkLdkDD......",
      "......DLdkLdkLdkLdk.....",
      "......DLdkLdkLdkLdk.....",
      "......DLdkLdkLdkLdk.....",
      "......DLdkLdkLdkLdk.....",
      "...DD.DdLLdllddddDk.....",
      "..DLlkklLLLLdlddDDk.....",
      "..DlllklLlLLllddDDk.....",
      "...kldlddddddDDDDDk.....",
      "....kldddddDDDDDDDk.....",
      ".....kDDDDDDDDDDDDk.....",
      "......kDDDDDDDDDDk......",
      "......DdlllddDDSSk......",
      ".....DdlllldddDDSSk.....",
      ".....DdllllldlDlSlk.....",
      ".....DdlllldddDDSSk.....",
      ".....SSSSSSSSSSSSSk.....",
      "......kkkkkkkkkkkk......",
      "........................",
      "........................",
    ]),
  },
  silverGloves: {
    id: "silverGloves", name: "銀の小手", slot: "hands", lv: 7, vit: 3, atk: 1, price: 280, classes: null, weight: "light",
    desc: "銀細工の籠手。銀は穢れた者に触れると鈍く曇り、持ち主に警告するという。守りを固めつつ拳撃にも冴える。",
    ...sprite([
      "........................",
      "........................",
      "..........ee............",
      ".......eeewgkee.........",
      "......ewgkwgkwgkee......",
      "......ewgkwgkwgkwgk.....",
      "......ewgkwgkwgkwgk.....",
      "......ewgkwgkwgkwgk.....",
      "......ewgkwgkwgkwgk.....",
      "...ee.egwwgvvggggek.....",
      "..ewvkkvwwwwgvggeek.....",
      "..evvvkvwvwwvvggeek.....",
      "...kvgvggggggeeeeek.....",
      "....kvgggggeeeeeeek.....",
      ".....keeeeeeeeeeeek.....",
      "......keeeeeeeeeek......",
      "......egvvvggeeeek......",
      ".....egvvvvgggeeeek.....",
      ".....egvvvvvgvevevk.....",
      ".....egvvvvgggeeeek.....",
      ".....eeeeeeeeeeeeek.....",
      "......kkkkkkkkkkkk......",
      "........................",
      "........................",
    ]),
  },
  ironGauntlets: {
    id: "ironGauntlets", name: "無骨な鉄籠手", slot: "hands", lv: 6, vit: 4, agi: -1, price: 240, classes: null, weight: "heavy",
    desc: "重厚な鉄の籠手。指の自由と引き換えに、握った得物ごと腕を守り抜く。少し動きが鈍る。",
    ...sprite([
      ".........eee............",
      ".....eeeewvekeee........",
      "....ewvekwgekwvek.......",
      "....ewvekvvekwvekeee....",
      "....egekkgekkgekkvvek...",
      "....ewgekwvekwgekwvek...",
      "....ewvekwvekwvekgek....",
      "....egekkgekkgekkvvek...",
      "..eekwvekwvekwvekwvek...",
      ".ewvkwxwvwxwwwxwwwxvk...",
      "ewvvvvggggggggggggggk...",
      "eevvgwweeewwxwwvggggk...",
      ".kevgvveeevvwvvggeeek...",
      "..kegvweeewvwvvggeeek...",
      "...kwweeewwvwvgggeeek...",
      "...egveeevvgggeeeeeek...",
      "...OyYYYYYYyyyoooOOOk...",
      "..evwwvwwvvvvvgggeeeek..",
      "..evwwwwwvvvvvgggeeeek..",
      "..eegggggggeeeeeeeeeek..",
      "..evwvwwwwvvvvgggeeeek..",
      "..OyYYYYYYyyyyoooOOOOk..",
      "...kkkkkkkkkkkkkkkkkk...",
      "........................",
    ]),
  },

  // ===== アクセサリ =====
  powerRing: {
    id: "powerRing", name: "怒りの指輪", slot: "acc", lv: 20, atk: 4, price: 240, classes: null,
    desc: "はめた瞬間、自分のものではない怒りが血管を駆け抜ける指輪。腕力がみなぎり、攻撃力が上がる。",
    ...sprite([
      "........................",
      "..........qqqq..........",
      ".........qRRRRk.........",
      "........qRxRRrrkO.......",
      ".......OoRRrrrrqok......",
      ".......qRrrrrrqqOk......",
      "........kqrrrqqkk.......",
      ".........kqqqqk.........",
      ".........Ooyoook........",
      ".......OOoyYYyyok.......",
      "......OooooOOOoOOk......",
      "....OOokkkkkkkkkkOkO....",
      "...Oook..........kOOk...",
      "...Oook..........OOOk...",
      "..Oook............kOOk..",
      "..Ooook..........OOOOk..",
      "..Oyyyk..........Ooook..",
      "..OyyyykO......OOooook..",
      "...kyyyYYkOOOOOyyoook...",
      "...OyyyYYYYYYyyyyoook...",
      "....kkyYYYYYYyyyyokk....",
      "......kYYYYYYyyyyk......",
      ".......kkkkkkkkkk.......",
      "........................",
    ]),
  },
  guardAmulet: {
    id: "guardAmulet", name: "守りの護符", slot: "acc", lv: 20, vit: 4, price: 240, classes: null,
    desc: "崩落した聖堂から唯一無傷で掘り出された護符。宿された加護はまだ生きている。防御力が上がる。",
    ...sprite([
      "...O................OO..",
      "..Ook..............Oyok.",
      "..Ooyk............Oook..",
      "...kyok..........Oook...",
      "....kyok........Oook....",
      ".....kokO......Okok.....",
      "......koyk....Oyok......",
      ".......kyk....Ook.......",
      "........kok..Ook........",
      ".........kokOok.........",
      "..........kyYk..........",
      ".........OyoOyk.........",
      "........OYYYYYYk........",
      "........OYxccbYk........",
      "........OYccbbYk........",
      ".......OYcxccbuok.......",
      ".......Oyxxccbbok.......",
      "......OYYcccbbuook......",
      ".......kYcbbbbuok.......",
      ".......OYbbbbuuok.......",
      "........kobuuuok........",
      ".........kooook.........",
      "..........kkkk..........",
      "........................",
    ]),
  },
  swiftRing: {
    id: "swiftRing", name: "俊足の指輪", slot: "acc", lv: 28, agi: 4, price: 390, classes: null,
    desc: "風の精が封じられた指輪。耳元で絶えず微かな囁きがする。聞き取れた者はいない。素早さが上がる。",
    ...sprite([
      "........................",
      "........................",
      "........................",
      ".........eeeeee.........",
      "........exxwwggk........",
      ".......exxwwevvgk.......",
      "......ewwwweeeggek......",
      "......evvvevegeeek......",
      "......evvvggegeeek......",
      ".....egggggeeeeeeek.....",
      "....thGkkeeeeeekkhGk....",
      "...egtk..kkkkkk..ktek...",
      "..egggk..........eeeek..",
      "..egggk..........eeeek..",
      "..egggk..........eeeek..",
      "..evvvk..........egggk..",
      "..evvvwkee....eeevgggk..",
      "..evvgwwwwkeeevvvvgggk..",
      "...kgvwwwwvwvvvvvvggk...",
      "....kvvwwwwwwvvvgvgk....",
      ".....kvwwwwwwvvvvvk.....",
      "......kkwewwevvekk......",
      "........kkkkkkkk........",
      "........................",
    ]),
  },
  lifeAmulet: {
    id: "lifeAmulet", name: "生命の護符", slot: "acc", lv: 32, hp: 16, price: 480, classes: null,
    desc: "今も微かに鼓動を続ける宝玉の護符。元が誰の心臓だったのかは、考えない方がいい。最大HPが上がる。",
    ...sprite([
      "...O................OO..",
      "..Ook..............Oyok.",
      "..Ooyk............Oook..",
      "...kyok..........Oook...",
      "....kyok........Oook....",
      ".....kokO......Okok.....",
      "......koyk....Oyok......",
      ".......kyk....Ook.......",
      "........kok..Ook........",
      ".........kokOok.........",
      "..........kyYk..........",
      ".........OyoOyk.........",
      "........OYYYYYYk........",
      "........OYxRRrYk........",
      "........OYRRrrYk........",
      ".......OYRxRRrqok.......",
      ".......OyxxRRrrok.......",
      "......OYYRRRrrqook......",
      ".......kYRrrrrqok.......",
      ".......OYrrrrqqok.......",
      "........korqqqok........",
      ".........kooook.........",
      "..........kkkk..........",
      "........................",
    ]),
  },
  amberTalisman: {
    id: "amberTalisman", name: "琥珀の守符", slot: "acc", lv: 44, vit: 6, mp: 6, price: 800, classes: null,
    eDef: { el: "earth", lv: 1 },
    desc: "太古の樹液に名も知れぬ羽虫が封じられた琥珀。幾万年を閉じ込めた静けさが、土の理から持ち主を匿う。",
    ...sprite([
      "...O................OO..",
      "..Ook..............Oyok.",
      "..Ooyk............Oook..",
      "...kyok..........Oook...",
      "....kyok........Oook....",
      ".....kokO......Okok.....",
      "......koyk....Oyok......",
      ".......kyk....Ook.......",
      "........kok..Ook........",
      ".........kokOok.........",
      "..........kyYk..........",
      ".........OyoOyk.........",
      "........OYYYYYYk........",
      "........OYxYYoYk........",
      "........OYYYooYk........",
      ".......OYYxYYoOok.......",
      ".......OyxxYYoook.......",
      "......OYYYYYooOook......",
      ".......kYYooooOok.......",
      ".......OYooooOOok.......",
      "........kooOOOok........",
      ".........kooook.........",
      "..........kkkk..........",
      "........................",
    ]),
  },
  emberRing: {
    id: "emberRing", name: "残り火の指輪", slot: "acc", lv: 67, atk: 5, price: 1700, classes: null,
    eAtk: { el: "fire", lv: 1 },
    desc: "決して冷めないおき火をはめ込んだ指輪。指先に伝う熱が、振るう得物の先にまで燃え移る。",
    ...sprite([
      "........................",
      "..........qqqq..........",
      ".........qRRRRk.........",
      "........qRxRRrrkO.......",
      ".......OoRRrrrrqok......",
      ".......qRrrrrrqqOk......",
      "........kqrrrqqkk.......",
      ".........kqqqqk.........",
      ".........Ooyoook........",
      ".......OOoyYYyyok.......",
      "......OooooOOOoOOk......",
      "....OOokkkkkkkkkkOkO....",
      "...Oook..........kOOk...",
      "...Oook..........OOOk...",
      "..Oook............kOOk..",
      "..Ooook..........OOOOk..",
      "..Oyyyk..........Ooook..",
      "..OyyyykO......OOooook..",
      "...kyyyYYkOOOOOyyoook...",
      "...OyyyYYYYYYyyyyoook...",
      "....kkyYYYYYYyyyyokk....",
      "......kYYYYYYyyyyk......",
      ".......kkkkkkkkkk.......",
      "........................",
    ]),
  },
  tideBead: {
    id: "tideBead", name: "潮霊の数珠", slot: "acc", lv: 83, mp: 12, price: 2500, classes: null,
    eDef: { el: "water", lv: 1 },
    desc: "溺死者の眠る入江で拾い集められた青珠の連なり。耳を澄ますと遠い潮騒が聞こえ、火の災いを波が払う。",
    ...sprite([
      "...O................OO..",
      "..Ook..............Oyok.",
      "..Ooyk............Oook..",
      "...kyok..........Oook...",
      "....kyok........Oook....",
      ".....kokO......Okok.....",
      "......koyk....Oyok......",
      ".......kyk....Ook.......",
      "........kok..Ook........",
      ".........kokOok.........",
      "..........kyYk..........",
      ".........OyoOyk.........",
      "........OYYYYYYk........",
      "........OYxccbYk........",
      "........OYccbbYk........",
      ".......OYcxccbuok.......",
      ".......Oyxxccbbok.......",
      "......OYYcccbbuook......",
      ".......kYcbbbbuok.......",
      ".......OYbbbbuuok.......",
      "........kobuuuok........",
      ".........kooook.........",
      "..........kkkk..........",
      "........................",
    ]),
  },
  galeAnklet: {
    id: "galeAnklet", name: "風切りの足環", slot: "acc", lv: 99, agi: 7, price: 3460, classes: null,
    desc: "墜ちたハーピーの風切羽を編み込んだ足環。一歩ごとに体が軽くなり、踏んだ床のきしみすら置き去りにする。",
    ...sprite([
      "........................",
      "..........tttt..........",
      ".........thhhhk.........",
      "........thxhhGGkO.......",
      ".......OohhGGGGtok......",
      ".......thGGGGGttOk......",
      "........ktGGGttkk.......",
      ".........kttttk.........",
      ".........Ooyoook........",
      ".......OOoyYYyyok.......",
      "......OooooOOOoOOk......",
      "....OOokkkkkkkkkkOkO....",
      "...Oook..........kOOk...",
      "...Oook..........OOOk...",
      "..Oook............kOOk..",
      "..Ooook..........OOOOk..",
      "..Oyyyk..........Ooook..",
      "..OyyyykO......OOooook..",
      "...kyyyYYkOOOOOyyoook...",
      "...OyyyYYYYYYyyyyoook...",
      "....kkyYYYYYYyyyyokk....",
      "......kYYYYYYyyyyk......",
      ".......kkkkkkkkkk.......",
      "........................",
    ]),
  },
  gravewardBell: {
    id: "gravewardBell", name: "墓守の鈴", slot: "acc", lv: 114, hp: 40, price: 4480, classes: null,
    eDef: { el: "dark", lv: 1 },
    desc: "亡者の徘徊を報せるために墓地に吊るされていた銀鈴。音は生者にしか聞こえず、鳴る間は闇の爪が届かない。",
    ...sprite([
      "..........eeee..........",
      ".........exwwwk.........",
      "........exgkkxwk........",
      "........ewgkkxgk........",
      ".........kwwggk.........",
      ".........ekxgke.........",
      "........exxwwgek........",
      ".......exxwwwgeek.......",
      "......ewxxxwwggeek......",
      "......ewxxxwwggeek......",
      "......ewxwxwwggeek......",
      "......ewwwggggeeek......",
      ".....ewxxxxwwwggeek.....",
      ".....ewxxxxwwwggeek.....",
      "....egxxxxxwwwggeeek....",
      "...ewxxxxxwwwwgggeeek...",
      "..egxxxxxxwwwwgggeeeek..",
      "..ewxxxxxxwwwwgggeeeek..",
      "...keeeeeeeeeeeeeeeek...",
      "....kkkkkkkxwkkkkkkk....",
      ".........ewwgek.........",
      "..........keek..........",
      "...........kk...........",
      "........................",
    ]),
  },
  dawnMedal: {
    id: "dawnMedal", name: "暁光の勲章", slot: "acc", lv: 137, atk: 9, vit: 9, price: 6330, classes: null,
    eAtk: { el: "light", lv: 1 },
    desc: "夜明けを取り戻した英雄に授けられたという勲章。授与の記録は焼け、功績だけが金属の中で燃え続けている。",
    ...sprite([
      "....D..............DD...",
      "...Ddk............DDDk..",
      "...Dddk..........DDDk...",
      "....kddk........DDDk....",
      ".....kddk......DDDk.....",
      "......kddk....DDDk......",
      ".......kddk..DDDk.......",
      "......O.kddkDDDk.O......",
      ".....OYkkYYkkYYkOYk.....",
      ".....OYYkYYYYYYkYYk.....",
      "......kYYooYyooYYk......",
      "...OOOkYoYYYYyoOokOOO...",
      "..OYYYYyYYYRryoOoooook..",
      "...kkyYoYYxRrroOOookk...",
      ".....kYoyyRrrqoOOok.....",
      "...OOYYoyyrrqqOOOookO...",
      "..OYYyYooooqqOOOOooook..",
      "...kkkkYoOOOOOOOokkkk...",
      "......OooOOOOOOook......",
      ".....Oooooooooooook.....",
      ".....Ookkooooookkok.....",
      "......k.Oookkook.k......",
      "........OookOook........",
      ".........kk..kk.........",
    ]),
  },
  abyssEye: {
    id: "abyssEye", name: "深淵の瞳", slot: "acc", lv: 161, mp: 24, price: 8600, classes: null,
    eAtk: { el: "dark", lv: 1 },
    desc: "覗いた者を覗き返すという、正体不明の眼球の剥製。まぶたのない瞳は瞬きの代わりに、持ち主の敵を見据える。",
    ...sprite([
      "........................",
      "........................",
      "........eeeeezzz........",
      "......eexxxxwBBBkz......",
      ".....exxwxxxxBrBBIk.....",
      "....exxxxxxxxrBBBIIk....",
      "...exxxxxxxxxrBBBIIzk...",
      "...exxxxxxxxuuBBIIIzk...",
      "..exxxxxxuucccuuIIIzzk..",
      "..exxxxxxucckccuuIIzzk..",
      "..exxrqxucxbkbbbuIzzzk..",
      "..qrrxwqucxbkkbbbuzzzk..",
      "..zBBBIqucbbkkbbbuzzzk..",
      "..zBBBBBucbbkkbbbzzzzk..",
      "..zBBBBBucbbkkbbuzzrrk..",
      "..zIIIIIIubbkbbuuqrzzk..",
      "...kIIIIzzuukuuzzzzzk...",
      "...zzIIIzIzzzzzzzzzzk...",
      "....kzzzzzrzzzzzzzzk....",
      ".....kzzzzrzzzzzzzk.....",
      "......kkzrzzzzzzkk......",
      "........kkkkkkkk........",
      "........................",
      "........................",
    ]),
  },
  dragonboneRing: {
    id: "dragonboneRing", name: "竜骨の指輪", slot: "acc", lv: 177, atk: 14, hp: 45, price: 10300, classes: null,
    eDef: { el: "fire", lv: 1 },
    desc: "古竜の指骨を削り出した白い環。骨髄に残った竜の体温がじんわりと巡り、はめた者の血潮を猛らせる。",
    ...sprite([
      "........................",
      "........................",
      "........................",
      ".........zzzzzz.........",
      "........zxxBBzzk........",
      ".......zxxBBzIIzk.......",
      "......zBBBBzzzzzzk......",
      "......zIIIzIzzzzzk......",
      "......zIIIzzzzzzzk......",
      ".....zzzzzzzzzzzzzk.....",
      "....ucbkkzzzzzzkkcbk....",
      "...zzuk..kkkkkk..kuzk...",
      "..zzzzk..........zzzzk..",
      "..zzzzk..........zzzzk..",
      "..zzzzk..........zzzzk..",
      "..zIIIk..........zzzzk..",
      "..zIIIBkzz....zzzIzzzk..",
      "..zIIzBBBBkzzzIIIIzzzk..",
      "...kzIBBBBIBIIIIIIzzk...",
      "....kIIBBBBBBIIIzIzk....",
      ".....kIBBBBBBIIIIIk.....",
      "......kkBzBBzIIzkk......",
      "........kkkkkkkk........",
      "........................",
    ]),
  },
  cursedBlade: {
    id: "cursedBlade", name: "妖刀ムラマサ", slot: "weapon", cat: "kt", lv: 175, atk: 152, vit: -12, hit: 9, dice: "2d12+10", swings: 4, align: "悪", cursed: true, price: 0,
    eAtk: { el: "dark", lv: 1 }, classes: null,
    desc: "鞘の中からすすり泣きが聞こえる呪われた刀。凄まじい斬れ味と引き換えに、一度握った者の血を忘れない。攻撃は跳ね上がるが身を守れなくなる。悪属性。",
    ...sprite([
      "........................",
      "....................ee..",
      "...................exvk.",
      "..................evvvk.",
      ".................exvgk..",
      "................exvgk...",
      "...............exwvk....",
      "..............exwvgk....",
      ".............exwvgk.....",
      "............exwvgk......",
      "...........exwvgk.......",
      "..........exvvgk........",
      ".........exwvgk.........",
      "......eeexvvgk..........",
      ".....evvvYykk...........",
      ".....evvggek............",
      ".....zBgeek.............",
      "....JJJBek..............",
      "...JJBjkk...............",
      "..zBJjk.................",
      ".JJJBk..................",
      "OYBjk...................",
      "Oook....................",
      ".kk.....................",
    ]),
  },

  // ===== 消耗品 =====
  herb: {
    id: "herb", name: "薬草", slot: "use", lv: 1, use: { heal: 30 }, price: 20, classes: null,
    desc: "迷宮の死地にも根づく生命力の強い薬草。噛み潰せば、苦みが傷の熱を奪っていく。HPを30回復する。",
    ...sprite([
      "........................",
      "..........tt............",
      ".........tGhk...........",
      "........tGGhtk..........",
      "........tGGhttk.........",
      ".......tGGGhtttk........",
      "..tt...tGGGhtttk..tttt..",
      ".thtkttkGGGhtttkttGGhhk.",
      ".tGttttkGGGttttkGGGGhhk.",
      ".tGhhtttGGGhtttGGGGhttk.",
      ".tGGhtttkGGtttkGGGhtttk.",
      ".tGGGhtttGGhtkkGGhhtttk.",
      ".tGGGhhttkGhk.tGGhtttk..",
      "..kGGGhttkkhGkkGhtttk...",
      "...khttttkktGkkhtttk....",
      "...thhttttktGkthGkk.....",
      "...tGGhhttktGk.kGk......",
      "....kGGGhhktGktGk.......",
      "....tGGGGGllllkGk.......",
      ".....kkkktdLldGk........",
      "........ttkdGdGk........",
      ".........kttGlk.........",
      ".........tttGGdk........",
      "..........kkkkk.........",
    ]),
  },
  antidote: {
    id: "antidote", name: "毒消し草", slot: "use", lv: 1, use: { cure: "poison" }, price: 30, classes: null,
    desc: "死した毒蛇の巣にだけ群生するという解毒草。青臭い汁が血に巡る毒を絡め取る。毒状態を治す。",
    ...sprite([
      "........................",
      "..........DDDD..........",
      ".........DLLLlk.........",
      ".........Dldddk.........",
      ".........OYYyOk.........",
      ".........exAAAk.........",
      ".........exxAAk.........",
      "........exxAAAAk........",
      "......eexxxAAAACkF......",
      ".....exxxxAAAAACCCk.....",
      "....ewxxxAAAAACCCffk....",
      "...FAhhhhhGGGGGGGGffk...",
      "...FAhhxhhGGGGGGGttfk...",
      "..FChhwhGGGGGGGGttttfk..",
      "..FAGGxGGGGGGhGtttttfk..",
      "..FCGGhGGGGGGGttttttfk..",
      "..FCGGGGGGGGGtttttttfk..",
      "..FfGGGGGGGtttthttttfk..",
      "...kfttttthttttttttfk...",
      "...Fffttttttttttttffk...",
      "....kffttttttttttffk....",
      ".....kkffffffffffkk.....",
      ".......kkkkkkkkkk.......",
      "........................",
    ]),
  },
  manaDrop: {
    id: "manaDrop", name: "マナの雫", slot: "use", lv: 3, use: { mp: 20 }, price: 60, classes: null,
    desc: "地脈の傷口からにじみ出した魔力の雫。飲み干せば、冷たい光が喉を伝い落ちていく。MPを20回復する。",
    ...sprite([
      "........................",
      "..........DDDD..........",
      ".........DLLLlk.........",
      ".........Dldddk.........",
      ".........OYYyOk.........",
      ".........exAAAk.........",
      ".........exxAAk.........",
      "........exxAAAAk........",
      "......eexxxAAAACkF......",
      ".....exxxxAAAAACCCk.....",
      "....ewxxxAAAAACCCffk....",
      "...FAcccccbbbbbbbbffk...",
      "...FAccxccbbbbbbbuufk...",
      "..FCccwcbbbbbbbbuuuufk..",
      "..FAbbxbbbbbbcbuuuuufk..",
      "..FCbbcbbbbbbbuuuuuufk..",
      "..FCbbbbbbbbbuuuuuuufk..",
      "..Ffbbbbbbbuuuucuuuufk..",
      "...kfuuuuucuuuuuuuufk...",
      "...Fffuuuuuuuuuuuuffk...",
      "....kffuuuuuuuuuuffk....",
      ".....kkffffffffffkk.....",
      ".......kkkkkkkkkk.......",
      "........................",
    ]),
  },
};

// ===== 装備ステータスの単一フォーマット =====
// 装備の性能はすべてフラット値 (atk/vit/… を base に加算)。
// 旧%型 (.pct) は廃止 — 旧セーブの .pct はロード時にテンプレートのフラット値へ
// 戻される (game.js の reflattenItemStats)。

// 属性集計の優先順 (同レベルなら先のものが発現)
const ELEM_ORDER = ["fire", "water", "wind", "earth", "light", "dark"];
// 部位ごとの属性レベル合計から、発現する属性を1つ選ぶ ({el, lv} or null)
// 同属性の装備は加算で重なる (最大Lv2=◎)。異なる属性は混ざらず、最も高いものだけが発現する。
function topElemStat(sums) {
  let best = null;
  for (const el of ELEM_ORDER) {
    const lv = sums[el] || 0;
    if (lv > 0 && (!best || lv > best.lv)) best = { el, lv: Math.min(2, lv) };
  }
  return best;
}

// 状態異常の種類と呼び名 (装備の耐性 aRes・追加効果 onHit で使う)
export const AIL_LABEL = { poison: "毒", paralyze: "麻痺", sleep: "眠り", charm: "魅了", confuse: "混乱", stone: "石化" };
// 装備だけで積める状態異常耐性の上限 (パッシブ「異常耐性」と合わせても上限100%)
export const AIL_RES_CAP = 1;
// 装備だけで積めるブレス耐性の上限 (combat.js の BREATH_RES_CAP と同じ)
export const BREATH_RES_MAX = 0.5;

// ===== 道具 (消耗品) の効果 =====
// item.use の語彙 (catalog/defs.js の U ビルダーが検証する):
//   heal: N / full: true      HP を N 回復 / 全快
//   mp: N / mpFull: true      MP を N 回復 / 全快
//   all: true                 heal・mp・cure・buff を生きている隊全員に
//   cure: "poison" | [...] | "all"  状態異常を治す (USE_AIL のキー。眠り・魅了・混乱は戦闘の中だけの状態)
//   revive: 0.25              倒れた仲間を最大HPのこの割合で起こす
//   buff: { atk: 1.3 }, dur   戦闘中: 能力を高める (ターン数 dur)
//   bomb: { power, el, all, prey }  戦闘中: 投げつける。威力は固定 (使い手の能力に依らない)。属性・魔法耐性・魔法弱点が効く
//   hex: { kind, chance, all } 戦闘中: 敵を眠らせる (sleep) / 痺れさせる (paralyze) / 惑わす (confuse)。Lv差が効く
//   escape: true              戦闘中: 必ず逃げる (退路を断たれていなければ)
//   float: N                  迷宮で: N 階のあいだ浮遊する (この階を含む。足元の穴に落ちず、害のある床も踏まない)
//   drop: 0.5                 戦利品に出る重み (既定 1。強すぎる品を出にくくする)
export const USE_AIL = ["poison", "paralyze", "stone", "sleep", "charm", "confuse"];
export const USE_KEYS = ["heal", "full", "mp", "mpFull", "all", "cure", "revive", "buff", "dur", "bomb", "hex", "escape", "float", "recall", "drop"];
// 治す状態異常の一覧 (旧来の cure: "poison" も配列にそろえる)
export function useCureKinds(u) {
  if (!u || !u.cure) return [];
  if (u.cure === "all") return USE_AIL.slice();
  return Array.isArray(u.cure) ? u.cure : [u.cure];
}
// 使える場面: "battle" = 戦闘中だけ / "field" = 迷宮を歩いている時だけ / "any" = いつでも
export function useWhere(it) {
  const u = (it && it.use) || {};
  if (u.bomb || u.hex || u.escape || u.buff) return "battle";
  if (u.float || u.recall) return "field";
  return "any";
}
// 使う相手: "ally" 味方1人 / "all-ally" 味方全員 / "dead" 倒れた味方1人 / "enemy" 敵1体 / "all-enemy" 敵全体 / "self" (逃走・浮遊)
export function useTarget(it) {
  const u = (it && it.use) || {};
  if (u.bomb) return u.bomb.all ? "all-enemy" : "enemy";
  if (u.hex) return u.hex.all ? "all-enemy" : "enemy";
  if (u.escape || u.float || u.recall) return "self";
  if (u.revive) return "dead";
  return u.all ? "all-ally" : "ally";
}
// この道具が今の t に効くか (味方向け。満タンへの回復・かかっていない状態異常の治療は効かない)
export function useHelps(it, t) {
  const u = (it && it.use) || {};
  if (!t) return false;
  if (u.revive) return !t.alive;
  if (!t.alive) return false;
  if (u.buff) return true;
  if ((u.heal || u.full) && t.hp < t.maxhp) return true;
  if ((u.mp || u.mpFull) && (t.maxmp || 0) > 0 && t.mp < t.maxmp) return true;
  const kinds = useCureKinds(u);
  if (kinds.length) {
    if (t.ailment && kinds.includes(t.ailment)) return true;
    if (t.asleep && kinds.includes("sleep")) return true;
    if (t.mind && kinds.includes(t.mind)) return true;
  }
  return false;
}
// 棚・袋・戦闘の一覧の並び (値段ではなく効果で並べる): 分類の順 → 分類の中は効き目の弱い順 → 名前
export const USE_GROUPS = [
  { key: "hp", label: "HP回復" }, { key: "hpAll", label: "HP回復 (全員)" }, { key: "both", label: "HP・MP回復" },
  { key: "mp", label: "MP回復" }, { key: "mpAll", label: "MP回復 (全員)" },
  { key: "cure", label: "治療" }, { key: "revive", label: "蘇生" }, { key: "buff", label: "強化" },
  { key: "bomb", label: "攻撃" }, { key: "hex", label: "妨害" }, { key: "escape", label: "逃走" }, { key: "field", label: "迷宮" },
];
export function useGroup(it) {
  const u = (it && it.use) || {};
  const hp = u.heal || u.full, mp = u.mp || u.mpFull;
  const key = hp && mp ? "both" : hp ? (u.all ? "hpAll" : "hp") : mp ? (u.all ? "mpAll" : "mp")
    : u.revive ? "revive" : u.cure ? "cure" : u.buff ? "buff" : u.bomb ? "bomb" : u.hex ? "hex" : u.escape ? "escape" : "field";
  return USE_GROUPS.findIndex((g) => g.key === key);
}
const FULL_N = 1e6;
function useStrength(it) {
  const u = (it && it.use) || {};
  if (u.heal || u.full) return u.full ? FULL_N : u.heal;
  if (u.mp || u.mpFull) return u.mpFull ? FULL_N : u.mp;
  if (u.revive) return u.revive;
  if (u.cure) return useCureKinds(u).length * 10 + (u.all ? 5 : 0);
  if (u.buff) return Object.keys(u.buff).length * 100 + Object.values(u.buff).reduce((a, v) => a + v, 0);
  if (u.bomb) return u.bomb.power * (u.bomb.all ? 1.5 : 1);
  if (u.hex) return u.hex.chance * (u.hex.all ? 1.5 : 1);
  return it.lv || 0;
}
export function compareUse(a, b) {
  return useGroup(a) - useGroup(b) || useStrength(a) - useStrength(b) || (a.lv || 0) - (b.lv || 0) || a.name.localeCompare(b.name);
}
const EL_LABEL = { fire: "火", water: "水", wind: "風", earth: "土", light: "光", dark: "闇" };
const BUFF_LABEL = { atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };
const HEX_LABEL = { sleep: "眠らせる", paralyze: "痺れさせる", confuse: "混乱させる" };
const cureText = (u) => {
  const k = useCureKinds(u);
  return k.length >= USE_AIL.length ? "状態異常をすべて" : k.map((x) => AIL_LABEL[x] || x).join("・") + "を";
};
// 効果の説明 (1行ずつ)。short = 棚・札の一言
export function useLines(it, short = false) {
  const u = (it && it.use) || {};
  const who = u.all ? (short ? "全員 " : "隊の全員の") : "";
  const L = [];
  if (u.heal || u.full) L.push(short ? `${who}HP ${u.full ? "全快" : "+" + u.heal}` : `${who}HPを${u.full ? "全快させる" : ` ${u.heal} 回復`}`);
  if (u.mp || u.mpFull) L.push(short ? `${who}MP ${u.mpFull ? "全快" : "+" + u.mp}` : `${who}MPを${u.mpFull ? "全快させる" : ` ${u.mp} 回復`}`);
  if (u.cure) L.push(`${who}${cureText(u)}治す`);
  if (u.revive) L.push(short ? `蘇生 (HP${Math.round(u.revive * 100)}%)` : `倒れた仲間を起こす (最大HPの${Math.round(u.revive * 100)}%)`);
  if (u.buff) {
    const s = Object.keys(u.buff).map((k) => `${BUFF_LABEL[k] || k}+${Math.round((u.buff[k] - 1) * 100)}%`).join(" ");
    L.push(short ? `${who}${s}` : `${who}${s} (${u.dur || 3}ターン)`);
  }
  if (u.bomb) {
    const b = u.bomb, el = EL_LABEL[b.el] ? `${EL_LABEL[b.el]}属性 ` : "";
    L.push(short ? `${b.all ? "敵全体" : "敵1体"}に${el}${b.power}` : `${b.all ? "敵全体" : "敵1体"}に${el}威力 ${b.power} の痛手`);
    if (b.prey && !short) L.push("不浄の者 (不死・霊・魔) には1.5倍");
  }
  if (u.hex) L.push(`${u.hex.all ? "敵全体" : "敵1体"}を${HEX_LABEL[u.hex.kind] || u.hex.kind}${short ? "" : ` (基本 ${Math.round(u.hex.chance * 100)}%・Lv差で増減)`}`);
  if (u.escape) L.push(short ? "必ず逃げる" : "戦いから必ず逃げ出せる (退路を断たれていなければ)");
  if (u.float) L.push(short ? `浮遊 ${u.float}階` : `${u.float}階のあいだ宙に浮く (この階を含む。足元の穴・害のある床にかからない)`);
  if (u.recall) L.push(short ? "街へ帰還" : "迷宮から街へ帰還する (戦利品は持ち帰る)");
  if (!short) {
    const w = useWhere(it);
    L.push(w === "battle" ? "戦闘中にだけ使える" : w === "field" ? "迷宮を歩いている時にだけ使える" : "戦闘中も、戦闘の外でも使える");
  }
  return L;
}

// 六大ステ (STR/VIT/AGI/INT/PIE/LUK) を base + 装備から再計算
// 装備はフラット型: stat = base + Σflat (atk/vit/…)
export function recalc(member) {
  const base = member.base;
  let flatAtk = 0, flatVit = 0, flatAgi = 0, flatInt = 0, flatPie = 0, flatLuk = 0;
  let flatHp = 0, flatMp = 0, crit = base.crit || 0;
  // %補正 (LR装飾品など)。同種は加算合算 (+20%×2 = +40%)、フラット加算の後に乗算で効く
  const mul = { atk: 0, vit: 0, agi: 0, int: 0, pie: 0, luk: 0, hp: 0, mp: 0 };
  const eff = {}; // 戦闘効果 (LR装飾品): actFirst/multistrike/lifesteal/autoRevive/guard/spellCostMul
  const ea = {}, ed = {};
  const resist = zeroResists();
  for (const k in resist) resist[k] = (base.resists && base.resists[k]) || 0;
  const ar = {}, oh = {}; // 状態異常耐性 (種類→合計) / 追加効果 (種類→最も強いもの)
  let br = 0; // ブレス耐性 (合計)
  const counted = new Set();
  for (const slot of SLOTS) {
    const it = member.equip[slot];
    if (!it || counted.has(it)) continue;
    counted.add(it);
    flatAtk += it.atk || 0;
    flatVit += (it.vit != null ? it.vit : it.def) || 0; // def は旧セーブ互換
    flatAgi += (it.agi != null ? it.agi : it.spd) || 0; // spd は旧セーブ互換
    flatInt += it.int || 0;
    flatPie += it.pie || 0;
    flatLuk += it.luk || 0;
    flatHp  += it.hp || 0;
    flatMp  += it.mp || 0;
    crit += it.crit || 0;
    if (it.mult) for (const k in mul) mul[k] += it.mult[k] || 0;
    if (it.eff) for (const k in it.eff) {
      const v = it.eff[k];
      if (typeof v === "boolean") eff[k] = eff[k] || v;                  // actFirst 等
      else if (k === "multistrike" || k === "barrier") eff[k] = (eff[k] || 0) + v; // 加算
      else eff[k] = Math.max(eff[k] || 0, v);                            // 割合は強い方
    }
    if (it.eAtk && it.eAtk.el) ea[it.eAtk.el] = (ea[it.eAtk.el] || 0) + (it.eAtk.lv || 1);
    if (it.eDef && it.eDef.el) ed[it.eDef.el] = (ed[it.eDef.el] || 0) + (it.eDef.lv || 1);
    if (it.aRes) for (const k in it.aRes) ar[k] = (ar[k] || 0) + (it.aRes[k] || 0);
    if (it.resists) for (const k in resist) resist[k] += it.resists[k] || 0;
    br += it.bRes || 0;
    if (it.onHit && it.onHit.k) {
      const cur = oh[it.onHit.k];
      if (!cur || (it.onHit.chance || 0) > cur.chance) oh[it.onHit.k] = { k: it.onHit.k, chance: it.onHit.chance || 0, ...(it.onHit.pct ? { pct: it.onHit.pct } : {}) };
    }
  }
  // 装備による増減は整数化 (増は切り上げ・減は切り下げ)。基礎値はそのまま。
  // %補正があれば (基礎+フラット) に乗じてから整数化する
  const withEquip = (b, f, m) => {
    const baseV = Math.round(b || 0);
    const v = baseV + (f > 0 ? Math.ceil(f) : Math.floor(f));
    return m ? Math.round(v * (1 + m)) : v;
  };
  member.atk = Math.max(1, withEquip(base.atk, flatAtk, mul.atk));
  member.vit = Math.max(0, withEquip(base.vit, flatVit, mul.vit));
  member.agi = Math.max(1, withEquip(base.agi, flatAgi, mul.agi));
  member.int = Math.max(0, withEquip(base.int, flatInt, mul.int));
  member.pie = Math.max(0, withEquip(base.pie, flatPie, mul.pie));
  member.luk = Math.max(0, withEquip(base.luk, flatLuk, mul.luk));
  member.critBonus = crit;
  member.maxhp = withEquip(base.hp, flatHp, mul.hp);
  member.maxmp = withEquip(base.mp, flatMp, mul.mp);
  if (member.hp > member.maxhp) member.hp = member.maxhp;
  if (member.mp > member.maxmp) member.mp = member.maxmp;
  // 属性攻撃/属性防御 (装備由来。Lv1=◯, Lv2=◎)
  member.elemAtk = topElemStat(ea);
  member.elemDef = topElemStat(ed);
  // 戦闘効果 (LR装飾品由来)。combat.js が戦闘開始時に actor へ展開する
  member.eff = Object.keys(eff).length ? eff : null;
  // 状態異常耐性 (装備由来・種類ごとに上限 AIL_RES_CAP) と武器の追加効果。combat.js が読む
  const arOut = {};
  for (const k in ar) if (ar[k] > 0) arOut[k] = Math.min(AIL_RES_CAP, Math.round(ar[k] * 100) / 100);
  for (const k in arOut) if (k in resist) resist[k] += arOut[k] * 100;
  for (const k in resist) resist[k] = clampResist(resist[k]);
  member.resists = resist;
  member.physResist = resist.physResist; member.magResist = resist.magResist;
  for (const k in resist) if (!["physResist", "magResist"].includes(k) && resist[k]) arOut[k] = resist[k] / 100;
  member.ailRes = Object.keys(arOut).length ? arOut : null;
  member.breathRes = br > 0 ? Math.min(BREATH_RES_MAX, Math.round(br * 100) / 100) : 0;
  const ohOut = Object.values(oh).filter((o) => o.chance > 0);
  member.onHit = ohOut.length ? ohOut : null;
  // 武器の能力参照 (scale) と魔法属性 (magic)。攻撃力 power = 参照能力 × 係数の合計 (combat.js の _eatk も同じ式をバフ込みで使う)
  const wpn = member.equip.weapon;
  member.wScale = wpn && wpn.scale ? { ...wpn.scale } : null;
  member.wMagic = !!(wpn && wpn.magic);
  member.power = attackPower(member);
  // 二刀流: 盾の欄の片手武器 (左手)。二刀流を持たなければ左手の攻撃はしない (game.js が袋へ戻す)
  const off = offhandOf(member);
  member.dualRate = off && member.dualWield > 0 && !off.twoHanded ? member.dualWield : 0;
  member.oScale = off && off.scale ? { ...off.scale } : null;
  member.oMagic = !!(off && off.magic);
  member.offPower = offhandPower(member);
  // 旧体系の派生値 (こうげき/ぼうぎょ/すばやさ/AC) は廃止
  delete member.def; delete member.spd; delete member.ac;
}

export function canEquip(member, item) {
  // 未鑑定の品は正体が分からないため装備できない (鑑定が必要)
  if (item.unidentified) return false;
  // 属性制限: 悪の装備は善のキャラに装備できない (逆も同様)
  if (item.align && member.align && item.align !== "中立" && member.align !== "中立" && item.align !== member.align) {
    return false;
  }
  // 明示的職業リスト (専用装備など)
  if (item.classes) return item.classes.includes(member.clsKey);
  // ギアマトリクス (souls.js の JOB_GEAR から注入)
  const gear = _jobGear[member.clsKey];
  if (!gear) return true; // 未登録職業はオープン
  if (item.slot === "weapon") return !gear.weapons || gear.weapons.includes(item.cat);
  if (item.slot === "shield") return !!gear.shields && gear.shields.includes(shieldKind(item));
  if (item.weight) return (ARMOR_RANK[item.weight] || 0) <= (ARMOR_RANK[gear.armor] || 0);
  return true; // アクセサリ等は全職OK
}

// 装備する (置換した装備品は所持品に戻す)。成否メッセージを返す
// slotKey = "shield" と片手武器を渡すと左手に持つ (二刀流)
export function equip(member, item, slotKey = null) {
  if (item.slot === "use") return { ok: false, msg: "それは装備できない" };
  if (!canEquip(member, item)) return { ok: false, msg: `${member.cls}は${item.name}を装備できない` };
  const offhand = slotKey === "shield" && item.slot === "weapon";
  if (offhand && !canOffhand(member, item)) return { ok: false, msg: "二刀流でなければ左手に武器は持てない" };
  const key = offhand ? "shield" : slotKeyFor(item, member);
  if (!key) return { ok: false, msg: "装備できない" };

  // 押し出される装備を先に数え、所持品が8枠を超えるなら装備自体を中止する
  const removed = [];
  if (item.slot === "weapon" && item.twoHanded && member.equip.shield) removed.push(member.equip.shield);
  if (key === "shield" && member.equip.weapon && member.equip.weapon.twoHanded) removed.push(member.equip.weapon);
  if (member.equip[key]) removed.push(member.equip[key]);
  const idx = member.items.indexOf(item);
  const bagAfter = member.items.length - (idx >= 0 ? 1 : 0) + removed.filter((r) => r && r !== item).length;
  if (bagAfter > MAX_ITEMS) return { ok: false, msg: "持ち物がいっぱいで装備を入れ替えられない" };

  // 所持品から取り出し、外した装備を所持品へ戻す
  if (idx >= 0) member.items.splice(idx, 1);
  if (item.slot === "weapon" && item.twoHanded) member.equip.shield = null;
  if (key === "shield" && member.equip.weapon && member.equip.weapon.twoHanded) member.equip.weapon = null;
  member.equip[key] = item;
  for (const r of removed) if (r && r !== item) member.items.push(r);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${item.name} を装備した` };
}

export function unequip(member, key) {
  const it = member.equip[key];
  if (!it) return { ok: false, msg: "" };
  if (it.cursed) return { ok: false, msg: `${it.name}は呪われていて外せない！` };
  if (it.locked) return { ok: false, msg: `${it.name}はロック中 ― ロックを外すと外せる` };
  if (member.items.length >= MAX_ITEMS) return { ok: false, msg: "持ち物がいっぱいだ" };
  member.equip[key] = null;
  member.items.push(it);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${it.name} を外した` };
}

// 部位アイコン (装備中リストの左側に出す小アイコン)
export const SLOT_ICONS = {
  weapon: sprite([
    "........................",
    ".....................e..",
    "...................eevk.",
    ".................eevvk..",
    "................evvvek..",
    "...............evvvek...",
    "..............egvgeek...",
    ".............egveeek....",
    "............evvgeek.....",
    "......e....evvgeek......",
    ".....egk..evvgeek.......",
    "....evek.evveeek........",
    "...egegekvvgeek.........",
    "....kkgggvgeek..........",
    "......kgggeek...........",
    "......eggeek............",
    "...eeegeeggeke..........",
    "..evvegekkgvvgk.........",
    ".evvggek..kvek..........",
    ".eeggeek..egk...........",
    ".eeeeeek...k............",
    "..keeek.................",
    "...kkk..................",
    "........................",
  ]),
  body: sprite([
    "...eeee..........eeee...",
    "..evgvvk........egeeek..",
    ".evvgvvvkkkkkkeeeeeeeek.",
    "eeggggeggkkkkkkeeeeeeeek",
    "eeeeeeeeggkkkkgeeeeeeeek",
    "evvvgeevgvggggggevveveek",
    ".kgeeeekvvvveggeggeeekk.",
    ".evvgeevvvgvegeeevvgeek.",
    "..kgekeggggveeeeeegekk..",
    "...kgggggggveeeeeeeek...",
    "...eeeeeeeeveeeeeeeek...",
    "...eeeeeeeegeeeeeeeek...",
    "....keeeeeeveeeeeeek....",
    "....eeeeeeeveeeeeeek....",
    ".....kggggeggggggek.....",
    ".....eeeeeeeeeeeeek.....",
    "....egvvvvvgggeeeeek....",
    "....eegggggeeeeekkke....",
    "...egvvvvvveggeeeveek...",
    "...eegeggggeeeeeekkke...",
    "..eggvvvvvggggeeeeeeek..",
    "..eegggggeeeeeeeekkkk...",
    "...kkkkkkkkkkkkkk.......",
    "........................",
  ]),
  shield: sprite([
    "..eeeeeeeeeeeeeeeeeeee..",
    ".egggggggggggeggegggggk.",
    "eggeeeeeeeeeeeeeeeeeeegk",
    "egeggggggggvggggeeeeeegk",
    "egevgggggggvegggeeeevegk",
    "egeggggggggvegggeeeeeegk",
    "egeggggggggggggeeeeeeegk",
    "egevvvvvvvgveevvvvvvgegk",
    "egegeeeeeeeeeeeeeeeeeegk",
    "egeggggggggveeegeegeeegk",
    "egeggggggggveeegeegeeegk",
    "egevgggggggveegeegeevegk",
    ".kgegggggeeveeeegeegegk.",
    ".egegggeeeeveeegeegeegk.",
    "..kgeeeeeeeveeegeegegk..",
    "..egeeeeeeeveegeegeegk..",
    "...keeeeeeeveeeeeeegk...",
    "....kgveeeeveeeeevgk....",
    ".....kgeeeeveeeeegk.....",
    "......kgeeeveeeeek......",
    ".......kgeeveeegk.......",
    "........kgegeegk........",
    ".........kggggk.........",
    "..........kkkk..........",
  ]),
  head: sprite([
    "..............eee.......",
    "...........eeeggek......",
    "..........eegggeeek.....",
    "........eeegeeeeek......",
    "......eevvevegggke......",
    ".....evvgvevegggeek.....",
    "....evvvvvgvegggeeek....",
    "...egvvvgvgvegggeeeek...",
    "...evvvvvvgvegggeeeek...",
    "..egggeggggggggggggggk..",
    "..egvvvvvvgvegggeeveek..",
    "..egvkkkkkkvekkkkkkeek..",
    "..egvvvvvvgvegggeeeeek..",
    "..egvgvvvvgvkkggeeeeek..",
    "..egvvvvvvgvkkegekekek..",
    "..egvvvvvvevkkggeeeeek..",
    "...kvgvvvvgvkkggekekk...",
    "...evgvvvvggegggeevek...",
    "....kvvgvveveeggeeek....",
    "....egvvvvvvvvvvvvgk....",
    ".....kgeeeeeeeeeeek.....",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
  ]),
  hands: sprite([
    ".........eee............",
    ".....eeeevgekeee........",
    "....evgekveekvgek.......",
    "....evgekggekvgekeee....",
    "....eeekkeekkeekkggek...",
    "....eveekvgekveekvgek...",
    "....evgekvgekvgekeek....",
    "....eeekkeekkeekkggek...",
    "..eekvgekvgekvgekvgek...",
    ".evgkvvvgvvvvvvvvvvgk...",
    "evggggeeeeeeeeeeeeeek...",
    "eeggevveeevvvvvgeeeek...",
    ".kegeggeeeggvggeeeeek...",
    "..keegveeevgvggeeeeek...",
    "...kvveeevvgvgeeeeeek...",
    "...eegeeeggeeeeeeeeek...",
    "...egvvvvvvgggeeeeeek...",
    "..egvvgvvgggggeeeeeeek..",
    "..egvvvvvgggggeeeeeeek..",
    "..eeeeeeeeeeeeeeeeeeek..",
    "..egvgvvvvggggeeeeeeek..",
    "..egvvvvvvggggeeeeeeek..",
    "...kkkkkkkkkkkkkkkkkk...",
    "........................",
  ]),
  feet: sprite([
    "........................",
    "........................",
    "........................",
    ".............eeeeeeee...",
    "............eeeeeeeeek..",
    "............eeeeeeeeek..",
    ".............keeeeeek...",
    "......eeeeeeekeeekeek...",
    ".....eggggggggkekgkek...",
    ".....eeeeeeeeekeekeek...",
    "......kgggeeekeeeeeek...",
    "......eggggeekeeeeeek...",
    "......eeeeveekeeeeeek...",
    "......eggggeekeeeeeek...",
    "......eggggeekeeeeeeek..",
    ".....eggggeeekeeeeeeek..",
    "...eegggggeeekeeeeeeeek.",
    "..eggggggeeeekkkkkeeek..",
    ".eggggggggeeeek...kkk...",
    ".eggggggggeeeek.........",
    ".eeeeeeeeeeeeeek........",
    "..keeekkkkkeeek.........",
    "...kkk.....kkk..........",
    "........................",
  ]),
  acc1: sprite([
    "........................",
    "..........eeee..........",
    ".........eggggk.........",
    "........egvggeeke.......",
    ".......eeggeeeeeek......",
    ".......egeeeeeeeek......",
    "........keeeeeekk.......",
    ".........keeeek.........",
    ".........eegeeek........",
    ".......eeegvvggek.......",
    "......eeeeeeeeeeek......",
    "....eeekkkkkkkkkkeke....",
    "...eeek..........keek...",
    "...eeek..........eeek...",
    "..eeek............keek..",
    "..eeeek..........eeeek..",
    "..egggk..........eeeek..",
    "..eggggke......eeeeeek..",
    "...kgggvvkeeeeeggeeek...",
    "...egggvvvvvvggggeeek...",
    "....kkgvvvvvvggggekk....",
    "......kvvvvvvggggk......",
    ".......kkkkkkkkkk.......",
    "........................",
  ]),
  acc2: sprite([
    "........................",
    "..........eeee..........",
    ".........eggggk.........",
    "........egvggeeke.......",
    ".......eeggeeeeeek......",
    ".......egeeeeeeeek......",
    "........keeeeeekk.......",
    ".........keeeek.........",
    ".........eegeeek........",
    ".......eeegvvggek.......",
    "......eeeeeeeeeeek......",
    "....eeekkkkkkkkkkeke....",
    "...eeek..........keek...",
    "...eeek..........eeek...",
    "..eeek............keek..",
    "..eeeek..........eeeek..",
    "..egggk..........eeeek..",
    "..eggggke......eeeeeek..",
    "...kgggvvkeeeeeggeeek...",
    "...egggvvvvvvggggeeek...",
    "....kkgvvvvvvggggekk....",
    "......kvvvvvvggggk......",
    ".......kkkkkkkkkk.......",
    "........................",
  ]),
};

// 基本品も大量カタログと同じ参照仕様に整える。
for (const it of Object.values(ITEMS)) prepareWeapon(it);
