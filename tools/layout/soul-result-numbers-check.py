"""魂融合・ランクアップの高Lv・大きな能力値が省略も枠外表示もされないことを確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for touch in [True, False]:
        page = browser.new_page(has_touch=touch, viewport={'width': 820, 'height': 1180},
                                service_workers='block', reduced_motion='reduce')
        page.route('https://**', lambda r: r.abort())
        page.goto('http://localhost:8000/?testDungeon=w02', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length > 0')
        for width, height in [(320,568), (390,844), (520,740), (820,1180), (1280,800)]:
            page.set_viewport_size({'width': width, 'height': height})
            for large in [False, True]:
                for rank_up in [False, True, 'level']:
                    page.evaluate('''async ({large, rankUp}) => {
                      const {sheet}=await import('/src/ui/kit.js'); sheet.closeAll();
                      const ui=await import('/src/ui/soulpanel.js');
                      const info={clsKey:'fighter',fromRank:1,toRank:rankUp?2:1,
                        fromLv:large?9999:117,toLv:large?10001:127,
                        fromCap:large?99999:117,toCap:large?100001:127,
                        fromCount:2,toCount:3,fromPicks:1,toPicks:2,statUp:50,
                        statsOf:'ローナ',statsFrom:{hp:large?999999999:99999,mp:large?99999999:100000,atk:570.5},
                        statsTo:{hp:large?1000000001:123456,mp:large?100000001:123456,atk:665.7},
                        newSkills:[],newPassives:[]};
                      if(rankUp==='level') ui.celebrateLevelUp([{name:'ローナ',doll:__game.G.party[0],
                        main:{from:info.fromLv,to:info.toLv},subs:[],statsFrom:info.statsFrom,statsTo:info.statsTo,skills:[]}]);
                      else (rankUp?ui.celebrateRankUp:ui.showFuseResult)(info);
                    }''', {'large': large, 'rankUp': rank_up})
                    page.wait_for_timeout(1700 if rank_up == "level" else 250)
                    page.evaluate('''() => {
                      const card=[...document.querySelectorAll('.ui-sheet')].find(c=>!c.closest('.closing'));
                      const body=card.querySelector('.ui-sheet-body');
                      if(body.scrollWidth>body.clientWidth+1) throw Error('本文の横はみ出し');
                      for(const row of card.querySelectorAll('.sp-ru-perk,.sp-fz-st,.sp-lu-st')) {
                        if(row.scrollWidth>row.clientWidth+1) throw Error('枠のはみ出し '+row.textContent);
                        const r=row.getBoundingClientRect();
                        for(const span of row.querySelectorAll('span')) {
                          const s=span.getBoundingClientRect();
                          if(s.left<r.left-1 || s.right>r.right+1 || s.top<r.top-1 || s.bottom>r.bottom+1)
                            throw Error('枠外の値 '+span.textContent);
                          if(span.scrollWidth>span.clientWidth+1) throw Error('値の省略 '+span.textContent);
                        }
                      }
                      for(const selector of ['.sp-ru-old','.sp-ru-new','.sp-fz-v > span','.sp-fz-d','.sp-lu-v > span','.sp-lu-d']) {
                        for(const span of card.querySelectorAll(selector)) {
                          const range=document.createRange(); range.selectNodeContents(span);
                          if(new Set([...range.getClientRects()].map(r=>Math.round(r.top))).size!==1)
                            throw Error('数値の途中で改行 '+span.textContent);
                        }
                      }
                      const b=card.querySelector('.ui-sheet-foot button').getBoundingClientRect();
                      if(b.bottom>innerHeight+1 || b.top<0) throw Error('閉じるボタンが画面外');
                    }''')
            print(f'タッチ={touch} {width}px: 融合・ランクアップ・Lvアップ、Lv10001・HP10億超まで枠内に全桁表示', flush=True)
        page.close()
    browser.close()
