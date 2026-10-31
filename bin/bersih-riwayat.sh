#!/usr/bin/env bash
# Pembersih riwayat tugas selesai/dibatalkan > 24 jam — logika: bin/bersih-riwayat.mjs (algoritma, tanpa AI).
# Pemakaian: bin/bersih-riwayat.sh [--jalankan | --usulan-git] [--rinci] [--base <branch>] [--json]
#   (bawaan dry-run · exit 0 berhasil · 1 galat · 3 pemakaian salah)
exec node "$(cd "$(dirname "$0")" && pwd)/bersih-riwayat.mjs" "$@"
