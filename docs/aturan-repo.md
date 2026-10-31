# Aturan repo

- Jangan pernah menyimpan rahasia (password, token, private key, isi `.env`) di repo ini — juga tidak di
  `konfigurasi/server.json`.
- Jangan menanam fakta server (host, IP, path server, domain, nama app) di peran, protokol, atau templat; semuanya
  dibaca dari `konfigurasi/server.json`.
- Jangan menaruh aturan tim di repo proyek; proyek hanya berisi aturan proyeknya.
- Repo ini adalah sumber instalasi di device klien, jadi harus bersih dari sisa pemakaian: laporan uji per device,
  ID tugas, kutipan keputusan bertanggal, riwayat bertanggal di dokumen, kode temuan lama, dan narasi uji tidak ditulis di
  berkas produk — tempatnya `handoff/` (per device). Penjaga:
  `bin/cek-konsistensi.sh --repo` (kode `bersih`) dan hook pre-commit `.githooks/pre-commit` (diaktifkan `install.sh`
  lewat `core.hooksPath`). Tes, fixture, dan alat pengembang (`*.test.mjs`, `uji/suite/`, `uji/simulasi-linux/`, CI) dikecualikan.
