# Kantor di Windows — sebab "kursi kosong" dan "mati / tidak update" (T-20261030-2.1, jebakan #15)

Device: Windows 11 Pro 10.0.26200 · Claude Desktop 4.4212 (paket MSIX `Claude_pzs8sxrjxfjjc`) · Claude Code CLI 2.1.302 ·
Node 24.18 · 2026-10-30. Gejala menurut pengguna: kursi/peran kosong; tampilan tidak update / Kantor mati.

## Sebab yang terbukti
| # | Sebab | Bukti | Perbaikan |
|---|---|---|---|
| K1 | Sesi COO di VS Code/CLI (entrypoint `claude-vscode`) hanya punya `ai-title`, tanpa judul sidebar & tanpa `agent-setting` → Kantor melewatinya (`if (!title) continue`); semua subagent-nya (Tech Lead, peninjau) ikut hilang karena induknya tidak dikenal | transkrip `~/.claude/projects/d--PENGEMBANGAN-RUDIS/a550846e….jsonl` (T-20261030-1): `ai-title` ×25, tanpa `custom-title`; subagent `rudis-tech-lead` & `rudis-software-engineer` di `…/subagents/*.meta.json` | `/rudisone` (atau Skill `rudisone`) menandai sesi COO; `ai-title` dipakai sebagai judul cadangan |
| K2 | Regex peran worktree hanya mengenal `/` → sesi Tech Lead di worktree `C:\…\.claude\worktrees\r2-lead-…` dianggap COO (mewarisi `"agent": "coo"` dari settings repo) | `/state` Kantor saat tugas ini berjalan: kursi COO berisi "Tech Lead · RudisOne @…\worktrees\r2-lead-rudisone-9fd64d" | regex `[\\/]`; nomor tim dari `r<n>-` |
| K3 | Subagent tim dipanggil COO mulai di folder COO (`d:\PENGEMBANGAN-RUDIS`) → proyek salah ("PENGEMBANGAN-RUDIS"), kursi tim salah | `cwd` di transkrip subagent Tech Lead: 530 baris `d:\PENGEMBANGAN-RUDIS`, 34 baris worktree | proyek dari ID tugas di brief → folder di register, lalu worktree yang pernah dipakai |
| K4 | Judul TEAM.md berketerangan (`· RudisOne (platform)`, `· x — menunggu …`) tidak cocok dengan nama folder; `Tim 4` tidak punya kursi | TEAM.md device ini; `/state.tim` berisi 8 entri ganda | keterangan dibuang; nomor tim di luar 1–3 diabaikan |
| K5 | Claude Desktop MSIX memvirtualisasi `%APPDATA%\Claude` ke `%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude`; proses di luar paket (Kantor dari VS Code/terminal/WMI) tidak melihat metadata sesi Desktop | `Get-AppxPackage Claude`; `claude-code-sessions` ada di LocalCache; `/health` Kantor berinduk WMI: "sesi Desktop: TIDAK terbaca" sebelum perbaikan | `bin/sesi.mjs folderDesktop` memeriksa letak paket bila letak biasa tidak ada |
| K6 | Kantor yang dinyalakan dari sesi Claude ikut job object proses Claude (`detached` Node tidak memakai `CREATE_BREAKAWAY_FROM_JOB`) → mati saat job ditutup | `IsProcessInJob`: server 17708 "DALAM job" (rantai claude.exe). Simulasi job `KILL_ON_JOB_CLOSE`: cara lama → port 7496 **MATI**; cara WMI → port 7495 **HIDUP** | Windows: `bin/kantor.mjs` menyalakan server lewat WMI `Win32_Process.Create` (berinduk WmiPrvSE; tetap hidup setelah WmiPrvSE berhenti — diamati 14 menit); cadangan `spawn` bila WMI gagal; `RUDISONE_KANTOR_TANPA_WMI=1` memaksa cara lama |
| K7 | Satu galat di siklus pembaruan (mis. kursi di luar denah) mematikan proses diam-diam; log ditimpa saat dinyalakan ulang sehingga sebabnya hilang | kode lama: `byAgent.get(k).push` tanpa penjaga, `tick` tanpa try/catch, log `fs.openSync(LOG, "w")` | `tick` & `uncaughtException` dicatat lalu server tetap melayani; log ditambahkan (dipangkas > 1 MB); galat terakhir di `/health` |

Sebab Kantor mati dua kali di device ini sebelum perbaikan tidak bisa dipastikan lagi (log lama sudah tertimpa); K6 dan K7
adalah dua jalur yang terbukti bisa mematikannya, dan keduanya ditutup.

**Batas jalur WMI:** server yang dinyalakan WMI tidak mewarisi env sesi — hanya port dan log yang diteruskan (argumen).
Override uji (`RUDISONE_ROOT`, `RUDISONE_KANTOR_*`, `RUDISONE_SESI`, `RUDISONE_CLAUDE_BIN`) dan PATH khusus sesi tidak
sampai; PATH yang dipakai PATH pengguna dari registry (`claude agents` butuh `claude` di sana — `/health` › sumber sesi
CLI menunjukkannya). Perlu override → `RUDISONE_KANTOR_TANPA_WMI=1` (cara lama, ikut job) atau jalankan `kantor/server.mjs`
langsung.

## Uji otomatis
- `kantor/windows.test.mjs` (semua OS): COO VS Code + ai-title, Tech Lead sebagai subagent (folder `D:\` di register),
  peninjau selesai, worktree berpath `\`, TEAM.md/register/transkrip ber-CRLF, Tim 4, `/health`, data rusak. Terhadap
  kode `main` lama: 5 dari 8 gagal; kode baru: 8/8 lulus.
- `bin/sesi.test.mjs`: `folderDesktop` letak MSIX; `bin/portabel.test.mjs`: `/health` baris pertama + sumber data.

## Uji manual (Windows)
1. `node bin\kantor.mjs --tanpa-browser` → `curl http://127.0.0.1:7421/health`: baris `ok <versi>`, `versi:`, `sumber
   transkrip/TEAM.md/register/sesi Desktop/sesi CLI: terbaca …`, `galat terakhir: -`.
2. Proses server berinduk `WmiPrvSE.exe` (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`), bukan claude.exe.
3. Tutup/arsipkan sesi yang menyalakan Kantor → `/health` tetap menjawab.
4. Halaman: kursi COO terisi saat COO bekerja dari VS Code; Tech Lead subagent tampil di kursi tim proyeknya
   ("subagent dari COO"); sesi Tech Lead di worktree tidak duduk di kursi COO.
