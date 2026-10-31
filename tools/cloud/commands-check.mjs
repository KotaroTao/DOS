import {encodeCloudReply,decodeCloudReply} from "../../src/cloud-wire.js";
import assert from "node:assert/strict";
import { createCloudChange, applyCloudChange } from "../../src/cloud-change.js";
import { commandPacketBase, decodeCommandResponse } from "../../src/cloud-command-codec.js";
import { refSerialize, refDeserialize } from "../../src/savegraph.js";
import { battleCommand, resolveCloudCommand } from "../../src/cloud-battle.js";
import { CloudSaveClient } from "../../src/cloud-save.js";
import { Battle } from "../../src/combat.js";
import { makeDoll } from "../../src/souls.js";
import { reseedRng, rngState } from "../../src/rng.js";
const disk = new Map(), storage = { getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k) };
for (const b of [{a:[1,2,3],b:1},{a:[1]}, {a:[]}]) for (const n of [{a:[2,4],x:null},{a:[1,2,3,4]}, {a:[]}]) {
 const update=createCloudChange(b,n); assert.deepEqual(update ? update.snapshot || applyCloudChange(b,update.change) : b,n);
}
for (const bad of [[['set',['__proto__','polluted'],true]],[['set',['a',-1],true]],[['splice',['a'],0,-1,[]]]]) assert.throws(()=>applyCloudChange({a:[]},bad));
assert.equal({}.polluted,undefined);
reseedRng(7);
const p=Object.assign(makeDoll('検証の人業'),{hp:100,maxhp:100,atk:30,vit:10,agi:1000});
const e={uid:9,key:'bs_ghoul',name:'敵',side:'enemy',alive:true,hp:100000,maxhp:100000,atk:10,vit:10,agi:1,int:10,pie:10,luk:8,lv:1,element:'none'};
const b=new Battle([p],[e],()=>{});
const state={state:'combat',battle:b,party:[p],reserve:[],souls:[],rng:rngState(),codex:{mon:{},fresh:{mon:{}}},events:{},world:{},order:{picks:[]},gold:100,soulPts:100,floor:1,dungeonIdx:0};
const graph=refSerialize(state,{compact:true});
b.chooseAction('attack');b.chooseTarget(e);const command=battleCommand(b,'commit');
const resultState=refDeserialize(graph), packets=resolveCloudCommand(resultState,command,{compact:true});
const packetBase=commandPacketBase(graph);
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
assert.deepEqual(packetBase,commandPacketBase(sorted(graph)));
const response={revision:1,packetChange:createCloudChange(packetBase,packets.packet),nextPacketChange:createCloudChange(packetBase,packets.nextPacket),sync:[['set',[],refSerialize(resultState,{compact:true})]]};
const decoded=decodeCommandResponse(graph,response);
assert.deepEqual(decoded.packet,packets.packet);assert.deepEqual(decoded.nextPacket,packets.nextPacket);
assert(refDeserialize(decoded.packet).snapshot.battle.enemies[0].hp<100000);
assert.throws(()=>resolveCloudCommand(refDeserialize(graph),{...command,target:{side:'enemy',uid:99}}));
assert.throws(()=>resolveCloudCommand(refDeserialize(graph),{...command,action:'spell',spellKey:'not-learned'}));
// 成功した版のみを差分の基準にする。返答喪失でも要求ID・内容を変えない。
const c=new CloudSaveClient({protocol:1},{storage,retryDelays:[]});c.auth={user:{id:'test'}};c.sessionId='session';c.commandMode=true;c.confirmed=graph;c.revision=0;
const seen=[];c.request=async body=>{seen.push(structuredClone(body));return {revision:body.revision+1};};
const next=structuredClone(graph);next.templates[0].o.test='変更';
await c.save(next);assert(seen[0].change);assert.deepEqual(c.confirmed,next);
assert.equal(storage.getItem('dos-cloud-pending:test'),null);
const chosen=new CloudSaveClient({protocol:1},{storage});chosen.auth=c.auth;chosen.sessionId='session';chosen.confirmed=graph;chosen.commandMode=true;
let release;chosen.tail=new Promise(r=>release=r);chosen.request=async()=>response;
const pending=chosen.actionCommand(command);
assert.throws(()=>chosen.actionCommand({...command,action:"defend"}),/確定待ち/);
assert(JSON.parse(storage.getItem('dos-cloud-choice:test')).command.action==='attack');
release();await pending;assert.equal(storage.getItem('dos-cloud-choice:test'),null);assert.equal(storage.getItem('dos-cloud-pending:test'),null);
// 送信列へ入る前の終了でも、選択そのものを復元して送る。
const recovery=new CloudSaveClient({protocol:1},{storage});recovery.auth=c.auth;recovery.sessionId='session';recovery.confirmed=graph;recovery.commandMode=true;
storage.setItem('dos-cloud-choice:test',JSON.stringify({sessionId:'session',commandId:'chosen-id',command}));
recovery.request=async body=>{assert.equal(body.commandId,'chosen-id');assert.deepEqual(body.command,command);return response;};
await recovery.recover();assert.equal(storage.getItem('dos-cloud-choice:test'),null);
console.log('命令・差分: 共有参照・基準のキー順・入力検査・確定版のみの更新・選択の先行保管と再開 OK');

const wireTest={text:"魂の記録".repeat(10000)};const packed=await encodeCloudReply(wireTest);assert.equal(packed.wireFormat,"gzip-base64");assert.deepEqual(await decodeCloudReply(packed),wireTest);
// 攻撃以外の入力も、保存された人業・品・習得技から解決する。
const {ITEMS}=await import('../../src/items.js');
for(const kind of ['defend','run','spell','item']) {
 const s=refDeserialize(graph);Object.setPrototypeOf(s.battle,Battle.prototype);
 s.party[0].hp=50;s.party[0].mp=100;s.party[0].maxmp=100;s.party[0].spells=['DIOS'];
 const input={type:'battle',operation:'commit',actor:s.party[0].uid,action:kind};
 if(kind==='spell'){input.spellKey='DIOS';input.target={side:'party',uid:s.party[0].uid};}
 if(kind==='item'){s.party[0].items=[{...ITEMS.u_styptic_salve}];s.inventory=s.party[0].items;input.owner=s.party[0].uid;input.item=0;input.target={side:'party',uid:s.party[0].uid};}
 const result=resolveCloudCommand(s,input,{compact:true});assert(result.packet);
 if(kind==='spell'||kind==='item')assert(refDeserialize(result.packet).snapshot.party[0].hp>50);
}
console.log('戦闘命令: 攻撃・防御・逃走・習得済み回復技・道具のサーバー実行 OK');

// 別端末の先行した戦況へ古い選択を適用しない。退避に成功した後だけ選択を外す。
assert.throws(()=>resolveCloudCommand(refDeserialize(graph),{...command,round:999}),/cloud_revision_conflict/);
assert.throws(()=>resolveCloudCommand(refDeserialize(graph),{...command,rng:[0,0,0,0]}),/cloud_revision_conflict/);
storage.setItem('dos-cloud-choice:test',JSON.stringify({command}));
await recovery.archivePending({includeChoice:true});
assert.equal(storage.getItem('dos-cloud-choice:test'),null);
assert.deepEqual(JSON.parse(storage.getItem('dos-cloud-choice:test:recovery')).command,command);
storage.setItem('dos-cloud-choice:test','keep');
const originalSet=storage.setItem;storage.setItem=(key,value)=>{if(key.endsWith(':recovery'))throw Error('容量不足');originalSet(key,value)};
await assert.rejects(recovery.archivePending({includeChoice:true}));assert.equal(storage.getItem('dos-cloud-choice:test'),'keep');
storage.setItem=originalSet;
console.log('戦況競合: 古い手番/乱数の拒否・選択の退避後再開・退避失敗時の保全 OK');

const advancedBattle=refDeserialize(graph);advancedBattle.battle._commandToken='already-advanced';
assert.throws(()=>resolveCloudCommand(advancedBattle,{...command,token:null}),/cloud_revision_conflict/);
console.log('戦況識別: 同じ人業・ターン・乱数でも古い命令の別手番への適用を拒否 OK');
const movedItem=refDeserialize(graph);Object.setPrototypeOf(movedItem.battle,Battle.prototype);
movedItem.party[0].hp=50;movedItem.inventory=[{...ITEMS.u_styptic_salve,q:1}];movedItem.party[0].items=movedItem.inventory;
movedItem.battle.chooseAction('item',null,{owner:movedItem.party[0],item:movedItem.inventory[0]});movedItem.battle.chooseTarget(movedItem.party[0]);
const oldItemCommand=battleCommand(movedItem.battle,'commit',movedItem.rng);movedItem.inventory[0].q=2;
assert.throws(()=>resolveCloudCommand(movedItem,oldItemCommand),/cloud_revision_conflict/);
