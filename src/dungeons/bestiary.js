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
  { id: "bs_goblin", name: "ゴブリン", rank: 1, race: "humanoid", element: "none", artKey: "kobold", soulClass: "thief",
    palette: tint(ARTS.kobold.palette, "#4a8a3a", 0.35),
    desc: "迷宮の浅瀬に巣食う緑肌の小鬼。賢くはないが、罠の在処と人の急所だけはよく憶えている。" },
  { id: "bs_slimeking", name: "ジャイアントスライム", rank: 1, boss: true, race: "amorph", element: "water", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#3a6ad0", 0.3),
    desc: "幾百の粘塊が呑み合い、ひとつに膨れ上がった巨大な王。呑まれた者の得物が、半透明の体内に何本も沈んでいる。" },
  // -- rank 2 --
  { id: "bs_zombie", name: "腐乱死体", rank: 2, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#5a8a4a", 0.4),
    desc: "土に還ることを許されなかった亡骸。腐汁の滴る腕で生者を掴み、己と同じ地獄へ引きずり込もうとする。" },
  { id: "bs_direwolf", name: "灰色の大狼", rank: 2, race: "beast", element: "none", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#9aa3ab", 0.35),
    desc: "群れを失い、迷宮を新たな狩場に選んだ大狼。遠吠えは出口の方角から聞こえる。帰り道を断つためだ。" },
  { id: "bs_goblinchief", name: "ゴブリンの族長", rank: 2, boss: true, race: "humanoid", element: "fire", artKey: "kobold", soulClass: "fighter",
    palette: tint(ARTS.kobold.palette, "#c04a3a", 0.35),
    desc: "屍から剥いだ鎧を勲章のように重ね着た、ゴブリンどもの長。配下を盾に、戦利品の山の上から戦を眺める。" },
  // -- rank 3 --
  { id: "bs_werewolf", name: "人狼", rank: 3, race: "beast", element: "dark", artKey: "beast", soulClass: "fighter",
    palette: tint(ARTS.beast.palette, "#3a3a46", 0.35),
    desc: "月のない迷宮の闇でこそ獣性が猛る呪われた人。引き裂いた相手の悲鳴で、わずかに残った人の心が軋む。" },
  { id: "bs_scorpion", name: "鉄ばさみの毒さそり", rank: 3, race: "insect", element: "earth", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#b8923a", 0.4),
    desc: "鎧の継ぎ目を断ち切るはさみと、心の臓を直に灼く尾針を併せ持つ大さそり。乾いた床を擦る音が死の予鈴となる。" },
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
  { id: "bs_mudbeetle", name: "泥甲虫", rank: 1, race: "insect", element: "earth", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#6a4a2a", 0.4),
    desc: "湿った地下の通路を這い回る硬殻の甲虫。踏みつけても鎧のような甲羅が足を跳ね返し、指の隙間から毒液を染み込ませる。" },
  { id: "bs_drainrat", name: "溝鼠", rank: 1, race: "beast", element: "none", artKey: "kobold",
    palette: tint(ARTS.kobold.palette, "#7a6a5a", 0.4),
    desc: "下水と骸の悪臭に慣れきった大鼠。小賢しく群れをなし、眠った者の耳や指から順にかじり始める。" },
  { id: "bs_shroomspirit", name: "毒キノコの魔", rank: 1, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#9a3a7a", 0.4),
    desc: "地下墓地の湿気を糧に育った毒キノコの化身。胞子を吸った者は幻を見ながら眠り続け、そのまま二度と目覚めない。" },
  { id: "bs_bonebat", name: "骸蝙蝠", rank: 1, race: "undead", element: "dark", artKey: "bat",
    palette: tint(ARTS.bat.palette, "#c8c8c8", 0.5),
    desc: "死した蝙蝠の骨が呪いで再び飛び回る亡者。羽ばたくたびに骨粉が散り、その粉を吸い込んだ者の肺が内から蝕まれる。" },
  // -- rank 2 追加 (+5) --
  { id: "bs_shadowhound", name: "影犬", rank: 2, race: "beast", element: "dark", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#2a2a3a", 0.5),
    desc: "坑道の影が犬の形を借りた呪いの獣。光を持つ者に噛みつき、その光ごと奪い去る。暗闇の中でだけ、赤い目が輝く。" },
  { id: "bs_gnoll", name: "ゴール", rank: 2, race: "humanoid", element: "earth", artKey: "orc", soulClass: "fighter",
    palette: tint(ARTS.orc.palette, "#9a8a3a", 0.35),
    desc: "ハイエナの顎を持つ異形の戦士。骨ごと噛み砕く噛む力を誇り、迷宮で死んだ者の装備を剥いで身につける。" },
  { id: "bs_spiritbat", name: "霊蝙蝠", rank: 2, race: "specter", element: "dark", artKey: "bat",
    palette: tint(ARTS.bat.palette, "#5a2a8a", 0.4),
    desc: "坑道の亡霊が蝙蝠の形を借りた霊体。噛まれた箇所は寒気を帯び、体温を奪われた者から順に意識が遠のく。" },
  { id: "bs_hobgoblin", name: "ホブゴブリン", rank: 2, race: "humanoid", element: "none", artKey: "kobold", soulClass: "thief",
    palette: tint(ARTS.kobold.palette, "#8a6a2a", 0.4),
    desc: "ゴブリンの中でも知恵と体格に恵まれた上位種。仲間をおとりに使い、退路を断いた上で奇襲するのを好む。" },
  { id: "bs_swampslime", name: "毒沼スライム", rank: 2, race: "amorph", element: "earth", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#4a8a2a", 0.4),
    desc: "鉱毒を溶かし込んだ粘塊。触れた武器を緑色に染め、その毒が傷口から血液へと溶け込む。迷宮の床が緑色なら、すでに領域だ。" },
  // -- rank 3 追加 (+5) --
  { id: "bs_darkelf", name: "闇の射手", rank: 3, race: "humanoid", element: "dark", artKey: "kobold", soulClass: "thief",
    palette: tint(ARTS.kobold.palette, "#3a2a5a", 0.45),
    desc: "光を嫌い廃砦の奥に巣食う弓の使い手。暗闇でも正確に射る矢は呪いで染まり、刺さった先から腐敗が広がる。" },
  { id: "bs_poisonspider", name: "毒蜘蛛", rank: 3, race: "insect", element: "earth", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#2a6a2a", 0.45),
    desc: "砦の天井に巣を張り、人が通るのをじっと待ち続ける大蜘蛛。毒の牙で獲物を麻痺させてから、蜘蛛糸で巻いて食料庫へ運ぶ。" },
  { id: "bs_waterelemental", name: "水の精霊", rank: 3, race: "elemental", element: "water", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#2a6a9a", 0.35),
    desc: "砦跡の地下水脈に宿った水の精霊。人の形を模して歩くが、斬れば水に戻り、水に戻れば再び形を結ぶ。" },
  { id: "bs_marshgolem", name: "泥のゴーレム", rank: 3, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#5a4a2a", 0.45),
    desc: "廃砦跡の湿地に積もった泥が、呪文の残りかすを吸って動き出したゴーレム。動くたびに腐臭をまき散らし、跡には沼の跡が残る。" },
  { id: "bs_hexwolf", name: "呪詛の狼", rank: 3, race: "beast", element: "dark", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#4a3a6a", 0.4),
    desc: "呪詛の言葉を刻まれ、死してなお走り続ける狼の亡骸。噛まれた傷は癒えず、噛まれた者は夢の中で追われ続ける。" },
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
];

// 新規分にランク基準ステータスを与えてから検証・登録する
const NEW_MONSTERS = defMonsters(NEW_DEFS.map((d) => ({ ...monStats(d.rank, d.boss), ...d })));

// ---- 統合辞書とランク別プール ----
export const BESTIARY = (() => {
  const out = { ...LEGACY };
  for (const id in NEW_MONSTERS) {
    if (out[id]) throw new Error("duplicate monster id: " + id);
    out[id] = NEW_MONSTERS[id];
  }
  return out;
})();

// ランク → { regular: [id], boss: [id] } (generator.js が出現テーブルを組むのに使う)
export const RANK_POOLS = (() => {
  const pools = {};
  for (const id in BESTIARY) {
    const m = BESTIARY[id];
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
