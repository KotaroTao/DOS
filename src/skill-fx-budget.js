// 描画だけの予算。画質を落としても行動・音・確定時刻は変えない。
export const FX_LIMITS = Object.freeze({ effects: 32, targets: 12, particles: 18, liteParticles: 7 });
const deviceLite = (globalThis.navigator?.deviceMemory || 8) <= 2 || (globalThis.navigator?.hardwareConcurrency || 8) <= 2;
let mode = 'auto', adaptiveLite = false, slow = 0, fast = 0;
let previousLite = null, gapLite=false, gapSlow=0, gapFast=0, lastBattleFrame=null;
// 120Hzでも演出の時間は実時間で進め、Canvasへ描く回数だけ60fpsに抑える。
const PAINT_STEP=1000/60;
let paintToken=null,paintDeadline=0,paintTime=-Infinity;
export function battlePaintDue(now,token){
 if(token!==paintToken||now<paintTime){paintToken=token;paintDeadline=now;}
 paintTime=now;
 if(now<paintDeadline-.5){return false;}
 paintDeadline+=PAINT_STEP;
 if(paintDeadline<now-.5)paintDeadline=now+PAINT_STEP;
 return true;
}
export function recordBattleFrame(ts,active){
 if(!active){lastBattleFrame=null;return;}
 if(lastBattleFrame!==null){const gap=ts-lastBattleFrame;
  if(gap>22&&gap<1000){gapSlow++;gapFast=0;}else if(gap<=19){gapFast++;gapSlow=Math.max(0,gapSlow-1);}
  if(gapSlow>=4){gapLite=true;gapSlow=0;syncQuality();}
  if(gapFast>=360){gapLite=false;gapFast=0;syncQuality();}
 }lastBattleFrame=ts;
}
globalThis.document?.addEventListener?.('visibilitychange',()=>{lastBattleFrame=null;});
function syncQuality() { const lite = fxLite(); if (lite === previousLite) return; previousLite = lite; if (globalThis.document?.documentElement) document.documentElement.dataset.fxLite = lite ? "1" : "0"; }
export function setFxQuality(value) { mode = ['auto','low','high'].includes(value) ? value : 'auto'; slow = fast = 0; syncQuality(); }
export function fxLite(reduced = false) { return reduced || mode === 'low' || mode === 'auto' && (deviceLite || adaptiveLite || gapLite); }
export function recordFxFrame(ms, effects) {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (mode !== 'auto') return;
  if (ms > 4) { slow++; fast = 0; } else if (ms < 2) { fast++; slow = 0; } else { slow = fast = 0; }
  if (slow >= 6) { adaptiveLite = true; slow = 0; syncQuality(); }
  if (fast >= 240) { adaptiveLite = false; fast = 0; syncQuality(); }
}
