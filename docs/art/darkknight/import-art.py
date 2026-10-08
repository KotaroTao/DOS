"""承認済み原画を、測定した兜本体と足裏で揃えて取り込む。"""
from pathlib import Path
import json
import subprocess
from PIL import Image

root = Path(__file__).resolve().parents[3]
folder = Path(__file__).resolve().parent
# 頬の代わりに面当ての左右、角を除いた兜本体の頭頂、顎、足裏。
measurements = [
    (430, 624, 225, 488, 1320),
    (419, 615, 224, 487, 1325),
    (425, 619, 224, 486, 1326),
    (418, 614, 220, 487, 1325),
    (429, 623, 228, 491, 1325),
]
settings = {"job": "darkknight", "reference": "docs/art/crusader/crusader-r1-final.png",
            "frame": [90, 92], "frameTop": 9, "sources": []}
for rank, head in enumerate(measurements, 1):
    path = folder / f"darkknight-r{rank}-final.png"
    settings["sources"].append({"source": str(path.relative_to(root)),
        "perDot": (head[4] - head[2]) / 82.5, "head": list(head[:4]),
        "sole": head[4], "alphaBBox": list(Image.open(path).getbbox())})
(folder / "import-settings.json").write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n")
subprocess.run(["python3", "tools/jobimg.py", "darkknight",
    *[s["source"] for s in settings["sources"]],
    "--per-dot", ",".join(str(s["perDot"]) for s in settings["sources"]),
    "--head", *[",".join(map(str, s["head"])) for s in settings["sources"]],
    "--frame", "90,92", "--frame-top", "9",
    "--preview", "docs/art/darkknight/import-preview.png"], cwd=root, check=True)
