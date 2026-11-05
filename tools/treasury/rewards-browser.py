"""褒賞の受領記録・武魂保管・再受領防止を検証。localhost:8000。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(service_workers='block',reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print(page.evaluate('''async()=>{
      const {G,treasury:t}=__game;
      const {ITEMS}=await import('/src/items.js');
      const {sheet}=await import('/src/ui/kit.js');sheet.closeAll();
      G.tut={done:{}};G.pendingTreasury=null;G.bukonStock={};
      G.treasury={donated:Object.fromEntries(Object.values(ITEMS).filter(x=>x.slot==='misc').slice(0,100).map(x=>[x.id,true])),claimed:{m5:true,m10:true,m25:true,m50:true}};
      if(t.milestoneReady(t.TREASURY_MILESTONES.find(m=>m.n===5)))throw Error('受領済みが再配布される');
      if(!t.milestoneReady(t.TREASURY_MILESTONES.find(m=>m.n===35)))throw Error('新設の節目を受領できない');
      t.claimTreasury(45);
      if(G.bukonStock['crit:1']!=='1'||!G.treasury.claimed.m45)throw Error('武魂または受領記録がない');
      t.claimTreasury(45);
      if(G.bukonStock['crit:1']!=='1')throw Error('再開時に二重配布');
      G.pendingTreasury=null;t.claimTreasury(45);
      if(G.bukonStock['crit:1']!=='1')throw Error('受領済みの二重配布');
      return '既存受領記録・新設節目・実受領・演出再開と再受領の重複防止 OK';
    }'''))
    assert not errors,errors
    browser.close()
