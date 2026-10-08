"""修羅5枚の透過、余白、孤立した残片を確認する。"""
from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[3]
records = []
for rank in range(1, 6):
    image = Image.open(root / 'art/jobs' / f'asura_{rank}.webp').convert('RGBA')
    alpha = np.array(image)[:, :, 3]
    mask = alpha > 32
    bbox = Image.fromarray(mask.astype('uint8') * 255).getbbox()
    assert image.size == (360, 368)
    assert alpha.min() == 0 and alpha.max() == 255
    assert 0 < bbox[0] < bbox[2] < image.width and 0 < bbox[1] < bbox[3] < image.height, (rank, bbox)
    seen = np.zeros(mask.shape, dtype=bool)
    sizes = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        queue = deque([(y, x)])
        seen[y, x] = True
        count = 0
        while queue:
            py, px = queue.popleft()
            count += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = py + dy, px + dx
                    if 0 <= ny < image.height and 0 <= nx < image.width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        sizes.append(count)
    assert len(sizes) == 1, (rank, sizes)
    source = Image.open(Path(__file__).parent / f'asura-r{rank}-final.png').convert('RGBA')
    visible = Image.fromarray((np.array(source)[:, :, 3] > 32).astype('uint8') * 255).getbbox()
    assert 0 < visible[0] < visible[2] < source.width and 0 < visible[1] < visible[3] < source.height
    records.append({'rank': rank, 'size': image.size, 'visibleBBox': bbox,
                    'opaqueComponents': sizes, 'sourceVisibleBBox': visible})
(Path(__file__).parent / 'asset-verification.json').write_text(json.dumps(records, indent=2) + '\n')
print('全5枚の透過・四辺の余白・孤立した残片なしを確認')
