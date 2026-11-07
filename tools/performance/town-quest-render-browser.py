"""街・酒場の依頼一覧の重複生成と、受注枠を変更した直後の表示・操作を検査。"""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox'])
    errors = []
    for width in [390, 1100]:
        page = browser.new_page(viewport={'width': width, 'height': 900}, service_workers='block', reduced_motion='reduce')
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('https://**', lambda r: r.abort())
        page.route('**/src/cloud-config.js', lambda r: r.fulfill(content_type='text/javascript', body='export const CLOUD_CONFIG={enabled:false};'))
        page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
        page.wait_for_function('window.__game?.G.party.length===6&&!document.body.classList.contains("booting")')
        print(page.evaluate('''async()=>{
          const {game,UI}=await import('/src/ui/ctx.js');
          const qb=await import('/src/ui/questboard.js'),{sheet}=await import('/src/ui/kit.js'),{bindRngState}=await import('/src/rng.js');
          const g=game.G;sheet.closeAll();g.irene.greeted=true;g.tut.cur=null;g.gold=99999999;
          g.insightNotified=Number.MAX_SAFE_INTEGER;g.prompt=false;
          const {_TUTS}=await import('/src/ui/tutorial.js');_TUTS.forEach(t=>g.tut.done[t.key]=true);
          g.msq.prologue={phase:'done',gifts:{}};
          // 噂の初回生成による別の描き直しを、1描画の回数に混ぜない。
          g.rumor={speaker:'旅人',text:'街で休むとよい。',info:true};
          UI.openTavern('board');
          const original=game.questLists;let calls=0;
          game.questLists=(...args)=>{calls++;return original(...args);};
          game.renderTown();const tavernCalls=calls;
          if(tavernCalls!==1)throw Error('酒場の一覧生成 '+tavernCalls);
          calls=0;UI.shell.setTab('hub');const hubCalls=calls;
          if(hubCalls!==1)throw Error('街の一覧生成 '+hubCalls);
          const offer=original().offers.find(q=>q.state==='offer'&&q.type!=='deliver');
          if(!offer)throw Error('受注前の依頼がない');
          // 地図は一度だけ正規化し、未解放の依頼を表示しない。互換窓口だけの環境も維持。
          const oldWorld=game.worldState,oldIdx=game.worldOpenIdx;
          let worldReads=0,idxReads=0;
          game.worldState=()=>{worldReads++;return oldWorld();};
          game.worldOpenIdx=(...args)=>{idxReads++;return oldIdx(...args);};
          const groups=qb.dungeonGroups(original().offers);
          if(worldReads!==1||idxReads!==0)throw Error('迷宮の数だけ地図を正規化 '+JSON.stringify({worldReads,idxReads}));
          delete game.worldState;
          const fallback=qb.dungeonGroups(original().offers);
          if(groups.map(x=>x.name).join('|')!==fallback.map(x=>x.name).join('|'))throw Error('地図の互換窓口が異なる');
          game.worldState=oldWorld;game.worldOpenIdx=oldIdx;
          // 未生成の掲示板では、従来の一覧参照と同じ初期化・抽選を行う。
          const savedQuest=structuredClone(g.quest),savedRng=structuredClone(g.rng);
          g.quest.board=null;game.questCapacity();
          const initialized=JSON.stringify({quest:g.quest,rng:g.rng});
          g.quest=structuredClone(savedQuest);g.rng=bindRngState(structuredClone(savedRng));g.quest.board=null;original();
          if(JSON.stringify({quest:g.quest,rng:g.rng})!==initialized)throw Error('受注枠の参照で掲示板の初期化・乱数が変わった');
          g.quest=savedQuest;g.rng=bindRngState(savedRng);
          const savedActive=g.quest.active,savedFixed=g.quest.fixed;
          const active=n=>Array.from({length:n},(_,i)=>({uid:'test-q'+i,type:'soul',name:'試験の依頼',state:'active',reward:{},rk:2}));
          const slotCases=[{n:0,f:{},want:0},{n:6,f:{},want:6},
            {n:1,f:{a:{state:'active'},b:{state:'done'},c:{state:'claimed'}},want:3}];
          for(const c of slotCases){g.quest.active=active(c.n);g.quest.fixed=c.f;
            calls=0;if(game.questCapacity().freeCount!==c.want)throw Error('受注枠の数が異なる');
            const row=qb.questCard(offer),button=row.querySelector('button');
            if(button.classList.contains('k-primary')!==(c.want<game.FREE_CAP))throw Error('受注枠の変更が札に反映されない '+button.className);
            if(calls)throw Error('枠の確認で依頼一覧を生成した');
          }
          const text=node=>node.textContent.replaceAll('\\u200b','');
          for(const n of [0,6]){
            g.quest.active=active(n);g.quest.fixed={};calls=0;
            const h=qb.openQuestSheet(offer.uid),root=h.el;
            const accept=[...root.querySelectorAll('button')].find(b=>text(b).includes('依頼を受ける'));
            if(!accept||accept.disabled!==(n===6)||!text(root).includes(`受注${n} / 6 件`))throw Error('詳細の受注枠表示・操作が異なる '+text(root));
            if(calls)throw Error('詳細の枠確認で一覧を生成した');
            // 開いた後に満杯になっても、クリック時には現在の状態で拒否する。
            if(n===0){g.quest.active=active(6);const rng=JSON.stringify(g.rng);accept.click();
              if(g.quest.active.length!==6||g.quest.fixed[offer.uid]||JSON.stringify(g.rng)!==rng)throw Error('古い受注枠で受け付けた');}
            h.close();
          }
          g.quest.active=savedActive;g.quest.fixed=savedFixed;game.questLists=original;
          return {width:innerWidth,tavernLists:tavernCalls,hubLists:hubCalls,slotCases:slotCases.length,sheetAndClickStateFresh:true,groups:groups.length};
        }'''))
        page.close()
    assert not errors, errors
    browser.close()
