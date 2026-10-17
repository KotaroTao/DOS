// 魂の記憶の閲覧と差分比較。通し番号や記憶由来の印ではなく、再開後の内容を比べる。
import { el, button, sheet, itemTile } from "./kit.js";
import { itemDetailEl, statLines } from "./itemview.js";
import { itemName, SLOTS, SLOT_LABEL } from "../items.js";
import { SOUL_CLASSES, soulLabel, soulLevelCapOf, soulRankOf, jobBust, passiveName } from "../souls.js";
import { SPELLS } from "../combat.js";
import { tacticOf } from "../autotactics.js";
import { affixLines } from "../infaffix.js";
import { crispCanvas } from "../sprites.js";

const soulOf = (m, uid) => m?.souls?.find(s => s.uid === uid) || null;
const skillName = k => SPELLS[k]?.name || k;
const sorted = xs => [...(xs || [])].sort();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const soulState = s => s ? [s.clsKey, s.level || 1, s.count || 1, s.exp || 0, s.capBonus || 0] : null;
const picksOf = sub => sub?.picks || (sub?.passive ? [{ passive: sub.passive }] : sub?.skill ? [{ skill: sub.skill }] : []);
const picksState = sub => picksOf(sub).map(p => p.passive ? `p:${p.passive}` : `s:${p.skill}`);
const subState = (m, sub) => sub ? [soulState(soulOf(m, sub.uid)), picksState(sub), !!sub.picked] : null;
const gearState = it => it ? [it.id, it.q ?? null, it.forge || 0, !!it.locked,
  (it.afx || []).map(a => [a.k, a.v]).sort((a, b) => a[0].localeCompare(b[0]))] : null;
const settingState = d => [tacticOf(d).key, d?.skillOrder || [], sorted(d?.skillOff), sorted(d?.autoOff), d?.face ? [d.face.job, d.face.rank] : null];

export function memoryChanges(before, after) {
  const members = after.party.map((d, i) => {
    const old = before.party[i] || {}, mainBefore = soulOf(before, old.primary), mainAfter = soulOf(after, d.primary);
    const main = !equal(soulState(mainBefore), soulState(mainAfter));
    const subs = [0, 1].map(si => !equal(subState(before, old.subs?.[si]), subState(after, d.subs?.[si])));
    const gear = SLOTS.filter(k => !equal(gearState(old.equip?.[k]), gearState(d.equip?.[k])));
    const settings = !equal(settingState(old), settingState(d));
    return { old, current: d, mainBefore, mainAfter, main, subs, gear, settings,
      changed: main || subs.some(Boolean) || gear.length > 0 || settings || old.name !== d.name };
  });
  return { members, count: members.filter(m => m.changed).length,
    gear: members.reduce((n, m) => n + m.gear.length, 0),
    souls: members.reduce((n, m) => n + Number(m.main) + m.subs.filter(Boolean).length, 0),
    settings: members.filter(m => m.settings).length };
}

function soulFace(s, size = 34) {
  const icon = el("span", "inf-memory-face");
  if (s) icon.appendChild(crispCanvas(jobBust(s.clsKey, Math.max(1, soulRankOf(s))), size));
  return icon;
}
function soulText(s) {
  return s ? `${SOUL_CLASSES[s.clsKey]?.label || "魂"} ・ R${soulRankOf(s)}` : "なし";
}
function skillList(keys, empty = "なし") { return keys?.length ? keys.map(skillName).join(" ・ ") : empty; }
function borrowedText(sub) {
  const names = picksOf(sub).map(p => p.passive ? passiveName(p.passive) : skillName(p.skill));
  return names.length ? names.join(" ・ ") + (sub?.picked ? "" : " (自動)") : sub?.picked ? "借りる技なし" : "自動で選ぶ";
}
function subContent(memory, sub) {
  const soul = soulOf(memory, sub?.uid), body = el("div");
  if (!soul) { body.appendChild(el("span", "inf-memory-muted", "空き")); return body; }
  body.appendChild(el("div", "inf-memory-value-title", soulLabel(soul)));
  body.appendChild(el("div", "inf-memory-small", `Lv${soul.level || 1} / 上限${soulLevelCapOf(soul)} ・ R${soulRankOf(soul)}`));
  body.appendChild(el("div", "inf-memory-small", `融合数 ${Math.max(0, (soul.count || 1) - 1)} ・ 経験値 ${soul.exp || 0}`));
  body.appendChild(el("div", "inf-memory-small", `借用: ${borrowedText(sub)}`));
  return body;
}
function gearContent(it) {
  if (!it) return el("span", "inf-memory-muted", "装備なし");
  const body = el("div", "inf-memory-gear");
  const peek = button({ label: itemName(it), kind: "ghost", onTap: () => sheet.open({
    kind: "info", banner: "記憶する装備", title: itemName(it), className: "inf-sheet inf-memory-detail",
    body: b => b.appendChild(itemDetailEl(it)), footer: [{ label: "比較に戻る", kind: "ghost", onTap: h => h.close() }],
  }) });
  peek.classList.add("inf-memory-item");
  peek.prepend(itemTile(it, { size: 28 }));
  peek.setAttribute("aria-label", `${itemName(it)}の性能を見る`);
  body.appendChild(peek);
  if (it.q != null) body.appendChild(el("div", "inf-memory-small", `品質 ${it.q}${it.forge ? ` ・ ＋${it.forge}` : ""}${it.locked ? " ・ ロック中" : ""}`));
  const stats = statLines(it);
  if (stats) body.appendChild(el("div", "inf-memory-small", stats));
  for (const line of affixLines(it, it.afx || [])) body.appendChild(el("div", "inf-memory-affix", line));
  return body;
}

// 閲覧も器ごとのカードに揃え、長い装備名を一続きに並べない。
export function memoryParty(b, memory) {
  const list = el("div", "inf-memory-party");
  for (const [i, d] of memory.party.entries()) {
    const soul = soulOf(memory, d.primary), card = el("section", "inf-memory-member");
    const head = el("div", "inf-memory-member-head");
    head.appendChild(soulFace(soul));
    const text = el("div");
    text.appendChild(el("h3", "inf-memory-name", `${i + 1}. ${d.name}`));
    text.appendChild(el("div", "inf-memory-small", `${soulText(soul)} ・ Lv${soul?.level || 1} / 上限${soul ? soulLevelCapOf(soul) : 0}`));
    head.appendChild(text);card.appendChild(head);
    for (const [si, sub] of (d.subs || []).entries()) {
      card.appendChild(el("div", "inf-memory-label", `サブ魂${si + 1}`));card.appendChild(subContent(memory, sub));
    }
    const gear = SLOTS.filter(k => d.equip?.[k]), equipment = el("details", "inf-memory-equipment");
    equipment.appendChild(el("summary", null, gear.length ? `装備 ${gear.length}部位の内訳を見る` : "装備なし"));
    for (const k of gear) {
      const line = el("div", "inf-memory-saved-gear");
      line.appendChild(el("span", "inf-memory-label", SLOT_LABEL[k]));line.appendChild(gearContent(d.equip[k]));equipment.appendChild(line);
    }
    if (gear.length) card.appendChild(equipment);else card.appendChild(el("div", "inf-memory-small", "装備なし"));
    card.appendChild(el("div", "inf-memory-small", `作戦: ${tacticOf(d).name}`));
    list.appendChild(card);
  }
  b.appendChild(list);
}

function comparisonRow(label, before, after, changed, delta = null) {
  const row = el("div", "inf-memory-row" + (changed ? " changed" : " same"));
  const dt = el("div", "inf-memory-label", label);
  if (changed) dt.appendChild(el("span", "inf-memory-delta" + (delta > 0 ? " up" : delta < 0 ? " down" : ""),
    delta == null ? "変更" : `${delta > 0 ? "+" : ""}${delta}`));
  row.appendChild(dt);
  for (const [i, value] of [before, after].entries()) {
    const cell = el("div", "inf-memory-value " + (i ? "after" : "before"));
    cell.appendChild(el("span", "inf-memory-cell-label", i ? "今回" : "以前"));
    if (value?.nodeType) cell.appendChild(value);else cell.appendChild(el("span", "inf-memory-value-text", String(value)));
    row.appendChild(cell);
  }
  return row;
}
function group(title, rows) {
  const section = el("section", "inf-memory-group" + (rows.some(r => r.classList.contains("changed")) ? "" : " same"));
  section.appendChild(el("h4", "inf-memory-group-title", title));
  rows.forEach(r => section.appendChild(r));return section;
}
export function memoryComparison(b, previous, candidate) {
  const diff = memoryChanges(previous, candidate), root = el("div", "inf-memory-comparison");
  const summary = el("div", "inf-memory-summary");
  for (const [n, label] of [[diff.count, "人に変更"], [diff.souls, "魂の変更"], [diff.gear, "部位の装備変更"]]) {
    const chip = el("div");chip.appendChild(el("strong", null, n));chip.appendChild(el("span", null, label));summary.appendChild(chip);
  }
  root.appendChild(summary);
  root.appendChild(el("p", "inf-note dim", diff.count ? "左が以前、右が今回。増減は数字で、変わった項目は色付きで表示します。" : "保存内容に変更はありません。すべての項目を確認できます。"));
  const toolbar = el("div", "inf-memory-toolbar");
  const filters = el("div", "ui-seg inf-memory-filter");
  const buttons = [];
  for (const [all, label] of [[false, "変更のみ"], [true, "すべて"]]) {
    const choice = button({ label, kind: "ghost", onTap: () => {
      root.classList.toggle("show-all", all);
      buttons.forEach((btn, i) => { btn.classList.toggle("on", i === Number(all));btn.setAttribute("aria-pressed", String(i === Number(all))); });
      empty.hidden = all || !!diff.count;
    } });
    choice.classList.add("ui-seg-b");choice.classList.toggle("on", all);
    choice.setAttribute("aria-pressed", String(all));buttons.push(choice);filters.appendChild(choice);
  }
  root.classList.add("show-all");toolbar.appendChild(filters);
  toolbar.appendChild(el("div", "inf-memory-legend", "以前の記憶　→　今回の状態"));root.appendChild(toolbar);
  const empty = el("div", "inf-note dim", "変更された項目はありません。「すべて」で保存内容を確認できます。");empty.hidden = true;root.appendChild(empty);
  for (const [i, member] of diff.members.entries()) {
    const { old, current, mainBefore, mainAfter } = member;
    const card = el("section", "inf-memory-member" + (member.changed ? "" : " same"));
    const heading = el("h3", "inf-memory-name", `${i + 1}. ${current.name}`);
    heading.appendChild(el("span", "inf-memory-status", member.changed ? "変更あり" : "変更なし"));card.appendChild(heading);
    card.appendChild(el("div", "inf-memory-small", mainBefore?.clsKey === mainAfter?.clsKey && soulRankOf(mainBefore) === soulRankOf(mainAfter)
      ? soulText(mainAfter) : `${soulText(mainBefore)} → ${soulText(mainAfter)}`));
    const jobs = [mainBefore, mainAfter].map(s => { const c = el("div", "inf-memory-job");c.appendChild(soulFace(s));c.appendChild(el("span", null, soulText(s)));return c; });
    const rows = [comparisonRow("職業", jobs[0], jobs[1], mainBefore?.clsKey !== mainAfter?.clsKey || soulRankOf(mainBefore) !== soulRankOf(mainAfter))];
    for (const [key, label, value] of [["level", "魂Lv", s => s?.level || 1], ["cap", "Lv上限", s => s ? soulLevelCapOf(s) : 0],
      ["count", "融合数", s => Math.max(0, (s?.count || 1) - 1)], ["exp", "経験値", s => s?.exp || 0]]) {
      const a = value(mainBefore), z = value(mainAfter);
      // 異なる職業の育成値は優劣を示さず、変更として表示する。
      rows.push(comparisonRow(label, a, z, a !== z, mainBefore?.clsKey === mainAfter?.clsKey ? z - a : null));
    }
    rows.unshift(comparisonRow("器の名", old.name, current.name, old.name !== current.name));
    card.appendChild(group("メイン魂", rows));
    card.appendChild(group("サブ魂と借りる技", [0, 1].map(si => comparisonRow(`サブ魂${si + 1}`,
      subContent(previous, old.subs?.[si]), subContent(candidate, current.subs?.[si]), member.subs[si]))));
    card.appendChild(group("装備", SLOTS.map(k => {
      const a = old.equip?.[k], z = current.equip?.[k];
      const line = comparisonRow(SLOT_LABEL[k], gearContent(a), gearContent(z), member.gear.includes(k));
      if (a?.id === z?.id && a?.q != null && z?.q != null && a.q !== z.q) {
        const delta = line.querySelector(".inf-memory-delta");
        delta.textContent = `品質 ${z.q > a.q ? "+" : ""}${z.q - a.q}`;
        delta.classList.add(z.q > a.q ? "up" : "down");
      }
      return line;
    })));
    const settings = [comparisonRow("作戦", tacticOf(old).name, tacticOf(current).name, tacticOf(old).key !== tacticOf(current).key),
      comparisonRow("技の並び", skillList(old.skillOrder, "標準の並び"), skillList(current.skillOrder, "標準の並び"), !equal(old.skillOrder || [], current.skillOrder || [])),
      comparisonRow("非表示の技", skillList(old.skillOff), skillList(current.skillOff), !equal(sorted(old.skillOff), sorted(current.skillOff))),
      comparisonRow("オート除外", skillList(old.autoOff), skillList(current.autoOff), !equal(sorted(old.autoOff), sorted(current.autoOff)))];
    const faceText = f => f ? `${SOUL_CLASSES[f.job]?.label || "魂"} ・ R${f.rank}` : "魂の姿";
    settings.push(comparisonRow("面影", faceText(old.face), faceText(current.face), !equal(old.face || null, current.face || null)));
    card.appendChild(group("作戦と技の設定", settings));root.appendChild(card);
  }
  b.appendChild(root);
  return diff;
}
