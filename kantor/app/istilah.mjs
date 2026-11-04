// Istilah baku Kantor (satu sumber; DESAIN.md › Istilah): singkatan jabatan, label status orang & tugas, tahap kerja,
// kalimat aktivitas, dan ringkasan angka. Logika murni (tanpa DOM/three) — dipakai kantor.mjs & denah.mjs, diuji Node
// (kantor/istilah.test.mjs). Jabatan resmi (bahasa Inggris, seperti di organisasi) di tempat lega; singkatan di tempat sempit.

// ---------------- jabatan ----------------
const SINGKAT_PERAN = {
  "COO": "COO", "Head of Strategy": "HoS", "Financial Controller": "FC", "Research Analyst": "RA", "HR Business Partner": "HRBP",
  "Tech Lead": "TL", "Business Systems Analyst": "BSA", "Software Engineer": "SE", "Program Manager": "PgM",
  "Technical Writer": "TW", "Head of IT Operations": "HITO", "System Administrator": "SysAdmin",
};
/** Nama kursi ("Tech Lead · Tim 1", "Software Engineer #2 · Tim 3", "Research Analyst") → singkatan baku ("TL T1", "SE2 T3", "RA"). */
export function singkatan(nama) {
  const [peran0, sisa = ""] = String(nama ?? "").split(" · ");
  const m = /^(.*?)\s*#(\d)$/.exec(peran0), peran = m ? m[1] : peran0, n = /^Tim (\d)$/.exec(sisa)?.[1];
  const s = SINGKAT_PERAN[peran];
  if (!s) return String(nama ?? "");
  return `${s}${m ? m[2] : ""}${n ? ` T${n}` : ""}`;
}
/** Daftar singkatan untuk "Tentang halaman ini" (Tn = nomor tim). */
export const DAFTAR_SINGKATAN = [
  ["COO", "Chief Operating Officer"], ["HoS", "Head of Strategy"], ["FC", "Financial Controller"], ["RA", "Research Analyst"],
  ["HRBP", "HR Business Partner"], ["TL Tn", "Tech Lead, Tim n"], ["BSA Tn", "Business Systems Analyst, Tim n"],
  ["SE1 Tn · SE2 Tn", "Software Engineer #1 · #2, Tim n"], ["PgM", "Program Manager"], ["TW", "Technical Writer"],
  ["HITO", "Head of IT Operations"], ["SysAdmin", "System Administrator"],
];
/** Jabatan pimpinan divisi (ditandai "Pimpinan" di panel Tim; COO tidak). */
export const PIMPINAN = new Set(["Head of Strategy", "Program Manager", "Head of IT Operations"]);
export const pimpinan = (nama) => PIMPINAN.has(nama) || /^Tech Lead · Tim \d$/.test(nama);

// ---------------- status orang ----------------
/** Keadaan tampil (jejak.mjs › keadaanTampil) → label + simbol. Satu-satunya sumber label status di halaman. */
export const STATUS = {
  menunggu: { label: "Menunggu Anda", simbol: "!" },
  bekerja: { label: "Bekerja", simbol: "▶" },
  berpikir: { label: "Berpikir", simbol: "…" },
  selesai: { label: "Baru selesai", simbol: "✓" },
  siap: { label: "Siap dipanggil", simbol: "–" },
  kosong: { label: "Tim tanpa proyek", simbol: "" },
};
export const URUT_STATUS = ["menunggu", "bekerja", "berpikir", "selesai", "siap"];

// ---------------- status & tahap tugas (register) ----------------
/** Status register (kata pertama, huruf kecil) → kata biasa. */
export const STATUS_TUGAS = {
  baru: "Baru", penyelarasan: "Menyamakan persepsi", berjalan: "Dikerjakan", ditinjau: "Ditinjau", antre: "Antre",
  diparkir: "Ditunda", terhambat: "Terhambat", selesai: "Selesai", dibatalkan: "Dibatalkan",
};
export const kataStatusTugas = (st) => STATUS_TUGAS[st] ?? (st ? st[0].toUpperCase() + st.slice(1) : "Baru");
/** Tahap kerja Engineering (urutan SDLC); kolom Fase register dicocokkan dari awal teksnya. */
export const TAHAP = [
  { nama: "Inisiasi", pola: /^(inisiasi|penyelarasan|selaras)/i },
  { nama: "Analisis", pola: /^(analisis|rancangan|desain)/i },
  { nama: "Konstruksi", pola: /^(konstruksi|rakit|pasang)/i },
  { nama: "Pengujian", pola: /^(pengujian|gerbang|tinjau)/i },
  { nama: "Rilis", pola: /^(rilis|penerapan|deploy)/i },
];
/** Fase register → { ke (0-based), dari, nama } atau null (tugas tanpa tahap, mis. riset/dokumen). */
export function tahapTugas(fase) {
  const f = String(fase ?? "").trim();
  if (!f || f === "—" || f === "-") return null;
  const ke = TAHAP.findIndex((t) => t.pola.test(f));
  return ke < 0 ? null : { ke, dari: TAHAP.length, nama: TAHAP[ke].nama };
}
/** Menit → "45 mnt", "2 jam", "2 jam 5 mnt". */
export function durasi(menit) {
  const m = Math.max(0, Math.round(Number(menit) || 0));
  if (m < 60) return `${m} mnt`;
  const j = Math.floor(m / 60), s = m % 60;
  return s ? `${j} jam ${s} mnt` : `${j} jam`;
}
/** Kalimat waktu tahap: "Tahap ini 12 mnt dari perkiraan 25 mnt" / "Melewati perkiraan tahap 6 mnt" / null. */
export function kalimatWaktuTahap(k) {
  if (!k || !Number.isFinite(k.menit)) return null;
  if (!k.anggaran) return { teks: `Tahap ini berjalan ${durasi(k.menit)}`, lewat: false };
  return k.menit > k.anggaran
    ? { teks: `Melewati perkiraan tahap ${durasi(k.menit - k.anggaran)}`, lewat: true }
    : { teks: `Tahap ini ${durasi(k.menit)} dari perkiraan ${durasi(k.anggaran)}`, lewat: false };
}

// ---------------- aktivitas: kalimat kerja + rincian aman ----------------
/** Label aktivitas dari server → kata kerja (huruf kecil, setelah nama pelaku). `n` = jumlah langkah berturut yang digabung. */
const KERJA_AKTIVITAS = [
  [/^Menjalankan tes$/, (n) => (n > 1 ? `menjalankan tes (${n}×)` : "menjalankan tes")],
  [/^Men-deploy rilis$/, () => "memasang rilis ke server"],
  [/^Bekerja di server$/, (n) => (n > 1 ? `bekerja di server (${n} langkah)` : "bekerja di server")],
  [/^Mengurus Git$/, (n) => (n > 1 ? `menyimpan versi kode (${n} langkah)` : "menyimpan versi kode")],
  [/^Menjalankan perintah$/, (n) => (n > 1 ? `menjalankan ${n} perintah` : "menjalankan perintah")],
  [/^Memeriksa riwayat kode$/, (n) => (n > 1 ? `memeriksa riwayat kode (${n} langkah)` : "memeriksa riwayat kode")],
  [/^Menyimpan versi kode$/, (n) => (n > 1 ? `menyimpan versi kode (${n} langkah)` : "menyimpan versi kode")],
  [/^Memotret tampilan$/, (n) => (n > 1 ? `memotret tampilan (${n}×)` : "memotret tampilan")],
  [/^Memasang dependensi$/, () => "memasang dependensi"],
  [/^Mengubah berkas$/, (n) => (n > 1 ? `mengubah berkas (${n} langkah)` : "mengubah berkas")],
  [/^Memeriksa berkas$/, (n) => (n > 1 ? `memeriksa berkas (${n} langkah)` : "memeriksa berkas")],
  [/^Membaca kode$/, (n) => (n > 1 ? `membaca ${n} berkas` : "membaca berkas")],
  [/^Menulis$/, (n) => (n > 1 ? `mengubah ${n} berkas` : "mengubah berkas")],
  [/^Riset di web$/, (n) => (n > 1 ? `mencari di web (${n}×)` : "mencari di web")],
  [/^Membaca halaman web$/, (n) => (n > 1 ? `membaca ${n} halaman web` : "membaca halaman web")],
  [/^Memeriksa di browser$/, (n) => (n > 1 ? `memeriksa tampilan di peramban (${n} langkah)` : "memeriksa tampilan di peramban")],
  [/^Menunggu (jawaban|keputusan) Anda$/, () => "menunggu jawaban Anda"],
  [/^Membuka panduan$/, () => "membuka panduan kerja"],
  [/^Mendelegasikan subagent$/, (n) => (n > 1 ? `menugaskan ${n} asisten` : "menugaskan asisten")],
  [/^Memanggil agent$/, () => "membuka ruang kerja baru"],
  [/^Menyusun rencana$/, () => "menyusun rencana kerja"],
  [/^Menyusun laporan$/, () => "menyusun ringkasan"],
  [/^Memeriksa sesi tim$/, () => "memeriksa kemajuan tim"],
  [/^Mengurus domain$/, () => "mengurus domain"],
  [/^Menerima tugas$/, () => "menerima tugas"],
  [/^Menyerahkan hasil$/, () => "menyerahkan hasil kerja"],
];
const JENIS_PESAN = { Tugas: "tugas", Laporan: "laporan", Revisi: "revisi", Diterima: "konfirmasi diterima", Konsultasi: "pertanyaan",
  Jawaban: "jawaban", Terhambat: "kabar terhambat", Eskalasi: "eskalasi", Info: "info", Tinjau: "permintaan tinjauan" };
/** Kata kerja untuk satu baris aktivitas (tanpa nama pelaku). */
export function kerjaAktivitas(f, n = 1) {
  const label = String(f?.label ?? "");
  const kirim = /^Mengirim pesan ke (.+)$/.exec(label);
  if (kirim) return `mengirim ${JENIS_PESAN[f.detail] ?? "pesan"} ke ${kirim[1]}`;
  const terima = /^Menerima pesan dari (.+)$/.exec(label);
  if (terima) return `menerima pesan dari ${terima[1] === "agent lain" ? "rekan" : terima[1]}`;
  for (const [pola, f2] of KERJA_AKTIVITAS) if (pola.test(label)) return f2(n);
  return n > 1 ? `memakai alat kerja (${n} langkah)` : "memakai alat kerja";   // alat lain: nama alat internal tidak ditampilkan
}
/** Rincian teknis yang boleh tampil di "rincian" (≤ 50 karakter): bukan perintah mentah, bukan nama alat internal. */
export const BATAS_RINCIAN = 50;
const RE_PERINTAH = /[|;&<>`$]|^\s*(?:[A-Z_]+=|sudo\b|perl\b|sed\b|awk\b|git\b|gh\b|cat\b|cd\b|ls\b|rm\b|cp\b|mv\b|node\b|npm\b|npx\b|curl\b|bash\b|sh\b|for\b|while\b|if\b|echo\b|grep\b|find\b|bin\/|\.\/|\/)/;
const RE_ALAT_INTERNAL = /\bmcp__|^[A-Z][a-z]+[A-Z][A-Za-z]*$|\b(?:SubagentHandback|ToolSearch|SendMessage|TaskStop|AskUserQuestion)\b/;
export function rincianAman(detail, label = "") {
  const d = String(detail ?? "").replace(/\s+/g, " ").trim();
  if (!d || /^Mengirim pesan ke /.test(label)) return "";
  if (RE_PERINTAH.test(d) || RE_ALAT_INTERNAL.test(d)) return "";
  return d.length > BATAS_RINCIAN ? `${d.slice(0, BATAS_RINCIAN - 1)}…` : d;
}

/** Kejadian yang selalu satu baris sendiri (tidak digabung dengan langkah kerja lain). */
const SENDIRI = /^(Mengirim pesan ke |Menerima pesan dari |Menunggu (jawaban|keputusan) Anda|Men-deploy rilis|Memanggil agent|Menyerahkan hasil)/;
/** Jeda maksimum antar-langkah dalam satu baris gabungan. */
export const JEDA_GABUNG_MS = 10 * 60e3;
/**
 * Aktivitas dikelompokkan per tugas: [{ id, judul, baris: [{ ts, tsAwal, agent, kerja, rincian: [..], n }] }].
 * Langkah kerja berturut dari pelaku & tugas yang sama (jeda ≤ 10 mnt) menjadi satu kalimat ("menjalankan 5 perintah,
 * membaca 3 berkas"); pesan, menunggu Anda, dan penerapan selalu satu baris. Tugas tak dikenal → id null.
 * `judulTugas` = obj ID → judul (register; sub-tugas T-x.k ikut induknya bila T-x.k tidak terdaftar). `feed` terbaru dulu.
 */
export function kelompokAktivitas(feed = [], judulTugas = {}, { maksBaris = Infinity } = {}) {
  const induk = (id) => id.replace(/(\.\d+)+$/, "");
  const kunciTugas = (id) => (id && !judulTugas[id] && judulTugas[induk(id)] ? induk(id) : id ?? null);
  const kelompok = new Map(), urut = [];
  let total = 0;
  const terbuka = new Map();   // pelaku|tugas → baris gabungan yang masih bisa ditambah (langkah paralel saling menyela)
  const kalimat = (run) => {
    const bagian = [...run.label.entries()].map(([label, n]) => kerjaAktivitas({ label }, n));
    run.baris.kerja = bagian.length > 3 ? `${bagian.slice(0, 3).join(", ")}, dan langkah lain`
      : bagian.length > 1 ? `${bagian.slice(0, -1).join(", ")} dan ${bagian.at(-1)}` : bagian[0];
  };
  for (const f of feed) {
    if (!f || f.label === "Menyiapkan alat" || f.label === "Santai") continue;
    const id = kunciTugas(f.tugas), r = rincianAman(f.detail, f.label), sendiri = SENDIRI.test(String(f.label ?? ""));
    const k = `${f.agent}|${id}`, run = terbuka.get(k);
    if (run && !sendiri && run.baris.tsAwal - f.ts <= JEDA_GABUNG_MS) {
      run.label.set(f.label, (run.label.get(f.label) ?? 0) + 1);
      run.baris.n++; run.baris.tsAwal = f.ts;
      if (r && !run.baris.rincian.includes(r) && run.baris.rincian.length < 4) run.baris.rincian.push(r);
      kalimat(run);
      continue;
    }
    terbuka.delete(k);   // pesan/menunggu/jeda panjang memutus baris gabungan pelaku itu
    if (total >= maksBaris) break;
    total++;
    let g = kelompok.get(id);
    if (!g) { g = { id, judul: id ? judulTugas[id] ?? null : null, baris: [] }; kelompok.set(id, g); urut.push(g); }
    const baris = { ts: f.ts, tsAwal: f.ts, agent: f.agent, kerja: kerjaAktivitas(f, 1), rincian: r ? [r] : [], n: 1 };
    g.baris.push(baris);
    if (!sendiri) terbuka.set(k, { label: new Map([[f.label, 1]]), baris });
  }
  return urut;
}

// ---------------- ringkasan atas ----------------
/** Angka ringkasan: { menunggu: [nama], bekerja: [nama], tugas: {berjalan, lain}, selesai } dari keadaan kursi & register. */
export function ringkasan(keadaan = {}, tugas = [], selesaiHariIni = [], statusTugas = (s) => s) {
  const menunggu = [], bekerja = [];
  for (const [nama, st] of Object.entries(keadaan)) {
    if (st === "menunggu") menunggu.push(nama);
    else if (st === "bekerja" || st === "berpikir") bekerja.push(nama);
  }
  const berjalan = tugas.filter((t) => statusTugas(t.status) === "berjalan").length;
  return { menunggu, bekerja, tugas: { semua: tugas.length, berjalan, lain: tugas.length - berjalan }, selesai: selesaiHariIni.length };
}

// ---------------- daftar terlarang (tes teks halaman) ----------------
/** Teks yang tidak boleh tampil di halaman (di luar "rincian"): istilah santai/internal, perintah mentah, nama alat internal. */
export const TERLARANG = [
  /\bngopi\b/i, /\bsubagent\b/i, /\bleader\b/i, /\bsesi\b/i, /\bSubagentHandback\b/, /\bmcp__/, /\bToolSearch\b/,
  /\bLead T\d\b/, /\b(?:Strategy|Finance|Research)\b(?! Analyst)(?<!Head of Strategy)(?<!Corporate Strategy)/,
  /(?:^|\s)(?:perl|sed|git|cat|curl|npx?|bash)\s+-/, /\bbin\/[\w-]+\.(?:sh|mjs)\b/, /\b[\w-]+\.(?:sh|mjs|py)\b/,
];
