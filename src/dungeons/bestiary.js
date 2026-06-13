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
  // -- 第6層「沈没神殿」 (rank 7-8・水/神殿。第5層より格上の壁。深部に rank9 の神像・堕天) --
  { id: "bs_drownedpriest", name: "水底の祈り手", rank: 7, race: "specter", element: "water", artKey: "drownedpriest", soulClass: "priest",
    role: "healer", ability: "weaken", // 呪詛で力を奪い、傷ついた眷属を癒す
    desc: "神殿が湖底に沈んでなお、祭壇の前で祈りを止めない溺死した神官。生者には力を奪う呪詛を、傷ついた同胞には癒しの祈りを捧げる。その口から漏れるのは、もう意味をなさぬ経文だ。" },
  { id: "bs_fonthorror", name: "聖水盤の異形", rank: 7, race: "aquatic", element: "water", artKey: "fonthorror",
    ability: "poison", regen: 0.08, physResist: 0.4, // 聖水を毒水に変え、刃を呑む粘塊
    desc: "聖水盤に巣食い、清めの水を毒の沼に変えてしまった触手の塊。盤の縁から腕を伸ばして獲物を絡め取り、腐った聖水を浴びせる。ぬめる肉は刃をすべらせ、削いだ先から盛り上がる。" },
  { id: "bs_choirwraith", name: "水没聖歌隊", rank: 7, race: "specter", element: "water", artKey: "choirwraith",
    pack: true, ability: "paralyze", // 群れで痺れる賛美歌を歌い上げる
    desc: "水没の夜から、止むことのない賛美歌を歌い続ける聖歌隊の霊。幾重にも重なる歌声を浴びた者は、荘厳さに打たれて身が痺れ、動けなくなる。一体を黙らせても、隣の口がすぐ後を継ぐ。" },
  { id: "bs_idolguardian", name: "神像の番人", rank: 8, race: "construct", element: "water", artKey: "idolguardian",
    role: "guard", physResist: 0.6, barrier: 2, // 旧き神の石像。主を庇い、刃を阻む
    desc: "旧き神を象った巨大な石像が、聖域を侵す者の前に立ちはだかる。背後の祭司を己の石身で庇い、刻まれた神文が刃を撥ね返す。沈黙の神に代わって、まだ忠実に務めを果たしている。" },
  { id: "bs_abyssjelly", name: "深海の鐘鬼", rank: 7, race: "aquatic", element: "water", artKey: "abyssjelly",
    ability: "paralyze", lifesteal: 0.3, magWeak: 1.4, // 触手で痺れさせ精気を吸う。実体は脆い
    desc: "鐘の形をした、深海から這い上がった半透明の魔。長い触手で獲物を痺れさせ、まとわりついて精気を吸い上げる。淡く発光する体は美しいが、魔の力を浴びれば容易く弾ける。" },
  { id: "bs_tidecaller", name: "潮を呼ぶ司祭", rank: 8, race: "specter", element: "water", artKey: "tidecaller", soulClass: "priest",
    role: "summoner", summonKey: "bs_choirwraith", ability: "drain", regen: 0.06, // 眷属を呼び、命を吸い、潮で傷を繕う
    desc: "神殿をみずから湖底へ沈めた、背教の大司祭の霊。潮を操って眷属を次々と呼び寄せ、生者の命を吸って自らの存在を保つ。沈めたのは罰からの逃避か、それとも何かを封じるためか。" },
  { id: "bs_kelpdrowned", name: "藻に巻かれし者", rank: 7, race: "undead", element: "water", artKey: "kelpdrowned",
    ability: "paralyze", lifesteal: 0.3, pack: true, // 海藻ごと群れで絡みつき、痺れさせ精気を吸う
    desc: "神殿に押し寄せた水に呑まれ、海藻に絡め取られたまま朽ちた参拝者の群れ。藻ごと幾体も折り重なって獲物に巻きつき、冷たい指で締め上げて精気を啜る。藻を断っても、また別の手が伸びる。" },
  { id: "bs_sunkenbell", name: "祟りの梵鐘", rank: 8, race: "construct", element: "water", artKey: "sunkenbell",
    ability: "paralyze", magResist: 0.5, barrier: 2, // 鳴れば魂が痺れる祟りの鐘。魔を弾く
    desc: "水没した鐘楼から響き続ける、祟りを宿した神殿の梵鐘。ひとたび鳴れば、その音は骨の髄まで染み入って魂を痺れさせる。青銅の身は刃を阻み、魔力をも鈍く弾き返す。" },
  { id: "bs_templelord", name: "沈める神官王", rank: 8, boss: true, race: "specter", element: "water", artKey: "templelord", soulClass: "priest",
    role: "summoner", summonKey: "bs_kelpdrowned", ability: "drain", physResist: 0.5, regen: 0.06, magWeak: 1.3, // 眷属を呼び、命を貪り、潮で繕う。光に脆い
    desc: "神殿を湖底へ沈め、自らも王冠を被ったまま溺れ果てた背教の神官王。沈んだ参拝者を眷属として呼び起こし、生者の命を貪って永遠の祈祷を続ける。湖底の闇に慣れた身は、聖なる光に焼かれて崩れる。" },
  // -- 第7層「灼熱の洞」 (rank 8-9・火/溶岩。第6層より格上の壁。深部に rank10) --
  { id: "bs_lavagolem", name: "溶岩のゴーレム", rank: 8, race: "construct", element: "fire", artKey: "lavagolem",
    physResist: 0.6, barrier: 2, enrage: true, // 岩殻が刃を阻み、割れると噴き出す溶岩で猛る
    desc: "黒い岩の殻の下に溶岩を滾らせて歩く巨人。分厚い殻は刃をことごとく弾き返すが、砕かれた割れ目から噴き出す熱とともに、手がつけられぬほど荒れ狂う。" },
  { id: "bs_magmaslime", name: "溶岩の粘塊", rank: 8, race: "amorph", element: "fire", artKey: "magmaslime",
    physResist: 0.5, regen: 0.1, ability: "poison", // 煮えたぎる溶岩の塊。刃が沈み、爛れさせ、寄り集まる
    desc: "黒い皮膜の下で煮えたぎる、意思を持った溶岩の塊。触れたものを灼けただれさせ、刃を突き立てても泥のように沈んで効かない。崩しても、熱い核さえ残れば再び寄り集まる。" },
  { id: "bs_sulfurfiend", name: "硫黄の鬼", rank: 8, race: "demon", element: "fire", artKey: "sulfurfiend",
    ability: "critical", swift: true, multistrike: 2, // 毒火の爪で素早く急所を続けざまに抉る
    desc: "火口の硫煙が凝って生じた、角を生やした炎の鬼。毒火をまとった鉤爪で素早く二度三度と斬りつけ、その一撃は鎧ごと急所を抉る。硫黄の悪臭が、こいつの近づく合図だ。" },
  { id: "bs_cinderwraith", name: "燃え殻の亡霊", rank: 8, race: "specter", element: "fire", artKey: "cinderwraith",
    ability: "drain", lifesteal: 0.3, evasive: true, // 燻る霊。触れた命を吸い、熾火のように掴みどころがない
    desc: "焼け死んだ者の未練が、燻る熾火の霊となって彷徨う姿。触れた者の命を吸って一瞬輝きを増し、刃を向ければ火の粉となって散ってかわす。消えたかと思えば、背後で再び赤く灯る。" },
  { id: "bs_flamedrake", name: "炎の幼竜", rank: 9, race: "dragon", element: "fire", artKey: "flamedrake",
    ability: "breath", enrage: true, swift: true, // 業炎のブレスを吐き、手負いで荒れ狂う
    desc: "火口に巣くう、まだ若い火竜。気性は荒く、両翼を広げて全体を業炎のブレスで焼き払う。手負いになれば見境を失い、洞窟が崩れるのも構わず暴れ回る。" },
  { id: "bs_obsidianguard", name: "黒曜の番兵", rank: 9, race: "construct", element: "fire", artKey: "obsidianguard",
    role: "guard", physResist: 0.6, magResist: 0.5, barrier: 2, // 黒曜石の殻が刃も魔も弾き、主を庇う
    desc: "火口を守るために黒曜石を削り出して作られた番兵。鋭く硬い殻は刃を弾き、魔力もまた磨かれた面に滑り落ちる。背後の主を己の身で庇い、決してその場を動かない。" },
  { id: "bs_lavamaw", name: "溶岩の顎", rank: 8, race: "aquatic", element: "fire", artKey: "lavamaw",
    ability: "critical", lifesteal: 0.3, physResist: 0.4, // 溶岩に潜み丸呑みにする顎。喰らって己を満たす
    desc: "溶岩溜まりに口だけを開けて獲物を待つ、罠のような魔。近づいた者を一息に丸呑みにし、灼けた腹で溶かして己の熱に変える。一見ただの溶岩の泡だが、近づけば牙が並ぶ。" },
  { id: "bs_ashghoul", name: "灰塗れの喰屍鬼", rank: 8, race: "undead", element: "fire", artKey: "ashghoul",
    ability: "poison", regen: 0.08, pack: true, // 火砕流に焼かれた亡者。灰の毒を撒き群れで這う
    desc: "火砕流に呑まれて焼け焦げ、それでも這い続ける亡者の群れ。動くたびに有毒の灰を撒き散らし、焦げた手で生者を引きずり込む。崩れても、灰の中からまた起き上がる。" },
  { id: "bs_emberswarm", name: "火の粉の蟲群", rank: 8, race: "insect", element: "fire", artKey: "emberswarm",
    pack: true, multistrike: 2, swift: true, // 灼熱の羽虫の群れ。素早く群れて何度も焼き刺す
    desc: "火口の熱気に湧いた、灼熱に輝く無数の羽虫の群れ。風に乗って素早く飛び回り、群れごと獲物にまとわりついて何度も焼き刺す。払っても払っても、熱のある限り湧き続ける。" },
  { id: "bs_pyrelich", name: "業火の死霊術師", rank: 9, race: "undead", element: "fire", artKey: "pyrelich", soulClass: "mage",
    role: "summoner", summonKey: "bs_ashghoul", ability: "drain", magWeak: 1.3, // 亡者を呼び、命を吸う。骨は熱に脆い
    desc: "炎を求めて火口に降り、業火をまとったまま朽ちた魔術師の骸。灰の亡者を次々と呼び起こし、生者の命を吸って術を保つ。だが乾いた骨は、自ら操る炎にこそ脆い。" },
  { id: "bs_brimstonegolem", name: "硫黄の鋳像", rank: 8, race: "construct", element: "fire", artKey: "brimstonegolem",
    physResist: 0.5, barrier: 2, ability: "poison", // 硫黄を固めた像。毒煙を噴き、刃を阻む
    desc: "火口の硫黄を煮固めて鋳た、黄ばんだ巨像。継ぎ目から絶えず有毒の煙を噴き上げ、近づく者を咳き込ませる。脆く見えて、固まった硫黄の殻は存外に刃を通さない。" },
  { id: "bs_furnacefiend", name: "溶鉱の鬼神", rank: 9, race: "demon", element: "fire", artKey: "furnacefiend",
    ability: "critical", enrage: true, multistrike: 2, // 溶鉱炉の巨鬼。手負いで荒れ狂い連打する
    desc: "溶鉱炉の底から生まれ出た、燃え盛る巨躯の鬼神。鎚のような両腕で続けざまに打ち据え、傷を負うほど炉のように赤熱して猛る。その一撃は岩盤すら鍛冶のごとく叩き潰す。" },
  { id: "bs_magmaray", name: "溶岩のエイ", rank: 8, race: "aquatic", element: "fire", artKey: "magmaray",
    ability: "paralyze", swift: true, evasive: true, // 溶岩を泳ぐ魔魚。帯電した尾で痺れさせ翻る
    desc: "溶岩の海を翼のように泳ぐ、灼熱の魔魚。帯電した長い尾で獲物を痺れさせ、ひらりと身を翻して刃をかわす。溶岩の表面をなめらかに滑る姿は、影のように捉えどころがない。" },
  { id: "bs_basaltdrake", name: "玄武岩の竜", rank: 9, race: "dragon", element: "fire", artKey: "basaltdrake",
    ability: "breath", physResist: 0.5, enrage: true, // 岩鱗が刃を阻み、業炎を吐く。手負いで猛る
    desc: "黒い玄武岩の鱗に全身を覆われた火竜。岩のごとき鱗は並の刃を寄せつけず、腹の底で滾る溶岩を業炎として吐き出す。冷えて固まったように見えても、内には常に火が燃えている。" },
  { id: "bs_infernolord", name: "業火の主", rank: 9, boss: true, race: "demon", element: "fire", artKey: "infernolord", soulClass: "hexer",
    role: "summoner", summonKey: "bs_sulfurfiend", ability: "breath", physResist: 0.5, enrage: true, // 眷属を呼び、業炎を吐き、手負いで荒れ狂う
    desc: "灼熱の洞の最奥、煮えたぎる溶岩湖の中心に座す業火の魔王。配下の鬼を次々と呼び寄せ、洞窟ごと焼き尽くす業炎のブレスを吐く。追い詰めれば、その身は太陽のごとく膨れ上がり、すべてを灰に帰そうとする。" },
  // -- 第8層「氷結回廊」 (rank 8-9・氷/水。第7層より格上の壁。火に弱い者が多い) --
  { id: "bs_frostwyrm", name: "氷牙の蛇竜", rank: 9, race: "dragon", element: "water", artKey: "frostwyrm",
    ability: "breath", physResist: 0.4, swift: true, // 凍てつくブレスを吐き、氷鱗が刃を阻み、素早い
    desc: "氷の回廊をのたうつ、青白い鱗の蛇竜。凍てつく吐息で全体を凍りつかせ、硬い氷鱗は刃を弾く。地を這う動きは見た目より速く、気づけば背後に回り込んでいる。" },
  { id: "bs_icegolem", name: "氷塊のゴーレム", rank: 8, race: "construct", element: "water", artKey: "icegolem",
    physResist: 0.6, magResist: 0.5, barrier: 2, // 透き通る氷の殻が刃も魔も阻む
    desc: "回廊の氷が人の形に凝り固まった巨人。透き通る分厚い氷の殻は刃を弾き、魔力すら凍った表面に滑り落ちる。砕くには、まずその冷気の鎧を割らねばならない。" },
  { id: "bs_frozenexplorer", name: "凍てつく先人", rank: 8, race: "undead", element: "water", artKey: "frozenexplorer",
    ability: "drain", physResist: 0.3, lifesteal: 0.2, // 真実に届いた歴代の魂繰り。命を喰らい温もりを奪う
    desc: "真実に届いてしまい、氷漬けにされた歴代の魂繰りたち。半ば凍ったまま彷徨い、生者の温もりと宿した魂を奪っては、束の間おのれの凍えを忘れる。その顔は、いつかの己かもしれない。" },
  { id: "bs_blizzardspirit", name: "吹雪の精", rank: 8, race: "elemental", element: "water", artKey: "blizzardspirit",
    ability: "paralyze", evasive: true, magWeak: 1.4, // 渦巻く吹雪。痺れさせ、刃をすり抜ける。熱には脆い
    desc: "回廊を吹き荒れる吹雪が、渦を巻いて意思を持ったもの。凍える風で獲物の身を痺れさせ、刃を向ければ雪となって舞い散ってかわす。が、ひとたび炎を浴びれば、たちまち溶け消える。" },
  { id: "bs_rimegiant", name: "氷河の巨人", rank: 9, race: "giant", element: "water", artKey: "rimegiant",
    physResist: 0.5, enrage: true, multistrike: 2, // 氷河を背負う巨人。氷塊で連打し、手負いで雪崩のごとく荒れる
    desc: "背に小さな氷河を背負った、霜まみれの巨人。両の拳で氷塊ごと続けざまに叩きつけ、傷を負えば雪崩のように荒れ狂う。その咆哮だけで、回廊の天井から氷柱が降り注ぐ。" },
  { id: "bs_icewraith", name: "氷霊", rank: 8, race: "specter", element: "water", artKey: "icewraith",
    ability: "paralyze", lifesteal: 0.3, magWeak: 1.4, // 凍える恨みの霊。痺れさせ命を吸う。実体は脆い
    desc: "凍え死んだ者の恨みが、青白い霊となって回廊をさまよう。触れられた者は芯から凍えて動けなくなり、奪われた熱がこの霊を一瞬色濃くする。実体は薄く、魔の熱には抗えない。" },
  { id: "bs_frostwolf", name: "白霜の狼", rank: 8, race: "beast", element: "water", artKey: "frostwolf",
    swift: true, pack: true, ability: "critical", // 霜をまとう白狼。群れで素早く囲み、急所を一咬み
    desc: "氷の回廊を音もなく駆ける、霜をまとった白い狼の群れ。吐く息は白く凍り、群れで素早く取り囲んでは、急所めがけて一咬みで仕留める。雪に紛れた姿は、襲われるまで見えない。" },
  { id: "bs_rimecrawler", name: "霜甲の蟲", rank: 8, race: "insect", element: "water", artKey: "rimecrawler",
    physResist: 0.5, magResist: 0.5, multistrike: 2, // 氷の甲殻が刃も魔も弾き、氷牙で連打する
    desc: "氷の甲殻に覆われた、人を超える大蟲。鏡のような甲殻は刃を弾き、魔力も冷えた殻に吸われて霧散する。凍りついた顎で、岩をも噛み砕いて連打する。" },
  { id: "bs_iciclehorror", name: "氷柱の魔", rank: 9, race: "amorph", element: "water", artKey: "iciclehorror",
    multistrike: 3, physResist: 0.4, // 天井から無数に垂れる氷柱の群体。突き刺し連打する
    desc: "回廊の天井から無数に垂れ下がった氷柱が、ひとつの意思で蠢く群体。獲物の上に落ちかかり、鋭い先端で何度も突き刺す。砕いた先から、また新たな氷柱が伸びてくる。" },
  { id: "bs_glaciallord", name: "氷結回廊の主", rank: 9, boss: true, race: "specter", element: "water", artKey: "glaciallord", soulClass: "mage",
    role: "summoner", summonKey: "bs_frozenexplorer", ability: "breath", physResist: 0.5, enrage: true, magWeak: 1.3, // 先人を呼び、凍てつく息を吐く。火に弱い
    desc: "氷結回廊そのものを凍てつかせ、歴代の先人を氷漬けにして見張る氷の支配者。凍れる魂繰りを次々と呼び覚まし、回廊ごと凍らせる絶対零度の息を吐く。誰よりも真実に近づき、誰よりも深く凍りついた者の成れの果てだ。" },
  // -- 第8層「氷結回廊」 batch2 (rank 8-9) --
  { id: "bs_frostknight", name: "凍れる騎士", rank: 9, race: "armored", element: "water", artKey: "frostknight",
    ability: "critical", physResist: 0.4, barrier: 2, // 氷漬けの甲冑。氷剣で急所を貫き、刃を阻む
    desc: "回廊で凍え死に、氷漬けのまま動き出した騎士の甲冑。手にした氷の剣は鎧ごと急所を貫き、霜に覆われた鎧は刃を弾く。中身はとうに溶けて、ただ未練だけが甲冑を動かしている。" },
  { id: "bs_snowstalker", name: "雪渡りの獣", rank: 8, race: "beast", element: "water", artKey: "snowstalker",
    swift: true, enrage: true, multistrike: 2, // 雪原を渡る白毛の大獣。手負いで猛り、連打で薙ぐ
    desc: "白い吹雪に紛れて雪原を渡る、毛むくじゃらの大獣。雪に溶け込む白毛で気配を消し、太い腕で続けざまに薙ぎ払う。傷を負えば吼えながら猛進し、雪煙を巻き上げて暴れ回る。" },
  { id: "bs_iceserpent", name: "氷の大蛇", rank: 8, race: "reptile", element: "water", artKey: "iceserpent",
    ability: "paralyze", swift: true, multistrike: 2, // 氷鱗の大蛇。素早く巻きつき、冷気で痺れさせ連咬する
    desc: "凍てつく鱗をもつ、回廊をのたうつ大蛇。素早く巻きついて締め上げ、冷気の牙で何度も噛みついて獲物を痺れさせる。氷の床を滑るように進む姿は、捉えるのが難しい。" },
  { id: "bs_winterbat", name: "霜羽の蝙蝠", rank: 8, race: "avian", element: "water", artKey: "winterbat",
    swift: true, evasive: true, pack: true, ability: "paralyze", // 凍える翼の蝙蝠の群れ。乱舞して痺れさせる
    desc: "凍える翼をもつ蝙蝠の群れ。回廊の闇を素早く乱舞し、冷気をまとった羽ばたきで獲物を痺れさせる。一匹を叩き落としても、霜を散らして次の群れが舞い降りる。" },
  { id: "bs_glacialcrab", name: "氷殻の大蟹", rank: 8, race: "aquatic", element: "water", artKey: "glacialcrab",
    physResist: 0.55, barrier: 2, ability: "critical", // 氷の甲殻が刃を阻み、鋏で急所を断つ
    desc: "氷の甲殻に覆われた、凍った泉に潜む大蟹。鏡のような殻は刃をことごとく弾き、鋼の鋏は鎧ごと急所を断ち切る。横歩きで氷上を滑り、退路を塞いでくる。" },
  { id: "bs_frostlich", name: "氷結の死霊術師", rank: 9, race: "undead", element: "water", artKey: "frostlich", soulClass: "mage",
    role: "summoner", summonKey: "bs_frozenexplorer", ability: "drain", magWeak: 1.3, // 先人を呼び、命を吸う。骨は熱に脆い
    desc: "永遠の知を求めて回廊に降り、自ら氷漬けとなった魔術師の骸。凍れる先人を次々と呼び覚まし、生者の命を吸って術を保つ。凍てついた骨は、皮肉にも炎の魔法に最も脆い。" },
  { id: "bs_snowmantis", name: "霜の大蟷螂", rank: 8, race: "insect", element: "water", artKey: "snowmantis",
    swift: true, ability: "critical", multistrike: 2, // 氷の鎌で素早く急所を続けざまに刈る
    desc: "氷の鎌をもつ、人の背丈ほどの大蟷螂。鏡のように研ぎ澄まされた鎌は一閃で鎧を断ち、目にも留まらぬ速さで急所を続けざまに刈り取る。祈るような構えのまま、獲物を待っている。" },
  { id: "bs_frostmaiden", name: "氷の乙女", rank: 9, race: "specter", element: "water", artKey: "frostmaiden",
    ability: "weaken", role: "healer", magWeak: 1.3, // 哀歌で力を奪い、凍れる眷属を癒す。火に弱い
    desc: "氷柱に閉ざされたまま凍え死んだ乙女の霊。澄んだ哀歌を響かせて生者の力を奪い、傷ついた凍れる眷属には癒しの旋律を捧げる。その美しさは、近づく者を惑わせる罠だ。" },
  { id: "bs_frozenangel", name: "氷漬けの堕天", rank: 9, race: "construct", element: "water", artKey: "frozenangel",
    physResist: 0.6, magResist: 0.5, barrier: 2, // 氷柱に磔にされた翼の像。刃も魔も凍て阻む
    desc: "翼を広げたまま氷柱に磔にされた、堕ちた天使の像。分厚い氷の鎧は刃を弾き、魔力も凍りついた表面を滑り落ちる。祈るように閉じた目は、もう二度と開かない。" },
  { id: "bs_frostfiend", name: "氷結の鬼", rank: 8, race: "demon", element: "water", artKey: "frostfiend",
    ability: "critical", enrage: true, multistrike: 2, // 冷気をまとう青鬼。爪で急所を抉り、手負いで荒れる
    desc: "絶対零度の冷気をまとった、青く凍てつく鬼。氷の爪で鎧ごと急所を抉り、二度三度と斬りつける。傷を負うほど身を覆う氷が軋み、見境なく荒れ狂う。" },
  { id: "bs_aurorawisp", name: "極光の群火", rank: 8, race: "specter", element: "water", artKey: "aurorawisp",
    pack: true, ability: "paralyze", evasive: true, magWeak: 1.5, // 揺れる極光の群体。誘い込み痺れさせる。実体は薄い
    desc: "回廊の天井に揺らめく、極光の色をした鬼火の群れ。美しい光に見惚れた者を誘い込んでは、冷気で痺れさせて凍えさせる。実体に乏しく刃をすり抜けるが、魔の力にはひとたまりもない。" },
  // -- 第9層「毒沼」 (rank 9-10・毒/腐敗。第8層より格上の壁) --
  { id: "bs_plaguebeast", name: "疫病の獣", rank: 9, race: "beast", element: "earth", artKey: "plaguebeast",
    ability: "poison", enrage: true, multistrike: 2, // 病毒を撒き、手負いで荒れ、連打で薙ぐ
    desc: "疫病に冒されて狂った、毒膿を滴らせる獣。噛みつくたびに病毒を流し込み、傷つけば膿んだ体で見境なく暴れ回る。その通り道には、必ず疫病が広がる。" },
  { id: "bs_rotooze", name: "腐敗の泥", rank: 9, race: "amorph", element: "earth", artKey: "rotooze",
    physResist: 0.5, regen: 0.1, ability: "poison", // 腐汁の泥。刃が沈み、毒を浴びせ、寄り集まる
    desc: "沼の底に積もった腐敗が、意思を持って這い上がった泥。触れたものを腐汁の毒で爛れさせ、刃を突き立てても泥に沈んで効かない。崩しても、腐臭の核さえ残れば甦る。" },
  { id: "bs_swamphag", name: "沼の魔女", rank: 10, race: "specter", element: "earth", artKey: "swamphag", soulClass: "hexer",
    ability: "weaken", role: "summoner", summonKey: "bs_leechswarm", regen: 0.06, // 呪詛で力を奪い、蛭を呼び、泥で繕う
    desc: "毒沼に棲みついた、藻と腐肉をまとう老いた魔女。呪いの言葉で生者の力を奪い、沼の蛭を次々と這わせる。沼の毒気が、こいつの若さと術を保っている。" },
  { id: "bs_bogdrowned", name: "沼の溺者", rank: 9, race: "undead", element: "water", artKey: "bogdrowned",
    ability: "poison", lifesteal: 0.3, pack: true, // 沼に沈んだ溺者の群れ。毒泥で侵し、群れで引き込む
    desc: "毒沼に足を取られて沈んだ者たちの、膨れ腐った群れ。泥に塗れた手で生者を掴み、毒の沼へ引きずり込もうとする。一体を払っても、泥の中から幾つもの手が伸びる。" },
  { id: "bs_venomspider", name: "猛毒の大蜘蛛", rank: 9, race: "insect", element: "earth", artKey: "venomspider",
    ability: "poison", multistrike: 2, swift: true, // 猛毒の牙で素早く幾度も噛みつく
    desc: "沼地に巣を張る、人を捕らえるほどの大蜘蛛。猛毒の牙で素早く何度も噛みつき、痺れた獲物を糸で吊るす。八本の脚で水面を滑り、退路を糸で塞いでくる。" },
  { id: "bs_miasmawraith", name: "瘴気の霊", rank: 9, race: "specter", element: "earth", artKey: "miasmawraith",
    ability: "poison", evasive: true, magWeak: 1.4, // 毒気の霊。蝕み、すり抜け、魔に脆い
    desc: "沼から立ちのぼる瘴気が、ぼんやりと形をなした毒の霊。まとわりつく毒気で生者を蝕み、刃を向ければ霧となって散ってかわす。実体が薄く、魔の力には抗えない。" },
  { id: "bs_corpseflower", name: "屍肉花", rank: 9, race: "plant", element: "earth", artKey: "corpseflower",
    ability: "poison", multistrike: 2, regen: 0.08, // 死臭で誘い、毒蔓で何度も打ち、刈っても咲く
    desc: "死臭を放って獲物を誘い寄せる、毒々しい大輪の食人花。蔓を鞭のように振るって何度も打ち据え、毒液で溶かして養分にする。刈り取っても、屍肉のある限り咲き続ける。" },
  { id: "bs_plaguerat", name: "疫病鼠の大群", rank: 9, race: "beast", element: "earth", artKey: "plaguerat",
    pack: true, ability: "poison", lifesteal: 0.3, // 病を運ぶ鼠の大群。噛んで毒し、血を啜る
    desc: "疫病を撒き散らす、膨れ上がった鼠の大群。波のように押し寄せて噛みつき、病毒を移しては血を啜る。一匹叩いても、足元の闇からまた百匹が湧き出る。" },
  { id: "bs_toxicgolem", name: "汚泥の巨塊", rank: 10, race: "construct", element: "earth", artKey: "toxicgolem",
    physResist: 0.6, barrier: 2, ability: "poison", // 汚泥が固まった巨塊。刃を阻み、毒煙を噴く
    desc: "沼の汚泥が幾年も積もって固まり、動き出した巨塊。叩いても泥に沈んで手応えがなく、継ぎ目からは絶えず毒の煙が噴き出す。沼そのものが立ち上がったような、底知れぬ重さだ。" },
  { id: "bs_leechswarm", name: "蛭の群体", rank: 9, race: "amorph", element: "water", artKey: "leechswarm",
    lifesteal: 0.4, pack: true, ability: "paralyze", // 無数の蛭。吸い付いて痺れさせ、血を貪る
    desc: "毒沼に湧いた、無数の黒い蛭が寄り集まった群体。一斉に吸い付いて獲物を痺れさせ、奪った血で赤黒く膨れ上がる。引き剥がそうにも、千切れた蛭がまた吸い付く。" },
  { id: "bs_gasfiend", name: "毒気の鬼", rank: 9, race: "demon", element: "earth", artKey: "gasfiend",
    ability: "breath", enrage: true, magWeak: 1.3, // 全体に毒の息を吐き、手負いで荒れる
    desc: "沼の毒気が凝って生まれた、緑にくすむ鬼。口を開けば全体を包む毒の息を吐き、近づく者を残らず病に沈める。傷を負えば毒気を噴き上げて荒れ狂う。" },
  { id: "bs_marshlurker", name: "沼に潜む顎", rank: 9, race: "aquatic", element: "water", artKey: "marshlurker",
    ability: "critical", lifesteal: 0.3, physResist: 0.4, // 沼に潜み、急所を一噛みで仕留め、喰らって満ちる
    desc: "泥水に身を沈め、目だけを出して獲物を待つ大顎の魔。近づいた者を一息に咥え込み、鎧ごと急所を噛み砕く。泥に覆われた体は刃を通さず、喰らうほどに肥える。" },
  { id: "bs_pestilenceknight", name: "疫病の騎士", rank: 10, race: "armored", element: "earth", artKey: "pestilenceknight",
    ability: "critical", physResist: 0.4, enrage: true, // 疫病の鎧。急所を貫き、刃を阻み、手負いで猛る
    desc: "疫病で全滅した軍の、ただ一騎生き残って腐り果てた騎士。膿の滴る鎧は刃を阻み、錆びた剣は鎧ごと急所を貫く。倒れた仲間の恨みを背負い、傷つくほど鬼気迫る。" },
  { id: "bs_fungalcorpse", name: "茸まみれの死人", rank: 9, race: "undead", element: "earth", artKey: "fungalcorpse",
    ability: "poison", regen: 0.08, pack: true, // 茸に侵された死人。胞子を撒き、群れ、甦る
    desc: "沼に倒れ、毒茸に全身を乗っ取られた死人の群れ。背の傘から毒胞子を撒き、近づく者を侵す。打ち崩しても、残った菌糸からまた起き上がってくる。" },
  { id: "bs_blightmoth", name: "枯死の大蛾", rank: 9, race: "insect", element: "earth", artKey: "blightmoth",
    ability: "paralyze", evasive: true, swift: true, // 枯死の鱗粉で痺れさせ、ふらりと舞ってかわす
    desc: "毒沼の夜に舞う、触れたものを枯らす鱗粉をまとった大蛾。鱗粉を浴びた者は痺れて立ち尽くし、刃を向ければ不規則に舞ってかわす。灯りに群がり、油断した者を狙う。" },
  { id: "bs_sludgehydra", name: "汚泥の多頭", rank: 10, race: "reptile", element: "water", artKey: "sludgehydra",
    multistrike: 3, ability: "poison", regen: 0.08, // 幾つもの頭で毒を吐き連打し、斬っても生える
    desc: "汚泥から幾つもの首をもたげる、毒沼の多頭の魔。それぞれの口から毒を吐き、続けざまに噛みつく。一つ首を落としても、泥の中から新たな首が生えてくる。" },
  { id: "bs_discardeddoll", name: "捨てられた人業", rank: 9, race: "construct", element: "dark", artKey: "discardeddoll",
    ability: "drain", enrage: true, lifesteal: 0.3, // 使い潰された器の成れの果て。命を求めて掴みかかる
    desc: "使い潰され、毒沼へ捨てられた人業の成れの果て。砕けた体で起き上がり、失った魂を求めて生者の温もりに掴みかかる。その縫い目の顔は、かつての自分に似ているかもしれない。" },
  { id: "bs_swamplord", name: "澱みの主", rank: 10, boss: true, race: "amorph", element: "earth", artKey: "swamplord", soulClass: "hexer",
    role: "summoner", summonKey: "bs_rotooze", ability: "breath", physResist: 0.5, regen: 0.08, // 腐泥を呼び、毒気を吐き、沼で繕う
    desc: "毒沼のすべての澱みが寄り集まって意思を得た、沼そのものの主。腐敗の泥を眷属として吐き出し、全体を包む毒気の息で生者を沈める。ここに捨てられた数えきれぬ魂が、その身に溶け込んでいる。" },
  // -- 第10層「嵐の尖塔」 (rank 9-10・風/雷。第9層より格上の壁) --
  { id: "bs_stormelemental", name: "嵐の精", rank: 9, race: "elemental", element: "wind", artKey: "stormelemental",
    ability: "paralyze", evasive: true, multistrike: 2, // 渦巻く雷雲。痺れさせ、すり抜け、連撃する
    desc: "尖塔に渦巻く雷雲が意思を得た精。帯電した渦で獲物を痺れさせ、刃を向ければ風となって散ってかわす。一度に幾度も雷を落とす、掴みどころのない嵐だ。" },
  { id: "bs_thunderroc", name: "雷鳴の大鵬", rank: 9, race: "avian", element: "wind", artKey: "thunderroc",
    ability: "breath", swift: true, // 雷を呼ぶ羽ばたきで全体を撃ち、空を疾る
    desc: "尖塔の頂に巣くう、雷雲を背負った巨鳥。一打ちの羽ばたきが雷鳴を呼び、全体を稲妻で撃つ。風を切って疾る姿に、矢も追いつかない。" },
  { id: "bs_windwraith", name: "疾風の霊", rank: 9, race: "specter", element: "wind", artKey: "windwraith",
    ability: "paralyze", evasive: true, swift: true, magWeak: 1.3, // 疾風の霊。先んじて痺れさせ、すり抜ける
    desc: "尖塔を吹き抜ける風に溶けた霊。誰より速く間合いを詰めて獲物を痺れさせ、刃を向ければ風そのものとなってすり抜ける。実体が薄く、魔の力には抗えない。" },
  { id: "bs_galeknight", name: "烈風の騎士", rank: 10, race: "armored", element: "wind", artKey: "galeknight",
    ability: "critical", swift: true, physResist: 0.4, // 烈風をまとう騎士。先制で急所を貫き、刃を阻む
    desc: "風をまとって宙を駆ける、尖塔を守る騎士。烈風に乗って先んじて間合いを詰め、風の剣で鎧ごと急所を貫く。風が鎧の継ぎ目を覆い、並の刃を逸らす。" },
  { id: "bs_cloudgiant", name: "雲の巨人", rank: 9, race: "giant", element: "wind", artKey: "cloudgiant",
    physResist: 0.5, enrage: true, multistrike: 2, // 雲を踏む巨人。雷拳で連打し、手負いで嵐となる
    desc: "尖塔の高みで雲を踏む、雷を孕んだ巨人。雷をまとった拳で続けざまに叩きつけ、傷を負えば嵐そのものとなって荒れ狂う。その足音は、遠雷のように響く。" },
  { id: "bs_tempestserpent", name: "嵐の蛇竜", rank: 10, race: "dragon", element: "wind", artKey: "tempestserpent",
    ability: "breath", swift: true, multistrike: 2, // 嵐のブレスを吐き、素早く幾度も噛む
    desc: "雷雲をのたうつ、稲妻の鱗をもつ蛇竜。嵐のブレスで全体を薙ぎ、雷の牙で素早く何度も噛みつく。雲間を縫う動きは、稲妻そのものだ。" },
  { id: "bs_harpyqueen", name: "嵐の鳥女王", rank: 10, race: "avian", element: "wind", artKey: "harpyqueen",
    ability: "paralyze", role: "summoner", summonKey: "bs_ravenswarm", swift: true, // 鳴き声で痺れさせ、眷属の鴉を呼ぶ
    desc: "尖塔を支配する、人面の鳥の女王。耳をつんざく鳴き声で獲物を痺れさせ、配下の鴉の群れを次々と呼び寄せる。その爪は、獲物を空へさらって落とすためにある。" },
  { id: "bs_lightninggolem", name: "雷光のゴーレム", rank: 9, race: "construct", element: "wind", artKey: "lightninggolem",
    physResist: 0.5, barrier: 2, ability: "paralyze", // 帯電した体。刃を阻み、触れた者を痺れさせる
    desc: "尖塔の避雷の仕組みが意思を得た、雷を溜め込んだ巨像。全身に電流を走らせ、触れた者を痺れさせる。帯電した装甲は刃を弾き、近づくだけで産毛が逆立つ。" },
  { id: "bs_zephyrfiend", name: "旋風の鬼", rank: 9, race: "demon", element: "wind", artKey: "zephyrfiend",
    multistrike: 2, swift: true, ability: "critical", // 旋風をまとう鬼。素早く回り込み、急所を連突する
    desc: "旋風をまとって宙を舞う、風の鬼。獲物の周りを目にも留まらぬ速さで回り込み、風の刃で急所を続けざまに突く。捉えようとすれば、もう背後に回っている。" },
  { id: "bs_stormhag", name: "嵐呼びの魔女", rank: 10, race: "specter", element: "wind", artKey: "stormhag", soulClass: "hexer",
    ability: "weaken", role: "summoner", summonKey: "bs_galewisp", magWeak: 1.3, // 呪詛で力を奪い、稲妻の群火を呼ぶ
    desc: "尖塔の上で嵐を操る、雷雲をまとった老魔女。呪いの言葉で生者の力を奪い、稲妻の群火を次々と呼び寄せる。嵐がこの国の空を重くしている、その元凶の一人だ。" },
  { id: "bs_thunderbeast", name: "雷牙の獣", rank: 9, race: "beast", element: "wind", artKey: "thunderbeast",
    swift: true, ability: "critical", enrage: true, // 雷光のごとく駆け、急所を一咬み、手負いで荒れる
    desc: "稲妻のように疾る、帯電した牙をもつ獣。雷光の速さで間合いを詰め、急所を一咬みで仕留める。傷を負えば全身から火花を散らして猛り、見境なく突進してくる。" },
  { id: "bs_galewisp", name: "稲妻の群火", rank: 9, race: "specter", element: "wind", artKey: "galewisp",
    pack: true, ability: "paralyze", evasive: true, magWeak: 1.4, // 稲妻の群体。痺れさせ、すり抜ける。魔に脆い
    desc: "尖塔に渦巻く、青白い稲妻の鬼火の群れ。獲物にまとわりついて痺れさせ、刃を向ければ火花となって散ってかわす。実体は薄く、魔の力にはひとたまりもない。" },
  { id: "bs_ravenswarm", name: "黒雲の鴉群", rank: 9, race: "avian", element: "wind", artKey: "ravenswarm",
    pack: true, multistrike: 2, swift: true, // 黒雲のごとき鴉の大群。素早く群れて啄む
    desc: "嵐の空を黒雲のように覆う、無数の鴉の群れ。一斉に舞い降りて素早く啄み、目をめがけて殺到する。一羽を払っても、空が黒く染まるほどの群れが続く。" },
  { id: "bs_skydrake", name: "蒼天の竜", rank: 10, race: "dragon", element: "wind", artKey: "skydrake",
    ability: "breath", physResist: 0.4, swift: true, // 蒼天を翔ける竜。風のブレスを吐き、鱗が刃を阻む
    desc: "尖塔のさらに上、蒼天を悠然と翔ける気高い竜。風を圧縮したブレスで全体を切り裂き、硬い鱗は刃を弾く。地を這う者を、空から見下している。" },
  { id: "bs_boltarcher", name: "雷弓の亡霊", rank: 9, race: "specter", element: "wind", artKey: "boltarcher",
    ability: "critical", swift: true, evasive: true, // 稲妻の矢で後衛の急所すら射抜く
    desc: "尖塔を守って射ち続けた弓兵の霊。稲妻を矢につがえ、隊列の奥に隠れた者の急所すら正確に射抜く。風に乗って位置を変え、捉えどころがない。" },
  { id: "bs_cyclonecore", name: "嵐核", rank: 9, race: "elemental", element: "wind", artKey: "cyclonecore",
    multistrike: 2, evasive: true, ability: "paralyze", // 渦の核。巻き込んで連打し、痺れさせ、掴めない
    desc: "巨大な竜巻の中心に光る、嵐の核。周囲のすべてを渦に巻き込んで何度も打ちつけ、帯電した風で痺れさせる。核に触れぬ限り、渦は決して止まらない。" },
  { id: "bs_soulanchor", name: "魂縛りの像", rank: 9, race: "construct", element: "dark", artKey: "soulanchor",
    ability: "drain", barrier: 2, physResist: 0.4, // 昇る魂を地に縛る像。命を引きずり下ろす
    desc: "天へ昇ろうとする魂を地に縛りつける、尖塔の核となる像。鎖のような腕で魂を引きずり下ろし、その命を吸って動き続ける。この国の空が重いのは、こいつらのせいだ。" },
  { id: "bs_galehound", name: "疾風の猟犬", rank: 9, race: "beast", element: "wind", artKey: "galehound",
    swift: true, pack: true, ability: "critical", // 風のごとく群れで駆け、急所を一咬み
    desc: "風をまとって尖塔の回廊を駆ける、痩せた猟犬の群れ。風の速さで取り囲み、急所めがけて一斉に噛みつく。足音は風に紛れ、姿を見た時にはもう囲まれている。" },
  { id: "bs_windscythe", name: "風の鎌鼬", rank: 9, race: "insect", element: "wind", artKey: "windscythe",
    swift: true, multistrike: 2, evasive: true, // 真空の刃で素早く幾度も斬り裂く
    desc: "風に乗って現れる、鎌のような前肢をもつ鼬めいた魔。真空の刃で目にも留まらぬ速さで斬りつけ、傷口は遅れて開く。風そのものを斬っているようで、刃が届かない。" },
  { id: "bs_stormcaller", name: "雷を呼ぶ司祭", rank: 10, race: "specter", element: "wind", artKey: "stormcaller", soulClass: "mage",
    role: "summoner", summonKey: "bs_stormelemental", ability: "paralyze", magWeak: 1.3, // 嵐の精を呼び、雷で痺れさせる
    desc: "尖塔の頂で嵐を呼ぶ儀式を続けた司祭の霊。雷雲の精を次々と呼び覚まし、稲妻で獲物を痺れさせる。この尖塔が嵐を孕み続けるのは、こいつの祈祷が止まないからだ。" },
  { id: "bs_stormlord", name: "嵐の尖塔の主", rank: 10, boss: true, race: "elemental", element: "wind", artKey: "stormlord", soulClass: "mage",
    role: "summoner", summonKey: "bs_stormelemental", ability: "breath", evasive: true, enrage: true, // 嵐の精を呼び、雷のブレスを吐き、すり抜ける
    desc: "嵐の尖塔そのものを支配する、雷雲が凝った嵐の主。配下の精を次々と呼び、全体を撃つ雷のブレスを落とす。昇ろうとする魂を絡め取って地に引き戻す、この国の業の歯車の一つだ。" },
  // -- 第11層「闘技場跡」 (rank 10・剣闘/無。enemyScaleで上昇) --
  { id: "bs_championwraith", name: "不滅の闘士", rank: 10, race: "armored", element: "none", artKey: "championwraith",
    ability: "critical", multistrike: 2, enrage: true,
    desc: "幾百の試合を勝ち抜き、死してなお闘いを求める不滅の闘士の霊。鎧ごと急所を貫く剣を続けざまに振るい、追い詰められるほど観客の幻聴に煽られて猛る。" },
  { id: "bs_netfighter", name: "網と銛の闘士", rank: 10, race: "humanoid", element: "none", artKey: "netfighter",
    ability: "paralyze", critical: undefined, multistrike: 2, swift: true,
    desc: "投網で獲物の動きを封じ、三叉の銛で仕留める剣闘士。絡め取られれば身動きが取れず、容赦なく銛が突き込まれる。素早い間合いの捌きで、決して網の外には出さない。" },
  { id: "bs_arenabeast", name: "闘獣", rank: 10, race: "beast", element: "none", artKey: "arenabeast",
    enrage: true, multistrike: 2, ability: "critical",
    desc: "見世物のために飢えと痛みで狂わされた、巨大な闘獣。鞭の傷だらけの体で見境なく暴れ、鉤爪で続けざまに急所を抉る。檻は、とうに壊れている。" },
  { id: "bs_spectreaudience", name: "亡き観客", rank: 10, race: "specter", element: "none", artKey: "spectreaudience",
    pack: true, ability: "drain", weaken: undefined,
    desc: "闘技場の観客席を埋め尽くす、興奮したまま死んだ亡霊の群れ。血を求める歓声で闘士の力を萎えさせ、流れる命の精気を遠くから吸い上げる。満員の歓声は、もう誰にも止められない。" },
  { id: "bs_chainedogre", name: "鎖の巨闘士", rank: 10, race: "giant", element: "none", artKey: "chainedogre",
    enrage: true, multistrike: 2, physResist: 0.4,
    desc: "鎖に繋がれ、闘技場の主役を張らされた巨大なオーガの闘士。引きちぎれぬ鎖に苛立ち、繋がれたまま拳を叩きつける。傷を負うほど鎖を鳴らして暴れ、分厚い筋肉が刃を阻む。" },
  { id: "bs_bladedancer", name: "双刃の舞い手", rank: 10, race: "humanoid", element: "none", artKey: "bladedancer",
    multistrike: 3, swift: true, ability: "critical",
    desc: "二刀を舞うように振るう、観客を魅了した花形の剣闘士。優雅な舞の合間に幾度も斬撃を織り込み、気づけば急所を断たれている。その美しさが、最後に見る景色だ。" },
  { id: "bs_executioner", name: "処刑人", rank: 10, race: "armored", element: "none", artKey: "executioner",
    ability: "critical", enrage: true, physResist: 0.4,
    desc: "敗者の首を刎ねる役を担い続けた、覆面の処刑人。巨大な斧の一振りは鎧ごと急所を断ち、返り血を浴びるほど振りが速くなる。慈悲という言葉を、こいつは知らない。" },
  { id: "bs_beastmaster", name: "猛獣使いの亡霊", rank: 10, race: "specter", element: "none", artKey: "beastmaster",
    role: "summoner", summonKey: "bs_arenabeast", ability: "weaken",
    desc: "闘獣を煽って観客を沸かせ続けた猛獣使いの霊。鞭の音で飢えた闘獣を次々と放ち、その威嚇で挑む者の戦意を削ぐ。自分は決して檻の中へは入らない。" },
  { id: "bs_mirrorduelist", name: "鏡写しの決闘者", rank: 10, race: "construct", element: "none", artKey: "mirrorduelist",
    multistrike: 2, barrier: 2, ability: "critical",
    desc: "挑戦者の動きを鏡のように写して戦う、磨かれた鋼の決闘人形。こちらの剣筋をそっくり返し、急所を同じだけ突いてくる。己の太刀筋こそが、最大の弱点となる。" },
  { id: "bs_crowdroar", name: "歓声の渦", rank: 10, race: "specter", element: "none", artKey: "crowdroar",
    pack: true, ability: "warcry", evasive: true,
    desc: "闘技場に渦巻く、無数の歓声が形をなした霊体。その大歓声は味方の闘士を奮い立たせ、押し寄せる声の波は掴みどころがない。耳を塞いでも、声は骨の中で響く。" },
  { id: "bs_sandlurker", name: "砂中の顎", rank: 10, race: "beast", element: "none", artKey: "sandlurker",
    ability: "critical", lifesteal: 0.3, physResist: 0.4,
    desc: "闘技場の砂の下に潜み、闘士の足を狙う大顎の魔。砂煙とともに飛び出して急所を一噛みし、喰らった命で身を肥やす。砂に守られた体は、刃をろくに通さない。" },
  { id: "bs_gladiatorlich", name: "闘技場の死霊術師", rank: 10, race: "undead", element: "none", artKey: "gladiatorlich", soulClass: "necromancer",
    role: "summoner", summonKey: "bs_ghostgladiator", ability: "drain", magWeak: 1.3,
    desc: "敗者の魂を蒐集し、闘技場の地下で操る死霊術師の骸。倒れた剣闘士を亡霊として次々と立たせ、生者の命を吸って術を保つ。観客のいない試合を、永遠に興行し続ける。" },
  { id: "bs_spikedgolem", name: "鉄刺の像", rank: 10, race: "construct", element: "none", artKey: "spikedgolem",
    physResist: 0.6, barrier: 2, multistrike: 2,
    desc: "全身に刃を生やした、闘技場の仕掛けが意思を得た鉄の像。触れるだけで裂かれ、突進すれば幾本もの刺が獲物を貫く。分厚い鉄の体は、並の刃を寄せつけない。" },
  { id: "bs_hookmaster", name: "鉤縄の使い手", rank: 10, race: "humanoid", element: "none", artKey: "hookmaster",
    ability: "paralyze", multistrike: 2, swift: true,
    desc: "鉤のついた縄を操り、間合いの外から獲物を絡め取る剣闘士。引き寄せて動きを止め、素早く幾度も斬りつける。逃げようにも、鉤が肉に食い込んで離さない。" },
  { id: "bs_bloodpriest", name: "血の司祭", rank: 10, race: "specter", element: "none", artKey: "bloodpriest", soulClass: "hexer",
    ability: "drain", lifesteal: 0.3, magWeak: 1.3,
    desc: "闘技場に捧げられた血を糧に、邪神を崇めた司祭の霊。流れる命を吸って力とし、生者の精気をすするほど赤く輝く。試合の血は、すべてこの霊への供物だった。" },
  { id: "bs_warbeasthound", name: "闘犬", rank: 10, race: "beast", element: "none", artKey: "warbeasthound",
    swift: true, pack: true, ability: "critical",
    desc: "闘技の余興のために飼われ、互いに殺し合わされた闘犬の群れ。素早く取り囲んで急所に喰らいつき、群れで一斉に襲いかかる。鎖を解かれた今、止める者はいない。" },
  { id: "bs_championofash", name: "灰の覇者", rank: 10, race: "armored", element: "none", artKey: "championofash",
    ability: "critical", enrage: true, physResist: 0.4,
    desc: "幾度も頂点に立ち、灰になってなお王座を譲らぬ伝説の覇者。風格ある一撃は鎧ごと急所を断ち、傷つくほど往年の闘志を燃え上がらせる。挑む者すべてを、灰の山に加えてきた。" },
  { id: "bs_impaler", name: "串刺しの槍士", rank: 10, race: "humanoid", element: "none", artKey: "impaler",
    ability: "critical", multistrike: 2,
    desc: "長槍で間合いの外から獲物を貫く、冷酷な剣闘士。後衛に隠れた者まで槍の間合いに捉え、急所を続けざまに突き刺す。近づく前に、もう貫かれている。" },
  { id: "bs_ghostgladiator", name: "亡霊剣闘士", rank: 10, race: "specter", element: "none", artKey: "ghostgladiator",
    multistrike: 2, ability: "critical", evasive: true,
    desc: "砂の下に幾重にも埋もれた、名もなき剣闘士たちの霊。生前の太刀筋のまま幾度も斬りかかり、刃を向ければ陽炎のように揺らいでかわす。誰に勝てば解放されるのかも、もう分からない。" },
  { id: "bs_chaingang", name: "鎖の囚徒", rank: 10, race: "undead", element: "none", artKey: "chaingang",
    pack: true, enrage: true, multistrike: 2,
    desc: "鎖で数珠つなぎにされ、闘技場へ送られて朽ちた囚人たちの群れ。互いを引きずりながら殺到し、千切れた鎖を振り回して打ち据える。一人倒れても、鎖が次の者を立たせる。" },
  { id: "bs_arenalord", name: "闘技場の支配者", rank: 10, boss: true, race: "armored", element: "none", artKey: "arenalord", soulClass: "fighter",
    role: "summoner", summonKey: "bs_arenabeast", ability: "critical", enrage: true, physResist: 0.5,
    desc: "魂繰り同士を戦わせ、敗者の魂を観客に振る舞った闘技場の興行主。今も砂の中心に立ち、闘獣を放っては挑む者を見世物にする。王家の余興に選ばれただけの剣闘士たちの、恨みの中心に座す者だ。" },
  // -- 第12層「地底大空洞」 (rank 10・土/洞窟。世界の根) --
  { id: "bs_cavebehemoth", name: "大空洞の巨獣", rank: 10, race: "beast", element: "earth", artKey: "cavebehemoth",
    enrage: true, multistrike: 2, physResist: 0.5, desc: "灯りも届かぬ大空洞を徘徊する、山のような巨獣。岩を砕く前肢で続けざまに薙ぎ払い、傷を負えば洞窟を揺らして暴れる。分厚い岩のような皮は刃を通さない。" },
  { id: "bs_crystaldrake", name: "水晶竜", rank: 10, race: "dragon", element: "earth", artKey: "crystaldrake",
    ability: "breath", physResist: 0.5, magResist: 0.5, desc: "鉱脈の水晶を喰らって育った、結晶の鱗をもつ竜。砕けた水晶の礫を全体に吐き、その鎧は刃も魔もろくに通さない。動くたび、体内の宝石が涼やかに鳴る。" },
  { id: "bs_blindhorror", name: "盲いた深淵獣", rank: 10, race: "beast", element: "earth", artKey: "blindhorror",
    ability: "critical", lifesteal: 0.3, swift: true, desc: "光なき闇で目を退化させ、音と熱だけで獲物を追う痩せた獣。気配を断って忍び寄り、急所を一噛みで仕留めては喰らう。暗闇では、こいつの独壇場だ。" },
  { id: "bs_rocktitan", name: "岩の巨人", rank: 10, race: "giant", element: "earth", artKey: "rocktitan",
    physResist: 0.6, barrier: 2, multistrike: 2, desc: "大空洞の岩盤そのものが立ち上がった巨人。岩塊の拳で続けざまに叩きつけ、分厚い岩の身は刃をことごとく弾く。歩むたびに、天井から礫が降り落ちる。" },
  { id: "bs_deepworm", name: "地底の大蟲", rank: 10, race: "insect", element: "earth", artKey: "deepworm",
    multistrike: 3, physResist: 0.4, lifesteal: 0.3, desc: "岩盤を喰らって地底を進む、果てしなく長い大蟲。円い顎で獲物を削り取り、喰らった分だけ肥える。地鳴りが聞こえたなら、もう足元まで来ている。" },
  { id: "bs_glowspore", name: "光胞子の群れ", rank: 10, race: "plant", element: "earth", artKey: "glowspore",
    pack: true, ability: "poison", paralyze: undefined, desc: "暗闇に青白く光る、毒の胞子をまとった菌の群生。光に誘われた者へ一斉に胞子を吹きかけ、痺れと毒で蝕む。美しい燐光は、獲物をおびき寄せる罠だ。" },
  { id: "bs_stalactiteghost", name: "鍾乳の霊", rank: 10, race: "specter", element: "earth", artKey: "stalactiteghost",
    ability: "paralyze", evasive: true, magWeak: 1.3, desc: "鍾乳石に染み込んだ、永い年月をかけて凝った霊。天井から滴り落ちて獲物を痺れさせ、刃を向ければ石の中へ染み込んで消える。滴る水音が、こいつの足音だ。" },
  { id: "bs_obsidianbeast", name: "黒曜の獣", rank: 10, race: "beast", element: "earth", artKey: "obsidianbeast",
    physResist: 0.5, ability: "critical", swift: true, desc: "黒曜石の体をもつ、鋭く硬質な大空洞の獣。鏡のような体は刃を弾き、研ぎ澄まされた爪が急所を一閃で断つ。素早く闇に溶け込み、月のない夜のように見えない。" },
  { id: "bs_cavetroll", name: "洞窟のトロール", rank: 10, race: "giant", element: "earth", artKey: "cavetroll",
    regen: 0.1, multistrike: 2, enrage: true, desc: "大空洞の苔と岩を喰らって生きる、巨大なトロール。裂いた傷もみるみる塞がり、丸太のような腕で続けざまに殴りつける。倒すには、再生を上回る火力で押し切るしかない。" },
  { id: "bs_echowraith", name: "反響の霊", rank: 10, race: "specter", element: "earth", artKey: "echowraith",
    ability: "weaken", evasive: true, magWeak: 1.3, desc: "大空洞に響く木霊が、無数に重なって形をなした霊。あちこちから響く声で生者の気力を削ぎ、本体がどこにあるのか掴ませない。斬りつけた手応えすら、反響して返ってくる。" },
  { id: "bs_crystalspider", name: "晶蟲の大蜘蛛", rank: 10, race: "insect", element: "earth", artKey: "crystalspider",
    multistrike: 2, physResist: 0.5, magResist: 0.5, desc: "水晶の脚と甲殻をもつ、鉱脈に巣くう大蜘蛛。硬い結晶の脚で素早く幾度も突き刺し、刃も魔もその甲殻に弾かれる。張り巡らせた水晶の糸が、洞窟を罠に変える。" },
  { id: "bs_caveguardian", name: "大空洞の守護像", rank: 10, race: "construct", element: "earth", artKey: "caveguardian",
    physResist: 0.6, magResist: 0.5, barrier: 2, desc: "大空洞の最奥への道を守る、水晶を埋め込まれた巨大な石像。刃も魔も阻む頑強な体で、眠れる『何か』への道を塞ぐ。誰が、何を守らせているのかは分からない。" },
  { id: "bs_fossildragon", name: "化石竜", rank: 10, race: "dragon", element: "earth", artKey: "fossildragon",
    ability: "breath", physResist: 0.5, enrage: true, desc: "岩に取り込まれて化石となり、なお動く太古の竜。石化した骨の体は刃を弾き、化石の口から砕けた岩の息を吐く。世界の根に眠る、最も古い時代の生き残りだ。" },
  { id: "bs_cavefisher", name: "洞天井の漁り手", rank: 10, race: "aquatic", element: "earth", artKey: "cavefisher",
    ability: "paralyze", lifesteal: 0.3, evasive: true, desc: "洞窟の天井に張りつき、粘る糸を垂らして獲物を釣る蟲めいた魔。糸に触れた者を痺れさせて吊り上げ、宙吊りのまま精気を吸う。見上げた時には、もう糸が首にかかっている。" },
  { id: "bs_abysshorror", name: "深淵の異形", rank: 10, race: "specter", element: "earth", artKey: "abysshorror",
    ability: "drain", physResist: 0.4, critical: undefined, desc: "大空洞のさらに底、光の概念すらない深淵から這い上がった異形。見ただけで正気を削る姿で、生者の命を吸い上げる。眠れる根の寝息に引き寄せられて、底から昇ってきた。" },
  { id: "bs_earthshaker", name: "地揺らす巨躯", rank: 10, race: "giant", element: "earth", artKey: "earthshaker",
    multistrike: 2, enrage: true, physResist: 0.5, desc: "歩むだけで大空洞を揺るがす、岩塊を背負った巨躯の魔。地を踏み鳴らして全体を揺さぶり、岩の拳で続けざまに打ち据える。その地響きは、眠れる根まで届くという。" },
  { id: "bs_mawofthedeep", name: "深淵の顎", rank: 10, race: "amorph", element: "earth", artKey: "mawofthedeep",
    ability: "critical", lifesteal: 0.3, physResist: 0.4, desc: "大空洞の床に口を開く、底なしの顎をもつ魔。近づいた者を一息に呑み込み、急所ごと噛み砕いて喰らう。地面と見分けがつかず、踏んだ時にはもう遅い。" },
  { id: "bs_primalbeast", name: "原初の獣", rank: 10, race: "beast", element: "earth", artKey: "primalbeast",
    enrage: true, ability: "critical", multistrike: 2, desc: "世界がまだ若かった頃から大空洞に潜む、進化を忘れた原初の獣。本能のままに急所を狙って連撃し、傷つけば太古の獰猛さで猛り狂う。眠れる根の、最初の守り手の一つだ。" },
  { id: "bs_gloomstalker", name: "闇這いの蟲", rank: 10, race: "insect", element: "earth", artKey: "gloomstalker",
    swift: true, evasive: true, ability: "poison", desc: "闇に溶ける黒い甲殻をもつ、素早く這い回る大蟲。気配を断って忍び寄り、毒の牙で刺しては闇へ消える。光を当てても、すぐに岩の隙間へ滑り込んで見失う。" },
  { id: "bs_cavernlord", name: "大空洞の主", rank: 10, boss: true, race: "giant", element: "earth", artKey: "cavernlord", soulClass: "fighter",
    role: "summoner", summonKey: "bs_cavebehemoth", ability: "breath", enrage: true, physResist: 0.6,
    desc: "大空洞の最奥、眠れる『根』のすぐ手前に座す巨大な守護者。岩を喰らう巨獣を次々と呼び、砕けた岩の息で道を塞ぐ。鎖に繋がれて眠るものを、決して目覚めさせまいとしている――いや、目覚めを待っているのかもしれない。" },
  // -- 第13層「魔導書庫」 (rank 10・闇/魔導。魂繰りの術の源) --
  { id: "bs_grimoirebeast", name: "蠢く魔導書", rank: 10, race: "construct", element: "dark", artKey: "grimoirebeast",
    multistrike: 2, magResist: 0.5, barrier: 2, desc: "自ら頁をめくり、書かれた術を放つ巨大な魔導書。紙の刃を続けざまに飛ばし、魔力は表紙に弾かれる。読み解こうとした者を、片端から己の頁に綴じ込んでいく。" },
  { id: "bs_inkhorror", name: "墨の異形", rank: 10, race: "amorph", element: "dark", artKey: "inkhorror",
    ability: "poison", physResist: 0.5, lifesteal: 0.3, desc: "こぼれた魔導の墨が意思を得て這い回る異形。触れたものを文字ごと溶かして喰らい、刃を突き立てても墨に沈んで効かない。喰らった知識の分だけ、黒く濃くなる。" },
  { id: "bs_spellwraith", name: "呪文の亡霊", rank: 10, race: "specter", element: "dark", artKey: "spellwraith",
    ability: "drain", magResist: 0.5, paralyze: undefined, desc: "唱えられぬまま忘れられた呪文が、霊となって書庫を漂う。生者の魔力と命を吸って自らを保ち、向けられた魔法を呪文ごと打ち消す。意味を失った詠唱を、永遠に呟き続ける。" },
  { id: "bs_runegolem", name: "ルーンの守護者", rank: 10, race: "construct", element: "dark", artKey: "runegolem",
    magResist: 0.6, barrier: 2, physResist: 0.4, desc: "禁書を守るために刻まれた、ルーンの光を放つ石の守護者。刻印が刃も魔も阻み、書庫の奥へ通すまいと立ちはだかる。ルーンを一つずつ消さねば、決して崩れない。" },
  { id: "bs_papermimic", name: "擬書", rank: 10, race: "construct", element: "dark", artKey: "papermimic",
    ability: "critical", barrier: 2, desc: "ただの本のふりをして棚に紛れ、手に取った者に襲いかかる擬態の魔。紙とは思えぬ鋭さで頁の縁が急所を裂く。書庫のどの一冊が擬書なのか、開くまで分からない。" },
  { id: "bs_eyetome", name: "眼の魔導書", rank: 10, race: "specter", element: "dark", artKey: "eyetome",
    ability: "paralyze", lifesteal: 0.3, evasive: true, desc: "頁という頁に瞳が描かれ、すべてが一斉に見開く呪われた書。その視線を浴びた者は石のように動けなくなり、見られるほど命を吸われる。閉じても、表紙の眼が見ている。" },
  { id: "bs_forbiddenspirit", name: "禁書の精", rank: 10, race: "elemental", element: "dark", artKey: "forbiddenspirit",
    multistrike: 2, magResist: 0.5, ability: "paralyze", desc: "封印された禁書から漏れ出した、剥き出しの魔力の精。触れれば麻痺し、暴走する術が続けざまに弾ける。封を解いた者の手で、最初に祟る。" },
  { id: "bs_bookworm", name: "知識喰らいの蟲", rank: 10, race: "insect", element: "dark", artKey: "bookworm",
    multistrike: 2, lifesteal: 0.3, swift: true, desc: "魔導書の知識を喰らって異常に育った、無数の本の蟲。素早く頁を食い破って術を盗み、近づく者の記憶ごと齧り取る。一冊喰らうたび、新たな術を一つ覚える。" },
  { id: "bs_arcanesentinel", name: "書庫の番兵", rank: 10, race: "construct", element: "dark", artKey: "arcanesentinel",
    ability: "critical", magResist: 0.5, barrier: 2, desc: "禁書の間を巡回する、魔力で動く鋼の番兵。光の刃で侵入者の急所を断ち、刻まれた術式が魔法を弾く。書庫の静寂を破る者を、一人も逃さない。" },
  { id: "bs_cursescroll", name: "呪いの巻物", rank: 10, race: "specter", element: "dark", artKey: "cursescroll",
    ability: "weaken", evasive: true, magResist: 0.5, desc: "読み上げれば災いを呼ぶ、宙に漂う呪いの巻物。広げた文面から呪詛を浴びせて力を奪い、丸まって刃をかわす。燃やそうにも、呪いが手に移って離れない。" },
  { id: "bs_wordwraith", name: "言霊の霊", rank: 10, race: "specter", element: "dark", artKey: "wordwraith",
    ability: "drain", magResist: 0.5, evasive: true, desc: "書き記された言葉そのものが霊と化したもの。発せられた言霊が生者の力と命を削り、文字となって揺らめき刃をすり抜ける。聞いてはならぬ真名を、囁き続けている。" },
  { id: "bs_inkdragon", name: "墨竜", rank: 10, race: "dragon", element: "dark", artKey: "inkdragon",
    ability: "breath", magResist: 0.5, multistrike: 2, desc: "こぼれた墨が幾百年を経て竜の形を得たもの。墨のブレスで全体を黒く塗り潰し、その身に魔法は吸われて消える。書庫の最も古い棚の影から、音もなく現れる。" },
  { id: "bs_familiarswarm", name: "使い魔の群れ", rank: 10, race: "demon", element: "dark", artKey: "familiarswarm",
    pack: true, ability: "critical", swift: true, desc: "主を失い、書庫に取り残された無数の使い魔の群れ。素早く飛び回って急所を突き、群れで一斉に襲いかかる。かつての契約者を探して、永遠に書庫を彷徨っている。" },
  { id: "bs_mindeater", name: "知識を貪る者", rank: 10, race: "specter", element: "dark", artKey: "mindeater",
    ability: "drain", magResist: 0.5, lifesteal: 0.3, desc: "禁断の知識を求めるあまり、頭から脳ごと知識を貪る化け物に堕ちた学者の霊。記憶と魔力を吸い上げ、奪うほどに肥大した頭が脈打つ。知りすぎることの、成れの果てだ。" },
  { id: "bs_glyphhound", name: "呪印の番犬", rank: 10, race: "beast", element: "dark", artKey: "glyphhound",
    swift: true, pack: true, magResist: 0.5, desc: "呪印を全身に刻まれ、書庫を守る番犬に作り変えられた獣の群れ。素早く取り囲んで噛みつき、刻印が魔法を弾く。侵入者の魔力の匂いを、決して見失わない。" },
  { id: "bs_tomeguardian", name: "禁書の巨像", rank: 10, race: "construct", element: "dark", artKey: "tomeguardian",
    physResist: 0.5, magResist: 0.5, barrier: 2, desc: "最も危険な禁書を抱え込んだまま固まった、本でできた巨像。刃も魔も分厚い頁の鎧に阻まれ、抱えた禁書には誰も触れられない。守っているのか、囚われているのか分からない。" },
  { id: "bs_astralwraith", name: "星辰の霊", rank: 10, race: "specter", element: "dark", artKey: "astralwraith",
    magResist: 0.5, multistrike: 2, evasive: true, desc: "天文の禁書に封じられた、星の運行を司る霊。星屑の刃で幾度も斬りつけ、星明かりのように掴みどころがない。その身には、見てはならぬ天の理が書き込まれている。" },
  { id: "bs_archivist", name: "大書庫の主", rank: 10, boss: true, race: "undead", element: "dark", artKey: "archivist", soulClass: "sage",
    role: "summoner", summonKey: "bs_grimoirebeast", ability: "drain", magResist: 0.5, physResist: 0.4,
    desc: "魂繰りの術のすべてを記し、最初の手記を守り続ける大書庫の主。蠢く魔導書を次々と呼び、生者の命と知識を吸い上げる。最初の魂繰りがなぜ救い手から檻の番人に堕ちたか――その答えを、誰にも読ませまいとしている。" },
  // -- 第14層「屍蝋の回廊」 (rank 10・闇/王家の廟。朽ちぬ亡骸) --
  { id: "bs_wickmummy", name: "屍蝋の王", rank: 10, race: "undead", element: "dark", artKey: "wickmummy",
    ability: "drain", critical: undefined, physResist: 0.4, enrage: true, desc: "魂を抜かれて腐ることすら許されず、蝋のように固まった歴代の王。乾いた手で生者の命を吸い、王冠の重みのまま立ち上がる。朽ちぬことは、安らぎではなく罰だ。" },
  { id: "bs_embalmer", name: "防腐処理の番人", rank: 10, race: "specter", element: "dark", artKey: "embalmer",
    ability: "drain", regen: 0.08, physResist: 0.4, desc: "王の亡骸を腐らせぬよう、永遠に処置を続ける防腐師の霊。生者をも『標本』にしようと命を抜き取り、自らの崩れた体も薬で繕う。完璧な保存だけが、こいつの執念だ。" },
  { id: "bs_graveroyalguard", name: "不朽の近衛", rank: 10, race: "armored", element: "dark", artKey: "graveroyalguard",
    ability: "critical", barrier: 2, physResist: 0.4, desc: "王の死後も廟を守り続ける、屍蝋と化した近衛兵。錆びぬ槍で急所を貫き、王家の紋章を刻んだ鎧が刃を阻む。守るべき王は、とうに空の棺の中だ。" },
  { id: "bs_waxhorror", name: "蝋の塊", rank: 10, race: "amorph", element: "dark", artKey: "waxhorror",
    ability: "paralyze", physResist: 0.5, multistrike: 2, desc: "防腐の蝋がこぼれ溜まり、無数の顔を浮かべて蠢く塊。触れた者を蝋で固めて痺れさせ、幾つもの腕で打ち据える。塗り込められた顔は、皆この廟に眠る者たちだ。" },
  { id: "bs_mournfulchancellor", name: "先代の宰相", rank: 10, race: "specter", element: "dark", artKey: "mournfulchancellor",
    ability: "weaken", role: "summoner", summonKey: "bs_corpsewax", magResist: 0.4, desc: "歴代の王に仕え、その秘密を抱えて廟に葬られた宰相の霊。呪詛で挑む者の力を奪い、眠れる屍蝋人を呼び起こす。『陛下、それ以上は』と、今も誰かを諫め続けている。" },
  { id: "bs_candlewraith", name: "蝋燭の霊", rank: 10, race: "specter", element: "dark", artKey: "candlewraith",
    ability: "drain", magWeak: 1.3, evasive: true, desc: "廟を照らし続ける弔いの蝋燭に宿った霊。近づく者の命を芯にして燃え、その炎は揺らめいて刃をかわす。蝋燭が尽きぬ限り、王の眠りは照らされ続ける。" },
  { id: "bs_preservedbeast", name: "剥製の獣", rank: 10, race: "beast", element: "dark", artKey: "preservedbeast",
    ability: "critical", multistrike: 2, physResist: 0.4, desc: "王の狩りの戦利品として剥製にされ、なお動き出した獣。乾いた爪で急所を続けざまに抉り、防腐された皮は刃を通しにくい。ガラスの目の奥に、まだ怒りが宿っている。" },
  { id: "bs_tombpriest", name: "埋葬司祭", rank: 10, race: "undead", element: "dark", artKey: "tombpriest",
    ability: "drain", regen: 0.08, magResist: 0.4, desc: "歴代の王を弔い続け、自らも廟に取り込まれた司祭の骸。葬送の祈りで生者の命を奪い、その祈祷が自らの崩れを繕う。誰の葬儀も、まだ終わっていないと信じている。" },
  { id: "bs_sarcophagusguard", name: "石棺の守り手", rank: 10, race: "construct", element: "dark", artKey: "sarcophagusguard",
    ability: "critical", physResist: 0.5, barrier: 2, desc: "王の石棺そのものが守護者となって動き出した像。重い蓋の縁で急所を断ち、黄金の装飾が刃を弾く。中の王を守るためか、出さぬためか――蓋は固く閉ざされている。" },
  { id: "bs_wailingnoble", name: "嘆く先王", rank: 10, race: "specter", element: "dark", artKey: "wailingnoble",
    ability: "weaken", magWeak: 1.3, evasive: true, desc: "若さを保ったまま氷ではなくこの廟へ移された、先代の王の霊。嘆きの声で生者の気力を萎えさせ、未練のままに彷徨う。『余は、まだ終われぬ』と、空の棺を見つめている。" },
  { id: "bs_coffincrawler", name: "棺這いの蟲", rank: 10, race: "insect", element: "dark", artKey: "coffincrawler",
    ability: "critical", multistrike: 2, lifesteal: 0.3, swift: true, desc: "棺の中の亡骸を喰らって肥えた、無数の脚をもつ蟲。素早く棺から這い出て急所に喰らいつき、喰らうほどに肥大する。王の眠りを、内側から食い荒らしている。" },
  { id: "bs_mummylord", name: "ミイラの将", rank: 10, race: "armored", element: "dark", artKey: "mummylord",
    ability: "critical", enrage: true, physResist: 0.5, desc: "王に殉じて自ら包帯を巻き、屍蝋となった将軍。黄金の戦装束で急所を貫き、傷を負うほど主への忠義で猛る。死してなお、ただ一人の王を守り続けている。" },
  { id: "bs_deathmask", name: "死面", rank: 10, race: "construct", element: "dark", artKey: "deathmask",
    ability: "paralyze", evasive: true, barrier: 2, desc: "歴代の王の死に顔を象った、宙を漂う黄金の仮面の群れ。覗き込んだ者を石のように固まらせ、ひらりと翻って刃をかわす。仮面の数だけ、ここに眠る王がいる。" },
  { id: "bs_corpsewax", name: "屍蝋人", rank: 10, race: "undead", element: "dark", artKey: "corpsewax",
    ability: "paralyze", pack: true, regen: 0.06, desc: "腐ることを許されず、蝋のように固まった廟の住人たちの群れ。冷たい手で掴んで痺れさせ、崩しても溶けた蝋から固まり直す。皆かつて、王に仕えた者たちだ。" },
  { id: "bs_funeralwraith", name: "葬列の霊", rank: 10, race: "specter", element: "dark", artKey: "funeralwraith",
    ability: "weaken", pack: true, magResist: 0.4, desc: "終わらぬ王の葬列を、列をなして練り歩く弔問客の霊。すれ違う者の気力を奪い、群れで静かに取り囲む。誰の葬列なのかは、参列者自身も忘れている。" },
  { id: "bs_boneprince", name: "白骨の王子", rank: 10, race: "undead", element: "dark", artKey: "boneprince",
    ability: "critical", multistrike: 2, role: "summoner", summonKey: "bs_corpsewax", desc: "王位を継ぐ前に廟へ入れられた、王子の白骨。細身の剣で急所を続けざまに突き、廟の従者を呼び従える。継げなかった王冠を、今も骨の頭に載せている。" },
  { id: "bs_crypthound", name: "墓守の番犬", rank: 10, race: "beast", element: "dark", artKey: "crypthound",
    ability: "critical", swift: true, pack: true, desc: "王の廟を守るために殉葬された、黄金の首輪の番犬の群れ。素早く取り囲んで急所に喰らいつき、侵入者を一人も通さない。主の亡骸の匂いだけを、永遠に守り続ける。" },
  { id: "bs_shroudkeeper", name: "経帷子の守人", rank: 10, race: "specter", element: "dark", artKey: "shroudkeeper",
    ability: "paralyze", lifesteal: 0.3, evasive: true, desc: "王に被せる経帷子を抱え、廟を巡る守人の霊。垂れた布で生者を絡めて痺れさせ、その温もりを吸う。新たに包む亡骸を、いつも探している。" },
  { id: "bs_cryptking", name: "屍蝋の回廊の主", rank: 10, boss: true, race: "undead", element: "dark", artKey: "cryptking", soulClass: "hexer",
    role: "summoner", summonKey: "bs_graveroyalguard", ability: "drain", physResist: 0.5, enrage: true,
    desc: "屍蝋の回廊を統べる、朽ちることを許されぬ最も古い王。近衛を呼び従え、生者の命と若さを吸い上げる。回廊の奥の空の棺は、今の王のために用意されたもの――その日まで、こいつは玉座を空けて待っている。" },
  // -- 第15層「溶鉄炉」 (rank 10・火/鋳造。器を鋳る工房) --
  { id: "bs_moltensmith", name: "溶鉄の鍛冶", rank: 10, race: "construct", element: "fire", artKey: "moltensmith",
    ability: "critical", multistrike: 2, physResist: 0.4, desc: "灼けた鎚を振るい続ける、溶鉄でできた鍛冶の自動人形。鎚の一打は鎧ごと急所を砕き、続けざまに打ち下ろす。今も誰かの『器』を鍛えようと、生者を炉へ運ぼうとする。" },
  { id: "bs_forgegolem", name: "鋳造のゴーレム", rank: 10, race: "construct", element: "fire", artKey: "forgegolem",
    physResist: 0.6, barrier: 2, enrage: true, desc: "鋳型に溶鉄を流し込む工程そのものが意思を得た巨像。腹に炉を抱え、傷を負えば溶鉄を噴いて荒れる。分厚い鋳鉄の体は、並の刃を寄せつけない。" },
  { id: "bs_slagbeast", name: "鉱滓の獣", rank: 10, race: "beast", element: "fire", artKey: "slagbeast",
    ability: "critical", physResist: 0.5, enrage: true, desc: "炉から掻き出された鉱滓が、獣の形に凝って動き出したもの。灼けた爪で急所を抉り、冷えて固まった滓の皮が刃を阻む。砕けば中から溶岩がしたたる。" },
  { id: "bs_anvilhorror", name: "金床の魔", rank: 10, race: "construct", element: "fire", artKey: "anvilhorror",
    ability: "paralyze", multistrike: 2, physResist: 0.5, barrier: 2, desc: "幾千の器を打たれ続けた金床に宿った魔。重い鉄塊の体で獲物を押し潰し、打ち鳴らす衝撃で痺れさせる。叩かれた数だけ、こいつは硬くなった。" },
  { id: "bs_soulingot", name: "魂の鋳塊", rank: 10, race: "elemental", element: "fire", artKey: "soulingot",
    ability: "drain", lifesteal: 0.3, physResist: 0.4, desc: "巡りへ還せぬ穢れた魂を鋳固めた、脈打つ灼熱の塊。中に閉じ込められた無数の魂が、外の命を求めて吸い寄せる。これがやがて、人業の核となる――器の、最初の姿だ。" },
  { id: "bs_moltenwraith", name: "溶けた霊", rank: 10, race: "specter", element: "fire", artKey: "moltenwraith",
    ability: "drain", magWeak: 1.3, evasive: true, desc: "炉に落ちて溶け、それでも消えきれなかった者の霊。灼けた手で生者の命を吸い、揺らめく陽炎となって刃をかわす。水気のない身は、皮肉にも炎の魔法でこそ崩れる。" },
  { id: "bs_forgehound", name: "炉の番犬", rank: 10, race: "beast", element: "fire", artKey: "forgehound",
    ability: "critical", swift: true, pack: true, desc: "炉の火を守るために鋳られた、灼熱の鉄の番犬の群れ。素早く取り囲んで急所に喰らいつき、その牙は赤熱している。火種を奪う者を、決して逃さない。" },
  { id: "bs_ironmaiden", name: "鉄の処女", rank: 10, race: "construct", element: "fire", artKey: "ironmaiden",
    ability: "critical", barrier: 2, physResist: 0.4, desc: "内に刃を並べた、人型の拷問器具が動き出したもの。抱きしめるように獲物を捉え、内側の棘で急所を貫く。閉じた扉の中には、まだ前の獲物が残っている。" },
  { id: "bs_bellowsfiend", name: "鞴の鬼", rank: 10, race: "demon", element: "fire", artKey: "bellowsfiend",
    ability: "breath", enrage: true, multistrike: 2, desc: "炉に風を送り続ける鞴に棲みついた、炎を吐く鬼。大きく息を吸っては全体を焼く炎を吹き、傷つけば炉ごと火勢を増して荒れる。こいつが吹けば、炉は一段と燃え盛る。" },
  { id: "bs_quenchserpent", name: "焼き入れの大蛇", rank: 10, race: "reptile", element: "fire", artKey: "quenchserpent",
    ability: "breath", swift: true, multistrike: 2, desc: "焼き入れの油槽に潜む、灼けた鱗の大蛇。熱した刃のような牙で素早く幾度も噛みつき、蒸気のブレスで全体を焼く。油の中を、影のように泳ぐ。" },
  { id: "bs_smithghost", name: "鍛冶師の亡霊", rank: 10, race: "specter", element: "fire", artKey: "smithghost",
    role: "summoner", summonKey: "bs_soulingot", ability: "weaken", magResist: 0.4, desc: "器を鋳ることに生涯を捧げ、炉の前で力尽きた鍛冶師の霊。魂の鋳塊を次々と打ち出し、呪詛で挑む者の力を奪う。自分が何を作っていたのか、もう問うこともない。" },
  { id: "bs_moltencore", name: "溶鉱の核", rank: 10, race: "elemental", element: "fire", artKey: "moltencore",
    multistrike: 2, enrage: true, physResist: 0.4, desc: "炉の中心で煮えたぎる、剥き出しの溶鉱の核。触れるものすべてを灼き、爆ぜるように熱の塊を撃ち出す。これが冷えれば、炉は止まる――が、誰も冷やせない。" },
  { id: "bs_dollhusk", name: "器の抜け殻", rank: 10, race: "construct", element: "fire", artKey: "dollhusk",
    ability: "drain", enrage: true, lifesteal: 0.3, desc: "魂を入れられる前に弾かれた、空っぽの人業の抜け殻。失った魂を求めて起き上がり、生者の温もりに掴みかかる。縫い目の顔は、まだ誰のものでもない。" },
  { id: "bs_flamehammer", name: "炎槌の番人", rank: 10, race: "armored", element: "fire", artKey: "flamehammer",
    ability: "critical", multistrike: 2, physResist: 0.4, desc: "炉を守る、灼けた大槌を担いだ鎧の番人。振り下ろす炎の槌は鎧ごと急所を砕き、続けざまに叩きつける。火の粉を撒く一撃は、岩をも鍛え直す。" },
  { id: "bs_cruciblehorror", name: "るつぼの異形", rank: 10, race: "amorph", element: "fire", artKey: "cruciblehorror",
    ability: "poison", physResist: 0.5, regen: 0.08, desc: "るつぼの底で混ざり合った、あらゆる金属と魂の毒の塊。触れたものを溶かし込み、刃を突き立てても溶湯に沈んで効かない。中で煮える顔は、鋳潰された者たちだ。" },
  { id: "bs_sparkswarm", name: "火花の群れ", rank: 10, race: "insect", element: "fire", artKey: "sparkswarm",
    pack: true, multistrike: 2, swift: true, desc: "炉から飛び散る火花が、意思を得て群れ飛ぶもの。素早くまとわりついて何度も焼き刺し、払っても次の火花が湧く。鍛冶の音とともに、無数に弾ける。" },
  { id: "bs_forgewyrm", name: "炉の竜", rank: 10, race: "dragon", element: "fire", artKey: "forgewyrm",
    ability: "breath", physResist: 0.5, enrage: true, desc: "溶鉄を喰らって育った、鋳鉄の鱗をもつ竜。溶けた金属のブレスで全体を焼き固め、鋳鉄の鱗は刃を弾く。炉の火が消えぬ限り、こいつも眠らない。" },
  { id: "bs_moltenknight", name: "溶鉄の騎士", rank: 10, race: "armored", element: "fire", artKey: "moltenknight",
    ability: "critical", barrier: 2, enrage: true, desc: "溶けた鎧をまとったまま炉を守る騎士。灼けた剣で急所を貫き、流れる溶鉄が刃を逸らす。傷を負えば鎧の継ぎ目から火を噴いて猛る。" },
  { id: "bs_cindergeist", name: "燃え滓の番", rank: 10, race: "specter", element: "fire", artKey: "cindergeist",
    ability: "drain", evasive: true, magWeak: 1.3, desc: "炉の灰の中で燻り続ける、焼け死んだ職人の霊。近づく者の命を熾火にして燃え、火の粉となって刃をかわす。掃き出された灰の中から、また赤く灯る。" },
  { id: "bs_emberfly", name: "火屑の羽虫", rank: 10, race: "insect", element: "fire", artKey: "emberfly",
    pack: true, swift: true, multistrike: 2, desc: "炉の熱気に湧いた、火屑のように赤熱した羽虫の群れ。素早く飛び回って獲物を焼き刺し、群れごと炎の渦をなす。鍛冶の煤の中で、無数に舞っている。" },
  { id: "bs_forgemaster", name: "溶鉄炉の主", rank: 10, boss: true, race: "construct", element: "fire", artKey: "forgemaster", soulClass: "fighter",
    role: "summoner", summonKey: "bs_forgegolem", ability: "breath", physResist: 0.6, enrage: true,
    desc: "穢れた魂を鋳て『器』を作り続ける、溶鉄炉そのものの主。鋳造のゴーレムを次々と生み出し、全体を焼く溶鉄のブレスを吐く。人業がどう作られるかを知った今、こいつの炉の音は、もう以前と同じには聞こえない。" },
  // -- 第16層「深淵の聖堂」 (rank 10・光/偽りの光) --
  { id: "bs_falseseraph", name: "偽りの熾天使", rank: 10, race: "specter", element: "light", artKey: "falseseraph",
    ability: "drain", barrier: 2, magResist: 0.4, desc: "聖堂の祭壇に祀られた、光を騙る堕ちた熾天使。慈悲を装って近づき、捧げられた魂ごと命を吸う。後光は本物だが、その光は他者を焼くためのものだ。" },
  { id: "bs_inquisitor", name: "異端審問官", rank: 10, race: "armored", element: "light", artKey: "inquisitor",
    ability: "critical", enrage: true, physResist: 0.4, desc: "光の名のもとに数えきれぬ魂を火刑に処した、審問官の亡霊。聖印を刻んだ刃で異端者の急所を貫き、断罪の興奮で猛る。こいつにとって、生者はみな裁くべき罪人だ。" },
  { id: "bs_censerfiend", name: "香炉の鬼", rank: 10, race: "demon", element: "light", artKey: "censerfiend",
    ability: "breath", enrage: true, desc: "聖香を焚き続けた香炉から生まれた、聖なる炎をまとう鬼。振り撒く香煙は全体を清めの炎で焼き、傷つけば香炉を振り回して荒れる。その煙を吸えば、魂ごと浄化されて消える。" },
  { id: "bs_lightidol", name: "光の偶像", rank: 10, race: "construct", element: "light", artKey: "lightidol",
    ability: "critical", magResist: 0.5, barrier: 2, desc: "信仰を集めるために据えられた、黄金の光を放つ偶像。崇める者を光の刃で貫き、その身は刃も魔も弾く。捧げられた祈りの分だけ、こいつは強く輝く。" },
  { id: "bs_choirofthelost", name: "失われた聖歌隊", rank: 10, race: "specter", element: "light", artKey: "choirofthelost",
    ability: "paralyze", pack: true, magResist: 0.4, desc: "聖堂で焼かれた者たちが、なお賛美歌を歌わされ続ける霊の群れ。荘厳な歌声を浴びた者は身が痺れて動けなくなる。歌うことをやめれば、自分が燃やされた記憶が蘇るからだ。" },
  { id: "bs_flagellant", name: "鞭打ち苦行者", rank: 10, race: "humanoid", element: "light", artKey: "flagellant",
    ability: "critical", enrage: true, lifesteal: 0.3, desc: "己を鞭打ち、その血を聖油として捧げ続けた苦行者の亡霊。鋭い鉤の鞭で急所を裂き、流れる血を糧に傷を癒す。痛みこそが信仰だと、永遠に己を打ち続ける。" },
  { id: "bs_radiantwraith", name: "眩き霊", rank: 10, race: "specter", element: "light", artKey: "radiantwraith",
    ability: "paralyze", evasive: true, lifesteal: 0.3, desc: "聖堂の眩い光に溶け込んだ、輪郭を失った霊。直視できぬ光で獲物の目を眩ませて痺れさせ、光となって刃をすり抜ける。美しい後光が、近づく者を惑わせる。" },
  { id: "bs_crusaderghost", name: "亡き聖騎士", rank: 10, race: "armored", element: "light", artKey: "crusaderghost",
    ability: "critical", barrier: 2, multistrike: 2, desc: "聖戦で果て、聖堂に祀られた聖騎士の亡霊。聖別された剣で急所を続けざまに貫き、聖印の盾が刃を阻む。守るべき信仰が偽りだったとは、まだ知らない。" },
  { id: "bs_saintbeast", name: "聖獣", rank: 10, race: "beast", element: "light", artKey: "saintbeast",
    ability: "critical", swift: true, enrage: true, desc: "聖なる獣として崇められ、祭壇で飼われた光をまとう獣。素早く間合いを詰めて急所を抉り、傷つけば神聖な怒りで猛る。崇拝の鎖は、とうに引きちぎれている。" },
  { id: "bs_blindingorb", name: "眩光の球", rank: 10, race: "elemental", element: "light", artKey: "blindingorb",
    ability: "paralyze", multistrike: 2, evasive: true, desc: "聖堂の天蓋に浮かぶ、見る者の目を焼く眩い光の球。光の矢を続けざまに撃ち、放たれる閃光が獲物を痺れさせる。直視すれば、視界が白く塗り潰される。" },
  { id: "bs_martyrwraith", name: "殉教の霊", rank: 10, race: "specter", element: "light", artKey: "martyrwraith",
    ability: "drain", lifesteal: 0.3, regen: 0.06, desc: "信仰のために自ら火に身を投じた殉教者の霊。捧げた命の渇きで生者の命を吸い、奪うほどに崩れた体を繕う。救われると信じて焼かれたが、何も救われはしなかった。" },
  { id: "bs_holygolem", name: "聖鎧の巨像", rank: 10, race: "construct", element: "light", artKey: "holygolem",
    magResist: 0.5, physResist: 0.5, barrier: 2, desc: "聖別された黄金の鎧を幾重にも重ねた、聖堂を守る巨像。刃も魔も分厚い聖鎧に阻まれ、聖印が攻撃を弾く。中身は空――信仰だけが、これを動かしている。" },
  { id: "bs_confessor", name: "告解の聴き手", rank: 10, race: "specter", element: "light", artKey: "confessor",
    ability: "weaken", magResist: 0.4, evasive: true, desc: "罪の告解を永遠に聴き続け、その重みに潰れた聴罪司祭の霊。囁きで生者の罪悪感を煽って力を奪い、影のように掴みどころがない。告げた罪は、二度と赦されない。" },
  { id: "bs_lightlance", name: "光槍の番兵", rank: 10, race: "armored", element: "light", artKey: "lightlance",
    ability: "critical", multistrike: 2, physResist: 0.4, desc: "聖堂の門を守る、光の槍を構えた番兵の亡霊。間合いの外から後衛の急所すら貫き、続けざまに突き込む。光の穂先は、どんな盾も貫くと信じられている。" },
  { id: "bs_wingedjudge", name: "裁きの翼", rank: 10, race: "specter", element: "light", artKey: "wingedjudge",
    ability: "critical", barrier: 2, evasive: true, desc: "罪を裁く権能を与えられた、翼ある裁定者の霊。光の刃で罪人と見なした者の急所を断ち、聖なる翼が刃を逸らす。誰が罪人かは、こいつの気まぐれで決まる。" },
  { id: "bs_pyreofsouls", name: "魂の火刑", rank: 10, race: "elemental", element: "light", artKey: "pyreofsouls",
    ability: "breath", enrage: true, lifesteal: 0.3, desc: "聖堂の地下で魂を焼き続ける、消えぬ火刑の炎の集合体。捧げられた魂を全体を焼く清めの炎として吐き、燃やすほどに勢いを増す。この炎が、回収された魂の行き着く先の一つだ。" },
  { id: "bs_cathedralguard", name: "聖堂の守護者", rank: 10, race: "construct", element: "light", artKey: "cathedralguard",
    physResist: 0.5, magResist: 0.5, barrier: 2, multistrike: 2, desc: "聖堂の最奥を守る、聖印を刻まれた巨大な守護像。刃も魔も阻む頑強な体で、偽りの光の秘密へ続く道を塞ぐ。守っているのは信仰か、それとも罪の証拠か。" },
  { id: "bs_hymncaster", name: "賛美歌の司祭", rank: 10, race: "specter", element: "light", artKey: "hymncaster",
    role: "summoner", summonKey: "bs_choirofthelost", ability: "weaken", magResist: 0.4, desc: "終わらぬ賛美歌の指揮を執り続ける司祭の霊。焼かれた聖歌隊を次々と呼び覚まし、呪詛のごとき祈祷で挑む者の力を奪う。その歌は、悲鳴を覆い隠すために大きくなった。" },
  { id: "bs_lightmoth", name: "光に集う蛾", rank: 10, race: "insect", element: "light", artKey: "lightmoth",
    ability: "paralyze", pack: true, swift: true, desc: "聖堂の偽りの光に引き寄せられ、群がる黄金の蛾。鱗粉を撒いて獲物を痺れさせ、光を求めて素早く乱舞する。光に焼かれてもなお、次の蛾が集まってくる。" },
  { id: "bs_highpontiff", name: "深淵の聖堂の主", rank: 10, boss: true, race: "specter", element: "light", artKey: "highpontiff", soulClass: "cardinal",
    role: "summoner", summonKey: "bs_falseseraph", ability: "drain", magResist: 0.5, enrage: true,
    desc: "偽りの光の名のもとに、数えきれぬ魂を聖堂で焼き続けた大司教の霊。堕ちた熾天使を従え、捧げられた魂ごと生者の命を吸い上げる。光も闇も魂を喰らうことに変わりはない――ただ、光のほうが言い訳が美しいだけだ。" },
  // -- 第17層「凍てつく王墓」 (rank 10・水/氷の王墓。若さの代償) --
  { id: "bs_frozenking", name: "氷漬けの王", rank: 10, race: "undead", element: "water", artKey: "frozenking",
    ability: "drain", physResist: 0.4, enrage: true, desc: "若さを保てなくなり、氷の下へ移された歴代の王。氷漬けのまま玉座を求めて起き上がり、生者の命と若さを吸い上げる。買えなくなった若さの、最後の請求書だ。" },
  { id: "bs_iceroyalguard", name: "氷結の近衛", rank: 10, race: "armored", element: "water", artKey: "iceroyalguard",
    ability: "critical", barrier: 2, physResist: 0.4, desc: "王とともに氷の下へ葬られた、凍れる近衛兵。霜の槍で急所を貫き、氷の鎧が刃を阻む。守るべき王はもう氷の中だが、任を解かれていない。" },
  { id: "bs_frostmonarchwraith", name: "凍れる先王の霊", rank: 10, race: "specter", element: "water", artKey: "frostmonarchwraith",
    ability: "weaken", magResist: 0.4, desc: "氷の王墓に眠る、歴代の先王たちの霊。凍てつく嘆きで生者の力を奪い、若く美しい顔のまま彷徨う。皆、天寿を全うできなかった者たちだ。" },
  { id: "bs_youththief", name: "若さを奪う者", rank: 10, race: "specter", element: "water", artKey: "youththief",
    ability: "drain", lifesteal: 0.3, enrage: true, desc: "王に若さを供給し続けた、忌まわしき仕組みの化身。生者の若さと命を吸い取り、奪うほどに自らも若返る。王の不老の代償が、この姿だ。" },
  { id: "bs_glacialtomb", name: "氷棺の番", rank: 10, race: "construct", element: "water", artKey: "glacialtomb",
    ability: "paralyze", physResist: 0.5, barrier: 2, desc: "王を納めた氷の棺そのものが守護者となったもの。冷気で近づく者を凍りつかせ、分厚い氷が刃を阻む。蓋を開ければ、中の王が氷の下で目を開けている。" },
  { id: "bs_frostnoble", name: "氷の貴人", rank: 10, race: "undead", element: "water", artKey: "frostnoble",
    ability: "paralyze", magResist: 0.4, lifesteal: 0.3, desc: "王に従って氷の下へ供奉された、凍れる貴族たち。優雅な所作のまま冷気で獲物を痺れさせ、その温もりを吸う。死してなお、序列を守って整列している。" },
  { id: "bs_icebreaker", name: "氷砕きの巨人", rank: 10, race: "giant", element: "water", artKey: "icebreaker",
    multistrike: 2, enrage: true, physResist: 0.5, desc: "王墓を封じる氷を割り、また閉ざすために据えられた巨人。氷塊の拳で続けざまに打ち砕き、傷つけば雪崩のように荒れる。封印を保つ者か、破る者か。" },
  { id: "bs_frozenchancellor", name: "凍れる宰相", rank: 10, race: "specter", element: "water", artKey: "frozenchancellor",
    ability: "weaken", role: "summoner", summonKey: "bs_frostservant", magResist: 0.4, desc: "王の若さの秘密を抱え、氷の下へ口を封じられた宰相の霊。呪詛で挑む者を弱らせ、凍れる従者を呼び寄せる。『陛下、それ以上は』と、氷の中で諫め続けている。" },
  { id: "bs_frostlynx", name: "霜の山猫", rank: 10, race: "beast", element: "water", artKey: "frostlynx",
    ability: "critical", swift: true, evasive: true, desc: "王墓の番として放たれた、霜をまとう白い山猫。音もなく雪を踏んで急所を一撃で抉り、白い体は雪に紛れて見えない。気配を感じた時には、もう喉元にいる。" },
  { id: "bs_crystalcoffin", name: "水晶棺の魔", rank: 10, race: "construct", element: "water", artKey: "crystalcoffin",
    ability: "critical", barrier: 2, physResist: 0.4, desc: "王の亡骸を透かして見せる、水晶でできた棺の魔。鋭い水晶の縁で急所を断ち、その身は刃を弾く。中に横たわる王は、いつ目覚めてもおかしくない。" },
  { id: "bs_soulfrostwraith", name: "魂凍りの霊", rank: 10, race: "specter", element: "water", artKey: "soulfrostwraith",
    ability: "drain", magWeak: 1.3, evasive: true, desc: "若さの代償として凍りつかせられた、魂そのものの霊。生者の命を吸って一瞬熱を取り戻し、吹雪となって刃をすり抜ける。凍えた魂は、炎の魔法に脆い。" },
  { id: "bs_permafrostgolem", name: "凍土の番兵", rank: 10, race: "construct", element: "water", artKey: "permafrostgolem",
    physResist: 0.5, magResist: 0.5, barrier: 2, desc: "永久凍土を固めて作られた、王墓の最奥を守る番兵。刃も魔も凍った体に阻まれ、若さの仕組みへ続く道を塞ぐ。溶けることなく、永遠に立ち続ける。" },
  { id: "bs_frozenpriest", name: "氷結の司祭", rank: 10, race: "undead", element: "water", artKey: "frozenpriest",
    ability: "drain", regen: 0.08, magResist: 0.4, desc: "王の埋葬と若返りの儀を司り、自らも凍りついた司祭の骸。凍えた祈りで生者の命を奪い、その力で崩れを繕う。儀式はまだ、終わっていないと信じている。" },
  { id: "bs_iciclewyrm", name: "氷柱の竜", rank: 10, race: "dragon", element: "water", artKey: "iciclewyrm",
    ability: "breath", physResist: 0.5, multistrike: 2, desc: "王墓の天井から垂れる氷柱が、竜の形を得たもの。凍てつくブレスで全体を凍らせ、氷の鱗が刃を弾く。落ちかかる氷柱は、幾本もの牙となって襲う。" },
  { id: "bs_mournfulqueen", name: "嘆きの氷の女王", rank: 10, race: "specter", element: "water", artKey: "mournfulqueen",
    ability: "weaken", role: "summoner", summonKey: "bs_frostservant", magResist: 0.4, desc: "若き王に嫁ぎ、夫より先に氷の下へ移された女王の霊。哀切な嘆きで生者の気力を奪い、凍れる侍女を呼び寄せる。失われた愛も若さも、氷の中で凍りついたままだ。" },
  { id: "bs_coldrevenant", name: "凍える怨霊", rank: 10, race: "specter", element: "water", artKey: "coldrevenant",
    ability: "critical", enrage: true, lifesteal: 0.3, desc: "若さを奪われた恨みを抱いて凍りついた怨霊。氷の爪で急所を抉り、傷つくほど凍てつく怒りで猛る。温もりを奪うことでしか、己の凍えを忘れられない。" },
  { id: "bs_snowhydra", name: "雪の多頭", rank: 10, race: "reptile", element: "water", artKey: "snowhydra",
    ability: "breath", multistrike: 2, regen: 0.08, desc: "凍った泉から幾つもの首をもたげる、雪白の多頭の魔。それぞれの口から吹雪を吐き、続けざまに噛みつく。一つ首を凍らせ落としても、また新たな首が生える。" },
  { id: "bs_glacialhound", name: "氷の番犬", rank: 10, race: "beast", element: "water", artKey: "glacialhound",
    ability: "critical", swift: true, pack: true, desc: "王墓に殉葬された、氷の牙をもつ番犬の群れ。素早く取り囲んで急所に喰らいつき、その吐息は獲物を凍てつかせる。主の眠りを守って、永遠に氷の回廊を巡る。" },
  { id: "bs_frostsentinel", name: "凍れる門番", rank: 10, race: "construct", element: "water", artKey: "frostsentinel",
    ability: "critical", magResist: 0.4, barrier: 2, desc: "王墓の門に氷漬けのまま立つ、巨大な門番の像。氷の大剣で急所を断ち、凍った鎧が刃も魔も阻む。門を越えようとする者を、千年も拒み続けている。" },
  { id: "bs_frostservant", name: "氷の従者", rank: 10, race: "undead", element: "water", artKey: "frostservant",
    ability: "paralyze", pack: true, physResist: 0.4, desc: "王に仕えたまま氷の下へ供奉された、凍れる従者たちの群れ。冷たい手で掴んで痺れさせ、群れで主君の眠りを守る。命じられた務めを、死してなお果たし続けている。" },
  { id: "bs_frostmonarch", name: "凍てつく王墓の主", rank: 10, boss: true, race: "undead", element: "water", artKey: "frostmonarch", soulClass: "hexer",
    role: "summoner", summonKey: "bs_iceroyalguard", ability: "drain", physResist: 0.5, enrage: true,
    desc: "氷の玉座に座す、最も古く最も若い顔をした王の亡骸。近衛を呼び従え、生者の若さと命を貪る。若さは魂で買うもの――買えなくなった王はこうして氷へ移され、次の王が立つ。今の王も、いずれここへ来る。" },
  // -- 第18層「冥府の門」 (rank 10・闇/冥府への門) --
  { id: "bs_gatekeeper", name: "門の番人", rank: 10, race: "construct", element: "dark", artKey: "gatekeeper",
    ability: "critical", physResist: 0.5, barrier: 2, desc: "半開きの冥府の門を守り続ける、巨大な門番の像。冥火の刃で急所を断ち、その身は刃も魔も阻む。門の向こうへ通すことも、こちらへ来させることも、決して許さない。" },
  { id: "bs_ferryman", name: "冥河の渡し守", rank: 10, race: "specter", element: "dark", artKey: "ferryman",
    ability: "drain", magResist: 0.4, evasive: true, desc: "門の向こうの冥河で、死者を運び続ける渡し守の霊。櫂で生者の命を奪って渡し賃とし、霧のように掴みどころがない。運ばれた者は、二度と戻らない。" },
  { id: "bs_wailingdead", name: "還せと叫ぶ亡者", rank: 10, race: "undead", element: "dark", artKey: "wailingdead",
    ability: "drain", pack: true, enrage: true, desc: "門の向こうへ送られ、『還せ』と叫び続ける亡者の群れ。生者に縋りついて命を吸い、押し返されるほど狂ったように暴れる。皆、生きたまま門をくぐらされた者たちだ。" },
  { id: "bs_cerberusshade", name: "冥門の犬", rank: 10, race: "beast", element: "dark", artKey: "cerberusshade",
    ability: "critical", multistrike: 2, swift: true, desc: "三つの首で門の左右を睨む、冥府の番犬の影。三つの口で続けざまに急所へ喰らいつき、素早く回り込む。一つの首を黙らせても、残る二つが吠え続ける。" },
  { id: "bs_soulchain", name: "魂縛りの鎖", rank: 10, race: "construct", element: "dark", artKey: "soulchain",
    ability: "paralyze", barrier: 2, physResist: 0.4, desc: "門をくぐる魂を縛り、引き留める呪いの鎖。絡みついて獲物を痺れさせ、断とうにも刃を弾く。この鎖が、門を半開きのまま保っている。" },
  { id: "bs_doorwraith", name: "門前の霊", rank: 10, race: "specter", element: "dark", artKey: "doorwraith",
    ability: "drain", evasive: true, lifesteal: 0.3, desc: "門をくぐれず、くぐられもせず、門前で彷徨い続ける霊。近づく者の命を吸って一瞬実体を得て、刃を向ければ門の隙間へ消える。行くも還るも許されぬ、宙吊りの魂だ。" },
  { id: "bs_underjudge", name: "冥府の判官", rank: 10, race: "armored", element: "dark", artKey: "underjudge",
    ability: "critical", enrage: true, physResist: 0.4, desc: "門の向こうで死者の罪を裁く、冥府の判官の影。冥火の刃で罪人の急所を断ち、裁きの興奮で猛る。生者すらも、裁くべき罪人として門へ引きずり込もうとする。" },
  { id: "bs_lostbrother", name: "送られた弟", rank: 10, race: "undead", element: "dark", artKey: "lostbrother",
    ability: "drain", enrage: true, lifesteal: 0.3, desc: "百年前、王の祖父に生きたまま門の向こうへ送られた、実の弟の亡霊。裏切りの恨みで生者の命を吸い、王家の血を求めて荒れ狂う。『還せ』の声の、最初の主だ。" },
  { id: "bs_shadereaper", name: "魂を刈る影", rank: 10, race: "specter", element: "dark", artKey: "shadereaper",
    ability: "critical", swift: true, lifesteal: 0.3, desc: "門の前で迷う魂を刈り取る、大鎌を持つ影。素早く間合いを詰めて急所を一閃し、刈った命をおのれの糧とする。門へ向かう列から、はぐれた魂を狩る。" },
  { id: "bs_grievingspirit", name: "嘆きの群霊", rank: 10, race: "specter", element: "dark", artKey: "grievingspirit",
    ability: "weaken", pack: true, magResist: 0.4, desc: "門の前で別れを嘆き続ける、無数の死者の霊の群れ。重なる嘆きが生者の気力を奪い、群れで取り囲む。誰もが、まだ門の向こうへ行きたくないと泣いている。" },
  { id: "bs_boneferry", name: "骸の渡し舟", rank: 10, race: "construct", element: "dark", artKey: "boneferry",
    multistrike: 2, physResist: 0.5, barrier: 2, desc: "無数の骸を組み合わせて作られた、冥河を渡る舟の魔。骨の櫂で続けざまに打ち据え、組まれた骨の体は刃を阻む。乗せた魂を、二度と降ろさない。" },
  { id: "bs_hadeshound", name: "冥界の番犬", rank: 10, race: "beast", element: "dark", artKey: "hadeshound",
    ability: "critical", swift: true, pack: true, desc: "門の向こうから漏れ出した、冥界の番犬の群れ。素早く取り囲んで急所に喰らいつき、その牙は魂を引き裂く。獲物を門の向こうへ追い立てるのが、こいつらの務めだ。" },
  { id: "bs_voidpriest", name: "虚無の司祭", rank: 10, race: "specter", element: "dark", artKey: "voidpriest", soulClass: "necromancer",
    role: "summoner", summonKey: "bs_wailingdead", ability: "drain", magResist: 0.4, desc: "門の向こうの虚無を崇め、死者を呼び戻す術を編んだ司祭の霊。叫ぶ亡者を次々と呼び覚まし、生者の命を吸う。門を開いたままにしているのは、こいつの祈祷でもある。" },
  { id: "bs_chainwraith", name: "鎖の亡霊", rank: 10, race: "specter", element: "dark", artKey: "chainwraith",
    ability: "paralyze", lifesteal: 0.3, enrage: true, desc: "罪人として鎖に繋がれたまま門前で朽ちた者の霊。絡みつく鎖で獲物を痺れさせ、その温もりを吸う。引きちぎろうともがくほど、鎖は深く食い込む。" },
  { id: "bs_tormentor", name: "責め苦の鬼", rank: 10, race: "demon", element: "dark", artKey: "tormentor",
    ability: "critical", multistrike: 2, enrage: true, desc: "門の向こうで罪人を責め苛む、鉤と鞭を持つ冥府の鬼。鉤で急所を抉り、続けざまに打ち据える。生者をも罪人と見なし、永遠の責め苦へ引きずり込もうとする。" },
  { id: "bs_echoofvoice", name: "『還せ』の声", rank: 10, race: "elemental", element: "dark", artKey: "echoofvoice",
    ability: "weaken", magResist: 0.4, evasive: true, desc: "門の向こうから絶えず響く、『還せ』という声そのものが凝った魔。その声を聞いた者は気力を奪われ、声は実体なく刃をすり抜ける。門も、迷宮も、骸も、皆この同じ言葉を口にする。" },
  { id: "bs_gatewarden", name: "冥府の門の主", rank: 10, boss: true, race: "specter", element: "dark", artKey: "gatewarden", soulClass: "hexer",
    role: "summoner", summonKey: "bs_wailingdead", ability: "drain", physResist: 0.5, enrage: true,
    desc: "半開きの冥府の門を守り、向こうとこちらの境に座す門の主。叫ぶ亡者を次々と呼び、生者の命を貪る。百の迷宮は病巣ではなく傷口――魂の巡りをせき止めた、この国の業が開けた傷の、最も深い裂け目だ。" },
  // -- 第19層「竜の巣」 (rank 10・火/竜。最初の魂繰りの眷属) --
  { id: "bs_broodwyrm", name: "竜の仔", rank: 10, race: "dragon", element: "fire", artKey: "broodwyrm",
    ability: "breath", swift: true, multistrike: 2, desc: "竜の巣に孵った、まだ若く獰猛な仔竜。小さなブレスで全体を焼き、素早く幾度も噛みつく。群れで生まれ、巣を侵す者に一斉に襲いかかる。" },
  { id: "bs_dragonkin", name: "竜人", rank: 10, race: "reptile", element: "fire", artKey: "dragonkin",
    ability: "critical", enrage: true, physResist: 0.4, desc: "竜の血を引く、鱗に覆われた半人半竜の戦士。竜の爪で急所を抉り、傷つけば竜の怒りで猛る。最初の魂繰りに仕える、誇り高き竜の眷属だ。" },
  { id: "bs_eggguardian", name: "卵の守り手", rank: 10, race: "dragon", element: "fire", artKey: "eggguardian",
    physResist: 0.5, barrier: 2, enrage: true, desc: "竜の卵を抱いて守る、母性の化身のような竜。卵に近づく者を全力で阻み、その身を盾にする。傷つけられれば、卵を守るために狂ったように荒れ狂う。" },
  { id: "bs_wyvernlord", name: "飛竜の長", rank: 10, race: "dragon", element: "fire", artKey: "wyvernlord",
    ability: "breath", swift: true, multistrike: 2, desc: "竜の巣の空を支配する、飛竜たちの長。急降下のブレスで全体を薙ぎ、鉤爪で素早く何度も切り裂く。地を這う者を、空から狩る。" },
  { id: "bs_dragoncultist", name: "竜を崇める者", rank: 10, race: "humanoid", element: "fire", artKey: "dragoncultist",
    role: "summoner", summonKey: "bs_broodwyrm", ability: "critical", desc: "竜を神と崇め、巣に仕える狂信者。仔竜を呼び寄せて盾とし、竜の牙を模した短剣で急所を狙う。最初の魂繰りを『竜神』として、いまも祈り続けている。" },
  { id: "bs_scaledhorror", name: "鱗甲の異形", rank: 10, race: "reptile", element: "fire", artKey: "scaledhorror",
    ability: "critical", physResist: 0.5, multistrike: 2, desc: "竜の血を浴びて異形に変じた、鱗甲の怪物。重なった鱗が刃を弾き、鉤爪で続けざまに急所を抉る。竜になりそこねた、成れの果てだ。" },
  { id: "bs_emberdrake", name: "熾火竜", rank: 10, race: "dragon", element: "fire", artKey: "emberdrake",
    ability: "breath", enrage: true, physResist: 0.4, desc: "体内に熾火を絶やさぬ、赤く輝く竜。燃え盛るブレスで全体を焼き、傷つけば内なる火を燃え上がらせて猛る。冷めることを知らない炎の竜だ。" },
  { id: "bs_dragonbeast", name: "竜の眷属獣", rank: 10, race: "beast", element: "fire", artKey: "dragonbeast",
    ability: "critical", swift: true, enrage: true, desc: "竜の巣に飼われ、竜の気性を分け与えられた獣。素早く間合いを詰めて急所を抉り、傷つけば見境なく猛る。竜に従う、忠実な狩りの相棒だ。" },
  { id: "bs_wingedterror", name: "翼ある恐竜", rank: 10, race: "dragon", element: "fire", artKey: "wingedterror",
    ability: "critical", multistrike: 2, swift: true, desc: "大きな翼で巣の上空を旋回する、原始的な恐竜。急降下して鉤爪で急所を続けざまに抉り、すぐに舞い上がる。竜の眷属の中でも、特に狡猾な狩人だ。" },
  { id: "bs_salamanderking", name: "火蜥蜴の王", rank: 10, race: "reptile", element: "fire", artKey: "salamanderking",
    ability: "breath", regen: 0.08, physResist: 0.4, desc: "巣の溶岩溜まりに棲む、火蜥蜴たちの王。炎のブレスで全体を焼き、溶岩に浸かるたび傷を癒す。竜には及ばずとも、火の眷属を束ねる長だ。" },
  { id: "bs_dragonpriest", name: "竜神官", rank: 10, race: "specter", element: "fire", artKey: "dragonpriest", soulClass: "hexer",
    role: "summoner", summonKey: "bs_broodwyrm", ability: "drain", magResist: 0.4, desc: "竜神を崇める儀式を司り、巣で果てた神官の霊。仔竜を呼び覚まし、生者の命を竜への供物として吸い上げる。竜の正体を知ってなお、崇め続けている。" },
  { id: "bs_hoardgolem", name: "宝物の守護者", rank: 10, race: "construct", element: "fire", artKey: "hoardgolem",
    physResist: 0.5, barrier: 2, ability: "critical", desc: "竜が集めた宝の山が、黄金の巨像となって動き出したもの。宝を奪う者を黄金の拳で打ち砕き、その身は刃を弾く。竜の眠りの間、宝を守り続ける。" },
  { id: "bs_drakerider", name: "竜騎兵の亡霊", rank: 10, race: "armored", element: "fire", artKey: "drakerider",
    ability: "critical", multistrike: 2, physResist: 0.4, desc: "竜を駆って戦い、巣に骨を埋めた竜騎兵の亡霊。竜の牙の槍で急所を続けざまに貫き、竜鱗の鎧が刃を阻む。今も愛竜の背を求めて、巣を彷徨う。" },
  { id: "bs_ashdrake", name: "灰燼竜", rank: 10, race: "dragon", element: "fire", artKey: "ashdrake",
    ability: "breath", physResist: 0.5, enrage: true, desc: "焼き尽くした獲物の灰をまとう、燻んだ灰色の竜。灰のブレスで視界を奪って焼き、灰に覆われた鱗が刃を阻む。こいつが通った跡には、灰しか残らない。" },
  { id: "bs_brimstonewyrm", name: "硫煙の蛇竜", rank: 10, race: "dragon", element: "fire", artKey: "brimstonewyrm",
    ability: "breath", swift: true, multistrike: 2, desc: "巣の火口に潜む、硫黄の煙を吐く蛇竜。咳き込ませる硫煙のブレスを吐き、素早く幾度も噛みつく。その通り道は、毒の煙で霞んでいる。" },
  { id: "bs_dragonwhelp", name: "竜の幼体群", rank: 10, race: "dragon", element: "fire", artKey: "dragonwhelp",
    pack: true, ability: "critical", multistrike: 2, swift: true, desc: "孵ったばかりの竜の幼体が、群れをなして這い回る。小さくとも竜の牙は鋭く、群れで一斉に急所へ喰らいつく。巣の床は、こいつらで埋め尽くされている。" },
  { id: "bs_moltendrake", name: "溶岩竜", rank: 10, race: "dragon", element: "fire", artKey: "moltendrake",
    ability: "breath", physResist: 0.5, lifesteal: 0.3, desc: "溶けた岩を体内に滾らせる、巣の最も深部に棲む竜。溶岩のブレスで全体を焼き、焼いた命を糧として取り込む。冷えた外皮の下で、常に溶岩が脈打っている。" },
  { id: "bs_flameserpentkin", name: "炎蛇の眷属", rank: 10, race: "reptile", element: "fire", artKey: "flameserpentkin",
    ability: "critical", swift: true, multistrike: 2, desc: "竜の眷属として巣を守る、炎をまとう大蛇。素早く巻きついて急所を続けざまに噛み、灼けた鱗が触れた者を焼く。竜の足元を、滑るように這い回る。" },
  { id: "bs_drakehound", name: "竜の猟犬", rank: 10, race: "beast", element: "fire", artKey: "drakehound",
    ability: "critical", swift: true, pack: true, desc: "竜が狩りに使う、鱗に覆われた炎の猟犬の群れ。素早く取り囲んで急所に喰らいつき、その牙は赤熱している。巣を侵す者の匂いを、決して見失わない。" },
  { id: "bs_basilisk", name: "石化竜", rank: 10, race: "reptile", element: "fire", artKey: "basilisk",
    ability: "stone", physResist: 0.4, multistrike: 2, desc: "竜の巣に潜む、見た者を石に変える邪眼の竜。その視線を浴びれば全身が硬直し、続けざまの牙が石像ごと砕く。巣のあちこちに、石化した獲物が転がっている。" },
  { id: "bs_elderdragon", name: "竜の巣の主", rank: 10, boss: true, race: "dragon", element: "fire", artKey: "elderdragon", soulClass: "fighter",
    role: "summoner", summonKey: "bs_broodwyrm", ability: "breath", physResist: 0.6, enrage: true,
    desc: "竜の巣を統べ、最奥の玄室への道を守る古き大竜。仔竜を次々と呼び、すべてを焼き尽くす業炎のブレスを吐く。最初の魂繰りの眷属にして、その孤独な末路を最も近くで見てきた、最後の門番だ。" },
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
  19: "bs_elderdragon", // 第19層「竜の巣」: 竜の巣の主 (rank10・火ボス)
  18: "bs_gatewarden", // 第18層「冥府の門」: 冥府の門の主 (rank10・闇ボス)
  17: "bs_frostmonarch", // 第17層「凍てつく王墓」: 凍てつく王墓の主 (rank10・水ボス)
  16: "bs_highpontiff", // 第16層「深淵の聖堂」: 深淵の聖堂の主 (rank10・光ボス)
  15: "bs_forgemaster", // 第15層「溶鉄炉」: 溶鉄炉の主 (rank10・火ボス)
  14: "bs_cryptking", // 第14層「屍蝋の回廊」: 屍蝋の回廊の主 (rank10・闇ボス)
  13: "bs_archivist", // 第13層「魔導書庫」: 大書庫の主 (rank10・闇ボス)
  12: "bs_cavernlord", // 第12層「地底大空洞」: 大空洞の主 (rank10・土ボス)
  11: "bs_arenalord", // 第11層「闘技場跡」: 闘技場の支配者 (rank10・剣闘ボス)
  10: "bs_stormlord", // 第10層「嵐の尖塔」: 嵐の尖塔の主 (rank10・風ボス)
  9: "bs_swamplord", // 第9層「毒沼」: 澱みの主 (rank10・毒ボス)
  8: "bs_glaciallord", // 第8層「氷結回廊」: 氷結回廊の主 (rank9・氷ボス)
  7: "bs_infernolord", // 第7層「灼熱の洞」: 業火の主 (rank9・火/悪魔ボス)
  6: "bs_templelord", // 第6層「沈没神殿」: 沈める神官王 (rank8・水/神殿ボス)
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
  // 第6層「沈没神殿」: 水/神殿(神官霊・神像・水棲)中心、rank7-8主体 (第5層より格上)。深部に rank9
  6: [
    // 新規 (固有アート)
    "bs_drownedpriest", "bs_fonthorror", "bs_choirwraith", "bs_idolguardian",
    "bs_abyssjelly", "bs_tidecaller", "bs_kelpdrowned", "bs_sunkenbell",
    // 既存の水棲/神像/深淵を第6層へ再配置 (rank7-8)
    "bs_naga", "bs_goldgolem", "bs_soulharvester", "d04_grudge", "bs_shadowdragon",
    "bs_crystalgolem", "bs_irongolem", "bs_voidwalker", "bs_dreadlich",
    // 深部の強敵 (rank9): 神像・堕ちた光
    "bs_divinegolem", "bs_shadowseraph", "bs_fallenangel",
  ],
  // 第7層「灼熱の洞」: 火/溶岩中心、rank8-9主体 (第6層より格上)。深部に rank10
  7: [
    // 新規 (固有アート)
    "bs_lavagolem", "bs_magmaslime", "bs_sulfurfiend", "bs_cinderwraith", "bs_flamedrake",
    "bs_obsidianguard", "bs_lavamaw", "bs_ashghoul", "bs_emberswarm", "bs_pyrelich",
    "bs_brimstonegolem", "bs_furnacefiend", "bs_magmaray", "bs_basaltdrake",
    // 既存の火/悪魔/獄系を第7層へ再配置 (rank8-9)
    "bs_demon", "bs_hellhound", "bs_shadowogre", "bs_darkliege", "bs_infernaltyrant",
    // 深部の強敵 (rank10)
    "bs_doombringer",
  ],
  // 第8層「氷結回廊」: 氷/水中心、rank8-9主体 (第7層より格上)。火に弱い者が多い ※20種へ作成中
  8: [
    "bs_frostwyrm", "bs_icegolem", "bs_frozenexplorer", "bs_blizzardspirit", "bs_rimegiant",
    "bs_icewraith", "bs_frostwolf", "bs_rimecrawler", "bs_iciclehorror",
    // batch2 新規 (固有アート)
    "bs_frostknight", "bs_snowstalker", "bs_iceserpent", "bs_winterbat", "bs_glacialcrab",
    "bs_frostlich", "bs_snowmantis", "bs_frostmaiden", "bs_frozenangel", "bs_frostfiend", "bs_aurorawisp",
  ],
  // 第9層「毒沼」: 毒/腐敗中心、rank9-10。疫病系の闇undeadを再配置
  9: [
    "bs_plaguebeast", "bs_rotooze", "bs_swamphag", "bs_bogdrowned", "bs_venomspider",
    "bs_miasmawraith", "bs_corpseflower", "bs_plaguerat", "bs_toxicgolem", "bs_leechswarm",
    "bs_gasfiend", "bs_marshlurker", "bs_pestilenceknight", "bs_fungalcorpse", "bs_blightmoth",
    "bs_sludgehydra", "bs_discardeddoll",
    // 既存の疫病系を再配置
    "bs_plaguewraith", "bs_plaguelich", "bs_necromancer",
  ],
  // 第10層「嵐の尖塔」: 風/雷中心、rank9-10。全て新規
  10: [
    "bs_stormelemental", "bs_thunderroc", "bs_windwraith", "bs_galeknight", "bs_cloudgiant",
    "bs_tempestserpent", "bs_harpyqueen", "bs_lightninggolem", "bs_zephyrfiend", "bs_stormhag",
    "bs_thunderbeast", "bs_galewisp", "bs_ravenswarm", "bs_skydrake", "bs_boltarcher",
    "bs_cyclonecore", "bs_soulanchor", "bs_galehound", "bs_windscythe", "bs_stormcaller",
  ],
  // 第11層「闘技場跡」: 剣闘/無中心、全rank10。全て新規
  11: [
    "bs_championwraith", "bs_netfighter", "bs_arenabeast", "bs_spectreaudience", "bs_chainedogre",
    "bs_bladedancer", "bs_executioner", "bs_beastmaster", "bs_mirrorduelist", "bs_crowdroar",
    "bs_sandlurker", "bs_gladiatorlich", "bs_spikedgolem", "bs_hookmaster", "bs_bloodpriest",
    "bs_warbeasthound", "bs_championofash", "bs_impaler", "bs_ghostgladiator", "bs_chaingang",
  ],
  // 第12層「地底大空洞」: 土/洞窟中心、全rank10。原初の大蛇を再配置(世界の根)
  12: [
    "bs_cavebehemoth", "bs_crystaldrake", "bs_blindhorror", "bs_rocktitan", "bs_deepworm",
    "bs_glowspore", "bs_stalactiteghost", "bs_obsidianbeast", "bs_cavetroll", "bs_echowraith",
    "bs_crystalspider", "bs_caveguardian", "bs_fossildragon", "bs_cavefisher", "bs_abysshorror",
    "bs_earthshaker", "bs_mawofthedeep", "bs_primalbeast", "bs_gloomstalker",
    "bs_primalserpent",
  ],
  // 第13層「魔導書庫」: 闇/魔導中心、全rank10。闇系3体を再配置
  13: [
    "bs_grimoirebeast", "bs_inkhorror", "bs_spellwraith", "bs_runegolem", "bs_papermimic",
    "bs_eyetome", "bs_forbiddenspirit", "bs_bookworm", "bs_arcanesentinel", "bs_cursescroll",
    "bs_wordwraith", "bs_inkdragon", "bs_familiarswarm", "bs_mindeater", "bs_glyphhound",
    "bs_tomeguardian", "bs_astralwraith",
    // 既存の闇/魔導系を再配置
    "bs_elderlich", "bs_soulreaper", "bs_cosmicwraith",
  ],
  // 第14層「屍蝋の回廊」: 闇/王家の廟中心、全rank10。闇騎士2体を近衛として再配置
  14: [
    "bs_wickmummy", "bs_embalmer", "bs_graveroyalguard", "bs_waxhorror", "bs_mournfulchancellor",
    "bs_candlewraith", "bs_preservedbeast", "bs_tombpriest", "bs_sarcophagusguard", "bs_wailingnoble",
    "bs_coffincrawler", "bs_mummylord", "bs_deathmask", "bs_corpsewax", "bs_funeralwraith",
    "bs_boneprince", "bs_crypthound", "bs_shroudkeeper",
    // 既存の闇騎士を近衛として再配置
    "bs_doomknight", "bs_voidknight",
  ],
  // 第15層「溶鉄炉」: 火/鋳造中心、全rank10。全て新規
  15: [
    "bs_moltensmith", "bs_forgegolem", "bs_slagbeast", "bs_anvilhorror", "bs_soulingot",
    "bs_moltenwraith", "bs_forgehound", "bs_ironmaiden", "bs_bellowsfiend", "bs_quenchserpent",
    "bs_smithghost", "bs_moltencore", "bs_dollhusk", "bs_flamehammer", "bs_cruciblehorror",
    "bs_sparkswarm", "bs_forgewyrm", "bs_moltenknight", "bs_cindergeist", "bs_emberfly",
  ],
  // 第16層「深淵の聖堂」: 光/偽りの光中心、全rank10。終末の使徒を再配置
  16: [
    "bs_falseseraph", "bs_inquisitor", "bs_censerfiend", "bs_lightidol", "bs_choirofthelost",
    "bs_flagellant", "bs_radiantwraith", "bs_crusaderghost", "bs_saintbeast", "bs_blindingorb",
    "bs_martyrwraith", "bs_holygolem", "bs_confessor", "bs_lightlance", "bs_wingedjudge",
    "bs_pyreofsouls", "bs_cathedralguard", "bs_hymncaster", "bs_lightmoth",
    "bs_seraphwraith",
  ],
  // 第17層「凍てつく王墓」: 水/氷の王墓中心、全rank10。全て新規
  17: [
    "bs_frozenking", "bs_iceroyalguard", "bs_frostmonarchwraith", "bs_youththief", "bs_glacialtomb",
    "bs_frostnoble", "bs_icebreaker", "bs_frozenchancellor", "bs_frostlynx", "bs_crystalcoffin",
    "bs_soulfrostwraith", "bs_permafrostgolem", "bs_frozenpriest", "bs_iciclewyrm", "bs_mournfulqueen",
    "bs_coldrevenant", "bs_snowhydra", "bs_glacialhound", "bs_frostsentinel", "bs_frostservant",
  ],
  // 第18層「冥府の門」: 闇/冥府中心、全rank10。虚無/終末系4体を再配置
  18: [
    "bs_gatekeeper", "bs_ferryman", "bs_wailingdead", "bs_cerberusshade", "bs_soulchain",
    "bs_doorwraith", "bs_underjudge", "bs_lostbrother", "bs_shadereaper", "bs_grievingspirit",
    "bs_boneferry", "bs_hadeshound", "bs_voidpriest", "bs_chainwraith", "bs_tormentor",
    "bs_echoofvoice",
    // 既存の虚無/終末系を再配置
    "bs_apocalypsedrake", "bs_abysswarden", "bs_eternallord", "bs_chaosknight",
  ],
  // 第19層「竜の巣」: 火/竜中心、全rank10。全て新規
  19: [
    "bs_broodwyrm", "bs_dragonkin", "bs_eggguardian", "bs_wyvernlord", "bs_dragoncultist",
    "bs_scaledhorror", "bs_emberdrake", "bs_dragonbeast", "bs_wingedterror", "bs_salamanderking",
    "bs_dragonpriest", "bs_hoardgolem", "bs_drakerider", "bs_ashdrake", "bs_brimstonewyrm",
    "bs_dragonwhelp", "bs_moltendrake", "bs_flameserpentkin", "bs_drakehound",
    "bs_basilisk",
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
