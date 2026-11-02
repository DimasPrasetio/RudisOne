# Uji jalan alur — <ID> · <aplikasi / fitur>
<!-- Dikerjakan dengan kit templat/uji-alur-kit/ (README.md: salin kit → skrip tipis per aplikasi → jalankan → isi templat ini dari hasil/ringkasan.md).
     Disusun Business Systems Analyst di gerbang akhir Jalur Rakit Paralel, paralel dengan tinjauan kode, setelah
     `npm run gate` lulus (agents/business-systems-analyst.md › Uji jalan alur). Disimpan handoff/<ID>/uji-alur.md;
     skrip dan tangkapan layar di handoff/<ID>/uji-alur/ (bukan di repo proyek). Bukan uji pengguna sungguhan:
     memperkecil masalah yang jelas; uji oleh petugas asli tetap dianjurkan sebelum Persetujuan Penerapan. Cakupan:
     aplikasi baru dan fitur yang menambah/mengubah layar. -->

Business Systems Analyst · <YYYY-MM-DD> · sha: <sha HEAD rudis/<ID> yang diuji> · Alur tugas: handoff/<ID>/alur-tugas.md

**Putusan: LULUS | PERLU PERBAIKAN** (untuk sha di atas; putaran uji ulang ditambahkan di bawah, putusan terakhir menang)

Waktu uji: mulai <jam> · selesai <jam> · durasi <mnt> · pecahan: baca <mnt> / tulis skrip <mnt> / eksekusi kit (<n> putaran × <mnt>) <mnt> / perbaiki skrip <mnt> / menilai + menulis <mnt> (anggaran: aplikasi pertama ≈ 25 mnt (sasaran, belum terukur; ukur nyata dengan kit awal ≈ 52 mnt), uji ulang sebatas butir yang berubah ± 5 mnt — lihat agents BSA › Uji jalan alur; bila lewat tulis penyebabnya, jujur, jangan memangkas cakupan demi anggaran)

## Prasyarat
| Prasyarat | Status | Bukti |
|---|---|---|
| `npm run gate` lulus | <ya/tidak> | <keluaran> |
| Aplikasi berjalan lokal (API + web) | <ya/tidak> | <alamat, perintah> |
| Akun tiap peran tersedia (seed lokal) | <ya/tidak> | <peran: email> |
| Database lokal siap | <ya/tidak> | <… — tidak siap: alur yang butuh data = belum terverifikasi> |

## Matriks peran × tugas × perangkat
Tiap sel: LULUS / SELESAI-MENYIMPANG (tugas bisa diselesaikan tetapi tidak sesuai `alur-tugas.md` → nomor temuan) / GAGAL (tugas tidak bisa diselesaikan → nomor temuan) / BELUM TERVERIFIKASI (+ alasan), dengan tautan tangkapan layar per langkah.
| Peran | Tugas | HP (iPhone 13, 390 px) | Komputer (1440×900) | Kasus gagal dipicu | Layar kosong dibuka |
|---|---|---|---|---|---|
| <peran> | <tugas> | <LULUS · uji-alur/…png> | <LULUS · …> | <n dari n> | <ya> |

## Daftar periksa bersumber
Tiap butir merujuk sumbernya (kode di `alur-tugas.md`: A# riset alur, G# aturan bersama, K# kriteria pemahaman, R# aturan bisnis, atau N# heuristik kegunaan Nielsen). Hasil: ✓ / ✗ (→ temuan) / —.
| # | Butir | Sumber | Hasil |
|---|---|---|---|
| 1a | Jumlah langkah ≤ target di `alur-tugas.md` | <kode sumber> | |
| 1b | Bawaan isian (mis. tanggal hari ini) dan umpan balik berhasil sesuai `alur-tugas.md` | <kode sumber> | |
| 2 | Pesan galat menyebut apa yang salah dan cara memperbaikinya, bahasa sehari-hari, tanpa kode atau singkatan teknis | <kode sumber> | |
| 3 | Format angka dan tanggal Indonesia, tanpa desimal yang tidak perlu (mis. `999,0000` = gagal) | <kode sumber> | |
| 4 | Layar kosong memberi arah tindakan; aksi utama mudah ditemukan; aksi berisiko dikonfirmasi | <kode sumber> | |
| 5a | HP: tanpa geser horizontal (juga di komputer dengan isi panjang) | <kode sumber> | |
| 5b | HP: target sentuh aksi utama dan menu ≥ 44 px | <kode sumber> | |
| 5c | HP: papan ketik angka untuk isian angka | <kode sumber> | |
| 6 | Istilah konsisten dengan bahasa pengguna (pemahaman bersama) | <kode sumber> | |
| 7 | Aksesibilitas dasar: label isian, kontras, urutan fokus keyboard | <kode sumber> | |
| 8 | 10 heuristik kegunaan Nielsen sebagai payung (kesesuaian dengan dunia nyata, kontrol pengguna, pencegahan galat, …) | Nielsen | |

## Terverifikasi benar
Hal penting yang diuji dan **benar** (mis. stok berubah tepat, penolakan tidak mengubah data, peran terbatas tidak melihat aksi admin), agar putusan PERLU PERBAIKAN tidak terbaca seolah semuanya rusak. Satu baris per hal + tangkapan.

## Temuan
Tingkat: **kritis** (tugas tidak bisa diselesaikan / data bisa salah) · **sedang** (bisa selesai tetapi membingungkan, pesan tidak jelas) · **kosmetik**.
| # | Tingkat | Aturan/heuristik yang dilanggar | Apa yang terlihat (tangkapan) | Usulan | Jenis tindak lanjut |
|---|---|---|---|---|---|
| 1 | <kritis/sedang/kosmetik> | <kode sumber: A# / G# / K# / R# / N#> | <uji-alur/…png> | <perbaikan konkret> | <perbaikan (folder pemilik) / mengubah alur → keputusan pengguna / modul pustaka → usulan Jalur Platform / daftar> |

## Tindak lanjut
- Kritis dan sedang yang tidak mengubah alur → putaran perbaikan gerbang akhir (pemilik folder, maks. 2 putaran), lalu BSA
  menguji ulang **hanya** butir itu; hasil ditambahkan di bawah.
- Perbaikan yang mengubah alur yang sudah disetujui → bagian keputusan laporan (dampak dulu, lalu `Rincian:`).
- Kosmetik → daftar di laporan, dikerjakan bila murah. Temuan di modul pustaka → usulan perbaikan pustaka (tugas terpisah), tidak diperbaiki diam-diam.

## Putaran uji ulang
### Putaran <n> — sha <sha>
- Butir yang diuji ulang: <nomor temuan> → <hasil + tangkapan>
- Putusan: <LULUS | PERLU PERBAIKAN>

## Belum terverifikasi
- <alur yang tidak bisa dijalankan + alasan (database, perangkat fisik, …)>
