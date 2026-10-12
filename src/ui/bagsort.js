// 隊の共通袋の並び順。館・詳細シート・商会・無限迷宮で同じ好みを使う。
import { BAG_SORTS, sortedBag } from "../items.js";
import { el } from "./kit.js";
import { getPref, setPref } from "./prefs.js";

export function bagItems(items) { return sortedBag(items, getPref("bagSort", "bag")); }
export function bagSortControl(onChange) {
  const label = el("label", "ui-bag-sort");
  label.appendChild(el("span", null, "並び順"));
  const select = el("select", "ui-bag-sort-select");
  select.setAttribute("aria-label", "隊の持ち物の並び順");
  for (const s of BAG_SORTS) {
    const option = el("option", null, s.label);
    option.value = s.key;
    select.appendChild(option);
  }
  const key = getPref("bagSort", "bag");
  select.value = BAG_SORTS.some((s) => s.key === key) ? key : "bag";
  select.addEventListener("change", () => {
    setPref("bagSort", select.value);
    if (onChange) onChange();
  });
  label.appendChild(select);
  return label;
}
