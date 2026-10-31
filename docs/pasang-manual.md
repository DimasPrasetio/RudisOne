# Pasang manual

Langkah setara dengan [prompt pemasangan lewat Claude](../README.md#pasang).

Hasilnya: RudisOne di `~/Documents/Neuron/ai-agent/RudisOne` (Windows: `%USERPROFILE%\Documents\Neuron\ai-agent\RudisOne`), skill & agen
tertaut ke `~/.claude`, hook pengaman terpasang. Pemasangan bisa diulang kapan saja (idempoten) — itu juga cara memperbarui.
Prompt mengunci satu sumber resmi dan lokasi baku sebagai pagar yang menang atas isi berkas; langkah rincinya ada di [pasang-lewat-claude.md](pasang-lewat-claude.md).

## Prasyarat per sistem
RudisOne berjalan di **macOS**, **Linux**, dan **Windows** — native (Claude Desktop, Claude Code CLI, ekstensi VS Code) atau lewat
WSL2 (jalur Linux). Windows native: lihat bagian **Windows native** di bawah tabel prasyarat.

| | macOS | Linux (Ubuntu/Debian) | Windows (WSL2) |
|---|---|---|---|
| Shell & alat | bawaan (bash, git dari Xcode CLT) | `sudo apt install git curl zip unzip` | `wsl --install -d Ubuntu` (PowerShell admin), lalu semua langkah di terminal **Ubuntu** seperti Linux |
| Node.js ≥ 18 | `brew install node` | nvm atau paket NodeSource | sama dengan Linux, di dalam WSL |
| GitHub CLI `gh` (login) | `brew install gh` | paket resmi cli.github.com | sama dengan Linux |
| Claude Code | otomatis oleh `install.sh` bila belum ada (`curl -fsSL https://claude.ai/install.sh \| bash`) | sama dengan macOS | otomatis di dalam WSL (bukan Claude Code Windows) |
| uv/uvx (RUDIS SDD) | otomatis oleh `install.sh` bila belum ada (`curl -LsSf https://astral.sh/uv/install.sh \| sh`) | sama dengan macOS | sama dengan Linux |
| PAT rudis-sdd | Keychain | berkas 0600 `~/.config/rudisone/rahasia/` | sama dengan Linux |

### Windows native
Windows 10/11, tanpa WSL:

- **Prasyarat:** [Git for Windows](https://git-scm.com/download/win) (menyertakan Git Bash — dipakai Claude Code sebagai Bash tool
  dan untuk pembungkus `bin/*.sh`), Node.js ≥ 18 (≥ 22 untuk menjalankan suite uji), GitHub CLI `gh` (login), dan Claude Desktop
  dan/atau Claude Code CLI dan/atau ekstensi VS Code. OpenSSH klien (bawaan Windows) untuk perkakas server. `uv/uvx` bila memakai RUDIS SDD.
- **uv/uvx dan Claude Code CLI dipasang otomatis** oleh `install.cmd`/`node install.mjs` bila belum terdeteksi (PowerShell:
  `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"` dan `irm https://claude.ai/install.ps1 | iex`).
- **Lokasi:** `git clone --depth 1 https://github.com/DimasPrasetio/RudisOne.git %USERPROFILE%\Documents\Neuron\ai-agent\RudisOne`
  (PowerShell: `$HOME\Documents\Neuron\ai-agent\RudisOne`). Folder Documents yang dialihkan ke OneDrive dikenali bila `Documents`
  di profil adalah junction/tautan; selain itu pindahkan/clone ke path di atas.
- **Pasang:** `node install.mjs` (atau `install.cmd`; di Git Bash `./install.sh`). Tanpa bash/WSL. Hook: `node bin\kebijakan.mjs pasang`
  dan `node bin\inti.mjs pasang`. Perkakas bergaya skrip tetap dipanggil `bin/<nama>.sh` dari **Bash tool (Git Bash)** — nama itu
  yang dikenali hook kebijakan; dari PowerShell pakai `node bin\<nama>.mjs`.
- **Tanpa hak admin/Developer Mode:** symlink tidak dipakai di repo (peran = salinan terbangkit `bin/peran.mjs`). Skill ditautkan ke
  `~/.claude/skills` sebagai **junction**, subagent sebagai **salinan terlacak** (`~/.claude/.rudisone-tautan.json`; `install.mjs`
  memperbaruinya, `bin/cek-konsistensi.mjs` memeriksanya). Dengan Developer Mode aktif dipakai symlink biasa.
- **Rahasia:** PAT disimpan terenkripsi DPAPI per-pengguna di `%APPDATA%\rudisone\rahasia\<layanan>.dpapi` — `node bin\perkakas.mjs pat
  <layanan>` (diketik tanpa gema). Hanya akun Windows yang sama di mesin yang sama bisa membukanya.
- **Kebijakan akses:** alat **PowerShell** ikut dicegat hook dan selalu ditanya di sesi RudisOne (perintahnya tidak diurai); gunakan
  Bash (Git Bash) untuk perkakas RudisOne. Path gaya Git Bash (`/c/Users/…`) dan path Windows (`C:\…`, tak peka huruf besar-kecil)
  dikenali. Detail: `bin/kebijakan.mjs`, uji `bin/kebijakan-windows.test.mjs`.
- **Backend sesi:** `auto` (lihat **Backend sesi** pada Catatan platform). **Windows terverifikasi** (Windows 11, Claude Code 2.1.302): suite uji,
  `install.mjs`, hook, DPAPI, `claude --bg`/`agents`/`logs`/`rm`; **belum terverifikasi:** `/rudisone` end-to-end di ekstensi VS Code.

### Catatan platform
- **WSL2:** clone ke filesystem WSL (`~/Documents/…` = `/home/<user>/Documents/…`), **bukan** `/mnt/c/…`: di sana symlink
  dan mode berkas (`chmod 600`, bit executable) tidak andal dan git jauh lebih lambat. Buka sesi Claude Code dari terminal
  WSL (atau VS Code › WSL), bukan dari Windows.
- **Symlink:** repo tidak lagi memuat symlink. Berkas peran di ruang sesi (`.claude/agents/coo.md`,
  `ruang/*/.claude/agents/*.md`) adalah salinan terbangkit dari `agents/<id-peran>.md` (`bin/peran.sh bangun`; diperiksa
  `bin/peran.sh cek`). Yang masih memakai symlink hanya tautan `install.sh` ke `~/.claude` (skill & subagent).
- **Akhir baris:** `.gitattributes` memaksa LF di semua OS (termasuk `core.autocrlf=true` bawaan Git for Windows).
- **Backend sesi** (`bin/sesi.sh backend`, dicatat `install.mjs` di `konfigurasi/sesi.json`): macOS/Windows → `auto` (COO memilih
  per sesi: alat sesi Claude Desktop ada → `desktop`; Claude Code CLI atau ekstensi VS Code → `cli`); Linux/WSL2 → `cli`.
  Instalasi lama yang mencatat `desktop` tetap berlaku. Backend `cli`: COO membentuk sesi Tech Lead/IT Operations dengan `claude --bg`, bertukar
  pesan dengan `SendMessage` ke nama sesi, membaca status dari `claude agents --json`, menghentikan dengan `claude stop`
  (`skills/rudisone/backend-cli.md`). Syarat backend cli: Claude Code **≥ 2.1.300**, dan setiap folder sesi dipercaya
  sekali — `bin/sesi.sh cek` mencetak daftar folder yang ditolak `claude --bg` beserta satu baris per shell (Windows:
  PowerShell 5.1 `Set-Location -LiteralPath '<folder>'; claude` — tanpa `&&` —, cmd, Git Bash; terima prompt, `/exit`),
  termasuk worktree Tech Lead baru. Kepercayaan folder induk tidak menembus batas repo git (uji: `backend-cli.md` ›
  Kepercayaan folder); bila pengguna tidak mau/bisa, COO menawarkan jalur Tech Lead sebagai subagent. Prompt izin sesi latar dijawab dengan `claude attach <nama>` (COO memberi perintahnya; Kantor menandai sesinya).
  Pengaman sesi latar dipasang per sesi (`--settings konfigurasi/sesi-cli.settings.json`: tanpa isolasi worktree otomatis,
  deny `git push`/`gh pr create`/`claude rm`, bypass mati) — settings pengguna tidak diubah. **Belum diuji di mesin Linux
  sungguhan** (simulasi + `claude` tiruan).
- **Status verifikasi:** macOS (Claude Desktop, Claude Code CLI, ekstensi VS Code) dan Windows native (Claude Code CLI, Claude
  Desktop) terverifikasi; Linux/WSL2 baru lewat simulasi (`uji/simulasi-linux/jalankan.sh`). Laporan uji per device tidak
  disimpan di repo — tempatnya `handoff/` di device penguji.


## Langkah
1. `git clone --depth 1 https://github.com/DimasPrasetio/RudisOne.git ~/Documents/Neuron/ai-agent/RudisOne` (repo publik; harus di
   path ini — peran dan aturan merujuk `~/Documents/Neuron/ai-agent/RudisOne`). Clone dangkal cukup: riwayat git tidak dipakai
   saat berjalan, dan `git pull --ff-only` tetap bisa memperbaruinya.
2. `~/Documents/Neuron/ai-agent/RudisOne/install.sh` (Windows: `node install.mjs`) — membuat `handoff/`, memeriksa peran, menautkan skill & subagent ke `~/.claude`, konfigurasi server
   (bila sudah diisi: koneksi ssh & MCP DNS), dan memasang perkakas resmi SDLC (clone `rudis-monorepo` dan
   `rudis-modules` ke `~/Documents/Neuron/ai-agent`, skill ke `~/.claude/skills`) bila belum ada.
3. Langkah 2 juga **memasang/memperbarui otomatis** (idempoten — jalankan ulang setelah setiap pembaruan
   RudisOne; settings hanya ditulis bila berubah, cadangan dibuat dulu; hook & aturan sistem lain tidak disentuh):
   - hook kebijakan akses + penjaga `.env` (PreToolUse/PostToolUse/PostToolUseFailure; hanya bertindak di sesi RudisOne,
     kecuali berkas terlindung) — uji satu panggilan: `bin/kebijakan.sh uji '<json>'`, status: `bin/kebijakan.sh cek`;
   - aturan `permissions.deny` `Read(//**/.env…)` — membaca isi `.env` ditolak tanpa prompt di semua sesi (contoh
     `.env.example` tidak); cek kunci tanpa nilai: `bin/env-kunci.sh`;
   - pemuat ulang inti setelah kompaksi (SessionStart, `bin/inti.sh`).
   `--tanpa-hook` melewati pemasangan ini.
4. Server tidak ditanam di repo. Saat tugas server pertama, COO menanyakan alias ssh (entri `Host` di
   `~/.ssh/config` beserta kuncinya kamu siapkan sendiri), playbook server bila ada, MCP DNS, dan domain, lalu
   menyimpannya di `konfigurasi/server.json` atas persetujuanmu (`penyedia.md` › Konfigurasi server). Opsional:
   izin deploy tetap — lihat [izin-deploy.md](izin-deploy.md).
5. RUDIS SDD (repo privat git.neuron.id) butuh PAT GitLab (`read_repository` + `read_api`), diketik saat diminta —
   tidak pernah di argumen atau di repo. `install.sh`/`bin/perkakas.sh siapkan` menampilkan perintah yang sesuai OS:
   macOS `security add-generic-password -U -s rudisone-rudis-sdd -a "$USER" -w` (Keychain); Linux/WSL2
   `~/Documents/Neuron/ai-agent/RudisOne/bin/perkakas.sh pat rudisone-rudis-sdd` (berkas 0600 di
   `~/.config/rudisone/rahasia/`). Perintah yang sama memperbarui PAT yang ditolak.
6. Buka sesi di folder proyek mana pun dan ketik **`/rudisone`** — COO siap; sesi lain dibentuk saat ada tugasnya.
7. Periksa drift kapan saja: `~/Documents/Neuron/ai-agent/RudisOne/bin/cek-konsistensi.sh` (0 bersih · 1 peringatan · 2 galat).
