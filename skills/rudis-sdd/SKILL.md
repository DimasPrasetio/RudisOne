---
name: rudis-sdd
description: Prosedur RudisOne untuk RUDIS SDD (CLI rudis, command /rudis.*, folder .rudis/, specs/, docs/brd/) — mode proyek A/B dari kartu proyek, jalur dua sumbu (jenis × cakupan), pemicu re-route, gerbang mutu baseline, aturan CVE, dan pengaman git/data. Muat saat tugas Engineering memakai command /rudis.* — Mode A (bangun, pasang + sesuaikan, ubah modul kustom) atau Mode B (brd, tracer, redesign, revamp, upgrade, test, siklus penuh) — atau saat brief menyebut RUDIS SDD, kartu proyek, jalur, specs/<NNN>-<slug>. JANGAN dimuat untuk baris "pasang" biasa (module.mjs tanpa SDD), perubahan kecil tanpa SDD (templat/spesifikasi.md), audit, deploy, atau pekerjaan non-Engineering.
---

# RUDIS SDD di RudisOne

Dasar: T-20261029-1 (kelayakan, S1–S8, K1–K12), T-20261030-3 (brownfield, §4.2, §7), T-20261030-4 §6.4 (menang bila
bertentangan) dan `handoff/T-20261030-6/pemahaman.md` (Keputusan 1–5) — per device; bila tidak ada, minta ringkasan ke Tech Lead.
Peran, gerbang, urutan fase: skill `rudis-sdlc`. Soal teknis repo standar: skill `rudis-monorepo` menang.

## 1. Mode proyek (kartu proyek)
- Mode ada di `.rudisone/kartu-proyek.md` di root proyek (templat `templat/kartu-proyek.md`; cadangan
  `handoff/kartu/<nama>.md` bila klien melarang).
  Mesin: `bin/perkakas.sh proyek <folder>` → `mode-mesin: A|B|ragu` + bukti. Pengguna mengonfirmasi **sekali** lewat
  COO dengan bukti ditampilkan. Mode berubah **hanya** lewat tugas migrasi eksplisit.
- Awal setiap tugas: `bin/cek-konsistensi.sh --proyek <folder>` (kartu vs marker). Tidak cocok → jangan menebak, tanya (§3).
- **A** = standar rudis-monorepo + perakitan pustaka (saat ini hanya Go; NestJS/Express standar = B kecuali kartu
  memutuskan lain). **B** = legacy, klien, stack lain, atau standar tanpa perakitan.
- Mode menentukan **constitution** (A: `templat/constitution-rudis.md`; B: `templat/constitution-legacy.md`),
  **gerbang mutu** (§6), dan **apakah tabel perakitan dipakai** (hanya A). Mode **tidak** menentukan jalur.

## 2. Jalur dua sumbu (satu tabel, kedua mode)
Baca dari atas: **sinyal mesin** dulu, lalu **cakupan**, lalu **jenis**; baris pertama yang cocok menang. Pengecualian:
bug selalu **mulai** dengan tracer (baris 5); perbaikannya pindah ke baris 3/4 bila sinyal/cakupannya terpenuhi (re-route, §3).

| # | Sinyal / cakupan / jenis | Jalur | Mode A (tabel perakitan) | Mode B | `jalur` |
|---|---|---|---|---|---|
| 1 | Modul **pustaka** dipasang / naik / dilepas | `module.mjs add/upgrade/detach` sesudah Persetujuan Rancangan, tanpa SDD | baris **pasang** | — (pustaka hanya Mode A) | `pasang` |
| 2 | Pustaka dipasang lalu disesuaikan | `module.mjs add` → SDD **adaptasi** (spec hanya untuk `custom_*.go` / `Custom*.tsx`) | baris **pasang + sesuaikan** | — | `pasang+sesuaikan` |
| 3 | Manifest/lockfile berubah atau naik versi runtime/framework | `/rudis.upgrade` bertahap; **naik mayor = persetujuan pengguna**; modul pustaka tetap baris 1 | sama | sama | `upgrade` |
| 4 | ≥2 modul tersentuh atau kontrak lintas modul | `/rudis.revamp` berfase (brd fase 1, scope dibekukan di Gate 2, tanpa big-bang) | sama | sama | `revamp` |
| 5 | **Bug** (jenis) | `/rudis.tracer` read-only (DB dev/snapshot, §4) → perbaikan sempit + Current/Expected/Unchanged (`templat/spesifikasi.md`); area ber-spec → spec diperbarui | sama | sama | `tracer` |
| 6 | **Ubah perilaku** bagian yang ada, area **ber-spec** | spec lama diperbarui (FR/AC + Unchanged) → `/rudis.redesign` dengan spec sebagai batas | **ubah modul kustom** ber-spec | sama | `perbarui-spec` |
| 7 | **Ubah perilaku**, area **tanpa spec** | `/rudis.brd` ter-scope (bila peta belum ada) → `/rudis.redesign` fallback `docs/brd/` | **ubah modul kustom** tanpa spec (dibuat sebelum SDD) | sama | `redesign` |
| 8 | **Kapabilitas baru** (entitas/endpoint/kontrak/layar baru), satu modul | siklus penuh specify → plan → tasks → implement, mimicry pola yang ada | baris **bangun** | sama, constitution as-is | `siklus-penuh` |
| 9 | Perubahan kecil tanpa perilaku/kontrak baru (teks, konfigurasi, ≤ ±2 berkas) | tanpa SDD — `templat/spesifikasi.md` | sama | sama | `tanpa-sdd` |

- **Kriteria jenis** (penilaian analis, tertulis di spesifikasi): *bug* = perilaku kini menyimpang dari janji yang bisa
  ditunjuk sumbernya (spec, brd, dokumen, kesepakatan pengguna) atau data tidak konsisten; *ubah perilaku* = perilaku kini
  sesuai janji lama tetapi pengguna ingin lain, tanpa entitas/endpoint/kontrak baru, ±≤5 berkas; *kapabilitas baru* =
  ada entitas, endpoint, kontrak, layar, atau peran baru.
- **Jaring dulu:** area yang akan disentuh belum punya tes → `/rudis.test` lebih dulu dengan instruksi characterization:
  *"rekam perilaku kini sebagai expected; jangan menebak expected; bug yang terekam ditandai, tidak diperbaiki di langkah ini"*.
- Bug memakai tracer di **kedua** mode; upgrade modul pustaka = `module.mjs upgrade`, bukan `/rudis.upgrade`.
- Baris 2/8 = satu folder baru `specs/<NNN>-<slug>/`; baris 6 memperbarui folder yang ada; baris 7 berbatas `docs/brd/`.
  Tabel perakitan (Mode A) menautkannya di kolom **Spesifikasi**.
- Register: TL mencatat saat mulai `bin/register.sh ubah <ID> --mode-saat-mulai A --jalur-awal tracer`.

## 3. Pemicu re-route & kapan bertanya
- **Pemicu re-route:** tracer menyimpulkan "ini fitur, bukan bug"; cakupan bertambah melewati ambang (±5 berkas atau
  modul ke-2); upgrade ternyata bug (atau sebaliknya); spec ternyata tidak ada / sudah basi untuk area itu.
- Analis (BSA/TL) mencatat alasan di spesifikasi/laporan; TL mengubah register:
  `bin/register.sh ubah <ID> --jalur-akhir redesign --reroute "tracer: perilaku sesuai brd, permintaan = fitur"`.
  Jalur akhir yang berbeda dari jalur awal wajib punya `reroute` (register menolak tanpa alasan).
- **Analis wajib bertanya lewat COO** bila: kartu `mode_mesin: ragu` (atau kartu ≠ marker); jenis cocok
  setengah-setengah; atau perubahan melewati batas jenis/cakupan di tengah jalan. Tulis di **Keputusan yang dibutuhkan**.
- Jalur **tidak** ditanyakan per perubahan: jalur ikut brief / Persetujuan Rancangan, ditanya hanya bila `ragu`.
  Pertanyaan dikumpulkan per gerbang (sasaran anggaran keputusan: bug ≤3, fitur ≤5).

## 4. Aturan keras (selalu)
1. CLI `rudis` **hanya** lewat `bin/rudis-sdd.sh <perintah>` (= `bin/perkakas.sh sdd …`): `uvx --from <repo lokal> rudis`,
   `--no-marketplace` pada `init`, menolak marketplace (`skill`, `governance`, `profile`, `utilities`, `init --profile`) di luar
   allowlist, menolak `run`, `tui`, `--gitlab-token`. Jangan memanggil `rudis`/`uvx` langsung atau `~/.local/bin/rudis` (K7).
2. **Tanpa marketplace** (`perkakas.json` kebijakan_marketplace; cek `bin/perkakas.sh marketplace cek [<sumber>]`).
   Menambah allowlist = keputusan pengguna lewat COO. Rute desain `/rudis.prototype` (memasang skill luar) tidak dipakai.
3. **Command per langkah.** Tidak pernah `/rudis.ultimate` (S1), `/rudis.deploy`, `/rudis.operate` (milik IT Operations),
   `rudis run <cmd>` (U2).
4. **Git = aturan RudisOne.** Command RUDIS tidak membuat branch/commit; peran meng-commit sesudah command, di branch tugas
   `rudis/<ID>[-p<n>]`. Checkpoint/rollback yang ditawarkan command (commit/stash, `git checkout <sha> -- <path>`,
   `git reset --hard`) **selalu** diganti: `bin/rudis-git.sh checkpoint <ID> [pesan]`,
   `bin/rudis-git.sh rollback <ID> <sha-checkpoint> -- <path…>`, `bin/rudis-git.sh daftar <ID>`. Tanpa `--create-branch`, tanpa stash.
5. **Data:** tracer & tes hanya DB dev/snapshot; koneksinya disebut brief (database lokal proyek: brief cukup menyebut
   nama database — koneksinya `.env` lokal yang dimuat aplikasi/tes sendiri, skill `rudis-sdlc` › `.env` & database lokal). Tracer **tidak pernah** membaca `.env`/config untuk
   kredensial (izin `Read(**/.env)` memang di-deny) — instruksikan "jangan membaca .env; pakai koneksi dari brief"; tanpa koneksi
   → telusuri kode saja dan tandai kebutuhan data. Data prod lewat Head of IT Operations (query read-only tercatat, keluaran
   agregat/masking; skill `rudis-operasi` › Data production).
6. **Hanya COO yang bertanya ke pengguna** (S6, K5) — §9.
7. Jangan jalankan `.rudis/scripts/bash/update-agent-context.sh` (K10).
8. Kolom Perkakas & laporan memuat `sdd@<sha>` dari `bin/perkakas.sh versi`.

## 5. Langkah per fase (urutan skill `rudis-sdlc` › Jalur Aplikasi tetap)
| Fase | Siapa | Yang dikerjakan |
|---|---|---|
| Analisis | **BSA** (read-only), diperiksa TL | Jalur per perubahan (§2) + kriteria jenis tertulis. Baris 2/8: draf spec **dengan tangan** (`spec-template.md` RUDIS + pertanyaan gaya clarify) di `handoff/<ID>/specs/<slug>/spec.md`; baris 5/6/7: Current/Expected/Unchanged (`templat/spesifikasi.md`, atau usulan perubahan spec lama). Baris 5: TL menjalankan `/rudis.tracer` di worktree-nya, BSA menganalisis laporannya. Mode A: tabel perakitan. Persetujuan Rancangan memuat tabel/jalur + ringkasan draf + asumsi berisiko. |
| Konstruksi 1 (sekali per proyek) | **Tech Lead** | `bin/rudis-sdd.sh init --here --force --ai claude --script sh` di worktree → `.gitignore` (K3): tambah bila belum ada — proyek hasil scaffold kernel v7.1+ sudah memuat `.rudis/audit.log`, `.rudis/audit/`, `.rudis/.current-feature`, `docs/trace-reports/`, `docs/test-reports/`; `!.env.*.example` tetap perlu dicek → `/rudis.constitution` dari templat mode (§1). **Mode B** sebelum constitution: `/rudis.brd` ter-scope ke modul yang akan disentuh (bukan seluruh repo); constitution as-is berstatus Draft sampai pengguna/lead klien mengesahkan; catat `baseline` gerbang mutu (§6) di kartu. |
| Konstruksi 1 (per tugas) | **Tech Lead** | `bin/rudis-git.sh checkpoint <ID>` sebelum command yang mengubah kode. Baris 2/8: `/rudis.specify --number N` (draf BSA + jawaban COO; N unik dari register) → `/rudis.checklist`. Baris 3/4/6/7: command jalurnya, gerbang interaktif dijawab dari brief. Commit sesudahnya. |
| Konstruksi 2 (rencana) | **Tech Lead** (C: BSA) | `/rudis.plan` argumen baku *"jangan bertanya; keputusan pemilik produk tandai NEEDS CLARIFICATION dengan default"* → `/rudis.tasks` → **BSA** `/rudis.analyze` (read-only). |
| Konstruksi | **SE** per `T###` di brief | Sekali per worktree `printf '%s\n' <NNN-slug> > .rudis/.current-feature`. `/rudis.implement` hanya `T###` di brief; `STOP and ask` → `[Terhambat]`. Commit sesudah command. |
| Pengujian | TL; peninjau; BSA cocok-spesifikasi | `/rudis.analyze` ulang (+ `/rudis.converge` bila ada spec/plan/tasks; brownfield tanpa spec: cek terhadap `docs/brd/`) + gerbang mutu §6 + Final Checklist (Mode A). Drift spec diperiksa saat serah (`--serah <branch> --proyek <folder>`). |
| Rilis / Operasi | IT Operations | RUDIS **tidak dipakai**. |

Brief TL → SE/BSA menambah: mode, jalur, path spec, `<NNN-slug>`, `T###`, koneksi DB dev/snapshot, keputusan alat gerbang (§6).
Kontrak, tabel, dan modul final dipindah ke pemiliknya (`packages/api-contract/`, `knowledge/API.md`, `DATABASE.md`,
`MODULE_MAP.md`) di fase Polish; di branch tugas folder `specs/<NNN>-<slug>/` diberi `FROZEN.md` (tanggal + pemilik) **sebelum serah-terima**; folder itu
beku sejak merge ke main (tidak ada yang menulis langsung ke main) — redesign/revamp/upgrade/postmortem tidak menyuntingnya;
perubahan masuk ke pemilik atau spec baru.

## 6. Gerbang mutu (baseline / kode baru)
- **Baseline per alat** direkam pada HEAD checkpoint sebelum perubahan pertama; sha + alat dicatat di kartu (`baseline`).
  Gerbang = **tidak ada temuan baru** sejak baseline, bukan "berkas bersih". Temuan lama di berkas tersentuh tidak
  diperbaiki diam-diam (scope-lock); dicatat sebagai Known Gaps / tugas terpisah.
- **Rahasia baru = BLOCKER** (diff/commit baru). Temuan historis dilaporkan ke pengguna, tidak dibereskan diam-diam.
- **Tes:** daftar lulus/gagal direkam sebelum perubahan; gerbang = tidak ada hijau→merah. Legacy yang suitenya sudah merah
  memakai daftar "gagal yang diketahui" — ini **menggantikan** "berhenti bila baseline merah" di `/rudis.upgrade`.
- **Kejujuran:** laporan menyebut "baseline mode", sha baseline, alat yang dijalankan, dan yang tidak (no false green).
- **Alat per stack:**

| Stack | Analisis statis (baseline) | Dependensi |
|---|---|---|
| Go | golangci-lint `new-from-merge-base` | govulncheck |
| JS/TS | ESLint bulk suppressions | osv-scanner |
| PHP | PHPStan/Larastan atau Psalm baseline | `composer audit` |
| Java | Sonar new code + SpotBugs exclude (tanpa baseline sejati) | osv-scanner |
| .NET | Sonar new code, `WarningsNotAsErrors` (tanpa baseline bawaan) | `dotnet list package --vulnerable` |
| semua | Semgrep `--baseline-commit`; Gitleaks `--baseline-path` (rahasia) | — |

- Alat belum terpasang → **brief memutuskan**: pasang (izin lewat COO; butuh jaringan) atau lewati dan catat
  "tidak terverifikasi". Mode A: gerbang ini + Final Checklist; baseline biasanya bersih.

## 7. CVE (Keputusan 1 — jangan diubah)
- **Wajib diperbaiki** untuk dependensi **baru atau diubah**: Critical/High **terjangkau** (Go, govulncheck), atau Critical
  (npm dan ekosistem tanpa reachability), **∪ KEV**.
- Perbaikan yang butuh naik versi **mayor** → jalur `upgrade` dengan persetujuan pengguna.
- Sisanya dilaporkan ke pengguna, diurutkan KEV > EPSS (sebagai label) > CVSS. Pengecualian butuh alasan tertulis.
- CVE warisan bukan BLOCKER tugas yang tidak terkait (laporkan; tugas upgrade terpisah).

## 8. Artefak
Proyek standar (Mode A, dan Mode B yang sudah berstandar): pemilik aturannya `.claude/rules/monorepo.md` di proyek itu
(alasan: skill `rudis-monorepo` › `references/knowledge-gateway.md`, bagian RUDIS SDD output) — jangan disalin ke kartu.
Proyek lain memakai nama yang sama:

| Artefak | Letak | Git |
|---|---|---|
| Spec per fitur | `specs/<NNN>-<slug>/` (`--number <NNN> --short-name <slug>` dari tabel perakitan/register) | di-commit; `FROZEN.md` ditulis di branch tugas sebelum serah, beku sejak merge |
| Perkakas RUDIS | `.rudis/` (memory/constitution.md, templates, scripts) | di-commit; `.rudis/audit.log`, `.rudis/audit/`, `.rudis/.current-feature` di-gitignore |
| Peta as-is | `docs/brd/` — turunan, tidak pernah pemilik | di-commit |
| Catatan run | `docs/revamp/<slug>/`, `docs/upgrades/` | di-commit (default TL platform, menunggu konfirmasi pengguna) |
| Laporan tracer | `docs/trace-reports/` | **di-gitignore** (keputusan pengguna); dirujuk dari `handoff/<ID>/` |
| Laporan tes | `docs/test-reports/` | **di-gitignore** (default TL platform, menunggu konfirmasi pengguna) |
| Prototipe | — (`/rudis.prototype` tidak dipakai) | — |
| Klien melarang (`artefak: handoff`) | semua di `handoff/<ID>/` | — |

Spec berisi **perilaku dan kontrak** (FR, AC, Current/Expected/Unchanged), bukan detail implementasi (cepat basi).

## 9. Pertanyaan ke pengguna — selalu lewat COO
Command RUDIS ditulis untuk agent yang bicara langsung dengan pengguna (`clarify`, `specify` Q1–Q3, `plan`, `implement`
"STOP and ask", gerbang brd/redesign/revamp/upgrade/tracer). Di RudisOne:
1. Jangan menunggu jawaban di dalam command. Catat asumsi dengan default, tandai `NEEDS CLARIFICATION`; gerbang konfirmasi
   rencana dijawab dari brief, ekspektasi tracer dari brief (tidak ada → tracer berhenti, itu benar).
2. Tulis pertanyaannya di **Keputusan yang dibutuhkan** (atau `[Terhambat]`) — skill `rudis-sdlc` › "Tanya pengguna".
3. COO bertanya di gerbang yang sesuai (biasanya Persetujuan Rancangan); keputusan baru dari plan → COO di luar gerbang.
4. Jawaban ditulis BSA/TL ke spec dengan format `- Q: … → A: …`.

## 10. Perkakas, versi, PAT
- `bin/perkakas.sh siapkan|cek` (clone ke `~/Documents/Neuron/ai-agent/rudis`; `pull --ff-only` ditunda selama ada tugas
  Engineering berjalan). Versi: `bin/perkakas.sh versi` → `… sdd@<sha>`; rilis template `init`/`update` (selalu terbaru, K8)
  dicatat terpisah.
- PAT **tidak pernah** diminta di chat, dicetak, ditulis agent ke berkas, atau dimasukkan ke argumen. Perkakas membacanya
  dari penyimpan `rudisone-rudis-sdd` per OS: macOS Keychain; Linux/WSL2 berkas 0600 `~/.config/rudisone/rahasia/` (diisi
  pengguna). Belum ada / 401 → berhenti untuk bagian itu; laporkan ke COO perintah yang dicetak perkakas untuk pengguna
  (scope `read_api` + `read_repository`): macOS `security add-generic-password -s rudisone-rudis-sdd -a "$USER" -w`
  (perbarui: `-U`); Linux/WSL2 `bin/perkakas.sh pat rudisone-rudis-sdd`.

## 11. Risiko terbuka (sebut di laporan bila menyentuh tugasmu)
- **Belum teruji di repo nyata:** jalur Mode B (brd/tracer/redesign/revamp/upgrade di bawah RudisOne), `implement`
  keseluruhan, specify dari draf BSA, penunjuk `.current-feature` di worktree SE. Ukur akurasi jalur dari
  `jalur_awal` vs `jalur_akhir` (perkiraan riset: ±1 dari 5 salah jalur awal).
- **brd di monolit berlapis teknis** (`controllers/ models/ views/`): asumsi "modul = folder domain" bisa salah — periksa peta.
- **Celah alat:** Semgrep diff-aware tidak lintas berkas; .NET dan SpotBugs tanpa baseline sejati.
- **GL_TOKEN:** token sesi device ditolak 401; tanpa PAT di penyimpannya (Keychain/berkas rahasia) `init` gagal. Paket template lokal = keputusan pengguna (U1).
- **Penomoran paralel (K12):** selalu `--number N` dari register.
- **K2 letak `specs/`:** masuk standar rudis-monorepo (T-20261030-6 bagian B, kernel/v7.1) — belum di main sampai pengguna
  menyerahkannya; sementara itu ikuti tabel §8 (namanya sama).
- **Biaya dokumen (K11):** ±2.000 baris per modul kecil; `clarify`/`checklist` boleh dilewati untuk baris kecil.
- Allowlist marketplace: `rudis init` tidak menegakkan pin — periksa `.claude/settings.json` sesudahnya.

## 12. Rujukan
skill `rudis-sdlc` (fase, gerbang, "Tanya pengguna") · `protokol.md` (git/worktree) · `templat/tabel-perakitan.md` ·
`templat/spesifikasi.md` · `templat/constitution-rudis.md` · `templat/constitution-legacy.md` · `perkakas.json` ·
command RUDIS di proyek: `.claude/commands/rudis.<cmd>.md` · riset T-20261030-3 §4.2, §7 · T-20261030-4 §3.2, §6.4.
