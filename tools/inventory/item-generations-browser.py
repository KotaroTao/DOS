"""装備の世代 (docs/item-generations.md) の実画面検査。localhost:8000 が必要。
   python3 tools/inventory/item-generations-browser.py
名前の添え字・絵の縁取りと数字・詳細の札・Lv不足の性能・商会の棚のそろい方 (合算・下の世代は金貨だけ)・
旧深度品の移し替え・保存の往復・深い迷宮での世代の抽選を確かめる。深部の上限の値は書かない。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w57&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    page.wait_for_timeout(1500)
    result = page.evaluate('''async () => {
      const {game, UI} = await import('/src/ui/ctx.js');
      const {sheet} = await import('/src/ui/kit.js');
      const {itemName, recalc, wearerGen, equipLevelOf} = await import('/src/items.js');
      const {spriteCanvas} = await import('/src/sprites.js');
      const {refDeserialize} = await import('/src/savegraph.js');
      sheet.closeAll();
      const G = __game.G, gen = __game.gen, inf = __game.inf;
      const check = (v, m) => { if (!v) throw Error(m); };
      G.insightNotified = 1e9;
      const make = (id, g) => { const it = inf.cloneItem(id, 50); if (g > 1) it.gen = g; gen.resyncItem(it); return it; };
      // 1. 名前・絵・札
      const g3 = make('shortSword', 3);
      check(itemName(g3).endsWith('（第3世代）'), '名前の添え字');
      const art = spriteCanvas(g3, 3);
      check(art.classList.contains('spr-gen') && art.querySelector('.spr-gen-n')?.textContent === '3', '縁取りと数字');
      const small = spriteCanvas(g3, 1);
      check(small.classList.contains('spr-gen') && !small.querySelector('.spr-gen-n'), '小さな絵は縁取りだけ');
      check(spriteCanvas(make('shortSword', 1), 3).tagName === 'CANVAS', '第1世代には何も出さない');
      // 2. 装備する人の Lv
      const sw = make('shortSword', 3);
      const d = G.party[0];
      const keepLv = d.jobLv, keepW = d.equip.weapon;
      d.equip.weapon = sw;
      d.jobLv = equipLevelOf(sw, 3); recalc(d); const atkFull = d.atk;
      d.jobLv = equipLevelOf(sw, 2); recalc(d); const atk2 = d.atk;
      check(wearerGen(d, sw) === 2 && atk2 < atkFull, 'Lv不足で下の世代の性能');
      UI.itemSheet(sw, { owner: d, target: d });
      await new Promise(r => setTimeout(r, 300));
      const detailText = document.body.innerText.replace(/\u200b/g, '');
      check(detailText.includes('第3世代'), '詳細の世代の札');
      check(detailText.includes('Lv不足のため第2世代の性能'), 'Lv不足の説明');
      sheet.closeAll();
      d.equip.weapon = keepW; d.jobLv = keepLv; recalc(d);
      // 3. 値段は本来の世代
      const p1 = gen.sellPrice(make('shortSword', 1)), p2 = gen.sellPrice(make('shortSword', 2)), p3 = gen.sellPrice(make('shortSword', 3));
      check(p1 < p2 && p2 < p3, '上の世代ほど高い');
      check(gen.buyPrice(make('shortSword', 2)) === 2 * p2, '買値は売値の2倍');
      check(gen.reforgeCost(make('shortSword', 3)) > gen.reforgeCost(make('shortSword', 1)), '鍛え直しの費用');
      // 4. 商会の棚: 上の世代でそろう (数は合算)・下の世代は金貨だけ
      G.shopStock = {shortSword: 10}; G.shopGen = {}; G.shopAfx = {}; G.shopAfxPending = [];
      check(gen.shopStockAdd('shortSword', 2) && G.shopStock.shortSword === 11 && gen.shopGenOf('shortSword') === 2, '上の世代で合算してそろう');
      check(!gen.shopStockAdd('shortSword', 1) && G.shopStock.shortSword === 11 && gen.shopGenOf('shortSword') === 2, '下の世代は棚に加えない');
      const gold0 = G.gold;
      const low = make('shortSword', 1); G.inventory.push(low);
      check(gen.sellItem(G.party[0], low, gen.sellPrice(low), null, true), '下の世代の売却');
      check(G.gold === gold0 + p1 && G.shopStock.shortSword === 11, '金貨だけ払う');
      check(gen.shopShelfItem('shortSword').gen === 2, '棚の見本は棚の世代');
      G.gold = 1e9;
      const bought = gen.buyItem('shortSword', 0, G.party[0]);
      check(bought && bought.gen === 2 && bought.q === 50 && G.shopStock.shortSword === 10, '棚の世代の並品が届く');
      check(Object.keys(G.shopStock).length === 1, '棚の行は種類の数のまま');
      // 5. 旧深度品と旧棚の移し替え (一度だけ)
      const old = inf.cloneItem('shortSword', 50); delete old.gen; old.depth = 400;
      G.inventory.push(old);
      gen.reflattenItemStats();
      const g0 = old.gen;
      check(g0 >= 2 && old.depth === 400, '深度品は世代へ (記録の深度は残す)');
      gen.reflattenItemStats();
      check(old.gen === g0, '二重に移さない');
      G.shopStock.dagger = 3; gen.migrateShopGen({shopAfxDepth: {dagger: 500}});
      check(gen.shopGenOf('dagger') >= 2 && !('shopAfxDepth' in G), '旧棚の深度も世代へ');
      // 6. 保存の往復
      const snap = refDeserialize(JSON.parse(inf.saveJSON()));
      check(snap.shopGen.shortSword === 2 && snap.inventory.some(x => x.gen === g0), '保存に残る');
      // 7. 深い迷宮の抽選: 出現上限が通しR21以上なら、ランクの低い品は第2世代
      G.state = 'board'; G.floor = 15;
      const cap = gen.lootCapR();
      let gens = new Set();
      for (let i = 0; i < 300; i++) { const id = inf.pickLoot(); const it = inf.cloneItem(id); if (!it || !it.slot || it.slot === 'use' || it.slot === 'misc') continue; inf.markDungeonLoot(it); gens.add(it.gen || 1); }
      G.state = 'town';
      check(cap > 20 ? gens.has(2) : !gens.has(2), '深い迷宮で第2世代が出る');
      G.inventory.splice(G.inventory.indexOf(old), 1);
      if (bought) G.inventory.splice(G.inventory.indexOf(bought), 1);
      return {cap, gens: [...gens].sort()};
    }''')
    print('装備の世代 (実画面):', result, '名前・縁取り・札・Lv不足・値段・棚の合算と下の世代・移し替え・保存・深い迷宮の抽選 OK')
    assert not errors, errors
    browser.close()
