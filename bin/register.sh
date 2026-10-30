#!/usr/bin/env bash
# Register tugas RudisOne (JSON sumber kebenaran, MD dibangkitkan) — lihat bin/register.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/register.mjs" "$@"
