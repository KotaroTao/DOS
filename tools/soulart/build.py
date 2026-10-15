"""魂の原画を周期的にゆらめかせ、透過WebPと静止版を作る。要 Pillow。"""
from pathlib import Path
import math
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SIZE = 320
COUNT = 40

def build():
    source = Image.open(ROOT / 'docs/art/souls/acquisition-master.png').convert('RGBA')
    source.thumbnail((260, 286), Image.Resampling.LANCZOS)
    base = Image.new('RGBA', (SIZE, SIZE))
    base.alpha_composite(source, ((SIZE-source.width)//2, (SIZE-source.height)//2))
    frames = []
    for n in range(COUNT):
        phase = n * math.tau / COUNT
        mesh = []
        for y in range(SIZE):
            # 上ほど大きく揺らす。周期を整数倍にして継ぎ目をなくす。
            strength = (1-y/SIZE)**1.3
            dx = strength * (9*math.sin(phase+y/48) + 3*math.sin(2*phase+y/25))
            dy = 2.5*math.sin(phase)
            mesh.append(((0,y,SIZE,y+1), (dx,y+dy,dx,y+1+dy,SIZE+dx,y+1+dy,SIZE+dx,y+dy)))
        frames.append(base.transform(base.size, Image.Transform.MESH, mesh, Image.Resampling.BICUBIC))
    target = ROOT / 'art/souls'
    target.mkdir(parents=True, exist_ok=True)
    frames[0].save(target/'acquisition-still.webp', quality=86, method=6)
    frames[0].save(target/'acquisition.webp', save_all=True, append_images=frames[1:], duration=80, loop=0, quality=82, method=6, minimize_size=True)
    for name in ['acquisition.webp', 'acquisition-still.webp']:
        p = target/name
        with Image.open(p) as im:
            assert im.size == (SIZE,SIZE)
            assert im.getextrema()[3][0] == 0, '透過の余白が必要'
            print(name, p.stat().st_size, 'bytes', getattr(im,'n_frames',1), 'frames')

if __name__ == '__main__':
    build()
