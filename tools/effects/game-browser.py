"""代表技を実ゲームの確定・着弾経路へ通し、主演出の集約と確定前不変を検査する。"""
import asyncio,json,os,runpy,uuid
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
stub_art=runpy.run_path(str(ROOT/'tools/cloud/choice-bench/trial-browser.py'))['stub_art']

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
        cases=[(k,f,l,'manual') for k,f,l in [('DOUBLE','flurry',60),('ZANKOU','flurry',60),('BERSERKER_METTAUCHI','impact',60),('HUNTER_SAMIDARE','projectile',60),('TATEWARI','cut',60),('KYOUGEKI','impact',60),('YAMAKUZUSHI','impact',60),('HALITO','fireball',60),('BATTLEMAGE_GURENMASHOU','fireball',60),('SPELLBLADE_ENTEI','fireball',60),('TILTOWAIT','blast',60),('TENPENCHII','blast',60),('KYOKUDAI','blast',60),('MAHALITO','firePillar',60),('GOKUEN','firePillar',60),('GOKUENRAN','firePillar',60),('DIOS','heal',60),('CHOUHATSU','ward',60),('HALITO','fireball',2500)]]+[(k,'firePillar',60,'auto') for k in ['MAHALITO','GOKUEN','GOKUENRAN']]+[('GOKUENRAN','firePillar',60,'fast'),('SPELLBLADE_ENTEI','fireball',60,'auto'),('KYOKUDAI','blast',60,'auto')]
        cases+=[('HYOUGA', 'ice', 60, 'manual'), ('ZETTAIREIDO', 'ice', 60, 'manual'), ('SPELLBLADE_SOURYUU', 'wave', 60, 'manual'), ('NECROMANCER_MEIGA', 'wave', 60, 'manual'), ('TORNADO', 'gale', 60, 'manual'), ('HERMIT_TENGUKAZE', 'gale', 60, 'manual'), ('RAIJIN', 'lightning', 60, 'manual'), ('RAIMEIRAN', 'lightning', 60, 'manual'), ('WARDEN_GANKAI', 'stone', 60, 'manual'), ('WARDEN_KANAME', 'stone', 60, 'manual'), ('DAICHIWARI', 'quake', 60, 'manual'), ('METEOR', 'quake', 60, 'manual'), ('HERMIT_TENGUKAZE', 'gale', 60, 'auto'), ('RAIMEIRAN', 'lightning', 60, 'auto')]
        cases += [('MAHALITO','firePillar',60,'auto-fast'),('GOKUEN','firePillar',60,'auto-fast'),('GOKUENRAN','firePillar',60,'auto-fast')]
        for key,expected,latency,mode in cases:
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
              const {reseedRng}=await import('/src/rng.js');reseedRng(42);
              const actor=__game.G.battle.current;for(const enemy of __game.G.battle.enemies)enemy.hp=enemy.maxhp=100000;actor.mp=actor.maxmp=999;actor.spells=[key];actor.hitBonus=1;actor.atk=100;actor.hp=Math.max(1,Math.floor(actor.maxhp/2));
              // 既存の攻撃ボタンを入口にし、選択以降は実際の技の対象選択・確定・描画を通す。
              const choose=Battle.prototype.chooseAction;Battle.prototype.chooseAction=function(action,...args){return action==='attack'?choose.call(this,'spell',key):choose.call(this,action,...args);};
            }""",key)
            await page.evaluate('(mode)=>window.testMode=mode',mode)
            await page.evaluate('''async()=>{
              const {Battle}=await import('/src/combat.js'),{SFX}=await import('/src/audio.js');
              window.pressed=null;window.impact=null;window.hitSounds=0;
              const prepare=SFX.prepare;SFX.prepare=function(...args){pressed=performance.now();if(testMode.startsWith('auto'))__game.G.autoCombat=true;if(testMode.includes('fast'))__game.G.fastAnim=true;return prepare.apply(this,args);};
              const hit=SFX.skill;SFX.skill=function(...args){hitSounds++;window.hitKind=args[0];return hit.apply(this,args);};
              const commit=Battle.prototype.commit;Battle.prototype.commit=function(...args){impact=performance.now();return commit.apply(this,args);};
              window.snapshot=()=>JSON.stringify([__game.G.rng,__game.G.party.map(e=>[e.hp,e.mp]),__game.G.battle.enemies.map(e=>e.hp)]);
              window.before=snapshot();window.atAck=null;window.fxSeen=null;
              // 短い演出を同じ時点で記録し、検査側の通信中に消えても判定を保つ。
              const probe=setInterval(()=>{const fx=__game.G.fx;if(fx?.presentationAt!=null&&fx.skill.some(e=>e.type==='skillScene')){fxSeen={count:fx.skill.filter(e=>e.type==='skillScene').length,type:fx.skill[0].type,family:fx.skill[0].design?.family,slashes:fx.slashes.length,changed:snapshot()!==before,hitSounds,hitKind:window.hitKind,dur:fx.skill[0].dur,t0:fx.skill[0].t0};if(testMode.startsWith('auto'))__game.G.autoCombat=false;clearInterval(probe);}},1);
              new MutationObserver(()=>{if(!atAck&&document.querySelector('.choice-trial-status').textContent.startsWith('確定通知'))atAck={at:performance.now(),same:snapshot()===before,impact,hitSounds};}).observe(document.querySelector('.choice-trial-status'),{childList:true,subtree:true});
            }''')
            await page.locator('#combat-menu .cmd-attack').click()
            targets=page.locator('#combat-menu .target-list button')
            if await targets.count():await targets.first.click()
            await page.wait_for_function('pressed!==null')
            if latency==2500:
                await page.wait_for_timeout(600)
                assert await page.evaluate('snapshot()===before && impact===null && hitSounds===0'),'通信完了前に戦況や被弾音が進んだ'
                assert await page.locator('.battle-windup').count()==1
            await page.wait_for_function('impact!==null',timeout=10000)
            assert await page.evaluate('atAck.same && atAck.impact===null && atAck.hitSounds===0'),'確定通知前に結果や被弾音を出した'
            elapsed=await page.evaluate('impact-pressed')
            assert elapsed>=latency-10,(latency,elapsed)
            assert await page.evaluate('impact-atAck.at<350'),'確定通知後に不要な待ちがある'
            assert await page.locator('.battle-windup').count()==0
            await page.wait_for_function('fxSeen!==null',timeout=5000)
            assert await page.evaluate('fxSeen.changed'),'確定後も戦況が更新されていない'
            assert await page.evaluate('(family)=>fxSeen.count===1 && fxSeen.type==="skillScene" && fxSeen.family===family',expected),(key,expected)
            assert await page.evaluate('fxSeen.hitSounds===1'),'対象数ぶん主音を重ねている'
            if expected in ['firePillar','fireball','blast','ice','wave','gale','lightning','stone','quake']:
                rank={'MAHALITO':1,'GOKUEN':2,'GOKUENRAN':3,'HALITO':1,'BATTLEMAGE_GURENMASHOU':2,'SPELLBLADE_ENTEI':3,'TILTOWAIT':1,'TENPENCHII':2,'KYOKUDAI':3,'ICENEEDLE':1,'HYOUGA':2,'ZETTAIREIDO':3,'AQUAWAVE':1,'SPELLBLADE_SOURYUU':2,'NECROMANCER_MEIGA':3,'KAMAITACHI':1,'TORNADO':2,'HERMIT_TENGUKAZE':3,'HERO_JINRAI':1,'RAIJIN':2,'RAIMEIRAN':3,'ISHITSUBUTE':1,'WARDEN_GANKAI':2,'WARDEN_KANAME':3,'EARTHQUAKE':1,'DAICHIWARI':2,'METEOR':3}[key]
                assert await page.evaluate('fxSeen.hitKind')==expected+('' if rank==1 else str(rank))
            assert await page.evaluate('fxSeen.slashes===0'),'技に旧三日月が重なっている'
            duration=await page.evaluate("async key=>{const {SKILL_FX_CATALOG}=await import('/src/skill-fx-catalog.js');const d=SKILL_FX_CATALOG[key],tier=d.tier;return d.kind==='phys'?d.hits*85+(testMode.includes('fast')?35:60):Math.round((tier===1?400:tier===2?700:1200)*(testMode.includes('fast')?.8:1));}",key)
            assert await page.evaluate('fxSeen.dur')==duration
            # 表示の途中で古い430msの片付けや次の行動に切り替わらない。
            remaining=await page.evaluate('(d)=>Math.max(0,fxSeen.t0+d*.7-performance.now())',duration)
            await page.wait_for_timeout(remaining)
            # 残り時間と状態を同じJS評価で読む。別の通信の間に短い演出が終わる競合を避ける。
            assert await page.evaluate('performance.now()>=fxSeen.t0+fxSeen.dur-20 || (__game.G.animating && __game.G.fx?.skill.some(e=>e.type==="skillScene"))')
            await page.wait_for_function('!__game.G.animating && __game.G.battle.phase==="input"')
            assert await page.evaluate('performance.now()-fxSeen.t0>=fxSeen.dur-20'),'火柱の終了前に次の手番へ進んだ'
            assert len(sent)==1
            assert await page.evaluate("localStorage.getItem('dos-save-v7')==='unchanged'")
            await page.get_by_role('button',name='終了してホームへ').evaluate('button=>button.click()');await page.wait_for_url('**/choice-trial.html')
            await ctx.unroute_all(behavior='wait');await ctx.close()
            assert not errors,errors
            print(f'技 {key} {mode} 通信{latency}ms: 着弾{round(elapsed)}ms・確定前不変・主演出1個/主音1回・追加通信なし OK',flush=True)
        # 通信試遊以外の通常の戦闘ループでも、爆発を途中で片付けない。
        ctx=await browser.new_context(service_workers='block',viewport={'width':390,'height':844})
        await ctx.route('**/art/**',stub_art)
        await ctx.route('**/src/cloud-config.js',lambda r:r.fulfill(content_type='text/javascript',body='export const CLOUD_CONFIG={enabled:false};'))
        page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town',wait_until='domcontentloaded')
        await page.wait_for_function('window.__game?.G.state==="town"&&!document.body.classList.contains("booting")')
        await page.evaluate("""()=>{
          const {G}=__game;G.autoCombat=false;G.fastAnim=false;
          for(const actor of G.party){actor.agi=1000;actor.hp=actor.maxhp=100000;}
          const enemies=__game.spawnCardEnemies('bs_bonepile',1,1);
          for(const enemy of enemies){enemy.hp=enemy.maxhp=1000000;enemy.agi=1;enemy.ability=null;}
          __game.startBattle(enemies,null);document.getElementById('town-shell').classList.add('hidden');
        }""")
        await page.wait_for_function('__game.G.battle?.phase==="input"&&!__game.G.animating')
        await page.locator('#combat-menu[data-mode="input"] .cmd-attack').wait_for(state='visible')
        await page.evaluate("""async()=>{
          const {Battle}=await import('/src/combat.js');const actor=__game.G.battle.current;actor.mp=actor.maxmp=999;actor.spells=['KYOKUDAI'];
          const choose=Battle.prototype.chooseAction;Battle.prototype.chooseAction=function(action,...args){return action==='attack'?choose.call(this,'spell','KYOKUDAI'):choose.call(this,action,...args);};
          window.fireSeen=null;
          const probe=setInterval(()=>{const e=__game.G.fx?.skill.find(e=>e.design?.family==='blast');if(e){fireSeen={dur:e.dur,t0:e.t0};clearInterval(probe);}},1);
        }""")
        await page.locator('#combat-menu .cmd-attack').click()
        targets=page.locator('#combat-menu .target-list button')
        if await targets.count():await targets.first.click()
        await page.wait_for_function('fireSeen!==null')
        assert await page.evaluate('fireSeen.dur===1200')
        await page.wait_for_timeout(750)
        assert await page.evaluate('__game.G.animating&&__game.G.fx?.skill.some(e=>e.design?.family==="blast")'),'通常戦闘の爆発が途中で消えた'
        await page.wait_for_function('!__game.G.animating&&__game.G.battle.phase==="input"')
        assert await page.evaluate('performance.now()-fireSeen.t0>=1200')
        await ctx.close();assert not errors,errors
        print('通常戦闘: ランク3を1200ms描き切ってから次の手番へ進む OK',flush=True)
        await browser.close()

asyncio.run(main())
