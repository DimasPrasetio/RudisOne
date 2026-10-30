# Spesifikasi: <fitur/perubahan>

Business Systems Analyst · <YYYY-MM-DD> · Proyek: <path> · Mode: <A|B> · Jalur: <tracer|redesign|perbarui-spec|tanpa-sdd|…>
<!-- Jalur & kriteria jenis: skill `rudis-sdd` › Jalur dua sumbu. Spesifikasi berisi perilaku & kontrak, bukan detail implementasi. -->

## Jenis perubahan
- Jenis: <bug | ubah perilaku | kapabilitas baru> — alasan (kriteria tertulis): <…>
- Cakupan: <berkas/modul yang disentuh; ≥2 modul atau > ±5 berkas → re-route> · Spec/peta area: <specs/… | docs/brd/… | tidak ada>

## Perilaku (bug / ubah perilaku; pola Kiro Bugfix)
- **Current behavior** — yang terjadi kini, dengan bukti (laporan tracer, langkah reproduksi, tes characterization): <…>
- **Expected behavior** — yang seharusnya, dengan sumber yang bisa ditunjuk (spec, brd, dokumen, keputusan pengguna); tanpa sumber → pertanyaan terbuka, jangan ditebak: <…>
- **Unchanged behavior** — perilaku di sekitarnya yang wajib tetap sama (dijaga tes regresi/characterization): <…>

## Ringkasan solusi
<pendekatan + alasan; alternatif yang ditolak singkat>

## Kebutuhan
- Fungsional: <…>
- Non-fungsional: <performa, keamanan, aksesibilitas>

## Desain
- Data/tabel: <perubahan skema atau "tidak ada">
- API: `<METHOD> /path` — request, respons, galat (atau "tidak berubah")
- Alur/state: <diagram Mermaid bila perlu>
- Aturan bisnis & validasi: <…>

## Analisis dampak
| Area | File/modul | Perubahan | Risiko regresi |
|---|---|---|---|

## Rencana implementasi
1. <langkah> — tes: <…>

## Gerbang mutu
- Baseline: <sha checkpoint + alat, atau "tidak ada (Mode A, bersih)"> · alat tidak terpasang: <… → "tidak terverifikasi">
- Dependensi baru/diubah: <… atau "tidak ada"> · CVE wajib (Critical/High terjangkau ∪ KEV; npm: Critical ∪ KEV): <…>

## Pertanyaan terbuka (keputusan pengguna)
- <…>
