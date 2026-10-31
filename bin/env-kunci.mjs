#!/usr/bin/env node
// Cek kunci .env TANPA nilai. Agent dilarang membaca isi .env; kebutuhan sahnya — "kunci X terisi
// atau kosong?" — dijawab di sini: berkas dibaca di proses ini dan yang dilaporkan HANYA nama kunci + status. Nilai,
// panjang nilai, potongan nilai, atau baris mentah tidak pernah dicetak — juga tidak di pesan galat (galat baca hanya
// menyebut path + kode errno).
// Pemakaian: bin/env-kunci.sh [--contoh <berkas>] [--wajib K1,K2] [--salah-satu K1,K2]… [--json] [<berkas>]
// Status: terisi | kosong | placeholder | hilang (di contoh/wajib, tidak di berkas) | tambahan (di berkas, tidak di contoh).
// Exit: 0 lengkap · 3 kurang (wajib kosong/hilang, grup salah-satu tanpa yang terisi, berkas tidak ada)
//       · 4 placeholder (tidak ada kasus 3, tetapi wajib/grup hanya berisi placeholder) · 1 galat.
import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const POLA_KUNCI = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const BARIS_KUNCI = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/;
const PLACEHOLDER = [/^__[A-Z0-9_]+__$/, /^change[-_]?me$/i, /^<[^>]*>$/, /^x{3,}$/i, /^(todo|isi|isi-di-sini|your[-_].*)$/i];
const HASIL = { 0: "lengkap", 3: "kurang", 4: "placeholder" };
const NAMA_ENV = /^(\.env(\.[\w.-]+)?|[\w-][\w.-]*\.env(\.[\w-]+)?|\.envrc)$/i;

export const PEMAKAIAN = `Pemakaian: bin/env-kunci.sh [--contoh <berkas>] [--wajib K1,K2] [--salah-satu K1,K2]… [--json] [<berkas>]
  <berkas>            berkas env yang diperiksa (bawaan: .env di folder kerja)
  --contoh <berkas>   berkas contoh (bawaan: <berkas>.example, lalu .env.example di folder yang sama bila ada)
  --wajib K1,K2       kunci wajib (bawaan bila --wajib dan --salah-satu tidak ada: semua kunci di contoh)
  --salah-satu K1,K2  grup: minimal satu kunci terisi (boleh diulang)
  --json              keluaran JSON { berkas, contoh, ada, kunci: [{nama, status}], hasil, exit }
Hanya nama kunci + status yang dicetak; nilai tidak pernah.
Exit: 0 lengkap · 3 kurang (termasuk berkas tidak ada) · 4 hanya placeholder · 1 galat.`;

class Galat extends Error {}

/** Parser sederhana untuk Node tanpa util.parseEnv: komentar #, `export K=`, kutip tunggal/ganda/backtick
 *  (boleh multi-baris), baris kosong. Mengembalikan Map kunci → nilai (kunci terakhir menang). */
export function uraiFallback(teks) {
  const hasil = new Map();
  const baris = teks.split("\n");
  for (let i = 0; i < baris.length; i++) {
    const m = BARIS_KUNCI.exec(baris[i]);
    if (!m) continue;
    let sisa = m[2].replace(/^\s+/, "");
    const q = sisa[0];
    let nilai;
    if (q === '"' || q === "'" || q === "`") {
      let isi = sisa.slice(1), tutup = isi.indexOf(q), j = i;
      while (tutup < 0 && j + 1 < baris.length) { j++; isi += "\n" + baris[j]; tutup = isi.indexOf(q); }
      if (tutup < 0) nilai = sisa.split("#")[0].trim();   // kutip tak tertutup: perlakukan sebagai nilai polos
      else { nilai = isi.slice(0, tutup); i = j; if (q === '"') nilai = nilai.replace(/\\n/g, "\n"); }
    } else nilai = sisa.split("#")[0].trim();
    hasil.set(m[1], nilai);
  }
  return hasil;
}

/** Urai teks env → Map kunci → nilai, urut sesuai berkas. Nilai dari util.parseEnv (semantik `node --env-file`) bila
 *  ada; kunci yang tidak dikenali parseEnv (mis. baris tanpa `=` menelan baris berikutnya) dilengkapi dari parser
 *  sederhana. Urutan diambil dari parser sederhana karena parseEnv mengembalikan kunci terurut abjad. */
export function uraiEnv(teks, { paksaFallback = false } = {}) {
  teks = teks.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cadangan = uraiFallback(teks);
  if (paksaFallback || typeof util.parseEnv !== "function") return cadangan;
  let utama;
  try { utama = util.parseEnv(teks); } catch { return cadangan; }
  const ada = (k) => Object.prototype.hasOwnProperty.call(utama, k);
  const hasil = new Map();
  for (const [k, v] of cadangan) hasil.set(k, ada(k) ? String(utama[k]) : v);
  for (const [k, v] of Object.entries(utama)) if (POLA_KUNCI.test(k) && !hasil.has(k)) hasil.set(k, String(v));
  return hasil;
}

/** Status satu nilai: kosong | placeholder | terisi. */
export function statusNilai(nilai) {
  const v = String(nilai).trim();
  if (v === "") return "kosong";
  return PLACEHOLDER.some((p) => p.test(v)) ? "placeholder" : "terisi";
}

/** Fungsi murni. `teks` = isi berkas (null = berkas tidak ada); opsi: { contohTeks, wajib: [], salahSatu: [[…]],
 *  paksaFallback }. Mengembalikan { ada, kunci: [{nama, status}], hasil, exit } — tanpa nilai. */
export function periksa(teks, { contohTeks = null, wajib = [], salahSatu = [], paksaFallback = false } = {}) {
  const ada = teks !== null && teks !== undefined;
  const env = ada ? uraiEnv(teks, { paksaFallback }) : new Map();
  const contoh = contohTeks === null || contohTeks === undefined ? null : [...uraiEnv(contohTeks, { paksaFallback }).keys()];
  const himpWajib = wajib.length || salahSatu.length ? [...wajib] : [...(contoh ?? [])];
  const diminta = new Set([...himpWajib, ...salahSatu.flat()]);
  const diContoh = new Set(contoh ?? []);

  const status = (k) => {
    if (!env.has(k)) return "hilang";
    if (contoh && !diContoh.has(k) && !diminta.has(k)) return "tambahan";
    return statusNilai(env.get(k));
  };
  const urutan = [...new Set([...himpWajib, ...salahSatu.flat(), ...(contoh ?? []), ...env.keys()])];
  const kunci = urutan.map((nama) => ({ nama, status: status(nama) }));

  const st = new Map(kunci.map((k) => [k.nama, k.status]));
  let kurang = !ada, ph = false;
  for (const k of himpWajib) {
    if (st.get(k) === "kosong" || st.get(k) === "hilang") kurang = true;
    else if (st.get(k) === "placeholder") ph = true;
  }
  for (const grup of salahSatu) {
    if (grup.some((k) => st.get(k) === "terisi")) continue;
    if (grup.some((k) => st.get(k) === "placeholder")) ph = true; else kurang = true;
  }
  const exit = kurang ? 3 : ph ? 4 : 0;
  return { ada, kunci, hasil: HASIL[exit], exit };
}

/** Urai argv → { berkas, contoh, wajib, salahSatu, json, bantuan }. Melempar Galat untuk argumen salah. */
export function uraiArgumen(argv) {
  const o = { berkas: null, contoh: null, wajib: [], salahSatu: [], json: false, bantuan: false };
  const daftarKunci = (nilai, opsi) => {
    const ks = String(nilai).split(",").map((s) => s.trim()).filter(Boolean);
    if (!ks.length) throw new Galat(`${opsi} butuh daftar kunci (K1,K2)`);
    for (const k of ks) if (!POLA_KUNCI.test(k)) throw new Galat(`nama kunci tidak sah di ${opsi}`);
    return ks;
  };
  const setBerkas = (p) => { if (o.berkas !== null) throw new Galat("hanya satu berkas"); o.berkas = p; };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], nilai;
    const sama = /^(--[a-z-]+)=(.*)$/s.exec(a);
    if (sama) [, a, nilai] = sama;
    const ambil = () => {
      if (nilai !== undefined) return nilai;
      if (i + 1 >= argv.length) throw new Galat(`${a} butuh nilai`);
      return argv[++i];
    };
    if (a === "--help" || a === "-h") o.bantuan = true;
    else if (a === "--json") o.json = true;
    else if (a === "--contoh") o.contoh = ambil();
    else if (a === "--wajib") o.wajib.push(...daftarKunci(ambil(), a));
    else if (a === "--salah-satu") o.salahSatu.push(daftarKunci(ambil(), a));
    else if (a === "--") { argv.slice(i + 1).forEach(setBerkas); break; }
    else if (a.startsWith("-") && a !== "-") throw new Galat(`opsi tidak dikenal: ${a}`);
    else setBerkas(a);
  }
  if (o.berkas === "") throw new Galat("path berkas kosong");
  if (o.contoh === "") throw new Galat("path --contoh kosong");
  o.wajib = [...new Set(o.wajib)];
  return o;
}

/** Baca berkas teks; null bila tidak ada. Galat baca lain hanya menyebut path + kode errno (bukan isi). */
function bacaBerkas(p) {
  try { return fs.readFileSync(p, "utf8"); } catch (e) {
    if (e.code === "ENOENT") return null;
    throw new Galat(`berkas tak terbaca: ${p} (${e.code ?? "galat"})`);
  }
}

/** Titik masuk CLI. Mengembalikan kode keluar; keluaran lewat `tulis`/`tulisGalat` (bawaan stdout/stderr). */
export function main(argv, { cwd = process.cwd(), tulis = (s) => process.stdout.write(s), tulisGalat = (s) => process.stderr.write(s) } = {}) {
  try {
    const o = uraiArgumen(argv);
    if (o.bantuan) { tulis(PEMAKAIAN + "\n"); return 0; }
    const berkas = path.resolve(cwd, o.berkas ?? ".env");
    // hanya berkas env (bukan kunci privat/berkas lain): baris berbentuk base64 bisa terbaca sebagai "nama kunci"
    if (!NAMA_ENV.test(path.basename(berkas))) throw new Galat(`bukan berkas env: ${path.basename(berkas)} (nama .env, .env.<x>, <x>.env, .envrc)`);
    if (o.contoh !== null && !NAMA_ENV.test(path.basename(o.contoh))) throw new Galat(`--contoh bukan berkas env: ${path.basename(o.contoh)}`);
    let contoh = null;
    if (o.contoh !== null) {
      contoh = path.resolve(cwd, o.contoh);
      if (!fs.existsSync(contoh)) throw new Galat(`berkas contoh tidak ada: ${contoh}`);
    } else {
      for (const c of [`${berkas}.example`, path.join(path.dirname(berkas), ".env.example")]) {
        if (c !== berkas && fs.existsSync(c) && fs.statSync(c).isFile()) { contoh = c; break; }
      }
    }
    const contohTeks = contoh ? bacaBerkas(contoh) : null;
    if (contoh && contohTeks === null) throw new Galat(`berkas contoh tidak ada: ${contoh}`);
    const teks = bacaBerkas(berkas);
    const r = periksa(teks, { contohTeks, wajib: o.wajib, salahSatu: o.salahSatu });
    if (o.json) {
      tulis(JSON.stringify({ berkas, contoh, ada: r.ada, kunci: r.kunci, hasil: r.hasil, exit: r.exit }, null, 2) + "\n");
    } else {
      const baris = [];
      if (!r.ada) baris.push(`berkas tidak ada: ${berkas}`);
      const lebar = Math.max(0, ...r.kunci.map((k) => k.nama.length));
      for (const k of r.kunci) baris.push(`${k.nama.padEnd(lebar)}  ${k.status}`);
      baris.push(`Hasil: ${r.hasil} (exit ${r.exit})`);
      tulis(baris.join("\n") + "\n");
    }
    return r.exit;
  } catch (e) {
    // Hanya pesan Galat milik kita (tanpa isi berkas) yang dicetak; galat tak terduga tidak membawa e.message.
    tulisGalat(`[env-kunci] galat: ${e instanceof Galat ? e.message : `tak terduga (${e?.code ?? e?.name ?? "galat"})`}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
