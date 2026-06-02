#!/bin/bash
set -euo pipefail

CLI="./scripts/upscayl"
OUTDIR="public/images"
COUNT=0
SKIPPED=0
FAILED=0

echo "🖼️  Batch upscaling gallery images (4x) with Upscayl CLI"
echo ""

for img in \
  bygdemuseet-2011 \
  klang-1985 \
  klang-1955 \
  skogbrynet \
  kvinnelaget-logtun \
  neset-skole \
  frostakameratene-1958 \
  herredsstyret-1929 \
  aungrenda-sykkel \
  oyanmoen-1923 \
  familie-hest \
  asholmen-1914 \
  vintersoldater \
  smaaland-1958 \
  mostad-kai-1949 \
  liavatnet-1950 \
  holmberget-kai \
  kirka-baeri \
  varonn-1946 \
  kvitsandvik-1960 \
; do
  input="${OUTDIR}/${img}.jpg"
  output="${OUTDIR}/${img}-upscaled.jpg"

  if [ -f "$output" ]; then
    echo "  ⏭️  SKIP: ${img}-upscaled.jpg (already exists)"
    ((SKIPPED++)) || true
    continue
  fi

  echo -n "  ⬆️  ${img} ... "
  if "$CLI" run -i "$input" -o "$output" > /dev/null 2>&1; then
    size=$(wc -c < "$output" | tr -d ' ')
    echo "✅ ($size bytes)"
    ((COUNT++)) || true
  else
    echo "❌ FAILED"
    rm -f "$output"
    ((FAILED++)) || true
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Upscaled: $COUNT"
echo "⏭️  Skipped:  $SKIPPED"
echo "❌ Failed:   $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
