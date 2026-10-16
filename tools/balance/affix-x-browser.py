"""極 (無限迷宮の追加の特性) のうち game.js が読むもの — 浮き足の・語り部の・宝呼びの — をブラウザの本物の処理で確かめる。
先に `python3 -m http.server 8000` を起動しておく。  python3 tools/balance/affix-x-browser.py
"""
import os
from playwright.sync_api import sync_playwright
CHROME = next((c for c in ['/usr/bin/chromium', '/opt/pw-browsers/chromium'] if os.path.exists(c)), None)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = browser.new_context(service_workers='block')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w04&testFloor=3&testPlace=dungeon')
    page.wait_for_function('window.__game?.G.party.length>0 && window.__game.G.board')
    print(page.evaluate('''async()=>{
      const G=__game.G, A=__game.affix;
      const alive=G.party.filter(p=>p.alive);
      const setMisc=(m)=>{for(const p of G.party) p.gearMisc=m?{...m}:null;};
      // 浮き足の: 隊の全員が持ち主なら傷つかずに癒える。持ち主でない者は傷を受ける
      for(const p of alive) p.hp=Math.max(1,Math.floor(p.maxhp*0.5));
      setMisc({floatStep:0.05});
      const before=alive.map(p=>p.hp);
      A.resolveCell({type:'poison'});
      alive.forEach((p,i)=>{ if(!(p.hp>before[i])) throw Error('浮き足: 全員が持ち主なのに癒えない '+p.name); });
      setMisc(null); alive[0].gearMisc={floatStep:0.05};
      const b2=alive.map(p=>p.hp);
      A.resolveCell({type:'poison'});
      if(!(alive[0].hp>b2[0])) throw Error('浮き足: 持ち主が癒えない');
      if(!(alive[1].hp<b2[1])) throw Error('浮き足: 持ち主でない者が傷つかない');
      // 語り部の: 戦闘で入る魂の EXP +10% (隊で重ならない)
      const {soulByUid}=await import('/src/souls.js');
      const uid=alive[0].primary, s=soulByUid(uid);
      const gain=(m)=>{ setMisc(m); const lv=s.level, ex=s.exp; s.level=1; s.exp=0; const cap=s.capBonus; s.capBonus=500; A.distributeBattleSoulExp(30000); const g=s.exp+0; const r={lv:s.level,exp:s.exp}; s.level=lv; s.exp=ex; s.capBonus=cap; return r; };
      const n=gain(null), t=gain({teller:true});
      const total=(r)=>r.lv*1e9+r.exp;
      if(!(total(t)>total(n))) throw Error('語り部: EXP が増えない');
      // 宝呼びの: 宝箱のランク +1 (上限5)
      setMisc(null); const r0=A.battleChestSpec([]).cRank;
      setMisc({treasure:true});
      if(!A.treasureCaller()) throw Error('宝呼び: 持ち主を見つけない');
      setMisc(null);
      if(A.treasureCaller()) throw Error('宝呼び: 持ち主がいないのに効く');
      return '浮き足の・語り部の・宝呼びの OK';
    }'''))
    if errors:
        raise SystemExit('ページのエラー: ' + ' / '.join(errors))
    browser.close()
