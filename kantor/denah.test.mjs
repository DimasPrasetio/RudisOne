// Denah Kantor 3D (kantor/app/denah.mjs): data murni — semua kursi & titik santai terjangkau dari pintu, perabot di dalam lantai.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GX, KURSI, NX, NY, PINTU, RES, TIM, URUT, atasanDari, bangunDenah, bangunGrid, cariJalur, hadapMeja } from "./app/denah.mjs";

const denah = bangunDenah(), blok = bangunGrid(denah.perabot);

test("setiap kursi organisasi punya data tampilan dan meja di denah", () => {
  assert.deepEqual(Object.keys(KURSI).sort(), [...URUT].sort());
  const meja = new Set(denah.perabot.filter((p) => p.agen).map((p) => p.agen));
  for (const nama of URUT) assert.ok(meja.has(nama), `meja ${nama}`);
  for (const nama of URUT) assert.ok(TIM[nama].warna && TIM[nama].pendek, nama);
});

test("semua kursi, kursi tamu, titik santai, dan meja bantuan terjangkau dari pintu masuk", () => {
  const tujuan = [
    ...URUT.map((n) => [n, KURSI[n].duduk]),
    ...URUT.flatMap((n) => (KURSI[n].tamu ?? []).map((t) => [`tamu ${n}`, [t[0], t[1]]])),
    ...denah.tempat.map((t, i) => [`santai ${i} (${t.jenis})`, [t.x, t.y]]),
    ...Object.entries(denah.mejaBantu).flatMap(([k, ts]) => ts.map((t, i) => [`bantu ${k}.${i}`, [t.x, t.y]])),
  ];
  for (const [nama, xy] of tujuan) {
    const rute = cariJalur(blok, PINTU, xy);
    assert.ok(rute, `tidak ada jalan ke ${nama}`);
    assert.deepEqual(rute.at(-1), xy, nama);
  }
});

test("perabot berada di dalam lantai dan berukuran positif", () => {
  for (const p of denah.perabot) {
    assert.ok(p.w > 0 && p.d > 0, `${p.jenis} ukuran`);
    assert.ok(p.x >= -0.3 && p.y >= -0.3 && p.x + p.w <= NX + 0.01 && p.y + p.d <= NY + 0.01, `${p.jenis} di (${p.x}, ${p.y}) keluar lantai`);
  }
});

test("titik belok rute berada di sel bebas dan antar-belokan sejajar sumbu", () => {
  const rute = cariJalur(blok, PINTU, KURSI["System Administrator"].duduk), tengah = rute.slice(0, -1);
  for (const [x, y] of tengah) assert.equal(blok[Math.floor(y * RES) * GX + Math.floor(x * RES)], 0, `(${x}, ${y}) terhalang`);
  for (let i = 1; i < tengah.length; i++) {
    const [[x0, y0], [x1, y1]] = [tengah[i - 1], tengah[i]];
    assert.ok(Math.abs(x1 - x0) < 1e-9 || Math.abs(y1 - y0) < 1e-9, `segmen ${i} miring`);
  }
});

test("rantai komando & arah hadap meja", () => {
  assert.ok(atasanDari("COO", "Software Engineer #1 · Tim 2"));
  assert.ok(atasanDari("Head of IT Operations", "System Administrator"));
  assert.ok(!atasanDari("System Administrator", "Head of IT Operations"));
  assert.equal(hadapMeja("COO"), 0);                     // pimpinan menghadap ruangan
  assert.equal(hadapMeja("Research Analyst"), Math.PI);   // anggota menghadap mejanya
});
