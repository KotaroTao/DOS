// Web Audio による効果音とBGM (外部素材なしのチップチューン生成)
let actx = null;
let muted = false;
let pendingBgm = null;
const bgm = { name: null, timer: null, nextTime: 0, step: 0 };

export function initAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (actx.state === "suspended") actx.resume();
  if (pendingBgm) {
    const n = pendingBgm;
    pendingBgm = null;
    playBgm(n);
  }
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  return muted;
}

// t: AudioContext の絶対時刻
function toneAt(t, freq, dur, type = "square", vol = 0.05, slideTo = null) {
  if (!actx || muted) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function blip(freq, dur, type = "square", vol = 0.05, delay = 0, slideTo = null) {
  if (!actx) return;
  toneAt(actx.currentTime + delay, freq, dur, type, vol, slideTo);
}

function noise(dur, vol = 0.08, delay = 0) {
  if (!actx || muted) return;
  const t = actx.currentTime + delay;
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const g = actx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(actx.destination);
  src.start(t);
}

export const SFX = {
  select() { blip(880, 0.06, "square", 0.035); },
  flip() { blip(520, 0.09, "triangle", 0.05, 0, 820); },
  step() { blip(240, 0.04, "triangle", 0.025); },
  hit() { noise(0.1, 0.08); blip(170, 0.1, "square", 0.05, 0, 80); },
  miss() { blip(320, 0.08, "sine", 0.04, 0, 180); },
  spell() { blip(700, 0.12, "sawtooth", 0.045, 0, 1500); blip(900, 0.12, "sawtooth", 0.035, 0.06, 1900); },
  heal() { blip(523, 0.1, "sine", 0.05); blip(659, 0.1, "sine", 0.05, 0.08); blip(784, 0.15, "sine", 0.05, 0.16); },
  chest() { blip(784, 0.08, "square", 0.05); blip(988, 0.08, "square", 0.05, 0.09); blip(1319, 0.18, "square", 0.05, 0.18); },
  trap() { blip(220, 0.22, "sawtooth", 0.06, 0, 85); noise(0.16, 0.05); },
  stairs() { blip(392, 0.1, "triangle", 0.05); blip(330, 0.1, "triangle", 0.05, 0.1); blip(262, 0.2, "triangle", 0.05, 0.2); },
  die() { blip(200, 0.3, "square", 0.05, 0, 55); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.12, "square", 0.05, i * 0.09)); },
  victory() { [523, 523, 523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, "square", 0.055, i * 0.14)); },
  gameover() { [392, 370, 349, 330].forEach((f, i) => blip(f, 0.32, "triangle", 0.055, i * 0.26)); },
};

// ---- BGM: ステップシーケンサ ----
// notes: [開始ステップ, 周波数, 長さ(ステップ数)]
const THEMES = {
  field: {
    stepDur: 0.26,
    loop: 16,
    voices: [
      { // ベース
        type: "triangle", vol: 0.045,
        notes: [[0, 110, 2], [2, 131, 2], [4, 98, 2], [6, 110, 2], [8, 87, 2], [10, 98, 2], [12, 110, 2], [14, 123, 2]],
      },
      { // メロディ
        type: "square", vol: 0.028,
        notes: [[0, 440, 1], [1, 523, 1], [2, 659, 2], [4, 587, 1], [5, 523, 1], [6, 494, 2],
                [8, 440, 1], [9, 392, 1], [10, 440, 2], [12, 330, 2], [14, 392, 2]],
      },
    ],
  },
  battle: {
    stepDur: 0.135,
    loop: 16,
    voices: [
      { // 駆けるベース
        type: "square", vol: 0.045,
        notes: [[0, 110, 1], [1, 110, 1], [2, 131, 1], [3, 110, 1], [4, 147, 1], [5, 110, 1], [6, 131, 1], [7, 110, 1],
                [8, 110, 1], [9, 110, 1], [10, 165, 1], [11, 147, 1], [12, 131, 1], [13, 123, 1], [14, 110, 1], [15, 98, 1]],
      },
      { // 旋律
        type: "sawtooth", vol: 0.022,
        notes: [[0, 440, 2], [2, 494, 2], [4, 523, 2], [6, 494, 2], [8, 440, 2], [10, 392, 2], [12, 440, 4]],
      },
    ],
  },
};

export function playBgm(name) {
  stopBgm();
  if (!name) return;
  if (!actx) { pendingBgm = name; return; } // 初回ユーザー操作後に開始
  bgm.name = name;
  bgm.step = 0;
  bgm.nextTime = actx.currentTime + 0.06;
  bgm.timer = setInterval(() => {
    const th = THEMES[bgm.name];
    while (bgm.nextTime < actx.currentTime + 0.35) {
      const s = bgm.step % th.loop;
      for (const v of th.voices) {
        for (const [st, f, d] of v.notes) {
          if (st === s) toneAt(bgm.nextTime, f, d * th.stepDur * 0.9, v.type, v.vol);
        }
      }
      bgm.nextTime += th.stepDur;
      bgm.step++;
    }
  }, 110);
}

export function stopBgm() {
  if (bgm.timer) clearInterval(bgm.timer);
  bgm.timer = null;
  bgm.name = null;
  pendingBgm = null;
}
