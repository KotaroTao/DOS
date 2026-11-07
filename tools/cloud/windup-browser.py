"""構えの視覚・実音声・短い通知・非表示/失敗時の解放を調べる。localhost:8000 が必要。"""
import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
        for motion in ['no-preference','reduce']:
            ctx=await browser.new_context(service_workers='block',reduced_motion=motion,viewport={'width':744,'height':1001})
            page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            await page.route('**/windup-check.html',lambda r:r.fulfill(content_type='text/html',body='''<link rel="stylesheet" href="/ui.css"><body style="background:#171719;margin:20px;color:white"><canvas id="view" width="480" height="320" style="width:100%;height:320px;border:1px solid gold"></canvas><div id="party"><div class="pc" data-idx="0" style="margin:40px;width:100px;height:120px;border:1px solid gray"><canvas class="pc-pic" width="80" height="80"></canvas></div></div><div class="cloud-gate" hidden><div class="cloud-panel" hidden></div></div>'''))
            await page.goto('http://localhost:8000/windup-check.html')
            await page.evaluate('''async()=>{
              window.audio=await import('/src/audio.js');window.windup=await import('/src/battle-windup.js');
              audio.initAudio();audio.setVolumes(0,1);
              const {Engine}=await import('/src/music/engine.js');const play=Engine.prototype.playBuffer;
              window.prepared=[];Engine.prototype.playBuffer=function(...args){const voice=play.apply(this,args);prepared.push(voice);return voice;};
              window.show=kind=>windup.beginBattleWindup({party:document.querySelector('#party'),index:0,view:document.querySelector('#view'),label:kind==='cast'?'炎の詠唱':'攻撃の構え',kind,aim:{x:.6,y:.35}});
            }''')
            await page.evaluate("""async()=>{
              const {SFX}=await import('/src/audio.js');const original=SFX.prepare,calls=[];
              SFX.prepare=kind=>{calls.push(kind);return ()=>{};};
              try{for(const family of ['heal','revive','purify','mana']){
                const h=windup.beginBattleWindup({party:document.querySelector('#party'),index:0,view:document.querySelector('#view'),kind:'cast',skillFamily:family});h.stop();
              }}finally{SFX.prepare=original;}
              if(calls.join(',')!=='heal,revive,purify,mana')throw Error('救命技の準備音が攻撃音へ流れた');
            }""")
            for kind in ['strike','cast']:
                elapsed=await page.evaluate('kind=>{const now=performance.now();window.handle=show(kind);return performance.now()-now;}',kind)
                assert elapsed<100,('構えの開始処理が長い',elapsed)
                assert await page.locator('.battle-windup').count()==1
                assert await page.locator('.windup-spark,.windup-ring,.windup-aim,.windup-sweep').count()==0
                assert abs(await page.evaluate('prepared.at(-1).buffer.duration')-.45)<.001
                assert await page.evaluate('''()=>{const a=prepared.at(-1).buffer.getChannelData(0);let sum=0;for(let i=0;i<1920;i++)sum+=a[i]*a[i];return Math.sqrt(sum/1920)>.025 && a.every(Number.isFinite);}'''),'押した直後の準備音が無音'
                # 利用者の実測に近い60msでも、通知後に構えの完了を待つことはない。
                result=await page.evaluate('''async()=>{handle.stop();await new Promise(r=>setTimeout(r,60));handle=show('strike');await new Promise(r=>setTimeout(r,60));const start=performance.now();handle.stop();return {elapsed:performance.now()-start,remaining:document.querySelectorAll('.battle-windup').length};}''')
                assert result['remaining']==0 and result['elapsed']<50,result
                await page.wait_for_timeout(100)
                assert await page.evaluate('prepared.every(v=>v.buffer===null && v.onended===null)'),'構え音が通知後も残っている'
            # 通常攻撃だけは短い通信でも動作を保ち、遅い通信では溜めを延ばす。
            for style,network,fast in [(s,60,False) for s in ['slash','blunt','thrust','arrow','arcane']]+[('slash',900,False),('slash',60,True)]:
                result=await page.evaluate("""async ({style,network,fast})=>{
                  const start=performance.now();
                  handle=windup.beginBattleWindup({party:document.querySelector('#party'),index:0,view:document.querySelector('#view'),label:'攻撃',attackStyle:style,fast,aim:{x:.6,y:.35}});
                  await new Promise(r=>setTimeout(r,network));
                  const pending=!!document.querySelector('.normal-attack:not(.attack-releasing)');
                  const type=document.querySelector('.normal-attack')?.dataset.attackStyle;
                  await handle.complete();
                  return {pending,type,elapsed:performance.now()-start,remaining:document.querySelectorAll('.battle-windup').length};
                }""",{'style':style,'network':network,'fast':fast})
                assert result['pending'] and result['type']==style,result
                minimum=(200 if fast else 280)+80
                assert result['elapsed']>=max(network,(200 if fast else 280))+70,result
                assert result['elapsed']<max(network,minimum)+250,result
                assert result['remaining']==0,result
            # 途中終了で動作の完了待ちが残らない。
            result=await page.evaluate("""async()=>{
              handle=windup.beginBattleWindup({party:document.querySelector('#party'),index:0,view:document.querySelector('#view'),attackStyle:'slash'});
              const started=performance.now(),done=handle.complete();handle.stop(true);await done;return performance.now()-started;
            }""")
            assert result<100,result
            await page.wait_for_timeout(100)
            # 音量0とミュートは発音しない。構えの視覚は使える。
            await page.evaluate('audio.setVolumes(0,0);window.before=prepared.length;handle=show("cast")')
            assert await page.evaluate('prepared.length===before')
            await page.evaluate('handle.stop();audio.setVolumes(0,1);audio.toggleMute();handle=show("strike")')
            assert await page.evaluate('prepared.length===before')
            await page.evaluate('handle.stop();audio.toggleMute()')
            # 画面非表示・ページ離脱は音を即停止し、復帰後に残音を鳴らさない。
            await page.evaluate('''()=>{handle=show('strike');Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}''')
            assert await page.locator('.battle-windup').count()==0
            await page.wait_for_timeout(100)
            assert await page.evaluate('prepared.at(-1).buffer===null')
            await page.evaluate('delete document.hidden;handle=show("cast");window.dispatchEvent(new Event("pagehide"))')
            assert await page.locator('.battle-windup').count()==0
            # 通信エラーのパネルが出たら、構えを続けて成功を待つようには見せない。
            await page.evaluate('''()=>{handle=show('strike');document.querySelector('.cloud-gate').hidden=false;document.querySelector('.cloud-panel').hidden=false;}''')
            await page.wait_for_function("!document.querySelector('.battle-windup')")
            await page.wait_for_timeout(100)
            assert await page.evaluate('prepared.every(v=>v.buffer===null)')
            assert not errors,errors
            await ctx.close();print(motion+': 攻撃/詠唱・実音声・60ms通知・音量0/ミュート・非表示/離脱/エラーの解放 OK',flush=True)
        await browser.close()

asyncio.run(main())
