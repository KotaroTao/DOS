# 敵スキル一覧表（モンスター制作リファレンス）

別セッションでモンスターを作る／調整するときの参照表。**「現行」は実装済みでそのまま使える**。**「提案」は未実装**——使う前に `combat.js`/`schema.js` への実装が必要（このファイル末尾に設計メモあり）。

数値・発動率は `src/combat.js`（`enemyAct`/`_exec`/`_physical`/`_startRound`/`makeEnemy`/`spawnCardEnemies`）と `src/dungeons/schema.js`（`defMonster`/`TRAITS`/`monsterTraitKeys`）の実コードに基づく（2026-06 時点）。コードと食い違ったらコードが正。

---

## 使い方（モンスターに特徴を持たせる手順）

1. `src/dungeons/bestiary.js` に1エントリ追記（`rank` 1-10 必須、`hp/atk` は書かない＝`monStats` が算出）。
2. 下表の **「設定フィールド」** を def に書く。`defMonster` がホワイトリスト検証する（未知フィールドは捨てられる／一部は throw）。
3. **狙いは「1体あたり特徴1〜2個」の見出し**。flavor（`desc`）と噛み合わせる。同じ rank 帯で特徴を散らす（全員 poison にしない）。
4. 凶悪系（`drain`/`soulSteal`/`critical`/`stone`）は **rank ≥ 4 限定**。低ランクに付けない。
5. 図鑑の「特徴・スキル」欄は `monsterTraitKeys(m)` が def から自動生成する。表示専用に足したいキーは `traits: [...]` で追加可。

> `ability` は **race ごとの自動割当**（`game.js` の `RACE_ABILITY`）がある。明示指定で上書き、`ability: null` で抑制。

---

## 現行スキル①：ability（単発の特殊行動）

`ability: "..."` を1つ設定。手番の **約25%**（`breath` のみ約30%）で発動、それ以外は通常攻撃。1体につき ability は1つ。

| キー | 表示 | 効果 | 数値・発動率 | rank制限 | フレーバー目安 |
|---|---|---|---|---|---|
| `poison` | 毒 | 近接（×0.9）＋毒付与 | 命中時40%×(1−異常耐性)で毒 | 1〜 | 蟲・毒草・沼の魔物 |
| `paralyze` | 麻痺 | 近接（×0.9）＋麻痺付与 | 命中時40%×(1−異常耐性)で麻痺 | 1〜 | 霊・蜘蛛・電気 |
| `breath` | ブレス | **全体**属性ダメージ（回避不可・VITで微減・属性倍率あり） | 威力≈ATK×0.85、発動30% | 6〜推奨 | 竜・鳳凰・大砲 |
| `stone` | 石化 | 凝視（ダメージなし）→石化 | 32%×(1−状態耐性)、既に異常なら不発 | **4〜** | 蛇・眼・ゴルゴーン |
| `drain` | 吸命 | 近接（×0.8）＋宿した魂レベルを喰らう | 命中時35%でドレイン | **4〜** | 不死・吸血・呪樹 |
| `soulSteal` | 魂奪 | Soul（✦）を盗む | 35%回避され、成立で `3+soul×0.6` | **4〜** | 亡霊・魂喰らい |
| `goldSteal` | 強奪 | 金品を奪う | 35%回避され、成立で `5+gold×0.5` | 1〜 | コボルド・盗賊・ハーピー |
| `critical` | 痛撃 | 近接（×1.1）＋即死級の急所突き | 命中時15%×(1−状態耐性)で致死（不屈はHP1耐え） | **4〜** | 武者・処刑人・刺客 |

---

## 現行スキル②：role（戦闘中のふるまい）

`role: "..."` を設定。ability より優先して判定される。

| キー | 表示 | 効果 | 数値・発動率 | 追加フィールド | フレーバー目安 |
|---|---|---|---|---|---|
| `summoner` | 招来 | 仲間を1体呼ぶ（最大6体） | 6体未満時50% | `summonKey:"<monId>"` 必須 | 笛吹き・ネクロマンサー・主 |
| `healer` | 治癒 | 負傷した味方（HP<65%）を回復 | 70%、回復=対象最大HP×22% | （なし） | 祈り手・呪い手・聖女 |
| `guard` | 庇護 | 仲間への**物理**攻撃を肩代わり | 60%で庇う（回数制） | `escort:"<monId>"` 任意 | 大盾・重骸・番人 |

> 注: `healer` の回復は固定22%。提案Aの `caster:{job:"priest"}` で実呪文（DIOS/DIAL）に置換可能。

---

## 現行スキル③：passive（常時効果フィールド）

def に直接書く真偽値／数値。`defMonster` がホワイトリスト。複数併用可。

| フィールド | 表示 | 効果 | 値域・数値 | フレーバー目安 |
|---|---|---|---|---|
| `physResist` | 物理耐性 | 物理被ダメを割合カット | 0〜0.9（例 0.6＝6割減） | スライム・鎧・ゴーレム・岩 |
| `magWeak` | 魔法弱点 | 攻撃呪文の被ダメ倍率 | >1（例 1.5＝1.5倍） | 不死・霊・氷 |
| `regen` | 再生 | 毎ラウンド最大HPの割合だけ自己回復 | 0〜1（例 0.08＝毎T8%） | トロール・植物・粘体 |
| `swift` | 俊敏 | AGI を +4（先手を取りやすい） | `true` | 獣・蝙蝠・忍 |
| `evasive` | 回避 | 物理回避 +15% | `true` | 影・小型・素早い獣 |
| `pack` | 群棲 | 出現数の下限を3体に引き上げる | `true` | 鼠・ゴブリン・魚人 |

---

## 現行：表示専用キー（TRAITS の語彙）

図鑑表示のラベル定義（`schema.js` の `TRAITS`）。上記の ability/role/passive から `monsterTraitKeys` が自動的に並べる。`traits: ["..."]` で表示だけ追加することも可能（戦闘挙動は伴わない点に注意）。

`swift / evasive / physResist / magWeak / regen / pack / summon / heal / guard / breath / poison / paralyze / stone / drain / soulSteal / goldSteal / critical`

---

## 提案スキル（未実装・実装が必要）

以下は **まだコードに無い**。モンスター def に書いても現状は無視される。実装したら現行表へ昇格させる。

### 提案A：呪文を使う敵 `caster`

```
caster: { job: "mage",   tier: 3 }   // 魔導士呪文をレベル帯3まで使用
caster: { job: "priest", tier: 1 }   // 僧侶呪文をレベル帯1まで使用
```

- `souls.js` の `JOB_SKILLS[job]`（職業×習得Lvの呪文表）から `tier` 以下の呪文を抽出して使用。新規呪文データ不要。
- AI: 回復系職は瀕死の味方を優先回復/蘇生、攻撃系職は敵2体以上で全体・単体なら単体、MP切れで通常攻撃。発動率25〜30%、MP実消費。
- 図鑑ラベルは動的（例「呪文（魔導Lv3）」「祈祷（僧侶Lv1）」）。
- 効能: プレイヤーの 魔法弱点/魔障壁/魔力反射/DISPEL/睡眠耐性 がようやく機能する。

**tier ↔ 習得Lv 対応（目安・ダンジョンrank帯に合わせる）**

| tier | 習得Lv以下 | mage の例 | priest の例 |
|---|---|---|---|
| 1 | lv1 | HALITO | DIOS |
| 2 | lv5 | HALITO/ICENEEDLE/KATINO | DIOS/CURE/BLESS |
| 3 | lv7 | 〜KAMAITACHI | 〜HOLYRAY |
| 4 | lv10 | 〜MAHALITO(全体) | 〜DIOSALL(全体) |
| 5 | lv20 | 〜MADALT(全体氷) | 〜SAINTRAY/REVIVE |
| 6 | lv30+ | 〜LAHALITO/TILTOWAIT | 〜MADIOS/RESURRECT |

> 利用可能な職と呪文の正確な対応は `src/souls.js` の `JOB_SKILLS` を参照（mage/priest/bishop/hexer/necromancer/sage/archmage/cardinal など）。

### 提案B：バリエーション拡張（未実装）

**バフ/デバフ系**

| 候補キー | 表示 | 効果 | 流用できる既存機構 | フレーバー目安 |
|---|---|---|---|---|
| `warcry` ★ | 鼓舞 | 自分/味方のATKを数T上昇 | プレイヤー WARCRY | 隊長・主 |
| `weaken` | 弱体 | プレイヤーのATK/VITをデバフ | `POISONSTAB` の debuff | 呪術師 |
| `slow` | 鈍足 | 対象AGIを下げ手番を遅らせる | `霞斬り` debuff | 泥・粘体 |
| `seal` / `curse` ★ | 封印 | 確率でプレイヤーの呪文/スキルを封じる | 新規（ailment追加） | 魔女・大司教 |
| `dispel` | 解呪 | プレイヤーのバフ/結界を打ち消す | プレイヤー DISPEL | 術師・神官 |

**防御/耐久系**

| 候補キー | 表示 | 効果 | 流用できる既存機構 | フレーバー目安 |
|---|---|---|---|---|
| `magResist` ★ | 魔法耐性 | 攻撃呪文の被ダメ減（physResistの魔法版） | physResist と対称に追加 | 魔導生物・結界 |
| `reflect` | 反射 | 受けた呪文の一部を撃ち返す | プレイヤー reflect | 鏡像・魔障 |
| `barrier` | 障壁 | 数回だけ被ダメ半減（回数制） | `_barrierLeft` 機構 | 守護像・番人 |
| `enrage` ★ | 激昂 | HP低下でATK/AGI上昇 | buffs を動的更新 | 鬼・獣・主 |
| `endure` | 不屈 | 致死を一度HP1で耐える | プレイヤー不屈(`pv endure`) | 主・大型 |

**攻撃/手番系**

| 候補キー | 表示 | 効果 | 流用できる既存機構 | フレーバー目安 |
|---|---|---|---|---|
| `multistrike` ★ | 連撃 | 1手番で2〜3回攻撃 | `hits` 機構 | 多腕・双頭・狼 |
| `charge` | 溜め | 1T溜め→次手番に大ダメージ | 新規（状態フラグ） | 巨人・竜 |
| `firstStrike` | 先制 | 戦闘開始時に必ず1手番先行 | `swift` の上位 | 奇襲ボス |
| `lifesteal` | 吸血 | 与ダメの一部をHP回復（魂drainとは別軸） | `SEIKOUZAN` の drain | 吸血鬼・寄生 |
| `pierce` | 貫通 | 後衛にも等倍／VIT一部無視 | `_rowMul`/`_evit` 調整 | 槍・弓・狙撃 |

**ギミック/構成系**

| 候補キー | 表示 | 効果 | 流用できる既存機構 | フレーバー目安 |
|---|---|---|---|---|
| `split` ★ | 分裂 | 物理被弾で確率2体に分裂 | `makeEnemy` 再生成 | スライム・粘体 |
| `deathSummon` | 末期召喚 | 死亡時に取り巻きを呼ぶ/自爆 | `summon`＋死亡フック | 卵・宿主 |
| `link` | 連結 | 護衛対象が生存中はダメージ無効 | `guard`/`escort` 拡張 | コア＋装甲 |
| `disguise` | 擬態 | 宝箱/別モンスターに化け初手奇襲 | `spawnMimic` 拡張 | ミミック系 |

★ = 低コストで効果大のおすすめ。

---

## モンスター def クイックリファレンス

```js
// bestiary.js に1エントリ追記する形（hp/atk は書かない）
{
  id: "bs_xxx",          // 名前空間付き・append-only（保存に残るので改名/削除NG）
  name: "○○",
  rank: 3,               // 1-10。出現ダンジョン帯を決める
  race: "beast",         // MON_RACES のいずれか（RACE_ABILITY の自動割当に影響）
  element: "fire",       // ELEMENTS: fire/water/wind/earth/light/dark/none
  artKey: "...",         // ARTS のプロトタイプ。固有デザイン必須（recolorでの差別化NG）
  desc: "ダーク・ファンタジー調の一文",

  // ── 特徴（現行・上の表から）──
  ability: "poison",     // 単発特殊（race既定を上書き。null で抑制）
  role: "summoner",      // summoner/healer/guard
  summonKey: "bs_yyy",   // summoner のとき必須
  escort: "bs_zzz",      // guard のとき任意
  physResist: 0.6, magWeak: 1.5, regen: 0.08,
  swift: true, evasive: true, pack: true,
  traits: ["..."],       // 表示専用の追加キー（任意）

  // boss: true,         // ボスフラグ（BOSS_ORDER 管理。直接 pool には入れない）
}
```

参照ソース: `src/combat.js`（戦闘挙動）／`src/dungeons/schema.js`（`TRAITS`・`monStats`・`defMonster`・element）／`src/souls.js`（`JOB_SKILLS`＝提案A用の呪文表）。
