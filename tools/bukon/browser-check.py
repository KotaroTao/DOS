from playwright.sync_api import sync_playwright
import base64
# 未取得の絵は仮画像に置き換え、操作・配置・状態変化を検査する。
PIXEL=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
    page.set_default_timeout(30000)
    page.route('**/art/**',lambda r:r.fulfill(body=PIXEL,content_type='image/png'))
    errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('ERROR',e,flush=True)))
    page.goto('http://localhost:8000/?testDungeon=w26&testPlace=town&testUnlock=enchant,bukonFusion',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'), b=await import('/src/bukon.js'),{ITEMS}=await import('/src/items.js');
      const G=game.G;G.tut.done.enchant=true;G.tut.cur=null;G.bukonStock={};G.bukonGift=true;
      const it=game.cloneItem(Object.values(ITEMS).find(x=>x.slot==='body'&&x.rar==='r').id,50);G.inventory.push(it);
      b.stockAdd(G,{k:'flat_hp',lv:1},9);b.stockAdd(G,{k:'pct_hp',lv:9},1);
      window.bukonTest={it,game,b,UI};UI.openShop('enchant');return '商会表示';
    }'''),flush=True)
    page.locator('.bk-panel .ec-afx-row button').first.click()
    page.get_by_role('button',name='選んだ武魂を宿す（無料）').click()
    page.locator('.ui-confirm .ui-sheet-foot button').first.click()
    page.wait_for_function('bukonTest.it.bukon?.length === 1')
    assert page.evaluate('bukonTest.it.bukon[0].k')=='flat_hp'
    page.get_by_role('button',name='外して保管').click()
    page.wait_for_function('bukonTest.it.bukon?.length === 0')
    page.locator('.ec-sheet .ui-sheet-foot button').last.click()
    page.wait_for_function('!document.querySelector(".ec-sheet")')
    page.get_by_role('button',name='保管中の武魂').click()
    page.locator('.bk-panel .ec-afx-row').filter(has_text='HP+10').get_by_role('button',name='合成',exact=True).click()
    page.get_by_role('button',name='内容を確認して合成').click()
    page.locator('.ui-confirm .ui-sheet-foot button').first.click()
    page.wait_for_function('bukonTest.game.G.bukonStock["flat_hp:2"] === "1"')
    assert page.evaluate('bukonTest.game.G.bukonStock["flat_hp:1"]')=='6'
    assert page.evaluate('bukonTest.game.G.gold')>0
    print(page.evaluate('''async()=>{
      const {game,b,it}=bukonTest,{G}=game;
      const {CHAPTERS}=await import('/src/story.js');
      const {DUNGEONS}=__game.inf;
      // 実際の章判定（試遊の強制解放を外す）。
      const unlock=G.testUnlock;G.testUnlock=[];
      const three=CHAPTERS.find(c=>c.no===3),six=CHAPTERS.find(c=>c.no===4);
      const reported=G.world.reported;G.world.reported={};
      if(game.featureUnlocked('enchant') || game.featureUnlocked('bukonFusion'))throw Error('解放前');
      G.world.reported[three.finale]=1;if(!game.featureUnlocked('enchant') || game.featureUnlocked('bukonFusion'))throw Error('3章');
      for(const id of six.dungeons.slice(0,2))G.world.reported[id]=1;
      if(!game.featureUnlocked('bukonFusion'))throw Error('4章');
      G.world.reported=reported;
      G.testUnlock=unlock;
      // ドロップと在庫分離。
      const idx=G.dungeonIdx,state=G.state;G.state='board';
      G.dungeonIdx=DUNGEONS.findIndex(d=>d.id==='w01');
      const early=game.cloneItem(it.id,50);game.markDungeonLoot(early);if(early.bukon)throw Error('過去迷宮に付与');
      G.dungeonIdx=DUNGEONS.findIndex(d=>d.id===six.dungeons[0]);
      const late=game.cloneItem(it.id,50);game.markDungeonLoot(late);if(late.bukon?.length!==1)throw Error('4章ドロップ');
      game.markDungeonLoot(late);if(late.bukon.length!==1)throw Error('二重抽選');
      const soul={...late.bukon[0]},old=BigInt(G.bukonStock[b.bukonKey(soul)] || 0);
      delete late.unidentified;game.shopReceive(late);
      if(late.bukon || BigInt(G.bukonStock[b.bukonKey(soul)])!==old+1n)throw Error('売却で回収しない');
      if(game.shopAfxItem(late.id))throw Error('武魂つきで棚へ保存');
      const discarded=game.cloneItem(it.id,50);discarded.bukon=[{k:'flat_hp',lv:3}];G.inventory.push(discarded);
      if(!game.dropFromBag(G.party[0],discarded) || G.bukonStock['flat_hp:3']!=='1')throw Error('廃棄回収');
      G.state=state;G.dungeonIdx=idx;
      // 保存編成は武魂を複製せず、保管分を再利用して復元する。
      const forms=await import('/src/formations.js');const d=G.party[0];
      const {ITEMS,canEquip}=await import('/src/items.js');
      const equipped=game.cloneItem(Object.values(ITEMS).find(x=>x.slot==='body' && canEquip(d,x)).id,50);
      G.inventory.push(equipped);if(!game.doEquip(d,equipped).ok)throw Error('検査装備');
      if(equipped){equipped.bukon=[{k:'flat_hp',lv:1}];
        if(!forms.saveFormation(G,0,'武魂検査').ok)throw Error('編成保存');
        b.recoverBukon(G,equipped);
        const result=forms.applyFormation(G,0,{subSlots:2,soulChange:true});
        if(!result.ok || equipped.bukon?.[0]?.k!=='flat_hp')throw Error('武魂構成復元 '+result.msg);
      }
      const source=game.cloneItem(it.id,50),target=game.cloneItem(it.id,50);
      source.bukon=[{k:'flat_hp',lv:2},{k:'pct_hp',lv:3}];G.inventory.push(source,target);
      if(!game.bukonAction('transfer',target,{source}) || source.bukon || target.bukon?.length!==2)throw Error('一括移植');
      const orphan={...target};if(game.bukonAction('detach',orphan,0))throw Error('所有しない写しの回収');
      return 'OK 章解放・4章の新規ドロップ・二重抽選防止・売却/廃棄回収・武魂なしの棚・編成復元・一括移植・所有検査';
    }'''),flush=True)
    print(page.evaluate('''async()=>{
      const {game,b,UI}=bukonTest,{G}=game;
      b.stockAdd(G,{k:'J11',lv:1},2);b.stockAdd(G,{k:'X30',lv:1});
      UI.openShop('enchant');
      return '激レアの在庫を追加';
    }'''),flush=True)
    # 再描画後は現在の「保管中」の一覧で名前と合成対象外表示を確認。
    page.wait_for_function('document.querySelector(".bk-panel")?.textContent.includes("不屈")')
    legend=page.locator('.bk-panel .ec-afx-row').filter(has_text='不屈')
    assert legend.count()==1
    assert legend.get_by_role('button',name='合成',exact=True).count()==0
    assert '合成対象外' in legend.inner_text().replace('\u200b','')
    print(page.evaluate('''()=>{
      const {game,b}=bukonTest,{G}=game;const it=game.bukonTargets().find(it=>!it.bukon?.length && !it.locked && !it.cursed);
      if(!it)throw Error('装着先');
      const before=G.gold;
      if(!game.bukonAction('attach',it,{k:'J11',lv:1}))throw Error('不屈を宿せない');
      if(game.bukonAction('attach',it,{k:'J11',lv:1}))throw Error('同じ装備に二重装着');
      if(!game.bukonAction('detach',it,it.bukon.findIndex(b=>b.k==='J11')))throw Error('不屈を外せない');
      if(G.bukonStock['J11:1']!=='2'||G.gold!==before)throw Error('回収・無料');
      return 'OK 激レアの名前表示・合成対象外・無料装着/回収・同効果重複禁止';
    }'''),flush=True)
    for width in [320,390,768]:
        page.set_viewport_size({'width':width,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
    print('OK 実ブラウザ：商会タブ・装着・取り外し・確認して合成・320/390/768px',flush=True)
    assert not errors,errors
    page.screenshot(path='/tmp/dos-bukon-mobile.png')
    browser.close()
