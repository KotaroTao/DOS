// 実ブラウザで2001〜2100の描画・伏せ絵・失敗時の代替表示を確かめる。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const mode of (process.argv.length > 2 ? process.argv.slice(2) : ['normal', 'error', 'wrong-size', 'timeout'])) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
      if (mode === 'error') await page.route('**/art/items/*.webp', r => r.abort());
      if (mode === 'wrong-size') await page.route('**/art/items/*.webp', r => r.fulfill({
        contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      }));
      if (mode === 'timeout') await page.route('**/art/items/*.webp', async r => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await r.abort().catch(() => {});
      });
      await page.goto('http://localhost:8000/?testDungeon=w01&testFloor=1');
      await page.waitForFunction(() => window.__game?.G.state === 'board', { timeout: 30000 });
      if (mode === 'normal') {
        await page.setViewportSize({ width: 390, height: 844 });
        for (const id of ['w_r17_artifactblade', 'a_r18_astralrobe', 's_r18_astralcrystal', 'r_r18_cosmosring']) {
          await page.evaluate(async id => {
            const { sheet } = await import('/src/ui/kit.js');
            sheet.closeAll();
            window.__game.UI.codexItemSheet(id);
          }, id);
          await page.waitForTimeout(200);
          const canvas = page.locator('.wpc-isheet canvas').first();
          assert(await canvas.isVisible(), id + ': 図鑑の絵が見えない');
          assert(await canvas.evaluate(c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v)), id + ': 図鑑の絵が空');
          await page.screenshot({ path: `docs/art/items-2001-2100/codex-${id}.png` });
        }
        await page.evaluate(async () => (await import('/src/ui/kit.js')).sheet.closeAll());
        await page.setViewportSize({ width: 1100, height: 900 });
      }
      const result = await page.evaluate(async mode => {
        const { ITEMS } = await import('/src/items.js');
        const { CATALOG_ITEMS } = await import('/src/catalog/index.js');
        const { ITEM_PHOTOS, itemPhoto } = await import('/src/itemphotos.js');
        const { makeItemSpriteResolver, ART_SLOTS, unidIcon } = await import('/src/itemart/index.js');
        const { setSpriteResolver, spriteCanvas, whenPhoto } = await import('/src/sprites.js');
        const items = { ...ITEMS, ...CATALOG_ITEMS };
        const { NUMBERED_ITEM_IDS } = await import('/src/itemnumbers.js');
        if (JSON.stringify(ITEM_PHOTOS.filter(id => items[id].number >= 2001 && items[id].number <= 2100)) !== JSON.stringify(NUMBERED_ITEM_IDS.slice(2000, 2100))) throw Error('原画の登録範囲');
        const resolve = makeItemSpriteResolver(items);
        setSpriteResolver(resolve);
        document.body.replaceChildren();
        Object.assign(document.documentElement.style, { height: 'auto', overflow: 'visible' });
        Object.assign(document.body.style, { height: 'auto', maxHeight: 'none', overflow: 'visible', background: '#19191f', color: '#ddd', display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: '8px' });
        let count = 0, hidden = 0;
        for (const id of ITEM_PHOTOS.filter(id => items[id].number >= 2001 && items[id].number <= 2100)) {
          const item = items[id], sprite = resolve({ ...item });
          if (!!itemPhoto(id) !== (mode === 'normal')) throw Error(id + ': 読み込み結果');
          if (mode === 'normal') {
            if (!sprite?.photo) throw Error(id + ': 原画が選ばれていない');
            await new Promise(resolve => whenPhoto(sprite, resolve));
            count++;
          }
          if (ART_SLOTS.has(item.slot)) {
            const unknown = resolve({ ...item, unidentified: true });
            if (unknown.photo || JSON.stringify(unknown) !== JSON.stringify(unidIcon(item))) throw Error(id + ': 未鑑定の姿が漏れている');
            hidden++;
          }
          const canvas = spriteCanvas({ ...item }, 4, 24);
          const card = document.createElement('div');
          card.append(canvas, document.createElement('br'), `${item.number} ${item.name}`);
          document.body.append(card);
        }
        for (const item of Object.values(items).filter(i => !ITEM_PHOTOS.includes(i.id) && ART_SLOTS.has(i.slot))) {
          if (resolve(item)?.photo) throw Error(item.id + ': 対象外の絵が変更された');
        }
        await new Promise(resolve => setTimeout(resolve, 150));
        for (const canvas of document.querySelectorAll('canvas')) {
          if (!canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v)) throw Error('空の画像');
        }
        return { count, hidden, canvases: document.querySelectorAll('canvas').length };
      }, mode);
      assert.equal(result.count, mode === 'normal' ? 100 : 0);
      assert.equal(result.hidden, 100);
      assert.equal(result.canvases, 100);
      if (mode === 'normal') await page.screenshot({ path: 'docs/art/items-2001-2100/game-preview.png', fullPage: true });
      console.log(mode, result);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
