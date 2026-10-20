"""商会を離れた時だけ購入・付呪の絞り込みを解除。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(content_type='text/css', body=''))
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print('\n'.join(page.evaluate('''async()=>{
      const {UI,game}=await import('/src/ui/ctx.js');
      const {setPref,getPref}=await import('/src/ui/prefs.js');
      const {_TUTS}=await import('/src/ui/tutorial.js');
      const {sheet}=await import('/src/ui/kit.js');
      const g=game.G,out=[];
      g.irene.greeted=true;g.tut.cur=null;_TUTS.forEach(t=>g.tut.done[t.key]=true);
      g.insightNotified=Number.MAX_SAFE_INTEGER;
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push('OK '+msg)};
      const seed=()=>{
        setPref('shopGearFilter',{effects:['magic'],elements:[]});
        setPref('enchantFilter',{effects:['afx:A07'],elements:[]});
        setPref('gearFilter',{effects:['eff:regen'],elements:[]});
      };
      const kept=()=>getPref('shopGearFilter').effects?.[0]==='magic'&&getPref('enchantFilter').effects?.[0]==='afx:A07';
      const cleared=()=>!Object.keys(getPref('shopGearFilter')).length&&!Object.keys(getPref('enchantFilter')).length;
      UI.openShop('buy');seed();
      for(const seg of ['sell','forge','enchant','buy']) {
        UI.openShop(seg);check(kept(),seg+'への切替では保持');
      }
      game.renderTown();UI.shell.setTab('shop');check(kept(),'再描画・商会タブの押し直しでも保持');
      const h=sheet.open({title:'確認',body:document.createElement('div'),footer:[]});h.close();
      check(kept(),'詳細シートを閉じても保持');
      UI.shell.openGate();check(kept(),'出撃先を選ぶだけでは保持');sheet.closeAll();
      for(const tab of ['hub','party','palace']) {
        UI.openShop('buy');seed();UI.shell.setTab(tab);
        check(cleared(),tab+'へ移動した時に購入・付呪を解除');
        check(getPref('gearFilter').effects[0]==='eff:regen','館の絞り込みは保持');
        UI.openShop('buy');check(cleared(),'商会に戻っても解除済み');
      }
      seed();UI.shell.openPage('tavern');check(cleared(),'酒場への直接移動でも解除');
      UI.openShop('buy');seed();g.town.facility='mansion';game.renderTown();
      check(cleared(),'旧施設の入口から館へ移動しても解除');
      UI.openShop('buy');seed();
      // 実際に出撃し、街画面を離れる処理でも解除する。
      game.enterDungeon(null);
      check(g.state!=='town','迷宮へ出撃できた');
      await new Promise(resolve=>setTimeout(resolve,0));
      check(cleared(),'迷宮へ出撃して街画面を離れる時に解除');
      return out;
    }''')))
    assert not errors, errors
    browser.close()
