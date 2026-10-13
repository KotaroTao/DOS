"""見識の解放・表示・通知・保存と旧機能の廃止を確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w25&testPlace=town')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const G=__game.G,out=[];
      const check=(v,m)=>{if(!v)throw Error(m);out.push(m)};
      G.testUnlock=[]; delete G.world.reported.w25;
      UI.openPalace('codex');
      check(!game.featureUnlocked('insight')&&!document.querySelector('.pl-insight'),'第六章の報告前は非表示');
      G.world.reported.w25=1;
      G.insightNotified=null;
      __game.autosave(true);
      UI.openPalace('codex');
      const score=game.insightSummary();
      check(game.featureUnlocked('insight')&&score.total>0,'報告済みの既存記録を遡及評価');
      check(document.querySelector('.pl-insight-total').textContent===score.total.toLocaleString('ja-JP'),'合計と内訳を図鑑に表示');
      check(G.insightNotified===score.total,'旧セーブの通知基準を初期化');
      G.codex.job.sera={rank:5,lv:1};
      const next=game.insightSummary();__game.autosave(true);
      check(next.total>score.total&&G.insightNotified===next.total,'新しい発見を通知・記録');
      __game.autosave(true);check(G.insightNotified===next.total,'再描画・保存で重複加算なし');
      G.rusui={picks:G.reserve.map(d=>d.uid)};
      G.testUnlock=['rusui','rusui2','rusui3'];
      check(['rusui','rusui2','rusui3'].every(k=>!game.featureUnlocked(k))&&game.rusuiSeats()===0,'旧セーブ・試遊でも留守居は廃止');
      const snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(snap.insightNotified===next.total,'通知記録を保存');
      const keep=G.insightNotified;G.insightNotified=null;
      check(game.insightSummary().total===next.total,'見識は通知記録に依存しない');G.insightNotified=keep;
      UI.openPalace('codex');
      return out;
    }'''))
    page.screenshot(path='/tmp/insight-mobile.png')
    page.get_by_role('button',name='見識の積み重ね方').click()
    page.wait_for_timeout(200)
    assert '灯守' in page.locator('body').inner_text()
    expected=page.evaluate('__game.G.insightNotified')
    page.evaluate("localStorage.setItem('dos-save-v7',__game.inf.saveJSON())")
    page.goto('http://localhost:8000/')
    page.wait_for_function('window.__game?.G.party.length > 0')
    actual=page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');return [game.insightSummary().total,__game.G.insightNotified]}")
    assert actual == [expected,expected], actual
    # 通知フィールドが無い旧セーブでも、同じ図鑑から見識が復元される。
    page.evaluate("""async()=>{
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const snap=refDeserialize(JSON.parse(localStorage.getItem('dos-save-v7')));
      delete snap.insightNotified;
      localStorage.setItem('dos-save-v7',JSON.stringify(refSerialize(snap)));
    }""")
    page.reload()
    page.wait_for_function('window.__game?.G.party.length > 0')
    actual=page.evaluate("async()=>{const {game}=await import('/src/ui/ctx.js');__game.autosave(true);return [game.insightSummary().total,__game.G.insightNotified]}")
    assert actual == [expected,expected], actual
    print('保存・再起動・旧セーブ移行で見識を保全 OK')
    assert not errors, errors
    browser.close()
