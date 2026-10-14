"""セラの全ランクアップで語りから昇格の札まで確認。localhost:8000 が必要。"""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/usr/bin/chromium',
        args=['--no-sandbox', '--disable-dev-shm-usage'],
    )
    page = browser.new_page(
        viewport={'width': 390, 'height': 844},
        service_workers='block', reduced_motion='reduce',
    )
    page.route('https://**/*', lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000/?testDungeon=w36&testPlace=town',
              wait_until='domcontentloaded')
    page.wait_for_function(
        'window.__game?.G && !document.body.classList.contains("booting")',
        timeout=120000,
    )
    beats = page.evaluate('''async () => {
      const {IRENE_BEATS} = await import('/src/story.js');
      const {testTutorials} = await import('/src/ui/tutorial.js');
      const {G, world: W} = __game;
      // 検査用に大量の物語を既読にするため、見識の増加通知を抑える。
      G.insightNotified = Number.MAX_SAFE_INTEGER;
      G.tut.done = Object.fromEntries(testTutorials.map(t => [t.id.slice(9), true]));
      G.world.beats = {};
      W.seraJoin();
      return IRENE_BEATS.filter(b => b.effect === 'seraRank').map(b => b.id);
    }''')
    assert len(beats) == 4, beats
    for reserve in [False, True]:
        for index, beat in enumerate(beats):
            expected_rank = index + 2
            page.evaluate('''async ({beat, index, reserve}) => {
              const {IRENE_BEATS} = await import('/src/story.js');
              const {G, ev, world: W} = __game;
              const ranks = IRENE_BEATS.filter(b => b.effect === 'seraRank');
              G.world.beats = Object.fromEntries(IRENE_BEATS
                .filter(b => b.effect !== 'seraRank' || ranks.indexOf(b) < index)
                .map(b => [b.id, 1]));
              const target = ranks[index];
              for (const key of [].concat(target.need || [])) G.world.found[key] = 1;
              if (target.after) G.world.reported[target.after] = 1;
              G.testStoryFlow = true;
              G.stats.runs = 0;
              G.town.tab = 'home';
              const d = W.seraDoll();
              G.party = G.party.filter(x => x !== d);
              G.reserve = G.reserve.filter(x => x !== d);
              (reserve ? G.reserve : G.party).push(d);
              const s = G.souls.find(s => s.uid === d.primary);
              s.count = index + 1;
              s.level = 1; s.exp = 0; s.capBonus = 0;
              ev.recalcDoll(d);
              if (W.pendingIreneBeat()?.id !== beat) throw Error('語りの条件が不正: ' + beat);
              if (!W.playIreneBeat(() => __game.renderTown())) throw Error('語りが始まらない');
            }''', {'beat': beat, 'index': index, 'reserve': reserve})
            # 本物の語りを最後まで進める (全文表示 → 次の頁 → うなずく)。
            for _ in range(40):
                if page.locator('.sp-cel-ru').count():
                    break
                page.keyboard.press('Enter')
            popup = page.locator('.sp-cel-ru')
            popup.wait_for(state='visible')
            text = popup.inner_text().replace('\u200b', '')
            assert f'ランク{expected_rank - 1}' in text, text
            assert f'ランク{expected_rank}' in text, text
            assert f'{60 + index * 20}' in text, text
            assert f'{80 + index * 20}' in text, text
            assert page.evaluate('__game.world.seraDoll().jobRank') == expected_rank
            # 再描画や同じ語りの効果を再適用しても札を重複させない。
            page.evaluate('__game.world.seraRankUp()')
            assert popup.count() == 1
            popup.get_by_role('button', name='受け取る', exact=True).click()
            popup.wait_for(state='detached')
            page.evaluate('__game.world.seraRankUp()')
            assert popup.count() == 0
            print(f'{"控え" if reserve else "隊"}: {beat} → ランク{expected_rank}・昇格の札 OK')
    # 既に語りを聞いたセーブも、読み込み時と同じ同期で最高位に補正される。
    assert page.evaluate('''() => {
      const {G, world: W} = __game;
      const d = W.seraDoll(), s = G.souls.find(s => s.uid === d.primary);
      s.count = 4;
      return W.syncSeraSoul() && s.count === 5 && d.jobRank === 5 && !W.syncSeraSoul();
    }''')
    assert not errors, errors
    print('語り済みの記録の同期・再同期 OK / ブラウザの実行時エラーなし')
    browser.close()
