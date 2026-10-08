"""騎士の原画と取り込み画像の透過・余白・残片を確認する。"""
from collections import deque
from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[3]
folder = Path(__file__).parent
records = []
for rank in range(1, 6):
    paths = [folder / f'knight-r{rank}-final.png',
             root / 'art/jobs' / f'knight_{rank}.webp']
    record = {'rank': rank, 'images': []}
    for path in paths:
        im = Image.open(path).convert('RGBA')
        alpha = np.array(im)[:, :, 3]
        assert alpha.min() == 0 and alpha.max() == 255, path
        mask = alpha > 32
        bbox = Image.fromarray(mask.astype('uint8') * 255).getbbox()
        assert bbox and 0 < bbox[0] < bbox[2] < im.width, (path, bbox)
        assert 0 < bbox[1] < bbox[3] < im.height, (path, bbox)
        components = []
        if path.suffix == '.webp':
            assert im.size == (360, 368), (path, im.size)
            seen = np.zeros(mask.shape, dtype=bool)
            for y, x in zip(*np.where(mask)):
                if seen[y, x]:
                    continue
                seen[y, x] = True
                queue = deque([(y, x)])
                size = 0
                while queue:
                    py, px = queue.popleft()
                    size += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = py + dy, px + dx
                            if (0 <= ny < im.height and 0 <= nx < im.width
                                    and mask[ny, nx] and not seen[ny, nx]):
                                seen[ny, nx] = True
                                queue.append((ny, nx))
                components.append(size)
            components.sort(reverse=True)
            assert len(components) == 1, (rank, components)
        record['images'].append({'path': str(path.relative_to(root)),
                                'size': im.size, 'visibleBBox': bbox,
                                'components': components,
                                'transparentPixels': int((alpha == 0).sum())})
    records.append(record)
(folder / 'asset-verification.json').write_text(
    json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print('全5ランクの透過・四辺の余白・取り込み画像の残片なしを確認')
