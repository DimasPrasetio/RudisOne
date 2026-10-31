# Membangun software (SDLC)

Perkakas resmi pembuat software RudisOne adalah skill **`rudis-monorepo`** (standar arsitektur, scaffold,
deploy standar) dan pustaka **`rudis-modules`** (modul, kit UI, preset). Keduanya tinggal di repo
masing-masing — tidak dibundel — dan `bin/perkakas.sh` memasangnya bila belum ada serta memperbaruinya di setiap
`/rudisone` (tanpa pernah menimpa perubahanmu di repo sumber, dan ditunda selama tugas Engineering berjalan).
skill `rudis-sdlc` memetakan tujuh fase (Inisiasi, Analisis, Desain, Konstruksi, Pengujian, Rilis, Operasi) ke jabatan dan
menetapkan empat gerbang persetujuanmu:

| Gerbang | Yang kamu putuskan |
|---|---|
| **Persetujuan Inisiasi** | maksud & kriteria selesai, stack, nama & folder, cakupan awal — lewat penyelarasan persepsi (tanpa server) |
| **Persetujuan Rancangan** | tabel perakitan modul + arah desain |
| **Persetujuan Rilis** | serah ke branch utama, commit, push |
| **Persetujuan Penerapan** | fakta deploy (slug, domain, GHCR, konfigurasi server), pendaftaran server & setiap deploy |

Contoh: `/rudisone buatkan aplikasi booking lapangan`.

## Skill luar
Skill luar (docx-neuron, docx/pdf/pptx/xlsx, frontend-design) tidak dibundel: dipasang dari sumber resminya saat
  pertama dibutuhkan lewat `bin/perkakas.sh pastikan <skill>`; keadaannya `bin/perkakas.sh skill` (skill `rudis-perkakas` › Skill luar).
