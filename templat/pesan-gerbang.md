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

## Database lokal — kata-kata baku (dipilih dari `reason:` di keluaran `node scripts/db-local.mjs --password-box --lang id`)
<!-- Aturan pemilihan: agents/coo.md › Persetujuan & aksi berisiko. Sandi tidak pernah ditanyakan lewat
     kata-kata: hanya kotak di layar (pesan-awal) atau Terminal (pesan-tanpa-layar). Klaim pesan-nama-ada dicocokkan dengan db-local.mjs: database yang ada dipakai
     apa adanya (CREATE … IF NOT EXISTS, tanpa DROP/kosongkan), sandi akun <slug>_dev diganti (ALTER USER). -->

<!-- ke-pengguna -->
> **pesan-awal (sebelum dijalankan).** Saya sedang menyiapkan penyimpanan data aplikasi di komputer Anda. Ini hanya sekali, sekitar satu menit.
>
> - Mungkin muncul kotak kecil di layar yang meminta sandi MySQL (program penyimpan data). Kalau muncul, ketik sandinya lalu klik OK. Sandi tidak masuk ke percakapan ini dan tidak disimpan.
> - Kalau tidak muncul kotak, tunggu saja; saya kabari begitu selesai.
> - Tidak tahu sandinya? Itu wajar, banyak yang tidak tahu (biasanya dibuat teknisi saat komputer dipasang). Ketik "tidak tahu" dan saya bantu.
>
> **pesan-siap (berhasil).** Penyimpanan data aplikasi sudah siap, dan tidak ada data toko Anda yang berubah. Anda tidak perlu melakukan apa-apa lagi; saya lanjutkan pekerjaan berikutnya.
>
> **pesan-mysql-mati.** Penyimpanan data belum bisa disiapkan karena MySQL (program penyimpan data) belum menyala di komputer Anda. Komputer dan data Anda aman. Yang perlu dilakukan:
>
> 1. Cari ikon bernama Laragon atau XAMPP (salah satu saja). Di Windows, lihat di layar atau di panah kecil dekat jam di pojok kanan bawah; di Mac, lihat di bagian atas layar.
> 2. Buka, lalu klik tombol "Start All". Kalau tombolnya berubah jadi "Stop", berarti sudah menyala.
> 3. Ketik "sudah" di sini.
>
> Tidak ketemu ikonnya? Ketik "tidak ketemu" dan saya tuntun langkah demi langkah, atau tanyakan ke orang yang memasang komputer ini.
>
> **pesan-batal-kotak (kotak sandi ditutup).** Kotak sandi tadi tertutup sebelum diisi (tidak apa-apa, bisa tidak sengaja), jadi penyimpanan data belum disiapkan. Tidak ada yang berubah di komputer Anda.
>
> - Ketik "ulangi" untuk memunculkan kotaknya lagi.
> - Ketik "tidak tahu" kalau Anda tidak tahu sandinya; saya bantu cari jalan keluar.
>
> **pesan-batal-sandi (sandi salah).** Sandi yang diketik salah tiga kali, jadi penyimpanan data belum disiapkan. Tidak ada yang rusak dan Anda boleh mencoba lagi.
>
> - Ketik "ulangi" kalau Anda ingat sandi yang benar.
> - Ketik "tidak tahu", lalu saya carikan cara mengatur ulang sandinya atau saya siapkan pesan untuk diteruskan ke teknisi Anda.
>
> **pesan-tanpa-layar (kotak sandi tidak bisa muncul).** Komputer ini sedang tidak bisa menampilkan kotak sandi (bukan karena rusak, dan tidak ada yang berubah). Ada dua cara, pilih salah satu:
>
> - **Paling mudah:** ketik "teknisi". Saya siapkan pesan singkat untuk Anda teruskan ke teknisi Anda; mereka yang menjalankannya.
> - **Anda sendiri:** ketik "tolong pandu". Saya tuntun satu langkah demi satu: Anda membuka aplikasi Terminal (jendela untuk mengetik perintah), menempel satu baris dari saya, lalu mengetik sandi MySQL dan menekan Enter. Huruf sandi memang tidak tampak saat diketik; itu normal, bukan macet.
>
> **pesan-nama-ada.** Aplikasi <nama aplikasi> sepertinya pernah disiapkan di komputer ini: penyimpanan datanya sudah ada.
>
> - **A (saran saya, paling aman):** saya pakai penyimpanan yang sudah ada. Tidak ada yang dihapus atau diubah. Saya hanya perlu menemukan berkas aplikasi lama yang dulu menyiapkannya; kalau tidak ketemu, saya kabari.
> - **B:** pilihan lain yang lebih berisiko; ketik "jelaskan B" bila ingin tahu.
> - Ragu? Ketik "tidak tahu" dan saya bantu memutuskan.
>
> **pesan-nama-ada-b (hanya bila diminta).** Kalau Anda pilih B, aplikasi lain di komputer ini yang memakai penyimpanan data yang sama akan berhenti jalan, sampai pengaturannya disalin ulang. Data lama tetap aman: tidak dihapus dan tidak dikosongkan. Kalau Anda tidak yakin ada aplikasi lain yang memakainya, pilih A. Untuk B, Anda perlu mengetik sandi MySQL di aplikasi Terminal, dan saya tuntun langkahnya. Ketik "A" (aman) atau "B".
<!-- /ke-pengguna -->

<!-- Rincian teknis untuk COO bila pengguna memintanya (tidak ikut di pesan utama):
     Rancangan: tabel perakitan modul (templat/tabel-perakitan.md). Hasil: merge --no-ff refs/heads/rudis/<ID> ke cabang utama
     (atau --squash), commit, lalu push/PR terpisah — tiap aksi minta izin sendiri (agents/tech-lead.md › Serah ke branch utama).
     Pemasangan: rencana persis + port + rollback dari Head of IT Operations (kartu efek di agents/coo.md). -->
