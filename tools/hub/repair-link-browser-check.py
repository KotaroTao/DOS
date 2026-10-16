"""街の修復リンクが、隊・控えの対象と修復ボタンを表示する。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, height in [(390, 664), (360, 640), (1280, 720)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.evaluate('''async () => {
          const {UI, game} = await import('/src/ui/ctx.js');
          const {sheet} = await import('/src/ui/kit.js');
          const {_TUTS} = await import('/src/ui/tutorial.js');
          window.api = game; window.UI = UI;
          const g = game.G;
          sheet.closeAll(); g.irene.greeted = true; g.prompt = false;
          g.tut.cur = null; _TUTS.forEach(t => g.tut.done[t.key] = true);
          g.msq.prologue = {phase: 'done', gifts: {}};
          g.insightNotified = Number.MAX_SAFE_INTEGER;
          game.pendingIreneBeat = () => null;
          g.gold = 9999999;
        }''')
        for reserve in [False, True]:
            page.evaluate('''reserve => {
              const g = api.G;
              const d = g.party[2];
              if (reserve) g.reserve.push(g.party.splice(2, 1)[0]);
              window.fallen = d;
              d.alive = false; d.hp = 0; d.reviveAt = null;
              // 館の装備を見た後、魂の途中までスクロールした記憶も残す。
              UI.openParty(g.party[0], {context: 'town', seg: 'equip'});
            }''', reserve)
            page.wait_for_timeout(250)
            page.evaluate('''() => {
              const body = document.querySelector('.pt-overview') || document.querySelector('[data-section="soul"]');
              body.scrollTop = document.querySelector('.pt-overview')
                ? document.querySelector('[data-mansion-section="equip"]').offsetTop : 400;
              body.dispatchEvent(new Event('scroll'));
              // PCは人業切替時に各欄の位置を保存する。
              document.querySelector('.pc-roster-row')?.click();
              UI.shell.setTab('hub');
            }''')
            page.wait_for_timeout(250)
            page.get_by_role('button', name='魂を修復', exact=False).first.click()
            page.wait_for_timeout(300)
            # Playwrightの自動スクロールに頼らず、ボタンの中央が実際に見えることを確認。
            page.evaluate('''() => {
              const name = document.querySelector('.pc-mansion-head h1, .pt-mansion-title .pt-head-name');
              if (!name || name.textContent.replace(/\\u200b/g, '') !== fallen.name) throw Error('死亡した対象が選ばれていない');
              const b = [...document.querySelectorAll('.pt-repair-actions button')]
                .find(b => b.textContent.replace(/\\u200b/g, '').includes('魂を修復'));
              if (!b) throw Error('修復ボタンがない');
              const r = b.getBoundingClientRect();
              if (r.top < 0 || r.bottom > innerHeight || !b.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)))
                throw Error('修復ボタンが隠れている');
              b.click();
            }''')
            page.get_by_role('button', name='修復する', exact=True).click()
            page.wait_for_timeout(250)
            assert page.evaluate('fallen.alive && fallen.hp === fallen.maxhp && fallen.mp === fallen.maxmp')
            print(f'{width}×{height}: {"控え" if reserve else "隊"}の対象選択・修復ボタンの可視性・修復 OK')
        assert not errors, errors
        page.close()
    browser.close()
