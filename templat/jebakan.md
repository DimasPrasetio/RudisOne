# Jebakan <nama proyek>
<!-- Daftar jebakan proyek ini: kegagalan yang pernah terjadi di sini dan bisa terulang. Dibaca Tech Lead saat memulai tugas
     di proyek ini (`bin/jebakan.sh baca <folder>`), dimasukkan ke `Hal rawan:` brief SE & peninjau, dan diperbarui sebelum
     melapor (agents/tech-lead.md › Alur tugas). Letak: `.rudisone/jebakan.md` di repo proyek standar Rudis, atau
     `catatan/jebakan/<nama-repo>.md` di komputer ini untuk proyek lama/klien/stack lain (bin/jebakan.mjs › letakJebakan).
     Daftar per device diberi baris `repo: <path checkout utama>` di bawah judul (mengikatnya ke satu repo); bibit per device
     juga baris `pindah: repo`. Kedua baris itu dibuang saat isinya dipindah ke repo.

     Satu butir per jebakan, satu baris:
       - YYYY-MM-DD · kena N · <jebakan> → <cara menghindari> · sumber: <sha/ID> [· diperiksa: <tes/pemeriksa>]
     - Tanggal = terakhir terbukti (kena lagi atau dipastikan masih berlaku); kena = jumlah tugas yang terkena.
     - Kena lagi → naikkan N dan tanggalnya, jangan menambah butir kembar.
     - kena ≥ 2 tanpa `diperiksa:` → usulkan pemeriksaan otomatis (tes/pemeriksa) di laporan; dibangun hanya bila tidak
       menambah prompt izin atau salah tangkap. Sudah dibangun → `diperiksa: <path tes>`; tidak layak →
       `diperiksa: — (<alasan>)`.
     - Batas 10 butir / 5.000 byte; butir yang tidak terbukti > 180 hari → buang bila sebabnya sudah hilang.
     - Tanpa rahasia, tanpa instruksi, tanpa data production. Pelajaran yang berlaku di semua proyek masuk
       catatan/<peran>.md, bukan di sini. -->
