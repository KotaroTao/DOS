"""実際にマージせず、停止条件と公開完了の判定を確かめる。"""
import argparse
import io
import unittest
from unittest.mock import patch
import merge


HEAD = "a" * 40
MERGED = "b" * 40


def pr(**changes):
    result = dict(baseRefName="main", headRefOid=HEAD, state="OPEN", isDraft=False,
                  mergeable="MERGEABLE", statusCheckRollup=[], url="https://example.test/pr/1")
    result.update(changes)
    return result


class MergeTests(unittest.TestCase):
    def test_changed_head_stops(self):
        with self.assertRaises(merge.ReleaseError):
            merge.validate_pr(pr(headRefOid="c" * 40), HEAD)

    def test_draft_and_wrong_base_stop(self):
        for change in [dict(isDraft=True), dict(baseRefName="other"), dict(state="CLOSED"), dict(mergeable="CONFLICTING")]:
            with self.subTest(change=change), self.assertRaises(merge.ReleaseError):
                merge.validate_pr(pr(**change), HEAD)

    def test_check_states(self):
        self.assertTrue(merge.check_state([]))
        self.assertFalse(merge.check_state([dict(status="IN_PROGRESS", conclusion=None)]))
        self.assertFalse(merge.check_state([dict(state="PENDING")]))
        self.assertTrue(merge.check_state([dict(status="COMPLETED", conclusion="SUCCESS"), dict(state="SUCCESS")]))
        for check in [dict(status="COMPLETED", conclusion="FAILURE"), dict(state="ERROR")]:
            with self.assertRaises(merge.ReleaseError):
                merge.check_state([check])

    def args(self, write=True):
        return argparse.Namespace(pr=1, head=HEAD, merge=write, repo="owner/repo", site="https://example.test/", timeout=30)

    def test_check_only_never_merges(self):
        with patch.object(merge, "gh", return_value=pr()) as gh:
            merge.release(self.args(False))
        self.assertEqual(gh.call_count, 1)

    def test_failed_check_never_merges(self):
        with patch.object(merge, "gh", return_value=pr(statusCheckRollup=[dict(status="COMPLETED", conclusion="FAILURE")])) as gh:
            with self.assertRaises(merge.ReleaseError):
                merge.release(self.args())
        self.assertEqual(gh.call_count, 1)

    def test_deployment_failure_is_not_success(self):
        run = dict(id=1, head_sha=MERGED, head_branch="main", status="completed", conclusion="failure", html_url="https://example.test/run/1")
        with patch.object(merge, "gh", side_effect=[pr(), dict(merged=True, sha=MERGED), dict(workflow_runs=[run])]):
            with self.assertRaisesRegex(merge.ReleaseError, "公開に失敗"):
                merge.release(self.args())

    def test_success_waits_for_matching_public_version(self):
        run = dict(id=1, head_sha=MERGED, head_branch="main", status="completed", conclusion="success", html_url="https://example.test/run/1")
        with patch.object(merge, "gh", side_effect=[pr(), dict(merged=True, sha=MERGED), dict(workflow_runs=[run])]) as gh, \
             patch.object(merge.time, "sleep"), \
             patch.object(merge.urllib.request, "urlopen", side_effect=[io.BytesIO(b'const CACHE = "old";'), io.BytesIO(f'const CACHE = "dos-{MERGED[:12]}";'.encode())]) as fetch:
            merge.release(self.args())
        self.assertEqual(fetch.call_count, 2)
        self.assertIn("sha=" + HEAD, gh.call_args_list[1].args)

    def test_already_merged_only_verifies(self):
        run = dict(id=1, head_sha=MERGED, head_branch="main", status="completed", conclusion="success", html_url="https://example.test/run/1")
        with patch.object(merge, "gh", side_effect=[pr(state="MERGED", mergeCommit=dict(oid=MERGED)), dict(workflow_runs=[run])]) as gh, \
             patch.object(merge.urllib.request, "urlopen", return_value=io.BytesIO(f'const CACHE = "dos-{MERGED[:12]}";'.encode())):
            merge.release(self.args(False))
        self.assertEqual(gh.call_count, 2)
        self.assertNotIn("PUT", gh.call_args_list[1].args)

    def test_later_publication_must_include_this_merge(self):
        run = dict(id=1, head_sha=MERGED, head_branch="main", status="completed", conclusion="success", html_url="https://example.test/run/1")
        for status, responses in [("ahead", [io.BytesIO(b'const CACHE = "dos-cccccccccccc";')]),
                                  ("diverged", [io.BytesIO(b'const CACHE = "dos-cccccccccccc";'), io.BytesIO(f'const CACHE = "dos-{MERGED[:12]}";'.encode())])]:
            with self.subTest(status=status), \
                 patch.object(merge, "gh", side_effect=[pr(state="MERGED", mergeCommit=dict(oid=MERGED)), dict(workflow_runs=[run]), dict(status=status)]), \
                 patch.object(merge.time, "sleep"), \
                 patch.object(merge.urllib.request, "urlopen", side_effect=responses) as fetch:
                merge.release(self.args(False))
            self.assertEqual(fetch.call_count, 1 if status == "ahead" else 2)


if __name__ == "__main__":
    unittest.main()
