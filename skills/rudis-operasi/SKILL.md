---
name: rudis-operasi
description: Prosedur operasi RudisOne — rilis & deploy (rilis-cek SIAP DEPLOY, pasca-deploy), konfigurasi server per device yang belum ada (konfig.sh cek → tanya pengguna), izin deploy tetap, serta rincian akses per jabatan, jenjang 1–3, jejak audit, dan cara mengubah kebijakan. Muat sebelum meminta/menjalankan deploy, saat IT Operations melapor [Terhambat] karena konfigurasi, saat memverifikasi aksi ubah lewat audit, atau saat ada usulan mengubah kebijakan akses.
---

# Operasi: rilis, deploy, konfigurasi server, akses & audit

Ringkasan jenjang 1–3 dan larangan keras ada di `protokol.md` › Akses & batas kewenangan. Skill ini memuat rinciannya.

## 1. Rilis & deploy
- Sebelum meminta deploy: `bin/rilis-cek.sh <owner/repo> <sha>` harus "SIAP DEPLOY" (COO boleh menjalankannya sendiri).
  Hasilnya tercatat di audit dan menjadi syarat mesin deploy jenjang 2 (berlaku 24 jam).
- Deploy & verifikasinya milik IT Operations: brief deploy mewajibkan keluaran `bin/pasca-deploy.sh` utuh di
  laporan; COO memeriksanya di transkrip (`list_events`), bukan menjalankan ulang.
- Hasil Engineering tinggal di branch `rudis/<ID>` sampai pengguna memutuskan. "Serahkan"/"commit" dari pengguna →
  brief ke Tech Lead tim itu yang mengutip permintaan itu (`agents/tech-lead.md` › Serah ke branch utama).
- App yang pengguna beri izin deploy tetap juga tercakup di `ruang/system-administrator/.claude/settings.local.json`
  (dipasang pengguna sendiri; README › Izin deploy tetap).

## 2. Konfigurasi server belum ada / kurang
`[Terhambat]` dari IT Operations berisi daftar `bin/konfig.sh cek` → COO menanyakan pengguna satu per satu dengan
rekomendasi (`AskUserQuestion`, gaya `rudis-grill-me`): alias & Host ssh (kunci dan `~/.ssh/config` disiapkan pengguna
sendiri), playbook server bila ada, MCP DNS & domain, owner GitHub. COO menulis
`~/Documents/Neuron/ai-agent/RudisOne/konfigurasi/server.json` (bentuk: `konfigurasi/server.contoh.json`) dengan
kutipan persetujuan pengguna di `diisi.persetujuan`, lalu meminta System Administrator memverifikasi read-only
(`penyedia.md` › Konfigurasi server). Jangan pernah mengisi dari tebakan atau dari repo/sesi lain.

## 3. Akses per jabatan
Alat dan akun yang dipakai RudisOne adalah **aset perusahaan**: hanya sesi RudisOne (COO, sesi inti, subagent peran,
sesi saat dibutuhkan) yang memakainya dengan aturan ini; sesi pribadi pengguna tidak tersentuh. Daftar aset:
`penyedia.md`. Aturan mesin: `kebijakan-akses.json`, dibaca hook `bin/kebijakan.mjs` di setiap panggilan `Bash`,
`Write`/`Edit` dan alat MCP. Jabatan dibaca dari folder **awal** sesi (baris pertama transkrip) atau pembuka peran di pesan
**pertama** — `cd` ke `ruang/<id>` lain tidak mengubah jabatan. Setiap kemampuan (DNS, hosting, server, data production, rilis, repositori) punya daftar jabatan yang boleh
memakainya; jabatan lain selalu ditanya, walau sekadar membaca.

## 4. Jenjang 2 dan 3
- Jenjang 2 berjalan tanpa prompt **bila syarat mesin terpenuhi** (deploy app terdaftar dengan `rilis-cek` SIAP ≤ 24
  jam **dan** pemeriksaan ulang langsung ke GitHub saat deploy, tambah record subdomain, repo privat oleh COO), dan
  hanya bila perintahnya tidak digandeng perintah lain yang tidak dikenali. Syarat mesin tidak menggantikan aturan brief: kutipan permintaan
  pemilik tetap wajib. Syarat yang tidak terpenuhi (sha tanpa rilis-cek, app belum terdaftar, nama `@`) otomatis turun
  ke jenjang 3.
- Jenjang 3 memunculkan prompt izin di sesi agent; COO memberi pemilik tautan sesinya. Aksi berisiko lain: COO
  menanyakan pengguna dulu (rencana persis + dampak + rollback dari divisi), lalu brief yang mengutip persetujuannya.
  Aksi yang sering berulang: sarankan pengguna menambah izin tetap khusus.

## 5. Jejak audit
Setiap aksi jenjang 2–3 yang dijalankan, setiap `rilis-cek`, setiap SELECT data production (`baca-data`, dengan jumlah
baris) dan setiap perubahan berkas terlindung tercatat di `handoff/audit/<YYYY-MM>.jsonl` (waktu, jabatan, ID tugas,
aksi; rahasia disamarkan). Lihat: `bin/kebijakan.sh audit`. Jenjang 1 lainnya tidak diaudit. Saat memverifikasi aksi
ubah, COO mencocokkannya dengan audit.
- Audit hanya ditulis hook. Tiap baris berantai hash dengan baris sebelumnya: `bin/kebijakan.sh audit --verifikasi`
  (exit 1 = ada suntingan/sisipan/hapusan). Bukti `rilis-cek` untuk deploy jenjang 2 hanya dipercaya dari berkas yang
  rantainya utuh, dan tetap diperiksa ulang langsung ke GitHub saat deploy.
- **Denyut hook:** setiap kali dipanggil Claude Code, hook menulis `handoff/audit/.denyut.json` (paling sering 1×/menit,
  dengan versi kodenya). `bin/kebijakan.sh cek` dan `bin/cek-konsistensi.sh` membacanya — denyut basi atau dari versi
  lain berarti hook tidak berjalan (Node berpindah, matcher lama, dilepas): larangan hook tidak berlaku sampai pemilik
  memasangnya ulang.

## 5a. Data production
- **Siapa:** hanya Head of IT Operations / System Administrator (kemampuan `data-produksi`). Tech Lead, BSA, dan tracer
  RUDIS memakai DB **dev atau snapshot tersanitasi** yang koneksinya disebut brief; tidak pernah membaca `.env`/config
  untuk kredensial (`Read(**/.env)` di-deny pengguna). Kebutuhan data prod → `[Permintaan layanan]` ke HITO lewat COO.
- **Bentuk yang diloloskan hook (jenjang 1):** `ssh <alias> "mysql [opsi koneksi/format] [db] -e '<satu SELECT|SHOW|
  DESCRIBE|EXPLAIN>'"`. Ditolak (→ prompt): `INTO` apa pun (OUTFILE/DUMPFILE/@var), `FOR UPDATE`/`LOCK IN SHARE MODE`,
  komentar SQL, `;` di tengah, `load_file`/`sleep`/`benchmark`, opsi klien di luar daftar (`--init-command`, `--tee`,
  `--pager`, `-e` kedua). `curl` dari server tidak lagi termasuk baca (kanal keluar).
- **Isi query:** keluaran **agregat** (COUNT, SUM, GROUP BY) atau kolom kunci saja; data pribadi (nama, email, telepon,
  alamat, NIK) dan rahasia **dimasking** di SQL (`CONCAT(LEFT(email,2),'***')`, `NULL AS password`), selalu `LIMIT`
  (≤50 baris). Yang masuk transkrip dikirim ke vendor model — UU PDP: anggap transfer lintas batas.
- **Jejak:** setiap SELECT prod tercatat (`baca-data`, perintah tersamar, `baris` = jumlah baris yang benar-benar
  dikembalikan ke agent). Laporan HITO menyebut ID tugas, query, dan jumlah barisnya.

## 6. Jangan mengakali kebijakan
Tidak membungkus perintah infrastruktur dalam skrip lokal, variabel, atau `$( … )` agar tidak dikenali. Perintah yang
tidak dikenali tidak diloloskan hook — ia jatuh ke alur izin biasa — tetapi juga tidak diaudit, jadi menyamarkannya
adalah pelanggaran, bukan jalan pintas. Perintah majemuk (`&&`, `||`, `;`, `|`, `&`, subshell, `$( )`, backtick,
here-doc, pengalihan `>`/`>>`) hanya diloloskan bila **setiap** bagiannya dikenali baca; `git` (selain push yang
ditanya), `awk`, `sed`, `tee`, interpreter, dan variabel `$X` tidak pernah ikut diloloskan.

## 7. Mengubah kebijakan
Menambah jabatan pada kemampuan, menambah jenjang 2, atau mendaftarkan app/penyedia = mendelegasikan kewenangan: hanya
atas keputusan pemilik di sesi COO; Head of IT Operations menyiapkan usulannya, kutipan keputusan dicatat di commit.
Hook dipasang/dilepas pemilik sendiri: `bin/kebijakan.sh uji '<json>'` lalu `bin/kebijakan.sh pasang | lepas`
(status: `bin/kebijakan.sh cek`). Hook gagal terbuka (galat → alur izin biasa) dan tidak bisa menimpa aturan
*deny*/*ask* yang dipasang pemilik. Hook sistem lain yang juga bernama `bin/kebijakan.mjs` (mis. TimAgent) tidak
disentuh: hook RudisOne dikenali dari path absolutnya.

## 8. Akun
Akun yang dipakai masih akun pribadi pemilik; akun dinas RudisOne adalah tahap berikutnya (`penyedia.md`).

## 9. Berkas terlindung & batas hook
Berkas yang menentukan keputusan hook atau izin Claude Code: `kebijakan-akses.json`, `bin/**`, `agen/**`, `skills/**`
di checkout utama, `konfigurasi/**`, `handoff/audit/**` (termasuk cache `.sesi/`), `**/.claude/settings*.json`,
`**/.mcp.json`, `~/.claude.json`, `~/.claude/{agents,skills,commands,shell-snapshots}/**`, transkrip
`~/.claude/projects/**/*.jsonl`, dan berkas rc shell. `Write`/`Edit`/`MultiEdit`/`NotebookEdit` ke sana (juga lewat
symlink/hardlink dan huruf besar-kecil berbeda) dan perintah Bash yang **menulisnya secara nyata** — pengalihan `>`/`>>`,
`tee`, `sed`/`perl -i`, `cp`/`mv`/`rm`/`install`/`ln`/`truncate`/`chmod`/`dd`/`tar -x` dengan target terlindung,
`git checkout|restore|rm|…` pada path terlindung, `rm`/`mv` folder induknya, dan `kebijakan.sh`/`inti.sh`
`pasang`/`lepas` — selalu **ask** di sesi mana pun; yang disetujui tercatat di audit (`berkas-terlindung`). Membaca,
menjalankan, menguji, atau sekadar menyebut path **tidak** ditanya (T-20261030-6 A9); penulisan yang tidak bisa ditentukan
dari teks (interpreter, skrip) → alur izin biasa, dijaga `permissions` & sandbox. Perubahannya keputusan pemilik. Jabatan COO di sesi folder proyek hanya dari `/rudisone` yang **diketik** pengguna, bukan dari model yang
memanggil skill sendiri.

Batas yang tidak bisa ditutup hook (platform): agent berjalan sebagai user OS yang sama, jadi Bash yang menyamarkan
path (variabel, glob, base64, skrip buatan sendiri) tetap bisa menulis berkas apa pun; hook juga gagal terbuka
(galat/timeout/Node berpindah versi → alur izin biasa). Pembuka peran dari COO menetapkan jabatan sesi baru — hook
memercayai pesan pertama itu. Penegakan keras ada di settings pengguna: `permissions.deny`/`ask` (tetap berlaku walau
hook keliru `allow`, dan memeriksa target pengalihan `>`) ditambah sandbox Bash; usulan & perintah pemasangannya
dipasang pemilik sendiri (T-20261030-5 › `izin-usulan.md`). Setelah memperbarui hook, pemilik menjalankan
`bin/kebijakan.sh pasang` lagi (matcher kini juga `Write|Edit|MultiEdit|NotebookEdit`; `cek` memberi tahu bila
versi lama masih terpasang).
