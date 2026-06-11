// 頭・足カタログ (頭50種 + 足50種)。id は append-only (改名・削除禁止)。
// lv は隠しレベル (1-50)。lv帯ごとに満遍なく配置し、防御・価格・ランクは自動算出に任せる。
// eDef は六属性をほぼ均等に散らし、◎(Lv2) は深層帯 (lv28以上) のみ。呪い装備は全体で2点。
import { H, F } from "./defs.js";

export const HEADS = [
  // ---- lv1-5 ----
  H("h_gravedigger_hood", "墓掘りの頭巾", 1, { shape: "hat",
    desc: "夜露と墓土に湿った仕事着の頭巾。かぶると土の匂いが鼻をつくが、不思議と死者への恐れが薄らぐと墓掘り人たちは言う。" }),
  H("h_ratfang_cap", "鼠牙の革帽", 2, { shape: "hat", tint: "#8a6438", tintAmt: 0.25,
    desc: "下水に巣食う大鼠どもの革を張り合わせた帽子。縁に縫い止めた牙は仕留めた獲物の証で、鼠捕りたちのささやかな誇りだ。" }),
  H("h_watch_kettle_helm", "夜哨の鉄笠", 3, { cls: ["fighter", "knight", "priest"], tint: "#8a92a2", tintAmt: 0.2,
    desc: "城壁の夜番が雨と流れ矢を凌いだ鍔広の鉄笠。叩けば鈍い鐘の音がして、居眠りの番兵を幾度も死の淵から呼び戻したという。" }),
  H("h_confessor_hood", "懺悔聴きの頭巾", 4, { shape: "hat", mp: 2, cls: ["priest", "bishop"],
    desc: "罪人の最期の告白を聴く僧が顔を隠した深い頭巾。降り積もった懺悔を吸った布は重く、かぶる者の心を仄かな魔力で満たす。" }),
  H("h_boartusk_helm", "猪頭の骨兜", 4, { eDef: ["earth", 1], cls: ["fighter", "knight"],
    desc: "大猪の頭骨をくり抜いた蛮族の兜。眼窩越しの視界は狭いが、土を駆ける獣の加護が宿り、押し寄せる大水すら堰くという。" }),
  H("h_martyr_thorn_crown", "殉教者の茨冠", 5, { shape: "circlet", eDef: ["light", 1], mp: 2, cls: ["priest", "bishop"],
    desc: "火刑に処された聖者へ嘲りとしてかぶせられた茨の冠。棘はいつしか金色に乾き、闇の爪をやわらかく払う加護に変わった。" }),
  H("h_mourner_veil", "会葬者の面紗", 5, { shape: "hat", eDef: ["dark", 1], mp: 2,
    desc: "喪に服す貴婦人が顔を覆った黒の面紗。葬列を幾度も見送った布は宵闇に溶けて、まばゆい光の矢からそっと目を守る。" }),

  // ---- lv6-10 ----
  H("h_gaoler_visor", "牢番の面頬", 6, { cls: ["fighter", "knight"],
    desc: "地下牢の看守が囚人の爪から顔を守った鉄の面頬。覗き窓の奥の目が情を映さぬよう、内側には目隠しの布まで当ててある。" }),
  H("h_bog_leech_helm", "沼蛭の革兜", 7, { eDef: ["water", 1], cls: ["fighter", "knight", "thief"],
    desc: "底なし沼の主と呼ばれた大蛭の革を縫い合わせた兜。常にじっとりと湿り、燃え盛る炎の息すら触れる端から鎮めてしまう。" }),
  H("h_falconer_hood", "鷹匠の目隠し帽", 8, { shape: "hat", tint: "#8a6438", tintAmt: 0.22,
    desc: "猟鷹を鎮める目隠しを模した革の帽子。深くかぶれば雑念がそぎ落とされ、獲物の立てる微かな羽音だけが妙に近く聞こえる。" }),
  H("h_cantor_circlet", "詠唱者の銀環", 9, { shape: "circlet", mp: 3, cls: ["mage", "priest", "bishop"], tint: "#e8e8f4", tintAmt: 0.3,
    desc: "聖歌隊の先導者が額に嵌めた銀の輪。詠唱の波長に共鳴して細かく震え、声に乗せる魔力をわずかに研ぎ澄ましてくれる。" }),
  H("h_ossuary_sallet", "納骨堂のサレット", 9, { cls: ["fighter", "knight"], tint: "#d9d4bf", tintAmt: 0.3,
    desc: "納骨堂の番人が骨片を漆で固めて作った兜。死者の欠片に守られていると思えば迷宮の闇も存外に心強い、と番人は笑った。" }),
  H("h_stormcrier_hat", "嵐呼びの鍔広帽", 10, { shape: "hat", eDef: ["wind", 1], mp: 2, cls: ["mage", "bishop"],
    desc: "雨乞いならぬ嵐乞いを生業とした呪い師の帽子。鍔がひとりでに風をはらんで揺れ、飛来する土塊や石礫を逸らしてくれる。" }),
  H("h_ember_guard_helm", "燠火の戦兜", 10, { eDef: ["fire", 1], cls: ["fighter", "knight"],
    desc: "火竜の巣を暴いて全滅した傭兵団の形見。鉄の奥で燠火が今も眠り、斬りつける風の刃を熱で焼き鈍らせる。冬でも妙に温かい。" }),

  // ---- lv11-15 ----
  H("h_tollgate_helm", "関守の半兜", 11, { cls: ["fighter", "knight", "priest"],
    desc: "国境の関で旅人を検め続けた老兵の半兜。嘘を見抜く力が宿るというのは噂だが、額に走る傷はどれも本物の矢を受けた痕だ。" }),
  H("h_plague_beak_mask", "検疫医の嘴面", 12, { shape: "hat", tint: "#3a3a46", tintAmt: 0.25,
    desc: "疫病に呑まれた街を巡り歩いた医師の嘴形の面。詰められた香草はとうに朽ちたが、死の瘴気を潜り抜けた験は布に残っている。" }),
  H("h_sunken_river_crown", "沈み川の宝冠", 13, { shape: "circlet", eDef: ["water", 1], mp: 3, cls: ["mage", "priest", "bishop"],
    desc: "氾濫に沈んだ王都から、漁師の網にかかって還ってきた宝冠。藻に覆われた宝石は水底の冷たさを保ち、額に迫る炎の熱を奪う。" }),
  H("h_headsman_cowl", "斬首吏の黒覆面", 14, { shape: "hat", tint: "#3a3a46", tintAmt: 0.3,
    desc: "首打ち役人が素顔を隠した黒覆面。恨まれる顔を持たない者は呪いも受けない——その理屈を信じ、迷宮へ潜る者にも重宝される。" }),
  H("h_crag_sentry_helm", "岩哨の重兜", 14, { eDef: ["earth", 1], cls: ["fighter", "knight"],
    desc: "山岳砦の見張りが落石から頭を守った無骨な兜。岩肌と同じ冷たさと頑なさを宿し、叩きつける鉄砲水さえ岩のように受け流す。" }),
  H("h_crematory_grate_helm", "火葬炉の面格子", 15, { eDef: ["fire", 1], cls: ["fighter", "knight", "priest"],
    desc: "火葬炉の焚き口から外した鉄格子を打ち直した面頬。あまたの亡骸を見送った鉄は熱に倦み、風の刃程度ではもう火照りもしない。" }),

  // ---- lv16-20 ----
  H("h_wolfwind_helm", "狼颪の羽兜", 16, { eDef: ["wind", 1], cls: ["fighter", "knight", "thief"],
    desc: "冬山から吹き下ろす「狼颪」を独りで渡り切った狩人の兜。両脇の羽根飾りが風向きを読み、礫混じりの突風から目を守ってくれる。" }),
  H("h_forbidden_archive_cap", "禁書庫司書の角帽", 17, { shape: "hat", mp: 4, cls: ["mage", "bishop"], tint: "#6b3fa0", tintAmt: 0.25,
    desc: "読む者を狂わせる書物を管理し続けた司書の角帽。頁をめくる音が今も縫い目から漏れ、かぶる者へ禁じられた知識の欠片を囁く。" }),
  H("h_saltgrave_helm", "塩墓の潜兜", 18, { cls: ["fighter", "knight"], tint: "#e8e8f4", tintAmt: 0.25,
    desc: "崩落した岩塩坑、坑夫たちが塩漬けのまま眠る「白い墓」から掘り出された兜。塩の殻は今も清らかに輝き、穢れを寄せ付けない。" }),
  H("h_blackpike_burgonet", "黒槍隊の庇兜", 19, { cls: ["fighter", "knight"],
    desc: "敗北を知らぬまま全滅した傭兵隊「黒槍」の庇付き兜。生き残りがいない以上、彼らの強さを語れるのはもはやこの兜だけだ。" }),
  H("h_blind_seer_band", "千里眼の盲布", 19, { shape: "hat", mp: 4, cls: ["mage", "priest", "bishop"],
    desc: "自ら両の目を潰した予言者が巻いていた布。視界を閉ざしたその瞬間から、見えるはずのないものの輪郭が瞼の裏に滲みはじめる。" }),
  H("h_fallen_king_circlet", "廃王の額環", 20, { shape: "circlet", eDef: ["dark", 1], mp: 3,
    desc: "玉座を追われ、廃坑の闇で果てた王の額環。宝石は疾うに抜き取られたが、空の台座が玉座の間の暗がりを覚えており、強い光を嫌って呑む。" }),

  // ---- lv21-25 ----
  H("h_ash_knight_armet", "灰燼騎士の兜", 21, { eDef: ["fire", 1], cls: ["fighter", "knight"],
    desc: "居城もろとも焼け落ちた騎士の鎧から、唯一原形を留めて拾われた兜。内に残る焔の熱が、斬りかかる風の刃を炙って鈍らせる。" }),
  H("h_dusk_hunter_tricorn", "宵闇狩りの三角帽", 22, { shape: "hat", tint: "#6b3fa0", tintAmt: 0.2,
    desc: "夜にしか現れぬ獣だけを狙う狩人たちの三角帽。鍔を深く傾ければ顔は闇に沈み、こちらの殺気だけが綺麗に消え失せるという。" }),
  H("h_stone_warden_greathelm", "石衛士の大兜", 23, { eDef: ["earth", 1], hp: 5, cls: ["fighter", "knight"],
    desc: "石像の衛兵を模し、鑿で彫り出したように仕上げられた兜。かぶれば体が大地に根を張った心地がして、濁流の只中でも揺らがない。" }),
  H("h_holy_candle_diadem", "聖蝋の宝冠", 24, { shape: "circlet", eDef: ["light", 1], mp: 4, cls: ["priest", "bishop"],
    desc: "絶えず灯り続けてきた大聖堂の蝋燭、その滴りを集めて固めた冠。仄かな灯が常に額に在り、忍び寄る闇の手を焼いて退ける。" }),
  H("h_gale_runner_helm", "風走りの軽兜", 25, { eDef: ["wind", 1], cls: ["fighter", "knight", "thief"],
    desc: "矢の雨を駆け抜ける伝令兵のため、限界まで削ぎ落とされた軽兜。風がそのまま兜になったと評され、礫の驟雨さえ滑らせて逸らす。" }),

  // ---- lv26-30 ----
  H("h_carrion_feast_helm", "屍宴の角兜", 26, { hp: 6, cls: ["fighter", "knight"], tint: "#d9d4bf", tintAmt: 0.28,
    desc: "戦場の骸を漁る食屍鬼の王、その角を戴いた兜。死肉の宴を統べた角には生への妄執が滲み、かぶる者の命を粘り強くする。" }),
  H("h_silent_vow_cowl", "黙誓僧の深頭巾", 27, { shape: "hat", mp: 5, cls: ["mage", "priest", "bishop"],
    desc: "生涯の沈黙を誓った修道僧の頭巾。声にされなかった祈りが布の奥に積もり続け、かぶる者の内側で静かな魔力として満ちていく。" }),
  H("h_iron_queen_crown", "鉄妃の宝冠", 28, { shape: "circlet", mp: 4, tint: "#8a92a2", tintAmt: 0.3,
    desc: "黄金を嫌い、鉄の冠を望んだ女王の遺品。飾り気のない輪は今も冷たく額を締めつけ、挫けかけた心をまっすぐに立たせてくれる。" }),
  H("h_inquisitor_peak", "異端審問官の尖帽", 29, { shape: "hat", mp: 5, cls: ["priest", "bishop"],
    desc: "魔女裁判を取り仕切った審問官の尖り帽。火刑の煙を吸い続けた布は信仰とも狂気ともつかぬ熱を帯び、祈りを過剰なまでに研ぐ。" }),
  H("h_lion_maw_helm", "獅噛の面兜", 30, { hp: 8, cls: ["fighter", "knight"], tint: "#c9a227", tintAmt: 0.25,
    desc: "獅子の顎が頭ごと喰らいつく意匠の面兜。戦場でこれと相対した敵は、中の人間ではなく獅子と戦っている錯覚に呑まれたという。" }),

  // ---- lv31-35 ----
  H("h_gallows_hood", "縛り首の覆面", 31, { shape: "hat", cursed: true, align: "悪", def: 16, hp: -12, tint: "#6b3fa0", tintAmt: 0.3,
    desc: "絞首台で死刑囚にかぶせられる目隠しの袋。死の間際の奇妙な安らぎが染みつき、あらゆる刃から頭を守る——だが見えない縄が首を絞め続け、ひとたびかぶれば外せない。" }),
  H("h_abyss_bishop_crown", "深淵司教の宝冠", 33, { shape: "circlet", eDef: ["water", 2], mp: 6, cls: ["mage", "priest", "bishop"],
    desc: "光の届かぬ海淵で異形の神を奉じた司教の冠。深海の冷たさと重さを宿し、どれほど猛る劫火も額の前で泡となって掻き消える。" }),
  H("h_dragon_jaw_sallet", "竜顎の兜", 34, { hp: 8, cls: ["fighter", "knight"], tint: "#d9d4bf", tintAmt: 0.3,
    desc: "朽ちた竜の顎骨をそのまま兜に仕立てた蛮王の戦利品。牙の隙間から戦場を睨めば、竜に睨まれる側の恐怖が敵の足を縛りつける。" }),
  H("h_asura_visor", "修羅の面頬", 35, { hp: 10, cls: ["fighter", "knight"],
    desc: "幾多の戦場を生き抜いた剣鬼が、最期まで外さなかった面頬。鉄越しにも伝わる闘気が染みつき、かぶる者の血を内側から滾らせる。" }),

  // ---- lv36-40 ----
  H("h_throne_guard_helm", "玉座番の黄金兜", 36, { hp: 10, cls: ["fighter", "knight"], tint: "#c9a227", tintAmt: 0.3,
    desc: "主が空けたままの玉座を守り続けた近衛の黄金兜。主なき忠義は重いが、その重さがかぶる者の肚を据えさせる。鍍金の下は質実な鋼だ。" }),
  H("h_stargazer_nightcap", "星読みの夜帽", 37, { shape: "hat", mp: 6, cls: ["mage", "bishop"], tint: "#6b3fa0", tintAmt: 0.3,
    desc: "凶星の巡りを言い当てすぎて処刑された占星術師の帽子。裏地に刺繍された星図は夜ごと配置を変え、明日の凶兆を耳元に囁いてくる。" }),
  H("h_ogre_eater_helm", "鬼喰いの兜", 38, { hp: 12, cls: ["fighter", "knight"], tint: "#3a3a46", tintAmt: 0.3,
    desc: "鬼を喰らいその力を得るという山の民に伝わる黒鉄の兜。眉庇の裏には鬼の臼歯が嵌め込まれ、かぶる者へ荒々しい生気を分け与える。" }),
  H("h_serpent_empress_circlet", "蛇女帝の額環", 40, { shape: "circlet", mp: 6, cls: ["mage", "priest", "bishop"],
    desc: "蛇の化身と恐れられた女帝の額環。絡み合う双つの蛇の意匠は見つめた者の思考を搦め捕り、額にはいつまでも冷たい鱗の感触が残る。" }),

  // ---- lv41-45 ----
  H("h_headless_duke_helm", "首無し公の白兜", 42, { hp: 12, cls: ["fighter", "knight"], tint: "#e8e8f4", tintAmt: 0.25,
    desc: "首を刎ねられてなお馬を駆り続けたと伝わる公爵の白兜。失われた首の代わりに兜が主の意地を覚えていて、かぶる者の急所を頑なに守る。" }),
  H("h_dawn_herald_diadem", "暁告げの宝冠", 43, { shape: "circlet", eDef: ["light", 2], mp: 6, cls: ["mage", "priest", "bishop"],
    desc: "夜明けを告げる役目の大司祭だけが戴いた宝冠。常に東雲の色へ淡く輝き、夜を統べる者の呪詛も闇の爪も、光輪の前で薄れて消える。" }),
  H("h_lost_capital_warcrown", "亡都の戦王兜", 45, { hp: 15, cls: ["fighter", "knight"],
    desc: "滅びの晩、都もろとも炎に呑まれた王の戦兜。王冠を兼ねた鉢金には民の名がびっしりと刻まれ、その重みが背骨を支える芯になる。" }),

  // ---- lv46-50 ----
  H("h_total_eclipse_cowl", "皆既蝕の頭巾", 47, { shape: "hat", eDef: ["dark", 2], mp: 7, cls: ["mage", "bishop"],
    desc: "太陽が喰われた日に織り上げられたという頭巾。布の内側はいかなる正午であろうと完全な夜で、目を灼く聖光さえ蝕の闇が呑み干す。" }),
  H("h_dragonfall_armet", "屠竜の大兜", 48, { hp: 16, cls: ["fighter", "knight"],
    desc: "単身で古竜の顎へ潜り込み、内から喉を裂いた英雄の兜。浴びた竜血で鋼は半ば竜鱗と化し、生半可な牙にも爪にももう貫けない。" }),
  H("h_star_sovereign_crown", "星辰王の宝冠", 50, { shape: "circlet", mp: 8, hp: 10,
    desc: "天の星々を臣下に数えたという伝説の王の宝冠。夜空を縮めて鋳たとされる輪の内では今も小さな星が生まれては流れ、祈りを集める。" }),
];

export const FEET = [
  // ---- lv1-5 ----
  F("f_corpse_bearer_sandals", "屍運びの草鞋", 1, { spd: 1,
    desc: "死者を墓地へ運ぶ人夫が履き潰した草鞋。軽さだけが取り柄だが、死出の道を往復し続けた足は迷宮でも不思議と疲れを知らない。" }),
  F("f_sewer_waders", "下水番の胴長靴", 2, {
    desc: "都の下水路を見回る番人の胴長靴。汚水も蛭も通さない厚革は、迷宮の床にわだかまる得体の知れない水溜りから足を守ってくれる。" }),
  F("f_rampart_gaiters", "土塁兵の脚絆", 3, { eDef: ["earth", 1],
    desc: "土塁を築いては崩される工兵たちの脚絆。踏み固めた大地の頑なさが革に宿り、足元を掬おうとする奔流を堰き止めてくれる。" }),
  F("f_deserter_boots", "敗走兵の泥靴", 4, { spd: 1,
    desc: "戦場から逃げ延びた兵の泥まみれの靴。恥も外聞も捨てて駆けたからこそ持ち主は生き残った。逃げ足の速さも立派な才覚である。" }),
  F("f_palisade_greaves", "柵門兵の脚甲", 4, { shape: "greaves", cls: ["fighter", "knight"], tint: "#8a92a2", tintAmt: 0.2,
    desc: "砦の柵門を死守する兵へ支給された脚甲。敵の槍は何よりもまず脛を狙ってくる——それを骨身で知った古参隊長の発案だという。" }),
  F("f_drowned_fisher_boots", "水死人の漁長靴", 5, { eDef: ["water", 1],
    desc: "嵐の夜に海へ消えた漁師の、長靴だけが浜に流れ着いた。革に染みた海水は決して乾かず、足元を舐める炎を冷たく鎮めてしまう。" }),
  F("f_rustbite_greaves", "錆噛みの脚甲", 5, { shape: "greaves", cls: ["fighter", "knight", "priest"], tint: "#8a5a2a", tintAmt: 0.3,
    desc: "赤錆に深く噛まれながら、芯の鋼だけは頑なに残った脚甲。錆を落とせば往時の輝きが覗き、鍛えた職人の意地をまだ覚えている。" }),

  // ---- lv6-10 ----
  F("f_night_thief_shoes", "夜盗の忍び沓", 6, { eDef: ["dark", 1], spd: 1,
    desc: "名の知れた夜盗が処刑の朝まで隠し通した柔らかな沓。足音を闇に溶かし、月明かりからも松明の光からも主の足元を覆い隠す。" }),
  F("f_post_rider_boots", "早馬役の鐙靴", 7, { spd: 1,
    desc: "凶報ばかり運ばされた早馬乗りの鐙靴。踵が擦り減るほど駆けた革は履く者の足を急かすように軽い。次こそ良い報せを運んでやれ。" }),
  F("f_windkick_boots", "風蹴りの軽靴", 8, { eDef: ["wind", 1], spd: 1,
    desc: "峠越えの飛脚たちが愛用した革の軽靴。爪先が風をはらむたびに体がふわりと浮き、飛んでくる石礫さえ追い風に乗って逸れていく。" }),
  F("f_firewalk_sabatons", "火渡りの鉄沓", 9, { shape: "greaves", eDef: ["fire", 1], cls: ["fighter", "knight", "priest"],
    desc: "燠火の上を素足同然で渡る苦行のために鍛えられた鉄沓。底に溜まった熱は今も冷めることなく、斬りつける風の刃を炙って鈍らせる。" }),
  F("f_pit_slave_greaves", "闘奴の脚甲", 9, { shape: "greaves", cls: ["fighter", "knight"], tint: "#3a3a46", tintAmt: 0.25,
    desc: "闘技場の奴隷剣士に投げ与えられた粗末な脚甲。砂と血を吸った鉄には歓声の記憶がこびりつき、履く者の覚悟を試すように冷たい。" }),
  F("f_forester_deerhide_boots", "森番の鹿革靴", 10, { spd: 1, tint: "#8a6438", tintAmt: 0.25,
    desc: "密猟者を追い立てる側だった森番の鹿革靴。柔らかな底は枯枝の上でも音を立てず、追われる身となった今も足取りを軽くしている。" }),
  F("f_prisoner_chain_greaves", "囚人鎖の脚甲", 10, { shape: "greaves", spd: -1, cls: ["fighter", "knight"],
    desc: "足枷ごと鎧へ打ち直された囚人の鎖。歩くたびに重く鳴るが、絡んだ鉄輪は刃をよく弾く。自由の代わりに守りを得たとは皮肉な話だ。" }),

  // ---- lv11-15 ----
  F("f_idaten_tabi", "韋駄天の足袋", 11, { spd: 2,
    desc: "東方の俊足の神の名を冠した足袋。届かぬはずの間合いが届き、躱せぬはずの刃が躱せる——脱いだ後も、足の裏はまだ走りたがる。" }),
  F("f_lantern_pilgrim_boots", "燈持ちの巡礼靴", 12, { eDef: ["light", 1], mp: 2,
    desc: "聖地への夜道を燈火で先導する巡礼の靴。革に染み込んだ燈の温もりは消えることがなく、足元へ忍び寄る闇の手をやんわりと退ける。" }),
  F("f_bog_strider_boots", "沼渡りの高靴", 13, {
    desc: "泥に呑まれた者は還らないと言われる湿原の民の、膝まで覆う高靴。沈んだ仲間を引き上げる鉤まで備えた造りが、かえって頼もしい。" }),
  F("f_quarry_slave_greaves", "採石奴の重脚甲", 14, { shape: "greaves", eDef: ["earth", 1], spd: -1, cls: ["fighter", "knight"],
    desc: "石切場の奴隷が落石から脛を守った脚甲。岩盤の冷たさと重さをそのまま宿し、押し流そうとする洪水にもびくともしない。" }),
  F("f_duelist_heel", "果し合いの踵鉄", 15, { spd: 1, cls: ["fighter", "knight", "thief"], tint: "#8a92a2", tintAmt: 0.2,
    desc: "決闘者が踏み込みのひと足に懸けて誂えた踵鉄付きの靴。石畳を噛む踵が火花を散らすたび、間合いはこちらのものになるという。" }),
  F("f_mausoleum_greaves", "霊廟番の銀脚甲", 15, { shape: "greaves", mp: 2, cls: ["fighter", "knight", "priest"], tint: "#e8e8f4", tintAmt: 0.3,
    desc: "王家の霊廟を守る衛士の銀の脚甲。死者の眠りを乱す者を蹴り出すための銀は、穢れたものに触れると鈍く曇って主へ報せる。" }),

  // ---- lv16-20 ----
  F("f_breaker_greaves", "破城兵の重脚甲", 16, { shape: "greaves", spd: -1, hp: 5, cls: ["fighter", "knight"],
    desc: "城門へ破城槌を運ぶ決死隊の脚甲。矢の雨の下を歩み続けるために鉄板を幾重にも張り、軽さという美徳を端から捨て去っている。" }),
  F("f_drownvale_webbed_boots", "溺れ谷の水掻靴", 17, { eDef: ["water", 1], spd: 1,
    desc: "鉄砲水に沈んだ谷の漁民が、水中を駆けるために編んだ水掻き付きの靴。濡れるほどに足は軽く、燃え盛る火の海さえ鎮めて渡る。" }),
  F("f_spurred_hunt_greaves", "狩猟頭の拍車脚甲", 18, { shape: "greaves", cls: ["fighter", "knight"],
    desc: "王の猟犬団を率いた狩猟頭の、拍車付きの脚甲。犬どもは今もこの拍車の音を覚えていて、迷宮の獣すら血筋の記憶でわずかにたじろぐ。" }),
  F("f_shadow_silk_shoes", "影踏みの絹沓", 19, { eDef: ["dark", 1], spd: 1, cls: ["thief", "mage", "bishop"],
    desc: "人の影だけを踏んで歩いたと噂された暗殺者の絹沓。爪先は常に薄闇に浸り、聖堂の燭光の真下でさえ足元の影は濃いまま残る。" }),
  F("f_funeral_road_boots", "野辺送りの黒沓", 20, { mp: 3, tint: "#3a3a46", tintAmt: 0.3,
    desc: "野辺送りの列の先頭、棺の前を歩く者だけに許される黒沓。彼岸へ続く道を知る革は、迷宮の闇路でも決して道を踏み外させない。" }),
  F("f_oathbreaker_greaves", "背信騎士の脚甲", 20, { shape: "greaves", hp: 6, cls: ["fighter", "knight"],
    desc: "主君を裏切り、裏切った先でもまた裏切った騎士の脚甲。鉄はどの主の紋章も拒んで無地のまま、生き延びる才覚だけが染みている。" }),

  // ---- lv21-25 ----
  F("f_gale_chaser_boots", "颶風追いの長靴", 21, { eDef: ["wind", 1], spd: 1,
    desc: "嵐の目を追って大陸を渡り歩いた風狂いの観測者の長靴。履けばふくらはぎを追い風が押し、礫の驟雨も体を掠めて後ろへ逸れていく。" }),
  F("f_carrion_crow_boots", "鴉葬場の沓", 22, { tint: "#3a3a46", tintAmt: 0.28,
    desc: "死者を鳥へ還す葬場の番人が履いた沓。鴉どもはこの靴の主を仲間と見なすらしく、迷宮の中でも頭上のどこかから翼の音が付いてくる。" }),
  F("f_wyvern_hide_boots", "飛竜革の鉤爪靴", 23, { spd: 1, cls: ["fighter", "knight", "thief"],
    desc: "墜とされた飛竜の翼膜と鉤爪から仕立てた靴。岩壁に爪が掛かれば飛竜の脚力が革の内に蘇り、崖路も瓦礫の山もただの足場に変わる。" }),
  F("f_scorched_march_greaves", "焦土行軍の脚甲", 24, { shape: "greaves", eDef: ["fire", 1], cls: ["fighter", "knight"],
    desc: "燃え落ちる王都を踏み抜いて退いた、撤退戦の生き残りの脚甲。焼けた街路の熱を吸った鉄は、吹き付ける風の刃を陽炎のように溶かす。" }),
  F("f_vesper_keeper_greaves", "晩鐘守の脚甲", 25, { shape: "greaves", mp: 3, cls: ["fighter", "knight", "priest"], tint: "#c9a227", tintAmt: 0.2,
    desc: "日没の鐘を生涯撞き続けた老僧の脚甲。鐘楼の長い螺旋階段を昇り降りした鉄には残響が宿り、歩くたびに微かな祈りの音が鳴る。" }),

  // ---- lv26-30 ----
  F("f_beast_tamer_boots", "猛獣使いの革長靴", 26, { hp: 5, tint: "#8a6438", tintAmt: 0.25,
    desc: "鞭ひとつで魔獣を従えた猛獣使いの長靴。幾度も噛み砕かれては縫い直された革は、牙の通らない急所の在処を誰よりよく知っている。" }),
  F("f_owl_feather_shoes", "梟羽の夜靴", 27, { spd: 2, cls: ["thief", "mage", "bishop"],
    desc: "梟の風切羽を縫い込んだ夜歩き用の靴。梟が羽音を立てぬのと同じ理で、履く者の足音と気配を夜気へ溶かす。狩られる側は気づけない。" }),
  F("f_relic_route_boots", "聖蹟巡りの白沓", 28, { eDef: ["light", 1], mp: 4,
    desc: "聖者の足跡を辿る大巡礼を満願した白沓。踏んだ聖蹟の分だけ革は白く晒され、夜道に忍ぶ闇の指先を静かに払いのける。" }),
  F("f_war_prelate_greaves", "戦僧正の鋼脚甲", 29, { shape: "greaves", hp: 8, cls: ["fighter", "knight", "priest"],
    desc: "自ら戦場に立つことを選んだ僧正の鋼脚甲。祈りだけでは民を守れぬと悟った日の決意が宿り、踏み留まる足から折れない力が湧く。" }),
  F("f_deep_well_greaves", "深井の潜り脚甲", 30, { shape: "greaves", eDef: ["water", 1], spd: -1, cls: ["fighter", "knight"],
    desc: "涸れずの大井戸の底を浚う潜り人足の脚甲。錘を兼ねた鉄は水底の冷気を含んだままで、噴き上がる劫火さえ湯気に変えて防ぐ。" }),

  // ---- lv31-35 ----
  F("f_border_runner_boots", "国境破りの密行靴", 31, { spd: 2,
    desc: "関所を避けて夜の国境を抜ける案内人の靴。誰よりも速く、誰にも見られずに歩くことで生きてきた男の足癖が革に染みついている。" }),
  F("f_mountain_breaker_greaves", "山砕きの岩脚甲", 33, { shape: "greaves", eDef: ["earth", 2], spd: -1, cls: ["fighter", "knight"],
    desc: "山をひとつ崩したと伝わる巨人の踵の骨を、岩盤ごと削り出した脚甲。大地そのものの足である以上、どんな濁流もこれを押し流せない。" }),
  F("f_basilica_guard_greaves", "大伽藍衛士の脚甲", 34, { shape: "greaves", hp: 10, cls: ["fighter", "knight", "priest"], tint: "#e8e8f4", tintAmt: 0.28,
    desc: "大伽藍の聖域を守った衛士の白銀の脚甲。何人たりとも通さぬという誓いの重さが鉄に移り、履く者は退くという選択を忘れてしまう。" }),
  F("f_otherfield_boots", "彼岸野の野沓", 35, { mp: 5, tint: "#6b3fa0", tintAmt: 0.28,
    desc: "彼岸に咲く花の野を歩いてきたとしか思えない沓。土の代わりに見知らぬ花の香が染みつき、この世ならざる場所への足掛かりになる。" }),

  // ---- lv36-40 ----
  F("f_giant_feller_greaves", "巨人殺しの脚甲", 36, { shape: "greaves", hp: 12, cls: ["fighter", "knight"], tint: "#d9d4bf", tintAmt: 0.3,
    desc: "巨人の向こう脛を断って勝った小兵の英雄譚にあやかった脚甲。巨人の骨を芯に仕込み、何よりも頑丈に、何よりも低く構えられる。" }),
  F("f_phantom_coach_boots", "亡霊馬車の御者靴", 37, { spd: 2, tint: "#e8e8f4", tintAmt: 0.2,
    desc: "真夜中に死者を乗せて走る馬車——その御者が履いていたとされる靴。地を踏んでいるのに車輪のように滑らかで、足音だけが遅れて届く。" }),
  F("f_deadmarch_greaves", "死出の行軍脚甲", 38, { shape: "greaves", cursed: true, align: "悪", def: 18, spd: -1, cls: ["fighter", "knight"], tint: "#3a3a46", tintAmt: 0.3,
    desc: "全滅した軍団が死後も続けているという行軍から、隊列を乱して脱げ落ちた脚甲。鉄壁の堅さと引き換えに、履けば亡者の歩調が足を縛り、もう自分の意志では脱げない。" }),
  F("f_sabbath_dance_shoes", "魔女夜会の踊り靴", 40, { mp: 6, spd: 1, cls: ["mage", "bishop"],
    desc: "魔女どもが夜会で夜通し踊り明かすための靴。踊り手の正気を少しずつ月へ捧げる代わりに足は軽く、魔力は満ちる。曰く付きの逸品だ。" }),

  // ---- lv41-45 ----
  F("f_purgatory_furnace_greaves", "煉獄炉の脚甲", 41, { shape: "greaves", eDef: ["fire", 2], cls: ["fighter", "knight"],
    desc: "罪を焼き浄める煉獄の炉、その焚き口の鉄扉から鍛え直された脚甲。内に封じた獄炎は嵐すら薪として喰らい、風の刃を残らず灰にする。" }),
  F("f_worldsend_boots", "果ての荒野の旅靴", 43, { spd: 2, hp: 10,
    desc: "地図が白紙に変わる場所まで歩き通した放浪者の旅靴。世界の果てを見てきた革にとって、迷宮の深さなど旅路の続きでしかない。" }),
  F("f_nightmare_hoof_boots", "夢魔の蹄沓", 44, { eDef: ["dark", 1], spd: 1, mp: 4,
    desc: "悪夢を運ぶ夢魔の蹄を象った沓。履く者の足音は他人の夢の中でだけ響くといわれ、現の闇夜はおろか聖光の只中さえ素通りしていく。" }),

  // ---- lv46-50 ----
  F("f_storm_sovereign_boots", "嵐王の渡靴", 46, { eDef: ["wind", 2], spd: 2,
    desc: "雲の上から地上の戦を見下ろしたという嵐の王の靴。歩むたび足元で旋風が渦を巻き、降り注ぐ岩塊も土砂も届く前に残らず吹き散らす。" }),
  F("f_elder_dragon_greaves", "老竜鱗の重脚甲", 48, { shape: "greaves", hp: 15, spd: -1, cls: ["fighter", "knight"], tint: "#c9a227", tintAmt: 0.3,
    desc: "天寿を全うした老竜が、形見にと鱗を許した——そんな伝説を持つ脚甲。黄金の鱗は山の重みで足を縛るが、竜の永い命を分け与えてくれる。" }),
  F("f_eternal_pilgrim_boots", "永劫巡礼の沓", 50, { spd: 2, hp: 12, tint: "#e8e8f4", tintAmt: 0.3,
    desc: "世界をひと巡りしてなお歩みを止めない、終わりなき巡礼者の沓。歩いた道のりの分だけ命を蓄えるといわれ、革はもう擦り切れ方を忘れた。" }),
];
