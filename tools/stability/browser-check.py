"""本編・無限迷宮の消費、購入、回復待ちを実画面で確認 (localhost:8000)。"""
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03&testPlace=town&testUnlock=infinite')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');
      const {rollStartSouls}=await import('/src/abyss.js');
      const {sheet}=await import('/src/ui/kit.js');
      const G=__game.G, inf=__game.inf, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push(msg);};
      window.stabCheck=check;window.stabOut=out;
      const picks=[],used=new Set();for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];picks.push(k);used.add(k);}
      window.stabPicks=picks;
      check(inf.enterAbyss(picks),'無限迷宮へ入場');
      check(game.stabilityStatus().every(d=>d.value===70),'全6体の入場消費30');
      G.floor=4;inf.descend();check(game.stabilityStatus().every(d=>d.value===70),'4→5階は消費なし');
      inf.descend();check(G.floor===6&&game.stabilityStatus().every(d=>d.value===40),'5→6階で30消費');
      G.floor=10;inf.descend();check(game.stabilityStatus().every(d=>d.value===10),'10→11階で30消費');
      G.floor=15;G.redSoul=500;inf.descend();
      check(G.floor===15&&G.redSoul===500&&G.prompt,'不足時は移動も支払いもしない');
      return out;
    }'''))
    page.get_by_role('button',name='回復を待つ',exact=True).last.click()
    print(page.evaluate('''async()=>{
      const G=__game.G;stabCheck(G.floor===15&&G.redSoul===500&&!G.prompt,'待つと支払わず元の階に残る');
      __game.inf.descend();return stabOut;
    }'''))
    page.get_by_role('button',name='赤い魂120で不足分を購入して進む',exact=True).last.click()
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(G.floor===16&&G.redSoul===380&&game.stabilityStatus().every(d=>d.value===0),'不足120だけ購入して直ちに進行');
      G.floor=20;G.redSoul=0;__game.inf.descend();
      stabCheck(G.floor===20&&G.redSoul===0,'赤い魂不足でも進行・支払いなし');return stabOut;
    }'''))
    assert page.get_by_role('button',name='回復を待つ',exact=True).last.is_visible()
    expect(page.get_by_role('button',name='購入して進む')).to_have_count(0)
    page.get_by_role('button',name='回復を待つ',exact=True).last.click()
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      for(const d of [...G.abyss.home.party,...G.abyss.home.reserve,...(G.stats.inf.stability||[])].filter(Boolean)){d.stabilityAt=Date.now()-30*240000;}
      __game.inf.descend();stabCheck(G.floor===21&&game.stabilityStatus().every(d=>d.value===0),'4分×30の自然回復で購入せず進行');
      const home=G.abyss.home;for(const [k,v] of Object.entries(home))G[k]=v;G.abyss=null;G.state='town';G.prompt=false;
      stabCheck(!__game.inf.enterAbyss(stabPicks),'再入場で安定度はリセットされない');return stabOut;
    }'''))
    page.get_by_role('button',name='回復を待つ',exact=True).last.click()
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      for(const d of G.party){d.alive=true;d.stability=100;d.stabilityAt=Date.now();}
      G.dungeonBriefed=true;G.stabilityBriefed=true;
      const result=game.departNow({idx:__game.world.DUNGEONS.findIndex(d=>d.id==="w03")});stabCheck(result.ok,'本編へ出撃');return stabOut;
    }'''))
    page.wait_for_function('__game.G.state === "board"')
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(game.stabilityStatus().every(d=>d.value===70),'本編も入場時30');
      G.floor=5;__game.inf.descend();stabCheck(game.stabilityStatus().every(d=>d.value===40),'本編も5→6階で30');
      G.floor=9;__game.inf.descend({skip:1});stabCheck(G.floor===11&&game.stabilityStatus().every(d=>d.value===10),'2階進む出来事も区切りで30');
      G.floor=14;__game.inf.descend({skip:1});stabCheck(G.floor===14,'不足時は出来事でも階を書き換えない');return stabOut;
    }'''))
    assert not errors,errors
    browser.close()
