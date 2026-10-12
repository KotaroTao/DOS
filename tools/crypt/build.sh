#!/usr/bin/env bash
# 原画を配信用WebPへ変換する。実行にはImageMagickが必要。
set -eu
cd "$(dirname "$0")/../.."
mkdir -p art/dungeon
magick docs/art/crypt/crypt-materials-master.png -strip -define webp:method=6 -quality 88 art/dungeon/crypt-materials.webp
magick docs/art/crypt/crypt-floor-master.png -strip -define webp:method=6 -quality 88 art/dungeon/crypt-floor.webp
