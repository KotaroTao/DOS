"""魔騎士の画像選択と透明枠を検査し、結果を保存する。"""
from pathlib import Path
import json
from PIL import Image

folder = Path(__file__).resolve().parent
root = folder.parents[2]
review = json.loads((folder / "final-review.json").read_text())
assert review["canvasCount"] == 30 and not review["browserErrors"]
rows = [r for r in review["sprites"] if r["key"] == "darkknight"]
assert len(rows) == 5
assets = []
for rank, row in enumerate(rows, 1):
    assert row["rank"] == rank and row["src"].endswith(f"/art/jobs/darkknight_{rank}.webp")
    assert (row["w"], row["h"]) == (96, 94)
    assert row["face"] == [48, 20] and row["head"][:2] == [48, 10]
    path = root / f"art/jobs/darkknight_{rank}.webp"
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    assert im.size == (360, 368) and alpha.getextrema()[0] == 0
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < im.width and bbox[3] < im.height
    assets.append({"rank": rank, "size": list(im.size), "visibleBBox": list(bbox),
                   "transparent": True, "visibleEdgeClipping": False})
(folder / "asset-verification.json").write_text(json.dumps(assets, indent=2) + "\n")
print("5ランクの新画像選択・透過・枠内の輪郭、30描画とゲーム起動を確認")
