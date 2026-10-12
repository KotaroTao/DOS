// 人物と小物の透明原画・色替え・探索操作を、テストプレイで確認する。
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CRYPT_REVIEW_URL || 'http://localhost:8000';
const out = resolve(process.env.CRYPT_REVIEW_OUT || 'docs/art/crypt/actors/review');
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
      await page.route(/\/art\/dungeon\/crypt-(props-a|props-b|props-c|props-d|corpses-seated|walker)\.webp/, async route => {
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
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorReview={G,BV,PREFS,DUNGEONS,boardCamera,fitView,drawBoardFrame,cellRect,makeBoard,activeCfg,uiBlocked,cryptPropKey,cryptPropBitmap,cryptWalkerBitmap,drawPaintedWalker};' });
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
    const failed = await start('fail'); await fixture(failed.page);
    check('人物・小物の画像がなくても石材と旧アイコンで探索できる', await failed.page.evaluate(()=>actorReview.cryptWalkerBitmap('down',{})===null && actorReview.cryptPropBitmap('chest')===null && actorReview.BV.art.scale===3 && !actorReview.uiBlocked()));
    await capture(failed.page,'before-mobile.png');await capture(failed.page,'before-board.png','#view');
    check('取得失敗時に例外がない',failed.errors.length===0);await failed.page.close();
    const {page,errors,requests,release}=await start('delay');
    check('読込中は旧人物へ戻る',await page.evaluate(()=>actorReview.cryptWalkerBitmap('down',{})===null));
    release();await page.waitForFunction(()=>actorReview.cryptWalkerBitmap('down',{}) && actorReview.cryptPropBitmap('chest') && actorReview.cryptPropBitmap('story'));
    await capture(page,'initial-mobile.png');await fixture(page);
    check('6枚の素材が到着後、自動で利用できる',requests.length===6);
    await capture(page,'after-mobile.png');await capture(page,'after-board.png','#view');
    const states=await page.evaluate(()=>{
      const k=actorReview.cryptPropKey,c=(type,extra={})=>({type,revealed:true,cleared:false,...extra});
      return [k(c('chest'))==='chest',k(c('chest',{cleared:true}))==='chestOpen',k(c('corpse',{cleared:true}))==='corpse',k(c('stairs'))==='stairs',k(c('stairs'),true)==='bossDoor',k(c('stairs',{gate:true}),true)==='portal',k(c('portal'))==='portal',...['trap','event','story'].map(type=>k(c(type))===type && k(c(type,{cleared:true}))===null),k(c('chest',{revealed:false}))===null,k(c('monster'))===null,k(c('fountain',{cleared:true}))==='fountainEmpty',k(c('corpse',{corpseWarm:true}))==='corpseWarm',k(c('corpse',{corpseGreat:true,corpseWarm:true,cleared:true}))==='corpseGreat'];
    });
    check('開閉・回収済み・帰還陣・主の扉・未踏の状態を正しく描き分ける',states.every(Boolean));
    const allLooks=await page.evaluate(async()=>{
      const t=actorReview,{WALKER_CLOAKS,WALKER_TRIMS}=await import('/src/walkerart.js');
      const before=JSON.stringify(t.G.rng),hashes=new Set();let alphaOK=true,lampOK=true;
      const source=t.cryptWalkerBitmap('down',{cloak:'night',trim:'gold'});
      const src=source.c.getContext('2d').getImageData(0,0,source.w,source.h).data;
      for(const cloak of WALKER_CLOAKS) for(const trim of WALKER_TRIMS){
        const b=t.cryptWalkerBitmap('down',{cloak:cloak.key,trim:trim.key});
        const d=b.c.getContext('2d').getImageData(0,0,b.w,b.h).data;let hash=2166136261;
        for(let i=0;i<d.length;i+=4){hash=Math.imul(hash^d[i],16777619);hash=Math.imul(hash^d[i+1],16777619);alphaOK&&=d[i+3]===src[i+3];}
        hashes.add(hash>>>0);
        const x=Math.floor(b.w*b.lamp[0]),y=Math.floor(b.h*b.lamp[1]),i=(y*b.w+x)*4;
        lampOK&&=d[i]===src[i]&&d[i+1]===src[i+1]&&d[i+2]===src[i+2];
      }
      const dirs=['down','up','left','right'].map(dir=>t.cryptWalkerBitmap(dir,{}).c.toDataURL());
      return {unique:hashes.size,alphaOK,lampOK,directions:new Set(dirs).size,rng:before===JSON.stringify(t.G.rng),cache:actorCache()};
    });
    check('外套7色×縁取り4色の28通りを保持する',allLooks.unique===28);
    check('色替えで透過と角灯の色を変えない',allLooks.alphaOK&&allLooks.lampOK);
    check('前後左右は別の原画で描く',allLooks.directions===4);
    check('色替え・方向選択は遊びの乱数を消費しない',allLooks.rng);
    check('装いキャッシュは3組まで',allLooks.cache.looks<=3);
    report.looks=allLooks;
    // 原画の全差分を一覧にする。透明部分は背景の模様が透けて見える。
    await page.evaluate(async()=>{
      const t=actorReview,{WALKER_CLOAKS,WALKER_TRIMS}=await import('/src/walkerart.js');
      const c=document.createElement('canvas');c.id='actor-gallery';c.width=1200;c.height=1350;
      c.style='position:absolute;z-index:999999;left:0;top:0;width:1200px;height:1350px';document.body.append(c);
      const g=c.getContext('2d');g.fillStyle='#1d1a1c';g.fillRect(0,0,c.width,c.height);g.font='18px sans-serif';g.textAlign='center';
      const draw=(b,i,y,label,h=155)=>{const x=(i%6)*200;g.fillStyle='#282428';g.fillRect(x+8,y+8,184,h+45);const k=Math.min(160/b.w,h/b.h);g.drawImage(b.c,x+100-b.w*k/2,y+12+(h-b.h*k),b.w*k,b.h*k);g.fillStyle='#e5d7bd';g.fillText(label,x+100,y+h+37);};
      const keys=['chest','chestOpen','stairs','fountain','corpse','portal','trap','event','story','bossDoor','wisp'];
      const labels=['宝箱','開封済み','下り階段','泉','死体','帰還魔法陣','罠','出来事','師の角灯','主の扉','魂の光'];
      keys.forEach((key,i)=>draw(t.cryptPropBitmap(key),i,Math.floor(i/6)*210,labels[i]));
      ['down','up','left','right'].forEach((dir,i)=>draw(t.cryptWalkerBitmap(dir,{}),i,430,['正面','背面','左','右'][i],210));
      WALKER_CLOAKS.forEach((look,i)=>draw(t.cryptWalkerBitmap('down',{cloak:look.key,trim:'gold'}),i,700+Math.floor(i/6)*220,look.name));
      WALKER_TRIMS.forEach((look,i)=>draw(t.cryptWalkerBitmap('down',{cloak:'night',trim:look.key}),i+1,920,look.name));
    });
    await page.setViewportSize({width:1200,height:1350});await capture(page,'gallery.png','#actor-gallery');await page.locator('#actor-gallery').evaluate(e=>e.remove());
    await page.setViewportSize({width:375,height:667});await fixture(page);
    await page.locator('#board-overview').click();check('全体表示に切り替えられる',await page.evaluate(()=>actorReview.boardCamera.zoom===1));await capture(page,'overview.png');await page.locator('#board-center').click();
    const pos=await page.evaluate(()=>[actorReview.G.px,actorReview.G.py]);const box=await page.locator('#view').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-60,box.y+box.height/2,{steps:5});await page.mouse.up();
    check('見渡す操作で人物を動かさない',JSON.stringify(pos)===JSON.stringify(await page.evaluate(()=>[actorReview.G.px,actorReview.G.py])));
    await page.locator('#board-center').click();
    // 実際の隣接タップで移動し、4方向の追従を調べる。
    for(const [dir,dx,dy] of [['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]]){
      const target=await page.evaluate(({dx,dy})=>{
        const t=actorReview,g=t.G,x=g.px+dx,y=g.py+dy,c=g.board.cells[y][x];Object.assign(c,{type:'empty',cleared:true,revealed:true});
        const r=t.cellRect(x,y),cam=t.boardCamera,box=document.querySelector('#view').getBoundingClientRect(),cv=document.querySelector('#view');const vh=cv.height/(cv.width/480);
        return{x,y,cx:box.x+(r.x+r.w/2-cam.x)*cam.zoom*box.width/480,cy:box.y+(r.y+r.h/2-cam.y)*cam.zoom*box.height/vh};
      },{dx,dy});
      await page.mouse.click(target.cx,target.cy);await page.waitForFunction(({x,y})=>actorReview.G.px===x&&actorReview.G.py===y&&!actorReview.G.heroAnim&&!actorReview.G.anim,target);
      check(`${dir}への移動で人物の向きも変わる`,await page.evaluate(dir=>actorReview.G._facing===dir,dir));
    }
    await fixture(page);
    await page.evaluate(()=>{actorReview.PREFS.walkerLook={cloak:'navy',trim:'silver'};actorReview.drawBoardFrame();});await capture(page,'navy-silver.png');
    await page.evaluate(()=>{const g=actorReview.G;g.run.float=5;g.board.cells[g.py][g.px].type='chest';g.board.cells[g.py][g.px].cleared=false;actorReview.drawBoardFrame();});await capture(page,'shared-floating.png');
    await page.evaluate(()=>{actorReview.G.run.float=0;});
    check('減らす設定でも浮遊の位置を描ける',errors.length===0);
    for(const width of [320,390,600,1280]){await page.setViewportSize({width,height:800});await page.evaluate(()=>{actorReview.fitView(true);actorReview.drawBoardFrame();});check(`${width}pxで横あふれがない`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await capture(page,'desktop.png');
    const oldArt=await page.evaluate(()=>{
      const t=actorReview;t.G.dungeonIdx=t.DUNGEONS.findIndex(d=>d.id==='w02');t.G.board=t.makeBoard(1,t.activeCfg());t.drawBoardFrame();return t.activeCfg().id==='w02'&&!t.BV.art.painting;
    });check('他の迷宮の床と壁は従来の描画を維持する',oldArt);
    check('人物・小物の描画と操作に実行時エラーがない',errors.length===0);await page.close();
    const partial=await start('partial');await partial.page.waitForFunction(()=>actorReview.cryptWalkerBitmap('down',{})&&actorReview.cryptPropBitmap('story'));
    check('小物1枚の失敗で人物や他の小物を止めない',await partial.page.evaluate(()=>actorReview.cryptPropBitmap('chest')===null&&!!actorReview.cryptPropBitmap('story')));
    check('失敗した画像を毎フレーム再要求しない',partial.requests.length===6);check('部分取得失敗でも例外がない',partial.errors.length===0);await partial.page.close();
    writeFileSync(resolve(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
