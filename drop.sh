#!/bin/bash
# 69th Ward Draft Derby — nightly drop. Runs via launchd at 18:00 America/Denver.
# Builds index.html from the seed (deterministic) and publishes. Safe to re-run.
set -e
cd "$(dirname "$0")"
export PATH=/opt/homebrew/bin:/usr/bin:/bin
/opt/homebrew/bin/python3 engine.py >> drop.log 2>&1
if ! git diff --quiet index.html 2>/dev/null; then
  git add index.html
  git commit -m "drop $(date +%F)" >> drop.log 2>&1
  git push origin main >> drop.log 2>&1
  echo "$(date '+%F %T') pushed" >> drop.log
else
  echo "$(date '+%F %T') no change" >> drop.log
fi
