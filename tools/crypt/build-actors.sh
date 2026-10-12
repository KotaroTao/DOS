#!/usr/bin/env bash
# 透明な人物・小物の原画を配信用WebPへ変換する。
set -eu
cd "$(dirname "$0")/../.."
mkdir -p art/dungeon
for name in props-a props-b props-c props-d walker; do
  magick "docs/art/crypt/actors/${name}-master.png" -strip -define webp:method=6 -define webp:alpha-quality=100 -quality 90 "art/dungeon/crypt-${name}.webp"
done

# 小さい通貨表示でも同じ原画を使う。読込量を抑えるため専用の縮小画像を出す。
magick docs/art/crypt/actors/props-d-master.png -crop 360x486+80+8 +repage -region 110x14+0+472 -channel A -evaluate set 0 +channel +region -resize 96x96 -strip -quality 90 art/dungeon/crypt-ember.webp
magick docs/art/crypt/actors/props-d-master.png -crop 418x311+573+153 +repage -resize 96x96 -strip -quality 90 art/dungeon/crypt-gold.webp
