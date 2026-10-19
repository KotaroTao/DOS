"""付呪の写し取り・書き込み・上書き確認/低下警告・消去・保存を実処理で検証 (localhost:8000)。"""
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
      check(Math.abs(tc.afx[0].v-Math.min(pg.r,X.affixRange(pg.k,tc)[1])*X.afxBase(tc))<0.01,'値は書く品のランクとレア度上限で出し直す');
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
      check(/同じ特性/.test(X.enchantBlock(tl,same2,'lr')||'x')===false,'別の品には同じ術も書ける');
      tl.afx=[{k:'A05',v:5}];X.applyAffixes(tl);
      check(!X.enchantBlock(tl,same2,'lr'),'同じ品の同じ特性は上書きできる');
      check(/部位/.test(X.enchantBlock(tl,{k:'J10',v:1},'lr')),'一番手は武器に書けない');
      const acc=mk(Object.values(ITEMS).find(x=>x.rar==='lr'&&x.slot==='acc').id);
      acc.afx=[{k:'J11',v:0.1}];X.applyAffixes(acc);
      check(/極は1つ/.test(X.enchantBlock(acc,{k:'J02',v:0.3},'lr')),'極は1つの品に1つまで');
      acc.afx=[{k:'J14',v:0.1}];X.applyAffixes(acc);
      check(/発動/.test(X.enchantBlock(acc,{k:'J11',v:0.1},'lr')),'発動する特性は1つの品に1つまで');
      // 能力値の合計にかかわらず、枠が空いていれば書ける
      const capT=mk(byRar('r','body').id);
      const big=['B01','B04','B12'].map(k=>({k,r:X.affixRange(k,capT)[1]}));
      capT.afx=[];for(const b of big.slice(0,2)){capT.afx.push({k:b.k,v:X.pageValue(b,capT)});}X.applyAffixes(capT);
      check(!X.enchantBlock(capT,big[2],'r'),'レアの最大3枠を各上限値で埋められる');
      check(!X.enchantBlock(capT,{k:'I12',v:0.06},'r'),'割合の術も空き枠に書ける');
      capT.afx[0].v=1e9;
      check(!X.enchantBlock(capT,big[2],'r'),'既存能力値の合計が大きくても空き枠へ書ける');
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
      check(Array.isArray(snap.afxPages)&&snap.afxPages.length===game.afxPagesState().length,'特性の巻物を保存する');
      // 極の出やすさ
      let x=0,n=0;const t=ITEMS[byRar('c','acc').id];for(let i=0;i<4000;i++){const a=X.rollAffixes(game.cloneItem(t.id,50),150);if(a){n++;if(a.some(o=>X.afxDef(o.k).tier==='x'))x++;}}
      check(x/n<0.03,`150階の装飾に極が付く割合 ${(x/n*100).toFixed(2)}% (3%未満)`);
      return out;
    }''')))
    page.evaluate('''async()=>{const {UI}=await import('/src/ui/ctx.js');UI.openShop('enchant');}''')
    page.wait_for_timeout(300)
    text = page.inner_text('body').replace('​', '')
    assert '付呪' in text and '特性の巻物' in text and '特性の付いた品' in text, text[:500]
    page.evaluate('''()=>{const b=[...document.querySelectorAll('.ec-prow .wpc-buy-main')][0];if(!b)throw Error('書き込むボタンが無い');b.click();}''')
    page.wait_for_timeout(300)
    text = page.inner_text('body').replace('​', '')
    assert '書き込める品' in text, text[:500]
    assert '容量' not in text and '能力値 ' not in text, '廃止した容量表示が残っている'
    if os.environ.get('SHOT'): page.screenshot(path=os.environ['SHOT'])
    print('商会の「付呪」の区分と書き込み先の一覧 OK')
    # 実画面で、満杯の装備への上書き・取消・低下警告・保存を確認する。
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'),{sheet}=await import('/src/ui/kit.js');
      const X=await import('/src/infaffix.js'),{ITEMS,itemAtQuality}=await import('/src/items.js');
      sheet.closeAll();
      const G=__game.G;
      const tmpl=Object.values(ITEMS).find(it=>it.rar==='c'&&it.slot==='weapon'&&it.lv>=100&&!it.cursed&&it.price>0);
      const it=itemAtQuality({...tmpl,q:50,afx:[{k:'A03',v:X.afxBase(tmpl)*.2}]});
      G.inventory.length=0;G.inventory.push(it);G.afxPages=[];G.gold=1e9;
      for(const d of [...G.party,...G.reserve])d.equip={};
      const pg={k:'A03',r:.25};G.afxPages.push(pg);
      const info=game.enchantInfo(it,pg);
      if(info.why||!info.overwrite||info.lower)throw Error('満杯の品の上書き情報');
      // 上書きには確認済みの内容が必要。未確認・変更後の確認は受け付けない。
      if(game.writeAffix(it,pg))throw Error('確認なしで上書きされた');
      pg.r=.24;
      if(game.writeAffix(it,pg,info.confirmation))throw Error('変更前の確認で上書きされた');
      pg.r=.25;
      window.overwriteTest={it,pg,gold:G.gold,afx:JSON.stringify(it.afx),info:game.enchantInfo(it,pg)};
      UI.openShop('enchant');
    }''')

    def open_overwrite():
        page.locator('.ec-prow .wpc-buy-main').first.click()
        page.locator('.ec-write').filter(has_text='上書きする').first.click()
        dialog = page.locator('.ui-confirm').last
        dialog.wait_for(state='visible')
        text = dialog.inner_text().replace('​', '')
        assert '上書きしますか？' in text and '変更前:' in text and '変更後:' in text, text
        return dialog, text

    dialog, text = open_overwrite()
    assert '低下します' not in text, text
    dialog.get_by_role('button', name='やめる', exact=True).click()
    assert page.evaluate('''()=>{const t=overwriteTest,G=__game.G;return G.gold===t.gold&&G.afxPages.includes(t.pg)&&JSON.stringify(t.it.afx)===t.afx}'''), '取消で資源・特性が変化'
    # 再確認して強い巻物を承認。
    page.locator('.ec-write').filter(has_text='上書きする').first.click()
    page.locator('.ui-confirm').last.get_by_role('button', name='上書きする', exact=True).click()
    page.wait_for_function('!__game.G.afxPages.includes(overwriteTest.pg)')
    assert page.evaluate('''()=>{const t=overwriteTest,G=__game.G;return t.it.afx.length===1&&t.it.afx[0].v>JSON.parse(t.afx)[0].v&&G.gold===t.gold-t.info.cost}'''), '上書きの置換・消費'
    print('OK 満杯のコモンへの上書き確認・取消で消費なし・承認で巻物と金貨を1回だけ消費')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const t=overwriteTest;t.pg={k:'A03',r:.15};__game.G.afxPages.push(t.pg);
      __game.G.party[0].equip.weapon=t.it;__game.inf.recalcAllDolls();t.atk=__game.G.party[0].atk;
      t.gold=__game.G.gold;t.afx=JSON.stringify(t.it.afx);t.info=game.enchantInfo(t.it,t.pg);
      if(!t.info.lower)throw Error('能力低下の判定がない');
      UI.openShop('enchant');
    }''')
    dialog, text = open_overwrite()
    assert '上書きすると能力・効果が低下します' in text, text
    assert dialog.locator('.k-danger').count() > 0, '低下時の確認ボタンを警告色にする'
    page.wait_for_timeout(400)  # 確認画面の開く演出が終わってから見本を撮る。
    if os.environ.get('SHOT'): page.screenshot(path=os.environ['SHOT'])
    dialog.get_by_role('button', name='上書きする', exact=True).click()
    page.wait_for_function('!__game.G.afxPages.includes(overwriteTest.pg)')
    assert page.evaluate('''async()=>{
      const {refDeserialize}=await import('/src/savegraph.js');
      const t=overwriteTest,G=__game.G,snap=refDeserialize(JSON.parse(__game.inf.saveJSON()));
      const saved=snap.inventory.find(it=>it.id===t.it.id);
      return t.it.afx.length===1&&t.it.afx[0].v<JSON.parse(t.afx)[0].v&&G.party[0].atk<t.atk&&G.gold===t.gold-t.info.cost&&JSON.stringify(saved.afx)===JSON.stringify(t.it.afx);
    }'''), '低下の承認・保存'
    print('OK 能力低下の警告・承認した低下の反映・上書きした特性の保存')
    page.evaluate('''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js'),{sheet}=await import('/src/ui/kit.js');
      const {ITEMS,itemAtQuality}=await import('/src/items.js'),X=await import('/src/infaffix.js');
      const G=__game.G;sheet.closeAll();
      for(const d of [...G.party,...G.reserve])d.equip={};
      const tmpl=Object.values(ITEMS).find(it=>it.slot==='weapon'&&it.rar==='lr'&&it.onHit&&!it.cursed);
      if(!tmpl)throw Error('固有の追加効果を持つ武器がない');
      const it=itemAtQuality({...tmpl,q:50,afx:[]});G.inventory.length=0;G.inventory.push(it);G.afxPages=[];G.gold=1e9;
      for(const k of ['F01','F02','F03','F04']){
        const pg={k,v:X.affixRange(k,it)[1],rar:'lr'};G.afxPages.push(pg);
        if(!game.writeAffix(it,pg))throw Error('複数状態異常の書き込みに失敗 '+k);
      }
      const pg={k:'F05',v:X.affixRange('F05',it)[1],rar:'lr'};G.afxPages.push(pg);
      window.statusTest={it,pg};UI.openShop('enchant');
    }''')
    page.locator('.ec-prow .wpc-buy-main').first.click()
    page.locator('.ec-write').first.click()
    page.locator('.ui-confirm').last.get_by_role('button', name='書き込む', exact=True).click()
    page.wait_for_function('statusTest.it.afx.length===5')
    snapshot = page.evaluate('''async()=>{
      const {itemDetailEl,equipPreviewDelta}=await import('/src/ui/itemview.js');
      const {makeDoll}=await import('/src/souls.js');
      const {onHitEffects}=await import('/src/resistance.js');
      const {sheet}=await import('/src/ui/kit.js');
      const {it}=statusTest;
      if(onHitEffects(it.onHit).length!==5)throw Error('5種類が反映されない');
      if(equipPreviewDelta(makeDoll('比較'),it).onHit.to.length!==5)throw Error('装備比較から追加効果が欠落');
      sheet.closeAll();document.body.appendChild(itemDetailEl(it));
      for(const name of ['毒','麻痺','眠り','混乱','魅了'])if(!document.body.textContent.includes(name))throw Error('品の詳細にない '+name);
      return {raw:__game.inf.saveJSON(),id:it.id,effects:JSON.stringify(onHitEffects(it.onHit))};
    }''')
    page.evaluate('(raw)=>localStorage.setItem("dos-save-v7",raw)', snapshot['raw'])
    page.goto('http://localhost:8000/', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.loadGame')
    assert page.evaluate('''async expected=>{
      const {onHitEffects}=await import('/src/resistance.js');
      if(!__game.loadGame())throw Error('通常の保存読込に失敗');
      const it=__game.G.inventory.find(it=>it.id===expected.id&&it.afx?.length===5);
      return it&&JSON.stringify(onHitEffects(it.onHit))===expected.effects;
    }''', snapshot), '通常の読込で5種類の追加効果を保持'
    print('OK 固有の追加効果を持つ武器への5種類の付呪・実画面の5枠目・品の詳細/装備比較・通常の保存読込')
    assert not errors, errors
    browser.close()
