"""全技の実Canvas描画、確認画面、音・低減表示、保存不変とCPU負荷を検査する。"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/dos-skill-fx-check');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='block')
 c.add_init_script("localStorage.setItem('dos-save-v7','unchanged');localStorage.setItem('dos-cloud-auth','unchanged');")
 page=c.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.goto('http://localhost:8000/effects-lab.html')
 page.wait_for_function('window.__effectsLab && document.querySelectorAll("#skill option").length===960')
 # 火柱の素材が読めた場合、通常・軽量・動き低減のすべてで実画像を使う。
 texture=page.evaluate("""async()=>{
  const image=new Image();image.src='/art/effects/fire-pillar.webp';await image.decode();
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
  const results=[];
  for(const [quality,reduced]of [['high',false],['low',false],['high',true]]){
   setFxQuality(quality);const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let calls=0;
   ctx.drawImage=(...args)=>{if(args[0].src?.endsWith('fire-pillar.webp'))calls++;draw(...args);};drawBattleFx(ctx,previewSkillFx('MAHALITO'),125,640,360,reduced);
   results.push(calls);
  }setFxQuality('high');return {width:image.naturalWidth,height:image.naturalHeight,calls:results};
 }""")
 assert texture=={'width':768,'height':576,'calls':[10,3,3]},texture
 # 格の違いが面積に表れ、ランク3は端末比率にかかわらず戦場全体へ届く。
 ranks=page.evaluate("""async()=>{
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
  const result=[];
  for(const [w,h]of [[320,220],[640,360],[1024,600]])for(const [quality,reduced]of [['high',false],['low',false],['high',true]]){
   setFxQuality(quality);const areas=[];
   for(const [key,tier] of [['MAHALITO',1],['MAHALITO',2],['GOKUENRAN',3]]){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
    const scene=previewSkillFx(key);for(const e of scene){e.design={...e.design,tier,scale:[0,.9,1.08,1.24][tier]};e.x*=w/640;e.y*=h/360;e.w*=w/640;for(const p of e.pts){p.x*=w/640;p.y*=h/360;}}
    drawBattleFx(ctx,scene,125,w,h,reduced);const pixels=ctx.getImageData(0,0,w,h).data;
    let area=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)area++;
    const corners=[3,(w-1)*4+3,((h-1)*w)*4+3,(w*h-1)*4+3].map(i=>pixels[i]);
    areas.push(area);
   }result.push({w,h,quality,reduced,areas});
  }setFxQuality('high');return result;
 }""")
 assert all(row['areas'][1]>row['areas'][0] and row['areas'][2]>row['areas'][0] for row in ranks),ranks
 (out/'fire-ranks.json').write_text(json.dumps(ranks,ensure_ascii=False,indent=2))
 # 確認画面も650msで再生を止めず、ランク3の余韻を動かす。
 page.locator('#auto').uncheck();page.locator('#sound').uncheck()
 page.locator('#skill').select_option('GOKUENRAN');page.locator('#play').click()
 page.wait_for_timeout(720)
 before=page.locator('#stage').evaluate("c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.reduce((sum,v)=>sum+v,0)")
 page.wait_for_timeout(200)
 after=page.locator('#stage').evaluate("c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.reduce((sum,v)=>sum+v,0)")
 assert before!=after,'確認画面の火柱が650msで静止している'
 # 新しい火球と爆発の素材・全ランク・終了時刻を確認する。
 thermal=page.evaluate("""async()=>{
  for(const kind of ['fireball','blast']){const image=new Image();image.src='/art/effects/'+kind+'.webp';await image.decode();if(image.naturalWidth!==768||image.naturalHeight!==384)throw Error('素材寸法');}
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
  const results=[];
  for(const quality of ['high','low'])for(const reduced of [false,true])for(const key of ['HALITO','BATTLEMAGE_GURENMASHOU','SPELLBLADE_ENTEI','TILTOWAIT','TENPENCHII','KYOKUDAI']){
   setFxQuality(quality);const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let calls=0;
   ctx.drawImage=(...args)=>{calls++;draw(...args);};const scene=previewSkillFx(key),duration=scene[0].dur;
   drawBattleFx(ctx,scene,duration*.65,640,360,reduced);const pixels=ctx.getImageData(0,0,640,360).data;let area=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>5)area++;
   if(!calls||!area)throw Error(key+'の素材が描かれていない');
   ctx.clearRect(0,0,640,360);drawBattleFx(ctx,scene,duration+1,640,360,reduced);if(ctx.getImageData(0,0,640,360).data.some(v=>v))throw Error('時間外の描画');
   results.push({key,quality,reduced,duration,area});
  }setFxQuality('high');return results;
 }""")
 (out/'thermal-ranks.json').write_text(json.dumps(thermal,ensure_ascii=False,indent=2))
 # 六系統の全18演出を、端末比率・画質・動き低減ごとに確認する。
 elemental=page.evaluate("""async()=>{
  for(const [name,w,h]of [['element-flow',768,1152],['element-minerals',256,128]]){const image=new Image();image.src='/art/effects/'+name+'.webp';await image.decode();if(image.naturalWidth!==w||image.naturalHeight!==h)throw Error('材質の寸法');}
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');
  const cases={ice:['ICENEEDLE','HYOUGA','ZETTAIREIDO'],wave:['AQUAWAVE','SPELLBLADE_SOURYUU','NECROMANCER_MEIGA'],gale:['KAMAITACHI','TORNADO','HERMIT_TENGUKAZE'],lightning:['HERO_JINRAI','RAIJIN','RAIMEIRAN'],stone:['ISHITSUBUTE','WARDEN_GANKAI','WARDEN_KANAME'],quake:['EARTHQUAKE','DAICHIWARI','METEOR']},result=[];
  for(const [w,h]of [[320,220],[640,360],[1024,600]])for(const quality of ['high','low'])for(const reduced of [false,true])for(const [family,keys]of Object.entries(cases)){
   setFxQuality(quality);const areas=[];
   for(const [index,key]of keys.entries()){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let calls=0;
    ctx.drawImage=(...args)=>{calls++;draw(...args);};const scene=previewSkillFx(key,false);
    for(const e of scene){e.x=w/2;e.y=h*.45;e.w=80;for(const p of e.pts){p.x=e.x;p.y=e.y;}}
    const dur=scene[0].dur;if(dur!==[400,700,1200][index])throw Error('表示時間');
    drawBattleFx(ctx,scene,dur*.45,w,h,reduced);const pixels=ctx.getImageData(0,0,w,h).data;let area=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>5)area++;
    if((family!=='lightning'&&!calls)||!area)throw Error(key+'の描画がない');

    ctx.clearRect(0,0,w,h);drawBattleFx(ctx,scene,dur+1,w,h,reduced);if(ctx.getImageData(0,0,w,h).data.some(v=>v))throw Error('表示時間外');areas.push(area);
   }result.push({family,w,h,quality,reduced,areas});
  }setFxQuality('high');return result;
 }""")
 assert all(row['areas'][1]>row['areas'][0] for row in elemental),elemental
 (out/'element-ranks.json').write_text(json.dumps(elemental,ensure_ascii=False,indent=2))
 page.locator('#search').fill('ヒール');assert page.locator('#skill option').count()>1
 page.locator('#search').fill('');page.locator('#family').select_option('firePillar');assert page.locator('#skill option').count()>0
 page.locator('#skill').select_option(index=0);page.locator('#play').click();page.screenshot(path=str(out/'mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'横にはみ出している'
 page.locator('#family').select_option('');page.locator('#low').check();assert page.evaluate('document.documentElement.dataset.fxLite')=='1'
 page.locator('#reduce').check();page.locator('#sound').check();page.locator('#play').click();page.locator('#sound').uncheck()
 # 探索の技は入力を塞がず、一枚だけ重ねて短く解放する。
 page.evaluate("""async()=>{const {showFieldSkillFx}=await import('/src/skill-fx-field.js'),{SPELLS}=await import('/src/skilldefs.js');const key=Object.keys(SPELLS).find(k=>SPELLS[k].kind==='field');for(let i=0;i<3;i++)showFieldSkillFx(document.querySelector('#stage'),key,SPELLS[key]);}""")
 assert page.locator('canvas[aria-hidden="true"]').count()==1
 assert page.locator('canvas[aria-hidden="true"]').evaluate("c=>c.width<=640&&c.height<=640&&c.style.pointerEvents==='none'")
 page.wait_for_timeout(450);assert page.locator('canvas[aria-hidden="true"]').count()==0
 page.locator('summary').click()
 for rate in [1,4]:
  session=c.new_cdp_session(page);session.send('Emulation.setCPUThrottlingRate',{'rate':rate})
  report=page.evaluate('async()=>await __effectsLab.audit()')
  assert report['complete'] and report['checkedSkills']==960,report
  assert all(r['visible'] and r['effects']==1 and r['targets']<=6 for r in report['rows'])
  assert report['performance']['retainedSamples']==240
  (out/f'cpu-{rate}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print('CPU',rate,'960技×通常/軽量×低減ON/OFF:',json.dumps(report['performance'],ensure_ascii=False))
  session.detach()
 with page.expect_download() as download:page.locator('#export').click()
 payload=json.loads(Path(download.value.path()).read_text());assert payload['checkedSkills']==960
 assert page.evaluate("localStorage.getItem('dos-save-v7')==='unchanged'&&localStorage.getItem('dos-cloud-auth')==='unchanged'")
 assert not any('/functions/' in u or '/rest/v1/' in u or '/auth/' in u for u in requests),requests
 assert not errors,errors
 page.wait_for_timeout(700)
 page.set_viewport_size({'width':1000,'height':800})
 page.evaluate('''async()=>{
  const {SPELLS}=await import('/src/skilldefs.js'),{SKILL_FX_CATALOG}=await import('/src/skill-fx-catalog.js');
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js'),{setFxQuality}=await import('/src/skill-fx-budget.js');setFxQuality('high');
  const grid=document.createElement('main');grid.id='review-grid';grid.style='display:grid;grid-template-columns:repeat(4,240px);gap:8px';document.body.replaceChildren(grid);
  const seen=new Set();for(const [key,sp]of Object.entries(SPELLS)){
   const family=SKILL_FX_CATALOG[key].family;if(seen.has(family))continue;seen.add(family);
   const box=document.createElement('div');box.textContent=sp.name+' / '+family;const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.style='width:240px;height:135px';box.append(canvas);grid.append(box);
   const ctx=canvas.getContext('2d');ctx.fillStyle='#25212a';ctx.fillRect(0,0,640,360);const scene=previewSkillFx(key,true);drawBattleFx(ctx,scene,90,640,360,false);
  }
 }''')
 page.screenshot(path=str(out/'families.png'),full_page=True)
 # 素材取得が失敗しても描画と進行を止めない。
 fallback=b.new_context(service_workers='block')
 fallback.route('**/art/effects/*.webp',lambda route:route.abort())
 failpage=fallback.new_page();failpage.goto('http://localhost:8000/effects-lab.html');failpage.wait_for_function('window.__effectsLab')
 assert failpage.evaluate("""async()=>{
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
  for(const key of ['MAHALITO','HALITO','TILTOWAIT','SPELLBLADE_ENTEI','KYOKUDAI','ZETTAIREIDO','NECROMANCER_MEIGA','HERMIT_TENGUKAZE','RAIMEIRAN','WARDEN_KANAME','METEOR']){ctx.clearRect(0,0,640,360);drawBattleFx(ctx,previewSkillFx(key),200,640,360,false);if(!ctx.getImageData(0,0,640,360).data.some((v,i)=>i%4===3&&v>0))return false;}return true;
 }""")
 fallback.close()
 # ブラウザの音声経路でも、火柱だけ新しいステレオ音を一度だけ鳴らす。
 sound=page.evaluate("""async()=>{
  const {Engine}=await import('/src/music/engine.js'),audio=await import('/src/audio.js');audio.initAudio();audio.setVolumes(0,1);
  const play=Engine.prototype.playBuffer,played=[];Engine.prototype.playBuffer=function(buffer,...args){played.push([buffer.duration,buffer.numberOfChannels]);return play.call(this,buffer,...args);};
  audio.SFX.skill('firePillar');audio.SFX.skill('firePillar2');audio.SFX.skill('firePillar3');audio.SFX.skill('fire');for(const family of ['fireball','blast'])for(const rank of ['',2,3])audio.SFX.skill(family+rank);Engine.prototype.playBuffer=play;return played;
 }""")
 assert len(sound)==10 and all(abs(row[0]-dur)<.001 for row,dur in zip(sound,[.4,.7,1.2,.4,.4,.7,1.2,.4,.7,1.2])) and all(row[1]==1 for row in sound),sound
 element_sound=page.evaluate("""async()=>{
  const {Engine}=await import('/src/music/engine.js'),audio=await import('/src/audio.js');audio.initAudio();audio.setVolumes(0,1);
  const play=Engine.prototype.playBuffer,heard=[];Engine.prototype.playBuffer=function(buffer,...args){heard.push([buffer.duration,buffer.numberOfChannels]);return play.call(this,buffer,...args);};
  for(const family of ['ice','wave','gale','lightning','stone','quake'])for(const rank of ['',2,3])audio.SFX.skill(family+rank);Engine.prototype.playBuffer=play;return heard;
 }""")
 assert len(element_sound)==18 and all(abs(row[0]-[.4,.7,1.2][i%3])<.001 and row[1]==1 for i,row in enumerate(element_sound)),element_sound
 # 動き低減は全系統で位置・形・濃さが時間によって変わらない。
 assert page.evaluate("""async()=>{
  const {SPELLS}=await import('/src/skilldefs.js'),{SKILL_FX_CATALOG}=await import('/src/skill-fx-catalog.js');
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d'),seen=new Set();
  for(const key of Object.keys(SPELLS)){
   const family=SKILL_FX_CATALOG[key].family;if(seen.has(family))continue;seen.add(family);
   const scene=previewSkillFx(key),frames=[];
   for(const t of [.15,.8]){ctx.clearRect(0,0,640,360);drawBattleFx(ctx,scene,scene[0].dur*t,640,360,true);frames.push(ctx.getImageData(0,0,640,360).data);}
   if(!frames[0].every((v,i)=>v===frames[1][i]))throw Error('動き低減中に形が変わった: '+key);
  }return seen.size===37;
 }""")
 # 全ランクの主音を表示尺に合わせ、オートでも同じ尺で再生する。
 ranked=page.evaluate("""async()=>{
  const {Engine}=await import('/src/music/engine.js'),audio=await import('/src/audio.js');audio.initAudio();audio.setVolumes(0,1);
  const play=Engine.prototype.playBuffer,heard=[];Engine.prototype.playBuffer=function(buffer,options){heard.push({duration:buffer.duration,rate:options.rate});return play.call(this,buffer,options);};
  for(const kind of ['slash','impact','pierce','restore','ward','shade','firePillar3','ice3'])for(const rank of [1,2,3,5])for(const speed of [1,.6,.8]){
   const base=rank===1?400:rank===2?700:1200;audio.SFX.skill(kind,{rank,duration:base*speed});
  }Engine.prototype.playBuffer=play;return heard;
 }""")
 assert len(ranked)==96
 for i,row in enumerate(ranked):
  rank=[1,2,3,5][(i//3)%4];speed=[1,.6,.8][i%3]
  assert abs(row['duration']/row['rate']-(.4 if rank==1 else .7 if rank==2 else 1.2)*speed)<.001,row
 c.close();b.close()
 print('検索・全技再生・描画検証・計測書出し・保存/認証不変・通信なしを確認。',out)
