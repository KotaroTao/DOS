"""弟子の命名・保存・呼称を確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/')
    page.get_by_role('button', name='はじめから').click()
    dialog = page.get_by_role('dialog', name='弟子の名前', exact=True)
    field = dialog.get_by_role('textbox')
    dialog.get_by_role('button', name='旅を始める').click()
    assert dialog.get_by_role('alert').inner_text().replace('\u200b', '') == '名前を入力してください。'
    field.fill('あ' * 13)
    field.press('Enter')
    assert '12文字以内' in dialog.get_by_role('alert').inner_text().replace('\u200b', '')
    field.fill('  リュカ  ')
    # 日本語の変換確定では開始しない。
    field.dispatch_event('keydown', {'key':'Enter', 'isComposing':True})
    assert dialog.is_visible()
    field.press('Enter')
    page.wait_for_function('window.__game?.G.apprenticeName === "リュカ"')
    page.wait_for_function('localStorage.getItem("dos-save-v7")?.includes("リュカ")')
    page.reload()
    page.get_by_role('button', name='つづきから').wait_for()
    assert page.evaluate('__game.G.apprenticeName') == 'リュカ'
    before = page.evaluate('localStorage.getItem("dos-save-v7")')
    page.get_by_role('button', name='はじめから').click()
    dialog.get_by_role('textbox').fill('セイン')
    dialog.get_by_role('button', name='戻る').click()
    assert before == page.evaluate('localStorage.getItem("dos-save-v7")')
    page.get_by_role('button', name='はじめから').click()
    dialog.get_by_role('textbox').fill('セイン')
    dialog.get_by_role('button', name='旅を始める').click()
    page.get_by_role('button', name='やめる', exact=True).click()
    assert before == page.evaluate('localStorage.getItem("dos-save-v7")')
    page.get_by_role('button', name='はじめから').click()
    dialog.get_by_role('textbox').fill('セイン')
    dialog.get_by_role('button', name='旅を始める').click()
    page.get_by_role('button', name='消して始める').click()
    # 再起動後は音声解禁のため開始操作をもう一度行う。
    page.locator('.ttl-btns .ttl-btn.primary').click()
    page.wait_for_function('window.__game?.G.apprenticeName === "セイン"')
    page.wait_for_function('localStorage.getItem("dos-save-v7")?.includes("セイン")')
    page.reload()
    page.get_by_role('button', name='つづきから').click()
    page.wait_for_function('!document.querySelector(".ttl-wrap") || document.querySelector(".ttl-out")')
    result = page.evaluate('''async () => {
      const {UI, game} = await import('/src/ui/ctx.js');
      const {storyText,normalizeName} = await import('/src/protagonist.js');
      const {TUT_INTRO,STORY_CELLS,IRENE_BEATS,REPORTS} = await import('/src/story.js');
      const {greetingPages,playIreneScene} = await import('/src/ui/irene.js');
      const {refSerialize,refDeserialize} = await import('/src/savegraph.js');
      const g=__game.G, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      check(TUT_INTRO[0].includes('オルドの弟子')&&!TUT_INTRO[0].includes('{弟子名'), '王は名乗る前には名前を知らない');
      check(TUT_INTRO.map(t=>storyText(t,g)).join('').includes('セイン。師を捜すなら'), '名乗った後に王が名前で呼ぶ');
      const prison=Object.values(STORY_CELLS).flatMap(x=>typeof x.lines==='function'?[]:x.lines||[]).find(t=>t.includes('セラ「ちがう'));
      check(!prison.includes('{弟子名'), '牢のセラは名前を知らない');
      const wake=IRENE_BEATS.find(x=>x.id==='irene_sera_wake');
      const wakeLines=(typeof wake.lines==='function'?wake.lines({}):wake.lines).map(t=>storyText(t,g));
      check(wakeLines.join('').includes('セイン様。助けてくださって'), '館で名乗った後のセラは名前を呼ぶ');
      const minister=REPORTS.w13.lines({}).find(t=>t.startsWith('宰相モルデン「'));
      check(storyText(minister,g).includes('オルドの弟子殿')&&!minister.includes('{弟子名'), '初対面の宰相の呼称は維持');
      check(storyText('{弟子名:師}よ',g)==='セインよ','師の呼びかけ');
      check(storyText('{弟子名}よ。{弟子名:様}',{})==='オルドの弟子よ。お弟子さま','旧セーブの呼称');
      check(normalizeName('　\\n ') === '' && normalizeName('あ'.repeat(20)).length===12, '空白・長い名前の正規化');
      g.apprenticeName='<b>灯</b>';
      UI.playStoryChain([{who:'none',title:'呼称の確認',lines:['「{弟子名}よ」']}]);
      check(document.querySelector('.sc-lines').textContent.replaceAll('\\u200b','')==='「<b>灯</b>よ」','名前を文字として表示');
      check(!document.querySelector('.sc-lines b'),'名前をHTMLとして解釈しない');
      const snap=refDeserialize(JSON.parse(localStorage.getItem('dos-save-v7')));
      delete snap.apprenticeName; snap.msq.granted=true;
      sessionStorage.setItem('test-legacy-save',JSON.stringify(refSerialize(snap)));
      return out;
    }''')
    print('\n'.join(result))
    page.add_init_script("const legacy=sessionStorage.getItem('test-legacy-save');if(legacy){localStorage.setItem('dos-save-v7',legacy);sessionStorage.removeItem('test-legacy-save');}")
    page.reload()
    page.get_by_role('button', name='つづきから').wait_for()
    assert page.evaluate('__game.G.apprenticeName') == ''
    assert not errors, errors
    print('新規入力・IME・取消・再開・再作成・旧セーブ読込: OK')
    browser.close()
