# TEAM — buku alamat sesi tim (per device; ditulis COO pada panggilan /rudisone)
<!-- Ditulis COO dari hasil start_session. Kantor & agent membaca file ini sebagai buku
     alamat. Satu baris per sesi; kolom Agent memakai jabatan persis (mis. Software Engineer #2). Judul bagian
     tim engineering harus berpola "## Engineering · Tim <n> · <proyek>" — Kantor memakai nomornya. -->

Dibangun: YYYY-MM-DD
<!-- Nama sesi berawalan `rudis-` (divisi tetap) dan `r<n>-` (tim engineering) agar tidak bentrok dengan
     sistem agent lain di device yang sama. -->

## COO
| Agent | Session id | Name | cwd |
|---|---|---|---|
| COO | `local_…` | — | `~/Documents/Neuron/ai-agent/RudisOne` |

## Corporate Strategy (staf COO)
| Agent | Session id | Name | cwd |
|---|---|---|---|
| Head of Strategy | `local_…` | `rudis-head-of-strategy` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-strategy` |
| Financial Controller | `local_…` | `rudis-financial-controller` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/financial-controller` |
| Research Analyst | `local_…` | `rudis-research-analyst` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/research-analyst` |
| HR Business Partner | `local_…` | `rudis-hr-business-partner` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/hr-business-partner` |

## Engineering · layanan bersama
| Agent | Peran | Session id | Name | cwd |
|---|---|---|---|---|
| Program Manager | manajemen program lintas proyek | `local_…` | `rudis-program-manager` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/program-manager` |
| Technical Writer | dokumentasi | `local_…` | `rudis-technical-writer` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/technical-writer` |

## Engineering · Tim 1 · <proyek>
Folder proyek: `<path absolut>` · branch utama: `<main>`

| Agent | Peran | Session id | Name | Branch / worktree |
|---|---|---|---|---|
| Tech Lead | leader | `local_…` | `r1-lead-<proyek>` | worktree integrasi `<path>` (branch per tugas `rudis/<ID>`) |
| Business Systems Analyst | anggota | `local_…` | `r1-bsa-<proyek>` | checkout utama (hanya membaca) |
| Software Engineer #1 | anggota | `local_…` | `r1-se1-<proyek>` | `<branch>` · `<path worktree>` |
| Software Engineer #2 | anggota | `local_…` | `r1-se2-<proyek>` | `<branch>` · `<path worktree>` |
<!-- Tim 2 dan 3: bagian
     yang sama dengan nomor tim dan proyeknya sendiri, dibuat saat ada proyek kedua/ketiga. -->

## IT Operations
| Agent | Peran | Session id | Name | cwd |
|---|---|---|---|---|
| Head of IT Operations | leader | `local_…` | `rudis-head-of-it-operations` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations` |
| System Administrator | SysAdmin | `local_…` | `rudis-system-administrator` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/system-administrator` |
