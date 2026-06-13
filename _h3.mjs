const handler = {};
function mkEl() {
  const el = {
    style:{}, dataset:{}, classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    children:[], appendChild(c){this.children.push(c);return c;}, removeChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){return null;},
    querySelector(){return mkEl();}, querySelectorAll(){return [];},
    getContext(){return new Proxy({canvas:{},measureText:()=>({width:0}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:[]})},{get(t,p){if(p in t)return t[p];return typeof p==="string"?()=>{}:undefined;},set(){return true;}});},
    width:480,height:320,innerHTML:"",textContent:"",scrollTop:0,scrollHeight:0,offsetWidth:0,firstChild:null,onclick:null,disabled:false,
  };
  return el;
}
globalThis.document = { getElementById:()=>mkEl(), createElement:()=>mkEl(), body:mkEl(), addEventListener(){}, querySelector:()=>mkEl(), querySelectorAll:()=>[], hidden:false, visibilityState:"visible" };
globalThis.window = new Proxy({ addEventListener(){}, removeEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}}), location:{reload(){}} }, { get:(t,p)=>(p in t?t[p]:(globalThis[p]!==undefined?globalThis[p]:undefined)) });
Object.defineProperty(globalThis,"navigator",{value:{vibrate:null,serviceWorker:{register:()=>Promise.resolve(),addEventListener(){},controller:null}},configurable:true});
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
globalThis.AudioContext = class { constructor(){this.destination={};this.currentTime=0;this.state="running";} createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},connect(){return this;},disconnect(){}};} createOscillator(){return {frequency:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},type:"",connect(){return this;},start(){},stop(){},onended:null};} createBuffer(){return {getChannelData:()=>new Float32Array(1024)};} createBufferSource(){return {buffer:null,connect(){return this;},start(){},stop(){},loop:false,playbackRate:{value:1}};} createBiquadFilter(){return {frequency:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},Q:{value:0},type:"",connect(){return this;}};} resume(){return Promise.resolve();} };
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => 0 };

await import("./src/game.js");
console.log("GAME_LOAD_OK");

const S = await import("./src/souls.js");
const { setSharedSouls, makeDoll, recalcDoll, soulRankFromCount, soulLevelCap, jobStatsOf,
        JOB_SIGNATURE, ORDER_PERK, orderPassiveMap, sharedRank, MAX_SUBS } = S;

// 共有プールを用意
const souls = {};
setSharedSouls(souls);
const ensure = (k,c,l)=>{ souls[k]={count:c,level:l||1,exp:0}; };

// 1. 主魂: 共有 count→rank, stats
ensure("fighter", 1, 1);
const d = makeDoll("A"); d.primary="fighter"; recalcDoll(d);
if (d.cls!=="見習い戦士"||d.jobRank!==1) throw new Error("primary rank1: "+d.cls);
if (!d.spells.includes("KYOUGEKI")) throw new Error("primary skill");
const hp1 = d.base.hp;
souls.fighter.count = 11; recalcDoll(d); // rank2
if (d.jobRank!==2||d.cls!=="戦士") throw new Error("rank2: "+d.cls+" r"+d.jobRank);
if (d.base.hp<=hp1) throw new Error("count stat-up");

// 2. 共有: 同じ職業を複数人が宿すと同ランク (3戦士)
const d2=makeDoll("B"); d2.primary="fighter"; recalcDoll(d2);
const d3=makeDoll("C"); d3.primary="fighter"; recalcDoll(d3);
if (d2.jobRank!==2||d3.jobRank!==2) throw new Error("shared rank across dolls");
if (d2.base.hp!==d.base.hp) throw new Error("shared stats equal");

// 3. 宿し技: priest を rank2 にして sub に差すと、僧侶の看板技を借りる (ステは乗らない)
ensure("priest", 11, 1); // rank2
const sig = JOB_SIGNATURE.priest;
if (!sig) throw new Error("no signature for priest");
const hpBefore = d.base.hp;
d.subs=["priest"]; recalcDoll(d);
if (!d.spells.includes(sig)) throw new Error("sub signature skill not granted: "+sig);
if (d.base.hp!==hpBefore) throw new Error("sub should not add stats");
// rank<2 の sub は無効
ensure("mage", 1, 1); // rank1
const d4=makeDoll("D"); d4.primary="fighter"; d4.subs=["mage"]; recalcDoll(d4);
if (d4.spells.includes(JOB_SIGNATURE.mage)) throw new Error("rank1 sub should not grant skill");

// 4. 控えの結社: 編成外で rank2+ の職業がパーティパッシブを供給
ensure("thief", 11, 1); // rank2 thief → goldLuck order perk
const party=[d]; // d は fighter primary + priest sub。thief は編成外
const om = orderPassiveMap(party);
if (!(om.goldLuck>=1)) throw new Error("order perk goldLuck not applied: "+JSON.stringify(om));
// 編成に出すと結社加護は止まる
const party2=[d, (()=>{const x=makeDoll("T");x.primary="thief";recalcDoll(x);return x;})()];
const om2 = orderPassiveMap(party2);
if (om2.goldLuck) throw new Error("fielded thief should not give order perk");

console.log("SHARED_OK rank="+d.jobRank+" subs="+d.subs+" order="+JSON.stringify(om));
console.log("ALL_TESTS_OK");
