"""能力欄のスマホ・タブレット・PC配置と大きな数値の収まり。localhost:8000が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for touch, widths in [(True, [320,360,390,430,768,820,1180]), (False, [1100,1280,1440,1920])]:
        page = browser.new_page(has_touch=touch, viewport={'width':widths[0],'height':900})
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length > 0')
        page.evaluate('''async()=>{
          const {UI,game}=await import('/src/ui/ctx.js');
          game.G.irene.greeted=true; game.G.tut.cur=null;
          const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>game.G.tut.done[t.key]=true);
          UI.shell.setTab('party');
        }''')
        for width in widths:
            page.set_viewport_size({'width':width,'height':900})
            for large in [False, True]:
                page.evaluate('''async large=>{
                  const {UI,game}=await import('/src/ui/ctx.js');
                  const d=game.G.party[0];
                  d.critPower=.8;d.spellCritPower=.8;
                  d.critDamageBonus=large?123.456:.4;
                  d.hp=d.maxhp=large?123456789:141;
                  d.mp=d.maxmp=large?123456789:111;
                  UI.shell.refresh();
                }''', large)
                page.wait_for_timeout(400)
                result=page.evaluate('''()=>{
                  const info=document.querySelector('.pt-info');
                  const facts=[...info.querySelectorAll('.pt-fact')];
                  const bounds=info.getBoundingClientRect();
                  for(const fact of facts){
                    if(fact.scrollWidth>fact.clientWidth+1)throw Error('項目のはみ出し: '+fact.textContent);
                    for(const child of fact.children){
                      const r=child.getBoundingClientRect();
                      if(r.left<bounds.left||r.right>bounds.right)throw Error('欄外表示: '+fact.textContent);
                    }
                  }
                  const crit=facts.filter(f=>f.textContent.includes('会心'));
                  return {cols:getComputedStyle(info).gridTemplateColumns.split(' ').length,
                    critHeights:crit.map(f=>f.querySelector('.pt-fact-k').getBoundingClientRect().height),
                    desktop:!!document.querySelector('.pc-mansion-section')};
                }''')
                assert result['cols']==(1 if width==320 else 2 if width<=430 else 3), (width,result)
                if not large:
                    assert max(result['critHeights'])<20, (width,result)
                assert result['desktop']==(not touch), (width,result)
            print(f'{"タッチ" if touch else "PC"} {width}px: 列数・ラベル・大きな数値 OK')
        page.close()
    browser.close()
