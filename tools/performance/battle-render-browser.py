"""戦場の連続描画が同じDOM属性を毎回書かず、非表示の街も寸法を読まないことを検査。"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(os.environ.get('BATTLE_RENDER_SOURCE_ROOT', ROOT))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    for width, height in [(390, 844), (1024, 1366)]:
        page = browser.new_page(service_workers='block', viewport={'width':width, 'height':height})
        if os.environ.get('BATTLE_MISSING_ART'):
            def missing_art(route):
                url=route.request.url
                if '/art/effects/' in url or url.endswith(('/art/battle/w01.webp','/art/monsters/bs_bonepile.webp')):
                    route.continue_()
                else:
                    route.fulfill(status=404, body='')
            page.route('**/art/**', missing_art)
        page.route('**/src/cloud-config.js', lambda r: r.fulfill(content_type='text/javascript', body='export const CLOUD_CONFIG={enabled:false};'))
        page.route('**/src/game.js', lambda r: r.fulfill(content_type='text/javascript', body=(SOURCE/'src/game.js').read_text()+'\nwindow.renderBattleTest=renderCombatCanvas;'))
        page.route('**/src/townart.js', lambda r: r.fulfill(content_type='text/javascript', body=(SOURCE/'src/townart.js').read_text()+'\nwindow.townIdleProbe=idle;'))
        page.add_init_script('''window.hiddenCanvasReads=0;const rects=HTMLCanvasElement.prototype.getClientRects;
          HTMLCanvasElement.prototype.getClientRects=function(){if(this.closest('[hidden], .hidden'))hiddenCanvasReads++;return rects.call(this);};''')
        page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
        page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
        page.evaluate('''()=>{
          const {G}=__game;for(const a of G.party){a.hp=a.maxhp=100000;a.agi=1000;}
          const enemies=Array.from({length:4},()=>__game.spawnCardEnemies('bs_bonepile',1,1)[0]);
          for(const e of enemies){e.hp=e.maxhp=10000000;e.agi=1;e.ability=null;}
          __game.startBattle(enemies,null);document.getElementById('town-shell').classList.add('hidden');
        }''')
        page.locator('#combat-menu[data-mode="input"]').wait_for()
        page.evaluate('''()=>{__game.G.animating=true;renderBattleTest();window.hiddenCanvasReads=0;
          window.rowMutations=0;window.rowObserver=new MutationObserver(entries=>rowMutations+=entries.length);
          rowObserver.observe(document.getElementById('enemy-row-toggle'),{attributes:true});}''')
        cdp = page.context.new_cdp_session(page)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate':4})
        cdp.send('Performance.enable')
        before = {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
        result = page.evaluate('''async()=>{const samples=[];for(let batch=0;batch<3;batch++){
          const start=performance.now();for(let i=0;i<100;i++)renderBattleTest();samples.push(performance.now()-start);
          await new Promise(r=>requestAnimationFrame(r));}
          await new Promise(r=>setTimeout(r,400));return {samples,rowMutations,hiddenCanvasReads};}''')
        after = {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
        result.update(width=width, layouts=after['LayoutCount']-before['LayoutCount'], styles=after['RecalcStyleCount']-before['RecalcStyleCount'])
        if not os.environ.get('BATTLE_RENDER_SOURCE_ROOT'):
            assert result['rowMutations']==0, result
            assert result['hiddenCanvasReads']==0, result
        if not os.environ.get('BATTLE_RENDER_SOURCE_ROOT'):
            page.evaluate('''()=>{
              const {G}=__game,b=G.battle,button=document.getElementById('enemy-row-toggle');
              const before=JSON.stringify(G.rng);G.animating=false;renderBattleTest();
              if(button.disabled||button.hidden!==(innerWidth>600))throw Error('前後列ボタンの状態');
              if(innerWidth<=600){
                button.click();
                if(!G.enemyPos[b.enemies[0].uid].distant)throw Error('後列の切り替え');
                button.click();
                if(G.enemyPos[b.enemies[0].uid].distant)throw Error('前列へ戻せない');
              }
              const old=b.enemies;b.enemies=old.slice(0,3);renderBattleTest();
              if(!button.hidden)throw Error('一列の時にボタンが残る');
              b.enemies=old;G.animating=true;renderBattleTest();
              if(!button.disabled)throw Error('演出中にボタンを操作できる');
              if(before!==JSON.stringify(G.rng))throw Error('描画が乱数を消費');
            }''')
            page.evaluate('window.idleProbeDone=0;townIdleProbe(()=>idleProbeDone++);')
            page.wait_for_timeout(850)
            assert page.evaluate('idleProbeDone')==0, '街の先読みが戦闘へ割り込んだ'
            cdp.send('Emulation.setCPUThrottlingRate', {'rate':1})
            page.evaluate("__game.G.state='town';__game.G.battle=null;__game.G.animating=false;document.getElementById('app').classList.remove('in-combat');document.getElementById('town-shell').classList.remove('hidden');")
            page.wait_for_function('idleProbeDone===1', timeout=15000)
        print(json.dumps(result))
        page.close()
    browser.close()
