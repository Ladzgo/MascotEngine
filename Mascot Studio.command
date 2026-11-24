#!/bin/bash
# Double-click launcher: starts the Studio and opens it in the browser.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -d node_modules/remotion ] || npm ci || exit 1
(sleep 3; open "http://localhost:4177") &
exec npm run app
