// 人物と小物の透明原画・色替え・探索操作を、テストプレイで確認する。
const { chromium } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CRYPT_REVIEW_URL || 'http://localhost:8000';
const out = resolve(process.env.CRYPT_STATES_OUT || 'docs/art/crypt/actors/states-review');
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
      await page.route(/\/art\/dungeon\/crypt-(props-a|props-b|props-c|props-d|corpses-warrior|corpses-clergy|corpses-rogue|corpses-mage|walker)\.webp/, async route => {
        requests.push(route.request().url());
        if (mode === 'fail' || mode === 'partial' && route.request().url().includes('props-a') || mode === 'familyfail' && route.request().url().includes('corpses-mage')) return route.abort();
        await gate; await route.continue();
      });
      await page.route('**/src/cryptactors.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorCache=()=>({looks:looks.size,base:baseWalkers.size,props:props.size});' });
      });
      await page.route('**/src/game.js*', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: await response.text() + '\nwindow.actorReview={G,BV,PREFS,DUNGEONS,boardCamera,fitView,drawBoardFrame,cellRect,makeBoard,activeCfg,uiBlocked,cryptPropKey,cryptPropBitmap,cryptWalkerBitmap,drawPaintedWalker,vctx,cellIcon,resolveCorpse,useFountain,showChoice,closePrompt,ICONS,corpseIcons,corpseIcon};' });
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
        const set=(x,y,type,extra={})=>Object.assign(g.board.cells[y][x],{type,cleared:false,corpseClass:'fighter',...extra});
        set(0,2,'chest');set(1,2,'chest',{cleared:true});set(2,2,'stairs');set(3,2,'portal');
        set(0,3,'fountain');set(2,3,'corpse',{corpseWarm:true});set(3,3,'corpse',{corpseWarm:false,cleared:true});
        set(0,4,'trap');set(1,4,'event');set(2,4,'story');set(3,4,'stairs',{gate:true});
        t.boardCamera.overview=false;t.boardCamera.manual=false;t.fitView(true);t.drawBoardFrame();
      });
    }
    const {page,errors}=await start();
    await page.waitForFunction(()=>actorReview.cryptPropBitmap('corpseGreat') && actorReview.cryptPropBitmap('fountainEmpty'));
    await fixture(page);
    await page.waitForFunction(()=>Object.keys(actorReview.corpseIcons).every(k=>actorReview.cryptPropBitmap(k)));
    check('通常36職を重複なく9職ずつ分類し、回収後も同じ系統・状態を保つ',await page.evaluate(async()=>{
      const {CORPSE_FAMILIES,corpseArtKey}=await import('/src/corpseart.js');
      const {SOUL_CLASSES}=await import('/src/souls.js');
      const jobs=Object.values(CORPSE_FAMILIES).flat(),normal=Object.keys(SOUL_CLASSES).filter(k=>!SOUL_CLASSES[k].unique);
      if(jobs.length!==36||new Set(jobs).size!==36||normal.some(k=>!jobs.includes(k))||Object.values(CORPSE_FAMILIES).some(a=>a.length!==9))return false;
      const before=JSON.stringify(actorReview.G.rng);
      for(const [family,classes] of Object.entries(CORPSE_FAMILIES))for(const corpseClass of classes)for(const state of ['corpse','corpseWarm','corpseGreat']){
        const c={type:'corpse',revealed:true,corpseClass,corpseWarm:state!=='corpse',corpseGreat:state==='corpseGreat'};
        const key=family==='warrior'?state:`${state}_${family}`;
        if(corpseArtKey(c)!==key||actorReview.cryptPropKey(c)!==key||actorReview.cellIcon(c)!==actorReview.corpseIcons[key])return false;
        c.cleared=true;if(actorReview.cryptPropKey(c)!==key)return false;
        c.revealed=false;if(actorReview.cryptPropKey(c)!==null)return false;
      }
      return corpseArtKey({})==='corpse'&&corpseArtKey({corpseClass:'unknown',corpseWarm:true})==='corpseWarm'&&before===JSON.stringify(actorReview.G.rng);
    }));
    check('12種類すべて別の絵を表示',await page.evaluate(()=>new Set(Object.keys(actorReview.corpseIcons).map(k=>actorReview.cryptPropBitmap(k).c.toDataURL())).size===12));
    await page.evaluate(async()=>{
      const {spriteCanvas}=await import('/src/sprites.js');
      const {CORPSE_FAMILIES,CORPSE_STATES}=await import('/src/corpseart.js');
      const gallery=document.createElement('div');gallery.id='corpse-gallery';
      gallery.style='position:absolute;z-index:99999;top:0;left:0;background:#211e23;display:grid;grid-template-columns:repeat(3,190px);color:#ddcda9';
      const labels=['風化した死体','あたたかい死体','偉大なる死体'],names={warrior:'戦士系',clergy:'聖職者系',rogue:'盗賊・軽装系',mage:'魔法系'};
      for(const family of Object.keys(CORPSE_FAMILIES))CORPSE_STATES.forEach((state,i)=>{
        const key=family==='warrior'?state:`${state}_${family}`,row=document.createElement('div');
        row.style='height:260px;text-align:center;padding:10px;box-sizing:border-box;font-size:14px';
        row.append(spriteCanvas(actorReview.corpseIcons[key],14),document.createElement('br'),document.createTextNode(names[family]+'／'+labels[i]));gallery.append(row);
      });document.body.append(gallery);
    });
    await page.waitForFunction(()=>[...document.querySelectorAll('#corpse-gallery canvas')].every(c=>c.style.imageRendering==='auto'&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    await page.setViewportSize({width:650,height:1000});await capture(page,'corpse-families.png','#corpse-gallery');await page.locator('#corpse-gallery').evaluate(e=>e.remove());
    for(const corpseClass of ['fighter','priest','thief','mage'])for(const state of ['corpse','corpseWarm','corpseGreat']){
      await page.evaluate(async({corpseClass,state})=>{
        const {setPref}=await import('/src/ui/dungeonhud.js');setPref('autoCorpse',false);
        actorReview.resolveCorpse({type:'corpse',revealed:true,corpseClass,corpseWarm:state!=='corpse',corpseGreat:state==='corpseGreat'});
      },{corpseClass,state});
      await page.waitForFunction(()=>[...document.querySelectorAll('#ui-layer canvas.spr')].some(c=>c.style.imageRendering==='auto'));
      await capture(page,`${corpseClass}-${state}.png`);
      await page.evaluate(()=>actorReview.closePrompt());
    }
    check('4系統×3状態の選択画面を表示できる',errors.length===0);
    await page.evaluate(()=>{
      const t=actorReview,g=t.G;
      for(let y=0;y<6;y++)for(let x=0;x<8;x++)Object.assign(g.board.cells[y][x],{type:'empty',revealed:true});
      ['fighter','priest','thief','mage'].forEach((corpseClass,x)=>{
        for(let i=0;i<3;i++)Object.assign(g.board.cells[i+1][x],{type:'corpse',corpseClass,corpseWarm:i>0,corpseGreat:i===2,cleared:false,walls:{n:true,s:true,e:true,w:true}});
      });
    });
    for(const width of [320,390,600,1280]){
      await page.setViewportSize({width,height:900});
      check(`幅${width}: 12種類とも同居時を含め壁の内側`,await page.evaluate(()=>{
        const t=actorReview,g=t.G,original=t.vctx.drawImage,draws=[];
        const entries=[];
        for(let y=1;y<=3;y++)for(let x=0;x<4;x++)entries.push({x,y,b:t.cryptPropBitmap(t.cryptPropKey(g.board.cells[y][x]))});
        t.boardCamera.overview=true;t.fitView(true);
        t.vctx.drawImage=function(image,x,y,w,h,...rest){const e=entries.find(e=>e.b.c===image);if(e)draws.push({e,x,y,w,h});return original.call(this,image,x,y,w,h,...rest);};
        try{t.drawBoardFrame();}finally{t.vctx.drawImage=original;}
        return draws.length===12&&draws.every(d=>{const r=t.cellRect(d.e.x,d.e.y);return d.x>=r.x&&d.x+d.w<=r.x+r.w&&d.y>=r.y&&d.y+d.h<=r.y+r.h;});
      }));
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{actorReview.fitView(true);actorReview.drawBoardFrame();});await capture(page,'families-board.png','#view');
    await fixture(page);
    // マスの中身で人物が縮まないことを、実際の描画寸法で比較する。
    for (const width of [320,390,600,1280]) {
      await page.setViewportSize({width,height:900});
      const stable = await page.evaluate(() => {
        const t=actorReview,g=t.G,c=g.board.cells[g.py][g.px],saved={...c};
        const original=t.vctx.drawImage;
        let measured=null,target;
        t.vctx.drawImage=function(image,x,y,w,h,...rest){
          if(image===target) measured={x,y,w,h};
          return original.call(this,image,x,y,w,h,...rest);
        };
        try {
          for(const overview of [false,true]) for(const float of [0,5]) for(const dir of ['up','down','left','right']) {
            t.boardCamera.overview=overview;g.run.float=float;g._facing=dir;t.fitView(true);
            target=t.cryptWalkerBitmap(dir,t.PREFS.walkerLook).c;
            let empty;
            for(const type of ['empty','chest','corpse','fountain','stairs','portal','event','story']) for(const cleared of [false,true]) {
              Object.assign(c,{type,cleared,revealed:true,corpseWarm:true});
              measured=null;t.drawBoardFrame();
              if(!measured)return false;
              if(type==='empty')empty=measured;
              if(Math.abs(measured.w-empty.w)>0.001||Math.abs(measured.h-empty.h)>0.001)return false;
              const r=t.cellRect(g.px,g.py);
              if(measured.x<r.x||measured.x+measured.w>r.x+r.w)return false;
            }
          }
          return true;
        } finally {
          t.vctx.drawImage=original;Object.assign(c,saved);g.run.float=0;g._facing='down';
        }
      });
      check(`幅${width}: 全4方向・浮遊・拡大/全体・小物8種で人物の大きさが一定`,stable);
    }
    await page.setViewportSize({width:390,height:844});
    await fixture(page);
    for(const type of ['empty','chest']) {
      await page.evaluate(type=>{const t=actorReview,g=t.G;Object.assign(g.board.cells[g.py][g.px],{type,cleared:false});t.drawBoardFrame();},type);
      await capture(page,`walker-${type}.png`,'#view');
    }
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
    // 四方の壁と同居を含む、実際の描画矩形を調べる。
    for (const width of [320,390,600,1280]) {
      await page.setViewportSize({width,height:900});
      for (const overview of [false,true]) for (const shared of [false,true]) {
        const result = await page.evaluate(({overview,shared})=>{
          const t=actorReview,g=t.G;
          g.px=shared?1:4;g.py=2;
          for(let x=0;x<3;x++) g.board.cells[2][x].walls={n:true,s:true,w:true,e:true};
          t.boardCamera.overview=overview;t.fitView(true);
          const bitmaps=['corpse','corpseWarm','corpseGreat'].map(k=>t.cryptPropBitmap(k));
          const draws=[],original=t.vctx.drawImage;
          t.vctx.drawImage=function(image,x,y,w,h,...rest){
            const i=bitmaps.findIndex(b=>b.c===image);
            if(i>=0)draws.push({i,x,y,w,h});
            return original.call(this,image,x,y,w,h,...rest);
          };
          try {t.drawBoardFrame();} finally {t.vctx.drawImage=original;}
          return {count:draws.length,inside:draws.every(d=>{
            const r=t.cellRect(d.i,2);
            return d.x>=r.x+r.w*.04 && d.x+d.w<=r.x+r.w*.96 && d.y>=r.y && d.y+d.h<=r.y+r.h;
          })};
        },{overview,shared});
        check(`幅${width}・全体${overview}・同居${shared}: 遺体3種が壁の内側`,result.count===3&&result.inside);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{const t=actorReview;t.G.px=1;t.G.py=3;t.boardCamera.overview=true;t.fitView(true);t.drawBoardFrame();});
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
    const partial=await start('familyfail');
    await partial.page.waitForFunction(()=>actorReview.cryptPropBitmap('corpseWarm_clergy'));
    check('魔法系だけの取得失敗でも他の3系統を表示できる',await partial.page.evaluate(()=>['corpseWarm','corpseWarm_clergy','corpseWarm_rogue'].every(k=>actorReview.cryptPropBitmap(k))&&!actorReview.cryptPropBitmap('corpseWarm_mage')));
    await partial.page.evaluate(()=>actorReview.showChoice('取得失敗時の確認',[{label:'閉じる',fn:()=>{}}],actorReview.corpseIcon({corpseClass:'mage',corpseWarm:true})));
    await partial.page.waitForFunction(()=>[...document.querySelectorAll('#ui-layer canvas.spr')].some(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)));
    check('系統別の画像取得失敗でも選択画面は空にならない',partial.errors.length===0);await partial.page.close();
    writeFileSync(resolve(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
