"""後衛の最適装備と、承認・取消直後の赤丸更新を実ブラウザで確認する。"""
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
      const {ITEMS,SLOTS,recalc,canEquip}=await import('/src/items.js');
      const {planBestEquip,isMeleeWeapon}=await import('/src/autoequip.js');
      const {gearScore}=await import('/src/ui/itemview.js');
      const G=__game.G,out=[],check=(v,t)=>{if(!v)throw Error(t);out.push(t)};
      sheet.closeAll();G.tut={done:{}};G.inventory.length=0;
      for(const d of G.party){for(const k of SLOTS)d.equip[k]=null;recalc(d);}
      const d=G.party[3];
      // 後衛の僧侶にとって改善になる実際の近接武器を使う。
      let weapon;
      for(const id of Object.keys(ITEMS)){
        const it=game.cloneItem(id);
        if(!isMeleeWeapon(it)||!canEquip(d,it))continue;
        G.inventory.splice(0,G.inventory.length,it);
        if(planBestEquip([d],{pool:G.party,canEquip,recalc,score:gearScore}).moves.length){weapon=it;break;}
      }
      check(!!weapon,'後衛の僧侶が使える近接武器を準備');
      check(UI.hasBetterGear(d),'後衛の改善も赤丸の対象');
      const host=document.createElement('div');document.body.appendChild(host);UI.watchGearPortrait(host,d);
      const result=UI.autoEquip(d);check(result.ok&&!!document.querySelector('.pt-ae-sheet'),'後衛の近接武器で確認画面が開く');
      const card=document.querySelector('.pt-ae-card');check(!!card.querySelector('.gear-upgrade-dot'),'承認前の肖像に赤丸');
      card.querySelector('.pt-ae-action button').click();
      check(d.equip.weapon===weapon,'承認で後衛に近接武器を装備');
      check(!UI.hasBetterGear(d)&&!host.querySelector('.gear-upgrade-dot')&&!card.querySelector('.gear-upgrade-dot'),'画面を閉じずに全肖像の赤丸が即座に消える');
      card.querySelector('.pt-ae-action button').click();
      check(UI.hasBetterGear(d)&&!!host.querySelector('.gear-upgrade-dot')&&!!card.querySelector('.gear-upgrade-dot'),'取消で赤丸が即座に戻る');
      card.querySelector('.pt-ae-action button').click();sheet.top().close();
      await new Promise(r=>setTimeout(r,650));
      const no=UI.autoEquip(d);check(!no.ok&&!!document.querySelector('.ui-toasts.top .ui-toast'),'変更なしでも最前面に結果を通知');
      d.equip.weapon=null;G.inventory.splice(0,G.inventory.length,weapon);weapon.locked=true;recalc(d);
      check(!UI.hasBetterGear(d),'ロック品だけなら赤丸を出さない');
      weapon.locked=false;weapon.cursed=true;check(!UI.hasBetterGear(d),'呪いの品だけなら赤丸を出さない');
      G.inventory.splice(0,G.inventory.length,game.cloneItem('cap'),game.cloneItem('robe'));
      UI.autoEquip(d);const partial=document.querySelector('.pt-ae-card');
      partial.querySelector('.pt-ae-action button').click();
      check(UI.hasBetterGear(d)&&!!partial.querySelector('.gear-upgrade-dot'),'個別承認で未承認の改善が残る間は赤丸を維持');
      partial.querySelector('.pt-ae-top button').click();
      check(!UI.hasBetterGear(d)&&!partial.querySelector('.gear-upgrade-dot'),'残りも承認すると即座に赤丸を非表示');
      host.remove();return out;
    }'''))
    assert not errors,errors
    browser.close()
