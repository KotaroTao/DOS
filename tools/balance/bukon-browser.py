"""武魂の実画面、金貨課金、部位制限、色、旧記録の保管を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,768,937]:
        page=browser.new_page(viewport={'width':width,'height':844},service_workers='block',reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w54&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length>0')
        print(width,page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');const b=await import('/src/bukon.js');
          const clean=x=>x.replaceAll('\u200b','');const G=game.G;const check=(v,m)=>{if(!v)throw Error(m)};
          G.testPlay=true;G.state='town';G.testUnlock=['enchant','bukonFusion'];G.tut={done:{enchant:1,bukonFusion:1},midUnlockVersion:1};G.gold=10000;G.bukonStock={};G.bukonGift=true;
          b.stockAdd(G,{k:'flat_hp',lv:1},9);b.stockAdd(G,{k:'res_allElements',lv:10});b.stockAdd(G,{k:'J11',lv:10});
          UI.openShop('enchant');
          const holder=document.querySelector('.bk-panel');
          check(!clean(holder.textContent).includes('武魂の手引き'),'手引きを削除');
          check(document.querySelectorAll('.wpc-character').length>=6,'共通のキャラ選択');
          check(holder.querySelectorAll('.pt-slot').length===8,'館と同じ8部位');
          for(const cell of holder.querySelectorAll('.pt-slot')) {
            check(cell.getBoundingClientRect().right<=holder.getBoundingClientRect().right+1,'装備欄が枠内');
            if(cell.querySelector('.bk-sockets'))check(cell.querySelectorAll('.bk-socket').length>=1&&cell.querySelectorAll('.bk-socket').length<=3,'丸い枠1〜3');
          }
          const selected=game.allDolls().find(d=>String(d.uid)===document.querySelector('.wpc-character.selected').dataset.dollUid);
          const {ITEMS}=await import('/src/items.js');
          const target=selected.equip.weapon={...Object.values(ITEMS).find(it=>it.slot==='weapon'),rar:'lr',bukon:[]};
          check(!!target,'着脱を試す装備');target.bukon=[];
          let gearTab=[...holder.querySelectorAll('button')].find(x=>clean(x.textContent)==='装備に宿す・外す');gearTab.click();
          const targetCell=[...holder.querySelectorAll('.pt-slot')].find(x=>selected.equip[x.dataset.slot]===target);
          check(targetCell.querySelectorAll('.bk-socket').length===b.bukonSlots(target),'レア度に一致する穴');
          targetCell.click();
          let row=[...document.querySelectorAll('.bk-sheet .bk-stock-row')].find(x=>clean(x.querySelector('.bk-stock-main').textContent)==='HP加算');
          check(!!row,'宿せる武魂一覧');
          for(const button of row.querySelectorAll('button'))check(button.getBoundingClientRect().right<=row.getBoundingClientRect().right+1,'候補の操作が枠内');
          [...row.querySelectorAll('button')].find(x=>clean(x.textContent)==='宿す').click();
          check(target.bukon.some(x=>x.k==='flat_hp'),'一覧から装着');
          const filled=holder.querySelector('.bk-socket.bk-gem');
          check(!!filled,'装着枠の宝石');check(getComputedStyle(filled).backgroundColor===getComputedStyle(filled).color,'装着枠も格の色');
          [...document.querySelectorAll('.bk-sheet button')].find(x=>clean(x.textContent)==='外す').click();
          check(!target.bukon.length,'一覧から取り外し');
          [...document.querySelectorAll('.bk-sheet button')].find(x=>clean(x.textContent)==='閉じる').click();
          const tab=[...holder.querySelectorAll('button')].find(x=>clean(x.textContent)==='保管中の武魂');check(!!tab,'タブがない: '+holder.textContent+' / '+game.enchantClosed());tab.click();
          check(clean(holder.textContent).includes('全属性耐性'),'全属性の表示');
          const red=[...holder.querySelectorAll('span')].find(x=>clean(x.textContent).includes('全属性耐性'));check(getComputedStyle(red).color==='rgb(255, 98, 98)','LRの赤');
          for(const row of holder.querySelectorAll('.bk-stock-row')) {
            const main=row.querySelector('.bk-stock-main'),icon=main.querySelector('.bk-gem');
            check(clean(main.textContent)===b.bukonDef(main.textContent.includes('HP')?'flat_hp':main.textContent.includes('全属性')?'res_allElements':'J11').name,'名称だけを表示');
            check(getComputedStyle(icon).backgroundColor===getComputedStyle(main).color,'宝石も格の色');
            check(row.getBoundingClientRect().right<=window.innerWidth,'行が画面内');
            check(row.getBoundingClientRect().height<90,'一行表示');
            const label=main.querySelector('.ui-btn-l');
            check(label.getBoundingClientRect().width>40,'名称がつぶれない');
            for(const control of row.querySelectorAll('button'))check(control.getBoundingClientRect().right<=row.getBoundingClientRect().right+1,'操作が行内に収まる');
            check(row.lastElementChild.getBoundingClientRect().width<100,'保護が行幅を占有しない');
          }
          const featureUnlocked=game.featureUnlocked;
          game.featureUnlocked=key=>key==='bukonFusion'?false:featureUnlocked(key);
          tab.click();
          check(!holder.querySelector('.bukon-tutorial-fuse'),'解放前に合成を隠す');
          for(const row of holder.querySelectorAll('.bk-stock-row')) {
            check(row.querySelector('.ui-btn-l').getBoundingClientRect().width>40,'解放前も名称が見える');
            check(row.lastElementChild.getBoundingClientRect().right<=row.getBoundingClientRect().right+1,'解放前も保護が行内');
          }
          game.featureUnlocked=featureUnlocked;
          [...holder.querySelectorAll('button')].find(x=>clean(x.textContent)==='保管中の武魂').click();
          holder.querySelector('.bk-stock-main').click();
          check(clean(document.body.textContent).includes('個数：'),'詳細に個数');
          check(clean(document.body.textContent).includes('対応：'),'詳細に部位');
          [...document.querySelectorAll('.ui-sheet button')].find(x=>clean(x.textContent)==='閉じる')?.click();
          [...holder.querySelectorAll('button')].find(x=>clean(x.textContent)==='合成').click();
          check(document.body.textContent.includes('100'),'金貨表示');check(clean(document.body.textContent).includes('違うLv')||clean(document.body.textContent).includes('異なるLv'),'混合素材説明');
          check(game.bukonAction('fuse',null,{k:'flat_hp',lv:2}),'実操作窓口の合成');check(G.gold===9900,'100金貨課金');
          G.gold=0;const stock=JSON.stringify(G.bukonStock);check(!game.bukonAction('fuse',null,{k:'flat_hp',lv:2}),'金貨不足');check(JSON.stringify(G.bukonStock)===stock,'不足時素材不変');
          check(b.attachBlock({slot:'head',rar:'lr'},{k:'crit',lv:10}),'頭へ会心を宿せない');
          return '表示・赤色・混合素材説明・合成課金・金貨不足・部位制限 OK';
        }'''))
        assert not errors,errors
        page.close()
    browser.close()
