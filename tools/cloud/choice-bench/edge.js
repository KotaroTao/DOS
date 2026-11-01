// 計測専用の関数。認証後、小さな命令表へ追記する。本番のgame-saveは変更しない。
const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
Deno.serve(async req => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (req.method !== "POST") return new Response(null, { status: 405, headers });
  try {
    const started = performance.now();
    const auth = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: req.headers.get("Authorization") || "" } });
    if (!auth.ok) return Response.json({ error: "bench_auth_required" }, { status: 401, headers });
    const user = await auth.json(), authenticated = performance.now();
    if (!user.id) return Response.json({ error: "bench_auth_required" }, { status: 401, headers });
    const reader = req.body?.getReader(), chunks = []; let bytes = 0;
    if (!reader) return Response.json({ error: "bench_invalid_request" }, { status: 400, headers });
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 4096) { await reader.cancel(); return Response.json({ error: "bench_too_large" }, { status: 413, headers }); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const body = JSON.parse(await new Blob(chunks).text());
    const dbStarted = performance.now();
    const response = await fetch(url + "/rest/v1/rpc/__PREFIX___append_service", {
      method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_owner: user.id, p_run: body.p_run, p_step: body.p_step, p_command: body.p_command, p_choice: body.p_choice }),
    });
    const value = await response.json(), ended = performance.now();
    headers["Server-Timing"] = `auth;dur=${(authenticated-started).toFixed(2)},db;dur=${(ended-dbStarted).toFixed(2)},total;dur=${(ended-started).toFixed(2)}`;
    headers["x-bench-region"] = Deno.env.get("SB_REGION") || Deno.env.get("DENO_REGION") || "unknown";
    return Response.json(response.ok ? value : { error: "bench_append_failed" }, { status: response.ok ? 200 : 409, headers });
  } catch {
    return Response.json({ error: "bench_request_failed" }, { status: 503, headers });
  }
});
