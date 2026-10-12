import { isMuted } from "./audio.js";

// 六幕の字幕に沿った英語の語り。固有名は字幕と同じ人物・場所を指す。
export const NARRATION = [
  "One night, the earth of the kingdom split apart. Beneath it, a hundred labyrinths opened their mouths. Feeding on the souls of the dead, they swell with every passing night. A sickness without end, deep within the earth.",
  "Thousands took up swords and lanterns, and descended into the dark. Not one returned. Neither armor nor prayer can hold back the abyss. It devours the souls of the living first.",
  "And so, from wood, black iron, and prayer, they fashioned empty vessels. Dolls. Seal a departed soul within a doll's breast, and it quietly opens its eyes. These dolls are more than tools. They are a second life, granted to the dead.",
  "Those who guide souls, and lead the dolls into the abyss, are known by a name spoken with fear. Soulmancers. Ordo, soulmancer to the king, descended into the labyrinths a year ago. He never returned. He was your master.",
  "Only a single letter reached his apprentice. Come to Loadal. Keep the mansion's flame alive. At the edge of the kingdom lies the frontier town of Loadal. Beneath its tombs, the dead have forgotten how to sleep.",
  "In your master's mansion, a flame burns, bound to his soul. As long as that flame endures, his soul remains, somewhere. Find your master. Whatever awaits you at the bottom of the hundred labyrinths.",
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
  let current = null, timer = 0, deadline = 0;
  const stop = () => {
    clearTimeout(timer);
    deadline = 0;
    if (!current) return;
    current.onend = current.onerror = current.onstart = null;
    current = null;
    try { synth.cancel(); } catch {}
  };
  const speak = (index) => {
    stop();
    if (!supported || isMuted() || document.hidden || !NARRATION[index]) return;
    try {
      const voices = synth.getVoices().filter(v => /^en[-_]/i.test(v.lang));
      const voice = narratorVoice(voices);
      // 未ロード時は英語の既定音声に任せる。英語が無い端末では字幕だけを流す。
      if (!voice && synth.getVoices().length) return;
      const utterance = new SpeechSynthesisUtterance(NARRATION[index]);
      utterance.lang = voice ? voice.lang : "en-GB";
      if (voice) utterance.voice = voice;
      utterance.rate = 0.76;
      utterance.pitch = 0.62;
      utterance.volume = 0.85;
      current = utterance;
      deadline = Date.now() + 4000;
      utterance.onstart = () => { if (current === utterance) deadline = Date.now() + 90000; };
      utterance.onend = utterance.onerror = () => { if (current === utterance) { current = null; deadline = 0; } };
      synth.speak(utterance);
    } catch { stop(); }
  };
  return {
    supported,
    start(index, delay = 0) {
      stop();
      if (supported) timer = setTimeout(() => speak(index), delay);
    },
    stop,
    busy() {
      if (current && (isMuted() || document.hidden || Date.now() >= deadline)) stop();
      return !!current;
    },
  };
}
