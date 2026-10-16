// ローカルの記録は一つの画面だけが扱う。ロックは画面を閉じるまで保つ。
export const LOCAL_SAVE_KEY = "dos-save-v7";
export const LOCAL_RECOVERY_KEY = LOCAL_SAVE_KEY + "-recovery";
export const SAVE_SLOT_COUNT = 3;
export function saveSlotFromURL(href = location.href) {
  const slot = Number(new URL(href).searchParams.get("saveSlot") || 1);
  return Number.isInteger(slot) && slot >= 1 && slot <= SAVE_SLOT_COUNT ? slot : 1;
}
export function localSaveKey(slot = 1) {
  if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOT_COUNT) throw new Error("記録の番号が不正です。");
  return slot === 1 ? LOCAL_SAVE_KEY : `${LOCAL_SAVE_KEY}-slot-${slot}`;
}
export function selectSaveSlot(slot) {
  localSaveKey(slot);
  const url = new URL(location.href);
  url.searchParams.set("saveSlot", slot);
  location.assign(url.href);
}

export class LocalSaveSession {
  constructor({ storage = localStorage, locks = navigator.locks, slot = 1, onConflict = () => {} } = {}) {
    this.key = localSaveKey(slot);
    this.recoveryKey = this.key + "-recovery";
    this.storage = storage;
    this.locks = locks;
    this.onConflict = onConflict;
    this.owned = false;
    this.raw = null;
  }
  async acquire() {
    // 排他を保証できない環境では、古い記録を上書きさせない。
    if (!this.locks) throw new Error("記録を安全に開くため、ブラウザを最新版に更新してください。");
    return new Promise((resolve, reject) => {
      this.locks.request(this.key, { ifAvailable: true }, async lock => {
        if (!lock) { resolve(false); return; }
        this.owned = true;
        try { this.raw = this.storage.getItem(this.key); }
        catch (e) { this.owned = false; reject(e); return; }
        resolve(true);
        await new Promise(done => { this.release = () => { this.owned = false; done(); }; });
      }).catch(reject);
    });
  }
  unchanged() {
    if (!this.owned) return false;
    if (this.storage.getItem(this.key) === this.raw) return true;
    this.owned = false;
    this.onConflict();
    return false;
  }
  write(raw) {
    if (!this.unchanged()) return false;
    if (raw === null) this.storage.removeItem(this.key);
    else this.storage.setItem(this.key, raw);
    this.raw = raw;
    return true;
  }
  eraseAll() {
    if (!this.unchanged()) return false;
    for (const key of Array.from({ length: this.storage.length }, (_, i) => this.storage.key(i))) {
      if (key === this.recoveryKey || key?.startsWith(this.key + "-damaged-")) this.storage.removeItem(key);
    }
    return this.write(null);
  }
  // 正常に読み込めた起動時の記録を残す。退避の失敗で本来の保存は止めない。
  keepRecovery() {
    if (this.raw === null || !this.unchanged()) return;
    try { this.storage.setItem(this.recoveryKey, this.raw); } catch {}
  }
  quarantine() {
    if (this.raw === null || !this.unchanged()) return false;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(this.key + "-damaged-") && this.storage.getItem(key) === this.raw) return true;
    }
    const key = this.key + "-damaged-" + crypto.randomUUID();
    this.storage.setItem(key, this.raw);
    if (this.storage.getItem(key) !== this.raw) throw new Error("記録を退避できませんでした。");
    return true;
  }
}

function gate(title, text) {
  document.getElementById("local-save-gate")?.remove();
  const box = document.createElement("section");
  box.id = "local-save-gate";
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", title);
  box.style.cssText = "position:fixed;inset:0;z-index:10000;background:#0b0b12;color:#e7e3d4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;overflow:auto";
  const h = document.createElement("h2"); h.textContent = title;
  const p = document.createElement("p"); p.textContent = text; p.style.maxWidth = "36em";
  box.append(h, p);
  const button = (label, fn) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    b.style.cssText = "padding:12px 18px;min-height:44px";
    b.addEventListener("click", fn); box.append(b); return b;
  };
  document.body.append(box);
  // 冒険側のショートカットに、保護画面のキー操作を渡さない。
  box.addEventListener("keydown", e => e.stopPropagation());
  return { button, text: p };
}

export function showLocalSaveBlocked(message) {
  const g = gate("冒険の記録を保護しています", message);
  g.button("再読み込み", () => location.reload()).focus();
}

export function showLocalSaveRecovery(session, valid) {
  let archived = false;
  try { archived = session.quarantine(); } catch {}
  const g = gate("冒険の記録を読み込めません", archived
    ? "元の記録は変更せず、別の場所にも退避しました。復旧するか、新しい冒険を始めるか選んでください。"
    : "元の記録を保護しています。退避先に保存できないため、記録を消さずに停止しています。まず記録を書き出してください。");
  const original = session.raw;
  g.button("元の記録を書き出す", () => {
    const url = URL.createObjectURL(new Blob([original], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "dos-save-recovery.json";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }).focus();
  let backup = null;
  try { backup = session.storage.getItem(session.recoveryKey); } catch {}
  if (archived && backup && valid(backup)) {
    g.button("前に読み込めた記録から復旧する", () => {
      try { if (session.write(backup)) location.reload(); }
      catch { g.text.textContent = "復旧した記録を保存できません。元の記録は退避したままです。"; }
    });
  }
  if (archived) g.button("元の記録を退避して、はじめから", () => {
    if (!confirm("退避した元の記録を残して、新しい冒険を始めますか？")) return;
    try { if (session.write(null)) location.reload(); }
    catch { g.text.textContent = "記録を切り替えられませんでした。元の記録は保護しています。"; }
  });
  g.button("再読み込み", () => location.reload());
}
