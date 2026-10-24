"""王宮の7枚の撮影結果を検査し、見比べるための一覧を作る。要Pillow。"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/art/story-refs/palace-3d'
VIEWS=[('front','正面・夜'),('left','入口の左側から'),('right','入口の右側から'),
       ('reverse','玉座側から入口へ'),('high','俯瞰'),('audience','会話用の寄り'),('front-day','正面・昼')]


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--font',default='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
    p.add_argument('--finished',action='store_true',help='DOS画風に仕上げた背景の一覧と比較画像を作る')
    args=p.parse_args()
    folder=OUT/'finished' if args.finished else OUT
    title=ImageFont.truetype(args.font,32,index=0)
    label=ImageFont.truetype(args.font,23,index=0)
    small=ImageFont.truetype(args.font,20,index=0)
    sheet=Image.new('RGB',(1536,1252),'#101823')
    draw=ImageDraw.Draw(sheet)
    heading='王宮 ｜ DOS画風の背景仕上げ' if args.finished else '王宮 ｜ 同じ3Dセットから撮影'
    subtitle='3D原型をもとにした完成背景　・　全画像 1536 × 1024' if args.finished else '建築と構図の確認用原型　・　全画像 1536 × 1024'
    draw.text((28,20),heading,font=title,fill='#e6d3ac')
    draw.text((30,66),subtitle,font=small,fill='#a8b4c4')
    for i,(name,text) in enumerate(VIEWS):
        with Image.open(folder/(name+'.png')) as img:
            if img.size!=(1536,1024) or img.mode!='RGB':
                raise ValueError(f'{name}: サイズまたは色形式が指定と異なる: {img.size}, {img.mode}')
            img.load()
            preview=img.resize((480,320),Image.Resampling.LANCZOS)
        x=24+(i%3)*504
        y=116+(i//3)*374
        sheet.paste(preview,(x,y))
        draw.text((x+2,y+327),text,font=label,fill='#dfe5ef')
    x,y=536,888
    note='3D原型の配置を基準に、DOSの質感へ' if args.finished else '全構図で、建物と家具の位置を固定'
    draw.text((x,y),note,font=label,fill='#e6d3ac')
    for i,text in enumerate(['北に玉座、南に入口。', '玉座の東に宰相の椅子、西に小卓。',
                             '人物と場面固有の小道具は、次の制作工程で加える。',
                             '同じ構図では完成背景を再利用する。' if args.finished else '画風の仕上げ前の原型。既存のゲーム画像は維持。']):
        draw.text((x,y+50+i*45),text,font=small,fill='#a8b4c4')
    sheet.save(folder/'contact-sheet.jpg',quality=92)
    if args.finished:
        comparison=Image.new('RGB',(1536,638),'#101823')
        d=ImageDraw.Draw(comparison)
        d.text((28,18),'王宮 ｜ 3D原型とDOS画風の仕上げ',font=title,fill='#e6d3ac')
        for x,path,text in [(24,OUT/'front.png','3D原型'),(792,folder/'front.png','DOS画風の仕上げ')]:
            with Image.open(path) as img:
                comparison.paste(img.resize((720,480),Image.Resampling.LANCZOS),(x,92))
            d.text((x,586),text,font=label,fill='#dfe5ef')
        comparison.save(folder/'comparison.jpg',quality=92)
    print('7枚のサイズ・RGB形式・読み込みを確認。一覧を作成しました。')


if __name__=='__main__':
    main()
