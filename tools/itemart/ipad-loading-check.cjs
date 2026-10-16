// localhost:8000 で、遅い通信・同時取得数・失敗後の再取得・未鑑定の伏せ絵を確かめる。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const mode of ['normal', 'slow', 'error', 'wrong-size']) {
      const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      let active = 0, peak = 0, requests = 0, recover = false;
      await page.route('**/art/items/*.webp', async route => {
        requests++; active++; peak = Math.max(peak, active);
        try {
          if (mode === 'slow') await new Promise(r => setTimeout(r, 4500));
          if (mode === 'error' && !recover) await route.abort();
          else if (mode === 'wrong-size') await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
          else await route.continue();
        } finally { active--; }
      });
      // ゲームの起動を伴わず、共通の実描画口を使う。
      await page.goto('http://localhost:8000/manifest.json');
      await page.evaluate(async () => {
        const { ITEMS } = await import('/src/items.js');
        const { CATALOG_ITEMS } = await import('/src/catalog/index.js');
        const { ITEM_PHOTOS } = await import('/src/itemphotos.js');
        const { makeItemSpriteResolver, unidIcon } = await import('/src/itemart/index.js');
        const { setSpriteResolver, spriteCanvas, crispCanvas, whenPhoto, photoReady } = await import('/src/sprites.js');
        const items = { ...ITEMS, ...CATALOG_ITEMS };
        const resolve = makeItemSpriteResolver(items);
        setSpriteResolver(resolve);
        const ids = [...ITEM_PHOTOS.slice(0, 7),
          ...['misc', 'use'].map(slot => ITEM_PHOTOS.find(id => items[id].slot === slot))];
        const hidden = resolve({ ...items[ids[0]], unidentified: true });
        if (hidden !== unidIcon(items[ids[0]])) throw Error('未鑑定の姿が漏れた');
        window.check = { ids, items, resolve, spriteCanvas, whenPhoto, photoReady, crispCanvas };
      });
      assert.equal(requests, 0, '未表示・未鑑定の画像を取得した');
      const before = await page.evaluate(() => {
        const { ids, items, resolve, spriteCanvas, crispCanvas } = window.check;
        window.check.sprites = ids.map(id => resolve(items[id]));
        window.check.canvases = [...ids.map(id => spriteCanvas(items[id], 4, 24)), crispCanvas(items[ids[0]], 64)];
        document.body.replaceChildren(...window.check.canvases);
        return window.check.canvases.map(c => {
          if (!c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v)) throw Error('代替画像が空');
          return c.toDataURL();
        });
      });
      const result = await page.evaluate(async () => {
        const { sprites, canvases, whenPhoto, photoReady } = window.check;
        const loaded = await Promise.all(sprites.map(s => s.photo.ready));
        await Promise.all(sprites.map((s, i) => loaded[i] ? new Promise(r => whenPhoto(s, r)) : null));
        return { loaded, ready: sprites.map(s => photoReady(s.photo)), images: canvases.map(c => c.toDataURL()) };
      });
      assert.equal(requests, 9, '表示した9品以外も読み込んだ');
      assert(peak <= 6, '同時取得が6枚を超えた');
      assert.deepEqual(result.loaded, Array(9).fill(['normal', 'slow'].includes(mode)));
      assert.deepEqual(result.ready, Array(9).fill(['normal', 'slow'].includes(mode)));
      result.images.forEach((v, i) => ['normal', 'slow'].includes(mode) ? assert.notEqual(v, before[i], '届いた画像が反映されない') : assert.equal(v, before[i], '失敗時の代替絵が消えた'));
      if (mode === 'error') {
        recover = true;
        await page.evaluate(async () => {
          const { ids, items, resolve, whenPhoto } = window.check;
          const now = Date.now;
          Date.now = () => now() + 31000;
          try {
            const spr = resolve(items[ids[0]]);
            if (!spr.photo || !(await spr.photo.ready)) throw Error('再取得できない');
            await new Promise(r => whenPhoto(spr, r));
          } finally { Date.now = now; }
        });
      }
      assert.deepEqual(errors, []);
      console.log(mode, { requests, peak, loaded: result.loaded.filter(Boolean).length });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, serviceWorkers: 'block' });
    let images = 0;
    page.on('request', r => { if (r.url().includes('/art/items/')) images++; });
    await page.goto('http://localhost:8000/?testDungeon=w01&testFloor=1');
    await page.waitForFunction(() => window.__game?.G.state === 'board', { timeout: 30000 });
    assert(images < 100, '起動時に全品を読み込んだ: ' + images);
    console.log('ゲーム起動', { itemImages: images });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
