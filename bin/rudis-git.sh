#!/usr/bin/env bash
# Pengaman git untuk command RUDIS: checkpoint = commit di branch tugas, rollback = commit pemulihan (tanpa stash/reset).
# Pemakaian: bin/rudis-git.sh checkpoint <ID> [pesan] | rollback <ID> <sha> -- <path…> | daftar <ID>   (rinci: bin/rudis-git.mjs)
exec node "$(cd "$(dirname "$0")" && pwd)/rudis-git.mjs" "$@"
