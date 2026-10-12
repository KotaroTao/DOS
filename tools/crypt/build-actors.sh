#!/usr/bin/env bash
# 透明な人物・小物の原画を配信用WebPへ変換する。
set -eu
cd "$(dirname "$0")/../.."
mkdir -p art/dungeon
for name in props-a props-b walker; do
  magick "docs/art/crypt/actors/${name}-master.png" -strip -define webp:method=6 -define webp:alpha-quality=100 -quality 90 "art/dungeon/crypt-${name}.webp"
done
