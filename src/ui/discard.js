import { bagOwners } from "../items.js";
// ===== 持ち物がいっぱいの時に捨てる品を選ぶ画面 (docs/infinite-labyrinth.md 18章。本編・無限迷宮とも) =====
// 品を手に入れる時・装備を外す時に袋が満杯なら、いま持っている品から1つ選んで捨てられる。ロックした品は候補に出さない。
// UI.openDiscard({ incoming, title, lines, members, skipLabel, onPick(owner, item), onSkip })
//   incoming = 入れたい品 (名前と絵を見せるだけ) / members = 捨てる品を探す人業 (省略時は隊)
//   onPick = 選んだ品を捨てた後に呼ぶ (捨てる処理は game.dropFromBag) / onSkip = 捨てずに閉じた
// 品の行を押すと品の詳細 (UI.itemSheet、見るだけ)。捨てるのは行の右の「捨てる」ボタン (2026-10 ユーザーの指示)
// game.js を import しない (ctx.js の窓口だけ)
import { UI, game, registerUI } from "./ctx.js";
import { el, sheet, row, itemTile, confirm, button } from "./kit.js";
import { itemName } from "../items.js";
import { RARITIES, rarityKey } from "../rarity.js";

const RAR_ORDER = { c: 0, uc: 1, r: 2, sr: 3, lr: 4 };
// 品の詳細 (見るだけ。捨てる・装備などの操作は出さない)
const showDetail = (it, owner = null) => { if (UI.itemSheet) UI.itemSheet(it, { owner, context: "view" }); };
const rarRank = (it) => (it && it.slot === "use" ? -1 : it && it.slot === "misc" ? -0.5 : RAR_ORDER[rarityKey(it)] ?? 0);

export function openDiscard(o = {}) {
  const members = (o.members || (game.G && game.G.party) || []).filter(Boolean);
  let done = false;
  const finish = (fn) => { if (done) return; done = true; if (fn) fn(); };
  const h = sheet.open({
    kind: "choice", banner: "持ち物がいっぱい", className: "dc-sheet",
    title: o.title || (o.incoming ? `${itemName(o.incoming)} を持つには、どれかを捨てる` : "捨てる品を選ぶ"),
    body: (b) => {
      if (o.incoming) {
        const head = el("button", "dc-in tap");
        head.type = "button";
        head.setAttribute("aria-label", `${itemName(o.incoming)} の詳細`);
        head.addEventListener("click", () => showDetail(o.incoming));
        head.appendChild(itemTile(o.incoming, { size: 44 }));
        const t = el("div", "dc-in-t");
        const nm = el("div", "dc-in-n " + "rar-" + (rarityKey(o.incoming) || "c"), itemName(o.incoming));
        t.appendChild(nm);
        t.appendChild(el("div", "dc-in-s", o.incomingSub || "手に入れようとしている品"));
        head.appendChild(t);
        b.appendChild(head);
      }
      for (const l of o.lines || ["袋の品を1つ捨てると、その空きに入る。品を押すと詳しく見られる。捨てた品は二度と戻らない。ロックした品は出ない。"]) b.appendChild(el("div", "dc-note", l));
      const list = [];
      for (const m of bagOwners(members)) for (const it of m.items || []) if (it && !it.locked) list.push({ m, it });
      list.sort((a, b2) => rarRank(a.it) - rarRank(b2.it) || (a.it.price || 0) - (b2.it.price || 0));
      if (!list.length) { b.appendChild(el("div", "dc-note dim", "捨てられる品が無い (どれもロックされている)。")); return; }
      for (const { m, it } of list) {
        const rk = rarityKey(it);
        const r = row({
          icon: itemTile(it, { size: 36 }), title: itemName(it),
          sub: `${m.name}の袋${it.unidentified ? " ・ 未鑑定" : ""}${rk && RARITIES[rk] ? " ・ " + RARITIES[rk].label : ""}`,
          onTap: () => showDetail(it, m),
        });
        r.classList.add("dc-row");
        if (rk) r.classList.add("rar-" + rk);
        r.setAttribute("aria-label", `${itemName(it)} の詳細`);
        const drop = button({
          label: "捨てる", kind: "danger", size: "sm",
          onTap: async () => {
            const ok = await confirm({ banner: "捨てる", title: `${itemName(it)} を捨てる？`, lines: ["捨てた品は二度と戻らない。"], okLabel: "捨てる", danger: true });
            if (!ok || done) return;
            if (!game.dropFromBag || !game.dropFromBag(m, it)) return;
            h.close("ok", { silent: true });
            finish(() => o.onPick && o.onPick(m, it));
          },
        });
        drop.classList.add("dc-drop");
        const line = el("div", "dc-line");
        line.appendChild(r);
        line.appendChild(drop);
        b.appendChild(line);
      }
    },
    footer: [{ label: o.skipLabel || (o.incoming ? "捨てずに置いていく" : "やめる"), kind: "ghost", onTap: (hh) => { hh.close("cancel", { silent: true }); finish(o.onSkip); } }],
    onClose: () => finish(o.onSkip), // 戻る・下へ払って閉じた = 捨てずに置いていく
  });
  return h;
}

export function install() { registerUI({ openDiscard }); }
