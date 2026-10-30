# Constitution — <proyek> (Mode B · as-is)
<!-- Seed untuk /rudis.constitution, sekali per proyek, SESUDAH /rudis.brd ter-scope (skill `rudis-sdd` › Langkah per fase).
     Diturunkan dari docs/brd/, kode, dan aturan proyek/klien yang ada — BUKAN dari rudis-monorepo dan bukan ringkasan repo.
     Tiga bagian, tipis: aturan + rujukan berkas contoh. Konvensi yang tidak bisa ditunjuk contohnya jangan ditulis. -->

Status: **Draft** — berlaku setelah disahkan <pengguna / lead klien> · Versi: 0.1.0 · Kartu: `.rudisone/kartu-proyek.md` (mode B)
Sumber: `docs/brd/<modul>.md` · aturan klien <path/dokumen> · baseline gerbang mutu <sha + alat>

## 1. Konvensi as-is (ikuti; mimicry)
| # | Aturan (MUST/SHOULD) | Contoh / pemilik |
|---|---|---|
| K1 | <mis. MUST: validasi input di FormRequest, bukan di controller> | `<app/Http/Requests/StoreOrderRequest.php>` |
| K2 | <mis. MUST: query lewat repository; tanpa SQL mentah di controller> | `<app/Repositories/OrderRepository.php>` |
| K3 | <penamaan, struktur folder, pola tes yang ada> | `<path contoh>` |

## 2. Garis bawah (tidak ikut as-is; berlaku untuk kode baru dan kode yang disentuh)
1. **Keamanan** — MUST: input divalidasi, query terparameter, otorisasi diperiksa; pola tidak aman yang ada tidak ditiru.
2. **Rahasia** — MUST: tanpa rahasia di repo/log; agent tidak membaca `.env`/config untuk kredensial; rahasia baru = BLOCKER.
3. **Integritas data** — MUST: perubahan skema lewat migrasi yang bisa dibalik; tanpa tulis data production oleh agent.
4. **Akses data** — MUST: tracer & tes hanya DB dev/snapshot; data prod lewat Head of IT Operations (read-only, tercatat, agregat/masking).
5. **Tidak memperburuk** — MUST: temuan baru di kode tersentuh (sejak baseline) = gagal; tes hijau→merah = gagal.
   Perbaikan struktur / utang lama **hanya** lewat tugas eksplisit (bukan "sekalian").
6. **Alur kerja** — MUST: git lewat peran RudisOne dan `bin/rudis-git.sh checkpoint <ID>` / `… rollback` (tanpa stash/`reset --hard`); push hanya atas permintaan pengguna.

## 3. Known Gaps (penyimpangan yang sadar diterima)
| # | Penyimpangan dari praktik baik | Alasan diterima | Tugas perbaikan kelak |
|---|---|---|---|
| G1 | <mis. tanpa tes otomatis di modul billing> | <mis. legacy; characterization dulu sebelum disentuh> | <ID / "belum dijadwalkan"> |
| G2 | <mis. 214 temuan PHPStan level 5 di baseline> | <utang lama; gerbang = temuan baru> | <…> |

## Prioritas bila bertentangan
Garis bawah (§2) > aturan klien > konvensi as-is (§1) > default command RUDIS. Known Gaps tidak membatalkan §2 untuk kode baru.

## Pengesahan & amendemen
- Disahkan: <YYYY-MM-DD> — "<kutipan persis pengguna / lead klien>" (lewat COO). Sebelum itu status tetap Draft.
- Semver: MAJOR = aturan dihapus/dibalik; MINOR = aturan/gap baru; PATCH = rujukan contoh. Gap yang ditutup dihapus dari §3.
