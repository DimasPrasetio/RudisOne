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
> **pesan-awal (sebelum dijalankan).** Saya sedang menyiapkan tempat penyimpanan data aplikasi di komputer Anda. Ini hanya sekali dan
> sekitar satu menit. Kalau muncul kotak kecil di layar yang meminta sandi MySQL (program penyimpan data; sandinya dibuat saat program itu
> dipasang, biasanya oleh teknisi), ketik sandinya di kotak itu lalu klik OK — sandi tidak masuk ke percakapan ini dan tidak disimpan.
> Kalau tidak ada kotak, Anda tidak perlu berbuat apa-apa. Tidak tahu sandinya? Ketik "tidak tahu" dan saya bantu mencari jalan keluar.
>
> **pesan-siap (berhasil).** Tempat penyimpanan data aplikasi sudah siap. Anda tidak perlu melakukan apa-apa lagi; saya lanjutkan
> pekerjaan berikutnya.
>
> **pesan-mysql-mati.** Tempat penyimpanan data belum bisa disiapkan karena MySQL (program penyimpan data) belum menyala di komputer
> Anda. Komputer dan data Anda aman. Cari ikon Laragon atau XAMPP (salah satu saja) di layar; kalau tidak kelihatan, lihat di panah kecil
> dekat jam di pojok kanan bawah. Buka, lalu klik tombol "Start" atau "Start All", dan ketik "sudah". Kalau tidak ada ikonnya, ketik
> "tidak ketemu" dan saya tuntun langkah demi langkah — atau tanyakan ke orang yang memasang komputer ini.
>
> **pesan-batal-kotak (kotak sandi ditutup).** Tempat penyimpanan data belum disiapkan karena kotak sandi tadi ditutup sebelum diisi.
> Tidak ada yang berubah di komputer Anda. Ketik "ulangi" untuk memunculkan kotaknya lagi, atau "tidak tahu" kalau Anda tidak tahu
> sandinya — saya bantu cari jalan keluar.
>
> **pesan-batal-sandi (sandi tidak cocok).** Tempat penyimpanan data belum disiapkan karena sandi yang diketik tidak cocok tiga kali.
> Tenang: tidak ada yang terkunci dan tidak ada yang berubah di komputer Anda. Ketik "ulangi" kalau Anda ingat sandi yang benar, atau
> "tidak tahu" — lalu saya jelaskan cara mencari sandinya atau minta teknisi Anda membantu.
>
> **pesan-tanpa-layar (kotak sandi tidak bisa muncul).** Kotak sandi tidak bisa muncul di komputer ini, jadi langkah ini perlu dilakukan
> dengan cara lain. Tidak ada yang rusak dan tidak ada yang berubah. Pilihan: ketik "tolong pandu" — saya beri satu baris yang tinggal
> disalin dan ditempel di aplikasi Terminal (jendela untuk mengetik perintah; di Mac namanya "Terminal", di Windows "PowerShell"),
> lalu Anda mengetik sandi MySQL dan menekan Enter (huruf sandi memang tidak tampak saat diketik; itu normal, bukan macet) — atau
> ketik "teknisi" kalau Anda lebih suka meminta teknisi menjalankannya, saya siapkan pesan untuk diteruskan ke mereka.
>
> **pesan-nama-ada.** Di komputer ini sudah ada tempat penyimpanan data dengan nama yang sama untuk aplikasi <nama aplikasi> (mungkin
> dari percobaan sebelumnya). Saya belum menyentuhnya. Saran saya: ketik **A**, yaitu memakai yang sudah ada tanpa mengubah apa pun
> (saya salin catatan cara aplikasi tersambung ke sana dari folder lama; hanya bisa kalau folder lamanya masih ada). Pilihan **B** juga
> ada, tetapi bisa membuat aplikasi lain yang memakai penyimpanan itu berhenti sementara — ketik "jelaskan B" bila ingin tahu. Tidak
> yakin, atau folder lamanya sudah tidak ada? Ketik "tidak tahu" dan saya bantu memutuskan.
>
> **pesan-nama-ada-b (hanya bila diminta).** Pilihan B: aplikasi ini tetap memakai tempat penyimpanan data yang sudah ada, tetapi kunci
> aksesnya (sandi akun aplikasi) diganti dengan yang baru. Data lama tidak dihapus dan tidak dikosongkan; isinya tetap ada, dan
> bagian milik aplikasi ini ditambahkan di sebelahnya. Akibatnya, aplikasi atau folder lain yang memakai penyimpanan itu berhenti
> jalan sampai catatan aksesnya disalin ulang. Untuk B Anda mengetik sandi MySQL di Terminal; saya tuntun. Ketik "B" untuk lanjut,
> atau "A" untuk pilihan yang aman.
<!-- /ke-pengguna -->

<!-- Rincian teknis untuk COO bila pengguna memintanya (tidak ikut di pesan utama):
     Rancangan: tabel perakitan modul (templat/tabel-perakitan.md). Hasil: merge --no-ff refs/heads/rudis/<ID> ke cabang utama
     (atau --squash), commit, lalu push/PR terpisah — tiap aksi minta izin sendiri (agents/tech-lead.md › Serah ke branch utama).
     Pemasangan: rencana persis + port + rollback dari Head of IT Operations (kartu efek di agents/coo.md). -->
