// GitHub Actionsから設定する。管理トークン・秘密キーを出力しない。
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const SITE = "https://kotarotao.github.io/DOS/";
export const MIGRATION = "202610120001";
export const signature = "public.cloud_commit(uuid,uuid,bigint,uuid,jsonb,jsonb,jsonb)";
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";

export function migrationQuery(sql) {
  return `begin;
select pg_advisory_xact_lock(hashtext('dos-cloud-schema'));
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
do $dos_schema$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '${MIGRATION}') then
    execute ${literal(sql)};
    insert into supabase_migrations.schema_migrations(version, statements, name)
      values ('${MIGRATION}', array[${literal(sql)}], 'cloud_save');
  end if;
end $dos_schema$;
commit;`;
}

export function authSettings(current) {
  const site = (current.site_url || "").replace(/\/$/, "");
  if (site && site !== "http://localhost:3000" && site !== SITE.replace(/\/$/, "")) {
    throw new Error("別のアプリのログインURLが設定されています。DOS専用プロジェクトを選んでください。");
  }
  const redirects = new Set((current.uri_allow_list || "").split(",").map((s) => s.trim()).filter(Boolean));
  redirects.add(SITE);
  return { site_url: SITE, uri_allow_list: [...redirects].join(","), external_email_enabled: true,
    disable_signup: false, mailer_autoconfirm: false };
}

export function publicKey(keys) {
  for (const k of keys) {
    if (k.type === "publishable" && typeof k.api_key === "string" && k.api_key.startsWith("sb_publishable_")) return k.api_key;
    if (k.name !== "anon" || typeof k.api_key !== "string") continue;
    try {
      const claims = JSON.parse(Buffer.from(k.api_key.split(".")[1], "base64url").toString("utf8"));
      if (claims.role === "anon") return k.api_key;
    } catch {}
  }
  throw new Error("公開用APIキーが見つかりません。SupabaseのAPI Keys設定を確認してください。");
}

export function configSource(ref, key) {
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error("Project IDが不正です");
  return "// 公開用の接続情報。GitHub Pagesの配置時に生成する。\nexport const CLOUD_CONFIG = Object.freeze(" +
    JSON.stringify({ enabled: true, url: `https://${ref}.supabase.co`, anonKey: key, protocol: 1 }, null, 2) + ");\n";
}

export async function run(mode, { env = process.env, fetcher = fetch, writer = writeFile, reader = readFile } = {}) {
  if (!["--prepare", "--verify", "--config"].includes(mode)) throw new Error("--prepare / --verify / --config を指定してください");
  const ref = env.SUPABASE_PROJECT_REF, token = env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) throw new Error("GitHubのVariable SUPABASE_PROJECT_REF にProject IDを登録してください。");
  if (!token) throw new Error("GitHubのSecret SUPABASE_ACCESS_TOKEN にアクセストークンを登録してください。");
  async function management(path, method = "GET", body = null) {
    const r = await fetcher(`https://api.supabase.com/v1/projects/${ref}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`Supabase設定に失敗しました（HTTP ${r.status}）。Project IDとトークンの権限を確認してください。`);
    return r.json();
  }
  const project = await management("");
  if (project.id !== ref) throw new Error("プロジェクトが一致しません");
  if (project.status && !project.status.startsWith("ACTIVE")) throw new Error("プロジェクトが停止中か準備中です。Supabaseで再開してから実行してください。");
  const auth = await management("/config/auth");
  if (mode === "--prepare") {
    const settings = authSettings(auth);
    const sql = await reader(new URL("./migrations/202610120001_cloud_save.sql", import.meta.url), "utf8");
    await management("/database/query", "POST", { query: migrationQuery(sql) });
    await management("/config/auth", "PATCH", settings);
    console.log("保存テーブル・更新関数・メールログイン・確認メール・ログイン先URLを設定しました。");
    return;
  }
  const rows = await management("/database/query", "POST", { query: `select
    to_regclass('public.cloud_saves') is not null as ready,
    has_table_privilege('anon', 'public.cloud_saves', 'select') as anon_read,
    has_function_privilege('anon', '${signature}', 'execute') as anon_write,
    has_function_privilege('authenticated', '${signature}', 'execute') as player_write,
    has_function_privilege('service_role', '${signature}', 'execute') as server_write;` });
  const row = rows[0];
  if (!row?.ready || row.anon_read || row.anon_write || row.player_write || !row.server_write) throw new Error("保存テーブルの権限が正しくありません。セットアップを先に実行してください。");
  const key = publicKey(await management("/api-keys"));
  const endpoint = `https://${ref}.supabase.co/functions/v1/game-save`;
  const options = await fetcher(endpoint, { method: "OPTIONS", headers: { Origin: new URL(SITE).origin, apikey: key }, signal: AbortSignal.timeout(20000) });
  if (options.status !== 204 || options.headers.get("access-control-allow-origin") !== new URL(SITE).origin) throw new Error("保存APIの接続元設定を確認できません。関数のデプロイとGAME_ALLOWED_ORIGINSを確認してください。");
  const denied = await fetcher(endpoint, { method: "POST", headers: { Origin: new URL(SITE).origin, apikey: key, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20000) });
  if (denied.status !== 401) throw new Error("未ログインの保存要求が拒否されません。保存APIの認証設定を確認してください。");
  console.log("保存API・接続元・未ログインの拒否・データベース権限を確認しました。");
  if (mode === "--config") {
    if (!auth.smtp_host || !auth.smtp_admin_email) throw new Error("一般公開にはSupabaseのCustom SMTP設定が必要です。設定してからCLOUD_SAVE_ENABLEDを有効にしてください。");
    if (auth.mailer_autoconfirm !== false || auth.disable_signup || !auth.external_email_enabled || auth.site_url.replace(/\/$/, "") !== SITE.replace(/\/$/, "")) throw new Error("ログイン設定が一致しません。セットアップを先に実行してください。");
    await writer(new URL("../src/cloud-config.js", import.meta.url), configSource(ref, key));
    console.log("公開用のクラウド接続設定を生成しました。秘密のキーは含みません。");
  } else console.log(auth.smtp_host ? "メール配信の接続先は設定済みです。実際の確認メールも試してください。" : "次はCustom SMTPの設定が必要です。ゲーム側のクラウド保存はまだ無効です。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv[2]).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
