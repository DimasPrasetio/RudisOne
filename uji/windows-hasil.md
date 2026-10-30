# Status uji RudisOne di Windows native — bukti yang sudah ada

> **Pernyataan.** RudisOne versi `main` per **30 Oktober 2026** (commit `94c3ad8`; isi pohonnya identik dengan `c9cbb5b`, commit yang
> diuji) **sudah diuji dan berjalan di Windows 11 native** (tanpa WSL, tanpa hak admin) untuk **Claude Code CLI** dan **Claude
> Desktop**. Ekstensi **VS Code** dan **macOS setelah perubahan ini** belum diuji — lihat "Belum terverifikasi" di bawah.
>
> Catatan ini memisahkan yang **terbukti** (ada perintah dan keluarannya) dari yang **belum**. Bukti otomatis hanya dari mesin
> lokal: CI GitHub belum pernah berjalan karena akun pemilik terkunci billing (semua job gagal sebelum langkah pertama).

## Lingkungan uji
| Komponen | Versi |
|---|---|
| Windows | 11 Pro, 10.0.26200, 64-bit |
| Claude Desktop (tab Code) | 4.4212.0.0 |
| Claude Code CLI | 2.1.302 |
| Node.js | v24.18.0 |
| Git for Windows | 2.55.0.windows.3 (bawaan: `core.autocrlf=true`, `core.symlinks=false`) |
| GitHub CLI | 2.98.0 |

## Yang diuji dan hasilnya
| Area | Hasil | Cara uji |
|---|---|---|
| Tes otomatis | ✅ 203 tes: 201 lolos, 0 gagal, 2 dilewati | Clone bersih dengan git Windows bawaan, lalu `node --test --test-concurrency=1 "bin/*.test.mjs" "kantor/*.test.mjs"` (±160 dtk). Dilewati: satu tes khusus macOS, satu butuh hak symlink. Pohon git tetap bersih sesudah tes. |
| Pemeriksa konsistensi | ✅ 0 galat | `node bin/cek-konsistensi.mjs` — keluar 1 hanya karena peringatan wajar (hook/`TEAM.md` belum ada di device baru). |
| Pembangkit peran | ✅ mutakhir | `node bin/peran.mjs cek`; `.claude/agents/coo.md` berupa berkas biasa (bukan teks symlink). |
| Pemasangan | ✅ lulus | `node install.mjs` dari `~/Documents/Neuron/ai-agent/RudisOne`: 11 subagent `rudis-*` tertaut sebagai **salinan**, 8 skill sebagai **junction**, manifest `~/.claude/.rudisone-tautan.json`. `settings.json` tidak berubah (dibandingkan sebelum dan sesudah). Tanpa bash, WSL, atau admin. |
| `/rudisone` di **Claude Code CLI** | ✅ lulus | `claude -p "/rudisone status tugas" --add-dir <folder RudisOne>` di folder proyek kosong: COO termuat, menjalankan `bin/register.sh` lewat Git Bash, menjawab "tidak ada tugas aktif". Tanpa `--add-dir` mode `-p` menolak membaca folder RudisOne (izin non-interaktif, bukan galat path). |
| `/rudisone` di **Claude Desktop** | ✅ lulus | Sesi Desktop di folder proyek kosong menjalankan `/rudisone status tugas`: skill dan `protokol.md` terbaca, `bin/register.mjs` keluar 0, tidak ada galat path/skill. `bin/sesi.mjs backend` → `auto`; karena alat sesi Desktop ada, backend efektif `desktop`. |
| Kantor | ✅ lulus | `node bin/kantor.mjs --tanpa-browser`: `/health` → `ok`, halaman "Kantor RudisOne" termuat; `node bin/kantor.mjs berhenti` mematikannya. |
| Hook kebijakan akses | ✅ lulus (HOME sementara) | Dipasang ke HOME sandbox lalu diuji lewat Git Bash, PowerShell, dan `cmd.exe`: tulis ke berkas terlindung → **ask**; perintah PowerShell pribadi biasa → tanpa keluaran. 7 tes khusus Windows di `bin/kebijakan-windows.test.mjs`. |
| Rahasia (PAT) | ✅ lulus | Disimpan terenkripsi DPAPI per pengguna (`%APPDATA%\rudisone\rahasia`); alur `GIT_ASKPASS` (`bin/askpass.cmd`) ke server git HTTP lokal teruji. |
| Sesi `cli` (`claude --bg`) | ✅ lulus (folder terpercaya) | `claude --bg`, `claude agents --json --all`, `claude logs <id>`, `claude rm <id>` diuji di Claude Code 2.1.302. `logs` mengeluarkan dump layar ber-kode ANSI; `rm` memakai **id**, bukan nama. |

## Celah keamanan Windows yang ditemukan dan ditutup
Semuanya terungkap oleh tes yang gagal, lalu diperbaiki di `bin/kebijakan.mjs`: tulis ke `~/.claude/settings.json` lolos tanpa tanya; identitas subagent tak terpetakan ke sesi induk; alat **PowerShell** tak dicegat hook; path `/proc` dan `/dev/fd` (ada di Git Bash) tak dianggap lokasi rahasia; junction tanpa admin bisa membuat skrip palsu terbaca sebagai perkakas resmi; Kantor tak mengenali worktree Tech Lead di path Windows.

## Belum terverifikasi (jangan dianggap lulus)
- **Ekstensi VS Code** di Windows: belum dicoba (`uji/windows.md` C3). Pertanyaan terbuka: apakah `claude --bg` berjalan dari panelnya.
- **Tech Lead lewat `/rudisone`** end-to-end (penyelarasan → sesi dibentuk → laporan) di Windows: belum dijalankan.
- **`claude --bg` di folder yang belum dipercaya**: gagal "Workspace not trusted" sampai pengguna menerima prompt percaya sekali (`bin/sesi.mjs cek` mencetak daftarnya).
- **`SendMessage`, `claude attach`, `notify_when_idle`** di Windows.
- **Hook di `~/.claude` asli**: hanya diuji dengan HOME sementara; pemilik perlu meninjau sebelum memercayainya untuk data produksi.
- **Skrip instalasi repo luar** (`rudis-monorepo`, `rudis-modules`, `rudis-sdd`) dijalankan lewat Git Bash; kompatibilitasnya di Windows di luar kendali repo ini. `install.mjs` berhasil meng-clone dan memasangnya pada uji ini.
- **macOS dan Linux setelah perubahan ini**, serta **CI tiga OS**: belum berjalan (billing terkunci). macOS sebelum perubahan sudah terverifikasi: [`macos.md`](macos.md).

## Kapan uji Windows perlu diulang
Bila perubahan menyentuh `install.mjs`, `bin/lib/*`, `bin/kebijakan.mjs`, `bin/sesi.mjs`, `bin/perkakas.mjs`, `bin/peran.mjs`, atau `kantor/`.
Cukup jalankan di Windows: `node --test --test-concurrency=1 "bin/*.test.mjs" "kantor/*.test.mjs"` dan `node bin/cek-konsistensi.mjs`.
Daftar uji manual untuk klien yang belum teruji: [`windows.md`](windows.md).
