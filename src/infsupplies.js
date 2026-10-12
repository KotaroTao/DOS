// 無限迷宮の補給。数は品の種類数ではなく、使える個数。
export const INF_BUY_CAP = 3;
export const infRecovery = (u) => !!(u && !u.recall && (u.heal || u.full || u.mp || u.mpFull || u.cure || u.revive));
export const infUseCount = (bag) => (bag || []).filter(it => it?.slot === "use").length;
export function infSupplyLeft(ab, floor) {
  return Math.max(0, INF_BUY_CAP - (ab?.supplyBought?.[floor] || 0));
}
export function infSpendSupply(ab, floor, n) {
  if (!ab || !Number.isInteger(n) || n < 0 || n > infSupplyLeft(ab, floor)) return false;
  (ab.supplyBought || (ab.supplyBought = {}))[floor] = (ab.supplyBought?.[floor] || 0) + n;
  return true;
}

