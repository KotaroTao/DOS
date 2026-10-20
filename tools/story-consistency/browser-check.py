"""物語の順序と図鑑・灯守の進行を実ブラウザで確認。127.0.0.1:8000 が必要。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [390, 1280]:
        page = browser.new_page(viewport={'width': width, 'height': 844}, service_workers='block')
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(content_type='text/css', body=''))
        page.goto('http://127.0.0.1:8000/?testDungeon=w42&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length === 6')
        print(width, page.evaluate('''async () => {
          const {game} = await import('/src/ui/ctx.js');
          const {sheet} = await import('/src/ui/kit.js');
          const {codexMonSheet} = await import('/src/ui/palace.js');
          const {enemyCodexComplete} = await import('/src/ui/itemview.js');
          const {soulRankOf} = await import('/src/souls.js');
          const {IRENE_BEATS} = await import('/src/story.js');
          const {archiveStories} = await import('/src/archive-stories.js');
          const G = game.G, w = game.worldState(), checks = [];
          const check = (v,t) => {if(!v)throw Error(t);checks.push(t);};
          const settle = () => new Promise(r=>setTimeout(r,100));
          const text = () => document.body.textContent.replace(/\u200b/g, '');
          sheet.closeAll(); G.prompt=false;
          for(const b of IRENE_BEATS.filter(b=>b.effect==='seraRank')) delete w.beats[b.id];
          delete w.beats.irene_sera_wake;
          G.codex.mon.bs_aurorawisp={kills:10,main:10};
          codexMonSheet('bs_aurorawisp');
          check(text().includes('語り手が目を覚ますと読める'), '未覚醒のセラの伝承は理由を表示して伏せる');
          check(!text().includes('氷窟の天井の光を、ずっと見ていました'), '未覚醒の体験談を画面へ出さない');
          check(!enemyCodexComplete({key:'bs_aurorawisp'}), '未開示の伝承を全開示と数えない');
          sheet.closeAll(); await settle();
          w.beats.irene_sera_wake=1;
          codexMonSheet('bs_aurorawisp');
          check(text().includes('氷窟の天井の光を、ずっと見ていました'), '覚醒すると保存済みの討伐記録から伝承が読める');
          check(enemyCodexComplete({key:'bs_aurorawisp'}), '覚醒後は伝承を全開示と数える');
          sheet.closeAll();
          const world=__game.world;
          G.souls=G.souls.filter(s=>s.clsKey!=='sera');
          const {setSharedSouls}=await import('/src/souls.js');setSharedSouls(G.souls);
          const soul=world.seraJoin();check(soulRankOf(soul)===1,'新しい灯守はランク1');
          let rank=1;
          for(const b of IRENE_BEATS.filter(b=>b.effect==='seraRank')) {
            w.beats[b.id]=1;world.syncSeraSoul();
            check(soulRankOf(soul)===++rank,b.id+' の語りで実際に一段上がる');
          }
          check(rank===5&&!world.syncSeraSoul(),'最初の人業まででランク5、再読で重複しない');
          delete w.found.w42_dawn;w.reported.w41=1;
          w.beats.irene_why=1;delete w.beats.irene_sera_wake;
          const before=JSON.stringify(w);
          check(!archiveStories(G).find(s=>s.id==='irene_why').lines.join('').includes('答えたのは、セラだった'), '読み返しでも未覚醒の発言を出さない');
          check(JSON.stringify(w)===before,'読み返しは物語の進行を書き換えない');
          return checks.join(' / ');
        }'''))
        assert not errors, errors
        page.close()
    browser.close()
