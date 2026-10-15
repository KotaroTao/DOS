import json, shutil
from pathlib import Path
from PIL import Image, ImageDraw
items=json.loads(Path('docs/art/treasury/81-108/items.json').read_text())
files=['exec-3e3adabf-9bfc-4520-a2eb-e9a16a4597de.png','exec-4868aa77-38f1-4163-b3ba-142e08978de9.png','exec-37552818-bab7-4cdc-8bb7-f4cc3e59018d.png','exec-9371922d-fb06-435d-a453-e2b092178955.png']
masters=Path('docs/art/treasury/81-108'); masters.mkdir(parents=True,exist_ok=True)
out=Path('art/treasury'); out.mkdir(parents=True,exist_ok=True)
sheet=Image.new('RGB',(7*160,4*182),'#17141c'); d=ImageDraw.Draw(sheet)
for batch,fn in enumerate(files):
    im=Image.open(masters/f'atlas-{batch+1}.png').convert('RGBA'); w,h=im.size
    for j in range(7):
        it=items[batch*7+j]; c,r=j%4,j//4
        box=[round(c*w/4)+6,round(r*h/2)+6,round((c+1)*w/4)-6,round((r+1)*h/2)-6]
        if batch==2 and j==4: box[2]+=20
        crop=im.crop(box); a=crop.getchannel('A'); bbox=a.point(lambda v:255 if v>20 else 0).getbbox(); assert bbox
        crop=crop.crop(bbox); crop.thumbnail((340,340),Image.Resampling.LANCZOS)
        icon=Image.new('RGBA',(384,384)); icon.alpha_composite(crop,((384-crop.width)//2,(384-crop.height)//2))
        icon.save(out/f'{it["id"]}.webp','WEBP',quality=90,method=6)
        thumb=icon.resize((150,150),Image.Resampling.LANCZOS); x=j*160+5; y=batch*182+4
        sheet.paste(thumb,(x,y),thumb); d.text((x,y+151),str(it['n'])+' '+it['id'][2:17],fill='#e0d3b2')
sheet.save(masters/'contact-sheet.jpg',quality=92)
Path(masters/'items.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
