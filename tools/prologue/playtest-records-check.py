#!/usr/bin/env python3
"""試遊の自動記録・メモ・書き出し・終了後の保持と通常セーブの保護。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for width in [320, 1280]:
        context = browser.new_context(viewport={'width': width, 'height': 844}, service_workers='block', reduced_motion='reduce', accept_downloads=True)
        context.route('https://**/*', lambda route: route.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w01&testPlace=town', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.testPlay')
        saved = page.evaluate('localStorage["dos-save-v7"] = __game.inf.saveJSON()')
        page.goto('http://localhost:8000/?testScene=prologue:start', wait_until='domcontentloaded')
        page.wait_for_selector('.test-play-banner')
        page.wait_for_function('JSON.parse(localStorage["dos-playtests-v1"]).length===1')
        page.get_by_role('button', name='記録・メモ', exact=True).click()
        page.get_by_label('試遊のメモ', exact=True).fill('武器を替えたら早く倒せた')
        page.get_by_label('試遊のメモ', exact=True).press('Enter')
        assert page.locator('.op-overlay').count() == 1
        page.get_by_label('メモの種類', exact=True).select_option(label='工夫して強くなった')
        page.get_by_role('button', name='メモを記録', exact=True).click()
        assert '武器を替えたら早く倒せた' in page.get_by_label('記録の内容', exact=True).input_value()
        # 容量不足でも、その場のメモと記録は書き出せる。
        page.evaluate("() => {window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dos-playtests-v1')throw new DOMException('full','QuotaExceededError');return originalSetItem.call(this,k,v)}}")
        page.get_by_label('試遊のメモ', exact=True).fill('保存容量が足りなくても残すメモ')
        page.get_by_role('button', name='メモを記録', exact=True).click()
        assert '端末に保存できません' in page.locator('.playtest-records [role=status]').inner_text().replace('\u200b', '')
        with page.expect_download() as download:
            page.get_by_role('button', name='JSON保存', exact=True).click()
        import json
        with open(download.value.path()) as f:
            data = json.load(f)
        assert data['notes'][-1]['detail']['text'] == '保存容量が足りなくても残すメモ'
        page.evaluate('() => {Storage.prototype.setItem=originalSetItem}')
        assert data['events'][-1]['type'] == '試遊者メモ'
        assert data['events'][-1]['detail']['kind'] == '工夫して強くなった'
        if width == 320:
            page.screenshot(path='/tmp/dos-playtest-records-320.png')
        page.get_by_role('button', name='閉じる', exact=True).click()
        assert page.locator('.test-play-banner').evaluate('(e)=>e.scrollWidth<=innerWidth'), '狭い画面の上帯'
        # 同じ到達点が二重に増えず、メモ画面のキーが序幕に届かないこと。
        page.evaluate('''async () => {
          const {playtestEvent}=await import('/src/playtest.js');
          __game.G.party=Array.from({length:6},(_,i)=>({uid:i,subs:[],equip:{}}));
          playtestEvent('到達',{},'sixDolls');playtestEvent('到達',{},'sixDolls');
          playtestEvent('全滅・断念',{abandoned:false});
        }''')
        page.get_by_role('button', name='終了してホームへ', exact=True).click()
        page.wait_for_selector('.ttl-overlay')
        page.get_by_role('button', name='試遊の記録', exact=True).click()
        text = page.get_by_label('記録の内容', exact=True).input_value()
        assert '6人編成: 未到達' not in text
        assert '全滅・断念 1' in text and '武器を替えたら早く倒せた' in text
        assert page.evaluate('localStorage["dos-save-v7"]') == saved
        assert page.evaluate('JSON.parse(localStorage["dos-playtests-v1"])[0].endReason') == 'ホームへ戻る'
        page.goto('http://localhost:8000/?testScene=prologue:start&testSkipDungeon=1', wait_until='domcontentloaded')
        page.wait_for_selector('.test-play-banner')
        assert page.evaluate('JSON.parse(localStorage["dos-playtests-v1"])[1].skippedDungeon')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.test-play-banner')
        records = page.evaluate('JSON.parse(localStorage["dos-playtests-v1"])')
        assert len(records) == 3 and records[1]['endReason'].startswith('中断')
        assert not errors, errors
        context.close()
        print(f'{width}px: メモ・JSON保存・到達点・終了後保持・再読込・探索省略・通常セーブ保護 OK')
    # 作成済みの隊から、ゲーム本体の出撃・魂取得・戦闘・帰還・全滅の接続を確認。
    context = browser.new_context(service_workers='block', reduced_motion='reduce')
    context.route('https://**/*', lambda route: route.abort())
    page = context.new_page()
    page.goto('http://localhost:8000/?testScene=prologue:abbey', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length===6')
    print(page.evaluate('''async () => {
      const {startPlaytest,playtestRecords}=await import('/src/playtest.js');
      const {UI}=await import('/src/ui/ctx.js');
      const {G,ev,inf}=__game;
      startPlaytest(()=>({dungeon:__game.activeCfg().id,party:[],automatic:false}));
      G.state='town';G.prompt=false;G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
      ev.enterDungeon(null,1);inf.grantSoulQuiet('fighter');
      inf.returnToTown({outcome:'return'});
      let s=playtestRecords().at(-1);
      if(!s.milestones.rareFound||!s.milestones.rareHome||s.counts['出撃']!==1||s.counts['帰還']!==1)throw Error('出撃・レア魂・帰還の接続');
      G.state='town';G.prompt=false;G.party.forEach(d=>{d.stability=100;d.stabilityAt=Date.now();});
      ev.enterDungeon(null,1);G.floor=10;
      const enemies=__game.spawnBossEnemies(__game.activeCfg().boss,1);
      __game.startBattle(enemies,{type:'boss'});
      s=playtestRecords().at(-1);
      if(!s.milestones.firstBattle||s.counts['戦闘開始']!==1||s.attempts[__game.activeCfg().id]!==2)throw Error('初戦闘・再出撃の接続');
      G.battle.enemies.forEach(e=>{e.hp=0;e.alive=false;});G.battle.result='win';ev.endBattle();
      s=playtestRecords().at(-1);
      if(!s.milestones.firstBoss||s.counts['戦闘終了']!==1)throw Error('主討伐の接続');
      inf.gameOver();
      if(playtestRecords().at(-1).counts['全滅・断念']!==1)throw Error('全滅の接続');
      return 'OK: ゲーム本体の出撃・再出撃・レア入手と持ち帰り・初戦闘・主討伐・全滅を記録';
    }'''))
    browser.close()
