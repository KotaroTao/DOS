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
  { id: "bs_scorpion", name: "鉄鋏の毒蠍", rank: 3, race: "insect", element: "earth", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#b8923a", 0.4),
    desc: "鎧の継ぎ目を断ち切る鋏と、心の臓を直に灼く尾針を併せ持つ大蠍。乾いた床を擦る音が死の予鈴となる。" },
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
    desc: "溶岩の川を寝床とする火蜥蜴。鱗の隙間から覗く体内は熾火の色で、噛み傷は永く焼け続けるという。" },
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
    desc: "鷲の眼と獅子の躯を併せ持つ空の王。黄金を巣に敷く習性ゆえ、財宝の眠る迷宮を縄張りに選んだ。" },
  { id: "bs_naga", name: "ナーガ", rank: 7, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#7a4aa0", 0.35),
    desc: "下半身が大蛇と化した蛇神の眷属。千年の祈りを捧げた古い祭壇を、今も鱗の塒で抱え込んでいる。" },
  { id: "bs_vampire", name: "ヴァンパイア", rank: 7, race: "undead", element: "dark", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#a02a3a", 0.35),
    desc: "夜の貴族。血を啜るのは渇きのためではなく、奪った命の記憶を味わうためだという。月夜には誰も敵わない。" },
  { id: "bs_hydra", name: "九首のヒュドラ", rank: 7, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#2a6a9a", 0.35),
    desc: "ひとつ落とせばふたつ生える九つ首の毒蛇竜。退治の英雄譚は数あれど、骸を見た者はひとりもいない。" },
  // -- rank 8 --
  { id: "bs_demon", name: "獄炎のデーモン", rank: 8, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#6a1a1a", 0.3),
    desc: "地獄の位階に名を連ねる上級魔。その体躯は燃え続ける憎悪そのもので、足跡には硫黄の火が残る。" },
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
    desc: "冥府の門を守ると誓った騎士の末路。その剣に斬られた者は傷ではなく、生きる理由を失って斃れる。" },
  // -- rank 10 --
  { id: "bs_voiddragon", name: "虚無竜", rank: 10, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a1a2a", 0.45),
    desc: "星々の隙間の何もない場所から迷い込んだ竜。その鱗は光を返さず、咆哮は音ではなく静寂として届く。" },
  { id: "bs_seraphwraith", name: "終末の使徒", rank: 10, race: "specter", element: "light", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#e8e2c0", 0.4),
    desc: "世界の終わりを告げるために遣わされたという白い影。喇叭は携えていない。もう吹き終えたのかもしれない。" },
  { id: "bs_chaosknight", name: "混沌の騎士", rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#7a2a8a", 0.4),
    desc: "百の戦場で百の主君に仕え、そのすべてを裏切った剣鬼。鎧の下にあるのが人なのか、誰も確かめていない。" },
  { id: "bs_reddragon", name: "レッドドラゴン", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    desc: "灼熱の血を巡らせる竜の中の竜。その吐息は城壁を飴のように溶かし、財宝の山を褥に千年を眠る。竜殺しを名乗りたくば、まずこの焔の前に立て。" },
  { id: "bs_abysslord", name: "深淵の王", rank: 10, boss: true, race: "demon", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#c8a23a", 0.4),
    desc: "百層の迷宮、そのすべての闇が流れ着く玉座に座す者。迷宮で果てた魂はみな、この王の冠の飾りになるという。" },
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
