"""酒場と噂の統合・無料表示・帰還更新の回帰確認。localhost:8000で実行。"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8000/?testDungeon=w05&testPlace=town')
 page.wait_for_function('window.__game?.G.party.length > 0')
 print(page.evaluate('''async()=>{
 const {game,UI}=await import('/src/ui/ctx.js');
 const G=__game.G, checks=[];
 const check=(v,m)=>{if(!v)throw Error(m);checks.push(m)};
 G.testUnlock=[];G.world.reported={w01:1,w02:1,w03:1};
 check(!game.featureUnlocked('tavern')&&!game.featureUnlocked('rumor'),'3か所では酒場・噂とも閉鎖');
 G.world.reported.ws1=1;
 check(!game.featureUnlocked('tavern'),'寄り道の報告は数えない');
 G.world.reported.w04=1;
 check(game.featureUnlocked('tavern')&&game.featureUnlocked('rumor'),'本筋4か所で同時解放');
 G.gold=0;G.rumor=null;G.rumorCooldown=Date.now()+99999999;
 G.tut={done:{tavern:true,rumor:true}};
 UI.openTavern('board');await new Promise(r=>setTimeout(r,100));
 check(!!G.rumor&&!!document.querySelector('.fc-rumor'),'旧セーブの待ち時間・金貨ゼロでも自動表示');
 check(!document.querySelector('.fc-rumor-btn'),'購入ボタンなし');
 const rumor=G.rumor;
 UI.openTavern('talk');await new Promise(r=>setTimeout(r,100));
 check(G.rumor===rumor&&!!document.querySelector('.fc-rumor'),'噂話タブでも同じ噂を表示');
 UI.openTavern('board');__game.renderTown();await new Promise(r=>setTimeout(r,100));
 check(G.rumor===rumor&&G.gold===0,'再入場・再描画で引き直し・課金なし');
 G.activeRumor={...rumor};G.run=null;
 __game.inf.returnToTown({run:null});
 check(!!G.rumor&&G.rumor!==rumor&&!G.activeRumor,'空戻りでも噂を更新し適用済みの噂を消去');
 const next=G.rumor;
 __game.inf.returnToTown({run:null,outcome:'wipe'});
 check(G.rumor!==next,'全滅帰還でも更新');
 const save=__game.inf.saveJSON();
 check(!save.includes('rumorCooldown'),'廃止した待ち時間を保存しない');
 return checks;
 }'''))
 assert not errors,errors
 b.close()
