// ===== 設定 — キットのシート (音量の目盛り・切り替え・自動化の好み・データ削除) =====
// 担当: WP-A。⚙ (タブの見出し・盤面のトップバー) から開く。戻る操作 / 背景タップ / 下へ引く で閉じる。
//   音      … サウンド ON/OFF・BGM と効果音の目盛り (指で引ける 0〜100)。端末の好み (dos-prefs)
//   戦闘    … 振動・戦闘の背景 (情景/漆黒)・移動の速さ 1〜3倍 (端末の好み PREFS.walkSpeed)・戦闘演出の倍速 (セーブの G.fastAnim)
//   自動化  … オート継続・オート移動と見えている敵・宝箱は最良の解除役で開ける・朽ちた死体を自動で調べる・戦果を自動で閉じる・帰還時に宿で休む・まとめて売るに道具を含める
//              UI の好み (prefs.js = dos-ui)。読むのは各パッケージ (WP-D の戦闘/盤面/帰還、街の宿)
//   テスト記録 … 戦闘バランス調整用の記録 (telemetry.js) の ON/OFF・要約の閲覧・書き出し (コピー)・消去
//   データ  … はじめから (全削除)。決断は二段で、どちらも「やめておく」に手が掛かる並び
// 提供: UI.openSettings() / UI.settingsSheet({onClose}) (game.js の openSettings が使う) / UI.confirmReset()
// game.js は import しない (ctx.js の UI / game を通す)。

import { UI, game, registerUI } from "./ctx.js";
import { el, setText, sheet, segmented, toast, button } from "./kit.js";
import { tlOn, tlSetOn, tlClear, tlHasData, tlSummary, tlStabilitySummary, tlExportText } from "../telemetry.js";
import { getPref, setPref, remember, autoMoveAvoid, setAutoMoveAvoid } from "./prefs.js";
import { SFX } from "../audio.js";

const sfx = (k) => { try { if (SFX[k]) SFX[k](); } catch (e) { /* noop */ } };

// 自動化の好み (prefs.js の既定値と同じ鍵)
const AUTO = [
  { key: "autoKeep", name: "オートを次の戦闘も続ける", desc: "主・強敵との戦い、仲間の深手 (HP3割未満)、タップで止まる" },
  { key: "chestAuto", name: "宝箱は最良の解除役で開ける", desc: "確かめずに、罠を外す力の最も高い者が開ける" },
  { key: "autoCorpse", name: "朽ちた死体は自動で調べる", desc: "危険の無い死体は、立ち止まらずに調べて進む" },
  { key: "autoCloseResults", name: "戦果を自動で閉じる", desc: "勝利の知らせを、しばらくして自動で閉じる" },
  { key: "autoRest", name: "帰還したら宿で休む", desc: "金貨が足りれば、帰るなり宿賃を払って全快する" },
  { key: "sellUse", name: "まとめて売るに道具を含める", desc: "薬草などの道具も、まとめて売る品に入れる" },
];

// 切り替えの1行 (行全体が押せる・role=switch)
function toggleRow({ name, desc, on, onChange }) {
  const r = el("button", "stg-row stg-toggle" + (on ? " on" : ""));
  r.type = "button";
  r.setAttribute("role", "switch");
  r.setAttribute("aria-checked", on ? "true" : "false");
  const t = el("span", "stg-row-t");
  t.appendChild(setText(el("span", "stg-row-n"), name));
  if (desc) t.appendChild(setText(el("span", "stg-row-d"), desc));
  r.appendChild(t);
  const sw = el("span", "stg-sw");
  sw.appendChild(el("i"));
  r.appendChild(sw);
  r.addEventListener("click", () => {
    const v = !r.classList.contains("on");
    r.classList.toggle("on", v);
    r.setAttribute("aria-checked", v ? "true" : "false");
    onChange(v);
  });
  return r;
}

// 目盛りの1行 (BGM / 効果音)。指で引くあいだ音量が追従し、離した時に保存する
function volumeRow(name, key) {
  const P = game.PREFS || {};
  const r = el("div", "stg-row stg-vol");
  const head = el("div", "stg-vol-h");
  head.appendChild(setText(el("span", "stg-row-n"), name));
  const val = el("span", "stg-vol-v");
  const show = (v) => { val.textContent = v <= 0 ? "切" : String(v); };
  head.appendChild(val);
  r.appendChild(head);
  const inp = document.createElement("input");
  inp.type = "range";
  inp.min = "0"; inp.max = "100"; inp.step = "5";
  inp.className = "stg-range";
  inp.setAttribute("aria-label", `${name} 音量`);
  const cur = Math.round(((P[key] != null ? P[key] : 1)) * 100);
  inp.value = String(cur);
  inp.style.setProperty("--v", cur + "%");
  show(cur);
  const apply = () => {
    const v = Number(inp.value) || 0;
    show(v);
    inp.style.setProperty("--v", v + "%");
    P[key] = v / 100;
    if (game.setVolumes) game.setVolumes(P.bgm, P.sfx);
  };
  inp.addEventListener("pointerdown", () => { if (game.ensureAudio) game.ensureAudio(); });
  inp.addEventListener("input", apply);
  inp.addEventListener("change", () => { apply(); if (game.savePrefs) game.savePrefs(); if (key === "sfx") sfx("select"); });
  r.appendChild(inp);
  return r;
}

function sec(title) {
  const h = el("div", "stg-h");
  h.appendChild(el("i", "wa-dia"));
  h.appendChild(setText(el("span"), title));
  h.appendChild(el("span", "wa-h-rule"));
  return h;
}

// 区分: 「音・戦闘」と「自動化・データ」(どちらも1画面に収まる。選んだ区分は覚える)
function fillSound(box) {
  const G = game.G || {};
  const P = game.PREFS || {};
  const muted = game.isMuted ? game.isMuted() : false;
  box.appendChild(sec("音"));
  box.appendChild(toggleRow({ name: "サウンド", desc: "効果音と BGM (M キーでも切り替え)", on: !muted, onChange: () => {
    if (game.ensureAudio) game.ensureAudio();
    const m = game.toggleMute ? game.toggleMute() : false;
    if (game.updateMuteBtn) game.updateMuteBtn(m);
  } }));
  box.appendChild(volumeRow("BGM", "bgm"));
  box.appendChild(volumeRow("効果音", "sfx"));

  box.appendChild(sec("戦闘・移動"));
  box.appendChild(toggleRow({ name: "振動", desc: "被弾・宝箱などで端末を震わせる (対応端末のみ)", on: !!P.vibrate, onChange: (v) => {
    P.vibrate = v; if (game.savePrefs) game.savePrefs(); sfx("select"); if (v && game.buzz) game.buzz([0, 30]);
  } }));
  const bgRow = el("div", "stg-row stg-segrow");
  const bgt = el("span", "stg-row-t");
  bgt.appendChild(setText(el("span", "stg-row-n"), "戦闘の背景"));
  bgt.appendChild(setText(el("span", "stg-row-d"), "層ごとの戦場 / 黒地に白枠 (原作風)"));
  bgRow.appendChild(bgt);
  bgRow.appendChild(segmented([{ key: "scene", label: "情景" }, { key: "classic", label: "漆黒" }], P.classicBattle ? "classic" : "scene", (k) => {
    P.classicBattle = k === "classic"; if (game.savePrefs) game.savePrefs(); sfx("select");
  }));
  box.appendChild(bgRow);
  const wkRow = el("div", "stg-row stg-segrow");
  const wkt = el("span", "stg-row-t");
  wkt.appendChild(setText(el("span", "stg-row-n"), "移動の速さ"));
  wkt.appendChild(setText(el("span", "stg-row-d"), "迷宮内の歩み・カードめくりの速さ"));
  wkRow.appendChild(wkt);
  wkRow.appendChild(segmented([{ key: "1", label: "1倍" }, { key: "2", label: "2倍" }, { key: "3", label: "3倍" }], String(P.walkSpeed || 2), (k) => {
    P.walkSpeed = Number(k); if (game.savePrefs) game.savePrefs(); sfx("select");
  }));
  box.appendChild(wkRow);
  box.appendChild(toggleRow({ name: "戦闘演出 倍速", desc: "戦闘のアニメーションを速める (切ると速さ 1/2)", on: !!G.fastAnim, onChange: (v) => {
    G.fastAnim = v; sfx("select"); if (game.autosave) game.autosave();
  } }));
}
function fillAuto(box) {
  box.appendChild(sec("自動化"));
  for (const a of AUTO) {
    box.appendChild(toggleRow({ name: a.name, desc: a.desc, on: !!getPref(a.key), onChange: (v) => { setPref(a.key, v); sfx("select"); } }));
  }
  // オート移動 (迷宮のドックの「オート」) で避けるもの: 一般の敵・強敵・出来事・宝箱をそれぞれ避ける/避けない
  const amRow = el("div", "stg-row stg-segrow stg-stack stg-am");
  const amt = el("span", "stg-row-t");
  amt.appendChild(setText(el("span", "stg-row-n"), "オート移動で避けるもの"));
  amt.appendChild(setText(el("span", "stg-row-d"), "どの設定でも、札をタップすれば寄り道できる"));
  amRow.appendChild(amt);
  const av = autoMoveAvoid();
  for (const [key, name] of [["foe", "一般の敵"], ["elite", "強敵"], ["event", "出来事"], ["chest", "宝箱"]]) {
    const line = el("div", "stg-am-l");
    line.appendChild(setText(el("span", "stg-am-n"), name));
    line.appendChild(segmented([{ key: "1", label: "避ける" }, { key: "0", label: "避けない" }], av[key] ? "1" : "0", (k) => {
      setAutoMoveAvoid(key, k === "1"); sfx("select"); if (game.renderDock) game.renderDock();
    }));
    amRow.appendChild(line);
  }
  box.appendChild(amRow);
  box.appendChild(sec("テスト記録"));
  const logRow = el("button", "stg-row stg-danger stg-log");
  logRow.type = "button";
  const lt = el("span", "stg-row-t");
  lt.appendChild(setText(el("span", "stg-row-n"), "記録を見る・書き出す"));
  logRow.appendChild(lt);
  logRow.appendChild(el("span", "stg-danger-b stg-log-b", "開く"));
  logRow.addEventListener("click", () => { sfx("select"); openTestLog(); });
  box.appendChild(toggleRow({ name: "テスト記録", desc: "戦闘・安定度・赤い魂の集計 (端末内のみ・送信しない)", on: tlOn(), onChange: (v) => {
    tlSetOn(v); sfx("select"); logRow.classList.toggle("hidden", !v && !tlHasData());
  } }));
  logRow.classList.toggle("hidden", !tlOn() && !tlHasData());
  box.appendChild(logRow);
  box.appendChild(sec("データ"));
  const reset = el("button", "stg-row stg-danger");
  reset.type = "button";
  const rt = el("span", "stg-row-t");
  rt.appendChild(setText(el("span", "stg-row-n"), "はじめから (全データ削除)"));
  rt.appendChild(setText(el("span", "stg-row-d"), "人業・魂・図鑑・進行度がすべて失われる"));
  reset.appendChild(rt);
  reset.appendChild(el("span", "stg-danger-b", "削除…"));
  reset.addEventListener("click", () => { sfx("select"); confirmReset(); });
  box.appendChild(reset);
}
function fill(root) {
  const guides = el("div", "jr-shortcuts");
  guides.append(button({ label:"ヘルプ", kind:"secondary", onTap:()=>UI.openHelp?.() }),
    button({ label:"ストーリー", kind:"secondary", onTap:()=>UI.openStoryArchive?.() }));
  root.appendChild(guides);
  const cur = remember("seg", "settings") === "auto" ? "auto" : "sound";
  const box = el("div", "stg");
  const draw = (k) => { box.textContent = ""; if (k === "auto") fillAuto(box); else fillSound(box); };
  const seg = segmented([{ key: "sound", label: "音・戦闘" }, { key: "auto", label: "自動化・データ" }], cur, (k) => { sfx("select"); draw(k); }, { prefKey: "settings" });
  seg.classList.add("stg-seg");
  root.appendChild(seg);
  draw(cur);
  root.appendChild(box);
}

// 設定のシートを開く (game.js の openSettings から。G.settingsOpen はそちらが持つ)
export function settingsSheet({ onClose } = {}) {
  const h = sheet.open({
    kind: "info", banner: "設定", className: "stg-sheet", body: fill,
    footer: [{ label: "閉じる", kind: "secondary", onTap: (s) => { sfx("select"); s.close(); } }],
    onClose,
  });
  if (h && h.update) {
    h.refresh = () => {
      const top = h.body ? h.body.scrollTop : 0;
      h.update({});
      if (h.body) h.body.scrollTop = top;
    };
  }
  return h;
}

// ---- テスト記録 (telemetry.js) ----
// 文字列をクリップボードへ。navigator.clipboard → 隠し textarea + execCommand の順に試す
function copyText(text) {
  const legacy = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => legacy());
  }
  return Promise.resolve(legacy());
}

// コピーできなかった時: 全文を選べる枠で見せる (長押し → すべて選択 → コピー)
function showExportText(text) {
  sheet.open({
    kind: "info", banner: "テスト記録", title: "この文字をすべて選んでコピーしてください", className: "stg-sheet stg-log-sheet",
    body: (root) => {
      const ta = document.createElement("textarea");
      ta.className = "stg-log-ta";
      ta.readOnly = true;
      ta.value = text;
      root.appendChild(ta);
      setTimeout(() => { try { ta.focus(); ta.select(); } catch (e) { /* noop */ } }, 50);
    },
    footer: [{ label: "閉じる", kind: "secondary", onTap: (s) => { sfx("select"); s.close(); } }],
  });
}

function openTestLog() {
  const sum = tlSummary();
  const stability = tlStabilitySummary();
  if (stability.length) sum.unshift({ head:stability[0], lines:stability.slice(1) });
  sheet.open({
    kind: "info", banner: "テスト記録", className: "stg-sheet stg-log-sheet",
    title: tlOn() ? "記録中" : "記録は止まっている",
    body: (root) => {
      if (!sum.length) { root.appendChild(setText(el("p", "stg-log-empty"), "まだ記録がない。迷宮に潜ると、階ごと・戦闘ごとに集まっていく。")); return; }
      for (const d of sum) {
        const b = el("div", "stg-log-d");
        b.appendChild(setText(el("div", "stg-log-h"), d.head));
        for (const l of d.lines) b.appendChild(setText(el("div", "stg-log-l"), l));
        root.appendChild(b);
      }
    },
    footer: [
      { label: "書き出す (コピー)", kind: "primary", onTap: () => {
        sfx("select");
        const text = tlExportText();
        copyText(text).then((ok) => {
          if (ok) toast("テスト記録をコピーした ― そのまま貼り付けて送れる", { tone: "good" });
          else showExportText(text);
        });
      } },
      { label: "記録を消す", kind: "secondary", onTap: (s) => {
        sfx("select");
        dangerConfirm({ banner: "テスト記録", title: "テスト記録を消しますか？", lines: ["集計した能力値と戦闘の記録がすべて消える。", "(セーブデータには影響しない)"], okLabel: "消す" })
          .then((ok) => { if (ok) { tlClear(); s.close(); toast("テスト記録を消した", { tone: "info" }); } });
      } },
      { label: "閉じる", kind: "secondary", onTap: (s) => { sfx("select"); s.close(); } },
    ],
  });
}

// 取り消しが既定の決断 (「やめておく」が先頭でフォーカスを持つ)。Promise<boolean>
function dangerConfirm({ banner, title, lines = [], okLabel }) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v, h) => { if (done) return; done = true; if (h) h.close(v ? "ok" : "cancel", { silent: true }); resolve(v); };
    const h = sheet.open({
      kind: "choice", banner, accent: "#c43a2f", title, lines, className: "ui-confirm stg-confirm",
      footer: [
        { label: "やめておく", kind: "secondary", size: "lg", onTap: (s) => fin(false, s) },
        { label: okLabel, kind: "danger", onTap: (s) => fin(true, s) },
      ],
      onBack: (s) => fin(false, s), onBackdrop: (s) => fin(false, s), onClose: () => fin(false, null),
    });
    if (!h || !h.el) resolve(false);
  });
}

export function confirmReset() {
  dangerConfirm({ banner: "警告", title: "全データを削除して、最初から始めますか？", lines: ["人業・魂・図鑑・進行度がすべて失われる。"], okLabel: "削除へ進む" })
    .then((ok) => {
      if (!ok) return;
      return dangerConfirm({ banner: "最終確認", title: "本当に、すべてを消しますか？", lines: ["消した記録は二度と戻らない。", "(音量などの端末の好みは残る)"], okLabel: "すべて削除して はじめから" })
        .then((ok2) => { if (ok2 && game.resetAllData) game.resetAllData(); });
    });
}

export function install() {
  registerUI({
    openSettings: () => { if (game.openSettings) game.openSettings(); },
    settingsSheet,
    confirmReset,
  });
}
