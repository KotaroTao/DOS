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
