"""代表技を実ゲームの確定・着弾経路へ通し、主演出の集約と確定前不変を検査する。"""
import asyncio,json,os,runpy,uuid
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
stub_art=runpy.run_path(str(ROOT/'tools/cloud/choice-bench/trial-browser.py'))['stub_art']

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
        for key,expected,latency in [('TATEWARI','cut',60),('HALITO','fireball',60),('MAHALITO','firePillar',60),('DIOS','heal',60),('CHOUHATSU','ward',60),('HALITO','fireball',900)]:
            ctx=await browser.new_context(service_workers='block',viewport={'width':390,'height':844})
            await ctx.route('**/art/**',stub_art)
            await ctx.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:true,url:"https://cloud.test",anonKey:"test",protocol:1};'))
            await ctx.add_init_script("localStorage.setItem('dos-cloud-auth',JSON.stringify({access_token:'test',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111'}}));localStorage.setItem('dos-save-v7','unchanged');")
            sent=[]
            async def api(route):
                if route.request.method=='OPTIONS':await route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'});return
                name=route.request.url.rsplit('_',1)[-1];body=route.request.post_data_json
                if name=='append':sent.append(body);await asyncio.sleep(latency/1000)
                value={'run':str(uuid.uuid4()),'step':0} if name=='begin' else {'step':body['p_step'],'receipt':str(uuid.uuid4())} if name=='append' else {'closed':True}
                await route.fulfill(json=value,headers={'access-control-allow-origin':'*'})
            await ctx.route('https://cloud.test/**',api)
            page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto('http://localhost:8000/?testDungeon=w01&choiceTrial=1&trialOverlap=1',wait_until='domcontentloaded')
            await page.wait_for_function("window.__game?.G.battle?.phase==='input'&&!__game.G.animating&&!document.body.classList.contains('booting')")
            await page.evaluate("""async key=>{
              const {Battle}=await import('/src/combat.js');
              const actor=__game.G.battle.current;actor.mp=actor.maxmp=999;actor.spells=[key];actor.hitBonus=1;actor.atk=100;actor.hp=Math.max(1,Math.floor(actor.maxhp/2));
              // 既存の攻撃ボタンを入口にし、選択以降は実際の技の対象選択・確定・描画を通す。
              const choose=Battle.prototype.chooseAction;Battle.prototype.chooseAction=function(action,...args){return action==='attack'?choose.call(this,'spell',key):choose.call(this,action,...args);};
            }""",key)
            await page.evaluate('''async()=>{
              const {Battle}=await import('/src/combat.js'),{SFX}=await import('/src/audio.js');
              window.pressed=null;window.impact=null;window.hitSounds=0;
              const prepare=SFX.prepare;SFX.prepare=function(...args){pressed=performance.now();return prepare.apply(this,args);};
              const hit=SFX.skill;SFX.skill=function(...args){hitSounds++;return hit.apply(this,args);};
              const commit=Battle.prototype.commit;Battle.prototype.commit=function(...args){impact=performance.now();return commit.apply(this,args);};
              window.snapshot=()=>JSON.stringify([__game.G.rng,__game.G.party.map(e=>[e.hp,e.mp]),__game.G.battle.enemies.map(e=>e.hp)]);
              window.before=snapshot();window.atAck=null;
              new MutationObserver(()=>{if(!atAck&&document.querySelector('.choice-trial-status').textContent.startsWith('確定通知'))atAck={same:snapshot()===before,impact,hitSounds};}).observe(document.querySelector('.choice-trial-status'),{childList:true,subtree:true});
            }''')
            await page.locator('#combat-menu .cmd-attack').click()
            targets=page.locator('#combat-menu .target-list button')
            if await targets.count():await targets.first.click()
            await page.wait_for_function('pressed!==null')
            if latency==900:
                await page.wait_for_timeout(600)
                assert await page.evaluate('snapshot()===before && impact===null && hitSounds===0'),'通信完了前に戦況や被弾音が進んだ'
                assert await page.locator('.battle-windup').count()==1
            await page.wait_for_function('impact!==null',timeout=10000)
            assert await page.evaluate('atAck.same && atAck.impact===null && atAck.hitSounds===0'),'確定通知前に結果や被弾音を出した'
            elapsed=await page.evaluate('impact-pressed')
            assert elapsed>=latency-10,(latency,elapsed)
            assert elapsed<latency+350,(latency,elapsed)
            assert await page.locator('.battle-windup').count()==0
            await page.wait_for_function('__game.G.fx?.skill.some(e=>e.type==="skillScene")',timeout=5000)
            assert await page.evaluate('snapshot()!==before'),'確定後も戦況が更新されていない'
            assert await page.evaluate('(family)=>__game.G.fx.skill.length===1 && __game.G.fx.skill[0].type==="skillScene" && __game.G.fx.skill[0].design.family===family',expected),(key,expected)
            assert await page.evaluate('hitSounds===1'),'対象数ぶん主音を重ねている'
            assert await page.evaluate('__game.G.fx.slashes.length===0'),'技に旧三日月が重なっている'
            await page.wait_for_function('!__game.G.animating && __game.G.battle.phase==="input"')
            assert len(sent)==1
            assert await page.evaluate("localStorage.getItem('dos-save-v7')==='unchanged'")
            await page.get_by_role('button',name='終了してホームへ').click();await page.wait_for_url('**/choice-trial.html')
            await ctx.unroute_all(behavior='wait');await ctx.close()
            assert not errors,errors
            print(f'技 {key} 通信{latency}ms: 着弾{round(elapsed)}ms・確定前不変・主演出1個/主音1回・追加通信なし OK',flush=True)
        await browser.close()

asyncio.run(main())
