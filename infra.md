# Infrastruktur — prosedur

Pemilik: System Administrator. Tanpa rahasia dan **tanpa fakta server** — file ini prosedur generik yang berlaku
untuk server mana pun. Fakta per device ada di luar repo:

| Apa | Di mana |
|---|---|
| Server (alias, Host ssh, playbook), aplikasi deploy, MCP DNS, domain, owner GitHub | `konfigurasi/server.json` — baca lewat `bin/konfig.sh` (`cek`, `host`, `playbook`, `get <jalur>`) |
| Fakta temuan bertanggal (kapasitas, versi OS, zona waktu, sertifikat, catatan insiden) | `konfigurasi/infra.md` (dibuat dari `templat/infra.md`) |
| Konvensi server (golden rules, App registry, resep menambah app) | playbook di server itu sendiri (`bin/konfig.sh playbook`) — sumber kebenaran, jangan disalin ke sini |

Keduanya per device dan tidak di-commit. Belum ada / kurang? Ikuti `penyedia.md` › Konfigurasi server — jangan
menebak host, path, atau domain. Penyedia mana memegang apa: `penyedia.md`; batas kewenangan per aksi:
`bin/kebijakan.sh tampil`.

## Server deploy
- Akses: `ssh <ssh_host>` (entri `Host` di `~/.ssh/config` tiap device; kunci SSH tidak pernah di repo ini).
- Sebelum deploy, menambah app, atau mengubah infra: baca playbook server bila dikonfigurasi (read-only). File
  playbook biasanya milik root — mengubahnya butuh `sudo` (aksi berisiko, jenjang 3).
- Kondisi terkini (app, image, health, `/readyz`, sisa hari SSL, disk/RAM): `bin/server-cek.sh [alias]`.
- Server tidak pernah build image: image dibangun CI dan hanya di-pull (standar `rudis-monorepo`).
- `/etc/letsencrypt` dan log certbot umumnya butuh `sudo`; masa berlaku sertifikat terbaca via `openssl s_client`
  (dipakai `bin/server-cek.sh`).

## Alur rilis sebuah app terdaftar
1. Push branch utama repo app — hanya atas permintaan pengguna.
2. `bin/rilis-cek.sh <owner/repo> <sha>` sampai "SIAP DEPLOY" (CI hijau dan workflow rilis menerbitkan image
   `<registry>/<owner>/<app>:<sha penuh>`).
3. Deploy: `ssh <ssh_host> 'cd <folder app> && ./deploy.sh <sha penuh>'` (backup DB → migrate → up → readyz).
   `<folder app>` = `aplikasi.<slug>.folder` di konfigurasi.
4. Verifikasi: `bin/pasca-deploy.sh <app> <sha> [alias]` harus "LOLOS" — termasuk uji lewat domain publik dengan
   header `Origin` seperti browser (curl polos bisa lolos walau browser ditolak CORS).
5. Rollback: `./deploy.sh <sha lama>` di folder yang sama; catat di laporan (`templat/laporan-deploy.md`).

App baru di server: runbook `templat/onboarding-app.md`, lalu daftarkan di konfigurasi (`aplikasi.<slug>`) —
pendaftaran untuk deploy jenjang 2 adalah keputusan pengguna.

## Domain & DNS
- Penyedia DNS dan MCP-nya: `dns.penyedia` / `dns.mcp_server` di konfigurasi; playbook per penyedia di `penyedia.md`.
- Sebelum mengubah record: daftar record domain itu, validasi zona yang akan dikirim; sesudahnya uji resolusi.

## Pelajaran operasional (berlaku umum)
- Setiap verifikasi domain wajib diuji seperti browser (`curl -H "Origin: https://<domain>"`), bukan hanya `curl` polos.
- `.env` production wajib memuat origin publik di daftar CORS sebelum domain dialihkan.
- Skrip data massal tidak dijalankan di jam operasional; uji dulu di salinan non-production.
