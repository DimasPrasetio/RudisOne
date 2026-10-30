---
name: rudis-perkakas
description: Daftar perkakas bersama RudisOne (bin/*.sh — server-cek, rilis-cek, pasca-deploy, konfig, kantor, kebijakan, perkakas, register, cek-konsistensi, peran, inti, metrik), skill tim rudis-*, dan aturan skill luar (perkakas.sh pastikan/skill, docx-neuron, document-skills, frontend-design, docs). Muat saat perlu tahu perintah mana yang dipakai dan exit code-nya, sebelum memuat skill luar yang belum ada di daftar skill sesimu, atau saat mendaftarkan skill/perkakas baru.
---

# Perkakas bersama, skill tim, dan skill luar

## Perkakas bersama (`~/Documents/Neuron/ai-agent/RudisOne/bin`; semua read-only kecuali `perkakas.sh`)
| Perintah | Guna | Exit |
|---|---|---|
| `bin/server-cek.sh [alias]` | Snapshot server (dari `konfigurasi/server.json`): host, nginx/mysql, tiap app di registry playbook (image, health, `/readyz`, sisa hari SSL) | 0 sehat · 1 peringatan · 2 tak terhubung · 3 konfigurasi belum ada |
| `bin/rilis-cek.sh <owner/repo> <sha>` | Workflow CI per commit + tag image GHCR yang terbit | 0 siap deploy · 1 gagal · 2 berjalan · 3 argumen |
| `bin/pasca-deploy.sh <app> <sha> [alias]` | Setelah deploy: image = sha, healthy, `/readyz` 200, CORS via domain publik, app lain tetap healthy | 0 lolos · 1 gagal · 3 argumen |
| `bin/konfig.sh [cek\|get <jalur>\|host [alias]\|playbook [alias]\|contoh]` | Konfigurasi per device (server, aplikasi, DNS) — baca saja; `cek` gagal → COO menanyakan pengguna (`penyedia.md` › Konfigurasi server) | 0 · 3 belum ada / kurang |
| `bin/kantor.sh [buka\|--tanpa-browser\|mulai-ulang\|berhenti\|demo]` | Kantor RudisOne (tampilan pemantauan lokal) | 0 · 1 gagal menyala |
| `bin/kebijakan.sh [cek\|tampil\|audit [n]\|audit --verifikasi\|uji '<json>'\|pasang\|lepas]` | Kebijakan akses & batas kewenangan: status + denyut hook (bukti hook dipanggil), ringkasan aturan, jejak audit, verifikasi rantai hash audit, simulasi satu aksi. `pasang`/`lepas` hanya oleh pemilik | 0 · 1 belum terpasang / rantai rusak · 3 argumen |
| `bin/perkakas.sh [siapkan\|cek\|versi\|proyek <folder> [--json]]` | Perkakas resmi SDLC: pasang/perbarui skill & pustaka rudis (hanya COO & `install.sh` yang `siapkan`; siapa pun boleh `cek`/`versi`/`proyek`). `proyek` = jenis + `mode-mesin: A\|B\|ragu` + backend + bukti + kartu — skill `rudis-sdlc` › Perkakas resmi, skill `rudis-sdd` | 0 siap · 1 perlu perhatian · 3 argumen / folder tidak ada |
| `bin/perkakas.sh pastikan <skill>` · `bin/perkakas.sh skill` | Skill luar: pastikan satu skill tersedia (dipasang dari sumber resminya bila belum) · keadaan semua skill luar. Siapa pun boleh — bagian Skill luar | 0 tersedia · 1 gagal · 2 tak bisa dipasang (pakai alternatif) · 3 tak terdaftar |
| `bin/sesi.sh [backend\|deteksi [--tulis]\|daftar [--json]\|cek]` | Backend sesi device (`desktop`/`cli`, `konfigurasi/sesi.json`); backend cli: sesi RudisOne dari `claude agents --json` (yang menunggu izin → `claude attach`), cek versi ≥ 2.1.300, pengaman sesi latar, folder yang belum dipercaya CLI. Semua jabatan boleh `backend`/`daftar`/`cek`; `deteksi --tulis` hanya `install.sh` — skill `rudisone` › `backend-cli.md` | 0 baik · 1 perlu perhatian · 3 argumen |
| `bin/perkakas.sh pat <layanan>` | Simpan/perbarui PAT repo privat (mis. `rudisone-rudis-sdd`) — **dijalankan pengguna sendiri**, PAT diketik saat diminta: macOS → Keychain, Linux/WSL2 → berkas 0600 `~/.config/rudisone/rahasia/<layanan>`. Agent tidak menjalankannya; cukup teruskan perintah yang dicetak perkakas | 0 tersimpan · 1 kosong/gagal · 3 nama salah |
| `bin/rudis-git.sh checkpoint <ID> [pesan]` · `rollback <ID> <sha> -- <path…>` · `daftar <ID>` | Pengganti checkpoint/rollback command RUDIS (stash, `reset --hard`, `checkout <sha> --`): checkpoint = commit di branch tugas `rudis/<ID>…`, rollback = commit pemulihan path dari checkpoint (keadaan sebelumnya tetap di riwayat). Hanya di worktree tertaut, menolak berkas rahasia — skill `rudis-sdd` | 0 · 1 ditolak · 3 pemakaian |
| `bin/register.sh [tambah\|ubah <ID>\|tampil\|kunci-cek\|validasi\|bangkitkan\|impor\|rapikan]` | Register tugas JSON dengan kunci berkas + tulis atomik; membangkitkan `register-tugas.md` (skill `rudis-multitugas`). Ditulis COO | 0 · 1 galat/bentrok |
| `bin/cek-konsistensi.sh [--repo]` | Pemeriksa drift read-only: skill dirujuk vs ada/terpasang, path & rujukan bagian, ukuran inti, subagent terbangkit, pemetaan aturan, `TEAM.md` vs sesi hidup, hook terpasang, register valid. `--repo` = hanya cek isi repo (deterministik, dipakai tes). Mode device juga: kesehatan hook kebijakan (uji kasus pasti, denyut, rantai audit), kebersihan `catatan/` (tanggal, pola instruksi/rahasia). `--proyek <folder>` = kartu proyek vs deteksi mesin; `--serah <branch> --proyek <folder>` = + drift spec | 0 bersih · 1 peringatan · 2 galat |
| `bin/peran.sh [bangun\|cek]` | Bangkitkan definisi subagent `agen/rudis-<id-peran>.md` dari `agents/<id-peran>.md` + `protokol.md`; `cek` = gagal bila basi | 0 · 1 basi |
| `bin/inti.sh [cek\|pasang\|lepas\|hook]` | Hook `SessionStart` yang memuat ulang protokol inti + peran setelah kompaksi di sesi RudisOne di folder proyek. `pasang`/`lepas` hanya oleh pemilik | 0 · 1 belum terpasang |
| `node bin/metrik.mjs tugas <ID> [--jenis bug\|fitur]` | Metrik per tugas dari transkrip (token, sesi, pesan, revisi, intervensi, waktu) + beban keputusan X14 vs anggaran (bug ≤3, fitur ≤5) — `handoff/T-20261030-2/metrik-definisi.md` | 0 · 1 |
| `node uji/suite/jalankan.mjs --ref <git-ref> --nama <label>` | Suite regresi organisasi (10 tugas × k ulang) — `uji/suite/README.md`; jalankan setiap protokol/peran berubah | 0 · 1 |

Templat di `~/Documents/Neuron/ai-agent/RudisOne/templat/`: `brief-tugas.md`, `laporan-tugas.md`, `register-tugas.md`, `status-tugas.md`, `team.md`,
`riset.md`, `spesifikasi.md`, `user-story.md` (Business Systems Analyst), `status-rilis.md`, `laporan-deploy.md`, `brief-desain.md`,
`insiden.md`, `koreksi-data.md`, `pemahaman-bersama.md` (COO), `infra.md` (fakta server per device), dan untuk SDLC: `intake-proyek.md`, `tabel-perakitan.md`, `onboarding-app.md`, `kartu-proyek.md`, `constitution-rudis.md`, `constitution-legacy.md`. Format laporan di file peran didahulukan.

## Skill tim (`~/Documents/Neuron/ai-agent/RudisOne/skills`, ditautkan ke `~/.claude/skills` oleh `install.sh`)
| Skill | Kapan |
|---|---|
| `rudis-riset-desain` | Sebelum membuat/mendesain ulang antarmuka atau visual apa pun: riset internet → brief desain bersumber → cocokkan dengan proyek → bangun → verifikasi visual dengan screenshot |
| `rudisone` | Pintu COO (`/rudisone`) |
| `rudis-multitugas` | Banyak tugas sekaligus: register, antre/parkir, kunci, kapasitas |
| `rudis-sdlc` | Membangun software: fase, gerbang persetujuan, perkakas resmi, Jalur Aplikasi & Platform |
| `rudis-sdd` | Spesifikasi SDD (RUDIS) — hanya untuk baris tabel perakitan *bangun* / *pasang + sesuaikan* |
| `rudis-operasi` | Rilis, deploy, konfigurasi server, akses & audit rinci |
| `rudis-perkakas` | Skill ini: perkakas bersama, skill tim, skill luar |
| `rudis-grill-me` | COO: menyamakan persepsi dengan pengguna sebelum tugas turun (wawancara satu pertanyaan per giliran dengan rekomendasi → pemahaman bersama). Agent lain tidak mewawancarai pengguna |

Perkakas resmi (bukan bagian repo ini; dipasang & diperbarui `bin/perkakas.sh`): skill **`rudis-monorepo`**
dan pustaka **`rudis-modules`** — kapan dan oleh siapa dipakai: skill `rudis-sdlc`. RUDIS SDD (`sdd@<sha>`): skill `rudis-sdd`.

## Skill luar (`perkakas.json` › `skill_luar`)
Skill yang dipakai jabatan tetapi tidak dibundel di repo ini. Keberadaannya beda per device, jadi **sebelum memuat
skill luar yang belum muncul di daftar skill sesimu, jalankan `bin/perkakas.sh pastikan <skill>`**: tersedia →
lanjut; belum → dipasang dari sumber resminya saat itu juga, lalu baca `SKILL.md` di path yang dicetak (skill baru
otomatis aktif di sesi berikutnya). Exit 2 = tidak bisa dipasang di device ini → pakai alternatif yang dicetak.
Exit 1 → `[Terhambat]` ke pemberi tugas dengan keluaran perintahnya. `siapkan`/`cek` hanya melaporkan keadaannya.

| Skill | Untuk | Jabatan utama | Sumber resmi |
|---|---|---|---|
| `docx-neuron` | Dokumen Word resmi Neuronworks | Technical Writer, Program Manager | repo privat `DimasPrasetio/docx-neuron` (disimpan di `~/Documents/Neuron/ai-agent/docx-neuron`) |
| `docx`, `pdf`, `pptx`, `xlsx` | Word generik, PDF, slide, spreadsheet | Technical Writer, Program Manager, Financial Controller, Head of Strategy, Research Analyst, HR Business Partner, Business Systems Analyst | plugin `document-skills` dari marketplace `anthropics/skills` |
| `frontend-design` | Eksekusi desain antarmuka | Tech Lead, Software Engineer | plugin `frontend-design` dari marketplace `anthropics/claude-plugins-official` |
| `docs` | Dokumen kolaboratif Claude Docs | Technical Writer, Program Manager | bawaan aplikasi Claude — tidak bisa dipasang; alternatif `docx` |

- Skill Anthropic (`document-skills`) berlisensi hak cipta Anthropic: **jangan pernah disalin** ke repo/folder
  sendiri; selalu dipasang dari marketplace resminya.
- Skill luar baru: COO mendaftarkannya di `perkakas.json` (id, jenis `git`/`plugin`/`platform`, nama skill, sumber,
  jabatan) atas persetujuan pengguna; jabatan lain hanya memakai yang terdaftar.

