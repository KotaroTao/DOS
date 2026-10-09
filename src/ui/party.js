import { RESIST_LABEL } from "../resistance.js";
// ===== 隊 (統合された人業の画面) — 隊列ストリップ・控え/仕立て・装備/魂/能力・迷宮内のシート =====
// 担当: WP-B。
//   街: 「隊」タブ (街シェルの中身)。迷宮: 盤面の隊の札から開く全高のシート (魂の付け替え・鍛錬はできない)。
//   1画面に収める (390×844 でページのスクロール無し):
//   [砕けた人業の知らせ] [隊列: 前衛3 | 後衛3 | 控え] [人業の見出し] ([野営]) [装備|魂|能力  最適装備] [区分の中身] [館の主イレーヌ (街のみ・余った高さ)]
//   区分の中身だけが、狭い画面 (360×640 など) で内側にスクロールする。
// 品 → 人業を選ぶ → 装備: UI.equipChooser(item, {owner}) が「全員の札 (伸び ▲▼ / 付けられない理由)」を並べ、
//   1タップでその人業に装備する (どの袋からでも)。元に戻すつきのトースト。他パッケージ (品シート・入手・商会) も使う。
// 提供する契約: UI.openParty(idx, {context, seg}) / UI.autoEquip(doll|"all") / UI.betterGearCount() /
//               UI.equipItemTo(doll, item) / UI.bestWearer(item) / UI.equipChooser(item, {owner}) /
//               UI.equipChooserEl(item, {owner, onPick}) / UI.canEquipReason(doll, item) / UI.partyPortraitCanvas(doll, size)
// game.js は import しない (ctx.js の UI / game / ops を通す。kit.js・itemview.js は自由に使ってよい)。
// 肖像はすべて partyPortraitCanvas (1か所) で描く: 隊の絵を差し替える時はここだけ直す。

import { UI, game, ops, registerUI } from "./ctx.js";
import {
  el, button, row, segmented, sheet, toast, confirm, statDelta, bar, badge, setText, longPress, shake, scrollBox, uiBlocked,
} from "./kit.js";
import { deltaFloat } from "./motion.js";
import { remember, setPref, getPref } from "./prefs.js";
import {
  statLines, detailLines, isEquippable, gearScore, elemStatShort, showSkillPopup, showPassivePopup, itemCatText, tagRow, spellTagKinds, specialLines, specialShort, specialParts, weaponPerformanceEl, weaponPowerPreview,
} from "./itemview.js";
import { renderSoulSeg, openSoulPicker, openSoulList, openOrderSheet } from "./soulpanel.js";
import { expeditionStatus, expeditionButton, expeditionCount } from "./expedition.js";
import { IRENE_WHO, IRENE_ART, ireneState, isGreeted, nextLine, lineOpen, noteVisit, greetingPages, playIreneScene, sceneActive } from "./irene.js";
import {
  planBestEquip, applyPlan, restoreEquip, equipSignature, trialEquip, slotKeysFor, previewStats, statsDelta, snapshotEquip, isMeleeWeapon,
} from "../autoequip.js";
import { SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, canEquip, recalc, weaponRange, RANGE_LABEL, itemName, attackPower, useWhere, compareUse, AIL_LABEL } from "../items.js";
import {
  SOUL_CLASSES, SOUL_KEYS, JOB_GEAR, dollSprite, dollBust, dollFace, jobBust, jobSprite, jobRankName, ATTR_KEYS, ATTR_LABEL, ATTR_NAME, soulLabel, soulRankLeft, soulByUid,
  orderedSkills, isSkillOff, setSkillOff, moveSkill, resetSkillPrefs, isAutoOff, setAutoOff,
} from "../souls.js";
import { TACTICS, tacticOf, setTactic } from "../autotactics.js";
import { SPELLS, spellCost, spellMpLabel } from "../combat.js";
import { spriteCanvas, crispCanvas } from "../sprites.js";
import { rarityKey, RARITIES } from "../rarity.js";
import { RESONANCE_MAP, resonanceText, resonanceTotals } from "../resonance.js";

const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";
const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const buzz = (p) => { try { if (game.buzz) game.buzz(p); } catch (e) { /* noop */ } };

// ---- 状態 (画面だけの選択。セーブには入れない) ----
let selDoll = null;       // 表示中の人業 (隊・控えのどちらでも)
let picked = null;        // 隊列の入れ替えで持ち上げた人業 (タップで移す先を選ぶ代替操作)
let intent = null;        // 次の描画で行うこと ({reserve:true} / {seg})
let sheetH = null;        // 迷宮の隊シート
let sheetTown = false;   // 街の画面の上に隊のシートを開いている (館へ移らずに装備を見る。街の操作ができる・イレーヌは出さない)
let dunSeg = null;        // 迷宮の隊シートで表示中の区分 (開くたび「装備」から。街の隊タブの記憶とは別)
let statOpen = null;      // 能力の説明を開いている能力キー
let pendingOpen = false;  // UI.openParty で人業・区分を指定して館へ入るときの印 (タブから入るときは既定へ戻す)
let phase0ItemSheet = null; // Phase 0 の品シートのスタブ (WP-C の本物が来るまでは自前の品の画面を使う)

const SEGS = [{ key: "equip", label: "装備" }, { key: "soul", label: "魂" }, { key: "stats", label: "能力" }];
function curSeg() {
  if (dunSeg) return dunSeg;
  const s = remember("seg", "party"); return SEGS.some((x) => x.key === s) ? s : "equip";
}
function setSeg(k) {
  if (!SEGS.some((x) => x.key === k)) return;
  if (dunSeg) dunSeg = k; else remember("seg", "party", k);
}

const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const inTown = () => G_() && G_().state === "town";
const isReserve = (d) => (G_().reserve || []).includes(d);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// 六大能力のくわしい説明 (能力の区分で開く)
const ATTR_DESC = {
  atk: "筋力。長剣・斧・槌・槍などの攻撃力を伸ばす。攻撃力は武器が参照する能力と補正係数で決まり、通常攻撃や物理技の威力を決める。",
  vit: "受ける物理ダメージを軽減する頑強さ。高いほど打たれ強くなる。",
  agi: "行動の速さ。行動順・回避に加え、弓・短剣・刀の攻撃力を伸ばす。",
  int: "知力。攻撃呪文に加え、魔杖・魔法武器の攻撃力を伸ばす。",
  pie: "信仰心。回復呪文に加え、聖杖・聖武器の攻撃力を伸ばす。",
  luk: "会心（クリティカル）の発生率を左右する幸運。高いほど大ダメージが出やすい。",
};
const DLABEL = { power: "攻撃力", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP" };

// ================= 肖像 (隊の絵の差し替え点) =================
// 人業の肖像を、ドット1つを整数倍で描いた canvas で返す (image-rendering: pixelated)。
// size = 枠の一辺 (px)。枠に収まる最大の整数倍で描く。
export function partyPortraitCanvas(doll, size = 52) {
  // 小さな額には胸像 (顔を中心に切り出した原画)、大きな額には全身像
  const spr = size < 72 ? (doll ? dollBust(doll) : jobBust("fighter", 1)) : (doll ? dollSprite(doll) : jobSprite("fighter", 1));
  return pixelCanvas(spr, size);
}
function pixelCanvas(spr, size) {
  // ドットを物理ピクセルの整数倍で描く (入りきらない大きな絵だけ滑らかに縮める)
  const c = crispCanvas(spr, size);
  c.className = "pt-px";
  return c;
}
// 肖像の札 (枠・HPの細線・砕けた印)
function portraitEl(d, { size = 44, sel = false, tag = "button", cls = "" } = {}) {
  const p = el(tag, `pt-port s${size}${sel ? " sel" : ""}${d && !d.alive ? " dead" : ""}${cls ? " " + cls : ""}`);
  if (tag === "button") p.type = "button";
  if (!d) { p.classList.add("empty"); p.appendChild(el("span", "pt-port-plus", "＋")); return p; }
  const cl = d.jobKey && SOUL_CLASSES[d.jobKey];
  if (cl) p.style.setProperty("--glow", cl.glow);
  if (d.primary == null) p.classList.add("hollow"); // 魂の宿らない器
  if (d.vessel === "sera") { p.classList.add("vessel-sera"); p.appendChild(el("span", "pt-port-vessel", "灯")); } // 師の作った器
  if (game.expeditionOf && game.expeditionOf(d)) { p.classList.add("away"); p.appendChild(el("span", "pt-port-away", "遠")); } // 遠征に出ている
  const fr = el("span", "pt-port-fr");
  try { fr.appendChild(partyPortraitCanvas(d, size - 6)); } catch (e) { /* 絵が無くても動く */ }
  p.appendChild(fr);
  if (!d.alive) p.appendChild(el("span", "pt-port-dead", "✝"));
  if (d.maxhp && d.primary != null) {
    const r = Math.max(0, Math.min(1, (d.hp || 0) / Math.max(1, d.maxhp)));
    const hp = el("span", "pt-port-hp" + (r < 0.34 && d.alive ? " low" : ""));
    const f = el("i"); f.style.width = (d.alive ? r * 100 : 0).toFixed(1) + "%"; hp.appendChild(f);
    p.appendChild(hp);
  }
  p.setAttribute("aria-label", `${d.name}${d.alive ? "" : " (砕けた)"} ${d.cls || ""}`);
  return p;
}

// ================= 品の点数・候補 =================
function itemsPool() {
  // 品を出せる人業 = 隊と控えの全員 (旧来の装備候補と同じ。迷宮の中でも控えの袋から取り出せる)。遠征に出ている人業の袋は除く
  return allDolls().filter((d) => !(game.expeditionOf && game.expeditionOf(d)));
}
// d の部位 key に it を収めた時の増減 (無理なら null)。base = いまの能力 (省略時は計算する)
function slotDelta(d, it, key, base = null) {
  const tr = trialEquip(d.equip, it, key);
  if (!tr) return null;
  return { tr, delta: statsDelta(base || previewStats(d, d.equip, recalc), previewStats(d, tr.equip, recalc)) };
}
// 1回の描画のあいだだけ覚えておく (部位ごとの候補の計算は重いので、枠・印・ボタンで使い回す)
const memo = new Map();
function memoClear() { memo.clear(); }
function memoGet(key, fn) {
  if (memo.has(key)) return memo.get(key);
  const v = fn();
  memo.set(key, v);
  return v;
}
let _oidSeq = 0;
const _oids = new WeakMap();
function oidOf(o) { let v = _oids.get(o); if (!v) { v = ++_oidSeq; _oids.set(o, v); } return v; }
// d の部位 key に付けられる候補 (他人の袋も)。{ it, owner, gain, delta, room }
function slotCandidates(d, key, { includeUnid = false } = {}) {
  return memoGet(`c${oidOf(d)}:${key}:${includeUnid ? 1 : 0}`, () => slotCandidatesRaw(d, key, includeUnid));
}
function slotCandidatesRaw(d, key, includeUnid) {
  const out = [];
  const base = previewStats(d, d.equip, recalc);
  for (const owner of itemsPool()) {
    for (const it of (owner.items || [])) {
      if (!it || !slotKeysFor(it, d).includes(key)) continue;
      if (it.unidentified) { if (includeUnid) out.push({ it, owner, unid: true, gain: -Infinity }); continue; }
      if (!canEquip(d, it)) continue;
      const sd = slotDelta(d, it, key, base);
      if (!sd) continue;
      const room = (d.items.length - (owner === d ? 1 : 0) + sd.tr.displaced.length) <= MAX_ITEMS;
      out.push({ it, owner, gain: gearScore(d, sd.delta), delta: sd.delta, room, cursed: !!it.cursed });
    }
  }
  out.sort((a, b) => (b.gain - a.gain) || ((b.it.lv || 0) - (a.it.lv || 0)));
  return out;
}
// 部位ごとの「もっと良い品がある」(▲) と候補の数
function slotInfo(d, key) {
  const cands = slotCandidates(d, key);
  const best = cands.find((c) => c.room && !c.cursed && c.gain > 0.05 && autoAllow(d, c.it));
  return { count: cands.length, better: !!best, bestGain: best ? best.gain : 0 };
}
// 品 it をこの人業に付けるなら、どの部位が最良か ({key, gain, delta, displaced})
function bestSlotFor(d, it) {
  let best = null;
  for (const key of slotKeysFor(it, d)) {
    const sd = slotDelta(d, it, key);
    if (!sd) continue;
    const g = gearScore(d, sd.delta);
    if (!best || g > best.gain) best = { key, gain: g, delta: sd.delta, displaced: sd.tr.displaced };
  }
  return best;
}
function ownerOf(it) { return allDolls().find((d) => (d.items || []).includes(it)) || null; }
function wearerOf(it) { return allDolls().find((d) => SLOTS.some((k) => d.equip && d.equip[k] === it)) || null; }

// ================= 付けられない理由 (UI.canEquipReason) =================
// 付けられるなら null。付けられなければ短い理由: 魂なし / 未鑑定 / 職業 / 武器種 / 盾不可 / 重量 / 属性 / 呪い / 両手
const ARMOR_RANK = { heavy: 2, light: 1, cloth: 0 };
export const REASON_TEXT = {
  "装備品でない": "装備する品ではない",
  "魂なし": "魂の宿らない器は装備できない",
  "未鑑定": "鑑定するまで装備できない",
  "職業": "この職業には扱えない",
  "武器種": "この職業には扱えない武器",
  "盾不可": "この職業は盾を持てない",
  "盾種": "この職業には扱えない種類の盾",
  "重量": "この職業には重すぎる防具",
  "属性": "属性が合わない",
  "呪い": "呪われた装備が外れない",
  "両手": "呪われた装備があり、両手武器と盾を持ち替えられない",
  "ロック": "ロック中の装備は付け替えない (ロックを外すと付けられる)",
  "両手ロック": "ロック中の装備があり、両手武器と盾を持ち替えられない",
  "遠征中": "遠征に出ていて、帰るまで装備を替えられない",
};
export function canEquipReason(d, it) {
  if (!d || !it) return "装備品でない";
  if (!isEquippable(it)) return "装備品でない";
  if (d.primary == null) return "魂なし";
  if (game.expeditionOf && game.expeditionOf(d)) return "遠征中";
  if (it.unidentified) return "未鑑定";
  if (!canEquip(d, it)) {
    if (it.align && d.align && it.align !== "中立" && d.align !== "中立" && it.align !== d.align) return "属性";
    if (it.classes || it.forJob) return "職業";
    const gear = JOB_GEAR[d.clsKey];
    if (gear) {
      if (it.slot === "weapon") return "武器種";
      if (it.slot === "shield") return gear.shields && gear.shields.length ? "盾種" : "盾不可";
      if (it.weight && (ARMOR_RANK[it.weight] || 0) > (ARMOR_RANK[gear.armor] || 0)) return "重量";
    }
    return "職業";
  }
  let why = null;
  for (const k of slotKeysFor(it, d)) {
    const cur = d.equip && d.equip[k];
    if (cur && cur.cursed) { why = why || "呪い"; continue; }
    if (cur && cur.locked) { why = why || "ロック"; continue; }
    const sh = it.slot === "weapon" && it.twoHanded ? d.equip.shield : null;
    const wp = k === "shield" && d.equip.weapon && d.equip.weapon.twoHanded ? d.equip.weapon : null;
    if ((sh && sh.cursed) || (wp && wp.cursed)) { why = "両手"; continue; }
    if ((sh && sh.locked) || (wp && wp.locked)) { why = "両手ロック"; continue; }
    return null;
  }
  return why || "呪い";
}

// UI.bestWearer: 隊 (生存) のうち、この品で最も伸びる人業。伸びる者がいなければ null
function bestWearer(item) {
  if (!item || item.unidentified || !isEquippable(item)) return null;
  let best = null, bestScore = 0.05;
  for (const d of G_().party) {
    if (!d || !d.alive || canEquipReason(d, item)) continue;
    const b = bestSlotFor(d, item);
    if (b && b.gain > bestScore) { best = d; bestScore = b.gain; }
  }
  return best;
}

// ================= 装備する (元に戻すつき) =================
// 増減を表示する能力のキー (攻撃力と同じだけ動いた STR は省く)
function deltaKeys(delta) {
  return Object.keys(DLABEL).filter((k) => delta[k] && typeof delta[k] === "number" && !(k === "atk" && delta.power === delta.atk));
}
// 増減の大きい順
function sortedDeltaKeys(delta) {
  return deltaKeys(delta).sort((a, b) => Math.abs(delta[b]) - Math.abs(delta[a]));
}
const deltaLabel = (delta, k) => `${delta[k] > 0 ? "▲" : "▼"}${DLABEL[k]}${delta[k] > 0 ? "+" : ""}${delta[k]}`;
const deltaSpan = (delta, k) => el("span", delta[k] > 0 ? "up" : "dn", deltaLabel(delta, k));
function deltaText(delta, n = 3) {
  if (!delta) return "";
  return sortedDeltaKeys(delta).slice(0, n).map((k) => deltaLabel(delta, k)).join(" ");
}
// 品 item を doll の部位 key に装備する (いま持っている袋から)。stashTo = 外した品を入れる袋 (取り替え)。
// quiet でなければ「元に戻す」つきのトースト。{ ok, key, delta, full, msg }
function equipWithUndo(doll, item, key = null, { stashTo = null, quiet = false } = {}) {
  if (!doll || !item) return { ok: false };
  const owner = ownerOf(item);
  if (!owner) return { ok: false, msg: "持ち主が見つからない" };
  key = key || (bestSlotFor(doll, item) || {}).key || slotKeysFor(item, doll)[0];
  if (!key) return { ok: false, msg: "装備できない" };
  const involved = uniq([doll, owner, stashTo]);
  const snap = snapshotEquip(involved);
  const before = previewStats(doll, doll.equip, recalc);
  const r = game.equipAt(doll, item, key, owner, stashTo);
  if (!r || !r.ok) {
    if (r && r.msg && !r.full) { game.log(r.msg, "sys"); sfx("ng"); toast(r.msg, { tone: "bad" }); }
    return { ...(r || { ok: false }), key };
  }
  game.log(r.msg, "win");
  if (owner !== doll) game.log(`${owner.name} から ${item.name} を受け取り装備した。`, "win");
  if (stashTo && r.displaced && r.displaced.length) game.log(`外した ${r.displaced.map((x) => x.name).join("・")} は ${stashTo.name} の袋へ。`, "sys");
  sfx("select"); buzz(10);
  const delta = statsDelta(before, previewStats(doll, doll.equip, recalc));
  const sig = equipSignature(involved);
  if (game.autosave) game.autosave(true);
  rerender();
  if (doll === selDoll) floatDelta(`[data-slot="${key}"]`, delta);
  if (!quiet) {
    toast(`${doll.name} ← ${item.name}　${deltaText(delta)}`, {
      tone: "good", icon: item,
      action: { label: "元に戻す", fn: () => {
        if (equipSignature(involved) !== sig) { sfx("ng"); toast("装備が変わったため、元に戻せない", { tone: "bad" }); return; }
        restoreEquip(snap, recalc);
        game.log(`${item.name} の装備を元に戻した。`, "sys");
        sfx("select");
        if (game.autosave) game.autosave(true);
        rerender();
      } },
    });
  }
  return { ok: true, key, delta };
}
// UI.equipItemTo: 品をこの人業に装備する (持ち主の袋から)。{ ok, msg }
function equipItemTo(doll, item, opts = {}) {
  const o = typeof opts === "string" ? { key: opts } : (opts || {});
  return equipWithUndo(doll, item, o.key || null, { quiet: !!o.quiet, stashTo: o.stashTo || null });
}
// 札から装備する: 付けられない理由があれば知らせ、袋が満杯なら「持ち主と取り替える」を差し出す
// key = 部位を決めて付ける (装備候補のシートから。二刀流の左手など)。省略時は一番伸びる部位
function pickWearer(doll, item, { onDone = null, chip = null, key = null } = {}) {
  const why = canEquipReason(doll, item);
  if (why) { sfx("ng"); if (chip) shake(chip); toast(`${doll.name}: ${REASON_TEXT[why] || why}`, { tone: "bad" }); return { ok: false, reason: why }; }
  const b = key ? (() => { const sd = slotDelta(doll, item, key); return sd ? { key, displaced: sd.tr.displaced } : null; })() : bestSlotFor(doll, item);
  if (!b) { sfx("ng"); return { ok: false }; }
  const r = equipWithUndo(doll, item, b.key);
  if (r.ok) { if (onDone) onDone(r); return r; }
  if (r.full) {
    const owner = ownerOf(item);
    const names = (b.displaced || []).map((x) => x.name).join("・");
    const canSwap = owner && owner !== doll && (owner.items.length - 1 + (b.displaced || []).length) <= MAX_ITEMS;
    if (canSwap) {
      confirm({
        banner: "持ち物がいっぱい", title: `${doll.name}の持ち物がいっぱいだ`,
        lines: [`外した ${names} を ${owner.name} の袋へ移して (取り替えて) 装備する？`],
        okLabel: "取り替えて装備", cancelLabel: "やめる", danger: false,
      }).then((y) => { if (!y) return; const r2 = equipWithUndo(doll, item, b.key, { stashTo: owner }); if (r2.ok && onDone) onDone(r2); });
    } else {
      sfx("ng");
      toast(`${doll.name}の持ち物がいっぱいで、外した ${names || "装備"} を入れられない ― 袋を1つ空けてから`, { tone: "bad", ms: 3200 });
    }
    return r;
  }
  return r;
}

// ================= 品 → 人業を選ぶ (UI.equipChooserEl / UI.equipChooser) =================
// 全員 (街: 隊+控え / 迷宮: 隊) の札を並べる。付けられる者は ▲▼ の伸び、付けられない者は灰色に理由。
// 最も伸びる者を金で示す。札を1タップでその人業に装備する (onPick で差し替えられる: 商会の「買って装備」など)
// 札に並ぶ変化は CH_PER 行まで。それより多い札は CH_CYCLE_MS ごとに次の行へ送り (右下の点 = いまの頁)、
// 見出しの「すべての変化」で全員の全部の変化を1枚に並べたシートを開く (札の大きさは変えない)。
const CH_PER = 2;
const CH_CYCLE_MS = 2600;
// 付け替えで外れる品 (いまの装備) と特殊効果の増減 (ユーザーの指示、2026-10: 攻撃力が上がっても
// 2連撃などを失えば実質の弱体化になるので、いまの装備と何が変わるかを並べて見せる)。
// lost = 外れる品にあって新しい品に無い効果 (▼) / got = 新しい品にだけある効果 (▲)
function swapInfo(item, b) {
  const cur = (b && b.displaced) || [];
  const before = cur.flatMap((it) => specialParts(it));
  const after = specialParts(item);
  return { cur, lost: before.filter((p) => !after.includes(p)), got: after.filter((p) => !before.includes(p)) };
}
const curNameEl = (cls, it) => (game.itemNameEl ? game.itemNameEl("span", cls, it, it.cursed ? " (呪)" : "") : el("span", cls, itemName(it)));
// 「いま 〇〇」の行 (外れる品の名。何も外れなければ「いま なし」)
function wornLine(cls, sw) {
  const ln = el("span", cls);
  ln.appendChild(el("span", cls + "-lab", "いま"));
  if (!sw.cur.length) ln.appendChild(el("span", cls + "-none", "なし"));
  sw.cur.forEach((it, i) => {
    if (i) ln.appendChild(el("span", cls + "-lab", "・"));
    ln.appendChild(curNameEl(cls + "-n", it));
  });
  return ln;
}
// 特殊効果の増減の札 (▼失う / ▲得る)
function fxDeltaSpans(sw) {
  return [
    ...sw.lost.map((p) => el("span", "fx dn", `▼${p}`)),
    ...sw.got.map((p) => el("span", "fx up", `▲${p}`)),
  ];
}
export function equipChooserEl(item, { owner = null, onPick = null, onDone = null, town = null } = {}) {
  const G = G_();
  const inT = town == null ? inTown() : town;
  const wrap = el("div", "pt-ch");
  const head = el("div", "pt-ch-h");
  head.appendChild(el("span", "pt-ch-t", "誰に装備させる？"));
  wrap.appendChild(head);
  const dolls = inT ? allDolls() : G.party.slice();
  const infos = dolls.map((d) => {
    const why = canEquipReason(d, item);
    const b = why ? null : bestSlotFor(d, item);
    return { d, why, b, keys: b ? sortedDeltaKeys(b.delta) : [], sw: b ? swapInfo(item, b) : null };
  });
  let best = null;
  for (const x of infos) if (x.b && x.b.gain > 0.05 && (!best || x.b.gain > best.b.gain)) best = x;
  const act = (x) => {
    if (onPick) return onPick(x.d, { reason: x.why, best: x.b, chip: x.c });
    pickWearer(x.d, item, { chip: x.c, onDone });
  };
  const rotors = [];
  const grid = el("div", "pt-ch-grid");
  let sepDone = false;
  for (const x of infos) {
    if (!sepDone && isReserve(x.d)) {
      sepDone = true;
      grid.appendChild(el("div", "pt-ch-sep", "控え"));
    }
    const c = el("button", "pt-chc" + (x.why ? " ng" : "") + (x === best ? " best" : "") + (x.d === owner ? " own" : ""));
    c.type = "button";
    x.c = c;
    const pc = el("span", "pt-chc-p");
    pc.appendChild(partyPortraitCanvas(x.d, 36));
    if (!x.d.alive) pc.appendChild(el("span", "pt-chc-dead", "✝"));
    c.appendChild(pc);
    const tx = el("span", "pt-chc-t");
    tx.appendChild(el("span", "pt-chc-n", x.d.name));
    if (x.why) tx.appendChild(el("span", "pt-chc-why", x.why));
    else {
      tx.appendChild(wornLine("pt-chc-cur", x.sw));
      if (item.slot === "weapon") {
        const result = weaponPowerPreview(item, x.d);
        if (result) tx.appendChild(el("span", "pt-chc-power", `攻撃力 ${result.before} → ${result.power}`));
      }
      // 特殊効果の増減は送らずに常に見せる (失う効果を見落とさないように)
      const fxs = fxDeltaSpans(x.sw);
      if (fxs.length) {
        const fl = el("span", "pt-chc-fx");
        for (const f of fxs) fl.appendChild(f);
        tx.appendChild(fl);
      }
      const dl = el("span", "pt-chc-d");
      if (!x.keys.length && !fxs.length) dl.appendChild(el("span", "eq", "変化なし"));
      const pages = [];
      for (let i = 0; i < x.keys.length; i += CH_PER) {
        const pg = el("span", "pt-chc-pg" + (i ? "" : " on"));
        for (const k of x.keys.slice(i, i + CH_PER)) pg.appendChild(deltaSpan(x.b.delta, k));
        dl.appendChild(pg);
        pages.push(pg);
      }
      tx.appendChild(dl);
      if (pages.length > 1) {
        dl.classList.add("multi");
        const dots = el("span", "pt-chc-dots");
        const marks = pages.map((_, j) => dots.appendChild(el("i", j ? "" : "on")));
        c.appendChild(dots);
        rotors.push({ pages, marks });
      }
    }
    c.appendChild(tx);
    if (x === best) c.appendChild(el("span", "pt-chc-best", "最良"));
    else if (x.d === owner) c.appendChild(el("span", "pt-chc-own", "所持"));
    c.setAttribute("aria-label", `${x.d.name}${x.why ? `: ${REASON_TEXT[x.why] || x.why}` : ` に装備 ${deltaText(x.b.delta, Infinity)} ${[...x.sw.lost.map((p) => `${p}を失う`), ...x.sw.got.map((p) => `${p}を得る`)].join(" ")}`}`);
    c.addEventListener("click", () => act(x));
    grid.appendChild(c);
  }
  // 付けられる者がいれば: 見出しに「いまの装備と比べる」(外れる品の特殊効果まで並べたシート)
  if (infos.some((x) => x.b)) {
    const all = el("button", "pt-ch-all", "▲▼ いまの装備と比べる ›");
    all.type = "button";
    all.addEventListener("click", () => { sfx("select"); openDeltaSheet(item, infos, best, act); });
    head.appendChild(all);
  } else head.appendChild(el("span", "pt-ch-s", "▲▼ = いまの装備と比べて"));
  // 変化が CH_PER を超える者がいれば札の行を送る
  if (rotors.length) {
    let n = 0, seen = false, idle = 0;
    const timer = setInterval(() => {
      // 画面から外れたら止める (まだ置かれていない間は少しだけ待つ)
      if (!wrap.isConnected) { if (seen || ++idle > 4) clearInterval(timer); return; }
      seen = true;
      n++;
      for (const r of rotors) {
        const i = n % r.pages.length;
        r.pages.forEach((p, j) => p.classList.toggle("on", j === i));
        r.marks.forEach((m, j) => m.classList.toggle("on", j === i));
      }
    }, CH_CYCLE_MS);
  }
  wrap.appendChild(grid);
  return wrap;
}
// 「いまの装備と比べる」: 付けられる全員の、いまの装備 (外れる品とその特殊効果) と装備したときの全部の変化を
// 1枚に並べる。行を押せばその人業に装備する
function openDeltaSheet(item, infos, best, act) {
  const list = el("div", "pt-chl");
  const newFx = specialShort(item);
  const nb = el("div", "pt-chl-new");
  nb.appendChild(el("span", "pt-chl-new-lab", "この品"));
  nb.appendChild(curNameEl("pt-chl-new-n", item));
  nb.appendChild(el("span", "pt-chl-new-fx", newFx ? `特殊効果: ${newFx}` : "特殊効果なし"));
  list.appendChild(nb);
  list.appendChild(el("div", "pt-chl-s", "▲▼ = いまの装備と比べて ・ 押すとその人業に装備する"));
  let h = null;
  let sepDone = false;
  for (const x of infos) {
    if (!x.b) continue;
    if (!sepDone && isReserve(x.d)) {
      sepDone = true;
      list.appendChild(el("div", "pt-ch-sep", "控え"));
    }
    const r = el("button", "pt-chl-r" + (x === best ? " best" : ""));
    r.type = "button";
    const pc = el("span", "pt-chc-p");
    pc.appendChild(partyPortraitCanvas(x.d, 36));
    if (!x.d.alive) pc.appendChild(el("span", "pt-chc-dead", "✝"));
    r.appendChild(pc);
    const tx = el("span", "pt-chl-t");
    const nm = el("span", "pt-chl-n", x.d.name);
    if (x === best) nm.appendChild(el("span", "pt-chl-best", "最良"));
    tx.appendChild(nm);
    // いまの装備 (外れる品) と、その特殊効果
    const cb = el("span", "pt-chl-cur");
    if (!x.sw.cur.length) cb.appendChild(wornLine("pt-chl-cur-l", x.sw));
    for (const it of x.sw.cur) {
      const one = wornLine("pt-chl-cur-l", { cur: [it] });
      const fx = specialShort(it);
      one.appendChild(el("span", "pt-chl-cur-fx" + (fx ? "" : " none"), fx ? fx : "特殊効果なし"));
      cb.appendChild(one);
    }
    tx.appendChild(cb);
    const ds = el("span", "pt-chl-d");
    if (!x.keys.length) ds.appendChild(el("span", "eq", "能力の変化なし"));
    for (const k of x.keys) ds.appendChild(deltaSpan(x.b.delta, k));
    tx.appendChild(ds);
    const fxs = fxDeltaSpans(x.sw);
    if (fxs.length) {
      const fl = el("span", "pt-chl-fx");
      fl.appendChild(el("span", "pt-chl-fx-lab", "特殊効果"));
      for (const f of fxs) fl.appendChild(f);
      tx.appendChild(fl);
    }
    r.appendChild(tx);
    r.setAttribute("aria-label", `${x.d.name} に装備 ${deltaText(x.b.delta, Infinity) || "変化なし"} ${[...x.sw.lost.map((p) => `${p}を失う`), ...x.sw.got.map((p) => `${p}を得る`)].join(" ")}`);
    r.addEventListener("click", () => { if (h) h.close("pick"); act(x); });
    list.appendChild(r);
  }
  const rk = RARITIES[rarityKey(item)];
  h = sheet.open({
    kind: "info", banner: "いまの装備と比べる", accent: rk ? rk.color : null,
    title: itemName(item), titleColor: rk ? rk.color : null, body: list,
    footer: [{ label: "もどる", kind: "secondary", onTap: (hh) => hh.close("back") }],
  });
}
// 品の画面 (シート): 品の要約 + 誰に装備させるか (主役) + その他の操作 (使う・渡す・売る・迷宮では捨てる…)
export function openEquipChooser(item, { owner = null, actions = null } = {}) {
  if (!item) return null;
  owner = owner || ownerOf(item);
  const rk = rarityKey(item);
  const accent = rk ? RARITIES[rk].color : null;
  let h = null;
  const body = el("div", "pt-item ch");
  body.appendChild(itemSummary(item, accent, { compact: true }));
  const performance = weaponPerformanceEl(item, owner);
  if (performance) body.appendChild(performance);
  body.appendChild(equipChooserEl(item, { owner, onDone: () => { if (h) h.close("ok"); } }));
  if (item.desc) body.appendChild(el("div", "pt-item-desc", item.desc));
  const acts = actions || (owner ? itemActions(item, owner, "bag", { equip: false }) : []);
  h = sheet.open({
    kind: "info", banner: game.itemGradeText ? game.itemGradeText(item, "品") : "品", accent, body, className: "pt-item-sheet pt-ch-sheet",
    footer: acts.length ? acts : [{ label: "閉じる", kind: "ghost", onTap: (s) => s.close() }],
  });
  return h;
}

// ================= 最適装備 =================
// 後衛 (隊の4人目以降) には近接物理の武器を選ばない (与ダメ半減・敵の前列にしか届かない)。手で付けるのは自由
function autoAllow(d, it) {
  const G = G_();
  const pi = G && G.party ? G.party.indexOf(d) : -1;
  return !(pi >= 3 && isMeleeWeapon(it));
}
let bgcMemo = { key: "", n: 0, hints: [] };
function betterGearCount() {
  const G = G_();
  if (!G || !G.party) return 0;
  // 魂の付け替え・融合・サブ魂・結社でも能力が変わるので、能力そのものも鍵に入れる (古い見積りで印を点けない)
  const key = equipSignature(allDolls()) + "|" + G.party.map((d) => d ? `${d.jobKey}:${d.level}:${d.maxhp},${d.maxmp},${d.atk},${d.vit},${d.agi},${d.int},${d.pie},${d.luk}:${G.party.indexOf(d)}` : "-").join(",");
  if (bgcMemo.key === key) return bgcMemo.n;
  memoClear();
  let n = 0;
  const hints = [];
  for (const d of G.party) {
    if (!d) continue;
    let hit = false;
    for (const k of SLOTS) {
      const best = slotCandidates(d, k).find((c) => c.room && !c.cursed && c.gain > 0.05 && autoAllow(d, c.it));
      if (best) { hit = true; hints.push(`b${d.uid}:${k}:${best.it.id}`); }
    }
    if (hit) n++;
  }
  bgcMemo = { key, n, hints };
  return n;
}

// ================= タブの印 (赤い点) =================
// 器の砕けた人業 (数) は、いま館で修復できる間だけ出す (連れ帰りを待つ間・金貨が足りない間は、館ですることが無い)。
// 「✦で鍛えられる魂」「袋により良い品」は放っておいても困らないお勧めなので、館を開いたら既読にし、
// 新しく増えた時だけ点け直す (✦Soul は戦闘のたびに貯まるので、既読にしないと点きっぱなしになる)。
function tabHints() {
  const out = [];
  try { for (const x of (ops.trainableList ? ops.trainableList() : [])) out.push(`t${x.uid}`); } catch (e) { /* noop */ }
  try { if (betterGearCount() > 0) out.push(...bgcMemo.hints); } catch (e) { /* noop */ }
  return out;
}
function ackTabHints() {
  const now = tabHints();
  const seen = getPref("partyHintsSeen", []) || [];
  if (now.length !== seen.length || now.some((k) => !seen.includes(k))) setPref("partyHintsSeen", now);
}
function tabBadge(counts) {
  if (counts && counts.repairNow) return counts.repairNow;
  const seen = getPref("partyHintsSeen", []) || [];
  return tabHints().some((k) => !seen.includes(k)) ? true : null;
}

function autoEquip(target = "all") {
  const G = G_();
  if (!G) return { ok: false, moves: 0 };
  const targets = target === "all" ? G.party.filter(Boolean) : [target].filter(Boolean);
  if (!targets.length) return { ok: false, moves: 0 };
  if (targets.some((d) => game.expeditionOf && game.expeditionOf(d))) { sfx("ng"); toast("遠征に出ている人業の装備は、帰ってきてから整える", { tone: "bad" }); return { ok: false, moves: 0 }; }
  const pool = itemsPool();
  const plan = planBestEquip(targets, { pool, canEquip, score: gearScore, recalc, allow: autoAllow });
  if (!plan.moves.length) {
    sfx("select");
    toast(targets.length > 1 ? "パーティの装備は、いまが最良だ" : `${targets[0].name}の装備は、いまが最良だ`, { tone: "info" });
    return { ok: false, moves: 0 };
  }
  const involved = plan.undoSnapshot.map((s) => s.doll);
  const before = new Map(plan.undoSnapshot.map((s) => [s.doll, previewStats(s.doll, s.equip, recalc)]));
  if (!applyPlan(plan, { recalc })) { sfx("ng"); toast("付け替えられなかった", { tone: "bad" }); return { ok: false, moves: 0 }; }
  const sig = equipSignature(involved);
  for (const m of plan.moves) game.log(`最適装備: ${m.doll.name} ← ${m.item.name}${m.from !== m.doll ? `（${m.from.name}から）` : ""}`, "win");
  sfx("itemget"); buzz([0, 20, 30, 20]);
  bgcMemo.key = "";
  if (game.autosave) game.autosave(true);
  rerender();
  const sel = targets.includes(selDoll) ? selDoll : targets[0];
  const d0 = before.get(sel);
  if (d0) floatDelta(".pt-head .pt-port", statsDelta(d0, previewStats(sel, sel.equip, recalc)));
  // 結果のシート: 誰が何を装備し、能力がどう変わったか (+ 元に戻す)
  const undo = () => {
    if (equipSignature(involved) !== sig) { sfx("ng"); toast("装備が変わったため、元に戻せない", { tone: "bad" }); return false; }
    restoreEquip(plan.undoSnapshot, recalc);
    game.log("最適装備を元に戻した。", "sys");
    sfx("select"); bgcMemo.key = "";
    if (game.autosave) game.autosave(true);
    rerender();
    toast("元に戻した", { tone: "info" });
    return true;
  };
  openAutoEquipResult(plan, before, undo);
  return { ok: true, moves: plan.moves.length, plan };
}

// 最適装備の結果: 人業ごとに [部位: 前の品 → 新しい品 (誰から)]、特殊効果と能力の 前→後
function openAutoEquipResult(plan, before, undo) {
  const rows = [];
  for (const s of plan.undoSnapshot) {
    const d = s.doll;
    const changes = SLOTS.filter((k) => (s.equip[k] || null) !== (d.equip[k] || null)).map((k) => {
      const it = d.equip[k] || null;
      const mv = it && plan.moves.find((m) => m.item === it && m.doll === d);
      return { k, from: s.equip[k] || null, to: it, giver: mv && mv.from !== d ? mv.from : null };
    });
    if (!changes.length) continue;
    const b = before.get(d), a = previewStats(d, d.equip, recalc);
    rows.push({ d, changes, b, a });
  }
  if (!rows.length) return null;
  const nameEl = (cls, it) => (game.itemNameEl ? game.itemNameEl("span", cls, it) : el("span", cls, itemName(it)));
  const body = el("div", "pt-ae");
  for (const r of rows) {
    const card = el("div", "pt-ae-card");
    const top = el("div", "pt-ae-top");
    top.appendChild(portraitEl(r.d, { size: 36, tag: "span" }));
    top.appendChild(el("span", "pt-ae-n", r.d.name));
    card.appendChild(top);
    const list = el("div", "pt-ae-list");
    for (const c of r.changes) {
      const ln = el("div", "pt-ae-ln");
      ln.appendChild(el("span", "pt-ae-k", slotLabelOf(r.d, c.k)));
      const tx = el("span", "pt-ae-tx");
      if (c.from) { tx.appendChild(nameEl("pt-ae-old", c.from)); tx.appendChild(el("span", "pt-ae-ar", "→")); }
      if (c.to) tx.appendChild(nameEl("pt-ae-new", c.to));
      else tx.appendChild(el("span", "pt-ae-none", "外す"));
      if (c.giver) tx.appendChild(el("span", "pt-ae-from", `（${c.giver.name}から）`));
      ln.appendChild(tx);
      list.appendChild(ln);
      const oldFx = specialLines(c.from), newFx = specialLines(c.to);
      if (oldFx.length || newFx.length) {
        const fx = el("div", "pt-ae-fx");
        fx.appendChild(el("div", "pt-ae-fxh", "特殊効果"));
        for (const [label, lines, cls] of [["付け替え前", oldFx, "before"], ["付け替え後", newFx, "after"]]) {
          const block = el("div", `pt-ae-fxb ${cls}`);
          block.appendChild(el("div", "pt-ae-fxk", label));
          for (const text of lines.length ? lines : ["なし"]) block.appendChild(el("div", "pt-ae-fxl", text));
          fx.appendChild(block);
        }
        list.appendChild(fx);
      }
    }
    card.appendChild(list);
    const st = el("div", "pt-ae-st");
    // 攻撃力 (参照能力 × 武器の係数) を先頭に。STR は攻撃力と同じだけ動いた時は省く
    const pairs = [["power", "power"], ["atk", "atk"], ["vit", "vit"], ["agi", "agi"], ["int", "int"], ["pie", "pie"], ["luk", "luk"], ["hp", "maxhp"], ["mp", "maxmp"]];
    for (const [lab, k] of pairs) {
      const v0 = r.b[k] || 0, v1 = r.a[k] || 0;
      if (v0 === v1) continue;
      if (k === "atk" && v1 - v0 === (r.a.power || 0) - (r.b.power || 0)) continue;
      const chip = el("span", "pt-ae-s " + (v1 > v0 ? "up" : "dn"));
      chip.appendChild(el("span", "pt-ae-sk", DLABEL[lab]));
      chip.appendChild(el("span", null, `${v0}→${v1}`));
      chip.appendChild(el("span", "pt-ae-sd", `${v1 > v0 ? "▲" : "▼"}${Math.abs(v1 - v0)}`));
      st.appendChild(chip);
    }
    // 能力値以外で点数に効くもの (ブレス耐性・状態異常耐性) も、付け替えの理由がわかるように出す。
    // 状態異常耐性は種類ごとに (合計だと何の耐性が動いたのかわからない — ユーザーの指示)
    const pct = (v) => Math.round((v || 0) * 100);
    const resRows = [["ブレス耐性", pct(r.b.breathRes), pct(r.a.breathRes)]];
    for (const k of Object.keys(AIL_LABEL)) resRows.push([`${AIL_LABEL[k]}耐性`, pct((r.b.ailRes || {})[k]), pct((r.a.ailRes || {})[k])]);
    for (const [lab, v0, v1] of resRows) {
      if (v0 === v1) continue;
      const chip = el("span", "pt-ae-s " + (v1 > v0 ? "up" : "dn"));
      chip.appendChild(el("span", "pt-ae-sk", lab));
      chip.appendChild(el("span", null, `${v0}→${v1}%`));
      chip.appendChild(el("span", "pt-ae-sd", `${v1 > v0 ? "▲" : "▼"}${Math.abs(v1 - v0)}`));
      st.appendChild(chip);
    }
    if (!st.childElementCount) st.appendChild(el("span", "pt-ae-s eq", "能力の変化なし"));
    card.appendChild(st);
    body.appendChild(card);
  }
  const n = plan.moves.length;
  return sheet.open({
    kind: "info", banner: "最適装備", className: "pt-ae-sheet",
    lines: [`${rows.length}体の装備を ${n}点 付け替えた。`],
    body,
    footer: [
      { label: "これでよい", kind: "primary", onTap: (h) => h.close() },
      { label: "元に戻す", kind: "ghost", onTap: (h) => { if (undo()) h.close(); } },
    ],
  });
}

// 付け替えの増減を、枠の上に浮かべる
function floatDelta(sel, delta) {
  if (!delta || !hasDOM()) return;
  const t = deltaText(delta);
  if (!t) return;
  const up = Object.keys(DLABEL).reduce((s, k) => s + (k === "power" ? 0 : (delta[k] || 0)), 0) >= 0;
  requestAnimationFrame(() => {
    const scope = (sheetH && !sheetH.closed) ? sheetH.el : document;
    const a = scope && scope.querySelector(sel);
    if (a) deltaFloat(a, t.replace(/[▲▼]/g, ""), up ? "up" : "dn");
  });
}

// ================= 描画の入口 =================
export function queueIntent(o) { intent = { ...(intent || {}), ...(o || {}) }; }

export function select(d) {
  if (!d) return;
  selDoll = d;
  picked = null;
  const i = G_().party.indexOf(d);
  if (i >= 0) setPref("partyIdx", i);
}

function ensureSel() {
  const dolls = allDolls();
  if (selDoll && dolls.includes(selDoll)) return selDoll;
  const G = G_();
  const i = getPref("partyIdx", 0) || 0;
  selDoll = G.party[i] || G.party[0] || dolls[0] || null;
  if (picked && !G.party.includes(picked)) picked = null;
  return selDoll;
}

// 描き直す (街: 街シェル経由 / 迷宮: シート)
function rerender() {
  memoClear(); bgcMemo.key = "";
  if (reserveH && !reserveH.closed) { try { reserveH.update({}); } catch (e) { /* noop */ } }
  if (sheetH && !sheetH.closed) refreshSheet();
  else if (inTown() && game.renderTown) game.renderTown();
  if (game.renderParty) { try { game.renderParty(); } catch (e) { /* 盤面が無い時 */ } }
}
export function refresh() {
  if (sheetH && !sheetH.closed) { refreshSheet(); return; }
  const G = G_();
  if (G && G.state === "town" && G.town && G.town.tab === "party" && !G.town.facility && !G.town.page && game.renderTown) game.renderTown();
}

// 街の「隊」タブ。api.entered = 他のタブ・迷宮から館に入ってきた描画 (同じタブの描き直しでは false)
function renderTab(root, api) {
  const entered = !!(api && api.entered);
  if (entered && !pendingOpen) resetView();
  if (entered) onEnterMansion();
  const wrap = el("div", "pt-root m-town");
  renderView(wrap, "town");
  root.appendChild(wrap);
  ackTabHints(); // 館を開いた = お勧めは見た (タブの赤い点を消す)
  // 予約された操作 (旧「館」の入口から: 控え・仕立て / 魂の区分)
  if (intent) {
    const it = intent; intent = null;
    if (it.reserve) setTimeout(() => openReserve(), 0);
    if (it.create) wantCreate = true;
  }
  if (!isGreeted()) { if (entered || wantCreate) scheduleGreeting(); }
  else if (wantCreate) { wantCreate = false; setTimeout(() => openCreateDoll(), 0); }
  else if (game.pendingIreneBeat && game.pendingIreneBeat()) scheduleBeat();
  if (isGreeted() && UI.tutorialMansionVisited) UI.tutorialMansionVisited();
}
// 館の語り (src/story.js IRENE_BEATS): 師の手がかりを持ち帰った後に館へ入ると、イレーヌが語る (一度だけ)
let beatTimer = null;
function scheduleBeat() {
  if (beatTimer) return;
  beatTimer = setTimeout(() => {
    beatTimer = null;
    const G = G_();
    if (!G || G.state !== "town" || !G.town || G.town.tab !== "party" || G.town.page || G.prompt || sceneActive() || UI.tutorialActive?.()) return;
    if (game.playIreneBeat) game.playIreneBeat(() => { curLine = nextLine({ entry: true }); rerender(); });
  }, 120);
}

function renderView(root, mode) {
  const G = G_();
  memoClear();
  if (intent && intent.seg) { setSeg(intent.seg); if (!intent.reserve) intent = null; else delete intent.seg; }
  const d = ensureSel();
  if (!allDolls().length) {
    root.appendChild(emptyState());
    if (mode === "town" && !sheetTown) { root.classList.add("has-keeper"); root.appendChild(keeperPanel()); }
    return;
  }
  const dead = deadBanner(mode);
  if (dead) root.appendChild(dead);
  if (mode === "town" || G.party.length > 1) root.appendChild(formationEl(mode));
  if (!d) return;
  root.appendChild(picked ? pickHint() : dollHeader(d, mode));
  if (mode === "dungeon") { const cs = campStrip(d); if (cs) root.appendChild(cs); }
  root.appendChild(segBar(d, mode));
  const body = el("div", "pt-body");
  const seg = curSeg();
  body.dataset.seg = seg;
  if (seg === "equip") equipSeg(body, d, mode);
  else if (seg === "soul") renderSoulSeg(body, d, { mode, rerender, G });
  else statsSeg(body, d, mode);
  root.appendChild(body);
  if (mode === "town" && !sheetTown) {
    scrollBox(body); // 収まらなければ内側で縦にスクロール
    root.classList.add("has-keeper");
    root.appendChild(keeperPanel());
  }
}

// ================= 館の主イレーヌ (街の「人業の館」の下段: 残りの高さに挿絵と台詞) =================
// 区分の中身が収まった後の余白だけを使う (足りなければ畳む: ui-party.css のコンテナクエリ)。
// 話す中身は src/ui/irene.js: 館に入るたびに、いま話せる話題 (進むほど増える) からひとつ。タップで次の話。
// 初めて館に入った時は、全画面の会話の場面で挨拶と館の案内をしてから (終われば、人業がいなければ仕立てへ)
let curLine = null;    // いま枠に出している話 { id, lines }
let wantCreate = false; // 挨拶の後に「人業を仕立てる」を開く (目標の「仕立てる」から来た時)
let greetTimer = null;
function onEnterMansion() {
  noteVisit();
  curLine = isGreeted() ? nextLine({ entry: true }) : null;
}
// 館は前回の位置を覚えない: 入るたびに一番左 (隊の先頭) の人業の「魂」から (ユーザーの指示、2026-10)
function resetView() {
  const G = G_();
  selDoll = (G && G.party && G.party[0]) || allDolls()[0] || null;
  picked = null;
  statOpen = null;
  setPref("partyIdx", 0);
  remember("seg", "party", "soul");
}
function scheduleGreeting() {
  if (greetTimer) return;
  greetTimer = setTimeout(() => {
    greetTimer = null;
    const G = G_();
    if (!G || G.state !== "town" || !G.town || G.town.tab !== "party" || G.town.page || isGreeted() || sceneActive()) return;
    playIreneScene(greetingPages(), () => {
      ireneState().greeted = true;
      curLine = nextLine({ entry: true });
      if (game.autosave) game.autosave(true);
      // 仕立てを開くのはここだけ (先に予約を消す: rerender が wantCreate を見て、もう一枚開いてしまうため)
      const tutorial = UI.tutorialPending && UI.tutorialPending();
      const make = (wantCreate || !allDolls().length) && tutorial?.who !== "irene";
      wantCreate = false;
      rerender();
      if (make && inTown()) setTimeout(() => openCreateDoll(), 120);
    });
  }, 60);
}
// いま枠に出すべき話 (状況が変わって当てはまらなくなった助言は、別の話に替える)
function keeperLine() {
  if (!isGreeted()) return { id: null, lines: greetingPages()[0] };
  const guide = UI.tutorialIreneLines && UI.tutorialIreneLines();
  if (guide) return { id: null, lines: guide };
  if (!curLine || (curLine.id && !lineOpen(curLine.id))) curLine = nextLine();
  return curLine;
}
function keeperPanel() {
  const box = el("section", "pt-keeper");
  const inner = el("div", "pt-kp-in");
  const art = el("img", "pt-kp-art");
  art.src = IRENE_ART;
  art.alt = "";
  art.decoding = "async";
  art.draggable = false;
  inner.appendChild(art);
  const say = el("button", "pt-kp-say");
  say.type = "button";
  say.appendChild(el("span", "pt-kp-who", IRENE_WHO));
  const text = el("span", "pt-kp-text");
  const put = (ln) => {
    text.textContent = "";
    for (const l of ln.lines) if (l) text.appendChild(el("span", "pt-kp-l", l));
    say.setAttribute("aria-label", `${IRENE_WHO}「${ln.lines.join("")}」 (タップで次の話)`);
  };
  put(keeperLine());
  say.appendChild(text);
  const guide = UI.tutorialIreneLines && UI.tutorialIreneLines();
  say.appendChild(el("span", "pt-kp-next" + (guide ? " hidden" : ""), "▼"));
  say.addEventListener("click", () => {
    sfx("select");
    if (!isGreeted()) { scheduleGreeting(); return; }
    const guide = UI.tutorialIreneLines && UI.tutorialIreneLines();
    if (guide) { put({ lines: guide }); return; }
    curLine = nextLine();
    put(curLine);
    if (typeof text.animate === "function") text.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  });
  inner.appendChild(say);
  box.appendChild(inner);
  return box;
}

// UI.enterMansion({ create }): 人業の館 (隊タブ) へ。create = 着いたら「人業を仕立てる」を開く (初訪問なら挨拶の後)
function enterMansion({ create = false } = {}) {
  const G = G_();
  if (!G || G.state !== "town") return false;
  if (create) queueIntent({ create: true });
  const t = G.town || {};
  if (t.tab === "party" && !t.facility && !t.page) { game.renderTown(); return true; }
  return UI.shell ? UI.shell.setTab("party") : false;
}

// ---- 人業がひとりもいない (第0章など) ----
function emptyState() {
  const box = el("section", "pt-empty");
  box.appendChild(el("div", "pt-empty-t", "器はまだ空のまま"));
  box.appendChild(el("div", "pt-empty-s", "宿す魂をひとつ選んで器を仕立て、名を与えれば人業が目覚める。"));
  if (inTown()) {
    const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
    box.appendChild(button({ label: "人業を仕立てる", kind: "primary", size: "lg", cost: cost ? { kind: "red", n: cost } : "無料", onTap: () => openCreateDoll() }));
  }
  return box;
}

// ---- 砕けた人業の知らせ (1行) ----
// 全滅で迷宮に残された器は連れ帰りを待つ (赤い魂で早められる)。街にある器は、選んで「砕けた魂を修復」
function RESCUE_MS() { return game.RESCUE_SHORTEN_MS || 20 * 60 * 1000; }
const waiting = (d) => !!(d && !d.alive && d.reviveAt);
function deadBanner(mode) {
  const G = G_();
  // 迷宮の中: 修復も連れ帰りの時も進まない。隊の砕けた数だけ知らせる
  if (mode === "dungeon" || !inTown()) {
    const down = G.party.filter((d) => d.isDoll && !d.alive);
    if (!down.length || (down.length === 1 && down[0] === selDoll)) return null;
    const box = el("section", "pt-dead");
    const t = el("div", "pt-dead-t");
    t.appendChild(el("span", "pt-dead-mk", "✝"));
    const tx = el("span", "pt-dead-tx");
    tx.appendChild(el("b", null, down.length > 1 ? `${down.length}体` : down[0].name));
    tx.appendChild(document.createTextNode(" 砕けた ・ 街の人業の館で修復"));
    t.appendChild(tx);
    box.appendChild(t);
    return box;
  }
  const dead = allDolls().filter((d) => d.isDoll && !d.alive);
  if (!dead.length || (dead.length === 1 && dead[0] === selDoll)) return null;
  const wait = dead.filter(waiting);
  const box = el("section", "pt-dead");
  const t = el("div", "pt-dead-t");
  t.appendChild(el("span", "pt-dead-mk", "✝"));
  const tx = el("span", "pt-dead-tx");
  if (wait.length) {
    // 連れ帰りを待つ器がいる: 一番早い帰着の時 + 今すぐ連れ帰る
    const now = Date.now();
    const soonest = wait.slice().sort((a, b) => a.reviveAt - b.reviveAt)[0];
    const cost = wait.reduce((a, d) => a + Math.max(1, Math.ceil((d.reviveAt - now) / RESCUE_MS())), 0);
    tx.appendChild(el("b", null, wait.length > 1 ? `${wait.length}体` : wait[0].name));
    tx.appendChild(document.createTextNode(" 連れ帰り "));
    if (game.reviveTimerEl) tx.appendChild(game.reviveTimerEl("span", "pt-dead-tm", "", soonest));
    t.appendChild(tx);
    box.appendChild(t);
    const b = button({ label: "今すぐ連れ帰る", kind: "danger", size: "sm", cost: { kind: "red", n: cost }, disabled: (G.redSoul || 0) < 1, onTap: () => confirmHastenAll(cost) });
    b.classList.add("pt-dead-b");
    box.appendChild(b);
    return box;
  }
  tx.appendChild(el("b", null, dead.length > 1 ? `${dead.length}体` : dead[0].name));
  tx.appendChild(document.createTextNode(" 砕けた ・ 選んで魂を修復"));
  t.appendChild(tx);
  box.appendChild(t);
  const first = dead.find((d) => d !== selDoll) || dead[0];
  const b = button({ label: "選ぶ", kind: "secondary", size: "sm", onTap: () => { select(first); rerender(); } });
  b.classList.add("pt-dead-b");
  box.appendChild(b);
  return box;
}
function confirmHastenAll(cost) {
  const G = G_();
  const have = G.redSoul || 0;
  confirm({
    banner: "連れ帰る", title: `赤い魂 ${Math.min(cost, have)} を捧げ、迷宮に残された人業を連れ帰る？`,
    lines: [cost > have ? `必要 ${cost} のうち、所持の ${have} だけ捧げる (連れ帰りが早まる)。` : "赤い魂1つで連れ帰りが20分早まる。", "届いた器は、館で金貨を払って修復する。", `所持: 赤い魂 ${have}`],
    okLabel: "連れ帰る", danger: false,
  }).then((ok) => {
    if (!ok) return;
    const r = ops.hastenAll ? ops.hastenAll() : null;
    if (r && r.ok) toast(r.arrived ? `${r.arrived}体が街へ届いた (赤い魂 ${r.spent})` : `連れ帰りを早めた (赤い魂 ${r.spent})`, { tone: "good" });
    rerender();
  });
}

// ================= 隊列ストリップ (1列: 前衛3 | 後衛3 | 控え) =================
function formationEl(mode) {
  const G = G_();
  const town = mode === "town";
  const wrap = el("section", "pt-form" + (picked ? " picking" : "") + (town ? "" : " ro"));
  for (let r = 0; r < 2; r++) {
    const grp = el("div", "pt-fgrp " + (r ? "back" : "front"));
    const rb = r ? null : resonanceChip(); // 魂の共鳴 (前衛の見出しの右。開いてからだけ)
    if (rb) {
      const hd = el("div", "pt-fgrp-h");
      hd.appendChild(el("span", "pt-fgrp-l", "前衛"));
      hd.appendChild(rb);
      grp.appendChild(hd);
    } else grp.appendChild(el("span", "pt-fgrp-l", r ? "後衛" : "前衛"));
    const inn = el("div", "pt-fgrp-in");
    let any = false;
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const d = G.party[i];
      if (d) { inn.appendChild(stripPortrait(d, i, mode)); any = true; }
      else if (town) inn.appendChild(emptySlot(i));
    }
    if (!any && !town) continue;
    grp.appendChild(inn);
    wrap.appendChild(grp);
  }
  if (town) {
    // 右: 人業 (控え) / 魂一覧 / 控えの結社 の大きな札3つ (余りが狭ければ次の段に全幅で並ぶ。機能はこの3つで固定)
    const side = el("div", "pt-side");
    side.appendChild(benchButton());
    side.appendChild(soulListButton());
    const ob = orderButton();
    if (ob) side.appendChild(ob);
    wrap.appendChild(side);
  }
  return wrap;
}

// ================= 魂の共鳴 (第七章の結びで開く。組の表・判定は src/resonance.js、記録は game.js) =================
// 隊列の前衛の見出しの右に「共鳴 n」の小さな札 → いま効いている組・合計・あと1職でそろう組のシート。
// 初めてそろった組は、街で手の空いた時に「魂の共鳴」の祝祭カードで知らせる (queueResonanceNotice)。
// 図鑑 (palace.js) の「共鳴」区分も resonanceRow で札を描く
const resoOpen = () => !!(game.featureUnlocked && game.featureUnlocked("resonance"));
function resonanceChip() {
  if (!resoOpen() || !game.partyResonances) return null;
  const n = game.partyResonances().length;
  const near = game.partyNearResonances ? game.partyNearResonances().length : 0;
  const b = el("button", "pt-reso" + (n ? " on" : ""));
  b.type = "button";
  b.appendChild(el("span", "pt-reso-l", "共鳴"));
  b.appendChild(el("span", "pt-reso-n", String(n)));
  b.setAttribute("aria-label", `魂の共鳴 ${n}組${near ? `・あと1職でそろう組 ${near}` : ""}`);
  b.addEventListener("click", (e) => { e.stopPropagation(); if (picked) return; sfx("select"); openResonance(); });
  return b;
}
// 職の札 (小さな顔 + 職の名)。k = null なら伏せた札「？」
function resoJobChip(k, { dim = false } = {}) {
  const c = el("span", "rs-job" + (k ? "" : " unk") + (dim ? " dim" : ""));
  const cl = k && SOUL_CLASSES[k];
  if (cl) {
    c.style.setProperty("--glow", cl.glow);
    const f = el("span", "rs-job-f");
    try { f.appendChild(crispCanvas(jobBust(k, 1), 18)); } catch (e) { /* 絵が無くても動く */ }
    c.appendChild(f);
    c.appendChild(el("span", "rs-job-n", cl.label));
  } else c.appendChild(el("span", "rs-job-n", "？"));
  return c;
}
// 共鳴の札。found = 見つけた組 (名前・職・効果を出す)、そうでなければ「？？？」と職の数だけ。
// have = 隊にそろっている職 (あと1職の札で、その職だけ明かす) / active = いま効いている / missing = 足りない職 (見つけた組だけ名を出す)
export function resonanceRow(res, { found = false, active = false, have = null, missing = null } = {}) {
  const r = el("div", "rs-row" + (found ? "" : " unk") + (active ? " on" : ""));
  const top = el("div", "rs-top");
  top.appendChild(el("span", "rs-name", found ? res.name : "？？？"));
  top.appendChild(el("span", "rs-tag", `${res.jobs.length}職`));
  if (active) top.appendChild(el("span", "rs-tag on", "共鳴中"));
  r.appendChild(top);
  const jobs = el("div", "rs-jobs");
  for (const k of res.jobs) {
    const show = found || (have && have.includes(k));
    jobs.appendChild(resoJobChip(show ? k : null, { dim: !!(missing && k === missing) }));
  }
  r.appendChild(jobs);
  if (found) r.appendChild(el("div", "rs-fx", resonanceText(res)));
  if (missing) r.appendChild(el("div", "rs-miss", found && SOUL_CLASSES[missing] ? `あと「${SOUL_CLASSES[missing].label}」がそろえば響き合う` : "あと1職がそろえば響き合う"));
  if (found && !missing) r.appendChild(el("div", "rs-tx", res.text));
  return r;
}
export function openResonance() {
  const G = G_();
  if (!G || !resoOpen()) return null;
  const found = (G.resonance && G.resonance.found) || {};
  const list = game.partyResonances ? game.partyResonances() : [];
  const near = game.partyNearResonances ? game.partyNearResonances() : [];
  const town = G.state === "town";
  const body = (b) => {
    b.appendChild(el("p", "rs-note", "隊に出ている人業のメイン魂の職がそろうと、隊全体に効く。サブ魂と控えは数えない。倒れていても隊にいれば効く。"));
    if (list.length) {
      const tot = el("div", "rs-tot");
      tot.appendChild(el("div", "rs-h", "いまの効果 (合計)"));
      for (const t of resonanceTotals(list)) tot.appendChild(el("div", "rs-tot-l", t.text));
      b.appendChild(tot);
    }
    b.appendChild(el("div", "rs-h", `いま響き合っている組 ${list.length}`));
    if (!list.length) b.appendChild(el("div", "rs-none", "まだ響き合う組はない。隊の顔ぶれを変えてみよう。"));
    for (const x of list) b.appendChild(resonanceRow(x, { found: true, active: true }));
    if (near.length) {
      b.appendChild(el("div", "rs-h", `あと1職でそろう組 ${near.length}`));
      for (const n of near) b.appendChild(resonanceRow(n.res, { found: !!found[n.res.id], have: n.have, missing: n.missing }));
    }
    const cnt = Object.keys(found).filter((id) => RESONANCE_MAP[id]).length;
    b.appendChild(el("p", "rs-note", `見つけた組 ${cnt}/${(game.RESONANCES || []).length}。見つけた組は図鑑の「共鳴」に記される。`));
  };
  const footer = [];
  if (town && UI.openPalace) footer.push({ label: "図鑑で見る", kind: "secondary", onTap: (h) => { h.close(); UI.openPalace("codex:reso"); } });
  footer.push({ label: "閉じる", kind: "ghost", onTap: (h) => h.close() });
  return sheet.open({ kind: "info", banner: "魂の共鳴", className: "rs-sheet", accent: "#b99cf0", body, footer });
}
// 初めてそろった組の知らせ: 街で手が空いた時に、まとめて1枚 (物語の知らせ・遠征の報告と同じ待ち方)
let resoTimer = null, resoTries = 0, resoShowing = false;
function resoBusy() {
  if (uiBlocked() || sceneActive() || UI.tutorialActive?.() || UI.tutorialPending?.()) return true;
  if (hasDOM() && document.querySelector(".sc-scene")) return true;
  const G = G_();
  if (G && G.town?.tab === "party" && game.pendingIreneBeat?.()) return true;
  return false;
}
function queueResonanceNotice() {
  if (resoTimer || resoShowing) return;
  resoTries = 0;
  const tick = () => {
    resoTimer = null;
    const G = G_();
    if (!G || G.state !== "town" || !(G.resonance && G.resonance.fresh && G.resonance.fresh.length)) return;
    if (resoBusy()) { if (++resoTries < 60) resoTimer = setTimeout(tick, 1500); return; }
    showResonanceNotice();
  };
  resoTimer = setTimeout(tick, 600);
}
function showResonanceNotice() {
  const list = game.takeFreshResonances ? game.takeFreshResonances() : [];
  if (!list.length) return;
  resoShowing = true;
  sfx("rankup");
  sheet.open({
    kind: "celebrate", sparkle: true, banner: "魂の共鳴", className: "rs-sheet rs-cel", accent: "#b99cf0",
    title: list.length > 1 ? `${list.length}つの共鳴が目覚めた` : `「${list[0].name}」が目覚めた`,
    body: (b) => {
      b.appendChild(el("p", "rs-note", "隊の魂どうしが響き合い、隊全体に力が宿った。"));
      for (const x of list) b.appendChild(resonanceRow(x, { found: true, active: true }));
      b.appendChild(el("p", "rs-note", "見つけた組は図鑑の「共鳴」に記される。隊の「共鳴」の札から、いまの組を見られる。"));
    },
    footer: [{ label: "心得た", kind: "primary", size: "lg", onTap: (h) => h.close() }],
    onClose: () => { resoShowing = false; const G = G_(); if (G && G.state === "town" && game.renderTown) game.renderTown(); },
  });
}
// 控えの結社 (魂一覧の右): 席の数。解放前は出さない (soulpanel.js openOrderSheet)
function orderButton() {
  if (!(game.featureUnlocked && game.featureUnlocked("order"))) return null;
  const seats = game.orderSeats ? game.orderSeats() : 0;
  const seated = game.orderSeatedUids ? game.orderSeatedUids().length : 0;
  const b = el("button", "pt-bench pt-souls pt-order");
  b.type = "button";
  b.appendChild(el("span", "pt-bench-l", "結社"));
  b.appendChild(el("span", "pt-bench-n", `${seated}/${seats}`));
  b.setAttribute("aria-label", `控えの結社 席 ${seated}/${seats}`);
  b.addEventListener("click", () => { if (picked) return; sfx("select"); openOrderSheet(true); });
  return b;
}
// 魂一覧 (控えの右): 持っている魂を並べ、詳細・強化・融合・ロック・宿す操作 (soulpanel.js openSoulList)
function soulListButton() {
  const G = G_();
  const b = el("button", "pt-bench pt-souls");
  b.type = "button";
  b.appendChild(el("span", "pt-bench-l", "魂一覧"));
  b.appendChild(el("span", "pt-bench-n", String((G.souls || []).length)));
  b.setAttribute("aria-label", `魂一覧 ${(G.souls || []).length}個`);
  b.addEventListener("click", () => { if (picked) return; openSoulList(); });
  return b;
}
function stripPortrait(d, i, mode) {
  const wrap = el("div", "pt-slotp");
  const p = portraitEl(d, { size: 44, sel: d === selDoll, cls: picked === d ? "lifted" : (picked ? "target" : "") });
  p.dataset.drop = "p" + i;
  wrap.appendChild(p);
  wrap.appendChild(el("span", "pt-slotp-n", d.name));
  if (mode === "town") attachDrag(p, d, i);
  else p.addEventListener("click", () => { sfx("select"); select(d); rerender(); }); // 人業を切り替えてもタブはそのまま (ユーザーの指示、2026-10)
  return wrap;
}
function emptySlot(i) {
  const wrap = el("div", "pt-slotp");
  const p = portraitEl(null, { size: 44, cls: picked ? "target" : "" });
  p.dataset.drop = "e" + i;
  p.setAttribute("aria-label", "空き ― 控えから加える");
  p.addEventListener("click", () => {
    if (picked) { moveToEnd(picked); return; }
    sfx("select"); openReserve();
  });
  wrap.appendChild(p);
  wrap.appendChild(el("span", "pt-slotp-n dim", "加える"));
  return wrap;
}
function benchButton() {
  const G = G_();
  const b = el("button", "pt-bench" + (picked ? " target" : ""));
  b.type = "button";
  b.dataset.drop = "bench";
  b.appendChild(el("span", "pt-bench-l", "人業"));
  b.appendChild(el("span", "pt-bench-n", String((G.reserve || []).length)));
  b.setAttribute("aria-label", `控えの人業 ${(G.reserve || []).length}体`);
  b.addEventListener("click", () => {
    if (picked) { bench(picked); return; }
    sfx("select"); openReserve();
  });
  return b;
}
// 持ち上げ中の案内 (人業の見出しの場所に出す。高さは同じ)
function pickHint() {
  const h = el("section", "pt-pickhint");
  setText(h.appendChild(el("span", "pt-pickhint-t")), `${picked.name} を移す先をえらぶ ― パーティの誰かと入れ替え・「控え」へ下げる`);
  const x = el("button", "pt-pickhint-x", "やめる");
  x.type = "button";
  x.addEventListener("click", () => { picked = null; rerender(); });
  h.appendChild(x);
  return h;
}

// 長押しで持ち上げ → 指を動かして落とす (入れ替え・控えへ)。動かさず離せば「移す先をタップ」の代替操作。
// ふつうのタップは、その人業を表示する (持ち上げ中なら、そこへ移す)
function attachDrag(node, d, i) {
  let timer = null, sx = 0, sy = 0, lifted = false, moved = false, ghost = null, over = null, swallow = false;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const hit = (x, y) => {
    const t = document.elementFromPoint(x, y);
    const z = t && t.closest ? t.closest("[data-drop]") : null;
    return z && z !== node ? z : null;
  };
  const mark = (z) => {
    if (over === z) return;
    if (over) over.classList.remove("over");
    over = z;
    if (over) over.classList.add("over");
  };
  const place = (x, y) => { if (ghost) ghost.style.transform = `translate(${x - 24}px, ${y - 28}px)`; };
  const lift = (x, y, pid) => {
    lifted = true; moved = false;
    try { node.setPointerCapture(pid); } catch (e) { /* noop */ }
    node.classList.add("lifting");
    document.body.classList.add("pt-dragging");
    buzz(12); sfx("select");
    ghost = el("div", "pt-ghost");
    ghost.appendChild(partyPortraitCanvas(d, 42));
    document.body.appendChild(ghost);
    place(x, y);
  };
  const drop = () => {
    clear();
    node.classList.remove("lifting");
    document.body.classList.remove("pt-dragging");
    if (ghost) { ghost.remove(); ghost = null; }
    const z = over; mark(null);
    if (!lifted) return;
    lifted = false;
    swallow = true;
    if (moved && z) { dropOn(d, z.dataset.drop); return; }
    if (!moved) { picked = d; selDoll = d; rerender(); }
  };
  node.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    sx = e.clientX; sy = e.clientY; swallow = false;
    clear();
    const pid = e.pointerId;
    timer = setTimeout(() => { timer = null; lift(sx, sy, pid); }, 360);
  });
  node.addEventListener("pointermove", (e) => {
    if (!lifted) { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) clear(); return; }
    if (Math.abs(e.clientX - sx) > 6 || Math.abs(e.clientY - sy) > 6) moved = true;
    place(e.clientX, e.clientY);
    mark(hit(e.clientX, e.clientY));
  });
  node.addEventListener("pointerup", drop);
  node.addEventListener("pointercancel", () => { mark(null); moved = false; drop(); });
  node.addEventListener("contextmenu", (e) => e.preventDefault());
  node.addEventListener("click", (e) => {
    if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; }
    if (picked && picked !== d) { swapParty(picked, d); return; }
    if (picked === d) { picked = null; rerender(); return; }
    sfx("select");
    select(d); // 人業を切り替えても、開いているタブ (装備・魂・能力) はそのまま (ユーザーの指示、2026-10)
    rerender();
  });
}
function dropOn(d, target) {
  if (!target) return;
  if (target === "bench") return bench(d);
  const G = G_();
  const j = +target.slice(1);
  if (target[0] === "p" && G.party[j]) return swapParty(d, G.party[j]);
  if (target[0] === "e") return moveToEnd(d);
}
function swapParty(a, b) {
  const G = G_();
  const i = G.party.indexOf(a), j = G.party.indexOf(b);
  picked = null;
  if (i < 0 || j < 0 || i === j) { rerender(); return; }
  G.party[i] = b; G.party[j] = a;
  sfx("select"); buzz(10);
  const rowName = (k) => (k < 3 ? "前衛" : "後衛");
  game.log(`隊列: ${a.name}(${rowName(j)}) ⇄ ${b.name}(${rowName(i)})`, "sys");
  if (game.autosave) game.autosave(true);
  rerender();
}
function moveToEnd(d) {
  const G = G_();
  const i = G.party.indexOf(d);
  picked = null;
  if (i < 0 || i === G.party.length - 1) { rerender(); return; }
  G.party.splice(i, 1); G.party.push(d);
  sfx("select");
  if (game.autosave) game.autosave(true);
  rerender();
}
function bench(d) {
  const G = G_();
  const i = G.party.indexOf(d);
  picked = null;
  if (i < 0) { rerender(); return; }
  G.party.splice(i, 1); G.reserve.push(d);
  sfx("select");
  game.log(`${d.name} を控えに下げた。`, "sys");
  toast(`${d.name} を控えに下げた`, { tone: "info" });
  if (game.autosave) game.autosave(true);
  rerender();
}

// ================= 控え・仕立て (シート。全員を並べ、縦にスクロール) =================
let reserveH = null;
export function openReserve() {
  if (!inTown()) return null;
  if (reserveH && !reserveH.closed) { reserveH.update({}); return reserveH; }
  reserveH = sheet.open({
    kind: "info", banner: "控えの人業", className: "pt-res-sheet",
    body: (scroll) => reserveBody(scroll),
    footer: [createButton()],
    onClose: () => { reserveH = null; },
  });
  return reserveH;
}
function createButton() {
  const G = G_();
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  const full = allDolls().length >= 100;
  const add = button({ label: "人業を仕立てる", sub: "魂をひとつ選び、名を与える", kind: "primary",
    cost: cost ? { kind: "red", n: cost } : "無料", disabled: full || (G.redSoul || 0) < cost, onTap: () => openCreateDoll() });
  add.classList.add("pt-res-add");
  return add;
}
function reserveBody(root) {
  const G = G_();
  const list = el("div", "pt-res");
  const exc = expeditionCount();
  if (exc) list.appendChild(exc);
  if (!G.reserve.length) list.appendChild(el("div", "pt-res-none", "控えはいない。隊列の人業を「控え」へ引けば下げられる。"));
  for (const d of G.reserve) list.appendChild(reserveRow(d));
  root.appendChild(list);
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  root.appendChild(el("div", "pt-note c", `仕立ての費用: 3体目まで無料 ・ 4体目 赤い魂30 ・ 5体目 50 ・ 以降 100${cost ? "" : "（いまは無料）"}。`));
}
function reserveRow(d) {
  const G = G_();
  const r = el("div", "pt-res-row" + (d.alive ? "" : " dead"));
  const top = el("div", "pt-res-top");
  const p = portraitEl(d, { size: 44 });
  p.addEventListener("click", () => viewDoll(d));
  longPress(p, () => openRename(d));
  top.appendChild(p);
  const tx = el("div", "pt-res-tx");
  tx.appendChild(el("div", "pt-res-n", d.name));
  const st = el("div", "pt-res-c");
  st.appendChild(document.createTextNode(d.primary == null ? "空の人業 ― 魂が宿っていない" : `${d.cls} ・ Lv${d.jobLv || 1}`));
  if (!d.alive && inTown()) {
    st.appendChild(document.createTextNode(" ・ "));
    if (waiting(d) && game.reviveTimerEl) st.appendChild(game.reviveTimerEl("span", "pt-res-tm", "✝ 連れ帰り ", d));
    else st.appendChild(el("span", "pt-res-tm", "✝ 要修復"));
  }
  else if (d.primary != null) st.appendChild(el("span", "pt-res-s", `  HP ${d.hp}/${d.maxhp}`));
  game.refreshStability?.();
  st.appendChild(el("span", "pt-res-s", game.vesselStable && game.vesselStable(d) ? " ・ 師の器" : ` ・ 安定度 ${d.stability}/${game.STABILITY_MAX}`));
  tx.appendChild(st);
  top.appendChild(tx);
  const look = button({ label: "見る", kind: "ghost", size: "sm", onTap: () => viewDoll(d) });
  look.classList.add("pt-res-look");
  top.appendChild(look);
  r.appendChild(top);
  // 入れ替え先 (隊の札) を直に並べる: 1タップで入れ替え
  const sw = el("div", "pt-res-sw");
  const away = expeditionStatus(d, () => { if (reserveH) reserveH.close(); });
  if (away) { // 遠征中: 行き先・残りと「呼び戻す」(帰ってきていれば「報告を聞く」)。入れ替えはできない
    r.classList.add("away");
    r.appendChild(away.line);
    for (const b of away.actions) sw.appendChild(b);
  } else if (d.primary == null) {
    sw.appendChild(button({ label: "魂を宿す", kind: "secondary", size: "sm", onTap: () => {
      if (reserveH) reserveH.close();
      select(d); setSeg("soul"); rerender();
      openSoulPicker(d, "primary");
    } }));
  } else {
    sw.appendChild(el("span", "pt-res-swl", "⇄"));
    G.party.forEach((m, j) => {
      const t = portraitEl(m, { size: 44, cls: "pt-swap" });
      t.setAttribute("aria-label", `${m.name} と入れ替える`);
      t.title = `${m.name} と入れ替える`;
      const conflict = !!game.partySoulConflict(G.party.map((x, i) => i === j ? d : x));
      if (conflict) { t.setAttribute("aria-disabled", "true"); t.title = "同じ職業の魂が重複するため選択不可"; t.style.opacity = "0.4"; }
      else t.addEventListener("click", () => swapWithReserve(d, j));
      sw.appendChild(t);
    });
    if (G.party.length < 6) {
      const a = el("button", "pt-res-join");
      a.type = "button";
      a.appendChild(el("span", null, "＋"));
      a.appendChild(el("span", "pt-res-join-l", "加える"));
      a.setAttribute("aria-label", `${d.name} をパーティに加える`);
      a.disabled = !!game.partySoulConflict([...G.party, d]);
      if (a.disabled) a.title = "同じ職業の魂が重複するため選択不可";
      a.addEventListener("click", () => joinParty(d));
      sw.appendChild(a);
    }
    const ex = expeditionButton(d, () => { if (reserveH) reserveH.close(); });
    if (ex) sw.appendChild(ex);
  }
  r.appendChild(sw);
  return r;
}
function viewDoll(d) {
  sfx("select");
  if (reserveH) reserveH.close();
  select(d);
  rerender();
}
function swapWithReserve(d, j) {
  const G = G_();
  const k = G.reserve.indexOf(d);
  const m = G.party[j];
  if (k < 0 || !m) return;
  if (game.expeditionOf && game.expeditionOf(d)) { sfx("ng"); toast(`${d.name}は遠征に出ている。呼び戻すか、帰りを待とう`, { tone: "bad" }); return; }
  if (game.blockSoulResonance(G.party.map((x, i) => i === j ? d : x))) return;
  G.party[j] = d; G.reserve[k] = m;
  sfx("select"); buzz(10);
  game.log(`${d.name} をパーティに入れ、${m.name} を控えに下げた。`, "sys");
  toast(`${d.name} ⇄ ${m.name}`, { tone: "info" });
  if (reserveH) reserveH.close();
  select(d);
  if (game.autosave) game.autosave(true);
  rerender();
}
function joinParty(d) {
  const G = G_();
  if (d.primary == null) { sfx("ng"); toast("魂の宿らない人業はパーティに入れられない", { tone: "bad" }); return; }
  if (G.party.length >= 6) { sfx("ng"); toast("パーティは満員だ (6体まで)", { tone: "bad" }); return; }
  const k = G.reserve.indexOf(d);
  if (k < 0) return;
  if (game.expeditionOf && game.expeditionOf(d)) { sfx("ng"); toast(`${d.name}は遠征に出ている。呼び戻すか、帰りを待とう`, { tone: "bad" }); return; }
  if (game.blockSoulResonance([...G.party, d])) return;
  G.reserve.splice(k, 1); G.party.push(d);
  sfx("select");
  toast(`${d.name} をパーティに加えた`, { tone: "good" });
  if (reserveH) reserveH.close();
  select(d);
  if (game.autosave) game.autosave(true);
  rerender();
}

// 人業を仕立てる: 宿す魂を選ぶ → 名を与える
let createH = null; // 開いている「宿す魂をえらぶ」シート (二重に開かない: 下に古い一覧が残るため)
export function openCreateDoll() {
  const G = G_();
  if (!inTown()) return;
  if (createH && !createH.closed) return createH;
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  if ((G.redSoul || 0) < cost) { sfx("ng"); toast("赤い魂が足りない", { tone: "bad" }); return; }
  if (allDolls().length >= 100) { sfx("ng"); toast("これ以上は仕立てられない (100体まで)", { tone: "bad" }); return; }
  const worn = (uid) => allDolls().some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const free = game.soulRepresentatives().filter((s) => !worn(s.uid)).sort(game.soulSortCmp || (() => 0));
  if (!free.length) { sfx("ng"); toast("宿せる魂がない ― 迷宮で魂を集めよう", { tone: "bad" }); return; }
  sfx("select");
  const h = createH = sheet.open({
    kind: "info", banner: "宿す魂をえらぶ", className: "pt-pick-sheet",
    lines: [cost ? `赤い魂 ${cost} で器を買い、選んだ魂を宿す。` : "無料で器を仕立て、選んだ魂を宿す。"],
    body: (scroll) => {
      const list = el("div", "pt-list");
      for (const s of free) {
        const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
        const ic = el("span", "pt-orb");
        ic.style.setProperty("--glow", cl.glow);
        ic.appendChild(pixelCanvas(jobBust(s.clsKey, Math.max(1, soulRank(s))), 36));
        const r = row({ icon: ic, title: soulLabel(s), sub: `Lv${s.level} ・ ${rarityName(cl.rarity)}${soulRankLeft(s) ? ` ・ ${soulRankLeft(s).slice(1, -1)}` : ""}`, chevron: true,
          onTap: () => { h.close(); openCreateName(s.uid); } });
        r.classList.add("pt-soulrow");
        r.dataset.job = s.clsKey;
        list.appendChild(r);
      }
      scroll.appendChild(list);
    },
  });
  if (h?.el) UI.tutorialEvent?.("newJobSoulPickerOpened");
  return h;
}
function rarityName(r) { return { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド", unique: "固有" }[r] || ""; }
function soulRank(s) { return game.soulRankOf ? game.soulRankOf(s) : 1; }

// 名前の入力シート (仕立て・名を変える・空の人業の生成で共用)
export function nameSheet({ banner = "名を与える", title, desc, value = "", okLabel = "決定", cost = null, random = null, onOk, onCancel }) {
  const body = el("div", "pt-name");
  if (desc) body.appendChild(el("div", "pt-name-d", desc));
  const rowEl = el("div", "pt-name-row");
  const inp = document.createElement("input");
  inp.type = "text"; inp.className = "pt-name-in"; inp.maxLength = 12; inp.value = value;
  inp.setAttribute("aria-label", "名前");
  inp.autocomplete = "off";
  rowEl.appendChild(inp);
  if (random) {
    const rb = el("button", "pt-name-rnd");
    rb.type = "button";
    rb.appendChild(el("span", null, "別の名"));
    rb.addEventListener("click", () => { inp.value = random(); sfx("select"); });
    rowEl.appendChild(rb);
  }
  body.appendChild(rowEl);
  let done = false;
  const ok = (h) => {
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    done = true; h.close("ok", { silent: true });
    onOk(v);
  };
  const h = sheet.open({
    kind: "choice", banner, title, body, className: "pt-name-sheet",
    footer: [
      { label: okLabel, kind: "primary", size: "lg", cost, onTap: ok },
      { label: "やめる", kind: "ghost", onTap: (s) => s.close("cancel") },
    ],
    onClose: () => { if (!done && onCancel) onCancel(); },
  });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(h); });
  return h;
}
export function openCreateName(uid) {
  const s = game.soulByUid ? game.soulByUid(uid) : soulByUid(uid);
  if (!s) return;
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  nameSheet({
    banner: "人業を仕立てる", title: `${soulLabel(s)}を宿す器に、名を`,
    desc: "名はあとから変えられる。",
    value: game.randomDollName ? game.randomDollName() : "", random: game.randomDollName,
    okLabel: "生成する", cost: cost ? { kind: "red", n: cost } : "無料",
    onOk: (name) => {
      const d = game.finalizeBuyDoll(uid, name);
      if (d) { if (reserveH) reserveH.close(); select(d); rerender(); }
    },
  });
}
export function openRename(d) {
  if (!d) return;
  nameSheet({
    banner: "名を変える", title: d.name, value: d.name, okLabel: "変更する", random: game.randomDollName,
    onOk: (name) => {
      d.name = name;
      sfx("select");
      game.log(`人業の名前を「${name}」に変えた。`, "sys");
      if (game.autosave) game.autosave(true);
      rerender();
    },
  });
}

// ================= 人業の見出し (2行) =================
// 安定度の回復は街でだけ。必要数と実際の赤い魂の支出を先に表示する。
export function openStability(d, onChange) {
  if (!inTown() || !d) return null;
  let h;
  const spec = () => {
    game.refreshStability();
    const gap = game.STABILITY_MAX-d.stability;
    const per = game.stabilityPerRed ? game.stabilityPerRed() : 1;
    const amounts = [...new Set([per, Math.min(10,gap), gap])].filter(n=>n>0 && n<=gap);
    const costOf = (n) => Math.ceil(n / per);
    return { title:`${d.name} ― 魂の安定度 ${d.stability}/${game.STABILITY_MAX}`,
      lines:[`${game.stabilityMinutes ? game.stabilityMinutes() : 4}分で1回復します。控えやゲームを閉じている間も回復します。`, `赤い魂1で安定度${per}を回復します。宿泊や魂の付け替えでは回復しません。`, `所持している赤い魂: ${G_().redSoul}`],
      footer:[...amounts.map(n=>({ label:n===gap ? `満タンまで回復 (+${n})` : `+${n}回復`, cost:{kind:"red",n:costOf(n)}, kind:"secondary", disabled:G_().redSoul<costOf(n),
        onTap:()=>{const r=game.restoreStability(d,n);if(!r.ok)return;h.update(spec());rerender();if(onChange)onChange();} })),
        {label:"戻る",kind:"ghost",onTap:()=>h.close()}],
    };
  };
  h=sheet.open({kind:"info",banner:"魂の安定度",...spec()});
  return h;
}

function dollHeader(d, mode) {
  const G = G_();
  const town = mode === "town";
  const head = el("section", "pt-head" + (d.alive ? "" : " dead"));
  const p = portraitEl(d, { size: 44, tag: "div" });
  if (town) longPress(p, () => openRename(d));
  // 面影の写し (第三章の入口で解放): 肖像を押すと、魂が覚えている姿から顔を選べる
  if (town && d.primary != null && d.vessel !== "sera" && game.omokageUnlocked && game.omokageUnlocked()) {
    p.classList.add("pt-face-on");
    p.setAttribute("role", "button");
    p.tabIndex = 0;
    p.setAttribute("aria-label", `${d.name}の面影を写す`);
    p.appendChild(el("span", "pt-face-mark", "面"));
    p.addEventListener("click", () => openOmokage(d));
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openOmokage(d); } });
  }
  head.appendChild(p);
  const tx = el("div", "pt-head-tx");
  const l1 = el("div", "pt-head-l1");
  l1.appendChild(el("span", "pt-head-name", d.name));
  if (town) {
    const ed = el("button", "pt-head-edit");
    ed.type = "button";
    ed.setAttribute("aria-label", "名を変える");
    ed.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg>';
    ed.addEventListener("click", () => openRename(d));
    l1.appendChild(ed);
  }
  const pi = G.party.indexOf(d);
  const cls = el("span", "pt-head-c");
  cls.appendChild(el("span", "pt-head-cls", d.primary == null ? "空の人業" : `${d.cls} Lv${d.jobLv || 1}`));
  const away = pi < 0 && game.expeditionOf && game.expeditionOf(d);
  const tags = [pi >= 0 ? (pi < 3 ? "前衛" : "後衛") : away ? "遠征中" : "控え"];
  if (d.primary != null) tags.push(`射程${(RANGE_LABEL[weaponRange(d.equip && d.equip.weapon)] || "").replace("距離", "")}`);
  cls.appendChild(el("span", "pt-head-tag", tags.join("・")));
  l1.appendChild(cls);
  tx.appendChild(l1);
  // 2行目: HP/MP の細い棒 (砕けていれば救出、控えなら「隊へ」)
  if (!d.alive) tx.appendChild(rescueLine(d));
  else if (d.primary != null) {
    const l2 = el("div", "pt-head-l2");
    for (const [k, v, m, tone] of [["HP", d.hp, d.maxhp, "hp"], ["MP", d.mp, d.maxmp, "mp"]]) {
      const hb = el("div", "pt-hbar");
      hb.appendChild(el("span", "pt-hbar-k", k));
      hb.appendChild(bar(v, m, { tone }));
      hb.appendChild(el("span", "pt-hbar-v", `${v}/${m}`));
      l2.appendChild(hb);
    }
    tx.appendChild(l2);
  }
  game.refreshStability?.();
  const stable = game.vesselStable && game.vesselStable(d);
  const stability = stable
    ? button({ label:"師の器 ・ 安定度を消費しない", kind:"ghost", size:"sm", onTap:()=>toast("師オルドが一度で仕上げた器。魂の安定度を消費しない。メイン魂は灯守に固定", {tone:"info"}) })
    : button({ label:`魂の安定度 ${d.stability}/${game.STABILITY_MAX}`, kind:"ghost", size:"sm",
      onTap:town ? ()=>openStability(d) : ()=>toast(`入場時に10消費・${game.stabilityMinutes ? game.stabilityMinutes() : 4}分で1回復。探索中の追加消費はない`, {tone:"info"}) });
  stability.classList.add("pt-stability"); tx.appendChild(stability);
  head.appendChild(tx);
  if (town && pi < 0 && d.primary != null && !away) {
    const join = button({ label: G.party.length < 6 ? "パーティへ" : "入替", kind: "secondary", size: "sm", onTap: () => (G.party.length < 6 ? joinParty(d) : openReserve()) });
    join.classList.add("pt-head-join");
    head.appendChild(join);
  }
  return head;
}

// ================= 面影の写し (見た目だけ・無料・何度でも) =================
// 写せるのは職業図鑑で到達した職業×ランク (game.omokageRanks)。届いていないランクは影だけ見せ、出会っていない職業は伏せる
function omokageTile(job, rank, { on = false, lock = false, label = null, onTap = null } = {}) {
  const b = el(lock ? "span" : "button", "pt-om-t" + (on ? " on" : "") + (lock ? " lock" : ""));
  const name = jobRankName(job, rank);
  if (lock) b.setAttribute("aria-label", `${SOUL_CLASSES[job].label} ランク${rank} (まだ写せない)`);
  else {
    b.type = "button";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", `${name} (${SOUL_CLASSES[job].label} ランク${rank})`);
    b.addEventListener("click", onTap);
  }
  const fr = el("span", "pt-om-fr");
  try { fr.appendChild(pixelCanvas(jobBust(job, rank), 40)); } catch (e) { /* 絵が無くても動く */ }
  b.appendChild(fr);
  b.appendChild(el("span", "pt-om-r", label || `R${rank}`));
  return b;
}
function omokageBody(d, pick) {
  const wrap = el("div", "pt-om");
  const face = dollFace(d);
  const top = el("div", "pt-om-top");
  const fig = el("div", "pt-om-fig");
  try { fig.appendChild(pixelCanvas(dollSprite(d), 96)); } catch (e) { /* 絵が無くても動く */ }
  top.appendChild(fig);
  const tx = el("div", "pt-om-tx");
  tx.appendChild(el("div", "pt-om-now", face ? `いまの顔: ${jobRankName(face.job, face.rank)}の面影` : "いまの顔: 魂のままの姿"));
  tx.appendChild(el("p", "pt-om-note", "顔が変わるだけで、職業や能力は宿した魂のまま。枠の光と職業名も魂のままです。"));
  tx.appendChild(omokageTile(d.jobKey || "fighter", d.jobRank || 1, { on: !face, label: "魂のまま", onTap: () => pick(null) }));
  top.appendChild(tx);
  wrap.appendChild(top);
  const ranks = game.omokageRanks ? game.omokageRanks() : {};
  for (const k of SOUL_KEYS) {
    const r = ranks[k] || 0;
    if (!r) continue;
    const line = el("div", "pt-om-row");
    const nm = el("div", "pt-om-job", SOUL_CLASSES[k].label);
    nm.style.color = SOUL_CLASSES[k].glow;
    line.appendChild(nm);
    const tiles = el("div", "pt-om-tiles");
    for (let i = 1; i <= 5; i++) {
      tiles.appendChild(i <= r
        ? omokageTile(k, i, { on: !!face && face.job === k && face.rank === i, onTap: () => pick({ job: k, rank: i }) })
        : omokageTile(k, i, { lock: true }));
    }
    line.appendChild(tiles);
    wrap.appendChild(line);
  }
  return wrap;
}
export function openOmokage(d) {
  if (!d || !inTown() || !game.omokageUnlocked || !game.omokageUnlocked()) return null;
  let box = null;
  const redraw = () => { if (!box) return; const nb = omokageBody(d, pick); box.replaceWith(nb); box = nb; };
  function pick(face) {
    if (!game.setDollFace || !game.setDollFace(d, face)) return;
    sfx("select");
    redraw();
    rerender();
  }
  return sheet.open({
    kind: "info", className: "pt-om-sheet", banner: "面影の写し", title: `${d.name}の顔`,
    lines: ["魂が覚えている姿を、人業の顔に写します。魂がランクを上げるたびに、写せる面影が増えます。"],
    body: (scroll) => { box = omokageBody(d, pick); scroll.appendChild(box); },
    footer: [{ label: "閉じる", kind: "primary", onTap: (h) => h.close() }],
  });
}

// 砕けた人業 (見出しの2行目): 連れ帰り待ちなら残り時間 + 赤い魂で早める。街にあれば「砕けた魂を修復」(金貨・HP/MP満タン)
function rescueLine(d) {
  const G = G_();
  const box = el("div", "pt-rescue");
  const t = el("span", "pt-rescue-t");
  t.appendChild(el("span", "pt-rescue-mk", "✝"));
  if (!inTown()) { // 迷宮の中: 修復は街の館でしかできない
    t.appendChild(document.createTextNode("砕けた ・ 街の人業の館で修復"));
    box.appendChild(t);
    return box;
  }
  if (waiting(d)) { // 全滅で迷宮に残された器: 連れ帰りを待つ (赤い魂で早める)。届くまで修復はできない
    t.appendChild(document.createTextNode("連れ帰り "));
    if (game.reviveTimerEl) t.appendChild(game.reviveTimerEl("b", "pt-rescue-tm", "", d));
    box.appendChild(t);
    const n = Math.max(1, Math.ceil((d.reviveAt - Date.now()) / RESCUE_MS()));
    box.appendChild(button({ label: "早める", kind: "secondary", size: "sm", cost: { kind: "red", n: 1 }, disabled: (G.redSoul || 0) < 1,
      onTap: () => { if (game.tryHastenRescue) game.tryHastenRescue(d); rerender(); } }));
    if (n > 1) box.appendChild(button({ label: "今すぐ", kind: "danger", size: "sm", cost: { kind: "red", n }, disabled: (G.redSoul || 0) < 1,
      onTap: () => confirm({ banner: "連れ帰る", title: `赤い魂 ${n} で ${d.name} を今すぐ連れ帰る？`, lines: ["届いた器は、館で金貨を払って修復する。", `所持: 赤い魂 ${G.redSoul || 0}`], okLabel: "連れ帰る", danger: false })
        .then((ok) => { if (!ok) return; for (let k = 0; k < n && waiting(d) && (G.redSoul || 0) >= 1; k++) game.tryHastenRescue(d); rerender(); }) }));
    return box;
  }
  t.appendChild(document.createTextNode("砕けた"));
  box.appendChild(t);
  const actions = el("div", "pt-repair-actions");
  const cost = game.repairCostOf ? game.repairCostOf(d) : 0;
  actions.appendChild(button({ label: "砕けた魂を修復", kind: "primary", size: "sm", cost: { kind: "gold", n: cost }, disabled: (G.gold || 0) < cost,
    onTap: () => confirm({ banner: "魂の修復", title: `${d.name} の砕けた魂を修復する？`,
      lines: [`金貨 💰${cost} ・ HP/MP 満タンで立ち上がる`, `所持: 💰${G.gold || 0}`],
      okLabel: "修復する", danger: false })
      .then((ok) => { if (!ok) return; if (game.repairDoll) game.repairDoll(d); rerender(); }) }));
  const dead = (game.allDolls ? game.allDolls() : []).filter((m) => m.isDoll && !m.alive && !waiting(m));
  if (dead.length > 1) {
    const total = dead.reduce((sum, m) => sum + game.repairCostOf(m), 0);
    actions.appendChild(button({ label: "全員を修復", kind: "primary", size: "sm", cost: { kind: "gold", n: total }, disabled: (G.gold || 0) < total,
      onTap: () => { if (game.repairAllDolls) game.repairAllDolls(); rerender(); } }));
  }
  box.appendChild(actions);
  return box;
}

// ---- 迷宮: 野営 (呪文・道具) をすぐ使える札 ----
function campSpellsOf(d) {
  return (d.spells || []).filter((k) => { const sp = SPELLS[k]; return sp && sp.target !== "self" && (sp.kind === "heal" || sp.kind === "cure" || sp.cure); });
}
function consumablesOf(d) {
  const out = [];
  // 戦闘中にしか使えない品 (投げ物・強化・煙玉) は野営の札に出さない。効果の順に並べる
  (d.items || []).forEach((it, index) => { if (it && it.slot === "use" && useWhere(it) !== "battle") out.push({ it, index }); });
  return out.sort((a, b) => compareUse(a.it, b.it));
}
function campStrip(d) {
  if (!d.alive) return null;
  const spells = campSpellsOf(d);
  const items = consumablesOf(d);
  if (!spells.length && !items.length) return null;
  const box = el("section", "pt-camp");
  box.appendChild(el("span", "pt-camp-l", "野営"));
  const sc = el("div", "pt-camp-in");
  for (const k of spells) {
    const sp = SPELLS[k];
    const cost = spellCost(d, sp);
    const c = el("button", "pt-chip spell" + (d.mp < cost ? " short" : ""));
    c.type = "button";
    c.appendChild(el("span", "pt-chip-n", sp.name));
    c.appendChild(el("span", "pt-chip-c", `MP${cost}`));
    c.addEventListener("click", () => { if (game.campCast) game.campCast(d, k); });
    longPress(c, () => showSkillPopup(k));
    sc.appendChild(c);
  }
  // 同じ品はまとめる
  const seen = new Map();
  for (const x of items) { const key = x.it.id || x.it.name; if (!seen.has(key)) seen.set(key, { ...x, n: 0 }); seen.get(key).n++; }
  for (const x of seen.values()) {
    const c = el("button", "pt-chip item");
    c.type = "button";
    const ic = el("span", "pt-chip-ic"); ic.appendChild(spriteCanvas(x.it, 2)); c.appendChild(ic);
    c.appendChild(el("span", "pt-chip-n", x.it.name));
    if (x.n > 1) c.appendChild(el("span", "pt-chip-c", `×${x.n}`));
    c.setAttribute("aria-label", `${x.it.name} を使う`);
    c.addEventListener("click", () => { const i = d.items.indexOf(x.it); if (i >= 0 && game.useItem) game.useItem(d, i); });
    sc.appendChild(c);
  }
  box.appendChild(sc);
  return box;
}

// ---- 区分 + 最適装備 ----
function segBar(d, mode) {
  const wrap = el("div", "pt-segbar");
  const seg = segmented(SEGS, curSeg(), (k) => { setSeg(k); sfx("select"); rerender(); }, { prefKey: mode === "dungeon" ? null : "party" });
  seg.classList.add("pt-seg");
  wrap.appendChild(seg);
  if (d.primary != null) {
    const b = el("button", "pt-auto");
    b.type = "button";
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 15.5 8.5"/><path d="M14 4l6 6-2 2-6-6z"/><path d="M4 16l4 4"/><path d="M19 15v6M16 18h6"/></svg>';
    b.appendChild(el("span", null, "最適装備"));
    b.setAttribute("aria-label", `${d.name}を最適装備にする`);
    const better = SLOTS.some((k) => slotInfo(d, k).better);
    if (better) { b.classList.add("hot"); b.appendChild(badge(true)); }
    b.addEventListener("click", () => autoEquip(d));
    wrap.appendChild(b);
  }
  return wrap;
}

// ================= 装備の区分: 8部位 (2列×4) + 所持 (8つの札を1列) =================
function equipSeg(root, d) {
  if (d.primary == null) root.appendChild(el("div", "pt-note c", "魂の宿らない器は装備できない。「魂」で魂を宿そう。"));
  const list = el("div", "pt-slots");
  for (const k of SLOTS) list.appendChild(slotCell(d, k));
  root.appendChild(list);
  // 所持品の見出し + 隊の全員を最適装備
  const h = el("div", "pt-bagbar");
  const t = el("span", "pt-bagbar-t");
  t.appendChild(el("span", "pt-bagbar-k", "所持"));
  t.appendChild(el("b", null, `${d.items.length}/${MAX_ITEMS}`));
  const unid = d.items.filter((it) => it && it.unidentified).length;
  if (unid) t.appendChild(el("span", "pt-bagbar-x", `未鑑定${unid}`));
  h.appendChild(t);
  const acts = el("div", "pt-bagbar-acts");
  // 全員を回復: MP の多い術者から、最少の MP で全員を全回復する呪文を唱える。MP が足りなければ 死亡>状態異常>HP の順に回復できるところまで (game.js healAll)
  if (game.healAll) {
    const hurt = game.healAllNeed ? game.healAllNeed() : false;
    const b = el("button", "pt-allauto pt-allheal" + (hurt ? " hot" : ""));
    b.type = "button";
    const tx = el("span");
    tx.appendChild(el("span", "nb", "全員を"));
    tx.appendChild(el("span", "nb", "回復"));
    b.appendChild(tx);
    b.setAttribute("aria-label", "回復魔法でパーティの全員を全回復する");
    b.addEventListener("click", () => game.healAll());
    acts.appendChild(b);
  }
  if (G_().party.length > 1) {
    const n = betterGearCount();
    const b = el("button", "pt-allauto" + (n ? " hot" : ""));
    b.type = "button";
    b.appendChild(el("span", null, "パーティの全員を最適装備"));
    if (n) b.appendChild(badge(n));
    b.setAttribute("aria-label", `パーティの全員を最適装備${n ? ` (${n}体にもっと良い装備)` : ""}`);
    b.addEventListener("click", () => autoEquip("all"));
    acts.appendChild(b);
  }
  if (acts.childElementCount) h.appendChild(acts);
  // 見出しと所持の札は1つの箱に入れる (狭い画面では左右に並べて高さを詰める: ui-party.css)
  const wrap = el("div", "pt-bagwrap");
  wrap.appendChild(h);
  const grid = el("div", "pt-bag");
  for (let i = 0; i < MAX_ITEMS; i++) grid.appendChild(bagCell(d, d.items[i]));
  wrap.appendChild(grid);
  root.appendChild(wrap);
}

// 部位の名。二刀流の人業の盾の欄は「左手」(片手武器も盾も持てる)
function slotLabelOf(d, k) {
  if (k === "shield" && d && (d.dualWield > 0 || (d.equip && d.equip.shield && d.equip.shield.slot === "weapon"))) return "左手";
  return SLOT_LABEL[k];
}
function slotCell(d, k) {
  const it = d.equip[k];
  const info = d.primary != null ? slotInfo(d, k) : { count: 0, better: false };
  const r = el("button", "pt-slot" + (it ? "" : " empty") + (it && it.cursed ? " cursed" : "") + (it && it.locked ? " locked" : "") + (info.better ? " better" : ""));
  r.type = "button";
  r.dataset.slot = k;
  const ic = el("span", "pt-slot-ic");
  if (it) {
    const rk = rarityKey(it);
    if (rk) ic.style.setProperty("--edge", RARITIES[rk].color);
    ic.appendChild(spriteCanvas(it, 2));
  } else if (SLOT_ICONS[k]) {
    ic.classList.add("ghost");
    ic.appendChild(spriteCanvas(SLOT_ICONS[k], 2));
  }
  r.appendChild(ic);
  const tx = el("span", "pt-slot-t");
  const top = el("span", "pt-slot-top");
  top.appendChild(el("span", "pt-slot-k", slotLabelOf(d, k)));
  if (info.better) top.appendChild(el("span", "pt-up", it ? "▲候補" : `▲${info.count}`));
  else if (!it && info.count) top.appendChild(el("span", "pt-slot-cnt", `＋${info.count}`));
  tx.appendChild(top);
  if (it) {
    tx.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-slot-n", it, it.cursed ? " (呪)" : "") : el("span", "pt-slot-n", itemName(it)));
    if (k === "weapon" && !it.unidentified) tx.appendChild(el("span", "pt-slot-power", `攻撃力 ${attackPower(d)}`));
    if (k === "shield" && it.slot === "weapon" && !it.unidentified) tx.appendChild(el("span", "pt-slot-power", d.offPower ? `左手の攻撃力 ${d.offPower}` : "二刀流が無く、左手では振るえない"));
    const s = statLines(it);
    if (s) tx.appendChild(el("span", "pt-slot-s", s));
  } else {
    tx.appendChild(el("span", "pt-slot-n dim", "― 空き ―"));
  }
  r.appendChild(tx);
  r.setAttribute("aria-label", `${slotLabelOf(d, k)}: ${it ? itemName(it) : "空き"}${info.better ? " (もっと良い品がある)" : ""}`);
  r.addEventListener("click", () => { sfx("select"); openCandidates(d, k); });
  if (it) longPress(r, () => openItemDetail(it));
  return r;
}

function bagCell(d, it) {
  if (!it) return el("div", "pt-bcell empty");
  const c = el("button", "pt-bcell");
  c.type = "button";
  const rk = rarityKey(it);
  if (rk) c.style.setProperty("--edge", RARITIES[rk].color);
  c.appendChild(spriteCanvas(it, 2));
  if (it.cursed && !it.unidentified) c.appendChild(el("span", "pt-seal curse", "呪"));
  if (it.isNew) c.appendChild(el("span", "pt-new", "NEW"));
  // この人業に付ければ伸びる品は ▲
  if (!it.unidentified && isEquippable(it) && d.primary != null && !canEquipReason(d, it)) {
    const b = bestSlotFor(d, it);
    if (b && b.gain > 0.05) c.appendChild(el("span", "pt-bup", "▲"));
  }
  c.title = itemName(it);
  c.setAttribute("aria-label", itemName(it));
  c.addEventListener("click", () => { sfx("select"); openItem(it, d, { from: "bag" }); });
  longPress(c, () => openItemDetail(it));
  return c;
}

// ---- 装備候補 (シート): いまの装備 + 全員の袋から付けられる品 (伸びの順) ----
let candH = null;
export function openCandidates(d, k) {
  if (!d || !k) return null;
  memoClear();
  if (candH && !candH.closed) candH.close("replace", { silent: true });
  const town = inTown();
  candH = sheet.open({
    kind: "info", banner: `${slotLabelOf(d, k)} ― ${d.name}`, className: "pt-cand-sheet",
    body: (scroll, h) => candBody(scroll, d, k, h, town),
    onClose: () => { candH = null; },
  });
  return candH;
}
function candBody(root, d, k, h, town) {
  const cur = d.equip[k];
  root.appendChild(cur ? curItemCard(d, k, cur, h) : curEmpty());
  if (cur && cur.locked) {
    // ロック中の部位は付け替えない (候補も並べない)。ロックを外せば候補が出る
    root.appendChild(el("div", "pt-note c", "ロック中 ― この部位は付け替え・最適装備の対象にならない。付け替えるにはロックを外す。"));
    return;
  }
  const cands = slotCandidates(d, k, { includeUnid: true });
  const ok = cands.filter((c) => !c.unid);
  const unid = cands.filter((c) => c.unid);
  if (!ok.length) root.appendChild(el("div", "pt-note c", "付けられる品が、どの袋にもない。"));
  const list = el("div", "pt-list");
  for (const c of ok) list.appendChild(candRow(d, k, c, h));
  root.appendChild(list);
  let mism = 0;
  for (const owner of itemsPool()) for (const it of owner.items) if (it && !it.unidentified && slotKeysFor(it).includes(k) && !canEquip(d, it)) mism++;
  if (unid.length) {
    root.appendChild(el("div", "pt-h sm", `未鑑定 ${unid.length}点 ― 鑑定すれば付けられるかもしれない`));
    const ul = el("div", "pt-list");
    for (const c of unid) {
      const ic = el("span", "pt-cand-ic"); ic.appendChild(spriteCanvas(c.it, 2));
      ul.appendChild(row({ icon: ic, title: itemName(c.it), sub: `${c.owner === d ? "自分" : c.owner.name}の袋 ・ ${town ? "商会で鑑定" : "鑑定の心得で試せる"}`, chevron: true, tone: "dim",
        onTap: () => { h.close(); openItem(c.it, c.owner, { from: "bag" }); } }));
    }
    root.appendChild(ul);
  }
  if (mism) root.appendChild(el("div", "pt-note", `${d.cls}には扱えない品が ${mism}点ある。`));
}
// いまの装備 (図鑑と同じく 絵・分類・性能・特殊効果・説明 を並べる)。絵をタップ = 品の画面 (渡す・売る…)
function curItemCard(d, k, cur, h) {
  const rk = rarityKey(cur);
  const accent = rk ? RARITIES[rk].color : null;
  const box = el("div", "pt-cur rich");
  const top = el("div", "pt-cur-top");
  const art = el("button", "pt-cur-art");
  art.type = "button";
  if (accent) art.style.setProperty("--edge", accent);
  art.setAttribute("aria-label", `${itemName(cur)} をくわしく`);
  art.appendChild(spriteCanvas(cur, 6));
  art.addEventListener("click", () => openItem(cur, d, { from: "equip", key: k }));
  longPress(art, () => openItemDetail(cur));
  top.appendChild(art);
  const tx = el("div", "pt-cur-t");
  tx.appendChild(el("span", "pt-cur-k", "装備中"));
  tx.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-cur-n", cur, cur.cursed ? " (呪)" : "") : el("span", "pt-cur-n", itemName(cur)));
  if (!cur.unidentified) {
    tx.appendChild(el("span", "pt-cur-c", itemCatText(cur) + (cur.slot === "weapon" ? ` ・ 射程${(RANGE_LABEL[weaponRange(cur)] || "").replace("距離", "")}` : "")));
    const s = statLines(cur);
    if (s) tx.appendChild(el("span", "pt-cur-s", s));
  }
  top.appendChild(tx);
  box.appendChild(top);
  const performance = weaponPerformanceEl(cur, d);
  if (performance) box.appendChild(performance);
  const fx = specialLines(cur);
  if (fx.length) {
    const fb = el("div", "pt-cur-fx");
    fb.appendChild(el("div", "pt-cur-fxh", "特殊効果"));
    for (const ln of fx) fb.appendChild(el("div", "pt-cur-fxl", ln));
    box.appendChild(fb);
  }
  if (cur.desc && !cur.unidentified) box.appendChild(el("div", "pt-cur-desc", cur.desc));
  const foot = el("div", "pt-cur-foot");
  if (!cur.cursed && !cur.unidentified && game.toggleItemLock) {
    const lk = button({ icon: cur.locked ? "lock" : "unlock", label: cur.locked ? "ロック中" : "ロック", kind: cur.locked ? "secondary" : "ghost", size: "sm",
      title: cur.locked ? "ロックを外す" : "売却・付け替え・最適装備の対象にしない",
      onTap: () => { game.toggleItemLock(cur); memoClear(); if (h && !h.closed && h.update) h.update({}); } });
    lk.classList.add("pt-lock", "sp-lock-btn");
    if (cur.locked) lk.classList.add("on");
    foot.appendChild(lk);
  }
  foot.appendChild(button({ label: cur.cursed ? "呪いで外せない" : cur.locked ? "ロック中は外せない" : "外す", kind: "ghost", size: "sm", disabled: !!cur.cursed || !!cur.locked || d.items.length >= MAX_ITEMS,
    onTap: () => { h.close(); if (game.doUnequip) game.doUnequip(d, k); } }));
  box.appendChild(foot);
  return box;
}
function curEmpty() {
  const box = el("div", "pt-cur empty");
  box.appendChild(el("span", "pt-cur-ic"));
  const tx = el("div", "pt-cur-t");
  tx.appendChild(el("span", "pt-cur-k", "装備中"));
  tx.appendChild(el("span", "pt-cur-n dim", "なし"));
  box.appendChild(tx);
  return box;
}
// 候補の行: 札 (絵) をタップ = 品の画面 (誰に装備させるか) / 行をタップ = この人業にすぐ装備
function candRow(d, k, c, h) {
  const wrap = el("div", "pt-cand" + (c.room ? "" : " full") + (c.gain > 0.05 ? " up" : c.gain < -0.05 ? " down" : ""));
  const ic = el("button", "pt-cand-ic");
  ic.type = "button";
  const rk = rarityKey(c.it);
  if (rk) ic.style.setProperty("--edge", RARITIES[rk].color);
  ic.appendChild(spriteCanvas(c.it, 2));
  ic.setAttribute("aria-label", `${itemName(c.it)} ― 誰に装備させるか`);
  ic.addEventListener("click", () => { h.close("replace", { silent: true }); openItem(c.it, c.owner, { from: "bag" }); });
  longPress(ic, () => openItemDetail(c.it));
  wrap.appendChild(ic);
  const main = el("button", "pt-cand-main");
  main.type = "button";
  const tx = el("span", "pt-cand-t");
  const top = el("span", "pt-cand-top");
  top.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-cand-n", c.it, c.it.cursed ? " (呪)" : "") : el("span", "pt-cand-n", itemName(c.it)));
  top.appendChild(el("span", "pt-own" + (c.owner === d ? " me" : isReserve(c.owner) ? " res" : ""), c.owner === d ? "自分" : `${c.owner.name}${isReserve(c.owner) ? "・控え" : ""}`));
  tx.appendChild(top);
  if (c.it.slot === "weapon" && k === "shield") {
    // 左手 (二刀流): 左手の攻撃力の変化
    const sd = slotDelta(d, c.it, "shield");
    const after = sd ? previewStats(d, sd.tr.equip, recalc).offPower : 0, before = d.offPower || 0;
    if (sd) tx.appendChild(el("span", "pt-cand-power", `左手の攻撃力 ${before} → ${after}（${after - before > 0 ? "+" : ""}${after - before}）`));
  } else if (c.it.slot === "weapon") {
    const result = weaponPowerPreview(c.it, d);
    if (result) tx.appendChild(el("span", "pt-cand-power", `攻撃力 ${result.before} → ${result.power}（${result.delta > 0 ? "+" : ""}${result.delta}）`));
  }
  tx.appendChild(statDelta(c.it.slot === "weapon" ? { ...c.delta, power: 0 } : c.delta));
  // 能力の伸びには出ない特殊効果 (吸血・連撃・属性・状態異常…) は短い札で添える
  const fxs = specialShort(c.it);
  if (fxs) tx.appendChild(el("span", "pt-cand-fx", fxs));
  if (!c.room) tx.appendChild(el("span", "pt-cand-w", "持ち物がいっぱい ― 札から「取り替え」で付けられる"));
  else if (c.it.cursed) tx.appendChild(el("span", "pt-cand-w", "呪われている ― 一度付けると外せない"));
  main.appendChild(tx);
  main.appendChild(el("span", "pt-cand-g " + (c.gain > 0.05 ? "up" : c.gain < -0.05 ? "dn" : "eq"), c.gain > 0.05 ? "▲" : c.gain < -0.05 ? "▼" : "＝"));
  main.setAttribute("aria-label", `${d.name}に ${itemName(c.it)} を装備`);
  main.addEventListener("click", () => {
    const go = () => { const r = pickWearer(d, c.it, { onDone: () => h.close(), key: k }); if (r && r.full) h.close("replace", { silent: true }); };
    if (c.it.cursed) confirm({ title: `${c.it.name} は呪われている`, lines: ["一度装備すると外せない。それでも付ける？"], okLabel: "付ける" }).then((y) => { if (y) go(); });
    else go();
  });
  longPress(main, () => openItemDetail(c.it));
  wrap.appendChild(main);
  return wrap;
}

// ================= 能力の区分: 6能力 (3×2) + 説明/状態 + 技・加護の札 =================
function statsSeg(root, d) {
  const grid = el("div", "pt-stats");
  const info = el("div", "pt-info");
  const fillInfo = () => {
    info.textContent = "";
    if (statOpen) {
      const k = statOpen;
      info.classList.add("x");
      info.appendChild(el("div", "pt-statx-h", `${ATTR_LABEL[k]} ― ${ATTR_NAME[k]}`));
      info.appendChild(el("div", "pt-statx-d", ATTR_DESC[k] || ""));
      const base = Math.round((d.base && d.base[k]) || 0), tot = Math.round(d[k] || 0);
      info.appendChild(el("div", "pt-statx-v", `いま ${tot}（魂 ${base}${tot - base ? ` ・ 装備 ${tot - base > 0 ? "+" : ""}${tot - base}` : ""}）`));
      // 攻撃力の内訳は、武器が参照する能力の詳細と素手のSTRに示す
      if (d.wScale ? d.wScale[k] : k === "atk") {
        const pw = attackPower(d);
        info.appendChild(el("div", "pt-statx-v", `攻撃力 ${pw} = ${d.wScale ? Object.entries(d.wScale).map(([stat, rate]) => `${ATTR_LABEL[stat]} ${d[stat]}×${rate}`).join(" ＋ ") : `STR ${d.atk}（素手）`}`));
      }
      return;
    }
    info.classList.remove("x");
    const ail = !d.alive ? "砕けた" : d.ailment === "poison" ? "毒" : d.ailment === "paralyze" ? "麻痺" : d.ailment === "stone" ? "石化"
      : d.asleep ? "眠り" : d.mind === "charm" ? "魅了" : d.mind === "confuse" ? "混乱" : "正常";
    const fact = (k, v, cls) => { const f = el("div", "pt-fact" + (cls ? " " + cls : "")); f.appendChild(el("span", "pt-fact-k", k)); f.appendChild(el("span", "pt-fact-v", v)); info.appendChild(f); };
    fact("HP", `${d.alive ? d.hp : 0}/${d.maxhp}`);
    fact("MP", `${d.mp}/${d.maxmp}`);
    fact("攻撃力", String(attackPower(d)));
    if (d.dualWield > 0) fact("左手", d.offPower ? `攻撃力 ${d.offPower}（${Math.round(d.dualWield * 100)}%）` : `空き（二刀流 ${Math.round(d.dualWield * 100)}%）`);
    fact("参照", d.wScale ? Object.keys(d.wScale).map(k => ATTR_LABEL[k]).join("＋") : "STR（素手）");
    fact("状態", ail, ail === "正常" ? "" : "bad");
    fact("会心", `+${Math.round((d.critBonus || 0) * 100)}%`);
    fact("属性攻", elemStatShort(d.elemAtk));
    fact("属性防", elemStatShort(d.elemDef));
    // 装備の状態異常耐性 / 武器の追加効果 (持っている時だけ)
    const AIL_SHORT = { poison: "毒", paralyze: "痺", sleep: "眠", charm: "魅", confuse: "乱", stone: "石" };
    for (const [k, label] of Object.entries(RESIST_LABEL)) fact(`${label}抵抗値`, String((d.resists && d.resists[k]) || 0));
    if (d.breathRes) fact("ブレス耐性", `${Math.round(d.breathRes * 100)}%`);
    if (d.onHit) fact("追加効果", d.onHit.map((o) => `${AIL_SHORT[o.k] || o.k}${Math.round(o.chance * 100)}%`).join(" "));
  };
  for (const k of ATTR_KEYS) {
    const c = el("button", "pt-stat" + (statOpen === k ? " on" : ""));
    c.type = "button";
    c.appendChild(el("span", "pt-stat-k", ATTR_LABEL[k]));
    c.appendChild(el("span", "pt-stat-v", String(Math.round(d[k] || 0))));
    c.appendChild(el("span", "pt-stat-n", ATTR_NAME[k].replace(/\s*\(.*\)$/, "")));
    c.setAttribute("aria-expanded", statOpen === k ? "true" : "false");
    c.addEventListener("click", () => {
      statOpen = statOpen === k ? null : k;
      for (const x of grid.children) { const on = x === c && statOpen === k; x.classList.toggle("on", on); x.setAttribute("aria-expanded", on ? "true" : "false"); }
      fillInfo();
      sfx("select");
    });
    grid.appendChild(c);
  }
  root.appendChild(grid);
  fillInfo();
  root.appendChild(info);
  // 作戦 (オート戦闘での振る舞い)。タップで選び直す
  {
    const tac = tacticOf(d);
    const line = el("div", "pt-chiprow");
    line.appendChild(el("span", "pt-chiprow-l", "作戦"));
    const b = el("button", "pt-tactic");
    b.type = "button";
    b.appendChild(el("span", "pt-tactic-n", tac.name));
    b.appendChild(el("span", "pt-tactic-d", tac.desc));
    b.setAttribute("aria-label", `${d.name}のオートの作戦 ${tac.name}（変える）`);
    b.addEventListener("click", () => { sfx("select"); openTacticSheet(d); });
    line.appendChild(b);
    root.appendChild(line);
  }
  // 技・加護 (どちらもタップ = くわしく) の札は横に流れる1列。技は並べた順で、戦闘で出さない技は沈めて見せる
  if (d.spells && d.spells.length) {
    const line = el("div", "pt-chiprow");
    line.appendChild(el("span", "pt-chiprow-l", "技"));
    const sc = el("div", "pt-chiprow-in");
    for (const key of orderedSkills(d)) {
      const sp = SPELLS[key];
      const off = isSkillOff(d, key);
      const c = el("button", "pt-skill" + (off ? " off" : ""));
      c.type = "button";
      c.appendChild(el("span", "pt-skill-n", sp ? sp.name : key));
      if (off) c.appendChild(el("span", "pt-skill-off", "非表示"));
      else if (isAutoOff(d, key) && sp && sp.kind !== "field") c.appendChild(el("span", "pt-skill-off", "手動のみ"));
      const tg = sp && tagRow(spellTagKinds(sp, d), "pt-skill-tags");
      if (tg) c.appendChild(tg);
      if (sp) c.appendChild(el("span", "pt-skill-c", spellMpLabel(sp)));
      c.addEventListener("click", () => showSkillPopup(key));
      sc.appendChild(c);
    }
    line.appendChild(sc);
    const org = el("button", "pt-chiprow-b");
    org.type = "button";
    org.textContent = "整理";
    org.setAttribute("aria-label", `${d.name}の技の並べ替え・表示・オート`);
    org.addEventListener("click", () => { sfx("select"); openSkillManager(d); });
    line.appendChild(org);
    root.appendChild(line);
  }
  if (d.passives && d.passives.length) {
    const line = el("div", "pt-chiprow");
    line.appendChild(el("span", "pt-chiprow-l", "加護"));
    const sc = el("div", "pt-chiprow-in");
    for (const p of d.passives) {
      const c = el("button", "pt-skill pas");
      c.type = "button";
      c.appendChild(el("span", null, p));
      c.addEventListener("click", () => { if (!showPassivePopup(p)) toast(`加護「${p}」― 常に働く力`, { tone: "info" }); });
      sc.appendChild(c);
    }
    line.appendChild(sc);
    root.appendChild(line);
  }
}

// ---- 技の整理: 戦闘での表示のオン/オフ・オートで使うか・並べ替え ----
// オフの技は戦闘のスキル一覧 (と「最後に使った技」) に出ない。並びは戦闘の一覧とこの画面の札に効く。
// 「オート」を切った技はオート戦闘では使わない (手動では使える)。出さない技・迷宮で唱える技はオートも使わない
function openSkillManager(d) {
  if (!d || !(d.spells && d.spells.length)) return null;
  const save = () => { if (game.autosave) game.autosave(true); };
  let box = null;
  const build = () => {
    const list = orderedSkills(d);
    const wrap = el("div", "pt-skm");
    const shown = list.filter((k) => !isSkillOff(d, k)).length;
    const autoN = list.filter((k) => !isSkillOff(d, k) && !isAutoOff(d, k) && !(SPELLS[k] && SPELLS[k].kind === "field")).length;
    wrap.appendChild(el("div", "pt-skm-sum", `戦闘で出す技 ${shown} / ${list.length}　オートで使う技 ${autoN}`));
    list.forEach((key, i) => {
      const sp = SPELLS[key];
      const off = isSkillOff(d, key);
      const r = el("div", "pt-skm-row" + (off ? " off" : ""));
      const tg = el("button", "pt-skm-tg" + (off ? "" : " on"), off ? "非表示" : "表示");
      tg.type = "button";
      tg.setAttribute("aria-pressed", off ? "false" : "true");
      tg.setAttribute("aria-label", `${sp ? sp.name : key}を戦闘で${off ? "表示する" : "出さない"}`);
      tg.addEventListener("click", () => { setSkillOff(d, key, !off); sfx("select"); save(); redraw(); });
      r.appendChild(tg);
      // オートで使うか (出さない技・迷宮で唱える技はオートも使わないので押せない)
      const field = !!(sp && sp.kind === "field");
      const aOff = isAutoOff(d, key);
      const at = el("button", "pt-skm-tg pt-skm-auto" + (off || field ? " na" : aOff ? "" : " on"), off || field ? "―" : aOff ? "手動" : "オート");
      at.type = "button";
      at.disabled = off || field;
      at.setAttribute("aria-pressed", !off && !field && !aOff ? "true" : "false");
      at.setAttribute("aria-label", field ? `${sp.name}は迷宮で唱える技` : `${sp ? sp.name : key}をオートで${aOff ? "使う" : "使わない"}`);
      at.addEventListener("click", () => { if (off || field) return; setAutoOff(d, key, !aOff); sfx("select"); save(); redraw(); });
      r.appendChild(at);
      const nm = el("button", "pt-skm-n");
      nm.type = "button";
      nm.appendChild(el("span", "pt-skm-nm", sp ? sp.name : key));
      const tgs = sp && tagRow(spellTagKinds(sp, d), "pt-skill-tags");
      if (tgs) nm.appendChild(tgs);
      if (sp) {
        // 「MP 16」と「＋魂のMP×6%」を2行に分け、技名を削らない
        const [base, tier] = spellMpLabel(sp).split("＋");
        const mc = el("span", "pt-skill-c two", base);
        if (tier) mc.appendChild(el("span", "pt-skill-ct", `＋${tier}`));
        nm.appendChild(mc);
      }
      nm.addEventListener("click", () => showSkillPopup(key));
      r.appendChild(nm);
      const mv = (dir, label, glyph, dis) => {
        const b = el("button", "pt-skm-mv", glyph);
        b.type = "button";
        b.disabled = dis;
        b.setAttribute("aria-label", `${sp ? sp.name : key}を${label}`);
        b.addEventListener("click", () => { if (moveSkill(d, key, dir)) { sfx("select"); save(); redraw(); } });
        return b;
      };
      r.appendChild(mv(-1, "前へ", "▲", i === 0));
      r.appendChild(mv(1, "後ろへ", "▼", i === list.length - 1));
      wrap.appendChild(r);
    });
    return wrap;
  };
  // 描き直しは箱ごと差し替える (シートのページ割りが差し替えを拾って割り直し、いまのページを保つ)
  const redraw = () => { if (!box) return; const nb = build(); box.replaceWith(nb); box = nb; };
  return sheet.open({
    kind: "info", className: "pt-skm-sheet", banner: "技の整理", title: `${d.name}の技`,
    lines: ["「表示」を切った技は戦闘のスキル一覧に出ない。「オート」を「手動」にした技はオート戦闘で使わない。▲▼ で戦闘での並び順を変える。"],
    body: (scroll) => { box = build(); scroll.appendChild(box); },
    footer: [
      { label: "初期に戻す", kind: "ghost", onTap: () => { resetSkillPrefs(d); sfx("select"); save(); redraw(); } },
      { label: "閉じる", kind: "primary", onTap: (h) => h.close() },
    ],
    onClose: () => rerender(),
  });
}

// ---- 作戦: オート戦闘での振る舞い (autotactics.js) を人業ごとに選ぶ ----
function tacticList(d, onPick) {
  const wrap = el("div", "pt-tac");
  const cur = tacticOf(d).key;
  for (const t of TACTICS) {
    const b = el("button", "pt-tac-b" + (t.key === cur ? " on" : ""));
    b.type = "button";
    b.setAttribute("aria-pressed", t.key === cur ? "true" : "false");
    b.appendChild(el("span", "pt-tac-n", t.name));
    b.appendChild(el("span", "pt-tac-d", t.desc));
    b.addEventListener("click", () => onPick(t.key));
    wrap.appendChild(b);
  }
  return wrap;
}
export function openTacticSheet(d, { onDone = null } = {}) {
  if (!d) return null;
  const save = () => { if (game.autosave) game.autosave(true); };
  let box = null, picked = false;
  const redraw = () => { if (!box) return; const nb = tacticList(d, pick); box.replaceWith(nb); box = nb; };
  function pick(key) {
    setTactic(d, key); picked = true; sfx("select"); save(); redraw();
  }
  return sheet.open({
    kind: "info", className: "pt-tac-sheet", banner: "作戦", title: `${d.name}への命令`,
    lines: ["オート戦闘でどう動くか。オートで使う技は「技の整理」で選べる。"],
    body: (scroll) => { box = tacticList(d, pick); scroll.appendChild(box); },
    footer: [
      ...(d.spells && d.spells.length ? [{ label: "技の整理", kind: "ghost", onTap: () => openSkillManager(d) }] : []),
      { label: "閉じる", kind: "primary", onTap: (h) => h.close() },
    ],
    onClose: () => { if (onDone) onDone(picked); else rerender(); },
  });
}
// 隊の全員の作戦を一度に見る (戦闘の「オート」の長押しから)。人業をタップ = その人業の作戦を選ぶ
export function openPartyTactics(list, { onDone = null } = {}) {
  const dolls = (list || []).filter(Boolean);
  if (!dolls.length) return null;
  let box = null;
  const build = () => {
    const wrap = el("div", "pt-tac");
    for (const d of dolls) {
      const t = tacticOf(d);
      const b = el("button", "pt-tac-b pt-tac-who");
      b.type = "button";
      const top = el("span", "pt-tac-top");
      top.appendChild(el("span", "pt-tac-dn", d.name));
      top.appendChild(el("span", "pt-tac-n", t.name));
      b.appendChild(top);
      b.appendChild(el("span", "pt-tac-d", t.desc));
      b.addEventListener("click", () => { sfx("select"); openTacticSheet(d, { onDone: () => redraw() }); });
      wrap.appendChild(b);
    }
    return wrap;
  };
  const redraw = () => { if (!box) return; const nb = build(); box.replaceWith(nb); box = nb; };
  return sheet.open({
    kind: "info", className: "pt-tac-sheet", banner: "作戦", title: "隊への命令",
    lines: ["オート戦闘での振る舞いを人業ごとに決める。人業をタップで選び直す。"],
    body: (scroll) => { box = build(); scroll.appendChild(box); },
    footer: [{ label: "閉じる", kind: "primary", onTap: (h) => h.close() }],
    onClose: () => { if (onDone) onDone(); },
  });
}

// 長押し = 図鑑と同じ品の詳細 (絵・分類・性能・説明だけの読み物。操作は出さない)
export function openItemDetail(item) {
  if (!item) return null;
  if (UI.codexItemSheet) return UI.codexItemSheet(item.id, { item });
  return openItem(item);
}

// ================= 品の画面 =================
// 袋の装備品 (鑑定済み) = 「誰に装備させるか」が主役の品の画面 (equipChooser)。
// それ以外 (未鑑定・道具・収集品・装備中) は品のシート: WP-C の UI.itemSheet があればそれ、無ければ自前。
// actions = シートの足の操作 [{label, sub, kind, cost, disabled, onTap(h)}] (kit の footer と同じ形)
export function openItem(item, owner = null, sel = {}) {
  if (!item) return null;
  if (item.isNew) { delete item.isNew; bgcMemo.key = ""; }
  const ctx = sel.from || (owner ? "bag" : "info");
  const realSheet = UI.itemSheet && phase0ItemSheet && UI.itemSheet !== phase0ItemSheet;
  if (owner && ctx === "bag" && isEquippable(item) && !item.unidentified) {
    const actions = itemActions(item, owner, ctx, { equip: false });
    if (realSheet) return UI.itemSheet(item, { owner, context: ctx, actions, chooser: true });
    return openEquipChooser(item, { owner, actions });
  }
  const actions = owner ? itemActions(item, owner, ctx) : [];
  if (realSheet) return UI.itemSheet(item, { owner, context: ctx, actions });
  return fallbackItemSheet(item, owner, ctx, actions);
}

function itemActions(it, owner, ctx, { equip = true } = {}) {
  const G = G_();
  const town = inTown();
  const acts = [];
  const close = (h) => { if (h && h.close) h.close(); };
  if (ctx === "equip") {
    const key = SLOTS.find((k) => owner.equip[k] === it);
    if (!it.cursed && !it.unidentified && game.toggleItemLock) acts.push({ label: it.locked ? "ロックを外す" : "ロック", kind: "ghost", onTap: (h) => { close(h); game.toggleItemLock(it); } });
    acts.push({ label: it.cursed ? "呪いで外せない" : it.locked ? "ロック中は外せない" : "外す", kind: "secondary", disabled: !!it.cursed || !!it.locked || owner.items.length >= MAX_ITEMS,
      onTap: (h) => { close(h); if (key && game.doUnequip) game.doUnequip(owner, key); } });
    return acts;
  }
  if (ctx !== "bag") return acts;
  if (it.unidentified) {
    if (town) {
      acts.push({ label: "商会で鑑定する", sub: game.appraiseCost ? `鑑定料 ${game.appraiseCost(it)}` : "", kind: "primary",
        onTap: (h) => { close(h); if (UI.openShop) UI.openShop("sell"); } });
    } else {
      // 鑑定は街でのみ (迷宮では心得のある者でも鑑定できない)
      acts.push({ label: "鑑定は街でのみ", sub: "持ち帰って鑑定する", kind: "ghost", disabled: true });
    }
  } else if (it.slot === "use") {
    acts.push({ label: `${owner.name}が使う`, kind: "primary", onTap: (h) => { close(h); const i = owner.items.indexOf(it); if (i >= 0 && game.useItem) game.useItem(owner, i); } });
  } else if (isEquippable(it) && equip) {
    acts.push({ label: "誰に装備させるか選ぶ", kind: "primary", onTap: (h) => { close(h); openEquipChooser(it, { owner }); } });
  } else if (it.slot === "misc") {
    acts.push({ label: town ? "商会で売るか、王宮の宝物庫へ奉納する" : "街へ持ち帰ろう (商会・宝物庫)", kind: "ghost", disabled: true });
  }
  if (transferTargets(owner).length) acts.push({ label: "渡す", kind: "secondary", onTap: (h) => { close(h); openTransfer(owner, it); } });
  if (isEquippable(it) && !it.unidentified && !it.cursed && game.toggleItemLock) acts.push({ label: it.locked ? "ロックを外す" : "ロック", kind: "ghost", onTap: (h) => { close(h); game.toggleItemLock(it); } });
  // 売る (商会が開いている街。鑑定済みの品。値段・警告・確認は商会と同じ UI.sellOne)
  if (town && !it.unidentified && !it.locked && UI.sellOne && UI.shopOpen && UI.shopOpen() && owner.items.includes(it) && game.sellPrice) {
    const warn = game.sellWarnings && game.sellWarnings(it).length;
    acts.push({ key: "sell", label: "売る", kind: warn ? "danger" : "secondary", cost: game.sellPrice(it),
      onTap: async (h) => { if (await UI.sellOne(owner, it)) close(h); } });
  }
  // 捨てるのは迷宮の中だけ (持ちきれない時の手段。街では売る・奉納で足りる)
  if (!town && !it.locked) acts.push({ label: "捨てる", kind: "danger", onTap: (h) => { close(h); const i = owner.items.indexOf(it); if (i >= 0 && game.dropItem) game.dropItem(owner, i); } });
  return acts;
}

// 品の要約 (絵・名・分類・能力)
function itemSummary(it, accent, { compact = false } = {}) {
  const top = el("div", "pt-item-top" + (compact ? " compact" : ""));
  const art = el("span", "pt-item-art");
  if (accent) art.style.setProperty("--edge", accent);
  art.appendChild(spriteCanvas(it, compact ? 4 : 7));
  top.appendChild(art);
  const tx = el("div", "pt-item-tx");
  tx.appendChild(game.itemNameEl ? game.itemNameEl("div", "pt-item-n", it, it.cursed && !it.unidentified ? " (呪)" : "") : el("div", "pt-item-n", itemName(it)));
  if (!it.unidentified) {
    tx.appendChild(el("div", "pt-item-c", itemCatText(it) + (it.slot === "weapon" ? ` ・ 射程${(RANGE_LABEL[weaponRange(it)] || "").replace("距離", "")}` : "")));
    const s = statLines(it);
    if (s) tx.appendChild(el("div", "pt-item-s", s));
  } else tx.appendChild(el("div", "pt-item-c", "未鑑定 ― 正体はまだわからない"));
  top.appendChild(tx);
  return top;
}
function fallbackItemSheet(it, owner, ctx, actions) {
  const rk = rarityKey(it);
  const accent = rk ? RARITIES[rk].color : null;
  const body = el("div", "pt-item");
  body.appendChild(itemSummary(it, accent));
  const performance = weaponPerformanceEl(it, owner);
  if (performance) body.appendChild(performance);
  const lines = el("div", "pt-item-lines");
  const cat = itemCatText(it);
  for (const ln of detailLines(it)) if (!(ln === cat && !it.unidentified)) lines.appendChild(el("div", "pt-item-l", ln));
  body.appendChild(lines);
  if (it.desc && !it.unidentified) body.appendChild(el("div", "pt-item-desc", it.desc));
  const footer = actions.length ? actions.map((a) => ({ ...a })) : [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }];
  return sheet.open({ kind: "info", banner: game.itemGradeText ? game.itemGradeText(it, "品") : "品", accent, body, footer, className: "pt-item-sheet" });
}

// 渡す相手 (街: 隊と控えの全員 / 迷宮: 生きている隊の者)
function transferTargets(owner) {
  const G = G_();
  return (inTown() ? allDolls() : G.party.filter((m) => m.alive)).filter((m) => m !== owner);
}
export function openTransfer(owner, it) {
  const targets = transferTargets(owner);
  if (!targets.length) return;
  sheet.open({
    kind: "info", banner: "渡す", title: `${itemName(it)} を誰に？`, className: "pt-pick-sheet",
    body: (scroll, h) => {
      const l = el("div", "pt-list");
      for (const m of targets) {
        const full = m.items.length >= MAX_ITEMS;
        const ic = el("span", "pt-mini"); ic.appendChild(partyPortraitCanvas(m, 36));
        const r = row({ icon: ic, title: `${m.name}${isReserve(m) ? "（控え）" : ""}`, sub: `持ち物 ${m.items.length}/${MAX_ITEMS}${full ? " ― 満杯" : ""}`, chevron: !full,
          onTap: full ? null : () => { h.close(); if (game.moveItem) game.moveItem(owner, it, m); } });
        if (full) r.classList.add("dim");
        l.appendChild(r);
      }
      scroll.appendChild(l);
    },
  });
}

// 隊の誰かを選ぶシート (野営の呪文の対象など)。targets = 人業の配列
export function pickTarget({ banner = "対象", accent = null, title = "誰に？", lines = [], targets = [], onPick }) {
  const ailLabel = { poison: "毒", paralyze: "麻痺", stone: "石化" };
  return sheet.open({
    kind: "choice", banner, accent, title, lines, className: "pt-pick-sheet",
    body: (scroll, h) => {
      const l = el("div", "pt-list");
      for (const t of targets) {
        const ic = el("span", "pt-mini"); ic.appendChild(partyPortraitCanvas(t, 36));
        const ail = t.ailment ? ` ・ ${ailLabel[t.ailment] || t.ailment}` : "";
        const hp = el("span", "pt-pick-hp");
        hp.appendChild(bar(t.alive ? t.hp : 0, t.maxhp, { tone: "hp" }));
        hp.appendChild(el("span", "pt-pick-hpv", `HP ${t.alive ? t.hp : 0}/${t.maxhp}${ail}`));
        l.appendChild(row({ icon: ic, title: t.name + (t.alive ? "" : " ✝"), sub: hp, chevron: true,
          onTap: () => { h.close("ok", { silent: true }); if (onPick) onPick(t); } }));
      }
      scroll.appendChild(l);
    },
    footer: [{ label: "やめる", kind: "ghost", onTap: (h) => h.close("cancel") }],
  });
}

// ================= 迷宮の隊シート =================
// town = 街の画面 (人業の館以外) から開く: 館へ移らずに、その場のシートで街の操作 (装備の付け替え・魂など) ができる
export function openSheet(d, seg = null, { town = false } = {}) {
  const G = G_();
  if (d) select(d);
  if (sheetH && !sheetH.closed) { if (seg) setSeg(seg); refreshSheet(); return sheetH; }
  G.statusOpen = true;
  sheetTown = !!town;
  dunSeg = SEGS.some((x) => x.key === seg) ? seg : "equip"; // 開くたび「装備」から (指定があればその区分)
  const mode = sheetTown ? "town" : "dungeon";
  sheetH = sheet.open({
    kind: "info", className: "pt-sheet", banner: sheetTown ? "人業" : "パーティの様子",
    body: (scroll) => { const w = el("div", "pt-root m-" + (sheetTown ? "sheet" : "dungeon")); renderView(w, mode); scroll.appendChild(w); },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
    onClose: () => {
      const wasTown = sheetTown;
      G.statusOpen = false; sheetH = null; dunSeg = null; picked = null; sheetTown = false;
      if (wasTown && inTown() && game.renderTown) { try { game.renderTown(); } catch (e) { /* noop */ } } // 街の札 (HP・装備の印) を描き直す
      if (game.renderParty) { try { game.renderParty(); } catch (e) { /* noop */ } }
    },
  });
  return sheetH;
}
function refreshSheet() {
  if (!sheetH || sheetH.closed) return;
  const st = sheetH.body ? sheetH.body.scrollTop : 0;
  sheetH.update({});
  if (sheetH.body) sheetH.body.scrollTop = st;
}
export function closeSheet() {
  if (sheetH && !sheetH.closed) sheetH.close("close");
  else if (G_()) G_().statusOpen = false;
}

// UI.openParty(idx, { context: "town"|"dungeon", seg })
function openParty(idx = null, o = {}) {
  const G = G_();
  if (!G) return false;
  const context = o.context || (G.state === "town" ? "town" : "dungeon");
  const d = idx && typeof idx === "object" ? idx : (G.party[idx == null ? (getPref("partyIdx", 0) || 0) : idx] || null);
  if (d) select(d);
  if (context === "town") {
    if (G.state !== "town") return false;
    const t = G.town || {};
    const onMansion = t.tab === "party" && !t.facility && !t.page;
    // inPlace: 館へ移らず、いまの画面の上に隊のシートで開く (街の顔アイコンから。館にいる時は館のまま)
    if (o.inPlace && !onMansion) { openSheet(d, o.seg || "equip", { town: true }); return true; }
    if (o.seg) setSeg(o.seg);
    if (onMansion) { game.renderTown(); return true; }
    pendingOpen = true; // 指定した人業・区分で入る (既定へ戻さない)
    const ok = UI.shell ? UI.shell.setTab("party") : false;
    pendingOpen = false;
    return ok;
  }
  if (G.state !== "board") return false;
  openSheet(null, o.seg);
  return true;
}

// ================= 登録 =================
export function install() {
  phase0ItemSheet = UI.itemSheet || null;
  registerUI({
    openStability,
    openParty,
    enterMansion,
    openReserve,
    openCreateDoll,
    openCreateName,
    autoEquip,
    betterGearCount,
    equipItemTo,
    bestWearer,
    partyPortraitCanvas,
    canEquipReason,
    equipChooser: (item, o = {}) => openEquipChooser(item, o),
    equipChooserEl: (item, o = {}) => equipChooserEl(item, o),
    openTacticSheet,
    openOmokage,
    openPartyTactics,
    openResonance, resonanceRow, queueResonanceNotice, // 魂の共鳴
    // 街の上に開いた人業のシートを描き直す (renderTown から。魂・装備を付け替えても札が古いままにならないよう)
    refreshPartySheet: () => { if (sheetH && !sheetH.closed && sheetTown) { memoClear(); bgcMemo.key = ""; refreshSheet(); } },
  });
  if (UI.shell && UI.shell.registerTab) {
    UI.shell.registerTab("party", {
      title: "人業の館",
      render: (root, api) => renderTab(root, api),
      badge: tabBadge,
    });
  }
}
