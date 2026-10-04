// ===== 品 — 入手の割り込み方針 (トースト/祝祭)・品シート (ItemSheet)・NEW 印 =====
// 担当: WP-C。
// 提供する契約:
//   UI.loot(item, who, { source, celebrate, silent, keepPrompt }, next)
//       入手の割り込み方針 (§3.6): コモン/アンコモン・道具 = トースト (+収穫バーの数) で
//       next をすぐ呼ぶ。レア/スーパーレア/レジェンドレア・宝物庫にまだ無い収集品 = 祝祭カード (閉じてから next)。
//   UI.itemSheet(item, { owner, context, actions, price, stockId, target, onClose })
//       品シート: レア度の縁・絵・性能・装備できる者・比べる相手との増減・来歴・文脈ごとの操作。
//       context: "bag" (所持品) | "donate" (宝物庫: 渡す→奉納) | "sell" (商会の売る) | "stock" (商会の棚) | "equipped" | "loot" | "view" (見るだけ)
//   UI.identifyChooser(item, { onDone })  … 鑑定する者を選ぶシート (成功率つき・街なら商会の確実な鑑定も)
//   UI.openDollChooser(item, { owner, mode, buyId }) … 人業を選んで装備 (/袋へ) するシート。押せばその場で装備・「元に戻す」
//       (持ち物の品で WP-B の UI.equipChooser があればそちらを開く。装備できない理由は UI.canEquipReason があればそれ)
//   UI.markSeen(item) / UI.newCount()     … NEW 印 (入手で付き、品シートを開くと消える)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, sheet, toast, button, confirm, setText, glyph, plainText } from "./kit.js";
import { deltaFloat } from "./motion.js";
import {
  statLines, isEquippable, equipPreviewDelta, gearScore as baseGearScore, itemCatText,
  elemDetailLines, equipClassText, elemStatEq, elemStatShort, ailDetailLines,
} from "./itemview.js";
import { spriteCanvas } from "../sprites.js";
import { dollSprite, SOUL_CLASSES, canIdentify, identifyChance, identifyLabel, JOB_GEAR } from "../souls.js";
import { ITEMS, itemName, canEquip, slotKeyFor, MAX_ITEMS, SLOTS, SLOT_LABEL, weaponRange, RANGE_LABEL, WEAPON_CAT_LABEL } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";

// レア度ごとの入手演出: 見出し・振動・画面の閃光 (game.js の showItemGet から移設)
export const RARITY_FANFARE = {
  c: { banner: "✦ アイテム発見 ✦" },
  uc: { banner: "✦ アンコモン発見 ✦" },
  r: { banner: "✦ レアアイテム発見！ ✦", buzz: [0, 40, 50, 40] },
  sr: { banner: "★ スーパーレア発見！ ★", flash: "#ff9a2e", buzz: [0, 60, 50, 60, 50, 120], big: true },
  lr: { banner: "★★ レジェンドレア ★★", flash: "#ff3b3b", buzz: [0, 80, 60, 80, 60, 80, 300], big: true, legend: true },
};
// 収集品 (レア度を持たない) の入手演出
const MISC_FANFARE = { banner: "✦ 収集品発見！ ✦", buzz: [0, 40, 50, 40] };
// 祝祭カード (ポップアップ) で割り込む格 (§3.6・レア以上)。それ未満はトースト
export const CELEBRATE_RARITIES = new Set(["r", "sr", "lr"]);
// 宝物庫にまだ奉納していない収集品か (奉納済みの種類は売るだけの品なのでトーストで足りる)
const isNewCollectible = (it) => {
  if (!it || it.slot !== "misc") return false;
  const don = G().treasury && G().treasury.donated;
  return !(don && don[it.id]);
};
// 祝祭カードで知らせる品か (レア以上の装備と、宝物庫にまだ無い収集品)
export const isCelebrated = (it) => !!it && (CELEBRATE_RARITIES.has(rarityKey(it)) || isNewCollectible(it));

// ---------------------------------------------------------------- 小道具
const G = () => game.G || {};
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音は演出のみ */ } };
const buzz = (p) => { try { if (game.buzz) game.buzz(p); } catch (e) { /* noop */ } };
const allDolls = () => { try { return game.allDolls ? game.allDolls() : [...(G().party || []), ...(G().reserve || [])]; } catch (e) { return []; } };
const inTown = () => G().state === "town";
const inDungeon = () => { const s = G().state; return s === "board" || s === "combat" || s === "over"; };
const rarColor = (it) => { const k = rarityKey(it); return k ? RARITIES[k].color : null; };

// 商会が開いているか (第0章は閉ざされている)
export function shopOpen() {
  if (!inTown()) return false;
  let a = null;
  try { a = game.tutorialAllowed ? game.tutorialAllowed() : null; } catch (e) { a = null; }
  return !a || a.includes("shop");
}

// 品の持ち主 (所持品 or 装備)
export function ownerOf(item) {
  if (!item) return null;
  for (const d of allDolls()) {
    const i = (d.items || []).indexOf(item);
    if (i >= 0) return { doll: d, where: "bag", index: i };
    for (const k of SLOTS) if (d.equip && d.equip[k] === item) return { doll: d, where: "equip", key: k };
  }
  return null;
}

// 装備させられる相手 (街: 隊と控えの生きている者 / 迷宮: 隊の生きている者)
export function equipCandidates() {
  const list = inTown() ? allDolls() : (G().party || []);
  return list.filter((d) => d && d.alive && !d.isEmpty);
}
// 品を渡せる相手 (迷宮では隊の生きている者だけ = 従来の「渡す」と同じ)
function giveCandidates(exclude) {
  const list = inTown() ? allDolls() : (G().party || []).filter((d) => d.alive);
  return list.filter((d) => d && d !== exclude && !d.isEmpty);
}

const scoreOf = (d, delta) => {
  try { return (typeof UI.gearScore === "function" ? UI.gearScore : baseGearScore)(d, delta); } catch (e) { return baseGearScore(d, delta); }
};

// この人業がこの品を装備したときの増減 (装備できなければ null)
export function deltaFor(d, it) {
  if (!d || !it || it.unidentified || !isEquippable(it) || !canEquip(d, it)) return null;
  try { return equipPreviewDelta(d, it); } catch (e) { return null; }
}
function equippedBy(d, it) { for (const k of SLOTS) if (d.equip && d.equip[k] === it) return k; return null; }

// 比べる相手の見立て: 最良の装備者 (WP-B の UI.bestWearer) → 自分で採点 → 装備できる最初の者
//   { target, delta, score, scores:[{d, delta, score, can}] }
export function wearPlan(it, { owner = null, pool = null } = {}) {
  const cands = pool || equipCandidates();
  const scores = cands.map((d) => {
    const can = !it.unidentified && isEquippable(it) && canEquip(d, it);
    const delta = can && !equippedBy(d, it) ? deltaFor(d, it) : null;
    return { d, can, delta, score: delta ? scoreOf(d, delta) : (can ? 0 : -Infinity) };
  });
  if (it.unidentified || !isEquippable(it)) return { target: null, delta: null, score: 0, scores };
  let pick = null;
  try {
    const bw = typeof UI.bestWearer === "function" ? UI.bestWearer(it) : null;
    if (bw) pick = scores.find((s) => s.d === bw) || null;
  } catch (e) { pick = null; }
  if (!pick) {
    for (const s of scores) if (s.can && s.delta && s.score > 0 && (!pick || s.score > pick.score)) pick = s;
  }
  // 持ち主が装備でき、最良に近い (8割以上) なら持ち主を優先 (勝手に他の者へ回さない)
  const own = owner && scores.find((s) => s.d === owner && s.can && s.delta);
  if (own && own.score > 0 && (!pick || own.score >= pick.score * 0.8)) pick = own;
  if (!pick) pick = (owner && scores.find((s) => s.d === owner && s.can)) || scores.find((s) => s.can) || null;
  return { target: pick ? pick.d : null, delta: pick ? pick.delta : null, score: pick ? pick.score : 0, scores };
}

// 誰かの今の装備に勝る品か (装備すると強くなる者がいる)。まとめて売るから外し、札に ▲ を付ける
export function isUpgrade(it, opts) {
  if (!it || it.unidentified || !isEquippable(it)) return false;
  const plan = wearPlan(it, opts);
  return !!(plan.target && plan.delta && plan.score > 0);
}

// 小さな人形の絵 (キャンバス)
export function dollIcon(d, scale = 2) {
  const w = el("span", "wpc-dic");
  // 肖像は WP-B の UI.partyPortraitCanvas (隊の絵の差し替え点) で描く。無ければ従来のスプライト
  try {
    if (typeof UI.partyPortraitCanvas === "function") w.appendChild(UI.partyPortraitCanvas(d, scale * 12));
    else w.appendChild(spriteCanvas(dollSprite(d), scale));
  } catch (e) { /* 絵が無くても動く */ }
  const cls = d && d.dominant && SOUL_CLASSES[d.dominant.clsKey];
  if (cls && cls.glow) w.style.setProperty("--glow", cls.glow);
  return w;
}
// ▾ の線画
export function caretIcon(cls = "wpc-caret") {
  const ns = "http://www.w3.org/2000/svg";
  const sv = document.createElementNS(ns, "svg");
  sv.setAttribute("viewBox", "0 0 24 24");
  sv.setAttribute("aria-hidden", "true");
  sv.setAttribute("class", cls);
  sv.innerHTML = '<path d="M6 9.5l6 6 6-6"/>';
  return sv;
}
// 名前 (レア度の色)
// 初ゲット！ = 鑑定で正体を初めて知った品 (game.js の revealIdentity が、その起動の間だけ印をつける)
export const FIRST_LABEL = "初ゲット！";
export const firstBadge = (cls = "") => el("span", "first-get" + (cls ? " " + cls : ""), FIRST_LABEL);
export const isFirstGet = (it) => !!(it && game.isFirstGet && game.isFirstGet(it));
export function nameSpan(it, cls = "wpc-nm") {
  const s = el("span", cls, itemName(it));
  const k = rarityKey(it);
  if (k) s.classList.add("rar-" + k);
  return s;
}
// 増減の短い表記 (▲緑/▼赤)。属性の変化も添える
export function deltaEl(delta, { empty = "変化なし" } = {}) {
  const w = el("span", "ui-delta wpc-delta");
  if (!delta) { w.appendChild(el("span", "eq", empty)); return w; }
  // 攻撃力 (ATK + 武器の能力補正) を先頭に。ATK は攻撃力と同じだけ動いた時は省く
  const L = [["power", "攻撃力"], ["atk", "ATK"], ["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["luk", "LUK"], ["hp", "HP"], ["mp", "MP"]];
  let any = false;
  for (const [k, lb] of L) {
    const v = delta[k];
    if (!v || typeof v !== "number" || (k === "atk" && delta.power === v)) continue;
    any = true;
    w.appendChild(el("span", v > 0 ? "up" : "dn", `${v > 0 ? "▲" : "▼"}${lb}${v > 0 ? "+" : ""}${v}`));
  }
  if (delta.crit) { any = true; w.appendChild(el("span", delta.crit > 0 ? "up" : "dn", `${delta.crit > 0 ? "▲" : "▼"}会心${delta.crit > 0 ? "+" : ""}${delta.crit}%`)); }
  const lv = (e) => (e && e.el ? Math.min(2, e.lv || 1) : 0);
  for (const [lb, ch] of [["属攻", delta.elemAtk], ["属防", delta.elemDef]]) {
    if (!ch || elemStatEq(ch.from, ch.to)) continue;
    any = true;
    // 「属防 —→火◎」(いま → 装備後)。段が上がれば緑、下がれば赤
    w.appendChild(el("span", lv(ch.to) >= lv(ch.from) ? "up" : "dn", `${lb} ${elemStatShort(ch.from)}→${elemStatShort(ch.to)}`));
  }
  if (!any) w.appendChild(el("span", "eq", empty));
  return w;
}
// 金貨つきの値段 (●120)
export function goldEl(n, cls = "wpc-gold") {
  const s = el("span", cls);
  s.appendChild(glyph("gold"));
  s.appendChild(document.createTextNode(String(n)));
  return s;
}

// 画面の描き直し (街 = 街シェル / 迷宮 = 隊の札とステータス)
export function refreshViews() {
  try {
    const g = G();
    if (g.statusOpen && game.renderStatus) game.renderStatus();
    if (g.state === "town") { if (game.renderTown) game.renderTown(); }
    else if (game.renderParty) game.renderParty();
  } catch (e) { setTimeout(() => { throw e; }); }
}

// ---------------------------------------------------------------- NEW 印
export function markSeen(it) { if (it && it.isNew) delete it.isNew; }
export function newCount() {
  let n = 0;
  for (const d of allDolls()) for (const it of (d.items || [])) if (it && it.isNew) n++;
  return n;
}

// ---------------------------------------------------------------- 操作 (データは単体操作と同じ)
// 装備させる (WP-B の UI.equipItemTo。Phase 0 は equipFromAnywhere のスタブ)
export function equipTo(d, it, { quiet = false } = {}) {
  if (!d || !it) return false;
  const delta = deltaFor(d, it);
  let r = null;
  try { r = UI.equipItemTo ? UI.equipItemTo(d, it) : null; } catch (e) { r = null; setTimeout(() => { throw e; }); }
  // 結果の真偽は「実際に装備されたか」で見る (スタブは失敗でも ok を返すことがある)
  const ok = !!(r && r.ok !== false) && !!equippedBy(d, it);
  if (ok) {
    if (!quiet) {
      const t = toast(`${d.name} が ${it.name} を装備した`, { tone: "good", icon: it });
      if (t && delta) t.el.querySelector(".ui-toast-t").appendChild(deltaEl(delta));
    }
  } else if (!quiet) {
    toast(equipFailReason(d, it), { tone: "bad" });
  }
  refreshViews();
  return !!ok;
}
function equipFailReason(d, it) {
  if (!canEquip(d, it)) return `${d.name} は ${it.name} を装備できない`;
  return `${d.name} の持ち物がいっぱいで入れ替えられない`;
}

// 渡す (所持品から別の人業の所持品へ。従来の「渡す」と同じ)
function giveTo(owner, it, to) {
  const i = owner.items.indexOf(it);
  if (i < 0 || !to || to.items.length >= MAX_ITEMS) return false;
  owner.items.splice(i, 1);
  to.items.push(it);
  if (game.log) game.log(`${itemName(it)} を ${owner.name} → ${to.name} に渡した`, "win");
  sfx("select");
  toast(`${itemName(it)} → ${to.name}`, { tone: "info", icon: it });
  if (game.autosave) game.autosave(true);
  refreshViews();
  return true;
}

// 捨てる (確認ののち。従来の dropItem と同じ: 二度と戻らない)
async function discard(owner, it) {
  const ok = await confirm({
    banner: "捨てる", title: `${itemName(it)} を捨てる？`,
    lines: ["捨てた品は二度と戻らない。"], okLabel: "捨てる", danger: true,
  });
  if (!ok) return false;
  const i = owner.items.indexOf(it);
  if (i < 0) return false;
  owner.items.splice(i, 1);
  if (game.log) game.log(`${itemName(it)}を捨てた`, "sys");
  sfx("select");
  if (game.autosave) game.autosave(true);
  refreshViews();
  return true;
}

// 売る (商会。警告のある品・未鑑定品は確かめてから)
export async function sellOne(owner, it) {
  if (!shopOpen() || !owner) return false;
  const warns = (game.sellWarnings ? game.sellWarnings(it) : []).map((w) => plainText(w).replace(/^⚠\s*/, ""));
  const price = it.unidentified ? 0 : game.sellPrice(it);
  if (it.unidentified) {
    const ok = await confirm({
      banner: "鑑定せずに売る", title: `${itemName(it)} を正体不明のまま売る？`,
      lines: ["未鑑定の品は 0 で引き取られ、商会の棚にも並ばない。", "先に鑑定するのがよい。"],
      okLabel: "0 で売る", danger: true,
    });
    if (!ok) return false;
  } else if (warns.length) {
    const ok = await confirm({ banner: "売却の確認", title: `${it.name} を売る？`, lines: [...warns, `売値 ${price}`], okLabel: `${price} で売る`, danger: true });
    if (!ok) return false;
  }
  if (game.sellItem) game.sellItem(owner, it, price);
  floatGold(price);
  return true;
}
// 鑑定の結果の行の「売る」(売値つき)。警告のある品は sellOne が確かめる。売れたら一覧を描き直す (売った品は消える)
export function revealSellBtn(doll, it, onSold) {
  const b = button({ label: "売る", sub: String(game.sellPrice(it)), kind: "secondary", size: "sm",
    onTap: async () => { if (await sellOne(doll, it)) onSold(); } });
  b.classList.add("wpc-prow-act", "sell");
  b.dataset.act = "sell";
  return b;
}
// 金貨が増えた/減った印を見出しの金貨の上に浮かべる
export function floatGold(n, tone = "up") {
  if (!n) return;
  requestAnimationFrame(() => {
    const a = document.querySelector("#town-shell .ui-cur-c.c-gold") || document.querySelector(".ui-cur-c.c-gold");
    if (a) deltaFloat(a, `${tone === "up" ? "+" : "-"}${n}`, tone === "up" ? "up" : "dn");
  });
}

// 商会で鑑定 (確実・有料)
export function shopIdentifyOne(owner, it) {
  if (!shopOpen() || !owner || !game.shopIdentify) return false;
  const cost = game.appraiseCost(it);
  if ((G().gold || 0) < cost) { sfx("ng"); toast("金貨が足りない", { tone: "bad" }); return false; }
  game.shopIdentify(owner, it);
  floatGold(cost, "dn");
  return !it.unidentified;
}

// ---------------------------------------------------------------- 人業を選んで装備 (品 → 人業 → 装備)
// 隊と控えの全員を肖像の札で並べ、装備できる者には増減 (▲▼)、できない者は灰色で短い理由
// (職業 / 両手 / 重量 / 呪い / 未鑑定 …)。最良の装備者を金で縁取る。押せばその場で装備し (商会なら先に買う)、
// 「元に戻す」つきのトーストを出す。共有の選び手は WP-B の UI.equipChooser / UI.canEquipReason。
// 無ければ同じ見た目・同じ振る舞いの手元の版を使う (UI には登録しない = WP-B の登録を上書きしない)。
const ARMOR_RANK = { heavy: 2, light: 1, cloth: 0 };
const isReserve = (d) => (G().reserve || []).includes(d);
// 並べる人業 (隊 → 控え。魂の無い空の器は除く)
export function chooserDolls() { return allDolls().filter((d) => d && !d.isEmpty); }
// 鑑定の心得のある者 (鑑定は街でのみ。隊と控えの全員から。迷宮では誰も鑑定できない)
export function townAppraisers() {
  if (!inTown()) return [];
  return chooserDolls().filter((m) => m.alive && canIdentify(m));
}

// 付け替えで持ち物があふれるか (items.js の equip() と同じ数え方)。incoming = 他人の袋/棚から移ってくる
function bagOverflow(d, it, incoming) {
  const key = slotKeyFor(it, d);
  const removed = [];
  if (it.slot === "weapon" && it.twoHanded && d.equip.shield) removed.push(d.equip.shield);
  if (it.slot === "shield" && d.equip.weapon && d.equip.weapon.twoHanded) removed.push(d.equip.weapon);
  if (key && d.equip[key] && !removed.includes(d.equip[key])) removed.push(d.equip[key]);
  const after = d.items.length + (incoming ? 1 : 0) - 1 + removed.filter((r) => r && r !== it).length;
  return after > MAX_ITEMS;
}
// 装備できない短い理由 (できるなら null)。buy = 棚から買って装備する (袋に1枠いる)
function localReason(d, it, { buy = false } = {}) {
  if (!d || !it) return "—";
  if (it.unidentified) return "未鑑定";
  if (!isEquippable(it)) return "装備品でない";
  if (!inTown() && isReserve(d)) return "街にいる";
  if (equippedBy(d, it)) return "装備中";
  if (!canEquip(d, it)) {
    if (it.align && d.align && it.align !== "中立" && d.align !== "中立" && it.align !== d.align) return "属性";
    if (it.classes || it.forJob) return "職業";
    const gear = JOB_GEAR[d.clsKey];
    if (gear && it.weight && (ARMOR_RANK[it.weight] || 0) > (ARMOR_RANK[gear.armor] || 0)) return "重量";
    return "職業";
  }
  if (it.slot === "shield" && d.equip.weapon && d.equip.weapon.twoHanded && d.equip.weapon.cursed) return "両手";
  if (it.slot === "weapon" && it.twoHanded && d.equip.shield && d.equip.shield.cursed) return "両手";
  const key = slotKeyFor(it, d);
  const cur = key ? d.equip[key] : null;
  if (cur && cur !== it && cur.cursed) return "呪い";
  if (buy && d.items.length >= MAX_ITEMS) return "満杯";
  const own = ownerOf(it);
  if (bagOverflow(d, it, buy || !own || own.doll !== d)) return "満杯";
  return null;
}
export function canEquipReason(d, it, opts) {
  if (typeof UI.canEquipReason === "function") {
    try {
      const r = UI.canEquipReason(d, it);
      if (r) return r;
      // 共有の判定が通っても、買う/持ち物の溢れ・街にいるなど手元の判定は重ねて見る
      const l = localReason(d, it, opts);
      return l === "装備中" ? l : (l === "満杯" || l === "街にいる" ? l : null);
    } catch (e) { /* 手元の判定へ */ }
  }
  return localReason(d, it, opts);
}

// 増減の短い表記 (大きい順に3つまで)
function shortDelta(delta) {
  const w = el("span", "wpc-sd");
  if (!delta) { w.appendChild(el("span", "eq", "変化なし")); return w; }
  const L = { power: "攻撃力", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP" };
  const list = Object.keys(L).filter((k) => delta[k] && typeof delta[k] === "number" && !(k === "atk" && delta.power === delta.atk)).map((k) => [k, delta[k]]);
  if (delta.crit) list.push(["crit", delta.crit]);
  const lvOf = (e) => (e && e.el ? Math.min(2, e.lv || 1) : 0);
  for (const [k, ch] of [["属攻", delta.elemAtk], ["属防", delta.elemDef]]) if (ch && !elemStatEq(ch.from, ch.to)) list.push([k, (lvOf(ch.to) - lvOf(ch.from)) || 0.1]);
  if (!list.length) { w.appendChild(el("span", "eq", "変化なし")); return w; }
  list.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (b[1] > 0) - (a[1] > 0));
  for (const [k, v] of list.slice(0, 3)) {
    const lb = L[k] || (k === "crit" ? "会心" : k);
    const num = k.startsWith("属") ? "" : `${v > 0 ? "+" : ""}${v}${k === "crit" ? "%" : ""}`;
    w.appendChild(el("span", v > 0 ? "up" : "dn", `${v > 0 ? "▲" : "▼"}${lb}${num}`));
  }
  if (list.length > 3) w.appendChild(el("span", "more", "…"));
  return w;
}

// 状態の控え (元に戻す用): 人業の持ち物と装備・HP/MP、所持金と棚の在庫
function snapshot(dolls, stockId) {
  const g = G();
  return {
    dolls: [...new Set(dolls.filter(Boolean))].map((d) => ({ d, items: d.items.slice(), equip: { ...d.equip }, hp: d.hp, mp: d.mp })),
    gold: g.gold, stockId, stock: stockId ? (g.shopStock || {})[stockId] : undefined,
  };
}
function restore(snap) {
  const g = G();
  for (const s of snap.dolls) {
    s.d.items.length = 0;
    for (const it of s.items) s.d.items.push(it);
    for (const k of SLOTS) s.d.equip[k] = s.equip[k] || null;
  }
  try { if (game.recalcAllDolls) game.recalcAllDolls(); } catch (e) { /* noop */ }
  for (const s of snap.dolls) { s.d.hp = Math.min(s.hp, s.d.maxhp); s.d.mp = Math.min(s.mp, s.d.maxmp); }
  g.gold = snap.gold;
  if (snap.stockId) g.shopStock[snap.stockId] = snap.stock;
}

// 押した人業にその場で装備させる (buyId: 棚の品を先に買う)。成功で true。トーストに「元に戻す」
export function equipPick(d, it, { buyId = null, onDone } = {}) {
  const reason = canEquipReason(d, it, { buy: !!buyId });
  if (reason) { sfx("ng"); toast(`${d.name}: ${reason}`, { tone: "bad" }); return false; }
  const own = buyId ? null : ownerOf(it);
  const snap = snapshot([d, own && own.doll], buyId);
  const delta = deltaFor(d, it);
  let item = it;
  if (buyId) {
    item = game.buyItem ? game.buyItem(buyId, game.buyPrice(ITEMS[buyId]), d) : null;
    if (!item) return false;
    floatGold(snap.gold - (G().gold || 0), "dn");
  }
  let r = null;
  try { r = UI.equipItemTo ? UI.equipItemTo(d, item, { quiet: true }) : null; } catch (e) { r = null; setTimeout(() => { throw e; }); }
  const ok = !!(r && r.ok !== false) && !!equippedBy(d, item);
  refreshViews();
  if (!ok) {
    sfx("ng");
    toast(buyId ? `${item.name} を買った → ${d.name} の袋 (装備は入れ替えられない)` : equipFailReason(d, item), { tone: "bad" });
    return false;
  }
  const undo = () => {
    // 他の操作で状態が変わっていたら戻さない (取り違え防止)
    if (!equippedBy(d, item)) { toast("もう元に戻せない", { tone: "info" }); return; }
    restore(snap);
    if (game.log) game.log(buyId ? `${item.name} の購入と装備を取り消した。` : `${d.name} の装備を元に戻した。`, "sys");
    sfx("select");
    if (game.autosave) game.autosave(true);
    refreshViews();
    toast("元に戻した", { tone: "info" });
  };
  const t = toast(`${buyId ? "買って " : ""}${d.name} が ${item.name} を装備した`, { tone: "good", icon: item, action: { label: "元に戻す", fn: undo } });
  if (t && delta) t.el.querySelector(".ui-toast-t").appendChild(deltaEl(delta));
  if (game.autosave) game.autosave(true);
  if (onDone) onDone(d, item);
  return true;
}

// 肖像の札の並び (品シートの主役の段・選ぶシートの中身)
//   mode: "equip" (押せば装備) | "bag" (押せば袋へ = 渡す/買うだけ)
//   buyId: 棚の品 (押せば買ってから)。onPick(d) を渡すと既定の動きの代わりに呼ぶ
export function dollGrid(it, { owner = null, mode = "equip", buyId = null, onPick, onDone } = {}) {
  if (mode === "equip" && typeof UI.equipChooserEl === "function") {
    try {
      const pick = onPick || (buyId ? (d, info) => {
        if (info && info.reason) { sfx("ng"); toast(`${d.name}: ${info.reason}`, { tone: "bad" }); return; }
        equipPick(d, it, { buyId, onDone });
      } : null);
      const node = UI.equipChooserEl(it, { owner, onPick: pick, onDone: onDone ? () => onDone() : null });
      if (node) { node.classList.add("wpc-chooser-el"); return node; }
    } catch (e) { setTimeout(() => { throw e; }); }
  }
  const grid = el("div", "wpc-dgrid");
  const dolls = chooserDolls();
  const plan = mode === "equip" ? wearPlan(it, { owner, pool: dolls.filter((d) => !canEquipReason(d, it, { buy: !!buyId })) }) : null;
  const best = plan && plan.target && plan.score > 0 ? plan.target : null;
  for (const d of dolls) {
    let reason = null;
    if (mode === "equip") reason = canEquipReason(d, it, { buy: !!buyId });
    else if (d === owner) reason = "持ち主";
    else if (!inTown() && isReserve(d)) reason = "街にいる";
    else if (!d.alive) reason = "砕けている"; // 従来の「渡す」「買う」と同じく、砕けた人業へは渡せない
    else if (d.items.length >= MAX_ITEMS) reason = "満杯";
    const off = !!reason;
    const c = el("button", "wpc-dchip" + (off ? " off" : "") + (d === best ? " best" : "") + (d === owner ? " own" : ""));
    c.type = "button";
    const cls = d.dominant && SOUL_CLASSES[d.dominant.clsKey];
    if (cls && cls.glow) c.style.setProperty("--glow", cls.glow);
    const top = el("span", "wpc-dchip-top");
    top.appendChild(dollIcon(d, 2));
    const nm = el("span", "wpc-dchip-nm", d.name);
    top.appendChild(nm);
    c.appendChild(top);
    const sub = el("span", "wpc-dchip-sub");
    if (off) sub.appendChild(el("span", "wpc-dchip-why", reason));
    else if (mode === "equip") sub.appendChild(shortDelta(deltaFor(d, it)));
    else sub.appendChild(el("span", "wpc-dchip-bag", `袋 ${d.items.length}/${MAX_ITEMS}`));
    c.appendChild(sub);
    if (d === best) c.appendChild(el("span", "wpc-dchip-best", "最適"));
    if (!d.alive) c.appendChild(el("span", "wpc-dchip-dead", "†"));
    if (isReserve(d)) c.appendChild(el("span", "wpc-dchip-rsv", "控"));
    c.setAttribute("aria-label", `${d.name} ${off ? reason : mode === "equip" ? "に装備" : "へ"}`);
    if (off) c.setAttribute("aria-disabled", "true");
    c.addEventListener("click", () => {
      if (off) { sfx("ng"); toast(`${d.name}: ${reason}`, { tone: "info", ms: 1600 }); return; }
      if (onPick) return onPick(d);
      if (mode === "equip") equipPick(d, it, { buyId, onDone });
      else if (buyId) { if (UI.shopBuy && UI.shopBuy(buyId, d, { equip: false }) && onDone) onDone(d); }
      else { const o = ownerOf(it); if (o && o.where === "bag" && giveTo(o.doll, it, d) && onDone) onDone(d); }
    });
    grid.appendChild(c);
  }
  return grid;
}

// 人業を選ぶシート (トーストの「装備」・棚の ▾・鑑定の結果から)。持ち物の品は WP-B の UI.equipChooser があればそちら
export function openDollChooser(it, { owner = null, mode = "equip", buyId = null, title, footer } = {}) {
  if (mode === "equip" && !buyId && typeof UI.equipChooser === "function") {
    try { return UI.equipChooser(it, { owner }); } catch (e) { /* 手元の版へ */ }
  }
  let h = null;
  const done = () => { if (h) h.close("done"); };
  const body = (scroll) => {
    const hd = el("div", "wpc-ch-hd");
    const art = el("span", "wpc-srow-ic" + (rarityKey(it) ? " rar-" + rarityKey(it) : ""));
    if (rarityKey(it)) art.style.setProperty("--edge", RARITIES[rarityKey(it)].color);
    art.appendChild(spriteCanvas(it, 3));
    hd.appendChild(art);
    const tx = el("span", "wpc-ch-t");
    tx.appendChild(nameSpan(it, "wpc-ch-nm"));
    const s = statLines(it);
    if (s) tx.appendChild(setText(el("span", "wpc-ch-st"), s));
    hd.appendChild(tx);
    scroll.appendChild(hd);
    scroll.appendChild(el("div", "wpc-ch-lab", mode === "equip" ? (buyId ? "買って装備させる人業を選ぶ" : "装備させる人業を選ぶ") : (buyId ? "買って持たせる人業を選ぶ" : "渡す相手を選ぶ")));
    scroll.appendChild(dollGrid(it, { owner, mode, buyId, onDone: done }));
  };
  h = sheet.open({
    kind: "choice", banner: title || (mode === "equip" ? "装備させる" : buyId ? "買う" : "渡す"), accent: rarColor(it) || "#c9a227",
    body, className: "wpc-pick wpc-chooser",
    footer: [...(footer || []), { label: "やめる", kind: "ghost", onTap: (x) => x.close("cancel") }],
  });
  return h;
}

// ---------------------------------------------------------------- 選ぶシート
// 行 (人形 + 名前 + 補足 + 右の値)。押せる行は 56px 以上
function pickRow({ doll, title, sub, right, onTap, disabled, extra, tone }) {
  const r = el("div", "wpc-prow" + (disabled ? " off" : "") + (tone ? " t-" + tone : ""));
  const main = el("button", "wpc-prow-main");
  main.type = "button";
  if (doll) main.appendChild(dollIcon(doll, 2));
  const tx = el("span", "wpc-prow-t");
  tx.appendChild(setText(el("span", "wpc-prow-title"), title || ""));
  if (sub) tx.appendChild(sub.nodeType ? sub : setText(el("span", "wpc-prow-sub"), sub));
  main.appendChild(tx);
  if (right) { const rt = el("span", "wpc-prow-r"); rt.appendChild(right.nodeType ? right : document.createTextNode(String(right))); main.appendChild(rt); }
  if (disabled) main.disabled = true;
  else if (onTap) main.addEventListener("click", onTap);
  r.appendChild(main);
  if (extra) r.appendChild(extra);
  return r;
}

// 誰に装備させる？ / 誰に渡す？ (肖像の札の選ぶシートへ一本化)
export function openEquipPicker(it, { owner = null } = {}) { return openDollChooser(it, { owner, mode: "equip" }); }
export function openGivePicker(owner, it, { onDone } = {}) {
  const h = openDollChooser(it, { owner, mode: "bag" });
  if (h && onDone) { const prev = h.opts && h.opts.onClose; h.opts.onClose = (why) => { if (prev) prev(why); if (why === "done") onDone(); }; }
  return h;
}

// 誰が鑑定する？ (成功率つき。街で商会が開いていれば、確実な商会の鑑定を先頭に)
export function identifyChooser(it, { onDone } = {}) {
  const g = G();
  const own = ownerOf(it);
  const men = townAppraisers();
  const body = el("div", "wpc-picklist");
  let h = null;
  const done = (ok) => { if (onDone) onDone(ok); };
  if (shopOpen() && own && own.where === "bag") {
    const cost = game.appraiseCost(it);
    const short = (g.gold || 0) < cost;
    body.appendChild(pickRow({
      title: "商会で鑑定する", sub: short ? "金貨が足りない" : "必ず正体がわかる", right: goldEl(cost), disabled: short, tone: "gold",
      onTap: () => { h.close("pick", { silent: true }); done(shopIdentifyOne(own.doll, it)); },
    }));
  }
  const skillOk = !it.lr && !it.idHardFail;
  if (skillOk) {
    for (const m of men) {
      const ch = identifyChance(m, it.lv || 1);
      const pct = Math.round(ch * 100);
      const sub = el("span", "wpc-prow-sub");
      sub.appendChild(document.createTextNode(`${m.cls || ""} ・ ${identifyLabel(m)}`));
      const right = el("span", "wpc-odds");
      right.appendChild(el("b", null, `${pct}%`));
      const bar = el("i", "wpc-oddsbar"); const f = el("i"); f.style.width = pct + "%"; bar.appendChild(f); right.appendChild(bar);
      body.appendChild(pickRow({
        doll: m, title: m.name, sub, right,
        onTap: () => { h.close("pick", { silent: true }); const ok = game.doIdentifySkill ? game.doIdentifySkill(m, it) : false; done(!!ok); },
      }));
    }
  }
  const lines = [];
  if (it.lr) lines.push("レジェンドレアは、商会でしか鑑定できない。");
  else if (it.idHardFail) lines.push("一度鑑定に失敗した品。もう商会でしか鑑定できない。");
  else if (!inTown()) lines.push("鑑定は街でしかできない。");
  else if (!men.length) lines.push("鑑定の心得のある者がいない。");
  else lines.push("失敗すると、この品はもう商会でしか鑑定できない。");
  if (!body.childElementCount) body.appendChild(el("div", "wpc-empty", inTown() ? "商会で鑑定しよう。" : "街へ持ち帰って、商会で鑑定しよう。"));
  h = sheet.open({
    kind: "choice", banner: "鑑定", accent: "#7fd0ff", title: `${itemName(it)} を鑑定する`, lines, body, className: "wpc-pick",
    footer: [{ label: "やめる", kind: "ghost", onTap: (x) => x.close("cancel") }],
  });
  return h;
}

// ---------------------------------------------------------------- 品シート
// 文脈ごとの既定の操作 (下の段)。装備品の「誰に装備させるか」は本文の肖像の札の段 (dollGrid) が受け持つ。
// { key, label, sub, cost, kind, primary, menu, disabled, caret, onTap(close, st) }
function defaultActions(st) {
  const { item: it, owner, context } = st;
  const acts = [];
  st.equipFirst = false;
  const g = G();
  const own = owner ? ownerOf(it) : null;
  const inBag = !!(own && own.where === "bag" && own.doll === owner);
  const eqKey = own && own.where === "equip" ? own.key : null;
  const town = inTown();

  // ---- 商会の棚 (買う) ----
  if (context === "stock") {
    const id = st.stockId || it.id;
    const price = st.price != null ? st.price : game.buyPrice(it);
    const stock = (g.shopStock || {})[id] || 0;
    const short = (g.gold || 0) < price;
    const tgt = st.target && st.target.items.length < MAX_ITEMS ? st.target : null;
    const buyer = tgt || chooserDolls().find((d) => d.alive && d.items.length < MAX_ITEMS) || null;
    const off = short || stock <= 0 || !buyer;
    const sub = stock <= 0 ? "売り切れ" : short ? "金貨が足りない" : buyer ? `${buyer.name} の袋へ` : "持てる者がいない";
    acts.push({ key: "buy", primary: !isEquippable(it), kind: isEquippable(it) ? "secondary" : "primary",
      label: isEquippable(it) ? "買うだけ" : "買う", sub, cost: price, disabled: off,
      onTap: (close) => { if (UI.shopBuy && UI.shopBuy(id, buyer, { equip: false })) close(); },
      menu: !isEquippable(it) && !off ? () => openDollChooser(it, { mode: "bag", buyId: id, title: "買う" }) : null });
    return acts;
  }
  if (context === "view" || !owner) return acts;

  // ---- 未鑑定 ----
  if (it.unidentified) {
    if (town && shopOpen() && inBag) {
      const cost = game.appraiseCost(it);
      // 鑑定の心得のある者がいれば ▾ で「鑑定を試す (無料・失敗あり)」も選べる
      const skill = !it.lr && !it.idHardFail && townAppraisers().length > 0;
      acts.push({ key: "appraise", primary: true, label: "鑑定して装備", sub: "商会で鑑定 → 人業を選ぶ", cost, disabled: (g.gold || 0) < cost,
        onTap: () => { if (shopIdentifyOne(owner, it)) st.rerender({ revealed: true }); },
        menu: skill ? () => identifyChooser(it, { onDone: (ok) => st.rerender({ revealed: !!ok }) }) : null });
    } else if (!town) {
      // 鑑定は街でのみ (迷宮では心得のある者でも鑑定できない)
      acts.push({ key: "tryId", primary: true, label: "鑑定は街でのみ", sub: "持ち帰って鑑定する", disabled: true });
    } else if (!it.lr && !it.idHardFail) {
      const men = townAppraisers();
      if (men.length) {
        const best = men.map((m) => ({ m, ch: identifyChance(m, it.lv || 1) })).sort((a, b) => b.ch - a.ch)[0];
        acts.push({ key: "tryId", primary: true, label: "鑑定を試す", sub: `${best.m.name} ${Math.round(best.ch * 100)}%`,
          onTap: () => { const ok = game.doIdentifySkill ? game.doIdentifySkill(best.m, it) : false; st.rerender({ revealed: !!ok }); },
          menu: men.length > 1 || (town && shopOpen()) ? () => identifyChooser(it, { onDone: (ok) => st.rerender({ revealed: !!ok }) }) : null });
      } else {
        acts.push({ key: "tryId", primary: true, label: "鑑定の心得のある者がいない", sub: "商会で鑑定できる", disabled: true });
      }
    } else {
      acts.push({ key: "tryId", primary: true, label: it.lr ? "商会でのみ鑑定できる" : "鑑定に失敗した品", sub: "街の商会で鑑定する", disabled: true });
    }
  } else if (eqKey) {
    // ---- 装備中 ----
    acts.push({ key: "unequip", primary: true, label: it.cursed ? "呪われていて外せない" : "外す", disabled: !!it.cursed || owner.items.length >= MAX_ITEMS,
      sub: !it.cursed && owner.items.length >= MAX_ITEMS ? "持ち物がいっぱい" : `${SLOT_LABEL[eqKey] || ""}`,
      onTap: (close) => { if (game.doUnequip) game.doUnequip(owner, eqKey); close(); refreshViews(); } });
  } else if (it.slot === "use") {
    // ---- 道具 ----
    acts.push({ key: "use", primary: context !== "sell", label: "使う", sub: `${owner.name} が使う`,
      onTap: (close) => {
        const i = owner.items.indexOf(it);
        if (i < 0 || !game.useItem) return;
        game.useItem(owner, i);
        if (owner.items.indexOf(it) < 0) close();
        refreshViews();
      } });
  } else if (isEquippable(it)) {
    // ---- 装備品: 誰かが装備で得をするなら、売るを決め手にしない (うっかり売らないように) ----
    st.equipFirst = isUpgrade(it, { owner });
  }

  // ---- 渡す (宝物庫から開いた収集品は奉納) / 売る (商会が開いている街) / 捨てる ----
  if (context === "donate" && inBag && town && ops.donateOne) {
    acts.push({ key: "donate", label: "奉納", onTap: (close) => {
      const res = ops.donateOne(owner, it);
      if (!res || !res.ok) return;
      close();
      if (res.rewardReady && game.claimNextTreasury) game.claimNextTreasury();
    } });
  } else if (inBag && giveCandidates(owner).length) acts.push({ key: "give", label: "渡す", caret: true, onTap: () => openGivePicker(owner, it, { onDone: () => st.close() }) });
  if (town && shopOpen() && inBag) {
    const price = it.unidentified ? 0 : game.sellPrice(it);
    const warn = !it.unidentified && game.sellWarnings && game.sellWarnings(it).length;
    acts.push({ key: "sell", primary: context === "sell" && !it.unidentified && !st.equipFirst, kind: it.unidentified || warn ? "danger" : null,
      label: it.unidentified ? "鑑定せず売る" : "売る", cost: price,
      onTap: async (close) => { if (await sellOne(owner, it)) close(); } });
  }
  if (inBag) acts.push({ key: "drop", label: "捨てる", kind: "ghost", onTap: async (close) => { if (await discard(owner, it)) close(); } });
  return acts;
}

function renderActions(foot, specs, st) {
  foot.textContent = "";
  // close は関数としても、シートの handle としても使える (h.close() を呼ぶ外部の操作のため)
  const close = () => st.close();
  close.close = close;
  close.el = st.h && st.h.el;
  const mk = (s, size, kindDefault) => {
    const b = button({
      label: s.label, sub: s.sub, kind: s.kind || kindDefault, size, disabled: !!s.disabled,
      cost: s.cost != null ? { kind: "gold", n: s.cost } : undefined,
      onTap: () => { if (s.disabled) return; try { s.onTap && s.onTap(close, st); } catch (e) { setTimeout(() => { throw e; }); } },
    });
    if (s.key) b.dataset.act = s.key;
    if (s.caret) b.appendChild(caretIcon("wpc-caret in"));
    return b;
  };
  const isPrim = (s) => s.primary === true || (s.primary === undefined && s.kind === "primary");
  const prim = specs.filter(isPrim);
  const sec = specs.filter((s) => !isPrim(s));
  for (const p of prim) {
    const row = el("div", "wpc-act-main" + (p.menu ? " split" : ""));
    row.appendChild(mk(p, "lg", "primary"));
    if (p.menu) {
      const m = el("button", "wpc-act-more");
      m.type = "button";
      m.setAttribute("aria-label", "ほかの相手を選ぶ");
      m.appendChild(caretIcon());
      m.addEventListener("click", () => p.menu());
      row.appendChild(m);
    }
    foot.appendChild(row);
  }
  if (sec.length) {
    const grid = el("div", "wpc-act-sec n" + Math.min(4, sec.length));
    for (const s of sec) grid.appendChild(mk(s, "md", "secondary"));
    foot.appendChild(grid);
  }
}

// 品シート本体
export function itemSheet(item, o = {}) {
  if (!item) return null;
  const own = ownerOf(item);
  const st = {
    item, owner: o.owner || (own ? own.doll : null), context: o.context || null,
    price: o.price, stockId: o.stockId || null, target: o.target || null, h: null, flash: false,
    first: false, // このシートで鑑定して、正体を初めて知った (初ゲット！)
    close: () => { if (st.h) st.h.close("done"); },
  };
  if (!st.context) st.context = st.owner ? (own && own.where === "equip" ? "equipped" : "bag") : "view";
  if (st.context === "treasury" || st.context === "codex") st.context = "view";
  const wasNew = !!item.isNew;
  markSeen(item);
  // 比べる相手: 棚の品は最良の装備者 / 所持品は持ち主か最良の者
  const pickTarget = () => {
    if (item.unidentified || !isEquippable(item)) {
      if (st.context === "stock" && !st.target) {
        const party = (G().party || []).filter((d) => d.alive);
        st.target = party.find((d) => d.items.length < MAX_ITEMS) || equipCandidates().find((d) => d.items.length < MAX_ITEMS) || null;
      }
      return;
    }
    if (st.target && equipCandidates().includes(st.target)) return;
    st.target = wearPlan(item, { owner: st.owner && st.context !== "stock" ? st.owner : null }).target;
  };
  pickTarget();

  const build = (scroll, h) => {
    const it = st.item;
    const rk = rarityKey(it);
    const top = el("div", "wpc-is-top");
    const art = el("div", "wpc-is-art" + (rk ? " rar-" + rk : ""));
    art.appendChild(spriteCanvas(it, 7));
    if (it.unidentified) art.appendChild(el("span", "wpc-is-seal", "?"));
    top.appendChild(art);
    const hd = el("div", "wpc-is-hd");
    hd.appendChild(nameSpan(it, "wpc-is-name"));
    const grade = el("div", "wpc-is-grade");
    if (st.first && !it.unidentified) grade.appendChild(firstBadge("wpc-is-first"));
    if (rk) grade.appendChild(el("span", "wpc-rtag rar-" + rk, RARITIES[rk].label));
    const cat = it.slot === "weapon" && it.cat ? `${WEAPON_CAT_LABEL[it.cat] || "武器"} ・ 射程${(RANGE_LABEL[weaponRange(it)] || "").replace("距離", "")}` : itemCatText(it);
    if (cat) grade.appendChild(el("span", "wpc-is-cat", cat));
    if (it.unidentified) grade.appendChild(el("span", "wpc-is-unid", it.idHardFail ? "未鑑定 ・ 失敗済み" : "未鑑定"));
    if (it.cursed && !it.unidentified) grade.appendChild(el("span", "wpc-is-curse", "呪い"));
    hd.appendChild(grade);
    const sl = statLines(it);
    if (sl && !it.unidentified) hd.appendChild(setText(el("div", "wpc-is-stat"), sl));
    if (st.context === "stock") {
      const g = G();
      const meta = el("div", "wpc-is-meta");
      meta.appendChild(document.createTextNode(`在庫 ${(g.shopStock || {})[st.stockId || it.id] || 0} ・ 買値 `));
      meta.appendChild(goldEl(st.price != null ? st.price : game.buyPrice(it)));
      hd.appendChild(meta);
    } else if (st.owner) {
      const own2 = ownerOf(it);
      hd.appendChild(el("div", "wpc-is-meta", own2 && own2.where === "equip" ? `${st.owner.name} が装備中` : `${st.owner.name} の持ち物`));
    }
    top.appendChild(hd);
    scroll.appendChild(top);
    if (st.flash) { top.classList.add("wpc-revealed"); st.flash = false; }

    if (it.unidentified) {
      scroll.appendChild(el("div", "wpc-is-note", "鑑定するまで正体も性能もわからない。"));
    } else if (isEquippable(it) && st.context !== "view") {
      const o2 = ownerOf(it);
      if (o2 && o2.where === "equip") {
        scroll.appendChild(el("div", "wpc-is-note gold", `${o2.doll.name} が装備中。外すと持ち物へ戻る。`));
      } else {
        // 主役の段: 隊と控えの全員。押せばその場で装備 (棚の品は買ってから)。WP-B の UI.equipChooserEl があればそれ
        const sec = el("div", "wpc-is-pick");
        if (typeof UI.equipChooserEl !== "function" || st.context === "stock") {
          const lab = el("div", "wpc-is-picklab");
          lab.appendChild(el("span", null, st.context === "stock" ? "買って装備する人業を選ぶ" : "装備する人業を選ぶ"));
          if (st.context === "stock") lab.appendChild(goldEl(st.price != null ? st.price : game.buyPrice(it)));
          sec.appendChild(lab);
        }
        sec.appendChild(dollGrid(it, {
          owner: st.context === "stock" ? null : st.owner, mode: "equip",
          buyId: st.context === "stock" ? (st.stockId || it.id) : null,
          onDone: () => st.close(),
        }));
        scroll.appendChild(sec);
      }
    }
    // 細目 (属性・装備の条件など)
    if (!it.unidentified) {
      const det = [];
      for (const ln of elemDetailLines("攻撃", it.eAtk)) det.push(ln);
      for (const ln of elemDetailLines("防御", it.eDef)) det.push(ln);
      for (const ln of ailDetailLines(it)) det.push(ln);
      if (isEquippable(it)) det.push(equipClassText(it));
      if (it.twoHanded) det.push("両手持ち (盾と併用できない)");
      if (it.align) det.push(`${it.align}属性`);
      if (it.slot === "misc") det.push("王宮の宝物庫に奉納できる。商会では売れる。");
      if (it.use && it.use.heal) det.push(`HPを ${it.use.heal} 回復`);
      if (it.use && it.use.mp) det.push(`MPを ${it.use.mp} 回復`);
      if (it.use && it.use.cure) det.push("毒を治す");
      if (det.length) {
        const box = el("div", "wpc-is-lines");
        for (const ln of det) box.appendChild(setText(el("div"), ln));
        scroll.appendChild(box);
      }
      if (it.desc) scroll.appendChild(el("div", "wpc-is-lore", it.desc));
    } else {
      scroll.appendChild(el("div", "wpc-is-lore", "なんだかよくわからない品だ。鑑定すれば正体がわかるだろう。"));
    }
    // 操作
    let specs = defaultActions(st);
    if (Array.isArray(o.actions)) specs = o.actions;
    else if (typeof o.actions === "function") specs = o.actions(specs, st) || specs;
    // 操作の無い品 (見るだけ) には「閉じる」を置く
    if (!specs.length) specs = [{ key: "close", primary: true, kind: "secondary", label: "閉じる", onTap: (close) => close() }];
    renderActions(h.foot, specs, st);
  };

  st.rerender = ({ revealed = false } = {}) => {
    if (!st.h || st.h.closed) return;
    if (!ownerOf(st.item) && st.context !== "stock" && st.context !== "view") { st.h.close("gone"); return; }
    if (revealed) { st.flash = true; st.first = isFirstGet(st.item); }
    pickTarget();
    st.h.update({ accent: rarColor(st.item) || "#8a6d2e" });
    const rk2 = rarityKey(st.item);
    st.h.el.style.setProperty("--sheet-accent", rarColor(st.item) || "#8a6d2e");
    st.h.el.className = st.h.el.className.replace(/\brar-\w+\b/g, "").trim() + (rk2 ? " rar-" + rk2 : "");
  };
  const rk = rarityKey(item);
  st.h = sheet.open({
    kind: "info", accent: rarColor(item) || "#8a6d2e", className: "wpc-isheet ctx-" + st.context + (rk ? " rar-" + rk : ""),
    body: build,
    onClose: (why) => {
      // NEW 印を消したので、街の一覧の点も消す
      if (wasNew && inTown() && game.renderTown) game.renderTown();
      if (o.onClose) o.onClose(why);
    },
  });
  return st.h;
}

// ---------------------------------------------------------------- 入手 (§3.6)
function proceed(opts, next) {
  const g = G();
  if (!opts.keepPrompt) g.prompt = false;
  try {
    if (typeof next === "function") next();
    else if (g.state === "board" && game.renderBoard) game.renderBoard();
    else if (g.state === "town" && game.renderTown) game.renderTown();
  } finally {
    if (game.autosave) game.autosave(true);
  }
}

// 収穫バーの格の数を弾ませる
function bumpRunbar(rk) {
  if (!rk || typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    const gem = document.querySelector(`#runbar .rb-rar.rar-${rk}`);
    if (!gem) return;
    gem.classList.remove("wpc-bump");
    void gem.offsetWidth;
    gem.classList.add("wpc-bump");
  });
}

// トーストの操作: 街の未鑑定品 = 品シート (迷宮では鑑定できない) / 装備で得をする者がいれば = 装備
function toastAction(it, who) {
  if (it.unidentified) {
    if (inTown()) return shopOpen() ? { label: "鑑定", fn: () => itemSheet(it, { owner: ownerOf(it) ? ownerOf(it).doll : who }) } : null;
    return null;
  }
  if (!isEquippable(it)) return null;
  const plan = wearPlan(it, { owner: who });
  if (!plan.target || !plan.delta || !(plan.score > 0)) return null;
  // 「装備」→ 人業を選ぶシート (最良の装備者を金で縁取り、押せばその場で装備・元に戻せる)
  return { label: "装備", fn: () => { const o = ownerOf(it); if (o && o.where === "bag") openDollChooser(it, { owner: o.doll }); }, plan };
}

function lootToast(item, who, opts) {
  const rk = rarityKey(item);
  const fan = RARITY_FANFARE[rk] || null;
  sfx("itemget");
  buzz((fan && fan.buzz) || [0, 30, 60, 30]);
  if (opts.silent) return null;
  const act = toastAction(item, who);
  const label = `${itemName(item)}${item.unidentified ? " (未鑑定)" : ""}${who ? ` → ${who.name}` : ""}`;
  const t = toast(label, { tone: "gold", icon: item, rarity: rk, action: act ? { label: act.label, fn: act.fn } : null });
  if (!t) return null;
  t.el.classList.add("wpc-loot-toast");
  const tx = t.el.querySelector(".ui-toast-t");
  if (tx) {
    tx.textContent = "";
    const l1 = el("span", "wpc-lt-l1");
    l1.appendChild(nameSpan(item, "wpc-lt-nm"));
    if (item.unidentified) l1.appendChild(el("span", "wpc-lt-unid", "未鑑定"));
    if (who) l1.appendChild(el("span", "wpc-lt-who", `→ ${who.name}`));
    tx.appendChild(l1);
    if (act && act.plan && act.plan.delta) {
      const l2 = el("span", "wpc-lt-l2");
      l2.appendChild(deltaEl(act.plan.delta));
      if (act.plan.target !== who) l2.appendChild(el("span", "wpc-lt-tgt", `${act.plan.target.name}なら`));
      tx.appendChild(l2);
    } else if (!item.unidentified && item.slot === "use") {
      const s = statLines(item);
      if (s) tx.appendChild(setText(el("span", "wpc-lt-l2 dim"), s));
    }
  }
  return t;
}

function lootCelebrate(item, who, opts, next) {
  const g = G();
  g.prompt = true;
  const rk = rarityKey(item);
  const misc = item.slot === "misc";
  const fan = RARITY_FANFARE[rk] || (misc ? MISC_FANFARE : RARITY_FANFARE.r);
  const color = rarColor(item) || "#c9a227";
  // 演出 (従来の入手カードと同じ: ファンファーレ・振動・閃光・LRは画面の揺れ)。レアはファンファーレ抜きで控えめに
  if (fan.big) { sfx("victory"); setTimeout(() => sfx("itemget"), 380); } else sfx("itemget");
  buzz(fan.buzz || [0, 30, 60, 30]);
  try { if (fan.flash && game.flashScreen) game.flashScreen(fan.flash); } catch (e) { /* 演出のみ */ }
  try { if (fan.legend && game.shakeScreen) game.shakeScreen(true); } catch (e) { /* 演出のみ */ }
  const unid = !!item.unidentified;
  const body = (scroll) => {
    const art = el("div", "ig-art");
    art.appendChild(spriteCanvas(item, 9));
    for (let i = 0; i < 6; i++) {
      const s = el("span", "ig-spark");
      s.style.setProperty("--a", (i * 60) + "deg");
      s.style.animationDelay = (i * 0.08) + "s";
      art.appendChild(s);
    }
    scroll.appendChild(art);
    scroll.appendChild(nameSpan(item, "ig-name wpc-cel-name"));
    if (rk) scroll.appendChild(el("div", "ig-rarity rar-" + rk, RARITIES[rk].label + (unid ? " ・ 未鑑定" : "")));
    else if (misc) scroll.appendChild(el("div", "ig-rarity", "収集品"));
    const sl = statLines(item);
    if (sl && !unid) scroll.appendChild(setText(el("div", "ig-stat"), sl));
    if (!unid && isEquippable(item)) {
      const plan = wearPlan(item, { owner: who });
      if (plan.target && plan.delta) {
        const dl = el("div", "wpc-is-delta center");
        dl.appendChild(el("span", "wpc-is-lab", `${plan.target.name}なら`));
        dl.appendChild(deltaEl(plan.delta));
        scroll.appendChild(dl);
      }
    }
    scroll.appendChild(el("div", "ig-desc", unid ? "なんだかよくわからない品だ。鑑定すれば正体がわかるだろう。" : (item.desc || "")));
    if (misc && !unid) scroll.appendChild(el("div", "ig-stat", isNewCollectible(item) ? "まだ宝物庫に無い品。王宮の宝物庫に奉納できる。" : "宝物庫に奉納済みの品。商会で売れる。"));
    if (who) scroll.appendChild(el("div", "ig-who", `${who.name} が手に入れた`));
  };
  let finished = false;
  let h = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (h) h.close("ok", { silent: true });
    proceed(opts, next);
    bumpRunbar(rk);
  };
  const foot = el("div", "wpc-cel-foot");
  foot.appendChild(button({ label: "詳しく", kind: "ghost", onTap: () => itemSheet(item, { owner: ownerOf(item) ? ownerOf(item).doll : who }) }));
  foot.appendChild(button({ label: "受け取る", kind: "primary", size: "lg", onTap: finish }));
  h = sheet.open({
    kind: "celebrate", sparkle: false, className: "wpc-loot" + (rk ? " rar-" + rk : ""), accent: color,
    banner: fan.banner, body, footer: foot,
    onBack: finish, onBackdrop: finish,
  });
  if (h && h.el && fan.legend) {
    const beam = el("div", "ig-beam");
    h.el.insertBefore(beam, h.el.firstChild);
  }
  if (!h || !h.el) finish();
  return h;
}

// UI.loot(item, who, opts, next)
export function loot(item, who, opts = {}, next) {
  if (typeof opts === "function" && next === undefined) { next = opts; opts = {}; }
  opts = opts || {};
  if (!item) { proceed(opts, next); return { kind: "none" }; }
  const rk = rarityKey(item);
  const big = opts.celebrate === true || (opts.celebrate !== false && isCelebrated(item));
  if (big) { lootCelebrate(item, who, opts, next); return { kind: "celebrate" }; }
  lootToast(item, who, opts);
  proceed(opts, next);
  if (inDungeon()) bumpRunbar(rk);
  return { kind: "toast" };
}

export function install() {
  registerUI({
    loot,
    itemSheet,
    identifyChooser,
    openEquipPicker,
    openGivePicker,
    openDollChooser,
    dollGrid,
    equipPick,
    markSeen,
    newCount,
    wearPlan,
    sellOne,
    shopOpen,
    townAppraisers,
    lootPolicy: (it) => (isCelebrated(it) ? "celebrate" : "toast"),
  });
}
