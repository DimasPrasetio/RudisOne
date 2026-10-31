// Inventaris aturan lama — memecah berkas instruksi pada sebuah git ref menjadi unit aturan berkode stabil (urut
// dokumen) untuk tabel pemetaan pemetaan-aturan-v*.md (alat pengembang per device: handoff/pemetaan/, bukan bagian repo).
//   v5 (bawaan untuk ref 3b1c888): protokol.md, sdlc.md, agents/coo.md → P-/S-/C-nnn (pemetaan-aturan-v5.md)
//   v6 (ref lain): protokol.md → P-nnn, agents/coo.md → C-nnn, agents/<id>.md → A-<id>-nnn,
//       skills/<skill>/SKILL.md → K-<skill>-nnn — semua berkas yang ada di ref itu (pemetaan-aturan-v6.md)
// Unit = butir daftar (beserta baris lanjutannya), baris data tabel, atau paragraf. Judul & pagar kode bukan unit.
//   node bin/inventaris-aturan.mjs [--ref 3b1c888] [--sumber v5|v6] [--json]
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
export const REF_LAMA = "3b1c888";   // main sebelum migrasi v5
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

/** Sumber v6: berkas instruksi yang ada di `ref` → [[awalan, path]]. */
export function sumberV6(ref, cwd = process.cwd()) {
  const daftar = execFileSync("git", ["ls-tree", "-r", "--name-only", ref], { cwd, encoding: "utf8" }).split("\n");
  const out = [];
  if (daftar.includes("protokol.md")) out.push(["P", "protokol.md"]);
  for (const f of daftar.filter((x) => /^agents\/[a-z-]+\.md$/.test(x)).sort()) {
    const id = f.slice(7, -3);
    out.push([id === "coo" ? "C" : `A-${id}`, f]);
  }
  for (const f of daftar.filter((x) => /^skills\/[\w-]+\/SKILL\.md$/.test(x)).sort()) out.push([`K-${f.split("/")[1]}`, f]);
  return out;
}

export function inventaris(ref = REF_LAMA, cwd = process.cwd(), sumber = ref === REF_LAMA ? SUMBER : sumberV6(ref, cwd)) {
  const semua = [];
  for (const [awal, f] of sumber) {
    const teks = execFileSync("git", ["show", `${ref}:${f}`], { cwd, encoding: "utf8" });
    unit(teks).forEach((u, i) => semua.push({ kode: `${awal}-${String(i + 1).padStart(3, "0")}`, berkas: f, ...u }));
  }
  return semua;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) {
  const a = process.argv.slice(2);
  const iRef = a.indexOf("--ref");
  const iSumber = a.indexOf("--sumber");
  const ref = iRef >= 0 ? a[iRef + 1] : REF_LAMA;
  const daftar = inventaris(ref, process.cwd(), iSumber < 0 ? undefined : a[iSumber + 1] === "v5" ? SUMBER : sumberV6(ref));
  if (a.includes("--json")) console.log(JSON.stringify(daftar));
  else for (const u of daftar) console.log(`${u.kode}\t${u.berkas} › ${u.bagian}\t${u.teks.slice(0, 140)}`);
}
