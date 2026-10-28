// 武魂の台帳・合成。個数と合成価値は十進文字列で保存し、BigIntで正確に計算する。
import { AFX } from "./infaffix.js";
import { rarityKey } from "./rarity.js";
import { random } from "./rng.js";
export const BUKON_SLOTS = { c: 1, uc: 2, r: 3, sr: 4, lr: 5 };
export const BUKON = [];
const add = d => BUKON.push(d);
const stats = { hp: "HP", mp: "MP", atk: "STR", vit: "VIT", agi: "AGI（SPD）", int: "INT", pie: "PIE", luk: "LUK" };
for (const [s, name] of Object.entries(stats)) {
  add({ id: `flat_${s}`, name, kind: "flat", stat: s, base: s === "hp" ? 10 : s === "mp" ? 5 : 1, max: null, rarity: 0 });
  add({ id: `pct_${s}`, name, kind: "pct", stat: s, base: 1, max: 9, rarity: 1 });
}
for (const [s, name] of [["crit", "会心率"], ["spellCrit", "魔法会心率"], ["evade", "回避率"]])
  add({ id: s, name, kind: "rate", stat: s, base: 1, max: 7, rarity: 1 });
for (const [s, name] of [["poison","毒"],["paralyze","麻痺"],["sleep","眠り"],["charm","魅了"],["confuse","混乱"],["stone","石化"],["seal","封印"],["flinch","怯み"],["death","即死"],["physResist","物理"],["magResist","魔法"]]) {
  const rare = s.endsWith("Resist");
  add({ id: `res_${s}`, name: `${name}耐性`, kind: "res", stat: s, base: 1, max: rare ? 4 : 7, rarity: rare ? 4 : 1 });
}
for (const [s, name] of [["critDamage", "会心ダメージ"], ["spellCritDamage", "魔法会心ダメージ"]])
  add({ id: s, name, kind: "rate", stat: s, base: 5, max: 7, rarity: 2 });
// 従来の付呪から、条件つき攻防・種族特効・命中時効果を引き継ぐ。全装備で使用可能。
for (const d of AFX.filter(d => /^[GHI]\d/.test(d.id) && d.id !== "I19" || /^F0[1-7]$/.test(d.id)))
  add({ id: d.id, name: d.name.replace(/の$/, ""), kind: "legacy", legacy: d, base: 5, max: 4, rarity: d.tier === "r" ? 2 : 1 });
export const bukonDef = id => BUKON.find(d => d.id === id);
export const validBukon = b => !!(b && bukonDef(b.k) && Number.isSafeInteger(b.lv) && b.lv >= 1 && (!bukonDef(b.k).max || b.lv <= bukonDef(b.k).max));
export const bukonSlots = it => BUKON_SLOTS[rarityKey(it)] || 1;
export function bukonExact(b) { return validBukon(b) ? BigInt(bukonDef(b.k).base) * 2n ** BigInt(b.lv - 1) : 0n; }
export function bukonText(b) {
  if (!validBukon(b)) return "不明な武魂";
  const d = bukonDef(b.k), value = bukonExact(b), n = value.toString();
  const shown = n.length > 18 ? `${n.slice(0, 1)}.${n.slice(1, 5)}×10^${n.length - 1}` : value.toLocaleString("ja-JP");
  const effect = d.kind === "legacy" ? d.legacy.text(Number(value) / 100, 25) : `${d.name}+${shown}${d.kind === "flat" ? "" : "%"}`;
  return `${d.rarity >= 4 ? "★激レア " : ""}Lv${b.lv} ${effect}`;
}
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
export function fusionPlan(g, k, target, keep = 0) {
  const d = bukonDef(k);
  if (!d || !Number.isSafeInteger(target) || target < 2 || d.max && target > d.max) return null;
  let need = 3n ** BigInt(target - 1);
  const consume = [];
  for (const b of stockRows(g).filter(b => b.k === k && b.lv < target && !b.protected).sort((a,b) => b.lv-a.lv)) {
    const unit = 3n ** BigInt(b.lv-1), available = BigInt(b.count) > BigInt(keep) ? BigInt(b.count)-BigInt(keep) : 0n;
    const count = available < need/unit ? available : need/unit;
    if (count) { consume.push({k,lv:b.lv,count:count.toString()}); need -= count*unit; }
  }
  return need ? null : { k, lv:target, consume };
}
export function fuseBukon(g, k, target, keep = 0) {
  const plan = fusionPlan(g,k,target,keep); if (!plan) return false;
  for (const b of plan.consume) stockAdd(g,b,-BigInt(b.count));
  stockAdd(g,plan); return true;
}
export function bulkFuseBukon(g, k, keep = 1) {
  if (!bukonDef(k) || !/^\d+$/.test(String(keep))) return false;
  const reserve=BigInt(keep), d=bukonDef(k);
  const rows=stockRows(g).filter(b=>b.k===k);
  if (!rows.length) return false;
  let lv=Math.min(...rows.map(b=>b.lv));
  while (!d.max || lv < d.max) {
    const b={k,lv},key=bukonKey(b),n=BigInt(bukonStock(g)[key] || 0);
    const count=n>reserve?(n-reserve)/3n:0n;
    if(!g.bukonProtected?.[key] && count) { stockAdd(g,b,-count*3n); stockAdd(g,{k,lv:lv+1},count); }
    const next=stockRows(g).filter(b=>b.k===k && b.lv>lv);
    if(!next.length)break;
    lv=Math.min(...next.map(b=>b.lv));
  }
  return true;
}
export function rollBukon(it, progress = 6, rnd = random) {
  const rarity = { r:0, sr:1, lr:2 }[rarityKey(it)];
  if (rarity == null) return null;
  const weights = BUKON.map(d => [d, [100,30,6,1,0.04][d.rarity] * (d.rarity ? (1+rarity*.8) ** d.rarity : 1)]);
  let x = rnd()*weights.reduce((s,[,w]) => s+w,0), d = weights[0][0];
  for (const [candidate,w] of weights) if ((x-=w)<0) { d=candidate; break; }
  const maxDrop = Math.min(d.max || Infinity, 2+Math.floor(Math.max(0,progress-6)/3)+rarity);
  let lv=1; while(lv<maxDrop && rnd()<.18+rarity*.14) lv++;
  return { k:d.id,lv };
}
// 効果は本体の価格・品質・鍛造を変えず、能力集計時の作業用の写しにだけ適用する。
export function bukonItem(it) {
  if (!it?.bukon?.length) return it;
  const out = {...it, mult:{...it.mult}, resists:{...it.resists}, afxFx:[...(it.afxFx || [])]};
  for (const b of it.bukon.filter(validBukon)) {
    const d=bukonDef(b.k), v=Number(bukonExact(b));
    if(d.kind === "flat") out[d.stat]=(out[d.stat] || 0)+v;
    if(d.kind === "pct") out.mult[d.stat]=(out.mult[d.stat] || 0)+v/100;
    if(d.kind === "rate") out[d.stat]=(out[d.stat] || 0)+v/100;
    if(d.kind === "res") out.resists[d.stat]=(out.resists[d.stat] || 0)+v;
    if(d.kind === "legacy") {
      if(d.legacy.apply) d.legacy.apply(out,v/100,25);
      if(d.legacy.fx) out.afxFx.push(...d.legacy.fx(v/100,25).map(c=>({c,label:d.name})));
    }
  }
  return out;
}
