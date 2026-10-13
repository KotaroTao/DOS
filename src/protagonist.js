// 弟子の名前。名前を知る場面だけに印を置き、呼称の一括置換はしない。
export const NAME_LIMIT = 12;
export function normalizeName(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim()).slice(0, NAME_LIMIT).join("");
}
export function storyText(text, state = {}) {
  const name = normalizeName(state?.apprenticeName);
  return String(text).replace(/\{弟子名(?::(様|殿|師))?\}/g, (_, style) => {
    if (name) return name + (style === "師" ? "" : style || "");
    // 名前のない旧セーブは従来の呼び方で読める。
    return style === "様" ? "お弟子さま" : style === "殿" ? "弟子殿" : style === "師" ? "弟子" : "オルドの弟子";
  });
}
