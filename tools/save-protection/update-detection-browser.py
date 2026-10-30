"""登録前の更新開始・通知前の有効化・画面復帰を検証する。"""
from pathlib import Path
import base64
from playwright.sync_api import sync_playwright
source=Path('src/game-update.js').read_text().replace('"dos-dev";', '"dos-loaded";',1)
module='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for scenario in ['missed','installing','current','first']:
        c=b.new_context();page=c.new_page()
        page.route('http://update.test/',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
        page.goto('http://update.test/')
        page.evaluate('''async({module,scenario})=>{
          window.reloads=0;window.updates=0;
          window.worker=new EventTarget();window.registration=new EventTarget();window.installing=new EventTarget();
          const active={postMessage(message,ports){ports[0].postMessage({type:'game-version',version:scenario==='missed'?'dos-new':'dos-loaded'});}};
          worker.controller=scenario==='first'?null:active;
          registration.update=async()=>{updates++;};
          if(scenario==='installing'){registration.installing=installing;installing.state='installing';}
          worker.register=async()=>registration;
          const {watchGameUpdates}=await import(module);
          watchGameUpdates({serviceWorker:worker,applyUpdate:()=>{reloads++;}});
        }''',{'module':module,'scenario':scenario})
        page.wait_for_timeout(100)
        if scenario=='installing':
            page.evaluate("installing.state='activated';installing.dispatchEvent(new Event('statechange'))")
        if scenario in ['missed','installing']:
            page.locator('.game-update-notice').wait_for()
            page.wait_for_function('reloads===1')
            page.evaluate("worker.dispatchEvent(new Event('controllerchange'))")
            assert page.evaluate('reloads')==1
        else:
            assert page.locator('.game-update-notice').count()==0
        before=page.evaluate('updates');page.evaluate("window.dispatchEvent(new Event('focus'))")
        page.wait_for_function('updates > '+str(before))
        print(scenario+': 重複更新なし・自動切替・復帰時の更新確認 OK')
        c.close()
    b.close()
