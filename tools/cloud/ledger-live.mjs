// 本番と同じコードを専用名へ配置して計測する。実プレイヤーの記録・本番関数は触らない。
import {readFile,writeFile,mkdir,appendFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {publicKey} from '../../supabase/deploy.mjs';
import {LEGAL_VERSION} from '../../src/legal.js';
import {Battle} from '../../src/combat.js';
import {makeDoll} from '../../src/souls.js';
import {ITEMS} from '../../src/items.js';
import {reseedRng,rngState} from '../../src/rng.js';
import {refSerialize,refDeserialize} from '../../src/savegraph.js';
import {battleCommand} from '../../src/cloud-battle.js';
import {replayCloudCommand} from '../../src/cloud-command-replay.js';
import {createCloudChange} from '../../src/cloud-change.js';
import {battleStateHash} from '../../src/cloud-ledger-replay.js';
const env=process.env,mode=process.argv[2],ref=env.SUPABASE_PROJECT_REF,token=env.SUPABASE_ACCESS_TOKEN;
if(!/^[a-z0-9]{20}$/.test(ref||'')||!token)throw Error('計測用の接続設定がありません');
const temporary=env.RUNNER_TEMP||'/tmp',privatePath=join(temporary,'dos-ledger-private.json'),out=env.BENCH_OUTPUT||'/tmp/dos-ledger-report';
const headers=(key,auth=key)=>({apikey:key,Authorization:'Bearer '+auth,'Content-Type':'application/json'});
async function request(url,h,body,method='POST'){
 const r=await fetch(url,{method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(`計測API: HTTP ${r.status}`);
 const raw=await r.text();return raw?JSON.parse(raw):null;
}
const management=(path,body,method=body===undefined?'GET':'POST')=>request(`https://api.supabase.com/v1/projects/${ref}${path}`,{Authorization:'Bearer '+token,'Content-Type':'application/json'},body,method);
const persist=s=>writeFile(privatePath,JSON.stringify(s),{mode:0o600});
const rename=(text,prefix)=>text.replace(/\bcloud_(\w+)\b/g,(_,suffix)=>prefix+'_'+suffix).replaceAll('battle_ledger',prefix+'_ledger');
async function setup(){
 const run=env.GITHUB_RUN_ID,attempt=env.GITHUB_RUN_ATTEMPT||'1';if(!/^\d+$/.test(run||'')||!/^\d+$/.test(attempt))throw Error('Actionsの実行IDが必要です');
 const meta=await management(''),keys=await management('/api-keys');
 const service=keys.find(k=>k.name==='service_role')?.api_key||keys.find(k=>k.api_key?.startsWith('sb_secret_'))?.api_key;
 if(meta.id!==ref||!service)throw Error('対象の接続設定を確認できません');
 const s={url:`https://${ref}.supabase.co`,anon:publicKey(keys),service,prefix:`dos_bl_${run}_${attempt}`,functionName:`dos-ledger-bench-${run}-${attempt}`,region:meta.region};
 await persist(s);await mkdir(out,{recursive:true});
 for(const name of ['202610120001_cloud_save','202610160001_save_slots','202610300001_guest_onboarding','202610300002_large_save_transport','202610300003_save_rpc_deadline','202611020001_battle_ledger']) {
  const sql=rename(await readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8'),s.prefix);
  if(/\bpublic\.cloud_/.test(sql)||/\bbattle_ledger\b/.test(sql))throw Error('本番の名前が残っています');
  await management('/database/query',{query:sql});
 }
 const user=await request(s.url+'/auth/v1/admin/users',headers(service),{email:`${s.functionName}@example.invalid`,email_confirm:true,user_metadata:{purpose:'temporary-ledger-benchmark'}});
 s.user=user.id;await persist(s);
 const link=await request(s.url+'/auth/v1/admin/generate_link',headers(service),{type:'magiclink',email:user.email});
 const auth=await request(s.url+'/auth/v1/verify',headers(s.anon),{type:'magiclink',token_hash:link.hashed_token||link.properties?.hashed_token});
 if(auth.user?.id!==s.user||!auth.access_token)throw Error('試験用の認証が一致しません');
 s.access=auth.access_token;s.session=randomUUID();
 const dir=join(temporary,'dos-ledger-project'),fn=join(dir,'supabase','functions',s.functionName);await mkdir(fn,{recursive:true});
 await writeFile(join(fn,'index.js'),rename(await readFile(env.LEDGER_BUNDLE,'utf8'),s.prefix));
 await writeFile(join(dir,'supabase','config.toml'),`project_id="dos-ledger-benchmark"\n[functions.${s.functionName}]\nentrypoint="./functions/${s.functionName}/index.js"\nverify_jwt=false\n`);
 await persist(s);await appendFile(env.GITHUB_ENV,`LEDGER_FUNCTION=${s.functionName}\nLEDGER_PROJECT=${dir}\n`);
 console.log('専用のテーブル・関数・試験アカウントを用意しました');
}
function fixture(count){
 reseedRng(42);
 const p=Object.assign(makeDoll('計測の人業'),{hp:100000,maxhp:100000,atk:30,vit:30,agi:10000});
 const bag=Array.from({length:count},(_,i)=>({...ITEMS.u_styptic_salve,benchId:i}));p.items=bag;
 const e={uid:900000,key:'bs_ghoul',name:'計測の敵',side:'enemy',alive:true,hp:1000000,maxhp:1000000,atk:1,vit:30,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
 const battle=new Battle([p],[e],()=>{});
 const state={state:'board',floor:1,dungeonIdx:0,gold:100,soulPts:100,inventory:bag,party:[p],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},battle:null};
 const board=refSerialize(state,{compact:true});state.state='combat';state.battle=battle;
 return {graph:refSerialize(state,{compact:true}),board};
}
const summary=rows=>{const v=rows.map(x=>x.ms).sort((a,b)=>a-b);return {samples:rows.length,medianMs:v[Math.ceil(v.length*.5)-1],p95Ms:v[Math.ceil(v.length*.95)-1],maxMs:v.at(-1),meanRequestBytes:rows.reduce((a,x)=>a+x.sent,0)/rows.length,meanReplyBytes:rows.reduce((a,x)=>a+x.received,0)/rows.length};};
async function measure(){
 const s=JSON.parse(await readFile(privatePath,'utf8')),results={revision:env.GITHUB_SHA,region:s.region,location:'GitHub-hosted runner',scope:'本番コードの専用配置。利用者の端末・描画・回線は対象外。',fixtures:[]};
 async function timed(path,body){
  const raw=JSON.stringify(body),begin=performance.now(),h=headers(s.anon,s.access);
  if(path.startsWith('/functions/'))h['x-region']=s.region;
  const r=await fetch(s.url+path,{method:'POST',headers:h,body:raw,signal:AbortSignal.timeout(60000)}),text=await r.text();
  if(!r.ok)throw Error(`実測: HTTP ${r.status}`);
  return {data:JSON.parse(text),ms:performance.now()-begin,sent:Buffer.byteLength(raw),received:Buffer.byteLength(text),timing:r.headers.get('server-timing'),region:r.headers.get('x-sb-edge-region')};
 }
 const edge=body=>timed('/functions/v1/'+s.functionName,{protocol:1,sessionId:s.session,battleLedger:true,...body});
 try{
  await edge({op:'consent',version:LEGAL_VERSION});let revision=(await edge({op:'claim',compactGraph:true})).data.revision;
  for(const count of [200,2000]){
   let {graph,board}=fixture(count);const rows=[],cpu=[],r={items:count,snapshotBytes:Buffer.byteLength(JSON.stringify(graph)),raw:rows,clientCalculationMs:cpu};results.fixtures.push(r);
   const preparation=await edge({op:'save',revision,commandId:randomUUID(),snapshot:board});revision=preparation.data.revision;r.boardPreparation={...preparation,data:undefined};
   const start=await timed('/rest/v1/rpc/'+s.prefix+'_battle_begin',{p_session:s.session,p_revision:revision,p_command_id:randomUUID(),p_change:createCloudChange(board,graph),p_opening:null,p_rules:'battle-1'});revision=start.data.revision;const ledger=start.data.ledger;r.start={...start,data:undefined};let seq=0;
   for(let i=0;i<23;i++){
    const state=refDeserialize(graph);state.battle.pending={actor:state.battle.current,action:'attack',target:state.battle.enemies[0]};
    const command=battleCommand(state.battle,'commit',state.rng),id=randomUUID(),begin=performance.now();
    const local=await replayCloudCommand(graph,command,id,true,true);cpu.push(performance.now()-begin);
    const ack=await timed('/rest/v1/rpc/'+s.prefix+'_battle_append',{p_battle:ledger.id,p_session:s.session,p_revision:revision,p_seq:seq,p_command_id:id,p_command:{...command,forcedCount:local.forcedPackets.length},p_rules:'battle-1'});
    if(ack.data.seq!==++seq)throw Error('追記の順番が一致しません');graph=local.snapshot;
    if(i>=3)rows.push({...ack,data:undefined});
   }
   for(let i=0;i<20&&!refDeserialize(graph).battle.result;i++){
    const state=refDeserialize(graph);state.battle.pending={actor:state.battle.current,action:'run'};
    const command=battleCommand(state.battle,'commit',state.rng),id=randomUUID(),local=await replayCloudCommand(graph,command,id,true,true);
    await timed('/rest/v1/rpc/'+s.prefix+'_battle_append',{p_battle:ledger.id,p_session:s.session,p_revision:revision,p_seq:seq++,p_command_id:id,p_command:{...command,forcedCount:local.forcedPackets.length},p_rules:'battle-1'});graph=local.snapshot;
   }
   if(!refDeserialize(graph).battle.result)throw Error('検証用戦闘を終了できません');
   const end=await edge({op:'ledger-finish',revision,commandId:randomUUID(),battleId:ledger.id,seq});
   if(end.data.battleHash!==await battleStateHash(graph))throw Error('一括検証と端末の結果が一致しません');
   revision=end.data.revision;r.finish={...end,data:undefined};r.summary=summary(rows);r.verified=true;
   console.log(`${count}品 / ${r.snapshotBytes}B: 開始${start.ms.toFixed(1)}ms・追記中央値${r.summary.medianMs.toFixed(1)}ms・p95 ${r.summary.p95Ms.toFixed(1)}ms / 終了検証${end.ms.toFixed(1)}ms`);
  }
 }finally{await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));}
}
async function cleanup(){
 let s;try{s=JSON.parse(await readFile(privatePath,'utf8'));}catch{return;}
 if(!/^dos_bl_\d+_\d+$/.test(s.prefix)||!/^dos-ledger-bench-\d+-\d+$/.test(s.functionName))throw Error('削除対象が不正です');
 const errors=[],report={gameModified:false};
 const remove=async(label,fn)=>{try{await fn();report[label]=true;}catch{report[label]=false;errors.push(label);}};
 await remove('functionRemoved',async()=>{const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/${s.functionName}`,{method:'DELETE',headers:{Authorization:'Bearer '+token}});if(!r.ok&&r.status!==404)throw Error();});
 if(s.user)await remove('accountRemoved',()=>request(s.url+'/auth/v1/admin/users/'+s.user,headers(s.service),undefined,'DELETE'));
 await remove('databaseRemoved',()=>management('/database/query',{query:`do $$declare f record;begin for f in select format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,${s.prefix.length+1})='${s.prefix}_' loop execute 'drop function if exists '||f.sig||' cascade';end loop;end$$;drop schema if exists ${s.prefix}_ledger cascade;drop table if exists public.${s.prefix}_saves cascade;notify pgrst,'reload schema';`}));
 await mkdir(out,{recursive:true});await writeFile(join(out,'cleanup.json'),JSON.stringify({...report,errors},null,2));if(errors.length)throw Error('専用リソースの削除に失敗: '+errors.join(','));await unlink(privatePath);console.log('試験用リソースを削除しました');
}
try{if(mode==='setup')await setup();else if(mode==='measure')await measure();else if(mode==='cleanup')await cleanup();else throw Error('setup / measure / cleanupを指定してください');}catch(e){console.error(e.message);process.exitCode=1;}
