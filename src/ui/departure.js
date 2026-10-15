// ===== 出撃シート — 門の選択・隊の備え (その場で直す)・異変・初回の注意・無限迷宮の入口 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.openDeparture({ page }) … 中央の門 (どのタブからでも)。page:"abyss" で無限迷宮の入口、page:"rematch" で宿敵の再戦を開く
//
//   ┌ ━━ 出 撃 ━━ ─────────────────────────┐
//   │ ┌ 迷宮の顔 (由来の原画・無ければ情景) ┐ │ 上半分 = 選んでいる迷宮: 情景・名・説明
//   │ │ 朽ちた骸の修道院            目標  │ │ 推奨Lv・全階数・発見した魔物 n/m・受注中の依頼 n件・固有クエスト n/m (押すと詳細のポップアップ)
//   │ └───────────────────────┘ │
//   │ [迷宮の掟「名」›] [異変「名」› ○]       │ 1列に並べ、押すと全文のポップアップ。イラストからこの列までは固定
//   │ (●) 忘れられた地下墓地 推奨Lv1・全5階 踏破 │ 門は 5 行ぶん見せ、6 つ目からは一覧を縦に巻く
//   │ ▒▒ まだ地図にない迷宮 ― 解放の手がかり  │ 台帳 (world.js) の unlock を満たすと現れる
//   │ 潜り始める階 [B1F|B6F]                  │ 到達した帰還魔法陣の次の階から潜れる
//   │ [肖像][肖像][肖像]              編成 ›  │
//   │ ⚠ フィモンが深手     [宿で休む ●48]      │ 直し方はその場に (別の札は出さない)
//   ├──────────────────────────────────────┤
//   │ [ ◆ 門をくぐる ― B1F ◆ ]                │ 階選択・隊の備えと共に下部へ固定
//   │ 備えの注意は本文で巻く                   │ 説明が増えても操作欄を隠さない
//   └──────────────────────────────────────┘

import { UI, game, ops, registerUI } from "./ctx.js";
import { el, sheet, button, setText, portrait, segmented, toast, confirm as kitConfirm } from "./kit.js";
import { ELEMENTS } from "../dungeons/index.js";
import { iconCanvas } from "../townart.js";
import { drawDungeonVista } from "../backdrops.js";
import { CHAPTERS } from "../story.js";
import { LORE_IMAGES } from "../storyimages.js";
import { dungeonQuestSheet, dungeonActiveQuestSheet, byLevelDesc } from "./questboard.js";

const G = () => game.G;
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音が無くても動く */ } };

let cur = null; // 開いているシート { h, page, accept }

function openCount() {
  const D = game.DUNGEONS || [];
  return D.filter((d, i) => isOpen(i)).length;
}
function isOpen(i) { try { return game.worldOpenIdx ? game.worldOpenIdx(i) : i < (G().unlockedDungeons || 0); } catch (e) { return false; } }
function wst() { try { return game.worldState ? game.worldState() : {}; } catch (e) { return {}; } }
function cleared() { try { return game.clearedDungeonCount ? game.clearedDungeonCount() : 0; } catch (e) { return 0; } }
// 物語の目標の迷宮 (目標の札が指す迷宮。出撃シートで「目標」と印を付ける)
function questIdx() {
  try { const g = game.storyGoal ? game.storyGoal() : null; return g && g.kind === "dive" ? (game.DUNGEONS || []).indexOf(g.d) : -1; } catch (e) { return -1; }
}
// 推奨Lvと隊のLvの差 → 危うさの札 { cls, text, note }
function dangerOf(dn) {
  const band = game.levelBand ? game.levelBand(dn) : [1, 1];
  const pl = game.partyLevel ? game.partyLevel() : 1;
  const gap = band[0] - pl;
  if (gap >= 8) return { cls: "reckless", text: "無謀", note: `推奨Lv${band[0]}〜 ・ 隊のLv${pl}。格上の敵には状態異常も即死も、ほとんど効かない。` };
  if (gap >= 4) return { cls: "danger", text: "危険", note: `推奨Lv${band[0]}〜 ・ 隊のLv${pl}。敵の状態異常が効きやすく、こちらの術は効きにくい。` };
  // 隊のLvが推奨Lv (いちばん深い階) + 2 を超えると、迷宮で得る ✦Soul が減る (game.js soulLvMul)
  if (pl - band[1] > 2) return { cls: "easy", text: pl - band[1] >= 8 ? "易しい" : "格下", note: `推奨Lv〜${band[1]} ・ 隊のLv${pl}。隊のLvが推奨Lvを3以上上回ると、得る✦Soulが減る (1Lvごとに10%、最大80%)。` };
  return null;
}

// ---- 迷宮の掟の札 (名だけ。押すと全文) ----
function ruleHead(btn, kind, short, name) {
  const k = el("span", "dp-rule-k");
  k.appendChild(el("span", "dp-rule-kf", kind));
  k.appendChild(el("span", "dp-rule-ks", short)); // 狭い画面で出す短い名
  btn.appendChild(k);
  btn.appendChild(el("span", "dp-rule-n", name));
  btn.appendChild(el("span", "dp-rule-c", "›"));
}
function traitChip(tr) {
  const btn = el("button", "dp-rule dp-trait");
  btn.type = "button";
  if (tr.accent) btn.style.setProperty("--mut", tr.accent);
  ruleHead(btn, "迷宮の掟", "掟", `${tr.sym ? tr.sym + " " : ""}「${tr.name}」`);
  btn.setAttribute("aria-label", `迷宮の掟「${tr.name}」 ― 詳しく見る`);
  btn.addEventListener("click", () => {
    sfx("select");
    sheet.open({
      kind: "info", banner: "迷宮の掟", accent: tr.accent || null,
      title: `${tr.sym ? tr.sym + " " : ""}「${tr.name}」`, titleColor: tr.accent || null,
      body: (b) => { for (const ln of tr.lines || []) b.appendChild(setText(el("div", "ui-sheet-line dp-rule-l"), ln)); },
      footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
    });
  });
  return btn;
}

// ---- 門の一覧 (迷宮の地図: 推奨Lvの高い順。地図にない迷宮は、解放の手がかりだけを見せる) ----
function gateIcon(kind) {
  const w = el("span", "dp-gate-ic");
  try { const c = iconCanvas(kind); if (c) w.appendChild(c); } catch (e) { /* 演出のみ */ }
  return w;
}
// ---- 迷宮の顔 (上半分): 選んでいる迷宮の情景・説明・記録 ----
const VISTA_W = 480, VISTA_H = 320; // 戦闘背景と同じ 3:2 で描き、表示枠 (横長) で上下を切る
let vistaLoop = 0;
const PAINTED_VISTAS = new Set(["ws3", "ws4", "ws6", "ws7", "ws8", "ws9", "ws10", "w18", "w24", "w25", "w26", "w27", "w28", "w34", "w35", "w36", "w37", "w38", "w39", "w40", "w41"]);
function vistaIllustration(dn) {
  const path = PAINTED_VISTAS.has(dn.id) && LORE_IMAGES[dn.id];
  if (!path) return vistaCanvas(dn);
  const img = document.createElement("img");
  img.className = "dp-vista-cv";
  img.style.imageRendering = "auto";
  if (dn.id === "w27") img.style.objectPosition = "50% 30%";
  if (dn.id === "w34") img.style.objectPosition = "50% 20%";
  img.alt = `${dn.name}の情景`;
  img.decoding = "async";
  img.onerror = () => { if (img.isConnected) img.replaceWith(vistaCanvas(dn)); };
  img.src = path;
  return img;
}
function vistaCanvas(dn) {
  const cv = document.createElement("canvas");
  cv.width = VISTA_W; cv.height = VISTA_H;
  cv.className = "dp-vista-cv";
  const ctx = cv.getContext("2d");
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const draw = () => { try { drawDungeonVista(ctx, VISTA_W, VISTA_H, dn, now()); } catch (e) { /* 演出のみ */ } };
  draw();
  // 霧・灯火・粒子のゆらぎ (約15fps)。シートを閉じる/迷宮を選び直すと止まる
  const id = ++vistaLoop;
  let last = 0;
  const tick = (t) => {
    if (id !== vistaLoop || !cv.isConnected && last) return;
    if (!(typeof document !== "undefined" && document.hidden) && t - last > 66) { last = t; if (cv.isConnected) draw(); }
    requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(tick);
  return cv;
}
// 迷宮の章: 本筋は story.js CHAPTERS のとおり。寄り道 (CHAPTERS に無い) は同じ層の本筋の迷宮の章
// (格上の寄り道も、魔物の層で決まる = 開く章。獄吏の詰所 → 第二章、疫病塚の底 → 第七章)
function chapterOf(dn) {
  const D = game.DUNGEONS || [];
  const direct = CHAPTERS.find((c) => c.dungeons.includes(dn.id));
  if (direct) return direct;
  let best = null;
  for (const c of CHAPTERS) for (const id of c.dungeons) {
    const m = D.find((d) => d.id === id);
    if (m && m.layer === dn.layer && (!best || c.no < best.no)) best = c;
  }
  if (best) return best;
  // 同じ層に本筋の無い寄り道: 層の近い本筋の章
  let near = null, gap = Infinity;
  for (const c of CHAPTERS) for (const id of c.dungeons) {
    const m = D.find((d) => d.id === id);
    if (m && Math.abs(m.layer - dn.layer) < gap) { gap = Math.abs(m.layer - dn.layer); near = c; }
  }
  return near;
}
const KANJI_NUM = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
function chapterNo(n) {
  if (n <= 10) return KANJI_NUM[n];
  if (n < 20) return "十" + KANJI_NUM[n - 10];
  return (KANJI_NUM[Math.floor(n / 10)] || String(Math.floor(n / 10))) + "十" + (n % 10 ? KANJI_NUM[n % 10] : "");
}
function gateStatus(dn, i) {
  const w = wst();
  const isDone = !!(w.cleared && w.cleared[dn.id]);
  // 踏破した迷宮は、推奨Lvが隊より高くても踏破の札を出す (危険・無謀の札は未踏破の迷宮だけ。2026-10 ユーザーの指摘)
  if (isDone) return fullyCleared(dn) ? { text: "★ 完全踏破", cls: "done perfect" } : { text: "★ 踏破", cls: "done" };
  const dg = dangerOf(dn);
  if (dg && dg.cls !== "easy") return { text: dg.text, cls: dg.cls };
  if (i === questIdx()) return { text: "目標", cls: "quest" };
  return { text: "未踏破", cls: "" };
}
// 完全踏破 = 踏破した上で、その迷宮の魔物をすべて発見し、固有クエスト (極めて稀なる出来事を含む) をすべて果たした
// (出撃シートの「発見した魔物」「固有クエスト」の札と同じ数え方。ユーザーの指示、2026-10)
function fullyCleared(dn) {
  let f = null;
  try { f = game.dungeonFacts ? game.dungeonFacts(dn) : null; } catch (e) { f = null; }
  return !!f && f.monSeen >= f.monTotal && f.fqDone >= f.fqTotal;
}
// 壁の倍率の表記 (×2 / ×2.8 / ×3.9)
function wallText(k) { return String(Math.round(k * 10) / 10); }
// onTap を渡すと押せる札になる (詳細のポップアップを開く。右に › の印)
// short = 狭い画面で出す短い名 (札を1行に収める)
function fact(label, value, cls, onTap = null, short = null) {
  const f = el(onTap ? "button" : "span", "dp-fact" + (cls ? " " + cls : "") + (onTap ? " tap" : ""));
  const l = el("span", "dp-fact-l");
  l.appendChild(el("span", "dp-fact-lf", label));
  if (short) { l.appendChild(el("span", "dp-fact-ls", short)); l.classList.add("has-short"); }
  f.appendChild(l);
  f.appendChild(el("span", "dp-fact-v", value));
  if (onTap) {
    f.type = "button";
    f.setAttribute("aria-label", `${label} ${value} ― 詳しく見る`);
    f.appendChild(el("span", "dp-fact-c", "›"));
    f.addEventListener("click", onTap);
  }
  return f;
}
function renderHero(b) {
  const g = G();
  const dn = (game.DUNGEONS || [])[g.dungeonIdx];
  if (!dn) return;
  const hero = el("div", "dp-hero");
  const pic = el("div", "dp-vista");
  pic.appendChild(vistaIllustration(dn));
  const cap = el("div", "dp-vista-cap");
  const band = game.levelBand ? game.levelBand(dn) : [1, 1];
  const ttl = el("div", "dp-hero-t");
  ttl.appendChild(el("div", "dp-hero-n", dn.name));
  const sub = [`推奨Lv${band[0]}${band[1] > band[0] ? `〜${band[1]}` : ""}`, `全${dn.floors}階`];
  // 敵の強さの段は第三章から少しずつ上がる (world.js wallOf)。札と注意は大きく跳ねる第十章からだけ出す
  const wall = game.wallOf && dn.layer >= 12 ? game.wallOf(dn) : 1;
  // 能力ごとの段 (world.js statWallOf): HP は重く、攻撃は軽く掛かる
  const sw = wall > 1 && game.statWallOf ? game.statWallOf(dn) : { atk: 1, hp: 1 };
  const wallHp = wall * sw.hp, wallAtk = wall * sw.atk;
  if (wall > 1) sub.push(`壁 HP×${wallText(wallHp)}・攻撃×${wallText(wallAtk)}`);
  if (dn.boss) sub.push("主が待つ");
  else if (dn.element && ELEMENTS[dn.element] && dn.element !== "none") sub.push(`${ELEMENTS[dn.element].label}の気配`);
  ttl.appendChild(el("div", "dp-hero-s", sub.join(" ・ ")));
  cap.appendChild(ttl);
  const st = gateStatus(dn, g.dungeonIdx);
  const top = el("div", "dp-vista-top");
  top.appendChild(ttl);
  top.appendChild(el("span", "dp-gate-st" + (st.cls ? " " + st.cls : ""), st.text));
  cap.appendChild(top);
  // 説明と記録の札はイラストに重ねる (ユーザーの指示、2026-10)
  if (dn.about) cap.appendChild(setText(el("div", "dp-hero-about"), dn.about));
  // 記録: 発見した魔物 / その迷宮の魔物 (雑魚・強敵・主)、固有クエストの報告済み / 総数
  const facts = el("div", "dp-facts");
  let f = null;
  try { f = game.dungeonFacts ? game.dungeonFacts(dn) : null; } catch (e) { f = null; }
  if (f) {
    // 押すと詳細: 発見した魔物 = その迷宮の魔物の札 (図鑑) / 固有クエスト = 依頼人の頼みの一覧 (状態・現れる条件)
    const di = g.dungeonIdx;
    facts.appendChild(fact("発見した魔物", `${f.monSeen}/${f.monTotal}`, f.monTotal && f.monSeen >= f.monTotal ? "full" : "",
      f.monTotal && UI.dungeonMonSheet ? () => UI.dungeonMonSheet(di) : null, "魔物"));
    // 受注中の依頼 = この迷宮を対象にしている依頼 (名の横の「依頼」の印と同じ数え方)。押すと札の一覧
    let qs = [];
    try { qs = game.questsTargeting ? game.questsTargeting(dn) : []; } catch (e) { qs = []; }
    facts.appendChild(fact("受注中の依頼", qs.length ? `${qs.length}件` : "なし", qs.length ? "" : "none",
      qs.length ? () => dungeonActiveQuestSheet(dn, { onChange: () => refresh() }) : null, "依頼"));
    facts.appendChild(fact("固有の依頼", f.fqTotal ? `${f.fqDone}/${f.fqTotal}` : "なし", f.fqTotal && f.fqDone >= f.fqTotal ? "full" : !f.fqTotal ? "none" : "",
      f.fqTotal ? () => dungeonQuestSheet(dn, { onChange: () => refresh() }) : null, "固有"));
  }
  cap.appendChild(facts);
  pic.appendChild(cap);
  hero.appendChild(pic);
  // 迷宮の掟 (1つの迷宮に1つだけ — world.js の trait) と異変を1列に並べる。札には名だけを出し、押すと詳細のポップアップ
  // (ユーザーの指示、2026-10-11)。イラストからこの列までは本文を巻いても動かない (.dp-hero は sticky)。
  // 足元 (落ちる床・蝕む床) と格上・格下の注意の枠は出さない (危険・無謀は門の一覧の札に残る)
  const tr = game.dungeonTrait ? game.dungeonTrait(dn) : null;
  const mut = mutatorChip();
  if (tr || mut) {
    const row = el("div", "dp-rules" + (tr && mut ? " two" : ""));
    if (tr) row.appendChild(traitChip(tr));
    if (mut) row.appendChild(mut);
    hero.appendChild(row);
  }
  b.appendChild(hero);
  // ここから下は本文と一緒に巻く
  // 掟「器の山」: 隊のLv が推奨Lv を超えるほど、掟で増える死体が減る (game.js corpseFadeShare)
  { const share = game.corpseFadeShare ? game.corpseFadeShare(dn) : 1;
    if (share < 1) b.appendChild(setText(el("div", "pt-note dp-after"), share <= 0
      ? "隊のLvが推奨Lvを大きく上回っている。器に残る魂は姿を見せず、掟で増える死体はもう出ない。"
      : `隊のLvが推奨Lvを上回っているので、掟で増える死体はいま約${Math.round(share * 100)}%しか出ない。`)); }
  // 第十章からの壁 (world.js wallOf): 推奨Lv に届くだけでは勝てないことを、門をくぐる前に知らせる
  if (wall > 1) {
    b.appendChild(setText(el("div", "pt-note dp-after dp-wall"),
      `第十章からの壁 ― この土地の敵は、第二章までの物差しでHP${wallText(wallHp)}倍・防御${wallText(wall)}倍・攻撃${wallText(wallAtk)}倍。第三章から少しずつ強くなってきた敵は、第十章の中では本筋の迷宮が一つ進むごとにHPが約1.7倍、防御が1.5倍、攻撃が約1.15倍、素早さが1.1倍ずつ増える。硬くて長い戦いになるので、HP・VITと回復の備えが物を言う。推奨Lvに届くだけでは歯が立たない。魂融合・宝探し・鍛え直しで隊を鍛えてから挑もう。`));
  }
  if (dn.id === "w04" && !game.worldState?.().reported.w03) {
    b.appendChild(setText(el("div", "pt-note dp-after"), "取水口は推奨Lv18〜21。隊の強さを確かめ、支度を整えてから向かおう。"));
  }
}

// ---- 門の一覧 (迷宮の地図: 推奨Lvの高い順。5 行ぶん見せ、6 つ目からは縦に巻く) ----
function renderGates(b) {
  const g = G();
  const D = game.DUNGEONS || [];
  const w = wst();
  const qi = questIdx();
  if (!isOpen(g.dungeonIdx)) g.dungeonIdx = Math.max(0, D.findIndex((d, i) => isOpen(i)));
  renderHero(b);
  // 章ごとに区切り (新しい章から)、章の中は推奨Lvの高い迷宮から並べる (ユーザーの指示、2026-10)
  const opened = byLevelDesc(D.filter((d, i) => isOpen(i)))
    .map((d) => ({ i: D.indexOf(d), c: chapterOf(d) }))
    .sort((a, b) => ((b.c ? b.c.no : 0) - (a.c ? a.c.no : 0))); // 安定な並べ替え: 章の中は推奨Lvの順のまま
  const ch = game.currentChapter ? game.currentChapter() : null;
  const list = el("div", "dp-gates");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "迷宮の地図");
  let lastCh;
  for (const { i, c } of opened) {
    const dn = D[i];
    if (c !== lastCh) {
      lastCh = c;
      const hd = el("div", "dp-chap");
      hd.setAttribute("role", "presentation");
      hd.appendChild(el("span", "dp-chap-n", c ? `第${chapterNo(c.no)}章` : "そのほか"));
      if (c) hd.appendChild(el("span", "dp-chap-t", `「${c.title}」`));
      list.appendChild(hd);
    }
    const isDone = !!(w.cleared && w.cleared[dn.id]);
    const sel = i === g.dungeonIdx;
    const r = el("button", "dp-gate" + (sel ? " sel" : "") + (isDone ? " done" : "") + (i === qi ? " quest" : ""));
    r.type = "button";
    r.setAttribute("role", "radio");
    r.setAttribute("aria-checked", sel ? "true" : "false");
    r.appendChild(el("span", "dp-radio"));
    r.appendChild(gateIcon(sel ? "gateOpen" : isDone ? "gateDone" : "gate"));
    const info = el("span", "dp-gate-i");
    const nm = el("span", "dp-gate-n", dn.name);
    if (w.fresh && w.fresh[dn.id] && !isDone) nm.appendChild(el("span", "dp-new", "新"));
    // 受けている依頼の対象の迷宮: 依頼の印 (2件以上なら件数も)
    { const qc = game.questHereCount ? game.questHereCount(dn) : 0; if (qc) nm.appendChild(el("span", "dp-qmark", qc > 1 ? `依頼×${qc}` : "依頼")); }
    // 酒場で聞いた噂の迷宮: 噂の印 (次に潜ると現実になる)
    if (g.rumor && g.rumor.dungeon === dn.id) nm.appendChild(el("span", "dp-rmark", "噂"));
    info.appendChild(nm);
    const band = game.levelBand ? game.levelBand(dn) : [1, 1];
    const meta = [`推奨Lv${band[0]}${band[1] > band[0] ? `〜${band[1]}` : ""}`, `全${dn.floors}階`];
    if (dn.boss) meta.push("主が待つ");
    else if (dn.element && ELEMENTS[dn.element] && dn.element !== "none") meta.push(`${ELEMENTS[dn.element].label}の気配`);
    if (game.storyCellPending && game.storyCellPending(dn)) meta.push("師の手がかり");
    { const qn = game.questHereNote ? game.questHereNote(dn) : null; if (qn) meta.push(qn); }
    info.appendChild(el("span", "dp-gate-c", meta.join(" ・ ")));
    r.appendChild(info);
    const st = gateStatus(dn, i);
    r.appendChild(el("span", "dp-gate-st" + (st.cls ? " " + st.cls : ""), st.text));
    r.addEventListener("click", () => {
      if (g.dungeonIdx === i) return;
      g.dungeonIdx = i;
      cur.from = 1;
      sfx("select");
      if (game.autosave) game.autosave();
      refresh();
    });
    list.appendChild(r);
  }
  // 選んだ迷宮を見たら「新」の印を消す
  if (w.fresh && D[g.dungeonIdx]) delete w.fresh[D[g.dungeonIdx].id];
  const sealedRow = (title, note, tag) => {
    const sealed = el("div", "dp-gate dp-sealed");
    sealed.appendChild(gateIcon("gateSealed"));
    const info = el("span", "dp-gate-i");
    if (title) info.appendChild(el("span", "dp-gate-n", title));
    info.appendChild(el("span", "dp-gate-c dp-hint", note));
    sealed.appendChild(info);
    sealed.appendChild(el("span", "dp-gate-st sealed", tag));
    list.appendChild(sealed);
  };
  // 章の結びまで語り終えた: 次章を「準備中」として見せる (鎖で封じられた大門)
  if (game.contentSealed && game.contentSealed() && ch) sealedRow(ch.next || "次の章", ch.nextNote || "その先へ続く道は、まだ封じられている", "準備中");
  // 無限迷宮 (第八章の結びで開く)
  if (game.featureUnlocked && game.featureUnlocked("infinite")) {
    const rec = game.abyssRecords ? game.abyssRecords() : { bestDepth: 0 };
    const r = el("button", "dp-gate dp-abyss");
    r.type = "button";
    r.appendChild(gateIcon("abyss"));
    const info = el("span", "dp-gate-i");
    info.appendChild(el("span", "dp-gate-n", "無限迷宮"));
    info.appendChild(el("span", "dp-gate-c", rec.bestDepth ? `最深 B${rec.bestDepth}F ・ Lv1 または魂の記憶から挑む` : "Lv1 の仮の器で潜り、50階ごとに魂を記憶できる。深さに果てはない。"));
    r.appendChild(info);
    r.appendChild(el("span", "dp-gate-st", "支度 ›"));
    r.addEventListener("click", () => { sfx("select"); cur.page = "abyss"; refresh(); });
    list.appendChild(r);
  }
  // 宿敵の再戦 (第九章の結びで開く): 倒した名のある強敵・迷宮の主の記憶に、闘技場跡で挑み直す
  if (game.featureUnlocked && game.featureUnlocked("rematch")) {
    const rv = game.rematchList ? game.rematchList() : [];
    const r = el("button", "dp-gate dp-abyss dp-rematch");
    r.type = "button";
    r.appendChild(gateIcon("gateDone"));
    const info = el("span", "dp-gate-i");
    info.appendChild(el("span", "dp-gate-n", "闘技場跡 ― 宿敵の再戦"));
    info.appendChild(el("span", "dp-gate-c", rv.length ? `挑める相手 ${rv.length} ・ 倒した強敵と主の記憶に、強くなった姿で挑む` : "名のある強敵か迷宮の主を倒すと、その記憶に挑める"));
    r.appendChild(info);
    r.appendChild(el("span", "dp-gate-st", "支度 ›"));
    r.addEventListener("click", () => { sfx("select"); cur.page = "rematch"; refresh(); });
    list.appendChild(r);
  }
  // 一覧は本文 (シートの縦スクロール) と一緒に巻く。選び直しの巻き位置は refresh が本文ごと保つ
  b.appendChild(list);
}

// ---- 潜り始める階 (到達した帰還魔法陣の次の階から) ----
// 一番下の出撃の札に組み込む (ユーザーの指示、2026-10): 札の上の縁に階の札を並べ、押すと選び直す
function startFloors() {
  const g = G();
  const dn = (game.DUNGEONS || [])[g.dungeonIdx];
  if (!dn || cur.page !== "gates") return [1];
  const floors = game.startFloorsOf ? game.startFloorsOf(dn) : [1];
  if (!floors.includes(cur.from)) cur.from = 1;
  return floors;
}
function startFloorPicker(floors) {
  const box = el("div", "dp-go-fl");
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", "潜り始める階");
  box.appendChild(el("span", "dp-go-l", "潜り始める階"));
  for (const f of floors) {
    const on = f === cur.from;
    const c = el("button", "dp-go-f" + (on ? " sel" : ""), `B${f}F`);
    c.type = "button";
    c.setAttribute("role", "radio");
    c.setAttribute("aria-checked", on ? "true" : "false");
    c.addEventListener("click", () => {
      if (cur.from === f) return;
      cur.from = f;
      sfx("select");
      refresh();
    });
    box.appendChild(c);
  }
  return box;
}

// ---- 隊の備え ----
function sec(t, s) {
  const h = el("div", "dg-sec");
  h.appendChild(el("i", "dg-sec-mark"));
  h.appendChild(setText(el("span", "dg-sec-t"), t));
  if (s) h.appendChild(setText(el("span", "dg-sec-s"), s));
  return h;
}
async function runFix(fix) {
  const g = G();
  if (!fix) return;
  sfx("select");
  if (fix.act === "rest") { ops.restParty(); return; }
  if (fix.act === "hasten") {
    let c = null;
    try { c = ops.counts(); } catch (e) { c = null; }
    const ok = await kitConfirm({ banner: "今すぐ連れ帰る", danger: false, title: "迷宮に残された人業を今すぐ連れ帰る", lines: [c?.hastenCost === 0 ? "この人業は、赤い魂なしで今すぐ連れ帰れる。" : `赤い魂 🔴${c ? c.hastenCost : "?"} (20分ごとに1つ)`, "届いた器は、館で費用を確かめて修復する。"], okLabel: "連れ帰る" });
    if (ok) ops.hastenAll();
    return;
  }

  if (fix.act === "equip") { if (UI.autoEquip) UI.autoEquip("all"); return; } // 結果 (元に戻す付き) は隊の側が知らせる
  // 別の画面へ: シートを閉じてから
  close();
  if (fix.act === "shop") setTimeout(() => { if (UI.openShop) UI.openShop("buy"); }, 0);
  // 砕けた人業: 人業の館で、その人業を選んだ状態から修復する
  if (fix.act === "repair") setTimeout(() => { if (UI.openParty) UI.openParty((g.party || []).find((d) => d.uid === fix.uid) || null, { context: "town" }); }, 0);
  if (fix.act === "party") setTimeout(() => { if (UI.openParty) UI.openParty(0, { context: "town" }); }, 0);
  void g;
}
function renderReady(b) {
  const g = G();
  // 1行: 肖像 (HP の細線つき) + 編成 ›
  const strip = el("div", "dp-party");
  g.party.forEach((d, i) => {
    const p = portrait(d, { size: 48, hp: true, row: i < 3 ? "前" : "後", onTap: () => { close(); setTimeout(() => UI.openParty && UI.openParty(i, { seg: "equip", inPlace: true }), 0); } });
    strip.appendChild(p);
  });
  const swap = el("button", "dp-swap");
  swap.type = "button";
  swap.appendChild(el("span", null, "編成"));
  swap.appendChild(el("span", "dp-swap-c", "›"));
  swap.addEventListener("click", () => { sfx("select"); close(); setTimeout(() => UI.openFormationSheet?.(), 0); });
  strip.appendChild(swap);
  b.appendChild(strip);
}
// 備えの注意は本文でスクロールさせ、階選択・隊欄の高さを保つ。
function renderReadyIssues(b) {
  let res = null;
  try { res = game.preDiveIssues ? game.preDiveIssues() : null; } catch (e) { res = null; }
  const items = (res && res.items) || [];
  if (!items.length) return;
  for (const it of items) {
    const r = el("div", "dp-issue t-" + (it.tone || "warn"));
    r.appendChild(el("i", "dp-issue-mark"));
    r.appendChild(setText(el("span", "dp-issue-t"), it.text));
    if (it.fix) {
      const f = it.fix;
      r.appendChild(button({ label: f.label, cost: f.cost || null, kind: it.tone === "bad" ? "primary" : "secondary", size: "sm", disabled: f.ok === false, onTap: async () => { await runFix(f); if (cur && cur.h && !cur.h.closed) refresh(); } }));
    }
    b.appendChild(r);
  }
}

// 入場の消費予告。人業ごとの残量を表示し、不足分を街で補える。
function renderStability(b, explain = true) {
  if (cur?.page !== "rematch" && game.stabilityApplies && !game.stabilityApplies()) return;
  const status = game.stabilityStatus();
  b.appendChild(sec("魂の安定度", `入場時 −${game.STABILITY_ENTRY_COST}／人`));
  if (explain) b.appendChild(el("div","dp-brief-l",`上限100。入場時に${game.STABILITY_ENTRY_COST}消費し、${game.stabilityMinutes ? game.stabilityMinutes() : 4}分ごとに1回復。控えやゲームを閉じている間も回復します。5階ごとに次の階へ進む時も各人${game.STABILITY_ENTRY_COST}消費します。不足分は赤い魂1で安定度5を購入するか、広告視聴で隊全員の安定度を消費せず1回分進めます。残っている安定度はそのままです。`));
  for (const d of status) {
    const line=el("div","dp-stability-row");
    const wait=d.value<game.STABILITY_ENTRY_COST ? ` ・ 入場まで約${Math.ceil(d.waitMs/60000)}分` : "";
    line.appendChild(el("span",d.value<game.STABILITY_ENTRY_COST ? "dp-stability-low" : "",`${d.name} ${d.value} → ${d.value<game.STABILITY_ENTRY_COST ? "不足" : d.after}${wait}`));
    if(d.value<game.STABILITY_ENTRY_COST)line.appendChild(button({label:"回復",kind:"secondary",size:"sm",onTap:()=>UI.openStability?.(G().party.find(p=>p.uid===d.uid),()=>refresh())}));
    b.appendChild(line);
  }

}

// ---- 異変 (§7 M1) — 掟の隣の札: 名と切り替え。押すと危険・見返りの全文と切り替えのポップアップ ----
function mutatorChip() {
  const g = G();
  const m = game.townMutatorFor ? game.townMutatorFor(g.dungeonIdx) : null;
  cur.hasMut = !!m;
  if (!m) return null;
  const box = el("div", "dp-rule dp-mutr" + (cur.accept ? " on" : ""));
  if (m.accent) box.style.setProperty("--mut", m.accent);
  const btn = el("button", "dp-rule-b");
  btn.type = "button";
  ruleHead(btn, "異変", "異変", `「${m.name}」`);
  btn.setAttribute("aria-label", `異変「${m.name}」 ― 詳しく見る`);
  btn.addEventListener("click", () => { sfx("select"); openMutSheet(m); });
  box.appendChild(btn);
  // 既定は「異変ごと潜る」。選んだ向きは迷宮を切り替えてもシートを閉じるまで保つ
  const sw = el("button", "dp-mut-sw");
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", cur.accept ? "true" : "false");
  sw.setAttribute("aria-label", cur.accept ? "異変ごと潜る" : "鎮まるのを待つ");
  sw.appendChild(el("span", "dp-mut-sw-l", cur.accept ? "異変ごと潜る" : "鎮まるのを待つ"));
  const knob = el("span", "dg-switch"); knob.appendChild(el("i")); sw.appendChild(knob);
  sw.addEventListener("click", () => { cur.accept = !cur.accept; sfx("select"); refresh(); });
  box.appendChild(sw);
  return box;
}
function openMutSheet(m) {
  const pick = (h, on) => { h.close(); if (cur && cur.accept !== on) { cur.accept = on; sfx("select"); refresh(); } };
  sheet.open({
    kind: "info", banner: "異変", accent: m.accent || null,
    title: `${m.sym ? m.sym + " " : ""}「${m.name}」`, titleColor: m.accent || null,
    body: (b) => {
      b.appendChild(setText(el("div", "ui-sheet-line dp-rule-l bad"), `危険 ― ${m.risk}`));
      b.appendChild(setText(el("div", "ui-sheet-line dp-rule-l good"), `見返り ― ${m.gain}`));
    },
    footer: [
      { label: "異変ごと潜る", kind: cur && cur.accept ? "primary" : "ghost", sub: cur && cur.accept ? "いまの選択" : "", onTap: (h) => pick(h, true) },
      { label: "鎮まるのを待つ", kind: cur && !cur.accept ? "primary" : "ghost", sub: cur && !cur.accept ? "いまの選択" : "", onTap: (h) => pick(h, false) },
    ],
  });
}

// ---- 初めての注意 (出撃画面と分け、全文を読めるポップアップで表示) ----
function openBriefing(go) {
  const soulRequest = cur?.page !== "rematch" && !G().stabilityBriefed && game.DUNGEONS?.[G().dungeonIdx]?.id === "w03";
  if (cur?.page !== "rematch" && game.stabilityApplies && !game.stabilityApplies()) {
    sheet.open({ kind: "info", banner: "出撃", title: "探索と帰還", className: "dp-brief-sheet",
      lines: ["最下階まで進み、依頼の品を調べましょう。最下階の出口から街へ戻れます。"],
      footer: [{ label: "迷宮に入る", kind: "primary", onTap: h => { h.close(); go(); } }] });
    return;
  }
  sheet.open({
    kind:"info", banner:"門衛の忠告", title:"魂の安定度",
    className:"dp-brief-sheet", accent:"#78bdd1",
    body:(b)=>{
      const picture=el("div","dp-gatekeeper");
      const illustration=document.createElement("img");
      illustration.src=new URL("../../art/tutorial/gatekeeper.png",import.meta.url).href;
      illustration.alt="槍と灯りを持つ門衛が、石造りの迷宮の入口に立っている";
      illustration.width=1852;illustration.height=849;
      picture.appendChild(illustration);b.appendChild(picture);
      b.appendChild(el("div","dp-brief-h","門衛 ― 迷宮の入口を守る者"));
      for(const text of ["この先へ入ると魂と人業の結びつきが揺らぎます。その状態を示すのが『魂の安定度』です。",
        `安定度の上限は100です。入場時に人業ごとに${game.STABILITY_ENTRY_COST}消費します。5階ごとに次の階へ進む時も、一人につき${game.STABILITY_ENTRY_COST}消費します。`,
        "安定度は4分ごとに1回復します。ゲームを閉じている間も同じです。",
        `不足分は赤い魂1で安定度5を購入し、そのまま進めます。安定度が${game.STABILITY_ENTRY_COST}未満の人業がいる場合は、購入するか、広告視聴で隊全員の安定度を消費せず1回分進むか、4分で1回復するのを待ってください。`,
        ...(!G().dungeonBriefed ? game.DUNGEON_BRIEFING || [] : [])])b.appendChild(setText(el("div","dp-brief-l"),text));
      renderStability(b, false);
    },
    footer:[{label:"迷宮に入る",kind:"primary",onTap:h=>{
      h.close("ok");
      if (!soulRequest) { go(); return; }
      sheet.open({ kind:"info", banner:"門衛", title:"ちょっと待ってください",
        className:"dp-brief-sheet", accent:"#78bdd1",
        lines:["もし迷宮の中に縛られた魂を見かけたら、持ち帰ってください。きっと、あなたの力になると思います。"],
        footer:[{label:"迷宮に入る",kind:"primary",onTap:next=>{next.close("ok");go();}}],
      });
    }},
      {label:"支度に戻る",kind:"ghost",onTap:h=>h.close("cancel")}],
  });
}

// ---- 無限迷宮の入口 ----
function renderAbyssPage(b) {
  const rec = game.abyssRecords ? game.abyssRecords() : { bestDepth: 0, runs: 0, recent: [] };
  const back = el("button", "dp-back");
  back.type = "button";
  back.appendChild(el("span", "dp-back-c", "‹"));
  back.appendChild(el("span", null, "門の選択へ"));
  back.addEventListener("click", () => { sfx("select"); cur.page = "gates"; refresh(); });
  b.appendChild(back);
  b.appendChild(el("div", "dg-note", "口から吹き上げる風が、育って重くなった魂を吹き返す。人業はそのままでは降りられない。隊の者は魂のひとかけを土くれの仮の器6体に移し、入口に漂う「名もなき魂の欠片」を宿して Lv1 から降りる。力は置いてゆくが、記憶だけは器に残る。"));
  b.appendChild(sec("潜り方"));
  for (const t of [
    `器ひとつごとに、3つの魂の欠片 (コモン・レア) から1つを選ぶ。全員 Lv1・装備なし・持ち物なし。魂の安定度は入場時と5階ごとの次階進行時に各人${game.STABILITY_ENTRY_COST}消費する。`,
    "5の倍数の階は風だまり。回収人 (品の買い取り・回復の道具・鍛え直し) と灯番 (魂の付け替え・強化・残火) がいて、その奥に主が立つ。",
    "帰れるのは、主を討った後の「帰る」だけ (帰還魔法陣は無い)。深くなるほど敵も風の掟も強くなるが、育つ速さも本編より速い。",
    "迷宮で拾った品は鑑定済み。同じ職の魂を拾うと自動で融合する。サブ魂は2つまで宿せる。極の永続強化は乗るが、結社・手がかりの恵みは乗らない。",
    "50階ごとの主を討つと、魂の記憶を各階1つ保存できる。職業・Lv・装着中の装備・メイン魂とサブ魂を記憶し、次の階から何度でも挑み直せる。消費アイテム・資金・残火・袋の品・宿していない魂は記憶しない。各階の記憶は上書きできる。",
  ]) b.appendChild(el("div", "dg-line", t));
  b.appendChild(sec("持ち帰れるもの"));
  for (const t of [
    "拾った魂 ― ＋1 の素材として本編の魂に加わる (Lv は残らない)。",
    "拾った品 ― 手元には届かず、商会の棚に並ぶ。",
    "拾った魂の残火 ― 拾った数だけ本編へ。",
    "開始時の魂・記憶した装備・金貨・✦Soul は持ち帰れない。記憶した装備は売値0・鍛え直し不可で、商会にも並ばない。全滅したら、赤い魂20または広告視聴で今回の戦利品を持ち帰れる。魂の記憶は全滅しても残る。",
  ]) b.appendChild(el("div", "dg-line", t));
  b.appendChild(sec("そなたの記録"));
  const t = el("div", "dg-tally");
  const cell = (v, l) => { const c = el("div", "dg-tally-c"); c.appendChild(el("div", "dg-tally-n", String(v))); c.appendChild(el("div", "dg-tally-l", l)); return c; };
  t.appendChild(cell(`B${rec.bestDepth || 0}F`, "最深"));
  t.appendChild(cell(rec.runs || 0, "挑戦"));
  b.appendChild(t);
  // 称号 (見た目だけ): 付けている称号と、選び直す入口
  if (game.infTitleList) {
    const list = game.infTitleList(), name = game.infTitleName ? game.infTitleName() : "";
    const tb = el("button", "dp-gate dp-title");
    tb.type = "button";
    tb.appendChild(el("span", "dp-gate-n", name ? `称号「${name}」の隊` : "称号なし"));
    tb.appendChild(el("span", "dp-gate-s", `得た称号 ${list.filter((x) => x.got).length}/${list.length} ・ 選び直す ›`));
    tb.addEventListener("click", () => { sfx("select"); if (UI.openInfTitles) UI.openInfTitles(() => refresh()); });
    b.appendChild(tb);
  }
  if ((rec.recent || []).length) {
    b.appendChild(sec("直近の挑戦"));
    const OUT = { return: "帰還", saved: "全滅 (戦利品を保護)", wipe: "全滅" };
    for (const r of rec.recent.slice(0, 5)) b.appendChild(el("div", "dg-line", `B${r.depth}F ・ ${OUT[r.outcome] || r.outcome}`));
  }
}

// ---- 宿敵の再戦の支度 ----
function renderRematchPage(b) {
  const back = el("button", "dp-back");
  back.type = "button";
  back.appendChild(el("span", "dp-back-c", "‹"));
  back.appendChild(el("span", null, "門の選択へ"));
  back.addEventListener("click", () => { sfx("select"); cur.page = "gates"; refresh(); });
  b.appendChild(back);
  b.appendChild(el("div", "dg-note", "闘技場跡の砂の上で、倒した名のある強敵と迷宮の主の記憶に挑み直す。相手は隊の今の強さに合わせて手強くなり、生前に無かった特色をひとつ身につけている。"));
  b.appendChild(el("div", "dg-note", `記憶との手合わせなので、終われば隊の HP・MP・状態は挑む前に戻る (負けても砕けない)。勝てば ✦Soul と金貨。名のある強敵は首級を ＋1 に鍛え (＋${game.REMATCH_FORGE_MAX || 5} まで)、主は初めて勝った時に記憶のかけらを語る。`));
  const rv = game.rematchList ? game.rematchList() : [];
  if (!rv.length) { b.appendChild(el("div", "dg-line", "まだ挑める相手がいない。名のある強敵か迷宮の主を倒すと、ここに並ぶ。")); return; }
  if (!rv.some((x) => x.key === cur.rival)) cur.rival = rv[0].key;
  const groups = [["boss", "迷宮の主"], ["named", "名のある強敵"]];
  for (const [kind, label] of groups) {
    const xs = rv.filter((x) => x.kind === kind);
    if (!xs.length) continue;
    b.appendChild(sec(label, `${xs.length}`));
    for (const x of xs) {
      const on = x.key === cur.rival;
      const r = el("button", "dp-gate" + (on ? " sel" : ""));
      r.type = "button";
      r.setAttribute("aria-pressed", on ? "true" : "false");
      const info = el("span", "dp-gate-i");
      info.appendChild(el("span", "dp-gate-n", x.name));
      const bits = [`Lv${x.lv}`, `「${x.home}」`];
      if (x.trait) bits.push(`＋${x.trait}`);
      info.appendChild(el("span", "dp-gate-c", bits.join(" ・ ")));
      const more = [];
      if (x.trophy) more.push(x.trophy.held ? `首級「${x.trophy.name}」＋${x.trophy.forge}` : `首級「${x.trophy.name}」は手元に無い`);
      if (x.kind === "boss" && x.memory) more.push(x.heard ? "記憶のかけら ― 聞いた" : "記憶のかけら ― まだ聞いていない");
      if (more.length) info.appendChild(el("span", "dp-gate-c dp-hint", more.join(" ・ ")));
      r.appendChild(info);
      r.appendChild(el("span", "dp-gate-st" + (x.wins ? " done" : ""), x.wins ? `勝ち ${x.wins}` : "未勝利"));
      r.addEventListener("click", () => { sfx("select"); cur.rival = x.key; refresh(); });
      b.appendChild(r);
    }
  }
}

// ---- 足元 (決め手) ----
function footerSpec() {
  const g = G();
  if (cur && cur.page === "rematch") {
    const rv = game.rematchList ? game.rematchList() : [];
    const x = rv.find((t) => t.key === cur.rival) || null;
    const alive = g.party.some((p) => p.alive);
    return [{ label: !alive ? "動ける人業がいない" : x ? `挑む ― ${x.name}` : "相手を選ぶ", sub: x ? `Lv${x.lv}${x.trait ? ` ・ ＋${x.trait}` : ""} ・ 安定度 −${game.STABILITY_ENTRY_COST}／人` : "",
      disabled: !x || !alive, kind: "danger", size: "lg",
      onTap: () => { if (!x) return; const go=()=>{close();game.departRematch?.(x.key);}; if(!G().stabilityBriefed)openBriefing(go);else go(); } }];
  }
  if (cur && cur.page === "abyss") {
    return [
      { label: "入口へ ― 魂の欠片を選ぶ", sub: "仮の器6体 ・ Lv1 から", kind: "primary", size: "lg", onTap: () => { close(); if (UI.openInfSetup) UI.openInfSetup(); } },
      { label: "魂の記憶から始める", sub: `保存済み ${game.infMemories().length}件`, kind: "secondary", onTap: () => UI.openInfMemories(close) },
    ];
  }
  const D = game.DUNGEONS || [];
  const dn = D[g.dungeonIdx];
  const alive = g.party.some((p) => p.alive);
  const w = wst();
  const again = !!(dn && w.cleared && w.cleared[dn.id]);
  const m = cur && cur.accept && cur.hasMut;
  const fl = `B${(cur && cur.from) || 1}F`;
  // 潜り始める階を選べる時は札の上に階の札が並ぶので、名の横の階は省き、下の行に書く
  const pick = startFloors().length > 1;
  const go = m ? "異変ごと門をくぐる" : again ? "ふたたび門をくぐる" : "門をくぐる";
  return [{
    label: alive ? (pick ? go : `${go} ― ${fl}`) : "動ける人業がいない",
    sub: dn ? (pick ? `${fl}から「${dn.name}」へ${dn.stabilityFree ? "" : ` ・ 安定度 −${game.STABILITY_ENTRY_COST}／人`}` : `「${dn.name}」${dn.stabilityFree ? "" : ` ・ 安定度 −${game.STABILITY_ENTRY_COST}／人`}`) : "",
    kind: m ? "danger" : "primary", size: "lg", disabled: !alive,
    onTap: () => depart(),
  }];
}
function refreshFooter() {
  if (!cur || !cur.h || cur.h.closed) return;
  const foot = cur.h.foot;
  foot.textContent = "";
  if (cur.page === "gates") {
    const ready = el("div", "dp-ready");
    renderReady(ready);
    foot.appendChild(ready);
  }
  const floors = startFloors();
  for (const it of footerSpec()) {
    const b = button(it);
    b.classList.add("dp-cta");
    if (floors.length > 1) {
      const go = el("div", "dp-go" + (it.kind === "danger" ? " danger" : ""));
      go.appendChild(startFloorPicker(floors));
      go.appendChild(b);
      foot.appendChild(go);
    } else foot.appendChild(b);
  }
  foot.classList.remove("hidden");
}
// 修復・宿泊の後も念押しを更新し、潜る操作は別に選んでもらう。
function checkWoes(go) {
  const read = () => game.departWoes ? game.departWoes() : null;
  const initial = read();
  if (!initial || (!initial.list.length && !(initial.broken || []).length)) { go(); return; }
  const spec = () => {
    const w = read();
    const broken = w.broken || [];
    const lines = broken.map((d) => `${d.name} ― ${d.rescuing ? "迷宮からの連れ帰りを待っている" : `魂が砕けている ・ 修復 💰${d.cost}`}`);
    if (w.list.length && broken.length) lines.push("傷や消耗が残っている人業");
    for (const d of w.list) {
      const p = [];
      if (d.ail) p.push(d.ail);
      if (d.hp < d.maxhp) p.push(`HP ${d.hp}/${d.maxhp}`);
      if (d.mp < d.maxmp) p.push(`MP ${d.mp}/${d.maxmp}`);
      lines.push(`${d.name} ― ${p.join(" ・ ")}`);
    }
    lines.push(`所持金貨 💰${G().gold || 0}`);
    lines.push(broken.length || w.list.length
      ? "修復や宿泊はこの場で行える。支度を整えてから、潜るかどうかを選べる。"
      : "支度が整った。門をくぐる準備はいいか？");
    const update = (h) => { refresh(); h.update(spec()); };
    const footer = [];
    if (broken.length) {
      const d = broken.find((d) => !d.rescuing);
      const ok = d && (G().gold || 0) >= d.cost;
      footer.push({ label: "人業の館で修復する", sub: d
        ? `${d.name} ・ 💰${d.cost}${ok ? " ・ 1人を修復" : " ・ 金貨が足りない"}`
        : "迷宮から連れ帰られると修復できる", kind: "primary", disabled: !ok,
        onTap: (h) => {
          const doll = G().party.find((p) => p.uid === d.uid);
          if (game.repairDoll) game.repairDoll(doll);
          update(h);
        } });
    }
    if (w.innOpen && w.list.length) {
      const ok = (G().gold || 0) >= w.cost;
      footer.push({ label: "宿屋で休む", sub: `💰${w.cost} ・ ${ok ? "生きている人業のHP・MPと状態異常を回復" : "金貨が足りない"}`, kind: "primary", disabled: !ok,
        onTap: (h) => { if (ops.restParty) ops.restParty(); update(h); } });
    }
    const woes = broken.length || w.list.length;
    const alive = G().party.some((d) => d.alive);
    footer.push({ label: alive ? (woes ? "このまま潜る" : "迷宮に潜る") : "動ける人業がいない", kind: woes ? "danger" : "primary", disabled: !alive,
      onTap: (h) => { h.close("ok", { silent: true }); go(); } });
    footer.push({ label: "出撃画面に戻る", kind: "ghost", onTap: (h) => h.close("cancel") });
    return {
      title: broken.length ? "魂が砕けた人業がいる" : w.list.length ? "傷や消耗が残っている人業がいる" : "支度が整った",
      lines, footer,
    };
  };
  sfx("select");
  sheet.open({ kind: "choice", banner: "出撃前の確認", accent: "#c98a2a", className: "ui-confirm dp-woes", ...spec() });
}

function depart() {
  if (!cur) return;
  checkWoes(()=>{if((game.stabilityApplies?.() && !G().stabilityBriefed) || !G().dungeonBriefed)openBriefing(departGo);else departGo();});
}
function departGo() {
  const g = G();
  if (!cur) return;
  const accept = !!(cur.accept && cur.hasMut);
  const idx = g.dungeonIdx;
  const from = cur.from || 1;
  sfx("select");
  close();
  if (game.departNow) game.departNow({ idx, accept, from });
}

function body(b) {
  if (cur.page === "abyss") { renderAbyssPage(b); return; }
  if (cur.page === "rematch") { renderRematchPage(b); renderStability(b); return; }
  renderGates(b); // 異変は迷宮の掟の隣 (迷宮の顔の中) に出す
  renderStability(b);
  renderReadyIssues(b);
}
function refresh() {
  if (!cur || !cur.h || cur.h.closed) return;
  const scroll = cur.h.body ? cur.h.body.scrollTop : 0;
  cur.h.update({ banner: pageBanner(cur.page), body });
  if (cur.h.el) cur.h.el.classList.toggle("dp-full", cur.page === "gates");
  refreshFooter();
  if (cur.h.body) cur.h.body.scrollTop = scroll;
}
export function refreshStabilityDisplay() { refresh(); }
const pageBanner = (page) => page === "abyss" ? "無限迷宮" : page === "rematch" ? "宿敵の再戦" : "出 撃";
function close() {
  vistaLoop++;
  if (cur && cur.h && !cur.h.closed) cur.h.close("close");
  cur = null;
}

export function openDeparture(opts = {}) {
  const g = G();
  if (!g || g.state !== "town") return null;
  if (openCount() < 1) { toast("王の勅命を果たすまで、迷宮のありかは明かされない", { tone: "info" }); return null; }
  // 踏破の報告が済むまで門は開かない (王宮へ案内するシートを出す)
  if (game.blockForReport && game.blockForReport()) return null;
  if (game.blockForTutorial && game.blockForTutorial()) return null;
  if (cur && cur.h && !cur.h.closed) { if (opts.page) { cur.page = opts.page; refresh(); } return cur.h; }
  const page = opts.page === "abyss" && game.featureUnlocked && game.featureUnlocked("infinite") ? "abyss"
    : opts.page === "rematch" && game.featureUnlocked && game.featureUnlocked("rematch") ? "rematch" : "gates";
  // 勅命の迷宮を最初から選んでおく (攻略中の章のみ)
  // (街に戻って最初に開いた時だけ。広場などで選び直した迷宮はそのまま尊重する)
  const qi = questIdx();
  if (!g._departPre && qi >= 0 && isOpen(qi)) g.dungeonIdx = qi;
  g._departPre = true;
  // 潜り始める階: 既定は到達した最深の帰還魔法陣の次の階 (無ければ B1F)
  const dn0 = (game.DUNGEONS || [])[g.dungeonIdx];
  const fl0 = dn0 && game.startFloorsOf ? game.startFloorsOf(dn0) : [1];
  cur = { page, accept: true, hasMut: false, h: null, from: fl0[fl0.length - 1] || 1 };
  cur.h = sheet.open({
    kind: "info", banner: pageBanner(page), className: "dp-sheet",
    accent: "#8e6fd0",
    body,
    footer: [],
    onClose: () => { if(cur?.timer)clearInterval(cur.timer);cur = null; vistaLoop++; },
    // 戻る: 無限迷宮・再戦のページなら門の選択へ、門の選択なら閉じる
    onBack: (h) => { if (cur && cur.page !== "gates" && !opts.page) { cur.page = "gates"; refresh(); } else h.close("back"); },
  });
  if (cur.h.el) cur.h.el.classList.toggle("dp-full", page === "gates");
  refreshFooter();
  const live=cur;
  live.timer=setInterval(()=>{if(cur!==live||live.h.closed){clearInterval(live.timer);return;}if(sheet.top()===live.h)refresh();},5000);
  return cur.h;
}

export function install() {
  registerUI({ openDeparture });
}
