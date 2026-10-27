#!/usr/bin/env bash
# Perkakas resmi RudisOne (skill rudis-monorepo + pustaka rudis-modules): pasang bila belum ada,
# perbarui bila tertinggal, tanpa menimpa pekerjaan pengguna. Rincian & exit code: bin/perkakas.mjs.
# Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>] [--segera] [--paksa]
exec node "$(cd "$(dirname "$0")" && pwd)/perkakas.mjs" "$@"
