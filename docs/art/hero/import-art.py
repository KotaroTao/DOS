"""Repeat the hero import from measured source landmarks."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DIR = Path(__file__).parent
# Cheek bounds, main hair dome, chin, and bottom of the foot's alpha contour.
# Crown ornaments and the single upward hair strand are excluded from the dome.
measurements = [
    [500, 632, 147, 449, 1336],
    [500, 632, 147, 450, 1342],
    [500, 632, 144, 448, 1339],
    [500, 632, 146, 451, 1340],
    [500, 632, 168, 470, 1360],
]
sources = []
for rank, measurement in enumerate(measurements, 1):
    path = DIR / f"hero-r{rank}-final.png"
    sources.append({
        "source": str(path.relative_to(ROOT)),
        "head": measurement[:4],
        "sole": measurement[4],
        # Reserve less than two stored pixels for the resize filter at the soles.
        "resamplingMarginPx": 5,
        "perDot": (measurement[4] - measurement[2] + 5) / 82.9,
        "alphaBBox": Image.open(path).getchannel("A").point(lambda v: 0 if v <= 1 else v).getbbox(),
    })
settings = {"job": "hero", "reference": "docs/art/crusader/crusader-r1-final.png",
            "approvedR1": "docs/art/hero/hero-r1-final.png", "frame": [90, 92],
            "frameTop": 9, "sources": sources}
(DIR / "import-settings.json").write_text(json.dumps(settings, indent=2) + "\n")
command = [sys.executable, str(ROOT / "tools/jobimg.py"), "hero"]
command += [str(ROOT / source["source"]) for source in sources]
command += ["--per-dot", ",".join(str(source["perDot"]) for source in sources), "--head"]
command += [",".join(str(v) for v in measurement) for measurement in measurements]
command += ["--frame", "90,92", "--frame-top", "9", "--preview", str(DIR / "import-preview.png")]
subprocess.run(command, cwd=ROOT, check=True)
# Use the shared face anchor even when rank 5 falls just below a rounding boundary.
entries = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import {JOB_PHOTOS} from './src/jobphotos.js'; console.log(JSON.stringify(JOB_PHOTOS.hero));",
], cwd=ROOT, text=True))
for entry in entries.values():
    entry["face"] = [45, 20]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools"))
from jobimg import write_manifest
write_manifest("hero", entries)
