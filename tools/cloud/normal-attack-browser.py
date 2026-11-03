"""短い/長い通信で、通常攻撃が振り抜きまで続き、確定前に戦況を変えない。"""
import asyncio,json,os,runpy,uuid
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
stub_art=runpy.run_path(str(ROOT/'tools/cloud/choice-bench/trial-browser.py'))['stub_art']

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
        for weapon,expected,latency,width,height in [("ls","normalSlash",2500,320,740),("ls","normalSlash",2500,768,1024),("ls","normalSlash",2500,1440,900)] + [(a,b,c,390,844) for a,b,c in [("ls","normalSlash",60),("mc","normalBlunt",60),("sp","normalThrust",60),("bw","normalArrow",60),("magic","normalArcane",60),("ls","normalSlash",2500)]]:
            ctx=await browser.new_context(service_workers='block',viewport={'width':width,'height':height})
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
            await page.evaluate('''async weapon=>{
              const {ITEMS}=await import('/src/items.js');const actor=__game.G.battle.current; actor.hitBonus=1;
              actor.equip.weapon=Object.values(ITEMS).find(it=>it.cat===(weapon==='magic'?'st':weapon));
              actor.wMagic=weapon==='magic';actor.oMagic=false;
            }''',weapon)
            await page.evaluate('''async()=>{
              const {Battle}=await import('/src/combat.js'),{SFX}=await import('/src/audio.js');
              window.pressed=null;window.impact=null;window.hitSounds=0;
              const prepare=SFX.prepare;SFX.prepare=function(...args){pressed=performance.now();return prepare.apply(this,args);};
              const hit=SFX.hit;SFX.hit=function(...args){hitSounds++;return hit.apply(this,args);};
              const commit=Battle.prototype.commit;Battle.prototype.commit=function(...args){impact=performance.now();return commit.apply(this,args);};
              window.snapshot=()=>JSON.stringify([__game.G.rng,__game.G.party.map(e=>[e.hp,e.mp]),__game.G.battle.enemies.map(e=>e.hp)]);
              window.before=snapshot();window.atAck=null;window.reaction=null;
              const probe=setInterval(()=>{if(impact!==null&&__game.G.fx?.skill.length){reaction={changed:snapshot()!==before,anim:__game.G.animating,types:__game.G.fx.skill.map(e=>e.type),slashes:__game.G.fx.slashes.length};clearInterval(probe);}},1);
              new MutationObserver(()=>{if(!atAck&&document.querySelector('.choice-trial-status').textContent.startsWith('確定通知'))atAck={same:snapshot()===before,impact,hitSounds};}).observe(document.querySelector('.choice-trial-status'),{childList:true,subtree:true});
            }''')
            await page.locator('#combat-menu .cmd-attack').click();await page.locator('#combat-menu .target-list button').first.click()
            await page.wait_for_function('pressed!==null')
            if latency==2500:
                await page.wait_for_timeout(600)
                assert await page.evaluate('snapshot()===before && impact===null && hitSounds===0'),'通信完了前に戦況や被弾音が進んだ'
                assert await page.locator('.normal-attack:not(.attack-releasing)').count()==1
                assert (await page.locator('.battle-action-name').inner_text()).replace('\u200b','').endswith(' - 攻撃')
                assert await page.locator('#controls > .battle-action-name').count()==1
                bounds=await page.evaluate("""()=>{const a=document.querySelector('.battle-action-name').getBoundingClientRect(),v=document.querySelector('#view').getBoundingClientRect();return {separate:a.top>=v.bottom||a.left>=v.right,visible:a.top>=0&&a.bottom<=innerHeight&&a.right<=innerWidth};}""")
                assert bounds['separate'] and bounds['visible'],bounds

            await page.wait_for_function('impact!==null',timeout=10000)
            assert await page.evaluate('atAck.same && atAck.impact===null && atAck.hitSounds===0'),'確定通知前に結果や被弾音を出した'
            elapsed=await page.evaluate('impact-pressed')
            assert elapsed>=max(latency,280)+60,(latency,elapsed)
            assert await page.locator('.normal-attack').count()==0
            assert await page.locator('.battle-action-name').count()==0
            await page.wait_for_function('reaction!==null')
            assert await page.evaluate('reaction.changed && reaction.anim'),'被弾の反応を待たず次へ進んだ'
            assert await page.evaluate('(type)=>reaction.types.includes(type)',expected),(weapon,expected)
            assert await page.evaluate('reaction.slashes===0'),'通常攻撃に旧三日月が重なっている'
            await page.wait_for_function('!__game.G.animating && __game.G.battle.phase==="input"')
            assert len(sent)==1
            assert await page.evaluate("localStorage.getItem('dos-save-v7')==='unchanged'")
            await page.get_by_role('button',name='終了してホームへ').click();await page.wait_for_url('**/choice-trial.html')
            await ctx.unroute_all(behavior='wait');await ctx.close()
            assert not errors,errors
            print(f'通常攻撃 {weapon} 通信{latency}ms: 動作{round(elapsed)}ms・確定/振り抜き前の状態不変・被弾の間・追加通信なし OK',flush=True)
        await browser.close()

asyncio.run(main())
