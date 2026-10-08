"""Verify actual photo/bust selection and game startup on two viewport sizes."""
import argparse
import json
import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:8001/")
args = parser.parse_args()
DIR = Path(__file__).parent
errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(args.url)
    page.wait_for_load_state("networkidle")
    result = page.evaluate("""async () => {
      const {jobSprite, jobBust} = await import('/src/souls.js');
      const {JOB_PHOTOS} = await import('/src/jobphotos.js');
      const {JOB_IMAGES} = await import('/src/jobart.js');
      const {crispCanvas,whenPhoto} = await import('/src/sprites.js');
      if (JOB_IMAGES.hero) throw new Error('Old hero art still overrides photos');
      const rows = [];
      for (let rank=1; rank<=5; rank++) {
        const sprite=jobSprite('hero',rank), bust=jobBust('hero',rank);
        const expected='/art/jobs/hero_'+rank+'.webp';
        if (!sprite.photo || !bust.photo ||
            !sprite.photo.img.src.endsWith(expected) || !bust.photo.img.src.endsWith(expected)) {
          throw new Error('Wrong hero sprite/bust source: '+rank);
        }
        await Promise.all([sprite.photo.img.decode(),bust.photo.img.decode()]);
        await new Promise((resolve,reject)=> {
          const timer=setTimeout(()=>reject(new Error('Photo surface timeout: '+rank)),15000);
          whenPhoto(bust,()=>{clearTimeout(timer);resolve();});
        });
        const entry=JOB_PHOTOS.hero[rank];
        if (entry.w!==90 || entry.h!==92 || entry.face.join()!=='45,20') {
          throw new Error('Wrong hero source geometry: '+rank);
        }
        const counts=[];
        for (const size of [56,36,26]) {
          const canvas=crispCanvas(bust,size);
          const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          const count=data.filter((v,i)=>i%4===3 && v>16).length;
          if (count<50) throw new Error('Blank hero bust: '+rank+'/'+size);
          counts.push({size,pixels:count});
        }
        rows.push({rank,sprite:sprite.photo.img.src,bust:bust.photo.img.src,head:entry.head,counts});
      }
      return rows;
    }""")
    viewports = []
    for name, width, height in [("desktop", 1280, 900), ("mobile", 390, 844)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(args.url)
        page.wait_for_load_state("networkidle")
        assert page.locator("body").inner_text().strip()
        page.screenshot(path=str(DIR / f"game-{name}.png"), full_page=True)
        viewports.append({"name": name, "width": width, "height": height})
    assert not errors, errors
    browser.close()
(DIR / "game-verification.json").write_text(json.dumps({
    "ranks": result, "viewports": viewports, "browserErrors": errors,
}, indent=2) + "\n")
print("Hero R1-R5 sprite/bust photo selection, all icon sizes, desktop/mobile startup verified")
