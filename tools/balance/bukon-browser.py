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
          b.stockAdd(G,{k:'flat_hp',lv:1},9);b.stockAdd(G,{k:'res_allElements',lv:10});b.stockAdd(G,{k:'J11',lv:10});b.stockAdd(G,{k:'flat_atk',lv:1});b.stockAdd(G,{k:'elem_def_water',lv:1});
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
          let row=[...document.querySelectorAll('.bk-sheet .bk-stock-row')].find(x=>clean(x.querySelector('.bk-stock-main').textContent)==='HP加算 +10');
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
            check(['HP加算 +10','STR加算 +1','水属性ダメージ軽減 5%','全属性耐性 50%','戦闘不能時復活 50%'].includes(clean(main.textContent)),'効果量付きの名称');
            check(getComputedStyle(icon).backgroundColor===getComputedStyle(main).color,'宝石も格の色');
            check(row.getBoundingClientRect().right<=window.innerWidth,'行が画面内');
            check(row.getBoundingClientRect().height<90,'一行表示');
            const label=main.querySelector('.ui-btn-l');
            check(label.getBoundingClientRect().width>40,'名称がつぶれない');
            const value=main.querySelector('.bk-name-value');check(value.getBoundingClientRect().right<=main.getBoundingClientRect().right,'効果量が枠内');
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
          for(const [name,description] of [['STR加算 +1','STRが1上昇'],['水属性ダメージ軽減 5%','水属性ダメージを5%軽減']]) {
            [...holder.querySelectorAll('.bk-stock-main')].find(x=>clean(x.textContent)===name).click();
            const detail=[...document.querySelectorAll('.bk-sheet')].at(-1);
            check(clean(detail.textContent).includes(description),'詳細の効果説明');
            check(!/Lv|個数/.test(clean(detail.textContent)),'詳細にLv・個数を表示しない');
            check(clean(detail.textContent).includes('対応：'),'詳細に部位');
            [...detail.querySelectorAll('button')].find(x=>clean(x.textContent)==='閉じる').click();
          }
          [...holder.querySelectorAll('button')].find(x=>clean(x.textContent)==='合成').click();
          check(document.body.textContent.includes('100'),'金貨表示');check(clean(document.body.textContent).includes('違うLv')||clean(document.body.textContent).includes('異なるLv'),'混合素材説明');
          check(game.bukonAction('fuse',null,{k:'flat_hp',lv:2}),'実操作窓口の合成');check(G.gold===9900,'100金貨課金');
          G.gold=0;const stock=JSON.stringify(G.bukonStock);check(!game.bukonAction('fuse',null,{k:'flat_hp',lv:2}),'金貨不足');check(JSON.stringify(G.bukonStock)===stock,'不足時素材不変');
          check(b.attachBlock({slot:'head',rar:'lr'},{k:'crit',lv:10}),'頭へ会心を宿せない');
          target.bukon=[{k:'flat_hp',lv:1}];
          const unlock=game.featureUnlocked;
          for(const unlocked of [false,true]) {
            game.featureUnlocked=key=>key==='enchant'?unlocked:unlock(key);
            UI.openParty(selected,{seg:'equip'});
            const cell=document.querySelector('.pt-slots [data-slot="weapon"]');check(!!cell,'館の装備欄');
            check(cell.querySelectorAll('.bk-socket').length===(unlocked?3:0),'館の武魂枠は解放後だけ');
            if(unlocked)check(cell.querySelectorAll('.bk-gem').length===1,'館の装着済み枠');
          }
          game.featureUnlocked=unlock;
          return '名称・説明・館の解放前後の枠・着脱・合成・色・表示幅 OK';
        }'''))
        assert not errors,errors
        page.close()
    browser.close()
