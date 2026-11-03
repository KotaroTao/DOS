import assert from 'node:assert/strict';
import {SPELLS} from '../../src/skilldefs.js';
import {SKILL_FX_CATALOG as catalog} from '../../src/skill-fx-catalog.js';
import {SLASH_FORMS} from '../../src/skill-fx.js';
import {previewSkillFx} from '../../src/skill-fx-preview.js';
const slashes=Object.entries(catalog).filter(([,d])=>d.slashRank);
assert.deepEqual([...new Set(slashes.map(([,d])=>d.slashRank))].sort(),[1,2,3,4,5]);
const jobs=new Set();
for(const [key,d]of slashes){
 assert.ok(['cut','cleave','flurry'].includes(d.family));
 assert.equal(previewSkillFx(key)[0].element,SPELLS[key].element||null);
 if(d.ultimate){assert.ok(SLASH_FORMS[d.ultimate],key);assert.ok(!jobs.has(d.ultimate));jobs.add(d.ultimate);}
}
for(const key of ['KONGOUMUSOU','GUARDIAN_JIBANSHIZUME','HUNTER_SAMIDARE'])assert.ok(!catalog[key].slashRank);
console.log(`${slashes.length}斬撃 / 5ランク / ${jobs.size}職の専用斬撃、属性・拳/盾/射撃の分離を確認`);

assert.equal(new Set(Object.values(SLASH_FORMS).map(v=>JSON.stringify(v))).size,Object.keys(SLASH_FORMS).length);
