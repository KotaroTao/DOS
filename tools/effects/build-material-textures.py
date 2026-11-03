"""技の材質を18コマで生成。乱流・屈折・亀裂を焼き込み、実行時の画像生成を避ける。"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SIZE,FRAMES,COLS=96,18,6
MATERIALS=['ribbon','pressure','crystal','water','wind','shadow','light','life','venom','stone']
PALETTES=[[(38,79,119),(111,190,231),(244,253,255)],[(91,42,20),(216,134,64),(255,244,205)],[(26,88,127),(101,207,242),(235,255,255)],[(14,60,119),(47,161,225),(209,249,255)],[(24,75,65),(98,183,157),(226,255,239)],[(24,12,43),(110,52,161),(219,172,246)],[(113,60,21),(236,178,70),(255,254,220)],[(17,83,67),(72,205,147),(225,255,213)],[(37,58,18),(120,156,51),(224,235,145)],[(49,36,26),(137,104,69),(231,207,156)]]
noise=np.random.default_rng(8317).random((128,128))
def sample(x,y):
 ix,iy=np.floor(x).astype(int),np.floor(y).astype(int);u=x-ix;v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v)
 return (1-u)*(1-v)*noise[iy%128,ix%128]+u*(1-v)*noise[iy%128,(ix+1)%128]+(1-u)*v*noise[(iy+1)%128,ix%128]+u*v*noise[(iy+1)%128,(ix+1)%128]
def fbm(x,y):return sum(sample(x*2**k,y*2**k)*(.5**(k+1)) for k in range(4))/.9375
y,x=np.mgrid[0:SIZE,0:SIZE].astype(float);x=(x/(SIZE-1)-.5)*2;y=(y/(SIZE-1)-.5)*2
rad=np.hypot(x,y);angle=np.arctan2(y,x);edge=np.clip((1-np.maximum(abs(x),abs(y)))*10,0,1)
atlas=Image.new('RGBA',(SIZE*COLS,SIZE*3*len(MATERIALS)))
for row,kind in enumerate(MATERIALS):
 for frame in range(FRAMES):
  t=frame/FRAMES;flow=fbm(x*3+17+t*1.8,y*3+23-t*2.4);fine=fbm(x*9+31-t*3,y*9+44+t*2)
  if kind=='ribbon':
   # 一本の線状の芯を作らず、ちぎれる空気と摩擦の濃淡を横長にする。
   field=np.exp(-(y/.52)**4)*np.exp(-(x/.85)**6)*np.clip((flow-.3)*2.7,0,1)*(.3+fine);hot=np.clip((fine-.66)*3,0,1)*field
  elif kind=='pressure':
   cloud=rad+(flow-.5)*.45;field=np.exp(-(cloud/.68)**3)*np.clip((fine-.22)*2,0,1);hot=np.clip((fine-.65)*3,0,1)*field
  elif kind=='crystal':
   facets=np.abs(np.sin(x*7+y*3+flow*5));field=np.exp(-((x*.7+y*.2)/.6)**4)*np.exp(-(y/.85)**4)*(.25+facets*.7);hot=np.clip((fine-.6)*3,0,1)*field
  elif kind=='water':
   crest=y+.38*np.sin(x*2.6-t*3)+.18;field=np.exp(-(crest/.19)**2)*(.35+flow)+np.exp(-((crest+.28)/.32)**2)*.2;hot=np.exp(-(crest/.035)**2)*(.4+fine)
  elif kind=='wind':
   plume=y+.3*np.sin(x*2-t*3)+(flow-.5)*.4;field=np.exp(-(plume/.25)**2)*np.exp(-(x/.8)**4)*(.2+fine);hot=np.clip((fine-.65)*3,0,1)*field
  elif kind=='shadow':
   field=np.exp(-(rad/.78)**3)*np.clip((flow-.25)*2,0,1)*(.2+fine);hot=np.clip((fine-.62)*3,0,1)*field
  elif kind=='light':
   plume=x+(flow-.5)*.5+.13*np.sin(y*4+t*3);field=np.exp(-(plume/.26)**2)*np.exp(-(y/.8)**4)*(.25+fine);hot=np.clip((fine-.6)*3,0,1)*field
  elif kind=='life':
   plume=x+(flow-.5)*.7;field=np.exp(-(plume/.45)**2)*np.exp(-(y/.75)**4)*(.35+fine);hot=np.clip((flow-.58)*3,0,1)*field
  elif kind=='venom':
   field=np.exp(-(rad/.68)**3)*np.clip((flow-.28)*2,0,1)*(.25+fine);hot=np.exp(-((flow-.58)/.045)**2)*field
  else:
   cracks=np.minimum(abs(np.sin(x*7+y*2+flow*2)),abs(np.sin(y*8-x*3+flow*2)));field=np.exp(-(rad/.75)**6)*(.25+fine*.65);hot=np.exp(-(cracks/.065)**2)*field
  field=np.clip(field*edge,0,1);hot=np.clip(hot*edge,0,1);density=np.clip(field*.75+hot*.45,0,1)
  rgb=np.stack([np.interp(density,[0,.5,1],[c[k] for c in PALETTES[row]]) for k in range(3)],axis=-1)
  alpha=np.clip(field*1.4+hot*.3,0,1)*edge*245
  atlas.paste(Image.fromarray(np.dstack((rgb,alpha)).astype(np.uint8)),((frame%6)*SIZE,(row*3+frame//6)*SIZE))
p=ROOT/'art/effects/skill-materials.webp';atlas.save(p,quality=88,method=6)
print(f'{p.relative_to(ROOT)}: {p.stat().st_size:,} bytes; {len(MATERIALS)}材質×18コマ')
