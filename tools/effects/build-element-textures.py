"""氷・水・風・土の材質と飛沫/霧/土煙を生成する。numpy/Pillow使用。"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];N=128
noise=np.random.default_rng(3819).random((128,128))
def sample(x,y):
 ix,iy=np.floor(x).astype(int),np.floor(y).astype(int);u,v=x-ix,y-iy;u,v=u*u*(3-2*u),v*v*(3-2*v)
 return (1-u)*(1-v)*noise[iy%128,ix%128]+u*(1-v)*noise[iy%128,(ix+1)%128]+(1-u)*v*noise[(iy+1)%128,ix%128]+u*v*noise[(iy+1)%128,(ix+1)%128]
def fbm(x,y):return sum(sample(x*2**k,y*2**k)*.5**(k+1) for k in range(4))/.9375
y,x=np.mgrid[0:N,0:N].astype(float);xx=x/N*2-1;yy=y/N*2-1;radius=np.hypot(xx,yy)
folder=ROOT/'art/effects';folder.mkdir(parents=True,exist_ok=True)
atlas=Image.new('RGBA',(N*6,N*9))
for kind in range(3):
 for frame in range(18):
  t=frame/18;field=fbm(xx*3+t*2+20,yy*3-t*2+35);fine=fbm(xx*11+t+50,yy*11+10)
  edge=np.clip((1-radius)*4,0,1);alpha=edge*edge*np.clip((field-.24)*1.8,0,1)
  if kind==1:alpha*=np.clip((fine-.36)*4,0,1)
  palette=[((90,156,192),(219,245,255)),((122,189,211),(244,253,255)),((67,57,46),(170,151,121))][kind]
  rgb=np.stack([palette[0][k]+field*(palette[1][k]-palette[0][k]) for k in range(3)],axis=-1)
  atlas.paste(Image.fromarray(np.dstack((rgb,alpha*185)).astype(np.uint8)),(frame%6*N,(frame//6+kind*3)*N))
atlas.save(folder/'element-flow.webp',quality=86,method=6)
materials=Image.new('RGB',(N*2,N))
field=fbm(x/N*6+12,y/N*6+17);fine=fbm(x/N*24+21,y/N*24+63)
for ice in [True,False]:
 if ice:
  facets=np.abs(np.sin(x*.073+y*.049+field*3));value=np.clip(.45+field*.4+facets*.2,0,1)
  rgb=np.stack((65+value*125,124+value*116,156+value*99),axis=-1)
 else:
  veins=np.abs(np.sin(x*.043-y*.081+field*7));value=np.clip(field*.7+fine*.3-veins*.15,0,1)
  rgb=np.stack((48+value*125,39+value*108,32+value*89),axis=-1)
 materials.paste(Image.fromarray(rgb.astype(np.uint8)),(0 if ice else N,0))
materials.save(folder/'element-minerals.webp',quality=90,method=6)
for name in ['element-flow.webp','element-minerals.webp']:print(name,(folder/name).stat().st_size,'bytes')
