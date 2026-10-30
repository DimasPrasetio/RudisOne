# RudisOne

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

## Cara pakai (sehari-hari)
1. Buka Claude Code / Claude Desktop di **folder proyekmu** seperti biasa.
2. Ketik **`/rudisone <permintaan>`**, mis. `/rudisone perbaiki cetak SJ`. Sesi itu menjadi **COO**.
   Sebelum tim bergerak, COO **menyamakan persepsi** denganmu (skill `rudis-grill-me`): fakta yang bisa dicari ia cari
   sendiri, sisanya ditanyakan satu per satu, masing-masing dengan rekomendasinya, lalu ia menutup dengan ringkasan
   pemahaman bersama (hasil, kriteria selesai, lingkup, batasan). Tim baru bekerja setelah kamu menyetujuinya, dan
   hasilnya diverifikasi terhadap kriteria itu. Mau melewatinya untuk hal sepele? Tambahkan "langsung".
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

## Membangun software (SDLC)
Perkakas resmi pembuat software RudisOne adalah skill **`rudis-monorepo`** (standar arsitektur, scaffold,
deploy standar) dan pustaka **`rudis-modules`** (modul, kit UI, preset). Keduanya tinggal di repo
masing-masing — tidak dibundel — dan `bin/perkakas.sh` memasangnya bila belum ada serta memperbaruinya di setiap
`/rudisone` (tanpa pernah menimpa perubahanmu di repo sumber, dan ditunda selama tugas Engineering berjalan).
skill `rudis-sdlc` memetakan tujuh fase (Inisiasi, Analisis, Desain, Konstruksi, Pengujian, Rilis, Operasi) ke jabatan dan
menetapkan empat gerbang persetujuanmu:

| Gerbang | Yang kamu putuskan |
|---|---|
| **Persetujuan Inisiasi** | maksud & kriteria selesai, stack, nama & folder, cakupan awal — lewat penyelarasan persepsi (tanpa server) |
| **Persetujuan Rancangan** | tabel perakitan modul + arah desain |
| **Persetujuan Rilis** | serah ke branch utama, commit, push |
| **Persetujuan Penerapan** | fakta deploy (slug, domain, GHCR, konfigurasi server), pendaftaran server & setiap deploy |

Contoh: `/rudisone buatkan aplikasi booking lapangan`.

## Struktur
```
CLAUDE.md                  memuat protokol.md otomatis (@protokol.md) untuk sesi di folder ini, ruang/, worktree RudisOne
protokol.md                protokol INTI (≤200 baris): pemilik fakta, model sesi, format pesan, larangan keras
agents/<id-peran>.md       definisi peran (sumber tunggal), termasuk COO & Tech Lead
agen/rudis-<id-peran>.md   subagent peran — DIBANGKITKAN dari agents/ + protokol.md (bin/peran.sh bangun); ditautkan ke ~/.claude/agents
.claude/                   folder ini = ruang COO ("agent": "coo")
ruang/<id-peran>/.claude/  ruang sesi ("agent": "<id-peran>", peran = symlink ke agents/) — sesi IT Operations & sesi lain saat dibutuhkan
raci.md                    matriks RASCI + wewenang per peran
docs/pemetaan-aturan-v5.md pemetaan 100% aturan protokol v4 → lokasi baru (dicek bin/cek-konsistensi.sh)
uji/suite/                 suite regresi organisasi (10 tugas × k ulang, sebelum vs sesudah)
perkakas.json              perkakas resmi SDLC + skill luar (docx-neuron, document-skills, frontend-design, docs) dan sumber resminya
infra.md                   prosedur server, app, domain, alur deploy — generik, tanpa fakta server
konfigurasi/               per device: server.json (server, aplikasi, DNS; git-ignored) + server.contoh.json
penyedia.md                registri kemampuan & penyedia (DNS, repo, server) + alur konfigurasi server
kebijakan-akses.json       akses per jabatan & batas kewenangan jenjang 1–3 (dibaca hook bin/kebijakan.mjs)
bin/                       perkakas (daftar & kode keluar: skill rudis-perkakas › Perkakas bersama)
kantor/                    Kantor RudisOne: server status lokal + tampilan pixel (tanpa dependensi)
templat/                   kerangka brief & laporan, pemahaman bersama, register tugas, TEAM, brief-desain, intake/perakitan/onboarding (SDLC)
skills/<nama>/SKILL.md     skill tim (prosedur dimuat saat perlu): rudisone (pintu COO), rudis-grill-me, rudis-multitugas,
                           rudis-sdlc (membangun software), rudis-sdd, rudis-operasi, rudis-perkakas, rudis-riset-desain — ditautkan ke ~/.claude/skills oleh install.sh
install.sh                 pemeriksaan & persiapan di device baru (idempoten; tidak menimpa tautan sistem lain)
TEAM.md, catatan/, handoff/, konfigurasi/server.json  per device, TIDAK di-commit (repo publik): buku alamat sesi,
                           ingatan per peran, register tugas & hasil, fakta server
```

## Pasang di device baru
RudisOne berjalan di **macOS**, **Linux**, dan **Windows** — native (Claude Desktop, Claude Code CLI, ekstensi VS Code) atau lewat
WSL2 (jalur Linux). Windows native: lihat bagian **Windows native** di bawah tabel.

| | macOS | Linux (Ubuntu/Debian) | Windows (WSL2) |
|---|---|---|---|
| Shell & alat | bawaan (bash, git dari Xcode CLT) | `sudo apt install git curl zip unzip` | `wsl --install -d Ubuntu` (PowerShell admin), lalu semua langkah di terminal **Ubuntu** seperti Linux |
| Node.js ≥ 18 | `brew install node` | nvm atau paket NodeSource | sama dengan Linux, di dalam WSL |
| GitHub CLI `gh` (login) | `brew install gh` | paket resmi cli.github.com | sama dengan Linux |
| Claude Code | installer resmi Claude Code | installer resmi Claude Code | di dalam WSL (bukan Claude Code Windows) |
| uv/uvx (RUDIS SDD) | `brew install uv` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | sama dengan Linux |
| PAT rudis-sdd | Keychain | berkas 0600 `~/.config/rudisone/rahasia/` | sama dengan Linux |

- **Windows native** (Windows 10/11, tanpa WSL):
  - **Prasyarat:** [Git for Windows](https://git-scm.com/download/win) (menyertakan Git Bash — dipakai Claude Code sebagai Bash tool
    dan untuk pembungkus `bin/*.sh`), Node.js ≥ 18 (≥ 22 untuk menjalankan suite uji), GitHub CLI `gh` (login), dan Claude Desktop
    dan/atau Claude Code CLI dan/atau ekstensi VS Code. OpenSSH klien (bawaan Windows) untuk perkakas server. `uv/uvx` bila memakai RUDIS SDD.
  - **Lokasi:** `git clone https://github.com/DimasPrasetio/RudisOne.git %USERPROFILE%\Documents\Neuron\ai-agent\RudisOne`
    (PowerShell: `$HOME\Documents\Neuron\ai-agent\RudisOne`). Folder Documents yang dialihkan ke OneDrive dikenali bila `Documents`
    di profil adalah junction/tautan; selain itu pindahkan/clone ke path di atas.
  - **Pasang:** `node install.mjs` (atau `install.cmd`; di Git Bash `./install.sh`). Tanpa bash/WSL. Hook: `node bin\kebijakan.mjs pasang`
    dan `node bin\inti.mjs pasang`. Perkakas bergaya skrip tetap dipanggil `bin/<nama>.sh` dari **Bash tool (Git Bash)** — nama itu
    yang dikenali hook kebijakan; dari PowerShell pakai `node bin\<nama>.mjs`.
  - **Tanpa hak admin/Developer Mode:** symlink tidak dipakai di repo (peran = salinan terbangkit `bin/peran.mjs`). Skill ditautkan ke
    `~/.claude/skills` sebagai **junction**, subagent sebagai **salinan terlacak** (`~/.claude/.rudisone-tautan.json`; `install.mjs`
    memperbaruinya, `bin/cek-konsistensi.mjs` memeriksanya). Dengan Developer Mode aktif dipakai symlink biasa.
  - **Rahasia:** PAT disimpan terenkripsi DPAPI per-pengguna di `%APPDATA%\rudisone\rahasia\<layanan>.dpapi` — `node bin\perkakas.mjs pat
    <layanan>` (diketik tanpa gema). Hanya akun Windows yang sama di mesin yang sama bisa membukanya.
  - **Kebijakan akses:** alat **PowerShell** ikut dicegat hook dan selalu ditanya di sesi RudisOne (perintahnya tidak diurai); gunakan
    Bash (Git Bash) untuk perkakas RudisOne. Path gaya Git Bash (`/c/Users/…`) dan path Windows (`C:\…`, tak peka huruf besar-kecil)
    dikenali. Detail: `bin/kebijakan.mjs`, uji `bin/kebijakan-windows.test.mjs`.
  - **Backend sesi:** `auto` (lihat Backend sesi di bawah). **Windows terverifikasi** (Windows 11, Claude Code 2.1.302): suite uji,
    `install.mjs`, hook, DPAPI, `claude --bg`/`agents`/`logs`/`rm`; **belum terverifikasi:** `/rudisone` end-to-end di Claude Desktop dan
    ekstensi VS Code — daftar uji: [`uji/windows.md`](uji/windows.md).
- **WSL2:** clone ke filesystem WSL (`~/Documents/…` = `/home/<user>/Documents/…`), **bukan** `/mnt/c/…`: di sana symlink
  dan mode berkas (`chmod 600`, bit executable) tidak andal dan git jauh lebih lambat. Buka sesi Claude Code dari terminal
  WSL (atau VS Code › WSL), bukan dari Windows.
- **Symlink:** repo tidak lagi memuat symlink. Berkas peran di ruang sesi (`.claude/agents/coo.md`,
  `ruang/*/.claude/agents/*.md`) adalah salinan terbangkit dari `agents/<id-peran>.md` (`bin/peran.sh bangun`; diperiksa
  `bin/peran.sh cek`). Yang masih memakai symlink hanya tautan `install.sh` ke `~/.claude` (skill & subagent).
- **Akhir baris:** `.gitattributes` memaksa LF di semua OS (termasuk `core.autocrlf=true` bawaan Git for Windows).
- **Backend sesi** (`bin/sesi.sh backend`, dicatat `install.mjs` di `konfigurasi/sesi.json`): macOS/Windows → `auto` (COO memilih
  per sesi: alat sesi Claude Desktop ada → `desktop`; Claude Code CLI atau ekstensi VS Code → `cli`); Linux/WSL2 → `cli`.
  Instalasi lama yang mencatat `desktop` tetap berlaku. Backend `cli`: COO membentuk sesi Tech Lead/IT Operations dengan `claude --bg`, bertukar
  pesan dengan `SendMessage` ke nama sesi, membaca status dari `claude agents --json`, menghentikan dengan `claude stop`
  (`skills/rudisone/backend-cli.md`). Syarat backend cli: Claude Code **≥ 2.1.300**, dan setiap folder sesi dipercaya
  sekali — `bin/sesi.sh cek` mencetak daftar `cd <folder> && claude` (terima prompt, `/exit`), termasuk worktree Tech Lead
  baru. Prompt izin sesi latar dijawab dengan `claude attach <nama>` (COO memberi perintahnya; Kantor menandai sesinya).
  Pengaman sesi latar dipasang per sesi (`--settings konfigurasi/sesi-cli.settings.json`: tanpa isolasi worktree otomatis,
  deny `git push`/`gh pr create`/`claude rm`, bypass mati) — settings pengguna tidak diubah. **Belum diuji di mesin Linux
  sungguhan** (simulasi + `claude` tiruan).
- **macOS terverifikasi** (Claude Desktop, Claude Code CLI, ekstensi VS Code) untuk versi sebelum dukungan Windows: `uji/macos.md`.
  Perubahan lintas-OS menyentuh jalur yang dicatatnya sebagai pemicu uji ulang, jadi ulangi bagian E `uji/windows.md` di Mac.
- **Windows native terverifikasi** untuk Claude Code CLI dan Claude Desktop (bukti, lingkungan, dan yang belum teruji): `uji/windows-hasil.md`.
- Daftar uji Linux & Windows/WSL2 untuk rekan (langkah + hasil yang diharapkan, keluarannya dikirim ke COO): `uji/linux-wsl.md`.

1. `git clone https://github.com/DimasPrasetio/RudisOne.git ~/Documents/Neuron/ai-agent/RudisOne` (repo publik; harus di path ini —
   peran dan aturan merujuk `~/Documents/Neuron/ai-agent/RudisOne`).
2. `~/Documents/Neuron/ai-agent/RudisOne/install.sh` (Windows: `node install.mjs`) — membuat `handoff/`, memeriksa peran, menautkan skill & subagent ke `~/.claude`, konfigurasi server
   (bila sudah diisi: koneksi ssh & MCP DNS), dan memasang perkakas resmi SDLC (clone `rudis-monorepo` dan
   `rudis-modules` ke `~/Documents/Neuron/ai-agent`, skill ke `~/.claude/skills`) bila belum ada.
3. Pasang dua hook (dijalankan pemilik sendiri, sekali per device; cadangan settings dibuat dulu; hanya bertindak di
   sesi RudisOne; hook sistem lain tidak disentuh):
   - kebijakan akses: `~/Documents/Neuron/ai-agent/RudisOne/bin/kebijakan.sh pasang` (uji dulu: `bin/kebijakan.sh uji '<json>'`);
   - pemuat ulang inti setelah kompaksi: `~/Documents/Neuron/ai-agent/RudisOne/bin/inti.sh pasang`.
4. Server tidak ditanam di repo. Saat tugas server pertama, COO menanyakan alias ssh (entri `Host` di
   `~/.ssh/config` beserta kuncinya kamu siapkan sendiri), playbook server bila ada, MCP DNS, dan domain, lalu
   menyimpannya di `konfigurasi/server.json` atas persetujuanmu (`penyedia.md` › Konfigurasi server). Opsional:
   izin deploy tetap — lihat bagian di bawah.
5. RUDIS SDD (repo privat git.neuron.id) butuh PAT GitLab (`read_repository` + `read_api`), diketik saat diminta —
   tidak pernah di argumen atau di repo. `install.sh`/`bin/perkakas.sh siapkan` menampilkan perintah yang sesuai OS:
   macOS `security add-generic-password -U -s rudisone-rudis-sdd -a "$USER" -w` (Keychain); Linux/WSL2
   `~/Documents/Neuron/ai-agent/RudisOne/bin/perkakas.sh pat rudisone-rudis-sdd` (berkas 0600 di
   `~/.config/rudisone/rahasia/`). Perintah yang sama memperbarui PAT yang ditolak.
6. Buka sesi di folder proyek mana pun dan ketik **`/rudisone`** — COO siap; sesi lain dibentuk saat ada tugasnya.
7. Periksa drift kapan saja: `~/Documents/Neuron/ai-agent/RudisOne/bin/cek-konsistensi.sh` (0 bersih · 1 peringatan · 2 galat).

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
- Skill luar (docx-neuron, docx/pdf/pptx/xlsx, frontend-design) tidak dibundel: dipasang dari sumber resminya saat
  pertama dibutuhkan lewat `bin/perkakas.sh pastikan <skill>`; keadaannya `bin/perkakas.sh skill` (skill `rudis-perkakas` › Skill luar).
- Uji: `node --test bin/*.test.mjs kantor/*.test.mjs uji/suite/*.test.mjs` (Kantor, perkakas, register, kebijakan,
  pemeriksa, suite). Suite perilaku organisasi (berbiaya, memanggil `claude -p`): `uji/suite/README.md`.

## Memperbarui
Ubah peran/protokol → `bin/peran.sh bangun` (subagent ikut) → `bin/cek-konsistensi.sh --repo` → commit → push dari satu
device; device lain cukup `git pull` lalu `install.sh`. Peran & subagent ditautkan lewat symlink, jadi berlaku untuk
sesi berikutnya. Sesi inti yang sedang berjalan: minta COO mengirim instruksi "baca ulang peranmu". `catatan/` dan
`TEAM.md` per device dan tidak ikut git.

## Serah migrasi v5 ke main (sekali, atas permintaan pemilik)
Branch `rudis/T-20261030-2` mengeluarkan `catatan/` dari git. Di checkout utama `catatan/*.md` masih dilacak dan bisa
punya perubahan lokal, jadi **jangan merge langsung** — merge akan batal atau menghapus berkas ingatan dari disk.
Urutan aman (`agents/tech-lead.md` › Serah ke branch utama):
```bash
cd ~/Documents/Neuron/ai-agent/RudisOne
# cek dulu — skripnya baru ada di branch, jadi jalankan dari worktree branch itu terhadap checkout utama:
RUDISONE_ROOT="$PWD" node <worktree rudis/T-20261030-2>/bin/cek-konsistensi.mjs --serah refs/heads/rudis/T-20261030-2
git rm -r -q --cached catatan && git commit -m "chore: catatan/ per device, keluar dari git (T-20261030-2)"
git merge --no-ff refs/heads/rudis/T-20261030-2
./install.sh
```
`bin/cek-konsistensi.sh` dan `install.sh` memperingatkan bila `catatan/` masih dilacak.

## Rollback ke pola lama (organisasi penuh sebagai sesi, protokol v4)
Migrasi v5 (T-20261030-2) masuk sebagai satu merge commit, jadi bisa dibalik utuh:
1. Revert memulihkan `catatan/*.md` sebagai berkas terlacak dan akan bentrok dengan berkas tak terlacak di disk
   ("untracked working tree files would be overwritten"). Pindahkan dulu, revert, lalu kembalikan isi device:
   `mv catatan /tmp/catatan-cadangan && git revert -m 1 <sha-merge-T-20261030-2> && cp /tmp/catatan-cadangan/*.md catatan/`
   (isi device menang; `git status` lalu menunjukkan perubahannya sebagai perubahan lokal biasa).
2. `install.sh` lalu lepas hook pemuat ulang inti bila tidak dipakai lagi: `bin/inti.sh lepas`. Tautan subagent
   `~/.claude/agents/rudis-*.md` milik repo ini boleh dihapus (`find ~/.claude/agents -name 'rudis-*.md' -type l -delete`).
3. Panggilan `/rudisone` berikutnya membentuk lagi organisasi penuh (pola v4); sesi lama yang masih tercatat di
   `TEAM.md` dipulihkan otomatis.
4. Register tugas: Kantor & COO v4 membaca `handoff/register-tugas.md`, yang tetap dibangkitkan dari JSON — tidak ada
   data yang hilang.

## Aturan
- Jangan pernah menyimpan rahasia (password, token, private key, isi `.env`) di repo ini — juga tidak di
  `konfigurasi/server.json`.
- Jangan menanam fakta server (host, IP, path server, domain, nama app) di peran, protokol, atau templat; semuanya
  dibaca dari `konfigurasi/server.json`.
- Jangan menaruh aturan tim di repo proyek; proyek hanya berisi aturan proyeknya.
