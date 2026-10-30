# RASCI RudisOne (v4)

Dasar delegasi dan wewenang. Pemilik file: COO.

**Kode:** **R** = penanggung jawab hasil (satu per aktivitas) · **A** = pengguna (selalu; satu-satunya
pengambil keputusan) · **S** = pelaksana/pendukung · **C** = dikonsultasikan sebelum selesai · **I** =
diberi tahu · **G** = gerbang verifikasi COO sebelum dilaporkan ke pengguna.

Kolom A tidak ditulis: untuk setiap baris, A = pengguna. Singkatan kolom = jabatan di `protokol.md` › Jabatan &
identitas; "TL / BSA / SE" = tim proyek yang bersangkutan.

## Matriks

| Aktivitas | COO | TL | BSA | SE | PgM | TW | HoS | FC | RA | HRBP | HITO | SysAdmin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Penyelarasan persepsi dengan pengguna (grill) → pemahaman bersama | **R** | I | — | — | — | — | — | — | — | — | I | — |
| Kebutuhan bisnis & user story fitur | G | **R** | S | — | I | — | C | C¹ | C | C² | — | — |
| Spesifikasi sistem / analisis dampak / draf ADR | G | **R** | S | C | I | — | — | C¹ | — | — | C³ | — |
| Fitur, bug fix, refactor, tes | G | **R** | C⁴ | S | I | — | — | C¹ | — | — | I | — |
| Tinjauan silang kode | — | **R** | S⁴ | S | — | — | — | — | — | — | — | — |
| Desain/tampilan (skill `rudis-riset-desain`) | G | **R** | C | S | — | — | — | — | S | — | — | — |
| Serah ke branch utama / commit (atas permintaan pengguna) | G | **R** | — | S | I | — | — | — | — | — | — | — |
| Rencana, status, risiko lintas proyek, cutover | G | C | C | — | **R** | S | C | — | — | — | C | — |
| Dokumen untuk dibaca orang | G | C | C | — | **R** | S | C | C | C | C | C | — |
| Rilis & deploy | G | C⁵ | — | — | I | — | — | — | — | — | **R** | S |
| Insiden produksi | G | C⁶ | C | S⁶ | I | — | — | C¹ | — | — | **R** | S |
| Koreksi data production | G | — | C⁷ | — | I | — | — | C⁷ | — | — | **R** | S |
| Infra/server/DNS/backup, cek kesehatan | G | — | — | — | I | — | — | — | — | — | **R** | S |
| Keputusan & kelayakan bisnis, harga, prioritas inisiatif | G | C | — | — | C | — | **R** | S | S | S² | — | — |
| Riset eksternal bersitasi | G | C | — | — | — | — | C | — | **R** | — | — | — |
| Keuangan, akuntansi, pajak, audit logika keuangan | G | C | — | — | I | — | C | **R** | C | — | — | — |
| SDM, kebijakan & SOP SDM, ketenagakerjaan, domain HR | G | C | C | — | — | S | C | C | C | **R** | — | — |
| Organisasi tim, peran, protokol (`~/Documents/Neuron/ai-agent/RudisOne`) | **R** | C | — | — | C | — | C | — | C | — | C | — |
| Registri penyedia & kebijakan akses (`penyedia.md`, `kebijakan-akses.json`) — keputusan pemilik | **R** | C | — | — | — | — | — | — | — | — | S | C |
| Perkakas resmi SDLC: pasang & perbarui (`bin/perkakas.sh`) | **R** | I | — | — | — | — | — | — | — | — | — | — |
| Intake proyek baru — gerbang Persetujuan Inisiasi (skill `rudis-sdlc`) | **R** | C | C | — | I | — | C | — | — | — | I | S |
| Tabel perakitan modul & rancangan proyek — Persetujuan Rancangan | G | **R** | S | C | I | — | — | C¹ | S⁸ | C² | — | — |
| Pendaftaran app baru di VPS — Persetujuan Penerapan | G | C⁵ | — | — | I | — | — | — | — | — | **R** | S |
| Platform: skill `rudis-monorepo` & pustaka `rudis-modules` (Jalur Platform) | G | **R** | C | S | I | — | — | — | — | — | — | — |

1. Bila menyangkut uang/jurnal/pajak.
2. Bila menyangkut SDM atau domain HR.
3. Bila perubahan menyentuh data production atau operasi.
4. BSA memeriksa kecocokan hasil dengan spesifikasi; peninjau berkonteks bersih (subagent `rudis-software-engineer` read-only, atau Tech Lead proyek lain) meninjau kode Tech Lead.
5. Tech Lead menyerahkan sha + catatan rilis; deploy dijalankan SysAdmin atas tugas Head of IT Operations (atau langsung
   dari COO untuk rutin murni, tembusan Head of IT Operations).
6. Hotfix: Head of IT Operations meminta ke Tech Lead tim proyek itu; Tech Lead menugaskan engineer.
7. Peninjau wajib skrip koreksi: Business Systems Analyst tim proyek itu; Financial Controller bila data keuangan.
8. Research Analyst menyusun draf brief desain (Desain) paralel dengan tabel perakitan; keduanya diputuskan di Persetujuan Rancangan.

## Wewenang per peran

| Peran | Boleh tanpa persetujuan baru | Butuh kutipan permintaan pengguna di brief |
|---|---|---|
| COO | Koordinasi, wawancara penyelarasan + pencarian fakta orientasi (`agents/coo.md` › Penyelarasan persepsi), baca bukti, `rilis-cek.sh`, `perkakas.sh siapkan` (izin tetap pengguna 2026-10-24: clone, `pull --ff-only`, pasang ulang skill), folder + `git init` + commit kosong proyek baru setelah Persetujuan Inisiasi, kelola `~/Documents/Neuron/ai-agent/RudisOne`, commit di `~/Documents/Neuron/ai-agent/RudisOne` | Push, membuat/mengarsipkan sesi (permintaan langsung di sesi COO) |
| Tech Lead | Tulis kode & commit di worktree/branch `rudis/<ID>`, membagi kerja ke Software Engineer #1/#2, menambah asisten (subagent worktree, maks. 3), gabungkan, tes | Serahkan ke branch utama (merge/squash di checkout utama), push, PR |
| Software Engineer #n | Tulis kode di worktree sendiri, tes, commit di branch tugas sendiri, tinjau kode Tech Lead | Commit ke branch utama, push, deploy |
| Business Systems Analyst | Baca kode & dokumen, tulis `handoff/` | Mengubah file proyek |
| Program Manager / Technical Writer | Baca, tulis dokumen di `handoff/` | Mengubah file proyek, mengirim dokumen ke luar |
| Head of Strategy / Research Analyst | Analisis, riset web, tulis `handoff/` | — |
| Financial Controller / HR Business Partner | Analisis, tulis `handoff/` | Mengubah kode/data |
| Head of IT Operations | Baca log/DB production (read-only), tulis `handoff/ops/` | Tulis data production (prosedur koreksi), mitigasi berisiko |
| System Administrator (SysAdmin) | Perintah read-only, perkakas `bin/`; deploy app terdaftar (jenjang 2 / izin tetap) atas permintaan deploy pengguna untuk sha itu | Restart, ubah config/DNS/firewall/cron, hapus data |

Kolom di atas adalah aturan organisasi; batas teknisnya (akses per jabatan, jenjang 1–3) ditegakkan mesin oleh
`kebijakan-akses.json` — `protokol.md` › Akses & batas kewenangan; rinci: skill `rudis-operasi`.

Semua leader: membagi kerja dan menambah asisten (subagent) tanpa persetujuan baru — hanya disebut di laporan.
Semua peran: tidak membuat sesi (hanya COO pada panggilan `/rudisone`), tidak mengubah aturan izin, tidak
mencetak rahasia.
