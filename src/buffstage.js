// 強化・弱体の「段」(段階制)。combat.js が戦闘で使い、画面 (itemview / game.js) が表示に使う。
//
// ATK・VIT・AGI・INT・PIE の5つは、能力ごとに −3〜+3 の「段」を1つだけ持つ。
//  - 強化 (+) と弱体 (−) は足し算で打ち消し合う (敵の 攻▲2 に 攻▼1 を当てれば 攻▲1 に戻る)
//  - 1段ごとの倍率は固定の表 (STAGE_UP / STAGE_DOWN)。重ねても ±3段 (×1.75 / ×0.5) で止まる
//  - 主 (ボス)・精鋭は弱体が −2段 (STRONG_MIN) までしか入らず、弱体の持続も1ターン短い
//  - 持続は能力ごとに1本: 同じ向きに掛け直すと長い方に延び、逆向きで押し戻した時は元の持続のまま
// 技の定義 (skilldefs / jobkit) は従来どおり倍率 (×1.4 / ×0.8) で書き、段数はここで換算する
// (stageOf: 表の中で一番近い段。ただし 1 でない倍率は最低でも1段)。
// 命中 (hit)・特技封じ・挑発・属性耐性ダウンなど、それ以外の効果は段を持たず従来の倍率のまま。

export const STAGED = new Set(["atk", "vit", "agi", "int", "pie"]);
export const STAGE_MAX = 3;
export const STRONG_MIN = -2;   // 主・精鋭に入る弱体の底
// この持続以上の効果は「戦闘の終わりまで」(激昂など)。札には残りターンを出さない
export const BATTLE_LONG = 99;
export const isBattleLong = (n) => n > BATTLE_LONG / 2; // 毎ラウンド減るので半分を越えていれば戦闘中ずっと
export const turnsLeftLabel = (n) => (isBattleLong(n) ? "" : String(n));
export const STAGE_UP = [1, 1.25, 1.5, 1.75];
export const STAGE_DOWN = [1, 0.8, 0.65, 0.5];

// 段 → 倍率
export function stageMul(n) {
  if (!n) return 1;
  const i = Math.min(STAGE_MAX, Math.abs(n));
  return n > 0 ? STAGE_UP[i] : STAGE_DOWN[i];
}
// 倍率 → 段 (符号つき)。1 でない倍率は最低1段
export function stageOf(mult) {
  if (!mult || mult === 1) return 0;
  const up = mult > 1, tbl = up ? STAGE_UP : STAGE_DOWN;
  const lm = Math.log(mult);
  let best = 1, bd = Infinity;
  for (let i = 1; i <= STAGE_MAX; i++) {
    const d = Math.abs(Math.log(tbl[i]) - lm);
    if (d < bd) { bd = d; best = i; }
  }
  return up ? best : -best;
}
// 効果1つの段 (段の効果は stage を持つ。旧来の記録は倍率から換算)
export function effectStage(ef) {
  if (!ef || !STAGED.has(ef.stat)) return 0;
  return ef.stage != null ? ef.stage : stageOf(ef.mult);
}
// 表示用: 「+2段」「−1段」
export function stageLabel(n) {
  return n > 0 ? `+${n}段` : n < 0 ? `−${-n}段` : "±0";
}
