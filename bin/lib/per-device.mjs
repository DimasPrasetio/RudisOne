// Berkas per device RudisOne yang tidak di-commit (.gitignore): `TEAM.md` dan `catatan/<id-peran>.md`. Dibuat dari
// templat (`templat/team.md`, `templat/catatan.md`) HANYA bila belum ada — berkas yang sudah ada tidak pernah ditimpa.
// Dipanggil install.mjs; aman dijalankan berulang. Daftar peran dibaca dari tabel Jabatan di protokol.md (pemilik fakta).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Akar repo RudisOne (sumber templat & protokol.md). */
export const ROOT_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Tabel "## Jabatan & identitas" di protokol.md → [{ id, jabatan }] (jabatan tanpa "(…)" dan tanpa nomor "#n"). */
export function peranDariProtokol(teks) {
  const hasil = [];
  let diBagian = false;
  for (const l of teks.split(/\r?\n/)) {
    if (/^## /.test(l)) { diBagian = /^## Jabatan/.test(l); continue; }
    const m = diBagian && l.match(/^\|\s*([^|]+?)\s*\|\s*`([a-z][a-z-]*)`\s*\|/);
    if (!m) continue;
    const jabatan = m[1].replace(/\s*\(.*\)\s*$/, "").replace(/\s*#.*$/, "").trim();
    if (!hasil.some((p) => p.id === m[2])) hasil.push({ id: m[2], jabatan });
  }
  return hasil;
}

/** Isi TEAM.md awal dari templat/team.md: tanggal dibangun diisi, baris contoh (id sesi `local_…`) dan bagian contoh
 *  berjudul penanda (`## … <proyek>`) dibuang — agar Kantor dan cek-konsistensi tidak membacanya sebagai sesi/tim nyata. */
export function teamDariTemplat(teks, tanggal) {
  const eol = teks.includes("\r\n") ? "\r\n" : "\n";
  const keluar = [];
  let buang = false;
  for (const l of teks.split(/\r?\n/)) {
    if (/^## /.test(l)) buang = /<[^>]+>/.test(l);
    if (buang || /`local_…`/.test(l)) continue;
    keluar.push(l.replace(/^Dibangun: YYYY-MM-DD\s*$/, `Dibangun: ${tanggal}`));
  }
  return keluar.join(eol).replace(/(\r?\n){3,}/g, `${eol}${eol}`);
}

/** Isi catatan/<id>.md awal dari templat/catatan.md. */
export const catatanDariTemplat = (teks, { id, jabatan }) => teks.replaceAll("<Jabatan>", jabatan).replaceAll("<id-peran>", id);

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Tulis berkas hanya bila belum ada (flag "wx": tidak menimpa, juga saat berpacu). true = dibuat. */
function tulisBaru(f, isi) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  try { fs.writeFileSync(f, isi, { flag: "wx" }); return true; } catch (e) { if (e.code === "EEXIST") return false; throw e; }
}

/** Siapkan berkas per device di `root`: TEAM.md + catatan/<id-peran>.md untuk setiap peran. Templat & protokol.md dibaca
 *  dari `sumber` (bawaan: repo ini). → { dibuat: [path relatif], ada: [path relatif] } (pemisah "/"). */
export function siapkanPerDevice(root, { sumber = ROOT_REPO, peran, tanggal = hariIni() } = {}) {
  const daftar = peran ?? peranDariProtokol(fs.readFileSync(path.join(sumber, "protokol.md"), "utf8"));
  if (!daftar.length) throw new Error("tabel Jabatan di protokol.md tidak terbaca — tidak ada peran");
  const tCatatan = fs.readFileSync(path.join(sumber, "templat", "catatan.md"), "utf8");
  const berkas = [["TEAM.md", () => teamDariTemplat(fs.readFileSync(path.join(sumber, "templat", "team.md"), "utf8"), tanggal)]];
  for (const p of daftar) berkas.push([`catatan/${p.id}.md`, () => catatanDariTemplat(tCatatan, p)]);
  const hasil = { dibuat: [], ada: [] };
  for (const [rel, isi] of berkas) {
    const f = path.join(root, ...rel.split("/"));
    if (fs.existsSync(f)) hasil.ada.push(rel);
    else (tulisBaru(f, isi()) ? hasil.dibuat : hasil.ada).push(rel);
  }
  return hasil;
}
