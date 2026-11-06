#!/usr/bin/env bash
# Build the web port and zip it for an itch.io HTML5 upload.
# The zip has index.html at its root, which is what itch.io expects.
set -euo pipefail
cd "$(dirname "$0")"

npm run build

OUT="$(cd .. && pwd)/docs/pew-pew-defense-deluxe-web.zip"
rm -f "$OUT"
(cd dist && zip -r -9 -q "$OUT" . -x '.*')

echo "Wrote $OUT"
du -h "$OUT"
