#!/usr/bin/env bash
# Export the direction-prototype renders (art/brainbox-v2) into responsive
# AVIF + WebP files under prototypes/img. Optional feature crops are given as
# ffmpeg crop expressions so they come from the same masters.
# Usage: scripts/export-proto-art.sh <art/brainbox-v2 dir>
# Needs ffmpeg, cwebp and avifenc on PATH.
set -euo pipefail
src="$1"
out="$(cd "$(dirname "$0")/.." && pwd)/prototypes/img"
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

export_one() { # master name crop widths...
  local master="$1" name="$2" crop="$3"; shift 3
  local filter="format=rgb24"
  [ -n "$crop" ] && filter="crop=${crop},${filter}"
  for w in "$@"; do
    ffmpeg -loglevel error -y -i "$master" -vf "${filter},scale=${w}:-2:flags=lanczos" "$tmp/$name-$w.png"
    cwebp -quiet -q 82 -m 6 -sharp_yuv -metadata none "$tmp/$name-$w.png" -o "$out/$name-$w.webp"
    avifenc -q 62 -s 4 -y 444 -j all "$tmp/$name-$w.png" "$out/$name-$w.avif" >/dev/null
  done
}

export_one "$src/a-desktop.png" a-desktop "" 1440 2160 2880
export_one "$src/a-phone.png" a-phone "" 780 1170
export_one "$src/c-desktop.png" c-desktop "" 1440 2160 2880
export_one "$src/c-phone.png" c-phone "" 780 1170

# First-feature visuals: crops of the other route's master (see prototypes/README.md).
[ -n "${A_FEATURE_CROP:-}" ] && export_one "$src/${A_FEATURE_SRC:-c-desktop.png}" a-feature "$A_FEATURE_CROP" 1440 2160
[ -n "${A_FEATURE_PHONE_CROP:-}" ] && export_one "$src/${A_FEATURE_PHONE_SRC:-c-phone.png}" a-feature-phone "$A_FEATURE_PHONE_CROP" 780 1170
[ -n "${C_FEATURE_CROP:-}" ] && export_one "$src/${C_FEATURE_SRC:-a-desktop.png}" c-feature "$C_FEATURE_CROP" 1440 2160
[ -n "${C_FEATURE_PHONE_CROP:-}" ] && export_one "$src/${C_FEATURE_PHONE_SRC:-a-phone.png}" c-feature-phone "$C_FEATURE_PHONE_CROP" 780 1170
ls -l "$out"
