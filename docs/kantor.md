# Kantor RudisOne (tampilan visual)

Denah kantor isometrik yang memperlihatkan secara langsung apa yang sedang dikerjakan tim, disusun seperti
organisasi: **Ruang Pimpinan** (meja COO, lantai kayu, kursi tamu), tiga pod **Engineering · Tim 1–3**
(papan nama memuat proyeknya; tim yang belum dipakai diredupkan), **Corporate Strategy**, **Layanan bersama**
(Program Manager & Technical Writer), **IT Operations**, dan **lounge** terpisah (bar kopi, sofa, meja bundar, bangku) — 21 kursi. Panel kanan:
"Perlu perhatian Anda", papan **Tugas berjalan** dari register tugas, tim per divisi, aktivitas terbaru; linimasa
60 menit di bawah. Cerita gerak mengikuti kejadian nyata: atasan **memanggil dari mejanya** dan bawahan datang
ke kursi tamu, laporan dibawa naik ke atasan, `[Tinjau]` memanggil peninjau, rekan saling menghampiri saat
berkonsultasi, dan yang santai mengambil kopi lalu duduk mengobrol di lounge. Jenis pesan diambil dari tag `[…]`
di awal pesan saja. Tombol **− / + / Seluruh denah** untuk memperbesar & menggeser, **Jeda gerak** (dan
`prefers-reduced-motion`) mematikan animasi. Tema terang/gelap mengikuti sistem; di HP denah bisa digeser.
Brief desain & sumber risetnya: `kantor/DESAIN.md`.
- Buka: `~/Documents/Neuron/ai-agent/RudisOne/bin/kantor.sh` (menyalakan server lokal di http://127.0.0.1:7421 lalu membuka browser;
  server yang menjalankan kode lama otomatis dimulai ulang). Matikan: `bin/kantor.sh berhenti`. Coba tampilan dengan data contoh: `bin/kantor.sh demo`.
- Dari sesi COO: minta "buka kantor" — tampil di panel browser Claude Desktop (`.claude/launch.json`).
- Data dibaca dari transkrip sesi Claude di device ini (`~/.claude/projects`) dan metadata sesi Claude
  Desktop — hanya sesi RudisOne (folder repo ini, worktree `r<n>-…`, `/rudisone`, atau pembuka "… di RudisOne"); server hanya listen di 127.0.0.1, menolak permintaan dengan header `Host` selain
  127.0.0.1/localhost (perlindungan DNS rebinding), dan hanya meneruskan metadata aktivitas (nama alat, deskripsi
  perintah, nama file) — bukan isi file, pesan, atau output.
