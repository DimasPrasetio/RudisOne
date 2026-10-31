#!/usr/bin/env bash
# Cek kunci .env tanpa nilai — hanya nama kunci + status yang dicetak. Logika: bin/env-kunci.mjs.
# Pemakaian: bin/env-kunci.sh [--contoh <berkas>] [--wajib K1,K2] [--salah-satu K1,K2]… [--json] [<berkas>]
# (exit 0 lengkap · 3 kurang/berkas tidak ada · 4 hanya placeholder · 1 galat)
exec node "$(cd "$(dirname "$0")" && pwd)/env-kunci.mjs" "$@"
