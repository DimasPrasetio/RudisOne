# Pesan gerbang persetujuan — kata-kata baku untuk pengguna
<!-- Dipakai COO untuk empat gerbang skill rudis-sdlc (Inisiasi, Rancangan, Rilis, Penerapan). Bahasa awam untuk semua pengguna
     (agents/coo.md › Bahasa awam ke pengguna): dampak & pilihan dulu, istilah teknis hanya di kurung dan tidak pernah inti
     pertanyaan. Isi <…> diganti COO. Satu pesan per gerbang, dengan rekomendasi COO. Kartu efek untuk aksi yang tidak bisa
     dibatalkan: agents/coo.md › Persetujuan & aksi berisiko. Teks di antara penanda ke-pengguna diperiksa bin/cek-konsistensi.sh
     (kode bahasa-awam). Logika gerbang tidak berubah di sini: hanya kata-katanya. -->

<!-- ke-pengguna -->
> **Persetujuan awal.** Siap mulai membangun <nama aplikasi>? Aplikasi ini untuk <siapa> agar <masalah yang hilang>;
> versi pertama berisi <kemampuan>; dipakai di <HP / desktop> berbahasa <bahasa>; disimpan di folder <folder>. Belum ada
> yang diunggah ke internet — itu baru saya tanyakan bila Anda ingin aplikasinya bisa dibuka orang lain. Anda tidak perlu memasang atau
> menyiapkan apa pun sekarang. Mulai sekarang? (ya / ada yang diubah)
>
> **Persetujuan rancangan.** Rancangan sudah siap. Untuk tiap kemampuan, usulan saya
> (tulis kemampuan dengan contoh nyata, mis. "kasir masuk dengan nama dan sandi masing-masing"): <kemampuan> → <memakai
> bagian jadi milik tim kami yang sudah teruji di banyak aplikasi / bagian jadi lalu disesuaikan / dibuat dari nol>, karena <alasan singkat>. Tampilan: <gaya, warna, 2–3
> pilihan utama>. Setuju, atau ada yang ingin diubah? Rincian teknisnya bisa saya tunjukkan bila Anda mau.
>
> **Persetujuan hasil.** Hasil kerja siap dan sudah diuji (<ringkasan hasil dan hasil tes>). Pilihan: (a) **pasang
> ke komputer ini sekarang** — aplikasinya langsung bisa dipakai dari folder proyek Anda; bila ada masalah, perubahan ini bisa
> ditarik kembali dan folder Anda kembali seperti semula; (b) **lihat dulu** — tidak ada yang berubah di folder Anda sampai
> Anda bilang siap. Pilih a atau b? Menyimpan hasilnya di internet (GitHub) tidak dilakukan sekarang; itu saya tanyakan terpisah. (rincian: merge ke cabang utama, commit, push — tiap langkah tetap minta izin sendiri)
>
> **Persetujuan pemasangan.** <Nama aplikasi> akan dipasang ke server (komputer di internet yang menjalankan aplikasi terus-menerus) supaya bisa dipakai orang, di alamat <alamat web>. Yang bisa membukanya: <siapa saja / hanya yang punya akun>; data <jenis data, mis. penjualan> <siapa yang bisa melihat>.
> Biaya: <tidak ada biaya tambahan / perkiraan biaya dan siapa yang menanggung>. Ini langkah yang berbeda dari tahap awal: sekarang saya meminta izin
> agar aplikasi bisa dibuka lewat internet.
> Yang terjadi: <tempat data aplikasi dibuat, alamat web didaftarkan, sambungan aman diaktifkan>. Aplikasi lain di server
> tidak tersentuh. Bila ada masalah, aplikasi bisa dikembalikan ke versi sebelumnya dalam ± <X> menit. Pasang sekarang? (ya / tidak)
> (rincian teknis: <rencana persis dari tim server, port, cara mengembalikan>)
<!-- /ke-pengguna -->
