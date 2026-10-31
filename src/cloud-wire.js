// 通信だけを圧縮する。DBの再送判定は展開済みの同じ論理要求を使う。
export async function encodeCloudReply(value) {
  if (typeof CompressionStream === "undefined") return value;
  const raw = JSON.stringify(value);
  if (raw.length < 2048) return value;
  const zip = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let binary = "";
  for (let i = 0; i < zip.length; i += 8192) binary += String.fromCharCode(...zip.subarray(i, i + 8192));
  const reply = { wireFormat: "gzip-base64", payload: btoa(binary) };
  return JSON.stringify(reply).length < new TextEncoder().encode(raw).length ? reply : value;
}
export async function decodeCloudReply(value) {
  if (value?.wireFormat !== "gzip-base64") return value;
  if (typeof value.payload !== "string" || value.payload.length > 64 * 1024 * 1024) throw new Error("通信の形式が不正です");
  const zip = Uint8Array.from(atob(value.payload), c => c.charCodeAt(0));
  const reader = new Blob([zip]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const parts = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 64 * 1024 * 1024) { await reader.cancel(); throw new Error("通信の展開が大きすぎます"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(await new Blob(parts).text());
}
