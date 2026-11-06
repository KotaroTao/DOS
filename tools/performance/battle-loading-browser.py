"""戦闘の記録追記のレイアウト回数と、取り巻き・召喚先の画像準備を確認する。"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(service_workers='block')
    page.route('**/src/cloud-config.js', lambda r: r.fulfill(content_type='text/javascript', body='export const CLOUD_CONFIG={enabled:false};'))
    source = Path(os.environ['BATTLE_GAME_SOURCE']).read_text() if os.environ.get('BATTLE_GAME_SOURCE') else (ROOT / 'src/game.js').read_text()
    page.route('**/src/game.js', lambda r: r.fulfill(content_type='text/javascript', body=source+'\nwindow.battleLoadingTest={writeLog,preloadDungeon,logHistory};'))
    page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
    page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
    # 実際に記録欄を表示した状態で、DOM追加と同期レイアウトを計測する。
    page.evaluate('''()=>{__game.G.state='board';document.getElementById('town-shell').classList.add('hidden');
      const log=document.getElementById('log');log.style.cssText='display:block;height:80px;overflow:auto';}''')
    cdp = page.context.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    cdp.send('Performance.enable')
    before = {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    measured = page.evaluate('''async()=>{const t=performance.now();
      for(let i=0;i<60;i++)battleLoadingTest.writeLog('検証の敵に '+i+' の傷を与えた','dmg');
      const syncMs=performance.now()-t;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const log=document.getElementById('log');
      if(log.scrollHeight-log.clientHeight-log.scrollTop>2)throw Error('記録の末尾が表示されない');
      const history=battleLoadingTest.logHistory().slice(-60);
      if(history.length!==60||!history[59].text.includes('59'))throw Error('記録が欠けた');
      return {syncMs,lines:log.children.length};}''')
    after = {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    measured['layouts'] = after['LayoutCount']-before['LayoutCount']
    if not os.environ.get('BATTLE_GAME_SOURCE'):
        assert measured['layouts'] < 15, measured
    print(json.dumps(measured))
    if not os.environ.get('BATTLE_GAME_SOURCE'):
        print(page.evaluate('''async()=>{
          const {MONSTERS}=await import('/src/sprites.js');
          const {WORLD}=await import('/src/dungeons/world.js');
          const {rngState}=await import('/src/rng.js');
          const saved=new Map(),calls=new Set(),before=JSON.stringify(rngState());
          for(const [k,m] of Object.entries(MONSTERS)){saved.set(m,m.photo);m.photo={load:()=>{calls.add(k);return Promise.resolve(true);}};}
          let checked=0;
          try{
            for(const cfg of WORLD){
              calls.clear();await battleLoadingTest.preloadDungeon(cfg,1);
              for(const k of calls)for(const next of [MONSTERS[k]?.escort,MONSTERS[k]?.summonKey]){
                if(next&&MONSTERS[next]&&!calls.has(next))throw Error(cfg.id+': '+next+' の先読み漏れ');
                if(next)checked++;
              }
            }
            // 連鎖・循環も一度ずつで止まることを確認する。
            MONSTERS.__warmA={escort:'__warmB',photo:{load:()=>{calls.add('__warmA');return true;}}};
            MONSTERS.__warmB={summonKey:'__warmA',photo:{load:()=>{calls.add('__warmB');return true;}}};
            calls.clear();await battleLoadingTest.preloadDungeon({id:'__test',tutorial:true,pool:['__warmA'],elites:[]},1);
            if(!calls.has('__warmB'))throw Error('連鎖の先読み漏れ');
            if(before!==JSON.stringify(rngState()))throw Error('先読みが乱数を消費');
          }finally{for(const [m,photo] of saved)m.photo=photo;delete MONSTERS.__warmA;delete MONSTERS.__warmB;}
          return {dungeons:WORLD.length,linkedEnemies:checked,rngUnchanged:true};
        }'''))
    browser.close()
