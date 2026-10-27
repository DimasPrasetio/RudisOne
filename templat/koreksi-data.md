# Koreksi data <YYYYMMDD>-<topik>

Head of IT Operations · Aplikasi/DB: <app>/<db> · Insiden terkait: <id/path atau "-"> · Tingkat: <SEV>

## Alasan & bukti
- Sumber temuan: <…>
- Bukti (kueri read-only + hasil ringkas, tanpa data pribadi berlebih): <…>
- Akar masalah: <bug / input / migrasi / belum diketahui>

## Cakupan
- Tabel & kunci baris: <…>
- Jumlah baris yang diharapkan berubah: <n>
- Menyangkut uang/jurnal? <ya → entri pembalik/penyesuaian, ditinjau Financial Controller | tidak>
- Jalur dipilih: <fitur/API aplikasi | SQL langsung> — alasan: <…>

## Skrip
```sql
-- satu transaksi; WHERE berbasis kunci primer; cek jumlah baris sebelum COMMIT
START TRANSACTION;
-- …
-- SELECT ROW_COUNT(); / bandingkan dengan <n>, ROLLBACK bila berbeda
COMMIT;
```

## Rollback
```sql
-- kembalikan dari backup / skrip pembalik
```

## Tinjauan & persetujuan
- Ditinjau oleh: <Business Systems Analyst / Financial Controller> — <catatan>
- Persetujuan pengguna (kutipan persis): "<…>" — <waktu>

## Eksekusi & verifikasi
- Backup: `<path di server>` (<ukuran>, terbaca: ya/tidak)
- Waktu jalan (WIB): <…> · baris berubah: <n>
- Sebelum → sesudah: <ringkas>
- Cek di aplikasi: <…>
