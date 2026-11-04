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
