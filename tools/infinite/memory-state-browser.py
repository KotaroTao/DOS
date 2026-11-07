"""隊の状態・出来事・武魂・袋の記憶と、幻を持ち帰らないことを実ゲームで検証。"""
import os, re, runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('DOS_TEST_BASE','http://localhost:8000/')
art=runpy.run_path(str(ROOT/'tools/cloud/choice-bench/trial-browser.py'))
monster_sizes={key:(int(w),int(h)) for key,w,h in re.findall(r'\b(\w+):\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]',(ROOT/'src/monsterphotos.js').read_text())}
def stub_image(r):
    key=r.request.url.rsplit('/',1)[-1].split('.')[0]
    size=monster_sizes.get(key,(2,2)) if '/monsters/' in r.request.url else (2,2)
    if '/art/dungeon/' in r.request.url:size=(1254,1254) if key=='crypt-walker' else (1536,1024)
    if any('/art/'+part+'/' in r.request.url for part in ['items','collectibles','treasury']):size=(384,384)
    if any('/art/'+part+'/' in r.request.url for part in ['misc','offerings']):size=(320,320)
    r.fulfill(content_type='image/png',body=art['placeholder'](*size))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
    for outcome in ['return','saved','wipe']:
        ctx=browser.new_context(service_workers='block',viewport={'width':390,'height':844},reduced_motion='reduce')
        ctx.route('**/art/**',stub_image)
        ctx.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
        page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'?testDungeon=w02&testPlace=town&testUnlock=infinite,forge,enchant,bukonFusion',wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.state==="town" && !document.body.classList.contains("game-starting")')
        page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js'),b=await import('/src/bukon.js'),{sheet}=await import('/src/ui/kit.js');
          const {rollStartSouls}=await import('/src/abyss.js'),{CHAPTERS}=await import('/src/story.js');
          const {itemName}=await import('/src/items.js'),G=game.G,inf=__game.inf;
          const check=(v,m)=>{if(!v)throw Error(m);};sheet.closeAll();G.prompt=false;
          for(const no of [5,10])__game.worldState().reported[CHAPTERS.find(c=>c.no===no).finale]=true;
          G.bukonGift=true;G.tut.done.enchant=true;G.tut.done.bukonFusion=true;G.bukonStock={'flat_mp:1':'4'};
          const picks=[];for(let i=0;i<6;i++)picks.push(rollStartSouls(picks)[0]);check(inf.enterAbyss(picks),'新規出撃');
          G.floor=50;G.abyss.depth=50;G.abyss.guardFloor=50;G.state='board';
          const gear={...inf.cloneItem('dagger'),rar:'lr',bukon:[{k:'flat_atk',lv:2}]};G.party[0].equip.weapon=gear;
          G.inventory.push(inf.cloneItem('u_soul_incense'),{...inf.cloneItem('dagger'),q:73});
          b.stockAdd(G,{k:'flat_atk',lv:1},9);G.bukonProtected={'flat_atk:1':true};
          inf.recalcAllDolls();const d=G.party[0];d.hp=7;d.mp=1;d.ailment='poison';d._poisonPct=.03;
          G.run.ev={mods:[{name:'検証の加護',desc:'与ダメ+20%',dmgMul:1.2},{name:'検証の呪い',desc:'敵の力+10%',enemyMul:1.1}],crit:.05,preempt:2,startHeal:3,saves:{[d.uid]:true},ruby:d.uid};
          check(game.infSaveMemory(),'状態の記憶');
          const memory=game.infMemoryAt(50);check(memory.v===2&&memory.party[0].hp===7&&memory.inventory.length===2&&memory.runEv.preempt===2,'新しい記憶へ状態と持ち物を保存');
          check(!gear.soulMemory&&!G.inventory[0].soulMemory&&!gear.bukon[0].soulMemory,'保存時に実物を幻へ変えない');
          inf.returnToTown({outcome:'return'});sheet.closeAll();for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
          check(inf.enterAbyss(null,false,50),'記憶から51階へ');
          check(G.party[0].hp===7&&G.party[0].mp===1&&G.party[0].ailment==='poison'&&G.party[0]._poisonPct===.03,'傷とMPと毒を復元');
          check(G.run.ev.mods.length===2&&G.run.ev.preempt===2&&G.run.ev.startHeal===3&&G.run.ev.crit===.05,'加護・呪い・残り回数を復元');
          check(G.run.ev.saves[G.party[0].uid]&&G.run.ev.ruby===G.party[0].uid,'器の通し番号が変わっても個人の効果を復元');
          check(G.inventory.length===2&&G.inventory.every(it=>it.soulMemory&&itemName(it).endsWith('（幻）')),'袋の全品を幻で復元');
          check(G.party[0].equip.weapon.soulMemory&&G.party[0].equip.weapon.bukon[0].soulMemory,'装備と装着武魂を幻にする');
          check(b.stockRows(G).length===1&&b.stockRows(G)[0].soulMemory&&b.stockRows(G)[0].protected,'保管武魂と保護も幻で復元');
          check(G.run.souls.length===0&&G.run.items.length===0&&G.run.embers===0,'記憶を今回の戦利品実績へ足さない');
          const fresh={...inf.cloneItem('dagger'),rar:'lr',bukon:[]};G.inventory.push(fresh);
          b.inheritBukon(G,G.party[0].equip.weapon,fresh);check(fresh.bukon[0].soulMemory,'装備更新で幻の武魂を実物にしない');
          const row=b.stockRows(G)[0];check(b.attachBukon(G,{slot:'weapon',rar:'lr',bukon:[]},row),'保管中の幻を使用可能');
          G.bukonProtected={};G.gold=10000;check(b.applySnapshotFusion(G,[],b.stockRows(G)[0]),'幻同士の合成');
          check(b.stockRows(G).every(row=>row.soulMemory),'合成後も全て幻');
          b.stockAdd(G,{k:'flat_hp',lv:1},2);b.stockAdd(G,{k:'flat_atk',lv:1},2); // 再開後に得た実物。
          G.inventory.push(inf.cloneItem('u_soul_incense'));
          G.floor=100;G.abyss.depth=100;G.abyss.guardFloor=100;check(game.infSaveMemory(),'幻と実物が混在する隊を次の節目に記録');
          window.test={game,UI,b,sheet,inf,check,memory};
        }''')
        raw=page.evaluate('__game.inf.saveJSON()')
        # 実際の「続ける」で、途中保存後も幻の印と記録時の状態を維持する。
        page.evaluate("raw=>localStorage.setItem('dos-save-v7',raw)",raw)
        page.goto(BASE,wait_until='domcontentloaded');page.wait_for_function('!!window.__game?.loadGame')
        splash=page.locator('#studio-splash')
        if splash.count():splash.click()
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        try:
            page.wait_for_function('window.__game?.G.state==="board" && !document.body.classList.contains("game-starting") && !document.querySelector(".ttl-overlay")')
        except Exception:
            print(page.evaluate('({state:__game.G.state,classes:document.body.className,text:document.body.innerText.slice(-2000)})'),errors,flush=True)
            raise
        page.evaluate('''async outcome=>{
          const {game}=await import('/src/ui/ctx.js'),{sheet}=await import('/src/ui/kit.js'),b=await import('/src/bukon.js');
          const G=game.G,inf=__game.inf,check=(v,m)=>{if(!v)throw Error(m);};sheet.closeAll();
          check(G.party[0].hp===7&&G.party[0].ailment==='poison'&&G.inventory.some(it=>it.soulMemory),'続けるで幻・傷・異常を維持');
          const before={stock:JSON.stringify(G.abyss.home.bukonStock),dagger:G.shopStock.dagger||0,incense:G.shopStock.u_soul_incense||0};
          check(b.stockRows(G).some(row=>row.soulMemory)&&b.stockRows(G).some(row=>!row.soulMemory),'幻と実物が同じ挑戦内で別在庫');
          inf.returnToTown({outcome});const keep=outcome!=='wipe';
          check(!Object.keys(G.bukonStock).some(k=>k.endsWith(':phantom')),'幻の保管武魂を持ち帰らない');
          check(G.bukonStock['flat_hp:1']===(keep?'2':undefined),'今回入手した実物だけ持ち帰る');
          check((G.shopStock.dagger||0)===before.dagger+(keep?1:0),'新規装備だけ商会へ・幻武魂は除く');
          check((G.shopStock.u_soul_incense||0)===before.incense+(keep?1:0),'新規の道具だけ商会へ');
          check(G.bukonStock['flat_atk:2']==='1'&&G.bukonStock['flat_atk:1']===(keep?'11':'9')&&G.bukonStock['flat_mp:1']==='4','街に置いた実物の武魂を維持');
          const original=game.infMemoryAt(50);check(original.party[0].hp===7&&original.bukonStock['flat_atk:1']==='9'&&!original.party[0].equip.weapon.soulMemory,'再開と操作で元の記憶を書き換えない');
          if(outcome==='return'){
            const stockBefore=JSON.stringify(G.bukonStock);sheet.closeAll();for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
            check(inf.enterAbyss(null,false,100),'100階の拡張記録から再開');
            check(G.bukonStock['flat_atk:1:phantom']==='7'&&!G.bukonStock['flat_atk:1'],'幻と実物を合わせて一度だけ幻として再現');
            check(G.inventory.every(it=>it.soulMemory),'次の記憶でも全て幻');
            inf.returnToTown({outcome:'saved'});check(JSON.stringify(G.bukonStock)===stockBefore,'記憶だけで再開しても武魂を増殖させない');
          }
        }''',outcome)
        assert not errors,errors
        print(f'魂の記憶 {outcome}: HP/MP/毒・イベント効果・個人効果・袋・幻武魂・合成/引継ぎ・途中再開・帰還制限 OK',flush=True)
        ctx.close()
    browser.close()
