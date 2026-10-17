// 定義から、全特性の効果幅と評価の表を再生成する。node tools/balance/affix-report.mjs
import fs from 'node:fs';
import { AFX, AFX_TIERS, afxBase, affixPower } from '../../src/infaffix.js';
const num=n=>String(Math.round(n*10000)/10000);
const slots={all:'全装備',w:'武器',a:'防具（盾含む）',acc:'装飾',body:'胴',head:'頭',hands:'小手',feet:'足',shield:'盾'};
const range=(a,b)=>a===b?a:`${a} ～ ${b}`;
const samples=[['R10',100,0],['R20',200,0],['R20・B500F',200,500],['R20・B1000F',200,1000]];
const rows=AFX.filter(d=>!d.retired).map(d=>{
 const row={ID:d.id,名前:d.name,格:AFX_TIERS[d.tier].name,部位:d.slots.map(s=>slots[s]).join('・'),値v:range(...d.r.map(v=>d.kind==='B'?`${num(v)}B`:num(v))),刻み:d.r[0]===d.r[1]?'固定':d.step?num(d.step):'連続（表示時に丸め）'};
 const p0=d.pts?.(d.r[0],25)||0,p1=d.pts?.(d.r[1],25)||0;
 row.評価式=d.kind==='B'?`v${d.ptsMul?` × ${d.ptsMul}`:''}`:d.kind==='fixB'?`B × ${d.r[0]}`:`[${p0===p1?num(p0):d.pts.toString().replace(/^\([^)]*\)\s*=>\s*/, '')}] × B / 25`;
 for(const [label,lv,depth] of samples){const it={lv,depth},B=afxBase(it),values=d.r.map(v=>d.kind==='B'?v*B:v);
  row[label+'効果']=range(...values.map(v=>d.text(v,B)));
  row[label+'評価']=range(...values.map(v=>num(affixPower(it,[{k:d.id,v}]))));
 }
 return row;
});
const keys=Object.keys(rows[0]),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const csv='\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const counts=Object.fromEntries(Object.entries(AFX_TIERS).map(([k,v])=>[v.name,rows.filter(r=>r.格===v.name).length]));
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DOS 追加能力・特性 評価一覧</title><style>body{font:15px/1.65 system-ui,sans-serif;margin:24px;color:#e6e3db;background:#151718}h1{font-size:24px}p{max-width:1100px}input,select{padding:10px;border:1px solid #666;border-radius:5px;background:#222;color:#eee;margin:4px}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{border:1px solid #4d4d47;padding:8px;vertical-align:top;min-width:90px}th{background:#30342d;position:sticky;top:0}tr:nth-child(even){background:#202320}td:nth-child(1),td:nth-child(3){white-space:nowrap;min-width:40px}main{overflow:auto;max-height:72vh}strong{color:#f1d58b}</style><h1>追加ステータス・追加特性と評価（全${rows.length}件）</h1><p>src/infaffix.js の現行定義から生成。${Object.entries(counts).map(([k,v])=>k+v).join('・')}。再生成：node tools/balance/affix-report.mjs。</p><p>B＝max(3,1.2R＋0.13R²)×D、R＝ceil(装備Lv÷10)（1〜20）。Dは入手した無限迷宮の深度から固定。200階まで1、201階以降はlvPow(f)/lvPow(200)×infEnemyMul(f)/infEnemyMul(200)。R10のB＝25、R20のB＝76。v＝0.1は10%。能力値以外の<strong>効果そのものは深度で増えず、評価がBに比例</strong>します。</p><p>表の評価は追加特性1つの点。棚で比較する<strong>総合の強さは並品50の本体・深度の点＋追加特性の合計</strong>。価格は部位の標準品の性能の二次式を逆算し、10＋0.3Lv²＋5Lv。鍛造の増分も評価に加算。売却は価格の半分（端数処理後）×レア度倍率（コモン・アンコモン・レア1、SR1.5、LR4）。特性による能力の加算は二重に数えません。</p><p>会心率A09/A11は1.0〜5.0%（0.1刻み）、会心ダメージA10/A12は10〜30%（1刻み）。会心ダメージは元の倍率へ乗算。K01〜K06は正味0.3B。K07の負の評価も総合点に反映します。表は定義上の幅で、実際の拾得には部位・容量・最大5枠の制限があります。</p><label>検索<input id="query" placeholder="ID・名前・効果・評価式"></label><label>格<select id="tier"><option value="">すべて</option>${Object.keys(counts).map(k=>`<option>${k}</option>`).join('')}</select></label><span id="count">${rows.length}件</span><main><table><thead><tr>${keys.map(k=>`<th>${escape(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr data-tier="${r.格}">${keys.map(k=>`<td>${escape(r[k])}</td>`).join('')}</tr>`).join('\n')}</tbody></table></main><script>const q=document.querySelector('#query'),t=document.querySelector('#tier'),rs=[...document.querySelectorAll('tbody tr')];function update(){let n=0;for(const r of rs){r.hidden=!(r.textContent.toLocaleLowerCase().includes(q.value.toLocaleLowerCase())&&(!t.value||r.dataset.tier===t.value));if(!r.hidden)n++}document.querySelector('#count').textContent=n+'件'}q.addEventListener('input',update);t.addEventListener('change',update)</script></html>`;
fs.writeFileSync(new URL('../../docs/affix-evaluations.csv',import.meta.url),csv);
fs.writeFileSync(new URL('../../docs/affix-evaluations.html',import.meta.url),html);
console.log(`全${rows.length}件の効果・深度別評価を再生成 (${JSON.stringify(counts)})`);
