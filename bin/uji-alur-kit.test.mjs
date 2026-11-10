// Uji pustaka murni kit uji jalan alur (templat/uji-alur-kit/periksa.mjs): detektor angka/teks/layar tanpa Playwright.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESET_RUDIS } from "../templat/uji-alur-kit/kit.mjs";
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
  assert.deepEqual(perangkatUntukMode("cepat", ["komputer"]), ["komputer"], "tanpa HP terkonfigurasi: tetap satu perangkat, bukan nol");
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

test("preset Rudis: hanya 401 GET /rbac|auth/me yang diizinkan; jalur lain dan metode lain tetap calon temuan", () => {
  const diizinkan = PRESET_RUDIS.responsDiizinkan;
  const r = (metode, jalur, status = 401) => ({ metode, jalur, status });
  assert.deepEqual(temuanRespons([r("GET", "/rbac/me"), r("GET", "/auth/me")], { diizinkan }), []);
  assert.equal(temuanRespons([r("GET", "/rbac/menu"), r("POST", "/auth/me"), r("GET", "/rbac/me", 403), r("GET", "/stock/items")], { diizinkan })[0].jumlah, 4);
});

test("teksCakupan: uji ulang parsial (UJI_TUGAS) menyatakan dirinya dan memasukkan tugas tersaring ke belum terverifikasi", () => {
  const c = teksCakupan({ mode: "cepat", tugasUji: ["masuk"], tugasSemua: ["masuk", "keluar"], perangkat: ["hp"], parsial: "masuk" });
  assert.match(c.pernyataan, /cepat: 1 dari 2 tugas.*UJI ULANG PARSIAL .UJI_TUGAS=masuk./);
  assert.ok(c.belum.some((b) => /uji ulang parsial.*keluar/.test(b)));
});

/* ---- T-20261110-3: peta layar, galat bermakna, klik HP, ulang yang galat ---- */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { teksRegex, deskripsiSasaran, sasaranDariGalat, teksSasaran, daftarNamaDom, kemiripanNama, kandidatTerdekat, formatKandidat, barisGalat,
  langkahMenuHp, uraiSaring, cocokSaring, tugasGalat, pilihHasilTerbaru, ringkasLayar, petaMarkdown } from "../templat/uji-alur-kit/periksa.mjs";
import { Uji, Sesi } from "../templat/uji-alur-kit/kit.mjs";

const DOM_FORM = {
  url: "/stock/in", judul: ["Barang masuk"],
  tombol: [{ tag: "a", t: "Stok" }, { tag: "a", t: "Riwayat" }, { tag: "button", t: "Simpan dokumen" }, { tag: "button", t: "Batal" }, { tag: "button", t: "Tambah baris" }, { tag: "button", t: "Simpan dokumen" }],
  inputs: [{ type: "text", id: "field-lines.0.qty", name: "lines.0.qty", label: "Jumlah" }, { type: "search", name: "q", ph: "Cari barang" }, { type: "hidden", id: "csrf" }],
};

test("peta: ringkasLayar memilah judul/tombol/tautan/isian (tautan menu tidak diulang); petaMarkdown memuat peran, menu, nama tampil", () => {
  const l = ringkasLayar(DOM_FORM, { abaikanTautan: ["Stok"] });
  assert.deepEqual(l.judul, ["Barang masuk"]);
  assert.deepEqual(l.tombol, ["Simpan dokumen", "Batal", "Tambah baris"], "duplikat dibuang");
  assert.deepEqual(l.tautan, ["Riwayat"], "tautan menu tidak diulang per layar");
  assert.deepEqual(l.isian.map((i) => i.nama), ["Jumlah", "Cari barang"], "label → placeholder; isian tersembunyi tidak ikut");
  assert.match(l.isian[0].rincian, /id=field-lines\.0\.qty, name=lines\.0\.qty, type=text/);
  const md = petaMarkdown({ baseUrl: "http://localhost:5173", perangkat: "hp", dibuat: "2026-11-10T00:00:00Z", peran: [
    { peran: "petugas", menu: ["Stok", "Riwayat"], layar: [{ menu: "Stok", ...l }, { menu: "Riwayat", galat: "Timeout 8000ms" }] },
    { peran: "admin", galat: "login 'admin' tidak meninggalkan /login", menu: [], layar: [] }] });
  assert.match(md, /^# Peta layar — http:\/\/localhost:5173 \(perangkat hp\)/);
  assert.match(md, /## Peran: petugas\n\nMenu: "Stok" · "Riwayat"/);
  assert.match(md, /### Stok — `\/stock\/in`\n- Judul: "Barang masuk"\n- Tombol: "Simpan dokumen", "Batal", "Tambah baris"\n- Tautan: "Riwayat"\n- Isian: "Jumlah" \(id=field-lines\.0\.qty/);
  assert.match(md, /### Riwayat\n- GALAT: Timeout 8000ms/);
  assert.match(md, /## Peran: admin[\s\S]*GALAT: login 'admin'/);
  assert.match(md, /bukan tebakan dari kode sumber/);
  assert.match(petaMarkdown({ peran: [{ peran: "x", menu: [], layar: [] }] }), /tidak ada tautan menu yang tampak/);
});

test("galat: sasaran dibaca dari pesan Playwright / target kit; teks intinya diekstrak", () => {
  const m1 = "locator.click: Timeout 8000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: /^Simpan$/ }).or(getByRole('combobox', { name: /^Simpan$/ })).first() to be visible";
  assert.equal(sasaranDariGalat(m1), "getByRole('button', { name: /^Simpan$/ }).or(getByRole('combobox', { name: /^Simpan$/ })).first()");
  assert.equal(teksSasaran(sasaranDariGalat(m1)), "Simpan");
  const m2 = "locator.waitFor: Timeout 8000ms exceeded.\nCall log:\n  - waiting for locator('a[data-sidebar=menu-button]').filter({ hasText: /^\\s*Stok barang\\s*$/ }).first() to be visible";
  assert.equal(teksSasaran(sasaranDariGalat(m2)), "Stok barang");
  assert.equal(teksSasaran("locator('#field-lines\\\\.0\\\\.qty').first()"), "field-lines.0.qty", "escape CSS ganda");
  assert.equal(teksSasaran("#field-lines\\.0\\.qty"), "field-lines.0.qty");
  assert.equal(teksSasaran("input[name=\"lines.0.qty\"]"), "lines.0.qty");
  assert.equal(teksSasaran("getByLabel('Jumlah barang')"), "Jumlah barang");
  assert.equal(teksSasaran("getByText(/Barang masuk/i)"), "Barang masuk");
  assert.equal(teksSasaran("button:has-text(\"Simpan\")"), "Simpan");
  assert.equal(teksSasaran(/Pilih\s+barang/), "Pilih barang");
  assert.equal(teksSasaran({ role: "link", name: "Barang masuk" }), "Barang masuk");
  assert.equal(teksRegex("^\\s*Simpan \\(draf\\)\\s*$"), "Simpan draf");
  assert.equal(sasaranDariGalat("opsi tidak ditemukan di <select>: Kabel"), "Kabel");
  assert.equal(sasaranDariGalat("stok tidak berubah setelah simpan"), null, "galat pemeriksaan skrip: bukan galat sasaran");
  assert.equal(deskripsiSasaran({ role: "button", name: /Simpan/ }), "getByRole('button', { name: /Simpan/ })");
  assert.equal(deskripsiSasaran({ role: "link", name: "Stok" }), "getByRole('link', { name: 'Stok' })");
  assert.equal(deskripsiSasaran(/Pilih/), "/Pilih/");
  assert.equal(deskripsiSasaran("#x"), "#x");
  assert.equal(deskripsiSasaran({}), null);
  assert.equal(deskripsiSasaran({ toString: () => "locator('#y')" }), "locator('#y')", "Locator Playwright → toString");
});

test("galat: ±5 kandidat nama tampak terdekat (label, id/name isian, tanpa peka huruf/aksen), baris galat memuat URL + kandidat", () => {
  const daftar = daftarNamaDom(DOM_FORM);
  const k = kandidatTerdekat("Simpan", daftar);
  assert.equal(k.length, 5, "±5 kandidat");
  assert.equal(k[0].nama, "Simpan dokumen");
  assert.equal(formatKandidat(k[0]), 'tombol "Simpan dokumen"');
  assert.equal(kandidatTerdekat("field-lines.0.qty", daftar, 1)[0].nama, "Jumlah", "selektor #id cocok lewat alias isian");
  assert.equal(kandidatTerdekat("lines.0.qty", daftar, 1)[0].nama, "Jumlah", "selektor [name] cocok lewat alias");
  assert.equal(kandidatTerdekat("Riwyat", daftar, 1)[0].nama, "Riwayat", "salah ketik");
  assert.equal(kandidatTerdekat("cari BARANG", daftar, 1)[0].nama, "Cari barang");
  assert.ok(kemiripanNama("Barang Masuk", "barang masuk") === 1 && kemiripanNama("Pengaturan", "pengaturan ") === 1);
  assert.ok(kemiripanNama("Simpan", "Simpan dokumen") > kemiripanNama("Simpan", "Batal"));
  assert.equal(kemiripanNama("", "x"), 0);
  assert.equal(kandidatTerdekat("apa saja", [], 5).length, 0);
  assert.ok(!("alias" in k[0]) && !("i" in k[0]), "keluaran bersih");
  const b = barisGalat({ nama: "barang-masuk", peran: "petugas", perangkat: "hp", pesan: "locator.click: Timeout 8000ms exceeded.", url: "/stock/in",
    sasaran: "getByRole('button', { name: /^Simpan$/ })", kandidat: [k[0], { jenis: "tombol", nama: "Batal" }].map(formatKandidat) });
  assert.equal(b, "hp/petugas barang-masuk: locator.click: Timeout 8000ms exceeded. — di /stock/in · sasaran: getByRole('button', { name: /^Simpan$/ }) — nama terdekat yang tampak: tombol \"Simpan dokumen\" · tombol \"Batal\"");
  assert.equal(barisGalat({ nama: "x", peran: "a", perangkat: "hp", pesan: "boom" }), "hp/a x: boom", "galat lama (tanpa url/kandidat) tetap terbaca");
});

test("klik HP: menu samping dibuka hanya untuk tautan menu/navigasi; sasaran yang belum selesai muncul ditunggu, tidak membuka menu", () => {
  assert.equal(langkahMenuHp({ hp: false }), "lanjut", "komputer: tak pernah membuka menu");
  assert.equal(langkahMenuHp({ tampak: true, dariMenu: true }), "lanjut", "sudah tampak: langsung klik");
  assert.equal(langkahMenuHp({ dariMenu: true }), "buka-menu", "menu(nama): pasti tautan menu samping");
  assert.equal(langkahMenuHp({ terpasang: true, diNavigasi: true }), "buka-menu", "ada di nav/sidebar yang tersembunyi");
  assert.equal(langkahMenuHp({ terpasang: true, diNavigasi: false }), "lanjut", "ada di halaman, belum tampak (animasi/muat): tunggu biasa, JANGAN buka menu");
  assert.equal(langkahMenuHp({ terpasang: false }), "tunggu", "belum ada di halaman: tunggu singkat dulu");
  assert.equal(langkahMenuHp({ terpasang: true, diNavigasi: false, sudahTunggu: true }), "lanjut", "muncul selama tunggu singkat: tidak membuka menu");
  assert.equal(langkahMenuHp({ terpasang: false, sudahTunggu: true }), "buka-menu", "tetap tidak ada: mungkin di menu samping yang belum dirender");
});

test("UJI_TUGAS: kata lama tetap cocok sebagian; @galat cocok persis; tugasGalat & hasil terbaru", () => {
  assert.equal(uraiSaring("").aktif, false);
  assert.equal(cocokSaring("apa saja", null), true, "tanpa penyaring: semua jalan");
  const s = uraiSaring(" Masuk , keluar ");
  assert.deepEqual([s.kata, s.galat], [["masuk", "keluar"], false]);
  assert.ok(cocokSaring("barang-masuk", s) && cocokSaring("Barang-Keluar-gagal", s) && !cocokSaring("riwayat", s), "perilaku lama: nama memuat kata");
  const g = uraiSaring("@galat");
  assert.deepEqual([g.kata, g.galat, g.token], [[], true, ["@galat"]]);
  g.persis = new Set(tugasGalat({ galat: [{ nama: "barang-masuk-gagal", tugas: "barang-masuk-gagal" }, { nama: "cek-stok", tugas: "barang-masuk" }, { nama: "lama" }] }));
  assert.deepEqual([...g.persis], ["barang-masuk-gagal", "barang-masuk", "lama"], "langkah coba di dalam tugas → nama tugasnya; galat lama tanpa `tugas` → namanya");
  assert.ok(cocokSaring("barang-masuk", g) && cocokSaring("Barang-Masuk-gagal", g) && !cocokSaring("barang-masuk-lagi", g) && !cocokSaring("riwayat", g), "@galat: persis, bukan sebagian");
  assert.deepEqual(tugasGalat({}), []);
  assert.equal(pilihHasilTerbaru([{ berkas: "hasil/hasil.json", mtimeMs: 10 }, { berkas: "hasil-ulang-galat/hasil.json", mtimeMs: 20 }]), "hasil-ulang-galat/hasil.json");
  assert.equal(pilihHasilTerbaru([]), null);
});

/* Uji + Sesi tanpa Playwright: halaman tiruan secukupnya untuk tugas/coba/keAwal. */
function halamanTiruan(url = "http://localhost:5173/stock") {
  const h = { _url: url, pergi: [], setDefaultTimeout() {}, on() {}, url: () => h._url,
    evaluate: async (fn, arg) => (fn.name === "adaPenghalang" ? false : fn.name === "ambilDom" ? { ...DOM_FORM, url: new URL(h._url).pathname } : typeof arg === "string" && arg.startsWith("/") ? (h.pergi.push(arg), (h._url = "http://localhost:5173" + arg), undefined) : []),
    goto: async (u) => { h.pergi.push(u); h._url = u; }, waitForLoadState: async () => {}, waitForTimeout: async () => {}, waitForFunction: async () => {},
    screenshot: async () => {}, viewportSize: () => ({ width: 390, height: 844 }), keyboard: { press: async () => {} },
    locator: () => ({ filter: () => ({ last: () => ({ isVisible: async () => false }) }), first: () => ({ waitFor: async () => {} }) }),
  };
  return h;
}
async function ujiDengan(env, berkasHasil, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uji-alur-kit-"));
  const lama = process.env.UJI_TUGAS, log = console.log;
  try {
    for (const [rel, isi] of Object.entries(berkasHasil)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), JSON.stringify(isi)); }
    if (env == null) delete process.env.UJI_TUGAS; else process.env.UJI_TUGAS = env;
    console.log = () => {};
    const opsi = { mode: "cepat", baseUrl: "http://localhost:5173", keluaran: path.join(dir, "hasil"), akun: {}, perangkat: { hp: "iPhone 13" },
      menu: { tautan: "nav a", pemicuHp: "button" }, penghalang: ["[role=dialog]"], tombolPenjaga: [], jeda: 0, waktuHabis: 1000, waktuMuat: 1000, tungguHp: 10,
      pergiDengan: "spa", fotoPenuh: null, teksTerlarang: [], abaikanKonsol: [], responsDiizinkan: [] };
    return await fn(() => new Uji(opsi), dir);
  } finally {
    console.log = log;
    if (lama == null) delete process.env.UJI_TUGAS; else process.env.UJI_TUGAS = lama;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const jalankanTugas = async (uji, page, nama) => {
  const s = new Sesi(uji, "petugas", "hp", page);
  s.awal = "/stock";
  const jalan = [];
  for (const n of nama) await s.tugas(n, async () => { jalan.push(n); if (n === "rusak") throw new Error("locator.click: Timeout 1000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Simpn' })"); });
  return jalan;
};

test("UJI_TUGAS=@galat: hanya tugas galat di hasil.json terbaru, tiap tugas mulai dari rute awal; galat mencatat tugas + kandidat", async () => {
  const hasilPenuh = { galat: [{ nama: "barang-masuk-gagal", tugas: "barang-masuk-gagal" }, { nama: "rusak", tugas: "rusak" }] };
  await ujiDengan("@galat", { "hasil/hasil.json": hasilPenuh }, async (buat, dir) => {
    const uji = buat();
    assert.equal(uji.opsi.keluaran, path.join(dir, "hasil-ulang-galat"), "keluaran sendiri, hasil penuh tidak tertimpa");
    assert.equal(uji.saring.sumberGalat, path.join(dir, "hasil", "hasil.json"));
    const page = halamanTiruan("http://localhost:5173/stock/in"); // tugas sebelumnya berakhir di layar lain
    const jalan = await jalankanTugas(uji, page, ["barang-masuk", "barang-masuk-gagal", "riwayat", "rusak"]);
    assert.deepEqual(jalan, ["barang-masuk-gagal", "rusak"], "hanya yang galat, nama persis");
    assert.deepEqual(page.pergi, ["/stock"], "kembali ke rute awal sekali (sesudahnya sudah di sana)");
    assert.equal(uji.galat.length, 1);
    const g = uji.galat[0];
    assert.equal(g.tugas, "rusak");
    assert.equal(g.url, "/stock");
    assert.equal(g.sasaran, "getByRole('button', { name: 'Simpn' })");
    assert.equal(g.kandidat[0], 'tombol "Simpan dokumen"');
    uji.cakupan({ tugasUji: ["barang-masuk", "riwayat", "rusak"], tugasSemua: ["barang-masuk", "riwayat", "rusak"] });
    assert.deepEqual(uji.cakupanEfektif().tugasUji, ["barang-masuk", "rusak"], "tugas yang sub-tugas gagalnya diulang ikut tercakup");
    assert.match(uji.cakupanEfektif().parsial, /^@galat → barang-masuk-gagal, rusak$/);
  });
  // uji ulang @galat kedua: membaca hasil ulang @galat sebelumnya bila lebih baru (yang sudah beres tidak diulang)
  await ujiDengan("@galat", { "hasil/hasil.json": hasilPenuh, "hasil-ulang-galat/hasil.json": { galat: [{ nama: "rusak", tugas: "rusak" }] } }, async (buat, dir) => {
    const baru = path.join(dir, "hasil-ulang-galat", "hasil.json"), t = new Date(Date.now() + 5000);
    fs.utimesSync(baru, t, t);
    const uji = buat();
    assert.deepEqual([...uji.saring.persis], ["rusak"]);
  });
  await ujiDengan("@galat", {}, async (buat) => assert.throws(buat, /belum ada hasil\.json/));
});

test("perilaku lama tetap bawaan: tanpa UJI_TUGAS semua tugas jalan, tanpa kembali ke rute awal; kata UJI_TUGAS = cocok sebagian", async () => {
  await ujiDengan(null, {}, async (buat, dir) => {
    const uji = buat();
    assert.equal(uji.opsi.keluaran, path.join(dir, "hasil"));
    const page = halamanTiruan("http://localhost:5173/stock/in");
    assert.deepEqual(await jalankanTugas(uji, page, ["a", "b"]), ["a", "b"]);
    assert.deepEqual(page.pergi, [], "tanpa tugasDariAwal/UJI_TUGAS: tidak berpindah rute");
  });
  await ujiDengan("masuk", {}, async (buat, dir) => {
    const uji = buat();
    assert.equal(uji.opsi.keluaran, path.join(dir, "hasil-ulang-masuk"), "nama folder uji ulang sama seperti dulu");
    assert.deepEqual(await jalankanTugas(uji, halamanTiruan(), ["barang-masuk", "barang-masuk-gagal", "keluar"]), ["barang-masuk", "barang-masuk-gagal"]);
  });
});
