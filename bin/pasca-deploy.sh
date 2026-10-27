#!/usr/bin/env bash
# Verifikasi setelah deploy — READ-ONLY. Menunggu healthcheck (maks ±60 dtk), lalu memastikan app
# menjalankan image <sha>, healthy, /readyz 200, dan app lain di server tetap healthy.
# Container & port dibaca dari "App registry" di playbook server (path: bin/konfig.sh playbook).
# Pemakaian: bin/pasca-deploy.sh <app> <sha> [alias-server]   contoh: bin/pasca-deploy.sh app-saya 6385363
# Exit: 0 = lolos, 1 = gagal, 3 = argumen salah / app tak terdaftar / konfigurasi belum ada / tak bisa terhubung.
set -u
APP="${1:-}"; SHA="${2:-}"
if [[ ! "$APP" =~ ^[a-z0-9-]+$ || ! "$SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Pemakaian: $0 <app> <sha> [alias-server]" >&2; exit 3
fi
SINI="$(cd "$(dirname "$0")" && pwd)"
HOST="$("$SINI/konfig.sh" host "${3:-}")" || exit 3
PB="$("$SINI/konfig.sh" playbook "${3:-}")" || exit 3
[ -n "$PB" ] || { echo "Playbook server belum dikonfigurasi (server.<alias>.playbook) — container & port app tidak bisa dibaca" >&2; exit 3; }

ssh -o BatchMode=yes -o ConnectTimeout=10 -o LogLevel=ERROR "$HOST" bash -s -- "$APP" "$SHA" "$PB" <<'REMOTE'
set -u
APP="$1"; SHA="$2"; PB="$3"
registry() {
  awk -F'|' '/^## App registry/{f=1; next} f && /^## /{f=0}
    f && /^\| [a-z]/ { a=$2; c=$4; p=$5; gsub(/[ `]/,"",a); gsub(/[ `]/,"",c); gsub(/[ `]/,"",p); print a, c, p }' "$PB"
}
read -r _ CTR PORT <<<"$(registry | awk -v a="$APP" '$1==a')"
[ -n "${CTR:-}" ] || { echo "App '$APP' tidak ada di App registry $PB"; exit 3; }

state() { docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$1" 2>/dev/null || echo tidak-ada; }

for _ in $(seq 1 12); do
  st=$(state "$CTR"); [[ "$st" == */starting ]] || break; sleep 5
done
img=$(docker inspect -f '{{.Config.Image}}' "$CTR" 2>/dev/null || echo "-")
rz=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$PORT/readyz" || true)

fail=0
check() { if [ "$2" = ok ]; then echo "  [ok] $1"; else echo "  [!!] $1"; fail=1; fi; }
echo "== Pasca-deploy $APP ($CTR, 127.0.0.1:$PORT) — $(date -u +%Y-%m-%dT%H:%MZ)"
[[ "${img##*:}" == "$SHA"* ]] && r=ok || r=no; check "image $img (harus $SHA…)" "$r"
[ "$st" = "running/healthy" ] && r=ok || r=no; check "status $st" "$r"
[ "$rz" = 200 ] && r=ok || r=no; check "/readyz $rz" "$r"
# Uji lewat domain publik seperti browser (header Origin). curl polos lolos walau browser ditolak CORS
# (pelajaran insiden CORS). Domain diambil dari situs nginx yang mem-proxy ke port app ini.
doms=$(grep -lsR "127.0.0.1:$PORT" /etc/nginx/sites-enabled/ | xargs -r grep -h "^[[:space:]]*server_name" \
  | sed 's/server_name//; s/;//' | tr -s ' \t' '\n' | grep '\.' | sort -u)
for d in $doms; do
  co=$(curl -s -o /dev/null -m 8 -w '%{http_code}' --resolve "$d:443:127.0.0.1" -H "Origin: https://$d" "https://$d/readyz" || true)
  [ "$co" = 200 ] && r=ok || r=no; check "https://$d/readyz dgn Origin: $co" "$r"
done
while read -r a c _; do
  [ "$a" = "$APP" ] && continue
  s=$(state "$c"); [ "$s" = "running/healthy" ] && r=ok || r=no; check "app lain $a: $s" "$r"
done < <(registry)

echo
if [ "$fail" -eq 0 ]; then echo "Hasil: LOLOS"; else echo "Hasil: GAGAL — jangan lanjut; laporkan ke pemberi tugas"; fi
exit "$fail"
REMOTE
rc=$?
[ "$rc" -eq 255 ] && { echo "Tidak bisa terhubung ke $HOST" >&2; exit 3; }
exit "$rc"
