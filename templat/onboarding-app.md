# Pendaftaran app di server deploy — <ID> · <slug>
<!-- Gerbang Persetujuan Penerapan (sdlc.md). Disusun Head of IT Operations, dijalankan System Administrator HANYA setelah pengguna menyetujui setiap
     langkah yang mengubah server (kutipan persetujuan di brief). Cara teknis tiap langkah: references/
     docker-deployment.md skill + knowledge/DEPLOYMENT.md proyek — runbook ini hanya urutan, pemilik, dan bukti.
     Jangan menulis rahasia (password, token, isi .env) di sini maupun di laporan. -->

App: <slug> · Port: <port> · Domain: <domain> · Image: ghcr.io/<owner>/<repo> · Sha rilis: <sha>

| # | Langkah | Mengubah server? | Persetujuan pengguna | Bukti (tanpa rahasia) |
|---|---|---|---|---|
| 1 | Daftarkan app & port di App registry playbook server (bila server memakai playbook) | ya | "<kutipan>" | diff baris registry |
| 2 | Database `<slug>_db` + user `<slug>_user@'172.%'` | ya | "<kutipan>" | `SHOW GRANTS` (tanpa password) |
| 3 | Folder `~/<slug>/`: compose prod, `deploy.sh`, `.env` (`chmod 600`) | ya | "<kutipan>" | `ls -l`, daftar kunci `.env` disamarkan |
| 4 | Akses GHCR (token `read:packages` di server atau paket publik) | ya | "<kutipan>" | `docker pull` sha berhasil |
| 5 | Situs nginx `<slug>` (`server_name`, bukan `default_server`) | ya | "<kutipan>" | `nginx -t` |
| 6 | DNS A record → server, sudah resolve | ya (DNS) | "<kutipan>" | `dig +short <domain>` |
| 7 | TLS `certbot --nginx -d <domain>` | ya | "<kutipan>" | sisa hari sertifikat |
| 8 | Deploy pertama `./deploy.sh <sha>` (`SKIP_BACKUP=1` hanya bila DB kosong) | ya | "<kutipan>" | keluaran utuh `bin/pasca-deploy.sh <slug> <sha>` |
| 9 | Daftarkan app di `konfigurasi/server.json` › `aplikasi` (atas keputusan pengguna) + catat di `konfigurasi/infra.md` (app, port, domain) | tidak (lokal) | "<kutipan>" | diff |

Rollback per langkah: <…> · Risiko ke app lain: <…>
