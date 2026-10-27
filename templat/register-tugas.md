# Register tugas — COO
<!-- Salin ke ~/Documents/Neuron/ai-agent/RudisOne/handoff/register-tugas.md (per device, tidak di-commit). Kantor membaca tabel "Aktif"
     untuk papan "Tugas berjalan", jadi pertahankan judul kolom. Perbarui setiap brief, [Antre], [Diparkir],
     dan laporan. Status: penyelarasan (COO ↔ pengguna, belum ada brief; Pemilik COO; kolom
     yang belum jelas = ?) · baru · antre · berjalan · diparkir · ditinjau · terhambat · selesai · dibatalkan.
     Prioritas: segera · tinggi · normal. Kunci = sumber daya yang tidak boleh disentuh dua tugas sekaligus
     (repo:area/berkas, branch, prod-db:<app>, deploy:<app>, dok:<path>). Fase = fase SDLC tugas Engineering
     (Inisiasi … Operasi, sdlc.md) atau —. Perkakas = keluaran `bin/perkakas.sh versi` saat tugas Engineering
     dimulai/dilanjutkan, — bila tugas tidak memakai perkakas rudis (tugas berjalan selain "—" menunda
     pembaruan perkakas). Pindahkan baris selesai/dibatalkan ke tabel "Selesai"; hapus yang lebih dari 14 hari. -->

## Aktif

| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Fase | Kunci | Bergantung | Perkakas | Diperbarui |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-YYYYMMDD-1 | <ringkas> | `~/Documents/<proyek>` | Engineering · Tim 1 | Tech Lead · <proyek> | normal | berjalan | Konstruksi | repo:<proyek>:modules/pos | — | rudis@<sha> lib@<sha> | YYYY-MM-DD HH:MM |

## Selesai

| ID | Tanggal | Tugas | Folder | Pemilik | Status | Perkakas | Bukti / hasil |
|---|---|---|---|---|---|---|---|
