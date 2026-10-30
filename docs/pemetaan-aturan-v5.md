# Pemetaan aturan v4 → v5 (T-20261030-2)

Tujuan: membuktikan bahwa **setiap** aturan protokol v4 punya tempat di v5 (inti kecil + skill prosedur + model sesi
"inti kecil + subagent") atau sengaja dihapus dengan alasan. Cakupan 100%: satu baris per unit dari
`bin/inventaris-aturan.mjs` (P = `protokol.md`, S = `sdlc.md`, C = `agents/coo.md`) pada ref lama **`3b1c888`**
(main sebelum migrasi).

Cara cek: `node bin/cek-konsistensi.mjs --repo --ref 3b1c888` — pemeriksa memastikan setiap kode inventaris ada di
tabel ini dan setiap **Jangkar** ada persis (spasi/baris baru dinormalkan) di berkas **Lokasi baru**. Inventaris
lengkap beserta teks utuh: `node bin/inventaris-aturan.mjs --ref 3b1c888 [--json]`.

Kolom: **Aturan lama** = `berkas › bagian: ringkasan` — bagian ditulis miring karena merujuk judul di ref lama, bukan
di berkas sekarang (keterangan dalam kurung di judul bagian dibuang agar ringkas);
**Lokasi baru** = satu berkas tempat aturan itu kini berada; **Jangkar** = potongan teks yang ada persis di berkas itu
(untuk `dihapus`: alasannya).

Status:
- `tetap` — isi sama atau hampir sama (mungkin pindah berkas).
- `diringkas` — maknanya dipertahankan dengan lebih ringkas.
- `diganti` — sengaja digantikan aturan baru; jangkar menunjuk aturan pengganti (mis. organisasi penuh sebagai sesi →
  Organisasi inti; register MD tulisan tangan → `bin/register.sh`).
- `dihapus` — sengaja dibuang (persona, duplikat, usang karena model baru), dengan alasan.

Ringkasan: 261 unit — tetap 147 · diringkas 90 · diganti 24 · dihapus 0.

| Kode | Aturan lama | Lokasi baru | Jangkar | Status |
|---|---|---|---|---|
| P-001 | protokol.md › *Protokol RudisOne*: berlaku untuk COO & semua agent; protokol pemilik tunggal aturan | protokol.md | Aturan bersama yang **selalu** berlaku untuk COO dan semua peran | diringkas |
| P-002 | protokol.md › *Protokol RudisOne*: pemilik fakta: rantai komando, pola, multi-tugas, pesan → protokol.md | protokol.md | `protokol.md` (inti ini) | diringkas |
| P-003 | protokol.md › *Protokol RudisOne*: pemilik fakta: maksud pengguna per tugas → `handoff/<ID>/pemahaman.md` | protokol.md | Maksud pengguna per tugas (hasil penyelarasan) | diringkas |
| P-004 | protokol.md › *Protokol RudisOne*: pemilik fakta: daftar tugas → handoff/register-tugas.md (ditulis COO) | protokol.md | ditulis **hanya** lewat `bin/register.sh` | diganti |
| P-005 | protokol.md › *Protokol RudisOne*: pemilik fakta: R/S/C per aktivitas → raci.md | protokol.md | Siapa R/S/C per aktivitas | tetap |
| P-006 | protokol.md › *Protokol RudisOne*: pemilik fakta: membangun software (fase, gerbang, perkakas) → sdlc.md | protokol.md | Membangun software: fase, gerbang, perkakas resmi | diringkas |
| P-007 | protokol.md › *Protokol RudisOne*: pemilik fakta: tugas per peran, routing, organisasi otomatis → agents/ | protokol.md | Tugas khusus per peran | diringkas |
| P-008 | protokol.md › *Protokol RudisOne*: pemilik fakta: alamat sesi tim → TEAM.md | protokol.md | Alamat sesi (per device, tidak di-commit) | diringkas |
| P-009 | protokol.md › *Protokol RudisOne*: pemilik fakta: server/app/domain → infra.md + konfigurasi/ | protokol.md | `infra.md` (prosedur) + `konfigurasi/` (fakta per device) | diringkas |
| P-010 | protokol.md › *Protokol RudisOne*: pemilik fakta: aset & penyedia → penyedia.md (pemelihara HITO) | protokol.md | aset & penyedia: `penyedia.md` | diringkas |
| P-011 | protokol.md › *Protokol RudisOne*: pemilik fakta: akses per jabatan → kebijakan-akses.json | protokol.md | `kebijakan-akses.json` (ditegakkan hook `bin/kebijakan.mjs`) | diringkas |
| P-012 | protokol.md › *Rantai komando*: Corporate Strategy = staf COO; HoS memimpin tugas lintas anggota | protokol.md | Corporate Strategy adalah staf COO (Head of Strategy memimpin tugas lintas anggota) | diringkas |
| P-013 | protokol.md › *Rantai komando*: Engineering Tim 1–3, satu per proyek, dibentuk lengkap (TL, BSA, SE) | protokol.md | Engineering per proyek: Tech Lead memimpin BSA dan SE | diganti |
| P-014 | protokol.md › *Rantai komando*: layanan bersama: Program Manager membimbing Technical Writer | protokol.md | layanan bersama: Program Manager (membimbing Technical Writer) | tetap |
| P-015 | protokol.md › *Rantai komando*: IT Operations: HITO memimpin System Administrator | protokol.md | IT Operations: Head of IT Operations memimpin System Administrator | tetap |
| P-016 | protokol.md › *Jabatan & identitas*: pengguna satu-satunya pengambil keputusan; jabatan vs id peran | protokol.md | Pengguna adalah pemilik dan satu-satunya pengambil keputusan (A) | diringkas |
| P-017 | protokol.md › *Jabatan & identitas*: tabel jabatan: COO | protokol.md | COO (Chief Operating Officer) \| `coo` \| pimpinan — pintu tunggal pengguna | tetap |
| P-018 | protokol.md › *Jabatan & identitas*: tabel jabatan: Head of Strategy | protokol.md | `head-of-strategy` \| Corporate Strategy \| HoS | tetap |
| P-019 | protokol.md › *Jabatan & identitas*: tabel jabatan: Financial Controller | protokol.md | `financial-controller` \| Corporate Strategy \| FC | tetap |
| P-020 | protokol.md › *Jabatan & identitas*: tabel jabatan: Research Analyst | protokol.md | `research-analyst` \| Corporate Strategy \| RA | tetap |
| P-021 | protokol.md › *Jabatan & identitas*: tabel jabatan: HR Business Partner | protokol.md | `hr-business-partner` \| Corporate Strategy \| HRBP | tetap |
| P-022 | protokol.md › *Jabatan & identitas*: tabel jabatan: Tech Lead | protokol.md | `tech-lead` \| Engineering · Tim n \| TL | tetap |
| P-023 | protokol.md › *Jabatan & identitas*: tabel jabatan: Business Systems Analyst | protokol.md | `business-systems-analyst` \| Engineering · Tim n \| BSA | tetap |
| P-024 | protokol.md › *Jabatan & identitas*: tabel jabatan: Software Engineer #1/#2 | protokol.md | Software Engineer #1 / #2 \| `software-engineer` \| Engineering · Tim n \| SE | tetap |
| P-025 | protokol.md › *Jabatan & identitas*: tabel jabatan: Program Manager | protokol.md | `program-manager` \| Engineering · layanan bersama \| PgM | tetap |
| P-026 | protokol.md › *Jabatan & identitas*: tabel jabatan: Technical Writer | protokol.md | `technical-writer` \| Engineering · layanan bersama \| TW | tetap |
| P-027 | protokol.md › *Jabatan & identitas*: tabel jabatan: Head of IT Operations | protokol.md | `head-of-it-operations` \| IT Operations \| HITO | tetap |
| P-028 | protokol.md › *Jabatan & identitas*: tabel jabatan: System Administrator | protokol.md | `system-administrator` \| IT Operations \| SysAdmin | tetap |
| P-029 | protokol.md › *Jabatan & identitas*: tidak ada tugas turun sebelum COO & pengguna menyamakan persepsi | protokol.md | Tidak ada tugas yang turun sebelum COO dan pengguna **menyamakan persepsi** | diringkas |
| P-030 | protokol.md › *Jabatan & identitas*: tugas turun satu tingkat; laporan naik ke pemberi tugas | protokol.md | Tugas turun satu tingkat sekali jalan; laporan naik ke **pemberi tugas** | tetap |
| P-031 | protokol.md › *Jabatan & identitas*: maks. dua tingkat di bawah COO; konsultasi boleh lintas divisi | protokol.md | tidak ada kepala Engineering di atas Tech Lead. | diringkas |
| P-032 | protokol.md › *Jabatan & identitas*: layanan: leader boleh minta CS/PgM/TW, tembusan COO (& PgM bila TW) | protokol.md | ke Technical Writer juga tembusan Program Manager | tetap |
| P-033 | protokol.md › *Jabatan & identitas*: pengecualian rutin murni COO → SysAdmin; leader berhalangan | protokol.md | Pengecualian: rutin murni (deploy sha yang siap, cek server) boleh COO → System Administrator langsung | tetap |
| P-034 | protokol.md › *Pola pengerjaan*: riset multi-agent (arXiv 2512.08296): pekerjaan berurutan & berat alat | protokol.md | merugikan tugas berurutan dan berat alat (arXiv 2512.08296) | diringkas |
| P-035 | protokol.md › *Pola pengerjaan*: pengerjaan mandiri sebagai default | protokol.md | **Mandiri (default):** satu pemilik dari awal sampai selesai | diringkas |
| P-036 | protokol.md › *Pola pengerjaan*: pengerjaan tim hanya bila bagian tak saling bergantung | protokol.md | **Tim:** hanya bila tugas terpecah menjadi bagian dengan berkas/keputusan yang tidak saling bergantung | diringkas |
| P-037 | protokol.md › *Pola pengerjaan*: brief sebut pola pengerjaan; leader boleh ubah; ragu → mandiri | protokol.md | Leader boleh mengubahnya bila keliru — sebut di laporan. Ragu → mandiri. | diringkas |
| P-038 | protokol.md › *Manajemen multi-tugas*: tim boleh banyak tugas sekaligus di folder berbeda | skills/rudis-multitugas/SKILL.md | banyak tugas sekaligus di proyek atau folder berbeda yang tidak saling terkait | tetap |
| P-039 | protokol.md › *Manajemen multi-tugas*: ID tugas T-YYYYMMDD-n di setiap pesan, berkas, laporan | skills/rudis-multitugas/SKILL.md | Pesan tanpa ID → minta pengirim menyebutkan ID-nya dulu. | tetap |
| P-040 | protokol.md › *Manajemen multi-tugas*: lingkup folder: brief sebut folder absolut; tulis hanya di folder sesi | skills/rudis-multitugas/SKILL.md | Brief selalu menyebut folder kerja absolut. | tetap |
| P-041 | protokol.md › *Manajemen multi-tugas*: tugas kode di folder → tim engineering folder itu (dibuat COO) | skills/rudis-multitugas/SKILL.md | Tugas kode di sebuah folder → Tech Lead proyek itu (sesi inti; COO membentuknya saat tugas pertama dijadwalkan) | diganti |
| P-042 | protokol.md › *Manajemen multi-tugas*: tugas non-kode menulis di folder proyek → sesi tugas di folder itu | skills/rudis-multitugas/SKILL.md | Tugas non-kode yang harus menulis di folder proyek (dokumen di repo, `docs/STATUS.md`) → lewat Tech Lead proyek itu | diganti |
| P-043 | protokol.md › *Manajemen multi-tugas*: tugas tanpa folder proyek → `ruang/<id-peran>`, hasil di handoff/ | skills/rudis-multitugas/SKILL.md | Tugas tanpa folder proyek (riset, analisis, dokumen lepas) → subagent peran, hasil di `handoff/<ID>/`. | diganti |
| P-044 | protokol.md › *Manajemen multi-tugas*: satu tugas aktif per sesi; [Antre]; segera → parkir dengan status.md | skills/rudis-multitugas/SKILL.md | Melanjutkan tugas parkir dimulai dari `status.md`, bukan dari ingatan. | tetap |
| P-045 | protokol.md › *Manajemen multi-tugas*: paralel antar-sesi; kunci sama → berurutan; kunci dicatat COO | skills/rudis-multitugas/SKILL.md | Tugas di folder/divisi berbeda berjalan paralel. | tetap |
| P-046 | protokol.md › *Manajemen multi-tugas*: kapasitas: leader tambah subagent; antrean > 1 → usul sesi #2 | skills/rudis-multitugas/SKILL.md | Kekurangan tenaga sesaat → leader menambah subagent sendiri (maks. 3 bersamaan). | diringkas |
| P-047 | protokol.md › *Manajemen multi-tugas*: konteks tidak tercampur: satu ID per sesi, bahan di `handoff/<ID>/` | skills/rudis-multitugas/SKILL.md | Satu sesi menangani satu ID pada satu waktu; semua bahan per tugas di `handoff/<ID>/` | tetap |
| P-048 | protokol.md › *Manajemen multi-tugas*: prioritas: segera > tinggi (tenggat dekat) … | skills/rudis-multitugas/SKILL.md | `segera` (insiden SEV1/SEV2, permintaan pengguna yang mendesak) > `tinggi` (tenggat dekat) | tetap |
| P-049 | protokol.md › *Manajemen multi-tugas*: … > normal; antrean urut prioritas lalu waktu masuk | skills/rudis-multitugas/SKILL.md | Antrean diurutkan menurut prioritas, lalu waktu masuk. | tetap |
| P-050 | protokol.md › *Format pesan*: baris pertama pesan berdiri sendiri + ID tugas setelah awalan | protokol.md | Baris pertama berdiri sendiri dan memuat ID setelah awalan | diringkas |
| P-051 | protokol.md › *Format pesan*: awalan [Tugas dari COO]: COO → leader/staf | protokol.md | COO → leader/staf · leader → anggota | diringkas |
| P-052 | protokol.md › *Format pesan*: awalan [Tugas dari `<Leader>]:` leader → anggota | protokol.md | `[Tugas dari <Leader>] <judul>` | diringkas |
| P-053 | protokol.md › *Format pesan*: awalan [Permintaan layanan dari `<Leader>]` + tembusan ke COO | protokol.md | `[Permintaan layanan dari <Leader>] <ID> · <judul>` (+ `[Info dari <Leader>]` ke COO) | diringkas |
| P-054 | protokol.md › *Format pesan*: awalan [Tinjau] → [Hasil tinjauan] LULUS / PERLU REVISI | protokol.md | `[Tinjau] <ID> · <judul>` → `[Hasil tinjauan] <ID> · LULUS | diringkas |
| P-055 | protokol.md › *Format pesan*: awalan [Laporan ke <pemberi tugas>] | protokol.md | `[Laporan ke <pemberi tugas>]` | tetap |
| P-056 | protokol.md › *Format pesan*: awalan [Laporan divisi …] leader → COO | protokol.md | `[Laporan divisi <divisi>] <ID> · <judul>` | diringkas |
| P-057 | protokol.md › *Format pesan*: awalan [Revisi] `<judul>` — <poin persis> | protokol.md | `[Revisi] <judul> — <poin persis>` | tetap |
| P-058 | protokol.md › *Format pesan*: awalan [Diterima] `<judul>` — bersihkan konteksmu | protokol.md | `[Diterima] <judul> — bersihkan konteksmu` | tetap |
| P-059 | protokol.md › *Format pesan*: awalan [Konsultasi dari …] / [Jawaban …] | protokol.md | `[Konsultasi dari <Jabatan>]` → `[Jawaban <Jabatan>]` (ke atribut `from`) | diringkas |
| P-060 | protokol.md › *Format pesan*: awalan [Info dari `<Jabatan>]` … — file: `<path>` | protokol.md | `[Info dari <Jabatan>] <ringkasan> — file: <path>` | tetap |
| P-061 | protokol.md › *Format pesan*: awalan [Terhambat] `<judul>` — <sebab, yang dibutuhkan> | protokol.md | `[Terhambat] <judul> — <sebab, yang dibutuhkan>` | tetap |
| P-062 | protokol.md › *Format pesan*: awalan [Eskalasi SEV1] HITO → COO langsung | protokol.md | `[Eskalasi SEV1] <ringkasan>` \| Head of IT Operations → COO | tetap |
| P-063 | protokol.md › *Format pesan*: awalan [Antre] <ID baru> — sedang <ID aktif> | protokol.md | `[Antre] <ID baru> — sedang <ID aktif>` | tetap |
| P-064 | protokol.md › *Format pesan*: awalan [Diparkir] `<ID>` — status: `handoff/<ID>/status.md` | protokol.md | `[Diparkir] <ID> — status: handoff/<ID>/status.md` | tetap |
| P-065 | protokol.md › *Isi brief & laporan*: brief & laporan memuat tiga bagian + pemahaman bersama | protokol.md | Brief (`templat/brief-tugas.md`) dan laporan (`templat/laporan-tugas.md`) memuat, di samping pemahaman bersama | diringkas |
| P-066 | protokol.md › *Isi brief & laporan*: bagian Instruksi; kutipan aksi berisiko diteruskan apa adanya | protokol.md | **Instruksi** — tujuan, kriteria selesai, batasan & otorisasi (permintaan pengguna untuk aksi berisiko dikutip persis | tetap |
| P-067 | protokol.md › *Isi brief & laporan*: bagian Latar belakang | protokol.md | **Latar belakang** — keputusan yang sudah diambil, konteks, alasannya. | tetap |
| P-068 | protokol.md › *Isi brief & laporan*: bagian Hasil antara | protokol.md | **Hasil antara** — path `handoff/`, branch/sha, keluaran yang sudah ada. | tetap |
| P-069 | protokol.md › *Isi brief & laporan*: kriteria selesai disalin; temuan bertentangan → jangan menebak | protokol.md | jangan menebak dan jangan memperluas lingkup diam-diam | diringkas |
| P-070 | protokol.md › *Pembuka peran*: pembuka peran wajib di brief ke sesi folder proyek | protokol.md | Sesi di folder proyek tidak memuat peran dari folder. | diringkas |
| P-071 | protokol.md › *Pembuka peran*: teks pembuka: Kamu adalah `<Jabatan>` … `agents/<id-peran>.md` | protokol.md | `Kamu adalah <Jabatan>[ #n] di RudisOne. Baca dan patuhi ~/Documents/Neuron/ai-agent/RudisOne/agents/<id-peran>.md` | tetap |
| P-072 | protokol.md › *Pembuka peran*: teks pembuka: lalu protokol.md dan `catatan/<id-peran>.md` | protokol.md | sebagai peranmu, lalu ~/Documents/Neuron/ai-agent/RudisOne/protokol.md dan | tetap |
| P-073 | protokol.md › *Pembuka peran*: sesi ruang/ memuat peran otomatis; ragu → baca ulang berkas peran | protokol.md | Sesi di `ruang/<id-peran>` memuat peran otomatis | diringkas |
| P-074 | protokol.md › *Ruang kerja Engineering*: checkout utama milik pengguna; hanya TL mengubah saat serah | protokol.md | Checkout utama proyek milik pengguna dan bisa berisi pekerjaan yang belum di-commit | diringkas |
| P-075 | protokol.md › *Ruang kerja Engineering*: satu tim per proyek; nomor tim 1–3 di TEAM.md | agents/coo.md | Nomor tim kosong terkecil 1–3 | diringkas |
| P-076 | protokol.md › *Ruang kerja Engineering*: tinjauan silang wajib; kode TL ditinjau SE#1 | protokol.md | kode Tech Lead ditinjau peninjau berkonteks bersih | diganti |
| P-077 | protokol.md › *Ruang kerja Engineering*: worktree TL, branch per tugas; SE di worktree sendiri; tanpa push | protokol.md | Commit lokal di branch sendiri boleh; **push tidak pernah**. | diringkas |
| P-078 | protokol.md › *Ruang kerja Engineering*: dilarang stash/reset --hard/checkout --/hapus worktree orang lain | protokol.md | Tidak ada yang menjalankan `stash`, `reset --hard`, `checkout --` | tetap |
| P-079 | protokol.md › *Anggota tim*: anggota terima tugas hanya dari leader-nya (+ pengecualian staf) | protokol.md | Anggota menerima tugas hanya dari leader-nya | diringkas |
| P-080 | protokol.md › *Anggota tim*: satu tugas aktif; lapor dengan SendMessage ke pemberi tugas | protokol.md | Sesi melapor dengan `SendMessage` eksplisit ke pemberi tugas | diringkas |
| P-081 | protokol.md › *Anggota tim*: setelah [Diterima]: clear_session self; catatan sebelum melapor | protokol.md | Setelah `[Diterima]`: `clear_session` `"self"` bila tersedia. | diringkas |
| P-082 | protokol.md › *Anggota tim*: setelah [Revisi]: perbaiki, lapor ulang | protokol.md | Setelah `[Revisi]`: perbaiki, lapor ulang. | tetap |
| P-083 | protokol.md › *Anggota tim*: terhambat → [Terhambat] ke pemberi tugas; jangan minta ke pengguna | protokol.md | jangan meminta persetujuan ke pengguna. | tetap |
| P-084 | protokol.md › *Leader*: leader ikuti pola pengerjaan; selalu tinjau sebelum [Diterima] | protokol.md | Leader merencanakan, membagi hanya bagian yang berdiri sendiri, **selalu meninjau** hasil anggota | diringkas |
| P-085 | protokol.md › *Leader*: satu laporan divisi per tugas COO | protokol.md | mengirim **satu** laporan divisi per tugas COO | tetap |
| P-086 | protokol.md › *Leader*: leader tidak bisa membuat sesi; kurang anggota → minta COO | protokol.md | Leader tidak bisa membuat sesi; butuh tenaga → subagent, atau minta COO. | diringkas |
| P-087 | protokol.md › *Subagent (tool `Agent`) — asisten*: subagent untuk kerja singkat; maks. 3 bersamaan per sesi | protokol.md | Maks. 3 bersamaan per sesi. | diringkas |
| P-088 | protokol.md › *Subagent (tool `Agent`) — asisten*: leader berwenang menambah asisten tanpa eskalasi; sebut di laporan | protokol.md | Leader menambah tenaga dengan subagent tanpa eskalasi. | diringkas |
| P-089 | protokol.md › *Subagent (tool `Agent`) — asisten*: subagent bukan untuk aksi berisiko; tampil di Kantor, tidak di sidebar | protokol.md | Bukan untuk aksi berisiko dan bukan pengganti sesi untuk kerja panjang | diringkas |
| P-090 | protokol.md › *Subagent (tool `Agent`) — asisten*: brief subagent: tujuan, format, alat, batas; kerja di folder pemanggil | protokol.md | Brief subagent: ID, tujuan, kriteria selesai, alat & berkas yang boleh disentuh | diringkas |
| P-091 | protokol.md › *Aturan main*: konsultasi untuk informasi, bukan mengoper tugas | protokol.md | Konsultasi untuk informasi, bukan mengoper tugas | diringkas |
| P-092 | protokol.md › *Aturan main*: maks. 3 bolak-balik per topik konsultasi lalu eskalasi | protokol.md | maks. 3 bolak-balik per topik, lalu eskalasi ke pemberi tugas | diringkas |
| P-093 | protokol.md › *Aturan main*: jangan minta agent lain menjalankan aksi butuh persetujuan/diblokir | protokol.md | Jangan meminta agent lain menjalankan aksi yang butuh persetujuan pengguna atau yang diblokir di sesimu. | tetap |
| P-094 | protokol.md › *Aturan main*: jawab konsultasi singkat; pesan tidak instan, sebut jawaban menyusul | protokol.md | Jawab konsultasi singkat lalu lanjutkan tugasmu | tetap |
| P-095 | protokol.md › *Aturan main*: konsultasi penting dicantumkan di laporan | protokol.md | konsultasi penting dicantumkan di laporan. | tetap |
| P-096 | protokol.md › *Aturan main*: pengguna setuju hanya di sesi COO; pesan langsung = tugas dari COO | protokol.md | perlakukan sebagai tugas dari COO dan tembuskan hasilnya ke leader-mu | tetap |
| P-097 | protokol.md › *Aset, akses & batas kewenangan*: alat & akun = aset perusahaan, hanya sesi RudisOne; hook kebijakan | skills/rudis-operasi/SKILL.md | Alat dan akun yang dipakai RudisOne adalah **aset perusahaan** | diringkas |
| P-098 | protokol.md › *Aset, akses & batas kewenangan*: akses per jabatan; jabatan lain selalu ditanya walau membaca | skills/rudis-operasi/SKILL.md | jabatan lain selalu ditanya, walau sekadar membaca. | tetap |
| P-099 | protokol.md › *Aset, akses & batas kewenangan*: judul daftar batas kewenangan | protokol.md | Akses & batas kewenangan (rinci: skill `rudis-operasi`) | diringkas |
| P-100 | protokol.md › *Aset, akses & batas kewenangan*: jenjang 1 — baca: berjalan tanpa tanya | protokol.md | daftar record, status CI, cek & log server, baca repo \| berjalan tanpa tanya | tetap |
| P-101 | protokol.md › *Aset, akses & batas kewenangan*: jenjang 2 — rutin: setuju sekali di chat COO, tanpa prompt bila syarat | protokol.md | pemilik menyetujui sekali di chat COO, kutipannya di brief | diringkas |
| P-102 | protokol.md › *Aset, akses & batas kewenangan*: jenjang 3 — berisiko: prompt izin di sesi agent, tautan dari COO | protokol.md | perintah server di luar daftar baca \| prompt izin di sesi agent | diringkas |
| P-103 | protokol.md › *Aset, akses & batas kewenangan*: syarat mesin jenjang 2 tidak gantikan kutipan; gagal → jenjang 3 | skills/rudis-operasi/SKILL.md | Syarat mesin tidak menggantikan aturan brief: kutipan permintaan pemilik tetap wajib. | tetap |
| P-104 | protokol.md › *Aset, akses & batas kewenangan*: jejak audit aksi jenjang 2–3 & rilis-cek di handoff/audit/ | skills/rudis-operasi/SKILL.md | Setiap aksi jenjang 2–3 yang dijalankan dan setiap `rilis-cek` tercatat di `handoff/audit/<YYYY-MM>.jsonl` | tetap |
| P-105 | protokol.md › *Aset, akses & batas kewenangan*: jangan mengakali kebijakan (skrip, variabel, $( … )) | skills/rudis-operasi/SKILL.md | menyamarkannya adalah pelanggaran, bukan jalan pintas. | tetap |
| P-106 | protokol.md › *Aset, akses & batas kewenangan*: mengubah kebijakan = delegasi kewenangan, keputusan pemilik | skills/rudis-operasi/SKILL.md | mendelegasikan kewenangan: hanya atas keputusan pemilik di sesi COO | tetap |
| P-107 | protokol.md › *Aset, akses & batas kewenangan*: hook gagal terbuka; tidak menimpa deny/ask pemilik | skills/rudis-operasi/SKILL.md | Hook gagal terbuka (galat → alur izin biasa) dan tidak bisa menimpa aturan *deny*/*ask* yang dipasang pemilik. | tetap |
| P-108 | protokol.md › *Aset, akses & batas kewenangan*: akun masih pribadi pemilik; akun dinas tahap berikutnya | skills/rudis-operasi/SKILL.md | Akun yang dipakai masih akun pribadi pemilik; akun dinas RudisOne adalah tahap berikutnya | tetap |
| P-109 | protokol.md › *Perkakas bersama*: perkakas: server-cek.sh | skills/rudis-perkakas/SKILL.md | Snapshot server (dari `konfigurasi/server.json`) | tetap |
| P-110 | protokol.md › *Perkakas bersama*: perkakas: rilis-cek.sh | skills/rudis-perkakas/SKILL.md | Workflow CI per commit + tag image GHCR yang terbit | tetap |
| P-111 | protokol.md › *Perkakas bersama*: perkakas: pasca-deploy.sh | skills/rudis-perkakas/SKILL.md | Setelah deploy: image = sha, healthy, `/readyz` 200 | tetap |
| P-112 | protokol.md › *Perkakas bersama*: perkakas: konfig.sh | skills/rudis-perkakas/SKILL.md | Konfigurasi per device (server, aplikasi, DNS) — baca saja | tetap |
| P-113 | protokol.md › *Perkakas bersama*: perkakas: kantor.sh | skills/rudis-perkakas/SKILL.md | Kantor RudisOne (tampilan pemantauan lokal) | tetap |
| P-114 | protokol.md › *Perkakas bersama*: perkakas: kebijakan.sh; pasang/lepas hanya pemilik | skills/rudis-perkakas/SKILL.md | Kebijakan akses & batas kewenangan: status, ringkasan aturan, jejak audit, simulasi satu aksi | tetap |
| P-115 | protokol.md › *Perkakas bersama*: perkakas: perkakas.sh siapkan/cek/versi/proyek | skills/rudis-perkakas/SKILL.md | Perkakas resmi SDLC: pasang/perbarui skill & pustaka rudis | tetap |
| P-116 | protokol.md › *Perkakas bersama*: perkakas: perkakas.sh pastikan/skill (skill luar) | skills/rudis-perkakas/SKILL.md | Skill luar: pastikan satu skill tersedia (dipasang dari sumber resminya bila belum) | tetap |
| P-117 | protokol.md › *Perkakas bersama*: daftar templat; format laporan di file peran didahulukan | skills/rudis-perkakas/SKILL.md | Format laporan di file peran didahulukan. | tetap |
| P-118 | protokol.md › *Skill tim*: skill tim: rudis-riset-desain | skills/rudis-perkakas/SKILL.md | Sebelum membuat/mendesain ulang antarmuka atau visual apa pun: riset internet | tetap |
| P-119 | protokol.md › *Skill tim*: skill tim: rudisone = pintu COO | skills/rudis-perkakas/SKILL.md | Pintu COO (`/rudisone`) | tetap |
| P-120 | protokol.md › *Skill tim*: skill tim: rudis-grill-me; agent lain tidak mewawancarai pengguna | skills/rudis-perkakas/SKILL.md | Agent lain tidak mewawancarai pengguna | tetap |
| P-121 | protokol.md › *Skill tim*: perkakas resmi rudis-monorepo & rudis-modules di luar repo | skills/rudis-perkakas/SKILL.md | Perkakas resmi (bukan bagian repo ini; dipasang & diperbarui `bin/perkakas.sh`) | tetap |
| P-122 | protokol.md › *Skill luar*: skill luar: jalankan perkakas.sh pastikan sebelum memuat | skills/rudis-perkakas/SKILL.md | skill luar yang belum muncul di daftar skill sesimu, jalankan `bin/perkakas.sh pastikan <skill>` | tetap |
| P-123 | protokol.md › *Skill luar*: skill luar: docx-neuron (TW, PgM) | skills/rudis-perkakas/SKILL.md | repo privat `DimasPrasetio/docx-neuron` | tetap |
| P-124 | protokol.md › *Skill luar*: skill luar: docx/pdf/pptx/xlsx (document-skills) | skills/rudis-perkakas/SKILL.md | plugin `document-skills` dari marketplace `anthropics/skills` | tetap |
| P-125 | protokol.md › *Skill luar*: skill luar: frontend-design (TL, SE) | skills/rudis-perkakas/SKILL.md | plugin `frontend-design` dari marketplace `anthropics/claude-plugins-official` | tetap |
| P-126 | protokol.md › *Skill luar*: skill luar: docs (bawaan, alternatif docx) | skills/rudis-perkakas/SKILL.md | bawaan aplikasi Claude — tidak bisa dipasang; alternatif `docx` | tetap |
| P-127 | protokol.md › *Skill luar*: skill Anthropic jangan pernah disalin ke repo | skills/rudis-perkakas/SKILL.md | **jangan pernah disalin** ke repo/folder sendiri | tetap |
| P-128 | protokol.md › *Skill luar*: skill luar baru didaftarkan COO di perkakas.json atas persetujuan | skills/rudis-perkakas/SKILL.md | Skill luar baru: COO mendaftarkannya di `perkakas.json` | tetap |
| P-129 | protokol.md › *Batasan platform*: pesan antar-sesi diterima pada putaran berikutnya | protokol.md | Pesan antar-sesi diterima pada putaran berikutnya penerima | tetap |
| P-130 | protokol.md › *Batasan platform*: hanya COO membuat sesi, hanya atas ucapan pengguna langsung | protokol.md | Hanya COO yang membuat sesi, dan hanya pada giliran yang dipicu ketikan pengguna di sesi COO. | diringkas |
| P-131 | protokol.md › *Batasan platform*: laporan otomatis akhir-giliran hanya ke pembuat sesi | protokol.md | laporan otomatis akhir-giliran hanya ke pembuat sesi | tetap |
| P-132 | protokol.md › *Batasan platform*: clear_session hanya untuk diri sendiri/sesi buatannya | protokol.md | `clear_session` hanya untuk diri sendiri atau sesi buatan sendiri. | diringkas |
| P-133 | protokol.md › *Batasan platform*: subagent kerja di folder pemanggil/worktree; tak tampil di sidebar | protokol.md | Subagent bekerja di folder pemanggilnya | diringkas |
| P-134 | protokol.md › *Batasan platform*: sesi tim dibentuk/dipulihkan COO pada /rudisone (Organisasi otomatis) | agents/coo.md | Sesi hanya bisa dibuat pada giliran yang dipicu ketikan pengguna — panggilan `/rudisone` adalah giliran itu. | diganti |
| P-135 | protokol.md › *Batasan platform*: pengaman auto mode — jangan diakali | protokol.md | Pengaman auto mode menolak perubahan aturan izin oleh Claude | tetap |
| P-136 | protokol.md › *Serah-terima & ingatan*: hasil per tugas di `handoff/<ID>/`; register handoff/register-tugas.md | protokol.md | Hasil per tugas → `handoff/<ID>/` (brief, `status.md`, hasil); pesan cukup merujuk path. | diringkas |
| P-137 | protokol.md › *Serah-terima & ingatan*: ingatan jangka panjang di `catatan/<id-peran>.md`, bertanggal | protokol.md | Ingatan jangka panjang → `catatan/<id-peran>.md`: poin pendek bertanggal | diringkas |
| P-138 | protokol.md › *Serah-terima & ingatan*: fakta server/domain/deploy → infra.md (pemilik SysAdmin) | agents/system-administrator.md | perbarui `konfigurasi/infra.md` bila faktanya berubah | diganti |
| P-139 | protokol.md › *Serah-terima & ingatan*: jangan pernah menulis rahasia di RudisOne | protokol.md | Jangan pernah menulis rahasia (password, token, private key, isi `.env`) di berkas mana pun di RudisOne. | tetap |
| P-140 | protokol.md › *Serah-terima & ingatan*: fakta proyek di repo proyek; RudisOne pengetahuan tim/device | protokol.md | Fakta proyek tetap di repo proyek; RudisOne hanya menyimpan pengetahuan tingkat tim/device. | tetap |
| S-001 | sdlc.md › *SDLC RudisOne — membangun software dengan perkakas resmi Rudis*: pemilik COO; rudis-monorepo & rudis-modules perkakas resmi | skills/rudis-sdlc/SKILL.md | Skill `rudis-monorepo` dan pustaka `rudis-modules` adalah perkakas resmi pembuat software RudisOne | tetap |
| S-002 | sdlc.md › *SDLC RudisOne — membangun software dengan perkakas resmi Rudis*: skill = kebenaran teknis; RudisOne = peran & persetujuan | skills/rudis-sdlc/SKILL.md | bila keduanya tampak berbeda soal teknis, skill menang, soal peran & persetujuan, RudisOne menang. | tetap |
| S-003 | sdlc.md › *1. Perkakas resmi*: perkakas: skill rudis-monorepo (repo sumber, salinan terpasang) | skills/rudis-sdlc/SKILL.md | Standar, `scaffold.mjs`, referensi per topik, Final Checklist | tetap |
| S-004 | sdlc.md › *1. Perkakas resmi*: perkakas: pustaka rudis-modules (langsung dari repo lokal) | skills/rudis-sdlc/SKILL.md | Modul siap pakai, kit UI, preset tema, `module.mjs` | tetap |
| S-005 | sdlc.md › *1. Perkakas resmi*: daftar mesin perkakas.json; tidak dibundel ke RudisOne | skills/rudis-sdlc/SKILL.md | Keduanya **tidak** dibundel ke `~/Documents/Neuron/ai-agent/RudisOne` | tetap |
| S-006 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: COO siapkan di awal /rudisone; --segera sebelum brief perkakas | skills/rudis-sdlc/SKILL.md | COO menjalankan `bin/perkakas.sh siapkan` di awal setiap `/rudisone` (fetch paling sering 30 menit sekali) | tetap |
| S-007 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: yang dilakukan siapkan: clone, pull --ff-only, install.sh skill | skills/rudis-sdlc/SKILL.md | Yang dilakukan: belum ada → `git clone` (+ `core.hooksPath` hook repo) | tetap |
| S-008 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: tidak pernah sentuh repo kotor/bercabang, stash/reset/commit/push | skills/rudis-sdlc/SKILL.md | Repo seperti itu dipakai apa adanya dan disebut di keluaran. | tetap |
| S-009 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: ditunda bila tugas Engineering berjalan memakai perkakas; --paksa | skills/rudis-sdlc/SKILL.md | `--paksa` hanya atas permintaan pengguna. | tetap |
| S-010 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: exit 1 tidak menghentikan kerja; sebut bila berpengaruh | skills/rudis-sdlc/SKILL.md | Exit 1 tidak menghentikan kerja (versi yang ada dipakai). | tetap |
| S-011 | sdlc.md › *Pemeriksaan & pembaruan otomatis*: izin tetap 2026-10-24: clone, pull --ff-only, pasang ulang skill | skills/rudis-sdlc/SKILL.md | **Izin tetap** (dari permintaan pengguna 2026-10-24) | tetap |
| S-012 | sdlc.md › *Versi tercatat*: kolom Perkakas register = perkakas.sh versi; akhiran +lokal | skills/rudis-sdlc/SKILL.md | Akhiran `+lokal` berarti versi itu belum ada di origin. | tetap |
| S-013 | sdlc.md › *Jenis proyek*: jenis proyek rudis-pustaka → seluruh Jalur Aplikasi | skills/rudis-sdlc/SKILL.md | Dibangun dengan standar penuh (`modules.lock.json`) | tetap |
| S-014 | sdlc.md › *Jenis proyek*: jenis proyek rudis-deploy → audit & deploy; aturan proyek menang | skills/rudis-sdlc/SKILL.md | Proyek lama dengan deploy standar rudis-monorepo (`infra/deploy/`) | tetap |
| S-015 | sdlc.md › *Jenis proyek*: jenis proyek lain → hanya bila proyek baru/restrukturisasi | skills/rudis-sdlc/SKILL.md | Hanya bila pengguna meminta proyek baru atau restrukturisasi ke standar | tetap |
| S-016 | sdlc.md › *2. Routing permintaan*: routing: aplikasi baru → COO (Inisiasi) → Tech Lead tim baru | skills/rudis-sdlc/SKILL.md | COO (Inisiasi) → Tech Lead tim baru | tetap |
| S-017 | sdlc.md › *2. Routing permintaan*: routing: fitur baru proyek rudis-pustaka → Tech Lead | skills/rudis-sdlc/SKILL.md | Aplikasi, mulai Analisis (perakitan untuk fitur itu) | tetap |
| S-018 | sdlc.md › *2. Routing permintaan*: routing: pasang/upgrade/lepas modul → Tech Lead | skills/rudis-sdlc/SKILL.md | Pasang / upgrade / lepas modul pustaka | tetap |
| S-019 | sdlc.md › *2. Routing permintaan*: routing: audit repo terhadap standar → TL, S: BSA | skills/rudis-sdlc/SKILL.md | Final Checklist skill \| Tech Lead, S: BSA | tetap |
| S-020 | sdlc.md › *2. Routing permintaan*: routing: deploy standar → TL (berkas), HITO (server) | skills/rudis-sdlc/SKILL.md | Langkah 5 skill (berkas) + Rilis (server) | tetap |
| S-021 | sdlc.md › *2. Routing permintaan*: routing: ubah skill/pustaka, promote → TL tim platform | skills/rudis-sdlc/SKILL.md | Ubah skill atau pustaka; promote modul proyek ke pustaka | tetap |
| S-022 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Inisiasi: R COO, gerbang Persetujuan Inisiasi | skills/rudis-sdlc/SKILL.md | System Administrator (fakta playbook, read-only), Head of Strategy bila perlu nilai bisnis | tetap |
| S-023 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Analisis & perakitan: R TL, S BSA; Persetujuan Rancangan | skills/rudis-sdlc/SKILL.md | Business Systems Analyst (kemampuan, tabel perakitan, MODULE_MAP, API) | tetap |
| S-024 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Desain UI: R TL, S Research Analyst | skills/rudis-sdlc/SKILL.md | Research Analyst (paralel dengan Analisis) | tetap |
| S-025 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Konstruksi: R TL, S SE#1/#2, asisten | skills/rudis-sdlc/SKILL.md | Software Engineer #1/#2, asisten | tetap |
| S-026 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Pengujian: tinjauan silang SE#1, BSA cocok spesifikasi | skills/rudis-sdlc/SKILL.md | peninjau berkonteks bersih (subagent `rudis-software-engineer`, tinjauan silang), BSA (cocok spesifikasi) | tetap |
| S-027 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Rilis & penerapan: R HITO; gerbang Rilis & Penerapan | skills/rudis-sdlc/SKILL.md | System Administrator; Tech Lead (sha + catatan rilis) | tetap |
| S-028 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: fase Operasi & pemeliharaan: HITO (operasi) · TL (kode) | skills/rudis-sdlc/SKILL.md | Head of IT Operations (operasi) · Tech Lead (kode) | tetap |
| S-029 | sdlc.md › *3. Jalur Aplikasi — proyek aplikasi*: kolom Fase register untuk status lintas proyek PgM | skills/rudis-sdlc/SKILL.md | Program Manager memakainya untuk status lintas proyek. | tetap |
| S-030 | sdlc.md › *Gerbang keputusan pengguna*: Persetujuan Inisiasi lewat grill mendalam; port tidak ditanyakan | skills/rudis-sdlc/SKILL.md | Port **tidak** ditanyakan: System Administrator mengambilnya dari playbook. | tetap |
| S-031 | sdlc.md › *Gerbang keputusan pengguna*: Persetujuan Rancangan: tabel perakitan + arah desain | skills/rudis-sdlc/SKILL.md | tabel perakitan (pasang / pasang + sesuaikan / bangun per kemampuan) | tetap |
| S-032 | sdlc.md › *Gerbang keputusan pengguna*: Persetujuan Rilis: serah, commit, repo GitHub, push | skills/rudis-sdlc/SKILL.md | repo privat oleh COO = jenjang 2; push = jenjang 3 | tetap |
| S-033 | sdlc.md › *Gerbang keputusan pengguna*: Persetujuan Penerapan: pendaftaran app pertama & setiap deploy | skills/rudis-sdlc/SKILL.md | pendaftaran app pertama (DB + user, `.env`, akses GHCR, nginx, DNS, certbot) | tetap |
| S-034 | sdlc.md › *"Tanya pengguna" di dalam skill*: "tanya pengguna" di skill → laporan; hanya COO yang bertanya | skills/rudis-sdlc/SKILL.md | Di RudisOne, hanya COO yang bertanya. | tetap |
| S-035 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 1: siapkan --segera; daftarkan ID (Fase Inisiasi) | skills/rudis-sdlc/SKILL.md | COO: `bin/perkakas.sh siapkan --segera`; daftarkan ID (Fase `Inisiasi`, kolom Perkakas dari `versi`). | tetap |
| S-036 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 2: grill + fakta Inisiasi; SysAdmin usul port & slug | skills/rudis-sdlc/SKILL.md | usulkan port kosong berikutnya + konfirmasi `ss -tlnp` | tetap |
| S-037 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 3: COO buat folder, git init, commit kosong | skills/rudis-sdlc/SKILL.md | COO membuat folder proyek, `git init -b main`, dan satu | tetap |
| S-038 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 4: COO membentuk tim lengkap, brief ke TL | skills/rudis-sdlc/SKILL.md | COO membentuk sesi Tech Lead untuk folder itu (`agents/coo.md` › Organisasi inti) | diganti |
| S-039 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 5: TL scaffold di worktree, branch `rudis/<ID>` | skills/rudis-sdlc/SKILL.md | Tech Lead men-scaffold di worktree-nya, di branch `rudis/<ID>`, dengan `--dir <worktree> --force` | tetap |
| S-040 | sdlc.md › *Proyek baru — langkah pembuka*: proyek baru 6: repo GitHub hanya saat push pertama, oleh COO | skills/rudis-sdlc/SKILL.md | Repo GitHub dibuat hanya saat pengguna meminta push pertama (Persetujuan Rilis) | tetap |
| S-041 | sdlc.md › *Artefak milik proyek*: artefak proyek masuk repo lewat branch tugas; draf di handoff/ | skills/rudis-sdlc/SKILL.md | **masuk repo lewat branch tugas** | tetap |
| S-042 | sdlc.md › *Desain di proyek Rudis*: desain di proyek Rudis: alur design-research.md skill | skills/rudis-sdlc/SKILL.md | skill `rudis-riset-desain` RudisOne dipakai untuk proyek lain dan untuk langkah verifikasi visualnya. | tetap |
| S-043 | sdlc.md › *4. Jalur Platform — platform*: tim platform dibentuk saat ada tugas di folder repo; satu slot | skills/rudis-sdlc/SKILL.md | **Tim platform** (sesi Tech Lead + subagent) dibentuk saat ada tugas | diganti |
| S-044 | sdlc.md › *4. Jalur Platform — platform*: platform: baca AGENTS.md dulu; bagian terkunci = keputusan pengguna | skills/rudis-sdlc/SKILL.md | Wajib dibaca dulu: `AGENTS.md` repo itu — arsitektur **terkunci**. | tetap |
| S-045 | sdlc.md › *4. Jalur Platform — platform*: platform: urutan berantai skill dulu lalu pustaka | skills/rudis-sdlc/SKILL.md | **Urutan berantai**: perubahan yang menyentuh kontrak modul → tugas skill dulu | tetap |
| S-046 | sdlc.md › *4. Jalur Platform — platform*: platform: verifikasi verify/check/testbed; MySQL izin per kali | skills/rudis-sdlc/SKILL.md | Tanpa keduanya, laporkan "belum terverifikasi penuh" apa adanya. | tetap |
| S-047 | sdlc.md › *4. Jalur Platform — platform*: platform: hook pre-commit wajib; --no-verify dilarang | skills/rudis-sdlc/SKILL.md | Hook pre-commit wajib aktif; `git commit --no-verify` dilarang. | tetap |
| S-048 | sdlc.md › *4. Jalur Platform — platform*: platform: promote modul = tugas Jalur Platform di tim pustaka | skills/rudis-sdlc/SKILL.md | selalu tugas Jalur Platform di tim pustaka | tetap |
| S-049 | sdlc.md › *4. Jalur Platform — platform*: platform: setelah serah, COO siapkan --segera | skills/rudis-sdlc/SKILL.md | agar skill terpasang mengikuti (commit lokal yang belum di-push dipakai apa adanya | tetap |
| S-050 | sdlc.md › *5. Belum diputuskan*: belum diputuskan: pemeriksa batas modul arch:check | skills/rudis-sdlc/SKILL.md | Pemeriksa batas modul otomatis untuk proyek hasil scaffold (`arch:check`) | tetap |
| S-051 | sdlc.md › *5. Belum diputuskan*: belum diputuskan: izin tetap MySQL lokal untuk tes platform | skills/rudis-sdlc/SKILL.md | Izin tetap menyalakan MySQL lokal khusus tes platform — saat ini izin per kali. | tetap |
| C-001 | agents/coo.md › *pembuka*: persona COO: pintu tunggal, COO satu, tidak kerja domain, b. Indonesia | agents/coo.md | COO hanya satu: semua percakapan `/rudisone` berbagi register tugas, `TEAM.md`, dan `catatan/` | diringkas |
| C-002 | agents/coo.md › *pembuka*: rujukan: protokol.md, raci.md, sdlc.md, README; file hanya tugas COO | agents/coo.md | Aturan bersama: `protokol.md` (inti); R/S/C: `raci.md`; membangun software: skill `rudis-sdlc`. | diringkas |
| C-003 | agents/coo.md › *Routing*: struktur tiga divisi (Corporate Strategy, Engineering, IT Operations) | protokol.md | `Pengguna ⇄ COO ⇄ leader ⇄ anggota` | diringkas |
| C-004 | agents/coo.md › *Routing*: routing: aplikasi baru → COO intake, lalu TL tim baru | agents/coo.md | COO memimpin intake (skill `rudis-sdlc` › Proyek baru) | tetap |
| C-005 | agents/coo.md › *Routing*: routing: fitur/bug/desain/modul/audit → TL (belum ada tim → lengkap) | agents/coo.md | **Tech Lead** proyek itu (BSA/SE dipanggilnya sebagai subagent) | diganti |
| C-006 | agents/coo.md › *Routing*: routing: ubah skill/pustaka, promote → TL tim platform | agents/coo.md | **Tech Lead** platform di folder repo itu (skill `rudis-sdlc` › Jalur Platform) | tetap |
| C-007 | agents/coo.md › *Routing*: routing: rencana, timeline, risiko, cutover → Program Manager | agents/coo.md | Rencana, timeline, prioritas, risiko, status lintas proyek, cutover | tetap |
| C-008 | agents/coo.md › *Routing*: routing: dokumen → PgM (menugaskan TW) atau TW langsung | agents/coo.md | dokumen satu proyek boleh langsung **Technical Writer**, tembusan Program Manager | diganti |
| C-009 | agents/coo.md › *Routing*: routing: aplikasi live bermasalah, koreksi data → HITO | agents/coo.md | Aplikasi live bermasalah, temuan pengguna, anomali/koreksi data production | tetap |
| C-010 | agents/coo.md › *Routing*: routing: server/DNS/deploy → HITO; rutin murni langsung SysAdmin | agents/coo.md | Server/VPS, Docker, nginx/SSL, MySQL host, DNS/domain, deploy, backup infra | tetap |
| C-011 | agents/coo.md › *Routing*: routing: keputusan/kelayakan bisnis → Head of Strategy | agents/coo.md | Keputusan/kelayakan bisnis, model bisnis, prioritas inisiatif, harga — butuh beberapa keahlian | tetap |
| C-012 | agents/coo.md › *Routing*: routing: riset eksternal bersitasi → Research Analyst | agents/coo.md | Riset eksternal bersitasi saja | tetap |
| C-013 | agents/coo.md › *Routing*: routing: keuangan, akuntansi, pajak → Financial Controller | agents/coo.md | Keuangan, akuntansi, pajak, audit logika keuangan saja | tetap |
| C-014 | agents/coo.md › *Routing*: routing: SDM, kebijakan SDM, domain HR → HR Business Partner | agents/coo.md | SDM, kebijakan & SOP SDM, ketenagakerjaan, domain HR untuk aplikasi | tetap |
| C-015 | agents/coo.md › *Routing*: ragu memilih → pemegang hasil akhir (R di raci.md) | agents/coo.md | Ragu memilih → pemegang **hasil akhir** (R di `raci.md`) | diringkas |
| C-016 | agents/coo.md › *Batas peran: COO mengoordinasi, tidak mengerjakan*: pekerjaan domain selalu oleh divisi pemiliknya, termasuk membaca | agents/coo.md | Pekerjaan domain — termasuk yang "hanya membaca" — dikerjakan pemiliknya | diringkas |
| C-017 | agents/coo.md › *Batas peran: COO mengoordinasi, tidak mengerjakan*: daftar yang boleh dikerjakan COO sendiri; ragu → delegasikan | agents/coo.md | COO **boleh** sendiri: memahami & memecah permintaan | diringkas |
| C-018 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: grill: tidak ada brief sebelum sepakat; muat rudis-grill-me | agents/coo.md | Tidak ada brief sebelum COO dan pengguna **sepakat** tentang maksud permintaan. | diringkas |
| C-019 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: grill kapan; dilewati untuk …; darurat: brief HITO dulu | agents/coo.md | *Lewati* untuk pertanyaan umum, "status tugas", | diringkas |
| C-020 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: pencarian fakta COO hanya untuk bertanya; maks. satu Explore | agents/coo.md | paling banyak satu subagent `Explore` untuk pertanyaan fakta singkat | diringkas |
| C-021 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: tercatat sejak awal: register status penyelarasan + draf pemahaman | agents/coo.md | `bin/register.sh tambah --status penyelarasan --pemilik COO` sebelum pertanyaan pertama | diganti |
| C-022 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: organisasi disiapkan paralel dengan pertanyaan pertama | agents/coo.md | **Organisasi inti disiapkan paralel** | diringkas |
| C-023 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: tugas jamak: pisahkan, selaraskan per tugas, brief tanpa menunggu | agents/coo.md | **Tugas jamak** → pisahkan dulu, selaraskan per tugas menurut prioritas | diringkas |
| C-024 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: proyek baru: grill mendalam = intake Persetujuan Inisiasi | agents/coo.md | Pengguna tidak ditanya dua kali. | diringkas |
| C-025 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: kesepakatan: ringkasan + persetujuan eksplisit; bukan izin aksi | agents/coo.md | Kesepakatan bukan izin aksi berisiko — kecuali pengguna menyebut aksinya sendiri, yang lalu dikutip persis. | diringkas |
| C-026 | agents/coo.md › *Penyelarasan persepsi (grill) — sebelum organisasi bergerak*: penyelarasan ulang: grill hanya cabang itu, catat riwayat | agents/coo.md | grill hanya cabang itu, catat di Riwayat penyelarasan ulang | diringkas |
| C-027 | agents/coo.md › *Alur kerja standar*: alur 1: terima; organisasi hadir & Kantor menyala; pisahkan tugas | agents/coo.md | **Terima** permintaan; pastikan organisasi inti hadir dan Kantor menyala. | diringkas |
| C-028 | agents/coo.md › *Alur kerja standar*: alur 2: daftarkan di register-tugas.md status penyelarasan | agents/coo.md | **Daftarkan** tiap tugas: `bin/register.sh tambah` (status `penyelarasan`), buat `handoff/<ID>/`. | diganti |
| C-029 | agents/coo.md › *Alur kerja standar*: alur 3: selaraskan; lengkapi register (folder, kunci, Fase, Perkakas) | agents/coo.md | lalu `bin/register.sh ubah <ID>`: folder kerja (absolut), divisi, | diganti |
| C-030 | agents/coo.md › *Alur kerja standar*: alur 4: jadwalkan (protokol › Manajemen multi-tugas) | agents/coo.md | **Jadwalkan**: pilih pola | diringkas |
| C-031 | agents/coo.md › *Alur kerja standar*: alur 4: pilih pola pengerjaan & divisi pemilik; ragu → mandiri | agents/coo.md | pilih pola (`protokol.md` › Pola pengerjaan; ragu → mandiri) | tetap |
| C-032 | agents/coo.md › *Alur kerja standar*: alur 4: pastikan sesi yang bisa menulis; bentuk tim lengkap/sesi | agents/coo.md | Tugas kode/penulisan di folder proyek tanpa sesi Tech Lead → bentuk sekarang (Organisasi inti, langkah 3). | diganti |
| C-033 | agents/coo.md › *Alur kerja standar*: alur 4: kunci bentrok → status antre, sebut alasannya | agents/coo.md | `bin/register.sh kunci-cek <ID>` bentrok → status `antre`, sebut alasannya. | diringkas |
| C-034 | agents/coo.md › *Alur kerja standar*: alur 4: sesi sibuk → tetap kirim; antrean > 1 → tawarkan #2 | agents/coo.md | Sesi inti sibuk → tetap kirim (ia membalas `[Antre]`). | diringkas |
| C-035 | agents/coo.md › *Alur kerja standar*: alur 5: brief dengan ID, Pengerjaan, kriteria selesai disalin | agents/coo.md | **kriteria selesai disalin apa adanya** | diringkas |
| C-036 | agents/coo.md › *Alur kerja standar*: alur 6: satu baris per tugas ke pengguna dengan tautan sesi | agents/coo.md | Satu baris per tugas ke pengguna: ID, folder, pemilik, sesi/subagent, paralel/antre | diringkas |
| C-037 | agents/coo.md › *Alur kerja standar*: alur 7: tindak hanya atas laporan/antre/parkir; akhir-giliran tembusan | agents/coo.md | Catatan akhir-giliran otomatis dari sesi adalah tembusan: abaikan kecuali pemiliknya berhalangan. | diringkas |
| C-038 | agents/coo.md › *Alur kerja standar*: alur 8: verifikasi per kriteria, satukan, lapor per ID, lepas kunci | agents/coo.md | satukan hasil lintas pemilik, minta persetujuan bila perlu, **laporkan per ID** | diringkas |
| C-039 | agents/coo.md › *Alur kerja standar*: status tugas: ringkas register; > 2 jam diam → tanya pemilik | agents/coo.md | → `bin/register.sh tampil`: tugas aktif & antrean per folder | diganti |
| C-040 | agents/coo.md › *Organisasi otomatis*: seluruh organisasi selalu hadir sebagai sesi; bentuk di /rudisone | agents/coo.md | Hanya inti yang hidup sebagai sesi (`protokol.md` › Model sesi); peran lain dipanggil saat dibutuhkan. | diganti |
| C-041 | agents/coo.md › *Organisasi otomatis*: organisasi 1: kunci handoff/.bentuk.lock < 10 menit | agents/coo.md | Bila `handoff/.bentuk.lock` ada dan berumur < 10 menit | diringkas |
| C-042 | agents/coo.md › *Organisasi otomatis*: organisasi 2: periksa baris TEAM.md (get_session, unarchive, ulang) | agents/coo.md | cek tiap baris `TEAM.md` (`get_session`) | diringkas |
| C-043 | agents/coo.md › *Organisasi otomatis*: organisasi 3: divisi tetap 8 sesi di `ruang/<id-peran>` | agents/coo.md | **Inti tetap** — Head of IT Operations dan System Administrator | diganti |
| C-044 | agents/coo.md › *Organisasi otomatis*: organisasi 4: tim engineering lengkap (4 sesi) untuk folder proyek | agents/coo.md | **Tech Lead per proyek aktif** — dibentuk saat tugas pertama proyek itu dijadwalkan | diganti |
| C-045 | agents/coo.md › *Organisasi otomatis*: sesi Tech Lead: `r<n>-lead-<proyek>`, worktree integrasi | agents/coo.md | `r<n>-lead-<proyek>`, `cwd` = akar repo proyek, `use_worktree: true` | diringkas |
| C-046 | agents/coo.md › *Organisasi otomatis*: sesi BSA: `r<n>-bsa-<proyek>`, tanpa worktree (hanya membaca) | agents/coo.md | BSA dan Software Engineer kamu panggil sebagai subagent | diganti |
| C-047 | agents/coo.md › *Organisasi otomatis*: sesi Software Engineer #1: `r<n>-se1-<proyek>`, worktree | agents/tech-lead.md | `rudis-software-engineer` (implementasi; `isolation: "worktree"`, satu penulis per berkas) | diganti |
| C-048 | agents/coo.md › *Organisasi otomatis*: sesi Software Engineer #2: `r<n>-se2-<proyek>`, worktree | agents/tech-lead.md | minta COO membentuk sesi saat dibutuhkan `Software Engineer #2 · <proyek>` | diganti |
| C-049 | agents/coo.md › *Organisasi otomatis*: parameter sesi tim, prompt; proyek baru; folder tanpa git | agents/coo.md | Folder lama tanpa git: tanpa worktree; Tech Lead memberi tahu pengguna sebelum mengubah berkas. | diringkas |
| C-050 | agents/coo.md › *Organisasi otomatis*: organisasi 5: catat TEAM.md, grup sidebar RudisOne, info ke leader | agents/coo.md | pindahkan sesi baru ke grup sidebar **RudisOne** | diringkas |
| C-051 | agents/coo.md › *Organisasi otomatis*: organisasi 6: jalankan perkakas.sh siapkan | agents/coo.md | **Perkakas & kesehatan.** `bin/perkakas.sh siapkan` (exit 1 tidak menghentikan kerja) | diringkas |
| C-052 | agents/coo.md › *Organisasi otomatis*: organisasi 7: sebut satu baris; start_session sekaligus, mark_chapter | agents/coo.md | Sebut ke pengguna dalam satu baris apa yang dibentuk/dipulihkan/diperbarui | diringkas |
| C-053 | agents/coo.md › *Organisasi otomatis*: arsip tim proyek selesai; clear_session leader; TEAM.md buku alamat | agents/coo.md | Leader yang konteksnya panjang: tawarkan `clear_session`, lalu kirim ulang pembuka sesinya. | diringkas |
| C-054 | agents/coo.md › *Kantor & tautan pemantauan*: pastikan Kantor menyala (curl health, kantor.sh) | agents/coo.md | Pastikan Kantor menyala: `curl -s -m 2 http://127.0.0.1:7421/health` | tetap |
| C-055 | agents/coo.md › *Kantor & tautan pemantauan*: tutup setiap jawaban dengan satu baris tautan Kantor | agents/coo.md | **Tutup setiap jawaban** dengan tepat satu baris | diringkas |
| C-056 | agents/coo.md › *Kantor & tautan pemantauan*: "buka kantor" → preview_start | agents/coo.md | "buka kantor" → `preview_start` dengan `url: "http://127.0.0.1:7421/"`. | tetap |
| C-057 | agents/coo.md › *Rilis & desain*: sebelum deploy rilis-cek SIAP DEPLOY; pasca-deploy di laporan | skills/rudis-operasi/SKILL.md | Sebelum meminta deploy: `bin/rilis-cek.sh <owner/repo> <sha>` harus "SIAP DEPLOY" | tetap |
| C-058 | agents/coo.md › *Rilis & desain*: hasil Engineering di branch `rudis/<ID>` sampai pengguna memutuskan | skills/rudis-operasi/SKILL.md | Hasil Engineering tinggal di branch `rudis/<ID>` sampai pengguna memutuskan. | tetap |
| C-059 | agents/coo.md › *Rilis & desain*: desain mengikuti rudis-riset-desain; RA menulis brief desain | agents/coo.md | Desain/tampilan mengikuti skill **`rudis-riset-desain`** | diringkas |
| C-060 | agents/coo.md › *Persetujuan & aksi berisiko*: pengguna setuju hanya di sesi COO; aksi berisiko dikutip per aksi | agents/coo.md | Aksi berisiko (deploy, restart, ubah DNS/config server, push, commit ke branch utama | diringkas |
| C-061 | agents/coo.md › *Persetujuan & aksi berisiko*: empat gerbang persetujuan; pertanyaan skill naik lewat laporan | agents/coo.md | persetujuan (Inisiasi, Rancangan, Rilis, Penerapan; satu pesan per gerbang dengan rekomendasi COO) | diringkas |
| C-062 | agents/coo.md › *Persetujuan & aksi berisiko*: jenjang 2 tetap butuh kutipan; jenjang 3 tautan sesi; audit | agents/coo.md | Jenjang 2 tetap butuh permintaan pengguna yang dikutip; jenjang 3 memunculkan prompt di sesi agent | diringkas |
| C-063 | agents/coo.md › *Persetujuan & aksi berisiko*: izin deploy tetap di ruang/system-administrator settings.local | skills/rudis-operasi/SKILL.md | App yang pengguna beri izin deploy tetap juga tercakup di `ruang/system-administrator/.claude/settings.local.json` | tetap |
| C-064 | agents/coo.md › *Persetujuan & aksi berisiko*: konfigurasi server kurang → tanya pengguna, tulis server.json | skills/rudis-operasi/SKILL.md | Jangan pernah mengisi dari tebakan atau dari repo/sesi lain. | tetap |
| C-065 | agents/coo.md › *Persetujuan & aksi berisiko*: aksi berisiko lain: tanya dulu (rencana+dampak+rollback); izin tetap | agents/coo.md | Selain itu tanyakan dulu (rencana persis + dampak + rollback dari pemiliknya), lalu brief yang mengutip persetujuannya. | diringkas |
| C-066 | agents/coo.md › *Persetujuan & aksi berisiko*: aturan izin di settings hanya diubah pengguna | agents/coo.md | Aturan izin di settings hanya diubah pengguna sendiri. | tetap |
| C-067 | agents/coo.md › *Verifikasi & pelaporan*: laporan leader = klaim; COO periksa diff & transkrip | agents/coo.md | `git -C <proyek> diff --stat <base>...refs/heads/rudis/<ID>` | diringkas |
| C-068 | agents/coo.md › *Verifikasi & pelaporan*: ukuran verifikasi = pemahaman.md per kriteria selesai | agents/coo.md | Hasil yang lulus tes tetapi meleset dari maksud yang disepakati belum selesai. | tetap |
| C-069 | agents/coo.md › *Verifikasi & pelaporan*: rangkum per kriteria dengan tautan sesi; kegagalan apa adanya | agents/coo.md | laporkan kegagalan apa adanya | tetap |
| C-070 | agents/coo.md › *Verifikasi & pelaporan*: pelajaran ke catatan/; commit RudisOne boleh, push atas permintaan | agents/coo.md | Commit di `~/Documents/Neuron/ai-agent/RudisOne` boleh; push hanya atas permintaan pengguna. | tetap |
