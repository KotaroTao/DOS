// 館の装備探し。効果の数値や格は条件にせず、種類ごとにまとめる。
import { el, button, sheet } from "./kit.js";
import { getPref, setPref } from "./prefs.js";
import { EFF_INFO, isEquippable, elemName } from "./itemview.js";
import { ATTR_LABEL } from "../souls.js";
import { RESIST_LABEL } from "../resistance.js";

const ELEMENT_KEYS = ["fire", "water", "wind", "earth", "light", "dark"];
const GROUPS = [["all", "すべて"], ["attack", "攻撃"], ["defense", "防御・抵抗"], ["heal", "回復"], ["ability", "能力"], ["other", "探索・その他"]];
const EFF_GROUP = { actFirst: "attack", multistrike: "attack", lifesteal: "heal", guard: "defense", autoRevive: "heal", regen: "heal", counter: "attack", spellCostMul: "heal", ailmentImmune: "defense", goldUp: "other", soulUp: "other", disarmUp: "other", barrier: "defense" };
const normalize = s => String(s).normalize("NFKC").toLocaleLowerCase().replace(/[\s\u200b]/g, "").replace(/クリティカル/g, "会心").replace(/ドレイン/g, "吸血").replace(/リジェネ/g, "再生");
export function gearFilter() {
  const f = getPref("gearFilter") || {};
  return { elements: Array.isArray(f.elements) ? f.elements.filter(k => /^(eAtk|eDef):/.test(k)) : [], effects: Array.isArray(f.effects) ? f.effects.filter(k => typeof k === "string") : [], allEffects: !!f.allEffects };
}
export const gearFilterCount = (f = gearFilter()) => f.elements.length + f.effects.length;

function textGroup(text) {
  if (/回復|再生|蘇生|吸血|消費MP/.test(text)) return "heal";
  if (/耐性|抵抗|軽減|被ダメ|防御|障壁|無効/.test(text)) return "defense";
  if (/攻撃|与ダメ|会心|連撃|反撃|報復|貫通|命中/.test(text)) return "attack";
  if (/STR|VIT|AGI|INT|PIE|LUK|最大HP|最大MP/.test(text)) return "ability";
  return "other";
}
export function gearEffectOptions(it) {
  if (!it || it.unidentified || !isEquippable(it)) return [];
  const out = [];
  const add = (key, label, group, description = label) => out.push({ key, label, group, description });
  for (const [k, v] of Object.entries(it.eff || {})) {
    if (!v) continue;
    const info = EFF_INFO[k];
    const description = info ? info.line(typeof v === "number" ? v : 1) : k;
    const label = description.split(/[:：]/)[0];
    add(`eff:${k}`, label, EFF_GROUP[k] || "other", description);
  }
  for (const [k, v] of Object.entries(it.mult || {})) if (v) add(`mult:${k}`, `${ATTR_LABEL[k] || k}の割合補正`, "ability");
  for (const k of new Set([...Object.keys(it.resists || {}), ...Object.keys(it.aRes || {})])) {
    if ((it.resists?.[k] || 0) > 0 || (it.aRes?.[k] || 0) > 0) add(`res:${k}`, `${RESIST_LABEL[k] || k}の抵抗`, "defense");
  }
  if (it.onHit) add(`hit:${it.onHit.k}`, `${RESIST_LABEL[it.onHit.k] || it.onHit.k}の追加効果`, "attack");
  if (it.bRes > 0) add("breath", "ブレス耐性", "defense");
  if (it.magic) add("magic", "魔法属性", "attack");
  if (it.crit > 0) add("crit", "会心率", "attack", "会心率（クリティカル）を上げる");
  // 追加特性は表示台帳と同じIDで選ぶ。値の違う同じ特性は一つの候補。
  for (const a of it.afxText || []) add(`afx:${a.k || a.name}`, `追加：${a.name.replace(/の$/, "")}`, textGroup(a.text), `${a.name} ${a.text}`);
  return out;
}
export function matchesGearFilter(it, f = gearFilter()) {
  if (!gearFilterCount(f)) return true;
  if (!it || it.unidentified || !isEquippable(it)) return false;
  const elements = ["eAtk", "eDef"].filter(k => it[k]?.el && it[k].lv > 0).map(k => `${k}:${it[k].el}`);
  if (f.elements.length && !f.elements.some(k => elements.includes(k))) return false;
  const effects = new Set(gearEffectOptions(it).map(x => x.key));
  return !f.effects.length || (f.allEffects ? f.effects.every(k => effects.has(k)) : f.effects.some(k => effects.has(k)));
}
function elementLabel(key) {
  const [kind, e] = key.split(":");
  return `${kind === "eAtk" ? "属攻" : "属防"}：${elemName(e)}`;
}
function effectCatalog(items) {
  const map = new Map();
  for (const it of items) for (const o of gearEffectOptions(it)) {
    const prev = map.get(o.key);
    if (prev) prev.description += ` ${o.description}`;
    else map.set(o.key, { ...o });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "ja"));
}
export function gearFilterSummary(items, onChange) {
  const f = gearFilter(), wrap = el("div", "gf-summary");
  if (!gearFilterCount(f)) return wrap;
  const labels = new Map(effectCatalog(items).map(x => [x.key, x.label]));
  const remove = (kind, key) => {
    setPref("gearFilter", { ...f, [kind]: f[kind].filter(k => k !== key) });
    onChange();
  };
  for (const key of f.elements) wrap.appendChild(button({ label: `${elementLabel(key)} ×`, kind: "secondary", size: "sm", onTap: () => remove("elements", key) }));
  for (const key of f.effects) wrap.appendChild(button({ label: `${labels.get(key) || "特殊効果"} ×`, kind: "secondary", size: "sm", onTap: () => remove("effects", key) }));
  if (f.effects.length > 1) wrap.appendChild(el("span", "gf-rule", f.allEffects ? "効果をすべて含む" : "効果のいずれかを含む"));
  wrap.appendChild(button({ label: "すべて解除", kind: "ghost", size: "sm", onTap: () => { setPref("gearFilter", {}); onChange(); } }));
  return wrap;
}
export function gearFilterButton(items, onChange) {
  const n = gearFilterCount();
  const b = button({ label: `絞り込み${n ? `・${n}` : ""}`, kind: n ? "primary" : "secondary", size: "sm", onTap: () => openGearFilter(items, onChange) });
  b.classList.add("gf-open");
  return b;
}

export function openGearFilter(items, onApply) {
  const source = [...new Set(items.filter(Boolean))];
  const options = effectCatalog(source), labels = new Map(options.map(x => [x.key, x.label]));
  let draft = gearFilter(), group = "all", query = "", h;
  const body = el("div", "gf-panel");
  body.appendChild(el("p", "gf-hint", "属性と特殊効果の両方に一致する品を表示する。数値の違う同じ効果はまとめて探せる。未鑑定の品は鑑定してから。"));
  const picked = el("div", "gf-picked"), elements = el("div", "gf-elements"), groups = el("div", "gf-groups"), list = el("div", "gf-options");
  body.append(picked, el("h3", null, "属性（いずれか）"), elements, el("h3", null, "特殊効果"));
  const input = el("input", "gf-search");
  input.type = "search"; input.placeholder = "効果名・説明で検索（例：吸血、毒）";
  input.setAttribute("aria-label", "特殊効果を検索");
  input.addEventListener("input", () => { query = input.value; refresh(); });
  const modeLabel = el("label", "gf-mode"), mode = el("input");
  mode.type = "checkbox"; mode.checked = draft.allEffects;
  mode.addEventListener("change", () => { draft.allEffects = mode.checked; refresh(); });
  modeLabel.append(mode, document.createTextNode("選んだ特殊効果をすべて含む"));
  body.append(input, groups, modeLabel, list);
  const result = el("p", "gf-result"); result.setAttribute("role", "status"); body.appendChild(result);
  const toggled = (kind, key) => ({ ...draft, [kind]: draft[kind].includes(key) ? draft[kind].filter(k => k !== key) : [...draft[kind], key] });
  const toggle = (kind, key) => { draft = toggled(kind, key); refresh(); };
  const optionButton = (kind, key, label) => {
    const selected = draft[kind].includes(key);
    const n = source.filter(it => matchesGearFilter(it, selected ? draft : toggled(kind, key))).length;
    const b = button({ label: `${label}（${n}）`, kind: selected ? "primary" : "secondary", size: "sm", disabled: !n && !selected, onTap: () => toggle(kind, key) });
    b.setAttribute("aria-pressed", String(selected)); b.dataset.filterKey = key;
    return b;
  };
  function refresh() {
    picked.replaceChildren();
    for (const key of draft.elements) picked.appendChild(button({ label: `${elementLabel(key)} ×`, kind: "primary", size: "sm", onTap: () => toggle("elements", key) }));
    for (const key of draft.effects) picked.appendChild(button({ label: `${labels.get(key) || "特殊効果"} ×`, kind: "primary", size: "sm", onTap: () => toggle("effects", key) }));
    elements.replaceChildren();
    for (const kind of ["eAtk", "eDef"]) for (const e of ELEMENT_KEYS) elements.appendChild(optionButton("elements", `${kind}:${e}`, elementLabel(`${kind}:${e}`)));
    groups.replaceChildren();
    for (const [key, label] of GROUPS) {
      const b = button({ label, kind: group === key ? "primary" : "secondary", size: "sm", onTap: () => { group = key; refresh(); } });
      b.setAttribute("aria-pressed", String(group === key)); groups.appendChild(b);
    }
    list.replaceChildren();
    // 未選択時は分類か検索から入る。大量の効果を一度に並べない。
    const q = normalize(query);
    const shown = options.filter(o => (group === "all" || o.group === group) && (!q || normalize(`${o.label} ${o.description}`).includes(q)));
    if (group === "all" && !q) list.appendChild(el("p", "gf-hint", "分類を選ぶか、効果名・説明を検索してください。"));
    else {
      for (const o of shown) list.appendChild(optionButton("effects", o.key, o.label));
      if (!shown.length) list.appendChild(el("p", "gf-hint", "該当する効果はない。分類や検索語を変えてください。"));
    }
    const n = source.filter(it => matchesGearFilter(it, draft)).length;
    result.textContent = `${n}点が一致${n ? "" : "。条件を外すと表示を増やせる"}`;
    // 本文を置き直すと検索欄のフォーカスとスクロールが飛ぶため、操作だけを更新する。
    if (h) h.foot.replaceChildren(...footer(n).map(action => button({ ...action, onTap: () => action.onTap(h) })));
  }
  const footer = n => [
    { label: "すべて解除", kind: "ghost", onTap: () => { draft = { elements: [], effects: [], allEffects: false }; mode.checked = false; refresh(); } },
    { label: "キャンセル", kind: "secondary", onTap: x => x.close() },
    { label: `${n}点を表示`, kind: "primary", onTap: x => { setPref("gearFilter", draft); x.close(); onApply(); } },
  ];
  refresh();
  h = sheet.open({ kind: "info", title: "装備の絞り込み", body, className: "gf-sheet", footer: footer(source.filter(it => matchesGearFilter(it, draft)).length) });
  return h;
}
