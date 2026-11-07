"""街の7施設を同じ種で巡回し、初回と再表示の所要時間・表示を比較する。"""
import argparse
import json
import os
import statistics
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', help='比較する変更前のコミット')
parser.add_argument('--report', default='/tmp/dos-town-facility.json')
parser.add_argument('--width', type=int, default=390)
args = parser.parse_args()
PATHS = ['src/game.js', 'src/townpaint.js', 'src/townart.js', 'src/imageloading.js']
original = {path: subprocess.check_output(['git', 'show', f'{args.baseline}:{path}'], cwd=ROOT).decode()
            for path in PATHS} if args.baseline else {}
ACTIONS = [('hub', "UI.shell.setTab('hub')"), ('party', 'UI.enterMansion()'),
           ('shop', "UI.openShop('buy',{cat:'weapon'})"), ('palace', "UI.openPalace('decree')"),
           ('tavern', "UI.openTavern('board')"), ('shrine', "UI.shell.openPage('shrine')"), ('inn', 'UI.openInn()')]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    pages, errors, rows = {}, [], []
    for label in (['before', 'after'] if args.baseline else ['after']):
        page = browser.new_page(viewport={'width': args.width, 'height': 844}, has_touch=args.width < 600,
                                service_workers='block', reduced_motion='reduce')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://**', lambda r: r.abort())
        page.route('**/src/cloud-config.js', lambda r: r.fulfill(content_type='text/javascript', body='export const CLOUD_CONFIG={enabled:false};'))
        rng = (ROOT / 'src/rng.js').read_text().replace('function freshSeed() {', 'function freshSeed() { return 42;')
        page.route('**/src/rng.js', lambda r, _request=None, body=rng: r.fulfill(content_type='text/javascript', body=body))
        page.add_init_script('Math.random=()=>.5;')
        if label == 'before':
            for path, body in original.items():
                page.route('**/' + path, lambda r, _request=None, body=body: r.fulfill(content_type='text/javascript', body=body))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town&testUnlock=infinite,forge,enchant,sub1,sub2,rematch,rusui', wait_until='domcontentloaded', timeout=120000)
        page.wait_for_function('window.__game?.G.party.length===6&&!document.body.classList.contains("booting")')
        page.evaluate('''async()=>{
          const {UI,game}=await import('/src/ui/ctx.js');window.UI=UI;window.kit=await import('/src/ui/kit.js');
          kit.sheet.closeAll();const g=game.G;g.irene.greeted=true;g.tut.cur=null;g.gold=99999999;
          g.insightNotified=Number.MAX_SAFE_INTEGER;g.prompt=false;
          const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.msq.prologue={phase:'done',gifts:{}};UI.shell.setTab('hub');
        }''')
        page.add_style_tag(content='*,*::before,*::after{animation:none!important;transition:none!important}')
        page.wait_for_load_state('networkidle')
        cdp = page.context.new_cdp_session(page)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        pages[label] = page
    # 初回・準備1巡・計測3巡。同じ操作を前後で交互に進める。
    for run in range(5):
        for key, action in ACTIONS:
            order = list(pages) if run % 2 == 0 else list(reversed(pages))
            pair = {}
            for label in order:
                page = pages[label]
                page.evaluate('kit.sheet.closeAll()')
                result = page.evaluate('''async ({key,action})=>{
                  const {waitForScene}=await import('/src/imageloading.js');
                  const start=performance.now();(0,eval)(action);const syncMs=performance.now()-start;
                  const held=!!document.querySelector('#town-screen>.scene-hold');
                  await waitForScene(document.getElementById('app'));
                  for(let i=0;i<120&&document.querySelector('#town-screen>.scene-hold');i++)await new Promise(r=>requestAnimationFrame(r));
                  if(document.querySelector('#town-screen>.scene-hold'))throw Error('施設の待機が終わらない');
                  const readyMs=performance.now()-start,g=__game.G;
                  const target=key==='inn'?[...document.querySelectorAll('.ui-sheet')].at(-1):document.getElementById('town-screen');
                  if(!target)throw Error('施設が表示されない '+key);
                  return {key,syncMs,readyMs,held,surface:target.textContent.replace(/\\s+/g,' ').trim(),
                    state:JSON.stringify({gold:g.gold,soulPts:g.soulPts,rng:g.rng,open:g.world.open,party:g.party.map(d=>[d.uid,d.hp,d.mp])})};
                }''', {'key': key, 'action': action})
                pair[label] = result
                rows.append({**result, 'version': label, 'run': run})
            if args.baseline:
                assert pair['before']['surface'] == pair['after']['surface'], (run, key, '表示内容が不一致')
                assert pair['before']['state'] == pair['after']['state'], (run, key, '所持金・隊・乱数・進行が不一致')
    assert not errors, errors
    summary = {}
    for label in pages:
        summary[label] = {}
        for key, _ in ACTIONS:
            measured = [r for r in rows if r['version'] == label and r['key'] == key and r['run'] >= 2]
            summary[label][key] = {'syncMedianMs': round(statistics.median(r['syncMs'] for r in measured), 1),
                                   'readyMedianMs': round(statistics.median(r['readyMs'] for r in measured), 1),
                                   'holds': sum(r['held'] for r in measured)}
    Path(args.report).write_text(json.dumps({'width': args.width, 'cpuRate': 4, 'summary': summary, 'rows': rows}, ensure_ascii=False))
    print(json.dumps({'width': args.width, 'summary': summary, 'report': args.report}, ensure_ascii=False))
    browser.close()
