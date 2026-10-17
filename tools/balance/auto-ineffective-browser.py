"""実際のオート操作で低ダメージのMP節約・停滞停止・再開を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=board')
    page.wait_for_function('window.__game?.G.party.length>0')
    page.evaluate('''async()=>{
      const {G,startBattle}=__game;
      const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      G.party=G.party.slice(0,1);G.prompt=false;G.animating=false;G.autoCombat=false;G.fastAnim=true;G._evOpening='preempt';
      G.party[0].agi=999;G.party[0].spells=['HALITO'];G.party[0].skillOff=[];G.party[0].autoOff=[];
      startBattle([{uid:9990,key:'ev_auto_wall',name:'硬い敵',mon:{race:'humanoid'},side:'enemy',lv:40,hp:1000000,maxhp:1000000,atk:1,vit:1e8,agi:1,alive:true}],{type:'monster',revealed:true});
    }''')
    page.wait_for_selector('#combat-menu .cmd-main',timeout=20000)
    page.evaluate('''()=>{
      const {G}=__game,a=G.party[0],e=G.battle.enemies[0];
      Object.assign(a,{atk:1,int:1,vit:1e8,hp:1000000,maxhp:1000000,mp:10000,maxmp:10000,soulMp:0,passiveMap:{},gearPerks:[],gearMisc:{},tactic:'all',spells:['HALITO'],wScale:null,weaponPower:0,wBase:0,multistrike:0,dualRate:0});
      e.vit=1e8;e.atk=1;
      window.startRound=G.battle._roundNo;
    }''')
    page.locator('#combat-menu .cmd-sub button').filter(has_text='オート').click()
    page.wait_for_function('!__game.G.autoCombat && !__game.G.animating && __game.G.battle._roundNo>=startRound+3',timeout=60000)
    assert page.evaluate('__game.G.party[0].mp')==10000,'1ダメージの呪文でMPを使わない'
    assert page.evaluate("__game.logHistory().some(l=>l.text?.includes('敵をほとんど削れない'))"),'停滞の理由を表示'
    page.wait_for_selector('#combat-menu .cmd-main',timeout=10000)
    page.screenshot(path='/tmp/dos-auto-stalled-mobile.png')
    # 再開した直後は、古い停滞の数えで停止しない。
    old_round=page.evaluate('__game.G.battle._roundNo')
    page.locator('#combat-menu .cmd-sub button').filter(has_text='オート').click()
    page.wait_for_function('(r)=>__game.G.battle._roundNo>r',arg=old_round,timeout=20000)
    assert page.evaluate('__game.G.autoCombat'),'再開後は数え直す'
    page.evaluate('''async()=>{
      const {G}=__game;const {decideAuto}=await import('/src/autotactics.js');
      const a=G.party[0],e=G.battle.enemies[0];
      // 無効な異常と有効な攻撃を未開示でも分ける。
      const {SPELLS}=await import('/src/combat.js');
      const {enemyReveal}=await import('/src/ui/itemview.js');
      a.atk=100;a.int=100;a.spells=['RAIKOUKEN','HALITO'];a.tactic='all';
      e.vit=1;e.physResist=100;e.key='bs_ghoul';e.mon={race:'humanoid'};G.codex.mon.bs_ghoul={kills:0};
      if(enemyReveal(e).stats||enemyReveal(e).lore)throw Error('図鑑を開示した');
      if(decideAuto(G.battle,a).spellKey!=='HALITO')throw Error('未開示の物理無効を回避していない');
    }''')
    for width,height in [(320,568),(390,844),(1366,900)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'はみ出し {width}'
    page.locator('#combat-menu button').filter(has_text='オート解除').click()
    page.wait_for_function('!__game.G.autoCombat && !__game.G.animating',timeout=20000)
    page.wait_for_selector('#combat-menu .cmd-main')
    page.evaluate("()=>{const {G}=__game;G.battle.enemies[0].physResist=100;G.battle.enemies[0].magResist=100;G.party[0].spells=['HALITO'];}")
    mp=page.evaluate('__game.G.party[0].mp')
    page.locator('#combat-menu .cmd-sub button').filter(has_text='オート').click()
    page.wait_for_function('!__game.G.autoCombat',timeout=10000)
    assert page.evaluate('__game.G.party[0].mp')==mp,'全て無効なら即時に停止し、MPを使わない'
    assert page.evaluate("__game.logHistory().some(l=>l.text?.includes('有効な行動がない'))")
    assert not errors,errors
    print('実オートでMP消費なし・停滞3ターン停止と理由・再開、未開示の無効回避と図鑑の非開示、スマホ/PCを確認')
    browser.close()
