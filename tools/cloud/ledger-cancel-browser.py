"""戦闘断念・再戦中断をEdge/SQLへ確定し、再送・再開・次の戦闘を確認する。"""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.webkit.launch() if os.environ.get('DOS_TEST_BROWSER')=='webkit' else p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for mode in ['abandon','rematch']:
        for worker in [True,False]:
            c=browser.new_context(service_workers='block')
            c.request.post('http://127.0.0.1:8002/test/reset')
            if not worker:c.add_init_script('window.Worker=undefined')
            c.route('**/cancel-harness',lambda r:r.fulfill(content_type='text/html',body='<body></body>'))
            attempts=[];lost={'value':True}
            def api(route):
                path=urlparse(route.request.url).path;body=route.request.post_data_json
                response=route.fetch(url='http://127.0.0.1:8002'+path)
                if body.get('op')=='ledger-cancel':
                    attempts.append(body)
                    if lost['value']:
                        lost['value']=False;route.fulfill(status=503,json={'message':'response lost'});return
                route.fulfill(response=response)
            c.route('https://cloud.test/**',api)
            page=c.new_page();page.goto('http://127.0.0.1:8001/cancel-harness')
            page.evaluate('''async mode=>{
              const {CloudSaveClient}=await import('/src/cloud-save.js'),{Battle}=await import('/src/combat.js'),{makeDoll}=await import('/src/souls.js');
              const {refSerialize,refDeserialize}=await import('/src/savegraph.js'),{reseedRng,rngState}=await import('/src/rng.js'),{battleCommand}=await import('/src/cloud-battle.js');
              const {encodeCloudSave}=await import('/src/save-codec.js');
              const config={url:'https://cloud.test',anonKey:'test',protocol:1};
              const client=new CloudSaveClient(config,{retryDelays:[],onFailure:async e=>{if(e.status!==503)throw e;}});
              client.auth={access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111'}};
              client.sessionId=crypto.randomUUID();await client.request({protocol:1,op:'consent',version:'2026-10-30'});await client.claim();
              reseedRng(5);const p=Object.assign(makeDoll('検査'),{hp:100,maxhp:1000,mp:5,maxmp:100,agi:1000});
              const enemy=()=>({uid:100,key:'bs_ghoul',side:'enemy',alive:true,hp:10000,maxhp:10000,atk:1,vit:10,agi:1,int:1,pie:1,luk:1,lv:1,element:'none'});
              const state={state:'combat',battle:new Battle([p],[enemy()],()=>{}),party:[p],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:12345,soulPts:100,redSoul:100,floor:1,dungeonIdx:0,run:{gold:30,items:[]}};
              if(mode==='rematch')state.rematch={savedIdx:9,savedFloor:3,snap:[{p,hp:700,mp:30,alive:true,ailment:null,pct:0}]};
              await client.savePrepared(()=>encodeCloudSave(state,true),{urgent:true});
              const renew=client.renew(),closed=client.cancelBattle(mode);await renew;
              const sync=await closed,ended=refDeserialize(sync.snapshot);
              if(client.ledger||ended.battle||ended.gold!==12345)throw Error('中断が確定しない');
              if(mode==='abandon'){
                if(ended.state!=='over'||!ended.run.abandoned||ended.party[0].hp!==0)throw Error('断念の全滅状態が違う');
                ended.redSoul-=20;ended.party[0].alive=true;ended.party[0].hp=1;ended.state='town';ended.run=null;
              }else if(ended.state!=='town'||ended.rematch||ended.party[0].hp!==700||ended.party[0].mp!==30||ended.dungeonIdx!==9)throw Error('再戦前の状態へ戻らない');
              await client.save(refSerialize(ended,{compact:true}));
              const reopened=new CloudSaveClient(config);reopened.auth=client.auth;reopened.sessionId=client.sessionId;
              const resumed=refDeserialize(await reopened.claim());
              if(resumed.state!=='town'||resumed.redSoul!==(mode==='abandon'?80:100)||resumed.gold!==12345||reopened.ledger)throw Error('再開で巻き戻った');
              resumed.party[0].hp=1000;resumed.state='combat';resumed.battle=new Battle(resumed.party,[enemy()],()=>{});resumed.run={gold:0,items:[]};
              await reopened.savePrepared(()=>encodeCloudSave(resumed,true),{urgent:true});
              resumed.battle.chooseAction('defend');
              const result=await reopened.actionCommand(battleCommand(resumed.battle,'commit',resumed.rng));
              if(!result.packet||reopened.ledger.seq<1)throw Error('次の戦闘が始まらない');
            }''',mode)
            assert len(attempts)==2,attempts
            assert attempts[0]==attempts[1],'応答喪失後も同じ中断操作を再送する'
            print(mode,'worker',worker,'OK: 中断の確定・応答喪失の再送・金貨/赤い魂/HP維持・次の戦闘')
            c.close()
    browser.close()
