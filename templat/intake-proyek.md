# Intake proyek baru — <ID> · <nama aplikasi>
<!-- Dua bagian, dua waktu (skill rudis-sdlc › Jalur Aplikasi). Bagian "Inisiasi" adalah cabang wawancara penyelarasan
     berkedalaman mendalam (skill rudis-grill-me): satu cabang per giliran dengan rekomendasi COO, fakta yang bisa dicari
     tidak ditanyakan; persetujuan ringkasan pemahaman bersama = Persetujuan Inisiasi (tidak ditanyakan dua kali). Maksud,
     kriteria selesai & lingkup ditulis di handoff/<ID>/pemahaman.md; file ini hanya fakta teknis. Bagian "Sebelum penerapan
     pertama" diisi HANYA saat pengguna meminta deploy (Persetujuan Penerapan) — di Inisiasi server tidak dicek dan fakta
     deploy dibiarkan menjadi penanda scaffold. Simpan di handoff/<ID>/intake.md. Tanpa rahasia. -->

Tanggal: YYYY-MM-DD · Perkakas: <keluaran bin/perkakas.sh versi>

## Inisiasi — fakta membangun (ditanyakan ke pengguna)
| Fakta | Jawaban | Catatan |
|---|---|---|
| Masalah & pengguna aplikasi | <1–3 kalimat> | dasar Analisis |
| Backend | go · nestjs · express | Step 0 skill — wajib, tidak boleh diasumsikan |
| Nama proyek | <nama> | `--name` (slug bawaan diturunkan dari sini) |
| Folder proyek | `~/Documents/<…>` | dibuat COO |
| Cakupan rilis pertama | <daftar kemampuan> | dipecah BSA di Analisis |
| Perangkat utama & bahasa UI | desktop / HP / tablet · Indonesia | dasar riset desain Desain |

### Persetujuan Inisiasi
- Disetujui pengguna (kesepakatan pemahaman bersama): YYYY-MM-DD HH:MM — "<kutipan persis>"

## Sebelum penerapan pertama — fakta deploy (saat pengguna meminta deploy)
<!-- Sampai bagian ini terisi, scaffold memakai penanda __PLACEHOLDER__ (skill rudis-monorepo › Step 0b); aplikasi tetap
     jalan lokal, deploy.sh menolak jalan. Konfigurasi server belum ada → skill rudis-operasi › Konfigurasi server. -->
| Fakta | Nilai | Dari |
|---|---|---|
| Slug app di server | <huruf/angka kecil> | pengguna (bawaan dari nama); `--slug` |
| Domain | <sub>.<domain di konfigurasi> / menyusul | pengguna; `--domain` |
| Pemilik GHCR (dan repo) | <owner>/<repo> (bawaan: `github.owner_bawaan` di konfigurasi) | pengguna; `--ghcr-owner`, `--repo` |
| Konfigurasi server (`konfigurasi/server.json`) | ada / ditanyakan <tanggal> | `bin/konfig.sh cek` |
| Port localhost berikutnya | <port> | System Administrator (read-only): app registry playbook + `ss -tlnp` |
| Slug belum dipakai | ya / tidak | System Administrator (read-only): app registry playbook |
| Catatan server | <kapasitas, app lain> | System Administrator: `bin/server-cek.sh` |
| Penanda diisi di repo | sha / branch | Tech Lead |
