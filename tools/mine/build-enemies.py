"""坑口の原画から個別の透過WebPを再生成する。"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
FRAMES = {
 'a': {
  'bs_blastsprite': (0,0,515,510), 'bs_chainedconvict': (515,0,1025,510),
  'bs_dustwraith': (1025,0,1536,510), 'bs_koboldsapper': (0,515,455,1024),
  'bs_timbermite': (1070,515,1536,1024),
 },
 'b': {
  'bs_rockworm': (0,0,500,520), 'bs_tunneler': (500,0,1040,520),
  'bs_gargoyle': (1040,0,1535,520), 'bs_crystalcrawler': (0,522,519,1024),
  'bs_troll': (519,522,1040,1024), 'bs_steelspider': (1040,522,1535,1024),
 },
 'bat': {'bs_minebat': (0,0,1536,1024)},
 'c': {
  'el_chainoverseer': (0,0,750,724), 'bs_minelord': (750,0,1730,724),
  'mt_silver': (1730,0,2172,724),
 },
}
if __name__ == '__main__':
 for sheet, frames in FRAMES.items():
  source = Image.open(ROOT / f'docs/art/mine-enemies/{"bat" if sheet == "bat" else "sheet-" + sheet}.png').convert('RGBA')
  for key, frame in frames.items():
   im = source.crop(frame)
   im = im.crop(im.getchannel('A').getbbox())
   im.thumbnail((512,512), Image.Resampling.LANCZOS)
   padded = Image.new('RGBA', (im.width+8,im.height+8))
   padded.paste(im,(4,4))
   padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
   print(f'  {key}: [{padded.width}, {padded.height}],')
