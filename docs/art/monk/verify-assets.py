from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
rows = []
for rank in range(1, 6):
    path = ROOT / f"art/jobs/monk_{rank}.webp"
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    # 縮小補間による不可視に近い外周は輪郭に数えない。
    bbox = alpha.point(lambda value: 255 if value > 3 else 0).getbbox()
    assert im.size == (360, 368)
    assert alpha.getextrema() == (0, 255)
    assert bbox[0] > 0 and bbox[1] > 0
    assert bbox[2] < im.width and bbox[3] < im.height, (rank, bbox)
    rows.append({"rank": rank, "size": list(im.size), "alphaBBox": list(bbox),
                 "transparent": True, "clearEdges": True})
(ROOT / "docs/art/monk/asset-verification.json").write_text(
    json.dumps(rows, indent=2) + "\n")
print("全5枚の透明背景と画像端の余白を確認")
