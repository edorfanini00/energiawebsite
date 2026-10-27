#!/usr/bin/env bash
# Export the direction A Blender masters into responsive AVIF + WebP files
# under assets/img. Phones get their own portrait renders.
# Usage: scripts/export-art.sh <art dir containing a-desktop.png, a-phone.png,
#        feature-desktop.png, feature-phone.png>
# Needs ffmpeg (resize), cwebp and avifenc on PATH.
set -euo pipefail
src="$1"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/img"
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

export_one() { # master name widths...
  local master="$1" name="$2"; shift 2
  for w in "$@"; do
    ffmpeg -loglevel error -y -i "$master" -vf "format=rgb24,scale=${w}:-2:flags=lanczos" "$tmp/$name-$w.png"
    cwebp -quiet -q 82 -m 6 -sharp_yuv -metadata none "$tmp/$name-$w.png" -o "$out/$name-$w.webp"
    avifenc -q 62 -s 4 -y 444 -j all "$tmp/$name-$w.png" "$out/$name-$w.avif" >/dev/null
  done
}

[ -f "$src/a-desktop.png" ] && export_one "$src/a-desktop.png" hero-desktop 1440 2160 2880
[ -f "$src/a-phone.png" ] && export_one "$src/a-phone.png" hero-phone 780 1170
[ -f "$src/feature-desktop.png" ] && export_one "$src/feature-desktop.png" feature-desktop 1400 2100 2800
[ -f "$src/feature-phone.png" ] && export_one "$src/feature-phone.png" feature-phone 600 900 1200
ls -l "$out"
