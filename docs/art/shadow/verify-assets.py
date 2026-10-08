"""透過と画像端の欠け、独立した残片を検査する。"""
from collections import deque
from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[3]
records = []
for rank in range(1, 6):
    path = root / 'art' / 'jobs' / f'shadow_{rank}.webp'
    im = Image.open(path).convert('RGBA')
    assert im.size == (360, 368), (rank, im.size)
    alpha = np.array(im)[:, :, 3]
    assert alpha.min() == 0 and alpha.max() == 255
    mask = alpha > 32
    bbox = Image.fromarray(mask.astype('uint8') * 255).getbbox()
    assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < im.width and bbox[3] < im.height, (rank, bbox)
    seen = np.zeros(mask.shape, dtype=bool)
    components = []
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
                    if 0 <= ny < im.height and 0 <= nx < im.width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        components.append(size)
    components.sort(reverse=True)
    assert len(components) == 1, (rank, components)
    source = Image.open(Path(__file__).parent / f'shadow-r{rank}.png').convert('RGBA')
    source_alpha = np.array(source)[:, :, 3]
    source_bbox = Image.fromarray((source_alpha > 32).astype('uint8') * 255).getbbox()
    assert source_bbox[0] > 0 and source_bbox[1] > 0 and source_bbox[2] < source.width and source_bbox[3] < source.height
    records.append({'rank': rank, 'size': im.size, 'alphaBBox': bbox,
                    'opaqueComponents': components, 'sourceVisibleBBox': source_bbox,
                    'transparentPixels': int((alpha == 0).sum())})
(Path(__file__).parent / 'asset-verification.json').write_text(
    json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print('全5枚の透過・四辺の余白・不透明な残片なしを確認')
