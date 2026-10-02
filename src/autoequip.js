// ===== 最適装備の計画 (純粋な計算・DOM なし) =====
// 担当: WP-B。Phase 0 では「何も動かさない」計画を返すスタブ。
// planBestEquip(dolls, { canEquip, slotKeyFor, recalcPreview, score })
//   候補 = 隊・控えの全員の所持品。呪い・未鑑定・他人の装備中の品は除く。
//   呪われた装備は外さない。両手武器⇄盾と所持枠を守る。人業をまたいで増分の大きい順に貪欲に割り当てる。
//   返り値: { moves: [{ doll, item, from, slotKey }], undoSnapshot }

export function planBestEquip(dolls, opts = {}) {
  void dolls; void opts;
  return { moves: [], undoSnapshot: null };
}

// 計画を元に戻すための写し (装備と所持品の並び)。WP-B が実装する
export function snapshotEquip(dolls) {
  return (dolls || []).map((d) => ({ doll: d, equip: { ...(d.equip || {}) }, items: [...(d.items || [])] }));
}
export function restoreEquip(snap) {
  for (const s of (snap || [])) { s.doll.equip = { ...s.equip }; s.doll.items = [...s.items]; }
}

export function install() {}
