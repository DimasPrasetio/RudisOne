# Jalur Rakit Paralel — aplikasi Mode A (skill `rudis-sdlc`)

Bawaan untuk aplikasi baru dan fitur besar di proyek `rudis-pustaka`. Prinsip: **agent untuk keputusan, skrip untuk
prosedur**; analisis sekali lalu kerja paralel; pasang **hanya** modul yang punya alasan di tabel; satu gerbang uji di
akhir; SDD menurut tingkat risiko (skill `rudis-sdd` › Tingkat SDD). Peran, gerbang, dan aturan lain tetap SKILL.md.

## Langkah
| # | Langkah | Siapa | Alat / hasil |
|---|---|---|---|
| ① | Selaras kilat + cek lingkungan | COO | grill kedalaman *standar* (bukan *mendalam*) untuk aplikasi back-office; `bin/perkakas.sh siapkan --segera` |
| ② | Analisis → **tabel perakitan** | BSA (dipanggil TL) | mulai dari **resep** pustaka (`recipes/` di `rudis-modules`, mis. `back-office-dasar`, `inventori`) lalu tambah/kurangi per kemampuan; kolom Tingkat SDD + Pemilik folder; spek ringkas untuk baris tingkat 1; nomor spek tingkat 2 dialokasikan di sini |
| ③ | **Satu** persetujuan pengguna | COO | ringkasan + tabel (+ arah desain). Semua baris *pasang* → digabung dengan Persetujuan Inisiasi |
| ④ | Pasang semua modul terpilih | TL, **satu perintah** | `node <rudis-modules>/scripts/rakit.mjs <manifest.json>` (scaffold → resep/modul → env-local → npm install ‖ go mod tidy → sqlc → db-local → migrate → build → arch:check → smoke; ringkasan satu halaman). Proyek sudah ada: `module.mjs recipe <id>` (= `add --recipe <id>`) / `add <id>…` |
| ⑤ | Kerangka modul kustom | TL | `npm run new:module -- <def.json>` untuk baris CRUD (selesai di sini, tinggal aturan non-CRUD) atau `--skeleton` untuk modul berlogika khusus; TL meng-commit kerangka sebelum membagi |
| ⑥ | Rakit **paralel** | ≤ 5 subagent SE | satu agent = satu folder (`apps/api/internal/modules/<id>` **atau** `apps/web/src/modules/<id>`); api dan web modul yang sama dikerjakan bersamaan terhadap tipe kontrak dari kerangka; di tengah hanya `go build ./internal/modules/<id>/...` / `tsc` |
| ⑦ | **Satu** gerbang akhir | TL + skrip | `npm run gate` (per modul); gagal → kembali ke agent pemilik folder, maks. 2 putaran; lalu tinjauan LLM **hanya kode kustom** (diff folder kustom — bukan hasil generator yang tak disentuh, bukan modul pustaka) |
| ⑦b | Database lokal tidak siap | — | `rakit`/`gate` melaporkan tes ber-database "dilewati"; kriteria ber-database = *belum terverifikasi* (bukan `[Terhambat]`) — `env-db-lokal.md` |
| ⑧ | Lapor | TL → COO | keluaran `rakit` + `gate`, kriteria per nomor; rilis/deploy tetap gerbang terpisah |

**Mengapa pemasangan tidak oleh banyak agent:** semua modul menulis ke berkas bersama (`registry.go`, `sqlc.yaml`,
`app/modules.ts`, `modules.lock.json`, `.env.example`, `MODULE_MAP.md`, `package.json`, `go.mod`) → satu penulis (skrip).
Paralel baru dimulai di ⑥, setelah kerangka mengunci berkas bersama.

## Brief per agent paralel (⑥)
Satu brief per folder, isinya **hanya** modul itu: ID `T-…​.k`, folder yang boleh ditulis (satu), kontrak (path tipe API
dari kerangka + spek ringkas/spek tingkat 2 modul itu), aturan yang bukan CRUD, perintah cek di folder sendiri, kriteria
selesai, larangan menyentuh berkas bersama (butuh baris baru di registry/sqlc → minta TL). Referensi skill yang dimuat
hanya yang sesuai folder: api → `backend-go.md` + `backend-modular-monolith.md`; web → `frontend.md`. SE memakai
`isolation: "worktree"`; TL meninjau & menggabungkan (`agents/tech-lead.md` › Alur tugas).

## Jalur ekspres (semua baris *pasang*)
Tidak ada kode kustom → tidak ada yang perlu dibagi: COO memanggil Tech Lead **sebagai subagent** (`agents/coo.md` ›
Tech Lead sebagai subagent) tanpa membentuk sesi, dengan brief ②–⑧ sekaligus; persetujuan gabungan di ③ sudah diambil.

## Anggaran waktu per fase
Sasaran, bukan batas keras; Kantor menampilkan menit berjalan terhadap anggaran fase di daftar tugas (kolom Fase register +
`fase_sejak`; angkanya dimiliki `kantor/server.mjs` › `ANGGARAN_FASE`). Melewati anggaran → TL menyebut sebabnya di laporan
(satu baris), bukan menambah lingkup. Target aplikasi seperti pencatatan stok: ±25–40 mnt sampai lulus `gate`.

## Proyek lama tanpa alat ini
`scripts/arch-check.mjs`, `new-module.mjs`, `gate.mjs` adalah berkas mandiri: salin dari scaffold baru dan tambahkan skrip
`arch:check`, `new:module`, `gate` di `package.json` — sebagai tugas proyek itu, bukan otomatis.
