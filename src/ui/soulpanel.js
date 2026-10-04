// ===== 魂の区分 — メイン魂・魂を強化/上限まで・残火・付け替え・魂融合・サブ魂・控えの結社 =====
// 担当: WP-B。隊 (party.js) の「魂」区分を描き、魂の操作のシート (付け替え・宿し技・魂融合) を開く。
//   街でだけ魂を付け替え・鍛えられる (迷宮の中では見るだけ = 旧来と同じ制限)。
//   魂を強化/上限まで は ops.trainTimes (単体の鍛錬のループ・同じ費用) を使い、結果は1つのトーストにまとめ、
//   その場で Lv の数字が刻み、強化ボタンの下に「強化の結果」(能力の before→after) が出る。転職・ランクアップは祝祭カード (kit.celebrate)。
// 提供する契約: UI.trainableList() / UI.fusableList() / UI.openFusePicker(uid)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, button, row, sheet, toast, confirm, statDelta, bar, svgIcon, celebrate, longPress } from "./kit.js";
import { countUp } from "./motion.js";
import { showSkillPopup, SPELL_KIND_LABEL } from "./itemview.js";
import {
  SOUL_CLASSES, jobSprite, jobBust, soulByUid, soulRankOf, soulLevelCapOf, emberCostOf, nextRankThreshold, jobRankName, soulSeriesName,
  soulLearnedSkills, soulLearnedPassives, soulLabel, soulRankLeft, passiveName, passiveDesc, ORDER_PERK, PASSIVES, orderPassiveMap, orderPerkLv,
  jobSkillTable, recalcDoll, subPicks, subPickCap, toggleSubPick, subPickIndex,
} from "../souls.js";
import { SPELLS } from "../combat.js";
import { crispCanvas } from "../sprites.js";

const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const RARITY_NAME = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" };
const STAT_L = { hp: "HP", mp: "MP", atk: "ATK", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };

// ドット1つを整数倍で描く (image-rendering: pixelated)
function pixelCanvas(spr, size) {
  // ドットを物理ピクセルの整数倍で描く (入りきらない大きな絵だけ滑らかに縮める)
  const c = crispCanvas(spr, size);
  c.className = "pt-px";
  return c;
}
function orb(clsKey, rank, size = 40) {
  const cl = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const o = el("span", "sp-orb");
  o.style.setProperty("--glow", cl.glow);
  o.appendChild(pixelCanvas(jobBust(clsKey, Math.max(1, rank || 1)), size)); // 魂の珠の中は胸像
  return o;
}

// 魂を鍛える費用の見積り (ops.trainTimes と同じ計算: 1段ごとに soulTrainCost(Lv) - 端数exp、以後 exp=0)
export function trainPlan(e, pts = (G_() || {}).soulPts || 0, max = Infinity) {
  if (!e) return { n: 0, cost: 0, to: 0, next: 0 };
  const cap = soulLevelCapOf(e);
  const costOf = (lv) => (game.soulTrainCost ? game.soulTrainCost(lv) : Math.max(1, Math.round(40 * Math.pow(1.13, (lv || 1) - 1))));
  let lv = e.level, cost = 0, n = 0, left = pts;
  const next = e.level < cap ? Math.max(1, costOf(e.level) - (e.exp || 0)) : 0;
  while (lv < cap && n < max) {
    const c = Math.max(1, costOf(lv) - (n === 0 ? (e.exp || 0) : 0));
    if (left < c) break;
    left -= c; cost += c; lv++; n++;
  }
  return { n, cost, to: lv, next, cap };
}

// 魂を強化 (n = Infinity で上限まで)。結果は1つのトースト + その場の演出 (Lv が刻み、能力の変化を並べる)
export function train(uid, n = 1) {
  const r = ops.trainTimes ? ops.trainTimes(uid, n) : null;
  if (!r || !r.ok) return r;
  // 続けて強化したら、最初の値からの変化にまとめる
  const now = Date.now();
  const keep = lastTrain && lastTrain.uid === uid && now - lastTrain.at < RESULT_MS;
  lastTrain = { uid, at: now, from: keep ? lastTrain.from : r.from, to: r.to,
    before: keep ? lastTrain.before : (r.before || {}), after: r.after || {} };
  requestAnimationFrame(() => {
    const lv = document.querySelector(`[data-sp-lv="${uid}"]`);
    if (lv) countUp(lv, r.from, r.to, 420);
    const card = document.querySelector(`.sp-card[data-uid="${uid}"]`);
    if (card) attachTrainResult(card, uid, true);
  });
  if (r.wearer && r.gainedSkills && r.gainedSkills.length) toastNewSkills(r.wearer, r.gainedSkills);
  return r;
}

// ---- 強化の結果 (能力がどう変わったか) ----
// 強化ボタンの下に重ねて出す (レイアウトを押し広げない = 縦スクロールを生まない)。数秒で消え、タップでも閉じる
const RESULT_MS = 5000;
const RESULT_KEYS = ["hp", "mp", "atk", "vit", "agi", "int", "pie", "luk"];
let lastTrain = null;
function attachTrainResult(card, uid, fresh) {
  const t = lastTrain;
  if (!t || t.uid !== uid) return;
  const left = RESULT_MS - (Date.now() - t.at);
  if (left <= 0) return;
  const anchor = card.querySelector(".sp-acts, .sp-note");
  if (!anchor) return;
  const old = anchor.querySelector(".sp-res");
  if (old) old.remove();
  anchor.classList.add("sp-res-anchor");
  const box = el("div", "sp-res" + (fresh ? " fresh" : ""));
  box.setAttribute("role", "status");
  const hd = el("div", "sp-res-h");
  hd.appendChild(el("span", "sp-res-k", "強化の結果"));
  hd.appendChild(el("span", "sp-res-lv", `Lv${t.from} → ${t.to}`));
  box.appendChild(hd);
  const grid = el("div", "sp-res-g");
  let any = false;
  for (const k of RESULT_KEYS) {
    const a = t.before[k], b = t.after[k];
    if (a == null || b == null || a === b) continue;
    any = true;
    const c = el("div", "sp-res-s " + (b > a ? "up" : "dn"));
    c.appendChild(el("span", "sp-res-n", STAT_L[k] || k));
    c.appendChild(el("span", "sp-res-v", `${a}→${b}`));
    c.appendChild(el("span", "sp-res-d", `${b > a ? "+" : ""}${b - a}`));
    grid.appendChild(c);
  }
  if (!any) grid.appendChild(el("div", "sp-res-none", "能力の変化なし"));
  box.appendChild(grid);
  const close = () => {
    if (!box.isConnected || box.classList.contains("out")) return;
    box.classList.add("out");
    setTimeout(() => box.remove(), 260);
  };
  box.addEventListener("click", () => { lastTrain = null; close(); });
  setTimeout(close, left);
  anchor.appendChild(box);
}

// 新たな技のお知らせ (トースト。「見る」でくわしく)
// 新たな技のお知らせ (いくつ覚えてもトースト1つ。「見る」で1つならその技、複数なら一覧)
export function toastNewSkills(d, keys) {
  const ks = (keys || []).filter((k) => SPELLS[k]);
  if (!ks.length) return;
  const names = ks.map((k) => `「${SPELLS[k].name}」`).join("");
  const open = () => {
    if (ks.length === 1) { showSkillPopup(ks[0]); return; }
    sheet.open({
      kind: "info", banner: "新たな技", paged: false, title: d ? `${d.name} が目覚めた技` : "目覚めた技", className: "sp-pick-sheet",
      body: (scroll) => {
        const list = el("div", "pt-list");
        for (const k of ks) {
          const sp = SPELLS[k];
          list.appendChild(row({ title: sp.name, sub: `${SPELL_KIND_LABEL[sp.kind] || ""} ・ MP${sp.mp} ・ ${sp.desc || ""}`, chevron: true, onTap: () => showSkillPopup(k) }));
        }
        scroll.appendChild(list);
      },
      footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
    });
  };
  toast(`${d ? d.name + " ― " : ""}新たな技${names}`, { tone: "gold", action: { label: "見る", fn: open } });
}

// ================= 魂の区分 =================
export function renderSoulSeg(root, d, ctx = {}) {
  const town = ctx.mode === "town";
  const pe = d.primary != null ? soulByUid(d.primary) : null;
  root.appendChild(mainCard(d, pe, town));
  if (!pe) return;
  // 付け替え・魂融合 (1行に並べる)
  const acts = el("div", "sp-row2");
  if (town) {
    const ch = el("button", "sp-btn");
    ch.type = "button";
    ch.appendChild(svgSoul());
    const t = el("span", "sp-btn-t");
    t.appendChild(el("span", "sp-btn-l", "魂を付け替える"));
    t.appendChild(el("span", "sp-btn-s", "持っている魂から選ぶ"));
    ch.appendChild(t);
    ch.addEventListener("click", () => openSoulPicker(d, "primary"));
    ch.classList.add("sp-change");
    acts.appendChild(ch);
  }
  const fz = fuseButton(pe, town);
  if (fz) acts.appendChild(fz);
  if (acts.childElementCount) root.appendChild(acts);
  // サブ魂 + 控えの結社 (タイルを横に並べる)
  const more = el("div", "sp-more");
  subTiles(more, d, town);
  more.appendChild(orderTile(town));
  root.appendChild(more);
  if (!town) root.appendChild(el("div", "pt-note c", "魂の付け替え・強化は、街へ戻ってから。"));
}
function svgSoul() {
  const s = el("span", "sp-ic");
  s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 3.2 5 6 5 9a5 5 0 0 1-10 0c0-1.6.6-3 1.6-4.2.2 1.4 1 2.4 2.1 2.8C10 8.4 10.6 5.6 12 3Z"/><path d="M7 20h10"/></svg>';
  return s;
}

function mainCard(d, pe, town) {
  const G = G_();
  const card = el("section", "sp-card");
  if (!pe) {
    card.classList.add("empty");
    card.appendChild(el("div", "sp-empty-t", "メイン魂が宿っていない"));
    card.appendChild(el("div", "sp-empty-s", "魂を宿せば、職業・能力・技が定まり、パーティに加えられる。"));
    if (town) card.appendChild(button({ label: "魂を宿す", kind: "primary", onTap: () => openSoulPicker(d, "primary") }));
    return card;
  }
  const cl = SOUL_CLASSES[pe.clsKey] || SOUL_CLASSES.fighter;
  const rank = soulRankOf(pe);
  const cap = soulLevelCapOf(pe);
  card.dataset.uid = String(pe.uid);
  card.style.setProperty("--glow", cl.glow);
  // 見出し: 宝珠 + 名 + ランク/称号 + Lv
  const head = el("div", "sp-head");
  head.appendChild(orb(pe.clsKey, rank, 40));
  const tx = el("div", "sp-head-tx");
  const nm = el("div", "sp-name");
  const nmT = el("span", null, `${soulLabel(pe)}`);
  nmT.style.color = cl.glow;
  nm.appendChild(nmT);
  if (soulRankLeft(pe)) nm.appendChild(el("span", "sp-left", soulRankLeft(pe)));
  nm.appendChild(el("span", "sp-card-k", "メイン魂"));
  tx.appendChild(nm);
  const meta = el("div", "sp-meta");
  meta.appendChild(el("span", "sp-rank", `ランク${rank}`));
  meta.appendChild(el("span", "sp-title", `「${jobRankName(pe.clsKey, rank)}」`));
  meta.appendChild(el("span", "sp-rar r-" + cl.rarity, RARITY_NAME[cl.rarity] || ""));
  tx.appendChild(meta);
  head.appendChild(tx);
  const lvN = el("span", "sp-lv-n");
  lvN.appendChild(el("span", "sp-lv-k", "Lv"));
  const cur = el("b", null, String(pe.level));
  cur.dataset.spLv = String(pe.uid);
  lvN.appendChild(cur);
  lvN.appendChild(el("span", "sp-lv-cap", `/${cap}`));
  head.appendChild(lvN);
  card.appendChild(head);

  // 次の段までの ✦
  const need = game.soulTrainCost ? game.soulTrainCost(pe.level) : 0;
  const prog = el("div", "sp-prog sp-lv");
  if (pe.level < cap) {
    prog.appendChild(bar(Math.min(need, pe.exp || 0), need, { tone: "soul" }));
    prog.appendChild(el("span", "sp-prog-v", `✦${pe.exp || 0} / ${need}`));
  } else {
    prog.appendChild(bar(1, 1, { tone: "gold" }));
    prog.appendChild(el("span", "sp-prog-v cap", "上限"));
  }
  card.appendChild(prog);

  if (town) {
    if (pe.level < cap) {
      const plan = trainPlan(pe);
      const acts = el("div", "sp-acts");
      acts.appendChild(button({ label: "魂を強化", sub: `Lv${pe.level} → ${pe.level + 1}`, kind: "primary", cost: { kind: "soul", n: plan.next },
        disabled: (G.soulPts || 0) < plan.next, onTap: () => train(pe.uid, 1) }));
      if (plan.n >= 2) {
        acts.appendChild(button({ label: plan.to >= cap ? "上限まで" : "まとめて", sub: `→ Lv${plan.to}`, kind: "secondary",
          cost: { kind: "soul", n: plan.cost }, onTap: () => train(pe.uid, Infinity) }));
      } else if ((G.soulPts || 0) < plan.next) {
        acts.appendChild(el("div", "sp-short", `✦があと ${plan.next - (G.soulPts || 0)} 足りない ― 迷宮で敵を倒すと得られる`));
      }
      card.appendChild(acts);
    } else {
      const nx = nextRankThreshold(pe.clsKey, pe.count);
      card.appendChild(el("div", "sp-note", nx
        ? `Lv上限。同じ${cl.label}の魂をあと ${nx.next - pe.count} 体ぶん魂融合してランク${rank + 1}になると上限が伸びる。${pe.exp > 0 ? `（蓄積 ✦${pe.exp}）` : ""}`
        : "最高ランク。これ以上、ランクでは上限が伸びない。"));
    }
  }

  // 次の技・次のランク・残火 (1行)
  const foot = el("div", "sp-next");
  const nxSkill = jobSkillTable(pe.clsKey).find((t) => t.skill && t.lvl > pe.level && SPELLS[t.skill]);
  if (nxSkill) {
    const b = el("button", "sp-next-sk");
    b.type = "button";
    b.appendChild(el("span", "sp-next-k", "次の技"));
    b.appendChild(el("span", "sp-next-v", `Lv${nxSkill.lvl}「${SPELLS[nxSkill.skill].name}」`));
    b.addEventListener("click", () => showSkillPopup(nxSkill.skill));
    foot.appendChild(b);
  }
  const nr = nextRankThreshold(pe.clsKey, pe.count);
  if (nr) {
    const r = el("span", "sp-next-rank");
    r.appendChild(el("span", "sp-next-k", `ランク${rank + 1}まで`));
    r.appendChild(el("span", "sp-next-v", `魂 ${pe.count - nr.prev}/${nr.next - nr.prev}`));
    foot.appendChild(r);
  }
  if (town && ((G.embers || 0) > 0 || pe.level >= cap)) {
    const need = emberCostOf(pe.clsKey);
    const em = button({ label: `残火 ${G.embers || 0}`, sub: `上限 +1${pe.capBonus ? `（済 +${pe.capBonus}）` : ""}`, kind: "secondary", size: "sm",
      cost: { kind: "ember", n: need }, disabled: (G.embers || 0) < need, onTap: () => confirmRaiseCap(pe) });
    em.classList.add("sp-ember-b");
    foot.appendChild(em);
  }
  if (foot.childElementCount) card.appendChild(foot);
  if (town && lastTrain && lastTrain.uid === pe.uid) attachTrainResult(card, pe.uid, false);
  return card;
}

// 残火でLv上限を上げる前の確認 (残火は貴重なので、押し間違いで捧げないように)
function confirmRaiseCap(pe) {
  const G = G_();
  const have = G.embers || 0;
  const need = emberCostOf(pe.clsKey);
  if (!game.raiseSoulCap) return;
  if (have < need) { game.raiseSoulCap(pe.uid); return; }
  const cap = soulLevelCapOf(pe);
  sfx("select");
  confirm({
    banner: "魂の残火", danger: false,
    title: `残火を${need}つ捧げ、${soulLabel(pe)}のLv上限を上げますか？`,
    lines: [`Lv上限 ${cap} → ${cap + 1}`, `残火 ${have} → ${have - need}`, "要る残火は職業のレア度で変わる (コモン1・レア2・エピック3・レジェンド5)。", "捧げた残火は戻らない。"],
    okLabel: "捧げる",
  }).then((y) => { if (y) game.raiseSoulCap(pe.uid); });
}

// 同じ魂が余っている → 魂融合 (付け替えの隣のボタン)
function fuseButton(pe, town) {
  const G = G_();
  const worn = (uid) => allDolls().some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const spare = G.souls.filter((s) => s.uid !== pe.uid && s.clsKey === pe.clsKey && !worn(s.uid) && !s.locked);
  if (!spare.length) return null;
  const open = game.featureUnlocked ? game.featureUnlocked("fusion") : false;
  const b = el("button", "sp-btn sp-fuse" + (open ? " hot" : " locked"));
  b.type = "button";
  const t = el("span", "sp-btn-t");
  t.appendChild(el("span", "sp-btn-l", `魂融合 ×${spare.length}`));
  t.appendChild(el("span", "sp-btn-s", open ? "同じ魂が余っている" : "5 迷宮の踏破報告で開く"));
  b.appendChild(t);
  if (!open || !town) b.disabled = true;
  b.addEventListener("click", () => openFusePicker(pe.uid));
  return b;
}

// ---- サブ魂 (宿し技) のタイル ----
function subTiles(more, d, town) {
  const n = game.unlockedSubSlots ? game.unlockedSubSlots() : 0;
  if (!n) {
    const c = game.reportedDungeonCount ? game.reportedDungeonCount() : 0;
    more.appendChild(lockedTile("サブ魂", `10 迷宮の踏破報告で開く (${c}/10)`));
    return;
  }
  for (let i = 0; i < n; i++) {
    const sub = (d.subs || [])[i] || null;
    const se = sub ? soulByUid(sub.uid) : null;
    const tile = el("div", "sp-tile sp-sub" + (se ? "" : " empty"));
    const main = el(town ? "button" : "div", "sp-tile-main");
    if (town) main.type = "button";
    main.appendChild(el("span", "sp-tile-k", `サブ魂${i + 1}`));
    if (se) {
      const rank = soulRankOf(se);
      tile.style.setProperty("--glow", (SOUL_CLASSES[se.clsKey] || {}).glow || "#c9a24a");
      const r = el("span", "sp-tile-r");
      r.appendChild(orb(se.clsKey, rank, 28));
      const tx = el("span", "sp-tile-tx");
      tx.appendChild(el("span", "sp-tile-n", `${jobRankName(se.clsKey, rank)} Lv${se.level}`));
      tx.appendChild(el("span", "sp-tile-s", borrowLabel(sub, se)));
      r.appendChild(tx);
      main.appendChild(r);
    } else {
      main.appendChild(el("span", "sp-tile-s", town ? "＋ 魂を宿す" : "空き"));
    }
    if (town) main.addEventListener("click", () => openSoulPicker(d, "sub" + i));
    tile.appendChild(main);
    if (se && town) {
      const sk = el("button", "sp-tile-sk", "技");
      sk.type = "button";
      sk.setAttribute("aria-label", "借りる技を選ぶ");
      sk.addEventListener("click", () => openSkillStep(d, sub));
      tile.appendChild(sk);
    }
    more.appendChild(tile);
  }
}
// サブ魂タイルの借用表示 (「借 2/3 名A・名B」)。効いている分 (覚えていて上限内) だけ数える
function borrowLabel(sub, se) {
  const cap = subPickCap(se);
  const lp = soulLearnedPassives(se);
  const learned = soulLearnedSkills(se);
  const names = subPicks(sub).filter((p) => (p.passive ? lp[p.passive] : learned.includes(p.skill))).slice(0, cap)
    .map((p) => (p.passive ? passiveName(p.passive, lp[p.passive] || 1) : SPELLS[p.skill] ? SPELLS[p.skill].name : p.skill));
  if (!names.length) return `技を選ぶ (${cap}つまで)`;
  return `借 ${names.length}/${cap} ${names.join("・")}`;
}
function lockedTile(k, text) {
  const t = el("div", "sp-tile locked");
  const m = el("div", "sp-tile-main");
  m.appendChild(el("span", "sp-tile-k", k));
  const s = el("span", "sp-tile-s");
  s.appendChild(svgIcon("chain", "sp-lock-ic"));
  s.appendChild(document.createTextNode(text));
  m.appendChild(s);
  t.appendChild(m);
  return t;
}

// ---- 控えの結社: タイル (席の数・発動中の加護) → シート ----
function orderTile(town) {
  const open = game.featureUnlocked ? game.featureUnlocked("order") : false;
  if (!open) {
    const c = game.reportedDungeonCount ? game.reportedDungeonCount() : 0;
    return lockedTile("控えの結社", `20 迷宮の踏破報告で開く (${c}/20)`);
  }
  const G = G_();
  const seats = game.orderSeats ? game.orderSeats() : 0;
  const seated = game.orderSeatedUids ? game.orderSeatedUids() : [];
  const activeMap = orderPassiveMap(G.party, seated);
  const parts = Object.entries(activeMap).map(([p, lv]) => passiveName(p, lv));
  const t = el("div", "sp-tile sp-order");
  const m = el("button", "sp-tile-main");
  m.type = "button";
  m.appendChild(el("span", "sp-tile-k", `控えの結社 ・ 席 ${seated.length}/${seats}`));
  m.appendChild(el("span", "sp-tile-s", parts.length ? `加護: ${parts.join("・")}` : "パーティに出していない魂を席に着ける"));
  m.addEventListener("click", () => openOrderSheet(town));
  t.appendChild(m);
  return t;
}
export function openOrderSheet(town = true) {
  if (UI.tutorialEvent) UI.tutorialEvent("order"); // 手ほどき「控えの結社」: 結社を開いた
  let h = null;
  h = sheet.open({
    kind: "info", banner: "控えの結社", className: "sp-pick-sheet", paged: false,
    body: (scroll) => orderBody(scroll, town, () => h && h.update({})),
  });
  return h;
}
function orderBody(root, town, again) {
  const G = G_();
  const fielded = new Set();
  for (const dd of G.party) { if (dd.primary != null) fielded.add(dd.primary); for (const s of (dd.subs || [])) if (s) fielded.add(s.uid); }
  const benched = G.souls.filter((s) => !fielded.has(s.uid) && soulRankOf(s) >= 2).sort(game.soulSortCmp || (() => 0));
  const seats = game.orderSeats ? game.orderSeats() : 0;
  const seated = game.orderSeatedUids ? game.orderSeatedUids() : [];
  const seatedSet = new Set(seated);
  const full = seated.length >= seats;
  const nextSeatAt = seats >= 3 ? null : seats >= 2 ? 45 : seats >= 1 ? 30 : 20;
  const info = el("div", "sp-order-info");
  info.appendChild(el("span", "sp-order-seats", `席 ${seated.length} / ${seats}`));
  if (nextSeatAt) info.appendChild(el("span", "pt-note", `次の席は ${nextSeatAt} 迷宮の踏破報告で`));
  root.appendChild(info);
  const activeMap = orderPassiveMap(G.party, seated);
  if (seated.length) {
    const parts = Object.entries(activeMap).map(([p, lv]) => passiveName(p, lv));
    root.appendChild(el("div", "sp-order-on", `発動中の加護: ${parts.length ? parts.join("・") : "なし"}`));
  }
  if (!benched.length) {
    root.appendChild(el("div", "pt-note", "パーティに出していない魂をランク2以上に育てると、席に着けてパーティ全体の加護を授けられる。同じ加護は最も高いLvだけが効く。"));
    return;
  }
  const perkOf = (s) => ORDER_PERK[s.clsKey] || "";
  const perkLvOf = (s) => { const p = perkOf(s); return p && PASSIVES[p] ? Math.min(PASSIVES[p].lv.length, orderPerkLv(soulRankOf(s))) : 0; };
  const provider = {};
  for (const uid of seated) {
    const s = soulByUid(uid); if (!s) continue;
    const p = perkOf(s);
    if (p && perkLvOf(s) === activeMap[p] && provider[p] == null) provider[p] = uid;
  }
  const sorted = benched.slice().sort((a, b) =>
    (seatedSet.has(b.uid) ? 1 : 0) - (seatedSet.has(a.uid) ? 1 : 0) || perkOf(a).localeCompare(perkOf(b)) || soulRankOf(b) - soulRankOf(a));
  const list = el("div", "pt-list");
  for (const s of sorted) {
    const perk = perkOf(s);
    if (!perk || !PASSIVES[perk]) continue;
    const rank = soulRankOf(s);
    const lv = perkLvOf(s);
    const isSeated = seatedSet.has(s.uid);
    const redundant = isSeated && provider[perk] !== s.uid;
    const sub = el("span", "ui-row-sub", `${passiveName(perk, lv)}: ${passiveDesc(perk, lv)}${redundant ? " ― 同じ加護を上位の席が供給中" : ""}`);
    const right = town ? button({ label: isSeated ? "外す" : "着席", kind: isSeated ? "ghost" : "primary", size: "sm", disabled: !isSeated && full,
      onTap: (e) => { if (e) e.stopPropagation(); if (game.toggleOrderSeat) game.toggleOrderSeat(s.uid); again(); } }) : (isSeated ? "着席中" : "");
    const r = row({ icon: orb(s.clsKey, rank, 32), title: `${jobRankName(s.clsKey, rank)}（R${rank}）${isSeated ? " ・ 着席中" : ""}`, sub, right });
    r.classList.add("sp-orow");
    if (isSeated) r.classList.add(redundant ? "redundant" : "seated");
    list.appendChild(r);
  }
  root.appendChild(list);
}


// ================= 魂を宿す (シート) =================
// slotId: "primary" | "sub0" | "sub1"。能力の増減を見比べて選ぶ。魂融合もここから
export function openSoulPicker(d, slotId = "primary") {
  const G = G_();
  if (!G || G.state !== "town" || !d) return null;
  const isSub = slotId !== "primary";
  const si = isSub ? +slotId.slice(3) : -1;
  sfx("select");
  return sheet.open({
    kind: "info", className: "sp-pick-sheet", paged: false, // 魂の選択は縦スクロールで1ページに
    banner: isSub ? `サブ魂${si + 1} ― ${d.name}` : `メイン魂 ― ${d.name}`,
    lines: [isSub ? "サブ魂は、覚えた技かパッシブを貸し、能力の一部を足す (R1 10% 〜 R5 30%)。貸す数も魂のランクで増える (R1-2:1 / R3-4:2 / R5:3)。" : "メイン魂が、職業・能力・技を決める。"],
    body: (scroll, h) => pickerBody(scroll, d, slotId, h),
  });
}
function wearerOf(uid, self) {
  for (const dd of allDolls()) {
    if (dd === self) continue;
    if (dd.primary === uid || (dd.subs || []).some((s) => s && s.uid === uid)) return dd;
  }
  return null;
}
// 器の写しに手を加えて能力を計算し直す (実体は書き換えない)。apply(fake) で魂の差し替えを行う。
// 返り値: { from, to } (能力の前後) / 計算できなければ null
const DOLL_STATS = { hp: "maxhp", mp: "maxmp", atk: "atk", vit: "vit", agi: "agi", int: "int", pie: "pie", luk: "luk" };
function statsOfDoll(x) { const o = {}; for (const k in DOLL_STATS) o[k] = x[DOLL_STATS[k]] || 0; return o; }
function previewDoll(dd, apply) {
  const fake = { ...dd, base: { ...dd.base }, subs: (dd.subs || []).map((s) => (s ? { ...s, picks: subPicks(s).map((p) => ({ ...p })) } : s)), spells: [], passives: [] };
  apply(fake);
  try { recalcDoll(fake); } catch (e) { return null; }
  return { from: statsOfDoll(dd), to: statsOfDoll(fake) };
}
// 魂 uid を d の slotId (primary / subN) に宿したときの差し替え
function placeSoul(fake, slotId, uid) {
  if (slotId === "primary") {
    fake.primary = uid;
    fake.subs = fake.subs.filter((x) => x && x.uid !== uid);
  } else {
    const i = +slotId.slice(3);
    if (fake.primary === uid) fake.primary = null;
    const keep = fake.subs.filter((x) => x && x.uid !== uid);
    keep[i] = { uid, picks: [] };
    fake.subs = keep.filter(Boolean);
  }
}
// 魂を宿したら、能力がどう変わるか (差分)
function previewSoul(d, slotId, uid) {
  const r = previewDoll(d, (f) => placeSoul(f, slotId, uid));
  if (!r) return null;
  const o = {};
  for (const k in r.to) o[k] = r.to[k] - r.from[k];
  return o;
}
// サブ魂を宿す前の確かめ: 宿す人業と、交換になる相手の人業の能力の変化を並べ、承認されたら宿す
// subTaker: いまその魂をサブ魂に宿している別の人業 (交換・付け替え) / cur: d がこの差し口に宿している魂
function confirmSubEquip(d, slotId, s, subTaker, cur) {
  const si = +slotId.slice(3);
  const nm = `${soulLabel(s)}`;
  const body = el("div", "sp-eqc");
  const mine = previewDoll(d, (f) => placeSoul(f, slotId, s.uid));
  if (mine) body.appendChild(fuseStats({ statsOf: d.name, statsFrom: mine.from, statsTo: mine.to }, "能力は変わらない"));
  let lines;
  if (subTaker) {
    // 相手は、その魂の差し口に d が宿していた魂を受け取る (無ければ空く)
    const theirs = previewDoll(subTaker, (f) => {
      const i = f.subs.findIndex((x) => x && x.uid === s.uid);
      if (i < 0) return;
      if (cur) f.subs[i] = { uid: cur.uid, picks: [] };
      else f.subs.splice(i, 1);
    });
    if (theirs) body.appendChild(fuseStats({ statsOf: subTaker.name, statsFrom: theirs.from, statsTo: theirs.to }, "能力は変わらない"));
    lines = [`${subTaker.name} のサブ魂「${nm}」を外し、${d.name} のサブ魂${si + 1}に宿す。`,
      cur ? `${d.name} が宿していた「${soulLabel(cur)}」は、${subTaker.name} のサブ魂に移る (交換)。` : `${subTaker.name} のサブ魂は1つ空く。`];
  } else {
    lines = [cur ? `サブ魂${si + 1}の「${soulLabel(cur)}」を外し、「${nm}」を宿す。` : `「${nm}」を ${d.name} のサブ魂${si + 1}に宿す。`];
  }
  lines.push("借りる技・パッシブは、宿したあとに選ぶ。");
  return confirm({
    banner: "サブ魂", title: subTaker ? (cur ? "サブ魂を交換する？" : "サブ魂を付け替える？") : "このサブ魂を宿す？",
    lines, body, className: "sp-eqc-sheet", okLabel: subTaker && cur ? "交換する" : "宿す", danger: false,
  });
}
function pickerBody(root, d, slotId, h) {
  const G = G_();
  const isSub = slotId !== "primary";
  const si = isSub ? +slotId.slice(3) : -1;
  const curUid = isSub ? ((d.subs || [])[si] || {}).uid : d.primary;
  const fusion = game.featureUnlocked ? game.featureUnlocked("fusion") : false;
  const souls = [...G.souls].sort(game.soulSortCmp || (() => 0));
  // サブ魂の差し口では、メイン魂に宿している魂 (自分のものも含む) は選べない。
  // 他の人業のサブ魂は選べる (確認のうえ付け替え。宿していた魂とは交換)
  const isMainOf = (uid) => allDolls().find((dd) => dd.primary === uid) || null;
  const subOf = (uid) => (isSub ? allDolls().find((dd) => dd !== d && (dd.subs || []).some((x) => x && x.uid === uid)) || null : null);
  const order = (s) => (s.uid === curUid ? 0 : (wearerOf(s.uid, d) && !subOf(s.uid)) || (isSub && d.primary === s.uid) ? 3 : subOf(s.uid) ? 2 : 1);
  souls.sort((a, b) => order(a) - order(b));
  const list = el("div", "pt-list sp-plist");
  for (const s of souls) {
    const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
    const rank = soulRankOf(s);
    const cap = soulLevelCapOf(s);
    const isCur = s.uid === curUid;
    const mainOf = isSub && !isCur ? isMainOf(s.uid) : null; // サブ魂の差し口: メイン魂は選べない
    const subTaker = !isCur && !mainOf ? subOf(s.uid) : null; // 他の人業のサブ魂 (付け替え・交換)
    const other = mainOf || (subTaker ? null : wearerOf(s.uid, d));
    const inOther = !isCur && !mainOf && (d.primary === s.uid || (d.subs || []).some((x) => x && x.uid === s.uid));
    const r = el("div", "sp-srow" + (isCur ? " cur" : "") + (other ? " taken" : "") + (subTaker ? " swap" : ""));
    r.style.setProperty("--glow", cl.glow);
    const main = el("button", "sp-srow-main");
    main.type = "button";
    main.appendChild(orb(s.clsKey, rank, 36));
    const tx = el("span", "sp-srow-t");
    const nm = el("span", "sp-srow-n", `${soulLabel(s)}`);
    nm.style.color = cl.glow;
    if (soulRankLeft(s)) nm.appendChild(el("span", "sp-left", soulRankLeft(s)));
    if (s.locked) nm.appendChild(svgIcon("lock", "sp-srow-lk"));
    tx.appendChild(nm);
    tx.appendChild(el("span", "sp-srow-m", `Lv${s.level}/${cap} ・ ランク${rank} ・ ${RARITY_NAME[cl.rarity] || ""}`));
    if (isCur) tx.appendChild(el("span", "sp-srow-tag cur", isSub ? "このサブ魂に宿している" : "宿している"));
    else if (mainOf) tx.appendChild(el("span", "sp-srow-tag", mainOf === d ? "メイン魂に宿している" : `${mainOf.name} がメイン魂に宿している`));
    else if (other) tx.appendChild(el("span", "sp-srow-tag", `${other.name} が宿している`));
    else if (subTaker) {
      tx.appendChild(el("span", "sp-srow-tag swap", `${subTaker.name} のサブ魂 ― 選ぶと${curUid != null ? "交換" : "付け替え"}`));
      const dl = previewSoul(d, slotId, s.uid);
      if (dl) tx.appendChild(statDelta(dl));
    } else {
      if (inOther) tx.appendChild(el("span", "sp-srow-tag", isSub ? "メイン魂/別のサブ魂から移す" : "サブ魂から移す"));
      const dl = previewSoul(d, slotId, s.uid);
      if (dl) tx.appendChild(statDelta(dl));
    }
    main.appendChild(tx);
    if (other || isCur) main.disabled = !!other;
    main.addEventListener("click", () => {
      if (isCur || other) return;
      const go = (opts) => game.equipSoulToSlot(d, s.uid, slotId, (applied) => {
        if (!applied) return;
        h.close();
        if (isSub) {
          const sub = (d.subs || []).find((x) => x && x.uid === s.uid);
          if (sub) openSkillStep(d, sub);
        }
      }, opts);
      if (!isSub) { go(); return; }
      // サブ魂: 能力の変化 (交換になる相手の分も) を見せ、承認されたら宿す
      const cur = curUid != null ? soulByUid(curUid) : null;
      confirmSubEquip(d, slotId, s, subTaker, cur).then((y) => { if (y) go(subTaker ? { take: true } : undefined); });
    });
    r.appendChild(main);
    const side = el("div", "sp-srow-side");
    if (isCur) {
      side.appendChild(button({ label: "外す", kind: "ghost", size: "sm", onTap: () => {
        const go = () => game.equipSoulToSlot(d, s.uid, slotId, (applied) => { if (applied) h.close(); });
        if (!isSub) confirm({ title: `${d.name} からメイン魂を外す？`, lines: ["魂の宿らない器は、パーティで戦えない。"], okLabel: "外す" }).then((y) => { if (y) go(); });
        else go();
      } }));
    }
    if (fusion) {
      const n = game.fuseCandidates ? game.fuseCandidates(s.uid).length : 0;
      if (n) side.appendChild(button({ label: `魂融合 ${n}`, kind: "secondary", size: "sm", onTap: () => openFusePicker(s.uid, () => refreshSheet(h)) }));
    }
    if (game.toggleSoulLock) {
      const lk = button({ icon: s.locked ? "lock" : "unlock", label: s.locked ? "ロック中" : "ロック", kind: s.locked ? "secondary" : "ghost", size: "sm",
        title: s.locked ? "ロックを外す" : "魂融合の素材にできないようにする",
        onTap: (e) => {
          if (e) e.stopPropagation();
          const on = game.toggleSoulLock(s.uid);
          sfx("select");
          toast(on ? `${soulLabel(s)}をロックした ― 魂融合の素材にならない` : `${soulLabel(s)}のロックを外した`, { tone: "info" });
          refreshSheet(h);
        } });
      lk.classList.add("sp-lock-btn");
      if (s.locked) lk.classList.add("on");
      side.appendChild(lk);
    }
    if (side.childElementCount) r.appendChild(side);
    list.appendChild(r);
  }
  if (!souls.length) list.appendChild(el("div", "pt-note c", "魂を持っていない。迷宮で集めよう。"));
  root.appendChild(list);
}

// ---- 宿し技を選ぶ (サブ魂) ----
// 借りられる数は魂のランクで決まる (subPickCap)。1つの魂は選び直し=入れ替えで閉じ、
// 2つ以上の魂は押すたびに借りる/外すを切り替え、閉じるまで選び続けられる。
export function openSkillStep(d, subRef) {
  if (!d || !subRef) return null;
  const s = soulByUid(subRef.uid);
  if (!s) return null;
  const tutSeen = () => { if (UI.tutorialEvent) UI.tutorialEvent("subSkill"); }; // 手ほどき「サブ魂」: 借りる技を見届けた
  const learned = soulLearnedSkills(s);
  const passives = soulLearnedPassives(s);
  const pkeys = Object.keys(passives);
  if (!learned.length && !pkeys.length) { sfx("ng"); toast("この魂はまだ技もパッシブも覚えていない", { tone: "info" }); tutSeen(); return null; }
  const cap = subPickCap(s);
  const refit = () => { recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp); };
  // 効いている借用 (覚えている分・上限内) の数
  const usedCount = () => subPicks(subRef).filter((p) => (p.passive ? passives[p.passive] : learned.includes(p.skill))).slice(0, cap).length;
  const pick = (h, kind, key) => {
    // 1つしか借りられない魂で、いま借りているものを押した → そのまま閉じる (空にはしない)
    if (cap === 1 && subPickIndex(subRef, kind, key) >= 0) { sfx("select"); h.close(); return; }
    // 覚えていない (古い) 借用が枠を塞がないよう、選ぶ前に落としておく
    const cur = subPicks(subRef);
    for (let i = cur.length - 1; i >= 0; i--) { const p = cur[i]; if (!(p.passive ? passives[p.passive] : learned.includes(p.skill))) cur.splice(i, 1); }
    if (!toggleSubPick(subRef, kind, key)) { sfx("ng"); toast(`この魂から借りられるのは${cap}つまで ― 先にどれかを外す`, { tone: "info" }); return; }
    refit(); sfx("select");
    if (game.autosave) game.autosave(true);
    if (cap === 1) { h.close(); return; }
    refreshSheet(h);
  };
  return sheet.open({
    kind: "info", className: "sp-pick-sheet", paged: false, banner: "宿し技をえらぶ",
    title: `${soulLabel(s)} ― ${cap}つまで借りられる`,
    onClose: () => { tutSeen(); if (game.renderTown) game.renderTown(); },
    body: (scroll, h) => {
      const n = usedCount();
      const note = cap >= 3 ? `借りている ${n}/${cap}` : `借りている ${n}/${cap} ・ 魂のランクを上げると借りられる数が増える (R3:2 / R5:3)`;
      scroll.appendChild(el("div", "pt-note", note));
      const list = el("div", "pt-list");
      for (const sk of learned) {
        const sp = SPELLS[sk];
        const on = subPickIndex(subRef, "skill", sk) >= 0;
        const r = row({ title: `${sp ? sp.name : sk}${on ? "（借りている）" : ""}`, sub: sp ? `${SPELL_KIND_LABEL[sp.kind] || ""} ・ MP${sp.mp} ・ ${sp.desc || ""}` : "",
          tone: on ? "gold" : null, right: "技", onTap: () => pick(h, "skill", sk) });
        longPress(r, () => showSkillPopup(sk));
        list.appendChild(r);
      }
      for (const pk of pkeys) {
        const on = subPickIndex(subRef, "passive", pk) >= 0;
        list.appendChild(row({ title: `${passiveName(pk, passives[pk])}${on ? "（借りている）" : ""}`, sub: passiveDesc(pk, passives[pk]),
          tone: on ? "gold" : null, right: "加護", onTap: () => pick(h, "passive", pk) }));
      }
      scroll.appendChild(list);
    },
  });
}

// 開いているシートの中身を描き直す (見ていた頁は保つ)
function refreshSheet(h) {
  if (!h || h.closed || !h.update) return;
  const pg = h.page || 0;
  const top = h.body ? h.body.scrollTop : 0; // 縦スクロールのシートは描き直しても位置を保つ
  h.update({});
  h.page = pg;
  if (h.body) h.body.scrollTop = top;
}

// 強化済みの魂 = ✦で鍛えた・融合を重ねた・残火で上限を伸ばした魂
function soulEnhanced(s) {
  return !!s && ((s.level || 1) > 1 || (s.exp || 0) > 0 || (s.count || 1) > 1 || (s.capBonus || 0) > 0);
}

// ---- 魂融合 (同じ職の余っている魂を取り込む) ----
// 融合しても画面は閉じず、続けて素材を選べる (結果の札・ランクアップはその都度上に出る)。
// 素材が尽きたら、結果の札を閉じたところでこの画面も閉じる。
// onDone: 融合するたびに呼ぶ (魂の一覧シートを描き直すなど)
export function openFusePicker(targetUid, onDone) {
  const t = soulByUid(targetUid);
  if (!t) return null;
  if (!(game.featureUnlocked && game.featureUnlocked("fusion"))) { sfx("ng"); toast("魂融合は 5 迷宮の踏破を王に報告すると開く", { tone: "info" }); return null; }
  const candsNow = () => (game.fuseCandidates ? game.fuseCandidates(targetUid) : []).sort(game.soulSortCmp || (() => 0));
  // 素材にできない同じ職の魂: ロック中 (この場で外せる) / だれかが宿している (理由だけ見せる)
  const sameJob = () => (G_().souls || []).filter((s) => s.uid !== t.uid && s.clsKey === t.clsKey);
  const lockedNow = () => sameJob().filter((s) => s.locked && !wearerOf(s.uid, null)).sort(game.soulSortCmp || (() => 0));
  const wornNow = () => sameJob().filter((s) => wearerOf(s.uid, null));
  if (!candsNow().length && !lockedNow().length) { sfx("ng"); toast(wornNow().length ? "同じ職の魂は、どれも人業が宿している" : "魂融合できる同じ職の魂がない", { tone: "info" }); return null; }
  const cl = SOUL_CLASSES[t.clsKey] || SOUL_CLASSES.fighter;
  sfx("select");
  let h = null;
  const view = () => ({
    title: `${soulLabel(t)} Lv${t.level} に融合させる`,
    lines: ["素材にした魂は失われ、融合数に応じてLv上限、能力が上昇。一定数の魂を融合するとランクアップ。"],
    body: (scroll) => {
      const list = el("div", "pt-list");
      const cands = candsNow();
      for (const c of cands) list.appendChild(candRow(c));
      if (!cands.length) list.appendChild(el("div", "pt-note c", "いま素材にできる魂はない。ロックを外すと選べる。"));
      const locked = lockedNow();
      if (locked.length) {
        list.appendChild(el("div", "sp-fz-h sp-fz-gap", "ロック中 ― 外すとすぐ素材にできる"));
        for (const c of locked) list.appendChild(lockedRow(c));
      }
      const worn = wornNow();
      if (worn.length) {
        list.appendChild(el("div", "sp-fz-h sp-fz-gap", "宿している魂 ― 外すと素材にできる"));
        for (const c of worn) {
          const who = wearerOf(c.uid, null);
          const r = row({ icon: orb(c.clsKey, soulRankOf(c), 32), title: `${soulLabel(c)} Lv${c.level}`, sub: `${who ? who.name : "人業"} が宿している ・ ランク${soulRankOf(c)}` });
          r.classList.add("sp-fz-off");
          list.appendChild(r);
        }
      }
      scroll.appendChild(list);
    },
  });
  // ロック中の素材: 「ロックを外す」で、その場で素材の一覧へ移す
  const lockedRow = (c) => {
    const unlock = button({ icon: "unlock", label: "ロックを外す", kind: "secondary", size: "sm", onTap: (e) => {
      if (e) e.stopPropagation();
      if (!game.toggleSoulLock) return;
      game.toggleSoulLock(c.uid);
      sfx("select");
      toast(`${soulLabel(c)}のロックを外した ― 素材にできる`, { tone: "info" });
      if (h && !h.closed) h.update(view());
      if (typeof onDone === "function") onDone();
    } });
    unlock.classList.add("sp-lock-btn");
    const tags = [`ランク${soulRankOf(c)}`];
    if ((c.level || 1) > 1 || (c.exp || 0) > 0) tags.push("強化済み");
    return row({ icon: orb(c.clsKey, soulRankOf(c), 32), title: `${soulLabel(c)} Lv${c.level}`, sub: tags.join(" ・ "), right: unlock });
  };
  // 結果の札が閉じたら: 素材が残っていれば続ける、尽きたら閉じる
  const afterResult = () => {
    if (!h || h.closed) return;
    if (!candsNow().length && !lockedNow().length) h.close();
  };
  const fuse = (c) => {
    if (!game.fuseSoul) return;
    const r = game.fuseSoul(targetUid, c.uid, afterResult);
    if (!r) return;
    if (h && !h.closed) h.update(view()); // 使った素材を一覧から外す (結果の札の下で描き直す)
    if (typeof onDone === "function") onDone();
  };
  const candRow = (c) => {
    const enh = soulEnhanced(c);
    const tags = [`ランク${soulRankOf(c)}`];
    if ((c.level || 1) > 1 || (c.exp || 0) > 0) tags.push("強化済み");
    if (c.capBonus) tags.push(`残火 +${c.capBonus}`);
    return row({ icon: orb(c.clsKey, soulRankOf(c), 32), title: `${soulLabel(c)} Lv${c.level}`, sub: tags.join(" ・ "), tone: enh ? "gold" : null, chevron: true,
      onTap: () => {
        if (!enh) return fuse(c);
        sfx("ng");
        const lines = [`この魂は Lv${c.level}${c.count > 1 ? `・+${c.count - 1}` : ""}${c.capBonus ? `・残火 +${c.capBonus}` : ""} まで強化されている。`,
          "素材にした魂は消える。蓄積した ✦ と融合数 (自身の1体を含む) は融合先に引き継がれる。"];
        if (c.capBonus) lines.push(`残火で伸ばした Lv上限 +${c.capBonus} は失われる。`);
        lines.push("残したい魂は、魂の一覧で「ロック」すれば素材にならない。");
        confirm({ banner: "注意", title: "強化済みの魂を素材にする？", lines, okLabel: "素材にする" }).then((y) => { if (y) fuse(c); });
      } });
  };
  h = sheet.open({ kind: "info", className: "sp-pick-sheet", paged: false, banner: "魂融合", accent: cl.glow, ...view() });
  return h;
}

// ================= 融合の結果 (変わった能力・Lv上限・覚えた技) =================
// info は game.js fuseSoul の result:
// { clsKey, fromRank, toRank, fromLv, toLv, fromCap, toCap, fromCount, toCount, statsFrom, statsTo, statsOf,
//   newSkills: [key], newPassives: [{key, lv}], fromPicks, toPicks }
const FUSE_STATS = [["hp", "HP"], ["mp", "MP"], ["atk", "ATK"], ["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["luk", "LUK"]];
const fmtStat = (v) => { const r = Math.round((v || 0) * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
// 「Lv上限 20 → 21」の段 (変わらない項目は出さない)
function fusePerks(info, accent) {
  const box = el("div", "sp-ru-perks sp-ru-blk");
  const perk = (k, a, b) => {
    const p = el("div", "sp-ru-perk");
    p.appendChild(el("span", "sp-ru-pk", k));
    const v = el("span", "sp-ru-pv");
    v.appendChild(el("span", "sp-ru-old", a));
    v.appendChild(el("span", "sp-ru-to", "→"));
    const x = el("span", "sp-ru-new", b);
    if (accent) x.style.color = accent;
    v.appendChild(x);
    p.appendChild(v);
    box.appendChild(p);
  };
  if (info.toCap !== info.fromCap) perk("Lv上限", String(info.fromCap), String(info.toCap));
  if (info.toLv > info.fromLv) perk("魂レベル", `Lv${info.fromLv}`, `Lv${info.toLv}`);
  if (info.toCount !== info.fromCount) perk("融合数", `+${info.fromCount - 1}`, `+${info.toCount - 1}`);
  if (info.toPicks > info.fromPicks) perk("宿し技の枠", String(info.fromPicks), String(info.toPicks));
  return box;
}
// 能力の増減 (上がった項目だけ、2列)
function fuseStats(info, noneText = "能力の変化はわずか (端数のみ)") {
  const wrap = el("div", "sp-fz-sec sp-ru-blk");
  wrap.appendChild(el("div", "sp-fz-h", info.statsOf ? `${info.statsOf} の能力` : "魂の能力"));
  const grid = el("div", "sp-fz-stats");
  const a = info.statsFrom || {}, b = info.statsTo || {};
  for (const [k, label] of FUSE_STATS) {
    const d = Math.round(((b[k] || 0) - (a[k] || 0)) * 10) / 10;
    if (!d) continue;
    const c = el("div", "sp-fz-st");
    c.appendChild(el("span", "sp-fz-k", label));
    c.appendChild(el("span", "sp-fz-v", `${fmtStat(a[k])}→${fmtStat(b[k])}`));
    c.appendChild(el("span", d > 0 ? "sp-fz-d up" : "sp-fz-d dn", `${d > 0 ? "+" : ""}${fmtStat(d)}`));
    grid.appendChild(c);
  }
  if (!grid.childNodes.length) grid.appendChild(el("div", "sp-fz-none", noneText));
  wrap.appendChild(grid);
  return wrap;
}
// 新たに覚えた技・パッシブ (押すと説明)
function fuseLearned(info) {
  const sk = (info.newSkills || []).filter((k) => SPELLS[k]);
  const ps = info.newPassives || [];
  if (!sk.length && !ps.length) return null;
  const wrap = el("div", "sp-fz-sec sp-ru-blk");
  wrap.appendChild(el("div", "sp-fz-h", "新たに覚えた"));
  const list = el("div", "sp-fz-learn");
  for (const k of sk) {
    const b = el("button", "sp-fz-chip sk", `技 ${SPELLS[k].name}`);
    b.type = "button";
    b.addEventListener("click", () => showSkillPopup(k));
    list.appendChild(b);
  }
  for (const p of ps) {
    const b = el("button", "sp-fz-chip ps", `パッシブ ${passiveName(p.key, p.lv)}`);
    b.type = "button";
    b.title = passiveDesc(p.key, p.lv);
    b.addEventListener("click", () => toast(`${passiveName(p.key, p.lv)} ― ${passiveDesc(p.key, p.lv)}`, { tone: "info" }));
    list.appendChild(b);
  }
  wrap.appendChild(list);
  return wrap;
}

// ランク据え置きの魂融合: 結果の札 (game.js の fuseSoul から)
export function showFuseResult(info, onClose) {
  const cl = SOUL_CLASSES[info.clsKey] || SOUL_CLASSES.fighter;
  const art = el("div", "sp-cel-art fz");
  art.appendChild(pixelCanvas(jobSprite(info.clsKey, Math.max(1, info.toRank)), 96));
  // 区切りごとに本文へ直に並べる (収まらない画面では区切りでページが分かれる)
  const blocks = [];
  if (info.statUp) blocks.push(el("div", "sp-fz-lead", `魂の輝きが増した ― 全能力 +${info.statUp}%`));
  blocks.push(fusePerks(info, cl.glow), fuseStats(info));
  const ln = fuseLearned(info);
  if (ln) blocks.push(ln);
  const nx = nextRankThreshold(info.clsKey, info.toCount);
  const notes = [];
  if (nx) notes.push(`ランク${info.toRank + 1}まで あと ${nx.next - info.toCount} 体`);
  if (notes.length) blocks.push(el("div", "sp-fz-note sp-ru-blk", notes.join(" ・ ")));
  const body = (scroll) => blocks.forEach((b) => scroll.appendChild(b));
  return celebrate({
    banner: "✦ 魂融合 ✦", accent: cl.glow, art, sparkle: false, className: "sp-cel sp-cel-fz",
    title: soulLabel({ clsKey: info.clsKey, count: info.toCount }), titleColor: cl.glow, body,
    footer: [{ label: "とじる", kind: "primary", size: "lg", onTap: (h) => h.close("ok") }],
    onClose: () => { if (typeof onClose === "function") onClose(); },
  });
}

// ================= 祝祭: ランクアップ (game.js の showRankUp から) =================
// info: showFuseResult と同じ + { accent, title, hint }
export function celebrateRankUp(info, onClose) {
  const { clsKey, fromRank, toRank, accent, title, hint } = info;
  const cl = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const art = el("div", "sp-cel-art ru");
  art.style.setProperty("--ru-accent", accent);
  // 光の輪 (外へ広がる) + 逆回りの2重の光条
  art.appendChild(el("div", "sp-ru-burst"));
  const rays = el("div", "sp-cel-rays");
  rays.style.background = `repeating-conic-gradient(from 0deg, ${accent}66 0deg 8deg, transparent 8deg 26deg)`;
  art.appendChild(rays);
  const rays2 = el("div", "sp-cel-rays rev");
  rays2.style.background = `repeating-conic-gradient(from 13deg, ${accent}33 0deg 5deg, transparent 5deg 18deg)`;
  art.appendChild(rays2);
  art.appendChild(pixelCanvas(jobSprite(clsKey, toRank), 96));
  const blocks = [];
  const rk = el("div", "sp-ru-row");
  rk.appendChild(el("span", "sp-ru-rk", `ランク${fromRank}`));
  rk.appendChild(el("span", "sp-ru-ar", "→"));
  const nw = el("span", "sp-ru-rk new", `ランク${toRank}`);
  nw.style.color = accent;
  rk.appendChild(nw);
  blocks.push(rk);
  const jn = el("div", "sp-ru-job", `「${title || jobRankName(clsKey, toRank)}」`);
  jn.style.color = accent;
  blocks.push(jn, fusePerks(info, accent));
  if (info.statsTo) blocks.push(fuseStats(info));
  const ln = fuseLearned(info);
  if (ln) blocks.push(ln);
  if (hint) blocks.push(el("div", "sp-ru-hint sp-ru-blk", hint));
  const body = (scroll) => blocks.forEach((b) => scroll.appendChild(b));
  return celebrate({
    banner: "✦ RANK UP ✦", accent, art, sparkle: true, className: "sp-cel sp-cel-ru",
    title: `${soulLabel({ clsKey, count: info.toCount })} が昇格した`, body,
    footer: [{ label: "受け取る", kind: "primary", size: "lg", onTap: (h) => h.close("ok") }],
    onClose: () => { if (typeof onClose === "function") onClose(); },
  });
}

// UI.trainableList: いま ✦ で1段以上鍛えられる隊のメイン魂 (上限までの見積り toCap を添える)
function trainableList() {
  const list = ops.trainableList ? ops.trainableList() : [];
  return list.map((x) => {
    const e = soulByUid(x.uid);
    return { ...x, toCap: trainPlan(e), train: (n = 1) => train(x.uid, n) };
  });
}

// UI.fusableList: 魂融合できる人業のメイン魂 (隊 → 控えの順)。[{ doll, uid, clsKey, n }]
function fusableList() {
  if (!(game.featureUnlocked && game.featureUnlocked("fusion")) || !game.fuseCandidates) return [];
  const out = [];
  for (const d of allDolls()) {
    if (!d || d.primary == null) continue;
    const s = soulByUid(d.primary);
    const n = s ? game.fuseCandidates(s.uid).length : 0;
    if (n) out.push({ doll: d, uid: s.uid, clsKey: s.clsKey, n, name: `${soulLabel(s)}` });
  }
  return out;
}

export function install() {
  registerUI({ trainableList, fusableList, openFusePicker, trainSoul: (uid, n = 1) => train(uid, n), openSoulPicker });
}
