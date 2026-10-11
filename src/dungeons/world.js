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
//           (罠・足元の仕掛け・まだあたたかい死体の頻度も推奨Lv から — 下の hazardsAt。旧来の素体の番号 n は 2026-10 の A1 で廃止)
//   floorHaz 足元の仕掛け { fall: 落ちる床, harm: 蝕む床 } (src/dungeons/floorhaz.js の名。置かないなら null)。迷宮の土地に合わせて
//           選ぶ (墓所に沼は置かない…)。出撃画面の「足元」・盤面の絵・踏んだ時の言葉がこれで決まる。新しい迷宮では必ず決める
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
//             foeRegen 敵の毎ターンの再生 (最大HP比)   mpDrain 戦闘の開幕に吸われる隊のMP (最大MP比)
//             hpDrain 戦闘の開幕に隊が失うHP (最大HP比。HP1 より下にはならない)
//             metalRate / metalMax 金属の魔物の出やすさ (既定 7%) / 1階で入れ替わる札の最大数 (既定 1)
//             chill    戦闘の開幕に隊の全員の AGI を何段下げるか (3ターン。凍てつく大回廊)
//             physOnly 魔封じ: 隊は物理技と道具のほかの技 (呪文・回復・強化・弱体・迷宮の術) を使えない (沈んだ書庫)
//             alwaysAmbush どの戦闘も必ず奇襲で始まる (主の戦いは除く。白狼の吹き溜まり)
//             poisonStart 戦闘の開幕に、隊の一人ひとりがこの確率で毒に冒される (毒の耐性で防げる。よどみの底)
//             boltStart 戦闘の開幕に隊の一人へ雷が落ち、最大HPのこの割合を焼く (ブレス耐性で和らぐ。HP1 は残る。嵐の尖塔の頂)
//             allHaste 敵はみな神速 (ターンの頭に動き、後半にもう一度動く。主は除く。雷鳥の巣)
//             foeRally 戦闘の開幕に、敵全体の攻撃をこの段数だけ上げる (3ターン。主・金属の魔物は除く。闘獣の檻)
//             fervor   高まる戦意: 2ターン目から毎ターンの頭に、敵味方とも生きている者すべての攻撃が1段上がる (+3段まで。血の砂の闘技場)
//             duel     一騎打ち: 魔物の札の戦闘は必ず1体だけ。その1体は強敵並みに強く、戦果も群れの分だけ持つ (決闘の小円形場)
//             foeRise  起き上がる濁り魂: 倒れた敵 (主・金属の魔物を除く) は戦闘ごとに一度だけ、最大HPのこの割合で起き上がる (灯籠の吹き溜まり)
//             whisper  ささやく湖面: 戦闘の開幕に隊の一人がささやきに惑わされ、この確率で混乱する (混乱の抵抗で防げる。黒い灯の地底湖)
//             shell    封じの殻: 戦闘の開幕に、主・金属の魔物を除く敵の全員に障壁 (打撃を1回だけ防ぐ) をこの回数だけ張る (名を刻む石窟)
//             soulFeast 魂喰らいの闇: 人業を倒した敵は攻撃がこの段数だけ上がる (3ターン。底なしの大伽藍)
//             oneChest 巨獣の宝: 宝箱は1階に1つだけ (足りなければ置く)。中身のランクは mods.chestRankUp で上げる (大空洞の主の寝床)
//             sealedGate ★閉ざされた門: 帰還魔法陣が無く、帰還の鈴も使えない。最下階に着くか全滅するまで出られない (化石竜の墓所)
//             appraised 澄んだ水晶の光: この迷宮で拾う品は、はじめから鑑定済み (水晶の鉱脈)
//             say      開幕の効果 (mpDrain / hpDrain / chill / poisonStart / boltStart) を戦闘の記録に書く時の一文
//             audience 見世物の闘技場: 戦闘の開幕に観客の注文がひとつ出て、応えて勝てば ✦Soul・金貨が増える (game.js AUDIENCE_ORDERS。闘技場跡)
//             gloom    底なしの闇: 戦闘の開幕に隊の全員の命中が下がる (物理が外れる率をこの分だけ足す。3ターン。地底大空洞)
//           say は文字列か、開幕の効果を2つ持つ時は効果ごとの文 ({ mpDrain: "…", chill: "…" })
//           掟は1つの迷宮に1つだけ (ユーザーの指示、2026-10-11: 土地の掟は迷宮の掟に統合した)。同じ土地の迷宮は気候の効果
//           (灼熱 = hpDrain 0.06 / 酷寒 = chill 1 / 闘技場 = audience / 地の底 = gloom 0.15) を、その迷宮の掟の1行として持つ。
//           「技が一切使えない」「物理が効かない」「魔法が効かない」のような強い掟は、格上 (challenge) の迷宮だけに付ける
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
//           2026-10 第5層の初めての実測 (縦穴 w10、推奨Lv どおりの Lv40-44 の6人、装備・サブ魂あり): 通常戦が平均1.4ターンで終わり
//           被ダメは1戦 約1% (隊は1ターンに約1500与え、敵の大半は動く前に倒れる)。推奨Lv どおりの隊で測った外郭 w06 (2.5R・8.7%) や
//           坑口 w05 (2.1〜2.6R・7%) と比べて桁違いに軽い。模擬戦は第5層の特色 (多用・神速・ブレス) を重く見たが、実戦では出る前に倒れる。
//           そこで第5層の顔ぶれの6迷宮 (w10-w13・ws3・ws4) の雑魚 (enemyMul) と大樹の主 (bossMul、雑魚比 2.3 を保つ) を一律 ×5/3。
//           目安は通常戦 2〜2.5R・1戦 7〜9%。強敵 (soloMul) は実測 14% で妥当なのでそのまま
//           第6層・第7層 (第四章・第五章) はテスト記録がまだ無いので、第5層の実測後の値 (×5/3 の後) を物差しに、
//           出現表の雑魚の sqrt(HP×ATK) × 強さ × 手直し が推奨Lv に沿ってなだらかに伸びるよう (第5層の伸び Lv^1.19、
//           層の入口で 1割の段差) 合わせた。掟の重さ (群れ・奇襲・開幕の熱気・逃走不可) の分は控えめ。主は雑魚比 2.35〜2.4。
//           テスト記録が届いたら実測で合わせ直す
//           第8層 (第六章) は、強さの素を第五章の同じ並びの迷宮の 0.9倍 (第四章 → 第五章と同じ層の段差) にし、手直しも第五章に倣った。
//           顔ぶれのランクが 9〜10 に上がった分は monStats が持つので、これもテスト記録で測り直す
//           第9層 (第七章) も同じく第六章の 0.9倍。顔ぶれはランク10 (上限) にそろえた。テスト記録で測り直す
//           第10層 (第八章) も第七章の 0.9倍。寄り道の雷鳥の巣 (敵はみな神速) は二度動く分だけ強さの素を約2割下げた。テスト記録で測り直す
//           第11層 (第九章) も第八章の 0.9倍。第一部の最後から2つ目の層なので壁 (第二部) はまだ掛からない。テスト記録で測り直す
//           第12層 (第十章) も第九章の 0.9倍。第一部の最後の層。主は宰相モルデン (層の主 bs_cavernlord は寄り道の寝床の主)。テスト記録で測り直す
import { LAYER_ELEMENT } from "./generator.js";
import { LAYER_BOSS, LAYER_ELITES, LAYER_POOLS, BESTIARY } from "./bestiary.js";
import { baselineLv } from "../baseline.js";
import { lvPow } from "../levelcurve.js";
import { FLOOR_HAZ } from "./floorhaz.js";

const WORLD_DEF = [
  {
    id: "w01", lv: 1, lvTo: 3, layer: 1, floors: 5,
    floorHaz: { fall: null, harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.7, 5: 0.868 },
    name: "忘れられた地下墓地", short: "地下墓地",
    about: "ロアダルの墓所の下。師オルドが最後に降りたと伝わる",
    bands: [
      ["bs_bonebat", "bs_carrioncrow", "bs_corpsemaggot", "bs_grasphand", "bs_gravewisp", "bs_bonepile"],
    ],
    unlock: { start: true },
    hint: "序章で三体の人業を仕立てると、王が在処を明かす",
  },
  {
    id: "w02", lv: 5, lvTo: 10, layer: 1, floors: 10,
    floorHaz: { fall: null, harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.598, 3: 0.5934, 5: 0.5292, 7: 0.5063, 8: 0.4751, 10: 0.4773 },
    name: "亡骸の囁く回廊", short: "囁く回廊",
    about: "墓地の奥へ続く長い回廊。壁の向こうから、死者のささやきが漏れてくる",
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
    floorHaz: { fall: null, harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.41, 4: 0.4165, 5: 0.4011, 6: 0.3663, 7: 0.356, 10: 0.3619, 12: 0.3522, 15: 0.3685 },
    name: "朽ちた骸の修道院", short: "骸の修道院",
    about: "死者を弔い続けた修道士たちが、骸になってなお祈る修道院。最下階に骸の修道院長が待つ",
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
    floorHaz: { fall: "grate", harm: "sewage" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.3004, 5: 0.3235, 10: 0.3647 },
    name: "黒水の取水口", short: "取水口",
    about: "ロアダルの水を取り入れる古い取水口。その底を、黒い水が遠く王都の方角へ流れている。水に触れた者は影が薄くなるという",
    bands: [
      ["bs_bloatfly", "bs_fogspecter", "bs_giantleech", "bs_ratking", "bs_razorshrimp", "bs_sewercrab"],
      ["bs_mucusworm", "bs_toxictoad", "bs_drownedcorpse"],
    ],
    elites: ["el_bloatqueen"], // 名のある強敵の縄張り (named.js)
    tune: { enemyMul: 1.40, deepMul: 0.87, soloMul: 0.85 }, // DUNGEON_TUNE の D7 (改定後の表)
    unlock: { story: "w02_sigil" },
    hint: "「亡骸の囁く回廊」のB4Fに、師の残した印があるという",
  },
  {
    id: "w05", lv: 22, lvTo: 27, layer: 3, floors: 15,
    floorHaz: { fall: "mineshaft", harm: "minegas" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.2799, 5: 0.2868, 10: 0.3072, 15: 0.3208 },
    name: "鎖の垂れる坑口", short: "坑口",
    about: "王家が封じた古い坑道。罪人をつないだ鎖が、いまも闇に垂れている",
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
    floorHaz: { fall: "collapse", harm: "caltrop" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["亡兵は持ち場を離れず、つねに三体以上の隊列で現れる (旗手・鼓手・槍ぶすまが組む)。", "数は多いが、得る ✦Soul は 1.25倍。"],
      mods: { packMin: 3, soulMul: 1.25 },
    },
    tune: { enemyMul: 0.62, deepMul: 0.88, soloMul: 0.95 }, // 隊列 (つねに3体以上) の分だけ1体ずつは軽く
    unlock: { reported: "w05" },
    hint: "「鎖の垂れる坑口」の踏破を王に報告すると、捨て砦の封が解かれる",
  },
  {
    id: "w07", lv: 31, lvTo: 33, layer: 4, floors: 10,
    floorHaz: { fall: "oubliette", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["獄の扉は内から開かない。この迷宮の戦闘からは逃げられない。", "獄死した囚人の骸が各階に2つ増える (半分はまだあたたかい)。押収品の宝箱は1ランク上等。"],
      mods: { noFlee: true, chestRankUp: 1 },
      board: "prison",
    },
    tune: { enemyMul: 1.25, deepMul: 0.78, soloMul: 0.95 },
    unlock: { story: "w06_roll" },
    hint: "「亡兵の守る外郭」の当直簿に、地下牢の鍵のありかが記されているという",
  },
  {
    id: "w08", lv: 34, lvTo: 36, layer: 4, floors: 10,
    floorHaz: { fall: "collapse", harm: "caltrop" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.2321, 5: 0.2483, 10: 0.2667 },
    name: "雷雨の大手門", short: "大手門",
    about: "寄せ手を最後まで拒んだ砦の正門。あの日の雷雨はいまも止まず、討ち死にした両軍の亡者が門を奪い合う",
    element: "wind",
    bands: [
      ["bs_bloodorc", "bs_darksamurai", "bs_thunderknight", "bs_bannerwraith", "bs_siegeballista", "bs_cultist"],
      ["bs_stormgiant", "bs_bonecolossus", "bs_gravecaptain"],
    ],
    elites: ["el_warbanner"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "storm", name: "止まぬ雷雨", sym: "⚡", accent: "#9ab8ff",
      lines: ["雷雨が門を叩き続け、魔物はみな風 (雷) の気を帯びる。火の刃が通り、火の守りが雷を和らげる。", "雷鳴に足音が紛れ、奇襲を受けやすい (×2)。戦場に散った遺品で、得る金貨は 1.3倍。"],
      mods: { elemAll: true, ambushMul: 2, goldMul: 1.3 },
    },
    tune: { enemyMul: 1.02, deepMul: 0.85, soloMul: 1.00 }, // 奇襲 ×2 の分だけ控えめ
    unlock: { reported: "w06" },
    hint: "「亡兵の守る外郭」の踏破を王に報告すると、正門への道が示される",
  },
  {
    id: "w09", lv: 37, lvTo: 41, layer: 4, floors: 15,
    floorHaz: { fall: "collapse", harm: "caltrop" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["将の亡霊が階ごとに陣を敷く。強敵の気配のする階が多い (B3F以降 30%)。", "将の遺品で、落ちている装備の質が少し上がる。"],
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
    floorHaz: { fall: "roothole", harm: "spore" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["縦穴の足場は脆い。各階に根の穴が2つ増える (最下階を除く)。落ちても傷は負わないが、その階の残りは探れない。", "壁の根に、落ちた者たちの遺品が絡まっている (各階に宝箱が1つ増える)。"],
      board: "shaft",
    },
    tune: { enemyMul: 1.20, deepMul: 0.76, soloMul: 1.05 }, // 根の穴で階を飛ばされる分、深階はやや重い。2026-10 実測で 0.72 → 1.20 (上の注記)
    unlock: { reported: "w09" },
    hint: "「捨て砦の本丸」の踏破を王に報告すると、大穴へ降りる許しが出る",
  },
  {
    id: "w11", lv: 44, lvTo: 46, layer: 5, floors: 10,
    floorHaz: { fall: "roothole", harm: "spore" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["霧が森の姿を変え続ける。特別な階がとても出やすい (ふだんの2倍・およそ3階に2階)。", "豊穣の間か、瘴気の階か、ミミックの巣か。何が出るかは霧しだい。"],
      specialRate: 2,
    },
    tune: { enemyMul: 1.03, deepMul: 0.82, soloMul: 1.05 }, // 特別な階 (瘴気・群れ) が2倍出る分だけ軽め
    unlock: { story: "w10_rope" },
    hint: "「根の這う縦穴」のどこかに、師の残した綱が垂れているという",
  },
  {
    id: "w12", lv: 46, lvTo: 48, layer: 5, floors: 10,
    floorHaz: { fall: "roothole", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["樹液の香りが満ちている。戦闘に勝つたび、隊のHP・MPが最大の8%回復する。", "魔物もまた樹液を吸う。敵はすべて、毎ターン最大HPの3%ずつ再生する。"],
      victoryHeal: 0.08, foeRegen: 0.03,
    },
    tune: { enemyMul: 1.27, deepMul: 0.82, soloMul: 1.05 }, // 敵の再生と勝利ごとの回復でおおむね相殺
    unlock: { reported: "w10" },
    hint: "「根の這う縦穴」の踏破を王に報告すると、根の行き着く先が示される",
  },
  {
    id: "w13", lv: 49, lvTo: 52, layer: 5, floors: 15,
    floorHaz: { fall: "roothole", harm: "rootsuck" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.2006, 5: 0.2098, 10: 0.2206, 15: 0.2306 },
    name: "魂喰らいの大樹", short: "大樹",
    about: "百の迷宮から魂を吸い上げる大樹の根元。幹は地の底を、さらに上へと這い上がっている",
    element: null,
    bands: [
      ["bs_thornhound", "bs_stranglevine", "bs_chimera", "bs_giantowl", "bs_thunderbird", "bs_direboar"],
      ["bs_misttreant", "bs_willowwitch", "bs_griffon"],
      ["bs_corruptstag", "bs_mossgolem", "bs_fogpanther"],
    ],
    trait: {
      id: "roots", name: "魂を吸う根", sym: "ψ", accent: "#c070a0",
      lines: ["根が足元で脈打つ。戦闘が始まるたび、隊のMPが最大の5%吸われる。", "吸われた魂の名残が漂い、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      mpDrain: 0.05, say: "足元の根が脈打ち、隊の魔力を吸い上げた", // 1割は吸われすぎ (2026-10 ユーザーの指示)
    },
    boss: LAYER_BOSS[4], bossRank: 7,
    tune: { enemyMul: 1.13, deepMul: 0.80, soloMul: 1.10, bossMul: 0.87 }, // 第5層の壁。開幕にMPを吸われる。主 (ランク7・全体呪文と招来) は雑魚比を本丸の主並み (2.4) に
    unlock: { all: ["w11", "w12"] },
    hint: "「地の底の霧森」と「樹液の苗床」の両方を踏破して王に報告すると、大樹の根元への道が開く",
  },
  // ---- 第四章「王都の地下」(第6層の顔ぶれ) ── 大樹の幹が昇る王都の足元。三百年前に沈んだ旧都と、その大神殿 ----
  {
    id: "w14", lv: 52, lvTo: 54, layer: 6, floors: 10,
    floorHaz: { fall: "sunken", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.192, 5: 0.2067, 10: 0.2235 },
    name: "水底の参道", short: "参道",
    about: "大樹の幹をたどって着いた、王都のはるか地下。三百年前に沈んだ旧都の参道が、灯籠を連ねて水の底へ続いている",
    element: "water",
    bands: [
      ["bs_kelpdrowned", "bs_abyssjelly", "bs_fonthorror", "bs_drownedpriest", "bs_naga", "bs_choirwraith"],
      ["bs_tidecaller", "bs_sunkenbell", "bs_soulharvester"],
    ],
    elites: ["el_heresiarch"], // 名のある強敵の縄張り (named.js)
    trait: {
      id: "offering", name: "沈んだ供物", sym: "⚱", accent: "#5aa0c8",
      lines: ["参道には、沈む前に捧げられた供物が残っている (各階に宝箱が2つ増える)。", "供物のふりをした魔物も多い。宝箱の3割は、供物にすり替わったミミックだ。"],
      mods: { mimicRate: 0.30 },
      board: "offering",
    },
    tune: { enemyMul: 1.20, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w13" },
    hint: "「魂喰らいの大樹」の踏破を王に報告すると、幹の行き着く先への道が示される",
  },
  {
    id: "w15", lv: 54, lvTo: 56, layer: 6, floors: 10,
    floorHaz: { fall: "sunken", harm: "holywater" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["溺れた聖歌隊の歌が響き続け、魔物はみな光の気を帯びる。闇の刃が通り、闇の守りが光を和らげる。", "歌に引かれて集まった魂は多く、得る ✦Soul は 1.3倍。"],
      mods: { elemAll: true, soulMul: 1.3 },
    },
    tune: { enemyMul: 1.12, deepMul: 0.82, soloMul: 1.05 }, // 属性が揃う分 (闇の刃で通る) だけ重め
    unlock: { story: "w14_lamp" },
    hint: "「水底の参道」の灯籠のどこかに、師の残したものがあるという",
  },
  {
    id: "w16", lv: 56, lvTo: 58, layer: 6, floors: 10,
    floorHaz: { fall: "sunken", harm: "holywater" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.185, 5: 0.1997, 10: 0.2166 },
    name: "洗礼の大水槽", short: "大水槽",
    about: "王が冠を受ける前に身を清めた、旧都の洗礼の水槽。いまは大樹の根が水を吸い、底は暗い",
    element: "water",
    bands: [
      ["bs_abyssjelly", "bs_naga", "bs_fonthorror", "bs_kelpdrowned", "bs_tidecaller", "bs_irongolem"],
      ["bs_sunkenbell", "bs_voidwalker", "bs_shadowdragon"],
    ],
    elites: ["el_heresiarch"],
    trait: {
      id: "font", name: "洗礼の水", sym: "✧", accent: "#8ad0e8",
      lines: ["水槽のあちこちに、まだ澄んだ洗礼の水が湧いている (各階に癒しの泉が2つ)。", "濁った水の底から、何かが足をつかむ。奇襲を受けやすい (×1.5)。"],
      mods: { ambushMul: 1.5 },
      board: "font",
    },
    tune: { enemyMul: 1.10, deepMul: 0.80, soloMul: 1.05 }, // 泉で立て直せる分だけ重め
    unlock: { reported: "w14" },
    hint: "「水底の参道」の踏破を王に報告すると、旧都の洗礼の場が示される",
  },
  {
    id: "w17", lv: 58, lvTo: 61, layer: 6, floors: 15,
    floorHaz: { fall: "sunken", harm: "holywater" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    floorHaz: { fall: "fissure", harm: "scorch" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["地割れから火が噴き出し、通路の一割ほどが灼けた床になる (浮遊で避けられる)。", "割れ目から吹き上げる熱風が肌を焼く。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。", "火に追われた魂が多く、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "vent",
      hpDrain: 0.06, say: "吹き上げる熱風が肌を焼いた",
    },
    tune: { enemyMul: 1.08, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w17" },
    hint: "「沈める大神殿」の踏破を王に報告すると、神殿の底へ降りる許しが出る",
  },
  {
    id: "w19", lv: 63, lvTo: 65, layer: 7, floors: 10,
    floorHaz: { fall: "fissure", harm: "hotash" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["降りしきる灰が視界を覆い、奇襲を受けやすい (×2)。", "灰まじりの熱気が喉を焼く。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。", "灰には焼かれた魂の名残が混じり、得る ✦Soul は 1.3倍。"],
      mods: { ambushMul: 2, soulMul: 1.3 },
      hpDrain: 0.06, say: "灰まじりの熱気が喉を焼いた",
    },
    tune: { enemyMul: 1.02, deepMul: 0.85, soloMul: 1.05 }, // 奇襲 ×2 の分だけ控えめ
    unlock: { story: "w18_blade" },
    hint: "「火を噴く地割れ」のどこかに、師の刃が残されているという",
  },
  {
    id: "w20", lv: 65, lvTo: 67, layer: 7, floors: 10,
    floorHaz: { fall: "fissure", harm: "broth" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1667, 5: 0.1799, 10: 0.1951 },
    name: "魂を煮る釜場", short: "釜場",
    about: "大樹の樹液を煮詰めて霊薬に変える釜が、いくつも並ぶ。釜の火は、迷宮にのまれた魂でできている",
    element: "fire",
    bands: [
      ["bs_lavagolem", "bs_magmaslime", "bs_brimstonegolem", "bs_furnacefiend", "bs_obsidianguard", "bs_magmaray"],
      ["bs_basaltdrake", "bs_infernaltyrant", "bs_lavamaw"],
    ],
    elites: ["el_magmawyrm"],
    trait: {
      id: "cauldron", name: "煮えたぎる釜", sym: "♆", accent: "#f0a040",
      lines: ["釜の霊薬を浴びた魔物は、毎ターン最大HPの3%ずつ再生する。", "煮えたぎる釜の湯気が肌を焼く。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。", "釜の縁に霊薬のかすが固まっていて、得る金貨は 1.4倍。"],
      mods: { goldMul: 1.4 },
      foeRegen: 0.03,
      hpDrain: 0.06, say: "煮えたぎる釜の湯気が肌を焼いた",
    },
    tune: { enemyMul: 0.90, deepMul: 0.82, soloMul: 1.05 }, // 開幕の熱気の分だけ控えめ
    unlock: { reported: "w18" },
    hint: "「火を噴く地割れ」の踏破を王に報告すると、火の洞の奥が示される",
  },
  {
    id: "w21", lv: 67, lvTo: 70, layer: 7, floors: 15,
    floorHaz: { fall: "fissure", harm: "scorch" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.163, 5: 0.1705, 10: 0.1793, 15: 0.1874 },
    name: "業火の大釜", short: "大釜",
    about: "火の洞の底の大釜。三百年、魂の樹液を煮詰め続けてきた。釜の下には、底の見えない穴が口を開けている",
    element: "fire",
    bands: [
      ["bs_obsidianguard", "bs_furnacefiend", "bs_pyrelich", "bs_demon", "bs_flamedrake", "bs_lavagolem"],
      ["bs_basaltdrake", "bs_darkliege", "bs_shadowogre"],
      ["bs_infernaltyrant", "bs_doombringer", "bs_hellhound"],
    ],
    trait: {
      id: "inferno", name: "業火の大釜", sym: "♨", accent: "#ff6030",
      lines: ["大釜の業火は退路を焼く。この迷宮の戦闘からは逃げられない。魔物はみな火の気を帯びる (水の刃が通り、水の守りが火を和らげる)。", "大釜の業火の照り返しが肌を焼く。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。", "煮詰められた魂の名残で、得る ✦Soul は 1.4倍。"],
      mods: { noFlee: true, elemAll: true, soulMul: 1.4 },
      hpDrain: 0.06, say: "大釜の業火の照り返しが肌を焼いた",
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
    floorHaz: { fall: "icecrack", harm: "frost" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["奈落から吹き上げる風が氷棚を削り、各階に氷の割れ目が3つ増える (最下階を除く。浮遊で避けられる)。", "吹き上げる風が体の芯まで冷やす。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "落ちてきた魂が棚に吹き寄せられ、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "ledge",
      chill: 1, say: "吹き上げる風に、体の芯まで冷えた",
    },
    tune: { enemyMul: 1.08, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w21" },
    hint: "「業火の大釜」の踏破を王に報告すると、大釜の下の穴へ降りる許しが出る",
  },
  {
    id: "w23", lv: 72, lvTo: 74, layer: 8, floors: 10,
    floorHaz: { fall: "icecrack", harm: "frost" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["氷の柱の根元に、凍った骸が眠っている (各階に死体が2つ増える。3割はまだあたたかい)。", "氷の柱が放つ冷気に身がすくむ。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "凍りついた魂は傷みが少なく、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      board: "icetomb",
      chill: 1, say: "氷の柱が放つ冷気に身がすくむ",
    },
    tune: { enemyMul: 1.02, deepMul: 0.84, soloMul: 1.05 },
    unlock: { story: "w22_coat" },
    hint: "「奈落の氷棚」のどこかに、師の残したものが凍りついているという",
  },
  {
    id: "w24", lv: 74, lvTo: 76, layer: 8, floors: 10,
    floorHaz: { fall: "icecrack", harm: "frost" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["天井の極光が魔物の気を揺らし、魔物の属性がでたらめに定まる。", "氷窟の底冷えに身がすくむ。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "極光に照らされた氷の中に古い金貨が光り、得る金貨は 1.35倍。"],
      mods: { elemRandom: true, goldMul: 1.35 },
      chill: 1, say: "氷窟の底冷えに身がすくむ",
    },
    tune: { enemyMul: 0.96, deepMul: 0.84, soloMul: 1.05 }, // 属性が読めない分だけ控えめ
    unlock: { reported: "w22" },
    hint: "「奈落の氷棚」の踏破を王に報告すると、氷棚の奥の洞窟が示される",
  },
  {
    id: "w25", lv: 76, lvTo: 79, layer: 8, floors: 15,
    floorHaz: { fall: "icecrack", harm: "frost" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["絶対零度の冷気が骨までしみる。戦闘が始まるたび、隊の全員の AGI が2段下がる (3ターン)。", "凍りついた古い魂の名残で、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      chill: 2, say: "絶対零度の冷気が骨までしみる",
    },
    boss: LAYER_BOSS[7], bossRank: 10,
    tune: { enemyMul: 0.95, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第8層の壁。開幕に足が鈍る分だけ控えめ
    unlock: { all: ["w23", "w24"] },
    hint: "「凍れる操霊師の間」と「極光の氷窟」の両方を踏破して王に報告すると、大回廊への道が開く",
  },
  // ---- 第七章「毒沼」(第9層の顔ぶれ) ── 解けた氷の水が流れ落ちる、奈落の底の沼。毒の正体は、底まで落ちて腐った魂 ----
  //   強さの素は第六章の各迷宮の 0.9倍 (層の入口の1割の段差)。手直しは第六章に倣う。顔ぶれはランク10 (上限) にそろえた
  {
    id: "w26", lv: 79, lvTo: 81, layer: 9, floors: 10,
    floorHaz: { fall: "mudhole", harm: "swamp" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1401, 5: 0.1508, 10: 0.1632 },
    name: "腐れ水の岸", short: "岸",
    about: "解けた氷の水が滝になって落ちる、奈落の底の沼の岸。黒い泥は、底まで落ちた魂が腐ったものだという",
    bands: [
      ["bs_plaguerat", "bs_rotooze", "bs_bogdrowned", "bs_leechswarm", "bs_marshlurker", "bs_blightmoth"],
      ["bs_sludgehydra", "bs_gasfiend", "bs_plaguebeast"],
    ],
    elites: ["el_bogfrogking"],
    trait: {
      id: "bog", name: "ぬかるむ岸", sym: "≈", accent: "#7a9a50",
      lines: ["岸の泥はところどころ毒の沼で、通路の一割半ほどが沼になる (浮遊で避けられる)。", "流れ落ちてきた魂が岸に溜まり、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "bog",
    },
    tune: { enemyMul: 1.06, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w25" },
    hint: "「凍てつく大回廊」の踏破を王に報告すると、回廊のさらに下へ降りる許しが出る",
  },
  {
    id: "w27", lv: 81, lvTo: 83, layer: 9, floors: 10,
    floorHaz: { fall: "mudhole", harm: "swamp" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1368, 5: 0.1474, 10: 0.1597 },
    name: "器の捨て場", short: "捨て場",
    about: "沼のほとりの谷に、作りかけの人業が山と積まれている。動かないはずの器が、ときどき起き上がる",
    bands: [
      ["bs_discardeddoll", "bs_fungalcorpse", "bs_bogdrowned", "bs_miasmawraith", "bs_plaguerat", "bs_venomspider"],
      ["bs_necromancer", "bs_toxicgolem", "bs_plaguewraith"],
    ],
    elites: ["el_offeringslime"],
    trait: {
      id: "husks", name: "器の山", sym: "⚱", accent: "#a08870",
      lines: ["積み上げられた器のあいだに、骸が横たわる (各階に死体が2つ増える。半分はまだあたたかい)。", "器に宿りかけた魂が多く、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      board: "prison",
    },
    tune: { enemyMul: 1.02, deepMul: 0.84, soloMul: 1.05 },
    unlock: { story: "w26_splint" },
    hint: "「腐れ水の岸」のどこかに、師が沼を渡った跡が残されているという",
  },
  {
    id: "w28", lv: 83, lvTo: 85, layer: 9, floors: 10,
    floorHaz: { fall: "mudhole", harm: "swamp" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.135, 5: 0.1457, 10: 0.158 },
    name: "毒霧の葦原", short: "葦原",
    about: "背丈を越える葦の原。毒の霧が立ちこめ、葦のあいだを何かが這い回る",
    bands: [
      ["bs_venomspider", "bs_corpseflower", "bs_blightmoth", "bs_gasfiend", "bs_leechswarm", "bs_miasmawraith"],
      ["bs_swamphag", "bs_marshlurker", "bs_pestilenceknight"],
    ],
    elites: ["el_bogfrogking"],
    trait: {
      id: "miasma", name: "毒霧", sym: "☁", accent: "#90b070",
      lines: ["葦の陰の毒霧にまぎれて、奇襲を受けやすい (×1.6)。", "葦の根元に、沼へ落ちた古い金貨が絡みついている。得る金貨は 1.35倍。"],
      mods: { ambushMul: 1.6, goldMul: 1.35 },
    },
    tune: { enemyMul: 0.97, deepMul: 0.84, soloMul: 1.05 }, // 奇襲の分だけ控えめ
    unlock: { reported: "w26" },
    hint: "「腐れ水の岸」の踏破を王に報告すると、沼の奥の葦原が示される",
  },
  {
    id: "w29", lv: 85, lvTo: 88, layer: 9, floors: 15,
    floorHaz: { fall: "mudhole", harm: "swamp" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.132, 5: 0.1382, 10: 0.1453, 15: 0.1518 },
    name: "よどみの底", short: "よどみ",
    about: "沼のいちばん深いところ。腐った魂がよどみ、底には古い島が沈みかけている",
    bands: [
      ["bs_plaguebeast", "bs_fungalcorpse", "bs_discardeddoll", "bs_corpseflower", "bs_rotooze", "bs_gasfiend"],
      ["bs_toxicgolem", "bs_swamphag", "bs_plaguewraith"],
      ["bs_plaguelich", "bs_pestilenceknight", "bs_sludgehydra"],
    ],
    trait: {
      id: "rot", name: "腐れの瘴気", sym: "☣", accent: "#a0c060",
      lines: ["よどんだ瘴気が肺を焼く。戦闘が始まるたび、隊の一人ひとりが 35% で毒に冒される (毒の抵抗で防げる)。", "腐りかけの魂が濃くよどみ、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      poisonStart: 0.35, say: "よどんだ瘴気が肺を焼く",
    },
    boss: LAYER_BOSS[8], bossRank: 10,
    tune: { enemyMul: 0.95, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第9層の壁。開幕の毒の分だけ控えめ
    unlock: { all: ["w27", "w28"] },
    hint: "「器の捨て場」と「毒霧の葦原」の両方を踏破して王に報告すると、よどみの底への道が開く",
  },
  // ---- 第八章「嵐の尖塔」(第10層の顔ぶれ) ── 沼の島の工房の奥から、奈落の縦穴を上へ伸びる塔。嵐と雷が絶えず渦を巻く ----
  //   強さの素は第七章の各迷宮の 0.9倍 (層の入口の1割の段差)。手直しは第七章に倣う。顔ぶれはランク10 (上限)
  {
    id: "w30", lv: 88, lvTo: 90, layer: 10, floors: 10,
    floorHaz: { fall: "stairwell", harm: "charged" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1261, 5: 0.1357, 10: 0.1469 },
    name: "風鳴りの螺旋", short: "螺旋",
    about: "沼の島の工房の奥から、塔の螺旋階段が闇の上へ伸びている。吹き抜けを、下から風が鳴りながら昇っていく",
    bands: [
      ["bs_galewisp", "bs_ravenswarm", "bs_windscythe", "bs_galehound", "bs_windwraith", "bs_thunderbeast"],
      ["bs_cyclonecore", "bs_zephyrfiend", "bs_lightninggolem"],
    ],
    elites: ["el_blizzardwitch"],
    trait: {
      id: "spiral", name: "螺旋の吹き抜け", sym: "↟", accent: "#9aa8d8",
      lines: ["階段の真ん中は底まで吹き抜けで、各階に足を踏み外す吹き抜けが2つ増える (最下階を除く。浮遊で避けられる)。踊り場には宝箱が1つ増える。", "吹き上げる風が魂を運び上げ、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "shaft",
    },
    tune: { enemyMul: 1.06, deepMul: 0.76, soloMul: 1.05 },
    unlock: { reported: "w29" },
    hint: "「よどみの底」の踏破を王に報告すると、沼の島の奥へ進む許しが出る",
  },
  {
    id: "w31", lv: 90, lvTo: 92, layer: 10, floors: 10,
    floorHaz: { fall: "stairwell", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1231, 5: 0.1327, 10: 0.1437 },
    name: "嵐を鳴らす鐘楼", short: "鐘楼",
    about: "塔の中ほどに吊られた、いくつもの大鐘。嵐が吹き抜けるたび、誰も鳴らさない鐘が鳴りわたる",
    bands: [
      ["bs_boltarcher", "bs_galewisp", "bs_soulanchor", "bs_stormelemental", "bs_ravenswarm", "bs_windwraith"],
      ["bs_stormcaller", "bs_harpyqueen", "bs_cloudgiant"],
    ],
    elites: ["el_stareater"],
    trait: {
      id: "bells", name: "鳴りやまぬ鐘", sym: "♫", accent: "#d8c088",
      lines: ["鐘の音が忍び寄る魔物を知らせ、奇襲を受けにくい (×0.5)。だが鐘に呼ばれて、強敵のいる階が出やすい (30%)。", "鐘の響きが魂を呼び集め、得る ✦Soul は 1.3倍。"],
      mods: { ambushMul: 0.5, soulMul: 1.3 },
      eliteRate: 0.30,
    },
    tune: { enemyMul: 1.02, deepMul: 0.84, soloMul: 1.00 }, // 強敵の階が多い分だけ強敵を控えめに
    unlock: { story: "w30_stick" },
    hint: "「風鳴りの螺旋」のどこかに、師が塔を登った跡が残されているという",
  },
  {
    id: "w32", lv: 92, lvTo: 94, layer: 10, floors: 10,
    floorHaz: { fall: "stairwell", harm: "charged" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1215, 5: 0.1311, 10: 0.1422 },
    name: "雷の落ちる回廊", short: "雷廊",
    about: "塔の外壁をめぐる、吹きさらしの回廊。鉄の手すりに、絶え間なく雷が落ちる",
    element: "wind",
    bands: [
      ["bs_thunderbeast", "bs_lightninggolem", "bs_cyclonecore", "bs_zephyrfiend", "bs_galehound", "bs_thunderroc"],
      ["bs_tempestserpent", "bs_galeknight", "bs_stormhag"],
    ],
    elites: ["el_blizzardwitch"],
    trait: {
      id: "railbolt", name: "帯電した手すり", sym: "ϟ", accent: "#b8c8f8",
      lines: ["回廊の魔物は、どれも雷 (風) を帯びている。火の刃が通り、火の守りが雷を和らげる。", "落雷に焼かれた旅人の金貨が、手すりの根元に散らばっている。得る金貨は 1.35倍。"],
      mods: { elemAll: true, goldMul: 1.35 },
    },
    tune: { enemyMul: 0.99, deepMul: 0.84, soloMul: 1.05 },
    unlock: { reported: "w30" },
    hint: "「風鳴りの螺旋」の踏破を王に報告すると、塔の外壁をめぐる回廊が示される",
  },
  {
    id: "w33", lv: 94, lvTo: 97, layer: 10, floors: 15,
    floorHaz: { fall: "stairwell", harm: "charged" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1188, 5: 0.1244, 10: 0.1308, 15: 0.1366 },
    name: "嵐の尖塔の頂", short: "頂",
    about: "塔のいちばん上。渦を巻く雷雲の中心に、火のともらない大きな灯台が立っている",
    bands: [
      ["bs_thunderroc", "bs_cloudgiant", "bs_soulanchor", "bs_stormelemental", "bs_boltarcher", "bs_windscythe"],
      ["bs_skydrake", "bs_harpyqueen", "bs_galeknight"],
      ["bs_stormcaller", "bs_tempestserpent", "bs_stormhag"],
    ],
    trait: {
      id: "bolt", name: "落雷", sym: "⚡", accent: "#f0e080",
      lines: ["渦巻く雷雲から雷が落ちる。戦闘が始まるたび、隊の一人に雷が落ちて最大HPの25%を焼く (ブレス耐性で和らぐ。HP1 は残る)。", "嵐に巻かれた魂が濃く渦を巻き、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      boltStart: 0.25, say: "渦巻く雷雲から雷が落ちた",
    },
    boss: LAYER_BOSS[9], bossRank: 10,
    tune: { enemyMul: 0.97, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第10層の壁。開幕の落雷の分だけ控えめ
    unlock: { all: ["w31", "w32"] },
    hint: "「嵐を鳴らす鐘楼」と「雷の落ちる回廊」の両方を踏破して王に報告すると、塔の頂への道が開く",
  },
  // ---- 第九章「闘技場跡」(第11層の顔ぶれ) ── 嵐の尖塔の頂から雲の上へ架かる石橋の先、灰に埋もれた古い闘技場の町 ----
  //   強さの素は第八章の各迷宮の 0.9倍 (層の入口の1割の段差)。手直しは第八章に倣う。顔ぶれはランク10 (上限)。どの迷宮の掟にも観客の注文 (audience) が入る
  {
    id: "w34", lv: 97, lvTo: 100, layer: 11, floors: 10,
    floorHaz: { fall: "bridgegap", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1135, 5: 0.1221, 10: 0.1322 },
    name: "雲を渡る石橋", short: "石橋",
    about: "尖塔の頂から、雷雲の上へ長い石の橋が伸びている。欄干には、古い鉄の輪がどこまでも並んでいる",
    bands: [
      ["bs_chaingang", "bs_warbeasthound", "bs_netfighter", "bs_hookmaster", "bs_ghostgladiator", "bs_spectreaudience"],
      ["bs_impaler", "bs_crowdroar", "bs_championwraith"],
    ],
    elites: ["el_ashshogun"],
    trait: {
      id: "nobackway", name: "退けぬ橋", sym: "⇉", accent: "#c8b898",
      lines: ["狭い石橋に退き場はない。この迷宮の戦闘からは逃げられない。", "雲の向こうの観客席から、亡き観客が見ている。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "橋を渡った者たちの魂が欄干に残り、得る ✦Soul は 1.25倍。"],
      mods: { noFlee: true, soulMul: 1.25 },
      audience: true,
    },
    tune: { enemyMul: 1.04, deepMul: 0.78, soloMul: 1.05 }, // 逃げられない分だけ並みより少し控えめ
    unlock: { reported: "w33" },
    hint: "「嵐の尖塔の頂」の踏破を王に報告すると、塔の頂のさらに先へ進む許しが出る",
  },
  {
    id: "w35", lv: 100, lvTo: 103, layer: 11, floors: 10,
    floorHaz: { fall: null, harm: "rotstraw" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1108, 5: 0.1194, 10: 0.1293 },
    name: "闘獣の檻", short: "檻",
    about: "闘技場の床の下に、獣の檻と通路が迷路のように続いている。檻の扉は、どれも内側から破られていた",
    bands: [
      ["bs_arenabeast", "bs_warbeasthound", "bs_sandlurker", "bs_beastmaster", "bs_chaingang", "bs_hookmaster"],
      ["bs_chainedogre", "bs_executioner", "bs_gladiatorlich"],
    ],
    elites: ["el_dragonslayer"],
    trait: {
      id: "hungry", name: "飢えた獣", sym: "ψ", accent: "#c87850",
      lines: ["檻の魔物はみな飢えている。戦闘が始まるたび、敵全体の攻撃が1段上がる (3ターン。主・金属の魔物は除く)。", "檻の格子ごしに、亡き観客がのぞきこむ。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "檻にこびりついた古い魂の名残で、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      foeRally: 1,
      audience: true,
    },
    tune: { enemyMul: 0.97, deepMul: 0.82, soloMul: 1.00 }, // 開幕に攻撃が上がる分だけ控えめ
    unlock: { story: "w34_glove" },
    hint: "「雲を渡る石橋」のどこかに、師が橋を渡った跡が残されているという",
  },
  {
    id: "w36", lv: 103, lvTo: 106, layer: 11, floors: 10,
    floorHaz: { fall: "standgap", harm: "ashdrift" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1094, 5: 0.1180, 10: 0.1280 },
    name: "亡き観客の階段席", short: "観客席",
    about: "すり鉢の形にせり上がる、石の観客席。灰の積もった石段に、半ば透けた観客たちが肩を寄せて座っている",
    bands: [
      ["bs_spectreaudience", "bs_crowdroar", "bs_bloodpriest", "bs_ghostgladiator", "bs_bladedancer", "bs_netfighter"],
      ["bs_mirrorduelist", "bs_championofash", "bs_gladiatorlich"],
    ],
    elites: ["el_ashshogun"],
    trait: {
      id: "fullhouse", name: "満員の観客席", sym: "♟", accent: "#b0a0c8",
      lines: ["観客席はいつも満員で、敵は必ず4体以上の群れで現れる。", "満員の亡き観客が身を乗り出す。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "観客の投げ銭が石段に散らばり、得る金貨は 1.35倍。"],
      mods: { packMin: 4, goldMul: 1.35 },
      audience: true,
    },
    tune: { enemyMul: 0.95, deepMul: 0.84, soloMul: 1.05 }, // 群れが大きい分だけ1体ずつを控えめに
    unlock: { reported: "w34" },
    hint: "「雲を渡る石橋」の踏破を王に報告すると、闘技場の観客席への道が示される",
  },
  {
    id: "w37", lv: 106, lvTo: 110, layer: 11, floors: 15,
    floorHaz: { fall: "arenatrap", harm: "bladesand" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1069, 5: 0.1120, 10: 0.1177, 15: 0.1229 },
    name: "血の砂の闘技場", short: "闘技場",
    about: "観客席に囲まれた、闘技場の砂の床。乾かない血の染みの上で、終わらない試合がいまも続いている",
    bands: [
      ["bs_championwraith", "bs_impaler", "bs_bladedancer", "bs_sandlurker", "bs_executioner", "bs_spikedgolem"],
      ["bs_arenabeast", "bs_chainedogre", "bs_mirrorduelist"],
      ["bs_championofash", "bs_bloodpriest", "bs_gladiatorlich"],
    ],
    trait: {
      id: "fervor", name: "高まる戦意", sym: "⚔", accent: "#e07060",
      lines: ["観客の歓声が戦う者をあおる。2ターン目から毎ターン、敵も味方も攻撃が1段ずつ上がっていく (+3段まで)。", "観客席の亡き観客が、砂の上を見下ろしている。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "砂に染みた魂が濃く渦を巻き、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      fervor: true,
      audience: true,
    },
    boss: LAYER_BOSS[10], bossRank: 10,
    tune: { enemyMul: 0.96, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第11層の壁。長引くほど敵も強まる分だけ控えめ
    unlock: { all: ["w35", "w36"] },
    hint: "「闘獣の檻」と「亡き観客の階段席」の両方を踏破して王に報告すると、闘技場の砂の上へ降りる道が開く",
  },
  // ---- 第十章「地底大空洞」(第12層の顔ぶれ) ── 闘技場の穴の底に広がる大空洞。濁った灯籠が三百年よりも昔から降り積もっている ----
  //   強さの素は第九章の各迷宮の 0.9倍 (層の入口の1割の段差)。手直しは第九章に倣う。顔ぶれはランク10 (上限)。どの迷宮の掟にも闇の命中低下 (gloom) が入る
  //   最後の迷宮の主は宰相モルデン (bs_moldern)。層の主 (大空洞の主 bs_cavernlord) は寄り道「大空洞の主の寝床」に眠る
  {
    id: "w38", lv: 110, lvTo: 113, layer: 12, floors: 10,
    floorHaz: { fall: "lampheap", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1022, 5: 0.1099, 10: 0.1190 },
    name: "灯籠の吹き溜まり", short: "吹き溜まり",
    about: "闘技場の穴の底。上から捨てられた濁った灯籠が、何百年もかけて降り積もり、黒い山をなしている",
    bands: [
      ["bs_glowspore", "bs_gloomstalker", "bs_echowraith", "bs_stalactiteghost", "bs_deepworm", "bs_blindhorror"],
      ["bs_cavetroll", "bs_abysshorror", "bs_mawofthedeep"],
    ],
    elites: ["el_tunnelking"],
    trait: {
      id: "risingsoul", name: "起き上がる濁り魂", sym: "↺", accent: "#b8a070",
      lines: ["休むことを忘れた濁った魂は、倒れても起き上がる。倒した敵は戦闘ごとに一度だけ、最大HPの3割で起き上がる (主・金属の魔物は除く)。", "灯籠の山のあいだには光が届かず、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "灯籠からこぼれた魂が濃く漂い、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      foeRise: 0.3,
      gloom: 0.15, say: "灯籠の山の闇に目がくらむ",
    },
    tune: { enemyMul: 0.96, deepMul: 0.80, soloMul: 1.00 }, // 起き上がる分だけ並みより控えめ
    unlock: { reported: "w37" },
    hint: "「血の砂の闘技場」の踏破を王に報告すると、闘技場のさらに下へ降りる許しが出る",
  },
  {
    id: "w39", lv: 113, lvTo: 116, layer: 12, floors: 10,
    floorHaz: { fall: null, harm: "blackwater" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.0997, 5: 0.1075, 10: 0.1164 },
    name: "黒い灯の地底湖", short: "地底湖",
    about: "大空洞の底に広がる、黒く静まりかえった湖。湖面には、どこにもない灯の明かりが映っている",
    bands: [
      ["bs_cavefisher", "bs_echowraith", "bs_glowspore", "bs_blindhorror", "bs_primalserpent", "bs_stalactiteghost"],
      ["bs_crystalspider", "bs_abysshorror", "bs_obsidianbeast"],
    ],
    elites: ["el_oremaw"],
    trait: {
      id: "whisper", name: "ささやく湖面", sym: "≋", accent: "#8a8ab0",
      lines: ["湖面から、名を忘れた魂のささやきが聞こえる。戦闘が始まるたび、隊の一人が 60% で惑わされて混乱する (混乱の抵抗で防げる)。", "湖面の明かりは何も照らさず、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "湖の底に沈んだ灯が魂を引き寄せ、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      whisper: 0.6,
      gloom: 0.15,
      say: { whisper: "湖面のささやきが耳の奥に入りこむ", gloom: "湖の闇に目がくらむ" },
    },
    tune: { enemyMul: 0.98, deepMul: 0.82, soloMul: 1.00 },
    unlock: { story: "w38_lamp" },
    hint: "「灯籠の吹き溜まり」のどこかに、師が通った跡が残されているという",
  },
  {
    id: "w40", lv: 116, lvTo: 119, layer: 12, floors: 10,
    floorHaz: { fall: "nichegap", harm: "soulsoot" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.0985, 5: 0.1062, 10: 0.1152 },
    name: "名を刻む石窟", short: "石窟",
    about: "岩壁一面に小さなくぼみが彫られた石窟。どのくぼみにも濁った灯籠が一つずつ納められ、名が刻まれている",
    bands: [
      ["bs_caveguardian", "bs_stalactiteghost", "bs_crystalspider", "bs_gloomstalker", "bs_obsidianbeast", "bs_echowraith"],
      ["bs_rocktitan", "bs_fossildragon", "bs_earthshaker"],
    ],
    elites: ["el_tunnelking"],
    trait: {
      id: "shell", name: "封じの殻", sym: "◎", accent: "#a0b0a0",
      lines: ["眠りを守る封じが、魔物の身にもかかっている。戦闘が始まるたび、敵全体 (主・金属の魔物は除く) が打撃を1回だけ防ぐ障壁をまとう。", "石窟の奥には光が届かず、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "壁のくぼみに供えられた古い銭で、得る金貨は 1.35倍。"],
      mods: { goldMul: 1.35 },
      shell: 1,
      gloom: 0.15, say: "石窟の闇に目がくらむ",
    },
    tune: { enemyMul: 0.95, deepMul: 0.84, soloMul: 1.05 }, // 障壁の分だけ1体ずつを控えめに
    unlock: { reported: "w38" },
    hint: "「灯籠の吹き溜まり」の踏破を王に報告すると、大空洞の奥の石窟への道が示される",
  },
  {
    id: "w41", lv: 119, lvTo: 123, layer: 12, floors: 15,
    floorHaz: { fall: "abysscleft", harm: "rotglow" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.0962, 5: 0.1008, 10: 0.1059, 15: 0.1106 },
    name: "底なしの大伽藍", short: "大伽藍",
    about: "大空洞の最奥に、天井の見えない巨大な伽藍がそびえる。床の裂け目のさらに下から、生ぬるい風が吹き上げてくる",
    bands: [
      ["bs_obsidianbeast", "bs_mawofthedeep", "bs_cavetroll", "bs_caveguardian", "bs_abysshorror", "bs_primalbeast"],
      ["bs_rocktitan", "bs_earthshaker", "bs_crystaldrake"],
      ["bs_fossildragon", "bs_cavebehemoth", "bs_primalserpent"],
    ],
    elites: ["el_tunnelking", "el_oremaw"],
    trait: {
      id: "soulfeast", name: "魂喰らいの闇", sym: "☾", accent: "#9070a0",
      lines: ["伽藍の闇は倒れた魂を食らう。人業を倒した敵は、攻撃が2段上がる (3ターン)。", "伽藍の闇は天井よりも深く、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "伽藍に溜まった魂が渦を巻き、得る ✦Soul は 1.4倍。"],
      mods: { soulMul: 1.4 },
      soulFeast: 2,
      gloom: 0.15, say: "底なしの闇に目がくらむ",
    },
    boss: "bs_moldern", bossRank: 10,
    tune: { enemyMul: 0.96, deepMul: 0.88, soloMul: 1.10, bossMul: 0.85 }, // 第一部の最後の壁
    unlock: { all: ["w39", "w40"] },
    hint: "「黒い灯の地底湖」と「名を刻む石窟」の両方を踏破して王に報告すると、大空洞の最奥への道が開く",
  },
  // ---- 依頼の迷宮 (酒場の固定クエストを受けると地図に現れる) ----
  {
    id: "ws1", lv: 20, lvTo: 23, layer: 2, floors: 10, side: true,
    floorHaz: { fall: "sunken", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    hint: "酒場の破門された司祭の依頼「沈んだ鐘」を受けると、道が示される",
  },
  {
    id: "ws2", lv: 24, lvTo: 28, layer: 3, floors: 10, side: true,
    floorHaz: { fall: "quarry", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    floorHaz: { fall: "roothole", harm: "spore" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["胞子の床が多い (通路の一割ほど)。霧の奥に、ひとつだけ癒しの泉が湧く。", "霧に紛れて奇襲を受けやすい (×1.5)。迷い込んだ魂は多く、得る ✦Soul は 1.3倍。"],
      mods: { ambushMul: 1.5, soulMul: 1.3 },
      board: "mist",
    },
    tune: { enemyMul: 1.33, deepMul: 0.76, soloMul: 1.00 }, // 第5層の顔ぶれ (ランク6-7) を本丸並みに
    unlock: { quest: "fq_wren" },
    hint: "酒場の猟師の依頼「霧に呑まれた娘」を受けると、道が示される",
  },
  {
    id: "ws4", lv: 41, lvTo: 45, layer: 5, floors: 10, side: true,
    floorHaz: { fall: null, harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["銀の小人たちの隠れ里。金属の魔物がとても出やすい (各階45%・札は2枚まで)。会心の一撃で仕留めよ。", "里の番人は空の鎧と石の人形。物理に固い者が多い。"],
      metalRate: 0.45, metalMax: 2,
    },
    tune: { enemyMul: 1.53, deepMul: 0.76, soloMul: 1.05 },
    unlock: { quest: "fq_zakka2" },
    hint: "酒場の行商人の依頼「銀の欠片の行方」を受けると、道が示される",
  },
  {
    id: "ws5", lv: 55, lvTo: 58, layer: 6, floors: 10, side: true,
    floorHaz: { fall: "well", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    floorHaz: { fall: null, harm: "cinder" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["狼煙の火を浴び、魔物はみな火の気を帯びる。水の刃が通り、水の守りが火を和らげる。", "火に呼ばれて集まった魂は多く、得る ✦Soul は 1.25倍。"],
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
    floorHaz: { fall: "oubliette", harm: "caltrop" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    floorHaz: { fall: "floorboard", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
    floorHaz: { fall: "fissure", harm: "obsidian" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["崖の割れ口に、黒曜で鍛えた古い刃物が眠る。落ちている装備の質が上がる。", "黒いガラスの崖が熱を照り返す。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。"],
      mods: { lootBonusLv: 4 },
      hpDrain: 0.06, say: "崖の照り返す熱が肌を焼いた",
    },
    tune: { enemyMul: 1.00, deepMul: 0.80, soloMul: 1.05 }, // 開幕の熱気の分だけ控えめ
    unlock: { quest: "fq_dorn3" },
    hint: "酒場の鍛冶師の依頼「黒い刃の材」を受けると、道が示される",
  },
  {
    id: "ws10", lv: 66, lvTo: 70, layer: 7, floors: 10, side: true,
    floorHaz: { fall: null, harm: "scorch" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["祈りの炎が見せる幻で、特別な階がよく現れる (×1.8)。", "祈りの炎の熱が回廊にこもる。戦闘が始まるたび、隊のHPが最大の6%減る (HP1 より下にはならない)。", "燃え残った魂は多く、得る ✦Soul は 1.2倍。"],
      mods: { soulMul: 1.2 },
      specialRate: 1.8,
      hpDrain: 0.06, say: "回廊にこもる炎の熱が肌を焼いた",
    },
    tune: { enemyMul: 0.98, deepMul: 0.84, soloMul: 1.05 },
    unlock: { quest: "fq_irma" },
    hint: "酒場の尼僧の依頼「祈りの火を消して」を受けると、道が示される",
  },
  {
    id: "ws11", lv: 71, lvTo: 75, layer: 8, floors: 10, side: true,
    floorHaz: { fall: "cornice", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["群れは雪煙にまぎれて忍び寄る。主の戦いのほかは、どの戦闘も必ず奇襲で始まり、敵が先に動く (周囲警戒・夜営の番・先制の心得も効かない)。", "雪煙の冷たさに身がすくむ。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "雪の下に落ちてきた品が埋もれ、得る金貨は 1.3倍。"],
      mods: { goldMul: 1.3 },
      alwaysAmbush: true,
      chill: 1, say: "雪煙の冷たさに身がすくむ",
    },
    tune: { enemyMul: 0.90, deepMul: 0.82, soloMul: 1.00 }, // 毎回先手を取られる分だけ軽め
    unlock: { quest: "fq_august" },
    hint: "酒場の毛皮売りの依頼「白い毛皮」を受けると、道が示される",
  },
  {
    id: "ws12", lv: 75, lvTo: 79, layer: 8, floors: 10, side: true,
    floorHaz: { fall: "icecrack", harm: "meltwater" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
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
      lines: ["澄んだ雪解けの泉が湧く (各階に癒しの泉が2つ)。だが冷たい水が魔力を奪い、戦闘が始まるたび、隊のMPが最大の8%減る。", "裂け目を吹き抜ける冷気に身がすくむ。戦闘が始まるたび、隊の全員の AGI が1段下がる (3ターン)。", "氷から抜け落ちた魂は傷みが少なく、得る ✦Soul は 1.3倍。"],
      mods: { soulMul: 1.3 },
      board: "font",
      mpDrain: 0.08,
      chill: 1,
      say: { mpDrain: "冷たい雪解けの水が魔力を奪った", chill: "裂け目を吹き抜ける冷気に身がすくむ" },
    },
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 1.05 },
    unlock: { quest: "fq_thaw2" },
    hint: "酒場の織り子の依頼「抜け落ちた人たち」を受けると、道が示される",
  },
  {
    // 格上の迷宮: 第七章 (隊は Lv80 前後) で開くが、推奨Lv は 100〜104 (状態異常・即死の Lv差も格上)。
    // 第9層の魔物 (ランク10) を、獄吏の詰所 ws7 と同じく層の約1.5倍の強さ (強さの素 × lvPow で 2.3〜2.7) に引き上げた。宝箱と ✦ で報いる
    id: "ws13", lv: 100, lvTo: 104, layer: 9, floors: 10, side: true, challenge: true,
    floorHaz: { fall: "moundpit", harm: "plague" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.184, 5: 0.195, 10: 0.21 },
    name: "疫病塚の底", short: "疫病塚",
    about: "王都が大疫病の死者を投げこんだ塚の底。塚の穴は、奈落の沼までつながっている",
    bands: [
      ["bs_plaguerat", "bs_plaguebeast", "bs_plaguewraith", "bs_fungalcorpse", "bs_bogdrowned", "bs_miasmawraith"],
      ["bs_plaguelich", "bs_pestilenceknight", "bs_necromancer"],
    ],
    elites: ["el_offeringslime"],
    trait: {
      id: "plague", name: "疫病の塚", sym: "✝", accent: "#b0a070",
      lines: ["投げこまれた死者が、通路に折り重なっている (各階に死体が2つ増える。半分はまだあたたかい)。宝箱は1ランク上等。", "塚に眠る魂は数知れず、得る ✦Soul は 1.2倍。"],
      mods: { chestRankUp: 1, soulMul: 1.2 },
      board: "prison",
    },
    tune: { enemyMul: 1.00, deepMul: 0.82, soloMul: 1.05 },
    unlock: { quest: "fq_rochus" },
    hint: "酒場の医者の依頼「塚の底の鐘」を受けると、道が示される",
  },
  {
    id: "ws14", lv: 84, lvTo: 88, layer: 9, floors: 10, side: true,
    floorHaz: { fall: "mudhole", harm: "swamp" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.133, 5: 0.143, 10: 0.154 },
    name: "沈んだ渡し場", short: "渡し場",
    about: "沼の島へ器を運んだ、古い渡し場。舟はとうに沈み、渡し守の灯だけが霧の中で揺れている",
    bands: [
      ["bs_marshlurker", "bs_leechswarm", "bs_rotooze", "bs_corpseflower", "bs_venomspider", "bs_discardeddoll"],
      ["bs_sludgehydra", "bs_toxicgolem", "bs_swamphag"],
    ],
    elites: ["el_offeringslime"],
    trait: {
      id: "ferry", name: "渡し賃", sym: "⚓", accent: "#80a0a0",
      lines: ["魔物は群れをなして沼を渡る。どの戦闘も3体以上の群れになる。", "沈んだ舟には渡し賃の金貨が残り、得る金貨は 1.3倍。"],
      mods: { packMin: 3, goldMul: 1.3 },
    },
    tune: { enemyMul: 0.95, deepMul: 0.82, soloMul: 1.05 }, // 群れの分だけ軽め
    unlock: { quest: "fq_ferry" },
    hint: "酒場の渡し守の孫娘の依頼「渡し守の灯」を受けると、道が示される",
  },
  {
    // 極端な掟の迷宮: 敵はみな神速 (ターンの頭に動き、後半にもう一度動く)。1体ずつは軽くしてある
    id: "ws15", lv: 89, lvTo: 93, layer: 10, floors: 10, side: true,
    floorHaz: { fall: "stairwell", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.1, 5: 0.108, 10: 0.116 },
    name: "雷鳥の巣", short: "巣",
    about: "塔の外壁に張りついた、雷鳥たちの巨大な巣。巣に住むものは、目にも止まらぬ速さで飛び回る",
    element: "wind",
    bands: [
      ["bs_ravenswarm", "bs_galehound", "bs_thunderbeast", "bs_windscythe", "bs_thunderroc", "bs_galewisp"],
      ["bs_harpyqueen", "bs_skydrake", "bs_zephyrfiend"],
    ],
    elites: ["el_stareater"],
    trait: {
      id: "nest", name: "疾風の巣", sym: "»", accent: "#a8d8f0",
      lines: ["巣のものはみな神速。どの敵もターンの頭に動き、後半にもう一度動く (1体ずつの力は軽い)。", "巣にため込まれた光りものの分だけ、得る ✦Soul は 1.2倍。"],
      mods: { soulMul: 1.2 },
      allHaste: true,
    },
    tune: { enemyMul: 0.90, deepMul: 0.82, soloMul: 0.95 }, // 二度動く分だけ軽め
    unlock: { quest: "fq_plume" },
    hint: "酒場の羽飾り職人の依頼「雷鳥の羽」を受けると、道が示される",
  },
  {
    id: "ws16", lv: 91, lvTo: 95, layer: 10, floors: 10, side: true,
    floorHaz: { fall: null, harm: "charged" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.122, 5: 0.131, 10: 0.141 },
    name: "錆びた避雷針の林", short: "針の林",
    about: "塔の張り出しに、さびた鉄の針が林のように立ち並ぶ。針から針へ、青白い火花が渡っていく",
    bands: [
      ["bs_lightninggolem", "bs_windwraith", "bs_boltarcher", "bs_cyclonecore", "bs_stormelemental", "bs_galewisp"],
      ["bs_galeknight", "bs_cloudgiant", "bs_stormcaller"],
    ],
    elites: ["el_blizzardwitch"],
    trait: {
      id: "rods", name: "帯電した林", sym: "†", accent: "#a0b0c8",
      lines: ["林の空気は帯電していて、戦闘が始まるたび、隊のHPが最大の5%焼ける (HP1 より下にはならない)。", "針の根元に埋められた古い箱は、どれも1ランク上等。"],
      mods: { chestRankUp: 1 },
      hpDrain: 0.05, say: "帯電した空気が肌を焼いた",
    },
    tune: { enemyMul: 0.97, deepMul: 0.82, soloMul: 1.05 },
    unlock: { quest: "fq_rodsmith" },
    hint: "酒場の屋根職人の依頼「錆びた針」を受けると、道が示される",
  },
  {
    id: "ws17", lv: 93, lvTo: 97, layer: 10, floors: 10, side: true,
    floorHaz: { fall: "cloudgap", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.12, 5: 0.129, 10: 0.139 },
    name: "雲上の庭", short: "雲庭",
    about: "雷雲の上に張り出した、崩れた庭園。誰も世話をしないはずの花が、枯れずに咲いている",
    bands: [
      ["bs_stormelemental", "bs_galewisp", "bs_windwraith", "bs_soulanchor", "bs_thunderroc", "bs_windscythe"],
      ["bs_stormhag", "bs_skydrake", "bs_tempestserpent"],
    ],
    elites: ["el_stareater"],
    trait: {
      id: "cloudspring", name: "雲間の泉", sym: "❀", accent: "#c8e8d0",
      lines: ["庭のあちこちに、夜ごと雲の露が溜まる澄んだ泉が湧く (各階に癒しの泉が2つ)。", "花のあいだに魂が憩い、得る ✦Soul は 1.25倍。"],
      mods: { soulMul: 1.25 },
      board: "font",
    },
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 1.05 }, // 泉で立て直せる分だけ並みの強さ
    unlock: { quest: "fq_garden" },
    hint: "酒場の老いた庭師の依頼「雲の上の花」を受けると、道が示される",
  },
  {
    // 毎階の強敵: どの階にも強敵がいる (強敵階の出やすさ 100%)。強敵は控えめにしてある
    id: "ws18", lv: 98, lvTo: 102, layer: 11, floors: 10, side: true,
    floorHaz: { fall: null, harm: "ashdrift" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.110, 5: 0.118, 10: 0.127 },
    name: "勝者の控え所", short: "控え所",
    about: "闘技場の外壁の内側に並ぶ、勝ち残った闘士たちの控えの間。壁には、勝ち星を刻んだ札がびっしりと掛かっている",
    bands: [
      ["bs_championwraith", "bs_impaler", "bs_netfighter", "bs_hookmaster", "bs_bladedancer", "bs_spikedgolem"],
      ["bs_executioner", "bs_championofash", "bs_chainedogre"],
    ],
    trait: {
      id: "victors", name: "勝ち残りの間", sym: "✪", accent: "#d8b070",
      lines: ["控えの間には勝ち残った強者が待つ。どの階にも強敵がいる (1体ずつは並みの強敵より控えめ)。", "控えの間の戸口に、亡き観客が詰めかける。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "勝者の褒美の箱は、どれも1ランク上等。"],
      mods: { chestRankUp: 1 },
      eliteRate: 1,
      audience: true,
    },
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 0.90 }, // どの階にも強敵が出る分だけ強敵を軽く
    unlock: { quest: "fq_minstrel" },
    hint: "酒場の吟遊詩人の依頼「勝者の歌」を受けると、道が示される",
  },
  {
    // 一騎打ち: 魔物の札の戦闘は必ず1体だけ (強敵並みに強く、戦果も群れの分だけ持つ)
    id: "ws19", lv: 101, lvTo: 105, layer: 11, floors: 10, side: true,
    floorHaz: { fall: "arenatrap", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.108, 5: 0.116, 10: 0.125 },
    name: "決闘の小円形場", short: "決闘場",
    about: "闘技場の裏手にある、小さな円い決闘場。ここでは、昔から一対一の試合しか許されなかった",
    bands: [
      ["bs_bladedancer", "bs_mirrorduelist", "bs_impaler", "bs_championwraith", "bs_netfighter", "bs_executioner"],
      ["bs_ghostgladiator", "bs_sandlurker", "bs_championofash"],
    ],
    elites: ["el_dragonslayer"],
    trait: {
      id: "duel", name: "一騎打ち", sym: "⋈", accent: "#d0a0a0",
      lines: ["決闘場の試合は一対一。魔物の札の戦闘には必ず1体だけが現れ、その1体は強敵並みに強い (戦果も群れの分だけ持つ)。", "決闘場を囲む石段から、亡き観客が見ている。戦闘が始まるたび観客の注文がひとつ出て (3ターン以内に勝て・誰も倒れずに勝て……)、応えて勝てばその戦闘で得る ✦Soul と金貨は 1.5倍。", "決闘の賭け金が砂に残り、得る金貨は 1.3倍。"],
      mods: { goldMul: 1.3 },
      duel: true,
      audience: true,
    },
    tune: { enemyMul: 1.00, deepMul: 0.86, soloMul: 1.00 },
    unlock: { quest: "fq_fencer" },
    hint: "酒場の道場の女師範の依頼「一騎打ちの作法」を受けると、道が示される",
  },
  {
    // 層の主 (大空洞の主) の寝床。主のいる寄り道 (沈んだ礼拝堂 ws1 と同じ形)。宝箱は1階に1つ、その代わり上等
    id: "ws20", lv: 111, lvTo: 115, layer: 12, floors: 10, side: true,
    floorHaz: { fall: null, harm: "bonegrit" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.099, 5: 0.106, 10: 0.114 },
    name: "大空洞の主の寝床", short: "主の寝床",
    about: "大空洞の脇の、天井の高い岩屋。食い散らかされた巨獣の骨が、床一面に積もっている",
    bands: [
      ["bs_cavebehemoth", "bs_primalbeast", "bs_deepworm", "bs_cavetroll", "bs_blindhorror", "bs_earthshaker"],
      ["bs_rocktitan", "bs_mawofthedeep", "bs_fossildragon"],
    ],
    trait: {
      id: "beasthoard", name: "巨獣の宝", sym: "◆", accent: "#c8a060",
      lines: ["巨獣は光るものを一つだけ寝床に抱えこむ。宝箱は1階に1つしかないが、中身は2ランク上等。", "岩屋の暗がりで、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。"],
      mods: { chestRankUp: 2 },
      oneChest: true,
      gloom: 0.15, say: "岩屋の暗がりに目がくらむ",
    },
    boss: LAYER_BOSS[11], bossRank: 10,
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 1.00, bossMul: 0.85 },
    unlock: { quest: "fq_delver" },
    hint: "酒場の老いた坑夫の依頼「地鳴りの主」を受けると、道が示される",
  },
  {
    // 格上の迷宮: 第十章 (隊は Lv110〜120) で開くが、推奨Lv は 135〜139。第12層の魔物を、層の約1.5倍の強さに引き上げた。
    // 強い掟「閉ざされた門」(帰還魔法陣も帰還の鈴も無い — 最下階に着くか全滅するまで出られない) は格上の迷宮だけの掟
    id: "ws21", lv: 135, lvTo: 139, layer: 12, floors: 10, side: true, challenge: true,
    floorHaz: { fall: "fossilcrack", harm: null }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.136, 5: 0.142, 10: 0.149 },
    name: "化石竜の墓所", short: "化石竜の墓所",
    about: "岩盤の中に、山のように大きな竜の骨が埋まっている。骨のすき間をたどる道は、行き着くところまで行かなければ、入った者を外へ返さない",
    bands: [
      ["bs_fossildragon", "bs_primalbeast", "bs_obsidianbeast", "bs_rocktitan", "bs_primalserpent", "bs_crystaldrake"],
      ["bs_cavebehemoth", "bs_earthshaker", "bs_abysshorror"],
    ],
    elites: ["el_oremaw"],
    trait: {
      id: "sealedgate", name: "閉ざされた門", sym: "⊘", accent: "#c09060",
      lines: ["骨の道に帰還魔法陣は無く、帰還の鈴も鳴らない。最下階に着くか全滅するまで、外へは出られない。", "骨のすき間の闇で、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "太古の魂が骨に眠り、得る ✦Soul は 1.3倍。宝箱は1ランク上等。"],
      mods: { soulMul: 1.3, chestRankUp: 1 },
      sealedGate: true,
      gloom: 0.15, say: "骨の道の闇に目がくらむ",
    },
    tune: { enemyMul: 1.00, deepMul: 0.84, soloMul: 1.05 },
    unlock: { quest: "fq_fossil" },
    hint: "酒場の骨を調べる学者の依頼「竜の骨の歌」を受けると、道が示される",
  },
  {
    id: "ws22", lv: 114, lvTo: 118, layer: 12, floors: 10, side: true,
    floorHaz: { fall: null, harm: "crystalthorn" }, // 足元の仕掛け (src/dungeons/floorhaz.js)
    power: { 1: 0.097, 5: 0.104, 10: 0.1125 },
    name: "水晶の鉱脈", short: "鉱脈",
    about: "大空洞の壁を割って、青白い水晶の鉱脈が走っている。水晶の光の中では、どんな品も正体を隠せない",
    bands: [
      ["bs_crystalspider", "bs_crystaldrake", "bs_glowspore", "bs_deepworm", "bs_obsidianbeast", "bs_cavefisher"],
      ["bs_rocktitan", "bs_caveguardian", "bs_mawofthedeep"],
    ],
    elites: ["el_oremaw"],
    trait: {
      id: "clearcrystal", name: "澄んだ水晶の光", sym: "◇", accent: "#a0c8f0",
      lines: ["水晶の光が品の正体を照らし出す。この迷宮で拾う品は、はじめから鑑定済み。", "水晶の光の外は真っ暗で、目が闇に慣れるまで刃が泳ぐ。戦闘が始まるたび、隊の全員の物理の命中が下がる (外れる率 +15%、3ターン)。", "光に群がる魔物は、必ず3体以上の群れで現れる。"],
      mods: { packMin: 3 },
      appraised: true,
      gloom: 0.15, say: "水晶の光の外の闇に目がくらむ",
    },
    tune: { enemyMul: 0.96, deepMul: 0.84, soloMul: 1.00 }, // 群れの分だけ1体ずつを控えめに
    unlock: { quest: "fq_gemcutter" },
    hint: "酒場の石細工の店主の依頼「くもらない石」を受けると、道が示される",
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

// 罠・足元の仕掛け・まだあたたかい死体の頻度 (推奨Lv の1階から)。旧来の素体 (難度 n の生成器) の式を、本筋の迷宮の
// 「n ≒ 1 + (推奨Lv − 1) × 0.46」で推奨Lv に写したもの (A1 で n を廃止したときに置き換え。値はほぼ据え置き)。
// harmRate = 蝕む床 (盤面の poison) / fallRate = 落ちる床 (pit。最下階には無い — board.js) の割合。
// どの迷宮に置くかは台帳の floorHaz で決める (2026-10 — 以前は推奨Lv24 から毒の床・第2層から落とし穴を全迷宮に一律に敷いていた)
export function hazardsAt(lv) {
  const k = Math.max(0, (lv || 1) - 1);
  return {
    trapRate: Math.min(0.25, 0.0412 + 0.00092 * k),
    harmRate: Math.min(0.10, 0.0406 + 0.000276 * k),
    fallRate: Math.min(0.05, 0.0203 + 0.000138 * k),
    warmChance: Math.min(0.7, 0.3832 + 0.00147 * k),
  };
}

// 台帳の欄から、迷宮の設定を組み立てる
function build(def) {
  const { harmRate, fallRate, ...h } = hazardsAt(def.lv);
  const cfg = { ...h, ...def };
  // 足元の仕掛け: 台帳で置くと決めた迷宮だけに敷く (見た目と言葉は floorhaz.js)
  cfg.floorHaz = { ...def.floorHaz };
  cfg.poisonRate = def.floorHaz.harm ? harmRate : 0;
  cfg.pitRate = def.floorHaz.fall ? fallRate : 0;
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
  cfg.gates = !(def.trait && def.trait.sealedGate); // 5階ごとの帰還魔法陣 (奈落・掟「閉ざされた門」は持たない)
  return cfg;
}

export const WORLD = WORLD_DEF.map(build);
export const WORLD_IDS = WORLD.map((d) => d.id);
export function worldIndexOf(id) { return WORLD_IDS.indexOf(id); }
export function worldById(id) { return WORLD[worldIndexOf(id)] || null; }

// 帰還魔法陣の階 (5の倍数・最下階を除く)
export function gateFloors(cfg) {
  const out = [];
  if (!cfg || !cfg.gates) return out;
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
  // 格上の迷宮 (challenge) と、掟で1体ずつを軽くした迷宮 (敵がみな神速の allHaste — 奈落の敵は神速にならない) は層の物差しに数えない
  const ds = WORLD.filter((d) => d.layer === L && !d.challenge && !(d.trait && d.trait.allHaste));
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
// ===== 第二部の壁 (2026-10 ユーザーの指示「10章までがチュートリアル、11章からが本番」) =====
// 第一部 (第一〜十章 = 第1〜12層) は推奨Lv に届けば進める。第二部 (第十一章 = 第13層から) は土地 (層) が変わるたびに
// 敵の強さが段で跳ね上がり、推奨Lv に届くだけでは勝てない — 魂融合・トレハン (奈落・無限迷宮の品)・鍛え直しで
// 隊を鍛えてから挑む。段は「その層の入口で、前の層の強さに何倍を掛けるか」で、層をまたいで積み重なる。
// 強さ (HP・攻撃・防御) が k 倍になると、推奨Lv だけの隊の1戦の被ダメはおよそ k² 倍 (一撃が k 倍 × 倒すまでの手数が k 倍)。
// ×2.0 = 被ダメ約4倍 (第二部の始まり) / ×1.4 = 約2倍 (各層の壁)。戦果 (✦Soul・金貨) は推奨Lv の基準のまま (startBattle の battleRewardK)。
// 値はその章を作る時に模擬戦とテスト記録で合わせる (docs/difficulty-walls.md)。無限迷宮は独自の推奨Lv の表で強さを決めるので cfg.wall = 1 で外す
export const PART2_LAYER = 13; // 第十一章
export const LAYER_WALL = { 13: 2.0, 14: 1.4, 15: 1.4, 16: 1.4, 17: 1.4, 18: 1.4, 19: 1.4, 20: 1.4 };
// 第L層の壁 = 第13層から第L層までの段の積 (第21層より先は第20層のまま)
export function wallAt(layer) {
  let k = 1;
  for (let L = PART2_LAYER; L <= Math.min(20, layer || 1); L++) k *= LAYER_WALL[L] || 1;
  return k;
}
// 迷宮の壁 (cfg.wall があればそれ、無ければ層から)
export function wallOf(cfg) {
  if (!cfg) return 1;
  if (cfg.wall != null) return cfg.wall;
  return wallAt(cfg.layer || 1);
}
// その層の入口の段 (前の層の何倍か。第二部の層でなければ 1)
export function wallStepOf(cfg) {
  if (!cfg || cfg.wall != null) return 1;
  return (cfg.layer >= PART2_LAYER && cfg.layer <= 20) ? (LAYER_WALL[cfg.layer] || 1) : 1;
}

// その階の敵の強さ (手直し・特別な階・異変を除く): 強さの素 × 推奨Lv の伸び × 第二部の壁
export function strengthAt(cfg, floor = 1) { return powerAt(cfg, floor) * lvPow(dungeonLevelRaw(cfg, floor)) * wallOf(cfg); }


// 検証: id の重複・素体の欠け・出現表の空
{
  for (const [L, k] of Object.entries(LAYER_WALL)) {
    if (!(Number(L) >= PART2_LAYER && Number(L) <= 20) || !(k >= 1)) throw new Error(`world: 第二部の壁 ${L} は第13〜20層・1以上`);
  }
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
      for (const k of Object.keys(t)) if (!["id", "name", "sym", "accent", "lines", "mods", "eliteRate", "board", "specialRate", "victoryHeal", "foeRegen", "mpDrain", "hpDrain", "metalRate", "metalMax", "chill", "physOnly", "alwaysAmbush", "poisonStart", "boltStart", "allHaste", "say", "audience", "gloom", "foeRally", "fervor", "duel", "foeRise", "whisper", "shell", "soulFeast", "oneChest", "sealedGate", "appraised"].includes(k)) throw new Error(`world: ${d.id} trait has unknown field ${k}`);
    }
    if (d.realm != null) throw new Error(`world: ${d.id} の realm は廃止 (土地の掟は迷宮の掟に統合した)`);
    if (d.trait && d.trait.say && typeof d.trait.say === "object") {
      for (const k of Object.keys(d.trait.say)) if (!(d.trait[k] > 0)) throw new Error(`world: ${d.id} trait.say.${k} に対応する開幕の効果が無い`);
    }
    for (const k of d.elites || []) if (!BESTIARY[k]) throw new Error(`world: ${d.id} unknown elite ${k}`);
    // 足元の仕掛け: 迷宮ごとに必ず決める (置かないなら null)。掟の盤面加工が敷く仕掛けは、その迷宮で置いている種類に限る
    const fh = d.floorHaz;
    if (!fh || !("fall" in fh) || !("harm" in fh) || Object.keys(fh).length !== 2) throw new Error(`world: ${d.id} needs floorHaz { fall, harm } (置かないなら null)`);
    for (const kind of ["fall", "harm"]) if (fh[kind] != null && (!FLOOR_HAZ[fh[kind]] || FLOOR_HAZ[fh[kind]].kind !== kind)) throw new Error(`world: ${d.id} floorHaz.${kind} が不正 (${fh[kind]})`);
    const needs = { shaft: "fall", ledge: "fall", vent: "harm", bog: "harm", mist: "harm" }[d.trait && d.trait.board];
    if (needs && !fh[needs]) throw new Error(`world: ${d.id} の掟 (${d.trait.board}) は floorHaz.${needs} が要る`);
  }
}
