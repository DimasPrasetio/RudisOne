# Intake proyek baru — <ID> · <nama aplikasi>
<!-- Dua bagian, dua waktu (skill rudis-sdlc › Jalur Aplikasi). Bagian "Inisiasi" adalah cabang wawancara penyelarasan
     berkedalaman mendalam (skill rudis-grill-me): satu cabang per giliran dengan rekomendasi COO, fakta yang bisa dicari
     tidak ditanyakan; persetujuan ringkasan pemahaman bersama = Persetujuan Inisiasi (tidak ditanyakan dua kali). Maksud,
     kriteria selesai & lingkup ditulis di handoff/<ID>/pemahaman.md; file ini hanya fakta teknis. Bagian "Sebelum penerapan
     pertama" diisi HANYA saat pengguna meminta deploy (Persetujuan Penerapan) — di Inisiasi server tidak dicek dan fakta
     deploy dibiarkan menjadi penanda scaffold. Simpan di handoff/<ID>/intake.md. Tanpa rahasia.
     BAHASA: kolom "Pertanyaan ke pengguna" ditulis dalam bahasa awam (agents/coo.md › Bahasa awam ke pengguna); kolom
     lain tetap teknis untuk agent. Fakta yang hanya dipahami mesin (slug, pemilik GHCR, port, nama database) TIDAK
     ditanyakan: diturunkan/diberi bawaan oleh COO atau Tech Lead dan dicatat di bagian "Diturunkan". -->

Tanggal: YYYY-MM-DD · Perkakas: <keluaran bin/perkakas.sh versi>

## Inisiasi — fakta membangun (ditanyakan ke pengguna, dalam bahasa awam)
| Pertanyaan ke pengguna | Jawaban | Fakta teknis & catatan |
|---|---|---|
| "Aplikasi ini untuk siapa, dan masalah apa yang ingin dihilangkan?" | <1–3 kalimat> | masalah & pengguna; dasar Analisis |
| "Adakah ketentuan teknologi dari tim Anda? Bila tidak, saya pilihkan yang paling umum." | <ketentuan / "terserah" → rekomendasi COO> | backend go · nestjs · express — Step 0 skill, wajib eksplisit; jawaban "terserah" dicatat sebagai asumsi yang disetujui |
| "Mau diberi nama apa aplikasinya?" | <nama> | `--name` (slug diturunkan, tidak ditanyakan) |
| "Hasilnya mau disimpan di folder mana di komputer ini?" | <folder>; bawaan `~/Documents/<nama>` | dibuat COO |
| "Apa saja yang harus bisa dilakukan aplikasi di versi pertama?" | <daftar kemampuan> | cakupan rilis pertama; dipecah BSA di Analisis |
| "Dipakai di perangkat apa, dan bahasa tampilannya apa?" | HP / komputer / tablet · Indonesia | dasar riset desain Desain |

### Diturunkan (tidak ditanyakan ke pengguna)
| Fakta | Nilai | Dari |
|---|---|---|
| Slug aplikasi | <huruf/angka kecil> | nama aplikasi, oleh COO |
| Nama database lokal & akun | `<slug>_db` · `<slug>_test` · `<slug>_dev` | slug, oleh Tech Lead |
| Pemilik paket GHCR/repo | bawaan `github.owner_bawaan` | konfigurasi device; ditanyakan hanya bila tidak ada |

### Persetujuan Inisiasi
- Disetujui pengguna (kesepakatan pemahaman bersama): YYYY-MM-DD HH:MM — "<kutipan persis>"

## Database lokal — Konstruksi (diisi dari laporan Tech Lead, tidak ditanyakan ke pengguna)
<!-- skill rudis-sdlc › `.env` & database lokal. Izin tetap bawaan (agent menyiapkannya
     sendiri) — hanya localhost, hanya database proyek ini, tanpa hapus data. TANPA sandi/DSN di berkas ini. -->
| Fakta | Nilai | Catatan |
|---|---|---|
| MySQL lokal | <jenis (layanan OS / Docker / XAMPP/Laragon) · versi dari `SELECT VERSION()` oleh skrip> / tidak ada | tidak ada → tes ber-database "belum terverifikasi" |
| Database & akun proyek | `<slug>_db`, `<slug>_test`, `<slug>_dev@127.0.0.1` — siap YYYY-MM-DD, login akun proyek berhasil | Tech Lead: `node scripts/db-local.mjs --admin-password-empty` (izin tetap) |
| Perlu langkah pengguna? | tidak / exit 3 (root bersandi, MySQL tidak menjawab) → pengguna menjalankan `node scripts/db-local.mjs` (interaktif) / exit 4 (`<slug>_*` sudah ada) → keputusan pengguna dulu; "sudah" YYYY-MM-DD | satu langkah, diteruskan COO persis |
| `.env` lokal | lengkap tanpa placeholder (`node scripts/env-local.mjs`); login awal lokal: email `admin@example.com`, sandi `admin123`, nama `admin` | hanya lokal — `deploy.sh` preflight menolaknya (juga `admin@gmail.com` proyek lama) |

## Sebelum penerapan pertama — fakta deploy (saat pengguna meminta deploy)
<!-- Sampai bagian ini terisi, scaffold memakai penanda __…__ (mis. __HOST_PORT__, __GHCR_OWNER__; skill rudis-monorepo › Step 0b); aplikasi tetap
     jalan lokal, deploy.sh menolak jalan. Konfigurasi server belum ada → skill rudis-operasi › Konfigurasi server. -->
| Fakta | Nilai | Dari |
|---|---|---|
| Slug app di server | <huruf/angka kecil> | diturunkan dari nama aplikasi (tidak ditanyakan); `--slug` |
| Domain | <sub>.<domain di konfigurasi> / menyusul | pengguna, ditanyakan sebagai "Aplikasi mau dibuka di alamat web apa? Bila belum tahu, saya usulkan <nama>.<domain Anda>"; `--domain` |
| Pemilik GHCR (dan repo) | <owner>/<repo> (bawaan: `github.owner_bawaan` di konfigurasi) | bawaan; ditanyakan ("akun GitHub mana yang dipakai?") hanya bila bawaan tidak ada; `--ghcr-owner`, `--repo` |
| Konfigurasi server (`konfigurasi/server.json`) | ada / ditanyakan <tanggal> | `bin/konfig.sh cek` |
| Port localhost berikutnya | <port> | System Administrator (read-only): app registry playbook + `ss -tlnp` |
| Slug belum dipakai | ya / tidak | System Administrator (read-only): app registry playbook |
| Catatan server | <kapasitas, app lain> | System Administrator: `bin/server-cek.sh` |
| Penanda diisi di repo | sha / branch | Tech Lead |
