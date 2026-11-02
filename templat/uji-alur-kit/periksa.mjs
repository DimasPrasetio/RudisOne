// Pemeriksaan dasar uji jalan alur yang TIDAK bergantung aplikasi — fungsi murni: masukannya data biasa (cuplikan DOM,
// daftar respons, daftar konsol), keluarannya daftar temuan. Tanpa Playwright, jadi bisa diuji `node --test`
// (bin/uji-alur-kit.test.mjs). Pemakaian di browser: kit.mjs (`snap` mengumpulkan cuplikan DOM lalu memanggil `periksaLayar`).
//
// Bentuk temuan: { jenis, butir, usulTingkat, ringkas, rincian }
//   jenis       kunci mesin (geser, target-sentuh, angka-berlebih, teks-terlarang, label-hilang, papan-ketik, konsol, respons, …)
//   butir       nomor butir daftar periksa templat/uji-alur.md yang terkait (1a … 8)
//   usulTingkat kritis | sedang | kosmetik — USUL otomatis; putusan akhir tetap BSA
// Kit hanya MENEMUKAN calon temuan; mengaitkannya ke kode sumber (A#/G#/K#/R#/N#) dan memutuskan relevansinya tugas BSA.

export const AMBANG_SENTUH = 44;

/** Teks yang dianggap bocor ke layar pengguna. Tiap entri { pola: RegExp, alasan, usulTingkat? }; tambah per proyek lewat opsi. */
export const TEKS_TERLARANG_BAWAAN = [
  { pola: /\bRequired\b/, alasan: "kata Inggris 'Required' (pesan isian wajib belum berbahasa Indonesia)" },
  { pola: /\bundefined\b|\[object Object\]|\bNaN\b/, alasan: "nilai kosong/rusak bocor ke layar", usulTingkat: "sedang" },
  { pola: /Lorem ipsum/i, alasan: "teks contoh tertinggal" },
  { pola: /\b(Something went wrong|Failed to \w+|Network Error|Internal Server Error|Bad Request|Unauthorized|Forbidden|Not Found)\b/,
    alasan: "pesan galat Inggris/teknis yang tidak diterjemahkan" },
  { pola: /\b(Loading|Submit|Cancel|Save|Delete|Search|Success|Invalid)\b/, alasan: "kata antarmuka Inggris sisa", usulTingkat: "kosmetik" },
  { pola: /\b(HTTP|status) ?[45]\d\d\b/i, alasan: "kode status HTTP tampil ke pengguna" },
  { pola: /\b(stack ?trace|SQLSTATE|ECONN\w+|ORA-\d+|Error 1\d{3})\b/i, alasan: "galat teknis (database/jaringan) tampil ke pengguna", usulTingkat: "sedang" },
];

const ringkasTeks = (s, n = 80) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const cuplik = (teks, indeks, panjang) => ringkasTeks(teks.slice(Math.max(0, indeks - 30), indeks + panjang + 30), 110);

/** Angka berlebih nol / desimal panjang: `999,0000`, `25,0000`, `12.0000` (isian bernilai mentah API). Kembali: [{ kecocokan, jenis, cuplikan }] */
export function polaAngkaBerlebih(teks, { mentah = false } = {}) {
  const s = String(teks ?? "");
  const hasil = [];
  const koma = /(?<![\d.,])\d+(?:\.\d{3})*,(\d{3,})(?!\d|,\d)/g; // format Indonesia: 1.234,5678 · 999,0000
  for (let m; (m = koma.exec(s)); )
    hasil.push({ kecocokan: m[0], jenis: /0{2,}$/.test(m[1]) ? "nol-berlebih" : "desimal-panjang", cuplikan: cuplik(s, m.index, m[0].length) });
  if (mentah) { // hanya untuk nilai isian: string mentah API `12.0000` (titik = desimal, bukan pemisah ribuan karena ≥ 4 digit)
    const titik = /(?<![\d.,])\d+\.(\d{4,})(?![\d.,])/g;
    for (let m; (m = titik.exec(s)); )
      hasil.push({ kecocokan: m[0], jenis: /0{2,}$/.test(m[1]) ? "nol-berlebih" : "desimal-panjang", cuplikan: cuplik(s, m.index, m[0].length) });
  }
  return hasil;
}

/** Tanggal berformat ISO (tahun-bulan-tanggal) di teks layar: pengguna Indonesia mengharap 02/11/2031 atau 2 November 2031. */
export function polaTanggalIso(teks) {
  const s = String(teks ?? "");
  const hasil = [];
  const re = /(?<![\w-])(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?![\w-])/g;
  for (let m; (m = re.exec(s)); ) hasil.push({ kecocokan: m[0], cuplikan: cuplik(s, m.index, m[0].length) });
  return hasil;
}

/** Teks terlarang: daftar bawaan + tambahan proyek (string = kata utuh, tanpa peka huruf besar-kecil; atau { pola, alasan }). */
export function temuanTeksTerlarang(teks, tambahan = [], { gunakanBawaan = true } = {}) {
  const s = String(teks ?? "");
  const daftar = [...(gunakanBawaan ? TEKS_TERLARANG_BAWAAN : []), ...tambahan.map((x) => (typeof x === "string"
    ? { pola: new RegExp(`(?<![\\p{L}\\d])${x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "iu"), alasan: `istilah/kode internal '${x}' tampil ke pengguna`, usulTingkat: "sedang" }
    : x))];
  const hasil = [];
  for (const { pola, alasan, usulTingkat } of daftar) {
    const re = new RegExp(pola.source, pola.flags.replace("g", "") + "g");
    const kena = [];
    for (let m; (m = re.exec(s)) && kena.length < 3; ) { kena.push(cuplik(s, m.index, m[0].length)); if (m[0] === "") re.lastIndex++; }
    if (kena.length) hasil.push({ jenis: "teks-terlarang", butir: "2/6", usulTingkat: usulTingkat ?? "sedang",
      ringkas: alasan, rincian: kena.join(" ⏐ ") });
  }
  return hasil;
}

/** Geser horizontal: lebar isi melebihi lebar layar. */
export function temuanGeser(dom) {
  if (!dom || !(dom.scrollW > dom.innerW + 1)) return [];
  return [{ jenis: "geser", butir: "5a", usulTingkat: "sedang", ringkas: `geser horizontal (isi ${dom.scrollW} px > layar ${dom.innerW} px)`,
    rincian: (dom.pelanggarLebar ?? []).map((e) => `${e.t || e.tag} ${e.w}px`).slice(0, 4).join(" ⏐ ") }];
}

/** Target sentuh < min px (hanya perangkat sentuh). Tautan sebaris di dalam paragraf dikecualikan (pengecualian WCAG 2.5.8). */
export function temuanTargetSentuh(dom, { min = AMBANG_SENTUH } = {}) {
  const kecil = (dom?.tombol ?? []).filter((e) => !e.sebaris && (e.w < min || e.h < min));
  if (!kecil.length) return [];
  const unik = new Map();
  for (const e of kecil) { const k = `${ringkasTeks(e.t, 30) || "(tanpa nama)"} ${e.w}×${e.h}`; unik.set(k, (unik.get(k) ?? 0) + 1); }
  return [{ jenis: "target-sentuh", butir: "5b", usulTingkat: "sedang", ringkas: `target sentuh < ${min} px`, jumlah: kecil.length,
    rincian: [...unik.keys()].slice(0, 8).join(" ⏐ ") }];
}

/** Isian tanpa label yang terhubung (label for / membungkus / aria-label / aria-labelledby). Placeholder saja tidak cukup. */
export function temuanLabel(dom) {
  const tanpa = (dom?.inputs ?? []).filter((i) => !i.label && !i.aria && !["hidden", "checkbox", "radio", "submit", "button"].includes(i.type));
  if (!tanpa.length) return [];
  return [{ jenis: "label-hilang", butir: "7", usulTingkat: "sedang", ringkas: "isian tanpa label", jumlah: tanpa.length,
    rincian: tanpa.slice(0, 6).map((i) => `${i.id || i.name || i.type}${i.ph ? ` (placeholder "${ringkasTeks(i.ph, 24)}")` : ""}`).join(" ⏐ ") }];
}

/** Papan ketik angka (HP): isian bertema jumlah/harga harus type=number|tel atau inputmode numeric|decimal. */
export function temuanPapanKetik(dom, { polaNama = /qty|jumlah|quantity|harga|price|amount|nominal|stok|total|biaya/i } = {}) {
  const salah = (dom?.inputs ?? []).filter((i) => ["text", "", "search"].includes(i.type) && polaNama.test(`${i.id} ${i.name} ${i.label} ${i.aria}`)
    && !["numeric", "decimal", "tel"].includes(i.im ?? ""));
  if (!salah.length) return [];
  return [{ jenis: "papan-ketik", butir: "5c", usulTingkat: "sedang", ringkas: "isian angka tanpa papan ketik angka", jumlah: salah.length,
    rincian: salah.slice(0, 6).map((i) => `${i.id || i.name} (inputmode=${i.im ?? "kosong"})`).join(" ⏐ ") }];
}

/** Galat konsol baru (console.error, pageerror) — tanpa yang cocok `abaikan` (RegExp[]). */
export function temuanKonsol(entri, { abaikan = [] } = {}) {
  const kena = (entri ?? []).filter((e) => !abaikan.some((re) => re.test(e)));
  if (!kena.length) return [];
  return [{ jenis: "konsol", butir: "—", usulTingkat: "kosmetik", ringkas: "galat konsol", jumlah: kena.length, rincian: kena.slice(0, 3).map((e) => ringkasTeks(e, 140)).join(" ⏐ ") }];
}

/** Respons ≥ 400 yang tak diharapkan. `diizinkan`: RegExp[] diuji terhadap "METODE /jalur STATUS" (mis. /POST \/auth\/login 401/ untuk uji sandi salah). */
export function temuanRespons(entri, { diizinkan = [] } = {}) {
  const kena = (entri ?? []).filter((e) => e.status >= 400 && !diizinkan.some((re) => re.test(`${e.metode} ${e.jalur} ${e.status}`)));
  if (!kena.length) return [];
  const berat = kena.some((e) => e.status >= 500);
  return [{ jenis: "respons", butir: "—", usulTingkat: berat ? "sedang" : "kosmetik", ringkas: berat ? "respons 5xx/4xx tak terduga" : "respons 4xx tak terduga", jumlah: kena.length,
    rincian: kena.slice(0, 4).map((e) => `${e.metode} ${e.jalur} → ${e.status}${e.isi ? ` ${ringkasTeks(e.isi, 60)}` : ""}`).join(" ⏐ ") }];
}

/**
 * Semua pemeriksaan satu layar. `dom`: { scrollW, innerW, tombol, inputs, teks, nilaiIsian[] };
 * opsi: { sentuh (boolean, true di HP), min, teksTerlarang[], bawaanTerlarang, polaNama, konsol[], respons[], abaikanKonsol[], responsDiizinkan[] }
 */
export function periksaLayar(dom, opsi = {}) {
  const temuan = [];
  temuan.push(...temuanGeser(dom));
  if (opsi.sentuh) { temuan.push(...temuanTargetSentuh(dom, { min: opsi.min })); temuan.push(...temuanPapanKetik(dom, { polaNama: opsi.polaNama })); }
  const angka = [...polaAngkaBerlebih(dom?.teks), ...(dom?.nilaiIsian ?? []).flatMap((v) => polaAngkaBerlebih(v, { mentah: true }))];
  if (angka.length) {
    const nol = angka.some((a) => a.jenis === "nol-berlebih");
    temuan.push({ jenis: "angka-berlebih", butir: "3", usulTingkat: nol ? "sedang" : "kosmetik",
      ringkas: nol ? "angka berlebih nol desimal" : "angka dengan desimal panjang/format meragukan",
      rincian: [...new Set(angka.map((a) => a.kecocokan))].slice(0, 4).join(" ⏐ "), konteks: angka[0].cuplikan });
  }
  const iso = polaTanggalIso(dom?.teks);
  if (iso.length) temuan.push({ jenis: "format-tanggal", butir: "3", usulTingkat: "kosmetik", ringkas: "tanggal berformat ISO di teks layar",
    rincian: [...new Set(iso.map((a) => a.kecocokan))].slice(0, 4).join(" ⏐ ") });
  const teks = [dom?.teks, ...(dom?.nilaiIsian ?? []), ...(dom?.placeholders ?? [])].filter(Boolean).join("\n");
  temuan.push(...temuanTeksTerlarang(teks, opsi.teksTerlarang ?? [], { gunakanBawaan: opsi.bawaanTerlarang !== false }));
  temuan.push(...temuanLabel(dom));
  temuan.push(...temuanKonsol(opsi.konsol, { abaikan: opsi.abaikanKonsol }));
  temuan.push(...temuanRespons(opsi.respons, { diizinkan: opsi.responsDiizinkan }));
  return temuan;
}

const URUT_TINGKAT = { kritis: 0, sedang: 1, kosmetik: 2 };
/**
 * Kelompokkan temuan dari banyak langkah (jenis + ringkas): masalah yang sama di banyak layar menjadi SATU baris dengan daftar
 * tempat munculnya; rincian digabung (maks. 8 butir unik) dan jumlah terbesar dicatat.
 */
export function kelompokkanTemuan(langkah) {
  const peta = new Map();
  for (const l of langkah ?? []) for (const t of l.temuan ?? []) {
    const kunci = `${t.jenis}|${t.ringkas}`;
    const g = peta.get(kunci) ?? { ...t, rincianSemua: [], muncul: [], jumlah: 0 };
    for (const r of String(t.rincian ?? "").split(" ⏐ ").filter(Boolean)) if (!g.rincianSemua.includes(r)) g.rincianSemua.push(r);
    g.jumlah = Math.max(g.jumlah ?? 0, t.jumlah ?? 0);
    g.muncul.push({ no: l.no, nama: l.nama, perangkat: l.perangkat, peran: l.peran, foto: l.foto });
    peta.set(kunci, g);
  }
  return [...peta.values()].map((g) => ({ ...g, rincian: g.rincianSemua.slice(0, 8).join(" ⏐ ") }))
    .sort((x, y) => (URUT_TINGKAT[x.usulTingkat] ?? 9) - (URUT_TINGKAT[y.usulTingkat] ?? 9) || y.muncul.length - x.muncul.length);
}

const sel = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
/** Baris tabel temuan (kolom templat/uji-alur.md › Temuan; kolom Aturan/Usulan/Jenis dilengkapi BSA). */
export function tabelTemuan(kelompok) {
  const baris = ["| # | Tingkat (usul kit) | Butir | Apa yang terlihat | Muncul di | Aturan/heuristik · usulan · jenis tindak lanjut |", "|---|---|---|---|---|---|"];
  kelompok.forEach((g, i) => {
    const di = g.muncul.slice(0, 4).map((m) => `${m.perangkat}/${m.peran ?? "-"}/${m.nama}${m.foto ? ` (${m.foto})` : ""}`).join("; ") + (g.muncul.length > 4 ? ` (+${g.muncul.length - 4})` : "");
    baris.push(`| ${i + 1} | ${g.usulTingkat} | ${g.butir} | ${sel(g.ringkas)}${g.jumlah ? ` (hingga ${g.jumlah} per layar)` : ""}: ${sel(g.rincian)}${g.konteks ? ` — "${sel(g.konteks)}"` : ""} | ${sel(di)} | <diisi BSA> |`);
  });
  return baris.join("\n");
}

/** Baris matriks (kolom templat/uji-alur.md › Matriks). Masukan: [{ peran, tugas, perangkat, status, kasusGagal, layarKosong, catatan, foto }] */
export function barisMatriks(hasilTugas) {
  const kunci = new Map();
  for (const h of hasilTugas ?? []) {
    const k = `${h.peran}|${h.tugas}`;
    const b = kunci.get(k) ?? { peran: h.peran, tugas: h.tugas, hp: "BELUM TERVERIFIKASI", komputer: "BELUM TERVERIFIKASI", kasus: "", kosong: "" };
    const isi = `${h.status}${h.catatan ? ` (${h.catatan})` : ""}${h.foto ? ` · ${h.foto}` : ""}`;
    if (h.perangkat === "hp") b.hp = isi; else b.komputer = isi;
    if (h.kasusGagal) b.kasus = h.kasusGagal;
    if (h.layarKosong) b.kosong = h.layarKosong;
    kunci.set(k, b);
  }
  const baris = ["| Peran | Tugas | HP (iPhone 13, 390 px) | Komputer (1440×900) | Kasus gagal dipicu | Layar kosong dibuka |", "|---|---|---|---|---|---|"];
  for (const b of kunci.values()) baris.push(`| ${sel(b.peran)} | ${sel(b.tugas)} | ${sel(b.hp)} | ${sel(b.komputer)} | ${sel(b.kasus)} | ${sel(b.kosong)} |`);
  return baris.join("\n");
}

/* ---- Mode uji: CEPAT (bawaan di gerbang akhir) vs PENUH (hanya bila pengguna memintanya) — fungsi murni, diuji ---- */
export const MODE_UJI = ["cepat", "penuh"];
/** Mode dari env UJI_MODE (menang) atau opsi; nilai tak dikenal → galat (jangan diam-diam menguji lain dari yang dimaksud). */
export function tentukanMode(opsiMode, envMode) {
  const m = String(envMode || opsiMode || "cepat").trim().toLowerCase();
  if (!MODE_UJI.includes(m)) throw new Error(`mode uji '${m}' tidak dikenal (${MODE_UJI.join(" | ")})`);
  return m;
}
/** Perangkat yang diuji: cepat = HP saja; penuh = semua yang dikonfigurasi (urut tetap HP lalu komputer). */
export function perangkatUntukMode(mode, semua = ["hp", "komputer"]) {
  if (mode !== "cepat") return [...semua];
  return semua.includes("hp") ? ["hp"] : semua.slice(0, 1); // cepat = HP; tanpa HP terkonfigurasi: perangkat pertama (jangan menguji tanpa perangkat)
}
/** Mode cepat menyimpan PNG hanya di langkah kunci (`kunci: true`), kasus gagal, dan galat; pemeriksaan otomatis tetap tiap layar. */
export function perluTangkapan(mode, { kunci = false, gagal = false, galat = false } = {}) {
  return mode !== "cepat" || !!(kunci || gagal || galat);
}
/** Pernyataan cakupan jujur + daftar "belum terverifikasi" dari tugas yang tidak dijalankan. */
export function teksCakupan({ mode, tugasUji = [], tugasSemua = [], perangkat = [], parsial = "" } = {}) {
  const uji = [...new Set(tugasUji)], semua = [...new Set([...tugasSemua, ...uji])];
  const tak = semua.filter((t) => !uji.includes(t));
  const dev = perangkat.length === 1 && perangkat[0] === "hp" ? "HP saja" : perangkat.map((p) => (p === "hp" ? "HP" : "komputer")).join(" + ") || "perangkat belum dinyatakan";
  const jml = tugasSemua.length || uji.length ? `${uji.length} dari ${semua.length} tugas` : "jumlah tugas belum dinyatakan (panggil uji.cakupan)";
  const pernyataan = (mode === "cepat" ? `cepat: ${jml}, ${dev}; kasus gagal utama per tugas inti; tangkapan hanya di langkah kunci` : `penuh: ${jml}, ${dev}`)
    + (parsial ? `; UJI ULANG PARSIAL (UJI_TUGAS=${parsial})` : "");
  const belum = tak.map((t) => `tugas tidak dijalankan (${parsial ? "uji ulang parsial" : mode === "cepat" ? "mode cepat" : "di luar cakupan"}): ${t}`);
  if (mode === "cepat" && !perangkat.includes("komputer")) belum.push("tampilan komputer (1440 px): tidak diuji di mode cepat");
  if (mode === "cepat") belum.push("layar kosong dan kasus gagal selain yang utama: tidak diuji di mode cepat");
  return { pernyataan, belum };
}
