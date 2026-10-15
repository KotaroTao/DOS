"""火を噴く地割れの3×3透過原画を個別のロスレスWebPへ切り出す。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/fissure-enemies/master.png'
IDS = [
    'bs_magmaslime', 'bs_emberswarm', 'bs_ashghoul',
    'bs_cinderwraith', 'bs_lavamaw', 'bs_sulfurfiend',
    'bs_lavagolem', 'bs_magmaray', 'bs_hellhound',
]

if __name__ == '__main__':
    source = Image.open(SOURCE).convert('RGBA')
    for index, key in enumerate(IDS):
        x, y = index % 3, index // 3
        frame = (round(x * source.width / 3), round(y * source.height / 3),
                 round((x + 1) * source.width / 3), round((y + 1) * source.height / 3))
        image = source.crop(frame)
        bbox = image.getchannel('A').getbbox()
        if not bbox:
            raise ValueError(f'{key}: 原画が空')
        image = image.crop(bbox)
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
        print(f'  {key}: [{padded.width}, {padded.height}],')
