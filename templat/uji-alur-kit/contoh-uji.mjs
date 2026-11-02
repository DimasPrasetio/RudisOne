// Contoh skrip uji per-aplikasi yang TIPIS di atas kit. Salin ke handoff/<ID>/uji-alur/uji.mjs, ubah bagian "KHAS APLIKASI",
// jalankan `node uji.mjs` dari handoff/<ID>/uji-alur/ (kit.mjs + periksa.mjs di folder yang sama). Skrip ini menjalankan
// uji dalam satu proses. MODE (opsi `mode`, atau env UJI_MODE): "cepat" = bawaan di gerbang akhir (HP saja, hanya TUGAS INTI dari
// alur-tugas.md, kasus gagal utama, tangkapan di langkah kunci — target ≤ ± 2 mnt per eksekusi); "penuh" = semua tugas, HP + komputer,
// layar kosong, semua kasus gagal (hanya bila pengguna memintanya).
import { mulaiUji, PRESET_RUDIS } from "./kit.mjs";

// ---- KHAS APLIKASI -------------------------------------------------------------------------------------------------
const uji = await mulaiUji({
  mode: "cepat",
  ...PRESET_RUDIS, // hapus bila bukan aplikasi monorepo Rudis, lalu isi login/menu/pergiDengan sendiri
  baseUrl: "http://localhost:5173",
  apiUrl: "http://127.0.0.1:8080/api/v1",
  keluaran: "./hasil",
  akun: { admin: { email: "admin@example.com", sandi: "admin123" }, petugas: { email: "petugas@example.com", sandi: "petugas123" } },
  teksTerlarang: ["GU", "satuan dasar", { pola: /\bmutasi\b/i, alasan: "istilah internal 'mutasi' (bahasa petugas: riwayat/pergerakan stok)" }],
  polaAngka: /qty|jumlah|min/i,
});

// Satu fungsi per tugas dari alur-tugas.md; dipanggil untuk HP dan komputer.
async function tugasBarangMasuk(s) {
  await s.menu("Stok");
  await s.klik({ role: "link", name: "Barang masuk" });
  await s.snap("form-awal", { kunci: true });
  await s.pilihOpsi({ pemicu: /Pilih barang/, cari: "Kabel", opsi: /Kabel/ });
  await s.isiAngka("#field-lines\\.0\\.qty", "999");
  await s.snap("terisi"); // pemeriksaan dasar otomatis: angka berlebih nol, label, target sentuh, papan ketik angka, …
  await s.klik({ role: "button", name: /Simpan/ });
  await s.snap("berhasil", { kunci: true }); // di mode cepat hanya langkah kunci (kunci: true), kasus gagal, dan galat yang dipotret
  uji.hasilTugas({ peran: s.peran, tugas: "Mencatat barang masuk", perangkat: s.perangkat, status: "LULUS", foto: "(lihat berkas bernomor)", kasusGagal: "1 dari 1" });
}
async function kasusGagalBarangMasuk(s) {
  await s.klik({ role: "button", name: /Simpan/ });
  await s.snap("gagal-isian-kosong", { gagal: true }); // gagal: true → respons 4xx dianggap diharapkan
}

// ---- JALANKAN (generik) --------------------------------------------------------------------------------------------
// Tugas inti = baris "Tugas inti (uji cepat)" di alur-tugas.md; sisanya hanya di mode penuh.
const TUGAS = [
  { nama: "barang-masuk", inti: true, jalankan: tugasBarangMasuk, gagal: kasusGagalBarangMasuk },
  // { nama: "riwayat", inti: false, jalankan: tugasRiwayat }, // bukan inti: hanya mode penuh
];
const dijalankan = TUGAS.filter((x) => x.inti || uji.mode === "penuh");
uji.cakupan({ tugasUji: dijalankan.map((x) => x.nama), tugasSemua: TUGAS.map((x) => x.nama) }); // pernyataan cakupan + "belum terverifikasi" otomatis

for (const perangkat of uji.perangkatUji) { // cepat: ["hp"]; penuh: ["hp", "komputer"]
  const s = await uji.sesi("petugas", perangkat, { awal: "/stock" });
  await s.snap("layar-awal", { kunci: true });
  // s.tugas = coba + penyaring UJI_TUGAS (mis. `UJI_TUGAS=masuk node uji.mjs`): debug/uji ulang per tugas tanpa mengulang semuanya
  for (const x of dijalankan) {
    await s.tugas(x.nama, x.jalankan); // galat skrip tidak menghentikan uji; tercatat sebagai langkah GALAT
    if (x.gagal) await s.tugas(x.nama + "-gagal", x.gagal);
  }
}
await uji.selesai(); // hasil/hasil.json, hasil/ringkasan.md (cakupan + matriks + calon temuan + belum terverifikasi), hasil/tangkapan/*.png
