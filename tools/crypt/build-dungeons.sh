#!/usr/bin/env bash
# 各迷宮の原画を配信用WebPへ変換する。
set -eu
cd "$(dirname "$0")/../.."
if [ "$#" -eq 0 ]; then set -- w02 w03 w04 w05 w06 w12 w13 w14 w15 w16 w17 w18 w19 w20 w21 w32 w33 w34 w35 w36; fi
for id in "$@"; do
  for kind in materials floor; do
    magick "docs/art/dungeons/$id-$kind-master.png" -strip -define webp:method=6 -quality 88 "art/dungeon/$id-$kind.webp"
  done
done
