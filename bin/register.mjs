#!/usr/bin/env node
// Register tugas RudisOne — sumber kebenaran handoff/register-tugas.json; register-tugas.md dibangkitkan darinya.
// Setiap perintah tulis memegang kunci berkas, membaca-ubah-menulis secara atomik, lalu membangkitkan ulang MD.
// Pemakaian (bin/register.sh <perintah> …):
//   tambah --judul … [--id baru|T-…] [--folder --divisi --pemilik --prioritas --status --fase --kunci a,b --bergantung x --perkakas]
//   ubah <ID> --<kolom> <nilai> …     (status selesai/dibatalkan mengisi selesai_pada; --bukti)
//     jalur SDD (opsional, skill rudis-sdd): --mode-saat-mulai A|B|- --jalur-awal x --jalur-akhir y --reroute "alasan"; nilai "" menghapus
//   tampil [--json] [--semua]         ringkasan tugas aktif (urut prioritas lalu dibuat)
//   kunci-cek <ID> | --kunci a,b [--kecuali ID]   keluar 1 + daftar tugas aktif yang berbagi kunci; 0 bila bebas
//   validasi · bangkitkan · impor [--dari <md>] [--timpa] · rapikan (buang selesai/dibatalkan > 14 hari)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(INI), "..");
/** Lokasi berkas (dibaca saat dipakai agar override env untuk tes berlaku). */
export const berkasJson = () => process.env.RUDISONE_REGISTER_JSON || path.join(ROOT, "handoff", "register-tugas.json");
export const berkasMd = () => process.env.RUDISONE_REGISTER_MD || path.join(path.dirname(berkasJson()), "register-tugas.md");

export const PRIORITAS = ["segera", "tinggi", "normal"];
export const STATUS = ["penyelarasan", "baru", "antre", "berjalan", "diparkir", "ditinjau", "terhambat", "selesai", "dibatalkan"];
const TUTUP = new Set(["selesai", "dibatalkan"]);
/** Status yang tidak ikut kunci-cek: tugas tutup dan yang belum disepakati. */
const TIDAK_MEMEGANG_KUNCI = new Set([...TUTUP, "penyelarasan"]);
const RE_ID = /^T-\d{8}-\d+(\.\d+)?$/;
const TEKS = ["judul", "folder", "divisi", "pemilik", "fase", "perkakas"];
const DAFTAR = ["kunci", "bergantung"];
/** Kolom opsional jalur SDD (skill rudis-sdd › Jalur dua sumbu): mode proyek saat tugas mulai, jalur awal/akhir, alasan re-route. */
export const JALUR = ["mode_saat_mulai", "jalur_awal", "jalur_akhir", "reroute"];
export const MODE = ["A", "B", "-"];
const RE_JALUR = /^[a-z0-9][a-z0-9+-]{0,39}$/;
const REROUTE_MAKS = 200;
const KOLOM_TUGAS = new Set(["id", ...TEKS, "prioritas", "status", ...DAFTAR, "dibuat", "diperbarui", "selesai_pada", "bukti", ...JALUR]);
/** Kolom yang boleh "?" — hanya selama status penyelarasan. */
const BOLEH_TANYA = new Set(["folder", "divisi", "pemilik", "prioritas", "fase", "perkakas"]);
const RAPIKAN_HARI = 14;
const KUNCI_TUNGGU_MS = 50, KUNCI_BATAS_MS = 10e3, KUNCI_BASI_MS = 30e3;

export const aktif = (t) => !TUTUP.has(t.status);
const isoValid = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s));
const tanggalValid = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s.slice(0, 10)));
const dua = (n) => String(n).padStart(2, "0");
/** Tanggal lokal YYYY-MM-DD / YYYYMMDD dan "YYYY-MM-DD HH:MM" untuk tampilan. */
export const tanggalLokal = (d = new Date()) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
export const waktuLokal = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? String(iso ?? "") : `${tanggalLokal(d)} ${dua(d.getHours())}:${dua(d.getMinutes())}`; };

// ---------- skema ----------
/** Daftar galat (kosong = valid). */
export function validasi(reg) {
  const g = [];
  if (!reg || typeof reg !== "object" || Array.isArray(reg)) return ["register bukan objek JSON"];
  if (reg.versi !== 1) g.push(`versi harus 1 (sekarang ${JSON.stringify(reg.versi)})`);
  if (!isoValid(reg.diperbarui)) g.push("diperbarui: harus waktu ISO");
  if (!Array.isArray(reg.tugas)) return [...g, "tugas: harus larik"];
  for (const k of Object.keys(reg)) if (!["versi", "diperbarui", "tugas"].includes(k)) g.push(`kolom tidak dikenal di akar: ${k}`);
  const ids = new Set();
  reg.tugas.forEach((t, i) => {
    const di = `tugas[${i}]${t?.id ? ` ${t.id}` : ""}`;
    if (!t || typeof t !== "object" || Array.isArray(t)) { g.push(`${di}: bukan objek`); return; }
    if (typeof t.id !== "string" || !RE_ID.test(t.id)) g.push(`${di}: id harus T-YYYYMMDD-n atau T-YYYYMMDD-n.k`);
    else if (ids.has(t.id)) g.push(`${di}: id ganda`);
    else ids.add(t.id);
    for (const k of Object.keys(t)) if (!KOLOM_TUGAS.has(k)) g.push(`${di}: kolom tidak dikenal: ${k}`);
    const selaras = t.status === "penyelarasan";
    for (const k of TEKS) {
      if (typeof t[k] !== "string" || !t[k].trim()) g.push(`${di}: ${k} wajib teks tidak kosong`);
      else if (/[\n|]/.test(t[k])) g.push(`${di}: ${k} tidak boleh memuat baris baru atau "|"`);
    }
    if (!STATUS.includes(t.status)) g.push(`${di}: status harus salah satu dari ${STATUS.join("|")}`);
    if (!PRIORITAS.includes(t.prioritas) && !(selaras && t.prioritas === "?")) g.push(`${di}: prioritas harus ${PRIORITAS.join("|")}${selaras ? " atau ?" : ""}`);
    if (!selaras) for (const k of BOLEH_TANYA) if (t[k] === "?") g.push(`${di}: ${k} "?" hanya boleh selama status penyelarasan`);
    for (const k of DAFTAR) {
      if (!Array.isArray(t[k]) || t[k].some((x) => typeof x !== "string" || !x.trim() || /[\n|,]/.test(x))) g.push(`${di}: ${k} harus larik teks (tanpa koma/"|")`);
    }
    for (const k of ["dibuat", "diperbarui"]) if (!isoValid(t[k])) g.push(`${di}: ${k} harus waktu ISO`);
    if ("selesai_pada" in t && !tanggalValid(t.selesai_pada)) g.push(`${di}: selesai_pada harus tanggal YYYY-MM-DD`);
    if (TUTUP.has(t.status) && !("selesai_pada" in t)) g.push(`${di}: status ${t.status} wajib selesai_pada`);
    if ("bukti" in t && (typeof t.bukti !== "string" || /[\n|]/.test(t.bukti))) g.push(`${di}: bukti harus teks satu baris tanpa "|"`);
    // jalur SDD (opsional)
    if ("mode_saat_mulai" in t && !MODE.includes(t.mode_saat_mulai)) g.push(`${di}: mode_saat_mulai harus ${MODE.join("|")}`);
    for (const k of ["jalur_awal", "jalur_akhir"]) {
      if (k in t && (typeof t[k] !== "string" || !RE_JALUR.test(t[k]))) g.push(`${di}: ${k} harus nilai pendek huruf kecil/angka/"-"/"+" (≤ 40), mis. tracer, redesign, pasang+sesuaikan`);
    }
    if ("reroute" in t && (typeof t.reroute !== "string" || !t.reroute.trim() || /[\n|]/.test(t.reroute) || t.reroute.length > REROUTE_MAKS)) {
      g.push(`${di}: reroute harus alasan satu baris tanpa "|" (≤ ${REROUTE_MAKS} karakter)`);
    }
    if ("jalur_akhir" in t && !("jalur_awal" in t)) g.push(`${di}: jalur_akhir butuh jalur_awal`);
    else if ("jalur_akhir" in t && t.jalur_akhir !== t.jalur_awal && !("reroute" in t)) g.push(`${di}: jalur_akhir (${t.jalur_akhir}) ≠ jalur_awal (${t.jalur_awal}) wajib reroute (alasan re-route)`);
  });
  return g;
}

export const registerKosong = () => ({ versi: 1, diperbarui: new Date().toISOString(), tugas: [] });

/** Isi register; berkas belum ada → null. JSON rusak → galat. */
export function baca(file = berkasJson()) {
  let teks;
  try { teks = fs.readFileSync(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; }
  return JSON.parse(teks);
}

// ---------- kunci berkas & penulisan atomik ----------
const tidur = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** Jalankan fn() sambil memegang <json>.lock (dibuat eksklusif dengan "wx"). Kunci basi (> 30 dtk) dibersihkan. */
export function denganKunci(fn, file = berkasJson()) {
  const kunci = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mulai = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(kunci, "wx");
      try { fs.writeSync(fd, `${process.pid} ${new Date().toISOString()}\n`); } finally { fs.closeSync(fd); }
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        const umur = Date.now() - fs.statSync(kunci).mtimeMs;
        if (umur > KUNCI_BASI_MS) {
          console.error(`register: kunci basi (${Math.round(umur / 1000)} dtk, ${fs.readFileSync(kunci, "utf8").trim() || "tanpa isi"}) dibersihkan: ${kunci}`);
          fs.unlinkSync(kunci);
          continue;
        }
      } catch { continue; /* kunci baru saja dilepas */ }
      if (Date.now() - mulai > KUNCI_BATAS_MS) throw new Error(`register: kunci ${kunci} masih dipegang setelah ${KUNCI_BATAS_MS / 1000} dtk — coba lagi`);
      tidur(KUNCI_TUNGGU_MS + Math.floor(Math.random() * 20));
    }
  }
  try { return fn(); } finally { try { fs.unlinkSync(kunci); } catch { /* sudah dibersihkan */ } }
}

/** Tulis ke berkas sementara di folder yang sama, fsync, lalu rename (atomik di sistem berkas yang sama). */
export function tulisAtomik(file, isi) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`);
  const fd = fs.openSync(tmp, "w");
  try { fs.writeSync(fd, isi); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, file); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* */ } throw e; }
  try { const d = fs.openSync(dir, "r"); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } } catch { /* fsync folder tidak didukung */ }
}

/** Baca-ubah-tulis di dalam kunci: ubah(reg) memodifikasi register; hasilnya divalidasi, ditulis, MD dibangkitkan. */
export function perbarui(ubah, { json = berkasJson(), md = berkasMd(), bolehBaru = true } = {}) {
  return denganKunci(() => {
    let reg = baca(json);
    if (!reg) { if (!bolehBaru) throw new Error(`register belum ada: ${json}`); reg = registerKosong(); }
    const hasil = ubah(reg);
    reg.diperbarui = new Date().toISOString();
    const galat = validasi(reg);
    if (galat.length) { const e = new Error(`register tidak valid — tidak ditulis:\n  - ${galat.join("\n  - ")}`); e.galat = galat; throw e; }
    tulisAtomik(json, `${JSON.stringify(reg, null, 2)}\n`);
    tulisAtomik(md, bangkitkanMd(reg));
    return hasil;
  }, json);
}

// ---------- operasi ----------
/** ID berikut untuk tanggal lokal hari ini: T-YYYYMMDD-(n terbesar + 1). */
export function idBaru(reg, d = new Date()) {
  const tgl = tanggalLokal(d).replace(/-/g, "");
  const pakai = reg.tugas.map((t) => t.id.match(new RegExp(`^T-${tgl}-(\\d+)`))?.[1]).filter(Boolean).map(Number);
  return `T-${tgl}-${pakai.length ? Math.max(...pakai) + 1 : 1}`;
}
const urutPrioritas = (p) => { const i = PRIORITAS.indexOf(p); return i < 0 ? PRIORITAS.length : i; };
export const urut = (daftar) => [...daftar].sort((a, b) => urutPrioritas(a.prioritas) - urutPrioritas(b.prioritas) || String(a.dibuat).localeCompare(String(b.dibuat)) || a.id.localeCompare(b.id));
/** "a, b" / "—" / "" → ["a", "b"] / []. */
export const pisahDaftar = (v) => String(v ?? "").split(/\s*[,;]\s*/).map((x) => x.trim()).filter((x) => x && !/^[—–-]$/.test(x));

/** Kolom dari opsi CLI → nilai tugas. */
function terapkanKolom(t, opsi) {
  for (const [k, v] of Object.entries(opsi)) {
    if (k === "id") continue;
    if (DAFTAR.includes(k)) t[k] = pisahDaftar(v);
    else if (JALUR.includes(k)) {
      const s = String(v).trim();
      if (!s) delete t[k];                                            // "" menghapus kolom opsional
      else if (k === "mode_saat_mulai") t[k] = /^[—–-]$/.test(s) ? "-" : s.toUpperCase();
      else if (k === "reroute") t[k] = s;
      else t[k] = s.toLowerCase();
    } else if (k === "selesai_pada" || k === "bukti" || TEKS.includes(k) || k === "prioritas" || k === "status") t[k] = String(v).trim();
    else throw new Error(`kolom tidak dikenal: --${k}`);
  }
  if (TUTUP.has(t.status)) t.selesai_pada ??= tanggalLokal();
  else delete t.selesai_pada;
}

export function tambah(opsi, lokasi) {
  if (!opsi.judul) throw new Error("--judul wajib");
  return perbarui((reg) => {
    const id = !opsi.id || opsi.id === "baru" ? idBaru(reg) : String(opsi.id);
    if (reg.tugas.some((t) => t.id === id)) throw new Error(`ID sudah ada: ${id}`);
    const kini = new Date().toISOString();
    // bawaan = tugas baru dalam penyelarasan (Pemilik COO; kolom yang belum jelas "?")
    const t = { id, judul: "", folder: "?", divisi: "?", pemilik: "COO", prioritas: "normal", status: "penyelarasan",
      fase: "—", kunci: [], bergantung: [], perkakas: "—", dibuat: kini, diperbarui: kini };
    terapkanKolom(t, opsi);
    reg.tugas.push(t);
    return id;
  }, lokasi);
}

export function ubah(id, opsi, lokasi) {
  if (!Object.keys(opsi).length) throw new Error("tidak ada kolom yang diubah");
  return perbarui((reg) => {
    const t = reg.tugas.find((x) => x.id === id);
    if (!t) throw new Error(`tugas tidak ditemukan: ${id}`);
    if (opsi.id && opsi.id !== id) throw new Error("ID tidak bisa diubah");
    terapkanKolom(t, opsi);
    t.diperbarui = new Date().toISOString();
    return t;
  }, { ...lokasi, bolehBaru: false });
}

/** Dua kunci berbenturan bila sama, atau yang satu awalan yang lain pada batas ":" atau "/" (repo:kasir ⊃ repo:kasir:print). */
export function kunciBentrok(a, b) {
  if (a === b) return true;
  const [p, q] = a.length < b.length ? [a, b] : [b, a];
  return q.startsWith(p) && /[:/]/.test(q[p.length]);
}
/** Tugas aktif (bukan selesai/dibatalkan/penyelarasan) yang berbagi kunci → [{id, judul, status, pemilik, kunci: [bentrok]}]. */
export function cekKunci(reg, kunci, kecuali = null) {
  const hasil = [];
  for (const t of reg?.tugas ?? []) {
    if (t.id === kecuali || TIDAK_MEMEGANG_KUNCI.has(t.status)) continue;
    const sama = t.kunci.filter((k) => kunci.some((x) => kunciBentrok(x, k)));
    if (sama.length) hasil.push({ id: t.id, judul: t.judul, status: t.status, pemilik: t.pemilik, kunci: sama });
  }
  return hasil;
}

export function rapikan(lokasi, kini = new Date()) {
  const batas = tanggalLokal(new Date(kini.getTime() - RAPIKAN_HARI * 864e5));
  return perbarui((reg) => {
    const sebelum = reg.tugas.length;
    reg.tugas = reg.tugas.filter((t) => aktif(t) || String(t.selesai_pada ?? "").slice(0, 10) >= batas);
    return sebelum - reg.tugas.length;
  }, { ...lokasi, bolehBaru: false });
}

// ---------- MD (tampilan manusia + Kantor) ----------
const sel = (v) => String(v ?? "").replace(/\|/g, "¦").replace(/\s*\n\s*/g, " ").trim() || "—";
const daftarSel = (a) => (a?.length ? a.join(", ") : "—");
const folderSel = (f) => (!f || f === "?" || f === "—" ? sel(f) : `\`${sel(f)}\``);
export const KEPALA_AKTIF = ["ID", "Tugas", "Folder", "Divisi", "Pemilik", "Prioritas", "Status", "Fase", "Kunci", "Bergantung", "Perkakas", "Diperbarui"];
export const KEPALA_SELESAI = ["ID", "Tanggal", "Tugas", "Folder", "Pemilik", "Status", "Perkakas", "Bukti / hasil"];
export const PENANDA_BANGKIT = "DIBANGKITKAN dari register-tugas.json — jangan diedit tangan; ubah lewat bin/register.sh";
const baris = (sel2) => `| ${sel2.join(" | ")} |`;
const pemisah = (n) => `|${"---|".repeat(n)}`;

export function bangkitkanMd(reg) {
  const terbuka = urut(reg.tugas.filter(aktif));
  const tutup = reg.tugas.filter((t) => !aktif(t))
    .sort((a, b) => String(b.selesai_pada).localeCompare(String(a.selesai_pada)) || b.id.localeCompare(a.id));
  return [
    `<!-- ${PENANDA_BANGKIT}. -->`,
    "# Register tugas — COO",
    "<!-- Status: penyelarasan · baru · antre · berjalan · diparkir · ditinjau · terhambat · selesai · dibatalkan.",
    "     Prioritas: segera · tinggi · normal. Lihat templat/register-tugas.md untuk arti kolom. -->",
    "",
    "## Aktif",
    "",
    baris(KEPALA_AKTIF), pemisah(KEPALA_AKTIF.length),
    ...terbuka.map((t) => baris([t.id, sel(t.judul), folderSel(t.folder), sel(t.divisi), sel(t.pemilik), sel(t.prioritas), sel(t.status),
      sel(t.fase), daftarSel(t.kunci), daftarSel(t.bergantung), sel(t.perkakas), waktuLokal(t.diperbarui)])),
    "",
    "## Selesai",
    "",
    baris(KEPALA_SELESAI), pemisah(KEPALA_SELESAI.length),
    ...tutup.map((t) => baris([t.id, sel(String(t.selesai_pada).slice(0, 10)), sel(t.judul), folderSel(t.folder), sel(t.pemilik), sel(t.status),
      sel(t.perkakas), sel(t.bukti)])),
    "",
    ...bagianJalur(reg.tugas),
  ].join("\n");
}

export const KEPALA_JALUR = ["ID", "Mode", "Jalur awal", "Jalur akhir", "Re-route"];
/** Bagian "Jalur" hanya bila ada tugas yang mengisi kolom jalur SDD (tanpa kolom Status → Kantor & impor melewatinya). */
function bagianJalur(tugas) {
  const isi = urut(tugas.filter((t) => JALUR.some((k) => k in t)));
  if (!isi.length) return [];
  return [
    "## Jalur (skill rudis-sdd)",
    "",
    baris(KEPALA_JALUR), pemisah(KEPALA_JALUR.length),
    ...isi.map((t) => baris([t.id, sel(t.mode_saat_mulai), sel(t.jalur_awal), sel(t.jalur_akhir), sel(t.reroute)])),
    "",
  ];
}

// ---------- impor satu kali dari MD lama ----------
const PETA_KOLOM = { id: ["id"], judul: ["tugas"], folder: ["folder"], divisi: ["divisi"], pemilik: ["pemilik", "leader/staf"],
  prioritas: ["prioritas"], status: ["status"], fase: ["fase"], kunci: ["kunci"], bergantung: ["bergantung", "bergantung pada"],
  perkakas: ["perkakas"], diperbarui: ["diperbarui"], tanggal: ["tanggal"], bukti: ["bukti / hasil", "bukti", "hasil"] };
const bersih = (t) => String(t ?? "").replace(/`/g, "").replace(/\*\*/g, "").trim();
const kosong = (v) => !v || /^[—–-]$/.test(v);
/** "YYYY-MM-DD[ HH:MM]" (waktu lokal) → ISO; tidak terbaca → null. */
function isoDariLokal(v) {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return Number.isNaN(+d) ? null : d.toISOString();
}
const isoDariId = (id) => { const m = id.match(/^T-(\d{4})(\d{2})(\d{2})/); return m ? isoDariLokal(`${m[1]}-${m[2]}-${m[3]}`) : null; };

/** Baris tugas dari semua tabel ber-kolom ID & Status di register-tugas.md lama → {tugas, peringatan}. */
export function imporMd(teks) {
  const per = new Map(), peringatan = [];
  const larik = teks.split(/\r?\n/);   // MD lama bisa ber-CRLF (disunting di Windows)
  for (let i = 0; i < larik.length - 1; i++) {
    if (!/^\|/.test(larik[i]) || !/^\|\s*:?-{3}/.test(larik[i + 1])) continue;
    const kepala = larik[i].split("|").slice(1, -1).map((k) => k.trim().toLowerCase());
    const ix = Object.fromEntries(Object.entries(PETA_KOLOM).map(([k, nama]) => [k, kepala.findIndex((h) => nama.includes(h))]));
    if (ix.id < 0 || ix.status < 0) continue;
    for (let j = i + 2; j < larik.length && /^\|/.test(larik[j]); j++) {
      const s = larik[j].split("|").slice(1, -1).map(bersih);
      const r = Object.fromEntries(Object.entries(ix).map(([k, x]) => [k, x >= 0 ? s[x] ?? "" : ""]));
      if (!RE_ID.test(r.id)) continue;   // baris contoh (T-YYYYMMDD-1) dan baris kosong dilewati
      const status = r.status.toLowerCase().split(/[\s(·,]/)[0];
      const dibuat = isoDariId(r.id) ?? new Date().toISOString();
      const diperbarui = isoDariLokal(r.diperbarui) ?? isoDariLokal(r.tanggal) ?? dibuat;
      const t = {
        id: r.id, judul: r.judul || "?", folder: r.folder.replace(/\/+$/, "") || "?", divisi: r.divisi || "—", pemilik: r.pemilik || "?",
        prioritas: (r.prioritas || "normal").toLowerCase(), status,
        fase: kosong(r.fase) ? "—" : r.fase, kunci: pisahDaftar(r.kunci), bergantung: pisahDaftar(r.bergantung),
        perkakas: kosong(r.perkakas) ? "—" : r.perkakas, dibuat, diperbarui,
      };
      if (TUTUP.has(status)) t.selesai_pada = (r.tanggal.match(/^\d{4}-\d{2}-\d{2}/)?.[0]) ?? diperbarui.slice(0, 10);
      if (!kosong(r.bukti)) t.bukti = r.bukti;
      const lama = per.get(t.id);
      if (lama) {
        peringatan.push(`ID ${t.id} muncul lebih dari sekali — ${TUTUP.has(t.status) || !TUTUP.has(lama.status) ? "baris terakhir" : "baris tutup"} dipakai`);
        if (TUTUP.has(lama.status) && !TUTUP.has(t.status)) continue;
      }
      per.set(t.id, t);
    }
  }
  return { tugas: [...per.values()], peringatan };
}

export function impor({ dari = berkasMd(), timpa = false, json = berkasJson(), md = berkasMd() } = {}) {
  return denganKunci(() => {
    if (fs.existsSync(json) && !timpa) throw new Error(`${json} sudah ada — impor hanya untuk migrasi pertama (pakai --timpa untuk menimpa)`);
    const teks = fs.readFileSync(dari, "utf8");
    const { tugas, peringatan } = imporMd(teks);
    const reg = { versi: 1, diperbarui: new Date().toISOString(), tugas };
    const galat = validasi(reg);
    if (galat.length) { const e = new Error(`hasil impor tidak valid — perbaiki ${dari} lalu ulangi:\n  - ${galat.join("\n  - ")}`); e.galat = galat; throw e; }
    // MD tulisan tangan disimpan sebelum ditimpa versi bangkitan
    if (fs.existsSync(md) && !fs.readFileSync(md, "utf8").includes(PENANDA_BANGKIT)) fs.copyFileSync(md, `${md}.sebelum-impor`);
    // JSON lama tidak pernah hilang: --timpa menyalinnya dulu (impor dari MD tidak membawa bukti/jam persis)
    if (fs.existsSync(json)) fs.copyFileSync(json, `${json}.sebelum-impor-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    tulisAtomik(json, `${JSON.stringify(reg, null, 2)}\n`);
    tulisAtomik(md, bangkitkanMd(reg));
    return { jumlah: tugas.length, peringatan };
  }, json);
}

// ---------- CLI ----------
const BENDERA = new Set(["json", "semua", "timpa"]);
/** ["ubah", "T-1", "--status", "x", "--json"] → {pos: ["ubah", "T-1"], opsi: {status: "x", json: true}} */
export function uraiArg(argv) {
  const pos = [], opsi = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { pos.push(a); continue; }
    let [k, v] = a.slice(2).split(/=(.*)/s);
    k = k.replace(/-/g, "_");
    if (BENDERA.has(k)) { opsi[k] = true; continue; }
    if (v === undefined) {
      if (i + 1 >= argv.length) throw new Error(`--${k} butuh nilai`);
      v = argv[++i];
    }
    opsi[k] = v;
  }
  return { pos, opsi };
}

function ringkas(t) {
  const kunci = t.kunci.length ? ` · kunci ${t.kunci.join(", ")}` : "";
  const jalur = t.jalur_awal ? ` · jalur ${t.mode_saat_mulai ? `${t.mode_saat_mulai}:` : ""}${t.jalur_awal}${t.jalur_akhir && t.jalur_akhir !== t.jalur_awal ? `→${t.jalur_akhir}` : ""}` : "";
  return `${t.id}  [${t.prioritas}] ${t.status.padEnd(12)} ${t.judul} — ${t.pemilik}${kunci}${jalur}`;
}

export function main(argv) {
  let pos, opsi;
  try { ({ pos, opsi } = uraiArg(argv)); } catch (e) { console.error(`register: ${e.message}`); return 2; }
  const [perintah, arg] = pos;
  const json = berkasJson(), md = berkasMd();
  try {
    switch (perintah) {
      case "tambah": {
        const { json: _j, semua: _s, timpa: _t, ...kolom } = opsi;
        console.log(tambah(kolom, { json, md }));
        return 0;
      }
      case "ubah": {
        if (!arg) { console.error("register: ubah <ID> --<kolom> <nilai> …"); return 2; }
        const t = ubah(arg, opsi, { json, md });
        console.log(ringkas(t));
        return 0;
      }
      case "tampil": {
        const reg = baca(json) ?? registerKosong();
        const daftar = urut(opsi.semua ? reg.tugas : reg.tugas.filter(aktif));
        if (opsi.json) console.log(JSON.stringify(daftar, null, 2));
        else console.log(daftar.length ? daftar.map(ringkas).join("\n") : "(tidak ada tugas aktif)");
        return 0;
      }
      case "kunci-cek": {
        const reg = baca(json) ?? registerKosong();
        let kunci, kecuali = opsi.kecuali ?? null;
        if (arg) {
          const t = reg.tugas.find((x) => x.id === arg);
          if (!t) { console.error(`register: tugas tidak ditemukan: ${arg}`); return 2; }
          kunci = t.kunci; kecuali = arg;
        } else if (opsi.kunci) kunci = pisahDaftar(opsi.kunci);
        else { console.error("register: kunci-cek <ID> | --kunci a,b [--kecuali ID]"); return 2; }
        const bentrok = cekKunci(reg, kunci, kecuali);
        if (!bentrok.length) { console.log(`Kunci bebas: ${kunci.join(", ") || "(tidak ada kunci)"}`); return 0; }
        console.log("Kunci dipegang tugas aktif lain:");
        for (const b of bentrok) console.log(`  ${b.id} (${b.status}, ${b.pemilik}) — ${b.kunci.join(", ")} — ${b.judul}`);
        return 1;
      }
      case "validasi": {
        let reg;
        try { reg = baca(json); } catch (e) { console.log(`Tidak valid: ${json} bukan JSON (${e.message})`); return 1; }
        if (!reg) { console.log(`Tidak valid: ${json} belum ada (migrasi: bin/register.sh impor)`); return 1; }
        const galat = validasi(reg);
        if (!galat.length) { console.log(`Valid: ${reg.tugas.length} tugas (${reg.tugas.filter(aktif).length} aktif) — ${json}`); return 0; }
        console.log(`Tidak valid (${galat.length} galat) — ${json}:`);
        for (const g of galat) console.log(`  - ${g}`);
        return 1;
      }
      case "bangkitkan": {
        denganKunci(() => {
          const reg = baca(json);
          if (!reg) throw new Error(`register belum ada: ${json}`);
          const galat = validasi(reg);
          if (galat.length) throw new Error(`register tidak valid — jalankan validasi:\n  - ${galat.join("\n  - ")}`);
          tulisAtomik(md, bangkitkanMd(reg));
        }, json);
        console.log(`Dibangkitkan: ${md}`);
        return 0;
      }
      case "impor": {
        const h = impor({ dari: opsi.dari ? path.resolve(opsi.dari) : md, timpa: !!opsi.timpa, json, md });
        for (const p of h.peringatan) console.error(`peringatan: ${p}`);
        console.log(`Diimpor ${h.jumlah} tugas ke ${json}; ${md} dibangkitkan ulang.`);
        return 0;
      }
      case "rapikan": {
        console.log(`Dibuang ${rapikan({ json, md })} tugas selesai/dibatalkan > ${RAPIKAN_HARI} hari.`);
        return 0;
      }
      default:
        console.error(fs.readFileSync(INI, "utf8").split("\n").slice(1, 11).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
        return 2;
    }
  } catch (e) {
    console.error(`register: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
