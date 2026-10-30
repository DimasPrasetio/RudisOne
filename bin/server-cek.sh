#!/usr/bin/env bash
# Snapshot kesehatan server deploy — READ-ONLY. Logika: bin/server-cek.mjs (pemeriksaan di server: bin/remoto/server-cek.sh).
# Pemakaian: bin/server-cek.sh [alias-server]   (exit 0 sehat · 1 peringatan · 2 tak terhubung · 3 konfigurasi belum ada)
exec node "$(cd "$(dirname "$0")" && pwd)/server-cek.mjs" "$@"
