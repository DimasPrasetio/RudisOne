// Label Kantor — aturan murni (tanpa DOM/three), diuji `kantor/label.test.mjs`. DESAIN.md › Label & keterbacaan.
// Prinsip: denah bersih. Nama zona = tulisan di lantai (bagian adegan 3D); orang = titik status (warna + simbol);
// nama & rincian saat disentuh (hover/klik/ketuk/fokus keyboard) dan di panel; "Menunggu Anda" tetap berlabel penuh.

/** Tiga mode tombol Label; bawaan "ringkas". */
export const MODE_LABEL = ["ringkas", "lengkap", "tanpa"];
export const NAMA_MODE_LABEL = { ringkas: "Ringkas", lengkap: "Lengkap", tanpa: "Tanpa" };
export const KUNCI_SIMPAN_LABEL = "kantor-label";

/** Mode dari `?label=` (uji) lalu pilihan tersimpan; nilai tak dikenal → "ringkas". */
export function modeLabelDari(param, simpanan) {
  for (const m of [param, simpanan]) if (MODE_LABEL.includes(m)) return m;
  return "ringkas";
}

/** Batas "dekat": kamera ≤ 75 % jarak "Seluruh denah" (satu langkah + dari seluruh denah sudah dekat). */
export const AMBANG_DEKAT = 0.75;
/** Tingkat rincian menurut zoom: "jauh" (seluruh denah) atau "dekat" (diperbesar, mis. satu tim). */
export function tingkatRincian(jarak, jarakPas) {
  // toleransi pembulatan: jarak hasil zoom(0,75) dihitung ulang lewat koordinat bola (≈ 0,75·jarakPas ± 1e-15)
  return jarakPas > 0 && jarak <= jarakPas * AMBANG_DEKAT * (1 + 1e-6) ? "dekat" : "jauh";
}

/**
 * Apa yang tampil di atas kepala seseorang di denah.
 * - `titik`: titik status (warna + simbol); `nama`: nama pendek kecil & tipis; `penuh`: label penuh "Menunggu Anda".
 * - "Menunggu Anda" selalu berlabel penuh (kecuali mode tanpa: hanya titik "!" — cincin lantai tetap ada).
 * - Siap dipanggil tanpa titik saat ringkas & jauh (denah tenang; lencana ▶ ✓ ! menonjol).
 * - Orang yang sedang disentuh tidak diberi label kepala: kartunya yang tampil.
 */
export function tampilanOrang({ status, mode = "ringkas", tingkat = "jauh", disentuh = false }) {
  const tidak = { titik: false, nama: false, penuh: false };
  if (disentuh || status === "kosong") return tidak;
  if (status === "menunggu") return mode === "tanpa" ? { titik: true, nama: false, penuh: false } : { titik: false, nama: false, penuh: true };
  if (mode === "tanpa") return tidak;
  const rinci = mode === "lengkap" || tingkat === "dekat";
  if (status === "siap") return rinci ? { titik: true, nama: true, penuh: false } : tidak;
  return { titik: true, nama: rinci, penuh: false };
}

/** Label berprioritas ≥ ini wajib tampil (kartu sentuh 6, "Menunggu Anda" 5,5). */
export const PRIO_WAJIB = 5.5;
/**
 * Penempatan label tanpa tumpuk (seperti simbol peta). `daftar` = [{ px, py, w, h, prio, jarak, bawah }] (piksel; `bawah` =
 * jangkar atas-tengah, selainnya bawah-tengah); `lebar`/`tinggi` = ukuran kanvas. Urut prioritas lalu jarak; tiap label mencoba
 * posisinya sendiri lalu digeser per baris (wajib: lebih banyak langkah, termasuk ke bawah); posisi geser yang keluar dari
 * kanvas tidak dipakai (akan terpotong). Label opsional yang tetap
 * bertumpuk disembunyikan; label wajib tidak pernah — bila semua langkah terpakai ia diletakkan di posisi asal.
 * Mengubah `px`/`py` tiap label (dijepit ke kanvas & digeser); kembalian: Set label yang disembunyikan.
 */
export function tempatkanLabel(daftar, lebar, tinggi = Infinity) {
  const terpakai = [], kalah = new Set();
  const urut = daftar.filter((l) => l.prio > 0 && l.w > 0 && l.h > 0).sort((p, q) => (q.prio - p.prio) || p.jarak - q.jarak);
  const tumpuk = (r) => terpakai.some((q) => r.x0 < q.x1 - 1 && r.x1 > q.x0 + 1 && r.y0 < q.y1 - 1 && r.y1 > q.y0 + 1);
  for (const l of urut) {
    l.px = Math.min(Math.max(l.px, l.w / 2 + 4), Math.max(l.w / 2 + 4, lebar - l.w / 2 - 4));   // jangan terpotong tepi kanvas
    const kotak = (dy) => ({ x0: l.px - l.w / 2, x1: l.px + l.w / 2, y0: (l.bawah ? l.py : l.py - l.h) + dy, y1: (l.bawah ? l.py + l.h : l.py) + dy });
    const s = l.h + 2, wajib = l.prio >= PRIO_WAJIB;
    const coba = l.bawah ? [0, s, -s] : wajib ? [0, -s, -2 * s, s, -3 * s, 2 * s] : [0, -s, -2 * s];
    const muat = (r) => r.y0 >= 0 && r.y1 <= tinggi;
    let dy = coba.find((d) => !tumpuk(kotak(d)) && (d === 0 || muat(kotak(d))));
    if (dy === undefined) { if (!wajib) { kalah.add(l); continue; } dy = 0; }
    l.py += dy; terpakai.push(kotak(0));
  }
  return kalah;
}

/** Gelembung ucapan: tampil saat diperbesar atau mode lengkap; tidak pada ringkas-jauh dan tanpa. */
export const ucapanTampil = (mode, tingkat) => mode === "lengkap" || (mode === "ringkas" && tingkat === "dekat");

/**
 * Lis depan diorama: bidang sedikit di bawah lantai, di depan tepi depan lantai (y = 21) — tempat nama zona baris depan
 * (zona baris depan terisi meja sampai tepinya; ruang kosongnya terlalu sempit untuk tulisan yang terbaca).
 */
export const LIS_DEPAN = { y0: 21, y1: 22.6, z: -0.04 };
/**
 * Kotak tulisan lantai tiap zona: [x0, y0, x1, y1, tinggi] (meter, sumbu lantai denah.mjs) — di ruang kosong yang tidak
 * tertutup perabot: zona baris belakang di lorong tepat di depan pintunya (bagian belakang lorong, agar partisi rendah
 * baris depan tidak menutupi tulisan dari sudut kamera bawaan), zona baris depan di lis depan sejajar zonanya.
 */
export const KOTAK_TULISAN = {
  pimpinan: [1.5, 7.98, 7.9, 9.05, 0.022],
  // Tim 1 berhenti sebelum "bayangan pandang" panel pantau IT Ops; Tim 3 di kanan kulkas lounge (dijaga label.test.mjs)
  tim1: [8.7, 7.98, 15.5, 9.05, 0.022], tim2: [19.8, 7.98, 28.9, 9.05, 0.022], tim3: [35.3, 7.98, 39.6, 9.05, 0.022],
  corp: [0.3, 21.32, 11.0, 22.5, LIS_DEPAN.z + 0.018], bersama: [11.4, 21.32, 17.0, 22.5, LIS_DEPAN.z + 0.018],
  ops: [17.4, 21.32, 25.6, 22.5, LIS_DEPAN.z + 0.018], lounge: [26.0, 21.32, 39.6, 22.5, LIS_DEPAN.z + 0.018],
};

/**
 * Isi tulisan lantai tiap zona (satu baris): nama zona; tim = "Tim n · <proyek>" (pendek agar hurufnya besar).
 * `tim` = [{ n, proyek, aktif }]; `sempit` = layar HP (tanpa keterangan "proyek belum terdaftar"). Kembalian: [{ id, kotak, warna, redup, baris: [{ teks, skala }] }].
 */
export function tulisanZona(divisi, { tim = [], sempit = false, warnaLounge = "#d39a5b" } = {}) {
  const hasil = [];
  for (const dv of [...divisi, { id: "lounge", nama: "Lounge", warna: warnaLounge }]) {
    const kotak = KOTAK_TULISAN[dv.id];
    if (!kotak) continue;
    let teks = dv.nama, redup = false;
    if (dv.tim) {
      const t = tim.find((x) => x.n === dv.tim) ?? {};
      redup = !t.aktif;
      const sub = t.proyek ?? (sempit || !t.aktif ? "" : "proyek belum terdaftar");
      teks = `Tim ${dv.tim}${sub ? ` · ${sub}` : ""}`;   // "Engineering" tersirat dari warna lantai; lengkapnya di panel
    }
    hasil.push({ id: dv.id, kotak, warna: dv.warna, redup, baris: [{ teks, skala: 1 }] });
  }
  return hasil;
}

// ---------------- papan nama zona (bidang tegak menghadap depan) ----------------
/**
 * Papan nama zona: bidang tegak menghadap depan (+y), tanpa cahaya (pelat buram, kontras tetap di semua tema & jam).
 * [x0, x1, y, z0, z1] meter. Zona baris belakang: papan di ATAS dinding belakang (seperti papan judul diorama) — di
 * belakangnya tidak ada apa pun, jadi papan bisa tinggi & selebar zonanya tanpa menutupi apa pun; kepala orang di baris
 * belakang tergambar di depannya. Zona baris depan: papan berdiri di lis depan (puncak 1,26 m) — dari kamera bawaan
 * (perspektif nyata, `kamera.mjs`) hanya menutup lis; meja, kursi, orang, dan cincin "Menunggu Anda" tetap terlihat
 * (dijaga `kantor/label.test.mjs`).
 */
export const PAPAN_ATAS_DINDING = { z0: 2.7, z1: 3.7, y: 0 };
const atas = (x0, x1) => [x0, x1, PAPAN_ATAS_DINDING.y, PAPAN_ATAS_DINDING.z0, PAPAN_ATAS_DINDING.z1];
export const PAPAN_ZONA = {
  pimpinan: atas(0.4, 7.85), tim1: atas(8.6, 18.4), tim2: atas(19.1, 28.9), tim3: atas(29.6, 39.4),
  corp: [0.8, 10.4, 21.75, LIS_DEPAN.z, LIS_DEPAN.z + 1.3], bersama: [10.75, 17.45, 21.75, LIS_DEPAN.z, LIS_DEPAN.z + 1.3],
  ops: [17.8, 25.2, 21.75, LIS_DEPAN.z, LIS_DEPAN.z + 1.3], lounge: [27.0, 35.0, 21.75, LIS_DEPAN.z, LIS_DEPAN.z + 1.3],
};
/**
 * Isi papan: satu baris dari beberapa bagian `{ teks, skala, tebal }` — tim = "Tim n" besar + " · <proyek>" lebih kecil
 * (tanpa proyek: "Tim n" saja, redup bila tim belum dipakai). Kembalian: [{ id, warna, redup, bagian }].
 */
export function isiPapanZona(divisi, { tim = [], warnaLounge = "#d39a5b" } = {}) {
  return [...divisi, { id: "lounge", nama: "Lounge", warna: warnaLounge }].filter((dv) => PAPAN_ZONA[dv.id]).map((dv) => {
    if (!dv.tim) return { id: dv.id, warna: dv.warna, redup: false, bagian: [{ teks: dv.nama, skala: 1, tebal: true }] };
    const t = tim.find((x) => x.n === dv.tim) ?? {};
    // keterangan hanya nama proyek (dipotong 16 huruf) agar huruf tetap besar; "belum ada proyek" = papan redup (rincian di panel)
    const proyek = t.proyek ? (t.proyek.length > 16 ? `${t.proyek.slice(0, 15)}…` : t.proyek) : null;
    return { id: dv.id, warna: dv.warna, redup: !t.aktif, bagian: [{ teks: `Tim ${dv.tim}`, skala: 1, tebal: true },
      ...(proyek ? [{ teks: ` · ${proyek}`, skala: 0.8, tebal: false }] : [])] };
  });
}
/** Papan menghadap depan terbaca bila azimut kamera ≤ 62° (laptop bawaan 45°); lebih ke samping (HP bawaan 74°) → tulisan lantai. */
export const AZIMUT_PAPAN = (62 * Math.PI) / 180;
export const penandaZona = (azimut) => (azimut <= AZIMUT_PAPAN ? "papan" : "lantai");
/** Warna pelat & tinta papan (dan pelat tulisan lantai) per tema — rasio kontras dijaga tes (≥ 4,5:1, redup ≥ 3:1). */
export const WARNA_PAPAN = {
  terang: { pelat: "#f7f9fb", tinta: "#1d2833", redup: "#5e6e7e", tepi: "#c9d3dd" },
  gelap: { pelat: "#16212c", tinta: "#e4ebf2", redup: "#9aabbb", tepi: "#2e3e4e" },
};
/** Rasio kontras WCAG 2 antara dua warna hex. */
export function kontras(a, b) {
  const L = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
