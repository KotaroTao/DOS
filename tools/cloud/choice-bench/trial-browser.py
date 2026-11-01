"""B試遊の実画面: 確定前のHP/乱数不変、構えの比較、再送と計測書き出し。"""
import argparse, asyncio, json, os, re, struct, uuid, zlib
from functools import lru_cache
from pathlib import Path
from playwright.async_api import async_playwright

# 魔物の画像には寸法の検査があるため、台帳と同じ寸法の軽いPNGを返す。
MONSTER_SIZES = {key: (int(w),int(h)) for key,w,h in re.findall(r"\s+(\w+): \[(\d+), (\d+)\]", (Path(__file__).resolve().parents[3]/'src/monsterphotos.js').read_text())}
@lru_cache(maxsize=32)
def placeholder(width,height):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    raw=(b'\x00'+bytes([90,70,50,255])*width)*height
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
async def stub_art(route):
    key=route.request.url.rsplit('/',1)[-1].split('.')[0]
    size=MONSTER_SIZES.get(key,(2,2)) if '/monsters/' in route.request.url else (2,2)
    await route.fulfill(content_type='image/png',body=placeholder(*size))

async def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',default='http://localhost:8000/');parser.add_argument('--live-private');parser.add_argument('--stub-art',action='store_true');parser.add_argument('--output',default='/tmp/dos-choice-trial-browser');args=parser.parse_args()
    live=json.loads(Path(args.live_private).read_text()) if args.live_private else None
    cloud={'enabled':True,'url':live['url'] if live else 'https://cloud.test','anonKey':live['anonKey'] if live else 'public-test','protocol':1}
    auth={'access_token':live['accessToken'] if live else 'trial-secret-not-in-report','expires_at':9999999999,'user':{'id':live['userId'] if live else str(uuid.uuid4())}}
    output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
    reports=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
        for overlap in [0,1]:
            ctx=await browser.new_context(service_workers='block',viewport={'width':390,'height':844},reduced_motion='no-preference')
            if args.stub_art:
                await ctx.route('**/art/**',stub_art)
            await ctx.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG='+json.dumps(cloud)+';'))
            # 本編の記録と接続情報は試遊中に変わってはいけない。
            await ctx.add_init_script('localStorage.setItem("dos-cloud-auth",'+json.dumps(json.dumps(auth))+');localStorage.setItem("dos-save-v7","original-game-save");')
            held=[];requests=[];receipts={};control={'hold':True,'lose':False};errors=[]
            async def api(route):
                if route.request.method=='OPTIONS': await route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'});return
                name=route.request.url.rsplit('_',1)[-1];body=route.request.post_data_json
                assert '/rest/v1/rpc/dos_choice_trial_' in route.request.url,'本編の通信が試遊から発生'
                requests.append((name,body))
                if live:
                    url=route.request.url.replace('/dos_choice_trial_','/'+live['prefix']+'_ui_')
                    try:response=await route.fetch(url=url)
                    except Exception:raise RuntimeError("試遊RPCへの接続に失敗（認証ヘッダーは記録しない）") from None
                    assert response.ok, f'試遊RPC HTTP {response.status}'
                    value=await response.json()
                elif name=='begin':value={'run':str(uuid.uuid4()),'step':0}
                elif name=='append':value=receipts.setdefault(body['p_command'],{'step':body['p_step'],'receipt':str(uuid.uuid4())})
                else:
                    await asyncio.sleep(.2)
                    value={'closed':True}
                if name=='append' and control['hold']:held.append((route,value));return
                await route.fulfill(json=value,headers={'access-control-allow-origin':'*'})
            await ctx.route(cloud['url']+'/**',api)
            page=await ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
            await page.goto(args.base+f'?testDungeon=w01&choiceTrial=1&trialOverlap={overlap}',wait_until='domcontentloaded')
            await page.wait_for_function("window.__game?.G.battle?.phase==='input' && !__game.G.animating && !document.body.classList.contains('booting')",timeout=60000)
            before=await page.evaluate('JSON.stringify([__game.G.rng,__game.G.battle.enemies.map(e=>e.hp),__game.G.party.map(e=>[e.hp,e.mp])])')
            await page.locator('#combat-menu .cmd-attack').click()
            await page.locator('#combat-menu .target-list button').first.click()
            for _ in range(1500):
                if held:break
                await page.wait_for_timeout(10)
            assert held, ('追記が送信されない', errors, await page.locator('.choice-trial-status').all_text_contents(), await page.evaluate('JSON.stringify({phase:__game.G.battle.phase, anim:__game.G.animating, pending:__game.G.battle.pending})'))
            await page.wait_for_timeout(350 if overlap==0 else 900)
            assert await page.evaluate('JSON.stringify([__game.G.rng,__game.G.battle.enemies.map(e=>e.hp),__game.G.party.map(e=>[e.hp,e.mp])])')==before,'確定前にHP/MP/乱数が変化'
            assert await page.locator('#party').evaluate("n=>n.classList.contains('choice-windup')")==bool(overlap)
            if overlap:
                assert await page.locator('#party').evaluate('''n=>{const p=n.querySelector('.pc[data-idx="'+n.dataset.choiceIndex+'"] .pc-pic');return p && getComputedStyle(p).transform!=='none';}'''),'構えの見た目がない'
            await page.evaluate("document.querySelector('#combat-menu .cmd-attack')?.click()")
            assert len([r for r in requests if r[0]=='append'])==1,'二重入力で命令が増えた'
            route,value=held.pop(0)
            if overlap:
                # DBでは確定済みだが返答を失った状態。HPは変えず同一IDで再送する。
                await route.fulfill(status=503,json={'message':'response lost'},headers={'access-control-allow-origin':'*'})
                await page.get_by_role('button',name='同じ選択で再接続').wait_for()
                assert await page.evaluate('JSON.stringify([__game.G.rng,__game.G.battle.enemies.map(e=>e.hp),__game.G.party.map(e=>[e.hp,e.mp])])')==before
                await page.get_by_role('button',name='同じ選択で再接続').click()
                for _ in range(1500):
                    if held:break
                    await page.wait_for_timeout(10)
                assert held
                assert [r[1] for r in requests if r[0]=='append'][0]==[r[1] for r in requests if r[0]=='append'][1]
                route,value=held.pop(0)
            await route.fulfill(json=value,headers={'access-control-allow-origin':'*'})
            await page.wait_for_function("!__game.G.animating && __game.G.battle.phase==='input'",timeout=10000)
            assert await page.evaluate('JSON.stringify([__game.G.rng,__game.G.battle.enemies.map(e=>e.hp),__game.G.party.map(e=>[e.hp,e.mp])])')!=before
            assert await page.evaluate('!!__game.G.fx'),'既存の着弾演出がない'
            assert not await page.locator('#party').evaluate("n=>n.classList.contains('choice-windup')")
            assert await page.evaluate("localStorage.getItem('dos-save-v7')")=='original-game-save'
            assert json.loads(await page.evaluate("localStorage.getItem('dos-cloud-auth')"))==auth
            assert await page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('dos-choice-trial-pending:')).length")==0
            async with page.expect_download() as download_event:await page.get_by_role('button',name='B計測を書き出す').click()
            download=await download_event.value;path=output/f'battle-overlap-{overlap}.json';await download.save_as(path)
            report=json.loads(path.read_text());reports.append(report)
            row=report['actions'][0];assert row['impactMs']>=row['receiptMs']>= (350 if overlap==0 else 900)
            assert row['impactMs']-row['receiptMs']<100,'確定後に余分な待ちがある'
            assert (row['preparationMs'] is not None)==bool(overlap)
            assert row['retries']==overlap
            assert 'access_token' not in path.read_text() and auth['access_token'] not in path.read_text() and 'p_command' not in path.read_text()
            await page.screenshot(path=str(output/f'battle-overlap-{overlap}.png'))
            control['hold']=False
            before_rewards=await page.evaluate('JSON.stringify([__game.G.gold,__game.G.soulPts,__game.G.inventory])')
            await page.evaluate("""()=>{const enemies=__game.G.battle.enemies;enemies.forEach((e,i)=>{e.alive=i===0;e.hp=i===0?1:0;e._barrierLeft=0;});}""")
            await page.locator('#combat-menu .cmd-attack').click()
            await page.wait_for_function("__game.G.battle.result==='win'",timeout=15000)
            await page.wait_for_function("document.querySelector('.choice-trial-status').textContent.includes('書き出せます')")
            assert await page.evaluate('JSON.stringify([__game.G.gold,__game.G.soulPts,__game.G.inventory])')==before_rewards,'試遊の勝利で報酬処理が実行された'
            assert await page.evaluate("__game.G.state==='combat' && __game.G.animating"),'試遊の勝利後に本編へ進んだ'
            await page.get_by_role('button',name='終了してホームへ').click();await page.wait_for_url('**/choice-trial.html')
            assert any(r[0]=='close' for r in requests),'終了時に試遊を閉じていない'
            # 同じ端末の通信20回。失敗時も画面から同一命令を再接続できる。
            if overlap==0:
                control['hold']=False
                await page.locator('#measure').click()
                await page.wait_for_function("!document.querySelector('#measure').disabled",timeout=60000)
                assert len([r for r in requests if r[0]=='append'])==22
                async with page.expect_download() as download_event:await page.get_by_role('button',name='B計測を書き出す').click()
                download=await download_event.value;path=output/'measure.json';await download.save_as(path)
                report=json.loads(path.read_text());assert report['summary']['network']['samples']==20
                reports.append(report)
            assert not errors,errors
            print(f'B試遊 overlap={overlap}: 確定前不変・構え・既存着弾・二重入力・再送・JSON・本編不変 OK',flush=True)
            await ctx.unroute_all(behavior="wait")
            await ctx.close()
        # 試遊を選んでいない通常のテストプレイに追記APIは入らない。
        ctx=await browser.new_context(service_workers='block');page=await ctx.new_page();unexpected=[]
        if args.stub_art:
            await ctx.route('**/art/**',stub_art)
        await ctx.route('**/rest/v1/rpc/dos_choice_trial_*',lambda r:unexpected.append(r.request.url))
        await page.goto(args.base+'?testDungeon=w01&testPlace=town',wait_until='domcontentloaded')
        await page.wait_for_function("window.__game?.G.party.length>0 && !document.body.classList.contains('booting')",timeout=60000)
        assert not unexpected
        await browser.close()
    print('B試遊のブラウザ検査完了。保存先: '+str(output),flush=True)

asyncio.run(main())
