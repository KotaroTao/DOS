"""スマホ・iPad幅の設定で診断を開き、再読込・書出し・診断だけの削除を検査する。"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER') == 'webkit' else p.chromium.launch(
        executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    for width,height in [(390,844),(1024,1366)]:
        page = browser.new_page(viewport={'width':width,'height':height}, service_workers='block')
        page.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town')
        page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
        page.evaluate('''async()=>{
          const d=await import('/src/action-wait.js');
          d.watchActionWait(()=>({combat:true,expected:true,paused:false,cloudBusy:true}));
          window.finishDiagnostic=d.actionWaitSpan('request.ledger-preview');
        }''')
        page.wait_for_function("JSON.parse(localStorage.getItem('dos-action-wait-v1')||'[]').length>0", timeout=12000)
        page.evaluate('finishDiagnostic()')
        page.reload()
        page.wait_for_function('__game?.G.state==="town"&&!document.body.classList.contains("booting")')
        page.evaluate("async()=>(await import('/src/ui/ctx.js')).UI.settingsSheet({})")
        page.get_by_role('button',name='行動待ちの診断',exact=True).click()
        text=page.get_by_role('textbox',name='行動待ちの診断情報')
        assert 'request.ledger-preview' in text.input_value()
        assert page.get_by_text('サーバーで戦闘を再計算:',exact=False).is_visible()
        page.get_by_role('button',name='診断情報をコピー',exact=True).click()
        with page.expect_download() as info:
            page.get_by_role('button',name='診断情報を保存',exact=True).click()
        assert info.value.suggested_filename=='dos-action-wait.json'
        page.evaluate("localStorage.setItem('dos-cloud-pending:keep','keep')")
        page.get_by_role('button',name='診断記録だけを消去',exact=True).click()
        assert '"records": []' in text.input_value()
        assert page.evaluate("localStorage.getItem('dos-cloud-pending:keep')")=='keep'
        assert not errors,errors
        print({'width':width,'diagnosticSurvivesReload':True,'download':True,'savePreserved':True})
        page.close()
    browser.close()
