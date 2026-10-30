"""階段の未発見・発見・到達前の表示を検証する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03')
    page.wait_for_function('window.__game?.G.board')
    page.evaluate('''()=>{
      const g=__game.G;g.prompt=false;
      for(const row of g.board.cells)for(const c of row)if(c.type==='stairs')c.revealed=false;
      __game.inf.renderBoard();
    }''')
    unknown=page.get_by_role('button',name='階段未発見',exact=True)
    unknown.wait_for();assert unknown.is_disabled()
    page.evaluate('''()=>{
      const g=__game.G;
      for(const row of g.board.cells)for(const c of row)if(c.type==='stairs')c.revealed=true;
      __game.inf.renderBoard();
    }''')
    assert page.get_by_role('button',name='階段未発見',exact=True).count()==0
    assert page.locator('.dk-down').count()==1
    assert '降りる' in page.locator('.dk-down').get_attribute('aria-label')
    assert not errors,errors
    print('階段未発見は押せない表示、発見後は降りる表示へ切替 OK')
    b.close()
