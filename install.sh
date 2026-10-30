#!/usr/bin/env bash
# Persiapan RudisOne di device ini. Logika: install.mjs (jalan juga di Windows tanpa bash: `node install.mjs`).
# Pemakaian: ./install.sh [--tanpa-perkakas]
exec node "$(cd "$(dirname "$0")" && pwd)/install.mjs" "$@"
