// 奉納品の一覧・詳細の共通描画口と、取得失敗の判定を確認する。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
 try {
  for (const failure of [false, true]) {
   const page = await browser.newPage({viewport:{width:1024,height:1450}, deviceScaleFactor:1, serviceWorkers:'block'});
   if (failure) await page.route('**/art/misc/*.webp', route => route.abort());
   await page.route('**/__offerings-review', route => route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>奉納品41〜60 表示確認</title>'}));
   await page.goto('http://localhost:8000/__offerings-review');
   const result = await page.evaluate(async failure => {
    const { MISC } = await import('/src/catalog/misc.js');
    const { MISC_PHOTOS, MISC_PHOTO_IDS, miscPhoto, loadMiscPhotos } = await import('/src/miscphotos.js');
    const { makeItemSpriteResolver } = await import('/src/itemart/index.js');
    const { setSpriteResolver, spriteCanvas, crispCanvas, whenPhoto, photoReady } = await import('/src/sprites.js');
    const all = MISC.filter(x=>x.slot==='misc'), targets=all.slice(40,60);
    if (targets.some(x=>!MISC_PHOTOS.includes(x.id))) throw Error('点数の不一致');
    const items=Object.fromEntries(all.map(x=>[x.id,x]));
    await loadMiscPhotos();
    const resolve=makeItemSpriteResolver(items); setSpriteResolver(resolve);
    const grid=document.createElement('div');Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'});document.body.append(grid);
    document.body.style.cssText='margin:20px;background:#20222a;color:#eee6d5;font:16px serif';
    let count=0;
    for (const [i,tmpl] of targets.entries()) {
     const photo=resolve({id:tmpl.id,slot:'misc'}), spr=photo || tmpl;
     if (!photo || photo!==miscPhoto(tmpl)) throw Error('原画の対応またはキャッシュ '+tmpl.id);
     if (spr.photo && !failure) await new Promise((ok,bad)=>{const timer=setTimeout(()=>bad(Error('読込待機 '+tmpl.id)),15000);whenPhoto(spr,()=>{clearTimeout(timer);ok()});});
     if (spr.photo?.exclude) throw Error('古い切り抜きマスク '+tmpl.id);
     if (spr.photo && photoReady(spr.photo) === failure) throw Error('原画の準備 '+tmpl.id);
     for (const c of (failure ? [] : [spriteCanvas(tmpl,8),crispCanvas(tmpl,200)])) {
      if (spr.photo && !failure) await new Promise(ok=>whenPhoto(spr,ok));
      const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      if (!a.some((v,j)=>j%4===3&&v>20)) throw Error('空の絵 '+tmpl.id);
      if (!failure && c.style.imageRendering!=='auto') throw Error('滑らかな表示 '+tmpl.id);
     }
     const card=document.createElement('div');card.style.textAlign='center'; card.append(crispCanvas(tmpl,200),document.createElement('br'),`${i+41}. ${tmpl.name}`);grid.append(card);count++;
    }
    if (miscPhoto({id:'m_unknown',slot:'misc'}) !== null) throw Error('未登録の絵');
    return {count,total:all.length,failure};
   }, failure);
   assert.equal(result.count,20); console.log(result);
   if (!failure) await page.screenshot({path:'docs/art/offerings/41-60/browser-preview.png',fullPage:true});
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
