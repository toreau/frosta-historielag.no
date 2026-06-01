#!/bin/bash
set -euo pipefail

MAP="scripts/image-map.txt"
SRCDIR="src"

echo "🔄 Updating image references in $SRCDIR ..."
echo ""

COUNT=0
while IFS='|' read -r oldurl newname; do
  newpath="/images/$newname"
  # Escape the URL for sed (slashes become \/)
  esc_url=$(echo "$oldurl" | sed 's/[\/&.]/\\&/g')
  esc_path=$(echo "$newpath" | sed 's/[\/&]/\\&/g')
  
  # Find and replace in all .astro and .md files under src/
  files_changed=$(grep -rlF "$oldurl" "$SRCDIR" 2>/dev/null | wc -l | tr -d ' ')
  
  if [ "$files_changed" -gt 0 ]; then
    grep -rlF "$oldurl" "$SRCDIR" | while read -r f; do
      # macOS sed: use -i '' with backup extension
      sed -i '' "s|$esc_url|$newpath|g" "$f"
    done
    echo "  ✅ $newname → $files_changed file(s)"
    ((COUNT++)) || true
  else
    echo "  ⚠️  $newname → no references found (already updated or unused)"
  fi
done < "$MAP"

echo ""
echo "✅ Updated $COUNT image references"
