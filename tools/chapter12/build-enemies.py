"""王家の廟の原画を輪郭を守って切り分け、透過WebPと登録を作る。"""
from pathlib import Path
import importlib.util
import json
import re
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/chapter12-enemies'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('picturebook', ROOT / 'tools/picturebook/build-enemies.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
GROUPS = json.loads((SOURCE / 'groups.json').read_text())

def divide(im, center, radius):
    seam = helper.transparent_seam(im, center, radius)
    parts = [Image.new('RGBA', im.size), Image.new('RGBA', im.size)]
    for y, x in enumerate(seam):
        parts[0].paste(im.crop((0,y,x,y+1)),(0,y))
        parts[1].paste(im.crop((x,y,im.width,y+1)),(x,y))
    return parts

def build():
    dimensions = {}
    for letter, ids, brief in GROUPS:
        im = Image.open(SOURCE / f'sheet-{letter}.png').convert('RGBA')
        # 先に上下、次に各段を左右に分ける。透明な経路が無ければ中止する。
        upper, lower = [p.transpose(Image.Transpose.TRANSPOSE) for p in divide(im.transpose(Image.Transpose.TRANSPOSE), im.height//2, (im.height//2-8 if letter=='f' else 160))]
        pieces = divide(upper, im.width//2, 180)
        pieces += [lower] if len(ids)==3 else divide(lower, im.width//2, 180)
        for key, piece in zip(ids,pieces):
            bbox = piece.getchannel('A').point(lambda a:255 if a>1 else 0).getbbox()
            if bbox is None: raise ValueError(f'{key}: 空の原画')
            piece = piece.crop(bbox)
            piece.thumbnail((512,512),Image.Resampling.LANCZOS)
            padded = Image.new('RGBA',(piece.width+8,piece.height+8))
            padded.paste(piece,(4,4))
            padded.save(ROOT / f'art/monsters/{key}.webp',lossless=True,method=6)
            dimensions[key]=list(padded.size)
    path=ROOT/'src/monsterphotos.js'
    s=re.sub(r'  // <<CHAPTER12_ART>>.*?  // <</CHAPTER12_ART>>\n','',path.read_text(),flags=re.S)
    block='  // <<CHAPTER12_ART>>\n  // 第十二章「王家の廟」。共通の敵は作成済み原画を共用。\n'
    block+=''.join(f'  {key}: {size},\n' for key,size in dimensions.items())
    block+='  // <</CHAPTER12_ART>>\n'
    path.write_text(s.replace('export const MONSTER_PHOTOS = {\n','export const MONSTER_PHOTOS = {\n'+block))
    path=ROOT/'sw.js';s=path.read_text()
    assets=''.join(f'  "./art/monsters/{key}.webp",\n' for key in dimensions if f'"./art/monsters/{key}.webp"' not in s)
    path.write_text(s.replace('  "./src/monsterphotos.js",','  "./src/monsterphotos.js",\n'+assets.rstrip()) if assets else s)
    (SOURCE/'dimensions.json').write_text(json.dumps(dimensions,indent=2)+'\n')
    print(f'{len(dimensions)}体のWebPと画像・SW登録を更新')

if __name__=='__main__':build()
