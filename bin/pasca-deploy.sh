#!/usr/bin/env bash
# Verifikasi setelah deploy — READ-ONLY. Logika: bin/pasca-deploy.mjs (pemeriksaan di server: bin/remoto/pasca-deploy.sh).
# Pemakaian: bin/pasca-deploy.sh <app> <sha> [alias-server]   (exit 0 lolos · 1 gagal · 3 argumen/konfigurasi/koneksi)
exec node "$(cd "$(dirname "$0")" && pwd)/pasca-deploy.mjs" "$@"
