"""回廊の原画を、敵ごとの輪郭に沿って透過WebPへ切り出す。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/art/corridor-enemies/master.png'
FRAMES = {
    'bs_mournshade': (0, 0, 365, 358),
    'bs_ghoul': (380, 0, 705, 358),
    'bs_pettyrevenant': (725, 0, 1086, 363),
    'bs_sarcoguard': (35, 358, 320, 718),
    'bs_skullswarm': (385, 360, 695, 700),
    'bs_spiritbat': (695, 365, 1086, 718),
    'bs_shroudstrangler': (0, 718, 365, 1060),
    'bs_tombwarden': (370, 700, 705, 1067),
    'bs_weepangel': (710, 718, 1086, 1068),
    'el_palebutcher': (0, 1068, 375, 1448),
    'bs_zombie': (385, 1068, 765, 1448),
}

if __name__ == '__main__':
    source = Image.open(SOURCE).convert('RGBA')
    for key, frame in FRAMES.items():
        image = source.crop(frame)
        if key == 'bs_tombwarden':
            image.paste((0, 0, 0, 0), (230, 0, 335, 28))
        # 隣接する行の小片だけを除き、対象の一続きの輪郭を保つ。
        if key in ('bs_shroudstrangler', 'bs_tombwarden', 'el_palebutcher'):
            alpha = image.getchannel('A')
            pixels = alpha.load()
            seen = set()
            components = []
            for y in range(image.height):
                for x in range(image.width):
                    if not pixels[x, y] or (x, y) in seen:
                        continue
                    stack = [(x, y)]
                    seen.add((x, y))
                    component = []
                    while stack:
                        a, b = stack.pop()
                        component.append((a, b))
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            nx, ny = a + dx, b + dy
                            if 0 <= nx < image.width and 0 <= ny < image.height and pixels[nx, ny] and (nx, ny) not in seen:
                                seen.add((nx, ny))
                                stack.append((nx, ny))
                    components.append(component)
            main = max(components, key=len)
            for component in components:
                if component is not main:
                    for x, y in component:
                        image.putpixel((x, y), (0, 0, 0, 0))
        image = image.crop(image.getchannel('A').getbbox())
        padded = Image.new('RGBA', (image.width + 8, image.height + 8))
        padded.paste(image, (4, 4))
        path = ROOT / f'art/monsters/{key}.webp'
        padded.save(path, lossless=True, method=6)
        print(f'  {key}: [{padded.width}, {padded.height}],')
