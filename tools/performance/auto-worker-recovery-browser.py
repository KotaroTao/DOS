"""実Workerの一時停止後、同じページで作戦・戦闘結果・保存を復元する。"""
import json, os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    engine = os.environ.get('DOS_TEST_BROWSER', 'chromium')
    browser = (p.webkit.launch() if engine == 'webkit' else p.chromium.launch(
        executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'), args=['--no-sandbox']))
    page = browser.new_page(service_workers='block')
    page.goto('http://localhost:8000/tools/performance/')
    result = page.evaluate('''async()=>{
      const check=(ok,message)=>{if(!ok)throw Error(message);};
      const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
      const {refSerialize,refDeserialize}=await import('/src/savegraph.js');
      const {Battle}=await import('/src/combat.js');
      const {makeDoll}=await import('/src/souls.js');
      const {reseedRng,rngState}=await import('/src/rng.js');
      const {battleCommand}=await import('/src/cloud-battle.js');
      const {replayCloudCommand}=await import('/src/cloud-command-replay.js');
      const {decideAuto}=await import('/src/autotactics.js');
      const NativeWorker=Worker,nativeTimeout=setTimeout,nativeNow=Date.now,workers=[];
      let offset=0,shortDeadline=false;
      Date.now=()=>nativeNow()+offset;
      window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,shortDeadline&&[3000,10000].includes(ms)?50:ms,...args);
      window.Worker=class extends NativeWorker {
        constructor(...args){super(...args);workers.push(this);}
        postMessage(...args){if(!this.drop)super.postMessage(...args);}
        terminate(){this.stopped=true;super.terminate();}
        fail(){this.dispatchEvent(new ErrorEvent('error',{cancelable:true,message:'検査用の一時停止'}));}
      };
      reseedRng(7);
      const actor=Object.assign(makeDoll('検査の人業'),{hp:100,maxhp:100,atk:30,vit:10,agi:1000});
      const enemy={uid:9,key:'bs_ghoul',name:'敵',side:'enemy',alive:true,hp:100000,maxhp:100000,atk:10,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
      const battle=new Battle([actor],[enemy],()=>{});
      const state={state:'combat',battle,party:[actor],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:100,soulPts:100,floor:1,dungeonIdx:0};
      const graph=refSerialize(state,{compact:true}),before=JSON.stringify(graph);
      battle.chooseAction('attack');battle.chooseTarget(enemy);
      const command=battleCommand(battle,'commit'),commandId='復帰前後で同じ選択';
      const expected=await replayCloudCommand(graph,command,commandId);
      const codec=await import('/src/save-codec.js');
      const replay=()=>codec.replayCloudCommandPrepared(graph,command,commandId);
      check(same(await replay(),expected),'通常Workerとサーバーの戦闘結果が一致しない');
      const old=workers.at(-1);old.drop=true;shortDeadline=true;
      // 無応答の戦闘計算と保存が同時にあっても、片方を取りこぼさない。
      const stalled=replay(),saving=codec.encodeCloudSave(state,true);
      check(await stalled===null,'無応答からサーバー計算へ戻らない');
      check(same(refDeserialize(JSON.parse(await saving)),refDeserialize(refSerialize(state,{compact:true}))), '保存の代替処理が内容を変えた');
      shortDeadline=false;
      check(old.stopped,'無応答Workerを終了していない');
      check(await replay()===null,'再試行を連発する');
      offset+=30001;
      check(same(await replay(),expected),'同じページで戦闘計算が復帰しない');
      old.fail();check(!workers.at(-1).stopped,'古い通知で新Workerが停止した');
      // エラー通知でも一度だけ退避し、次の試行から再び実Workerを使う。
      workers.at(-1).fail();check(await replay()===null,'エラー直後の代替処理がない');
      offset+=30001;check(same(await replay(),expected),'非同期エラーから復帰しない');
      check(JSON.stringify(graph)===before,'再試行が元の保存を変更した');

      const planner=await import('/src/auto-planner.js');
      let fallbacks=0;
      const fallback=()=>{fallbacks++;return decideAuto(battle,actor);};
      const plan=()=>planner.planAuto(battle,actor,()=>false,fallback);
      const expectedPlan=decideAuto(battle,actor),rngBefore=JSON.stringify(rngState());
      const equivalent=value=>check(value?.action===expectedPlan?.action&&value?.spellKey===expectedPlan?.spellKey&&value?.target===expectedPlan?.target,'復帰後に作戦や対象が変わった');
      equivalent(await plan());
      const slow=workers.at(-1);slow.drop=true;shortDeadline=true;
      equivalent(await plan());shortDeadline=false;
      check(slow.stopped&&fallbacks===1,'作戦の無応答から退避しない');
      offset+=30001;equivalent(await plan());
      slow.fail();check(!workers.at(-1).stopped,'古い作戦通知で停止した');
      workers.at(-1).fail();equivalent(await plan());
      offset+=30001;equivalent(await plan());
      check(fallbacks===2,'復帰後も代替処理へ固定された');
      check(JSON.stringify(rngState())===rngBefore,'作戦の再試行が乱数を消費した');
      workers.forEach(w=>w.terminate());
      return {workers:workers.length,battleResultUnchanged:true,saveUnchanged:true,planUnchanged:true,recoveredWithoutReload:true};
    }''')
    print(json.dumps({'browser': engine, **result}))
    browser.close()
