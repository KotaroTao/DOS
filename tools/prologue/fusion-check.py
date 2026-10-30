"""魂融合の手ほどきが戦士の魂を案内・完了することを実画面で確認。localhost:8000。"""
from playwright.sync_api import sync_playwright, TimeoutError

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for case in ['priest-first', 'reserve', 'unworn']:
        page = browser.new_page(viewport={'width': 390, 'height': 760}, is_mobile=True, has_touch=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testScene=tutorial:fusion')
        page.wait_for_function('window.__game?.G.testTutorial')
        page.add_style_tag(content='.test-play-banner{display:none!important}')
        page.evaluate('''async (which) => {
            const {game} = await import('/src/ui/ctx.js');
            const G = game.G;
            const fighter = G.party.splice(0, 1)[0];
            if (which === 'reserve') G.reserve.push(fighter);
            if (which === 'priest-first') {
                G.party.unshift(G.party.splice(2, 1)[0]); G.party.push(fighter);
            }
            if (which === 'unworn') {
                for (let i = G.souls.length - 1; i >= 0; i--)
                    if (G.souls[i].clsKey === 'fighter') G.souls.splice(i, 1);
            }
            game.renderTown();
        }''', case)
        page.locator('.ui-tab[data-key="party"]').tap()
        # 挨拶・導入を閉じ、融合の実操作まで進める。
        for _ in range(60):
            page.wait_for_timeout(200)
            skip = page.locator('.iv-scene:not(.out) .iv-skip:visible,.sc-scene:not(.out) .sc-skip:visible')
            if skip.count():
                skip.first.tap(); page.wait_for_timeout(500); continue
            glow = page.locator('.tut-glow:visible')
            if not glow.count(): continue
            if glow.first.evaluate('(e)=>e.matches(".sp-fuse, .sp-pick-fuse")'): break
            glow.first.tap()
        else:
            raise AssertionError(case + ': 融合ボタンまで進めない')
        glow = page.locator('.tut-glow:visible').first
        assert glow.evaluate('(e)=>(e.dataset.job || e.closest(".sp-srow")?.dataset.job)') == 'fighter', case
        assert page.evaluate('__game.G.souls.filter(s=>s.clsKey==="fighter").length') == (2 if case == 'unworn' else 4)
        before = page.evaluate('__game.G.souls.filter(s=>s.clsKey!=="fighter").map(s=>({uid:s.uid,count:s.count}))')
        glow.tap()
        material = page.locator('.sp-fuse-material.tut-glow')
        material.wait_for()
        assert '戦士の魂' in material.inner_text().replace('\u200b', '')
        # 対象外の職の融合は完了と判定しない (実際の融合処理・通知を確認)。
        if case == 'priest-first':
            result = page.evaluate('''async()=>{
                const {game}=await import('/src/ui/ctx.js');
                const {sheet}=await import('/src/ui/kit.js');
                const ss=game.G.souls.filter(s=>s.clsKey==='priest');
                const r=game.fuseSoul(ss[0].uid,ss[1].uid);
                sheet.top().close();
                return !!r && !game.G.tut.ev['soulFused:fighter'] && !game.G.tut.done.fusion;
            }''')
            assert result, '僧侶の融合では完了しない'
            before = page.evaluate('__game.G.souls.filter(s=>s.clsKey!=="fighter").map(s=>({uid:s.uid,count:s.count}))')
        material.tap()
        page.wait_for_function('__game.G.tut.ev["soulFused:fighter"]')
        for _ in range(40):
            page.wait_for_timeout(200)
            if page.evaluate('__game.G.tut.done.fusion'): break
            glow = page.locator('.tut-glow:visible')
            if glow.count():
                try: glow.first.tap(timeout=1500)
                except TimeoutError:
                    # 完了直後の描き直しで消えた「次へ」だけは再取得する。
                    if page.evaluate('__game.G.tut.done.fusion'): break
                    raise
        assert page.evaluate('__game.G.tut.done.fusion'), case
        assert page.evaluate('__game.G.souls.filter(s=>s.clsKey!=="fighter").map(s=>({uid:s.uid,count:s.count}))') == before
        assert not errors, errors
        print(case + ': 戦士の魂を案内・融合して完了、他職の魂を維持', flush=True)
        page.close()
    browser.close()
