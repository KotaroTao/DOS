"""localhost:8000で最適装備の承認前の保全とスマホ表示を確認する。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {openSheet}=await import('/src/ui/party.js');
      const {SLOTS,recalc}=await import('/src/items.js');
      const {equipSignature}=await import('/src/autoequip.js');
      const G=__game.G,out=[],check=(v,t)=>{if(!v)throw Error(t);out.push(t)};
      sheet.closeAll();G.tut={done:{}};G.inventory.length=0;
      for(const d of G.party) {for(const k of SLOTS)d.equip[k]=null;recalc(d);}
      for(const id of ['cap','cap','cap'])G.inventory.push(game.cloneItem(id));
      const d=G.party[0],sig=equipSignature(G.party),hp=d.hp,mp=d.mp;
      openSheet(d,null,{town:true});
      check(!document.querySelector('.pt-auto,.pt-head-join'),'旧ボタンを撤去');
      const btns=[...document.querySelectorAll('.pt-head .pt-equip-actions button')];
      check(btns.length===2&&btns[1].getBoundingClientRect().top>=btns[0].getBoundingClientRect().bottom,'シートの全体最適と最適装備を縦に表示');
      btns[0].click();
      check(!!document.querySelector('.pt-ae-sheet'),'個人の確認画面');
      check(document.querySelectorAll('.pt-ae-card .pt-ae-tg').length===1,'変更が1件ならカードの承認は1つだけ');
      check(sig===equipSignature(G.party)&&hp===d.hp&&mp===d.mp,'確認だけでは装備・袋・HP・MPは不変');
      sheet.top().close();check(sig===equipSignature(G.party),'未承認で閉じても不変');
      await new Promise(r=>setTimeout(r,650));UI.autoEquip('all');const proposed=document.querySelectorAll('.pt-ae-card').length;check(proposed>1,'全員の変更案を同時に表示');
      check(sig===equipSignature(G.party),'全員も承認前は不変');
      document.querySelector('.pt-ae-action button').click();
      check(G.party.filter(d=>d.equip.head).length===1,'選んだ装備だけを承認');
      document.querySelector('.pt-ae-action button').click();check(sig===equipSignature(G.party),'装備単位の取消');
      document.querySelector('.pt-ae-sheet .ui-sheet-foot .k-primary').click();
      await new Promise(r=>setTimeout(r,250));check(G.party.filter(d=>d.equip.head).length===proposed,'すべて承認で全員に適用');
      await new Promise(r=>setTimeout(r,650));
      d.equip.head=null;recalc(d);G.inventory.splice(0,G.inventory.length,game.cloneItem('cap'),game.cloneItem('robe'));
      UI.autoEquip(d);
      const bulk=document.querySelector('.pt-ae-top button');
      check(bulk?.textContent==='まとめて承認'&&document.querySelectorAll('.pt-ae-action button').length===2,'複数装備はまとめて承認と個別承認を区別');
      bulk.click();check(!!d.equip.head&&!!d.equip.body&&bulk.textContent==='まとめて戻す','人業単位の一括承認');
      bulk.click();check(!d.equip.head&&!d.equip.body,'人業単位の一括取消');
      sheet.top().close();
      return out;
    }'''))
    for width in [320,390,768]:
        page.set_viewport_size({'width':width,'height':844})
        page.wait_for_timeout(150)
        page.screenshot(path=f'/tmp/mobile-equipment-{width}.png')
        assert page.evaluate('''()=>[...document.querySelectorAll('.pt-head .pt-equip-actions button')].every(b=>{const r=b.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.height>=44})''')
    page.screenshot(path='/tmp/mobile-equipment.png')
    assert not errors,errors
    browser.close()
