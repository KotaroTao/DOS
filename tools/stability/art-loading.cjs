// 読込を止めた実ブラウザで、旧ドット絵を出さず成功・失敗後に描画が復帰することを確認する。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ART_REVIEW_URL || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
  try {
    for (const mode of ['success', 'failure', 'invalid', 'partial']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(/\/art\/(dungeon|opening)\//, async route => {
        await gate;
        if (mode === 'failure' || mode === 'partial' && /props-a/.test(route.request().url())) return route.abort();
        if (mode === 'invalid') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64') });
        await route.continue();
      });
      await page.route('**/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.artReview={G,BV,DUNGEONS,drawBoardFrame,boardArtPending,fitView,makeBoard,activeCfg,moveTo};' });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.artReview);
      const pending = await page.evaluate(async () => {
        const t = artReview;
        t.G.dungeonIdx = t.DUNGEONS.findIndex(d => d.id === 'w01');
        t.G.floor = 1; t.G.board = t.makeBoard(1, t.activeCfg()); t.G.state = 'board';
        t.fitView(true); t.drawBoardFrame();
        const p = [t.G.px, t.G.py]; t.moveTo(t.G.px + 1, t.G.py);
        const c = document.querySelector('#view'), data = c.getContext('2d').getImageData(0, 0, 1, 1).data;
        const opening = await import('/src/openingillustrations.js');
        const old = await import('/src/openingart.js');
        window.oldBuilds = 0;
        for (const scene of old.SCENES) { const build = scene.build; scene.build = (...args) => { oldBuilds++; return build(...args); }; }
        window.shot = opening.SCENES[0].build(320, 180);
        window.shotCanvas = document.createElement('canvas'); shotCanvas.width = 320; shotCanvas.height = 180;
        shot.draw(shotCanvas.getContext('2d'), 0, { x: 0, y: 0 }, 0);
        const vista = await import('/src/backdrops.js');
        window.vistaCanvas = document.createElement('canvas'); vistaCanvas.width = 320; vistaCanvas.height = 180;
        vista.drawDungeonVista(vistaCanvas.getContext('2d'), 320, 180, { id: 'w00_forest', layer: 1 }, 0);
        window.vistaBefore = vistaCanvas.toDataURL();
        return { pending: t.boardArtPending(), art: t.BV.art, corner: [...data], stationary: p[0] === t.G.px && p[1] === t.G.py, oldBuilds };
      });
      assert.equal(pending.pending, true);
      assert.equal(pending.art, null, '待機中に旧盤面を生成しない');
      assert.deepEqual(pending.corner, [8, 10, 16, 255]);
      assert.equal(pending.stationary, true);
      assert.equal(pending.oldBuilds, 0, '待機中に旧オープニングを生成しない');
      release();
      await page.waitForFunction(() => !artReview.boardArtPending());
      await page.waitForFunction(() => vistaCanvas.toDataURL() !== vistaBefore);
      await page.waitForFunction(() => [...document.images].every(im => im.complete));
      const result = await page.evaluate(async () => {
        artReview.drawBoardFrame();
        const actors = await import('/src/cryptactors.js');
        shot.draw(shotCanvas.getContext('2d'), 0, { x: 0, y: 0 }, 0);
        return { scale: artReview.BV.art.scale, chest: !!actors.cryptPropBitmap('chest'), walker: !!actors.cryptWalkerBitmap('down', {}), oldBuilds };
      });
      assert.equal(result.scale, ['failure', 'invalid'].includes(mode) ? 1 : 3);
      assert.equal(result.chest, mode === 'success');
      assert.equal(result.walker, ['success', 'partial'].includes(mode));
      assert.equal(result.oldBuilds, mode === 'failure' ? 1 : 0);
      // 別の迷宮へ切り替える時も、前の盤面や旧素材を一瞬出さない。
      let nextRelease;
      const nextGate = new Promise(resolve => { nextRelease = resolve; });
      await page.route(/\/art\/dungeon\/w02-(floor|materials)\.webp/, async route => { await nextGate; await route.continue(); });
      assert.equal(await page.evaluate(() => {
        const t = artReview;
        t.G.dungeonIdx = t.DUNGEONS.findIndex(d => d.id === 'w02');
        t.G.board = t.makeBoard(1, t.activeCfg()); t.drawBoardFrame();
        const d = document.querySelector('#view').getContext('2d').getImageData(0, 0, 1, 1).data;
        return t.boardArtPending() && d[0] === 8 && d[1] === 10 && d[2] === 16;
      }), true);
      nextRelease();
      await page.waitForFunction(() => !artReview.boardArtPending());
      assert.equal(await page.evaluate(() => { artReview.drawBoardFrame(); return artReview.BV.art.scale; }), 3);
      assert.deepEqual(errors, []);
      console.log(`${mode}: 読込中の旧画像なし・完了後の描画と代替表示 OK`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
