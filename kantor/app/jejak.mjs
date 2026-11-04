// Logika murni Kantor (tanpa DOM/three): keadaan tampil tiap kursi, jejak kerja dari register (papan tulis tim, papan
// tugas, berkas di meja), dan fase waktu untuk cahaya. Dipakai kantor.mjs dan diuji Node (kantor/jejak.test.mjs).
// Prinsip DESAIN.md: "Bekerja" hanya dari aktivitas nyata; papan & berkas hanya ID + judul + status tugas dari register.
import { TIM, kursiTim } from "./denah.mjs";

/** Status kerja nyata dari server (sesi/subagent yang sedang berjalan). */
export const KERJA = new Set(["bekerja", "berpikir", "menunggu"]);
/** Berapa lama orang yang baru selesai tetap ditandai "Baru selesai" di mejanya. */
export const BARU_SELESAI_MS = 10 * 60e3;

/**
 * Kelas tampilan satu kursi: `bekerja` | `berpikir` | `menunggu` (hanya bila ada sesi/subagent yang benar-benar
 * berjalan), `selesai` (pekerjaan nyata berakhir < 10 menit lalu), selain itu `siap` (Siap dipanggil).
 */
export function keadaanTampil(ag, now = Date.now()) {
  if (ag?.present && KERJA.has(ag.status)) return ag.status;
  const ts = Number(ag?.selesai?.ts);
  if (Number.isFinite(ts) && ts > 0 && now - ts > -60e3 && now - ts < BARU_SELESAI_MS) return "selesai";
  return "siap";
}
/** "Selesai baru saja" / "Selesai 3 mnt lalu". */
export function teksSelesai(ts, now = Date.now()) {
  const m = Math.floor(Math.max(0, now - ts) / 60e3);
  return m < 1 ? "Selesai baru saja" : `Selesai ${m} mnt lalu`;
}
/** Keterangan jujur untuk "Siap dipanggil" menurut keadaan sesi di server (siaga · katalog · absen). */
export function keteranganSiap(ag) {
  const mode = ag?.mode ?? (ag?.present ? "siaga" : "absen");
  if (mode === "siaga") return "Ruang kerjanya terbuka, sedang tidak bekerja";
  if (mode === "katalog") return "Bekerja saat ditugaskan";
  return "Mulai bekerja saat COO memberi tugas";
}

// ---------------- panel Tim ringkas ----------------
/** Baris panel Tim yang disembunyikan untuk satu divisi yang tampil: hanya yang "siap" (Siap dipanggil), kecuali divisinya
 *  dibuka atau orangnya sedang dipilih. Semua anggota lain selalu tampil — dihitung ulang tiap render, jadi orang yang
 *  berganti dari siap ke bekerja/menunggu/baru selesai langsung muncul lagi. */
export function barisTersembunyi(anggota = [], keadaan = {}, { buka = false, dipilih = null } = {}) {
  return new Set(anggota.filter((n) => keadaan[n] === "siap" && !buka && dipilih !== n));
}

// ---------------- pemilik tugas → kursi ----------------
/** Id teknis di kolom Pemilik register → nama peran. */
export const NAMA_ID = {
  coo: "COO", "tech-lead": "Tech Lead", "business-systems-analyst": "Business Systems Analyst",
  "software-engineer": "Software Engineer", "program-manager": "Program Manager", "technical-writer": "Technical Writer",
  "head-of-strategy": "Head of Strategy", "financial-controller": "Financial Controller", "research-analyst": "Research Analyst",
  "hr-business-partner": "HR Business Partner", "head-of-it-operations": "Head of IT Operations",
  "system-administrator": "System Administrator",
};
/** Pemilik di register ("Tech Lead · kasir", "Tech Lead · Tim 1", "Head of IT Operations", "COO",
 *  "Software Engineer #2 · toko", atau id teknis seperti "tech-lead") → kursi, atau null. */
export function kursiPemilik(pemilik, tim) {
  if (!pemilik || typeof pemilik !== "string") return null;
  pemilik = pemilik.replace(/\s*\([^()]*\)\s*$/, "").trim();   // keterangan "(subagent)", "(kasir)" di akhir diabaikan
  if (Object.hasOwn(TIM, pemilik)) return pemilik;
  const [peran0, sisa = ""] = pemilik.split(" · ");
  const bernomor = /^(.*?)\s*#(\d)$/.exec(peran0.trim());
  const dasar = bernomor ? bernomor[1] : peran0.trim();
  const peran = Object.hasOwn(NAMA_ID, dasar) ? NAMA_ID[dasar] : dasar;
  if (Object.hasOwn(TIM, peran)) return peran;
  // "· Tim N" atau "· <proyek yang dikenal>"; tanpa keterangan → Tim 1; proyek yang belum dikenal server → tidak ada kursi
  // (tugasnya tetap di papan tugas Ruang Pimpinan, tidak menumpang di papan/meja tim lain)
  const ket = sisa.trim(), n = Number(/^Tim\s*(\d)$/.exec(ket)?.[1] ?? tim?.find((t) => t.proyek === ket)?.n ?? (ket ? NaN : 1));
  if (!Number.isFinite(n)) return null;
  const k = kursiTim(peran === "Software Engineer" ? `Software Engineer #${bernomor?.[2] === "2" ? 2 : 1}` : peran, n);
  return Object.hasOwn(TIM, k) ? k : null;
}

// ---------------- jejak kerja (hanya metadata register) ----------------
/** Status register → kata pertama huruf kecil ("berjalan (Konstruksi)" → "berjalan"). */
export const statusTugas = (s) => String(s || "baru").split(/[\s(]/)[0].toLowerCase();
/** Satu-satunya bentuk tugas yang boleh sampai ke papan/berkas: ID, judul, status. */
const ringkas = (t) => ({ id: String(t.id ?? ""), judul: String(t.tugas ?? t.judul ?? ""), status: statusTugas(t.status) });

/** Papan tulis per divisi (tim1..tim3, corp, …): tugas belum selesai yang pemiliknya duduk di divisi itu. */
export function papanDivisi(tugas = [], tim = []) {
  const papan = {};
  for (const t of tugas) {
    const k = kursiPemilik(t?.pemilik, tim), dv = k && TIM[k].divisi;
    if (!dv) continue;
    (papan[dv] ??= []).push(ringkas(t));
  }
  return papan;
}
/** Papan tugas di dinding Ruang Pimpinan: berjalan · menunggu/antre lainnya · selesai hari ini. */
export function papanTugas(tugas = [], selesaiHariIni = []) {
  const berjalan = [], lain = [];
  for (const t of tugas) (statusTugas(t?.status) === "berjalan" ? berjalan : lain).push(ringkas(t));
  return { berjalan, lain, selesai: selesaiHariIni.map((t) => ({ ...ringkas(t), status: "selesai" })) };
}
/** Berkas di meja: tugas yang selesai hari ini, di meja pemiliknya (kursi → [{id, judul}]). */
export function berkasMeja(selesaiHariIni = [], tim = []) {
  const meja = {};
  for (const t of selesaiHariIni) {
    const k = kursiPemilik(t?.pemilik, tim);
    if (!k) continue;
    const { id, judul } = ringkas(t);
    (meja[k] ??= []).push({ id, judul });
  }
  return meja;
}

// ---------------- suasana mengikuti jam ----------------
export const FASE = ["pagi", "siang", "sore", "malam"];
/** Jam desimal (0–24) → fase: pagi 05–11, siang 11–15, sore 15–18, malam 18–05. */
export function faseWaktu(jam) {
  if (!Number.isFinite(jam)) return "siang";
  const j = ((jam % 24) + 24) % 24;
  return j >= 5 && j < 11 ? "pagi" : j >= 11 && j < 15 ? "siang" : j >= 15 && j < 18 ? "sore" : "malam";
}
/** Jam desimal WIB (Asia/Jakarta) dari waktu `ts`. */
export function jamWIB(ts = Date.now()) {
  const bagian = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ts);
  const ambil = (j) => Number(bagian.find((b) => b.type === j)?.value ?? 0);
  return ambil("hour") + ambil("minute") / 60;
}
/** Parameter uji `?jam=`: nama fase ("pagi", "sore", …) atau jam ("7", "07:30", "19.5"); selain itu null. */
export function faseDariParam(nilai) {
  if (nilai == null || nilai === "") return null;
  const v = String(nilai).trim().toLowerCase();
  if (FASE.includes(v)) return v;
  const m = /^(\d{1,2})(?:[:.](\d{1,2}))?$/.exec(v);
  if (!m || Number(m[1]) > 23) return null;
  const menit = m[2] === undefined ? 0 : v.includes(":") ? Number(m[2]) / 60 : Number(`0.${m[2]}`);
  return faseWaktu(Number(m[1]) + menit);
}
