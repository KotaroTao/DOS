"""回廊踏破で図鑑と見識を同時解放し、二報告で酒場を開く実画面の確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for width in [390, 1280]:
        context = browser.new_context(viewport={'width': width, 'height': 900}, service_workers='block', reduced_motion='reduce')
        context.route('https://**/*', lambda r: r.abort())
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost:8000/?testScene=prologue:abbey', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length===6')
        print(page.evaluate('''async () => {
          const {game,UI}=await import('/src/ui/ctx.js');
          const {sheet}=await import('/src/ui/kit.js');
          const {remember}=await import('/src/ui/prefs.js');
          const {unphrase}=await import('/src/ui/phrase.js');
          const {STORY_CELLS,UNLOCKS}=await import('/src/story.js');
          const {openSoulDetail}=await import('/src/ui/soulpanel.js');
          const {G,world:W,inf}=__game, checks=[];
          const check=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
          const text=()=>unphrase(document.body.innerText);
          const close=()=>sheet.closeAll();
          G.state='town';G.prompt=false;G.msq.prologue.phase='done';G.irene.greeted=true;
          G.tut={earlySoulVersion:1,done:{repairSoul:true,trainSoul:true,shopAppraise:true}};
          G.world={open:{w01:1,w02:1,w03:1},cleared:{w01:1},reported:{w01:1},found:{},beats:{},gates:{}};
          G.insightNotified=null;game.codexSweepJobs();game.codexSeeItem('shortSword');
          const recorded=JSON.stringify(G.codex), score=game.insightSummary().total;
          check(!game.featureUnlocked('codex')&&!game.featureUnlocked('insight'),'回廊踏破前は図鑑と見識が未解放');
          check(!game.featureUnlocked('tavern')&&!game.featureUnlocked('rumor'),'一報告では酒場と噂は未解放');
          remember('seg','palace','codex');UI.openPalace();
          check(!document.querySelector('.pl-codex')&&!text().includes('敵の図鑑'),'王宮は保存された図鑑区分からも未解放の一覧を開かない');
          check(UI.openPalace('codex:job')===false&&UI.openCodexSheet()===null,'王宮・手帳の直接呼出しも閉じる');
          check(UI.dungeonMonSheet(G.dungeonIdx)===null&&UI.codexJobSheet('fighter')===null&&UI.codexMonSheet('bs_drainrat')===null&&UI.codexItemSheet('shortSword')===null&&UI.codexEventSheet('c01')===null,'図鑑の各一覧・詳細からも先に入れない');
          openSoulDetail(G.party[0].primary);
          check(!text().includes('職業図鑑を見る'),'魂の詳細も図鑑への入口を伏せる');close();
          check(!!UI.codexItemSheet('shortSword',{item:inf.cloneItem('shortSword',50)}),'解放前も所持品の能力を確認できる');close();
          const enemy=__game.spawnCardEnemies('bs_drainrat',1,1)[0];
          check(!!UI.codexMonSheet('bs_drainrat',{enemy}),'戦闘中の相手の姿・状態は確認できる');close();
          G.state='board';G.dungeonIdx=__game.world.DUNGEONS.findIndex(d=>d.id==='w02');G.floor=1;__game.ev.newFloor();
          await new Promise(r=>setTimeout(r,150));
          if(innerWidth>=1000)check(!unphrase(document.getElementById('pc-explore-tools')?.textContent||'').includes('敵の図鑑'),'PCの探索メニューでも解放前は図鑑を伏せる');
          UI.openDungeonMenu();check(!text().includes('敵・品・見聞'),'未解放の手帳に図鑑の入口を置かない');close();
          // 開発用の全件表示は通常の解放や発見を変更しない。
          check(!!UI.openCodexSheet({all:true}),'試遊専用の全データは確認できる');close();
          check(!game.featureUnlocked('codex')&&JSON.stringify(G.codex)===recorded,'開発用図鑑で通常の解放と記録を変えない');
          W.commitDungeonClear(false);
          check(game.featureUnlocked('codex')&&game.featureUnlocked('insight'),'実際の回廊踏破処理で図鑑と見識を同時解放');
          check(!G.world.reported.w02&&game.insightSummary().total===score,'報告前から開き、解放前の発見をすべて評価');
          __game.ev.renderBoard();await new Promise(r=>setTimeout(r,150));
          if(innerWidth>=1000)check(unphrase(document.getElementById('pc-explore-tools')?.textContent||'').includes('敵の図鑑'),'PCの探索メニューは踏破後すぐに図鑑の入口を追加する');
          G.state='town';UI.openPalace('codex');
          check(!!document.querySelector('.pl-codex'),'解放後に王宮の図鑑を表示');
          check(!!UI.openCodexSheet()&&!!UI.codexJobSheet('fighter'),'手帳と職業の図鑑も利用可能');close();
          // 回廊報告の本番経路で、図鑑の説明と新しい酒場の説明の両方が出る。
          for(const [id,c] of Object.entries(STORY_CELLS))if(c.dungeon==='w02')G.world.found[id]=1;
          window.pagesSeen=[];
          UI.playStoryChain=(pages,done)=>{pagesSeen.push(...pages);for(const p of pages){p.enter?.();p.leave?.();}done?.();};
          UI.tutorialAfterReport=()=>false;
          W.reportMainQuest();
          check(game.featureUnlocked('tavern')&&game.featureUnlocked('rumor'),'第一章の二報告で酒場と情報屋の噂を同時解放');
          check(pagesSeen.some(p=>p.title===UNLOCKS.insight.title)&&pagesSeen.some(p=>p.title===UNLOCKS.tavern.title),'同じ回廊報告で図鑑の手引きと酒場の案内を両方表示');
          check(!game.featureUnlocked('fusion'),'二報告だけでは魂融合を先に解放しない');
          const guide=UNLOCKS.insight.lines.join('');
          check(['魔物・品・職業・見聞','王宮','手帳','新着','図鑑がどれほど充実','操霊師としての格','称号'].every(t=>guide.includes(t)),'図鑑の使い方を主に、見識が充実度と格を示すことを説明');
          close();return checks;
        }'''), flush=True)
        # cleared を持たない旧形式でも、回廊報告と発見記録を通常ロードで引き継ぐ。
        expected = page.evaluate("() => {__game.G.world.cleared={};localStorage.setItem('dos-save-v7',__game.inf.saveJSON());return JSON.stringify(Object.fromEntries(['mon','item','job'].map(k=>[k,__game.G.codex[k]])))}")
        page.goto('http://localhost:8000/', wait_until='domcontentloaded')
        page.wait_for_function('window.__game?.G.party.length===6')
        assert page.evaluate('async()=>{const {game}=await import("/src/ui/ctx.js");return game.featureUnlocked("codex")&&game.featureUnlocked("insight")&&game.featureUnlocked("tavern")}')
        assert page.evaluate("JSON.stringify(Object.fromEntries(['mon','item','job'].map(k=>[k,__game.G.codex[k]])))") == expected
        assert not errors, errors
        context.close()
        print(f'{width}px: 図鑑の解放・入口制限・記録保全・回廊報告と二報告の酒場解放 OK', flush=True)
    browser.close()
