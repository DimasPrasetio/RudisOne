#!/usr/bin/env bash
# Simulasi Linux di macOS (T-20261030-10) — BUKAN pengganti uji di mesin Linux sungguhan.
# Menjalankan tes RudisOne dengan: process.platform = "linux" di semua proses node (NODE_OPTIONS --import),
# HOME = /home/<user> (default /home/uji, tidak harus ada), PATH tanpa alat khusus macOS (security, sw_vers, open,
# pbcopy, osascript, defaults, ditto, xattr) dan `uname` yang mengaku Linux.
# Pemakaian: uji/simulasi-linux/jalankan.sh [berkas/folder tes …]   (default: bin/ kantor/)
#            uji/simulasi-linux/jalankan.sh -- <perintah …>        perintah apa pun di lingkungan simulasi
#            (HOME yang bisa ditulis: RUDISONE_SIM_HOME=<folder>/home/uji)
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SIM="$(mktemp -d "${TMPDIR:-/tmp}/simulasi-linux.XXXXXX")"
trap 'rm -rf "$SIM"' EXIT
mkdir -p "$SIM/bin"
MAC_SAJA=" security sw_vers open pbcopy pbpaste osascript defaults ditto xattr launchctl "
IFS=: read -r -a dirs <<<"$PATH"
for d in "${dirs[@]}"; do
  [ -d "$d" ] || continue
  for f in "$d"/*; do
    n="${f##*/}"
    [ -x "$f" ] && [ ! -d "$f" ] || continue
    case "$MAC_SAJA" in *" $n "*) continue ;; esac
    [ -e "$SIM/bin/$n" ] || ln -s "$f" "$SIM/bin/$n"
  done
done
rm -f "$SIM/bin/uname"
cat > "$SIM/bin/uname" <<'U'
#!/bin/sh
case "${1:-}" in -s|"") echo Linux ;; -r) echo 6.6.0-simulasi ;; -m) echo x86_64 ;; *) echo "Linux simulasi 6.6.0 x86_64" ;; esac
U
chmod +x "$SIM/bin/uname"
export PATH="$SIM/bin" HOME="${RUDISONE_SIM_HOME:-/home/uji}" USER=uji
export NODE_OPTIONS="--import=$ROOT/uji/simulasi-linux/platform-linux.mjs${NODE_OPTIONS:+ $NODE_OPTIONS}"
unset RUDISONE_OS XDG_CONFIG_HOME
echo "simulasi: platform=$(node -p process.platform) HOME=$HOME uname=$(uname -s) security=$(command -v security || echo tidak-ada)"
# git sistem macOS (Xcode) memakai credential.helper osxkeychain — jangan sampai kredensial device terbawa ke simulasi.
export GIT_CONFIG_NOSYSTEM=1
if [ "${1:-}" = "--" ]; then shift; "$@"; exit $?; fi
cd "$ROOT" && if [ $# -eq 0 ]; then set -- bin/ kantor/; fi && node --test "$@"
