# Struktur repo

Tata letak folder dan berkas RudisOne.

```
CLAUDE.md                  memuat protokol.md otomatis (@protokol.md) untuk sesi di folder ini, ruang/, worktree RudisOne
protokol.md                protokol INTI (≤200 baris): pemilik fakta, model sesi, format pesan, larangan keras
agents/<id-peran>.md       definisi peran (sumber tunggal), termasuk COO & Tech Lead
agen/rudis-<id-peran>.md   subagent peran — DIBANGKITKAN dari agents/ + protokol.md (bin/peran.sh bangun); ditautkan ke ~/.claude/agents
.claude/                   folder ini = ruang COO ("agent": "coo")
ruang/<id-peran>/.claude/  ruang sesi ("agent": "<id-peran>", peran = symlink ke agents/) — sesi IT Operations & sesi lain saat dibutuhkan
raci.md                    matriks RASCI + wewenang per peran
uji/suite/                 suite regresi organisasi (10 tugas × k ulang, sebelum vs sesudah); uji/simulasi-linux/ simulasi jalur Linux
.githooks/                 hook pre-commit repo (penjaga kebersihan; diaktifkan install.sh)
perkakas.json              perkakas resmi SDLC + skill luar (docx-neuron, document-skills, frontend-design, docs) dan sumber resminya
infra.md                   prosedur server, app, domain, alur deploy — generik, tanpa fakta server
konfigurasi/               per device: server.json (server, aplikasi, DNS; git-ignored) + server.contoh.json
penyedia.md                registri kemampuan & penyedia (DNS, repo, server) + alur konfigurasi server
kebijakan-akses.json       akses per jabatan & batas kewenangan jenjang 1–3 (dibaca hook bin/kebijakan.mjs)
bin/                       perkakas (daftar & kode keluar: skill rudis-perkakas › Perkakas bersama)
kantor/                    Kantor RudisOne: server status lokal + tampilan pixel (tanpa dependensi)
templat/                   kerangka brief & laporan, pemahaman bersama, register tugas, TEAM, brief-desain, intake/perakitan/onboarding (SDLC)
skills/<nama>/SKILL.md     skill tim (prosedur dimuat saat perlu): rudisone (pintu COO), rudis-grill-me, rudis-multitugas,
                           rudis-sdlc (membangun software), rudis-sdd, rudis-operasi, rudis-perkakas, rudis-riset-desain — ditautkan ke ~/.claude/skills oleh install.sh
install.sh                 pemeriksaan & persiapan di device baru (idempoten; tidak menimpa tautan sistem lain); memasang uv/uvx & Claude Code CLI otomatis bila belum ada (URL dicetak dulu; opt-out `--tanpa-unduh`; gagal → perintah manual)
TEAM.md, catatan/, handoff/, konfigurasi/server.json  per device, TIDAK di-commit (repo publik): buku alamat sesi,
                           ingatan per peran, register tugas & hasil, fakta server
```
