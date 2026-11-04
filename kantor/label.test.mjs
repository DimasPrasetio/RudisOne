// Aturan label Kantor (kantor/app/label.mjs): mode tombol Label, tingkat rincian ikut zoom, tampilan per orang, tulisan
// lantai zona. Jalankan: node --test kantor/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIVISI, ZONA, bangunDenah } from "./app/denah.mjs";
import { AMBANG_DEKAT, KOTAK_TULISAN, LIS_DEPAN, PRIO_WAJIB, tempatkanLabel, MODE_LABEL, modeLabelDari, tampilanOrang, tingkatRincian, tulisanZona, ucapanTampil } from "./app/label.mjs";

const STATUS = ["bekerja", "berpikir", "menunggu", "selesai", "siap"];

test("tombol Label: tiga mode, Ringkas bawaan & pertama; ?label= mengalahkan pilihan tersimpan; nilai asing → ringkas", () => {
  assert.deepEqual(MODE_LABEL, ["ringkas", "lengkap", "tanpa"]);
  assert.equal(modeLabelDari(null, null), "ringkas");
  assert.equal(modeLabelDari(null, "lengkap"), "lengkap");
  assert.equal(modeLabelDari("tanpa", "lengkap"), "tanpa");
  assert.equal(modeLabelDari("semua", "<x>"), "ringkas");
});

test("detail ikut zoom: seluruh denah = jauh; satu langkah + (×0,7) = dekat", () => {
  assert.equal(tingkatRincian(60, 60), "jauh");
  assert.equal(tingkatRincian(60 * 1.2, 60), "jauh");
  assert.equal(tingkatRincian(60 * 0.7, 60), "dekat");
  assert.equal(tingkatRincian(60 * AMBANG_DEKAT, 60), "dekat");
  assert.equal(tingkatRincian(60 * AMBANG_DEKAT * (1 + 1e-15), 60), "dekat");   // tombol + keyboard (×0,75) dengan galat pembulatan
  assert.equal(tingkatRincian(60 * 0.8, 60), "jauh");
  assert.equal(tingkatRincian(30, 0), "jauh");   // belum terukur
});

test("ringkas & jauh: titik status tanpa teks; siap tanpa titik; hanya 'Menunggu Anda' berlabel penuh", () => {
  for (const status of STATUS) {
    const t = tampilanOrang({ status, mode: "ringkas", tingkat: "jauh" });
    assert.equal(t.nama, false, `${status}: tanpa nama`);
    assert.equal(t.penuh, status === "menunggu", `${status}: label penuh hanya untuk menunggu`);
    assert.equal(t.titik, !["menunggu", "siap"].includes(status), `${status}: titik`);
  }
});

test("ringkas & dekat: nama kecil untuk semua (siap ikut bertitik); lengkap = nama di semua zoom", () => {
  for (const status of ["bekerja", "berpikir", "selesai", "siap"]) {
    assert.deepEqual(tampilanOrang({ status, mode: "ringkas", tingkat: "dekat" }), { titik: true, nama: true, penuh: false });
    assert.deepEqual(tampilanOrang({ status, mode: "lengkap", tingkat: "jauh" }), { titik: true, nama: true, penuh: false });
  }
  assert.deepEqual(tampilanOrang({ status: "menunggu", mode: "lengkap", tingkat: "jauh" }), { titik: false, nama: false, penuh: true });
});

test("tanpa label: tidak ada teks; 'Menunggu Anda' tetap terlihat sebagai titik !", () => {
  for (const status of STATUS) {
    const t = tampilanOrang({ status, mode: "tanpa", tingkat: "dekat" });
    assert.equal(t.nama || t.penuh, false);
    assert.equal(t.titik, status === "menunggu");
  }
});

test("orang yang disentuh & kursi tim kosong tidak berlabel kepala (kartu sentuh menggantikan)", () => {
  for (const mode of MODE_LABEL) {
    assert.deepEqual(tampilanOrang({ status: "menunggu", mode, disentuh: true }), { titik: false, nama: false, penuh: false });
    assert.deepEqual(tampilanOrang({ status: "kosong", mode, tingkat: "dekat" }), { titik: false, nama: false, penuh: false });
  }
});

test("penempatan label: dua 'Menunggu Anda' berimpit saling menghindar (keduanya tampil, tidak bertumpuk); opsional mengalah", () => {
  const lbl = (px, py, prio, jarak = 10, w = 150, h = 22) => ({ px, py, w, h, prio, jarak });
  const bertumpuk = (a, b) => Math.abs(a.px - b.px) < (a.w + b.w) / 2 - 1 && Math.abs((a.py - a.h / 2) - (b.py - b.h / 2)) < (a.h + b.h) / 2 - 1;   // jangkar bawah-tengah
  // HP seluruh denah: dua orang berjarak 2,2 m ≈ 18 px → kotak hampir berimpit
  const a = lbl(200, 300, PRIO_WAJIB, 10), b = lbl(218, 302, PRIO_WAJIB, 11), titik = lbl(205, 296, 3, 9, 14, 14), nama = lbl(200, 280, 2, 9, 40, 12);
  const kalah = tempatkanLabel([titik, b, nama, a], 390);
  assert.equal(kalah.has(a) || kalah.has(b), false, "label wajib tidak pernah disembunyikan");
  assert.equal(bertumpuk(a, b), false, "dua label menunggu tidak saling menutup");
  for (const o of [titik, nama]) assert.ok(kalah.has(o) || (!bertumpuk(o, a) && !bertumpuk(o, b)), "label opsional disembunyikan atau digeser, tidak menimpa label wajib");
  assert.ok(kalah.has(titik), "titik yang terkepung disembunyikan");
  // kartu sentuh (6) di atas label menunggu (5,5): keduanya tampil tanpa tumpuk
  const k = lbl(200, 300, 6, 10, 220, 50), m = lbl(205, 300, PRIO_WAJIB, 10);
  assert.equal(tempatkanLabel([m, k], 390).size, 0);
  assert.equal(bertumpuk(k, m), false);
  // penuh sesak: label wajib tetap tampil (boleh bertumpuk bila semua langkah terpakai), dijepit di dalam kanvas
  const banyak = Array.from({ length: 12 }, (_, i) => lbl(380, 300 + i, PRIO_WAJIB, i));
  assert.equal(tempatkanLabel(banyak, 390).size, 0);
  for (const l of banyak) assert.ok(l.px - l.w / 2 >= 4 - 1e-9 && l.px + l.w / 2 <= 390);
});

test("gelembung ucapan hanya saat diperbesar atau mode lengkap", () => {
  assert.equal(ucapanTampil("ringkas", "jauh"), false);
  assert.equal(ucapanTampil("ringkas", "dekat"), true);
  assert.equal(ucapanTampil("lengkap", "jauh"), true);
  assert.equal(ucapanTampil("tanpa", "dekat"), false);
});

test("tulisan lantai: zona belakang di lorong depan pintunya (di luar bayangan partisi depan), zona depan di lis depan; tidak menimpa perabot", () => {
  const { perabot } = bangunDenah();
  for (const [id, k] of Object.entries(KOTAK_TULISAN)) {
    const [x0, y0, x1, y1] = k, z = ZONA[id];
    assert.ok(x0 < x1 && y0 < y1, id);
    assert.ok(x0 >= z[0] - 0.4 && x1 <= z[2] + 0.4, `${id} sejajar zonanya`);
    if (z[1] === 0) {
      assert.ok(y0 >= z[3] && y1 <= 10.1, `${id} di lorong`);
      // partisi depan lorong (y 10,1; tinggi 0,5 m) menutupi lantai sejauh 0,5·tan(58°) ≈ 0,8 m di belakangnya
      assert.ok(y1 <= 10.1 - 0.5 * Math.tan((58 * Math.PI) / 180), `${id} tidak tertutup partisi depan`);
    } else assert.ok(y0 >= LIS_DEPAN.y0 && y1 <= LIS_DEPAN.y1, `${id} di lis depan`);
    for (const p of perabot) {
      if (p.lewat) continue;
      const kena = p.x < x1 && p.x + p.w > x0 && p.y < y1 && p.y + p.d > y0;
      assert.ok(!kena, `${id} menimpa ${p.jenis} di ${p.x},${p.y}`);
    }
  }
});

test("tulisan lorong tidak tertutup benda tinggi baris depan dari kamera bawaan (azimut 45°, 58° dari vertikal)", () => {
  // puncak benda setinggi h jatuh ke lantai h·tan(58°)·sin/cos(45°) ≈ 1,13·h ke kiri & ke belakang (menuju dinding belakang)
  const geser = Math.tan((58 * Math.PI) / 180) * Math.SQRT1_2;
  const TINGGI = { "kursi-pimpinan": (p) => p.tinggi, "pembatas-tanaman": () => 1.25, "bar-kopi": () => 1.5, "lampu-lantai": () => 1.7,
    "meja-pimpinan": () => 1.25, meja: () => 1.25, tanaman: (p) => 1.3 * (p.besar ?? 1), kursi: () => 1.0 };
  const { perabot } = bangunDenah();
  for (const id of ["pimpinan", "tim1", "tim2", "tim3"]) {
    const [x0, y0, x1, y1] = KOTAK_TULISAN[id];
    for (const p of perabot) {
      if (p.y < 10 || p.jenis === "kaca") continue;   // hanya benda di depan lorong (kaca tembus pandang)
      const h = p.h ?? TINGGI[p.jenis]?.(p) ?? 1.0, s = h * geser;
      const kena = p.x - s < x1 && p.x + p.w > x0 && p.y - s < y1 && p.y + p.d > y0;
      assert.ok(!kena, `${id} tertutup ${p.jenis} (${p.x}, ${p.y}, tinggi ${h})`);
    }
  }
});

test("tulisan lantai: satu baris — nama zona, proyek tim, tim tanpa proyek diredupkan; HP = nama tim pendek", () => {
  const tim = [{ n: 1, proyek: "kasir", aktif: true }, { n: 2, proyek: null, aktif: true }];
  const z = Object.fromEntries(tulisanZona(DIVISI, { tim }).map((t) => [t.id, t]));
  assert.deepEqual(Object.keys(z).sort(), Object.keys(KOTAK_TULISAN).sort());
  assert.equal(z.tim1.baris[0].teks, "Tim 1 · kasir");
  assert.equal(z.tim2.baris[0].teks, "Tim 2 · proyek belum terdaftar");
  assert.equal(z.tim3.redup, true); assert.equal(z.tim3.baris[0].teks, "Tim 3");
  assert.equal(z.tim1.redup, false);
  assert.equal(z.pimpinan.baris[0].teks, "Ruang Pimpinan");
  assert.equal(z.lounge.baris[0].teks, "Lounge");
  const hp = Object.fromEntries(tulisanZona(DIVISI, { tim, sempit: true }).map((t) => [t.id, t]));
  assert.equal(hp.tim1.baris[0].teks, "Tim 1 · kasir");
  assert.equal(hp.tim2.baris[0].teks, "Tim 2");
  assert.equal(hp.tim3.baris[0].teks, "Tim 3");
});
