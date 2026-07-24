#!/usr/bin/env bash
# Build dist/skrebutis.min.js (or rebuild on .ts change), serve on 9999, open index.html.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

npm run build:min
npm run watch &
WATCH_PID=$!
python3 -m http.server 9999 &
SERVER_PID=$!
trap 'kill $WATCH_PID $SERVER_PID 2>/dev/null' EXIT
sleep 0.5
open "http://127.0.0.1:9999/index.html"
wait $SERVER_PID
