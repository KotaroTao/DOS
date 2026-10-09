// 解放済みの手引きと、体験済みの物語を読む。ヘルプは酒場で書き留めた話 (心得・言い伝え) と一つの画面で、
// 「ヘルプ / 酒場の噂話」のタブで切り替え、検索は両方を横断する (街と迷宮の手帳から開く)。閲覧では報酬・進行を変更しない (既読の印だけを付ける)。
// 新しく物語が記されたら、街で手の空いた時に知らせる (queueStoryNotice)。迷宮の中・語りや手ほどきの最中は待つ。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, segmented, badge, uiBlocked } from "./kit.js";
import { sceneActive } from "./irene.js";
import { helpEntries, storyEntries, journalState, unreadStories, newStories, markStoryRead, markStoriesKnown } from "../journal.js";
import { archiveArt } from "../archive-art.js";
import { storyArt } from "../storyart.js";
import { vignetteCanvas } from "../townart.js";
import { TIP_CATS } from "../tavern.js";

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
// ---- ヘルプ・酒場の噂話 ----
// 酒場で聞いた心得・言い伝え (game.tavernNotes = G.tavernHeard の台帳順)
const tavernNotes = () => (game.tavernNotes ? game.tavernNotes() : []);
const noteLine = t => el("div", "jr-note k-" + t.k, t.t);
function openHelpIndex(tab = "help") {
  let activeTab = tab === "talk" ? "talk" : "help";
  const list = entries("help");
  sheet.open({
    kind:"info", banner:"ヘルプ・酒場の噂話", className:"jr-sheet jr-index", accent:"#78bdd1",
    body:b=>{
      const segBox = el("div", "jr-segbox");
      const intro = el("p", "jr-intro");
      const search = document.createElement("input");
      search.type="search"; search.className="jr-search";
      search.placeholder="ヘルプと噂話を探す";
      search.setAttribute("aria-label",search.placeholder);
      const results=el("div","jr-results");
      b.append(segBox, intro, search, results);
      const helpCard = entry => {
        const card=button({label:entry.title,kind:"secondary",onTap:()=>openEntry("help",entry.id)});
        card.classList.add("jr-card");
        if(entry.subtitle)card.appendChild(el("span","jr-card-sub",entry.subtitle));
        return card;
      };
      const drawHelp = shown => {
        let group=null;
        for(const entry of shown){
          const next=entry.group || "解放済みの機能";
          if(next!==group){group=next;results.appendChild(el("h3","jr-group",group));}
          results.appendChild(helpCard(entry));
        }
      };
      // 心得は区分ごと、言い伝えはその後に
      const drawTalk = notes => {
        const tips = notes.filter(t => t.k === "tip"), lore = notes.filter(t => t.k === "lore");
        for (const cat of TIP_CATS) {
          const ts = tips.filter(t => t.cat === cat);
          if (!ts.length) continue;
          results.appendChild(el("h3","jr-group",`心得 ― ${cat}`));
          for (const t of ts) results.appendChild(noteLine(t));
        }
        if (lore.length) {
          results.appendChild(el("h3","jr-group jr-group-lore","言い伝え"));
          for (const t of lore) results.appendChild(noteLine(t));
        }
      };
      const draw=()=>{
        const notes = tavernNotes();
        segBox.replaceChildren(segmented([
          { key:"help", label:"ヘルプ" },
          { key:"talk", label:`酒場の噂話${notes.length ? " " + notes.length : ""}` },
        ], activeTab, key => { activeTab = key; draw(); }));
        intro.textContent = activeTab === "help"
          ? "いま使える機能の手引きです。機能が解放されると、読める項目が増えます。"
          : "酒場「沈まぬ灯」で耳にした心得と言い伝えです。居合わせる者は帰還のたびに入れ替わり、まだ聞いていない話も多くあります。";
        results.replaceChildren();
        const query=search.value.trim();
        if (query) {
          // 検索はタブを問わず、ヘルプと噂話の両方から探す
          const helpHits = list.filter(e=>`${e.title} ${e.subtitle||""} ${e.group||""}`.includes(query));
          const talkHits = notes.filter(t=>t.t.includes(query) || (t.cat||"").includes(query));
          if (!helpHits.length && !talkHits.length) { results.appendChild(el("p","jr-empty","該当する記録がありません。")); return; }
          if (helpHits.length) { results.appendChild(el("h3","jr-group jr-group-top",`ヘルプ ${helpHits.length}件`)); for (const e of helpHits) results.appendChild(helpCard(e)); }
          if (talkHits.length) { results.appendChild(el("h3","jr-group jr-group-top",`酒場の噂話 ${talkHits.length}件`)); for (const t of talkHits) results.appendChild(noteLine(t)); }
          return;
        }
        if (activeTab === "help") {
          if (!list.length) { results.appendChild(el("p","jr-empty","まだ読める記録がありません。旅を進めると、ここに記録が増えていきます。")); return; }
          drawHelp(list);
        } else {
          if (!notes.length) { results.appendChild(el("p","jr-empty","まだ酒場で話を聞いていません。酒場の「酒場の噂話」で居合わせる者たちの話を聞くと、心得と言い伝えがここに書き留められます。")); return; }
          drawTalk(notes);
        }
      };
      search.addEventListener("input",draw);draw();
    },
    footer:[{label:"閉じる",kind:"secondary",onTap:h=>h.close()}],
  });
}

export function openJournal(kind = "help", tab = "help") {
  if (kind === "help") return openHelpIndex(tab);
  const list = entries("story");
  sheet.open({
    kind:"info", banner:"ストーリー", className:"jr-sheet jr-index",
    accent:"#d9b76e",
    body:b=>{
      b.appendChild(el("p","jr-intro","旅の歩みに合わせて読める物語です。「踏破した迷宮」では、その場所の由来と秘密を読めます。"));
      let activeTab = "story";
      const unread = journalState(game.G || {}).read;
      const isNew = e => !unread[e.id];
      const segBox = el("div", "jr-segbox");
      b.appendChild(segBox);
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
        drawSeg();
        const shown=list.filter(e=>e.id.startsWith("lore_") ? activeTab === "dungeons" : activeTab === "story");
        if(!shown.length){results.appendChild(el("p","jr-empty",activeTab === "dungeons"?"まだ踏破した迷宮がありません。":"まだ読める記録がありません。旅を進めると、ここに記録が増えていきます。"));return;}
        let group=null;
        for(const entry of shown){
          const next=entry.group || "解放済みの機能";
          if(next!==group){group=next;results.appendChild(el("h3","jr-group",group));}
          const card=button({label:entry.title,kind:"secondary",onTap:()=>openEntry("story",entry.id)});
          card.classList.add("jr-card");
          if(entry.subtitle)card.appendChild(el("span","jr-card-sub",entry.subtitle));
          if(isNew(entry)){card.classList.add("is-new");card.appendChild(el("span","jr-new","未読"));}
          results.appendChild(card);
        }
      };
      draw();
      redrawIndex = draw;
    },
    footer:[{label:"閉じる",kind:"secondary",onTap:h=>h.close()}],
    onClose:()=>{
      redrawIndex = null;
      // 街の「ストーリー」の未読の数を付け直す
      if (game.G?.state === "town" && game.renderTown) game.renderTown();
    },
  });
}

// ---- 未読の数 (街の「ストーリー」・迷宮の手帳に添える) ----
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
  registerUI({openHelp:(tab)=>openJournal("help", tab),openStoryArchive:()=>openJournal("story"),storyButton,storyUnread,queueStoryNotice});
}
