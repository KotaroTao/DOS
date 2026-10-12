// 人物と小物の透明原画・色替え・探索操作を、テストプレイで確認する。
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CRYPT_REVIEW_URL || 'http://localhost:8000';
const out = resolve('docs/art/crypt/actors/states-review');
mkdirSync(out, { recursive: true });
const report = { checks: [], screenshots: [] };
const check = (name, ok) => { assert.ok(ok, name); report.checks.push(name); };

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    async function start(mode = 'normal') {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
      let release;
      const gate = mode === 'delay' ? new Promise(r => { release = r; }) : Promise.resolve();
      await page.route(/\/art\/dungeon\/crypt-(props-a|props-b|props-c|walker)\.webp/, async route => {
        requests.push(route.request().url());
        if (mode === 'fail' || mode === 'partial' && route.request().url().includes('props-a')) return route.abort();
        await gate; await route.continue();
      });
      await page.route('**/src/cryptactors.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorCache=()=>({looks:looks.size,base:baseWalkers.size,props:props.size});' });
      });
      await page.route('**/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorReview={G,BV,PREFS,DUNGEONS,boardCamera,fitView,drawBoardFrame,cellRect,makeBoard,activeCfg,uiBlocked,cryptPropKey,cryptPropBitmap,cryptWalkerBitmap,drawPaintedWalker,cellIcon,resolveCorpse,useFountain,showChoice,closePrompt,ICONS};' });
      });
      await page.goto(base);
      await page.getByRole('button', { name: /テストプレイ/ }).click(); await page.locator('.ttl-test button').last().click();
      await page.waitForFunction(() => window.actorReview && actorReview.G.state === 'board' && !actorReview.uiBlocked() && actorReview.BV.art?.scale === 3);
      await page.waitForTimeout(500);
      return { page, errors, requests, release };
    }
    async function capture(page, name, locator) {
      await (locator ? page.locator(locator) : page).screenshot({ path: resolve(out, name) }); report.screenshots.push(name);
    }
    async function fixture(page) {
      await page.evaluate(async () => {
        const t = actorReview, g = t.G;
        g.rng = (await import('/src/rng.js')).reseedRng(7331);
        g.dungeonIdx = t.DUNGEONS.findIndex(d => d.id === 'w01'); g.floor = 1;
        g.board = t.makeBoard(1, t.activeCfg()); g.px = 1; g.py = 3; g._facing = 'down';
        g.anim = false; g.heroAnim = null; g.flipAnim = null; g.walking = false;
        t.PREFS.walkerLook = {cloak:'night', trim:'gold'};
        for (let y=0;y<6;y++) for (let x=0;x<8;x++) {
          const c=g.board.cells[y][x];c.type='empty';c.revealed=true;c.cleared=true;
          c.walls={n:y===0,s:y===5,w:x===0,e:x===7};
        }
        const set=(x,y,type,extra={})=>Object.assign(g.board.cells[y][x],{type,cleared:false,...extra});
        set(0,2,'chest');set(1,2,'chest',{cleared:true});set(2,2,'stairs');set(3,2,'portal');
        set(0,3,'fountain');set(2,3,'corpse',{corpseWarm:true});set(3,3,'corpse',{corpseWarm:false,cleared:true});
        set(0,4,'trap');set(1,4,'event');set(2,4,'story');set(3,4,'stairs',{gate:true});
        t.boardCamera.overview=false;t.boardCamera.manual=false;t.fitView(true);t.drawBoardFrame();
      });
    }
    const {page,errors}=await start();
    await page.waitForFunction(()=>actorReview.cryptPropBitmap('corpseGreat') && actorReview.cryptPropBitmap('fountainEmpty'));
    await fixture(page);
    await page.evaluate(()=>{
      const t=actorReview,g=t.G;
      Object.assign(g.board.cells[2][0],{type:'corpse',corpseWarm:false,corpseGreat:false,cleared:false});
      Object.assign(g.board.cells[2][1],{type:'corpse',corpseWarm:true,corpseGreat:false,cleared:false});
      Object.assign(g.board.cells[2][2],{type:'corpse',corpseWarm:true,corpseGreat:true,cleared:false});
      Object.assign(g.board.cells[3][2],{type:'fountain',cleared:false});
      Object.assign(g.board.cells[3][3],{type:'fountain',cleared:true});
      t.drawBoardFrame();
    });
    await capture(page,'board.png','#view');
    check('死体3種は別の原画',await page.evaluate(()=>new Set(['corpse','corpseWarm','corpseGreat'].map(k=>actorReview.cryptPropBitmap(k).c.toDataURL())).size===3));
    check('飲んだ泉は空の泉として残る',await page.evaluate(()=>{
      const t=actorReview,c=t.G.board.cells[3][2];t.useFountain(c);
      return c.cleared && t.cellIcon(c)===t.ICONS.fountainEmpty && t.cryptPropKey(c)==='fountainEmpty';
    }));
    await page.evaluate(()=>actorReview.drawBoardFrame());await capture(page,'drained.png','#view');
    const keys=['chest','chestOpen','stairs','bossDoor','portal','trap','event','story','wisp','fountain','fountainEmpty','corpse','corpseWarm','corpseGreat'];
    await page.evaluate(async keys=>{
      const {spriteCanvas}=await import('/src/sprites.js');
      const gallery=document.createElement('div');gallery.id='popup-gallery';gallery.style='position:absolute;z-index:99999;top:0;left:0;background:#211e23;display:grid;grid-template-columns:repeat(4,150px);color:#ddcda9';
      for(const key of keys){const row=document.createElement('div');row.style='height:160px;text-align:center';row.append(spriteCanvas(actorReview.ICONS[key],10),document.createTextNode(key));gallery.append(row);}document.body.append(gallery);
    },keys);
    await page.waitForFunction(()=>[...document.querySelectorAll('#popup-gallery canvas')].every(c=>c.style.imageRendering==='auto'&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    check('作成済み14種が共通ポップアップ描画で表示される',true);
    await page.setViewportSize({width:650,height:800});await capture(page,'popup-gallery.png','#popup-gallery');await page.locator('#popup-gallery').evaluate(e=>e.remove());await page.setViewportSize({width:375,height:667});
    for(const [key,flags] of [['corpse',{corpseWarm:false}],['corpseWarm',{corpseWarm:true}],['corpseGreat',{corpseWarm:true,corpseGreat:true}]]){
      await page.evaluate(async flags=>{const t=actorReview;const {setPref}=await import('/src/ui/dungeonhud.js');setPref('autoCorpse',false);t.resolveCorpse({type:'corpse',revealed:true,cleared:false,corpseClass:'fighter',...flags});},flags);
      await page.waitForTimeout(250);await capture(page,key+'-popup.png');
      check(key+'の選択画面に滑らかな原画を表示',await page.locator('#ui-layer canvas.spr').evaluateAll(cs=>cs.some(c=>c.style.imageRendering==='auto')));
      await page.evaluate(()=>actorReview.closePrompt());
    }
    // 他の迷宮でも死体の種類と空の泉を保つ。
    await page.evaluate(()=>{const t=actorReview;t.G.dungeonIdx=t.DUNGEONS.findIndex(d=>d.id==='w02');t.fitView(true);t.drawBoardFrame();});
    await capture(page,'other-dungeon.png','#view');
    check('状態変更とポップアップに例外なし',errors.length===0);await page.close();
    const delayed=await start('delay');
    await delayed.page.evaluate(()=>actorReview.showChoice('読込待ちの確認',[{label:'閉じる',fn:()=>{}}],actorReview.ICONS.corpseGreat));
    delayed.release();
    await delayed.page.waitForFunction(()=>[...document.querySelectorAll('#ui-layer canvas.spr')].some(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    check('開いたポップアップも画像到着後に描き直される',delayed.errors.length===0);await delayed.page.close();
    const failed=await start('fail');
    await failed.page.evaluate(()=>actorReview.showChoice('取得失敗時の確認',[{label:'閉じる',fn:()=>{}}],actorReview.ICONS.corpseGreat));
    await failed.page.waitForFunction(()=>[...document.querySelectorAll('#ui-layer canvas.spr')].some(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    check('画像取得失敗時もポップアップが空にならない',failed.errors.length===0);await failed.page.close();
    writeFileSync(resolve(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
