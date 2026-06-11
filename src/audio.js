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
  swing() { blip(300, 0.07, "triangle", 0.035, 0, 140); noise(0.05, 0.03); },
  hit() { noise(0.1, 0.08); blip(170, 0.1, "square", 0.05, 0, 80); },
  crit() { noise(0.16, 0.11); blip(140, 0.18, "square", 0.06, 0, 70); blip(330, 0.1, "square", 0.045, 0.05); },
  miss() { blip(320, 0.08, "sine", 0.04, 0, 180); },
  evade() { blip(900, 0.07, "sine", 0.035, 0, 1700); noise(0.04, 0.02, 0.02); }, // 回避: 風切り音
  spell() { blip(700, 0.12, "sawtooth", 0.045, 0, 1500); blip(900, 0.12, "sawtooth", 0.035, 0.06, 1900); },
  fire() { noise(0.22, 0.06); blip(500, 0.2, "sawtooth", 0.05, 0, 120); blip(800, 0.16, "square", 0.03, 0.05, 200); },
  heal() { blip(523, 0.1, "sine", 0.05); blip(659, 0.1, "sine", 0.05, 0.08); blip(784, 0.15, "sine", 0.05, 0.16); },
  chest() { blip(784, 0.08, "square", 0.05); blip(988, 0.08, "square", 0.05, 0.09); blip(1319, 0.18, "square", 0.05, 0.18); },
  trap() { blip(220, 0.22, "sawtooth", 0.06, 0, 85); noise(0.16, 0.05); },
  stairs() { blip(392, 0.1, "triangle", 0.05); blip(330, 0.1, "triangle", 0.05, 0.1); blip(262, 0.2, "triangle", 0.05, 0.2); },
  die() { blip(200, 0.3, "square", 0.05, 0, 55); },
  levelup() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.12, "square", 0.05, i * 0.09)); },
  itemget() { [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.13, "square", 0.05, i * 0.07)); blip(1047, 0.3, "triangle", 0.04, 0.4); },
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
  // 街 (広場): 素朴なワルツ。旅人を迎える夕暮れの灯
  town: {
    stepDur: 0.30,
    loop: 24,
    voices: [
      { // ベース (ゆれる低音)
        type: "triangle", vol: 0.040,
        notes: [[0, 131, 3], [3, 98, 3], [6, 110, 3], [9, 98, 3], [12, 131, 3], [15, 110, 3], [18, 98, 3], [21, 123, 3]],
      },
      { // 旋律 (素朴な笛)
        type: "sine", vol: 0.034,
        notes: [[0, 523, 2], [2, 587, 1], [3, 659, 3], [6, 587, 2], [8, 523, 2], [10, 494, 2],
                [12, 523, 3], [15, 440, 2], [17, 392, 1], [18, 440, 4], [22, 494, 2]],
      },
    ],
  },
  // ボス: 重く速い脅威のテーマ
  boss: {
    stepDur: 0.115,
    loop: 16,
    voices: [
      { // 唸る低音
        type: "sawtooth", vol: 0.040,
        notes: [[0, 82, 2], [2, 82, 1], [3, 87, 1], [4, 82, 2], [6, 73, 2], [8, 82, 2], [10, 92, 1], [11, 87, 1], [12, 82, 2], [14, 65, 2]],
      },
      { // 警鐘の旋律
        type: "square", vol: 0.024,
        notes: [[0, 330, 1], [1, 311, 1], [2, 330, 2], [4, 392, 2], [6, 370, 2], [8, 330, 2], [10, 311, 2], [12, 294, 4]],
      },
    ],
  },
  // 王宮: 荘厳なファンファーレ。玉座の間に響く金管風
  palace: {
    stepDur: 0.28,
    loop: 32,
    voices: [
      { // 玉座の低音
        type: "triangle", vol: 0.045,
        notes: [[0, 98, 4], [4, 98, 4], [8, 131, 4], [12, 147, 4], [16, 98, 4], [20, 165, 4], [24, 131, 2], [26, 147, 2], [28, 98, 4]],
      },
      { // ファンファーレ
        type: "square", vol: 0.026,
        notes: [[0, 392, 2], [2, 494, 2], [4, 587, 3], [7, 494, 1], [8, 587, 2], [10, 659, 2], [12, 784, 4],
                [16, 587, 2], [18, 494, 2], [20, 659, 3], [23, 587, 1], [24, 523, 2], [26, 494, 2], [28, 392, 4]],
      },
      { // 伸びやかな和声
        type: "triangle", vol: 0.018,
        notes: [[0, 247, 8], [8, 294, 8], [16, 247, 8], [24, 196, 8]],
      },
    ],
  },
  // 人業の館: オルゴール風。魂を待つ空の器たちの静けさ
  mansion: {
    stepDur: 0.26,
    loop: 32,
    voices: [
      { // 沈む低音 (Am - F - C - E)
        type: "triangle", vol: 0.040,
        notes: [[0, 110, 6], [8, 87, 6], [16, 131, 6], [24, 165, 6]],
      },
      { // オルゴールの分散和音
        type: "sine", vol: 0.034,
        notes: [[0, 440, 1], [1, 523, 1], [2, 659, 1], [3, 880, 3], [6, 659, 2],
                [8, 349, 1], [9, 440, 1], [10, 523, 1], [11, 698, 3], [14, 523, 2],
                [16, 330, 1], [17, 392, 1], [18, 523, 1], [19, 659, 3], [22, 784, 2],
                [24, 330, 1], [25, 415, 1], [26, 494, 1], [27, 659, 3], [30, 494, 2]],
      },
    ],
  },
  // 酒場: 陽気な6/8のジグ。杯がぶつかる賑わい
  tavern: {
    stepDur: 0.17,
    loop: 24,
    voices: [
      { // 弾むベース
        type: "triangle", vol: 0.045,
        notes: [[0, 98, 2], [3, 147, 2], [6, 98, 2], [9, 147, 2], [12, 175, 2], [15, 131, 2], [18, 98, 2], [21, 147, 2]],
      },
      { // 踊る旋律
        type: "square", vol: 0.028,
        notes: [[0, 392, 1], [1, 494, 1], [2, 587, 1], [3, 494, 1], [4, 587, 1], [5, 659, 1], [6, 587, 2],
                [8, 494, 1], [9, 440, 1], [10, 494, 1], [11, 440, 1], [12, 349, 1], [13, 440, 1], [14, 523, 2],
                [16, 440, 1], [17, 392, 1], [18, 392, 2], [20, 294, 1], [21, 330, 1], [22, 370, 1], [23, 392, 1]],
      },
    ],
  },
  // 商店: 軽快な商人の曲。銭勘定のはずむ足取り
  shop: {
    stepDur: 0.21,
    loop: 16,
    voices: [
      { // 歩くベース
        type: "triangle", vol: 0.042,
        notes: [[0, 131, 2], [2, 165, 2], [4, 196, 2], [6, 165, 2], [8, 175, 2], [10, 196, 2], [12, 98, 2], [14, 123, 2]],
      },
      { // 明るい呼び込み
        type: "square", vol: 0.026,
        notes: [[0, 523, 1], [1, 659, 1], [2, 784, 2], [4, 659, 1], [5, 523, 1], [6, 587, 2],
                [8, 698, 1], [9, 659, 1], [10, 587, 1], [11, 523, 1], [12, 494, 2], [14, 587, 2]],
      },
    ],
  },
  // 宿屋: 子守唄。暖炉のそばで魂を休める
  inn: {
    stepDur: 0.34,
    loop: 16,
    voices: [
      { // まどろむ低音
        type: "triangle", vol: 0.036,
        notes: [[0, 98, 4], [4, 131, 4], [8, 110, 4], [12, 147, 4]],
      },
      { // やわらかな旋律
        type: "sine", vol: 0.032,
        notes: [[0, 392, 2], [2, 494, 2], [4, 523, 3], [7, 440, 1], [8, 440, 2], [10, 392, 2], [12, 370, 2], [14, 440, 2]],
      },
    ],
  },
  // 赤い魂の祠: 不穏な儀式。半音で揺れる暗い唸りと鐘
  shrine: {
    stepDur: 0.38,
    loop: 16,
    voices: [
      { // 地の底の唸り (A1 ⇄ B♭1)
        type: "sawtooth", vol: 0.028,
        notes: [[0, 55, 6], [6, 55, 2], [8, 58, 6], [14, 55, 2]],
      },
      { // 祭儀の鐘
        type: "sine", vol: 0.030,
        notes: [[0, 440, 3], [4, 466, 2], [8, 415, 3], [13, 622, 3]],
      },
    ],
  },
  // オープニング: 静かな語りの底に流れる、沈んだ序曲
  opening: {
    stepDur: 0.42,
    loop: 16,
    voices: [
      { // 深い低音 (D2 - C2 - D2)
        type: "triangle", vol: 0.038,
        notes: [[0, 73, 8], [8, 65, 4], [12, 73, 4]],
      },
      { // 沈んだ旋律
        type: "sine", vol: 0.030,
        notes: [[0, 294, 3], [3, 349, 2], [5, 330, 2], [8, 262, 3], [11, 294, 4]],
      },
      { // かすかな高鳴り
        type: "triangle", vol: 0.012,
        notes: [[0, 587, 6], [8, 523, 6]],
      },
    ],
  },
};

export function playBgm(name) {
  if (name && bgm.name === name && bgm.timer) return; // 同じ曲は鳴らし直さず流し続ける
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
