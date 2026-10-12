import { bagItems, bagSortControl } from "./bagsort.js";
import { bagOwners, MAX_ITEMS } from "../items.js";
// ===== 無限迷宮の画面 — 入口の魂の3択・風だまり (回収人・灯番・主)・全滅・帰ってきた時の結果 =====
// docs/infinite-labyrinth.md。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約:
//   UI.openInfSetup()        … 出撃シートの「無限迷宮」から。仮の器6体それぞれに、3つの魂の欠片から1つを選んで降りる
//   UI.openInfRest(spec)     … 5の倍数の階の階段 (風だまり)。spec = { floor, guardDown, onBoss, onReturn, onContinue, onClose }
//   UI.openInfWipe(spec)     … 無限迷宮で全滅した。赤い魂 (全滅した階の数・上限100) で持ち帰るか、あきらめるか
//   UI.openInfSummary(r)     … 帰ってきた (game.js infCloseRun の結果)。持ち帰った魂 (＋1 の素材)・品 (商会の棚へ)・残火

import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, button, row, toast, itemTile, portrait, confirm as kitConfirm, uiBlocked } from "./kit.js";
import { SOUL_CLASSES, jobBust, soulByUid, soulLabel, soulLevelCapOf, soulRankOf, jobStatsOf, MAX_SUBS, passiveName } from "../souls.js";
import { SPELLS } from "../combat.js";
import { crispCanvas } from "../sprites.js";
import { ICONS } from "../sprites.js";
import { INF_NAME, INF_PARTY, VESSEL_NAMES, rollStartSouls, infLevel, infRedCost, INF_RULES } from "../abyss.js";
import { openTrainSheet, openSkillStep } from "./soulpanel.js";
import { ITEMS, itemName, useLines } from "../items.js";

const G = () => game.G;
// Lv上限に届いた魂を、灯番で伸ばせるか (残火か、✦Soul = いまの Lv から次の Lv へ上がるのと同じだけ)
const capRaisable = (s) => (G().embers || 0) > 0 || (G().soulPts || 0) >= (game.raiseCapSoulCost ? game.raiseCapSoulCost(s) : Infinity);
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音は演出のみ */ } };
const RAR = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" };
const STAT_L = [["hp", "HP"], ["mp", "MP"], ["atk", "STR"], ["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["luk", "LUK"]];

function bust(clsKey, size = 44) {
  const w = el("span", "inf-bust");
  try { w.appendChild(crispCanvas(jobBust(clsKey, 1), size)); } catch (e) { /* 絵が無くても動く */ }
  return w;
}
function statLine(clsKey, entry) {
  const st = jobStatsOf(clsKey, entry || { count: 1, level: 1 });
  return STAT_L.map(([k, l]) => `${l}${Math.round(st[k] || 0)}`).join(" ");
}

// 品の行方 (2026-10-12 ユーザーの指示: 全滅した時に何が残るかをわかりやすく)。
// 回収人に売った品 = その場で本編の商会の棚へ (全滅しても残る) / 装備・持ち物 = 全滅すると失われる (赤い魂で持ち帰れば商会の棚へ)
function itemRule() {
  const w = el("div", "inf-rule");
  w.appendChild(el("div", "inf-rule-h", "品の行方"));
  const line = (cls, mark, head, text) => {
    const r = el("div", "inf-rule-r " + cls);
    r.appendChild(el("span", "inf-rule-m", mark));
    const t = el("span", "inf-rule-t");
    t.appendChild(el("b", null, head));
    t.appendChild(document.createTextNode(text));
    r.appendChild(t);
    w.appendChild(r);
  };
  line("keep", "残る", "回収人に売った品", " ― 売ったその場で本編の商会の棚に並ぶ。この先で全滅しても消えない。");
  line("lose", "失う", "装備している品・持ち物", " ― 全滅すると失われる。赤い魂を払って持ち帰るか、主を討って帰れば、商会の棚に並ぶ。");
  return w;
}

// ================= 入口: 魂の欠片の3択 (仮の器6体ぶん) =================
// 3つはコモンとレアだけ・すべて違う職業・ほかの器が選んだ職業は出ない (abyss.js rollStartSouls)。
// 選ばなかった職業は次の器の3択にまた出ることがある。選び直しはできない (やめれば最初から)
export function openInfSetup() {
  const g = G();
  if (!g || g.state !== "town") return null;
  const picks = [];
  let offer = rollStartSouls([]);
  let h = null;
  // 器の名 = いまの隊の人業の名 (game.js infVesselNames。足りなければ「〜の器」)
  const names = (game.infVesselNames ? game.infVesselNames() : []).map((x) => x && x.name);
  const nameOf = (i) => names[i] || VESSEL_NAMES[i];
  const step = () => picks.length;
  const fill = (b) => {
    b.appendChild(el("div", "inf-note", "入口の風が、育って重くなった魂を吹き返す。人業はそのままでは降りられない。隊の者は魂のほんのひとかけを土くれの仮の器に移し、そこへ漂う「名もなき魂の欠片」を宿して戦う力にする。育った力は風に置いてゆくが、記憶だけは器に残る。"));
    // 選び終えた器
    const done = el("div", "inf-picked");
    for (let i = 0; i < INF_PARTY; i++) {
      const c = el("div", "inf-pk" + (i === step() ? " now" : i < step() ? " done" : ""));
      if (picks[i]) c.appendChild(bust(picks[i], 30));
      else c.appendChild(el("span", "inf-pk-q", i === step() ? "？" : ""));
      c.appendChild(el("span", "inf-pk-n", nameOf(i)));
      done.appendChild(c);
    }
    b.appendChild(done);
    if (step() >= INF_PARTY) {
      b.appendChild(el("div", "inf-h", "隊がそろった"));
      for (let i = 0; i < INF_PARTY; i++) {
        const k = picks[i], cl = SOUL_CLASSES[k] || {};
        b.appendChild(row({ icon: bust(k, 32), title: `${nameOf(i)} ― ${cl.label}の魂`, sub: `${RAR[cl.rarity] || ""} ・ Lv1 ・ ${statLine(k)}` }));
      }
      b.appendChild(el("div", "inf-note dim", "全員 Lv1・装備なし・持ち物なし。魂の安定度は使わない (本編の人業は街で待っている)。最初に宿した欠片は、帰る時に迷宮へ還る (持ち帰れない)。器が崩れても、記憶は人業のもとへ帰る。"));
      b.appendChild(itemRule());
      return;
    }
    b.appendChild(el("div", "inf-h", `${names[step()] ? `${names[step()]}の器` : VESSEL_NAMES[step()]}に宿す魂を選ぶ`));
    for (const k of offer) {
      const cl = SOUL_CLASSES[k] || {};
      const r = el("button", "inf-choice");
      r.type = "button";
      if (cl.glow) r.style.setProperty("--glow", cl.glow);
      r.appendChild(bust(k, 48));
      const tx = el("span", "inf-choice-t");
      const nm = el("span", "inf-choice-n", `${cl.label}の魂`);
      if (cl.glow) nm.style.color = cl.glow;
      tx.appendChild(nm);
      tx.appendChild(el("span", "inf-choice-r", RAR[cl.rarity] || ""));
      tx.appendChild(el("span", "inf-choice-s", statLine(k)));
      r.appendChild(tx);
      r.addEventListener("click", () => {
        sfx("select");
        picks.push(k);
        if (picks.length < INF_PARTY) offer = rollStartSouls(picks);
        h.update({ body: fill, footer: footer() });
        if (h.body) h.body.scrollTop = 0;
      });
      b.appendChild(r);
    }
    if (game.showCodexJobDetail) {
      const info = el("div", "inf-codex");
      for (const k of offer) info.appendChild(button({ label: `${(SOUL_CLASSES[k] || {}).label}を職業図鑑で見る`, kind: "ghost", size: "sm", onTap: () => game.showCodexJobDetail(k) }));
      b.appendChild(info);
    }
  };
  const footer = () => step() >= INF_PARTY
    ? [{ label: `${INF_NAME}へ降りる`, sub: "B1F から", kind: "primary", size: "lg", onTap: (x) => { x.close("ok", { silent: true }); if (game.departAbyss) game.departAbyss([...picks]); } },
       { label: "選び直す", kind: "ghost", onTap: () => { picks.length = 0; offer = rollStartSouls([]); h.update({ body: fill, footer: footer() }); } }]
    : [{ label: "やめる", kind: "ghost", onTap: (x) => x.close() }];
  h = sheet.open({ kind: "info", banner: `${INF_NAME} ― 入口`, accent: "#8e6fd0", className: "inf-sheet", body: fill, footer: footer() });
  return h;
}

// ================= 風だまり =================
// サブ魂の空き枠に宿せる魂があるのに離れようとしたら知らせる (2026-10-12 ユーザーの指示)。
// 「このまま離れる」を選んだ階では、もう知らせない
let subNagFloor = null;
function subChances() {
  const g = G();
  if (!g || !game.infSubBlock) return [];
  const out = [];
  for (const d of g.party || []) {
    if (!d || !d.alive || !d.primary) continue;
    const si = (d.subs || []).length; // 空いた枠のうち最初の枠 (外すと詰めて並ぶ)
    if (si >= MAX_SUBS) continue;
    const n = (g.souls || []).filter((s) => s && s.uid !== d.primary && !game.infSubBlock(d, si, s.uid)).length;
    if (n) out.push({ d, si, n });
  }
  return out;
}
// 離れてよければ true。残るなら onStay(候補) を呼んで false
async function subLeaveOk(onStay) {
  const g = G();
  if (!g || subNagFloor === g.floor) return true;
  const list = subChances();
  if (!list.length) return true;
  const ok = await kitConfirm({ banner: "灯番", title: "サブ魂に宿せる魂がある",
    lines: [...list.map((c) => `${c.d.name} ― サブ魂${c.si + 1}が空いている (宿せる魂 ${c.n}つ)`), "サブ魂は風だまりの灯番でしか付け替えられない。"],
    okLabel: "このまま離れる", cancelLabel: "サブ魂を選ぶ", danger: false });
  if (ok) { subNagFloor = g.floor; return true; }
  if (onStay) onStay(list);
  return false;
}

export function openInfRest(spec = {}) {
  const g = G();
  if (!g) return null;
  let h = null, closing = false;
  const fill = (b) => {
    const lv = Math.round(infLevel(spec.floor || g.floor));
    b.appendChild(el("div", "inf-note", spec.guardDown
      ? "吹き上げる風が止んだ踊り場。主は討った。ここから地上へ帰るか、さらに深くへ降りるかを選ぶ。"
      : "吹き上げる風が止む踊り場。古い灯籠のそばに、商会の回収人と、名もない人業の灯番がいる。その奥で、主が待っている。"));
    b.appendChild(el("div", "inf-cur", `所持 💰${g.gold || 0} ・ ✦${g.soulPts || 0} ・ 残火 ${g.embers || 0} ・ 推奨Lv ${lv}`));
    b.appendChild(healAllRow(() => h && !h.closed && h.update({ body: fill })));
    b.appendChild(row({ icon: ICONS.chest, title: "回収人 (商会の者)", sub: "品の買い取り (売った品はすぐ商会の棚へ ― 全滅しても残る)・回復の道具・反魂香・風切りの羽・鍛え直し", chevron: true, onTap: () => { sfx("select"); openTrader(() => h && !h.closed && h.update({ body: fill })); } }));
    b.appendChild(row({ icon: ICONS.portal, title: "灯番 (名もない人業)", sub: "メイン魂・サブ魂の付け替え・✦Soul で魂の強化・残火で Lv上限 +1", chevron: true, onTap: () => { sfx("select"); openKeeper(() => h && !h.closed && h.update({ body: fill })); } }));
    if (spec.guardDown) {
      b.appendChild(el("div", "inf-note dim", "帰れば: 拾った魂は ＋1 の素材として本編の魂に加わる (Lv は残らない)。品は商会の棚に並ぶ。残火は拾った数だけ本編へ。金貨と ✦Soul、最初に宿した欠片は残らない。"));
      const next = INF_RULES.filter((r) => r.from > (spec.floor || g.floor) && r.from <= (spec.floor || g.floor) + 5);
      if (next.length) b.appendChild(el("div", "inf-note warn", `この先、風の掟がさらに強まる (「${next.map((r) => r.name).join("」「")}」…)。`));
    }
  };
  const footer = () => spec.guardDown
    ? [{ label: "帰る", sub: "拾ったものを持ち帰る", kind: "primary", size: "lg", onTap: async (x) => {
        // 押し間違えで出撃を終えないよう、帰る前に確かめる (2026-10-11 ユーザーの指示)
        const run = g.run || {};
        const souls = (run.souls || []).length, embers = Math.max(0, run.embers || 0);
        const ok = await kitConfirm({ banner: "地上へ帰る", title: `B${spec.floor || g.floor}F から地上へ帰る？`,
          lines: [`この出撃はここで終わり、${INF_NAME}には戻れない。`, `持ち帰る: 拾った魂 ${souls}つ (＋1 の素材)・品 (商会の棚へ)・残火 ${embers}。`, "金貨・✦Soul・最初に宿した欠片は残らない。"],
          okLabel: "帰る", cancelLabel: "まだ帰らない", danger: false });
        if (!ok || x.closed) return;
        closing = true; x.close("ok", { silent: true }); spec.onReturn && spec.onReturn(); } },
       { label: `続ける ― B${(spec.floor || g.floor) + 1}Fへ`, kind: "secondary", onTap: (x) => leave(x, () => { closing = true; x.close("ok", { silent: true }); spec.onContinue && spec.onContinue(); }) },
       { label: "まだ探索する", kind: "ghost", onTap: (x) => leave(x, () => x.close()) }]
    : [{ label: "主に挑む", kind: "danger", size: "lg", onTap: (x) => leave(x, () => { closing = true; x.close("ok", { silent: true }); spec.onBoss && spec.onBoss(); }) },
       { label: "まだ探索する", kind: "ghost", onTap: (x) => leave(x, () => x.close()) }];
  // 風だまりを離れる前に、サブ魂の空きを知らせる (残るなら灯番を開く。帰る時は出撃が終わるので知らせない)
  const keeper = () => openKeeper(() => h && !h.closed && h.update({ body: fill }));
  let asking = false;
  const leave = async (x, go) => {
    if (asking || x.closed) return;
    asking = true;
    const ok = await subLeaveOk(() => keeper());
    asking = false;
    if (ok && !x.closed) go();
  };
  h = sheet.open({ kind: "info", banner: `✦ 風だまり B${spec.floor || g.floor}F ✦`, accent: "#8e6fd0", className: "inf-sheet",
    body: fill, footer: footer(), onBack: (x) => leave(x, () => x.close("back")), onBackdrop: (x) => leave(x, () => x.close("backdrop")),
    onClose: () => { if (!closing && spec.onClose) spec.onClose(); } });
  return h;
}

// ---- 道具で全回復 (2026-10-12 ユーザーの指示): 回収人の回復の道具を一番安く済む組み合わせで買い、その場で使って
// HP・MP・状態異常・砕けた器をすべて治す (組み合わせは game.js infHealPlan)。買う前に品と金貨を確かめる
function healAllRow(redraw) {
  const g = G();
  const plan = game.infHealPlan ? game.infHealPlan() : null;
  const short = plan && plan.hurt && plan.steps.length && (g.gold || 0) < plan.cost;
  const sub = !plan ? "" : !plan.hurt ? "隊はみな無事だ"
    : !plan.steps.length ? `回収人の棚に${plan.missing[0] || "回復の道具"}が無い`
    : `回収人の道具を一番安く済む組で買って使い、HP・MP・状態異常・砕けた器を治す ― 💰${plan.cost}${short ? " (金貨が足りない)" : ""}${plan.missing.length ? ` ・ ${plan.missing.join("・")}は棚に無い` : ""}`;
  const off = !plan || !plan.hurt || !plan.steps.length || short;
  const r = row({ icon: ICONS.fountain || ICONS.portal, title: "道具で全回復", sub, tone: off ? "dim" : null, chevron: !off,
    onTap: off ? null : async () => {
      sfx("select");
      const p = game.infHealPlan();
      const ok = await kitConfirm({ banner: "道具で全回復", title: `💰${p.cost} で隊を全快させる？`,
        lines: [`買って使う: ${p.buys.map((b) => `${b.name}×${b.k}`).join("・")}`, `所持 💰${g.gold || 0} → 💰${(g.gold || 0) - p.cost}`, ...(p.missing.length ? [`${p.missing.join("・")}は棚に無く、治しきれない。`] : [])],
        okLabel: "買って使う", cancelLabel: "やめる", danger: false });
      if (ok && game.infHealAll && game.infHealAll()) redraw();
    } });
  return r;
}

// ---- 回収人 ----
// 売り買いの行: 行を押すと品の詳細 (onPeek)、右の金額の隣のボタンで売り買い (onAct)
function tradeRow(o) {
  const right = el("span", "inf-sell-r");
  right.appendChild(el("span", "inf-sell-p", `💰${o.price}`));
  right.appendChild(button({ label: o.label, kind: "primary", size: "sm", disabled: !!o.disabled,
    onTap: (e) => { if (e) e.stopPropagation(); o.onAct(); } }));
  const r = row({ icon: o.icon, title: o.title, sub: o.sub, right });
  r.classList.add("tap", "inf-sell-row");
  r.setAttribute("role", "button");
  r.tabIndex = 0;
  const peek = () => { sfx("select"); o.onPeek(); };
  r.addEventListener("click", (e) => { if (e.target.closest(".ui-btn")) return; peek(); });
  r.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === r) { e.preventDefault(); peek(); } });
  return r;
}
function openTrader(onChange) {
  const g = G();
  let seg = "buy", h = null;
  // 描き直しても、見ていた所 (縦のスクロール) はそのまま
  const refresh = () => {
    if (h && !h.closed) { const y = h.body ? h.body.scrollTop : 0; h.update({ body: fill }); if (h.body) h.body.scrollTop = y; }
    if (onChange) onChange();
  };
  // 隊の持ち物にその品がいくつあるか (装備中は数えない)
  const held = (id) => bagOwners(g.party).reduce((n, d) => n + (d.items || []).filter((x) => x && x.id === id).length, 0);
  const fill = (b) => {
    b.appendChild(el("div", "inf-cur", `所持 💰${g.gold || 0}`));
    b.appendChild(el("div", "inf-cur", `隊の持ち物 ${g.inventory.length}/${MAX_ITEMS}`));
    const segs = el("div", "ui-seg");
    for (const [k, l] of [["buy", "買う"], ["sell", "売る"], ["forge", "鍛え直し"]]) {
      const x = el("button", "ui-seg-b" + (k === seg ? " on" : ""), l);
      x.type = "button";
      x.addEventListener("click", () => { seg = k; sfx("select"); h.update({ body: fill }); });
      segs.appendChild(x);
    }
    b.appendChild(segs);
    if (seg === "buy") {
      b.appendChild(el("div", "inf-note dim", "回復の道具は深い階ほど強いものが並ぶ。風切りの羽 (浮遊) はいつも売っている。"));
      for (const id of (game.infTraderWares ? game.infTraderWares() : [])) {
        const it = ITEMS[id];
        if (!it) continue;
        const price = game.buyPrice ? game.buyPrice(it) : 30;
        const buy = () => { if (game.infBuy && game.infBuy(id)) { refresh(); return true; } return false; };
        const sub = el("span", "ui-row-sub");
        sub.appendChild(el("span", "inf-held" + (held(id) ? "" : " none"), `手持ち ${held(id)}個`));
        const eff = useLines(it).join(" ・ ") || it.desc || "";
        if (eff) sub.appendChild(document.createTextNode(` ・ ${eff}`));
        // 行を押すと品の詳細、右の「買う」で買う (2026-10-11 ユーザーの指示)
        b.appendChild(tradeRow({ icon: itemTile(it, { size: 44 }), title: it.name, sub, price, label: "買う", onAct: buy,
          onPeek: () => { if (UI.codexItemSheet) UI.codexItemSheet(id, { footer: [
            { label: `買う 💰${price}`, kind: "primary", onTap: () => { buy(); } },
            { label: "閉じる", kind: "ghost", onTap: (x) => x.close() }] }); } }));
      }
    } else if (seg === "sell") {
      b.appendChild(bagSortControl(refresh));
      b.appendChild(itemRule());
      b.appendChild(el("div", "inf-note dim", "売った代金の金貨は、この出撃の間だけ使える (帰ると残らない)。装備している品は、外してから売れる。"));
      let any = false;
      for (const d of bagOwners(g.party || [])) for (const it of bagItems(d.items)) {
        if (!it) continue;
        any = true;
        const price = game.sellPrice ? game.sellPrice(it) : 1;
        // 行を押すと品の詳細、右の「売る」で売る (2026-10-11 ユーザーの指示: 押しただけで売れていた)
        b.appendChild(tradeRow({ icon: itemTile(it, { size: 44 }), title: itemName(it), sub: `隊の持ち物${it.locked ? " ・ ロック中" : ""}`,
          price, label: "売る", disabled: !!it.locked,
          onAct: () => {
            // 商会の棚に、同じ品の追加つきの1点がもうある: どちらの追加の能力を棚に残すか、売る前に選ぶ
            const clash = game.shopAfxClash ? game.shopAfxClash(it) : null;
            if (clash) { openSellClash(clash).then((keep) => { if (keep && game.infSell && game.infSell(d, it, keep)) refresh(); }); return; }
            if (game.infSell && game.infSell(d, it)) refresh();
          },
          onPeek: () => { if (UI.itemSheet) UI.itemSheet(it, { owner: d, context: "dungeon", onClose: refresh }); } }));
      }
      if (!any) b.appendChild(el("div", "inf-note", "持ち物に売れる品が無い。"));
    } else {
      b.appendChild(el("div", "inf-note dim", "金貨を払って装備の品質 (0〜100) を引き直す。本編の商会の鍛え直しと同じ。"));
      let any = false;
      const seen = new Set();
      for (const d of g.party || []) {
        const list = [...Object.values(d.equip || {}), ...(d.items || [])].filter((it) => it && it.id && !seen.has(it) && (seen.add(it), true));
        for (const it of list) {
          const why = game.reforgeBlock ? game.reforgeBlock(d, it, { gold: false }) : "—";
          if (why) continue;
          any = true;
          const cost = game.reforgeCost ? game.reforgeCost(it) : 0;
          b.appendChild(row({ icon: itemTile(it, { size: 44 }), title: itemName(it), sub: `${d.name} ・ 品質 ${it.q == null ? 50 : it.q}`, right: `💰${cost}`,
            onTap: () => { if (UI.openReforge) UI.openReforge(it, d, { onDone: refresh, onClose: refresh }); } })); // 品質を選んだらすぐ一覧と所持金を描き直す
        }
      }
      if (!any) b.appendChild(el("div", "inf-note", "鍛え直せる装備が無い。"));
    }
  };
  h = sheet.open({ kind: "info", banner: "回収人", title: "商会の回収人", accent: "#c9a227", className: "inf-sheet", body: fill,
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => x.close() }], onClose: () => { if (onChange) onChange(); } });
  return h;
}

// ---- 灯番 ----
function openKeeper(onChange) {
  const g = G();
  let h = null;
  const fill = (b) => {
    b.appendChild(el("div", "inf-note", "灯番は何も語らない。灯籠の火で、器と魂の欠片をつなぎ直してくれる。"));
    b.appendChild(el("div", "inf-cur", `所持 ✦${g.soulPts || 0} ・ 残火 ${g.embers || 0}`));
    b.appendChild(el("div", "inf-h", "仮の器"));
    for (const d of g.party || []) {
      const s = soulByUid(d.primary);
      const card = el("div", "inf-vessel" + (d.alive ? "" : " dead"));
      const redraw = () => { if (!h.closed) h.update({ body: fill }); if (onChange) onChange(); };
      // 肖像・名前・能力の行を押すと、その器の詳細 (隊の様子: 装備・魂・能力) — 2026-10-12 ユーザーの指示
      const detail = () => { sfx("select"); if (UI.openParty) UI.openParty(d, { context: "dungeon", onClose: redraw }); };
      card.appendChild(portrait(d, { size: 48, onTap: detail }));
      const tx = el("div", "inf-vessel-t");
      const hit = el("button", "inf-vessel-hit");
      hit.type = "button";
      hit.title = "器の詳細を見る";
      const nm = el("div", "inf-vessel-n", `${d.name}${d.alive ? "" : " (砕けた)"}`);
      nm.appendChild(el("span", "inf-vessel-go", "詳細 ›"));
      hit.appendChild(nm);
      hit.appendChild(el("div", "inf-vessel-s", s ? `${soulLabel(s)} ・ Lv${s.level}/${soulLevelCapOf(s)} ・ HP ${d.hp}/${d.maxhp} ・ MP ${d.mp}/${d.maxmp}` : "魂が無い"));
      hit.appendChild(el("div", "inf-vessel-s", `サブ魂 ${subSummary(d)}`));
      hit.addEventListener("click", detail);
      tx.appendChild(hit);
      const acts = el("div", "inf-vessel-a");
      if (s) acts.appendChild(button({ label: "魂を強化", kind: "secondary", size: "sm", onTap: () => openTrainSheet(s.uid, redraw) }));
      acts.appendChild(button({ label: "魂を替える", kind: "secondary", size: "sm", disabled: !d.alive, onTap: () => openSwap(d, redraw) }));
      acts.appendChild(button({ label: "サブ魂", kind: "secondary", size: "sm", disabled: !d.alive, onTap: () => openSubs(d, redraw) }));
      tx.appendChild(acts);
      card.appendChild(tx);
      b.appendChild(card);
    }
    // 魂一覧: 持っている魂をすべて並べ、どの魂も ✦Soul・残火で強化できる (メイン魂・サブ魂・宿していない魂とも。
    // 人業の館の魂一覧にならう — 2026-10-12 ユーザーの指示)。行を押すとその職業の図鑑
    soulList(b, () => { if (!h.closed) h.update({ body: fill }); if (onChange) onChange(); });
  };
  // 離れる前に、サブ魂の空きを知らせる (残るなら、空きのある器が1体だけならそのサブ魂の画面を開く)
  let asking = false;
  const leave = async (x, reason) => {
    if (asking || x.closed) return;
    asking = true;
    const ok = await subLeaveOk((list) => {
      if (list.length === 1 && !h.closed) openSubs(list[0].d, () => { if (!h.closed) h.update({ body: fill }); if (onChange) onChange(); });
    });
    asking = false;
    if (ok && !x.closed) x.close(reason);
  };
  h = sheet.open({ kind: "info", banner: "灯番", title: "灯籠のそばの人業", accent: "#7fd0ff", className: "inf-sheet", body: fill,
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => leave(x, "close") }],
    onBack: (x) => leave(x, "back"), onBackdrop: (x) => leave(x, "backdrop"),
    onClose: () => { if (onChange) onChange(); } });
  return h;
}
// 魂を宿している器と差し口 (「アリアのメイン魂」/「アリアのサブ魂1」/「宿していない」)
function soulHomeText(uid) {
  for (const d of G().party || []) {
    if (d.primary === uid) return `${d.name}のメイン魂`;
    const i = (d.subs || []).findIndex((x) => x && x.uid === uid);
    if (i >= 0) return `${d.name}のサブ魂${i + 1}`;
  }
  return "宿していない";
}
// 灯番の魂一覧 (人業の館の魂一覧と同じ並び: 職業順・＋の多い順・Lv の高い順)
function soulList(b, redraw) {
  const g = G();
  const souls = [...(g.souls || [])].filter(Boolean).sort(game.soulSortCmp || (() => 0));
  b.appendChild(el("div", "inf-h", `魂一覧 ${souls.length}`));
  if (!souls.length) { b.appendChild(el("div", "inf-note dim", "迷宮で拾った魂がここに並ぶ。")); return; }
  b.appendChild(el("div", "inf-note dim", "メイン魂・サブ魂・宿していない魂のどれも、✦Soul で Lv を上げ、✦Soul か残火で Lv上限を上げられる (✦は、いまの Lv から次の Lv へ上がるのと同じだけ)。同じ職の魂を拾うと、自動で融合して Lv上限が伸びる。"));
  for (const s of souls) {
    const cl = SOUL_CLASSES[s.clsKey] || {};
    const cap = soulLevelCapOf(s);
    const sub = `${soulHomeText(s.uid)} ・ Lv上限${cap} ・ ランク${soulRankOf(s)} ・ ${RAR[cl.rarity] || ""}`;
    const atCap = s.level >= cap;
    const tb = button({ label: atCap ? "上限" : "強化", kind: atCap ? "ghost" : "secondary", size: "sm", disabled: atCap && !capRaisable(s),
      title: atCap ? "✦Soul か残火で Lv上限を上げる" : "✦Soul で魂の Lv を上げる",
      onTap: () => openTrainSheet(s.uid, redraw) });
    const line = soulLine(s, sub, null, [tb]);
    const nm = line.querySelector(".ui-row-title");
    if (nm && cl.glow) nm.style.color = cl.glow;
    b.appendChild(line);
  }
}
// 器のサブ魂の並び (「戦士の魂+1 Lv5 / 空き」)
function subSummary(d) {
  const out = [];
  for (let i = 0; i < MAX_SUBS; i++) {
    const s = soulByUid(((d.subs || [])[i] || {}).uid);
    out.push(s ? `${soulLabel(s)} Lv${s.level}` : "空き");
  }
  return out.join(" / ");
}
// 魂の行の右に、押すボタンを並べる (行を押すとその職業の図鑑)
function soulLine(s, sub, why, btns) {
  const line = el("div", "inf-swap-row");
  line.appendChild(row({ icon: bust(s.clsKey, 32), title: `${soulLabel(s)} ・ Lv${s.level}`, sub, tone: why ? "dim" : null,
    onTap: game.showCodexJobDetail ? () => { sfx("select"); game.showCodexJobDetail(s.clsKey, soulRankOf(s)); } : null }));
  for (const b of btns) { b.classList.add("inf-swap-b"); line.appendChild(b); }
  return line;
}
const pvText = (d, pv) => (pv ? `付け替え後 HP ${pv.hp}/${pv.maxhp} ・ MP ${pv.mp}/${pv.maxmp}${pv.hp < d.hp || pv.mp < d.mp ? " (減る)" : ""}` : "");
// サブ魂 (器ごとに2つまで): 枠ごとに宿す・外す・借りる技を選ぶ。付け替えは風だまりの灯番だけ (2026-10-12 ユーザーの指示)
function openSubs(d, onChange) {
  let hh = null;
  const redraw = () => { if (hh && !hh.closed) hh.update({ body: fill }); if (onChange) onChange(); };
  const fill = (b) => {
    b.appendChild(el("div", "inf-note", "サブ魂は器ごとに2つまで。宿した魂の能力の一部 (ランク1で1割〜ランク5で3割) が器に加わり、覚えている技・パッシブを魂のランクに応じた数だけ借りられる。ひとつの器に同じ職業の魂は一つだけ。付け替えても傷は残り、HP・MP は今の値のまま。"));
    const subs = d.subs || [];
    for (let i = 0; i < MAX_SUBS; i++) {
      const sub = subs[i];
      const s = sub ? soulByUid(sub.uid) : null;
      b.appendChild(el("div", "inf-h", `サブ魂${i + 1}`));
      if (!s && i > subs.length) { b.appendChild(el("div", "inf-note dim", "先にサブ魂1を宿す。")); continue; }
      if (!s) {
        b.appendChild(row({ title: "空き", sub: "宿す魂を選ぶ", chevron: true, onTap: () => { sfx("select"); openSubPick(d, i, redraw); } }));
        continue;
      }
      const info = (d.subInfo || []).find((x) => x.uid === s.uid);
      const picks = info ? info.picks.map((p) => (p.skill ? `技「${SPELLS[p.skill] ? SPELLS[p.skill].name : p.skill}」` : `パッシブ「${passiveName(p.passive)}」`)) : [];
      const sub2 = `借りている ${picks.length}/${info ? info.cap : 1}${picks.length ? " ・ " + picks.join("・") : ""}`;
      const off = button({ label: "外す", kind: "ghost", size: "sm", onTap: async () => {
        const pv = game.infSubPreview ? game.infSubPreview(d, i, null) : null;
        const ok = await kitConfirm({ title: `${soulLabel(s)}を外す？`, lines: [pvText(d, pv), "外した魂は「宿していない魂」に戻る。"].filter(Boolean), okLabel: "外す", danger: false });
        if (ok && game.infSetSub && game.infSetSub(d, i, null)) redraw();
      } });
      const pick = button({ label: "借りる技", kind: "secondary", size: "sm", onTap: () => {
        const x = (d.subs || [])[i];
        const k = x ? openSkillStep(d, x) : null;
        if (k && k.opts) { const was = k.opts.onClose; k.opts.onClose = (r) => { if (typeof was === "function") was(r); redraw(); }; } // 借りた技を選び終えたら、この画面を描き直す
      } });
      const swap = button({ label: "替える", kind: "secondary", size: "sm", onTap: () => { sfx("select"); openSubPick(d, i, redraw); } });
      const train = button({ label: "強化", kind: "secondary", size: "sm", disabled: s.level >= soulLevelCapOf(s) && !capRaisable(s), onTap: () => openTrainSheet(s.uid, redraw) });
      const box = el("div", "inf-sub-box");
      box.appendChild(soulLine(s, sub2, null, []));
      const acts = el("div", "inf-vessel-a");
      for (const x of [train, pick, swap, off]) acts.appendChild(x);
      box.appendChild(acts);
      b.appendChild(box);
    }
  };
  hh = sheet.open({ kind: "info", banner: "サブ魂", title: `${d.name}のサブ魂`, accent: "#7fd0ff", className: "inf-sheet", body: fill,
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => x.close() }], onClose: () => { if (onChange) onChange(); } });
  return hh;
}
// サブ魂の枠 si に宿す魂を選ぶ
function openSubPick(d, si, onChange) {
  const g = G();
  const cur = ((d.subs || [])[si] || {}).uid;
  const list = (g.souls || []).filter((s) => s && s.uid !== cur && s.uid !== d.primary);
  let hh = null;
  hh = sheet.open({
    kind: "info", banner: `サブ魂${si + 1}`, title: `${d.name}に宿す魂`, accent: "#7fd0ff", className: "inf-sheet",
    body: (b) => {
      if (!list.length) { b.appendChild(el("div", "inf-note dim", "宿せる魂が無い。迷宮で魂を拾うと、ここに並ぶ。")); return; }
      // 宿せる魂を先に並べる
      const rows = list.map((s) => ({ s, why: game.infSubBlock ? game.infSubBlock(d, si, s.uid) : null })).sort((a, b) => (a.why ? 1 : 0) - (b.why ? 1 : 0));
      for (const { s, why } of rows) {
        const pv = !why && game.infSubPreview ? game.infSubPreview(d, si, s.uid) : null;
        const oi = (d.subs || []).findIndex((x) => x && x.uid === s.uid); // この器のもう一つのサブ魂 = 枠どうしを入れ替える
        const sub = why || (oi >= 0 ? `いまサブ魂${oi + 1} ・ ` : "") + pvText(d, pv);
        const note = oi >= 0 ? (cur != null ? `サブ魂${oi + 1}とサブ魂${si + 1}を入れ替える (借りる技もそのまま)。` : "") : cur != null ? "元のサブ魂は「宿していない魂」に戻る。" : "";
        const on = button({ label: "宿す", kind: "secondary", size: "sm", disabled: !!why, onTap: async () => {
          const ok = await kitConfirm({ title: `${d.name}のサブ魂${si + 1}に${soulLabel(s)}を宿す？`, lines: [sub, note].filter(Boolean), okLabel: "宿す", danger: false });
          if (!ok) return;
          if (game.infSetSub && game.infSetSub(d, si, s.uid)) { toast(`${d.name} ― サブ魂${si + 1} ${soulLabel(s)}`, { tone: "good" }); if (hh) hh.close(); if (onChange) onChange(); }
        } });
        b.appendChild(soulLine(s, sub, why, [on]));
      }
    },
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => x.close() }],
  });
  return hh;
}
// メイン魂を付け替える: 砕けた器は不可。傷・状態異常は残り、HP・MP は今の値 (新しい最大値まで)。
// この器のサブ魂を選ぶと、元のメイン魂がそのサブ魂の枠へ移る
function openSwap(d, onChange) {
  const g = G();
  const list = (g.souls || []).filter((s) => s && s.uid !== d.primary);
  let hh = null;
  hh = sheet.open({
    kind: "info", banner: "魂を替える", title: `${d.name}の魂`, accent: "#7fd0ff", className: "inf-sheet",
    body: (b) => {
      b.appendChild(el("div", "inf-note", `いま HP ${d.hp}/${d.maxhp} ・ MP ${d.mp}/${d.maxmp}。付け替えても傷と状態異常は残る。HP・MP は今の値のまま (新しい魂の最大値を超える分は切り捨て)。`));
      if (!list.length) { b.appendChild(el("div", "inf-note dim", "付け替えられる魂が無い。")); return; }
      for (const s of list) {
        const why = game.infSoulChangeBlock ? game.infSoulChangeBlock(d, s.uid) : null;
        const pv = game.infSoulChangePreview ? game.infSoulChangePreview(d, s.uid) : null;
        const sub = why ? why : pv ? `付け替え後 HP ${pv.hp}/${pv.maxhp} ・ MP ${pv.mp}/${pv.maxmp}${pv.hp < d.hp || pv.mp < d.mp ? " (減る)" : ""}` : "";
        // 行を押すとその職業の図鑑 (詳細) を開き、右の「付け替える」で宿す (2026-10 ユーザーの指示)
        const line = el("div", "inf-swap-row");
        line.appendChild(row({ icon: bust(s.clsKey, 32), title: `${soulLabel(s)} ・ Lv${s.level}`, sub, tone: why ? "dim" : null,
          onTap: game.showCodexJobDetail ? () => { sfx("select"); game.showCodexJobDetail(s.clsKey, soulRankOf(s)); } : null }));
        const swap = button({ label: "付け替える", kind: "secondary", size: "sm", disabled: !!why, onTap: async () => {
          const own = (d.subs || []).some((x) => x && x.uid === s.uid);
          const ok = await kitConfirm({ title: `${d.name}に${soulLabel(s)}を宿す？`, lines: [sub, own ? "元のメイン魂は、この魂がいたサブ魂の枠へ移る。" : "元の魂は「宿していない魂」に戻る。"], okLabel: "宿す", danger: false });
          if (!ok) return;
          if (game.infSwapSoul && game.infSwapSoul(d, s.uid)) { toast(`${d.name} ― ${soulLabel(s)}`, { tone: "good" }); if (hh) hh.close(); if (onChange) onChange(); }
        } });
        swap.classList.add("inf-swap-b");
        line.appendChild(swap);
        b.appendChild(line);
      }
    },
    footer: [{ label: "戻る", kind: "ghost", onTap: (x) => x.close() }],
  });
  return hh;
}

// ================= 全滅 =================
export function openInfWipe(spec = {}) {
  const g = G();
  if (g) g.prompt = true;
  let h = null, done = false;
  const pick = (fn) => () => { if (done) return; done = true; if (h) h.close("ok", { silent: true }); const gg = G(); if (gg) gg.prompt = false; fn(); };
  const body = el("div", "rs rs-wipe");
  body.appendChild(el("div", "rs-note", `B${spec.floor}F で仮の器はことごとく崩れた。このまま帰ると、拾ったものは何も持ち帰れない:`));
  const loss = el("div", "rs-loss");
  const cell = (v, label) => { const c = el("div", "rs-loss-c"); c.appendChild(el("div", "rs-loss-n", String(v))); c.appendChild(el("div", "rs-loss-l", label)); return c; };
  loss.appendChild(cell(spec.souls || 0, "拾った魂"));
  loss.appendChild(cell(spec.items || 0, "装備・持ち物"));
  loss.appendChild(cell(spec.embers || 0, "魂の残火"));
  body.appendChild(loss);
  body.appendChild(el("div", "rs-keep", `赤い魂 ${spec.cost} を払えば、拾った魂 (＋1 の素材)・装備と持ち物 (商会の棚へ)・残火を持ち帰れる。費用は全滅した階の数 (上限 100)。本編の人業は街で無事に待っている。`));
  // 回収人に売った品は、売った時にもう商会の棚に並んでいる (全滅しても消えない)
  body.appendChild(el("div", spec.sold ? "rs-note gold" : "rs-note dim", spec.sold
    ? `回収人に売った品 ${spec.sold}点は、もう本編の商会の棚に並んでいる。持ち帰らなくても消えない。`
    : "回収人に売った品があれば、それはもう本編の商会の棚に並んでいる (全滅しても消えない)。"));
  if (!spec.canSave) body.appendChild(el("div", "rs-note dim", `赤い魂が足りない (所持 ${spec.red || 0} ／ 要る ${spec.cost})。`));
  const foot = [];
  if (spec.canSave) foot.push({ label: `赤い魂 ${spec.cost} で持ち帰る`, kind: "primary", size: "lg", cost: { kind: "red", n: spec.cost }, onTap: pick(spec.onSave || (() => {})) });
  foot.push({ label: "あきらめて街へ", kind: spec.canSave ? "danger" : "primary", size: spec.canSave ? "md" : "lg", onTap: pick(spec.onGiveUp || (() => {})) });
  h = sheet.open({
    kind: "choice", banner: "全滅", accent: "#d4504e", className: "rs-sheet rs-wipe-sheet",
    art: ICONS.corpse, artScale: 7, title: spec.abandoned ? `${INF_NAME}を諦めた…` : "仮の器は崩れ去った…",
    body, footer: foot, dismissible: false, onBackdrop: () => {},
  });
  return h;
}

// ================= 帰ってきた =================
export function openInfSummary(r = {}) {
  if (!r) return null;
  const got = r.got || { items: [], souls: [], embers: 0 };
  return sheet.open({
    kind: "celebrate", banner: `✺ ${INF_NAME}の記録 ✺`, accent: "#b08ac0", className: "inf-sheet inf-sum",
    title: r.outcome === "wipe" ? `B${r.depth}F で全滅した` : r.outcome === "saved" ? `B${r.depth}F で全滅し、赤い魂で持ち帰った` : `B${r.depth}F から帰ってきた`,
    sparkle: !!r.newDepth,
    body: (b) => {
      if (r.title) b.appendChild(el("div", "inf-note", `称号「${r.title}」の隊`));
      if (r.newDepth) b.appendChild(el("div", "inf-note gold", "★ 最深到達を更新した！"));
      if (!r.keep) {
        const l = r.lost || {};
        b.appendChild(el("div", "inf-note", `拾った魂 ${l.souls || 0}・装備と持ち物 ${l.items || 0}・残火 ${l.embers || 0} は、迷宮の底に残された。`));
        if (r.sold) b.appendChild(el("div", "inf-note gold", `回収人に売った品 ${r.sold}点は、本編の商会の棚に並んでいる。`));
        return;
      }
      b.appendChild(el("div", "inf-h", `持ち帰った魂 ${got.souls.length}`));
      if (got.souls.length) {
        const by = {};
        for (const k of got.souls) by[k] = (by[k] || 0) + 1;
        for (const [k, n] of Object.entries(by)) {
          const cl = SOUL_CLASSES[k] || {};
          b.appendChild(row({ icon: bust(k, 30), title: `${cl.label}の魂 ×${n}`, sub: `${RAR[cl.rarity] || ""} ・ ＋1 の素材として所持魂に加わった (Lv は残らない)` }));
        }
        b.appendChild(el("div", "inf-note dim", "人業の館の「魂融合」で、同じ職の魂に融合できる。"));
      } else b.appendChild(el("div", "inf-note dim", "拾った魂は無かった。"));
      if (got.embers) b.appendChild(el("div", "inf-note", `魂の残火 ×${got.embers} を持ち帰った。`));
      if (r.sold) b.appendChild(el("div", "inf-note", `回収人に売った品 ${r.sold}点も、商会の棚に並んでいる。`));
      b.appendChild(el("div", "inf-h", `商会の棚に並んだ品 ${got.items.length}`));
      if (got.items.length) {
        const list = el("div", "inf-items");
        for (const x of got.items.slice(0, 40)) list.appendChild(el("span", "inf-item rar-" + (x.rar || "c"), x.name));
        b.appendChild(list);
        b.appendChild(el("div", "inf-note dim", "持ち帰った品は手元には届かず、商会の棚に並ぶ。金貨で買える。"));
      }
      b.appendChild(el("div", "inf-note dim", "金貨・✦Soul・最初に宿した魂の欠片は、迷宮へ還った。"));
    },
    footer: [{ label: "閉じる", kind: "primary", size: "lg", onTap: (h) => { h.close("ok"); if (game.renderTown) game.renderTown(); } }],
  });
}

// ================= 称号 (docs/infinite-affixes.md 4章) =================
// 見た目だけ。得た称号から1つを選んで付けると、無限迷宮の入口・帰還の記録で隊の名の横に出る。まだ得ていない称号は条件だけ見せる
export function openInfTitles(onDone) {
  const draw = (b) => {
    b.innerHTML = "";
    const list = game.infTitleList ? game.infTitleList() : [];
    const got = list.filter((t) => t.got).length;
    b.appendChild(el("div", "inf-note dim", `得た称号 ${got}/${list.length} ・ 見た目だけで、能力は上がらない。`));
    const none = button({ label: "称号を付けない", kind: list.some((t) => t.on) ? "ghost" : "primary", size: "sm", onTap: () => { game.setInfTitle(null); draw(b); } });
    b.appendChild(none);
    for (const t of list) {
      const r = row({ title: t.got ? `「${t.name}」${t.on ? " ― 付けている" : ""}` : "？？？", sub: t.cond });
      r.classList.add("inf-title");
      if (t.on) r.classList.add("on");
      if (!t.got) r.classList.add("dim");
      else r.addEventListener("click", () => { game.setInfTitle(t.key); draw(b); });
      b.appendChild(r);
    }
  };
  return sheet.open({
    kind: "sheet", banner: "称号", title: `${INF_NAME}の称号`, className: "inf-sheet",
    body: (b) => draw(b),
    footer: [{ label: "閉じる", kind: "primary", onTap: (h) => { h.close("ok"); if (onDone) onDone(); } }],
  });
}

// ================= 商会の棚: 追加の能力つきの品が重なった (docs/infinite-labyrinth.md 17-1) =================
// 商会の棚には、追加の能力つきの品を1つの品につき1点だけ置いておける。重なった品を一覧で並べ、棚に置く方を選ぶ
// (強い方を最初から選んでおく)。選ばなかった方は追加の能力が消え、通常品として在庫に入る
let afxOpen = null;
export function queueAfxConflicts() {
  const g = G();
  if (!g || g.state !== "town" || afxOpen || uiBlocked() || g.prompt) return;
  if (!(g.shopAfxPending || []).length) return;
  setTimeout(() => { if (!afxOpen && !uiBlocked() && G().state === "town") openAfxConflicts(); }, 500);
}
export function openAfxConflicts() {
  const list = game.afxConflicts ? game.afxConflicts() : [];
  if (!list.length) return null;
  const choice = Object.fromEntries(list.map((c) => [c.id, c.best]));
  const fill = (b) => {
    b.appendChild(el("div", "inf-note", "商会の棚には、追加の能力・特性が付いた品を、1つの品につき1点だけ置いておける。同じ品が、別の追加の能力つきでもう1点届いた。どちらを棚に置いておくか選んでほしい。選ばなかった方は追加の能力が消え、通常品として棚に並ぶ。"));
    for (const c of list) {
      const box = el("div", "inf-afx-c");
      box.appendChild(el("div", "inf-h", c.name));
      c.sets.forEach((set, i) => {
        const on = choice[c.id] === i;
        const r = el("button", "inf-afx-opt" + (on ? " on" : ""));
        r.type = "button";
        r.setAttribute("aria-pressed", on ? "true" : "false");
        r.appendChild(el("span", "inf-afx-tag", `${set.current ? "いま棚にある品" : "新しく届いた品"} ・ 強さ ${set.power}${i === c.best ? " ・ 強い方" : ""}`));
        for (const ln of set.lines) r.appendChild(el("span", "inf-afx-ln", ln));
        r.addEventListener("click", () => { choice[c.id] = i; sfx("select"); h.update({ body: fill }); });
        box.appendChild(r);
      });
      b.appendChild(box);
    }
  };
  let h = null;
  afxOpen = true;
  h = sheet.open({ kind: "info", banner: "商会の棚", title: "追加の能力つきの品が重なった", accent: "#c9a227", className: "inf-sheet", body: fill, dismissible: false,
    footer: [{ label: "選んだ方を棚に置いておく", kind: "primary", size: "lg", onTap: (x) => { x.close("ok", { silent: true }); afxOpen = null; if (game.resolveAfxConflicts) game.resolveAfxConflicts(choice); } }],
    onClose: () => { afxOpen = null; } });
  return h;
}

// 売る品と、商会の棚の追加つきの1点がぶつかった時: どちらの追加の能力を棚に残すかを選んで売る (2026-10-12 ユーザーの指示)。
// 回収人 (無限迷宮) と街の商会 (UI.openSellClash ← loot.js sellOne) で共通。
// 戻り値の Promise は keep = "shelf" (棚にある品の組) / "new" (いま売る品の組) / null (売らない・閉じた)
export function openSellClash(c) {
  let pick = c.best, h = null, done = null;
  const result = new Promise((res) => { done = res; });
  const finish = (v) => { if (done) { const f = done; done = null; f(v); } };
  const fill = (b) => {
    b.appendChild(el("div", "inf-note", `商会の棚には、追加の能力つきの「${c.name}」がもう1点ある。棚に置いておけるのは、1つの品につき1点だけ。どちらの追加の能力を残すか選んで売る。選ばなかった方は追加の能力が消え、通常品として棚に並ぶ。`));
    c.sets.forEach((set, i) => {
      const on = pick === i;
      const r = el("button", "inf-afx-opt" + (on ? " on" : ""));
      r.type = "button";
      r.setAttribute("aria-pressed", on ? "true" : "false");
      r.appendChild(el("span", "inf-afx-tag", `${set.current ? "いま棚にある品" : "いま売る品"} ・ 強さ ${set.power}${i === c.best ? " ・ 強い方" : ""}`));
      for (const ln of set.lines) r.appendChild(el("span", "inf-afx-ln", ln));
      r.addEventListener("click", () => { pick = i; sfx("select"); h.update({ body: fill }); });
      b.appendChild(r);
    });
  };
  h = sheet.open({ kind: "info", banner: "商会の棚", title: "棚に残す追加の能力を選ぶ", accent: "#c9a227", className: "inf-sheet", body: fill,
    footer: [
      { label: "売って、選んだ方を棚に置く", kind: "primary", size: "lg", onTap: (x) => { finish(pick === 1 ? "new" : "shelf"); x.close("ok", { silent: true }); } },
      { label: "売らない", kind: "ghost", onTap: (x) => x.close() },
    ], onClose: () => finish(null) });
  return result;
}

export function install() {
  registerUI({ openInfTitles, openInfSetup, openInfRest, openInfWipe, openInfSummary, queueAfxConflicts, openAfxConflicts, openSellClash });
}
