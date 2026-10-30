"""実API/SQLでオート勝利後の宝箱操作関数を含む保存・再開を確かめる。"""
from pathlib import Path
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
        c=browser.new_context(viewport={'width':390,'height':844},service_workers='block',reduced_motion='no-preference')
        c.request.post('http://127.0.0.1:8002/test/reset')
        c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
        
        actions,commands,errors=[],[],[]
        measuring={'on':False,'hold':bool(os.environ.get('DOS_CRASH_RECOVERY'))}
        held=[]
        def api(route):
            u=urlparse(route.request.url)
            body=route.request.post_data_json if route.request.method=='POST' else None
            if measuring['on'] and body:
                time.sleep(float(os.environ.get('DOS_TURN_DELAY', '.25')) if body.get('op')=='turn' else .25)
                commands.append(body)
                if measuring['hold'] and body.get('op')=='save':
                    held.append(route);return
                if body['op']=='turn' or body['op']=='battle' and body['action']!='advance':actions.append(time.monotonic())
            response=route.fetch(url='http://127.0.0.1:8002'+u.path+('?' + u.query if u.query else ''))
            if legacy and body and body.get('op')=='claim':
                value=response.json();value.pop('battleTurn',None);route.fulfill(json=value)
            else:route.fulfill(response=response)
        c.route('https://cloud.test/**',api)
        source=Path('src/game.js').read_text().replace('window.__game = { G,','window.__game = { fxTest: { animateResult, renderCombatCanvas, endBattle }, G,',1)
        c.route('**/src/game.js',lambda r:r.fulfill(content_type='application/javascript',body=source))
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

        page.evaluate("""()=>{const g=__game.G;g.battle.enemies.push(...__game.spawnCardEnemies('bs_bonepile',1,1));g.autoCombat=true;g.fastAnim=true;__game.fxTest.renderCombatCanvas();}""")
        for skill,all_targets,kind in [('DIOS',False,'heal'),('DIALALL',True,'heal'),('KOUBOUITTAI',False,'buff'),('SEIIKINOKANE',False,'buff'),('HALITO',False,'atk'),('MAHALITO',True,'atk')]:
            result=page.evaluate("""async({skill,allTargets,kind})=>{
              const {SPELLS}=await import('/src/combat.js');const g=__game.G;
              const targets=kind==='atk'?(allTargets?g.battle.enemies:[g.battle.enemies[0]]):(allTargets?g.party:[g.party[1]]);
              const hits=targets.map(target=>({target,...(kind==='heal'?{heal:12}:kind==='buff'?{buff:true,mods:{atk:1}}:{dmg:12})}));
              const res={action:'spell',side:'party',actor:g.party[0],spellKey:skill,spellName:SPELLS[skill].name,spellKind:kind,spellElement:SPELLS[skill].element,hits};
              __game.fxTest.animateResult(res,()=>{});
              return g.fx.skill.map(e=>({type:e.type,x:e.x,dur:e.dur}));
            }""",{'skill':skill,'allTargets':all_targets,'kind':kind})
            wide={'blessing','field','fieldhex','sig_dialall','sig_kane','sig_kouboui'}
            assert any(e['dur']>=250 for e in result),result
            if not all_targets:assert not any(e['type'] in wide for e in result),(skill,result)
            else:assert any(e['type'] in wide for e in result),(skill,result)
            page.wait_for_timeout(100)
            assert page.evaluate('!!__game.G.fx')
            if kind in ['heal','buff']:
                assert page.locator('.pc-fx').count()==(4 if all_targets else 1),(skill,page.locator('.pc-fx').count())
            if skill in ['DIOS','DIALALL','HALITO','MAHALITO']:page.screenshot(path='/tmp/dos-fx-'+skill+'.png')
            print('オート演出',skill,result,flush=True)
            page.wait_for_timeout(450)
        page.evaluate('window.originalWeapon=__game.G.party[0].equip.weapon')
        for cat,magic,expected in [('ls',False,'slash'),('dg',False,'cross'),('kt',False,'iai'),('sp',False,'thrust'),('ax',False,'smash'),('st',False,'blunt'),('bw',False,'arrow'),('ls',True,'arcane')]:
            actual=page.evaluate("""({cat,magic})=>{
              const g=__game.G,actor=g.party[0];actor.equip.weapon={cat,magic};
              __game.fxTest.animateResult({action:'attack',side:'party',actor,hits:[{target:g.battle.enemies[0],dmg:12,magic}]},()=>{});
              return g.fx.slashes.length?'slash':g.fx.skill[0].type;
            }""",{'cat':cat,'magic':magic})
            assert actual==expected,(cat,magic,actual)
            page.wait_for_timeout(100)
            if expected in ['slash','smash','arcane']:page.screenshot(path='/tmp/dos-fx-'+expected+'.png')
            page.wait_for_timeout(450)
        page.evaluate('__game.G.party[0].equip.weapon=originalWeapon')
        # 最後の一撃から戦果へ切り替わるまで、実際のオートの経路で測る。
        page.evaluate("""()=>{
          const g=__game.G;g.autoCombat=false;g.fx=null;g.animating=false;g.battle.cancelTarget();
          for(const e of g.battle.enemies){e.hp=1;e.vit=0;}
          window.killAt=null;window.resultDelay=null;
          const watch=()=>{if(g.battle?.result==='win'&&killAt===null)killAt=performance.now();if(g.pendingResults){resultDelay=performance.now()-killAt;return;}requestAnimationFrame(watch);};
          requestAnimationFrame(watch);g.autoCombat=true;__game.world.resumeFromState();
        }""")
        page.wait_for_function('window.resultDelay!==null',timeout=15000)
        delay=page.evaluate('resultDelay');assert 950<=delay<1800,delay
        print('最後の撃破→戦果 ms',delay,flush=True)
        assert not page.locator('details.bp').get_attribute('open')
        assert not page.locator('.bp-member').first.is_visible()
        page.locator('details.bp > summary').click()
        assert page.locator('.bp-member').first.is_visible()
        page.evaluate("async()=>{await __game.autosave(true);await (await import('/src/cloud-save.js')).cloudFlush()}")
        assert page.locator('.cloud-gate').is_hidden()
        assert not errors,errors
        c.unroute_all(behavior='ignoreErrors');c.close()
    browser.close()
