"""風切りの羽の使用から効果切れまで、通常・無限迷宮のフッターを確認する。"""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("DOS_TEST_URL", "http://localhost:8000/")
SOURCE = (ROOT / "src/game.js").read_text() + """
window.floatCheck = { useItem, renderDock, castField, descend };
"""

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    errors = []
    for infinite in [False, True]:
        context = browser.new_context(viewport={"width": 390, "height": 844},
            service_workers="block", reduced_motion="reduce")
        context.route("**/src/game.js", lambda r: r.fulfill(content_type="text/javascript", body=SOURCE))
        context.route("**/art/**", lambda r: r.abort())
        context.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        query = "?testInf=1&testInfLv=10" if infinite else "?testDungeon=w04&testPlace=board"
        page.goto(BASE + query, wait_until="domcontentloaded")
        page.wait_for_function("window.floatCheck && __game.G.party.length > 0")
        page.evaluate("""async () => {
          const {G}=__game;
          const {sheet}=await import('/src/ui/kit.js');
          sheet.closeAll();
          Object.assign(G,{state:'board',prompt:false,anim:null,walking:false,autoMove:false});
          for(const d of G.party)d.spells=[];
          G.run.float=0;
          floatCheck.renderDock();
        }""")
        mark = page.locator("#hint .k-float")
        expect(mark).to_have_count(0)
        page.evaluate("""() => {
          const {G,inf:{cloneItem}}=__game;
          const d=G.party[0], feather=cloneItem('u_float_feather');
          d.items.push(feather);
          const n=d.items.length;
          window.floatMp=G.party.map(d=>d.mp);
          floatCheck.useItem(d,d.items.indexOf(feather));
          if(d.items.length!==n-1 || G.run.float!==2)throw Error('羽の消費・浮遊の発動');
        }""")
        expect(mark).to_have_count(1)
        expect(mark).to_have_class(re.compile(r"\bon\b"))
        for width in [320, 390, 1280]:
            page.set_viewport_size({"width": width, "height": 844})
            expect(mark).to_be_visible()
            assert "残り2階" in mark.get_attribute("aria-label")
        page.wait_for_timeout(400)
        mark.click(force=True)
        assert page.evaluate("JSON.stringify(__game.G.party.map(d=>d.mp))===JSON.stringify(floatMp)")
        assert page.evaluate("__game.G.run.float") == 2
        # 術を覚えた場合にも札は一つ。効果切れ後は通常の詠唱ボタンへ戻る。
        page.evaluate("__game.G.party[0].spells=['FUYUU'];floatCheck.renderDock()")
        expect(mark).to_have_count(1)
        page.evaluate("__game.G.run.float=0;floatCheck.renderDock()")
        expect(mark).to_have_count(1)
        assert "on" not in mark.get_attribute("class").split()
        # 未習得に戻し、本物の降下で残り2→1→0を確認する。
        page.evaluate("__game.G.party[0].spells=[];__game.G.run.float=2;floatCheck.renderDock()")
        for left in [1, 0]:
            before = page.evaluate("__game.G.floor")
            page.evaluate("__game.G.prompt=false;floatCheck.descend()")
            page.wait_for_function("__game.G.floor > " + str(before))
            page.evaluate("floatCheck.renderDock()")
            assert page.evaluate("__game.G.run.float") == left
            if left:
                assert f"残り{left}階" in mark.get_attribute("aria-label")
            else:
                expect(mark).to_have_count(0)
        print(("無限迷宮" if infinite else "通常迷宮") + ": 羽の使用・表示・MP不変・重複なし・降下・効果切れ OK", flush=True)
        context.close()
    assert not errors, errors
    browser.close()
