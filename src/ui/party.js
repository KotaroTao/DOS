// ===== 隊 (統合された人業の画面) — 隊列ストリップ・控え/仕立て・装備/魂/能力・迷宮内のシート =====
// 担当: WP-B。
//   街: 「隊」タブ (街シェルの中身)。迷宮: 盤面の隊の札から開く全高のシート (魂の付け替え・鍛錬はできない)。
//   1画面に収める (390×844 でページのスクロール無し):
//   [砕けた人業の知らせ] [隊列: 前衛3 | 後衛3 | 控え] [人業の見出し] ([野営]) [装備|魂|能力  最適装備] [区分の中身 (残りの高さ)]
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
  el, button, row, segmented, sheet, toast, confirm, statDelta, bar, badge, setText, longPress, shake, autoPage,
} from "./kit.js";
import { deltaFloat } from "./motion.js";
import { remember, setPref, getPref } from "./prefs.js";
import {
  statLines, detailLines, isEquippable, gearScore, elemStatShort, showSkillPopup, itemCatText,
} from "./itemview.js";
import { renderSoulSeg, openSoulPicker } from "./soulpanel.js";
import {
  planBestEquip, applyPlan, restoreEquip, equipSignature, trialEquip, slotKeysFor, previewStats, statsDelta, snapshotEquip,
} from "../autoequip.js";
import { SLOTS, SLOT_LABEL, SLOT_ICONS, MAX_ITEMS, canEquip, recalc, weaponRange, RANGE_LABEL, itemName } from "../items.js";
import { SOUL_CLASSES, JOB_GEAR, dollSprite, dollBust, jobBust, jobSprite, ATTR_KEYS, ATTR_LABEL, ATTR_NAME, soulSeriesName, soulByUid } from "../souls.js";
import { SPELLS, spellCost } from "../combat.js";
import { spriteCanvas, crispCanvas } from "../sprites.js";
import { rarityKey, RARITIES } from "../rarity.js";

const hasDOM = () => typeof document !== "undefined" && typeof document.createElement === "function";
const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const buzz = (p) => { try { if (game.buzz) game.buzz(p); } catch (e) { /* noop */ } };

// ---- 状態 (画面だけの選択。セーブには入れない) ----
let selDoll = null;       // 表示中の人業 (隊・控えのどちらでも)
let picked = null;        // 隊列の入れ替えで持ち上げた人業 (タップで移す先を選ぶ代替操作)
let intent = null;        // 次の描画で行うこと ({reserve:true} / {seg})
let sheetH = null;        // 迷宮の隊シート
let statOpen = null;      // 能力の説明を開いている能力キー
let resPage = 0;          // 控えのシートの頁
let phase0ItemSheet = null; // Phase 0 の品シートのスタブ (WP-C の本物が来るまでは自前の品の画面を使う)

const SEGS = [{ key: "equip", label: "装備" }, { key: "soul", label: "魂" }, { key: "stats", label: "能力" }];
function curSeg() { const s = remember("seg", "party"); return SEGS.some((x) => x.key === s) ? s : "equip"; }
function setSeg(k) { if (SEGS.some((x) => x.key === k)) remember("seg", "party", k); }

const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const inTown = () => G_() && G_().state === "town";
const isReserve = (d) => (G_().reserve || []).includes(d);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// 六大能力のくわしい説明 (能力の区分で開く)
const ATTR_DESC = {
  atk: "物理攻撃のダメージを決める力。武器による通常攻撃や物理スキルの威力が上がる。",
  vit: "受ける物理ダメージを軽減する頑強さ。高いほど打たれ強くなる。",
  agi: "行動の速さ。高いほど戦闘で先に動け、敵の攻撃を回避しやすくなる。",
  int: "攻撃呪文の威力を決める知力。火球など攻撃魔法のダメージが上がる。",
  pie: "回復呪文の効果を決める信仰心。HPを回復する魔法の回復量が上がる。",
  luk: "会心（クリティカル）の発生率を左右する幸運。高いほど大ダメージが出やすい。",
};
const DLABEL = { atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK", hp: "HP", mp: "MP" };

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
  // 品を出せる人業 = 隊と控えの全員 (旧来の装備候補と同じ。迷宮の中でも控えの袋から取り出せる)
  return allDolls();
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
      if (!it || !slotKeysFor(it).includes(key)) continue;
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
  const best = cands.find((c) => c.room && !c.cursed && c.gain > 0.05);
  return { count: cands.length, better: !!best, bestGain: best ? best.gain : 0 };
}
// 品 it をこの人業に付けるなら、どの部位が最良か ({key, gain, delta, displaced})
function bestSlotFor(d, it) {
  let best = null;
  for (const key of slotKeysFor(it)) {
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
  "重量": "この職業には重すぎる防具",
  "属性": "属性が合わない",
  "呪い": "呪われた装備が外れない",
  "両手": "呪われた装備があり、両手武器と盾を持ち替えられない",
};
export function canEquipReason(d, it) {
  if (!d || !it) return "装備品でない";
  if (!isEquippable(it)) return "装備品でない";
  if (d.primary == null) return "魂なし";
  if (it.unidentified) return "未鑑定";
  if (!canEquip(d, it)) {
    if (it.align && d.align && it.align !== "中立" && d.align !== "中立" && it.align !== d.align) return "属性";
    if (it.classes || it.forJob) return "職業";
    const gear = JOB_GEAR[d.clsKey];
    if (gear) {
      if (it.slot === "weapon") return "武器種";
      if (it.slot === "shield") return "盾不可";
      if (it.weight && (ARMOR_RANK[it.weight] || 0) > (ARMOR_RANK[gear.armor] || 0)) return "重量";
    }
    return "職業";
  }
  let why = null;
  for (const k of slotKeysFor(it)) {
    const cur = d.equip && d.equip[k];
    if (cur && cur.cursed) { why = why || "呪い"; continue; }
    if (it.slot === "weapon" && it.twoHanded && d.equip.shield && d.equip.shield.cursed) { why = "両手"; continue; }
    if (it.slot === "shield" && d.equip.weapon && d.equip.weapon.twoHanded && d.equip.weapon.cursed) { why = "両手"; continue; }
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
function deltaText(delta, n = 3) {
  if (!delta) return "";
  const parts = Object.keys(DLABEL).filter((k) => delta[k]).sort((a, b) => Math.abs(delta[b]) - Math.abs(delta[a])).slice(0, n)
    .map((k) => `${delta[k] > 0 ? "▲" : "▼"}${DLABEL[k]}${delta[k] > 0 ? "+" : ""}${delta[k]}`);
  return parts.join(" ");
}
// 品 item を doll の部位 key に装備する (いま持っている袋から)。stashTo = 外した品を入れる袋 (取り替え)。
// quiet でなければ「元に戻す」つきのトースト。{ ok, key, delta, full, msg }
function equipWithUndo(doll, item, key = null, { stashTo = null, quiet = false } = {}) {
  if (!doll || !item) return { ok: false };
  const owner = ownerOf(item);
  if (!owner) return { ok: false, msg: "持ち主が見つからない" };
  key = key || (bestSlotFor(doll, item) || {}).key || slotKeysFor(item)[0];
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
function pickWearer(doll, item, { onDone = null, chip = null } = {}) {
  const why = canEquipReason(doll, item);
  if (why) { sfx("ng"); if (chip) shake(chip); toast(`${doll.name}: ${REASON_TEXT[why] || why}`, { tone: "bad" }); return { ok: false, reason: why }; }
  const b = bestSlotFor(doll, item);
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
export function equipChooserEl(item, { owner = null, onPick = null, onDone = null, town = null } = {}) {
  const G = G_();
  const inT = town == null ? inTown() : town;
  const wrap = el("div", "pt-ch");
  const head = el("div", "pt-ch-h");
  head.appendChild(el("span", "pt-ch-t", "誰に装備させる？"));
  head.appendChild(el("span", "pt-ch-s", "▲▼ = いまの装備と比べて"));
  wrap.appendChild(head);
  const dolls = inT ? allDolls() : G.party.slice();
  const infos = dolls.map((d) => {
    const why = canEquipReason(d, item);
    const b = why ? null : bestSlotFor(d, item);
    return { d, why, b };
  });
  let best = null;
  for (const x of infos) if (x.b && x.b.gain > 0.05 && (!best || x.b.gain > best.b.gain)) best = x;
  const grid = el("div", "pt-ch-grid");
  let sepDone = false;
  for (const x of infos) {
    if (!sepDone && isReserve(x.d)) {
      sepDone = true;
      grid.appendChild(el("div", "pt-ch-sep", "控え"));
    }
    const c = el("button", "pt-chc" + (x.why ? " ng" : "") + (x === best ? " best" : "") + (x.d === owner ? " own" : ""));
    c.type = "button";
    const pc = el("span", "pt-chc-p");
    pc.appendChild(partyPortraitCanvas(x.d, 36));
    if (!x.d.alive) pc.appendChild(el("span", "pt-chc-dead", "✝"));
    c.appendChild(pc);
    const tx = el("span", "pt-chc-t");
    tx.appendChild(el("span", "pt-chc-n", x.d.name));
    if (x.why) tx.appendChild(el("span", "pt-chc-why", x.why));
    else {
      const dl = el("span", "pt-chc-d");
      const parts = Object.keys(DLABEL).filter((k) => x.b.delta[k]).sort((a, b) => Math.abs(x.b.delta[b]) - Math.abs(x.b.delta[a])).slice(0, 2);
      if (!parts.length) dl.appendChild(el("span", "eq", "変化なし"));
      for (const k of parts) {
        const v = x.b.delta[k];
        dl.appendChild(el("span", v > 0 ? "up" : "dn", `${v > 0 ? "▲" : "▼"}${DLABEL[k]}${v > 0 ? "+" : ""}${v}`));
      }
      tx.appendChild(dl);
    }
    c.appendChild(tx);
    if (x === best) c.appendChild(el("span", "pt-chc-best", "最良"));
    else if (x.d === owner) c.appendChild(el("span", "pt-chc-own", "所持"));
    c.setAttribute("aria-label", `${x.d.name}${x.why ? `: ${REASON_TEXT[x.why] || x.why}` : ` に装備 ${deltaText(x.b.delta)}`}`);
    c.addEventListener("click", () => {
      if (onPick) return onPick(x.d, { reason: x.why, best: x.b, chip: c });
      pickWearer(x.d, item, { chip: c, onDone });
    });
    grid.appendChild(c);
  }
  wrap.appendChild(grid);
  return wrap;
}
// 品の画面 (シート): 品の要約 + 誰に装備させるか (主役) + その他の操作 (使う・渡す・捨てる…)
export function openEquipChooser(item, { owner = null, actions = null } = {}) {
  if (!item) return null;
  owner = owner || ownerOf(item);
  const rk = rarityKey(item);
  const accent = rk ? RARITIES[rk].color : null;
  let h = null;
  const body = el("div", "pt-item ch");
  body.appendChild(itemSummary(item, accent, { compact: true }));
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
let bgcMemo = { key: "", n: 0 };
function betterGearCount() {
  const G = G_();
  if (!G || !G.party) return 0;
  const key = equipSignature(allDolls()) + "|" + G.party.map((d) => `${d.jobKey}:${d.level}`).join(",");
  if (bgcMemo.key === key) return bgcMemo.n;
  memoClear();
  let n = 0;
  for (const d of G.party) {
    if (!d) continue;
    if (SLOTS.some((k) => slotInfo(d, k).better)) n++;
  }
  bgcMemo = { key, n };
  return n;
}

function autoEquip(target = "all") {
  const G = G_();
  if (!G) return { ok: false, moves: 0 };
  const targets = target === "all" ? G.party.filter(Boolean) : [target].filter(Boolean);
  if (!targets.length) return { ok: false, moves: 0 };
  const pool = itemsPool();
  const plan = planBestEquip(targets, { pool, canEquip, score: gearScore, recalc });
  if (!plan.moves.length) {
    sfx("select");
    toast(targets.length > 1 ? "パーティの装備は、いまが最良だ" : `${targets[0].name}の装備は、いまが最良だ`, { tone: "info" });
    return { ok: false, moves: 0 };
  }
  const involved = plan.undoSnapshot.map((s) => s.doll);
  const before = new Map(targets.map((d) => [d, previewStats(d, d.equip, recalc)]));
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
  const who = targets.length > 1 ? `パーティの${new Set(plan.moves.map((m) => m.doll)).size}体` : targets[0].name;
  toast(`最適装備: ${who}の ${plan.moves.length}点を付け替えた`, {
    tone: "good",
    action: { label: "元に戻す", fn: () => {
      if (equipSignature(involved) !== sig) { sfx("ng"); toast("装備が変わったため、元に戻せない", { tone: "bad" }); return; }
      restoreEquip(plan.undoSnapshot, recalc);
      game.log("最適装備を元に戻した。", "sys");
      sfx("select"); bgcMemo.key = "";
      if (game.autosave) game.autosave(true);
      rerender();
      toast("元に戻した", { tone: "info" });
    } },
  });
  return { ok: true, moves: plan.moves.length, plan };
}

// 付け替えの増減を、枠の上に浮かべる
function floatDelta(sel, delta) {
  if (!delta || !hasDOM()) return;
  const t = deltaText(delta);
  if (!t) return;
  const up = Object.keys(DLABEL).reduce((s, k) => s + (delta[k] || 0), 0) >= 0;
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

// 街の「隊」タブ
function renderTab(root) {
  const wrap = el("div", "pt-root m-town");
  renderView(wrap, "town");
  root.appendChild(wrap);
  // 予約された操作 (旧「館」の入口から: 控え・仕立て / 魂の区分)
  if (intent) {
    const it = intent; intent = null;
    if (it.reserve) setTimeout(() => openReserve(), 0);
  }
}

function renderView(root, mode) {
  const G = G_();
  memoClear();
  if (intent && intent.seg) { setSeg(intent.seg); if (!intent.reserve) intent = null; else delete intent.seg; }
  const d = ensureSel();
  if (!allDolls().length) { root.appendChild(emptyState()); return; }
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
  if (mode === "town") autoPage(body); // 縦スクロールの代わりに頁送り (収まれば出ない)
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

// ---- 砕けた人業の知らせ + 今すぐ連れ帰る (1行) ----
function RESCUE_MS() { return game.RESCUE_SHORTEN_MS || 20 * 60 * 1000; }
function deadBanner() {
  const dead = allDolls().filter((d) => d.isDoll && !d.alive);
  if (!dead.length || (dead.length === 1 && dead[0] === selDoll)) return null;
  const G = G_();
  const now = Date.now();
  const soonest = dead.filter((d) => d.reviveAt).sort((a, b) => a.reviveAt - b.reviveAt)[0];
  const cost = dead.reduce((a, d) => a + (d.reviveAt ? Math.max(1, Math.ceil((d.reviveAt - now) / RESCUE_MS())) : 0), 0);
  const box = el("section", "pt-dead");
  const t = el("div", "pt-dead-t");
  t.appendChild(el("span", "pt-dead-mk", "✝"));
  const tx = el("span", "pt-dead-tx");
  tx.appendChild(el("b", null, dead.length > 1 ? `${dead.length}体` : dead[0].name));
  tx.appendChild(document.createTextNode(" 砕けた"));
  if (soonest && game.reviveTimerEl) { tx.appendChild(document.createTextNode(" ・ 帰還 ")); tx.appendChild(game.reviveTimerEl("span", "pt-dead-tm", "", soonest)); }
  t.appendChild(tx);
  box.appendChild(t);
  if (cost > 0) {
    const b = button({ label: "今すぐ連れ帰る", kind: "danger", size: "sm", cost: { kind: "red", n: cost }, disabled: (G.redSoul || 0) < 1, onTap: () => confirmHastenAll(cost) });
    b.classList.add("pt-dead-b");
    box.appendChild(b);
  }
  return box;
}
function confirmHastenAll(cost) {
  const G = G_();
  const have = G.redSoul || 0;
  confirm({
    banner: "連れ帰る", title: `赤い魂 ${Math.min(cost, have)} を捧げ、砕けた人業を連れ帰る？`,
    lines: [cost > have ? `必要 ${cost} のうち、所持の ${have} だけ捧げる (帰還が早まる)。` : "赤い魂1つで帰還が20分早まる。", `所持: 赤い魂 ${have}`],
    okLabel: "連れ帰る", danger: false,
  }).then((ok) => {
    if (!ok) return;
    const r = ops.hastenAll ? ops.hastenAll() : null;
    if (r && r.ok) toast(r.revived ? `${r.revived}体が帰還した (赤い魂 ${r.spent})` : `帰還を早めた (赤い魂 ${r.spent})`, { tone: "good" });
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
    grp.appendChild(el("span", "pt-fgrp-l", r ? "後衛" : "前衛"));
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
  if (town) wrap.appendChild(benchButton());
  return wrap;
}
function stripPortrait(d, i, mode) {
  const wrap = el("div", "pt-slotp");
  const p = portraitEl(d, { size: 44, sel: d === selDoll, cls: picked === d ? "lifted" : (picked ? "target" : "") });
  p.dataset.drop = "p" + i;
  wrap.appendChild(p);
  wrap.appendChild(el("span", "pt-slotp-n", d.name));
  if (mode === "town") attachDrag(p, d, i);
  else p.addEventListener("click", () => { sfx("select"); select(d); rerender(); });
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
  b.appendChild(el("span", "pt-bench-l", "控え"));
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
    select(d);
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

// ================= 控え・仕立て (シート。4体ずつの頁) =================
let reserveH = null;
const RES_PER_PAGE = 4;
export function openReserve() {
  if (!inTown()) return null;
  if (reserveH && !reserveH.closed) { reserveH.update({}); return reserveH; }
  resPage = 0;
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
  const pages = Math.max(1, Math.ceil(G.reserve.length / RES_PER_PAGE));
  if (resPage >= pages) resPage = pages - 1;
  const list = el("div", "pt-res");
  if (!G.reserve.length) list.appendChild(el("div", "pt-res-none", "控えはいない。パーティの札を「控え」へ引けば下げられる。"));
  for (const d of G.reserve.slice(resPage * RES_PER_PAGE, (resPage + 1) * RES_PER_PAGE)) list.appendChild(reserveRow(d));
  root.appendChild(list);
  if (pages > 1) {
    const pg = el("div", "pt-pager");
    const prev = button({ label: "‹ 前", kind: "ghost", size: "sm", disabled: resPage <= 0, onTap: () => { resPage--; reserveH.update({}); } });
    const next = button({ label: "次 ›", kind: "ghost", size: "sm", disabled: resPage >= pages - 1, onTap: () => { resPage++; reserveH.update({}); } });
    pg.appendChild(prev);
    pg.appendChild(el("span", "pt-pager-n", `${resPage + 1} / ${pages}`));
    pg.appendChild(next);
    root.appendChild(pg);
  }
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  root.appendChild(el("div", "pt-note c", `仕立ての費用: 3体目まで無料 ・ 4体目 赤い魂30 ・ 5体目 50 ・ 以降 100${cost ? "" : "（いまは無料）"}。札の長押しで名を変える。`));
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
  if (!d.alive && game.reviveTimerEl) { st.appendChild(document.createTextNode(" ・ ")); st.appendChild(game.reviveTimerEl("span", "pt-res-tm", "✝ 帰還 ", d)); }
  else if (d.primary != null) st.appendChild(el("span", "pt-res-s", `  HP ${d.hp}/${d.maxhp}`));
  tx.appendChild(st);
  top.appendChild(tx);
  const look = button({ label: "見る", kind: "ghost", size: "sm", onTap: () => viewDoll(d) });
  look.classList.add("pt-res-look");
  top.appendChild(look);
  r.appendChild(top);
  // 入れ替え先 (隊の札) を直に並べる: 1タップで入れ替え
  const sw = el("div", "pt-res-sw");
  if (d.primary == null) {
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
      t.addEventListener("click", () => swapWithReserve(d, j));
      sw.appendChild(t);
    });
    if (G.party.length < 6) {
      const a = el("button", "pt-res-join");
      a.type = "button";
      a.appendChild(el("span", null, "＋"));
      a.appendChild(el("span", "pt-res-join-l", "加える"));
      a.setAttribute("aria-label", `${d.name} をパーティに加える`);
      a.addEventListener("click", () => joinParty(d));
      sw.appendChild(a);
    }
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
  G.reserve.splice(k, 1); G.party.push(d);
  sfx("select");
  toast(`${d.name} をパーティに加えた`, { tone: "good" });
  if (reserveH) reserveH.close();
  select(d);
  if (game.autosave) game.autosave(true);
  rerender();
}

// 人業を仕立てる: 宿す魂を選ぶ → 名を与える
export function openCreateDoll() {
  const G = G_();
  if (!inTown()) return;
  const cost = game.emptyDollCost ? game.emptyDollCost() : 0;
  if ((G.redSoul || 0) < cost) { sfx("ng"); toast("赤い魂が足りない", { tone: "bad" }); return; }
  if (allDolls().length >= 100) { sfx("ng"); toast("これ以上は仕立てられない (100体まで)", { tone: "bad" }); return; }
  const worn = (uid) => allDolls().some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const free = G.souls.filter((s) => !worn(s.uid)).sort(game.soulSortCmp || (() => 0));
  if (!free.length) { sfx("ng"); toast("宿せる魂がない ― 迷宮で魂を集めよう", { tone: "bad" }); return; }
  sfx("select");
  const h = sheet.open({
    kind: "info", banner: "宿す魂をえらぶ", className: "pt-pick-sheet",
    lines: [cost ? `赤い魂 ${cost} で器を買い、選んだ魂を宿す。` : "無料で器を仕立て、選んだ魂を宿す。"],
    body: (scroll) => {
      const list = el("div", "pt-list");
      for (const s of free) {
        const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
        const ic = el("span", "pt-orb");
        ic.style.setProperty("--glow", cl.glow);
        ic.appendChild(pixelCanvas(jobBust(s.clsKey, Math.max(1, soulRank(s))), 36));
        const r = row({ icon: ic, title: `${soulSeriesName(s.clsKey)}の魂`, sub: `Lv${s.level} ・ ${rarityName(cl.rarity)}`, chevron: true,
          onTap: () => { h.close(); openCreateName(s.uid); } });
        r.classList.add("pt-soulrow");
        list.appendChild(r);
      }
      scroll.appendChild(list);
    },
  });
  return h;
}
function rarityName(r) { return { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" }[r] || ""; }
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
    banner: "人業を仕立てる", title: `${soulSeriesName(s.clsKey)}の魂を宿す器に、名を`,
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
function dollHeader(d, mode) {
  const G = G_();
  const town = mode === "town";
  const head = el("section", "pt-head" + (d.alive ? "" : " dead"));
  const p = portraitEl(d, { size: 44, tag: "div" });
  if (town) longPress(p, () => openRename(d));
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
  const tags = [pi >= 0 ? (pi < 3 ? "前衛" : "後衛") : "控え"];
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
  head.appendChild(tx);
  if (town && pi < 0 && d.primary != null) {
    const join = button({ label: G.party.length < 6 ? "パーティへ" : "入替", kind: "secondary", size: "sm", onTap: () => (G.party.length < 6 ? joinParty(d) : openReserve()) });
    join.classList.add("pt-head-join");
    head.appendChild(join);
  }
  return head;
}

// 砕けた人業: 帰還までの残り + 赤い魂で早める (見出しの2行目)
function rescueLine(d) {
  const G = G_();
  if (!d.reviveAt && game.setReviveTimers) game.setReviveTimers();
  const box = el("div", "pt-rescue");
  const t = el("span", "pt-rescue-t");
  t.appendChild(el("span", "pt-rescue-mk", "✝"));
  t.appendChild(document.createTextNode("帰還 "));
  if (game.reviveTimerEl) t.appendChild(game.reviveTimerEl("b", "pt-rescue-tm", "", d));
  box.appendChild(t);
  const n = d.reviveAt ? Math.max(1, Math.ceil((d.reviveAt - Date.now()) / RESCUE_MS())) : 1;
  box.appendChild(button({ label: "早める", kind: "secondary", size: "sm", cost: { kind: "red", n: 1 }, disabled: (G.redSoul || 0) < 1,
    onTap: () => { if (game.tryHastenRescue) game.tryHastenRescue(d); rerender(); } }));
  if (n > 1) box.appendChild(button({ label: "今すぐ", kind: "danger", size: "sm", cost: { kind: "red", n }, disabled: (G.redSoul || 0) < 1,
    onTap: () => confirm({ banner: "連れ帰る", title: `赤い魂 ${n} で ${d.name} を今すぐ連れ帰る？`, lines: [`所持: 赤い魂 ${G.redSoul || 0}`], okLabel: "連れ帰る", danger: false })
      .then((ok) => { if (!ok) return; for (let k = 0; k < n && !d.alive && (G.redSoul || 0) >= 1; k++) game.tryHastenRescue(d); rerender(); }) }));
  return box;
}

// ---- 迷宮: 野営 (呪文・道具) をすぐ使える札 ----
function campSpellsOf(d) {
  return (d.spells || []).filter((k) => { const sp = SPELLS[k]; return sp && (sp.kind === "heal" || sp.kind === "cure" || sp.cure); });
}
function consumablesOf(d) {
  const out = [];
  (d.items || []).forEach((it, index) => { if (it && it.slot === "use") out.push({ it, index }); });
  return out;
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
function segBar(d) {
  const wrap = el("div", "pt-segbar");
  const seg = segmented(SEGS, curSeg(), (k) => { setSeg(k); sfx("select"); rerender(); }, { prefKey: "party" });
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
  if (G_().party.length > 1) {
    const n = betterGearCount();
    const b = el("button", "pt-allauto" + (n ? " hot" : ""));
    b.type = "button";
    b.appendChild(el("span", null, "パーティの全員を最適装備"));
    if (n) b.appendChild(badge(n));
    b.setAttribute("aria-label", `パーティの全員を最適装備${n ? ` (${n}体にもっと良い装備)` : ""}`);
    b.addEventListener("click", () => autoEquip("all"));
    h.appendChild(b);
  }
  // 見出しと所持の札は1つの箱に入れる (狭い画面では左右に並べて高さを詰める: ui-party.css)
  const wrap = el("div", "pt-bagwrap");
  wrap.appendChild(h);
  const grid = el("div", "pt-bag");
  for (let i = 0; i < MAX_ITEMS; i++) grid.appendChild(bagCell(d, d.items[i]));
  wrap.appendChild(grid);
  root.appendChild(wrap);
}

function slotCell(d, k) {
  const it = d.equip[k];
  const info = d.primary != null ? slotInfo(d, k) : { count: 0, better: false };
  const r = el("button", "pt-slot" + (it ? "" : " empty") + (it && it.cursed ? " cursed" : "") + (info.better ? " better" : ""));
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
  top.appendChild(el("span", "pt-slot-k", SLOT_LABEL[k]));
  if (info.better) top.appendChild(el("span", "pt-up", it ? "▲候補" : `▲${info.count}`));
  else if (!it && info.count) top.appendChild(el("span", "pt-slot-cnt", `＋${info.count}`));
  tx.appendChild(top);
  if (it) {
    tx.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-slot-n", it, it.cursed ? " (呪)" : "") : el("span", "pt-slot-n", itemName(it)));
    const s = statLines(it);
    if (s) tx.appendChild(el("span", "pt-slot-s", s));
  } else {
    tx.appendChild(el("span", "pt-slot-n dim", "― 空き ―"));
  }
  r.appendChild(tx);
  r.setAttribute("aria-label", `${SLOT_LABEL[k]}: ${it ? itemName(it) : "空き"}${info.better ? " (もっと良い品がある)" : ""}`);
  r.addEventListener("click", () => { sfx("select"); openCandidates(d, k); });
  return r;
}

function bagCell(d, it) {
  if (!it) return el("div", "pt-bcell empty");
  const c = el("button", "pt-bcell");
  c.type = "button";
  const rk = rarityKey(it);
  if (rk) c.style.setProperty("--edge", RARITIES[rk].color);
  c.appendChild(spriteCanvas(it, 2));
  if (it.unidentified) c.appendChild(el("span", "pt-seal", "?"));
  else if (it.cursed) c.appendChild(el("span", "pt-seal curse", "呪"));
  if (it.isNew) c.appendChild(el("span", "pt-new", "NEW"));
  // この人業に付ければ伸びる品は ▲
  if (!it.unidentified && isEquippable(it) && d.primary != null && !canEquipReason(d, it)) {
    const b = bestSlotFor(d, it);
    if (b && b.gain > 0.05) c.appendChild(el("span", "pt-bup", "▲"));
  }
  c.title = itemName(it);
  c.setAttribute("aria-label", itemName(it));
  c.addEventListener("click", () => { sfx("select"); openItem(it, d, { from: "bag" }); });
  longPress(c, () => openItem(it, d, { from: "bag" }));
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
    kind: "info", banner: `${SLOT_LABEL[k]} ― ${d.name}`, className: "pt-cand-sheet",
    body: (scroll, h) => candBody(scroll, d, k, h, town),
    onClose: () => { candH = null; },
  });
  return candH;
}
function candBody(root, d, k, h, town) {
  const cur = d.equip[k];
  const curBox = el("div", "pt-cur" + (cur ? "" : " empty"));
  const cic = el(cur ? "button" : "span", "pt-cur-ic");
  if (cur) {
    cic.type = "button";
    cic.setAttribute("aria-label", `${itemName(cur)} をくわしく`);
    cic.addEventListener("click", () => openItem(cur, d, { from: "equip", key: k }));
    cic.appendChild(spriteCanvas(cur, 2));
  }
  curBox.appendChild(cic);
  const ctx = el("div", "pt-cur-t");
  ctx.appendChild(el("span", "pt-cur-k", "装備中"));
  if (cur) {
    ctx.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-cur-n", cur) : el("span", "pt-cur-n", itemName(cur)));
    const s = statLines(cur);
    if (s) ctx.appendChild(el("span", "pt-cur-s", s));
  } else ctx.appendChild(el("span", "pt-cur-n dim", "なし"));
  curBox.appendChild(ctx);
  if (cur) {
    const un = button({ label: cur.cursed ? "呪いで外せない" : "外す", kind: "ghost", size: "sm", disabled: !!cur.cursed || d.items.length >= MAX_ITEMS,
      onTap: () => { h.close(); if (game.doUnequip) game.doUnequip(d, k); } });
    curBox.appendChild(un);
  }
  root.appendChild(curBox);

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
  wrap.appendChild(ic);
  const main = el("button", "pt-cand-main");
  main.type = "button";
  const tx = el("span", "pt-cand-t");
  const top = el("span", "pt-cand-top");
  top.appendChild(game.itemNameEl ? game.itemNameEl("span", "pt-cand-n", c.it, c.it.cursed ? " (呪)" : "") : el("span", "pt-cand-n", itemName(c.it)));
  top.appendChild(el("span", "pt-own" + (c.owner === d ? " me" : isReserve(c.owner) ? " res" : ""), c.owner === d ? "自分" : `${c.owner.name}${isReserve(c.owner) ? "・控え" : ""}`));
  tx.appendChild(top);
  tx.appendChild(statDelta(c.delta));
  if (!c.room) tx.appendChild(el("span", "pt-cand-w", "持ち物がいっぱい ― 札から「取り替え」で付けられる"));
  else if (c.it.cursed) tx.appendChild(el("span", "pt-cand-w", "呪われている ― 一度付けると外せない"));
  main.appendChild(tx);
  main.appendChild(el("span", "pt-cand-g " + (c.gain > 0.05 ? "up" : c.gain < -0.05 ? "dn" : "eq"), c.gain > 0.05 ? "▲" : c.gain < -0.05 ? "▼" : "＝"));
  main.setAttribute("aria-label", `${d.name}に ${itemName(c.it)} を装備`);
  main.addEventListener("click", () => {
    const go = () => { const r = pickWearer(d, c.it, { onDone: () => h.close() }); if (r && r.full) h.close("replace", { silent: true }); };
    if (c.it.cursed) confirm({ title: `${c.it.name} は呪われている`, lines: ["一度装備すると外せない。それでも付ける？"], okLabel: "付ける" }).then((y) => { if (y) go(); });
    else go();
  });
  longPress(main, () => openItem(c.it, c.owner, { from: "bag" }));
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
      return;
    }
    info.classList.remove("x");
    const ail = !d.alive ? "砕けた" : d.ailment === "poison" ? "毒" : d.ailment === "paralyze" ? "麻痺" : d.ailment === "stone" ? "石化" : "正常";
    const fact = (k, v, cls) => { const f = el("div", "pt-fact" + (cls ? " " + cls : "")); f.appendChild(el("span", "pt-fact-k", k)); f.appendChild(el("span", "pt-fact-v", v)); info.appendChild(f); };
    fact("HP", `${d.alive ? d.hp : 0}/${d.maxhp}`);
    fact("MP", `${d.mp}/${d.maxmp}`);
    fact("状態", ail, ail === "正常" ? "" : "bad");
    fact("会心", `+${Math.round((d.critBonus || 0) * 100)}%`);
    fact("属性攻", elemStatShort(d.elemAtk));
    fact("属性防", elemStatShort(d.elemDef));
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
  // 技 (タップ = くわしく)・加護 (長押し = くわしく) の札は横に流れる1列
  if (d.spells && d.spells.length) {
    const line = el("div", "pt-chiprow");
    line.appendChild(el("span", "pt-chiprow-l", "技"));
    const sc = el("div", "pt-chiprow-in");
    for (const key of d.spells) {
      const sp = SPELLS[key];
      const c = el("button", "pt-skill");
      c.type = "button";
      c.appendChild(el("span", "pt-skill-n", sp ? sp.name : key));
      if (sp) c.appendChild(el("span", "pt-skill-c", `MP${sp.mp}`));
      c.addEventListener("click", () => showSkillPopup(key));
      sc.appendChild(c);
    }
    line.appendChild(sc);
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
      c.addEventListener("click", () => toast(`加護「${p}」― 常に働く力`, { tone: "info" }));
      sc.appendChild(c);
    }
    line.appendChild(sc);
    root.appendChild(line);
  }
  if (d.jobKey && game.showCodexJobDetail) {
    const r = row({ title: "職業図鑑を見る", sub: `${d.cls} ― ランクごとの技・加護`, chevron: true, onTap: () => game.showCodexJobDetail(d.jobKey, d.jobRank) });
    r.classList.add("pt-codex");
    root.appendChild(r);
  }
}

// ================= 品の画面 =================
// 袋の装備品 (鑑定済み) = 「誰に装備させるか」が主役の品の画面 (equipChooser)。
// それ以外 (未鑑定・道具・蒐集品・装備中) は品のシート: WP-C の UI.itemSheet があればそれ、無ければ自前。
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
    acts.push({ label: it.cursed ? "呪いで外せない" : "外す", kind: "secondary", disabled: !!it.cursed || owner.items.length >= MAX_ITEMS,
      onTap: (h) => { close(h); if (key && game.doUnequip) game.doUnequip(owner, key); } });
    return acts;
  }
  if (ctx !== "bag") return acts;
  if (it.unidentified) {
    if (town) {
      acts.push({ label: "商会で鑑定する", sub: game.appraiseCost ? `鑑定料 ${game.appraiseCost(it)}` : "", kind: "primary",
        onTap: (h) => { close(h); if (UI.openShop) UI.openShop("sell"); } });
    } else if (it.lr || it.idHardFail) {
      acts.push({ label: it.lr ? "レジェンドレアは商会でのみ鑑定できる" : "鑑定に失敗済み ― 商会でのみ", kind: "ghost", disabled: true });
    } else {
      const men = G.party.filter((m) => m.alive && game.canIdentify && game.canIdentify(m));
      if (!men.length) acts.push({ label: "鑑定の心得がある仲間がいない", kind: "ghost", disabled: true });
      else {
        const ch = (m) => (game.identifyChance ? game.identifyChance(m, it.lv || 1) : 0);
        const best = men.slice().sort((a, b) => ch(b) - ch(a))[0];
        acts.push({ label: `鑑定を試す ― ${best.name} ${Math.round(ch(best) * 100)}%`, sub: "失敗すると商会でしか鑑定できなくなる", kind: "primary",
          onTap: (h) => { close(h); if (game.doIdentifySkill) game.doIdentifySkill(best, it); rerender(); } });
        if (men.length > 1) acts.push({ label: "他の者が鑑定する", kind: "secondary", onTap: (h) => { close(h); if (game.openIdentifyChooser) game.openIdentifyChooser(it); } });
      }
    }
  } else if (it.slot === "use") {
    acts.push({ label: `${owner.name}が使う`, kind: "primary", onTap: (h) => { close(h); const i = owner.items.indexOf(it); if (i >= 0 && game.useItem) game.useItem(owner, i); } });
  } else if (isEquippable(it) && equip) {
    acts.push({ label: "誰に装備させるか選ぶ", kind: "primary", onTap: (h) => { close(h); openEquipChooser(it, { owner }); } });
  } else if (it.slot === "misc") {
    acts.push({ label: town ? "商会で売るか、王宮の宝物庫へ奉納する" : "街へ持ち帰ろう (商会・宝物庫)", kind: "ghost", disabled: true });
  }
  if (transferTargets(owner).length) acts.push({ label: "渡す", kind: "secondary", onTap: (h) => { close(h); openTransfer(owner, it); } });
  acts.push({ label: "捨てる", kind: "danger", onTap: (h) => { close(h); const i = owner.items.indexOf(it); if (i >= 0 && game.dropItem) game.dropItem(owner, i); } });
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
export function openSheet(d) {
  const G = G_();
  if (d) select(d);
  if (sheetH && !sheetH.closed) { refreshSheet(); return sheetH; }
  G.statusOpen = true;
  sheetH = sheet.open({
    kind: "info", className: "pt-sheet", banner: "パーティの様子",
    body: (scroll) => { const w = el("div", "pt-root m-dungeon"); renderView(w, "dungeon"); scroll.appendChild(w); },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
    onClose: () => { G.statusOpen = false; sheetH = null; picked = null; if (game.renderParty) { try { game.renderParty(); } catch (e) { /* noop */ } } },
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
  if (o.seg) setSeg(o.seg);
  if (context === "town") {
    if (G.state !== "town") return false;
    const t = G.town || {};
    if (t.tab === "party" && !t.facility && !t.page) { game.renderTown(); return true; }
    return UI.shell ? UI.shell.setTab("party") : false;
  }
  if (G.state !== "board") return false;
  openSheet();
  return true;
}

// ================= 登録 =================
export function install() {
  phase0ItemSheet = UI.itemSheet || null;
  registerUI({
    openParty,
    autoEquip,
    betterGearCount,
    equipItemTo,
    bestWearer,
    partyPortraitCanvas,
    canEquipReason,
    equipChooser: (item, o = {}) => openEquipChooser(item, o),
    equipChooserEl: (item, o = {}) => equipChooserEl(item, o),
  });
  if (UI.shell && UI.shell.registerTab) {
    UI.shell.registerTab("party", {
      title: "人業の館",
      render: (root) => renderTab(root),
      badge: (counts) => {
        if (counts && counts.dead) return counts.dead;
        let better = 0;
        try { better = betterGearCount(); } catch (e) { better = 0; }
        return (counts && counts.trainable) || better ? true : null;
      },
    });
  }
}
