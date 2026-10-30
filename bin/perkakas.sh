#!/usr/bin/env bash
# Perkakas resmi RudisOne (skill rudis-monorepo, pustaka rudis-modules, RUDIS SDD) dan skill luar terdaftar: pasang bila
# belum ada, perbarui bila tertinggal, tanpa menimpa pekerjaan pengguna. Rincian & exit code: bin/perkakas.mjs.
# Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill|marketplace cek [<sumber>]|sdd …] [--segera] [--paksa]

# Mode GIT_ASKPASS — hanya saat perkakas.mjs menjalankan git untuk repo privat (env RUDISONE_ASKPASS_LAYANAN di proses
# git itu saja). PAT dibaca dari Keychain di proses ini dan hanya diserahkan ke git lewat stdout: tidak pernah lewat
# argumen, env, berkas, atau log.
if [ -n "${RUDISONE_ASKPASS_LAYANAN:-}" ]; then
  case "${1:-}" in
    Username*) printf '%s\n' "${RUDISONE_ASKPASS_PENGGUNA:-oauth2}" ;;
    *) exec "${RUDISONE_KEYCHAIN_BIN:-security}" find-generic-password -s "$RUDISONE_ASKPASS_LAYANAN" -w ;;
  esac
  exit 0
fi
exec node "$(cd "$(dirname "$0")" && pwd)/perkakas.mjs" "$@"
