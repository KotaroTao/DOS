"""転生の実際の解放・装備の退避・保存・UI確認を検証する。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w54&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game,UI} = await import('/src/ui/ctx.js');
      const S = await import('/src/souls.js');
      const {ITEMS, equipLevelOf} = await import('/src/items.js');
      const {refDeserialize} = await import('/src/savegraph.js');
      const G=__game.G, checks=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg)};
      G.world={open:{},found:{},cleared:{},reported:{},beats:{},gates:{},fresh:{}};
      G.testUnlock=[];
      G.msq.prologue=null;
      G.state='town';
      const s=G.souls.find(s=>s.clsKey==='fighter');
      const d=G.party.find(d=>d.primary===s.uid);
      s.count=S.rankThresholds(S.SOUL_CLASSES.fighter.rarity)[4];
      s.capBonus=2; s.level=S.soulLevelCapOf(s);s.exp=123456;
      const before=JSON.stringify(s);
      check(!game.featureUnlocked('rebirth'),'章報告前は転生が閉鎖');
      check(!game.reincarnateSoul(s.uid) && JSON.stringify(s)===before,'未解放の転生は状態を変えない');
      G.world.reported.w57=1;
      check(game.featureUnlocked('rebirth'),'十四章の結びの報告で転生が解放');
      G.state='board';
      check(!game.reincarnateSoul(s.uid),'迷宮の中では転生しない');G.state='town';
      const item=Object.values(ITEMS).find(it=>it.slot==='weapon' && !it.twoHanded && it.cat==='ls' && equipLevelOf(it)>1);
      check(!!item,'Lv条件つきの装備を検査に使う');
      for(const k of Object.keys(d.equip))d.equip[k]=null;
      const weapon={...item,uid:987654};d.equip.weapon=weapon;G.inventory.length=0;
      check(game.soulRebirthPlan(s.uid).equipment.some(b=>b.item===weapon),'Lv1で使えない装備を事前表示');
      G.inventory.push(...Array.from({length:50},(_,i)=>({...weapon,uid:880000+i})));
      check(!!game.soulRebirthPlan(s.uid).reason,'装備を戻す持ち物の空きが必要');
      check(!game.reincarnateSoul(s.uid) && JSON.stringify(s)===before,'持ち物が満杯なら魂も装備も維持');
      G.inventory.length=0;
      check(!game.soulRebirthPlan(s.uid).reason,'空きを作ると転生できる');
      window.rebirthTest={uid:s.uid,before:JSON.stringify(s)};
      UI.openSoulList();
      return checks;
    }'''))
    page.locator('.sp-list-sheet button[aria-label="魂の転生"]:enabled').first.click()
    page.get_by_role('button',name='やめる',exact=True).click()
    assert page.evaluate('JSON.stringify(__game.G.souls.find(s=>s.uid===rebirthTest.uid))===rebirthTest.before')
    page.locator('.sp-list-sheet button[aria-label="魂の転生"]:enabled').first.click()
    page.get_by_role('button',name='Lv1から育て直す',exact=True).click()
    print(page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const s=__game.G.souls.find(s=>s.uid===rebirthTest.uid);
      const d=__game.G.party.find(d=>d.primary===s.uid);
      if(s.level!==1 || s.exp!==0 || s.rebirth!==1)throw Error('転生結果');
      if(d.equip.weapon || !d.items.some(it=>it.uid===987654))throw Error('装備の退避');
      if(d.hp>d.maxhp || d.mp>d.maxmp)throw Error('HP/MPの上限');
      const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      if(saved.souls.find(x=>x.uid===s.uid).rebirth!==1)throw Error('保存フィールド');
      if(game.reincarnateSoul(s.uid))throw Error('育成せずに再転生');
      const S=await import('/src/souls.js');
      __game.G.tut.done.fusion=true;
      const material=S.makeSoulInstance('fighter',1,1);
      material.rebirth=3;__game.G.souls.push(material);
      if(!game.fuseSouls(s.uid,[material.uid]))throw Error('転生した魂の融合');
      if(s.rebirth!==3)throw Error('融合は多い方の転生回数を引き継ぐ');
      return '転生の確認/取消・Lv1と経験値0・装備退避・HP/MP上限・実保存形式の往復・融合時の転生回数の継承を確認';
    }'''))
    assert not errors, errors
    page.screenshot(path='/tmp/chapter14-rebirth.png')
    browser.close()
