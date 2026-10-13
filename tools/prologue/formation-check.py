"""加入順変更の旧セーブ互換・五体目からの連続進行・隊列操作途中の保存を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for case in ['chain', 'resume', 'custom', 'legacy']:
        context = browser.new_context(service_workers='block', viewport={'width':390,'height':844})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        key = 'createFifth' if case in ['chain','legacy'] else 'prologueFormation'
        page.goto('http://localhost:8000/?testScene=tutorial:'+key)
        page.wait_for_function('window.__game?.G.msq?.prologue')
        page.evaluate('''async (kind) => {
          const {soulByUid}=await import('/src/souls.js');
          const G=__game.G;
          // 旧版は四体目の騎士を既に育てている。受領記録も元の職のまま。
          if(kind==='legacy') {
            const fourth=soulByUid(G.party[3].primary); fourth.clsKey='knight';
            G.msq.prologue.gifts={fourth:fourth.uid};
            G.souls=G.souls.filter(s=>s.uid===fourth.uid||!['knight','mage'].includes(s.clsKey));
            const {setSharedSouls}=await import('/src/souls.js');setSharedSouls(G.souls);
            __game.ev.recalcDoll(G.party[3]);
            const {game}=await import('/src/ui/ctx.js');
            game.preparePrologueDoll();game.preparePrologueDoll();
            if(G.souls.filter(s=>s.clsKey==='mage').length!==1) throw Error('旧セーブの魂を重複授与');
          }
          if(kind==='custom') G.party=[G.party[3],G.party[1],G.party[0],G.party[2],G.party[4]];
          if(kind==='resume') {G.tut.cur='prologueFormation';G.tut.step=1;G.tut.ev={formationPickerOpened:true};}
          delete G.tut.done.prologueFormation;
          G.irene.greeted=true;
          localStorage.setItem('dos-save-v7',__game.inf.saveJSON());
        }''', case)
        page.goto('http://localhost:8000/')
        page.wait_for_function('window.__game?.G.msq?.prologue')
        page.get_by_role('button', name='つづきから', exact=False).click()
        for n in range(100):
            page.wait_for_timeout(350)
            if page.evaluate('!!__game.G.tut.done.prologueFormation'):
                break
            skip=page.locator('.iv-skip:visible,.sc-skip:visible')
            if skip.count():
                skip.evaluate_all('(buttons)=>buttons[0]?.click()')
                continue
            glow=page.locator('.tut-glow:visible')
            if glow.count():
                glow.first.click(timeout=3000)
        assert page.evaluate('!!__game.G.tut.done.prologueFormation'), (case,page.evaluate('document.body.innerText.slice(-1000)'))
        jobs=page.evaluate("async()=>{const {soulByUid}=await import('/src/souls.js');return __game.G.party.map(d=>soulByUid(d.primary).clsKey)}")
        assert set(jobs[:3])=={'fighter','knight','thief'}, (case,jobs)
        assert set(jobs[3:])=={'mage','priest'}, (case,jobs)
        assert page.evaluate('__game.G.msq.prologue.phase')=='corridorQuest'
        assert not errors,errors
        print(case, jobs, '完了',flush=True)
        context.close()
    browser.close()
