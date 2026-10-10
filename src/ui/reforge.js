// ===== 鍛え直し — 商会で金貨を払い、装備の品質 (0〜100) を引き直す (奈落と同時に開く。2026-10 ユーザーの指示) =====
// 品質のしくみは items.js の「品質」、費用と判定は game.js の reforge* を見る。
//   商会の区分「鍛え直し」: 隊と控えの全員の装備品 (装備中 → 持ち物) を並べ、押すと鍛え直しのシート
//   品のシート (loot.js) の「鍛え直し」からも同じシートを開く
// 提供する契約: UI.openReforge(item, owner, { onDone }) / UI.renderForgeList(wrap) → 描く関数
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, toast, setText, glyph } from "./kit.js";
import { statLines, qualityTone } from "./itemview.js";
import { nameSpan, deltaEl, goldEl, dollIcon } from "./loot.js";
import { SLOTS, SLOT_LABEL, AIL_LABEL, hasQuality, qualityOf, qualityMatters, itemAtQuality, QUALITY_SPREAD, itemName } from "../items.js";
import { previewStats, statsDelta } from "../autoequip.js";
import { ATTR_LABEL } from "../souls.js";
import { RESIST_LABEL } from "../resistance.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { spriteCanvas } from "../sprites.js";

const G = () => game.G || {};
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音は演出のみ */ } };
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G().party || []), ...(G().reserve || [])]);
const isReserve = (d) => (G().reserve || []).includes(d);
const shortN = (n) => (n >= 100000 ? `${Math.round(n / 1000)}k` : String(n));
const SPREAD_PCT = Math.round(QUALITY_SPREAD * 100);
export const REFORGE_NOTE = `品質は0〜100。品質50が並品で、0なら性能が${SPREAD_PCT}%下がり、100なら${SPREAD_PCT}%上がる。`;

// 品の持ち主と置き場所 ({ doll, key } — key = 装備の欄、袋の中なら null)
function holderOf(it) {
  for (const d of allDolls()) {
    for (const k of SLOTS) if (d.equip && d.equip[k] === it) return { doll: d, key: k };
    if ((d.items || []).includes(it)) return { doll: d, key: null };
  }
  return null;
}

// 品質の札 (「品質 72」。高い・低いで色を変える)
export function qualityChip(it, cls = "") {
  const q = qualityOf(it);
  const c = el("span", "rf-q " + qualityTone(q) + (cls ? " " + cls : ""), `品質 ${q}`);
  return c;
}
// 品質の目盛り (0〜100 の棒)
function qualityMeter(q) {
  const w = el("div", "rf-meter " + qualityTone(q));
  const bar = el("div", "rf-meter-bar");
  const fill = el("i", "rf-meter-fill");
  fill.style.width = `${q}%`;
  bar.appendChild(fill);
  const mid = el("i", "rf-meter-mid");
  bar.appendChild(mid);
  w.appendChild(bar);
  w.appendChild(el("span", "rf-meter-n", String(q)));
  return w;
}

// 品の数値の行 (前 → 後)。品質で変わる数値だけを、変わったものから並べる
function diffRows(a, b) {
  const rows = [];
  const pct = (v) => `${Math.round((v || 0) * 1000) / 10}%`;
  const push = (label, x, y, fmt = (v) => String(v)) => {
    if (x === y || (x == null && y == null)) return;
    rows.push({ label, from: fmt(x || 0), to: fmt(y || 0), up: (y || 0) > (x || 0) });
  };
  for (const k of ["atk", "vit", "agi", "int", "pie", "luk"]) push(ATTR_LABEL[k], a[k], b[k]);
  push("HP", a.hp, b.hp);
  push("MP", a.mp, b.mp);
  push("会心", a.crit, b.crit, pct);
  for (const k of Object.keys({ ...(a.scale || {}), ...(b.scale || {}) })) push(`攻撃の係数 ${ATTR_LABEL[k] || k}`, (a.scale || {})[k], (b.scale || {})[k], (v) => `×${Math.round(v * 1000) / 1000}`);
  for (const k of Object.keys({ ...(a.mult || {}), ...(b.mult || {}) })) push(`${ATTR_LABEL[k] || k.toUpperCase()}の補正`, (a.mult || {})[k], (b.mult || {})[k], (v) => `+${Math.round(v * 1000) / 10}%`);
  for (const k of Object.keys({ ...(a.aRes || {}), ...(b.aRes || {}) })) push(`${AIL_LABEL[k] || k}耐性`, (a.aRes || {})[k], (b.aRes || {})[k], pct);
  push("ブレス耐性", a.bRes, b.bRes, pct);
  for (const k of Object.keys({ ...(a.resists || {}), ...(b.resists || {}) })) push(`${RESIST_LABEL[k] || k}の抵抗値`, (a.resists || {})[k], (b.resists || {})[k]);
  return rows;
}
function diffTable(rows) {
  const t = el("div", "rf-diff");
  if (!rows.length) { t.appendChild(el("div", "rf-diff-eq", "数値は変わらない")); return t; }
  for (const r of rows) {
    const row = el("div", "rf-diff-row");
    row.appendChild(el("span", "rf-diff-l", r.label));
    row.appendChild(el("span", "rf-diff-a", r.from));
    row.appendChild(el("span", "rf-diff-arrow", "→"));
    row.appendChild(el("span", "rf-diff-b " + (r.up ? "up" : "dn"), r.to));
    t.appendChild(row);
  }
  return t;
}
// 装備している人業の能力の増減 (いまの装備 → 新しい品質の品に替えた時)
function dollDelta(hold, next) {
  if (!hold || !hold.key || !hold.doll || !hold.doll.base) return null;
  try {
    const d = hold.doll;
    const a = previewStats(d, d.equip);
    const b = previewStats(d, { ...d.equip, [hold.key]: next });
    return statsDelta(a, b);
  } catch (e) { return null; }
}

// 鍛え直しのシート。結果が出たら「新しい品質にする / 元のまま」を選ぶ (閉じれば元のまま)
export function openReforge(item, owner = null, o = {}) {
  if (!item || !hasQuality(item)) return null;
  const st = { pending: null, last: null }; // pending = { q, cost } (引いた結果。まだ品に入れていない)
  const rk = rarityKey(item);
  const accent = rk ? RARITIES[rk].color : "#8a6d2e";
  let h = null;
  const hold = () => holderOf(item) || (owner ? { doll: owner, key: null } : null);

  const build = (b) => {
    const cur = qualityOf(item);
    const where = hold();
    const head = el("div", "rf-head");
    head.appendChild(nameSpan(item, "rf-name"));
    if (where && where.doll) head.appendChild(el("span", "rf-where", where.key ? `${where.doll.name} が装備中（${SLOT_LABEL[where.key] || ""}）` : `${where.doll.name} の持ち物`));
    b.appendChild(head);
    if (!st.pending) {
      const box = el("section", "rf-now");
      box.appendChild(el("div", "rf-k", "いまの品質"));
      box.appendChild(qualityMeter(cur));
      const sl = statLines(item);
      if (sl) box.appendChild(setText(el("div", "rf-stat"), sl));
      b.appendChild(box);
      if (st.last) b.appendChild(el("div", "rf-last " + (!st.last.took ? "kept" : st.last.to > st.last.from ? "took" : "took dn"), st.last.took ? `品質 ${st.last.from} → ${st.last.to} にした` : `品質 ${st.last.to} は選ばず、元の ${st.last.from} のままにした`));
      b.appendChild(setText(el("div", "rf-note"), REFORGE_NOTE));
      b.appendChild(setText(el("div", "rf-note"), "鍛え直すと品質を引き直す。結果を見て、新しい品質にするか元のままにするかを選べる。金貨は引くたびにかかる。"));
      const why = game.reforgeBlock ? game.reforgeBlock(where && where.doll, item, { gold: false }) : null;
      if (why) b.appendChild(el("div", "rf-block", why));
      return;
    }
    const nq = st.pending.q;
    const next = itemAtQuality(item, nq);
    const cmp = el("section", "rf-cmp");
    const big = el("div", "rf-big");
    big.appendChild(qualityChip(item, "big"));
    big.appendChild(el("span", "rf-big-arrow", "→"));
    big.appendChild(el("span", "rf-q big " + qualityTone(nq), `品質 ${nq}`));
    cmp.appendChild(big);
    cmp.appendChild(el("div", "rf-verdict " + (nq > cur ? "up" : nq < cur ? "dn" : "eq"), nq > cur ? `${nq - cur} 上がった` : nq < cur ? `${cur - nq} 下がった` : "同じ品質"));
    cmp.appendChild(diffTable(diffRows(item, next)));
    const dd = dollDelta(where, next);
    if (dd) {
      const line = el("div", "rf-doll");
      line.appendChild(dollIcon(where.doll, 1.5));
      line.appendChild(el("span", "rf-doll-n", `${where.doll.name}の能力`));
      line.appendChild(deltaEl(dd));
      cmp.appendChild(line);
    }
    b.appendChild(cmp);
    b.appendChild(el("div", "rf-note", "どちらにするか選ぶ。閉じると元のままになる。"));
  };

  const footer = () => {
    if (st.pending) {
      const nq = st.pending.q;
      return [
        { label: "新しい品質にする", sub: `品質 ${nq}`, kind: nq >= qualityOf(item) ? "primary" : "secondary", onTap: () => choose(true) },
        { label: "元のまま", sub: `品質 ${qualityOf(item)}`, kind: nq >= qualityOf(item) ? "secondary" : "primary", onTap: () => choose(false) },
      ];
    }
    const where = hold();
    const cost = game.reforgeCost ? game.reforgeCost(item) : 0;
    const why = game.reforgeBlock ? game.reforgeBlock(where && where.doll, item) : "鍛え直せない";
    return [
      { label: "鍛え直す", sub: why || `所持 💰${shortN(G().gold || 0)}`, cost: { kind: "gold", n: cost }, kind: "primary", disabled: !!why, onTap: () => roll() },
      { label: "閉じる", kind: "ghost", onTap: (x) => x.close() },
    ];
  };
  const view = () => ({ body: build, footer: footer() });
  const refresh = () => { if (h && !h.closed) h.update(view()); };

  function roll() {
    const where = hold();
    const res = game.rollReforge ? game.rollReforge(where && where.doll, item) : null;
    if (!res || !res.ok) { refresh(); return; }
    sfx(res.q > qualityOf(item) ? "appraiseOk" : res.q < qualityOf(item) ? "appraiseNg" : "select");
    try { if (game.buzz) game.buzz(12); } catch (e) { /* noop */ }
    st.pending = { q: res.q, cost: res.cost };
    refresh();
  }
  function choose(take) {
    if (!st.pending) return;
    const from = qualityOf(item), to = st.pending.q;
    st.pending = null;
    if (take && to !== from) {
      const where = hold();
      if (game.setItemQuality) game.setItemQuality(where && where.doll, item, to);
      sfx("select");
      toast(`${itemName(item)} ― 品質 ${from} → ${to}`, { tone: to > from ? "good" : "info", noLog: true });
    } else sfx("select");
    st.last = { from, to, took: !!take && to !== from };
    refresh();
    if (o.onDone) o.onDone();
  }

  sfx("select");
  h = sheet.open({
    kind: "info", banner: "鍛え直し", accent, art: item, artScale: 6, ...view(), className: "rf-sheet" + (rk ? " rar-" + rk : ""),
    onClose: () => {
      if (st.pending) { st.pending = null; if (game.log) game.log(`${itemName(item)} は元の品質のままにした。`, "sys"); }
      if (o.onClose) o.onClose();
      if (game.renderTown && G().state === "town") game.renderTown();
    },
  });
  return h;
}

// ---------------------------------------------------------------- 商会の区分「鍛え直し」
// 隊 → 控えの順に、人業ごとの装備品 (装備中 → 持ち物)。未鑑定の品は出さない
function forgeEntries(d) {
  const out = [];
  for (const k of SLOTS) { const it = d.equip && d.equip[k]; if (it && hasQuality(it) && !it.unidentified) out.push({ it, key: k }); }
  for (const it of (d.items || [])) if (it && hasQuality(it) && !it.unidentified) out.push({ it, key: null });
  return out;
}
function forgeRow(x, d, away) {
  const it = x.it;
  const rk = rarityKey(it);
  const row = el("div", "wpc-srow rf-row" + (rk ? " rar-" + rk : ""));
  if (rk) row.style.setProperty("--edge", RARITIES[rk].color);
  const info = el("button", "wpc-srow-info");
  info.type = "button";
  const ic = el("span", "wpc-srow-ic");
  ic.appendChild(spriteCanvas(it, 3));
  info.appendChild(ic);
  const tx = el("span", "wpc-srow-t");
  const l1 = el("span", "wpc-srow-l1");
  l1.appendChild(nameSpan(it, "wpc-srow-nm"));
  tx.appendChild(l1);
  const l3 = el("span", "wpc-srow-l3");
  const matters = qualityMatters(it);
  l3.appendChild(matters ? qualityChip(it) : el("span", "rf-q none", "品質の影響なし"));
  l3.appendChild(el("span", "wpc-srow-kind", x.key ? `装備中 ・ ${SLOT_LABEL[x.key] || ""}` : "持ち物"));
  tx.appendChild(l3);
  info.appendChild(tx);
  const open = () => openReforge(it, d);
  info.addEventListener("click", open);
  row.appendChild(info);
  const act = el("div", "wpc-buy");
  const cost = game.reforgeCost ? game.reforgeCost(it) : 0;
  const short = (G().gold || 0) < cost;
  const main = el("button", "wpc-buy-main" + (short ? " short" : ""));
  main.type = "button";
  main.appendChild(goldEl(shortN(cost), "wpc-buy-p"));
  main.appendChild(el("span", "wpc-buy-l", "鍛え直す"));
  main.disabled = !matters || away;
  main.addEventListener("click", open);
  act.appendChild(main);
  row.appendChild(act);
  return row;
}
// 区分の中身を wrap に描き、一覧を詰める関数を返す (shop.js の render と同じ流儀)
export function renderForgeList(wrap) {
  const dolls = allDolls().filter((d) => d && !d.isEmpty);
  const groups = dolls.map((d) => ({ d, list: forgeEntries(d) })).filter((g) => g.list.length);
  const n = groups.reduce((a, g) => a + g.list.length, 0);
  const intro = el("section", "rf-intro");
  intro.appendChild(setText(el("div", "rf-intro-t"), REFORGE_NOTE));
  intro.appendChild(setText(el("div", "rf-intro-s"), "金貨を払って品質を引き直す。結果を見てから、新しい品質か元のままかを選べる。費用は品の買値。"));
  wrap.appendChild(intro);
  const head = el("div", "wpc-lhead");
  head.appendChild(el("span", "wpc-lhead-t", `装備品 ${n}点`));
  const gs = el("span", "wpc-lhead-s");
  gs.appendChild(glyph("gold"));
  gs.appendChild(document.createTextNode(` ${shortN(G().gold || 0)}`));
  head.appendChild(gs);
  wrap.appendChild(head);
  const box = el("div", "wpc-list rf-list");
  wrap.appendChild(box);
  return () => {
    box.textContent = "";
    if (!n) { box.appendChild(el("div", "wpc-empty big", "鍛え直せる装備品が無い。未鑑定の品は、先に鑑定する。")); return; }
    for (const g of groups) {
      const away = !!(game.expeditionOf && game.expeditionOf(g.d));
      const sec = el("section", "rf-grp" + (isReserve(g.d) ? " reserve" : ""));
      const hd = el("div", "wpc-drow-h");
      hd.appendChild(dollIcon(g.d));
      hd.appendChild(el("span", "wpc-doll-nm", g.d.name));
      if (isReserve(g.d)) hd.appendChild(el("span", "wpc-tag", "控え"));
      if (away) hd.appendChild(el("span", "wpc-tag", "遠征中"));
      sec.appendChild(hd);
      for (const x of g.list) sec.appendChild(forgeRow(x, g.d, away));
      box.appendChild(sec);
    }
  };
}

export function install() {
  registerUI({ openReforge, renderForgeList });
}
