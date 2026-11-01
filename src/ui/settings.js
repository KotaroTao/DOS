import { showSaveMetrics } from "../save-metrics.js";
// ===== 設定 — キットのシート (音量の目盛り・切り替え・自動化の好み・データ削除) =====
// 担当: WP-A。⚙ (タブの見出し・盤面のトップバー) から開く。戻る操作 / 背景タップ / 下へ引く で閉じる。
//   音      … サウンド ON/OFF・BGM と効果音の目盛り (指で引ける 0〜100)。端末の好み (dos-prefs)
//   戦闘    … 振動・戦闘の背景 (情景/漆黒)・戦闘演出の倍速 (セーブの G.fastAnim)
//   装い    … 迷宮を歩く操霊師の外套・縁取りの色 (端末の好み PREFS.walkerLook。game.setWalkerLook で盤面の駒も塗り直す)
//   自動化  … オート継続・オート移動と見えている敵・宝箱は最良の解除役で開ける・朽ちた死体を自動で調べる・戦果を自動で閉じる・帰還時に宿で休む・まとめて売るに道具を含める
//              UI の好み (prefs.js = dos-ui)。読むのは各パッケージ (WP-D の戦闘/盤面/帰還、街の宿)
//   データ  … 保存してタイトルへ / 選んだ記録だけを削除してはじめから。決断は二段で、どちらも「やめておく」に手が掛かる並び
// 提供: UI.openSettings() / UI.settingsSheet({onClose}) (game.js の openSettings が使う) / UI.confirmReset()
// game.js は import しない (ctx.js の UI / game を通す)。

import { playerNameCard } from "./playername.js";
import { UI, game, registerUI } from "./ctx.js";
import { isDesktopLayout } from "../desktop.js";
import { el, button, setText, sheet, segmented, toast } from "./kit.js";
import { getPref, setPref, remember, autoMoveAvoid, setAutoMoveAvoid } from "./prefs.js";
import { SFX, audioDebug } from "../audio.js";
import { normalizeLook, WALKER_CLOAKS, WALKER_TRIMS } from "../walkerart.js";
import { cryptWalkerBitmap, prewarmCryptActors } from "../cryptactors.js";
import { cloudEnabled, cloudAccount, cloudGuest, cloudManageAccount } from "../cloud-save.js";

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

// 区分: 「音・戦闘」「装い」「自動化・データ」(どれも1画面に収まる。選んだ区分は覚える)
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
  const status = el("p", "stg-row-d");
  status.setAttribute("role", "status");
  const describe = () => {
    const d = audioDebug();
    setText(status, d.error ? "音声を起動できませんでした。再起動を試してください。"
      : d.muted ? "サウンドは切になっています。"
      : !d.ready ? "音声はまだ起動していません。"
      : d.state !== "running" ? "音声が停止しています。再起動を試してください。"
      : "音声の再生処理は動作中です。聞こえない場合は再起動を試してください。");
  };
  describe();
  box.appendChild(status);
  box.appendChild(button({ label: "音声を再起動", kind: "secondary", onTap: () => {
    game.restartGameAudio?.();
    describe();
    setTimeout(() => { if (status.isConnected) { sfx("select"); describe(); } }, 500);
  } }));
  box.appendChild(button({ label: "音声の診断情報を表示", kind: "ghost", onTap: () => {
    const info = { ...audioDebug(), browser: navigator.userAgent,
      standalone: !!navigator.standalone || !!window.matchMedia?.("(display-mode: standalone)").matches };
    sheet.open({ title: "音声の診断情報", lines: ["音が出ない時は、この情報をお知らせください。"], body: body => {
      const text = el("textarea", "stg-audio-info");
      text.readOnly = true; text.rows = 12; text.style.width = "100%";
      text.setAttribute("aria-label", "音声の診断情報");
      text.value = JSON.stringify(info, null, 2);
      body.appendChild(text);
    }, footer: [{ label: "閉じる", onTap: h => h.close() }] });
  } }));

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
  box.appendChild(toggleRow({ name: "強化・弱体の演出", desc: "技・パッシブ・迷宮の掟で強化・弱体が掛かった時に光と文字を出し、その時に札を出す (切ると戦闘のテンポが上がる)", on: P.buffFx !== false, onChange: (v) => {
    P.buffFx = v; if (game.savePrefs) game.savePrefs(); sfx("select");
  } }));
  box.appendChild(toggleRow({ name: "戦闘演出 倍速", desc: "戦闘のアニメーションを速める", on: !!G.fastAnim, onChange: (v) => {
    G.fastAnim = v; sfx("select"); if (game.autosave) game.autosave();
  } }));
}
// 区分「装い」: 迷宮を歩く操霊師の色。4方向の見本と、外套・縁取りの色見本 (押すとすぐ変わる)
function fillLook(box) {
  const P = game.PREFS || {};
  box.appendChild(sec("操霊師の装い"));
  const prev = el("div", "stg-wk-prev");
  box.appendChild(prev);
  const rows = [];
  const draw = () => {
    const look = normalizeLook(P.walkerLook);
    prev.textContent = "";
    for (const d of ["down", "left", "up", "right"]) {
      const frame = cryptWalkerBitmap(d, look);
      if (!frame) continue;
      const c = document.createElement("canvas");
      c.width = frame.w; c.height = frame.h;
      c.style.cssText = "width:calc((100% - 42px)/4);height:auto;image-rendering:auto";
      c.getContext("2d").drawImage(frame.c, 0, 0);
      c.setAttribute("aria-label", {down:"正面",left:"左向き",up:"背面",right:"右向き"}[d]);
      prev.appendChild(c);
    }
    for (const r of rows) r.sync(look);
  };
  const pickRow = (name, desc, list, key) => {
    const row = el("div", "stg-row stg-segrow stg-stack");
    const t = el("span", "stg-row-t");
    t.appendChild(setText(el("span", "stg-row-n"), name));
    t.appendChild(setText(el("span", "stg-row-d"), desc));
    row.appendChild(t);
    const sw = el("div", "stg-wk-sw");
    const btns = list.map((o) => {
      const b = el("button", "stg-wk-b");
      b.type = "button";
      const chip = el("span", "stg-wk-chip");
      chip.style.background = `linear-gradient(135deg, ${o.ramp[0]} 0%, ${o.ramp[1]} 45%, ${o.ramp[4]} 100%)`;
      b.appendChild(chip);
      b.appendChild(setText(el("span", "stg-wk-n"), o.name));
      b.addEventListener("click", () => {
        const look = { ...normalizeLook(P.walkerLook), [key]: o.key };
        if (game.setWalkerLook) game.setWalkerLook(look); else P.walkerLook = look;
        sfx("select"); draw();
      });
      sw.appendChild(b);
      return [o.key, b];
    });
    row.appendChild(sw);
    box.appendChild(row);
    rows.push({ sync: (look) => { for (const [k, b] of btns) { const on = look[key] === k; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } } });
  };
  pickRow("外套", "迷宮を歩く姿の外套の色", WALKER_CLOAKS, "cloak");
  pickRow("縁取り", "外套の刺繍と、頭巾の奥の目の光", WALKER_TRIMS, "trim");
  draw();
  prewarmCryptActors().then(() => { if (prev.isConnected) draw(); });
}
function fillAuto(box) {
  box.appendChild(sec("自動化"));
  for (const a of AUTO) {
    box.appendChild(toggleRow({ name: a.name, desc: a.desc, on: !!getPref(a.key), onChange: (v) => { setPref(a.key, v); sfx("select"); } }));
  }
  // オート移動 (迷宮のドックの「オート」) で避けるもの: 一般の敵・強敵・出来事・宝箱 (死体も) をそれぞれ避ける/避けない
  const amRow = el("div", "stg-row stg-segrow stg-stack stg-am");
  const amt = el("span", "stg-row-t");
  amt.appendChild(setText(el("span", "stg-row-n"), "オート移動で避けるもの"));
  amt.appendChild(setText(el("span", "stg-row-d"), "どの設定でも、札をタップすれば寄り道できる"));
  amRow.appendChild(amt);
  const av = autoMoveAvoid();
  for (const [key, name] of [["foe", "一般の敵"], ["elite", "強敵"], ["event", "出来事"], ["chest", "宝箱・死体"]]) {
    const line = el("div", "stg-am-l");
    line.appendChild(setText(el("span", "stg-am-n"), name));
    line.appendChild(segmented([{ key: "1", label: "避ける" }, { key: "0", label: "避けない" }], av[key] ? "1" : "0", (k) => {
      setAutoMoveAvoid(key, k === "1"); sfx("select"); if (game.renderDock) game.renderDock();
    }));
    amRow.appendChild(line);
  }
  box.appendChild(amRow);
  box.appendChild(sec("データ"));
  const title = el("button", "stg-row");
  title.type = "button";
  title.setAttribute("aria-label", "記録を保存してタイトルへ");
  title.appendChild(setText(el("span", "stg-row-n"), "記録を保存してタイトルへ"));
  title.appendChild(setText(el("span", "stg-row-d"), "冒険の記録を保存してタイトルへ戻る"));
  title.addEventListener("click", () => game.returnToTitle?.());
  box.appendChild(title);
  const reset = el("button", "stg-row stg-danger");
  reset.type = "button";
  const rt = el("span", "stg-row-t");
  rt.appendChild(setText(el("span", "stg-row-n"), "この記録を削除して はじめから"));
  rt.appendChild(setText(el("span", "stg-row-d"), "人業・魂・図鑑・進行度がすべて失われる"));
  reset.appendChild(rt);
  reset.appendChild(el("span", "stg-danger-b", "削除…"));
  reset.addEventListener("click", () => { sfx("select"); confirmReset(); });
  if (cloudEnabled()) {
    const account = el("button", "stg-row stg-cloud-account"); account.type = "button";
    account.appendChild(setText(el("span", "stg-row-n"), cloudAccount()));
    account.appendChild(setText(el("span", "stg-row-d"), cloudGuest() ? "アカウント登録・記録の引き継ぎ" : "アカウント管理・ログアウト・退会"));
    account.addEventListener("click", () => cloudManageAccount());
    box.appendChild(account);
  } else box.appendChild(reset);
  const metrics = el("button", "stg-row"); metrics.type = "button";
  metrics.appendChild(setText(el("span", "stg-row-n"), "保存と通信の計測"));
  metrics.appendChild(setText(el("span", "stg-row-d"), "この端末の計測結果を確認・書き出す"));
  metrics.addEventListener("click", showSaveMetrics); box.appendChild(metrics);
  if (cloudEnabled()) {
    const trial = el("a", "stg-row"); trial.href = "choice-trial.html"; trial.target = "_blank"; trial.rel = "noopener";
    trial.appendChild(setText(el("span", "stg-row-n"), "B方式の通信・戦闘試遊"));
    trial.appendChild(setText(el("span", "stg-row-d"), "別画面で計測する・本編の進行に影響なし"));
    box.appendChild(trial);
  }
}
function fill(root) {
  if (isDesktopLayout()) return fillDesktop(root);
  root.appendChild(playerNameCard());
  const saved = remember("seg", "settings");
  const cur = saved === "auto" || saved === "look" ? saved : "sound";
  const box = el("div", "stg");
  const draw = (k) => { box.textContent = ""; if (k === "auto") fillAuto(box); else if (k === "look") fillLook(box); else fillSound(box); };
  const seg = segmented([{ key: "sound", label: "音・戦闘" }, { key: "look", label: "装い" }, { key: "auto", label: "自動化・データ" }], cur, (k) => { sfx("select"); draw(k); }, { prefKey: "settings" });
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
  dangerConfirm({ banner: "警告", title: "この冒険の記録を削除して、最初から始めますか？", lines: ["人業・魂・図鑑・進行度がすべて失われる。"], okLabel: "削除へ進む" })
    .then((ok) => {
      if (!ok) return;
      return dangerConfirm({ banner: "最終確認", title: "本当に、この記録を消しますか？", lines: ["消した記録は二度と戻らない。", "ほかの冒険の記録と、音量などの端末の好みは残る"], okLabel: "この記録を削除して はじめから" })
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

function fillDesktop(root) {
  const workspace=el("div","pc-settings"),nav=el("nav","pc-settings-nav"),body=el("div","pc-settings-body");
  nav.setAttribute("aria-label","設定の分類");
  let current=remember("seg","settings");if(!["sound","look","auto"].includes(current))current="sound";
  const buttons=[];
  const draw=k=>{
    current=k;remember("seg","settings",k);body.replaceChildren(playerNameCard());
    const box=el("div","stg");
    if(k==="look")fillLook(box);else if(k==="auto")fillAuto(box);else fillSound(box);
    body.appendChild(box);buttons.forEach(([key,b])=>b.setAttribute("aria-pressed",String(key===k)));
  };
  for(const [key,label] of [["sound","音・戦闘"],["look","装い"],["auto","自動化・データ"]]) {
    const b=button({label,kind:"secondary",onTap:()=>draw(key)});buttons.push([key,b]);nav.appendChild(b);
  }
  nav.appendChild(el("p","pc-muted","音の切り替え: M　閉じる: Esc"));
  workspace.append(nav,body);root.appendChild(workspace);draw(current);
}
