// Aturan label Kantor (kantor/app/label.mjs): mode tombol Label, tingkat rincian ikut zoom, tampilan per orang, tulisan
// lantai zona. Jalankan: node --test kantor/
import { test } from "node:test";
import assert from "node:assert/strict";
import { DIVISI, KURSI, TINGGI_DINDING, ZONA, bangunDenah } from "./app/denah.mjs";
import { AMBANG_DEKAT, AZIMUT_PAPAN, KOTAK_TULISAN, LIS_DEPAN, PAPAN_ATAS_DINDING, PAPAN_ZONA, WARNA_PAPAN, isiPapanZona, kontras, penandaZona, PRIO_WAJIB, tempatkanLabel, MODE_LABEL, modeLabelDari, tampilanOrang, tingkatRincian, tulisanZona, ucapanTampil } from "./app/label.mjs";

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

test("penempatan label: geser tidak pernah mendorong label keluar kanvas (tiga 'Menunggu Anda' dekat tepi atas HP)", () => {
  // posisi kepala Corporate Strategy di HP seluruh denah (tinggi kanvas 377 px): FC (60, 49), HoS (120, 58), RA (65, 67)
  const lbl = (px, py, jarak) => ({ px, py, w: 130, h: 23, prio: PRIO_WAJIB, jarak });
  const fc = lbl(60, 49, 3), hos = lbl(120, 58, 2), ra = lbl(65, 67, 1);
  assert.equal(tempatkanLabel([fc, hos, ra], 375, 377).size, 0);
  for (const [nama, l] of Object.entries({ fc, hos, ra })) {
    const asal = { fc: 49, hos: 58, ra: 67 }[nama];
    assert.ok((l.py - l.h >= 0 && l.py <= 377) || l.py === asal, `${nama} di dalam kanvas atau di posisi asalnya (py ${l.py})`);
  }
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

test("papan zona: zona belakang di atas dinding belakang (selebar zonanya), zona depan berdiri di lis depan", () => {
  for (const [id, [x0, x1, y, z0, z1]] of Object.entries(PAPAN_ZONA)) {
    const z = ZONA[id];
    assert.ok(x0 < x1 && z0 < z1, id);
    if (z[1] === 0) {
      assert.ok(y === PAPAN_ATAS_DINDING.y && z0 > TINGGI_DINDING && z1 - z0 >= 0.9, `${id}: di atas dinding belakang, tinggi ≥ 0,9 m`);
      assert.ok(x0 >= z[0] && x1 <= z[2], `${id}: sejajar zonanya`);
    } else {
      assert.ok(z1 <= 1.3, `${id}: rendah`);
      assert.ok(y > LIS_DEPAN.y0 && y < LIS_DEPAN.y1 && z0 === LIS_DEPAN.z, `${id}: berdiri di lis depan`);
      assert.ok(x0 >= z[0] - 0.6 && x1 <= z[2] + 0.6, `${id}: sejajar zonanya`);
    }
  }
  const depan = Object.entries(PAPAN_ZONA).filter(([id]) => ZONA[id][1] > 0).map(([, p]) => p).sort((p, q) => p[0] - q[0]);
  for (let i = 1; i < depan.length; i++) assert.ok(depan[i][0] - depan[i - 1][1] >= 0.3, "papan depan tidak bersambung");
});

test("papan zona tidak menutupi meja, kursi, orang, atau cincin 'Menunggu Anda' dari kamera perspektif nyata", async () => {
  const THREE = await import("./vendor/three/build/three.module.js");
  const { hitungPas } = await import("./app/kamera.mjs");
  const { perabot } = bangunDenah();
  // titik yang harus terlihat (koordinat three: x, tinggi, z = y denah)
  const titik = [];
  for (const [nama, k] of Object.entries(KURSI)) {
    const [x, y] = k.duduk;
    for (let a = -75; a <= 75; a += 15) { const r = (a * Math.PI) / 180; titik.push([`cincin ${nama}`, x + 0.62 * Math.sin(r), 0.03, y + 0.62 * Math.cos(r)]); }
    for (const dx of [-0.22, 0, 0.22]) titik.push([`kursi ${nama}`, x + dx, 0.45, y]);
    titik.push([`orang ${nama}`, x, 0.9, y], [`orang ${nama}`, x, 1.6, y]);
  }
  for (const p of perabot.filter((q) => /^(meja|meja-pimpinan|meja-bantu)$/.test(q.jenis)))
    for (const [fx, fy] of [[0.1, 0.9], [0.5, 0.9], [0.9, 0.9], [0.5, 0.5]]) titik.push([`${p.jenis} ${p.agen ?? ""}`, p.x + p.w * fx, 0.76, p.y + p.d * fy]);
  const der = (x) => (x * Math.PI) / 180;
  for (const aspek of [1.5, 1.77, 2.0]) for (const az of [15, 30, 45, 62]) {   // rentang azimut tempat papan tampil (≤ 62°)
    const { posisi: c } = hitungPas(THREE, { aspect: aspek, az: der(az), polar: 1.01, kotak: { x: [-0.25, 40], y: [-0.45, 2.6], z: [-0.25, LIS_DEPAN.y1] },
      ekstra: [[-0.25, PAPAN_ATAS_DINDING.z1, -0.25], [40, PAPAN_ATAS_DINDING.z1, -0.25]] });
    for (const [id, [x0, x1, yb, z0, z1]] of Object.entries(PAPAN_ZONA)) for (const [nama, px, py, pz] of titik) {
      const u = (yb - c.z) / (pz - c.z);           // titik potong ruas kamera→titik dengan bidang papan (z = yb)
      if (!(u > 0 && u < 1)) continue;
      const hx = c.x + (px - c.x) * u, hy = c.y + (py - c.y) * u;
      assert.ok(!(hx > x0 && hx < x1 && hy > z0 && hy < z1), `papan ${id} menutupi ${nama} (aspek ${aspek}, azimut ${az}°, tinggi potong ${hy.toFixed(2)} m)`);
    }
  }
});

test("papan zona: isi (Tim n · proyek), kontras pelat ≥ 4,5:1 (teks redup ≥ 4,5:1); papan dari depan, lantai dari samping", () => {
  const z = Object.fromEntries(isiPapanZona(DIVISI, { tim: [{ n: 1, proyek: "RudisOne", aktif: true }] }).map((x) => [x.id, x]));
  assert.deepEqual(Object.keys(z).sort(), Object.keys(PAPAN_ZONA).sort());
  assert.deepEqual(z.tim1.bagian.map((b) => b.teks), ["Tim 1", " · RudisOne"]);
  assert.equal(z.tim3.redup, true); assert.deepEqual(z.tim3.bagian.map((b) => b.teks), ["Tim 3"]);
  const panjang = isiPapanZona(DIVISI, { tim: [{ n: 2, proyek: "sistem-informasi-gudang", aktif: true }] }).find((x) => x.id === "tim2");
  assert.equal(panjang.bagian[1].teks, " · sistem-informas…");
  assert.equal(z.corp.bagian[0].teks, "Corporate Strategy");
  for (const w of Object.values(WARNA_PAPAN)) {
    assert.ok(kontras(w.tinta, w.pelat) >= 7, "tinta");
    assert.ok(kontras(w.redup, w.pelat) >= 4.5, "redup");
  }
  assert.ok(Math.abs(kontras("#000000", "#ffffff") - 21) < 1e-9);
  const der = (x) => (x * Math.PI) / 180;
  assert.equal(penandaZona(der(45)), "papan");   // laptop bawaan
  assert.equal(penandaZona(der(15)), "papan");   // batas putar kiri
  assert.equal(penandaZona(der(74)), "lantai");  // HP bawaan
  assert.equal(penandaZona(AZIMUT_PAPAN + 1e-9), "lantai");
});
