#!/usr/bin/env bash
# 各迷宮の原画を配信用WebPへ変換する。引数で対象の迷宮IDを指定できる。
set -eu
cd "$(dirname "$0")/../.."
if [ "$#" -eq 0 ]; then set -- w02 w03 w04 w05 w06 w27 w28 w29 w30 w31; fi
for id in "$@"; do
  for kind in materials floor; do
    magick "docs/art/dungeons/$id-$kind-master.png" -strip -define webp:method=6 -quality 88 "art/dungeon/$id-$kind.webp"
  done
done
