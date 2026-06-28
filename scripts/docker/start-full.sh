#!/bin/sh
set -eu

cd /app

(cd apps/api && npm run start) &
api_pid="$!"

(cd apps/web && npm run start) &
web_pid="$!"

term() {
  kill "$api_pid" "$web_pid" 2>/dev/null || true
}

trap term INT TERM

while :; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    term
    wait "$api_pid" 2>/dev/null || exit $?
  fi
  if ! kill -0 "$web_pid" 2>/dev/null; then
    term
    wait "$web_pid" 2>/dev/null || exit $?
  fi
  sleep 2
done
