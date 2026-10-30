# TEAM — buku alamat sesi RudisOne (per device; ditulis COO pada panggilan /rudisone)
<!-- Model v5 "inti kecil + subagent" (protokol.md › Model sesi). Hanya SESI yang dicatat di sini: COO, Tech Lead per
     proyek aktif, dan sesi saat dibutuhkan (termasuk IT Operations). Peran lain dipanggil sebagai subagent
     `rudis-<id-peran>` dan tidak punya baris. Kantor & agent membaca file ini sebagai buku alamat. Kolom Agent memakai
     jabatan persis. Judul bagian tim engineering harus berpola "## Engineering · Tim <n> · <proyek>" — Kantor memakai
     nomornya. Nama sesi berawalan `rudis-` (inti) dan `r<n>-` (tim) agar tidak bentrok dengan sistem agent lain;
     maks. 24 karakter. -->

Dibangun: YYYY-MM-DD

## COO
| Agent | Session id | Name | cwd |
|---|---|---|---|
| COO | `self` | — | `~/Documents/Neuron/ai-agent/RudisOne` |

## IT Operations (sesi saat dibutuhkan)
<!-- Ditulis saat sesi pertama kali dibentuk (tugas server/insiden/data production/deploy atau permintaan pengguna) — bukan
     di setiap /rudisone. Belum dibentuk → bagian ini boleh kosong. Setelah diarsipkan baris tetap, dipulihkan lain kali. -->
| Agent | Peran | Session id | Name | cwd |
|---|---|---|---|---|
| Head of IT Operations | leader | `local_…` | `rudis-head-of-it-ops` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations` |
| System Administrator | SysAdmin | `local_…` | `rudis-sysadmin` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/system-administrator` |

## Engineering · Tim 1 · <proyek>
Folder proyek: `<path absolut>` · branch utama: `<main>` · BSA & Software Engineer: subagent dipanggil Tech Lead

| Agent | Peran | Session id | Name | Branch / worktree |
|---|---|---|---|---|
| Tech Lead | leader | `local_…` | `r1-lead-<proyek>` | worktree integrasi `<path>` (branch per tugas `rudis/<ID>`) |
<!-- Tim 2 dan 3: bagian yang sama dengan nomor tim dan proyeknya sendiri, dibuat saat proyek itu mendapat tugas. -->

## Sesi saat dibutuhkan
<!-- Dibentuk COO atas kebutuhan tugas atau permintaan pengguna; diarsipkan (atas "ya") setelah [Diterima]. -->
| Agent | Tugas | Session id | Name | cwd |
|---|---|---|---|---|
