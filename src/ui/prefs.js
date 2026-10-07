// ===== UI の好み・覚えておく選択 (端末ローカル) =====
// localStorage['dos-ui']。セーブとは別で「はじめから」でも消えない (dos-prefs と同じ扱い)。
// タブ・人業・区分・商会の分類・図鑑の迷宮・人業ごとの最後のスキル・各種の自動化設定を覚える。
// 読み書きはすべて try/catch (プライベートブラウズ・容量超過でも画面は動く)。

const KEY = "dos-ui";

// 既定値 (自動化系はプレイの流れを変えない安全側)
export const UI_PREF_DEFAULTS = {
  tab: "hub",            // 最後に開いていた街のタブ
  seg: {},               // 区分 (segmented) の記憶 { scope: key }
  partyIdx: 0,           // 隊で選んでいた人業
  shopSeg: "sell",       // 商会: 売る・鑑定 | 買う
  shopCat: "weapon",     // 商会の分類
  codexDungeon: 0,       // 図鑑で開いていた迷宮
  lastSkill: {},         // 人業uid → 最後に使ったスキル
  autoKeep: false,       // オートを次の戦闘も続ける
  chestAuto: false,      // 宝箱は最良の解除役で開ける (確認なし)
  autoCorpse: true,      // 朽ちた死体は自動で調べる
  autoCloseResults: false, // 戦果を自動で閉じる
  autoRest: false,       // 帰還時に宿で休む
  sellUse: false,        // まとめて売るに道具 (消耗品) も含める
  autoMoveFoes: "avoid", // (旧) オート移動と見えている敵: avoid / weak / all ― autoMoveAvoid が無い時の読み替えにだけ使う
  autoMoveAvoid: null,   // オート移動で避けるもの { foe 一般の敵, elite 強敵, event 出来事, chest 宝箱 } (true = 避ける)。null = 既定 (旧設定から)
  keeperSeen: {},        // 番人の胸像を見せた街滞在 { key: stamp }
  partyHintsSeen: [],    // 人業の館で既読にしたお勧め (鍛錬できる魂・より良い品) — タブの赤い点
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return { ...structuredCloneSafe(UI_PREF_DEFAULTS), ...(v && typeof v === "object" ? v : {}) };
  } catch (e) {
    return structuredCloneSafe(UI_PREF_DEFAULTS);
  }
}
function structuredCloneSafe(o) {
  try { return JSON.parse(JSON.stringify(o)); } catch (e) { return { ...o }; }
}

export const uiPrefs = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(uiPrefs)); } catch (e) { /* 保存できなくても動く */ }
}

export function getPref(key, fallback) {
  const v = uiPrefs[key];
  return v === undefined ? (fallback !== undefined ? fallback : UI_PREF_DEFAULTS[key]) : v;
}

export function setPref(key, value) {
  uiPrefs[key] = value;
  persist();
  return value;
}

// 入れ子の記憶 (例: remember("seg", "party", "soul"))
export function remember(scope, key, value) {
  const box = (uiPrefs[scope] && typeof uiPrefs[scope] === "object") ? uiPrefs[scope] : (uiPrefs[scope] = {});
  if (value === undefined) return box[key];
  box[key] = value;
  persist();
  return value;
}

export function resetUiPrefs() {
  for (const k of Object.keys(uiPrefs)) delete uiPrefs[k];
  Object.assign(uiPrefs, structuredCloneSafe(UI_PREF_DEFAULTS));
  persist();
}

// オート移動で避けるもの (設定「オート移動で避けるもの」)。4つそれぞれ true = 避ける / false = 避けない。
// 未設定なら旧設定 autoMoveFoes (avoid / weak / all) から読み替え、出来事は避けない・宝箱は避けるを既定にする
export const AUTO_MOVE_AVOID_KEYS = ["foe", "elite", "event", "chest"];
export function autoMoveAvoid() {
  const v = uiPrefs.autoMoveAvoid;
  const old = uiPrefs.autoMoveFoes;
  const base = { foe: old !== "weak" && old !== "all", elite: old !== "all", event: false, chest: true };
  if (v && typeof v === "object") for (const k of AUTO_MOVE_AVOID_KEYS) if (typeof v[k] === "boolean") base[k] = v[k];
  return base;
}
export function setAutoMoveAvoid(key, on) {
  if (!AUTO_MOVE_AVOID_KEYS.includes(key)) return;
  setPref("autoMoveAvoid", { ...autoMoveAvoid(), [key]: !!on });
}
