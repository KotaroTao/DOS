"""回収人の一括売却を実ブラウザで検証する。先にルートで HTTP サーバーを8000番で起動。"""
import re
from playwright.sync_api import sync_playwright

# 文節の折り返し用ゼロ幅スペースを除いてボタン名を照合する。
def label_re(text):
    return re.compile("\u200b?".join(re.escape(c) for c in text))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testInf=5&testInfLv=6')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async () => {
      const {game} = await import('/src/ui/ctx.js');
      const {ITEMS} = await import('/src/items.js');
      const g = game.G, out = [];
      const check = (ok, msg) => { if (!ok) throw Error(msg); out.push(msg); };
      const reset = () => { g.inventory.length = 0; g.shopAfx = {}; g.shopAfxPending = []; g.shopStock = {}; g.gold = 0; };
      const item = (v, id = 'dagger') => { const it = game.cloneItem(id); if (v != null) it.afx = [{k:'A03',v}]; g.inventory.push(it); return it; };
      const state = () => JSON.stringify([g.gold,g.inventory,g.shopStock,g.shopAfx,g.shopAfxPending,game.infStats(),g.abyss.trk]);
      for (const shelf of [null, 2, 9]) for (const chosen of [null, 0, 1, 2]) {
        reset(); if (shelf != null) { g.shopAfx.dagger = [{k:'A03',v:shelf}]; g.shopStock.dagger = 1; }
        const a = item(3), b = item(7), c = item(1), plan = game.infSellPlan(), conflict = plan.conflicts[0];
        const pick = chosen ?? conflict.best, wanted = conflict.sets[pick].afx;
        const trades = game.infStats().trades, sold = game.infStats().sold, runSold = g.abyss.trk.sold || 0;
        check(game.infSellAll(plan, chosen == null ? {} : {dagger:pick}), `売却: 棚${shelf}・選択${chosen}`);
        check(g.gold === plan.gold && !g.inventory.length && g.shopStock.dagger === (shelf == null ? 3 : 4), '金貨・袋・在庫が一致');
        check(JSON.stringify(g.shopAfx.dagger) === JSON.stringify(wanted) && !g.shopAfxPending.length, '選んだ能力だけを棚へ反映');
        check(game.infStats().trades === trades+3 && game.infStats().sold === sold+3 && g.abyss.trk.sold === runSold+3, '実績を点数分だけ加算');
        const after = state(); check(!game.infSellAll(plan) && state() === after, '二重実行で変更しない');
      }
      reset(); g.shopAfx.dagger = [{k:'A03',v:3}]; item(3);
      check(game.infSellPlan().conflicts[0].best === 0, '同点は棚を優先');
      reset(); g.shopAfx.dagger = []; item(5);
      check(game.infSellAll(game.infSellPlan()) && g.shopAfx.dagger[0]?.v === 5 && !g.shopAfxPending.length, '空の追加能力は空の棚として受け入れる');
      for (const change of [it=>it.afx[0].v=99, it=>it.q++, it=>it.locked=true,
        it=>it.cursed=true, it=>it.unidentified=true, it=>g.shopAfx.dagger=[{k:'A03',v:9}],
        it=>g.inventory.splice(0,1), it=>item(2), it=>g.party[1].equip.weapon=it]) {
        reset(); const it = item(1), plan = game.infSellPlan(); change(it); const before = state();
        check(!game.infSellAll(plan) && state() === before, '確認後の変更は全点売らずに中止');
        if (g.party[1].equip.weapon === it) g.party[1].equip.weapon = null;
      }
      reset(); item(1); item(2); const plan = game.infSellPlan();
      for (const index of [-1, 9, 0.5, 'map']) { const before=state(); check(!game.infSellAll(plan,{dagger:index}) && state()===before,'不正な選択で変更しない'); }
      reset(); const good=item(1), locked=item(1), cursed=item(1), hidden=item(1), worn=item(1);
      locked.locked=true; cursed.cursed=true; hidden.unidentified=true; g.party[1].equip.weapon=worn;
      const lr = item(null, Object.keys(ITEMS).find(id=>ITEMS[id].rar==='lr'));
      const use = item(null, Object.keys(ITEMS).find(id=>ITEMS[id].slot==='use'));
      const misc = item(null, Object.keys(ITEMS).find(id=>ITEMS[id].slot==='misc'&&game.bulkSellBlocked(ITEMS[id])));
      const filtered = game.infSellPlan(); check(filtered.list.length===1&&filtered.list[0].item===good,'装備中・ロック・呪い・未鑑定・LR・道具・未奉納品を除外');
      check(game.infSellAll(filtered)&&g.inventory.length===7,'保護対象を袋に残す'); g.party[1].equip.weapon=null;
      reset(); item(1); const away=game.infSellPlan();g.floor=6;const before=state();
      check(!game.infSellAll(away)&&state()===before,'風だまり以外では売らない');g.floor=5;
      // 保存用データにも売却後の棚・袋・実績が入る。
      reset(); item(4);game.infSellAll(game.infSellPlan());
      const {refDeserialize}=await import('/src/savegraph.js');const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(saved.inventory.length===0&&saved.shopAfx.dagger[0].v===4&&saved.stats.inf.sold===game.infStats().sold,'保存データへ反映');
      window.bulkTest = {reset,item,state};
      return [...new Set(out)];
    }'''))

    def prepare(many=False):
        page.evaluate('''async many => {
          const {game}=await import('/src/ui/ctx.js');const {sheet}=await import('/src/ui/kit.js');const {ITEMS}=await import('/src/items.js');
          sheet.closeAll();game.G.prompt=false;bulkTest.reset();
          const ids=many?Object.keys(ITEMS).filter(id=>ITEMS[id].slot==='weapon'&&ITEMS[id].rar==='c'&&!ITEMS[id].cursed).slice(0,12):['dagger'];
          for(const id of ids){bulkTest.item(many?1:null,id);if(many)game.G.shopAfx[id]=[{k:'A03',v:2}];}
          __game.inf.openInfRest();
        }''', many)
        page.wait_for_function("!document.querySelector('.ui-sheet-wrap.closing')")
        page.get_by_role('button', name=label_re('回収人'), exact=False).click()
        page.get_by_role('button', name=label_re('売る'), exact=True).click()
        page.get_by_role('button', name=label_re('一括売却'), exact=False).click()

    prepare()
    before = page.evaluate('bulkTest.state()')
    page.get_by_role('button', name=label_re('売らずに戻る'), exact=True).click()
    assert page.evaluate('bulkTest.state()') == before
    prepare()
    page.get_by_role('button', name=label_re('点を'), exact=False).click()
    page.wait_for_function('__game.G.inventory.length===0')
    page.wait_for_function("!document.querySelector('.ui-sheet-wrap.closing')")
    assert page.get_by_role('button', name=label_re('一括売却'), exact=False).is_disabled()
    prepare(True)
    before = page.evaluate('bulkTest.state()')
    assert page.locator('.ui-sheet-wrap').last.locator('.inf-afx-opt').count() == 0
    page.get_by_role('button', name=label_re('商会に残す能力を変更')).click()
    assert page.evaluate('bulkTest.state()') == before
    assert page.evaluate('''() => {
      const body=document.querySelector('.ui-sheet-wrap:last-child .ui-sheet-body');
      const btn=body.querySelectorAll('.inf-afx-opt')[15];btn.scrollIntoView();btn.focus();
      const top=body.scrollTop;btn.click();
      return btn.isConnected&&document.activeElement===btn&&body.scrollTop===top&&btn.getAttribute('aria-pressed')==='true';
    }''')
    page.get_by_role('button', name=label_re('この選択を使う')).click()
    assert page.evaluate('bulkTest.state()') == before
    page.wait_for_function("!document.querySelector('.ui-sheet-wrap.closing')")
    assert page.locator('.ui-sheet-wrap').last.get_by_text(label_re('自分で'), exact=False).count() == 1
    page.get_by_role('button', name=label_re('点を'), exact=False).click()
    page.wait_for_function('__game.G.inventory.length===0')
    assert page.evaluate('Object.values(__game.G.shopAfx).filter(a=>a[0].v===1).length') == 1
    prepare(True)
    before = page.evaluate('bulkTest.state()')
    page.get_by_role('button', name=label_re('商会に残す能力を変更')).click()
    page.locator('.ui-sheet-wrap').last.locator('.inf-afx-opt').nth(1).click()
    page.get_by_role('button', name=label_re('変更せず戻る')).click()
    assert page.evaluate('bulkTest.state()') == before
    page.wait_for_function("!document.querySelector('.ui-sheet-wrap.closing')")
    page.get_by_role('button', name=label_re('点を'), exact=False).click()
    page.wait_for_function('__game.G.inventory.length===0')
    assert page.evaluate('Object.values(__game.G.shopAfx).every(a=>a[0].v===2)')
    for width,height in [(320,740),(390,844),(844,390),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        prepare(True)
        for editor in [False, True]:
            if editor:
                page.get_by_role('button', name=label_re('商会に残す能力を変更')).click()
            page.wait_for_function("!document.querySelector('.ui-sheet-wrap:last-child .ui-sheet').getAnimations().some(a=>a.playState==='running')")
            layout = page.evaluate('''() => {
              const card=document.querySelector('.ui-sheet-wrap:last-child .ui-sheet');
              const foot=card.querySelector('.ui-sheet-foot').getBoundingClientRect();
              const body=card.querySelector('.ui-sheet-body');
              return {bottom:foot.bottom,top:foot.top,height:innerHeight,body:body.clientHeight,overflow:card.scrollWidth-card.clientWidth};
            }''')
            assert layout['bottom']<=height+1 and layout['top']>=0 and layout['body']>0 and layout['overflow']<=1, (width,height,layout)
            if width == 390:
                page.screenshot(path='/tmp/inf-bulk-editor.png' if editor else '/tmp/inf-bulk-confirm.png')
    # 戻る操作でも選択途中の変更を反映せず、売却しない。
    before = page.evaluate('bulkTest.state()')
    page.locator('.ui-sheet-wrap').last.locator('.inf-afx-opt').nth(1).click()
    page.evaluate("async()=>{const {sheet}=await import('/src/ui/kit.js');sheet.top().back();}")
    page.wait_for_function("!document.querySelector('.ui-sheet-wrap.closing')")
    assert page.evaluate('bulkTest.state()') == before
    page.get_by_role('button', name=label_re('商会に残す能力を変更')).click()
    assert page.locator('.ui-sheet-wrap').last.locator('.inf-afx-opt').nth(0).get_attribute('aria-pressed') == 'true'
    assert not errors, errors
    print('画面操作: キャンセル・通常売却・手動選択・自動選択・フォーカス維持・残数更新・4画面サイズ OK')
    browser.close()
