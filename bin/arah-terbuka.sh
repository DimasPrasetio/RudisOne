#!/usr/bin/env bash
# Keputusan arah yang masih terbuka per folder/standar (catatan/*.md + register) — logika: bin/arah-terbuka.mjs (read-only).
# Pemakaian: bin/arah-terbuka.sh [<folder>] [--kata <kunci>]… [--json]   (exit 0 · 3 pemakaian salah)
exec node "$(cd "$(dirname "$0")" && pwd)/arah-terbuka.mjs" "$@"
