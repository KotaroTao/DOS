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
// 全曲ダークファンタジー基調 (短調・教会旋法・低音ドローン)。シーンごとに専用テーマを持つ。
const THEMES = {
  // オープニング (語り): 深淵の底から響くドローンと遠い弔鐘
  opening: {
    stepDur: 0.45,
    loop: 16,
    voices: [
      { // 地の底のドローン (D → 半音下の C# が不穏に沈む)
        type: "triangle", vol: 0.040,
        notes: [[0, 73.4, 8], [8, 69.3, 8]],
      },
      { // 薄い五度のもや
        type: "sine", vol: 0.018,
        notes: [[0, 110, 8], [8, 103.8, 8]],
      },
      { // 遠い弔鐘
        type: "sine", vol: 0.026,
        notes: [[0, 587.3, 3], [5, 440, 2], [8, 554.4, 3], [13, 415.3, 2]],
      },
    ],
  },
  // 街の広場 (オープニング後の拠点): 鐘の音が霧の街に沈む、物悲しいニ短調
  town: {
    stepDur: 0.30,
    loop: 32,
    voices: [
      { // 地を這うドローン (D-C-Bb-A の下降)
        type: "triangle", vol: 0.042,
        notes: [[0, 73.4, 8], [8, 65.4, 8], [16, 58.3, 8], [24, 55.0, 8]],
      },
      { // 五度の影 (空虚五度で寂寥を出す)
        type: "triangle", vol: 0.020,
        notes: [[0, 110, 8], [8, 98, 8], [16, 87.3, 8], [24, 82.4, 8]],
      },
      { // 弔鐘の旋律
        type: "sine", vol: 0.034,
        notes: [[0, 293.7, 3], [4, 349.2, 2], [6, 329.6, 2], [8, 293.7, 4], [13, 220, 3],
                [16, 233.1, 3], [20, 293.7, 2], [22, 349.2, 2], [24, 329.6, 4], [28, 277.2, 2], [30, 293.7, 2]],
      },
    ],
  },
  // 人業の館: 蝋燭と縫合台。軋むオルゴールのような不穏なホ調
  mansion: {
    stepDur: 0.34,
    loop: 24,
    voices: [
      { // 半音で揺れる低音 (E-F-E-Eb)
        type: "triangle", vol: 0.040,
        notes: [[0, 82.4, 6], [6, 87.3, 2], [8, 82.4, 6], [14, 77.8, 2], [16, 82.4, 4], [20, 73.4, 4]],
      },
      { // 薄い五度のもや
        type: "sine", vol: 0.014,
        notes: [[0, 123.5, 12], [12, 123.5, 12]],
      },
      { // 壊れたオルゴール
        type: "sine", vol: 0.028,
        notes: [[0, 659.3, 2], [3, 698.5, 1], [4, 659.3, 2], [8, 587.3, 2], [11, 523.3, 1],
                [12, 493.9, 4], [16, 466.2, 2], [19, 493.9, 1], [20, 659.3, 4]],
      },
    ],
  },
  // 酒場「沈まぬ灯」: 暗がりで回る、ほの暗いイ短調のワルツ
  tavern: {
    stepDur: 0.24,
    loop: 24,
    voices: [
      { // 1拍目の重い足 (Am-F-G-E)
        type: "triangle", vol: 0.044,
        notes: [[0, 110, 1], [3, 110, 1], [6, 87.3, 1], [9, 87.3, 1], [12, 98, 1], [15, 98, 1], [18, 82.4, 1], [21, 82.4, 1]],
      },
      { // 2,3拍目の刻み
        type: "square", vol: 0.014,
        notes: [[1, 164.8, 1], [2, 164.8, 1], [4, 164.8, 1], [5, 164.8, 1],
                [7, 174.6, 1], [8, 174.6, 1], [10, 174.6, 1], [11, 174.6, 1],
                [13, 196, 1], [14, 196, 1], [16, 196, 1], [17, 196, 1],
                [19, 164.8, 1], [20, 164.8, 1], [22, 164.8, 1], [23, 164.8, 1]],
      },
      { // 酔いどれの旋律
        type: "square", vol: 0.026,
        notes: [[0, 440, 2], [2, 523.3, 1], [3, 493.9, 2], [5, 440, 1], [6, 440, 3], [9, 392, 2], [11, 349.2, 1],
                [12, 392, 2], [14, 440, 1], [15, 493.9, 3], [18, 415.3, 4], [22, 493.9, 2]],
      },
    ],
  },
  // 商店: 値踏みする商人の目。ト調ドリアの油断ならない足取り
  shop: {
    stepDur: 0.22,
    loop: 16,
    voices: [
      { // 歩くベース
        type: "triangle", vol: 0.042,
        notes: [[0, 98, 2], [2, 98, 1], [3, 110, 1], [4, 116.5, 2], [6, 110, 2], [8, 98, 2], [10, 87.3, 2], [12, 98, 2], [14, 73.4, 2]],
      },
      { // 銭を数える旋律
        type: "square", vol: 0.024,
        notes: [[0, 392, 1], [1, 440, 1], [2, 466.2, 2], [4, 440, 1], [5, 392, 1], [6, 349.2, 2],
                [8, 392, 2], [10, 293.7, 2], [12, 329.6, 2], [14, 349.2, 2]],
      },
    ],
  },
  // 宿屋「臥牢」: 消えかけの灯の下の子守唄。静かなイ短調
  inn: {
    stepDur: 0.42,
    loop: 16,
    voices: [
      { // まどろむ低音 (A-E-F-G)
        type: "sine", vol: 0.035,
        notes: [[0, 110, 4], [4, 82.4, 4], [8, 87.3, 4], [12, 98, 4]],
      },
      { // 子守唄
        type: "sine", vol: 0.030,
        notes: [[0, 440, 2], [2, 523.3, 2], [4, 493.9, 3], [8, 440, 2], [10, 349.2, 2], [12, 329.6, 3]],
      },
    ],
  },
  // 王宮: 石廊に響く葬送オルガン。重厚なハ短調
  palace: {
    stepDur: 0.32,
    loop: 32,
    voices: [
      { // オルガン低音 (C-Eb-F-G)
        type: "sawtooth", vol: 0.026,
        notes: [[0, 65.4, 8], [8, 77.8, 8], [16, 87.3, 8], [24, 98, 8]],
      },
      { // オルガン五度
        type: "sawtooth", vol: 0.016,
        notes: [[0, 98, 8], [8, 116.5, 8], [16, 130.8, 8], [24, 146.8, 8]],
      },
      { // 厳粛な旋律
        type: "square", vol: 0.022,
        notes: [[0, 261.6, 3], [3, 311.1, 2], [5, 293.7, 3], [8, 311.1, 4], [12, 349.2, 3],
                [16, 392, 4], [20, 349.2, 2], [22, 311.1, 2], [24, 293.7, 4], [28, 246.9, 4]],
      },
    ],
  },
  // 赤い魂の祠: 異形の聖域。空虚五度の詠唱が漂うニ調
  shrine: {
    stepDur: 0.36,
    loop: 24,
    voices: [
      { // 深いドローン (D-C)
        type: "triangle", vol: 0.038,
        notes: [[0, 73.4, 12], [12, 65.4, 12]],
      },
      { // 低い詠唱
        type: "sine", vol: 0.026,
        notes: [[0, 146.8, 6], [6, 164.8, 6], [12, 130.8, 6], [18, 146.8, 6]],
      },
      { // 魂のゆらめき
        type: "sine", vol: 0.020,
        notes: [[2, 587.3, 2], [8, 659.3, 2], [14, 523.3, 2], [20, 587.3, 3], [23, 440, 1]],
      },
    ],
  },
  // 迷宮 (探索): 闇を忍び歩く緊張。半音が軋むホ短調
  field: {
    stepDur: 0.26,
    loop: 32,
    voices: [
      { // 忍び寄る低音
        type: "triangle", vol: 0.045,
        notes: [[0, 82.4, 2], [2, 82.4, 1], [4, 87.3, 2], [6, 82.4, 2], [8, 73.4, 2], [10, 82.4, 2], [12, 61.7, 2], [14, 82.4, 2],
                [16, 82.4, 2], [18, 87.3, 2], [20, 98, 2], [22, 87.3, 2], [24, 82.4, 2], [26, 77.8, 2], [28, 73.4, 2], [30, 61.7, 2]],
      },
      { // 暗がりの旋律 (まばらに、不安を残す)
        type: "square", vol: 0.022,
        notes: [[0, 329.6, 2], [4, 349.2, 2], [8, 329.6, 3], [14, 246.9, 2], [16, 293.7, 2],
                [20, 311.1, 2], [24, 329.6, 4], [30, 233.1, 2]],
      },
    ],
  },
  // 戦闘: 駆け立てる鼓動。半音下降が追い詰めるイ短調
  battle: {
    stepDur: 0.13,
    loop: 32,
    voices: [
      { // 疾走する低音
        type: "square", vol: 0.044,
        notes: [[0, 110, 1], [1, 110, 1], [2, 220, 1], [3, 110, 1], [4, 110, 1], [5, 207.7, 1], [6, 110, 1], [7, 196, 1],
                [8, 110, 1], [9, 110, 1], [10, 220, 1], [11, 110, 1], [12, 110, 1], [13, 174.6, 1], [14, 164.8, 1], [15, 155.6, 1],
                [16, 110, 1], [17, 110, 1], [18, 220, 1], [19, 110, 1], [20, 110, 1], [21, 207.7, 1], [22, 110, 1], [23, 196, 1],
                [24, 98, 1], [25, 98, 1], [26, 196, 1], [27, 98, 1], [28, 103.8, 1], [29, 103.8, 1], [30, 123.5, 1], [31, 123.5, 1]],
      },
      { // 斬り結ぶ旋律
        type: "sawtooth", vol: 0.020,
        notes: [[0, 440, 2], [2, 523.3, 2], [4, 440, 2], [6, 415.3, 2], [8, 440, 2], [10, 587.3, 2], [12, 523.3, 2], [14, 493.9, 2],
                [16, 440, 2], [18, 523.3, 2], [20, 659.3, 2], [22, 622.3, 2], [24, 587.3, 4], [28, 493.9, 2], [30, 415.3, 2]],
      },
    ],
  },
  // ボス: 玉座の前の絶望。地鳴りと警鐘のニ調フリギア
  boss: {
    stepDur: 0.15,
    loop: 32,
    voices: [
      { // 地鳴りのリフ (D-Eb の半音が威圧する)
        type: "sawtooth", vol: 0.038,
        notes: [[0, 73.4, 2], [2, 73.4, 1], [3, 77.8, 1], [4, 73.4, 2], [6, 69.3, 2], [8, 73.4, 2], [10, 77.8, 1], [11, 82.4, 1],
                [12, 73.4, 2], [14, 55.0, 2], [16, 73.4, 2], [18, 73.4, 1], [19, 77.8, 1], [20, 73.4, 2], [22, 98, 2],
                [24, 103.8, 2], [26, 98, 2], [28, 82.4, 2], [30, 77.8, 2]],
      },
      { // 重圧のうねり
        type: "sine", vol: 0.018,
        notes: [[0, 110, 8], [8, 110, 8], [16, 103.8, 8], [24, 98, 8]],
      },
      { // 警鐘の旋律
        type: "square", vol: 0.022,
        notes: [[0, 293.7, 2], [2, 311.1, 2], [4, 293.7, 2], [6, 277.2, 2], [8, 293.7, 2], [10, 370, 2], [12, 349.2, 2], [14, 311.1, 2],
                [16, 415.3, 4], [20, 392, 2], [22, 370, 2], [24, 311.1, 4], [28, 293.7, 2], [30, 277.2, 2]],
      },
    ],
  },
};

export function playBgm(name) {
  if (!actx) { pendingBgm = name; return; } // 初回ユーザー操作後に開始
  if (bgm.timer && bgm.name === name) return; // 同じ曲は流し続ける (施設間の移動などで頭出ししない)
  stopBgm();
  if (!name) return;
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
