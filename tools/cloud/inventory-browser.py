"""大きな共通の袋を持つ戦闘の対象選択・行動・再起動で個数と操作を保つ。検証用APIが必要。"""
"""実Edge Function/SQLに250msの通信遅延を加え、従来方式と一括戦闘を比較する。"""
import os
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
        c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
        c.request.post('http://127.0.0.1:8002/test/reset')
        c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
        
        actions,commands,errors=[],[],[]
        measuring={'on':False}
        def api(route):
            u=urlparse(route.request.url)
            body=route.request.post_data_json if route.request.method=='POST' else None
            if measuring['on'] and body:
                time.sleep(float(os.environ.get('DOS_TURN_DELAY', '.25')) if body.get('op')=='turn' else .25)
                commands.append(body)
                if body['op']=='turn' or body['op']=='battle' and body['action']!='advance':actions.append(time.monotonic())
            response=route.fetch(url='http://127.0.0.1:8002'+u.path+('?' + u.query if u.query else ''))
            if legacy and body and body.get('op')=='claim':
                value=response.json();value.pop('battleTurn',None);route.fulfill(json=value)
            else:route.fulfill(response=response)
        c.route('https://cloud.test/**',api)
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

        measuring['on']=True
        page.evaluate("()=>{const b=__game.G.battle;if(b.phase==='target')b.chooseTarget(b.targetOptions()[0]);__game.world.resumeFromState();}")
        page.wait_for_function("__game.G.battle.phase==='input' && !__game.G.animating", timeout=55000)
        assert len(actions)==1, len(actions)
        print('acted',page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,animating:__game.G.animating,inventory:__game.G.inventory.length,booting:document.body.className,gate:document.querySelector('.cloud-gate')?.hidden,buttons:document.querySelectorAll('#combat-menu button').length})"),errors,flush=True)

        page.evaluate("async()=>{await __game.autosave(true);await (await import('/src/cloud-save.js')).cloudFlush()}")
        page.reload()
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.wait_for_timeout(15000)
        print('reloaded',page.evaluate("({state:__game.G.state,phase:__game.G.battle?.phase,anim:__game.G.animating,n:__game.G.inventory.length,cls:document.body.className,gate:document.querySelector('.cloud-gate')?.hidden,detail:document.querySelector('.cloud-gate')?.innerText})"),errors,flush=True)
        assert page.evaluate("__game.G.state==='combat' && __game.G.battle.phase==='input' && !__game.G.animating && __game.G.inventory.length===6561")
        assert not errors,errors
        print('大きな既存記録: 行動後の再起動から再開 OK',flush=True)
        c.unroute_all(behavior='ignoreErrors');c.close()
    browser.close()
