// モンスター大全 (bestiary): 全100迷宮で使うモンスターをランク1-10で束ねる。
// ・既存モンスター (cm_/d01-d04) はランクを再配置し、monStats で再ステータス化する
//   (id は append-only: セーブ/図鑑が参照するため改名・削除禁止)
// ・新規モンスターは bs_ 接頭辞。アートは ARTS の原型 × palette/tint で描き分ける
// ・各ランクに通常数体 + ボス1体以上を必ず置く (generator.js が抽選する)
import { defMonsters, monStats, tint, ARTS } from "./schema.js";
import { COMMON_MONSTERS } from "./common.js";
import * as d01 from "./d01.js";
import * as d02 from "./d02.js";
import * as d03 from "./d03.js";
import * as d04 from "./d04.js";

// ---- 既存モンスターのランク再配置 (旧6段階 → 新10段階) ----
const LEGACY_RANK = {
  cm_slime: 1, cm_bat: 1, cm_spider: 1, cm_caverat: 1, d01_kobold: 1,
  d01_skeleton: 2, d01_gaoler: 2,
  d02_armkobold: 2, d02_soldier: 2,
  d02_harpy: 3, d02_imp: 3, d02_lizard: 3, d02_lord: 3,
  d03_orc: 4, d03_ghost: 4, d03_sahagin: 4,
  d03_mandrake: 5, d03_sentinel: 5, d03_whelp: 5,
  d04_golem: 6, d04_ogre: 6,
  d04_revenant: 7, d04_grudge: 7,
  d04_vritra: 9,
};

const LEGACY = { ...COMMON_MONSTERS, ...d01.monsters, ...d02.monsters, ...d03.monsters, ...d04.monsters };
for (const id in LEGACY) {
  const m = LEGACY[id];
  const rank = LEGACY_RANK[id];
  if (!rank) throw new Error("legacy monster missing rank assignment: " + id);
  const s = monStats(rank, m.boss);
  m.rank = rank;
  m.maxhp = m.hp = s.hp;
  m.atk = s.atk; m.def = s.def; m.spd = s.spd;
  m.soul = s.soul; m.gold = s.gold;
}

// ---- 新規モンスター (ランクの穴を埋める + 高ランクの伝説級) ----
// ステータスは defMonsters 通過後に monStats で与える (下の一括処理)
const NEW_DEFS = [
  // -- rank 1 --
  { id: "bs_goblin", name: "ゴブリン", rank: 1, race: "humanoid", element: "none", artKey: "goblin", soulClass: "thief",
    ability: "goldSteal", swift: true, // 素早い身のこなしで懐を狙う
    desc: "迷宮の浅瀬に巣食う緑肌の小鬼。賢くはないが、罠の在処と人の急所、そして財布の場所だけはよく憶えている。すばしこく間合いに飛び込み、金品をかすめ取って逃げる。" },
  { id: "bs_slimeking", name: "ジャイアントスライム", rank: 1, boss: true, race: "amorph", element: "water", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#3a6ad0", 0.3),
    desc: "幾百の粘塊が呑み合い、ひとつに膨れ上がった巨大な王。呑まれた者の得物が、半透明の体内に何本も沈んでいる。" },
  // -- rank 2 --
  { id: "bs_zombie", name: "腐乱死体", rank: 2, race: "undead", element: "dark", artKey: "zombie",
    ability: "poison", regen: 0.05, // 腐肉の毒をうつし、裂いた傷もすぐ膿んで塞がる
    desc: "土に還ることを許されなかった亡骸。腐汁の滴る腕で生者を掴み、己と同じ地獄へ引きずり込もうとする。腐った肉は斬られてもじわじわと膿んで塞がり、その爪には腐敗の毒が宿る。" },
  { id: "bs_direwolf", name: "灰色の大狼", rank: 2, race: "beast", element: "none", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#9aa3ab", 0.35),
    swift: true, // 出口を断つ速さで間合いを詰める
    desc: "群れを失い、迷宮を新たな狩場に選んだ大狼。遠吠えは出口の方角から聞こえる。帰り道を断つためだ。風のように間合いを詰め、たいてい先手を奪う。" },
  { id: "bs_goblinchief", name: "ゴブリンの族長", rank: 2, boss: true, race: "humanoid", element: "fire", artKey: "gobchief", soulClass: "fighter",
    palette: tint(ARTS.gobchief.palette, "#c04a3a", 0.22),
    role: "summoner", summonKey: "bs_goblin", ability: "goldSteal", // 配下を盾に呼び、混乱に乗じて奪う
    desc: "屍から剥いだ鎧を勲章のように重ね着た、ゴブリンどもの長。配下を盾に、戦利品の山の上から戦を眺める。形勢が傾けば甲高い号令で新手のゴブリンを呼び寄せ、その隙に懐を狙う。" },
  // -- rank 3 --
  { id: "bs_werewolf", name: "人狼", rank: 3, race: "beast", element: "dark", artKey: "werewolf", soulClass: "fighter",
    regen: 0.08, swift: true, // 月の獣の治癒力 + 跳びかかる俊足
    desc: "月のない迷宮の闇でこそ獣性が猛る呪われた人。引き裂いた相手の悲鳴で、わずかに残った人の心が軋む。負わせた傷もろとも、己の傷もみるみる塞がっていく。" },
  { id: "bs_scorpion", name: "鉄ばさみの毒さそり", rank: 3, race: "insect", element: "earth", artKey: "scorpion",
    ability: "poison", physResist: 0.5, // 心臓を灼く毒針 + 鎧のような甲殻
    desc: "鎧の継ぎ目を断ち切るはさみと、心の臓を直に灼く尾針を併せ持つ大さそり。乾いた床を擦る音が死の予鈴となる。分厚い甲殻は刃をろくに通さない。" },
  // -- rank 4 --
  { id: "bs_gargoyle", name: "ガーゴイル", rank: 4, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#4a4a5a", 0.3),
    desc: "聖堂の軒先で魔を払っていた石像の成れの果て。守るべき聖域を失い、今は止まり木に来るものすべてを払う。" },
  { id: "bs_banshee", name: "バンシー", rank: 4, race: "specter", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#9b59b6", 0.35),
    desc: "死を報せる泣き女の霊。その絶叫を聞いた者は、自分の葬列の足音が背後から近づいてくるのを聞く。" },
  { id: "bs_minotaur", name: "ミノタウロス", rank: 4, boss: true, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#7a4a2a", 0.3),
    desc: "迷路の中心で生贄を待ち続けた牛頭の巨人。捧げられる者が絶えて久しく、自ら狩りに出ることを覚えた。" },
  // -- rank 5 --
  { id: "bs_troll", name: "トロール", rank: 5, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#4a8a3a", 0.35),
    desc: "裂かれた傷がみるみる塞がる再生の巨人。火で灼かれた痕だけが、こいつの体に古傷として残っている。" },
  { id: "bs_dullahan", name: "デュラハン", rank: 5, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#2a2a3a", 0.35),
    desc: "首を失ってなお戦場を求める黒鎧の騎士。小脇に抱えた己の首が、斬るべき相手の名を囁いて教える。" },
  { id: "bs_salamander", name: "サラマンダー", rank: 5, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#d04a2a", 0.4),
    desc: "溶岩の川を寝床とする火トカゲ。鱗の隙間から覗く体内はおき火の色で、噛み傷は永く焼け続けるという。" },
  // -- rank 6 --
  { id: "bs_chimera", name: "キマイラ", rank: 6, race: "beast", element: "fire", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#c04a3a", 0.3),
    desc: "獅子と山羊と毒蛇を縫い合わせた禁忌の合成獣。三つの頭は互いを憎みながら、獲物の前でだけ一つになる。" },
  { id: "bs_wyvern", name: "ワイバーン", rank: 6, race: "dragon", element: "wind", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#3a8a5a", 0.35),
    desc: "竜の血が薄れた代わりに翼を肥らせた飛竜。風切り音が聞こえた時には、尾の毒針はもう振り下ろされている。" },
  { id: "bs_cyclops", name: "サイクロプス", rank: 6, boss: true, race: "giant", element: "none", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#8a8a9a", 0.3),
    desc: "単眼の巨人。神々の炉で雷を鍛えたという腕は、いま岩柱を棍棒代わりに迷宮の柱ごと侵入者を薙ぐ。" },
  // -- rank 7 --
  { id: "bs_griffon", name: "グリフォン", rank: 7, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c8a23a", 0.35),
    desc: "鷲の眼と獅子の体を併せ持つ空の王。黄金を巣に敷く習性ゆえ、財宝の眠る迷宮を縄張りに選んだ。" },
  { id: "bs_naga", name: "ナーガ", rank: 7, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#7a4aa0", 0.35),
    desc: "下半身が大蛇と化した蛇神の眷属。千年の祈りを捧げた古い祭壇を、今も鱗のねぐらで抱え込んでいる。" },
  { id: "bs_vampire", name: "ヴァンパイア", rank: 7, race: "undead", element: "dark", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#a02a3a", 0.35),
    desc: "夜の貴族。血をすするのは渇きのためではなく、奪った命の記憶を味わうためだという。月夜には誰も敵わない。" },
  { id: "bs_hydra", name: "九首のヒュドラ", rank: 7, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#2a6a9a", 0.35),
    desc: "ひとつ落とせばふたつ生える九つ首の毒蛇竜。退治の英雄譚は数あれど、骸を見た者はひとりもいない。" },
  // -- rank 8 --
  { id: "bs_demon", name: "獄炎のデーモン", rank: 8, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#6a1a1a", 0.3),
    desc: "地獄の位階に名を連ねる上級魔。その体は燃え続ける憎悪そのもので、足跡には硫黄の火が残る。" },
  { id: "bs_irongolem", name: "アイアンゴーレム", rank: 8, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#7a7a8a", 0.35),
    desc: "千の武具を鋳潰して造られた鋼鉄の巨人。胸の奥では、素材にされた剣たちの未練が今も軋み続けている。" },
  { id: "bs_necromancer", name: "死霊術師", rank: 8, race: "undead", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#4a8a4a", 0.35),
    desc: "死を窮め、自ら死者となった術師。従える骸の軍勢はみな、かつてこの男を討ちに来た者たちだ。" },
  { id: "bs_archdemon", name: "アークデーモン", rank: 8, boss: true, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#2a1a3a", 0.35),
    desc: "魔界の軍団を率いる大公。契約の口上は蜜のように甘く、署名した王国がどうなったかは地図が知っている。" },
  // -- rank 9 --
  { id: "bs_elderlich", name: "エルダーリッチ", rank: 9, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#7a4aa0", 0.4),
    desc: "幾つもの王朝の興亡を骨の玉座から眺めてきた大死霊。魂を七つに裂いて隠したといい、死がこの者を裁けない。" },
  { id: "bs_fallenangel", name: "堕天使", rank: 9, race: "demon", element: "light", artKey: "harpy", soulClass: "priest",
    palette: tint(ARTS.harpy.palette, "#e8e8f4", 0.4),
    desc: "天を逐われてなお光をまとう、哀しき翼。祝福の言葉を逆さに唱え、祈るような手つきで生者を裁く。" },
  { id: "bs_doomknight", name: "冥府の騎士", rank: 9, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#6a1a2a", 0.35),
    desc: "冥府の門を守ると誓った騎士の末路。その剣に斬られた者は傷ではなく、生きる理由を失って倒れる。" },
  // -- rank 10 --
  { id: "bs_voiddragon", name: "虚無竜", rank: 10, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a1a2a", 0.45),
    desc: "星々の隙間の何もない場所から迷い込んだ竜。その鱗は光を返さず、咆哮は音ではなく静寂として届く。" },
  { id: "bs_seraphwraith", name: "終末の使徒", rank: 10, race: "specter", element: "light", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#e8e2c0", 0.4),
    desc: "世界の終わりを告げるために遣わされたという白い影。ラッパは携えていない。もう吹き終えたのかもしれない。" },
  { id: "bs_chaosknight", name: "混沌の騎士", rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#7a2a8a", 0.4),
    desc: "百の戦場で百の主君に仕え、そのすべてを裏切った剣鬼。鎧の下にあるのが人なのか、誰も確かめていない。" },
  { id: "bs_reddragon", name: "レッドドラゴン", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    desc: "灼熱の血を巡らせる竜の中の竜。その吐息は城壁を飴のように溶かし、財宝の山をしとねに千年を眠る。竜殺しを名乗りたくば、まずこの焔の前に立て。" },
  { id: "bs_abysslord", name: "深淵の王", rank: 10, boss: true, race: "demon", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#c8a23a", 0.4),
    desc: "百層の迷宮、そのすべての闇が流れ着く玉座に座す者。迷宮で果てた魂はみな、この王の冠の飾りになるという。" },
  // ---- 各ランクの新規通常モンスター (各ランク10体確保のための追加分) ----
  // -- rank 1 追加 (+4) --
  { id: "bs_mudbeetle", name: "泥甲虫", rank: 1, race: "insect", element: "earth", artKey: "beetle",
    physResist: 0.6, ability: "poison", // 鎧のような甲羅 (物理耐性) + 毒液
    desc: "湿った地下の通路を這い回る硬殻の甲虫。踏みつけても鎧のような甲羅が足を跳ね返し、刃もろくに通らない。隙を見て指の隙間から毒液を染み込ませてくる。" },
  { id: "bs_drainrat", name: "溝鼠", rank: 1, race: "beast", element: "none", artKey: "rat",
    swift: true, pack: true, // 素早い群れ
    desc: "下水と骸の悪臭に慣れきった大鼠。小賢しく群れをなして素早く駆け回り、眠った者の耳や指から順にかじり始める。" },
  { id: "bs_shroomspirit", name: "毒キノコの魔", rank: 1, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#9a3a7a", 0.4),
    ability: "poison", regen: 0.06, // 毒胞子 + 菌糸の再生
    desc: "地下墓地の湿気を糧に育った毒キノコの化身。胞子を吸った者は幻を見ながら眠り続ける。傘を裂いても菌糸からみるみる再生し、なかなか枯れない。" },
  { id: "bs_bonebat", name: "骸蝙蝠", rank: 1, race: "undead", element: "dark", artKey: "bonebat",
    magWeak: 1.6, evasive: true, // 脆い骨 (魔法弱点) + 不規則な飛行 (回避)
    desc: "死した蝙蝠の骨が呪いで再び飛び回る亡者。不規則にひらめいて刃をかわすが、脆い骨は魔法の一撃で容易く砕け散る。羽ばたくたびに散る骨粉が、吸い込んだ者の肺を内から蝕む。" },
  // -- rank 2 追加 (+5) --
  { id: "bs_shadowhound", name: "影犬", rank: 2, race: "beast", element: "dark", artKey: "hound",
    evasive: true, // 影に紛れて刃をすり抜ける
    desc: "坑道の影が犬の形を借りた呪いの獣。光を持つ者に噛みつき、その光ごと奪い去る。影と一体になって刃をすり抜け、暗闇の中でだけ、赤い目が輝く。" },
  { id: "bs_gnoll", name: "ゴール", rank: 2, race: "humanoid", element: "earth", artKey: "gnoll", soulClass: "fighter",
    pack: true, // ハイエナの習いで群れて襲う
    desc: "ハイエナの顎を持つ異形の戦士。骨ごと噛み砕く噛む力を誇り、迷宮で死んだ者の装備を剥いで身につける。一頭では狡猾に間合いを計り、数が揃えば一斉に喉笛へ飛びかかる。" },
  { id: "bs_spiritbat", name: "霊蝙蝠", rank: 2, race: "specter", element: "dark", artKey: "bat",
    palette: tint(ARTS.bat.palette, "#5a2a8a", 0.4),
    ability: "paralyze", // 体温を奪う冷たい牙で痺れさせる
    desc: "坑道の亡霊が蝙蝠の形を借りた霊体。噛まれた箇所は寒気を帯び、体温を奪われた者から順に意識が遠のき、やがて手足が痺れて動かなくなる。" },
  { id: "bs_hobgoblin", name: "ホブゴブリン", rank: 2, race: "humanoid", element: "none", artKey: "goblin", soulClass: "thief",
    palette: tint(ARTS.goblin.palette, "#6a4a1a", 0.35),
    swift: true, ability: "goldSteal", // 退路を断つ奇襲で財布を奪う
    desc: "ゴブリンの中でも知恵と体格に恵まれた上位種。仲間をおとりに使い、退路を断った上で奇襲するのを好む。一足飛びに懐へ踏み込み、得物より先に財布をかすめ取る。" },
  { id: "bs_swampslime", name: "毒沼スライム", rank: 2, race: "amorph", element: "earth", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#4a8a2a", 0.4),
    physResist: 0.5, ability: "poison", // 粘体ゆえ刃が通らず、鉱毒を傷へ流し込む
    desc: "鉱毒を溶かし込んだ粘塊。刃を突き立てても潰れて寄り集まり、触れた武器を緑色に染める。その毒が傷口から血液へと溶け込む。迷宮の床が緑色なら、すでに領域だ。" },
  // -- rank 3 追加 (+5) --
  { id: "bs_darkelf", name: "闇の射手", rank: 3, race: "humanoid", element: "dark", artKey: "darkelf", soulClass: "thief",
    ability: "poison", evasive: true, // 腐敗を呼ぶ呪い矢 + 身軽な射手
    desc: "光を嫌い廃砦の奥に巣食う弓の使い手。暗闇でも正確に射る矢は呪いで染まり、刺さった先から腐敗が広がる。身軽に物陰を渡り歩き、矢を放つや影に溶けて消える。" },
  { id: "bs_poisonspider", name: "毒蜘蛛", rank: 3, race: "insect", element: "earth", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#2a6a2a", 0.45),
    ability: "paralyze", evasive: true, // 毒牙で麻痺させてから巻く + 糸を伝って身をかわす
    desc: "砦の天井に巣を張り、人が通るのをじっと待ち続ける大蜘蛛。毒の牙で獲物を麻痺させてから、蜘蛛糸で巻いて食料庫へ運ぶ。糸を伝って跳ね、振るう刃を軽々とかわす。" },
  { id: "bs_waterelemental", name: "水の精霊", rank: 3, race: "elemental", element: "water", artKey: "waterelemental",
    physResist: 0.55, regen: 0.1, // 斬れば水に戻り、水は再び形を結ぶ
    desc: "砦跡の地下水脈に宿った水の精霊。人の形を模して歩くが、斬れば水に戻り、水に戻れば再び形を結ぶ。刃も槍もその身を通り抜けるばかりで、崩れた形は瞬く間に流れ集まって元に戻る。" },
  { id: "bs_marshgolem", name: "泥のゴーレム", rank: 3, race: "construct", element: "earth", artKey: "marshgolem",
    ability: "poison", regen: 0.08, // 腐臭の泥 + 泥はすぐに盛り直す
    desc: "廃砦跡の湿地に積もった泥が、呪文の残りかすを吸って動き出したゴーレム。動くたびに腐臭をまき散らし、跡には沼の跡が残る。崩した泥もすぐに本体へ吸い寄せられ、盛り直されてしまう。" },
  { id: "bs_hexwolf", name: "呪詛の狼", rank: 3, race: "beast", element: "dark", artKey: "hexwolf",
    magWeak: 1.5, swift: true, // 脆い呪骸 (魔法弱点) + 死してなお止まらぬ俊足
    desc: "呪詛の言葉を刻まれ、死してなお走り続ける狼の亡骸。噛まれた傷は癒えず、噛まれた者は夢の中で追われ続ける。脆い呪骸は俊敏だが、術の一撃には脆く崩れる。" },
  // -- rank 4 追加 (+5) --
  { id: "bs_darksamurai", name: "黒甲の武者", rank: 4, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#3a2a2a", 0.45),
    desc: "敗れた戦国の武者が憎しみのまま霧の森をさまよう亡霊の騎士。主の敵を誰にでも重ね、抜刀は一瞬、納刀を知らない。" },
  { id: "bs_cultist", name: "邪神の僧", rank: 4, race: "specter", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#5a3a5a", 0.4),
    desc: "禁忌の神をまつり命を捧げた僧侶の亡霊。神に近づくために捨てたものを、今も取り戻そうとするように手を伸ばしてくる。" },
  { id: "bs_stonegorgon", name: "石化の眼", rank: 4, race: "specter", element: "earth", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#8a7a6a", 0.4),
    desc: "ゴルゴンの血を引く蛇髪の霊。その眼を直視した者の皮膚が石灰色に固まり始め、完全に石化するまで意識だけが残るという。" },
  { id: "bs_deepsahagin", name: "深海魚人", rank: 4, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#1a3a5a", 0.5),
    desc: "神殿の地下水脈の最深部に棲む魚人の変種。目が退化し、代わりに僅かな水流の乱れで獲物の位置を感知する。" },
  { id: "bs_bloodorc", name: "血狂いのオーク", rank: 4, race: "humanoid", element: "fire", artKey: "orc", soulClass: "fighter",
    palette: tint(ARTS.orc.palette, "#8a2a1a", 0.45),
    desc: "血の匂いで理性を失うオークの変異体。傷を負うほど凶暴さが増し、自分の傷口まで噛んで己を鼓舞する。" },
  // -- rank 5 追加 (+5) --
  { id: "bs_ironknight", name: "鉄の騎士", rank: 5, race: "armored", element: "none", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#6a6a7a", 0.35),
    desc: "古代神殿を守るために鋳造された鉄の自動人形。命令のみで動き、千年の時を経た今もその命令を忠実に実行し続ける。" },
  { id: "bs_thunderbird", name: "雷鳥", rank: 5, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#d4d44a", 0.4),
    desc: "嵐の中でのみ現れる雷光の鳥。羽ばたきのたびに稲光が走り、その翼に触れた者は心の臓まで焼かれると伝えられる。" },
  { id: "bs_deepgolem", name: "大地のゴーレム", rank: 5, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#4a3a2a", 0.5),
    desc: "神殿の基礎石が何百年もの呪文の蓄積で自ら動き始めた古代ゴーレム。一歩踏み出すたびに床が割れ、壁が崩れる。" },
  { id: "bs_shadowmage", name: "影の術師", rank: 5, race: "undead", element: "dark", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#2a2a5a", 0.5),
    desc: "禁呪に魂を喰われた術師の残りかす。肉体は消え失せ、影だけが術を唱え続ける。召喚した闇の眷属は術師と共に消えない。" },
  { id: "bs_fireserpent", name: "炎の大蛇", rank: 5, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#c03a1a", 0.5),
    desc: "溶岩の流れを住処とする巨大な炎の大蛇。鱗の一枚一枚が炉の断片で、皮膚に触れただけで焼き付いて離れない。" },
  // -- rank 6 追加 (+6) --
  { id: "bs_darkdrake", name: "暗竜", rank: 6, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#2a1a3a", 0.5),
    desc: "竜の血脈が呪いで変質した漆黒の小竜。吐く息は火でなく影であり、影に包まれた者はやがて自分の輪郭を失う。" },
  { id: "bs_bloodwraith", name: "血霊", rank: 6, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#8a1a2a", 0.45),
    desc: "溶岩洞で大量の血が流された場所に生まれた血の亡霊。触れられた者の血が傷口から引き出され、霊体の一部になる。" },
  { id: "bs_stormgiant", name: "嵐の巨人", rank: 6, race: "giant", element: "wind", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#4a5a6a", 0.4),
    desc: "嵐の日にのみ地上に降りてくる雷雲を纏う巨人。一歩ごとに地響きがし、振り下ろす拳は落雷を伴う。" },
  { id: "bs_bonecolossus", name: "骨の巨兵", rank: 6, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8c0a0", 0.3),
    desc: "幾十の骸が呪力で融合し立ち上がった巨大な骨の兵。その胴の中には今も生者の叫び声が閉じ込められているという。" },
  { id: "bs_ashphoenix", name: "灰の鳳凰", rank: 6, race: "avian", element: "fire", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c85a2a", 0.45),
    desc: "溶岩洞の奥に棲む、再生しない鳳凰。かつて不死を誇ったが呪いで再生を失い、今は最後の炎を奪われまいと燃え続ける。" },
  { id: "bs_steelspider", name: "鋼蜘蛛", rank: 6, race: "construct", element: "none", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#8a9aaa", 0.4),
    desc: "古代の錬金術師が造った鉄製の機械蜘蛛。溶岩に落ちても溶けずに動き続け、絹より細く鋼より強い糸で罠を張る。" },
  // -- rank 7 追加 (+5) --
  { id: "bs_shadowdragon", name: "影竜", rank: 7, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a2a3a", 0.6),
    desc: "氷河の奥深くに封じられていた古い竜の影。実体を持たず、あらゆる刃を通し抜けるが、魂に直接爪を立てることができる。" },
  { id: "bs_stormwyvern", name: "嵐のワイバーン", rank: 7, race: "dragon", element: "wind", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#3a5a8a", 0.4),
    desc: "嵐の中を悠々と飛ぶ嵐竜の亜種。翼を一振りするだけで暴風が起こり、その羽根は雷避けの護符になるという。" },
  { id: "bs_goldgolem", name: "黄金のゴーレム", rank: 7, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#c8a040", 0.4),
    desc: "竜の財宝の守護として作られた黄金の巨人。近づく者を宝に対する脅威と見なし、財宝の山の上に直立したまま戦う。" },
  { id: "bs_soulharvester", name: "魂刈り", rank: 7, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#3a3a5a", 0.5),
    desc: "迷宮で死んだ者の魂を回収する役割を帯びた存在。鎌の一振りで肉体と魂の繋がりを断ち、刈り取った魂は籠に集める。" },
  { id: "bs_thunderknight", name: "雷電の騎士", rank: 7, race: "armored", element: "wind", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#4a6a9a", 0.4),
    desc: "嵐の神殿に仕えた騎士の怨霊。落雷を身に纏い、金属鎧の者ほど電撃が深く通る。雷鳴とともに現れ、次の雷鳴で消える。" },
  // -- rank 8 追加 (+7) --
  { id: "bs_hellhound", name: "地獄の番犬", rank: 8, race: "demon", element: "fire", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#8a1a1a", 0.5),
    desc: "冥府の番人として鍛えられた炎を吐く巨大な犬。鎖は切られても鎖の跡が首に残り、その鎖の先には今も冥府がある。" },
  { id: "bs_darkliege", name: "冥府の将", rank: 8, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#4a1a4a", 0.5),
    desc: "生前は英雄であったが、死後に冥府の軍を率いる将軍となった者。部下の魂を鎧の中に縫い込み、その嘆きが鎧を硬くする。" },
  { id: "bs_voidwalker", name: "虚無の歩者", rank: 8, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#0a0a1a", 0.6),
    desc: "存在と無の狭間を歩く者。物理的な攻撃の半分が虚空に消え、その手が触れた者の記憶が一枚ずつ剥がれていく。" },
  { id: "bs_plaguewraith", name: "疫病の亡霊", rank: 8, race: "undead", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#3a5a2a", 0.5),
    desc: "大疫病で死んだ者たちが一つに溶け合った亡霊の群れ。そのもやに触れた者はたちまち高熱に侵され、三日三晩うなされる。" },
  { id: "bs_crystalgolem", name: "水晶のゴーレム", rank: 8, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#9abfdf", 0.4),
    desc: "尖塔の心核を守るために結晶が自己組織化した透明のゴーレム。打撃を吸収して逆に解放する性質があり、力づくでは砕けない。" },
  { id: "bs_dreadlich", name: "嘆きのリッチ", rank: 8, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#5a2a7a", 0.45),
    desc: "魂を複数の宝珠に分けて隠した古代の死霊術師の上位種。その嘆きは宝珠の在処を知らせる声であり、聴いた者は宝珠を探さずにいられない。" },
  { id: "bs_shadowogre", name: "影の大鬼", rank: 8, race: "giant", element: "dark", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#2a2a4a", 0.55),
    desc: "嵐の尖塔の影が凝縮して生まれた鬼の巨体。その拳が落ちた場所に影の穴が開き、穴の中から更なる影の腕が伸びてくる。" },
  // -- rank 9 追加 (+7) --
  { id: "bs_voidknight", name: "虚無の騎士", rank: 9, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#1a1a2a", 0.6),
    desc: "冥府の門を守護する騎士の中で、存在そのものが消えかかった最古参。その剣が触れた場所は、現実の布地に穴を開ける。" },
  { id: "bs_apocalypsedrake", name: "終末の竜", rank: 9, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#3a1a4a", 0.5),
    desc: "終末の予言書に記された竜。世界の終わりに先立って現れると言われ、その吐息が触れた大地は二度と命を育まない。" },
  { id: "bs_soulreaper", name: "魂の刈人", rank: 9, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#5a0a0a", 0.5),
    desc: "冥府の正規の従者として魂を刈る役目を持つ上位の霊。迷宮で死を迎えた者には必ず現れ、魂が逃げないよう懐に包む。" },
  { id: "bs_plaguelich", name: "疫病のリッチ", rank: 9, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#2a5a2a", 0.5),
    desc: "疫病を武器として研究し続けた術師の死霊。指から滴る液は千の病の混合物で、触れた者は己の体が何に侵されているかも分からない。" },
  { id: "bs_divinegolem", name: "神のくぐつ", rank: 9, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e0d0a0", 0.4),
    desc: "神が最後の審判のために造った審判のくぐつ。罪なき者には手を出さないが、迷宮に踏み込んだ時点で全員を罪ある者と判定する。" },
  { id: "bs_shadowseraph", name: "堕ちた光翼", rank: 9, race: "specter", element: "dark", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#4a4a6a", 0.5),
    desc: "天から追われた後も光の翼を持つ存在。その翼の光は既に腐り始めており、触れた者の魂の善性を少しずつ溶かしていく。" },
  { id: "bs_infernaltyrant", name: "獄炎の暴君", rank: 9, race: "demon", element: "fire", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#8a2a0a", 0.5),
    desc: "地獄の最深層を統べる炎の悪魔の将。踏みつけた大地が溶岩に変わり、拳で叩き潰した者の魂が炎の中に閉じ込められる。" },
  // -- rank 10 追加 (+7) --
  { id: "bs_eternallord", name: "永劫の魔将", rank: 10, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#3a0a3a", 0.5),
    desc: "時間の概念を超えて存在する上位魔。過去も未来も同時に見ており、相手が次に何をするかを常に知っている。対策の立てようがない。" },
  { id: "bs_abysswarden", name: "深淵の番人", rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#0a1a2a", 0.6),
    desc: "迷宮の最深部への通路を守り続ける不滅の番人。既に何千もの挑戦者を退けており、その鎧には彼らの名が刻まれている。" },
  { id: "bs_cosmicwraith", name: "宇宙の亡霊", rank: 10, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#0a0a2a", 0.7),
    desc: "星々の間の冷たい虚空から迷い込んだ宇宙的な霊体。その目が向いた先の空気が消え、覗き込んだ者は宇宙の孤独に溺れる。" },
  { id: "bs_godslayer", name: "神殺し", rank: 10, race: "humanoid", element: "dark", artKey: "orc", soulClass: "fighter",
    palette: tint(ARTS.orc.palette, "#2a0a0a", 0.6),
    desc: "神を三柱殺した後、自らも神に近い存在へと変質した剣士。弱い神は殺すことで取り込み、強い神は挑戦することで楽しむ。" },
  { id: "bs_voidcolossus", name: "虚無の巨人", rank: 10, race: "giant", element: "dark", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#0a0a1a", 0.65),
    desc: "宇宙の虚無が巨人の形を借りて顕現した存在。その体積は全て無であり、触れた物が物理的に消滅する。存在への反論だ。" },
  { id: "bs_primalserpent", name: "原初の大蛇", rank: 10, race: "reptile", element: "dark", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#1a1a2a", 0.6),
    desc: "世界が生まれる前から存在していたという太古の大蛇。その鱗一枚が世界の歴史の一ページを刻んでおり、倒してもそれは消えない。" },
  { id: "bs_doombringer", name: "終焉の使者", rank: 10, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#5a1a0a", 0.55),
    desc: "世界の終わりを告げるために遣わされた炎の竜。その到来は終わりの始まりではなく終わりそのものであり、吐き出す炎は星すら焼く。" },

  // ==== 迷宮固有ボス (全100迷宮にひとりずつ。割り当ては BOSS_ORDER) ====
  // -- rank 1 (迷宮1-10: 地下墓地帯) --
  { id: "bs_cryptabbot", name: "骸の修道院長", rank: 1, boss: true, race: "undead", element: "dark", artKey: "skeleton", soulClass: "priest",
    palette: tint(ARTS.skeleton.palette, "#8a7a4a", 0.3),
    ability: null, role: "summoner", summonKey: "d01_skeleton", regen: 0.05, // 死者を呼び、自らも朽ちない
    desc: "墓域の祈祷堂で祈りの姿のまま朽ちた院長。死してなお埋葬の祈祷を唱え、眠る亡骸を呼び起こして侍らせる。砕いても祈りが骨を継ぎ直し、なかなか沈黙しない。" },
  { id: "bs_whispercollector", name: "囁きの蒐集者", rank: 1, boss: true, race: "specter", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#6a5a8a", 0.35),
    ability: "paralyze", swift: true, // 縛る囁き + 影のような速さ
    desc: "回廊に染みついた死者の囁きを集め、声だけで形を成した影。音もなく素早く間合いを詰め、臨終の言葉を耳元で再生して聞いた者の体を縛りつける。" },
  { id: "bs_bloodcoffin", name: "血濡れの石棺", rank: 1, boss: true, race: "construct", element: "dark", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#6a2a2a", 0.4),
    ability: null, physResist: 0.6, regen: 0.06, // 頑強な石棺 (物理耐性) + 血を吸って塞がる
    desc: "幾百の生贄の血を吸い続けた埋葬の間の石棺。分厚い石の蓋は刃を弾き、傷つけてもなお滴る血を吸って亀裂を塞いでいく。中身はもう、誰も覚えていない。" },
  { id: "bs_ossuarygiant", name: "骨壁の大鬼", rank: 1, boss: true, race: "giant", element: "none", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#c8c0a0", 0.35),
    desc: "穴蔵の骨壁を喰らい、砕いた骨を己の体に継ぎ足して肥え太った大鬼。壁の骨が減るたび、奴の背がまたひとつ高くなる。" },
  { id: "bs_ashprelate", name: "燃え殻の司祭", rank: 1, boss: true, race: "specter", element: "fire", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#c85a2a", 0.35),
    desc: "礼拝堂もろとも焼かれた司祭の残り火。灰の説教壇で燃え尽きない説法を続け、訪れた者を「次の蝋燭」として祭壇に立たせようとする。" },
  { id: "bs_welldweller", name: "古井の主", rank: 1, boss: true, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#1a4a5a", 0.4),
    desc: "底知れぬ古井戸の暗がりで、落ちてくるものだけを喰って肥えた何か。釣瓶の縄が時おり引かれるのは、井戸の底から誘っているのだ。" },
  { id: "bs_chainwarden", name: "鎖縛りの獄卒", rank: 1, boss: true, race: "undead", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#4a4a52", 0.3),
    desc: "呪われた地下牢で囚人ごと鎖に呑まれた獄卒長。全身に巻きついた鎖の先には今も空の枷がぶら下がり、新しい囚人の手首を探している。" },
  { id: "bs_sarcophaguslord", name: "石棺の王", rank: 1, boss: true, race: "undead", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#b09a6a", 0.35),
    desc: "黄昏の廟の最奥で、石棺そのものを玉座に変えた古王。棺の蓋を鎧のように纏い、己の眠りを妨げた者へ石の重みで応える。" },
  { id: "bs_boneemperor", name: "百骸の帝", rank: 1, boss: true, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#e8c24a", 0.3),
    desc: "果てなき骸の迷路の中心で、幾百の骸を束ねて冠とした帝。迷宮に散らばる骨はすべて、この帝の玉体の続きだという。" },
  // -- rank 2 (迷宮11-20: 廃坑帯) --
  { id: "bs_foremanwraith", name: "坑夫頭の亡霊", rank: 2, boss: true, race: "specter", element: "dark", artKey: "wraith", soulClass: "fighter",
    palette: tint(ARTS.wraith.palette, "#5a6a7a", 0.35),
    ability: "paralyze", // 点呼の声で立ちすくませる
    desc: "落盤の朝も持ち場を離れなかった坑夫頭の亡霊。今も配下の亡霊たちに鶴嘴を振らせ、点呼に応えない者を坑道の闇へ連れて行く。その点呼の声を聞いた者は、答えようとして体が凍りつく。" },
  { id: "bs_bonecollier", name: "骨の坑夫長", rank: 2, boss: true, race: "undead", element: "earth", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#7a6a4a", 0.35),
    regen: 0.07, // 砕けた骨を律儀に拾い継ぐ
    desc: "骨道を今も掘り進める坑夫どもの長。掘り当てた鉱脈ではなく、掘り当てた仲間の骨を律儀に並べ直しては、また掘る。砕いても落ちた骨を拾い集めて継ぎ直し、なかなか倒れない。" },
  { id: "bs_saltcolossus", name: "岩塩の巨像", rank: 2, boss: true, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#d8d8e2", 0.4),
    physResist: 0.5, // 分厚い塩の巨体が刃を弾く
    desc: "坑夫たちが安全を祈って岩塩から彫り出した守り神。坑道が見捨てられた日から祈りは呪いに転じ、塩の巨体は侵入者だけを守りに来る。分厚い結晶の体は刃をほとんど通さない。" },
  { id: "bs_frostmaggot", name: "凍坑の大蟲", rank: 2, boss: true, race: "insect", element: "water", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#9fc0d8", 0.4),
    ability: "paralyze", // 冷気で凍てつかせ動きを止める
    desc: "凍てついた炭坑の底で氷ごと石炭を喰らう大蟲。吐き出す冷気は坑道の水脈を一晩で凍らせ、浴びた獲物は手足が凍てついて氷柱の標本に変わる。" },
  { id: "bs_brimstonefiend", name: "硫黄の悪鬼", rank: 2, boss: true, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#8a6a1a", 0.35),
    ability: "poison", // 硫黄の毒煙で喉を灼く
    desc: "硫黄の噴気に引き寄せられて湧いた下級魔どもの王。黄色い毒煙を玉座の帳のように纏い、咳き込んだ獲物の喉へ火種を投げ込む。煙を吸った者は内から灼かれ続ける。" },
  { id: "bs_steamtyrant", name: "蒸気の暴君", rank: 2, boss: true, race: "construct", element: "fire", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#8a5a3a", 0.4),
    ability: "breath", physResist: 0.4, // 全体を包む高圧蒸気 + 鋼の装甲
    desc: "縦坑の闇で誰の命令もないまま動き続ける蒸気仕掛けの巨人。弁から噴き出す灼熱の蒸気は前衛も後衛もまとめて茹で上げ、鋼の装甲は並の刃を寄せつけない。漏れる白い悲鳴は、炉にくべられた坑夫たちの分だという。" },
  { id: "bs_leadenking", name: "鉛の王", rank: 2, boss: true, race: "armored", element: "earth", artKey: "knightmare",
    palette: tint(ARTS.knightmare.palette, "#5a5a6a", 0.4),
    physResist: 0.5, // 鉛の巨体が刃を呑み込む
    desc: "鉛山の底で王冠を抱いたまま、鎧ごと鉛に呑まれた成り上がりの王。鈍色の巨体は遅いが刃を鈍く呑み込み、その一打は地金の重さで骨を潰す。" },
  { id: "bs_rustwyrm", name: "錆喰いの竜", rank: 2, boss: true, race: "dragon", element: "earth", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#8a4a2a", 0.4),
    ability: "breath", // 錆の嵐を吐いて装備ごと崩す
    desc: "廃坑の軌条も鶴嘴も喰らい尽くし、錆の鱗を纏った地竜。前衛後衛を問わず吐きかける赤茶けた錆の嵐は、浴びた剣も鎧も一晩で崩れ落とす。" },
  // -- rank 3 (迷宮21-30: 廃砦帯) --
  { id: "bs_lastbanneret", name: "最後の旗手", rank: 3, boss: true, race: "armored", element: "none", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#7a8a9a", 0.3),
    desc: "守備隊の最後の陣で、折れた旗を握ったまま果てた騎士。旗が地に落ちない限り陣は破られていないと信じ、今も最後の防衛線に立つ。" },
  { id: "bs_bloodfeastogre", name: "血祭りの鬼将", rank: 3, boss: true, race: "giant", element: "fire", artKey: "ogre", soulClass: "fighter",
    palette: tint(ARTS.ogre.palette, "#8a2a1a", 0.4),
    desc: "城境壁で幾日も血祭りを続けた攻め手の鬼将。戦が終わったことを誰も伝えに来なかったので、祭りはまだ続いている。" },
  { id: "bs_squareghost", name: "広場の亡霊将", rank: 3, boss: true, race: "specter", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#6a6a8a", 0.35),
    desc: "旗竿の広場で全滅した部隊の点呼を取り続ける将の亡霊。名簿の最後にはいつの間にか、迷宮に入った者の名が書き足されている。" },
  { id: "bs_frozenarcher", name: "凍て弓の隊長", rank: 3, boss: true, race: "undead", element: "water", artKey: "skeleton", soulClass: "thief",
    palette: tint(ARTS.skeleton.palette, "#9fc0d8", 0.35),
    desc: "弓兵の塔で矢を番えたまま凍りついた射手の隊長。指は氷柱と化してなお弦を引き絞り、放たれる矢は刺さった先から獲物を凍らせる。" },
  { id: "bs_granarymaw", name: "兵糧庫の貪り", rank: 3, boss: true, race: "amorph", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#c87a2a", 0.4),
    desc: "燃え落ちた兵糧庫で、焦げた糧秣ごと燠火を呑み込んで膨れ上がった粘塊。腹の中ではまだ火が燻り、近づくものを飢えたまま炙り喰う。" },
  { id: "bs_headsmanwraith", name: "処刑人の影", rank: 3, boss: true, race: "specter", element: "dark", artKey: "wraith", soulClass: "fighter",
    palette: tint(ARTS.wraith.palette, "#3a3a46", 0.4),
    desc: "処刑台の下の底知れぬ穴に堕ちた処刑人の影。執行の名簿は燃え失せたが斧だけが残り、影は誰の罪状も読まずに振り下ろす。" },
  { id: "bs_ironcagewarden", name: "鉄房の看守長", rank: 3, boss: true, race: "armored", element: "earth", artKey: "knightmare",
    palette: tint(ARTS.knightmare.palette, "#6a5a4a", 0.35),
    desc: "捕虜たちの呪詛を浴び続け、鎧と鉄格子が癒着した看守長。胸の鉄房には今も誰かが囚われていて、戦いの最中にも細い腕が助けを乞う。" },
  { id: "bs_duskcastellan", name: "黄昏の城代", rank: 3, boss: true, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#b0884a", 0.3),
    desc: "落城の夕べ、明け渡しの鍵を抱いたまま果てた城代。差し出す相手を間違えまいと骨の指は鍵を握り続け、奪おうとする者を客とは認めない。" },
  { id: "bs_warhostrevenant", name: "千兵の怨嵐", rank: 3, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#8a2a3a", 0.4),
    desc: "霊魂の迷路に散った千の兵の怨念が、ひとつの嵐に縒り合わさったもの。千の声が同時に突撃の鬨を上げ、千の手が同時に剣を振るう。" },
  // -- rank 4 (迷宮31-40: 霧の森帯) --
  { id: "bs_mistwolfking", name: "霧狼の王", rank: 4, boss: true, race: "beast", element: "wind", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#9aa3ab", 0.4),
    desc: "幽の森に立ちこめる霧そのものを群れとして従える大狼の王。遠吠えひとつで霧が牙の形に凝り、迷い込んだ者の退路から順に喰い千切る。" },
  { id: "bs_hollowkodama", name: "朽ち社の木霊", rank: 4, boss: true, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#6a8a4a", 0.35),
    desc: "参る者の絶えた社で、届かなかった願いだけを溜め込んで肥えた木霊。叶えられなかった祈りの数だけ枝を伸ばし、参拝者を離さない。" },
  { id: "bs_bloodbriar", name: "血茨の主", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#8a2a3a", 0.4),
    desc: "樹海の路に倒れた旅人の血を吸って肥え太った茨の大蔓。獲物を絞め上げる時だけ、棘の先に小さな赤い花を咲かせる。" },
  { id: "bs_birchwitch", name: "白樺の魔女", rank: 4, boss: true, race: "specter", element: "water", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#e8e8f4", 0.4),
    desc: "凍てついた白樺林に棲む雪の魔女の霊。白い林に紛れて立ち尽くし、声をかけた者の体温を呪文ひとつで根こそぎ奪い取る。" },
  { id: "bs_pyretreant", name: "燃え木の巨人", rank: 4, boss: true, race: "plant", element: "fire", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#c85a2a", 0.4),
    desc: "炎樹の回廊で燃えながら決して倒れぬ巨木の人形。幹の火は百年消えたことがなく、抱きしめられた者は薪の仲間入りをする。" },
  { id: "bs_bogtyrant", name: "底なし沼の主", rank: 4, boss: true, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#4a5a2a", 0.4),
    desc: "沼地の底で幾百年も沈むものを待ち続けた主。泥の下から伸びる腕は数えるだけ無駄で、掴まれた足はもう岸を踏めない。" },
  { id: "bs_curseroot", name: "呪樹の根王", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#3a2a4a", 0.45),
    desc: "呪われた呪樹の根が地中で結び合い、ひとつの意志を持った王。森のすべての木は、この根の指先に過ぎない。" },
  { id: "bs_rotgardener", name: "腐苑の庭師", rank: 4, boss: true, race: "undead", element: "earth", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#5a7a3a", 0.4),
    desc: "腐葉の苑を死体で手入れし続ける骸の庭師。倒した獲物を几帳面に土へ植え、芽吹いた何かに誇らしげに水をやる。" },
  { id: "bs_mireforestking", name: "血沼の樹王", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#6a1a2a", 0.45),
    desc: "果てなき森の血沼に根を張る樹々の王。根は沼の血を吸い上げて梢まで赤く染まり、落ちる葉の一枚一枚が血の匂いで獣を狂わせる。" },
  // -- rank 5 (迷宮41-50: 沈没神殿帯) --
  { id: "bs_drownedpontiff", name: "水底の神官王", rank: 5, boss: true, race: "undead", element: "water", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#2a6a9a", 0.4),
    desc: "神殿もろとも湖底に沈んだ神官たちの王。水底でなお続く礼拝の頂点に立ち、息のある参拝者を「沈黙の聖歌隊」へ勧誘する。" },
  { id: "bs_altarguardian", name: "祭壇の番像", rank: 5, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e0d0a0", 0.35),
    desc: "朽ちた祭壇を守るために聖別された石の番像。神はとうに去ったが聖別だけが残り、供物なき参拝者を瀆神者として打ち砕く。" },
  { id: "bs_sacrificelord", name: "生贄の祭主", rank: 5, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#8a2a4a", 0.4),
    desc: "血染めの間で千の生贄を捧げ、最後に自らを捧げた祭主。儀式はまだ完成しておらず、足りない分の血を訪問者に求めてくる。" },
  { id: "bs_whisperingidol", name: "囁く神像", rank: 5, boss: true, race: "construct", element: "dark", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#4a4a6a", 0.4),
    desc: "迷宮の中心に座し、囁きだけで信徒を操ってきた名もなき神の像。耳を塞いでも囁きは頭蓋の内側から聞こえてくる。" },
  { id: "bs_blazeseraph", name: "燃ゆる聖堂の天使", rank: 5, boss: true, race: "specter", element: "fire", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c85a2a", 0.4),
    desc: "大聖堂の火に焼かれてなお祝福の歌をやめない天使像の霊。焼け爛れた翼から火の粉の聖句が降り、浴びた者は祝福ごと燃える。" },
  { id: "bs_nagamatriarch", name: "神域のナーガ母神", rank: 5, boss: true, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#7a4aa0", 0.4),
    desc: "海底に沈んだ神域を鱗の塒で抱え込む蛇身の母神。千年の祈りを捧げた信徒の末裔すら、今は卵の餌としか見ていない。" },
  { id: "bs_cursedpontifex", name: "呪われた教主", rank: 5, boss: true, race: "undead", element: "dark", artKey: "skeleton", soulClass: "bishop",
    palette: tint(ARTS.skeleton.palette, "#7a4aa0", 0.4),
    desc: "霊廟に葬られた後、祈りごと呪詛に転じた神官の教主。唱える聖句は一字ずつ裏返り、祝福した者から順に病み衰えていく。" },
  { id: "bs_duskapostle", name: "黄昏の神使", rank: 5, boss: true, race: "avian", element: "light", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#e8c24a", 0.35),
    desc: "没落した神殿に最後まで残った神の使い。届ける相手のいない神託を抱えたまま、黄昏の廊を旋回し続けている。" },
  { id: "bs_ordealavatar", name: "試練の神像", rank: 5, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#c8a040", 0.4),
    desc: "神意の試練の底で挑む者を量り続ける神の依代。秤の片方には挑戦者の魂、もう片方には誰も見たことのない「合格」が載っている。" },
  // -- rank 6 (迷宮51-60: 灼熱洞帯) --
  { id: "bs_magmacentipede", name: "溶岩の大百足", rank: 6, boss: true, race: "insect", element: "fire", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#c84a1a", 0.45),
    desc: "溶岩の川を素肌で泳ぐ灼熱の大百足。幾百の脚が掻き立てる火飛沫は雨のように降り、通った後の岩肌は飴のように波打つ。" },
  { id: "bs_cinderknight", name: "燃え殻の騎士", rank: 6, boss: true, race: "armored", element: "fire", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#8a3a1a", 0.4),
    desc: "熔岩の回廊で焼かれ続け、中身が燃え尽きてなお立ち続ける騎士の鎧。兜の奥の熾火は、誓いの言葉を今も燻らせている。" },
  { id: "bs_boilingmass", name: "血沸きの肉塊", rank: 6, boss: true, race: "amorph", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#a02a2a", 0.45),
    desc: "血の沸く迷路で煮え続け、煮詰まった末に意志を持った肉の塊。触れたものを丸ごと取り込んで、また少し煮詰まる。" },
  { id: "bs_fumarolelord", name: "噴気孔の魔伯", rank: 6, boss: true, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#8a6a1a", 0.4),
    desc: "硫黄の噴気孔を玉座とする魔界の伯爵。立ち昇る毒煙を恭しく従者として侍らせ、咳ひとつで客人の格を見定める。" },
  { id: "bs_venomhydra", name: "毒炎の双首蛇", rank: 6, boss: true, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#6a8a2a", 0.45),
    desc: "炎と毒、相容れぬ二つを同時に吐く双つ首の大蛇。二つの首は互いを憎みながら、獲物を炙り煮にする時だけ息を合わせる。" },
  { id: "bs_calderawyrm", name: "火口の蛇竜", rank: 6, boss: true, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#c85a1a", 0.45),
    desc: "火山の縦坑に巻きついて眠る鱗の長虫。目覚めれば縦坑そのものが胃袋に変わり、落ちてくるものはみな同じ場所へ着く。" },
  { id: "bs_flameheresiarch", name: "炎の異端教主", rank: 6, boss: true, race: "specter", element: "fire", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#c84a2a", 0.4),
    desc: "炎の聖地を乗っ取り、火刑を「祝福」と説いた異端の教主。焼かれた信徒の数だけ法衣の火は強くなり、説法は今日も燃えている。" },
  { id: "bs_emberking", name: "燠火の廃王", rank: 6, boss: true, race: "undead", element: "fire", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8742a", 0.4),
    desc: "灼熱の廃都で燠火の冠を戴き続ける王の骸。都が燃え尽きた夜から退位を認めず、灰の玉座への謁見を今も義務づけている。" },
  { id: "bs_infernowyrm", name: "業火竜", rank: 6, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#a02a0a", 0.45),
    desc: "終末迷宮の底で己の業火に巻かれながら生き続ける竜。炎はもはや吐くものではなく棲み処であり、竜はその只中からこちらを見ている。" },
  // -- rank 7 (迷宮61-70: 氷結回廊帯) --
  { id: "bs_crystalwyrm", name: "氷晶の蛇竜", rank: 7, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#9fd0e8", 0.45),
    desc: "永久氷の結晶回廊で氷柱に擬態して眠る蛇竜。鱗は氷晶と見分けがつかず、気づいた時には吐息が肺の中で凍りはじめている。" },
  { id: "bs_snowsexton", name: "雪葬の墓守", rank: 7, boss: true, race: "undead", element: "water", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#e8e8f4", 0.4),
    desc: "雪に葬られた迷路で、埋もれた死者の数を数え続ける墓守。数え終わらぬうちに雪が新しい死者を運んでくるので、勘定は終わらない。" },
  { id: "bs_frozenwarden", name: "氷牢の獄長", rank: 7, boss: true, race: "armored", element: "water", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#6a8aa0", 0.4),
    desc: "血も凍る氷の牢獄を統べる獄長。囚人を氷柱に封じる刑を好み、廊に並ぶ氷柱の中では今も誰かが瞬きをしている。" },
  { id: "bs_blizzardvoice", name: "吹雪の囁き手", rank: 7, boss: true, race: "specter", element: "wind", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#c8d8e8", 0.4),
    desc: "吹雪の廊で旅人の名を呼ぶ声の主。声に応えて振り向いた者から順に雪へ沈み、次の旅人を呼ぶ声がひとつ増える。" },
  { id: "bs_glacialgiant", name: "氷河の巨王", rank: 7, boss: true, race: "giant", element: "water", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#9fc0d8", 0.4),
    desc: "永久氷河を褥に眠る巨人の王。寝返りひとつで氷河に新しい谷が刻まれ、目覚めの一打は冬そのものを振り下ろす。" },
  { id: "bs_paradoxgenie", name: "氷炎の双精", rank: 7, boss: true, race: "elemental", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#b07be0", 0.4),
    desc: "氷壁の中で燃え続ける矛盾そのものの精霊。氷と炎が互いを喰らい合いながらひとつの体を成し、触れた者は凍えながら焼かれる。" },
  { id: "bs_rimecastellan", name: "霜の城主", rank: 7, boss: true, race: "specter", element: "water", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#aef0ff", 0.4),
    desc: "霜の廃城で晩餐の客を待ち続ける城主の霊。凍った長卓には人数分の席が用意されていて、空いているのはあとひとつだけだ。" },
  { id: "bs_eternalsnowbeast", name: "万年雪の白獣", rank: 7, boss: true, race: "beast", element: "water", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#e8eef4", 0.45),
    desc: "黄昏の雪原を統べる白き獣。万年雪と同じ色の毛皮は雪明かりに溶け、足跡のない雪面こそが奴の近づいた証だという。" },
  { id: "bs_iciclequeen", name: "氷晶の女王", rank: 7, boss: true, race: "specter", element: "water", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#aef0ff", 0.45),
    desc: "氷晶の終末宮殿の玉座で凍てつく女王。差し伸べる手の優美さは生前のまま、握り返した手は二度と温もりを取り戻さない。" },
  // -- rank 8 (迷宮71-80: 嵐の尖塔帯) --
  { id: "bs_stormroc", name: "嵐の大鵬", rank: 8, boss: true, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#4a6a9a", 0.4),
    desc: "尖塔の廃墟を巣とする嵐の大鳥。翼の一打ちが暴風を生むのではなく、この鳥が翼を畳んだ時だけ嵐が止むのだという。" },
  { id: "bs_skywarden", name: "天廊の番人", rank: 8, boss: true, race: "construct", element: "wind", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#9ab0c8", 0.4),
    desc: "天空の朽ちた廊下を浮遊しながら巡回する番人。床の崩れた廊を歩けるのは自分だけだと知っていて、客人を丁重に突き落とす。" },
  { id: "bs_thunderprelate", name: "雷霆の祭主", rank: 8, boss: true, race: "specter", element: "wind", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#d4d44a", 0.4),
    desc: "血染めの聖堂で雷を神として祀った祭主。祈りに応えた雷に焼かれて死に、以来その身が避雷針として神を呼び続けている。" },
  { id: "bs_cyclonedjinn", name: "竜巻の魔人", rank: 8, boss: true, race: "demon", element: "wind", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#4a8a6a", 0.4),
    desc: "遺跡の壺に封じられていた竜巻の魔人。封を解いた者への「願いを三つ」の口約束は、三つの竜巻となって律儀に果たされる。" },
  { id: "bs_stormfrostgiant", name: "嵐氷の巨人", rank: 8, boss: true, race: "giant", element: "water", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#6a8aa0", 0.4),
    desc: "嵐の頂で雹と氷雨を浴び続け、氷の鎧を着込んだ巨人。振るう棍棒は凍った雷雲の芯で、打たれた者は砕ける前に凍りつく。" },
  { id: "bs_stormdrake", name: "雷炎竜", rank: 8, boss: true, race: "dragon", element: "wind", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#d4c44a", 0.4),
    desc: "燃える雷霆の塔に巻きつく雷の竜。鱗の隙間を稲妻が血潮のように走り、咆哮と雷鳴の区別がついた者から先に焼かれる。" },
  { id: "bs_darkcloudspawn", name: "暗雲の落とし子", rank: 8, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#2a2a3a", 0.45),
    desc: "底知れぬ奈落に垂れ込めた暗雲から滴り落ちた影。雷が走るたび一瞬だけ本当の形が見え、見てしまった者は次の雷を待てない。" },
  { id: "bs_ruincore", name: "飛翔廃墟の核", rank: 8, boss: true, race: "construct", element: "wind", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#7a86a0", 0.4),
    desc: "黄昏の空に廃墟を浮かべ続ける魔導の心核。守るべき都市は崩れ果てたが、核は墜落を拒み、近づく者を重力ごと弾き飛ばす。" },
  { id: "bs_galesovereign", name: "烈風の覇王", rank: 8, boss: true, race: "avian", element: "wind", artKey: "harpy", soulClass: "fighter",
    palette: tint(ARTS.harpy.palette, "#2a6a4a", 0.4),
    desc: "終末の迷宮に君臨する翼ある覇王。玉座は常に風の渦の中心にあり、謁見を許された者はまず、立っていることを許されない。" },
  // -- rank 9 (迷宮81-90: 冥府の門帯) --
  { id: "bs_hellgatehound", name: "冥門の番犬", rank: 9, boss: true, race: "demon", element: "dark", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#3a1a1a", 0.45),
    desc: "冥府の門前に鎖で繋がれた三つ首の番犬。生者を通さず、死者を帰さず——その鎖は門を守るためではなく、世界を犬から守るためにある。" },
  { id: "bs_ferrymanshade", name: "冥橋の渡し守", rank: 9, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#4a4a5a", 0.4),
    desc: "朽ちた欄干の橋で渡し賃を待ち続ける影。賃を払えぬ魂は橋の下へ落とされ、欄干の軋みはその魂たちが登ろうとする音だ。" },
  { id: "bs_bloodjudge", name: "血の裁定者", rank: 9, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#8a1a2a", 0.45),
    desc: "死者審判の間で裁きを下し続ける裁定者。天秤の片皿には常に血が満たされ、釣り合う重さの罪を持たない者は「無罪のまま」斬られる。" },
  { id: "bs_processionlord", name: "死出の行列長", rank: 9, boss: true, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#5a4a6a", 0.4),
    desc: "死者の列を率いて囁く道を行く行列の長。列は冥府まで一列、追い越しも離脱も許されず、生者と出会えば列の最後尾が一人ぶん延びる。" },
  { id: "bs_palefrostking", name: "冥宮の凍王", rank: 9, boss: true, race: "armored", element: "water", artKey: "knightmare",
    palette: tint(ARTS.knightmare.palette, "#8aa0b8", 0.4),
    desc: "冥王宮の玉座で凍てついた王の鎧。冥王の帰りを待つ間に氷柱と化し、玉座に近づく足音へ、凍った剣をきしませながら立ち上がる。" },
  { id: "bs_hellfirejailer", name: "獄炎の看守", rank: 9, boss: true, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#6a1a0a", 0.45),
    desc: "冥府の獄炎回廊を巡回する看守。鞭の代わりに焼けた鎖を引きずり、房の数より多い鍵を腰に下げて、新しい房の主を探している。" },
  { id: "bs_styxcrone", name: "三途の媼", rank: 9, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#5a6a4a", 0.4),
    desc: "三途の岸で渡れぬ者の衣を剥ぎ集める老婆。積み上がった衣の山はどれも持ち主の未練の重さで、媼はその重さを量って嗤う。" },
  { id: "bs_duskmausoleum", name: "黄昏の廟王", rank: 9, boss: true, race: "undead", element: "light", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8b88a", 0.35),
    desc: "冥界廃墟の黄昏に立つ大廟の王。葬られた身でありながら自らの廟を統治し、参拝も盗掘もひとしく「臣従」として迎え入れる。" },
  { id: "bs_soulgaoler", name: "魂牢の獄王", rank: 9, boss: true, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#2a1a3a", 0.45),
    desc: "魂牢獄の終末処で、檻に満ちた魂たちの錠を握る獄王。鎧の継ぎ目からは囚われた魂の光が漏れ、その輝きが強いほど獄王は強くなる。" },
  // -- rank 10 (迷宮91-100: 竜の玄室帯) --
  { id: "bs_elderwyrmking", name: "玄室の古竜王", rank: 10, boss: true, race: "dragon", element: "none", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c8a040", 0.4),
    desc: "玄室の深奥に眠る、竜たちの系譜の頂点。歴代の挑戦者の武具を鱗の下に喰い込ませたまま育ち、その巨体自体が英雄たちの墓標である。" },
  { id: "bs_hoardwarden", name: "宝物殿の守護像", rank: 10, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e8c24a", 0.4),
    desc: "竜王の財宝を守るため、財宝そのものを鋳潰して造られた黄金の巨像。守るべき宝の一部である自分自身を、最後の宝として守り抜く。" },
  { id: "bs_broodmother", name: "竜母", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#a03a3a", 0.4),
    desc: "血染めの巣穴で幾百の卵を抱く竜の母。巣に近づくものへの敵意に際限はなく、その血の何割かは、卵を狙った者たちのものだ。" },
  { id: "bs_dracolich", name: "竜骸の屍竜", rank: 10, boss: true, race: "undead", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#7a6a8a", 0.45),
    desc: "竜骸の大迷宮の心臓部で、己の骨格だけで蘇った屍の竜。肉も炎も失ったが、死そのものを吐息として吐くことを覚えた。" },
  { id: "bs_frostwyrmlord", name: "凍れる白竜", rank: 10, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#d8e8f4", 0.45),
    desc: "氷窟の奥で氷塊に半身を封じられたまま生き続ける白竜。脈打つたび氷窟全体が軋み、その吐息は炎ではなく絶対の静寂を吹きつける。" },
  { id: "bs_abyssdrake", name: "奈落竜", rank: 10, boss: true, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a1a3a", 0.5),
    desc: "竜の奈落の底知れぬ闇に潜む影の竜。落ちてくる挑戦者を翼で受け止める——底まで落ちる楽しみを、奪われたくないからだ。" },
  { id: "bs_dragongodshade", name: "竜神の残影", rank: 10, boss: true, race: "specter", element: "light", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#e8d8a0", 0.4),
    desc: "呪われた霊域に焼き付いた竜神の残影。本体はとうに天へ還ったが、地上に残した影は信仰と呪詛を吸い続け、神の形を保っている。" },
  { id: "bs_twilightdragon", name: "終焉の黄昏竜", rank: 10, boss: true, race: "dragon", element: "light", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c87a4a", 0.4),
    desc: "終焉の黄昏の間に座し、世界の日没を待ち続ける竜。その鱗は沈む直前の太陽の色をして、翼を広げれば部屋の灯りがすべて夕暮れになる。" },

  // ---- 役割持ちモンスター (role: healer/guard/summoner) ----
  // 取り巻き (escort) を連れて現れる。回復役・呼び手は後衛に立つため、
  // 長射程の武器や呪文で先に仕留めるか、護り手を崩す「処理順」が問われる。
  // ability: null は種族由来の特殊能力を持たせない明示指定。
  // -- rank 2 --
  { id: "bs_goblinshaman", name: "ゴブリンの呪い手", rank: 2, race: "humanoid", element: "dark", artKey: "gobshaman",
    role: "healer", escort: "bs_goblin", ability: null, magWeak: 1.4, soulClass: "priest",
    desc: "骨の杖を振るい、仲間の傷を呪詛で縫い合わせるゴブリンの祈祷師。群れの後ろで唱え続ける限り、ゴブリンどもは何度でも立ち上がる。痩せた体は脆く、魔法を撃ち込めば呪文ごと崩れ落ちる。" },
  { id: "bs_tombwarden", name: "墓守の重骸", rank: 2, race: "undead", element: "dark", artKey: "knightmare",
    role: "guard", escort: "bs_zombie", ability: null, physResist: 0.4,
    palette: tint(ARTS.knightmare.palette, "#8a8a7a", 0.4),
    desc: "墓所の番を最後の命令として朽ちた鎧の亡者。命令だけが残った今も仲間の屍を背に庇い、分厚い具足で刃を受け止め、自らが砕けるまで一歩も退かない。" },
  { id: "bs_ratpiper", name: "鼠寄せの笛吹き", rank: 2, race: "humanoid", element: "none", artKey: "piper",
    role: "summoner", summonKey: "bs_drainrat", escort: "bs_drainrat", ability: null, soulClass: "thief",
    desc: "骨の笛で坑道の鼠を従える小鬼。笛の音が続く限り、闇の奥から際限なく鼠が湧いてくる。まず笛を止めさせることだ。" },
  // -- rank 3 --
  { id: "bs_bonechanter", name: "白骨の唱導師", rank: 3, race: "undead", element: "dark", artKey: "skeleton",
    role: "healer", escort: "d01_skeleton", ability: null, soulClass: "bishop",
    palette: tint(ARTS.skeleton.palette, "#c8b87a", 0.4),
    desc: "死者への祈りを逆さに唱え、砕けた骨を継ぎ直す骸の司祭。唱導が続く限り、倒したはずの骸兵が骨を拾い集めて立ち上がる。" },
  { id: "bs_gravecaller", name: "墓呼びの語り部", rank: 3, race: "specter", element: "dark", artKey: "ghost",
    role: "summoner", summonKey: "bs_zombie", escort: "bs_zombie", ability: null,
    palette: tint(ARTS.ghost.palette, "#3a5a4a", 0.45),
    desc: "土の下の亡者に「まだ終わっていない」と囁き続ける亡霊。その語りを聞いた骸は墓を破って這い出し、語り部の指す方へ歩き出す。" },
  // -- rank 4 --
  { id: "bs_shieldogre", name: "大盾のオーガ", rank: 4, race: "giant", element: "earth", artKey: "ogre",
    role: "guard", escort: "d03_orc", ability: null,
    palette: tint(ARTS.ogre.palette, "#5a6a8a", 0.4),
    desc: "城門の残骸を大盾として担ぐオーガの古強者。群れの矢面に立って刃を受け止めることだけを誇りとし、その背後でオークどもが斧を研ぐ。" },
  { id: "bs_plaguepriest", name: "疫病の祈り手", rank: 4, race: "specter", element: "dark", artKey: "ghost",
    role: "healer", escort: "bs_banshee", ability: null, soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#7a8a3a", 0.45),
    desc: "病魔を神と崇め、その「恵み」で仲間の傷を腐肉ごと塞ぐ亡僧。祈りの言葉は治癒と疫病をひとつの息で唱えられる。" },
];

// 新規分にランク基準ステータスを与えてから検証・登録する
const NEW_MONSTERS = defMonsters(NEW_DEFS.map((d) => ({ ...monStats(d.rank, d.boss), ...d })));

// ---- 強敵モンスター (Elite Monsters) ----
// 通常のランクプールには含まれない特殊強敵。強敵階でのみ出現する。
// 各ランク帯 (10迷宮) を 1-3 / 4-6 / 7-10 の3グループに区切り、グループごとに固有の1体を持つ
// (例: 迷宮1-3, 4-6, 7-10, 11-13, …)。計30体。
// ステータスは「帯ランク+2 のボス」(上限10)。適正レベルで倒すのは困難な規格外の存在。
const ELITE_DEFS = [
  // -- 迷宮 1-10 (墓地帯) / 強敵ランク3 --
  { id: "el_cryptlord", name: "墓所の君主", elite: true, rank: 3, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#caa84a", 0.45),
    desc: "墓地の最奥、最も古い柩に葬られた貴人の成れの果て。己の眠りを破った足音をすべて数えており、数え終えた夜に柩の蓋が開く。" }, // D1-3
  { id: "el_palebutcher", name: "蒼白の屠殺鬼", elite: true, rank: 3, race: "giant", element: "none", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#d8d8e4", 0.55),
    desc: "墓守に化けて幾世代も墓地に住み着いた蒼白の喰人鬼。奴の包丁が研がれる夜は、翌朝までに墓穴がひとつ増えている。" }, // D4-6
  { id: "el_sorrowsaint", name: "嘆きの聖女", elite: true, rank: 3, race: "specter", element: "light", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#ffe8b0", 0.5),
    desc: "疫病の死者を弔い続け、最後は自らも墓地に倒れた聖女の亡霊。祈りの文句は生前のままに、その祝福だけが死を運ぶものへ変わり果てた。" }, // D7-10
  // -- 迷宮 11-20 (坑道帯) / 強敵ランク4 --
  { id: "el_oremaw", name: "鉱脈喰らい", elite: true, rank: 4, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#5ac8a0", 0.45),
    desc: "坑道の鉱脈そのものを喰らって肥え太った岩塊の獣。全身に喰い残しの原石が突き刺さり、その輝きに惹かれた鉱夫ごと岩盤を呑み込む。" }, // D11-13
  { id: "el_lanternreaper", name: "灯火狩り", elite: true, rank: 4, race: "specter", element: "dark", artKey: "wraith", soulClass: "thief",
    palette: tint(ARTS.wraith.palette, "#16162a", 0.6),
    desc: "坑道で果てた者たちの「消えた灯」が寄り集まった漆黒の影。生者の掲げる灯りを何よりも憎み、灯火を狩るついでに持ち主の息の根を摘む。" }, // D14-16
  { id: "el_tunnelking", name: "穴蔵の王", elite: true, rank: 4, race: "humanoid", element: "fire", artKey: "kobold", soulClass: "fighter",
    palette: tint(ARTS.kobold.palette, "#c8a040", 0.5),
    desc: "数千の眷属を従え、坑道の闇に王国を築いた古コボルト。小鬼と侮った者の骸が、玉座への道に敷き詰められている。" }, // D17-20
  // -- 迷宮 21-30 (砦帯) / 強敵ランク5 --
  { id: "el_warbanner", name: "軍旗の亡将", elite: true, rank: 5, race: "armored", element: "fire", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#a03020", 0.5),
    desc: "落城の日、軍旗を握ったまま焼け死んだ将の亡霊。今も燃え続ける旗を掲げ、目に映るすべてを攻め落とすべき敵城と見なす。" }, // D21-23
  { id: "el_headsman", name: "処刑人の大鬼", elite: true, rank: 5, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#6a2a2a", 0.5),
    desc: "砦の処刑場に飼われていた首斬り役の大鬼。主を失ってなお務めを忘れず、迷い込んだ者を「本日の咎人」として斧の下へ並ばせる。" }, // D24-26
  { id: "el_phantomcompany", name: "亡霊中隊", elite: true, rank: 5, race: "specter", element: "wind", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#7a8aa8", 0.5),
    desc: "全滅した守備中隊の魂が、ひとつの巨影に溶け合った亡霊。百の声が同時に号令を叫び、百人分の殺意がひとつの太刀筋に乗る。" }, // D27-30
  // -- 迷宮 31-40 (霧の森帯) / 強敵ランク6 --
  { id: "el_mistmother", name: "霧の繭母", elite: true, rank: 6, race: "insect", element: "water", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#c8d4e0", 0.55),
    desc: "霧の森の最深部に巣を張る繭の女王。立ち込める霧はすべてこの蜘蛛の吐いた糸であり、森に入った時点で、すでに巣の上にいる。" }, // D31-33
  { id: "el_eldertreant", name: "古樹の巨人", elite: true, rank: 6, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#3a5a2a", 0.5),
    desc: "森が芽吹くより前からそこに立つ古樹の巨人。根は迷宮全体に張り巡らされ、梢を騒がせた者を大地ごと締め上げて肥料に変える。" }, // D34-36
  { id: "el_huntsmanwraith", name: "狩人王の亡霊", elite: true, rank: 6, race: "specter", element: "wind", artKey: "wraith", soulClass: "thief",
    palette: tint(ARTS.wraith.palette, "#3a6a3a", 0.5),
    desc: "獲物を狩り尽くし、最後に己の従者を獲物にした狩人王の亡霊。角笛の音が聞こえたなら、すでに狩りは始まっている。" }, // D37-40
  // -- 迷宮 41-50 (神殿帯) / 強敵ランク7 --
  { id: "el_fallenidol", name: "堕ちた神像", elite: true, rank: 7, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e8d8a0", 0.5),
    desc: "信仰を失った神殿で、祈られることに飢えた神像。参拝者を石の腕で抱き締めて離さず、その骸を新たな信徒として祭壇に並べる。" }, // D41-43
  { id: "el_heresiarch", name: "異端大司教", elite: true, rank: 7, race: "undead", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#6a2a5a", 0.5),
    desc: "禁じられた教義を説き、生きながら神殿の地下へ葬られた大司教。幽閉の闇で教義は完成し、いま死そのものを福音として説いて回る。" }, // D44-46
  { id: "el_offeringslime", name: "供物の坩堝", elite: true, rank: 7, race: "amorph", element: "dark", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#8a6a1a", 0.55),
    desc: "千年分の供物を呑み込み続けた祭壇の坩堝が、ついに意思を持った粘塊。黄金も宝石も体内に沈めたまま、最上の供物——生贄を待っている。" }, // D47-50
  // -- 迷宮 51-60 (灼洞帯) / 強敵ランク8 --
  { id: "el_cinderking", name: "燼の王", elite: true, rank: 8, race: "elemental", element: "fire", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#d86a2a", 0.55),
    desc: "灼洞の火が幾度も消えかけ、そのたびに燃え残った「燼」の精。炎の王を名乗るその身は冷えゆく憎悪であり、触れた熱をすべて奪い尽くす。" }, // D51-53
  { id: "el_magmawyrm", name: "熔鉄の蛇竜", elite: true, rank: 8, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#d83a1a", 0.55),
    desc: "溶岩の底を泳ぎ続け、鱗が熔けた鉄と一体化した蛇竜。通った跡の岩は飴のように溶け落ち、その体当たりは城門すら蒸発させる。" }, // D54-56
  { id: "el_ashshogun", name: "灰燼の将", elite: true, rank: 8, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#8a8a88", 0.5),
    desc: "灼洞に攻め入り、軍ごと灰になった将の亡霊。鎧の中身は今も崩れぬ灰であり、斬られるたび灰煙となって解け、再び将の形に積もり直す。" }, // D57-60
  // -- 迷宮 61-70 (氷廊帯) / 強敵ランク9 --
  { id: "el_frostsovereign", name: "凍王の影", elite: true, rank: 9, race: "armored", element: "water", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#a8c8e8", 0.55),
    desc: "氷廊の最深部に座す「凍王」が、退屈しのぎに切り離した己の影。影でありながら本体に迫る力を持ち、敗者は氷像として回廊に飾られる。" }, // D61-63
  { id: "el_glacialmaw", name: "氷河の大顎", elite: true, rank: 9, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c8e0f0", 0.6),
    desc: "氷河の裂け目そのものと見紛う、白竜の巨大な顎。氷ごと獲物を噛み砕き、千年溶けない吹雪を吐く。" }, // D64-66
  { id: "el_blizzardwitch", name: "吹雪の魔女", elite: true, rank: 9, race: "specter", element: "wind", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#b0d8e8", 0.55),
    desc: "吹雪の夜にだけ氷廊へ現れる魔女の亡霊。彼女が紡ぐ子守唄を聞いた者は、暖かな眠りの中で静かに凍りついていく。" }, // D67-70
  // -- 迷宮 71-80 (尖塔帯) / 強敵ランク10 --
  { id: "el_stareater", name: "星喰らい", elite: true, rank: 10, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#2a1a4a", 0.55),
    desc: "尖塔の頂から夜空の星をひとつずつ喰らってきた大悪魔。星の消えた夜空はこの者の腹の中であり、次に喰らうのは地上の光だという。" }, // D71-73
  { id: "el_voidarchon", name: "虚空の執政官", elite: true, rank: 10, race: "specter", element: "light", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#f0f0e8", 0.6),
    desc: "塔の観測室が「何もない場所」を覗いた時、向こう側から歩いてきた執政官。白く輝くその姿を直視した者は、輪郭から順に存在を失う。" }, // D74-76
  { id: "el_geargod", name: "歯車の神", elite: true, rank: 10, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#b8a060", 0.5),
    desc: "尖塔の機構の奥で、誰にも知られず回り続けた歯車の集合体。自らを神と定義し、噛み合わぬもの——すなわち生命を、設計図から除去する。" }, // D77-80
  // -- 迷宮 81-90 (冥門帯) / 強敵ランク10 --
  { id: "el_hellwarden", name: "冥獄の大典獄", elite: true, rank: 10, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#a02818", 0.5),
    desc: "冥獄の最下層を預かる大典獄。腰に下がる無数の鍵はすべて「出られなかった者」の数であり、新たな鍵を増やすことだけを喜びとする。" }, // D81-83
  { id: "el_soulflayer", name: "魂剥ぎの主", elite: true, rank: 10, race: "specter", element: "dark", artKey: "wraith", soulClass: "bishop",
    palette: tint(ARTS.wraith.palette, "#6a3a8a", 0.55),
    desc: "刈り取った魂の「殻」を剥ぎ、冥府への通行料として徴収する首魁。剥がれた魂は名を忘れ、名を忘れた魂は、もう誰にも弔えない。" }, // D84-86
  { id: "el_palerider", name: "蒼褪めた騎手", elite: true, rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#d8d8d0", 0.6),
    desc: "冥門の前を往復し続ける蒼褪めた騎手。その馬蹄の音を三度聞いた者の枕元に現れ、四度目の蹄鉄を額に打ち込むという。" }, // D87-90
  // -- 迷宮 91-100 (玄室帯) / 強敵ランク10 --
  { id: "el_dragonslayer", name: "竜殺しの亡霊", elite: true, rank: 10, race: "specter", element: "none", artKey: "wraith", soulClass: "fighter",
    palette: tint(ARTS.wraith.palette, "#c0c8d8", 0.5),
    desc: "百の竜を屠り、最後は竜の財宝の上で息絶えた英雄の亡霊。竜殺しの本能だけが残り、玄室を訪れる「竜より強き者」を新たな獲物と定めた。" }, // D91-93
  { id: "el_goldtyrant", name: "黄金の暴君竜", elite: true, rank: 10, race: "dragon", element: "light", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#e8c84a", 0.55),
    desc: "喰らった黄金が鱗となり、全身が財宝と化した暴君竜。己の体こそ世界最大の秘宝と誇り、それを見た者を生かして帰さぬことで価値を守る。" }, // D94-96
  { id: "el_eclipsedragon", name: "日蝕の竜", elite: true, rank: 10, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#141420", 0.6),
    desc: "天の竜が太陽を呑む——日蝕の伝承そのものが実体化した竜。その翼が広がると玄室の灯りがすべて翳り、闇の中で竜だけが昏く輝く。" }, // D97-100
];
// 強敵はボス相当のステータスを与える (elite フラグで通常プールから除外される)
const ELITE_MONSTERS = defMonsters(ELITE_DEFS.map((d) => ({ ...monStats(d.rank, true), ...d })));

// 強敵の割り当て順: ランク帯 r (1-10)・帯内グループ g (0: 1-3 / 1: 4-6 / 2: 7-10) →
// ELITE_ORDER[(r-1)*3 + g]。BOSS_ORDER と同じく並び順は変更禁止 (追記のみ)。
export const ELITE_ORDER = ELITE_DEFS.map((d) => d.id);
if (ELITE_ORDER.length !== 30) throw new Error("bestiary: ELITE_ORDER must have 30 entries (10 ranks x 3 groups)");

// ---- 統合辞書とランク別プール ----
export const BESTIARY = (() => {
  const out = { ...LEGACY };
  for (const id in NEW_MONSTERS) {
    if (out[id]) throw new Error("duplicate monster id: " + id);
    out[id] = NEW_MONSTERS[id];
  }
  // 強敵を辞書に統合 (RANK_POOLS からは除外)
  for (const id in ELITE_MONSTERS) {
    if (out[id]) throw new Error("duplicate monster id: " + id);
    out[id] = ELITE_MONSTERS[id];
  }
  return out;
})();

// ランク → { regular: [id], boss: [id] } (generator.js が出現テーブルを組むのに使う)
export const RANK_POOLS = (() => {
  const pools = {};
  for (const id in BESTIARY) {
    const m = BESTIARY[id];
    if (m.elite) continue; // 強敵は通常プールに含めない
    const p = pools[m.rank] || (pools[m.rank] = { regular: [], boss: [] });
    (m.boss ? p.boss : p.regular).push(id);
  }
  for (let r = 1; r <= 10; r++) {
    const p = pools[r];
    if (!p || !p.regular.length) throw new Error("bestiary: no regular monsters for rank " + r);
    if (!p.boss.length) throw new Error("bestiary: no boss for rank " + r);
  }
  return pools;
})();

// ===== 迷宮ごとの固有ボス割り当て =====
// BOSS_ORDER[rank][p] = そのランク帯の p 番目 (迷宮番号 n = (rank-1)*10 + p + 1) の主。
// 全100迷宮のボスはすべて異なる個体になる。並び順はセーブ/図鑑の体験に直結するため
// 変更禁止 (新ランク帯を作る時だけ追記する)。
export const BOSS_ORDER = {
  1: ["bs_cryptabbot", "bs_whispercollector", "bs_bloodcoffin", "bs_ossuarygiant", "bs_slimeking",
      "bs_ashprelate", "bs_welldweller", "bs_chainwarden", "bs_sarcophaguslord", "bs_boneemperor"],
  2: ["bs_foremanwraith", "bs_bonecollier", "bs_goblinchief", "bs_saltcolossus", "bs_frostmaggot",
      "bs_brimstonefiend", "bs_steamtyrant", "d01_gaoler", "bs_leadenking", "bs_rustwyrm"],
  3: ["d02_lord", "bs_lastbanneret", "bs_bloodfeastogre", "bs_squareghost", "bs_frozenarcher",
      "bs_granarymaw", "bs_headsmanwraith", "bs_ironcagewarden", "bs_duskcastellan", "bs_warhostrevenant"],
  4: ["bs_mistwolfking", "bs_hollowkodama", "bs_bloodbriar", "bs_minotaur", "bs_birchwitch",
      "bs_pyretreant", "bs_bogtyrant", "bs_curseroot", "bs_rotgardener", "bs_mireforestking"],
  5: ["bs_drownedpontiff", "bs_altarguardian", "bs_sacrificelord", "bs_whisperingidol", "d03_whelp",
      "bs_blazeseraph", "bs_nagamatriarch", "bs_cursedpontifex", "bs_duskapostle", "bs_ordealavatar"],
  6: ["bs_magmacentipede", "bs_cinderknight", "bs_boilingmass", "bs_fumarolelord", "bs_venomhydra",
      "bs_cyclops", "bs_calderawyrm", "bs_flameheresiarch", "bs_emberking", "bs_infernowyrm"],
  7: ["bs_crystalwyrm", "bs_snowsexton", "bs_frozenwarden", "bs_blizzardvoice", "bs_glacialgiant",
      "bs_paradoxgenie", "bs_hydra", "bs_rimecastellan", "bs_eternalsnowbeast", "bs_iciclequeen"],
  8: ["bs_stormroc", "bs_skywarden", "bs_thunderprelate", "bs_cyclonedjinn", "bs_stormfrostgiant",
      "bs_stormdrake", "bs_darkcloudspawn", "bs_archdemon", "bs_ruincore", "bs_galesovereign"],
  9: ["bs_hellgatehound", "bs_ferrymanshade", "bs_bloodjudge", "bs_processionlord", "bs_palefrostking",
      "bs_hellfirejailer", "d04_vritra", "bs_styxcrone", "bs_duskmausoleum", "bs_soulgaoler"],
  10: ["bs_elderwyrmking", "bs_hoardwarden", "bs_broodmother", "bs_dracolich", "bs_frostwyrmlord",
       "bs_reddragon", "bs_abyssdrake", "bs_dragongodshade", "bs_twilightdragon", "bs_abysslord"],
};
{ // 検証: 各ランク10体・全体で重複なし・実在し boss かつランク一致
  const seen = new Set();
  for (let r = 1; r <= 10; r++) {
    const list = BOSS_ORDER[r] || [];
    if (list.length !== 10) throw new Error("BOSS_ORDER: rank " + r + " must list exactly 10 bosses");
    for (const id of list) {
      const m = BESTIARY[id];
      if (!m || !m.boss || m.rank !== r) throw new Error("BOSS_ORDER: invalid boss " + id + " for rank " + r);
      if (seen.has(id)) throw new Error("BOSS_ORDER: duplicate boss " + id);
      seen.add(id);
    }
  }
}
