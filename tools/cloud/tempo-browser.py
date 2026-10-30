"""実Edge Function/SQLに250msの通信遅延を加え、従来方式と一括戦闘を比較する。"""
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
    for legacy in [True,False]:
        c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
        c.request.post('http://127.0.0.1:8002/test/reset')
        c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
        c.route(re.compile(r'\.(webp|png|jpg)(\?.*)?$'),lambda r:r.fulfill(content_type='image/png',body=PIXEL))
        actions,commands,errors=[],[],[]
        measuring={'on':False}
        def api(route):
            u=urlparse(route.request.url)
            body=route.request.post_data_json if route.request.method=='POST' else None
            if measuring['on'] and body:
                time.sleep(.25)
                commands.append(body)
                if body['op']=='turn' or body['op']=='battle' and body['action']!='advance':actions.append(time.monotonic())
            response=route.fetch(url='http://127.0.0.1:8002'+u.path+('?' + u.query if u.query else ''))
            if body and body.get('op')=='claim':
                value=response.json();value.pop('backgroundBattle',None)
                if legacy:value.pop('battleTurn',None)
                route.fulfill(json=value)
            else:route.fulfill(response=response)
        c.route('https://cloud.test/**',api)
        page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(GAME+'?testDungeon=w45&testPlace=town')
        page.wait_for_function("window.__game?.G.party.length && !document.body.classList.contains('booting')")
        page.evaluate('''async()=>{
          const {Battle}=await import('/src/combat.js');
          const {reseedRng,rngState}=await import('/src/rng.js');reseedRng(1234);
          const api=__game,g=api.G;
          const hero=Object.assign(api.ev.makeDoll('速度の検証'),{hp:100000,maxhp:100000,atk:5000,vit:100,agi:1000,tactic:'blade'});
          const foe=api.spawnCardEnemies('bs_ghoul',1,1)[0];
          Object.assign(foe,{hp:50000,maxhp:50000,atk:1,vit:1,agi:1,ability:null});
          g.party=[hero];g.reserve=[];g.souls=[];g.rng=rngState();g.state='combat';g.fastAnim=true;
          g.battle=new Battle(g.party,[foe],()=>{});g.run={gold:0,soulPts:0,items:[],souls:[],ev:{}};
          const cloud=await import('/src/cloud-save.js');
          const {LEGAL_VERSION}=await import('/src/legal.js');
          localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:true}}));
          localStorage.setItem('dos-legal-version:11111111-1111-4111-8111-111111111111',LEGAL_VERSION);
          await cloud.connectCloud(null);
          await cloud.cloudSave(JSON.parse(api.inf.saveJSON()));
        }''')
        page.goto(GAME)
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.locator('#combat-menu .cmd-auto').first.wait_for()
        page.wait_for_function("!document.querySelector('.ttl-overlay')")
        page.evaluate('''()=>{
          const a=__game.G.party[0];Object.assign(a,{hp:100000,maxhp:100000,atk:5000,vit:1000,agi:1000,wScale:null,passiveMap:{},gearMisc:{},tactic:'blade'});
          const e=__game.G.battle.enemies[0];Object.assign(e,{atk:1,vit:1,hp:50000,maxhp:50000,agi:1});
        }''')
        measuring['on']=True
        page.locator('#combat-menu .cmd-auto').first.click()
        until=time.monotonic()+25
        while len(actions)<8 and time.monotonic()<until:page.wait_for_timeout(100)
        assert len(actions)>=8,(len(actions),errors,page.evaluate("({phase:__game.G.battle?.phase,acted:__game.G.battle?._acted,auto:__game.G.autoCombat,anim:__game.G.animating,round:__game.G.battle?._roundNo,hp:__game.G.party[0].hp,enemy:__game.G.battle?.enemies[0].hp,log:__game.logHistory().slice(-6)})"),[b['op'] for b in commands])
        duration=(actions[7]-actions[0])/7
        timings[legacy]=duration
        if not legacy:
            assert all(b['op']!='battle' for b in commands),[b['op'] for b in commands]
        assert not errors,errors
        print(('従来方式' if legacy else '一括確定')+f': 250ms遅延で平均 {duration*1000:.0f}ms/行動、8行動継続 OK（要求: '+','.join(b['op'] for b in commands)+'）',flush=True)
        c.unroute_all(behavior="ignoreErrors")
        c.close()
    assert timings[False]<timings[True]*.8,timings
    print(f'行動間隔を {(1-timings[False]/timings[True])*100:.0f}% 短縮（この検証環境での測定）',flush=True)
    browser.close()
