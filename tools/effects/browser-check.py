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
   ctx.drawImage=(...args)=>{calls++;draw(...args);};drawBattleFx(ctx,previewSkillFx('MAHALITO'),125,640,360,reduced);
   results.push(calls);
  }setFxQuality('high');return {width:image.naturalWidth,height:image.naturalHeight,calls:results};
 }""")
 assert texture=={'width':768,'height':576,'calls':[10,3,3]},texture
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
 fallback.route('**/art/effects/fire-pillar.webp',lambda route:route.abort())
 failpage=fallback.new_page();failpage.goto('http://localhost:8000/effects-lab.html');failpage.wait_for_function('window.__effectsLab')
 assert failpage.evaluate("""async()=>{
  const {previewSkillFx}=await import('/src/skill-fx-preview.js'),{drawBattleFx}=await import('/src/battlefx.js');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
  drawBattleFx(ctx,previewSkillFx('MAHALITO'),125,640,360,false);
  return ctx.getImageData(0,0,640,360).data.some((v,i)=>i%4===3&&v>0);
 }""")
 fallback.close()
 # ブラウザの音声経路でも、火柱だけ新しいステレオ音を一度だけ鳴らす。
 sound=page.evaluate("""async()=>{
  const {Engine}=await import('/src/music/engine.js'),audio=await import('/src/audio.js');audio.initAudio();audio.setVolumes(0,1);
  const play=Engine.prototype.playBuffer,played=[];Engine.prototype.playBuffer=function(buffer,...args){played.push([buffer.duration,buffer.numberOfChannels]);return play.call(this,buffer,...args);};
  audio.SFX.skill('firePillar');audio.SFX.skill('fire');Engine.prototype.playBuffer=play;return played;
 }""")
 assert len(sound)==2 and abs(sound[0][0]-.68)<.001 and sound[0][1]==2 and abs(sound[1][0]-.26)<.001,sound
 c.close();b.close()
 print('検索・全技再生・描画検証・計測書出し・保存/認証不変・通信なしを確認。',out)
