// 音楽と効果音 — Web Audio だけで鳴らす (外部の音素材は一切使わない)
//
// 楽器はすべてコードで合成したサンプル (合唱・弦・金管・パイプオルガン・竪琴・鐘・太鼓…) を
// music/ 以下で生成し、大聖堂の残響・接着コンプ・リミッタを通して鳴らす。
//  - music/dsp.js          合成の基礎 (FFT・PADsynth・撥弦・モード合成・残響IR)
//  - music/instruments.js  楽器の定義 (音域ゾーンごとのサンプル生成)
//  - music/bank.js         サンプル倉庫 (ワーカーで生成・メモリ上限で破棄)
//  - music/worker.js       生成ワーカー
//  - music/engine.js       ミキサー・先読みスケジューラ・クロスフェード
//  - music/score.js        楽譜記述 DSL
//  - music/songs.js        楽曲 (タイトル・街・施設・第1層・戦闘・ボス・ジングル)
//  - music/legacy.js       旧譜面 (第2層以降) を新しい楽器で鳴らす変換
//  - music/sfx.js          効果音
import { Engine, songKeys } from "./music/engine.js";
import { Bank } from "./music/bank.js";
import { newSong, NEW_SONGS } from "./music/songs.js";
import { legacySong } from "./music/legacy.js";
import { sfxBuffer, sfxDef } from "./music/sfx.js";

let actx = null;
let engine = null;
const bank = new Bank();
let muted = false;
let pendingBgm = null;
let bgmVol = 1, sfxVol = 1;
let want = undefined;      // 要求中の曲名 (同じ曲は頭出ししない)
let current = null;        // 再生中の Player
let token = 0;
let timer = null;
let hooked = false;

const JINGLES = ["j_victory", "j_levelup", "j_item", "j_gameover"];
// 曲のつながり (次に流れそうな曲を先に用意しておく)
const NEXT = {
  title: ["opening", "town"], opening: ["town"],
  town: ["layer1", "battle", "mansion", "tavern", "shop", "inn", "palace", "shrine"],
  layer1: ["battle", "boss", "town"], battle: ["layer1", "boss"], boss: ["town"],
};

function getSong(name) {
  try { return newSong(name) || legacySong(name); } catch (e) { console.warn("[audio] 曲の構築に失敗", name, e); return null; }
}

export function initAudio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { actx = new AC({ latencyHint: "balanced" }); } catch { actx = new AC(); }
    bank.setContext(actx);
    // 非力な端末では同時発音数と声部フィルタを控えめに
    let lite = false;
    try { lite = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4); } catch {}
    engine = new Engine(actx, bank, { realtime: true, maxVoices: lite ? 40 : 64, lite });
    engine.setVolumes(bgmVol, sfxVol);
    if (muted) engine.setMasterGain(0, 0.01);
    hookLifecycle();
    startTimer();
    // ジングルの楽器を早めに用意
    for (const j of JINGLES) { const s = newSong(j); if (s) bank.ensure(songKeys(s), "high"); }
  }
  if (actx.state !== "running" && !muted && !document.hidden) { try { actx.resume().catch(() => {}); } catch {} }
  if (pendingBgm) {
    const n = pendingBgm;
    pendingBgm = null;
    playBgm(n);
  }
}

// 音量 (0-1)。BGM と効果音を別々に絞れる (設定画面)。0 ならその系統は鳴らさない
export function setVolumes(b, s) {
  bgmVol = Math.max(0, Math.min(1, +b || 0));
  sfxVol = Math.max(0, Math.min(1, +s || 0));
  if (engine) engine.setVolumes(bgmVol, sfxVol);
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  if (engine) {
    engine.setMasterGain(muted ? 0 : 1, muted ? 0.03 : 0.08);
    if (muted) setTimeout(() => { if (muted && actx && actx.state === "running") actx.suspend().catch(() => {}); }, 250);
    else if (!document.hidden && actx.state !== "running") actx.resume().catch(() => {});
  }
  return muted;
}

// ---- スケジューラ (先読み) ----
function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (!engine || actx.state !== "running") return;
    engine.tick(0.36, bgmVol > 0);
  }, 70);
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

// タブが隠れたら止め、戻ったら再開する (電池とCPUの節約)
function hookLifecycle() {
  if (hooked) return;
  hooked = true;
  document.addEventListener("visibilitychange", () => {
    if (!actx) return;
    if (document.hidden) {
      stopTimer();
      bank.setPaused(true);
      actx.suspend().catch(() => {});
    } else {
      bank.setPaused(false);
      if (!muted) actx.resume().catch(() => {});
      startTimer();
    }
  });
  // iOS は着信などで "interrupted" になる。次の操作で起こす
  const wake = () => { if (actx && !muted && !document.hidden && actx.state !== "running") actx.resume().catch(() => {}); };
  for (const ev of ["pointerdown", "touchend", "keydown"]) document.addEventListener(ev, wake, { passive: true });
}

// ---- BGM ----
export function playBgm(name) {
  if (!actx) {
    pendingBgm = name;
    // 音声の起動前でも楽器の生成は始めておく (タイトルを眺めている間に用意できる)
    if (name) { const s = getSong(name); if (s) bank.ensure(songKeys(s), "high"); }
    return;
  }
  if (name === want) return; // 同じ曲は流し続ける (施設間の移動などで頭出ししない)
  want = name;
  const my = ++token;
  // 生成待ちの間に元の曲へ戻った場合も、鳴っている曲はそのまま
  if (name && current && current._name === name && !current.stopped) return;
  if (!name) { fadeOutCurrent(0.8); return; }
  const song = getSong(name);
  if (!song) { fadeOutCurrent(0.8); return; }
  const keys = songKeys(song);
  const go = () => {
    if (my !== token || !engine) return;
    const prev = current;
    const fadeIn = song.fadeIn < 0.3 ? (prev ? 0.12 : 0.03) : prev ? Math.max(1.2, song.fadeIn) : song.fadeIn;
    if (prev) prev.stop(0.8);
    current = engine.start(song, { fadeIn, at: actx.currentTime + 0.06 });
    current._name = name;
    const keep = keys.slice();
    for (const j of JINGLES) { const s = newSong(j); if (s) keep.push(...songKeys(s)); }
    bank.trim(keep);
    prefetchNext(name);
  };
  if (keys.every((k) => bank.has(k))) go();
  else {
    // 冒頭 (約12秒) に使う音が揃い次第鳴らし始め、残りは演奏しながら用意する (生成は使う順)
    const head = songKeys(song, 12);
    bank.ensure(keys, "now");
    bank.ensure(head, "now").then(go);
  }
}

function fadeOutCurrent(fade) {
  if (current) { current.stop(fade); current = null; }
}

function prefetchNext(name) {
  const list = NEXT[name] || (/^(layer|field)/.test(name) ? ["battle", "boss", "town"] : ["town"]);
  setTimeout(() => {
    for (const n of list) { const s = getSong(n); if (s) bank.prefetch(songKeys(s)); }
  }, 1500);
}

export function stopBgm() {
  token++;
  want = null;
  pendingBgm = null;
  fadeOutCurrent(0.8);
}

// ---- 効果音 ----
function sfx(name, o = {}) {
  if (!engine || muted || sfxVol <= 0) return;
  const def = sfxDef(name);
  if (!def) return;
  const buf = sfxBuffer(name, actx);
  engine.playBuffer(buf, {
    vol: def.vol * (o.vol ?? 1), rev: def.rev, pan: o.pan,
    rate: 1 + (Math.random() - 0.5) * (o.jit ?? 0.06),
    at: actx.currentTime + 0.005 + (o.delay || 0),
  });
}
// ジングル: 楽器が揃っていれば楽曲として鳴らし、BGM を一時的に下げる。未生成なら簡易版
function jingle(name, fallback, duck, depth = 0.3) {
  if (!engine || muted || sfxVol <= 0) return;
  const s = newSong(name);
  const keys = s ? songKeys(s) : [];
  if (s && keys.every((k) => bank.has(k))) {
    engine.start(s, { bus: "sfx", fadeIn: 0, at: actx.currentTime + 0.02 });
    if (bgmVol > 0 && duck) engine.duckFor(duck, depth);
  } else {
    sfx(fallback, { jit: 0 });
    if (s) bank.ensure(keys, "high");
  }
}

export const SFX = {
  select() { sfx("select"); },
  flip() { sfx("flip"); },
  step() { sfx("step", { jit: 0.1 }); },
  swing() { sfx("swing", { jit: 0.1 }); },
  hit() { sfx("hit", { jit: 0.08 }); },
  crit() { sfx("crit"); },
  miss() { sfx("miss", { jit: 0.1 }); },
  evade() { sfx("evade", { jit: 0.1 }); },
  spell() { sfx("spell"); },
  fire() { sfx("fire"); },
  heal() { sfx("heal", { jit: 0.02 }); },
  chest() { sfx("chest", { jit: 0.03 }); },
  trap() { sfx("trap", { jit: 0.04 }); },
  stairs() { sfx("stairs", { jit: 0.03 }); },
  die() { sfx("die", { jit: 0.04 }); },
  ng() { sfx("ng", { jit: 0.02 }); },
  flee() { sfx("flee", { jit: 0.05 }); },
  levelup() { jingle("j_levelup", "_levelup", 2.2, 0.4); },
  itemget() { jingle("j_item", "_itemget", 1.4, 0.55); },
  victory() { jingle("j_victory", "_victory", 3.6, 0.25); },
  gameover() { jingle("j_gameover", "_gameover", 6, 0.2); },
};

// ---- 試聴用の書き出し (OfflineAudioContext) ----
// renderOffline({ track: "title", seconds: 40 }) → { sampleRate, ch: [L, R] }
// events: [{ at: 秒, sfx: "hit" } | { at, jingle: "j_victory" }] で効果音・ジングルの試聴列も作れる
export async function renderOffline(o = {}) {
  const sr = o.sampleRate || 32000, sec = o.seconds || 40;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OAC(2, Math.round(sec * sr), sr);
  const eng = new Engine(oc, bank, { realtime: false, maxVoices: o.maxVoices || 64 });
  eng.setVolumes(o.bgm ?? 1, o.sfx ?? 1);
  const keys = [];
  let song = null;
  if (o.track) {
    song = getSong(o.track);
    if (!song) throw new Error("unknown track " + o.track);
    // solo: 指定チャンネルだけを鳴らす (楽器ごとの音量確認用)
    if (o.solo) { const ids = new Set(o.solo); song = { ...song, ev: song.ev.filter((e) => ids.has(song.chans[e.c].id)) }; song.loopIdx = song.ev.findIndex((e) => e.b >= song.loopStart); if (song.loopIdx < 0) song.loopIdx = song.ev.length; }
    keys.push(...songKeys(song));
  }
  for (const e of o.events || []) if (e.jingle) keys.push(...songKeys(newSong(e.jingle)));
  bank.ensureSync([...new Set(keys)]);
  if (song) eng.start(song, { at: 0.02, fadeIn: o.fadeIn ?? 0, startBeat: o.startBeat || 0 });
  for (const e of o.events || []) {
    if (e.jingle) eng.start(newSong(e.jingle), { bus: "sfx", at: e.at, fadeIn: 0 });
    else if (e.sfx) {
      const def = sfxDef(e.sfx);
      eng.playBuffer(sfxBuffer(e.sfx, oc), { at: e.at, vol: def.vol, rev: def.rev });
    }
  }
  eng.scheduleAll(sec);
  const buf = await oc.startRendering();
  return { sampleRate: sr, ch: [buf.getChannelData(0), buf.getChannelData(1)], song: song && { loopStart: song.loopStart * song.spb, loopEnd: song.loopEnd * song.spb } };
}
export const TRACKS = NEW_SONGS;
// 診断用 (開発時の確認): 現在の状態
export function audioDebug() {
  return {
    state: actx && actx.state, worker: bank.workerOk, bytes: bank.bytes, samples: bank.bufs.size,
    playing: current && current._name, want, voices: engine ? engine.allVoices.length : 0, players: engine ? engine.players.length : 0,
  };
}
