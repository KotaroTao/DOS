"""原画を変更せず、共通倍率・足元でR1の確認画像を組む。"""
from pathlib import Path
import sys,json
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools'))
from jobimg import cut_out,bust_crop
D=Path(__file__).parent
crown,chin,sole,cx=50,387.2,1315,547
per_dot=(sole-crown)/83
source=D/'paladin-r1-review.png'
im,bbox=cut_out(source)
k=4/per_dot
# 共通枠360x336px。顔の列と足元で配置、ドット化はしない。
pal=Image.new('RGBA',(360,336))
scaled=im.convert('RGBa').resize((round(im.width*k),round(im.height*k)),Image.Resampling.LANCZOS).convert('RGBA')
ox=round(180-cx*k); oy=round(336-sole*k)
pal.alpha_composite(scaled,(ox,oy))
pal.save(D/'paladin-r1-scale-preview.png')
necro=Image.open(ROOT/'art/jobs/necromancer_1.webp').convert('RGBA')
master=Image.new('RGBA',(360,336));master.alpha_composite(necro,(round(180-19.07*4),4))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
canvas=Image.new('RGB',(1480,1000),(36,34,40));d=ImageDraw.Draw(canvas)
for i,(img,title) in enumerate(((master,'NECROMANCER R1 / MASTER'),(pal,'PALADIN R1 / REVIEW'))):
 x=10+i*740
 d.text((x+20,12),title,font=font,fill='white')
 big=img.resize((720,672),Image.Resampling.NEAREST);canvas.paste(big,(x,50),big)
 for y,col in ((58,'cyan'),(235,'magenta'),(720,'gray')):d.line((x,y,x+720,y),fill=col)
 # souls.js / jobimg.py と同じ頭頂〜顎を用いた顔アイコンの切り出し。
 e={'head':[45,1,23.125]}; bx,by,bs=bust_crop(e)
 face=img.crop(tuple(round(v*4) for v in (bx,by,bx+bs,by+bs)))
 d.text((x+20,735),'FACE 56px / 36px / 26px / enlarged',font=font,fill='white')
 pos=x+20
 for size in (56,36,26,196):
  icon=face.resize((size,size),Image.Resampling.LANCZOS);canvas.paste(icon,(pos,775),icon);pos+=size+24
canvas.save(D/'r1-comparison.png')
json.dump({'status':'ユーザー確認前。ゲームへの取り込み未実施。','source':str(source.relative_to(ROOT)),'perDot':per_dot,'head':[470,624,crown,chin],'sole':sole,'frame':[90,84],'reference':'art/jobs/necromancer_1.webp'},open(D/'r1-review-settings.json','w'),ensure_ascii=False,indent=2)
