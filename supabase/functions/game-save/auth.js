// 非対称署名は公開鍵で検証する。旧HS256と重要操作はAuthへ問い合わせる。
const invalid = () => Object.assign(new Error("ログインし直してください"), { status: 401 });
const decode = part => {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw invalid();
  return Uint8Array.from(atob(part.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(part.length / 4) * 4, "=")), c => c.charCodeAt(0));
};
export function createAuthenticator({ url, serviceKey, fetcher = fetch, now = Date.now }) {
  let keys = [], loadedAt = 0, refreshing = null;
  const reload = async () => {
    if (!refreshing) refreshing = (async () => {
      const response = await fetcher(`${url}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Object.assign(new Error("認証用の公開鍵を取得できません"), { status: 503 });
      const data = await response.json();
      if (!Array.isArray(data.keys)) throw new Error("公開鍵の形式が不正です");
      keys = data.keys; loadedAt = now();
    })().finally(() => { refreshing = null; });
    return refreshing;
  };
  return async (authorization, { online = false } = {}) => {
    const token = /^Bearer ([^\s]+)$/i.exec(authorization || "")?.[1];
    if (!token) throw invalid();
    const parts = token.split(".");
    // 移行前のプロジェクトの署名鍵は公開されないため、推測や署名省略はしない。
    let header;
    try { header = JSON.parse(new TextDecoder().decode(decode(parts[0]))); } catch { header = {}; }
    if (online || header.alg === "HS256" || !header.alg) {
      const response = await fetcher(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw invalid();
      const user = await response.json();
      if (!user.id) throw invalid();
      return user;
    }
    if (parts.length !== 3 || !["ES256", "RS256"].includes(header.alg) || typeof header.kid !== "string") throw invalid();
    if (!loadedAt || now() - loadedAt > 5 * 60000) await reload();
    let key = keys.find(k => k.kid === header.kid && (!k.alg || k.alg === header.alg));
    // 未知のkidの連打で鍵取得を増幅させない。鍵の更新には最長30秒で追従する。
    if (!key && now() - loadedAt >= 30000) { await reload(); key = keys.find(k => k.kid === header.kid && (!k.alg || k.alg === header.alg)); }
    if (!key || (key.use && key.use !== "sig") || key.d) throw invalid();
    const ec = header.alg === "ES256";
    if (ec ? key.kty !== "EC" || key.crv !== "P-256" : key.kty !== "RSA") throw invalid();
    try {
      const imported = await crypto.subtle.importKey("jwk", key, ec ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      const valid = await crypto.subtle.verify(ec ? { name: "ECDSA", hash: "SHA-256" } : { name: "RSASSA-PKCS1-v1_5" }, imported, decode(parts[2]), new TextEncoder().encode(parts.slice(0, 2).join(".")));
      if (!valid) throw invalid();
      const claims = JSON.parse(new TextDecoder().decode(decode(parts[1]))), seconds = now() / 1000;
      if (claims.iss !== `${url}/auth/v1` || !(claims.aud === "authenticated" || Array.isArray(claims.aud) && claims.aud.includes("authenticated")) || claims.role !== "authenticated" || !Number.isFinite(claims.exp) || claims.exp <= seconds || claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claims.sub || "")) throw invalid();
      return { id: claims.sub };
    } catch { throw invalid(); }
  };
}
