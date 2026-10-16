"""localhost:8000で全画面系統のPC配置と、main版に対するタッチ端末の寸法維持を検証。"""
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('DOS_TEST_URL', 'http://localhost:8000')
OUT = Path('work/pc-screens')
OUT.mkdir(parents=True, exist_ok=True)
BASELINE = os.environ.get('DOS_TEST_BASELINE', 'edc3edf8a69bc6b53dd919d0f321be387473af64')
ORIGINAL = {path: subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'])
            for path in ['desktop.css', 'src/ui/kit.js', 'src/ui/journal.js']}
ACTIONS = [
 ('街', "UI.shell.setTab('hub')"), ('館', 'UI.enterMansion()'),
 ('買う', "UI.openShop('buy',{cat:'weapon'})"), ('売る鑑定', "UI.openShop('sell')"),
 ('鍛え直し', "UI.openShop('forge')"), ('付呪', "UI.openShop('enchant')"),
 ('勅命', "UI.openPalace('decree')"), ('図鑑', "UI.openPalace('codex')"),
 ('勲章', "UI.openPalace('ach')"), ('宝物庫', "UI.openPalace('treasury')"),
 ('酒場', "UI.openTavern('board')"), ('祠', "UI.shell.openPage('shrine')"),
 ('設定', 'UI.settingsSheet({})'), ('ヘルプ', 'UI.openHelp()'),
 ('物語一覧', 'UI.openStoryArchive()'), ('隊列保存編成', 'UI.openFormationSheet()'),
 ('魂一覧', 'UI.openSoulList()'), ('出撃', 'UI.openDeparture()'),
 ('宿屋', 'UI.openInn()'), ('控え', 'UI.openReserve()'),
 ('図鑑シート', 'UI.openCodexSheet({all:true})'),
 ('職業詳細', "UI.codexJobSheet('fighter')"),
 ('品の詳細', "UI.codexItemSheet('dagger')"),
 ('無限迷宮の準備', 'UI.openInfSetup()'), ('無限迷宮の記憶', 'UI.openInfMemories()'),
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []
    def new_page(width, height, touch=False, baseline=False, title=False):
        page = browser.new_page(viewport={'width':width,'height':height}, has_touch=touch,
                                is_mobile=touch and width<600, service_workers='block')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r:r.fulfill(content_type='text/css',body=''))
        # VMでは大量のモジュール取得が5秒を超えるため、レイアウト検証用HTMLのみ猶予を延ばす。
        def boot(r):
            response=r.fetch()
            r.fulfill(response=response, body=response.text().replace('}, 5000);','}, 60000);'))
        page.route(BASE+'/', boot)
        page.route(BASE+'/?testDungeon=*', boot)
        if baseline:
            for path,body in ORIGINAL.items():
                def original_route(content):
                    def handler(route):
                        route.fulfill(body=content, content_type='text/css' if route.request.url.endswith('.css') else 'text/javascript')
                    return handler
                page.route(BASE+'/'+path, original_route(body))
        url=BASE+'/' if title else BASE+'/?testDungeon=w05&testPlace=town&testUnlock=infinite,forge,enchant,sub1,sub2,rematch,rusui'
        page.goto(url, wait_until='domcontentloaded', timeout=120000)
        page.wait_for_function('window.__game')
        if not title:
            page.wait_for_function('__game.G.party.length===6')
            page.evaluate('''async()=>{
              const {UI,game}=await import('/src/ui/ctx.js');window.UI=UI;window.api=game;
              window.kit=await import('/src/ui/kit.js');kit.sheet.closeAll();
              const g=game.G;g.irene.greeted=true;g.tut.cur=null;g.gold=99999999;
              g.insightNotified=Number.MAX_SAFE_INTEGER;g.prompt=false;
              const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>g.tut.done[t.key]=true);
              g.msq.prologue={phase:'done',gifts:{}};
              g.shopStock={shortSword:4,dagger:3};
              UI.shell.setTab('hub');
            }''')
        page.add_style_tag(content='*,*::before,*::after{animation:none!important;transition:none!important}')
        page.wait_for_load_state('networkidle', timeout=90000)
        return page

    def show(page, action):
        page.evaluate('kit.sheet.closeAll()')
        page.wait_for_timeout(100)
        page.evaluate('async()=>{'+action+'}')
        page.wait_for_timeout(700)

    geometry = '''()=>{
      const root=[...document.querySelectorAll('.ui-sheet:not(.closing)')].at(-1)||document.getElementById('town-screen');
      const selectors=['#town-shell','.ui-tabbar','#town-screen','.ui-sheet','.ui-sheet-head','.ui-sheet-body','.ui-sheet-foot','.hb-hero','.hb-actions','.pt-form','.pt-overview','.pt-overview-section','.wpc-bar','.wpc-list','.stg-row','.jr-results','.jr-illustration','.jr-line'];
      return Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(n=>Math.round(n*10)/10)})]));
    }'''
    # 本物の変更前JS/CSSと変更後を別ページで比較する。
    for width,height in ([] if os.environ.get('DOS_TEST_SCOPE') in ('pc','scenes') else [(390,844),(768,1024),(1366,1024)]):
        snapshots=[]
        for baseline in [True,False]:
            page=new_page(width,height,touch=True,baseline=baseline)
            values={}
            for name,action in [ACTIONS[i] for i in [0,1,2,6,10,12,13,14,15,17,18]]:
                show(page,action)
                values[name]=page.evaluate(geometry)
                if name=='物語一覧':
                    page.locator('.jr-card').first.click();page.wait_for_timeout(700)
                    values['物語詳細']=page.evaluate(geometry)
            snapshots.append(values)
            page.close()
        if snapshots[0]!=snapshots[1]:
            import json
            (OUT/f'寸法比較-{width}.json').write_text(json.dumps(snapshots,ensure_ascii=False))
            raise AssertionError((width,height,[k for k in snapshots[0] if snapshots[0][k]!=snapshots[1][k]]))
        print(f'タッチ {width}x{height}: 12画面が変更前の寸法と一致',flush=True)

    page=new_page(1280,720)
    for width,height in ([] if os.environ.get('DOS_TEST_SCOPE')=='scenes' else [(1100,600),(1280,720),(1920,1080)]):
        page.set_viewport_size({'width':width,'height':height})
        for name,action in ACTIONS:
            show(page,action)
            expected = {'街':'.hb','館':'.pt-overview','買う':'.seg-buy','売る鑑定':'.seg-sell',
              '鍛え直し':'.seg-forge','付呪':'.seg-enchant','勅命':'.s-decree','図鑑':'.s-codex',
              '勲章':'.s-ach','宝物庫':'.s-treasury','酒場':'.fc-tavern','祠':'.fc-shrine',
              '設定':'.stg-sheet','ヘルプ':'.jr-index','物語一覧':'.jr-index','隊列保存編成':'.pt-formation-sheet',
              '魂一覧':'.sp-list-sheet','出撃':'.dp-sheet','宿屋':'.inn-sheet','控え':'.pt-res-sheet',
              '図鑑シート':'.cx-sheet','職業詳細':'.pl-detail-sheet','品の詳細':'.wpc-isheet',
              '無限迷宮の準備':'.inf-sheet','無限迷宮の記憶':'.inf-memory-sheet'}
            assert page.locator(expected[name]).last.is_visible(), (name, '対象の画面が開かない')
            page.evaluate('''()=>{
              const sheet=[...document.querySelectorAll('.ui-sheet')].at(-1);
              const root=sheet||document.getElementById('town-shell');const r=root.getBoundingClientRect();
              if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)throw Error('画面外 '+root.className);
              const content=sheet?.querySelector('.ui-sheet-body')||document.getElementById('town-screen');
              if(content.scrollWidth>content.clientWidth+1)throw Error('本文が横にはみ出す '+content.className);
              if(sheet){
                const close=sheet.querySelector('.ui-pc-close');
                if(!close||close.getBoundingClientRect().width<44)throw Error('PCの閉じる操作なし');
                const c=close.getBoundingClientRect();
                if(!close.contains(document.elementFromPoint(c.x+c.width/2,c.y+c.height/2)))throw Error('閉じる操作が隠れている');
                const body=sheet.querySelector('.ui-sheet-body'),foot=sheet.querySelector('.ui-sheet-foot');
                if(getComputedStyle(foot).display!=='none'&&body.getBoundingClientRect().bottom>foot.getBoundingClientRect().top+1)throw Error('本文と操作の重なり');
              }else{
                const nav=document.querySelector('#town-shell>.ui-tabbar'),n=nav.getBoundingClientRect(),c=content.getBoundingClientRect();
                if(n.right>c.left+1)throw Error('施設メニューと本文の重なり');
              }
            }''')
            if width==1280:
                page.screenshot(path=str(OUT/f'{name}.png'))
        print(f'PC {width}x{height}: {len(ACTIONS)}画面の収まり・本文・閉じる操作 OK',flush=True)

    show(page, "UI.shell.setTab('hub')")
    page.locator('.ui-tab[data-key="hub"]').focus()
    page.keyboard.press('ArrowDown')
    assert page.locator('.ui-tab[data-key="party"]').get_attribute('aria-selected')=='true'
    # ×も取消経路を通り、承認を実行しない。
    show(page,"window.answer=null;kit.confirm({title:'確認',lines:['内容を確かめる'],okLabel:'実行'}).then(v=>window.answer=v)")
    page.locator('.ui-pc-close').last.click()
    page.wait_for_function('window.answer===false')
    show(page,"UI.settingsSheet({})")
    page.keyboard.press('Escape')
    page.wait_for_function('!document.querySelector(\'.ui-sheet-wrap:not(.closing)\')')
    # 物語詳細の絵と本文。実際の一覧から開く。
    show(page,'UI.openStoryArchive()')
    page.locator('.jr-card').first.click()
    assert page.locator('.jr-detail .jr-text').is_visible()
    page.evaluate("""()=>{const a=document.querySelector('.jr-illustration').getBoundingClientRect(),b=document.querySelector('.jr-text').getBoundingClientRect();if(a.right>b.left||Math.abs(a.top-b.top)>1)throw Error('絵と本文が左右に並ばない');}""")
    page.screenshot(path=str(OUT/'物語詳細.png'))
    # 全画面会話・オープニング・職業の一覧にもPC用の枠を適用する。
    for width,height in [(1100,600),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        show(page, "UI.playStoryChain([{title:'旅の記録',lines:['師の残した灯を追い、迷宮へ向かう。'],photo:'art/story/chapter1/w04_arm.webp',who:'none'}],()=>{})")
        page.wait_for_timeout(500)
        page.evaluate("""()=>{
          const a=document.querySelector('.sc-art').getBoundingClientRect(),b=document.querySelector('.sc-page').getBoundingClientRect();
          if(a.right>b.left||b.bottom>innerHeight)throw Error('会話の絵と本文が重なる');
        }""")
        page.screenshot(path=str(OUT/f'会話-{width}.png'))
        page.keyboard.press('Enter');page.keyboard.press('Enter');page.wait_for_timeout(650)
        page.evaluate("async()=>{const {playIreneScene}=await import('/src/ui/irene.js');playIreneScene([['この器に、魂を宿しましょう。']],()=>{})}")
        page.wait_for_timeout(500)
        page.evaluate("""()=>{
          const a=document.querySelector('.iv-art').getBoundingClientRect(),b=document.querySelector('.iv-stage').getBoundingClientRect();
          if(a.right>b.left||b.bottom>innerHeight)throw Error('館の会話が重なる');
        }""")
        page.locator('.iv-skip').click();page.wait_for_timeout(650)
        page.evaluate("async()=>{(await import('/src/opening.js')).showOpening(()=>{})}")
        page.wait_for_timeout(650)
        page.evaluate("""()=>{
          const t=document.querySelector('.op-text').getBoundingClientRect(),b=document.querySelector('.op-skip').getBoundingClientRect();
          if(t.right>innerWidth||t.bottom>innerHeight||b.width<44)throw Error('序幕が画面外');
        }""")
        page.keyboard.press('Escape');page.wait_for_timeout(1000)
    page.evaluate("async()=>{(await import('/src/ui/jobgallery.js')).showJobGallery({})}")
    assert page.locator('.jg-overlay').is_visible()
    page.locator('.jg-close').click()

    page.close()
    title=new_page(1280,720,title=True)
    for width,height in [(1100,600),(1280,720),(1920,1080)]:
        title.set_viewport_size({'width':width,'height':height});title.wait_for_timeout(350)
        title.evaluate('''()=>{for(const e of document.querySelectorAll('.ttl-logo,.ttl-menu,.ttl-btn')){
          const r=e.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)throw Error('タイトルの操作が画面外');}}''')
    title.screenshot(path=str(OUT/'タイトル.png'))
    title.evaluate("async()=>{const {showTitle}=await import('/src/title.js');showTitle({hasSave:true,summary:{head:'迷宮からの帰還',lines:['試遊の弟子','見識65 第五章','人業6体','金貨99999999 赤い魂300']},onStart:()=>{}})}")
    for width,height in [(1100,600),(1280,720),(1920,1080)]:
        title.set_viewport_size({'width':width,'height':height});title.wait_for_timeout(350)
        title.evaluate("""()=>{const root=[...document.querySelectorAll('.ttl-overlay')].at(-1);for(const e of root.querySelectorAll('.ttl-logo,.ttl-menu,.ttl-btn')){const r=e.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)throw Error('続きからのタイトルが画面外');}}""")

    print('キーボード・確認の取消・物語詳細・会話・序幕・職業一覧・タイトル2種 OK',flush=True)
    assert not errors,errors
    browser.close()
