// 控えの結社。見識の節目と旧記録の引き継ぎを一か所で扱う。
export const ORDER_MILESTONES = [
  { insight: 1000, seats: 1 }, { insight: 1500, seats: 2 },
  { insight: 2000, rate: .05 }, { insight: 2500, seats: 3 },
  { insight: 3000, seats: 4 }, { insight: 3500, rate: .10 },
  { insight: 4000, seats: 5 }, { insight: 4500, seats: 6 },
  { insight: 5000, rate: .15 }, { insight: 5500, seats: 7 },
  { insight: 6000, seats: 8 }, { insight: 6500, rate: .20 },
  ...Array.from({ length: 8 }, (_, i) => ({ insight: 7000 + i * 500, seats: 9 + i })),
];
// 旧IDは保存参照・心得向けに維持する。伝習の旧IDは元の割合に対応。
export const ORDER_FEATURES = Object.fromEntries([
  ...ORDER_MILESTONES.filter(m => m.seats).map(m => [m.seats === 1 ? "order" : `order${m.seats}`, m.insight]),
  ["orderLearning", 2000], ["orderLearning10", 3500], ["orderLearning2", 5000], ["orderLearning3", 6500],
]);
export function orderProgress(insight, order = {}) {
  const p = { seats: order.legacySeats || 0, rate: order.legacyRate || 0 };
  for (const m of ORDER_MILESTONES) if (insight >= m.insight) {
    p.seats = Math.max(p.seats, m.seats || 0);
    p.rate = Math.max(p.rate, m.rate || 0);
  }
  return p;
}
export function nextOrderMilestone(insight, order) {
  const p = orderProgress(insight, order);
  return ORDER_MILESTONES.find(m => m.insight > insight && (m.seats > p.seats || m.rate > p.rate)) || null;
}
// 読み込み時だけ旧ストーリー条件を評価する。新しい報告によって席が増えることはない。
export function migrateOrder(state, chapters) {
  state.order ||= { picks: [] };
  const o = state.order;
  if (!Array.isArray(o.picks)) o.picks = [];
  if (o.insightVersion === 1) return;
  const reported = state.world?.reported || {};
  const met = (chapter, count = "finale") => {
    const ch = chapters.find(c => c.no === chapter);
    return !!ch && (count === "finale" ? !!reported[ch.finale] : ch.dungeons.filter(id => reported[id]).length >= count);
  };
  let seats = Math.min(8, o.picks.length);
  for (const [i, ch, n] of [[1,1,"finale"],[2,2,"finale"],[3,7,2],[4,8,"finale"],[5,11,"finale"],[6,13,"finale"],[7,15,"finale"],[8,17,"finale"]]) {
    const key = i === 1 ? "order" : `order${i}`;
    if (met(ch,n) || state.tut?.midUnlockLegacy?.[key]) seats = Math.max(seats, i);
  }
  if (state.tut?.done?.order || state.tut?.cur === "order") seats = Math.max(seats, 1);
  o.legacySeats = seats;
  o.legacyRate = met(9,2) ? .20 : met(8,2) ? .15 : met(5,2) || state.tut?.done?.orderLearning || state.tut?.cur === "orderLearning" ? .10 : 0;
  if (o.legacyRate) o.legacySeats = Math.max(o.legacySeats, 1);
  o.insightVersion = 1;
}
