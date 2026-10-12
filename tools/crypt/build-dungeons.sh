#!/usr/bin/env bash
# 回廊〜外郭の原画を配信用WebPへ変換する。
set -eu
cd "$(dirname "$0")/../.."
for id in w02 w03 w04 w05 w06; do
  for kind in materials floor; do
    magick "docs/art/dungeons/$id-$kind-master.png" -strip -define webp:method=6 -quality 88 "art/dungeon/$id-$kind.webp"
  done
done
