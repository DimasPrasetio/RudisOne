// Contoh skrip uji per-aplikasi yang TIPIS di atas kit. Salin ke handoff/<ID>/uji-alur/uji.mjs, ubah bagian "KHAS APLIKASI",
// jalankan `node uji.mjs` dari handoff/<ID>/uji-alur/ (kit.mjs + periksa.mjs di folder yang sama). Skrip ini menjalankan
// SELURUH uji dalam satu proses: peran × perangkat × tugas, dua langkah per tugas (jalur lancar + kasus gagal).
import { mulaiUji, PRESET_RUDIS } from "./kit.mjs";

// ---- KHAS APLIKASI -------------------------------------------------------------------------------------------------
const uji = await mulaiUji({
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
  await s.snap("form-awal");
  await s.pilihOpsi({ pemicu: /Pilih barang/, cari: "Kabel", opsi: /Kabel/ });
  await s.isiAngka("#field-lines\\.0\\.qty", "999");
  await s.snap("terisi"); // pemeriksaan dasar otomatis: angka berlebih nol, label, target sentuh, papan ketik angka, …
  await s.klik({ role: "button", name: /Simpan/ });
  await s.snap("berhasil");
  uji.hasilTugas({ peran: s.peran, tugas: "Mencatat barang masuk", perangkat: s.perangkat, status: "LULUS", foto: "(lihat berkas bernomor)", kasusGagal: "1 dari 1" });
}
async function kasusGagalBarangMasuk(s) {
  await s.klik({ role: "button", name: /Simpan/ });
  await s.snap("gagal-isian-kosong", { gagal: true }); // gagal: true → respons 4xx dianggap diharapkan
}

// ---- JALANKAN (generik) --------------------------------------------------------------------------------------------
for (const perangkat of ["hp", "komputer"]) {
  const s = await uji.sesi("petugas", perangkat, { awal: "/stock" });
  await s.snap("layar-awal");
  // s.tugas = coba + penyaring UJI_TUGAS (mis. `UJI_TUGAS=masuk node uji.mjs`): debug/uji ulang per tugas tanpa mengulang semuanya
  await s.tugas("barang-masuk", tugasBarangMasuk); // galat skrip tidak menghentikan uji; tercatat sebagai langkah GALAT
  await s.tugas("barang-masuk-gagal", kasusGagalBarangMasuk);
}
await uji.selesai(); // hasil/hasil.json, hasil/ringkasan.md (matriks + calon temuan), hasil/tangkapan/*.png
