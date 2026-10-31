#!/usr/bin/env node
// Penjaga kebersihan repo RudisOne — READ-ONLY. Repo ini sumber instalasi di device klien, jadi berkas produk tidak boleh
// membawa sisa pemakaian device pemilik: laporan uji per device, ID tugas, kutipan keputusan bertanggal, atau nama sistem
// agent pendahulu. Tempat semua itu `handoff/` (per device, tidak ikut git).
//   node bin/bersih.mjs            periksa berkas terlacak (isi di working tree) — juga dipakai cek-konsistensi --repo
//   node bin/bersih.mjs --staged   periksa isi yang akan di-commit (indeks) — dipanggil hook .githooks/pre-commit
// Dikecualikan (alat pengembang & fixture sah): *.test.mjs, bin/lib/uji-util.mjs, uji/suite/, uji/simulasi-linux/,
// .github/, .claude/launch.json. ID contoh di dokumen/demo memakai tanggal cadangan T-20260101-n.
// Exit: 0 bersih · 1 ada temuan · 2 galat (bukan repo git).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");

/** Path alat pengembang & fixture: boleh memuat ID tugas (penanda regresi) dan data uji. */
const DIKECUALIKAN = /(^|\/)[^/]+\.test\.mjs$|^bin\/lib\/uji-util\.mjs$|^uji\/(suite|simulasi-linux)\/|^\.github\/|^\.claude\/launch\.json$/;
/** Berkas yang tidak boleh ada di repo sama sekali: laporan uji per device (uji/*.md) dan tabel pemetaan migrasi. */
const BERKAS_TERLARANG = [
  [/^uji\/[^/]+\.md$/, "laporan uji device — simpan di handoff/<ID>/, bukan di repo"],
  [/^docs\/pemetaan-aturan-[^/]*\.md$/, "dokumen migrasi — simpan di handoff/pemetaan/ (per device)"],
  [/^handoff\/(?!\.gitkeep$)/, "hasil per device — handoff/ tidak ikut git"],
];
/** Tanggal cadangan untuk ID contoh (sebelum RudisOne ada, jadi tidak pernah bentrok dengan tugas nyata). */
const ID_CONTOH = /^T-20260101-/;
const TGL = String.raw`\b20\d{2}-\d{2}-\d{2}\b`;
const KEPUTUSAN = String.raw`\b(?:pengguna|pemilik|izin tetap|disetujui|persetujuan|keputusan|diputuskan)\b`;
const POLA = [
  ["id-tugas", /\bT-20\d{6}-\d+(?:\.\d+)*\b/g, (m) => !ID_CONTOH.test(m)],
  // kutipan keputusan bertanggal: tanggal dan kata keputusan di satu kalimat (≤ 40 karakter, tanpa titik di antaranya),
  // atau tanggal yang langsung diikuti kutipan
  ["kutipan-keputusan", new RegExp(`${KEPUTUSAN}[^.\\n]{0,40}?${TGL}|${TGL}[^.\\n]{0,40}?${KEPUTUSAN}|${TGL}\\s*[:—–-]?\\s*["“]`, "gi"), () => true],
  ["sistem-lama", /\bTim ?Agent\b/g, () => true],
];

export const dikecualikan = (rel) => DIKECUALIKAN.test(rel);

/** Temuan untuk satu berkas: path terlarang, lalu pola isi per baris. → [{ rel, baris, jenis, cuplikan }] */
export function periksaBerkas(rel, teks) {
  const hasil = [];
  for (const [pola, alasan] of BERKAS_TERLARANG) if (pola.test(rel)) hasil.push({ rel, baris: 0, jenis: "berkas-terlarang", cuplikan: alasan });
  if (dikecualikan(rel) || typeof teks !== "string" || teks.includes("\0")) return hasil;
  teks.split(/\r?\n/).forEach((l, i) => {
    for (const [jenis, re, sah] of POLA) {
      re.lastIndex = 0;
      for (const m of l.matchAll(re)) {
        if (!sah(m[0])) continue;
        hasil.push({ rel, baris: i + 1, jenis, cuplikan: l.trim().slice(Math.max(0, l.trim().indexOf(m[0]) - 30), l.trim().indexOf(m[0]) + m[0].length + 30) });
        break;
      }
    }
  });
  return hasil;
}

function git(root, args) {
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  return r.status === 0 ? r.stdout : null;
}

/** Berkas terlacak beserta isinya di working tree (berkas terhapus di disk dilewati). */
export function periksaTerlacak(root = ROOT) {
  const out = git(root, ["ls-files", "-z"]);
  if (out === null) return null;
  const hasil = [];
  for (const rel of out.split("\0").filter(Boolean)) {
    let teks = null;
    try { teks = fs.readFileSync(path.join(root, rel), "utf8"); } catch { continue; }
    hasil.push(...periksaBerkas(rel, teks));
  }
  return hasil;
}

/** Isi yang akan di-commit: berkas yang ditambah/diubah/diganti nama/berubah tipe di indeks, isi dari indeks (`git show :<path>`). */
export function periksaStaged(root = ROOT) {
  const out = git(root, ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMRT"]);
  if (out === null) return null;
  const hasil = [];
  for (const rel of out.split("\0").filter(Boolean)) hasil.push(...periksaBerkas(rel, git(root, ["show", `:${rel}`])));
  return hasil;
}

export function ringkas(temuan) {
  return temuan.map((t) => `  ${t.rel}${t.baris ? `:${t.baris}` : ""} [${t.jenis}] ${t.cuplikan}`).join("\n");
}

function utama(argv) {
  const staged = argv.includes("--staged");
  const temuan = staged ? periksaStaged(ROOT) : periksaTerlacak(ROOT);
  if (temuan === null) { console.error("bersih: bukan repo git"); return 2; }
  if (!temuan.length) { console.log(`bersih: ${staged ? "isi commit" : "berkas terlacak"} bebas sisa pemakaian.`); return 0; }
  console.error(`bersih: ${temuan.length} temuan di berkas produk${staged ? " yang akan di-commit" : ""}:\n${ringkas(temuan)}`);
  console.error("Pindahkan laporan/hasil uji ke handoff/ (per device); tulis ulang kalimat tanpa ID tugas, tanggal keputusan,"
    + " atau nama sistem lain. ID contoh: T-20260101-n. Kutipan keputusan pemilik dicatat di pesan commit.");
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = utama(process.argv.slice(2));
