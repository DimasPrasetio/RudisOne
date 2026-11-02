// Uji pustaka murni kit uji jalan alur (templat/uji-alur-kit/periksa.mjs): detektor angka/teks/layar tanpa Playwright.
import { test } from "node:test";
import assert from "node:assert/strict";
import { polaAngkaBerlebih, polaTanggalIso, temuanTeksTerlarang, temuanGeser, temuanTargetSentuh, temuanLabel, temuanPapanKetik,
  temuanKonsol, temuanRespons, periksaLayar, kelompokkanTemuan, tabelTemuan, barisMatriks, tentukanMode, perangkatUntukMode, perluTangkapan, teksCakupan } from "../templat/uji-alur-kit/periksa.mjs";

const jenis = (arr) => arr.map((t) => t.jenis);

test("angka berlebih nol: 999,0000 dan 25,0000 tertangkap; angka wajar Indonesia lolos", () => {
  assert.deepEqual(polaAngkaBerlebih("Jumlah 999,0000 pcs").map((a) => [a.kecocokan, a.jenis]), [["999,0000", "nol-berlebih"]]);
  assert.equal(polaAngkaBerlebih("tersedia 25,0000")[0].jenis, "nol-berlebih");
  assert.equal(polaAngkaBerlebih("1.234,5678")[0].jenis, "desimal-panjang");
  for (const ok of ["999", "2,5", "7,25", "Rp 1.250.000", "1.000,00", "Rp 12.500,50", "tanggal 02/11/2026", "BM/2026/11/0001"])
    assert.deepEqual(polaAngkaBerlebih(ok), [], ok);
  assert.deepEqual(polaAngkaBerlebih("1,234,567"), [], "format ribuan Inggris beruntun tidak dihitung desimal");
});

test("nilai isian mentah API (12.0000) hanya dicek bila mentah=true; ribuan Indonesia tidak salah tangkap", () => {
  assert.deepEqual(polaAngkaBerlebih("12.0000"), []);
  assert.equal(polaAngkaBerlebih("12.0000", { mentah: true })[0].jenis, "nol-berlebih");
  assert.equal(polaAngkaBerlebih("3.14159", { mentah: true })[0].jenis, "desimal-panjang");
  assert.deepEqual(polaAngkaBerlebih("1.000", { mentah: true }), []);
  assert.deepEqual(polaAngkaBerlebih("1.000.000", { mentah: true }), []);
});

test("tanggal ISO di teks tertangkap; nomor dokumen bertanggal tidak", () => {
  assert.deepEqual(polaTanggalIso("Tanggal 2026-11-02 dokumen").map((a) => a.kecocokan), ["2026-11-02"]);
  assert.deepEqual(polaTanggalIso("BM-2026-11-0001 dan BM/2026/11/0001 dan 02/11/2026"), []);
  assert.deepEqual(polaTanggalIso("2026-13-45"), []);
});

test("teks terlarang: bawaan (Required, undefined, galat HTTP) dan daftar proyek (kata utuh, tanpa peka huruf)", () => {
  assert.deepEqual(jenis(temuanTeksTerlarang("Required")), ["teks-terlarang"]);
  assert.deepEqual(jenis(temuanTeksTerlarang("Harga: undefined")), ["teks-terlarang"]);
  assert.deepEqual(jenis(temuanTeksTerlarang("Gagal HTTP 500")), ["teks-terlarang"]);
  assert.deepEqual(temuanTeksTerlarang("Wajib diisi. Pilih barang lalu simpan."), []);
  const t = temuanTeksTerlarang("Stok di gudang GU tidak cukup (satuan dasar)", ["GU", "satuan dasar"], { gunakanBawaan: false });
  assert.equal(t.length, 2);
  assert.match(t[0].ringkas, /GU/);
  assert.deepEqual(temuanTeksTerlarang("Guna dan Gudang", ["GU"], { gunakanBawaan: false }), [], "GU hanya sebagai kata utuh");
  assert.equal(temuanTeksTerlarang("kode ZZ9", [{ pola: /ZZ\d/, alasan: "kode internal", usulTingkat: "kosmetik" }], { gunakanBawaan: false })[0].usulTingkat, "kosmetik");
  assert.equal(temuanTeksTerlarang("a.b (c)", ["a.b (c)"], { gunakanBawaan: false }).length, 1, "karakter regex di daftar string di-escape");
});

test("geser horizontal dan target sentuh < 44 px (tautan sebaris dikecualikan)", () => {
  assert.deepEqual(temuanGeser({ scrollW: 390, innerW: 390 }), []);
  assert.deepEqual(temuanGeser({ scrollW: 391, innerW: 390 }), [], "toleransi 1 px");
  const g = temuanGeser({ scrollW: 520, innerW: 390, pelanggarLebar: [{ tag: "table", t: "", w: 520 }] });
  assert.equal(g[0].butir, "5a");
  assert.match(g[0].rincian, /table 520px/);
  const tombol = [{ t: "Menu", w: 28, h: 28 }, { t: "Simpan", w: 120, h: 44 }, { t: "lihat", w: 30, h: 16, sebaris: true }, { t: "Hapus", w: 80, h: 43 }];
  const s = temuanTargetSentuh({ tombol });
  assert.equal(s.length, 1);
  assert.equal(s[0].jumlah, 2);
  assert.match(s[0].ringkas, /target sentuh < 44 px/);
  assert.deepEqual(temuanTargetSentuh({ tombol: [{ t: "ok", w: 44, h: 44 }] }), []);
});

test("label hilang: label, aria-label, pembungkus dianggap ada; placeholder saja tidak", () => {
  const inputs = [{ type: "text", id: "a", label: "Nama" }, { type: "text", id: "b", aria: "Cari" }, { type: "text", id: "c", ph: "Cari kode" }, { type: "hidden", id: "d" }, { type: "checkbox", id: "e" }];
  const t = temuanLabel({ inputs });
  assert.equal(t.length, 1);
  assert.match(t[0].rincian, /^c \(placeholder "Cari kode"\)$/);
  assert.deepEqual(temuanLabel({ inputs: [] }), []);
});

test("papan ketik angka: isian jumlah bertipe teks tanpa inputmode ditandai", () => {
  const inputs = [{ type: "text", id: "field-lines.0.qty", im: null }, { type: "text", id: "qty2", im: "decimal" }, { type: "number", id: "qty3" }, { type: "text", id: "nama", label: "Nama barang" }, { type: "text", id: "x", label: "Jumlah", im: "text" }];
  const t = temuanPapanKetik({ inputs });
  assert.equal(t.length, 1);
  assert.match(t[0].rincian, /field-lines\.0\.qty/);
  assert.match(t[0].rincian, /x \(inputmode=text\)/);
  assert.doesNotMatch(t[0].rincian, /qty2|qty3|nama/);
});

test("konsol dan respons: yang diabaikan/diizinkan tidak jadi temuan; 5xx lebih berat", () => {
  assert.deepEqual(temuanKonsol(["x favicon.ico gagal"], { abaikan: [/favicon/] }), []);
  assert.equal(temuanKonsol(["TypeError: x is undefined"]).length, 1);
  const r = [{ status: 401, metode: "GET", jalur: "/auth/me" }, { status: 422, metode: "POST", jalur: "/stock/docs", isi: "tidak cukup" }];
  assert.equal(temuanRespons(r)[0].usulTingkat, "kosmetik");
  assert.deepEqual(temuanRespons(r, { diizinkan: [/GET \/auth\/me 401/, /POST \/stock\/docs 422/] }), []);
  assert.equal(temuanRespons([{ status: 500, metode: "POST", jalur: "/x" }])[0].usulTingkat, "sedang");
  assert.deepEqual(temuanRespons([{ status: 200, metode: "GET", jalur: "/x" }]), []);
});

test("periksaLayar: gabungan; kasus pilot 999,0000 + 'GU/(satuan dasar)' + target kecil di HP tertangkap, layar sehat bersih", () => {
  const dom = { scrollW: 390, innerW: 390, tombol: [{ t: "Menu", w: 28, h: 28 }], inputs: [{ type: "text", id: "qty", label: "Jumlah", im: "text", val: "999,0000" }],
    teks: "Stok BRG-1 di gudang GU tidak cukup: tersedia 10, diminta 25 (satuan dasar). Required", nilaiIsian: ["999,0000", "12.0000"], placeholders: [] };
  const t = periksaLayar(dom, { sentuh: true, teksTerlarang: ["GU", "satuan dasar"] });
  const j = jenis(t);
  for (const k of ["target-sentuh", "papan-ketik", "angka-berlebih", "teks-terlarang"]) assert.ok(j.includes(k), k);
  assert.equal(t.filter((x) => x.jenis === "teks-terlarang").length, 3);
  assert.equal(t.find((x) => x.jenis === "angka-berlebih").usulTingkat, "sedang");
  const sehat = periksaLayar({ scrollW: 1440, innerW: 1440, tombol: [{ t: "Simpan", w: 100, h: 36 }], inputs: [{ type: "text", id: "n", label: "Nama" }], teks: "Stok tersedia 7. Simpan berhasil.", nilaiIsian: ["Kabel"], placeholders: [] }, { sentuh: false });
  assert.deepEqual(sehat, []);
  assert.deepEqual(jenis(periksaLayar({ scrollW: 400, innerW: 1440, tombol: [{ w: 10, h: 10 }], inputs: [], teks: "" }, { sentuh: false })), [], "target kecil diabaikan di komputer");
});

test("kelompokkanTemuan + tabelTemuan + barisMatriks: keluaran siap tempel ke templat", () => {
  const langkah = [
    { no: 1, nama: "a", perangkat: "hp", peran: "petugas", foto: "001.png", temuan: [{ jenis: "angka-berlebih", butir: "3", usulTingkat: "sedang", ringkas: "angka berlebih", rincian: "999,0000" }] },
    { no: 2, nama: "b", perangkat: "komputer", peran: "petugas", foto: "002.png", temuan: [{ jenis: "angka-berlebih", butir: "3", usulTingkat: "sedang", ringkas: "angka berlebih", rincian: "999,0000" }, { jenis: "konsol", butir: "—", usulTingkat: "kosmetik", ringkas: "1 galat konsol", rincian: "x | y" }] },
  ];
  const g = kelompokkanTemuan(langkah);
  assert.equal(g.length, 2);
  assert.equal(g[0].jenis, "angka-berlebih");
  assert.equal(g[0].muncul.length, 2);
  const md = tabelTemuan(g);
  assert.match(md, /^\| # \| Tingkat/);
  assert.match(md, /\| 1 \| sedang \| 3 \| angka berlebih: 999,0000 \| hp\/petugas\/a \(001\.png\); komputer\/petugas\/b \(002\.png\) \|/);
  assert.match(md, /x \\\| y/, "pipa di sel di-escape");
  const m = barisMatriks([
    { peran: "petugas", tugas: "Barang masuk", perangkat: "hp", status: "LULUS", foto: "001.png", kasusGagal: "2 dari 2" },
    { peran: "petugas", tugas: "Barang masuk", perangkat: "komputer", status: "SELESAI-MENYIMPANG", catatan: "temuan 1" },
    { peran: "admin", tugas: "Pengguna", perangkat: "komputer", status: "GAGAL" },
  ]);
  assert.match(m, /\| petugas \| Barang masuk \| LULUS · 001\.png \| SELESAI-MENYIMPANG \(temuan 1\) \| 2 dari 2 \|/);
  assert.match(m, /\| admin \| Pengguna \| BELUM TERVERIFIKASI \| GAGAL \|/);
});

test("mode uji: cepat = HP saja + tangkapan hanya di langkah kunci/gagal/galat; penuh = semua; mode asing ditolak", () => {
  assert.equal(tentukanMode(undefined, undefined), "cepat", "bawaan = cepat");
  assert.equal(tentukanMode("penuh", ""), "penuh");
  assert.equal(tentukanMode("penuh", "CEPAT"), "cepat", "env UJI_MODE menang atas opsi");
  assert.equal(tentukanMode("cepat", ""), "cepat");
  assert.throws(() => tentukanMode("kilat"), /tidak dikenal/);
  assert.deepEqual(perangkatUntukMode("cepat"), ["hp"]);
  assert.deepEqual(perangkatUntukMode("cepat", ["komputer", "hp"]), ["hp"]);
  assert.deepEqual(perangkatUntukMode("penuh"), ["hp", "komputer"]);
  assert.equal(perluTangkapan("penuh"), true);
  assert.equal(perluTangkapan("cepat"), false);
  assert.equal(perluTangkapan("cepat", { kunci: true }), true);
  assert.equal(perluTangkapan("cepat", { gagal: true }), true);
  assert.equal(perluTangkapan("cepat", { galat: true }), true);
});

test("teksCakupan: pernyataan jujur 'cepat: N dari M tugas, HP saja' + daftar belum terverifikasi dari tugas yang tak dijalankan", () => {
  const c = teksCakupan({ mode: "cepat", tugasUji: ["masuk", "keluar"], tugasSemua: ["masuk", "keluar", "stok", "riwayat"], perangkat: ["hp"] });
  assert.match(c.pernyataan, /^cepat: 2 dari 4 tugas, HP saja/);
  assert.ok(c.belum.some((b) => b.endsWith(": stok")) && c.belum.some((b) => b.endsWith(": riwayat")));
  assert.ok(c.belum.some((b) => /komputer/.test(b)) && c.belum.some((b) => /layar kosong/.test(b)));
  const p = teksCakupan({ mode: "penuh", tugasUji: ["a", "b"], tugasSemua: ["a", "b"], perangkat: ["hp", "komputer"] });
  assert.equal(p.pernyataan, "penuh: 2 dari 2 tugas, HP + komputer");
  assert.deepEqual(p.belum, []);
  assert.match(teksCakupan({ mode: "cepat", perangkat: ["hp"] }).pernyataan, /jumlah tugas belum dinyatakan/, "cakupan tak dinyatakan tidak berpura-pura lengkap");
  assert.equal(teksCakupan({ mode: "cepat", tugasUji: ["x"], tugasSemua: ["x"], perangkat: ["hp"] }).pernyataan.startsWith("cepat: 1 dari 1 tugas"), true);
});
