# Tabel perakitan — <ID> · <proyek / fitur>
<!-- Gerbang Persetujuan Rancangan (skill rudis-sdlc). Hanya proyek Mode A (kartu proyek `.rudisone/kartu-proyek.md`).
     Disusun Business Systems Analyst dari CATALOG.md pustaka (bukan dari kode modul), diperiksa Tech Lead.
     Aturan keputusan & urutan pasang: references/module-library.md skill rudis-monorepo — jangan disalin.
     Jalur per keputusan: skill `rudis-sdd` › Jalur dua sumbu (tabel yang sama untuk Mode A dan B).
     Draf di handoff/<ID>/; versi final masuk analysis/ proyek lewat branch tugas. -->

Pustaka: `~/Documents/Neuron/ai-agent/rudis-modules` @ <sha> · Kernel proyek: <n> · Perkakas: <bin/perkakas.sh versi> · Mode: A

## Kemampuan → keputusan
| # | Kemampuan (bahasa pengguna) | Modul pustaka / kustom | Keputusan | Jalur | Spesifikasi | Port yang disambung / penyesuaian | Alasan |
|---|---|---|---|---|---|---|---|
| 1 | Staf masuk dengan akun | `auth` | pasang | `pasang` | — | `UserStore=users` | ada di katalog |
| 2 | Diskon per pelanggan | `pos` | pasang + sesuaikan | `pasang+sesuaikan` | `specs/002-diskon-pelanggan/` | `custom_discount.go` | katalog tanpa aturan diskon |
| 3 | <…> | — | bangun | `siklus-penuh` | `specs/003-<slug>/` | — | belum ada di katalog; dibangun setara standar pustaka |
| 4 | <ubah perilaku modul kustom yang ada> | `<modul kustom>` | ubah modul kustom | `perbarui-spec` / `redesign` | `specs/00N-<slug>/` (ber-spec) / `docs/brd/<modul>.md` (tanpa spec) | <bagian yang berubah> | ber-spec → spec diperbarui; dibuat sebelum SDD → redesign fallback brd |

Keputusan: **pasang** (tanpa SDD) · **pasang + sesuaikan** (SDD adaptasi; sebut yang disesuaikan) · **bangun** (siklus penuh) ·
**ubah modul kustom** (ber-spec → perbarui spec; tanpa spec → `/rudis.redesign` dengan fallback `docs/brd/`).
Jalur = nilai `jalur_awal` di register. Spesifikasi: nomor `<NNN>` unik per proyek (dari register, `--number N`).
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
