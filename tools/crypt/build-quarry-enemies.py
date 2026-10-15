"""石切り場の原画を輪郭に合わせて透過WebPに変換する（Pillow）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
# mainで先に公開された坑口の共通4種は、その原画と変換道具を正本として共用する。
SHARED = {'bs_rockworm', 'bs_dustwraith', 'bs_tunneler', 'mt_silver'}
FRAMES = {
    'a': {
        'd03_orc': (0, 0, 512, 516),
        'bs_shieldogre': (512, 0, 1044, 516),
        'bs_stonegorgon': (1044, 0, 1536, 555),
        'bs_rockworm': (0, 516, 520, 1024),
        'bs_dustwraith': (520, 516, 1030, 1024),
        'bs_tunneler': (1030, 555, 1536, 1024),
    },
    'b': {
        'd03_mandrake': (0, 0, 512, 512),
        'bs_orehulk': (512, 0, 1024, 512),
        'bs_deepgolem': (1024, 0, 1536, 512),
        'el_crystalseer': (0, 512, 540, 1024),
        'mt_silver': (540, 512, 1024, 1024),
    },
}

if __name__ == '__main__':
    out = ROOT / 'art/monsters'
    out.mkdir(parents=True, exist_ok=True)
    for sheet, frames in FRAMES.items():
        source = Image.open(ROOT / f'docs/art/quarry-enemies/master-{sheet}.png').convert('RGBA')
        for key, frame in frames.items():
            if key in SHARED:
                continue
            image = source.crop(frame)
            # 生成原画のほぼ透明な背景を除き、髪・粉塵・細い爪を含む輪郭を残す。
            alpha = image.getchannel('A').point(lambda a: a if a > 8 else 0)
            image.putalpha(alpha)
            box = alpha.getbbox()
            assert box, key
            image = image.crop(box)
            image.thumbnail((504, 504), Image.Resampling.LANCZOS)
            padded = Image.new('RGBA', (image.width + 8, image.height + 8))
            padded.paste(image, (4, 4))
            padded.save(out / f'{key}.webp', lossless=True, method=6)
            print(f'  {key}: [{padded.width}, {padded.height}],')
