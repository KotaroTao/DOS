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
  let hooks = {}, started = false, retried = false, request = () => {};
  const retry = (event) => {
    if (!active || started) return;
    request();
    if (event?.type === "pointerdown" || event?.type === "keydown") retried = true;
  };
  const unlisten = () => {
    synth?.removeEventListener?.("voiceschanged", retry);
    document.removeEventListener("pointerdown", retry, true);
    document.removeEventListener("keydown", retry, true);
  };
  const stop = () => {
    clearTimeout(timer);
    unlisten();
    active = false;
    retried = false;
    deadline = 0;
    if (!current) return;
    current.onend = current.onerror = current.onstart = null;
    current = null;
    try { synth.cancel(); } catch {}
  };
  const fallback = () => {
    const notify = hooks.onFallback;
    stop();
    if (notify) notify();
  };
  const speak = (index, line, voice) => {
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
      utterance.onstart = () => {
        if (current !== utterance) return;
        started = true;
        clearTimeout(timer);
        unlisten();
        deadline = Date.now() + 90000;
      };
      utterance.onend = () => {
        if (current !== utterance) return;
        clearTimeout(timer);
        current = null;
        active = false; deadline = 0;
        if (hooks.onEnd) hooks.onEnd();
      };
      utterance.onerror = (event) => {
        if (current !== utterance) return;
        // 読み込み直後の自動再生制限は、最初の操作で同じ幕から再試行する。
        if (!started && event.error === "not-allowed") { current = null; return; }
        fallback();
      };
      synth.speak(utterance);
    } catch { fallback(); }
  };
  return {
    supported,
    start(index, line, callbacks = {}) {
      stop();
      hooks = callbacks;
      if (!supported || isMuted() || document.hidden || !NARRATION[index]?.[line]) { fallback(); return; }
      active = true; started = false;
      deadline = Date.now() + 15000;
      timer = setTimeout(fallback, 15000);
      request = () => {
        try {
          const voices = synth.getVoices();
          const voice = narratorVoice(voices.filter(v => /^en[-_]/i.test(v.lang)));
          // 英語音声の登録が遅い端末では、同じ行を保持して一覧の更新を待つ。
          if (!voice && voices.length) return;
          if (current) {
            current.onstart = current.onend = current.onerror = null;
            current = null;
            synth.cancel();
          }
          speak(index, line, voice);
        } catch { fallback(); }
      };
      synth.addEventListener?.("voiceschanged", retry);
      document.addEventListener("pointerdown", retry, true);
      document.addEventListener("keydown", retry, true);
      request();
    },
    stop,
    consumeRetry() { const value = retried; retried = false; return value; },
    busy() {
      if (active && (isMuted() || document.hidden || Date.now() >= deadline)) fallback();
      return active;
    },
  };
}
