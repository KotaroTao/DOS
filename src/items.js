// 武器・防具・アクセサリ・消耗品のカタログ (基本品)
// 大量の一点物は src/catalog/ で定義され、game.js が ITEMS に統合する。
// 各アイテムは art(12x12) + 共有パレット P で描く。説明文・性能・職業制限つき。
//
// slot: head | weapon | shield | body | feet | acc | use | misc
//   weapon→右手, shield→左手, head/body/feet, acc→アクセサリ枠(2), use→消耗品
//   misc→蒐集品(戦利品。装備/使用不可。売却するか王宮の宝物庫に奉納する)
// twoHanded: 両手武器 (左手をふさぐ)
// classes: 装備可能な職業キー配列 (null=全職)
// cursed: 呪い (一度装備すると外せない)
// 性能キー: atk/vit/agi/int/pie/luk (六大ステ加算) / hp/mp (最大値加算) / crit (会心率加算)
// lv: 隠しレベル (1-200)。迷宮の出現帯・出現率・表示ランクを決める
// cat: 武器のみ。サブカテゴリ (WEAPON_CATS のキー)
// eAtk/eDef: 属性攻撃/属性防御 { el, lv } (lv1=◯ ±50%, lv2=◎ ±100%)

// 装備部位 (8か所): 武器・盾・鎧・頭・小手・足・装飾x2
export const SLOTS = ["weapon", "shield", "body", "head", "hands", "feet", "acc1", "acc2"];
export const SLOT_LABEL = {
  weapon: "武器", body: "防具", shield: "盾", head: "頭", hands: "小手", feet: "足", acc1: "装飾1", acc2: "装飾2",
};
export const MAX_ITEMS = 8;

// ===== アイテム分類 (商店・図鑑のタブ) =====
export const ITEM_CATS = [
  { key: "use", label: "道具", slots: ["use"] },
  { key: "weapon", label: "武器", slots: ["weapon"] },
  { key: "shield", label: "盾", slots: ["shield"] },
  { key: "body", label: "防具", slots: ["body"] },
  { key: "head", label: "頭", slots: ["head"] },
  { key: "hands", label: "小手", slots: ["hands"] },
  { key: "feet", label: "足", slots: ["feet"] },
  { key: "acc", label: "装飾", slots: ["acc"] },
  { key: "misc", label: "蒐集品", slots: ["misc"] },
];
// 武器サブカテゴリ (図鑑の武器タブをさらに分ける)
export const WEAPON_CATS = [
  { key: "ls", label: "長剣" },
  { key: "dg", label: "短剣" },
  { key: "kt", label: "刀" },
  { key: "ax", label: "斧" },
  { key: "mc", label: "槌" },
  { key: "sp", label: "槍" },
  { key: "bw", label: "弓" },
  { key: "st", label: "杖" },
];
export const WEAPON_CAT_LABEL = (() => {
  const m = {};
  for (const c of WEAPON_CATS) m[c.key] = c.label;
  return m;
})();

// 職業ギアマトリクス (souls.js が registerJobGear で注入する)
let _jobGear = {};
export function registerJobGear(map) { _jobGear = map; }
// 鎧重量ランク: heavy(2) ≥ light(1) ≥ cloth(0)。item.weight ≤ job.armor のとき装備可
const ARMOR_RANK = { heavy: 2, light: 1, cloth: 0 };

// ===== 武器の射程 =====
// 近距離: 敵の前衛にしか届かない / 中距離: 自分が前衛なら敵の後衛まで届く /
// 長距離: 後衛からでも敵の後衛まで届く。魔法・ブレスは射程の制約を受けない。
export const RANGE_LABEL = { near: "近距離", mid: "中距離", long: "長距離" };
const CAT_RANGE = { ls: "near", dg: "near", kt: "near", ax: "near", mc: "near", st: "near", sp: "mid", bw: "long" };
// アイテム個別の range 指定 > サブカテゴリの既定値。素手・射程不明は近距離
export function weaponRange(item) {
  if (!item) return "near";
  return item.range || CAT_RANGE[item.cat] || "near";
}

// ===== 鑑定システム (ウィザードリィ風) =====
// ダンジョンで拾った装備は「未鑑定 (unidentified)」状態で手に入り、伏せ名で表示され
// 鑑定するまで装備できない。鑑定は商店 (有料・確実) か一部職業のスキルで行う。
// 消耗品・蒐集品 (use/misc) は鑑定済みで出るため対象外。
export const UNIDENT_SLOTS = new Set(["weapon", "shield", "body", "head", "hands", "feet", "acc"]);
// 武器はサブカテゴリごとに伏せ名を変える (剣・斧・杖… の見当はつく、というていの表記)
const UNIDENT_WEAPON = { ls: "けん？", dg: "ナイフ？", kt: "かたな？", ax: "おの？", mc: "つち？", sp: "やり？", bw: "ゆみ？", st: "つえ？" };
const UNIDENT_SLOT = { weapon: "えもの？", shield: "たて？", body: "よろい？", head: "かぶと？", hands: "こて？", feet: "くつ？", acc: "かざり？" };
// 未鑑定品の伏せ名 (スロット/武器カテゴリ別)
export function unidentName(it) {
  if (!it) return "なぞのしなもの？";
  if (it.slot === "weapon") return UNIDENT_WEAPON[it.cat] || "えもの？";
  return UNIDENT_SLOT[it.slot] || "なぞのしなもの？";
}
// 表示名: 未鑑定なら伏せ名、鑑定済みなら本来の名前
export function itemName(it) { return it && it.unidentified ? unidentName(it) : (it ? it.name : ""); }

// 隠しレベル → 表示ランク R1-R20 (図鑑の枠色・発見演出に使う)
// lv は 1-200 (全100迷宮の lootLv 帯に対応)。10lv ごとに 1 ランク上がり、
// 1ランクの差で性能が明確に伸びる (R1=lv1-10 … R20=lv191-200)。
export function lvToRank(lv) {
  return Math.min(20, Math.max(1, Math.ceil((lv || 1) / 10)));
}

// slot種別 → 装備キー
export function slotKeyFor(item, member) {
  if (item.slot === "weapon") return "weapon";
  if (item.slot === "shield") return "shield";
  if (item.slot === "body") return "body";
  if (item.slot === "head") return "head";
  if (item.slot === "hands") return "hands";
  if (item.slot === "feet") return "feet";
  if (item.slot === "acc") return member.equip.acc1 ? (member.equip.acc2 ? "acc1" : "acc2") : "acc1";
  return null;
}

// 共有パレット
const P = {
  ".": null,
  k: "#15151d", // 黒縁
  w: "#dadbe6", // 鋼(明)
  g: "#888e9c", // 鋼(暗)
  y: "#e8c24a", // 金
  o: "#a9781f", // 金(影)
  n: "#7a4a22", // 木
  s: "#4a2d14", // 木(影)
  l: "#c8a06a", // 革
  d: "#8a6438", // 革(影)
  r: "#cf3b34", // 赤
  b: "#3f7fc4", // 青
  c: "#7fd0e6", // 水
  p: "#9b59b6", // 紫
  G: "#46b14e", // 緑
  m: "#d36b9a", // 桃
};

const sprite = (art) => ({ art, palette: P });

export const ITEMS = {
  // ===== 武器 =====
  dagger: {
    id: "dagger", name: "ダガー", slot: "weapon", cat: "dg", lv: 1, atk: 3, hit: 1, dice: "1d4", swings: 1, price: 30, classes: null,
    desc: "行き倒れの傭兵が最後まで手放さなかったような、ありふれた両刃の短剣。血脂を吸った柄革は黒ずみ、誰の手にも妙に馴染む。",
    ...sprite([
      "....k.......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "..kkykk.....",
      "...oyo......",
      "...knk......",
      "...knk......",
      "....s.......",
      "............",
      "............",
    ]),
  },
  shortSword: {
    id: "shortSword", name: "ショートソード", slot: "weapon", cat: "ls", lv: 3, atk: 6, hit: 2, dice: "1d6+1", swings: 1, price: 120, classes: null,
    desc: "兵士崩れの亡骸からよく見つかる、無銘の片手剣。鍛えは確かで、迷宮の闇の中で数多の持ち主を看取ってきた。",
    ...sprite([
      "....k.......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "...kwk......",
      "..kkykk.....",
      "...oyo......",
      "...knk......",
      "...knk......",
      "....s.......",
      "............",
    ]),
  },
  battleAxe: {
    id: "battleAxe", name: "バトルアックス", slot: "weapon", cat: "ax", lv: 8, atk: 13, hit: 3, dice: "2d6", swings: 1, twoHanded: true, price: 480, classes: null,
    desc: "骨ごと断つことしか考えられていない、無骨な両手斧。刃こぼれの一つ一つが誰かの最期だ。絶大な威力だが盾は持てない。",
    ...sprite([
      ".....kn.....",
      "...kkwwn....",
      "..kwwwgn....",
      ".kwwwggn....",
      ".kwggg.n....",
      "..kkg..n....",
      ".....kn.....",
      ".....sn.....",
      ".....sn.....",
      ".....sn.....",
      ".....ss.....",
      "............",
    ]),
  },
  warHammer: {
    id: "warHammer", name: "ウォーハンマー", slot: "weapon", cat: "mc", lv: 6, atk: 9, pie: 1, hit: 2, dice: "1d8+1", swings: 1, price: 300, classes: null,
    desc: "柄に祈りの文句が刻まれた戦槌。刃を禁じられた聖職者が、骸を「鎮める」ために編み出した得物だという。骨ある敵に重く響く。",
    ...sprite([
      "..kkkkkk....",
      ".kggwwggk...",
      ".kgwwwwgk...",
      ".kggwwggk...",
      "..kknkkk....",
      "....n.......",
      "....n.......",
      "....n.......",
      "....n.......",
      "....s.......",
      "....s.......",
      "............",
    ]),
  },
  magicStaff: {
    id: "magicStaff", name: "魔法の杖", slot: "weapon", cat: "st", lv: 5, atk: 4, int: 2, hit: 0, dice: "1d4", swings: 1, mp: 4, price: 260, classes: null,
    desc: "蒼い宝玉を戴いた杖。玉の奥では囚われた精霊の光がゆっくりと脈打ち、握る者の魔力と知性を研ぎ澄ます。",
    ...sprite([
      "....kbk.....",
      "...kbck.....",
      "...kcbk.....",
      "....kbk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....knk.....",
      "....ksk.....",
      "............",
    ]),
  },

  // ===== 盾 =====
  woodShield: {
    id: "woodShield", name: "木の盾", slot: "shield", lv: 2, vit: 3, price: 80, classes: null,
    desc: "カシの板をびょうで重ねた小盾。表面には先代の持ち主のものらしい爪痕が走るが、まだ十分に矢と牙を受け止められる。",
    ...sprite([
      "..kkkkkk....",
      ".knnnnnnk...",
      ".knssssnk...",
      ".knsllsnk...",
      ".knsllsnk...",
      ".knssssnk...",
      ".knnnnnnk...",
      "..knnnnk....",
      "...knnk.....",
      "....kk......",
      "............",
      "............",
    ]),
  },
  kiteShield: {
    id: "kiteShield", name: "カイトシールド", slot: "shield", lv: 7, vit: 6, price: 240, classes: null,
    desc: "騎士団の紋章が剥げ落ちた大盾。掲げた誓いは廃れても、鋼の守りは廃れていない。前衛の半身を覆って守る。",
    ...sprite([
      "..kkkkkk....",
      ".kwggggwk...",
      ".kgwggwgk...",
      ".kggyyggk...",
      ".kggyyggk...",
      ".kgwggwgk...",
      ".kwggggwk...",
      "..kgggwk....",
      "...kggk.....",
      "....kk......",
      "............",
      "............",
    ]),
  },

  // ===== 体 =====
  robe: {
    id: "robe", name: "ローブ", slot: "body", lv: 2, vit: 1, int: 1, mp: 3, price: 90, classes: null, weight: "cloth",
    desc: "魔除けの紋様を縫い込んだ外套。糸は月のない夜に紡がれたといい、まとう者の魔力を少しだけ高める。",
    ...sprite([
      "...kkkk.....",
      "..kppppk....",
      ".kppbbppk...",
      ".kppbbppk...",
      ".kpppppppk..",
      ".kpppppppk..",
      ".kpppppppk..",
      ".kpppppppk..",
      "..kpppppk...",
      "..kpp.ppk...",
      "..kk..kk....",
      "............",
    ]),
  },
  leatherArmor: {
    id: "leatherArmor", name: "革の鎧", slot: "body", lv: 4, vit: 4, price: 160, classes: null, weight: "light",
    desc: "魔獣の革をなめした軽鎧。幾針もの縫い直しの跡は、これを着て生き延びた者たちの記録だ。軽くて動きやすい。",
    ...sprite([
      "..kkkkkk....",
      ".kllllllk...",
      "klddlldddk..",
      "kllllllllk..",
      "klldllllk...",
      ".klllllldk..",
      ".klldlllllk.",
      ".kllllldlk..",
      "..klllllk...",
      "..kll.llk...",
      "..kk..kk....",
      "............",
    ]),
  },
  plateArmor: {
    id: "plateArmor", name: "プレートアーマー", slot: "body", lv: 12, vit: 11, agi: -1, price: 600, classes: null, weight: "heavy",
    desc: "全身を鋼で固めた重鎧。継ぎ目の奥に沈む黒ずみは錆か、それとも前の持ち主の名残か。鉄壁だが少し鈍重になる。",
    ...sprite([
      "..kkkkkk....",
      ".kwggggwk...",
      "kwwgwwgwwk..",
      "kwgwwwwgwk..",
      "kwggwwggwk..",
      ".kwgwwgwk...",
      ".kwggwwggk..",
      ".kwgwwwgwk..",
      "..kwggwwk...",
      "..kww.wwk...",
      "..kk..kk....",
      "............",
    ]),
  },

  // ===== 頭 =====
  cap: {
    id: "cap", name: "布の帽子", slot: "head", lv: 1, vit: 1, price: 30, classes: null, weight: "light",
    desc: "擦り切れた布の帽子。墓土の冷たさと滴る汚水からは守ってくれる。ないよりはまし、と誰もが言う。",
    ...sprite([
      "............",
      "...kkkk.....",
      "..kbbbbk....",
      ".kbbccbbk...",
      ".kbbbbbbk...",
      "..kkkkkk....",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
    ]),
  },
  ironHelm: {
    id: "ironHelm", name: "鉄兜", slot: "head", lv: 5, vit: 3, price: 150, classes: null, weight: "heavy",
    desc: "面頬つきの鉄兜。覗き穴の奥は常に闇で、かぶった者の顔を誰にも思い出させない。頭部をしっかり守る。",
    ...sprite([
      "...kkkk.....",
      "..kwggwk....",
      ".kwgwwgwk...",
      ".kwgwwgwk...",
      ".kwwwwwwk...",
      ".kwkkkkwk...",
      ".kwgwwgwk...",
      "..kwwwwk....",
      "...kkkk.....",
      "............",
      "............",
      "............",
    ]),
  },

  // ===== 足 =====
  leatherBoots: {
    id: "leatherBoots", name: "革のブーツ", slot: "feet", lv: 2, vit: 1, agi: 1, price: 70, classes: null, weight: "light",
    desc: "丈夫な革の長靴。底に染みた泥は幾層にも重なり、どの層がどの迷宮のものかもう分からない。素早さがわずかに上がる。",
    ...sprite([
      "............",
      "..kk...kk...",
      ".klk...klk..",
      ".klk...klk..",
      ".klk...klk..",
      ".klk...klk..",
      ".kllk.kllk..",
      ".klllkklllk.",
      ".kdllllldlk.",
      ".kkkkkkkkk..",
      "............",
      "............",
    ]),
  },
  ironGreaves: {
    id: "ironGreaves", name: "鉄の脚甲", slot: "feet", lv: 6, vit: 3, price: 180, classes: null, weight: "heavy",
    desc: "鋼のすね当て。骨の散らばる床を踏み砕いて進むためのものであり、自分が踏み砕かれないためのものでもある。",
    ...sprite([
      "............",
      "..kk...kk...",
      ".kwk...kwk..",
      ".kgk...kgk..",
      ".kwk...kwk..",
      ".kgk...kgk..",
      ".kwwk.kwwk..",
      ".kgwwkkgwwk.",
      ".kwggwwwggk.",
      ".kkkkkkkkk..",
      "............",
      "............",
    ]),
  },

  // ===== 小手 =====
  leatherGloves: {
    id: "leatherGloves", name: "革の手袋", slot: "hands", lv: 1, vit: 1, price: 50, classes: null, weight: "light",
    desc: "しなやかな革の手袋。罠の毒針から指先を、冷たい亡者の握手から手首を、わずかながら守ってくれる。",
    ...sprite([
      ".klk.klk....",
      ".klk.klk....",
      ".kllkllk....",
      ".kdlllldk...",
      "..klllk.....",
      "..kkkkk.....",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
    ]),
  },
  silverGloves: {
    id: "silverGloves", name: "銀の小手", slot: "hands", lv: 7, vit: 3, atk: 1, price: 280, classes: null, weight: "light",
    desc: "銀細工の籠手。銀は穢れた者に触れると鈍く曇り、持ち主に警告するという。守りを固めつつ拳撃にも冴える。",
    ...sprite([
      ".kwk.kwk....",
      ".kwwkwwk....",
      ".kwcwcwk....",
      ".kgwwwgk....",
      "..kwwwk.....",
      "..kkkkk.....",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
    ]),
  },
  ironGauntlets: {
    id: "ironGauntlets", name: "鉄の籠手", slot: "hands", lv: 6, vit: 4, agi: -1, price: 240, classes: null, weight: "heavy",
    desc: "重厚な鉄の籠手。指の自由と引き換えに、握った得物ごと腕を守り抜く。少し動きが鈍る。",
    ...sprite([
      ".kwk.kwk....",
      ".kgwkgwk....",
      ".kwgwgwk....",
      ".kggwggk....",
      "..kgggk.....",
      "..kkkkk.....",
      "............",
      "............",
      "............",
      "............",
      "............",
      "............",
    ]),
  },

  // ===== アクセサリ =====
  powerRing: {
    id: "powerRing", name: "力の指輪", slot: "acc", lv: 20, atk: 4, price: 240, classes: null,
    desc: "はめた瞬間、自分のものではない怒りが血管を駆け抜ける指輪。腕力がみなぎり、攻撃力が上がる。",
    ...sprite([
      "............",
      "....kkk.....",
      "...krrrk....",
      "..kr.k.rk...",
      "..kr.r.rk...",
      "..kr...rk...",
      "...kr.rk....",
      "....krk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  guardAmulet: {
    id: "guardAmulet", name: "守りの護符", slot: "acc", lv: 20, vit: 4, price: 240, classes: null,
    desc: "崩落した聖堂から唯一無傷で掘り出された護符。宿された加護はまだ生きている。防御力が上がる。",
    ...sprite([
      "....kk......",
      "...kbbk.....",
      "..kb..bk....",
      "..kb..bk....",
      "...kbbk.....",
      "..kbccbk....",
      ".kbcyycbk...",
      ".kbcyycbk...",
      ".kbccccbk...",
      "..kbbbbk....",
      "...kkkk.....",
      "............",
    ]),
  },
  swiftRing: {
    id: "swiftRing", name: "俊足の指輪", slot: "acc", lv: 28, agi: 4, price: 390, classes: null,
    desc: "風の精が封じられた指輪。耳元で絶えず微かな囁きがする。聞き取れた者はいない。素早さが上がる。",
    ...sprite([
      "............",
      "....kkk.....",
      "...kGGGk....",
      "..kG.k.Gk...",
      "..kG.G.Gk...",
      "..kG...Gk...",
      "...kG.Gk....",
      "....kGk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  lifeAmulet: {
    id: "lifeAmulet", name: "生命の護符", slot: "acc", lv: 32, hp: 16, price: 480, classes: null,
    desc: "今も微かに鼓動を続ける宝玉の護符。元が誰の心臓だったのかは、考えない方がいい。最大HPが上がる。",
    ...sprite([
      "....kk......",
      "...krrk.....",
      "..kr..rk....",
      "..kr..rk....",
      "...krrk.....",
      "..krmrk.....",
      ".krmmmrk....",
      ".krmmmrk....",
      ".krrmrrk....",
      "..krrrk.....",
      "...kkk......",
      "............",
    ]),
  },
  amberTalisman: {
    id: "amberTalisman", name: "琥珀の守符", slot: "acc", lv: 44, vit: 6, mp: 6, price: 800, classes: null,
    eDef: { el: "earth", lv: 1 },
    desc: "太古の樹液に名も知れぬ羽虫が封じられた琥珀。幾万年を閉じ込めた静けさが、土の理から持ち主を匿う。",
    ...sprite([
      "....kk......",
      "...kyok.....",
      "..ko..yk....",
      "..ky..ok....",
      "...koyk.....",
      "..kyooyk....",
      ".kyooooyk...",
      ".kyoooyok...",
      ".kyyooyyk...",
      "..kyyyyk....",
      "...kkkk.....",
      "............",
    ]),
  },
  emberRing: {
    id: "emberRing", name: "残り火の指輪", slot: "acc", lv: 67, atk: 5, price: 1700, classes: null,
    eAtk: { el: "fire", lv: 1 },
    desc: "決して冷めないおき火をはめ込んだ指輪。指先に伝う熱が、振るう得物の先にまで燃え移る。",
    ...sprite([
      "............",
      "....kkk.....",
      "...krrrk....",
      "..kr.k.rk...",
      "..kr.r.rk...",
      "..kr...rk...",
      "...kr.rk....",
      "....krk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  tideBead: {
    id: "tideBead", name: "潮霊の数珠", slot: "acc", lv: 83, mp: 12, price: 2500, classes: null,
    eDef: { el: "water", lv: 1 },
    desc: "溺死者の眠る入江で拾い集められた青珠の連なり。耳を澄ますと遠い潮騒が聞こえ、火の災いを波が払う。",
    ...sprite([
      "....kk......",
      "...kbbk.....",
      "..kb..bk....",
      "..kb..bk....",
      "...kbbk.....",
      "..kbccbk....",
      ".kbcbbcbk...",
      ".kbcbbcbk...",
      ".kbccccbk...",
      "..kbbbbk....",
      "...kkkk.....",
      "............",
    ]),
  },
  galeAnklet: {
    id: "galeAnklet", name: "風切りの足環", slot: "acc", lv: 99, agi: 7, price: 3460, classes: null,
    desc: "墜ちたハーピーの風切羽を編み込んだ足環。一歩ごとに体が軽くなり、踏んだ床の軋みすら置き去りにする。",
    ...sprite([
      "............",
      "....kkk.....",
      "...kGGGk....",
      "..kG.k.Gk...",
      "..kG.G.Gk...",
      "..kG...Gk...",
      "...kG.Gk....",
      "....kGk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  gravewardBell: {
    id: "gravewardBell", name: "墓守の鈴", slot: "acc", lv: 114, hp: 40, price: 4480, classes: null,
    eDef: { el: "dark", lv: 1 },
    desc: "亡者の徘徊を報せるために墓地に吊るされていた銀鈴。音は生者にしか聞こえず、鳴る間は闇の爪が届かない。",
    ...sprite([
      "....kk......",
      "...kwwk.....",
      "...kwwk.....",
      "..kwwwwk....",
      "..kwggwk....",
      ".kwwwwwwk...",
      ".kwggggwk...",
      ".kkkkkkkk...",
      "...kggk.....",
      "............",
      "............",
      "............",
    ]),
  },
  dawnMedal: {
    id: "dawnMedal", name: "暁光の勲章", slot: "acc", lv: 137, atk: 9, vit: 9, price: 6330, classes: null,
    eAtk: { el: "light", lv: 1 },
    desc: "夜明けを取り戻した英雄に授けられたという勲章。授与の記録は焼け、功績だけが金属の中で燃え続けている。",
    ...sprite([
      "...kkkkk....",
      "..ky.y.yk...",
      "...kyyyk....",
      "....kyk.....",
      "...kyyyk....",
      "..kyyyyyk...",
      ".kyyoyoyyk..",
      ".kyoyyyoyk..",
      ".kyyoyoyyk..",
      "..kyyyyyk...",
      "...kkkkk....",
      "............",
    ]),
  },
  abyssEye: {
    id: "abyssEye", name: "深淵の瞳", slot: "acc", lv: 161, mp: 24, price: 8600, classes: null,
    eAtk: { el: "dark", lv: 1 },
    desc: "覗いた者を覗き返すという、正体不明の眼球の剥製。まぶたのない瞳は瞬きの代わりに、持ち主の敵を見据える。",
    ...sprite([
      "............",
      "...kkkk.....",
      "..kpppppk...",
      ".kppwwppk...",
      ".kpwkkwpk...",
      ".kpwkkwpk...",
      ".kppwwppk...",
      "..kpppppk...",
      "...kkkk.....",
      "............",
      "............",
      "............",
    ]),
  },
  dragonboneRing: {
    id: "dragonboneRing", name: "竜骨の指輪", slot: "acc", lv: 177, atk: 14, hp: 45, price: 10300, classes: null,
    eDef: { el: "fire", lv: 1 },
    desc: "古竜の指骨を削り出した白い環。骨髄に残った竜の体温がじんわりと巡り、はめた者の血潮を猛らせる。",
    ...sprite([
      "............",
      "....kkk.....",
      "...kwwwk....",
      "..kw.k.wk...",
      "..kw.w.wk...",
      "..kw...wk...",
      "...kw.wk....",
      "....kwk.....",
      ".....k......",
      "............",
      "............",
      "............",
    ]),
  },
  cursedBlade: {
    id: "cursedBlade", name: "妖刀ムラマサ", slot: "weapon", cat: "kt", lv: 175, atk: 152, vit: -12, hit: 9, dice: "2d12+10", swings: 4, align: "悪", cursed: true, price: 0,
    eAtk: { el: "dark", lv: 1 }, classes: null,
    desc: "鞘の中からすすり泣きが聞こえる呪われた刀。凄まじい斬れ味と引き換えに、一度握った者の血を忘れない。攻撃は跳ね上がるが身を守れなくなる。悪属性。",
    ...sprite([
      ".........kp.",
      "........kpk.",
      ".......kpk..",
      "......kpk...",
      ".....kpk....",
      "....kpk.....",
      "...kpk......",
      "..kykk......",
      ".kykk.......",
      "kskk........",
      "ss..........",
      "............",
    ]),
  },

  // ===== 消耗品 =====
  herb: {
    id: "herb", name: "薬草", slot: "use", lv: 1, use: { heal: 30 }, price: 20, classes: null,
    desc: "迷宮の死地にも根づく生命力の強い薬草。噛み潰せば、苦みが傷の熱を奪っていく。HPを30回復する。",
    ...sprite([
      "............",
      ".....GG.....",
      "....GGGG....",
      "...GG.GGk...",
      "..GG.k.Gk...",
      "...GkGGGk...",
      "....GGGk....",
      "....knk.....",
      "....knk.....",
      "....ksk.....",
      "............",
      "............",
    ]),
  },
  antidote: {
    id: "antidote", name: "毒消し草", slot: "use", lv: 1, use: { cure: "poison" }, price: 30, classes: null,
    desc: "死した毒蛇の巣にだけ群生するという解毒草。青臭い汁が血に巡る毒を絡め取る。毒状態を治す。",
    ...sprite([
      "....kk......",
      "...kck......",
      "...kck......",
      "..kGGGk.....",
      "..kGpGk.....",
      "..kpGpk.....",
      "..kGpGk.....",
      "..kpGpk.....",
      "..kGGGk.....",
      "...kkk......",
      "............",
      "............",
    ]),
  },
  manaDrop: {
    id: "manaDrop", name: "マナの雫", slot: "use", lv: 3, use: { mp: 20 }, price: 60, classes: null,
    desc: "地脈の傷口から滲み出した魔力の雫。飲み干せば、冷たい光が喉を伝い落ちていく。MPを20回復する。",
    ...sprite([
      "............",
      "....kk......",
      "...kbk......",
      "...kck......",
      "..kbcbk.....",
      "..kcbck.....",
      ".kbccbck....",
      ".kcbbbck....",
      ".kbccccbk...",
      "..kbbbbk....",
      "...kkkk.....",
      "............",
    ]),
  },
};

// ===== 装備ステータスの単一フォーマット =====
// 装備の性能はすべてフラット値 (atk/vit/… を base に加算)。
// 旧%型 (.pct) は廃止 — 旧セーブの .pct はロード時にテンプレートのフラット値へ
// 戻される (game.js の reflattenItemStats)。

// 属性集計の優先順 (同レベルなら先のものが発現)
const ELEM_ORDER = ["fire", "water", "wind", "earth", "light", "dark"];
// 部位ごとの属性レベル合計から、発現する属性を1つ選ぶ ({el, lv} or null)
// 同属性の装備は加算で重なる (最大Lv2=◎)。異なる属性は混ざらず、最も高いものだけが発現する。
function topElemStat(sums) {
  let best = null;
  for (const el of ELEM_ORDER) {
    const lv = sums[el] || 0;
    if (lv > 0 && (!best || lv > best.lv)) best = { el, lv: Math.min(2, lv) };
  }
  return best;
}

// 六大ステ (ATK/VIT/AGI/INT/PIE/LUK) を base + 装備から再計算
// 装備はフラット型: stat = base + Σflat (atk/vit/…)
export function recalc(member) {
  const base = member.base;
  let flatAtk = 0, flatVit = 0, flatAgi = 0, flatInt = 0, flatPie = 0, flatLuk = 0;
  let flatHp = 0, flatMp = 0, crit = base.crit || 0;
  // %補正 (LR装飾品など)。同種は加算合算 (+20%×2 = +40%)、フラット加算の後に乗算で効く
  const mul = { atk: 0, vit: 0, agi: 0, int: 0, pie: 0, luk: 0, hp: 0, mp: 0 };
  const ea = {}, ed = {};
  const counted = new Set();
  for (const slot of SLOTS) {
    const it = member.equip[slot];
    if (!it || counted.has(it)) continue;
    counted.add(it);
    flatAtk += it.atk || 0;
    flatVit += (it.vit != null ? it.vit : it.def) || 0; // def は旧セーブ互換
    flatAgi += (it.agi != null ? it.agi : it.spd) || 0; // spd は旧セーブ互換
    flatInt += it.int || 0;
    flatPie += it.pie || 0;
    flatLuk += it.luk || 0;
    flatHp  += it.hp || 0;
    flatMp  += it.mp || 0;
    crit += it.crit || 0;
    if (it.mult) for (const k in mul) mul[k] += it.mult[k] || 0;
    if (it.eAtk && it.eAtk.el) ea[it.eAtk.el] = (ea[it.eAtk.el] || 0) + (it.eAtk.lv || 1);
    if (it.eDef && it.eDef.el) ed[it.eDef.el] = (ed[it.eDef.el] || 0) + (it.eDef.lv || 1);
  }
  // 装備による増減は整数化 (増は切り上げ・減は切り下げ)。基礎値はそのまま。
  // %補正があれば (基礎+フラット) に乗じてから整数化する
  const withEquip = (b, f, m) => {
    const baseV = Math.round(b || 0);
    const v = baseV + (f > 0 ? Math.ceil(f) : Math.floor(f));
    return m ? Math.round(v * (1 + m)) : v;
  };
  member.atk = Math.max(1, withEquip(base.atk, flatAtk, mul.atk));
  member.vit = Math.max(0, withEquip(base.vit, flatVit, mul.vit));
  member.agi = Math.max(1, withEquip(base.agi, flatAgi, mul.agi));
  member.int = Math.max(0, withEquip(base.int, flatInt, mul.int));
  member.pie = Math.max(0, withEquip(base.pie, flatPie, mul.pie));
  member.luk = Math.max(0, withEquip(base.luk, flatLuk, mul.luk));
  member.critBonus = crit;
  member.maxhp = withEquip(base.hp, flatHp, mul.hp);
  member.maxmp = withEquip(base.mp, flatMp, mul.mp);
  if (member.hp > member.maxhp) member.hp = member.maxhp;
  if (member.mp > member.maxmp) member.mp = member.maxmp;
  // 属性攻撃/属性防御 (装備由来。Lv1=◯, Lv2=◎)
  member.elemAtk = topElemStat(ea);
  member.elemDef = topElemStat(ed);
  // 旧体系の派生値 (こうげき/ぼうぎょ/すばやさ/AC) は廃止
  delete member.def; delete member.spd; delete member.ac;
}

export function canEquip(member, item) {
  // 未鑑定の品は正体が分からないため装備できない (鑑定が必要)
  if (item.unidentified) return false;
  // 属性制限: 悪の装備は善のキャラに装備できない (逆も同様)
  if (item.align && member.align && item.align !== "中立" && member.align !== "中立" && item.align !== member.align) {
    return false;
  }
  // 明示的職業リスト (専用装備など)
  if (item.classes) return item.classes.includes(member.clsKey);
  // ギアマトリクス (souls.js の JOB_GEAR から注入)
  const gear = _jobGear[member.clsKey];
  if (!gear) return true; // 未登録職業はオープン
  if (item.slot === "weapon") return !gear.weapons || gear.weapons.includes(item.cat);
  if (item.slot === "shield") return !!gear.shield;
  if (item.weight) return (ARMOR_RANK[item.weight] || 0) <= (ARMOR_RANK[gear.armor] || 0);
  return true; // アクセサリ等は全職OK
}

// 装備する (置換した装備品は所持品に戻す)。成否メッセージを返す
export function equip(member, item) {
  if (item.slot === "use") return { ok: false, msg: "それは装備できない" };
  if (!canEquip(member, item)) return { ok: false, msg: `${member.cls}は${item.name}を装備できない` };
  const key = slotKeyFor(item, member);
  if (!key) return { ok: false, msg: "装備できない" };

  // 押し出される装備を先に数え、所持品が8枠を超えるなら装備自体を中止する
  const removed = [];
  if (item.slot === "weapon" && item.twoHanded && member.equip.shield) removed.push(member.equip.shield);
  if (item.slot === "shield" && member.equip.weapon && member.equip.weapon.twoHanded) removed.push(member.equip.weapon);
  if (member.equip[key]) removed.push(member.equip[key]);
  const idx = member.items.indexOf(item);
  const bagAfter = member.items.length - (idx >= 0 ? 1 : 0) + removed.filter((r) => r && r !== item).length;
  if (bagAfter > MAX_ITEMS) return { ok: false, msg: "持ち物がいっぱいで装備を入れ替えられない" };

  // 所持品から取り出し、外した装備を所持品へ戻す
  if (idx >= 0) member.items.splice(idx, 1);
  if (item.slot === "weapon" && item.twoHanded) member.equip.shield = null;
  if (item.slot === "shield" && member.equip.weapon && member.equip.weapon.twoHanded) member.equip.weapon = null;
  member.equip[key] = item;
  for (const r of removed) if (r && r !== item) member.items.push(r);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${item.name} を装備した` };
}

export function unequip(member, key) {
  const it = member.equip[key];
  if (!it) return { ok: false, msg: "" };
  if (it.cursed) return { ok: false, msg: `${it.name}は呪われていて外せない！` };
  if (member.items.length >= MAX_ITEMS) return { ok: false, msg: "持ち物がいっぱいだ" };
  member.equip[key] = null;
  member.items.push(it);
  recalc(member);
  return { ok: true, msg: `${member.name}は ${it.name} を外した` };
}

// 部位アイコン (装備中リストの左側に出す小アイコン)
export const SLOT_ICONS = {
  weapon: sprite(["....k.......", "...kwk......", "...kwk......", "...kwk......", "..kkykk.....", "...knk......", "...ksk......", "............", "............", "............", "............", "............"]),
  body: sprite(["..kkkk......", ".kggggk.....", "kgwggwgk....", "kggwwggk....", ".kgwwgk.....", ".kggwggk....", "..kggwk.....", "..kk.kk.....", "............", "............", "............", "............"]),
  shield: sprite(["..kkkk......", ".kggggk.....", ".kgyygk.....", ".kgyygk.....", ".kggggk.....", "..kggk......", "...kk.......", "............", "............", "............", "............", "............"]),
  head: sprite(["..kkkk......", ".kwggwk.....", ".kwwwwk.....", ".kwkkwk.....", "..kwwk......", "...kk.......", "............", "............", "............", "............", "............", "............"]),
  hands: sprite([".kwk.kwk....", ".kwwkwwk....", ".kwwwwwk....", ".kgwwwgk....", "..kwwwk.....", "..kkkkk.....", "............", "............", "............", "............", "............", "............"]),
  feet: sprite([".kk...kk....", ".kwk..kwk...", ".kwk..kwk...", ".kwwk.kwwk..", ".kwwwkwwwk..", ".kkkkkkkk...", "............", "............", "............", "............", "............", "............"]),
  acc1: sprite(["...kkk......", "..kyyyk.....", ".ky.k.yk....", ".ky.c.yk....", ".ky...yk....", "..ky.yk.....", "...kyk......", "............", "............", "............", "............", "............"]),
  acc2: sprite(["...kkk......", "..kyyyk.....", ".ky.k.yk....", ".ky.c.yk....", ".ky...yk....", "..ky.yk.....", "...kyk......", "............", "............", "............", "............", "............"]),
};
