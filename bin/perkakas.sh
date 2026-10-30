#!/usr/bin/env bash
# Perkakas resmi RudisOne (skill rudis-monorepo, pustaka rudis-modules, RUDIS SDD) dan skill luar terdaftar: pasang bila
# belum ada, perbarui bila tertinggal, tanpa menimpa pekerjaan pengguna. Rincian & exit code: bin/perkakas.mjs.
# Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill|marketplace cek [<sumber>]|sdd …] [--segera] [--paksa]
#            bin/perkakas.sh pat <layanan>   simpan/perbarui PAT repo privat (mis. rudisone-rudis-sdd); dijalankan PENGGUNA

# Mode GIT_ASKPASS — hanya saat perkakas.mjs menjalankan git untuk repo privat (env RUDISONE_ASKPASS_LAYANAN di proses
# git itu saja). PAT dibaca dari penyimpannya (macOS: Keychain; Linux/WSL2: berkas 0600 RUDISONE_ASKPASS_BERKAS) di
# proses ini dan hanya diserahkan ke git lewat stdout: tidak pernah lewat argumen, env, atau log.
if [ -n "${RUDISONE_ASKPASS_LAYANAN:-}" ]; then
  case "${1:-}" in
    Username*) printf '%s\n' "${RUDISONE_ASKPASS_PENGGUNA:-oauth2}" ;;
    *) if [ -n "${RUDISONE_ASKPASS_BERKAS:-}" ]; then head -n 1 "$RUDISONE_ASKPASS_BERKAS" | tr -d '\r'
       else exec "${RUDISONE_KEYCHAIN_BIN:-security}" find-generic-password -s "$RUDISONE_ASKPASS_LAYANAN" -w; fi ;;
  esac
  exit 0
fi

# pat <layanan> — PAT diketik saat diminta (tanpa gema), tidak pernah di argumen. macOS → Keychain; lainnya → berkas
# ${XDG_CONFIG_HOME:-~/.config}/rudisone/rahasia/<layanan> (folder 0700, berkas 0600), di luar repo.
if [ "${1:-}" = pat ]; then
  l="${2:-}"
  case "$l" in ""|.*|*/*|*[!A-Za-z0-9._-]*) echo "Pemakaian: bin/perkakas.sh pat <layanan>   (mis. rudisone-rudis-sdd)" >&2; exit 3 ;; esac
  if [ "${RUDISONE_OS:-$(uname -s | tr '[:upper:]' '[:lower:]')}" = darwin ]; then
    exec "${RUDISONE_KEYCHAIN_BIN:-security}" add-generic-password -U -s "$l" -a "$USER" -w
  fi
  d="${RUDISONE_RAHASIA_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/rudisone/rahasia}"
  umask 077
  mkdir -p "$d" && chmod 700 "$d" || exit 1
  if [ -t 0 ]; then printf 'PAT untuk %s (tidak ditampilkan): ' "$l" >&2; IFS= read -rs v; echo >&2
  else IFS= read -r v; fi
  v="${v%$'\r'}"
  [ -n "$v" ] || { echo "PAT kosong — tidak disimpan." >&2; exit 1; }
  printf '%s\n' "$v" > "$d/.$l.baru" && chmod 600 "$d/.$l.baru" && mv -f "$d/.$l.baru" "$d/$l" || exit 1
  echo "PAT $l tersimpan di $d/$l (mode 0600, hanya terbaca $(id -un))." >&2
  exit 0
fi
exec node "$(cd "$(dirname "$0")" && pwd)/perkakas.mjs" "$@"
