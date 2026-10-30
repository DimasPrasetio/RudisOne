---
name: rudis-sdd
description: Prosedur RudisOne untuk RUDIS SDD (CLI rudis, command /rudis.*, folder .rudis/ dan specs/) di proyek berstandar rudis-monorepo. Muat HANYA saat mengerjakan baris tabel perakitan berjenis "bangun" atau "pasang + sesuaikan" (spec → plan → tasks → implement untuk satu modul kustom atau penyesuaiannya), atau saat brief menyebut RUDIS SDD / /rudis.* / specs/<NNN>-<slug>. JANGAN dimuat untuk baris "pasang" biasa (module.mjs add tanpa SDD), bug kecil, perubahan kecil non-SDD (templat/spesifikasi.md), audit, deploy, atau pekerjaan di luar proyek Rudis.
---

# RUDIS SDD di RudisOne (draf — isi protokol ditinjau Tech Lead)

Dasar: analisis kelayakan T-20261029-1 (verdikt **bisa dengan syarat**, S1–S8, K1–K12) di
`~/Documents/Neuron/ai-agent/RudisOne/handoff/T-20261029-1/analisis-kelayakan.md` (per device; bila tidak ada, minta
ringkasannya ke Tech Lead). Peran, gerbang, dan urutan fase tetap milik `sdlc.md`; skill ini hanya menambah yang khusus SDD.
Bila tampak berbeda: soal teknis repo → skill `rudis-monorepo` menang; soal peran & persetujuan → `sdlc.md` menang.

## 1. Kapan dipakai
| Keputusan baris tabel perakitan | Alur |
|---|---|
| **bangun** | SDD penuh untuk satu modul kustom baru: spec → plan → tasks → implement |
| **pasang + sesuaikan** | SDD **adaptasi saja**: modul dipasang dulu (`module.mjs add`), spec hanya men-spec penyesuaian di file baru milik modul (`custom_*.go`, `Custom*.tsx`) |
| pasang | **tanpa SDD** — `module.mjs add` sesudah Persetujuan Rancangan; skill ini tidak dipakai |
| bug kecil / perubahan kecil | **tanpa SDD** — `templat/spesifikasi.md` |

Satu baris bangun/sesuaikan = satu folder `specs/<NNN>-<slug>/`. Tabel perakitan menautkannya di kolom **Spesifikasi**.

## 2. Aturan keras (selalu)
1. CLI `rudis` **hanya** lewat `~/Documents/Neuron/ai-agent/RudisOne/bin/rudis-sdd.sh <perintah>` (= `bin/perkakas.sh sdd …`):
   menjalankan `uvx --from <repo RUDIS lokal> rudis`, menambah `--no-marketplace` pada `init`, menolak perintah marketplace
   (`skill`, `governance`, `profile`, `utilities`, `init --profile`) di luar allowlist, menolak `run ultimate|deploy|operate` dan
   `tui`, menolak `--gitlab-token`. Jangan memanggil `rudis`/`uvx` langsung, dan jangan memakai `~/.local/bin/rudis` (0.36.0, K7).
2. **Tanpa marketplace.** Kebijakan: `perkakas.json` › `kebijakan_marketplace` (default tanpa marketplace; allowlist ber-pin sha
   penuh, auto-update mati, tinjau `hooks/`, `.mcp.json`, `bin/` sebelum pasang). Cek: `bin/perkakas.sh marketplace cek [<sumber>]`.
   Menambah entri allowlist = keputusan pengguna lewat COO.
3. **Command per langkah** (`/rudis.specify`, `clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`). **Tidak pernah**
   `/rudis.ultimate` (S1), `/rudis.deploy`, `/rudis.operate` (deploy/operasi milik IT Operations), `rudis run <cmd>` (U2: tanpa izin
   tulis, tetap melapor sukses).
4. **Git tetap aturan RudisOne** (K1, S7): command RUDIS tidak membuat branch/commit; peran RudisOne meng-commit **sesudah** command
   selesai, di branch tugas `rudis/<ID>[-p<n>]`. Jangan `--create-branch`. Jangan `stash` (walau `implement` menawarkannya) —
   catat HEAD + `git status` saja.
5. **Hanya COO yang bertanya ke pengguna** (S6, K5). Lihat §5.
6. Jangan jalankan `.rudis/scripts/bash/update-agent-context.sh` (menambah seksi ke CLAUDE.md gateway, K10).
7. Kolom Perkakas & laporan memuat `sdd@<sha>` dari `bin/perkakas.sh versi` (mis. `rudis@f6f4e12 lib@f74089a sdd@e216888`).

## 3. Syarat S1–S8 (ringkas)
| # | Syarat |
|---|---|
| S1 | Command per langkah; bukan `/rudis.ultimate` (gerbang tanya langsung + deteksi fitur dari branch `NNN-`) |
| S2 | Constitution tipis per proyek: prinsip MUST + "Pemilik: <file>" (`.claude/rules/…`, `knowledge/…`), tanpa menyalin isi standar |
| S3 | `init --ai claude --script sh --no-marketplace`, lalu perbaiki `.gitignore` (§4 langkah 1) |
| S4 | Template bisa diambil: GL_TOKEN dari Keychain (`rudisone-rudis-sdd`) atau paket template lokal yang dipin |
| S5 | Letak `specs/` di standar rudis-monorepo — **belum diputuskan pengguna** (K2) |
| S6 | "Tanya pengguna" di command → dikumpulkan, COO yang bertanya |
| S7 | Commit oleh peran sesudah command, di branch tugas, berdasar aturan prioritas di constitution (prinsip "Alur kerja") |
| S8 | Fitur selalu eksplisit: brief menyebut `<NNN-slug>`; `/rudis.specify --number N` unik per proyek; penunjuk `.rudis/.current-feature` per worktree |

## 4. Langkah per fase (urutan `sdlc.md` › Jalur Aplikasi tidak berubah)
| Fase | Siapa | Yang dikerjakan |
|---|---|---|
| Analisis & perakitan | **BSA** (read-only), diperiksa TL | **Tanpa command RUDIS** (repo/`.rudis/` belum ada). Per baris bangun/sesuaikan: draf spec **dengan tangan** mengikuti `spec-template.md` RUDIS + pertanyaan gaya clarify (terkumpul) di `handoff/<ID>/specs/<slug>/spec.md`. Persetujuan Rancangan memuat tabel perakitan + ringkasan draf spec + asumsi berisiko. |
| Konstruksi 1 | **Tech Lead** | `scaffold.mjs` (skill rudis-monorepo) → `bin/rudis-sdd.sh init --here --force --ai claude --script sh` di worktree proyek → `.gitignore`: tambah `!.env.*.example` dan `.rudis/audit.log` di akhir (K3) → `/rudis.constitution` **sekali per proyek** dari seed constitution (S2; templat usulan §5 analisis) → per baris: `/rudis.specify --number N` (masukan = draf BSA yang disetujui + jawaban COO; N dari kolom Spesifikasi, unik lintas tugas) → `/rudis.checklist`. Commit sesudahnya. |
| Konstruksi 2 (rencana) | **Tech Lead** (C: BSA untuk data-model/kontrak) | `/rudis.plan` dengan argumen baku: *"jangan bertanya; keputusan pemilik produk tandai NEEDS CLARIFICATION dengan default"* → `/rudis.tasks` → **BSA** menjalankan `/rudis.analyze` (read-only). Constitution Check + cakupan FR masuk tinjauan TL. |
| Konstruksi | **SE #1/#2** per tugas `T###` di brief | Sekali per worktree: `printf '%s\n' <NNN-slug> > .rudis/.current-feature` (`RUDIS_FEATURE` hanya cadangan; env tidak bertahan antar-panggilan Bash). `/rudis.implement` hanya untuk `T###` di brief; centang `tasks.md` + `implementation-log.md`; `STOP and ask` → `[Terhambat]`. Commit sesudah command. |
| Pengujian | TL; SE #1 tinjau; BSA cocok-spesifikasi | `/rudis.analyze` ulang (+ `/rudis.converge` opsional) + Final Checklist skill rudis-monorepo. |
| Rilis / Operasi | IT Operations | RUDIS **tidak dipakai** (image-from-CI + IT Operations). |

Isi brief TL → SE/BSA (tambahan untuk SDD): path `specs/<NNN>-<slug>/`, `<NNN-slug>` untuk penunjuk, ID tugas `T###`, larangan
`stash`/`--create-branch`, keputusan Sonar/SAST (§6).

Kontrak, tabel, modul final dipindah ke pemiliknya (`packages/api-contract/`, `knowledge/API.md`, `DATABASE.md`, `MODULE_MAP.md`)
sebagai tugas fase Polish; salinan di `specs/<NNN>/contracts/` dan `data-model.md` lalu dibekukan (satu baris penunjuk ke pemilik).

## 5. Pertanyaan ke pengguna — selalu lewat COO
Command RUDIS ditulis untuk agent yang bicara langsung dengan pengguna (`clarify` ≤10 pertanyaan, `specify` Q1–Q3, `plan`
interaktif, `implement` "STOP and ask"). Di RudisOne:
1. Jangan menunggu jawaban di dalam command. Catat asumsi dengan default, tandai `NEEDS CLARIFICATION`.
2. Tulis pertanyaannya di laporan bagian **Keputusan yang dibutuhkan** (atau `[Terhambat]` bila tidak bisa lanjut) — sama dengan
   `sdlc.md` › "Tanya pengguna" di dalam skill.
3. COO bertanya di gerbang yang sesuai (biasanya Persetujuan Rancangan); keputusan baru dari plan → COO di luar gerbang.
4. Jawaban ditulis BSA/TL ke spec dengan format `- Q: … → A: …` (format `clarify`).
Termasuk: asumsi berisiko di spec, NEEDS CLARIFICATION di plan, keputusan Sonar/SAST, dan PAT (§6).

## 6. Perkakas, versi, akses
- Siapkan/cek: `bin/perkakas.sh siapkan|cek` (clone `https://git.neuron.id/research/rudis.git` ke
  `~/Documents/Neuron/ai-agent/rudis`; `pull --ff-only` **ditunda** selama ada tugas Engineering berjalan, seperti pustaka).
- Versi: `bin/perkakas.sh versi` → `… sdd@<sha>`; tulis di kolom Perkakas register dan di laporan. Rilis template (`init`/`update`
  selalu mengambil rilis GitLab **terbaru**, K8) dicatat terpisah di laporan.
- PAT (repo privat & template GitLab API): **tidak pernah** diminta di chat, dicetak, ditulis ke berkas, atau dimasukkan ke argumen.
  Perkakas membacanya dari Keychain layanan `rudisone-rudis-sdd` (git lewat `GIT_ASKPASS`, `init`/`update` lewat `GL_TOKEN` di proses
  anak). Belum ada / 401 → berhenti untuk bagian itu, laporkan ke COO perintah untuk pengguna (PAT GitLab scope `read_api` +
  `read_repository`, diketik saat diminta): `security add-generic-password -s rudisone-rudis-sdd -a "$USER" -w`
  (perbarui: tambah `-U`).

## 7. Risiko terbuka (sebut di laporan bila menyentuh tugasmu)
- **Sonar/SAST/secret/dependency scan** wajib di gerbang `implement` (`implement.md:184-191`); alat (`staticcheck`, `gitleaks`,
  `osv-scanner`, `govulncheck`, `semgrep`, `gosec`) mungkin belum ada dan memasangnya butuh jaringan → **brief memutuskan dulu**:
  pakai (izin pasang lewat COO) atau lewati dan catat "tidak terverifikasi".
- **GL_TOKEN**: token sesi device ditolak 401 (T-20261029-1 log 04; diulang T-20261030-2.3). Tanpa PAT di Keychain, `init` gagal
  sebelum menulis berkas. Alternatif paket template lokal yang dipin = keputusan pengguna (U1).
- **Penomoran fitur paralel (K12)**: nomor otomatis hanya membaca `specs/` lokal + branch `###-*`; dua tugas paralel bisa sama-sama
  mendapat `00N`. Selalu `--number N` dari register; tanpa penunjuk, skrip memilih folder bernomor tertinggi.
- **Belum teruji** (pilot): specify dengan draf BSA sebagai masukan; penunjuk `.current-feature` di worktree SE; commit oleh SE
  sesudah `/rudis.implement` (K1); `implement` keseluruhan.
- **Letak `specs/`** (K2) dan pengiriman catatan U1–U8 ke tim research Neuron: keputusan pengguna, belum diambil.
- **Biaya dokumen** (K11): ±2.000 baris artefak per modul kecil; `clarify`/`checklist` boleh dilewati untuk baris kecil.
- Allowlist marketplace: `rudis init` dengan marketplace yang diizinkan **tidak** menegakkan pin (rudis menulis URL tanpa sha) —
  periksa `.claude/settings.json` sesudahnya.

## 8. Rujukan
`sdlc.md` (fase, gerbang, "Tanya pengguna", Versi tercatat) · `protokol.md` (git/worktree, larangan stash) ·
`templat/tabel-perakitan.md` · `perkakas.json` (`rudis-sdd`, `kebijakan_marketplace`) · `bin/perkakas.mjs` (`sdd`, `marketplace cek`) ·
command RUDIS di proyek: `.claude/commands/rudis.<cmd>.md` · analisis T-20261029-1 §2.2 (tabel fase), §3 (K1–K12), §5 (rencana).
