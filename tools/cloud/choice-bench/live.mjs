// 実サーバーの計測専用。認証情報はrunnerの一時ファイルだけに置き、成果物・ログへ出さない。
import {readFile,writeFile,mkdir,copyFile,appendFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {publicKey} from '../../../supabase/deploy.mjs';
import {LEGAL_VERSION} from '../../../src/legal.js';
import {makeDoll} from '../../../src/souls.js';
import {Battle} from '../../../src/combat.js';
import {ITEMS} from '../../../src/items.js';
import {refSerialize,refDeserialize} from '../../../src/savegraph.js';
import {battleCommand} from '../../../src/cloud-battle.js';
import {replayCloudCommand} from '../../../src/cloud-command-replay.js';
import {reseedRng,rngState} from '../../../src/rng.js';
const env=process.env, mode=process.argv[2], temporary=env.RUNNER_TEMP || '/tmp';
const privatePath=join(temporary,'dos-choice-bench-private.json');
const reportDir=env.BENCH_OUTPUT || '/tmp/dos-choice-bench-report';
const project=env.SUPABASE_PROJECT_REF, managementToken=env.SUPABASE_ACCESS_TOKEN;
if(!/^[a-z0-9]{20}$/.test(project||'')||!managementToken)throw Error('計測用の接続設定がありません');
async function request(url,headers,body,method='POST',label='API'){
 const r=await fetch(url,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(`${label}: HTTP ${r.status}`);
 if(r.status===204)return null;
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
const management=(path,body,method=body===undefined?'GET':'POST')=>request(`https://api.supabase.com/v1/projects/${project}${path}`,{Authorization:`Bearer ${managementToken}`,'Content-Type':'application/json'},body,method,'管理API');
const persist=s=>writeFile(privatePath,JSON.stringify(s),{mode:0o600});
const headers=(key,token=key)=>({apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'});
const rpc=(s,name,body,token=s.serviceKey)=>request(s.url+'/rest/v1/rpc/'+name,headers(token===s.serviceKey?s.serviceKey:s.anonKey,token),body);
async function setup(){
 const run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT||'1';
 if(!/^\d+$/.test(run||'')||!/^\d+$/.test(attempt))throw Error('計測はActionsの実行IDを必要とします');
 const metadata=await management('');if(metadata.id!==project||!metadata.status?.startsWith('ACTIVE'))throw Error('対象プロジェクトを確認できません');
 const keys=await management('/api-keys');
 const serviceKey=keys.find(k=>k.name==='service_role'&&k.api_key)?.api_key || keys.find(k=>k.api_key?.startsWith('sb_secret_'))?.api_key;
 if(!serviceKey)throw Error('試験用アカウントを管理する接続設定がありません');
 const s={url:`https://${project}.supabase.co`,anonKey:publicKey(keys),serviceKey,prefix:`dos_cb_${run}_${attempt}`,functionName:`dos-choice-bench-${run}-${attempt}`,region:metadata.region,run,attempt};
 await persist(s);await mkdir(reportDir,{recursive:true});
 const sql=(await readFile(new URL('./schema.sql',import.meta.url),'utf8')).replaceAll('__SCHEMA__',s.prefix).replaceAll('__PREFIX__',s.prefix);
 await management('/database/query',{query:sql});s.schemaCreated=true;await persist(s);
 const user=await request(s.url+'/auth/v1/admin/users',headers(serviceKey),{email:`dos-choice-bench-${run}-${attempt}@example.invalid`,email_confirm:true,user_metadata:{purpose:'temporary-choice-benchmark'}},'POST','試験アカウント作成');
 s.userId=user.id;await persist(s);
 // generate_linkはリンクを生成するだけで、メールは送信しない。
 const link=await request(s.url+'/auth/v1/admin/generate_link',headers(serviceKey),{type:'magiclink',email:user.email},'POST','試験ログイン準備');
 const hash=link.hashed_token||link.properties?.hashed_token;if(!hash)throw Error('試験ログインを生成できません');
 const auth=await request(s.url+'/auth/v1/verify',headers(s.anonKey),{type:'magiclink',token_hash:hash},'POST','試験ログイン');
 if(auth.user?.id!==s.userId||!auth.access_token)throw Error('試験用の接続が一致しません');
 s.accessToken=auth.access_token;s.sessionId=randomUUID();
 s.projectDir=join(temporary,'dos-choice-bench-project');
 const dir=join(s.projectDir,'supabase','functions',s.functionName);await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'index.js'),(await readFile(new URL('./edge.js',import.meta.url),'utf8')).replaceAll('__PREFIX__',s.prefix));
 await writeFile(join(s.projectDir,'supabase','config.toml'),`project_id = "dos-choice-benchmark"\n[functions.${s.functionName}]\nentrypoint = "./functions/${s.functionName}/index.js"\nverify_jwt = false\n`);
 await persist(s);
 if(env.GITHUB_ENV)await appendFile(env.GITHUB_ENV,`BENCH_FUNCTION=${s.functionName}\nBENCH_PROJECT_DIR=${s.projectDir}\n`);
 await writeFile(join(reportDir,'setup.json'),JSON.stringify({projectRegion:s.region,workflowRun:run,attempt,gameChanged:false,scope:'temporary-account-and-separate-schema'},null,2));
 console.log('専用schema・試験アカウント・試験関数の準備ができました。本番のセーブは変更していません。');
}
function fixture(items){
 reseedRng(7);
 const p=Object.assign(makeDoll('通信計測の人業'),{hp:1000000,maxhp:1000000,mp:100,maxmp:100,atk:30,vit:30,agi:1000});
 const bag=Array.from({length:items},(_,i)=>({...ITEMS.u_styptic_salve,benchId:i}));p.items=bag;
 const e={uid:900000,key:'bs_ghoul',name:'通信計測の敵',side:'enemy',alive:true,hp:100000000,maxhp:100000000,atk:1,vit:30,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
 const battle=new Battle([p],[e],()=>{});
 return refSerialize({state:'combat',battle,party:[p],reserve:[],souls:[],rng:rngState(),inventory:bag,codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:100,soulPts:100,floor:1,dungeonIdx:0},{compact:true});
}
const percentile=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)];
function summary(rows){
 const ms=rows.map(r=>r.ms);return {samples:rows.length,meanMs:ms.reduce((a,b)=>a+b,0)/rows.length,medianMs:percentile(ms,.5),p95Ms:percentile(ms,.95),maxMs:Math.max(...ms),meanRequestBytes:rows.reduce((a,b)=>a+b.sent,0)/rows.length,meanResponseBytes:rows.reduce((a,b)=>a+b.received,0)/rows.length};
}
async function measure(){
 const s=JSON.parse(await readFile(privatePath,'utf8')),samples=Number(env.BENCH_SAMPLES||20),warmups=3;
 if(![20,40].includes(samples))throw Error('試行数は20または40に限定します');
 const measureStarted=performance.now();
 const results={v:1,startedAt:new Date().toISOString(),sourceRevision:env.GITHUB_SHA,workflowRun:s.run,projectRegion:s.region,location:'GitHub-hosted runner',scope:'選択の記録・確定通知の応答時間。Bの戦闘終了時の検証、実端末の描画、利用者の回線は測っていない。',warmups,samplesPerArm:samples,fixtures:[],checks:{}};
 async function timed(path,body,kind){
  const raw=JSON.stringify(body),start=performance.now();
  const h=headers(s.anonKey,s.accessToken);
  const response=await fetch(s.url+path,{method:'POST',headers:h,body:raw,signal:AbortSignal.timeout(15000)});
  const text=await response.text(),ms=performance.now()-start;
  if(!response.ok)throw Error(`${kind}: HTTP ${response.status}`);
  const data=JSON.parse(text);
  return {data,sample:{ms,sent:Buffer.byteLength(raw),received:Buffer.byteLength(text),serverTiming:response.headers.get('server-timing'),region:response.headers.get('x-bench-region')||response.headers.get('x-sb-edge-region')||response.headers.get('sb-edge-region')||null}};
 }
 const base={protocol:1,sessionId:s.sessionId};
 await timed('/functions/v1/game-save',{protocol:1,op:'consent',version:LEGAL_VERSION},'規約確認');
 let claim=(await timed('/functions/v1/game-save',{...base,op:'claim',compactGraph:true},'試験用記録の読み込み')).data;
 let revision=claim.revision;
 if(!claim.commandReplay)throw Error('現在のAPIが計測対象の照合方式に対応していません');
 try{
  for(const count of [200,2000]){
   let graph=fixture(count);
   revision=(await timed('/functions/v1/game-save',{...base,op:'save',revision,commandId:randomUUID(),snapshot:graph},'試験用記録の用意')).data.revision;
   const runA=await rpc(s,s.prefix+'_begin',{p_owner:s.userId}),runB=await rpc(s,s.prefix+'_begin',{p_owner:s.userId});
   const rows={current:[],B_auth_api:[],B_db_jwt:[]},cold={},phases=[];
   const size=Buffer.byteLength(JSON.stringify(graph));
   const fixtureResult={items:count,snapshotBytes:size,firstRequest:cold,summary:null,raw:rows};results.fixtures.push(fixtureResult);
   for(let i=0;i<samples+warmups;i++){
    if(performance.now()-measureStarted>360000)throw Error('計測の時間上限6分を超えたため停止しました');
    const state=refDeserialize(graph);Object.setPrototypeOf(state.battle,Battle.prototype);
    if(state.battle.phase!=='input')throw Error('比較元の戦闘が次の入力地点にありません');
    state.battle.chooseAction('attack');state.battle.chooseTarget(state.battle.targetOptions()[0]);
    const command=battleCommand(state.battle,'commit',state.rng),commandId=randomUUID();
    const forced=claim.forcedTurns===true;
    const predicted=await replayCloudCommand(graph,command,commandId,forced);
    const requests={
     current:['/functions/v1/game-save',{...base,op:'command',revision,commandId,command,replay:true,...(forced?{forcedTurns:true}:{})}],
     B_auth_api:['/functions/v1/'+s.functionName,{p_run:runA,p_step:i+1,p_command:commandId,p_choice:command}],
     B_db_jwt:['/rest/v1/rpc/'+s.prefix+'_append',{p_run:runB,p_step:i+1,p_command:commandId,p_choice:command}],
    };
    // 時間帯や温まり方の偏りを減らし、3方式の順序を交互に変える。並列負荷はかけない。
    const order=[['current','B_auth_api','B_db_jwt'],['B_db_jwt','current','B_auth_api'],['B_auth_api','B_db_jwt','current']][i%3];
    for(const kind of order){
     const response=await timed(...requests[kind],kind);
     if(kind==='current'){
      if(response.data.replayHash!==predicted.hash)throw Error('公開中の戦闘計算と試験コードが一致しません');
      revision=response.data.revision;graph=predicted.snapshot;
     }else if(response.data.step!==i+1||!response.data.receipt)throw Error('Bの選択記録が確定していません');
     if(i===0)cold[kind]=response.sample;
     if(i>=warmups)rows[kind].push(response.sample);
    }
    if(i===0){
     // 再送は同じ受付、選び直しは拒否されることを実DBでも確認する。
     const original=(await timed(...requests.B_db_jwt,'再送確認')).data;
     const again=(await timed(...requests.B_db_jwt,'再送確認')).data;
     if(JSON.stringify(original)!==JSON.stringify(again))throw Error('Bの再送が一致しません');
     const wrong={...requests.B_db_jwt[1],p_choice:{action:'defend'}};
     const rejected=await fetch(s.url+requests.B_db_jwt[0],{method:'POST',headers:headers(s.anonKey,s.accessToken),body:JSON.stringify(wrong)});
     if(rejected.ok)throw Error('Bで選択の変更が受理されました');
     results.checks.idempotentRetry=true;results.checks.changedChoiceRejected=true;
    }
   }
   const totals=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,summary(v)]));
   fixtureResult.summary=totals;fixtureResult.complete=true;
   await writeFile(join(reportDir,'results.json'),JSON.stringify(results,null,2));
   console.log(`記録 ${size} bytes / ${count}品: `+Object.entries(totals).map(([k,v])=>`${k} 中央値${v.medianMs.toFixed(1)}ms p95 ${v.p95Ms.toFixed(1)}ms`).join(' / '));
  }
  results.completedAt=new Date().toISOString();
 }finally{
  await writeFile(join(reportDir,'results.json'),JSON.stringify(results,null,2));
 }
}
async function cleanup(){
 let s;try{s=JSON.parse(await readFile(privatePath,'utf8'));}catch{console.log('試験用リソースの作成前でした');return;}
 if(!/^dos_cb_\d+_\d+$/.test(s.prefix)||!/^dos-choice-bench-\d+-\d+$/.test(s.functionName))throw Error('片付けの対象が不正です');
 const report={at:new Date().toISOString(),errors:[],gameModified:false};
 async function remove(label,fn){try{await fn();report[label]=true;}catch{report.errors.push(label);report[label]=false;}}
 await remove('testFunctionRemoved',async()=>{
  const r=await fetch(`https://api.supabase.com/v1/projects/${project}/functions/${s.functionName}`,{method:'DELETE',headers:{Authorization:'Bearer '+managementToken}});
  if(!r.ok&&r.status!==404)throw Error('削除失敗');
 });
 if(s.userId)await remove('testAccountRemoved',()=>request(s.url+'/auth/v1/admin/users/'+s.userId,headers(s.serviceKey),undefined,'DELETE','試験アカウント削除'));
 await remove('testSchemaRemoved',()=>management('/database/query',{query:`drop function if exists public.${s.prefix}_append(uuid,integer,uuid,jsonb);drop function if exists public.${s.prefix}_append_service(uuid,uuid,integer,uuid,jsonb);drop function if exists public.${s.prefix}_begin(uuid);drop schema if exists ${s.prefix} cascade;notify pgrst,'reload schema';`}));
 await mkdir(reportDir,{recursive:true});await writeFile(join(reportDir,'cleanup.json'),JSON.stringify(report,null,2));
 if(report.errors.length)throw Error('試験用リソースの片付けに失敗しました: '+report.errors.join(','));
 await unlink(privatePath);console.log('専用関数・試験アカウント・専用schemaを削除しました');
}
try{if(mode==='setup')await setup();else if(mode==='measure')await measure();else if(mode==='cleanup')await cleanup();else throw Error('setup / measure / cleanup を指定してください');}
catch(e){console.error(e.message);process.exitCode=1;}
