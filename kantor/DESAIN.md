# Brief desain — Kantor RudisOne (3D)

Brief desain tampilan Kantor RudisOne, disusun mengikuti skill `rudis-riset-desain`: halaman `kantor/index.html`, denah 3D
`kantor/app/` (three.js r186 disalin di `kantor/vendor/`, tanpa build, tanpa internet), data dari `kantor/server.mjs`.
Berkas ini memuat prinsip, denah, cerita gerak, kamera, dan token yang berlaku — bukan riwayat versi.

## Subjek, audiens, tugas utama
- **Subjek:** organisasi agent RudisOne sebagai kantor: COO di ruang pimpinan, tiga pod Engineering (Tim 1–3), Corporate
  Strategy, Layanan bersama (Program Manager & Technical Writer), IT Operations, dan lounge.
- **Audiens:** pemilik tim, memantau sambil bekerja di layar lebar, sesekali dari HP.
- **Tugas utama layar:** dalam 3 detik menjawab: siapa sedang bekerja di divisi mana, siapa menunggu saya, dan apa
  yang sedang mengalir (tugas turun, laporan naik). Detail baru muncul saat diminta.
- **3D adalah peta, bukan tempat menjelajah:** ruangan semi-realistis (cahaya, bayangan, bahan kayu/kaca/karpet) dengan
  kamera terbatas; rincian dan padanan aksesibel tetap di panel samping HTML.

## Prinsip
1. **Status selalu terbaca tanpa animasi.** Di denah: **warna + simbol** dengan bentuk berbeda (▶ … ! ✓ –), tidak pernah hanya
   warna; teksnya di panel samping, di kartu saat orang disentuh (hover/klik/ketuk/fokus keyboard), dan untuk pembaca
   layar (aria). **"Menunggu Anda" tetap bertulisan di denah.** Animasi hanya memperkuat.
2. **Jujur:** semua jabatan hadir di mejanya, tetapi "Bekerja" hanya dari sesi/subagent yang benar-benar berjalan; "Siap
   dipanggil" menyebut keadaannya apa adanya (ruang kerjanya terbuka · bekerja saat ditugaskan · mulai bekerja saat COO memberi tugas);
   papan & berkas hanya berisi tugas register (papan kosong = memang tidak ada tugas); data basi atau koneksi putus selalu ditampilkan.
3. **Struktur organisasi terlihat:** denah mencerminkan rantai komando — atasan memanggil dari mejanya, bawahan
   menghampiri; laporan dibawa naik. Nama zona **selalu tampil dan terbaca** di seluruh denah: papan nama berdiri di ruangan.
4. **Privasi:** hanya metadata aktivitas (jenis langkah, deskripsi singkat yang ditulis agent ≤ 50 karakter, nama berkas,
   host web, ID tugas) — tidak pernah isi berkas, pesan, prompt, keluaran, perintah terminal, atau nama alat internal.
   Jenis pesan diambil dari tag `[…]` di awal pesan saja; ID tugas dari baris berawalan (`[Tugas dari COO] T-…`).
5. **Tenang:** lantai & perabot netral; warna kuat hanya untuk status dan identitas peran; tidak ada merah kecuali galat.
6. **Gerak aman:** `prefers-reduced-motion` dan tombol **Jeda gerak** membuat semuanya statis (WCAG 2.2.2, 2.3.3) —
   orang berpindah seketika, kamera tanpa transisi, dan denah hanya digambar ulang saat datanya berubah.
7. **Lokal:** halaman tidak memuat apa pun dari internet (pustaka & huruf disalin; server mengirim CSP `'self'`).

## Temuan riset → keputusan
| Temuan (sumber) | Keputusan |
|---|---|
| Kantor virtual modern (Roam, Kumospace, Gather): ruang bernama per tim, tim yang sering berinteraksi berdekatan, jalur & pintu jelas | Zona per divisi (lantai bertint warna divisi + papan nama), lorong utama berkarpet, pintu zona selalu kosong |
| Kantor eksekutif modern (Gensler/Fujitsu, Haworth, Algedra): wilayah pimpinan ditandai material lantai & dinding kaca, ada kursi tamu | **Ruang Pimpinan** berlantai kayu, partisi kaca, meja walnut menghadap ruangan, dua kursi tamu |
| Break room dipisah dari area kerja tenang, stasiun kopi sebagai titik kumpul, sofa membentuk pod ngobrol | **Lounge** dibatasi pot tanaman: bar kopi, sofa L, pouf, meja bundar, bangku |
| Dashboard multi-agent: peta organisasi dengan status live, linimasa, titik persetujuan menonjol, state basi/galat eksplisit | Ringkasan atas + pita **Perlu perhatian Anda**; papan **Tugas berjalan**; **linimasa 60 menit**; status koneksi (rinci: Panel di luar denah) |
| Pixel Agents / Claude-Office: agent masuk lewat pintu, punya meja, pose sesuai alat, istirahat kopi | Bekerja → ke meja dengan pose sesuai alat (mengetik/membaca/berpikir); santai → lounge; menunggu → angkat tangan |
| Generative Agents (Smallville): titik yang dipakai bersama membuat penumpukan | Titik santai **dipesan** satu per orang; dua orang santai yang berdekatan sesekali mengobrol |
| Pola FSM NPC: pisahkan status, gerak, dan kondisi | Status dari server ≠ perilaku di layar: tiap karakter punya antrean skenario (delegasi, lapor) yang didahulukan |
| Navigasi 3D bebas membuat orang tersesat; 3D layak bila bentuk ruang penting (Nielsen, "2D is better than 3D"); "kembali ke tampilan standar" memulihkan orientasi (Autodesk ViewCube) | Kamera **terbatas** + tombol **Seluruh denah** selalu ada; transisi ±650 ms, instan saat hemat gerak |
| Diorama web ringan yang terasa nyata memakai cahaya terpanggang (Bruno Simon, *my-room-in-3d*) — kita tak memakai aset berlisensi | Pengganti murah dari kode: bayangan perabot **statis** (dihitung sekali), bayangan kontak palsu di bawah orang, bercak cahaya jendela di lantai |
| Hemisphere + satu cahaya arah + IBL `RoomEnvironment` cukup tanpa berkas HDR; tiap cahaya langsung menambah biaya (dok three.js, Discover three.js) | Cahaya = Hemisphere + 1 Directional berbayangan + RoomEnvironment; layar = warna tak terpengaruh cahaya |
| Khronos **PBR Neutral** menjaga rona & saturasi warna dasar; ACES/AgX mengurangi saturasi (model-viewer, tone mapping) | `NeutralToneMapping`: warna status & peran di 3D sama dengan token CSS |
| Perspektif memberi isyarat kedalaman; FOV kecil menekan distorsi (MathWorks view projections; contoh *ai-office*) | `PerspectiveCamera` FOV 30° |
| Peta tertanam di halaman yang digulir: satu jari menggulir halaman, dua jari menggerakkan peta (Google Maps `gestureHandling: cooperative`) | HP: **satu jari menggulir halaman, dua jari menggeser & mencubit denah**; petunjuk singkat muncul saat satu jari digeser di denah |
| Label HTML di atas kanvas (CSS2D): teks tajam & ikut CSS, tidak terbaca sebagai bagian 3D; panel HTML = padanan pembaca layar (forum three.js aksesibilitas) | Status orang = titik HTML kecil yang mengikuti kepala; panel samping = padanan penuh. Kapsul nama mengambang dihapus: menutupi ruangan |
| Lantai, pola lantai, dan warna aksen per area adalah elemen wayfinding; label bisa menempel di bidang peta, bukan di layar (DHA/MHS Wayfinding Guidelines 2022; Mapbox `text-pitch-alignment: map`) | Nama zona di dalam adegan 3D (ikut berputar & mengecil). Tulisan yang rebah di lantai terlalu kecil & mudah tertutup sekat dari sudut kamera landai → **papan nama berdiri** menghadap depan; tulisan lantai berpelat hanya untuk pandangan dari samping |
| Kontras teks terhadap latarnya ≥ 4,5:1 (WCAG 1.4.3); teks langsung di atas lantai bertekstur & bercahaya berganti (pagi–malam) kontrasnya tak menentu | Papan berpelat buram tanpa cahaya (warna tetap di semua jam): tinta 14,2:1 / 13,6:1, teks redup 5,0:1 / 6,9:1 (terang / gelap) |
| Simbol peta: ikon & teks bertabrakan disembunyikan menurut urutan tetap; `text-optional` membuang teks tapi mempertahankan ikon; lapisan punya rentang zoom (Mapbox Style Spec) | Titik status = "ikon", nama = "teks opsional" (kalah lebih dulu); nama baru tampil saat diperbesar |
| Penanda wajib (`REQUIRED_AND_HIDES_OPTIONAL`) vs. opsional berprioritas (Google Maps Platform, collision behavior) | Kartu sentuh & "Menunggu Anda" = wajib/teratas; titik > nama > gelembung pada urutan tetap |
| Progressive disclosure: sedikit yang paling sering dibutuhkan dulu, maks. ±2 tingkat (NN/g) | Denah: titik → kartu (hover/klik) → panel rincian; mode bawaan **Ringkas** |
| Warna tidak boleh satu-satunya penanda; ikon status ≥ 3:1 terhadap sekitarnya (WCAG 1.4.1, 1.4.11) | Simbol berbeda per status + legenda; titik berbingkai warna permukaan agar kontras di lantai terang & gelap |
| Konten saat hover/fokus: dapat ditutup (Esc), dapat di-hover, menetap; juga muncul saat fokus keyboard (WCAG 1.4.13, WAI-ARIA APG Tooltip); di layar sentuh = ketukan (NN/g Tooltip Guidelines) | Kartu sentuh tampil saat hover/fokus (Tab ke tag meja)/dipilih, tetap saat kursor pindah ke kartu, Esc menutup tanpa memindah fokus; HP: ketuk |
| Content switcher untuk tampilan saling eksklusif, satu selalu terpilih, opsi tersering pertama (Carbon Design System) | Tombol **Label**: Ringkas (bawaan) · Lengkap · Tanpa — grup radio, diingat per peramban |
| Kantor virtual terasa "hidup" karena kehadiran rekan, bukan karena aktivitas palsu (Gather, Roam: avatar tetap di meja saat diam) | Semua jabatan hadir **Siap dipanggil** di mejanya; sesekali maks. 3 orang ngopi lalu kembali; "Bekerja" hanya dari data nyata |
| Jejak kerja yang tertinggal (papan tulis, berkas) memberi konteks tanpa membuka rincian (Pixel Agents, Claude-Office) | Papan tulis tim, papan strategi, papan tugas Ruang Pimpinan, dan map di meja — semua dari register (ID + judul) |
| Pencahayaan siang/malam memberi rasa waktu (Bruno Simon *my-room-in-3d*: varian cahaya terpanggang) | Cahaya mengikuti jam WIB: pagi sejuk, siang netral, sore keemasan, malam jendela gelap + lampu meja menyala |
| Kinerja: batasi pixel ratio, render saat perlu, kurangi draw call dengan penggabungan & instancing (panduan three.js performance CloudAI-X r186, MDN WebGL best practices) | Pixel ratio ≤ 2 (HP 1,5), perabot statis digabung per material, layar monitor & bayangan kontak = satu `InstancedMesh`, tiap orang = satu `SkinnedMesh` |
| DevTools CPU throttling tidak memperlambat GPU (Chrome for Developers) | Angka HP dari emulasi dilabeli "GPU laptop — optimistis" |
| Pesan galat: apa yang terjadi + yang bisa dicoba, tanpa "maaf"/jargon (GOV.UK error message) | Tanpa WebGL 2: kotak pesan menggantikan denah, panel tetap lengkap |

## Denah (1 unit = 1 m; lantai 40 × 21; data: `kantor/app/denah.mjs`)
```
  ┌───────────┬───────────────┬───────────────┬───────────────┐ y=0 (dinding belakang berjendela)
  │ RUANG     │ ENG · TIM 1   │ ENG · TIM 2   │ ENG · TIM 3   │   tiap pod: meja Tech Lead menghadap tim,
  │ PIMPINAN  │ (proyek A)    │ (proyek B)    │ (redup bila   │   BSA · SE1 · SE2 di baris depan, papan tulis,
  │ (kayu)    │               │               │  belum dipakai)│   meja berdiri untuk asisten
  ├─pintu─────┴──── lorong utama (karpet) ─────┴───────────────┤ ← pintu masuk (dinding kiri)
  │ CORPORATE      │ LAYANAN   │ IT OPS      ┊ LOUNGE           │
  │ STRATEGY       │ BERSAMA   │ panel layar,┊ bar kopi, sofa L,│
  │ Strategy lead, │ PM lead,  │ IT Ops lead,┊ pouf, meja bundar│
  │ Finance·Riset· │ TW        │ SysAdmin,   ┊ bangku, berdiri  │
  │ HRBP           │           │ rak server  ┊                  │
  └────────────────┴───────────┴─────────────┴──────────────────┘ y=21 (tepi depan terbuka — diorama)
    Corporate Strategy · Layanan bersama · IT Operations · Lounge     ← lis depan y 21–22,6 (nama zona baris depan)
```
- Meja leader di belakang zonanya **menghadap anggota**; anggota duduk menghadap mejanya (membelakangi kamera bawaan).
- Kursi tim dipetakan per proyek: nomor tim dari `TEAM.md` (`## Engineering · Tim <n> · <proyek>`, atau baris Tech Lead di
  tabel Engineering: "(Tim n)" / nama sesi `r<n>-lead-…`), lalu dari nama worktree `r<n>-…` folder awal sesi, selain itu nomor
  kosong terkecil. Peran dari worktree dibaca dari folder tempat sesi dibuka (COO yang memeriksa worktree tetap COO). Papan nama tim menampilkan proyeknya; tim tanpa proyek diredupkan dan
  tag mejanya disembunyikan dari denah, panel & linimasa.
- Hanya sesi RudisOne yang tampil (folder repo ini, worktree `r<n>-…`, `/rudisone`, atau pembuka "… di RudisOne").
- Jalan: A* di grid 0,5 m (4 arah, penalti belok) dari tapak perabot; semua kursi, kursi tamu, titik santai, dan meja
  bantuan terjangkau dari pintu (dijaga `kantor/denah.test.mjs`). 20 titik santai.

## Kamera & interaksi
- `PerspectiveCamera` FOV 30°. Bawaan **atas-miring dari depan-kanan** (azimut 45°, 58° dari vertikal) = sudut denah
  isometrik lama; layar sempit (< 700 px) memakai azimut 74° dan 46° dari vertikal agar sisi panjang denah mengisi layar
  tegak. Batas: azimut 15°–75°, polar 28°–64°, jarak 9 m – 1,2 × jarak pas; titik pandang dijepit ke lantai.
- **Seluruh denah** = jarak & titik pandang agar lantai + dinding (laptop: juga papan nama di atas dinding belakang) tepat masuk dan terpusat (dihitung dari proyeksi, `kantor/app/kamera.mjs`).
  Selama pengguna belum menggerakkan kamera, ukuran kanvas berubah → tetap "Seluruh denah".
- Tetikus: seret = geser, klik kanan + seret = putar, gulir = perbesar. Sentuh: satu jari = gulir halaman, dua jari =
  geser & cubit. Tombol: ⟲ ⟳ (±15°), − +, **Seluruh denah** (≥ 32 px). Keyboard (fokus di denah): panah = geser,
  Shift + panah = putar, + / − = perbesar, 0 = seluruh denah, Esc = batal pilih.
- Arahkan tetikus ke orang/meja = kartu nama + status; klik/ketuk = pilih (kartu menetap + rincian di panel, seperti
  panel Tim). Keyboard: Tab dari denah berpindah antarorang (tag meja tersembunyi) dan menampilkan kartunya, Enter = pilih,
  Esc = tutup kartu / batal pilih. Tautan `?tugas=<ID>` menyorot tugas,
  memilih pemiliknya, dan mendekatkan kamera ke mejanya.
- HP: tinggi kanvas mengikuti tinggi denah (tanpa ruang kosong di atas/bawah).

## Cerita gerak
| Kejadian (dari transkrip) | Animasi |
|---|---|
| Atasan → bawahan `[Tugas …]` / `[Revisi]` / `[Permintaan …]`, atau COO membentuk sesi | Atasan tetap duduk, gelembung "<nama>, ke meja saya"; bawahan berdiri ("Baik"), berjalan ke kursi tamu atasan, menerima berkas ("Siap ✓"), lalu ke mejanya dan bekerja |
| Bawahan → atasan `[Laporan …]`, atau bawahan selesai satu giliran kerja | Bawahan membawa kertas ke kursi tamu atasan, "Laporan selesai"; atasan "Terima kasih"; bawahan kembali (ke lounge bila santai) |
| Atasan → bawahan `[Diterima]` | Atasan "Diterima ✓", bawahan "Terima kasih" di tempat — tanpa berjalan |
| `[Tinjau]` | Peninjau dipanggil ke meja pemberi tinjauan |
| Sesama `[Konsultasi]`/`[Jawaban]`/`[Info]` | Pengirim menghampiri meja penerima, gelembung tanya-jawab, kembali |
| Siap dipanggil | Duduk bersandar di mejanya, layar sangat redup. Sesekali (tiap 3–8 menit, maks. 3 orang bersamaan) istirahat ±1 menit: ke bar kopi (memegang cangkir), lalu duduk di lounge; bila ada teman, mengobrol ringan — obrolan tidak pernah mengklaim pekerjaan. COO tetap di mejanya; hemat gerak = semua di meja |
| Pekerjaan nyata berakhir (sesi berhenti setelah memakai alat, subagent peran selesai) | Tetap di mejanya 10 menit sebagai **Baru selesai**: bersandar, dua lengan terentang ke atas, label "Baru selesai · N mnt lalu", lalu kembali Siap dipanggil |
| Tim mendapat proyek / kehilangan proyek | Anggota tim masuk lewat pintu ke mejanya / keluar lewat pintu |
| Subagent umum (asisten) | Asisten muncul di samping pemanggil, bekerja di meja berdiri tim, lalu menyerahkan hasil dan pergi |

Pose di meja: bekerja = mengetik (atau membaca untuk alat baca/web), berpikir = tangan di dagu, menunggu Anda = angkat
satu tangan + **cincin amber di lantai**, baru selesai = bersandar dengan dua lengan ke atas (V), siap dipanggil = bersandar,
tangan di pangkuan. Atasan mengikuti rantai komando di `protokol.md`.

## Keadaan peran
Hanya inti yang hidup sebagai sesi (COO dan Tech Lead tim yang punya proyek); IT Operations dibentuk saat dibutuhkan;
peran lain dipanggil sebagai subagent `rudis-<id-peran>`.
- **`mode` di /state:** *aktif* · *siaga* (sesi hidup tapi santai) · *katalog* (tidak ada sesi; dipanggil saat
  perlu) · *absen* (kursi sesi tetap yang belum masuk). `status` lama tetap dikirim agar klien lama tidak rusak.
- **Keadaan tampil** (`kantor/app/jejak.mjs` › `keadaanTampil`, diuji `kantor/jejak.test.mjs`): *Bekerja* ▶ / *Berpikir* … /
  *Menunggu Anda* ! hanya bila `present` dan status kerja dari server; *Baru selesai* ✓ bila `selesai.ts` < 10 menit lalu;
  selain itu *Siap dipanggil* – (siaga, katalog, dan absen). Tim tanpa proyek: meja kosong & redup.
- **`selesai` di /state** (server): `{ ts }` bila pekerjaan nyata kursi itu berakhir < 10 menit lalu — sesi berstatus santai
  yang langkah terakhirnya ≤ 15 menit setelah pemakaian alat terakhir, atau subagent peran yang selesai; `null` saat bekerja.
- **`selesaiHariIni` di /state** (server): tugas register berstatus selesai yang ditutup hari ini (tanggal lokal) — hanya
  ID, judul, pemilik, waktu tutup; kolom bukti tidak pernah dikirim.
- **Subagent peran duduk di kursinya** (`agentType` `rudis-<id-peran>`, atau pembuka "Kamu adalah <Jabatan> …"); subagent
  bertipe lain tampil sebagai asisten. Selesai → kursi kembali ke katalog; langkahnya tetap di log & linimasa.
- **Tampilan siap dipanggil:** karakter duduk di mejanya tanpa titik saat Ringkas & seluruh denah (titik abu-abu – + nama saat
  diperbesar atau Lengkap), jadi titik ▶ ✓ ! langsung menonjol.
- **Penanda subagent:** "dipanggil <singkatan pemanggil>" di panel Tim, kartu sentuh, dan tag meja; aria tag meja "dipanggil oleh <pemanggil>".
- **Register tugas:** papan "Tugas berjalan" membaca `handoff/register-tugas.json` (ditulis `bin/register.sh`), plus
  daftar **Selesai hari ini**.

## Jejak kerja nyata (3D, dari register)
Semua isi hanya **ID + judul + status** tugas (`jejak.mjs` › `papanDivisi`, `papanTugas`, `berkasMeja`); tidak ada coretan
atau catatan hiasan — papan yang kosong berarti memang tidak ada tugas.
- **Papan tulis tiap tim** (dinding belakang pod): "Tim n · <proyek> — tugas berjalan", maks. 4 baris (titik warna status).
  Tim tanpa proyek: papan putih kosong.
- **Papan strategi Corporate Strategy** (dinding kiri): satu catatan tempel per tugas berjalan divisi itu (maks. 3).
- **Papan tugas Ruang Pimpinan** (dinding kiri, di samping pintu): tiga kolom Berjalan · Antre & lainnya · Selesai hari ini.
- **Berkas di meja:** tumpukan map (maks. 3) di meja pemilik tugas yang selesai hari ini (hari = `selesai_pada` register,
  bukan `diperbarui` yang ikut berubah tiap `register.sh ubah`); rinciannya di panel orang itu.
- Pemilik "<Jabatan> · <proyek>" yang proyeknya belum dikenal server tidak ditaruh di tim mana pun (hanya di papan tugas).
- Papan = `CanvasTexture` 400 px/m (huruf lokal), digambar ulang hanya bila isinya berubah.

## Suasana mengikuti jam
Fase dari jam WIB (`Asia/Jakarta`): pagi 05–11, siang 11–15, sore 15–18, malam 18–05; dicek tiap detik, adegan hanya
digambar ulang saat fase berganti. Uji: `?jam=pagi|siang|sore|malam` atau `?jam=19:30` (jam di kepala halaman menulis
"(jam uji)"). Pengali di atas palet tema (`WAKTU` di `adegan.mjs`):
- **pagi:** langit sejuk kebiruan, bercak cahaya jendela lebih terang; **siang:** palet apa adanya;
- **sore:** cahaya keemasan dari sudut rendah (bayangan lebih panjang), jendela jingga, lampu setengah menyala;
- **malam:** jendela biru gelap tanpa bercak matahari, interior hangat, kap lampu meja & lampu lantai menyala + genangan cahaya.
  Lampu meja tim tanpa proyek tetap padam (meja kosong & redup). Lampu berubah tanpa menghitung ulang bayangan.
- Latar panggung (`--panggung-*`) ikut fase (`:root[data-waktu]`). Status tetap terbaca di semua fase (label HTML tidak ikut gelap).

## Label & keterbacaan
Denah bersih: tidak ada label yang menutupi orang atau meja kecuali "Menunggu Anda". Aturan murni di `kantor/app/label.mjs`
(diuji `kantor/label.test.mjs`); tulisan lantai di `adegan.mjs`, label HTML di `kantor.mjs`.
- **Nama zona = papan nama** (`label.mjs` › `PAPAN_ZONA`, satu mesh + satu kanvas atlas, 1 draw call, tanpa peta bayangan),
  seperti papan judul diorama: zona belakang (Ruang Pimpinan, Tim 1–3) = papan di **atas dinding belakang**, selebar zonanya —
  di belakangnya tidak ada apa pun, jadi tidak menutupi apa pun (kepala orang di baris belakang tergambar di depannya);
  zona depan = papan berdiri di **lis depan** (puncak 1,26 m). Bidang tegak menghadap depan, **tanpa cahaya** (pelat buram
  `WARNA_PAPAN`: tinta ≥ 7:1, teks redup ≥ 4,5:1, sama di pagi–malam), garis + kotak warna zona. Isi satu baris: nama zona;
  tim = "Tim n" tebal + " · <proyek>" (0,8×, redup; tanpa proyek: "Tim n" saja, papan redup bila tim belum dipakai). Huruf
  dipaskan ke tinggi glif sebenarnya. Dari kamera perspektif bawaan (`kamera.mjs`, juga diputar 15°–62°) papan tidak menutupi
  meja, kursi, orang, atau cincin "Menunggu Anda" (tes sinar nyata + raycast di peramban). "Seluruh denah" laptop ikut
  memasukkan papan atas dinding. Tinggi glif di laptop 1440 px ±10–18 px (panel ±1000 px ±9–17 px).
  Papan di sekat depan zona belakang ditolak: kursi & cincin anggota tepat di belakang sekat membatasi tinggi papan ±0,7 m
  (glif ±8 px).
- **Tulisan lantai berpelat** (`KOTAK_TULISAN`) menggantikan papan saat kamera dari samping (azimut > 62°: HP bawaan 74°)
  — papan yang menghadap depan terlalu miring dari sana. Zona belakang di lorong depan pintunya
  (HP: "Tim n · <proyek>"), zona depan di lis depan; pelat di belakang teks menjaga kontras di atas pola lantai. Di HP
  (±7 px/m) tulisannya ±9–14 px — terbaca, lebih jelas saat diperbesar dua jari.
- **Orang = titik status** (14 px, warna + simbol, bingkai warna permukaan) di atas kepala, tanpa teks. **"Menunggu Anda"**
  = label penuh "! <nama> · Menunggu Anda" berbingkai amber + cincin amber di lantai.
- **Detail ikut zoom** (`tingkatRincian`: dekat bila jarak kamera ≤ 75 % jarak "Seluruh denah", yaitu satu langkah +):

  | Mode Label | Seluruh denah (jauh) | Diperbesar (dekat) |
  |---|---|---|
  | **Ringkas** (bawaan) | titik ▶ … ✓; siap tanpa titik; label penuh menunggu | + titik siap, nama kecil & tipis di atas titik, gelembung ucapan |
  | **Lengkap** | titik semua + nama + gelembung | sama |
  | **Tanpa** | hanya titik ! untuk menunggu (cincin tetap); tanpa nama & gelembung | sama |

  Kartu sentuh tampil di semua mode. Pilihan Label diingat per peramban (`localStorage` `kantor-label`); uji: `?label=`.
- **Kartu sentuh** (hover/fokus/dipilih): nama jabatan lengkap, simbol + status + rincian singkat, petunjuk "Klik untuk
  rincian"; label kepala orang itu disembunyikan selama kartunya tampil. Padanan pembaca layar: tag meja (tombol tersembunyi,
  `aria-label` = nama + status + rincian), panel Tim, dan `aria-label` denah (jumlah per status); label visual `aria-hidden`.
- **Tabrakan** (setiap gambar): urut prioritas lalu jarak — kartu 6 & menunggu 5,5 (wajib: selalu tampil) > gelembung 5 > titik 3 >
  nama 2; yang bertabrakan dicoba digeser per baris ke atas/bawah (`label.mjs` › `tempatkanLabel`), baru disembunyikan (nama hilang
  lebih dulu, titik tetap); label wajib mencoba lebih banyak langkah lalu tetap tampil — dua "Menunggu Anda" berdekatan saling menghindar.
  Label dijepit agar tidak terpotong tepi kanvas; label tak berukuran (display: none) tidak ikut. Lapisan label `overflow: clip`
  (bukan wadah gulir) agar fokus Tab pada tag meja di tepi kanvas tidak menggeser semua label.
- Status di 3D diperkuat tanpa animasi: layar monitor menyala warna peran saat bekerja, redup saat berpikir/menunggu,
  mati selainnya; cincin lantai amber hanya untuk "menunggu Anda".
- Ukuran teks: label menunggu 11,5 px, nama 10 px (500, halo warna permukaan), kartu 13/12/11 px, gelembung 11 px.

## Panel di luar denah
Bagian HTML di sekitar denah menjawab pertanyaan yang sama dengan denah, dalam teks: **ada yang menunggu saya? apa yang
sedang berjalan?** Umum → rinci, maks. dua tingkat (kalimat → "rincian"). Logika teks murni di `kantor/app/istilah.mjs`
(diuji `kantor/istilah.test.mjs`); data aktivitas dari server (`kantor/aktivitas.test.mjs`).

| Temuan (sumber) | Keputusan |
|---|---|
| Agent view Claude Code: "needs input" paling atas, ikon kuning, jumlah di judul tab | Ringkasan atas diawali **Menunggu Anda** (satu-satunya kotak berwarna bila > 0) + kalimatnya; judul tab "(n) Kantor RudisOne" |
| > 5–6 indikator membebani; merah hanya galat (Carbon status indicator; NN/g dashboards) | 4 angka + koneksi; peringatan waktu kuning + ⏱ + kalimat, tidak pernah merah |
| Data telat ditandai garis putus/abu, bukan merah (Linear project updates) | Koneksi: Terhubung · Data mungkin basi (garis putus, kuning) · Terputus (merah, satu-satunya) |
| Status tracker: status terbaru menonjol, kata biasa, tahap ringkas (NN/g status trackers) | Kartu tugas: judul → tahap 5 segmen → siapa → lama berjalan → kalimat waktu tahap |
| Lozenge: label ≤ 2 kata, sentence case (Atlassian lozenge) | Status tugas berkata biasa (Dikerjakan, Antre, …) |
| Avatar group maks. 5 + "+N", berlabel (Atlassian avatar group); presence = titik + teks singkat (Slack) | Tim: yang aktif tampil penuh; siap dipanggil diringkas per divisi (avatar kecil + jumlah), bisa dibuka |
| Progressive disclosure ≤ 2 tingkat; `<details>` untuk yang kurang penting saja (NN/g; GOV.UK details; APG disclosure) | Rincian teknis aktivitas, "Lihat semua", "Tentang halaman ini" dibuka-tutup; "Menunggu Anda" tidak pernah disembunyikan |
| Tooltip = info tambahan, juga lewat fokus, bukan satu-satunya jalan (NN/g tooltip) | Kepanjangan singkatan lewat `abbr`/`title` + daftar di "Tentang"; petunjuk kontrol di panel "?" (klik/ketuk) |
| Akronim: eja penuh di tempat lega, singkatan di ruang sempit (Microsoft style guide; GOV.UK writing for UI) | Jabatan resmi di panel; singkatan baku di linimasa & denah |
| Status message: satu live region atomik, polite, tidak cerewet (WCAG 4.1.3; MDN live regions) | Satu kalimat ringkasan `role=status aria-atomic`, diganti hanya saat angkanya berubah; aktivitas `role=log aria-live=off` |
| Waktu absolut + tooltip lengkap; angka tabular (Primer RelativeTime; MDN font-variant-numeric) | Jam "17.21" + `<time datetime title>`; `tabular-nums` di angka, jam, durasi |
| Glassmorphism di atas 3D, sparkline per angka, donut/gauge tidak cocok untuk hitungan (riset desain panel) | Kotak polos berbatas tipis; angka besar saja |

Tata letak (laptop ≥ 1180 px; kolom samping 372 px):
```
 Kantor RudisOne  17.21 WIB · sore                                   ( ● Terhubung · data terkini )
 [1 ! Menunggu Anda      ][7 ▶ Sedang bekerja ][5 Tugas berjalan    ][3 ✓ Selesai hari ini  ]
 ┌ Perlu perhatian Anda (hanya bila ada) ─────────────────────────────────────────────────────┐
 ┌ Denah 3D ─────────────────────────────────┐ ┌ Tugas berjalan (≤ 4 kartu + Lihat semua) ┐
 │ legenda 5 status · kamera · Label · Jeda · ? │ │ Selesai hari ini (≤ 6, judul ≤ 2 baris)  │
 ├ Aktivitas terbaru (per tugas, 10 baris) ──┤ ├ Tim (aktif penuh, siap diringkas)        ┤
 ├ Linimasa 60 menit (singkatan + sumbu) ─────┤ └──────────────────────────────────────────┘
 ▸ Tentang halaman ini
```
±1000 px: satu kolom; Tugas & Tim berdampingan di bawah denah. HP (< 760 px): satu kolom; "Menunggu Anda" selebar layar,
tiga angka lain sebaris (angka di atas, nama di bawah, tanpa kalimat); linimasa label 68 px.

- **Ringkasan atas:** Menunggu Anda (kalimat "BSA T1 menunggu jawaban Anda", tautan ke Perlu perhatian) · Sedang bekerja
  (= Bekerja + Berpikir, singkatan ≤ 3 + "+n") · Tugas berjalan (semua tugas register yang belum selesai; "n dikerjakan · n
  lainnya") · Selesai hari ini ("Terakhir: <judul>"). Status koneksi = pil di kanan atas kepala.
- **Perlu perhatian Anda:** pita selebar halaman tepat di bawah ringkasan: "<Jabatan> menunggu jawaban Anda" + "Buka
  percakapan “<judul>” di Claude untuk menjawab."
- **Kartu tugas:** status kata biasa + "Segera", ID · proyek (folder `ruang/<peran>` bukan proyek), judul, tahap (Fase register →
  `istilah.mjs` › `TAHAP`, 5 segmen; tugas tanpa tahap tidak menampilkannya), pemilik (+ status bila langkah terakhirnya
  untuk tugas ini) dan "dibantu <singkatan>" (yang sedang bekerja, aktivitas terakhirnya ber-ID tugas ini, **dan** berada di bawah
  pemilik dalam rantai komando atau dipanggilnya sebagai subagent — `jejak.mjs` › `pembantuTugas`; COO/pemberi tugas bukan pembantu),
  "Berjalan <durasi>" (sejak `dibuat` register), kalimat waktu tahap ("Tahap ini 12 mnt dari perkiraan 25 mnt" / "⏱ Melewati
  perkiraan tahap 6 mnt"; anggaran = `server.mjs` › `ANGGARAN_FASE`). Maks. 4 kartu + "Lihat semua tugas (n)"; tautan
  `?tugas=` ke kartu di luar empat teratas membuka semuanya.
- **Tim:** per divisi; baris lengkap untuk Bekerja/Berpikir/Menunggu Anda/Baru selesai (jabatan resmi, tanda "Pimpinan",
  kalimat kerja + "dipanggil <singkatan pemanggil>" + jumlah asisten); Siap dipanggil diringkas menjadi satu tombol "n siap
  dipanggil" (avatar ≤ 5, `aria-expanded`), dibuka → baris lengkap. Orang yang dipilih dari denah selalu tampil. Rincian (klik):
  Keadaan, Sedang dikerjakan, Selesai hari ini, Aktivitas terakhir (kalimat + rincian aman).
- **Aktivitas:** dikelompokkan per tugas (ID + judul; tanpa ID → "Di luar tugas terdaftar"), terbaru dulu. Langkah kerja
  seorang pelaku untuk tugas yang sama digabung menjadi satu kalimat selama jedanya ≤ 10 menit, walau diselingi pelaku lain
  ("Tech Lead · Tim 1 menjalankan 26 perintah, membaca 9 berkas dan mengubah 2 berkas (5 langkah)"). Satu kata kerja hanya
  sekali per kalimat: label bermakna sama digabung (`kunciLabel`: perintah terminal yang mengubah/memeriksa berkas ikut
  Edit/Read; Mengurus Git = Menyimpan versi kode), berkas dihitung dari nama yang berbeda, dan frasa berkata kerja sama
  menjadi satu kata kerja dengan beberapa objek (`gabungFrasa`: "menjalankan 2 perintah dan tes", "membaca 3 berkas serta 2
  halaman web dan mengubah berkas"); pesan, menunggu Anda, penerapan,
  dan penyerahan hasil selalu satu baris. 10 baris + "Lihat semua aktivitas (n)". Rincian teknis (deskripsi singkat agent,
  nama berkas, host web; ≤ 50 karakter, maks. 4) di "rincian" per baris — `rincianAman` membuang apa pun yang mirip perintah
  atau nama alat internal.
- **Linimasa:** label = singkatan baku (`abbr` berisi jabatan resmi), sumbu "60 mnt lalu · 30 mnt · sekarang".
- **Legenda & kontrol:** 5 status saja; kamera, Label, Jeda gerak, dan tombol **?** (panel "Cara memakai denah"; isi tetikus
  atau layar sentuh). Tanpa WebGL tombol ? disembunyikan bersama kontrol 3D.
- **Tentang halaman ini** (`<details>`, tertutup bawaan): sumber data & privasi, arti status, siapa yang punya ruang kerja,
  arti gerak, isi papan, "Bila Kantor terus terputus, minta COO menyalakannya kembali", dan daftar singkatan jabatan.

## Istilah
Satu sumber: `kantor/app/istilah.mjs` (diuji `kantor/istilah.test.mjs`). Bahasa Indonesia profesional, sentence case; jabatan
resmi bahasa Inggris seperti di organisasi.
- **Jabatan:** nama resmi di tempat lega (panel, aktivitas, kartu, perhatian, kartu sentuh); di tempat sempit (linimasa,
  label denah, ringkasan, "dibantu", "dipanggil") singkatan baku tabel protokol: COO · HoS · FC · RA · HRBP · TL Tn · BSA Tn ·
  SE1 Tn / SE2 Tn · PgM · TW · HITO · SysAdmin (`singkatan()`; `TIM[*].pendek` diisi dari sini).
- **Status orang:** Menunggu Anda ! · Bekerja ▶ · Berpikir … · Baru selesai ✓ · Siap dipanggil – (`STATUS`; legenda halaman
  diuji sama). "Sedang bekerja" (ringkasan) = Bekerja + Berpikir.
- **Status tugas:** Baru · Menyamakan persepsi · Dikerjakan · Ditinjau · Antre · Ditunda · Terhambat · Selesai.
  **Tahap:** Inisiasi · Analisis · Konstruksi · Pengujian · Rilis.
- **Waktu:** mnt · dtk · jam; "Berjalan 1 jam 4 mnt", "Baru selesai · 3 mnt lalu" (label status + waktu, satu bentuk di panel,
  kartu sentuh, dan aria), jam "17.21 WIB".
- **Kata kerja aktivitas** (`kerjaAktivitas`): menjalankan perintah / tes · memeriksa berkas · mengubah berkas · membaca
  berkas · memeriksa riwayat kode · menyimpan versi kode · memotret tampilan · memasang dependensi · mencari di web · membaca
  halaman web · memeriksa tampilan di peramban · bekerja di server · memasang rilis ke server · mengirim tugas / laporan /
  pertanyaan / revisi … ke <jabatan> · menerima pesan dari <jabatan> · menunggu jawaban Anda · menugaskan asisten ·
  menyerahkan hasil kerja · membuka ruang kerja baru · menyusun rencana kerja · menyusun ringkasan · memeriksa kemajuan tim ·
  membuka panduan kerja · mengurus domain; alat lain = "memakai alat kerja" (namanya tidak ditampilkan). Server memilih label
  perintah terminal dari deskripsi singkat agent lalu awal perintahnya (`jenisPerintah`); perintahnya tidak pernah dikirim.
- **Lainnya:** Pimpinan (bukan leader) · dipanggil <singkatan> (bukan "subagent") · asisten · percakapan (bukan "sesi") ·
  ruang kerja · Terhubung · data terkini / Data mungkin basi · diperbarui n dtk lalu / Terputus dari server Kantor · mencoba lagi.
- **Terlarang di tampilan** (`TERLARANG`; dipindai pada index.html, keluaran fungsi teks, dan halaman nyata & demo di peramban):
  ngopi · subagent · leader · sesi · nama alat internal (SubagentHandback, mcp__…, ToolSearch) · singkatan lama (Lead T1,
  Strategy/Finance/Research tanpa jabatan lengkap) · perintah mentah (perl/sed/git/cat/curl/npx/bash -…) · nama berkas skrip
  (*.sh, *.mjs, *.py) di luar "rincian".

## Token
Warna halaman = variabel CSS di `kantor/index.html` (`:root` dan blok `prefers-color-scheme: dark`); warna 3D =
`PALET` di `kantor/app/adegan.mjs` (terang / gelap). Kode adalah sumbernya; ubah bersamaan dengan berkas ini.
- **Dasar (terang / gelap):** latar `#E8EDF2` / `#0E151D`, permukaan `#FFFFFF` / `#141E28`, tinta `#1D2833` / `#E4EBF2`,
  redup `#5E6E7E` / `#8FA0B1`, panggung (gradien di belakang kanvas) `#F3F6F9`→`#DFE6ED` / `#121C26`→`#0B1117`.
- **Teks peringatan (terang / gelap):** `--menunggu-teks` `#8A5A00` / `#F6C063` (kalimat "Menunggu Anda" & "Melewati perkiraan" di atas
  permukaan; amber status sendiri terlalu pucat untuk teks).
- **Status (terang / gelap):** Bekerja `#1F9D6A` / `#34C38A` (▶), Berpikir `#3B7BD8` / `#5B97EF` (…), Menunggu Anda `#D9930B` /
  `#F0AA2A` (!), Baru selesai `#148A9C` / `#3FB6C8` (✓), Siap dipanggil `#8A97A6` / `#7D8B99` (–), tim kosong = garis putus-putus.
  Layar monitor: bekerja = warna peran terang, berpikir/menunggu = setengah, baru selesai = setengah toska, siap = sangat redup, tim kosong = mati. Galat `#D64545` / `#EF6461` hanya untuk
  galat/terputus.
- **Identitas peran:** COO `#B8892B`, Head of Strategy `#B07A1F`, Financial Controller `#3E9E5C`, Research Analyst `#1FA3AE`,
  HR Business Partner `#D35F9A`, Tech Lead `#5B3FB8`, Business Systems Analyst `#3D7BD9`, Software Engineer #1 `#7C5CD6` dan #2
  `#9A7BE6`, Program Manager `#E08A2E`, Technical Writer `#C9A227`, Head of IT Operations `#475BD1`, System Administrator `#D9534F`.
  Warna peran = warna baju karakter & layar monitornya.
- **Zona:** lantai = warna dasar lantai dicampur warna zona 20% (terang) / 8% (gelap) — Pimpinan `#C9A47A` (lantai kayu),
  Engineering `#7C5CD6`, IT Operations `#475BD1`, Layanan bersama `#E08A2E`, Corporate Strategy `#1FA3AE`, Lounge `#D39A5B`.
- **Bahan 3D (terang / gelap, kekasaran):** lantai ubin `#EEF1F4` / `#1B2530` (0,82), lorong `#E3E8EE` / `#18212B` (0,95), kayu
  lantai `#D9BB93` / `#5A4632` (0,55), meja oak `#D8C2A3` / `#5B4A3A` (0,5), walnut `#7D5538` / `#4A3222` (0,45), kain kursi
  `#5F6D7A` / `#3A4653` (0,95), sofa `#6F93AD` / `#3E5A70` (0,95), partisi `#CDD5DD` / `#2F3D4B`, kaca `#BCD8EA` / `#3C6684`
  (opasitas .28, 0,06), aluminium `#9AA5B0` (logam .7, 0,35). Tekstur ubin, serat kayu, dan karpet dibuat kanvas saat muat.
- **Cahaya (terang / gelap):** Hemisphere langit `#FFFFFF` / `#7F9CC4`, tanah `#D9D3C9` / `#1A1F26`, 0,95 / 0,8; matahari
  `#FFF1DC` / `#FFD9A8`, 3,0 / 1,3, dari belakang-kiri atas; IBL 0,35 / 0,3; tone mapping Neutral, exposure 1.
- **Huruf:** Bricolage Grotesque (judul & papan zona), Geist (UI & angka, `tabular-nums`) — disalin lokal (OFL).
- **Gerak:** momen utama = orang berjalan antar-meja saat bertukar pesan (1,25–1,45 m/dtk, berbelok halus); selebihnya
  halus — mengetik, melambai saat menunggu, minum kopi.

## Kinerja & keadaan khusus
- Anggaran: draw call ≤ 100 (terukur ±70 desktop & HP dengan semua jabatan hadir, ±77 di demo dengan asisten; gambar yang
  sekaligus menghitung ulang peta bayangan ±93 / ±99 demo: perabot statis digabung per material ±35, orang 1 per orang, layar,
  bayangan kontak, map, genangan lampu, nama zona (papan atau tulisan lantai) 1 masing-masing, kap lampu 4, papan 5; buku di rak tidak ikut peta bayangan), pixel ratio ≤ 2 (HP 1,5), peta bayangan 2048² (HP 1024²) digambar sekali, tanpa post-processing.
- Gambar ulang hanya bila perlu: kamera bergerak, orang/benda bergerak atau beranimasi, data berubah, ukuran/tema berubah.
  Diam + Jeda gerak / reduced-motion → 0 gambar per detik. Ukur dengan `?ukur=1` (bingkai/dtk, gambar/dtk, ms/gambar,
  draw call, segitiga).
- **Tanpa WebGL 2:** denah diganti kotak "Denah 3D tidak bisa ditampilkan di peramban ini" + sebab + yang bisa dicoba;
  panel samping, linimasa, dan tautan `?tugas=` tetap berfungsi. Konteks WebGL hilang → pesan untuk memuat ulang.
- `?demo=<detik>`: skenario contoh berulang 70 detik, mulai dari detik tertentu (untuk tangkapan layar yang dapat diulang).

## Sumber
- Gather — Best Practices in Office Design: https://support.gather.town/hc/en-us/articles/15910372095508
- Roam — virtual office platform: https://ro.am/virtual-office-platform
- Perbandingan kantor virtual (Kumospace, SoWork): https://www.sowork.com/alternatives/kumospace-vs-sowork
- Claude-Office (W17ant): https://github.com/W17ant/Claude-Office
- Pixel Agents (VS Code): https://github.com/NoMercy-Entertainment/pixel-agents
- Gensler — Fujitsu HQ: https://gensler.com/projects/fujitsu
- Haworth — Future leadership offices: https://blog.haworth.com/na/en/spark/articles/2019/future-leadership-offices.html
- IKEA Business — Office break room ideas: https://www.ikea.com/gb/en/ikea-business/how-to/four-easy-and-fun-office-break-room-ideas-pub3a5db070/
- Generative Agents (Smallville): https://gonzoml.substack.com/p/generative-agents-interactive-simulacra
- Pola FSM NPC: https://blog.recroom.com/posts/cv2-state-machine
- Panduan dashboard multi-agent: https://www.browseract.com/blog/multi-agent-management-dashboard-guide
- ServiceNow Horizon — presence icon: https://horizon.servicenow.com/components/now-icon-presence
- Nielsen Norman Group — 2D is Better Than 3D: https://www.nngroup.com/articles/2d-is-better-than-3d/
- Autodesk Research — ViewCube: https://research.autodesk.com/app/uploads/2023/03/viewcube-a-3d-orientation.pdf_recsg8BsEjf1BeIbZ.pdf
- Bruno Simon — my-room-in-3d (cahaya terpanggang): https://github.com/brunosimon/my-room-in-3d
- three.js docs — HemisphereLight, RoomEnvironment, WebGLRenderer, OrbitControls, MapControls, CSS2DRenderer:
  https://threejs.org/docs/
- Discover three.js — Tips & Tricks: https://discoverthreejs.com/tips-and-tricks/
- CloudAI-X threejs-skills (fundamentals, lighting, materials, performance; r186): https://github.com/CloudAI-X/threejs-skills
- Gaurav2693/ai-office (kantor 3D three.js, FOV 30): https://github.com/Gaurav2693/ai-office
- model-viewer — Tone mapping (Khronos PBR Neutral): https://modelviewer.dev/examples/tone-mapping
- MathWorks — Understanding view projections: https://fr.mathworks.com/help/matlab/visualize/understanding-view-projections.html
- Google Maps JS API — gestureHandling: https://developers.google.com/maps/documentation/javascript/interaction
- three.js forum — Accessible app with CSS2DRenderer: https://discourse.threejs.org/t/accessible-app-with-css2drenderer/84921
- Mapbox Style Spec — Layers (symbol: text-optional, symbol-sort-key, minzoom, text-pitch-alignment): https://docs.mapbox.com/style-spec/reference/layers/
- Google Maps Platform — Advanced Markers collision behavior: https://developers.google.com/maps/documentation/javascript/advanced-markers/collision-behavior
- NN/g — Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- NN/g — Tooltip Guidelines: https://www.nngroup.com/articles/tooltip-guidelines/
- W3C — Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C — Understanding SC 1.4.1 Use of Color: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- W3C — Understanding SC 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- W3C — Understanding SC 1.4.13 Content on Hover or Focus: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- WAI-ARIA APG — Tooltip pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- DHA/MHS — Wayfinding Guidelines and Signage Standards (2022): https://www.wbdg.org/FFC/DHA/wayfinding_guidelines_signage_stds_mhs_fac_17nov2022.pdf
- Carbon Design System — Content switcher: https://carbondesignsystem.com/components/content-switcher/usage/
- ArcGIS — label deconfliction strategy: https://developers.arcgis.com/kotlin/api-reference/arcgis-maps-kotlin/com.arcgismaps.mapping.labeling/-label-definition/deconfliction-strategy.html
- kevinschaul/avoid-overlap: https://github.com/kevinschaul/avoid-overlap
- MDN — WebGL best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- Chrome for Developers — DevTools performance & real-world data: https://developer.chrome.com/blog/devtools-grounded-real-world
- W3C — Understanding SC 2.3.3: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- GOV.UK Design System — Error message: https://design-system.service.gov.uk/components/error-message/
- Claude Code Docs — agent view: https://code.claude.com/docs/en/agent-view
- Carbon — Status indicator pattern: https://carbondesignsystem.com/patterns/status-indicator-pattern/
- NN/g — Dashboards & preattentive processing: https://www.nngroup.com/articles/dashboards-preattentive/
- Linear — Initiative and project updates: https://linear.app/docs/initiative-and-project-updates
- NN/g — Status trackers and progress updates: https://www.nngroup.com/articles/status-tracker-progress-update/
- Atlassian — Lozenge: https://atlassian.design/components/lozenge/usage · Avatar group: https://atlassian.design/components/avatar-group/usage
- Slack — Status & availability: https://slack.com/help/articles/201864558-Set-your-Slack-status-and-availability
- GOV.UK Design System — Details: https://design-system.service.gov.uk/components/details/
- WAI-ARIA APG — Disclosure: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- Microsoft Writing Style Guide — Acronyms: https://learn.microsoft.com/en-us/style-guide/acronyms
- GOV.UK Service Manual — Writing for user interfaces: https://www.gov.uk/service-manual/design/writing-for-user-interfaces
- Atlassian — Designing messages: https://atlassian.design/foundations/content/designing-messages/
- NN/g — Indicators, validations, notifications: https://www.nngroup.com/articles/indicators-validations-notifications/
- W3C — Understanding SC 4.1.3 Status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- MDN — ARIA live regions: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
- MDN — font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Primer — RelativeTime: https://primer.style/components/relative-time
- Grafana — Dashboard best practices: https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/
