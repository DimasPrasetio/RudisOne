#!/usr/bin/env bash
# Kebijakan akses & batas kewenangan RudisOne — lihat bin/kebijakan.mjs (pasang | lepas | cek | tampil | audit | uji).
exec node "$(cd "$(dirname "$0")" && pwd)/kebijakan.mjs" "$@"
