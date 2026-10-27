# RudisOne

Tim agent Claude Code milik pengguna, di **level device** — terpisah dari semua repo proyek. Disusun
seperti perusahaan: pengguna hanya berbicara dengan **COO**; di bawahnya tiga divisi yang tampil sebagai
sesi di sidebar Claude Desktop. Siapa mengerjakan apa: `raci.md`; aturan kerja: `protokol.md`.

| Divisi | Leader | Anggota | Folder sesi |
|---|---|---|---|
| — | **COO** (pintu tunggal pengguna) | — | `~/Documents/Neuron/ai-agent/RudisOne` |
| Corporate Strategy | — (staf COO; Head of Strategy memimpin tugas lintas anggota) | Head of Strategy, Financial Controller (Finance & Accounting), Research Analyst, HR Business Partner (siaga) | `ruang/<id-peran>` |
| Engineering · Tim 1–3 (satu per proyek, dibuat saat dibutuhkan) | Tech Lead (Senior Software Engineer; worktree integrasi) | Business Systems Analyst (System Analyst + analisis bisnis; hanya membaca), Software Engineer #1 (+#2 untuk fitur yang bisa dipecah) | folder proyek |
| Engineering · layanan bersama | Program Manager | Technical Writer | `ruang/<id-peran>` |
| IT Operations | Head of IT Operations | System Administrator (SysAdmin) | `ruang/<id-peran>` |

## Cara pakai (sehari-hari)
1. Buka Claude Code / Claude Desktop di **folder proyekmu** seperti biasa.
2. Ketik **`/rudisone <permintaan>`**, mis. `/rudisone perbaiki cetak SJ`. Sesi itu menjadi **COO**.
   Sebelum tim bergerak, COO **menyamakan persepsi** denganmu (skill `rudis-grill-me`): fakta yang bisa dicari ia cari
   sendiri, sisanya ditanyakan satu per satu, masing-masing dengan rekomendasinya, lalu ia menutup dengan ringkasan
   pemahaman bersama (hasil, kriteria selesai, lingkup, batasan). Tim baru bekerja setelah kamu menyetujuinya, dan
   hasilnya diverifikasi terhadap kriteria itu. Mau melewatinya untuk hal sepele? Tambahkan "langsung".
3. Panggilan pertama membentuk seluruh organisasi sekaligus (8 sesi divisi + 4 sesi tim untuk proyek ini) di
   grup sidebar "RudisOne"; proyek lain mendapat timnya sendiri saat kamu memanggil `/rudisone` di sana. Sesi
   yang terarsip/hilang dipulihkan otomatis. Sesi diam tidak memakan kuota.
4. COO membagi tugas ke leader; leader memerintah anggotanya dan menambah **asisten** (subagent) sendiri tanpa
   bertanya. Yang naik ke kamu hanya aksi berisiko (commit ke main, push, deploy, data production).
5. Setiap jawaban COO ditutup satu tautan **Kantor** (`http://127.0.0.1:7421/?tugas=<ID>`) untuk memantau
   secara visual. `/rudisone status tugas` merangkum semua tugas berjalan.

Aturan kerjanya (termasuk pengerjaan mandiri sebagai default) dimiliki satu file: `protokol.md`. Checkout utama
proyek tetap milikmu — agent bekerja di worktree dan hanya menyerahkan hasil ke branch utama atas permintaanmu.
Tim bisa mengerjakan banyak tugas sekaligus, di folder berbeda dan tidak saling terkait: tiap tugas punya ID,
folder kerja, dan kunci sumber daya di register tugas COO (`handoff/register-tugas.md`), satu sesi memegang satu tugas
aktif (sisanya antre/diparkir), dan Kantor menampilkan papan **Tugas berjalan** (`protokol.md` › Manajemen multi-tugas).

## Membangun software (SDLC)
Perkakas resmi pembuat software RudisOne adalah skill **`rudis-monorepo`** (standar arsitektur, scaffold,
deploy standar) dan pustaka **`rudis-modules`** (modul, kit UI, preset). Keduanya tinggal di repo
masing-masing — tidak dibundel — dan `bin/perkakas.sh` memasangnya bila belum ada serta memperbaruinya di setiap
`/rudisone` (tanpa pernah menimpa perubahanmu di repo sumber, dan ditunda selama tugas Engineering berjalan).
`sdlc.md` memetakan tujuh fase (Inisiasi, Analisis, Desain, Konstruksi, Pengujian, Rilis, Operasi) ke jabatan dan
menetapkan empat gerbang persetujuanmu:

| Gerbang | Yang kamu putuskan |
|---|---|
| **Persetujuan Inisiasi** | maksud & kriteria selesai, stack, nama, slug, domain — lewat penyelarasan persepsi |
| **Persetujuan Rancangan** | tabel perakitan modul + arah desain |
| **Persetujuan Rilis** | serah ke branch utama, commit, push |
| **Persetujuan Penerapan** | pendaftaran server & setiap deploy |

Contoh: `/rudisone buatkan aplikasi booking lapangan`.

## Struktur
```
agents/<id-peran>.md          definisi peran (sumber tunggal), termasuk COO & Tech Lead
.claude/                   folder ini = ruang COO ("agent": "coo")
ruang/<id-peran>/.claude/     ruang tiap agent ("agent": "<id-peran>", peran = symlink ke agents/)
protokol.md                rantai komando, format pesan, aturan anggota tim & subagent
raci.md                    matriks RASCI + wewenang per peran
sdlc.md                    membangun software: fase, gerbang, perkakas resmi (daftar mesin: perkakas.json)
infra.md                   prosedur server, app, domain, alur deploy — generik, tanpa fakta server
konfigurasi/               per device: server.json (server, aplikasi, DNS; git-ignored) + server.contoh.json
penyedia.md                registri kemampuan & penyedia (DNS, repo, server) + alur konfigurasi server
kebijakan-akses.json       akses per jabatan & batas kewenangan jenjang 1–3 (dibaca hook bin/kebijakan.mjs)
catatan/<id-peran>.md         ingatan jangka panjang per agent
bin/                       perkakas (daftar & kode keluar: protokol.md › Perkakas bersama)
kantor/                    Kantor RudisOne: server status lokal + tampilan pixel (tanpa dependensi)
templat/                   kerangka brief & laporan, pemahaman bersama, register tugas, TEAM, brief-desain, intake/perakitan/onboarding (SDLC)
skills/<nama>/SKILL.md     skill tim: rudisone (pintu COO), rudis-grill-me (penyelarasan persepsi), rudis-riset-desain — ditautkan ke ~/.claude/skills oleh install.sh
install.sh                 pemeriksaan & persiapan di device baru
TEAM.md, handoff/, konfigurasi/server.json  per device, tidak di-commit (TEAM.md = buku alamat sesi tim; handoff/register-tugas.md)
```

## Pasang di device baru
1. `git clone https://github.com/DimasPrasetio/RudisOne.git ~/Documents/Neuron/ai-agent/RudisOne` (repo privat; harus di path ini —
   peran dan aturan merujuk `~/Documents/Neuron/ai-agent/RudisOne`).
2. `~/Documents/Neuron/ai-agent/RudisOne/install.sh` — membuat `handoff/`, memeriksa symlink, konfigurasi server
   (bila sudah diisi: koneksi ssh & MCP DNS), dan memasang perkakas resmi SDLC (clone `rudis-monorepo` dan
   `rudis-modules` ke `~/Documents/Neuron/ai-agent`, skill ke `~/.claude/skills`) bila belum ada.
3. Pasang kebijakan akses (dijalankan pemilik sendiri, sekali per device): `~/Documents/Neuron/ai-agent/RudisOne/bin/kebijakan.sh pasang` —
   menambah hook ke `~/.claude/settings.json` (cadangan dibuat dulu); hanya bertindak di sesi RudisOne.
4. Server tidak ditanam di repo. Saat tugas server pertama, COO menanyakan alias ssh (entri `Host` di
   `~/.ssh/config` beserta kuncinya kamu siapkan sendiri), playbook server bila ada, MCP DNS, dan domain, lalu
   menyimpannya di `konfigurasi/server.json` atas persetujuanmu (`penyedia.md` › Konfigurasi server). Opsional:
   izin deploy tetap — lihat bagian di bawah.
5. Buka sesi di folder proyek mana pun dan ketik **`/rudisone`** — organisasi terbentuk otomatis.

## Izin deploy tetap (opsional, per device, dipasang pengguna sendiri)
Agar System Administrator bisa deploy satu app terdaftar tanpa bertanya, buat
`~/Documents/Neuron/ai-agent/RudisOne/ruang/system-administrator/.claude/settings.local.json` (ganti `<alias>` dan
`<app>` dengan nilai di `konfigurasi/server.json`):
```json
{
  "agent": "system-administrator",
  "permissions": {
    "allow": ["Bash(ssh <alias> 'cd ~/<app> && ./deploy.sh *)"]
  }
}
```

## Kantor RudisOne (tampilan visual)
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
- Uji: `node --test kantor/ bin/` (Kantor + perkakas + kebijakan + konfigurasi).

## Memperbarui
Ubah peran/catatan → commit → push dari satu device; device lain cukup `git pull`. Peran ditautkan lewat
symlink, jadi berlaku untuk sesi berikutnya. Sesi tim yang sedang berjalan: minta COO
mengirim instruksi "baca ulang peranmu".

## Aturan
- Jangan pernah menyimpan rahasia (password, token, private key, isi `.env`) di repo ini — juga tidak di
  `konfigurasi/server.json`.
- Jangan menanam fakta server (host, IP, path server, domain, nama app) di peran, protokol, atau templat; semuanya
  dibaca dari `konfigurasi/server.json`.
- Jangan menaruh aturan tim di repo proyek; proyek hanya berisi aturan proyeknya.
