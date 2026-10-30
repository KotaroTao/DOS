-- Edge Functionからの大容量RPCも既定の処理期限で切らない。
-- PostgRESTが呼出し前に適用する関数別設定。保存以外の期限は変えない。
alter function public.cloud_claim_text(uuid, uuid, integer) set statement_timeout = '45s';
alter function public.cloud_commit_text(text) set statement_timeout = '45s';
notify pgrst, 'reload schema';
