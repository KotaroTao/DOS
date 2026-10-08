// 解放済みの手引きと、体験済みの物語を読む。閲覧では報酬・進行を変更しない (既読の印だけを付ける)。
// 新しく物語が記されたら、街で手の空いた時に知らせる (queueStoryNotice)。迷宮の中・語りや手ほどきの最中は待つ。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, segmented, badge, uiBlocked } from "./kit.js";
import { sceneActive } from "./irene.js";
import { helpEntries, storyEntries, journalState, unreadStories, newStories, markStoryRead, markStoriesKnown } from "../journal.js";
import { archiveArt } from "../archive-art.js";
import { storyArt } from "../storyart.js";
import { vignetteCanvas } from "../townart.js";

const entries = kind => kind === "help"
  ? helpEntries(game.G || {}, key => !!game.featureUnlocked?.(key))
  : storyEntries(game.G || {});

function illustration(entry) {
  const box = el("div", "jr-illustration");
  if (entry.image) {
    const img = document.createElement("img");
    img.src = new URL("../../" + entry.image, import.meta.url).href;
    img.alt = entry.imageAlt || "迷宮の入口に立つ門衛";
    img.width = entry.imageWidth || 1852; img.height = entry.imageHeight || 849;
    box.appendChild(img);
  } else if (entry.illustration) {
    const art = archiveArt(entry.illustration);
    if (art) { art.setAttribute("aria-label", entry.title + "の場面"); box.appendChild(art); }
  } else {
    const art = entry.art ? storyArt(entry.art) : vignetteCanvas(entry.place || "palace");
    if (art) { art.setAttribute("aria-hidden", "true"); box.appendChild(art); }
  }
  return box;
}
function linesOf(entry) {
  if (typeof entry.lines !== "function") return entry.lines || [];
  const w = game.G?.world || {};
  return entry.lines({
    open:id=>!!w.open?.[id], found:id=>!!w.found?.[id],
    cleared:id=>!!w.cleared?.[id], reported:id=>!!w.reported?.[id],
  }) || [];
}
let redrawIndex = null; // 開いている一覧の描き直し (既読の印を消す)
function openEntry(kind, id, handle = null) {
  // 一覧を開いたあとも、実際の進行で閲覧できるものだけを開く。
  const list = entries(kind);
  const entry = list.find(e=>e.id===id);
  if (!entry) return;
  if (kind === "story" && game.G && !journalState(game.G).read[id]) {
    markStoryRead(game.G, id);
    if (game.autosave) game.autosave();
    if (redrawIndex) redrawIndex();
  }
  // 物語と踏破した迷宮は、それぞれの一覧の順番で読む
  const stories = list.filter(e=>e.id.startsWith("lore_") === id.startsWith("lore_"));
  const index = stories.findIndex(e=>e.id===id);
  const next = stories[index + 1], prev = stories[index - 1];
  const footer = [];
  if (kind === "story") {
    footer.push(
      {label:"次の物語",kind:"secondary",disabled:!next,onTap:h=>{ if(next)openEntry(kind,next.id,h); }},
      {label:"前の物語",kind:"secondary",disabled:!prev,onTap:h=>{ if(prev)openEntry(kind,prev.id,h); }},
    );
  }
  footer.push({label:"一覧に戻る",kind:"secondary",onTap:h=>h.close()});
  const opts = {
    kind:"info", banner:kind==="help"?"ヘルプ":"ストーリー", title:entry.title,
    className:"jr-sheet jr-detail", accent:kind==="help"?"#78bdd1":"#d9b76e",
    body:b=>{
      b.appendChild(illustration(entry));
      if(entry.subtitle)b.appendChild(el("div","jr-subtitle",entry.subtitle));
      for(const line of linesOf(entry))b.appendChild(el("p","jr-line",line));
    },
    footer,
    // 知らせから読んだ時など、一覧を経ずに閉じたら街の未読の数を付け直す
    onClose:()=>{ if (!redrawIndex && game.G?.state === "town" && game.renderTown) game.renderTown(); },
  };
  if (handle) {
    handle.update(opts);
    handle.body.scrollTop = 0;
  } else sheet.open(opts);
}
export function openJournal(kind = "help") {
  const isHelp = kind === "help";
  const list = entries(kind);
  sheet.open({
    kind:"info", banner:isHelp?"ヘルプ":"ストーリー", className:"jr-sheet jr-index",
    accent:isHelp?"#78bdd1":"#d9b76e",
    body:b=>{
      b.appendChild(el("p","jr-intro",isHelp
        ? "いま使える機能の手引きです。機能が解放されると、読める項目が増えます。"
        : "旅の歩みに合わせて読める物語です。「踏破した迷宮」では、その場所の由来と秘密を読めます。"));
      let activeTab = "story";
      const unread = isHelp ? {} : journalState(game.G || {}).read;
      const isNew = e => !isHelp && !unread[e.id];
      const segBox = el("div", "jr-segbox");
      const search = document.createElement("input");
      search.type="search"; search.className="jr-search";
      search.placeholder=isHelp?"ヘルプを探す":"物語を探す";
      search.setAttribute("aria-label",search.placeholder);
      if (isHelp) b.appendChild(search);
      else b.appendChild(segBox);
      // 区分の札に、まだ読んでいない数を添える (読むたびに描き直す)
      const drawSeg = () => {
        const cnt = lore => list.filter(e => isNew(e) && e.id.startsWith("lore_") === lore).length;
        segBox.replaceChildren(segmented([
          { key:"story", label:"ストーリー", badge:cnt(false) || null },
          { key:"dungeons", label:"踏破した迷宮", badge:cnt(true) || null },
        ], activeTab, key => { activeTab = key; draw(); }));
      };
      const results=el("div","jr-results");b.appendChild(results);
      const draw=()=>{
        results.replaceChildren();
        if (!isHelp) drawSeg();
        const query=isHelp ? search.value.trim() : "";
        const shown=list.filter(e=>isHelp
          ? !query||`${e.title} ${e.subtitle||""} ${e.group||""}`.includes(query)
          : (e.id.startsWith("lore_") ? activeTab === "dungeons" : activeTab === "story"));
        if(!shown.length){results.appendChild(el("p","jr-empty",(!isHelp && activeTab === "dungeons")?"まだ踏破した迷宮がありません。":list.length?"該当する記録がありません。":"まだ読める記録がありません。旅を進めると、ここに記録が増えていきます。"));return;}
        let group=null;
        for(const entry of shown){
          const next=entry.group || "解放済みの機能";
          if(next!==group){group=next;results.appendChild(el("h3","jr-group",group));}
          const card=button({label:entry.title,kind:"secondary",onTap:()=>openEntry(kind,entry.id)});
          card.classList.add("jr-card");
          if(entry.subtitle)card.appendChild(el("span","jr-card-sub",entry.subtitle));
          if(isNew(entry)){card.classList.add("is-new");card.appendChild(el("span","jr-new","未読"));}
          results.appendChild(card);
        }
      };
      search.addEventListener("input",draw);draw();
      if (!isHelp) redrawIndex = draw;
    },
    footer:[{label:"閉じる",kind:"secondary",onTap:h=>h.close()}],
    onClose:()=>{
      if (isHelp) return;
      redrawIndex = null;
      // 街の「ストーリー」の未読の数を付け直す
      if (game.G?.state === "town" && game.renderTown) game.renderTown();
    },
  });
}

// ---- 未読の数 (街・設定の「ストーリー」に添える) ----
export function storyUnread() { return game.G ? unreadStories(game.G).length : 0; }
export function storyButton() {
  const b = button({ label:"ストーリー", kind:"secondary", onTap:()=>openJournal("story") });
  const n = storyUnread();
  if (n) { b.appendChild(badge(n)); b.setAttribute("aria-label", `ストーリー (未読 ${n})`); }
  return b;
}

// ---- 「物語が記された」の知らせ ----
// 最初の出撃から戻るまでは出さない (序章の手ほどきを邪魔しない。それまでの物語は戻った後にまとめて知らせる)。
let noticeTimer = null, noticeTries = 0;
function noticeBusy(G) {
  // 手ほどきが待っている間は、その手ほどきの操作しか通らない (知らせを閉じられなくなる)
  if (uiBlocked() || sceneActive() || UI.tutorialActive?.() || UI.tutorialPending?.()) return true;
  if (typeof document !== "undefined" && document.querySelector(".sc-scene")) return true;
  // 館の語りが待っている: 語りが先 (語りを聞けば、その物語も記される)
  if (G.town?.tab === "party" && game.pendingIreneBeat?.()) return true;
  return false;
}
export function queueStoryNotice() {
  if (noticeTimer) return;
  noticeTries = 0;
  const tick = () => {
    noticeTimer = null;
    const G = game.G;
    if (!G || G.state !== "town" || G.testPlay || (G.stats?.runs || 0) < 1) return;
    if (!newStories(G).length) return;
    if (noticeBusy(G)) { if (++noticeTries < 40) noticeTimer = setTimeout(tick, 1500); return; }
    showStoryNotice(G);
  };
  noticeTimer = setTimeout(tick, 700);
}
const firstSentence = t => { const i = t.indexOf("。"); return i >= 0 ? t.slice(0, i + 1) : t; };
function showStoryNotice(G) {
  const fresh = newStories(G);
  if (!fresh.length) return;
  markStoriesKnown(G, fresh.map(e => e.id));
  if (game.autosave) game.autosave();
  const first = fresh.find(e => !e.id.startsWith("lore_")) || fresh[0];
  const rest = fresh.filter(e => e !== first);
  sheet.open({
    kind:"info", banner:"物語が記された", className:"jr-sheet jr-notice", accent:"#d9b76e",
    title: first.title,
    body:b=>{
      b.appendChild(illustration(first));
      b.appendChild(el("div","jr-subtitle",first.id.startsWith("lore_") ? `${first.group}・迷宮の由来と秘密` : first.group));
      const lead = linesOf(first)[0];
      if (lead) b.appendChild(el("p","jr-line jr-lead",firstSentence(lead)));
      if (rest.length) {
        const shown = rest.slice(0, 3).map(e => `「${e.title}」`).join("");
        b.appendChild(el("p","jr-more",`ほかに ${shown}${rest.length > 3 ? ` ほか${rest.length - 3}編` : ""} も記された。`));
      }
      b.appendChild(el("p","jr-hint","あとで読む時は、街の「ストーリー」から。"));
    },
    footer:[
      {label:"読む",kind:"primary",onTap:h=>{ h.close(); openEntry("story", first.id); }},
      {label:"あとで",kind:"secondary",onTap:h=>h.close()},
    ],
    onClose:()=>{ if (G.state === "town" && game.renderTown) game.renderTown(); },
  });
}
export function install() {
  registerUI({openHelp:()=>openJournal("help"),openStoryArchive:()=>openJournal("story"),storyButton,storyUnread,queueStoryNotice});
}
