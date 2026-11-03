"""火球と爆発の透過アトラスを生成する。numpy/Pillow使用。"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
N=128
noise=np.random.default_rng(1207).random((128,128))
def sample(x,y):
 ix,iy=np.floor(x).astype(int),np.floor(y).astype(int);u,v=x-ix,y-iy
 u,v=u*u*(3-2*u),v*v*(3-2*v)
 return (1-u)*(1-v)*noise[iy%128,ix%128]+u*(1-v)*noise[iy%128,(ix+1)%128]+(1-u)*v*noise[(iy+1)%128,ix%128]+u*v*noise[(iy+1)%128,(ix+1)%128]
def fbm(x,y):
 return sum(sample(x*2**k,y*2**k)*.5**(k+1) for k in range(4))/.9375
y,x=np.mgrid[0:N,0:N].astype(float);x=(x/(N-1)-.5)*2;y=(y/(N-1)-.5)*2
distance=np.hypot(x,y)
for kind in ['fireball','blast']:
 atlas=Image.new('RGBA',(N*6,N*3))
 for frame in range(18):
  t=frame/17
  turb=fbm(x*4+31,y*4-t*3+27)
  detail=fbm(x*9-t*2+13,y*9+t*2+33)
  if kind=='fireball':
   edge=.62+(turb-.5)*.34
   density=np.clip((edge-distance)*6,0,1)*(.65+detail*.5)
   heat=np.clip((1-distance/.72)*.9+detail*.38,0,1)
   palette=[(107,16,3),(213,48,5),(255,130,22),(255,216,104),(255,252,220)]
  else:
   radius=.16+.76*(1-(1-t)**2)
   edge=radius+(turb-.5)*.28
   density=np.clip((edge-distance)*7,0,1)*(.45+detail*.7)
   heat=np.clip((1-distance/max(radius,.1))*.7+(1-t)*.5+detail*.22,0,1)
   palette=[(42,32,30),(122,94,70),(228,170,102),(255,228,172),(255,254,237)]
  alpha=density*np.clip((1-distance)*12,0,1)
  rgb=np.stack([np.interp(heat,[0,.25,.5,.75,1],[c[k] for c in palette]) for k in range(3)],axis=-1)
  atlas.paste(Image.fromarray(np.dstack((rgb,alpha*245)).astype(np.uint8)),(frame%6*N,frame//6*N))
 path=ROOT/f'art/effects/{kind}.webp';path.parent.mkdir(parents=True,exist_ok=True);atlas.save(path,quality=88,method=6)
 print(f'{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes')
