// ===== 遠征 (第六章「氷結回廊」の結びで開く — FEATURES.expedition) =====
// 控えの人業 (隊に出していない・砕けていない・メイン魂を宿した者) を、踏破済みの迷宮へひとりで送り出す。
// 時間は実プレイ時間 (G.stats.playMs — game.js の5秒ごとの時計) で進み、戻ると ✦Soul・金貨・まれに収集品・まれに職業の魂を持ち帰る。
// ここは数の決まりだけ (game.js も ui も import しない)。状態 G.expedition と付与・画面は game.js / ui/expedition.js。
//
// 稼ぎの物差し (levelcurve.js):
//   1時間の戦闘数 = 隊が潜る時の BATTLES_PER_HOUR (57) × EXP_BATTLE_SHARE (1/8) ≈ 7.1戦 (1人で、無理をせず回る)
//   1戦の戦果 = その迷宮の推奨Lv の中ほど ((lv + lvTo) / 2) の refSoul / refGold
//   → 3人を同じ深さへ送っても、隊の稼ぎ (57戦 × 死体・出来事の上乗せ 1.3) の約29%。踏破済みの浅い迷宮ならずっと少ない
// 送った人業の強さ (メイン魂の Lv と推奨Lv の差):
//   推奨Lv 以上 = 1.0 (✦ には迷宮と同じ Lv差の減り soulLvMul を掛ける — 格下の迷宮で稼げすぎない)
//   推奨Lv −1〜−5 = 1Lv ごとに −4% (最低 0.8)
//   推奨Lv −5 より下 = 「途中で引き返した」: 時間の半分で戻り、戦果は全うした時の3割
// メイン魂には持ち帰った ✦ の 1/3 を経験値として入れる (隊の戦闘で魂に入る割合と同じ。控えの魂が少しだけ追いつく)

import { refSoul, refGold, BATTLES_PER_HOUR } from "./levelcurve.js";

export const EXP_MAX = 3;                     // 同時に出せる遠征の数 (1遠征 = 1人)
export const EXP_HOURS = [1, 2, 4];           // 選べる長さ (実プレイ時間の時間)
export const EXP_HOUR_MS = 60 * 60 * 1000;
export const EXP_BATTLE_SHARE = 1 / 8;        // 隊の1時間の戦闘数に対する割合
export const EXP_WEAK_STEP = 0.04;            // 推奨Lv に届かない1Lv ごとの減り
export const EXP_TURNBACK_GAP = 5;            // 推奨Lv − これ より Lv が低いと引き返す
export const EXP_TURNBACK_YIELD = 0.3;        // 引き返した時の戦果 (全うした時の割合)
export const EXP_MISC_PER_HOUR = 0.25;        // 1時間ごとの収集品の見込み
export const EXP_SOUL_PER_HOUR = 0.05;        // 1時間ごとの職業の魂の見込み
export const EXP_SOUL_EXP_RATE = 1 / 3;       // 持ち帰った ✦ のうち、メイン魂の経験値に入る割合

export const battlesPerHour = () => BATTLES_PER_HOUR * EXP_BATTLE_SHARE;

// 迷宮の推奨Lv の中ほど (遠征の物差し)
export function expRecLv(cfg) {
  const a = cfg?.lv || 1, b = cfg?.lvTo || a;
  return Math.round((a + b) / 2);
}

// 送る前の見込み。lv = 送る人業のメイン魂の Lv / lvMul(lv, rec) = ✦ の Lv差の減り (game.js soulLvMul)
//   返り値: { rec, gap (推奨Lv − Lv), back (引き返す), mul (強さの倍率), soulMul (✦ の Lv差の減り) }
export function expPlan(cfg, lv, lvMul = () => 1) {
  const rec = expRecLv(cfg);
  const gap = rec - (lv || 1);
  const back = gap > EXP_TURNBACK_GAP;
  const mul = gap <= 0 ? 1 : back ? 1 : Math.max(0.8, 1 - EXP_WEAK_STEP * gap);
  const soulMul = gap < 0 ? lvMul(lv || 1, rec) : 1;
  return { rec, gap, back, mul, soulMul };
}

// 実際に出ている長さ (ms)。引き返す時は選んだ長さの半分で戻る
export function expActualMs(durMs, back) { return back ? Math.round(durMs / 2) : durMs; }

// 持ち帰る ✦・金貨 (乱数なし)。ms = 実際に迷宮にいた長さ / fullMs = 選んだ長さ (引き返した時の3割の物差し)
export function expYield(cfg, plan, ms, fullMs = ms) {
  const rec = plan.rec;
  if (plan.back) {
    // 全うした時の3割 (遅れて引き返したのではなく、半分で戻ったので full の長さで測る)
    const b = battlesPerHour() * (fullMs / EXP_HOUR_MS) * EXP_TURNBACK_YIELD;
    return { battles: b, soul: Math.round(refSoul(rec) * b * plan.soulMul), gold: Math.round(refGold(rec) * b) };
  }
  const b = battlesPerHour() * (Math.max(0, ms) / EXP_HOUR_MS) * plan.mul;
  return { battles: b, soul: Math.round(refSoul(rec) * b * plan.soulMul), gold: Math.round(refGold(rec) * b) };
}

// 時間に比例した回数の抽選 (1時間ごとに p。端数の時間は端数の確率で1回)
export function expRolls(hours, p, rnd = Math.random) {
  let n = 0;
  const whole = Math.floor(hours), frac = hours - whole;
  for (let i = 0; i < whole; i++) if (rnd() < p) n++;
  if (frac > 0 && rnd() < p * frac) n++;
  return n;
}

// 残りの実プレイ時間 (分、切り上げ)
export function expLeftMin(e, playMs) { return Math.max(0, Math.ceil(((e.ends || 0) - (playMs || 0)) / 60000)); }
export function expDurLabel(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}時間${r}分` : `${h}時間`;
}
