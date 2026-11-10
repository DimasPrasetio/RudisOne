# Cara kerja RudisOne

Rincian cara kerja tim: jabatan, model sesi, alur harian, dan pengelolaan tugas. Ringkasannya ada di [README](../README.md).

Tim agent Claude Code milik pengguna, di **level device** — terpisah dari semua repo proyek. Disusun seperti
perusahaan (12 jabatan), tetapi dengan model **inti kecil + subagent**: pengguna hanya berbicara dengan **COO**; yang
hidup sebagai sesi di sidebar hanya inti, peran lain dipanggil sebagai subagent saat ada tugasnya. Siapa mengerjakan
apa: `raci.md`; aturan inti: `protokol.md` (termuat otomatis lewat `CLAUDE.md`).

| Divisi | Jabatan | Hidup sebagai | Folder |
|---|---|---|---|
| — | **COO** (pintu tunggal pengguna) | sesi (yang kamu buka) | folder mana pun / `~/Documents/Neuron/ai-agent/RudisOne` |
| IT Operations | Head of IT Operations, System Administrator | **sesi saat dibutuhkan** (tugas server/insiden/deploy; izin server & deploy melekat ke folder) | `ruang/<id-peran>` |
| Engineering · Tim 1–3 (satu per proyek aktif) | Tech Lead | **sesi inti** per proyek yang punya tugas (worktree integrasi) | folder proyek |
| Engineering · Tim n | Business Systems Analyst, Software Engineer | subagent `rudis-<id-peran>` dipanggil Tech Lead (SE di worktree sendiri) | folder Tech Lead |
| Corporate Strategy | Head of Strategy, Financial Controller, Research Analyst, HR Business Partner | subagent dipanggil COO | — |
| Engineering · layanan bersama | Program Manager, Technical Writer | subagent dipanggil COO | — |

Tugas panjang yang ingin kamu pantau atau sela langsung bisa dijalankan sebagai **sesi saat dibutuhkan** (COO
membentuknya atas permintaanmu dan menawarkan arsip setelah selesai).

## Cara pakai (rinci)
1. Buka Claude Code / Claude Desktop di **folder proyekmu** seperti biasa.
2. Ketik **`/rudisone <permintaan>`**, mis. `/rudisone perbaiki cetak SJ`. Sesi itu menjadi **COO**.
   Sebelum tim bergerak, COO **menyamakan persepsi** denganmu (skill `rudis-grill-me`): fakta yang bisa dicari ia cari
   sendiri, sisanya ditanyakan satu per satu, masing-masing dengan rekomendasinya, lalu ia menutup dengan ringkasan
   pemahaman bersama (hasil, kriteria selesai, lingkup, batasan). Tim baru bekerja setelah kamu menyetujuinya, dan
   hasilnya diverifikasi terhadap kriteria itu. Mau melewatinya untuk hal sepele? Tambahkan "langsung".
   Semua pertanyaan dan persetujuan memakai **bahasa awam** — dampak dan pilihan dalam bahasa hasil kerja; istilah teknis
   hanya dalam kurung — jadi kamu tidak perlu paham cara kerja RudisOne untuk menjawabnya.
3. Panggilan `/rudisone` tidak membentuk sesi apa pun sebelum ada tugasnya: sesi Tech Lead dibentuk saat tugas pertama
   sebuah proyek dijadwalkan, sesi IT Operations saat ada tugas server/insiden/deploy (grup sidebar "RudisOne"). Peran
   lain dipanggil sebagai subagent — tidak ada lagi pembentukan 12 sesi. Membuat aplikasi baru tidak menyentuh server.
4. COO memberi tugas ke pemiliknya (subagent peran, sesi inti, atau sesi IT Operations); Tech Lead memanggil BSA/SE sebagai subagent.
   Yang naik ke kamu hanya keputusan dan aksi berisiko (commit ke main, push, deploy, data production).
5. Setiap jawaban COO ditutup satu tautan **Kantor** (`http://127.0.0.1:7421/?tugas=<ID>`) untuk memantau
   secara visual. `/rudisone status tugas` merangkum semua tugas berjalan.

Aturan kerjanya (termasuk pengerjaan mandiri sebagai default) dimiliki satu file: `protokol.md`. Checkout utama
proyek tetap milikmu — agent bekerja di worktree dan hanya menyerahkan hasil ke branch utama atas permintaanmu.
Tim bisa mengerjakan banyak tugas sekaligus, di folder berbeda dan tidak saling terkait: tiap tugas punya ID,
folder kerja, dan kunci sumber daya di register tugas COO (`handoff/register-tugas.json`, ditulis lewat `bin/register.sh`; tampilan `register-tugas.md` dibangkitkan), satu sesi memegang satu tugas
aktif (sisanya antre/diparkir), dan Kantor menampilkan papan **Tugas berjalan** (skill `rudis-multitugas`).
Riwayat tidak menumpuk: tiap `/rudisone` COO menjalankan `bin/bersih-riwayat.sh --jalankan`, yang membuang tugas
selesai/dibatalkan lebih dari 24 jam (entri register + `handoff/<ID>/`, satu baris audit tersisa di
`handoff/bersih-riwayat.jsonl`, dan ringkasan angka tiap tugas — waktu, biaya, putaran revisi, keputusan — tetap
tersimpan di `handoff/metrik.jsonl`). Worktree dan branch `rudis/<ID>` yang sudah ter-merge hanya **diusulkan** (`--usulan-git`)
dan baru dihapus setelah kamu setuju; coba kapan saja tanpa risiko: `bin/bersih-riwayat.sh --rinci` (dry-run).
