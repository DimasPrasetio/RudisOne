---
name: rudis-multitugas
description: Prosedur RudisOne untuk banyak tugas sekaligus — ID & sub-ID, register tugas (bin/register.sh), lingkup folder, antre/parkir dengan status.md, kunci sumber daya, kapasitas, dan urutan prioritas. Muat saat menerima tugas kedua untuk sesi yang sibuk, memparkir/melanjutkan tugas, menjadwalkan tugas yang mungkin berebut berkas/branch/data/deploy, atau menulis register tugas.
---

# Multi-tugas RudisOne

Inti aturannya ada di `protokol.md` › Tugas, folder, dan beban. Skill ini memuat rinciannya. Tim boleh mengerjakan
banyak tugas sekaligus di proyek atau folder berbeda yang tidak saling terkait; yang menjaga agar tidak tercampur:

## 1. ID tugas
COO memberi ID `T-YYYYMMDD-n` saat menerima tugas (`bin/register.sh tambah` memberi nomor berikut); sub-tugas dari
leader `T-YYYYMMDD-n.k`. ID ada di baris pertama **setiap** pesan, di `handoff/<ID>/…`, dan di laporan. Pesan tanpa
ID → minta pengirim menyebutkan ID-nya dulu.

## 2. Register tugas (sumber kebenaran: `handoff/register-tugas.json`)
- Ditulis **hanya** lewat `bin/register.sh` (kunci berkas + tulis atomik): `tambah`, `ubah <ID> --status …`,
  `tampil`, `kunci-cek`, `validasi`, `rapikan`. Tampilan `handoff/register-tugas.md` dibangkitkan otomatis untuk
  manusia dan Kantor — jangan diedit tangan.
- Status: `penyelarasan` (COO ↔ pengguna, belum ada brief; Pemilik COO; kolom yang belum jelas `?`) · `baru` · `antre`
  · `berjalan` · `diparkir` · `ditinjau` · `terhambat` · `selesai` · `dibatalkan`.
- Kolom Fase (tugas Engineering, skill `rudis-sdlc`) dan Perkakas (`bin/perkakas.sh versi`, `—` bila tidak memakai
  perkakas rudis); tugas berjalan dengan Perkakas selain `—` menunda pembaruan perkakas.
- Tugas yang memakai `/rudis.*`: `--mode-saat-mulai`, `--jalur-awal`, `--jalur-akhir` + `--reroute "<alasan>"` (diisi
  Tech Lead; skill `rudis-sdd` › Pemicu re-route & kapan bertanya).
- Selesai/dibatalkan lebih dari 14 hari dibuang dengan `rapikan`.

## 3. Lingkup folder
Brief selalu menyebut folder kerja absolut. Membaca folder lain lewat path absolut boleh; **menulis hanya di folder
kerja sesimu** (cwd/worktree) dan `~/Documents/Neuron/ai-agent/RudisOne/handoff/`.
- Tugas kode di sebuah folder → Tech Lead proyek itu (sesi inti; COO membentuknya saat tugas pertama dijadwalkan).
- Tugas non-kode yang harus menulis di folder proyek (dokumen di repo, `docs/STATUS.md`) → lewat Tech Lead proyek itu
  (yang memanggil subagent peran terkait), atau sesi saat dibutuhkan `<Jabatan> · <proyek>` di folder itu bila
  pengguna ingin memantaunya.
- Tugas tanpa folder proyek (riset, analisis, dokumen lepas) → subagent peran, hasil di `handoff/<ID>/`.

## 4. Satu tugas aktif per sesi; antre & parkir
- Tugas baru untuk sesi yang sibuk → penerima membalas `[Antre] <ID baru> — sedang <ID aktif>` lalu melanjutkan tugas
  aktif. COO mencatat urutan antrean di register (status `antre`).
- `Prioritas: segera` (mis. SEV1) → **parkir** tugas aktif: tulis `handoff/<ID>/status.md` (`templat/status-tugas.md`:
  sudah apa, berikutnya apa, berkas & branch), laporkan `[Diparkir] <ID>`, kerjakan yang segera. Melanjutkan tugas
  parkir dimulai dari `status.md`, bukan dari ingatan.
- Tech Lead yang berpindah tugas: commit `wip(<ID>): …` di branch tugas itu, tulis `status.md`, baru berpindah branch.

## 5. Paralel vs berurutan (kunci)
Tugas di folder/divisi berbeda berjalan paralel. Tugas yang menyentuh **kunci** yang sama — berkas/area kode di repo
yang sama, branch yang sama, data production yang sama, deploy app yang sama, dokumen yang sama — berurutan. COO
mencatat kunci di register dan menjalankan `bin/register.sh kunci-cek <ID>` sebelum mengirim brief (exit 1 = bentrok
→ status `antre`, sebut alasannya ke pengguna). Format kunci: `repo:<proyek>:<area>`, `branch:<nama>`,
`prod-db:<app>`, `deploy:<app>`, `dok:<path>`.

## 6. Kapasitas
Kekurangan tenaga sesaat → leader menambah subagent sendiri (maks. 3 bersamaan). Antrean satu sesi inti > 1 dan
independen dalam waktu lama → COO mengusulkan sesi saat dibutuhkan (`<Jabatan> #2`) dan membentuknya pada giliran
pengguna berikutnya atas "ya".

## 7. Konteks tidak tercampur
Satu sesi menangani satu ID pada satu waktu; semua bahan per tugas di `handoff/<ID>/`; anggota membersihkan konteks
setelah `[Diterima]`; subagent selalu mulai bersih.

## 8. Prioritas
`segera` (insiden SEV1/SEV2, permintaan pengguna yang mendesak) > `tinggi` (tenggat dekat) > `normal`. Antrean
diurutkan menurut prioritas, lalu waktu masuk.

## 9. Format pesan (tabel lengkap; ringkasan di protokol inti)
| Jenis | Awalan | Dari → ke |
|---|---|---|
| Tugas | `[Tugas dari COO]` / `[Tugas dari <Leader>] <judul>` | COO → leader/staf · leader → anggota |
| Permintaan layanan | `[Permintaan layanan dari <Leader>] <ID> · <judul>` (+ `[Info dari <Leader>]` ke COO) | leader → layanan |
| Tinjau | `[Tinjau] <ID> · <judul>` → `[Hasil tinjauan] <ID> · LULUS \| PERLU REVISI` | tinjauan silang |
| Laporan | `[Laporan ke <pemberi tugas>]` · `[Laporan divisi <divisi>] <ID> · <judul>` | anggota → pemberi tugas · leader → COO |
| Revisi / Diterima | `[Revisi] <judul> — <poin persis>` · `[Diterima] <judul> — bersihkan konteksmu` | pemberi tugas → pelaksana |
| Konsultasi | `[Konsultasi dari <Jabatan>]` → `[Jawaban <Jabatan>]` (ke atribut `from`) | siapa pun |
| Info / tembusan | `[Info dari <Jabatan>] <ringkasan> — file: <path>` | siapa pun |
| Terhambat | `[Terhambat] <judul> — <sebab, yang dibutuhkan>` | pelaksana → pemberi tugas |
| Eskalasi | `[Eskalasi SEV1] <ringkasan>` | Head of IT Operations → COO |
| Antre / Diparkir | `[Antre] <ID baru> — sedang <ID aktif>` · `[Diparkir] <ID> — status: handoff/<ID>/status.md` | penerima → pemberi tugas |
