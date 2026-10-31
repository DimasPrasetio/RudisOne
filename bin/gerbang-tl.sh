#!/usr/bin/env bash
# Gerbang mesin sebelum Tech Lead-subagent melapor — READ-ONLY. Logika: bin/gerbang-tl.mjs.
# Pemakaian: bin/gerbang-tl.sh <ID> [--repo <path>] [--base <ref>] [--handoff <folder>] [--transkrip <jsonl>] [--json]
#   (exit 0 SIAP LAPOR · 2 kurang · 1 galat)
exec node "$(cd "$(dirname "$0")" && pwd)/gerbang-tl.mjs" "$@"
