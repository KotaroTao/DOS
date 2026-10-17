"""会心4種と装備効果を、候補・人物選択・詳細比較・最適装備で実表示する。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, service_workers='block', reduced_motion='reduce')
    page.route('https://**/*', lambda r: r.abort())
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:8000/?testDungeon=w45&testPlace=town', wait_until='domcontentloaded')
    page.wait_for_function('window.__game?.G.party.length > 0')
    result = page.evaluate(r'''async()=>{
      const {game,UI}=await import('/src/ui/ctx.js');
      const {sheet,statDelta}=await import('/src/ui/kit.js');
      const {equipPreviewDelta,equipCompareEl,equipEffectDeltaEl,specialParts}=await import('/src/ui/itemview.js');
      const {deltaEl}=await import('/src/ui/loot.js');
      const {equipChooserEl,openCandidates}=await import('/src/ui/party.js');
      const {previewStats,statsDelta,equipSignature}=await import('/src/autoequip.js');
      const {ITEMS,SLOTS,recalc}=await import('/src/items.js');
      const {applyAffixes}=await import('/src/infaffix.js');
      const G=__game.G,out=[],check=(v,t)=>{if(!v)throw Error(t);out.push(t)};
      sheet.closeAll();G.tut={done:{}};G.inventory.length=0;
      for(const d of G.party){for(const k of SLOTS)d.equip[k]=null;recalc(d);}
      const d=G.party[0],old=game.cloneItem('dagger',50),cand=game.cloneItem('dagger',50);
      Object.assign(old,{crit:0,critDamage:0,spellCrit:0,spellCritDamage:0,afx:[{k:'I01',v:.08}]});applyAffixes(old);
      Object.assign(cand,{magic:true,crit:.047,critDamage:.23,spellCrit:.019,spellCritDamage:.17,resists:{physResist:6,magResist:7},aRes:{poison:.10},bRes:.14,eff:{guard:.10,spellCostMul:.8},onHit:{k:'poison',chance:.24,pct:.08},afx:[{k:'I01',v:.30}]});applyAffixes(cand);
      d.equip.weapon=old;recalc(d);G.inventory.push(cand);
      const before=previewStats(d,d.equip),after=previewStats(d,{...d.equip,weapon:cand}),delta=statsDelta(before,after);
      const expected=['会心率+4.7%','会心ダメージ+23%','魔法会心率+1.9%','魔法会心ダメージ+17%'];
      const clean=s=>s.replace(/[▲▼\s\u200b]/g,'');
      for(const [label,node] of [['候補の数値部品',statDelta(delta)],['入手・商会の増減',deltaEl(delta)],['品の比較',equipCompareEl(d,cand)]]){
        for(const text of expected)check(clean(node.textContent).includes(text),label+'：'+text);
      }
      const full=clean(deltaEl(equipPreviewDelta(d,cand)).textContent);
      for(const text of ['物理抵抗値+6','魔法抵抗値+7','ブレス耐性+14%','毒抵抗値+10','24%','被ダメ−10%','消費MP−20%','窮地：','通常攻撃物理→魔法'])check(full.includes(text),'比較の効果：'+text);
      check(!full.includes('変化なし'),'効果が変わる場合に変化なしを出さない');
      const cost= equipEffectDeltaEl({eff:{from:null,to:{spellCostMul:.8}}});
      check(cost.querySelector('.up')?.textContent.includes('20%'),'消費MPの軽減を改善として表示');
      check(specialParts(cand).some(x=>x.includes('30%'))&&specialParts(old).some(x=>x.includes('8%')),'同じ追加特性の効果量を区別');
      const countLoss=clean(equipEffectDeltaEl({traits:{from:['窮地：与ダメ+30%','窮地：与ダメ+30%'],to:['窮地：与ダメ+30%']}}).textContent);
      check(countLoss==='失う窮地：与ダメ+30%','同じ特性を別部位にも持つ場合は減った個数だけ比較');
      const same=deltaEl(statsDelta(before,before));check(same.textContent==='変化なし','同じ能力と効果は差分なし');
      const reverse=deltaEl(statsDelta(after,before));check(reverse.querySelector('.dn')&&clean(reverse.textContent).includes('魔法会心ダメージ-17%'),'失う会心も赤字で表示');
      const sig=equipSignature(G.party),chooser=equipChooserEl(cand,{pool:[d],town:true});document.body.appendChild(chooser);
      for(const text of expected)check(clean(chooser.textContent).includes(text),'装備する人物の選択：'+text);
      chooser.querySelector('.pt-ch-all').click();
      for(const text of expected)check(clean(document.querySelector('.pt-chl-d').textContent).includes(text),'詳細比較：'+text);
      sheet.closeAll();chooser.remove();openCandidates(d,'weapon');
      for(const text of expected)check(clean(document.querySelector('.pt-cand .ui-delta').textContent).includes(text),'装備候補一覧：'+text);
      sheet.closeAll();check(UI.autoEquip(d).ok,'最適装備の確認を開く');
      const summary=clean(document.querySelector('.pt-ae-st').textContent);
      for(const text of [`会心率${Math.round(before.critBonus*1000)/10}→${Math.round(after.critBonus*1000)/10}%`,'会心ダメージ0→23%','魔法会心率0→1.9%','魔法会心ダメージ0→17%','物理抵抗値0→6','魔法抵抗値0→7','消費MP−20%'])check(summary.includes(text),'最適装備の前後：'+text);
      check(equipSignature(G.party)===sig,'比較・確認で装備と袋を変更しない');
      sheet.closeAll();await new Promise(r=>setTimeout(r,650));
      const {openReforge}=await import('/src/ui/reforge.js');
      const roll=game.rollReforge,block=game.reforgeBlock;
      try {
        game.rollReforge=()=>({ok:true,q:100,cost:0});game.reforgeBlock=()=>null;
        for(const [key,label] of [['crit','会心率'],['critDamage','会心ダメージ'],['spellCrit','魔法会心率'],['spellCritDamage','魔法会心ダメージ']]){
          const tmpl=Object.values(ITEMS).find(x=>x[key]>0&&!x.cursed),it=game.cloneItem(tmpl.id,0);G.inventory.push(it);
          openReforge(it,d);document.querySelector('.rf-sheet .ui-sheet-foot .k-primary').click();
          document.querySelector('.rf-forge').click();
          check(clean(document.querySelector('.rf-diff').textContent).includes(label),'鍛え直しの品質比較：'+label);
          sheet.closeAll();await new Promise(r=>setTimeout(r,650));
        }
      } finally {game.rollReforge=roll;game.reforgeBlock=block;}
      UI.autoEquip(d);
      return out;
    }''')
    print('\n'.join('OK ' + s for s in result), flush=True)
    for width in [320, 390, 768]:
        page.set_viewport_size({'width': width, 'height': 844})
        page.wait_for_timeout(100)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}pxで横にはみ出した'
    page.screenshot(path='/tmp/equipment-compare.png')
    assert not errors, errors
    browser.close()
