"""街・施設・設定の低速保存中の操作と、終了／画像再読込の保存保護。localhost:8000。"""
import base64
import json
import re
import time
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8000/'
CONFIG = 'export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'
PIXEL = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII=')
AUTH = {'access_token':'test','expires_at':9999999999,'user':{'id':'screen-test','email':'test@example.invalid'}}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    def context(width):
        c = browser.new_context(viewport={'width':width,'height':844}, reduced_motion='reduce', service_workers='block')
        c.route(re.compile(r'\.(webp|png|jpg)(\?.*)?$'), lambda r:r.fulfill(content_type='image/png',body=PIXEL))
        return c
    c = context(390)
    page = c.new_page()
    page.goto(BASE+'?testDungeon=w45&testPlace=town')
    page.wait_for_function("window.__game?.G.party.length && !document.body.classList.contains('booting')")
    seed = page.evaluate('__game.inf.saveJSON()')
    legal = page.evaluate("async()=>(await import('/src/legal.js')).LEGAL_VERSION")
    c.close()
    for width in [390,1280]:
        c = context(width)
        c.add_init_script('localStorage.setItem("dos-cloud-auth",'+json.dumps(json.dumps(AUTH))+');localStorage.setItem("dos-legal-version:screen-test",'+json.dumps(legal)+');')
        c.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body=CONFIG))
        pending, errors = [], []
        state = {'snapshot':json.loads(seed),'revision':0,'slow':False}
        def respond(route):
            b = route.request.post_data_json
            if b['op']=='save':
                state['snapshot']=b['snapshot'];state['revision']+=1
            route.fulfill(json={'snapshot':state['snapshot'],'revision':state['revision']})
        def api(route):
            if route.request.url.endswith('/auth/v1/user'):
                route.fulfill(json=AUTH['user']);return
            b = route.request.post_data_json
            if state['slow'] and b['op']=='save':pending.append(route)
            else:respond(route)
        c.route('https://cloud.test/**',api)
        page = c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE)
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.wait_for_function("window.__game?.G.party.length && !document.querySelector('.ttl-overlay:not(.ttl-out)') && !document.body.classList.contains('booting')")
        page.evaluate("async()=>{window.cloud=await import('/src/cloud-save.js');window.kit=await import('/src/ui/kit.js');kit.sheet.closeAll();await cloud.cloudFlush()}")
        state['slow']=True
        page.evaluate('()=>{__game.G.gold+=321;__game.autosave(true)}')
        deadline=time.monotonic()+10
        while not pending and time.monotonic()<deadline:page.wait_for_timeout(50)
        assert pending
        actions = ["UI.shell.setTab('party')","UI.openShop('buy')","UI.openShop('sell')","UI.openShop('forge')","UI.openPalace('decree')","UI.openPalace('codex')","UI.openTavern('board')","UI.shell.openPage('shrine')","UI.openInn()","UI.openDeparture()","UI.settingsSheet({})","UI.openHelp()"]
        for action in actions:
            page.evaluate('kit.sheet.closeAll();const {UI}=__game;'+action)
            page.wait_for_timeout(120)
            assert page.locator('.cloud-gate').is_hidden(),action
            assert not page.evaluate('cloud.cloudBusy()'),action
        # アカウントを開く時点で入力を止め、保存完了まで別の操作を通さない。
        page.evaluate('()=>{kit.sheet.closeAll();window.account=cloud.cloudManageAccount()}')
        assert page.locator('.cloud-gate').is_visible()
        assert page.evaluate('cloud.cloudBusy()')
        state['slow']=False
        for route in pending:respond(route)
        pending.clear()
        page.get_by_role('button',name='冒険へ戻る',exact=True).click()
        page.evaluate('async()=>await account')
        assert page.locator('.cloud-gate').is_hidden()
        # 画像失敗時の再読み込みも、最後の保存応答まで再起動しない。
        page.evaluate("""async()=>{
          kit.sheet.closeAll();__game.UI.shell.setTab('hub');
          const {watchIllustration}=await import('/src/imageloading.js');
          const owner=document.createElement('canvas');owner.style.cssText='position:fixed;top:100px;left:0;width:20px;height:20px';document.body.append(owner);
          watchIllustration('failed-screen',Promise.resolve(false),owner);
        }""")
        page.get_by_role('button',name='画像を再読み込み',exact=True).wait_for()
        state['slow']=True
        page.evaluate('__game.G.gold=987654')
        page.get_by_role('button',name='画像を再読み込み',exact=True).click()
        deadline=time.monotonic()+10
        while not pending and time.monotonic()<deadline:page.wait_for_timeout(50)
        assert pending
        assert page.evaluate('__game.G.gold')==987654
        assert page.locator('.cloud-gate').is_visible()
        assert page.evaluate('cloud.cloudBusy()')
        # 二重終了要求は受けず、保存中に背面の操作も実行させない。
        assert page.evaluate('async()=>await cloud.cloudPrepareReload(()=>{throw Error("二重保存")})') is False
        state['slow']=False
        with page.expect_navigation(wait_until='domcontentloaded'):
            for route in pending:respond(route)
            pending.clear()
        page.locator('.ttl-overlay:not(.ttl-out) .ttl-menu .ttl-btn.primary').click()
        page.wait_for_function("window.__game?.G.gold===987654 && !document.querySelector('.ttl-overlay:not(.ttl-out)')")
        assert not errors,errors
        print(f'{width}px: 街・施設12画面の低速保存中操作、アカウントの遷移待ち、画像再読込の保存完了と再開 OK',flush=True)
        c.close()
    browser.close()
