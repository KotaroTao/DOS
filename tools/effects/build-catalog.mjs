// 全技の演出割当を制作時に確定する。実行時には名前・MP・技IDのハッシュで推測しない。
import {readFile,writeFile} from 'node:fs/promises';
import {SPELLS} from '../../src/skilldefs.js';
import {SKILL_FX_SIGNATURES} from '../../src/skill-fx-signatures.js';
import {JOB_SKILLS} from '../../src/souls.js';
const level=new Map();
for(const rows of Object.values(JOB_SKILLS))for(const r of rows)if(r.skill)level.set(r.skill,Math.min(level.get(r.skill)??Infinity,r.lvl));
const signatures=new Set(Object.keys(SKILL_FX_SIGNATURES).filter(k=>!['DIAL','REVIVE','MADIOS'].includes(k)));
// 名前だけでは形を誤る代表技を明示する。追加・変更は生成結果の一覧も確認する。
const overrides={HUNTER_SAMIDARE:'projectile',KONGOUMUSOU:'impact',KONGOURENDA:'impact',GUARDIAN_JIBANSHIZUME:'impact',SEISAI:'blast',MARYOKUBOUSOU:'blast',ARCANIST_KINSEI:'blast',ARCTHIEF_TOUSEI:'blast',ARCHMAGE_TENKYUU:'blast',TENPENCHII:'blast',ARCHMAGE_SOUSEI:'blast',KYOKUDAI:'blast',BATTLEMAGE_TENPOU:'blast',ARCHMAGE_BANSHOU:'blast',NERAIUCHI:'pierce',KYOUGEKI:'impact',HAISUI:'impact',SHINGANGEKI:'pierce',JOUMON:'impact',TEPPEKIJIN:'ward',FURAKUJOU:'ward',KISHIOU:'empower',TILTOWAIT:'blast',KIKOKU:'cut',KUBIKARI:'cut',KIJINKUDAKI:'impact',DANZAINOTSUCHI:'impact',TSUBAMEGAESHI:'flurry',ASHURAZAN:'flurry',SHASHINNOGYOU:'impact',SEIKEN:'radiance',SHINENNOHADOU:'void',HOUSHOUHEKI:'ward',CARDINAL_SEIYU:'heal',DIALALL:'heal',MADIOS:'heal',DIOS:'heal',DIAL:'heal'};
function family(key,s){
 if(s.kind==='phys'){
  if(JOB_SKILLS.hunter.some(r=>r.skill===key))return 'projectile';
  if(['monk','guardian'].some(job=>JOB_SKILLS[job].some(r=>r.skill===key)))return 'impact';
 }
 if(overrides[key])return overrides[key];
 const n=s.name;
 if(s.kind==='escape')return 'escape';if(s.kind==='field')return 'survey';if(s.kind==='mana')return 'mana';
 if(s.kind==='cure')return 'purify';
 if(s.revive)return 'revive';
 if(s.kind==='heal')return s.healMul||s.healPct||s.partyHeal||s.regen?'heal':s.buff||s.grantBarrier?'ward':'heal';
 if(s.kind==='buff')return s.charge?'charge':s.shield||s.ward||s.reflect||s.grantBarrier||s.stance||s.taunt||s.buff?.vit?'ward':'empower';
 if(s.kind==='sleep'||s.sleepChance)return 'sleep';
 if(s.gravity)return 'gravity';
 if(s.para&&s.kind==='debuff')return 'paralyze';
 if(s.poison&&s.kind==='atk'&&!s.element)return 'poison';
 if(s.kind==='debuff')return s.instakill?'doom':s.strip||s.purge?'dispel':s.seal?'seal':s.poison?'poison':s.charm||s.confuse?'illusion':s.gravity?'gravity':'weaken';
 if(s.steal||s.plunder)return 'steal';
 if(s.kind==='atk'&&(s.drain||s.mpDrain))return 'drain';
 if(s.kind==='phys'){
  if(/射|矢|狙撃|弓/.test(n)||/連射|射掛|放つ矢/.test(s.desc||''))return 'projectile';
  if(/拳|掌|脚|蹴|盾|打|槌|鎚|崩|砕|衝|頭突/.test(n)||s.vitScale||s.shield)return 'impact';
  if((s.hits||s.scatter||1)>1)return 'flurry';
  if(/拳|掌|脚|蹴|打|槌|鎚|崩|砕|衝|頭突/.test(n)||s.vitScale||s.shield)return 'impact';
  if(/刺|突|槍|穿/.test(n))return 'pierce';
  return s.target==='all-enemy'?'cleave':'cut';
 }
 if(s.kind==='atk'){
  if(s.instakill&&!s.element)return 'doom';
  if(/雷|電|稲妻/.test(n))return 'lightning';
  if(s.element==='fire')return /爆|破裂|炸裂/.test(n)?'blast':/柱|壁|獄|噴|昇|舞|竜/.test(n)?'firePillar':s.target==='all-enemy'?'firePillar':'fireball';
  if(s.element==='water')return /氷|凍|霜|雪|アイス|フロスト|ブリザード/.test(n)?'ice':'wave';
  if(s.element==='wind')return /雷|電|稲妻/.test(n)?'lightning':'gale';
  if(s.element==='earth')return /岩|石|牙|杭/.test(n)?'stone':'quake';
  if(s.element==='light')return 'radiance';
  if(s.element==='dark')return /死|冥|滅/.test(n)?'doom':'void';
  return /爆/.test(n)?'blast':'arcane';
 }
 throw Error('演出の未分類: '+key);
}
// 火柱は基本を最多にし、最上位の火系統の技だけを炎の渦へ割り当てる。
const fireRanks={GOKUEN:2,ARCHMAGE_YOUGAN:2,GOKUENRAN:3,BATTLEMAGE_SHAKUNETSU:3,ARCANIST_GOUKASHO:3,INQUISITOR_JOUZAI:3,SAGE_HOMURA:3,ARCHMAGE_SHUUEN:3};
const fireballRanks={BATTLEMAGE_GURENMASHOU:2,ARCANIST_KENKA:2,INQUISITOR_MAJOGARI:2,SAGE_EICHIEN:2,SPELLBLADE_ENTEI:3,ARCTHIEF_NUSUMIBI:3,ASCETIC_KASHOUZANMAI:3};
const blastRanks={TENPENCHII:2,ARCHMAGE_SOUSEI:2,KYOKUDAI:3,BATTLEMAGE_TENPOU:3,ARCHMAGE_BANSHOU:3};
function effectTier(key,s){
 if(key==='INQUISITOR_MANAZASHI')return 3; // 弱体の最高習得Lv75: 上位の視線。
 const f=family(key,s);
 if(f==='firePillar')return fireRanks[key]||1;
 if(f==='fireball')return fireballRanks[key]||1;
 if(f==='blast')return blastRanks[key]||1;
 // 補助の六系統は看板技の指定で昇格させず、実際の習得段階に合わせる。
 if(['gravity','doom','drain','steal','escape','survey'].includes(family(key,s)))return (level.get(key)??1)>=100?3:(level.get(key)??1)>=30?2:1;
 return signatures.has(key)?3:(level.get(key)??1)>=100?3:(level.get(key)??1)>=30?2:1;
}
// 職業ごとの最終斬撃を制作時に確定する（拳・射撃は含めない）。
const slashUltimates={};
for(const [job,rows] of Object.entries(JOB_SKILLS)){
 const candidates=rows.filter(r=>r.skill&&['cut','cleave','flurry'].includes(family(r.skill,SPELLS[r.skill])));
 const last=candidates.sort((a,b)=>b.lvl-a.lvl)[0];
 if(last)slashUltimates[last.skill]=job;
}
const slashDesigns={};
for(const [key,s] of Object.entries(SPELLS))if(['cut','cleave','flurry'].includes(family(key,s))){
 const lv=level.get(key)||1;
 slashDesigns[key]={slashRank:lv>=150?5:lv>=100?4:lv>=60?3:lv>=25?2:1,ultimate:slashUltimates[key]||null};
}
const groups=new Map();
for(const [key,s]of Object.entries(SPELLS)){
 const tier=effectTier(key,s);
 const group=family(key,s)+':'+tier;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(key);
}
let source='// tools/effects/build-catalog.mjsで生成。全技を系統と格へ明示的に割り当てる。\nexport const SKILL_FX_CATALOG = Object.create(null);\nconst groups = {\n';
for(const [group,keys]of [...groups].sort(([a],[b])=>a.localeCompare(b)))source+='  '+JSON.stringify(group)+': '+JSON.stringify(keys.join(' '))+',\n';
source+='};\nfor (const [group, keys] of Object.entries(groups)) {\n  const [family, rank] = group.split(":");\n  const tier = Number(rank), design = Object.freeze({ family, tier, scale: [0, .9, 1.08, 1.24][tier] });\n  for (const key of keys.split(" ")) SKILL_FX_CATALOG[key] = design;\n}\n';
source+='for(const [key,extra] of Object.entries('+JSON.stringify(slashDesigns)+')) SKILL_FX_CATALOG[key]=Object.freeze({...SKILL_FX_CATALOG[key],...extra});\nObject.freeze(SKILL_FX_CATALOG);\n';
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv='key,name,kind,target,element,family,tier,signature,slashRank,ultimate\n'+Object.entries(SPELLS).map(([key,s])=>[key,s.name,s.kind,s.target,s.element||'',family(key,s),effectTier(key,s),SKILL_FX_SIGNATURES[key]?.accent||'',slashDesigns[key]?.slashRank||'',slashDesigns[key]?.ultimate||''].map(quote).join(',')).join('\n')+'\n';
const auditPath=new URL('../../docs/skill-effects-catalog.csv',import.meta.url);
const path=new URL('../../src/skill-fx-catalog.js',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==source||await readFile(auditPath,'utf8')!==csv)throw Error('技の演出割当を更新してください: node tools/effects/build-catalog.mjs');}
else {await writeFile(path,source);await writeFile(auditPath,csv);}
console.log(`${Object.keys(SPELLS).length}技 / ${new Set([...groups.keys()].map(x=>x.split(':')[0])).size}系統 / ${Buffer.byteLength(source)}B`);
