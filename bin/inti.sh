#!/usr/bin/env bash
# Hook SessionStart RudisOne: muat ulang inti + peran setelah kompaksi (pasang/lepas oleh pemilik). Lihat bin/inti.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/inti.mjs" "$@"
