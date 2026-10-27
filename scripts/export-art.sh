#!/usr/bin/env bash
# Export the V3 Blender masters into responsive AVIF + WebP files under assets/img.
# Phones get their own portrait renders, not crops of the desktop frames.
# Usage: scripts/export-art.sh <masters dir with hero-*, day-*-*, plan-* PNGs>
# Needs ffmpeg (resize), cwebp and avifenc on PATH.
set -euo pipefail
src="$1"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/img"
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

export_one() { # master name widths...
  local master="$1" name="$2"; shift 2
  [ -f "$master" ] || { echo "missing $master" >&2; exit 1; }
  for w in "$@"; do
    ffmpeg -loglevel error -y -i "$master" -vf "format=rgb24,scale=${w}:-2:flags=lanczos" "$tmp/$name-$w.png"
    cwebp -quiet -q 80 -m 6 -sharp_yuv -metadata none "$tmp/$name-$w.png" -o "$out/$name-$w.webp"
    avifenc -q 60 -s 4 -y 444 -j all "$tmp/$name-$w.png" "$out/$name-$w.avif" >/dev/null
  done
}

export_one "$src/hero-desktop.png" hero-desktop 1440 2160 2880
export_one "$src/hero-phone.png" hero-phone 780 1170
for state in dawn morning afternoon dusk; do
  export_one "$src/day-$state-desktop.png" "day-$state-desktop" 1200 1800 2400
  export_one "$src/day-$state-phone.png" "day-$state-phone" 600 900 1200
done
export_one "$src/plan-desktop.png" plan-desktop 1400 2100 2800
export_one "$src/plan-phone.png" plan-phone 600 900 1200
ls -l "$out"
