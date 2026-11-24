#!/usr/bin/env bash
# Usage: scripts/pad-pose.sh in.png out.png
# Fits a transparent PNG into 1200x1500, bottom-aligned, horizontally centred.
# Trims transparent margins first, then scales down (never up) to fit with 40px side margin and 20px top margin.
# The lowest opaque row lands on the bottom edge (assets:check wants baseline within 20px of it).
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: $0 in.png out.png" >&2; exit 1; }
[ -f "$1" ] || { echo "missing $1" >&2; exit 1; }
magick "$1" -background none -alpha on -trim +repage \
  -resize '1120x1480>' \
  -gravity south -extent 1200x1500 \
  -define png:color-type=6 "$2"
echo "$2: $(magick identify -format '%wx%h' "$2")"
