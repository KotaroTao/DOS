"""ブラウザ回帰検査で使う寸法を合わせた代替画像。"""
import re, struct, zlib
from functools import lru_cache
from pathlib import Path

# 魔物の画像には寸法の検査があるため、台帳と同じ寸法の軽いPNGを返す。
MONSTER_SIZES = {key: (int(w),int(h)) for key,w,h in re.findall(r"\s+(\w+): \[(\d+), (\d+)\]", (Path(__file__).resolve().parents[2]/'src/monsterphotos.js').read_text())}
@lru_cache(maxsize=32)
def placeholder(width,height):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
    raw=(b'\x00'+bytes([90,70,50,255])*width)*height
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
async def stub_art(route):
    key=route.request.url.rsplit('/',1)[-1].split('.')[0]
    size=MONSTER_SIZES.get(key,(2,2)) if '/monsters/' in route.request.url else (2,2)
    await route.fulfill(content_type='image/png',body=placeholder(*size))

