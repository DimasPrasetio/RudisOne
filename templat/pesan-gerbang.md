# Pesan gerbang persetujuan — kata-kata baku untuk pengguna
<!-- Dipakai COO untuk empat gerbang skill rudis-sdlc (Inisiasi, Rancangan, Rilis, Penerapan). Bahasa awam untuk semua pengguna
     (agents/coo.md › Bahasa awam ke pengguna): dampak & pilihan dulu, istilah teknis hanya di kurung dan tidak pernah inti
     pertanyaan. Isi <…> diganti COO. Satu pesan per gerbang, dengan rekomendasi COO. Kartu efek untuk aksi yang tidak bisa
     dibatalkan: agents/coo.md › Persetujuan & aksi berisiko. Teks di antara penanda ke-pengguna diperiksa bin/cek-konsistensi.sh
     (kode bahasa-awam). Logika gerbang tidak berubah di sini: hanya kata-katanya. -->

<!-- ke-pengguna -->
> **Persetujuan awal.** Siap mulai membangun <nama aplikasi>? Aplikasi ini untuk <siapa> agar <masalah yang hilang>;
> versi pertama berisi <kemampuan>; dipakai di <HP / desktop> berbahasa <bahasa>; disimpan di folder <folder>. Belum ada
> yang diunggah ke internet — itu baru saya tanyakan bila Anda ingin aplikasinya bisa dibuka orang lain. Mulai berarti saya mulai membuat
> berkas aplikasinya di folder itu; Anda tidak perlu memasang atau menyiapkan apa pun. Mulai sekarang? (ya / ada yang diubah)
>
> **Persetujuan rancangan.** Rancangan sudah siap. Untuk tiap kemampuan, usulan saya
> (tulis kemampuan dengan contoh nyata, mis. "kasir masuk dengan nama dan sandi masing-masing"): <kemampuan> → <memakai
> fitur siap pakai buatan kami yang sudah dipakai di banyak aplikasi, lebih cepat dan sudah teruji / memakai fitur siap pakai lalu disesuaikan
> dengan toko Anda / dibuat khusus dari nol>, karena <alasan singkat>. Ini hanya soal cara membuatnya; hasilnya tetap milik Anda. Tampilan: <gaya, warna, 2–3
> pilihan utama>. Setuju, atau ada yang ingin diubah? Rincian teknisnya bisa saya tunjukkan bila Anda mau.
>
> **Persetujuan hasil.** Hasil kerja siap dan sudah diuji (<ringkasan hasil dan hasil tes>). Pilihan: (a) **pasang
> ke komputer ini sekarang** — aplikasinya langsung bisa dipakai dari folder proyek Anda; bila ada masalah, saya kembalikan
> seperti semula dan tidak ada data Anda yang hilang; (b) **tunda dulu** — hasil kerja disimpan terpisah, folder Anda tidak
> berubah sampai Anda bilang siap. Pilih a atau b? Menyimpan hasilnya di internet tidak dilakukan sekarang; itu saya tanyakan
> terpisah. Rincian teknisnya bisa saya tunjukkan bila Anda mau.
>
> **Persetujuan pemasangan.** <Nama aplikasi> akan dipasang ke server (komputer di internet yang menjalankan aplikasi terus-menerus) supaya bisa dipakai orang, di alamat <alamat web>. Yang bisa membukanya: <siapa saja / hanya yang punya akun>; data <jenis data, mis. penjualan> <siapa yang bisa melihat>.
> Biaya: <tidak ada biaya tambahan / perkiraan biaya (termasuk alamat webnya) dan siapa yang menanggung>. Ini langkah yang berbeda dari tahap awal: sekarang saya meminta izin
> agar aplikasi bisa dibuka lewat internet.
> Yang terjadi: <tempat data aplikasi dibuat, alamat web didaftarkan, sambungan aman diaktifkan>. Aplikasi lain di server
> tidak tersentuh. Bila ada masalah, aplikasi bisa dikembalikan ke versi sebelumnya dalam ± <X> menit. Pasang sekarang? (ya / tidak) Rincian teknisnya bisa saya tunjukkan bila Anda mau.
<!-- /ke-pengguna -->

<!-- Rincian teknis untuk COO bila pengguna memintanya (tidak ikut di pesan utama):
     Rancangan: tabel perakitan modul (templat/tabel-perakitan.md). Hasil: merge --no-ff refs/heads/rudis/<ID> ke cabang utama
     (atau --squash), commit, lalu push/PR terpisah — tiap aksi minta izin sendiri (agents/tech-lead.md › Serah ke branch utama).
     Pemasangan: rencana persis + port + rollback dari Head of IT Operations (kartu efek di agents/coo.md). -->
