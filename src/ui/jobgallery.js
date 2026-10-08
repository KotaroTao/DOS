// テストプレイ: 全職業 × 全ランクのキャラの絵と顔アイコンを並べて見る (絵の差し替え・顔の切り出しの確認用)
//
// タイトルの「テストプレイ」→「キャラ画像」から開く。ゲームの状態には触れない (セーブも読まない)。
// 表示は2通り:
//   全身と顔 — 職ごとに R1〜R5 の全身像 (隊の大きな肖像と同じ jobSprite) と、その顔アイコン (jobBust) を3つの大きさで
//   顔の比較 — 顔アイコンだけを 職 × ランク の表にして、頭の大きさ・位置が揃っているかを見比べる
// showJobGallery({ onClose }) → { close }
import { SOUL_CLASSES, jobSprite, jobBust, jobRankName } from "../souls.js";
import { crispCanvas } from "../sprites.js";
import { JOB_IMAGES } from "../jobart.js";
import { JOB_PHOTOS } from "../jobphotos.js";

const RANKS = [1, 2, 3, 4, 5];
const RARITY = [["all", "すべて"], ["common", "コモン"], ["rare", "レア"], ["epic", "エピック"], ["legend", "レジェンド"]];
const RARITY_NAME = Object.fromEntries(RARITY);
const FACE_SIZES = [56, 36, 26]; // 隊の肖像・魂の珠・小さな札くらいの大きさ

function div(cls, text) {
  const e = document.createElement("div");
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function btn(cls, text) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  return b;
}

// 絵の出どころ (jobSprite の選び方と同じ順): そのランクのドット絵 → 原画 → 近いランクのドット絵 → 仮の小さな絵
function nearest(set, r) {
  return Object.keys(set).map(Number).sort((a, b) => Math.abs(a - r) - Math.abs(b - r) || b - a)[0];
}
function artSource(k, r) {
  if (JOB_IMAGES[k] && JOB_IMAGES[k][r]) return { label: "ドット絵", cls: "dot" };
  if (JOB_PHOTOS[k]) {
    if (JOB_PHOTOS[k][r]) return { label: "原画", cls: "photo" };
    return { label: `原画（R${nearest(JOB_PHOTOS[k], r)}を借用）`, cls: "borrow" };
  }
  if (JOB_IMAGES[k]) return { label: `ドット絵（R${nearest(JOB_IMAGES[k], r)}を借用）`, cls: "borrow" };
  return { label: "仮の小さな絵", cls: "none" };
}

function faceFrame(k, r, size) {
  const f = div("jg-face");
  f.style.setProperty("--jg-size", size + "px");
  f.style.setProperty("--glow", SOUL_CLASSES[k].glow);
  try { f.appendChild(crispCanvas(jobBust(k, r), size - 2)); } catch (e) { f.textContent = "×"; }
  return f;
}

function jobCard(k) {
  const c = SOUL_CLASSES[k];
  const card = div("jg-job");
  card.style.setProperty("--glow", c.glow);
  const head = div("jg-job-h");
  head.append(div("jg-job-n", c.label), div("jg-job-k", `${k}・${RARITY_NAME[c.rarity] || c.rarity}`));
  card.appendChild(head);
  const row = div("jg-ranks");
  for (const r of RANKS) {
    const cell = div("jg-rank");
    const src = artSource(k, r);
    cell.appendChild(div("jg-rank-h", `R${r} ${jobRankName(k, r)}`));
    const full = div("jg-full");
    try { full.appendChild(crispCanvas(jobSprite(k, r), 96)); } catch (e) { full.textContent = "×"; }
    cell.appendChild(full);
    const faces = div("jg-faces");
    for (const s of FACE_SIZES) faces.appendChild(faceFrame(k, r, s));
    cell.appendChild(faces);
    cell.appendChild(div("jg-src " + src.cls, src.label));
    row.appendChild(cell);
  }
  card.appendChild(row);
  return card;
}

function faceTable(keys) {
  const t = div("jg-table");
  const hr = div("jg-tr jg-th");
  hr.appendChild(div("jg-tn", "職業"));
  for (const r of RANKS) hr.appendChild(div("jg-tc", `R${r}`));
  t.appendChild(hr);
  for (const k of keys) {
    const tr = div("jg-tr");
    tr.style.setProperty("--glow", SOUL_CLASSES[k].glow);
    tr.appendChild(div("jg-tn", SOUL_CLASSES[k].label));
    for (const r of RANKS) {
      const td = div("jg-tc");
      td.title = `${jobRankName(k, r)}・${artSource(k, r).label}`;
      td.appendChild(faceFrame(k, r, 48));
      tr.appendChild(td);
    }
    t.appendChild(tr);
  }
  return t;
}

export function showJobGallery({ onClose = null } = {}) {
  const wrap = div("jg-overlay");
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", "職業の絵と顔アイコンの一覧");
  const bar = div("jg-bar");
  const title = div("jg-title", "職業の絵・顔アイコン");
  const closeBtn = btn("jg-close", "戻る");
  bar.append(title, closeBtn);
  const tools = div("jg-tools");
  const mkSeg = (opts, cur, onPick) => {
    const seg = div("jg-seg");
    for (const [v, label] of opts) {
      const b = btn("jg-chip" + (v === cur ? " on" : ""), label);
      b.addEventListener("click", () => {
        for (const x of seg.children) x.classList.toggle("on", x === b);
        onPick(v);
      });
      seg.appendChild(b);
    }
    return seg;
  };
  let view = "full", rarity = "all";
  tools.append(
    mkSeg([["full", "全身と顔"], ["face", "顔の比較"]], view, (v) => { view = v; render(); }),
    mkSeg(RARITY, rarity, (v) => { rarity = v; render(); }),
  );
  const note = div("jg-note");
  const body = div("jg-body");
  wrap.append(bar, tools, note, body);

  let token = 0;
  const render = () => {
    const my = ++token;
    body.replaceChildren();
    body.scrollTop = 0;
    const keys = Object.keys(SOUL_CLASSES).filter((k) => rarity === "all" || SOUL_CLASSES[k].rarity === rarity);
    note.textContent = view === "full"
      ? `${keys.length}職 × 5ランク。顔アイコンは 56・36・26px。枠の下は絵の出どころ。`
      : `${keys.length}職 × 5ランクの顔アイコン (48px)。頭の大きさと位置が揃っているかを見比べる。`;
    if (view === "face") { body.appendChild(faceTable(keys)); return; }
    // 職ごとに少しずつ描いて、開いた瞬間に固まらないようにする
    let i = 0;
    const step = () => {
      if (my !== token || closed) return;
      const end = Math.min(keys.length, i + 4);
      for (; i < end; i++) body.appendChild(jobCard(keys[i]));
      if (i < keys.length) requestAnimationFrame(step);
    };
    step();
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    if (onClose) onClose();
  };
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  wrap.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(wrap);
  render();
  try { closeBtn.focus({ preventScroll: true }); } catch {}
  return { close };
}
