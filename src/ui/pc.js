// PCの一覧と詳細。選択・検索は画面だけの状態で、セーブや所持品には触れない。
import { el, button } from "./kit.js";
const selections = new Map(), queries = new Map();
const plain = value => String(value || "").replace(/\u200b/g, "").normalize("NFKC").toLowerCase();
export function pcPanel(title, className = "") {
  const panel = el("section", "pc-panel " + className);
  panel.appendChild(el("h2", "pc-heading", title));
  return panel;
}
export function pcMasterDetail({ key, items, label, getKey, searchText, summary, detail, onSelect }) {
  const root = el("div", "pc-master"), master = el("section", "pc-master-list"), pane = el("section", "pc-detail");
  master.setAttribute("aria-label", label + "一覧"); pane.setAttribute("aria-label", label + "の詳細");
  const search = el("input", "pc-search"); search.type = "search"; search.placeholder = label + "を検索";
  search.setAttribute("aria-label", label + "を検索"); search.value = queries.get(key) || "";
  const count = el("div", "pc-count"), list = el("div", "pc-rows");
  list.setAttribute("aria-label", label + "を選ぶ");
  master.append(search, count, list); root.append(master, pane);
  let active = selections.get(key), shown = [], buttons = [];
  const choose = item => {
    active = getKey(item); selections.set(key, active);
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(getKey(shown[i]) === active)));
    pane.replaceChildren(); detail(item, pane); onSelect?.(item);
  };
  const draw = () => {
    const q = plain(search.value); queries.set(key, search.value);
    shown = items.filter(item => plain(searchText(item)).includes(q));
    count.textContent = `${shown.length} / ${items.length} 件`;
    list.replaceChildren(); buttons = [];
    for (const item of shown) {
      const b = button({ label: "", kind: "secondary", onTap: () => choose(item) });
      b.classList.add("pc-list-row"); b.replaceChildren(summary(item));
      list.appendChild(b); buttons.push(b);
    }
    const item = shown.find(item => getKey(item) === active) || shown[0];
    if (item) choose(item);
    else pane.replaceChildren(el("p", "pc-empty", "条件に合う項目がありません。検索する言葉を変えてください。"));
  };
  search.addEventListener("input", draw);
  list.addEventListener("keydown", e => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = buttons.indexOf(e.target);
    if (i < 0 || !["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const n = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
    choose(shown[n]); buttons[n].focus();
  });
  draw();
  return root;
}
