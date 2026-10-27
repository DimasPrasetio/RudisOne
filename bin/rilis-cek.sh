#!/usr/bin/env bash
# Kesiapan rilis sebuah commit — READ-ONLY (GitHub via gh).
# Menampilkan semua workflow untuk commit itu dan tag image GHCR yang diterbitkan workflow rilis.
# Pemakaian: bin/rilis-cek.sh <owner/repo> <sha>      contoh: bin/rilis-cek.sh owner/app-saya 6385363
# Exit: 0 = semua workflow sukses & image terbit, 1 = ada yang gagal / image tak ditemukan,
#       2 = belum ada workflow atau masih berjalan, 3 = argumen/gh bermasalah.
set -u
REPO="${1:-}"; SHA="${2:-}"
if [[ ! "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ || ! "$SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Pemakaian: $0 <owner/repo> <sha>" >&2; exit 3
fi
command -v gh >/dev/null || { echo "gh (GitHub CLI) tidak ditemukan" >&2; exit 3; }

FULL=$(gh api "repos/$REPO/commits/$SHA" --jq .sha 2>/dev/null) || { echo "Commit $SHA tidak ditemukan di $REPO" >&2; exit 3; }
echo "== $REPO @ ${FULL:0:7} ($FULL)"

RUNS=$(gh run list --repo "$REPO" --commit "$FULL" --limit 20 \
  --json databaseId,workflowName,status,conclusion \
  --jq '.[] | "\(.databaseId)\t\(.workflowName)\t\(.status)\t\(.conclusion)"')
if [ -z "$RUNS" ]; then echo "Belum ada workflow untuk commit ini (belum di-push?)."; exit 2; fi

rc=0
printf '  %-22s %-12s %s\n' WORKFLOW STATUS HASIL
while IFS=$'\t' read -r id name status concl; do
  printf '  %-22s %-12s %s\n' "$name" "$status" "${concl:--}"
  if [ "$status" != "completed" ]; then [ "$rc" -eq 0 ] && rc=2
  elif [ "$concl" != "success" ]; then rc=1; fi
done <<<"$RUNS"

# Tag image dari log workflow rilis (nama mengandung release/image/publish).
img=""
while IFS=$'\t' read -r id name status concl; do
  [[ "$name" =~ release|image|publish ]] || continue
  [ "$status" = "completed" ] && [ "$concl" = "success" ] || continue
  img=$(gh run view "$id" --repo "$REPO" --log 2>/dev/null | grep -oE "ghcr\.io/[a-z0-9._/-]+:$FULL" | sort -u | head -1)
done <<<"$RUNS"

echo
if [ -n "$img" ]; then echo "Image: $img"
elif [ "$rc" -eq 0 ]; then echo "Image: tidak ditemukan di log workflow rilis"; rc=1
else echo "Image: belum terbit"; fi

case "$rc" in
  0) echo "Hasil: SIAP DEPLOY" ;;
  2) echo "Hasil: MASIH BERJALAN — cek lagi nanti" ;;
  *) echo "Hasil: BELUM SIAP" ;;
esac
exit "$rc"
