import { SPELLS } from './skilldefs.js';
import { SKILL_FX_CATALOG } from './skill-fx-catalog.js';
import { SKILL_FX_SIGNATURES } from './skill-fx-signatures.js';
import { SKILL_FAMILIES, skillFxSound } from './skill-fx.js';
import { drawBattleFx } from './battlefx.js';
import { previewSkillFx } from './skill-fx-preview.js';
import { setFxQuality, fxPerformance, resetFxPerformance } from './skill-fx-budget.js';
import { SFX, initAudio, setVolumes } from './audio.js';
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
const entries=Object.entries(SPELLS);let frame=0,started=0,lastKey='',list=[],lastDraw=0,auditing=false,cancelled=false,report=null;
$('reduce').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const usedFamilies=new Set(Object.values(SKILL_FX_CATALOG).map(d=>d.family));
for(const [key,label]of Object.entries(SKILL_FAMILIES)){if(!usedFamilies.has(key))continue;const o=document.createElement('option');o.value=key;o.textContent=label;$('family').append(o);}
function filter(){
 const query=$('search').value.trim().toLowerCase(),family=$('family').value,previous=$('skill').value;
 $('skill').replaceChildren();
 for(const [key,spell]of entries)if((!query||spell.name.toLowerCase().includes(query)||key.toLowerCase().includes(query))&&(!family||SKILL_FX_CATALOG[key].family===family)){
  const option=document.createElement('option');option.value=key;option.textContent=spell.name+' — '+SKILL_FAMILIES[SKILL_FX_CATALOG[key].family];$('skill').append(option);
 }
 if([...$('skill').options].some(o=>o.value===previous))$('skill').value=previous;
 else if($('skill').options.length)$('skill').selectedIndex=0;
 play();
}
function background(){
 ctx.clearRect(0,0,640,360);ctx.fillStyle='#1b1920';ctx.fillRect(0,0,640,360);
 const points=list[0]?.pts||[];
 for(const p of points){ctx.fillStyle=p.side==='party'?'#2d3540':'#39353d';ctx.beginPath();ctx.ellipse(p.x,p.y+6,23,36,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#817b81';ctx.lineWidth=1;ctx.stroke();}
}
function paint(ms){background();drawBattleFx(ctx,list,ms,640,360,$('reduce').checked);}
function tick(now){
 frame=0;if(document.hidden||auditing)return;
 if(now-lastDraw>=16){paint(now-started);lastDraw=now;}
 if(now-started<650)frame=requestAnimationFrame(tick);
 else if($('auto').checked){const select=$('skill');select.selectedIndex=(select.selectedIndex+1)%Math.max(1,select.options.length);play();}
}
function play(){
 if(auditing)return;cancelAnimationFrame(frame);frame=0;
 const key=$('skill').value;if(!key){list=[];background();$('caption').textContent='該当する技がありません';return;}
 lastKey=key;setFxQuality($('low').checked?'low':'auto');list=previewSkillFx(key,$('group').checked);
 const design=SKILL_FX_CATALOG[key],spell=SPELLS[key];
 $('caption').textContent=spell.name+' ／ '+SKILL_FAMILIES[design.family]+' ／ '+['','基本','上位','大技'][design.tier]+(SKILL_FX_SIGNATURES[key]?' ／ 看板の余韻':'');
 if($('sound').checked){initAudio();setVolumes(0,.7);SFX.skill(skillFxSound(design.family));}
 started=performance.now();lastDraw=0;paint(0);frame=requestAnimationFrame(tick);
}
async function audit(){
 if(auditing)return;auditing=true;cancelled=false;cancelAnimationFrame(frame);frame=0;
 $('audit').disabled=true;$('cancel').disabled=false;$('export').disabled=true;resetFxPerformance();
 const heapBefore=performance.memory?.usedJSHeapSize??null,rows=[];const auditStarted=performance.now();
 try{
  for(let index=0;index<entries.length;index++){
   if(cancelled||document.hidden)break;
   const [key]=entries[index],scene=previewSkillFx(key,true);let maximum=0,visible=false;
   if(scene.length!==1||!scene[0].pts.length)throw Error('演出を生成できません: '+key);
   for(const quality of ['high','low'])for(const reduced of [false,true]){
    setFxQuality(quality);
    for(const t of [20,90,170,250]){
     ctx.clearRect(0,0,640,360);const start=performance.now();drawBattleFx(ctx,scene,t,640,360,reduced);maximum=Math.max(maximum,performance.now()-start);
     if(t===90&&quality==="high"&&!reduced){const pixels=ctx.getImageData(0,0,640,360).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){visible=true;break;}}
    }
   }
   if(!visible)throw Error("技が描画されていません: "+key);
   rows.push({key,visible,family:SKILL_FX_CATALOG[key].family,tier:SKILL_FX_CATALOG[key].tier,maxDrawMs:maximum,effects:scene.length,targets:scene[0].pts.length});
   if(index%8===0){$('report').textContent='確認中 '+(index+1)+' / '+entries.length;await new Promise(requestAnimationFrame);}
  }
  report={v:1,createdAt:new Date().toISOString(),scope:'この端末のCanvas演出描画時間。GPU反映の完了・戦闘全体のFPS・通信・音声生成は含まない。',complete:rows.length===entries.length,totalSkills:entries.length,checkedSkills:rows.length,elapsedMs:performance.now()-auditStarted,heapBefore,heapAfter:performance.memory?.usedJSHeapSize??null,performance:fxPerformance(),rows};
  $('report').textContent=(report.complete?'完了':'中断')+' '+rows.length+' / '+entries.length+'技\n平均 '+report.performance.meanMs.toFixed(3)+'ms / 直近p95 '+report.performance.recentP95Ms.toFixed(3)+'ms / 最大 '+report.performance.maxMs.toFixed(3)+'ms\n保持する計測サンプル '+report.performance.retainedSamples+'件（上限240件）';
  $('export').disabled=false;return report;
 }catch(error){$('report').textContent=error.message;throw error;}
 finally{auditing=false;$('audit').disabled=false;$('cancel').disabled=true;play();}
}
$('search').addEventListener('input',filter);$('family').addEventListener('change',filter);$('skill').addEventListener('change',play);$('play').addEventListener('click',play);
for(const key of ['auto','low','reduce','group','sound'])$(key).addEventListener('change',play);
$('audit').addEventListener('click',()=>audit().catch(()=>{}));$('cancel').addEventListener('click',()=>{cancelled=true;});
$('export').addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='dos-effect-metrics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelled=true;cancelAnimationFrame(frame);frame=0;}else if(!auditing)play();});
window.addEventListener('pagehide',()=>{cancelled=true;cancelAnimationFrame(frame);});
window.__effectsLab={audit,play,paint,previewSkillFx,get report(){return report;},get selected(){return lastKey;}};
filter();
