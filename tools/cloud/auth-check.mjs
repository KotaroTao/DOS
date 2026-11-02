import assert from 'node:assert/strict';
import {createAuthenticator} from '../../supabase/functions/game-save/auth.js';
const url='https://test.supabase.co',sub='11111111-1111-4111-8111-111111111111';
let now=1000000,jwks=0,online=0;
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const key={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'key-1',alg:'ES256',use:'sig'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=async(change={},header={})=>{
 const raw=encode({alg:'ES256',kid:'key-1',...header})+'.'+encode({iss:url+'/auth/v1',aud:'authenticated',role:'authenticated',sub,exp:now/1000+3600,...change});
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(raw));
 return raw+'.'+Buffer.from(signature).toString('base64url');
};
const auth=createAuthenticator({url,serviceKey:'secret',now:()=>now,fetcher:async path=>{
 if(path.endsWith('/jwks.json')){jwks++;return Response.json({keys:[key]});}
 online++;return Response.json({id:sub});
}});
const valid=await token();assert.equal((await auth('Bearer '+valid)).id,sub);
await auth('Bearer '+valid);assert.equal(jwks,1);assert.equal(online,0);
await auth('Bearer '+valid,{online:true});assert.equal(online,1);
for(const change of [{iss:'https://other.invalid/auth/v1'},{aud:'anon'},{role:'service_role'},{exp:1000},{exp:null},{nbf:1001},{sub:'invalid'}]) await assert.rejects(auth('Bearer '+await token(change)),/ログイン/);
await assert.rejects(auth('Bearer '+await token({}, {alg:'none'})),/ログイン/);
await assert.rejects(auth('Bearer '+await token({}, {kid:'unknown'})),/ログイン/);assert.equal(jwks,1);
const parts=valid.split('.');parts[1]=encode({sub,role:'service_role',exp:999999});await assert.rejects(auth('Bearer '+parts.join('.')),/ログイン/);
await assert.rejects(auth(''),/ログイン/);
await auth('Bearer '+encode({alg:'HS256'})+'.test.test');assert.equal(online,2);
now+=301000;await auth('Bearer '+valid);assert.equal(jwks,2);
console.log('JWT: 正しい署名・発行元・対象・期限・権限・改ざん拒否・鍵キャッシュ/更新・重要操作のAuth確認・HS256互換を確認');
