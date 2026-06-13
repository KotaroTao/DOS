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
  // -- 第1層「墓地」 (rank 1-2) --
  { id: "bs_gravewisp", name: "墓火", rank: 1, race: "specter", element: "dark", artKey: "gravewisp",
    magWeak: 1.6, evasive: true, ability: null, // 実体を持たぬ鬼火: 魔法に脆く、刃はすり抜ける
    desc: "墓地の夜に漂う青い鬼火。死にきれぬ者の未練が、火の玉となって彷徨う姿だという。刃は炎をすり抜けてしまうが、ひとたび魔の力を浴びれば、たちまち掻き消える。" },
  { id: "bs_grasphand", name: "這い寄る腐手", rank: 1, race: "undead", element: "dark", artKey: "grasphand",
    ability: "paralyze", pack: true, // 土から無数に突き出し、掴んで痺れさせる
    desc: "埋葬を拒まれた者たちの、腐り落ちた手だけが土を破って這い出る。足首を掴まれた者は、冷たい指の感触に総毛立ち、その場に縫い止められる。一本では弱いが、墓所では群れを成す。" },
  { id: "bs_corpsemaggot", name: "屍蛆", rank: 1, race: "undead", element: "dark", artKey: "corpsemaggot",
    ability: "poison", pack: true, // 腐肉に湧き、群れで毒の体液を吐く
    desc: "墓の下で膨れに膨れた、人の頭ほどもある肥えた蛆。腐肉を喰らって育ち、噛みつくと腐敗の毒を流し込む。一匹見つけたなら、土の下にはその百倍が蠢いている。" },
  { id: "bs_carrioncrow", name: "腐肉啄みの大鴉", rank: 1, race: "avian", element: "dark", artKey: "carrioncrow",
    swift: true, pack: true, // 墓を漁る賢しい黒鴉。素早く群れる
    desc: "墓地の梢に鈴なりにとまり、埋めたばかりの土を狙う賢い黒鴉。死を嗅ぎつける鼻は早く、群れで一斉に舞い降りては、目玉から先につついていく。" },
  { id: "bs_goblin", name: "ゴブリン", rank: 1, race: "humanoid", element: "none", artKey: "goblin", soulClass: "thief",
    ability: "goldSteal", swift: true, // 素早い身のこなしで懐を狙う
    desc: "迷宮の浅瀬に巣食う緑肌の小鬼。賢くはないが、罠の在処と人の急所、そして財布の場所だけはよく憶えている。すばしこく間合いに飛び込み、金品をかすめ取って逃げる。" },
  { id: "bs_slimeking", name: "ジャイアントスライム", rank: 1, boss: true, race: "amorph", element: "water", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#3a6ad0", 0.3),
    desc: "幾百の粘塊が呑み合い、ひとつに膨れ上がった巨大な王。呑まれた者の得物が、半透明の体内に何本も沈んでいる。" },
  // -- rank 2 --
  { id: "bs_mournshade", name: "嘆きの喪影", rank: 2, race: "specter", element: "dark", artKey: "mournshade", soulClass: "hexer",
    ability: "weaken", // 弔いの嘆きが、生者の力を萎えさせる
    desc: "墓前で頭を垂れ、青白い顔から尽きぬ涙を流す喪服の霊。その嘆きを聞いた者は、四肢から力が抜け、剣を握ることすら億劫になる。誰の葬列だったのかは、もう霊自身も覚えていない。" },
  { id: "bs_ghoul", name: "喰屍鬼", rank: 2, race: "undead", element: "dark", artKey: "ghoul",
    lifesteal: 0.35, // 屍肉を喰らい、与えた傷の分だけ己を肥やす
    desc: "墓を暴いて屍肉を貪るうちに、人であることを忘れた痩せ枯れの鬼。長い爪で生者を裂き、その肉片を喰らっては傷を塞ぐ。満たされることのない飢えだけが、こいつを動かしている。" },
  { id: "bs_bonepile", name: "蠢く骨山", rank: 2, race: "undead", element: "none", artKey: "bonepile",
    physResist: 0.5, barrier: 2, // 累々と積もった骨。崩しても組み上がる
    desc: "幾百の骸が崩れ落ち、ひとつの山となって蠢く。刃を突き立てても、ただ骨を一本叩き落とすだけ。砕いたそばから別の骨が組み上がり、いつまでも崩れきらない。" },
  { id: "bs_skullswarm", name: "髑髏の群れ", rank: 2, race: "undead", element: "dark", artKey: "skullswarm",
    pack: true, multistrike: 2, // 宙を舞う髑髏の群体。次々に噛みつく
    desc: "怨念に浮かび上がった髑髏が、群れをなして宙を舞う。歯を鳴らして次々に噛みつき、一体を払っても、すぐ別の顎が背後から迫る。静寂の墓地に響く笑い声は、こいつらの顎の音だ。" },
  { id: "bs_sarcoguard", name: "石棺の番人", rank: 2, race: "construct", element: "none", artKey: "sarcoguard",
    role: "guard", barrier: 2, // 棺の主を護り、刃を数度受け止める石の番人
    desc: "石棺の蓋に彫られた守護者が、眠りを侵す者の前に立ちはだかる。腕を組んだまま一歩も退かず、後ろに控える同胞への一撃をことごとく己の石body で受け止める。砕くには、まずこの番人を黙らせるしかない。" },
  { id: "bs_weepangel", name: "啜り泣く墓像", rank: 2, race: "construct", element: "none", artKey: "weepangel",
    physResist: 0.5, ability: "weaken", // 顔を覆って泣く石像。嘆きが力を奪う
    desc: "墓を見守る翼ある石像。顔を両手で覆い、永遠に啜り泣いている。その嘆きの声を浴びた者は、剣を振るう気力すら萎えていく。石の体は並の刃を寄せつけない。" },
  { id: "bs_pettyrevenant", name: "浅き怨霊", rank: 2, race: "specter", element: "dark", artKey: "pettyrevenant",
    enrage: true, // 痛めつけられるほど恨みが燃え上がる
    desc: "果たせぬ恨みを抱いたまま、浅い眠りから覚めた新しい霊。まだ力は弱いが、傷つけられるたびに恨みが煮えたぎり、終いには手のつけられぬ憤怒の塊となって襲いかかる。" },
  { id: "bs_shroudstrangler", name: "経帷子の絞め手", rank: 2, race: "specter", element: "dark", artKey: "shroudstrangler",
    ability: "paralyze", // 垂れた死装束で首を絞め、痺れさせる
    desc: "葬送の経帷子だけが宙に漂い、生者を見つけては垂れた布で首に巻きつく。締め上げられた者は声も出せず、痺れて崩れ落ちる。中に骸はない。布そのものが、絞めたがっているのだ。" },
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
  // -- 第2層「地下水路」 (rank 3-4・水棲/不定形。第1層より明確に格上＝壁) --
  { id: "bs_giantleech", name: "吸血大蛭", rank: 3, race: "amorph", element: "water", artKey: "giantleech",
    lifesteal: 0.4, regen: 0.06, // 吸い付いて血を奪い、その分だけ膨れて回復する
    desc: "下水の澱みに潜む、人ほどもある肥えた蛭。一度吸い付けば離れず、奪った血の分だけ赤黒く膨れ上がっていく。斬りつけても、貪った命で見る間に傷を塞ぐ。" },
  { id: "bs_sludgeooze", name: "汚泥の塊", rank: 3, race: "amorph", element: "water", artKey: "sludgeooze",
    physResist: 0.55, ability: "poison", regen: 0.08, // 刃が沈んで効かず、毒の泥を浴びせ、崩れても寄り集まる
    desc: "幾年もの汚物が澱み、意思を持つに至った毒の泥。刃を突き立てても泥に沈んで手応えがなく、崩した先から寄り集まって元に戻る。触れたものは残らず腐臭の毒に冒される。" },
  { id: "bs_toxictoad", name: "毒吐き大蛙", rank: 3, race: "aquatic", element: "water", artKey: "toxictoad",
    ability: "poison", magWeak: 1.4, // 膨れた毒腺から瘴気を吐く。火球には弱い
    desc: "暗渠の縁にうずくまる、毒腺で膨れ上がった大蛙。喉を膨らませて瘴気を吐き、近づく者を毒で痺れさせる。脂の乗った体は、火の魔法でよく焼ける。" },
  { id: "bs_drownedcorpse", name: "水死体", rank: 4, race: "undead", element: "water", artKey: "drownedcorpse",
    ability: "paralyze", enrage: true, // 冷たい手で掴んで痺れさせ、傷つくほど暴れ狂う
    desc: "水路に沈み、膨れて青ざめた溺死者の群れ。冷たくふやけた手で生者を掴み、底へ引きずり込もうとする。痛めつけるほど、満たされぬ恨みで滅茶苦茶に暴れだす。" },
  { id: "bs_eelfiend", name: "噛みつき大鰻", rank: 4, race: "aquatic", element: "water", artKey: "eelfiend",
    ability: "paralyze", swift: true, multistrike: 2, // 帯電した牙で素早く二度噛みつき痺れさせる
    desc: "暗渠を音もなく泳ぐ、腕ほどもある獰猛な鰻。帯電した牙で素早く二度三度と噛みつき、痺れて沈む獲物を悠々と呑み込む。水中では誰よりも速い。" },
  { id: "bs_sewerlord", name: "水路の主", rank: 4, boss: true, race: "aquatic", element: "water", artKey: "sewerlord", soulClass: "priest",
    role: "summoner", summonKey: "bs_sludgeooze", regen: 0.06, physResist: 0.4, // 汚泥を呼び、刃を沈め、澱みで傷を癒す
    desc: "地下水路のすべての澱みを統べる、巨大な両生の主。腹を空かせた汚泥を次々と呼び寄せ、生者を泥の海へ沈める。分厚い粘膜は刃をろくに通さず、濁り水に浸かるたび傷が塞がる。" },
  { id: "bs_sewercrab", name: "鋏の大蟹", rank: 3, race: "aquatic", element: "water", artKey: "sewercrab",
    physResist: 0.5, barrier: 2, // 鋼の甲羅が刃を弾き、数度は完全に受け止める
    desc: "汚水に肥え太った、大盾ほどもある巨大蟹。鋼を思わせる甲羅は並の刃をすべて弾き返し、両の鋏は鎧ごと人を断つ。横歩きで間合いを詰めてくる音は、暗渠によく響く。" },
  { id: "bs_abysstentacle", name: "深淵の触手", rank: 4, race: "aquatic", element: "water", artKey: "abysstentacle",
    ability: "paralyze", multistrike: 2, // 絡めて痺れさせ、何度も締め上げる
    desc: "排水路の底知れぬ闇から伸びる、吸盤だらけの太い腕。獲物を絡め取って痺れさせ、二度三度と締め上げる。本体がどれほどの大きさなのか、生きて見た者はいない。" },
  { id: "bs_brinewraith", name: "塩水の亡霊", rank: 4, race: "specter", element: "water", artKey: "brinewraith",
    ability: "drain", lifesteal: 0.3, // 溺死した恨みで命を吸い、己の存在を保つ
    desc: "下水に流れ着いて溺れ死んだ水夫たちの霊。塩に蝕まれた半透明の体で生者に取り憑き、その温もりと命を吸って束の間この世に留まる。吸った分だけ、輪郭が濃くなる。" },
  { id: "bs_anglerfiend", name: "提灯鮟鱇", rank: 4, race: "aquatic", element: "water", artKey: "anglerfiend",
    ability: "paralyze", magWeak: 1.3, // 誘いの光で痺れさせる。脂の体は火に弱い
    desc: "暗渠の闇を漂う、巨大な口を持つ醜い魚。額から垂らした青白い誘い灯で獲物を惑わせ、痺れたところを丸呑みにする。脂の乗った体は、炎の魔法でよく焼ける。" },
  { id: "bs_bloatfly", name: "腐肉蠅の群れ", rank: 3, race: "insect", element: "dark", artKey: "bloatfly",
    pack: true, ability: "poison", evasive: true, // 群れで湧き、毒をまき散らし、叩こうにも素早く飛び回る
    desc: "汚水と腐肉に湧いた、握り拳ほどもある肥えた羽虫の群れ。羽音とともに毒の鱗粉をまき散らし、叩き落とそうにも素早く飛び回ってかわす。一匹潰せば、十匹が湧く。" },
  { id: "bs_waterhag", name: "水路の妖婆", rank: 4, race: "specter", element: "water", artKey: "waterhag", soulClass: "hexer",
    ability: "weaken", regen: 0.07, // 呪詛で力を奪い、藻に塗れた身を濁り水で繕う
    desc: "水路に身を投げ、藻に塗れて妖と化した老婆の霊。濁った目で睨み、しわがれた呪詛を浴びせて生者の力を奪う。濁り水に浸かるたび、崩れた体をつくろい直す。" },
  { id: "bs_mucusworm", name: "粘液の長虫", rank: 3, race: "amorph", element: "water", artKey: "mucusworm",
    ability: "poison", physResist: 0.45, regen: 0.06, // 毒粘液をまとい、刃をすべらせ、ちぎれても繋がる
    desc: "暗渠の壁を這う、半透明の巨大な環形虫。全身を覆う毒の粘液が刃をぬるりとすべらせ、断ち切ってもすぐに繋がり直す。触れた皮膚は、たちまち爛れる。" },
  { id: "bs_razorshrimp", name: "鎌首の大蝦", rank: 3, race: "aquatic", element: "water", artKey: "razorshrimp",
    swift: true, multistrike: 2, // 鎌のような前肢で目にも留まらぬ連打を放つ
    desc: "水底に潜み、鎌のような前肢を一閃させる大蝦。その打撃は水を割って轟き、甲羅すら砕く。目にも留まらぬ速さで二度三度と打ち込み、獲物が気づく前に砕いている。" },
  { id: "bs_ironcarp", name: "鋼鱗の大鯉", rank: 4, race: "aquatic", element: "water", artKey: "ironcarp",
    physResist: 0.6, barrier: 2, magWeak: 1.3, // 鋼の鱗が刃を弾くが、魔法の熱には脆い
    desc: "幾百年を生きて鋼のごとき鱗をまとった、ぬしと呼ばれる大鯉。並の刃は鱗に弾かれ傷一つ通らない。だが冷たい体は魔法の熱に脆く、火や雷を浴びれば一たまりもない。" },
  { id: "bs_fogspecter", name: "汚水の靄", rank: 3, race: "specter", element: "water", artKey: "fogspecter",
    ability: "paralyze", evasive: true, magWeak: 1.5, // 実体なく刃をすり抜け、瘴気で痺れさせる。魔には脆い
    desc: "汚水から立ちのぼる瘴気が、ぼんやりと人の形をなした霊。刃は霧をすり抜けてしまい、まとわりつく毒気に触れた者は痺れて動けなくなる。実体が薄いぶん、魔の力には抗えない。" },
  // -- 第3層「廃坑」 (rank 4-5・土/採掘。第2層より格上の壁。深部に rank6 の旧坑の主) --
  { id: "bs_rockworm", name: "岩喰いの大蟲", rank: 4, race: "insect", element: "earth", artKey: "rockworm",
    physResist: 0.5, multistrike: 2, // 岩盤ごと喰らう顎で続けざまに噛み砕く
    desc: "坑道の岩盤を喰らって掘り進む、人を丸呑みにする環形の大蟲。円い口にびっしり並んだ歯で岩ごと獲物を削り取り、二度三度と噛み砕く。硬い体節は刃をほとんど通さない。" },
  { id: "bs_dustwraith", name: "粉塵の亡霊", rank: 4, race: "specter", element: "earth", artKey: "dustwraith",
    ability: "poison", evasive: true, magWeak: 1.4, // 炭塵を吸わせて蝕み、掴みどころがない。魔には脆い
    desc: "落盤と炭塵に巻かれて窒息した坑夫たちの霊が、黒い粉塵の渦となって彷徨う。吸い込めば肺を蝕む毒の塵をまき散らし、刃を向けても渦の中をすり抜ける。光の魔法には掻き消される。" },
  { id: "bs_crystalcrawler", name: "水晶喰い蟲", rank: 5, race: "insect", element: "earth", artKey: "crystalcrawler",
    physResist: 0.5, magResist: 0.5, barrier: 2, // 鉱脈を喰らい水晶の鎧をまとう。刃も魔も通りにくい
    desc: "鉱脈の水晶を喰らって育ち、背に鋭い結晶の鎧を生やした巨大な甲虫。刃は結晶に弾かれ、魔力もまた水晶に吸われて霧散する。生半可な攻撃では、傷一つつけられない。" },
  { id: "bs_blastsprite", name: "坑火の精", rank: 4, race: "elemental", element: "fire", artKey: "blastsprite",
    enrage: true, magWeak: 1.4, // 坑道に溜まる可燃ガスの化身。追い詰めると爆ぜる
    desc: "閉ざされた坑道に溜まった可燃ガスが、ゆらめく火の精と化したもの。揺らめきながら近づき、傷つけられて追い詰められると、内に溜めた炎を一気に爆ぜさせる。水気のない体は、魔法でかえって燃え上がる。" },
  { id: "bs_orehulk", name: "鉱滓の巨塊", rank: 5, race: "construct", element: "earth", artKey: "orehulk",
    physResist: 0.6, barrier: 2, // 捨てられた鉱滓の塊。分厚い殻が刃を阻む
    desc: "精錬で捨てられた鉱滓が幾年も積もり、熱を孕んだまま動き出した巨塊。光る鉱脈が体を走り、分厚い滓の殻は並の刃を寄せつけない。ひと振りの拳は、坑道の梁すら叩き折る。" },
  { id: "bs_tunneler", name: "坑道掘りの獣", rank: 4, race: "beast", element: "earth", artKey: "tunneler",
    swift: true, multistrike: 2, // 土に潜んで奇襲し、巨大な前肢で素早く掘り穿つ
    desc: "盲いた目で土中を泳ぐように掘り進む、巨大な前肢を持つ獣。気配を断って土から飛び出し、岩をも砕く鉤爪で素早く二度抉る。気づいた時には、足元の土が崩れている。" },
  { id: "bs_minelord", name: "坑道の主", rank: 5, boss: true, race: "giant", element: "earth", artKey: "minelord", soulClass: "fighter",
    role: "summoner", summonKey: "bs_rockworm", physResist: 0.5, barrier: 3, enrage: true, // 坑蟲を呼び、刃を阻み、手負いで荒れ狂う
    desc: "廃坑の闇そのものが岩を寄せ集めて形をなした、坑道の主。腹の底で燃える鉱脈を脈打たせ、岩を喰らう蟲を次々と呼び寄せる。分厚い岩の殻は刃を阻み、砕かれるほどに怒りで坑道を揺らす。" },
  // -- 第4層「捨て砦」 (rank 5-6・武装/戦の亡霊。第3層より格上の壁。深部に rank7 の騎士) --
  { id: "bs_siegeballista", name: "自走弩砲", rank: 6, race: "construct", element: "none", artKey: "siegeballista",
    physResist: 0.5, ability: "critical", // 鉄枠が刃を阻み、狙い澄ました大弩で急所を貫く
    desc: "守備兵が絶えてなお、砦に残された巨大な弩が己の意思で動き出したもの。軋みながら標的に狙いを定め、城門すら貫く大矢を放つ。鉄と樫の枠は、並の刃を寄せつけない。" },
  { id: "bs_bannerwraith", name: "軍旗の亡霊", rank: 5, race: "specter", element: "none", artKey: "bannerwraith",
    role: "summoner", summonKey: "d03_sentinel", ability: "warcry", // 朽ちた軍旗を掲げ、亡兵を呼び、号令で奮い立たせる
    desc: "陥落の際まで軍旗を手放さなかった旗手の霊。今も朽ちた旗を高く掲げ、眠る亡兵を呼び覚ましては、しわがれた号令で奮い立たせる。旗が立つ限り、砦の死者は戦いをやめない。" },
  { id: "bs_gravecaptain", name: "亡き守備隊長", rank: 6, race: "armored", element: "none", artKey: "gravecaptain",
    ability: "critical", enrage: true, // 号令とともに急所を狙い、追い詰められると鬼気迫る
    desc: "砦と運命を共にした守備隊長の骸。錆びた指揮刀を振るい、配下の亡兵を叱咤しながら自ら先頭で斬りかかる。劣勢になるほど、果たせなかった守備の責で鬼気迫る猛攻に転じる。" },
  { id: "bs_pikewall", name: "亡兵の槍衾", rank: 5, race: "undead", element: "none", artKey: "pikewall",
    role: "guard", physResist: 0.5, multistrike: 2, // 盾を並べて前を固く守り、突き出した槍で連突する
    desc: "盾を並べ、槍を揃えて突き出したまま朽ちた歩兵の隊列。今も崩れぬ陣形で後ろの者を守り、近づく敵には幾本もの槍が連なって襲いかかる。一人を倒しても、隊列は決して退かない。" },
  { id: "bs_drumwraith", name: "戦鼓の亡霊", rank: 5, race: "specter", element: "none", artKey: "drumwraith",
    role: "healer", ability: "warcry", // 終わらぬ進軍を打ち鳴らし、味方を鼓舞し傷を繕わせる
    desc: "落城の夜から、終わらぬ進軍の太鼓を打ち鳴らし続ける鼓手の霊。その響きは亡兵の士気を煽り、砕けた体を奮い立たせて戦線へ戻す。鼓の音が止まぬ限り、守備隊は立ち上がり続ける。" },
  { id: "bs_fortlord", name: "砦の主", rank: 6, boss: true, race: "armored", element: "none", artKey: "fortlord", soulClass: "fighter",
    role: "summoner", summonKey: "d03_sentinel", ability: "critical", enrage: true, physResist: 0.5, // 亡兵を呼び、急所を貫き、追い詰められて荒れ狂う
    desc: "砦を枕に討ち死にし、なお退却の許しを待ち続ける将の亡霊。錆びた大剣を提げ、無人の甲冑を次々と起こして陣を布く。分厚い甲冑は刃を阻み、城が落ちる時の絶望が、その剣に宿っている。" },
  // -- 第5層「霧の森」 (rank 6-7・植物/獣/妖。第4層より格上の壁。火に弱い者が多い) --
  { id: "bs_misttreant", name: "霧の古木", rank: 6, race: "plant", element: "wind", artKey: "misttreant",
    physResist: 0.5, regen: 0.08, barrier: 2, magWeak: 1.3, // 刃を呑み傷を巻き戻すが、炎には脆い
    desc: "苔と霧をまとって歩く、森の最も古い木の化身。太い幹は刃を呑み込み、刻んだ傷も年輪を巻き戻すように塞がる。ただ、乾いた芯は炎の魔法を浴びると一気に燃え盛る。" },
  { id: "bs_dryadfey", name: "森の妖魔", rank: 6, race: "plant", element: "wind", artKey: "dryadfey",
    ability: "weaken", regen: 0.06, role: "healer", // 妖しい歌で力を奪い、傷ついた森の眷属を癒す
    desc: "霧の奥から妖しい歌を響かせる、美しくも恐ろしい森の妖。その歌を聞いた者は四肢の力が抜け、立ち尽くす。傷ついた森の眷属には癒しの旋律を、侵入者には呪いの旋律を歌い分ける。" },
  { id: "bs_giantmoth", name: "燐粉の大蛾", rank: 6, race: "insect", element: "wind", artKey: "giantmoth",
    ability: "paralyze", evasive: true, swift: true, // 痺れの鱗粉を撒き、霧と灯に紛れてかわす
    desc: "霧の夜にだけ舞う、両翼を広げれば人の背丈ほどもある大蛾。鱗粉を撒き散らして獲物を痺れさせ、ふらりと不規則に舞っては刃をかわす。灯りを見つけると、吸い寄せられるように群がる。" },
  { id: "bs_stranglevine", name: "絞め蔦の魔", rank: 6, race: "plant", element: "earth", artKey: "stranglevine",
    ability: "paralyze", multistrike: 2, physResist: 0.4, // 樹冠から無数に垂れ、絡め取って締め上げる
    desc: "樹冠から音もなく垂れ下がり、通る者を絡め取る食人の蔦。一本に捉えられれば、たちまち十本が巻きついて締め上げる。しなやかな蔓は刃を受け流し、断っても次の蔓が伸びてくる。" },
  { id: "bs_corruptstag", name: "角の魔獣", rank: 7, race: "beast", element: "wind", artKey: "corruptstag",
    ability: "critical", enrage: true, swift: true, // 捻れた角で急所を抉り、手負いで猛り狂う
    desc: "霧の瘴気に呑まれて変じた、森の主だった大鹿。捻れて鋭く尖った角は鎧ごと急所を抉り、疾風のごとく森を駆ける。傷を負うほどに血走った目で猛り、見境なく突進してくる。" },
  { id: "bs_fungalhulk", name: "茸人の巨躯", rank: 6, race: "plant", element: "earth", artKey: "fungalhulk",
    ability: "poison", regen: 0.1, physResist: 0.4, // 胞子の毒を撒き、崩しても胞子から甦る
    desc: "朽ち木に根を張った菌糸が、人を超える巨躯に育ったもの。歩くたびに毒の胞子を撒き散らし、叩き崩しても残った胞子からみるみる再生する。倒しきるには、胞子ごと焼き払うしかない。" },
  { id: "bs_forestlord", name: "霧の森の主", rank: 7, boss: true, race: "plant", element: "wind", artKey: "forestlord", soulClass: "priest",
    role: "summoner", summonKey: "bs_stranglevine", regen: 0.08, physResist: 0.5, magWeak: 1.3, // 蔦を呼び、傷を繕い、刃を呑む。炎には脆い
    desc: "霧そのものが森の意思を得て、古木の体に宿った主。無数の絞め蔦を従え、刃を幹に呑み込み、霧を吸うたびに傷を繕う。森を統べる古き妖だが、その身もまた木――業火の前には、ただ燃える薪にすぎない。" },
  // -- 第5層「霧の森」 batch2 (rank 6-7) --
  { id: "bs_giantowl", name: "霧渡りの梟", rank: 6, race: "avian", element: "wind", artKey: "giantowl",
    swift: true, evasive: true, multistrike: 2, // 音もなく舞い降り、鉤爪で素早く二度抉る
    desc: "霧の梢を音もなく渡る、両翼を広げれば人を覆う大梟。気配を殺して背後を取り、湾曲した鉤爪で続けざまに抉る。羽音が聞こえた時には、もう肩に爪が食い込んでいる。" },
  { id: "bs_direboar", name: "牙の大猪", rank: 6, race: "beast", element: "earth", artKey: "direboar",
    enrage: true, multistrike: 2, physResist: 0.4, // 突進で次々と薙ぎ倒し、手負いで見境なく暴れる
    desc: "霧の森の下草を突き破って突進する、岩のような巨猪。捻れた牙で次々と薙ぎ倒し、分厚い剛毛と脂は刃を弾く。傷を負えば負うほど血走り、味方も敵も区別なく暴れ回る。" },
  { id: "bs_willowwitch", name: "柳の魔女", rank: 7, race: "plant", element: "wind", artKey: "willowwitch",
    ability: "weaken", role: "summoner", summonKey: "bs_stranglevine", regen: 0.07, // 呪歌で力を奪い、蔦を呼び、枝を繕う
    desc: "枝垂れ柳に成り変わった、森の最も古い魔女。垂れた枝葉の奥から呪いの歌を響かせて生者の力を奪い、絡みつく蔦を次々と這わせる。枝を払っても、根が生きる限り何度でも芽吹く。" },
  { id: "bs_sporezombie", name: "胞子の苗床", rank: 6, race: "undead", element: "wind", artKey: "sporezombie",
    ability: "poison", regen: 0.1, pack: true, // 茸に侵された亡骸。胞子を撒き、群れ、崩しても甦る
    desc: "森に倒れ、菌糸に乗っ取られた亡骸の群れ。背から生えた茸の傘から毒の胞子を吐き、近づく者を侵す。打ち崩しても残った胞子から新たな苗床が芽吹き、いつまでも数を減らさない。" },
  { id: "bs_thornhound", name: "茨の猟犬", rank: 6, race: "beast", element: "earth", artKey: "thornhound",
    swift: true, pack: true, lifesteal: 0.3, // 茨をまとって素早く群れ、噛んで血を啜る
    desc: "全身に茨を巻きつけた、森を駆ける痩せた猟犬。群れで素早く取り囲み、棘だらけの顎で噛みついては血を啜って傷を癒す。振り払おうにも、絡みついた茨が肉に食い込む。" },
  { id: "bs_wisplure", name: "惑わしの群火", rank: 6, race: "specter", element: "wind", artKey: "wisplure",
    ability: "paralyze", evasive: true, magWeak: 1.5, pack: true, // 群れで誘い込み痺れさせる。実体は薄い
    desc: "霧の中をふわふわと漂う、無数の青い鬼火の群れ。道に迷った旅人を誘い込んでは、触れた者を痺れさせて沼へ沈める。実体に乏しく刃をすり抜けるが、魔の力にはひとたまりもない。" },
  { id: "bs_satyrpiper", name: "角笛の森人", rank: 7, race: "humanoid", element: "wind", artKey: "satyrpiper",
    ability: "warcry", swift: true, // 角笛の旋律で森の眷属を奮い立たせ、軽やかに跳ね回る
    desc: "山羊の脚を持ち、角笛を吹き鳴らす森の半獣。その旋律は森の獣を奮い立たせ、戦意を煽る。軽やかに跳ね回って間合いを外し、決して正面からは戦わない狡猾な指揮者。" },
  { id: "bs_flytrap", name: "大食虫花", rank: 6, race: "plant", element: "earth", artKey: "flytrap",
    ability: "poison", multistrike: 2, physResist: 0.4, // 顎で噛みつき、毒液で溶かす。茎は刃を受け流す
    desc: "人を丸呑みにする、牙の生えた巨大な食虫花。蔓を伸ばして獲物を手繰り寄せ、顎で何度も噛みついては毒液で溶かす。しなやかな茎は刃を受け流し、刈ってもまた新たな花を咲かせる。" },
  { id: "bs_mossgolem", name: "苔生す岩塊", rank: 7, race: "construct", element: "earth", artKey: "mossgolem",
    physResist: 0.6, barrier: 2, regen: 0.06, // 苔と根に覆われた巨岩。刃を阻み、苔が傷を埋める
    desc: "霧の森に幾百年も座した、苔と樹根に覆われた巨岩の番人。分厚い岩肌は刃を寄せつけず、削った傷も森の苔がじわじわと埋めていく。動き出すまでは、ただの苔むした岩にしか見えない。" },
  { id: "bs_fogpanther", name: "霧豹", rank: 7, race: "beast", element: "wind", artKey: "fogpanther",
    ability: "critical", swift: true, evasive: true, // 霧に紛れて忍び寄り、急所を一突きで仕留める
    desc: "霧に体を溶け込ませて忍び寄る、しなやかな大豹。気配を断って背後を取り、急所を狙った一撃で獲物を仕留める。仕損じても霧に翻って間合いを外し、また音もなく回り込んでくる。" },
  // -- rank 3 --
  { id: "bs_werewolf", name: "人狼", rank: 3, race: "beast", element: "dark", artKey: "werewolf", soulClass: "fighter",
    regen: 0.08, swift: true, // 月の獣の治癒力 + 跳びかかる俊足
    desc: "月のない迷宮の闇でこそ獣性が猛る呪われた人。引き裂いた相手の悲鳴で、わずかに残った人の心が軋む。負わせた傷もろとも、己の傷もみるみる塞がっていく。" },
  { id: "bs_scorpion", name: "鉄ばさみの毒さそり", rank: 3, race: "insect", element: "earth", artKey: "scorpion",
    ability: "poison", physResist: 0.5, // 心臓を灼く毒針 + 鎧のような甲殻
    desc: "鎧の継ぎ目を断ち切るはさみと、心の臓を直に灼く尾針を併せ持つ大さそり。乾いた床を擦る音が死の予鈴となる。分厚い甲殻は刃をろくに通さない。" },
  // -- rank 4 --
  { id: "bs_gargoyle", name: "ガーゴイル", rank: 4, race: "construct", element: "earth", artKey: "gargoyle",
    physResist: 0.5, // 石の体が刃をほとんど通さない
    desc: "聖堂の軒先で魔を払っていた石像の成れの果て。守るべき聖域を失い、今は止まり木に来るものすべてを翼と爪で払う。石の体は並の刃を寄せつけず、砕くには相応の力がいる。" },
  { id: "bs_banshee", name: "バンシー", rank: 4, race: "specter", element: "dark", artKey: "banshee",
    ability: "paralyze", // 葬送の絶叫で身をすくませる
    desc: "死を報せる泣き女の霊。その絶叫を聞いた者は、自分の葬列の足音が背後から近づいてくるのを聞き、恐怖に体が縛りつけられて動けなくなる。" },
  { id: "bs_minotaur", name: "ミノタウロス", rank: 4, boss: true, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#7a4a2a", 0.3),
    ability: "critical", // 全体重を乗せた突進で急所を抉る
    desc: "迷路の中心で生贄を待ち続けた牛頭の巨人。捧げられる者が絶えて久しく、自ら狩りに出ることを覚えた。低く構えた角の突進は鎧ごと急所を抉る。" },
  // -- rank 5 --
  { id: "bs_troll", name: "トロール", rank: 5, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#4a8a3a", 0.35),
    regen: 0.12, // 火で灼かぬ限り裂かれた傷もみるみる塞がる
    desc: "裂かれた傷がみるみる塞がる再生の巨人。腕をもがれてもすぐに生え直し、火で灼かれた痕だけが、こいつの体に古傷として残っている。" },
  { id: "bs_dullahan", name: "デュラハン", rank: 5, race: "armored", element: "dark", artKey: "dullahan", soulClass: "knight",
    swift: true, ability: "critical", // 首を狙う一閃を音もなく繰り出す
    desc: "首を失ってなお戦場を求める黒鎧の騎士。小脇に抱えた己の首が斬るべき相手の名を囁いて教え、音もなく間合いを詰めては首筋へ一閃を浴びせる。" },
  { id: "bs_salamander", name: "サラマンダー", rank: 5, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#d04a2a", 0.4),
    ability: "poison", regen: 0.06, // 焼け続ける噛み傷 + おき火の体が傷を炙り塞ぐ
    desc: "溶岩の川を寝床とする火トカゲ。鱗の隙間から覗く体内はおき火の色で、噛み傷は永く焼け続ける。その熱は己の傷をも炙って塞いでしまう。" },
  // -- rank 6 --
  { id: "bs_chimera", name: "キマイラ", rank: 6, race: "beast", element: "fire", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#c04a3a", 0.3),
    ability: "breath", // 三つの首が一斉に吐く炎
    desc: "獅子と山羊と毒蛇を縫い合わせた禁忌の合成獣。三つの頭は互いを憎みながら、獲物の前でだけ一つになり、前衛後衛もろとも炎を吐きかける。" },
  { id: "bs_wyvern", name: "ワイバーン", rank: 6, race: "dragon", element: "wind", artKey: "wyvern",
    swift: true, ability: "poison", // 風を切る速さで舞い降り、尾の毒針を突き立てる
    desc: "竜の血が薄れた代わりに翼を肥らせた飛竜。風切り音が聞こえた時には、尾の毒針はもう振り下ろされている。" },
  { id: "bs_cyclops", name: "サイクロプス", rank: 6, boss: true, race: "giant", element: "none", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#8a8a9a", 0.3),
    ability: "critical", // 岩柱を叩きつける一撃が急所を砕く
    desc: "単眼の巨人。神々の炉で雷を鍛えたという腕は、いま岩柱を棍棒代わりに迷宮の柱ごと侵入者を薙ぎ、その一撃は急所を捉えれば鎧ごと砕く。" },
  // -- rank 7 --
  { id: "bs_griffon", name: "グリフォン", rank: 7, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c8a23a", 0.35),
    swift: true, ability: "critical", // 上空から鉤爪で急襲し急所を抉る
    desc: "鷲の眼と獅子の体を併せ持つ空の王。黄金を巣に敷く習性ゆえ財宝の眠る迷宮を縄張りに選び、上空から音もなく舞い降りて鉤爪で急所を抉る。" },
  { id: "bs_naga", name: "ナーガ", rank: 7, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#7a4aa0", 0.35),
    ability: "poison", // 蛇神の眷属の猛毒の牙
    desc: "下半身が大蛇と化した蛇神の眷属。千年の祈りを捧げた古い祭壇を今も鱗のねぐらで抱え込み、近づく者には蛇神譲りの猛毒の牙を剥く。" },
  { id: "bs_vampire", name: "ヴァンパイア", rank: 7, race: "undead", element: "dark", artKey: "vampire", soulClass: "mage",
    ability: "drain", regen: 0.08, // 血とともに宿した魂を吸い、その分だけ若返る
    desc: "夜の貴族。血をすするのは渇きのためではなく、奪った命の記憶を味わうため。すすった血と宿した魂の分だけ己の傷は癒え、月夜には誰も敵わない。" },
  { id: "bs_hydra", name: "九首のヒュドラ", rank: 7, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#2a6a9a", 0.35),
    ability: "poison", regen: 0.1, // 九首の猛毒と、落としても生え変わる首
    desc: "ひとつ落とせばふたつ生える九つ首の毒蛇竜。九つの口から滴る猛毒を浴びせ、首を落とされてもみるみる生え変わる。退治の英雄譚は数あれど、骸を見た者はひとりもいない。" },
  // -- rank 8 --
  { id: "bs_demon", name: "獄炎のデーモン", rank: 8, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#6a1a1a", 0.3),
    ability: "breath", // 燃える憎悪を獄炎として吐き散らす
    desc: "地獄の位階に名を連ねる上級魔。その体は燃え続ける憎悪そのもので、前衛後衛を問わず獄炎を吐き散らし、足跡には硫黄の火が残る。" },
  { id: "bs_irongolem", name: "アイアンゴーレム", rank: 8, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#7a7a8a", 0.35),
    physResist: 0.7, // 千の武具を鋳潰した鋼鉄の巨体は刃をほぼ通さない
    desc: "千の武具を鋳潰して造られた鋼鉄の巨人。鍛え抜かれた鋼の巨体は並の刃をまるで通さず、胸の奥では素材にされた剣たちの未練が今も軋み続けている。" },
  { id: "bs_necromancer", name: "死霊術師", rank: 8, race: "undead", element: "dark", artKey: "necromancer", soulClass: "bishop",
    role: "summoner", summonKey: "bs_plaguewraith", magWeak: 1.4, // 死者を呼び続けるが、痩せた身は魔法に脆い
    desc: "死を窮め、自ら死者となった術師。倒した者を次々と従者として呼び起こすが、痩せ衰えた身は魔法を撃ち込まれれば術もろとも崩れる。従える骸の軍勢はみな、かつてこの男を討ちに来た者たちだ。" },
  { id: "bs_archdemon", name: "アークデーモン", rank: 8, boss: true, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#2a1a3a", 0.35),
    role: "summoner", summonKey: "bs_demon", ability: "critical", // 魔界の軍団を呼び、急所を抉る一撃を放つ
    desc: "魔界の軍団を率いる大公。契約の口上は蜜のように甘く、配下の魔を次々と戦場に呼び寄せ、その爪は鎧ごと急所を抉る。署名した王国がどうなったかは地図が知っている。" },
  // -- rank 9 --
  { id: "bs_elderlich", name: "エルダーリッチ", rank: 9, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#7a4aa0", 0.4),
    ability: "drain", regen: 0.06, // 宿した魂を喰らい、七つに裂いた魂を依代に蘇る
    desc: "幾つもの王朝の興亡を骨の玉座から眺めてきた大死霊。触れた者の宿した魂を喰らって己を保ち、魂を七つに裂いて隠したゆえ、砕いても蘇って死がこの者を裁けない。" },
  { id: "bs_fallenangel", name: "堕天使", rank: 9, race: "demon", element: "light", artKey: "angel", soulClass: "priest",
    ability: "critical", // 祈るような手つきで生者の急所を裁き断つ
    desc: "天を逐われてなお光をまとう、哀しき翼。祝福の言葉を逆さに唱え、祈るような手つきで差し向ける裁きの一撃は、生者の急所を正確に断つ。" },
  { id: "bs_doomknight", name: "冥府の騎士", rank: 9, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#6a1a2a", 0.35),
    physResist: 0.5, ability: "soulSteal", // 冥鉄の鎧が刃を弾き、その剣は生きる理由(魂)を奪う
    desc: "冥府の門を守ると誓った騎士の末路。冥鉄の鎧は刃を弾き、その剣に斬られた者は傷ではなく、生きる理由ごと魂を失って倒れる。" },
  // -- rank 10 --
  { id: "bs_voiddragon", name: "虚無竜", rank: 10, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a1a2a", 0.45),
    ability: "breath", evasive: true, // 静寂の吐息で全体を呑み、光を返さぬ体は捉えにくい
    desc: "星々の隙間の何もない場所から迷い込んだ竜。光を返さぬ鱗は狙いを惑わせ、咆哮は音ではなく静寂として届き、その吐息は前衛後衛もろとも虚無へ呑む。" },
  { id: "bs_seraphwraith", name: "終末の使徒", rank: 10, race: "specter", element: "light", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#e8e2c0", 0.4),
    swift: true, ability: "soulSteal", // 終焉を告げて先んじ、聞いた魂を抜き取る
    desc: "世界の終わりを告げるために遣わされたという白い影。誰より先んじて終焉を告げ、その報せを聞いた者の魂を音もなく抜き取る。ラッパは携えていない。もう吹き終えたのかもしれない。" },
  { id: "bs_chaosknight", name: "混沌の騎士", rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#7a2a8a", 0.4),
    swift: true, ability: "critical", // 裏切りの剣技で先手を取り、急所だけを抉る
    desc: "百の戦場で百の主君に仕え、そのすべてを裏切った剣鬼。読めぬ剣筋で先手を奪い、急所だけを的確に抉る。鎧の下にあるのが人なのか、誰も確かめていない。" },
  { id: "bs_reddragon", name: "レッドドラゴン", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    ability: "breath", physResist: 0.5, // 城壁を溶かす業火を吐き、灼熱の鱗は刃を弾く
    desc: "灼熱の血を巡らせる竜の中の竜。城壁を飴のように溶かす業火を前衛後衛もろとも吐きかけ、赤熱した鱗は並の刃を弾く。財宝の山をしとねに千年を眠る。竜殺しを名乗りたくば、まずこの焔の前に立て。" },
  { id: "bs_abysslord", name: "深淵の王", rank: 10, boss: true, race: "demon", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#c8a23a", 0.4),
    ability: "soulSteal", regen: 0.06, // 果てた魂を冠の飾りに奪い、その力で己を保つ
    desc: "百層の迷宮、そのすべての闇が流れ着く玉座に座す者。迷宮で果てた魂を奪っては冠の飾りに加え、集めた魂の力で己を繕う。" },
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
  { id: "bs_darksamurai", name: "黒甲の武者", rank: 4, race: "armored", element: "dark", artKey: "samurai", soulClass: "knight",
    swift: true, ability: "critical", // 抜き打ちの一閃で急所を断つ
    desc: "敗れた戦国の武者が憎しみのまま霧の森をさまよう亡霊の騎士。主の敵を誰にでも重ね、抜刀は一瞬。鞘走った刃は納刀を知らぬまま、急所だけを正確に断つ。" },
  { id: "bs_cultist", name: "邪神の僧", rank: 4, race: "specter", element: "dark", artKey: "cultist", soulClass: "bishop",
    ability: "drain", // 捨てたものを取り戻そうと宿した魂を喰らう
    desc: "禁忌の神をまつり命を捧げた僧侶の亡霊。神に近づくために捨てたものを取り戻そうと手を伸ばし、触れた者の宿した魂のレベルを喰らい取る。" },
  { id: "bs_stonegorgon", name: "石化の眼", rank: 4, race: "specter", element: "earth", artKey: "gorgon",
    ability: "stone", // 直視した者を石へと変える眼
    desc: "ゴルゴンの血を引く蛇髪の霊。その眼を直視した者の皮膚が石灰色に固まり始め、完全に石化するまで意識だけが残るという。" },
  { id: "bs_deepsahagin", name: "深海魚人", rank: 4, race: "aquatic", element: "water", artKey: "deepsahagin",
    swift: true, ability: "paralyze", // 水流で先んじて感知し、もりで突いて痺れさせる
    desc: "神殿の地下水脈の最深部に棲む魚人の変種。目が退化し、代わりに僅かな水流の乱れで獲物の位置を先に感知して襲い、毒もりで突いて痺れさせる。" },
  { id: "bs_bloodorc", name: "血狂いのオーク", rank: 4, race: "humanoid", element: "fire", artKey: "orc", soulClass: "fighter",
    palette: tint(ARTS.orc.palette, "#8a2a1a", 0.45),
    swift: true, regen: 0.08, // 血の匂いで猛り、傷つくほど勢いを増す
    desc: "血の匂いで理性を失うオークの変異体。傷を負うほど凶暴さと速さが増し、自分の傷口まで噛んで己を鼓舞し、浅い傷ならたちまち塞いでしまう。" },
  // -- rank 5 追加 (+5) --
  { id: "bs_ironknight", name: "鉄の騎士", rank: 5, race: "armored", element: "none", artKey: "ironknight", soulClass: "knight",
    physResist: 0.6, // 無骨な鉄塊の体は刃を通さない
    desc: "古代神殿を守るために鋳造された鉄の自動人形。命令のみで動き、千年の時を経た今もその命令を忠実に実行し続ける。分厚い鉄塊の体は並の武器をほとんど通さない。" },
  { id: "bs_thunderbird", name: "雷鳥", rank: 5, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#d4d44a", 0.4),
    swift: true, ability: "paralyze", // 稲光をまとって舞い、触れた者を痺れさせる
    desc: "嵐の中でのみ現れる雷光の鳥。羽ばたきのたびに稲光が走って素早く宙を舞い、その翼に触れた者は心の臓まで痺れて動けなくなる。" },
  { id: "bs_deepgolem", name: "大地のゴーレム", rank: 5, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#4a3a2a", 0.5),
    physResist: 0.6, // 神殿の基礎石そのものの巨体
    desc: "神殿の基礎石が何百年もの呪文の蓄積で自ら動き始めた古代ゴーレム。岩盤そのものの巨体は刃を寄せつけず、一歩踏み出すたびに床が割れ、壁が崩れる。" },
  { id: "bs_shadowmage", name: "影の術師", rank: 5, race: "undead", element: "dark", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#2a2a5a", 0.5),
    role: "summoner", summonKey: "d03_ghost", magWeak: 1.4, // 闇の眷属を召喚するが、本体は術もろとも魔法に脆い
    desc: "禁呪に魂を喰われた術師の残りかす。肉体は消え失せ、影だけが闇の眷属を呼び出して術を唱え続ける。実体の薄い身は、魔法を撃ち込まれれば術もろとも掻き消える。" },
  { id: "bs_fireserpent", name: "炎の大蛇", rank: 5, race: "reptile", element: "fire", artKey: "fireserpent",
    swift: true, ability: "poison", // 焼き付く鱗を擦りつけて素早く絡む
    desc: "溶岩の流れを住処とする巨大な炎の大蛇。鱗の一枚一枚が炉の断片で、素早く巻きついた相手の肌に皮膚ごと焼き付いて離れない。" },
  // -- rank 6 追加 (+6) --
  { id: "bs_darkdrake", name: "暗竜", rank: 6, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#2a1a3a", 0.5),
    ability: "breath", // 火でなく影を吐き、前衛後衛を呑む
    desc: "竜の血脈が呪いで変質した漆黒の小竜。吐く息は火でなく影であり、前衛後衛もろとも包まれた者はやがて自分の輪郭を失う。" },
  { id: "bs_bloodwraith", name: "血霊", rank: 6, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#8a1a2a", 0.45),
    ability: "drain", regen: 0.06, // 触れた者の血を引き出して己の一部にする
    desc: "溶岩洞で大量の血が流された場所に生まれた血の亡霊。触れられた者の血は傷口から引き出されて霊体の一部となり、奪った分だけその身が濃さを増す。" },
  { id: "bs_stormgiant", name: "嵐の巨人", rank: 6, race: "giant", element: "wind", artKey: "stormgiant",
    ability: "paralyze", // 振り下ろす拳に伴う落雷で痺れさせる
    desc: "嵐の日にのみ地上に降りてくる雷雲を纏う巨人。一歩ごとに地響きがし、振り下ろす拳は落雷を伴って、打たれた者を痺れさせる。" },
  { id: "bs_bonecolossus", name: "骨の巨兵", rank: 6, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8c0a0", 0.3),
    physResist: 0.5, // 幾十の骸が融合した骨の塊は崩しにくい
    desc: "幾十の骸が呪力で融合し立ち上がった巨大な骨の兵。分厚く絡み合った骨は刃を弾き、その胴の中には今も生者の叫び声が閉じ込められているという。" },
  { id: "bs_ashphoenix", name: "灰の鳳凰", rank: 6, race: "avian", element: "fire", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c85a2a", 0.45),
    ability: "breath", // 奪われまいと吐き散らす最後の炎
    desc: "溶岩洞の奥に棲む、再生しない鳳凰。かつて不死を誇ったが呪いで再生を失い、今は最後の炎を奪われまいと、前衛後衛もろとも炎を吐き散らして燃え続ける。" },
  { id: "bs_steelspider", name: "鋼蜘蛛", rank: 6, race: "construct", element: "none", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#8a9aaa", 0.4),
    physResist: 0.5, ability: "paralyze", // 鋼の外殻が刃を弾き、鋼糸で獲物を絡め取る
    desc: "古代の錬金術師が造った鉄製の機械蜘蛛。鋼の外殻は刃を弾き、溶岩に落ちても溶けずに動き続け、絹より細く鋼より強い糸で獲物を絡めて縛り上げる。" },
  // -- rank 7 追加 (+5) --
  { id: "bs_shadowdragon", name: "影竜", rank: 7, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a2a3a", 0.6),
    evasive: true, ability: "soulSteal", // 実体がなく刃をすり抜け、魂に直接爪を立てる
    desc: "氷河の奥深くに封じられていた古い竜の影。実体を持たずあらゆる刃を通し抜け、その代わりに獲物の魂へ直接爪を立てて吸い上げる。" },
  { id: "bs_stormwyvern", name: "嵐のワイバーン", rank: 7, race: "dragon", element: "wind", artKey: "wyvern",
    palette: tint(ARTS.wyvern.palette, "#3a5a8a", 0.4),
    swift: true, ability: "breath", // 暴風を巻き起こして舞い、前衛後衛を吹き散らす
    desc: "嵐の中を悠々と飛ぶ嵐竜の亜種。翼を一振りするだけで前衛後衛を巻き込む暴風が起こり、その羽根は雷避けの護符になるという。" },
  { id: "bs_goldgolem", name: "黄金のゴーレム", rank: 7, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#c8a040", 0.4),
    physResist: 0.6, // 黄金の重い装甲が刃を弾く
    desc: "竜の財宝の守護として作られた黄金の巨人。重く分厚い黄金の体は刃を弾き、近づく者を宝への脅威と見なして、財宝の山の上に直立したまま戦う。" },
  { id: "bs_soulharvester", name: "魂刈り", rank: 7, race: "specter", element: "dark", artKey: "reaper",
    swift: true, ability: "soulSteal", // 音もなく間合いを詰め、鎌で魂を刈り取る
    desc: "迷宮で死んだ者の魂を回収する役割を帯びた存在。音もなく間合いを詰め、鎌の一振りで肉体と魂の繋がりを断ち、刈り取った魂は籠に集める。" },
  { id: "bs_thunderknight", name: "雷電の騎士", rank: 7, race: "armored", element: "wind", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#4a6a9a", 0.4),
    swift: true, ability: "paralyze", // 落雷を纏い、金属鎧の者ほど深く痺れさせる
    desc: "嵐の神殿に仕えた騎士の怨霊。雷鳴とともに現れて素早く斬り込み、纏った落雷は金属鎧の者ほど深く通って体を痺れさせ、次の雷鳴で消える。" },
  // -- rank 8 追加 (+7) --
  { id: "bs_hellhound", name: "地獄の番犬", rank: 8, race: "demon", element: "fire", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#8a1a1a", 0.5),
    swift: true, ability: "breath", // 駆け寄って炎を吐きかける冥府の番犬
    desc: "冥府の番人として鍛えられた炎を吐く巨大な犬。素早く駆け寄って前衛後衛もろとも炎を吐きかけ、鎖は切られても鎖の跡が首に残り、その鎖の先には今も冥府がある。" },
  { id: "bs_darkliege", name: "冥府の将", rank: 8, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#4a1a4a", 0.5),
    physResist: 0.5, ability: "critical", // 部下の魂で硬化した鎧が刃を弾き、将の一撃が急所を貫く
    desc: "生前は英雄であったが、死後に冥府の軍を率いる将軍となった者。部下の魂を縫い込んだ鎧はその嘆きで硬化して刃を弾き、振るう刃は急所だけを正確に貫く。" },
  { id: "bs_voidwalker", name: "虚無の歩者", rank: 8, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#0a0a1a", 0.6),
    evasive: true, ability: "soulSteal", // 物理攻撃の半分が虚空に消え、触れた者の記憶を剥ぎ取る
    desc: "存在と無の狭間を歩く者。叩きつけた物理攻撃の半分は虚空に消え、その手が触れた者の記憶と魂を一枚ずつ剥がしていく。" },
  { id: "bs_plaguewraith", name: "疫病の亡霊", rank: 8, race: "undead", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#3a5a2a", 0.5),
    ability: "poison", // 触れた者を高熱に侵す疫病のもや
    desc: "大疫病で死んだ者たちが一つに溶け合った亡霊の群れ。そのもやに触れた者はたちまち高熱と疫病に侵され、三日三晩うなされる。" },
  { id: "bs_crystalgolem", name: "水晶のゴーレム", rank: 8, race: "construct", element: "none", artKey: "crystalgolem",
    physResist: 0.6, ability: "critical", // 打撃を吸収し、ためた力を一撃で解放する
    desc: "尖塔の心核を守るために結晶が自己組織化した透明のゴーレム。打撃を吸収して砕けず、ためた力を逆しまに解放する一撃は急所を撃ち抜く。力づくでは崩せない。" },
  { id: "bs_dreadlich", name: "嘆きのリッチ", rank: 8, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#5a2a7a", 0.45),
    ability: "drain", regen: 0.06, // 宿した魂を喰らい、宝珠を依代に蘇り続ける
    desc: "魂を複数の宝珠に分けて隠した古代の死霊術師の上位種。触れた者の宿した魂を喰らって己を保ち、砕いても隠した宝珠を依代に蘇る。その嘆きを聴いた者は、宝珠を探さずにいられない。" },
  { id: "bs_shadowogre", name: "影の大鬼", rank: 8, race: "giant", element: "dark", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#2a2a4a", 0.55),
    ability: "critical", // 影の拳が急所を叩き潰す
    desc: "嵐の尖塔の影が凝縮して生まれた鬼の巨体。振り下ろす影の拳は急所を叩き潰し、落ちた場所に開いた影の穴からは、更なる影の腕が伸びてくる。" },
  // -- rank 9 追加 (+7) --
  { id: "bs_voidknight", name: "虚無の騎士", rank: 9, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#1a1a2a", 0.6),
    physResist: 0.5, ability: "critical", // 虚無の鎧が刃を逸らし、現実に穴を開ける剣が急所を貫く
    desc: "冥府の門を守護する騎士の中で、存在そのものが消えかかった最古参。希薄な鎧は刃を逸らし、その剣が触れた場所は現実の布地ごと急所に穴を開ける。" },
  { id: "bs_apocalypsedrake", name: "終末の竜", rank: 9, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#3a1a4a", 0.5),
    ability: "breath", // 大地を不毛に変える終末の吐息で全体を灼く
    desc: "終末の予言書に記された竜。世界の終わりに先立って現れると言われ、前衛後衛もろとも呑む吐息が触れた大地は、二度と命を育まない。" },
  { id: "bs_soulreaper", name: "魂の刈人", rank: 9, race: "specter", element: "dark", artKey: "reaper",
    swift: true, ability: "soulSteal", // 音もなく現れ、鎌で魂を刈り取って逃さない
    desc: "冥府の正規の従者として魂を刈る役目を持つ上位の霊。迷宮で死を迎えた者には必ず音もなく現れ、鎌の一振りで魂を刈り取って、逃げぬよう懐に包む。" },
  { id: "bs_plaguelich", name: "疫病のリッチ", rank: 9, race: "undead", element: "dark", artKey: "skeleton", soulClass: "mage",
    palette: tint(ARTS.skeleton.palette, "#2a5a2a", 0.5),
    ability: "poison", regen: 0.06, // 千の病を浴びせ、宝珠を依代に蘇る
    desc: "疫病を武器として研究し続けた術師の死霊。指から滴る千の病の混合液を浴びせ、砕けても隠した宝珠を依代に蘇る。触れた者は己の体が何に侵されているかも分からない。" },
  { id: "bs_divinegolem", name: "神のくぐつ", rank: 9, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e0d0a0", 0.4),
    physResist: 0.7, ability: "critical", // 神鉄の躯は刃を通さず、審判の一撃が急所を断罪する
    desc: "神が最後の審判のために造った審判のくぐつ。神鉄の躯は刃をまるで通さず、迷宮に踏み込んだ全員を罪ある者と判定し、断罪の一撃を急所へ下す。" },
  { id: "bs_shadowseraph", name: "堕ちた光翼", rank: 9, race: "specter", element: "dark", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#4a4a6a", 0.5),
    ability: "drain", evasive: true, // 腐った光翼で宙を舞い、魂の善性を溶かし喰らう
    desc: "天から追われた後も光の翼を持つ存在。腐りかけた翼でひらりと宙を舞い、触れた者の魂の善性を少しずつ溶かして己に取り込んでいく。" },
  { id: "bs_infernaltyrant", name: "獄炎の暴君", rank: 9, race: "demon", element: "fire", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#8a2a0a", 0.5),
    ability: "breath", physResist: 0.5, // 溶岩を吐いて全体を灼き、灼熱の巨体は刃を寄せつけない
    desc: "地獄の最深層を統べる炎の悪魔の将。踏みつけた大地は溶岩に変わり、吐き出す業火は前衛後衛もろとも灼く。灼熱の巨体は並の刃を寄せつけない。" },
  // -- rank 10 追加 (+7) --
  { id: "bs_eternallord", name: "永劫の魔将", rank: 10, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#3a0a3a", 0.5),
    evasive: true, ability: "critical", // 相手の次手を読み切ってかわし、急所だけを撃つ
    desc: "時間の概念を超えて存在する上位魔。過去も未来も同時に見て相手の次手を読み切り、攻撃をかわしては露わになった急所だけを撃つ。対策の立てようがない。" },
  { id: "bs_abysswarden", name: "深淵の番人", rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#0a1a2a", 0.6),
    physResist: 0.6, regen: 0.06, // 不滅の鎧は刃を通さず、削っても再び立ち上がる
    desc: "迷宮の最深部への通路を守り続ける不滅の番人。何千もの挑戦者を退けてきた鎧は刃を通さず、崩しても再び立ち上がる。その鎧には敗者たちの名が刻まれている。" },
  { id: "bs_cosmicwraith", name: "宇宙の亡霊", rank: 10, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#0a0a2a", 0.7),
    evasive: true, ability: "soulSteal", // 虚空に紛れて刃をかわし、覗いた者の魂を奪う
    desc: "星々の間の冷たい虚空から迷い込んだ宇宙的な霊体。虚空に紛れて刃をすり抜け、その目が向いた先の空気は消え、覗き込んだ者は魂ごと宇宙の孤独に溺れる。" },
  { id: "bs_godslayer", name: "神殺し", rank: 10, race: "humanoid", element: "dark", artKey: "orc", soulClass: "fighter",
    palette: tint(ARTS.orc.palette, "#2a0a0a", 0.6),
    swift: true, ability: "critical", // 神を斬った剣技で先んじ、急所を一刀で断つ
    desc: "神を三柱殺した後、自らも神に近い存在へと変質した剣士。神を斬った剣技で誰より先んじ、急所を一刀で断つ。弱い神は殺すことで取り込み、強い神は挑戦することで楽しむ。" },
  { id: "bs_voidcolossus", name: "虚無の巨人", rank: 10, race: "giant", element: "dark", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#0a0a1a", 0.65),
    physResist: 0.7, ability: "critical", // 無の巨体は刃を呑み、触れた物を消滅させる一撃を放つ
    desc: "宇宙の虚無が巨人の形を借りて顕現した存在。その体積は全て無であり、突き立てた刃を呑み込み、振り下ろす拳は触れた物を物理的に消滅させる。存在への反論だ。" },
  { id: "bs_primalserpent", name: "原初の大蛇", rank: 10, race: "reptile", element: "dark", artKey: "fireserpent",
    palette: tint(ARTS.fireserpent.palette, "#2a2a4a", 0.6),
    physResist: 0.5, ability: "poison", // 太古の鱗は刃を弾き、原初の毒を流し込む
    desc: "世界が生まれる前から存在していたという太古の大蛇。世界の歴史を刻んだ古き鱗は刃を弾き、噛みついて流し込む原初の毒に解毒の術は無い。その鱗一枚は倒しても消えない。" },
  { id: "bs_doombringer", name: "終焉の使者", rank: 10, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#5a1a0a", 0.55),
    ability: "breath", physResist: 0.5, // 星すら焼く終焉の炎を吐き、灼熱の鱗は刃を弾く
    desc: "世界の終わりを告げるために遣わされた炎の竜。その到来は終わりそのものであり、前衛後衛もろとも呑んで星すら焼く炎を吐き、灼熱の鱗は並の刃を弾く。" },

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
    physResist: 0.5, // 防衛線を守る鋼の構えが刃を弾く
    desc: "守備隊の最後の陣で、折れた旗を握ったまま果てた騎士。旗が地に落ちない限り陣は破られていないと信じ、鋼の構えで刃を受け止め、今も最後の防衛線に立つ。" },
  { id: "bs_bloodfeastogre", name: "血祭りの鬼将", rank: 3, boss: true, race: "giant", element: "fire", artKey: "ogre", soulClass: "fighter",
    palette: tint(ARTS.ogre.palette, "#8a2a1a", 0.4),
    regen: 0.06, // 血の祭りに酔い、傷を顧みず塞いでいく
    desc: "城境壁で幾日も血祭りを続けた攻め手の鬼将。戦が終わったことを誰も伝えに来なかったので、祭りはまだ続いている。返り血を浴びるほど猛り、浅い傷ならすぐに塞いでしまう。" },
  { id: "bs_squareghost", name: "広場の亡霊将", rank: 3, boss: true, race: "specter", element: "dark", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#6a6a8a", 0.35),
    role: "summoner", summonKey: "d03_ghost", // 名簿を読み上げ散った部隊を呼び戻す
    desc: "旗竿の広場で全滅した部隊の点呼を取り続ける将の亡霊。名簿を読み上げるたびに散った兵の霊が立ち戻り、その末尾にはいつの間にか、迷宮に入った者の名が書き足されている。" },
  { id: "bs_frozenarcher", name: "凍て弓の隊長", rank: 3, boss: true, race: "undead", element: "water", artKey: "skeleton", soulClass: "thief",
    palette: tint(ARTS.skeleton.palette, "#9fc0d8", 0.35),
    ability: "paralyze", // 刺さった先から凍らせる矢
    desc: "弓兵の塔で矢を番えたまま凍りついた射手の隊長。指は氷柱と化してなお弦を引き絞り、放たれる矢は刺さった先から獲物を凍りつかせ、身動きを奪う。" },
  { id: "bs_granarymaw", name: "兵糧庫の貪り", rank: 3, boss: true, race: "amorph", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#c87a2a", 0.4),
    physResist: 0.5, // 焦げた糧秣の塊ゆえ刃が通らない
    desc: "燃え落ちた兵糧庫で、焦げた糧秣ごと燠火を呑み込んで膨れ上がった粘塊。刃を突き立てても潰れて寄り集まり、腹の中ではまだ火が燻り、近づくものを飢えたまま炙り喰う。" },
  { id: "bs_headsmanwraith", name: "処刑人の影", rank: 3, boss: true, race: "specter", element: "dark", artKey: "wraith", soulClass: "fighter",
    palette: tint(ARTS.wraith.palette, "#3a3a46", 0.4),
    swift: true, ability: "paralyze", // 影から音もなく振り下ろす処刑の斧
    desc: "処刑台の下の底知れぬ穴に堕ちた処刑人の影。執行の名簿は燃え失せたが斧だけが残り、影は音もなく間合いを詰め、誰の罪状も読まずに振り下ろす。死の予感に体が凍りつく。" },
  { id: "bs_ironcagewarden", name: "鉄房の看守長", rank: 3, boss: true, race: "armored", element: "earth", artKey: "knightmare",
    palette: tint(ARTS.knightmare.palette, "#6a5a4a", 0.35),
    physResist: 0.5, // 鎧と鉄格子が癒着した重装甲
    desc: "捕虜たちの呪詛を浴び続け、鎧と鉄格子が癒着した看守長。分厚い鉄の塊と化した体は刃を寄せつけず、胸の鉄房には今も誰かが囚われていて、戦いの最中にも細い腕が助けを乞う。" },
  { id: "bs_duskcastellan", name: "黄昏の城代", rank: 3, boss: true, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#b0884a", 0.3),
    regen: 0.06, // 砕けても鍵を握り直して立ち上がる
    desc: "落城の夕べ、明け渡しの鍵を抱いたまま果てた城代。差し出す相手を間違えまいと骨の指は鍵を握り続け、砕いても骨を継ぎ直しては立ち上がり、奪おうとする者を客とは認めない。" },
  { id: "bs_warhostrevenant", name: "千兵の怨嵐", rank: 3, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#8a2a3a", 0.4),
    swift: true, ability: "paralyze", // 千の鬨の声が一斉に襲い、すくませる
    desc: "霊魂の迷路に散った千の兵の怨念が、ひとつの嵐に縒り合わさったもの。千の声が同時に突撃の鬨を上げて先んじ、聞いた者は千の殺意に体をすくませる。" },
  // -- rank 4 (迷宮31-40: 霧の森帯) --
  { id: "bs_mistwolfking", name: "霧狼の王", rank: 4, boss: true, race: "beast", element: "wind", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#9aa3ab", 0.4),
    role: "summoner", summonKey: "bs_direwolf", swift: true, // 遠吠えで霧を牙に凝らせ群れを呼ぶ
    desc: "幽の森に立ちこめる霧そのものを群れとして従える大狼の王。遠吠えひとつで霧が牙の形に凝って新たな狼となり、風のような速さで迷い込んだ者の退路から順に喰い千切る。" },
  { id: "bs_hollowkodama", name: "朽ち社の木霊", rank: 4, boss: true, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#6a8a4a", 0.35),
    regen: 0.06, // 願いを溜めるたびに枝を伸ばし直す
    desc: "参る者の絶えた社で、届かなかった願いだけを溜め込んで肥えた木霊。叶えられなかった祈りの数だけ枝を伸ばし、裂かれた枝もすぐに芽吹き直して、参拝者を離さない。" },
  { id: "bs_bloodbriar", name: "血茨の主", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#8a2a3a", 0.4),
    ability: "drain", regen: 0.06, // 獲物の血(と魂)を吸い上げて己を肥やす
    desc: "樹海の路に倒れた旅人の血を吸って肥え太った茨の大蔓。獲物を絞め上げて宿した魂ごと吸い上げ、吸った分だけ傷を塞ぐ。その時だけ、棘の先に小さな赤い花を咲かせる。" },
  { id: "bs_birchwitch", name: "白樺の魔女", rank: 4, boss: true, race: "specter", element: "water", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#e8e8f4", 0.4),
    ability: "paralyze", // 体温を奪う呪文で凍てつかせる
    desc: "凍てついた白樺林に棲む雪の魔女の霊。白い林に紛れて立ち尽くし、声をかけた者の体温を呪文ひとつで根こそぎ奪い、その場に凍りつかせる。" },
  { id: "bs_pyretreant", name: "燃え木の巨人", rank: 4, boss: true, race: "plant", element: "fire", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#c85a2a", 0.4),
    physResist: 0.4, regen: 0.06, // 百年消えぬ火を宿し、焦げてもまた燃え立つ
    desc: "炎樹の回廊で燃えながら決して倒れぬ巨木の人形。硬い幹は刃を弾き、抱きしめられた者は薪の仲間入りをする。幹の火は百年消えたことがなく、焼け焦げてもまた燃え立つ。" },
  { id: "bs_bogtyrant", name: "底なし沼の主", rank: 4, boss: true, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#4a5a2a", 0.4),
    ability: "paralyze", // 泥から伸びる無数の腕が獲物を絡めて沈める
    desc: "沼地の底で幾百年も沈むものを待ち続けた主。泥の下から伸びる腕は数えるだけ無駄で、絡めとられた獲物は身動きを奪われ、掴まれた足はもう岸を踏めない。" },
  { id: "bs_curseroot", name: "呪樹の根王", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#3a2a4a", 0.45),
    role: "summoner", summonKey: "d03_mandrake", regen: 0.06, // 地中の根から新たな苗を芽吹かせる
    desc: "呪われた呪樹の根が地中で結び合い、ひとつの意志を持った王。森のすべての木はこの根の指先に過ぎず、刈っても地から新たな苗を芽吹かせて尽きることがない。" },
  { id: "bs_rotgardener", name: "腐苑の庭師", rank: 4, boss: true, race: "undead", element: "earth", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#5a7a3a", 0.4),
    role: "summoner", summonKey: "bs_zombie", ability: "poison", // 植えた死体を芽吹かせ、腐臭を撒く
    desc: "腐葉の苑を死体で手入れし続ける骸の庭師。倒した獲物を几帳面に土へ植えては芽吹かせて新たな下僕とし、撒き散らす腐臭は肺を蝕む。" },
  { id: "bs_mireforestking", name: "血沼の樹王", rank: 4, boss: true, race: "plant", element: "dark", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#6a1a2a", 0.45),
    physResist: 0.4, ability: "drain", // 沼の血を吸い上げる大樹、宿した魂も吸う
    desc: "果てなき森の血沼に根を張る樹々の王。沼の血を吸い上げて梢まで赤く染まった大樹の幹は刃を弾き、絡めた獲物からは血ごと宿した魂を吸い上げる。" },
  // -- rank 5 (迷宮41-50: 沈没神殿帯) --
  { id: "bs_drownedpontiff", name: "水底の神官王", rank: 5, boss: true, race: "undead", element: "water", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#2a6a9a", 0.4),
    ability: "paralyze", regen: 0.06, // 沈黙の聖歌で動きを封じ、水に抱かれて傷を癒す
    desc: "神殿もろとも湖底に沈んだ神官たちの王。水底でなお続く礼拝の頂点に立ち、唱える沈黙の聖歌は聞いた者の息と動きを奪い、「沈黙の聖歌隊」へ勧誘する。" },
  { id: "bs_altarguardian", name: "祭壇の番像", rank: 5, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e0d0a0", 0.35),
    physResist: 0.6, // 聖別された石の番像は刃を通さない
    desc: "朽ちた祭壇を守るために聖別された石の番像。神はとうに去ったが聖別だけが残り、聖石の体は刃を弾いて、供物なき参拝者を瀆神者として打ち砕く。" },
  { id: "bs_sacrificelord", name: "生贄の祭主", rank: 5, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#8a2a4a", 0.4),
    ability: "drain", // 足りない生贄の血を訪問者から吸い取る
    desc: "血染めの間で千の生贄を捧げ、最後に自らを捧げた祭主。儀式はまだ完成しておらず、足りない分の血と宿した魂を訪問者から吸い取って補おうとする。" },
  { id: "bs_whisperingidol", name: "囁く神像", rank: 5, boss: true, race: "construct", element: "dark", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#4a4a6a", 0.4),
    physResist: 0.5, ability: "paralyze", // 石の像は刃を弾き、頭蓋に響く囁きで体を縛る
    desc: "迷宮の中心に座し、囁きだけで信徒を操ってきた名もなき神の像。石の体は刃を寄せつけず、耳を塞いでも頭蓋の内側から響く囁きが、聞いた者の体を縛りつける。" },
  { id: "bs_blazeseraph", name: "燃ゆる聖堂の天使", rank: 5, boss: true, race: "specter", element: "fire", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#c85a2a", 0.4),
    ability: "breath", // 翼から降り注ぐ火の粉の聖句が全体を焼く
    desc: "大聖堂の火に焼かれてなお祝福の歌をやめない天使像の霊。焼け爛れた翼から火の粉の聖句が前衛後衛もろとも降り注ぎ、浴びた者は祝福ごと燃える。" },
  { id: "bs_nagamatriarch", name: "神域のナーガ母神", rank: 5, boss: true, race: "aquatic", element: "water", artKey: "sahagin",
    palette: tint(ARTS.sahagin.palette, "#7a4aa0", 0.4),
    ability: "poison", regen: 0.06, // 蛇神の猛毒と、卵を産み続ける生命力
    desc: "海底に沈んだ神域を鱗の塒で抱え込む蛇身の母神。蛇神の猛毒を牙に湛え、傷ついても卵を産むほどの生命力で身を繕い、信徒の末裔すら今は卵の餌としか見ていない。" },
  { id: "bs_cursedpontifex", name: "呪われた教主", rank: 5, boss: true, race: "undead", element: "dark", artKey: "skeleton", soulClass: "bishop",
    palette: tint(ARTS.skeleton.palette, "#7a4aa0", 0.4),
    ability: "poison", // 裏返った聖句が祝福した者を病み衰えさせる
    desc: "霊廟に葬られた後、祈りごと呪詛に転じた神官の教主。唱える聖句は一字ずつ裏返り、祝福した者から順に病に侵されて衰えていく。" },
  { id: "bs_duskapostle", name: "黄昏の神使", rank: 5, boss: true, race: "avian", element: "light", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#e8c24a", 0.35),
    swift: true, ability: "paralyze", // 黄昏の廊を翔け、神託の一声で立ちすくませる
    desc: "没落した神殿に最後まで残った神の使い。届ける相手のいない神託を抱えて黄昏の廊を素早く旋回し、その一声を聞いた者は神威に打たれて立ちすくむ。" },
  { id: "bs_ordealavatar", name: "試練の神像", rank: 5, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#c8a040", 0.4),
    physResist: 0.6, // 神の依代たる石躯は容易に砕けない
    desc: "神意の試練の底で挑む者を量り続ける神の依代。聖別された石躯は並の刃では砕けず、秤の片方には挑戦者の魂、もう片方には誰も見たことのない「合格」が載っている。" },
  // -- rank 6 (迷宮51-60: 灼熱洞帯) --
  { id: "bs_magmacentipede", name: "溶岩の大百足", rank: 6, boss: true, race: "insect", element: "fire", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#c84a1a", 0.45),
    swift: true, ability: "poison", // 幾百の脚で素早く這い、灼熱の毒液を浴びせる
    desc: "溶岩の川を素肌で泳ぐ灼熱の大百足。幾百の脚で素早く這い回り、掻き立てる火飛沫は雨のように降って獲物を灼き、通った後の岩肌は飴のように波打つ。" },
  { id: "bs_cinderknight", name: "燃え殻の騎士", rank: 6, boss: true, race: "armored", element: "fire", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#8a3a1a", 0.4),
    physResist: 0.4, ability: "critical", // 焼けた鎧が刃を弾き、誓いを込めた一撃が急所を断つ
    desc: "熔岩の回廊で焼かれ続け、中身が燃え尽きてなお立ち続ける騎士の鎧。灼けた装甲は刃を弾き、兜の奥の熾火に燻る誓いを込めた一撃は、急所だけを正確に断つ。" },
  { id: "bs_boilingmass", name: "血沸きの肉塊", rank: 6, boss: true, race: "amorph", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#a02a2a", 0.45),
    physResist: 0.5, ability: "poison", // 煮えた肉塊は刃を呑み、煮汁の毒を流し込む
    desc: "血の沸く迷路で煮え続け、煮詰まった末に意志を持った肉の塊。突き立てた刃は熱い肉に呑まれて手応えなく、触れたものを煮汁の毒ごと丸ごと取り込んで、また少し煮詰まる。" },
  { id: "bs_fumarolelord", name: "噴気孔の魔伯", rank: 6, boss: true, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#8a6a1a", 0.4),
    ability: "poison", // 玉座から立ち昇る硫黄の毒煙を浴びせる
    desc: "硫黄の噴気孔を玉座とする魔界の伯爵。立ち昇る毒煙を恭しく従者として侍らせ、咳き込ませた客人の喉へ更なる毒を流し込んでその格を見定める。" },
  { id: "bs_venomhydra", name: "毒炎の双首蛇", rank: 6, boss: true, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#6a8a2a", 0.45),
    ability: "poison", regen: 0.08, // 双つ首の猛毒と、落とされても生え直す首
    desc: "炎と毒、相容れぬ二つを同時に吐く双つ首の大蛇。二つの首は互いを憎みながら獲物を炙り煮にし、片首を落とされてもすぐに生え直してしまう。" },
  { id: "bs_calderawyrm", name: "火口の蛇竜", rank: 6, boss: true, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#c85a1a", 0.45),
    ability: "breath", // 火口の業火を縦坑ごと吐き上げる
    desc: "火山の縦坑に巻きついて眠る鱗の長虫。目覚めれば縦坑そのものが胃袋に変わり、吐き上げる火口の業火は前衛後衛を問わず焼き尽くす。" },
  { id: "bs_flameheresiarch", name: "炎の異端教主", rank: 6, boss: true, race: "specter", element: "fire", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#c84a2a", 0.4),
    ability: "soulSteal", // 焼かれた信徒の魂を法衣の火に吸い込む
    desc: "炎の聖地を乗っ取り、火刑を「祝福」と説いた異端の教主。焼かれた信徒の魂を法衣の火に吸い込んで燃え盛り、説法は今日も燃えている。" },
  { id: "bs_emberking", name: "燠火の廃王", rank: 6, boss: true, race: "undead", element: "fire", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8742a", 0.4),
    ability: "critical", regen: 0.06, // 燠火の一撃が急所を灼き、灰から燃え立ち直す
    desc: "灼熱の廃都で燠火の冠を戴き続ける王の骸。燠火を纏った一撃は急所を灼き、砕いても灰の中から燃え立ち直して、都が燃え尽きた夜からの退位を認めない。" },
  { id: "bs_infernowyrm", name: "業火竜", rank: 6, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#a02a0a", 0.45),
    ability: "breath", regen: 0.06, // 棲み処の業火を吐き、その炎で身を灼き直す
    desc: "終末迷宮の底で己の業火に巻かれながら生き続ける竜。炎はもはや吐くものではなく棲み処であり、前衛後衛を呑む業火を吐きながら、その只中で傷を灼き直してこちらを見ている。" },
  // -- rank 7 (迷宮61-70: 氷結回廊帯) --
  { id: "bs_crystalwyrm", name: "氷晶の蛇竜", rank: 7, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#9fd0e8", 0.45),
    ability: "breath", // 氷柱に擬態して不意を突き、肺を凍らせる吐息
    desc: "永久氷の結晶回廊で氷柱に擬態して眠る蛇竜。鱗は氷晶と見分けがつかず、気づいた時には前衛後衛を凍てつかせる吐息が肺の中で凍りはじめている。" },
  { id: "bs_snowsexton", name: "雪葬の墓守", rank: 7, boss: true, race: "undead", element: "water", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#e8e8f4", 0.4),
    ability: "paralyze", // 雪に埋めるように凍てつかせて動きを止める
    desc: "雪に葬られた迷路で、埋もれた死者の数を数え続ける墓守。獲物を雪に埋めるように凍てつかせて勘定に加え、数え終わらぬうちに雪が新しい死者を運んでくるので、勘定は終わらない。" },
  { id: "bs_frozenwarden", name: "氷牢の獄長", rank: 7, boss: true, race: "armored", element: "water", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#6a8aa0", 0.4),
    physResist: 0.5, ability: "paralyze", // 凍てついた鎧が刃を弾き、囚人を氷柱に封じる
    desc: "血も凍る氷の牢獄を統べる獄長。凍てついた鎧は刃を弾き、囚人を氷柱に封じる刑を好む。廊に並ぶ氷柱の中では、今も誰かが瞬きをしている。" },
  { id: "bs_blizzardvoice", name: "吹雪の囁き手", rank: 7, boss: true, race: "specter", element: "wind", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#c8d8e8", 0.4),
    swift: true, ability: "soulSteal", // 名を呼んで振り向かせ、応えた魂を雪へ沈める
    desc: "吹雪の廊で旅人の名を呼ぶ声の主。声に応えて振り向いた者の魂を音もなく抜き取って雪へ沈め、次の旅人を呼ぶ声がひとつ増える。" },
  { id: "bs_glacialgiant", name: "氷河の巨王", rank: 7, boss: true, race: "giant", element: "water", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#9fc0d8", 0.4),
    physResist: 0.5, ability: "critical", // 氷河の鎧が刃を弾き、冬の一打が急所を砕く
    desc: "永久氷河を褥に眠る巨人の王。凍りついた肌は刃を弾き、目覚めの一打は冬そのものを急所へ振り下ろす。寝返りひとつで氷河に新しい谷が刻まれる。" },
  { id: "bs_paradoxgenie", name: "氷炎の双精", rank: 7, boss: true, race: "elemental", element: "fire", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#b07be0", 0.4),
    ability: "breath", physResist: 0.5, // 氷炎を同時に吐き、矛盾の体は刃を呑む
    desc: "氷壁の中で燃え続ける矛盾そのものの精霊。氷と炎が互いを喰らい合うひとつの体は刃を呑み、吐く息は前衛後衛もろとも凍えさせながら焼く。" },
  { id: "bs_rimecastellan", name: "霜の城主", rank: 7, boss: true, race: "specter", element: "water", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#aef0ff", 0.4),
    ability: "paralyze", // 晩餐へ招くように、客を凍りつかせて席に着かせる
    desc: "霜の廃城で晩餐の客を待ち続ける城主の霊。招かれた者を凍りつかせて長卓に着かせ、凍った席に人数分が揃うのを待つ。空いているのは、あとひとつだけだ。" },
  { id: "bs_eternalsnowbeast", name: "万年雪の白獣", rank: 7, boss: true, race: "beast", element: "water", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#e8eef4", 0.45),
    evasive: true, ability: "critical", // 雪明かりに溶けて見えず、不意の一撃で急所を抉る
    desc: "黄昏の雪原を統べる白き獣。万年雪と同じ色の毛皮は雪明かりに溶けて姿を晦まし、足跡のない雪面から不意に飛びかかって急所を抉る。" },
  { id: "bs_iciclequeen", name: "氷晶の女王", rank: 7, boss: true, race: "specter", element: "water", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#aef0ff", 0.45),
    ability: "paralyze", // 握り返した手を凍らせ、二度と温もらせない
    desc: "氷晶の終末宮殿の玉座で凍てつく女王。差し伸べる手の優美さは生前のまま、握り返した手は凍りついて、二度と温もりも身動きも取り戻さない。" },
  // -- rank 8 (迷宮71-80: 嵐の尖塔帯) --
  { id: "bs_stormroc", name: "嵐の大鵬", rank: 8, boss: true, race: "avian", element: "wind", artKey: "harpy",
    palette: tint(ARTS.harpy.palette, "#4a6a9a", 0.4),
    swift: true, ability: "breath", // 翼の一打ちが前衛後衛もろとも暴風で薙ぐ
    desc: "尖塔の廃墟を巣とする嵐の大鳥。素早く舞い上がって翼を打ち下ろすたび前衛後衛を巻き込む暴風が薙ぎ、この鳥が翼を畳んだ時だけ嵐が止むのだという。" },
  { id: "bs_skywarden", name: "天廊の番人", rank: 8, boss: true, race: "construct", element: "wind", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#9ab0c8", 0.4),
    physResist: 0.6, ability: "critical", // 浮遊する重い躯が刃を弾き、客人を突き落とす一撃を放つ
    desc: "天空の朽ちた廊下を浮遊しながら巡回する番人。重い石躯は刃を弾き、床の崩れた廊を歩けるのは自分だけだと知っていて、客人を丁重に、急所を突いて突き落とす。" },
  { id: "bs_thunderprelate", name: "雷霆の祭主", rank: 8, boss: true, race: "specter", element: "wind", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#d4d44a", 0.4),
    swift: true, ability: "paralyze", // 避雷針の身が呼ぶ落雷で打たれた者を痺れさせる
    desc: "血染めの聖堂で雷を神として祀った祭主。祈りに応えた雷に焼かれて死に、以来その身が避雷針として神を呼び続け、落とした雷は打たれた者を痺れさせる。" },
  { id: "bs_cyclonedjinn", name: "竜巻の魔人", rank: 8, boss: true, race: "demon", element: "wind", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#4a8a6a", 0.4),
    ability: "breath", // 「願い」の竜巻が前衛後衛をまとめて巻き上げる
    desc: "遺跡の壺に封じられていた竜巻の魔人。封を解いた者への「願いを三つ」の口約束は、前衛後衛をまとめて巻き上げる三つの竜巻となって律儀に果たされる。" },
  { id: "bs_stormfrostgiant", name: "嵐氷の巨人", rank: 8, boss: true, race: "giant", element: "water", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#6a8aa0", 0.4),
    physResist: 0.5, ability: "paralyze", // 氷の鎧が刃を弾き、雷雲の棍棒が打った者を凍らせる
    desc: "嵐の頂で雹と氷雨を浴び続け、氷の鎧を着込んだ巨人。鎧は刃を弾き、振るう棍棒は凍った雷雲の芯で、打たれた者は砕ける前に凍りついて動けなくなる。" },
  { id: "bs_stormdrake", name: "雷炎竜", rank: 8, boss: true, race: "dragon", element: "wind", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#d4c44a", 0.4),
    ability: "breath", // 鱗を走る稲妻を雷霆のブレスとして吐く
    desc: "燃える雷霆の塔に巻きつく雷の竜。鱗の隙間を稲妻が血潮のように走り、吐く雷霆のブレスは前衛後衛を問わず、咆哮と雷鳴の区別がついた者から先に焼く。" },
  { id: "bs_darkcloudspawn", name: "暗雲の落とし子", rank: 8, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#2a2a3a", 0.45),
    evasive: true, ability: "soulSteal", // 形を持たず刃をかわし、見た者の魂を蝕む
    desc: "底知れぬ奈落に垂れ込めた暗雲から滴り落ちた影。定まらぬ形は刃をかわし、雷が走るたび一瞬だけ見える本当の姿を見てしまった者は、魂を蝕まれて次の雷を待てない。" },
  { id: "bs_ruincore", name: "飛翔廃墟の核", rank: 8, boss: true, race: "construct", element: "wind", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#7a86a0", 0.4),
    physResist: 0.6, ability: "critical", // 重力障壁が刃を逸らし、近づく者を重力ごと弾く
    desc: "黄昏の空に廃墟を浮かべ続ける魔導の心核。守るべき都市は崩れ果てたが、核は墜落を拒み、纏う重力障壁が刃を逸らして、近づく者を急所ごと弾き飛ばす。" },
  { id: "bs_galesovereign", name: "烈風の覇王", rank: 8, boss: true, race: "avian", element: "wind", artKey: "harpy", soulClass: "fighter",
    palette: tint(ARTS.harpy.palette, "#2a6a4a", 0.4),
    swift: true, ability: "breath", // 玉座の風の渦が前衛後衛もろとも薙ぎ払う
    desc: "終末の迷宮に君臨する翼ある覇王。玉座は常に風の渦の中心にあり、謁見を許された者はまず立っていることを許されず、薙ぐ烈風が前衛後衛もろとも吹き飛ばす。" },
  // -- rank 9 (迷宮81-90: 冥府の門帯) --
  { id: "bs_hellgatehound", name: "冥門の番犬", rank: 9, boss: true, race: "demon", element: "dark", artKey: "beast",
    palette: tint(ARTS.beast.palette, "#3a1a1a", 0.45),
    swift: true, ability: "breath", // 三つ首が一斉に獄炎を吐き、素早く獲物を追う
    desc: "冥府の門前に鎖で繋がれた三つ首の番犬。素早く獲物を追い詰め、三つの喉から前衛後衛もろとも獄炎を吐く。その鎖は門を守るためではなく、世界を犬から守るためにある。" },
  { id: "bs_ferrymanshade", name: "冥橋の渡し守", rank: 9, boss: true, race: "specter", element: "dark", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#4a4a5a", 0.4),
    ability: "soulSteal", // 賃を払えぬ魂を橋の下へ——その手で魂を抜き取る
    desc: "朽ちた欄干の橋で渡し賃を待ち続ける影。賃を払えぬ者の魂を抜き取って橋の下へ落とし、欄干の軋みはその魂たちが登ろうとする音だ。" },
  { id: "bs_bloodjudge", name: "血の裁定者", rank: 9, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#8a1a2a", 0.45),
    ability: "critical", // 罪の重さが釣り合わぬ者を「無罪のまま」急所で斬る
    desc: "死者審判の間で裁きを下し続ける裁定者。天秤の片皿には常に血が満たされ、釣り合う重さの罪を持たない者は「無罪のまま」、急所を一刀で斬られる。" },
  { id: "bs_processionlord", name: "死出の行列長", rank: 9, boss: true, race: "undead", element: "dark", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#5a4a6a", 0.4),
    role: "summoner", summonKey: "bs_plaguewraith", // 出会った者を列に加え、死者の行列を伸ばす
    desc: "死者の列を率いて囁く道を行く行列の長。列は冥府まで一列、追い越しも離脱も許されず、生者と出会えば死者を呼んで列の最後尾を一人ぶん延ばす。" },
  { id: "bs_palefrostking", name: "冥宮の凍王", rank: 9, boss: true, race: "armored", element: "water", artKey: "knightmare",
    palette: tint(ARTS.knightmare.palette, "#8aa0b8", 0.4),
    physResist: 0.5, ability: "paralyze", // 氷柱と化した鎧が刃を弾き、凍った剣が動きを止める
    desc: "冥王宮の玉座で凍てついた王の鎧。氷柱と化した鎧は刃を弾き、玉座に近づく足音へ凍った剣をきしませながら立ち上がり、斬りつけた相手を芯まで凍らせる。" },
  { id: "bs_hellfirejailer", name: "獄炎の看守", rank: 9, boss: true, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#6a1a0a", 0.45),
    ability: "breath", // 焼けた鎖を振り回し、獄炎を前衛後衛へ撒く
    desc: "冥府の獄炎回廊を巡回する看守。引きずる焼けた鎖から獄炎を前衛後衛もろとも撒き散らし、房の数より多い鍵を腰に下げて、新しい房の主を探している。" },
  { id: "bs_styxcrone", name: "三途の媼", rank: 9, boss: true, race: "specter", element: "dark", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#5a6a4a", 0.4),
    ability: "drain", // 未練の重さごと、まとうものを剥ぎ取る
    desc: "三途の岸で渡れぬ者の衣を剥ぎ集める老婆。生者からは未練の重さごと命を剥ぎ取り、積み上がった衣の山の重さを量って嗤う。" },
  { id: "bs_duskmausoleum", name: "黄昏の廟王", rank: 9, boss: true, race: "undead", element: "light", artKey: "skeleton",
    palette: tint(ARTS.skeleton.palette, "#c8b88a", 0.35),
    regen: 0.08, ability: "critical", // 廟ごと蘇る不滅の骨身と、王笏の一撃
    desc: "冥界廃墟の黄昏に立つ大廟の王。葬られた身でありながら廟ごと幾度も蘇り、参拝も盗掘もひとしく「臣従」として迎え、振るう王笏は急所を砕く。" },
  { id: "bs_soulgaoler", name: "魂牢の獄王", rank: 9, boss: true, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#2a1a3a", 0.45),
    physResist: 0.5, ability: "soulSteal", // 囚えた魂で鎧を硬くし、新たな魂を檻へ奪う
    desc: "魂牢獄の終末処で、檻に満ちた魂たちの錠を握る獄王。囚えた魂の輝きが鎧を硬くして刃を弾き、奪った魂を新たな囚人として檻へ加える。" },
  // -- rank 10 (迷宮91-100: 竜の玄室帯) --
  { id: "bs_elderwyrmking", name: "玄室の古竜王", rank: 10, boss: true, race: "dragon", element: "none", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c8a040", 0.4),
    ability: "breath", physResist: 0.6, // 系譜の頂点の吐息で全体を呑み、英雄の武具を喰い込ませた鱗は刃を弾く
    desc: "玄室の深奥に眠る、竜たちの系譜の頂点。歴代の挑戦者の武具を鱗の下に喰い込ませた鎧鱗は刃を弾き、吐く息は前衛後衛もろとも呑む。その巨体自体が英雄たちの墓標である。" },
  { id: "bs_hoardwarden", name: "宝物殿の守護像", rank: 10, boss: true, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e8c24a", 0.4),
    physResist: 0.7, ability: "critical", // 黄金の巨躯は刃を通さず、宝を守る一撃が急所を砕く
    desc: "竜王の財宝を守るため、財宝そのものを鋳潰して造られた黄金の巨像。重く分厚い黄金の躯は刃をまるで通さず、宝を脅かす者の急所を一撃で砕く。最後の宝である自分自身を守り抜く。" },
  { id: "bs_broodmother", name: "竜母", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#a03a3a", 0.4),
    ability: "breath", regen: 0.08, // 巣を焼く吐息と、卵を産み続ける生命力で傷を繕う
    desc: "血染めの巣穴で幾百の卵を抱く竜の母。巣に近づくものへ前衛後衛を呑む炎を吐き、母なる生命力で傷をみるみる繕う。その血の何割かは、卵を狙った者たちのものだ。" },
  { id: "bs_dracolich", name: "竜骸の屍竜", rank: 10, boss: true, race: "undead", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#7a6a8a", 0.45),
    ability: "drain", regen: 0.06, // 死を吐息として吐き、宿した魂を喰らって蘇り続ける
    desc: "竜骸の大迷宮の心臓部で、己の骨格だけで蘇った屍の竜。肉も炎も失ったが、死そのものを吐息として吐き、触れた者の宿した魂を喰らっては砕けた骨を継ぎ直す。" },
  { id: "bs_frostwyrmlord", name: "凍れる白竜", rank: 10, boss: true, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#d8e8f4", 0.45),
    ability: "breath", physResist: 0.5, // 絶対の静寂(冷気)を吐き、氷塊の半身は刃を弾く
    desc: "氷窟の奥で氷塊に半身を封じられたまま生き続ける白竜。氷と化した鱗は刃を弾き、吐く息は炎ではなく前衛後衛を凍てつかせる絶対の静寂を吹きつける。" },
  { id: "bs_abyssdrake", name: "奈落竜", rank: 10, boss: true, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#1a1a3a", 0.5),
    evasive: true, ability: "breath", // 闇に紛れて刃をかわし、奈落の吐息で全体を呑む
    desc: "竜の奈落の底知れぬ闇に潜む影の竜。闇に紛れて狙いを惑わせ、落ちてくる挑戦者を翼で受け止める——底まで落ちる楽しみを、奪われたくないからだ。" },
  { id: "bs_dragongodshade", name: "竜神の残影", rank: 10, boss: true, race: "specter", element: "light", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#e8d8a0", 0.4),
    ability: "soulSteal", regen: 0.06, // 信仰と呪詛(魂)を吸って神の形を保つ
    desc: "呪われた霊域に焼き付いた竜神の残影。本体はとうに天へ還ったが、地上に残した影は近づく者の信仰と魂を吸い続け、奪った力で神の形を保っている。" },
  { id: "bs_twilightdragon", name: "終焉の黄昏竜", rank: 10, boss: true, race: "dragon", element: "light", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c87a4a", 0.4),
    ability: "breath", physResist: 0.5, // 黄昏を呼ぶ吐息で全体を染め、夕陽色の鱗は刃を弾く
    desc: "終焉の黄昏の間に座し、世界の日没を待ち続ける竜。沈む直前の太陽の色をした鱗は刃を弾き、翼を広げれば部屋の灯りがすべて夕暮れになり、吐く息は前衛後衛もろとも黄昏へ沈める。" },

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
    role: "healer", escort: "d01_skeleton", ability: null, magWeak: 1.4, soulClass: "bishop",
    palette: tint(ARTS.skeleton.palette, "#c8b87a", 0.4),
    desc: "死者への祈りを逆さに唱え、砕けた骨を継ぎ直す骸の司祭。唱導が続く限り、倒したはずの骸兵が骨を拾い集めて立ち上がる。痩せた骨身は脆く、魔法の一撃で唱導もろとも砕け散る。" },
  { id: "bs_gravecaller", name: "墓呼びの語り部", rank: 3, race: "specter", element: "dark", artKey: "ghost",
    role: "summoner", summonKey: "bs_zombie", escort: "bs_zombie", ability: null,
    palette: tint(ARTS.ghost.palette, "#3a5a4a", 0.45),
    desc: "土の下の亡者に「まだ終わっていない」と囁き続ける亡霊。その語りを聞いた骸は墓を破って這い出し、語り部の指す方へ歩き出す。" },
  // -- rank 4 --
  { id: "bs_shieldogre", name: "大盾のオーガ", rank: 4, race: "giant", element: "earth", artKey: "ogre",
    role: "guard", escort: "d03_orc", ability: null, physResist: 0.5,
    palette: tint(ARTS.ogre.palette, "#5a6a8a", 0.4),
    desc: "城門の残骸を大盾として担ぐオーガの古強者。群れの矢面に立って刃を受け止めることだけを誇りとし、分厚い鉄扉ごと打撃をいなす。その背後でオークどもが斧を研ぐ。" },
  { id: "bs_plaguepriest", name: "疫病の祈り手", rank: 4, race: "specter", element: "dark", artKey: "ghost",
    role: "healer", escort: "bs_banshee", ability: "poison", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#7a8a3a", 0.45),
    desc: "病魔を神と崇め、その「恵み」で仲間の傷を腐肉ごと塞ぐ亡僧。同じ息で唱える祈りは敵には疫病を、味方には治癒を運ぶ。" },
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
    role: "summoner", summonKey: "d01_skeleton", physResist: 0.4, // 死者を侍らせ、古びた骨身が刃を弾く
    desc: "墓地の最奥、最も古い柩に葬られた貴人の成れの果て。眠りを破った足音を数え終えた夜に柩の蓋が開き、侍る骸兵を率いて立ち上がる。石化した古い骨は並の刃を寄せつけない。" }, // D1-3
  { id: "el_palebutcher", name: "蒼白の屠殺鬼", elite: true, rank: 3, race: "giant", element: "none", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#d8d8e4", 0.55),
    physResist: 0.5, ability: "paralyze", // 巨体は刃をいなし、振るう包丁が獲物をすくませる
    desc: "墓守に化けて幾世代も墓地に住み着いた蒼白の喰人鬼。たるんだ巨体は刃を吸い込んでいなし、研ぎ上げた包丁が一閃するたび獲物は恐怖に立ちすくむ。包丁が研がれる夜は、翌朝までに墓穴がひとつ増えている。" }, // D4-6
  { id: "el_sorrowsaint", name: "嘆きの聖女", elite: true, rank: 3, race: "specter", element: "light", artKey: "ghost", soulClass: "priest",
    palette: tint(ARTS.ghost.palette, "#ffe8b0", 0.5),
    ability: "paralyze", regen: 0.06, // 死を運ぶ祝福ですくませ、祈りで己を癒す
    desc: "疫病の死者を弔い続け、最後は自らも墓地に倒れた聖女の亡霊。生前のままの祈りは聞いた者を金縛りにし、唱えるたびに己の傷を癒す。その祝福だけが、死を運ぶものへ変わり果てた。" }, // D7-10
  // -- 迷宮 11-20 (坑道帯) / 強敵ランク4 --
  { id: "el_oremaw", name: "鉱脈喰らい", elite: true, rank: 4, race: "construct", element: "earth", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#5ac8a0", 0.45),
    physResist: 0.6, // 鉱石を喰らい固めた岩塊の体は刃を通さない
    desc: "坑道の鉱脈そのものを喰らって肥え太った岩塊の獣。原石を喰い込ませた岩盤の体は並の武器をほとんど通さず、輝きに惹かれた鉱夫ごと呑み込む。" }, // D11-13
  { id: "el_lanternreaper", name: "灯火狩り", elite: true, rank: 4, race: "specter", element: "dark", artKey: "wraith", soulClass: "thief",
    palette: tint(ARTS.wraith.palette, "#16162a", 0.6),
    swift: true, ability: "soulSteal", // 闇を駆け、灯火もろとも魂を狩り取る
    desc: "坑道で果てた者たちの「消えた灯」が寄り集まった漆黒の影。闇を音もなく駆けて先んじ、生者の掲げる灯りを憎んで、灯火を狩るついでにその魂を吸い取る。" }, // D14-16
  { id: "el_tunnelking", name: "穴蔵の王", elite: true, rank: 4, race: "humanoid", element: "fire", artKey: "kobold", soulClass: "fighter",
    palette: tint(ARTS.kobold.palette, "#c8a040", 0.5),
    role: "summoner", summonKey: "d01_kobold", ability: "goldSteal", // 数千の眷属を呼び、奪い尽くす
    desc: "数千の眷属を従え、坑道の闇に王国を築いた古コボルト。吼えれば際限なく眷属が湧き、混戦に乗じて獲物の懐を漁る。小鬼と侮った者の骸が、玉座への道に敷き詰められている。" }, // D17-20
  // -- 迷宮 21-30 (砦帯) / 強敵ランク5 --
  { id: "el_warbanner", name: "軍旗の亡将", elite: true, rank: 5, race: "armored", element: "fire", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#a03020", 0.5),
    physResist: 0.5, ability: "critical", // 焼け鎧が刃を弾き、攻城の一撃が急所を貫く
    desc: "落城の日、軍旗を握ったまま焼け死んだ将の亡霊。燃える鎧は刃を弾き、目に映るすべてを攻め落とすべき敵城と見なして、城門を割る勢いの一撃を急所へ叩き込む。" }, // D21-23
  { id: "el_headsman", name: "処刑人の大鬼", elite: true, rank: 5, race: "giant", element: "earth", artKey: "ogre",
    palette: tint(ARTS.ogre.palette, "#6a2a2a", 0.5),
    swift: true, ability: "critical", // 首斬りの斧が一閃で急所を断つ
    desc: "砦の処刑場に飼われていた首斬り役の大鬼。主を失ってなお務めを忘れず、迷い込んだ者を「本日の咎人」として斧の下へ並ばせ、振り下ろす一閃で首筋を狙う。" }, // D24-26
  { id: "el_phantomcompany", name: "亡霊中隊", elite: true, rank: 5, race: "specter", element: "wind", artKey: "ghost",
    palette: tint(ARTS.ghost.palette, "#7a8aa8", 0.5),
    role: "summoner", summonKey: "d03_ghost", swift: true, // 散った中隊を呼び集め、号令とともに先んじる
    desc: "全滅した守備中隊の魂が、ひとつの巨影に溶け合った亡霊。号令ひとつで散った戦友の霊を呼び集め、百人分の殺意が先んじてひとつの太刀筋に乗る。" }, // D27-30
  // -- 迷宮 31-40 (霧の森帯) / 強敵ランク6 --
  { id: "el_mistmother", name: "霧の繭母", elite: true, rank: 6, race: "insect", element: "water", artKey: "spider",
    palette: tint(ARTS.spider.palette, "#c8d4e0", 0.55),
    ability: "paralyze", regen: 0.06, // 霧の糸で獲物を絡めて麻痺させ、巣を繕い続ける
    desc: "霧の森の最深部に巣を張る繭の女王。立ち込める霧はすべてこの蜘蛛の吐いた糸であり、絡めとられた獲物は痺れて動けなくなる。裂かれた巣はすぐに繕われ、森に入った時点で、すでに巣の上にいる。" }, // D31-33
  { id: "el_eldertreant", name: "古樹の巨人", elite: true, rank: 6, race: "plant", element: "earth", artKey: "mandrake",
    palette: tint(ARTS.mandrake.palette, "#3a5a2a", 0.5),
    physResist: 0.5, regen: 0.08, // 太古の樹皮が刃を弾き、根から養分を吸って癒える
    desc: "森が芽吹くより前からそこに立つ古樹の巨人。分厚い樹皮は刃を寄せつけず、迷宮全体に張り巡らせた根から養分を吸い上げて傷を癒し、梢を騒がせた者を大地ごと締め上げて肥料に変える。" }, // D34-36
  { id: "el_huntsmanwraith", name: "狩人王の亡霊", elite: true, rank: 6, race: "specter", element: "wind", artKey: "wraith", soulClass: "thief",
    palette: tint(ARTS.wraith.palette, "#3a6a3a", 0.5),
    swift: true, ability: "critical", // 風のごとく追い、狩りの一矢で急所を射抜く
    desc: "獲物を狩り尽くし、最後に己の従者を獲物にした狩人王の亡霊。風のごとく間合いを詰め、狩りの一矢は急所だけを射抜く。角笛の音が聞こえたなら、すでに狩りは始まっている。" }, // D37-40
  // -- 迷宮 41-50 (神殿帯) / 強敵ランク7 --
  { id: "el_fallenidol", name: "堕ちた神像", elite: true, rank: 7, race: "construct", element: "light", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#e8d8a0", 0.5),
    physResist: 0.6, ability: "critical", // 聖石の躯が刃を弾き、石腕の抱擁が骨を砕く
    desc: "信仰を失った神殿で、祈られることに飢えた神像。聖石の躯は刃を寄せつけず、参拝者を石の腕で抱き締めて急所ごと砕き、その骸を新たな信徒として祭壇に並べる。" }, // D41-43
  { id: "el_heresiarch", name: "異端大司教", elite: true, rank: 7, race: "undead", element: "dark", artKey: "ghost", soulClass: "bishop",
    palette: tint(ARTS.ghost.palette, "#6a2a5a", 0.5),
    ability: "drain", regen: 0.06, // 死を福音と説き、宿した魂を喰らって己を保つ
    desc: "禁じられた教義を説き、生きながら神殿の地下へ葬られた大司教。死そのものを福音として説きながら、聴いた者の宿した魂を喰らい、その分だけ己の存在を濃くする。" }, // D44-46
  { id: "el_offeringslime", name: "供物の坩堝", elite: true, rank: 7, race: "amorph", element: "dark", artKey: "slime",
    palette: tint(ARTS.slime.palette, "#8a6a1a", 0.55),
    physResist: 0.6, ability: "poison", // 千年の供物を沈めた粘塊は刃を呑み、腐った供物の毒を流す
    desc: "千年分の供物を呑み込み続けた祭壇の坩堝が、ついに意思を持った粘塊。突き立てた刃は供物もろとも呑まれ、底に澱んだ腐汁の毒を流しながら、最上の供物——生贄を待っている。" }, // D47-50
  // -- 迷宮 51-60 (灼洞帯) / 強敵ランク8 --
  { id: "el_cinderking", name: "燼の王", elite: true, rank: 8, race: "elemental", element: "fire", artKey: "wraith",
    palette: tint(ARTS.wraith.palette, "#d86a2a", 0.55),
    ability: "drain", regen: 0.08, // 触れた熱を奪い尽くし、奪った熱で燃え直す
    desc: "灼洞の火が幾度も消えかけ、そのたびに燃え残った「燼」の精。炎の王を名乗るその身は冷えゆく憎悪であり、触れた者から熱と命を奪い尽くし、奪った分だけ燃え直す。" }, // D51-53
  { id: "el_magmawyrm", name: "熔鉄の蛇竜", elite: true, rank: 8, race: "reptile", element: "fire", artKey: "lizard",
    palette: tint(ARTS.lizard.palette, "#d83a1a", 0.55),
    physResist: 0.5, ability: "breath", // 熔鉄の鱗が刃を弾き、城門すら蒸発させる熱を吐く
    desc: "溶岩の底を泳ぎ続け、鱗が熔けた鉄と一体化した蛇竜。熔鉄の鱗は刃を弾き、吐き出す熱は前衛後衛もろとも、城門すら蒸発させる。通った跡の岩は飴のように溶け落ちる。" }, // D54-56
  { id: "el_ashshogun", name: "灰燼の将", elite: true, rank: 8, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#8a8a88", 0.5),
    regen: 0.1, ability: "critical", // 斬られても灰となって積もり直し、将の太刀が急所を断つ
    desc: "灼洞に攻め入り、軍ごと灰になった将の亡霊。斬られるたび灰煙となって解け、再び将の形に積もり直して立ち上がる。崩れぬ灰の太刀は、急所だけを正確に断つ。" }, // D57-60
  // -- 迷宮 61-70 (氷廊帯) / 強敵ランク9 --
  { id: "el_frostsovereign", name: "凍王の影", elite: true, rank: 9, race: "armored", element: "water", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#a8c8e8", 0.55),
    physResist: 0.5, ability: "paralyze", // 凍てついた影鎧は刃を弾き、敗者を氷像に変える
    desc: "氷廊の最深部に座す「凍王」が、退屈しのぎに切り離した己の影。凍てついた鎧は刃を弾き、本体に迫る力で斬りつけた相手を芯から凍らせ、敗者は氷像として回廊に飾られる。" }, // D61-63
  { id: "el_glacialmaw", name: "氷河の大顎", elite: true, rank: 9, race: "dragon", element: "water", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#c8e0f0", 0.6),
    physResist: 0.5, ability: "breath", // 氷塊の巨顎は刃を弾き、千年溶けぬ吹雪を吐く
    desc: "氷河の裂け目そのものと見紛う、白竜の巨大な顎。氷塊の鱗は刃を弾き、氷ごと獲物を噛み砕いては、前衛後衛もろとも千年溶けない吹雪を吐く。" }, // D64-66
  { id: "el_blizzardwitch", name: "吹雪の魔女", elite: true, rank: 9, race: "specter", element: "wind", artKey: "ghost", soulClass: "mage",
    palette: tint(ARTS.ghost.palette, "#b0d8e8", 0.55),
    ability: "paralyze", // 子守唄で暖かな眠りごと凍りつかせる
    desc: "吹雪の夜にだけ氷廊へ現れる魔女の亡霊。彼女が紡ぐ子守唄を聞いた者は、暖かな眠りに誘われるまま手足の感覚を失い、静かに凍りついていく。" }, // D67-70
  // -- 迷宮 71-80 (尖塔帯) / 強敵ランク10 --
  { id: "el_stareater", name: "星喰らい", elite: true, rank: 10, race: "demon", element: "dark", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#2a1a4a", 0.55),
    ability: "drain", physResist: 0.5, // 星すら喰らう胃袋に命を呑み、闇の体は刃を呑む
    desc: "尖塔の頂から夜空の星をひとつずつ喰らってきた大悪魔。星すら呑む胃袋で近づく者の命を喰らい、闇に満ちた体は突き立てた刃を呑む。次に喰らうのは地上の光だという。" }, // D71-73
  { id: "el_voidarchon", name: "虚空の執政官", elite: true, rank: 10, race: "specter", element: "light", artKey: "wraith", soulClass: "mage",
    palette: tint(ARTS.wraith.palette, "#f0f0e8", 0.6),
    evasive: true, ability: "soulSteal", // 虚空に紛れて刃をかわし、直視した者の存在を奪う
    desc: "塔の観測室が「何もない場所」を覗いた時、向こう側から歩いてきた執政官。虚空に紛れて刃をかわし、白く輝くその姿を直視した者は、輪郭から順に魂ごと存在を失う。" }, // D74-76
  { id: "el_geargod", name: "歯車の神", elite: true, rank: 10, race: "construct", element: "none", artKey: "golem",
    palette: tint(ARTS.golem.palette, "#b8a060", 0.5),
    physResist: 0.7, ability: "critical", // 噛み合う鋼鉄は刃を通さず、設計図から生命を除去する一撃
    desc: "尖塔の機構の奥で、誰にも知られず回り続けた歯車の集合体。噛み合う鋼鉄の躯は刃をまるで通さず、自らを神と定義し、噛み合わぬもの——生命を、急所への一撃で設計図から除去する。" }, // D77-80
  // -- 迷宮 81-90 (冥門帯) / 強敵ランク10 --
  { id: "el_hellwarden", name: "冥獄の大典獄", elite: true, rank: 10, race: "demon", element: "fire", artKey: "imp",
    palette: tint(ARTS.imp.palette, "#a02818", 0.5),
    ability: "breath", physResist: 0.5, // 獄炎を全体へ撒き、灼熱の巨躯は刃を弾く
    desc: "冥獄の最下層を預かる大典獄。引きずる焼けた鎖から獄炎を前衛後衛もろとも撒き、灼熱の巨躯は並の刃を弾く。腰に下がる無数の鍵は「出られなかった者」の数であり、新たな鍵を増やすことだけを喜びとする。" }, // D81-83
  { id: "el_soulflayer", name: "魂剥ぎの主", elite: true, rank: 10, race: "specter", element: "dark", artKey: "wraith", soulClass: "bishop",
    palette: tint(ARTS.wraith.palette, "#6a3a8a", 0.55),
    ability: "soulSteal", regen: 0.06, // 魂の殻を剥いで奪い、その力で己を保つ
    desc: "刈り取った魂の「殻」を剥ぎ、冥府への通行料として徴収する首魁。剥ぎ取った魂で己を繕い、剥がれた魂は名を忘れ、名を忘れた魂は、もう誰にも弔えない。" }, // D84-86
  { id: "el_palerider", name: "蒼褪めた騎手", elite: true, rank: 10, race: "armored", element: "dark", artKey: "knightmare", soulClass: "knight",
    palette: tint(ARTS.knightmare.palette, "#d8d8d0", 0.6),
    swift: true, ability: "critical", // 蹄鉄の音とともに先んじ、額へ一撃を打ち込む
    desc: "冥門の前を往復し続ける蒼褪めた騎手。その馬蹄の音を三度聞いた者の枕元に誰より先んじて現れ、四度目の蹄鉄を額の急所へ打ち込むという。" }, // D87-90
  // -- 迷宮 91-100 (玄室帯) / 強敵ランク10 --
  { id: "el_dragonslayer", name: "竜殺しの亡霊", elite: true, rank: 10, race: "specter", element: "none", artKey: "wraith", soulClass: "fighter",
    palette: tint(ARTS.wraith.palette, "#c0c8d8", 0.5),
    physResist: 0.5, ability: "critical", // 英雄の鎧が刃を弾き、竜殺しの一撃が急所を貫く
    desc: "百の竜を屠り、最後は竜の財宝の上で息絶えた英雄の亡霊。英雄の鎧は刃を弾き、竜殺しの本能が振るう一撃は急所だけを貫く。玄室を訪れる「竜より強き者」を新たな獲物と定めた。" }, // D91-93
  { id: "el_goldtyrant", name: "黄金の暴君竜", elite: true, rank: 10, race: "dragon", element: "light", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#e8c84a", 0.55),
    physResist: 0.7, ability: "breath", // 黄金の鱗は刃をほぼ通さず、灼熱の吐息で全体を焼く
    desc: "喰らった黄金が鱗となり、全身が財宝と化した暴君竜。黄金の鱗は刃をほとんど通さず、前衛後衛もろとも焼く吐息を放つ。己の体こそ世界最大の秘宝と誇り、それを見た者を生かして帰さぬことで価値を守る。" }, // D94-96
  { id: "el_eclipsedragon", name: "日蝕の竜", elite: true, rank: 10, race: "dragon", element: "dark", artKey: "dragon",
    palette: tint(ARTS.dragon.palette, "#141420", 0.6),
    evasive: true, ability: "breath", // 翳りに紛れて刃をかわし、日蝕の闇で全体を呑む
    desc: "天の竜が太陽を呑む——日蝕の伝承そのものが実体化した竜。翼を広げて灯りを翳らせ、その闇に紛れて刃をかわし、吐く息は前衛後衛もろとも日蝕の闇へ呑む。" }, // D97-100
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

// ===== 20層構成の層ボス (各層に1体・計20体) =====
// 100迷宮 = 20層 × 5迷宮。各層の最終迷宮 (D5,10,…,100) でのみ層ボスと戦う。
// 既存ボスから決定的に20体を選ぶ (層 L → ランク ceil(L/2) の 0 番目 / 5 番目)。
// ※ 段階リリースの基盤フェーズ用の暫定割り当て。各層の専用ボスは層ごとのPRで差し替える。
// 層のテーマに合う固有ボスの上書き (層を整備するたびに専用ボスへ差し替える)。
// 未指定の層は BOSS_ORDER からの暫定割り当てを使う。
const LAYER_BOSS_OVERRIDE = {
  5: "bs_forestlord", // 第5層「霧の森」: 霧の森の主 (rank7・植物ボス)
  4: "bs_fortlord",  // 第4層「捨て砦」: 砦の主 (rank6・armoredボス)
  2: "bs_sewerlord", // 第2層「地下水路」: 水路の主 (rank4・水棲ボス)
  3: "bs_minelord",  // 第3層「廃坑」: 坑道の主 (rank5・土ボス)
};
export const LAYER_BOSS = Array.from({ length: 20 }, (_, i) => {
  const L = i + 1;
  if (LAYER_BOSS_OVERRIDE[L]) return LAYER_BOSS_OVERRIDE[L];
  const r = Math.ceil(L / 2);
  return BOSS_ORDER[r][((L - 1) % 2) * 5];
});

// ===== 層ごとの専用ロスター (フェーズC: 層が変わると別のモンスターが出る) =====
// LAYER_POOLS[layer] = その層に出る通常モンスター id の配列 (ボス除く)。
// 定義済みの層は generator がここから抽選し、未定義の層は暫定のランクプールにフォールバックする。
// 各層は固有アートのモンスターで構成し、最低20種を目標に層ごとのPRで充実させる。
export const LAYER_POOLS = {
  // 第1層「墓地」: アンデッド/亡霊中心。新スキル (weaken 等) と既存の墓地系を再配置
  1: [
    // 新規 (固有アート・12体)
    "bs_gravewisp", "bs_grasphand", "bs_mournshade",
    "bs_corpsemaggot", "bs_carrioncrow", "bs_ghoul", "bs_bonepile", "bs_skullswarm",
    "bs_sarcoguard", "bs_weepangel", "bs_pettyrevenant", "bs_shroudstrangler",
    // 既存の墓地系を第1層へ再配置 (8体)
    "bs_bonebat", "bs_spiritbat", "bs_tombwarden",
    "bs_zombie", "d01_skeleton", "d02_soldier",
    "bs_bonechanter", "bs_gravecaller",
  ],
  // 第2層「地下水路」: 水棲/不定形中心、rank 3-4 で構成 (第1層でトレハン・育成しないと歯が立たない壁)
  2: [
    // 新規 (固有アート)
    "bs_giantleech", "bs_sludgeooze", "bs_toxictoad", "bs_drownedcorpse", "bs_eelfiend",
    "bs_sewercrab", "bs_abysstentacle", "bs_brinewraith", "bs_anglerfiend", "bs_bloatfly",
    "bs_waterhag", "bs_mucusworm", "bs_razorshrimp", "bs_ironcarp", "bs_fogspecter",
    // 既存の水棲/不定形を第2層へ再配置
    "cm_slime", "bs_swampslime", "bs_waterelemental", "d03_sahagin", "bs_deepsahagin",
  ],
  // 第3層「廃坑」: 土/構造体/虫中心、rank4-5主体 (第2層より格上)。深部に rank6 の旧坑の怪物
  3: [
    // 新規 (固有アート)
    "bs_rockworm", "bs_dustwraith", "bs_crystalcrawler", "bs_blastsprite", "bs_orehulk", "bs_tunneler",
    // 既存の土/構造体/虫を第3層へ再配置 (rank3-5)
    "bs_scorpion", "bs_poisonspider", "bs_marshgolem", "d02_lizard",
    "d03_orc", "bs_gargoyle", "bs_stonegorgon", "bs_shieldogre",
    "d03_mandrake", "bs_troll", "bs_deepgolem",
    // 深部の強敵 (rank6)
    "d04_golem", "d04_ogre", "bs_steelspider",
  ],
  // 第4層「捨て砦」: 武装兵/騎士/戦の亡霊中心、rank5-6主体 (第3層より格上)。深部に rank7 の騎士
  4: [
    // 新規 (固有アート)
    "bs_siegeballista", "bs_bannerwraith", "bs_gravecaptain", "bs_pikewall", "bs_drumwraith",
    // 既存の武装兵/戦の亡霊を第4層へ再配置 (rank4-6)
    "bs_darksamurai", "bs_bloodorc", "bs_cultist", "d03_ghost", "bs_banshee",
    "d03_sentinel", "bs_dullahan", "bs_ironknight", "bs_shadowmage",
    "bs_bloodwraith", "bs_bonecolossus", "bs_stormgiant",
    // 深部の強敵 (rank7)
    "d04_revenant", "bs_thunderknight", "bs_vampire",
  ],
  // 第5層「霧の森」: 植物/獣/妖中心、rank6-7主体 (第4層より格上)。火に弱い者が多い ※20種へ作成中
  5: [
    // 新規 (固有アート)
    "bs_misttreant", "bs_dryadfey", "bs_giantmoth", "bs_stranglevine", "bs_corruptstag", "bs_fungalhulk",
    // 既存の獣/鳥/爬虫を第5層へ再配置
    "bs_thunderbird", "bs_chimera", "bs_griffon", "bs_salamander",
    // batch2 新規 (固有アート)
    "bs_giantowl", "bs_direboar", "bs_willowwitch", "bs_sporezombie", "bs_thornhound",
    "bs_wisplure", "bs_satyrpiper", "bs_flytrap", "bs_mossgolem", "bs_fogpanther",
  ],
};
{ // 検証: 定義済みの層プールは実在する非ボス・非強敵のモンスターのみ
  for (const L in LAYER_POOLS) {
    const ids = LAYER_POOLS[L];
    if (!Array.isArray(ids) || ids.length < 6) throw new Error("LAYER_POOLS: layer " + L + " needs >=6 regulars");
    for (const id of ids) {
      const m = BESTIARY[id];
      if (!m) throw new Error("LAYER_POOLS: unknown monster " + id + " (layer " + L + ")");
      if (m.boss || m.elite) throw new Error("LAYER_POOLS: " + id + " must be a regular monster (layer " + L + ")");
    }
  }
}
