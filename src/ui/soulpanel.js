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
  SOUL_CLASSES, jobSprite, jobBust, soulByUid, soulRankOf, soulLevelCapOf, nextRankThreshold, jobRankName, soulSeriesName,
  soulLearnedSkills, soulLearnedPassives, passiveName, passiveDesc, ORDER_PERK, PASSIVES, orderPassiveMap, orderPerkLv,
  jobSkillTable, recalcDoll,
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
  const costOf = (lv) => (game.soulTrainCost ? game.soulTrainCost(lv) : Math.max(1, Math.round(20 * Math.pow(1.13, (lv || 1) - 1))));
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
      kind: "info", banner: "新たな技", title: d ? `${d.name} が目覚めた技` : "目覚めた技", className: "sp-pick-sheet",
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
  const nmT = el("span", null, `${soulSeriesName(pe.clsKey)}の魂`);
  nmT.style.color = cl.glow;
  nm.appendChild(nmT);
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
    const em = button({ label: `残火 ${G.embers || 0}`, sub: `上限 +1${pe.capBonus ? `（済 +${pe.capBonus}）` : ""}`, kind: "secondary", size: "sm",
      cost: { kind: "ember", n: 1 }, disabled: (G.embers || 0) < 1, onTap: () => confirmRaiseCap(pe) });
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
  if (!game.raiseSoulCap) return;
  if (have < 1) { game.raiseSoulCap(pe.uid); return; }
  const cap = soulLevelCapOf(pe);
  sfx("select");
  confirm({
    banner: "魂の残火", danger: false,
    title: `残火を1つ捧げ、${soulSeriesName(pe.clsKey)}の魂のLv上限を上げますか？`,
    lines: [`Lv上限 ${cap} → ${cap + 1}`, `残火 ${have} → ${have - 1}`, "捧げた残火は戻らない。"],
    okLabel: "捧げる",
  }).then((y) => { if (y) game.raiseSoulCap(pe.uid); });
}

// 同じ魂が余っている → 魂融合 (付け替えの隣のボタン)
function fuseButton(pe, town) {
  const G = G_();
  const worn = (uid) => allDolls().some((d) => d.primary === uid || (d.subs || []).some((s) => s && s.uid === uid));
  const spare = G.souls.filter((s) => s.uid !== pe.uid && s.clsKey === pe.clsKey && !worn(s.uid));
  if (!spare.length) return null;
  const open = game.featureUnlocked ? game.featureUnlocked("fusion") : false;
  const b = el("button", "sp-btn sp-fuse" + (open ? " hot" : " locked"));
  b.type = "button";
  const t = el("span", "sp-btn-t");
  t.appendChild(el("span", "sp-btn-l", `魂融合 ×${spare.length}`));
  t.appendChild(el("span", "sp-btn-s", open ? "同じ魂が余っている" : "5 迷宮の踏破で開く"));
  b.appendChild(t);
  if (!open || !town) b.disabled = true;
  b.addEventListener("click", () => openFusePicker(pe.uid));
  return b;
}

// ---- サブ魂 (宿し技) のタイル ----
function subTiles(more, d, town) {
  const n = game.unlockedSubSlots ? game.unlockedSubSlots() : 0;
  if (!n) {
    const c = game.clearedDungeonCount ? game.clearedDungeonCount() : 0;
    more.appendChild(lockedTile("サブ魂", `10 迷宮の踏破で開く (${c}/10)`));
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
      const borrow = sub.passive ? passiveName(sub.passive, soulLearnedPassives(se)[sub.passive] || 1)
        : sub.skill && SPELLS[sub.skill] ? SPELLS[sub.skill].name : "技を選ぶ";
      tx.appendChild(el("span", "sp-tile-s", (sub.passive ? "加護: " : "技: ") + borrow));
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
    const c = game.clearedDungeonCount ? game.clearedDungeonCount() : 0;
    return lockedTile("控えの結社", `20 迷宮の踏破で開く (${c}/20)`);
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
  let h = null;
  h = sheet.open({
    kind: "info", banner: "控えの結社", className: "sp-pick-sheet",
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
  if (nextSeatAt) info.appendChild(el("span", "pt-note", `次の席は ${nextSeatAt} 迷宮の踏破で`));
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
    kind: "info", className: "sp-pick-sheet",
    banner: isSub ? `サブ魂${si + 1} ― ${d.name}` : `メイン魂 ― ${d.name}`,
    lines: [isSub ? "サブ魂は、覚えた技かパッシブを1つ貸し、能力の30%を足す。" : "メイン魂が、職業・能力・技を決める。"],
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
// 魂を宿したら、能力がどう変わるか (器の写しで計算する。実体は書き換えない)
function previewSoul(d, slotId, uid) {
  const fake = { ...d, base: { ...d.base }, subs: (d.subs || []).map((s) => (s ? { ...s } : s)), spells: [], passives: [] };
  if (slotId === "primary") {
    fake.primary = uid;
    fake.subs = fake.subs.filter((x) => x && x.uid !== uid);
  } else {
    const i = +slotId.slice(3);
    if (fake.primary === uid) fake.primary = null;
    const keep = fake.subs.filter((x) => x && x.uid !== uid);
    keep[i] = { uid, skill: null };
    fake.subs = keep.filter(Boolean);
  }
  try { recalcDoll(fake); } catch (e) { return null; }
  return {
    hp: fake.maxhp - d.maxhp, mp: fake.maxmp - d.maxmp,
    atk: fake.atk - d.atk, vit: fake.vit - d.vit, agi: fake.agi - d.agi, int: fake.int - d.int, pie: fake.pie - d.pie, luk: fake.luk - d.luk,
  };
}
function pickerBody(root, d, slotId, h) {
  const G = G_();
  const isSub = slotId !== "primary";
  const si = isSub ? +slotId.slice(3) : -1;
  const curUid = isSub ? ((d.subs || [])[si] || {}).uid : d.primary;
  const fusion = game.featureUnlocked ? game.featureUnlocked("fusion") : false;
  const souls = [...G.souls].sort(game.soulSortCmp || (() => 0));
  const order = (s) => (s.uid === curUid ? 0 : wearerOf(s.uid, d) ? 2 : 1);
  souls.sort((a, b) => order(a) - order(b));
  const list = el("div", "pt-list sp-plist");
  for (const s of souls) {
    const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
    const rank = soulRankOf(s);
    const cap = soulLevelCapOf(s);
    const isCur = s.uid === curUid;
    const other = wearerOf(s.uid, d);
    const inOther = !isCur && (d.primary === s.uid || (d.subs || []).some((x) => x && x.uid === s.uid));
    const r = el("div", "sp-srow" + (isCur ? " cur" : "") + (other ? " taken" : ""));
    r.style.setProperty("--glow", cl.glow);
    const main = el("button", "sp-srow-main");
    main.type = "button";
    main.appendChild(orb(s.clsKey, rank, 36));
    const tx = el("span", "sp-srow-t");
    const nm = el("span", "sp-srow-n", `${soulSeriesName(s.clsKey)}の魂`);
    nm.style.color = cl.glow;
    tx.appendChild(nm);
    tx.appendChild(el("span", "sp-srow-m", `Lv${s.level}/${cap} ・ ランク${rank} ・ ${RARITY_NAME[cl.rarity] || ""}`));
    if (isCur) tx.appendChild(el("span", "sp-srow-tag cur", isSub ? "このサブ魂に宿している" : "宿している"));
    else if (other) tx.appendChild(el("span", "sp-srow-tag", `${other.name} が宿している`));
    else {
      if (inOther) tx.appendChild(el("span", "sp-srow-tag", isSub ? "メイン魂/別のサブ魂から移す" : "サブ魂から移す"));
      const dl = previewSoul(d, slotId, s.uid);
      if (dl) tx.appendChild(statDelta(dl));
    }
    main.appendChild(tx);
    if (other || isCur) main.disabled = !!other;
    main.addEventListener("click", () => {
      if (isCur || other) return;
      game.equipSoulToSlot(d, s.uid, slotId, (applied) => {
        if (!applied) return;
        h.close();
        if (isSub) {
          const sub = (d.subs || []).find((x) => x && x.uid === s.uid);
          if (sub) openSkillStep(d, sub);
        }
      });
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
      if (n) side.appendChild(button({ label: `魂融合 ${n}`, kind: "secondary", size: "sm", onTap: () => openFusePicker(s.uid) }));
    }
    if (side.childElementCount) r.appendChild(side);
    list.appendChild(r);
  }
  if (!souls.length) list.appendChild(el("div", "pt-note c", "魂を持っていない。迷宮で集めよう。"));
  root.appendChild(list);
}

// ---- 宿し技を選ぶ (サブ魂) ----
export function openSkillStep(d, subRef) {
  if (!d || !subRef) return null;
  const s = soulByUid(subRef.uid);
  if (!s) return null;
  const learned = soulLearnedSkills(s);
  const passives = soulLearnedPassives(s);
  const pkeys = Object.keys(passives);
  if (!learned.length && !pkeys.length) { sfx("ng"); toast("この魂はまだ技もパッシブも覚えていない", { tone: "info" }); return null; }
  const apply = (h) => {
    recalcDoll(d); d.hp = Math.min(d.hp, d.maxhp); d.mp = Math.min(d.mp, d.maxmp);
    sfx("select"); h.close();
    if (game.autosave) game.autosave(true);
    if (game.renderTown) game.renderTown();
  };
  return sheet.open({
    kind: "info", className: "sp-pick-sheet", banner: "宿し技をえらぶ",
    title: `${soulSeriesName(s.clsKey)}の魂 ― 1つだけ借りられる`,
    body: (scroll, h) => {
      const list = el("div", "pt-list");
      for (const sk of learned) {
        const sp = SPELLS[sk];
        const on = subRef.skill === sk && !subRef.passive;
        const r = row({ title: `${sp ? sp.name : sk}${on ? "（いま借りている）" : ""}`, sub: sp ? `${SPELL_KIND_LABEL[sp.kind] || ""} ・ MP${sp.mp} ・ ${sp.desc || ""}` : "",
          tone: on ? "gold" : null, right: "技", onTap: () => { subRef.skill = sk; subRef.passive = null; apply(h); } });
        longPress(r, () => showSkillPopup(sk));
        list.appendChild(r);
      }
      for (const pk of pkeys) {
        const on = subRef.passive === pk;
        list.appendChild(row({ title: `${passiveName(pk, passives[pk])}${on ? "（いま借りている）" : ""}`, sub: passiveDesc(pk, passives[pk]),
          tone: on ? "gold" : null, right: "加護", onTap: () => { subRef.passive = pk; subRef.skill = null; apply(h); } }));
      }
      scroll.appendChild(list);
    },
  });
}

// ---- 魂融合 (同じ職の余っている魂を取り込む) ----
export function openFusePicker(targetUid) {
  const t = soulByUid(targetUid);
  if (!t) return null;
  if (!(game.featureUnlocked && game.featureUnlocked("fusion"))) { sfx("ng"); toast("魂融合は 5 迷宮の踏破で開く", { tone: "info" }); return null; }
  const cands = (game.fuseCandidates ? game.fuseCandidates(targetUid) : []).sort(game.soulSortCmp || (() => 0));
  if (!cands.length) { sfx("ng"); toast("魂融合できる同じ職の魂がない", { tone: "info" }); return null; }
  const cl = SOUL_CLASSES[t.clsKey] || SOUL_CLASSES.fighter;
  sfx("select");
  return sheet.open({
    kind: "info", className: "sp-pick-sheet", banner: "魂融合", accent: cl.glow,
    title: `${soulSeriesName(t.clsKey)}の魂 Lv${t.level} に融合させる`,
    lines: ["素材にした魂は失われ、融合数に応じてLv上限、能力が上昇。一定数の魂を融合するとランクアップ。"],
    body: (scroll, h) => {
      const list = el("div", "pt-list");
      for (const c of cands) {
        list.appendChild(row({ icon: orb(c.clsKey, soulRankOf(c), 32), title: `${soulSeriesName(c.clsKey)}の魂 Lv${c.level}`, sub: `魂数 ${c.count}${c.count > 1 ? " ― 融合済みの魂" : ""}`, chevron: true,
          onTap: () => {
            const go = () => { h.close(); if (game.fuseSoul) game.fuseSoul(targetUid, c.uid); };
            if (c.count > 1) confirm({ title: "融合済みの魂を素材にする？", lines: [`この魂は ${c.count} 体ぶんを融合した魂。素材にすると、その魂数と蓄積した ✦ はすべて失われる。`], okLabel: "素材にする" }).then((y) => { if (y) go(); });
            else go();
          } }));
      }
      scroll.appendChild(list);
    },
  });
}

// ================= 祝祭: 転職 =================
export function celebrateJob(d) {
  if (!d || !d.jobKey) return null;
  const cl = SOUL_CLASSES[d.jobKey] || SOUL_CLASSES.fighter;
  const art = el("div", "sp-cel-art");
  const rays = el("div", "sp-cel-rays");
  art.appendChild(rays);
  art.appendChild(pixelCanvas(jobSprite(d.jobKey, Math.max(1, d.jobRank || 1)), 108));
  const lines = [`${soulSeriesName(d.jobKey)}の魂 Lv${d.jobLv || 1}`];
  if (d.spells && d.spells.length) lines.push("技: " + d.spells.map((k) => (SPELLS[k] ? SPELLS[k].name : k)).join("・"));
  return celebrate({
    banner: "✦ 転職 ✦", accent: cl.glow, art, sparkle: true, className: "sp-cel",
    title: `${d.name} は ${d.cls} になった`, titleColor: cl.glow, lines,
    footer: [
      { label: "受け取る", kind: "primary", size: "lg", onTap: (h) => h.close("ok") },
      game.showCodexJobDetail ? { label: "職業を見る", kind: "ghost", onTap: (h) => { h.close("ok"); game.showCodexJobDetail(d.jobKey, d.jobRank); } } : null,
    ],
  });
}

// ================= 祝祭: ランクアップ (game.js の showRankUp から) =================
// info: { clsKey, fromRank, toRank, fromLv, toLv, accent, fromCap, toCap, title, hint }
export function celebrateRankUp(info, onClose) {
  const { clsKey, fromRank, toRank, fromLv, toLv, accent, fromCap, toCap, title, hint } = info;
  const cl = SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter;
  const art = el("div", "sp-cel-art ru");
  const rays = el("div", "sp-cel-rays");
  rays.style.background = `repeating-conic-gradient(from 0deg, ${accent}55 0deg 8deg, transparent 8deg 26deg)`;
  art.appendChild(rays);
  art.appendChild(pixelCanvas(jobSprite(clsKey, toRank), 108));
  const body = el("div", "sp-ru");
  const rk = el("div", "sp-ru-row");
  rk.appendChild(el("span", "sp-ru-rk", `ランク${fromRank}`));
  rk.appendChild(el("span", "sp-ru-ar", "→"));
  const nw = el("span", "sp-ru-rk new", `ランク${toRank}`);
  nw.style.color = accent;
  rk.appendChild(nw);
  body.appendChild(rk);
  const jn = el("div", "sp-ru-job", `「${title || jobRankName(clsKey, toRank)}」`);
  jn.style.color = accent;
  body.appendChild(jn);
  const perks = el("div", "sp-ru-perks");
  const perk = (k, v) => { const p = el("div", "sp-ru-perk"); p.appendChild(el("span", "sp-ru-pk", k)); const x = el("span", "sp-ru-pv", v); x.style.color = accent; p.appendChild(x); perks.appendChild(p); };
  if (fromCap !== toCap) perk("Lv上限", `${fromCap} → ${toCap}`);
  if (toLv > fromLv) perk("魂レベル", `Lv${fromLv} → Lv${toLv}`);
  body.appendChild(perks);
  if (hint) body.appendChild(el("div", "sp-ru-hint", hint));
  return celebrate({
    banner: "✦ RANK UP ✦", accent, art, sparkle: true, className: "sp-cel sp-cel-ru",
    title: `${cl.label}の魂が 昇格した`, body,
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
    if (n) out.push({ doll: d, uid: s.uid, clsKey: s.clsKey, n, name: `${soulSeriesName(s.clsKey)}の魂` });
  }
  return out;
}

export function install() {
  registerUI({ trainableList, fusableList, openFusePicker, trainSoul: (uid, n = 1) => train(uid, n), openSoulPicker });
}
