"""大書庫の主の原画を透過WebPへ変換し、寸法とSW登録を更新する。"""
from pathlib import Path
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/art/grand-library-enemies"


def build():
    image = Image.open(SOURCE / "master.png").convert("RGBA")
    # α=1の不可視画素を除いて余白の位置を決め、色と半透明の輪郭を保つ。
    bbox = image.getchannel("A").point(lambda a: 255 if a > 1 else 0).getbbox()
    if not bbox:
        raise ValueError("大書庫の主の原画が空です")
    image = image.crop(bbox)
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (image.width + 8, image.height + 8))
    padded.paste(image, (4, 4))
    padded.save(ROOT / "art/monsters/bs_archivist.webp", lossless=True, method=6)
    dimensions = {"bs_archivist": list(padded.size)}
    path = ROOT / "src/monsterphotos.js"
    photos = re.sub(r"  // <<GRAND_LIBRARY_ART>>.*?  // <</GRAND_LIBRARY_ART>>\n", "", path.read_text(), flags=re.S)
    block = "  // <<GRAND_LIBRARY_ART>>\n  // 大書庫の主（通常敵・強敵・召喚先は作成済み原画を共用）。\n"
    block += f"  bs_archivist: {json.dumps(list(padded.size))},\n"
    block += "  // <</GRAND_LIBRARY_ART>>\n"
    path.write_text(photos.replace("export const MONSTER_PHOTOS = {\n", "export const MONSTER_PHOTOS = {\n" + block))
    path = ROOT / "sw.js"
    sw = path.read_text()
    asset = '  "./art/monsters/bs_archivist.webp",'
    if asset not in sw:
        path.write_text(sw.replace('  "./src/monsterphotos.js",', '  "./src/monsterphotos.js",\n' + asset))
    (SOURCE / "dimensions.json").write_text(json.dumps(dimensions, indent=2) + "\n")
    print(json.dumps(dimensions))


if __name__ == "__main__":
    build()
