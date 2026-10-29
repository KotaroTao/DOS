// 公開してよい接続情報だけを置く。service_role キーは絶対にここへ置かない。
export const CLOUD_CONFIG = Object.freeze({
  enabled: false,
  url: "",
  anonKey: "",
  protocol: 1,
  turnstileSiteKey: "",
});
