"""街と無限迷宮の武魂分離・途中復元・通常/赤い魂/広告帰還・全滅を実ゲームで確認。"""
import os, runpy
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('DOS_TEST_BASE', 'http://localhost:8000/')
fixture = runpy.run_path(str(ROOT / 'tools/cloud/browser-fixtures.py'))
def stub_art(route):
    key = route.request.url.rsplit('/',1)[-1].split('.')[0]
    size = fixture['MONSTER_SIZES'].get(key,(2,2)) if '/monsters/' in route.request.url else (2,2)
    if '/art/dungeon/' in route.request.url:size=(1254,1254) if key=='crypt-walker' else (1536,1024)
    if any('/art/'+part+'/' in route.request.url for part in ['items','collectibles','treasury']):size=(384,384)
    if any('/art/'+part+'/' in route.request.url for part in ['misc','offerings']):size=(320,320)
    route.fulfill(content_type='image/png',body=fixture['placeholder'](*size))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    for outcome in ['return', 'red', 'ad', 'wipe']:
        context = browser.new_context(service_workers='block', viewport={'width':390,'height':844}, reduced_motion='reduce')
        context.route('**/art/**', stub_art)
        context.route('**/src/cloud-config.js', lambda r:r.fulfill(content_type='text/javascript', body='export const CLOUD_CONFIG={enabled:false};'))
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e:errors.append(str(e)))
        page.goto(BASE+'?testDungeon=w02&testPlace=town&testUnlock=infinite,forge,enchant,bukonFusion', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.state==="town" && !document.body.classList.contains("game-starting") && !document.querySelector(".ttl-overlay")')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),b=await import('/src/bukon.js'),{rollStartSouls}=await import('/src/abyss.js'),{sheet}=await import('/src/ui/kit.js');
          const G=game.G,inf=__game.inf,check=(ok,m)=>{if(!ok)throw Error(m);};sheet.closeAll();
          G.testUnlock=['infinite','forge','enchant','bukonFusion'];G.bukonStock={'flat_hp:1':'4','flat_mp:1':'2'};G.bukonProtected={'flat_hp:1':true};G.bukonGift=false;G.tut={done:{}};G.redSoul=100;
          const picks=[];for(let i=0;i<6;i++)picks.push(rollStartSouls(picks)[0]);
          check(inf.enterAbyss(picks),'無限迷宮への出撃');
          check(game.bukonRows().length===0,'街の武魂や初回配布を回収人へ出さない');
          game.prepareBukonFusionTutorial();check(!G.bukonGift&&!G.tut.bukonFusionGift,'無限迷宮では入門用の武魂を配らない');
          b.stockAdd(G,{k:'flat_hp',lv:1},3);b.stockAdd(G,{k:'flat_atk',lv:1},2);
          G.bukonProtected={'flat_atk:1':true};
          const gear={...inf.cloneItem('dagger'),rar:'lr',bukon:[{k:'flat_atk',lv:2}],locked:true};
          G.party[0].equip.weapon=gear;G.inventory.push(gear); // 共有参照でも帰還は1点だけ。
          const memory={...inf.cloneItem('dagger'),soulMemory:true,bukon:[{k:'flat_atk',lv:3}]};G.party[1].equip.weapon=memory;
          G.floor=5;G.abyss.depth=5;G.state='board';
          check(!game.bukonRows().some(x=>x.k==='flat_mp'),'街にだけある武魂を候補へ出さない');
          check(game.bukonRows().find(x=>x.k==='flat_hp').count==='3','街と同じ種類も今回分だけ');
          check(!game.bukonAction('attach',gear,{k:'flat_mp',lv:1}),'街の武魂を装着できない');
          window.test={game,UI,b,inf,sheet,check};
        }''')
        if outcome == 'return':
            page.evaluate('test.inf.openInfRest()')
            page.get_by_text('回収人 (商会の者)',exact=True).click()
            trader=page.locator('.ui-sheet-wrap:not(.closing) .inf-sheet').last
            trader.locator('.ui-seg-b').get_by_text('武魂',exact=True).click()
            trader.get_by_role('button',name='武魂一覧',exact=True).click()
            listing=page.locator('.ui-sheet-wrap:not(.closing) .bk-list-sheet')
            rows=[text.replace('\u200b','') for text in listing.locator('.bk-stock-row').all_text_contents()]
            assert not any('MP加算' in text for text in rows), ('街の武魂が実画面に出ている', rows)
            assert sum('HP加算' in text for text in rows)==3, ('今回の武魂が実画面に出ない', rows)
            page.evaluate('test.sheet.closeAll()')
        page.evaluate("test.game.G.bukonStock['flat_atk:1']='9007199254740993'")
        before_stock = page.evaluate("test.game.G.shopStock.dagger||0")
        raw = page.evaluate('__game.inf.saveJSON()')
        # 試遊モードの外で通常の読み込み処理を通す。
        page.evaluate("raw=>localStorage.setItem('dos-save-v7',raw)", raw)
        page.goto(BASE, wait_until='domcontentloaded')
        page.wait_for_function('!!window.__game?.loadGame')
        splash=page.locator('#studio-splash')
        if splash.count():splash.click()
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        try:
            page.wait_for_function('window.__game?.G.state==="board" && !document.body.classList.contains("game-starting") && !document.querySelector(".ttl-overlay")', timeout=15000)
        except Exception:
            print(page.evaluate('({state:__game.G.state,classes:document.body.className,text:document.body.innerText.slice(-2500)})'),errors,flush=True)
            raise
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),b=await import('/src/bukon.js'),{sheet}=await import('/src/ui/kit.js');
          const G=game.G;if(G.bukonStock['flat_hp:1']!=='3'||G.abyss.home.bukonStock['flat_hp:1']!=='4')throw Error('途中復元で在庫が混ざった');
          window.test={game,UI,b,inf:__game.inf,sheet};sheet.closeAll();G.state='board';G.prompt=false;
        }''')
        if outcome == 'return':
            page.evaluate("test.inf.returnToTown({outcome:'return'})")
        else:
            page.evaluate('''()=>{const G=test.game.G;for(const d of G.party){d.hp=0;d.alive=false;}test.inf.gameOver();}''')
            label = {'red':'赤い魂 20 で持ち帰る', 'ad':'広告視聴で持ち帰る', 'wipe':'あきらめて街へ'}[outcome]
            page.get_by_role('button', name=label, exact=False).click()
        page.wait_for_function('test.game.G.state==="town" && !test.game.G.abyss')
        page.locator('.inf-sum').wait_for(state='visible')
        page.evaluate('''outcome=>{
          const G=test.game.G,kept=outcome!=='wipe',check=(ok,m)=>{if(!ok)throw Error(m);};
          check(G.bukonStock['flat_hp:1']===(kept?'7':'4'),'街と今回分を一度だけ合流');
          check(G.bukonStock['flat_mp:1']==='2'&&G.bukonProtected['flat_hp:1'],'街の在庫と保護を維持');
          check(G.bukonStock['flat_atk:1']===(kept?'9007199254740993':undefined),'保管中の武魂を大きな個数のまま移す');
          check(G.bukonStock['flat_atk:2']===(kept?'1':undefined),'装備中の武魂を一度だけ回収');
          check(!G.bukonStock['flat_atk:3'],'記憶の武魂は持ち帰らない');
          check(!kept||G.bukonProtected['flat_atk:1'],'今回の合成保護を維持');
          check(G.redSoul===(outcome==='red'?80:100),'赤い魂の一度だけの支払い・広告は無料');
          check(!G.inventory.some(it=>it.id==='dagger'&&it.bukon?.some(b=>b.lv===2)),'帰還装備を手元へ加えない');
          check(document.body.textContent.replaceAll('\u200b','').includes(kept?'武魂 9007199254740997個を商会へ自動で保管':'武魂 9007199254740997'),'帰還結果に武魂の合計を表示: '+document.querySelector('.inf-sum')?.textContent);
        }''', outcome)
        assert page.evaluate("test.game.G.shopStock.dagger||0") == before_stock + (0 if outcome == 'wipe' else 1), '装備を一度だけ商会の棚へ'
        assert not errors, errors
        print(f'無限迷宮 {outcome}: 在庫分離・途中復元・装備/保管武魂・記憶除外・大きな個数・帰還結果 OK', flush=True)
        context.close()
    browser.close()
