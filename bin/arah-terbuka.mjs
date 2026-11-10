#!/usr/bin/env node
// Keputusan arah yang masih TERBUKA per folder/standar — bahan baris "Arah terbuka:" saat COO menyelaraskan tugas
// (skill rudis-grill-me › Keterkaitan). Algoritma murni, read-only: membaca catatan/*.md (ingatan per peran, per device),
// register tugas, dan handoff/metrik.jsonl (peta ID → folder untuk tugas yang sudah dibersihkan).
//
//   bin/arah-terbuka.sh [<folder>] [--kata <kunci>]… [--json]
//
// Catatan "terbuka" = poin bertanggal (baris `- …` beserta lanjutannya yang menjorok) yang memuat TERBUKA (huruf besar),
// "status: terbuka", "status: menunggu …", atau "menunggu keputusan". Register: tugas aktif berstatus terhambat/diparkir/
// penyelarasan (menunggu jawaban), dan kolom bukti tugas apa pun yang memuat penanda yang sama.
// Relevan dengan <folder> bila poin menyebut nama folder itu (nama dasar, tanpa peduli huruf besar) atau ID tugas yang
// foldernya = <folder>, di dalamnya, atau induknya; --kata menambah kecocokan kata kunci (mis. nama standar). Tanpa <folder> dan
// --kata: semua yang terbuka. Ini daftar bahan, bukan putusan: COO menilai apakah keputusannya menyangkut tugas baru.
// Exit: 0 (juga bila tidak ada) · 3 pemakaian salah.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { berkasMetrik } from "./metrik.mjs";

const INI = fileURLToPath(import.meta.url);
const ROOT_BAWAAN = path.resolve(path.dirname(INI), "..");
const RE_ID = /T-\d{8}-\d+(?:\.\d+)?/g;
const STATUS_MENUNGGU = new Set(["terhambat", "diparkir", "penyelarasan"]);

const terbuka = (s) => /\bTERBUKA\b/.test(s) || /status\s*:\s*(terbuka|menunggu)|menunggu keputusan/i.test(s);   // TERBUKA: huruf besar saja
const normal = (p) => {
  const r = path.resolve(String(p ?? "").replace(/\s*\(.*\)\s*$/, "").trim().replace(/^~(?=\/|$)/, process.env.HOME ?? ""));
  return process.platform === "linux" ? r : r.toLowerCase();
};
const dalamAtauSama = (anak, induk) => anak === induk || anak.startsWith(induk.endsWith(path.sep) ? induk : induk + path.sep);
/** Folder tugas dan folder yang ditanyakan saling berkait: sama, salah satu di dalam yang lain (keputusan untuk repo induk
 *  juga berlaku bagi subfoldernya, dan sebaliknya). */
const berkait = (a, b) => dalamAtauSama(a, b) || dalamAtauSama(b, a);

/** Poin catatan: baris `- …` di kolom 0 + baris lanjutan yang menjorok. → [{ berkas, baris, teks }] */
export function poinCatatan(dir) {
  const hasil = [];
  let daftar = [];
  try { daftar = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort(); } catch { return hasil; }
  for (const f of daftar) {
    let ls;
    try { ls = fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/); } catch { continue; }   // folder/tak terbaca → lewati
    let kini = null;
    ls.forEach((l, i) => {
      if (/^- /.test(l)) { if (kini) hasil.push(kini); kini = { berkas: `catatan/${f}`, baris: i + 1, teks: l.slice(2).trim() }; }
      else if (kini && /^\s+\S/.test(l)) kini.teks += ` ${l.trim()}`;
      else if (kini) { hasil.push(kini); kini = null; }
    });
    if (kini) hasil.push(kini);
  }
  return hasil;
}

function bacaJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
/** Peta ID tugas → folder ternormalisasi: register, lalu metrik.jsonl (tugas yang sudah dibersihkan). */
function petaFolder(tugas, berkasMetrik) {
  const m = new Map();
  try {
    for (const l of fs.readFileSync(berkasMetrik, "utf8").split("\n")) {
      if (!l.trim()) continue;
      try { const o = JSON.parse(l); if (o.id && o.folder) m.set(o.id, normal(o.folder)); } catch { /* baris rusak */ }
    }
  } catch { /* belum ada */ }
  for (const t of tugas) if (t.folder && t.folder !== "?") m.set(t.id, normal(t.folder));
  return m;
}

/** → { folder, kata, catatan: [...], register: [...], diperiksa: { poin, tugas } } */
export function arahTerbuka({ root = ROOT_BAWAAN, folder = null, kata = [], register = path.join(root, "handoff", "register-tugas.json"),
  metrik = berkasMetrik(root) } = {}) {
  const tugas = bacaJson(register)?.tugas ?? [];
  const folderId = petaFolder(tugas, metrik);
  const f = folder ? normal(folder) : null;
  const namaF = f ? path.basename(f) : null;
  const kataKecil = kata.map((k) => k.toLowerCase()).filter(Boolean);
  const idCocok = (id) => { const x = folderId.get(id) ?? folderId.get(id.split(".")[0]); return !!(f && x && berkait(x, f)); };
  const relevan = (teks) => {
    if (!f && !kataKecil.length) return true;
    const kecil = teks.toLowerCase();
    if (namaF && new RegExp(`(^|[^\\w-])${namaF.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`, "i").test(teks)) return true;
    if (f && (teks.match(RE_ID) ?? []).some(idCocok)) return true;
    return kataKecil.some((k) => kecil.includes(k));
  };
  const poin = poinCatatan(path.join(root, "catatan"));
  const catatan = poin.filter((p) => terbuka(p.teks) && relevan(p.teks));
  const reg = [];
  for (const t of tugas) {
    const menunggu = STATUS_MENUNGGU.has(t.status);
    const buktiTerbuka = t.bukti && terbuka(String(t.bukti));
    if (!menunggu && !buktiTerbuka) continue;
    const milikFolder = f && t.folder && t.folder !== "?" && berkait(normal(t.folder), f);
    if (!milikFolder && !relevan(`${t.judul ?? ""} ${t.bukti ?? ""}`)) continue;
    reg.push({ id: t.id, judul: t.judul ?? "", status: t.status, sebab: menunggu ? `status ${t.status}` : "bukti memuat penanda terbuka" });
  }
  return { folder: f ? folder : null, kata, catatan, register: reg, diperiksa: { poin: poin.length, tugas: tugas.length } };
}

const potong = (s, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export function formatTeks(h) {
  const judul = `Arah terbuka${h.folder ? ` · ${h.folder}` : ""}${h.kata.length ? ` · kata: ${h.kata.join(", ")}` : ""}`;
  const n = h.catatan.length + h.register.length;
  if (!n) return `${judul}: tidak ada (diperiksa ${h.diperiksa.poin} poin catatan, ${h.diperiksa.tugas} tugas register)`;
  const out = [`${judul}: ${n}`];
  for (const p of h.catatan) out.push(`- [${p.berkas}:${p.baris}] ${potong(p.teks)}`);
  for (const t of h.register) out.push(`- [register] ${t.id} (${t.sebab}) ${potong(t.judul, 120)}`);
  return out.join("\n");
}

export function main(argv, env = process.env) {
  const opsi = { folder: null, kata: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opsi.json = true;
    else if (a === "--kata" && argv[i + 1]) opsi.kata.push(argv[++i]);
    else if (!a.startsWith("--") && !opsi.folder) opsi.folder = a;
    else { console.error("Pakai: bin/arah-terbuka.sh [<folder>] [--kata <kunci>]… [--json]"); return 3; }
  }
  const root = env.RUDISONE_ROOT ? path.resolve(env.RUDISONE_ROOT) : ROOT_BAWAAN;
  const h = arahTerbuka({ root, folder: opsi.folder, kata: opsi.kata,
    ...(env.RUDISONE_REGISTER_JSON ? { register: env.RUDISONE_REGISTER_JSON } : {}) });
  console.log(opsi.json ? JSON.stringify(h, null, 2) : formatTeks(h));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
