# Kit uji jalan alur

Pustaka kecil agar Business Systems Analyst (BSA) **tidak menulis skrip Playwright dari nol** setiap kali menguji alur
(`templat/uji-alur.md`). Pilot pertama menghabiskan (perkiraan BSA) ± separuh waktu uji untuk menulis dan memperbaiki skrip: menu samping HP
yang menutupi halaman, pemilih berupa dialog pencarian, dialog sisa yang menghalangi klik. Semua itu sudah ditangani di sini.

Isi: `kit.mjs` (Playwright: sesi, login, tangkapan, penutup penghalang, pemilih, isian) · `periksa.mjs` (pemeriksaan dasar
murni, diuji `node --test bin/uji-alur-kit.test.mjs`) · `contoh-uji.mjs` (skrip tipis untuk disalin).

## Langkah pakai (BSA)
1. **Salin** `templat/uji-alur-kit/{kit.mjs,periksa.mjs,contoh-uji.mjs}` ke `handoff/<ID>/uji-alur/` (bukan repo proyek).
   Pasang Playwright **sekali** di `handoff/<ID>/` (`npm i playwright && npx playwright install chromium`); repo proyek dan
   RudisOne tidak mendapat dependensi.
2. **Tulis skrip tipis** `uji.mjs` dari `contoh-uji.mjs`: isi alamat, akun per peran, kata terlarang proyek, lalu satu fungsi
   per tugas di `alur-tugas.md` (jalur lancar + kasus gagal + layar kosong). Gunakan `snap` di tiap layar penting.
3. **Debug per tugas, jalankan penuh sekali**: bungkus tiap tugas dengan `s.tugas("nama", fn)` lalu jalankan `UJI_TUGAS=masuk node uji.mjs` (PowerShell: `$env:UJI_TUGAS='masuk'; node uji.mjs`)
   (hanya tugas yang namanya memuat kata itu; pisahkan dengan koma) sampai bersih; baru satu `node uji.mjs` penuh. Eksekusi penuh aplikasi
   9 tugas (2 peran) × 2 perangkat ≈ 6 mnt — mengulanginya tiap perbaikan skrip adalah penyebab utama uji lambat. Galat skrip tertangkap
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
- `uji.sesi(peran, "hp" | "komputer", { awal })` → `s` (sudah login; HP = iPhone 13, komputer = 1440×900).
- `s.snap(nama, { gagal })` tangkapan bernomor + pemeriksaan · `s.klik(target)` (menutup penghalang atau membuka menu HP
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
- Kit tidak mengubah kode atau data aplikasi selain apa yang dilakukan skrip kamu (data uji = milikmu); jangan menghapus data lain.
