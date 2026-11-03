"""商会の比較回数・段階描画・スクロール復元を実画面で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},service_workers='block')
 page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
 page.wait_for_function('window.__game?.G.party.length === 6')
 print(page.evaluate('''async()=>{
 const {UI,game}=await import('/src/ui/ctx.js');const {ITEMS}=await import('/src/items.js');
 const g=game.G;g.irene.greeted=true;g.tut.cur=null;g.insightNotified=Number.MAX_SAFE_INTEGER;
 const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>g.tut.done[t.key]=true);g.msq.prologue={phase:'done',gifts:{}};
 g.shopStock=Object.fromEntries(Object.keys(ITEMS).slice(0,2000).map(id=>[id,1]));g.shopAfx={};g.party.forEach(d=>d.jobLv=200);
 let calls=0;const orig=UI.equipSwapInfo;UI.equipSwapInfo=(...args)=>{calls++;return orig(...args)};
 const start=performance.now();UI.openShop('buy',{cat:'rec'});if(calls>0)throw Error(`比較の重複 ${calls}`);return {ms:performance.now()-start,calls,rows:document.querySelectorAll('#town-screen .wpc-srow').length};
 }'''))
 page.wait_for_function("document.querySelector('#town-screen .wpc-list.buy:not(.scene-hold *)')")
 page.wait_for_timeout(700)
 result=page.evaluate("""async()=>{
 const {UI,game}=await import('/src/ui/ctx.js');
 const box=document.querySelector('#town-screen .wpc-list.buy:not(.scene-hold *)');
 const initial=box.querySelectorAll('#town-screen .wpc-srow').length;
 if(initial!==24)throw Error(`初期描画数 ${initial}`);
 for(let n=0;n<100;n++){
   const old=box.querySelectorAll('#town-screen .wpc-srow').length;
   box.scrollTop=box.scrollHeight;box.dispatchEvent(new Event('scroll'));
   if(box.querySelectorAll('#town-screen .wpc-srow').length===old)break;
 }
 const total=box.querySelectorAll('#town-screen .wpc-srow').length;
 if(total<=initial)throw Error('スクロールで商品が増えない');
 const top=box.scrollTop;
 game.renderTown();
 await new Promise(resolve=>setTimeout(resolve,1500));
 const restored=document.querySelector('#town-screen .wpc-list.buy:not(.scene-hold *)');
 if(Math.abs(restored.scrollTop-top)>1)throw Error(JSON.stringify({top,actual:restored.scrollTop,rows:restored.querySelectorAll('#town-screen .wpc-srow').length,height:restored.scrollHeight}));
 const savedTop=restored.scrollTop;
 const {setPref}=await import('/src/ui/prefs.js');
 const buyer=game.G.party[1];buyer.primary=null;setPref('shopDollUid',buyer.uid);
 UI.openShop('buy',{cat:'rec'});
 await new Promise(resolve=>setTimeout(resolve,1500));
 if(document.querySelectorAll('#town-screen .wpc-srow').length)throw Error('操作後に古い比較が残る');
 return {initial,total,restored:savedTop};
 }""")
 print(result)
 # おすすめ計算中に別の分類へ移っても、古い結果を差し込まない。
 print(page.evaluate("""async()=>{
 const {UI}=await import('/src/ui/ctx.js');
 UI.openShop('buy',{cat:'rec'});
 UI.openShop('buy',{cat:'use'});
 await new Promise(resolve=>setTimeout(resolve,500));
 if(document.querySelector('#town-screen .wpc-recommendations-loading:not(.scene-hold *)')||!document.querySelector('#town-screen .wpc-list.buy:not(.scene-hold *)'))throw Error(JSON.stringify({loading:document.querySelectorAll('#town-screen .wpc-recommendations-loading:not(.scene-hold *)').length,lists:document.querySelectorAll('#town-screen .wpc-list.buy:not(.scene-hold *)').length,roots:document.querySelectorAll('#town-screen > .wpc-shop').length}));
 return 'おすすめ計算の中断 OK';
 }"""))
 # PC共通一覧も2000件で検索と末尾へのキー操作を確認。
 page.evaluate("""async()=>{
 const {pcMasterDetail}=await import('/src/ui/pc.js');
 const root=document.createElement('div');root.id='bench';document.body.append(root);
 root.append(pcMasterDetail({key:'bench',batchSize:32,label:'商品',
 items:Array.from({length:2000},(_,i)=>({id:String(i),name:`商品${i}`})),
 getKey:x=>x.id,searchText:x=>x.name,
 summary:x=>document.createTextNode(x.name),detail:(x,pane)=>pane.textContent=x.name}));
 }""")
 assert page.locator('#bench .pc-list-row').count()==32
 page.locator('#bench .pc-search').fill('商品1999')
 assert page.locator('#bench .pc-list-row').count()==1
 page.locator('#bench .pc-search').fill('')
 assert page.locator('#bench .pc-list-row').count()==32
 page.locator('#bench .pc-list-row').first.focus()
 page.keyboard.press('End')
 assert page.locator('#bench .pc-list-row[aria-pressed=true]').inner_text()=='商品1999'
 print('PC 2000件の検索・Endキー OK')
 b.close()
