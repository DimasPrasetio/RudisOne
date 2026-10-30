# TEAM — buku alamat sesi tim (per device; ditulis COO pada panggilan /rudisone)
<!-- Format: templat/team.md. Nama sesi dibatasi 24 karakter oleh aplikasi, jadi beberapa nama divisi tetap disingkat. -->
<!-- FIXTURE SUITE UJI: session id palsu; meniru organisasi per 2026-10-30. -->

Dibangun: 2026-10-29 (sebagian — lihat "Belum terbentuk")

## COO
| Agent | Session id | Name | cwd |
|---|---|---|---|
| COO | `self` | — | `~/Documents/Neuron/ai-agent/RudisOne` |

## Corporate Strategy (staf COO)
| Agent | Session id | Name | cwd |
|---|---|---|---|
| Head of Strategy | `local_00000000-0000-4000-8000-000000000001` | `rudis-head-of-strategy` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-strategy` |
| Financial Controller | — | `rudis-fin-controller` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/financial-controller` |
| Research Analyst | `local_00000000-0000-4000-8000-000000000003` | `rudis-research-analyst` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/research-analyst` |
| HR Business Partner | `local_00000000-0000-4000-8000-000000000004` | `rudis-hr-bp` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/hr-business-partner` |

## Engineering · layanan bersama
| Agent | Peran | Session id | Name | cwd |
|---|---|---|---|---|
| Program Manager | manajemen program lintas proyek | `local_00000000-0000-4000-8000-000000000005` | `rudis-program-manager` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/program-manager` |
| Technical Writer | dokumentasi | `local_00000000-0000-4000-8000-000000000006` | `rudis-technical-writer` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/technical-writer` |

## Engineering · Tim 1 · rudis-monorepo
Folder proyek: `~/Documents/Neuron/ai-agent/rudis-monorepo` · branch utama: `main` · tim platform (Jalur Platform)

| Agent | Peran | Session id | Name | Branch / worktree |
|---|---|---|---|---|
| Tech Lead | leader | `local_00000000-0000-4000-8000-000000000011` | `r1-lead-rudis-monorepo` | worktree integrasi (branch per tugas `rudis/<ID>`) |
| Business Systems Analyst | anggota | `local_00000000-0000-4000-8000-000000000012` | `r1-bsa-rudis-monorepo` | checkout utama (hanya membaca) |
| Software Engineer #1 | anggota | `local_00000000-0000-4000-8000-000000000013` | `r1-se1-rudis-monorepo` | worktree sendiri |
| Software Engineer #2 | anggota | — | `r1-se2-rudis-monorepo` | — |

## Engineering · Tim 2 · RudisOne
Folder proyek: `~/Documents/Neuron/ai-agent/RudisOne` · branch utama: `main` · anggota engineering sebagai subagent (T-20261030-2)

| Agent | Peran | Session id | Name | Branch / worktree |
|---|---|---|---|---|
| Tech Lead | leader | `local_00000000-0000-4000-8000-000000000021` | `r2-lead-rudisone` | worktree integrasi (branch per tugas `rudis/<ID>`) |

## IT Operations
| Agent | Peran | Session id | Name | cwd |
|---|---|---|---|---|
| Head of IT Operations | leader | `local_00000000-0000-4000-8000-000000000031` | `rudis-head-of-it-ops` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations` |
| System Administrator | SysAdmin | `local_00000000-0000-4000-8000-000000000032` | `rudis-sysadmin` | `~/Documents/Neuron/ai-agent/RudisOne/ruang/system-administrator` |

## Belum terbentuk (2026-10-29)
- Financial Controller, Software Engineer #2 — ditolak pengaman auto mode; dicoba ulang pada panggilan berikutnya.
