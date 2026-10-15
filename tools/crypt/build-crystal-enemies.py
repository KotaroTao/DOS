"""水晶の鉱脈の原画を個別の透過WebPへ切り出す（Pillow）。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/crystal-vein-enemies/master.png'
FRAMES = {
    'bs_crystalspider': (0, 0, 397, 390),
    'bs_crystaldrake': (397, 0, 793, 390),
    'bs_glowspore': (0, 390, 397, 778),
    'bs_deepworm': (397, 390, 793, 778),
    'bs_obsidianbeast': (0, 778, 397, 1170),
    'bs_cavefisher': (397, 778, 793, 1155),
    'bs_rocktitan': (0, 1170, 397, 1558),
    'bs_caveguardian': (397, 1155, 793, 1558),
    'bs_mawofthedeep': (0, 1558, 397, 1983),
}

if __name__ == '__main__':
    source = Image.open(SOURCE).convert('RGBA')
    for key, frame in FRAMES.items():
        image = source.crop(frame)
        image = image.crop(image.getchannel('A').getbbox())
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        padded.save(ROOT / f'art/monsters/{key}.webp', lossless=True, method=6)
        print(f'{key}: [{padded.width}, {padded.height}],')
