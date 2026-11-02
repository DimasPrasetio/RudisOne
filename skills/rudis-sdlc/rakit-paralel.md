# Jalur Rakit Paralel — aplikasi Mode A (skill `rudis-sdlc`)

Bawaan untuk aplikasi baru dan fitur besar di proyek `rudis-pustaka`. Prinsip: **agent untuk keputusan, skrip untuk
prosedur**; analisis sekali lalu kerja paralel; pasang **hanya** modul yang punya alasan di tabel; satu gerbang uji di
akhir; SDD menurut tingkat risiko (skill `rudis-sdd` › Tingkat SDD). Peran, gerbang, dan aturan lain tetap SKILL.md.

## Langkah
| # | Langkah | Siapa | Alat / hasil |
|---|---|---|---|
| ① | Selaras kilat + cek lingkungan | COO | grill kedalaman *standar* (bukan *mendalam*) untuk aplikasi back-office; `bin/perkakas.sh siapkan --segera` |
| ② | Analisis → **tabel perakitan** | BSA (dipanggil TL) | mulai dari **resep** pustaka (`recipes/` di `rudis-modules`, mis. `back-office-dasar`, `inventori`) lalu tambah/kurangi per kemampuan; kolom Tingkat SDD + Pemilik folder; spek ringkas untuk baris tingkat 1; nomor spek tingkat 2 dialokasikan di sini |
| ②b | **Riset alur** (paralel dengan ②), lalu **alur tugas utama** (BSA, panggilan kedua TL setelah `riset-alur.md` ada); aplikasi baru & fitur yang menambah/mengubah layar, kecuali jalur ekspres | RA (riset) → BSA (alur) | RA: `templat/riset-alur.md` (pustaka `recipes/alur/<kategori>.md` dipakai ulang bila belum kedaluwarsa); BSA: `templat/alur-tugas.md` per peran × 3–5 tugas utama, tiap aturan bersumber |
| ③ | **Satu** persetujuan pengguna (menunggu ②b selesai, kecuali jalur ekspres) | COO | ringkasan + tabel (+ arah desain + **ringkasan alur**, satu baris per tugas; bukan keputusan tambahan). Semua baris *pasang* → digabung dengan Persetujuan Inisiasi |
| ④ | Pasang semua modul terpilih | TL, **satu perintah** | `node <rudis-modules>/scripts/rakit.mjs <manifest.json>` (scaffold → resep/modul → env-local → npm install ‖ go mod tidy → sqlc → db-local → migrate → build → arch:check → smoke; ringkasan satu halaman). Proyek sudah ada: `module.mjs recipe <id>` (= `add --recipe <id>`) / `add <id>…` |
| ⑤ | Kerangka modul kustom | TL | `npm run new:module -- <def.json>` untuk baris CRUD (selesai di sini, tinggal aturan non-CRUD) atau `--skeleton` untuk modul berlogika khusus; TL meng-commit kerangka sebelum membagi |
| ⑥ | Rakit **paralel** | ≤ 5 subagent SE | satu agent = satu folder (`apps/api/internal/modules/<id>` **atau** `apps/web/src/modules/<id>`); api dan web modul yang sama dikerjakan bersamaan terhadap tipe kontrak dari kerangka; di tengah hanya `go build ./internal/modules/<id>/...` / `tsc` |
| ⑦ | **Satu** gerbang akhir | TL + skrip | `npm run gate` (per modul); gagal → kembali ke agent pemilik folder, maks. 2 putaran; lalu **paralel**: tinjauan LLM **hanya kode kustom** (diff folder kustom — bukan hasil generator yang tak disentuh, bukan modul pustaka) ‖ **uji jalan alur** BSA (aplikasi berjalan; **mode CEPAT bawaan**: tugas inti, HP saja, kasus gagal utama, ± 10 mnt, putusan beserta pernyataan cakupan; mode PENUH — semua tugas, HP + komputer — hanya bila pengguna memintanya; `templat/uji-alur.md`; BSA memakai kit `templat/uji-alur-kit/`). Temuan kecil → putaran perbaikan yang sama (maks. 2); temuan yang mengubah alur → keputusan pengguna |
| ⑦b | Database lokal tidak siap | — | `rakit`/`gate` melaporkan tes ber-database "dilewati"; kriteria ber-database = *belum terverifikasi* (bukan `[Terhambat]`) — `env-db-lokal.md` |
| ⑧ | Lapor | TL → COO | keluaran `rakit` + `gate`, kriteria per nomor, **hasil uji alur per alur tugas**; rilis/deploy tetap gerbang terpisah |

**Mengapa pemasangan tidak oleh banyak agent:** semua modul menulis ke berkas bersama (`registry.go`, `sqlc.yaml`,
`app/modules.ts`, `modules.lock.json`, `.env.example`, `MODULE_MAP.md`, `package.json`, `go.mod`) → satu penulis (skrip).
Paralel baru dimulai di ⑥, setelah kerangka mengunci berkas bersama.

## Brief per agent paralel (⑥)
Satu brief per folder, isinya **hanya** modul itu: ID `T-…​.k`, folder yang boleh ditulis (satu), kontrak (path tipe API
dari kerangka + spek ringkas/spek tingkat 2 modul itu), aturan yang bukan CRUD, perintah cek di folder sendiri, kriteria
selesai, larangan menyentuh berkas bersama (butuh baris baru di registry/sqlc → minta TL). Brief SE **web** memuat bagian
`alur-tugas.md` yang relevan dengan foldernya (langkah, bawaan isian, teks pesan galat, layar kosong). Referensi skill yang
dimuat hanya yang sesuai folder: api → `backend-go.md` + `backend-modular-monolith.md`; web → `frontend.md`. SE memakai
`isolation: "worktree"`; TL meninjau & menggabungkan (`agents/tech-lead.md` › Alur tugas).

## Alur pemakaian: riset → alur tugas → uji jalan alur
Landasan dan pemeriksaan **alur** (bukan rupa): ditetapkan dari sumber nyata di ②b, diperiksa independen di ⑦. Cakupan:
aplikasi baru dan fitur yang menambah/mengubah layar (Mode A dan B); perbaikan bug tanpa perubahan alur **tidak**.
- **Riset alur** (RA, `agents/research-analyst.md` › Riset alur): ≥ 6 sumber bertanggal dari tiga jenis (produk sejenis,
  riset UX yang diakui, pedoman design system); masa berlaku 6 bulan; dipakai ulang dari pustaka `recipes/alur/<kategori>.md`
  di `rudis-modules`. Pustaka diperbarui lewat Jalur Platform (usul promosi dicatat di draf `handoff/<ID>/riset-alur.md`).
  Riset visual back-office tetap dilewati (preset); riset alur tidak.
- **Alur tugas utama** (BSA, `agents/business-systems-analyst.md` › Alur tugas utama): ringkasannya ikut Persetujuan
  Rancangan tanpa menambah keputusan pengguna.
- **Uji jalan alur** (BSA, `agents/business-systems-analyst.md` › Uji jalan alur): prasyarat `npm run gate` lulus + aplikasi
  dan database lokal berjalan; tidak siap → alur ber-data *belum terverifikasi*, bukan `[Terhambat]`. Putusan `LULUS` /
  `PERLU PERBAIKAN` untuk sha terakhir di `handoff/<ID>/uji-alur.md`. Verifikasi visual TL (skill `rudis-riset-desain` ›
  Verifikasi visual) tetap; uji alur adalah pemeriksaan kedua oleh pihak lain.
- **Anggaran tambahan** (sasaran): jenis aplikasi baru ≤ 5 mnt di atas total biasa (riset penuh paralel dengan BSA, jadi
  sebagian besar tak menambah waktu dinding; uji alur paralel dengan tinjauan kode; uji alurnya sendiri **tidak** muat ± 5 mnt untuk aplikasi dua peran dengan banyak tugas — **mode cepat (bawaan) terukur 12 mnt 16 dtk**, sasaran ± 10 mnt, uji ulang butir ± 2–3 mnt; mode penuh (hanya atas permintaan) ≈ 25–52 mnt; lihat agents BSA › Uji jalan alur); jenis yang sudah diriset ≤ 2 mnt untuk riset dan alur tugas, bukan untuk uji alur.
  Tidak ada keputusan tambahan bagi pengguna.
- Bukan uji pengguna sungguhan: laporan menyebutnya dan menganjurkan uji oleh petugas asli sebelum Persetujuan Penerapan.

## Jalur ekspres (semua baris *pasang*)
Tidak ada kode kustom → tidak ada yang perlu dibagi: COO memanggil Tech Lead **sebagai subagent** (`agents/coo.md` ›
Tech Lead sebagai subagent) tanpa membentuk sesi, dengan brief ②–⑧ sekaligus; persetujuan gabungan di ③ sudah diambil.
Karena persetujuan sudah diambil dan tidak ada layar kustom (alur ditetapkan modul pustaka), jalur ekspres **dikecualikan**
dari riset alur (②b) dan alur tugas utama baru. **Uji jalan alur (⑦)** tetap berjalan bila aplikasi berlayar dan pustaka
punya `recipes/alur/<kategori>.md` untuk resepnya (BSA menyalin alur tugas yang relevan dari sana ke
`handoff/<ID>/alur-tugas.md` sebagai awal uji, tanpa riset baru); tanpa itu dilewati dan
laporan menyebutnya "alur belum dicakup uji".

## Anggaran waktu per fase
Sasaran, bukan batas keras; Kantor menampilkan menit berjalan terhadap anggaran fase di daftar tugas (kolom Fase register +
`fase_sejak`; angkanya dimiliki `kantor/server.mjs` › `ANGGARAN_FASE`). Melewati anggaran → TL menyebut sebabnya di laporan
(satu baris), bukan menambah lingkup. Target aplikasi seperti pencatatan stok: ±25–40 mnt sampai lulus `gate`. Anggaran
Analisis mencakup riset alur dan alur tugas utama (riset penuh ± 5–8 mnt paralel dengan tabel perakitan, lalu alur tugas
sesudahnya — itu sebab anggarannya naik ± 3 mnt);
uji jalan alur berjalan paralel dengan tinjauan kode: **mode cepat** aplikasi pertama ± 10 mnt (terukur 12 mnt 16 dtk di Gudangku, dengan bug kit yang sudah diperbaiki; satu eksekusi skrip 75 dtk), uji ulang butir ± 2–3 mnt; **mode penuh** (hanya atas permintaan pengguna) ≈ 25–52 mnt (agents BSA › Uji jalan alur). Anggaran Pengujian di Kantor (10 mnt) sengaja tidak diubah — sudah sama dengan sasaran cepat dan baru satu ukuran; melewatinya disebut sebabnya di laporan.

## Proyek lama tanpa alat ini
`scripts/arch-check.mjs`, `new-module.mjs`, `gate.mjs` adalah berkas mandiri: salin dari scaffold baru dan tambahkan skrip
`arch:check`, `new:module`, `gate` di `package.json` — sebagai tugas proyek itu, bukan otomatis.
