// 本番の記録は読み取り専用。認証情報・アカウント・名前・本文は出力しない。
import { refDeserialize, refSerialize } from '../../src/savegraph.js';
import { resolveCloudTurn, resolveCloudBattle } from '../../src/cloud-battle.js';
import { Battle } from '../../src/combat.js';
const endpoint = `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`;
const r = await fetch(endpoint, { method:'POST', headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
  body:JSON.stringify({query:"select snapshot, revision from public.cloud_saves where snapshot is not null order by updated_at desc limit 5"}) });
if (!r.ok) throw new Error(`診断用の読み取りに失敗: HTTP ${r.status}`);
const rows = await r.json();
for (const [i,row] of rows.entries()) {
  const data=row.snapshot;
  console.log(JSON.stringify({record:i,revision:row.revision,bytes:JSON.stringify(data).length,nodes:data?.heap?.length}));
  try {
    const s=refDeserialize(data);
    const sizes=Object.entries(s).map(([key,v])=>({key,bytes:JSON.stringify(refSerialize(v)).length})).sort((a,b)=>b.bytes-a.bytes).slice(0,10);
    const b=s.battle;
    console.log(JSON.stringify({record:i,state:s.state,sizes,battle:b?{phase:b.phase,acted:b._acted,result:b.result,party:b.party?.length,enemies:b.enemies?.map(e=>e.key),pending:b.pending?.action}:null}));
    if(s.state==='combat' && b && !b.result) {
      Object.setPrototypeOf(b,Battle.prototype);
      const sizes=[];
      for(let n=0;n<8 && !b.result;n++) {
        if(b._acted) resolveCloudBattle(s,'advance');
        if(b.phase==='input') b.chooseAction('defend');
        if(b.phase==='target') { const opts=b.targetOptions(); if(opts.length)b.chooseTarget(opts[0]); }
        const action=b.phase==='resolve'?'commit':b.phase==='enemy'?'enemy':b.phase==='stunned'?'stunned':null;
        if(!action) break;
        resolveCloudTurn(s,action); sizes.push(JSON.stringify(refSerialize(s)).length);
      }
      console.log(JSON.stringify({record:i,localSimulation:sizes,phase:b.phase}));
    }
  } catch(e) { console.log(JSON.stringify({record:i,error:e.name,message:e.message,stack:e.stack?.split('\n').slice(1,4)})); }
}
