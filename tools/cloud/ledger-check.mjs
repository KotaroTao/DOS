// 本番B方式の所有者・不変履歴・再送・通常保存の遮断と、同じBattleによる一括検証。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { refSerialize,refDeserialize } from '../../src/savegraph.js';
import { Battle } from '../../src/combat.js';
import { makeDoll } from '../../src/souls.js';
import { reseedRng,rngState } from '../../src/rng.js';
import { replayCloudCommand } from '../../src/cloud-command-replay.js';
import { battleCommand } from '../../src/cloud-battle.js';
import { replayBattleLedger,battleStateHash } from '../../src/cloud-ledger-replay.js';
const {PGlite}=await import(pathToFileURL(process.argv[2]));
const db=new PGlite();
const uid='11111111-1111-4111-8111-111111111111', sid=crypto.randomUUID(),bid=crypto.randomUUID();
await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
insert into auth.users values('${uid}');`);
for(const name of ['202610120001_cloud_save','202610160001_save_slots','202610300001_guest_onboarding','202610300002_large_save_transport','202611020001_battle_ledger']) await db.exec(await readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
await db.query('select public.cloud_claim_slot($1,$2,1)',[uid,sid]);
reseedRng(123);
const p=Object.assign(makeDoll('検証の人業'),{hp:100,maxhp:100,atk:25,vit:10,agi:1000});
const e={uid:9,key:'bs_ghoul',name:'検証の敵',side:'enemy',alive:true,hp:70,maxhp:70,atk:1,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
const state={state:'combat',party:[p],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:100,soulPts:100,floor:1,dungeonIdx:0};
state.battle=new Battle([p],[e],()=>{});state.rng=rngState();
const initial=refSerialize(state,{compact:true});
const payload={p_user:uid,p_session:sid,p_revision:0,p_command:bid,p_request:{op:'save'},p_snapshot:initial,p_response:{}};
const begin=async()=>JSON.parse((await db.query('select public.cloud_battle_begin_text($1) as v',[JSON.stringify(payload)])).rows[0].v);
assert.equal((await begin()).ledger.seq,0);assert.equal((await begin()).ledger.id,bid);
await assert.rejects(db.query('select public.cloud_commit_slot($1,$2,1,$3,$4,$5,$6,1)',[uid,sid,crypto.randomUUID(),'{}','{}','{}']),/cloud_battle_active/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
const append=async(id,seq,cmd,session=sid)=>{
 await db.exec('set role authenticated');
 try{return (await db.query('select public.cloud_battle_append($1,$2,1,$3,$4,$5,$6) as v',[bid,session,seq,id,JSON.stringify(cmd),'battle-1'])).rows[0].v;}finally{await db.exec('reset role');}
};
let graph=initial,seq=0;const choices=[];
for(let n=0;n<30;n++){
 const s=refDeserialize(graph);if(s.battle.result)break;
 let cmd;
 if(s.battle.phase==='input'){
  s.battle.pending={actor:s.battle.current,action:'attack',target:s.battle.enemies.find(x=>x.alive)};
  cmd=battleCommand(s.battle,'commit',s.rng);
 }else cmd=battleCommand(s.battle,s.battle.phase,s.rng);
 const id=crypto.randomUUID(),local=await replayCloudCommand(graph,cmd,id,true);
 cmd={...cmd,forcedCount:local.forcedPackets.length};
 const ack=await append(id,seq,cmd);assert.equal(ack.seq,seq+1);
 assert.equal((await append(id,seq,cmd)).seq,seq+1);
 await assert.rejects(append(id,seq,{...cmd,action:'defend'}),/cloud_command_reused/);
 await assert.rejects(append(crypto.randomUUID(),seq,cmd),/cloud_revision_conflict/);
 await assert.rejects(append(crypto.randomUUID(),seq+1,cmd,crypto.randomUUID()),/cloud_session_lost/);
 choices.push({commandId:id,command:cmd});seq++;graph=local.snapshot;
}
assert.ok(refDeserialize(graph).battle.result);
const ledger=(await db.query('select public.cloud_battle_read($1) as v',[uid])).rows[0].v;
assert.equal(ledger.seq,seq);
const replay=await replayBattleLedger(initial,ledger);
assert.ok(replay.terminal);assert.equal(replay.hash,await battleStateHash(graph));
const bad=structuredClone(ledger);bad.choices[0].command.actor='改ざん';
await assert.rejects(replayBattleLedger(initial,bad));
// キャッシュを使わずサーバーの開始地点＋命令を読み直しても、同じ結果になる。
assert.equal((await replayBattleLedger(initial,JSON.parse(JSON.stringify(ledger)))).hash,replay.hash);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[crypto.randomUUID()]);
await assert.rejects(append(crypto.randomUUID(),seq,choices[0].command),/cloud_session_lost|cloud_battle_missing/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
const finish={p_user:uid,p_session:sid,p_battle:bid,p_seq:seq,p_command:crypto.randomUUID(),p_request:{op:'ledger-finish'},p_snapshot:replay.snapshot,p_response:{battleHash:replay.hash}};
const close=async()=>JSON.parse((await db.query('select public.cloud_battle_finish_text($1) as v',[JSON.stringify(finish)])).rows[0].v);
assert.equal((await close()).revision,2);assert.equal((await close()).revision,2);
assert.equal((await db.query('select public.cloud_battle_read($1) as v',[uid])).rows[0].v,null);
await db.query('delete from auth.users where id=$1',[uid]);
assert.equal((await db.query('select count(*)::int as n from battle_ledger.heads')).rows[0].n,0);
await db.close();console.log('本番B: 不変履歴・権限・再送・キャッシュなし復旧・一括再生・改ざん拒否・終了再送・退会削除を確認');
