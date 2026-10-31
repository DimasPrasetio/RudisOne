# Pemetaan aturan v5 (d991509) → v6 (T-20261031-2.3)

Tujuan: membuktikan bahwa **setiap** unit aturan di `protokol.md`, `agents/*.md`, dan `skills/*/SKILL.md` pada ref lama
punya tempat sekarang — di prosa (berkas instruksi) atau di **mekanisme bertes** (hook/skrip) — tanpa satu pun hilang.

Ref: `d991509`

Cara cek (dijalankan otomatis oleh `node bin/cek-konsistensi.mjs --repo`): inventaris unit ref lama
(`node bin/inventaris-aturan.mjs --ref d991509 --sumber v6 --json`: P = `protokol.md`, C = `agents/coo.md`,
A-&lt;id&gt; = `agents/<id>.md`, K-&lt;skill&gt; = `skills/<skill>/SKILL.md`) dibandingkan dengan HEAD:
- teks unit (spasi dinormalkan) masih ada persis di berkas yang sama → **tetap** (otomatis, tanpa baris);
- ada persis di berkas instruksi lain (`agents/`, `skills/**`, `templat/`, `protokol.md`, `raci.md`, `infra.md`,
  `penyedia.md`, `README.md`) → **pindah** (otomatis, tanpa baris) — mis. tabel format pesan ke `rudis-multitugas`,
  pembuka peran ke `agents/coo.md`, tabel jenjang ke `rudis-operasi`, batasan platform sesi ke `rudis-perkakas`,
  backend sesi ke `skills/rudisone/backend-cli.md`, uji penolakan ke `agents/software-engineer.md`;
- selain itu **wajib** satu baris di tabel ini: **Jangkar** ada persis di **Lokasi baru**; status `mekanisme` = Lokasi
  baru berkas tes dan Jangkar judul tes persis (pemeriksa memastikan `test("<jangkar>"` ada); `dihapus` + alasan.
  Kode `N-nnn` = mekanisme/aturan baru tanpa padanan unit lama (jangkarnya tetap diperiksa).

Hasil terakhir: `pemetaan-v6: d991509: 695 unit · tetap 658 · pindah 21 · di tabel 16 · hilang 0` (keluaran info pemeriksa).

Status: `diringkas` (makna sama, lebih ringkas) · `diganti` (sengaja diubah oleh keputusan pengguna/riset T-20261031-2,
jangkar menunjuk aturan pengganti) · `mekanisme` (larangan dipindah ke hook/skrip bertes) · `dihapus` (dengan alasan).

| Kode | Aturan lama | Lokasi baru | Jangkar | Status |
|---|---|---|---|---|
| P-037 | protokol.md › *Model sesi*: Tech Lead sebagai subagent — mandiri, tinjauan silang oleh COO | protokol.md | ia tetap memanggil BSA/SE/peninjau sendiri; laporannya lolos gerbang mesin `bin/gerbang-tl.sh` | diganti |
| P-074 | protokol.md › *Ruang kerja Engineering*: tidak ada stash/reset --hard/checkout --/hapus worktree/branch tanpa permintaan | bin/kebijakan-env.test.mjs | A6: git yang menimpa/menghapus kerja di sesi RudisOne → ask; git baca & kerja biasa tanpa keputusan | mekanisme |
| P-093 | protokol.md › *Akses*: aturan izin & settings hanya diubah pengguna; hook dipasang pemilik | protokol.md | Aturan izin & settings Claude Code hanya diubah pengguna sendiri atau `install.sh` yang ia jalankan | diganti |
| C-043 | agents/coo.md › *Tech Lead sebagai subagent*: kapan ditawarkan + konsekuensi (TL tanpa alat Agent, berurutan) | agents/coo.md | Kualitas kerja tetap: Tech Lead-subagent memanggil BSA, SE, dan peninjau sendiri | diganti |
| C-045 | agents/coo.md › *Tech Lead sebagai subagent*: panggilan rudis-tech-lead satu bagian per panggilan, lanjut via SendMessage | agents/coo.md | Lanjutan → `SendMessage` ke subagent yang sama selama konteksnya < ±150 rb token | diringkas |
| C-046 | agents/coo.md › *Tech Lead sebagai subagent*: riset desain & analisis BSA dipanggil COO sebelum TL | agents/tech-lead.md | **Tim tetap**: BSA, peninjau, dan Research Analyst kamu panggil sebagai subagent seperti biasa | diganti |
| C-047 | agents/coo.md › *Tech Lead sebagai subagent*: tinjauan silang = langkah tetap COO | agents/coo.md | COO **selalu** menjalankan `bin/gerbang-tl.sh <ID> --transkrip <transkrip subagent>` sebelum melapor ke pengguna | diganti |
| C-055 | agents/coo.md › *Persetujuan*: izin tetap database lokal; login lokal admin@gmail.com | agents/coo.md | Login lokal (email `admin@example.com`, sandi `admin123`) hanya lokal | diganti |
| A-tech-lead-007 | agents/tech-lead.md › *Bila subagent*: pengerjaan mandiri, tanpa alat Agent | agents/tech-lead.md | SE yang menulis **tanpa** `isolation` | diganti |
| A-tech-lead-008 | agents/tech-lead.md › *Bila subagent*: satu bagian per panggilan + status.md | agents/tech-lead.md | (`templat/status-tugas.md`: `Repo:`, `Base:`, selesai, sisa, langkah berikutnya) | diringkas |
| A-tech-lead-009 | agents/tech-lead.md › *Bila subagent*: tinjauan silang diminta ke COO | agents/tech-lead.md | hook `SubagentStop` menahan laporan akhir yang belum lulus dan menyebut butir yang kurang | diganti |
| A-tech-lead-019 | agents/tech-lead.md › *Proyek Rudis*: .env & database lokal; login admin@gmail.com; cek kunci DB dengan grep -c | agents/tech-lead.md | `~/Documents/Neuron/ai-agent/RudisOne/bin/env-kunci.sh --salah-satu DB_DSN,DATABASE_URL` → exit 3 | diganti |
| K-rudis-sdlc-046 | skills/rudis-sdlc › *.env & database lokal*: .env non-DB; login lokal admin@gmail.com | skills/rudis-sdlc/SKILL.md | email `admin@example.com`, sandi `admin123`, nama `admin` | diganti |
| K-rudis-sdlc-047 | skills/rudis-sdlc › *.env & database lokal*: database bila kunci DB kosong (grep -c) | skills/rudis-sdlc/SKILL.md | DB_DSN,DATABASE_URL` exit 3 (tanpa membaca `.env`); exit 0 → lewati. | diganti |
| K-rudis-operasi-019 | skills/rudis-operasi › *Mengubah kebijakan*: hook dipasang/dilepas pemilik dengan kebijakan.sh | skills/rudis-operasi/SKILL.md | Hook & aturan deny `.env` dipasang/diperbarui otomatis oleh `install.sh` yang dijalankan pemilik | diganti |
| K-rudis-operasi-022 | skills/rudis-operasi › *Berkas terlindung*: setelah memperbarui hook pemilik menjalankan pasang lagi | skills/rudis-operasi/SKILL.md | Setelah memperbarui RudisOne, pemilik menjalankan `install.sh` lagi | diganti |
| N-001 | (baru) agent tidak membaca isi `.env*` — deny tanpa prompt + audit | bin/kebijakan-env.test.mjs | Bash: pengeluar isi → deny | mekanisme |
| N-002 | (baru) kapabilitas aplikasi/tes/skrip yang memuat `.env` sendiri tetap | bin/kebijakan-env.test.mjs | Bash: tanpa isi / kapabilitas tetap → tanpa keputusan baru | mekanisme |
| N-003 | (baru) penjaga `.env` & hook dipasang otomatis oleh installer, idempoten | bin/kebijakan-env.test.mjs | pemasangan: matcher mencakup Read/Grep/Glob; aturan deny .env idempoten & tidak menghapus aturan lain | mekanisme |
| N-004 | protokol.md › *Tugas 1* & *Format pesan*: ID tugas di baris pertama brief ke subagent peran | bin/kebijakan-env.test.mjs | A1: brief ke subagent rudis-* tanpa ID tugas di baris pertama → deny; ber-ID / subagent lain → tanpa keputusan | mekanisme |
| N-005 | (baru) gerbang Tech Lead-subagent sebelum melapor | bin/gerbang-tl.test.mjs | lulus penuh → exit 0 SIAP LAPOR | mekanisme |
| N-006 | (baru) cek kunci `.env` tanpa nilai | bin/env-kunci.test.mjs | properti: 100 nilai acak × berkas normal/rusak — keluaran (main) tidak pernah memuat nilai | mekanisme |
| N-007 | (baru) gerbang Tech Lead-subagent sebagai hook SubagentStop idempoten | bin/gerbang-tl.test.mjs | hook idempoten: 3× input sama → keluaran sama, tidak menulis berkas apa pun | mekanisme |
| N-008 | (baru) hook Stop di frontmatter rudis-tech-lead dibangkitkan dari agents/tech-lead.md | bin/peran.test.mjs | gerbang_stop → hook Stop di frontmatter subagent (T-20261031-2.3) | mekanisme |
