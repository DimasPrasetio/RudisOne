#!/usr/bin/env bash
# Pemeriksa konsistensi RudisOne (read-only). Lihat bin/cek-konsistensi.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/cek-konsistensi.mjs" "$@"
