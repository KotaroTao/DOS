"""測定した魔導士原画を共通枠へ取り込む。"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools"))
from jobimg import build

settings = json.loads(Path(__file__).with_name("import-settings.json").read_text())
sources = settings["sources"]
build("mage", [str(ROOT / s["source"]) for s in sources],
      [s["perDot"] for s in sources], [s["head"] for s in sources],
      str(Path(__file__).with_name("import-preview.png")),
      tuple(settings["frame"]), settings["frameTop"])
