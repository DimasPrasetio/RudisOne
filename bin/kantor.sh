#!/usr/bin/env bash
# Kantor RudisOne — tampilan kantor yang memperlihatkan apa yang sedang dikerjakan tiap agent. Logika: bin/kantor.mjs.
# Pemakaian: bin/kantor.sh [buka|--tanpa-browser|mulai-ulang|berhenti|demo]
exec node "$(cd "$(dirname "$0")" && pwd)/kantor.mjs" "$@"
