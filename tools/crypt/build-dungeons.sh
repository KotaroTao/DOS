#!/usr/bin/env bash
# 指定した迷宮の原画を配信用WebPへ変換する（省略時は回廊〜外郭）。
set -eu
cd "$(dirname "$0")/../.."
if [ "$#" -eq 0 ]; then set -- w02 w03 w04 w05 w06; fi
for id in "$@"; do
  for kind in materials floor; do
    magick "docs/art/dungeons/$id-$kind-master.png" -strip -define webp:method=6 -quality 88 "art/dungeon/$id-$kind.webp"
  done
done
