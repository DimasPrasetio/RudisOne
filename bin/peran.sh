#!/usr/bin/env bash
# Subagent peran RudisOne: bangkitkan/cek agen/rudis-<id-peran>.md dari agents/ + protokol.md. Lihat bin/peran.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/peran.mjs" "$@"
