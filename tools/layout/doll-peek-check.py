"""localhost:8000で「人業の様子」の正確な大きな数値と、スマホの枠内表示を確認する。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':664},has_touch=True,is_mobile=True,service_workers='block')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    page.goto('http://localhost:8000/?testDungeon=w02',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length===6')
    page.evaluate('''() => {
      __game.G.autoCombat=false;
      __game.startBattle(__game.spawnCardEnemies('bs_drainrat',1),null);
    }''')
    page.wait_for_function('__game.G.battle?.phase==="input"&&!__game.G.animating')
    page.evaluate('''async () => {
      const {SPELLS}=await import('/src/combat.js');
      window.peekD=__game.G.party[0];
      peekD.name='長い名前の人業ABCDEFGHIJKLMN';
      peekD.equip.weapon={...peekD.equip.weapon,name:'長い名前の武器ABCDEFGHIJKLMNOPQRSTUVWXYZ'};
      Object.assign(peekD,{atk:9876543210,vit:8765432109,int:7654321098,pie:6543210987,agi:5432109876,luk:4321098765});
      peekD.effects=[{stat:'atk',stage:2,mult:1.5,turns:3},{stat:'vit',stage:-1,mult:0.8,turns:2}];
      __game.G.battle._recalcBuffs(peekD);
      peekD.spells=Object.keys(SPELLS).filter(k=>SPELLS[k].kind!=='field').sort((a,b)=>SPELLS[b].name.length-SPELLS[a].name.length).slice(0,5);
      peekD.skillOff=[];peekD.resists.sleep=100;
      window.peekSnapshot=()=>JSON.stringify({hp:peekD.hp,mp:peekD.mp,stats:[peekD.atk,peekD.vit,peekD.agi,peekD.int,peekD.pie,peekD.luk],effects:peekD.effects,rng:__game.G.rng});
    }''')
    for width,height in [(320,480),(375,550),(390,664),(430,932),(600,760),(768,1024),(1280,900)]:
        page.set_viewport_size({'width':width,'height':height})
        for current,maximum in [(1234567,987654321),(123456789012345,987654321012345)]:
            page.evaluate('''async ([current,maximum])=>{
              peekD.hp=peekD.mp=current;peekD.maxhp=peekD.maxmp=maximum;peekD.atk=maximum;
              window.beforePeek=peekSnapshot();
              const {peekDoll}=await import('/src/ui/dungeonhud.js');
              peekDoll(peekD,{idx:0,combat:true});
            }''',[current,maximum])
            page.locator('.dg-peek').wait_for(state='visible')
            page.wait_for_timeout(250)
            page.evaluate('''([current,maximum])=>{
              const card=document.querySelector('.dg-peek'),body=card.querySelector('.ui-sheet-body');
              if(card.scrollWidth>card.clientWidth+1||body.scrollWidth>body.clientWidth+1)throw Error('人業の様子が横にはみ出す');
              for(const v of card.querySelectorAll('.dg-peek-bv'))
                if(v.innerText.replaceAll('\\u200b','').replaceAll('\\n','')!==`${current}/${maximum}`)throw Error('HP/MPの正確な値が失われた');
              if(!card.textContent.replaceAll('\\u200b','').includes('元の値'))throw Error('強化前の値がない');
              const columns=getComputedStyle(card.querySelector('.dg-stats')).gridTemplateColumns.split(' ').length;
              if(columns!==(innerWidth<=600?2:3))throw Error('戦力の列数');
              // 文字そのものの描画範囲を調べ、隠して見かけだけ収めた状態も見逃さない。
              for(const frame of card.querySelectorAll('.dg-stat,.dg-chip,.dg-peek-bar,.dg-peek-n,.dg-peek-c')) {
                const rect=frame.getBoundingClientRect();
                const walker=document.createTreeWalker(frame,NodeFilter.SHOW_TEXT);
                while(walker.nextNode()) {
                  const node=walker.currentNode;
                  if(!node.textContent.trim())continue;
                  const range=document.createRange();range.selectNodeContents(node);
                  for(const r of range.getClientRects())
                    if(r.left<rect.left-1||r.right>rect.right+1||r.top<rect.top-1||r.bottom>rect.bottom+1)
                      throw Error('文字が枠外: '+node.textContent);
                }
              }
              if(peekSnapshot()!==beforePeek)throw Error('詳細を開いて戦闘状態が変わる');
            }''',[current,maximum])
            if width==390 and current>10000000:
                page.screenshot(path='/tmp/dos-doll-peek-mobile-top.png')
                page.locator('.dg-peek .dg-stats').first.scroll_into_view_if_needed()
                page.screenshot(path='/tmp/dos-doll-peek-mobile-stats.png')
            page.locator('.dg-peek .ui-sheet-foot button').click()
            page.locator('.dg-peek').wait_for(state='detached')
            assert page.evaluate('peekSnapshot()===beforePeek')
        print(f'{width}x{height}: 正確なHP/MP・大きな戦力/能力・元の値・長い名前/技・枠内表示 OK',flush=True)
    assert not errors,errors
    browser.close()
