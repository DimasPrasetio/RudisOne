// Inventaris aturan lama — memecah protokol.md, sdlc.md, dan agents/coo.md pada sebuah git ref menjadi unit aturan
// berkode stabil (P-/S-/C-nnn, urut dokumen) untuk tabel pemetaan docs/pemetaan-aturan-v5.md.
// Unit = butir daftar (beserta baris lanjutannya), baris data tabel, atau paragraf. Judul & pagar kode bukan unit.
//   node bin/inventaris-aturan.mjs [--ref 3b1c888] [--json]
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
export const REF_LAMA = "3b1c888";   // main sebelum migrasi T-20261030-2
export const SUMBER = [["P", "protokol.md"], ["S", "sdlc.md"], ["C", "agents/coo.md"]];

/** Unit aturan dari teks Markdown. */
export function unit(teks) {
  const hasil = [];
  let bagian = "", kini = null, diKode = false, diFm = false;
  const tutup = () => { if (kini) { hasil.push({ bagian, teks: kini.join(" ").replace(/\s+/g, " ").trim() }); kini = null; } };
  const baris = String(teks).split("\n");
  for (let i = 0; i < baris.length; i++) {
    const l = baris[i];
    if (i === 0 && l === "---") { diFm = true; continue; }
    if (diFm) { if (l === "---") diFm = false; continue; }
    if (/^\s*```/.test(l)) { tutup(); diKode = !diKode; continue; }
    if (diKode) continue;
    const h = l.match(/^#{1,6}\s+(.+)$/);
    if (h) { tutup(); bagian = h[1].trim(); continue; }
    if (!l.trim()) { tutup(); continue; }
    if (/^\s*\|/.test(l)) {
      tutup();
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;                        // garis pemisah
      if (i + 1 < baris.length && /^\s*\|[\s:|-]+\|\s*$/.test(baris[i + 1])) continue;   // kepala tabel
      hasil.push({ bagian, teks: l.trim() });
      continue;
    }
    if (/^\s*(?:[-*]|\d+[.)])\s+/.test(l)) {
      // butir baru; butir bertingkat (indentasi ≥ 2) dihitung sebagai unit sendiri
      tutup(); kini = [l.trim()]; continue;
    }
    if (/^\s*>/.test(l)) { tutup(); hasil.push({ bagian, teks: l.replace(/^\s*>\s?/, "").trim() }); continue; }
    if (kini) kini.push(l.trim()); else kini = [l.trim()];
  }
  tutup();
  return hasil.filter((u) => u.teks.length > 0);
}

export function inventaris(ref = REF_LAMA, cwd = process.cwd()) {
  const semua = [];
  for (const [awal, f] of SUMBER) {
    const teks = execFileSync("git", ["show", `${ref}:${f}`], { cwd, encoding: "utf8" });
    unit(teks).forEach((u, i) => semua.push({ kode: `${awal}-${String(i + 1).padStart(3, "0")}`, berkas: f, ...u }));
  }
  return semua;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) {
  const a = process.argv.slice(2);
  const iRef = a.indexOf("--ref");
  const daftar = inventaris(iRef >= 0 ? a[iRef + 1] : REF_LAMA);
  if (a.includes("--json")) console.log(JSON.stringify(daftar));
  else for (const u of daftar) console.log(`${u.kode}\t${u.berkas} › ${u.bagian}\t${u.teks.slice(0, 140)}`);
}
