// Tombol "Layar penuh" denah 3D (kantor/app/layarpenuh.mjs) dengan DOM tiruan, rasio piksel kanvas (kamera.mjs), dan
// letak tombol/penanda di halaman. Perilaku di peramban nyata (Enter/Spasi, ukuran kanvas, tangkapan layar): pemeriksaan
// Playwright di handoff tugas. Jalankan: node --test kantor/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEKS_LAYAR_PENUH, dukungLayarPenuh, pasangLayarPenuh } from "./app/layarpenuh.mjs";
import { PIKSEL_MAKS, rasioPiksel } from "./app/kamera.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

class Sasaran {
  constructor() { this.dengar = {}; }
  addEventListener(jenis, f) { (this.dengar[jenis] ??= []).push(f); }
  kirim(jenis, isi = {}) {
    const e = { type: jenis, dicegah: false, preventDefault() { this.dicegah = true; }, ...isi };
    for (const f of this.dengar[jenis] ?? []) f(e);
    return e;
  }
}
function elemen() {
  const e = new Sasaran(), kelas = new Set(), atr = {};
  e.classList = { toggle: (k, ya) => (ya ? kelas.add(k) : kelas.delete(k)), contains: (k) => kelas.has(k) };
  e.setAttribute = (k, v) => { atr[k] = String(v); }; e.getAttribute = (k) => atr[k] ?? null; e.title = "";
  return e;
}
/** Dokumen + wadah + tombol tiruan. `api`: "standar" | "webkit" | "tidak" (Safari iPhone) | "tolak" (permintaan ditolak). */
function siapkan(api = "standar", opsi = {}) {
  const doc = new Sasaran(), wadah = elemen(), tombol = elemen(), akar = elemen(), teks = { textContent: "Layar penuh" };
  tombol.querySelector = (s) => (s === ".teks" ? teks : null);
  const catat = { minta: 0, lepas: 0, ubah: [] };
  const masukAsli = () => { catat.minta++; doc[api === "webkit" ? "webkitFullscreenElement" : "fullscreenElement"] = wadah; doc.kirim(api === "webkit" ? "webkitfullscreenchange" : "fullscreenchange"); };
  if (api === "standar" || api === "tolak") {
    doc.fullscreenEnabled = true; doc.fullscreenElement = null;
    wadah.requestFullscreen = async () => { if (api === "tolak") { catat.minta++; throw new TypeError("Permissions check failed"); } masukAsli(); };
    doc.exitFullscreen = async () => { catat.lepas++; doc.fullscreenElement = null; doc.kirim("fullscreenchange"); };
  } else if (api === "webkit") {
    doc.webkitFullscreenEnabled = true; doc.webkitFullscreenElement = null;
    wadah.webkitRequestFullscreen = () => masukAsli();   // versi lama: tanpa promise
    doc.webkitExitFullscreen = () => { catat.lepas++; doc.webkitFullscreenElement = null; doc.kirim("webkitfullscreenchange"); };
  }
  const lp = pasangLayarPenuh({ wadah, tombol, doc, akar, onUbah: (aktif, mode) => catat.ubah.push([aktif, mode]), ...opsi });
  const klik = async () => { tombol.kirim("click"); await new Promise((s) => setTimeout(s, 0)); };
  return { doc, wadah, tombol, akar, teks, catat, lp, klik };
}
const tampakNormal = ({ wadah, tombol, teks, akar }) => {
  assert.equal(teks.textContent, "Layar penuh"); assert.equal(tombol.getAttribute("aria-label"), "Layar penuh");
  assert.ok(!wadah.classList.contains("layar-penuh") && !wadah.classList.contains("layar-penuh-cadangan") && !akar.classList.contains("kunci-gulir"));
};

test("label tombol: 'Layar penuh' ↔ 'Keluar dari layar penuh'; label aksesibel memuat teks yang tampil (WCAG 2.5.3)", () => {
  assert.equal(TEKS_LAYAR_PENUH.masuk.label, "Layar penuh");
  assert.equal(TEKS_LAYAR_PENUH.keluar.label, "Keluar dari layar penuh");
  for (const t of Object.values(TEKS_LAYAR_PENUH)) assert.ok(t.label.toLowerCase().includes(t.teks.toLowerCase()), t.label);
  assert.match(TEKS_LAYAR_PENUH.keluar.judul, /Esc/);
});

test("Fullscreen API: klik masuk (wadah layar penuh, label berubah), klik lagi keluar", async () => {
  const k = siapkan("standar");
  tampakNormal(k);
  await k.klik();
  assert.equal(k.lp.mode, "asli"); assert.equal(k.catat.minta, 1);
  assert.ok(k.wadah.classList.contains("layar-penuh") && !k.wadah.classList.contains("layar-penuh-cadangan"));
  assert.ok(!k.akar.classList.contains("kunci-gulir"), "layar penuh asli tidak mengunci gulir halaman");
  assert.equal(k.teks.textContent, "Keluar"); assert.equal(k.tombol.getAttribute("aria-label"), "Keluar dari layar penuh");
  await k.klik();
  assert.equal(k.lp.mode, null); assert.equal(k.catat.lepas, 1);
  tampakNormal(k);
  assert.deepEqual(k.catat.ubah, [[true, "asli"], [false, null]], "onUbah sekali per perubahan (event + promise tidak dobel)");
});

test("Esc / keluar lewat peramban (fullscreenchange) mengembalikan tampilan semula", async () => {
  const k = siapkan("standar");
  await k.klik();
  k.doc.fullscreenElement = null; k.doc.kirim("fullscreenchange");   // peramban menangani Esc sendiri
  assert.equal(k.lp.mode, null); tampakNormal(k);
  assert.deepEqual(k.catat.ubah.at(-1), [false, null]);
  // Esc yang sampai ke halaman (peramban tidak menanganinya) → halaman keluar dari layar penuh asli
  await k.klik(); assert.equal(k.lp.mode, "asli");
  const esc = k.doc.kirim("keydown", { key: "Escape" }); await new Promise((s) => setTimeout(s, 0));
  assert.ok(esc.dicegah); assert.equal(k.catat.lepas, 1); assert.equal(k.lp.mode, null); tampakNormal(k);
});

test("awalan webkit (Safari iPad/Mac lama) dipakai bila API standar tidak ada", async () => {
  const k = siapkan("webkit");
  assert.ok(dukungLayarPenuh(k.doc, k.wadah));
  await k.klik(); assert.equal(k.lp.mode, "asli"); assert.equal(k.catat.minta, 1);
  await k.klik(); assert.equal(k.lp.mode, null); assert.equal(k.catat.lepas, 1); tampakNormal(k);
});

test("mode cadangan bila Fullscreen API tidak ada (Safari iPhone): memenuhi jendela, gulir dikunci, Esc atau tombol keluar", async () => {
  const k = siapkan("tidak");
  assert.ok(!dukungLayarPenuh(k.doc, k.wadah));
  k.doc.defaultView = { scrollY: 300, scrollTo(_, y) { this.scrollY = y; } };
  await k.klik();
  k.doc.defaultView.scrollY = 700;   // halaman sempat bergeser di belakang
  k.doc.kirim("keydown", { key: "Escape" });
  assert.equal(k.doc.defaultView.scrollY, 300, "posisi gulir dikembalikan seperti sebelum masuk");
  await k.klik();
  assert.equal(k.lp.mode, "cadangan");
  assert.ok(k.wadah.classList.contains("layar-penuh") && k.wadah.classList.contains("layar-penuh-cadangan") && k.akar.classList.contains("kunci-gulir"));
  assert.equal(k.tombol.getAttribute("aria-label"), "Keluar dari layar penuh");
  const esc = k.doc.kirim("keydown", { key: "Escape" });
  assert.ok(esc.dicegah); assert.equal(k.lp.mode, null); tampakNormal(k);
  await k.klik(); assert.equal(k.lp.mode, "cadangan");
  await k.klik(); assert.equal(k.lp.mode, null); tampakNormal(k);
  assert.ok(!k.doc.kirim("keydown", { key: "Escape" }).dicegah, "Esc di luar layar penuh tidak diambil (tutup kartu tetap jalan)");
  assert.ok(!k.doc.kirim("keydown", { key: "Enter" }).dicegah);
});

test("permintaan layar penuh ditolak peramban → mode cadangan; paksaCadangan (?uji-tanpa-layar-penuh) → cadangan", async () => {
  const k = siapkan("tolak");
  await k.klik(); assert.equal(k.catat.minta, 1); assert.equal(k.lp.mode, "cadangan");
  const p = siapkan("standar", { paksaCadangan: true });
  await p.klik(); assert.equal(p.catat.minta, 0); assert.equal(p.lp.mode, "cadangan");
});

test("rasio piksel kanvas mengikuti layar: ≤ 2 (sentuh 1,5), jumlah piksel ≤ ±4K, tidak pernah di bawah 1 karena batas itu", () => {
  assert.equal(rasioPiksel(1400, 700, 2, false), 2, "denah biasa di laptop Retina tetap tajam");
  assert.equal(rasioPiksel(1512, 982, 2, false), 2, "layar penuh laptop 14\" tetap 2");
  const besar = rasioPiksel(2560, 1440, 2, false);
  assert.ok(besar < 2 && besar >= 1.4, `monitor besar diturunkan (${besar})`);
  assert.ok(2560 * 1440 * besar ** 2 <= PIKSEL_MAKS + 1);
  assert.equal(rasioPiksel(390, 844, 3, true), 1.5, "HP: 1,5");
  assert.equal(rasioPiksel(5120, 2880, 1, false), 1, "tidak di bawah 1");
  assert.equal(rasioPiksel(800, 600, 0.8, false), 0.8, "peramban diperkecil: ikut dpr");
});

test("halaman: tombol Layar penuh & penanda 'Menunggu Anda' berada di kartu denah (kontrol ikut tampil saat layar penuh)", () => {
  const html = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
  const awal = html.indexOf('<section class="denah kartu"'), akhir = html.indexOf("</section>", awal);
  const denah = html.slice(awal, akhir);
  assert.match(denah, /<button type="button" class="tombol tombol-penuh" id="layar-penuh" aria-label="Layar penuh"/);
  assert.match(denah, /<span class="teks">Layar penuh<\/span>/);
  for (const id of ["putar-kiri", "putar-kanan", "zoom-kecil", "zoom-besar", "zoom-pas", "pilih-label", "jeda", "panggung"])
    assert.ok(denah.includes(`id="${id}"`), `${id} ada di dalam wadah layar penuh`);
  assert.match(denah, /id="penanda-menunggu"[^>]*hidden>.*Menunggu Anda<\/button>/);
  const js = fs.readFileSync(path.join(HERE, "app", "kantor.mjs"), "utf8");
  assert.match(js, /pasangLayarPenuh\(\{ wadah: elPanggung\.closest\("\.denah"\)/);
  assert.match(js, /PARAM\.has\("uji-tanpa-layar-penuh"\)/);
});
