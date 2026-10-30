"""認証APIを模擬し、実際の再設定フォームと計測画面を検査。8001番でゲームを配信する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
# 非公開関数の入口だけをテスト時に公開する。処理本体はリポジトリのまま使う。
source = (ROOT / 'src/cloud-save.js').read_text() + '\nexport { recoveryLogin as auditRecoveryLogin };'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':390,'height':844})
    page.route('**/src/cloud-save.js', lambda r:r.fulfill(content_type='text/javascript',body=source))
    page.goto('http://127.0.0.1:8001/gear.html')
    page.evaluate('''async () => {
      const m=await import('./src/cloud-save.js'); window.calls=[]; window.failUpdate=true;
      history.replaceState(null,'',location.pathname+'#access_token=secret&refresh_token=secret&type=recovery');
      const c={config:{anonKey:'test'},fetchJSON:async(path,options)=>{
        calls.push({path, method:options?.method, body:options?.body});
        if(options?.method==='PUT' && failUpdate) throw Error('temporary');
        return {id:'test-user',email:'test@example.invalid'};
      }};
      window.recovered=false;m.auditRecoveryLogin(c).then(()=>{recovered=true});
    }''')
    page.get_by_label('パスワード',exact=True).fill('new-password-123')
    page.get_by_role('button',name='パスワードを更新',exact=True).click()
    page.wait_for_function("document.querySelector('.cloud-panel [role=status]').textContent.includes('更新できません')")
    assert page.evaluate("calls.filter(x=>x.method==='PUT').length")==1
    assert not page.evaluate('recovered')
    page.evaluate('failUpdate=false')
    page.get_by_role('button',name='パスワードを更新',exact=True).click()
    page.wait_for_function('recovered')
    assert page.evaluate("calls.filter(x=>x.method==='PUT').every(x=>x.path==='/auth/v1/user' && JSON.parse(x.body).password==='new-password-123')")
    assert page.evaluate("JSON.parse(localStorage.getItem('dos-cloud-auth')).user.id")=='test-user'
    assert page.evaluate('location.hash')==''
    # 計測は本文を保存せず、再読み込み後も残り、画面から書き出せる。
    page.evaluate('''async()=>{
      document.querySelector('.cloud-gate').hidden=true;
      const m=await import('./src/save-metrics.js');m.saveMetrics.clear();
      m.saveMetrics.record('save',{sent:1200,received:12,ms:250,status:200,ok:true});
      m.saveMetrics.trialTrigger();m.saveMetrics.trialSample('試遊');m.saveMetrics.persist();m.showSaveMetrics();
    }''')
    dialog=page.get_by_role('dialog',name='保存と通信の計測',exact=True)
    assert '1200 B' in dialog.get_by_role('textbox').input_value()
    with page.expect_download() as info: dialog.get_by_role('button',name='JSON保存',exact=True).click()
    data=Path(info.value.path()).read_text()
    assert 'sentBytes' in data and 'secret' not in data and 'new-password' not in data
    dialog.get_by_role('button',name='閉じる',exact=True).click()
    page.reload()
    page.evaluate("async()=>{const m=await import('./src/save-metrics.js');m.showSaveMetrics();}")
    assert '1200 B' in page.get_by_role('dialog',name='保存と通信の計測',exact=True).get_by_role('textbox').input_value()
    # 保存しない試遊でも容量サンプルを採れる。本番保存の通信は発生しない。
    page.goto('http://127.0.0.1:8001/?testDungeon=w01&testPlace=town')
    page.wait_for_function("!!window.__game && !document.body.classList.contains('booting')", timeout=60000)
    page.evaluate("async()=>{const m=await import('./src/save-metrics.js');window.auditMetrics=m.saveMetrics;m.saveMetrics.clear()}")
    page.wait_for_function("() => { __game.autosave(true); return window.auditMetrics.report().trial.samples>0; }", polling=1000, timeout=20000)
    trial=page.evaluate("async()=>{const m=await import('./src/save-metrics.js');return m.saveMetrics.report()}")
    print('試遊検査結果:',trial['trial'],flush=True)
    assert trial['trial']['maxSnapshotBytes']>0
    assert trial['operations']=={}
    print('試遊の容量サンプル:',trial['trial'])
    browser.close()
print('パスワード再設定: 実フォーム→PUT・失敗後再試行・認証保管 / 計測表示・JSON書出し・再読込 OK')
