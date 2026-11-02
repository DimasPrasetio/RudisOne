# `.env` & database lokal — prosedur lengkap (skill `rudis-sdlc`)

Bagian ini milik skill `rudis-sdlc` (judulnya di SKILL.md: *`.env` & database lokal*); dipisah ke berkas ini agar SKILL.md
tetap di bawah batas ukuran. Dibaca Tech Lead sebelum menyiapkan `.env`/database lokal; **Batas** di bawah dikutip di brief Konstruksi.

Proyek **langsung bisa dijalankan**: `.env` lokal tanpa placeholder (`__ISI_…__`, `change-me`) dan database lokal siap,
tanpa pengguna menyunting `.env`. **Izin tetap** (aturan bawaan): agent menyiapkannya sendiri. Izin ini menggantikan "izin per kali" **hanya** untuk database lokal
proyek yang sedang dibangun: menyiapkannya, lalu memakainya lewat kode proyek (migrasi, seed, menjalankan aplikasi, tes
ber-database) pada `<slug>_db`/`<slug>_test`. MySQL lain (tes platform §4, database lain, menyalakan layanan) tetap per kali.
1. **`.env` non-DB:** `node scripts/env-local.mjs` (skill `rudis-monorepo`; scaffold menjalankannya sekali, Tech Lead
   menjalankannya lagi setelah setiap `module.mjs add`): JWT acak, login lokal di kunci `*BOOTSTRAP*`, kunci lain dari
   `.env.example`; nilai yang ada tidak diubah; placeholder tak dikenal → exit 1 + namanya. **Login awal lokal bawaan**:
   email `admin@example.com`, sandi `admin123`, nama `admin` (`USERS_BOOTSTRAP_NAME`; users tanpa
   username) — lokal, **publik**. Tidak pernah di `.env.production*`/server: `deploy.sh` › `[0/5] preflight` menolaknya
   (juga `admin@gmail.com` proyek lama; exit 1) sebelum apa pun berubah.
2. **Database** — hanya bila kunci DB kosong: `~/Documents/Neuron/ai-agent/RudisOne/bin/env-kunci.sh --salah-satu
   DB_DSN,DATABASE_URL` exit 3 (tanpa membaca `.env`); exit 0 → lewati. Tech Lead menjalankan dari root worktree:
   `node scripts/db-local.mjs --password-box --lang id` (root tanpa sandi; bila MySQL meminta sandi → kotak di layar pengguna) — memeriksa `SELECT VERSION()`, membuat `<slug>_db`, `<slug>_test`,
   akun `<slug>_dev@'127.0.0.1'` (`caching_sha2_password`, berhak hanya atas keduanya) bersandi acak, menulis kunci DB ke
   `.env`, lalu mencoba login. Exit 0 = siap · 4 = `<slug>_*` sudah ada, tidak ada yang diubah · 3 = root bersandi atau
   MySQL tidak menjawab, tidak ada yang diubah (baris `reason:` memilih pesan: `templat/pesan-gerbang.md` › Database lokal) · 1 = sebab lain (baca pesannya).
   **Batas** (wajib, dikutip di brief Konstruksi):
   - hanya MySQL di **localhost** (`127.0.0.1`/`localhost`) — tidak pernah host lain, server, atau production;
   - hanya database dan akun **proyek itu** (`<slug>_*`); database/akun lain tidak dibaca dan tidak diubah;
   - **tanpa menghapus data**: skrip persiapan tidak menjalankan `DROP`/`TRUNCATE`/`DELETE`; data `<slug>_db` hanya diubah
     migrasi maju & seed proyek; reset/migrasi turun/pengosongan hanya pada `<slug>_test` oleh tes;
   - **`<slug>_*` sudah ada** (exit 4) → berhenti, tanpa memakai database itu; COO menanyakan pengguna;
   - **sandi** (sandi akun DB acak dan sandi admin MySQL) tidak pernah lewat chat, brief, laporan, log, atau berkas
     RudisOne. Agent tidak membaca `.env` — skrip menulis & menguji login; aplikasi/tes memuat `.env` sendiri, jadi brief
     cukup menyebut nama database. Laporan: "DB siap, login akun proyek berhasil" + nama database.
3. **Exit 3 atau 4 → agent berhenti, satu langkah pengguna** (tanpa menebak sandi/host lain) di laporan, diteruskan COO
   persis (PowerShell 5.1: tanpa `&&`): pengguna (menyalakan MySQL bila mati — agent tidak menyalakan layanan; `no-screen`: menjalankan
   `node scripts/db-local.mjs` di **path absolut worktree** Tech Lead, interaktif, sandi tersembunyi; `--print-sql` = pratinjau). Exit 4: COO menanyakan pengguna dulu. Setelah "sudah", Tech Lead
   **tidak** mengulang mode agent; verifikasi lewat kode proyek (migrasi/tes memuat `.env`).
4. Tanpa MySQL lokal → tes non-DB jalan terus; kriteria ber-database "belum terverifikasi", bukan `[Terhambat]`.
   Hasil dicatat di *Database lokal* `templat/intake-proyek.md` (tanpa sandi/DSN).
5. **Serah**: `.env` (gitignored, tidak ikut merge) disalin ke checkout utama bila di sana **belum ada**, tanpa
   dibaca dan tanpa menimpa (`agents/tech-lead.md` › Serah ke branch utama).
6. Uji penolakan penjaga skrip: pada fungsi penjaga, bukan dengan menjalankan skrip (`protokol.md` › Ruang kerja Engineering).

