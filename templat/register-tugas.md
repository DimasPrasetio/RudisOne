# Register tugas — COO
<!-- Sumber kebenaran: ~/Documents/Neuron/ai-agent/RudisOne/handoff/register-tugas.json (per device, tidak di-commit).
     register-tugas.md DIBANGKITKAN dari JSON itu — jangan diedit tangan; ubah lewat bin/register.sh:
       tambah --judul … [--id baru|T-…] [--folder --divisi --pemilik --prioritas --status --fase --kunci a,b --bergantung x --perkakas]
       ubah <ID> --<kolom> <nilai> (… --status selesai --bukti …) · tampil [--json] [--semua] · kunci-cek <ID> | --kunci a,b
       validasi · bangkitkan · rapikan (buang selesai/dibatalkan > 14 hari)
     Setiap perintah tulis memegang kunci berkas (register-tugas.json.lock), menulis atomik, lalu membangkitkan ulang MD ini.
     Migrasi satu kali dari register MD tulisan tangan: bin/register.sh impor (dijalankan COO; MD lama dicadangkan ke
     register-tugas.md.sebelum-impor). Kantor membaca JSON bila ada, selain itu tabel "Aktif" MD lama.

     Arti kolom. Status: penyelarasan (COO ↔ pengguna, belum ada brief; Pemilik COO; kolom yang belum jelas = ?, hanya
     selama penyelarasan) · baru · antre · berjalan · diparkir · ditinjau · terhambat · selesai · dibatalkan.
     Prioritas: segera · tinggi · normal. ID: T-YYYYMMDD-n (sub-tugas T-YYYYMMDD-n.k). Kunci = sumber daya yang tidak
     boleh disentuh dua tugas sekaligus (repo:area/berkas, branch, prod-db:<app>, deploy:<app>, dok:<path>); kunci-cek
     menganggap repo:x bentrok dengan repo:x:a (awalan pada batas ":" atau "/"). Fase = fase SDLC tugas Engineering
     (Inisiasi … Operasi, skill rudis-sdlc) atau —. Perkakas = keluaran `bin/perkakas.sh versi` saat tugas Engineering
     dimulai/dilanjutkan, — bila tugas tidak memakai perkakas rudis (tugas berjalan selain "—" menunda pembaruan
     perkakas). Tugas selesai/dibatalkan pindah ke tabel "Selesai" dengan sendirinya (selesai_pada diisi).

     Contoh format tabel yang dibangkitkan (judul kolom tetap — Kantor dan alat lain membacanya): -->

## Aktif

| ID | Tugas | Folder | Divisi | Pemilik | Prioritas | Status | Fase | Kunci | Bergantung | Perkakas | Diperbarui |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-YYYYMMDD-1 | <ringkas> | `~/Documents/<proyek>` | Engineering · Tim 1 | Tech Lead · <proyek> | normal | berjalan | Konstruksi | repo:<proyek>:modules/pos | — | rudis@<sha> lib@<sha> | YYYY-MM-DD HH:MM |

## Selesai

| ID | Tanggal | Tugas | Folder | Pemilik | Status | Perkakas | Bukti / hasil |
|---|---|---|---|---|---|---|---|
