"""検証機能の撤去後も起動・音声復帰・設定・既存データの保全ができる。localhost:8000。"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script('''
      localStorage.setItem('dos-playtests-v1','old');
      localStorage.setItem('dos-save-metrics-v1','old');
      localStorage.setItem('dos-choice-trial-pending:old','old');
      localStorage.setItem('dos-cloud-pending:keep','keep');
      localStorage.setItem('dos-cloud-auth','keep');
      window.audioContexts=[];
      const Original=window.AudioContext;
      window.AudioContext=class extends Original {constructor(...a){super(...a);audioContexts.push(this);}};
    ''')
    page.goto('http://localhost:8000/', wait_until='domcontentloaded')
    page.locator('.ttl-ui').wait_for()
    page.wait_for_function('document.querySelector(".ttl-ui")')
    assert page.get_by_role('button', name='テストプレイ', exact=True).count() == 0
    assert page.get_by_role('button', name='試遊の記録', exact=True).count() == 0
    assert page.evaluate('''() => !localStorage.getItem('dos-playtests-v1') &&
      !localStorage.getItem('dos-save-metrics-v1') && !localStorage.getItem('dos-choice-trial-pending:old') &&
      localStorage.getItem('dos-cloud-pending:keep')==='keep' && localStorage.getItem('dos-cloud-auth')==='keep' ''')
    page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.wait_for_timeout(1500)
    page.evaluate('''async () => { const {sheet}=await import('/src/ui/kit.js'); sheet.closeAll(); const {UI}=await import('/src/ui/ctx.js'); UI.openSettings(); }''')
    page.get_by_role('button', name='音声を再起動', exact=True).click()
    page.wait_for_function('audioContexts.some(c=>c.state === "running")')
    assert page.get_by_text('音声の診断情報を表示', exact=True).count() == 0
    assert page.locator('a[href="effects-lab.html"], a[href="choice-trial.html"]').count() == 0
    page.get_by_text('自動化・データ', exact=True).click()
    assert page.get_by_text('保存と通信の計測', exact=True).count() == 0
    print('通常起動・確認用メニュー撤去・旧計測だけ削除・保存待ち/認証保全・音声再起動・設定を確認')
    assert not errors, errors
    browser.close()
