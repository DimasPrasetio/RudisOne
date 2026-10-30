---
mode: A|B
mode_mesin: A|B|ragu
override: -
dikonfirmasi: YYYY-MM-DD "kutipan persetujuan pengguna di chat COO"
backend: go|node|php|java|dotnet|python|lain|-
constitution: tipis|as-is
artefak: root|handoff
baseline: -
cakupan: .
---
# Kartu proyek — <nama proyek>

Letak: `.rudisone/kartu-proyek.md` di root repo proyek, di-commit. Bila repo klien melarang berkas tambahan:
`~/Documents/Neuron/ai-agent/RudisOne/handoff/kartu/<nama-folder-proyek>.md` (per device).

Frontmatter dibaca mesin (`bin/cek-konsistensi.sh --proyek <folder>`), satu `kunci: nilai` per baris:
- `mode` — keputusan pengguna: A (perakitan pustaka + RUDIS SDD) atau B (aturan proyek sendiri). Wajib A atau B.
- `mode_mesin` — keluaran `bin/perkakas.sh proyek <folder>` saat konfirmasi (A, B, atau ragu).
- `override` — alasan bila `mode` berbeda dari `mode_mesin` (termasuk saat mesin `ragu`); `-` bila sama.
- `dikonfirmasi` — tanggal + kutipan persis persetujuan pengguna.
- `backend` — bahasa backend. Perakitan pustaka saat ini hanya Go: NestJS/Express = B kecuali pengguna memutuskan lain.
- `constitution` — `tipis` (merujuk standar, Mode A) atau `as-is` (aturan proyek apa adanya + garis bawah keamanan).
- `artefak` — `root` (artefak SDD di repo proyek) atau `handoff` (di `handoff/<ID>/` RudisOne).
- `baseline` — sha checkpoint gerbang mutu (temuan baru dihitung sejak sha ini), atau `-`.
- `cakupan` — `.` (seluruh repo) atau daftar subfolder app dipisah koma, mis. `apps/api, apps/web`.

## Bukti deteksi
Salinan keluaran `bin/perkakas.sh proyek <folder>` saat konfirmasi (baris `mode-mesin`, `backend`, `bukti:`):
```
<tempel di sini>
```

## Letak artefak
- Proyek standar rudis-monorepo: cukup rujuk `.claude/rules/monorepo.md` (pemilik aturan), jangan disalin di sini.
- `specs/<NNN>-<slug>/`, `docs/brd/`, `docs/revamp/`, `docs/upgrades/` — di-commit.
- `docs/trace-reports/`, `docs/test-reports/` — **wajib** di-gitignore (bisa memuat data hasil penelusuran).
- `.rudis/` — milik RUDIS SDD; jangan diubah tangan.
- `artefak: handoff` → semuanya di `handoff/<ID>/`, tidak ada yang ditulis ke repo klien.

## Profil data
Hanya alias dev/snapshot, mis. `dev-lokal`, `snapshot-2026-10`. Data production hanya lewat Head of IT Operations.
Jangan pernah menulis path `.env`, host, user, atau password di kartu ini.

## Riwayat mode
Mode berubah hanya lewat tugas migrasi eksplisit yang disetujui pengguna.

| Tanggal | Dari → ke | Tugas | Alasan / kutipan persetujuan |
|---|---|---|---|
| YYYY-MM-DD | — → A | T-YYYYMMDD-n | konfirmasi awal |
