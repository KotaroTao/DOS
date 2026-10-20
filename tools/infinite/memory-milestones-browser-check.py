"""節目の自動記録・既存記録の選択・未記録での進行確認を実画面で検証。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w46&testPlace=town&testUnlock=infinite')
    page.wait_for_function('window.__game?.G.party.length > 0')

    def click(label):
        page.evaluate('''label => {
          const top=[...document.querySelectorAll('.ui-sheet-wrap')].at(-1);
          const b=[...top.querySelectorAll('button')].find(b=>b.textContent.replace(/\\u200b/g,'').trim().startsWith(label));
          if(!b)throw Error('ボタンが無い: '+label);b.click();
        }''', label)
        page.wait_for_timeout(400)

    page.evaluate('''async () => {
      const {game,UI}=await import('/src/ui/ctx.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {soulByUid}=await import('/src/souls.js');
      sheet.closeAll();const G=__game.G,inf=__game.inf;
      if(!inf.enterAbyss(['fighter','knight','thief','priest','mage','hunter']))throw Error('出撃');
      window.milestone={game,UI,sheet,soulByUid,proceeded:0};
      window.restAt=(floor,dead=false,pending=false)=>{
        sheet.closeAll();G.floor=floor;G.abyss.depth=floor;inf.newFloor();
        G.abyss.guardFloor=pending?0:floor;G.party[0].alive=!dead;
        UI.openInfRest({floor,guardDown:!pending,onContinue:()=>milestone.proceeded++});
      };
      restAt(45);
      if(game.infMemories().length)throw Error('節目以外で記録');
      restAt(50,false,true);
      if(game.infMemoryAt(50))throw Error('主を討つ前に自動記録');
      restAt(50);
      if(!game.infMemoryAt(50))throw Error('50階で自動記録されない');
      milestone.first=JSON.stringify(game.infMemoryAt(50));
    }''')
    assert page.locator('.inf-memory-comparison').count() == 0
    click('続ける')
    assert page.evaluate('milestone.proceeded === 1'), '保存内容と同じ隊なら確認なしで進める'

    # 既存記録を自動比較し、保存しない選択から進もうとすると確認する。
    page.evaluate('''() => {
      milestone.soulByUid(__game.G.party[0].primary).level=2;restAt(50);
    }''')
    assert page.locator('.inf-memory-comparison.show-all .inf-memory-member').count() == 6
    assert page.locator('.inf-memory-row.same').first.is_visible(), '全項目を最初から表示'
    click('以前の記憶を残す')
    assert page.evaluate('JSON.stringify(milestone.game.infMemoryAt(50)) === milestone.first')
    click('続ける')
    assert page.evaluate('milestone.proceeded === 1')
    click('隊の記憶を確認する')
    assert page.locator('.inf-memory-comparison').count() == 1
    click('以前の記憶を残す')
    click('続ける')
    click('記憶せずに進む')
    assert page.evaluate('milestone.proceeded === 2')
    assert page.evaluate('JSON.stringify(milestone.game.infMemoryAt(50)) === milestone.first')

    # 上書きすると確認は消え、保存後の設定変更は再び知らせる。
    page.evaluate('restAt(50)')
    click('この状態で上書きする')
    assert page.evaluate('milestone.game.infMemoryAt(50).souls[0].level === 2')
    click('続ける')
    assert page.evaluate('milestone.proceeded === 3')
    page.evaluate('restAt(50)')
    click('以前の記憶を残す')
    page.evaluate("__game.G.party[0].tactic='life'")
    click('続ける')
    click('隊の記憶を確認する')
    click('この状態で上書きする')
    click('続ける')
    assert page.evaluate('milestone.proceeded === 4')

    # 保存不可なら確認から戻れる。蘇生して子画面から戻ると自動記録。
    page.evaluate('restAt(100,true)')
    assert page.evaluate('!milestone.game.infMemoryAt(100)')
    click('続ける')
    click('風だまりに戻る')
    assert page.evaluate('milestone.proceeded === 4')
    click('灯番')
    page.evaluate('__game.G.party[0].alive=true')
    click('戻る')
    assert page.evaluate('!!milestone.game.infMemoryAt(100) && !!milestone.game.infMemoryAt(50)')
    page.evaluate('restAt(150)')
    assert page.evaluate('!!milestone.game.infMemoryAt(150)')
    assert not errors, errors
    print('45/50/100/150階・自動記録・全6人比較・以前を保持・上書き・未保存の確認/取消/進行・蘇生後の自動記録 OK')
    browser.close()
