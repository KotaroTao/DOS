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
      check(game.stabilityPerRed()===5&&game.stabilityCost(6)===2,'赤い魂1で安定度5、端数は切り上げ');
      const doll=G.party[0];doll.stability=90;doll.stabilityAt=Date.now();G.redSoul=1;
      let restored=game.restoreStability(doll,10);
      check(restored.ok&&restored.n===5&&restored.cost===1&&doll.stability===95&&G.redSoul===0,'館の回復は所持1個で5まで');
      G.redSoul=1;doll.stability=98;doll.stabilityAt=Date.now();restored=game.restoreStability(doll,10);
      check(restored.ok&&restored.n===2&&restored.cost===1&&doll.stability===100&&G.redSoul===0,'上限までの端数回復は1個');
      check(!game.restoreStability(doll,5).ok,'満タンでは赤い魂を消費しない');
      for(const d of G.party){d.stability=100;d.stabilityAt=Date.now();}

      const picks=[],used=new Set();for(let i=0;i<6;i++){const k=rollStartSouls(used)[0];picks.push(k);used.add(k);}
      window.stabPicks=picks;
      check(inf.enterAbyss(picks),'無限迷宮へ入場');
      check(game.stabilityStatus().every(d=>d.value===80),'全6体の入場消費20');
      G.floor=4;inf.descend();check(game.stabilityStatus().every(d=>d.value===80),'4→5階は消費なし');
      inf.descend();check(G.floor===6&&game.stabilityStatus().every(d=>d.value===60),'5→6階で20消費');
      G.floor=10;inf.descend();check(game.stabilityStatus().every(d=>d.value===40),'10→11階で20消費');
      for(const d of [...G.abyss.home.party,...(G.stats.inf.stability||[])].filter(Boolean)){d.stability=10;d.stabilityAt=Date.now();}
      G.floor=15;G.redSoul=500;inf.descend();
      check(G.floor===15&&G.redSoul===500&&G.prompt,'不足時は移動も支払いもしない');
      return out;
    }'''))
    # 連続呼び出しで重なる階移動の演出に左右されず、確認ボタンの処理を検証する。
    page.get_by_role('button',name='回復を待つ',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const G=__game.G;stabCheck(G.floor===15&&G.redSoul===500&&!G.prompt,'待つと支払わず元の階に残る');
      __game.inf.descend();return stabOut;
    }'''))
    page.get_by_role('button',name='赤い魂12で不足分を購入して進む',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(G.floor===16&&G.redSoul===488&&game.stabilityStatus().every(d=>d.value===0),'不足60を赤い魂12で購入して直ちに進行');
      G.floor=20;G.redSoul=0;__game.inf.descend();
      stabCheck(G.floor===20&&G.redSoul===0,'赤い魂不足でも進行・支払いなし');return stabOut;
    }'''))
    assert page.get_by_role('button',name='回復を待つ',exact=True).last.is_visible()
    expect(page.get_by_role('button',name='購入して進む')).to_have_count(0)
    page.get_by_role('button',name='回復を待つ',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      for(const d of [...G.abyss.home.party,...G.abyss.home.reserve,...(G.stats.inf.stability||[])].filter(Boolean)){d.stabilityAt=Date.now()-20*240000;}
      __game.inf.descend();stabCheck(G.floor===21&&game.stabilityStatus().every(d=>d.value===0),'4分×20の自然回復で購入せず進行');
      const home=G.abyss.home;for(const [k,v] of Object.entries(home))G[k]=v;G.abyss=null;G.state='town';G.prompt=false;
      stabCheck(!__game.inf.enterAbyss(stabPicks),'再入場で安定度はリセットされない');return stabOut;
    }'''))
    page.get_by_role('button',name='回復を待つ',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      for(const d of G.party){d.alive=true;d.stability=100;d.stabilityAt=Date.now();}
      G.dungeonBriefed=true;G.stabilityBriefed=true;
      const result=game.departNow({idx:__game.world.DUNGEONS.findIndex(d=>d.id==="w03")});stabCheck(result.ok,'本編へ出撃');return stabOut;
    }'''))
    page.wait_for_function('__game.G.state === "board"')
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(game.stabilityStatus().every(d=>d.value===80),'本編も入場時20');
      G.floor=5;__game.inf.descend();stabCheck(game.stabilityStatus().every(d=>d.value===60),'本編も5→6階で20');
      G.floor=9;__game.inf.descend({skip:1});stabCheck(G.floor===11&&game.stabilityStatus().every(d=>d.value===40),'2階進む出来事も区切りで20');
      for(const d of G.party){d.stability=10;d.stabilityAt=Date.now();}
      G.floor=14;__game.inf.descend({skip:1});stabCheck(G.floor===14,'不足時は出来事でも階を書き換えない');return stabOut;
    }'''))

    page.get_by_role('button',name='回復を待つ',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const G=__game.G;
      for(const d of G.party){d.stability=20;d.stabilityAt=Date.now();}
      G.party[0].stability=19;G.party[1].stability=19;G.floor=15;G.redSoul=1;
      __game.inf.descend();stabCheck(G.floor===15&&G.prompt,'不足2の購入を確認');return stabOut;
    }'''))
    page.get_by_role('button',name='赤い魂1で不足分を購入して進む',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(G.floor===16&&G.redSoul===0&&game.stabilityStatus().every(d=>d.value===0),'隊全員の端数を合算し不足2を赤い魂1で購入');
      for(const d of G.party){d.stability=20;d.stabilityAt=Date.now();}
      G.party[0].stability=14;G.floor=20;G.redSoul=2;__game.inf.descend();
      G.party[0].stabilityAt=Date.now()-240000;return stabOut;
    }'''))
    page.get_by_role('button',name='赤い魂2で不足分を購入して進む',exact=True).last.evaluate("b=>b.click()")
    print(page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');const G=__game.G;
      stabCheck(G.floor===21&&G.redSoul===1&&game.stabilityStatus().every(d=>d.value===0),'確認中の自然回復を差し引き不足5を赤い魂1で購入');return stabOut;
    }'''))
    assert not errors,errors
    browser.close()
