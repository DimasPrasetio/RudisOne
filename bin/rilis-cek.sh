#!/usr/bin/env bash
# Kesiapan rilis sebuah commit — READ-ONLY (GitHub via gh). Logika: bin/rilis-cek.mjs.
# Pemakaian: bin/rilis-cek.sh <owner/repo> <sha>   (exit 0 siap · 1 gagal · 2 berjalan · 3 argumen/gh)
exec node "$(cd "$(dirname "$0")" && pwd)/rilis-cek.mjs" "$@"
