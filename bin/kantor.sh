#!/usr/bin/env bash
# Kantor RudisOne — tampilan kantor yang memperlihatkan apa yang sedang dikerjakan tiap agent.
# Menyalakan server lokal (127.0.0.1) bila belum jalan — atau memulai ulang server yang menjalankan kode
# lama (sidik server.mjs di /health berbeda dengan file di disk) — lalu membuka browser.
# Pemakaian: bin/kantor.sh [buka|--tanpa-browser|mulai-ulang|berhenti|demo]
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${RUDISONE_KANTOR_PORT:-7421}"
URL="http://127.0.0.1:$PORT"
LOG="${TMPDIR:-/tmp}/kantor-rudisone.log"
AKSI="${1:-buka}"

berhenti() { pkill -f "$ROOT/kantor/server.mjs"; }
sidik() { { shasum -a 1 "$ROOT/kantor/server.mjs" 2>/dev/null || sha1sum "$ROOT/kantor/server.mjs"; } | cut -c1-12; }
sehat() { curl -fsS -m 2 "$URL/health" 2>/dev/null; }

case "$AKSI" in
  berhenti) if berhenti; then echo "Kantor dimatikan."; else echo "Kantor tidak sedang berjalan."; fi; exit 0 ;;
  buka|--tanpa-browser|mulai-ulang|demo) ;;
  *) sed -n '2,5p' "$0"; exit 1 ;;
esac

jalan="$(sehat)"
if [ -n "$jalan" ] && { [ "$AKSI" = "mulai-ulang" ] || [ "$jalan" != "ok $(sidik)" ]; }; then
  echo "Memulai ulang Kantor (kode server berubah atau diminta)."
  berhenti
  for _ in $(seq 1 20); do sehat >/dev/null || break; sleep 0.25; done
  jalan=""
fi
if [ -z "$jalan" ]; then
  command -v node >/dev/null 2>&1 || { echo "Node.js tidak ditemukan — pasang Node 18 atau lebih baru." >&2; exit 1; }
  RUDISONE_KANTOR_PORT="$PORT" nohup node "$ROOT/kantor/server.mjs" >"$LOG" 2>&1 &
  for _ in $(seq 1 20); do sehat >/dev/null && break; sleep 0.25; done
fi
if ! sehat >/dev/null; then
  echo "Kantor gagal menyala. Log: $LOG" >&2; tail -5 "$LOG" >&2; exit 1
fi

[ "$AKSI" = "demo" ] && URL="$URL/?demo=1"
echo "Kantor RudisOne: $URL"
[ "$AKSI" = "--tanpa-browser" ] || [ "$AKSI" = "mulai-ulang" ] && exit 0
# macOS: open · Linux: xdg-open · WSL2: wslview (paket wslu) — gagal semua → buka URL di atas secara manual
open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || wslview "$URL" 2>/dev/null || true
