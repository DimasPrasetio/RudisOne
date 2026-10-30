#!/usr/bin/env bash
# Perkakas resmi RudisOne (skill rudis-monorepo, pustaka rudis-modules, RUDIS SDD) dan skill luar terdaftar. Logika: bin/perkakas.mjs.
# Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill|marketplace cek [<sumber>]|sdd …] [--segera] [--paksa]
#            bin/perkakas.sh pat <layanan>   simpan/perbarui PAT repo privat (mis. rudisone-rudis-sdd); dijalankan PENGGUNA
# Skrip ini juga dipakai git sebagai GIT_ASKPASS (mode askpass di perkakas.mjs, dipicu env RUDISONE_ASKPASS_LAYANAN).
exec node "$(cd "$(dirname "$0")" && pwd)/perkakas.mjs" "$@"
