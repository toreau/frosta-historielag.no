#!/bin/bash
set -euo pipefail

MAP="scripts/image-map.txt"
OUTDIR="public/images"
SUCCESS=0
FAILED=0
SKIPPED=0

mkdir -p "$OUTDIR"

echo "📥 Downloading images to $OUTDIR ..."
echo ""

while IFS='|' read -r url filename; do
  dest="$OUTDIR/$filename"
  if [ -f "$dest" ]; then
    echo "  ⏭️  SKIP: $filename (already exists)"
    ((SKIPPED++)) || true
    continue
  fi
  echo -n "  ⬇️  $filename ... "
  if curl -fsSL --max-time 30 -o "$dest" "$url" 2>/dev/null; then
    size=$(wc -c < "$dest" | tr -d ' ')
    echo "✅ ($size bytes)"
    ((SUCCESS++)) || true
  else
    echo "❌ FAILED"
    rm -f "$dest"
    ((FAILED++)) || true
  fi
done < "$MAP"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Downloaded: $SUCCESS"
echo "⏭️  Skipped:   $SKIPPED"
echo "❌ Failed:    $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
