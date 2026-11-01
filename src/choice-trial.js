// 本編の記録に触れないB方式の計測・試遊。
import { TrialLedger, timingSummary } from "./choice-trial-client.js";
import { TEST_BUILD } from "./playtest.js";
export function createTrial(mode) {
  const report = { version: 1, scope: "B方式の選択追記・確定通知の試遊。戦闘開始・終了の検証と報酬保存は含まない。", byteScope: "UTF-8本文量。HTTPヘッダー・TLS・転送時の圧縮は含まない。失敗した要求は送信を試みた本文量。", build: TEST_BUILD, mode, startedAt: new Date().toISOString(), viewport: { width: innerWidth, height: innerHeight }, connection: { effectiveType: navigator.connection?.effectiveType || null, rtt: navigator.connection?.rtt ?? null }, network: [], actions: [] };
  const ledger = new TrialLedger({ onSample: sample => report.network.push(sample) });
  let current = null, stopped = false;
  const output = document.createElement("output"); output.className = "choice-trial-status"; output.textContent = "試遊の準備中…";
  const download = () => {
    const summary = { network: timingSummary(report.network.filter(s => s.op === "append" && s.ok).map(s => s.ms)), receipt: timingSummary(report.actions.map(s => s.receiptMs)), preparation: timingSummary(report.actions.map(s => s.preparationMs)), impact: timingSummary(report.actions.map(s => s.impactMs)) };
    const blob = new Blob([JSON.stringify({ ...report, summary }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "dos-choice-trial.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const button = document.createElement("button"); button.type = "button"; button.textContent = "B計測を書き出す"; button.onclick = download;
  const retry = async error => {
    output.textContent = error.message || "通信を確認できません。同じ選択で再接続してください。";
    const b = document.createElement("button"); b.type = "button"; b.textContent = "同じ選択で再接続";
    output.appendChild(b);
    await new Promise(resolve => { b.onclick = () => { b.disabled = true; resolve(); }; });
    output.textContent = "同じ選択を確認中…";
  };
  const api = {
    output, button, report,
    async open() { await ledger.open(mode, "choice-trial-v1:" + TEST_BUILD); output.textContent = "B方式の試遊・本編の保存なし"; },
    async choose(choice, party, index) {
      if (stopped) throw Error("試遊は終了しています。");
      const started = performance.now();
      current = { receiptMs: null, preparationMs: null, impactMs: null, retries: 0 }; report.actions.push(current);
      const row = current;
      output.textContent = "選択を記録中…";
      if (mode === "battle-overlap" && party) {
        party.dataset.choiceIndex = String(index); party.classList.add("choice-windup");
        // CSSの描画が起きた最初のフレームを数える。結果の計算や乱数は使わない。
        requestAnimationFrame(() => { if (current === row && party.classList.contains("choice-windup")) row.preparationMs = performance.now() - started; });
      }
      let sending = ledger.append(choice);
      try {
        for (;;) {
          try { await sending; break; }
          catch (error) {
            if (!ledger.pending || stopped) throw error;
            await retry(error); row.retries++; sending = ledger.retry();
          }
        }
        row.receiptMs = performance.now() - started;
        output.textContent = `確定通知 ${Math.round(row.receiptMs)}ms・${ledger.step}手`;
        return () => { row.impactMs = performance.now() - started; current = null; };
      } finally { party?.classList.remove("choice-windup"); }
    },
    async measure(count = 20) {
      for (let i = 0; i < count; i++) {
        await api.choose({ action: "attack", actor: 0, target: 0, sample: i });
        output.textContent = `通信計測 ${i + 1}/${count}回`;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      const s = timingSummary(report.network.filter(s => s.op === "append" && s.ok).map(s => s.ms));
      output.textContent = `完了・中央値 ${Math.round(s.medianMs)}ms / p95 ${Math.round(s.p95Ms)}ms`;
      await api.close();
    },
    async close(options = {}) { stopped = true; await ledger.close(options); },
    finish() {
      output.textContent = "試遊終了・記録の片付け中…";
      api.close({ keepalive: true }).then(() => { output.textContent = "試遊終了・計測結果を書き出せます"; })
        .catch(() => { output.textContent = "試遊終了・計測結果を書き出せます。記録は有効期限後に片付きます。"; });
    },
  };
  window.addEventListener("pagehide", () => { if (ledger.run && !stopped) ledger.close({ keepalive: true }).catch(() => {}); }, { once: true });
  return api;
}
