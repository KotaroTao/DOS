"""既存品・退けた本編・魂の記憶への会心性能の移行と、実画面の100%・倍率を確認。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':390,'height':844},service_workers='block',reduced_motion='reduce')
    page.route('https://**/*',lambda r:r.abort())
    page.set_default_timeout(120000)
    page.add_init_script('window.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),100);window.cancelAnimationFrame=clearTimeout')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=infinite',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length === 6')
    setup=page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js'),{ITEMS,itemAtQuality}=await import('/src/items.js');
      const {CRITICAL_KEYS}=await import('/src/equipmentcrit.js');
      const {G,inf}=__game;
      const templates=CRITICAL_KEYS.map(k=>Object.values(ITEMS).find(it=>it[k]===(k.endsWith('Damage')?1:.2)));
      if(templates.some(x=>!x))throw Error('4種の最高値が見つからない');
      const old=tmpl=>{const it=game.cloneItem(tmpl.id,100);for(const k of CRITICAL_KEYS)delete it[k];it.price=1;return it;};
      G.inventory.length=0;const home=templates.map(old);G.inventory.push(...home);
      if(inf.enterAbyss(['fighter','priest','thief','mage','knight','hunter'])===false)throw Error('出撃失敗');
      const items=templates.map(old);G.inventory.push(...items);
      const memory=old(templates[1]);G.abyssRec.memories={50:{v:1,floor:50,party:[{equip:{weapon:memory}}],souls:[]}};
      const expected=templates.map(it=>{const normal=itemAtQuality({...it,q:100},100);return {id:it.id,price:normal.price,crit:normal.crit||0,critDamage:normal.critDamage||0,spellCrit:normal.spellCrit||0,spellCritDamage:normal.spellCritDamage||0};});
      return {snapshot:inf.saveJSON(),expected};
    }''')
    page.evaluate('(raw)=>localStorage.setItem("dos-save-v7",raw)',setup['snapshot'])
    page.goto('http://localhost:8000/',wait_until='domcontentloaded');page.wait_for_function('window.__game?.loadGame')
    print(page.evaluate('''async expected=>{
      const {G}=__game;if(!__game.loadGame())throw Error('読み込み失敗');
      for(const [label,items] of [['出撃中',G.inventory],['退けた本編',G.abyss.home.inventory]])for(const e of expected){
        const it=items.find(x=>x.id===e.id);if(!it)throw Error(label+' 品が無い');
        for(const k of ['crit','critDamage','spellCrit','spellCritDamage'])if((it[k]||0)!==e[k])throw Error(label+'/'+e.id+'/'+k+': '+it[k]+' / '+e[k]);
        if(it.price!==e.price)throw Error(label+' 価格を更新していない');
      }
      const memory=G.abyssRec.memories[50].party[0].equip.weapon;
      if(memory.critDamage!==1)throw Error('魂の記憶の装備を更新していない');
      const {itemDetailEl}=await import('/src/ui/itemview.js');
      for(const e of expected)document.body.appendChild(itemDetailEl(G.inventory.find(x=>x.id===e.id)));
      const text=document.body.textContent.replaceAll("\u200b", "");
      for(const label of ['会心 +20%','会心ダメージ +100%','魔法会心 +20%','魔法会心ダメージ +100%'])if(!text.includes(label))throw Error('品の表示:'+label);
      if(!__game.loadGame())throw Error('二度目の読み込み失敗');
      if(G.abyss.home.inventory[0].price!==expected[0].price)throw Error('二度目のロードで値段が変化');
      return 'OK 旧装備4種を品質・上限・価格込みで更新：出撃中・本編の退避・魂の記憶・二重読込・品の詳細';
    }''',setup['expected']),flush=True)
    print(page.evaluate('''async()=>{
      const {G}=__game,{Battle}=await import('/src/combat.js'),{peekDoll}=await import('/src/ui/dungeonhud.js');
      const a=G.party[0];a.critBonus=1.6;a.spellCritBonus=1.6;a.critDamageBonus=2.5;a.spellCritDamageBonus=3;
      G.battle=new Battle([a],[],()=>{});G.state='combat';
      const ps=G.battle.peekStats(a);if(ps.crit!==.8||ps.spellCrit!==.8||Math.abs(ps.critMul-6.475)>1e-9||ps.spellCritMul!==6)throw Error('会心100%と倍率');
      peekDoll(a,{combat:true});
      const text=document.body.textContent.replaceAll("\u200b", "");if(!text.includes('魔法会心倍率')||!text.includes('6.475')||!text.includes('80%'))throw Error('戦闘中の様子に会心性能が無い');
      return 'OK 戦闘中の様子：物理/魔法会心80%、物理倍率6.475倍・魔法倍率6倍';
    }'''),flush=True)
    assert not errors,errors
    browser.close()
