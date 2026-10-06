// 解放済みの手引きと、体験済みの物語を読む。閲覧では報酬・進行を変更しない。
import { UI, game, registerUI } from "./ctx.js";
import { el, button, sheet, segmented } from "./kit.js";
import { helpEntries, storyEntries } from "../journal.js";
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
function openEntry(kind, id) {
  // 一覧を開いたあとも、実際の進行で閲覧できるものだけを開く。
  const entry = entries(kind).find(e=>e.id===id);
  if (!entry) return;
  sheet.open({
    kind:"info", banner:kind==="help"?"ヘルプ":"ストーリー", title:entry.title,
    className:"jr-sheet jr-detail", accent:kind==="help"?"#78bdd1":"#d9b76e",
    body:b=>{
      b.appendChild(illustration(entry));
      if(entry.subtitle)b.appendChild(el("div","jr-subtitle",entry.subtitle));
      for(const line of linesOf(entry))b.appendChild(el("p","jr-line",line));
    },
    footer:[{label:"一覧に戻る",kind:"secondary",onTap:h=>h.close()}],
  });
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
      const search = document.createElement("input");
      search.type="search"; search.className="jr-search";
      search.placeholder=isHelp?"ヘルプを探す":"物語を探す";
      search.setAttribute("aria-label",search.placeholder);
      if (isHelp) b.appendChild(search);
      else b.appendChild(segmented([
        { key:"story", label:"ストーリー" },
        { key:"dungeons", label:"踏破した迷宮" },
      ], activeTab, key => { activeTab = key; draw(); }));
      const results=el("div","jr-results");b.appendChild(results);
      const draw=()=>{
        results.replaceChildren();
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
          results.appendChild(card);
        }
      };
      search.addEventListener("input",draw);draw();
    },
    footer:[{label:"閉じる",kind:"secondary",onTap:h=>h.close()}],
  });
}
export function install() {
  registerUI({openHelp:()=>openJournal("help"),openStoryArchive:()=>openJournal("story")});
}
