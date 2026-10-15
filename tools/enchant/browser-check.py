"""付呪 (第十一章の結び) の写し取り・書き込み・消す・容量と数の決まり・保存・商会の画面を実処理で検証 (localhost:8000)。"""
import os
from playwright.sync_api import sync_playwright

CHROME = next((c for c in ['/usr/bin/chromium', '/opt/pw-browsers/chromium'] if os.path.exists(c)), None)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town&testUnlock=enchant')
    page.wait_for_function('window.__game?.G.party.length > 0')
    print('\n'.join(page.evaluate('''async () => {
      const {game}=await import('/src/ui/ctx.js');
      const {ITEMS}=await import('/src/items.js');
      const X=await import('/src/infaffix.js');
      const {refDeserialize}=await import('/src/savegraph.js');
      const G=__game.G, out=[];
      const check=(ok,msg)=>{if(!ok)throw Error(msg);out.push('OK '+msg);};
      G.gold=1e9;
      const mk=(id,afx)=>{const it=game.cloneItem(id,50);if(afx){it.afx=afx;X.applyAffixes(it);}return it;};
      const byRar=(rar,slot)=>Object.values(ITEMS).find(x=>x.rar===rar&&x.slot===slot&&!x.cursed&&x.price>0&&x.lv>=100&&!x.eAtk&&!x.onHit);
      check(game.featureUnlocked('enchant'),'付呪が開いている');
      check(!game.enchantClosed(),'街の商会で使える');
      // 写し取る
      const srcId=byRar('c','weapon').id;
      const src=mk(srcId,[{k:'A03',v:X.afxBase(ITEMS[srcId])*0.2},{k:'I01',v:0.12}]);
      G.inventory.push(src);
      const s=game.enchantSources().find(x=>x.it===src);
      check(!!s&&!s.key&&!s.shelf,'袋の追加つきの品が写し取る一覧に出る');
      const nPages=game.afxPagesState().length;
      const pg=game.extractAffix(s,0);
      check(pg&&pg.k==='A03'&&pg.r>0.19&&pg.r<0.21,'能力値の術は割合で頁になる');
      check(!G.inventory.includes(src),'写し取った品は消える');
      check(game.afxPagesState().length===nPages+1,'頁が増える');
      // 装備中の品は写し取れない
      const d=G.party[0];
      const eqId=Object.values(ITEMS).filter(x=>x.slot==='acc'&&!x.cursed&&x.price>0&&!x.forJob&&!x.classes).sort((a,b)=>a.lv-b.lv)[0].id;
      if(!d.equip.acc1){const a0=game.cloneItem(eqId,50);G.inventory.push(a0);const r0=game.equipAt(d,a0,'acc1');if(!d.equip.acc1)throw Error('装備できない '+eqId+' '+JSON.stringify(r0));}
      const eq=d.equip.acc1;
      check(!!eq,'装備中の品を用意');
      if(eq){eq.afx=[{k:'A04',v:3}];X.applyAffixes(eq);const se=game.enchantSources().find(x=>x.it===eq);check(!!game.extractBlock(se),'装備中の品は写し取れない');}
      // 書き込む: コモン = 1枠
      const tc=mk(byRar('c','weapon').id);G.inventory.push(tc);
      const tu=mk(byRar('uc','weapon').id);G.inventory.push(tu);
      const lrW=Object.values(ITEMS).find(x=>x.rar==='lr'&&x.slot==='weapon'&&!x.eAtk&&!x.onHit&&!x.cursed);
      const tl=mk(lrW.id);G.inventory.push(tl);
      check(X.enchantRoom(tc,'c').slots===1&&X.enchantRoom(tu,'uc').slots===2&&X.enchantRoom(tl,'lr').slots===5,'書ける数はレア度で 1/2/5');
      const g0=G.gold, cost=game.enchantInfo(tc,pg).cost;
      check(cost>=100,'費用は最低100');
      check(game.writeAffix(tc,pg)&&tc.afx.length===1&&G.gold===g0-cost,'書き込むと金貨が減り、品に術が付く');
      check(Math.abs(tc.afx[0].v-pg.r*X.afxBase(tc))<0.01,'値は書く品のランクで出し直す');
      check(!game.afxPagesState().includes(pg),'頁は使い切り');
      check(tc.afxPre==='力の','名の前置きが付く');
      const pg2={k:'A05',v:5};pg2.r=0.2;delete pg2.v;game.afxPagesState().push(pg2);
      check(/いっぱい/.test(game.enchantInfo(tc,pg2).why),'コモンには2つ目を書けない');
      // 同じ種類・部位・極・発動の決まり
      const same={k:'A03',r:0.2};game.afxPagesState().push(same);
      check(!game.enchantInfo(tu,pg2).why,'アンコモンには書ける');
      game.writeAffix(tu,pg2);
      game.writeAffix(tu,same);
      check(tu.afx.length===2,'アンコモンに2つ書ける');
      const same2={k:'A05',r:0.2};
      check(/同じ術/.test(X.enchantBlock(tl,same2,'lr')||'x')===false,'別の品には同じ術も書ける');
      tl.afx=[{k:'A05',v:5}];X.applyAffixes(tl);
      check(/同じ術/.test(X.enchantBlock(tl,same2,'lr')),'同じ品に同じ種類は書けない');
      check(/部位/.test(X.enchantBlock(tl,{k:'J10',v:1},'lr')),'一番手は武器に書けない');
      const acc=mk(Object.values(ITEMS).find(x=>x.rar==='lr'&&x.slot==='acc').id);
      acc.afx=[{k:'J11',v:0.1}];X.applyAffixes(acc);
      check(/極は1つ/.test(X.enchantBlock(acc,{k:'J02',v:0.3},'lr')),'極は1つの品に1つまで');
      acc.afx=[{k:'J14',v:0.1}];X.applyAffixes(acc);
      check(/発動/.test(X.enchantBlock(acc,{k:'J11',v:0.1},'lr')),'発動する特性は1つの品に1つまで');
      // 容量: 能力値の術の合計
      const capT=mk(byRar('r','body').id);
      const big=[{k:'B01',r:0.35},{k:'B04',r:0.35},{k:'B12',r:0.35}];
      capT.afx=[];for(const b of big.slice(0,2)){capT.afx.push({k:b.k,v:X.pageValue(b,capT)});}X.applyAffixes(capT);
      check(/容量/.test(X.enchantBlock(capT,big[2],'r')),'レアの容量 0.75 を超える能力値の術は書けない');
      check(!X.enchantBlock(capT,{k:'I12',v:0.06},'r'),'割合の術は容量に数えない');
      // 消す
      check(game.eraseAffix(tu,0)&&tu.afx.length===1,'術を消せる');
      check(game.eraseAffix(tu,0)&&!tu.afx&&!tu.afxPre,'全部消すと名の前置きも外れる');
      // 棚の品から写す
      const shelfId=byRar('uc','head').id;G.shopStock[shelfId]=(G.shopStock[shelfId]||0)+1;
      G.shopAfx[shelfId]=[{k:'E01',v:10}];
      const ss=game.enchantSources().find(x=>x.shelf&&x.it.id===shelfId);
      const st0=G.shopStock[shelfId],g1=G.gold,bp=game.buyPrice(ss.it);
      check(!!game.extractAffix(ss,0)&&G.shopStock[shelfId]===st0-1&&!G.shopAfx[shelfId]&&G.gold===g1-bp,'棚の品は買値を払って写し、棚の組は消える');
      // 装備中の品に書くと能力が変わる
      if(eq){eq.afx=[];X.applyAffixes(eq);delete eq.afx;const before=d.atk;game.recalcAllDolls&&0;const p3={k:'A03',r:0.25};game.afxPagesState().push(p3);const ok=game.writeAffix(eq,p3);check(ok&&d.atk>before,'装備中の品に書くと人業の能力が上がる');}
      // 売っても儲からない
      const t5=mk(byRar('sr','weapon').id);G.inventory.push(t5);const p5={k:'B01',r:0.35};
      const inf5=game.enchantInfo(t5,p5);const sp0=game.sellPrice(t5);game.afxPagesState().push(p5);game.writeAffix(t5,p5);
      check(game.sellPrice(t5)-sp0<inf5.cost,'書き込みの費用は売値の上がり分より高い');
      // 保存
      const snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      check(Array.isArray(snap.afxPages)&&snap.afxPages.length===game.afxPagesState().length,'術の頁を保存する');
      // 極の出やすさ
      let x=0,n=0;const t=ITEMS[byRar('c','acc').id];for(let i=0;i<4000;i++){const a=X.rollAffixes(game.cloneItem(t.id,50),150);if(a){n++;if(a.some(o=>X.afxDef(o.k).tier==='x'))x++;}}
      check(x/n<0.03,`150階の装飾に極が付く割合 ${(x/n*100).toFixed(2)}% (3%未満)`);
      return out;
    }''')))
    page.evaluate('''async()=>{const {UI}=await import('/src/ui/ctx.js');UI.openShop('enchant');}''')
    page.wait_for_timeout(300)
    text = page.inner_text('body').replace('​', '')
    assert '付呪' in text and '術の頁' in text and '術の付いた品' in text, text[:500]
    page.evaluate('''()=>{const b=[...document.querySelectorAll('.ec-prow .wpc-buy-main')][0];if(!b)throw Error('書き込むボタンが無い');b.click();}''')
    page.wait_for_timeout(300)
    text = page.inner_text('body').replace('​', '')
    assert '書き込める品' in text, text[:500]
    if os.environ.get('SHOT'): page.screenshot(path=os.environ['SHOT'])
    print('商会の「付呪」の区分と書き込み先の一覧 OK')
    assert not errors, errors
    browser.close()
