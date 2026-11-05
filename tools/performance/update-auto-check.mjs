// 実ゲームの更新入口を使い、オート解除→確定待ち→保存→再読込の順を確認する。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../src/game.js',import.meta.url),'utf8');
const begin=source.indexOf('async function returnToTitle() {'),end=source.indexOf('\nfunction resetAllData()',begin);
const events=[],G={autoCombat:true};
const context=vm.createContext({G,testPlayActive:false,_cloudResolving:true,_resetting:false,
 stopAutoCombat(){G.autoCombat=false;events.push('stop');},cloudEnabled:()=>true,cloudReady:()=>true,
 async cloudPrepareReload(save){events.push('flush');return save();},autosave(){events.push('save');return true;},location:{reload(){events.push('reload');}}});
vm.runInContext(source.slice(begin,end),context);
assert.equal(await vm.runInContext('returnToTitle()',context),false);
assert.deepEqual(events,['stop']);
context._cloudResolving=false;
await vm.runInContext('returnToTitle()',context);
assert.deepEqual(events,['stop','flush','save','reload']);
assert.equal(context._resetting,true);
console.log('オートを止め、確定前の再読込を避け、保存完了後に更新する順序を確認');
