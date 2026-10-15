import json, threading, functools
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
out=root/'docs/art/battle-backgrounds'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/docs/art/battle-backgrounds/review.html')
    result=page.evaluate('''async () => {
      const {BATTLE_BACKGROUNDS,drawIllustratedBattleBackdrop:draw} = await import('/src/battlebackgrounds.js');
      const {WORLD}=await import('/src/dungeons/world.js');
      const {drawBattleBackdrop}=await import('/src/backdrops.js');
      const missing=WORLD.filter(d=>!BATTLE_BACKGROUNDS[d.id]).map(d=>d.id);
      const failures=[]; const sizes=[];
      const c=document.createElement('canvas');c.width=480;c.height=320;
      const g=c.getContext('2d');
      for(const [id,path] of Object.entries(BATTLE_BACKGROUNDS)) {
        const im=new Image();im.src='/'+path;
        await im.decode().catch(()=>failures.push(id));
        sizes.push([id,im.naturalWidth,im.naturalHeight]);
        draw(g,480,320,{dungeonId:id});
        let ok=false;
        for(let i=0;i<100;i++) {await new Promise(r=>setTimeout(r,10));if(draw(g,480,320,{dungeonId:id})){ok=true;break;}}
        if(!ok) failures.push('draw:'+id);
      }
      const examples=[['w01',480,320,{}],['w24',360,480,{boss:true}],['ws17',480,320,{elite:true}],['w45',360,480,{}]];
      const box=document.createElement('div');box.style='display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap';document.body.replaceChildren(box);
      for(const [id,w,h,opts] of examples){const cv=document.createElement('canvas');cv.width=w;cv.height=h;box.append(cv);const ctx=cv.getContext('2d');draw(ctx,w,h,{dungeonId:id,...opts});await new Promise(r=>setTimeout(r,100));drawBattleBackdrop(ctx,w,h,1,0,{dungeonId:id,...opts});}
      return {count:Object.keys(BATTLE_BACKGROUNDS).length,world:WORLD.length,missing,failures,sizes};
    }''')
    page.screenshot(path=str(out/'browser-preview.png'),full_page=True)
    # 通信失敗でも既存情景を描けることを別ページで確認。
    blocked=browser.new_page()
    blocked.route('**/art/battle/**',lambda route:route.abort())
    blocked.goto('http://127.0.0.1:8765/docs/art/battle-backgrounds/review.html')
    result['fallback']=blocked.evaluate('''async()=>{const {drawBattleBackdrop}=await import('/src/backdrops.js');const c=document.createElement('canvas');c.width=480;c.height=320;const g=c.getContext('2d');drawBattleBackdrop(g,480,320,1,0,{dungeonId:'w01'});await new Promise(r=>setTimeout(r,100));drawBattleBackdrop(g,480,320,1,0,{dungeonId:'w01'});return g.getImageData(0,0,480,320).data.some((v,i)=>i%4!==3&&v>0);}''')
    result['pageErrors']=errors
    result['battles']=[]
    for id,width,height in [('w01',390,844),('w12',1280,900),('w24',390,844),('w45',390,844)]:
        battle=browser.new_page(viewport={'width':width,'height':height},service_workers='block')
        battle.add_init_script('performance.setResourceTimingBufferSize(10000)')
        battle_errors=[]
        battle.on('pageerror',lambda e:battle_errors.append(str(e)))
        def expose(route):
            response=route.fetch()
            route.fulfill(response=response,body=response.text()+'\nwindow.backgroundReview={G,activeCfg,spawnCardEnemies,startBattle};')
        battle.route('**/src/game.js*',expose)
        battle.goto(f'http://127.0.0.1:8765/?testDungeon={id}&testFloor=1',wait_until='domcontentloaded')
        battle.wait_for_function("window.backgroundReview && backgroundReview.G.state === 'board'")
        battle.evaluate("""()=>{const t=backgroundReview;t.G.prompt=false;t.G.anim=false;t.G.heroAnim=null;t.G.flipAnim=null;t.G.walking=false;const key=t.activeCfg().bands[0][0];t.startBattle(t.spawnCardEnemies(key,1,1,{min:1}),null);}""")
        battle.wait_for_timeout(3000)
        status=battle.evaluate("""()=>({state:backgroundReview.G.state,id:backgroundReview.activeCfg().id,loaded:performance.getEntriesByType('resource').filter(r=>r.name.includes('/art/battle/')).map(r=>r.name.split('/').pop())})""")
        battle.screenshot(path=str(out/f'battle-{id}.png'),full_page=True)
        assert status['state']=='combat' and status['id']==id and id+'.webp' in status['loaded'] and not battle_errors,(status,battle_errors)
        result['battles'].append(status)
        battle.close()
    browser.close()
server.shutdown()
(out/'checks.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['count']==result['world']+1 and not result['missing'] and not result['failures'] and not errors and result['fallback'],result
print(json.dumps({k:v for k,v in result.items() if k!='sizes'}))
