// Tautan skill & subagent RudisOne ke ~/.claude, lintas OS.
//   symlink   macOS, Linux, Windows dengan Developer Mode/admin
//   junction  folder di Windows tanpa hak symlink (tidak butuh admin)
//   salinan   berkas di Windows tanpa hak symlink — dicatat di manifest agar bisa diperiksa dan diperbarui
// Hanya tautan/salinan milik repo ini yang pernah diubah; milik sistem lain tidak disentuh.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { folderClaudeUser } from "./lokasi.mjs";

const manifestPath = () => path.join(folderClaudeUser(), ".rudisone-tautan.json");
function bacaManifest() { try { return JSON.parse(fs.readFileSync(manifestPath(), "utf8")); } catch { return {}; } }
function tulisManifest(m) {
  fs.mkdirSync(path.dirname(manifestPath()), { recursive: true });
  fs.writeFileSync(manifestPath(), `${JSON.stringify(m, null, 2)}\n`);
}
const kunci = (tujuan) => path.resolve(tujuan);

/** Sidik isi berkas atau folder (urutan dan nama berkas ikut dihitung). */
export function sidik(p) {
  const h = crypto.createHash("sha1");
  const jalan = (d, rel) => {
    for (const n of fs.readdirSync(d).sort()) {
      const f = path.join(d, n);
      if (fs.statSync(f).isDirectory()) jalan(f, `${rel}${n}/`);
      else { h.update(`${rel}${n}\0`); h.update(fs.readFileSync(f)); }
    }
  };
  if (fs.statSync(p).isDirectory()) jalan(p, ""); else h.update(fs.readFileSync(p));
  return h.digest("hex").slice(0, 16);
}

const ada = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
const dalam = (anak, induk) => {
  const a = path.resolve(anak), b = path.resolve(induk);
  const [x, y] = process.platform === "win32" ? [a.toLowerCase(), b.toLowerCase()] : [a, b];
  return x === y || x.startsWith(y + path.sep);
};
const targetSymlink = (p) => { try { return path.resolve(path.dirname(p), fs.readlinkSync(p)); } catch { return null; } };

/** Milik repo `root`? "symlink" (termasuk junction), "salinan" (tercatat di manifest), atau null. */
export function jenisMilik(tujuan, root) {
  let st;
  try { st = fs.lstatSync(tujuan); } catch { return null; }
  if (st.isSymbolicLink()) { const t = targetSymlink(tujuan); return t && dalam(t, root) ? "symlink" : null; }
  const m = bacaManifest()[kunci(tujuan)];
  return m && dalam(m.sumber, root) ? "salinan" : null;
}

/** Keadaan tautan: { ada, milik: "symlink"|"salinan"|null, mutakhir, sumber }. `mutakhir` untuk salinan = isinya sama dengan sumber. */
export function periksaTautan(tujuan, root) {
  if (!ada(tujuan)) return { ada: false, milik: null, mutakhir: false, sumber: null };
  const milik = jenisMilik(tujuan, root);
  if (milik === "symlink") return { ada: true, milik, mutakhir: fs.existsSync(tujuan), sumber: targetSymlink(tujuan) };
  if (milik === "salinan") {
    const m = bacaManifest()[kunci(tujuan)];
    let mutakhir = false;
    try { mutakhir = fs.existsSync(m.sumber) && sidik(m.sumber) === m.sidik && sidik(tujuan) === m.sidik; } catch { /* sumber/salinan hilang */ }
    return { ada: true, milik, mutakhir, sumber: m.sumber };
  }
  return { ada: true, milik: null, mutakhir: false, sumber: null };
}

function buatSymlink(sumber, tujuan, folder) {
  // uji: RUDISONE_TAUTAN_SALIN=1 memaksa jalur salinan (meniru Windows tanpa hak symlink) di OS mana pun
  if (process.env.RUDISONE_TAUTAN_SALIN === "1") throw Object.assign(new Error("symlink dimatikan untuk uji"), { code: "EPERM" });
  const jenis = process.platform === "win32" ? (folder ? "junction" : "file") : (folder ? "dir" : "file");
  fs.symlinkSync(sumber, tujuan, jenis);
}
function salin(sumber, tujuan, folder) {
  if (folder) fs.cpSync(sumber, tujuan, { recursive: true }); else fs.copyFileSync(sumber, tujuan);
  const m = bacaManifest();
  m[kunci(tujuan)] = { sumber: path.resolve(sumber), sidik: sidik(sumber), mode: "salinan" };
  tulisManifest(m);
}
function hapusMilik(tujuan) {
  fs.rmSync(tujuan, { recursive: true, force: true });
  const m = bacaManifest();
  if (m[kunci(tujuan)]) { delete m[kunci(tujuan)]; tulisManifest(m); }
}

/** Pasang `tujuan` → `sumber`. Mengembalikan { status: "baru"|"sama"|"diperbarui"|"asing", mode: "symlink"|"junction"|"salinan"|null }.
 *  "asing" = sudah dipakai sistem lain: tidak disentuh. */
export function pasangTautan(sumber, tujuan, root, { folder = false } = {}) {
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  const sebelum = periksaTautan(tujuan, root);
  if (sebelum.ada && !sebelum.milik) return { status: "asing", mode: null };
  if (sebelum.milik === "symlink" && sebelum.mutakhir && path.resolve(sebelum.sumber) === path.resolve(sumber)) return { status: "sama", mode: "symlink" };
  if (sebelum.milik === "salinan" && sebelum.mutakhir) return { status: "sama", mode: "salinan" };
  if (sebelum.ada) hapusMilik(tujuan);
  const status = sebelum.ada ? "diperbarui" : "baru";
  try {
    buatSymlink(sumber, tujuan, folder);
    return { status, mode: process.platform === "win32" && folder ? "junction" : "symlink" };
  } catch (e) {
    if (!["EPERM", "EACCES", "ENOSYS", "EINVAL", "UNKNOWN"].includes(e.code)) throw e;
    salin(sumber, tujuan, folder);
    return { status, mode: "salinan" };
  }
}

/** Hapus tautan/salinan milik repo yang sumbernya sudah tidak ada. Mengembalikan true bila ada yang dihapus. */
export function bersihkanYatim(tujuan, root) {
  const milik = jenisMilik(tujuan, root);
  if (!milik) return false;
  const p = periksaTautan(tujuan, root);
  if (p.sumber && fs.existsSync(p.sumber)) return false;
  hapusMilik(tujuan);
  return true;
}
