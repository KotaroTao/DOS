// 再生制限・音声一覧の遅延・停止中の読み上げを端末APIの代役で確かめる。
import assert from "node:assert/strict";
import { createOpeningVoice } from "../../src/openingvoice.js";

globalThis.document = { hidden: false };
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};
const english = { name: "Daniel", lang: "en-GB", localService: true };
let voices = [english], allowed = false, spoken = [], resumed = 0, ended = 0, fallback = 0;
const events = new EventTarget();
globalThis.speechSynthesis = {
  paused: false,
  getVoices: () => voices,
  addEventListener: (...args) => events.addEventListener(...args),
  removeEventListener: (...args) => events.removeEventListener(...args),
  cancel() {},
  resume() { this.paused = false; resumed++; },
  speak(utterance) {
    spoken.push(utterance);
    if (allowed) utterance.onstart();
    else utterance.onerror({ error: "not-allowed" });
  },
};
const voice = createOpeningVoice();
const hooks = { onEnd: () => ended++, onFallback: () => fallback++ };
try {
  voice.start(0, 0, hooks);
  assert.equal(voice.busy(), true);
  assert.equal(fallback, 0);
  allowed = true;
  assert.equal(voice.retry(), true, "操作で同じ行を再試行する");
  assert.equal(spoken[0].text, spoken[1].text);
  assert.equal(voice.retry(), false, "再生中は幕送りを妨げない");
  spoken.at(-1).onend();
  assert.equal(ended, 1);
  assert.equal(voice.busy(), false);

  voices = [{ name: "日本語", lang: "ja-JP" }];
  const count = spoken.length;
  voice.start(0, 1, hooks);
  assert.equal(spoken.length, count);
  voices = [english];
  events.dispatchEvent(new Event("voiceschanged"));
  assert.equal(spoken.length, count + 1, "英語音声の登録を待って再生する");

  speechSynthesis.paused = true;
  voice.start(1, 0, hooks);
  assert.equal(resumed, 1, "一時停止状態を解除する");
  const staleEnd = spoken.at(-1).onend;
  voice.stop();
  staleEnd();
  assert.equal(ended, 1, "停止した行の通知を無視する");
  assert.equal(voice.retry(), false, "スキップ後に再生しない");

  document.hidden = true;
  voice.start(0, 0, hooks);
  assert.equal(fallback, 1);
  assert.equal(voice.busy(), false);
  console.log("オープニング音声: 再試行・音声登録の遅延・一時停止・終了・スキップ・非表示 OK");
} finally {
  voice.stop();
}
