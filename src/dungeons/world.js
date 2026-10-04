// ===== 迷宮の台帳 (World) — 「百の迷宮」を1つずつ手で作り込む =====
// 迷宮は一本道ではない。いくつもの迷宮が並び立ち、どれに潜るかはプレイヤーが選ぶ。
// 新しい迷宮は条件 (踏破の報告・物語の手がかり・宝物庫の褒賞…) を満たすと地図に現れる。
// 推奨Lvより遥かに強い迷宮にも入れる (状態異常・即死はLv差で決まるので、格上を術で狩る抜け道は無い — combat.js lvRate)。
//
// 台帳の1行 = 1迷宮。並び順 = 地図 (出撃シート・図鑑) の並び。id は保存されるので変えない・使い回さない。
//   id      保存用の名 ("w01"…)
//   n / nTo 難度の物差し (旧来の迷宮番号 1-100 と同じ尺度) の1階 / 最下階。敵のLv (= 推奨Lv) は階に沿って n → nTo へ上がる。
//           敵の強さ・戦果・落とし物の帯は n の素体 (generator.js の generateDungeon(n)) を下の欄で上書きして決まる
//   layer   景色・探索BGM・出来事の層 (1-20)。出現表 (pool/deepPool) と強敵 (elites) もこの層の顔ぶれから選ぶ
//   floors  全階数。5の倍数の階 (最下階を除く) は下り階段の代わりに「帰還魔法陣」が立つ (game.js / board.js)
//   bands   雑魚の顔ぶれ (5階ごとの帯。下の poolAt)。boss = 最下階の主 (無ければ最下階の階段で踏破)
//   elites  強敵階に出る強敵 (省略時は層の LAYER_ELITES)
//   unlock  地図に現れる条件 (game.js worldUnlocked):
//             { start: true }         第0章 (人業の生成) を終えた時
//             { reported: id }        その迷宮の踏破を王に報告した時
//             { story: key }          物語の手がかり (story.js の物語マス) を見つけた時
//             { treasury: n }         宝物庫の n 種奉納の褒賞 (坑口の通行証など) を受け取った時
//             { quest: id }           酒場の固定クエスト (src/quests.js FIXED_QUESTS) を受けた時
//   side    依頼の迷宮 (章の筋の外)。初めて踏破しても王への報告は無く、依頼人に報告する (機能解放の数にも数えない)
//   hint    まだ現れていない時に出撃シートで示す、解放の手がかり
//   about   出撃シートの一行の説明
import { DUNGEONS as GENERATED } from "./generator.js";
import { LAYER_BOSS, LAYER_ELITES } from "./bestiary.js";
import { baselineLv, progressX } from "../baseline.js";

const WORLD_DEF = [
  {
    id: "w01", n: 1, nTo: 1, layer: 1, floors: 5,
    name: "忘れられた地下墓地", short: "地下墓地",
    about: "ロアダルの墓所の下。師オルドが最後に降りたと伝わる",
    bands: [
      ["bs_bonebat", "bs_carrioncrow", "bs_corpsemaggot", "bs_grasphand", "bs_gravewisp", "bs_bonepile"],
    ],
    unlock: { start: true },
    hint: "第0章「人業の生成」を果たすと、王が在処を明かす",
  },
  {
    id: "w02", n: 2, nTo: 4, layer: 1, floors: 10,
    name: "亡骸の囁く回廊", short: "囁く回廊",
    about: "墓地の奥へ続く長い回廊。壁の向こうから死者の囁きが漏れる",
    bands: [
      ["bs_mournshade", "bs_ghoul", "bs_pettyrevenant", "bs_sarcoguard", "bs_skullswarm", "bs_spiritbat"],
      ["bs_shroudstrangler", "bs_tombwarden", "bs_weepangel"],
    ],
    tune: { enemyMul: 0.92 }, // generator.js DUNGEON_TUNE の D3 (2026-10 の改定後の表)
    unlock: { reported: "w01" },
    hint: "「忘れられた地下墓地」の踏破を王に報告すると、道が示される",
  },
  {
    id: "w03", n: 4, nTo: 6, layer: 1, floors: 15,
    name: "朽ちた骸の修道院", short: "骸の修道院",
    about: "死者を弔い続けた修道士たちの成れの果て。最下階に骸の修道院長が待つ",
    bands: [
      ["bs_zombie", "d01_skeleton", "bs_weepangel", "bs_tombwarden", "bs_shroudstrangler", "bs_pettyrevenant"],
      ["bs_sarcoguard", "bs_ghoul", "bs_skullswarm"],
      ["d02_soldier", "bs_bonechanter", "bs_gravecaller"],
    ],
    boss: LAYER_BOSS[0], bossRank: 3,
    tune: { enemyMul: 0.90, bossMul: 1.00, bossHpMul: 2 }, // DUNGEON_TUNE の D4 の雑魚 + D5 の主 (主の HP ×2)
    unlock: { reported: "w02" },
    hint: "「亡骸の囁く回廊」の踏破を王に報告すると、道が示される",
  },
  {
    id: "w04", n: 6, nTo: 8, layer: 2, floors: 10,
    name: "黒水の取水口", short: "取水口",
    about: "王都へ流れる黒い水の入口。水に触れた者は影が薄くなるという",
    bands: [
      ["bs_bloatfly", "bs_fogspecter", "bs_giantleech", "bs_ratking", "bs_razorshrimp", "bs_sewercrab"],
      ["bs_mucusworm", "bs_toxictoad", "bs_drownedcorpse"],
    ],
    tune: { enemyMul: 1.40, deepMul: 0.87, soloMul: 0.85 }, // DUNGEON_TUNE の D7 (改定後の表)
    unlock: { story: "w02_sigil" },
    hint: "「亡骸の囁く回廊」のどこかに、師の残した印があるという",
  },
  {
    id: "w05", n: 10, nTo: 13, layer: 3, floors: 15,
    name: "鎖の垂れる坑口", short: "坑口",
    about: "先代の王が封じた古の坑道。罪人たちの鎖が、今も闇に垂れている",
    bands: [
      ["bs_blastsprite", "bs_chainedconvict", "bs_dustwraith", "bs_koboldsapper", "bs_minebat", "bs_timbermite"],
      ["bs_rockworm", "bs_tunneler", "bs_gargoyle"],
      ["bs_crystalcrawler", "bs_troll", "bs_steelspider"],
    ],
    boss: LAYER_BOSS[2], bossRank: 5,
    tune: { enemyMul: 1.50, deepMul: 0.70, soloMul: 0.92, bossMul: 0.80 }, // DUNGEON_TUNE の D11 の雑魚 + D15 の主 (第3層は厳しめ)
    unlock: { treasury: 3 },
    hint: "王家の宝物庫に収集品を3種奉納すると、王が坑口の通行証を授ける",
  },
  // ---- 依頼の迷宮 (酒場の固定クエストを受けると地図に現れる) ----
  {
    id: "ws1", n: 7, nTo: 9, layer: 2, floors: 10, side: true,
    name: "沈んだ礼拝堂", short: "沈んだ礼拝堂",
    about: "黒い水の底に沈んだ礼拝堂。夜ごと、水の下から鐘が鳴る",
    bands: [
      ["bs_sludgeooze", "bs_waterelemental", "bs_sewerdredger", "bs_brinewraith", "bs_waterhag", "bs_eelfiend"],
      ["bs_anglerfiend", "d03_sahagin", "bs_abysstentacle"],
    ],
    boss: LAYER_BOSS[1], bossRank: 4,
    tune: { enemyMul: 1.28, deepMul: 0.75, soloMul: 0.85, bossMul: 0.85 }, // DUNGEON_TUNE の D9 の雑魚 + D10 の主
    unlock: { quest: "fq_oswald" },
    hint: "酒場の破戒僧の依頼「沈んだ鐘」を受けると、道が示される",
  },
  {
    id: "ws2", n: 12, nTo: 14, layer: 3, floors: 10, side: true,
    name: "石眠りの石切り場", short: "石切り場",
    about: "王都の城壁を切り出した古い石切り場。鉱夫たちは鑿を握ったまま石になった",
    bands: [
      ["d03_orc", "bs_shieldogre", "bs_stonegorgon", "bs_rockworm", "bs_dustwraith", "bs_tunneler"],
      ["d03_mandrake", "bs_orehulk", "bs_deepgolem"],
    ],
    tune: { enemyMul: 1.30, deepMul: 0.73, soloMul: 1.0 }, // DUNGEON_TUNE の D13 の行
    unlock: { quest: "fq_morga" },
    hint: "酒場の薬師の依頼「石になった鉱夫たち」を受けると、道が示される",
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

// 素体 (generateDungeon(n)) に台帳の欄を重ねて、迷宮の設定を組み立てる
function build(def) {
  const base = GENERATED[def.n - 1];
  const cfg = { ...base, ...def };
  // 出現表: 帯をまとめて浅階 (最初の帯) / 深階 (以降の帯) にも写す (図鑑・逃走の物差しなどが全体を見る)
  cfg.pool = [...def.bands[0]];
  cfg.deepPool = def.bands.length > 1 ? def.bands.slice(1).flat() : [...def.bands[0]];
  cfg.tune = def.tune ? { ...def.tune } : null;
  // 落とし物の帯は1階 (n) から最下階 (nTo) まで広がる (game.js が階の深さで帯の中を補間する)
  if (def.nTo && GENERATED[def.nTo - 1]) cfg.lootLv = [base.lootLv[0], GENERATED[def.nTo - 1].lootLv[1]];
  // 階ごとの強さの上がり幅 (旧来は 1階ごとに +6%)。深い迷宮は帯ごとに顔ぶれが強くなるので、1階ごとの上げ幅は緩める
  cfg.floorRamp = def.floorRamp != null ? def.floorRamp : 0.06 * Math.min(1, 5 / Math.max(5, def.floors));
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

// 迷宮のLv (その階の敵のLv。基準の隊の平均Lv)。推奨Lv の帯は1階〜最下階。
// 基準の隊 (baseline.js) の Lv は「経験値2倍・サブ魂の能力加算をランク別に」の改定前の実測で、改定後の隊は
// Lv で約5低い見込み (第3層の入口で Lv24 → 19 前後)。Lv1 を据えたまま ×LV_EST で縮めて見込みに寄せる。
// 改定後のテスト記録で基準の隊の行が測り直されたら 1 に戻す
export const LV_EST = 0.78;
const estLv = (v) => 1 + (v - 1) * LV_EST;
export function dungeonLevel(cfg, floor = 1) {
  if (!cfg) return 1;
  const n = cfg.n || 1, floors = cfg.floors || 1;
  // 台帳の迷宮: 1階 = n の入口 → 最下階 = nTo の入口〜奥へ、階に沿ってなめらかに上がる
  if (cfg.nTo != null) {
    const t = floors > 1 ? (Math.max(1, floor) - 1) / (floors - 1) : 0;
    const x = (n - 1) + t * (cfg.nTo - n + (floors >= 10 ? 0.6 : 0.5));
    return Math.max(1, Math.round(estLv(baselineLv(x))));
  }
  return Math.max(1, Math.round(estLv(baselineLv(progressX(n, floor, floors)))));
}
export function levelBand(cfg) { return [dungeonLevel(cfg, 1), dungeonLevel(cfg, cfg.floors || 1)]; }

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
  }
}
