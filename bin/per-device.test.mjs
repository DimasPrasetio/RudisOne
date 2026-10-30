// Uji berkas per device dari templat (bin/lib/per-device.mjs). Jalankan: node --test bin/per-device.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { cekCatatan } from "./cek-konsistensi.mjs";
import { peranDariProtokol, ROOT_REPO, siapkanPerDevice, teamDariTemplat } from "./lib/per-device.mjs";

const ID_PERAN = ["coo", "head-of-strategy", "financial-controller", "research-analyst", "hr-business-partner", "tech-lead",
  "business-systems-analyst", "software-engineer", "program-manager", "technical-writer", "head-of-it-operations", "system-administrator"];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "per device uji-"));   // spasi di path: seperti C:\Users\Nama Lengkap\…
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const baca = (...p) => fs.readFileSync(path.join(...p), "utf8");

test("tabel Jabatan protokol.md → 12 peran dengan jabatan bersih", () => {
  const peran = peranDariProtokol(baca(ROOT_REPO, "protokol.md"));
  assert.deepEqual(peran.map((p) => p.id).sort(), [...ID_PERAN].sort());
  const j = Object.fromEntries(peran.map((p) => [p.id, p.jabatan]));
  assert.equal(j.coo, "COO");
  assert.equal(j["software-engineer"], "Software Engineer");
  assert.equal(j["head-of-it-operations"], "Head of IT Operations");
});

test("folder kosong: TEAM.md + catatan/<id-peran>.md untuk semua peran tercipta dari templat", () => {
  const root = path.join(tmp, "kosong");
  const h = siapkanPerDevice(root, { tanggal: "2026-10-30" });
  assert.deepEqual(h.ada, []);
  assert.deepEqual(h.dibuat.sort(), ["TEAM.md", ...ID_PERAN.map((id) => `catatan/${id}.md`)].sort());
  const team = baca(root, "TEAM.md");
  assert.match(team, /^# TEAM/);
  assert.match(team, /^Dibangun: 2026-10-30$/m);
  assert.match(team, /^## COO$/m);
  assert.match(team, /^## IT Operations/m);
  assert.doesNotMatch(team, /local_…/);                          // baris contoh tidak menjadi sesi
  assert.doesNotMatch(team, /^## Engineering · Tim 1 · <proyek>/m); // bagian contoh tidak menjadi tim (nomor Kantor)
  assert.match(baca(root, "catatan", "coo.md"), /^# Catatan COO\r?\n/);
  assert.match(baca(root, "catatan", "software-engineer.md"), /^# Catatan Software Engineer\r?\n.*`software-engineer`/);
  for (const id of ID_PERAN) assert.doesNotMatch(baca(root, "catatan", `${id}.md`), /<Jabatan>|<id-peran>/, id);
});

test("catatan dari templat tidak memicu peringatan kebersihan catatan (D7)", () => {
  const root = path.join(tmp, "d7");
  siapkanPerDevice(root);
  const sebelum = cekCatatan(path.join(tmp, "tidak-ada")).length;   // temuan dikumpulkan di satu larik modul
  const baru = cekCatatan(root).slice(sebelum);
  assert.deepEqual(baru, []);
  // kontrol: butir tanpa tanggal memang terdeteksi oleh pemeriksa yang sama
  fs.appendFileSync(path.join(root, "catatan", "coo.md"), "- tanpa tanggal\n");
  assert.ok(cekCatatan(root).slice(sebelum).some((t) => t.kode === "catatan-tanggal" && /catatan\/coo\.md/.test(t.pesan)));
});

test("dijalankan ulang: tidak menimpa berkas yang sudah diubah; berkas yang hilang dibuat lagi", () => {
  const root = path.join(tmp, "ulang");
  siapkanPerDevice(root);
  fs.writeFileSync(path.join(root, "TEAM.md"), "TEAM milik COO\n");
  fs.writeFileSync(path.join(root, "catatan", "coo.md"), "# Catatan COO\n- 2026-10-30 — keputusan penting\n");
  fs.rmSync(path.join(root, "catatan", "tech-lead.md"));
  const h = siapkanPerDevice(root);
  assert.deepEqual(h.dibuat, ["catatan/tech-lead.md"]);
  assert.equal(h.ada.length, ID_PERAN.length);
  assert.equal(baca(root, "TEAM.md"), "TEAM milik COO\n");
  assert.match(baca(root, "catatan", "coo.md"), /keputusan penting/);
  assert.deepEqual(siapkanPerDevice(root).dibuat, []);
});

test("path Windows: pemisah \\ atau / dan spasi di path sama-sama bekerja", () => {
  const asli = path.join(tmp, "Nama Lengkap", "RudisOne");
  const varian = process.platform === "win32" ? asli.replaceAll("\\", "/") : asli;
  const h = siapkanPerDevice(varian);
  assert.equal(h.dibuat.length, ID_PERAN.length + 1);
  assert.ok(h.dibuat.every((r) => !r.includes("\\")));            // laporan memakai "/" di semua OS
  assert.ok(fs.existsSync(path.join(asli, "catatan", "system-administrator.md")));
  assert.equal(siapkanPerDevice(asli).dibuat.length, 0);           // bentuk lain dari path yang sama: tidak menimpa
});

test("templat TEAM CRLF (checkout Windows autocrlf) tetap dibersihkan dan memakai CRLF", () => {
  const crlf = baca(ROOT_REPO, "templat", "team.md").replace(/\r?\n/g, "\r\n");
  const t = teamDariTemplat(crlf, "2026-01-02");
  assert.match(t, /Dibangun: 2026-01-02\r\n/);
  assert.doesNotMatch(t, /local_…|<proyek>`?\r?\n/);
  assert.doesNotMatch(t.replaceAll("\r\n", ""), /\n/);
});

test("peran eksplisit (opsi) dan galat bila tabel Jabatan tak terbaca", () => {
  const root = path.join(tmp, "eksplisit");
  const h = siapkanPerDevice(root, { peran: [{ id: "coo", jabatan: "COO" }] });
  assert.deepEqual(h.dibuat.sort(), ["TEAM.md", "catatan/coo.md"]);
  const palsu = path.join(tmp, "sumber-rusak");
  fs.mkdirSync(path.join(palsu, "templat"), { recursive: true });
  fs.writeFileSync(path.join(palsu, "protokol.md"), "# tanpa tabel\n");
  assert.throws(() => siapkanPerDevice(path.join(tmp, "x"), { sumber: palsu }), /tabel Jabatan/);
});
