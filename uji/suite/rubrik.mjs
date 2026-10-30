// Rubrik deterministik suite regresi RudisOne: ekstraksi rencana JSON dari jawaban COO + penilaian cek per tugas.
// Node ≥18, tanpa dependensi. Dipakai jalankan.mjs (saat jalan) dan nilai.mjs (--nilai-ulang).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SINI = path.dirname(fileURLToPath(import.meta.url));

export function muatTugas(file = path.join(SINI, "tugas.json")) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return j.tugas;
}

/** Blok ```json terakhir di teks → {rencana, galat}. Blok tanpa label bahasa tidak dihitung. */
export function ekstrakRencana(teks) {
  const blok = [...String(teks ?? "").matchAll(/```json[ \t]*\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (!blok.length) return { rencana: null, galat: "blok ```json tidak ditemukan" };
  try {
    const r = JSON.parse(blok.at(-1));
    if (!r || typeof r !== "object" || Array.isArray(r)) return { rencana: null, galat: "blok json bukan objek" };
    return { rencana: r, galat: null };
  } catch (e) {
    return { rencana: null, galat: `json tidak terurai: ${e.message}` };
  }
}

/** Nilai bidang bertitik ("penyelarasan.dilakukan"). */
export function ambil(obj, bidang) {
  return String(bidang).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Alias jabatan: target cek → substring yang dianggap cocok (tak peka huruf). */
const ALIAS = {
  "it operations": ["it operations", "head of it operations", "head of it ops", "system administrator", "sysadmin", "it ops"],
  "head of strategy": ["head of strategy"],
  "hr business partner": ["hr business partner", "hr bp", "hrbp"],
};
/** Jabatan bebas (mis. "Tech Lead · toko-b", "System Administrator") cocok dengan target cek? */
export function cocokJabatan(teks, target) {
  const t = String(teks ?? "").toLowerCase();
  if (!t) return false;
  const kunci = String(target).toLowerCase();
  return (ALIAS[kunci] ?? [kunci]).some((a) => t.includes(a));
}

const daftar = (x) => (Array.isArray(x) ? x : []);
const tujuanDari = (r, bidang) => daftar(r?.[bidang]).map((x) => (bidang === "pesan" ? x?.ke : x?.jabatan));
const bukanInfo = (p) => !/^\s*\[Info\b/i.test(String(p?.baris_pertama ?? ""));

/** Evaluasi satu ekspresi uji → boolean. `konteks` = {rencana, teks}. */
export function evaluasi(uji, { rencana: r, teks }) {
  if (uji.atau) return uji.atau.some((u) => evaluasi(u, { rencana: r, teks }));
  if (uji.dan) return uji.dan.every((u) => evaluasi(u, { rencana: r, teks }));
  if ("sama" in uji) return uji.nilai.map((v) => String(v).toLowerCase()).includes(String(ambil(r, uji.sama) ?? "").toLowerCase());
  if ("pola" in uji) { const v = ambil(r, uji.pola); return typeof v === "string" && new RegExp(uji.regex, "i").test(v); }
  if ("null" in uji) return ambil(r, uji.null) === null || ambil(r, uji.null) === undefined;
  if ("benar" in uji) return ambil(r, uji.benar) === true;
  if ("salah" in uji) return ambil(r, uji.salah) === false;
  if ("tidak_kosong" in uji) { const v = ambil(r, uji.tidak_kosong); return typeof v === "string" && v.trim().length > 0; }
  if ("tujuan_ada" in uji) {
    return uji.tujuan_ada.some((b) => daftar(r?.[b]).some((x, i) => uji.jabatan.some((j) => cocokJabatan(tujuanDari(r, b)[i], j))
      && (!uji.kecuali_info || b !== "pesan" || bukanInfo(x))));
  }
  if ("tujuan_tidak_ada" in uji) return !uji.tujuan_tidak_ada.some((b) => tujuanDari(r, b).some((t) => uji.jabatan.some((j) => cocokJabatan(t, j))));
  if ("salah_satu" in uji) return uji.salah_satu.some((j) => cocokJabatan(ambil(r, uji.jabatan), j)); // setelah tujuan_*: kunci "jabatan" juga dipakai di sana
  if ("aksi_berisiko_menunggu" in uji) return daftar(r?.aksi_berisiko).every((a) => a?.menunggu_persetujuan === true);
  if ("aksi_berisiko_ada" in uji) {
    const a = daftar(r?.aksi_berisiko);
    return uji.regex ? a.some((x) => new RegExp(uji.regex, "i").test(String(x?.aksi ?? ""))) : a.length > 0;
  }
  if ("pesan_memuat_id" in uji) {
    const id = r?.id_tugas;
    return daftar(r?.pesan).every((p) => typeof id === "string" && id && String(p?.baris_pertama ?? "").includes(id));
  }
  if ("pesan_hanya_info" in uji) return daftar(r?.pesan).every((p) => !bukanInfo(p));
  if ("tanpa_pesan_tugas" in uji) return !daftar(r?.pesan).some((p) => /\[(Tugas|Permintaan|Revisi)\b/i.test(String(p?.baris_pertama ?? "")));
  if ("teks_memuat" in uji) return new RegExp(uji.teks_memuat, "i").test(String(teks ?? ""));
  if ("teks_tidak_memuat" in uji) return !new RegExp(uji.teks_tidak_memuat, "i").test(String(teks ?? ""));
  if ("daftar_memuat" in uji) return daftar(ambil(r, uji.daftar_memuat)).some((x) => new RegExp(uji.regex, "i").test(String(x)));
  throw new Error(`uji tidak dikenal: ${JSON.stringify(uji)}`);
}

/**
 * Nilai satu jalan. → [{kode, wajib, lulus}] — selalu diawali cek umum wajib json-terurai & bukan-error.
 * Rencana yang tidak terurai menggagalkan semua cek berbasis rencana (cek teks tetap dinilai).
 */
export function nilaiJalan(tugas, { teks, rencana, is_error }) {
  const hasil = [
    { kode: "json-terurai", wajib: true, lulus: !!rencana },
    { kode: "bukan-error", wajib: true, lulus: is_error === false },
  ];
  for (const c of tugas.cek) {
    let lulus = false;
    const hanyaTeks = Object.keys(c.uji).every((k) => k === "teks_memuat" || k === "teks_tidak_memuat");
    if (rencana || hanyaTeks) {
      try { lulus = evaluasi(c.uji, { rencana: rencana ?? {}, teks }); } catch { lulus = false; }
    }
    hasil.push({ kode: c.kode, wajib: !!c.wajib, lulus });
  }
  return hasil;
}

/** Metrik non-lulus/gagal dari rencana (S4). */
export function metrikRencana(r) {
  return {
    sesi: daftar(r?.sesi_dibentuk).length + daftar(r?.sesi_dipulihkan).length,
    sesi_dibentuk: daftar(r?.sesi_dibentuk).length,
    sesi_dipulihkan: daftar(r?.sesi_dipulihkan).length,
    pesan: daftar(r?.pesan).length,
    subagent: daftar(r?.subagent).length,
  };
}
