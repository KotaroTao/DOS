"""初回タイトルの画像要求と、必要時の原画表示を確認。--baseline SHAで変更前とも比較する。"""
import argparse
import asyncio
import json
from pathlib import Path
import subprocess
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = "http://localhost:8000/"
FAMILIES = {"items", "monsters", "misc", "offerings", "collectibles", "treasury", "unidentified"}
args = argparse.ArgumentParser()
args.add_argument("--baseline")
args = args.parse_args()

def catalog(url):
    parts = urlparse(url).path.split("/")
    return len(parts) > 3 and parts[1] == "art" and parts[2] in FAMILIES

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        results = {}
        for revision in ([args.baseline] if args.baseline else []) + [None]:
            ctx = await browser.new_context(service_workers="block", reduced_motion="reduce")
            requested = []
            changed = ["index.html", "src/game.js", "src/sprites.js", "src/itemphotos.js", "src/monsterphotos.js",
                       "src/collectiblephotos.js", "src/treasuryphotos.js", "src/miscphotos.js", "src/itemart/unid.js", "src/itemart/index.js"]
            originals = {path: subprocess.check_output(["git", "show", revision + ":" + path], cwd=ROOT)
                         for path in changed} if revision else {}
            async def route(r):
                url = r.request.url
                if url.startswith("https://"):
                    await r.abort()
                elif catalog(url):
                    requested.append(urlparse(url).path)
                    await r.abort()  # 要求数を測り、比較側の全原画の解読だけを省く。
                else:
                    path = urlparse(url).path.lstrip("/") or "index.html"
                    if path in originals:
                        await r.fulfill(body=originals[path], content_type="text/html" if path.endswith(".html") else "application/javascript")
                    else:
                        await r.continue_()
            await ctx.route("**/*", route)
            page = await ctx.new_page()
            await page.goto(BASE, wait_until="domcontentloaded")
            await page.wait_for_selector(".ttl-overlay")
            await page.wait_for_function("!document.body.classList.contains('booting')")
            results[revision or "current"] = {"requests": len(requested), "unique": len(set(requested))}
            if not revision:
                assert not requested, requested
                assert await page.locator("#boot-notice").count() == 0
            await ctx.close()
        print("初回タイトルの魔物・品・伏せ絵の画像要求:", json.dumps(results), flush=True)

        for mode in ["normal", "slow", "offline", "wrong-size"]:
            ctx = await browser.new_context(service_workers="block", device_scale_factor=2)
            errors, requests = [], []
            active = peak = 0
            release = asyncio.Event()
            async def images(r):
                nonlocal active, peak
                requests.append(r.request.url)
                active += 1
                peak = max(peak, active)
                try:
                    if mode == "slow":
                        await release.wait()
                    if mode == "offline":
                        await r.abort()
                    elif mode == "wrong-size":
                        await r.fulfill(content_type="image/svg+xml", body='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')
                    else:
                        await r.continue_()
                finally:
                    active -= 1
            await ctx.route("**/photo-review.html", lambda r: r.fulfill(content_type="text/html", body="<html><body></body></html>"))
            await ctx.route("**/art/**", images)
            page = await ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(BASE + "photo-review.html")
            await page.evaluate("""async()=>{
              const {MONSTERS,spriteCanvas,crispCanvas,whenPhoto,photoReady}=await import('/src/sprites.js');
              const {DUNGEON_MONSTERS}=await import('/src/dungeons/index.js');Object.assign(MONSTERS,DUNGEON_MONSTERS);
              const {registerMonsterPhotos,MONSTER_PHOTOS}=await import('/src/monsterphotos.js');registerMonsterPhotos(MONSTERS);
              const {ITEMS}=await import('/src/items.js');const {CATALOG_ITEMS}=await import('/src/catalog/index.js');
              const items={...ITEMS,...CATALOG_ITEMS};const {ITEM_PHOTOS}=await import('/src/itemphotos.js');
              const {makeItemSpriteResolver,unidIcon}=await import('/src/itemart/index.js');const resolve=makeItemSpriteResolver(items);
              const {miscPhoto,MISC_PHOTO_IDS}=await import('/src/miscphotos.js');
              const {collectiblePhoto,COLLECTIBLE_PHOTOS}=await import('/src/collectiblephotos.js');
              const {treasuryPhoto,TREASURY_PHOTOS}=await import('/src/treasuryphotos.js');
              const old=it=>({...it,id:null});
              const direct=(fn,id)=>({...fn(id),fallback:old(items[id])});
              const sprite=[MONSTERS[Object.keys(MONSTER_PHOTOS)[0]],resolve(items[ITEM_PHOTOS[0]]),
                unidIcon({slot:'weapon',cat:'ls'}),
                {...miscPhoto(items[MISC_PHOTO_IDS[0]]),fallback:old(items[MISC_PHOTO_IDS[0]])},
                direct(collectiblePhoto,COLLECTIBLE_PHOTOS[0]),direct(treasuryPhoto,TREASURY_PHOTOS[0])];
              // 旧絵の参照が残っていれば、待機中・失敗時とも直ちに失敗させる。
              for(const s of sprite)Object.defineProperty(s,'fallback',{get(){throw Error('旧イラストを参照した')}});
              window.review={sprite,spriteCanvas,crispCanvas,whenPhoto,photoReady};
            }""")
            # 装備だけは参照時に取得を予約するが、ほかの未表示原画は取得しない。
            assert len(requests) <= 1, requests
            before = await page.evaluate("""()=>{
              const r=review; r.canvases=r.sprite.map(s=>r.spriteCanvas(s,4,24));
              r.canvases.push(r.crispCanvas(r.sprite[0],64));document.body.replaceChildren(...r.canvases);
              return r.canvases.map(c=>{if(!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v))throw Error('待機中の絵が空');return c.toDataURL()});
            }""")
            if mode == "slow":
                await page.wait_for_timeout(4500)
                assert await page.evaluate("review.sprite.every(s=>!review.photoReady(s.photo))")
                release.set()
            after = await page.evaluate("""async()=>{
              const r=review;const loaded=await Promise.all(r.sprite.map(s=>s.photo.load()));
              await Promise.all(r.sprite.map((s,i)=>loaded[i]?new Promise(done=>r.whenPhoto(s,done)):null));
              return {loaded,images:r.canvases.map(c=>c.toDataURL())};
            }""")
            assert peak <= 6, peak
            assert len(requests) == 6, requests
            assert after["loaded"] == [mode in ["normal", "slow"]] * 6, after["loaded"]
            for old, new in zip(before, after["images"]):
                assert (old != new) if mode in ["normal", "slow"] else (old == new)
            assert not errors, errors
            print(mode, {"requests": len(requests), "peak": peak, "loaded": sum(after["loaded"])}, flush=True)
            await ctx.close()

        # 戦闘の専用ビットマップも、取得待ちの空画像を覚えずに原画へ切り替わる。
        for failure in [False, True]:
            ctx = await browser.new_context(service_workers="block", reduced_motion="reduce")
            page = await ctx.new_page()
            await ctx.route("https://**/*", lambda r: r.abort())
            release = asyncio.Event()
            async def monster(route):
                await release.wait()
                if failure:
                    await route.abort()
                else:
                    await route.continue_()
            await page.route("**/art/monsters/bs_wickmummy.webp", monster)
            await page.route("**/src/game.js", lambda r: r.fulfill(content_type="application/javascript",
                body=(ROOT / "src/game.js").read_text() + "\nwindow.reviewBattle={MONSTERS,monsterBitmap,monsterUnknownBitmap};"))
            await page.goto(BASE + "?testDungeon=w01&testPlace=town", wait_until="domcontentloaded")
            await page.wait_for_function("window.reviewBattle && window.__game?.G.party.length>0")
            before = await page.evaluate("""()=>{
              const r=reviewBattle,m=r.MONSTERS.bs_wickmummy;
              Object.defineProperty(m,'fallback',{get(){throw Error('戦闘で旧イラストを参照した')}});
              const bitmap=r.monsterBitmap(m),unknown=r.monsterUnknownBitmap(m);
              if(!bitmap.c.getContext('2d').getImageData(0,0,bitmap.c.width,bitmap.c.height).data.some((v,i)=>i%4===3&&v))throw Error('戦闘の待機画像が空');
              return [bitmap.c.toDataURL(),unknown.c.toDataURL()];
            }""")
            release.set()
            after = await page.evaluate("""async()=>{
              const r=reviewBattle,m=r.MONSTERS.bs_wickmummy;
              const {whenPhoto}=await import('/src/sprites.js');
              if(await m.photo.ready)await new Promise(done=>whenPhoto(m,done));
              return [r.monsterBitmap(m).c.toDataURL(),r.monsterUnknownBitmap(m).c.toDataURL()];
            }""")
            assert (before == after) if failure else (before != after)
            await ctx.close()
            print("戦闘の待機印・正体不明の影:", "通信失敗でも維持" if failure else "原画へ切替", flush=True)
        await browser.close()

asyncio.run(main())
