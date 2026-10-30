import assert from 'node:assert/strict';
import {refDeserialize} from '../../src/savegraph.js';
// Workerという名前があっても、CSPや端末の制限で生成が拒否される場合がある。
globalThis.Worker=class { constructor(){throw new DOMException('blocked','SecurityError');} };
const {encodeCloudSave}=await import('../../src/save-codec.js');
const item={id:'one'},inventory=[item],snapshot={state:'town',party:[{items:inventory,equip:{weapon:item}}],inventory};
for(const compact of [true,false]){
 const restored=refDeserialize(JSON.parse(await encodeCloudSave(snapshot,compact)));
 assert.equal(restored.inventory,restored.party[0].items);
 assert.equal(restored.inventory[0],restored.party[0].equip.weapon);
}
console.log('Worker生成失敗: 新旧の保存形式と品・共有参照を同期処理で保持 OK');
