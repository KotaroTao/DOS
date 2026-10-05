// 品の名前・属性・レア度・隠しレベルから、絵の「素材と飾り」を決める
//   metal  … 刃・金属部の素材 (MAT のキー)
//   trim   … 鍔・縁・金具の素材
//   wood / leather / cloth … 柄・革・布
//   gem    … 宝石の素材 / glow … 属性の光 (属性が無ければ null)
//   orn    … 飾りの多さ 0 (コモン) 〜 4 (LR)
//   motifs … 名前から拾った意匠 (竜・星・月・骨・炎…)
import { MAT, ELEM_GEM, ELEM_GLOW, rng, hashStr } from "./core.js";

// 名前の言葉 → 意匠。上から順に見る (一つの名前に複数あってよい)
const MOTIF_WORDS = [
  ["dragon", /竜|龍|ドラゴン|ワイバーン/],
  ["star", /星|彗|流星|スター/],
  ["moon", /月|朔|宵|ルナ/],
  ["sun", /日輪|太陽|陽|旭|サン/],
  ["skull", /髑髏|骸|屍|死|葬|弔|冥|亡|墓|霊/],
  ["bone", /骨|白骨|牙/],
  ["flame", /炎|火|焔|紅蓮|灼|焦|熾|燃|爆/],
  ["frost", /氷|雪|霜|凍|冬/],
  ["wave", /水|潮|海|波|泉|雨|渦|流|滝|河/],
  ["wind", /風|嵐|疾|颶|旋/],
  ["thunder", /雷|稲妻|迅雷|電|鳴神/],
  ["leaf", /森|葉|樹|蔦|茨|棘|花|薔薇|草|苔/],
  ["wing", /翼|羽|鷹|鷲|鴉|烏|梟|燕|鳥/],
  ["holy", /聖|天|神|光|祈|祝|巡礼|司教|僧|教/],
  ["blood", /血|紅|赤|緋|朱/],
  ["serpent", /蛇|大蛇|ナーガ|蛟/],
  ["beast", /獣|狼|虎|獅子|熊|猪|豹|牙/],
  ["demon", /鬼|魔|悪|邪|呪|妖|獄/],
  ["eye", /眼|目|瞳|見/],
  ["crown", /王|皇|帝|君主|覇/],
  ["rune", /ルーン|刻|紋|印|呪文|魔導|秘/],
  ["crystal", /水晶|晶|玻璃|硝子|宝珠|クリスタル/],
  ["chain", /鎖|くさり|獄|枷|縛/],
  ["thorn", /茨|棘|針|刺/],
];
// 名前の言葉 → 金属
const METAL_WORDS = [
  ["obsidian", /黒曜/],
  ["mithril", /ミスリル|聖銀/],
  ["adamant", /アダマン|神鉄|星鉄|隕鉄/],
  ["black", /黒|闇|冥|夜|影|宵|暗|魔|呪|邪|獄/],
  ["gold", /黄金|金色|金の|王|皇/],
  ["silver", /銀|月|白|霜|雪/],
  ["bronze", /青銅|銅/],
  ["bone", /骨|骸|髑髏/],
  ["crystal", /水晶|晶|玻璃|硝子/],
  ["iron", /鉄|錆|古|朽|鈍/],
  ["stone", /石|岩/],
];
const WOOD_WORDS = [["darkwood", /黒檀|黒|闇|冥|夜|呪|魔|枯/], ["palewood", /白|樺|月|聖|骨/]];

// 隠しレベルで決まる既定の金属
function metalByLv(lv, r) {
  const tiers = ["iron", "steel", "silver", "mithril", "adamant"];
  let i = lv <= 25 ? 0 : lv <= 70 ? 1 : lv <= 110 ? 2 : lv <= 150 ? 3 : 4;
  if (r.chance(0.18)) i = Math.max(0, Math.min(4, i + (r.chance(0.5) ? -1 : 1)));
  return tiers[i];
}
const ORN = { c: 0, uc: 1, r: 2, sr: 3, lr: 4 };

export function themeOf(it, salt = 0) {
  const name = String(it.name || "");
  const r = rng(hashStr(String(it.id) + "#" + salt));
  const el = (it.eAtk && it.eAtk.el) || (it.eDef && it.eDef.el) || null;
  const orn = ORN[it.rar] != null ? ORN[it.rar] : 0;
  const motifs = new Set();
  for (const [k, re] of MOTIF_WORDS) if (re.test(name)) motifs.add(k);
  if (el === "fire") motifs.add("flame");
  if (el === "water") motifs.add("wave");
  if (el === "wind") motifs.add("wind");
  if (el === "light") motifs.add("holy");
  if (el === "dark") motifs.add("demon");
  let metal = null;
  for (const [k, re] of METAL_WORDS) if (re.test(name)) { metal = k; break; }
  if (metal === "stone" && it.slot === "weapon" && !["mc", "ax"].includes(it.cat)) metal = null;
  if (!metal) metal = metalByLv(it.lv || 1, r);
  if (metal === "crystal" && !el) metal = r.chance(0.5) ? "crystal" : "mithril";
  // 金具: コモンは鉄・青銅、上のレア度ほど金銀。闇の品は黒鉄と紫
  let trim;
  if (metal === "black" || motifs.has("demon")) trim = r.pick(orn >= 2 ? ["gold", "black", "silver"] : ["black", "iron", "bronze"]);
  else if (metal === "gold") trim = r.pick(["gold", "silver", "bronze"]);
  else trim = orn === 0 ? r.pick(["iron", "bronze", "steel", "bronze"]) : orn === 1 ? r.pick(["bronze", "steel", "gold", "copper"]) : r.pick(["gold", "gold", "silver", "bronze"]);
  if (trim === metal) trim = metal === "gold" ? "silver" : "gold";
  let wood = r.pick(["wood", "wood", "palewood", "darkwood"]);
  for (const [k, re] of WOOD_WORDS) if (re.test(name)) { wood = k; break; }
  const leather = r.pick(["leather", "leather", "darkleather"]);
  // 宝石: 属性があれば属性の色、無ければ名前の色言葉か乱数
  let gem = el ? ELEM_GEM[el] : null;
  if (!gem) {
    if (/紅|赤|血|緋|朱/.test(name)) gem = "red";
    else if (/蒼|青|藍/.test(name)) gem = "blue";
    else if (/翠|緑|碧/.test(name)) gem = "green";
    else if (/紫/.test(name)) gem = "purple";
    else if (/琥珀|黄/.test(name)) gem = "amber";
    else gem = r.pick(["red", "blue", "green", "purple", "amber", "red", "blue"]);
  }
  const glow = el ? ELEM_GLOW[el] : null;
  // 布の色 (法衣・房・旗など): 属性 → 名前 → 乱数
  let cloth = el ? { fire: "red", water: "blue", wind: "green", earth: "amber", light: "white", dark: "purple" }[el] : null;
  if (!cloth) {
    if (/紅|赤|血|緋|朱/.test(name)) cloth = "red";
    else if (/蒼|青|藍|海/.test(name)) cloth = "blue";
    else if (/翠|緑|森/.test(name)) cloth = "green";
    else if (/紫|魔|妖/.test(name)) cloth = "purple";
    else if (/白|聖|雪/.test(name)) cloth = "white";
    else if (/黒|闇|冥|影/.test(name)) cloth = "shadow";
    else cloth = r.pick(["cloth", "red", "blue", "green", "purple", "cloth", "teal", "amber"]);
  }
  // 隠しレベルの段 (0 粗末 〜 4 神話級): 段が上がるほど飾りが増える (ランクの格が絵で分かるように)
  const lv = it.lv || 1;
  const tier = lv <= 20 ? 0 : lv <= 50 ? 1 : lv <= 90 ? 2 : lv <= 140 ? 3 : 4;
  // 飾りの量 = レア度と隠しレベルの段の大きい方寄り
  const deco = Math.min(4, Math.max(orn, Math.round((orn + tier) / 2)));
  return { r, el, orn, tier, deco, motifs, metal, trim, wood, leather, gem, glow, cloth, name, lv, rar: it.rar || "c" };
}

export function hasMat(k) { return !!MAT[k]; }
