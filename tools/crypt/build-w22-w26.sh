#!/usr/bin/env bash
# 氷棚〜腐れ水の岸の原画を配信用WebPへ変換する。
set -eu
cd "$(dirname "$0")/../.."
for id in w22 w23 w24 w25 w26; do
  for kind in materials floor; do
    magick "docs/art/dungeons/$id-$kind-master.png" -strip -define webp:method=6 -quality 88 "art/dungeon/$id-$kind.webp"
  done
done
