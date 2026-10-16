"""取り逃した手がかり・複数配置・短縮前後の通常セーブ再開と踏破を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(service_workers='block', reduced_motion='reduce')
    context.route('https://**/*', lambda route: route.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000/?testScene=prologue:corridor', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 5')
    print(page.evaluate('''async () => {
      const {G,ev,world:W}=__game;
      const {UI}=await import('/src/ui/ctx.js');
      const {STORY_CELLS,REPORTS}=await import('/src/story.js');
      const checks=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
      // 短縮した4迷宮に限らず、全台帳の配置・報告条件も照合する。
      for(const [key,def] of Object.entries(STORY_CELLS)) {
        const cfg=W.DUNGEONS.find(d=>d.id===def.dungeon);
        check(cfg && def.floor>=1 && def.floor<=cfg.floors,key+'の配置は到達可能');
      }
      for(const [id,rep] of Object.entries(REPORTS))if(rep.need)
        check(STORY_CELLS[rep.need]?.dungeon===id,id+'の報告条件と配置先が一致');
      G.world.found={}; G.world.reported={w01:1};G.world.cleared={w01:1};G.world.report=null;
      ev.enterDungeon(null,1);
      const story=()=>G.board.cells.flat().filter(c=>c.type==='story'&&!c.cleared);
      G.floor=2;ev.newFloor();check(!story().length,'B2Fには先の手がかりを出さない');
      G.floor=3;ev.newFloor();check(story().some(c=>c.storyKey==='w02_sigil'),'B3Fに壁の印');
      G.floor=4;ev.newFloor();check(story().some(c=>c.storyKey==='w02_sigil'),'取り逃した印をB4Fにも配置');
      G.floor=5;ev.newFloor();
      check(story().length===2,'B5Fに壁の印と壊れた人業を同時配置');
      const before=JSON.stringify(G.board),rng=JSON.stringify(G.rng);
      W.storyNewFloor();
      check(JSON.stringify(G.board)===before&&JSON.stringify(G.rng)===rng,'配置済みの再開は盤面・乱数を維持');
      // 主のいない迷宮の踏破口からの補完も確かめる。
      for(const cell of story()) {cell.type='empty';delete cell.storyKey;}
      W.clearDungeonNoBoss();check(!G.world.cleared.w02&&story().length===2,'踏破直前にも未配置の手がかりを補完');
      UI.playStoryChain=(pages,done)=>done?.();
      W.runStoryCell(story().find(c=>c.storyKey==='w02_broken_doll'));
      check(W.reportMissingClue('w02')===STORY_CELLS.w02_sigil,'人業取得後も壁の印を案内');
      W.runStoryCell(story().find(c=>c.storyKey==='w02_sigil'));
      check(!W.reportMissingClue('w02')&&G.world.found.w02_sigil,'印の発見で報告条件を満たす');
      W.storyNewFloor();check(!story().length,'取得済みの手がかりは再配置しない');
      W.clearDungeonNoBoss();check(G.world.cleared.w02===1&&G.run.secured,'両方を読んだ後に踏破・戦利品を確保');
      // 序章を終えた後の再出撃でも、発見済み・序章専用の人業は出さない。
      G.state='town';G.prompt=false;G.msq.prologue.phase='done';
      delete G.world.found.w02_sigil;
      ev.enterDungeon(null,1);G.floor=5;ev.newFloor();
      check(story().length===1&&story()[0].storyKey==='w02_sigil','序章の後も未発見の印だけを補完');
      W.runStoryCell(story()[0]);check(G.world.open.w04,'序章の後に印を発見すると取水口を解放');
      return checks.slice(-12);
    }'''), flush=True)
    # 実際のロード経路を通す。旧10階版と現在5階版、どちらのB5Fも救済する。
    for legacy in [False, True]:
        page.goto('http://localhost:8000/?testScene=prologue:corridor', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length === 5')
        page.evaluate('''legacy=>{
          const {G,ev,inf}=__game;
          G.world.found={};G.world.reported={w01:1};G.world.cleared={w01:1};G.world.report=null;
          ev.enterDungeon(null,1);G.floor=5;ev.newFloor();
          for(const c of G.board.cells.flat())if(c.type==='story'){c.type='empty';delete c.storyKey;}
          if(legacy)delete G.run.earlyLayout;
          localStorage.setItem('dos-save-v7',inf.saveJSON());
        }''', legacy)
        page.goto('http://localhost:8000/', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.state === "board"')
        page.get_by_role('button', name='つづきから', exact=False).click()
        page.wait_for_function('__game.G.board.cells.flat().some(c=>c.storyKey === "w02_sigil")')
        assert page.evaluate('__game.activeCfg().floors') == (10 if legacy else 5)
        assert page.evaluate('__game.G.board.cells.flat().filter(c=>c.type==="story").length') == (1 if legacy else 2)
        print(('旧10階版' if legacy else '現5階版') + ': B5Fの通常セーブを再開して取り逃した印を回収可能', flush=True)
    assert not errors, errors
    browser.close()
