#!/usr/bin/env bash
# Persiapan RudisOne di device ini. Aman dijalankan berulang: hanya membuat folder per device,
# memeriksa prasyarat, dan memberi tahu langkah manual. Tidak mengubah aturan izin Claude Code.
set -u
# --tanpa-perkakas : lewati bin/perkakas.sh siapkan (mis. saat menguji installer dari worktree atau HOME sementara)
TANPA_PERKAKAS=0; for a in "$@"; do [ "$a" = "--tanpa-perkakas" ] && TANPA_PERKAKAS=1; done

ROOT="$(cd "$(dirname "$0")" && pwd)"
AGENTS=(system-administrator head-of-it-operations program-manager technical-writer software-engineer business-systems-analyst head-of-strategy research-analyst financial-controller hr-business-partner)
ok=0; warn=0
pass() { printf '  [ok]   %s\n' "$1"; ok=$((ok + 1)); }
fail() { printf '  [!!]   %s\n' "$1"; warn=$((warn + 1)); }

echo "RudisOne — pemeriksaan di $(hostname)"

# Tautan ke ~/.claude hanya dibuat dari lokasi rumah: tautan dari worktree/salinan lain akan patah saat folder itu
# dihapus, dan install.sh dari lokasi rumah menganggapnya milik sistem lain. RUDISONE_INSTALL_PAKSA=1 hanya untuk uji
# dengan HOME sementara.
TAUT=1
if [ "$ROOT" = "$HOME/Documents/Neuron/ai-agent/RudisOne" ]; then pass "lokasi repo: ~/Documents/Neuron/ai-agent/RudisOne"
elif [ "${RUDISONE_INSTALL_PAKSA:-0}" = 1 ]; then fail "repo ada di $ROOT (bukan lokasi rumah) — tautan tetap dibuat karena RUDISONE_INSTALL_PAKSA=1"
else TAUT=0; fail "repo ada di $ROOT — pindahkan/clone ke ~/Documents/Neuron/ai-agent/RudisOne (peran merujuk path itu); skill & subagent TIDAK ditautkan dari lokasi ini"; fi

mkdir -p "$ROOT/handoff" && touch "$ROOT/handoff/.gitkeep" && pass "folder handoff/ siap"
mkdir -p "$ROOT/catatan" && pass "folder catatan/ siap (ingatan per peran, per device — tidak di-commit)"
# Berkas per device yang masih dilacak git (mis. catatan/ sebelum serah migrasi v5) — merge bisa menghapusnya dari disk.
dilacak="$(git -C "$ROOT" ls-files -ci --exclude-standard 2>/dev/null | cut -d/ -f1 | sort -u | tr '\n' ' ')"
if [ -n "$dilacak" ]; then fail "berkas per device masih dilacak git: ${dilacak}— sebelum merge: git rm -r --cached ${dilacak}&& git commit (README › Serah migrasi v5 ke main)"
else pass "berkas per device tidak dilacak git"; fi

check_link() { # $1 = symlink, $2 = id peran
  if [ -L "$1" ] && head -3 "$1" 2>/dev/null | grep -q "^name: $2\$"; then pass "peran $2 tertaut"
  else fail "peran $2 tidak tertaut di ${1#"$ROOT"/} (jalankan: git checkout -- .)"; fi
}
check_link "$ROOT/.claude/agents/coo.md" coo
# Tech Lead tidak punya ruang: sesinya di folder proyek (worktree), peran dari pembuka brief.
if head -3 "$ROOT/agents/tech-lead.md" 2>/dev/null | grep -q "^name: tech-lead$"; then pass "peran tech-lead ada"
else fail "agents/tech-lead.md hilang (jalankan: git checkout -- .)"; fi
for f in raci.md protokol.md CLAUDE.md templat/team.md templat/register-tugas.md; do
  [ -f "$ROOT/$f" ] && pass "$f ada" || fail "$f hilang (jalankan: git checkout -- .)"
done
for a in "${AGENTS[@]}"; do check_link "$ROOT/ruang/$a/.claude/agents/$a.md" "$a"; done

# Subagent peran (protokol.md › Model sesi): agen/rudis-<id-peran>.md dibangkitkan dari agents/ + protokol.md,
# ditautkan ke ~/.claude/agents agar bisa dipanggil dari sesi di folder mana pun.
if node "$ROOT/bin/peran.mjs" cek >/dev/null 2>&1; then pass "definisi subagent peran mutakhir (agen/)"
else fail "agen/ basi — jalankan: $ROOT/bin/peran.sh bangun"; fi
[ "$TAUT" = 1 ] && mkdir -p "$HOME/.claude/agents"
for f in "$ROOT"/agen/rudis-*.md; do
  [ "$TAUT" = 1 ] || break
  [ -e "$f" ] || continue
  n="$(basename "$f")"; tujuan="$HOME/.claude/agents/$n"
  if [ ! -e "$tujuan" ] && [ ! -L "$tujuan" ]; then ln -s "$f" "$tujuan" && pass "subagent ${n%.md} tertaut"
  elif [ -L "$tujuan" ] && [[ "$(readlink "$tujuan")" == "$ROOT/"* ]]; then ln -sfn "$f" "$tujuan" && pass "subagent ${n%.md} tertaut"
  else fail "~/.claude/agents/$n sudah dipakai sistem lain — tidak disentuh, periksa manual"; fi
done
# tautan subagent yatim milik repo ini (peran dihapus) dibersihkan
for l in "$HOME"/.claude/agents/rudis-*.md; do
  [ -L "$l" ] || continue
  [[ "$(readlink "$l")" == "$ROOT/"* ]] && [ ! -e "$l" ] && rm "$l" && pass "tautan yatim $(basename "$l") dihapus"
done

# Skill tim → ~/.claude/skills (symlink, agar tersedia di semua sesi termasuk sesi tugas di folder proyek)
[ "$TAUT" = 1 ] && mkdir -p "$HOME/.claude/skills"
for d in "$ROOT"/skills/*/; do
  [ "$TAUT" = 1 ] || break
  n="$(basename "$d")"; tujuan="$HOME/.claude/skills/$n"
  # hanya membuat tautan baru atau memperbarui tautan milik repo ini — skill sistem lain tidak pernah ditimpa
  if [ ! -e "$tujuan" ] && [ ! -L "$tujuan" ]; then ln -s "${d%/}" "$tujuan" && pass "skill $n tertaut"
  elif [ -L "$tujuan" ] && [[ "$(readlink "$tujuan")" == "$ROOT/"* ]]; then ln -sfn "${d%/}" "$tujuan" && pass "skill $n tertaut"
  else fail "~/.claude/skills/$n sudah dipakai sistem lain ($(readlink "$tujuan" || echo "bukan tautan")) — tidak disentuh, periksa manual"; fi
done

for s in server-cek rilis-cek pasca-deploy perkakas kebijakan konfig register peran inti cek-konsistensi; do
  if [ -x "$ROOT/bin/$s.sh" ]; then pass "perkakas bin/$s.sh"
  else fail "bin/$s.sh tidak executable (jalankan: chmod +x $ROOT/bin/*.sh)"; fi
done
[ -x "$ROOT/bin/kantor.sh" ] && pass "perkakas bin/kantor.sh" || fail "bin/kantor.sh tidak executable"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then
  pass "Node.js $(node -v) — dipakai Kantor RudisOne"
else fail "Node.js 18+ tidak ditemukan — dibutuhkan bin/kantor.sh"; fi
# Kebijakan akses & batas kewenangan (skill rudis-operasi): hook dipasang PEMILIK sendiri.
if node "$ROOT/bin/kebijakan.mjs" cek >/dev/null 2>&1; then pass "kebijakan akses RudisOne terpasang (hook ~/.claude/settings.json)"
else fail "kebijakan akses RudisOne belum terpasang — pemilik menjalankan: $ROOT/bin/kebijakan.sh pasang"; fi
# Pemuat ulang inti setelah kompaksi untuk sesi RudisOne di folder proyek (protokol.md): hook dipasang PEMILIK sendiri.
if node "$ROOT/bin/inti.mjs" cek >/dev/null 2>&1; then pass "hook pemuat ulang inti RudisOne terpasang (SessionStart)"
else fail "hook pemuat ulang inti belum terpasang — pemilik menjalankan: $ROOT/bin/inti.sh pasang"; fi
# Perkakas resmi SDLC (skill rudis-sdlc): skill rudis-monorepo + pustaka rudis-modules (+ RUDIS SDD) — pasang/perbarui.
if [ "$TANPA_PERKAKAS" = 1 ]; then printf '  [..]   %s\n' "perkakas resmi SDLC dilewati (--tanpa-perkakas)"
elif command -v node >/dev/null 2>&1 && command -v git >/dev/null 2>&1; then
  if "$ROOT/bin/perkakas.sh" siapkan --segera | sed 's/^/  /'; [ "${PIPESTATUS[0]}" -eq 0 ]; then pass "perkakas resmi SDLC siap"
  else fail "perkakas resmi SDLC perlu perhatian (lihat baris di atas)"; fi
else fail "perkakas resmi SDLC dilewati — butuh node dan git"; fi
command -v gh >/dev/null 2>&1 && pass "GitHub CLI (gh) — dipakai rilis-cek.sh" \
  || fail "gh tidak ditemukan — rilis-cek.sh butuh GitHub CLI yang sudah login"

if command -v claude >/dev/null 2>&1; then pass "Claude Code CLI: $(command -v claude)"
else fail "Claude Code CLI tidak ditemukan (opsional bila hanya memakai Claude Desktop)"; fi

# Server & DNS: fakta per device di konfigurasi/server.json (penyedia.md › Konfigurasi server), bukan di repo.
if "$ROOT/bin/konfig.sh" cek >/dev/null 2>&1; then
  pass "konfigurasi server lengkap (konfigurasi/server.json)"
  for alias in $(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(Object.keys(c.server??{}).join(" "))' "$ROOT/konfigurasi/server.json" 2>/dev/null); do
    h="$("$ROOT/bin/konfig.sh" host "$alias")"
    if ssh -o BatchMode=yes -o ConnectTimeout=10 "$h" true >/dev/null 2>&1; then pass "ssh $h ($alias)"
    else fail "ssh $h ($alias) gagal — siapkan kunci SSH + entri Host $h di ~/.ssh/config"; fi
  done
  mcp="$("$ROOT/bin/konfig.sh" get dns.mcp_server 2>/dev/null)"
  if [ -n "$mcp" ] && [ "$mcp" != "null" ]; then
    if grep -q "\"$mcp\"" "$HOME/.claude.json" 2>/dev/null; then pass "MCP $mcp terpasang"
    else fail "MCP $mcp belum terpasang/login (dipakai System Administrator untuk domain & DNS)"; fi
  fi
else
  printf '  [..]   %s\n' "konfigurasi server belum ada — diisi saat koneksi server pertama (COO menanyakan pengguna)"
fi

if grep -qs 'deploy.sh' "$ROOT/ruang/system-administrator/.claude/settings.local.json"; then pass "izin deploy tetap System Administrator"
else printf '  [..]   %s\n' "izin deploy tetap belum ada (opsional) — lihat README › Izin deploy tetap"; fi

# Agent bernama sama di ~/.claude/agents akan bentrok dengan peran RudisOne.
for a in "${AGENTS[@]}"; do
  [ -e "$HOME/.claude/agents/$a.md" ] && fail "~/.claude/agents/$a.md ada — bentrok dengan peran RudisOne, pindahkan ke cadangan"
done

# Pemeriksa konsistensi (drift dokumen vs yang terpasang) — read-only.
if [ -x "$ROOT/bin/cek-konsistensi.sh" ]; then
  if "$ROOT/bin/cek-konsistensi.sh" >/dev/null 2>&1; then pass "pemeriksa konsistensi bersih"
  else fail "pemeriksa konsistensi menemukan drift — lihat: $ROOT/bin/cek-konsistensi.sh"; fi
fi

echo
echo "Hasil: $ok ok, $warn perlu perhatian."
echo "Langkah berikut: buka sesi Claude Code di folder proyek mana pun, lalu ketik /rudisone <permintaan>."
echo "Panggilan pertama membentuk organisasi inti (IT Operations); Tech Lead dibentuk per proyek saat ada tugas,"
echo "peran lain dipanggil sebagai subagent rudis-<peran>. Kantor: http://127.0.0.1:7421/"
