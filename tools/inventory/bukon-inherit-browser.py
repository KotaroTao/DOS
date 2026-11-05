"""武魂引き継ぎの確認・取消・装備失敗・実行をスマホ幅で検証。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town',wait_until='domcontentloaded')
 page.wait_for_function('window.__game?.G.party.length > 0')
 page.evaluate('''async()=>{
 const {game}=await import('/src/ui/ctx.js');
 const {sheet}=await import('/src/ui/kit.js');
 const {openCandidates}=await import('/src/ui/party.js');
 const {recalc}=await import('/src/items.js');
 const G=__game.G,d=G.party[0];sheet.closeAll();G.tut={done:{}};
 const old={...game.cloneItem('dagger',50),bukon:[{k:'flat_atk',lv:20}]};
 const next={...game.cloneItem('dagger',50),bukon:[{k:'flat_hp',lv:3}]};
 G.inventory.splice(0,G.inventory.length,next);d.equip.weapon=old;recalc(d);
 window.inheritTest={old,next,d};openCandidates(d,'weapon');
 }''')
 page.evaluate("""async()=>{
 const {game}=await import('/src/ui/ctx.js');const {d,old,next}=inheritTest;
 old.locked=true;const r=game.equipAt(d,next,'weapon',d);
 if(r.ok || old.bukon[0].lv!==20 || next.bukon[0].lv!==3)throw Error('失敗時に武魂が変化した');
 delete old.locked;
 }""")
 assert page.get_by_role('button',name='武魂を引き継いで装備',exact=True).count()==0
 page.get_by_role('button',name='装備',exact=True).click()
 page.wait_for_function('inheritTest.d.equip.weapon===inheritTest.next')
 assert page.evaluate('inheritTest.next.bukon[0].lv===20 && inheritTest.old.bukon.length===0 && __game.G.bukonStock["flat_hp:3"]==="1"')
 page.get_by_role('button',name='元に戻す',exact=True).click()
 assert page.evaluate('inheritTest.d.equip.weapon===inheritTest.old&&inheritTest.old.bukon[0].lv===20&&inheritTest.next.bukon[0].lv===3')
 page.evaluate("""async()=>{
 const {game,UI}=await import('/src/ui/ctx.js'),{sheet}=await import('/src/ui/kit.js'),{recalc}=await import('/src/items.js');
 const {d,old,next}=inheritTest;sheet.closeAll();
 old.bukon=[{k:'flat_atk',lv:20},{k:'flat_mp',lv:9}];old.rar='lr';next.rar='c';next.atk=999;next.bukon=[];
 game.G.bukonStock={};recalc(d);UI.autoEquip(d);
 }""")
 auto=page.locator('.pt-ae-sheet')
 assert auto.locator('.eq-bukon-change').count()==1
 assert '失う' in auto.locator('.eq-bukon-change').inner_text()
 assert 'MP加算' in auto.locator('.eq-bukon-change').inner_text()
 assert auto.locator('.eq-bukon-change .bk-gem').count()==1
 auto.locator('.pt-ae-action button').first.click()
 assert page.evaluate('inheritTest.d.equip.weapon===inheritTest.next&&inheritTest.next.bukon[0].lv===20&&__game.G.bukonStock["flat_mp:9"]==="1"')
 auto.locator('.pt-ae-action button').first.click()
 assert page.evaluate('inheritTest.d.equip.weapon===inheritTest.old&&inheritTest.old.bukon.length===2&&!__game.G.bukonStock["flat_mp:9"]')
 auto.get_by_role('button',name='閉じる',exact=True).first.click()
 page.evaluate("""async()=>{const {UI}=await import('/src/ui/ctx.js');inheritTest.next.rar='lr';UI.autoEquip(inheritTest.d);}""")
 assert page.locator('.ui-sheet-wrap:not(.closing) .pt-ae-sheet .eq-bukon-change').count()==0
 assert not errors,errors
 print('標準の装備・引き継ぎ・失敗時不変・回収・元に戻す: OK')
 b.close()
