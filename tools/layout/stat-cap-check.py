"""能力欄の上限色・説明の省略・狭い画面での収まりを確認。localhost:8000が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = b.new_page(has_touch=True, viewport={'width':820,'height':1180})
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async()=>{
      const {UI,game}=await import('/src/ui/ctx.js');
      game.G.irene.greeted=true; game.G.tut.cur=null;
      const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>game.G.tut.done[t.key]=true);
      UI.shell.setTab('party');
    }''')
    for width in [360,390,820,1180]:
        page.set_viewport_size({'width':width,'height':1180})
        for value in [.799, .8, 1.2]:
            page.evaluate('''async value=>{
              const {UI,game}=await import('/src/ui/ctx.js');
              const d=game.G.party[0];
              d.critPower=value; d.spellCritPower=value; d.critDamageBonus=1.2;
              d.resists.poison=value<.8?99:100;
              UI.shell.refresh();
            }''', value)
            page.wait_for_timeout(350)
            result=page.evaluate('''()=>[...document.querySelectorAll('.pt-info .pt-fact')].map(f=>({
              label:f.querySelector('.pt-fact-k').textContent.replaceAll('\\u200b',''),
              capped:f.classList.contains('cap'),color:getComputedStyle(f.querySelector('.pt-fact-v')).color,
              text:f.textContent, overflow:f.scrollWidth>f.clientWidth+1
            }))''')
            for label in ['会心補正','魔法会心補正','毒耐性']:
                fact=next(f for f in result if f['label']==label)
                assert fact['capped']==(value>=.8), (width,value,fact)
                assert (fact['color']=='rgb(255, 216, 90)')==(value>=.8)
                assert 'まで' not in fact['text'] and not fact['overflow'], (width,fact)
            assert not next(f for f in result if f['label']=='会心ダメージ')['capped']
        print(f'{width}px: 上限未満・一致・超過と耐性、はみ出し確認 OK')
    b.close()
