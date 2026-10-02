// 楽器サンプル生成ワーカー — 重い合成 (逆FFT・撥弦・鐘のモード合成) を描画スレッドから逃がす
import { generateZone } from "./instruments.js";

self.onmessage = (e) => {
  const { key } = e.data || {};
  try {
    const r = generateZone(key);
    self.postMessage({ key, sr: r.sr, ch: r.ch }, r.ch.map((c) => c.buffer));
  } catch (err) {
    self.postMessage({ key, err: String(err && err.message || err) });
  }
};
