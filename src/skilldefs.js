// スキル (技・呪文) の定義。combat.js が SPELLS として再公開し、戦闘で解釈する。
//
// 種別 kind:
//   phys = 物理技 (攻撃力依存) / atk = 攻撃呪文 (INT依存) / heal = 回復 (PIE依存) / cure = 治療
//   buff = 強化・構え / debuff = 弱体・状態異常 (ダメージなし) / sleep = 眠り / mana = MP譲渡 / escape = 確実な逃走
// 対象 target: enemy / all-enemy / ally / all-ally / self
//
// 物理技の威力に効く項目:
//   power(攻撃力の倍率) / hits(多段) / critBonus(会心率加算, 1以上で必ず会心) / element(属性)
//   acc(命中補正 0〜1: 外れる確率をこの割合だけ消す。1 = 必中) / pierce(相手のVITを無視する割合)
//   intScale / agiScale / vitScale / pieScale (使い手のINT/AGI/VIT/PIE × 係数 × 倍率を上乗せ)
//   desperate(自分のHPが減るほど威力が上がる。HP0に近いほど最大2倍)
//   execute(HP30%以下の敵への倍率 = とどめ) / prey({races, mul} 種族特効) / scatter(ランダムな敵へN回)
// 命中後に付く効果 (物理技・攻撃呪文・弱体の共通):
//   debuff({atk/vit/agi/hit/int: 倍率}) — hit = 命中率 (目つぶし)
//   vuln({fire/water/wind/earth/light/dark/all: 倍率}) — 属性耐性ダウン (0.7 なら その属性の被ダメ ×1.43)
//   seal({chance, turns}) — 特技封じ (ブレス・状態異常攻撃・回復役・呼び手などの行動を封じる)
//   poison({chance, pct}) — 毒 (通常は毎ラウンド最大HPの5%。猛毒は10%、主には5%)
//   para(確率) — 麻痺 (手番を失いやすい) / sleepChance / flinchChance (怯み) / strip (強化を打ち消す)
//   charm(確率) — 魅了 (敵がその仲間に襲いかかる。傷を受けると解けやすい・主には35%の確率)
//   confuse(確率) — 混乱 (敵が敵味方を問わず殴る・ふらつく・主には半分の確率)
//   instakill({chance, races?}) — 即死 (主には効かない) / steal(盗む: 敵の所持金の割合) / plunder(倒すと金2倍)
//   drain / mpDrain (与ダメの割合を吸収) / hpCost (最大HPの割合を代償)
// 攻撃呪文: power (+ 術者INT×0.5) / gravity (敵の今のHPの割合ダメージ) / partyHeal (撃った後に味方全体を回復)
// 支援: buff(倍率) / taunt(挑発) / shield(仁王立ち) / stance:"counter"(反撃の構え) / charge(溜め) /
//   regen({pct, turns} リジェネ) / grantBarrier / grantEndure / cure(状態異常) / purge(弱体を解く)
//   ward({breath?, spell?: 軽減率}) — 守りの陣: 敵のブレス / 全体呪文から受けるダメージをその割合だけ減らす (dur ターン。重ねると最大 1/3 まで)
// 呪文の伸び: 攻撃呪文は INT で伸びる。光の呪文と faith: true の呪文は「祈りの呪文」で、INT と PIE の高い方で伸びる
// 迷宮で唱える技: kind "field" (戦闘の技の一覧には出ない。迷宮の手元のボタン (覚えた術が2つ以上なら「術」) から唱える)
//   float(階数) — 浮遊: 隊を宙に浮かせ、その階数のあいだ落とし穴に落ちず毒の床も踏まない
//   sense("enemy"|"chest"|"stairs") — 探りの術: その階のあいだ、まだめくっていない墓石の魔物 (種類・強さは分からない) / 宝箱 / 階段の位置を示す (stairs はさらに階段の周囲8マスの墓石をめくる)
//     (狩人の気配読み・盗賊の宝探し・司教の道しるべ。気配読みと宝探しはドックに専用のボタンを持つ)
// 持続 dur (既定3ターン。ラウンド開始ごとに1減る)
// buff / debuff の ATK・VIT・AGI・INT・PIE は倍率で書くが、戦闘では「段」(buffstage.js: 表で一番近い段、最低1段) に直る:
//   +1 ×1.25 / +2 ×1.5 / +3 ×1.75、−1 ×0.8 / −2 ×0.65 / −3 ×0.5。強化と弱体は段の足し算で打ち消し合い、±3段で止まる
//   (主・精鋭への弱体は −2段まで・持続 −1)。命中 (hit) などそれ以外の倍率は段を持たない

import { UNHOLY, BEASTS, DRAGONS, MACHINES, PREY_GROUPS } from "./jobkit/common.js";
import { JOBKIT_SKILLS } from "./jobkit/index.js";
export { PREY_GROUPS };

export const SPELLS = {
  // ================= 剛剣 (遅い物理職の柱: 命中を上げて当てにいく) =================
  NERAIUCHI:   { name: "狙い打ち", mp: 2, kind: "phys", power: 0.9, acc: 0.8, target: "enemy", desc: "力を抑えて確実に当てる（命中UP）" },
  KYOUGEKI:    { name: "強撃", mp: 3, kind: "phys", power: 1.7, target: "enemy", desc: "渾身の一撃" },
  TATEWARI:    { name: "兜割り", mp: 4, kind: "phys", power: 1.2, acc: 0.4, debuff: { vit: 0.8 }, target: "enemy", desc: "兜ごと打ち据え、防御を下げる" },
  WARCRY:      { name: "武者震い", mp: 4, kind: "buff", buff: { atk: 1.4 }, target: "self", desc: "自分のSTRを上げる" },
  DOUBLE:      { name: "二段斬り", mp: 4, kind: "phys", power: 0.9, hits: 2, target: "enemy", desc: "2回続けて斬る" },
  NAGIHARAI:   { name: "なぎ払い", mp: 6, kind: "phys", power: 0.7, acc: 0.3, target: "all-enemy", desc: "敵全体をなぎ払う" },
  SHINGANGEKI: { name: "心眼撃", mp: 6, kind: "phys", power: 1.6, acc: 0.9, target: "enemy", desc: "心の眼で動きを読む一撃（命中大UP）" },
  HAISUI:      { name: "背水の一撃", mp: 6, kind: "phys", power: 1.5, desperate: true, acc: 0.4, target: "enemy", desc: "自分の傷が深いほど威力が増す" },
  IATSU:       { name: "威圧", mp: 6, kind: "debuff", debuff: { atk: 0.8 }, target: "all-enemy", desc: "殺気で敵全体の攻撃を下げる" },
  TAME:        { name: "気合溜め", mp: 3, kind: "buff", charge: 2.0, target: "self", desc: "次の物理攻撃の威力を2倍にする" },
  MIDARE:      { name: "乱れ斬り", mp: 9, kind: "phys", power: 0.95, acc: 0.3, target: "all-enemy", desc: "敵全体を斬り乱す" },
  KIKOKU:      { name: "きこく斬", mp: 13, kind: "phys", power: 3.0, acc: 0.9, execute: 2, target: "enemy", desc: "弱った敵を確実に仕留める（命中UP・とどめ）" },
  GOUZAN:      { name: "豪斬", mp: 10, kind: "phys", power: 2.6, acc: 0.5, pierce: 0.3, target: "enemy", desc: "鎧ごと断ち割る重い一刀" },
  ZANTETSU:    { name: "鉄断ち", mp: 16, kind: "phys", power: 3.8, acc: 0.8, pierce: 0.6, target: "enemy", desc: "鉄をも断つ（防御を無視・命中UP）" },
  YOROIDACHI:  { name: "鎧断ち", mp: 14, kind: "phys", power: 2.4, acc: 0.7, debuff: { vit: 0.65 }, target: "enemy", desc: "鎧を断ち、防御を大きく下げる" },
  SANREN:      { name: "三連斬", mp: 10, kind: "phys", power: 1.0, hits: 3, acc: 0.4, target: "enemy", desc: "三たび刃を振るう" },
  DAISENPUU:   { name: "大旋風", mp: 18, kind: "phys", power: 1.9, acc: 0.6, target: "all-enemy", desc: "戦場をなぐ大回転斬り" },
  KISHINKA:    { name: "鬼神化", mp: 12, kind: "buff", buff: { atk: 1.6, agi: 1.2 }, target: "self", desc: "自分のSTRと素早さを大きく上げる" },
  RANBU:       { name: "乱舞", mp: 16, kind: "phys", power: 0.9, hits: 4, acc: 0.5, target: "enemy", desc: "四連の乱舞で斬り刻む" },
  HADAN:       { name: "覇断", mp: 24, kind: "phys", power: 6.0, acc: 1, target: "enemy", desc: "覇気の一刀は外れない（必中）" },
  AMATSUKAZE:  { name: "天津風", mp: 22, kind: "phys", power: 2.4, acc: 0.7, target: "all-enemy", desc: "天を裂く烈風の全体斬" },
  TENCHIZAN:   { name: "天地斬", mp: 28, kind: "phys", power: 7.5, acc: 1, pierce: 0.5, target: "enemy", desc: "天地を断つ（必中・防御を半ば無視）" },
  ROKUREN:     { name: "六連斬", mp: 24, kind: "phys", power: 0.75, hits: 6, acc: 0.7, target: "enemy", desc: "六たび閃く連撃" },
  KIKOKURANBU: { name: "鬼哭乱舞", mp: 30, kind: "phys", power: 3.0, acc: 0.9, target: "all-enemy", desc: "鬼すら泣く全体乱舞（命中UP）" },
  HAOUZAN:     { name: "覇王斬", mp: 32, kind: "phys", power: 9.0, acc: 1, execute: 1.5, target: "enemy", desc: "必中の大斬撃。弱った敵には更に重い" },
  METSUKYAKU:  { name: "滅却・終ノ太刀", mp: 40, kind: "phys", power: 11.0, acc: 1, pierce: 1, target: "enemy", desc: "必中・防御無視の終ノ太刀" },

  // ================= 盾 (守り手) =================
  SHIELDBASH:     { name: "盾打ち", mp: 3, kind: "phys", power: 0.8, vitScale: 0.8, acc: 0.6, flinchChance: 0.2, target: "enemy", desc: "盾で殴る。VITで威力が伸び、怯ませる" },
  CHOUHATSU:      { name: "挑発", mp: 3, kind: "buff", taunt: true, buff: { vit: 1.15 }, target: "self", desc: "敵の攻撃を自分に引き付ける" },
  PROTECT:        { name: "プロテクション", mp: 4, kind: "buff", buff: { vit: 1.3 }, target: "ally", desc: "味方単体の防御を上げる" },
  KOTE:           { name: "小手打ち", mp: 4, kind: "phys", power: 1.0, acc: 0.6, debuff: { atk: 0.8 }, target: "enemy", desc: "腕を打ち、攻撃を下げる" },
  IRONWALL:       { name: "鉄壁", mp: 5, kind: "buff", buff: { vit: 1.6 }, dur: 4, target: "self", desc: "自分の防御を大きく上げる" },
  NIOUDACHI:      { name: "仁王立ち", mp: 6, kind: "buff", shield: true, dur: 2, target: "self", desc: "味方への単体攻撃を代わりに受ける" },
  HANGEKI:        { name: "反撃の構え", mp: 5, kind: "buff", stance: "counter", dur: 2, target: "self", desc: "次の手番まで、物理攻撃に必ず反撃する" },
  GUARDALL:       { name: "守りの号令", mp: 6, kind: "buff", buff: { vit: 1.25 }, target: "all-ally", desc: "味方全体の防御を上げる" },
  JOUMON:         { name: "城門崩し", mp: 12, kind: "phys", power: 1.8, vitScale: 1.2, acc: 0.9, debuff: { vit: 0.7 }, target: "enemy", desc: "VITを乗せた盾撃で防御を砕く（命中UP）" },
  BOUJIN:         { name: "防陣", mp: 10, kind: "buff", buff: { vit: 1.4 }, target: "all-ally", desc: "味方全体の防御を大きく上げる" },
  SHIELDCHARGE:   { name: "盾突進", mp: 10, kind: "phys", power: 1.6, vitScale: 1.0, acc: 0.8, flinchChance: 0.35, target: "enemy", desc: "盾ごと突進して怯ませる" },
  OUJOU:          { name: "王城の構え", mp: 18, kind: "buff", buff: { vit: 1.6 }, dur: 4, target: "all-ally", desc: "味方全体を城壁と化す" },
  SHUGOHOUKOU:    { name: "守護咆哮", mp: 10, kind: "buff", taunt: true, buff: { vit: 1.4, atk: 1.2 }, target: "self", desc: "咆哮で敵を引き付け、攻守を高める" },
  JOUSAITSUKI:    { name: "城塞突き", mp: 18, kind: "phys", power: 3.2, vitScale: 1.5, pierce: 0.5, acc: 1, target: "enemy", desc: "必中・防御を半ば無視する盾突き" },
  TEPPEKIJIN:     { name: "鉄壁陣", mp: 16, kind: "heal", power: 18, buff: { vit: 1.3 }, target: "all-ally", desc: "味方全体を癒し、防御を上げる" },
  FURAKUNOTATE:   { name: "不落の盾", mp: 20, kind: "buff", buff: { vit: 1.7 }, target: "all-ally", desc: "味方全体の防御を大きく上げる" },
  BANRAI:         { name: "万雷の盾撃", mp: 24, kind: "phys", power: 1.3, vitScale: 1.0, hits: 3, acc: 0.9, flinchChance: 0.3, target: "enemy", desc: "三連の盾撃で怯ませる" },
  SHUGOKEKKAI:    { name: "守護結界", mp: 22, kind: "buff", buff: { vit: 1.4 }, grantBarrier: 1, target: "all-ally", desc: "味方全体の防御を上げ、魔障壁を張る" },
  JOUSAIKUZUSHI:  { name: "城塞崩し", mp: 28, kind: "phys", power: 5.0, vitScale: 2.0, acc: 1, debuff: { vit: 0.7 }, target: "enemy", desc: "必中の盾撃で防御を砕く" },
  TESSAINAGI:     { name: "鉄盾なぎ", mp: 22, kind: "phys", power: 1.6, vitScale: 0.8, acc: 0.8, flinchChance: 0.2, target: "all-enemy", desc: "大盾で敵全体をなぎ、怯ませる" },
  KISHIOU:        { name: "騎士王の威光", mp: 30, kind: "heal", power: 30, buff: { atk: 1.2, vit: 1.3 }, target: "all-ally", desc: "味方全体を癒し、攻守を高める" },
  FUDOUJIN:       { name: "不動明王陣", mp: 26, kind: "buff", shield: true, stance: "counter", buff: { vit: 1.5 }, target: "self", desc: "味方を庇い、受けた物理に必ず反撃する" },
  DAIGOUREI:      { name: "守護の大号令", mp: 30, kind: "buff", buff: { vit: 1.5, atk: 1.25 }, target: "all-ally", desc: "味方全体の攻守を高める" },
  FURAKUJOU:      { name: "不落城", mp: 40, kind: "heal", power: 40, buff: { vit: 1.8 }, grantBarrier: 1, purge: true, target: "all-ally", desc: "味方全体を癒し、守り、弱体を解く" },
  KOUBOUITTAI:    { name: "攻防一体", mp: 10, kind: "buff", buff: { atk: 1.35, vit: 1.35 }, stance: "counter", dur: 3, target: "self", desc: "攻守を上げ、物理攻撃に必ず反撃する構え" },
  FUUMANOTATE:    { name: "封魔の盾", mp: 8, kind: "phys", power: 1.0, vitScale: 0.8, acc: 0.7, seal: { chance: 0.7, turns: 3 }, target: "enemy", desc: "盾撃と共に敵の特技を封じる" },
  SEINOTATE:      { name: "庇護の聖盾", mp: 8, kind: "buff", shield: true, buff: { vit: 1.3 }, grantBarrier: 1, dur: 2, target: "self", desc: "味方を庇い、自分に魔障壁を張る" },

  // ================= 回復・祈り =================
  DIOS:       { name: "ヒール", mp: 2, kind: "heal", power: 14, target: "ally", desc: "傷を癒す" },
  DIAL:       { name: "リカバー", mp: 4, kind: "heal", power: 28, target: "ally", desc: "大きく回復" },
  MADIOS:     { name: "フルヒール", mp: 20, kind: "heal", power: 999, target: "ally", desc: "味方一人のHPを全快させる" },
  SHINYU:     { name: "神癒", mp: 16, kind: "heal", power: 100, target: "ally", desc: "神の癒しで深手を塞ぐ" },
  DIOSALL:    { name: "ヒールオール", mp: 6, kind: "heal", power: 18, target: "all-ally", desc: "味方全員を回復" },
  DIALALL:    { name: "リカバーオール", mp: 12, kind: "heal", power: 40, target: "all-ally", desc: "味方全員を大きく回復" },
  IYASHINAMI: { name: "癒しの波", mp: 22, kind: "heal", power: 70, target: "all-ally", desc: "癒しの大波が味方を包む" },
  DAIFUKUIN:  { name: "大福音", mp: 36, kind: "heal", power: 80, cure: true, purge: true, target: "all-ally", desc: "味方全員を癒し、状態異常と弱体を祓う" },
  CURE:       { name: "キュア", mp: 3, kind: "cure", cure: ["poison"], target: "ally", desc: "味方一人の毒・猛毒を治す" },
  KIYOME:     { name: "清めの祈り", mp: 8, kind: "cure", purge: true, target: "all-ally", desc: "味方全員の状態異常と弱体を治す" },
  REVIVE:     { name: "リバイブ", mp: 8, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 0.5, desc: "戦闘不能をHP50%で蘇生" },
  RESURRECT:  { name: "リザレクション", mp: 14, kind: "heal", power: 0, target: "ally", revive: true, revivePct: 1.0, desc: "戦闘不能をHP100%で蘇生" },
  FUKUIN:     { name: "復活の福音", mp: 30, kind: "heal", power: 40, revive: true, revivePct: 0.6, target: "all-ally", desc: "倒れた味方を蘇らせ、全員を癒す" },
  KAMIWAZA:   { name: "神の御業", mp: 44, kind: "heal", power: 999, cure: true, purge: true, revive: true, revivePct: 1.0, target: "all-ally", desc: "倒れた者すら完全に呼び戻す" },
  REGEN:      { name: "リジェネ", mp: 4, kind: "buff", regen: { pct: 0.08, turns: 4 }, target: "ally", desc: "味方単体のHPが毎ターン回復する" },
  REGENALL:   { name: "慈雨", mp: 12, kind: "buff", regen: { pct: 0.07, turns: 4 }, target: "all-ally", desc: "味方全体のHPが毎ターン回復する" },
  BLESS:      { name: "ブレス", mp: 4, kind: "buff", buff: { atk: 1.3 }, target: "ally", desc: "味方単体のSTRを上げる" },
  SEIBETSU:   { name: "聖別", mp: 16, kind: "buff", buff: { vit: 1.3 }, cure: true, purge: true, target: "all-ally", desc: "味方全体を守り、穢れと弱体を祓う" },
  SEIKUNOKAGO:{ name: "聖句の加護", mp: 12, kind: "heal", power: 36, grantEndure: true, target: "ally", desc: "癒しと共に、致死を一度耐える力を授ける" },
  DAISEIKITOU:{ name: "大聖祈祷", mp: 14, kind: "heal", power: 30, cure: true, regen: { pct: 0.05, turns: 3 }, target: "all-ally", desc: "味方全員を癒し、穢れを祓い、癒しを残す" },
  TENKEINOINORI: { name: "天啓の祈り", mp: 26, kind: "heal", power: 50, buff: { vit: 1.3 }, target: "all-ally", desc: "味方全員を癒し、防御を上げる" },
  SEIIKINOKANE: { name: "聖域の鐘", mp: 12, kind: "buff", buff: { vit: 1.2 }, cure: ["sleep", "confuse"], target: "ally", desc: "一人の守りを高め、眠り・混乱を治す" },
  KYOUKOUNOSHUKUFUKU: { name: "教皇の祝福", mp: 36, kind: "buff", buff: { atk: 1.3, vit: 1.3, agi: 1.2 }, regen: { pct: 0.08, turns: 4 }, target: "all-ally", desc: "味方全体の攻守と素早さを上げ、癒しを残す" },
  MANAGIFT:   { name: "魔力の譲渡", mp: 8, kind: "mana", power: 8, target: "ally", desc: "自分の魔力を味方に分け与える" },
  SHINTOU:    { name: "調息", mp: 6, kind: "heal", power: 30, cure: ["poison"], target: "self", desc: "自分の傷を癒し、毒・猛毒を治す" },

  // ================= 聖なる攻め =================
  HOLYRAY:        { name: "聖光", mp: 3, kind: "atk", power: 14, element: "light", prey: { races: UNHOLY, mul: 1.5 }, target: "enemy", desc: "聖なる光条。不浄の者に強い" },
  HOLYLIGHT:      { name: "ホーリーライト", mp: 6, kind: "atk", power: 18, element: "light", target: "all-enemy", desc: "柔らかな聖光が敵全体を灼く" },
  SAINTRAY:       { name: "聖閃", mp: 9, kind: "atk", power: 24, element: "light", strip: true, target: "all-enemy", desc: "敵全体を貫き、強化を打ち消す" },
  SHINBATSU:      { name: "神罰", mp: 22, kind: "atk", power: 66, element: "light", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "神罰の一閃。特技も封じる" },
  SEIMETSUKOU:    { name: "聖滅光", mp: 20, kind: "atk", power: 50, element: "light", target: "all-enemy", desc: "全敵を浄化する聖滅の光" },
  SEIKOURETSU:    { name: "聖光烈", mp: 28, kind: "atk", power: 90, element: "light", target: "enemy", desc: "凝縮した聖光が敵を撃ち抜く" },
  SEIMETSUREKKOU: { name: "聖滅烈光", mp: 30, kind: "atk", power: 70, element: "light", prey: { races: UNHOLY, mul: 1.5 }, target: "all-enemy", desc: "全敵を焼き払う。不浄の者に強い" },
  SEISUISHO:      { name: "聖水撒", mp: 14, kind: "atk", power: 20, element: "light", vuln: { light: 0.7 }, prey: { races: UNHOLY, mul: 1.5 }, target: "all-enemy", desc: "敵全体の光耐性を下げ、不浄の者を焼く" },
  HAJA:           { name: "破邪の剣", mp: 4, kind: "phys", power: 1.3, element: "light", acc: 0.6, prey: { races: UNHOLY, mul: 1.8 }, target: "enemy", desc: "不死・幽鬼・悪魔に大ダメージ" },
  SEIKOUZAN:      { name: "聖光斬", mp: 12, kind: "phys", power: 2.2, pieScale: 0.8, element: "light", drain: 0.3, acc: 0.9, target: "enemy", desc: "PIEを乗せた聖剣で斬り、傷を癒す（命中UP）" },
  JUUJIZAN:       { name: "十字斬", mp: 12, kind: "phys", power: 1.5, hits: 2, pieScale: 0.4, element: "light", acc: 0.9, prey: { races: UNHOLY, mul: 1.5 }, target: "enemy", desc: "十字に斬る二連撃。不浄の者に強い" },
  SEISEN:         { name: "進軍の聖歌", mp: 10, kind: "buff", buff: { atk: 1.25, agi: 1.1 }, target: "all-ally", desc: "味方全体のSTRと素早さを上げる" },
  JOUKA:          { name: "浄火", mp: 8, kind: "phys", power: 1.6, element: "fire", acc: 0.6, vuln: { fire: 0.75 }, target: "enemy", desc: "浄めの炎で斬り、火耐性を下げる" },
  SEIKEN:         { name: "聖剣奮迅", mp: 14, kind: "atk", power: 20, element: "light", partyHeal: 16, target: "all-enemy", desc: "聖剣の輝きで敵をなぎ、味方を癒す" },
  HAJANOTACHI:    { name: "破邪の太刀", mp: 12, kind: "phys", power: 2.2, element: "light", critBonus: 0.25, prey: { races: UNHOLY, mul: 2.0 }, target: "enemy", desc: "不浄の者に2倍のダメージ" },
  TAIMA:          { name: "退魔の印", mp: 10, kind: "debuff", instakill: { chance: 0.5, races: UNHOLY }, target: "enemy", desc: "不死・幽鬼・悪魔を一撃で祓う（主には効かない）" },
  TAIMAJIN:       { name: "退魔陣", mp: 24, kind: "debuff", instakill: { chance: 0.4, races: UNHOLY }, target: "all-enemy", desc: "敵全体の不浄の者を祓う（主には効かない）" },
  HARAI:          { name: "祓い", mp: 6, kind: "debuff", strip: true, seal: { chance: 0.6, turns: 3 }, target: "enemy", desc: "敵の強化を打ち消し、特技を封じる" },
  KIYOMEMIZU:     { name: "清め水", mp: 5, kind: "debuff", vuln: { light: 0.75 }, target: "all-enemy", desc: "敵全体の光耐性を下げる" },
  DANZAINOTSUCHI: { name: "断罪の鉄槌", mp: 12, kind: "phys", power: 2.2, element: "light", acc: 0.9, execute: 2, flinchChance: 0.35, target: "enemy", desc: "弱った敵に重い聖槌（命中UP・とどめ・怯み）" },
  KAKEI:          { name: "火刑", mp: 8, kind: "atk", power: 24, element: "fire", vuln: { fire: 0.7 }, faith: true, target: "enemy", desc: "炎で焼き、火耐性を下げる" },
  SHINMON:        { name: "審問", mp: 6, kind: "debuff", seal: { chance: 0.8, turns: 3 }, debuff: { atk: 0.85 }, target: "enemy", desc: "敵の特技を封じ、攻撃を下げる" },
  SAIGONOSHINPAN: { name: "最後の審判", mp: 36, kind: "atk", power: 80, element: "light", seal: { chance: 0.6, turns: 3 }, strip: true, target: "all-enemy", desc: "敵全体を裁き、強化を消し、特技を封じる" },

  // ================= 魔法 (属性呪文) =================
  // 火
  HALITO:    { name: "ファイアアロー", mp: 2, kind: "atk", power: 10, element: "fire", target: "enemy", desc: "炎の矢" },
  MAHALITO:  { name: "ファイアストーム", mp: 6, kind: "atk", power: 22, element: "fire", target: "all-enemy", desc: "敵全体を焼く業火" },
  LAHALITO:  { name: "インフェルノ", mp: 11, kind: "atk", power: 36, element: "fire", target: "enemy", desc: "一体を焼き尽くす灼熱の業炎" },
  TILTOWAIT: { name: "エクスプロージョン", mp: 16, kind: "atk", power: 48, element: "fire", target: "all-enemy", desc: "全体を消し飛ばす大爆発" },
  ENBU:      { name: "炎舞", mp: 14, kind: "atk", power: 40, element: "fire", target: "all-enemy", desc: "渦巻く炎が敵全体を舞い焼く" },
  GOKUEN:    { name: "獄炎", mp: 20, kind: "atk", power: 64, element: "fire", target: "enemy", desc: "獄の業火で一体を焼き尽くす" },
  GOKUENRAN: { name: "獄炎嵐", mp: 30, kind: "atk", power: 90, element: "fire", target: "all-enemy", desc: "獄炎の大嵐が戦場を呑む" },
  // 水 (水の呪文は素早さを鈍らせることがある)
  ICENEEDLE:   { name: "アイスニードル", mp: 3, kind: "atk", power: 13, element: "water", target: "enemy", desc: "氷の針" },
  AQUAWAVE:    { name: "アクアウェイブ", mp: 6, kind: "atk", power: 20, element: "water", target: "all-enemy", desc: "押し寄せる水流が敵全体を打つ" },
  ICELANCE:    { name: "アイスランス", mp: 9, kind: "atk", power: 30, element: "water", debuff: { agi: 0.85 }, target: "enemy", desc: "氷の槍で貫き、素早さを下げる" },
  MADALT:      { name: "ブリザード", mp: 10, kind: "atk", power: 34, element: "water", target: "all-enemy", desc: "全体を貫く氷嵐" },
  HYORETSU:    { name: "氷烈", mp: 14, kind: "atk", power: 40, element: "water", debuff: { agi: 0.8 }, target: "enemy", desc: "凍てつく槍。素早さを下げる" },
  HYOUGA:      { name: "氷河", mp: 20, kind: "atk", power: 56, element: "water", target: "all-enemy", desc: "全てを凍てつかせる氷河" },
  ZETTAIREIDO: { name: "絶対零度", mp: 26, kind: "atk", power: 90, element: "water", para: 0.3, target: "enemy", desc: "一体を凍砕し、凍えで麻痺させる" },
  // 風 (雷は痺れさせることがある)
  KAMAITACHI: { name: "かまいたち", mp: 4, kind: "atk", power: 17, element: "wind", target: "enemy", desc: "真空の刃" },
  WINDSTORM:  { name: "ウィンドストーム", mp: 6, kind: "atk", power: 20, element: "wind", target: "all-enemy", desc: "吹き荒れる風が敵全体を裂く" },
  RAITEI:     { name: "落雷", mp: 9, kind: "atk", power: 28, element: "wind", para: 0.25, target: "enemy", desc: "落雷で撃ち、痺れさせる" },
  TORNADO:    { name: "トルネード", mp: 10, kind: "atk", power: 34, element: "wind", target: "all-enemy", desc: "竜巻が敵全体を巻き上げる" },
  RAIJIN:     { name: "雷神", mp: 16, kind: "atk", power: 46, element: "wind", target: "all-enemy", desc: "雷神の怒りが戦場を貫く" },
  GOURAI:     { name: "轟雷", mp: 24, kind: "atk", power: 76, element: "wind", para: 0.3, target: "enemy", desc: "轟く雷で撃ち、痺れさせる" },
  RAIMEIRAN:  { name: "雷鳴嵐", mp: 22, kind: "atk", power: 64, element: "wind", para: 0.15, target: "all-enemy", desc: "雷鳴の大嵐。痺れさせることがある" },
  // 土 (岩は怯ませることがある)
  ISHITSUBUTE: { name: "石つぶて", mp: 3, kind: "atk", power: 12, element: "earth", target: "enemy", desc: "鋭い石つぶて" },
  EARTHQUAKE:  { name: "アースクエイク", mp: 7, kind: "atk", power: 22, element: "earth", target: "all-enemy", desc: "大地を揺らし敵全体を打つ" },
  ROCKBLAST:   { name: "ストーンブラスト", mp: 8, kind: "atk", power: 30, element: "earth", flinchChance: 0.3, target: "enemy", desc: "岩塊の弾丸。怯ませる" },
  LANDSLIDE:   { name: "ランドスライド", mp: 12, kind: "atk", power: 36, element: "earth", target: "all-enemy", desc: "崩れ落ちる土砂が敵全体を呑む" },
  DAICHIWARI:  { name: "大地割", mp: 16, kind: "atk", power: 50, element: "earth", debuff: { vit: 0.8 }, target: "enemy", desc: "大地ごと断ち割り、防御を下げる" },
  GANSAI:      { name: "岩砕", mp: 26, kind: "atk", power: 88, element: "earth", flinchChance: 0.4, target: "enemy", desc: "巨岩で押し潰し、怯ませる" },
  METEOR:      { name: "メテオ", mp: 26, kind: "atk", power: 80, element: "earth", target: "all-enemy", desc: "天より墜つる隕石の雨" },
  // 闇
  SHADOWBOLT: { name: "シャドウボルト", mp: 3, kind: "atk", power: 13, element: "dark", target: "enemy", desc: "影の矢" },
  DARKMIST:   { name: "ダークミスト", mp: 6, kind: "atk", power: 18, element: "dark", debuff: { hit: 0.85 }, target: "all-enemy", desc: "闇の霧で敵全体を撃ち、目を曇らせる" },
  DARKBLAST:  { name: "ダークブラスト", mp: 9, kind: "atk", power: 32, element: "dark", target: "enemy", desc: "凝縮した闇を叩きつける" },
  DARKNESS:   { name: "ダークネス", mp: 12, kind: "atk", power: 36, element: "dark", target: "all-enemy", desc: "深い闇が敵全体を呑む" },
  MEIKOKU:    { name: "冥府の嘆き", mp: 21, kind: "atk", power: 66, element: "dark", debuff: { atk: 0.8 }, target: "enemy", desc: "魂を裂き、攻撃を下げる" },
  KOKUUHA:    { name: "虚空波", mp: 30, kind: "atk", power: 100, element: "dark", target: "enemy", desc: "虚空より放つ闇の波動" },
  MEIANRAN:   { name: "冥闇嵐", mp: 28, kind: "atk", power: 80, element: "dark", target: "all-enemy", desc: "冥府の闇が嵐となって戦場を呑む" },
  // 無属性
  SEISAI:     { name: "星砕", mp: 22, kind: "atk", power: 64, target: "all-enemy", desc: "降り注ぐ星々（無属性）" },
  TENPENCHII: { name: "天変地異", mp: 36, kind: "atk", power: 110, target: "all-enemy", desc: "天地を覆す大災厄（無属性）" },
  KYOKUDAI:   { name: "極大消滅", mp: 44, kind: "atk", power: 140, target: "all-enemy", desc: "万象を消滅させる極大呪文（無属性）" },

  // ================= 呪い・術の技 =================
  KATINO:   { name: "スリープ", mp: 3, kind: "sleep", target: "all-enemy", desc: "敵全体を眠らせる" },
  DISPEL:   { name: "ディスペル", mp: 5, kind: "debuff", strip: true, target: "all-enemy", desc: "敵全体の強化を打ち消す" },
  SEAL:     { name: "封魔の印", mp: 4, kind: "debuff", seal: { chance: 0.8, turns: 3 }, target: "enemy", desc: "敵の特技を封じる" },
  SEALALL:  { name: "封魔陣", mp: 10, kind: "debuff", seal: { chance: 0.6, turns: 3 }, target: "all-enemy", desc: "敵全体の特技を封じる" },
  BLIND:    { name: "目くらまし", mp: 3, kind: "debuff", debuff: { hit: 0.7 }, target: "enemy", desc: "敵の命中率を下げる" },
  BLINDALL: { name: "幻霧", mp: 8, kind: "debuff", debuff: { hit: 0.75 }, confuse: 0.25, target: "all-enemy", desc: "敵全体の命中率を下げ、混乱させることがある" },
  // 心を乱す術: 魅了 (敵が仲間を襲う) / 混乱 (敵味方を問わず殴る)。魅了した敵を殴ると正気に戻りやすいので、他の敵から倒す
  MIWAKU:   { name: "魅惑の囁き", mp: 5, kind: "debuff", charm: 0.55, target: "enemy", desc: "心を奪い、敵を仲間に襲いかからせる（魅了）" },
  KUGUTSU:  { name: "傀儡の糸", mp: 8, kind: "debuff", charm: 0.7, debuff: { agi: 0.85 }, target: "enemy", desc: "魂に糸を掛けて操り、仲間を襲わせる（魅了）" },
  KEISEI:   { name: "傾城の幻", mp: 16, kind: "debuff", charm: 0.35, target: "all-enemy", desc: "敵全体を妖しい幻で魅了し、同士討ちを誘う" },
  GENWAKU:  { name: "幻惑", mp: 4, kind: "debuff", confuse: 0.65, target: "enemy", desc: "幻で惑わせ、敵を混乱させる" },
  KYOURAN:  { name: "狂乱の霧", mp: 10, kind: "debuff", confuse: 0.4, target: "all-enemy", desc: "狂気の霧で敵全体を混乱させる" },
  KAGENUI:  { name: "影縫い", mp: 8, kind: "debuff", debuff: { agi: 0.65 }, target: "all-enemy", desc: "敵全体の素早さを下げる" },
  NOROI:    { name: "呪縛", mp: 5, kind: "debuff", debuff: { atk: 0.8, vit: 0.8, agi: 0.8 }, target: "enemy", desc: "敵の攻撃・防御・素早さを下げる" },
  SUIJAKU:  { name: "衰弱の呪い", mp: 8, kind: "debuff", debuff: { atk: 0.8 }, target: "all-enemy", desc: "敵全体の攻撃を下げる" },
  DOKUGIRI: { name: "毒霧", mp: 10, kind: "atk", power: 14, poison: { chance: 0.7, pct: 0.05 }, target: "all-enemy", desc: "敵全体を毒にする（毎ターン最大HPの5%）" },
  FUDOKU:   { name: "腐毒の呪い", mp: 8, kind: "debuff", poison: { chance: 0.9, pct: 0.1 }, target: "enemy", desc: "猛毒にする（毎ターン最大HPの10%）" },
  DEATH:    { name: "呪殺", mp: 10, kind: "debuff", instakill: { chance: 0.35 }, target: "enemy", desc: "敵を即死させる（主には効かない）" },
  DEATHALL: { name: "死の舞踏", mp: 24, kind: "debuff", instakill: { chance: 0.25 }, target: "all-enemy", desc: "敵全体を即死させる（主には効かない）" },
  GRAVITY:  { name: "グラビティ", mp: 6, kind: "atk", gravity: 0.25, target: "enemy", desc: "敵の今のHPの25%を削る（主には弱い）" },
  GRAVIGA:  { name: "グラビガ", mp: 18, kind: "atk", gravity: 0.3, target: "all-enemy", desc: "敵全体の今のHPの30%を削る（主には弱い）" },
  MARK_FIRE:  { name: "火の刻印", mp: 3, kind: "debuff", vuln: { fire: 0.7 }, target: "enemy", desc: "敵の火耐性を下げる" },
  MARK_WATER: { name: "水の刻印", mp: 3, kind: "debuff", vuln: { water: 0.7 }, target: "enemy", desc: "敵の水耐性を下げる" },
  ELEMBREAK:  { name: "属性崩し", mp: 8, kind: "debuff", vuln: { all: 0.75 }, target: "enemy", desc: "敵の全属性の耐性を下げる" },
  SEISHIN:    { name: "精神統一", mp: 4, kind: "buff", buff: { int: 1.4 }, target: "self", desc: "自分のINTを上げ、呪文を強める" },
  MARYOKUBOUSOU: { name: "魔力暴走", mp: 20, kind: "atk", power: 76, hpCost: 0.2, target: "all-enemy", desc: "HPを代償に暴走する魔力を放つ（無属性）" },
  MAGATSU:  { name: "禍津の呪", mp: 30, kind: "debuff", debuff: { atk: 0.75, vit: 0.75, agi: 0.75 }, poison: { chance: 0.6, pct: 0.05 }, seal: { chance: 0.5, turns: 3 }, target: "all-enemy", desc: "敵全体を弱らせ、毒し、特技を封じる" },
  KYOMU:    { name: "秘奥・虚無", mp: 36, kind: "atk", power: 120, strip: true, vuln: { all: 0.75 }, target: "enemy", desc: "強化を消し、全属性の耐性を崩す（無属性）" },
  MEIFUNOMON: { name: "冥府の門", mp: 40, kind: "atk", power: 90, element: "dark", instakill: { chance: 0.3 }, target: "all-enemy", desc: "闇で呑み、即死させることがある" },
  KOUSHUNOHOUJIN: { name: "攻守の法陣", mp: 14, kind: "buff", buff: { vit: 1.25 }, debuffAll: { atk: 0.85 }, target: "all-ally", desc: "味方を守り、敵全体の攻撃を下げる" },
  // 守りの陣 (第5層からの、ブレス・全体呪文を多用する魔物への備え)
  RYUURINJIN:     { name: "鱗壁の陣", mp: 10, kind: "buff", ward: { breath: 0.5 }, tech: true, target: "all-ally", desc: "竜鱗の構えで隊を固め、ブレスのダメージを半減する" },
  MAYOKE:         { name: "魔除けの帳", mp: 10, kind: "buff", ward: { spell: 0.5 }, target: "all-ally", desc: "魔除けの帳で隊を包み、敵の呪文のダメージを半減する" },
  // 迷宮で唱える (戦闘では使わない)
  FUYUU:          { name: "浮遊", mp: 8, kind: "field", float: 3, target: "all-ally", desc: "隊を宙に浮かせる。3階のあいだ落とし穴に落ちず、毒の床も踏まない（迷宮で唱える）" },
  HOUSHOUHEKI:    { name: "法障壁", mp: 13, kind: "buff", grantBarrier: 1, target: "all-ally", desc: "味方全体に魔障壁を張る" },
  DAIKEKKAI:      { name: "大結界陣", mp: 30, kind: "buff", buff: { vit: 1.5 }, grantBarrier: 2, purge: true, target: "all-ally", desc: "守りを上げ、魔障壁を重ね、弱体を解く" },
  KASUMINOTOBARI: { name: "霞の帳", mp: 12, kind: "heal", power: 16, debuffAll: { hit: 0.75 }, target: "all-ally", desc: "味方を癒し、敵全体の命中率を下げる" },
  SHINRANOSABAKI: { name: "森羅の裁き", mp: 15, kind: "atk", power: 34, vuln: { all: 0.8 }, target: "all-enemy", desc: "撃ち抜いた敵全体の全属性耐性を崩す" },
  SHINENNOHADOU:  { name: "深淵の波動", mp: 13, kind: "atk", power: 44, element: "dark", seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "闇の波動。特技を封じる" },
  MEIKONGURAI:    { name: "冥魂喰らい", mp: 10, kind: "atk", power: 28, element: "dark", drain: 0.5, target: "enemy", desc: "闇で魂を喰らい、己の命とする" },
  KINJUKAICHOU:   { name: "禁呪開帳", mp: 12, kind: "atk", power: 38, element: "dark", critBonus: 0.25, strip: true, target: "enemy", desc: "禁断の呪撃。強化を打ち消す" },
  MARYOKUGOUDATSU:{ name: "魔力強奪", mp: 7, kind: "atk", power: 30, element: "dark", mpDrain: 0.3, strip: true, target: "enemy", desc: "強化を剥ぎ、魔力を奪う" },
  GOMA:           { name: "護摩焚き", mp: 10, kind: "atk", power: 18, element: "fire", partyHeal: 10, faith: true, target: "all-enemy", desc: "炎で敵全体を焼き、味方を癒す" },
  KUJI:           { name: "九字護身法", mp: 10, kind: "debuff", seal: { chance: 0.5, turns: 3 }, target: "all-enemy", desc: "敵全体の特技を封じる" },

  // ================= 盗賊・狩人・暗殺 (速さで攻める) =================
  STEAL:        { name: "盗む", mp: 2, kind: "phys", power: 0.6, acc: 0.5, steal: 0.6, target: "enemy", desc: "攻撃と同時に金品を盗む" },
  POISONSTAB:   { name: "毒刃", mp: 3, kind: "phys", power: 1.0, poison: { chance: 0.7, pct: 0.05 }, target: "enemy", desc: "毒にする（毎ターン最大HPの5%）" },
  KEMURIDAMA:   { name: "煙玉", mp: 3, kind: "escape", target: "self", desc: "確実に戦闘から逃げる" },
  KAGEWATARI:   { name: "影渡り", mp: 3, kind: "escape", target: "self", desc: "影に紛れ、確実に戦闘から逃げる" },
  KASUMIGAKURE: { name: "霞隠れ", mp: 3, kind: "escape", target: "self", desc: "霞に隠れ、確実に戦闘から逃げる" },
  SUNAKAKE:     { name: "砂かけ", mp: 3, kind: "phys", power: 0.5, acc: 0.8, debuff: { hit: 0.7 }, target: "enemy", desc: "目つぶしで敵の命中率を下げる" },
  KASUMEGIRI:   { name: "霞斬り", mp: 4, kind: "phys", power: 1.0, agiScale: 0.4, debuff: { agi: 0.8 }, target: "enemy", desc: "AGIを乗せて斬り、素早さを下げる" },
  SHIBIREBARI:  { name: "痺れ針", mp: 5, kind: "phys", power: 0.7, acc: 0.5, para: 0.5, target: "enemy", desc: "敵を麻痺させる" },
  ASSASSINATE:  { name: "急所突き", mp: 5, kind: "phys", power: 1.4, critBonus: 0.5, target: "enemy", desc: "会心の出やすい一撃" },
  MAKIBISHI:    { name: "撒き菱", mp: 7, kind: "debuff", debuff: { agi: 0.75 }, target: "all-enemy", desc: "敵全体の素早さを下げる" },
  ASHIBARAI:    { name: "足払い", mp: 4, kind: "phys", power: 0.8, acc: 0.6, flinchChance: 0.5, target: "enemy", desc: "足をすくって怯ませる" },
  YAMIUCHI:     { name: "闇討ち", mp: 4, kind: "phys", power: 1.3, element: "dark", critBonus: 0.35, target: "enemy", desc: "闇から急所を突く" },
  YOIYAMIUCHI:  { name: "宵闇打ち", mp: 8, kind: "phys", power: 1.6, element: "dark", sleepChance: 0.5, target: "enemy", desc: "闇の一撃で眠らせる" },
  OBORO:        { name: "朧抜き", mp: 12, kind: "phys", power: 2.4, agiScale: 0.8, critBonus: 0.4, acc: 1, target: "enemy", desc: "朧の太刀筋はかわせない（必中・会心UP）" },
  TSUJIKAZE:    { name: "辻風", mp: 10, kind: "phys", power: 1.0, critBonus: 0.15, target: "all-enemy", desc: "旋風のごとく全体を斬り抜ける" },
  SHIPPUTSUKI:  { name: "疾風突き", mp: 9, kind: "phys", power: 1.4, agiScale: 1.0, target: "enemy", desc: "AGIで威力が伸びる刺突" },
  ZETSUEI:      { name: "絶影", mp: 14, kind: "phys", power: 1.0, hits: 3, agiScale: 0.4, critBonus: 0.25, target: "enemy", desc: "AGIを乗せた神速の三連撃" },
  MOUDOKUSASHI: { name: "猛毒刺し", mp: 12, kind: "phys", power: 1.8, poison: { chance: 0.9, pct: 0.1 }, target: "enemy", desc: "猛毒にする（毎ターン最大HPの10%）" },
  ENGETSUJIN:   { name: "円月刃", mp: 14, kind: "phys", power: 1.4, critBonus: 0.15, target: "all-enemy", desc: "円を描く刃が敵全体を裂く" },
  KAGEUCHI:     { name: "影討ち", mp: 14, kind: "phys", power: 1.0, hits: 3, critBonus: 0.3, target: "enemy", desc: "影から繰り出す三連の刺突" },
  KUBIHANE:     { name: "首はね", mp: 16, kind: "phys", power: 3.0, critBonus: 0.3, execute: 2.5, target: "enemy", desc: "弱った敵の首を落とす（とどめ）" },
  RANBUTSUKI:   { name: "乱舞突き", mp: 18, kind: "phys", power: 0.9, hits: 4, agiScale: 0.3, target: "enemy", desc: "舞うように刻む四連刺し" },
  SHUNSATSU:    { name: "瞬殺", mp: 22, kind: "phys", power: 4.5, agiScale: 1.5, critBonus: 0.4, target: "enemy", desc: "AGIで大きく伸びる神速の一突き" },
  TSUMUJIKAZE:  { name: "旋風乱れ", mp: 22, kind: "phys", power: 1.8, critBonus: 0.2, target: "all-enemy", desc: "旋風となって全体を斬り乱す" },
  ZANKOU:       { name: "斬光", mp: 24, kind: "phys", power: 0.8, hits: 5, agiScale: 0.3, critBonus: 0.3, target: "enemy", desc: "光の速さで刻む五連撃" },
  ANSATSU:      { name: "暗殺", mp: 28, kind: "phys", power: 5.0, critBonus: 0.5, instakill: { chance: 0.3 }, target: "enemy", desc: "仕留め損ねても即死を狙う（主には効かない）" },
  SENKOUZAN:    { name: "閃光斬", mp: 28, kind: "phys", power: 2.2, agiScale: 0.5, critBonus: 0.25, target: "all-enemy", desc: "閃光のごとく全体をなぐ" },
  HISSATSU:     { name: "必殺奥義", mp: 32, kind: "phys", power: 8.0, critBonus: 0.5, execute: 2, target: "enemy", desc: "弱った敵を確実に葬る奥義" },
  MUGEN:        { name: "夢幻泡影", mp: 30, kind: "phys", power: 0.7, hits: 6, agiScale: 0.3, critBonus: 0.4, target: "enemy", desc: "幻のごとき六連の乱刺" },
  ZANSEI:       { name: "斬星", mp: 40, kind: "phys", power: 10.0, agiScale: 2.0, critBonus: 0.7, target: "enemy", desc: "AGIを極めた者の奥義" },
  SHINOKOKUIN:  { name: "死の刻印", mp: 12, kind: "phys", power: 2.2, element: "dark", critBonus: 0.3, instakill: { chance: 0.25 }, target: "enemy", desc: "死を刻む刃。即死させることがある" },
  MEIDOU:       { name: "冥道・無明", mp: 34, kind: "phys", power: 7.0, element: "dark", critBonus: 0.5, instakill: { chance: 0.35 }, target: "enemy", desc: "冥府へ送る刃。即死させることがある" },
  OIHAGI:       { name: "追い剥ぎ", mp: 10, kind: "phys", power: 2.2, steal: 0.8, plunder: true, target: "enemy", desc: "金品を奪い、倒せば所持金が2倍" },
  TENKAGOMEN:   { name: "天下御免", mp: 30, kind: "phys", power: 2.4, steal: 1.0, plunder: true, target: "all-enemy", desc: "敵全体から金品を奪い尽くす" },
  // 狩人
  DOKUYA:     { name: "毒矢", mp: 3, kind: "phys", power: 0.9, poison: { chance: 0.8, pct: 0.05 }, target: "enemy", desc: "毒にする（毎ターン最大HPの5%）" },
  ASHIDOME:   { name: "足止め", mp: 4, kind: "phys", power: 0.9, acc: 0.6, debuff: { agi: 0.7 }, target: "enemy", desc: "足を射抜き、素早さを大きく下げる" },
  SOGEKI:     { name: "狙撃", mp: 5, kind: "phys", power: 1.5, acc: 1, critBonus: 0.2, target: "enemy", desc: "必ず当たる狙い澄ました一射" },
  YANOAME:    { name: "矢の雨", mp: 8, kind: "phys", power: 0.75, scatter: 4, target: "all-enemy", desc: "ランダムな敵に4回射掛ける" },
  ABURA:      { name: "油壺", mp: 4, kind: "debuff", vuln: { fire: 0.65 }, debuff: { agi: 0.9 }, target: "enemy", desc: "油を浴びせ、火に弱くする" },
  SHIBIREYA:  { name: "痺れ矢", mp: 5, kind: "phys", power: 0.9, para: 0.5, target: "enemy", desc: "敵を麻痺させる" },
  KEMONOGARI: { name: "獣狩り", mp: 8, kind: "phys", power: 1.8, prey: { races: BEASTS, mul: 2 }, target: "enemy", desc: "獣・虫・爬虫などに2倍のダメージ" },
  KUBIKARI:   { name: "首狩り", mp: 13, kind: "phys", power: 2.4, critBonus: 0.4, execute: 2, target: "enemy", desc: "弱った獲物の首を狩る（とどめ・会心UP）" },
  TSURANUKI:  { name: "貫き撃ち", mp: 12, kind: "phys", power: 2.6, pierce: 1, acc: 0.8, target: "enemy", desc: "防御を無視して貫く（命中UP）" },
  RENSHA:     { name: "連射", mp: 12, kind: "phys", power: 0.95, hits: 3, acc: 0.5, target: "enemy", desc: "続けざまに三射" },
  SENNYA:     { name: "千矢", mp: 20, kind: "phys", power: 0.85, scatter: 7, target: "all-enemy", desc: "ランダムな敵に7回射掛ける" },
  RYUUSEISHA: { name: "流星射", mp: 30, kind: "phys", power: 6.0, acc: 1, pierce: 0.5, critBonus: 0.3, target: "enemy", desc: "必中・防御を半ば無視する一射" },
  // 侍
  GONOSEN:       { name: "後の先", mp: 4, kind: "buff", stance: "counter", dur: 2, target: "self", desc: "次の手番まで、物理攻撃に必ず反撃する" },
  MEIKYOU:       { name: "明鏡止水", mp: 8, kind: "buff", buff: { agi: 1.3, atk: 1.2 }, target: "self", desc: "自分の素早さとSTRを上げる" },
  ISSEN:         { name: "一閃", mp: 8, kind: "phys", power: 1.6, critBonus: 1, target: "enemy", desc: "必ず会心となる一太刀" },
  TSUBAMEGAESHI: { name: "燕返し", mp: 16, kind: "phys", power: 1.3, hits: 2, critBonus: 0.15, acc: 0.8, target: "enemy", desc: "返す刀で二度斬る。命中が高く、会心しやすい" },
  // 狂戦士
  SUTEMI:       { name: "捨て身", mp: 4, kind: "buff", buff: { atk: 1.5, vit: 0.7 }, target: "self", desc: "STRを大きく上げ、防御を捨てる" },
  CHINOKAWAKI:  { name: "血の渇き", mp: 8, kind: "phys", power: 2.0, drain: 0.4, acc: 0.5, target: "enemy", desc: "斬った血でHPを癒す" },
  KIJINKUDAKI:  { name: "鬼神砕き", mp: 14, kind: "phys", power: 3.0, desperate: true, acc: 0.8, debuff: { vit: 0.75 }, target: "enemy", desc: "傷が深いほど重く、防御も砕く" },
  SHURADOU:     { name: "修羅道", mp: 10, kind: "phys", power: 2.4, desperate: true, critBonus: 0.2, target: "enemy", desc: "傷が深いほど威力が増す" },
  SHURAZAN:     { name: "修羅斬", mp: 20, kind: "phys", power: 5.0, desperate: true, acc: 0.8, target: "enemy", desc: "傷が深いほど重い一刀（命中UP）" },
  ASHURAZAN:    { name: "阿修羅斬", mp: 15, kind: "phys", power: 0.8, hits: 5, acc: 0.6, execute: 1.5, target: "enemy", desc: "怒涛の五連斬。弱った敵に重い" },
  RINNE:        { name: "六道輪廻", mp: 42, kind: "phys", power: 1.6, hits: 6, desperate: true, acc: 0.9, target: "enemy", desc: "傷が深いほど重い六連の極み" },
  // 武僧・修験者
  HAKKEI:       { name: "発勁", mp: 6, kind: "phys", power: 1.4, pierce: 1, acc: 0.7, target: "enemy", desc: "内に響く掌打。防御を無視する" },
  NOUTEN:       { name: "脳天打ち", mp: 4, kind: "phys", power: 1.1, acc: 0.6, confuse: 0.4, target: "enemy", desc: "頭を打ち据え、混乱させる" },
  TENKETSU:     { name: "点穴", mp: 5, kind: "phys", power: 0.9, acc: 0.7, seal: { chance: 0.7, turns: 3 }, target: "enemy", desc: "経穴を突き、特技を封じる" },
  KONGOURENDA:  { name: "金剛連打", mp: 12, kind: "phys", power: 0.95, hits: 3, pieScale: 0.3, acc: 0.7, target: "enemy", desc: "PIEも乗る三連打（命中UP）" },
  KONGOUTAI:    { name: "金剛体", mp: 8, kind: "buff", buff: { vit: 1.5 }, regen: { pct: 0.05, turns: 3 }, target: "self", desc: "身を固めて防御を上げ、傷を癒し続ける" },
  HOUKEN:       { name: "崩山拳", mp: 16, kind: "phys", power: 3.6, pierce: 1, acc: 0.9, target: "enemy", desc: "防御を無視する剛拳（命中UP）" },
  HYAKURETSU:   { name: "百裂拳", mp: 20, kind: "phys", power: 0.6, hits: 6, acc: 0.6, target: "enemy", desc: "拳の嵐で六連打" },
  MUSOUKEN:     { name: "無想拳", mp: 24, kind: "phys", power: 6.5, acc: 1, pierce: 0.5, target: "enemy", desc: "無想の一撃は外れない（必中）" },
  TENMAKEN:     { name: "天魔拳", mp: 26, kind: "phys", power: 2.4, acc: 0.8, flinchChance: 0.25, target: "all-enemy", desc: "敵全体を打ち据え、怯ませる" },
  KONGOUMUSOU:  { name: "金剛無双", mp: 40, kind: "phys", power: 10.5, pieScale: 1.0, acc: 1, pierce: 1, target: "enemy", desc: "必中・防御無視の極拳" },
  SHASHINNOGYOU:{ name: "捨身の行", mp: 8, kind: "phys", power: 3.4, hpCost: 0.15, acc: 0.8, target: "enemy", desc: "HPを削って放つ荒行の一撃" },
  GONGENOROSHI: { name: "権現降ろし", mp: 24, kind: "buff", buff: { atk: 1.6, vit: 1.4 }, regen: { pct: 0.1, turns: 3 }, cure: true, target: "self", desc: "権現を宿し、攻守を上げて癒し続ける" },
  // 魔法剣・魔闘 (INTで伸びる。魔法剣は斬った属性の耐性を崩す)
  MAKEN_FIRE:  { name: "魔法剣・火", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "fire", vuln: { fire: 0.8 }, target: "enemy", desc: "炎の刃で斬り、火耐性を下げる" },
  MAKEN_WATER: { name: "魔法剣・水", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "water", vuln: { water: 0.8 }, target: "enemy", desc: "水の刃で斬り、水耐性を下げる" },
  MAKEN_WIND:  { name: "魔法剣・風", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "wind", vuln: { wind: 0.8 }, target: "enemy", desc: "風の刃で斬り、風耐性を下げる" },
  MAKEN_EARTH: { name: "魔法剣・土", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "earth", vuln: { earth: 0.8 }, target: "enemy", desc: "岩の刃で斬り、土耐性を下げる" },
  MAKEN_LIGHT: { name: "魔法剣・光", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "light", vuln: { light: 0.8 }, target: "enemy", desc: "光の刃で斬り、光耐性を下げる" },
  MAKEN_DARK:  { name: "魔法剣・闇", mp: 4, kind: "phys", power: 1.2, intScale: 0.6, element: "dark", vuln: { dark: 0.8 }, target: "enemy", desc: "闇の刃で斬り、闇耐性を下げる" },
  MAENZAN:     { name: "魔焔斬", mp: 12, kind: "phys", power: 2.6, intScale: 0.8, element: "fire", acc: 0.7, vuln: { fire: 0.7 }, target: "enemy", desc: "魔焔で焼き断ち、火耐性を大きく下げる" },
  ROKUDOU:     { name: "魔法剣・六道", mp: 30, kind: "phys", power: 1.8, intScale: 1.0, acc: 0.8, vuln: { all: 0.8 }, target: "all-enemy", desc: "敵全体を斬り、全属性の耐性を崩す" },
  BAKUENKEN:   { name: "爆炎拳", mp: 5, kind: "phys", power: 1.3, intScale: 0.6, element: "fire", acc: 0.6, target: "enemy", desc: "INTで伸びる炎の拳（命中UP）" },
  HAMANOKEN:   { name: "破魔の拳", mp: 12, kind: "phys", power: 2.3, intScale: 0.6, acc: 0.8, strip: true, debuff: { atk: 0.85 }, target: "enemy", desc: "強化を打ち消し、攻撃を下げる拳" },
  SAIKEN:      { name: "砕拳", mp: 10, kind: "phys", power: 2.0, pierce: 0.5, acc: 0.7, prey: { races: MACHINES, mul: 2 }, target: "enemy", desc: "構造体・機鎧・精霊に2倍のダメージ" },
  MAJINKEN:    { name: "魔神拳", mp: 18, kind: "phys", power: 3.5, intScale: 1.0, acc: 0.9, target: "enemy", desc: "INTを込めた魔神の拳（命中UP）" },
  TOUSHINHAGEKI:{ name: "闘神覇撃", mp: 36, kind: "phys", power: 9.0, intScale: 1.2, acc: 1, target: "enemy", desc: "必中の闘神の一撃" },
  // 魔騎士
  ANKOKU:       { name: "暗黒剣", mp: 6, kind: "phys", power: 2.2, element: "dark", hpCost: 0.08, acc: 0.7, target: "enemy", desc: "HPを代償に闇の剛剣を振るう（命中UP）" },
  KYUUKETSU:    { name: "吸血剣", mp: 8, kind: "phys", power: 1.6, element: "dark", drain: 0.4, target: "enemy", desc: "斬った血でHPを癒す" },
  YAMINOKOROMO: { name: "闇の衣", mp: 8, kind: "buff", buff: { vit: 1.3 }, grantBarrier: 2, target: "self", desc: "防御を上げ、魔障壁を2回分まとう" },
  JUBAKU:       { name: "呪縛剣", mp: 10, kind: "phys", power: 1.6, element: "dark", acc: 0.6, debuff: { atk: 0.8, agi: 0.8 }, target: "enemy", desc: "STRと素早さを縛る呪剣" },
  MAGUINOTACHI: { name: "魔喰いの太刀", mp: 8, kind: "phys", power: 2.2, mpDrain: 0.25, acc: 0.6, seal: { chance: 0.5, turns: 3 }, target: "enemy", desc: "魔力を喰らい、特技を封じる" },
  ANKOKUSHUUEN: { name: "暗黒剣・終焉", mp: 30, kind: "phys", power: 8.0, element: "dark", hpCost: 0.15, acc: 1, target: "enemy", desc: "HPを代償にした必中の終焉" },
  // 竜騎士
  TENSHOU:      { name: "天翔撃", mp: 5, kind: "phys", power: 1.3, acc: 0.9, target: "enemy", desc: "跳び上がって打ち下ろす（命中大UP）" },
  RYUURIN:      { name: "竜鱗", mp: 8, kind: "buff", buff: { vit: 1.4 }, grantBarrier: 1, target: "self", desc: "竜鱗をまとい、防御と魔障壁を得る" },
  RYUUKOU:      { name: "竜の咆哮", mp: 10, kind: "debuff", debuff: { atk: 0.8 }, flinchChance: 0.3, target: "all-enemy", desc: "敵全体の攻撃を下げ、怯ませる" },
  RYUZETSU:     { name: "竜墜とし", mp: 14, kind: "phys", power: 3.0, acc: 1, pierce: 0.5, prey: { races: DRAGONS, mul: 1.5 }, target: "enemy", desc: "必中の急降下。竜に強い" },
  RYUUEN:       { name: "竜炎", mp: 14, kind: "phys", power: 1.2, vitScale: 0.6, element: "fire", acc: 0.6, target: "all-enemy", desc: "竜の炎をまとって敵全体をなぐ" },
  RYUUJINKOURIN:{ name: "竜神降臨", mp: 26, kind: "buff", buff: { atk: 1.5, vit: 1.5, agi: 1.2 }, grantBarrier: 1, target: "self", desc: "竜神を宿し、攻守と素早さを上げる" },
  RYUUTEIGEKI:  { name: "竜帝の一撃", mp: 42, kind: "phys", power: 11.0, element: "fire", acc: 1, pierce: 1, prey: { races: DRAGONS, mul: 1.5 }, target: "enemy", desc: "必中・防御無視。竜に強い" },
  // 勇者
  YUUSHANOICHIGEKI: { name: "勇者の一撃", mp: 6, kind: "phys", power: 1.8, acc: 1, target: "enemy", desc: "決して外れぬ勇者の剣（必中）" },
  KOBU:         { name: "鼓舞", mp: 10, kind: "buff", buff: { atk: 1.2, agi: 1.2 }, target: "all-ally", desc: "味方全体のSTRと素早さを上げる" },
  RAIKOUKEN:    { name: "雷光剣", mp: 10, kind: "phys", power: 2.0, element: "wind", acc: 0.8, para: 0.3, target: "enemy", desc: "雷をまとう剣で痺れさせる" },
  RAIJINKEN:    { name: "雷神剣", mp: 34, kind: "phys", power: 3.2, element: "wind", acc: 1, para: 0.3, target: "all-enemy", desc: "必中の雷剣が敵全体を痺れさせる" },
  TENMEINOKEN:  { name: "天命の剣", mp: 44, kind: "phys", power: 12.0, element: "light", acc: 1, pierce: 1, partyHeal: 40, target: "enemy", desc: "必中・防御無視の一刀。味方も癒す" },

  // ================= 属性の物理技 (属性ごとに持ち味) =================
  // 火=威力 / 水=素早さ低下 / 風=多段・会心 / 土=防御低下・怯み / 光=HP吸収 / 闇=MP吸収・攻撃力低下
  KAENGIRI:       { name: "火炎斬り", mp: 3, kind: "phys", power: 1.6, element: "fire", target: "enemy", desc: "炎をまとった刃で斬る" },
  KAENNAGI:       { name: "火焔なぎ", mp: 8, kind: "phys", power: 0.85, element: "fire", target: "all-enemy", desc: "炎の刃で敵全体をなぐ" },
  GURENZAN:       { name: "紅蓮斬", mp: 11, kind: "phys", power: 3.0, element: "fire", acc: 0.4, target: "enemy", desc: "紅蓮の炎ごと叩き斬る" },
  GOUKADAN:       { name: "業火断", mp: 20, kind: "phys", power: 5.6, element: "fire", acc: 0.7, target: "enemy", desc: "業火を宿した刃で断つ（命中UP）" },
  SHOUNETSURANBU: { name: "焦熱乱舞", mp: 28, kind: "phys", power: 2.6, element: "fire", acc: 0.7, target: "all-enemy", desc: "焦熱の乱舞が敵陣を焼く" },
  SUIGETSU:   { name: "水月斬り", mp: 4, kind: "phys", power: 1.3, element: "water", debuff: { agi: 0.85 }, target: "enemy", desc: "斬って素早さを下げる" },
  UZUSHIO:    { name: "渦潮斬り", mp: 9, kind: "phys", power: 0.75, element: "water", debuff: { agi: 0.85 }, target: "all-enemy", desc: "敵全体を斬り、素早さを下げる" },
  HYOUJIN:    { name: "氷刃", mp: 11, kind: "phys", power: 2.6, element: "water", debuff: { agi: 0.75 }, target: "enemy", desc: "凍てつく刃で素早さを大きく下げる" },
  TOUGADAN:   { name: "凍牙断", mp: 20, kind: "phys", power: 5.0, element: "water", para: 0.3, target: "enemy", desc: "芯まで凍えさせ、麻痺させる" },
  DAIKAISHOU: { name: "大津波", mp: 28, kind: "phys", power: 2.3, element: "water", debuff: { agi: 0.8 }, target: "all-enemy", desc: "敵陣を呑み、素早さを下げる" },
  SHIPPUUGIRI: { name: "疾風斬り", mp: 4, kind: "phys", power: 0.8, hits: 2, agiScale: 0.3, element: "wind", target: "enemy", desc: "AGIを乗せた疾風の二連撃" },
  REPPUU:      { name: "烈風斬", mp: 8, kind: "phys", power: 0.8, critBonus: 0.1, element: "wind", target: "all-enemy", desc: "烈風の刃が敵全体を切り裂く" },
  FUUGA:       { name: "風牙", mp: 11, kind: "phys", power: 1.0, hits: 3, agiScale: 0.3, critBonus: 0.1, element: "wind", target: "enemy", desc: "風の牙が三度食らいつく" },
  KAMIKAZE:    { name: "神風", mp: 21, kind: "phys", power: 1.4, hits: 4, agiScale: 0.3, critBonus: 0.15, element: "wind", target: "enemy", desc: "神風のごとき四連撃" },
  TENRAN:      { name: "天嵐", mp: 27, kind: "phys", power: 2.3, critBonus: 0.2, element: "wind", target: "all-enemy", desc: "嵐の刃が敵陣を刻む" },
  IWAKUDAKI:    { name: "岩砕き", mp: 4, kind: "phys", power: 1.3, element: "earth", acc: 0.4, debuff: { vit: 0.85 }, target: "enemy", desc: "岩をも砕き、防御を下げる" },
  CHIRETSU:     { name: "地裂撃", mp: 9, kind: "phys", power: 0.75, element: "earth", flinchChance: 0.2, target: "all-enemy", desc: "大地を裂き、敵全体を怯ませる" },
  GANOTOSHI:    { name: "岩落とし", mp: 12, kind: "phys", power: 2.6, element: "earth", acc: 0.5, debuff: { vit: 0.8 }, flinchChance: 0.2, target: "enemy", desc: "防御を下げ、怯ませる剛撃" },
  YAMAKUZUSHI:  { name: "山崩し", mp: 20, kind: "phys", power: 5.0, element: "earth", acc: 0.7, debuff: { vit: 0.7 }, target: "enemy", desc: "防御を大きく砕く（命中UP）" },
  DAICHIMEIDOU: { name: "大地鳴動", mp: 28, kind: "phys", power: 2.3, element: "earth", acc: 0.6, flinchChance: 0.25, target: "all-enemy", desc: "大地を鳴動させ、敵陣を怯ませる" },
  KOUJIN:      { name: "光刃", mp: 4, kind: "phys", power: 1.3, element: "light", drain: 0.2, target: "enemy", desc: "光の刃で斬り、傷を癒す" },
  KOURINZAN:   { name: "光輪斬", mp: 9, kind: "phys", power: 0.75, element: "light", drain: 0.1, target: "all-enemy", desc: "光の輪で敵全体を斬り、傷を癒す" },
  SEIGEKI:     { name: "聖撃", mp: 12, kind: "phys", power: 2.2, pieScale: 0.5, element: "light", drain: 0.25, acc: 0.6, target: "enemy", desc: "PIEを乗せて打ち、傷を癒す（命中UP）" },
  TENKOUKEN:   { name: "天光剣", mp: 21, kind: "phys", power: 4.6, pieScale: 1.0, element: "light", drain: 0.3, acc: 1, target: "enemy", desc: "必中の光剣で断ち、命を取り戻す" },
  KOUBOURANBU: { name: "光芒乱舞", mp: 28, kind: "phys", power: 2.3, element: "light", drain: 0.15, acc: 0.6, target: "all-enemy", desc: "光芒の乱舞で敵陣を斬り、傷を癒す" },
  YAMIBA:     { name: "闇刃", mp: 3, kind: "phys", power: 1.3, element: "dark", mpDrain: 0.15, target: "enemy", desc: "闇の刃が魔力をすする" },
  KOKUEINAGI: { name: "黒影なぎ", mp: 9, kind: "phys", power: 0.75, element: "dark", debuff: { atk: 0.9 }, target: "all-enemy", desc: "敵全体の攻撃を削ぐ" },
  MEIJIN:     { name: "冥刃", mp: 10, kind: "phys", power: 2.6, element: "dark", mpDrain: 0.2, target: "enemy", desc: "冥府の刃で魔力を奪う" },
  MEIFUZAN:   { name: "冥府斬", mp: 20, kind: "phys", power: 5.0, element: "dark", mpDrain: 0.2, debuff: { atk: 0.8 }, target: "enemy", desc: "力と魔力を奪う斬撃" },
  TOKOYAMI:   { name: "常闇", mp: 27, kind: "phys", power: 2.3, element: "dark", debuff: { atk: 0.85 }, target: "all-enemy", desc: "常闇で敵陣を斬り、力を削ぐ" },
};

// 呪文ではなく「技」として繰り出すもの (戦闘ログが「〜の○○！」になる)。物理技 (phys) は常に技
const TECHS = [
  "WARCRY", "IATSU", "TAME", "KISHINKA", "CHOUHATSU", "IRONWALL", "NIOUDACHI", "HANGEKI", "GUARDALL", "BOUJIN", "OUJOU",
  "SHUGOHOUKOU", "FURAKUNOTATE", "FUDOUJIN", "DAIGOUREI", "KOUBOUITTAI", "SEINOTATE", "SEISEN", "KEMURIDAMA", "KAGEWATARI",
  "KASUMIGAKURE", "MAKIBISHI", "ABURA", "GONOSEN", "MEIKYOU", "SUTEMI", "KONGOUTAI", "GONGENOROSHI", "RYUURIN", "RYUUKOU",
  "RYUUJINKOURIN", "KOBU", "SHINTOU",
];
// 職ごとの固有技 (src/jobkit/<職>.js の skills) を合流する。キー・名前の重複は読み込み時に弾く
for (const key in JOBKIT_SKILLS) {
  if (SPELLS[key]) throw new Error(`skilldefs: 固有技 ${key} が共通の技と重複`);
  SPELLS[key] = JOBKIT_SKILLS[key];
}
{
  const seen = {};
  for (const key in SPELLS) {
    const nm = SPELLS[key].name;
    if (seen[nm]) console.warn(`skilldefs: 技の名前「${nm}」が ${seen[nm]} と ${key} で重複`);
    seen[nm] = key;
  }
}
for (const key in SPELLS) {
  const sp = SPELLS[key];
  if (sp.dur == null) sp.dur = 3; // 強化/弱体などの持続ターン (既定3)
  if (TECHS.includes(key)) sp.tech = true;
}
