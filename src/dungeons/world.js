// ===== 迷宮の台帳 (World) — 「百の迷宮」を1つずつ手で作り込む =====
// 迷宮は一本道ではない。いくつもの迷宮が並び立ち、どれに潜るかはプレイヤーが選ぶ。
// 新しい迷宮は条件 (踏破の報告・物語の手がかり・宝物庫の褒賞…) を満たすと地図に現れる。
// 推奨Lvより遥かに強い迷宮にも入れる (状態異常・即死はLv差で決まるので、格上を術で狩る抜け道は無い — combat.js lvRate)。
//
// 台帳の1行 = 1迷宮。並び順 = 地図 (出撃シート・図鑑) の並び。id は保存されるので変えない・使い回さない。
//   id      保存用の名 ("w01"…)
//   lv / lvTo 推奨Lv (= 敵のLv) の1階 / 最下階。階に沿って lv → lvTo へ上がる。src/levelcurve.js の目標
//           (6人を均等に育てて 7時間で Lv50・20時間で Lv100・以降 20時間ごとに +100) から付ける:
//           本筋の迷宮を順に潜ると1階 MIN_PER_FLOOR (3.1分) として、その階に着く時間の levelAtMinutes。
//           依頼の迷宮 (side) は時間に数えず、前後の本筋に合わせる (潜った分だけ先へ進んだ時に余裕が出る)。
//           敵の強さ = power (下) × lvPow(推奨Lv) × tune、戦果 (✦Soul・金貨) = levelcurve の refSoul(推奨Lv) を基準にした
//           1戦の値、落とし物の帯 = 推奨Lv から (lootBand)。難しさの物差しは推奨Lv の1本 (docs/tasks.md B1)。
//           新しい迷宮は、前の本筋の最下階の lvTo から levelcurve の分数ぶん先の Lv を付ける (10階 ≒ 2〜3Lv)
//   power   強さの素 { 階: 値 } (推奨Lv の伸び lvPow を除いた、敵の HP/ATK/VIT の倍率。間の階は直線で結ぶ。1階と最下階は必須)。
//           2026-10 (B1) に、旧来の「素体 n の enemyScale × 1階ごとの上がり幅 ÷ lvPow(n の物差しの Lv)」を誤差2%以内で
//           写した値 (それまでの挙動のまま)。後半の迷宮は 0.20〜0.25 あたり。新しい迷宮は前の本筋の最下階の値から続ける
//           (罠・毒の床・落とし穴・まだあたたかい死体の頻度も推奨Lv から — 下の hazardsAt。旧来の素体の番号 n は 2026-10 の A1 で廃止)
//   layer   景色・探索BGM・出来事の層 (1-20)。出現表 (pool/deepPool) と強敵 (elites) もこの層の顔ぶれから選ぶ
//   floors  全階数。5の倍数の階 (最下階を除く) は下り階段の代わりに「帰還魔法陣」が立つ (game.js / board.js)
//   bands   雑魚の顔ぶれ (5階ごとの帯。下の poolAt)。boss = 最下階の主 (無ければ最下階の階段で踏破)
//   elites  強敵階に出る強敵 (省略時は層の LAYER_ELITES)。名のある強敵 (named.js) の縄張り — 迷宮ごとに1体へ絞ると狩りに行ける
//   unlock  地図に現れる条件 (game.js worldUnlocked):
//             { start: true }         第0章 (人業の生成) を終えた時
//             { reported: id }        その迷宮の踏破を王に報告した時
//             { story: key }          物語の手がかり (story.js の物語マス) を見つけた時
//             { treasury: n }         宝物庫の n 種奉納の褒賞 (坑口の通行証など) を受け取った時
//             { quest: id }           酒場の固定クエスト (src/quests.js FIXED_QUESTS) を受けた時
//             { all: [id, …] }        挙げた迷宮すべての踏破を王に報告した時
//   side    依頼の迷宮 (章の筋の外)。初めて踏破しても王への報告は無く、依頼人に報告する (機能解放の数にも数えない)
//   hint    まだ現れていない時に出撃シートで示す、解放の手がかり
//   about   出撃シートの一行の説明
//   element 迷宮の属性気配 (省略時は層の属性 LAYER_ELEMENT)。雑魚は半分の確率でこの属性を帯びる (掟の elemAll なら全員)
//   trait   迷宮の掟 (その迷宮だけの決まりごと。出撃シートと「階の情報」に出る) — game.js dungeonTrait:
//             name / sym / accent / lines (説明2行)
//             mods     迷宮の異変と同じ効果キー (packMin / soulMul / goldMul / noFlee / chestRankUp / elemAll /
//                      ambushMul / lootBonusLv …)。潜っている間ずっと activeModifierDefs に加わる
//             eliteRate 強敵階の出やすさ (既定 10%)   board  盤面の加工 (game.js TRAIT_BOARD のキー)
//             specialRate 特別な階の出やすさの倍率   victoryHeal 勝つたび隊のHP・MPを回復する割合
//             foeRegen 敵の毎ラウンドの再生 (最大HP比)   mpDrain 戦闘の開幕に吸われる隊のMP (最大MP比)
//             hpDrain 戦闘の開幕に隊が失うHP (最大HP比。HP1 より下にはならない)
//             metalRate / metalMax 金属の魔物の出やすさ (既定 7%) / 1階で入れ替わる札の最大数 (既定 1)
//             chill    戦闘の開幕に隊の全員の AGI を何段下げるか (3ターン。凍てつく大回廊)
//             physOnly 魔封じ: 隊は物理技と道具のほかの技 (呪文・回復・強化・弱体・迷宮の術) を使えない (沈んだ書庫)
//             alwaysAmbush どの戦闘も必ず奇襲で始まる (主の戦いは除く。白狼の吹き溜まり)
//   challenge 格上の迷宮: 開く章の適正Lv よりはるかに高い推奨Lv を持つ寄り道。奈落の層 (abyssLayer) の推奨Lv・強さの平均には数えない
//   tune    強さの手直し (generator.js DUNGEON_TUNE と同じ欄)。第4層からはテスト記録がまだ無いので、模擬戦で既存の迷宮に
//           つないだ: 装備なしの6人 (戦士2・侍・僧侶・魔導士・盗賊、魂の Lv = その階の n の物差しの Lv — 当時の推奨Lv。
//           その後 power に写したので、tune の値はそのまま使える) が出現表の雑魚と通常攻撃だけで
//           戦い (本物の combat.js Battle、浅階/深階ごとに150戦)、1戦の被ダメ (隊HP比) を比べる。この物差しで
//           石切り場 ws2 = 浅59%・深54% / 坑口 w05 = 54%・69% (第3層の壁)。第4層は 外郭 55%・59% → 地下牢 54%・63% →
//           大手門 52%・60% (奇襲×2 の分だけ軽め) → 本丸 55%・68% (第4層の壁) / 迷い森 58%・68% に合わせた。
//           第5層 (第三章) は 縦穴 54%・61% → 霧森 55%・60% (特別な階が多い分だけ軽め) / 苗床 54%・60% →
//           大樹 63%・68% (第5層の壁) / 銀の里 54%・63%。
//           掟 (隊列・奇襲・逃走不可) の重さは模擬戦に入らないので、その分は控えめにしてある。
//           主は「主の強さ ÷ 最下階の雑魚の強さ」(sqrt(HP×ATK)) を坑口の主 2.15 / 水路の主 2.39 の間 (本丸の主 2.30・大樹の主 2.39) に置いた。
//           テスト記録が届いたら実測で合わせ直す。
//           2026-10 第5層の初めての実測 (縦穴 w10、推奨Lv どおりの Lv40-44 の6人、装備・サブ魂あり): 通常戦が平均1.4ラウンドで終わり
//           被ダメは1戦 約1% (隊は1ラウンドに約1500与え、敵の大半は動く前に倒れる)。推奨Lv どおりの隊で測った外郭 w06 (2.5R・8.7%) や
//           坑口 w05 (2.1〜2.6R・7%) と比べて桁違いに軽い。模擬戦は第5層の特色 (多用・神速・ブレス) を重く見たが、実戦では出る前に倒れる。
//           そこで第5層の顔ぶれの6迷宮 (w10-w13・ws3・ws4) の雑魚 (enemyMul) と大樹の主 (bossMul、雑魚比 2.3 を保つ) を一律 ×5/3。
//           目安は通常戦 2〜2.5R・1戦 7〜9%。強敵 (soloMul) は実測 14% で妥当なのでそのまま
//           第6層・第7層 (第四章・第五章) はテスト記録がまだ無いので、第5層の実測後の値 (×5/3 の後) を物差しに、
//           出現表の雑魚の sqrt(HP×ATK) × 強さ × 手直し が推奨Lv に沿ってなだらかに伸びるよう (第5層の伸び Lv^1.19、
//           層の入口で 1割の段差) 合わせた。掟の重さ (群れ・奇襲・開幕の熱気・逃走不可) の分は控えめ。主は雑魚比 2.35〜2.4。
//           テスト記録が届いたら実測で合わせ直す
//           第8層 (第六章) は、強さの素を第五章の同じ並びの迷宮の 0.9倍 (第四章 → 第五章と同じ層の段差) にし、手直しも第五章に倣った。
//           顔ぶれのランクが 9〜10 に上がった分は monStats が持つので、これもテスト記録で測り直す
import { LAYER_ELEMENT } from "./generator.js";
import { LAYER_BOSS, LAYER_ELITES, LAYER_POOLS, BESTIARY } from "./bestiary.js";
import { baselineLv } from "../baseline.js";
import { lvPow } from "../levelcurve.js";

const WORLD_DEF = [
  {
    id: "w01", lv: 1, lvTo: 3, layer: 1, floors: 5,
    power: { 1: 0.7, 5: 0.868 },
    name: "忘れられた地下墓地", short: "地下墓地",
    about: "ロアダルの墓所の下。師オルドが最後に降りたと伝わる",
    bands: [
      ["bs_bonebat", "bs_carrioncrow", "bs_corpsemaggot", "bs_grasphand", "bs_gravewisp", "bs_bonepile"],
    ],
    unlock: { start: true },
    hint: "第0章「人業の生成」を果たすと、王が在処を明かす",
  },
  {
    id: "w02", lv: 5, lvTo: 10, layer: 1, floors: 10,
    power: { 1: 0.598, 3: 0.5934, 5: 0.5292, 7: 0.5063, 8: 0.4751, 10: 0.4773 },
    name: "亡骸の囁く回廊", short: "囁く回廊",
    about: "墓地の奥へ続く長い回廊。壁の向こうから死者の囁きが漏れる",
    bands: [
      ["bs_mournshade", "bs_ghoul", "bs_pettyrevenant", "bs_sarcoguard", "bs_skullswarm", "bs_spiritbat"],
      ["bs_shroudstrangler", "bs_tombwarden", "bs_weepangel"],
    ],
    elites: ["el_palebutcher"], // 名のある強敵の縄張り (named.js)
    tune: { enemyMul: 0.92 }, // generator.js DUNGEON_TUNE の D3 (2026-10 の改定後の表)
    unlock: { reported: "w01" },
    hint: "「忘れられた地下墓地」の踏破を王に報告すると、道が示される",
  },
  {
    id: "w03", lv: 10, lvTo: 17, layer: 1, floors: 15,
    power: { 1: 0.41, 4: 0.4165, 5: 0.4011, 6: 0.3663, 7: 0.356, 10: 0.3619, 12: 0.3522, 15: 0.3685 },
    name: "朽ちた骸の修道院", short: "骸の修道院",
    about: "死者を弔い続けた修道士たちの成れの果て。最下階に骸の修道院長が待つ",
    bands: [
      ["bs_zombie", "d01_skeleton", "bs_weepangel", "bs_tombwarden", "bs_shroudstrangler", "bs_pettyrevenant"],
      ["bs_sarcoguard", "bs_ghoul", "bs_skullswarm"],
      ["d02_soldier", "bs_bonechanter", "bs_gravecaller"],
    ],
    elites: ["el_cryptlord"], // 名のある強敵の縄張り (named.js)
    boss: LAYER_BOSS[0], bossRank: 3,
    tune: { enemyMul: 0.90, bossMul: 1.00, bossHpMul: 2 }, // DUNGEON_TUNE の D4 の雑魚 + D5 の主 (主の HP ×2)
    unlock: { reported: "w02" },
    hint: "「亡骸の囁く回廊」の踏破を王に報告すると、道が示される",
  },
  {
    id: "w04", lv: 18, lvTo: 21, layer: 2, floors: 10,
    power: { 1: 0.3004, 5: 0.3235, 10: 0.3647 },
    name: "黒水の取水口", short: "取水口",
    about: "王都へ流れる黒い水の入口。水に触れた者は影が薄くなるという",
    bands: [
      ["bs_bloatfly", "bs_fogspecter", "bs_giantleech", "bs_ratking", "bs_razorshrimp", "bs_sewercrab"],
      ["bs_mucusworm", "bs_toxictoad", "bs_drownedcorpse"],
    ],
    elites: ["el_bloatqueen"], // 名のある強敵の縄張り (named.js)
    tune: { enemyMul: 1.40, deepMul: 0.87, soloMul: 0.85 }, // DUNGEON_TUNE の D7 (改定後の表)
    unlock: { story: "w02_sigil" },
    hint: "「亡骸の囁く回廊」の地下4階に、師の残した印があるという",
  },
  {
    id: "w05", lv: 22, lvTo: 27, layer: 3, floors: 15,
    power: { 1: 0.2799, 5: 0.2868, 10: 0.3072, 15: 0.3208 },
    name: "鎖の垂れる坑口", short: "坑口",
    about: "王家が封じた古の坑道。罪人たちの鎖が、今も闇に垂れている",
    element: "earth", // 素体の n10 は第2層 (水) なので、坑道の土を明示する
    bands: [
      ["bs_blastsprite", "bs_chainedconvict", "bs_dustwraith", "bs_koboldsapper", "bs_minebat", "bs_timbermite"],
      ["bs_rockworm", "bs_tunneler", "bs_gargoyle"],
      ["bs_crystalcrawler", "bs_troll", "bs_steelspider"],
    ],
    elites: ["el_chainoverseer"], // 名のある強敵の縄張り (named.js)
    boss: LAYER_BOSS[2], bossRank: 5,
    tune: { enemyMul: 1.50, deepMul: 0.70, soloMul: 0.92, bossMul: 0.80 }, // DUNGEON_TUNE の D11 の雑魚 + D15 の主 (第3層は厳しめ)
    unlock: { treasury: 3 },
    hint: "王家の宝物庫に収集品を3種奉納すると、王が坑口の通行証を授ける",
  },
  // ---- 第二章「捨て砦」(第4層) ── 国境の砦。百年前に王都が見捨て、守備隊はいまも持ち場を守っている ----
  {
    id: "w06", lv: 27, lvTo: 30, layer: 4, floors: 10,
    power: { 1: 0.2542, 5: 0.2604, 10: 0.2783 },
    name: "亡兵の守る外郭", short: "外郭",
    about: "国境の捨て砦の城壁と兵舎。百年前に死んだ守備隊が、いまも隊列を組んで持ち場を守る",
    element: null, // 守備隊は人の亡霊。属性の気配は無い (素体の n は第3層の土なので明示する)
    bands: [
      ["bs_pikewall", "bs_bannerwraith", "bs_drumwraith", "d03_sentinel", "bs_darksamurai", "bs_ironknight"],
      ["bs_gravecaptain", "bs_siegeballista", "d04_revenant"],
    ],
    elites: ["el_warbanner"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "ranks", name: "隊列を組む亡兵", sym: "⚔", accent: "#c9a26a",
      lines: ["亡兵は持ち場を離れず、つねに三体以上の隊列で現れる (旗手・鼓手・槍ぶすまが組む)。", "数は多いが、討てば得られる ✦Soul が 1.25倍。"],
      mods: { packMin: 3, soulMul: 1.25 },
    },
    tune: { enemyMul: 0.62, deepMul: 0.88, soloMul: 0.95 }, // 隊列 (つねに3体以上) の分だけ1体ずつは軽く
    unlock: { reported: "w05" },
    hint: "「鎖の垂れる坑口」の踏破を王に報告すると、捨て砦の封が解かれる",
  },
  {
    id: "w07", lv: 31, lvTo: 33, layer: 4, floors: 10,
    power: { 1: 0.2393, 5: 0.2555, 10: 0.2738 },
    name: "捨て砦の地下牢", short: "地下牢",
    about: "砦の地下に掘られた牢。捕虜と罪人と、王に背いた者たちが、鍵を掛けられたまま忘れられた",
    element: "dark",
    bands: [
      ["d03_ghost", "bs_banshee", "bs_cultist", "bs_shadowmage", "bs_dullahan", "bs_bloodorc"],
      ["bs_bloodwraith", "bs_vampire", "bs_bonecolossus"],
    ],
    elites: ["el_headsman"],
    trait: {
      id: "prison", name: "閉ざされた獄", sym: "⛓", accent: "#8a8fa8",
      lines: ["獄の扉は内から開かない。この迷宮の戦闘からは逃げられない。", "獄死した囚人の骸が多く (各階に骸が2つ増える)、押収品の宝箱は1ランク上等。"],
      mods: { noFlee: true, chestRankUp: 1 },
      board: "prison",
    },
    tune: { enemyMul: 1.25, deepMul: 0.78, soloMul: 0.95 },
    unlock: { story: "w06_roll" },
    hint: "「亡兵の守る外郭」の当直簿に、地下牢の鍵のありかが記されているという",
  },
  {
    id: "w08", lv: 34, lvTo: 36, layer: 4, floors: 10,
    power: { 1: 0.2321, 5: 0.2483, 10: 0.2667 },
    name: "雷雨の大手門", short: "大手門",
    about: "寄せ手が最後に破った砦の正門。あの日の雷雨はいまも止まず、討ち死にした両軍の亡者が門を奪い合う",
    element: "wind",
    bands: [
      ["bs_bloodorc", "bs_darksamurai", "bs_thunderknight", "bs_bannerwraith", "bs_siegeballista", "bs_cultist"],
      ["bs_stormgiant", "bs_bonecolossus", "bs_gravecaptain"],
    ],
    elites: ["el_warbanner"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "storm", name: "止まぬ雷雨", sym: "⚡", accent: "#9ab8ff",
      lines: ["雷雨が門を叩き続け、魔物はみな風 (雷) の気を帯びる。火の刃が通り、火の護りが雷を逸らす。", "雷鳴に足音が紛れ、奇襲を受けやすい (×2)。戦場に散った遺品で、得るゴールドは 1.3倍。"],
      mods: { elemAll: true, ambushMul: 2, goldMul: 1.3 },
    },
    tune: { enemyMul: 1.02, deepMul: 0.85, soloMul: 1.00 }, // 奇襲 ×2 の分だけ控えめ
    unlock: { reported: "w06" },
    hint: "「亡兵の守る外郭」の踏破を王に報告すると、正門への道が示される",
  },
  {
    id: "w09", lv: 37, lvTo: 41, layer: 4, floors: 15,
    power: { 1: 0.228, 5: 0.2367, 10: 0.2467, 15: 0.2559 },
    name: "捨て砦の本丸", short: "本丸",
    about: "砦の主が最後まで立てこもった本丸。軍議の間には、いまも将たちの亡霊が卓を囲む",
    element: null,
    bands: [
      ["bs_gravecaptain", "bs_ironknight", "bs_dullahan", "bs_drumwraith", "bs_shadowmage", "d03_sentinel"],
      ["bs_siegeballista", "d04_revenant", "bs_vampire"],
      ["bs_thunderknight", "bs_stormgiant", "bs_bloodwraith"],
    ],
    trait: {
      id: "council", name: "軍議の間", sym: "♜", accent: "#e0a050",
      lines: ["将の亡霊が階ごとに陣を敷く。強敵の気配する階が多い (3F以降 30%)。", "将の遺品で、落ちている装備の質が少し上がる。"],
      mods: { lootBonusLv: 4 },
      eliteRate: 0.30,
    },
    boss: LAYER_BOSS[3], bossRank: 6,
    tune: { enemyMul: 1.12, deepMul: 0.78, soloMul: 1.05, bossMul: 0.85 }, // 第4層の壁。主は会心と招来持ち
    unlock: { all: ["w07", "w08"] },
    hint: "「捨て砦の地下牢」と「雷雨の大手門」の両方を踏破して王に報告すると、本丸の門が開く",
  },
  // ---- 第三章「魂脈の根」(第5層の顔ぶれ) ── 本丸の大穴の下。魂を吸う「魂脈」は、地の底の大樹の根だった ----
  {
    id: "w10", lv: 41, lvTo: 43, layer: 5, floors: 10,
    power: { 1: 0.2129, 5: 0.2292, 10: 0.2478 },
    name: "根の這う縦穴", short: "縦穴",
    about: "本丸の床に開いた大穴。壁という壁を太い根が這い、底の見えない闇へ垂れ下がっている",
    element: "earth",
    bands: [
      ["bs_giantowl", "bs_stranglevine", "bs_sporezombie", "bs_giantmoth", "bs_fungalhulk", "bs_flytrap"],
      ["bs_mossgolem", "bs_stonegazer", "bs_griffon"],
    ],
    elites: ["el_eldertreant"],
    trait: {
      id: "shaft", name: "根の縦穴", sym: "⇣", accent: "#b08a5a",
      lines: ["縦穴の足場は脆い。落とし穴が多い (各階に2つ増える)。落ちても傷は負わないが、その階は探れない。", "壁の根に、落ちた者たちの遺品が絡まっている (各階に宝箱が1つ増える)。"],
      board: "shaft",
    },
    tune: { enemyMul: 1.20, deepMul: 0.76, soloMul: 1.05 }, // 落とし穴で階を飛ばされる分、深階はやや重い。2026-10 実測で 0.72 → 1.20 (上の注記)
    unlock: { reported: "w09" },
    hint: "「捨て砦の本丸」の踏破を王に報告すると、大穴へ降りる許しが出る",
  },
  {
    id: "w11", lv: 44, lvTo: 46, layer: 5, floors: 10,
    power: { 1: 0.2078, 5: 0.224, 10: 0.2426 },
    name: "地の底の霧森", short: "霧森",
    about: "縦穴の底に広がる、陽の届かない森。木々は魂の灯で淡く光り、霧が階ごとに姿を変える",
    element: "wind",
    bands: [
      ["bs_dryadfey", "bs_wisplure", "bs_thornhound", "bs_direboar", "bs_chimera", "bs_thunderbird"],
      ["bs_fogpanther", "bs_corruptstag", "bs_satyrpiper"],
    ],
    elites: ["el_mistmother"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "shifting", name: "移ろう霧", sym: "≋", accent: "#9ab8c8",
      lines: ["霧が森の姿を変え続ける。特別な階がとても出やすい (ふだんの2倍・およそ3階に2階)。", "豊穣の間も、瘴気の階も、ミミックの巣も。何が出るかは霧しだい。"],
      specialRate: 2,
    },
    tune: { enemyMul: 1.03, deepMul: 0.82, soloMul: 1.05 }, // 特別な階 (瘴気・群れ) が2倍出る分だけ軽め
    unlock: { story: "w10_rope" },
    hint: "「根の這う縦穴」のどこかに、師の残した綱が垂れているという",
  },
  {
    id: "w12", lv: 46, lvTo: 48, layer: 5, floors: 10,
    power: { 1: 0.2051, 5: 0.2214, 10: 0.2401 },
    name: "樹液の苗床", short: "苗床",
    about: "大樹の根が魂を溶かし、樹液に変える苗床。甘い香りが傷を癒し、魔物までも癒す",
    element: "earth",
    bands: [
      ["bs_fungalhulk", "bs_flytrap", "bs_sporezombie", "bs_dryadfey", "bs_giantmoth", "bs_wisplure"],
      ["bs_willowwitch", "bs_misttreant", "bs_stonegazer"],
    ],
    elites: ["el_mistmother"],
    trait: {
      id: "sap", name: "癒しの樹液", sym: "✚", accent: "#a8d070",
      lines: ["樹液の香りが満ちている。戦闘に勝つたび、隊のHP・MPが8%回復する。", "魔物もまた樹液を吸う。敵はすべて、ラウンドごとに最大HPの3%ずつ再生する。"],
      victoryHeal: 0.08, foeRegen: 0.03,
    },
    tune: { enemyMul: 1.27, deepMul: 0.82, soloMul: 1.05 }, // 敵の再生と勝利ごとの回復でおおむね相殺
    unlock: { reported: "w10" },
    hint: "「根の這う縦穴」の踏破を王に報告すると、根の行き着く先が示される",
  },
  {
    id: "w13", lv: 49, lvTo: 52, layer: 5, floors: 15,
    power: { 1: 0.2006, 5: 0.2098, 10: 0.2206, 15: 0.2306 },
    name: "魂喰らいの大樹", short: "大樹",
    about: "百の迷宮から魂を吸い上げる大樹の根元。幹は王都へ向かって、地の底を這い上がっている",
    element: null,
    bands: [
      ["bs_thornhound", "bs_stranglevine", "bs_chimera", "bs_giantowl", "bs_thunderbird", "bs_direboar"],
      ["bs_misttreant", "bs_willowwitch", "bs_griffon"],
      ["bs_corruptstag", "bs_mossgolem", "bs_fogpanther"],
    ],
    trait: {
      id: "roots", name: "魂を吸う根", sym: "ψ", accent: "#c070a0",
      lines: ["根が足元で脈打つ。戦闘が始まるたび、隊のMPが1割吸われる。", "吸われた魂の名残が漂い、得られる ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      mpDrain: 0.10,
    },
    boss: LAYER_BOSS[4], bossRank: 7,
    tune: { enemyMul: 1.13, deepMul: 0.80, soloMul: 1.10, bossMul: 0.87 }, // 第5層の壁。開幕にMPを吸われる。主 (ランク7・全体呪文と招来) は雑魚比を本丸の主並み (2.4) に
    unlock: { all: ["w11", "w12"] },
    hint: "「地の底の霧森」と「樹液の苗床」の両方を踏破して王に報告すると、大樹の根元への道が開く",
  },
  // ---- 第四章「王都の地下」(第6層の顔ぶれ) ── 大樹の幹が昇る王都の足元。三百年前に沈んだ旧都と、その大神殿 ----
  {
    id: "w14", lv: 52, lvTo: 54, layer: 6, floors: 10,
    power: { 1: 0.192, 5: 0.2067, 10: 0.2235 },
    name: "水底の参道", short: "参道",
    about: "王都の地下水路のさらに下。三百年前に沈んだ旧都の参道が、灯籠を連ねて水の底へ続いている",
    element: "water",
    bands: [
      ["bs_kelpdrowned", "bs_abyssjelly", "bs_fonthorror", "bs_drownedpriest", "bs_naga", "bs_choirwraith"],
      ["bs_tidecaller", "bs_sunkenbell", "bs_soulharvester"],
    ],
    elites: ["el_heresiarch"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "offering", name: "沈んだ供物", sym: "⚱", accent: "#5aa0c8",
      lines: ["参道には、沈む前に捧げられた供物が残っている (各階に宝箱が2つ増える)。", "供物のふりをした魔物も多い。宝箱がミミックである見込みが高い (30%)。"],
      mods: { mimicRate: 0.30 },
      board: "offering",
    },
    tune: { enemyMul: 1.20, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w13" },
    hint: "「魂喰らいの大樹」の踏破を王に報告すると、王都の地下への道が示される",
  },
  {
    id: "w15", lv: 54, lvTo: 56, layer: 6, floors: 10,
    power: { 1: 0.1874, 5: 0.2021, 10: 0.2188 },
    name: "溺れた聖歌の回廊", short: "聖歌回廊",
    about: "旧都の大神殿へ続く回廊。水に沈んだ聖歌隊が、三百年、同じ歌を歌い続けている",
    element: "light",
    bands: [
      ["bs_choirwraith", "bs_drownedpriest", "d04_grudge", "bs_goldgolem", "bs_soulharvester", "bs_idolguardian"],
      ["bs_shadowseraph", "bs_dreadlich", "bs_crystalgolem"],
    ],
    elites: ["el_fallenidol"],
    trait: {
      id: "hymn", name: "響く聖歌", sym: "♪", accent: "#e8d890",
      lines: ["溺れた聖歌隊の歌が響き続け、魔物はみな光の気を帯びる。闇の刃が通り、闇の護りが光を逸らす。", "歌に引かれて集まった魂は多く、得る ✦Soul は 1.3倍。"],
      mods: { elemAll: true, soulMul: 1.3 },
    },
    tune: { enemyMul: 1.12, deepMul: 0.82, soloMul: 1.05 }, // 属性が揃う分 (闇の刃で通る) だけ重め
    unlock: { story: "w14_lamp" },
    hint: "「水底の参道」の灯籠のどこかに、師の残したものがあるという",
  },
  {
    id: "w16", lv: 56, lvTo: 58, layer: 6, floors: 10,
    power: { 1: 0.185, 5: 0.1997, 10: 0.2166 },
    name: "洗礼の大水槽", short: "大水槽",
    about: "王が冠を受ける前に身を清めた、旧都の洗礼の水槽。いまは大樹の根が水を吸い、底は昏い",
    element: "water",
    bands: [
      ["bs_abyssjelly", "bs_naga", "bs_fonthorror", "bs_kelpdrowned", "bs_tidecaller", "bs_irongolem"],
      ["bs_sunkenbell", "bs_voidwalker", "bs_shadowdragon"],
    ],
    elites: ["el_heresiarch"],
    trait: {
      id: "font", name: "洗礼の水", sym: "✧", accent: "#8ad0e8",
      lines: ["水槽のあちこちに、まだ澄んだ洗礼の水が湧いている (各階に癒しの泉が2つ)。", "濁った水の底から襲われやすい (奇襲 ×1.5)。"],
      mods: { ambushMul: 1.5 },
      board: "font",
    },
    tune: { enemyMul: 1.10, deepMul: 0.80, soloMul: 1.05 }, // 泉で立て直せる分だけ重め
    unlock: { reported: "w14" },
    hint: "「水底の参道」の踏破を王に報告すると、旧都の洗礼の場が示される",
  },
  {
    id: "w17", lv: 58, lvTo: 61, layer: 6, floors: 15,
    power: { 1: 0.181, 5: 0.1892, 10: 0.199, 15: 0.208 },
    name: "沈める大神殿", short: "大神殿",
    about: "旧都の王が冠を受けた大神殿。三百年前、一夜にして水に沈んだ。大樹の幹が、祭壇を突き破って昇っている",
    element: null,
    bands: [
      ["bs_idolguardian", "bs_goldgolem", "bs_drownedpriest", "bs_choirwraith", "bs_crystalgolem", "d04_grudge"],
      ["bs_dreadlich", "bs_tidecaller", "bs_voidwalker"],
      ["bs_divinegolem", "bs_fallenangel", "bs_shadowseraph"],
    ],
    trait: {
      id: "faithful", name: "祈り続ける信徒", sym: "✝", accent: "#c0a0e0",
      lines: ["沈んだ信徒たちは群れて祈り、群れて襲う。敵はつねに四体以上で現れる。", "三百年の祈りが染みた魂で、得る ✦Soul は 1.35倍。"],
      mods: { packMin: 4, soulMul: 1.35 },
    },
    boss: LAYER_BOSS[5], bossRank: 8,
    tune: { enemyMul: 0.95, deepMul: 0.80, soloMul: 1.10, bossMul: 0.76 }, // 第6層の壁。四体以上の群れの分だけ1体ずつは軽く。主は雑魚比 2.35 に
    unlock: { all: ["w15", "w16"] },
    hint: "「溺れた聖歌の回廊」と「洗礼の大水槽」の両方を踏破して王に報告すると、大神殿の扉が開く",
  },
  // ---- 第五章「灼熱の洞」(第7層の顔ぶれ) ── 大神殿の底のさらに下。大樹の樹液を煮詰める、火の洞 ----
  {
    id: "w18", lv: 61, lvTo: 63, layer: 7, floors: 10,
    power: { 1: 0.173, 5: 0.1862, 10: 0.2014 },
    name: "火を噴く地割れ", short: "地割れ",
    about: "大神殿の底の割れ目から、熱い風が吹き上げる。岩は赤く脈打ち、足元から火が噴き出す",
    element: "fire",
    bands: [
      ["bs_magmaslime", "bs_emberswarm", "bs_ashghoul", "bs_cinderwraith", "bs_lavamaw", "bs_sulfurfiend"],
      ["bs_lavagolem", "bs_magmaray", "bs_hellhound"],
    ],
    elites: ["el_cinderking"],
    trait: {
      id: "vent", name: "噴き出す火", sym: "♨", accent: "#e07040",
      lines: ["地割れから火が噴き出し、通路の一割ほどが灼けた床になる (毒の床と同じ。浮遊で避けられる)。", "火に追われた魂が多く、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "vent",
    },
    tune: { enemyMul: 1.08, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w17" },
    hint: "「沈める大神殿」の踏破を王に報告すると、神殿の底へ降りる許しが出る",
  },
  {
    id: "w19", lv: 63, lvTo: 65, layer: 7, floors: 10,
    power: { 1: 0.1689, 5: 0.182, 10: 0.1971 },
    name: "灰の降る祭場", short: "祭場",
    about: "火を拝む者たちが集った地下の祭場。天井から灰が降り続け、焼かれた人業の殻が積み上がっている",
    element: "fire",
    bands: [
      ["bs_ashghoul", "bs_cinderwraith", "bs_sulfurfiend", "bs_demon", "bs_pyrelich", "bs_brimstonegolem"],
      ["bs_shadowogre", "bs_darkliege", "bs_flamedrake"],
    ],
    elites: ["el_cinderking"],
    trait: {
      id: "ash", name: "灰の雨", sym: "∴", accent: "#a09088",
      lines: ["降りしきる灰が視界を覆い、奇襲を受けやすい (×2)。", "灰には焼かれた魂の名残が混じり、得る ✦Soul は 1.3倍。"],
      mods: { ambushMul: 2, soulMul: 1.3 },
    },
    tune: { enemyMul: 1.02, deepMul: 0.85, soloMul: 1.05 }, // 奇襲 ×2 の分だけ控えめ
    unlock: { story: "w18_blade" },
    hint: "「火を噴く地割れ」のどこかに、師の刃が残されているという",
  },
  {
    id: "w20", lv: 65, lvTo: 67, layer: 7, floors: 10,
    power: { 1: 0.1667, 5: 0.1799, 10: 0.1951 },
    name: "魂を煮る釜場", short: "釜場",
    about: "大樹の樹液を煮詰めて霊薬に変える釜が、いくつも並ぶ。釜の火は、迷宮に呑まれた魂でできている",
    element: "fire",
    bands: [
      ["bs_lavagolem", "bs_magmaslime", "bs_brimstonegolem", "bs_furnacefiend", "bs_obsidianguard", "bs_magmaray"],
      ["bs_basaltdrake", "bs_infernaltyrant", "bs_lavamaw"],
    ],
    elites: ["el_magmawyrm"],
    trait: {
      id: "cauldron", name: "煮えたぎる釜", sym: "♆", accent: "#f0a040",
      lines: ["釜の熱気が肌を焼く。戦闘が始まるたび、隊のHPが6%減る (HP1 より下にはならない)。", "釜の縁に霊薬の滓が固まっていて、得られる金貨は 1.4倍。"],
      mods: { goldMul: 1.4 },
      hpDrain: 0.06,
    },
    tune: { enemyMul: 0.90, deepMul: 0.82, soloMul: 1.05 }, // 開幕の熱気の分だけ控えめ
    unlock: { reported: "w18" },
    hint: "「火を噴く地割れ」の踏破を王に報告すると、火の洞の奥が示される",
  },
  {
    id: "w21", lv: 67, lvTo: 70, layer: 7, floors: 15,
    power: { 1: 0.163, 5: 0.1705, 10: 0.1793, 15: 0.1874 },
    name: "業火の大釜", short: "大釜",
    about: "火の洞の底の大釜。三百年、魂の樹液を煮詰め続けてきた。釜の底には、底の無い穴が口を開けている",
    element: "fire",
    bands: [
      ["bs_obsidianguard", "bs_furnacefiend", "bs_pyrelich", "bs_demon", "bs_flamedrake", "bs_lavagolem"],
      ["bs_basaltdrake", "bs_darkliege", "bs_shadowogre"],
      ["bs_infernaltyrant", "bs_doombringer", "bs_hellhound"],
    ],
    trait: {
      id: "inferno", name: "業火の大釜", sym: "♨", accent: "#ff6030",
      lines: ["大釜の業火は退路を焼く。この迷宮の戦闘からは逃げられない。魔物はみな火の気を帯びる。", "煮詰められた魂の名残で、得る ✦Soul は 1.4倍。"],
      mods: { noFlee: true, elemAll: true, soulMul: 1.4 },
    },
    boss: LAYER_BOSS[6], bossRank: 9,
    tune: { enemyMul: 0.95, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第7層の壁。逃げられない分だけ控えめ
    unlock: { all: ["w19", "w20"] },
    hint: "「灰の降る祭場」と「魂を煮る釜場」の両方を踏破して王に報告すると、大釜への道が開く",
  },
  // ---- 第六章「氷結回廊」(第8層の顔ぶれ) ── 大釜の底の奈落。吹き上げる風が、落ちてくる魂を氷に閉じこめる ----
  //   強さの素は第五章の各迷宮の 0.9倍 (層の入口の1割の段差。第四章 → 第五章と同じ比)。手直しは第五章に倣う
  {
    id: "w22", lv: 70, lvTo: 72, layer: 8, floors: 10,
    power: { 1: 0.1557, 5: 0.1676, 10: 0.1813 },
    name: "奈落の氷棚", short: "氷棚",
    about: "大釜の底の穴を降りると、壁から氷の棚が張り出している。吹き上げる風が、落ちてくる魂を凍らせて受け止める",
    element: "water",
    bands: [
      ["bs_frostwolf", "bs_winterbat", "bs_icewraith", "bs_blizzardspirit", "bs_iceserpent", "bs_glacialcrab"],
      ["bs_snowstalker", "bs_rimecrawler", "bs_iciclehorror"],
    ],
    elites: ["el_glacialmaw"],
    trait: {
      id: "ledge", name: "吹き上げる風", sym: "⇡", accent: "#9ad0f0",
      lines: ["奈落から吹き上げる風が氷棚を削り、各階に落とし穴が3つ増える (最下階を除く。浮遊で避けられる)。", "落ちてきた魂が棚に吹き寄せられ、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "ledge",
    },
    tune: { enemyMul: 1.08, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w21" },
    hint: "「業火の大釜」の踏破を王に報告すると、奈落の壁の氷の棚へ降りる許しが出る",
  },
  {
    id: "w23", lv: 72, lvTo: 74, layer: 8, floors: 10,
    power: { 1: 0.152, 5: 0.1638, 10: 0.1774 },
    name: "凍れる操霊師の間", short: "凍れる間",
    about: "氷の柱がどこまでも並ぶ広間。柱の一本一本に、人の影が閉じこめられている",
    element: "water",
    bands: [
      ["bs_frozenexplorer", "bs_icewraith", "bs_snowmantis", "bs_frostknight", "bs_glacialcrab", "bs_blizzardspirit"],
      ["bs_frostlich", "bs_frostmaiden", "bs_icegolem"],
    ],
    elites: ["el_frostsovereign"],
    trait: {
      id: "icetomb", name: "氷漬けの先人", sym: "❄", accent: "#b8d8f0",
      lines: ["氷の柱の根元に、凍った骸が眠っている (各階に死体が2つ増える。3割はまだあたたかい)。", "凍りついた魂は傷みが少なく、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      board: "icetomb",
    },
    tune: { enemyMul: 1.02, deepMul: 0.84, soloMul: 1.05 },
    unlock: { story: "w22_coat" },
    hint: "「奈落の氷棚」のどこかに、師の残したものが凍りついているという",
  },
  {
    id: "w24", lv: 74, lvTo: 76, layer: 8, floors: 10,
    power: { 1: 0.15, 5: 0.1619, 10: 0.1756 },
    name: "極光の氷窟", short: "氷窟",
    about: "天井に極光がゆらめく氷の洞窟。光の正体は、氷に閉じこめられた無数の魂だという",
    element: "water",
    bands: [
      ["bs_aurorawisp", "bs_blizzardspirit", "bs_iceserpent", "bs_snowstalker", "bs_rimecrawler", "bs_frostwolf"],
      ["bs_frozenangel", "bs_frostmaiden", "bs_frostwyrm"],
    ],
    elites: ["el_glacialmaw"],
    trait: {
      id: "aurora", name: "揺らめく極光", sym: "≈", accent: "#a0f0c8",
      lines: ["天井の極光が魔物の気を揺らし、魔物の属性がでたらめに定まる。", "極光に照らされた氷の中に古い金貨が光り、得られる金貨は 1.35倍。"],
      mods: { elemRandom: true, goldMul: 1.35 },
    },
    tune: { enemyMul: 0.96, deepMul: 0.84, soloMul: 1.05 }, // 属性が読めない分だけ控えめ
    unlock: { reported: "w22" },
    hint: "「奈落の氷棚」の踏破を王に報告すると、氷棚の奥の洞窟が示される",
  },
  {
    id: "w25", lv: 76, lvTo: 79, layer: 8, floors: 15,
    power: { 1: 0.1467, 5: 0.1535, 10: 0.1614, 15: 0.1687 },
    name: "凍てつく大回廊", short: "大回廊",
    about: "奈落の壁をめぐる、氷の大回廊。いちばん奥に、氷の玉座があるという",
    element: "water",
    bands: [
      ["bs_frostknight", "bs_icegolem", "bs_frozenexplorer", "bs_snowmantis", "bs_aurorawisp", "bs_iciclehorror"],
      ["bs_rimegiant", "bs_frostlich", "bs_frozenangel"],
      ["bs_frostwyrm", "bs_frostfiend", "bs_frostmaiden"],
    ],
    trait: {
      id: "frost", name: "絶対零度", sym: "✱", accent: "#d0e8ff",
      lines: ["凍てつく冷気に身がすくむ。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "凍りついた古い魂の名残で、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      chill: 1,
    },
    boss: LAYER_BOSS[7], bossRank: 10,
    tune: { enemyMul: 0.95, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第8層の壁。開幕に足が鈍る分だけ控えめ
    unlock: { all: ["w23", "w24"] },
    hint: "「凍れる操霊師の間」と「極光の氷窟」の両方を踏破して王に報告すると、大回廊への道が開く",
  },
  // ---- 依頼の迷宮 (酒場の固定クエストを受けると地図に現れる) ----
  {
    id: "ws1", lv: 20, lvTo: 23, layer: 2, floors: 10, side: true,
    power: { 1: 0.2926, 5: 0.3272, 7: 0.3429, 8: 0.336, 10: 0.3438 },
    name: "沈んだ礼拝堂", short: "沈んだ礼拝堂",
    about: "黒い水の底に沈んだ礼拝堂。夜ごと、水の下から鐘が鳴る",
    bands: [
      ["bs_sludgeooze", "bs_waterelemental", "bs_sewerdredger", "bs_brinewraith", "bs_waterhag", "bs_eelfiend"],
      ["bs_anglerfiend", "d03_sahagin", "bs_abysstentacle"],
    ],
    elites: ["el_drownedpaladin"], // 名のある強敵の縄張り (named.js)
    boss: LAYER_BOSS[1], bossRank: 4,
    tune: { enemyMul: 1.28, deepMul: 0.75, soloMul: 0.85, bossMul: 0.85 }, // DUNGEON_TUNE の D9 の雑魚 + D10 の主
    unlock: { quest: "fq_oswald" },
    hint: "酒場の破戒僧の依頼「沈んだ鐘」を受けると、道が示される",
  },
  {
    id: "ws2", lv: 24, lvTo: 28, layer: 3, floors: 10, side: true,
    power: { 1: 0.2704, 5: 0.2908, 7: 0.3064, 8: 0.3003, 10: 0.3062 },
    name: "石眠りの石切り場", short: "石切り場",
    about: "王都の城壁を切り出した古い石切り場。鉱夫たちは、つるはしを握ったまま石になった",
    bands: [
      ["d03_orc", "bs_shieldogre", "bs_stonegorgon", "bs_rockworm", "bs_dustwraith", "bs_tunneler"],
      ["d03_mandrake", "bs_orehulk", "bs_deepgolem"],
    ],
    elites: ["el_crystalseer"], // 名のある強敵の縄張り (named.js)
    tune: { enemyMul: 1.30, deepMul: 0.73, soloMul: 1.0 }, // DUNGEON_TUNE の D13 の行
    unlock: { quest: "fq_morga" },
    hint: "酒場の薬師の依頼「石になった鉱夫たち」を受けると、道が示される",
  },
  {
    id: "ws3", lv: 37, lvTo: 42, layer: 5, floors: 10, side: true,
    power: { 1: 0.2218, 5: 0.2343, 10: 0.2481 },
    name: "霧の迷い森", short: "迷い森",
    about: "捨て砦の裏手に広がる森。霧が道を食い、胞子が足を取る。迷い込んだ者は二度と同じ道を歩けない",
    element: "wind",
    bands: [
      ["bs_thornhound", "bs_giantmoth", "bs_flytrap", "bs_wisplure", "bs_stranglevine", "bs_direboar"],
      ["bs_fogpanther", "bs_willowwitch", "bs_misttreant"],
    ],
    elites: ["el_mistmother"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "mist", name: "迷い霧", sym: "☁", accent: "#9ad0b8",
      lines: ["胞子の床が多い (毒の床が増える)。霧の奥に、ひとつだけ癒しの泉が湧く。", "霧に紛れて奇襲を受けやすい (×1.5)。迷い込んだ魂は多く、得る ✦Soul は 1.3倍。"],
      mods: { ambushMul: 1.5, soulMul: 1.3 },
      board: "mist",
    },
    tune: { enemyMul: 1.33, deepMul: 0.76, soloMul: 1.00 }, // 第5層の顔ぶれ (ランク6-7) を本丸並みに
    unlock: { quest: "fq_wren" },
    hint: "酒場の猟師の依頼「霧に呑まれた娘」を受けると、道が示される",
  },
  {
    id: "ws4", lv: 41, lvTo: 45, layer: 5, floors: 10, side: true,
    power: { 1: 0.2129, 5: 0.2258, 10: 0.2402 },
    name: "銀業の隠れ里", short: "銀の里",
    about: "器になりそこねた魂が流れ着く、霧の奥の隠れ里。空の鎧と石の人形が、銀の小人を守っている",
    element: null,
    bands: [
      ["bs_siegeballista", "bs_gravecaptain", "d04_revenant", "bs_thunderknight", "bs_bonecolossus", "bs_fungalhulk"],
      ["bs_goldgolem", "bs_mossgolem", "bs_misttreant"],
    ],
    trait: {
      id: "silver", name: "銀の里", sym: "◇", accent: "#d0d8e8",
      lines: ["銀業の隠れ里。金属の魔物がとても出やすい (各階45%・2体の札まで)。会心の一撃で仕留めよ。", "里の番人は空の鎧と石の人形。物理に固い者が多い。"],
      metalRate: 0.45, metalMax: 2,
    },
    tune: { enemyMul: 1.53, deepMul: 0.76, soloMul: 1.05 },
    unlock: { quest: "fq_zakka2" },
    hint: "酒場の行商人の依頼「銀の欠片の行方」を受けると、道が示される",
  },
  {
    id: "ws5", lv: 55, lvTo: 58, layer: 6, floors: 10, side: true,
    power: { 1: 0.185, 5: 0.1997, 10: 0.2166 },
    name: "王都の古井戸", short: "古井戸",
    about: "軍議の卓の地図に、王都の真ん中でひとつだけ赤く囲まれていた井戸。投げ込まれた願いの品が、底に積もっている",
    element: "dark",
    bands: [
      ["d04_grudge", "bs_soulharvester", "bs_kelpdrowned", "bs_voidwalker", "bs_irongolem", "bs_shadowdragon"],
      ["bs_dreadlich", "bs_fallenangel", "bs_divinegolem"],
    ],
    elites: ["el_fallenidol"],
    trait: {
      id: "wishes", name: "願いの底", sym: "◎", accent: "#9080c0",
      lines: ["井戸の底には、三百年分の願いの品が沈んでいる。宝箱は1ランク上等で、落ちている装備の質も少し上がる。", "願いを喰らって育った魔物が、その品を守っている。"],
      mods: { chestRankUp: 1, lootBonusLv: 4 },
    },
    tune: { enemyMul: 1.07, deepMul: 0.78, soloMul: 1.05 },
    unlock: { story: "w09_map" },
    hint: "「捨て砦の本丸」の軍議の卓の地図に、王都の井戸が記されているという",
  },
  // ---- 各層の寄り道 (2026-10 ユーザーの指示: 20層で百の迷宮に届くよう、第4層からは本筋4 + 寄り道2) ----
  // 強さの素は同じ層の、推奨Lv の近い迷宮から続け、手直しは掟の重さの分だけ控えめにした。テスト記録で測り直す。
  // ときどき「その時の適正Lv では歯が立たない迷宮」(challenge) と「極端な掟の迷宮」(魔封じ・必ず奇襲…) を混ぜる (ユーザーの指示)
  {
    id: "ws6", lv: 30, lvTo: 34, layer: 4, floors: 10, side: true,
    power: { 1: 0.243, 5: 0.257, 10: 0.275 },
    name: "見捨てられた狼煙台", short: "狼煙台",
    about: "捨て砦の外れに立つ狼煙台。援軍を呼ぶ火は百年燃え続け、いまも誰かが薪をくべている",
    element: "fire",
    bands: [
      ["bs_drumwraith", "bs_bannerwraith", "bs_pikewall", "bs_bloodorc", "d03_ghost", "bs_shadowmage"],
      ["bs_gravecaptain", "bs_bloodwraith", "bs_siegeballista"],
    ],
    elites: ["el_warbanner"],
    trait: {
      id: "beacon", name: "消えない狼煙", sym: "♨", accent: "#e09050",
      lines: ["狼煙の火を浴び、魔物はみな火の属性を帯びる。", "火に呼ばれて集まった魂は多く、得る ✦Soul は 1.25倍。"],
      mods: { elemAll: true, soulMul: 1.25 },
    },
    tune: { enemyMul: 1.15, deepMul: 0.80, soloMul: 0.95 }, // 属性が揃う分 (水の刃で通る) だけ重め
    unlock: { quest: "fq_bram2" },
    hint: "酒場の老兵の依頼「来なかった援軍」を受けると、道が示される",
  },
  {
    // 格上の迷宮: 第二章 (隊は Lv35 前後) で開くが、推奨Lv は第五章の火の洞と同じ。第4層の魔物 (ランク5〜6) を
    // 火を噴く地割れ w18 と同じ強さ (sqrt(HP×ATK) 約800) まで引き上げるため、強さの素は第4層の約1.65倍
    id: "ws7", lv: 62, lvTo: 66, layer: 4, floors: 10, side: true, challenge: true,
    power: { 1: 0.378, 5: 0.403, 10: 0.432 },
    name: "獄吏の詰所", short: "詰所",
    about: "地下牢の番人たちが寝起きした詰所。百年、牢の恨みを浴び続けた獄吏たちは、もう人の強さではない",
    bands: [
      ["bs_cultist", "bs_banshee", "bs_dullahan", "d03_sentinel", "bs_ironknight", "bs_darksamurai"],
      ["d04_revenant", "bs_vampire", "bs_thunderknight"],
    ],
    elites: ["el_headsman"],
    trait: {
      id: "keyring", name: "鍵束の間", sym: "⚿", accent: "#c0a060",
      lines: ["押収品を納めた宝箱が並ぶ (各階に宝箱が2つ増える)。", "獄吏の錠は固いが、中身は上等 (宝箱が1ランク上がる)。"],
      mods: { chestRankUp: 1 },
      board: "offering",
    },
    tune: { enemyMul: 1.10, deepMul: 0.80, soloMul: 1.05 },
    unlock: { quest: "fq_liese2" },
    hint: "酒場の牢番の娘の依頼「鍵束の持ち主」を受けると、道が示される",
  },
  {
    id: "ws8", lv: 57, lvTo: 61, layer: 6, floors: 10, side: true,
    power: { 1: 0.183, 5: 0.196, 10: 0.21 },
    name: "沈んだ書庫", short: "書庫",
    about: "旧都の書庫の塔。水に沈んでも、棚の書物は一冊も流れ出していない。誰かが、まだ読み手を待っている",
    bands: [
      ["bs_drownedpriest", "bs_tidecaller", "bs_sunkenbell", "bs_kelpdrowned", "d04_grudge", "bs_idolguardian"],
      ["bs_dreadlich", "bs_voidwalker", "bs_shadowseraph"],
    ],
    elites: ["el_heresiarch"],
    trait: {
      id: "library", name: "魔封じの墨", sym: "✎", accent: "#80a0c0",
      lines: ["にじんだ墨の霧が、唱えた言葉を吸いこむ。物理技と道具のほかは、技を一切使えない (呪文・回復・強化・弱体・迷宮の術)。", "書物に残った知恵が魂を育て、得る ✦Soul は 1.2倍。落ちている装備の質も少し上がる。"],
      mods: { soulMul: 1.2, lootBonusLv: 3 },
      physOnly: true,
    },
    tune: { enemyMul: 0.90, deepMul: 0.80, soloMul: 1.00 }, // 呪文で癒せない・守れない分だけ軽め
    unlock: { quest: "fq_archive2" },
    hint: "酒場の司書の依頼「沈んだ書庫」を受けると、道が示される",
  },
  {
    id: "ws9", lv: 62, lvTo: 66, layer: 7, floors: 10, side: true,
    power: { 1: 0.171, 5: 0.184, 10: 0.199 },
    name: "黒曜の切り場", short: "黒曜の切り場",
    about: "溶けた岩が冷えて固まった、黒いガラスの崖。割れ口は刃物より鋭く、近づく者を切り刻む",
    bands: [
      ["bs_obsidianguard", "bs_magmaslime", "bs_emberswarm", "bs_lavamaw", "bs_brimstonegolem", "bs_cinderwraith"],
      ["bs_basaltdrake", "bs_lavagolem", "bs_magmaray"],
    ],
    elites: ["el_magmawyrm"],
    trait: {
      id: "obsidian", name: "黒い刃の崖", sym: "◆", accent: "#9070a0",
      lines: ["足元の黒曜が肌を裂く。戦闘の開幕に、隊のHPが最大の4%減る。", "黒曜で鍛えた古い品が眠り、落ちている装備の質が上がる。"],
      mods: { lootBonusLv: 4 },
      hpDrain: 0.04,
    },
    tune: { enemyMul: 1.00, deepMul: 0.80, soloMul: 1.05 }, // 開幕の傷の分だけ控えめ
    unlock: { quest: "fq_dorn3" },
    hint: "酒場の鍛冶師の依頼「黒い刃の材」を受けると、道が示される",
  },
  {
    id: "ws10", lv: 66, lvTo: 70, layer: 7, floors: 10, side: true,
    power: { 1: 0.165, 5: 0.177, 10: 0.19 },
    name: "火守りの僧院", short: "僧院",
    about: "釜の火を絶やさぬよう祈り続けた火守りたちの僧院。祈りが煮つまり、炎の幻が回廊を歩く",
    bands: [
      ["bs_ashghoul", "bs_pyrelich", "bs_demon", "bs_sulfurfiend", "bs_furnacefiend", "bs_hellhound"],
      ["bs_darkliege", "bs_infernaltyrant", "bs_doombringer"],
    ],
    elites: ["el_cinderking"],
    trait: {
      id: "pyre", name: "炎の幻", sym: "♆", accent: "#f08050",
      lines: ["祈りの炎が見せる幻で、特別な階がよく現れる (×1.8)。", "燃え残った魂は多く、得る ✦Soul は 1.2倍。"],
      mods: { soulMul: 1.2 },
      specialRate: 1.8,
    },
    tune: { enemyMul: 0.98, deepMul: 0.84, soloMul: 1.05 },
    unlock: { quest: "fq_irma" },
    hint: "酒場の尼僧の依頼「祈りの火を消して」を受けると、道が示される",
  },
  {
    id: "ws11", lv: 71, lvTo: 75, layer: 8, floors: 10, side: true,
    power: { 1: 0.154, 5: 0.166, 10: 0.179 },
    name: "白狼の吹き溜まり", short: "吹き溜まり",
    about: "吹き上げる風が雪を寄せ集めた、奈落の壁のくぼみ。白霜の狼の群れが、雪煙にまぎれて住みついている",
    element: "water",
    bands: [
      ["bs_frostwolf", "bs_snowstalker", "bs_winterbat", "bs_snowmantis", "bs_glacialcrab", "bs_iceserpent"],
      ["bs_rimegiant", "bs_frostfiend", "bs_iciclehorror"],
    ],
    elites: ["el_glacialmaw"],
    trait: {
      id: "drift", name: "雪煙の狩り", sym: "≋", accent: "#c8e0f0",
      lines: ["群れは雪煙にまぎれて忍び寄る。どの戦闘も必ず奇襲で始まり、敵が先に動く (周囲警戒・夜営の番・先制の心得も効かない)。", "雪の下に落ちてきた品が埋もれ、得られる金貨は 1.3倍。"],
      mods: { goldMul: 1.3 },
      alwaysAmbush: true,
    },
    tune: { enemyMul: 0.90, deepMul: 0.82, soloMul: 1.00 }, // 毎回先手を取られる分だけ軽め
    unlock: { quest: "fq_august" },
    hint: "酒場の毛皮売りの依頼「白い毛皮」を受けると、道が示される",
  },
  {
    id: "ws12", lv: 75, lvTo: 79, layer: 8, floors: 10, side: true,
    power: { 1: 0.148, 5: 0.159, 10: 0.171 },
    name: "氷河の裂け目", short: "裂け目",
    about: "氷の壁に走る深い裂け目。解けかけた氷の水が細く流れ、氷の中から抜け落ちた者たちがさまよう",
    element: "water",
    bands: [
      ["bs_frozenexplorer", "bs_aurorawisp", "bs_icewraith", "bs_rimecrawler", "bs_frostmaiden", "bs_frostknight"],
      ["bs_frostlich", "bs_icegolem", "bs_frozenangel"],
    ],
    elites: ["el_frostsovereign"],
    trait: {
      id: "melt", name: "雪解けの水", sym: "✧", accent: "#9ad8f0",
      lines: ["澄んだ雪解けの泉が湧く (各階に癒しの泉が2つ)。だが冷たい水が魔力を奪い、戦闘の開幕に隊のMPが最大の8%減る。", "氷から抜け落ちた魂は傷みが少なく、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      board: "font",
      mpDrain: 0.08,
    },
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 1.05 },
    unlock: { quest: "fq_thaw2" },
    hint: "酒場の織り子の依頼「抜け落ちた人たち」を受けると、道が示される",
  },
];

// 敵の種類: 3種 + 5階ごとに3種 (全5階 = 6種 / 全10階 = 9種 / 全15階 = 12種)。ミミック・銀業などの共通の敵と
// 強敵・主は数えない。帯 (bands) は5階ごと: 1〜5階 = bands[0] (6種)、6階・11階…で3種ずつ新しい帯が加わる。
// 各階に出るのは「いまの帯と、ひとつ前の帯」(11階なら 6〜10階の帯 + 11〜15階の帯。1〜5階の敵はもう出ない)
export const BAND_FLOORS = 5;
export function bandIndex(cfg, floor) {
  const bands = cfg && cfg.bands;
  if (!bands || !bands.length) return 0;
  return Math.min(bands.length - 1, Math.floor(Math.max(0, (floor || 1) - 1) / BAND_FLOORS));
}
// その階に出る雑魚の顔ぶれ。帯の無い迷宮 (奈落の素体) は旧来どおり浅階 pool / 深階 deepPool
export function poolAt(cfg, floor) {
  if (cfg && cfg.bands && cfg.bands.length) {
    const k = bandIndex(cfg, floor);
    return k === 0 ? [...cfg.bands[0]] : [...cfg.bands[k - 1], ...cfg.bands[k]];
  }
  const deep = (floor || 1) > ((cfg && cfg.floors) || 3) / 2;
  return ((deep ? cfg.deepPool : cfg.pool) || cfg.pool || ["cm_slime"]).slice();
}

// ===== 迷宮のLv =====
// 推奨Lv (= 敵のLv) は台帳の lv / lvTo が決める (src/levelcurve.js の目標の曲線から付けた値)。
// 下の nAtLevel / lootBand だけは、旧来の物差し (基準の隊 baseline.js の Lv を ×LV_EST で縮めた曲線) で
// 「推奨Lv L の落とし物の帯」を引く (品の隠しLv の尺度は旧来の迷宮番号のまま)
export const LV_EST = 0.78;
const estLv = (v) => 1 + (v - 1) * LV_EST;
// n の物差しの Lv がちょうど L になる素体の難度 n (小数・逆引き)。落とし物の帯を推奨Lv から決めるのに使う
export function nAtLevel(L) {
  let lo = 0, hi = 400;
  if (estLv(baselineLv(hi)) < L) return 1 + hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (estLv(baselineLv(mid)) < L) lo = mid; else hi = mid;
  }
  return 1 + hi;
}
// 落とし物の帯 (品の隠しLv)。旧来の「難度 n の迷宮 = [n×1.5, n×2]」を、推奨Lv と同じ Lv の n で引く
const _lootBands = new Map(); // 奈落は階ごとに設定を組み直すので、逆引きの結果を覚えておく
export function lootBand(lv, lvTo = lv) {
  const key = lv + "|" + lvTo;
  let b = _lootBands.get(key);
  if (!b) {
    b = [Math.max(1, Math.round(nAtLevel(lv) * 1.5)), Math.max(1, Math.min(200, Math.round(nAtLevel(lvTo) * 2)))];
    _lootBands.set(key, b);
  }
  return b.slice();
}

// 品の隠しLv → その品の「適正Lv」= その品が落とし物の帯のちょうど真ん中に来る推奨Lv (lootBand の逆引き。
// 帯の中心は n×1.75 なので n = 隠しLv ÷ 1.75)。鑑定の成功率の物差し (souls.js identifyChance)
const _fitLv = new Map();
export function itemFitLv(itemLv) {
  const key = Math.max(1, Math.round(itemLv || 1));
  let v = _fitLv.get(key);
  if (v == null) {
    v = Math.max(1, estLv(baselineLv(Math.max(0, key / 1.75 - 1))));
    _fitLv.set(key, v);
  }
  return v;
}

// 罠・毒の床・落とし穴・まだあたたかい死体の頻度 (推奨Lv の1階から)。旧来の素体 (難度 n の生成器) の式を、本筋の迷宮の
// 「n ≒ 1 + (推奨Lv − 1) × 0.46」で推奨Lv に写したもの (A1 で n を廃止したときに置き換え。値はほぼ据え置き)。
// 毒の床は推奨Lv 24 から、落とし穴は第2層から (最下階には無い — board.js)
export function hazardsAt(lv, layer) {
  const k = Math.max(0, (lv || 1) - 1);
  return {
    trapRate: Math.min(0.25, 0.0412 + 0.00092 * k),
    poisonRate: lv >= 24 ? Math.min(0.10, 0.0406 + 0.000276 * k) : 0,
    pitRate: (layer || 1) >= 2 ? Math.min(0.05, 0.0203 + 0.000138 * k) : 0,
    warmChance: Math.min(0.7, 0.3832 + 0.00147 * k),
  };
}

// 台帳の欄から、迷宮の設定を組み立てる
function build(def) {
  const cfg = { ...hazardsAt(def.lv, def.layer), ...def };
  // 属性の気配 (省略時は層の属性。null = 気配なし)・宝箱と罠のランク (層から)・主のランク
  if (def.element === undefined) cfg.element = LAYER_ELEMENT[def.layer - 1] || "none";
  cfg.rank = Math.max(1, Math.ceil(def.layer / 2));
  // 出現表: 帯をまとめて浅階 (最初の帯) / 深階 (以降の帯) にも写す (図鑑・逃走の物差しなどが全体を見る)
  cfg.pool = [...def.bands[0]];
  cfg.deepPool = def.bands.length > 1 ? def.bands.slice(1).flat() : [...def.bands[0]];
  cfg.tune = def.tune ? { ...def.tune } : null;
  cfg.power = { ...def.power };
  // 落とし物の帯は推奨Lv の1階 (lv) から最下階 (lvTo) まで広がる (game.js が階の深さで帯の中を補間する)
  cfg.lootLv = lootBand(def.lv, def.lvTo);
  cfg.elites = def.elites || LAYER_ELITES[def.layer] || [];
  cfg.boss = def.boss || null;
  cfg.bossRank = def.boss ? (def.bossRank || def.layer + 2) : 0;
  cfg.bossScale = 1;
  cfg.gates = true; // 5階ごとの帰還魔法陣 (奈落は持たない)
  return cfg;
}

export const WORLD = WORLD_DEF.map(build);
export const WORLD_IDS = WORLD.map((d) => d.id);
export function worldIndexOf(id) { return WORLD_IDS.indexOf(id); }
export function worldById(id) { return WORLD[worldIndexOf(id)] || null; }

// 帰還魔法陣の階 (5の倍数・最下階を除く)
export function gateFloors(cfg) {
  const out = [];
  for (let f = 5; f < (cfg.floors || 1); f += 5) out.push(f);
  return out;
}
export function isGateFloor(cfg, floor) { return !!(cfg && cfg.gates && floor % 5 === 0 && floor < (cfg.floors || 1)); }

// 迷宮のLv (その階の敵のLv・推奨Lv)。lv → lvTo を階で補間 (奈落の階は game.js abyssCfg が lv を持たせる)
export function dungeonLevelRaw(cfg, floor = 1) {
  if (!cfg || cfg.lv == null) return 1;
  const floors = cfg.floors || 1;
  const t = floors > 1 ? Math.min(1, (Math.max(1, floor) - 1) / (floors - 1)) : 0;
  return cfg.lv + t * ((cfg.lvTo != null ? cfg.lvTo : cfg.lv) - cfg.lv);
}
export function dungeonLevel(cfg, floor = 1) { return Math.max(1, Math.round(dungeonLevelRaw(cfg, floor))); }
export function levelBand(cfg) { return [dungeonLevel(cfg, 1), dungeonLevel(cfg, cfg.floors || 1)]; }

// ===== 奈落の層 (game.js abyssCfg が読む。docs/tasks.md A1) =====
// 奈落は層ごとに ABYSS_LAYER_FLOORS 階。第L層の階は、台帳の第L層の迷宮の顔ぶれ・推奨Lv・強さで組み、
// 層の最後の階 (門番の階) には第L層の主が立つ。台帳にまだ無い層 (第六章から先) は、最後の層から推奨Lv を延ばし、
// 顔ぶれは層の出現表 (bestiary.js LAYER_POOLS) から。第20層の先も、第20層の顔ぶれのまま推奨Lv だけ上がり続ける
export const ABYSS_LAYER_FLOORS = 10;
const _abyssLayers = new Map();
export function abyssLayer(L) {
  L = Math.max(1, Math.floor(L));
  if (_abyssLayers.has(L)) return _abyssLayers.get(L);
  const ds = WORLD.filter((d) => d.layer === L && !d.challenge); // 格上の迷宮 (challenge) は層の物差しに数えない
  let info;
  if (ds.length) {
    // 雑魚の実効の強さの素 = 強さの素 × 手直し (浅階 enemyMul / 深階 ×deepMul) を、その層の迷宮の全階で平均
    let sum = 0, cnt = 0;
    for (const d of ds) for (let f = 1; f <= d.floors; f++) {
      const t = d.tune || {}, deep = f > d.floors / 2;
      sum += powerAt(d, f) * (t.enemyMul || 1) * (deep ? (t.deepMul || 1) : 1); cnt++;
    }
    const coef = sum / cnt;
    const bd = ds.find((d) => d.boss === LAYER_BOSS[L - 1]) || ds.find((d) => d.boss) || null;
    // 推奨Lv は層をまたいで下がらないように、前の層の底から始める (脇道の迷宮で層の幅が重なるため)
    const lvTo = Math.max(...ds.map((d) => d.lvTo));
    const lvFrom = Math.min(lvTo, Math.max(Math.min(...ds.map((d) => d.lv)), L > 1 ? abyssLayer(L - 1).lvTo : 1));
    info = {
      layer: L, lvFrom, lvTo, coef,
      pool: [...new Set(ds.flatMap((d) => d.bands.flat()))],
      elites: [...new Set(ds.flatMap((d) => d.elites || []))],
      boss: LAYER_BOSS[L - 1], bossRank: bd ? bd.bossRank : Math.min(10, L + 2),
      // 門番の強さ = その主の迷宮の最下階の強さ × 主の手直し (台帳の主と同じ手応え)。÷ coef で奈落の強さに対する比にする
      bossRel: bd ? powerAt(bd, bd.floors) * ((bd.tune && bd.tune.bossMul) || 1) / coef : 1.5,
      rank: Math.max(...ds.map((d) => d.rank || 1)), element: LAYER_ELEMENT[L - 1] || "none",
    };
  } else {
    const prev = abyssLayer(L - 1);
    const span = Math.max(4, prev.lvTo - prev.lvFrom);
    const R = Math.min(20, L);
    info = {
      ...prev, layer: L, lvFrom: prev.lvTo, lvTo: prev.lvTo + span,
      pool: L <= 20 && LAYER_POOLS[L] ? [...LAYER_POOLS[L]] : prev.pool,
      elites: L <= 20 ? (LAYER_ELITES[L] || []) : prev.elites,
      boss: LAYER_BOSS[R - 1], bossRank: Math.min(10, R + 2), rank: Math.max(1, Math.ceil(R / 2)),
      element: LAYER_ELEMENT[R - 1] || "none",
    };
  }
  _abyssLayers.set(L, info);
  return info;
}
// 強さの素 (台帳の power) の、その階の値。書いた階の間は直線で結ぶ
export function powerAt(cfg, floor = 1) {
  const pw = cfg && cfg.power;
  if (!pw) return 1;
  const ks = Object.keys(pw).map(Number).sort((a, b) => a - b);
  const f = Math.max(ks[0], Math.min(ks[ks.length - 1], floor || 1));
  for (let i = 1; i < ks.length; i++) {
    const a = ks[i - 1], b = ks[i];
    if (f <= b) return pw[a] + (pw[b] - pw[a]) * (f - a) / (b - a);
  }
  return pw[ks[ks.length - 1]];
}
// その階の敵の強さ (手直し・特別な階・異変を除く): 強さの素 × 推奨Lv の伸び
export function strengthAt(cfg, floor = 1) { return powerAt(cfg, floor) * lvPow(dungeonLevelRaw(cfg, floor)); }


// 検証: id の重複・素体の欠け・出現表の空
{
  const seen = new Set();
  for (const d of WORLD) {
    if (seen.has(d.id)) throw new Error(`world: duplicate id ${d.id}`);
    seen.add(d.id);
    if (!d.bands || !d.bands.length) throw new Error(`world: ${d.id} has no bands`);
    // 敵の種類 = 3 + 5階ごとに3 (帯の数 = 全階数 ÷ 5、最初の帯は6種・以降は3種ずつ)
    const want = Math.ceil(d.floors / BAND_FLOORS);
    if (d.bands.length !== want) throw new Error(`world: ${d.id} needs ${want} bands`);
    d.bands.forEach((b, i) => { if (b.length !== (i === 0 ? 6 : 3)) throw new Error(`world: ${d.id} band ${i} needs ${i === 0 ? 6 : 3} kinds`); });
    const kinds = new Set(d.bands.flat());
    if (kinds.size !== 3 + 3 * want) throw new Error(`world: ${d.id} duplicate kinds in bands`);
    if (!d.unlock) throw new Error(`world: ${d.id} has no unlock`);
    if (!(d.lv >= 1) || !(d.lvTo >= d.lv)) throw new Error(`world: ${d.id} needs lv / lvTo (lvTo >= lv >= 1)`);
    if (!d.power || !(d.power[1] > 0) || !(d.power[d.floors] > 0) || Object.keys(d.power).some((k) => !(+k >= 1 && +k <= d.floors && d.power[k] > 0))) throw new Error(`world: ${d.id} needs power { 1: …, ${d.floors}: … } (階 1〜${d.floors} の正の値)`);
    if (d.unlock.all && !d.unlock.all.every((id) => WORLD_DEF.some((x) => x.id === id))) throw new Error(`world: ${d.id} unlock.all names an unknown dungeon`);
    for (const k of d.bands.flat()) if (!BESTIARY[k]) throw new Error(`world: ${d.id} unknown monster ${k}`);
    if (d.trait) {
      const t = d.trait;
      if (!t.id || !t.name || !Array.isArray(t.lines)) throw new Error(`world: ${d.id} trait needs id/name/lines`);
      for (const k of Object.keys(t)) if (!["id", "name", "sym", "accent", "lines", "mods", "eliteRate", "board", "specialRate", "victoryHeal", "foeRegen", "mpDrain", "hpDrain", "metalRate", "metalMax", "chill", "physOnly", "alwaysAmbush"].includes(k)) throw new Error(`world: ${d.id} trait has unknown field ${k}`);
    }
    for (const k of d.elites || []) if (!BESTIARY[k]) throw new Error(`world: ${d.id} unknown elite ${k}`);
  }
}
