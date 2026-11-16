#!/usr/bin/env bash
# Sinyal langsung Claude Code → Kantor (hook PermissionRequest/Notification/Stop/…; pasang/lepas oleh pemasang). Lihat bin/kantor-kejadian.mjs.
exec node "$(cd "$(dirname "$0")" && pwd)/kantor-kejadian.mjs" "$@"
