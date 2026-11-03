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
 g.shopStock=Object.fromEntries(Object.keys(ITEMS).slice(0,300).map(id=>[id,1]));g.shopAfx={};g.party.forEach(d=>d.jobLv=200);
 let calls=0;const orig=UI.equipSwapInfo;UI.equipSwapInfo=(...args)=>{calls++;return orig(...args)};
 const start=performance.now();UI.openShop('buy',{cat:'rec'});if(calls>300)throw Error(`比較の重複 ${calls}`);return {ms:performance.now()-start,calls,rows:document.querySelectorAll('.wpc-srow').length};
 }'''))
 page.wait_for_timeout(700)
 result=page.evaluate("""async()=>{
 const {UI,game}=await import('/src/ui/ctx.js');
 const box=document.querySelector('.wpc-list.buy');
 const initial=box.querySelectorAll('.wpc-srow').length;
 if(initial!==24)throw Error(`初期描画数 ${initial}`);
 for(let n=0;n<100;n++){
   const old=box.querySelectorAll('.wpc-srow').length;
   box.scrollTop=box.scrollHeight;box.dispatchEvent(new Event('scroll'));
   if(box.querySelectorAll('.wpc-srow').length===old)break;
 }
 const total=box.querySelectorAll('.wpc-srow').length;
 if(total<=initial)throw Error('スクロールで商品が増えない');
 const top=box.scrollTop;
 UI.openShop('buy');
 const restored=document.querySelector('.wpc-list.buy');
 if(Math.abs(restored.scrollTop-top)>1)throw Error(JSON.stringify({top,actual:restored.scrollTop,rows:restored.querySelectorAll('.wpc-srow').length,height:restored.scrollHeight}));
 const savedTop=restored.scrollTop;
 const {setPref}=await import('/src/ui/prefs.js');
 const buyer=game.G.party[1];buyer.primary=null;setPref('shopDollUid',buyer.uid);
 UI.openShop('buy',{cat:'rec'});
 if(document.querySelectorAll('.wpc-srow').length)throw Error('操作後に古い比較が残る');
 return {initial,total,restored:savedTop};
 }""")
 print(result)
 b.close()
