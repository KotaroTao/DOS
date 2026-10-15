// 大空洞の主の寝床の原画登録・戦闘描画・図鑑・画像取得失敗を保存なしで確認。
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ids=['bs_cavetroll', 'bs_blindhorror', 'bs_cavernlord', 'bs_gloomstalker'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const failure of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(failure)await page.route('**/art/monsters/*.webp',r=>r.abort());
   await page.route('**/src/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nwindow.enemyBefore=JSON.parse(JSON.stringify(MONSTERS));window.enemyReview={G,MONSTERS,UI,monsterBitmap,spawnCardEnemies,spawnEliteEnemies,spawnMimic,startBattle,uiBlocked,renderBoard,makeBoard,activeCfg,drawBoardFrame,BV,fitView};'});});
   // 全原画を取得する検査では低速環境の起動監視に余裕を持たせる。
   await page.route('http://localhost:8000/?**',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('}, 5000);','}, 60000);')});});
   await page.goto('http://localhost:8000/?testDungeon=ws20&testFloor=1',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.enemyReview && enemyReview.G.state==='board'); console.log('board',failure,errors);
   await page.waitForTimeout(800);
   const result=await page.evaluate(async({ids,failure})=>{
    const t=enemyReview;const {photoReady,whenPhoto,spriteCanvas}=await import('/src/sprites.js');
    const {BESTIARY}=await import('/src/dungeons/bestiary.js');
    const {WORLD}=await import('/src/dungeons/world.js');
    const {MONSTER_PHOTOS}=await import('/src/monsterphotos.js');
    const cfg=WORLD.find(d=>d.id==='ws20');
    const needed=[...new Set([...cfg.bands.flat(),cfg.boss,...cfg.elites,'mimic','master_mimic','mt_silver','mt_gold','mt_king'])];
    for(const id of [...needed]){const summon=t.MONSTERS[id]?.summonKey;if(summon&&!needed.includes(summon))needed.push(summon);}
    if(needed.some(id=>!MONSTER_PHOTOS[id]))throw Error('対象に登録漏れ');
    let changes=[];
    for(const id of ids){
     const m=t.MONSTERS[id];
     if(!!m.photo===failure)throw Error(id+' 原画の成功/失敗');
     if(!m.art?.length)throw Error(id+' 旧絵がない');
     if(m.photo){await new Promise(r=>whenPhoto(m,r));if(!photoReady(m.photo))throw Error(id+' 写しがない');const b=t.monsterBitmap(m);const data=b.c.getContext('2d').getImageData(0,0,b.c.width,b.c.height).data;if(!data.some((v,i)=>i%4===3&&v>0))throw Error(id+' 空の戦闘絵');}
     for(const k of Object.keys(enemyBefore[id]))if(JSON.stringify(m[k])!==JSON.stringify(enemyBefore[id][k]))changes.push(id+':'+k);
    }
    if(!failure){
     const grid=document.createElement('div');grid.id='enemy-review';Object.assign(grid.style,{position:'fixed',inset:0,zIndex:999999,background:'#191b21',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',padding:'20px',overflow:'auto'});
     for(const id of ids){const card=document.createElement('div');card.style.textAlign='center';const c=spriteCanvas(t.MONSTERS[id],9);c.style.width='100%';c.style.maxWidth='300px';c.style.height='auto';card.append(c,document.createElement('br'),t.MONSTERS[id].name);grid.append(card);}document.body.append(grid);
    }
    return {needed,changes,registered:ids.length,photos:ids.filter(id=>t.MONSTERS[id].photo).length};
   },{ids,failure});
   assert.equal(result.photos,failure?0:4);assert.deepEqual(result.changes,[]);
   console.log(failure?'画像取得失敗時も4体の旧絵で起動':'対象4体の原画・非空の戦闘画像・対象の網羅を確認',result);
   if(!failure){
    await page.setViewportSize({width:1100,height:850});
    await page.screenshot({path:'docs/art/cavern-lair-enemies/preview.png'});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.querySelector('#enemy-review').remove());
    await page.evaluate(()=>{for(const id of Object.keys(enemyReview.MONSTERS))enemyReview.G.codex.mon[id]={kills:10,main:10};enemyReview.UI.codexMonSheet('bs_cavernlord');});
    await page.waitForTimeout(500);await page.screenshot({path:'docs/art/cavern-lair-enemies/codex-mobile.png'});
    await page.getByRole('button',{name:'閉じる',exact:true}).click();
    await page.evaluate(()=>{const t=enemyReview,g=t.G;g.anim=false;g.heroAnim=null;g.flipAnim=null;g.walking=false;g.prompt=false;g.board=t.makeBoard(1,t.activeCfg());g.px=g.board.start.x;g.py=g.board.start.y;let i=0;for(const row of g.board.cells)for(const c of row){c.revealed=true;if(i<4&&c.x!==g.px&&c.y!==g.py){Object.assign(c,{type:'monster',monsterKey:['bs_cavetroll', 'bs_blindhorror', 'bs_cavernlord', 'bs_gloomstalker'][i++],cleared:false});}}t.renderBoard();});
    await page.waitForTimeout(600);await page.screenshot({path:'docs/art/cavern-lair-enemies/board-mobile.png'});
    await page.evaluate(()=>{const t=enemyReview;t.G.prompt=false;t.startBattle(['bs_cavetroll', 'bs_blindhorror', 'bs_cavernlord', 'bs_gloomstalker'].map(id=>t.spawnCardEnemies(id,1,1,{min:1}).slice(0,1)[0]),null);});
    await page.waitForTimeout(1200);await page.screenshot({path:'docs/art/cavern-lair-enemies/battle-mobile.png'});
    assert.equal(await page.evaluate(()=>enemyReview.G.state),'combat');
   }
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
