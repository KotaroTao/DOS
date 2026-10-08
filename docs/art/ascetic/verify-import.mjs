import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { JOB_IMAGES } from '../../../src/jobart.js';
import { JOB_PHOTOS } from '../../../src/jobphotos.js';
import { SOUL_CLASSES, jobSprite, jobBust } from '../../../src/souls.js';

const baselineCommit = process.argv[2] || 'b27138e';
const { stdout: baseline } = await promisify(execFile)('git', ['show', `${baselineCommit}:src/jobphotos.js`]);
const oldPhotos = (await import(`data:text/javascript;base64,${Buffer.from(baseline).toString('base64')}`)).JOB_PHOTOS;
const { ascetic: oldAscetic, ...oldOthers } = oldPhotos;
const { ascetic, ...others } = JOB_PHOTOS;
assert.deepEqual(others, oldOthers, '他職業の原画設定を変更しない');
assert.equal(SOUL_CLASSES.ascetic.label, '修験者');
assert.equal(JOB_IMAGES.ascetic, undefined);
const sw = readFileSync(new URL('../../../sw.js', import.meta.url), 'utf8');
assert.match(sw, /const CACHE = "dos-dev"/);
const reference = jobSprite('crusader', 1);
const anatomy = jobSprite('ascetic', 1);
const rows = [];
for (let rank = 1; rank <= 5; rank++) {
  const sprite = jobSprite('ascetic', rank);
  const bust = jobBust('ascetic', rank);
  assert.equal(ascetic[rank].src, `art/jobs/ascetic_${rank}.webp`);
  assert.deepEqual([ascetic[rank].w, ascetic[rank].h], [90, 92]);
  assert.ok(sw.includes(`"./art/jobs/ascetic_${rank}.webp"`));
  assert.ok(sprite.photo && bust.photo);
  assert.deepEqual([sprite.w, sprite.h], [reference.w, reference.h]);
  assert.deepEqual(sprite.face, anatomy.face);
  assert.ok(sprite.head.every((value, index) => Math.abs(value - anatomy.head[index]) < 0.3));
  rows.push({ rank, src: ascetic[rank].src, face: sprite.face, head: sprite.head });
}
writeFileSync(new URL('import-verification.json', import.meta.url), JSON.stringify({
  reference: { face: reference.face, head: reference.head },
  anatomy: 'ユーザー承認済みの修験者R1に全ランクの頭を揃える。聖戦士との顎座標の差を隠さない。',
  ranks: rows, otherJobSettingsUnchanged: true, cache: 'dos-dev',
}, null, 2) + '\n');
console.log('全5ランクの原画選択・共通枠・R1との顔設定一致・キャッシュ登録・他職業の設定維持を確認');
