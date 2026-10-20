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
      const examples=[['w50',480,320,{}],['w51',480,320,{}],['w52',360,480,{elite:true}],['w53',360,480,{boss:true}],['ws28',480,320,{}],['ws29',480,320,{}]];
      const box=document.createElement('div');box.style='display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap';document.body.replaceChildren(box);
      for(const [id,w,h,opts] of examples){const cv=document.createElement('canvas');cv.width=w;cv.height=h;box.append(cv);const ctx=cv.getContext('2d');draw(ctx,w,h,{dungeonId:id,...opts});await new Promise(r=>setTimeout(r,100));drawBattleBackdrop(ctx,w,h,1,0,{dungeonId:id,...opts});}
      return {count:Object.keys(BATTLE_BACKGROUNDS).length,world:WORLD.length,missing,failures,sizes};
    }''')
    page.screenshot(path=str(out/'browser-preview.png'),full_page=True)
    # 通信失敗時は旧情景へ戻さず、暗い幕を保持する。
    blocked=browser.new_page()
    blocked.route('**/art/battle/**',lambda route:route.abort())
    blocked.goto('http://127.0.0.1:8765/docs/art/battle-backgrounds/review.html')
    result['fallback']=blocked.evaluate('''async()=>{const {drawIllustratedBattleBackdrop:draw}=await import('/src/battlebackgrounds.js');const c=document.createElement('canvas');c.width=480;c.height=320;const g=c.getContext('2d');draw(g,480,320,{dungeonId:'w50'});await new Promise(r=>setTimeout(r,100));draw(g,480,320,{dungeonId:'w50'});return g.getImageData(0,0,480,320).data.every((v,i)=>v===[8,10,16,255][i%4]);}''')
    result['pageErrors']=errors
    result['battles']=[]
    battle_context=browser.new_context(service_workers='block')
    # 大量の原画を初回取得する検査環境では起動監視だけ待ち時間を延ばす。
    battle_context.add_init_script("const originalTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>originalTimeout(fn,ms===5000 && String(fn).includes('起動がタイムアウト') ? 60000 : ms,...args);")
    for id,width,height in [('w50',390,844),('w51',1280,900),('w52',390,844),('w53',390,844),('ws28',1280,900),('ws29',390,844)]:
        battle=battle_context.new_page()
        battle.set_viewport_size({'width':width,'height':height})
        battle.add_init_script('performance.setResourceTimingBufferSize(10000)')
        battle_errors=[]
        battle.on('pageerror',lambda e:battle_errors.append(str(e)))
        battle.goto(f'http://127.0.0.1:8765/?testDungeon={id}&testFloor=1',wait_until='domcontentloaded')
        battle.wait_for_function("window.__game && __game.G && __game.G.state === 'board'")
        battle.evaluate("""async()=>{(await import('/src/ui/kit.js')).sheet.closeAll();const t=__game;t.G.autoCombat=false;t.G.autoMove=false;t.G.prompt=false;t.G.anim=false;t.G.heroAnim=null;t.G.flipAnim=null;t.G.walking=false;const key=t.activeCfg().bands[0][0];t.startBattle(t.spawnCardEnemies(key,1,1,{min:1}),null);}""")
        battle.wait_for_function("id => performance.getEntriesByType('resource').some(r => r.name.endsWith('/art/battle/'+id+'.webp'))", arg=id, timeout=20000)
        battle.wait_for_timeout(1000)
        status=battle.evaluate("""()=>({state:__game.G.state,id:__game.activeCfg().id,loaded:performance.getEntriesByType('resource').filter(r=>r.name.includes('/art/battle/')).map(r=>r.name.split('/').pop())})""")
        assert battle.get_by_text('⚠ 読み込みに失敗しました', exact=True).count()==0
        battle.screenshot(path=str(out/f'battle-{id}.png'),full_page=True)
        print(f'{id}: 実戦表示OK', flush=True)
        assert status['state']=='combat' and status['id']==id and id+'.webp' in status['loaded'] and not battle_errors,(status,battle_errors)
        result['battles'].append(status)
        battle.close()
    browser.close()
server.shutdown()
(out/'checks.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['count']==result['world']+1 and not result['missing'] and not result['failures'] and not errors and result['fallback'],result
print(json.dumps({k:v for k,v in result.items() if k!='sizes'}))
