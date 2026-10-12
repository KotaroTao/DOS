// ローカルHTTPサーバーとPlaywrightで、実画面・素材失敗時・操作を確認する。
// NODE_PATHにPlaywrightのあるnode_modulesを指定して実行できる。
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CRYPT_REVIEW_URL || 'http://localhost:8000';
const out = resolve('docs/art/dungeons/review-w37-w41');
mkdirSync(out, { recursive: true });
const report = { checks: [], screenshots: [] };
function check(name, value) { assert.ok(value, name); report.checks.push(name); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    async function start({ failure = false, delay = false, invalid = false } = {}) {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      let release;
      const gate = delay ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
      await page.route(/\/art\/dungeon\/w(?:3[7-9]|4[01])-(materials|floor)\.webp/, async route => {
        const floor = route.request().url().includes('-floor');
        if (failure === true || failure === 'floor' && floor && route.request().url().includes('/w37-')) return route.abort();
        if (invalid && !floor && route.request().url().includes('/w37-')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
        await gate; await route.continue();
      });
      await page.route('**/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.cryptReview={G,BV,boardCamera,fitView,drawBoardFrame,drawFlipSlab,cellRect,makeBoard,activeCfg,uiBlocked,DUNGEONS};' });
      });
      await page.goto(base);
      await page.getByRole('button', { name: /テストプレイ/ }).click();
      await page.locator('.ttl-test select').filter({has:page.locator('option[value="w37"]')}).selectOption('w37');
      await page.locator('.ttl-test button').last().click();
      await page.waitForFunction(() => window.cryptReview && cryptReview.G.state === 'board' && !cryptReview.uiBlocked());
      await page.waitForTimeout(600);
      return { page, errors, release };
    }
    async function fixture(page, id = 'w37', floor = 1) {
      return page.evaluate(async ({ id, floor }) => {
        const t = cryptReview, g = t.G;
        const { reseedRng } = await import('/src/rng.js');
        g.rng = reseedRng(7331);
        g.dungeonIdx = t.DUNGEONS.findIndex(d => d.id === id); g.floor = floor;
        g.board = t.makeBoard(floor, t.activeCfg());
        g.px = g.board.start.x; g.py = g.board.start.y;
        g.heroAnim = null; g.flipAnim = null; g.anim = false; g.walking = false;
        // 原画の確認用に左下へ通路を開く。実際の探索経路とは区別した見本。
        for (let y = 3; y < 6; y++) for (let x = 0; x < 2; x++) {
          const c = g.board.cells[y][x]; c.type = 'empty'; c.revealed = true; c.cleared = true;
        }
        g.board.cells[g.py][g.px].type = 'start';
        t.boardCamera.overview = false; t.boardCamera.manual = false;
        t.fitView(true); t.drawBoardFrame();
        return { scale: t.BV.art.scale, width: t.BV.art.slabs.width, height: t.BV.art.slabs.height };
      }, { id, floor });
    }
    async function capture(page, name, boardOnly = false) {
      await (boardOnly ? page.locator('#view') : page).screenshot({ path: resolve(out, name) });
      report.screenshots.push(name);
    }
    const fallback = await start({ failure: true });
    await fixture(fallback.page);
    check('素材の取得失敗時は旧描画で探索できる', await fallback.page.evaluate(() => cryptReview.BV.art.scale === 1 && !cryptReview.uiBlocked()));
    await capture(fallback.page, 'before-mobile.png');
    await capture(fallback.page, 'before-board.png', true);
    check('素材取得失敗時に実行時エラーがない', fallback.errors.length === 0);
    for (const id of ['w37','w38','w39','w40','w41']) {
      const result=await fixture(fallback.page,id);
      check(id+'は素材失敗時にも旧描画を保つ',result.scale===1);
      await capture(fallback.page,id+'-before.png',true);
    }
    await fallback.page.close();

    for (const options of [{failure:'floor'}, {invalid:true}]) {
      const sample = await start(options);
      await fixture(sample.page);
      check(JSON.stringify(options)+'でも旧描画で探索可能',await sample.page.evaluate(()=>cryptReview.BV.art.scale===1&&!cryptReview.uiBlocked()));
      await fixture(sample.page,'w38');
      await sample.page.waitForFunction(()=>cryptReview.BV.art.scale===3);
      check('一迷宮の素材失敗は別迷宮の素材を妨げない',sample.errors.length===0);
      await sample.page.close();
    }
    const { page, errors, release } = await start({ delay: true });
    check('読込待ちでも旧描画が表示される', await page.evaluate(() => cryptReview.BV.art.scale === 1));
    release();
    await page.waitForFunction(() => cryptReview.BV.art?.scale === 3);
    check('素材到着後に描き下ろしへ自動で切り替わる', true);
    await capture(page, 'initial-mobile.png');
    const size = await fixture(page);
    check('素材を論理解像度へ縮小せず3倍で合成する', size.scale === 3 && size.width === 1440);
    await capture(page, 'after-mobile.png');
    await capture(page, 'after-board.png', true);
    const reproducible = await page.evaluate(() => {
      const t = cryptReview, before = JSON.stringify(t.G.rng), png = t.BV.art.slabs.toDataURL();
      t.BV.artCache.clear(); t.BV.artKey = ''; t.drawBoardFrame();
      return before === JSON.stringify(t.G.rng) && png === t.BV.art.slabs.toDataURL();
    });
    check('同じ階の素材は再生成しても一致し、遊びの乱数を消費しない', reproducible);
    const sample = await page.evaluate(() => {
      const t = cryptReview, begin = performance.now();
      for (let i = 0; i < 60; i++) t.drawBoardFrame();
      return { meanFrameMs: (performance.now() - begin) / 60, slabPixels: t.BV.art.slabs.width * t.BV.art.slabs.height };
    });
    report.localChromium = sample;
    const beforePan = await page.evaluate(() => ({ x: cryptReview.G.px, y: cryptReview.G.py, camera: cryptReview.boardCamera.x }));
    const box = await page.locator('#view').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 65, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
    const afterPan = await page.evaluate(() => ({ x: cryptReview.G.px, y: cryptReview.G.py, camera: cryptReview.boardCamera.x }));
    check('ドラッグは見渡すだけで隊を動かさない', beforePan.x === afterPan.x && beforePan.y === afterPan.y && beforePan.camera !== afterPan.camera);
    await page.locator('#board-overview').click();
    check('全体表示へ切り替えられる', await page.evaluate(() => cryptReview.boardCamera.zoom === 1));
    await capture(page, 'overview-mobile.png');
    await page.locator('#board-center').click();
    check('現在地の拡大表示へ戻れる', await page.evaluate(() => cryptReview.boardCamera.zoom > 1 && !cryptReview.boardCamera.manual));
    // 隣の到達可能なマスを未踏の空マスにし、実際のクリックで蓋をめくる。
    const target = await page.evaluate(() => {
      const t = cryptReview, g = t.G, camera = t.boardCamera;
      for (const [dir, dx, dy] of [['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]]) {
        if (g.board.cells[g.py][g.px].walls[dir]) continue;
        const x = g.px + dx, y = g.py + dy, cell = g.board.cells[y][x];
        cell.type = 'empty'; cell.cleared = false; cell.revealed = false; t.drawBoardFrame();
        const r = t.cellRect(x, y), box = document.querySelector('#view').getBoundingClientRect();
        const vh = document.querySelector('#view').height / (document.querySelector('#view').width / 480);
        return { x, y, clientX: box.x + (r.x + r.w / 2 - camera.x) * camera.zoom * box.width / 480, clientY: box.y + (r.y + r.h / 2 - camera.y) * camera.zoom * box.height / vh };
      }
    });
    await page.mouse.click(target.clientX, target.clientY);
    await page.waitForFunction(({x,y}) => cryptReview.G.px === x && cryptReview.G.py === y && !cryptReview.G.anim, target);
    check('拡大中のタップで正しい蓋が開く', await page.evaluate(({x,y}) => cryptReview.G.board.cells[y][x].revealed, target));
    // めくる途中も同じ高解像度の領域を描けることを確認。
    await page.evaluate(({x,y}) => { cryptReview.G.flipAnim = {x,y,t0:performance.now(),dur:1000}; cryptReview.drawBoardFrame(); }, target);
    await capture(page, 'flipping-mobile.png');
    await page.evaluate(() => { cryptReview.G.flipAnim = null; });
    for (const [id, floors] of [['w01',5],['w37',15],['w38',10],['w39',10],['w40',10],['w41',15]]) {
      await fixture(page, id);
      await page.waitForFunction(() => cryptReview.BV.art?.scale === 3);
      for (let floor = 1; floor <= floors; floor++) {
        const result = await fixture(page, id, floor);
        check(`${id} B${floor}Fに高解像度素材が適用される`, result.scale === 3);
      }
      await fixture(page, id);
      const stable = await page.evaluate(() => {
        const t=cryptReview, before=JSON.stringify(t.G.rng), png=t.BV.art.slabs.toDataURL();
        const c=t.G.board.cells[0][0], type=c.type;c.type=type==='empty'?'chest':'empty';
        t.BV.artCache.clear();t.BV.artKey='';t.drawBoardFrame();
        const same=png===t.BV.art.slabs.toDataURL();c.type=type;
        return same&&before===JSON.stringify(t.G.rng);
      });
      check(id+'の蓋は中身を示さず、描画で遊びの乱数を消費しない',stable);
      await capture(page, id + '-board.png', true);
      if (['w37','w39','w40','w41'].includes(id)) {
        const hazard = await page.evaluate(() => {
          const t=cryptReview,c=t.G.board.cells[4][1]; c.type='empty';c.revealed=true;
          t.BV.artCache.clear();t.BV.artKey='';t.drawBoardFrame();
          const plain=t.BV.art.floor.toDataURL();c.type='poison';
          t.BV.artCache.clear();t.BV.artKey='';t.drawBoardFrame();
          return plain!==t.BV.art.floor.toDataURL();
        });
        check(id+'の危険な床に専用の染み・刃を重ねる',hazard);
        await capture(page,id+'-hazard.png',true);
      }
      for (const width of [320,390,600,1280]) {
        await page.setViewportSize({width,height:800}); await fixture(page,id);
        check(`${id} 幅${width}pxで横あふれなし`, await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      await page.setViewportSize({width:375,height:667});
    }
    for (const id of ['ws1','ws2','ws3']) {
      const result = await fixture(page,id);
      check(`${id}は従来の素材を維持する`,result.scale===1);
    }
    await fixture(page);
    for (const width of [320,390,600]) {
      await page.setViewportSize({ width, height: 740 }); await fixture(page);
      check(`画面幅${width}pxで横あふれがない`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({width:667,height:375}); await fixture(page);
    await capture(page, 'landscape.png');
    await page.setViewportSize({width:1280,height:800}); await fixture(page);
    await capture(page, 'desktop.png');
    check('PCは全体表示を維持する', await page.evaluate(() => cryptReview.boardCamera.zoom === 1));
    check('素材キャッシュは2組以内', await page.evaluate(() => cryptReview.BV.artCache.size <= 2));
    check('画像の読込・めくり・リサイズで実行時エラーがない', errors.length === 0);
    await page.close();
    writeFileSync(resolve(out, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
