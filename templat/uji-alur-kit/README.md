# Kit uji jalan alur

Pustaka kecil agar Business Systems Analyst (BSA) **tidak menulis skrip Playwright dari nol** setiap kali menguji alur
(`templat/uji-alur.md`). Pilot pertama menghabiskan (perkiraan BSA) ± separuh waktu uji untuk menulis dan memperbaiki skrip: menu samping HP
yang menutupi halaman, pemilih berupa dialog pencarian, dialog sisa yang menghalangi klik. Semua itu sudah ditangani di sini.

Isi: `kit.mjs` (Playwright: sesi, login, tangkapan, penutup penghalang, pemilih, isian) · `periksa.mjs` (pemeriksaan dasar
murni, diuji `node --test bin/uji-alur-kit.test.mjs`) · `contoh-uji.mjs` (skrip tipis untuk disalin).

## Dua mode: CEPAT (bawaan) dan PENUH (hanya bila pengguna memintanya)
| | **CEPAT** — bawaan di gerbang akhir (⑦) | **PENUH** — hanya atas permintaan pengguna |
|---|---|---|
| Tugas | hanya **tugas inti** (1–2 per peran, ditandai di bagian "Tugas inti (uji cepat)" `alur-tugas.md` sejak ②b) | semua tugas |
| Perangkat | **HP (390 px) saja** | HP + komputer |
| Kasus gagal | **kasus gagal utama** per tugas inti (1–2, tertulis di bagian tugas inti) | semua kasus gagal + layar kosong |
| Pemeriksaan otomatis kit | di **setiap layar yang dikunjungi** (angka berlebih nol, teks terlarang/Inggris, label, target sentuh, geser horizontal, papan ketik angka, konsol/respons) | sama |
| Tangkapan | hanya langkah kunci (`snap(nama, { kunci: true })`), kasus gagal, galat | setiap `snap` |
| Waktu | satu eksekusi skrip ≤ ± 2 mnt; BSA total ± 10 mnt (aplikasi pertama; ukur nyata: lihat agents BSA › Uji jalan alur); uji ulang butir ± 2–3 mnt | ≈ 25–50 mnt (eksekusi penuh ≈ 6 mnt) |
| Putusan | LULUS / PERLU PERBAIKAN untuk sha terakhir **beserta pernyataan cakupan** ("cepat: N dari M tugas, HP saja") dan daftar *belum terverifikasi* | sama |
Pilih lewat opsi `mode` atau env `UJI_MODE=cepat|penuh` (PowerShell: `$env:UJI_MODE='penuh'`; env menang). Skrip memakai `uji.perangkatUji`
(cepat = `["hp"]`), menyatakan cakupan dengan `uji.cakupan({ tugasUji, tugasSemua })`, dan `ringkasan.md` memuat **Cakupan** dan
**Belum terverifikasi** otomatis — tidak ada yang tampak lengkap bila tidak lengkap. Mode cepat tidak memangkas diam-diam: yang tak dicakup tertulis.

## Langkah pakai (BSA)
1. **Salin** `templat/uji-alur-kit/{kit.mjs,periksa.mjs,contoh-uji.mjs}` ke `handoff/<ID>/uji-alur/` (bukan repo proyek).
   Pasang Playwright **sekali** di `handoff/<ID>/` (`npm i playwright && npx playwright install chromium`); repo proyek dan
   RudisOne tidak mendapat dependensi.
2. **Tulis skrip tipis** `uji.mjs` dari `contoh-uji.mjs`: isi alamat, akun per peran, kata terlarang proyek, lalu satu fungsi
   per tugas di `alur-tugas.md` (jalur lancar + kasus gagal + layar kosong). Gunakan `snap` di tiap layar penting.
3. **Debug per tugas, jalankan penuh sekali**: bungkus tiap tugas dengan `s.tugas("nama", fn)` lalu jalankan `UJI_TUGAS=masuk node uji.mjs` (PowerShell: `$env:UJI_TUGAS='masuk'; node uji.mjs`)
   (hanya tugas yang namanya memuat kata itu; pisahkan dengan koma) sampai bersih; baru satu `node uji.mjs` penuh. Eksekusi **penuh** aplikasi
   9 tugas (2 peran) × 2 perangkat ≈ 6 mnt — mengulanginya tiap perbaikan skrip adalah penyebab utama uji lambat (mode cepat: ± 2 mnt). Galat skrip tertangkap
   (`tugas`/`coba`) dan tidak menghentikan uji; langkah GALAT = skrip/selektor salah, bukan temuan aplikasi.
4. **Isi templat**: `hasil/ringkasan.md` memuat baris matriks dan tabel calon temuan; `hasil/hasil.json` memuat semuanya per
   langkah. Kit hanya MENEMUKAN calon temuan — kamu memutuskan tingkat, mengaitkan kode sumber (A#/G#/K#/R#/N#), usulan, dan
   jenis tindak lanjut; temuan yang tak bisa dirujuk ke aturan/heuristik dibuang.
5. **Uji ulang** sesudah perbaikan: `UJI_TUGAS=<tugas yang berubah> node uji.mjs` — hasilnya ke `<keluaran>-ulang-<kata>/` (otomatis; `hasil/` dan nomor tangkapan eksekusi penuh tidak tertimpa), nomor tangkapan mulai dari 001 lagi; tugas yang bergantung data tugas lain: sediakan data lewat langkah awalnya (data uji milikmu).

## Pemeriksaan otomatis di setiap `snap`
| Jenis | Butir templat | Apa yang diperiksa |
|---|---|---|
| `geser` | 5a | lebar isi > lebar layar (HP dan komputer) + elemen penyebab |
| `target-sentuh` | 5b | tombol/tautan < 44 px (HP; tautan sebaris dikecualikan) |
| `papan-ketik` | 5c | isian bertema jumlah/harga tanpa `inputmode` numeric/decimal atau type number/tel (HP; atur `polaAngka`) |
| `angka-berlebih` | 3 | `999,0000`, `25,0000` di teks dan `12.0000` di nilai isian (`\d+,\d{3,}`) |
| `format-tanggal` | 3 | tanggal bentuk ISO (tahun-bulan-tanggal berangka) di teks layar |
| `teks-terlarang` | 2 / 6 | bawaan: "Required", undefined/NaN, galat HTTP/teknis, kata antarmuka Inggris; **tambah per proyek** lewat `teksTerlarang` (kode/singkatan internal, istilah teknis) |
| `label-hilang` | 7 | isian tanpa label terhubung (placeholder saja tidak cukup) |
| `konsol`, `respons` | — | galat konsol/`pageerror`/jaringan dan respons ≥ 400 tak terduga sejak `snap` sebelumnya |
| `menu-hp-tetap-terbuka` | 5b | dicatat `menu(nama)` bila menu samping HP masih terbuka sesudah diketuk |

Tidak otomatis (tetap penilaian BSA): pesan galat "menyebut apa yang salah dan cara memperbaikinya", jumlah langkah vs
target, istilah ramah, kontras, urutan fokus, heuristik Nielsen. Gunakan `teks` di `hasil.json` untuk membaca pesan layar.
Kasus gagal sengaja: `snap(nama, { gagal: true })` (respons 4xx dianggap diharapkan, tercatat di `responsDiharapkan`;
5xx tetap temuan).

## API ringkas
- `mulaiUji(opsi)` → `uji`. Opsi penting: `baseUrl`, `apiUrl`, `keluaran`, `akun {peran:{email,sandi}}`, `login {path,email,sandi,kirim,next}`,
  `pergiDengan` (`goto` | `spa`), `menu {tautan,pemicuHp}`, `teksTerlarang`, `polaAngka`, `abaikanKonsol`, `responsDiizinkan`,
  `penghalang` (daftar selektor dialog/overlay), `fotoPenuh` (true | false | null = tanpa tangkapan). `PRESET_RUDIS` mengisi
  login `?next=`, `pergiDengan: "spa"` (token di memori; `goto` biasa memutus login), dan sidebar shadcn.
- `uji.perangkatUji` (cepat `["hp"]`, penuh `["hp","komputer"]`) · `uji.cakupan({ tugasUji, tugasSemua })` · `uji.mode`.
- `uji.sesi(peran, "hp" | "komputer", { awal })` → `s` (sudah login; HP = iPhone 13, komputer = 1440×900).
- `s.snap(nama, { gagal, kunci })` tangkapan bernomor + pemeriksaan (mode cepat: PNG hanya bila `kunci`/`gagal`/galat; pemeriksaan selalu) · `s.klik(target)` (menutup penghalang atau membuka menu HP
  bila sasaran tertutup) · `s.menu(nama)` · `s.pergi(alamat)` · `s.isi/isiAngka/isiTanggal(target, nilai)` (mengembalikan nilai yang
  tampil) · `s.pilihOpsi({ pemicu, cari, opsi })` (select asli, dialog pencarian, combobox) · `s.tutupPenghalang()` ·
  `s.tugas(nama, fn)` / `s.coba(nama, fn)` · `s.pesan()` (toast, galat inline, dialog yang tampak; `snap` menyimpannya di `hasil.json` › `pesan`) · `s.lepasPenjaga()` (dialog "Perubahan belum disimpan"; otomatis dipanggil `klik`/`tutupPenghalang`, tombol di opsi `tombolPenjaga`) · `s.catatTemuan({...})` · `s.page` (Playwright mentah bila perlu).
  `target` = selektor CSS, `RegExp` (teks), `{ role, name }`, atau Locator.
- `uji.hasilTugas({ peran, tugas, perangkat, status, catatan, foto, kasusGagal, layarKosong })` → baris matriks ·
  `uji.catatFakta(kunci, nilai)` · `await uji.selesai()` menulis `hasil/hasil.json`, `hasil/ringkasan.md`, `hasil/tangkapan/`.

## Jebakan yang sudah dikenal (dari pilot)
- Aplikasi yang menyimpan token di memori: jangan `page.goto` ke alamat dalam; masuk dengan `?next=` (login) atau `pergi` (SPA).
- Dua tombol bernama sama (mis. "Tambah pengguna" di halaman dan di dialog): pakai `dialog.getByRole(...)` atau `.last()`.
- Pemilih barang berupa dialog dengan kotak cari: `pilihOpsi({ pemicu: /Pilih barang/, cari: "kabel", opsi: /Kabel/ })`.
- Selektor id berisi titik (`field-lines.0.qty`) di CSS harus di-escape (`#field-lines\\.0\\.qty`) atau pakai `[id="…"]`.
- `pergi(alamat, { tunggu })`: rute SPA yang dimuat malas butuh tanda termuat (selektor/RegExp) agar tangkapan tidak berisi layar lama.
- Pemicu `pilihOpsi`/`klik` berupa RegExp dicari sebagai tombol, combobox, tautan, lalu teks; tombol yang namanya dari label (aria) ikut ketemu.
- Tangkapan `fullPage` menaruh header lengket di tengah gambar HP; pakai `fotoPenuh: false` bila mengganggu.
- Batas tunggu langkah 8 dtk (bukan 30 dtk bawaan Playwright) supaya selektor salah gagal cepat.
- Tugas berantai lintas peran (admin buat barang → petugas catat → admin batalkan): buka dua sesi sekaligus (`uji.sesi` dua kali) dan beri data uji awalan tetap (mis. "Cepat-"); `UJI_TUGAS` hanya menjalankan tugas yang dipilih, jadi sediakan datanya lewat langkah awal tugas itu atau cari data berawalan itu yang sudah ada.
- Sunting skrip dengan alat Edit/Write, bukan `node -e`/heredoc di Git Bash: `\s` di regex bisa hilang.
- Respons 401 `GET /rbac/me` atau `/auth/me` di pemuatan pertama (preset Rudis) sudah diizinkan; 401 di tempat lain tetap calon temuan.
- Kit tidak mengubah kode atau data aplikasi selain apa yang dilakukan skrip kamu (data uji = milikmu); jangan menghapus data lain.
