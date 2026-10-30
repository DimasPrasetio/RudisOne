#!/usr/bin/env bash
# Backend sesi RudisOne per device (desktop | cli) — rincian & exit code: bin/sesi.mjs.
# Pemakaian: bin/sesi.sh [backend|deteksi [--tulis]|daftar [--json]|cek]
exec node "$(cd "$(dirname "$0")" && pwd)/sesi.mjs" "$@"
