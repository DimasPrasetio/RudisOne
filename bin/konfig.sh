#!/usr/bin/env bash
# Konfigurasi per device RudisOne (server, aplikasi, DNS) — baca saja. Lihat bin/konfig.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/konfig.mjs" "$@"
