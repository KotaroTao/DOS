"""保存編成の実操作、売却/破棄保護、保存往復、狭い画面を確認。localhost:8000。"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(844,390)]:
        page=browser.new_page(viewport={'width':width,'height':height}, service_workers='block')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length === 6')
        page.evaluate('''async()=>{
            const {UI,game}=await import('/src/ui/ctx.js');
            window.api=game; const g=game.G;
            g.irene.greeted=true;g.tut.cur=null;
            g.tut.done.prologueFormation=true;g.tut.done.soulChange=true;
            g.party[0].equip.weapon=__game.equipLv.cloneItem("dagger");
            UI.enterMansion();
            window.savedOrder=g.party.map(d=>d.uid);
            window.equipment=g.party.flatMap(d=>Object.values(d.equip)).filter(Boolean);
        }''')
        page.locator('.pt-mansion-manage').click()
        screen=page.locator('.pt-formation-sheet')
        assert screen.get_by_text('保存編成',exact=True).is_visible()
        assert screen.locator('.pt-preset').count()==10
        screen.locator('[data-formation="0"]').get_by_role('button',name='現在の編成を保存',exact=True).click()
        page.wait_for_function('api.G.formations[0]')
        slot=screen.locator('[data-formation="0"]')
        slot.get_by_role('button',name='名前変更',exact=True).click()
        page.locator('.pt-preset-name input').fill('火の迷宮対策')
        page.get_by_role('button',name='変更する',exact=True).click()
        page.wait_for_function('api.G.formations[0].name === "火の迷宮対策"')
        assert page.evaluate('equipment.every(it=>it.formationNames.includes("火の迷宮対策"))')
        # 実際に並べ替えてから、内容確認→適用で元の並びへ。
        cards=screen.locator('button.pt-formation-card')
        cards.first.click();cards.last.click()
        assert page.evaluate('api.G.party[0].uid !== savedOrder[0]')
        slot.get_by_role('button',name='確認・適用',exact=True).click()
        preview=page.locator('.pt-preset-preview')
        assert preview.locator('.pt-preset-detail').count()==6
        preview.get_by_role('button',name='適用',exact=True).click()
        page.wait_for_function('api.G.party.every((d,i)=>d.uid===savedOrder[i])')
        assert screen.locator('.ui-sheet-body').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        screen.get_by_role('button',name='閉じる',exact=True).click()
        page.evaluate('''async()=>{ const {UI}=await import('/src/ui/ctx.js');UI.openDeparture(); }''')
        page.locator('.dp-swap').click()
        screen.wait_for(state='visible')
        assert screen.locator('.pt-preset').count()==10
        screen.get_by_role('button',name='閉じる',exact=True).click()
        # 満杯でも登録装備を外せる。保護を直接窓口と一括売却で確認。
        result=page.evaluate('''async()=>{
            const {bagCount}=await import('/src/items.js');
            const {UI,ops}=await import('/src/ui/ctx.js');
            const g=api.G,d=g.party[0],k=Object.keys(d.equip).find(k=>d.equip[k]&&!d.equip[k].cursed&&!d.equip[k].locked),it=d.equip[k];
            window.registeredItem=it;
            while(bagCount(g.inventory)<50)g.inventory.push(__game.equipLv.cloneItem('herb'));
            const result=api.doUnequip(d,k); if(!result.ok)throw Error('満杯でも登録装備を外せる '+JSON.stringify({result,k,it,gear:d.equip}));
            const n=g.inventory.length,gold=g.gold;
            if(api.sellItem(d,it,999))throw Error('売却された');
            if(api.dropFromBag(d,it))throw Error('破棄された');
            if(ops.junkList({includeUse:true}).some(x=>x.item===it))throw Error('一括売却候補に入った');
            if(g.gold!==gold||g.inventory.length!==n)throw Error('保護失敗');
            const original=g.formations[0];
            const fail=api.saveFormation(0,null,true);
            if(fail.ok||g.formations[0]!==original||!fail.msg.includes('1枠'))throw Error('満杯時に削除された');
            UI.itemSheet(it,{owner:d,context:'bag'});
            return {count:bagCount(g.inventory),all:g.inventory.length};
        }''')
        assert result['count']==50 and result['all']>50
        assert page.get_by_text('保存先：火の迷宮対策',exact=False).count()>0
        # サーバー/ローカル共通の保存形式に、新規フィールドと共有参照が入る。
        assert page.evaluate('''async()=>{
            const {refDeserialize}=await import('/src/savegraph.js');
            const saved=refDeserialize(JSON.parse(__game.inf.saveJSON()));
            return saved.formations.length===10&&saved.formations[0].name==='火の迷宮対策'
                && saved.formations[0].members.some(m=>Object.values(m.equip).some(it=>it&&saved.inventory.includes(it)));
        }''')
        if width==390:
            page.evaluate("localStorage.setItem('dos-save-v7',__game.inf.saveJSON())")
            page.goto('http://localhost:8000/')
            page.wait_for_function('window.__game')
            assert page.evaluate('''()=>{
                if(!__game.loadGame())return false;
                const g=__game.G,p=g.formations[0];
                return p.name==='火の迷宮対策'&&p.members.some(m=>Object.values(m.equip).some(it=>it&&g.inventory.includes(it)&&it.formationNames.includes(p.name)))&&g.party.every(d=>d.items===g.inventory);
            }''')
        assert not errors,errors
        print(f'{width}×{height}: 保存・改名・確認・適用・50枠除外・売却/破棄保護・削除中止・参照保持 OK',flush=True)
        page.close()
    browser.close()
