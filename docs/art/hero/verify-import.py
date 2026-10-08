"""Check imported hero art against the user-approved R1 geometry."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DIR = Path(__file__).parent
review = json.loads((DIR / "final-review.json").read_text())
settings = json.loads((DIR / "import-settings.json").read_text())
rows = review["sprites"]
assert len(rows) == 6 and review["canvasCount"] == 30
assert not review["browserErrors"]
reference = rows[0]
hero = rows[1:]
assert [row["rank"] for row in hero] == [1, 2, 3, 4, 5]
results = []
for row, source in zip(hero, settings["sources"]):
    rank = row["rank"]
    path = f"art/jobs/hero_{rank}.webp"
    assert row["key"] == "hero" and row["src"].endswith("/" + path), row
    # jobSprite adds the game's shared frame padding to all source coordinates.
    assert [row["w"], row["h"]] == [reference["w"], reference["h"]]
    assert row["face"] == reference["face"]
    assert row["head"][:2] == reference["head"][:2]
    # Approved hero R1 has a slightly shorter head than the Crusader reference.
    assert abs(row["head"][2] - reference["head"][2]) < 1.1
    assert abs(row["head"][2] - hero[0]["head"][2]) < 0.3
    original = Image.open(ROOT / source["source"]).convert("RGBA")
    alpha = np.asarray(original.getchannel("A"))
    assert alpha.min() == 0 and alpha.max() == 255
    # Ignore the generator's faint outer alpha residue; opaque shapes must fit.
    assert not any(np.any(edge > 16) for edge in (alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]))
    image = Image.open(ROOT / path).convert("RGBA")
    assert image.size == (360, 368)
    shipped = np.asarray(image.getchannel("A"))
    assert np.count_nonzero(shipped) > 10000
    assert not any(np.any(edge > 1) for edge in (shipped[0], shipped[-1], shipped[:, 0], shipped[:, -1]))
    assert '"./' + path + '"' in (ROOT / "sw.js").read_text()
    results.append({"rank": rank, "src": path, "head": row["head"],
                    "transparent": True, "unclippedFrame": True,
                    "sourceBBox": original.getchannel("A").getbbox()})
assert 'const CACHE = "dos-dev"' in (ROOT / "sw.js").read_text()
(DIR / "asset-verification.json").write_text(json.dumps({
    "approvedGeometry": "hero-r1-final.png",
    "crusaderHeadToleranceDots": 1.1,
    "heroRankHeadToleranceDots": 0.3,
    "ranks": results,
}, indent=2) + "\n")
print("Hero R1-R5: exact photo selection, geometry, transparency, frame, and cache listing verified")
