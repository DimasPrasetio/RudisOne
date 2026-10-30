# Tabel perakitan — <ID> · <proyek / fitur>
<!-- Gerbang Persetujuan Rancangan (skill rudis-sdlc). Disusun Business Systems Analyst dari CATALOG.md pustaka (bukan dari kode modul), diperiksa Tech Lead.
     Aturan keputusan & urutan pasang: references/module-library.md skill rudis-monorepo — jangan disalin.
     Draf di handoff/<ID>/; versi final masuk analysis/ proyek lewat branch tugas. -->

Pustaka: `~/Documents/Neuron/ai-agent/rudis-modules` @ <sha> · Kernel proyek: <n> · Perkakas: <bin/perkakas.sh versi>

## Kemampuan → keputusan
| # | Kemampuan (bahasa pengguna) | Modul pustaka | Keputusan | Port yang disambung / penyesuaian | Alasan |
|---|---|---|---|---|---|
| 1 | Staf masuk dengan akun | `auth` | pasang | `UserStore=users` | ada di katalog |
| 2 | <…> | — | bangun | — | belum ada di katalog; dibangun setara standar pustaka |

Keputusan: **pasang** · **pasang + sesuaikan** (sebut yang disesuaikan) · **bangun**.

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
