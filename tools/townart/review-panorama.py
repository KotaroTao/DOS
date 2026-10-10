#!/usr/bin/env python3
"""街の夜景を実ブラウザで確認し、画面・動き・施設操作・代替表示の記録を残す。

先に python3 -m http.server 8000 を起動する。
python3 tools/townart/review-panorama.py
"""
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/art/town/panorama-review"
URL = "http://localhost:8000/?testDungeon=w17&testPlace=town"
OUT.mkdir(parents=True, exist_ok=True)
results = {"viewports": [], "fallbacks": [], "animation": {}}


def start(page, mode="painted"):
    page.goto(URL)
    page.wait_for_function("mode => {const c=document.querySelector('.town-scene'); return c && (mode==='painted' ? c.dataset.art==='painted' : c.width===240 && !c.classList.contains('town-scene-hd'))}", arg=mode)
    page.wait_for_timeout(450)


def state(page):
    return page.evaluate("async () => {const {game}=await import('/src/ui/ctx.js');return game.G.town}")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    for w, h in ((390, 844), (744, 1000)):
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        start(page)
        page.screenshot(path=str(OUT / f"town-{w}x{h}.png"))
        page.locator(".hb-hero").screenshot(path=str(OUT / f"hero-{w}x{h}.png"))
        geometry = page.evaluate(r"""async () => {
          const {townSpots}=await import('/src/townart.js');
          const c=document.querySelector('.town-scene'), stage=document.querySelector('.hb-stage'), hero=document.querySelector('.hb-hero');
          const rect=e=>e.getBoundingClientRect().toJSON(), hb=rect(hero), sb=rect(stage);
          const spots=[...document.querySelectorAll('.hb-spot')].map(b=>({key:b.className.match(/hb-spot-(\w+)/)[1],box:rect(b),pill:rect(b.firstChild),at:[parseFloat(b.style.left)/100,parseFloat(b.style.top)/100]}));
          return {canvas:[c.width,c.height],display:[rect(c).width,rect(c).height],rendering:getComputedStyle(c).imageRendering,hero:hb,stage:sb,spots,points:townSpots(),goal:rect(document.querySelector('.hb-goal')),title:rect(document.querySelector('.hb-title')),bar:rect(document.querySelector('.hb-bar'))};
        }""")
        assert geometry["rendering"] == "auto"
        assert abs(geometry["canvas"][0] - geometry["display"][0] * 2) <= 1
        assert len(geometry["spots"]) == 7
        for s in geometry["spots"]:
            assert s["pill"]["top"] >= geometry["hero"]["top"]
            assert s["pill"]["bottom"] < geometry["goal"]["top"], s
            assert abs(s["at"][0] - geometry["points"][s["key"]]["x"]) < 0.0001
            assert abs(s["at"][1] - geometry["points"][s["key"]]["y"]) < 0.0001
        # 読める札どうしが重ならない。透明な44pxの押せる範囲の重なりとは別に調べる。
        for i, s in enumerate(geometry["spots"]):
            a = s["pill"]
            for other in geometry["spots"][i + 1:]:
                b = other["pill"]
                assert min(a["right"], b["right"]) <= max(a["left"], b["left"]) or min(a["bottom"], b["bottom"]) <= max(a["top"], b["top"]), (s["key"], other["key"])
        facilities = []
        for key in ("palace", "mansion", "tavern", "inn", "shop", "crypt", "shrine"):
            start(page)
            # 実際の札の文字の中心をクリックし、別の施設に遮られていないことも確認する。
            page.locator(f".hb-spot-{key} .hb-spot-l").click()
            page.wait_for_timeout(400)
            town = state(page)
            if key in ("mansion", "shop", "palace"):
                assert town["tab"] == {"mansion": "party", "shop": "shop", "palace": "palace"}[key], town
            elif key in ("tavern", "shrine"):
                assert town["page"] == key, town
            else:
                banner = page.locator(".ui-sheet-banner").all_text_contents()
                assert any(("白狼" if key == "inn" else "出撃") in s.replace("\u200b", "").replace(" ", "") for s in banner), banner
            page.screenshot(path=str(OUT / f"{key}-{w}x{h}.png"))
            facilities.append({"key": key, "town": town, "opened": True})
        assert not errors, errors
        results["viewports"].append({"size": [w, h], "geometry": geometry, "facilities": facilities, "errors": errors})
        page.close()

    # 失敗した原画を同じcanvasのドット絵へ戻し、札の座標も揃える。
    for mode in ("unreadable", "unregistered"):
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        if mode == "unreadable":
            page.route("**/art/town/panorama.webp", lambda route: route.abort())
        else:
            def no_master(route):
                response = route.fetch()
                lines = response.text().splitlines()
                lines = ["  panorama: null," if line.startswith("  panorama:") else line for line in lines]
                route.fulfill(response=response, body="\n".join(lines))
            page.route("**/src/townkeyart.js", no_master)
        start(page, "pixel")
        fallback = page.evaluate(r"""async () => {
          const {townSpots}=await import('/src/townart.js'), c=document.querySelector('.town-scene');
          return {size:[c.width,c.height],rendering:getComputedStyle(c).imageRendering,points:townSpots(),spots:[...document.querySelectorAll('.hb-spot')].map(b=>({key:b.className.match(/hb-spot-(\w+)/)[1],at:[parseFloat(b.style.left)/100,parseFloat(b.style.top)/100]}))};
        }""")
        assert fallback["size"] == [240, 170]
        assert fallback["rendering"] == "pixelated"
        for s in fallback["spots"]:
            assert abs(s["at"][0] - fallback["points"][s["key"]]["x"]) < 0.0001
            assert abs(s["at"][1] - fallback["points"][s["key"]]["y"]) < 0.0001
        page.screenshot(path=str(OUT / f"fallback-{mode}.png"))
        results["fallbacks"].append({"case": mode, **fallback})
        page.close()

    page = browser.new_page(viewport={"width": 744, "height": 1000}, device_scale_factor=2)
    start(page)
    snapshot = "document.querySelector('.town-scene').toDataURL()"
    first = page.evaluate(snapshot)
    page.wait_for_timeout(700)
    assert first != page.evaluate(snapshot), "夜景が動いていない"
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(150)
    still = page.evaluate(snapshot)
    page.wait_for_timeout(700)
    assert still == page.evaluate(snapshot), "動きを減らす設定で夜景が変化した"
    page.emulate_media(reduced_motion="no-preference")
    page.wait_for_timeout(150)
    moving = page.evaluate(snapshot)
    page.wait_for_timeout(700)
    assert moving != page.evaluate(snapshot), "設定を戻しても夜景が動かない"
    results["animation"]["live"] = {"moves": True, "stopsOnPreferenceChange": True, "resumes": True}
    # 表示幅変更と、施設から街へ戻った時にcanvasを使い回せることを確認する。
    page.evaluate("window.originalTownCanvas=document.querySelector('.town-scene')")
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(200)
    assert page.locator(".town-scene").evaluate("c => c.width===Math.round(c.getBoundingClientRect().width*2)")
    page.locator(".hb-spot-mansion .hb-spot-l").click()
    page.evaluate("async () => {const {UI}=await import('/src/ui/ctx.js'); UI.shell.setTab('hub')}")
    page.wait_for_timeout(250)
    assert page.evaluate("window.originalTownCanvas===document.querySelector('.town-scene')")
    results["animation"]["resizeAndReturn"] = True

    # 実際の描画関数へ時刻を渡し、原画の固定と各演出を領域別に検査する。
    page.evaluate("""async () => {
      const {paintedTownScene}=await import('/src/townpaint.js');
      const c=paintedTownScene((canvas,draw)=>{window.panoramaDraw=draw;return canvas},()=>{throw new Error('原画を読めない')});
      c.id='panorama-test'; c.style.cssText='position:fixed;left:-5000px;top:0;width:680px;height:481.667px';document.body.append(c);
      window.panoramaHash=(box)=>{const c=document.querySelector('#panorama-test'), g=c.getContext('2d');const [x,y,w,h]=box.map((v,i)=>Math.round(v*(i%2?c.height:c.width)));const p=g.getImageData(x,y,w,h).data;let hash=2166136261;for(const n of p)hash=Math.imul(hash^n,16777619);return hash>>>0};
    }""")
    page.wait_for_function("document.querySelector('#panorama-test').dataset.art==='painted'")
    boxes = {"cloud": [.5, .32, .10, .06], "lamp": [.50, .71, .025, .04], "soul": [.14, .56, .04, .10], "fixedRoof": [.82, .60, .04, .02]}
    page.evaluate("panoramaDraw(12000)")
    before = {key: page.evaluate("box=>panoramaHash(box)", box) for key, box in boxes.items()}
    page.evaluate("panoramaDraw(15500)")
    after = {key: page.evaluate("box=>panoramaHash(box)", box) for key, box in boxes.items()}
    for key in ("cloud", "lamp", "soul"):
        assert before[key] != after[key], key
    assert before["fixedRoof"] == after["fixedRoof"], "固定した原画の屋根が動いた"
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("panoramaDraw(12000)")
    before_static = page.locator("#panorama-test").evaluate("c=>c.toDataURL()")
    page.evaluate("panoramaDraw(15500)")
    assert before_static == page.locator("#panorama-test").evaluate("c=>c.toDataURL()")
    results["animation"]["regions"] = {"before": before, "after": after, "fixedBase": True, "allOverlaysReduced": True}
    # 初めから動きを減らした場合も、画像が読めて全演出が静止する。
    reduced = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, reduced_motion="reduce")
    start(reduced)
    before = reduced.evaluate(snapshot)
    reduced.wait_for_timeout(700)
    assert before == reduced.evaluate(snapshot)
    reduced.screenshot(path=str(OUT / "reduced-motion.png"))
    reduced.emulate_media(reduced_motion="no-preference")
    reduced.wait_for_timeout(150)
    before = reduced.evaluate(snapshot)
    reduced.wait_for_timeout(700)
    assert before != reduced.evaluate(snapshot)
    results["animation"]["startsReducedAndResumes"] = True
    reduced.close()

    # 原画と座標の照合用。画像に書き込まず、ブラウザ上の確認用canvasに印を重ねる。
    page.emulate_media(reduced_motion="reduce")
    page.evaluate("""async () => {
      const {TOWN_KEYART}=await import('/src/townkeyart.js'), a=TOWN_KEYART.panorama;
      const c=document.createElement('canvas');c.width=1200;c.height=850;c.id='points-review';
      const g=c.getContext('2d'), im=new Image();im.src=a.src;await im.decode();g.drawImage(im,0,0,1200,850);
      const mark=(at,color,label)=>{const x=at[0]*1200,y=at[1]*850;g.strokeStyle=color;g.lineWidth=2;g.beginPath();g.arc(x,y,9,0,Math.PI*2);g.stroke();g.fillStyle=color;g.font='14px sans-serif';g.fillText(label,x+12,y-4)};
      Object.entries(a.spots).forEach(([key,at])=>mark(at,'#ffe0a0',key));
      a.lights.forEach((L,i)=>mark(L.at,'#66ffff','L'+i));
      document.body.replaceChildren(c);document.body.style.cssText='margin:0;background:#080a14';c.style.width='100%';
    }""")
    page.set_viewport_size({"width": 1200, "height": 850})
    page.screenshot(path=str(OUT / "points.png"))
    page.close()
    browser.close()

(OUT / "checks.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
print("夜景: 2サイズ・7施設・代替表示2種・領域別の動き・静止設定・幅変更と再表示を確認")
