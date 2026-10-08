import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { JOB_IMAGES } from '../../../src/jobart.js';
import { JOB_PHOTOS } from '../../../src/jobphotos.js';
import { SOUL_CLASSES, jobSprite, jobBust } from '../../../src/souls.js';

async function originalModule(path) {
  const { stdout } = await promisify(execFile)('git', ['show', `32e5644:${path}`], { maxBuffer: 2 * 1024 * 1024 });
  return import(`data:text/javascript;base64,${Buffer.from(stdout).toString('base64')}`);
}
const oldArt = (await originalModule('src/jobart.js')).JOB_IMAGES;
const oldPhotos = (await originalModule('src/jobphotos.js')).JOB_PHOTOS;
assert.equal(SOUL_CLASSES.priest.label, '僧侶');
assert.equal(JOB_IMAGES.priest, undefined);
delete oldArt.priest;
assert.deepEqual(JOB_IMAGES, oldArt, '他職業のドット絵を変更しない');
const { priest, ...otherPhotos } = JOB_PHOTOS;
assert.deepEqual(otherPhotos, oldPhotos, '他職業の原画設定を変更しない');
const sw = readFileSync(new URL('../../../sw.js', import.meta.url), 'utf8');
assert.match(sw, /const CACHE = "dos-dev"/);
for (let rank = 1; rank <= 5; rank++) {
  assert.equal(priest[rank].src, `art/jobs/priest_${rank}.webp`);
  assert.deepEqual([priest[rank].w, priest[rank].h], [90, 92]);
  assert.ok(sw.includes(`"./art/jobs/priest_${rank}.webp"`));
  const sprite = jobSprite('priest', rank);
  const bust = jobBust('priest', rank);
  const reference = jobSprite('crusader', 1);
  assert.ok(sprite.photo && bust.photo);
  assert.deepEqual(sprite.face, reference.face);
  assert.deepEqual([sprite.w, sprite.h], [reference.w, reference.h]);
  assert.ok(sprite.head.every((value, index) => Math.abs(value - reference.head[index]) < 0.3));
}
console.log('僧侶全5ランクの画像選択・共通枠・顔設定・キャッシュ登録と、他職業の設定維持を確認');
