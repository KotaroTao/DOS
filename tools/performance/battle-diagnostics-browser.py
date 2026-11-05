"""実設定画面から実行版・戦闘・音声の遅延情報を読めることを確認。"""
import os,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=b.new_page(service_workers='block',viewport={'width':1024,'height':1366},device_scale_factor=2)
 page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
 page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town',wait_until='domcontentloaded')
 page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
 page.evaluate('''async()=>{
 const audio=await import('/src/audio.js');audio.initAudio();audio.setVolumes(0,1);
 audio.SFX.warmSkill('heal',{rank:1,duration:400});
 await new Promise(r=>setTimeout(r,200));
 const until=performance.now()+450;while(performance.now()<until){} // 診断に遅延が残るか検査する。
 await new Promise(r=>setTimeout(r,100));
 const fx=await import('/src/skill-fx-budget.js');fx.resetFxPerformance();const token={};for(let i=0;i<120;i++)fx.battlePaintDue(i*1000/120,token);
 fx.recordBattleFrame(0,false);fx.recordBattleFrame(0,true);fx.recordBattleFrame(55,true);
 (await import('/src/ui/ctx.js')).UI.settingsSheet({});
 }''')
 page.get_by_role('button',name='音声の診断情報を表示',exact=True).click()
 info=json.loads(page.get_by_role('textbox',name='音声の診断情報',exact=True).input_value())
 assert info['version']=='dos-dev' and info['viewport']['width']==1024,info
 assert info['combat']['paintedFrames']==60 and info['combat']['skippedPaints']==60,info
 assert info['combat']['displayFrames']['maxGapMs']>=55,info
 assert info['scheduler']['lateTicks']>=1 and info['scheduler']['maxGapMs']>=360,info
 assert info['sfx']['builds']>0 and info['materials']['runtimePixelConversions']==0,info
 print({'version':info['version'],'viewport':info['viewport'],'combat':info['combat']['displayFrames'],'scheduler':info['scheduler'],'sfxBuilds':info['sfx']['builds']})
 b.close()
