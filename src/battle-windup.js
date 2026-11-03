// 通知前は構えだけを描く。通常攻撃は確定と振り抜きが終わってから着弾へつなぐ。
import { SFX } from "./audio.js";
let active = null;
const ATTACK_TIMES = [{ prepare: 280, release: 80, reaction: 140 }, { prepare: 200, release: 80, reaction: 120 }];
export const normalAttackTiming = fast => ATTACK_TIMES[fast ? 1 : 0];
function attackMotion(root, style, aim) {
  const type = ["thrust", "arrow", "arcane"].includes(style) ? style : ["blunt", "smash"].includes(style) ? "blunt" : "slash";
  root.classList.add("normal-attack", "normal-attack-" + type); root.dataset.attackStyle = type;
  root.style.setProperty("--attack-x", `${Math.max(8, Math.min(92, (aim?.x ?? .5) * 100))}%`);
  root.style.setProperty("--attack-y", `${Math.max(15, Math.min(78, (aim?.y ?? .4) * 100))}%`);
  const motion = document.createElement("span"); motion.className = "attack-motion";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 160 160"); svg.classList.add("attack-trail");
  const paths = {
    // 武器や手を描かず、力の向きだけを光の筋で示す。
    slash: ["M128 28 Q114 39 104 54", "M137 38 L119 57"],
    blunt: ["M62 25 Q80 38 98 25", "M68 42 Q80 50 92 42"],
    thrust: ["M80 132 L80 102", "M72 136 L72 117"],
    arrow: ["M120 126 L104 108", "M133 123 L120 108"],
    arcane: ["M60 112 Q80 94 100 112", "M68 122 Q80 111 92 122"],
  };
  for (const d of paths[type]) { const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", d); svg.appendChild(path); }
  motion.appendChild(svg); root.appendChild(motion);
}
export function beginBattleWindup({ party, index, view, label = "攻撃の構え", kind = "strike", aim = null, onFrame = null, attackStyle = null, fast = false, skillFamily = null } = {}) {
  active?.stop();
  const card = party?.querySelector(`.pc[data-idx="${index}"]`);
  if (!card || !view || document.hidden) return { stop() {}, complete: () => Promise.resolve() };
  const root = document.createElement("div"); root.className = "battle-windup battle-windup-" + (kind === "cast" ? "cast" : "strike");
  if (skillFamily) {
    root.classList.add("skill-windup"); root.dataset.skillFamily=skillFamily;
    const tones={heal:"130,220,160",revive:"242,218,151",purify:"156,224,232",ward:"175,211,235",fireball:"246,155,94",firePillar:"246,155,94",ice:"161,216,247",void:"179,151,208",drain:"204,146,181",poison:"170,192,117"};
    if(tones[skillFamily])root.style.setProperty("--windup-rgb",tones[skillFamily]);
  }
  root.setAttribute("aria-hidden", "true");
  const add = name => { const node = document.createElement("span"); node.className = name; root.appendChild(node); return node; };
  add("windup-sweep"); add("windup-ring");
  for (let i = 0; i < 6; i++) { const p = add("windup-spark"); p.style.setProperty("--i", i); }
  if (aim) {
    const marker = add("windup-aim"); marker.style.left = `${Math.max(5, Math.min(95, aim.x * 100))}%`; marker.style.top = `${Math.max(10, Math.min(85, aim.y * 100))}%`;
    for (let i = 0; i < 4; i++) marker.appendChild(document.createElement("i"));
  }
  // 名前は敵のCanvasに重ねず、敵表示直下の固定枠へ置く。
  const name = document.createElement("div"); name.className = "battle-action-name";
  name.textContent = label; name.setAttribute("role", "status");
  const dock = document.getElementById("combat-message") || view.parentElement;
  dock.replaceChildren(name);
  const attack = attackStyle !== null, timing = normalAttackTiming(fast), started = performance.now();
  if (attack) {
    attackMotion(root, attackStyle, aim);
    root.style.setProperty("--attack-prepare", timing.prepare + "ms");
    root.style.setProperty("--attack-release", timing.release + "ms");
  }
  party.dataset.choiceIndex = String(index); party.classList.add("choice-windup"); card.classList.add("battle-windup-actor");
  const layout = () => {
    const rect = view.getBoundingClientRect();
    root.style.left = rect.left + "px"; root.style.top = rect.top + "px"; root.style.width = rect.width + "px"; root.style.height = rect.height + "px";
  };
  layout(); document.body.appendChild(root);
  let sound = null, ended = false, frame = 0, completion = null;
  const waits = new Map();
  const delay = ms => new Promise(resolve => {
    if (ended || ms <= 0) { resolve(); return; }
    const timer = setTimeout(() => { waits.delete(timer); resolve(); }, ms);
    waits.set(timer, resolve);
  });
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
    complete() {
      if (completion) return completion;
      completion = (async () => {
        if (attack && !ended) {
          // 短い通信では振りかぶりを見せ、長い通信では溜めを保つ。命中の表現はまだ出さない。
          await delay(timing.prepare - (performance.now() - started));
          if (ended) return;
          root.classList.add("attack-releasing");
          await delay(timing.release);
        }
        handle.stop();
      })();
      return completion;
    },
    stop(immediate = false) {
      if (ended) return;
      ended = true;
      for (const [timer, resolve] of waits) { clearTimeout(timer); resolve(); } waits.clear();
      cancelAnimationFrame(frame); resize.disconnect(); gateWatch?.disconnect();
      window.removeEventListener("resize", layout); window.removeEventListener("scroll", layout, true);
      document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave);
      name.remove(); root.remove(); card.classList.remove("battle-windup-actor"); party.classList.remove("choice-windup");
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
