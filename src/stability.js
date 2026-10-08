// 人業ごとの魂の安定度。実時間で回復し、満タンの間の時間は貯めない。
export const STABILITY_MAX = 100;
export const STABILITY_ENTRY_COST = 10;
export const STABILITY_RECOVERY_MS = 3 * 60 * 1000;
export function stabilityRecoveryMs() { return STABILITY_RECOVERY_MS; }

export function recoverStability(d, now = Date.now()) {
  if (!Number.isFinite(d.stability)) d.stability = STABILITY_MAX;
  d.stability = Math.max(0, Math.min(STABILITY_MAX, Math.floor(d.stability)));
  if (!Number.isFinite(d.stabilityAt)) d.stabilityAt = now;
  // 時計を戻した時は回復を増やさず、現在時刻から再開する。
  if (now < d.stabilityAt || d.stability === STABILITY_MAX) { d.stabilityAt = now; return 0; }
  const ticks = Math.floor((now - d.stabilityAt) / STABILITY_RECOVERY_MS);
  const gain = Math.min(STABILITY_MAX - d.stability, ticks);
  d.stability += gain;
  d.stabilityAt = d.stability === STABILITY_MAX ? now : d.stabilityAt + ticks * STABILITY_RECOVERY_MS;
  return gain;
}

export function stabilityWaitMs(d, now = Date.now(), target = STABILITY_ENTRY_COST) {
  recoverStability(d, now);
  return Math.max(0, (target - d.stability) * STABILITY_RECOVERY_MS - (now - d.stabilityAt));
}
