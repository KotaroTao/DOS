// マウスを接続したタブレットでも、従来の画面を保つ。
const touch = (navigator.maxTouchPoints || 0) > 0;
document.documentElement.classList.toggle("pc-input", !touch);
const media = typeof window.matchMedia === "function"
  ? window.matchMedia("(min-width: 1100px) and (min-height: 600px) and (hover: hover) and (pointer: fine)") : null;
export const isDesktopLayout = () => !touch && !!media?.matches;
const listeners = new Set();
export function onDesktopLayoutChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
media?.addEventListener("change", () => { for (const fn of listeners) fn(isDesktopLayout()); });
