# Intake proyek baru — <ID> · <nama aplikasi>
<!-- Gerbang Persetujuan Inisiasi (skill rudis-sdlc › Jalur Aplikasi). Bagian "Ditanyakan ke pengguna" adalah cabang wawancara penyelarasan
     berkedalaman mendalam (skill rudis-grill-me): satu cabang per giliran dengan rekomendasi COO, fakta yang bisa dicari
     tidak ditanyakan. Maksud, kriteria selesai & lingkup ditulis di handoff/<ID>/pemahaman.md; file ini hanya fakta
     teknis intake. Persetujuan ringkasan pemahaman bersama = Persetujuan Inisiasi (tidak ditanyakan dua kali). Bagian
     "Dari IT Operations" diisi System Administrator (read-only). Simpan di handoff/<ID>/intake.md. Tanpa rahasia. -->

Tanggal: YYYY-MM-DD · Perkakas: <keluaran bin/perkakas.sh versi>

## Ditanyakan ke pengguna
| Fakta | Jawaban | Catatan |
|---|---|---|
| Masalah & pengguna aplikasi | <1–3 kalimat> | dasar Analisis |
| Backend | go · nestjs · express | Step 0 skill — wajib, tidak boleh diasumsikan |
| Nama proyek | <nama> | `--name` |
| Folder proyek | `~/Documents/<…>` | dibuat COO |
| Slug app di server | <huruf/angka kecil> | default dari nama; `--slug` |
| Domain | <sub>.<domain di konfigurasi> / menyusul | `--domain` |
| Pemilik GHCR (dan repo) | <owner>/<repo> (bawaan: `github.owner_bawaan` di konfigurasi) | `--ghcr-owner`, `--repo` |
| Cakupan rilis pertama | <daftar kemampuan> | dipecah BSA di Analisis |
| Perangkat utama & bahasa UI | desktop / HP / tablet · Indonesia | dasar riset desain Desain |

## Dari IT Operations (System Administrator, read-only)
| Fakta | Nilai | Sumber |
|---|---|---|
| Port localhost berikutnya | <port> | App registry playbook + `ss -tlnp` |
| Slug belum dipakai | ya / tidak | App registry playbook |
| Catatan server | <kapasitas, app lain> | `bin/server-cek.sh` |

## Persetujuan Inisiasi
- Disetujui pengguna (kesepakatan pemahaman bersama): YYYY-MM-DD HH:MM — "<kutipan persis>"
- Fakta yang dibiarkan menjadi penanda (menyusul): <…>
