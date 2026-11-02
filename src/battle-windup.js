// 通知前は構えだけを描く。戦況・乱数・保存内容には触れず、通知が来たら即座に外す。
import { SFX } from "./audio.js";
let active = null;
export function beginBattleWindup({ party, index, view, label = "攻撃の構え", kind = "strike", aim = null, onFrame = null } = {}) {
  active?.stop();
  const card = party?.querySelector(`.pc[data-idx="${index}"]`);
  if (!card || !view || document.hidden) return { stop() {} };
  const root = document.createElement("div"); root.className = "battle-windup battle-windup-" + (kind === "cast" ? "cast" : "strike");
  root.setAttribute("aria-hidden", "true");
  const add = name => { const node = document.createElement("span"); node.className = name; root.appendChild(node); return node; };
  add("windup-sweep"); add("windup-ring");
  for (let i = 0; i < 6; i++) { const p = add("windup-spark"); p.style.setProperty("--i", i); }
  if (aim) {
    const marker = add("windup-aim"); marker.style.left = `${Math.max(5, Math.min(95, aim.x * 100))}%`; marker.style.top = `${Math.max(10, Math.min(85, aim.y * 100))}%`;
    for (let i = 0; i < 4; i++) marker.appendChild(document.createElement("i"));
  }
  add("windup-name").textContent = label;
  party.dataset.choiceIndex = String(index); party.classList.add("choice-windup"); card.classList.add("battle-windup-actor");
  const layout = () => {
    const rect = view.getBoundingClientRect();
    root.style.left = rect.left + "px"; root.style.top = rect.top + "px"; root.style.width = rect.width + "px"; root.style.height = rect.height + "px";
  };
  layout(); document.body.appendChild(root);
  let sound = null, ended = false, frame = 0;
  // 音声の準備に失敗しても、選択の通信や結果処理を止めない。
  try { sound = SFX.prepare(kind); } catch {}
  const resize = new ResizeObserver(layout); resize.observe(view);
  const hide = () => { if (document.hidden) handle.stop(true); };
  const leave = () => handle.stop(true);
  const gate = document.querySelector(".cloud-gate");
  const checkError = () => { if (gate && !gate.hidden && gate.querySelector(".cloud-panel:not([hidden])")) handle.stop(); };
  const gateWatch = gate ? new MutationObserver(checkError) : null;
  gateWatch?.observe(gate, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
  const handle = {
    stop(immediate = false) {
      if (ended) return;
      ended = true; cancelAnimationFrame(frame); resize.disconnect(); gateWatch?.disconnect();
      window.removeEventListener("resize", layout); window.removeEventListener("scroll", layout, true);
      document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave);
      root.remove(); card.classList.remove("battle-windup-actor"); party.classList.remove("choice-windup");
      try { sound?.({ immediate }); } catch {}
      sound = null; if (active === handle) active = null;
    },
  };
  active = handle;
  window.addEventListener("resize", layout, { passive: true }); window.addEventListener("scroll", layout, { passive: true, capture: true });
  document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", leave);
  frame = requestAnimationFrame(() => { if (!ended) onFrame?.(); });
  checkError();
  return handle;
}
