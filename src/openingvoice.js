import { isMuted } from "./audio.js";

// 六幕の字幕に沿った英語の語り。固有名は字幕と同じ人物・場所を指す。
export const NARRATION = [
  [
    "One night, the earth of the kingdom split apart.",
    "Beneath it, a hundred labyrinths opened their mouths.",
    "Feeding on the souls of the dead, they swell with every passing night. A sickness without end, deep within the earth.",
  ],
  [
    "Thousands took up swords and lanterns, and descended into the dark.",
    "Not one returned.",
    "Neither armor nor prayer can hold back the abyss. It devours the souls of the living first.",
  ],
  [
    "And so, from wood, black iron, and prayer, they fashioned empty vessels.",
    "Dolls.",
    "Seal a departed soul within a doll's breast, and it quietly opens its eyes.",
    "These dolls are more than tools. They are a second life, granted to the dead.",
  ],
  [
    "Those who guide souls, and lead the dolls into the abyss.",
    "Their art is feared, and known by a name.",
    "Soulmancers.",
    "Ordo, soulmancer to the king, descended into the labyrinths a year ago. He never returned.",
    "He was your master.",
  ],
  [
    "Only a single letter reached his apprentice.",
    "Come to Loadal. Keep the mansion's flame alive.",
    "At the edge of the kingdom lies the frontier town of Loadal. Beneath its tombs, the dead have forgotten how to sleep.",
  ],
  [
    "In your master's mansion, a flame burns, bound to his soul.",
    "As long as that flame endures, his soul remains, somewhere.",
    "Find your master. Whatever awaits you at the bottom of the hundred labyrinths.",
  ],
];

// 音声APIには性別・年齢が無いので、既知の男性音声名を優先する。
function narratorVoice(voices) {
  const score = (voice) => {
    const name = voice.name || "";
    const preferred = /\b(Daniel|George|Arthur)\b/i.test(name);
    const male = preferred || /\b(Oliver|Ryan|Thomas|James|David|Mark|Alex|Guy)\b/i.test(name)
      || /\bmale\b/i.test(name);
    return (preferred ? 40 : male ? 20 : 0)
      + (/^en[-_]GB$/i.test(voice.lang) ? 4 : 0)
      + (voice.localService ? 1 : 0);
  };
  return voices.reduce((best, voice) => !best || score(voice) > score(best) ? voice : best, null);
}

// 端末の英語音声を使う試聴版。読み上げの失敗で幕送りを止めない。
export function createOpeningVoice() {
  const synth = globalThis.speechSynthesis;
  const supported = !!synth && typeof globalThis.SpeechSynthesisUtterance === "function";
  let current = null, timer = 0, deadline = 0, active = false;
  let hooks = {}, line = 0, fraction = 0, anchor = 0, duration = 1;
  const stop = () => {
    clearTimeout(timer);
    active = false;
    deadline = 0;
    if (!current) return;
    current.onend = current.onerror = current.onstart = current.onboundary = null;
    current = null;
    try { synth.cancel(); } catch {}
  };
  const fallback = () => {
    const notify = hooks.onFallback;
    stop();
    if (notify) notify();
  };
  const report = (value) => { if (hooks.onProgress) hooks.onProgress(line, value); };
  const speak = (index, voice) => {
    if (!active) return;
    if (isMuted() || document.hidden) { fallback(); return; }
    try {
      const content = NARRATION[index][line];
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = voice ? voice.lang : "en-GB";
      if (voice) utterance.voice = voice;
      utterance.rate = 0.76;
      utterance.pitch = 0.62;
      utterance.volume = 0.85;
      current = utterance;
      fraction = 0; anchor = 0;
      duration = Math.max(900, content.split(/\s+/).length / (150 * utterance.rate) * 60000);
      deadline = Date.now() + 4000;
      timer = setTimeout(() => { if (current === utterance && !anchor) fallback(); }, 4000);
      utterance.onstart = () => {
        if (current !== utterance) return;
        clearTimeout(timer);
        deadline = Date.now() + 90000;
        anchor = Date.now();
        report(0);
      };
      utterance.onboundary = (event) => {
        if (current !== utterance || !anchor || !Number.isFinite(event.charIndex)) return;
        fraction = Math.max(fraction, Math.min(0.98, event.charIndex / content.length));
        anchor = Date.now();
        report(fraction);
      };
      utterance.onend = () => {
        if (current !== utterance) return;
        clearTimeout(timer);
        current = null;
        report(1);
        line++;
        if (line < NARRATION[index].length) speak(index, voice);
        else { active = false; deadline = 0; if (hooks.onEnd) hooks.onEnd(); }
      };
      utterance.onerror = () => { if (current === utterance) fallback(); };
      synth.speak(utterance);
    } catch { fallback(); }
  };
  return {
    supported,
    start(index, callbacks = {}) {
      stop();
      hooks = callbacks;
      line = 0;
      if (!supported || isMuted() || document.hidden || !NARRATION[index]) { fallback(); return; }
      try {
        const voices = synth.getVoices();
        const voice = narratorVoice(voices.filter(v => /^en[-_]/i.test(v.lang)));
        // 未ロード時は英語の既定音声に任せる。
        if (!voice && voices.length) { fallback(); return; }
        active = true;
        speak(index, voice);
      } catch { fallback(); }
    },
    stop,
    busy() {
      if (active && (isMuted() || document.hidden || Date.now() >= deadline)) fallback();
      if (current && anchor) report(Math.min(0.98, fraction + (Date.now() - anchor) / duration));
      return active;
    },
  };
}
