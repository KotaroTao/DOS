"""第十三章の専用情景・時刻による動き・静止設定・実際の出撃シートを確認する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/art/chapter13-vistas'
OUT.mkdir(parents=True, exist_ok=True)
IDS = ['w50', 'w51', 'w52', 'w53', 'ws28', 'ws29']

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1000, 'height': 1150}, service_workers='block')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/vista-review', lambda r: r.fulfill(content_type='text/html', body='<html><body style="background:#101319;color:#ddd;font:16px sans-serif"></body></html>'))
    page.goto('http://localhost:8000/vista-review')
    result = page.evaluate('''async ids => {
      const {drawDungeonVista, FORGE_VISTA_IDS} = await import('/src/backdrops.js');
      const {DUNGEONS} = await import('/src/dungeons/index.js');
      document.body.style.cssText += ';display:grid;grid-template-columns:480px 480px;gap:12px';
      window.framesAt = t => {
        for (const [cv, dn] of window.vistas) drawDungeonVista(cv.getContext('2d'),480,320,dn,t);
        return window.vistas.map(([cv]) => cv.toDataURL());
      };
      window.vistas = ids.map(id => {
        const dn = DUNGEONS.find(d => d.id === id);
        const wrap = document.createElement('div'), name = document.createElement('p');
        name.textContent = dn.name;
        const cv = document.createElement('canvas');cv.width=480;cv.height=320;
        wrap.append(name,cv); document.body.append(wrap);return [cv,dn];
      });
      const first = framesAt(1000), later = framesAt(2700), same = framesAt(1000);
      if (JSON.stringify(first)!==JSON.stringify(same)) throw Error('同時刻の描画が一致しない');
      if (new Set(first).size!==6) throw Error('情景が重複');
      if (!first.every((v,i)=>v!==later[i])) throw Error('動いていない情景がある');
      if (JSON.stringify(FORGE_VISTA_IDS)!==JSON.stringify(ids)) throw Error('対象迷宮が不一致');
      return {unique:new Set(first).size, animated:first.filter((v,i)=>v!==later[i]).length};
    }''', IDS)
    page.screenshot(path=str(OUT / 'review.png'), full_page=True)
    page.emulate_media(reduced_motion='reduce')
    assert page.evaluate('JSON.stringify(framesAt(1000))===JSON.stringify(framesAt(9000))')
    page.emulate_media(reduced_motion='no-preference')
    assert page.evaluate('JSON.stringify(framesAt(1000))!==JSON.stringify(framesAt(9000))')
    print('6迷宮の固有描画・アニメーション・時刻の再現性・静止設定と動作中の切替 OK', result)
    page.set_viewport_size({'width':390,'height':844})
    page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      window.api=game;window.ui=UI;window.kit=await import('/src/ui/kit.js');
      kit.sheet.closeAll(); game.G.irene.greeted=true;game.G.tut.cur=null;
      const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>game.G.tut.done[t.key]=true);
      game.G.msq.prologue={phase:'done',gifts:{}};
      game.worldOpenIdx=()=>true;game.blockForReport=game.blockForTutorial=()=>false;
      game.storyGoal=()=>null;game.autosave=()=>{};
    }''')
    for id in IDS + ['w01']:
        page.evaluate('kit.sheet.closeAll()')
        page.wait_for_timeout(650)
        page.evaluate('''id=>{
          kit.sheet.closeAll(); api.G.dungeonIdx=api.DUNGEONS.findIndex(d=>d.id===id);
          api.G._departPre=true;ui.openDeparture();
        }''', id)
        page.wait_for_timeout(200)
        expected = 'img' if id == 'w01' else 'canvas'
        assert page.locator(expected + '.dp-vista-cv').count() == 1, id
        if id == 'w50':
            before = page.locator('canvas.dp-vista-cv').evaluate('(c)=>c.toDataURL()')
            page.wait_for_timeout(250)
            assert before != page.locator('canvas.dp-vista-cv').evaluate('(c)=>c.toDataURL()')
            page.screenshot(path=str(OUT / 'departure-phone.png'))
    assert not errors, errors
    print('携帯幅の実出撃シートで6迷宮がCanvas表示・描画ループ稼働・他章は原画表示 OK')
    browser.close()
