#!/usr/bin/env bash
# Daftar jebakan per proyek — READ-ONLY. Logika & letak: bin/jebakan.mjs; format: templat/jebakan.md.
# Pemakaian: bin/jebakan.sh [baca|letak] <folder> [--json] · bin/jebakan.sh cek <berkas>… [--json]
#   (exit 0 bersih · 1 peringatan · 2 galat/argumen salah)
exec node "$(cd "$(dirname "$0")" && pwd)/jebakan.mjs" "$@"
