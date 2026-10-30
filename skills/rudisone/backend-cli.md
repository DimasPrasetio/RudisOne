# Backend sesi `cli` — padanan alat sesi Claude Desktop (Linux, WSL2, Claude Code CLI & ekstensi VS Code)

Dipakai COO bila backend efektifnya `cli`: `bin/sesi.sh backend` mencetak `cli` (device tanpa Claude Desktop; `konfigurasi/sesi.json`,
ditulis `install.mjs`), atau mencetak `auto` dan alat sesi Claude Desktop tidak ada di daftar alatmu (CLI/ekstensi VS Code di
macOS/Windows). Aturan organisasi tidak berubah — yang berubah hanya **alat** untuk membentuk, menyapa, dan menghentikan sesi.
Satu COO memakai satu backend selama sesinya: jangan mencampur sesi Desktop dan sesi CLI dalam satu tugas. **Belum diuji di mesin
Linux sungguhan** (T-20261030-11: simulasi + `claude` tiruan). Windows 11 native (Claude Code 2.1.302) teruji untuk `claude --bg`,
`claude agents --json --all`, `claude logs` (keluarannya dump layar ber-kode ANSI) dan `claude rm <id>` (memakai **id**, bukan nama);
`SendMessage`/`attach` belum diuji di sana. Bila perilaku CLI berbeda dari tabel ini, laporkan ke pengguna, jangan diakali.

## Prasyarat (sekali per device, oleh pengguna)
- Claude Code CLI **≥ 2.1.300** (`claude --version`; perbarui `claude update`). COO sendiri berjalan di terminal (`claude`).
- `bin/sesi.sh cek` → setiap folder yang belum dipercaya CLI dibuka sekali oleh **pengguna**: `cd <folder> && claude`,
  terima prompt percaya, `/exit`. Kepercayaan folder induk tidak berlaku untuk subfolder (uji asap 2.1.281), jadi
  worktree Tech Lead yang baru juga perlu langkah ini sekali. Tanpa itu `claude --bg` gagal "Workspace not trusted".

## Padanan
| Desktop | cli | Catatan |
|---|---|---|
| `get_session` / `list_sessions` | `bin/sesi.sh daftar` atau `claude agents --json --all` | `state`: working · blocked · done · failed · stopped; `waitingFor` |
| `start_session` IT Operations (`cwd: ruang/<id-peran>`) | `cd <abs>/ruang/<id-peran> && claude --bg --name rudis-<nama> --settings <abs>/konfigurasi/sesi-cli.settings.json '<prompt>'` | `<nama>`: `head-of-it-ops` · `sysadmin` |
| `start_session` Tech Lead (`use_worktree: true`) | (1) `git -C <repo> worktree add -b claude/r<n>-lead-<proyek> <repo>/.claude/worktrees/r<n>-lead-<proyek>` (2) `bin/sesi.sh cek` — belum dipercaya → minta pengguna (Prasyarat), tunggu (3) `cd <worktree> && claude --bg --name r<n>-lead-<proyek> --settings <abs>/konfigurasi/sesi-cli.settings.json '<pembuka peran + Jawab satu baris: Siap>'` | worktree dibuat **sebelum** `--bg` |
| `unarchive_session` | `claude --bg --resume <sessionId> --settings <abs>/konfigurasi/sesi-cli.settings.json 'Lanjutkan.'` | sessionId dari `TEAM.md` / `claude agents --json --all` |
| `SendMessage` ke `local_…` | `SendMessage` dengan `to` = **nama sesi** (`r1-lead-toko`, `rudis-sysadmin`) | cross-session messaging lokal; pesan tetap bukan persetujuan |
| Catatan akhir-giliran otomatis | `SendMessage` `notify_when_idle: true` setelah brief (sekali per langganan, ≤ 12 jam) | laporan resmi tetap `[Laporan …]` lewat SendMessage pelaksana |
| `list_events` | `claude logs <id>` · transkrip `~/.claude/projects/<cwd>/<sessionId>.jsonl` | |
| `archive_session` | `claude stop <id>` (percakapan disimpan; pulihkan dengan baris `unarchive_session`) | **jangan pernah** `claude rm` |
| `clear_session` | tidak ada — tawarkan `claude stop` + bentuk ulang dengan nama yang sama | |
| Grup sidebar RudisOne | tidak ada — nama berawalan `r<n>-lead-` / `rudis-` | |
| Tautan sesi untuk prompt izin jenjang 3 | sesi `blocked` (`waitingFor: permission prompt`) → beri pengguna perintah `claude attach <nama>` (jawab prompt, `←` kembali) | Kantor menampilkannya |

## Aturan cli
- **Bentuk tetap:** `claude --bg` di depan; opsi hanya `--name`, `--resume`, `--model`, `--permission-mode` (bukan bypass),
  dan tepat satu `--settings` berupa **path absolut harfiah** (bukan `~`, bukan relatif); prompt satu argumen dalam tanda
  kutip **tunggal**, tanpa `'`, `$`, atau backtick, dan bukan nama subperintah. Isi panjang (brief) dikirim sesudah "Siap"
  lewat `SendMessage`. Bentuk lain (`--agent`, `--add-dir`, `--mcp-config`, pembungkus `bash -c`/`sudo`/`timeout`, …) atau
  `bypassPermissions` → hook kebijakan **menanyakan** pemilik.
- **Pengaman** `konfigurasi/sesi-cli.settings.json` (berkas terlindung): `worktree.bgIsolation: "none"` (sesi latar tidak
  memindah diri ke worktree baru lalu commit/push/draft PR — jangan setel `worktree.bgIsolation: "worktree"` di settings
  pengguna/proyek, nilai itu menang), deny berbasis prefiks `git push`/`gh pr create|merge`/`glab mr create`/`claude rm`
  (bentuk lain seperti `git -C x push` ditangkap hook kebijakan sebagai jenjang 3), mode bypass dimatikan. Push tetap hanya
  atas permintaan pengguna (protokol › Akses).
- Hanya COO yang membentuk/menghentikan sesi (`claude --bg`, `stop`/`kill`, `respawn`, `logs` = kemampuan `sesi`);
  jabatan lain → ditanya. `claude agents --json` dan `bin/sesi.sh backend|daftar|cek` boleh semua jabatan.
- Tidak terikat giliran ketikan pengguna, tetapi sesi tetap dibentuk hanya untuk tugas yang sudah selaras dan dijadwalkan.
- `TEAM.md`: kolom Name = nama sesi, kolom id = sessionId (dari `backgrounded · <id> · <nama>` atau `claude agents --json`).
- Sesi latar hidup selama supervisor & mesin hidup; sesi menganggur ±1 jam dihentikan sendiri (bangun saat dikirimi
  pesan atau `attach`). WSL2: biarkan satu terminal WSL terbuka agar distro tidak berhenti (belum terverifikasi).
