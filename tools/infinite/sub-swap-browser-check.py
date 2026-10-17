"""灯番のサブ魂交換・借用保持・確認画面を実処理で検証 (localhost:8000)。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town&testUnlock=infinite')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const {SOUL_CLASSES,soulLearnedSkills}=await import('/src/souls.js');
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const G=__game.G, inf=__game.inf, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      const keys=Object.keys(SOUL_CLASSES);
      check(inf.enterAbyss(keys.slice(0,6)), '無限迷宮を開始');
      G.floor=5; G.abyss.depth=5; inf.newFloor();
      const [a,b]=G.party;
      a.name='交換元'; b.name='交換先';
      const x=inf.addSoulInstance(keys[6],1,30), y=inf.addSoulInstance(keys[7],1,30);
      inf.infSetSub(a,0,x.uid); inf.infSetSub(b,0,y.uid);
      a.subs[0].picks=[{skill:soulLearnedSkills(x)[0]}]; a.subs[0].picked=true;
      b.subs[0].picks=[]; b.subs[0].picked=true;
      inf.recalcAllDolls();
      const left=JSON.stringify(a.subs[0]),right=JSON.stringify(b.subs[0]);
      a.hp=1;a.mp=0;b.hp=1;b.mp=0;
      const pv=inf.infSubPreview(a,0,y.uid);
      check(JSON.stringify(a.subs[0])===left&&JSON.stringify(b.subs[0])===right,'見積もりで借用設定を変えない');
      check(!inf.infSubBlock(a,0,y.uid)&&inf.infSetSub(a,0,y.uid),'他の器のサブ魂を交換');
      check(JSON.stringify(a.subs[0])===right&&JSON.stringify(b.subs[0])===left,'技と空の選択・選択済み印を両方向に保持');
      check(a.maxhp===pv.maxhp&&a.maxmp===pv.maxmp,'借用設定を含む見積もりと実能力が一致');
      check(a.hp===1&&b.hp===1&&a.mp===0&&b.mp===0,'交換しても両者を回復しない');
      check(!!inf.infSubBlock(a,0,b.primary),'他の器のメイン魂は選べない');
      b.alive=false;check(!!inf.infSubBlock(a,0,x.uid),'砕けた器からは交換不可');b.alive=true;
      G.floor=6;check(!!inf.infSubBlock(a,0,x.uid),'風だまり以外では交換不可');G.floor=5;
      check(inf.infSetSub(a,1,x.uid)&&b.subs.length===0,'空き枠へ移すと相手の枠が空く');
      check(JSON.stringify(a.subs[1])===left,'空き枠への移動も借用保持');
      check(inf.infSetSub(a,0,x.uid)&&JSON.stringify(a.subs[0])===left&&JSON.stringify(a.subs[1])===right,'同じ器の枠交換も保持');
      check(inf.infSetSub(b,0,y.uid),'確認画面用に相手へ戻す');
      const saved=refDeserialize(JSON.parse(inf.saveJSON()));
      check(JSON.stringify(saved.party[0].subs[0])===left&&JSON.stringify(saved.party[1].subs[0])===right,'保存後も両者の借用設定を保持');
      window.swapBefore=JSON.stringify([a.subs,b.subs]);
      inf.openInfRest();
      return out;
    }'''))
    def click(text):
        page.evaluate('''text=>{const el=[...document.querySelectorAll('button,[role="button"]')].reverse().find(e=>e.textContent.replace(/\\u200b/g,'').trim().startsWith(text));if(!el)throw Error('操作が無い:'+text);el.click();}''', text)
        page.wait_for_timeout(350)
    click('灯番')
    # 最初の器のサブ魂を開く。
    page.evaluate('''()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.replace(/\\u200b/g,'').trim()==='サブ魂');if(!b)throw Error('サブ魂ボタンが無い');b.click();}''')
    click('替える')
    # 他の器のサブ魂は、宿主と枠を表示する。選択不可の魂にも宿主を残す。
    page.evaluate('''()=>{
      const {party,souls}=__game.G;
      const other=party[1];
      const rows=[...document.querySelectorAll('.ui-sheet')].at(-1).querySelectorAll('.inf-swap-row');
      for(const [uid,home] of [[other.primary,'交換先のメイン魂'],[other.subs[0].uid,'交換先のサブ魂1']]){
        const soul=souls.find(s=>s.uid===uid);
        const row=[...rows].find(e=>e.querySelector('.ui-row-title')?.textContent.replace(/\\u200b/g,'').includes('Lv'+soul.level+'/')&&e.textContent.replace(/\\u200b/g,'').includes(home));
        if(!row)throw Error('宿主と枠の表示が無い:'+home);
        const taken=uid===other.subs[0].uid;
        if(row.classList.contains('inf-sub-taken')!==taken)throw Error('他の器のサブ魂だけを着色していない:'+home);
        if(taken){
          const card=row.querySelector('.ui-row'), sub=row.querySelector('.ui-row-sub');
          if(getComputedStyle(card).borderTopColor!=='rgb(113, 196, 237)'||getComputedStyle(sub).color!=='rgb(166, 217, 242)')throw Error('サブ魂の青い表示が反映されていない');
        }
      }
    }''')
    page.screenshot(path='/tmp/dos-infinite-sub-holder.png')
    assert page.evaluate('swapBefore===JSON.stringify([__game.G.party[0].subs,__game.G.party[1].subs])')
    page.evaluate('''()=>{const row=[...[...document.querySelectorAll('.ui-sheet')].at(-1).querySelectorAll('.inf-swap-row')].find(e=>e.textContent.replace(/\\u200b/g,'').includes('交換先のサブ魂1'));if(!row)throw Error('相手の表示が無い');row.querySelector('.inf-swap-b').click();}''')
    page.wait_for_timeout(200)
    text=page.inner_text('body').replace('\u200b','')
    assert 'サブ魂が交換される' in text and 'そのまま維持される' in text
    click('やめる')
    assert page.evaluate('swapBefore===JSON.stringify([__game.G.party[0].subs,__game.G.party[1].subs])')
    page.evaluate('''()=>{const row=[...[...document.querySelectorAll('.ui-sheet')].at(-1).querySelectorAll('.inf-swap-row')].find(e=>e.textContent.replace(/\\u200b/g,'').includes('交換先のサブ魂1'));row.querySelector('.inf-swap-b').click();}''')
    click('交換して宿す')
    assert page.evaluate('''()=>{const [a,b]=__game.G.party;const [oldA,oldB]=JSON.parse(swapBefore);return JSON.stringify(a.subs[0])===JSON.stringify(oldB[0])&&JSON.stringify(b.subs[0])===JSON.stringify(oldA[0]);}''')
    print('交換警告の表示・キャンセルで変更なし・確定後に両者の設定を交換 OK')
    # キャラを切り替えたメイン魂の候補にも、他の器・自分のサブ魂の宿主を出す。
    page.evaluate('''async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();__game.inf.openInfRest();}''')
    click('灯番')
    page.evaluate('''()=>{const card=document.querySelectorAll('.inf-vessel')[1];[...card.querySelectorAll('button')].find(e=>e.textContent.replace(/\\u200b/g,'').trim()==='魂を替える').click();}''')
    page.evaluate('''()=>{
      const rows=[...[...document.querySelectorAll('.ui-sheet')].at(-1).querySelectorAll('.inf-swap-row')];
      for(const home of ['交換元のサブ魂1','交換先のサブ魂1']){
        const row=rows.find(e=>e.textContent.replace(/\\u200b/g,'').includes(home));
        if(!row)throw Error('メイン魂の候補に宿主が無い:'+home);
        if(row.textContent.replace(/\\u200b/g,'').includes('宿していない'))throw Error('宿した魂が未使用扱い:'+home);
      }
    }''')
    print('別キャラのメイン魂・サブ魂の候補に宿主と枠を表示 OK')
    # 全魂を宿している場合、他の器から移せる魂を未使用の候補に数えない。
    def reopen_rest():
        page.evaluate("""async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();__game.inf.openInfRest();}""")
        page.wait_for_timeout(350)

    def alert_visible():
        return page.evaluate("""()=>[...document.querySelectorAll('.ui-sheet')].at(-1)?.textContent.replace(/\\u200b/g,'').includes('サブ魂に宿せる魂がある')||false""")

    reopen_rest()
    click('灯番')
    click('戻る')
    assert not alert_visible(), '全魂を宿しているのに灯番で警告が出た'
    click('まだ探索する')
    assert not alert_visible(), '全魂を宿しているのに風だまりで警告が出た'

    page.evaluate("""async()=>{const {SOUL_CLASSES}=await import('/src/souls.js');window.alertSoul=__game.inf.addSoulInstance(Object.keys(SOUL_CLASSES)[8],1,30).uid;}""")
    reopen_rest()
    click('灯番')
    click('戻る')
    assert alert_visible(), '未使用で宿せる魂があるのに警告が出ない'
    text=page.evaluate("""()=>[...document.querySelectorAll('.ui-sheet')].at(-1).textContent.replace(/\\u200b/g,'')""")
    assert '宿せる魂 1つ' in text and '宿せる魂 2つ' not in text, text
    click('サブ魂を選ぶ')
    page.evaluate("""()=>{if(!__game.inf.infSetSub(__game.G.party[2],0,alertSoul))throw Error('警告対象の魂を宿せない');}""")
    click('戻る')
    assert not alert_visible(), '未使用の魂を宿した後も警告が出た'
    reopen_rest()
    click('まだ探索する')
    assert not alert_visible(), '全魂を宿した後も風だまりで警告が出た'
    print('全魂使用中は警告なし・未使用の魂だけ候補に数える・宿した後は警告なし OK')
    assert not errors, errors
    browser.close()
