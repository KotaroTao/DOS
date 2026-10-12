// 人物と小物の透明原画・色替え・探索操作を、テストプレイで確認する。
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CRYPT_REVIEW_URL || 'http://localhost:8000';
const out = resolve(process.env.CRYPT_REVIEW_OUT || 'docs/art/crypt/actors/common-review');
mkdirSync(out, { recursive: true });
const report = { checks: [], screenshots: [] };
const check = (name, ok) => { assert.ok(ok, name); report.checks.push(name); };

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    async function start(mode = 'normal', motion = 'reduce') {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: motion, serviceWorkers: 'block' });
      const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
      let release;
      const gate = mode === 'delay' ? new Promise(r => { release = r; }) : Promise.resolve();
      await page.route(/\/art\/dungeon\/crypt-(props-a|props-b|props-c|props-d|walker)\.webp/, async route => {
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
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorReview={G,BV,PREFS,DUNGEONS,boardCamera,fitView,drawBoardFrame,cellRect,makeBoard,activeCfg,uiBlocked,cryptPropKey,cryptPropBitmap,cryptWalkerBitmap,drawPaintedWalker,cellIcon,resolveCorpse,useFountain,showChoice,closePrompt,ICONS,vctx,drawBoardIcons,boardLightSources,showEvent,showToast,updateTopbar,drawHoodedWalker,walkerSprite};window.drawnActors=[];const originalDrawBmpFit=drawBmpFit;drawBmpFit=function(b,...args){window.drawnActors.push(b.c);return originalDrawBmpFit(b,...args);};' });
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
    await page.waitForFunction(()=>actorReview.cryptPropBitmap('ember') && actorReview.cryptPropBitmap('start'));
    await fixture(page);
    await page.evaluate(()=>{actorReview.G.embers=12;actorReview.updateTopbar();});
    for(const key of ['gold','ember']) check(key+'の上部表示が新素材',await page.evaluate(key=>getComputedStyle(document.querySelector('#topbar-cur .cur-'+key),'::before').backgroundImage.includes('crypt-'+key+'.webp'),key));
    await capture(page,'header-mobile.png');
    const coverage = await page.evaluate(() => {
      const t = actorReview, g = t.G, results = [];
      const required = ['chest','chestOpen','stairs','portal','fountain','corpseWarm','corpse','trap','event','story','wisp'];
      const targets = t.DUNGEONS.map((d, i) => ({ id: d.id, i }));
      targets.push({ id: 'abyss', i: 0 });
      for (const target of targets) {
        g.dungeonIdx = target.i;
        g.abyss = target.id === 'abyss' ? { started: true, depth: 30 } : null;
        window.drawnActors.length = 0;
        t.drawBoardIcons({ x: 0, y: 0, r1: 10000 }, 1000, 0, 0);
        t.drawHoodedWalker(t.walkerSprite(), 100, 100, 1000);
        const missing = required.filter(key => !window.drawnActors.includes(t.cryptPropBitmap(key).c));
        if (!window.drawnActors.includes(t.cryptWalkerBitmap(g._facing, t.PREFS.walkerLook).c)) missing.push('walker');
        results.push({ id: target.id, missing });
      }
      g.abyss = null;
      return results;
    });
    check('全迷宮と無限迷宮で人物・宝箱・階段・魂火などの共通原画を実描画する', coverage.every(r => r.missing.length === 0));
    report.dungeons = coverage.map(r => r.id);
    await fixture(page);
    const centers=await page.evaluate(()=>{
      const t=actorReview,g=t.G;
      for(const row of g.board.cells) for(const c of row) Object.assign(c,{type:'empty',cleared:true});
      const cell=g.board.cells[3][2];Object.assign(cell,{type:'corpse',corpseWarm:true,cleared:false});
      const results=[];
      for(const share of [false,true]){
        g.px=share?2:1;g.py=3;g.heroAnim=null;
        const positions=[],old=t.vctx.translate;t.vctx.translate=function(x,y){positions.push(x);return old.call(this,x,y);};
        try {t.drawBoardIcons({x:0,y:0,r1:10000},1000,0,0);} finally {t.vctx.translate=old;}
        const r=t.cellRect(2,3),expected=r.x+r.w/2+(share?r.w*.2:0);
        const light=t.boardLightSources(1000).find(v=>v.col==='127,208,255');
        results.push(positions.some(x=>Math.abs(x-expected)<1e-6)&&Math.abs(light.x-expected)<1e-6);
      }
      g.px=1;t.drawBoardFrame();return results;
    });
    check('魂火と光源が遺体中央にそろう（通常・同居）',centers.every(Boolean));
    await capture(page,'soul-centered.png','#view');
    const keys=['ember','gold','poison','guard','start'];
    await page.evaluate(async keys=>{
      const {spriteCanvas}=await import('/src/sprites.js');
      const gallery=document.createElement('div');gallery.id='common-gallery';gallery.style='position:absolute;z-index:99999;top:0;left:0;background:#211e23;display:grid;grid-template-columns:repeat(3,150px);color:#ddcda9';
      const names=['魂の残火','金貨','足元の危険','守衛','入口の旗'];
      keys.forEach((key,i)=>{const row=document.createElement('div');row.style='height:175px;text-align:center';row.append(spriteCanvas(actorReview.ICONS[key],10),document.createTextNode(names[i]));gallery.append(row);});
      const small=document.createElement('div');small.style='font-size:24px';small.innerHTML='<i class="ui-g ui-g-ember"></i>12<br><i class="ui-g ui-g-gold"></i>44';gallery.append(small);document.body.append(gallery);
    },keys);
    await page.waitForFunction(()=>[...document.querySelectorAll('#common-gallery canvas')].every(c=>c.style.imageRendering==='auto'&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    check('汎用5種類のポップアップ用原画が描かれる',true);
    await page.setViewportSize({width:480,height:700});await capture(page,'common-gallery.png','#common-gallery');await page.locator('#common-gallery').evaluate(e=>e.remove());await page.setViewportSize({width:375,height:667});
    for(const key of keys){await page.evaluate(key=>actorReview.showChoice('汎用アイコンの表示確認',[{label:'閉じる',fn:()=>{}}],actorReview.ICONS[key]),key);await page.waitForTimeout(100);await capture(page,key+'-popup.png');await page.evaluate(()=>actorReview.closePrompt());}
    check('小さい通貨表示も同じ原画を参照する',await page.evaluate(()=>['ember','gold'].every(key=>{const e=document.createElement('i');e.className='ui-g ui-g-'+key;document.body.append(e);const bg=getComputedStyle(e).backgroundImage;e.remove();return bg.includes('crypt-'+key+'.webp');})));
    for(const width of [320,390,1280]) {await page.setViewportSize({width,height:800});check(width+'pxで横あふれなし',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    check('通常表示に例外なし',errors.length===0);await page.close();
    for(const mode of ['delay','fail']){
      const t=await start(mode);await t.page.evaluate(()=>actorReview.showChoice('画像取得の確認',[{label:'閉じる',fn:()=>{}}],actorReview.ICONS.ember));if(t.release)t.release();
      await t.page.waitForFunction(()=>[...document.querySelectorAll('#ui-layer canvas.spr')].some(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
      check(mode==='delay'?'魂の残火は画像到着後に描き直される':'取得失敗時も魂の残火が空にならない',t.errors.length===0);await t.page.close();
    }
    const moving=await start('normal','no-preference');await fixture(moving.page);await moving.page.waitForTimeout(700);await capture(moving.page,'soul-moving.png','#view');check('ゆらめきありの描画に例外なし',moving.errors.length===0);await moving.page.close();
    writeFileSync(resolve(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
