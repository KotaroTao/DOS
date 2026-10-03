// ===== 鑑定を試みる — 隊の鑑定の心得で、未鑑定の品を一つずつ確かめる =====
// 「まとめて鑑定」(商会・有料・確実) より先に出す、隊の技による一括鑑定。
// 鑑定は街でのみ。品ごとに、隊と控えの全員から、その品を最も見抜ける者 (成功率の高い者) が鑑定する。判定は1点ずつ:
//   「盾？を鑑定している」→「．」→「．．」→「．．．」→「鑑定成功！」/「鑑定失敗…」
// 成功した品はその場で正体と性能を見せる (装備は最後の一覧でまとめて)。
// 最後に結果の一覧 (成功した品 → 装備。装備した品は一覧から消える / 失敗した品は商会でのみ)。残りは「商会で鑑定」へ続ける。
// 音: 「．」ごとに SFX.appraise(段) が高まり、SFX.appraiseOk (解ける) / appraiseNg (曇る) で答える
// 提供: UI.tryIdentifyInfo() / UI.openTryIdentifyAll()
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, button, setText, toast, reduced } from "./kit.js";
import { statLines, isEquippable, itemCatText } from "./itemview.js";
import { wearPlan, deltaEl, nameSpan, openDollChooser, itemSheet, ownerOf, shopOpen, townAppraisers, revealSellBtn,
  FIRST_LABEL, firstBadge, isFirstGet } from "./loot.js"; // 初ゲット！ = 鑑定で正体を初めて知った品 (game.js の revealIdentity が印をつける)
import { spriteCanvas } from "../sprites.js";
import { identifyChance, identifyLabel } from "../souls.js";
import { itemName } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";

const G = () => game.G || {};
const sfx = (k, ...a) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](...a); } catch (e) { /* 音は演出のみ */ } };
const buzz = (p) => { try { if (game.buzz) game.buzz(p); } catch (e) { /* noop */ } };
const allDolls = () => { try { return game.allDolls ? game.allDolls() : [...(G().party || []), ...(G().reserve || [])]; } catch (e) { return []; } };
const RAR_ORDER = { c: 0, uc: 1, r: 2, sr: 3, lr: 4 };
const DOT = "．";
// 間 (ms)。動きを減らす設定では短く
const T = () => (reduced && reduced()
  ? { dot: 160, okHold: 900, ngHold: 600, okBeat: 250 }
  : { dot: 480, okHold: 1500, ngHold: 1000, okBeat: 700 });

// ---------------------------------------------------------------- 数え上げ
// 鑑定の心得がある者 (街でのみ。隊と控えの生きている全員。迷宮では鑑定できない)
export function appraisers() { return townAppraisers(); }
// 技で試せる未鑑定の品 (隊と控えの所持品。レジェンドレアと失敗済みは商会でのみ)
export function skillTargets() {
  const out = [];
  for (const d of allDolls()) for (const it of (d.items || [])) {
    if (it && it.unidentified && !it.lr && !it.idHardFail) out.push({ item: it, doll: d });
  }
  return out;
}
// その品を最も見抜ける者 { m, ch }
function bestFor(it, men) {
  let b = null;
  for (const m of men) {
    const ch = identifyChance(m, it.lv || 1);
    if (!b || ch > b.ch) b = { m, ch };
  }
  return b;
}
// 「鑑定を試みる」を出せるか: { n, men, top: {m, ch} } (出せなければ null)
export function tryIdentifyInfo() {
  const men = appraisers();
  if (!men.length) return null;
  const list = skillTargets();
  if (!list.length) return null;
  // men = 実際に担当する者 (品ごとの最良の者)。top = その中で最も成功率の高い者
  let top = null;
  const leads = new Set();
  for (const t of list) { const b = bestFor(t.item, men); if (!b) continue; leads.add(b.m); if (!top || b.ch > top.ch) top = b; }
  return { n: list.length, men: [...leads], top };
}

// ---------------------------------------------------------------- 演出
export function openTryIdentifyAll({ onDone } = {}) {
  const men = appraisers();
  if (G().state !== "town") { toast("鑑定は街でしかできない", { tone: "info" }); return null; }
  if (!men.length) { toast("鑑定の心得のある者がいない", { tone: "info" }); return null; }
  // 安い品から順に (最後に逸品が来るほど胸が高鳴る)
  const list = skillTargets().sort((a, b) => (RAR_ORDER[rarityKey(a.item)] || 0) - (RAR_ORDER[rarityKey(b.item)] || 0) || (a.item.lv || 0) - (b.item.lv || 0));
  if (!list.length) { toast("技で鑑定できる品はない", { tone: "info" }); return null; }

  // 担当する者 (品ごとの最良の者。控えも含む)
  const leads = [...new Set(list.map((t) => bestFor(t.item, men).m))];
  const results = []; // { item, doll, m, ok }
  let idx = 0, shown = 1, timer = null, finished = false, h = null;
  let advance = null; // 結果を見せている間に押せば、すぐ次へ

  // ---- 舞台 (高さ一定。品の絵・名・鑑定する者・ドキドキの一行・判明した性能) ----
  const box = el("div", "ap");
  const prog = el("div", "ap-prog");
  const progN = el("span", "ap-prog-n");
  const progBar = el("span", "ap-prog-bar");
  const progFill = el("i");
  progBar.appendChild(progFill);
  prog.appendChild(progN);
  prog.appendChild(progBar);
  box.appendChild(prog);
  const stage = el("button", "ap-stage");
  stage.type = "button";
  stage.setAttribute("aria-live", "polite");
  const art = el("div", "ap-art");
  const name = el("div", "ap-name");
  const who = el("div", "ap-who");
  const msg = el("div", "ap-msg");
  const detail = el("div", "ap-detail");
  stage.appendChild(art);
  stage.appendChild(name);
  stage.appendChild(who);
  stage.appendChild(msg);
  stage.appendChild(detail);
  stage.addEventListener("click", () => { if (advance) { const f = advance; advance = null; clearTimeout(timer); f(); } });
  box.appendChild(stage);
  const tally = el("div", "ap-tally");
  box.appendChild(tally);

  const setProg = () => {
    progN.textContent = `${Math.min(shown, list.length)} / ${list.length}`;
    progFill.style.width = `${Math.round((results.length / list.length) * 100)}%`;
  };
  const drawTally = () => {
    tally.textContent = "";
    for (let i = 0; i < list.length; i++) {
      const r = results[i];
      const k = r ? (r.ok ? "ok" : "ng") : (i === idx ? "now" : "wait");
      const s = el("span", "ap-pip " + k, r ? (r.ok ? "◯" : "✕") : "・");
      if (r && r.ok && rarityKey(r.item)) s.style.color = RARITIES[rarityKey(r.item)].color;
      tally.appendChild(s);
    }
  };
  const paintName = (it) => {
    name.textContent = "";
    const rk = rarityKey(it);
    const n = setText(el("span", "ap-nm" + (rk ? " rar-" + rk : "")), itemName(it));
    if (rk && RARITIES[rk]) n.style.color = RARITIES[rk].color;
    name.appendChild(n);
  };
  const paintArt = (it, cls) => {
    art.textContent = "";
    art.className = "ap-art " + (cls || "");
    const rk = rarityKey(it);
    if (rk && RARITIES[rk]) art.style.setProperty("--edge", RARITIES[rk].color);
    try { art.appendChild(spriteCanvas(it, 4)); } catch (e) { /* 絵は飾り */ }
    if (it.unidentified) art.appendChild(el("span", "ap-seal", "？"));
  };

  const footerRun = () => [{ label: "早送り", sub: "残りを一度に判定", kind: "ghost", onTap: () => fastForward() }];

  // 1点の鑑定を始める
  const step = () => {
    if (finished || (h && h.closed)) return;
    if (idx >= list.length) return finish();
    const t = list[idx];
    // 途中で売る・渡すなどで消えた品・既に判明した品は飛ばす
    if (!t.item.unidentified || t.item.idHardFail || !ownerOf(t.item)) { idx++; return step(); }
    const alive = appraisers();
    const b = bestFor(t.item, alive.length ? alive : men);
    t.best = b;
    shown = idx + 1;
    stage.className = "ap-stage busy";
    paintArt(t.item, "busy");
    paintName(t.item);
    who.textContent = `${b.m.name} が鑑定する ・ ${identifyLabel(b.m)} ${Math.round(b.ch * 100)}%`;
    detail.textContent = "";
    setProg(); drawTally();
    const base = `${itemName(t.item)}を鑑定している`;
    let dots = 0;
    msg.className = "ap-msg";
    msg.textContent = base;
    const tick = () => {
      if (finished || (h && h.closed)) return;
      if (dots < 3) {
        dots++;
        msg.textContent = base + DOT.repeat(dots);
        sfx("appraise", dots);
        timer = setTimeout(tick, T().dot + dots * 60); // 少しずつ間が延びる
        return;
      }
      reveal(t);
    };
    timer = setTimeout(tick, T().dot);
  };

  // 判定して結果を見せる
  const reveal = (t) => {
    const ok = game.doIdentifySkill ? !!game.doIdentifySkill(t.best.m, t.item, { quiet: true }) : false;
    const first = ok && isFirstGet(t.item);
    results.push({ item: t.item, doll: t.doll, m: t.best.m, ok, first });
    const it = t.item;
    if (ok) {
      it.isNew = true;
      stage.className = "ap-stage ok";
      paintArt(it, "ok");
      paintName(it);
      msg.className = "ap-msg ok";
      msg.textContent = "鑑定成功！";
      if (first) msg.appendChild(firstBadge("ap-first"));
      const rk = rarityKey(it);
      const big = rk === "sr" || rk === "lr";
      sfx("appraiseOk");
      if (big) sfx("levelup");
      buzz(big ? [0, 60, 50, 60, 50, 120] : [0, 20, 30, 20]);
      detail.textContent = "";
      const cat = itemCatText(it);
      const rl = RARITIES[rk] ? RARITIES[rk].label : "";
      detail.appendChild(el("div", "ap-grade", [rl, cat].filter(Boolean).join(" ・ ")));
      const st = statLines(it);
      if (st) detail.appendChild(el("div", "ap-stat", st));
    } else {
      stage.className = "ap-stage ng";
      paintArt(it, "ng");
      msg.className = "ap-msg ng";
      msg.textContent = "鑑定失敗…";
      sfx("appraiseNg");
      buzz([0, 30, 40, 30]);
      detail.textContent = "";
      detail.appendChild(el("div", "ap-fail", `${t.best.m.name}には見抜けなかった。もう商会でしか鑑定できない。`));
    }
    idx++;
    setProg(); drawTally();
    // 初ゲットの成功だけ: 一拍おいて図鑑と同じ品の画面 (「鑑定成功した！」つき) を重ねる。閉じたら次の品へ
    // (入手したことのある品は画面を出さず、少し見せてそのまま次の品へ)
    const pop = first && !!UI.codexItemSheet;
    advance = pop ? () => openDetail(it, first) : () => step();
    timer = setTimeout(() => { const f = advance; advance = null; if (f) f(); }, ok ? (pop ? T().okBeat : T().okHold) : T().ngHold);
  };

  // 鑑定に成功した品の詳細 (能力・説明文)。「次へ」で続ける / 「早送り」で残りを一度に
  const openDetail = (it, first) => {
    if (finished || (h && h.closed)) return;
    const more = list.slice(idx).some((x) => x.item.unidentified && !x.item.idHardFail && ownerOf(x.item));
    const ds = UI.codexItemSheet(it.id, {
      item: it, heading: "鑑定成功した！", headingColor: "#7fd0ff", badge: first ? FIRST_LABEL : null,
      footer: [
        ...(more ? [{ label: "早送り", sub: "残りを一度に判定", kind: "ghost", onTap: (x) => x.close("ff") }] : []),
        { label: more ? "次へ" : "結果を見る", kind: "primary", onTap: (x) => x.close("next") },
      ],
      onClose: (why) => { if (why === "ff") fastForward(); else step(); },
    });
    if (!ds) step();
  };

  // 残りを一度に判定して、結果の一覧へ
  const fastForward = () => {
    if (finished) return;
    clearTimeout(timer);
    advance = null;
    const alive = appraisers();
    for (; idx < list.length; idx++) {
      const t = list[idx];
      if (!t.item.unidentified || t.item.idHardFail || !ownerOf(t.item)) continue;
      const b = bestFor(t.item, alive.length ? alive : men);
      const ok = game.doIdentifySkill ? !!game.doIdentifySkill(b.m, t.item, { quiet: true }) : false;
      if (ok) t.item.isNew = true;
      results.push({ item: t.item, doll: t.doll, m: b.m, ok, first: ok && isFirstGet(t.item) });
    }
    sfx(results.some((r) => r.ok) ? "appraiseOk" : "appraiseNg");
    finish();
  };

  // 結果の一覧 (成功 → 詳細・装備 / 失敗 → 商会で)
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    advance = null;
    if (game.autosave) game.autosave(true);
    if (game.renderTown && G().state === "town") game.renderTown();
    if (!h || h.closed) { if (onDone) onDone(results); return; }
    const okN = results.filter((r) => r.ok).length;
    const ngN = results.length - okN;
    h.update({
      banner: "鑑定の結果",
      title: okN ? `${okN}点の鑑定に成功` : "鑑定できなかった…",
      lines: [`成功 ${okN} ・ 失敗 ${ngN}${ngN ? " (失敗した品は商会でのみ鑑定できる)" : ""}`],
      body: (b) => buildSummary(b),
      footer: summaryFooter(),
    });
    if (onDone) onDone(results);
  };

  // 品のシート・装備の選択を閉じたら一覧を描き直す (装備した品は消える)
  const refreshOnClose = (ch) => {
    if (!ch || !ch.opts) return;
    const prev = ch.opts.onClose;
    ch.opts.onClose = (why) => { if (prev) prev(why); if (h && !h.closed) h.update({ body: (bb) => buildSummary(bb) }); };
  };
  const buildSummary = (b) => {
    const wrap = el("div", "wpc-picklist ap-sum");
    let worn = 0;
    for (const r of results.filter((x) => x.ok)) {
      const it = r.item;
      const o = ownerOf(it);
      if (!o) continue;
      if (o.where === "equip") { worn++; continue; } // 装備した品は一覧から消す
      const row = el("div", "wpc-prow");
      const main = el("button", "wpc-prow-main");
      main.type = "button";
      const rk = rarityKey(it);
      const ic = el("span", "wpc-srow-ic" + (rk ? " rar-" + rk : ""));
      if (rk) ic.style.setProperty("--edge", RARITIES[rk].color);
      ic.appendChild(spriteCanvas(it, 3));
      main.appendChild(ic);
      const tx = el("span", "wpc-prow-t");
      if (r.first) {
        const nm = el("span", "ap-sum-name");
        nm.appendChild(nameSpan(it, "wpc-prow-title"));
        nm.appendChild(firstBadge());
        tx.appendChild(nm);
      } else tx.appendChild(nameSpan(it, "wpc-prow-title"));
      const sub = el("span", "wpc-prow-sub");
      const plan = isEquippable(it) ? wearPlan(it, { owner: o.doll }) : null;
      const up = plan && plan.target && plan.delta && plan.score > 0;
      if (up) { sub.appendChild(deltaEl(plan.delta)); sub.appendChild(el("span", "wpc-srow-who", plan.target.name)); }
      else sub.appendChild(document.createTextNode(`${statLines(it) || itemCatText(it)} ・ ${o.doll.name}`));
      tx.appendChild(sub);
      main.appendChild(tx);
      main.addEventListener("click", () => refreshOnClose(itemSheet(it, { owner: o.doll, context: "bag" })));
      row.appendChild(main);
      if (isEquippable(it)) {
        const eb = button({ label: "装備", kind: up ? "primary" : "secondary", size: "sm", onTap: () => refreshOnClose(openDollChooser(it, { owner: o.doll })) });
        eb.classList.add("wpc-prow-act");
        row.appendChild(eb);
      }
      if (o.where === "bag" && shopOpen()) row.appendChild(revealSellBtn(o.doll, it, () => { if (h && !h.closed) h.update({ body: (bb) => buildSummary(bb) }); }));
      wrap.appendChild(row);
    }
    if (worn) wrap.appendChild(el("div", "ap-sum-worn", `装備した品 ${worn}点は一覧から外した。`));
    const sold = results.filter((x) => x.ok && !ownerOf(x.item)).length;
    if (sold) wrap.appendChild(el("div", "ap-sum-worn", `売った品 ${sold}点は一覧から外した。`));
    const fails = results.filter((x) => !x.ok);
    if (fails.length) {
      const f = el("div", "ap-sum-fail");
      f.appendChild(el("span", "ap-sum-fail-l", "見抜けなかった品"));
      f.appendChild(el("span", "ap-sum-fail-n", fails.map((x) => itemName(x.item)).join("・")));
      wrap.appendChild(f);
    }
    if (!wrap.childElementCount) wrap.appendChild(el("div", "wpc-empty", "正体の知れた品はない。"));
    b.appendChild(wrap);
  };

  const summaryFooter = () => {
    const out = [];
    let left = [];
    for (const d of allDolls()) for (const it of (d.items || [])) if (it && it.unidentified) left.push(it);
    if (left.length && shopOpen() && UI.confirmIdentifyAll) {
      const cost = game.appraiseCost ? left.reduce((a, it) => a + game.appraiseCost(it), 0) : 0;
      out.push({ label: "残りを商会で鑑定", sub: `${left.length}点 ・ 必ずわかる`, cost: cost ? { kind: "gold", n: cost } : null, kind: "secondary",
        onTap: (x) => { x.close("shop"); UI.confirmIdentifyAll(); } });
    }
    out.push({ label: "閉じる", kind: "primary", onTap: (x) => x.close("done") });
    return out;
  };

  h = sheet.open({
    kind: "info", banner: "鑑定を試みる", accent: "#7fd0ff", className: "ap-sheet",
    title: `${list.length}点を鑑定する`,
    lines: [leads.length > 1 ? `品ごとに、隊と控えで最も目の利く者が鑑定する (${leads.map((m) => m.name).join("・")})。` : `隊と控えで最も目の利く ${leads[0].name} が鑑定する。`, "失敗した品は、もう商会でしか鑑定できない。"],
    body: box,
    footer: footerRun(),
    onClose: () => {
      clearTimeout(timer);
      // 途中で閉じた: 判定を終えた分だけ保存して街を描き直す (残りは未鑑定のまま)
      if (!finished) {
        finished = true;
        if (game.autosave) game.autosave(true);
        if (game.renderTown && G().state === "town") game.renderTown();
        if (onDone) onDone(results);
      }
    },
  });
  setProg(); drawTally();
  timer = setTimeout(step, 450);
  return h;
}

export function install() {
  registerUI({ tryIdentifyInfo, openTryIdentifyAll });
}
