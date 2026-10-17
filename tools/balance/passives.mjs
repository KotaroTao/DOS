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

// 希望の陽だまり: 3職の習得・旧借用・同一人業と隊内の重複を確認。
for (const [job, steps] of [['hero', [[25,1],[125,2],[145,3]]], ['archbishop', [[45,1],[90,2],[145,3]]], ['paladin', [[45,1],[105,2]]]]) {
  for (const [level, lv] of steps) {
    const d=wearer(rankedSoul(job, 2, level));
    displayed(d);
    assert.equal(d.passiveMap.heroKibouHidamari,lv,`${job} Lv${level}`);
    assert.equal(d.passives.filter(n=>n.startsWith('希望の陽だまり')).length,1);
    assert(!d.passiveMap.paladinKoukan&&!d.passiveMap.archbishopMinasoko);
  }
}
for (const [job,key] of [['paladin','paladinKoukan'],['archbishop','archbishopMinasoko']]) {
  const main=rankedSoul('fighter',2), sub=rankedSoul(job,2);
  const d=wearer(main,[sub],key);
  assert.equal(d.subs[0].picks[0].passive,'heroKibouHidamari','旧借用を共通キーへ引き継ぐ');
  assert.equal(d.passiveMap.heroKibouHidamari,job==='paladin'?2:3);
  displayed(d);
  const old=makeDoll('旧形式');old.primary=main.uid;old.subs=[{uid:sub.uid,passive:key}];recalcDoll(old);
  assert.equal(old.passiveMap.heroKibouHidamari,d.passiveMap.heroKibouHidamari);
  d.subs=[];recalcDoll(d);assert(!d.passiveMap.heroKibouHidamari,'外した後に残さない');
}
for (let lv=1;lv<=3;lv++) {
  const make=(map)=>Object.assign(makeDoll('陽だまりの検証'),{maxhp:10000,hp:1000,passiveMap:map});
  const a=make({heroKibouHidamari:lv,paladinKoukan:lv,archbishopMinasoko:lv});
  const low=make({heroKibouHidamari:1}), same=make({archbishopMinasoko:lv});
  const logs=[];
  const b=new Battle([a,low,same],[{uid:999999,side:'enemy',name:'敵',alive:true,hp:1e9,maxhp:1e9,atk:1,vit:1,agi:1}],s=>logs.push(s));
  assert.deepEqual([a.hp,low.hp,same.hp],[1000,1000,1000],'1ターン目は回復しない');
  b._roundNo=1;b._startRound();
  assert.deepEqual([a.hp,low.hp,same.hp],Array(3).fill(1000+[400,800,1200][lv-1]));
  assert.equal(logs.filter(s=>s.includes('希望の陽だまり')).length,1,'同一人業の別名・複数人の加護も1回だけ');
  a.alive=false;same.alive=false;low.hp=1000;b._startRound();
  assert.equal(low.hp,1400,'最高Lvの持ち主が倒れたら生存者の最高Lvへ戻る');
  assert.equal(a.hp,1000+[400,800,1200][lv-1],'倒れた者は回復しない');
}
console.log('希望の陽だまり: 3職の習得Lv維持、旧形式と旧キーの借用互換、4/8/12%、同一人業/隊内の最高Lvのみ、1ターン目・死亡を確認');

// 死の宣告: 各Lvの即死率の境界と、主・金属への無効を実戦の開幕で確かめる。
{
  const { useMathRandom } = await import('../../src/rng.js');
  const originalRandom = Math.random;
  useMathRandom();
  try {
    for (const [i, rate] of [0.03, 0.05, 0.08, 0.12].entries()) {
      for (const roll of [rate - 0.000001, rate]) {
        Math.random = () => roll;
        const d = makeDoll('宣告の検証');
        d.passiveMap = { necroSenkoku: i + 1 };
        const enemy = (uid, extra = {}) => ({ uid, side: 'enemy', name: '宣告の相手', alive: true,
          hp: 100, maxhp: 100, atk: 1, vit: 1, agi: 1, int: 1, pie: 1, luk: 1, ...extra });
        const foes = [enemy(999991), enemy(999992, { boss: true }), enemy(999993, { metal: true })];
        new Battle([d], foes, () => {});
        assert.equal(foes[0].alive, roll >= rate, `死の宣告Lv${i + 1}の即死率`);
        assert(foes[1].alive && foes[2].alive, '主と金属の魔物には効かない');
        assert(passiveDesc('necroSenkoku', i + 1).includes(`${Math.round(rate * 100)}%`));
      }
    }
  } finally {
    Math.random = originalRandom;
    useMathRandom(false);
  }
  console.log('死の宣告: 3/5/8/12%の境界・主と金属への無効・表記を確認');
}
