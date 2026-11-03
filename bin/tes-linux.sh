#!/usr/bin/env bash
# Tes RudisOne di kontainer Linux (Docker) — logika & prasyarat otomatis: bin/tes-linux.mjs.
# Pemakaian: bin/tes-linux.sh [--semua] [--image <nama:tag>] [--tanpa-mulai] [--tanpa-unduh] [<berkas.test.mjs> …]
#   (exit 0 lulus · 1 ada tes gagal · 2 pemakaian salah · 3 Docker belum siap — tes dilewati, perintah untuk pengguna dicetak)
exec node "$(cd "$(dirname "$0")" && pwd)/tes-linux.mjs" "$@"
