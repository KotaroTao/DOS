// ===== 戦果シート (宝箱込み)・帰還の報告・全滅シート・踏破の祝祭 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.renderRunReport(root) … 街の広場 (WP-A) が置く「帰還の報告」の札。G.lastRun が無ければ null
//
//   戦果シート … 勝利・獲得 (数え上げ)・魂の成長・新しい技・拾った魂・宝箱 (開ける者を選んで1タップ) を1枚に。
//               宝箱の罠と中身はシートの中に行として足す。倒れた者・飛ばされた・呼び寄せた時だけ札へ切り替える。
//               SR/LR の品・レア以上の魂は、シートを閉じた後に祝祭の札で祝う
//   全滅シート … 強制の決断 (赤い魂で全てを守る / あきらめる)。失うもの・残るものを並べる
//   踏破の祝祭 … 「★ 迷宮踏破 ★」→ 凱旋で闇に溶けて街へ
//   帰還の報告 … 今回の収穫と、帰ってすぐ片付く用事 (宿で休む・まとめて鑑定・まとめて売る・最適装備・館で修復・今すぐ連れ帰る)

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, sheet, button, setText, glyph, glyphText, itemTile, toast, celebrate, confirm as kitConfirm, reduced } from "./kit.js";
import { countUp, goldFlash, animate } from "./motion.js";
import { getPref } from "./prefs.js";
import { showSkillPopup } from "./itemview.js";
import { ICONS, spriteCanvas, crispCanvas } from "../sprites.js";
import { SOUL_CLASSES, jobBust } from "../souls.js";
import { RARITIES, rarityKey } from "../rarity.js";
import { ITEMS, itemName } from "../items.js";

const G = () => game.G;
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音が無くても動く */ } };
const RAR_SOUL = { common: "コモン", rare: "レア", epic: "エピック", legend: "レジェンド" };
const AUTO_CLOSE_MS = 1600;

// ================= 戦果シート =================
const KIND = {
  win: { banner: "⚔ 勝利 ⚔", title: "戦いに勝利した", accent: "#c9a24a" },
  elite: { banner: "☠ 強敵討伐 ☠", title: "強敵を討ち倒した", accent: "#d4504e" },
  guard: { banner: "⚔ 門番撃破 ⚔", title: "奈落の門番を打ち倒した", accent: "#b08ac0" },
  boss: { banner: "★ 主を討つ ★", title: "迷宮の主を討ち取った", accent: "#ffd84a" },
  corpse: { banner: "⚔ 鎮魂 ⚔", title: "起き上がった骸を鎮めた", accent: "#9be8c8" },
  chest: { banner: "✦ 宝箱 ✦", title: "宝箱", accent: "#c9a24a" },
};

// spec: { kind, gold, soul, kills, levels[{name,from,to,deltas[]}], skills[{name,key,skill,desc}],
//         souls[{clsKey,label,rarity,rare,glow,line,embers}], chest:{name,cRank,openers[{uid,name,pct}],open(uid,sink,done)}|null, onDone }
export function openResults(spec = {}) {
  const g = G();
  const k = KIND[spec.kind] || KIND.win;
  const celebrations = []; // シートを閉じた後に祝う (SR/LR の品・レア以上の魂)
  let chestState = spec.chest ? "closed" : "none"; // closed (未開封) | busy (開けている) | done (済み) | left (置いて進む)
  let finished = false, interrupted = false, autoTimer = null, h = null;
  let notable = false; // 宝箱の結果に目を留めるべきもの (痛手・SR/LR・置いてきた品) があったか
  if (g) g.prompt = true;

  const box = el("div", "rs");
  // ---- 獲得 (数え上げ) ----
  const gain = el("div", "rs-gain");
  const gainCell = (kind, v, label) => {
    const c = el("div", "rs-gain-c c-" + kind);
    const n = el("div", "rs-gain-n");
    n.appendChild(glyph(kind));
    const num = el("span", "rs-num", "0");
    n.appendChild(num);
    c.appendChild(n);
    c.appendChild(el("div", "rs-gain-l", label));
    gain.appendChild(c);
    requestAnimationFrame(() => countUp(num, 0, v || 0, 420, (x) => "+" + x));
    return num;
  };
  if (spec.gold != null || spec.soul != null) {
    gainCell("gold", spec.gold || 0, "ゴールド");
    gainCell("soul", spec.soul || 0, "Soul");
    box.appendChild(gain);
  }
  // ---- 成長・技・魂 ----
  const list = el("div", "rs-list");
  // 成長は1人1行 (名・Lv・伸びた能力)。新しい技は押すと詳細
  for (const lv of spec.levels || []) {
    const r = el("div", "rs-line rs-lv");
    r.appendChild(el("i", "rs-ic up"));
    const t = el("div", "rs-line-t one");
    t.appendChild(el("b", null, `${lv.name}`));
    t.appendChild(el("span", "rs-lvnum", ` Lv${lv.from}→${lv.to}`));
    if (lv.deltas && lv.deltas.length) t.appendChild(el("span", "rs-delta", "  " + lv.deltas.map((d) => d.replace(" +", "+")).join(" ")));
    r.appendChild(t);
    list.appendChild(r);
  }
  for (const sk of spec.skills || []) {
    const r = el("button", "rs-line rs-skill");
    r.type = "button";
    r.appendChild(el("i", "rs-ic sk"));
    const t = el("div", "rs-line-t one");
    t.appendChild(el("b", null, `${sk.name}`));
    t.appendChild(el("span", null, ` 新たな技「${sk.skill}」`));
    if (sk.desc) t.appendChild(el("span", "rs-delta dim", "  " + sk.desc));
    r.appendChild(t);
    r.appendChild(el("span", "rs-chev", "›"));
    r.addEventListener("click", () => { sfx("select"); try { showSkillPopup(sk.key); } catch (e) { /* noop */ } });
    list.appendChild(r);
  }
  for (const s of spec.souls || []) {
    const r = el("div", "rs-line rs-soul" + (s.rare ? " rare" : ""));
    r.style.setProperty("--glow", s.glow || "#c9a24a");
    const ic = el("span", "rs-soul-ic");
    try { ic.appendChild(crispCanvas(jobBust(s.clsKey, 1), 24)); } catch (e) { /* noop */ }
    r.appendChild(ic);
    const t = el("div", "rs-line-t");
    t.appendChild(el("b", null, `${s.label}の魂`));
    t.appendChild(el("span", "rs-rar", ` ${RAR_SOUL[s.rarity] || ""}`));
    t.appendChild(el("div", "rs-sub", (s.line || "所持魂の一覧に加わった。") + (s.embers ? ` 魂の残火 ×${s.embers}` : "")));
    r.appendChild(t);
    list.appendChild(r);
    if (s.rare && game.celebrateSoul) celebrations.push((next) => game.celebrateSoul(s, next));
  }
  if (list.childElementCount) box.appendChild(list);

  // ---- 宝箱 ----
  const chestBox = el("div", "rs-chest");
  const chestOut = el("div", "rs-chest-out");
  const renderChest = () => {
    chestBox.textContent = "";
    if (!spec.chest) return;
    const c = spec.chest;
    const head = el("div", "rs-chest-h");
    const art = el("span", "rs-chest-art");
    try { art.appendChild(spriteCanvas(chestState === "closed" ? ICONS.chest : (ICONS.chestOpen || ICONS.chest), 3)); } catch (e) { /* noop */ }
    head.appendChild(art);
    const ht = el("div", "rs-chest-ht");
    ht.appendChild(el("div", "rs-chest-n", c.name || "宝箱"));
    ht.appendChild(el("div", "rs-chest-s", chestState === "closed" ? "罠があるかもしれない" : chestState === "busy" ? "開けている…" : chestState === "left" ? "置いていった" : "開けた"));
    head.appendChild(ht);
    chestBox.appendChild(head);
    if (chestState === "closed") {
      const best = c.openers[0];
      const acts = el("div", "rs-chest-acts");
      if (best) acts.appendChild(button({ label: `開ける ― ${best.name}`, sub: `解除 ${best.pct}%`, kind: "primary", size: "lg", onTap: () => openChestWith(best.uid) }));
      if (c.openers.length > 1) {
        const more = el("details", "rs-others");
        const sm = el("summary", "rs-others-s");
        sm.appendChild(el("span", null, "他の者が開ける"));
        more.appendChild(sm);
        const ol = el("div", "rs-others-l");
        for (const o of c.openers.slice(1)) ol.appendChild(button({ label: o.name, sub: `解除 ${o.pct}%`, kind: "secondary", onTap: () => openChestWith(o.uid) }));
        more.appendChild(ol);
        acts.appendChild(more);
      }
      chestBox.appendChild(acts);
    }
    chestBox.appendChild(chestOut);
  };
  if (spec.chest) { renderChest(); box.appendChild(chestBox); }

  // ---- 出し先 (宝箱の罠・中身をシートの行に足す) ----
  const addOut = (node) => {
    chestOut.appendChild(node);
    animate(node, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "ease-out" });
    try { node.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" }); } catch (e) { /* noop */ }
  };
  const sinkSheet = {
    mode: "sheet",
    note(text, tone = "gold") { if (interrupted) return toast(text, { tone }); if (tone === "bad") notable = true; addOut(setText(el("div", "rs-out t-" + tone), text)); },
    gold(n, from = "宝箱") {
      if (interrupted) return toast(`${from}から 💰${n}`, { tone: "gold" });
      const r = el("div", "rs-out t-gold");
      r.appendChild(glyph("gold"));
      const num = el("span", "rs-num", "0");
      r.appendChild(num);
      r.appendChild(document.createTextNode(` ゴールドを手に入れた`));
      addOut(r);
      countUp(num, 0, n, 400, (x) => "+" + x);
    },
    loot(item, who, next) {
      if (interrupted) { UI.loot(item, who, { source: "chest" }, next); return; }
      const rk = rarityKey(item);
      const r = el("div", "rs-out rs-item" + (rk ? " rar-" + rk : ""));
      try { r.appendChild(itemTile(item, { size: 44 })); } catch (e) { r.appendChild(el("span", "ui-tile empty")); }
      const t = el("div", "rs-item-t");
      const nm = el("div", "rs-item-n" + (rk ? " rar-" + rk : ""), itemName(item) + (item.unidentified ? "" : ""));
      if (rk && RARITIES[rk]) nm.style.color = RARITIES[rk].color;
      t.appendChild(nm);
      t.appendChild(el("div", "rs-sub", `${rk && RARITIES[rk] ? RARITIES[rk].label + " ・ " : ""}${item.unidentified ? "未鑑定 ・ " : ""}${who ? who.name + " が持った" : ""}`));
      r.appendChild(t);
      // 押すと品の詳細 (鑑定は街でのみ)。鑑定済みで装備できる品は「装備」で人業を選んですぐ装備
      r.classList.add("tap");
      r.setAttribute("role", "button");
      r.addEventListener("click", (e) => { if (e.target.closest(".rs-equip")) return; try { UI.itemSheet(item, { owner: who, context: "dungeon" }); } catch (er) { /* noop */ } });
      if (!item.unidentified && typeof UI.equipChooser === "function" && ["weapon", "shield", "body", "head", "hands", "feet", "acc"].includes(item.slot)) {
        r.appendChild(button({ label: "装備", kind: "secondary", size: "sm", onTap: () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; refreshFooter(false); } UI.equipChooser(item, { owner: who }); } }));
        r.lastChild.classList.add("rs-equip");
      }
      addOut(r);
      // SR/LR は閉じた後に祝祭の札 (WP-C の UI.loot。Phase 0 では入手の札)
      if (rk === "sr" || rk === "lr") { notable = true; celebrations.push((cont) => UI.loot(item, who, { source: "results", celebrate: true }, cont)); }
      if (next) next();
    },
    lost(name) { if (interrupted) return toast(`持ちきれず置いてきた: ${name}`, { tone: "bad" }); notable = true; addOut(setText(el("div", "rs-out t-bad"), `持ちきれず置いてきた: ${name}`)); },
    // 札で止める出来事 (倒れた・飛ばされた・呼び寄せた・全滅): シートを片付け、以後はトーストへ
    interrupt() {
      if (interrupted) return;
      interrupted = true;
      chestState = "done";
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      if (h && !h.closed) h.close("interrupt", { silent: true });
      const gg = G();
      if (gg) gg.prompt = false;
    },
  };
  // 宝箱の処理が済んだ (シートが残っていれば「進む」を出す。片付けた後なら続きへ)
  // 結果はタップ (「進む」) で閉じる。設定「戦果を自動で閉じる」の時だけ自動で閉じる
  const chestDone = () => {
    if (interrupted) { finalize(); return; }
    chestState = "done";
    renderChest();
    refreshFooter(getPref("autoCloseResults"));
    armAutoClose();
  };
  function openChestWith(uid) {
    if (chestState !== "closed" || !spec.chest) return;
    chestState = "busy";
    sfx("select");
    renderChest();
    refreshFooter();
    try { spec.chest.open(uid, sinkSheet, chestDone); } catch (e) { chestDone(); setTimeout(() => { throw e; }); }
  }

  // ---- 足元 ----
  const footer = () => {
    if (chestState === "closed") return [{ label: "置いて進む", kind: "ghost", onTap: () => { chestState = "left"; close(); } }];
    if (chestState === "busy") return [{ label: "…", kind: "ghost", disabled: true }];
    return [{ label: celebrations.length ? "進む ― 祝う" : "進む", kind: "primary", size: "lg", onTap: () => close() }];
  };
  const refreshFooter = (countdown = false) => {
    if (!h || h.closed) return;
    const foot = h.foot;
    foot.textContent = "";
    for (const it of footer()) {
      const bt = button({ ...it, onTap: it.onTap || (() => {}) });
      // 自動で進む時は、ボタンの下端に残り時間の細い線を走らせる (押せばすぐ進む)
      if (countdown && it.kind === "primary") { bt.classList.add("rs-auto"); const bar = el("i", "rs-auto-bar"); bar.style.animationDuration = AUTO_CLOSE_MS + "ms"; bt.appendChild(bar); }
      foot.appendChild(bt);
    }
    foot.classList.toggle("hidden", !foot.childElementCount);
  };
  const armAutoClose = (force = false) => {
    if ((!force && !getPref("autoCloseResults")) || chestState === "closed" || chestState === "busy") return;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => close(), AUTO_CLOSE_MS);
  };
  function close() {
    if (finished || chestState === "busy") return;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (h && !h.closed) h.close("ok", { silent: true });
    const gg = G();
    if (gg) gg.prompt = false;
    finalize();
  }
  // シートの後: 祝祭 (順番に) → 続き (踏破の祝祭・殲滅報酬・盤面)
  function finalize() {
    if (finished) return;
    finished = true;
    const gg = G();
    const run = (i) => {
      if (i >= celebrations.length) {
        if (gg) gg.prompt = false;
        if (game.autosave) game.autosave(true);
        if (spec.onDone) spec.onDone();
        return;
      }
      try { celebrations[i](() => run(i + 1)); } catch (e) { run(i + 1); setTimeout(() => { throw e; }); }
    };
    run(0);
  }

  h = sheet.open({
    kind: "info", banner: k.banner, accent: k.accent, title: spec.title || k.title, className: "rs-sheet k-" + (spec.kind || "win"),
    body: box,
    footer: footer(),
    dismissible: false,
    // 戻る/背景: 宝箱が残っていれば揺らす (うっかり置いていかない)。済んでいれば進む
    onBack: (s) => { if (chestState === "closed" || chestState === "busy") { try { s.el.animate([{ transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 220 }); } catch (e) { /* noop */ } } else close(); },
    onBackdrop: () => { if (chestState !== "closed" && chestState !== "busy") close(); },
  });
  // 本文に触れたら自動で進むのを止める (読みたい時はそのまま留まれる)
  if (h && h.body) h.body.addEventListener("pointerdown", () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; refreshFooter(false); } });
  if (spec.kind === "boss" || spec.kind === "elite" || spec.kind === "guard") goldFlash(k.accent);
  // 宝箱を最良の解除役で開ける設定 (§7 M5)
  if (spec.chest && getPref("chestAuto") && spec.chest.openers[0]) setTimeout(() => openChestWith(spec.chest.openers[0].uid), 380);
  else { refreshFooter(getPref("autoCloseResults") && !spec.chest); armAutoClose(); }
  return h;
}

// ================= 全滅シート =================
// spec: { gold, items, souls, soulPts, secured, cost, red, canSave, onSave, onGiveUp }
export function openWipe(spec = {}) {
  const g = G();
  if (g) g.prompt = true;
  let h = null, done = false;
  const pick = (fn) => () => { if (done) return; done = true; if (h) h.close("ok", { silent: true }); const gg = G(); if (gg) gg.prompt = false; fn(); };
  const body = el("div", "rs rs-wipe");
  if (spec.secured) {
    body.appendChild(el("div", "rs-note gold", "主を討った後の全滅だ。戦利品は確定しており、何も失わない。"));
  } else {
    body.appendChild(el("div", "rs-note", "このまま諦めると、今回の探索で得た以下を失う:"));
    const loss = el("div", "rs-loss");
    const cell = (kind, v, label) => {
      const c = el("div", "rs-loss-c");
      const n = el("div", "rs-loss-n");
      if (kind) n.appendChild(glyph(kind));
      n.appendChild(document.createTextNode(String(v)));
      c.appendChild(n);
      c.appendChild(el("div", "rs-loss-l", label));
      return c;
    };
    loss.appendChild(cell("gold", spec.gold || 0, "ゴールド"));
    loss.appendChild(cell(null, spec.items || 0, "装備・品"));
    loss.appendChild(cell(null, spec.souls || 0, "魂"));
    body.appendChild(loss);
  }
  const keep = el("div", "rs-keep");
  keep.appendChild(glyphText(`✦${spec.soulPts || 0} Soul は失わない。砕けた人業は、時を経て街へ連れ帰られる。戻った器は、人業の館で金貨を払って修復する。`));
  body.appendChild(keep);
  if (!spec.canSave) body.appendChild(el("div", "rs-note dim", `赤い魂 ${spec.cost} があれば何も失わずに帰れた (所持 ${spec.red || 0})。`));
  const foot = [];
  if (spec.canSave) foot.push({ label: `赤い魂 ${spec.cost} で全てを守る`, sub: "全員 HP1 で生還する", kind: "primary", size: "lg", cost: { kind: "red", n: spec.cost }, onTap: pick(spec.onSave || (() => {})) });
  foot.push({ label: spec.secured ? "街へ戻る ― 救出を待つ" : "あきらめる ― 救出を待つ", kind: spec.canSave ? "danger" : "primary", size: spec.canSave ? "md" : "lg", onTap: pick(spec.onGiveUp || (() => {})) });
  h = sheet.open({
    kind: "choice", banner: "全滅", accent: "#d4504e", className: "rs-sheet rs-wipe-sheet",
    art: ICONS.corpse, artScale: 7, title: "人業はことごとく砕けた…",
    body, footer: foot, dismissible: false,
    onBack: (s) => { try { s.el.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "none" }], { duration: 260 }); } catch (e) { /* noop */ } },
    onBackdrop: () => {},
  });
  return h;
}

// ================= 踏破の祝祭 =================
// spec: { name, layer, isStoryTarget, layerBoss, last, onGo, onStay }
export function celebrateClear(spec = {}) {
  const g = G();
  if (g) g.prompt = true;
  let gone = false;
  const lines = [`「${spec.name}」を踏破した！`];
  if (spec.isStoryTarget) lines.push("勅命を果たした。王宮へ戻り、王に報告せよ。");
  else if (spec.last) lines.push("すべての迷宮を制覇した。あなたは伝説となった。");
  else lines.push("さらなる深淵が、まだそなたを待っている。");
  const footer = [{ label: "街へ凱旋する", kind: "primary", size: "lg", onTap: (h) => { if (gone) return; gone = true; h.close("ok", { silent: true }); const gg = G(); if (gg) gg.prompt = false; if (spec.onGo) spec.onGo(); } }];
  // まだ探索する: 街へ戻らず盤面に残る (主は討ったので、下の「帰還」からいつでも凱旋できる)
  if (spec.onStay) footer.push({ label: "まだ探索する", kind: "ghost", onTap: (h) => { if (gone) return; gone = true; h.close("ok", { silent: true }); const gg = G(); if (gg) gg.prompt = false; spec.onStay(); } });
  goldFlash("#ffd84a");
  return celebrate({
    banner: "★ 迷宮踏破 ★", accent: "#ffd84a", title: spec.name, art: ICONS.stairs, artScale: 8, lines, className: "rs-clear",
    footer, dismissible: false,
    onBack: (h) => { try { h.el.animate([{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 220 }); } catch (e) { /* noop */ } },
    onBackdrop: () => {},
  });
}

// ================= 帰還の報告 =================
const OUTCOME = {
  return: { banner: "帰還の報告", tone: "gold" },
  clear: { banner: "踏破の報告", tone: "gold" },
  saved: { banner: "生還の報告", tone: "gold" },
  wipe: { banner: "全滅の報告", tone: "bad" },
};
function rarCounts(items) {
  const cnt = { c: 0, uc: 0, r: 0, sr: 0, lr: 0 };
  for (const it of items || []) if (it.rar && cnt[it.rar] != null) cnt[it.rar]++;
  return cnt;
}
function confirmHasten(c) {
  return kitConfirm({
    banner: "今すぐ連れ帰る", danger: false, title: `迷宮に残された人業を今すぐ連れ帰る`,
    lines: [`赤い魂 🔴${c.hastenCost} (20分ごとに1つ。帰りの近い者から)`, "届いた器は、館で金貨を払って修復する。"],
    okLabel: "連れ帰る",
  });
}
function deadDolls() {
  const g = G();
  const all = game.allDolls ? game.allDolls() : (g ? [...g.party, ...g.reserve] : []);
  return all.filter((d) => d && d.isDoll && !d.alive);
}
// まとめて売る/鑑定の確認 (§3.4: 価格・除外は単体と同じ。除外したものを明記)
function confirmSell(c) {
  return kitConfirm({
    banner: "まとめて売る", danger: false, title: `${c.junk}点を売る (+💰${c.junkGold})`,
    lines: ["SR・LR・未奉納の収集品・呪われた品・未鑑定・装備中の品・道具は売らない。", "売った品は商会の棚に並ぶ (買い戻せる)。"],
    okLabel: "まとめて売る",
  });
}
function confirmIdentify(c) {
  const g = G();
  const short = g && g.gold < c.unidCost;
  return kitConfirm({
    banner: "まとめて鑑定", danger: false, title: `未鑑定 ${c.unid}点を鑑定する`,
    lines: [`鑑定料 合計 💰${c.unidCost}${short ? ` (所持 💰${g.gold}。安い品から払える分だけ)` : ""}`, "鑑定料は商会で1点ずつ鑑定するのと同じ。"],
    okLabel: "鑑定する",
  });
}

// 帰還の報告の札を作る (root があれば先頭に置く)。G.lastRun が無い/閉じた時は null
export function renderRunReport(root) {
  const g = G();
  const lr = g && g.lastRun;
  if (!lr || lr.dismissed) return null;
  let c = null;
  try { c = ops.counts ? ops.counts() : null; } catch (e) { c = null; }
  c = c || {};
  const o = OUTCOME[lr.outcome] || OUTCOME.return;
  const card = el("section", "rr-card t-" + o.tone);
  card.setAttribute("aria-label", o.banner);
  // 見出し: 報告の種類 ― 迷宮名 B3F ・ × で閉じる
  const head = el("div", "rr-head");
  const ht = el("div", "rr-head-t");
  ht.appendChild(el("span", "rr-banner", o.banner));
  ht.appendChild(el("span", "rr-where", `${lr.dungeon ? lr.dungeon.name : ""}${lr.abyss ? ` B${lr.abyss}F` : ` B${lr.floors || lr.floor || 1}F`}`));
  head.appendChild(ht);
  const more = el("button", "rr-more");
  more.type = "button";
  more.appendChild(el("span", null, "詳細"));
  more.appendChild(el("span", "rr-more-c", "›"));
  more.addEventListener("click", () => { sfx("select"); openRunReportDetail(); });
  head.appendChild(more);
  const x = el("button", "rr-x");
  x.type = "button";
  x.setAttribute("aria-label", "報告を閉じる");
  x.textContent = "×";
  x.addEventListener("click", () => { lr.dismissed = true; sfx("select"); if (game.autosave) game.autosave(true); card.remove(); });
  head.appendChild(x);
  card.appendChild(head);
  // 収穫の一行
  const haul = el("div", "rr-haul");
  const stat = (kind, v, label) => {
    const s = el("span", "rr-stat");
    if (kind) s.appendChild(glyph(kind));
    s.appendChild(el("b", null, String(v)));
    if (label) s.appendChild(el("small", null, label));
    haul.appendChild(s);
  };
  if (lr.outcome === "wipe" && lr.forfeited) {
    stat("gold", lr.forfeited.gold ? "-" + lr.forfeited.gold : "0", "失った");
    stat(null, (lr.forfeited.items || []).length, "品を失った");
    stat("soul", lr.soulPts || 0, "は残った");
  } else {
    stat("gold", "+" + (lr.gold || 0), "");
    stat("soul", "+" + (lr.soulPts || 0), "");
    const items = lr.items || [];
    const unid = items.filter((i) => i.unid).length;
    if (items.length) stat(null, items.length, unid ? `品 (未鑑定${unid})` : "品");
    if ((lr.souls || []).length) stat(null, lr.souls.length, "魂");
    if (lr.kills) stat(null, lr.kills, "討伐");
  }
  card.appendChild(haul);
  // レア度の宝石 (SR/LR は名前で)
  const special = (lr.items || []).filter((i) => i.rar === "sr" || i.rar === "lr");
  if (special.length) {
    const sp = el("div", "rr-special");
    for (const it of special.slice(0, 3)) {
      const n = el("span", "rr-sp rar-" + it.rar, it.name);
      if (RARITIES[it.rar]) n.style.color = RARITIES[it.rar].color;
      sp.appendChild(n);
    }
    card.appendChild(sp);
  }
  // 成長
  if ((lr.levels || []).length) card.appendChild(el("div", "rr-line up", lr.levels.map((l) => `${l.name} Lv${l.from}→${l.to}`).join(" ・ ")));
  // 砕けた人業 (全滅で残された器は連れ帰りの時、街にある器は修復の費用)
  const dead = deadDolls();
  for (const d of dead.slice(0, 3)) {
    const ln = el("div", "rr-line bad rr-dead");
    ln.appendChild(el("span", "rr-cross", "†"));
    if (d.reviveAt) {
      ln.appendChild(el("span", null, `${d.name} 砕けた ― `));
      if (game.reviveTimerEl) { try { ln.appendChild(game.reviveTimerEl("span", "rr-timer", "連れ帰りまで ", d)); } catch (e) { /* noop */ } }
    } else {
      ln.appendChild(el("span", null, `${d.name} 砕けた ― 修復 `));
      ln.appendChild(glyphText(`💰${game.repairCostOf ? game.repairCostOf(d) : 0}`));
    }
    card.appendChild(ln);
  }
  if ((lr.lost || []).length) card.appendChild(el("div", "rr-line bad", `持ちきれず置いてきた: ${lr.lost.slice(0, 3).join("・")}${lr.lost.length > 3 ? ` 他${lr.lost.length - 3}` : ""}`));
  // ---- 用事 (1タップ) ----
  const acts = el("div", "rr-acts");
  const rerender = () => {
    // ops は街を描き直す (広場ならこの札も作り直される)。ほかの場所に置かれていれば、その場で差し替える
    if (card.isConnected) { const n = renderRunReport(); if (n) card.replaceWith(n); else card.remove(); }
  };
  const act = (o2) => acts.appendChild(button({ size: "md", ...o2, onTap: async () => { try { await o2.run(); } finally { rerender(); } } }));
  const shopOpen = (() => { try { const a = game.tutorialAllowed ? game.tutorialAllowed() : null; return !a || a.includes("shop"); } catch (e) { return true; } })();
  if (c.hurt > 0) act({ label: "宿で休む", cost: { kind: "gold", n: c.innCost || 0 }, kind: "primary", disabled: g.gold < (c.innCost || 0), run: () => ops.restParty() });
  // 鑑定の心得のある者がいれば、まず隊の技で試みる (失敗した品・LR だけが「まとめて鑑定」(商会) に残る)
  let tryId = null;
  try { tryId = UI.tryIdentifyInfo ? UI.tryIdentifyInfo() : null; } catch (e) { tryId = null; }
  if (tryId) act({ label: "鑑定を試みる", sub: `${tryId.n}点 ・ ${tryId.top.m.name}${tryId.men.length > 1 ? "ら" : ""}`, kind: c.hurt > 0 ? "secondary" : "primary", run: () => new Promise((res) => { if (!UI.openTryIdentifyAll({ onDone: res })) res(); }) });
  else if (c.unid > 0 && shopOpen) act({ label: "まとめて鑑定", cost: { kind: "gold", n: c.unidCost }, kind: c.hurt > 0 ? "secondary" : "primary", run: async () => { if (await confirmIdentify(c)) ops.identifyAll(); } });
  let better = 0;
  try { better = UI.betterGearCount ? UI.betterGearCount() || 0 : 0; } catch (e) { better = 0; }
  if (better > 0) act({ label: "最適装備", sub: `${better}体に よりよい品`, run: () => { if (UI.autoEquip) UI.autoEquip("all"); } });
  // まとめて売る: 商会の確認 (売る品と売値の一覧・装備の候補を残す守りつき) があればそちら
  if (UI.confirmSellJunk && UI.junkList) {
    let junk = null;
    try { junk = UI.junkList(); } catch (e) { junk = null; }
    if (junk && junk.length && shopOpen) act({ label: "まとめて売る", cost: { kind: "gold", n: junk.reduce((a2, j) => a2 + (j.price || 0), 0) },
      run: () => { UI.confirmSellJunk(); } }); // 売ったあとは商会側が街を描き直す
  } else if (c.junk > 0 && shopOpen) act({ label: "まとめて売る", cost: { kind: "gold", n: c.junkGold }, run: async () => { if (await confirmSell(c)) ops.sellJunkAll(); } });
  if (c.repairable > 0) act({ label: "館で修復", cost: { kind: "gold", n: c.repairCost || 0 }, kind: "secondary",
    run: () => { if (UI.openParty) UI.openParty(dead.find((d) => !d.reviveAt) || null, { context: "town" }); } });
  if (c.rescuing > 0 && c.hastenCost > 0) act({ label: "今すぐ連れ帰る", cost: { kind: "red", n: c.hastenCost }, kind: lr.outcome === "wipe" ? "primary" : "secondary", disabled: g.redSoul < 1, run: async () => { if (await confirmHasten(c)) ops.hastenAll(); } });
  if (acts.childElementCount) card.appendChild(acts);
  else card.appendChild(el("div", "rr-line dim", lr.outcome === "wipe" ? "人業が連れ帰られるのを待とう。" : "片付ける用事はない。次の迷宮へ。"));
  if (root) root.insertBefore(card, root.firstChild);
  return card;
}

// 報告の詳細 (得た品・魂・成長・失ったもの)
export function openRunReportDetail() {
  const g = G();
  const lr = g && g.lastRun;
  if (!lr) return null;
  const o = OUTCOME[lr.outcome] || OUTCOME.return;
  return sheet.open({
    kind: "info", banner: o.banner, className: "dg-sheet rr-detail",
    title: `${lr.dungeon ? lr.dungeon.name : ""}  ${lr.abyss ? `B${lr.abyss}F` : `B${lr.floors || lr.floor || 1}F まで`}`,
    body: (b) => {
      const sec = (t, s) => { const h = el("div", "dg-sec"); h.appendChild(el("i", "dg-sec-mark")); h.appendChild(setText(el("span", "dg-sec-t"), t)); if (s) h.appendChild(setText(el("span", "dg-sec-s"), s)); return h; };
      const t = el("div", "dg-tally");
      const cell = (kind, v, label) => { const cc = el("div", "dg-tally-c"); const n = el("div", "dg-tally-n"); if (kind) n.appendChild(glyph(kind)); n.appendChild(document.createTextNode(String(v))); cc.appendChild(n); cc.appendChild(el("div", "dg-tally-l", label)); return cc; };
      t.appendChild(cell("gold", lr.gold || 0, "ゴールド"));
      t.appendChild(cell("soul", lr.soulPts || 0, "Soul"));
      t.appendChild(cell(null, lr.kills || 0, "討伐"));
      t.appendChild(cell(null, (lr.items || []).length, "品"));
      b.appendChild(t);
      if (lr.forfeited) {
        b.appendChild(sec("全滅で失ったもの"));
        b.appendChild(el("div", "dg-line bad", `ゴールド ${lr.forfeited.gold || 0}`));
        for (const n of (lr.forfeited.items || []).slice(0, 12)) b.appendChild(el("div", "dg-line bad", n));
        for (const n of (lr.forfeited.souls || [])) b.appendChild(el("div", "dg-line bad", `${n}の魂`));
      }
      const items = lr.items || [];
      if (items.length && !lr.forfeited) {
        const cnt = rarCounts(items);
        b.appendChild(sec("得た品", ["lr", "sr", "r", "uc", "c"].filter((k) => cnt[k]).map((k) => `${RARITIES[k].short}${cnt[k]}`).join(" ")));
        const grid = el("div", "dg-tiles");
        for (const it of items) {
          const tpl = it.id && ITEMS[it.id] ? { ...ITEMS[it.id], unidentified: it.unid } : null;
          const cellEl = el("div", "dg-tilecell");
          cellEl.appendChild(tpl ? itemTile(tpl, { size: 56 }) : el("div", "ui-tile s56 empty"));
          const nm = el("span", "dg-tile-who", it.name);
          if (it.rar && RARITIES[it.rar]) nm.style.color = RARITIES[it.rar].color;
          cellEl.appendChild(nm);
          grid.appendChild(cellEl);
        }
        b.appendChild(grid);
      }
      if ((lr.souls || []).length && !lr.forfeited) {
        b.appendChild(sec("魂"));
        const list = el("div", "dg-souls");
        for (const s of lr.souls) {
          const chip = el("span", "dg-soul r-" + (s.rarity || "common"));
          try { chip.appendChild(crispCanvas(jobBust(s.clsKey, 1), 24)); } catch (e) { /* noop */ }
          chip.appendChild(el("span", null, s.label));
          const cls = SOUL_CLASSES[s.clsKey];
          if (cls && cls.glow) chip.style.setProperty("--glow", cls.glow);
          list.appendChild(chip);
        }
        b.appendChild(list);
      }
      if ((lr.levels || []).length) {
        b.appendChild(sec("魂の成長"));
        for (const l of lr.levels) b.appendChild(el("div", "dg-line up", `${l.name}　Lv${l.from} → Lv${l.to}`));
      }
      if (lr.embers) b.appendChild(el("div", "dg-line", `魂の残火 ×${lr.embers}`));
      if ((lr.lost || []).length) {
        b.appendChild(sec("持ちきれず置いてきた"));
        for (const n of lr.lost) b.appendChild(el("div", "dg-line bad", n));
      }
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// 帰還の報告をシートで開く (広場に札を置けない時・検証用)
export function openRunReport() {
  const g = G();
  if (!g || !g.lastRun) return null;
  return sheet.open({
    kind: "info", banner: "帰還の報告", className: "dg-sheet rr-sheet",
    body: (b) => { const c = renderRunReport(); if (c) b.appendChild(c); },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

export function install() {
  registerUI({ renderRunReport, openRunReport, openRunReportDetail, openResults, openWipe, celebrateClear });
}
