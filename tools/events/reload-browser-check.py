"""確定済みの判定・報酬・危険を、通常セーブと実際の再読み込みで確認。localhost:8000。"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('DOS_TEST_URL', 'http://localhost:8000/')
ROOT = Path(__file__).resolve().parents[2]
# 内部の入口を確認用に公開するだけで、ゲームの処理は差し替えない。
SOURCE = (ROOT / 'src/game.js').read_text() + '''
window.reloadCheck = { G, openChest, chestContents, presentTrap, applyTrap, claimTreasury,
  processPickups, showPendingResults, collectWarmCorpse, askCursedChest, endBattleMeasured };
'''
HELPER = '''async () => {
 const {sheet}=await import('/src/ui/kit.js');
 const {UI,game}=await import('/src/ui/ctx.js');
 window.T={UI,game,sheet,
 cell:(id='c18')=>{sheet.closeAll();const {G}=__game;G.state='board';G.prompt=false;
   const c=G.board.cells[G.py][G.px];for(const k of Object.keys(c))if(k.startsWith('ev'))delete c[k];
   Object.assign(c,{type:'event',evId:id,cleared:false});return c;},
 click:prefix=>{const b=[...document.querySelectorAll('button')].reverse().find(b=>b.textContent.replaceAll('\\u200b','').startsWith(prefix));if(!b)throw Error('選択肢がない: '+prefix);b.click();},
 summary:()=>{const {G}=__game,c=G.board.cells[G.py][G.px];return {state:G.state,type:c.type,cleared:c.cleared,
   items:G.inventory.map(i=>({id:i.id,q:i.q})),souls:G.souls.map(s=>s.clsKey),gold:G.gold,rng:[...G.rng],
   pos:[G.px,G.py],checks:Object.fromEntries(Object.entries(c.evChecks||{}).map(([k,v])=>[k,{ok:v.ok,p:v.p,who:v.who?.uid}])),
   pickups:(G.pendingPickups||[]).map(t=>({kind:t.kind,id:t.item?.id,q:t.item?.q})),
   danger:G.pendingDanger?{kind:G.pendingDanger.kind,enemies:G.pendingDanger.enemies?.map(e=>({key:e.key,hp:e.hp,maxhp:e.maxhp}))}:null,
   results:G.pendingResults?{chest:G.pendingResults.chest?{state:G.pendingResults.chest.state,cRank:G.pendingResults.chest.cRank,drops:G.pendingResults.chest.drops.map(d=>({id:d.id,q:d.item.q}))}:null}:null};}
 };
}'''

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    errors = []
    def context():
        c = browser.new_context(service_workers='block', reduced_motion='reduce')
        c.route('**/src/game.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=SOURCE))
        c.on('page', lambda pg: pg.on('pageerror', lambda e: errors.append(str(e))))
        return c
    c = context()
    page = c.new_page()
    page.goto(BASE + '?testDungeon=w05&testPlace=board', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length>0')
    seed = page.evaluate('__game.inf.saveJSON()')
    c.close()
    def ready(page):
        page.wait_for_function('window.__game?.G.party.length>0')
        page.locator('.ttl-btn.primary').first.evaluate('(b)=>b.click()')
        page.wait_for_function('!document.querySelector(".ttl-btn.primary")')
        page.evaluate(HELPER)
    def fresh(snapshot=seed):
        c = context()
        c.add_init_script("if(location.protocol.startsWith('http')&&!sessionStorage.reloadSeeded){localStorage.setItem('dos-save-v7',%s);sessionStorage.reloadSeeded='1';}" % json.dumps(snapshot))
        page = c.new_page()
        page.goto(BASE, wait_until='domcontentloaded')
        ready(page)
        return c, page
    def reload(page):
        page.reload(wait_until='domcontentloaded')
        ready(page)
    def check(name):
        assert not errors, errors
        print(name + ': OK', flush=True)
    # 無料のレア以上の品・魂・収集品は入手通知前にマスを完了し、再取得させない。
    for event, label in [('l5_06','「迷っていない」と答える'), ('c18','楽にしてやる'), ('c12','ろうを持ち帰る')]:
        c, page = fresh()
        before = page.evaluate('''async ([id,label])=>{const c=T.cell(id);__game.G.inventory.splice(0);
          __game.ev.runEvent(__game.ev.evApi,c);T.click(label);await Promise.resolve();return T.summary();}''', [event,label])
        assert before['cleared']
        reload(page)
        after = page.evaluate('T.summary()')
        assert after['cleared'] and after['items']==before['items'] and after['souls']==before['souls']
        check(event + ' 入手通知中の再読み込みで重複取得なし')
        c.close()
    # 表示時の成功判定と謎かけの並びは、保存済みの結果を再利用する。
    for event in ['c04', 'c11']:
        c, page = fresh()
        before = page.evaluate('''async id=>{const {reseedRng}=await import('/src/rng.js');reseedRng(0);
          const c=T.cell(id);c.evRiddle=0;__game.ev.runEvent(__game.ev.evApi,c);__game.autosave(true);
          return {...T.summary(),answers:c.evAnswers};}''', event)
        reload(page)
        after = page.evaluate('''()=>({...T.summary(),answers:__game.G.board.cells[__game.G.py][__game.G.px].evAnswers})''')
        assert before['checks']==after['checks'] and before.get('answers')==after.get('answers') and before['rng']==after['rng']
        check(event + ' 表示を繰り返しても判定・乱数位置が不変')
        c.close()
    # 警告中の戦闘は敵の実物も保存する。
    for mimic in [False, True]:
        c, page = fresh()
        before = page.evaluate('''async mimic=>{const {reseedRng}=await import('/src/rng.js');reseedRng(mimic?16:4);
          const c=T.cell(mimic?'c18':'c02');
          if(mimic){c.type='chest';c.cRank=1;delete c.lootBonus;reloadCheck.openChest(c,__game.G.party[0]);}
          else {__game.ev.runEvent(__game.ev.evApi,c);T.click('持ち物をあさる');}
          return T.summary();}''', mimic)
        assert before['danger'] and before['danger']['kind']=='battle'
        reload(page)
        after = page.evaluate('T.summary()')
        assert after['danger']==before['danger'] and after['rng']==before['rng']
        page.evaluate("()=>T.click('戦う')" if mimic else "()=>T.click('応戦する')")
        assert page.evaluate("__game.G.state==='combat' && !__game.G.pendingDanger")
        check('ミミック' if mimic else '出来事の襲撃')
        c.close()
    # 街にいる間の異変はリロードでも同じ。
    c, page = fresh()
    before = page.evaluate('''()=>{T.sheet.closeAll();const {G}=__game;G.state='town';G.prompt=false;G._townMutator=null;
      const idx=__game.inf.DUNGEONS.findIndex(d=>d.id==='w05');const m=T.game.townMutatorFor(idx);return {idx,m};}''')
    for _ in range(2):
        reload(page)
        assert page.evaluate('idx=>T.game.townMutatorFor(idx)', before['idx'])==before['m']
    check('出撃前の異変を保持')
    c.close()
    # 宝物庫は語りの前に受領を確定し、途中の再読み込みでも失わない。
    c, page = fresh()
    before = page.evaluate('''()=>{T.sheet.closeAll();const {G}=__game;G.state='town';G.prompt=false;
      G.treasury={donated:Object.fromEntries(Object.values(__game.equipLv.ITEMS).filter(i=>i.slot==='misc').slice(0,5).map(i=>[i.id,true])),claimed:{}};
      const n=G.souls.length;reloadCheck.claimTreasury(5);return {n,souls:G.souls.map(s=>s.clsKey)};}''')
    assert len(before['souls'])==before['n']+1
    for _ in range(2):
        reload(page)
        assert page.evaluate('''()=>__game.G.treasury.claimed.m5 && __game.G.pendingTreasury===5 && __game.G.souls.length''')==before['n']+1
    check('宝物庫の受領場面で褒賞を失わず増やさない')
    c.close()
    # 戦果の未開封宝箱とドロップ品質、既に受け取った通貨を保持。
    c, page = fresh()
    before = page.evaluate('''()=>{const c=T.cell();c.type='monster';c.monsterKey='bs_ghoul';const {G}=__game;
      const foes=__game.spawnCardEnemies('bs_ghoul',1).slice(0,1);__game.startBattle(foes,c);
      for(const e of G.battle.enemies){e.hp=0;e.alive=false;e.mon={...e.mon,elite:true};}
      G.battle.result='win';reloadCheck.endBattleMeasured();return T.summary();}''')
    assert before['results']['chest']['state']=='closed'
    reload(page)
    after = page.evaluate('T.summary()')
    assert after['results']==before['results'] and after['gold']==before['gold'] and after['souls']==before['souls']
    # 整理画面まで進め、さらに中断して同じ実物を受け取る。
    pending = page.evaluate('''async()=>{const {G}=__game;G.specialFloor='thiefInsight';G.inventory.splice(0);
      G.inventory.push(...Array.from({length:50},()=>__game.inf.cloneItem('herb')));
      document.querySelector('.rs-chest-acts button').click();await Promise.resolve();return T.summary();}''')
    assert pending['pickups'] and pending['results']['chest']['state']=='done'
    reload(page)
    assert page.evaluate('T.summary().pickups')==pending['pickups']
    page.locator('.dc-drop').first.evaluate('(b)=>b.click()')
    page.evaluate("()=>T.click('捨てる')")
    page.wait_for_function('!__game.G.pendingPickups.length')
    got = page.evaluate('T.summary()')
    assert any(i['id']==pending['pickups'][0]['id'] and i.get('q')==pending['pickups'][0].get('q') for i in got['items'])
    reload(page)
    assert page.evaluate('T.summary().items')==got['items']
    assert page.locator('.rs-item').count() >= 1
    check('戦果の宝箱・整理中の実物・開封済み状態を保持')
    c.close()
    # 盤面の宝箱も整理中に中身を失わない。置いていく判断も保存する。
    c, page = fresh()
    before = page.evaluate('''async()=>{const c=T.cell();c.type='chest';c.cleared=true;c.lootBonus=40;const {G}=__game;
      G.inventory.splice(0);G.inventory.push(...Array.from({length:50},()=>__game.inf.cloneItem('herb')));
      reloadCheck.chestContents(c,()=>{},1,0,true);await Promise.resolve();return T.summary();}''')
    reload(page)
    assert page.evaluate('T.summary().pickups')==before['pickups']
    page.evaluate("()=>T.click('捨てずに置いていく')")
    reload(page)
    assert page.evaluate('T.summary().pickups')==[]
    check('盤面の宝箱の受け取り待ちと放棄を保持')
    c.close()
    # 警報は確定した戦闘、転送は確定した行き先を保持する。
    for kind in ['alarm','teleport']:
        c, page = fresh()
        before = page.evaluate('''async kind=>{const {TRAPS}=await import('/src/traps.js');const c=T.cell();c.type='trap';c.cleared=true;
          if(kind==='alarm')__game.G.pendingResults={gold:123,soul:456};
          const spot=__game.G.board.cells.flat().find(x=>x!==c);spot.type='empty';spot.cleared=true;
          reloadCheck.presentTrap(reloadCheck.applyTrap(TRAPS.find(t=>t.kind===kind),__game.G.party[0]),{proceed:()=>{}});
          return T.summary();}''',kind)
        reload(page)
        after = page.evaluate('T.summary()')
        assert after['danger']==before['danger'] and after['pos']==before['pos'] and after['rng']==before['rng']
        if kind=='alarm':
            page.evaluate("()=>T.click('戦う')")
            assert page.evaluate("__game.G.state==='combat'")
            assert page.evaluate("__game.G.battle.noRun && __game.G.battle.alarmRewards.gold===123 && __game.G.battle.alarmRewards.soul===456")
            page.evaluate("__game.autosave(true)")
            reload(page)
            assert page.evaluate("__game.G.battle.noRun && __game.G.battle.alarmRewards.gold===123")
            totals = page.evaluate("""()=>{T.sheet.closeAll();const {G}=__game;G.prompt=false;G.battle.result='win';
              for(const e of G.battle.enemies){e.alive=false;e.hp=0;}
              const gold=G.gold,soul=G.soulPts;reloadCheck.endBattleMeasured();
              return {gold:G.pendingResults.gold,soul:G.pendingResults.soul,dg:G.gold-gold,ds:G.soulPts-soul};}""")
            assert totals['gold']==totals['dg']+123 and totals['soul']==totals['ds']+456, totals
        check(kind + ' 罠の効果を回避させない')
        c.close()
    # 黒い宝箱の問いも開封済みのマスに紐づけて再開。
    c, page = fresh()
    page.evaluate('''()=>{const c=T.cell();c.type='chest';c.cleared=true;__game.G.pendingCursedChest=true;__game.autosave(true);reloadCheck.askCursedChest(()=>{});}''')
    reload(page)
    assert page.evaluate('!!__game.G.pendingCursedChest')
    page.evaluate("()=>T.click('立ち去る')")
    reload(page)
    assert not page.evaluate('!!__game.G.pendingCursedChest')
    check('黒い宝箱の未決定・放棄を保持')
    c.close()
    # 無限迷宮で魂を2つ拾う出来事も、最初の通知中の中断で再付与しない。
    tmp = context()
    pg = tmp.new_page()
    pg.goto(BASE + '?testInf=5', wait_until='domcontentloaded')
    pg.wait_for_function('window.__game?.G.abyss && __game.G.state==="board"')
    infinite_seed = pg.evaluate('__game.inf.saveJSON()')
    tmp.close()
    c, page = fresh(infinite_seed)
    before = page.evaluate('''async()=>{const {G}=__game;const n=G.souls.reduce((n,s)=>n+s.count,0),track=G.run.souls.length;
      const c=T.cell('inf_r11');__game.ev.runEvent(__game.ev.evApi,c);T.click('欠片を拾い集める');await Promise.resolve();
      return {...T.summary(),n,total:G.souls.reduce((n,s)=>n+s.count,0),track,tracked:G.run.souls.length};}''')
    assert before['total']==before['n']+2 and before['tracked']==before['track']+2
    for _ in range(2):
        reload(page)
        assert page.evaluate('__game.G.souls.reduce((n,s)=>n+s.count,0)')==before['total']
        assert page.evaluate('__game.G.run.souls.length')==before['tracked']
    check('無限迷宮の複数報酬・自動融合・持ち帰り記録を保持')
    c.close()
    # 魂の通知の後に宝箱へ変わる出来事でも、続きを失わない。
    c, page = fresh()
    before = page.evaluate('''async()=>{const c=T.cell('l4_09');c.evFight={tag:'headsman',won:true};
      __game.ev.eventFightWon(__game.ev.evApi,c,()=>__game.ev.evApi.back());await Promise.resolve();
      return {...T.summary(),rank:c.cRank};}''')
    assert before['type']=='chest' and not before['cleared']
    reload(page)
    after = page.evaluate('''()=>({...T.summary(),rank:__game.G.board.cells[__game.G.py][__game.G.px].cRank})''')
    assert after['souls']==before['souls'] and after['rank']==before['rank'] and after['type']=='chest'
    check('イベント戦闘後の魂と宝箱の続きを保持')
    c.close()
    # LRの実物と、満杯時の換金も、受領場面を開く前に保存する。
    for full in [False,True]:
        c, page = fresh()
        before = page.evaluate('''async full=>{T.sheet.closeAll();const {G}=__game;G.state='town';G.prompt=false;
          G.inventory.splice(0);if(full)G.inventory.push(...Array.from({length:50},()=>__game.inf.cloneItem('herb')));
          G.world.cleared=Object.fromEntries(__game.inf.DUNGEONS.map(d=>[d.id,1]));
          G.treasury={donated:Object.fromEntries(Object.values(__game.equipLv.ITEMS).filter(i=>i.slot==='misc').slice(0,15).map(i=>[i.id,true])),claimed:{}};
          reloadCheck.claimTreasury(15);return T.summary();}''',full)
        assert page.evaluate('__game.G.treasury.claimed.m15')
        reload(page)
        after = page.evaluate('T.summary()')
        assert before['items']==after['items'] and before['gold']==after['gold']
        assert page.evaluate('__game.G.pendingTreasury===15')
        check('宝物庫のLR' + ('の換金を保持' if full else 'の種類・品質を保持'))
        c.close()
    browser.close()
