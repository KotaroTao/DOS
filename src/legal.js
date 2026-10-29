// 同意した本文の版はサーバー側にも記録する。本文を変える時は版も変える。
export const LEGAL_VERSION = "2026-10-30";
const documents = {
  terms: ["利用規約", [
    "本規約は、deadsea-games（以下、運営）が提供する「百の迷宮と 魂の王」の利用条件です。利用者は本規約に同意して本ゲームを利用します。",
    "本ゲームはオンライン接続を使い、冒険の記録を自動保存します。ゲストでも本編を遊べますが、ブラウザのデータ削除・端末紛失等により接続情報を失うと、未登録の記録は復旧できない場合があります。別端末での再開にはメール登録とメール確認が必要です。",
    "利用者はログイン情報を適切に管理してください。他人のアカウントの利用、不正アクセス、サービスを妨害する行為、保存データや通信の不正な改変を禁止します。違反時には利用を制限する場合があります。",
    "ゲームの文章・画像・音楽等の権利は運営または各権利者に帰属します。法令で認められる利用を除き、無断で素材を再配布・販売することは禁止します。",
    "運営は保守・障害対応や内容の改善により、サービスを変更・中断・終了する場合があります。記録の保全に努めますが、障害等による消失を完全に防ぐことは保証できません。運営の故意・重過失等、法令により免責できない責任は免除されません。",
    "現時点の広告・購入表示は試験用で、実際の広告配信・決済は行いません。実際の有料サービスを開始する場合は、料金・条件等を別途表示します。未成年の方は保護者と利用条件を確認してください。",
    "退会とアカウントに結び付いた記録の削除は、ゲーム内の設定から行えます。重要な規約変更時はゲーム内で案内し、必要に応じて再同意を求めます。問い合わせは下記の運営窓口へお寄せください。"
  ]],
  privacy: ["プライバシーポリシー", [
    "運営者はdeadsea-gamesです。本ゲームは、冒険の保存、本人確認、不正利用防止、障害対応のために情報を取り扱います。",
    "ゲスト利用では匿名のユーザーIDと冒険の記録を保存します。登録時にはメールアドレスと認証情報を扱います。弟子や人業の名前には、公開したくない個人情報を入力しないでください。規約の同意した版・同意日時も記録します。",
    "ブラウザにはログイン状態の維持に必要な認証トークン、送信待ちの記録、設定等を保存します。これらを削除すると、ゲストの記録へ戻れなくなる場合があります。",
    "認証と保存にはSupabase、確認メール等の送信にはResend、ゲームの配信にはGitHub Pages、不正利用を防ぐ安全確認を有効にした場合はCloudflare Turnstileを利用します。各サービスは配信・安全管理のためにIPアドレスやアクセスログ等を取り扱う場合があります。利用する事業者の方針も下記のリンクから確認できます。",
    "登録したメールアドレスはアカウントの確認・再設定等に使用し、広告メールの送信には使用しません。法令に基づく場合やサービスの提供に必要な委託等を除き、個人情報を第三者に提供しません。",
    "退会操作により認証アカウント、冒険の記録、規約同意の記録を削除します。運用ログ・バックアップに残る情報は各サービスの保持方針に従います。問い合わせや情報の取り扱いに関する相談は下記の運営窓口へお願いします。秘密のキーやパスワードは公開の窓口に書かないでください。"
  ]]
};
export function showLegal(kind = "terms") {
  const [title, paragraphs] = documents[kind] || documents.terms;
  const dialog = document.createElement("dialog"); dialog.className = "legal-dialog";
  dialog.setAttribute("aria-label", title);
  const heading = document.createElement("h2"); heading.textContent = title;
  const version = document.createElement("p"); version.textContent = "制定・改定日：" + LEGAL_VERSION;
  dialog.append(heading, version);
  for (const text of paragraphs) { const p = document.createElement("p"); p.textContent = text; dialog.append(p); }
  for (const [name, url] of [["運営窓口（公開・個人情報は記入しない）", "https://github.com/KotaroTao/DOS/issues"], ["Supabase", "https://supabase.com/privacy"], ["Resend", "https://resend.com/legal/privacy-policy"], ["GitHub", "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"], ["Cloudflare", "https://www.cloudflare.com/privacypolicy/"]]) {
    const p = document.createElement("p"), a = document.createElement("a"); a.textContent = name; a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a); dialog.append(p);
  }
  const close = document.createElement("button"); close.type = "button"; close.textContent = "閉じる"; close.onclick = () => dialog.close(); dialog.append(close);
  dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal(); close.focus();
}
