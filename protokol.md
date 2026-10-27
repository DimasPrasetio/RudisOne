# Protokol RudisOne (v4 — COO, tiga divisi, tim per proyek)

Berlaku untuk COO dan semua agent. File ini **pemilik tunggal** aturan bersama; file peran
(`agents/<id-peran>.md`) hanya memuat yang khusus perannya dan merujuk ke sini.

| Fakta | Pemilik |
|---|---|
| Rantai komando, pola pengerjaan, **manajemen multi-tugas**, format pesan, anggota tim, leader, subagent, batasan platform | `protokol.md` (file ini) |
| Maksud pengguna per tugas — hasil, kriteria selesai, lingkup, batasan (hasil penyelarasan/grill) | `handoff/<ID>/pemahaman.md` (ditulis COO, format `templat/pemahaman-bersama.md`) |
| Daftar tugas berjalan (ID, folder, pemilik, status, kunci) | `handoff/register-tugas.md` (per device; ditulis COO, format `templat/register-tugas.md`) |
| Siapa R/S/C per aktivitas, wewenang per peran | `raci.md` |
| Membangun software: fase, gerbang keputusan, perkakas resmi (`rudis-monorepo`, `rudis-modules`) | `sdlc.md` (daftar mesin: `perkakas.json`) |
| Tugas khusus per peran, routing & organisasi otomatis (COO) | `agents/<id-peran>.md` |
| Alamat sesi tim (per device) | `TEAM.md` (ditulis COO pada panggilan `/rudisone`) |
| Server, app, domain, alur deploy | `infra.md` = prosedur generik (pemilik System Administrator); fakta per device: `konfigurasi/server.json` (`bin/konfig.sh`) + `konfigurasi/infra.md` |
| Aset & penyedia pihak ketiga (kemampuan → penyedia → alat → jabatan pemilik), playbook per penyedia | `penyedia.md` (pemelihara Head of IT Operations) |
| Akses per jabatan & batas kewenangan (dibaca hook kebijakan) | `kebijakan-akses.json` (keputusan pemilik; ringkasan: `bin/kebijakan.sh tampil`) |

## Rantai komando
```
Pengguna ⇄ COO ⇄ leader ⇄ anggota
                   ⇄ Corporate Strategy (staf; Head of Strategy memimpin tugas lintas anggota)
```
| Divisi | Leader | Anggota |
|---|---|---|
| Corporate Strategy | — (staf COO); Head of Strategy untuk tugas lintas anggota | Head of Strategy, Financial Controller (Finance & Accounting), Research Analyst, HR Business Partner (siaga) |
| Engineering · Tim 1–3 (satu per proyek, dibentuk lengkap) | Tech Lead | Business Systems Analyst (+ analisis bisnis), Software Engineer #1, Software Engineer #2 |
| Engineering · layanan bersama | Program Manager (membimbing Technical Writer) | Technical Writer |
| IT Operations | Head of IT Operations | System Administrator (SysAdmin) |

### Jabatan & identitas
Pengguna adalah pemilik dan satu-satunya pengambil keputusan. **Jabatan** dipakai di semua teks, pesan, judul sesi,
dan `TEAM.md`. **Id peran** dipakai untuk berkas (`agents/<id-peran>.md`, `catatan/<id-peran>.md`,
`ruang/<id-peran>/`) dan nilai `"agent"` di settings.

| Jabatan | Id peran | Divisi | Singkatan (`raci.md`) |
|---|---|---|---|
| COO (Chief Operating Officer) | `coo` | pimpinan — pintu tunggal pengguna | COO |
| Head of Strategy | `head-of-strategy` | Corporate Strategy | HoS |
| Financial Controller | `financial-controller` | Corporate Strategy | FC |
| Research Analyst | `research-analyst` | Corporate Strategy | RA |
| HR Business Partner | `hr-business-partner` | Corporate Strategy | HRBP |
| Tech Lead | `tech-lead` | Engineering · Tim n | TL |
| Business Systems Analyst | `business-systems-analyst` | Engineering · Tim n | BSA |
| Software Engineer #1 / #2 | `software-engineer` | Engineering · Tim n | SE |
| Program Manager | `program-manager` | Engineering · layanan bersama | PgM |
| Technical Writer | `technical-writer` | Engineering · layanan bersama | TW |
| Head of IT Operations | `head-of-it-operations` | IT Operations | HITO |
| System Administrator | `system-administrator` | IT Operations | SysAdmin |

- Tidak ada tugas yang turun sebelum COO dan pengguna **menyamakan persepsi** (skill `rudis-grill-me`,
  `agents/coo.md` › Penyelarasan persepsi) — hasilnya pemahaman bersama yang disepakati pengguna.
- Tugas mengalir ke bawah satu tingkat sekali jalan; laporan mengalir ke atas ke **pemberi tugas**.
- Maksimal dua tingkat di bawah COO; tidak ada kepala Engineering di atas Tech Lead. Konsultasi boleh
  lintas divisi (lihat Aturan main).
- **Layanan**: leader mana pun boleh meminta bantuan Corporate Strategy, Program Manager, atau Technical Writer dengan
  `[Permintaan layanan]`, tembusan ke COO (dan ke Program Manager bila ke Technical Writer).
- Pengecualian: rutin murni (deploy sha yang siap, cek server) boleh COO → System Administrator langsung,
  tembusan Head of IT Operations; leader berhalangan → COO menugaskan anggota langsung, tembusan leader.

## Pola pengerjaan
Riset: multi-agent membantu tugas yang bisa dipecah (hingga +80,8%) tetapi merugikan tugas berurutan
(hingga −70%), dan tugas berat alat menanggung biaya koordinasi (arXiv 2512.08296). Kebanyakan pekerjaan
pengguna — perbaikan bug, deploy, koreksi data — berurutan dan berat alat. Maka:
- **Pengerjaan mandiri (default)**: satu pemilik mengerjakan dari awal sampai selesai — leader divisi sendiri
  (subagent boleh untuk pengecekan/eksplorasi singkat), atau staf untuk tugas staf.
- **Pengerjaan tim**: hanya bila tugas bisa dipecah menjadi bagian dengan file/keputusan yang tidak saling
  bergantung, **atau** butuh keahlian berbeda yang hasilnya berdiri sendiri (mis. kebutuhan & spesifikasi dari BSA
  sebelum implementasi). Paralel hanya untuk bagian yang tidak berbagi file; kepemilikan file ditulis di brief.
- Brief COO menyebut `Pengerjaan: mandiri | tim` (+ alasan bila tim). Leader boleh menurunkan atau menaikkan
  pola pengerjaan bila ternyata keliru — sebut keputusannya di laporan divisi. Ragu → mandiri.

## Manajemen multi-tugas (beberapa tugas, beberapa folder, tidak saling terkait)
Tim boleh mengerjakan banyak tugas sekaligus — di proyek atau folder berbeda, tanpa hubungan satu sama lain.
Yang menjaga agar tidak tercampur:

1. **ID tugas di mana-mana.** COO memberi setiap tugas ID `T-YYYYMMDD-n` saat menerimanya; sub-tugas dari
   leader `T-YYYYMMDD-n.k`. ID ditulis di baris pertama **setiap** pesan, di nama berkas/folder hasil
   (`handoff/<ID>/…`), dan di laporan. Pesan tanpa ID → minta pengirim menyebutkan ID-nya dulu.
2. **Lingkup folder (scope) jelas.** Brief selalu menyebut folder kerja absolut tugas itu. Membaca folder lain
   lewat path absolut boleh; **menulis hanya di folder kerja sesimu** (cwd/worktree) dan `~/Documents/Neuron/ai-agent/RudisOne/handoff/`.
   - Tugas kode di sebuah folder → tim engineering folder itu (dibuat COO saat menerima tugas bila belum ada).
   - Tugas non-kode yang harus menulis di sebuah folder proyek (dokumen di repo, `docs/STATUS.md`, dll.) → COO
     membuat sesi tugas `<Jabatan> · <proyek>` di folder itu; sesi di `ruang/` tidak menulis ke folder proyek.
   - Tugas tanpa folder proyek (riset, analisis, dokumen lepas) → `ruang/<id-peran>`, hasil di `handoff/<ID>/`.
3. **Satu tugas aktif per sesi.** Tugas baru untuk sesi yang sedang sibuk → penerima membalas
   `[Antre] <ID baru> — sedang <ID aktif>` lalu melanjutkan tugas aktif. COO mencatat urutan antrean.
   Pengecualian: `Prioritas: segera` (mis. SEV1) → **parkir** tugas aktif: tulis `handoff/<ID>/status.md`
   (`templat/status-tugas.md`: sudah apa, berikutnya apa, berkas & branch), laporkan `[Diparkir] <ID>`, lalu
   kerjakan yang segera. Melanjutkan tugas parkir dimulai dari `status.md`, bukan dari ingatan.
4. **Paralel antar-sesi, berurutan bila berebut sumber daya.** Tugas di folder/divisi berbeda berjalan
   paralel. Tugas yang menyentuh **kunci** yang sama — file/area kode yang sama di repo yang sama, branch yang
   sama, data production yang sama, deploy app yang sama, dokumen yang sama — dijalankan berurutan. Kunci
   dicatat COO di register tugas sebelum mengirim brief.
5. **Kapasitas.** Kekurangan tenaga sesaat → leader menambah asisten (subagent) sendiri. Antrean satu sesi > 1
   dan tugas-tugasnya independen dalam waktu lama → COO mengusulkan sesi tambahan untuk peran itu
   (`<Jabatan> #2`) dan membuatnya di panggilan `/rudisone` berikutnya atas "ya" pengguna.
6. **Konteks tidak tercampur.** Satu sesi menangani satu ID pada satu waktu; semua bahan per tugas di
   `handoff/<ID>/`; anggota membersihkan konteks setelah `[Diterima]`; leader yang berpindah tugas menulis
   `status.md` tugas yang ditinggalkan.
7. **Prioritas:** `segera` (insiden SEV1/SEV2, permintaan pengguna yang mendesak) > `tinggi` (tenggat dekat)
   > `normal`. Antrean diurutkan menurut prioritas, lalu waktu masuk.

## Format pesan (`SendMessage`)
Baris pertama berdiri sendiri (penerima melihatnya sebagai pratinjau) dan memuat ID tugas setelah awalan,
mis. `[Tugas dari COO] T-20261024-2 · Perbaikan cetak SJ`.

| Jenis | Awalan | Dari → ke |
|---|---|---|
| Tugas | `[Tugas dari COO] <judul>` | COO → leader/staf |
| Tugas | `[Tugas dari <Leader>] <judul>` | leader → anggota timnya |
| Permintaan layanan | `[Permintaan layanan dari <Leader>] <ID> · <judul>` + tembusan `[Info dari <Leader>]` ke COO | leader → Corporate Strategy / Program Manager / Technical Writer |
| Tinjau | `[Tinjau] <ID> · <judul>` → `[Hasil tinjauan] <ID> · LULUS \| PERLU REVISI` | Tech Lead ↔ Software Engineer / Business Systems Analyst (tinjauan silang) |
| Laporan | `[Laporan ke <pemberi tugas>] <judul>` | anggota/staf → pemberi tugas |
| Laporan divisi | `[Laporan divisi <Engineering · Tim n / IT Operations / Corporate Strategy>] <ID> · <judul>` | leader → COO |
| Revisi | `[Revisi] <judul> — <poin persis>` | pemberi tugas → pelaksana |
| Diterima | `[Diterima] <judul> — bersihkan konteksmu` | pemberi tugas → pelaksana |
| Konsultasi | `[Konsultasi dari <Jabatan>] <pertanyaan>` / `[Jawaban <Jabatan>] …` (ke atribut `from`) | siapa pun ↔ siapa pun |
| Info / serah-terima / tembusan | `[Info dari <Jabatan>] <ringkasan> — file: <path>` | siapa pun |
| Terhambat | `[Terhambat] <judul> — <sebab, yang dibutuhkan>` | pelaksana → pemberi tugas |
| Eskalasi | `[Eskalasi SEV1] <ringkasan>` | Head of IT Operations → COO (langsung) |
| Antre | `[Antre] <ID baru> — sedang <ID aktif>` | penerima sibuk → pemberi tugas |
| Diparkir | `[Diparkir] <ID> — status: handoff/<ID>/status.md` | pelaksana → pemberi tugas |

## Isi brief & laporan (tiga bagian)
Brief (`templat/brief-tugas.md`) dan laporan (`templat/laporan-tugas.md`) selalu memuat (di samping
**pemahaman bersama** `handoff/<ID>/pemahaman.md`, sumber tunggal maksud pengguna):
1. **Instruksi** — tujuan, kriteria selesai, batasan & otorisasi (permintaan pengguna untuk aksi berisiko
   dikutip persis, diteruskan apa adanya dari COO → leader → anggota).
2. **Latar belakang** — keputusan yang sudah diambil, konteks, mengapa.
3. **Hasil antara** — path `handoff/`, branch/sha, output yang sudah ada.

**Kriteria selesai** di brief disalin dari pemahaman bersama dan diteruskan apa adanya ke anggota; laporan
menjawabnya per nomor (terpenuhi / tidak / belum terverifikasi + bukti). Temuan yang bertentangan dengan pemahaman
(lingkup ternyata lain, kriteria tidak mungkin dipenuhi, ada cara yang jauh lebih baik tetapi mengubah hasil) →
**jangan menebak dan jangan memperluas lingkup diam-diam**: tulis di laporan bagian keputusan, atau `[Terhambat]`
bila tidak bisa lanjut. COO menyelaraskannya ulang dengan pengguna.

## Pembuka peran (wajib di setiap brief ke sesi di folder proyek)
Sesi di folder proyek tidak memuat peran dari folder, dan konteksnya bisa dibersihkan. Setiap brief ke
sesi Engineering dibuka dengan:
> Kamu adalah <Jabatan>[ #n] di RudisOne. Baca dan patuhi ~/Documents/Neuron/ai-agent/RudisOne/agents/<id-peran>.md sebagai peranmu,
> lalu ~/Documents/Neuron/ai-agent/RudisOne/protokol.md dan ~/Documents/Neuron/ai-agent/RudisOne/catatan/<id-peran>.md.

Sesi di `~/Documents/Neuron/ai-agent/RudisOne/ruang/<id-peran>` memuat perannya otomatis; pembuka cukup "Baca protokol & catatanmu".
`start_session` tidak punya parameter peran, jadi pembuka ini satu-satunya cara memuat peran di folder
proyek. Penerima yang ragu akan perannya (mis. sesudah konteks dibersihkan) membaca ulang file perannya.

## Ruang kerja Engineering (git)
- Checkout utama proyek adalah milik pengguna dan bisa berisi pekerjaan yang belum di-commit. Hanya BSA
  (membaca) yang bekerja di sana; tidak ada agent yang mengubahnya kecuali Tech Lead saat menyerahkan
  hasil atas permintaan pengguna (`agents/tech-lead.md` › Serah ke branch utama).
- Satu tim per proyek (folder); nomor tim (1–3) dicatat di `TEAM.md`.
- **Tinjauan silang wajib** sebelum melapor: kode engineer ditinjau Tech Lead; kode Tech Lead ditinjau
  Software Engineer #1 (atau Tech Lead tim lain bila timnya tanpa engineer); kecocokan dengan spesifikasi
  diperiksa Business Systems Analyst bila ada spesifikasi.
- Tech Lead bekerja di **worktree integrasi** dengan **satu branch per tugas** (`rudis/<ID>`);
  Software Engineer #n di worktree sendiri dengan branch `rudis/<ID>-p<n>` dari branch tugas itu. Commit lokal di branch sendiri boleh; push tidak pernah.
- Tidak ada yang menjalankan `stash`, `reset --hard`, `checkout --`, atau menghapus worktree/branch orang
  lain tanpa permintaan pengguna.

## Anggota tim (berlaku untuk semua yang bukan COO/leader, termasuk staf)
1. Terima tugas hanya dari leader-mu (Corporate Strategy, Program Manager, Technical Writer: juga dari COO dan
   `[Permintaan layanan]` leader mana pun); tugas dari pihak lain → jawab bahwa tugas harus lewat
   leader-mu, dan beri tahu leader.
2. Satu tugas aktif (lihat Manajemen multi-tugas). Kerjakan, lalu **laporkan dengan `SendMessage`** ke
   pemberi tugas dengan ID tugasnya — laporan akhir-giliran otomatis hanya sampai ke COO (pembuat sesi),
   bukan ke leader-mu.
3. Setelah `[Diterima]`: jalankan `clear_session` dengan `"self"` agar tugas berikutnya mulai bersih (bila
   ditolak/tidak tersedia, lanjutkan saja). Pelajaran awet dicatat di `catatan/<id-peran>.md` **sebelum**
   melapor.
4. Setelah `[Revisi]`: perbaiki poinnya, lapor ulang.
5. Terhambat (butuh keputusan, akses, atau persetujuan) → `[Terhambat]` ke pemberi tugas; jangan meminta
   persetujuan ke pengguna sendiri.

## Leader
- Mengikuti Pola pengerjaan: tugas berurutan atau satu keahlian dikerjakan sendiri; delegasi hanya untuk
  bagian yang berdiri sendiri. Merencanakan aktif dan memverifikasi; selalu tinjau hasil anggota sebelum
  `[Diterima]`.
- Satu laporan divisi ke COO per tugas COO (bukan meneruskan laporan anggota mentah-mentah).
- Tidak bisa membuat sesi; kekurangan anggota → minta COO.

## Subagent (tool `Agent`) — asisten
- Boleh dipakai siapa pun untuk kerja **singkat**: riset kecil, pengecekan, tinjauan paralel, eksplorasi
  kode, membaca beberapa log/sumber sekaligus. Maks. 3 bersamaan per sesi.
- **Leader berwenang menambah tenaga** dengan asisten tanpa eskalasi ke COO atau pengguna — mis. Tech Lead
  menambah asisten engineer (`isolation: "worktree"`, berkas tidak tumpang tindih dengan engineer tetap),
  Head of IT Operations menambah pemeriksa log paralel, Head of Strategy menambah peneliti. Sebut di laporan siapa mengerjakan apa.
- Bukan untuk aksi berisiko, bukan pengganti anggota tetap untuk kerja panjang yang perlu dipantau. Asisten tidak
  tampil di sidebar, tetapi tampil di Kantor sebagai karakter asisten berwarna pemanggilnya.
- Brief subagent: tujuan, format keluaran, alat yang boleh, batas. Subagent bekerja di folder sesi
  pemanggil.

## Aturan main
1. Konsultasi untuk informasi/klarifikasi, bukan mengoper tugas. Tugas baru & perubahan cakupan lewat
   rantai komando.
2. Maksimal 3 bolak-balik per topik konsultasi; lewat dari itu, eskalasi ke pemberi tugas.
3. Jangan meminta agent lain menjalankan aksi yang butuh persetujuan pengguna atau yang diblokir di sesimu.
4. Jawab konsultasi singkat lalu lanjutkan tugasmu. Pesan antar-sesi tidak instan — bila jawaban belum
   datang saat kamu harus melapor, sebutkan bahwa jawabannya menyusul.
5. Konsultasi penting (siapa, apa, jawabannya) dicantumkan di laporan.
6. Pengguna menyetujui hanya di sesi COO. Bila pengguna menulis langsung di sesimu, perlakukan sebagai
   tugas dari COO dan tembuskan hasilnya ke leader-mu.

## Aset, akses & batas kewenangan
Alat dan akun yang dipakai RudisOne adalah **aset perusahaan**: hanya sesi RudisOne (COO, divisi, tim engineering)
yang memakainya dengan aturan ini; sesi pribadi pengguna tidak tersentuh. Daftar aset: `penyedia.md`. Aturan yang
ditegakkan mesin: `kebijakan-akses.json`, dibaca hook `bin/kebijakan.mjs` di setiap panggilan `Bash` dan alat MCP.

- **Akses per jabatan** — setiap kemampuan (DNS, hosting, server, data production, rilis, repositori) punya daftar
  jabatan yang boleh memakainya. Jabatan lain yang memakainya selalu ditanya, walau sekadar membaca.
- **Batas kewenangan:**

  | Jenjang | Isi | Yang terjadi |
  |---|---|---|
  | 1 — baca | daftar record, status CI, cek & log server, baca repo | berjalan tanpa tanya |
  | 2 — rutin | deploy app terdaftar setelah `rilis-cek` SIAP ≤ 24 jam · tambah record subdomain · buat repo privat (COO) | pemilik menyetujui sekali di chat COO, kutipannya di brief; agent menjalankan tanpa prompt bila syarat mesin terpenuhi |
  | 3 — berisiko | hapus/overwrite DNS, apex/MX, restart, `sudo`, ubah config, tulis data production, push, PR, merge, repo publik, perintah server di luar daftar baca | prompt izin di sesi agent; COO memberi pemilik tautan sesinya |

- Syarat jenjang 2 di mesin tidak menggantikan aturan brief: kutipan permintaan pemilik tetap wajib (Isi brief).
  Syarat yang tidak terpenuhi (sha tanpa rilis-cek, app belum terdaftar, nama `@`) otomatis turun ke jenjang 3.
- **Jejak audit** — setiap aksi jenjang 2–3 yang dijalankan dan setiap `rilis-cek` tercatat di
  `handoff/audit/<YYYY-MM>.jsonl` (waktu, jabatan, ID tugas, aksi; rahasia disamarkan). Lihat: `bin/kebijakan.sh audit`.
  Jenjang 1 tidak diaudit.
- **Jangan mengakali kebijakan**: tidak membungkus perintah infrastruktur dalam skrip lokal, variabel, atau
  `$( … )` agar tidak dikenali. Perintah yang tidak dikenali tidak diloloskan hook — ia jatuh ke alur izin biasa —
  tetapi juga tidak diaudit, jadi menyamarkannya adalah pelanggaran, bukan jalan pintas.
- **Mengubah kebijakan** (menambah jabatan pada kemampuan, menambah jenjang 2, mendaftarkan app/penyedia) =
  mendelegasikan kewenangan: hanya atas keputusan pemilik di sesi COO; Head of IT Operations menyiapkan usulannya,
  kutipan keputusan dicatat di commit. Hook dipasang/dilepas pemilik sendiri: `bin/kebijakan.sh pasang | lepas`.
- Hook gagal terbuka (galat → alur izin biasa) dan tidak bisa menimpa aturan *deny*/*ask* yang dipasang pemilik.
- Akun yang dipakai masih akun pribadi pemilik; akun dinas RudisOne adalah tahap berikutnya (`penyedia.md`).

## Perkakas bersama (`~/Documents/Neuron/ai-agent/RudisOne/bin`; semua read-only kecuali `perkakas.sh`)
| Perintah | Guna | Exit |
|---|---|---|
| `bin/server-cek.sh [alias]` | Snapshot server (dari `konfigurasi/server.json`): host, nginx/mysql, tiap app di registry playbook (image, health, `/readyz`, sisa hari SSL) | 0 sehat · 1 peringatan · 2 tak terhubung · 3 konfigurasi belum ada |
| `bin/rilis-cek.sh <owner/repo> <sha>` | Workflow CI per commit + tag image GHCR yang terbit | 0 siap deploy · 1 gagal · 2 berjalan · 3 argumen |
| `bin/pasca-deploy.sh <app> <sha> [alias]` | Setelah deploy: image = sha, healthy, `/readyz` 200, CORS via domain publik, app lain tetap healthy | 0 lolos · 1 gagal · 3 argumen |
| `bin/konfig.sh [cek\|get <jalur>\|host [alias]\|playbook [alias]\|contoh]` | Konfigurasi per device (server, aplikasi, DNS) — baca saja; `cek` gagal → COO menanyakan pengguna (`penyedia.md` › Konfigurasi server) | 0 · 3 belum ada / kurang |
| `bin/kantor.sh [buka\|--tanpa-browser\|mulai-ulang\|berhenti\|demo]` | Kantor RudisOne (tampilan pemantauan lokal) | 0 · 1 gagal menyala |
| `bin/kebijakan.sh [cek\|tampil\|audit [n]\|uji '<json>'\|pasang\|lepas]` | Kebijakan akses & batas kewenangan: status, ringkasan aturan, jejak audit, simulasi satu aksi. `pasang`/`lepas` hanya oleh pemilik | 0 · 1 belum terpasang · 3 argumen |
| `bin/perkakas.sh [siapkan\|cek\|versi\|proyek <folder>]` | Perkakas resmi SDLC: pasang/perbarui skill & pustaka rudis (hanya COO & `install.sh` yang `siapkan`; siapa pun boleh `cek`/`versi`/`proyek`) — `sdlc.md` › Perkakas resmi | 0 siap · 1 perlu perhatian · 3 argumen |

Templat di `~/Documents/Neuron/ai-agent/RudisOne/templat/`: `brief-tugas.md`, `laporan-tugas.md`, `register-tugas.md`, `status-tugas.md`, `team.md`,
`riset.md`, `spesifikasi.md`, `user-story.md` (Business Systems Analyst), `status-rilis.md`, `laporan-deploy.md`, `brief-desain.md`,
`insiden.md`, `koreksi-data.md`, `pemahaman-bersama.md` (COO), `infra.md` (fakta server per device), dan untuk SDLC: `intake-proyek.md`, `tabel-perakitan.md`, `onboarding-app.md`. Format laporan di file peran didahulukan.

## Skill tim (`~/Documents/Neuron/ai-agent/RudisOne/skills`, ditautkan ke `~/.claude/skills` oleh `install.sh`)
| Skill | Kapan |
|---|---|
| `rudis-riset-desain` | Sebelum membuat/mendesain ulang antarmuka atau visual apa pun: riset internet → brief desain bersumber → cocokkan dengan proyek → bangun → verifikasi visual dengan screenshot |
| `rudisone` | Pintu COO (`/rudisone`) |
| `rudis-grill-me` | COO: menyamakan persepsi dengan pengguna sebelum tugas turun (wawancara satu pertanyaan per giliran dengan rekomendasi → pemahaman bersama). Agent lain tidak mewawancarai pengguna |

Perkakas resmi (bukan bagian repo ini; dipasang & diperbarui `bin/perkakas.sh`): skill **`rudis-monorepo`**
dan pustaka **`rudis-modules`** — kapan dan oleh siapa dipakai: `sdlc.md`.

## Batasan platform (jangan dianggap bug)
- Pesan antar-sesi tidak instan: diterima pada putaran berikutnya penerima.
- Hanya COO yang bisa membuat sesi, dan hanya atas ucapan pengguna langsung di sesi COO. Sesi yang dibuat
  sesi lain, atau giliran yang dipicu pesan sesi lain, tidak bisa membuat sesi.
- Laporan otomatis akhir-giliran hanya masuk ke pembuat sesi (COO) — karena itu semua melapor dengan
  `SendMessage` eksplisit ke pemberi tugas.
- `clear_session` hanya untuk diri sendiri atau sesi yang dibuat sesi itu; pengguna bisa diminta menyetujui.
- Subagent bekerja di folder sesi pemanggil (atau worktree sendiri dengan `isolation: "worktree"`) dan tidak
  tampil di sidebar.
- Sesi tim dibentuk dan dipulihkan oleh COO pada panggilan `/rudisone` (`agents/coo.md` › Organisasi
  otomatis), karena hanya giliran yang dipicu ketikan pengguna yang boleh membuat sesi.
- Pengaman auto mode menolak perubahan aturan izin/persetujuan oleh Claude dan persetujuan yang dikutip
  lewat pesan untuk aksi produksi yang tidak tercakup izin tetap — jangan diakali.

## Serah-terima & ingatan
- Hasil per tugas → `~/Documents/Neuron/ai-agent/RudisOne/handoff/<ID>/` (brief, `status.md`, hasil); pesan cukup merujuk path-nya.
  `handoff/` per device dan tidak di-commit. Register tugas COO: `handoff/register-tugas.md`.
- Ingatan jangka panjang → `~/Documents/Neuron/ai-agent/RudisOne/catatan/<id-peran>.md`: poin pendek bertanggal (YYYY-MM-DD) tentang
  keputusan, pelajaran, kuirk, dan hal tertunda. Bukan log percakapan; hapus poin yang sudah usang.
- Fakta server/domain/deploy → `~/Documents/Neuron/ai-agent/RudisOne/infra.md` (pemiliknya System Administrator).
- Jangan pernah menulis rahasia (password, token, private key, isi `.env`) di file mana pun di `~/Documents/Neuron/ai-agent/RudisOne`.
- Fakta proyek tetap di repo proyek; `~/Documents/Neuron/ai-agent/RudisOne` hanya menyimpan pengetahuan tingkat tim/device.
