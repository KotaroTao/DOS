"""現在原画から保存した修正前でA-28の額・肘内側だけを再現する。"""
import hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageChops
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = ROOT / 'art/story-review/fixes/irene_crest-sigil-python-before.png'
REFERENCE = ROOT / 'docs/art/story-refs/sigil.png'
EXPECTED = 'c92dde72d66b92051dc2ff0bc08c65d3e2f3e4fb507881d7b52518c0b3c65ba3'
EXPECTED_REFERENCE = '7dfeb2dbb8eb7091557e1dd3f387b963b64b2fa4a20848c1c18734167fe47b6b'
ZONES = {
    'forehead': {
        'polygon': [(761,188),(766,191),(772,198),(776,196),(781,198),
                    (786,202),(786,206),(781,215),(781,224),(774,226),
                    (770,218),(758,216),(756,210),(758,207),(761,204)],
        'allowed': (752,185,792,230), 'detail': (740,175,805,240),
        'size4': (92,128), 'angle': 20, 'position': (754,187),
        'color_low': (198,126,40), 'color_high': (243,183,88),
    },
    'elbow': {
        'polygon': [(743,503),(746,502),(747,512),(750,517),(755,518),
                    (756,522),(751,529),(740,532),(736,538),(731,537),
                    (730,527),(726,521),(728,516),(733,512),(736,512)],
        'allowed': (723,499,762,541), 'detail': (710,490,775,555),
        'size4': (88,124), 'angle': -22, 'position': (726,501),
        'color_low': (193,125,45), 'color_high': (252,218,139),
    },
}

def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED
    assert hashlib.sha256(REFERENCE.read_bytes()).hexdigest() == EXPECTED_REFERENCE
    original = Image.open(SOURCE).convert('RGB')
    pixels = np.asarray(original).copy()
    assert original.size == (1536,1024)
    removal = Image.new('L',original.size)
    for z in ZONES.values():
        ImageDraw.Draw(removal).polygon(z['polygon'], fill=255)
    mask = np.asarray(removal)>0
    ys,xs=np.where(mask)
    index=np.full(mask.shape,-1,dtype=int);index[ys,xs]=np.arange(len(xs))
    matrix=lil_matrix((len(xs),len(xs)),dtype=float);rhs=np.zeros((len(xs),3))
    for i,(y,x) in enumerate(zip(ys,xs)):
        matrix[i,i]=4
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            j=index[y+dy,x+dx]
            if j>=0:matrix[i,j]=-1
            else:rhs[i]+=pixels[y+dy,x+dx]
    pixels[ys,xs]=np.clip(np.rint(spsolve(matrix.tocsr(),rhs)),0,255).astype(np.uint8)
    cleaned=Image.fromarray(pixels)
    reference=np.asarray(Image.open(REFERENCE).convert('RGB'))
    r,g,b=[reference[:,:,i].astype(float) for i in range(3)]
    alpha=(r>40)&(r-b>10)&(g-b>8)
    ry,rx=np.where(alpha)
    box=(int(rx.min()),int(ry.min()),int(rx.max())+1,int(ry.max())+1)
    extracted=Image.fromarray(np.dstack((reference,alpha.astype(np.uint8)*255))).crop(box)
    extracted.save(HERE/'reference-extracted.png')
    candidate=cleaned.copy();allowed=np.zeros(mask.shape,dtype=bool)
    for name,z in ZONES.items():
        color=np.asarray(extracted).copy()
        tone=np.clip((color[:,:,0].astype(float)-130)/120,0,1)
        for ch,(lo,hi) in enumerate(zip(z['color_low'],z['color_high'])):
            color[:,:,ch]=lo+(hi-lo)*tone
        crest=Image.fromarray(color).resize(z['size4'],Image.Resampling.LANCZOS)
        crest=crest.rotate(z['angle'],Image.Resampling.BICUBIC,expand=True)
        crest=crest.resize((crest.width//4,crest.height//4),Image.Resampling.LANCZOS)
        crest.putalpha(crest.getchannel('A').point(lambda v:v if v>=8 else 0))
        crest.save(HERE/f'{name}-placed-crest.png')
        shape=Image.new('RGB',crest.size,'white');shape.paste((0,0,0),(0,0,crest.width,crest.height),crest.getchannel('A'))
        shape.resize((shape.width*8,shape.height*8),Image.Resampling.NEAREST).save(HERE/f'{name}-placed-shape-8x.png')
        x,y=z['position']
        shadow=Image.new('RGBA',crest.size,(91,47,23,0));shadow.putalpha(crest.getchannel('A').point(lambda v:round(v*.30)))
        candidate.paste(shadow,(x+1,y+1),shadow);candidate.paste(crest,(x,y),crest)
        ax,ay,bx,by=z['allowed'];allowed[ay:by,ax:bx]=True
        cleaned.crop(z['detail']).resize((520,520),Image.Resampling.NEAREST).save(HERE/f'{name}-cleaned-8x.png')
        removal.crop(z['detail']).save(HERE/f'{name}-removal-mask.png')
    difference=np.any(np.asarray(candidate)!=np.asarray(original),axis=2)
    assert not difference[~allowed].any(), '許可した額・肘の領域外に変更があります'
    candidate.save(HERE/'candidate.png')
    Image.fromarray(allowed.astype(np.uint8)*255).save(HERE/'allowed-region.png')
    Image.fromarray(difference.astype(np.uint8)*255).save(HERE/'changed-pixels.png')
    for name,z in ZONES.items():
        comp=Image.new('RGB',(1040,520))
        for i,(label,im) in enumerate([('before',original),('candidate',candidate)]):
            detail=im.crop(z['detail']);detail.save(HERE/f'{name}-{label}-detail.png')
            big=detail.resize((520,520),Image.Resampling.NEAREST)
            big.save(HERE/f'{name}-{label}-detail-8x.png');comp.paste(big,(i*520,0))
        comp.save(HERE/f'comparison-{name}-8x.png')
        ax,ay,bx,by=z['allowed'];print(name,'変更画素',int(difference[ay:by,ax:bx].sum()))
    small=Image.new('RGB',(768,256))
    for i,(label,im) in enumerate([('before',original),('candidate',candidate)]):
        thumb=im.resize((384,256),Image.Resampling.LANCZOS)
        thumb.save(HERE/f'{label}-small.jpg',quality=90);small.paste(thumb,(i*384,0))
    small.save(HERE/'comparison-small.jpg',quality=92)
    print('変更画素',int(difference.sum()),'変更範囲',ImageChops.difference(original,candidate).getbbox())

if __name__=='__main__':
    main()
