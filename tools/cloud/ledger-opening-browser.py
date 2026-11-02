"""開始保存と敵の初手を一往復へまとめ、Worker制限時も復旧できる。"""
import json,os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
 for worker in [True,False]:
  c=b.new_context(service_workers='block');c.request.post('http://127.0.0.1:8002/test/reset')
  if not worker:c.add_init_script('window.Worker=undefined')
  c.route('**/ledger-harness',lambda r:r.fulfill(content_type='text/html',body='<html><body></body></html>'))
  calls=[]
  def api(r):
   u=urlparse(r.request.url);calls.append((u.path,r.request.post_data_json))
   response=r.fetch(url='http://127.0.0.1:8002'+u.path)
   r.fulfill(response=response)
  c.route('https://cloud.test/**',api)
  page=c.new_page();page.goto('http://127.0.0.1:8001/ledger-harness')
  result=page.evaluate('''async()=>{
   const {CloudSaveClient}=await import('/src/cloud-save.js'),{Battle}=await import('/src/combat.js'),{makeDoll}=await import('/src/souls.js');
   const {refSerialize,refDeserialize}=await import('/src/savegraph.js'),{reseedRng,rngState}=await import('/src/rng.js'),{battleCommand}=await import('/src/cloud-battle.js');
   const {encodeCloudSave}=await import('/src/save-codec.js'),{battleStateHash}=await import('/src/cloud-ledger-replay.js');
   const config={enabled:true,url:'https://cloud.test',anonKey:'test',protocol:1},client=new CloudSaveClient(config);
   client.auth={access_token:'test-token',expires_at:9999999999,user:{id:'11111111-1111-4111-8111-111111111111'}};
   client.sessionId=crypto.randomUUID();await client.request({protocol:1,op:'consent',version:'2026-10-30'});await client.claim();
   reseedRng(5);const p=Object.assign(makeDoll('検査'),{hp:1000,maxhp:1000,agi:1});
   const e={uid:100,key:'bs_ghoul',name:'検査の敵',side:'enemy',alive:true,hp:1000,maxhp:1000,atk:1,vit:10,agi:100,int:1,pie:1,luk:1,lv:1,element:'none'};
   const battle=new Battle([p],[e],()=>{},{opening:'ambush'});
   const state={state:'combat',battle,party:[p],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:100,soulPts:100,floor:1,dungeonIdx:0};
   const graph=JSON.parse(await encodeCloudSave(state,true));
   if(battle.phase!=='enemy')throw Error('奇襲の開始地点ではない');
   const command=battleCommand(battle,'enemy',state.rng);
   await client.save(graph);const initialSeq=client.ledger.seq;
   const response=await client.actionCommand(command);
   if(!response.packet)throw Error('初手の結果がない');
   const hash=await battleStateHash(client.confirmed);
   const other=new CloudSaveClient(config);other.auth=client.auth;other.sessionId=client.sessionId;
   const resumed=await other.claim();
   if(await battleStateHash(resumed)!==hash)throw Error('再開した戦況が一致しない');
   return {initialSeq,seq:client.ledger.seq,phase:refDeserialize(resumed).battle.phase};
  }''')
  appends=[x for x in calls if x[0].endswith('/cloud_battle_append')]
  assert len(appends)==(0 if worker else 1),(worker,calls)
  assert result['initialSeq']==(1 if worker else 0),result
  assert result['seq']==1,result
  print(json.dumps({'worker':worker,**result,'extraAppendRequests':len(appends)},ensure_ascii=False));c.close()
 b.close()
