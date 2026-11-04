// Logika keadaan tampil, jejak kerja, dan fase waktu Kantor (kantor/app/jejak.mjs). Jalankan: node --test kantor/
import { test } from "node:test";
import assert from "node:assert/strict";
import { URUT } from "./app/denah.mjs";
import { BARU_SELESAI_MS, barisTersembunyi, berkasMeja, faseDariParam, faseWaktu, jamWIB, keadaanTampil, keteranganSiap, kursiPemilik, papanDivisi, papanTugas, teksSelesai } from "./app/jejak.mjs";

const KINI = Date.parse("2026-01-01T07:00:00Z");

test("'Bekerja' (dan berpikir/menunggu) hanya dari sesi/subagent yang benar-benar berjalan", () => {
  assert.equal(keadaanTampil({ present: true, status: "bekerja" }, KINI), "bekerja");
  assert.equal(keadaanTampil({ present: true, status: "berpikir" }, KINI), "berpikir");
  assert.equal(keadaanTampil({ present: true, status: "menunggu" }, KINI), "menunggu");
  // status kerja tanpa kehadiran nyata (data rusak/klien lama) tidak pernah tampil bekerja
  assert.equal(keadaanTampil({ present: false, status: "bekerja" }, KINI), "siap");
  // tidak ada kombinasi data tanpa kehadiran yang menghasilkan status kerja
  for (const status of ["absen", "santai", "bekerja", "berpikir", "menunggu", undefined])
    for (const mode of ["katalog", "absen", "siaga", undefined])
      assert.ok(["siap", "selesai"].includes(keadaanTampil({ present: false, status, mode, selesai: { ts: KINI - 60e3 } }, KINI)));
  assert.equal(keadaanTampil(undefined, KINI), "siap");
});

test("semua jabatan hadir: siaga, katalog, dan sesi tetap yang belum masuk tampil 'Siap dipanggil' dengan keterangan jujur", () => {
  for (const ag of [{ present: true, status: "santai", mode: "siaga" }, { present: false, status: "absen", mode: "katalog" },
    { present: false, status: "absen", mode: "absen" }]) assert.equal(keadaanTampil(ag, KINI), "siap");
  assert.match(keteranganSiap({ mode: "siaga" }), /terbuka/);
  assert.match(keteranganSiap({ mode: "katalog" }), /saat ditugaskan/);
  assert.match(keteranganSiap({ mode: "absen" }), /COO/);
});

test("'Baru selesai' selama 10 menit setelah pekerjaan nyata berakhir, lalu kembali siap; kerja nyata selalu menang", () => {
  const ag = (msLalu, extra = {}) => ({ present: false, status: "absen", mode: "katalog", selesai: { ts: KINI - msLalu }, ...extra });
  assert.equal(keadaanTampil(ag(30e3), KINI), "selesai");
  assert.equal(keadaanTampil(ag(BARU_SELESAI_MS - 1000), KINI), "selesai");
  assert.equal(keadaanTampil(ag(BARU_SELESAI_MS + 1000), KINI), "siap");
  assert.equal(keadaanTampil(ag(30e3, { present: true, status: "bekerja" }), KINI), "bekerja");
  assert.equal(keadaanTampil({ present: true, status: "santai", selesai: null }, KINI), "siap");
  assert.equal(keadaanTampil({ selesai: { ts: "bukan angka" } }, KINI), "siap");
  assert.equal(teksSelesai(KINI - 20e3, KINI), "Baru selesai · baru saja");
  assert.equal(teksSelesai(KINI - 3 * 60e3 - 5e3, KINI), "Baru selesai · 3 mnt lalu");
});

test("pemilik register → kursi (nama, id teknis, nomor tim, proyek)", () => {
  const tim = [{ n: 2, proyek: "kasir" }, { n: 1, proyek: "RudisOne" }];
  assert.equal(kursiPemilik("Tech Lead · RudisOne", tim), "Tech Lead · Tim 1");
  assert.equal(kursiPemilik("Tech Lead · kasir", tim), "Tech Lead · Tim 2");
  assert.equal(kursiPemilik("Software Engineer #2 · Tim 3", tim), "Software Engineer #2 · Tim 3");
  assert.equal(kursiPemilik("research-analyst", tim), "Research Analyst");
  assert.equal(kursiPemilik("COO", tim), "COO");
  assert.equal(kursiPemilik("Peran Tak Dikenal", tim), null);
  assert.equal(kursiPemilik("Tech Lead", tim), "Tech Lead · Tim 1");                // tanpa keterangan → Tim 1
  assert.equal(kursiPemilik("Tech Lead · toko", tim), null);
  assert.equal(kursiPemilik("Research Analyst (subagent)", tim), "Research Analyst");   // keterangan di akhir diabaikan
  assert.equal(kursiPemilik("Tech Lead · Tim 2 (kasir)", tim), "Tech Lead · Tim 2");                       // proyek belum dikenal → bukan Tim 1
  assert.equal(kursiPemilik("Business Systems Analyst · toko", tim), null);
  assert.deepEqual(papanDivisi([{ id: "T-20260101-9", tugas: "x", pemilik: "Tech Lead · toko", status: "berjalan" }], tim), {});
  assert.equal(kursiPemilik(undefined, tim), null);
});

test("papan tulis, papan tugas, dan berkas di meja hanya memuat ID, judul, status — dari tugas register", () => {
  const tim = [{ n: 1, proyek: "RudisOne" }];
  const rahasia = { bukti: "isi bukti", folder: "/rahasia", catatan: "pesan pengguna", fase: "Konstruksi", kemajuan: { menit: 3 } };
  const tugas = [
    { id: "T-20260101-2", tugas: "Perbaikan kantor", pemilik: "Tech Lead · RudisOne", status: "berjalan", ...rahasia },
    { id: "T-20260101-3", tugas: "Riset harga", pemilik: "Research Analyst", status: "antre (menunggu T-2)", ...rahasia },
    { id: "T-20260101-4", tugas: "Insiden", pemilik: "Head of IT Operations", status: "berjalan", ...rahasia },
  ];
  const selesai = [{ id: "T-20260101-1", tugas: "Audit modul", pemilik: "Tech Lead · RudisOne", ts: KINI - 3600e3, ...rahasia }];
  const pd = papanDivisi(tugas, tim);
  assert.deepEqual(pd.tim1, [{ id: "T-20260101-2", judul: "Perbaikan kantor", status: "berjalan" }]);
  assert.deepEqual(pd.corp, [{ id: "T-20260101-3", judul: "Riset harga", status: "antre" }]);
  assert.deepEqual(pd.ops.map((t) => t.id), ["T-20260101-4"]);
  const pt = papanTugas(tugas, selesai);
  assert.deepEqual(pt.berjalan.map((t) => t.id), ["T-20260101-2", "T-20260101-4"]);
  assert.deepEqual(pt.lain.map((t) => t.id), ["T-20260101-3"]);
  assert.deepEqual(pt.selesai, [{ id: "T-20260101-1", judul: "Audit modul", status: "selesai" }]);
  const bm = berkasMeja(selesai, tim);
  assert.deepEqual(bm, { "Tech Lead · Tim 1": [{ id: "T-20260101-1", judul: "Audit modul" }] });
  // privasi: tidak ada kolom lain yang ikut tergambar
  const semua = [...Object.values(pd).flat(), ...pt.berjalan, ...pt.lain, ...pt.selesai, ...Object.values(bm).flat()];
  for (const t of semua) assert.deepEqual(Object.keys(t).filter((k) => !["id", "judul", "status"].includes(k)), []);
  assert.ok(!JSON.stringify(semua).includes("rahasia") && !JSON.stringify(semua).includes("pesan pengguna"));
  // tanpa tugas → papan kosong (bukan isi hiasan)
  assert.deepEqual(papanDivisi([], tim), {});
  assert.deepEqual(papanTugas([], []), { berjalan: [], lain: [], selesai: [] });
  for (const k of Object.keys(bm)) assert.ok(URUT.includes(k));
});

test("fase waktu: pagi/siang/sore/malam dari jam WIB; parameter uji ?jam=", () => {
  assert.equal(faseWaktu(4.99), "malam"); assert.equal(faseWaktu(5), "pagi"); assert.equal(faseWaktu(10.9), "pagi");
  assert.equal(faseWaktu(11), "siang"); assert.equal(faseWaktu(15), "sore"); assert.equal(faseWaktu(17.99), "sore");
  assert.equal(faseWaktu(18), "malam"); assert.equal(faseWaktu(23.5), "malam"); assert.equal(faseWaktu(NaN), "siang");
  assert.equal(faseDariParam("sore"), "sore"); assert.equal(faseDariParam("07:30"), "pagi"); assert.equal(faseDariParam("19.5"), "malam");
  assert.equal(faseDariParam("16"), "sore"); assert.equal(faseDariParam("25"), null); assert.equal(faseDariParam("x"), null); assert.equal(faseDariParam(null), null);
  // 07:00 UTC = 14:00 WIB
  assert.equal(jamWIB(KINI), 14);
  assert.equal(faseWaktu(jamWIB(Date.parse("2026-01-01T12:30:00Z"))), "malam");   // 19:30 WIB
});

test("panel Tim ringkas: hanya 'siap' yang disembunyikan; orang yang mulai bekerja langsung tampil lagi", () => {
  const corp = ["Head of Strategy", "Financial Controller", "Research Analyst", "HR Business Partner"];
  const siapSemua = Object.fromEntries(corp.map((n) => [n, "siap"]));
  assert.deepEqual([...barisTersembunyi(corp, siapSemua)], corp);
  // Research Analyst berganti ke bekerja / menunggu / baru selesai → tidak tersembunyi lagi (render berikutnya)
  for (const st of ["bekerja", "berpikir", "menunggu", "selesai"])
    assert.ok(!barisTersembunyi(corp, { ...siapSemua, "Research Analyst": st }).has("Research Analyst"), st);
  assert.equal(barisTersembunyi(corp, siapSemua, { buka: true }).size, 0, "divisi dibuka");
  assert.ok(!barisTersembunyi(corp, siapSemua, { dipilih: "HR Business Partner" }).has("HR Business Partner"), "dipilih dari denah");
});
