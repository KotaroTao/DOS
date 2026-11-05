"""全勲章の手書き・追加段で旧報酬の半減と、実際の受領・重複防止を確認する。"""
import re
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
old=subprocess.check_output(['git','show','baef22e46598e9ff64142dc13a638e084c709d03:src/game.js'],text=True,cwd=root)
old_tier=re.search(r'function achTier\(s, i\) \{.*?\n\}',old,re.S).group().replace('achTier','oldAchTier')
source=(root/'src/game.js').read_text().replace('window.__game = { G,',old_tier+'\nwindow.__game = { achTier, oldAchTier, G,',1)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(service_workers='block')
    page.route('https://**',lambda r:r.abort())
    page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://localhost:8000/?testDungeon=w02&testPlace=town',wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    result=page.evaluate('''async()=>{
      const {game}=await import('/src/ui/ctx.js');
      const {G,ACH_SERIES,achTier,oldAchTier}=__game;
      const check=(ok,msg)=>{if(!ok) throw Error(msg);};
      let total=0; const samples={};
      for(const s of ACH_SERIES) {
        const oldSeries={...s,tiers:[]};
        for(let i=0;i<s.rows().length+(s.more?12:0);i++) {
          const before=oldAchTier(oldSeries,i),after=achTier(s,i);
          if(!before){check(!after,'段の一致');break;}
          total++;
          const red=before.reward.redSoul||0;
          check((after.reward.redSoul||0)===Math.floor(red/2),'赤い魂の半減 '+after.id);
          const expected={...before,reward:{...before.reward},cond:null};
          delete expected.reward.redSoul;
          if(Math.floor(red/2))expected.reward.redSoul=Math.floor(red/2);
          check(after.reward.gold===expected.reward.gold && after.reward.soulPts===expected.reward.soulPts,'金貨・✦Soulは不変 '+after.id);
          check(JSON.stringify({...after,reward:null,cond:null})===JSON.stringify({...expected,reward:null}),'ID・条件値は不変 '+after.id);
          if(red===1 || red===2)samples[red] ||= after;
        }
      }
      check(samples[1]&&samples[2],'旧報酬1個・2個の段');
      G.ach={existingClaim:true};G.redSoul=100;
      for(const [oldRed,sample] of Object.entries(samples)) {
        const a={...sample,cond:()=>true};
        const before=G.redSoul;
        game.claimAchievement(a);
        check(G.redSoul===before+Math.floor(Number(oldRed)/2),'受領時の赤い魂');
        check(G.ach[a.id]&&G.ach.existingClaim,'受領記録');
        game.claimAchievement(a);
        check(G.redSoul===before+Math.floor(Number(oldRed)/2),'二重受領なし');
      }
      return {series:ACH_SERIES.length,tiers:total,red:G.redSoul};
    }''')
    print('全系統の旧報酬比較・金貨/✦Soul/ID不変・実受領・二重受領防止: OK',result)
    browser.close()
