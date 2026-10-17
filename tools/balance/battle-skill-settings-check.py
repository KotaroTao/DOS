"""戦闘中の作戦から技設定、保存、スマホ幅の折り返しを確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=board')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async()=>{
      const {G,startBattle}=__game;
      const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      window.souls=await import('/src/souls.js');
      window.combat=await import('/src/combat.js');
      G.prompt=false;G.animating=false;G.autoCombat=false;G.fastAnim=true;G._evOpening='preempt';
      for(const d of G.party){d.agi=999;d.skillOff=[];d.autoOff=[];}
      // 実在する習得技を全員に持たせ、どの人業が先手でも同じ設定を確認する。
      const keys=Object.keys(combat.SPELLS).filter(k=>combat.SPELLS[k].kind!=='field').slice(0,12);
      for(const d of G.party)d.spells=keys.slice();
      startBattle(combat.spawnCardEnemies('bs_mournshade',1).slice(0,1),{type:'monster',revealed:true});
    }''')
    page.wait_for_selector('#combat-menu .cmd-sub.has-tactics', timeout=20000)
    page.get_by_role('button', name='作戦 技の設定', exact=True).click()
    actor_index=page.evaluate('''()=>{window.skillD=__game.G.battle.current;return __game.G.party.indexOf(skillD);}''')
    page.locator('.pt-tac-who').nth(actor_index).click()
    row = page.locator('.pt-tac-settings .pt-skm-row').first
    key = page.evaluate('skillD.spells[0]')
    row.locator('.pt-skm-auto').click()
    assert page.evaluate('''async(k)=>{
      const {refDeserialize}=await import('/src/savegraph.js');
      return refDeserialize(JSON.parse(__game.inf.saveJSON())).party.find(d=>d.uid===skillD.uid).autoOff.includes(k);
    }''',key)
    assert page.evaluate('(k)=>souls.battleSkills(skillD).includes(k)&&!souls.autoSkills(skillD).includes(k)',key)
    row.locator('.pt-skm-tg').first.click()
    assert row.locator('.pt-skm-auto').is_disabled()
    assert page.evaluate('(k)=>!souls.battleSkills(skillD).includes(k)',key)
    row.locator('.pt-skm-tg').first.click()
    assert page.evaluate('(k)=>souls.battleSkills(skillD).includes(k)&&!souls.autoSkills(skillD).includes(k)',key)
    row.locator('.pt-skm-auto').click()
    assert page.evaluate('(k)=>souls.autoSkills(skillD).includes(k)',key)
    # 非表示を保存し、手番の一覧へ戻る。早出しも非表示技を使わない。
    page.locator('.pt-tac-settings .pt-skm-tg').first.click()
    saved = page.evaluate('''async()=>{
      const {refDeserialize}=await import('/src/savegraph.js');
      const snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      const d=snap.party.find(d=>d.uid===skillD.uid);return d.skillOff.includes(d.spells[0]);
    }''')
    assert saved
    for width,height in [(320,568),(360,640),(390,844),(430,932),(844,390),(1280,800)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(150)
        assert page.evaluate('''()=>{
          const card=document.querySelector('.pt-tac-settings').closest('.ui-sheet');
          return [...card.querySelectorAll('.pt-skm-row,.pt-skm-row button,.pt-tac-b')].every(e=>{
            const r=e.getBoundingClientRect(),c=card.getBoundingClientRect();
            return r.left>=c.left-1&&r.right<=c.right+1&&r.height>=44;
          })&&card.scrollWidth<=card.clientWidth+1;
        }'''), f'技設定のはみ出し {width}'
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/dos-battle-skill-settings.png')
    page.locator('.ui-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
    page.locator('.ui-sheet').last.get_by_role('button',name='閉じる',exact=True).click()
    assert page.evaluate("()=>!document.querySelector('#combat-menu .cmd-quick')?.textContent.replaceAll(String.fromCharCode(8203),'').includes(combat.SPELLS[skillD.spells[0]].name)")
    for width in [320,360,390,430,1280]:
        page.set_viewport_size({'width':width,'height':844})
        assert page.evaluate('''()=>[...document.querySelectorAll('#combat-menu .cmd-sub .btn')].every(e=>{
          const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width>=44&&r.height>=44;
        })'''), f'命令ボタンのはみ出し {width}'
    page.set_viewport_size({'width':320,'height':568})
    # 背の低い端末では既存の画面内スクロールで末尾の命令まで届く。
    for button in page.locator('#combat-menu .cmd-sub .btn').all():
        button.scroll_into_view_if_needed()
        assert button.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}')
    page.screenshot(path='/tmp/dos-battle-commands-320.png')
    assert not errors,errors
    print('戦闘の作戦→表示/非表示・オート/手動の即時反映、保存、320〜1280px・横向きのレイアウトを確認')
    browser.close()
