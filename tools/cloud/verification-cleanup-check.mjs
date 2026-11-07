// 通信試遊の撤去を繰り返しても、本編の記録とユーザーを失わない。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.argv[2]));
const db=new PGlite();
await db.exec(`create schema auth; create table auth.users(id uuid primary key);
 create role anon; create role authenticated; create role service_role;
 create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111');`);
for(const name of ['202610120001_cloud_save.sql','202610160001_save_slots.sql','202611010001_choice_trial.sql'])
 await db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
await db.exec(`insert into public.cloud_saves(user_id,slot,revision,snapshot) values
 ('11111111-1111-4111-8111-111111111111',1,7,'{"progress":true}');
 insert into choice_trial.runs(owner_id,mode,version) values ('11111111-1111-4111-8111-111111111111','measure','old');`);
const before=(await db.query('select * from public.cloud_saves')).rows;
const cleanup=await readFile(new URL('../../supabase/migrations/202611070001_remove_verification.sql',import.meta.url),'utf8');
for(let n=0;n<2;n++){
 await db.exec(cleanup);
 assert.deepEqual((await db.query('select * from public.cloud_saves')).rows,before);
 assert.equal((await db.query('select count(*) as n from auth.users')).rows[0].n,1);
 assert.equal((await db.query("select count(*) as n from pg_namespace where nspname='choice_trial'")).rows[0].n,0);
 assert.equal((await db.query("select count(*) as n from pg_proc where proname like 'dos_choice_trial_%'")).rows[0].n,0);
}
await db.close();
console.log('試遊DBの撤去・再実行・本編の記録と認証ユーザーの保全を確認');
