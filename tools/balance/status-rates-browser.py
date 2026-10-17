"""戦闘の技一覧・対象選択・詳細の成功率と、スマホ/PCの表示を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

def plain(locator):
    return locator.inner_text().replace('\u200b','')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=board')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.evaluate('''async()=>{
      const {G,startBattle}=__game;
      const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      G.prompt=false;G.animating=false;G.autoCombat=false;G.fastAnim=true;G._evOpening='preempt';
      for(const d of G.party){d.agi=999;d.mp=d.maxmp=9999;d.spells=['RAIKOUKEN','KATINO','SHIBIREBARI'];d.skillOff=[];d.autoOff=[];}
      const e=(uid,key,res)=>({uid,key,name:'検証の敵'+uid,mon:{race:'humanoid'},side:'enemy',lv:52,hp:100000,maxhp:100000,atk:1,vit:1,agi:1,alive:true,resists:{paralyze:res,sleep:res}});
      G.codex.mon.bs_ghoul={kills:0};
      startBattle([e(9990,'ev_rate_a',40),e(9991,'bs_ghoul',0)],{type:'monster',revealed:true});
    }''')
    page.wait_for_selector('#combat-menu .cmd-main',timeout=20000)
    page.evaluate('''()=>{
      const b=__game.G.battle;
      for(const d of b.party){d.jobLv=40;d.passiveMap={};d.gearMisc={};}
      for(const e of b.enemies)e.lv=52;
    }''')
    page.locator('#combat-menu .cmd-main button').nth(2).click()
    assert '麻痺 9〜15%（目安・抵抗未判明）' in plain(page.locator('.spell-skill').nth(0))
    assert '眠り 18〜30%（目安・抵抗未判明）' in plain(page.locator('.spell-skill').nth(1))
    for width,height in [(320,568),(390,844),(844,390),(1366,900)]:
        page.set_viewport_size({'width':width,'height':height})
        for row in page.locator('.spell-skill').all():
            row.scroll_into_view_if_needed()
            assert row.evaluate('''e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1;}'''),f'技一覧 {width}'
        assert page.locator('.battle-skill-picker .sp-status-rates').count()==3
    page.set_viewport_size({'width':390,'height':844})
    page.locator('.spell-skill').first.scroll_into_view_if_needed()
    page.screenshot(path='/tmp/dos-status-skills-mobile.png')
    # 長押し詳細から、全体技も敵ごとの率を見られる。
    page.evaluate("async()=>{const {showSkillPopup}=await import('/src/ui/itemview.js');showSkillPopup('KATINO');}")
    detail=plain(page.locator('.ui-skill-sheet .sp-status-rates'))
    assert '眠り 18%' in detail and '眠り 最大30%（抵抗未判明）' in detail,detail
    page.locator('.ui-skill-sheet').get_by_role('button',name='閉じる',exact=True).click()
    page.locator('.spell-skill').first.click()
    page.wait_for_selector('#combat-menu[data-mode="target"]')
    text=plain(page.locator('#combat-menu .target-list'))
    assert '麻痺 9%' in text and '麻痺 最大15%（抵抗未判明）' in text,text
    for width,height in [(320,568),(390,844),(844,390),(1366,900)]:
        page.set_viewport_size({'width':width,'height':height})
        for row in page.locator('.tgt').all():
            row.scroll_into_view_if_needed()
            assert row.evaluate('''e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1;}'''),f'対象選択 {width}'
        for label in page.locator('.tgt .sp-status-rates').all():
            assert label.evaluate('''e=>{const p=e.parentElement.getBoundingClientRect(),r=e.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right+1;}''')
    page.screenshot(path='/tmp/dos-status-targets-desktop.png')
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/dos-status-targets-mobile.png')
    # 既知の完全無効は0%、慧眼なら未判明の抵抗も実値を表示する。予測だけで乱数を動かさない。
    page.evaluate('''async()=>{
      const {spellStatusPreview}=await import('/src/ui/itemview.js');
      const {SPELLS}=await import('/src/combat.js');
      const {rngState}=await import('/src/rng.js');
      const b=__game.G.battle,a=b.current,t=b.enemies[1];
      const before=JSON.stringify(rngState());
      t.resists.paralyze=100;a.gearMisc={insight:true};
      const text=spellStatusPreview(b,a,SPELLS.RAIKOUKEN,[t]).textContent;
      if(!text.includes('麻痺 0%')||text.includes('未判明'))throw Error(text);
      if(JSON.stringify(rngState())!==before)throw Error('表示で乱数を消費');
    }''')
    assert not errors,errors
    print('技一覧・全体技詳細・単体対象の成功率、未判明の目安/慧眼/無効、320〜1366pxと横向き、乱数非消費を確認')
    browser.close()
