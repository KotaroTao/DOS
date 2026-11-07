"""無限迷宮の通常敵・強敵・主のサイズを攻撃結果の復元前後で確認する。"""
import os, runpy
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('DOS_TEST_BASE','http://localhost:8000/')
fixture=runpy.run_path(str(ROOT/'tools/cloud/choice-bench/trial-browser.py'))
def stub_art(route):
    key=route.request.url.rsplit('/',1)[-1].split('.')[0]
    size=fixture['MONSTER_SIZES'].get(key,(2,2)) if '/monsters/' in route.request.url else (2,2)
    if '/art/dungeon/' in route.request.url:size=(1254,1254) if key=='crypt-walker' else (1536,1024)
    if any('/art/'+part+'/' in route.request.url for part in ['items','collectibles','treasury']):size=(384,384)
    if any('/art/'+part+'/' in route.request.url for part in ['misc','offerings']):size=(320,320)
    route.fulfill(content_type='image/png',body=fixture['placeholder'](*size))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
    context=browser.new_context(service_workers='block',reduced_motion='reduce')
    context.route('**/art/**',stub_art)
    context.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
    def expose_draw(route):
        response=route.fetch()
        route.fulfill(response=response,body=response.text()+'\nwindow.__renderCombatCanvas=renderCombatCanvas;')
    context.route('**/src/game.js',expose_draw)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'?testInf=5&testInfLv=6',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.board && !document.body.classList.contains("game-starting") && !document.querySelector(".ttl-overlay")')
    for width,height in [(390,844),(820,1180),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(200)
        result=page.evaluate('''async()=>{
          const {Battle}=await import('/src/combat.js'),{resolveCloudBattle}=await import('/src/cloud-battle.js');
          const {refSerialize,refDeserialize,applySavePatch}=await import('/src/savegraph.js');
          const {reseedRng,rngState}=await import('/src/rng.js'),{sheet}=await import('/src/ui/kit.js');
          const G=__game.G,inf=__game.inf,key='bs_bonepile',sizes={};sheet.closeAll();G.prompt=false;G.autoCombat=false;
          for(const kind of ['normal','elite','boss']){
            reseedRng(42);G.rng=rngState();
            const foe=(kind==='normal'?inf.spawnCardEnemies(key,1,1):kind==='elite'?inf.infEliteFoes(key):inf.infBossFoes(key))[0];
            Object.assign(foe,{hp:100000,maxhp:100000,agi:1,atk:1,ability:null,asleep:true});
            for(const d of G.party)Object.assign(d,{alive:true,hp:100000,maxhp:100000,agi:1000,atk:10,hitBonus:1});
            G.battle=new Battle(G.party,[foe],()=>{});G.state='combat';G.animating=false;G.fx=null;
            __renderCombatCanvas();const before=G.enemyPos[foe.uid].size;
            const state=refDeserialize(JSON.parse(inf.saveJSON()));
            const packet=resolveCloudBattle(state,'commit',{actor:G.battle.current.uid,action:'attack',target:{side:'enemy',uid:foe.uid}});
            applySavePatch(G,refDeserialize(refSerialize(packet)));
            __renderCombatCanvas();const after=G.enemyPos[foe.uid].size;
            if(Math.abs(before-after)>.01)throw Error(`${kind}: 攻撃後にサイズが変化 ${before}→${after}`);
            if(!(G.battle.enemies[0].hp<100000))throw Error('攻撃が反映されていない');
            sizes[kind]={before,after};
            // 保存済みの戦闘を読み戻した時と同じ台帳の復元を通す。
            const saved=refDeserialize(JSON.parse(inf.saveJSON()));
            const {MONSTERS}=await import('/src/sprites.js');
            saved.battle.enemies[0].mon=MONSTERS[key];
            applySavePatch(G,{snapshot:saved});__renderCombatCanvas();
            if(Math.abs(G.enemyPos[foe.uid].size-before)>.01)throw Error(`${kind}: 再開後にサイズが変化`);
          }
          if(!(sizes.elite.before>sizes.normal.before&&sizes.boss.before>sizes.normal.before))throw Error('強敵・主が通常敵より大きくない');
          return sizes;
        }''')
        print(f'{width}x{height}: 攻撃前後・保存復元後のサイズ維持 {result}',flush=True)
    assert not errors,errors
    browser.close()
