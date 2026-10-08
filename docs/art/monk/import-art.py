from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
settings = json.loads((ROOT / "docs/art/monk/import-settings.json").read_text())
sources = settings["sources"]
subprocess.run([
    "python3", "tools/jobimg.py", "monk", *[s["source"] for s in sources],
    "--per-dot", ",".join(str(s["perDot"]) for s in sources),
    "--head", *[",".join(map(str, s["head"])) for s in sources],
    "--frame", ",".join(map(str, settings["frame"])),
    "--frame-top", str(settings["frameTop"]),
    "--preview", "docs/art/monk/import-preview.png",
], cwd=ROOT, check=True)
