"""火柱の透過テクスチャを生成する。numpy/Pillow使用、ゲーム用乱数は使わない。"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
W, H, FRAMES, COLS = 128, 192, 18, 6
noise = np.random.default_rng(731).random((128, 128))
def sample(x, y):
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    u, v = x-ix, y-iy
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    return ((1-u)*(1-v)*noise[iy%128,ix%128]+u*(1-v)*noise[iy%128,(ix+1)%128]
            +(1-u)*v*noise[(iy+1)%128,ix%128]+u*v*noise[(iy+1)%128,(ix+1)%128])
def fbm(x, y):
    return sum(sample(x*2**k, y*2**k)*(.5**(k+1)) for k in range(4)) / .9375

atlas = Image.new('RGBA', (W*COLS, H*((FRAMES+COLS-1)//COLS)))
y, x = np.mgrid[0:H,0:W].astype(float)
x = (x/(W-1)-.5)*2
y = 1-y/(H-1)  # 下が根元
for frame in range(FRAMES):
    time = frame/FRAMES*2.1
    flow = fbm(x*3+12, y*5-time*2+20)
    warp = x+(flow-.5)*.65*y**.45
    width = .72*(1-y)**.65+.025
    body = np.exp(-2*(warp/width)**2)
    turbulence = fbm(x*5+33, y*9-time*4+40)
    density = body*(.52+turbulence*.95)-y*.62
    alpha = np.clip((density-.10)*3.2,0,1)
    alpha = alpha*alpha*(3-2*alpha)
    alpha *= np.clip((1-y)*12,0,1)*np.clip(y*24,0,1)
    heat = np.clip(density*.92+(1-y)*.18,0,1)
    stops = [0,.25,.48,.72,1]
    palette = [(95,10,2),(193,37,4),(255,100,12),(255,189,65),(255,246,203)]
    rgb = np.stack([np.interp(heat, stops, [c[k] for c in palette]) for k in range(3)],axis=-1)
    rgba = np.dstack((rgb,alpha*240)).astype(np.uint8)
    atlas.paste(Image.fromarray(rgba), ((frame%COLS)*W,(frame//COLS)*H))
path = ROOT/'art/effects/fire-pillar.webp'
path.parent.mkdir(parents=True, exist_ok=True)
atlas.save(path, quality=88, method=6)
print(f'{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes / {FRAMES} frames')
