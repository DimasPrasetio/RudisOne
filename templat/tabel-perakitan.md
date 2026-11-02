# Tabel perakitan — <ID> · <proyek / fitur>
<!-- Gerbang Persetujuan Rancangan (skill rudis-sdlc). Hanya proyek Mode A (kartu proyek `.rudisone/kartu-proyek.md`).
     Disusun Business Systems Analyst dari CATALOG.md pustaka (bukan dari kode modul), diperiksa Tech Lead.
     Aturan keputusan & urutan pasang: references/module-library.md skill rudis-monorepo — jangan disalin.
     Jalur per keputusan: skill `rudis-sdd` › Jalur dua sumbu (tabel yang sama untuk Mode A dan B).
     Draf di handoff/<ID>/; versi final masuk analysis/ proyek lewat branch tugas. -->

Pustaka: `~/Documents/Neuron/ai-agent/rudis-modules` @ <sha> · Kernel proyek: <n> · Perkakas: <bin/perkakas.sh versi> · Mode: A

## Kemampuan → keputusan
| # | Kemampuan (bahasa pengguna) | Modul pustaka / kustom | Keputusan | Jalur | Tingkat SDD | Spesifikasi | Port yang disambung / penyesuaian | Pemilik folder | Alasan |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Staf masuk dengan akun | `auth` | pasang | `pasang` | 0 | — | `UserStore=users` | TL (pasang) | ada di katalog |
| 2 | Diskon per pelanggan | `pos` | pasang + sesuaikan | `pasang+sesuaikan` | 2 — hitungan uang | `specs/002-diskon-pelanggan/` | `custom_discount.go` | SE#1 | katalog tanpa aturan diskon |
| 3 | Daftar pemasok | `pemasok` (kustom) | bangun | `siklus-penuh` | 1 | spek ringkas di bawah | — | SE#2 (api) · SE#3 (web) | belum ada di katalog; CRUD tanpa aturan berisiko |
| 4 | <ubah perilaku modul kustom yang ada> | `<modul kustom>` | ubah modul kustom | `perbarui-spec` / `redesign` | 1 / 2 | `specs/00N-<slug>/` (ber-spec) / `docs/brd/<modul>.md` (tanpa spec) | <bagian yang berubah> | <…> | ber-spec → spec diperbarui; dibuat sebelum SDD → redesign fallback brd |

Keputusan: **pasang** (tanpa SDD) · **pasang + sesuaikan** (SDD adaptasi; sebut yang disesuaikan) · **bangun** (siklus penuh) ·
**ubah modul kustom** (ber-spec → perbarui spec; tanpa spec → `/rudis.redesign` dengan fallback `docs/brd/`).
Jalur = nilai `jalur_awal` di register. **Tingkat SDD** (skill `rudis-sdd` › Tingkat SDD): 0 = tanpa SDD · 1 = spek ringkas
di tabel ini, tanpa command `/rudis.*` · 2 = siklus SDD penuh — tulis aturan berisiko yang memicunya. Spesifikasi tingkat 2:
nomor `<NNN>` unik per proyek, dialokasikan **di tabel ini** sebelum pekerjaan dibagi (dari register, `--number N`).
**Pemilik folder** = satu penulis per folder modul (`api` dan `web` modul yang sama boleh dua pemilik, bekerja bersamaan
terhadap kontrak API di spek); berkas bersama (registry, `sqlc.yaml`, `app/modules.ts`, lockfile) milik TL.

### Spek ringkas (baris tingkat 1) — satu blok per modul kustom
- **<modul>** · tabel milik: `<tbl>` · izin: `<modul>.read`, `<modul>.manage`
- Aturan: <R1 …> (hanya yang diminta pengguna; tanpa kerja tambahan)
- Kontrak API: `GET/POST /api/v1/<modul>/…` — field + kode galat penting
- Layar: <daftar, formulir, …> · Kriteria selesai yang dilayani: <nomor dari pemahaman bersama>
Bug dan upgrade tidak lewat tabel ini — jalurnya sama dengan Mode B (tracer; `/rudis.upgrade`, modul pustaka `module.mjs upgrade`).

## Preset & kit UI
- Preset tema: <bingkai-navy / tanpa preset> — dari brief desain Desain
- Kit UI: <ui-core, ui-data, …>

## Urutan pemasangan (perintah `module.mjs`)
```bash
node ~/Documents/Neuron/ai-agent/rudis-modules/scripts/module.mjs <…>
```

## Kandidat promote ke pustaka (nanti, Jalur Platform)
- <modul kustom yang generik> — <alasan>

## Persetujuan Rancangan
- Disetujui pengguna: YYYY-MM-DD HH:MM — "<kutipan persis>" · perubahan dari usulan: <…>
