"""勝利処理の実経路で修道院より前の職業の魂ドロップを防ぐ。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce'); errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w03')
    page.wait_for_function('window.__game?.G.board')
    print(page.evaluate('''async()=>{
      const {Battle,spawnCardEnemies}=await import('/src/combat.js');
      const {MONSTERS}=await import('/src/sprites.js');
      const {useMathRandom}=await import('/src/rng.js');
      const {sheet}=await import('/src/ui/kit.js');
      const g=__game.G,out=[];
      __game.UI.openDungeonMenu();
      if(document.body.textContent.replaceAll('\\u200b','').includes('出来事の全文'))throw Error('手帳の不要な記録入口');
      sheet.closeAll();
      const key=Object.keys(MONSTERS).find(k=>MONSTERS[k].soulClass);
      for(const id of ['w00_forest','w01','w02','w03','w04']){
        sheet.closeAll();g.prompt=false;g.pendingResults=null;
        g.dungeonIdx=__game.inf.DUNGEONS.findIndex(d=>d.id===id);
        const e=spawnCardEnemies(key,1)[0];
        const b=new Battle(g.party,[e],()=>{});
        e.alive=false;e.hp=0;b.result='win';
        g.state='combat';g.battle=b;g.battleCell={type:'enemy',cleared:false};g.run=null;
        const before=g.souls.reduce((n,s)=>n+(s.count||1),0);
        useMathRandom();const old=Math.random;Math.random=()=>0;
        __game.rematch.endBattle();
        await new Promise(r=>setTimeout(r,1250));Math.random=old;
        const after=g.souls.reduce((n,s)=>n+(s.count||1),0);
        const allowed=id==='w03'||id==='w04';
        if((after>before)!==allowed)throw Error(id+': '+before+' -> '+after);
        if(!g.pendingResults?.soul)throw Error('経験値は得られる: '+id);
        out.push(id+': 職業の魂'+(allowed?'あり':'なし')+'・✦Soulあり');
      }
      return out;
    }'''))
    assert not errors,errors
    browser.close()
