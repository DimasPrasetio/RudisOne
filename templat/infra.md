# Fakta infrastruktur — <device>

Salin ke `konfigurasi/infra.md` (git-ignored, per device). Ditulis System Administrator dari pemeriksaan
read-only; setiap fakta bertanggal — cek ulang sebelum bertindak. Tanpa rahasia.

## Server <alias> (`bin/konfig.sh host <alias>`)
- Diperiksa: <YYYY-MM-DD>, oleh System Administrator (`bin/server-cek.sh <alias>`)
- Penyedia / OS / zona waktu: <…>
- Kapasitas: <vCPU>, RAM <…>, disk `/` <…>; pemakai memori terbesar: <…>
- Playbook: <path atau "tidak ada">
- Reverse proxy / sertifikat: <nginx + certbot …; masa berlaku sertifikat utama>

## Aplikasi
| App | Folder | Container | Port | Domain | Catatan |
|---|---|---|---|---|---|

## Domain & DNS
- Penyedia: <…> · domain yang dikelola: <…>

## Catatan bertanggal
- <YYYY-MM-DD>: <temuan / insiden / keputusan pengguna>
