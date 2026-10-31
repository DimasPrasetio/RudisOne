# Brief desain — Kantor RudisOne (v4, organisasi v3)

Dibuat 2026-10-23 mengikuti skill `rudis-riset-desain`. Masukan pengguna atas v3: **jelek, sempit, tidak
menarik**; minta area istirahat terpisah (sofa, kopi, ngobrol bersama), divisi terlihat jelas, COO di meja
pimpinan yang terpisah, dan saat memberi tugas **COO memanggil, bawahan yang menghampiri** — bukan
sebaliknya. Token warna & huruf v2 tetap berlaku (bagian di bawah); v4 mengganti denah dan cerita gerak.

Catatan nama (2026-10-24): peran memakai nama jabatan sekarang — COO, Head of Strategy, Financial Controller,
Research Analyst, HR Business Partner, Tech Lead, Business Systems Analyst, Software Engineer, Program Manager,
Technical Writer, Head of IT Operations, System Administrator; divisi Operations menjadi IT Operations, "buku
besar" menjadi register tugas. Nama lama hanya tersisa di bagian riwayat v2/v3.

## Subjek, audiens, tugas utama
- **Subjek:** kantor RudisOne v3 — COO, tiga divisi (Engineering, IT Operations, PMO) dengan leader dan
  anggota kolam, staf COO, dan 13 kursi (Software Engineer #1–#3 masing-masing punya meja).
- **Audiens:** pemilik tim, memantau sambil bekerja (layar lebar), sesekali dari HP.
- **Tugas utama layar:** dalam 3 detik: siapa sedang bekerja di divisi mana, siapa menunggu saya, dan apa
  yang sedang mengalir (tugas turun, laporan naik).

## Temuan riset → keputusan
| Temuan (sumber) | Keputusan |
|---|---|
| Gather: tiap departemen duduk di **Team Area berlabel**; tim yang sering berinteraksi diletakkan berdekatan; ukuran ruang sesuai jumlah orang (terlalu besar terasa kosong, terlalu kecil sesak); area jalan & pintu harus jelas | Zona per divisi dengan **lantai berwarna lembut + papan nama divisi**; Engineering (terbesar, 6 kursi) di tengah belakang dekat ruang pimpinan; lorong utama lurus yang menghubungkan semua zona; pintu tiap zona selalu kosong |
| Kantor eksekutif modern (Gensler/Fujitsu, Haworth, Algedra): wilayah pimpinan ditandai **material lantai berbeda & dinding kaca**, bukan ruang tertutup; ada meja kecil untuk tamu | **Ruang Pimpinan** di pojok belakang-kiri: lantai kayu, karpet, partisi kaca rendah dengan pintu, meja besar menghadap ruangan, **dua kursi tamu** di depannya — titik tempat bawahan berdiri saat dipanggil/melapor |
| Break room: dipisah dari area kerja yang tenang (partisi/tanaman), dekat stasiun kopi sebagai titik kumpul, sofa ber-sandaran tinggi membentuk "pod" ngobrol | **Lounge** besar di depan-kanan, dipisah tanaman & partisi rendah: bar kopi dengan mesin, sofa L + sofa berhadapan mengelilingi meja kopi di atas karpet, meja bundar; santai = ambil kopi dulu, lalu duduk dan mengobrol |
| Claude-Office / Pixel Agents: agent masuk lewat pintu, punya meja sendiri, gelembung mengetik, istirahat kopi | Dipertahankan; kursi per anggota (Software Engineer #1–#3), pintu masuk di lorong utama |
| Leader menghadap ruangan (pola meja pimpinan & "player-coach") | Meja leader divisi di belakang zonanya **menghadap anggota**; anggota duduk di meja baris depan |
| Isometrik: urutan gambar painter's algorithm berdasar kedalaman x+y; dinding depan dipotong (cutaway) agar orang tetap terlihat | Mebel dan orang diurutkan bersama per bingkai (kunci x+y); hanya dinding belakang yang tinggi, pembatas zona rendah/kaca |
| WCAG 2.2.2 (gerak otomatis) & 2.3.3; `prefers-reduced-motion` | Status tetap terbaca tanpa gerak; mode hemat gerak = langsung di tempat tanpa animasi, plus tombol **Jeda gerak** di legenda |

**Elemen khas:** alur komando yang terlihat — COO memanggil dari mejanya, bawahan berjalan ke kursi tamu,
menerima berkas, lalu kembali bekerja; laporan dibawa naik ke leader, lalu ke COO.

## Denah (unit isometrik; lantai 32 × 20)
```
            dinding belakang (jendela)
  ┌─────────────┬──────────────────────────┬──────────────────┐ y=0
  │ RUANG       │ ENGINEERING              │ IT OPERATIONS    │
  │ PIMPINAN    │  [meja Tech Lead]        │ [meja IT Ops]    │
  │ [meja COO]  │   tamu ·                 │  tamu ·  [rak]   │
  │  tamu tamu  │ BA  SA  E#1  E#2  E#3    │  SysAdm  [layar] │
  ├──pintu──────┴────────── lorong utama ──┴──────────────────┤ y=8–10  ← pintu masuk (kiri)
  │ PMO         │ STAF COO    ┊  LOUNGE                        │
  │ [meja PM]   │ Riset       ┊  bar kopi ☕   sofa L  ◯ meja  │
  │  tamu ·     │ Finance     ┊  karpet + meja kopi   sofa     │
  │ TW          │ [rak buku]  ┊  tanaman      meja bundar      │
  └─────────────┴─────────────┴───────────────────────────────┘ y=20
   x=0          8            15.5                             32
```
Desktop: denah selebar kolom kiri; panel kanan (perhatian, tim per divisi, aktivitas); linimasa di bawah.
HP: denah bisa digeser horizontal (lebar minimum ±760px) — denah tidak dikecilkan sampai tak terbaca.

## Cerita gerak
| Kejadian (dari transkrip) | Animasi |
|---|---|
| Atasan → bawahan `[Tugas …]` / `[Revisi]` / `[Permintaan staf]`, atau COO membuat sesi | Atasan tetap duduk, gelembung "<nama>, ke meja saya"; bawahan berdiri ("Baik"), berjalan ke kursi tamu atasan, menerima berkas ("Siap ✓"), lalu ke mejanya dan bekerja |
| Bawahan → atasan `[Laporan …]`, atau bawahan selesai satu giliran kerja | Bawahan membawa berkas ke kursi tamu atasan, "Laporan selesai"; atasan "Terima kasih"; bawahan kembali (ke lounge bila santai) |
| Atasan → bawahan `[Diterima]` | Atasan "Diterima ✓", bawahan "Terima kasih" di tempat — tanpa berjalan |
| Sesama `[Konsultasi]`/`[Jawaban]`/`[Info]` | Pengirim menghampiri meja penerima, gelembung tanya-jawab, kembali |
| Santai | Ke bar kopi (mengambil cangkir), lalu duduk di sofa/meja bundar; bila ada teman di dekatnya, mengobrol bergantian; sesekali pindah |
| Sesi muncul / diarsipkan | Masuk lewat pintu ke mejanya / keluar lewat pintu |

Atasan ditentukan dari struktur v3 (`protokol.md`): COO → leader & staf; Tech Lead → BA, SA,
Software Engineer #n; Head of IT Operations → System Administrator; Program Manager → Technical Writer. Jenis
pesan diambil dari tag `[…]` di awal pesan saja — isi pesan tidak pernah dikirim ke halaman.

## v4.1 — poles hasil telaah desain (2026-10-23)
Telaah ulang dengan tangkapan layar menemukan cacat tumpukan gambar, teks terlalu kecil, suasana datar, dan
karakter yang seragam. Perbaikan:

| Masalah | Keputusan |
|---|---|
| Papan "Ruang Pimpinan" tertutup rak buku; orang di bar tertutup kulkas | Lapisan tetap: lantai → bayangan & cahaya → perabot+orang (urut kedalaman) → papan nama, label meja & nama → gelembung & berkas. Papan nama di pita atas dinding / tepi lantai depan, lebar diukur setelah font siap. Kulkas dipindah ke ujung bar |
| Teks 9,5–10,5px; penanda ganda (cincin + lencana + label) | Teks denah min. 10,5–12px (gelembung 11px, papan 14/11,5px); cincin lantai hanya untuk "menunggu Anda"; label nama hanya saat di luar meja, di lapisan atas; papan meja orang yang santai diredupkan |
| Denah hanya ±60% lebar, banyak ruang kosong | Kolom samping 340px, kotak tampilan dipangkas; tombol **− / + / Seluruh denah** (zoom 1–2,8×) dan geser dengan seret saat diperbesar (klik meja tetap berfungsi) |
| Suasana datar, zona gelap sulit dibedakan, pintu tak terlihat | Bayangan lembut di bawah perabot, cahaya jendela jatuh ke lantai, opasitas zona naik di tema gelap, karpet lorong, kusen + keset + tanda keluar di pintu masuk |
| Karakter seragam | Gaya per kursi: rambut (cepak, samping, panjang, kuncir, keriting, botak+topi) dan aksesori (jas+dasi COO, kacamata, headset Head of IT Operations, hoodie engineer, lanyard, dasi); mata & pipi saat menghadap depan; tampak belakang menutupi wajah & aksesori depan; gelembung berekor |

## v5 — denah organisasi v4 (2026-10-24)
Organisasi v4 mengubah isi kantor; bahasa visual v4.1 (token, lapisan, karakter,
cerita gerak) tetap. Denah 40 × 21:

```
  ┌───────────┬───────────────┬───────────────┬───────────────┐ y=0
  │ RUANG     │ ENG · TIM 1   │ ENG · TIM 2   │ ENG · TIM 3   │   tiap pod: meja Tech Lead menghadap tim,
  │ PIMPINAN  │ (proyek A)    │ (proyek B)    │ (redup bila   │   BSA · SE1 · SE2 di baris depan, papan tulis
  │           │               │               │  belum dipakai)│
  ├─pintu─────┴──── lorong utama (karpet) ─────┴───────────────┤ ← pintu masuk (kiri)
  │ CORPORATE      │ LAYANAN   │ IT OPS      ┊ LOUNGE           │
  │ STRATEGY       │ BERSAMA   │ IT Ops lead ┊ bar kopi, sofa L,│
  │ Strategy lead, │ PM lead,  │ SysAdmin,   ┊ pouf, meja bundar│
  │ Finance·Riset· │ TW        │ rak server  ┊ bangku, berdiri  │
  │ HRBP (siaga)   │           │             ┊                  │
  └────────────────┴───────────┴─────────────┴──────────────────┘ y=21
```
- Kursi tim dipetakan per proyek: server membaca nomor tim dari `TEAM.md` (`## Engineering · Tim <n> · <proyek>`)
  atau, bila belum ada, memberi nomor kosong terkecil saat sesi tim proyek itu pertama terlihat. Id teknis
  (`coo`, `tech-lead`, `software-engineer`, …) dikenali sebagai nama peran. Hanya sesi RudisOne yang tampil
  (folder repo ini, worktree `r<n>-…`, `/rudisone`, atau pembuka "… di RudisOne"); sistem agent lain di device yang
  sama diabaikan.
- Papan nama tim menampilkan proyeknya; tim tanpa proyek diredupkan dan disembunyikan dari panel & linimasa.
- 20 titik santai (bar, sofa, pouf, meja bundar, bangku, berdiri) — cukup untuk semua kursi selain COO.

## v6 — inti kecil + subagent, register JSON (2026-10-30)
Organisasi kini "inti kecil + subagent": sesi tetap hanya COO, IT Operations (Head of IT Operations dan
System Administrator), dan Tech Lead tim yang punya proyek. Peran lain dipanggil sebagai subagent dari definisi
peran `rudis-<id-peran>`. Denah dan bahasa visual tidak berubah; yang berubah arti kursi kosong.
- **Subagent peran duduk di kursinya.** Server membaca `agentType` di `subagents/agent-<id>.meta.json`; nilai
  `rudis-<id-peran>` (boleh berawalan plugin, `x:rudis-…`) → kursi peran itu (peran tim memakai tim pemanggil;
  engineer: nomor "#n" di deskripsi/pembuka, selain itu kursi #1/#2 yang kosong). Bila meta tidak punya `agentType`,
  dikenali dari pembuka "Kamu adalah <Jabatan> …". Subagent bertipe lain (general-purpose, Explore, …) tetap tampil
  sebagai asisten di kursi pemanggil. Subagent berjalan = sedang bekerja; selesai → kursi kembali ke katalog,
  tetapi langkahnya tetap ada di log & linimasa.
- **Keadaan peran (`mode` di /state):** *aktif* (sesi hidup bekerja/berpikir/menunggu, atau subagent berjalan) ·
  *siaga* (sesi hidup tapi santai — ke lounge seperti biasa) · *katalog* (tidak ada sesi; dipanggil saat perlu) ·
  *absen* (hanya untuk kursi sesi tetap yang belum masuk). `status` lama tetap dikirim (`absen` untuk yang tidak
  hadir) agar klien lama tidak rusak.
- **Tampilan katalog:** redup dan netral — tag meja opasitas .4, avatar berlatar warna peran 14% (bukan garis putus
  "offline"), simbol bertitik, teks "Dipanggil saat perlu · <peran>". Tidak ada merah. Legenda: Siaga · Katalog ·
  "Sesi tetap belum masuk".
- **Penanda subagent:** lencana kecil "subagent · <pemanggil>" di panel tim, baris aksi meja "subagent dari
  <pemanggil>", dan "Subagent dari …" di rincian sesi. Privasi tetap: hanya deskripsi singkat (≤ 50 karakter) dari
  meta.json dan nama alat/berkas, tidak pernah isi prompt.
- **Register tugas:** papan "Tugas berjalan" membaca `handoff/register-tugas.json` (sumber kebenaran, ditulis
  `bin/register.sh`) bila ada dan terbaca; selain itu (atau bila JSON rusak) tabel MD lama lewat `bacaRegister`.

## Token tambahan v4
- **Zona (tint lantai 8–10%):** Pimpinan kayu `#C9A47A`/gelap `#5A4632`; Engineering `#7C5CD6`; IT Operations
  `#475BD1`; PMO `#E08A2E`; Staf `#1FA3AE`; Lounge karpet hangat `#E7DFD3`/gelap `#2A2620`.
- **Identitas kursi baru:** Tech Lead `#5B3FB8`; Software Engineer #1/#2/#3 `#7C5CD6`/`#9A7BE6`/`#6A4FC4`.
- Label zona: Bricolage Grotesque 13px; label nama karakter di luar meja: Geist 9.5px.

## Sumber (diakses 2026-10-23)
- Gather — Best Practices in Office Design: https://support.gather.town/hc/en-us/articles/15910372095508
- Gather — Studio Overview: Editing Your Office: https://support.help.gather.town/articles/1963307749
- Claude-Office (W17ant): https://github.com/W17ant/Claude-Office
- The-Office — Avi Levi: https://www.avilevi.co.il/en/projects/the-office/
- Gensler — Fujitsu HQ: https://gensler.com/projects/fujitsu
- Haworth — Future leadership offices: https://blog.haworth.com/na/en/spark/articles/2019/future-leadership-offices.html
- Algedra — Executive suite / CEO office design trends: https://algedra.ae/en/blog/executive-suite-ceo-office-design-trends
- WorkLife — C-suite transparency: https://www.worklife.news/spaces/c-suite-transparency/
- Raccoon — Office design (zona & breakout): https://www.raccoon.co.uk/blog/office-design
- World-Architects — Dewan New Offices (breakout memisahkan departemen): https://world-architects.com/es/intercon-barcelona/project/dewan-new-offices
- IKEA Business — Office break room ideas: https://www.ikea.com/gb/en/ikea-business/how-to/four-easy-and-fun-office-break-room-ideas-pub3a5db070/
- AJ Products — Acoustic sofas: https://ajproducts.co.uk/reception-lounge/seating/acoustic-sofas
- Isometric depth sorting: https://bugnet.io/blog/how-to-fix-isometric-tilemap-sprite-depth-sort-overlap ·
  https://www.parallelrealities.co.uk/tutorials/isometric/isometric1.php
- W3C — Understanding SC 2.3.3: https://w3c.github.io/wcag/understanding/animation-from-interactions.html ·
  Deque 2.3.3: https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions

---

# Riwayat: v2 (token & prinsip yang tetap berlaku) dan v3

## Brief v2 (2026-10-22)

Dibuat 2026-10-22 setelah riset (sumber di bawah). Versi 1 (pixel-art) ditolak pengguna karena terasa kuno.

## Subjek, audiens, tugas utama
- **Subjek:** satu COO dan 8 agent AI spesialis yang bekerja paralel di sesi Claude Desktop.
- **Audiens:** pemilik tim (satu orang), memantau sambil bekerja di layar lebar maupun dari HP.
- **Tugas utama layar:** dalam 3 detik menjawab "siapa sedang mengerjakan apa, dan adakah yang menunggu
  saya?" Detail baru muncul saat diminta.

## Temuan riset → keputusan
| Temuan | Keputusan |
|---|---|
| Kantor virtual modern (Roam, Kumospace) memakai denah dari atas yang bersih dengan ruang bernama, bukan pixel art | Denah **isometrik vektor** dengan zona/ruang per agent, berlabel nama |
| Dashboard multi-agent: peta organisasi dengan status live, linimasa/swimlane, titik persetujuan menonjol, state basi/galat eksplisit | **COO di tengah sebagai hub**, 8 ruang mengelilingi; panel **Perlu perhatian Anda** paling atas; **linimasa 60 menit** per agent; banner koneksi & "diperbarui … lalu" |
| Calm design 2026: elemen non-esensial disembunyikan, warna menandai status bukan hiasan | Lantai & mebel netral; warna kuat hanya untuk status dan identitas agent; detail lewat panel samping |
| Isometrik = kedalaman tanpa render berat; soft-3D secukupnya untuk alat produktivitas | Bentuk isometrik datar dengan 3 nada sisi (atas/kiri/kanan), bayangan lembut; tanpa WebGL |
| Indikator presence: jangan hanya warna, pakai simbol + label, kontras tinggi | Status = **warna + simbol + label teks** di cincin lantai dan di daftar |

## Token
- **Warna (terang):** latar `#E8EDF2`, lantai `#F6F8FA`, garis ubin `#DDE4EB`, partisi `#C9D3DD`, tinta `#1D2833`, redup `#5E6E7E`.
- **Warna (gelap):** latar `#0E151D`, lantai `#18222D`, garis `#243241`, partisi `#2E3E4E`, tinta `#E4EBF2`, redup `#8FA0B1`.
- **Status:** Bekerja `#1F9D6A` (▶), Berpikir `#3B7BD8` (…), Menunggu Anda `#D9930B` (!), Santai `#8A97A6` (–), Belum masuk = garis putus-putus. Merah `#D64545` hanya untuk galat/terputus.
- **Identitas agent:** COO `#B8892B`, System Administrator `#D9534F`, Program Manager `#E08A2E`,
  Business Systems Analyst `#3D7BD9`, Software Engineer `#7C5CD6`, Research Analyst `#1FA3AE`,
  Financial Controller `#3E9E5C`, Technical Writer `#C9A227`.
- **Huruf:** Bricolage Grotesque (judul & label ruang — karakter tanpa terasa main-main), Geist (UI & angka,
  `tabular-nums`). Tanpa label huruf kapital semua, tanpa monospace dekoratif.
- **Gerak:** satu momen utama — kurir berjalan antar-ruang saat agent berkirim pesan. Selebihnya halus:
  layar menyala berdenyut saat bekerja, titik "…" saat berpikir, lencana "!" berdenyut saat menunggu.
  `prefers-reduced-motion` → semua statis.

## Tata letak
```
Desktop ≥1100px
┌──────────────────────────────────────────────┬───────────────────────┐
│ Kantor RudisOne   20.45 WIB   ● Terhubung    │ Perlu perhatian Anda  │
├──────────────────────────────────────────────┤ (hanya bila ada)      │
│                                              ├───────────────────────┤
│        denah isometrik 3×3 ruang             │ Tim: 9 baris status   │
│        (COO di tengah)               │ (klik → rincian)      │
│                                              ├───────────────────────┤
├──────────────────────────────────────────────┤ Aktivitas terbaru     │
│ Linimasa 60 menit: 9 jalur per agent         │                       │
└──────────────────────────────────────────────┴───────────────────────┘
HP: judul → perhatian → denah → tim → linimasa (gulir horizontal) → aktivitas
```
Rata kiri untuk teks; denah di tengah kanvasnya.

## Prinsip
1. Status selalu terbaca tanpa animasi (simbol + teks); animasi hanya memperkuat.
2. Jujur: ruang kosong = agent belum masuk; data basi atau koneksi putus selalu ditampilkan.
3. Satu hal yang diingat: denah hub-and-spoke yang mencerminkan struktur tim sebenarnya.
4. Privasi: hanya metadata aktivitas, tidak pernah isi file/pesan/output.

## v3 — Gerak & cerita kerja (riset 2026-10-22)
Masukan pengguna: karakter v2 diam di tempat; harus terasa seperti orang bekerja — santai di area
istirahat/berjalan-jalan, berjalan ke meja saat bekerja, dan aktivitas yang masuk akal (atasan menghampiri
memberi tugas, lalu agent mulai mengerjakan).

| Temuan (sumber) | Keputusan |
|---|---|
| Pixel Agents: agent aktif mencari jalan ke kursinya lalu animasi mengetik/membaca sesuai jenis alat; agent idle berjalan acak lalu kembali; gelembung saat menunggu input; data dari `~/.claude/projects/*.jsonl` | Status bekerja → berjalan ke meja, pose sesuai alat (mengetik untuk menulis/perintah/tes, membaca untuk baca/riset); idle → area istirahat & jalan-jalan; menunggu → angkat tangan + "!" |
| Generative Agents (Smallville): agen berpindah antar lokasi sesuai rutinitas dan berhenti mengobrol saat bertemu | Area istirahat (sofa, bar kopi, meja bundar) sebagai tujuan santai; dua agent santai sesekali mengobrol |
| Office Simulation: pekerja menumpuk di titik yang sama dan tak sampai tujuan | Titik istirahat **dipesan** satu per agent; tidak ada dua agent di titik yang sama |
| Pola FSM NPC: pisahkan mesin status, gerak, dan kondisi | Status dari server ≠ perilaku di layar: tiap karakter punya antrean **skenario** (delegasi, lapor) yang didahulukan, lalu kembali ke perilaku sesuai status |
| Isometrik: lintasan sejajar sumbu iso terlihat benar; arah hadap dari kecepatan; potong zig-zag | Graf titik jalan berlorong sejajar sumbu (pintu partisi segaris), BFS, kecepatan konstan, karakter menghadap arah gerak |

**Cerita yang dianimasikan** (dari data nyata transkrip):
1. *Delegasi* — COO mengirim tugas (`SendMessage`/memanggil sesi): COO berdiri, berjalan
   ke agent (di mana pun ia berada), menyerahkan berkas, kembali ke ruang tengah; agent mengangguk (✓),
   berjalan ke mejanya, mulai bekerja.
2. *Kerja* — di meja: mengetik / membaca / berpikir sesuai alat; layar menyala.
3. *Konsultasi* — agent → agent: pengirim menghampiri, keduanya bergelembung bicara, pengirim kembali.
4. *Lapor* — agent selesai satu giliran (bekerja → santai): membawa berkas ke COO, lalu ke area istirahat.
5. *Datang/pulang* — sesi muncul: masuk lewat pintu; sesi diarsipkan: berjalan keluar.

Tata letak: lantai diperpanjang dengan **area istirahat** di depan (sofa, bar kopi, meja bundar, karpet)
dan pintu masuk di dinding kiri. COO tetap di ruang tengah (pengawas), hanya berdiri untuk
menghampiri agent.

## Sumber riset (diakses 2026-10-22)
- Pixel Agents (VS Code): https://github.com/NoMercy-Entertainment/pixel-agents ·
  https://marketplace.visualstudio.com/items?itemName=pablodelucca.pixel-agents ·
  https://medium.com/@orseni/pixel-agents-standalone-monitoring-every-claude-code-session-as-pixel-art-characters-bfc5d8f4bbdc
- Generative Agents (Smallville): https://gonzoml.substack.com/p/generative-agents-interactive-simulacra
- Office Simulation (catatan bug penumpukan): https://schokolasbotter.itch.io/office-simulation
- Pola FSM NPC: https://blog.recroom.com/posts/cv2-state-machine
- Lintasan & arah hadap isometrik: https://forum.arongranberg.com/t/face-player-towards-path/6517 ·
  https://forum.arongranberg.com/t/travelling-in-isometric-paths-cross-into-another-path/742
- Pemangkasan titik jalan: https://pkg.go.dev/github.com/actfuns/pathfinding@v0.8.1
- Roam — virtual office platform: https://ro.am/virtual-office-platform
- Perbandingan kantor virtual (Kumospace, SoWork): https://www.sowork.com/alternatives/kumospace-vs-sowork
- Usulan Agent Hierarchy Dashboard, anthropics/claude-code #24537: https://github.com/anthropics/claude-code/issues/24537
- Microsoft AG-UI multi-agent workflow demo: https://devblogs.microsoft.com/agent-framework/ag-ui-multi-agent-workflow-demo/
- Panduan dashboard multi-agent: https://www.browseract.com/blog/multi-agent-management-dashboard-guide
- Tren SaaS UI 2026 (calm design): https://www.saasui.design/blog/7-saas-ui-design-trends-2026
- Contoh dashboard SaaS 2026: https://925studios.co/blog/saas-dashboard-design-examples-2026
- Tren ilustrasi web 2026 (isometrik): https://craftwork.design/blog/website-illustration-trends-2026-explained
- Tren UI/UX (soft 3D secukupnya): https://pixso.net/articles/7-ui-ux-design-trends/
- Desain avatar & indikator status: https://setproduct.com/blog/avatar-ui-design
- ServiceNow Horizon — presence icon: https://horizon.servicenow.com/components/now-icon-presence

## v7 — IT Operations saat dibutuhkan (2026-10-30)
Sesi tetap hanya COO dan Tech Lead tim yang punya proyek. Kursi Head of IT Operations dan System Administrator tanpa
sesi hidup tampil *katalog* ("Dipanggil saat perlu"), bukan *absen*; sesinya dibentuk COO saat ada tugas server,
insiden, data production, atau deploy.
