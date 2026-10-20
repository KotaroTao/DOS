"""記憶の差分・読み取り専用の装備詳細・無限迷宮の各画面を端末別に検証する。"""
from pathlib import Path
from playwright.sync_api import sync_playwright

SIZES = [(320, 568), (390, 844), (430, 932), (768, 1024), (1024, 768), (1366, 900), (1440, 600)]
ARTIFACTS = Path('/tmp/dos-memory-layout')
ARTIFACTS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w46&testPlace=town&testUnlock=infinite,forge')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {ITEMS,SLOTS}=await import('/src/items.js');
      const {soulByUid}=await import('/src/souls.js');
      const {applyAffixes}=await import('/src/infaffix.js');
      const {memoryChanges}=await import('/src/ui/infmemory.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const G=__game.G,inf=__game.inf,out=[];
      G.insightNotified=Number.MAX_SAFE_INTEGER; // 比較画面の検査に見識の祝祭を挟まない。
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      sheet.closeAll();G.prompt=false;
      check(inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']),'比較用の隊で出撃');
      G.floor=50;G.abyss.depth=50;inf.newFloor();G.abyss.guardFloor=50;
      for(const s of G.souls){s.count=100;s.level=70;s.exp=100;s.capBonus=5;}
      G.party[0].name='長い名前の試遊の器';
      const ids={};
      for(const slot of SLOTS){
        const kind=slot.startsWith('acc')?'acc':slot;
        ids[slot]=Object.keys(ITEMS).filter(id=>ITEMS[id].slot===kind&&!ITEMS[id].cursed).sort((a,b)=>ITEMS[b].name.length-ITEMS[a].name.length)[0];
        if(ids[slot])G.party[0].equip[slot]=inf.cloneItem(ids[slot],60);
      }
      const sub=inf.addSoulInstance('hermit');sub.count=50;sub.level=50;sub.exp=250;sub.capBonus=3;
      G.party[0].subs=[{uid:sub.uid,picks:[],picked:true}];
      G.party[0].tactic='bal';G.party[0].skillOrder=['heal','fire','cure'];
      inf.recalcAllDolls();
      check(game.infSaveMemory(),'以前の記憶を保存');
      const old=game.infMemoryAt(50),same=refDeserialize(refSerialize(old));
      const map=new Map(same.souls.map(s=>[s.uid,s.uid+10000]));
      same.souls.forEach(s=>{s.uid=map.get(s.uid);s.first=true;});
      same.party.forEach(d=>{d.primary=map.get(d.primary);d.subs.forEach(s=>s.uid=map.get(s.uid));Object.values(d.equip).filter(Boolean).forEach(it=>it.soulMemory=true);});
      check(memoryChanges(old,same).count===0,'通し番号と記憶由来の印だけの違いは変更に数えない');
      same.souls[0].capBonus++;
      check(memoryChanges(old,same).souls===1,'残火によるLv上限の変化を検出');
      const main=soulByUid(G.party[0].primary);main.level=78;main.count=105;main.capBonus=8;main.exp=1200;
      soulByUid(G.party[1].primary).clsKey='templar';
      soulByUid(G.party[2].primary).level=64;
      G.party[0].subs[0].picks=[{passive:'afterMp'}];
      G.party[0].equip.weapon=inf.cloneItem(ids.weapon,85);
      G.party[0].equip.weapon.afx=[{k:'A03',v:7},{k:'A04',v:5}];applyAffixes(G.party[0].equip.weapon);
      G.party[0].equip.body=null;
      game.setItemQuality(G.party[0],G.party[0].equip.acc1,40);
      G.party[3].tactic='life';G.party[3].autoOff=['heal'];
      inf.recalcAllDolls();G.gold=1000000;
      const candidate=game.infMemoryPreview(),diff=memoryChanges(old,candidate);
      check(diff.count===4&&diff.gear===3&&diff.settings===1,'変更された器・装備・作戦の数を集計');
      const before=JSON.stringify(refSerialize({old,candidate}));
      window.memoryFixture={old,candidate,ids,before,zero:refDeserialize(refSerialize(old))};
      inf.openInfRest();
      return out;
    }'''))

    def click(label):
        page.evaluate('''label => {
          const buttons=[...document.querySelectorAll('.ui-sheet-wrap')].at(-1).querySelectorAll('button');
          const b=[...buttons].find(b=>b.textContent.replace(/\\u200b/g,'').trim().startsWith(label));
          if(!b)throw Error('ボタンが無い: '+label);b.click();
        }''', label)
        page.wait_for_timeout(350)

    def fit(name, size):
        page.wait_for_timeout(350)
        result = page.evaluate('''() => {
          const card=[...document.querySelectorAll('.ui-sheet-wrap')].at(-1).querySelector('.ui-sheet');
          const body=card.querySelector('.ui-sheet-body'),r=card.getBoundingClientRect();
          const foot=card.querySelector('.ui-sheet-foot').getBoundingClientRect();
          const bad=[...card.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0&&b.getBoundingClientRect().height<43.5).map(b=>b.textContent);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight,scroll:body.scrollWidth,client:body.clientWidth,footer:foot.bottom,bad};
        }''')
        assert result['left'] >= -1 and result['right'] <= result['w'] + 1, (name, size, result)
        assert result['top'] >= -1 and result['bottom'] <= result['h'] + 1, (name, size, result)
        assert result['scroll'] <= result['client'] + 1, (name, size, result)
        assert result['footer'] <= result['h'] + 1 and not result['bad'], (name, size, result)
        page.screenshot(path=str(ARTIFACTS / f'{name}-{size[0]}x{size[1]}.png'))

    assert page.locator('.inf-memory-comparison.show-all').count() == 1
    click('変更のみ')
    page.wait_for_timeout(1800)
    for size in SIZES:
        page.set_viewport_size({'width': size[0], 'height': size[1]})
        fit('compare', size)
        check = page.evaluate('''() => {
          const root=document.querySelector('.inf-memory-comparison');
          const rows=[...root.querySelectorAll('.inf-memory-row')].filter(e=>e.getBoundingClientRect().height>0);
          return {down:root.querySelector('.inf-memory-delta.down')?.textContent,
            up:root.querySelector('.inf-memory-delta.up')?.textContent,
            rows:rows.length,same:rows.some(r=>r.classList.contains('same')),
            paired:rows.every(r=>r.querySelectorAll('.inf-memory-value').length===2)};
        }''')
        assert check['paired'] and not check['same'] and check['up'] and check['down'], check
        page.evaluate('''() => {
          const body=document.querySelector('.inf-memory-record .ui-sheet-body');
          const gear=[...body.querySelectorAll('.inf-memory-group')].find(g=>g.querySelector('h4').textContent==='装備');
          body.scrollTop+=gear.getBoundingClientRect().top-body.getBoundingClientRect().top-body.querySelector('.inf-memory-toolbar').getBoundingClientRect().height-12;
        }''')
        fit('compare-equipment', size)
        click('すべて')
        assert page.locator('.inf-memory-comparison.show-all').count() == 1
        page.evaluate("document.querySelector('.inf-memory-record .ui-sheet-body').scrollTop=100000")
        fit('compare-all-bottom', size)
        click('変更のみ')
        page.evaluate("document.querySelector('.inf-memory-record .ui-sheet-body').scrollTop=0")
    page.set_viewport_size({'width': 390, 'height': 844})
    # 装備の性能は記憶の個体を読み取り専用で表示する。
    page.locator('.inf-memory-row.changed .inf-memory-item').first.click()
    fit('gear-detail', (390, 844))
    assert page.locator('.inf-memory-detail .ui-sheet-foot button').count() == 1
    click('比較に戻る')
    click('以前の記憶を残す')
    assert page.evaluate('JSON.stringify(__game.G.abyssRec.memories[50]) === JSON.stringify(memoryFixture.old)')
    print('7画面サイズの差分・全項目・固定操作・装備詳細・取り消し OK')
    assert page.evaluate('''async () => {
      const {refSerialize}=await import('/src/savegraph.js');
      return JSON.stringify(refSerialize({old:memoryFixture.old,candidate:memoryFixture.candidate}))===memoryFixture.before;
    }'''), '比較・性能の閲覧で記憶を書き換えてはいけない'

    # 風だまり・回収人・灯番・記憶の閲覧にも同じ幅とタップ領域を使う。
    for size in [SIZES[0], SIZES[3], SIZES[5]]:
        page.set_viewport_size({'width': size[0], 'height': size[1]})
        page.evaluate("import('/src/ui/kit.js').then(({sheet})=>{sheet.closeAll();__game.inf.openInfRest();})")
        click('以前の記憶を残す')
        fit('rest', size)
        click('回収人')
        fit('trader', size)
        click('鍛え直し')
        fit('reforge', size)
        click('戻る')
        click('灯番')
        fit('keeper', size)
        page.evaluate("import('/src/ui/kit.js').then(({sheet})=>sheet.closeAll())")
        page.evaluate("import('/src/ui/infinite.js').then(({openInfMemories})=>openInfMemories())")
        fit('memories', size)
        click('B50F の記憶')
        fit('saved-party', size)
    print('スマホ・iPad・PCの風だまり/回収人/鍛え直し/灯番/記憶の閲覧 OK')
    page.evaluate('''async () => {
      const {sheet}=await import('/src/ui/kit.js');
      const {memoryComparison}=await import('/src/ui/infmemory.js');
      sheet.closeAll();
      sheet.open({kind:'info',className:'inf-sheet inf-memory-sheet',body:b=>memoryComparison(b,memoryFixture.old,memoryFixture.zero),footer:[{label:'戻る',onTap:h=>h.close()}]});
    }''')
    assert page.locator('.inf-memory-comparison.show-all').count() == 1
    assert page.locator('.inf-memory-row.changed').count() == 0
    click('変更のみ')
    assert page.locator('.inf-memory-comparison > .inf-note.dim').last.is_visible()
    print('変更なしの記憶・空の差分表示 OK')
    assert not errors, errors
    browser.close()
