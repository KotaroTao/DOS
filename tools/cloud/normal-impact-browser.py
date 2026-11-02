"""通常攻撃の軌跡・中心への打撃・低減表示・命中音を実Canvas/Audioで確認する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=b.new_page()
 page.route('**/normal-impact-check',lambda r:r.fulfill(content_type='text/html',body='<html><body></body></html>'))
 page.goto('http://localhost:8000/normal-impact-check')
 result=page.evaluate('''async()=>{
  const {spawnFx,drawBattleFx}=await import('/src/battlefx.js');
  const {reseedRng,rngState}=await import('/src/rng.js');reseedRng(123);const before=JSON.stringify(rngState());
  function sample(type,ms,reduced=false){
   const c=document.createElement('canvas');c.width=240;c.height=220;const ctx=c.getContext('2d'),list=[];
   spawnFx(list,type,120,110,0,1);drawBattleFx(ctx,list,ms,240,220,reduced);
   const a=ctx.getImageData(0,0,240,220).data;let weight=0,x=0,y=0;
   for(let i=0;i<a.length;i+=4){const v=a[i+3];weight+=v;x+=v*((i/4)%240);y+=v*Math.floor(i/4/240);}
   return {weight,x:x/weight,y:y/weight,center:[...a.slice((110*240+120)*4,(110*240+120)*4+4)]};
  }
  const early=sample('normalSlash',8),late=sample('normalSlash',40);
  if(!(early.x>late.x+10&&early.y<late.y-8))throw Error('斬撃が右上から左下へ進んでいない');
  const impact=sample('normalBlunt',20);
  if(Math.abs(impact.x-120)>4||Math.abs(impact.y-110)>4||impact.center[0]<200)throw Error('打撃が敵の中心を捉えていない');
  for(const type of ['normalSlash','normalBlunt','normalThrust','normalArrow','normalArcane']){
   if(sample(type,-1).weight!==0||sample(type,400).weight!==0)throw Error('効果の時間外に描いている');
   if(!(sample(type,40,true).weight>0))throw Error('動きを減らす設定で一撃が見えない');
   if(!(sample(type,190).weight<sample(type,40).weight))throw Error('残光が消えていない');
  }
  if(JSON.stringify(rngState())!==before)throw Error('描画でゲームの乱数が変わった');
  const audio=await import('/src/audio.js'),{Engine}=await import('/src/music/engine.js');audio.initAudio();audio.setVolumes(0,1);
  const played=[],old=Engine.prototype.playBuffer;Engine.prototype.playBuffer=function(buffer,...args){played.push(buffer.duration);return old.call(this,buffer,...args);};
  for(const style of ['slash','smash','thrust','arrow',null])audio.SFX.hit(style);
  const expected=[.22,.27,.18,.18,.3];if(played.length!==5||played.some((v,i)=>Math.abs(v-expected[i])>.001))throw Error('命中音の振り分けが異なる');
  const {SFX_DEFS}=await import('/src/music/sfx.js'),{rng}=await import('/src/music/dsp.js');
  for(const name of ['normalSlash','normalBlunt','normalPierce'])for(let i=0;i<3;i++){
   const sound=SFX_DEFS[name].gen(rng(42+i));
   if(!sound.ch.every(ch=>ch.every(Number.isFinite)&&ch.some(v=>Math.abs(v)>.1)))throw Error('命中音が無音または不正');
  }
  return {early,late,impact,played};
 }''')
 print('通常攻撃: 右上→左下の斬撃・中心への打撃・5種の残光/低減表示・乱数不変・実音声を確認',result)
 b.close()
