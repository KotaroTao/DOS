#!/usr/bin/env python3
"""承認済みPRの検査・マージ・Pages公開確認を一度の実行にまとめる。"""
import argparse
import json
import re
import subprocess
import time
import urllib.error
import urllib.request


class ReleaseError(RuntimeError):
    pass


def gh(*args):
    result = subprocess.run(["gh", *args], text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise ReleaseError(result.stderr.strip() or "GitHubへの操作に失敗しました")
    return json.loads(result.stdout)


def check_state(checks):
    pending = False
    for check in checks:
        if "conclusion" in check:
            if check.get("status") != "COMPLETED":
                pending = True
            elif check.get("conclusion") not in ("SUCCESS", "NEUTRAL", "SKIPPED"):
                raise ReleaseError("PRの検査に失敗: " + check.get("name", "名前なし"))
        elif check.get("state") in ("PENDING", "EXPECTED"):
            pending = True
        elif check.get("state") != "SUCCESS":
            raise ReleaseError("PRの検査に失敗: " + check.get("context", "名前なし"))
    return not pending


def validate_pr(pr, head):
    if pr["baseRefName"] != "main":
        raise ReleaseError("mainを対象にしたPRだけを扱います")
    if pr["headRefOid"] != head:
        raise ReleaseError("承認したコミットからPRが更新されています。新しい差分を確認してください")
    if pr["state"] == "MERGED":
        return
    if pr["state"] != "OPEN" or pr["isDraft"]:
        raise ReleaseError("公開中で下書きではないPRを指定してください")
    if pr["mergeable"] == "CONFLICTING":
        raise ReleaseError("mainとの衝突を解決してください")


def release(args):
    deadline = time.monotonic() + args.timeout

    def pause(message):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ReleaseError("待ち時間の上限です。同じコマンドで確認を再開できます")
        print(message, flush=True)
        time.sleep(min(10, remaining))

    def read_pr():
        pr = gh("pr", "view", str(args.pr), "--repo", args.repo, "--json",
                "url,state,isDraft,headRefOid,baseRefName,mergeCommit,statusCheckRollup,mergeable")
        validate_pr(pr, args.head)
        return pr

    pr = read_pr()
    if not args.merge and pr["state"] != "MERGED":
        check_state(pr["statusCheckRollup"])
        print(pr["url"] + "\n確認のみ。承認後に --merge を付けると公開まで実行します")
        return
    if pr["state"] != "MERGED":
        while not check_state(pr["statusCheckRollup"]) or pr["mergeable"] == "UNKNOWN":
            pause("PRの検査とマージ可否を確認中…")
            pr = read_pr()
            if pr["state"] == "MERGED":
                break
        if pr["state"] != "MERGED":
            result = gh("api", "--method", "PUT", f"repos/{args.repo}/pulls/{args.pr}/merge",
                        "-f", "merge_method=merge", "-f", "sha=" + args.head)
            if not result.get("merged"):
                raise ReleaseError(result.get("message", "マージに失敗しました"))
            merged_sha = result["sha"]
            print("mainへマージ済み: " + merged_sha, flush=True)
        else:
            merged_sha = pr["mergeCommit"]["oid"]
    else:
        merged_sha = pr["mergeCommit"]["oid"]

    while True:
        runs = gh("api", f"repos/{args.repo}/actions/workflows/pages.yml/runs?head_sha={merged_sha}&per_page=100")["workflow_runs"]
        # 再実行した時は新しい実行・試行を確認する
        runs = [r for r in runs if r["head_sha"] == merged_sha and r["head_branch"] == "main"]
        run = max(runs, key=lambda r: (r["id"], r.get("run_attempt", 1))) if runs else None
        if run and run["status"] == "completed":
            if run["conclusion"] != "success":
                raise ReleaseError("マージ済みですが公開に失敗: " + run["html_url"])
            print("Pages公開成功: " + run["html_url"], flush=True)
            break
        pause("マージしたコミットのPages公開を確認中…")

    expected = f'const CACHE = "dos-{merged_sha[:12]}";'
    url = args.site.rstrip("/") + "/sw.js?verify=" + merged_sha[:12]
    compared = set()
    while True:
        try:
            req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=20) as response:
                source = response.read().decode("utf-8")
            if expected in source:
                print("公開サイトの版も一致: " + args.site, flush=True)
                return
            version = re.search(r'^const CACHE = "dos-([0-9a-f]{12,40})";', source, re.M)
            if version and version[1] not in compared:
                published = version[1]
                compared.add(published)
                comparison = gh("api", f"repos/{args.repo}/compare/{merged_sha}...{published}")
                if comparison["status"] in ("ahead", "identical"):
                    print("後続の公開版にもこのマージが含まれています: " + args.site, flush=True)
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        pause("公開サイトへの反映を確認中…")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pr", type=int)
    parser.add_argument("--head", required=True, help="差分を確認・承認したコミットの40桁SHA")
    parser.add_argument("--merge", action="store_true", help="承認済みPRをマージし公開まで確認する")
    parser.add_argument("--repo", default="KotaroTao/DOS")
    parser.add_argument("--site", default="https://kotarotao.github.io/DOS/")
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()
    if args.pr <= 0 or args.timeout <= 0 or not re.fullmatch(r"[0-9a-f]{40}", args.head):
        parser.error("正のPR番号・待ち時間と40桁のコミットSHAを指定してください")
    if not args.site.startswith("https://"):
        parser.error("公開サイトにはhttps://のURLを指定してください")
    try:
        release(args)
    except (ReleaseError, subprocess.TimeoutExpired) as error:
        parser.exit(1, str(error) + "\n")


if __name__ == "__main__":
    main()
