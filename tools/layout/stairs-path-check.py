"""localhost:8000で階段の遠隔発見と、フッターの降下条件を実操作で確認する。"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("DOS_TEST_URL", "http://localhost:8000/")
ROOT = Path(__file__).resolve().parents[2]
# 内部関数を検証用に公開するだけで、処理自体は差し替えない。
SOURCE = (ROOT / "src/game.js").read_text() + """
window.stairsCheck = { dockSpec, dockDescend, renderDock, castField, updateDescendBtn };
"""
SETUP = """async () => {
  const {G, COLS, ROWS} = __game;
  const {sheet} = await import('/src/ui/kit.js');
  sheet.closeAll();
  Object.assign(G, {state:'board', prompt:false, anim:false, walking:false,
    autoMove:false, px:0, py:0, bossDown:false, portalFound:false});
  G.board.cells = Array.from({length:ROWS}, () => Array.from({length:COLS},
    () => ({type:'empty', revealed:false, cleared:true, walls:{n:true,e:true,s:true,w:true}})));
  for (let x=0;x<6;x++) {
    G.board.cells[0][x].walls.e=false;
    G.board.cells[0][x+1].walls.w=false;
  }
  G.board.cells[0][0].revealed=true;
  Object.assign(G.board.cells[0][6], {type:'stairs', cleared:false});
  G.board.fsense={};
  window.revealPath=()=>{for(let x=1;x<6;x++)G.board.cells[0][x].revealed=true;};
  window.drawDock=()=>{stairsCheck.renderDock();stairsCheck.updateDescendBtn();};
  drawDock();
}"""

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
        page.wait_for_function("window.stairsCheck && __game.G.party.length > 0")
        page.evaluate(SETUP)
        page.wait_for_timeout(400)  # 起動時シートの閉じる演出を待つ
        down = page.locator("#hint .dk-down")
        expect(down).to_have_count(0)
        # 本物の道しるべで遠方の階段周囲を公開しても、道はつながらない。
        page.evaluate("""() => {
          const p=__game.G.party[0];
          p.spells.push('BISHOP_MICHISHIRUBE');p.mp=p.maxmp=1000;
          stairsCheck.castField('BISHOP_MICHISHIRUBE',true,p);
          if(!__game.G.board.fsense.stairs)throw Error('道しるべが発動していない');
          drawDock();
        }""")
        expect(down).to_have_count(0)
        # 実際の「ささやく壁」の選択肢から階段を発見する。
        page.evaluate("""() => {
          const {G,ev:{EVENT_MAP,evApi}}=__game;
          const c=G.board.cells[0][0];c.type='event';c.cleared=false;c.evId='c03';
          EVENT_MAP.c03.choices(evApi,c).find(Boolean).fn();drawDock();
        }""")
        expect(down).to_be_disabled()
        assert "道がつながっていない" in down.get_attribute("aria-label")
        for width in [390, 1280]:
            page.set_viewport_size({"width": width, "height": 844})
            expect(down).to_be_disabled()
            assert down.evaluate("b=>getComputedStyle(b).animationName") == "none"
            assert float(down.evaluate("b=>getComputedStyle(b).opacity")) < 1
        page.set_viewport_size({"width": 390, "height": 844})
        before = page.evaluate("[__game.G.floor,__game.G.px,__game.G.py,__game.G.state]")
        down.evaluate("b=>b.click()")
        page.evaluate("stairsCheck.dockDescend()")
        assert page.evaluate("[__game.G.floor,__game.G.px,__game.G.py,__game.G.state]") == before
        # 札をめくって経路をつなぐと同じボタンが有効になる。
        page.evaluate("revealPath();drawDock()")
        expect(down).to_be_enabled()
        # 公開済みの経路でも壁で遮られていれば不可。古い有効ボタンも実行時に防ぐ。
        page.evaluate("__game.G.board.cells[0][2].walls.e=true;__game.G.board.cells[0][3].walls.w=true")
        down.evaluate("b=>b.click()")
        assert page.evaluate("__game.G.floor") == before[0]
        page.evaluate("drawDock()")
        expect(down).to_be_disabled()
        # 別の公開経路で迂回できれば有効。
        page.evaluate("""() => {
          const c=__game.G.board.cells;
          for(let x=2;x<=3;x++) {
            c[0][x].walls.s=false;c[1][x].walls.n=false;c[1][x].revealed=true;
          }
          c[1][2].walls.e=false;c[1][3].walls.w=false;drawDock();
        }""")
        expect(down).to_be_enabled()
        # 階段の上では長さ0の経路でも降りられる。
        page.evaluate("__game.G.px=6;drawDock()")
        expect(down).to_be_enabled()
        # 通常の階段は道がつながった後、実際に次の階へ降りられる。
        page.evaluate("window.previousBoard=__game.G.board")
        page.evaluate("__game.G.px=0;drawDock()")
        down.evaluate("b=>b.click()")
        page.wait_for_function("__game.G.floor > " + str(before[0]) + " && __game.G.board !== previousBoard")
        print(("無限迷宮" if infinite else "通常迷宮") + ": 術・イベント・未接続・壁・迂回路・階段上・降下 OK", flush=True)
        if not infinite:
            for kind in ["gate", "boss", "clear"]:
                page.evaluate(SETUP)
                page.evaluate("""kind => {
                  const {G,inf:{DUNGEONS}}=__game;
                  G.dungeonIdx=DUNGEONS.findIndex(d=>!!d.boss===(kind==='boss'));
                  G.floor=kind==='gate'?1:DUNGEONS[G.dungeonIdx].floors;
                  const c=G.board.cells[0][6];c.revealed=true;c.gate=kind==='gate';drawDock();
                }""", kind)
                expect(down).to_be_disabled()
                page.evaluate("stairsCheck.dockDescend()")
                assert page.evaluate("__game.G.state") == "board"
                page.evaluate("revealPath();drawDock()")
                expect(down).to_be_enabled()
                print(kind + ": 未接続なら無効、接続後に有効 OK", flush=True)
        context.close()
    assert not errors, errors
    browser.close()
