// 名を知らぬ敵の呼び名 (ウィザードリィの「不確定名」)。
// まだ1体も倒していない魔物は、戦闘の名札・記録・行動順・出来事の文で本当の名の代わりにこの名で呼ぶ
// (「小さく蠢くもの」「動く骨」「鎧の人影」…)。開示の段階は ui/itemview.js の enemyReveal。
// 決め方: UNKNOWN_NAME (id ごとの手書き) → 種族ごとの言葉の手がかり (UNKNOWN_RULES、上から最初に合ったもの)
// → 種族の既定 (UNKNOWN_BY_RACE)。同じ姿の別種が同じ名になるのは本家どおり (見た目しか分からないので)。

// 種族の既定
const UNKNOWN_BY_RACE = {
  amorph: "蠢く粘塊",
  beast: "獣のようなもの",
  wing: "羽ばたく小さなもの",
  avian: "翼あるもの",
  insect: "小さく蠢くもの",
  plant: "蠢く草木",
  aquatic: "水に棲むもの",
  reptile: "鱗あるもの",
  dragon: "竜のようなもの",
  humanoid: "人影",
  giant: "巨大な人影",
  undead: "動く屍",
  specter: "おぼろな影",
  demon: "異形のもの",
  construct: "動く像",
  armored: "鎧の人影",
  elemental: "揺らめくもの",
};

// 種族ごとの言葉の手がかり: [種族 (null = どれでも), 名の正規表現, 呼び名]
const UNKNOWN_RULES = [
  // 群れ
  [["insect"], /群れ|蟲群|群/, "羽音の群れ"],
  [["specter", "elemental"], /群火/, "揺らめく火の群れ"],
  [["avian", "wing"], /群/, "羽ばたく群れ"],
  [["dragon"], /群/, "小さな竜の群れ"],
  [null, /群れ|群体|大群|群霊/, "蠢く群れ"],
  // 不定形
  [["amorph"], /ヒル|長虫/, "這いずる長いもの"],
  [["amorph"], /顎|貪り/, "口を開けた粘塊"],
  [["amorph"], /肉塊/, "脈打つ肉塊"],
  // 虫
  [["insect"], /蜘蛛/, "脚の多いもの"],
  [["insect"], /蛾|バエ|羽虫|蟲群|火の粉|火花/, "羽音を立てるもの"],
  [["insect"], /大蟲|百足|大カマキリ|さそり|甲虫|かまいたち/, "大きく蠢くもの"],
  [["insect"], /繭/, "白い繭のもの"],
  // 獣
  [["beast"], /鼠|ネズミ/, "小さく蠢くもの"],
  [["beast"], /巨獣|深淵獣|大猪|魔獣|原初|キマイラ|闘獣|深淵の獣/, "大きな獣"],
  [["beast"], /狼|犬|猟犬|番犬|山猫|豹|人狼/, "四つ足の獣"],
  // 鳥・翼
  [["avian"], /ハーピー|鳥女王/, "翼ある女"],
  [["avian"], /大鵬|グリフォン|鳳凰|覇王/, "巨大な翼"],
  [["avian"], /鴉|梟|雷鳥/, "黒い鳥影"],
  [["avian"], /蝙蝠/, "羽ばたく小さなもの"],
  // 草木
  [["plant"], /キノコ|胞子|茸/, "蠢く茸"],
  [["plant"], /古木|樹|木霊|巨人|根王|燃え木/, "動く大樹"],
  [["plant"], /魔女|妖魔/, "木陰の女"],
  [["plant"], /花|蔦|茨/, "蠢く蔓"],
  [["plant"], /マンドレイク/, "根の生えたもの"],
  // 水棲
  [["aquatic"], /蟹|エビ/, "殻を持つもの"],
  [["aquatic"], /蛙/, "跳ねるもの"],
  [["aquatic"], /サハギン|魚人|ナーガ|漁り手/, "鱗の人影"],
  [["aquatic"], /ウナギ|鯉|エイ|アンコウ/, "水に潜むもの"],
  [["aquatic"], /触手|鐘鬼|異形/, "ぬめる異形"],
  [["aquatic"], /顎/, "大口を開けたもの"],
  [["aquatic"], /主|母神/, "水底の巨体"],
  // 爬虫
  [["reptile"], /多頭|双首/, "首の多いもの"],
  [["reptile"], /大蛇|蛇/, "這いずる長いもの"],
  [["reptile"], /竜人/, "鱗の人影"],
  [["reptile"], /トカゲ|蜥蜴|サラマンダー/, "這う鱗のもの"],
  // 竜
  [["dragon"], /幼竜|仔|幼体|卵/, "小さな竜の姿"],
  [["dragon"], /蛇|世界蛇/, "長い竜の姿"],
  [["dragon"], /ワイバーン|飛竜|翼ある/, "翼ある竜の姿"],
  [["dragon"], /操霊師/, "おぼろな人影"],
  [["dragon"], /影|残影/, "竜の形の影"],
  // 亜人
  [["humanoid"], /オーク|ホブゴブリン|ゴール|族長|穴蔵の王/, "大柄な人影"],
  [["humanoid"], /コボルド|ゴブリン|小鬼/, "小柄な人影"],
  [["humanoid"], /射手|闘士|舞い手|使い手|槍士/, "武器を持つ人影"],
  [["humanoid"], /呪い手|崇める|織り手|錬金術師|苦行者|神殺し/, "ローブの人影"],
  [["humanoid"], /笛/, "笛を持つ人影"],
  // 巨人
  [["giant"], /トロール|大鬼|オーガ|首切り鬼|鬼将/, "大きな鬼"],
  [["giant"], /ミノタウロス/, "角のある巨体"],
  [["giant"], /サイクロプス/, "一つ目の巨体"],
  // 不死
  [["undead"], /ウジ/, "小さく蠢くもの"],
  [["undead"], /手$/, "這い寄る手"],
  [["undead"], /骨山|ドクロ/, "骨の山"],
  [["undead"], /骨の巨兵|巨兵|百骸/, "骨の巨体"],
  [["undead"], /蝙蝠/, "羽ばたく小さなもの"],
  [["undead"], /屍竜|竜骸/, "骨の竜"],
  [["undead"], /亡骸|骨|骸|白骨/, "動く骨"],
  [["undead"], /術師|リッチ|司祭|祭司|祈り手|教主|神官|唱導師|司教|語り部|大司教/, "ローブの屍"],
  [["undead"], /ヴァンパイア|貴人|王子|王$|廟王|廃王|帝|君主/, "青白い貴人"],
  [["undead"], /聖騎士|兵|隊長|城代|坑監|獄卒|重骸|槍ぶすま/, "武装した屍"],
  [["undead"], /水死体|溺者|藻|沼/, "濡れた屍"],
  [["undead"], /凍|氷|雪/, "凍りついた屍"],
  // 幽鬼
  [["specter"], /まばゆき/, "まばゆい光"],
  [["specter"], /墓火|火$/, "揺らめく火"],
  [["specter"], /魔導書|巻物/, "宙に浮く書"],
  [["specter"], /眼$|石化の眼/, "宙に浮く眼"],
  [["specter"], /蝙蝠/, "羽ばたく小さなもの"],
  [["specter"], /魔女|妖婆|老婆|乙女|女王|聖女|バンシー/, "女の影"],
  [["specter"], /司祭|祈り手|神官|祭主|僧|告解|教主|聖歌隊|賛美歌|竜神官|殉教/, "祈る影"],
  [["specter"], /熾天使|天使|光翼|翼|使徒/, "翼ある影"],
  [["specter"], /騎士|剣闘士|弓|亡霊将|中隊|竜殺し|狩人王|兵|千兵|処刑人|猛獣使い/, "武器を持つ影"],
  [["specter"], /刈|刈人|渡し守|首/, "鎌を持つ影"],
  [["specter"], /もや|瘴気|粉塵|嵐|渦|吹雪|反響|声/, "渦巻く気配"],
  [["specter"], /王|宰相|城主|城代|執政官|先王/, "冠の影"],
  // 悪魔
  [["demon"], /小悪魔|使い魔/, "小さな異形"],
  [["demon"], /番犬/, "燃える四つ足"],
  [["demon"], /天使/, "黒い翼の影"],
  [["demon"], /魔人/, "渦巻く巨影"],
  [["demon"], /獄卒|看守|典獄/, "鍵束を持つ異形"],
  [["demon"], /鬼/, "角のある異形"],
  // 構造体
  [["construct"], /人業|抜け殻/, "動く人形"],
  [["construct"], /銀業|金業/, "光る人形"],
  [["construct"], /魔導書|擬書|書庫|禁書/, "宙に浮く書"],
  [["construct"], /棺|石棺/, "動く棺"],
  [["construct"], /鐘/, "動く大鐘"],
  [["construct"], /鎖/, "蠢く鎖"],
  [["construct"], /蜘蛛|バリスタ|歯車/, "きしむからくり"],
  [["construct"], /面$|死面/, "宙に浮く面"],
  [["construct"], /鍛冶|金床|処女|核|渡し舟/, "動く鉄塊"],
  [["construct"], /決闘者|番兵|門番|番人(?!.*像)|守護者|守り手/, "動く衛兵"],
  [["construct"], /ゴーレム|巨像|巨塊|岩塊|鋳塊|鋳像|くぐつ|暴君/, "動く巨像"],
  [["construct"], /天使|堕天|墓像|神像|偶像|守護像|ガーゴイル/, "動く石像"],
  // 鎧
  [["armored"], /騎手|竜騎兵/, "騎馬の影"],
  [["armored"], /デュラハン/, "首のない鎧"],
  [["armored"], /処刑人/, "斧を持つ鎧"],
  [["armored"], /無人の鎧/, "動く鎧"],
  // 精霊
  [["elemental"], /火|焔|炎|おき|残り火|溶鉱|火刑/, "揺らめく炎"],
  [["elemental"], /吹雪|嵐|氷/, "渦巻く風"],
  [["elemental"], /光球|まばゆき/, "まばゆい光"],
  [["elemental"], /水/, "揺らめく水"],
  [["elemental"], /声/, "姿なき声"],
];

// id ごとの手書き (言葉の手がかりで決めにくいもの)
const UNKNOWN_NAME = {
  bs_sandlurker: "砂の中のもの",
  bs_preservedbeast: "動かぬはずの獣",
  bs_dragonbeast: "鱗のある獣",
  bs_abysshorror: "名状しがたいもの",
  bs_mindeater: "名状しがたいもの",
  bs_cosmicwraith: "名状しがたいもの",
  el_stareater: "名状しがたいもの",
  bs_voidwalker: "おぼろな人影",
  bs_youththief: "おぼろな人影",
  bs_mournfulchancellor: "筆を持つ影",
  bs_wailingnoble: "冠の影",
  bs_frozenchancellor: "かしずく影",
  bs_shadowofthefirst: "おぼろな人影",
  bs_crowdroar: "渦巻く気配",
  bs_spectreaudience: "おぼろな人影の群れ",
  bs_doorwraith: "門前の影",
  bs_soulchain: "蠢く鎖",
  bs_chainoftheworld: "蠢く鎖",
  bs_lightidol: "光る石像",
  bs_soulanchor: "動く石像",
  bs_deathmask: "宙に浮く面",
  bs_lavamaw: "大口を開けたもの",
  bs_fonthorror: "ぬめる異形",
  bs_scaledhorror: "鱗あるもの",
  bs_doombringer: "竜のようなもの",
  bs_voidserpent: "長い竜の姿",
  bs_dragonkin: "鱗の人影",
  el_oremaw: "大きく蠢くもの",
  el_geargod: "きしむからくり",
  el_cinderking: "揺らめく炎",
  // 第6層「沈没神殿」: 祈る霊・像が並ぶので、見た目の違いで呼び分ける
  bs_abyssjelly: "ゆらめく光の傘",
  bs_naga: "蛇の尾の女",
  bs_choirwraith: "歌う影たち",
  bs_tidecaller: "杖を掲げる影",
  bs_goldgolem: "金色の像",
  bs_irongolem: "矛を構える像",
  bs_crystalgolem: "透きとおる巨像",
  bs_divinegolem: "白い巨像",
  bs_fallenangel: "濡れた翼の影",
  bs_shadowdragon: "長い首の竜",
};

// 画面に出すときの不確定名: 正式な名と見分けがつくよう末尾に「？」を添える (「羽ばたく小さなもの？」)。
// 色でも分ける — 記録は UNK_OPEN/UNK_CLOSE で囲んだ所を .unk-name で、戦闘の名札は淡い藤色で描く
export const UNKNOWN_MARK = "？";
export const UNK_OPEN = "\u0003", UNK_CLOSE = "\u0004";
export function unknownLabel(m) { return unknownName(m) + UNKNOWN_MARK; }
// 記録の文に置くとき (色分けの印で囲む)
export function unknownTag(s) { return UNK_OPEN + s + UNK_CLOSE; }
export function unknownName(m) {
  if (!m) return "得体の知れぬもの";
  if (UNKNOWN_NAME[m.id || m.key]) return UNKNOWN_NAME[m.id || m.key];
  const name = String(m.name || "");
  for (const [races, re, unk] of UNKNOWN_RULES) {
    if (races && !races.includes(m.race)) continue;
    if (re.test(name)) return unk;
  }
  return UNKNOWN_BY_RACE[m.race] || "得体の知れぬもの";
}
