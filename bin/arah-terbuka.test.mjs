// Uji daftar keputusan arah terbuka: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { arahTerbuka, poinCatatan, formatTeks } from "./arah-terbuka.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arah-terbuka-"));
const ROOT = path.join(tmp, "RudisOne");
const PUSTAKA = path.join(tmp, "pustaka-x");
fs.mkdirSync(path.join(ROOT, "catatan"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "handoff"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "catatan", "coo.md"), [
  "# Catatan COO",
  "",
  "- 2026-01-01 — T-20260101-1 (kajian standar Kanvas): pustaka-x → rekomendasi jalur penghubung. TERBUKA: pilihan per domain.",
  "  Status: menunggu keputusan pengguna.",
  "- 2026-01-01 — T-20260101-2 selesai, tidak ada yang terbuka di sini (huruf kecil bukan penanda).",
  "- 2026-01-02 — T-20260101-3: arah layar kasir. status: terbuka — pengguna memilih warna.",
  "- 2026-01-02 — pustaka-x-lama: TERBUKA tapi folder lain (nama mirip).",
].join("\n"));
fs.writeFileSync(path.join(ROOT, "catatan", "research-analyst.md"), "- 2026-01-03 · Kanvas: akses repo belum ada; status: terbuka.\n");
fs.writeFileSync(path.join(ROOT, "handoff", "register-tugas.json"), JSON.stringify({ versi: 1, tugas: [
  { id: "T-20260101-3", judul: "Layar kasir", folder: `${PUSTAKA} (branch rudis/T-20260101-3)`, status: "selesai", bukti: "ok" },
  { id: "T-20260101-4", judul: "Modul gudang", folder: path.join(PUSTAKA, "modules"), status: "terhambat" },
  { id: "T-20260101-5", judul: "Hal lain", folder: path.join(tmp, "proyek-z"), status: "berjalan" },
  { id: "T-20260101-6", judul: "Riset", folder: path.join(tmp, "proyek-z"), status: "selesai", bukti: "laporan; TERBUKA: akses grup" },
] }));
// tugas yang sudah dibersihkan: folder-nya dikenali dari metrik.jsonl
fs.writeFileSync(path.join(ROOT, "handoff", "metrik.jsonl"), `${JSON.stringify({ id: "T-20260101-1", folder: PUSTAKA })}\n{rusak\n`);

test("poin catatan: baris lanjutan menjorok ikut poinnya", () => {
  const p = poinCatatan(path.join(ROOT, "catatan"));
  assert.equal(p.length, 5);
  assert.match(p[0].teks, /TERBUKA: pilihan per domain\. Status: menunggu keputusan pengguna\.$/);
  assert.equal(p[0].berkas, "catatan/coo.md");
  assert.equal(p[0].baris, 3);
});

test("per folder: nama folder, ID tugas folder itu (register & metrik.jsonl), status menunggu, bukti terbuka", () => {
  const h = arahTerbuka({ root: ROOT, folder: PUSTAKA });
  assert.deepEqual(h.catatan.map((p) => p.baris), [3, 6]);           // nama folder/ID; "pustaka-x-lama" & huruf kecil tidak
  assert.deepEqual(h.register.map((t) => t.id), ["T-20260101-4"]);   // subfolder terhambat; selesai tanpa penanda tidak
  const lain = arahTerbuka({ root: ROOT, folder: path.join(tmp, "proyek-z") });
  assert.deepEqual(lain.catatan, []);
  assert.deepEqual(lain.register.map((t) => [t.id, t.sebab]), [["T-20260101-6", "bukti memuat penanda terbuka"]]);
});

test("--kata untuk standar; tanpa folder & kata = semua; teks ringkas", () => {
  const k = arahTerbuka({ root: ROOT, kata: ["kanvas"] });
  assert.deepEqual(k.catatan.map((p) => `${p.berkas}:${p.baris}`), ["catatan/coo.md:3", "catatan/research-analyst.md:1"]);
  const semua = arahTerbuka({ root: ROOT });
  assert.equal(semua.catatan.length, 4);
  assert.equal(semua.register.length, 2);
  assert.match(formatTeks(arahTerbuka({ root: ROOT, folder: path.join(tmp, "kosong") })), /: tidak ada \(diperiksa 5 poin catatan, 4 tugas register\)$/);
  assert.match(formatTeks(k), /^Arah terbuka · kata: kanvas: 2\n- \[catatan\/coo\.md:3\]/);
});

test("CLI: RUDISONE_ROOT, --json, pemakaian salah → 3; tanpa catatan/register tetap 0", () => {
  const jalan = (args, root = ROOT) => spawnSync(process.execPath, [path.join(SINI, "arah-terbuka.mjs"), ...args],
    { encoding: "utf8", env: { ...process.env, RUDISONE_ROOT: root, RUDISONE_REGISTER_JSON: "" } });
  const r = jalan([PUSTAKA, "--json"]);
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).register[0].id, "T-20260101-4");
  assert.equal(jalan(["--salah"]).status, 3);
  const kosong = jalan([PUSTAKA], path.join(tmp, "tidak-ada"));
  assert.equal(kosong.status, 0);
  assert.match(kosong.stdout, /tidak ada/);
});

test("subfolder mewarisi keputusan repo induknya; .md yang berupa folder dilewati; RUDISONE_METRIK_SIMPAN dihormati", () => {
  const sub = arahTerbuka({ root: ROOT, folder: path.join(PUSTAKA, "modules", "gudang") });
  assert.deepEqual(sub.catatan.map((p) => p.baris), [3, 6]);                    // ID tugas folder induk (metrik.jsonl & register)
  assert.deepEqual(sub.register.map((t) => t.id), ["T-20260101-4"]);
  fs.mkdirSync(path.join(ROOT, "catatan", "folder.md"));
  try { assert.equal(poinCatatan(path.join(ROOT, "catatan")).length, 5); } finally { fs.rmdirSync(path.join(ROOT, "catatan", "folder.md")); }
  const lain = path.join(tmp, "metrik-lain.jsonl");
  fs.writeFileSync(lain, `${JSON.stringify({ id: "T-20260101-1", folder: path.join(tmp, "proyek-z") })}\n`);
  process.env.RUDISONE_METRIK_SIMPAN = lain;
  try { assert.deepEqual(arahTerbuka({ root: ROOT, folder: path.join(tmp, "proyek-z") }).catatan.map((p) => p.baris), [3]); }
  finally { delete process.env.RUDISONE_METRIK_SIMPAN; }
});
