# Status uji RudisOne di macOS — TERVERIFIKASI ULANG setelah dukungan Windows

> **Pernyataan.** RudisOne versi `main` per **30 Oktober 2026**, commit `b3a10e3` (dukungan Windows native, PR #1) ditambah
> perbaikan T1–T4 (`183f3e7`, T-20261030-15) dan commit yang hanya memuat dokumen ini, **sudah diuji ulang dan bisa dipasang serta dipakai di macOS** lewat tiga antarmuka
> Claude: **Claude Desktop**, **Claude Code CLI**, dan **ekstensi Claude Code untuk VS Code**. Verifikasi sebelumnya
> (commit `8d86ef2`, sebelum perubahan lintas-OS) tetap tercatat di riwayat git dokumen ini.
>
> **Untuk device lain dan agent yang membaca dokumen ini:** jangan merekomendasikan atau mengulang uji di macOS untuk versi
> ini. Uji berikutnya dipusatkan di **Linux/WSL2** ([`linux-wsl.md`](linux-wsl.md)) dan sisa uji **Windows**
> ([`windows.md`](windows.md)). Empat temuan uji ulang (T1–T4) **sudah diperbaiki** dan diverifikasi di Mac; jalur
> Windows-nya diperkuat tetapi perlu satu putaran `node --test bin/` di Windows sungguhan.

## Lingkungan uji
| Komponen | Versi |
|---|---|
| macOS | 27.0.1 (build 26A434), Apple Silicon (arm64) |
| Claude Desktop (tab Code) | 4.29.0 |
| Claude Code CLI | 2.1.281 |
| Ekstensi VS Code `anthropic.claude-code` | 2.1.304 (membawa mesin Claude Code 2.1.304) |
| Node.js | v20.19.5 (bawaan) dan v22.23.3 |
| Perkakas ekosistem | rudis-monorepo `b118e8a` (tag `rudis-monorepo/kernel/v7.1`) · rudis-modules `9042bce` · rudis-sdd `e216888` |

## Yang diuji ulang dan hasilnya
| Area | Hasil | Cara uji |
|---|---|---|
| Pull di checkout lama | ✅ lulus | `git pull --ff-only` dari `7ff3683` ke `b3a10e3`. Symlink peran lama berganti menjadi salinan. `node bin/peran.mjs cek` melaporkan "CLAUDE.md, subagent peran (11) & salinan peran ruang (11) mutakhir". |
| Tes otomatis | ✅ 220 lolos, 0 gagal, 4 dilewati (dari 224; setelah perbaikan T1–T4) | `node --test bin/ kantor/ uji/suite/` di Node 20, dan `node --test --test-concurrency=1 "bin/*.test.mjs" "kantor/*.test.mjs" "uji/suite/*.test.mjs"` di Node 22. Tes yang dilewati khusus Windows. Kantor 7421 tetap `ok` sebelum dan sesudah suite. Pohon git tetap bersih. |
| Pemasangan di device bersih | ✅ lulus | HOME kosong, lalu `git clone` dari GitHub dan `./install.sh` (kini pembungkus `install.mjs`): 58 ok. Diulang: semuanya "sudah mutakhir". Subagent dan skill tertaut sebagai **symlink**. `cek-konsistensi`: 0 galat; peringatannya hanya yang wajar untuk device baru. |
| Pemasangan ulang di device ini | ✅ lulus | `./install.sh`: 60 ok; hook tidak lagi dilaporkan "belum terpasang". Tautan lama dibiarkan apa adanya; tautan milik sistem lain (`~/TimAgent`) tidak disentuh; `settings.json` tidak diubah. Backend tercatat `auto`. |
| Pemeriksa konsistensi | ✅ 0 galat | `node bin/cek-konsistensi.mjs` |
| Rahasia (PAT) | ✅ lulus | Keychain memakai nama layanan dan argumen `security` yang sama seperti sebelumnya, jadi PAT yang sudah tersimpan tetap terbaca. rudis-sdd tersinkron lewat PAT itu. |
| Hook kebijakan akses | ✅ aktif | `node bin/kebijakan.mjs cek` → exit 0 dengan `~/.claude/settings.json` asli (tanpa pasang ulang). Denyut hook tercatat, dan rantai hash audit utuh. Perintah biasa (`git status`, `node --test`, `cat`) tidak menimbulkan prompt baru. |
| Kantor | ✅ lulus | `bin/kantor.sh --tanpa-browser`: `/health` → `ok`, halaman "Kantor RudisOne" termuat. `berhenti` dari checkout lain menolak mematikan Kantor ini. |
| **Claude Desktop** | ✅ lulus | COO dari sesi Desktop: `bin/sesi.sh backend` → `auto`. Alat sesi Desktop tersedia, jadi backend efektifnya `desktop`. |
| **Claude Code CLI** | ✅ lulus | Folder proyek kosong: `claude -p "<uji asap>" --add-dir <RudisOne>`. Skill `rudisone` termuat, `sesi.sh backend` → `auto`, COO memilih backend **cli** karena alat Desktop tidak ada, dan `register.sh tampil` berjalan. |
| **Ekstensi VS Code** | ✅ lulus | Uji yang sama dengan mesin bawaan ekstensi 2.1.304 memberi hasil yang sama: COO memilih backend **cli**. |

## Temuan uji ulang — SUDAH DIPERBAIKI (T-20261030-15, `e140f8c`…`183f3e7`)
Ditemukan saat uji ulang `b3a10e3`, diperbaiki dengan tes regresi (gagal di kode lama, lulus sekarang), diverifikasi COO di Mac.
| # | Temuan | Perbaikan | Bukti di Mac |
|---|---|---|---|
| T1 | Hook terpasang dinilai "versi lama" karena `MATCHER` menambah `PowerShell` | Matcher dinilai per OS: `PowerShell` wajib hanya di Windows; pesan menyebut bagian yang kurang | `kebijakan.mjs cek` exit 0 dengan settings asli; simulasi `RUDISONE_OS=win32` → exit 1 |
| T2 | `node bin/{server-cek,rilis-cek,pasca-deploy}.mjs` lolos dari cek jabatan & audit | Pintu masuk `.mjs` (absolut/relatif, `node`/`nodejs`) dikenali sama dengan `.sh` | `kebijakan uji` Research Analyst: `.sh` dan `.mjs` sama-sama `ask`; System Administrator sama-sama `allow` |
| T3 | `kantor berhenti` mematikan PID dari berkas pid tanpa verifikasi | Berkas pid tidak dipercaya; hanya proses dengan path `server.mjs` checkout ini + penanda port (atau pendengar port itu) yang dimatikan; pesan jujur | `berhenti` dari worktree lain → "tidak terbukti Kantor dari checkout ini — tidak dimatikan" |
| T4 | Suite tes mematikan Kantor yang sedang dipakai | Akibat T3 + log per port | Kantor 7421 `ok` sebelum dan sesudah suite penuh |

## Catatan pemakaian di macOS (bukan kegagalan)
- **Versi CLI:** Claude Code CLI 2.1.281 di Mac uji < 2.1.300. Jalur `cli` (COO membentuk sesi latar `claude --bg` dari
  terminal) baru bisa dipakai setelah `claude update`. Desktop dan VS Code 2.1.304 tidak terdampak.
- **Backend `auto`.**
  - Dari Claude Desktop, COO membentuk sesi Tech Lead/IT Operations dengan alat sesi Desktop.
  - Dari CLI atau VS Code, COO memakai `claude --bg`, yang butuh Claude Code ≥ 2.1.300 dan folder sesi yang sudah dipercaya sekali (`bin/sesi.sh cek`). Pembentukan sesi `claude --bg` dari CLI/VS Code di Mac belum dijalankan end-to-end.
  - Instalasi lama yang mencatat `desktop` tetap memakai `desktop`.
- **Yang tidak termasuk uji ini:**
  - uji kernel dengan MySQL (butuh `SMOKE_DB_DSN`);
  - deploy ke server (device uji tidak punya `konfigurasi/server.json`);
  - CI GitHub (akun pemilik terkunci billing; verifikasi dilakukan lokal).
- **Node 20:** pakai bentuk direktori (`node --test bin/ kantor/ uji/suite/`). Glob berkutip seperti di CI butuh Node ≥ 22.

## Kapan uji macOS perlu diulang
Hanya bila sebuah perubahan menyentuh jalur yang berlaku di macOS: `install.mjs`/`install.sh`, `bin/lib/*` (terutama
`rahasia.mjs` untuk Keychain dan `tautan.mjs`), `bin/kebijakan.mjs`, `bin/sesi.mjs`, `bin/kantor.mjs`, atau `kantor/`.
Cukup jalankan di Mac `node --test bin/ kantor/ uji/suite/` dan `node bin/cek-konsistensi.mjs`.
