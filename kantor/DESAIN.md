# Brief desain — Kantor RudisOne

Brief desain tampilan Kantor RudisOne (`kantor/index.html`, data dari `kantor/server.mjs`), disusun mengikuti skill
`rudis-riset-desain`. Berkas ini memuat prinsip, denah, cerita gerak, dan token yang berlaku — bukan riwayat versi.

## Subjek, audiens, tugas utama
- **Subjek:** organisasi agent RudisOne sebagai kantor: COO di ruang pimpinan, tiga pod Engineering (Tim 1–3), Corporate
  Strategy, Layanan bersama (Program Manager & Technical Writer), IT Operations, dan lounge.
- **Audiens:** pemilik tim, memantau sambil bekerja di layar lebar, sesekali dari HP.
- **Tugas utama layar:** dalam 3 detik menjawab: siapa sedang bekerja di divisi mana, siapa menunggu saya, dan apa
  yang sedang mengalir (tugas turun, laporan naik). Detail baru muncul saat diminta.

## Prinsip
1. **Status selalu terbaca tanpa animasi** (warna + simbol + teks); animasi hanya memperkuat.
2. **Jujur:** kursi tanpa sesi tampil apa adanya (katalog/absen); data basi atau koneksi putus selalu ditampilkan.
3. **Struktur organisasi terlihat:** denah mencerminkan rantai komando — atasan memanggil dari mejanya, bawahan
   menghampiri; laporan dibawa naik.
4. **Privasi:** hanya metadata aktivitas (nama alat, deskripsi singkat ≤ 50 karakter, nama berkas) — tidak pernah isi
   berkas, pesan, prompt, atau keluaran. Jenis pesan diambil dari tag `[…]` di awal pesan saja.
5. **Tenang:** lantai & perabot netral; warna kuat hanya untuk status dan identitas peran; tidak ada merah kecuali galat.
6. **Gerak aman:** `prefers-reduced-motion` dan tombol **Jeda gerak** membuat semuanya statis (WCAG 2.2.2, 2.3.3).

## Temuan riset → keputusan
| Temuan (sumber) | Keputusan |
|---|---|
| Kantor virtual modern (Roam, Kumospace, Gather): ruang bernama per tim, tim yang sering berinteraksi berdekatan, ukuran ruang sesuai jumlah orang, jalur & pintu jelas | Denah **isometrik vektor** dengan zona per divisi (lantai berwarna lembut + papan nama), lorong utama yang menghubungkan semua zona, pintu zona selalu kosong |
| Kantor eksekutif modern (Gensler/Fujitsu, Haworth, Algedra): wilayah pimpinan ditandai material lantai & dinding kaca, ada kursi tamu | **Ruang Pimpinan** berlantai kayu, partisi kaca rendah, meja besar menghadap ruangan, dua kursi tamu — tempat bawahan berdiri saat dipanggil/melapor |
| Break room dipisah dari area kerja tenang (partisi/tanaman), stasiun kopi sebagai titik kumpul, sofa membentuk pod ngobrol | **Lounge** terpisah tanaman & partisi rendah: bar kopi, sofa L, sofa berhadapan, pouf, meja bundar, bangku |
| Dashboard multi-agent: peta organisasi dengan status live, linimasa, titik persetujuan menonjol, state basi/galat eksplisit | Panel **Perlu perhatian Anda** paling atas; papan **Tugas berjalan**; **linimasa 60 menit**; banner koneksi & "diperbarui … lalu" |
| Pixel Agents / Claude-Office: agent masuk lewat pintu, punya meja, pose sesuai alat, istirahat kopi; data dari transkrip `~/.claude/projects` | Bekerja → ke meja dengan pose sesuai alat (mengetik/membaca/berpikir); santai → lounge; menunggu → angkat tangan + "!" |
| Generative Agents (Smallville), simulasi kantor: agen berpindah sesuai rutinitas dan mengobrol saat bertemu; titik yang dipakai bersama membuat penumpukan | Titik santai **dipesan** satu per orang; dua orang santai yang berdekatan sesekali mengobrol |
| Pola FSM NPC: pisahkan status, gerak, dan kondisi | Status dari server ≠ perilaku di layar: tiap karakter punya antrean skenario (delegasi, lapor) yang didahulukan |
| Isometrik: urutan gambar berdasarkan kedalaman x+y; dinding depan dipotong; lintasan sejajar sumbu iso | Perabot & orang diurutkan bersama per bingkai; hanya dinding belakang tinggi; graf titik jalan sejajar sumbu, BFS, kecepatan konstan, menghadap arah gerak |
| Indikator presence: jangan hanya warna; kontras tinggi | Status = warna + simbol + label teks |

## Denah (unit isometrik; lantai 40 × 21)
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
  │ HRBP           │           │             ┊                  │
  └────────────────┴───────────┴─────────────┴──────────────────┘ y=21
```
- Meja leader di belakang zonanya **menghadap anggota**; anggota di meja baris depan.
- Kursi tim dipetakan per proyek: nomor tim dari `TEAM.md` (`## Engineering · Tim <n> · <proyek>`) atau nomor kosong
  terkecil saat sesi tim proyek itu pertama terlihat. Papan nama tim menampilkan proyeknya; tim tanpa proyek diredupkan
  dan disembunyikan dari panel & linimasa.
- Hanya sesi RudisOne yang tampil (folder repo ini, worktree `r<n>-…`, `/rudisone`, atau pembuka "… di RudisOne"); sistem
  agent lain di device yang sama diabaikan.
- 20 titik santai — cukup untuk semua kursi selain COO.
- Desktop: denah selebar kolom kiri, kolom samping 340px (perhatian, tugas berjalan, tim per divisi, aktivitas),
  linimasa di bawah; tombol **− / + / Seluruh denah** (zoom 1–2,8×) dan geser dengan seret. HP: denah bisa digeser
  horizontal (lebar minimum ±760px) — tidak dikecilkan sampai tak terbaca.

## Cerita gerak
| Kejadian (dari transkrip) | Animasi |
|---|---|
| Atasan → bawahan `[Tugas …]` / `[Revisi]` / `[Permintaan …]`, atau COO membentuk sesi | Atasan tetap duduk, gelembung "<nama>, ke meja saya"; bawahan berdiri ("Baik"), berjalan ke kursi tamu atasan, menerima berkas ("Siap ✓"), lalu ke mejanya dan bekerja |
| Bawahan → atasan `[Laporan …]`, atau bawahan selesai satu giliran kerja | Bawahan membawa berkas ke kursi tamu atasan, "Laporan selesai"; atasan "Terima kasih"; bawahan kembali (ke lounge bila santai) |
| Atasan → bawahan `[Diterima]` | Atasan "Diterima ✓", bawahan "Terima kasih" di tempat — tanpa berjalan |
| `[Tinjau]` | Peninjau dipanggil ke meja pemberi tinjauan |
| Sesama `[Konsultasi]`/`[Jawaban]`/`[Info]` | Pengirim menghampiri meja penerima, gelembung tanya-jawab, kembali |
| Santai | Ke bar kopi (mengambil cangkir), lalu duduk di sofa/meja bundar; bila ada teman di dekatnya, mengobrol bergantian |
| Sesi muncul / diarsipkan | Masuk lewat pintu ke mejanya / keluar lewat pintu |

Atasan mengikuti rantai komando di `protokol.md`: COO → leader & staf Corporate Strategy; Tech Lead → BSA dan Software
Engineer #n; Head of IT Operations → System Administrator; Program Manager → Technical Writer.

## Keadaan peran
Hanya inti yang hidup sebagai sesi (COO dan Tech Lead tim yang punya proyek); IT Operations dibentuk saat dibutuhkan;
peran lain dipanggil sebagai subagent `rudis-<id-peran>`.
- **`mode` di /state:** *aktif* (sesi hidup bekerja/berpikir/menunggu, atau subagent berjalan) · *siaga* (sesi hidup
  tapi santai — ke lounge) · *katalog* (tidak ada sesi; dipanggil saat perlu — termasuk Head of IT Operations dan System
  Administrator tanpa sesi) · *absen* (kursi sesi tetap yang belum masuk). `status` lama tetap dikirim agar klien lama
  tidak rusak.
- **Subagent peran duduk di kursinya:** `agentType` di `subagents/agent-<id>.meta.json` bernilai `rudis-<id-peran>`
  (boleh berawalan plugin) → kursi peran itu (peran tim memakai tim pemanggil; engineer: nomor "#n" di deskripsi/pembuka,
  selain itu kursi #1/#2 yang kosong); tanpa `agentType`, dikenali dari pembuka "Kamu adalah <Jabatan> …". Subagent
  bertipe lain tampil sebagai asisten di kursi pemanggil. Selesai → kursi kembali ke katalog; langkahnya tetap di log &
  linimasa.
- **Tampilan katalog:** redup dan netral — tag meja opasitas .4, avatar berlatar warna peran 14%, simbol bertitik, teks
  "Dipanggil saat perlu · <peran>". Legenda: Siaga · Katalog · "Sesi tetap belum masuk".
- **Penanda subagent:** lencana "subagent · <pemanggil>" di panel tim, baris aksi meja "subagent dari <pemanggil>",
  dan "Subagent dari …" di rincian sesi.
- **Register tugas:** papan "Tugas berjalan" membaca `handoff/register-tugas.json` (sumber kebenaran, ditulis
  `bin/register.sh`); bila tidak ada atau rusak, tabel MD lewat `bacaRegister`.

## Lapisan & keterbacaan
- Lapisan tetap: lantai → bayangan & cahaya → perabot + orang (urut kedalaman) → papan nama, label meja & nama →
  gelembung & berkas. Papan nama di pita atas dinding / tepi lantai depan, lebar diukur setelah font siap.
- Teks denah minimal 10,5–12px (gelembung 11px, papan 14/11,5px); cincin lantai hanya untuk "menunggu Anda"; label nama
  hanya saat di luar meja; papan meja orang yang santai diredupkan.
- Suasana: bayangan lembut di bawah perabot, cahaya jendela di lantai, opasitas zona lebih tinggi di tema gelap, karpet
  lorong, kusen + keset + tanda keluar di pintu masuk.
- Karakter berbeda per kursi: rambut (cepak, samping, panjang, kuncir, keriting, botak+topi) dan aksesori (jas+dasi COO,
  kacamata, headset Head of IT Operations, hoodie engineer, lanyard, dasi); tampak belakang menutupi wajah & aksesori depan.

## Token
- **Warna (terang):** latar `#E8EDF2`, lantai `#F6F8FA`, garis ubin `#DDE4EB`, partisi `#C9D3DD`, tinta `#1D2833`, redup `#5E6E7E`.
- **Warna (gelap):** latar `#0E151D`, lantai `#18222D`, garis `#243241`, partisi `#2E3E4E`, tinta `#E4EBF2`, redup `#8FA0B1`.
- **Status:** Bekerja `#1F9D6A` (▶), Berpikir `#3B7BD8` (…), Menunggu Anda `#D9930B` (!), Santai `#8A97A6` (–), Belum masuk =
  garis putus-putus. Merah `#D64545` hanya untuk galat/terputus.
- **Identitas peran:** COO `#B8892B`, System Administrator `#D9534F`, Program Manager `#E08A2E`, Business Systems Analyst
  `#3D7BD9`, Software Engineer `#7C5CD6` (#1/#2/#3: `#7C5CD6`/`#9A7BE6`/`#6A4FC4`), Tech Lead `#5B3FB8`, Research Analyst
  `#1FA3AE`, Financial Controller `#3E9E5C`, Technical Writer `#C9A227`.
- **Zona (tint lantai 8–10%):** Pimpinan kayu `#C9A47A`/gelap `#5A4632`; Engineering `#7C5CD6`; IT Operations `#475BD1`;
  Layanan bersama `#E08A2E`; Corporate Strategy `#1FA3AE`; Lounge karpet hangat `#E7DFD3`/gelap `#2A2620`.
- **Huruf:** Bricolage Grotesque (judul & label ruang/zona 13px), Geist (UI & angka, `tabular-nums`; label nama karakter di
  luar meja 9.5px). Tanpa huruf kapital semua, tanpa monospace dekoratif.
- **Gerak:** momen utama = orang berjalan antar-meja saat bertukar pesan; selebihnya halus — layar menyala berdenyut saat
  bekerja, titik "…" saat berpikir, lencana "!" berdenyut saat menunggu.

## Sumber
- Gather — Best Practices in Office Design: https://support.gather.town/hc/en-us/articles/15910372095508
- Gather — Studio Overview: Editing Your Office: https://support.help.gather.town/articles/1963307749
- Roam — virtual office platform: https://ro.am/virtual-office-platform
- Perbandingan kantor virtual (Kumospace, SoWork): https://www.sowork.com/alternatives/kumospace-vs-sowork
- Claude-Office (W17ant): https://github.com/W17ant/Claude-Office
- The-Office — Avi Levi: https://www.avilevi.co.il/en/projects/the-office/
- Pixel Agents (VS Code): https://github.com/NoMercy-Entertainment/pixel-agents
- Gensler — Fujitsu HQ: https://gensler.com/projects/fujitsu
- Haworth — Future leadership offices: https://blog.haworth.com/na/en/spark/articles/2019/future-leadership-offices.html
- Algedra — Executive suite / CEO office design trends: https://algedra.ae/en/blog/executive-suite-ceo-office-design-trends
- WorkLife — C-suite transparency: https://www.worklife.news/spaces/c-suite-transparency/
- Raccoon — Office design (zona & breakout): https://www.raccoon.co.uk/blog/office-design
- World-Architects — Dewan New Offices: https://world-architects.com/es/intercon-barcelona/project/dewan-new-offices
- IKEA Business — Office break room ideas: https://www.ikea.com/gb/en/ikea-business/how-to/four-easy-and-fun-office-break-room-ideas-pub3a5db070/
- AJ Products — Acoustic sofas: https://ajproducts.co.uk/reception-lounge/seating/acoustic-sofas
- Generative Agents (Smallville): https://gonzoml.substack.com/p/generative-agents-interactive-simulacra
- Office Simulation: https://schokolasbotter.itch.io/office-simulation
- Pola FSM NPC: https://blog.recroom.com/posts/cv2-state-machine
- Isometric depth sorting: https://bugnet.io/blog/how-to-fix-isometric-tilemap-sprite-depth-sort-overlap ·
  https://www.parallelrealities.co.uk/tutorials/isometric/isometric1.php
- Lintasan & arah hadap isometrik: https://forum.arongranberg.com/t/face-player-towards-path/6517
- Usulan Agent Hierarchy Dashboard, anthropics/claude-code #24537: https://github.com/anthropics/claude-code/issues/24537
- Microsoft AG-UI multi-agent workflow demo: https://devblogs.microsoft.com/agent-framework/ag-ui-multi-agent-workflow-demo/
- Panduan dashboard multi-agent: https://www.browseract.com/blog/multi-agent-management-dashboard-guide
- Tren SaaS UI (calm design): https://www.saasui.design/blog/7-saas-ui-design-trends-2026
- Desain avatar & indikator status: https://setproduct.com/blog/avatar-ui-design
- ServiceNow Horizon — presence icon: https://horizon.servicenow.com/components/now-icon-presence
- W3C — Understanding SC 2.3.3: https://w3c.github.io/wcag/understanding/animation-from-interactions.html
