# Alur tugas utama — <ID> · <aplikasi / fitur>
<!-- Disusun Business Systems Analyst di langkah Analisis Jalur Rakit Paralel, dari templat/riset-alur.md (Research
     Analyst, paralel) dan pemahaman bersama. Draf di handoff/<ID>/alur-tugas.md. Tiga pemakai: (1) satu baris per tugas
     masuk paket Persetujuan Rancangan — tanpa keputusan tambahan; (2) bagian brief Software Engineer web yang relevan
     dengan foldernya; (3) kriteria uji templat/uji-alur.md di gerbang akhir. Cakupan: aplikasi baru dan fitur yang
     menambah/mengubah layar; perbaikan bug tanpa perubahan alur tidak memakai berkas ini. -->

Business Systems Analyst · <YYYY-MM-DD> · Riset alur: <path draf/pustaka + tanggal> · Perangkat: HP (lebar 390 px) dan komputer (1440 px)

## Ringkasan untuk Persetujuan Rancangan
<!-- ke-pengguna -->
Satu baris per tugas, bahasa sehari-hari: siapa melakukan apa, berapa langkah, apa yang dilihatnya saat berhasil. Tidak
memuat pilihan baru untuk pengguna — hanya memperlihatkan alur yang akan dibangun.

| Peran | Tugas | Alur singkat (bahasa pengguna) |
|---|---|---|
| <petugas gudang> | <Barang keluar> | <pilih barang, isi jumlah, simpan — 3 langkah; berhasil: muncul "Tersimpan" dan stok baru> |
<!-- /ke-pengguna -->

## Aturan bersama (opsional; dirujuk tiap tugas sebagai G1, G2, …)
Aturan yang berlaku lintas tugas (pola pesan galat, format angka/tanggal, istilah, aksi berisiko, HP) ditulis **sekali** di sini
dan dirujuk dari tiap tugas, supaya subbagian di bawah tidak berulang. **Kode sumber**: `A#` = aturan di riset alur; `N#` = heuristik
Nielsen; `K#` = kriteria selesai pemahaman bersama; `R#` = aturan di spek ringkas/aturan bisnis tabel perakitan (`templat/tabel-perakitan.md`; kode `R` berbeda dari `A#` riset agar tidak
tertukar); "keputusan BSA" = ditetapkan BSA tanpa sumber riset (ditandai, ditulis juga di Pertanyaan terbuka). Bila aturan riset
bertentangan dengan kriteria pemahaman bersama, **pemahaman menang** — tulis pertentangannya di Pertanyaan terbuka.
Alur yang **disalin dari pustaka** (jalur ekspres) memakai kode berkas pustaka apa adanya (`A#`, `N#`); sebutkan berkasnya di baris kepala.

| Kode | Aturan | Sumber |
|---|---|---|
| G1 | <Pesan galat menyebut apa yang salah dan cara memperbaikinya, tanpa kode/singkatan teknis> | <A#, N9> |
| G2 | <Pesan galat muncul dekat isian yang bermasalah, bukan hanya di bagian atas halaman> | <A#, N5> |
| G3 | <Angka jumlah tanpa nol desimal yang tidak perlu (7, bukan 7,0000); tanggal 02/11/2026> | <A#, N2> |

## Tugas inti (uji cepat)
<!-- Ditetapkan BSA di sini, sejak ②b, supaya uji jalan alur CEPAT (bawaan di ⑦) tidak mengarang tugas. Bukan untuk pengguna dan bukan
     keputusan baru: hanya penanda. 1–2 tugas per peran: yang paling sering dipakai ATAU paling berisiko (mengubah data/stok/uang,
     aksi tak bisa diurungkan, izin). Tiap tugas inti menyebut 1–2 kasus gagal utama yang pasti diuji. Tugas lain tetap tertulis
     lengkap di bawah dan baru diuji bila pengguna meminta uji penuh. Judul tugas inti di bawah diberi akhiran [inti]. -->
| Peran | Tugas inti | Alasan (paling sering / paling berisiko) | Kasus gagal utama (1–2 dari tabel kasus gagal tugasnya) |
|---|---|---|---|
| <petugas gudang> | <Barang keluar> | <sering + mengubah stok> | <stok kurang; jumlah kosong> |

## <Peran> — <tugas utama n> [inti] (3–5 tugas per peran, dari kriteria selesai pemahaman bersama; tugas inti diberi [inti])

### Alur
- **Layar awal:** <layar tempat tugas dimulai; aksi utama mudah ditemukan di sini>
- **Langkah** (target: ≤ <n> dari layar awal): 1 <…> → 2 <…> → 3 <…>
- **Isian & bawaan:** <isian — bawaan, mis. tanggal = hari ini; jenis papan ketik; satuan> (sumber: <kode sumber>)
- **Berhasil:** <apa yang dilihat pengguna: pesan, perubahan angka, ke layar mana>

### Kasus gagal (teks pesan yang diharapkan)
| Kasus | Pesan (apa yang salah + cara memperbaiki, tanpa kode/singkatan teknis) | Sumber |
|---|---|---|
| <stok kurang> | "<Stok Beras tinggal 20 kg. Kurangi jumlahnya atau tambah stok dulu.>" | <kode sumber> |

### Layar kosong
- <kondisi data kosong> → <teks + arah tindakan, mis. tombol "Tambah barang pertama">

### HP dan komputer
- HP (390 px): <perilaku; tanpa geser horizontal; target sentuh ≥ 44 px; papan ketik angka untuk isian angka>
- Komputer (1440 px): <perilaku>

### Format & istilah
- Angka/tanggal Indonesia (tanpa desimal yang tidak perlu); istilah mengikuti bahasa pengguna di pemahaman bersama:
  <daftar istilah yang dipakai dan yang dihindari>

### Sumber aturan
- <kode sumber: A# / N# / G# / K# / R#> — tiap aturan di atas punya sumber; tanpa sumber = tidak ditulis, kecuali ditandai "keputusan BSA" (dan dicatat di Pertanyaan terbuka)

## Catatan untuk Software Engineer web
Bagian di atas yang relevan dengan folder modul tertentu masuk brief SE pemilik folder itu (satu brief, hanya alur modul
itu). Hal yang sudah ditentukan modul pustaka tidak ditulis ulang; penyesuaian modul pustaka ditandai di tabel perakitan.

## Pertanyaan terbuka
- Entri bertanda "keputusan BSA" atau "pertentangan riset" = pemberitahuan untuk Tech Lead, bukan pertanyaan; tidak dibawa ke pengguna.
- <hanya yang belum bisa diputuskan dari riset; masuk "Pertanyaan terbuka" laporan BSA — bukan keputusan baru bagi pengguna kecuali mengubah hasil>
