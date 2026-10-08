"""保存した測定値を既存の原画取り込みツールへ渡す。"""
from pathlib import Path
import importlib.util
import json
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("jobimg", ROOT / "tools/jobimg.py")
jobimg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(jobimg)
settings = json.loads((Path(__file__).parent / "import-settings.json").read_text())
sources = settings["sources"]
jobimg.build(
    "chaplain",
    [str(ROOT / source["source"]) for source in sources],
    [source["perDot"] for source in sources],
    [source["head"] for source in sources],
    str(Path(__file__).parent / "import-preview.png"),
    tuple(settings["frame"]),
    settings["frameTop"],
)
