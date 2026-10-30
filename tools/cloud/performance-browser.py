"""実API/SQLの検証用サーバーで、6561品・CPU4倍低速の行動を500ms以内に収める。"""
import os
import subprocess
import base64
import json
import re
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

GAME='http://127.0.0.1:8001/'
CONFIG='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
PIXEL=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII=')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    timings={}
    for legacy in [False]:
        c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='no-preference')
        c.request.post('http://127.0.0.1:8002/test/reset')
        c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
        
        actions,commands,errors=[],[],[]
        measuring={'on':False}
        def api(route):
            u=urlparse(route.request.url)
            body=route.request.post_data_json if route.request.method=='POST' else None
            if measuring['on'] and body:
                time.sleep(float(os.environ.get('DOS_SAVE_DELAY', '.25')) if body.get('op')=='save' else float(os.environ.get('DOS_TURN_DELAY', '.25')))
                commands.append(body)
                if body['op']=='turn' or body['op']=='battle' and body['action']!='advance':actions.append(time.monotonic())
            started=time.monotonic()
            response=route.fetch(url='http://127.0.0.1:8002'+u.path+('?' + u.query if u.query else ''))
            if measuring['on']:print('api',body.get('op') if body else '',round(time.monotonic()-started,3),'bytes',len(response.body()),flush=True)
            if legacy and body and body.get('op')=='claim':
                value=response.json();value.pop('battleTurn',None);route.fulfill(json=value)
            else:route.fulfill(response=response)
        c.route('https://cloud.test/**',api)
        if os.environ.get('DOS_BASELINE'):
            for path in ['src/game.js','src/cloud-save.js','src/savegraph.js','src/ui/party.js','src/autoequip.js']:
                source=subprocess.check_output(['git','show','origin/main:'+path],text=True)
                c.route('**/'+path,lambda r,req,source=source:r.fulfill(content_type='text/javascript',body=source))
        page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));
        page.goto(GAME+'?testDungeon=w01')
        page.wait_for_function("window.__game?.G.board && !document.body.classList.contains('booting')")
        snapshot=page.evaluate("""async()=>{
          const {Battle}=await import('/src/combat.js');
          const {ITEMS}=await import('/src/items.js');
          const g=__game.G;
          g.party=g.party.slice(0,4);g.reserve=[];
          g.inventory=Array.from({length:6561},()=>({...ITEMS.u_styptic_salve}));
          for(const p of g.party){p.items=g.inventory;p.hp=50000;p.maxhp=100000;p.mp=100;p.agi=1000;}
          g.run={gold:0,soulPts:0,items:[{owner:g.party[0],item:g.inventory[0]}],souls:[],ev:{}};
          const foe=__game.spawnCardEnemies('bs_bonepile',1,1)[0];
          Object.assign(foe,{hp:100000,maxhp:100000,atk:1,agi:1,ability:null});
          g.state='combat';g.battle=new Battle(g.party,[foe],()=>{});
          g.battle.chooseAction('spell','DIOS');
          return JSON.parse(__game.inf.saveJSON());
        }""")
        page.evaluate("""async snap=>{
          const cloud=await import('/src/cloud-save.js');
          const {LEGAL_VERSION}=await import('/src/legal.js');
          localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:true}}));
          localStorage.setItem('dos-legal-version:11111111-1111-4111-8111-111111111111',LEGAL_VERSION);
          await cloud.connectCloud(null);await cloud.cloudSave(snap);
        }""",snapshot)
        page.goto(GAME)
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.wait_for_timeout(6000)
        print('loaded',page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,animating:__game.G.animating,inventory:__game.G.inventory.length,booting:document.body.className,gate:document.querySelector('.cloud-gate')?.hidden,buttons:document.querySelectorAll('#combat-menu button').length})"),errors,flush=True)

        page.evaluate("""()=>{for(const p of __game.G.party){p.hp=Math.max(1,Math.floor(p.maxhp/2));p.mp=p.maxmp;}__game.world.resumeFromState();}""")
        profiler=c.new_cdp_session(page)
        profiler.send('Emulation.setCPUThrottlingRate', {'rate':4})
        measuring['on']=True
        page.evaluate("""()=>{
          window.actionMs=null;const b=__game.G.battle;
          if(!b.targetOptions().length)throw Error('ヒールの対象がいない');
          window.healTarget=b.targetOptions()[0];window.beforeHP=healTarget.hp;
          const t=performance.now();
          const watch=()=>{if(b.phase==='input'&&!__game.G.animating)window.actionMs=performance.now()-t;else requestAnimationFrame(watch);};
          document.querySelector('#combat-menu button').click();requestAnimationFrame(watch);
        }""")
        page.wait_for_function("window.actionMs!==null",timeout=55000)
        elapsed=page.evaluate('actionMs')
        print('battle_ms',elapsed,'request_bytes',max((len(json.dumps(x,ensure_ascii=False).encode()) for x in commands),default=0),flush=True)
        assert page.evaluate('healTarget.hp>beforeHP'),'ヒールが反映されない'
        if not os.environ.get('DOS_BASELINE'):
            assert len(actions)==0,len(actions)
            assert elapsed<500,elapsed
        print('acted',page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,animating:__game.G.animating,inventory:__game.G.inventory.length,booting:document.body.className,gate:document.querySelector('.cloud-gate')?.hidden,buttons:document.querySelectorAll('#combat-menu button').length})"),errors,flush=True)

        page.evaluate("async()=>{await __game.autosave(true);await (await import('/src/cloud-save.js')).cloudFlush()}")
        page.reload()
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.wait_for_timeout(15000)
        print('reloaded',page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,anim:__game.G.animating,n:__game.G.inventory.length,cls:document.body.className,gate:document.querySelector('.cloud-gate')?.hidden,detail:document.querySelector('.cloud-gate')?.innerText})"),errors,flush=True)
        assert page.evaluate("__game.G.state==='combat' && __game.G.battle.phase==='input' && !__game.G.animating && __game.G.inventory.length===6561")
        assert not errors,errors
        print('大きな既存記録: 行動後の再起動から再開 OK',flush=True)
        if os.environ.get('DOS_AUTO_PERF'):
            page.evaluate("""()=>{
              const g=__game.G,b=g.battle,advance=b.advance;window.autoTimes=[];
              b.advance=function(){const r=advance.call(this);autoTimes.push(performance.now());if(autoTimes.length>=13)g.autoCombat=false;return r;};
              g.autoCombat=true;__game.world.resumeFromState();
            }""")
            page.wait_for_function('autoTimes.length>=13',timeout=20000)
            samples=page.evaluate('autoTimes.slice(1).map((t,i)=>t-autoTimes[i])')
            print('auto_action_ms',samples,flush=True)
            assert max(samples)<500,samples
            page.evaluate("async()=>{await (await import('/src/cloud-save.js')).cloudFlush()}")
        result=page.evaluate("""async()=>{
          const g=__game.G;g.state='board';g.battle=null;g.animating=false;
          const cloud=await import('/src/cloud-save.js');
          await cloud.cloudFlush();
          const original=window.fetch;let largest=0;
          window.fetch=async(url,opts)=>{
            const b=opts?.body&&JSON.parse(opts.body);
            if(b?.op==='save') {largest=Math.max(largest,new TextEncoder().encode(opts.body).length);await new Promise(r=>setTimeout(r,200));return Response.json({revision:b.revision+1});}
            return original(url,opts);
          };
          const timings=[];
          for(let i=0;i<10;i++){
            g.gold++;const t=performance.now();__game.autosave(true);timings.push(performance.now()-t);
            await new Promise(r=>setTimeout(r,100));
          }
          await cloud.cloudFlush();
          for(let y=0;y<__game.ROWS;y++)for(let x=0;x<__game.COLS;x++){
            const cell=g.board.cells[y][x];cell.type='empty';cell.revealed=true;cell.visited=true;
            cell.walls={n:y===0,s:y===__game.ROWS-1,w:x===0,e:x===__game.COLS-1};
          }
          g.px=2;g.py=2;g.prompt=false;g.anim=null;
          __game.inf.renderBoard();
          const steps=[];
          for(const [x,y] of [[3,2],[3,3],[2,3],[2,2],[3,2]]){
            const t=performance.now();await new Promise(done=>__game.autoMove.moveStep(x,y,done));steps.push(performance.now()-t);
          }
          await cloud.cloudFlush();
          window.fetch=original;
          return {saveCallMs:timings,max:Math.max(...timings),mean:timings.reduce((a,b)=>a+b)/timings.length,largest,stepMs:steps};
        }""")
        print('movement_save_cost',json.dumps(result),flush=True)
        if not os.environ.get('DOS_BASELINE'):
            assert result['largest']<600000,result
            assert result['max']<120,result
            assert max(result['stepMs'])<500,result
        c.unroute_all(behavior='ignoreErrors');c.close()
    browser.close()
