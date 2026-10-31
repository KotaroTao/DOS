"""転送罠: 次階・最下階・無限迷宮・通知中の再読み込みを実ブラウザで確認。"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / 'src/game.js').read_text() + "\nwindow.trapCheck={presentTrap,applyTrap,activeCfg,newFloor,infDepthLimit};"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for mode,url in [('normal','?testDungeon=w05&testPlace=board'),('bottom','?testDungeon=w05&testPlace=board'),('infinite','?testInf=4&testInfLv=80')]:
        context=browser.new_context(service_workers='block',reduced_motion='reduce')
        context.route('**/src/game.js',lambda r:r.fulfill(status=200,content_type='text/javascript',body=SOURCE))
        errors=[]
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/'+url,wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.wait_for_function('__game.G.state==="board"')
        page.evaluate("localStorage.setItem('dos-save-v7',__game.inf.saveJSON())")
        page.goto('http://localhost:8000/',wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.locator('.ttl-btn.primary').first.evaluate('(b)=>b.click()')
        page.wait_for_function('!document.querySelector(".ttl-btn.primary")')
        result=page.evaluate(r"""async mode=>{
          const {G}=__game,t=trapCheck;
          const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();G.prompt=false;
          if(mode==='bottom'){G.floor=t.activeCfg().floors;t.newFloor();}
          const initial=G.floor,board=G.board;
          if(G.run)G.run.float=2;
          const {TRAPS}=await import('/src/traps.js');
          let aborted=false,proceeded=false;
          t.presentTrap(t.applyTrap(TRAPS.find(x=>x.kind==='teleport'),G.party[0]),{chest:true,abort:()=>{aborted=true},proceed:()=>{proceeded=true}});
          if(G.floor!==initial+(mode==='bottom'?0:1))throw Error('転移階が違う');
          if((G.board===board)!==(mode==='bottom'))throw Error('盤面の生成が違う');
          if(mode!=='bottom'&&G.run.float!==1)throw Error('階移動時の浮遊更新');
          if(mode==='infinite'&&G.abyss.depth!==G.floor)throw Error('無限迷宮の深さ');
          const cell=G.board.cells[G.py][G.px];
          if(cell.type!=='empty'||!cell.cleared||!cell.revealed)throw Error('安全な着地点');
          if(!aborted||proceeded)throw Error('宝箱の中身を取得させない');
          if(!G.pendingDanger?.notice.lines.some(x=>x.includes('宝箱')))throw Error('宝箱消失の通知');
          return {floor:G.floor,pos:[G.px,G.py],rng:[...G.rng],board:JSON.stringify(G.board)};
        }""",mode)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length>0')
        page.locator('.ttl-btn.primary').first.evaluate('(b)=>b.click()')
        page.wait_for_function('!document.querySelector(".ttl-btn.primary")')
        after=page.evaluate('()=>{const {G}=__game;return {floor:G.floor,pos:[G.px,G.py],rng:[...G.rng],board:JSON.stringify(G.board)}}')
        assert result==after,(mode,'再読込で転送先が変わった')
        assert not errors,errors
        print(mode+': 転移階・着地点・階移動更新・宝箱消失・再読込を確認',flush=True)
        context.close()
    browser.close()
