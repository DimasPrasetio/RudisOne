set -u
PB="${1:-}"
warn=0
notes=()
w() { notes+=("$*"); warn=1; }

echo "== Host $(hostname) — $(date -u +%Y-%m-%dT%H:%MZ)"
echo "  uptime/load : $(uptime | sed 's/^.*up /up /')"
read -r size used pct <<<"$(df -h / | awk 'NR==2{print $2, $3, $5}')"
echo "  disk /      : $used dari $size ($pct)"
[ "${pct%%%}" -ge 85 ] && w "disk / >= 85%"
read -r mtot mused mavail <<<"$(free -m | awk '/^Mem:/{print $2, $3, $7}')"
read -r stot sused <<<"$(free -m | awk '/^Swap:/{print $2, $3}')"
echo "  RAM         : terpakai ${mused}Mi, tersedia ${mavail}Mi dari ${mtot}Mi; swap ${sused}/${stot}Mi"
[ "$mavail" -lt 300 ] && w "RAM tersedia < 300Mi"
systemctl is-active --quiet nginx && echo "  nginx       : active" || w "nginx tidak active"
systemctl is-active --quiet mysql && echo "  mysql       : active" || w "mysql tidak active"

echo
if [ -z "$PB" ] || [ ! -r "$PB" ]; then
  echo "== App: playbook server tidak dikonfigurasi/terbaca — daftar app dilewati"
else
echo "== App (registry: $PB)"
printf '  %-10s %-14s %-6s %-8s %-18s %-7s %s\n' APP CONTAINER PORT IMAGE STATUS READYZ "SSL(hari)"
while read -r app ctr port dom; do
  st=$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$ctr" 2>/dev/null || echo "tidak-ada")
  img=$(docker inspect -f '{{.Config.Image}}' "$ctr" 2>/dev/null || echo "-")
  tag="${img##*:}"; tag="${tag:0:7}"
  rz=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$port/readyz" || true)
  cert="-"
  if [ "$dom" != "-" ]; then
    end=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$dom" 2>/dev/null \
          | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$end" ]; then
      cert=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
      [ "$cert" -lt 14 ] && w "$app: sertifikat $dom habis dalam $cert hari ($end)"
    else
      cert="?"; w "$app: sertifikat $dom tidak terbaca"
    fi
  fi
  printf '  %-10s %-14s %-6s %-8s %-18s %-7s %s\n' "$app" "$ctr" "$port" "$tag" "$st" "$rz" "$cert"
  [ "$st" = "running/healthy" ] || w "$app: container $st"
  [ "$rz" = "200" ] || w "$app: /readyz $rz"
done < <(awk -F'|' '
  /^## App registry/ {f=1; next}
  f && /^## / {f=0}
  f && /^\| [a-z]/ {
    app=$2; ctr=$4; port=$5; dom=$9
    gsub(/[ `]/, "", app); gsub(/[ `]/, "", ctr); gsub(/[ `]/, "", port)
    if (match(dom, /[a-z0-9-]+(\.[a-z0-9-]+)+\.[a-z]+/)) d=substr(dom, RSTART, RLENGTH); else d="-"
    print app, ctr, port, d
  }' "$PB")
fi

echo
if [ "$warn" -eq 0 ]; then
  echo "Hasil: SEHAT"
else
  echo "Hasil: ADA PERINGATAN"
  for n in "${notes[@]}"; do echo "  ! $n"; done
fi
exit "$warn"
