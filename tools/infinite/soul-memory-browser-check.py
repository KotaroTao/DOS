"""魂の記憶の保存・再開・戦利品の区別を実画面で確認する (localhost:8000)。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w46&testPlace=town&testUnlock=infinite,forge')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game, UI}=await import('/src/ui/ctx.js');
      const {ITEMS}=await import('/src/items.js');
      const {SOUL_CLASSES,soulByUid}=await import('/src/souls.js');
      const {rollStartSouls}=await import('/src/abyss.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {sheet}=await import('/src/ui/kit.js');
      const G=__game.G, inf=__game.inf, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      const picks=[];for(let i=0;i<6;i++)picks.push(rollStartSouls(picks)[0]);
      const home={party:G.party,souls:G.souls,bag:G.inventory,gold:G.gold,soulCount:G.souls.length};
      check(inf.enterAbyss(picks),'1階から新規出撃');
      check(game.infMemories().length===0,'旧記録にも空の記憶一覧を作る');
      G.floor=50;G.abyss.depth=50;inf.newFloor();
      check(!game.infSaveMemory(),'主を討つ前は保存不可');
      G.abyss.guardFloor=50;G.party[0].alive=false;
      check(!game.infSaveMemory(),'砕けた器がいる時は保存不可');
      G.party[0].alive=true;
      const key=Object.keys(SOUL_CLASSES).find(k=>SOUL_CLASSES[k].rarity!=='unique'&&!picks.includes(k));
      const sub=inf.addSoulInstance(key);sub.count=100;sub.level=30;sub.capBonus=4;
      check(inf.infSetSub(G.party[0],0,sub.uid),'サブ魂を宿す');
      G.party[0].subs[0].picks=[];G.party[0].subs[0].picked=true;
      G.party[0].tactic='life';G.party[0].autoOff=['heal'];
      const unused=Object.keys(SOUL_CLASSES).find(k=>SOUL_CLASSES[k].rarity!=='unique'&&!G.souls.some(s=>s.clsKey===k));
      inf.addSoulInstance(unused);
      const weaponId=Object.keys(ITEMS).find(id=>ITEMS[id].slot==='weapon'&&!ITEMS[id].cursed&&!ITEMS[id].exclusive&&!ITEMS[id].forJob);
      const weapon=inf.cloneItem(weaponId,73);G.party[0].equip.weapon=weapon;
      const {applyAffixes}=await import('/src/infaffix.js');
      weapon.afx=[{k:'A03',v:2}];applyAffixes(weapon);
      const second=inf.cloneItem(weaponId,61);G.party[1].equip.weapon=second;
      inf.recalcAllDolls();G.party[0].hp=1;G.party[0].mp=0;G.party[0].ailment='poison';
      G.gold=4321;G.soulPts=7654;G.embers=9;
      G.inventory.push(inf.cloneItem('u_soul_incense'),inf.cloneItem(weaponId));
      G.run.souls.push({clsKey:key});G.run.embers=2;
      const main=soulByUid(G.party[0].primary);main.count=100;main.level=70;main.exp=123;main.capBonus=3;inf.recalcAllDolls();
      const preview=game.infMemoryPreview();
      check(preview.souls.length===7&&!preview.souls.some(s=>s.clsKey===unused),'宿しているメイン魂とサブ魂だけ保存');
      check(!preview.party[0].items&&preview.party[0].equip.weapon.q===73,'袋は保存せず装備の品質を保存');
      window.memoryExpected={weaponId,key,unused,home,preview,out};
      inf.openInfRest();
      return out;
    }'''))

    def click(text):
        page.evaluate('''text => {
          const b=[...document.querySelectorAll('button')].reverse().find(b=>b.textContent.replace(/\\u200b/g,'').trim().startsWith(text));
          if(!b)throw Error('ボタンが無い: '+text);b.click();
        }''', text)

    assert page.evaluate('!!__game.G.abyssRec.memories[50]'), '初回の節目で自動保存'
    page.wait_for_timeout(100)
    print(page.evaluate('''async () => {
      const {game,UI}=await import('/src/ui/ctx.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {soulByUid}=await import('/src/souls.js');
      const G=__game.G,inf=__game.inf,e=memoryExpected,out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      sheet.closeAll();
      const memory=game.infMemoryAt(50);
      check(!!memory&&G.party[0].hp===1&&G.party[0].ailment==='poison','自動保存・現在の傷は変えない');
      check(!G.party[0].equip.weapon.soulMemory&&G.run.souls.length===1,'保存しても今回の戦利品は通常のまま');
      G.party[0].equip.weapon.q=10;soulByUid(G.party[0].primary).level=2;
      check(memory.party[0].equip.weapon.q===73&&memory.souls.find(s=>s.uid===memory.party[0].primary).level===70,'装備と魂の記憶は独立した写し');
      const saved=refDeserialize(JSON.parse(inf.saveJSON()));
      check(saved.abyssRec.memories[50].party[0].equip.weapon.q===73,'既存の保存形式で記憶を永続化');
      inf.returnToTown({outcome:'wipe'});
      check(G.party===e.home.party&&G.souls===e.home.souls&&G.inventory===e.home.bag&&G.gold===e.home.gold,'全滅後に本編を戻す');
      check(game.infMemoryAt(50)===memory,'全滅しても記憶は残る');
      for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
      await new Promise(r=>setTimeout(r,600));sheet.closeAll();
      UI.openDeparture({page:'abyss'});
      return out;
    }'''))
    click('魂の記憶から始める')
    click('B50F の記憶')
    page.wait_for_timeout(2500)
    page.screenshot(path='/tmp/dos-soul-memory-start.png')
    click('B51F から始める')
    page.wait_for_function('__game.G.state === "board" && __game.G.floor === 51')
    print(page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const {soulByUid}=await import('/src/souls.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const {sheet}=await import('/src/ui/kit.js');
      const G=__game.G,inf=__game.inf,e=memoryExpected,out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      check(G.floor===51&&G.run.startFloor===51,'実ボタンで51階から開始');
      check(G.gold===0&&G.soulPts===0&&G.embers===0&&G.inventory.length===0,'資金・残火・袋の品は持ち込まない');
      check(G.run.souls.length===0&&G.run.embers===0,'新しい戦利品記録で開始');
      check(G.party.every(d=>d.hp===d.maxhp&&d.mp===d.maxmp&&!d.ailment),'HP・MP全回復・状態異常なし');
      check(G.souls.length===7&&G.souls.every(s=>s.first),'開始時のメイン魂とサブ魂は持ち帰り対象外');
      const main=soulByUid(G.party[0].primary);check(main.level===70&&main.exp===123&&main.count===100&&main.capBonus===3,'メイン魂のLv・経験値・融合数・Lv上限を復元');
      check(G.party[0].tactic==='life'&&G.party[0].autoOff.includes('heal')&&G.party[0].subs[0].picked,'作戦と借用設定を復元');
      const sub=soulByUid(G.party[0].subs[0].uid);
      check(sub.clsKey===e.key&&sub.level===30&&sub.count===100&&sub.capBonus===4,'サブ魂の育成状態を復元');
      const gear=G.party[0].equip.weapon;
      check(gear.soulMemory&&gear.q===73&&gear.afx[0].k==='A03'&&gear.afx[0].v===2&&game.sellPrice(gear)===0,'記憶した品質・追加の能力で装備し、売値0');
      check(game.reforgeBlock(G.party[0],gear,{gold:false})&&!game.setItemQuality(G.party[0],gear,100),'鍛え直しと品質変更を禁止');
      check(game.infReturnItems().length===0,'記憶した装備は帰還対象外');
      const saved=refDeserialize(JSON.parse(inf.saveJSON()));
      check(saved.party[0].equip.weapon.soulMemory&&saved.inventory===saved.party[0].items,'途中保存で装備の制限と共有袋を保持');
      G.floor=55;G.abyss.depth=55;G.abyss.guardFloor=55;
      G.party[0].equip.weapon=null;G.inventory.push(gear);
      const stock=G.shopStock[gear.id]||0,affix=JSON.stringify(G.shopAfx||{}),gold=G.gold,sold=game.infStats().sold;
      check(!game.shopAfxClash(gear)&&!game.infSellPlan().list.some(x=>x.item===gear),'記憶した装備は特性比較・一括売却対象外');
      check(inf.infSell(G.party[0],gear),'記憶した装備を個別売却できる');
      check(G.gold===gold&&(G.shopStock[gear.id]||0)===stock&&JSON.stringify(G.shopAfx||{})===affix&&game.infStats().sold===sold,'売却しても資金・商会・売却実績は増えない');
      game.shopReceive(gear);check((G.shopStock[gear.id]||0)===stock,'商会の受け入れ口でも記憶した装備を拒否');
      const fresh=inf.cloneItem(e.weaponId,80);G.inventory.push(fresh);
      check(game.sellPrice(fresh)>0&&!fresh.soulMemory&&game.infReturnItems().includes(fresh),'新規入手装備は持ち帰れる');
      inf.grantSoulQuiet(e.key);G.run.embers=3;
      check(G.run.souls.length===1,'開始時と同じ職業の新規入手魂も持ち帰れる');
      sheet.closeAll();inf.returnToTown({outcome:'return'});
      check((G.shopStock[fresh.id]||0)===stock+1,'通常帰還で新規入手品だけ商会へ');
      check(G.souls.length===e.home.soulCount+1&&G.souls.at(-1).clsKey===e.key,'新規入手した魂だけ本編に加わる');
      for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
      await new Promise(r=>setTimeout(r,600));sheet.closeAll();check(inf.enterAbyss(null,false,false,50),'同じ記憶から再挑戦');
      check(G.party[0].equip.weapon.q===73,'売却後も次の挑戦で元の装備を復元');
      G.floor=100;G.abyss.depth=100;G.abyss.guardFloor=100;
      check(game.infSaveMemory(),'100階の記憶を独立して保存');
      const hundred=game.infMemoryAt(100);
      G.floor=50;G.abyss.depth=50;G.abyss.guardFloor=50;
      G.party[0].equip.weapon=null;
      inf.openInfRest();
      e.hundred=hundred;
      return out;
    }'''))
    click('魂の記憶を上書きする')
    page.wait_for_timeout(2500)
    page.screenshot(path='/tmp/dos-soul-memory-overwrite.png')
    click('以前の記憶を残す')
    assert page.evaluate('__game.G.abyssRec.memories[50].party[0].equip.weapon.q === 73')
    click('魂の記憶を上書きする')
    click('この状態で上書きする')
    assert page.evaluate('__game.G.abyssRec.memories[50].party[0].equip.weapon === null && __game.G.abyssRec.memories[100] === memoryExpected.hundred')
    print('上書きの比較画面・取り消し・確定・他の階の記憶の保持 OK')
    # 試遊の保存停止を経由せず、通常の読み込み処理で途中セーブを復元する。
    raw = page.evaluate('__game.inf.saveJSON()')
    loaded = browser.new_page(viewport={'width': 390, 'height': 844})
    loaded.on('pageerror', lambda e: errors.append(str(e)))
    loaded.goto('http://localhost:8000/')
    loaded.wait_for_function('!!window.__game?.loadGame')
    print(loaded.evaluate('''async raw => {
      const {game}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const G=__game.G,inf=__game.inf,out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      localStorage.setItem('dos-save-v7',raw);
      check(__game.loadGame(),'通常セーブの読み込み');
      check(game.infMemories().length===2&&G.floor===50&&G.party[1].equip.weapon.soulMemory,'読み込み後も各階の記憶・途中階・装備の制限を保持');
      const memory=game.infMemoryAt(100);
      sheet.closeAll();inf.returnToTown({outcome:'wipe'});
      const homeSouls=G.souls.length,homeEmbers=G.embers;
      for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
      check(inf.enterAbyss(null,false,false,100)&&G.floor===101,'読み込んだ100階の記憶から101階へ');
      const id=G.party[0].equip.weapon.id,stock=G.shopStock[id]||0;
      G.inventory.push(inf.cloneItem(id,80));
      inf.grantSoulQuiet(G.souls[0].clsKey);G.run.embers=2;
      G.party.forEach(d=>{d.hp=0;d.alive=false;});
      check(game.infReturnItems().length===1,'全滅保護の対象数も記憶した装備を除外');
      inf.returnToTown({outcome:'saved'});
      check((G.shopStock[id]||0)===stock+1&&G.souls.length===homeSouls+1&&G.embers===homeEmbers+2,'全滅保護でも新しく得た品・魂・残火だけ持ち帰る');
      check(game.infMemoryAt(100)===memory&&memory.party[0].equip.weapon.q===73,'全滅保護後も記憶を保持');
      await new Promise(r=>setTimeout(r,600));sheet.closeAll();
      for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}
      check(inf.enterAbyss(null,false,false,100),'全滅後も同じ記憶から何度でも再開');
      const before=G.shopStock[id]||0;inf.returnToTown({outcome:'return'});
      check((G.shopStock[id]||0)===before,'記憶した装備だけの帰還では商会の在庫が増えない');
      return out;
    }''', raw))
    assert not errors, errors
    browser.close()
