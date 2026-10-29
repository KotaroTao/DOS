// 武魂の正本。素材の合成価値は3進、効果はLvに比例する。
import { AFX } from "./infaffix.js";
import { rarityKey } from "./rarity.js";
import { random } from "./rng.js";
import { ELEMENT_KEYS, elementValues } from "./combatrules.js";
export const BUKON_SLOTS = { c:1, uc:1, r:2, sr:2, lr:3 };
export const BUKON_RARITIES = [
  {key:"c",name:"コモン",color:"#ddd",weight:80}, {key:"uc",name:"アンコモン",color:"#75c76b",weight:12.5},
  {key:"r",name:"レア",color:"#69aaff",weight:5}, {key:"sr",name:"スーパーレア",color:"#ff9a4a",weight:2}, {key:"lr",name:"レジェンドレア",color:"#ff6262",weight:.5}
];
const ALL=["weapon","shield","body","head","hands","feet","acc"], DEF=["shield","body","head","feet","acc"];
export const BUKON=[];
const add=d=>BUKON.push({max:10,slots:ALL,...d});
const stats={hp:"HP",mp:"MP",atk:"STR",vit:"VIT",agi:"AGI",int:"INT",pie:"PIE",luk:"LUK"};
for(const [stat,name] of Object.entries(stats)) {
 add({id:`flat_${stat}`,name:`${name}加算`,kind:"flat",stat,base:stat==="hp"?10:stat==="mp"?5:1,max:null,rarity:0});
 add({id:`pct_${stat}`,name:`${name}上昇`,kind:"pct",stat,base:5,rarity:1});
}
for(const [stat,name] of [["crit","物理会心率"],["spellCrit","魔法会心率"],["evade","物理回避率"],["critDamage","物理会心ダメージ"],["spellCritDamage","魔法会心ダメージ"]])
 add({id:stat,name:`${name}上昇`,kind:"rate",stat,base:stat.endsWith("Damage")?20:5,rarity:2,slots:stat==="evade"?["feet"]:["weapon","hands"]});
for(const [stat,name] of [["poison","毒"],["paralyze","麻痺"],["sleep","眠り"],["charm","魅了"],["confuse","混乱"],["stone","石化"],["seal","封印"],["flinch","怯み"],["death","即死"],["physResist","物理"],["magResist","魔法"]])
 add({id:`res_${stat}`,name:`${name}耐性上昇`,kind:"res",stat,base:5,rarity:stat.endsWith("Resist")?3:1,slots:stat==="physResist"?["shield","body"]:stat==="magResist"?["shield","body","head"]:DEF});
for(const [el,name] of Object.entries({fire:"火",water:"水",wind:"風",earth:"土",light:"光",dark:"闇"})) {
 add({id:`elem_atk_${el}`,name:`${name}属性攻撃力上昇`,kind:"elementAttack",stat:el,base:20,rarity:2,slots:["weapon"]});
 add({id:`elem_def_${el}`,name:`${name}属性ダメージ軽減`,kind:"elementDefense",stat:el,base:5,rarity:2,slots:DEF});
}
add({id:"res_allElements",name:"全属性耐性",kind:"elementDefense",stat:"all",base:5,rarity:4,slots:DEF});
const conditionNames=["HP50%以下で与ダメージ上昇","HP80%以上で被ダメージ軽減","HP30%以下の敵への与ダメージ上昇","1ターン目の与ダメージ上昇","3ターン目以降の与ダメージ上昇","先制した戦闘で与ダメージ上昇","主・強敵への与ダメージ上昇","敵3体以上で与ダメージ上昇","敵残り1体で与ダメージ上昇","味方戦闘不能時の与ダメージ上昇","自分だけ生存時の被ダメージ軽減","前列で被ダメージ軽減","後列で攻撃呪文ダメージ上昇","状態異常・怯み・弱体中の敵への与ダメージ上昇","弱点属性で与ダメージ上昇","防御中の被ダメージ軽減","強化中の与ダメージ上昇","MP50%以上で攻撃呪文ダメージ上昇",null,"状態異常の敵への物理会心率上昇","攻撃呪文の消費MP軽減","回復技の消費MP軽減","回復量上昇","ブレス被ダメージ軽減","全体呪文被ダメージ軽減"];
const condSlots={I02:["shield","body"],I10:["weapon","acc"],I11:["body","acc"],I12:["shield","body"],I16:["shield"],I17:["weapon","acc"],I20:["weapon","hands"],I21:["head","acc"],I22:["head","acc"],I23:["hands","acc"],I24:["shield","body"],I25:["shield","body","head"]};
for(const d of AFX.filter(d=>/^[GHI]\d/.test(d.id)&&d.id!=="I19"||/^F0[1-7]$/.test(d.id))) {
 const group=d.id[0], n=Number(d.id.slice(1));
 const text=d.text(.05,25), name=group==="F"?["毒","麻痺","眠り","混乱","魅了","封印","怯み"][n-1]+"付与":group==="I"?conditionNames[n-1]:group==="G"?text.split("への")[0]+"への与ダメージ上昇":text.split("から")[0]+"からの被ダメージ軽減";
 add({id:d.id,name,kind:"legacy",legacy:d,base:group==="G"?30:5,rarity:group==="F"?1:["I21","I22","I23"].includes(d.id)?3:2,slots:group==="H"?["shield","body"]:group==="I"?(condSlots[d.id]||["weapon"]):["weapon"]});
}
// 特殊武魂は既存付呪と別の値で成長する。固定機能3種だけはLvを持たない。
const special=[
 ["J02","戦闘開始時全体STR強化","acc",3,"order",10], ["J10","初手最優先行動","feet",4,"firstTurn",10],
 ["bukon_physRet","物理被弾時VIT反撃","body",4,"physRet",500],
 ["J11","戦闘不能時復活","acc",4,"reviveChance",5], ["J20","魔法被弾時VIT反撃","body",4,"mirror",5],
 ["X01","撃破時追加攻撃","weapon",4,"chain",10],["X02","低い抵抗値で物理攻撃","weapon",4,"twinSoul",10],
 ["X03","状態異常を隣へ伝播","weapon",4,"contagion",10],["X04","命中時物理耐性低下","weapon",3,"physDown",5],
 ["bukon_magDown","命中時魔法耐性低下","weapon",3,"magDown",5],["X05","会心時敵行動遅延","weapon",3,"witness",10],
 ["X06","通常攻撃で強化解除","weapon",3,"peel",10],["X07","物理一撃ダメージ制限","body",4,"fortress",5],
 ["X08","被ダメージ分割","body",4,"split",5],["X09","味方の致死攻撃を肩代わり","body",4,"cover",10],
 ["X10","戦闘不能時全体回復","body",3,"sendoff",10],["X11","低HP時被ダメージ軽減","body",4,"adversity",2],
 ["X12","精神耐性・強化解除防止","head",4,"steadMind",10],["X13","弱点属性ダメージ上昇","weapon",3,"weakDamage",30],
 ["X15","連続使用時消費MP軽減","head",3,"memory",5],["X16","奇襲時行動可能","head",3,"alarm",10],
 ["X17","未知の敵情報でオート判断","head",3,"insight",10],["X18","道具使用時手番消費なし","hands",3,"quick",10],
 ["X19","攻撃道具威力上昇","hands",3,"throw",10],["X20","同じ敵への連携ダメージ上昇","hands",3,"combo",2.5],
 ["X21","防御後物理回避","hands shield",3,"parryHold",10],["X22","過剰回復を全体へ分配","hands",3,"mercy",10],
 ["X23","物理命中時金貨奪取","hands",3,"pilfer",10],["X24","後列近接ダメージ減少緩和","feet",3,"stepIn",5],
 ["X25","回避後物理ダメージ上昇","feet",3,"afterImage",20],["X26","確率追加行動","feet",4,"dash",5],
 ["X27","能力低下無効","feet",3,"steady",10],["X28","金属の魔物逃走率低下","feet",3,"chaser",10],
 ["X29","蝕む床でHP回復","feet",3,"floatStep",.5],["X30","サブ魂借用枠追加","acc",4,"kindle",100],
 ["X31","強化・弱体持続延長","acc",4,"timeKeeper",100],["X33","能力低下反転","acc",4,"flip",100],
 ["X34","宝箱出現率・ランク上昇","acc",3,"treasure",5],["X35","魂経験値上昇","acc",3,"teller",10]
];
for(const [id,name,slots,rarity,stat,base] of special)add({id,name,slots:slots.split(" "),rarity,stat,base,kind:"special",max:["kindle","timeKeeper","flip"].includes(stat)?1:10});
// 削除した効果のIDは互換用に残す。抽選・装着は不可、所持分は移行時に同格の武魂へ交換。
for(const [id,to] of [["X14","spellCrit"],["X32","F06"]])add({id,name:"旧武魂",kind:"retired",base:0,rarity:3,slots:[],retired:true,replacement:to});
export const LEGENDARY_BUKON=BUKON.filter(d=>d.kind==="special");
export const LEGENDARY_MISC_KEYS=new Set([...special.map(d=>d[4]),...special.map(d=>`bk_${d[4]}`),"bk_treasureRank"]);
export const bukonDef=id=>BUKON.find(d=>d.id===id);
export const validBukon=b=>!!(b&&bukonDef(b.k)&&Number.isSafeInteger(b.lv)&&b.lv>=1&&(!bukonDef(b.k).max||b.lv<=bukonDef(b.k).max));
export const bukonSlots=it=>BUKON_SLOTS[rarityKey(it)]||1;
export function bukonExact(b){const d=bukonDef(b?.k);return validBukon(b)?BigInt(Math.round(d.base*100))*BigInt(b.lv)/100n:0n;}
const amount=b=>bukonDef(b.k).base*b.lv;
export function bukonText(b){
 if(!validBukon(b))return "不明な武魂";
 const d=bukonDef(b.k),v=amount(b),n=v.toLocaleString("ja-JP"),r=BUKON_RARITIES[d.rarity];
 let effect=d.kind==="flat"?`+${n}`:`+${n}%`;
 if(d.kind==="legacy")effect=d.legacy.text(v/100,25);
 if(d.kind==="elementAttack")effect=`属性ダメージ${100+v}%`;
 if(d.kind==="elementDefense")effect=`${n}%軽減（同属性合計80%まで）`;
 if(d.kind==="special")effect=specialText(d,v,b.lv);
 return `${r.name} ${d.max===1?"":`Lv${b.lv} `}${d.name}の武魂：${effect}`;
}
function specialText(d,v,lv){
 const n=v.toLocaleString("ja-JP");
 const text={reviveChance:`戦闘不能のたび${n}%でHP10%復活（合計50%まで）`,physDown:`命中時に物理耐性−${n}ポイント（重複せず最大50）`,magDown:`命中時に魔法耐性−${n}ポイント（重複せず最大50）`,fortress:`物理1発を最大HPの${100-v}%までに制限`,split:`被ダメージの${n}%を後払い`,sendoff:`戦闘不能時、味方全員HP${n}%回復・異常1つ治療`,adversity:`HP50%以下で${n}%、25%以下で${v*2}%軽減`,steadMind:`魅了・混乱・封印耐性+${lv*5}、${n}%で強化解除防止`,weakDamage:`弱点属性で与ダメージ+${n}%`,memory:`同じ技の連続使用で消費MP${n}%軽減（回復・蘇生除く）`,physRet:`物理を受けるとVIT×${v/100}の物理反撃`,mirror:`ブレス・呪文を受けるとVIT×${v/100}の魔法反撃`,contagion:`隣へ元の付与力の${n}%で状態異常を移す`,throw:`攻撃道具の威力${1+v/100}倍・推奨Lvで成長`,combo:`連携時与ダメージ+${n}%`,mercy:`過剰回復の${n}%を全員へ分配（再分配なし）`,pilfer:`物理命中時${n}%で金貨奪取（敵1体1回）`,stepIn:`後列近接の威力${50+v}%`,afterImage:`回避後の次の物理ダメージ+${n}%`,dash:`追加行動${n}%、AGI条件達成時${v*2}%（1ターン1回）`,chaser:`金属の魔物の逃走率${n}%低下`,floatStep:`蝕む床でHP${n}%回復`,kindle:"サブ魂借用枠+1（常時）",timeKeeper:"強化・弱体の持続+1ターン（必ず）",flip:"−3段を+3段へ反転（1戦闘1回、必ず）",treasure:`宝箱出現率+${n}%、${lv*10}%でランク+1（隊で最高Lv）`,teller:`隊全員の魂経験値+${n}%（隊で最高Lv）`};
 return text[d.stat]||`${n}%で発動${["chain","quick","cover"].includes(d.stat)?"（追加攻撃は1ターン1回、道具・肩代わりは1戦闘1回）":""}`;
}
export function bukonFits(it,b){const d=bukonDef(b?.k);return !!d&&!d.retired&&d.slots.includes(it?.slot);}
export function bukonStock(g) { return g.bukonStock ||= {}; }
export const bukonKey = b => `${b.k}:${b.lv}`;
export function stockRows(g) {
  return Object.entries(bukonStock(g)).filter(([, n]) => BigInt(n) > 0n).map(([key, n]) => {
    const [k, lv] = key.split(":"); return { k, lv: Number(lv), count: n, protected: !!g.bukonProtected?.[key] };
  }).filter(validBukon).sort((a,b) => a.k.localeCompare(b.k) || b.lv-a.lv);
}
export function stockAdd(g, b, n = 1n) {
  if (!validBukon(b)) return false;
  const s = bukonStock(g), key = bukonKey(b), next = BigInt(s[key] || 0) + BigInt(n);
  if (next < 0n) return false;
  if (next) s[key] = next.toString(); else delete s[key];
  return true;
}
export function recoverBukon(g, it) {
  if (!it || it.soulMemory) return 0;
  const list = it.bukon || [];
  for (const b of list) stockAdd(g, b);
  delete it.bukon;
  return list.length;
}
export function attachBlock(it, b) {
  if (!validBukon(b)) return "武魂を選んでください";
  if (!it || !["weapon","shield","body","head","hands","feet","acc"].includes(it.slot)) return "装備品にだけ宿せる";
  if (!bukonFits(it,b)) return "この部位には宿せない武魂";
  if (it.unidentified || it.soulMemory || it.cursed || it.locked) return "未鑑定・記憶・呪い・保護中の装備には宿せない";
  if (it.bukon?.some(x => x.k === b.k)) return "同じ効果の武魂は一つの装備に一つまで";
  if ((it.bukon?.length || 0) >= bukonSlots(it)) return "武魂の枠がいっぱい";
  return null;
}
export function attachBukon(g, it, b) {
  if (attachBlock(it,b) || !stockAdd(g,b,-1n)) return false;
  (it.bukon ||= []).push({ k:b.k, lv:b.lv }); return true;
}
export function detachBukon(g, it, index) {
  if (!it || it.soulMemory || it.cursed || it.locked || !it.bukon?.[index]) return false;
  stockAdd(g,it.bukon[index]); it.bukon.splice(index,1); return true;
}
// 目標より低いレベルだけを、高レベルから必要数だけ選ぶ。3進のため端数や価値の喪失がない。
export function maxFusionLevel(g,k){
 let value=0n;for(const b of stockRows(g).filter(b=>b.k===k))value+=BigInt(b.count)*3n**BigInt(b.lv-1);
 let lv=1;while(value>=3n){value/=3n;lv++;}return Math.min(bukonDef(k)?.max||Infinity,lv);
}
export function fusionGold(k,target){
 const d=bukonDef(k);if(!d||d.retired||d.max===1||!Number.isSafeInteger(target)||target<2||d.max&&target>d.max)return null;
 const n=BigInt(target-2);
 if(d.kind!=="flat")return 100n*2n**n;
 const den=10n**n;return (100n*11n**n+den-1n)/den;
}
export function bulkFusionPlan(g,k,keep=1){
 if(!bukonDef(k)||!/^\d+$/.test(String(keep))||bukonDef(k).max===1)return null;
 const draft={...g,bukonStock:{...bukonStock(g)}};let cost=0n,changed=false;
 const d=bukonDef(k),reserve=BigInt(keep);let lv=Math.min(...stockRows(draft).filter(b=>b.k===k).map(b=>b.lv));
 while(Number.isFinite(lv)&&(!d.max||lv<d.max)){
  const key=`${k}:${lv}`,n=BigInt(draft.bukonStock[key]||0),count=!g.bukonProtected?.[key]&&n>reserve?(n-reserve)/3n:0n;
  if(count){stockAdd(draft,{k,lv},-count*3n);stockAdd(draft,{k,lv:lv+1},count);cost+=fusionGold(k,lv+1)*count;changed=true;}
  const next=stockRows(draft).filter(b=>b.k===k&&b.lv>lv);if(!next.length)break;lv=Math.min(...next.map(b=>b.lv));
 }
 return changed?{stock:draft.bukonStock,cost}:null;
}
export function fusionPlan(g, k, target, keep = 0) {
  const d = bukonDef(k);
  if (!d || d.retired || d.max===1 || !Number.isSafeInteger(target) || target < 2 || d.max && target > d.max) return null;
  let need = 3n ** BigInt(target - 1);
  const consume = [];
  for (const b of stockRows(g).filter(b => b.k === k && b.lv < target && !b.protected).sort((a,b) => b.lv-a.lv)) {
    const unit = 3n ** BigInt(b.lv-1), available = BigInt(b.count) > BigInt(keep) ? BigInt(b.count)-BigInt(keep) : 0n;
    const count = available < need/unit ? available : need/unit;
    if (count) { consume.push({k,lv:b.lv,count:count.toString()}); need -= count*unit; }
  }
  return need ? null : { k, lv:target, consume, cost:fusionGold(k,target) };
}
export function fuseBukon(g, k, target, keep = 0) {
  const plan = fusionPlan(g,k,target,keep); if (!plan || !payFusion(g,plan.cost)) return false;
  for (const b of plan.consume) stockAdd(g,b,-BigInt(b.count));
  stockAdd(g,plan); return true;
}
function payFusion(g,cost){if(cost==null||!Number.isSafeInteger(g.gold)||g.gold<0||cost>BigInt(g.gold))return false;g.gold-=Number(cost);return true;}
export function bulkFuseBukon(g,k,keep=1){const plan=bulkFusionPlan(g,k,keep);if(!plan||!payFusion(g,plan.cost))return false;g.bukonStock=plan.stock;return true;}
export function rollBukon(it,progress=6,rnd=random){
 const gear={r:0,sr:1,lr:2}[rarityKey(it)];if(gear==null)return null;
 let x=rnd()*100,rarity=0;for(let i=0;i<BUKON_RARITIES.length;i++){if((x-=BUKON_RARITIES[i].weight)<0){rarity=i;break;}}
 // 先に格を抽選するため、装備部位で格の確率は変わらない。装着可能な種類だけ選ぶ。
 const pool=BUKON.filter(d=>!d.retired&&d.rarity===rarity),fits=pool.filter(d=>d.slots.includes(it.slot));
 const choices=fits.length?fits:pool;
 if(!choices.length)return null;
 const d=choices[Math.min(choices.length-1,Math.floor(rnd()*choices.length))];
 const max=Math.min(d.max||Infinity,2+Math.floor(Math.max(0,progress-6)/3)+gear);
 let lv=1;while(lv<max&&rnd()<.18+gear*.14)lv++;return {k:d.id,lv};
}
export const activeBukon=it=>(it?.bukon||[]).filter(b=>validBukon(b)&&bukonFits(it,b)).slice(0,bukonSlots(it));
export function bukonItem(it,{legendarySeen=new Set(),specialLevels=null}={}){
 if(!it?.bukon?.length)return it;
 const out={...it,mult:{...it.mult},resists:{...it.resists},afxFx:[...(it.afxFx||[])],afxMisc:{...it.afxMisc},eff:{...it.eff},bukonElementDef:{...it.bukonElementDef}};
 for(const b of activeBukon(it)){
  const d=bukonDef(b.k);if(!bukonFits(it,b))continue;const v=amount(b);
  if(d.kind==="flat")out[d.stat]=(out[d.stat]||0)+Number(bukonExact(b));
  if(d.kind==="pct")out.mult[d.stat]=(out.mult[d.stat]||0)+v/100;
  if(d.kind==="rate")out[d.stat]=(out[d.stat]||0)+v/100;
  if(d.kind==="res")out.resists[d.stat]=(out.resists[d.stat]||0)+v;
  if(d.kind==="elementAttack"){const values={...elementValues(out.eAtk)};values[d.stat]=(values[d.stat]||0)+v;out.eAtk={values};}
  if(d.kind==="elementDefense")for(const el of d.stat==="all"?ELEMENT_KEYS:[d.stat])out.bukonElementDef[el]=(out.bukonElementDef[el]||0)+v/100;
  if(d.kind==="legacy"){
   if(d.legacy.apply)d.legacy.apply(out,v/100,25);
   if(d.legacy.fx)out.afxFx.push(...d.legacy.fx(v/100,25).map(c=>({c:{...c,bukon:true,uncapped:d.id[0]==="G"},label:d.name})));
  }
  if(d.kind==="special"){
   if(legendarySeen.has(d.id)||specialLevels&&specialLevels.get(d.id)!==b.lv)continue;legendarySeen.add(d.id);
   const m=out.afxMisc,key=d.stat;
   if(["kindle","timeKeeper","flip"].includes(key))m[key]=true;
   else if(key==="order")out.afxFx.push({c:{t:"start",chance:v/100,once:"bukonOrder",party:true,buff:{atk:1.25},dur:2},label:d.name});
   else if(key==="physRet")out.afxFx.push({c:{t:"hurt",on:"phys",ret:{stat:"vit",k:v/100,magic:false}},label:d.name});
   else if(key==="mirror")out.afxFx.push({c:{t:"hurt",on:"magic",ret:{stat:"vit",k:v/100,magic:true}},label:d.name});
   else if(key==="weakDamage"||key==="combo")out.afxFx.push({c:{t:"deal",v:v/100,bukon:true,uncapped:key==="weakDamage",when:key==="combo"?{combo:true}:{tgtWeak:true}},label:d.name});
   else if(key==="steadMind"){for(const k of ["charm","confuse","seal"])out.resists[k]=(out.resists[k]||0)+b.lv*5;m.bk_steadMind=v/100;}
   else if(["chain","twinSoul","peel","witness","cover","firstTurn","alarm","insight","quick","parryHold","steady"].includes(key))m[`bk_${key}`]=v/100;
   else if(key==="fortress")m.bk_fortress=1-v/100;
   else if(key==="treasure"){m.bk_treasure=v/100;m.bk_treasureRank=b.lv/10;}
   else m[`bk_${key}`]=v/100;
  }
 }
 return out;
}
// 部位変更・廃止効果は失わず保管へ。旧上限を超える固定機能はLv1へ正規化。
export function migrateBukon(g,items){
 let changed=false;
 const normalize=b=>{const d=bukonDef(b?.k);if(!d)return b;return {k:d.replacement||b.k,lv:Math.min(b.lv,bukonDef(d.replacement||b.k).max||b.lv)};};
 for(const [key,n] of Object.entries(g.bukonStock||{})){const [k,l]=key.split(":"),b=normalize({k,lv:Number(l)});if(b.k!==k||b.lv!==Number(l)){delete g.bukonStock[key];stockAdd(g,b,BigInt(n));if(g.bukonProtected?.[key]){delete g.bukonProtected[key];g.bukonProtected[bukonKey(b)]=true;}changed=true;}}
 for(const it of new Set(items.filter(Boolean))){if(it.soulMemory||!it.bukon)continue;const keep=[];for(const old of it.bukon){const b=normalize(old);if(b.k!==old.k||b.lv!==old.lv)changed=true;if(bukonFits(it,b)&&keep.length<bukonSlots(it))keep.push(b);else{stockAdd(g,b);changed=true;}}it.bukon=keep;}
 return changed;
}
