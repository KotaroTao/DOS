"""全依頼者の肖像・詳細・報告・読み込み失敗時を実ブラウザーで確認。"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('docs/art/tavern-clients/review')
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    results = []
    for width, height in [(390, 844), (744, 1000)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length > 0')
        result = page.evaluate('''async () => {
          const {NPCS, FIXED_QUESTS} = await import('/src/quests.js');
          const {QUEST_PORTRAITS} = await import('/src/questportraits.js');
          const {questPortrait} = await import('/src/ui/questportrait.js');
          const {game, UI} = await import('/src/ui/ctx.js');
          const {openQuestSheet} = await import('/src/ui/questboard.js');
          const check = (ok, msg) => { if (!ok) throw Error(msg); };
          const people = [...new Map([...NPCS, ...FIXED_QUESTS.map(q=>q.giver)].map(n=>[n.name,n])).values()];
          check(people.length === 52, '依頼者52人');
          const gallery = document.createElement('div');
          gallery.id='portrait-review';
          gallery.style='position:fixed;inset:0;z-index:99999;background:#151114;overflow:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px';
          for (const who of people) {
            check(!!QUEST_PORTRAITS[who.name], '台帳の漏れ: '+who.name);
            const card=document.createElement('div'); card.style='color:#e2cf9f;font-size:11px;text-align:center';
            card.append(questPortrait(who,64),document.createElement('br'),document.createTextNode(who.name));
            gallery.append(card);
          }
          document.body.append(gallery);
          await Promise.all([...gallery.querySelectorAll('img')].map(i=>i.decode()));
          check(gallery.querySelectorAll('img').length===52, '全52画像を読み込める');
          const fallback=questPortrait({name:'未登録'},40,()=>document.createElement('canvas'));
          check(!!fallback.querySelector('canvas'),'未登録は従来の絵に戻る');
          const broken=questPortrait(people[0],40,()=>document.createElement('canvas'));
          broken.querySelector('img').dispatchEvent(new Event('error'));
          check(!!broken.querySelector('canvas'),'画像失敗は従来の絵に戻る');
          window.portraitCheck={game,UI,openQuestSheet};
          return {people:people.length,assets:Object.keys(QUEST_PORTRAITS).length};
        }''')
        page.screenshot(path=str(OUT / f'gallery-{width}.png'))
        page.evaluate('''() => {
          document.querySelector('#portrait-review').remove();
          const {game,UI}=portraitCheck, G=game.G;
          G.tut={done:{tavern:true,rumor:true}};
          G.quest={board:[{uid:'portrait-free',npc:0,state:'offer',type:'chest',name:'宝箱の頼み',text:'「頼むぞ。」',desc:'宝箱を1つ開ける',goal:1,progress:0,reward:{gold:10}}],active:[],fixed:{},npcs:{}};
          UI.openTavern('board');
        }''')
        page.wait_for_selector('.qb-client img')
        page.locator('.qb-client img').first.evaluate('(img)=>img.decode()')
        page.screenshot(path=str(OUT / f'board-{width}.png'))
        page.evaluate("portraitCheck.openQuestSheet('portrait-free')")
        page.wait_for_selector('.qb-who img')
        page.locator('.qb-who img').evaluate('(img)=>img.decode()')
        page.screenshot(path=str(OUT / f'detail-{width}.png'))
        assert page.locator('.ui-sheet-body').last.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        page.get_by_role('button', name='依頼を受ける', exact=True).click()
        page.evaluate('''() => {
          const {game}=portraitCheck;
          const q=game.G.quest.active.find(q=>q.uid==='portrait-free');
          if(!q)throw Error('受注できない');
          q.state='done';q.progress=1;
          if(!game.claimQuest(q.uid))throw Error('報告できない');
        }''')
        page.wait_for_selector('.sc-portrait img')
        page.locator('.sc-portrait img').evaluate('(img)=>img.decode()')
        assert page.locator('.sc-portrait img').get_attribute('alt')=='隻眼のガルム'
        page.wait_for_timeout(800)
        page.locator('.sc-scene').click(position={'x':10,'y':200})
        page.screenshot(path=str(OUT / f'report-{width}.png'))
        # 固有の報告も同じ肖像を使う。前の報告は閉じてから進む。
        page.evaluate('''() => {
          const scene=document.querySelector('.sc-scene');
          for(let i=0;i<30 && scene.isConnected;i++)scene.querySelector('.sc-okb').click();
        }''')
        page.wait_for_function("!document.querySelector('.sc-scene')")
        page.evaluate('''() => {
          const {game}=portraitCheck;
          game.G.quest.fixed.fq_hans={state:'done',progress:1};
          if(!game.claimQuest('fq_hans'))throw Error('固定の報告に失敗');
        }''')
        page.wait_for_selector('.sc-portrait img')
        page.locator('.sc-portrait img').evaluate('(img)=>img.decode()')
        assert page.locator('.sc-portrait img').get_attribute('alt')=='墓守のハンス'
        page.wait_for_timeout(800)
        page.locator('.sc-scene').click(position={'x':10,'y':200})
        page.screenshot(path=str(OUT / f'fixed-report-{width}.png'))
        # 追加した五人は固有の依頼の報告でも同じ顔を表示する。
        for quest_id, name in [('fq_proxyname', '老侍従エーリク'), ('fq_doorscratch', '扉番のカスパル'), ('fq_closedstacks', '書き写しのヨルク'), ('fq_rainjar', '雨受けのミラ'), ('fq_picturebook', '子守りのロッテ')]:
            page.evaluate('''() => {
              const scene=document.querySelector('.sc-scene');
              for(let i=0;i<30 && scene?.isConnected;i++)scene.querySelector('.sc-okb').click();
            }''')
            page.wait_for_function("!document.querySelector('.sc-scene')")
            page.evaluate('''id => {
              const {game}=portraitCheck;
              game.G.quest.fixed[id]={state:'done',progress:1};
              if(!game.claimQuest(id))throw Error('追加した依頼の報告に失敗: '+id);
            }''', quest_id)
            page.wait_for_selector('.sc-portrait img')
            page.locator('.sc-portrait img').evaluate('(img)=>img.decode()')
            assert page.locator('.sc-portrait img').get_attribute('alt') == name
            page.screenshot(path=str(OUT / f'{quest_id}-{width}.png'))
        assert not errors, errors
        results.append({'width':width,**result,'errors':errors,'freeAndFixedReport':True,'fallback':True,'addedFixedReports':5})
        page.close()
    browser.close()
(OUT / 'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False))
