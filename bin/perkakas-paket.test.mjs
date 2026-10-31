// Uji pembanding paket skill (.skill = zip) vs salinan terpasang — tanpa jaringan, tanpa ~/.claude (semua di folder sementara).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { bukaPaket, terpasangSamaDenganPaket } from "./perkakas.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perkakas-paket-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** Zip minimal (entri "stored", tanpa kompresi) dengan nama entri apa adanya — termasuk backslash seperti paket buatan Windows. */
function buatZip(keluar, entri) {
  const lokal = [], pusat = [];
  let ofset = 0;
  for (const [nama, isi] of entri) {
    const n = Buffer.from(nama, "utf8"), d = Buffer.from(isi, "utf8"), crc = zlib.crc32(d);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(d.length, 22); h.writeUInt16LE(n.length, 26);
    lokal.push(h, n, d);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(d.length, 24); c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(ofset, 42);
    pusat.push(c, n);
    ofset += h.length + n.length + d.length;
  }
  const cd = Buffer.concat(pusat), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entri.length, 8); e.writeUInt16LE(entri.length, 10);
  e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(ofset, 16);
  fs.writeFileSync(keluar, Buffer.concat([...lokal, cd, e]));
}
const tulis = (p, isi) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, isi); };

// Salinan terpasang tiruan (bukan ~/.claude): rudis-monorepo/{SKILL.md, references/a.md}
const TERPASANG = path.join(tmp, "terpasang", "rudis-monorepo");
tulis(path.join(TERPASANG, "SKILL.md"), "isi skill");
tulis(path.join(TERPASANG, "references", "a.md"), "rujukan a");
const ENTRI = (sep) => [[`rudis-monorepo${sep}SKILL.md`, "isi skill"], [`rudis-monorepo${sep}references${sep}a.md`, "rujukan a"]];

test("zip normal: sama dengan terpasang; isi beda terdeteksi", () => {
  const p = path.join(tmp, "normal.skill");
  buatZip(p, ENTRI("/"));
  assert.equal(terpasangSamaDenganPaket(p, TERPASANG), true);
  const beda = path.join(tmp, "beda.skill");
  buatZip(beda, [["rudis-monorepo/SKILL.md", "isi lain"], ["rudis-monorepo/references/a.md", "rujukan a"]]);
  assert.equal(terpasangSamaDenganPaket(beda, TERPASANG), false);
});

test("zip ber-backslash: dibanding benar dengan alat yang ada (peringatan unzip bukan gagal)", () => {
  const p = path.join(tmp, "backslash.skill");
  buatZip(p, ENTRI("\\"));
  assert.equal(terpasangSamaDenganPaket(p, TERPASANG), true);
  const beda = path.join(tmp, "backslash-beda.skill");
  buatZip(beda, [["rudis-monorepo\\SKILL.md", "isi skill"]]);   // references/a.md tidak ada di paket
  assert.equal(terpasangSamaDenganPaket(beda, TERPASANG), false);
});

test("zip rusak: galat sungguhan dilaporkan", () => {
  const p = path.join(tmp, "rusak.skill");
  fs.writeFileSync(p, "ini bukan zip");
  assert.throws(() => terpasangSamaDenganPaket(p, TERPASANG), /paket tidak bisa dibuka: /);
});

test("terpasang belum ada → false tanpa membuka paket", () => {
  const panggil = [];
  const run = (cmd) => { panggil.push(cmd); return { ok: true, kode: 0, out: "", err: "" }; };
  assert.equal(terpasangSamaDenganPaket(path.join(tmp, "normal.skill"), path.join(tmp, "tidak-ada"), { jalankan: run }), false);
  assert.deepEqual(panggil, []);
});

// ---- Urutan alat & arti kode keluar (pelari palsu: deterministik di semua OS) -------------------------------------

/** Pelari palsu: `rencana[alat]` = { kode, err, tulis } ; tulis → berkas dibuat di folder tujuan (argumen setelah -d/-C). */
function pelari(rencana) {
  const panggil = [];
  const run = (cmd, args) => {
    const alat = /powershell/i.test(cmd) ? "Expand-Archive" : /tar(\.exe)?$/i.test(cmd) ? "tar" : cmd;
    panggil.push(alat);
    const p = rencana[alat] ?? { kode: null, err: `spawnSync ${cmd} ENOENT` };
    if (p.tulis) {
      const i = args.findIndex((a) => a === "-d" || a === "-C");
      tulis(path.join(args[i + 1], "rudis-monorepo", "SKILL.md"), "x");
    }
    return { ok: p.kode === 0, kode: p.kode, out: "", err: p.err ?? "" };
  };
  return { run, panggil };
}
const tujuan = () => fs.mkdtempSync(path.join(tmp, "buka-"));

test("unzip kode 1 dengan berkas terbuka = peringatan, tidak lanjut ke alat lain", () => {
  const { run, panggil } = pelari({ unzip: { kode: 1, err: "warning:  x appears to use backslashes as path separators", tulis: true } });
  const h = bukaPaket("p.skill", tujuan(), { jalankan: run, platform: "linux" });
  assert.equal(h.alat, "unzip");
  assert.match(h.peringatan, /backslashes/);
  assert.deepEqual(panggil, ["unzip"]);
});

test("unzip kode 1 tanpa berkas terbuka = gagal, lanjut ke alat berikutnya", () => {
  const { run, panggil } = pelari({ unzip: { kode: 1, err: "warning:  p.skill appears to use backslashes as path separators" }, tar: { kode: 0, tulis: true } });
  assert.equal(bukaPaket("p.skill", tujuan(), { jalankan: run, platform: "darwin" }).alat, "tar");
  assert.deepEqual(panggil, ["unzip", "python3", "tar"]);
});

test("unzip kode 1 karena entri dilewati (bukan backslash) = gagal walau sebagian terbuka", () => {
  const { run, panggil } = pelari({
    unzip: { kode: 1, err: "warning:  p.skill appears to use backslashes as path separators\n   skipping: rudis-monorepo/b.md  unable to get password", tulis: true },
    tar: { kode: 0, tulis: true },
  });
  assert.equal(bukaPaket("p.skill", tujuan(), { jalankan: run, platform: "win32" }).alat, "tar");
  assert.deepEqual(panggil, ["unzip", "tar"]);
});

test("Windows: python3 tidak pernah dipanggil", () => {
  const { run, panggil } = pelari({ unzip: { kode: 9, err: "End-of-central-directory signature not found." } });
  assert.throws(() => bukaPaket("p.skill", tujuan(), { jalankan: run, platform: "win32" }),
    /paket tidak bisa dibuka: unzip: End-of-central-directory signature not found\./);
  assert.deepEqual(panggil, ["unzip", "tar", "Expand-Archive"]);
  assert.equal(panggil.includes("python3") || panggil.includes("python"), false);
});

test("alat yang tidak terpasang tidak menutupi galat alat yang jalan", () => {
  const { run } = pelari({ tar: { kode: 1, err: "tar: Error opening archive: Unrecognized archive format" } });
  assert.throws(() => bukaPaket("p.skill", tujuan(), { jalankan: run, platform: "linux" }), /paket tidak bisa dibuka: tar: Error opening archive/);
  const { run: kosong } = pelari({});
  assert.throws(() => bukaPaket("p.skill", tujuan(), { jalankan: kosong, platform: "linux" }), /tidak ada unzip\/tar\/Expand-Archive/);
});
