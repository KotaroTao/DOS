"""魔法剣士の採用原画・実描画・キャッシュ登録を確認する。"""
from pathlib import Path
import json
import shutil
import subprocess

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "docs/art/spellblade"

subprocess.run([
    "python3", "tools/review-job-art.py", "spellblade", "--label", "魔法剣士",
    "--output", "docs/art/spellblade/final-review",
], cwd=ROOT, check=True)
review = json.loads((ART / "final-review.json").read_text())
rows = review["sprites"][1:]
assert len(rows) == 5
assert all(row["src"].endswith(f'/art/jobs/spellblade_{row["rank"]}.webp') for row in rows)
assert all((row["w"], row["h"]) == (96, 94) for row in review["sprites"])
assert all(row["head"][:2] == [48, 10] for row in rows)
# 承認済みR1を保ち、ランク間の測定差は0.3ドット以内とする。
assert max(row["head"][2] for row in rows) - min(row["head"][2] for row in rows) < .3

assets = []
sw = (ROOT / "sw.js").read_text()
assert 'const CACHE = "dos-dev"' in sw
for rank in range(1, 6):
    path = f"art/jobs/spellblade_{rank}.webp"
    assert f'"./{path}"' in sw
    im = Image.open(ROOT / path).convert("RGBA")
    alpha = np.asarray(im)[:, :, 3]
    visible = Image.fromarray((alpha > 20).astype(np.uint8) * 255).getbbox()
    assert im.size == (360, 368) and alpha.min() == 0 and alpha.max() == 255
    assert visible and 0 < visible[0] < visible[2] < im.width
    assert 0 < visible[1] < visible[3] < im.height
    assets.append({"src": path, "size": im.size, "visibleBBox": visible, "transparent": True})

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:8000/")
    selected = page.evaluate("""async () => {
      const {jobSprite, jobBust} = await import('/src/souls.js');
      const out = [];
      for(let rank=1; rank<=5; rank++) {
        const sprite=jobSprite('spellblade', rank), bust=jobBust('spellblade', rank);
        if(!sprite.photo || !bust.photo) throw Error('原画の選択に失敗: '+rank);
        await Promise.all([sprite.photo.img.decode(), bust.photo.img.decode()]);
        if(sprite.photo.img.src !== bust.photo.img.src) throw Error('全身と顔の画像が不一致');
        out.push({rank, src:sprite.photo.img.src});
      }
      return out;
    }""")
    for name, viewport in [("desktop", {"width": 1280, "height": 800}),
                           ("mobile", {"width": 390, "height": 844})]:
        page.set_viewport_size(viewport)
        page.goto("http://127.0.0.1:8000/")
        page.wait_for_load_state("networkidle")
        assert page.locator("body").inner_text().strip()
        page.screenshot(path=str(ART / f"game-{name}.png"))
    assert not errors, errors
    browser.close()

(ART / "asset-verification.json").write_text(json.dumps({
    "assets": assets, "selected": selected, "browserErrors": errors,
    "viewports": ["desktop", "mobile"],
}, ensure_ascii=False, indent=2) + "\n")
print("魔法剣士5ランクの原画選択・透過・枠内収容・ゲーム起動を確認")
