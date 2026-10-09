// ===== 魂の区分 — メイン魂・魂を強化/上限まで・残火・付け替え・魂融合・サブ魂・控えの結社 =====
// 担当: WP-B。隊 (party.js) の「魂」区分を描き、魂の操作のシート (付け替え・宿し技・魂融合) を開く。
//   街でだけ魂を付け替え・鍛えられる (迷宮の中では見るだけ = 旧来と同じ制限)。
//   魂を強化/上限まで は ops.trainTimes (単体の鍛錬のループ・同じ費用) を使い、結果はレベルアップの祝祭カード1枚にまとめる。
//   転職・ランクアップ・魂融合・レベルアップは祝祭カード (kit.celebrate)。
// 提供する契約: UI.trainableList() / UI.fusableList() / UI.openFusePicker(uid) / UI.celebrateLevelUp(entries, onClose)
// game.js は import しない (ctx.js の UI / game / ops を通す)。

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, button, row, sheet, toast, confirm, statDelta, bar, svgIcon, celebrate, longPress } from "./kit.js";
import { countUp } from "./motion.js";
import { showSkillPopup, showPassivePopup, SPELL_KIND_LABEL, tagRow, spellTagKinds } from "./itemview.js";
import {
  SOUL_CLASSES, jobSprite, jobBust, soulByUid, soulRankOf, soulLevelCapOf, emberCostOf, nextRankThreshold, jobRankName, soulSeriesName,
  soulLearnedSkills, soulLearnedPassives, soulLabel, soulRankLeft, passiveName, passiveDesc, orderStatBonus, orderStatRateOfRank, ORDER_STAT_RATES,
  jobSkillTable, recalcDoll, subPicks, subPickCap, toggleSubPick, subPickIndex, jobStatsOf, subStatRateOfRank,
} from "../souls.js";
import { SPELLS, spellMpLabel } from "../combat.js";
import { RESIST_LABEL } from "../resistance.js";
import { crispCanvas } from "../sprites.js";

const sfx = (k) => { try { const S = game.SFX; if (S && S[k]) S[k](); } catch (e) { /* 音は演出のみ */ } };
const G_ = () => game.G;
const allDolls = () => (game.allDolls ? game.allDolls() : [...(G_().party || []), ...(G_().reserve || [])]);
const RARITY_NAME = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド", unique: "固有" };
const STAT_L = { hp: "HP", mp: "MP", atk: "STR", vit: "VIT", agi: "AGI", int: "INT", pie: "PIE", luk: "LUK" };

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

// 魂を強化 (n = Infinity で上限まで)。その場で Lv の数字が刻み、レベルアップの祝祭カード (能力の伸び・覚えた技) を出す
export function train(uid, n = 1) {
  const r = ops.trainTimes ? ops.trainTimes(uid, n) : null;
  if (!r || !r.ok) return r;
  requestAnimationFrame(() => {
    const lv = document.querySelector(`[data-sp-lv="${uid}"]`);
    if (lv) countUp(lv, r.from, r.to, 420);
  });
  const d = r.wearer || null;
  celebrateLevelUp([{
    name: d ? d.name : null, doll: d, uid,
    main: d && d.primary !== uid ? null : { from: r.from, to: r.to },
    subs: d && d.primary !== uid ? [{ uid, label: (SOUL_CLASSES[(soulByUid(uid) || {}).clsKey] || {}).label || "", from: r.from, to: r.to }] : [],
    statsFrom: r.before, statsTo: r.after, skills: r.gainedSkills || [], spent: r.spent,
  }]);
  return r;
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
          list.appendChild(row({ title: sp.name, sub: `${SPELL_KIND_LABEL[sp.kind] || ""} ・ ${spellMpLabel(sp)} ・ ${sp.desc || ""}`, chevron: true, onTap: () => showSkillPopup(k) }));
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
  // メイン魂 (付け替え) とサブ魂を1列に並べる。控えの結社は隊列の右 (party.js) から開く (ユーザーの指示、2026-10)
  const more = el("div", "sp-more");
  more.appendChild(mainTile(d, pe, town));
  subTiles(more, d, town);
  root.appendChild(more);
  const fz = fuseButton(pe, town);
  if (fz) { const acts = el("div", "sp-row2"); acts.appendChild(fz); root.appendChild(acts); }
  if (!town) root.appendChild(el("div", "pt-note c", game.featureUnlocked?.("soulChange") ? "魂の付け替え・強化は、街へ戻ってから。" : "魂の強化は、街へ戻ってから。"));
}
// メイン魂のタイル (サブ魂と同じ形)。押すと魂の付け替え (手ほどき「魂の付け替え」が .sp-change を光らせる)
function mainTile(d, pe, town) {
  if (!soulChangeVisible()) return lockedTile("未解放", "？？？");
  const tile = el("div", "sp-tile sp-main");
  const main = el(town ? "button" : "div", "sp-tile-main");
  if (town) main.type = "button";
  main.appendChild(el("span", "sp-tile-k", "メイン魂"));
  const rank = soulRankOf(pe);
  tile.style.setProperty("--glow", (SOUL_CLASSES[pe.clsKey] || {}).glow || "#c9a24a");
  const r = el("span", "sp-tile-r");
  r.appendChild(orb(pe.clsKey, rank, 28));
  const tx = el("span", "sp-tile-tx");
  tx.appendChild(el("span", "sp-tile-n", `${jobRankName(pe.clsKey, rank)} Lv${pe.level}`));
  const fixed = d.vessel === "sera"; // セラのメイン魂は灯守に固定
  tx.appendChild(el("span", "sp-tile-s", fixed ? "セラだけの魂 (付け替え不可)" : town ? "魂を付け替える" : "付け替えは街で"));
  r.appendChild(tx);
  main.appendChild(r);
  if (town && !fixed) { main.addEventListener("click", () => openSoulPicker(d, "primary")); main.classList.add("sp-change"); }
  else if (town && fixed) main.addEventListener("click", () => game.showCodexJobDetail && game.showCodexJobDetail(pe.clsKey, rank));
  tile.appendChild(main);
  return tile;
}
// 手ほどき中は一覧の確認だけ許す。実際の付け替えは完了後に解放する。
function soulChangeVisible() {
  return !!game.featureUnlocked?.("soulChange") || (G_()?.tut?.cur === "soulChange" && !!game.worldState?.().reported.w02);
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
  // 見出しを押すと、その職業の図鑑 (ランクごとの技・加護) を開く (ユーザーの指示、2026-10)
  if (game.showCodexJobDetail) {
    head.classList.add("sp-head-link");
    head.setAttribute("role", "button");
    head.setAttribute("aria-label", `${cl.label || ""}の職業図鑑を見る`);
    head.addEventListener("click", () => game.showCodexJobDetail(pe.clsKey, rank));
  }
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
      // 上限は魂融合 (1体ごと) か魂の残火で伸びる。上限の間に戦いで得た経験値は捨てずに蓄積し、伸びた時に Lv へ注ぐ
      const how = cl.unique
        ? (nextRankThreshold(pe.clsKey, pe.count) ? "物語の節目でランクが上がるか、魂の残火を捧げると上限が伸びる。" : "魂の残火を捧げると上限が伸びる。")
        : `同じ${cl.label}の魂を魂融合するか、魂の残火を捧げると上限が伸びる。`;
      card.appendChild(el("div", "sp-note", `Lv上限。${how}上限の間に戦いで得た経験値は蓄積され${pe.exp > 0 ? `（いま ✦${pe.exp}）` : ""}、上限が伸びるとすぐ Lv に注がれる。`));
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
    // 灯守 (セラだけの魂) は魂を重ねず、物語の節目でランクが上がる
    r.appendChild(el("span", "sp-next-v", (SOUL_CLASSES[pe.clsKey] || {}).unique ? "物語の節目で" : `魂 ${pe.count - nr.prev}/${nr.next - nr.prev}`));
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
  return card;
}

// 残火でLv上限を上げる前の確認 (残火は貴重なので、押し間違いで捧げないように)
// onDone = 上げた後 (魂を強化のシートを描き直す)
function confirmRaiseCap(pe, onDone = null) {
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
  }).then((y) => { if (y && game.raiseSoulCap(pe.uid) && onDone) onDone(); });
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
    more.appendChild(lockedTile("未解放", "？？？"));
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

// ---- 控えの結社: タイル (席の数・全員への上乗せ) → シート ----
// 席の魂の能力の一部 (魂ランクで R1 3% 〜 R5 8%) が人業の全員に加わる。技・パッシブは関係しない (souls.js orderStatBonus)
const ORDER_RATE_TEXT = `R1 ${Math.round(ORDER_STAT_RATES[1] * 100)}% 〜 R5 ${Math.round(ORDER_STAT_RATES[5] * 100)}%`;
// 能力の上乗せを「HP+12 STR+3 …」に (1未満は省く)
function bonusText(b) {
  const parts = [];
  for (const k in STAT_L) { const v = Math.round((b && b[k]) || 0); if (v > 0) parts.push(`${STAT_L[k]}+${v}`); }
  return parts.join(" ");
}
export function openOrderSheet(town = true) {
  if (!game.featureUnlocked?.("order")) return null;
  if (UI.tutorialEvent) UI.tutorialEvent("order"); // 手ほどき「控えの結社」: 結社を開いた
  let h = null;
  h = sheet.open({
    kind: "info", banner: "控えの結社", className: "sp-pick-sheet",
    lines: [`席に着けた魂の能力の一部 (${ORDER_RATE_TEXT}) が、人業の全員に加わる。パーティに出している魂は席に着けない。`],
    body: (scroll) => orderBody(scroll, town, () => h && h.update({})),
  });
  return h;
}
function orderBody(root, town, again) {
  const G = G_();
  const fielded = new Set();
  for (const dd of G.party) { if (dd.primary != null) fielded.add(dd.primary); for (const s of (dd.subs || [])) if (s) fielded.add(s.uid); }
  const benched = game.soulRepresentatives().filter((s) => !fielded.has(s.uid));
  const seats = game.orderSeats ? game.orderSeats() : 0;
  const seated = game.orderSeatedUids ? game.orderSeatedUids() : [];
  const seatedSet = new Set(seated);
  const full = seated.length >= seats;
  const nextSeat = [null, "order2", "order3", "order4", "order5"][seats] || (seats ? null : "order");
  const info = el("div", "sp-order-info");
  info.appendChild(el("span", "sp-order-seats", `席 ${seated.length} / ${seats}`));
  if (nextSeat && game.featureNote) info.appendChild(el("span", "pt-note", `次の席: ${game.featureNote(nextSeat)}`));
  root.appendChild(info);
  if (seated.length) root.appendChild(el("div", "sp-order-on", `全員に: ${bonusText(orderStatBonus(seated)) || "なし"}`));
  if (!benched.length) {
    root.appendChild(el("div", "pt-note", "パーティに出していない魂がいない。控えの魂を席に着けると、その能力の一部が全員に加わる。"));
    return;
  }
  // 席に着いている魂 → 全員に足す能力の大きい順
  const weight = (s) => { const b = orderStatBonus([s.uid]); return b.hp * 0.15 + b.mp * 0.25 + b.atk + b.vit + b.agi + b.int * 0.7 + b.pie * 0.7 + b.luk * 0.6; };
  const sorted = benched.slice().sort((a, b) => (seatedSet.has(b.uid) ? 1 : 0) - (seatedSet.has(a.uid) ? 1 : 0) || weight(b) - weight(a));
  const list = el("div", "pt-list");
  for (const s of sorted) {
    const rank = soulRankOf(s);
    const isSeated = seatedSet.has(s.uid);
    const rate = Math.round(orderStatRateOfRank(rank) * 100);
    const sub = el("span", "ui-row-sub", `全員に ${rate}%: ${bonusText(orderStatBonus([s.uid])) || "—"}`);
    const right = town ? button({ label: isSeated ? "外す" : "着席", kind: isSeated ? "ghost" : "primary", size: "sm", disabled: !isSeated && full,
      onTap: (e) => { if (e) e.stopPropagation(); if (game.toggleOrderSeat) game.toggleOrderSeat(s.uid); again(); } }) : (isSeated ? "着席中" : "");
    const r = row({ icon: orb(s.clsKey, rank, 32), title: `${soulLabel(s)} Lv${s.level}${isSeated ? " ・ 着席中" : ""}`, sub, right });
    r.classList.add("sp-orow");
    if (isSeated) r.classList.add("seated");
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
  if (!isSub && !soulChangeVisible()) return null;
  if (isSub && (!Number.isInteger(si) || si < 0 || si >= (game.unlockedSubSlots?.() || 0))) return null;
  sfx("select");
  return sheet.open({
    kind: "info", className: "sp-pick-sheet", // 魂の選択は縦スクロールで1ページに
    banner: isSub ? `サブ魂${si + 1} ― ${d.name}` : `メイン魂 ― ${d.name}`,
    onClose: () => { if (!isSub) UI.tutorialEvent?.("soulChangeViewed"); },
    lines: [isSub ? "サブ魂は、覚えた技かパッシブを貸し、能力の一部を足す (R1 10% 〜 R5 30%)。貸す数も魂のランクで増える (R1-2:1 / R3-4:2 / R5:3)。" : "メイン魂が、職業・能力・技を決める。"],
    body: (scroll, h) => { scroll.appendChild(el("div", "pt-note", game.featureUnlocked?.("sub1") ? "メイン魂の同じ職業はパーティに1つだけ。サブ魂は同じ職業の別の魂なら仲間と重複できる。他の人業が宿している魂を選ぶと、その人業から移す。同じ人業のメイン・サブには同じ職業を重ねられない。余った魂は人業の館で魂融合できる。" : "同じ職業の魂は、パーティに1つだけ。仲間が宿している魂を選ぶと、その仲間から移す。")); pickerBody(scroll, d, slotId, h); },
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
  return { from: statsOfDoll(dd), to: statsOfDoll(fake), resFrom: resistsOfDoll(dd), resTo: resistsOfDoll(fake) };
}
// 耐性まわり (抵抗値・ブレス耐性・会心) の写し
function resistsOfDoll(x) {
  const o = {};
  for (const k in RESIST_LABEL) o[k] = (x.resists && x.resists[k]) || 0;
  o.breath = Math.round((x.breathRes || 0) * 100);
  o.crit = Math.round((x.critBonus || 0) * 100);
  return o;
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
// 魂を宿す前に、この人業の能力・耐性の変化と、その魂が覚えている技を見せる (メイン・サブとも。ユーザーの指示、2026-10)
function confirmSoulEquip(d, slotId, s, cur) {
  const isSub = slotId !== "primary";
  const si = isSub ? +slotId.slice(3) : -1;
  const where = isSub ? `サブ魂${si + 1}` : "メイン魂";
  const body = el("div", "sp-eqc");
  // 他の人業が宿している魂なら、はっきり知らせる (ユーザーの指示、2026-10)
  const take = game.soulTakePlan ? game.soulTakePlan(d, s.uid, slotId) : null;
  if (take) {
    const hw = take.from === "primary" ? "メイン魂" : `サブ魂${+take.from.slice(3) + 1}`;
    const al = el("div", "sp-take");
    al.appendChild(el("div", "sp-take-h", `⚠ ${take.holder.name} が宿している魂`));
    al.appendChild(el("div", "sp-take-t", `「${soulLabel(s)}」は ${take.holder.name} の${hw}に宿っている。宿すと ${take.holder.name} から外れる。`));
    al.appendChild(el("div", "sp-take-t", take.give ? `${take.holder.name} の${hw}には、代わりに「${soulLabel(take.give)}」を宿す。`
      : take.from === "primary" ? `${take.holder.name} はメイン魂が空になり、パーティで戦えなくなる。` : `${take.holder.name} の${hw}は空になる。`));
    body.appendChild(al);
  }
  const mine = previewDoll(d, (f) => placeSoul(f, slotId, s.uid));
  if (mine) {
    body.appendChild(fuseStats({ statsOf: d.name, statsFrom: mine.from, statsTo: mine.to }, "能力は変わらない"));
    body.appendChild(resistDelta(mine.resFrom, mine.resTo));
  }
  if (take) {
    const theirs = previewDoll(take.holder, (f) => {
      if (f.primary === s.uid) f.primary = null;
      f.subs = f.subs.filter((x) => x && x.uid !== s.uid);
      if (take.give) placeSoul(f, take.from, take.give.uid);
    });
    if (theirs) body.appendChild(fuseStats({ statsOf: take.holder.name, statsFrom: theirs.from, statsTo: theirs.to }, "能力は変わらない"));
  }
  const sk = el("div", "sp-fz-sec sp-ru-blk");
  const nS = soulLearnedSkills(s).filter((k) => SPELLS[k]).length, nP = Object.keys(soulLearnedPassives(s) || {}).length;
  sk.appendChild(el("div", "sp-fz-h", `${soulLabel(s)} が覚えている技 ${nS} ・ パッシブ ${nP}`));
  sk.appendChild(soulSkillChips(s));
  body.appendChild(sk);
  return confirm({
    banner: take ? `${take.holder.name} から移す` : where, title: `この${where}を宿す？`,
    lines: [cur ? `${where}の「${soulLabel(cur)}」を外し、「${soulLabel(s)}」を宿す。` : `「${soulLabel(s)}」を ${d.name} の${where}に宿す。`,
      isSub ? "同じ職業でも別の魂なら仲間と重複して宿せる。借りる技・パッシブは、宿したあとに選ぶ。技を押すとくわしい説明。" : "メイン魂の技・パッシブをすべて使える。技を押すとくわしい説明。"],
    body, className: "sp-eqc-sheet", okLabel: "宿す", danger: false,
  });
}
// 耐性の増減 (変わった項目だけ、2列)
function resistDelta(a, b) {
  const wrap = el("div", "sp-fz-sec sp-ru-blk");
  wrap.appendChild(el("div", "sp-fz-h", "耐性"));
  const grid = el("div", "sp-fz-stats");
  const rows = [...Object.entries(RESIST_LABEL).map(([k, l]) => [k, `${l}抵抗`, ""]), ["breath", "ブレス耐性", "%"], ["crit", "会心", "%"]];
  for (const [k, label, unit] of rows) {
    const v0 = (a && a[k]) || 0, v1 = (b && b[k]) || 0, dv = v1 - v0;
    if (!dv) continue;
    const c = el("div", "sp-fz-st");
    c.appendChild(el("span", "sp-fz-k", label));
    c.appendChild(el("span", "sp-fz-v", `${v0}${unit}→${v1}${unit}`));
    c.appendChild(el("span", dv > 0 ? "sp-fz-d up" : "sp-fz-d dn", `${dv > 0 ? "+" : ""}${dv}${unit}`));
    grid.appendChild(c);
  }
  if (!grid.childNodes.length) grid.appendChild(el("div", "sp-fz-none", "耐性は変わらない"));
  wrap.appendChild(grid);
  return wrap;
}
// 魂が覚えている技・パッシブの札 (押すと説明のポップアップ)
function soulSkillChips(s) {
  const sks = soulLearnedSkills(s).filter((k) => SPELLS[k]);
  const pss = Object.entries(soulLearnedPassives(s) || {});
  const chips = el("div", "sp-sd-chips");
  for (const k of sks) {
    const b = el("button", "sp-sd-chip", SPELLS[k].name);
    b.type = "button";
    b.addEventListener("click", () => showSkillPopup(k));
    chips.appendChild(b);
  }
  for (const [key, lv] of pss) {
    const c = el("button", "sp-sd-chip ps", passiveName(key, lv));
    c.type = "button";
    c.addEventListener("click", () => { if (!showPassivePopup(key, lv)) toast(`${passiveName(key, lv)} ― ${passiveDesc(key, lv) || ""}`, { tone: "info" }); });
    chips.appendChild(c);
  }
  if (!sks.length && !pss.length) chips.appendChild(el("span", "pt-note", "まだ技を覚えていない。"));
  return chips;
}
function pickerBody(root, d, slotId, h) {
  const G = G_();
  const isSub = slotId !== "primary";
  const si = isSub ? +slotId.slice(3) : -1;
  const curUid = isSub ? ((d.subs || [])[si] || {}).uid : d.primary;
  const fusion = game.featureUnlocked ? game.featureUnlocked("fusion") : false;
  const souls = [...(isSub ? G.souls.filter((s) => !(SOUL_CLASSES[s.clsKey] || {}).unique) : game.soulRepresentatives())].sort(game.soulSortCmp || (() => 0)); // 灯守 (セラだけの魂) は貸さない
  const list = el("div", "pt-list sp-plist");
  for (const s of souls) {
    const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
    const rank = soulRankOf(s);
    const cap = soulLevelCapOf(s);
    const isCur = s.uid === curUid;
    const conflict = !isCur && game.soulSlotConflict(d, s.uid, slotId);
    const other = wearerOf(s.uid, d);
    const inOther = !isCur && (d.primary === s.uid || (d.subs || []).some((x) => x && x.uid === s.uid));
    const r = el("div", "sp-srow" + (isCur ? " cur" : "") + (other ? " taken" : ""));
    r.dataset.job = s.clsKey;
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
    else if (conflict) tx.appendChild(el("span", "sp-srow-tag", "この人業は同じ職業の魂をすでに宿しているため選択不可"));
    else {
      // 他の人業が宿している魂も選べる (選ぶとその人業から移す。確認の画面で知らせる)
      if (other) tx.appendChild(el("span", "sp-srow-tag warn", `${other.name} が宿している ・ 選ぶと移す`));
      else if (inOther) tx.appendChild(el("span", "sp-srow-tag", isSub ? "メイン魂/別のサブ魂から移す" : "サブ魂から移す"));
      const dl = previewSoul(d, slotId, s.uid);
      if (dl) tx.appendChild(statDelta(dl));
    }
    main.appendChild(tx);
    main.disabled = conflict;
    main.addEventListener("click", () => {
      if (isCur || conflict) return;
      const go = () => game.equipSoulToSlot(d, s.uid, slotId, (applied) => {
        if (!applied) return;
        h.close();
        if (isSub) {
          const sub = (d.subs || []).find((x) => x && x.uid === s.uid);
          if (sub) openSkillStep(d, sub);
        }
      });
      // 能力・耐性の変化と覚えている技を見せ、承認されたら宿す
      const cur = curUid != null ? soulByUid(curUid) : null;
      confirmSoulEquip(d, slotId, s, cur).then((y) => { if (y) go(); });
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
    // 魂を強化 (サブ魂の選択から、どの魂でも鍛えられる)。上限の魂には出さない
    if (isSub && s.level < cap) {
      const tb = button({ label: "強化", kind: "secondary", size: "sm", title: "✦Soul で魂のレベルを上げる",
        onTap: (e) => { if (e) e.stopPropagation(); openTrainSheet(s.uid, () => refreshSheet(h)); } });
      tb.classList.add("sp-pick-train");
      side.appendChild(tb);
    }
    if (fusion) {
      const n = game.fuseCandidates ? game.fuseCandidates(s.uid).length : 0;
      if (n) {
        const fb = button({ label: `魂融合 ${n}`, kind: "secondary", size: "sm", onTap: () => openFusePicker(s.uid, () => refreshSheet(h)) });
        fb.classList.add("sp-pick-fuse"); // 手ほどき (魂融合) が光らせる
        side.appendChild(fb);
      }
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

// ================= 魂一覧 (隊列の「控え」の右から) =================
// 持っている魂をすべて並べ、魂ごとに 詳細 (能力・覚えた技) / 魂を強化 / 魂融合 / ロック / パーティの人業のメイン・サブに宿す を行う
const SLOT_NAME = (slotId) => (slotId === "primary" ? "メイン魂" : `サブ魂${+slotId.slice(3) + 1}`);
// 魂を宿している人業と差し口 (無ければ null)
function soulHome(uid) {
  for (const dd of allDolls()) {
    if (dd.primary === uid) return { doll: dd, slotId: "primary" };
    const i = (dd.subs || []).findIndex((x) => x && x.uid === uid);
    if (i >= 0) return { doll: dd, slotId: "sub" + i };
  }
  return null;
}
function soulTags(s) {
  const tags = [];
  const home = soulHome(s.uid);
  const G = G_();
  if (home) tags.push(`${home.doll.name}${(G.reserve || []).includes(home.doll) ? "（控え）" : ""}の${SLOT_NAME(home.slotId)}`);
  else if ((game.orderSeatedUids ? game.orderSeatedUids() : []).includes(s.uid)) tags.push("控えの結社に着席中");
  else tags.push("宿していない");
  return tags.join(" ・ ");
}
export function openSoulList() {
  const G = G_();
  if (!G || G.state !== "town") return null;
  sfx("select");
  let h = null;
  const again = () => refreshSheet(h);
  h = sheet.open({
    kind: "info", banner: "魂一覧", className: "sp-pick-sheet sp-list-sheet",
    body: (scroll) => {
      const souls = [...(G.souls || [])].sort(game.soulSortCmp || (() => 0));
      scroll.appendChild(el("div", "pt-note", `所持 ${souls.length} 個 ・ 所持 ✦${G.soulPts || 0} ・ 魂を選ぶと、詳細・強化・融合・ロック・宿す操作ができる。`));
      const list = el("div", "pt-list sp-plist");
      for (const s of souls) {
        const cl = SOUL_CLASSES[s.clsKey]; if (!cl) continue;
        const rank = soulRankOf(s);
        const r = el("div", "sp-srow");
        r.style.setProperty("--glow", cl.glow);
        const main = el("button", "sp-srow-main");
        main.type = "button";
        main.appendChild(orb(s.clsKey, rank, 36));
        const tx = el("span", "sp-srow-t");
        const nm = el("span", "sp-srow-n", soulLabel(s));
        nm.style.color = cl.glow;
        if (s.locked) nm.appendChild(svgIcon("lock", "sp-srow-lk"));
        tx.appendChild(nm);
        tx.appendChild(el("span", "sp-srow-m", `Lv${s.level}/${soulLevelCapOf(s)} ・ ランク${rank} ・ ${RARITY_NAME[cl.rarity] || ""}`));
        tx.appendChild(el("span", "sp-srow-tag", soulTags(s)));
        main.appendChild(tx);
        main.addEventListener("click", () => openSoulDetail(s.uid, again));
        r.appendChild(main);
        list.appendChild(r);
      }
      if (!souls.length) list.appendChild(el("div", "pt-note c", "魂を持っていない。迷宮で集めよう。"));
      scroll.appendChild(list);
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }],
  });
  return h;
}
// 魂の詳細: 能力 (メイン魂として / サブ魂・結社で足す分)・覚えた技とパッシブ、操作のボタン
export function openSoulDetail(uid, onChange = null) {
  const G = G_();
  if (!G || G.state !== "town" || !soulByUid(uid)) return null;
  sfx("select");
  let h = null;
  // 操作の後は本文もフッターも作り直す (強化で上限に届いた・ロックの切り替え・融合で素材になった)
  const again = () => {
    if (h && !h.closed) { const top = h.body ? h.body.scrollTop : 0; h.update({ footer: footer() }); if (h.body) h.body.scrollTop = top; }
    if (onChange) onChange();
  };
  const body = (scroll) => {
    const s = soulByUid(uid);
    if (!s) { scroll.appendChild(el("div", "pt-note c", "この魂はもう無い (魂融合の素材になった)。")); return; }
    const cl = SOUL_CLASSES[s.clsKey] || {};
    const rank = soulRankOf(s);
    const cap = soulLevelCapOf(s);
    const head = el("div", "sp-train-h");
    head.appendChild(orb(s.clsKey, rank, 44));
    const tx = el("div", "sp-train-t sp-sd-t");
    const nm = el("div", "sp-srow-n", soulLabel(s));
    if (cl.glow) nm.style.color = cl.glow;
    if (s.locked) nm.appendChild(svgIcon("lock", "sp-srow-lk"));
    // 魂の名と同じ列の右端に「職業図鑑を見る」(その職業の図鑑をこのシートの上に開く。ユーザーの指示、2026-10)
    const nmRow = el("div", "sp-sd-nmrow");
    nmRow.appendChild(nm);
    if (game.showCodexJobDetail) {
      const cb = button({ label: "職業図鑑を見る", kind: "secondary", size: "sm", onTap: () => game.showCodexJobDetail(s.clsKey, rank) });
      cb.classList.add("sp-sd-codex");
      nmRow.appendChild(cb);
    }
    tx.appendChild(nmRow);
    tx.appendChild(el("div", "sp-srow-m", `「${jobRankName(s.clsKey, rank) || cl.label}」 ・ Lv${s.level}/${cap} ・ ランク${rank} ・ ${RARITY_NAME[cl.rarity] || ""}`));
    if (soulRankLeft(s)) tx.appendChild(el("div", "sp-srow-m", soulRankLeft(s)));
    tx.appendChild(el("div", "sp-srow-tag", soulTags(s)));
    head.appendChild(tx);
    scroll.appendChild(head);
    // 次の段までの ✦
    const need = game.soulTrainCost ? game.soulTrainCost(s.level) : 0;
    const prog = el("div", "sp-prog sp-lv");
    if (s.level < cap) {
      prog.appendChild(bar(Math.min(need, s.exp || 0), need, { tone: "soul" }));
      prog.appendChild(el("span", "sp-prog-v", `✦${s.exp || 0} / ${need}`));
    } else {
      prog.appendChild(bar(1, 1, { tone: "gold" }));
      prog.appendChild(el("span", "sp-prog-v cap", "上限"));
    }
    scroll.appendChild(prog);
    if (s.level >= cap && (s.exp || 0) > 0) scroll.appendChild(el("div", "sp-note", `蓄積 ✦${s.exp} ― Lv上限を上げるとすぐ Lv に注がれる`));
    // 能力: メイン魂として宿した時の素の値 / サブ魂・結社で足す分
    const st = jobStatsOf(s.clsKey, s);
    const tbl = el("div", "sp-sd-tbl");
    const subR = subStatRateOfRank(rank), ordR = orderStatRateOfRank(rank);
    const hrow = el("div", "sp-sd-r h");
    for (const t of ["", "メイン", `サブ ${Math.round(subR * 100)}%`, `結社 ${Math.round(ordR * 100)}%`]) hrow.appendChild(el("span", "", t));
    tbl.appendChild(hrow);
    const fmt = (v) => { const r = Math.round(v * 10) / 10; return String(Number.isInteger(r) ? r : r.toFixed(1)); };
    for (const k in STAT_L) {
      const v = st[k] || 0;
      const rr = el("div", "sp-sd-r");
      rr.appendChild(el("span", "k", STAT_L[k]));
      rr.appendChild(el("span", "", fmt(v)));
      rr.appendChild(el("span", "", "+" + fmt(v * subR)));
      rr.appendChild(el("span", "", "+" + fmt(v * ordR)));
      tbl.appendChild(rr);
    }
    scroll.appendChild(el("div", "sp-sd-h", "能力"));
    scroll.appendChild(tbl);
    scroll.appendChild(el("div", "pt-note", "メイン = メイン魂として宿した時の魂の能力 (装備・パッシブは含まない)。サブ・結社 = 足される分のめやす。"));
    // 覚えた技・パッシブ (タップで技の説明)
    const sks = soulLearnedSkills(s).filter((k) => SPELLS[k]);
    const pss = Object.entries(soulLearnedPassives(s) || {});
    scroll.appendChild(el("div", "sp-sd-h", `覚えた技 ${sks.length} ・ パッシブ ${pss.length}`));
    scroll.appendChild(soulSkillChips(s));
    const nxSkill = jobSkillTable(s.clsKey).find((t) => t.skill && t.lvl > s.level && SPELLS[t.skill]);
    if (nxSkill) scroll.appendChild(el("div", "sp-note", `次の技: Lv${nxSkill.lvl}「${SPELLS[nxSkill.skill].name}」`));
  };
  const footer = () => {
    const s = soulByUid(uid);
    if (!s) return [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }];
    const items = [];
    items.push({ label: "宿す", sub: "パーティのメイン・サブに", kind: "primary", onTap: () => openHostSheet(uid, again) });
    if (s.level < soulLevelCapOf(s)) items.push({ label: "魂を強化", sub: `Lv${s.level} → ${s.level + 1}`, kind: "secondary", onTap: () => openTrainSheet(uid, again) });
    else if ((G.embers || 0) > 0) items.push({ label: "魂を強化", sub: "残火でLv上限を上げる", kind: "secondary", onTap: () => openTrainSheet(uid, again) });
    if (game.featureUnlocked?.("fusion")) {
      const rep = game.soulRepresentatives().find((x) => x.clsKey === s.clsKey);
      const n = rep && game.fuseCandidates ? game.fuseCandidates(rep.uid).length : 0;
      if (n) items.push({ label: `魂融合 ${n}`, sub: rep.uid === uid ? "同じ職業の魂をこの魂へ" : `代表の「${soulLabel(rep)}」へ`, kind: "secondary", onTap: () => openFusePicker(uid, again) });
    }
    if (game.toggleSoulLock) items.push({ label: s.locked ? "ロックを外す" : "ロック", icon: s.locked ? "unlock" : "lock", kind: "ghost", size: "sm",
      onTap: () => { const on = game.toggleSoulLock(uid); sfx("select"); toast(on ? `${soulLabel(s)}をロックした ― 魂融合の素材にならない` : `${soulLabel(s)}のロックを外した`, { tone: "info" }); again(); } });
    items.push({ label: "閉じる", kind: "ghost", size: "sm", onTap: (x) => x.close() });
    return items;
  };
  h = sheet.open({ kind: "info", banner: "魂の詳細", className: "sp-pick-sheet sp-sd-sheet", body, footer: footer(),
    onClose: () => { if (onChange) onChange(); } });
  return h;
}
// 魂を宿す先を選ぶ: パーティの人業 × メイン魂 / サブ魂N。選べない差し口は理由を添えて灰色に
function openHostSheet(uid, onDone = null) {
  const G = G_();
  const s = soulByUid(uid);
  if (!G || G.state !== "town" || !s) return null;
  sfx("select");
  let h = null;
  const subN = game.unlockedSubSlots ? game.unlockedSubSlots() : 0;
  const mainOk = !!game.featureUnlocked?.("soulChange");
  const isRep = game.soulRepresentatives().some((x) => x.uid === uid);
  const body = (scroll) => {
    scroll.appendChild(el("div", "pt-note", `「${soulLabel(s)}」を宿す人業と差し口を選ぶ。${subN ? "" : "サブ魂はまだ開いていない。"}`));
    const list = el("div", "pt-list");
    for (const d of G.party) {
      const blk = el("div", "sp-host");
      const hd = el("div", "sp-host-h");
      hd.appendChild(el("span", "sp-host-n", d.name));
      const pe = d.primary != null ? soulByUid(d.primary) : null;
      hd.appendChild(el("span", "sp-host-j", pe ? soulLabel(pe) : "魂なし"));
      blk.appendChild(hd);
      const slots = el("div", "sp-host-s");
      const ids = [...(mainOk ? ["primary"] : []), ...Array.from({ length: subN }, (_, i) => "sub" + i)];
      for (const slotId of ids) {
        const curUid = slotId === "primary" ? d.primary : ((d.subs || [])[+slotId.slice(3)] || {}).uid;
        const cur = curUid != null ? soulByUid(curUid) : null;
        const here = curUid === uid;
        let why = "";
        if (here) why = "宿している";
        else if ((SOUL_CLASSES[soulByUid(uid)?.clsKey] || {}).unique) why = "セラだけの魂";
        else if (slotId === "primary" && d.vessel === "sera") why = "灯守に固定";
        else if (slotId === "primary" && !isRep) why = "余った魂は融合へ";
        else if (game.soulSlotConflict(d, uid, slotId)) why = "職業が重なる";
        else if (slotId !== "primary" && d.primary == null) why = "メイン魂が無い";
        const dl = why ? null : previewSoul(d, slotId, uid);
        const b = el("button", "sp-host-b" + (here ? " cur" : ""));
        b.type = "button";
        b.disabled = !!why;
        b.appendChild(el("span", "sp-host-k", SLOT_NAME(slotId)));
        const holder = !why ? wearerOf(uid, d) : null; // 他の人業が宿していれば、そこから移す
        b.appendChild(el("span", "sp-host-c" + (holder ? " warn" : ""), why || [holder ? `${holder.name} から移す` : "", cur ? `${soulLabel(cur)} と入れ替え` : "空き"].filter(Boolean).join(" ・ ")));
        if (dl) b.appendChild(statDelta(dl));
        b.addEventListener("click", () => {
          if (why) return;
          const go = () => game.equipSoulToSlot(d, uid, slotId, (applied) => {
            if (!applied) return;
            sfx("select");
            toast(`${d.name} の${SLOT_NAME(slotId)}に「${soulLabel(s)}」を宿した`, { tone: "gold" });
            h.close();
            if (onDone) onDone();
            if (slotId !== "primary") {
              const sub = (d.subs || []).find((x) => x && x.uid === uid);
              if (sub) openSkillStep(d, sub);
            }
          });
          confirmSoulEquip(d, slotId, s, cur).then((y) => { if (y) go(); });
        });
        slots.appendChild(b);
      }
      if (!ids.length) slots.appendChild(el("span", "pt-note", "魂の付け替えはまだ開いていない。"));
      blk.appendChild(slots);
      list.appendChild(blk);
    }
    scroll.appendChild(list);
  };
  h = sheet.open({ kind: "info", banner: "魂を宿す", title: soulLabel(s), className: "sp-pick-sheet sp-host-sheet", body,
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => x.close() }] });
  return h;
}

// ---- 魂を強化 (シート) ----
// サブ魂の選択の各魂から開く。メイン魂の札と同じく 1段 / まとめて (上限まで) を選び、結果はレベルアップの祝祭カード。
// onChange = 強化した後・閉じた後 (選択シートの Lv・能力の差分を描き直す)
export function openTrainSheet(uid, onChange = null) {
  const G = G_();
  if (!G || G.state !== "town") return null;
  sfx("select");
  const fill = (scroll) => {
    const e = soulByUid(uid);
    if (!e) return;
    const cl = SOUL_CLASSES[e.clsKey] || {};
    const cap = soulLevelCapOf(e);
    const head = el("div", "sp-train-h");
    head.appendChild(orb(e.clsKey, soulRankOf(e), 40));
    const tx = el("div", "sp-train-t");
    const nm = el("div", "sp-srow-n", soulLabel(e));
    if (cl.glow) nm.style.color = cl.glow;
    tx.appendChild(nm);
    const lv = el("div", "sp-srow-m");
    lv.appendChild(document.createTextNode("Lv"));
    const lvN = el("span", "", String(e.level));
    lvN.dataset.spLv = String(uid);
    lv.appendChild(lvN);
    lv.appendChild(document.createTextNode(` / ${cap} ・ ランク${soulRankOf(e)}`));
    tx.appendChild(lv);
    head.appendChild(tx);
    scroll.appendChild(head);
    const need = game.soulTrainCost ? game.soulTrainCost(e.level) : 0;
    const prog = el("div", "sp-prog sp-lv");
    if (e.level < cap) {
      prog.appendChild(bar(Math.min(need, e.exp || 0), need, { tone: "soul" }));
      prog.appendChild(el("span", "sp-prog-v", `✦${e.exp || 0} / ${need}`));
    } else {
      prog.appendChild(bar(1, 1, { tone: "gold" }));
      prog.appendChild(el("span", "sp-prog-v cap", "上限"));
    }
    scroll.appendChild(prog);
    if (e.level >= cap && (e.exp || 0) > 0) scroll.appendChild(el("div", "sp-note", `蓄積 ✦${e.exp} ― Lv上限を上げるとすぐ Lv に注がれる`));
    const nxSkill = jobSkillTable(e.clsKey).find((t) => t.skill && t.lvl > e.level && SPELLS[t.skill]);
    if (nxSkill) scroll.appendChild(el("div", "sp-note", `次の技: Lv${nxSkill.lvl}「${SPELLS[nxSkill.skill].name}」`));
    const plan = trainPlan(e);
    if (e.level < cap && (G.soulPts || 0) < plan.next) scroll.appendChild(el("div", "sp-short", `✦があと ${plan.next - (G.soulPts || 0)} 足りない ― 迷宮で敵を倒すと得られる`));
    else scroll.appendChild(el("div", "sp-note", `所持 ✦${G.soulPts || 0}`));
    // 魂の残火でLv上限を上げる (上限に届いた魂を伸ばし続ける手段)
    if ((G.embers || 0) > 0 || e.level >= cap) {
      const need = emberCostOf(e.clsKey);
      scroll.appendChild(el("div", "sp-note", `魂の残火 ${G.embers || 0} ・ Lv上限 +1 に ${need}つ${e.capBonus ? `（残火で +${e.capBonus} 済）` : ""}`));
    }
  };
  const footer = () => {
    const e = soulByUid(uid);
    const cap = e ? soulLevelCapOf(e) : 0;
    const items = [];
    if (e && e.level < cap) {
      const plan = trainPlan(e);
      items.push({ label: "魂を強化", sub: `Lv${e.level} → ${e.level + 1}`, kind: "primary", cost: { kind: "soul", n: plan.next },
        disabled: (G.soulPts || 0) < plan.next, onTap: (h) => doTrain(h, 1) });
      if (plan.n >= 2) items.push({ label: plan.to >= cap ? "上限まで" : "まとめて", sub: `→ Lv${plan.to}`, kind: "secondary",
        cost: { kind: "soul", n: plan.cost }, onTap: (h) => doTrain(h, Infinity) });
    }
    if (e && ((G.embers || 0) > 0 || e.level >= cap)) {
      const need = emberCostOf(e.clsKey);
      items.push({ label: "Lv上限を上げる", sub: `Lv上限 ${cap} → ${cap + 1}`, kind: e.level >= cap ? "primary" : "secondary",
        cost: { kind: "ember", n: need }, disabled: (G.embers || 0) < need,
        onTap: (h) => confirmRaiseCap(e, () => { h.update({ footer: footer() }); if (onChange) onChange(); }) });
    }
    items.push({ label: "閉じる", kind: "ghost", onTap: (h) => h.close() });
    return items;
  };
  const doTrain = (h, n) => {
    const r = train(uid, n);
    if (r && r.ok) { h.update({ footer: footer() }); if (onChange) onChange(); }
  };
  return sheet.open({ kind: "info", banner: "魂を強化", className: "sp-train-sheet",
    body: (scroll) => fill(scroll), footer: footer(), onClose: () => { if (onChange) onChange(); } });
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
    if (UI.tutorialEvent) UI.tutorialEvent("subPick");
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
    kind: "info", className: "sp-pick-sheet", banner: "宿し技をえらぶ",
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
        const r = row({ title: `${sp ? sp.name : sk}${on ? "（借りている）" : ""}`, sub: sp ? `${SPELL_KIND_LABEL[sp.kind] || ""} ・ ${spellMpLabel(sp)} ・ ${sp.desc || ""}` : "",
          tone: on ? "gold" : null, right: "技", onTap: () => pick(h, "skill", sk) });
        // 戦闘のスキル一覧と同じ札 (種別・属性・全体)。物理技は借り手の武器の属性も乗る
        const tg = sp && tagRow(spellTagKinds(sp, d), "sp-pick-tags");
        const tt = tg && r.querySelector(".ui-row-title");
        if (tt) tt.appendChild(tg);
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
  const requested = soulByUid(targetUid);
  const t = requested && game.soulRepresentatives().find((s) => s.clsKey === requested.clsKey);
  if (!t) return null;
  targetUid = t.uid;
  if (G_().state !== "town") return null;
  if (!(game.featureUnlocked && game.featureUnlocked("fusion"))) { sfx("ng"); toast(`魂融合は、${game.featureNote ? game.featureNote("fusion") : "踏破を王に報告すると開く"}`, { tone: "info" }); return null; }
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
    lines: ["人業の館で、同じ職業の余った魂をこの魂に融合する。融合数に応じて能力が上昇し、ランクが上がるとLv上限が伸びる。", "同じ職業の魂を融合せずに残し、別の人業のサブ魂にすることもできる。残したい魂はロックすると融合素材から外れる。"],
    body: (scroll) => {
      const list = el("div", "pt-list");
      const cands = candsNow();
      if (cands.length > 1) {
        const bulk = button({ label: "まとめて融合", kind: "primary", onTap: () => fuseAll() });
        bulk.classList.add("sp-fuse-all");
        list.appendChild(bulk);
        list.appendChild(el("div", "pt-note", `素材にできる魂 ${cands.length}個をまとめて融合する。個別に選んで融合することもできる。`));
      }
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
  const fuseAll = () => {
    const cands = candsNow();
    if (cands.length < 2 || !game.fuseSouls) return;
    const run = () => {
      const r = game.fuseSouls(targetUid, cands.map((c) => c.uid), afterResult);
      if (!r) return;
      if (h && !h.closed) h.update(view());
      if (typeof onDone === "function") onDone();
    };
    const enhanced = cands.filter(soulEnhanced);
    if (!enhanced.length) return run();
    confirm({ banner: "注意", title: "強化済みの魂もまとめて融合する？", lines: [
      `素材にできる魂 ${cands.length}個を融合する。`,
      ...enhanced.map((c) => `${soulLabel(c)} Lv${c.level}${c.capBonus ? `・残火 +${c.capBonus}` : ""}`),
      "素材にした魂は消える。蓄積した ✦・融合数・残火によるLv上限の加算は、すべて融合先に引き継がれる。",
      "残したい魂は、魂の一覧で「ロック」すれば素材にならない。",
    ], okLabel: "まとめて融合" }).then((y) => { if (y) run(); });
  };
  const candRow = (c) => {
    const enh = soulEnhanced(c);
    const tags = [`ランク${soulRankOf(c)}`];
    if ((c.level || 1) > 1 || (c.exp || 0) > 0) tags.push("強化済み");
    if (c.capBonus) tags.push(`残火 +${c.capBonus}`);
    const r = row({ icon: orb(c.clsKey, soulRankOf(c), 32), title: `${soulLabel(c)} Lv${c.level}`, sub: tags.join(" ・ "), tone: enh ? "gold" : null, chevron: true,
      onTap: () => {
        if (!enh) return fuse(c);
        sfx("ng");
        const lines = [`この魂は Lv${c.level}${c.count > 1 ? `・+${c.count - 1}` : ""}${c.capBonus ? `・残火 +${c.capBonus}` : ""} まで強化されている。`,
          "素材にした魂は消える。蓄積した ✦ と融合数 (自身の1体を含む) は融合先に引き継がれる。"];
        if (c.capBonus) lines.push(`残火で伸ばした Lv上限 +${c.capBonus} は融合先に引き継がれる。`);
        lines.push("残したい魂は、魂の一覧で「ロック」すれば素材にならない。");
        confirm({ banner: "注意", title: "強化済みの魂を素材にする？", lines, okLabel: "素材にする" }).then((y) => { if (y) fuse(c); });
      } });
    r.classList.add("sp-fuse-material");
    return r;
  };
  h = sheet.open({ kind: "info", className: "sp-pick-sheet sp-fuse-sheet", banner: "魂融合", accent: cl.glow,
    footer: [{ label: "とじる", kind: "secondary", onTap: (h) => h.close() }], ...view() });
  return h;
}

// ================= 融合の結果 (変わった能力・Lv上限・覚えた技) =================
// info は game.js fuseSoul の result:
// { clsKey, fromRank, toRank, fromLv, toLv, fromCap, toCap, fromCount, toCount, statsFrom, statsTo, statsOf,
//   newSkills: [key], newPassives: [{key, lv}], fromPicks, toPicks }
const FUSE_STATS = [["hp", "HP"], ["mp", "MP"], ["atk", "STR"], ["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["luk", "LUK"]];
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
  if (info.fromCount != null && info.toCount !== info.fromCount && !(SOUL_CLASSES[info.clsKey] || {}).unique) perk("融合数", `+${info.fromCount - 1}`, `+${info.toCount - 1}`);
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
    b.addEventListener("click", () => { if (!showPassivePopup(p.key, p.lv)) toast(`${passiveName(p.key, p.lv)} ― ${passiveDesc(p.key, p.lv)}`, { tone: "info" }); });
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

// ================= 祝祭: 転職 (game.js の announceJobChange から) =================
// メイン魂を別の職の魂に付け替えた (職業・職業ランクが変わった) とき
export function celebrateJob(d) {
  if (!d || !d.jobKey) return null;
  const cl = SOUL_CLASSES[d.jobKey] || SOUL_CLASSES.fighter;
  const art = el("div", "sp-cel-art");
  art.appendChild(el("div", "sp-cel-rays"));
  art.appendChild(pixelCanvas(jobSprite(d.jobKey, Math.max(1, d.jobRank || 1)), 108));
  const pe = d.primary != null ? soulByUid(d.primary) : null;
  const lines = [pe ? `${soulLabel(pe)} Lv${pe.level}` : `${soulSeriesName(d.jobKey)}の魂 Lv${d.jobLv || 1}`];
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
  const hl = Array.isArray(hint) ? hint : hint ? [hint] : [];
  if (hl.length) {
    const hb = el("div", "sp-ru-hint sp-ru-blk");
    hl.forEach((t) => hb.appendChild(el("div", null, t)));
    blocks.push(hb);
  }
  const body = (scroll) => blocks.forEach((b) => scroll.appendChild(b));
  return celebrate({
    banner: "✦ RANK UP ✦", accent, art, sparkle: true, className: "sp-cel sp-cel-ru",
    title: `${soulLabel({ clsKey, count: info.toCount })} が昇格した`, body,
    footer: [{ label: "受け取る", kind: "primary", size: "lg", onTap: (h) => h.close("ok") }],
    onClose: () => { if (typeof onClose === "function") onClose(); },
  });
}

// ================= 祝祭: レベルアップ (戦果シートの後 / 街で魂を強化) =================
// 成長はこのゲームの芯なので、魂融合・ランクアップと同じ祝祭カードで1枚にまとめて見せる:
//   光条と光の輪に包まれた職の姿 → 「Lv12 → Lv15」の数字が刻んで判を押す → 能力が1つずつ伸びて並ぶ →
//   覚えた技が光って現れる → 次の目標 (次の技まであと何Lv / Lv上限なら魂融合・残火) で締める。
//   何人も上がった時は、1人1枚の札を順に光らせて並べる (収まらなければ人の区切りでページが分かれる)。
// entries: [{ name, doll, uid (主に見せる魂), main: {from, to} | null, subs: [{uid, label, from, to}],
//             statsFrom, statsTo (hp/mp/atk… の表示キー), skills: [key], spent? }]
const buzzLv = (p) => { try { if (game.buzz) game.buzz(p); } catch (e) { /* 振動は演出のみ */ } };
const isInt = (v) => Number.isInteger(Math.round((v || 0) * 10) / 10);
// 数字を刻む (端数のある能力は刻まずにそのまま出す)。delay ms 後に始める
function tickNum(node, from, to, delay, ms = 520, fmt = fmtStat) {
  node.textContent = fmt(from);
  const go = () => { if (isInt(from) && isInt(to)) countUp(node, Math.round(from), Math.round(to), ms, fmt); else node.textContent = fmt(to); };
  if (delay > 0) setTimeout(go, delay); else requestAnimationFrame(go);
}
// 主に見せる魂の情報 (メイン魂が上がっていればそれ、なければ最初のサブ魂)
function luSoul(e) {
  const uid = e.main ? e.uid : (e.subs[0] && e.subs[0].uid);
  const soul = uid != null ? soulByUid(uid) : null;
  const clsKey = soul ? soul.clsKey : "fighter";
  return { soul, clsKey, rank: soul ? Math.max(1, soulRankOf(soul)) : 1, cl: SOUL_CLASSES[clsKey] || SOUL_CLASSES.fighter, lv: e.main || e.subs[0] };
}
// 次の目標の1行: Lv上限 (→ 魂融合・残火) / 次の技まであと何Lv
function luNext(soul) {
  if (!soul) return null;
  const cap = soulLevelCapOf(soul);
  if (soul.level >= cap) {
    const nx = nextRankThreshold(soul.clsKey, soul.count);
    return { cap: true, text: nx ? `Lv上限 ${cap} に到達 ― 同じ魂をあと ${nx.next - soul.count} 体 魂融合すると、ランク${soulRankOf(soul) + 1}で上限が伸びる` : `Lv上限 ${cap} に到達 ― 魂の残火で上限を伸ばせる` };
  }
  const nxSkill = jobSkillTable(soul.clsKey).find((t) => t.skill && t.lvl > soul.level && SPELLS[t.skill]);
  if (nxSkill) return { skill: nxSkill.skill, text: `次の技「${SPELLS[nxSkill.skill].name}」まで あと ${nxSkill.lvl - soul.level} Lv` };
  return null;
}
function luNextEl(soul, cls = "") {
  const nx = luNext(soul);
  if (!nx) return null;
  const b = el(nx.skill ? "button" : "div", "sp-lu-next" + (nx.cap ? " cap" : "") + (cls ? " " + cls : ""), nx.text);
  if (nx.skill) { b.type = "button"; b.addEventListener("click", () => showSkillPopup(nx.skill)); }
  return b;
}
// 「Lv12 → Lv15」(新しい数字が刻んで判を押す)。gained = 上がった段数
function luLvRow(lv, accent, { big = true, delay = 0 } = {}) {
  const r = el("div", "sp-lu-lv" + (big ? " big" : ""));
  r.appendChild(el("span", "sp-lu-old", `Lv${lv.from}`));
  r.appendChild(el("span", "sp-lu-ar", "→"));
  const nw = el("span", "sp-lu-new");
  nw.appendChild(el("span", "sp-lu-lvk", "Lv"));
  const num = el("span", "sp-lu-num");
  nw.appendChild(num);
  if (accent) nw.style.color = accent;
  nw.style.animationDelay = `${delay + 250}ms, ${delay + 900}ms`;
  r.appendChild(nw);
  tickNum(num, lv.from, lv.to, delay + 250, Math.min(900, 300 + (lv.to - lv.from) * 90), (v) => String(Math.round(v)));
  if (lv.to - lv.from > 1) { const g = el("span", "sp-lu-gain", `+${lv.to - lv.from}`); g.style.animationDelay = `${delay + 950}ms`; r.appendChild(g); }
  return r;
}
// 能力の伸び (伸びた項目だけ。1つずつ光って並び、数字が刻む)
function luStats(e, delay0, step = 90) {
  const a = e.statsFrom || {}, b = e.statsTo || {};
  const grid = el("div", "sp-lu-stats sp-ru-blk");
  let i = 0;
  for (const [k, label] of FUSE_STATS) {
    const d = Math.round(((b[k] || 0) - (a[k] || 0)) * 10) / 10;
    if (!(d > 0)) continue;
    const delay = delay0 + i * step;
    const c = el("div", "sp-lu-st");
    c.style.animationDelay = `${delay}ms`;
    c.appendChild(el("span", "sp-lu-k", label));
    const v = el("span", "sp-lu-v");
    v.appendChild(el("span", "sp-lu-was", fmtStat(a[k])));
    v.appendChild(el("span", "sp-lu-to", "→"));
    const now = el("span", "sp-lu-now");
    v.appendChild(now);
    c.appendChild(v);
    c.appendChild(el("span", "sp-lu-d", `+${fmtStat(d)}`));
    tickNum(now, a[k] || 0, b[k] || 0, delay + 120, 420);
    grid.appendChild(c);
    i++;
  }
  if (!i) grid.appendChild(el("div", "sp-fz-none", "能力の伸びはわずか (端数のみ)"));
  return { grid, n: i };
}
// 覚えた技 (押すと説明)。光って現れる
function luSkills(keys, delay, { head = true } = {}) {
  const ks = (keys || []).filter((k) => SPELLS[k]);
  if (!ks.length) return null;
  const wrap = el("div", "sp-fz-sec sp-ru-blk sp-lu-learn");
  if (head) wrap.appendChild(el("div", "sp-fz-h", "新たな技を覚えた"));
  const list = el("div", "sp-fz-learn");
  ks.forEach((k, i) => {
    const b = el("button", "sp-fz-chip sk sp-lu-chip", `技 ${SPELLS[k].name}`);
    b.type = "button";
    b.style.animationDelay = `${delay + i * 140}ms, ${delay + i * 140 + 500}ms`;
    b.addEventListener("click", () => showSkillPopup(k));
    list.appendChild(b);
  });
  wrap.appendChild(list);
  return wrap;
}
// サブ魂の成長 (小さな札)
function luSubs(subs, accent) {
  if (!subs || !subs.length) return null;
  const w = el("div", "sp-lu-subs");
  for (const x of subs) {
    const t = el("span", "sp-lu-sub");
    t.appendChild(el("span", "sp-lu-subk", `サブ魂 ${x.label}`));
    const v = el("span", "sp-lu-subv", `Lv${x.from}→${x.to}`);
    if (accent) v.style.color = accent;
    t.appendChild(v);
    w.appendChild(t);
  }
  return w;
}
// 光条・光の輪・立ちのぼる火の粉で包んだ絵
function luArt(sprites, accent, cls = "") {
  const art = el("div", "sp-cel-art lu" + (cls ? " " + cls : ""));
  art.style.setProperty("--ru-accent", accent);
  art.appendChild(el("div", "sp-ru-burst"));
  const rays = el("div", "sp-cel-rays");
  rays.style.background = `repeating-conic-gradient(from 0deg, ${accent}55 0deg 7deg, transparent 7deg 24deg)`;
  art.appendChild(rays);
  for (let i = 0; i < 9; i++) {
    const sp = el("i", "sp-lu-spark");
    sp.style.left = `${8 + ((i * 37) % 84)}%`;
    sp.style.animationDelay = `${(i * 0.23) % 1.6}s`;
    sp.style.animationDuration = `${1.5 + (i % 3) * 0.35}s`;
    art.appendChild(sp);
  }
  const row = el("div", "sp-lu-figs");
  for (const s of sprites) row.appendChild(s);
  art.appendChild(row);
  return art;
}

export function celebrateLevelUp(entries, onClose) {
  const list = (entries || []).filter((e) => e && (e.main || (e.subs || []).length));
  const done = () => { if (typeof onClose === "function") onClose(); };
  if (!list.length) { done(); return null; }
  const learned = list.some((e) => (e.skills || []).some((k) => SPELLS[k]));
  sfx("levelup");
  buzzLv(learned ? [0, 40, 40, 40, 40, 60, 80, 160] : [0, 40, 40, 40, 40, 90]);
  if (learned) { try { if (game.flashScreen) game.flashScreen("#ffe7a0"); } catch (e) { /* 演出のみ */ } }
  if (learned) setTimeout(() => sfx("itemget"), 900);
  const blocks = [];
  const short = typeof window !== "undefined" && window.innerHeight < 720; // 背の低い画面は絵を小さく (1枚に収める)
  let art, title, accent;
  if (list.length === 1) {
    // ---- 1人 (街の強化・1人だけ上がった戦い): 大きな姿と数字、能力を1つずつ ----
    const e = list[0];
    const { soul, clsKey, rank, cl, lv } = luSoul(e);
    accent = cl.glow || "#ffd77a";
    art = luArt([pixelCanvas(jobSprite(clsKey, rank), 96)], accent);
    title = e.name ? `${e.name} が成長した` : `${soulLabel(soul || { clsKey, count: 1 })} が成長した`;
    const who = el("div", "sp-lu-who");
    const label = soulLabel(soul || { clsKey, count: 1 });
    who.appendChild(el("span", "sp-lu-soul", !e.name ? "まだ誰も宿していない魂" : e.main ? label : `サブ魂 ${label}`));
    who.lastChild.style.color = accent;
    blocks.push(who, luLvRow(lv, accent));
    const st = luStats(e, 1150);
    blocks.push(st.grid);
    const sk = luSkills(e.skills, 1250 + st.n * 90);
    if (sk) blocks.push(sk);
    const subs = luSubs(e.main ? e.subs : e.subs.slice(1), accent);
    if (subs) blocks.push(subs);
    if (e.spent) blocks.push(el("div", "sp-fz-note sp-ru-blk", `✦${e.spent} を注いだ`));
    const nx = luNextEl(soul, "sp-ru-blk");
    if (nx) blocks.push(nx);
  } else {
    // ---- 何人も (戦いの後): 並んだ姿と、1人1枚の札を順に光らせる ----
    accent = "#ffd77a";
    const figs = list.slice(0, 6).map((e) => { const { clsKey, rank } = luSoul(e); return pixelCanvas(jobBust(clsKey, rank), short || list.length > 4 ? 36 : 48); });
    art = luArt(figs, accent, "multi");
    title = `${list.length}人が成長した`;
    list.forEach((e, i) => {
      const { soul, clsKey, rank, cl, lv } = luSoul(e);
      const delay = 350 + i * 260;
      const card = el("div", "sp-lu-mem sp-ru-blk");
      card.style.setProperty("--glow", cl.glow || accent);
      card.style.animationDelay = `${delay}ms`;
      card.appendChild(orb(clsKey, rank, 40));
      const t = el("div", "sp-lu-mt");
      const hd = el("div", "sp-lu-mh");
      hd.appendChild(el("b", "sp-lu-mn", e.name || ""));
      const sl = el("span", "sp-lu-ms", e.main ? soulLabel(soul || { clsKey, count: 1 }) : `サブ魂 ${(SOUL_CLASSES[clsKey] || {}).label || ""}`);
      sl.style.color = cl.glow || accent;
      hd.appendChild(sl);
      t.appendChild(hd);
      t.appendChild(luLvRow(lv, cl.glow || accent, { big: false, delay }));
      // 伸びた能力は短い札で (HP+12 STR+3 …)
      const a = e.statsFrom || {}, b = e.statsTo || {};
      const chips = el("div", "sp-lu-chips");
      for (const [k, label] of FUSE_STATS) {
        const d = Math.round(((b[k] || 0) - (a[k] || 0)) * 10) / 10;
        if (d > 0) chips.appendChild(el("span", "sp-lu-c", `${label}+${fmtStat(d)}`));
      }
      if (chips.childElementCount) t.appendChild(chips);
      const subs = luSubs(e.main ? e.subs : e.subs.slice(1), cl.glow || accent);
      if (subs) t.appendChild(subs);
      const sk = luSkills(e.skills, delay + 700, { head: false });
      if (sk) t.appendChild(sk);
      const nx = luNext(soul);
      if (nx && nx.cap) t.appendChild(el("div", "sp-lu-next cap sm", `Lv上限 ${soulLevelCapOf(soul)} に到達`));
      card.appendChild(t);
      blocks.push(card);
    });
  }
  const body = (scroll) => blocks.forEach((b) => scroll.appendChild(b));
  return celebrate({
    banner: "✦ LEVEL UP ✦", accent, art, sparkle: true, className: "sp-cel sp-cel-lu" + (list.length > 1 ? " multi" : ""),
    title, body,
    footer: [{ label: "とじる", kind: "primary", size: "lg", onTap: (h) => h.close("ok") }],
    onClose: done,
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
  registerUI({ trainableList, fusableList, openFusePicker, trainSoul: (uid, n = 1) => train(uid, n), openSoulPicker, celebrateLevelUp, openSoulList, openSoulDetail, openOrderSheet });
}
