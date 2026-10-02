// 音楽エンジン — ミキサー・残響・先読みスケジューラ・クロスフェード
// AudioContext でも OfflineAudioContext でも同じグラフを組める (試聴用の書き出しに使う)。
//
//  [曲] チャンネル(楽器ごと: 音量→フィルタ→定位) ─┬→ dry ─→ 接着コンプ → BGM音量 → ダッキング ─┐
//                                                ├→ wet ─→ (BGM音量) → 大聖堂リバーブ ────────┤→ マスター → リミッタ → 出力
//                                                └→ dly ─→ ステレオディレイ ─→ dry/wet         │
//  [効果音] → 効果音量 ────────────────────────────────────────(+ wet)──────────────────────┘
import { INST, zoneOf, zoneKey } from "./instruments.js";
import { makeIR, rng } from "./dsp.js";

const IR_CACHE = new Map();
function irBuffer(ctx) {
  const sr = ctx.sampleRate;
  let ch = IR_CACHE.get(sr);
  if (!ch) {
    ch = makeIR(sr, { len: 3.4, rt60: 3.4, pre: 0.024 });
    // 末尾をなめらかに切る
    const n = ch[0].length, f = Math.round(sr * 0.4);
    for (const c of ch) for (let i = 0; i < f; i++) c[n - 1 - i] *= i / f;
    IR_CACHE.set(sr, ch);
  }
  const b = ctx.createBuffer(2, ch[0].length, sr);
  b.getChannelData(0).set(ch[0]);
  b.getChannelData(1).set(ch[1]);
  return b;
}

// 曲が使うサンプルの一覧 (楽器:ゾーン:揺らぎ)
export function songKeys(song, untilSec = Infinity) {
  const keys = new Set();
  const untilBeat = untilSec / song.spb;
  for (const e of song.ev) {
    if (e.b > untilBeat) break; // ev は時刻順
    const ch = song.chans[e.c];
    const def = INST[ch.inst];
    if (!def) continue;
    const z = zoneOf(def, e.m);
    const nv = def.variants || 1;
    for (let v = 0; v < nv; v++) keys.add(zoneKey(ch.inst, z, v));
  }
  return [...keys];
}

function param(p, v, t) { try { p.setValueAtTime(v, t); } catch { p.value = v; } }
// 予定済みの変化をその時点の値で止める (cancelAndHoldAtTime 非対応なら現在値で代用)
function holdAt(p, t) {
  if (p.cancelAndHoldAtTime) { p.cancelAndHoldAtTime(t); return; }
  const v = p.value;
  p.cancelScheduledValues(t);
  p.setValueAtTime(v, t);
}

export class Engine {
  constructor(ctx, bank, opt = {}) {
    this.ctx = ctx;
    this.bank = bank;
    this.realtime = opt.realtime !== false;
    this.maxVoices = opt.maxVoices || 64;
    this.lite = !!opt.lite; // 非力な端末: 声部ごとのフィルタを省く
    this.allVoices = [];
    const c = ctx;
    // マスター段: 全体の安全装置 (ブリックウォール寄りのリミッタ)
    this.master = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    param(this.limiter.threshold, -4, 0); param(this.limiter.knee, 0, 0); param(this.limiter.ratio, 20, 0);
    param(this.limiter.attack, 0.002, 0); param(this.limiter.release, 0.18, 0);
    this.out = c.createGain();
    this.out.gain.value = 0.84; // -1.5dB の天井 (ピークを -1dBFS 未満に保つ)
    this.master.connect(this.limiter); this.limiter.connect(this.out); this.out.connect(c.destination);

    // BGM 段: 曲の dry が集まる → 接着用の穏やかなコンプ → 音量 → ダッキング
    this.musicIn = c.createGain();
    // 聞こえない超低域を削って余裕を作る (スマホのスピーカーでも濁らない)
    this.musicHp = c.createBiquadFilter();
    this.musicHp.type = "highpass"; this.musicHp.frequency.value = 34; this.musicHp.Q.value = 0.6;
    this.glue = c.createDynamicsCompressor();
    param(this.glue.threshold, -22, 0); param(this.glue.knee, 14, 0); param(this.glue.ratio, 2.2, 0);
    param(this.glue.attack, 0.04, 0); param(this.glue.release, 0.4, 0);
    this.musicVol = c.createGain();
    this.duck = c.createGain();
    this.musicIn.connect(this.musicHp); this.musicHp.connect(this.glue); this.glue.connect(this.musicVol); this.musicVol.connect(this.duck); this.duck.connect(this.master);

    // 残響 (1基を BGM と効果音で共有)
    this.verb = c.createConvolver();
    this.verb.buffer = irBuffer(c);
    this.verbOut = c.createGain();
    this.verbOut.gain.value = 0.9;
    this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    this.musicWet = c.createGain();     // 曲の wet が集まる
    this.musicWetVol = c.createGain();  // = BGM音量
    this.musicWetDuck = c.createGain(); // = ダッキング
    this.musicWet.connect(this.musicWetVol); this.musicWetVol.connect(this.musicWetDuck); this.musicWetDuck.connect(this.verb);

    // ステレオディレイ (曲ごとにテンポ同期で設定)
    this.musicDly = c.createGain();
    this.dlyL = c.createDelay(3); this.dlyR = c.createDelay(3);
    this.dlyFbL = c.createGain(); this.dlyFbR = c.createGain();
    this.dlyLp = c.createBiquadFilter(); this.dlyLp.type = "lowpass"; this.dlyLp.frequency.value = 2600;
    this.dlyHp = c.createBiquadFilter(); this.dlyHp.type = "highpass"; this.dlyHp.frequency.value = 250;
    this.musicDly.connect(this.dlyHp); this.dlyHp.connect(this.dlyLp);
    this.dlyLp.connect(this.dlyL); this.dlyLp.connect(this.dlyR);
    this.dlyL.connect(this.dlyFbR); this.dlyFbR.connect(this.dlyR); // ピンポン: 左→右→左…
    this.dlyR.connect(this.dlyFbL); this.dlyFbL.connect(this.dlyL);
    const merger = c.createChannelMerger(2);
    this.dlyL.connect(merger, 0, 0); this.dlyR.connect(merger, 0, 1);
    this.dlyOut = c.createGain(); this.dlyOut.gain.value = 0.8;
    merger.connect(this.dlyOut); this.dlyOut.connect(this.musicIn); this.dlyOut.connect(this.musicWet);
    this.setDelay({ l: 0.375, r: 0.5, fb: 0.3 }, 0);

    // 効果音段
    this.sfxIn = c.createGain();
    this.sfxIn.connect(this.master);
    this.sfxWet = c.createGain();
    this.sfxWet.connect(this.verb);

    this.players = [];
    this.bgmVol = 1; this.sfxVol = 1;
  }

  now() { return this.ctx.currentTime; }

  setVolumes(b, s) {
    const t = this.now();
    this.bgmVol = b; this.sfxVol = s;
    for (const g of [this.musicVol.gain, this.musicWetVol.gain]) { g.cancelScheduledValues(t); g.setTargetAtTime(b, t, 0.05); }
    for (const g of [this.sfxIn.gain, this.sfxWet.gain]) { g.cancelScheduledValues(t); g.setTargetAtTime(s, t, 0.03); }
  }
  setMasterGain(v, tc = 0.05) {
    const t = this.now(), g = this.master.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(v, t, tc);
  }
  // ジングル中は BGM を下げる
  duckFor(dur, depth = 0.25, at = this.now()) {
    for (const g of [this.duck.gain, this.musicWetDuck.gain]) {
      g.cancelScheduledValues(at);
      g.setTargetAtTime(depth, at, 0.06);
      g.setTargetAtTime(1, at + dur, 0.5);
    }
  }
  setDelay(d, t = this.now()) {
    if (!d) return;
    param(this.dlyL.delayTime, Math.min(2.9, d.l), t);
    param(this.dlyR.delayTime, Math.min(2.9, d.r), t);
    param(this.dlyFbL.gain, d.fb ?? 0.3, t);
    param(this.dlyFbR.gain, d.fb ?? 0.3, t);
    if (d.lp) param(this.dlyLp.frequency, d.lp, t);
  }

  // 曲を始める (bus: "music" | "sfx")
  start(song, opt = {}) {
    const t0 = opt.at ?? this.now() + 0.08;
    const p = new Player(this, song, t0, opt);
    this.players.push(p);
    if (song.delay && (opt.bus || "music") === "music") {
      const spb = song.spb;
      this.setDelay({ l: song.delay.l * spb, r: song.delay.r * spb, fb: song.delay.fb, lp: song.delay.lp }, t0);
    }
    return p;
  }
  // 先読みスケジューリング (リアルタイムは定期的に、オフラインは一度に全部)
  tick(lookahead = 0.32, music = true) {
    const until = this.now() + lookahead;
    for (const p of this.players) {
      if (p.stopped || p.dead) continue;
      if (!music && p.bus === "music") continue; // BGM 音量0の間は音符を作らない
      p.schedule(until);
    }
    this.players = this.players.filter((p) => !p.dead);
  }
  scheduleAll(until) {
    for (const p of this.players) if (!p.stopped) p.schedule(until);
  }
  // 単発のバッファ再生 (効果音)
  playBuffer(buf, o = {}) {
    if (!buf) return null;
    const c = this.ctx, t = o.at ?? this.now() + 0.005;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = c.createGain();
    g.gain.value = o.vol ?? 1;
    src.connect(g);
    let node = g;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); node = p; }
    node.connect(this.sfxIn);
    if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; node.connect(s); s.connect(this.sfxWet); }
    src.start(t);
    return src;
  }
}

// ---- 曲の再生器 ----
const VIB_RATE = 5.1;
class Player {
  constructor(eng, song, t0, opt) {
    this.eng = eng; this.song = song; this.t0 = t0;
    this.bus = opt.bus || "music";
    const c = eng.ctx;
    this.dry = c.createGain(); this.wet = c.createGain(); this.dly = c.createGain();
    const sfx = this.bus === "sfx";
    this.dry.connect(sfx ? eng.sfxIn : eng.musicIn);
    this.wet.connect(sfx ? eng.sfxWet : eng.musicWet);
    if (!sfx) this.dly.connect(eng.musicDly);
    const gain = (song.gain ?? 1) * (opt.gain ?? 1);
    const fi = opt.fadeIn ?? song.fadeIn ?? 0;
    for (const g of [this.dry.gain, this.wet.gain, this.dly.gain]) {
      if (fi > 0.02) { g.setValueAtTime(0.0001, t0); g.linearRampToValueAtTime(gain, t0 + fi); }
      else g.setValueAtTime(gain, t0);
    }
    // 共有LFO: 弦・合唱のヴィブラート / オルゴールのゆがみ (wow)
    this.lfos = [];
    this.vib = null; this.wow = null;
    this.chans = song.chans.map((ch) => this.makeChannel(ch));
    this.voices = [];
    this.rnd = rng(0xabc + song.ev.length * 7 + (song.name || "").length);
    this.pass = 0;
    this.origin = t0;
    this.idx = 0;
    this.stopped = false; this.done = false; this.dead = false;
    const sb = opt.startBeat || 0;
    if (sb > 0) {
      this.origin = t0 - sb * song.spb;
      this.idx = song.ev.findIndex((e) => e.b >= sb);
      if (this.idx < 0) this.idx = song.ev.length;
    }
  }
  lfo(rate, type = "sine") {
    const c = this.eng.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.value = rate;
    o.start(this.t0);
    this.lfos.push(o);
    return o;
  }
  makeChannel(ch) {
    const c = this.eng.ctx;
    const def = INST[ch.inst];
    const input = c.createGain();
    input.gain.value = (ch.vol ?? 0.5) * (def ? def.gain : 1);
    let node = input;
    const nodes = [input];
    const addFilter = (type, f, q, lfo) => {
      const b = c.createBiquadFilter();
      b.type = type; b.frequency.value = f; b.Q.value = q ?? 0.7;
      node.connect(b); node = b; nodes.push(b);
      if (lfo) {
        const o = this.lfo(lfo.rate || 0.1);
        const g = c.createGain(); g.gain.value = lfo.depth || f * 0.4;
        o.connect(g); g.connect(b.frequency); nodes.push(g);
      }
    };
    if (ch.hp) addFilter("highpass", ch.hp, ch.hpq);
    if (ch.lp) addFilter("lowpass", ch.lp, ch.q, ch.lfo);
    if (ch.bp) addFilter("bandpass", ch.bp, ch.bpq ?? 1.2, ch.lfo);
    let out = node;
    if (ch.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = ch.pan; node.connect(p); out = p; nodes.push(p);
    }
    out.connect(this.dry);
    if (ch.rev) { const s = c.createGain(); s.gain.value = ch.rev; out.connect(s); s.connect(this.wet); nodes.push(s); }
    if (ch.dly) { const s = c.createGain(); s.gain.value = ch.dly; out.connect(s); s.connect(this.dly); nodes.push(s); }
    // 音程の揺れ (セント): 共有ヴィブラート / オルゴールの回転むら (wow)
    const mods = [];
    const vd = ch.vib ?? (def && def.vib) ?? 0;
    if (vd > 0) {
      if (!this.vib) this.vib = this.lfo(VIB_RATE);
      const g = c.createGain(); g.gain.value = vd; this.vib.connect(g); nodes.push(g); mods.push(g);
    }
    if (ch.wow) {
      if (!this.wow) this.wow = this.lfo(0.37, "triangle");
      const g = c.createGain(); g.gain.value = ch.wow; this.wow.connect(g); nodes.push(g); mods.push(g);
    }
    return { ch, def, input, nodes, mods, voices: [] };
  }

  schedule(until) {
    const s = this.song, spb = s.spb, ev = s.ev;
    const now = this.eng.now();
    let guard = 0;
    while (guard++ < 5000) {
      if (this.idx >= ev.length || ev[this.idx].b >= s.loopEnd) {
        if (!s.loop || s.loopIdx >= ev.length || s.loopEnd <= s.loopStart) {
          // ループしない曲 (ジングル): 最後の音が鳴り終わったら破棄
          this.done = true;
          if (!this._endAt) this._endAt = this.origin + s.loopEnd * spb + 8;
          if (now > this._endAt) this.kill();
          return;
        }
        this.origin += (s.loopEnd - s.loopStart) * spb;
        this.pass++;
        this.idx = s.loopIdx;
        continue;
      }
      const e = ev[this.idx];
      const t = this.origin + e.b * spb;
      if (t > until) break;
      this.idx++;
      if (t < now - 0.03) continue; // 遅れた音は捨てる (タブ復帰直後など)
      this.play(e, t);
    }
  }

  play(e, t) {
    const eng = this.eng, c = eng.ctx;
    const C = this.chans[e.c];
    const { ch, def } = C;
    if (!def) return;
    const r = this.rnd;
    // 人間らしい揺らぎ (タイミング・強さ)
    const ht = ch.human ?? 0.006, hv = ch.humanV ?? 0.07;
    t = Math.max(eng.now(), t + (r() - 0.5) * 2 * ht);
    let v = e.v * (1 + (r() - 0.5) * 2 * hv);
    const o = e.o || {};
    const z = zoneOf(def, e.m);
    const nv = def.variants || 1;
    const variant = nv > 1 ? Math.floor(r() * nv) : 0;
    const buf = eng.bank.get(zoneKey(ch.inst, z, variant));
    if (!buf) return;
    // 同時発音数の上限: 古い声部から静かに消す
    const poly = ch.poly ?? (def.kind === "sus" ? 10 : 14);
    const vs = C.voices;
    for (let i = vs.length - 1; i >= 0; i--) if (vs[i].t1 < eng.now() - 0.05) vs.splice(i, 1);
    let live = vs.filter((x) => x.t1 > t);
    while (live.length >= poly) { this.steal(live[0], t); live.shift(); }
    // 全体の同時発音数が多すぎる時は、弱い音から間引く
    const gv = eng.allVoices;
    if (gv.length > 32) { const nw = eng.now(); eng.allVoices = gv.filter((x) => x.t1 > nw); }
    if (v < 0.35) { let k = 0; for (const x of eng.allVoices) if (x.t0 <= t && x.t1 > t) k++; if (k >= eng.maxVoices) return; }

    const src = c.createBufferSource();
    src.buffer = buf;
    const rate = Math.pow(2, (e.m - z) / 12) * (o.rate || 1);
    src.playbackRate.value = rate;
    const g = c.createGain();
    const amp = Math.pow(Math.max(0, Math.min(1.2, v)), 1.5);
    let node = src;
    let t1;
    const dur = e.d * this.song.spb;
    if (def.kind === "sus") {
      src.loop = true;
      const att = o.att ?? ch.att ?? def.att ?? 0.1;
      const rel = o.rel ?? ch.rel ?? def.rel ?? 0.5;
      g.gain.setValueAtTime(0, t);
      if (att <= 0.12) g.gain.linearRampToValueAtTime(amp, t + att);
      else g.gain.setTargetAtTime(amp, t, att / 3);
      const off = t + Math.max(dur, 0.04);
      g.gain.setTargetAtTime(0, off, rel / 4);
      t1 = off + rel * 2;
      // 声部ごとのローパス: 強弱による音色差と、立ち上がりで明るくなる息・弓の圧
      if (def.filt && !ch.noFilt && !eng.lite) {
        const f = def.filt, bq = c.createBiquadFilter();
        bq.type = "lowpass"; bq.Q.value = 0.8;
        const top = f.lo + (f.hi - f.lo) * Math.pow(Math.min(1, v), f.curve ?? 1.3);
        bq.frequency.setValueAtTime(f.lo, t);
        bq.frequency.linearRampToValueAtTime(top * 1.1, t + f.att);
        bq.frequency.setTargetAtTime(top * f.sus, t + f.att, 0.3);
        bq.frequency.setTargetAtTime(f.lo, off, rel / 3);
        src.connect(bq); node = bq;
        // 息の入りの音程のすくい上げ (金管)
        if (f.scoop && src.detune) { src.detune.setValueAtTime(f.scoop * Math.min(1, v), t); src.detune.linearRampToValueAtTime(0, t + 0.08); }
      }
      if (o.bend && src.detune) { src.detune.setValueAtTime(o.bend, t); src.detune.linearRampToValueAtTime(0, t + (o.bendT || 0.3)); }
      if (o.slide && src.detune) { src.detune.setValueAtTime(0, t + dur * 0.4); src.detune.linearRampToValueAtTime(o.slide, t + dur); }
      // 独奏楽器は声部ごとの遅れてかかるヴィブラート
      if (def.ownVib && src.detune) {
        const lo = c.createOscillator(); lo.frequency.value = 5.2 + r() * 0.8;
        const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(def.ownVib, t + 0.45);
        lo.connect(lg); lg.connect(src.detune); lo.start(t); lo.stop(t1 + 0.05);
      }
      const offs = r() * buf.duration;
      src.start(t, offs);
    } else {
      g.gain.setValueAtTime(amp, t);
      const len = buf.duration / rate;
      t1 = t + len;
      if (o.cut || ch.cut) { // 消音 (短く切る奏法)
        const off = t + Math.max(dur, 0.03);
        const rel = o.rel ?? ch.rel ?? def.rel ?? 0.1;
        if (off < t1) { g.gain.setTargetAtTime(0, off, rel / 4); t1 = Math.min(t1, off + rel * 2); }
      }
      src.start(t);
    }
    node.connect(g); g.connect(C.input);
    // 共有ヴィブラート / wow
    if (src.detune) for (const m of C.mods) m.connect(src.detune);
    try { src.stop(t1 + 0.05); } catch {}
    const voice = { src, g, t0: t, t1 };
    vs.push(voice);
    this.voices.push(voice);
    eng.allVoices.push(voice);
    const mods = src.detune && C.mods.length ? C.mods : null;
    src.onended = () => {
      try { g.disconnect(); } catch {}
      if (mods) for (const m of mods) { try { m.disconnect(src.detune); } catch {} }
    };
    if (this.voices.length > 400) this.voices = this.voices.filter((x) => x.t1 > eng.now());
  }
  steal(voice, t) {
    try {
      holdAt(voice.g.gain, t);
      voice.g.gain.setTargetAtTime(0, t, 0.025);
      voice.src.stop(t + 0.12);
      voice.t1 = t + 0.12;
    } catch {}
  }
  // フェードアウトして停止
  stop(fade = 0.8, at = this.eng.now()) {
    if (this.stopped) return;
    this.stopped = true;
    for (const g of [this.dry.gain, this.wet.gain, this.dly.gain]) {
      try {
        holdAt(g, at);
        g.setTargetAtTime(0, at, Math.max(0.02, fade / 4));
      } catch {}
    }
    // まだ始まっていない音は鳴らさない
    for (const v of this.voices) if (v.t0 > at + fade) { try { v.src.stop(at + fade); } catch {} }
    this._endAt = at + fade + 0.3;
    if (this.eng.realtime) setTimeout(() => this.kill(), (fade + 0.4) * 1000);
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    for (const v of this.voices) { try { v.src.stop(); } catch {} }
    for (const o of this.lfos) { try { o.stop(); } catch {} }
    for (const C of this.chans) for (const n of C.nodes) { try { n.disconnect(); } catch {} }
    for (const g of [this.dry, this.wet, this.dly]) { try { g.disconnect(); } catch {} }
    this.voices = [];
  }
}
