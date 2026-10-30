# Daftar uji RudisOne di Windows native (dan verifikasi ulang di macOS)

Yang **sudah diverifikasi otomatis** di Windows 11 (suite `node --test`, install.mjs, hook, DPAPI, `claude --bg`/`agents`/`logs`/`rm`)
ada di README › Pasang di device baru › Windows native. Daftar ini untuk yang **belum bisa diverifikasi tanpa antarmuka klien**:
`/rudisone` end-to-end di **Claude Desktop**, **Claude Code CLI**, dan **ekstensi VS Code**. Waktu ±30 menit per klien. Salin
**keluaran** langkah bertanda 📋 ke satu berkas teks dan kirim ke COO (pemilik RudisOne). Jangan kirim PAT atau isi
`%APPDATA%\rudisone\rahasia\`.

> Bagian E (macOS) **sudah dijalankan** setelah perubahan lintas-OS: hasil dan temuan di [`macos.md`](macos.md) — tidak perlu diulang.

## A. Prasyarat (Windows)
1. Git for Windows (sertakan Git Bash), Node.js ≥ 22, GitHub CLI (`gh auth login`), OpenSSH klien.
   📋 `node -v`, `git --version`, `gh --version`, `claude --version` (CLI ≥ 2.1.300).
2. Clone: `git clone https://github.com/DimasPrasetio/RudisOne.git $HOME\Documents\Neuron\ai-agent\RudisOne` (PowerShell).
   📋 `git -C $HOME\Documents\Neuron\ai-agent\RudisOne config core.autocrlf` (boleh `true`: `.gitattributes` memaksa LF).

## B. Pasang
3. 📋 `cd $HOME\Documents\Neuron\ai-agent\RudisOne; node install.mjs`
   Harapan: `Hasil: N ok, M perlu perhatian`; baris `[ok]` untuk peran, subagent `… tertaut (salinan|symlink)`, skill `… tertaut (junction|symlink)`;
   `[!!]` hanya untuk hook yang belum dipasang. Ulangi: harus mencetak `sudah mutakhir`.
4. Hook (pemilik): `node bin\kebijakan.mjs pasang` dan `node bin\inti.mjs pasang`, lalu 📋 `node bin\kebijakan.mjs cek` → `terpasang`.
5. 📋 `node bin\sesi.mjs backend` → `auto (deteksi OS (win32))` (atau `konfigurasi/sesi.json`).
6. 📋 `node bin\cek-konsistensi.mjs` → `0 galat`.

## C. `/rudisone` di tiap klien (ulangi untuk C1, C2, C3)
Prasyarat: bagian B selesai; buka sesi di **folder proyek percobaan** (bukan folder RudisOne), mis. `$HOME\Documents\coba-rudis`
(`git init` di dalamnya).

**C1 — Claude Desktop (tab Code), backend `desktop`**
7. 📋 Ketik `/rudisone status tugas`. Harapan: COO menjawab (ringkasan "tidak ada tugas aktif"), tidak ada galat path/skill.
8. 📋 Ketik `/rudisone buat catatan README di proyek ini` lalu setujui penyelarasan. Harapan: COO membentuk sesi **Tech Lead** lewat
   alat sesi Desktop (muncul di sidebar, grup "RudisOne"), dan Kantor (`http://127.0.0.1:7421/`) menampilkannya.
9. 📋 Minta Kantor: `node bin\kantor.mjs --tanpa-browser` → URL tercetak; buka dan lihat Tech Lead tampil. `node bin\kantor.mjs berhenti`.

**C2 — Claude Code CLI (terminal), backend `cli` lewat `auto`**
10. Di folder percobaan: `claude`, lalu `/rudisone status tugas`. 📋 Harapan: COO memilih backend **cli** (alat sesi Desktop tidak ada).
11. Sekali: `node bin\sesi.mjs cek` → ikuti daftar `cd <folder> && claude` (terima prompt percaya, `/exit`).
12. 📋 `/rudisone buat catatan README di proyek ini` → COO membentuk sesi Tech Lead dengan `claude --bg`; `node bin\sesi.mjs daftar`
    mencantumkannya; `claude agents` menampilkannya. Jawab prompt izin sesi latar dengan `claude attach <nama>` bila diminta.
13. Hapus sesi uji: `claude rm <id>` (**id**, bukan nama).

**C3 — Ekstensi VS Code (Claude Code), backend `cli` lewat `auto`**
14. Buka folder percobaan di VS Code, panel Claude Code. 📋 `/rudisone status tugas`. Harapan: sama dengan C2 (COO memakai backend cli).
15. 📋 Minta COO membentuk sesi Tech Lead. Catat: apakah `claude --bg` berjalan dari panel dan apakah sesi bisa dipantau lewat
    `claude agents` / Kantor. **Ini pertanyaan terbuka** — jawabannya menentukan apakah VS Code butuh penanganan khusus.

## D. Kebijakan akses (Windows)
16. Di sesi RudisOne (folder RudisOne): minta agent menjalankan perintah **PowerShell** apa pun. 📋 Harapan: **ditanya** (permintaan izin).
17. 📋 Minta agent menulis ke `%USERPROFILE%\.claude\settings.json` lewat Write. Harapan: **ditanya**.

## E. macOS (verifikasi ulang setelah perubahan lintas-OS)
18. `git pull` pada checkout yang sudah ada. 📋 `node bin/peran.mjs bangun` (mengganti symlink peran lama dengan salinan) lalu
    `node bin/peran.mjs cek` → `mutakhir`; `node install.mjs` → `[ok]`; `node --test bin/ kantor/` (Node ≥ 22) → `fail 0`.
19. 📋 `/rudisone status tugas` di Claude Desktop **dan** di Claude Code CLI. Harapan: backend `auto` memilih `desktop` / `cli`.
    Instalasi lama yang mencatat `desktop` di `konfigurasi/sesi.json` tetap memakai `desktop`.
