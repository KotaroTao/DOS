// 手帳と街の設定で共用するプレイヤー名。編集中は元のシートを残し、探索・戦闘を再開しない。
import { game } from "./ctx.js";
import { el, button, sheet } from "./kit.js";
import { NAME_LIMIT, normalizeName } from "../protagonist.js";

export function playerNameCard() {
  const card = el("section", "player-name-card");
  const text = el("div", "player-name-text");
  const name = el("div", "player-name-value");
  const insight = el("div", "player-name-insight");
  const refresh = () => {
    name.textContent = normalizeName(game.G?.apprenticeName) || "名前未設定";
    const unlocked = !!game.featureUnlocked?.("insight");
    insight.hidden = !unlocked;
    insight.textContent = unlocked ? `見識 ${game.insightSummary().total.toLocaleString("ja-JP")}` : "";
  };
  refresh();
  text.append(el("div", "player-name-label", "プレイヤー名"), name, insight);
  const edit = button({ label: "編集", onTap: () => openPlayerName(() => { refresh(); edit.focus(); }) });
  edit.setAttribute("aria-label", "プレイヤー名を編集");
  card.append(text, edit);
  return card;
}

function openPlayerName(onClose) {
  const g = game.G;
  if (!g) return;
  const body = el("div", "player-name-form");
  const label = el("label", "player-name-label", "プレイヤー名");
  const input = el("input", "player-name-input");
  input.type = "text"; input.autocomplete = "off"; input.maxLength = NAME_LIMIT * 2;
  input.value = normalizeName(g.apprenticeName);
  label.appendChild(input);
  const error = el("div", "player-name-error");
  error.setAttribute("role", "alert");
  body.append(label, el("p", "player-name-help", `1〜${NAME_LIMIT}文字。いつでも無料で変更できます。会話で呼ばれる名前も変わります。`), error);
  let h;
  const save = () => {
    if (h.closed) return;
    const name = normalizeName(input.value);
    if (!name) { error.textContent = "名前を入力してください。"; input.focus(); return; }
    if (Array.from(input.value.normalize("NFC").trim()).length > NAME_LIMIT) {
      error.textContent = `名前は${NAME_LIMIT}文字以内で入力してください。`; input.focus(); return;
    }
    g.apprenticeName = name;
    if (game.autosave) game.autosave(true);
    h.close("save");
  };
  h = sheet.open({
    kind: "choice", banner: "プレイヤー名を編集", className: "player-name-sheet", body,
    footer: [
      { label: "保存する", kind: "primary", onTap: save },
      { label: "やめる", kind: "ghost", onTap: s => s.close("cancel") },
    ],
    onClose,
  });
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); e.stopPropagation(); save();
  });
  input.focus(); input.select();
}
