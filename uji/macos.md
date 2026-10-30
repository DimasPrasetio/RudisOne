# Status uji RudisOne di macOS — SUDAH TERVERIFIKASI

> **Pernyataan.** RudisOne versi `main` per **30 Oktober 2026** (commit `8d86ef2`, ditambah commit yang hanya memuat dokumen
> ini) **sudah diuji dan bisa dipasang serta digunakan di macOS** lewat tiga antarmuka Claude:
> **Claude Desktop**, **Claude Code CLI**, dan **ekstensi Claude Code untuk VS Code**.
>
> **Untuk device lain dan agent yang membaca dokumen ini:** jangan merekomendasikan atau mengulang uji di macOS untuk versi ini.
> Uji berikutnya dipusatkan di **Linux** dan **Windows (WSL2)**: [`uji/linux-wsl.md`](linux-wsl.md).

## Lingkungan uji
| Komponen | Versi |
|---|---|
| macOS | 27.0.1 (build 26A434), Apple Silicon (arm64) |
| Claude Desktop (tab Code) | 4.29.0 |
| Claude Code CLI | 2.1.281 |
| Ekstensi VS Code `anthropic.claude-code` | 2.1.304 (membawa mesin Claude Code 2.1.304) |
| Node.js | v20.19.5 |
| Perkakas ekosistem | rudis-monorepo `b118e8a` (tag `rudis-monorepo/kernel/v7.1`) · rudis-modules `9042bce` · rudis-sdd (git.neuron.id) mutakhir dengan origin |

## Yang diuji dan hasilnya
| Area | Hasil | Cara uji |
|---|---|---|
| Pemasangan di device bersih | ✅ lulus | HOME kosong, `git clone` dari GitHub ke `~/Documents/Neuron/ai-agent/RudisOne`, `./install.sh` → 55 ok. Yang tersisa hanya langkah wajar device baru: hook dipasang pemilik, PAT rudis-sdd. `install.sh` meng-clone rudis-monorepo & rudis-modules dan memasang skill. |
| Tes otomatis | ✅ 197/197 | `node --test bin/ kantor/ uji/suite/` |
| Pemeriksa konsistensi | ✅ 0 galat | `bin/cek-konsistensi.sh` |
| Hook kebijakan & pemuat ulang inti | ✅ aktif | `bin/kebijakan.sh pasang`, `bin/inti.sh pasang`; denyut hook tercatat; rantai hash audit utuh. Replay ±13.670 pemanggilan alat: tidak ada prompt izin tambahan untuk pekerjaan biasa. |
| Perkakas ekosistem | ✅ lulus | rudis-monorepo `npm run verify` (uji MySQL dilewati, tanpa `SMOKE_DB_DSN`) · rudis-modules `npm run check` · rudis-sdd jalan lewat `bin/rudis-sdd.sh` (uvx) |
| **Claude Desktop** — dipakai sungguhan | ✅ lulus | COO lewat `/rudisone`; sesi Tech Lead dibentuk otomatis (worktree sendiri); pesan antar-sesi (brief, laporan, revisi); subagent peran (mis. Research Analyst); verifikasi, merge, push. Enam tugas (T-20261030-7 s.d. -12) selesai dari awal sampai akhir. |
| **Claude Code CLI** | ✅ lulus | Uji non-interaktif (`claude -p`) di folder RudisOne: skill `rudisone` & `rudis-sdlc`, subagent `rudis-tech-lead`, dan protokol inti dari `CLAUDE.md` termuat. Skill, subagent, dan hook berasal dari `~/.claude` yang sama dengan Desktop. |
| **Ekstensi VS Code** | ✅ lulus | Uji yang sama dengan mesin bawaan ekstensi (`…/anthropic.claude-code-2.1.304-darwin-arm64/resources/native-binary/claude -p`). Hasilnya sama: semuanya termuat. |

## Catatan pemakaian di macOS (bukan kegagalan)
- **Backend sesi macOS = `desktop`.** Organisasi penuh, termasuk COO membentuk sesi Tech Lead/IT Operations otomatis dan
  menerima laporannya, memakai alat sesi Claude Desktop. Jadi buka COO (`/rudisone`) dari **Claude Desktop**. Dari CLI
  atau VS Code, COO, subagent peran, skill, hook, dan semua perkakas `bin/` berjalan sama, tetapi pembentukan sesi
  otomatis tetap lewat Claude Desktop.
- **Yang tidak termasuk uji ini:** uji kernel dengan MySQL (butuh `SMOKE_DB_DSN`), deploy ke server (device uji tidak
  punya `konfigurasi/server.json`), dan CI GitHub (akun pemilik sedang terkunci billing; verifikasi dilakukan lokal).

## Kapan uji macOS perlu diulang
Hanya bila sebuah perubahan menyentuh jalur khusus macOS: `install.sh`, Keychain di `bin/perkakas.mjs`/`bin/perkakas.sh`,
`bin/kebijakan.mjs`, backend `desktop` di `bin/sesi.mjs`, atau `kantor/`. Cukup jalankan di Mac:
`node --test bin/ kantor/ uji/suite/` dan `bin/cek-konsistensi.sh`. Perubahan lain tidak membutuhkan uji ulang macOS.
