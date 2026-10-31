---
name: rudis-sdlc
description: SDLC RudisOne untuk membangun software dengan perkakas resmi Rudis (skill rudis-monorepo + pustaka rudis-modules) — routing jalur (mode A/B, rincian jalur & gerbang mutu di rudis-sdd), fase Jalur Aplikasi dan siapa R/S/C, empat gerbang persetujuan pengguna (Inisiasi, Rancangan, Rilis, Penerapan), proyek baru, perkakas.sh siapkan/versi/proyek, artefak proyek, desain di proyek Rudis, dan Jalur Platform (ubah skill/pustaka, promote modul). Muat untuk setiap tugas Engineering yang membangun/mengubah aplikasi, memasang/upgrade modul, audit standar, deploy standar, atau mengubah skill/pustaka.
---

# SDLC RudisOne — membangun software dengan perkakas resmi Rudis

Pemilik: COO. Skill `rudis-monorepo` dan pustaka `rudis-modules` adalah perkakas resmi pembuat software RudisOne
(keputusan pengguna).

**Pembagian kewenangan.** Skill `rudis-monorepo` adalah sumber kebenaran **teknis**: struktur repo,
arsitektur, pustaka modul, standar deploy, Final Checklist. File ini hanya mengatur **siapa** mengerjakan
bagian mana, **kapan**, dan **di mana pengguna memutuskan**. Tidak ada aturan teknis skill yang disalin ke sini;
bila keduanya tampak berbeda soal teknis, skill menang, soal peran & persetujuan, RudisOne menang.

## 1. Perkakas resmi
| Perkakas | Isi | Repo sumber (lokal) | Dipakai lewat |
|---|---|---|---|
| Skill `rudis-monorepo` | Standar, `scaffold.mjs`, referensi per topik, Final Checklist | `DimasPrasetio/rudis-monorepo` (`~/Documents/Neuron/ai-agent/rudis-monorepo`) | salinan terpasang `~/.claude/skills/rudis-monorepo` |
| Pustaka `rudis-modules` | Modul siap pakai, kit UI, preset tema, `module.mjs` | `DimasPrasetio/rudis-modules` (`~/Documents/Neuron/ai-agent/rudis-modules`) | langsung dari repo lokal |

Daftar mesinnya: `perkakas.json`. Keduanya **tidak** dibundel ke `~/Documents/Neuron/ai-agent/RudisOne` — pengguna juga memakainya di luar
RudisOne, dan salinan kedua akan berbeda diam-diam.

### Pemeriksaan & pembaruan otomatis (`bin/perkakas.sh`)
- COO menjalankan `bin/perkakas.sh siapkan` di awal setiap `/rudisone` (fetch paling sering 30 menit sekali),
  dan `bin/perkakas.sh siapkan --segera` tepat sebelum mengirim brief yang memakai perkakas (proyek baru, pasang/
  upgrade modul, Jalur Platform). `install.sh` juga menjalankannya.
- Yang dilakukan: belum ada → `git clone` (+ `core.hooksPath` hook repo); tertinggal dan bersih → `git pull
  --ff-only`; skill terpasang beda dari paket `dist/` di repo → `install.sh` milik repo skill.
- Yang **tidak pernah** dilakukan: menyentuh repo yang punya perubahan belum di-commit atau yang bercabang dari
  origin, `stash`/`reset`, commit, push. Repo seperti itu dipakai apa adanya dan disebut di keluaran.
- Ditunda bila ada tugas Engineering berstatus berjalan/ditinjau/terhambat yang kolom Perkakas-nya bukan `—` —
  agar agent yang sedang bekerja tidak membaca campuran versi lama dan baru. `--paksa` hanya atas permintaan
  pengguna.
- Exit 1 tidak menghentikan kerja (versi yang ada dipakai). COO menyebutnya ke pengguna dalam satu baris hanya
  bila berpengaruh (mis. pembaruan tertunda, repo sumber sedang diubah, clone gagal).
- **Izin tetap** (dari permintaan pengguna 2026-10-24): clone, `pull --ff-only`, pasang ulang skill, dan
  `core.hooksPath` pada clone baru. Mengubah repo sumber tetap lewat Jalur Platform.

### Versi tercatat
Kolom **Perkakas** register tugas = keluaran `bin/perkakas.sh versi` (mis. `rudis@b444853 lib@43e552f`, ditambah `sdd@<sha>` bila RUDIS SDD terpasang) saat tugas
Engineering dimulai atau dilanjutkan dari parkir; `—` untuk tugas yang tidak memakai perkakas. Akhiran `+lokal`
berarti versi itu belum ada di origin.

### Jenis proyek (`bin/perkakas.sh proyek <folder>`)
| Hasil | Arti | Skill dipakai untuk |
|---|---|---|
| `rudis-pustaka` | Dibangun dengan standar penuh (`modules.lock.json`) | Seluruh Jalur Aplikasi |
| `rudis-deploy` | Proyek lama dengan deploy standar rudis-monorepo (`infra/deploy/`) | Audit & deploy (langkah 4–5 skill); aturan proyek sendiri (`CLAUDE.md`, `.claude/rules`, `knowledge/`) menang |
| `lain` | Bukan proyek Rudis | Hanya bila pengguna meminta proyek baru atau restrukturisasi ke standar |

Jenis proyek menentukan bagian skill `rudis-monorepo` yang dipakai; **mode A/B** (kartu proyek) menentukan proses. Bug,
perubahan, dan upgrade di proyek `rudis-deploy`/`lain` (legacy, klien) dikerjakan sebagai Mode B lewat skill `rudis-sdd`;
restrukturisasi ke standar tetap tugas eksplisit.

## 2. Routing permintaan
| Permintaan | Jalur | R |
|---|---|---|
| Buat aplikasi/proyek baru | Aplikasi, Inisiasi–Operasi | COO (Inisiasi) → Tech Lead tim baru |
| Fitur baru di proyek `rudis-pustaka` | Aplikasi, mulai Analisis (perakitan untuk fitur itu) | Tech Lead |
| Bug, perubahan, atau upgrade di proyek Mode A/B (termasuk legacy/klien) | Aplikasi, mulai Analisis; jalur dua sumbu skill `rudis-sdd` | Tech Lead, S: BSA |
| Pasang / upgrade / lepas modul pustaka | Aplikasi, Konstruksi / Operasi | Tech Lead |
| Audit repo terhadap standar | Final Checklist skill | Tech Lead, S: BSA |
| Siapkan/benahi deploy standar sebuah repo | Langkah 5 skill (berkas) + Rilis (server) | Tech Lead (berkas), Head of IT Operations (server) |
| Ubah skill atau pustaka; promote modul proyek ke pustaka | Platform | Tech Lead tim platform |

## 3. Jalur Aplikasi — proyek aplikasi
| Fase | R | S / C | Bagian skill | Hasil & letak | Gerbang |
|---|---|---|---|---|---|
| Inisiasi | COO | Head of Strategy bila perlu nilai bisnis; **tanpa server** — IT Operations tidak dilibatkan | Step 0 (backend); Step 0b ditunda ke Penerapan | `handoff/<ID>/pemahaman.md` + `intake.md` (`templat/pemahaman-bersama.md`, `templat/intake-proyek.md`) | **Persetujuan Inisiasi** |
| Analisis & perakitan | Tech Lead | Business Systems Analyst (kemampuan, tabel perakitan, MODULE_MAP, API); C: Financial Controller/HR Business Partner bila domainnya | `module-library.md` §1–3, `backend-modular-monolith.md`, `api-standard.md` | `templat/tabel-perakitan.md` → `analysis/` proyek | **Persetujuan Rancangan** |
| Desain UI | Tech Lead | Research Analyst (paralel dengan Analisis) | `design-research.md` | draf → `knowledge/DESIGN.md` proyek | ikut **Persetujuan Rancangan** |
| Konstruksi | Tech Lead | Software Engineer #1/#2, asisten | Langkah 1 (scaffold), `module-library.md` §4–6, referensi stack, `frontend.md`; `.env` & database lokal (izin tetap) | branch `rudis/<ID>`; `.env` lokal tanpa placeholder | — |
| Pengujian | Tech Lead | peninjau berkonteks bersih (subagent `rudis-software-engineer`, tinjauan silang), BSA (cocok spesifikasi) | Final Checklist | laporan divisi + checklist terisi | — |
| Rilis & penerapan | Head of IT Operations | System Administrator; Tech Lead (sha + catatan rilis, isi penanda) | Step 0b, `docker-deployment.md` | `templat/onboarding-app.md`, `templat/laporan-deploy.md` | **Persetujuan Rilis**, **Persetujuan Penerapan** |
| Operasi & pemeliharaan | Head of IT Operations (operasi) · Tech Lead (kode) | — | `module-library.md` (status/upgrade), `backend-go.md` › Kernel versions | tugas baru per perubahan | sesuai jenisnya |

Kolom **Fase** register tugas mencatat fase aktif tugas (mis. `Konstruksi`); Program Manager memakainya untuk status lintas proyek.

**Mode, jalur, dan gerbang mutu (RUDIS SDD).** Mode proyek A/B ada di kartu proyek (`.rudisone/kartu-proyek.md`;
deteksi `bin/perkakas.sh proyek <folder>`, dikonfirmasi pengguna sekali) dan menentukan constitution, gerbang mutu, dan
apakah tabel perakitan dipakai. Jalur per perubahan (jenis × cakupan: pasang, pasang + sesuaikan, bangun, ubah modul
kustom, tracer, redesign, revamp, upgrade, tanpa SDD) dipilih BSA dengan kriteria tertulis, ditinjau TL, ikut brief /
Persetujuan Rancangan, dicatat di register (`jalur_awal`, `jalur_akhir`), dan ditanyakan ke pengguna hanya bila `ragu`.
Rinciannya, termasuk gerbang mutu baseline (tidak ada temuan **baru**) dan aturan CVE: skill `rudis-sdd` (dimuat
hanya untuk baris yang memakai command `/rudis.*`). Baris *pasang* biasa dan perubahan kecil tidak lewat SDD.

### Gerbang keputusan pengguna (ditanyakan COO)
- **Persetujuan Inisiasi** — lewat **penyelarasan persepsi berkedalaman mendalam** (skill `rudis-grill-me`, `agents/coo.md` ›
  Penyelarasan persepsi): hanya fakta membangun — masalah & pengguna aplikasi, kriteria selesai rilis pertama, backend
  (go/nestjs/express), nama & folder, cakupan awal, perangkat & bahasa UI — satu cabang per giliran dengan rekomendasi.
  Persetujuan ringkasan pemahaman bersama = Persetujuan Inisiasi. **Fakta deploy tidak ditanyakan dan server tidak dicek
  di Inisiasi** (slug, domain, pemilik GHCR, port, konfigurasi server): proyek bisa hanya lokal dan device bisa belum
  punya `konfigurasi/server.json`. Persetujuan Rancangan sampai Penerapan di bawah: satu pesan per gerbang, rekomendasi COO di setiap keputusan.
- **Persetujuan Rancangan** — tabel perakitan (pasang / pasang + sesuaikan / bangun per kemampuan) dan arah desain
  ringkas (preset, elemen khas, 2–3 keputusan utama).
- **Persetujuan Rilis** — serah ke branch utama, commit, membuat repo GitHub (repo privat oleh COO = jenjang 2; push = jenjang 3,
  skill `rudis-operasi`), push: aturan biasa (kutipan
  permintaan per aksi).
- **Persetujuan Penerapan** — pendaftaran app pertama (DB + user, `.env`, akses GHCR, nginx, DNS, certbot) dan setiap deploy:
  rencana persis + dampak + rollback dari IT Operations, per aksi. **Server baru disentuh di sini**, saat pengguna
  meminta deploy: COO membentuk/memulihkan sesi IT Operations (`agents/coo.md` › Organisasi inti), lalu fakta bagian
  *Sebelum penerapan pertama* `templat/intake-proyek.md` dikumpulkan — slug, domain, pemilik GHCR/repo ditanyakan COO;
  port kosong berikutnya + konfirmasi `ss -tlnp` dan cek slug belum dipakai dari System Administrator (read-only);
  `konfigurasi/server.json` belum ada → baru saat itu COO menanyakannya (skill `rudis-operasi` › Konfigurasi server).
  Tech Lead mengganti penanda deploy di repo (branch tugas); bila hasilnya sudah di-push, perubahan itu butuh serah &
  push baru (Persetujuan Rilis lagi) sebelum deploy.

### "Tanya pengguna" di dalam skill
Skill ditulis untuk satu agent yang berbicara langsung dengan pengguna. Di RudisOne, hanya COO yang bertanya.
Langkah skill yang berbunyi *ask / confirm with the user / STOP and ask* → pelaksana berhenti di langkah itu dan
menulis pertanyaannya di laporan bagian **Keputusan yang dibutuhkan** (atau `[Terhambat]` bila tidak bisa lanjut);
COO menanyakannya di gerbang yang sesuai dan meneruskan jawabannya apa adanya.

### Proyek baru — langkah pembuka
1. COO: `bin/perkakas.sh siapkan --segera`; daftarkan ID (Fase `Inisiasi`, kolom Perkakas dari `versi`).
2. COO menyelaraskan persepsi sekaligus menanyakan fakta Persetujuan Inisiasi (skill `rudis-grill-me`; cabang = bagian
   Inisiasi `templat/intake-proyek.md`). Tidak ada tugas ke IT Operations dan tidak ada cek server.
3. Setelah pemahaman bersama (= Persetujuan Inisiasi) disepakati (giliran yang dipicu pengguna): COO membuat folder
   proyek, `git init -b main`, lalu **kartu proyek Mode A**: `bin/perkakas.sh proyek <folder>` (folder baru →
   `mode-mesin: A`, bukti "folder proyek baru"), tulis `.rudisone/kartu-proyek.md` dari `templat/kartu-proyek.md` dengan
   `mode: A`, `mode_mesin: A`, `override: -`, `dikonfirmasi: <tanggal> "<kutipan persetujuan Inisiasi>"` (Persetujuan
   Inisiasi = konfirmasi mode; tidak ditanyakan lagi), `backend` dari Inisiasi, `constitution: tipis`, `artefak: root`,
   dan salinan keluaran deteksi. Satu commit `chore: mulai proyek <nama>` berisi kartu itu — worktree butuh satu commit.
   Backend non-Go (perakitan pustaka hanya Go) → `mode: B` dengan alasan di `override`. Hanya ini yang COO tulis di folder proyek.
4. COO membentuk sesi Tech Lead untuk folder itu (`agents/coo.md` › Organisasi inti), lalu brief
   ke Tech Lead untuk Analisis–Pengujian (BSA dan SE dipanggil Tech Lead sebagai subagent).
5. Tech Lead men-scaffold di worktree-nya, di branch `rudis/<ID>`, dengan `--dir <worktree> --force` dan fakta yang
   sudah ada. Fakta deploy yang belum ada **tidak diberi flag** dan menjadi penanda `__…__` (mis. `__HOST_PORT__`, `__GHCR_OWNER__`, `__SSH_HOST__`; skill
   `rudis-monorepo` › Step 0b: *If a fact is unknown, scaffold without its flag* / *If the user has no server yet,
   scaffold without the deploy flags*); Step 0b (membaca target/server) dilewati sampai Penerapan. Aplikasi tetap
   dijalankan & diuji lokal — hanya `deploy.sh` yang menolak jalan sampai penanda diisi; penanda yang disengaja lulus
   Final Checklist (*left as markers on purpose*). Fakta deploy kosong tidak pernah menjadi alasan `[Terhambat]`.
   Penanda deploy ≠ `.env` lokal: `.env` lokal **tanpa** placeholder, disiapkan langsung (*`.env` & database lokal*).
6. Repo GitHub dibuat hanya saat pengguna meminta push pertama (Persetujuan Rilis) — oleh COO (`gh repo create`, privat).
7. Deploy pertama hanya bila pengguna memintanya → Persetujuan Penerapan (fakta *Sebelum penerapan pertama*).

### `.env` & database lokal (Konstruksi, langsung setelah scaffold) — disiapkan agent
Proyek **langsung bisa dijalankan**: `.env` lokal tanpa placeholder (`__ISI_…__`, `change-me`) dan database lokal siap,
tanpa pengguna menyunting `.env`. **Izin tetap pengguna** (2026-10-31,
T-20261031-1): "Agent siapkan sendiri (Rekomendasi)". Izin ini menggantikan "izin per kali" **hanya** untuk database lokal
proyek yang sedang dibangun: menyiapkannya, lalu memakainya lewat kode proyek (migrasi, seed, menjalankan aplikasi, tes
ber-database) pada `<slug>_db`/`<slug>_test`. MySQL lain (tes platform §4, database lain, menyalakan layanan) tetap per kali.
1. **`.env`** dibuat skill `rudis-monorepo` saat scaffold dan `module.mjs add` (gitignored, di samping `.env.example`):
   APP_*, `JWT_SECRET` acak, kunci modul terisi nilai lokal. **Login awal lokal bawaan** selalu `admin` / `admin@gmail.com`
   / `admin123` (keputusan pengguna 2026-10-31): nilai bawaan lokal yang **publik, bukan rahasia** — boleh disebut di laporan.
   Tidak pernah di `.env.production*`, server, atau deploy (penolakan oleh pemeriksaan deploy skill: ⟨**SEMENTARA** — Tim 3,
   T-20261031-1.1⟩). Jangan mengganti diam-diam, jangan melemahkan kebijakan sandi production.
2. **Database:** Tech Lead proyek menjalankan sendiri, tanpa interaksi, di folder proyek (worktree):
   `node scripts/db-local.mjs --agent` ⟨**SEMENTARA** — nama/flag final dari Tim 3, T-20261031-1.1⟩. Skrip memeriksa
   `SELECT VERSION()`, membuat `<slug>_db`, `<slug>_test`, dan akun `<slug>_dev@'127.0.0.1'` (`caching_sha2_password`,
   berhak hanya atas dua database itu) bersandi acak, menulis kunci DB ke `.env`, lalu mencoba login dengan akun itu.
   **Batas** (wajib, dikutip di brief Konstruksi):
   - hanya MySQL di **localhost** (`127.0.0.1`/`localhost`/`::1`) — tidak pernah host lain, server, atau production;
   - hanya database dan akun **proyek itu** (`<slug>_*`); database/akun lain tidak dibaca dan tidak diubah;
   - **tanpa menghapus data**: skrip persiapan tidak menjalankan `DROP`/`TRUNCATE`/`DELETE`; data `<slug>_db` hanya diubah
     migrasi maju & seed proyek; reset/migrasi turun/pengosongan hanya pada `<slug>_test` oleh tes;
   - **`<slug>_*` sudah ada** (proyek lama, checkout lain) → mode agent **berhenti** tanpa mengganti sandi akun dan
     tanpa memakai database itu; COO menanyakan pengguna;
   - **sandi** (sandi akun DB acak dan sandi admin MySQL) tidak pernah lewat chat, brief, laporan, log, atau berkas
     RudisOne. Agent tidak membaca `.env` — skrip menulis & menguji login; aplikasi/tes memuat `.env` sendiri, jadi brief
     cukup menyebut nama database. Laporan: "DB siap, login akun proyek berhasil" + nama database.
3. **Agent berhenti, satu langkah pengguna** (tanpa menebak sandi/host lain) di laporan, diteruskan COO persis
   (PowerShell 5.1: tanpa `&&`); setelah pengguna menjawab "sudah":
   - admin MySQL bersandi → pengguna menjalankan `node scripts/db-local.mjs` di **path absolut worktree** Tech Lead
     (interaktif; sandi diketik di terminalnya, tersembunyi; `--print-sql` = pratinjau). Lalu Tech Lead **tidak**
     mengulang mode agent (`<slug>_*` kini ada): ia memverifikasi lewat kode proyek (migrasi/tes memuat `.env`);
   - MySQL tidak menjawab → pengguna menyalakan MySQL-nya (agent tidak menyalakan layanan); Tech Lead mengulang mode agent.
4. Tanpa MySQL lokal → tes tanpa database jalan terus; kriteria ber-database "belum terverifikasi", bukan `[Terhambat]`.
   Hasil dicatat di *Database lokal* `templat/intake-proyek.md` (tanpa sandi/DSN).
5. **Serah ke checkout pengguna**: `.env` di-gitignore sehingga tidak ikut merge — Tech Lead menyalin berkas `.env`
   worktree ke checkout utama bila di sana **belum ada** (salin berkas, tanpa membaca; tidak pernah menimpa) agar
   aplikasi langsung jalan di folder pengguna (`agents/tech-lead.md` › Serah ke branch utama).
6. Uji penolakan penjaga skrip: pada fungsi penjaga, bukan dengan menjalankan skrip (`protokol.md` › Ruang kerja Engineering).

### Artefak milik proyek
Hasil yang menjadi bagian proyek (`analysis/`, `knowledge/DESIGN.md`, ADR di `knowledge/decisions/`,
`knowledge/MODULE_MAP.md`, `modules.lock.json`) **masuk repo lewat branch tugas** — ditulis Tech Lead/engineer.
Business Systems Analyst dan Research Analyst menyiapkan drafnya di `handoff/<ID>/`. Fakta server (port, app terdaftar) tetap milik
`infra.md` (System Administrator); proyek mencatat nilai miliknya di `knowledge/DEPLOYMENT.md` hasil scaffold.

### Desain di proyek Rudis
Alur `references/design-research.md` milik skill yang berlaku (brief di `knowledge/DESIGN.md`, pengecekan preset
pustaka); skill `rudis-riset-desain` RudisOne dipakai untuk proyek lain dan untuk langkah verifikasi visualnya.

## 4. Jalur Platform — platform (skill & pustaka)
- **Tim platform** (sesi Tech Lead + subagent) dibentuk saat ada tugas, di folder repo yang diubah (`~/Documents/Neuron/ai-agent/rudis-monorepo` atau
  `~/Documents/Neuron/ai-agent/rudis-modules`), memakai satu dari tiga slot tim; tawarkan arsip setelah selesai.
- Wajib dibaca dulu: `AGENTS.md` repo itu — arsitektur **terkunci**. Perubahan pada bagian terkunci (kernel,
  kontrak frontend, aturan pustaka, menambah lapisan) adalah keputusan pengguna: Tech Lead menulis usulan + dampak,
  COO menanyakannya.
- **Urutan berantai**: perubahan yang menyentuh kontrak modul → tugas skill dulu (naikkan versi kernel di tiga
  tempat), lalu tugas pustaka yang `Bergantung` padanya (modul + `requires_kernel` + testbed dengan
  `--skill <worktree skill>`).
- **Verifikasi**: skill `npm run verify`; pustaka `npm run check` + `npm run testbed`. Smoke-test dan testbed
  butuh MySQL, yang di device ini mati secara default → minta izin pengguna lewat COO per kali, atau verifikasi
  lewat CI setelah push (Persetujuan Rilis). Tanpa keduanya, laporkan "belum terverifikasi penuh" apa adanya.
- Hook pre-commit wajib aktif; `git commit --no-verify` dilarang. Aturan yang salah diperbaiki di aturannya,
  dengan alasan, di commit yang sama.
- **Promote** modul dari proyek menulis ke repo pustaka → selalu tugas Jalur Platform di tim pustaka, atas persetujuan
  pengguna; Tech Lead tim proyek hanya menyiapkan modulnya.
- Setelah hasil platform diserahkan ke branch utama repo itu: COO menjalankan `bin/perkakas.sh siapkan --segera`
  agar skill terpasang mengikuti (commit lokal yang belum di-push dipakai apa adanya; push hanya atas permintaan).

## 5. Belum diputuskan
- Pemeriksa batas modul otomatis untuk proyek hasil scaffold (`arch:check`) — usulan perbaikan skill; disarankan
  sebagai tugas Jalur Platform pertama sebelum proyek baru pertama.
- Izin tetap menyalakan MySQL lokal khusus tes platform — saat ini izin per kali.
  Persiapan database lokal **proyek** sudah izin tetap sejak 2026-10-31 (*`.env` & database lokal*).
