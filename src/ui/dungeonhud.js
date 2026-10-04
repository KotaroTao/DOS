// ===== 迷宮の HUD — 行動ドック・手帳シート・階の情報・今回の収穫・長押しの覗き見・墨の帳 =====
// 担当: WP-D。game.js は import しない (ctx.js の UI / game / ops を通す)。
// 提供する契約: UI.openDungeonMenu() (手帳 = 迷宮の一時停止シート)
//
//   行動ドック   … #hint を置き換える画面下の 52px。いま取れる行動だけを大きく (▼ 降りる / ⌂ 帰還)
//   手帳         … 階の情報・迷宮の異変・隊を見る・記録を読む・図鑑・今回の収穫・帰還・探索の手間・設定
//   階の情報     … 見出しの迷宮名を押すと開く。特別な階・強敵・異変・奈落の変異の説明を読み返せる
//   今回の収穫   … 収穫の帯を押すと開く。得た品 (押せば品の詳細)・魂・成長・倒した数
//   覗き見       … 隊の札を長押し (戦闘中も) / 敵を長押し (特徴・スキル)
//   墨の帳       … 階を降りる暗転 (約1.3秒・400ms 後はタップで飛ばせる)。特別な階の知らせを2〜3行添える
//
// game.js から直接使う道具 (prefs / motion) もここから再び書き出す (game.js の import 欄に触れないため)

import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, row, setText, glyph, itemTile, portrait, bar, reduced } from "./kit.js";
import { getPref, setPref, remember } from "./prefs.js";
import { sceneTransition } from "./motion.js";
import { MONSTERS, ICONS, spriteCanvas, crispCanvas } from "../sprites.js";
import { ELEMENTS, monsterTraits, isFloating, unknownLabel } from "../dungeons/index.js";
import { tagRow, traitTagKinds, affinityRow, revealSteps, monKills, enemyReveal, enemyLabel, revealLock, BUFF_NAME, setLogText, UNKNOWN_COLOR } from "./itemview.js";
import { RARITIES } from "../rarity.js";
import { SOUL_CLASSES, soulIcon } from "../souls.js";
import { WALKER as WALKER_ART } from "../walkerart.js";
import { markOf } from "./questboard.js";

export { getPref, setPref, remember, sceneTransition };

// ================= 迷宮の自分の駒 (赤い頭巾の人影・4方向) =================
// src/walkerart.js の WALKER = { down, up, left, right } (各 {palette, art}・20×31 ドット・足元は共通)
let WALKER = WALKER_ART || null;
export function walkerArt() { return WALKER; }
export function setWalkerArt(w) { WALKER = w || null; } // 検証用 (null で従来の人業の姿)

const G = () => game.G;
const sfx = (k) => { try { if (game.SFX && game.SFX[k]) game.SFX[k](); } catch (e) { /* 音が無くても動く */ } };

// ================= 行動ドック =================
// spec: { down:{key,label,sub,kind,icon} | null, home:{label,sub} | null, heal:{label,sub,hot} | null, idle } (game.js の dockSpec)
//   heal = 「全員を回復」(隊の画面と同じ game.healAll)。帰還の右に並ぶ
// 盤面は毎フレーム描き直されるので、中身が変わった時だけ作り直す
const DOCK_SVG = {
  down: '<path d="M4 5.5h5v4h5v4h5"/><path d="M12 15v5.5M8.6 17.6 12 21l3.4-3.4"/>',
  boss: '<path d="M5.5 12.2c0-4 2.9-7.2 6.5-7.2s6.5 3.2 6.5 7.2c0 2.3-1 3.6-2.3 4.4v2.6h-8.4v-2.6c-1.3-.8-2.3-2.1-2.3-4.4Z"/><path d="M9.3 11.6h.01M14.7 11.6h.01M10.4 19.2v-2M13.6 19.2v-2"/>',
  star: '<path d="M12 3.2 14.2 9.2l6.3.2-5 3.9 1.8 6.1L12 15.8l-5.3 3.6 1.8-6.1-5-3.9 6.3-.2Z"/>',
  home: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M6 9.4v10.1h12V9.4"/><path d="M10 19.5v-5h4v5"/>',
  book: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/><path d="M9 8h6M9 10.6h4"/>',
  loot: '<path d="M4 9.5h16v10H4Z"/><path d="M4 9.5 6.5 5h11L20 9.5"/><path d="M10 13h4"/>',
  scroll: '<path d="M7 4.5h11v13a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 17.5V16h11"/><path d="M7 4.5A2.5 2.5 0 0 0 4.5 7v1H7"/><path d="M10 8.5h5M10 11.5h5"/>',
  party: '<path d="M5.6 20.5v-8.3a6.4 6.4 0 0 1 12.8 0v8.3"/><path d="M5.6 13.4h12.8"/><path d="M12 13.4v7.1"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M9.6 5.7 L9.6 2.9 14.4 2.9 14.4 5.7 A6.8 6.8 0 0 1 17.3 7.7 L19.9 6.9 21.4 11.5 18.8 12.4 A6.8 6.8 0 0 1 17.7 15.7 L19.3 17.9 15.4 20.8 13.8 18.6 A6.8 6.8 0 0 1 10.2 18.6 L8.6 20.8 4.7 17.9 6.3 15.7 A6.8 6.8 0 0 1 5.2 12.4 L2.6 11.5 4.1 6.9 6.7 7.7 A6.8 6.8 0 0 1 9.6 5.7Z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.01"/>',
  float: '<path d="M6 9.5c1.6-2 3.6-3 6-3s4.4 1 6 3"/><path d="M12 6.5v8"/><path d="M9.2 12 12 14.8 14.8 12"/><path d="M4.5 19c1.2-.9 2.4-.9 3.6 0s2.4.9 3.6 0 2.4-.9 3.6 0 2.4.9 3.6 0"/>',
  eye: '<path d="M2.8 12c2.4-4 5.5-6 9.2-6s6.8 2 9.2 6c-2.4 4-5.5 6-9.2 6s-6.8-2-9.2-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  stairs: '<path d="M12 3v18"/><path d="M5.5 5.5h10l3 2.5-3 2.5h-10Z"/><path d="M18.5 12.5h-10l-3 2.5 3 2.5h10Z"/>',
  heal: '<path d="M12 20.2s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.5c0 5.5-7.5 10.1-7.5 10.1Z"/><path d="M12 10.4v5.2M9.4 13h5.2"/>',
};
function dockIcon(kind, cls = "dk-ic") {
  const ns = "http://www.w3.org/2000/svg";
  const sv = document.createElementNS(ns, "svg");
  sv.setAttribute("viewBox", "0 0 24 24");
  sv.setAttribute("aria-hidden", "true");
  sv.setAttribute("class", cls);
  sv.innerHTML = DOCK_SVG[kind] || "";
  return sv;
}
let _dockKey = "";
export function renderDock(host, spec, acts = {}) {
  if (!host) return;
  host.classList.add("dg-dock");
  const key = spec ? JSON.stringify([spec.down, spec.home, spec.heal, spec.fields, spec.idle]) : "none";
  if (key === _dockKey && host.childElementCount) return;
  _dockKey = key;
  host.textContent = "";
  if (!spec) return;
  // 迷宮の術は技ごとにボタンを出す。並びきらない時は札 (絵 + 短い名前) に詰める:
  //  術が2つ以上 → 術は札 / 術があってボタンが4つ以上 (または5つ以上) → 帰還・回復も札 / 7つ以上 → 降りるも札
  const fields = spec.fields || [];
  const nBtn = [spec.down, spec.home, spec.heal].filter(Boolean).length + fields.length;
  const tight = nBtn >= 5 || (nBtn >= 4 && fields.length >= 1);
  const fieldTag = tight || fields.length >= 2;
  const downTag = nBtn >= 7;
  const DOWN_SHORT = { down: "降りる", boss: "主の間", clear: "踏破", guard: "門番" };
  const mk = (cls, icon, label, sub, onTap, short) => {
    const b = el("button", "dk-btn " + cls);
    b.type = "button";
    b.appendChild(dockIcon(icon));
    if (short) {
      b.classList.add("dk-tag");
      b.appendChild(el("span", "dk-sl", short));
      b.title = label + (sub ? " (" + sub + ")" : "");
    } else {
      const t = el("span", "dk-t");
      t.appendChild(el("span", "dk-l", label));
      if (sub) t.appendChild(el("span", "dk-s", sub));
      b.appendChild(t);
    }
    b.setAttribute("aria-label", label + (sub ? " " + sub : ""));
    b.addEventListener("click", (e) => { e.stopPropagation(); onTap(); });
    return b;
  };
  if (spec.down) host.appendChild(mk("dk-down k-" + (spec.down.kind || "primary"), spec.down.icon || "down", spec.down.label, spec.down.sub, acts.descend || (() => {}), downTag && (DOWN_SHORT[spec.down.key] || spec.down.label)));
  if (spec.home) host.appendChild(mk("dk-home", "home", spec.home.label, spec.home.sub, acts.goHome || (() => {}), tight && spec.home.label));
  if (!spec.down && !spec.home) {
    const idle = el("div", "dk-idle");
    idle.appendChild(el("i", "dk-idle-mark"));
    idle.appendChild(el("span", "dk-idle-t", spec.idle || ""));
    host.appendChild(idle);
  }
  // 迷宮で唱える技 (浮遊・気配読み・宝探し・道しるべ。覚えた者がいる時だけ)。効いている間は光る
  // (浮遊・道しるべ = 青緑 / 気配読み = 赤 / 宝探し = 青)
  const FIELD_ICON = { float: "float", enemy: "eye", chest: "loot", stairs: "stairs" };
  for (const f of fields) host.appendChild(mk("dk-float k-" + f.kind + (f.on ? " on" : ""), FIELD_ICON[f.kind] || "float", f.label, f.sub, () => (acts.field || (() => {}))(f.key), fieldTag && f.label));
  if (spec.heal) host.appendChild(mk("dk-heal" + (spec.heal.hot ? " hot" : ""), "heal", spec.heal.label, spec.heal.sub, acts.healAll || (() => {}), tight && "回復"));
  host.classList.toggle("one", !!spec.down !== !!spec.home);
  host.classList.toggle("has-down", !!spec.down);
  host.classList.toggle("has-home", !!spec.home);
  host.classList.toggle("has-float", fields.length > 0);
  host.classList.toggle("tight", tight);
}

// ================= 小さな部品 =================
function section(title, sub) {
  const h = el("div", "dg-sec");
  h.appendChild(el("i", "dg-sec-mark"));
  h.appendChild(setText(el("span", "dg-sec-t"), title));
  if (sub) h.appendChild(setText(el("span", "dg-sec-s"), sub));
  return h;
}
function pips(floor, floors, boss) {
  const w = el("span", "dg-pips");
  if (!floors || floors > 12) { w.appendChild(el("span", "dg-pips-of", floors ? `/ ${floors}` : "奈落")); return w; }
  for (let i = 1; i <= floors; i++) w.appendChild(el("i", (i < floor ? "done" : i === floor ? "now" : "") + (i === floors && boss ? " boss" : "")));
  return w;
}
function iconRow(icon, title, sub, o = {}) {
  return row({ icon: typeof icon === "string" ? dockIcon(icon, "dg-row-ic") : icon, title, sub, chevron: !!o.onTap, onTap: o.onTap, tone: o.tone, right: o.right });
}

// ================= 階の情報 =================
// いまの階の性質をまとめる (迷宮・深さ・目的・強敵/特別な階・異変・奈落の誓約と変異・帰還の可否)
function floorFacts() {
  const g = G();
  const cfg = game.activeCfg ? game.activeCfg() : null;
  const dn = game.curDungeon ? game.curDungeon() : null;
  const abyss = game.abyssActive ? game.abyssActive() : false;
  const theme = game.dungeonTheme ? game.dungeonTheme(cfg) : null;
  const sp = game.specialDef ? game.specialDef() : null;
  const mu = game.mutDef ? game.mutDef() : null;
  const obj = game.dungeonObjective ? game.dungeonObjective() : null;
  const facts = [];
  if (g.eliteFloor) {
    const ekey = game.eliteKey ? game.eliteKey() : null;
    const ek = ekey ? MONSTERS[ekey] : null;
    // 名前は一度倒すまで不確定名 (敵の情報の段階開示と同じ)
    const ekName = ek ? (monKills(ekey) >= revealSteps(ek).name ? ek.name : unknownLabel(ek)) : "";
    facts.push({ tone: "bad", icon: ek || ICONS.trap, title: "強敵の気配", lines: ["この階には通常では遭遇しない強大な存在が潜む。", ek ? `強敵「${ekName}」― 討てば希少な戦利品と魂を残しやすい。` : "討てば希少な戦利品を得られる。"] });
  }
  if (sp) facts.push({ tone: "gold", icon: ICONS[sp.icon] || ICONS.stairs, title: `特別な階「${sp.name}」`, accent: sp.accent, lines: sp.lines });
  if (mu) facts.push({ tone: "gold", icon: ICONS.stairs, title: `迷宮の異変「${mu.name}」`, accent: mu.accent, lines: [`危険 ― ${mu.risk}`, `見返り ― ${mu.gain}`] });
  if (g.abyss && game.ABYSS_MUT_MAP) {
    for (const id of (g.abyss.mutations || [])) {
      const m = game.ABYSS_MUT_MAP[id];
      if (m) facts.push({ tone: m.kind === "boon" ? "gold" : "bad", icon: ICONS.portal, title: `${m.kind === "boon" ? "奈落の恵み" : "奈落の変異"}「${m.name}」`, accent: m.accent, lines: [m.desc] });
    }
  }
  // 迷宮のイベント (出来事) の効果: この階 / この潜入
  if (game.eventFacts) { try { facts.push(...game.eventFacts()); } catch (e) { /* 表示のみ */ } }
  return { g, cfg, dn, abyss, theme, sp, mu, obj, facts };
}
export function openFloorInfo() {
  const g = G();
  if (!g) return null;
  const f = floorFacts();
  const name = f.abyss ? "無限迷宮「奈落」" : (f.dn ? f.dn.name : "");
  const floors = f.abyss ? 0 : (f.dn && f.dn.floors) || 1;
  return sheet.open({
    kind: "info", banner: "階の情報", className: "dg-sheet",
    accent: f.theme ? f.theme.accent : null,
    body: (b) => {
      const head = el("div", "dg-floorhead");
      head.appendChild(el("div", "dg-fh-name", name));
      const r = el("div", "dg-fh-row");
      r.appendChild(el("span", "dg-fh-depth", `B${g.floor}F`));
      r.appendChild(pips(g.floor, floors, !f.abyss && f.dn && !!f.dn.boss));
      head.appendChild(r);
      const meta = [];
      if (f.theme) meta.push(`第${(f.cfg && f.cfg.layer) || 1}層 ${f.theme.name}`);
      if (f.cfg && f.cfg.element && ELEMENTS[f.cfg.element]) meta.push(`${ELEMENTS[f.cfg.element].label}の気配`);
      if (meta.length) head.appendChild(el("div", "dg-fh-meta", meta.join(" ・ ")));
      b.appendChild(head);
      if (f.obj) b.appendChild(iconRow(f.obj.k === "boss" ? "boss" : "down", f.obj.t, "この階で為すべきこと"));
      const canHome = game.canReturnNow ? game.canReturnNow() : false;
      b.appendChild(iconRow("home", canHome ? "帰還できる" : "まだ帰れない", canHome ? (g.bossDown ? "主を討った。どこからでも帰還できる" : "帰還陣を見つけた。下の「帰還」から戻れる") : "帰還陣を見つけるか、迷宮の主を討つまで", { tone: canHome ? "gold" : null }));
      // 受けている依頼のうち、この迷宮で果たせるもの (討伐・到達・踏破・魂・宝箱。達成済みは報告待ちとして後ろに)
      let qs = [];
      try { qs = game.questsHere ? game.questsHere() : []; } catch (e) { setTimeout(() => { throw e; }); }
      if (qs.length) {
        const todo = qs.filter((q) => q.state !== "done").length;
        b.appendChild(section("ここで果たせる依頼", todo ? `${todo}件` : "すべて達成"));
        for (const q of qs) {
          const done = q.state === "done";
          const prog = q.type === "clear" ? null : q.type === "floor" ? (q.progress ? `いま地下${q.progress}階まで` : "未到達") : `${q.progress || 0} / ${q.goal}`;
          const sub = done ? "達成 ― 街へ戻ったら酒場で報告" : [q.desc, prog].filter(Boolean).join(" ・ ");
          b.appendChild(row({ icon: markOf(q, 30), title: q.name, sub, tone: done ? "gold" : null }));
        }
      }
      if (f.facts.length) b.appendChild(section("この階の性質"));
      else b.appendChild(el("div", "dg-note", "この階に変わった性質はない。"));
      for (const x of f.facts) {
        const card = el("div", "dg-fact t-" + (x.tone || "gold"));
        if (x.accent) card.style.setProperty("--fact", x.accent);
        const ic = el("span", "dg-fact-ic");
        try { ic.appendChild(spriteCanvas(x.icon, 2)); } catch (e) { /* 絵が無くても動く */ }
        card.appendChild(ic);
        const tx = el("div", "dg-fact-t");
        tx.appendChild(setText(el("div", "dg-fact-h"), x.title));
        for (const ln of x.lines || []) tx.appendChild(setText(el("div", "dg-fact-l"), ln));
        card.appendChild(tx);
        b.appendChild(card);
      }
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// ================= 今回の収穫 =================
export function openRunLoot() {
  const g = G();
  if (!g) return null;
  const r = g.run || { gold: 0, soulPts: 0, items: [], souls: [] };
  return sheet.open({
    kind: "info", banner: "今回の収穫", className: "dg-sheet",
    body: (b) => {
      const tot = el("div", "dg-tally");
      const cell = (glyphKind, v, label) => {
        const c = el("div", "dg-tally-c");
        const n = el("div", "dg-tally-n");
        if (glyphKind) n.appendChild(glyph(glyphKind));
        n.appendChild(document.createTextNode(String(v)));
        c.appendChild(n);
        c.appendChild(el("div", "dg-tally-l", label));
        return c;
      };
      tot.appendChild(cell("gold", r.gold || 0, "ゴールド"));
      tot.appendChild(cell("soul", r.soulPts || 0, "Soul"));
      tot.appendChild(cell(null, r.kills || 0, "倒した敵"));
      tot.appendChild(cell(null, `B${Math.max(r.floors || 1, g.floor || 1)}F`, "到達"));
      b.appendChild(tot);
      if (r.secured) b.appendChild(el("div", "dg-note gold", "主を討った ― 戦利品は確定した (全滅しても失わない)"));
      const items = r.items || [];
      b.appendChild(section("得た品", items.length ? `${items.length}点` : "まだ無い"));
      if (items.length) {
        const grid = el("div", "dg-tiles");
        const sorted = items.slice().sort((a, c) => ((RARITIES[c.item.rar] || {}).order || 0) - ((RARITIES[a.item.rar] || {}).order || 0));
        for (const { owner, item } of sorted) {
          const cellEl = el("div", "dg-tilecell");
          cellEl.appendChild(itemTile(item, { size: 56, onTap: () => { try { UI.itemSheet(item, { owner, context: "dungeon" }); } catch (e) { /* 品の詳細が無くても動く */ } },
            onHold: UI.codexItemSheet ? () => UI.codexItemSheet(item.id, { item }) : null }));
          cellEl.appendChild(el("span", "dg-tile-who", owner ? owner.name : ""));
          grid.appendChild(cellEl);
        }
        b.appendChild(grid);
        b.appendChild(el("div", "dg-note", "迷宮で拾った装備は未鑑定。街の商会でまとめて鑑定できる。"));
      }
      const souls = r.souls || [];
      if (souls.length) {
        b.appendChild(section("魂", `${souls.length}体`));
        const list = el("div", "dg-souls");
        for (const s of souls) {
          const c = SOUL_CLASSES[s.clsKey];
          const chip = el("span", "dg-soul r-" + ((c && c.rarity) || "common"));
          try { chip.appendChild(crispCanvas(soulIcon(s.clsKey), 24)); } catch (e) { /* noop */ }
          chip.appendChild(el("span", null, c ? c.label : s.clsKey));
          if (c && c.glow) chip.style.setProperty("--glow", c.glow);
          list.appendChild(chip);
        }
        b.appendChild(list);
      }
      const lv = r.levels || [];
      if (lv.length) {
        b.appendChild(section("魂の成長"));
        for (const x of lv) b.appendChild(el("div", "dg-line up", `${x.name}　Lv${x.from} → Lv${x.to}`));
      }
      if (r.embers) b.appendChild(el("div", "dg-line", `魂の残火 ×${r.embers}`));
      if ((r.lost || []).length) {
        b.appendChild(section("持ちきれず置いてきた"));
        for (const n of r.lost) b.appendChild(el("div", "dg-line bad", n));
      }
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// ================= 記録 (全文) =================
// 履歴は game.logHistory (記録欄より長く覚えている)。無ければ記録欄の行から。
// ページに分けず縦スクロールの1枚で見せる (ユーザー指定の例外)。最新 (最下部) から開き、上へ遡る
export function openLog() {
  let lines = typeof game.logHistory === "function" ? game.logHistory() : null;
  if (!lines) {
    const src = document.getElementById("log");
    lines = src ? [...src.children].map((ln) => ({ text: ln.textContent, cls: ln.className || "l-sys" })) : [];
  }
  let body = null;
  const h = sheet.open({
    kind: "info", banner: "記録", className: "dg-sheet dg-logsheet", paged: false,
    body: (b) => {
      body = b;
      const box = el("div", "dg-logfull");
      if (!lines.length) box.appendChild(el("div", "dg-note", "まだ何も記されていない。"));
      for (const ln of lines) box.appendChild(setLogText(el("div", ln.cls || "l-sys"), ln.text));
      b.appendChild(box);
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (x) => x.close() }],
  });
  // 開く動きで高さが決まってから最下部へ (2フレーム待つ)
  const toEnd = () => { if (body) body.scrollTop = body.scrollHeight; };
  toEnd();
  requestAnimationFrame(() => { toEnd(); requestAnimationFrame(toEnd); });
  setTimeout(toEnd, 350);
  return h;
}

// ================= 手帳 (迷宮の一時停止シート) =================
const TOGGLES = [
  { key: "autoKeep", label: "オートを続ける", sub: "次の戦闘も。主・強敵で止まる" },
  { key: "chestAuto", label: "宝箱をすぐ開ける", sub: "最良の解除役が開ける" },
  { key: "autoCorpse", label: "死体をすぐ調べる", sub: "風化した死体だけ" },
  { key: "autoCloseResults", label: "戦果を自動で送る", sub: "1.6秒で次へ" },
];
// 戦闘中の手帳に並べる切り替え (倍速はセーブの G.fastAnim、ほかは端末の好み)
const COMBAT_TOGGLES = [
  { key: "fastAnim", label: "戦闘演出 倍速", sub: "切ると演出が 1/2 の速さに",
    get: () => { const g = G(); return !!(g && g.fastAnim); },
    set: (v) => { const g = G(); if (!g) return; g.fastAnim = v; if (game.autosave) game.autosave(); } },
  { key: "autoKeep", label: "オートを続ける", sub: "次の戦闘も。主・強敵で止まる" },
  { key: "autoCloseResults", label: "戦果を自動で送る", sub: "1.6秒で次へ" },
];
function toggleRow(t, after) {
  // t.get/t.set があれば端末の好み (getPref) ではなくそちらを読み書きする (倍速 = セーブの G.fastAnim)
  const get = t.get || (() => getPref(t.key)), put = t.set || ((v) => setPref(t.key, v));
  const on = !!get();
  const r = el("button", "dg-toggle" + (on ? " on" : ""));
  r.type = "button";
  r.setAttribute("role", "switch");
  r.setAttribute("aria-checked", on ? "true" : "false");
  const tx = el("span", "dg-toggle-t");
  tx.appendChild(el("span", "dg-toggle-l", t.label));
  tx.appendChild(el("span", "dg-toggle-s", t.sub));
  r.appendChild(tx);
  const sw = el("span", "dg-switch");
  sw.appendChild(el("i"));
  r.appendChild(sw);
  r.addEventListener("click", () => {
    const v = !get();
    put(v);
    r.classList.toggle("on", v);
    r.setAttribute("aria-checked", v ? "true" : "false");
    sfx("select");
    if (after) after();
  });
  return r;
}
// 手帳の札 (2列に並べる、64px の押せる板)
function menuTile(icon, title, sub, onTap, tone) {
  const b = el("button", "dg-mtile" + (tone ? " t-" + tone : "") + (onTap ? "" : " off"));
  b.type = "button";
  b.appendChild(dockIcon(icon, "dg-mtile-ic"));
  const t = el("span", "dg-mtile-t");
  t.appendChild(setText(el("span", "dg-mtile-l"), title));
  if (sub) t.appendChild(setText(el("span", "dg-mtile-s"), sub));
  b.appendChild(t);
  if (onTap) b.addEventListener("click", onTap);
  else b.disabled = true;
  return b;
}
export function openDungeonMenu() {
  const g = G();
  if (!g) return null;
  // 迷宮の外 (街) では設定を開く
  if (g.state !== "board" && g.state !== "combat") { if (UI.openSettings) UI.openSettings(); return null; }
  // 戦闘中も開ける: 閉じるまで戦闘は止まる (game.js combatHeld)。速さ・オートは変えられるが、
  // 帰還と隊の編成 (装備の付け替え) はできない
  const combat = g.state === "combat";
  if (combat) g._cmdStale = true;
  const f = floorFacts();
  const name = f.abyss ? "無限迷宮「奈落」" : (f.dn ? f.dn.name : "");
  const floors = f.abyss ? 0 : (f.dn && f.dn.floors) || 1;
  const r = g.run || {};
  let h = null;
  const go = (fn) => () => { if (h) h.close("go"); setTimeout(fn, 0); };
  h = sheet.open({
    kind: "info", banner: "手帳", className: "dg-sheet dg-menu",
    accent: f.theme ? f.theme.accent : null,
    body: (b) => {
      // 階の見出し (押すと階の情報)
      const head = el("button", "dg-floorhead tap");
      head.type = "button";
      head.appendChild(el("div", "dg-fh-name", name));
      const rr = el("div", "dg-fh-row");
      rr.appendChild(el("span", "dg-fh-depth", `B${g.floor}F`));
      rr.appendChild(pips(g.floor, floors, !f.abyss && f.dn && !!f.dn.boss));
      if (f.facts.length) rr.appendChild(el("span", "dg-fh-tag", `性質 ${f.facts.length}`));
      rr.appendChild(el("span", "dg-fh-more", "›"));
      head.appendChild(rr);
      if (f.obj) head.appendChild(el("div", "dg-fh-meta", f.obj.t));
      head.addEventListener("click", go(openFloorInfo));
      b.appendChild(head);
      const grid = el("div", "dg-mgrid");
      grid.appendChild(combat ? menuTile("party", "パーティを見る", "戦闘中は開けない", null)
        : menuTile("party", "パーティを見る", "装備・能力・道具", go(() => UI.openParty(0, { context: "dungeon" }))));
      grid.appendChild(menuTile("loot", "今回の収穫", `💰${r.gold || 0} ✦${r.soulPts || 0} 品${(r.items || []).length}`, go(openRunLoot)));
      grid.appendChild(menuTile("scroll", "記録を読む", "出来事の全文", go(openLog)));
      grid.appendChild(menuTile("book", "図鑑", "敵・品・見聞", go(() => UI.openCodexSheet && UI.openCodexSheet({ dungeonIdx: g.dungeonIdx }))));
      grid.appendChild(menuTile("gear", "設定", "音量・倍速・背景", go(() => UI.openSettings && UI.openSettings())));
      const canHome = !combat && (game.canReturnNow ? game.canReturnNow() : false);
      grid.appendChild(menuTile("home", canHome ? "街へ帰還する" : "帰還できない", canHome ? "戦利品を持ち帰る" : combat ? "戦闘中は帰れない" : "帰還陣か主の討伐で",
        canHome ? go(() => game.confirmReturnToTown && game.confirmReturnToTown()) : null, canHome ? "gold" : null));
      b.appendChild(grid);
      if (combat) b.appendChild(section("戦闘の速さ"));
      else b.appendChild(section("探索の手間を省く"));
      const tg = el("div", "dg-toggles grid");
      for (const t of combat ? COMBAT_TOGGLES : TOGGLES) tg.appendChild(toggleRow(t));
      b.appendChild(tg);
    },
    footer: [{ label: combat ? "戦闘に戻る" : "探索に戻る", kind: "primary", size: "lg", onTap: (s) => s.close() }],
  });
  return h;
}

// ================= 覗き見 (長押し) =================
const STAT_KEYS = [["atk", "ATK"], ["vit", "VIT"], ["agi", "AGI"], ["int", "INT"], ["pie", "PIE"], ["luk", "LUK"]];
const AIL = { poison: "毒", paralyze: "麻痺", stone: "石化" };
export function peekDoll(d, { idx = 0, combat = false } = {}) {
  if (!d) return null;
  return sheet.open({
    kind: "info", banner: combat ? "パーティの札" : "パーティの札 ― 覗き見", className: "dg-sheet dg-peek",
    body: (b) => {
      const top = el("div", "dg-peek-top");
      top.appendChild(portrait(d, { size: 64, hp: false }));
      const tx = el("div", "dg-peek-tx");
      tx.appendChild(el("div", "dg-peek-n", d.name + (d.alive ? "" : "  †")));
      tx.appendChild(el("div", "dg-peek-c", `${d.cls || ""}  Lv${d.jobLv || d.level || 1}`));
      const hp = el("div", "dg-peek-bar");
      hp.appendChild(el("span", "dg-peek-bl", "HP"));
      hp.appendChild(bar(d.hp, d.maxhp, { tone: "hp" }));
      hp.appendChild(el("span", "dg-peek-bv", `${d.hp}/${d.maxhp}`));
      tx.appendChild(hp);
      if (d.maxmp > 0) {
        const mp = el("div", "dg-peek-bar");
        mp.appendChild(el("span", "dg-peek-bl", "MP"));
        mp.appendChild(bar(d.mp, d.maxmp, { tone: "mp" }));
        mp.appendChild(el("span", "dg-peek-bv", `${d.mp}/${d.maxmp}`));
        tx.appendChild(mp);
      }
      top.appendChild(tx);
      b.appendChild(top);
      const chips = el("div", "dg-peek-chips");
      chips.appendChild(el("span", "dg-chip", idx < 3 ? "前衛" : "後衛"));
      const w = d.equip && d.equip.weapon;
      chips.appendChild(el("span", "dg-chip", w ? `${w.name}` : "素手"));
      if (d.ailment) chips.appendChild(el("span", "dg-chip bad", AIL[d.ailment] || d.ailment));
      if (d.asleep) chips.appendChild(el("span", "dg-chip bad", "眠り"));
      if (d.mind) chips.appendChild(el("span", "dg-chip bad", d.mind === "charm" ? "魅了" : "混乱"));
      for (const ef of (d.effects || [])) chips.appendChild(el("span", "dg-chip " + (ef.mult > 1 ? "up" : "bad"), `${BUFF_NAME[ef.stat] || (ef.stat || "").toUpperCase()}${ef.mult > 1 ? "▲" : "▼"} 残${ef.turns}`));
      b.appendChild(chips);
      const grid = el("div", "dg-stats");
      for (const [k, lb] of STAT_KEYS) {
        const c = el("div", "dg-stat");
        c.appendChild(el("span", "dg-stat-l", lb));
        c.appendChild(el("span", "dg-stat-v", String(d[k] != null ? d[k] : "—")));
        grid.appendChild(c);
      }
      b.appendChild(grid);
    },
    footer: combat ? [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }] : [
      { label: "パーティを見る", kind: "primary", onTap: (h) => { h.close("go"); setTimeout(() => UI.openParty(idx, { context: "dungeon" }), 0); } },
      { label: "閉じる", kind: "ghost", onTap: (h) => h.close() },
    ],
  });
}

// 敵の一枚: 討伐数・属性・残り体力・特徴とスキル (図鑑の記述)
// 姿は最初から見せ、ほかは倒した数に応じて段階的に明かす (MON_REVEAL / enemyReveal):
// 1体 = 名前 / 5体 = 属性とHP / 10体 = 特徴・スキルと説明文 (迷宮の主は名前が最初から、1体で全て)
export function peekEnemy(e) {
  if (!e) return null;
  const m = e.mon || MONSTERS[e.key] || {};
  const rv = enemyReveal(e);
  const { special, kills } = rv;
  const elem = rv.stats && e.element && ELEMENTS[e.element] && e.element !== "none" ? ELEMENTS[e.element] : null;
  let traits = [];
  if (rv.lore) { try { traits = monsterTraits(m) || []; } catch (er) { traits = []; } }
  return sheet.open({
    kind: "info", banner: e.boss ? "迷宮の主" : (m.elite ? "強敵" : "敵の姿"), className: "dg-sheet dg-enemy",
    accent: e.boss || m.elite ? "#d4504e" : (elem ? elem.color : null),
    art: m.art ? m : null, artScale: 4, float: isFloating(m, e.key),
    title: enemyLabel(e), titleColor: rv.name ? null : UNKNOWN_COLOR,
    body: (b) => {
      if (!special) b.appendChild(el("div", "dg-en-kills", `討伐数 ${kills}体`));
      if (!rv.name) b.appendChild(revealLock(rv.steps.name, "名前"));
      if (rv.stats) {
        // 名前の下は属性の印だけ (無属性なら出さない)
        const et = elem && tagRow(["el:" + e.element], "dg-en-elem");
        if (et) b.appendChild(et);
        const hp = el("div", "dg-peek-bar wide");
        hp.appendChild(el("span", "dg-peek-bl", "HP"));
        hp.appendChild(bar(e.hp, e.maxhp, { tone: "hp" }));
        hp.appendChild(el("span", "dg-peek-bv", `${Math.max(0, e.hp)}/${e.maxhp}`));
        b.appendChild(hp);
        const aff = affinityRow(e.element);
        if (aff) b.appendChild(aff);
      } else b.appendChild(revealLock(rv.steps.stats, "属性・HP"));
      if (!rv.lore) { b.appendChild(revealLock(rv.steps.lore, "特徴・スキル・説明文")); return; }
      if (traits.length) {
        b.appendChild(section("特徴・スキル"));
        const tl = el("div", "dg-traits");
        for (const t of traits) {
          const c = el("div", "dg-trait");
          const hd = el("div", "dg-trait-h");
          hd.appendChild(el("b", null, t.label));
          const tg = tagRow(traitTagKinds(t.key, e.element));
          if (tg) hd.appendChild(tg);
          c.appendChild(hd);
          c.appendChild(el("span", null, t.desc));
          tl.appendChild(c);
        }
        b.appendChild(tl);
      }
      if (m.desc) b.appendChild(el("div", "dg-en-desc", m.desc));
    },
    footer: [{ label: "閉じる", kind: "ghost", onTap: (h) => h.close() }],
  });
}

// ================= 墨の帳 (階の移り変わり) =================
// 約1.3秒 (知らせがあれば長め)。400ms を過ぎたらタップで飛ばせる。帳が下り切った瞬間に onSwap で盤面を替える。
// 入力は G.prompt で止め、終わり方 (時間切れ・タップ) に関わらず必ず一度だけ解く
export function floorTransition({ floor, tone = "", sub = "", color = null, lines = [], onSwap, onDone } = {}) {
  const g = G();
  if (g) g.prompt = true;
  const rm = reduced();
  const ov = el("div", "floor-trans" + (tone === "elite" ? " floor-trans-elite" : tone === "special" ? " floor-trans-special" : "") + (rm ? " rm" : ""));
  if (color) ov.style.setProperty("--ft-accent", color);
  ov.appendChild(el("div", "ft-floor", `B${floor}F`));
  const s = el("div", "ft-sub", sub);
  if (color) s.style.color = color;
  ov.appendChild(s);
  if (lines && lines.length) {
    const box = el("div", "ft-lines");
    // 不確定名の印 (unknownTag) は淡い藤色で (記録の欄と同じ setLogText)
    for (const ln of lines.slice(0, 3)) box.appendChild(setLogText(el("div", "ft-line"), ln));
    ov.appendChild(box);
  }
  const tap = el("div", "ft-tap", "タップで進む");
  ov.appendChild(tap);
  document.body.appendChild(ov);
  const IN = rm ? 80 : 280;
  const HOLD = rm ? 420 : (lines && lines.length ? 2100 : 1000);
  let swapped = false, done = false, canSkip = false;
  const swap = () => { if (swapped) return; swapped = true; try { if (onSwap) onSwap(); } catch (e) { setTimeout(() => { throw e; }); } };
  const finish = () => {
    if (done) return;
    done = true;
    swap();
    ov.classList.add("out");
    setTimeout(() => ov.remove(), rm ? 120 : 300);
    const gg = G();
    if (gg) gg.prompt = false;
    try { if (onDone) onDone(); } catch (e) { setTimeout(() => { throw e; }); }
  };
  setTimeout(swap, IN);
  setTimeout(() => { canSkip = true; ov.classList.add("skippable"); }, 400);
  setTimeout(finish, IN + HOLD);
  ov.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (canSkip) finish(); });
  // 保険: どんな時でも 6 秒後には必ず解く
  setTimeout(finish, 6000);
  return { finish };
}

export function install() {
  registerUI({ openDungeonMenu, openFloorInfo, openRunLoot, peekDoll, peekEnemy });
}
