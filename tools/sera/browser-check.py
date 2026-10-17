"""灯守の魂入手・宿し替え・編成・旧セラの移行。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1280]:
        page = browser.new_page(viewport={'width': width, 'height': 844}, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(content_type='text/css', body=''))
        page.goto('http://localhost:8000/?testDungeon=w17&testPlace=town&testUnlock=sub1,sub2,soulChange,fusion')
        page.wait_for_function('window.__game?.G.party.length === 6')
        checks = page.evaluate('''async () => {
          const {UI, game} = await import('/src/ui/ctx.js');
          const {sheet} = await import('/src/ui/kit.js');
          const {makeDoll, soulByUid, recalcDoll, soulRankOf, soulLevelCapOf} = await import('/src/souls.js');
          const forms = await import('/src/formations.js');
          const {SLOTS, MAX_ITEMS} = await import('/src/items.js');
          const {refSerialize, refDeserialize} = await import('/src/savegraph.js');
          const {_TUTS} = await import('/src/ui/tutorial.js');
          const G = game.G, world = __game.world, results = [];
          const check = (v, t) => { if (!v) throw Error(t); results.push(t); };
          const settle = () => new Promise(r => setTimeout(r, 180));
          sheet.closeAll(); G.irene.greeted = true; G.prompt = false;
          G.tut.cur = null; _TUTS.forEach(t => G.tut.done[t.key] = true);
          G.msq.prologue = {phase:'done', gifts:{}};
          G.insightNotified = Number.MAX_SAFE_INTEGER;
          const w = game.worldState(); delete w.beats.irene_sera_wake;
          G.souls = G.souls.filter(s => s.clsKey !== 'sera');
          // 試遊の初期魂から灯守を外し、新規入手を確かめる。
          const {setSharedSouls} = await import('/src/souls.js'); setSharedSouls(G.souls);
          const roster = [...game.allDolls()];
          const {IRENE_BEATS} = await import('/src/story.js');
          const wake = IRENE_BEATS.find(b=>b.id==='irene_sera_wake');
          for(const b of IRENE_BEATS.slice(0, IRENE_BEATS.indexOf(wake))) w.beats[b.id]=1;
          for(const key of wake.need) w.found[key]=1;
          const play=UI.playStoryChain; let eventLines=[];
          UI.playStoryChain=(scenes, done)=>{eventLines=scenes[0].lines;done();};
          G.testStoryFlow=true;
          check(world.playIreneBeat() && w.beats.irene_sera_wake, '目覚めイベントの完了で魂を入手する');
          UI.playStoryChain=play; G.testStoryFlow=false;
          const s = world.seraSoul();
          check(eventLines.at(-1).includes('の魂を手に入れた。') && !eventLines.some(l=>l.includes('サブ魂は自由に付け替え')), '目覚めイベントの末尾をご指定の文に統一');
          check(s.clsKey === 'sera' && game.allDolls().length === roster.length, '入手で隊・控えを増やさない');
          check(world.seraJoin() === s && G.souls.filter(x=>x.clsKey==='sera').length===1, '再実行で魂を重複付与しない');
          check(game.soulRepresentatives().includes(s), '灯守を宿す魂の選択肢へ載せる');
          w.beats.irene_sera_wake = 1;
          const d = G.party[0], original = d.primary;
          for (const k of SLOTS) d.equip[k] = null;
          d.subs = []; recalcDoll(d);
          UI.openSoulPicker(d, 'primary');
          check(!!document.querySelector('.sp-plist [data-job="sera"]'), 'メイン魂の選択画面に灯守を表示');
          sheet.closeAll(); await settle();
          check(game.equipSoulToSlot(d, s.uid, 'primary') && d.primary === s.uid, '通常の人業に灯守を宿せる');
          check(game.equipSoulToSlot(d, original, 'primary') && d.primary === original, '灯守からほかの魂へ交換できる');
          UI.openSoulPicker(d, 'sub0');
          check(!!document.querySelector('.sp-plist [data-job="sera"]'), 'サブ魂の選択画面に灯守を表示');
          sheet.closeAll(); await settle();
          game.equipSoulToSlot(d, s.uid, 'sub0');
          check(d.subs.some(x=>x.uid===s.uid), '灯守をサブ魂に宿せる');
          check(forms.saveFormation(G, 0, '灯守の借用').ok && forms.planFormation(G,0).ok, '灯守のサブ魂を保存編成で再現できる');
          d.subs = []; recalcDoll(d);
          game.equipSoulToSlot(d, s.uid, 'primary');
          check(forms.saveFormation(G, 1, '灯守の隊').ok && forms.planFormation(G,1).ok, '灯守のメイン魂を保存編成で再現できる');
          game.equipSoulToSlot(d, original, 'primary');
          w.beats.irene_husks = 1;
          check(world.syncSeraSoul() && soulRankOf(s) >= 2 && !game.soulWorn(s.uid), '未装着の灯守も物語でランクが上がる');
          check(game.fuseCandidates(s.uid).length === 0, '灯守の融合禁止は保つ');
          const created = world.finalizeBuyDoll(s.uid, '灯を継ぐ者');
          check(created && created.primary === s.uid && !created.vessel, '灯守を選んで通常の人業を仕立てられる');
          // 旧キャラを隊・控え・保存編成に再現。育成済み魂と装備を失わず取り除く。
          created.primary = null; recalcDoll(created);
          const old = makeDoll('セラ'); old.vessel = 'sera'; old.primary = s.uid;
          old.subs = [{uid: __game.inf.addSoulInstance('fighter').uid, picks:[]}];
          const subUid = old.subs[0].uid;
          const armor = __game.inf.cloneItem('cap'); old.equip.head = armor;
          const oldReserve = makeDoll('改名済みセラ'); oldReserve.vessel = 'sera';
          G.party.push(old); G.reserve.push(oldReserve);
          const named = makeDoll('セラ'); G.reserve.push(named); // 名前だけ一致する通常の人業は消さない。
          G.formations[2] = {name:'旧編成', members:[{uid:old.uid, primary:s.uid, subs:[], equip:old.equip},
            {uid:d.uid, primary:d.primary, subs:[], equip:d.equip}]};
          s.level = 55; s.exp = 123; s.capBonus = 7;
          const growth = JSON.stringify(s);
          G.state = 'combat'; world.migrateSeraVessel();
          check(G.party.includes(old), '戦闘中は隊を変えず帰還を待つ');
          G.abyss={started:true}; G.state='town'; world.migrateSeraVessel();
          check(G.party.includes(old), '無限迷宮中の移行は本編へ戻るまで待つ');
          G.abyss=null;
          while(G.inventory.length < MAX_ITEMS) G.inventory.push(__game.inf.cloneItem('cap'));
          G.state = 'town'; __game.renderTown();
          check(!game.allDolls().some(x=>x.vessel==='sera') && G.reserve.includes(named), '隊・控えの旧キャラだけを移行');
          check(G.inventory.includes(armor) && JSON.stringify(s)===growth && soulByUid(subUid), '装備・育成値・サブ魂を保持');
          check(G.formations[2].members.length===1 && G.formations[2].members[0].uid===d.uid, '保存編成から旧キャラだけを除く');
          const n=G.inventory.length; world.migrateSeraVessel();
          check(G.inventory.length===n && G.souls.filter(x=>x.clsKey==='sera').length===1, '移行の再実行でも品・魂を増やさない');
          const snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
          check(![...snap.party,...snap.reserve].some(x=>x.vessel==='sera') && snap.souls.some(x=>x.uid===s.uid && x.exp===123), '移行結果と育成を保存できる');
          // 最適装備に旧キャラを出さない。灯守を宿す通常キャラは対象にする。
          game.equipSoulToSlot(d, s.uid, 'primary');
          G.inventory.splice(0, G.inventory.length, __game.inf.cloneItem('cap'));
          UI.autoEquip('all');
          await settle();
          const text=document.querySelector('.pt-ae-sheet')?.textContent.replace(/\\u200b/g,'') || '';
          check(!!document.querySelector('.pt-ae-sheet') && !text.includes('改名済みセラ') && !document.querySelector('.vessel-sera'), '最適装備・肖像に専用セラの表示を残さない');
          sheet.closeAll();
          return results;
        }''')
        print(f'{width}px: ' + ' / '.join(checks), flush=True)
        # 実際のロード経路でも旧キャラを移行し、育成と装備を残す。
        page.evaluate('''async () => {
          const {makeDoll, soulByUid} = await import('/src/souls.js');
          const g = __game.G, s = g.souls.find(s=>s.clsKey==='sera');
          const old=makeDoll('旧セラ読込'); old.vessel='sera'; old.primary=s.uid;
          for(const d of [...g.party,...g.reserve]) if(d.primary===s.uid)d.primary=null;
          const item=__game.inf.cloneItem('cap'); item.seraMigrationCheck=true;
          old.equip.head=item; g.reserve.push(old);
          g.apprenticeName='移行確認'; g.state='town'; g.prompt=false;
          localStorage.setItem('dos-save-v7', __game.inf.saveJSON());
        }''')
        page.goto('http://localhost:8000/')
        page.wait_for_function('window.__game?.G.apprenticeName === "移行確認"')
        assert page.evaluate('''() => {
          const g=__game.G, s=g.souls.find(s=>s.clsKey==='sera');
          return ![...g.party,...g.reserve].some(d=>d.vessel==='sera')
            && g.inventory.some(it=>it.seraMigrationCheck)
            && s.level===55 && s.capBonus===7 && s.exp===123;
        }''')
        print(f'{width}px: 旧セーブの実ロード・育成と装備の保全 OK', flush=True)
        assert not errors, errors
        page.close()
    browser.close()
