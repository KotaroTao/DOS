// 描画だけの予算。画質を落としても行動・音・確定時刻は変えない。
export const FX_LIMITS = Object.freeze({ effects: 32, targets: 12, particles: 18, liteParticles: 7, samples: 240 });
const deviceLite = (globalThis.navigator?.deviceMemory || 8) <= 2 || (globalThis.navigator?.hardwareConcurrency || 8) <= 2;
let mode = 'auto', adaptiveLite = false, slow = 0, fast = 0, cursor = 0, count = 0, total = 0, maximum = 0, maximumEffects = 0;
const samples = new Float32Array(FX_LIMITS.samples);
let previousLite = null, gapLite=false, gapSlow=0, gapFast=0, lastBattleFrame=null;
export function recordBattleFrame(ts,active){
 if(!active){lastBattleFrame=null;return;}
 if(lastBattleFrame!==null){const gap=ts-lastBattleFrame;
  if(gap>22&&gap<1000){gapSlow++;gapFast=0;}else if(gap<=19){gapFast++;gapSlow=Math.max(0,gapSlow-1);}
  if(gapSlow>=4){gapLite=true;gapSlow=0;syncQuality();}
  if(gapFast>=360){gapLite=false;gapFast=0;syncQuality();}
 }lastBattleFrame=ts;
}
function syncQuality() { const lite = fxLite(); if (lite === previousLite) return; previousLite = lite; if (globalThis.document?.documentElement) document.documentElement.dataset.fxLite = lite ? "1" : "0"; }
export function setFxQuality(value) { mode = ['auto','low','high'].includes(value) ? value : 'auto'; slow = fast = 0; syncQuality(); }
export function fxLite(reduced = false) { return reduced || mode === 'low' || mode === 'auto' && (deviceLite || adaptiveLite || gapLite); }
export function recordFxFrame(ms, effects) {
  if (!Number.isFinite(ms) || ms < 0) return;
  samples[cursor++ % samples.length] = ms; count++; total += ms; maximum = Math.max(maximum, ms); maximumEffects = Math.max(maximumEffects, effects || 0);
  if (mode !== 'auto') return;
  if (ms > 4) { slow++; fast = 0; } else if (ms < 2) { fast++; slow = 0; } else { slow = fast = 0; }
  if (slow >= 6) { adaptiveLite = true; slow = 0; syncQuality(); }
  if (fast >= 240) { adaptiveLite = false; fast = 0; syncQuality(); }
}
export function fxPerformance() {
  const recent = [...samples.slice(0,Math.min(count,samples.length))].sort((a,b)=>a-b);
  return { mode, lite: fxLite(), samples: count, meanMs: count ? total/count : 0, maxMs: maximum, maxEffects: maximumEffects,
    recentP95Ms: recent.length ? recent[Math.ceil(recent.length*.95)-1] : 0, retainedSamples: recent.length, limits: FX_LIMITS };
}
export function resetFxPerformance() { samples.fill(0); cursor = count = total = maximum = maximumEffects = slow = fast = 0; adaptiveLite = false; gapLite=false;gapSlow=gapFast=0;lastBattleFrame=null;syncQuality(); }
