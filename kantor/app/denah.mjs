// Denah Kantor RudisOne — data murni (tanpa DOM/three): kursi organisasi, zona, perabot, titik santai, dan pencarian
// jalur. Dipakai adegan 3D (kantor/app/adegan.mjs) dan diuji Node (kantor/denah.test.mjs).
// Satuan: 1 unit ≈ 1 meter. Sumbu lantai: x ke kanan (0..NX), y ke depan (0..NY); di three.js x→X, y→Z, tinggi→Y.
// Lantai 40×21: baris belakang (y 0–7,75) Ruang Pimpinan | Engineering Tim 1 | Tim 2 | Tim 3; lorong utama (y 8–10)
// dengan pintu masuk di dinding kiri; baris depan (y 10,25–21) Corporate Strategy | Layanan bersama | IT Operations | Lounge.

import { singkatan } from "./istilah.mjs";

export const NX = 40, NY = 21, TINGGI_DINDING = 2.6;
export const NOMOR_TIM = [1, 2, 3];
export const kursiTim = (peran, n) => `${peran} · Tim ${n}`;
export const CHIEF = "COO";

export const DIVISI = [
  { id: "pimpinan", nama: "Ruang Pimpinan", sub: "COO", warna: "#c9a47a" },
  { id: "corp", nama: "Corporate Strategy", sub: "HoS · FC · RA · HRBP", warna: "#1fa3ae" },
  ...NOMOR_TIM.map((n) => ({ id: `tim${n}`, nama: `Engineering · Tim ${n}`, sub: "Belum ada proyek", warna: "#7c5cd6", tim: n })),
  { id: "bersama", nama: "Layanan bersama", sub: "PgM · TW", warna: "#e08a2e" },
  { id: "ops", nama: "IT Operations", sub: "HITO · SysAdmin", warna: "#475bd1" },
];
export const WARNA_LOUNGE = "#d39a5b";

export const TIM = {
  "COO":                  { warna: "#b8892b", rambut: "#3b2a22", inisial: "CO", pendek: "COO", peran: "Chief Operating Officer", divisi: "pimpinan", gaya: "samping", aksesori: "jas" },
  "Head of Strategy":     { warna: "#b07a1f", rambut: "#2d1d14", inisial: "HS", pendek: "HoS", peran: "Pimpinan Corporate Strategy", divisi: "corp", atasan: CHIEF, gaya: "samping", aksesori: "kacamata" },
  "Financial Controller": { warna: "#3e9e5c", rambut: "#222222", inisial: "FC", pendek: "FC", peran: "Financial Controller", divisi: "corp", atasan: CHIEF, gaya: "cepak", aksesori: "dasi" },
  "Research Analyst":     { warna: "#1fa3ae", rambut: "#2d1d14", inisial: "RA", pendek: "RA", peran: "Research Analyst", divisi: "corp", atasan: CHIEF, gaya: "keriting", aksesori: "kacamata" },
  "HR Business Partner":  { warna: "#d35f9a", rambut: "#4a2a1c", inisial: "HR", pendek: "HRBP", peran: "HR Business Partner", divisi: "corp", atasan: CHIEF, gaya: "panjang", aksesori: "lanyard" },
};
for (const n of NOMOR_TIM) {
  const rambut = [["#20202a", "#141414", "#1b1b22", "#5a3a22"], ["#5a3a22", "#2d1d14", "#3b2a22", "#1b1b22"], ["#3b2a22", "#4a2a1c", "#141414", "#2d1d14"]][n - 1];
  Object.assign(TIM, {
    [kursiTim("Tech Lead", n)]:                { warna: "#5b3fb8", rambut: rambut[0], inisial: "TL", pendek: `TL T${n}`, peran: "Tech Lead (Senior Engineer)", divisi: `tim${n}`, atasan: CHIEF, gaya: ["cepak", "samping", "keriting"][n - 1], aksesori: "kacamata" },
    [kursiTim("Business Systems Analyst", n)]: { warna: "#3d7bd9", rambut: rambut[1], inisial: "BS", pendek: `BSA T${n}`, peran: "Business Systems Analyst", divisi: `tim${n}`, atasan: kursiTim("Tech Lead", n), gaya: ["samping", "panjang", "kuncir"][n - 1], aksesori: ["kacamata", "lanyard", "kacamata"][n - 1] },
    [kursiTim("Software Engineer #1", n)]:     { warna: "#7c5cd6", rambut: rambut[2], inisial: "E1", pendek: `SE1 T${n}`, peran: "Software Engineer", divisi: `tim${n}`, atasan: kursiTim("Tech Lead", n), gaya: ["keriting", "cepak", "samping"][n - 1], aksesori: "hoodie" },
    [kursiTim("Software Engineer #2", n)]:     { warna: "#9a7be6", rambut: rambut[3], inisial: "E2", pendek: `SE2 T${n}`, peran: "Software Engineer (bila fitur bisa dipecah)", divisi: `tim${n}`, atasan: kursiTim("Tech Lead", n), gaya: ["kuncir", "keriting", "botak"][n - 1], aksesori: n === 3 ? "topi" : "hoodie" },
  });
}
Object.assign(TIM, {
  "Program Manager":       { warna: "#e08a2e", rambut: "#5a3a22", inisial: "PM", pendek: "PgM", peran: "Program Manager (lintas proyek)", divisi: "bersama", atasan: CHIEF, gaya: "kuncir", aksesori: "lanyard" },
  "Technical Writer":      { warna: "#c9a227", rambut: "#6a4a2a", inisial: "TW", pendek: "TW", peran: "Technical Writer", divisi: "bersama", atasan: "Program Manager", gaya: "panjang", aksesori: "kacamata" },
  "Head of IT Operations": { warna: "#475bd1", rambut: "#2a2a33", inisial: "IO", pendek: "HITO", peran: "Pimpinan IT Operations", divisi: "ops", atasan: CHIEF, gaya: "cepak", aksesori: "headset" },
  "System Administrator":  { warna: "#d9534f", rambut: "#1f1a18", inisial: "SA", pendek: "SysAdmin", peran: "System Administrator", divisi: "ops", atasan: "Head of IT Operations", gaya: "botak", aksesori: "topi" },
});
export const URUT = Object.keys(TIM);
// singkatan baku satu sumber (istilah.mjs); nilai literal di atas hanya agar data tetap terbaca
for (const nama of URUT) TIM[nama].pendek = singkatan(nama);

/** true bila `a` atasan (langsung atau tidak langsung) dari `b`. */
export function atasanDari(a, b) {
  for (let x = TIM[b]?.atasan; x; x = TIM[x]?.atasan) if (x === a) return true;
  return false;
}

export const OX_TIM = { 1: 8.25, 2: 18.75, 3: 29.25 };   // tepi kiri pod tiap tim (lebar 10,5)
export const ZONA = {
  pimpinan: [0, 0, 8.25, 7.75], tim1: [8.25, 0, 18.75, 7.75], tim2: [18.75, 0, 29.25, 7.75], tim3: [29.25, 0, 40, 7.75],
  corp: [0, 10.25, 11.25, 21], bersama: [11.25, 10.25, 17.25, 21], ops: [17.25, 10.25, 25.75, 21], lounge: [25.75, 10.25, 40, 21],
};
export const PINTU = [0.6, 9.0];
/** Jendela: dinding belakang (y=0) per [x0,x1] dan dinding kiri (x=0) per [y0,y1]. */
export const JENDELA = { belakang: [[2.2, 5.4], ...NOMOR_TIM.map((n) => [OX_TIM[n] + 6.6, OX_TIM[n] + 9.6])], kiri: [[1.0, 4.6], [17.0, 20.0]] };

// duduk = titik kaki saat duduk; tamu = titik bawahan saat dipanggil/melapor ([x, y, duduk di kursi tamu?]).
export const KURSI = {
  "COO":                   { duduk: [4.0, 1.45], pimpinan: true, tamu: [[3.25, 4.45, true], [4.75, 4.45, true]] },
  "Head of Strategy":      { duduk: [5.6, 11.55], pimpinan: true, tamu: [[5.0, 14.1], [6.2, 14.1]] },
  "Financial Controller":  { duduk: [2.0, 17.55] },
  "Research Analyst":      { duduk: [5.6, 17.55] },
  "HR Business Partner":   { duduk: [9.2, 17.55] },
  "Program Manager":       { duduk: [14.25, 11.55], pimpinan: true, tamu: [[13.65, 14.1], [14.85, 14.1]] },
  "Technical Writer":      { duduk: [14.25, 17.55] },
  "Head of IT Operations": { duduk: [21.5, 11.55], pimpinan: true, tamu: [[20.9, 14.1], [22.1, 14.1]] },
  "System Administrator":  { duduk: [19.4, 17.55] },
};
for (const n of NOMOR_TIM) {
  const ox = OX_TIM[n];
  KURSI[kursiTim("Tech Lead", n)] = { duduk: [ox + 5.25, 1.3], pimpinan: true, tamu: [[ox + 4.65, 3.85], [ox + 5.85, 3.85]] };
  KURSI[kursiTim("Business Systems Analyst", n)] = { duduk: [ox + 1.75, 6.3] };
  KURSI[kursiTim("Software Engineer #1", n)] = { duduk: [ox + 3.95, 6.3] };
  KURSI[kursiTim("Software Engineer #2", n)] = { duduk: [ox + 8.75, 6.3] };
}
/** Arah hadap saat duduk di meja (radian, 0 = menghadap +y/depan): anggota menghadap meja di belakangnya (−y),
 *  pimpinan menghadap ruangan (+y). */
export const hadapMeja = (nama) => (KURSI[nama].pimpinan ? 0 : Math.PI);

/**
 * Seluruh perabot & dekor sebagai data. Tiap perabot: { jenis, x, y, w, d, lewat?, ... } (persegi tapak di lantai);
 * yang tidak `lewat` menghalangi jalan. Dekor (karpet, papan di dinding) tidak menghalangi.
 * Mengembalikan juga titik santai lounge (`tempat`) dan meja bantuan asisten (`mejaBantu`) — keduanya punya `dipakai`.
 */
export function bangunDenah() {
  const perabot = [], dekor = [], tempat = [], mejaBantu = {};
  const p = (jenis, x, y, w, d, ekstra = {}) => { const o = { jenis, x, y, w, d, ...ekstra }; perabot.push(o); return o; };
  const tanaman = (x, y, besar = 1) => p("tanaman", x, y, 0.6, 0.6, { besar });
  const partisi = (x0, y0, x1, y1, kaca = false) => p(kaca ? "kaca" : "partisi", x0, y0, x1 - x0, y1 - y0, { h: kaca ? 1.25 : 0.5 });
  const mejaAnggota = (nama) => {
    const [sx, sy] = KURSI[nama].duduk;
    p("meja", sx - 0.95, sy - 1.75, 1.9, 0.9, { agen: nama, monitor: [sx, sy - 1.52] });
    p("kursi", sx - 0.33, sy - 0.33, 0.66, 0.6, { lewat: true, hadap: Math.PI });
  };
  const mejaPimpinan = (nama, lebar = 2.8, besar = false) => {
    const k = KURSI[nama], [sx, sy] = k.duduk;
    // kursi bersandaran tinggi: tapak = sandaran (menghalangi); dudukan di titik duduk boleh dilalui
    p("kursi-pimpinan", sx - 0.45, sy - 0.75, 0.9, 0.3, { tinggi: besar ? 1.55 : 1.3, duduk: [sx, sy] });
    p("meja-pimpinan", sx - lebar / 2, sy + 0.65, lebar, 1.05, { agen: nama, besar, monitor: [sx, sy + 0.85] });
    for (const [tx, ty, duduk] of k.tamu) if (duduk) p("kursi-tamu", tx - 0.32, ty - 0.2, 0.64, 0.62, { lewat: true });
  };
  const mejaBantuan = (kelompok, x, y, w, titik, hadap) => {
    p("meja-bantu", x, y, w, 0.6, { layar: titik.length });
    mejaBantu[kelompok] = titik.map(([tx, ty]) => ({ x: tx, y: ty, hadap, dipakai: null }));
  };

  // ---- Ruang Pimpinan ----
  dekor.push({ jenis: "karpet", x0: 1.3, y0: 0.9, x1: 6.7, y1: 5.6, warna: "pimpinan" });
  mejaPimpinan(CHIEF, 3.2, true);
  p("rak-buku", 0.3, 0.6, 0.5, 2.6, { h: 1.9, sumbu: "y" });
  p("sofa-tunggal", 6.4, 1.2, 1.1, 1.0, { sandaran: "x+" });
  tanaman(0.45, 4.2, 1.1); tanaman(7.1, 0.4, 1.1);
  p("lampu-lantai", 7.62, 2.32, 0.36, 0.36);
  // papan tugas di dinding kiri: tugas & status dari register (jejak kerja nyata, hanya ID + judul)
  dekor.push({ jenis: "papan-tugas", id: "tugas", dinding: "kiri", a: 4.95, b: 7.4, z0: 0.85, z1: 2.2 });
  partisi(8.1, 0.25, 8.4, 7.9, true);
  partisi(0.25, 7.6, 6.0, 7.9, true); partisi(7.5, 7.6, 8.1, 7.9, true);   // pintu kaca x 6–7,5

  // ---- Engineering (tiga pod) ----
  for (const n of NOMOR_TIM) {
    const ox = OX_TIM[n];
    dekor.push({ jenis: "papan-tulis", id: `tim${n}`, dinding: "belakang", a: ox + 0.8, b: ox + 3.6, z0: 0.9, z1: 1.9 });
    mejaPimpinan(kursiTim("Tech Lead", n), 2.6);
    mejaBantuan(`tim${n}`, ox + 7.4, 1.35, 2.0, [[ox + 7.9, 2.45], [ox + 8.9, 2.45]], Math.PI);
    for (const peran of ["Business Systems Analyst", "Software Engineer #1", "Software Engineer #2"]) mejaAnggota(kursiTim(peran, n));
    tanaman(ox + 9.75, 0.4);
    if (n > 1) partisi(ox - 0.15, 0.25, ox + 0.15, 7.9);
    partisi(ox + 0.15, 7.6, ox + 5.5, 7.9); partisi(ox + 7.0, 7.6, Math.min(NX, ox + 10.5) - (n === 3 ? 0 : 0.15), 7.9);   // pintu x+5,5–7
  }

  // ---- Corporate Strategy ----
  dekor.push({ jenis: "papan-strategi", id: "corp", dinding: "kiri", a: 11.6, b: 15.0, z0: 0.9, z1: 2.2 });
  mejaPimpinan("Head of Strategy", 2.6);
  for (const n of ["Financial Controller", "Research Analyst", "HR Business Partner"]) mejaAnggota(n);
  mejaBantuan("umum", 3.5, 19.4, 5.0, [[4.1, 18.9], [5.3, 18.9], [6.5, 18.9], [7.7, 18.9]], 0);
  p("rak-buku", 0.3, 19.2, 1.4, 0.6, { h: 1.5, sumbu: "x" });
  tanaman(10.4, 20.0); tanaman(0.45, 15.7);
  partisi(0.25, 10.1, 8.0, 10.4); partisi(9.5, 10.1, 11.1, 10.4);       // pintu x 8–9,5
  partisi(11.1, 10.1, 11.4, NY);

  // ---- Layanan bersama ----
  mejaPimpinan("Program Manager", 2.6);
  mejaAnggota("Technical Writer");
  p("lemari", 11.7, 19.6, 1.6, 0.5, { h: 1.1 });
  tanaman(16.4, 20.0);
  partisi(11.4, 10.1, 15.5, 10.4); partisi(17.0, 10.1, 17.1, 10.4);       // pintu x 15,5–17
  partisi(17.1, 10.1, 17.4, NY);

  // ---- IT Operations ----
  p("panel-pantau", 17.8, 10.6, 1.9, 0.3, { h: 1.95 });
  mejaPimpinan("Head of IT Operations", 2.6);
  mejaAnggota("System Administrator");
  for (const y of [15.6, 16.9]) p("rak-server", 23.6, y, 1.4, 1.0, { h: 2.2 });
  tanaman(17.8, 20.0);
  partisi(19.8, 10.1, 23.5, 10.4); partisi(25.0, 10.1, 25.55, 10.4);     // pintu x 23,5–25

  // ---- Lounge ----
  const x0 = ZONA.lounge[0];
  p("pembatas-tanaman", x0 - 0.2, 10.5, 0.5, NY - 10.8);
  partisi(x0 + 0.3, 10.1, 27.0, 10.4); partisi(34.0, 10.1, NX, 10.4);
  p("bar-kopi", 35.3, 10.8, 4.3, 0.9);
  p("kulkas", 34.45, 10.6, 0.7, 0.8, { h: 1.7 });
  dekor.push({ jenis: "karpet", x0: 26.9, y0: 12.2, x1: 34.4, y1: 18.9, warna: "lounge" });
  p("sofa-ujung", 27.62, 12.55, 0.28, 0.95);
  for (let k = 0; k < 4; k++) p("sofa-dudukan", 27.9 + k * 1.3, 12.55, 1.3, 0.95, { sandaran: "y-" });
  p("sofa-ujung", 33.1, 12.55, 0.28, 0.95);
  for (let k = 0; k < 3; k++) p("sofa-dudukan", 26.9, 14.3 + k * 1.05, 0.95, 1.05, { sandaran: "x-" });
  p("sofa-ujung", 26.9, 17.45, 0.95, 0.28);
  p("meja-kopi", 29.3, 14.9, 2.6, 1.3);
  for (const y of [14.7, 16.3]) p("pouf", 32.7, y - 0.3, 0.7, 0.7, { lewat: true });
  p("meja-bundar", 35.6, 16.3, 1.2, 1.2);
  for (const [x, y] of [[35.15, 17.55], [37.25, 17.0]]) p("kursi", x - 0.28, y - 0.28, 0.56, 0.56, { lewat: true, hadap: 0, bulat: true });
  p("bangku", 36.0, 19.3, 3.4, 0.5, { lewat: true });
  p("lampu-lantai", 26.2, 12.05, 0.36, 0.36);
  tanaman(39.3, 14.4, 1.2); tanaman(34.7, 20.2, 0.9);
  const t = (x, y, jenis, hadap) => tempat.push({ x, y, jenis, hadap, dipakai: null });
  for (const x of [35.9, 37.4, 38.9]) t(x, 12.25, "bar", Math.PI);
  for (let k = 0; k < 4; k++) t(28.55 + k * 1.3, 13.35, "sofa", 0);
  for (const y of [15.0, 16.4]) t(27.75, y, "sofa", Math.PI / 2);
  for (const y of [14.7, 16.3]) t(33.05, y, "pouf", -Math.PI / 2);
  t(35.15, 17.55, "meja", Math.PI * 0.75); t(37.25, 17.0, "meja", -Math.PI / 2);
  for (const x of [36.6, 37.7, 38.8]) t(x, 19.55, "bangku", 0);
  for (const [x, hx] of [[27.4, 1], [28.5, -1], [29.6, -1], [26.9, 1]]) t(x, 19.35, "berdiri", hx > 0 ? Math.PI / 2 : -Math.PI / 2);

  return { perabot, dekor, tempat, mejaBantu };
}

// ================= grid jalan (sel 0,5 unit) + A* (4 arah, penalti belok) =================
export const RES = 2, GX = NX * RES, GY = NY * RES;
/** Grid halangan dari perabot yang tidak `lewat` + tepi dinding belakang/kiri. */
export function bangunGrid(perabot) {
  const blok = new Uint8Array(GX * GY);
  const halang = (x0, y0, x1, y1) => {
    for (let j = Math.max(0, Math.floor(y0 * RES)); j < Math.min(GY, Math.ceil(y1 * RES)); j++)
      for (let i = Math.max(0, Math.floor(x0 * RES)); i < Math.min(GX, Math.ceil(x1 * RES)); i++) blok[j * GX + i] = 1;
  };
  for (const o of perabot) if (!o.lewat) halang(o.x, o.y, o.x + o.w, o.y + o.d);
  halang(0, 0, NX, 0.25); halang(0, 0, 0.25, NY);
  return blok;
}
const sel = (x, y) => [Math.min(GX - 1, Math.max(0, Math.floor(x * RES))), Math.min(GY - 1, Math.max(0, Math.floor(y * RES)))];
export const pusat = (i, j) => [(i + 0.5) / RES, (j + 0.5) / RES];
export function selBebas(blok, x, y) {
  const [i0, j0] = sel(x, y);
  if (!blok[j0 * GX + i0]) return [i0, j0];
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = i0 + di, j = j0 + dj;
    if (i >= 0 && j >= 0 && i < GX && j < GY && !blok[j * GX + i]) return [i, j];
  }
  return [i0, j0];
}
const ARAH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** Rute dari titik ke titik: titik belokan saja, diakhiri titik tujuan persis. `null` bila tidak ada jalan. */
export function cariJalur(blok, [x0, y0], [x1, y1]) {
  const [si, sj] = selBebas(blok, x0, y0), [ti, tj] = selBebas(blok, x1, y1);
  const N = GX * GY * 4, g = new Float32Array(N).fill(Infinity), asal = new Int32Array(N).fill(-1), tutup = new Uint8Array(N);
  const heap = [];
  const dorong = (s, f) => { heap.push([f, s]); let k = heap.length - 1; while (k) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
  const ambil = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const h = (i, j) => (Math.abs(i - ti) + Math.abs(j - tj)) / RES;
  for (let a = 0; a < 4; a++) { const s = (sj * GX + si) * 4 + a; g[s] = 0; dorong(s, h(si, sj)); }
  let akhir = -1;
  while (heap.length) {
    const [, s] = ambil();
    if (tutup[s]) continue;
    tutup[s] = 1;
    const c = s >> 2, a = s & 3, i = c % GX, j = (c / GX) | 0;
    if (i === ti && j === tj) { akhir = s; break; }
    for (let b = 0; b < 4; b++) {
      const ni = i + ARAH[b][0], nj = j + ARAH[b][1];
      if (ni < 0 || nj < 0 || ni >= GX || nj >= GY || blok[nj * GX + ni]) continue;
      const ns = (nj * GX + ni) * 4 + b, ng = g[s] + 1 / RES + (b !== a ? 0.4 : 0);
      if (ng < g[ns]) { g[ns] = ng; asal[ns] = s; dorong(ns, ng + h(ni, nj)); }
    }
  }
  if (akhir < 0) return null;
  const urut = [];
  for (let s = akhir; s >= 0; s = asal[s]) urut.unshift(s);
  const titik = [];
  for (let k = 1; k < urut.length; k++) {
    const belok = k === urut.length - 1 || (urut[k] & 3) !== (urut[k + 1] & 3);
    if (belok) { const c = urut[k] >> 2; titik.push(pusat(c % GX, (c / GX) | 0)); }
  }
  titik.push([x1, y1]);
  return titik;
}
