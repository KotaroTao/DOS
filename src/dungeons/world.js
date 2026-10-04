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
//   n / nTo 素体の番号 (旧来の迷宮番号 1-100 と同じ尺度) の1階 / 最下階。罠・毒の床・落とし穴・属性・宝箱と罠のランクの素体と、
//           奈落の推奨Lv の写し (remapLevel) にだけ使う。敵の強さ・戦果・落とし物には使わない
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
//   element 迷宮の属性気配 (省略時は素体 = 層の属性)。雑魚は半分の確率でこの属性を帯びる (掟の elemAll なら全員)
//   trait   迷宮の掟 (その迷宮だけの決まりごと。出撃シートと「階の情報」に出る) — game.js dungeonTrait:
//             name / sym / accent / lines (説明2行)
//             mods     迷宮の異変と同じ効果キー (packMin / soulMul / goldMul / noFlee / chestRankUp / elemAll /
//                      ambushMul / lootBonusLv …)。潜っている間ずっと activeModifierDefs に加わる
//             eliteRate 強敵階の出やすさ (既定 10%)   board  盤面の加工 (game.js TRAIT_BOARD のキー)
//             specialRate 特別な階の出やすさの倍率   victoryHeal 勝つたび隊のHP・MPを回復する割合
//             foeRegen 敵の毎ラウンドの再生 (最大HP比)   mpDrain 戦闘の開幕に吸われる隊のMP (最大MP比)
//             metalRate / metalMax 金属の魔物の出やすさ (既定 7%) / 1階で入れ替わる札の最大数 (既定 1)
//   tune    強さの手直し (generator.js DUNGEON_TUNE と同じ欄)。第4層からはテスト記録がまだ無いので、模擬戦で既存の迷宮に
//           つないだ: 装備なしの6人 (戦士2・侍・僧侶・魔導士・盗賊、魂の Lv = その階の n の物差しの Lv — 当時の推奨Lv。
//           その後 power に写したので、tune の値はそのまま使える) が出現表の雑魚と通常攻撃だけで
//           戦い (本物の combat.js Battle、浅階/深階ごとに150戦)、1戦の被ダメ (隊HP比) を比べる。この物差しで
//           石切り場 ws2 = 浅59%・深54% / 坑口 w05 = 54%・69% (第3層の壁)。第4層は 外郭 55%・59% → 地下牢 54%・63% →
//           大手門 52%・60% (奇襲×2 の分だけ軽め) → 本丸 55%・68% (第4層の壁) / 迷い森 58%・68% に合わせた。
//           第5層 (第三章) は 縦穴 54%・61% → 霧森 55%・60% (特別な階が多い分だけ軽め) / 苗床 54%・60% →
//           大樹 63%・68% (第5層の壁) / 銀の里 54%・63%。
//           掟 (隊伍・奇襲・逃走不可) の重さは模擬戦に入らないので、その分は控えめにしてある。
//           主は「主の強さ ÷ 最下階の雑魚の強さ」(sqrt(HP×ATK)) を坑口の主 2.15 / 水路の主 2.39 の間 (本丸の主 2.30・大樹の主 2.39) に置いた。
//           テスト記録が届いたら実測で合わせ直す
import { DUNGEONS as GENERATED } from "./generator.js";
import { LAYER_BOSS, LAYER_ELITES, BESTIARY } from "./bestiary.js";
import { baselineLv, progressX } from "../baseline.js";
import { lvPow } from "../levelcurve.js";

const WORLD_DEF = [
  {
    id: "w01", n: 1, nTo: 1, lv: 1, lvTo: 3, layer: 1, floors: 5,
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
    id: "w02", n: 2, nTo: 4, lv: 5, lvTo: 10, layer: 1, floors: 10,
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
    id: "w03", n: 4, nTo: 6, lv: 10, lvTo: 17, layer: 1, floors: 15,
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
    id: "w04", n: 6, nTo: 8, lv: 18, lvTo: 21, layer: 2, floors: 10,
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
    hint: "「亡骸の囁く回廊」のどこかに、師の残した印があるという",
  },
  {
    id: "w05", n: 10, nTo: 13, lv: 22, lvTo: 27, layer: 3, floors: 15,
    power: { 1: 0.2799, 5: 0.2868, 10: 0.3072, 15: 0.3208 },
    name: "鎖の垂れる坑口", short: "坑口",
    about: "先代の王が封じた古の坑道。罪人たちの鎖が、今も闇に垂れている",
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
    id: "w06", n: 14, nTo: 16, lv: 27, lvTo: 30, layer: 4, floors: 10,
    power: { 1: 0.2542, 5: 0.2604, 10: 0.2783 },
    name: "亡兵の守る外郭", short: "外郭",
    about: "国境の捨て砦の城壁と兵舎。百年前に死んだ守備隊が、いまも隊伍を組んで持ち場を守る",
    element: null, // 守備隊は人の亡霊。属性の気配は無い (素体の n は第3層の土なので明示する)
    bands: [
      ["bs_pikewall", "bs_bannerwraith", "bs_drumwraith", "d03_sentinel", "bs_darksamurai", "bs_ironknight"],
      ["bs_gravecaptain", "bs_siegeballista", "d04_revenant"],
    ],
    elites: ["el_warbanner"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "ranks", name: "隊伍を組む亡兵", sym: "⚔", accent: "#c9a26a",
      lines: ["亡兵は持ち場を離れず、つねに三体以上の隊伍で現れる (旗手・鼓手・槍ぶすまが組む)。", "数は多いが、討てば得られる ✦Soul が 1.25倍。"],
      mods: { packMin: 3, soulMul: 1.25 },
    },
    tune: { enemyMul: 0.62, deepMul: 0.88, soloMul: 0.95 }, // 隊伍 (つねに3体以上) の分だけ1体ずつは軽く
    unlock: { reported: "w05" },
    hint: "「鎖の垂れる坑口」の踏破を王に報告すると、捨て砦の封が解かれる",
  },
  {
    id: "w07", n: 15, nTo: 17, lv: 31, lvTo: 33, layer: 4, floors: 10,
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
    hint: "「亡兵の守る外郭」の当直簿に、地下牢の鍵の在処が記されているという",
  },
  {
    id: "w08", n: 16, nTo: 18, lv: 34, lvTo: 36, layer: 4, floors: 10,
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
    id: "w09", n: 17, nTo: 20, lv: 37, lvTo: 41, layer: 4, floors: 15,
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
  // ---- 第三章「管の根」(第5層の顔ぶれ) ── 本丸の大穴の下。魂を吸う「管」は、地の底の大樹の根だった ----
  {
    id: "w10", n: 20, nTo: 22, lv: 41, lvTo: 43, layer: 5, floors: 10,
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
    tune: { enemyMul: 0.72, deepMul: 0.76, soloMul: 1.05 }, // 落とし穴で階を飛ばされる分、深階はやや重い
    unlock: { reported: "w09" },
    hint: "「捨て砦の本丸」の踏破を王に報告すると、大穴へ降りる許しが出る",
  },
  {
    id: "w11", n: 21, nTo: 23, lv: 44, lvTo: 46, layer: 5, floors: 10,
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
    tune: { enemyMul: 0.62, deepMul: 0.82, soloMul: 1.05 }, // 特別な階 (瘴気・群れ) が2倍出る分だけ軽め
    unlock: { story: "w10_rope" },
    hint: "「根の這う縦穴」のどこかに、師の残した綱が垂れているという",
  },
  {
    id: "w12", n: 22, nTo: 24, lv: 46, lvTo: 48, layer: 5, floors: 10,
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
    tune: { enemyMul: 0.76, deepMul: 0.82, soloMul: 1.05 }, // 敵の再生と勝利ごとの回復でおおむね相殺
    unlock: { reported: "w10" },
    hint: "「根の這う縦穴」の踏破を王に報告すると、根の行き着く先が示される",
  },
  {
    id: "w13", n: 23, nTo: 26, lv: 49, lvTo: 52, layer: 5, floors: 15,
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
    tune: { enemyMul: 0.68, deepMul: 0.80, soloMul: 1.10, bossMul: 0.52 }, // 第5層の壁。開幕にMPを吸われる。主 (ランク7・全体呪文と招来) は雑魚比を本丸の主並み (2.4) に
    unlock: { all: ["w11", "w12"] },
    hint: "「地の底の霧森」と「樹液の苗床」の両方を踏破して王に報告すると、大樹の根元への道が開く",
  },
  // ---- 依頼の迷宮 (酒場の固定クエストを受けると地図に現れる) ----
  {
    id: "ws1", n: 7, nTo: 9, lv: 20, lvTo: 23, layer: 2, floors: 10, side: true,
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
    id: "ws2", n: 12, nTo: 14, lv: 24, lvTo: 28, layer: 3, floors: 10, side: true,
    power: { 1: 0.2704, 5: 0.2908, 7: 0.3064, 8: 0.3003, 10: 0.3062 },
    name: "石眠りの石切り場", short: "石切り場",
    about: "王都の城壁を切り出した古い石切り場。鉱夫たちは鑿を握ったまま石になった",
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
    id: "ws3", n: 18, nTo: 21, lv: 37, lvTo: 42, layer: 5, floors: 10, side: true,
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
    tune: { enemyMul: 0.80, deepMul: 0.76, soloMul: 1.00 }, // 第5層の顔ぶれ (ランク6-7) を本丸並みに
    unlock: { quest: "fq_wren" },
    hint: "酒場の猟師の依頼「霧に呑まれた娘」を受けると、道が示される",
  },
  {
    id: "ws4", n: 20, nTo: 23, lv: 41, lvTo: 45, layer: 5, floors: 10, side: true,
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
    tune: { enemyMul: 0.92, deepMul: 0.76, soloMul: 1.05 },
    unlock: { quest: "fq_zakka2" },
    hint: "酒場の行商人の依頼「銀の欠片の行方」を受けると、道が示される",
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
// 「n の物差しの Lv」(naturalLevel) は旧来の推奨Lv: 基準の隊 (baseline.js) の Lv を ×LV_EST で縮めた曲線。
// いまは奈落 (台帳の外の素体) の推奨Lv の写し (remapLevel) と、その敵の強さにだけ使う。台帳の迷宮の強さは power (B1)
export const LV_EST = 0.78;
const estLv = (v) => 1 + (v - 1) * LV_EST;
// n の物差しの Lv (小数)。台帳の迷宮は1階 = n の入口 → 最下階 = nTo の入口〜奥へ、階に沿ってなめらかに上がる
export function naturalLevelRaw(cfg, floor = 1) {
  if (!cfg) return 1;
  const n = cfg.n || 1, floors = cfg.floors || 1;
  if (cfg.nTo != null) {
    const t = floors > 1 ? (Math.max(1, floor) - 1) / (floors - 1) : 0;
    const x = (n - 1) + t * (cfg.nTo - n + (floors >= 10 ? 0.6 : 0.5));
    return Math.max(1, estLv(baselineLv(x)));
  }
  return Math.max(1, estLv(baselineLv(progressX(n, floor, floors))));
}
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

// 素体 (generateDungeon(n)) に台帳の欄を重ねて、迷宮の設定を組み立てる
function build(def) {
  const base = GENERATED[def.n - 1];
  const cfg = { ...base, ...def };
  // 出現表: 帯をまとめて浅階 (最初の帯) / 深階 (以降の帯) にも写す (図鑑・逃走の物差しなどが全体を見る)
  cfg.pool = [...def.bands[0]];
  cfg.deepPool = def.bands.length > 1 ? def.bands.slice(1).flat() : [...def.bands[0]];
  cfg.tune = def.tune ? { ...def.tune } : null;
  cfg.power = { ...def.power };
  // 落とし物の帯は推奨Lv の1階 (lv) から最下階 (lvTo) まで広がる (game.js が階の深さで帯の中を補間する)
  cfg.lootLv = lootBand(def.lv, def.lvTo);
  // 階ごとの強さの上がり幅は power (階ごとの値) に含めてある (B1)。素体の floorRamp は奈落だけが使う
  delete cfg.floorRamp;
  delete cfg.enemyScale; // 素体の強さ倍率も power に写した (台帳の迷宮では読まない)
  cfg.elites = def.elites || LAYER_ELITES[def.layer] || [];
  cfg.boss = def.boss || null;
  cfg.bossRank = def.boss ? (def.bossRank || base.bossRank || def.layer + 2) : 0;
  cfg.gates = true; // 5階ごとの帰還魔法陣 (奈落は素体を使うので従来どおり)
  // 落とし穴は最下階には無い (board.js)。第1層の迷宮には出さない (素体の n で決まる)
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

// 台帳の外 (奈落の素体) の推奨Lv: n の物差しの Lv を、本筋の迷宮の「n の物差しの Lv → 推奨Lv」の対応で写す。
// 本筋の最後の迷宮より先は、その最下階の比 (推奨Lv ÷ n の物差しの Lv) のまま延ばす
let _remap = null;
function remapPoints() {
  if (_remap) return _remap;
  const pts = [];
  for (const d of WORLD) {
    if (d.side) continue;
    pts.push({ a: naturalLevelRaw(d, 1), b: d.lv }, { a: naturalLevelRaw(d, d.floors), b: d.lvTo });
  }
  pts.sort((p, q) => p.a - q.a || p.b - q.b);
  for (let i = 1; i < pts.length; i++) pts[i].b = Math.max(pts[i].b, pts[i - 1].b);
  _remap = pts;
  return pts;
}
export function remapLevel(nat) {
  const pts = remapPoints();
  if (!pts.length) return nat;
  const first = pts[0], last = pts[pts.length - 1];
  if (nat <= first.a) return Math.max(1, first.b * nat / Math.max(1, first.a));
  if (nat >= last.a) return last.b * nat / last.a;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    if (nat <= q.a) return q.a > p.a ? p.b + (q.b - p.b) * (nat - p.a) / (q.a - p.a) : q.b;
  }
  return last.b;
}
// 迷宮のLv (その階の敵のLv・推奨Lv)。台帳の迷宮は lv → lvTo を階で補間、それ以外は remapLevel
export function dungeonLevelRaw(cfg, floor = 1) {
  if (!cfg) return 1;
  if (cfg.lv != null) {
    const floors = cfg.floors || 1;
    const t = floors > 1 ? Math.min(1, (Math.max(1, floor) - 1) / (floors - 1)) : 0;
    return cfg.lv + t * ((cfg.lvTo != null ? cfg.lvTo : cfg.lv) - cfg.lv);
  }
  return remapLevel(naturalLevelRaw(cfg, floor));
}
export function dungeonLevel(cfg, floor = 1) { return Math.max(1, Math.round(dungeonLevelRaw(cfg, floor))); }
export function levelBand(cfg) { return [dungeonLevel(cfg, 1), dungeonLevel(cfg, cfg.floors || 1)]; }
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
    if (!GENERATED[d.n - 1]) throw new Error(`world: ${d.id} n=${d.n} has no base`);
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
      for (const k of Object.keys(t)) if (!["id", "name", "sym", "accent", "lines", "mods", "eliteRate", "board", "specialRate", "victoryHeal", "foeRegen", "mpDrain", "metalRate", "metalMax"].includes(k)) throw new Error(`world: ${d.id} trait has unknown field ${k}`);
    }
    for (const k of d.elites || []) if (!BESTIARY[k]) throw new Error(`world: ${d.id} unknown elite ${k}`);
  }
}
