import assert from 'node:assert/strict';
import {recordBattleFrame,setFxQuality,fxLite} from '../../src/skill-fx-budget.js';
import {skillFxDuration} from '../../src/skill-fx.js';
setFxQuality('auto');let t=0;recordBattleFrame(t,true);
for(let i=0;i<4;i++)recordBattleFrame(t+=40,true);
assert.equal(fxLite(),true);
assert.equal(skillFxDuration({kind:'phys',hits:5,tier:5},1,{auto:true}),2060);
for(let i=0;i<361;i++)recordBattleFrame(t+=16.7,true);
assert.equal(fxLite(),false);
recordBattleFrame(t,false);recordBattleFrame(t+5000,true);assert.equal(fxLite(),false);
setFxQuality('high');for(let i=0;i<6;i++)recordBattleFrame(t+=40,true);assert.equal(fxLite(),false);
setFxQuality('auto');
console.log('フレーム間隔に応じた軽量化・安定後の復帰・固定画質優先・連撃尺を確認');

// リフレッシュレートが高くても、演出の描画は毎秒60回まで。
const {battlePaintDue}=await import('../../src/skill-fx-budget.js');
for(const hz of [30,60,90,120,144]){
 const token={};let frames=0;
 for(let i=0;i<hz*10;i++)frames+=battlePaintDue(i*1000/hz,token);
 assert.equal(frames,Math.min(hz,60)*10,`${hz}Hz`);
 assert(battlePaintDue(10000,{}),'次の演出の最初は即時描画');
}
const token={};assert(battlePaintDue(0,token));assert(!battlePaintDue(8,token));assert(battlePaintDue(500,token));assert(!battlePaintDue(501,token));
console.log('30/60/90/120/144Hzの描画上限と遅延後の連続描画抑止を確認');
