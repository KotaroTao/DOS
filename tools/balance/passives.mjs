// 加護の表示・効果の重複と、伝説の勇者の倍率を確認する。
// node tools/balance/passives.mjs
import assert from 'node:assert/strict';
import { Battle } from '../../src/combat.js';
import { SOUL_KEYS, soulRankFromCount, makeDoll, makeSoulInstance, setSharedSouls, recalcDoll, passiveByName, passiveDesc } from '../../src/souls.js';

function rankedSoul(job, rank, level = 200) {
  let count = 1;
  while (soulRankFromCount(job, count) < rank) count++;
  return Object.assign(makeSoulInstance(job, count, level), { capBonus: 200 });
}
function wearer(main, subs = [], key = 'dynamicVision') {
  setSharedSouls([main, ...subs]);
  const d = makeDoll('検証の人業');
  d.primary = main.uid;
  d.subs = subs.map(s => ({ uid: s.uid, picks: [{ passive: key }], picked: true }));
  recalcDoll(d);
  return d;
}
function displayed(d) {
  const entries = d.passives.map(name => { const p = passiveByName(name); assert(p, name); return [p.key, p.lv]; });
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, '同じ加護は最高Lvを一つだけ表示');
  assert.deepEqual(Object.fromEntries(entries), d.passiveMap, '表示と効果のLvが一致');
}
// 全職・全ランクで、過去のランクの加護が残らない。
for (const job of SOUL_KEYS) {
  for (let rank = 1; rank <= 5; rank++) displayed(wearer(rankedSoul(job, rank)));
}
for (const [mainLv, firstLv, secondLv, expected] of [[20, 60, 100, 3], [130, 20, 40, 3], [20, 20, 10, 1], [20, 60, 40, 2]]) {
  const main = rankedSoul('monk', 2, mainLv);
  const first = rankedSoul('asura', 2, firstLv), second = rankedSoul('hunter', 2, secondLv);
  for (const subs of [[first, second], [second, first]]) {
    const d = wearer(main, subs);
    displayed(d);
    assert.equal(d.passiveMap.dynamicVision, expected, 'メイン・サブの異なるLvも同じLvも最高Lvだけ');
    // 古い表示を持つセーブも、再計算で現在の最高Lvへ戻る。
    d.passives.push('動体視力Lv1', '動体視力Lv1');
    recalcDoll(d); displayed(d);
    d.subs = []; recalcDoll(d); displayed(d);
    assert.equal(d.passiveMap.dynamicVision, mainLv >= 130 ? 3 : mainLv >= 60 ? 2 : 1, 'サブを外すと本来のLvへ戻る');
  }
}
for (let rank = 2; rank <= 5; rank++) {
  for (const borrowed of [false, true]) {
    const d = borrowed ? wearer(rankedSoul('fighter', 1), [rankedSoul('asura', rank)], 'asuraNitou') : wearer(rankedSoul('asura', rank));
    displayed(d);
    assert.equal(d.passives.filter(name => name.startsWith('二刀流')).length, 1);
    assert.equal(d.dualWield, [0, .4, .6, .8, 1][rank - 1], '二刀流は最高Lvの効果のみ');
  }
}
// 同じ加護を持つ仲間が複数いても、隊の最高Lvだけが働く。倒れた持ち主は除く。
for (let lv = 1; lv <= 4; lv++) {
  const a = wearer(rankedSoul('hero', lv + 1));
  const low = wearer(rankedSoul('fighter', 1), [rankedSoul('hero', 2)], 'heroDensetsu');
  for (const d of [a, low]) {
    // 他のパッシブによる能力補正と切り離し、伝説の勇者の実戦処理を検査する。
    d.passiveMap = { heroDensetsu: d === a ? lv : 1 };
    d.hp = d.maxhp; d.mp = d.maxmp;
  }
  const b = new Battle([a, low], [{ uid: 999999, side: 'enemy', name: '検証の敵', alive: true, hp: 1e9, maxhp: 1e9, atk: 1, vit: 1, agi: 1, int: 1, pie: 1, luk: 1 }], () => {});
  for (const d of [a, low]) for (const stat of ['atk', 'vit', 'agi', 'int', 'pie']) assert.equal(d.buffs[stat], 1 + [.03, .06, .09, .12][lv - 1]);
  assert(passiveDesc('heroDensetsu', lv).includes(`+${[3, 6, 9, 12][lv - 1]}%`));
  a.alive = false; b._recalcBuffs(low); assert.equal(low.buffs.atk, 1.03);
  low.passiveMap = {}; b._recalcBuffs(low); assert.equal(low.buffs.atk, 1);
}
console.log('全37職・ランク1〜5、メイン/サブの同Lv・異Lv・順序・取り外し・再計算、二刀流と伝説の勇者の重複なしを確認');
