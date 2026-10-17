"""localhost:8000でスマホの技選択パネルと、選択・取消・詳細・MP不足を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':664}, has_touch=True, is_mobile=True, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    page.evaluate('''async () => {
      const {SPELLS}=await import('/src/combat.js');
      const G=__game.G; G.autoCombat=false; G._evOpening='preempt';
      const keys=['SHADOWBOLT','DIOS',...Object.keys(SPELLS).filter(k=>SPELLS[k].kind!=='field'&&!['SHADOWBOLT','DIOS'].includes(k)).slice(0,30)];
      for(const d of G.party) {d.spells=keys.slice(); d.skillOff=[]; d.autoOff=[]; d.agi=999; d.mp=d.maxmp=9999;}
      const foes=__game.spawnCardEnemies('bs_drainrat',1).slice(0,1);
      const sample=foes[0];
      __game.startBattle([sample,{...sample,uid:sample.uid+10000}],null);
      window.snapshot=()=>JSON.stringify({mp:G.party.map(d=>d.mp),current:G.battle.current?.uid,
        phase:G.battle.phase,pending:G.battle.pending,rng:G.rng});
    }''')
    page.wait_for_function('__game.G.battle?.phase === "input" && !__game.G.animating')
    for w,h in [(320,480),(375,550),(390,664),(390,844),(430,932),(600,760)]:
        page.set_viewport_size({'width':w,'height':h})
        page.wait_for_timeout(150)
        page.evaluate('window.beforePicker=snapshot()')
        page.locator('.cmd-skill').tap()
        picker=page.locator('.battle-skill-picker')
        picker.wait_for(state='visible')
        page.wait_for_timeout(250)
        page.evaluate('''() => {
          const card=document.querySelector('.battle-skill-picker'),r=card.getBoundingClientRect();
          const head=card.querySelector('.ui-sheet-head'),foot=card.querySelector('.ui-sheet-foot'),body=card.querySelector('.ui-sheet-body');
          if(r.height<innerHeight*.74||r.height>innerHeight*.81)throw Error('技のパネルの高さ');
          if(body.scrollHeight<=body.clientHeight||body.clientHeight<innerHeight*.4)throw Error('技一覧のスクロール領域不足');
          if(card.scrollWidth>card.clientWidth+1)throw Error('技一覧が横へはみ出す');
          const rows=[...card.querySelectorAll('.spell-skill')];
          const left=rows[0].getBoundingClientRect().left;
          for(const b of rows) {
            const br=b.getBoundingClientRect();
            if(br.height<56||Math.abs(br.left-left)>1)throw Error('技が小さい・一列ではない');
          }
          const top=head.getBoundingClientRect().top,bottom=foot.getBoundingClientRect().bottom;
          body.scrollTop=body.scrollHeight;
          if(head.getBoundingClientRect().top!==top||foot.getBoundingClientRect().bottom!==bottom)throw Error('見出し・戻るが動く');
          if(!head.innerText.replaceAll('\u200b','').includes(__game.G.battle.current.name)||!head.innerText.includes('MP'))throw Error('使い手・MPがない');
          if(snapshot()!==beforePicker)throw Error('開くだけで戦闘が進む');
        }''')
        picker.locator('.ui-sheet-foot button').tap()
        picker.wait_for(state='detached')
        assert page.evaluate('snapshot()===beforePicker'), '取消でMP・手番・乱数が変わった'
        print(f'{w}x{h}: パネル・1列・スクロール・固定見出し/戻る・取消 OK',flush=True)
    # MP不足の技も詳細を開ける。暗い技を押しても使用せず、選択パネルを残す。
    page.set_viewport_size({'width':390,'height':664})
    page.evaluate('__game.G.battle.current.mp=0;__game.G._cmdStale=true')
    page.wait_for_timeout(200)
    page.locator('.cmd-skill').tap()
    locked=page.locator('.battle-skill-picker .spell-skill').first
    assert locked.get_attribute('aria-disabled')=='true'
    page.evaluate('window.beforePicker=snapshot()')
    locked.tap(force=True)
    assert page.evaluate('snapshot()===beforePicker')
    locked.dispatch_event('pointerdown',{'clientX':0,'clientY':0})
    page.wait_for_timeout(500)
    locked.dispatch_event('pointerup')
    page.locator('.ui-skill-sheet').wait_for(state='visible')
    page.evaluate("import('/src/ui/kit.js').then(({sheet})=>sheet.top().close())")
    page.locator('.ui-skill-sheet').wait_for(state='detached')
    assert page.locator('.battle-skill-picker').is_visible()
    page.locator('.battle-skill-picker .ui-sheet-foot button').tap()
    page.locator('.battle-skill-picker').wait_for(state='detached')
    # 技を選ぶとシートを閉じて、複数の敵への対象選択に進む。対象を選ぶまではMPを使わない。
    page.evaluate('__game.G.battle.current.mp=9999;__game.G._cmdStale=true')
    page.wait_for_timeout(200)
    page.locator('.cmd-skill').tap()
    page.locator('.battle-skill-picker .spell-skill').first.tap()
    page.locator('.battle-skill-picker').wait_for(state='detached')
    assert page.evaluate('__game.G.battle.phase==="target" && __game.G.battle.pending.spellKey==="SHADOWBOLT" && __game.G.battle.current.mp===9999')
    page.locator('.cmd-back').tap()
    # 大きな画面は従来のフッター一覧。
    page.set_viewport_size({'width':1280,'height':900})
    page.wait_for_timeout(200)
    page.locator('.cmd-skill').click()
    assert page.locator('.battle-skill-picker').count()==0
    assert page.locator('#combat-menu[data-mode="spells"] .target-list.cols2').is_visible()
    assert not errors,errors
    page.screenshot(path='/tmp/dos-skill-picker-desktop.png')
    browser.close()
    print('MP不足・長押しの詳細と復帰・技の選択と対象選択・広い画面の一覧 OK')
