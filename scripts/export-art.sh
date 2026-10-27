#!/usr/bin/env bash
# Export Blender masters into responsive AVIF + WebP files under assets/img.
# Usage: scripts/export-art.sh <hero-desktop.png> <control-detail.png>
# Phones use a square crop of the desktop hero (see styles.css), so the
# portrait render is not exported.
# Needs ffmpeg (resize), cwebp and avifenc on PATH.
set -euo pipefail
out="$(cd "$(dirname "$0")/.." && pwd)/assets/img"
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

export_one() { # src name widths...
  local src="$1" name="$2"; shift 2
  for w in "$@"; do
    ffmpeg -loglevel error -y -i "$src" -vf "scale=${w}:-2:flags=lanczos,format=rgb24" "$tmp/$name-$w.png"
    cwebp -quiet -q 82 -m 6 -sharp_yuv -metadata none "$tmp/$name-$w.png" -o "$out/$name-$w.webp"
    avifenc -q 62 -s 4 -y 444 -j all "$tmp/$name-$w.png" "$out/$name-$w.avif" >/dev/null
  done
}

export_one "$1" hero-desktop 1200 1800 2400
export_one "$2" control-detail 800 1200 1800
ls -l "$out"
