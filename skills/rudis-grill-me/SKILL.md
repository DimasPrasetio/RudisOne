---
name: rudis-grill-me
description: Wawancara "grill me" untuk menyamakan persepsi antara AI dan pengguna sebelum pekerjaan dimulai — mengurai permintaan menjadi pohon keputusan, mencari sendiri fakta yang bisa dicari, menanyakan cabang yang tersisa satu per satu dengan rekomendasi, menantang jawaban yang kabur atau bertentangan, lalu menutup dengan ringkasan pemahaman bersama yang disetujui pengguna. Dipakai otomatis oleh COO RudisOne (/rudisone) di awal setiap permintaan kerja baru, dan di sesi RudisOne lain bila pengguna meminta "grill me" / "samakan persepsi".
argument-hint: "[rencana atau permintaan yang mau diselaraskan]"
---

# Grill me — samakan persepsi sebelum bekerja

Pekerjaan AI paling sering meleset bukan karena kurang mampu, tetapi karena menebak maksud. Skill ini menutup
celah itu: sebelum ada yang dikerjakan, AI dan pengguna sepakat tentang **hasil yang diinginkan, kriteria selesai,
lingkup, dan batasan** — dibuktikan dengan ringkasan yang disetujui pengguna secara eksplisit.

Tiga jenis ketidakjelasan, tiga cara menutupnya:

| Jenis | Contoh | Ditutup dengan |
|---|---|---|
| **Maksud & selera** — hanya pengguna yang tahu | hasil apa yang dianggap berhasil, apa yang dikorbankan, prioritas, gaya | **ditanyakan** ke pengguna |
| **Fakta** — bisa dicari | apakah fitur X sudah ada, versi yang terpasang, keputusan lama | **dicari sendiri**, jangan ditanyakan |
| **Keahlian** — butuh analisis ahli | arsitektur terbaik, akar penyebab bug, kelayakan finansial | **didelegasikan** ke pelaksana sebagai pertanyaan terbuka, bukan dibebankan ke pengguna |

## 1. Tentukan kedalaman
| Kedalaman | Ciri permintaan | Bentuk |
|---|---|---|
| **Lewati** | Pertanyaan umum, "status tugas", "buka kantor", jawaban/persetujuan untuk tugas yang sudah selaras, atau pengguna berkata "langsung" / "tanpa grill" | Tanpa wawancara. Untuk "langsung": tulis pemahaman dari rekomendasimu sendiri, tunjukkan asumsinya dalam 3–5 baris, lalu jalan — koreksi pengguna menyusul diperlakukan sebagai penyelarasan ulang |
| **Kilat** | Jelas, kecil, mudah dibatalkan (mis. ubah label, deploy sha yang sudah siap) | 0–2 pertanyaan, lalu konfirmasi ringkas |
| **Standar** | Fitur, bug, dokumen, analisis, riset | Telusuri cabang yang masih terbuka — biasanya 3–7 pertanyaan |
| **Mendalam** | Aplikasi/proyek baru, keputusan bisnis, lintas divisi, perubahan production atau yang sulit dibatalkan | Semua cabang peta keputusan, termasuk fakta intake |
| **Darurat** | Insiden SEV1/SEV2, `Prioritas: segera` | Jangan menahan respons: paling banyak 1 pertanyaan penentu, pekerjaan dimulai paralel, sisanya diselaraskan sambil jalan |

Kedalaman boleh naik bila jawaban membuka risiko atau ambiguitas baru, dan turun bila pengguna berkata "cukup".

## 2. Petakan pohon keputusan
Uraikan permintaan menjadi cabang di bawah ini (lewati yang tidak relevan). Tandai tiap cabang: **jelas** (sudah
tersurat di pesan) · **fakta** · **selera/keputusan pengguna** · **keahlian**. Hanya cabang *selera/keputusan
pengguna* yang menjadi pertanyaan.

1. **Hasil** — apa yang ada/berubah saat selesai; untuk siapa; masalah apa yang hilang; *mengapa sekarang*.
2. **Kriteria selesai** — bagaimana pengguna akan menilai berhasil, dalam bentuk yang bisa diamati/dicek.
3. **Lingkup** — termasuk apa, dan yang sengaja **tidak** termasuk.
4. **Batasan** — tenggat & prioritas, yang tidak boleh disentuh, teknologi/anggaran/aturan yang mengikat.
5. **Preferensi** — gaya, bahasa, format hasil, tingkat detail laporan.
6. **Risiko & aksi berisiko** — apa yang terjadi bila salah; apakah ada deploy, push, perubahan production,
   pesan keluar yang diharapkan (kutip permintaannya persis bila ada).
7. **Keterkaitan** — tugas lain yang sedang berjalan, keputusan lama yang relevan.

Urutkan pertanyaan dari **hulu ke hilir**: keputusan yang mengubah cabang lain ditanyakan lebih dulu, dan jawaban
yang menutup beberapa cabang sekaligus diutamakan.

## 3. Cari fakta sendiri dulu
Sebelum menanyakan sesuatu, periksa apakah jawabannya bisa ditemukan: percakapan ini, catatan/ingatan yang
tersedia, dokumentasi proyek (`README`, `CLAUDE.md`, `knowledge/`), `git log`, file konfigurasi. Jangan pernah
bertanya hal yang bisa kamu cari, atau yang sudah dijawab sebelumnya. Fakta yang ditemukan dipakai sebagai konteks
pertanyaan ("Saat ini X — apakah …?"), sehingga pengguna menjawab dengan informasi yang sama denganmu.

## 4. Tanya satu cabang per giliran — selalu dengan rekomendasi
- Bentuk setiap pertanyaan: **konteks satu kalimat** (fakta yang kamu temukan) → **pertanyaan** → **pilihan** →
  **rekomendasimu + alasan singkat**. Pengguna tidak pernah dibiarkan menjawab dari nol.
- Pakai `AskUserQuestion` bila tersedia: rekomendasi sebagai opsi pertama berakhiran "(Rekomendasi)", 2–4 opsi yang
  benar-benar berbeda, `header` ≤ 12 karakter; jawaban bebas tetap terbuka lewat "Other". Tanpa alat itu, tulis
  pertanyaan dan opsinya sebagai teks lalu berhenti menunggu jawaban.
- Satu pertanyaan per giliran. Paling banyak tiga sekaligus hanya bila ketiganya **independen dan ringan**
  (mis. bahasa UI, format laporan, nama).

## 5. Gali — inilah bagian "grill"
- **Kata kabur dijadikan ukuran**: "cepat", "bagus", "sederhana", "aman", "lengkap" → minta angka, contoh, atau
  pembanding ("cepat = halaman terbuka < 1 detik di HP kasir?").
- **Kontradiksi disebut terang**: dua jawaban yang tidak bisa sama-sama benar → sebutkan keduanya dan tanyakan
  mana yang menang.
- **Konsekuensi tersembunyi diungkap**: biaya, waktu, apa yang dikorbankan, apa yang sulit dibatalkan.
- **Keputusan lama yang bertabrakan** (dari catatan/ingatan) ditunjukkan, bukan diam-diam dilanggar atau diikuti.
- "Terserah" / "kamu yang tentukan" → pakai rekomendasimu dan catat sebagai **asumsi** yang disetujui.
- Jangan memperpanjang cabang yang tidak akan mengubah hasil; bila sisa pertanyaan berdampak kecil, usulkan
  berhenti dengan asumsi.

## 6. Catat sambil jalan
Simpan draf pemahaman sejak pertanyaan pertama (di RudisOne: `handoff/<ID>/pemahaman.md`,
`~/Documents/Neuron/ai-agent/RudisOne/templat/pemahaman-bersama.md`), agar wawancara bisa dilanjutkan setelah konteks diringkas atau dari
percakapan lain tanpa mengulang pertanyaan.

## 7. Tutup dengan pemahaman bersama
Selesai bila setiap cabang sudah **dijawab**, **ditemukan sebagai fakta**, **didelegasikan** sebagai pertanyaan
keahlian, atau **diasumsikan** dengan sepengetahuan pengguna. Lalu:
1. Tunjukkan **ringkasan pemahaman bersama** (≤ 12 baris): hasil · kriteria selesai · lingkup & bukan lingkup ·
   batasan · asumsi · pertanyaan terbuka untuk pelaksana · rencana singkat (siapa mengerjakan, langkah berikutnya).
2. Minta persetujuan eksplisit (opsi: "Sepakat, jalankan (Rekomendasi)" / "Ada koreksi").
3. Koreksi → perbaiki cabang itu saja, tunjukkan ulang ringkasannya. Sepakat → kutip jawabannya persis di catatan
   pemahaman, baru pekerjaan dimulai.

Pengguna boleh berkata "cukup" kapan saja: cabang yang tersisa diisi rekomendasimu, ditandai sebagai asumsi, dan
tetap ditunjukkan di ringkasan.

## Larangan
- Tidak memulai pekerjaan sebelum sepakat — kecuali kedalaman *darurat* atau pengguna meminta "langsung".
- Tidak menanyakan rahasia (sandi, token, kunci) — itu bukan bagian dari penyelarasan.
- Tidak membebankan pertanyaan keahlian ke pengguna; tidak menyodorkan daftar periksa sebagai formulir.
- Tidak mengulang pertanyaan yang sudah terjawab.
- Kesepakatan pemahaman **bukan** izin umum untuk aksi berisiko: deploy, push, dan perubahan production tetap
  butuh permintaan pengguna yang dikutip persis per aksi.

## Di RudisOne
COO memakai skill ini sebagai tahap **Penyelarasan persepsi** sebelum organisasi bergerak — ID tugas berstatus
`penyelarasan`, hasilnya `handoff/<ID>/pemahaman.md` yang dirujuk brief dan menjadi ukuran verifikasi. Aturan
khusus COO (batas mencari fakta, tugas jamak, penyelarasan ulang): `~/Documents/Neuron/ai-agent/RudisOne/agents/coo.md` › Penyelarasan
persepsi. Di luar RudisOne, ringkasan pemahaman cukup ditulis di percakapan.

## Contoh pertanyaan yang baik
> **Lingkup · cetak SJ.** Saat ini cetak surat jalan memotong item setelah baris ke-20 (laporan kemarin). Pilihan:
> (a) halaman otomatis bersambung dengan nomor halaman, (b) huruf diperkecil agar muat satu halaman, (c) batasi
> 20 item per SJ. **Rekomendasi: (a)** — tetap terbaca dan tidak mengubah alur gudang. Setuju?
