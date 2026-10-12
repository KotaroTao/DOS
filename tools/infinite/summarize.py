"""通し試験の到達率とWilsonの95%区間を表示。未完了の試験を失敗に混ぜない。"""
import collections
import gzip
import json
import math
import sys


def interval(k, n):
    if not n:
        return '標本なし'
    z = 1.96
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return f'{100 * max(0, c - h):.1f}–{100 * min(1, c + h):.1f}%'


def summary(name, data):
    rows = data['rows']
    valid = [r for r in rows if r['result'] in ('lose', 'reached')]
    n = len(valid)
    print(name, f'有効{n}/{len(rows)}', collections.Counter(r['result'] for r in rows))
    for floor in (5, 10, 20, 30, 50, 75, 100):
        k = sum(r['reached'] >= floor for r in valid)
        if n:
            print(f'  B{floor}F {k}/{n} ({100 * k / n:.1f}%) 95%区間 {interval(k, n)}')
    deaths = collections.Counter(((r['reached'] - 1) // 10) * 10 + 1 for r in valid if r['result'] == 'lose')
    print('  全滅階', dict(sorted(deaths.items())))


if __name__ == '__main__':
    for path in sys.argv[1:]:
        opener = gzip.open if path.endswith('.gz') else open
        with opener(path, 'rt', encoding='utf-8') as stream:
            data = json.load(stream)
        if 'cohorts' in data:
            for name, cohort in data['cohorts'].items():
                summary(name, cohort)
        else:
            summary(path, data)
