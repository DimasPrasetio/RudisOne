# Registri penyedia — aset & layanan pihak ketiga RudisOne

Pemilik: Head of IT Operations (memelihara) · keputusan menambah/mengganti penyedia: pengguna (pemilik perusahaan).
Aturan generik yang dibaca mesin — operasi baca/ubah per jenis penyedia — ada di `kebijakan-akses.json`; **fakta per
device** (host ssh, aplikasi deploy, MCP DNS, domain) ada di `konfigurasi/server.json` (git-ignored, dibaca
`bin/konfig.sh` dan hook kebijakan). File ini menjelaskannya untuk manusia dan berisi playbook per penyedia. Tanpa
rahasia, tanpa fakta server.

Agent bekerja per **kemampuan**, bukan per merek penyedia: "ubah DNS `api.<domain>`" → lihat di konfigurasi
penyedia mana yang memegang domain itu → pakai alat penyedia itu sesuai playbook-nya. Mengganti penyedia = mengubah
konfigurasi (+ adapter di `kebijakan-akses.json` bila jenisnya baru), bukan mengubah peran atau protokol.

## Kemampuan → penyedia
| Kemampuan | Sumber daya | Penyedia | Alat | Jabatan pemilik | Akun yang dipakai |
|---|---|---|---|---|---|
| Domain & DNS | `dns.domain` di konfigurasi | `dns.penyedia` di konfigurasi | MCP `dns.mcp_server` (harus punya adapter di `kebijakan-akses.json` › `adapter_mcp`) | Head of IT Operations · System Administrator | sesuai konfigurasi |
| Repositori kode | `github.owner_bawaan/*` dan repo app di konfigurasi | GitHub | CLI `gh`, `git` | Tech Lead (kode) · COO (repo baru, serah) | pribadi pemilik |
| CI & image rilis | GitHub Actions, GHCR | GitHub | `bin/rilis-cek.sh` (memakai `gh`) | COO · Head of IT Operations | pribadi pemilik |
| Server aplikasi | `server.<alias>` di konfigurasi | `server.<alias>.penyedia` | `ssh <ssh_host>`, `bin/server-cek.sh`, `bin/pasca-deploy.sh` | System Administrator | `server.<alias>.akun` |
| Repositori GitLab | — (belum ada proyek) | GitLab | CLI `glab` (aturan sudah ada di kebijakan) | Tech Lead | belum ada |

Aplikasi yang boleh di-deploy lewat jenjang 2 = `aplikasi` di konfigurasi. App lain di server tetap bisa di-deploy,
tetapi di jenjang 3 (selalu minta persetujuan) sampai pengguna mendaftarkannya. Tanpa konfigurasi, tidak ada host
ssh atau MCP DNS yang dikenali kebijakan: semua perintahnya jatuh ke alur izin biasa (selalu ditanya).

## Konfigurasi server (bila belum ada atau kurang)
Fakta server tidak pernah ditanam di peran, protokol, skill, atau templat — selalu ditanyakan ke pengguna sekali
lalu disimpan sebagai konfigurasi.
1. System Administrator / Head of IT Operations menjalankan `bin/konfig.sh cek` di awal setiap tugas server. Gagal
   (exit 3) → kirim `[Terhambat]` ke COO berisi daftar yang kurang dari keluaran perintah itu. Jangan menebak.
2. COO menanyakan pengguna **satu per satu**, masing-masing dengan rekomendasi (`AskUserQuestion`, gaya
   `rudis-grill-me`):
   - alias server dan nama `Host` ssh-nya — apakah kunci SSH dan entri `~/.ssh/config` sudah ada (pengguna sendiri
     yang menyiapkannya; agent boleh mengusulkan blok `Host`, tidak pernah mengubah `~/.ssh`);
   - apakah server punya playbook/runbook (path-nya) dan reverse proxy/DB apa yang dipakai;
   - penyedia DNS + server MCP-nya bila ada, dan domain yang dikelola;
   - owner GitHub bawaan untuk repo & image.
3. COO menulis `konfigurasi/server.json` mengikuti `konfigurasi/server.contoh.json`, dengan kutipan persetujuan
   pengguna di `diisi.persetujuan`. Mendaftarkan host = memperluas apa yang dikenali kebijakan, jadi ini keputusan
   delegasi pengguna.
4. System Administrator memverifikasi read-only (`ssh -o BatchMode=yes <ssh_host> true`, baca playbook bila ada,
   `bin/server-cek.sh`) dan menulis temuan bertanggal di `konfigurasi/infra.md` (dari `templat/infra.md`).
5. Menambah app ke `aplikasi` (deploy jenjang 2) adalah keputusan pengguna tersendiri, ditanyakan saat app itu
   pertama kali di-deploy.

## Batas kewenangan per penyedia (ringkas — aturan lengkap: `bin/kebijakan.sh tampil`)
| Penyedia | Jenjang 1 — baca, tanpa tanya | Jenjang 2 — rutin, disetujui sekali di COO | Jenjang 3 — selalu ke pemilik |
|---|---|---|---|
| MCP DNS (adapter `hostinger-api`) | operasi `*_list`, `*_get`, `*_validate`, `*-status`, `search` | `dns_records_update` tanpa overwrite, tipe A/AAAA/CNAME/TXT, bukan `@`/`www`/wildcard | hapus/reset/restore record, overwrite, MX/NS, operasi ubah lain |
| GitHub / GitLab | `run/pr/repo/release … list/view/checks/status`, `api` GET | `repo create <nama> --private` (oleh COO) | push, PR, merge, repo publik, hapus/ubah repo, secret, rilis |
| Server (ssh) | `uptime`, `df`, `docker ps/logs`, `systemctl status`, `journalctl`, `curl` GET, perkakas `bin/` baca | `cd ~/<app> && ./deploy.sh <sha penuh>` untuk app terdaftar, setelah `rilis-cek` SIAP ≤ 24 jam | restart, ubah config, `sudo`, tulis/hapus berkas, menulis data, perintah di luar daftar baca, membaca rahasia (`.env`, kunci) |

Akses per jabatan: kemampuan DNS, hosting, server, dan data production hanya untuk IT Operations; jabatan lain yang
memakainya selalu ditanya walau sekadar membaca (seperti karyawan yang meminjam kunci ruang server).

## Playbook per penyedia
### MCP DNS — adapter `hostinger-api` (bila `dns.mcp_server` = `hostinger-api`)
1. `search` → temukan nama operasi; perhatikan penanda `readOnly`/`destructive` di hasilnya.
2. Sebelum mengubah: `dns_records_list` domain itu, lalu `dns_records_validate` dengan zona yang akan dikirim.
3. Tambah subdomain: `dns_records_update` dengan `overwrite: false`, hanya nama baru (cek dulu di daftar record).
4. Sesudah mengubah: `dns_records_list` lagi + uji resolusi (`dig`/`curl`), catat di laporan; snapshot DNS tersedia
   untuk rollback (`dns_snapshots_list` → restore = jenjang 3).
### GitHub
- Status rilis: `bin/rilis-cek.sh <owner/repo> <sha>`; hasil SIAP DEPLOY tercatat di audit dan menjadi syarat deploy jenjang 2.
- Repo proyek baru: `gh repo create <owner>/<nama> --private` oleh COO setelah Persetujuan Rilis.
### Server (ssh)
- Konvensi server: playbook di server (`bin/konfig.sh playbook <alias>`) — sumber kebenaran di server; prosedur: `infra.md`.
- Deploy: `ssh <ssh_host> 'cd <folder app> && ./deploy.sh <sha penuh>'`, lalu `bin/pasca-deploy.sh <app> <sha>` wajib LOLOS.
### Menambah penyedia baru (mis. Cloudflare, GitLab, VPS lain)
1. Keputusan pemilik (lewat COO, penyelarasan persepsi).
2. Pasang alatnya (MCP resmi penyedia atau CLI-nya) dan login dengan akun yang disetujui.
3. Server ssh baru: tambah di `konfigurasi/server.json` › `server` (alur di atas). MCP baru: tambah adapter di
   `kebijakan-akses.json` › `adapter_mcp` (pola baca, pola jenjang 2 bila ada), lalu aktifkan lewat konfigurasi.
   CLI baru: entri di `kebijakan-akses.json` › `penyedia`.
4. Tulis playbook singkat di file ini; jalankan `node --test bin/` lalu `bin/kebijakan.sh uji` untuk contoh perintahnya.

## Akun dinas (tahap berikutnya — belum diterapkan)
Saat ini semua alat memakai kredensial pribadi pemilik di Mac ini, jadi pembatasan "hanya sesi RudisOne" adalah
aturan perusahaan, bukan pemisahan kunci. Perusahaan nyata memakai akun dinas yang bisa dicabut tanpa menyentuh akun
pemilik. Rencana: user server khusus RudisOne dengan hak terbatas, akun/token GitHub khusus, token API penyedia
khusus — masing-masing dicatat di kolom "Akun yang dipakai" di atas.
