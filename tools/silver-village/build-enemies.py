"""銀業の隠れ里の原画から個別の透過ロスレスWebPを再生成する（Pillow・NumPy・SciPy）。"""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects, distance_transform_edt
ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
 'guardians-master.png': ['bs_siegeballista','bs_gravecaptain','d04_revenant','bs_thunderknight','bs_bonecolossus','bs_fungalhulk','bs_goldgolem','bs_mossgolem','bs_misttreant'],
}
def build():
 sizes={}
 for filename, ids in SOURCES.items():
  source=Image.open(ROOT/'docs/art/silver-village-enemies'/filename).convert('RGBA')
  pixels=np.array(source)
  components,_=label(pixels[:,:,3]>20)
  bodies=[]
  for number,slices in enumerate(find_objects(components),1):
   if slices is None: continue
   y,x=slices
   if (y.stop-y.start)*(x.stop-x.start)>12000: bodies.append((number,x.start,y.start))
  columns=3 if len(ids)==9 else 2
  bodies.sort(key=lambda b:(round(b[2]/(source.height/(len(ids)//columns))),b[1]))
  assert len(bodies)==len(ids),(filename,bodies)
  owners=np.zeros(components.shape,dtype=np.uint8)
  for index,(number,_,_) in enumerate(bodies,1): owners[components==number]=index
  # 独立した胞子や火花も最も近い本体へ所属させ、剣・拳を格子で切断しない。
  _,nearest=distance_transform_edt(owners==0,return_indices=True)
  assigned=owners[tuple(nearest)]
  for index,key in enumerate(ids,1):
   if key != 'bs_goldgolem': continue
   output=pixels.copy();output[assigned!=index]=0
   image=Image.fromarray(output);image=image.crop(image.getchannel('A').point(lambda a: 255 if a > 20 else 0).getbbox())
   padded=Image.new('RGBA',(image.width+8,image.height+8));padded.paste(image,(4,4))
   padded.save(ROOT/'art/monsters'/f'{key}.webp',lossless=True,method=6)
   sizes[key]=[padded.width,padded.height]
   print(f'  {key}: [{padded.width}, {padded.height}],')
 return sizes
if __name__=='__main__':build()
