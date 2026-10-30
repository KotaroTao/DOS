// ===== 鍛え直し — 商会で金貨を払い、装備の品質 (0〜100) を引き直す (第五章の結びで開く。2026-10 ユーザーの指示) =====
// 品質のしくみは items.js の「品質」、費用と判定は game.js の reforge* を見る。
//   商会の区分「鍛え直し」: 隊と控えの装備中の品と共有の袋 を並べ、押すと鍛え直しのシート
//   品のシート (loot.js) の「鍛え直し」からも同じシートを開く
// 提供する契約: UI.openReforge(item, owner, { onDone }) / UI.renderForgeList(wrap) → 描く関数
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, toast, setText, DELTA_LABEL } from "./kit.js";
import { statLines, qualityTone } from "./itemview.js";
import { nameSpan, deltaEl, goldEl, dollIcon } from "./loot.js";
import { SLOTS, SLOT_LABEL, AIL_LABEL, hasQuality, qualityOf, qualityMatters, itemAtQuality, QUALITY_SPREAD, itemName } from "../items.js";
import { previewStats, statsDelta } from "../autoequip.js";
import { ATTR_LABEL } from "../souls.js";
import { RESIST_LABEL } from "../resistance.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { spriteCanvas } from "../sprites.js";

const G = () => game.G || {};
const sfx = (k, ...a) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](...a); } catch (e) { /* 音は演出のみ */ } };
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G().party || []), ...(G().reserve || [])]);
const isReserve = (d) => (G().reserve || []).includes(d);
const goldNumber = (n) => Number(n).toLocaleString("ja-JP");
// 商会の再描画でも選択を保つ。セーブや抽選には触れない。
const forgeView = { scope: "all", sort: "low" };
// 「鍛え直し中…」の演出: 鎚を打つ回数と間 (ms)。押せば飛ばして結果へ
const FORGE_STRIKES = 3;
const FORGE_BEAT = 520;
const DOT = "．";
const SPREAD_PCT = Math.round(QUALITY_SPREAD * 100);
export const REFORGE_NOTE = `品質は0〜100。品質50が並品で、0なら性能が${SPREAD_PCT}%下がり、100なら${SPREAD_PCT}%上がる。`;

// 品の持ち主と置き場所 ({ doll, key } — key = 装備の欄、袋の中なら null)
function holderOf(it) {
  for (const d of allDolls()) {
    for (const k of SLOTS) if (d.equip && d.equip[k] === it) return { doll: d, key: k };
  }
  return (G().inventory || []).includes(it) ? { doll: null, key: null } : null;
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
  for (const k of ["crit", "critDamage", "spellCrit", "spellCritDamage"]) push(DELTA_LABEL[k], a[k], b[k], pct);
  for (const k of Object.keys({ ...(a.scale || {}), ...(b.scale || {}) })) push(`攻撃の係数 ${ATTR_LABEL[k] || k}`, (a.scale || {})[k], (b.scale || {})[k], (v) => `×${Math.round(v * 1000) / 1000}`);
  for (const k of Object.keys({ ...(a.mult || {}), ...(b.mult || {}) })) push(`${ATTR_LABEL[k] || k.toUpperCase()}の補正`, (a.mult || {})[k], (b.mult || {})[k], (v) => `+${Math.round(v * 1000) / 10}%`);
  for (const k of Object.keys({ ...(a.aRes || {}), ...(b.aRes || {}) })) push(`${AIL_LABEL[k] || k}耐性`, (a.aRes || {})[k], (b.aRes || {})[k], pct);
  push("ブレス耐性", a.bRes, b.bRes, pct);
  for (const k of Object.keys({ ...(a.resists || {}), ...(b.resists || {}) })) push(`${RESIST_LABEL[k] || k}耐性`, (a.resists || {})[k], (b.resists || {})[k], (v) => `${v}%`);
  return rows;
}
function diffTable(rows) {
  const t = el("div", "rf-diff");
  if (!rows.length) { t.appendChild(el("div", "rf-diff-eq", "数値は変わらない")); return t; }
  const head = el("div", "rf-diff-row rf-diff-head");
  for (const label of ["性能", "元の値", "", "引いた値"]) head.appendChild(el("span", "", label));
  t.appendChild(head);
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

// 鍛え直しのシート。「鍛え直し中…」(鎚の音、押せば飛ばす) の後に結果を出し、
// 「新しい品質にする / もう一度鍛える / 元のまま」を選ぶ (閉じれば元のまま)
export function openReforge(item, owner = null, o = {}) {
  if (!item || !hasQuality(item)) return null;
  // pending = { q, cost } (引いた結果。まだ品に入れていない) / forging = 結果を見せる前の演出の間
  const st = { pending: null, last: null, forging: false, spent: 0 };
  let timer = null, strikes = 0, msgEl = null, stageEl = null;
  const rk = rarityKey(item);
  const accent = rk ? RARITIES[rk].color : "#8a6d2e";
  let h = null;
  const hold = () => holderOf(item) || (owner ? { doll: owner, key: null } : null);

  const build = (b) => {
    const cur = qualityOf(item);
    const where = hold();
    const head = el("div", "rf-head");
    const art = el("span", "rf-item-art");
    art.appendChild(spriteCanvas(item, 2));
    head.appendChild(art);
    head.appendChild(nameSpan(item, "rf-name"));
    if (where && where.doll) head.appendChild(el("span", "rf-where", where.key ? `${where.doll.name} が装備中（${SLOT_LABEL[where.key] || ""}）` : "共有の袋"));
    else head.appendChild(el("span", "rf-where", "共有の袋"));
    b.appendChild(head);
    const funds = el("div", "rf-funds");
    funds.setAttribute("role", "status");
    funds.appendChild(el("span", "", `所持金貨 ${goldNumber(G().gold || 0)}`));
    if (st.spent) funds.appendChild(el("span", "", `今回の支払い ${goldNumber(st.spent)}`));
    b.appendChild(funds);
    if (st.forging) {
      const stage = el("button", "rf-forge");
      stage.type = "button";
      const art = el("span", "rf-forge-art");
      try { art.appendChild(spriteCanvas(item, 5)); } catch (e) { /* 絵は飾り */ }
      stage.appendChild(art);
      msgEl = el("span", "rf-forge-msg", "鍛え直し中" + DOT.repeat(strikes));
      stage.appendChild(msgEl);
      stage.appendChild(el("span", "rf-forge-skip", "押すと結果へ"));
      stage.addEventListener("click", () => reveal());
      stageEl = stage;
      b.appendChild(stage);
      return;
    }
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
      const why = game.reforgeBlock ? game.reforgeBlock(where && where.doll, item) : null;
      if (why) b.appendChild(el("div", "rf-block", why));
      return;
    }
    const nq = st.pending.q;
    const next = itemAtQuality(item, nq);
    const cmp = el("section", "rf-cmp");
    const big = el("div", "rf-big");
    const before = el("div", "rf-quality");
    before.appendChild(el("span", "rf-k", "元の品質"));
    before.appendChild(qualityChip(item, "big"));
    big.appendChild(before);
    big.appendChild(el("span", "rf-big-arrow", "→"));
    const after = el("div", "rf-quality");
    after.appendChild(el("span", "rf-k", "引いた品質"));
    after.appendChild(el("span", "rf-q big " + qualityTone(nq), `品質 ${nq}`));
    big.appendChild(after);
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
    b.appendChild(el("div", "rf-note", "新しい品質にするか、元の品質を残すか選ぶ。閉じても元のまま。支払った金貨は戻らない。"));
  };

  const footer = () => {
    if (st.forging) return [{ label: "結果を見る", sub: "鍛え直し中…を飛ばす", kind: "ghost", onTap: () => reveal() }];
    const where = hold();
    const cost = game.reforgeCost ? game.reforgeCost(item) : 0;
    const why = game.reforgeBlock ? game.reforgeBlock(where && where.doll, item) : "鍛え直せない";
    if (st.pending) {
      const nq = st.pending.q;
      return [
        { label: "新しい品質にする", sub: `品質 ${nq}`, kind: nq >= qualityOf(item) ? "primary" : "secondary", onTap: () => choose(true) },
        { label: "元のまま", sub: `品質 ${qualityOf(item)}`, kind: nq >= qualityOf(item) ? "secondary" : "primary", onTap: () => choose(false) },
        { label: "もう一度鍛える", sub: why || "引いた品質を捨てて、再び金貨を払う", cost: { kind: "gold", n: cost }, kind: "secondary", disabled: !!why, onTap: () => again() },
      ];
    }
    return [
      { label: "鍛え直す", sub: why || `所持 💰${goldNumber(G().gold || 0)}`, cost: { kind: "gold", n: cost }, kind: "primary", disabled: !!why, onTap: () => roll() },
      { label: "閉じる", kind: "ghost", onTap: (x) => x.close() },
    ];
  };
  const view = () => ({ body: build, footer: footer() });
  const refresh = () => { if (h && !h.closed) h.update(view()); };

  // 金貨を払って引く (結果はこの時に決まる) → 「鍛え直し中…」で鎚を打ってから見せる
  function roll() {
    if (st.forging) return;
    const where = hold();
    const res = game.rollReforge ? game.rollReforge(where && where.doll, item) : null;
    if (!res || !res.ok) { refresh(); return; }
    st.pending = { q: res.q, cost: res.cost };
    st.spent += res.cost;
    if (o.onChange) o.onChange();
    st.forging = true;
    strikes = 0;
    refresh();
    clearTimeout(timer);
    timer = setTimeout(strike, 160);
  }
  function strike() {
    if (!st.forging || !h || h.closed) return;
    if (strikes >= FORGE_STRIKES) { reveal(); return; }
    strikes++;
    sfx("forge", strikes);
    try { if (game.buzz) game.buzz(10); } catch (e) { /* noop */ }
    if (msgEl) msgEl.textContent = "鍛え直し中" + DOT.repeat(strikes);
    if (stageEl) { stageEl.classList.remove("hit"); void stageEl.offsetWidth; stageEl.classList.add("hit"); }
    timer = setTimeout(strike, FORGE_BEAT);
  }
  // 演出を終えて (または飛ばして) 結果を見せる
  function reveal() {
    if (!st.forging || !st.pending) return;
    clearTimeout(timer);
    timer = null;
    st.forging = false;
    msgEl = null; stageEl = null;
    const q = st.pending.q, cur = qualityOf(item);
    sfx(q > cur ? "appraiseOk" : q < cur ? "appraiseNg" : "select");
    try { if (game.buzz) game.buzz(12); } catch (e) { /* noop */ }
    refresh();
  }
  // 引いた結果を捨て (品は元の品質のまま)、もう一度引く
  function again() {
    if (!st.pending || st.forging) return;
    // 失敗したら今の候補を保つ (金貨不足などで候補だけ消さない)。
    roll();
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
    kind: "info", banner: "鍛え直し", accent, ...view(), className: "rf-sheet" + (rk ? " rar-" + rk : ""),
    onClose: () => {
      clearTimeout(timer);
      st.forging = false;
      if (st.pending) { st.pending = null; if (game.log) game.log(`${itemName(item)} は元の品質のままにした。`, "sys"); }
      if (o.onClose) o.onClose();
      if (game.renderTown && G().state === "town") game.renderTown();
    },
  });
  return h;
}

// ---------------------------------------------------------------- 商会の区分「鍛え直し」
// 共有の袋は全人業が同じ配列を参照するため、一度だけ集める。
function forgeGroups() {
  const seen = new Set();
  const collect = (it, key) => {
    if (!it || seen.has(it) || !hasQuality(it) || it.unidentified) return null;
    seen.add(it);
    return { it, key };
  };
  const groups = allDolls().filter(d => d && !d.isEmpty).map(d => ({
    d, list: SLOTS.map(k => collect(d.equip && d.equip[k], k)).filter(Boolean),
  }));
  groups.push({ d: null, list: (G().inventory || []).map(it => collect(it, null)).filter(Boolean) });
  return groups;
}
function forgeRow(x, d, refresh) {
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
  l3.appendChild(el("span", "wpc-srow-kind", x.key ? `装備中 ・ ${SLOT_LABEL[x.key] || ""}` : "共有の袋"));
  tx.appendChild(l3);
  info.appendChild(tx);
  const why = game.reforgeBlock ? game.reforgeBlock(d, it) : "鍛え直せない";
  if (why) tx.appendChild(el("span", "rf-row-block", why));
  const open = () => openReforge(it, d, { onDone: refresh, onChange: refresh });
  info.setAttribute("aria-label", `${itemName(it)}の品質と性能を確認`);
  info.addEventListener("click", open);
  row.appendChild(info);
  const act = el("div", "wpc-buy");
  const cost = game.reforgeCost ? game.reforgeCost(it) : 0;
  const short = (G().gold || 0) < cost;
  const main = el("button", "wpc-buy-main" + (short ? " short" : ""));
  main.type = "button";
  main.appendChild(goldEl(goldNumber(cost), "wpc-buy-p"));
  main.appendChild(el("span", "wpc-buy-l", "確認する"));
  // 一覧ではまだ支払わない。制限がある品も詳細で理由を読める。
  main.disabled = !matters;
  main.setAttribute("aria-label", `${itemName(it)}を確認、1回の費用は金貨${goldNumber(cost)}`);
  main.addEventListener("click", open);
  act.appendChild(main);
  row.appendChild(act);
  return row;
}
// 区分の中身を wrap に描き、一覧を詰める関数を返す (shop.js の render と同じ流儀)
export function renderForgeList(wrap) {
  const intro = el("details", "rf-intro rf-guide");
  intro.appendChild(el("summary", "", "鍛え直しの手引き"));
  intro.appendChild(setText(el("div", "rf-intro-t"), REFORGE_NOTE));
  intro.appendChild(setText(el("div", "rf-intro-s"), "品を選び、費用と性能を確認してから鍛える。結果を見て、新しい品質か元のままかを選べる。費用は品の買値（最低100）。引くたびにかかり、元のままでも戻らない。"));
  wrap.appendChild(intro);
  const controls = el("div", "rf-controls");
  const select = (label, key, options) => {
    const field = el("label", "rf-field");
    field.appendChild(el("span", "", label));
    const input = el("select", "rf-select");
    input.setAttribute("aria-label", label);
    for (const [value, name] of options) {
      const op = el("option", "", name); op.value = value; input.appendChild(op);
    }
    if (!options.some(([v]) => v === forgeView[key])) forgeView[key] = options[0][0];
    input.value = forgeView[key];
    input.addEventListener("change", () => { forgeView[key] = input.value; fill(); box.scrollTop = 0; });
    field.appendChild(input); controls.appendChild(field);
  };
  select("対象", "scope", [["all", "すべて"], ["equipped", "装備中"], ["bag", "共有の袋"],
    ...allDolls().filter(d => d && !d.isEmpty).map(d => [`doll:${d.uid}`, `${d.name}${isReserve(d) ? "（控え）" : ""}の装備`])]);
  select("並び順", "sort", [["low", "品質が低い順"], ["high", "品質が高い順"], ["name", "名前順"]]);
  wrap.appendChild(controls);
  const head = el("div", "wpc-lhead");
  const count = el("span", "wpc-lhead-t");
  const gold = el("span", "wpc-lhead-s");
  head.append(count, gold); wrap.appendChild(head);
  const box = el("div", "wpc-list rf-list");
  wrap.appendChild(box);
  function fill() {
    box.textContent = "";
    const groups = forgeGroups();
    const total = groups.reduce((n, g) => n + g.list.length, 0);
    const visible = groups.filter(g => forgeView.scope === "all" ||
      (forgeView.scope === "bag" ? !g.d : forgeView.scope === "equipped" ? !!g.d : `doll:${g.d?.uid}` === forgeView.scope));
    const n = visible.reduce((a, g) => a + g.list.length, 0);
    setText(count, `装備品 ${n} / ${total}点`);
    setText(gold, `所持金貨 ${goldNumber(G().gold || 0)}`);
    if (!n) {
      box.appendChild(el("div", "wpc-empty big", total ? "この対象に鑑定済みの装備品は無い。「対象」を変えると、ほかの品を確認できる。" : "鍛え直せる装備品が無い。未鑑定の品は、先に鑑定する。"));
      return;
    }
    for (const g of visible) {
      if (!g.list.length) continue;
      const sec = el("section", "rf-grp" + (g.d && isReserve(g.d) ? " reserve" : ""));
      const hd = el("div", "wpc-drow-h");
      if (g.d) hd.appendChild(dollIcon(g.d));
      hd.appendChild(el("span", "wpc-doll-nm", g.d ? g.d.name : "共有の袋"));
      if (g.d && isReserve(g.d)) hd.appendChild(el("span", "wpc-tag", "控え"));
      hd.appendChild(el("span", "wpc-doll-cnt", `${g.list.length}点`));
      sec.appendChild(hd);
      g.list.sort((a, b) => forgeView.sort === "name" ? itemName(a.it).localeCompare(itemName(b.it), "ja") :
        (qualityOf(a.it) - qualityOf(b.it)) * (forgeView.sort === "high" ? -1 : 1));
      for (const x of g.list) sec.appendChild(forgeRow(x, g.d, fill));
      box.appendChild(sec);
    }
  }
  return fill;
}

export function install() {
  registerUI({ openReforge, renderForgeList });
}
