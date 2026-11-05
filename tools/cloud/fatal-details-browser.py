"""再開失敗の詳細を表示し、保存済みの記録を変更しないことを確認する。"""
import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER')=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(service_workers='block')
    page.route('**/fatal-harness',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
    page.goto(os.environ.get('DOS_TEST_URL','http://127.0.0.1:8001')+'/fatal-harness')
    page.evaluate('''async()=>{
      localStorage.setItem('dos-save-v7','保存済みの記録');
      const {cloudFatal}=await import('/src/cloud-save.js');
      const error=new TypeError('再開の検証');
      error.stack='TypeError: 再開の検証\\n at resume (https://example.invalid/src/game.js?private=value:12:4)';
      cloudFatal(error,'保存した画面の再開');
    }''')
    page.get_by_text('エラー詳細',exact=True).click()
    detail=page.locator('.cloud-gate details').inner_text()
    assert 'TypeError' in detail and '再開の検証' in detail and '保存した画面の再開' in detail
    assert 'private=value' not in detail
    assert page.get_by_role('button',name='再接続',exact=True).is_visible()
    assert page.evaluate('localStorage.getItem("dos-save-v7")')=='保存済みの記録'
    print('再開失敗の詳細・再接続・記録の無変更: OK')
    browser.close()
