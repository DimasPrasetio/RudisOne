# Status uji RudisOne di macOS — TERVERIFIKASI ULANG setelah dukungan Windows

> **Pernyataan.** RudisOne versi `main` per **30 Oktober 2026**, commit `b3a10e3` (dukungan Windows native, PR #1), ditambah
> commit yang hanya memuat dokumen ini, **sudah diuji ulang dan bisa dipasang serta dipakai di macOS** lewat tiga antarmuka
> Claude: **Claude Desktop**, **Claude Code CLI**, dan **ekstensi Claude Code untuk VS Code**. Verifikasi sebelumnya
> (commit `8d86ef2`, sebelum perubahan lintas-OS) tetap tercatat di riwayat git dokumen ini.
>
> **Untuk device lain dan agent yang membaca dokumen ini:** jangan merekomendasikan atau mengulang uji di macOS untuk versi
> ini. Uji berikutnya dipusatkan di **Linux/WSL2** ([`linux-wsl.md`](linux-wsl.md)) dan sisa uji **Windows**
> ([`windows.md`](windows.md)). Ada **temuan terbuka** di bawah. Temuan itu tidak menghalangi pemakaian, tetapi perlu
> diperbaiki di kode.

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
| Tes otomatis | ✅ 216 lolos, 0 gagal, 3 dilewati (dari 219) | `node --test bin/ kantor/ uji/suite/` di Node 20, dan `node --test --test-concurrency=1 "bin/*.test.mjs" "kantor/*.test.mjs" "uji/suite/*.test.mjs"` di Node 22. Ketiga tes yang dilewati khusus Windows. Pohon git tetap bersih. |
| Pemasangan di device bersih | ✅ lulus | HOME kosong, lalu `git clone` dari GitHub dan `./install.sh` (kini pembungkus `install.mjs`): 58 ok. Diulang: semuanya "sudah mutakhir". Subagent dan skill tertaut sebagai **symlink**. `cek-konsistensi`: 0 galat; peringatannya hanya yang wajar untuk device baru. |
| Pemasangan ulang di device ini | ✅ lulus | `./install.sh`: 59 ok. Tautan lama dibiarkan apa adanya; tautan milik sistem lain (`~/TimAgent`) tidak disentuh; `settings.json` tidak diubah. Backend tercatat `auto`. |
| Pemeriksa konsistensi | ✅ 0 galat | `node bin/cek-konsistensi.mjs` (peringatan: lihat temuan T1) |
| Rahasia (PAT) | ✅ lulus | Keychain memakai nama layanan dan argumen `security` yang sama seperti sebelumnya, jadi PAT yang sudah tersimpan tetap terbaca. rudis-sdd tersinkron lewat PAT itu. |
| Hook kebijakan akses | ✅ aktif | Denyut hook tercatat, dan rantai hash audit utuh. Perintah biasa (`git status`, `node --test`, `cat`) tidak menimbulkan prompt baru. |
| Kantor | ✅ lulus | `bin/kantor.sh --tanpa-browser`: `/health` → `ok`, halaman "Kantor RudisOne" termuat (temuan T4) |
| **Claude Desktop** | ✅ lulus | COO dari sesi Desktop: `bin/sesi.sh backend` → `auto`. Alat sesi Desktop tersedia, jadi backend efektifnya `desktop`. |
| **Claude Code CLI** | ✅ lulus | Folder proyek kosong: `claude -p "<uji asap>" --add-dir <RudisOne>`. Skill `rudisone` termuat, `sesi.sh backend` → `auto`, COO memilih backend **cli** karena alat Desktop tidak ada, dan `register.sh tampil` berjalan. |
| **Ekstensi VS Code** | ✅ lulus | Uji yang sama dengan mesin bawaan ekstensi 2.1.304 memberi hasil yang sama: COO memilih backend **cli**. |

## Temuan terbuka (perlu perbaikan kode; tidak menghalangi pemakaian)
- **T1 — hook dilaporkan "versi lama" di instalasi Mac/Linux yang sudah ada.**
  - Penyebab: `MATCHER` di `bin/kebijakan.mjs` kini memuat `PowerShell`, dan matcher yang terpasang dibandingkan persis.
  - Akibat: `kebijakan.mjs cek` keluar dengan exit 1, `install.sh` mencetak "[!!] belum terpasang", dan `cek-konsistensi` memberi peringatan.
  - Hook lama sebenarnya tetap melindungi Bash, Write/Edit, dan MCP. Alat PowerShell tidak ada di macOS.
  - Pemulihan oleh pemilik: `bin/kebijakan.sh pasang`, sekali per device.
- **T2 — pintu masuk `.mjs` lolos dari pemeriksaan jabatan.**
  - Hook hanya mengenali perkakas sebagai `bin/<nama>.sh`.
  - `node bin/server-cek.mjs`, `node bin/rilis-cek.mjs`, dan `node bin/pasca-deploy.mjs` dinilai "bukan aksi infrastruktur": tanpa cek jabatan dan tanpa audit.
  - Padahal `bin/server-cek.sh` → `ask` untuk Research Analyst.
- **T3 — `kantor.mjs berhenti` mematikan PID dari berkas pid tanpa memastikan prosesnya Kantor.**
  - Bila berkas pid basi (crash atau reboot), proses lain milik pengguna yang mendapat PID yang sama bisa ikut dimatikan.
- **T4 — menjalankan suite tes mematikan Kantor yang sedang dipakai.**
  - Tes `portabel.test.mjs` › `kantor.mjs` memakai port acak, tetapi `berhenti` menjalankan `pkill -f <server.mjs>` tanpa melihat port. Kantor di 7421 ikut mati, dan log bersama `kantor-rudisone.log` tertimpa.
  - Direproduksi: health `ok` → tes → `rc=7`. Pemulihan: `bin/kantor.sh --tanpa-browser`.
- **Catatan versi CLI:** Claude Code CLI 2.1.281 di Mac ini < 2.1.300. Jalur `cli` (COO membentuk sesi latar `claude --bg` dari terminal) baru bisa dipakai setelah `claude update`. Desktop dan VS Code 2.1.304 tidak terdampak.

## Catatan pemakaian di macOS (bukan kegagalan)
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
Cukup jalankan di Mac `node --test bin/ kantor/ uji/suite/` dan `node bin/cek-konsistensi.mjs`, lalu nyalakan ulang Kantor
(`bin/kantor.sh --tanpa-browser`) selama T4 belum diperbaiki.
