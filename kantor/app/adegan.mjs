// Adegan Kantor 3D semi-realistis — ruangan, perabot, cahaya, kamera terbatas, label HTML di atas kanvas, dan pemilihan.
// Perabot statis digabung per material (sedikit draw call); bayangan perabot digambar sekali (shadow map statis);
// karakter memakai bayangan kontak palsu (blob) agar shadow map tidak perlu dihitung ulang tiap bingkai.
// Gambar ulang hanya bila ada yang berubah (kamera, gerak, data) — lihat `mintaGambar` / `adaGerak`.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DIVISI, JENDELA, KURSI, NOMOR_TIM, NX, NY, OX_TIM, PINTU, TINGGI_DINDING, TIM, WARNA_LOUNGE, ZONA, bangunDenah } from "./denah.mjs";
import { KOTAK_TULISAN, LIS_DEPAN } from "./label.mjs";

/** WebGL2 tersedia? (three.js r186 hanya mendukung WebGL2). */
export function adaWebGL2() {
  try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2")); } catch { return false; }
}

// ---------------- palet (terang / gelap) — sumber: kantor/DESAIN.md › Token 3D ----------------
const PALET = {
  terang: {
    lantai: "#eef1f4", lorong: "#e3e8ee", sisiLantai: "#c3ccd5", dinding: "#f3f4f2", dindingAtas: "#c9d3dd",
    kayuLantai: "#d9bb93", kayuTerang: "#d8c2a3", kayuGelap: "#7d5538", logam: "#9aa5b0", logamGelap: "#4b5560",
    kain: "#5f6d7a", kulit: "#3b3430", sofa: "#6f93ad", partisi: "#cdd5dd", kaca: "#bcd8ea", karpet: "#e7dccb",
    karpetLounge: "#e4d6c0", monitor: "#262d35", layarMati: "#3a4652", pot: "#c7a07c", daun: "#4f9d69", daun2: "#3f8a5a",
    bar: "#6f5b4b", batu: "#ddd3c6", mesin: "#59636d", rak: "#2b3640", putih: "#f7f7f4", jendela: "#d7ecfa",
    langit: "#ffffff", tanah: "#d9d3c9", hemi: 0.95, matahari: "#fff1dc", kuatMatahari: 3.0, env: 0.35, cahayaJendela: "#fff6df", kuatCahayaJendela: 0.22,
    kapLampu: "#e9e3d6", map: "#efe2bf", selesai: "#148a9c", tintaPapan: "#24303c",
  },
  gelap: {
    lantai: "#1b2530", lorong: "#18212b", sisiLantai: "#0f161d", dinding: "#222d38", dindingAtas: "#2e3e4e",
    kayuLantai: "#5a4632", kayuTerang: "#5b4a3a", kayuGelap: "#4a3222", logam: "#59636e", logamGelap: "#2b3239",
    kain: "#3a4653", kulit: "#2a2421", sofa: "#3e5a70", partisi: "#2f3d4b", kaca: "#3c6684", karpet: "#2f2923",
    karpetLounge: "#2c2721", monitor: "#151a20", layarMati: "#0b1118", pot: "#7a5a42", daun: "#3f8a5a", daun2: "#33734b",
    bar: "#3a3029", batu: "#5a4f45", mesin: "#3d454d", rak: "#1a222a", putih: "#c9cdd2", jendela: "#28405a",
    langit: "#7f9cc4", tanah: "#1a1f26", hemi: 0.8, matahari: "#ffd9a8", kuatMatahari: 1.3, env: 0.3, cahayaJendela: "#7aa6d8", kuatCahayaJendela: 0.07,
    kapLampu: "#8d877b", map: "#a8996f", selesai: "#3fb6c8", tintaPapan: "#1d2833",
  },
};
/**
 * Suasana mengikuti jam (WIB): pengali/tint di atas PALET. tint* = campuran ke warna fase (0 = palet apa adanya).
 * pos = arah matahari relatif pusat lantai (sore lebih rendah → bayangan lebih panjang). lampu = kekuatan lampu meja/lantai.
 */
export const WAKTU = {
  pagi:  { langit: "#d8e9ff", tintLangit: 0.5, hemi: 1.05, matahari: "#fff8ee", kuatMatahari: 0.95, pos: [-8, 22, -16], env: 1.05,
           jendela: "#d6ecff", tintJendela: 0.45, cahayaJendela: "#fffaf0", kuatCahayaJendela: 1.4, lampu: 0 },
  siang: { langit: "#ffffff", tintLangit: 0, hemi: 1.0, matahari: null, kuatMatahari: 1.0, pos: [-13, 24, -15], env: 1.0,
           jendela: null, tintJendela: 0, cahayaJendela: null, kuatCahayaJendela: 1.0, lampu: 0 },
  sore:  { langit: "#ffc184", tintLangit: 0.7, hemi: 0.9, matahari: "#ff9a45", kuatMatahari: 1.0, pos: [-22, 11, -8], env: 0.8,
           jendela: "#ffbf73", tintJendela: 0.8, cahayaJendela: "#ff9a3d", kuatCahayaJendela: 2.6, lampu: 0.5 },
  malam: { langit: "#ffd3a0", tintLangit: 0.75, hemi: 0.66, matahari: "#9db2ff", kuatMatahari: 0.1, pos: [-13, 24, -15], env: 0.55,
           jendela: "#0e1b30", tintJendela: 0.93, cahayaJendela: "#000000", kuatCahayaJendela: 0, lampu: 1 },
};
const ZONA_TINT = { terang: 0.2, gelap: 0.08 };

// ---------------- tekstur prosedural (kanvas, abu-abu → dikali warna material) ----------------
function kanvas(ukuran, gambar) {
  const c = document.createElement("canvas"); c.width = c.height = ukuran;
  gambar(c.getContext("2d"), ukuran);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const acakTetap = (benih) => () => ((benih = (benih * 16807) % 2147483647) - 1) / 2147483646;
function teksturUbin() {
  return kanvas(256, (g, n) => {
    const r = acakTetap(7);
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) { const v = 238 + Math.floor(r() * 17); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * n, r() * n, 2, 2); }
    g.strokeStyle = "rgba(150,160,170,.55)"; g.lineWidth = 3; g.strokeRect(0, 0, n, n);
  });
}
function teksturKayu() {
  return kanvas(512, (g, n) => {
    const r = acakTetap(11), papan = 8, tinggi = n / papan;
    for (let k = 0; k < papan; k++) {
      const dasar = 225 + Math.floor(r() * 25);
      g.fillStyle = `rgb(${dasar},${dasar},${dasar})`; g.fillRect(0, k * tinggi, n, tinggi);
      for (let s = 0; s < 14; s++) {
        const y = k * tinggi + r() * tinggi, v = dasar - 14 - Math.floor(r() * 18);
        g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = 1 + r() * 1.5;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + (r() - 0.5) * 6, n * 0.6, y + (r() - 0.5) * 6, n, y + (r() - 0.5) * 4); g.stroke();
      }
      g.fillStyle = "rgba(120,120,120,.5)"; g.fillRect(0, k * tinggi, n, 2);
      const potong = r() * n; g.fillRect(potong, k * tinggi, 2, tinggi);
    }
  });
}
function teksturKarpet() {
  return kanvas(256, (g, n) => {
    const r = acakTetap(23);
    g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const v = 205 + Math.floor(r() * 50); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * n, r() * n, 1.5, 1.5); }
  });
}
function teksturCahaya() {   // bercak cahaya jendela di lantai: tepi lembut
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function teksturBlob() {     // bayangan kontak karakter
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,.42)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function teksturGenangan() {   // genangan cahaya lampu (malam): pusat hangat, tepi lembut
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.45, "rgba(255,255,255,.45)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function teksturGrafik() {   // layar panel pemantauan IT Operations
  return kanvas(128, (g, n) => {
    g.fillStyle = "#0d1a14"; g.fillRect(0, 0, n, n);
    g.strokeStyle = "#34c38a"; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 8; i++) g.lineTo(8 + i * 14, 80 - ((i * 37) % 50));
    g.stroke(); g.fillStyle = "#2a7fff"; for (let i = 0; i < 5; i++) g.fillRect(12 + i * 22, 100, 14, 18 - i * 3);
  });
}

// ---------------- isi papan (kanvas): hanya ID, judul, status tugas dari register ----------------
const HURUF = '"Geist", ui-sans-serif, system-ui, sans-serif', HURUF_JUDUL = '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif';
const WARNA_ST = { berjalan: "#1f9d6a", selesai: "#148a9c", terhambat: "#d9930b", penyelarasan: "#d9930b", ditinjau: "#3b7bd8", baru: "#3b7bd8" };
const warnaSt = (st, p) => (st === "selesai" ? p.selesai : WARNA_ST[st] ?? "#8a97a6");
/** Teks dipotong dengan "…" agar muat `lebar` piksel. */
function muat(g, teks, lebar) {
  if (g.measureText(teks).width <= lebar) return teks;
  let lo = 0, hi = teks.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (g.measureText(`${teks.slice(0, m)}…`).width <= lebar) lo = m; else hi = m - 1; }
  return `${teks.slice(0, lo).trimEnd()}…`;
}
/** Bungkus teks ke beberapa baris (maks. `baris`; baris terakhir dipotong "…"). */
function bungkus(g, teks, lebar, baris) {
  const kata = String(teks).split(/\s+/), hasil = [];
  let kini = "";
  for (let i = 0; i < kata.length; i++) {
    const coba = kini ? `${kini} ${kata[i]}` : kata[i];
    if (g.measureText(coba).width <= lebar || !kini) { kini = coba; continue; }
    if (hasil.length === baris - 1) { hasil.push(muat(g, `${kini} ${kata.slice(i).join(" ")}`, lebar)); return hasil; }
    hasil.push(kini); kini = kata[i];
  }
  if (kini) hasil.push(hasil.length === baris - 1 ? muat(g, kini, lebar) : kini);
  return hasil.slice(0, baris);
}
function kotakBulat(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
/** Papan tulis tim: judul tim/proyek + daftar tugas berjalan (spidol). */
function gambarPapanTulis(g, c, data, p) {
  const W = c.width, pad = 36;
  g.fillStyle = "#5b3fb8"; g.font = `650 40px ${HURUF_JUDUL}`; g.textBaseline = "alphabetic";
  g.fillText(muat(g, data.judul, W - 2 * pad), pad, 66);
  g.fillRect(pad, 82, Math.min(W - 2 * pad, g.measureText(data.judul).width), 4);
  const daftar = data.tugas ?? [];
  if (!daftar.length) { g.fillStyle = "#8a97a6"; g.font = `500 32px ${HURUF}`; g.fillText("Belum ada tugas berjalan", pad, 160); return; }
  daftar.slice(0, 4).forEach((t, i) => {
    const y = 148 + i * 64;
    g.fillStyle = warnaSt(t.status, p); g.beginPath(); g.arc(pad + 12, y - 11, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.tintaPapan; g.font = `650 32px ${HURUF}`; g.fillText(t.id, pad + 36, y);
    const x = pad + 46 + g.measureText(t.id).width;
    g.font = `500 31px ${HURUF}`;
    const ekor = t.status === "berjalan" ? "" : ` · ${t.status}`;
    g.fillText(muat(g, `${t.judul}${ekor}`, W - pad - x), x, y);
  });
  if (daftar.length > 4) { g.fillStyle = "#5e6e7e"; g.font = `500 28px ${HURUF}`; g.fillText(`+${daftar.length - 4} tugas lagi`, pad + 36, 148 + 4 * 64 - 8); }
}
/** Papan strategi (Corporate Strategy): satu catatan tempel per tugas berjalan. */
function gambarPapanCatatan(g, c, data, p) {
  const W = c.width, pad = 32;
  g.fillStyle = p.tintaPapan; g.font = `650 40px ${HURUF_JUDUL}`; g.textBaseline = "alphabetic";
  g.fillText(muat(g, data.judul, W - 2 * pad), pad, 62);
  const daftar = data.tugas ?? [];
  if (!daftar.length) { g.fillStyle = "#8a97a6"; g.font = `500 32px ${HURUF}`; g.fillText("Belum ada tugas berjalan", pad, 150); return; }
  const warna = ["#bfe8ec", "#cdebcb", "#f6e3a1"], lebar = (W - 2 * pad - 2 * 28) / 3, tinggi = c.height - 110;
  daftar.slice(0, 3).forEach((t, i) => {
    const x = pad + i * (lebar + 28), y = 92;
    g.fillStyle = "rgba(0,0,0,.12)"; kotakBulat(g, x + 6, y + 8, lebar, tinggi - 20, 10); g.fill();
    g.fillStyle = warna[i]; kotakBulat(g, x, y, lebar, tinggi - 20, 10); g.fill();
    g.fillStyle = "#1d2833"; g.font = `650 32px ${HURUF}`; g.fillText(t.id, x + 22, y + 52);
    g.font = `500 30px ${HURUF}`;
    bungkus(g, t.judul, lebar - 44, 6).forEach((b, k) => g.fillText(b, x + 22, y + 98 + k * 40));
    g.fillStyle = warnaSt(t.status, p); g.font = `600 26px ${HURUF}`; g.fillText(t.status, x + 22, y + tinggi - 46);
  });
  if (daftar.length > 3) { g.fillStyle = "#5e6e7e"; g.font = `500 26px ${HURUF}`; g.fillText(`+${daftar.length - 3} lagi`, W - pad - 110, 62); }
}
/** Papan tugas Ruang Pimpinan: Berjalan · Antre & lainnya · Selesai hari ini. */
function gambarPapanTugas(g, c, data, p) {
  const W = c.width, pad = 28, gap = 18, lebar = (W - 2 * pad - 2 * gap) / 3;
  g.fillStyle = p.tintaPapan; g.font = `650 40px ${HURUF_JUDUL}`; g.textBaseline = "alphabetic";
  g.fillText("Papan tugas", pad, 60);
  const xSub = pad + g.measureText("Papan tugas").width + 16;
  g.fillStyle = "#5e6e7e"; g.font = `500 24px ${HURUF}`; g.fillText("dari register tugas", xSub, 60);
  const kolom = [["Berjalan", data.berjalan], ["Antre & lainnya", data.lain], ["Selesai hari ini", data.selesai]];
  kolom.forEach(([nama, daftar = []], k) => {
    const x = pad + k * (lebar + gap);
    g.fillStyle = "rgba(29,40,51,.035)"; kotakBulat(g, x, 84, lebar, c.height - 84 - pad, 12); g.fill();
    g.fillStyle = p.tintaPapan; g.font = `650 26px ${HURUF}`; g.fillText(muat(g, `${nama} · ${daftar.length}`, lebar - 28), x + 14, 120);
    if (!daftar.length) { g.fillStyle = "#8a97a6"; g.font = `500 22px ${HURUF}`; g.fillText("—", x + 14, 166); }
    daftar.slice(0, 4).forEach((t, i) => {
      const y = 138 + i * 86;
      g.fillStyle = "#ffffff"; kotakBulat(g, x + 10, y, lebar - 20, 74, 8); g.fill();
      g.fillStyle = warnaSt(t.status, p); g.fillRect(x + 10, y, 7, 74);
      g.fillStyle = "#1d2833"; g.font = `650 22px ${HURUF}`; g.fillText(muat(g, t.status === "berjalan" || t.status === "selesai" ? t.id : `${t.id} · ${t.status}`, lebar - 52), x + 28, y + 30);
      g.font = `500 21px ${HURUF}`; g.fillText(muat(g, t.judul, lebar - 52), x + 28, y + 60);
    });
    if (daftar.length > 4) { g.fillStyle = "#5e6e7e"; g.font = `500 21px ${HURUF}`; g.fillText(`+${daftar.length - 4} lagi`, x + 14, c.height - pad - 12); }
  });
}

// ---------------- pembangun geometri statis (digabung per material) ----------------
class Pembangun {
  constructor() { this.bagian = new Map(); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  /** Tambah geometri di posisi lantai (x, y) dengan tinggi h (pusat geometri), rotasi ry. */
  tambah(kunci, geom, x, h, y, { ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, bayang = true } = {}) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    this.e.set(rx, ry, rz); this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, h, y), this.q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    for (const nama of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nama)) g.deleteAttribute(nama);
    const k = `${kunci}|${bayang ? 1 : 0}`;
    if (!this.bagian.has(k)) this.bagian.set(k, []);
    this.bagian.get(k).push(g);
  }
  /** Kotak dengan sisi bawah di ketinggian z0 (lantai = 0). */
  kotak(kunci, x0, y0, z0, w, d, h, o = {}) { this.tambah(kunci, KOTAK, x0 + w / 2, z0 + h / 2, y0 + d / 2, { ...o, sx: w, sy: h, sz: d }); }
  silinder(kunci, cx, cy, z0, r, h, o = {}) { this.tambah(kunci, SILINDER, cx, z0 + h / 2, cy, { ...o, sx: r, sy: h, sz: r }); }
  bola(kunci, cx, cy, z, r, o = {}) { this.tambah(kunci, BOLA, cx, z, cy, { ...o, sx: r, sy: r * (o.pipih ?? 1), sz: r }); }
  bentuk(material) {
    const grup = new THREE.Group();
    for (const [k, daftar] of this.bagian) {
      const [kunci, bayang] = k.split("|");
      const me = new THREE.Mesh(mergeGeometries(daftar), material(kunci));
      me.castShadow = bayang === "1"; me.receiveShadow = true; me.name = k;
      me.matrixAutoUpdate = false; me.updateMatrix();
      grup.add(me);
      for (const g of daftar) g.dispose();
    }
    this.bagian.clear();
    return grup;
  }
}
const KOTAK = new THREE.BoxGeometry(1, 1, 1);
const SILINDER = new THREE.CylinderGeometry(1, 1, 1, 24);
const BOLA = new THREE.IcosahedronGeometry(1, 2);
const KERUCUT = new THREE.CylinderGeometry(0.6, 1, 1, 20);   // kap lampu

// ---------------- perabot ----------------
/** Gambar satu perabot dari data denah ke pembangun `b`. Monitor (layar per meja) dikumpulkan ke `layar`. */
function gambarPerabot(b, o, layar, ekstra = { lampu: [], berkas: {} }) {
  const { x, y, w, d } = o;
  switch (o.jenis) {
    case "meja": case "meja-pimpinan": {
      const besar = o.besar, atas = besar ? "kayuGelap" : "kayuTerang", tinggi = 0.74;
      b.kotak(atas, x, y, tinggi - 0.045, w, d, 0.045);
      for (const sx of [x + 0.04, x + w - 0.08]) b.kotak(besar ? "kayuGelap" : "logam", sx, y + 0.06, 0, 0.04, d - 0.12, tinggi - 0.045);
      const sisiPanel = o.jenis === "meja-pimpinan" ? y + d - 0.05 : y + 0.02;   // panel penutup: sisi menghadap ruangan / dinding
      b.kotak(besar ? "kayuGelap" : "partisi", x + 0.08, sisiPanel, 0.18, w - 0.16, 0.03, tinggi - 0.24);
      const [mx, my] = o.monitor, hadapDepan = o.jenis === "meja"; // monitor meja anggota menghadap +y (kursi), pimpinan −y
      const arah = hadapDepan ? 1 : -1;
      b.silinder("logamGelap", mx, my - 0.06 * arah, tinggi, 0.02, 0.16);
      b.kotak("logamGelap", mx - 0.11, my - 0.06 * arah - 0.08, tinggi, 0.22, 0.16, 0.012);
      b.kotak("monitor", mx - 0.33, my - 0.02, tinggi + 0.13, 0.66, 0.035, 0.4);
      layar.push({ agen: o.agen, x: mx, y: my + 0.02 * arah, h: tinggi + 0.33, w: 0.6, tinggi: 0.34, ry: hadapDepan ? 0 : Math.PI });
      const kb = my + 0.32 * arah;
      b.kotak("monitor", mx - 0.22, kb - 0.07, tinggi, 0.44, 0.14, 0.018);
      b.kotak("putih", x + (hadapDepan ? w - 0.45 : 0.25), y + d / 2 - 0.12, tinggi, 0.22, 0.29, 0.01);
      if (besar) b.silinder("putih", x + w - 0.45, y + 0.35, tinggi, 0.045, 0.1);
      // lampu meja (menyala sore/malam): di sudut belakang meja anggota / sudut depan-kiri meja pimpinan
      const [lx, ly] = hadapDepan ? [x + w - 0.16, y + 0.16] : [x + 0.18, y + d - 0.2];
      b.silinder("logamGelap", lx, ly, tinggi, 0.07, 0.02);
      b.silinder("logam", lx, ly, tinggi + 0.02, 0.012, 0.32);
      const dvLampu = TIM[o.agen]?.divisi ?? "";   // kap lampu tim engineering terpisah: padam bila timnya belum dipakai
      b.tambah(dvLampu.startsWith("tim") ? `kapLampu:${dvLampu}` : "kapLampu", KERUCUT, lx, tinggi + 0.39, ly, { sx: 0.1, sy: 0.12, sz: 0.1 });
      const kx = x + w / 2 - lx, ky = y + d / 2 - ly, kp = Math.hypot(kx, ky);
      ekstra.lampu.push({ x: lx + (kx / kp) * 0.24, y: ly + (ky / kp) * 0.24, h: tinggi + 0.004, r: 0.42, divisi: dvLampu });
      // tempat berkas tugas yang selesai hari ini (lihat aturBerkas)
      ekstra.berkas[o.agen] = hadapDepan ? { x: x + 0.42, y: y + d / 2 + 0.06, h: tinggi } : { x: x + w - 0.85, y: y + d / 2 + 0.05, h: tinggi };
      break;
    }
    case "kursi": {
      const cx = x + w / 2, cy = y + d / 2;
      if (o.bulat) { b.silinder("kain", cx, cy, 0.42, 0.24, 0.07); b.silinder("logam", cx, cy, 0, 0.03, 0.42); b.silinder("logamGelap", cx, cy, 0, 0.2, 0.025); break; }
      b.kotak("kain", cx - 0.25, cy - 0.23, 0.42, 0.5, 0.46, 0.08);
      const by = o.hadap === Math.PI ? cy + 0.2 : cy - 0.26;     // sandaran di belakang punggung
      b.kotak("kain", cx - 0.23, by, 0.55, 0.46, 0.06, 0.38);
      b.silinder("logam", cx, cy, 0.08, 0.025, 0.34);
      b.kotak("logamGelap", cx - 0.28, cy - 0.025, 0.04, 0.56, 0.05, 0.035); b.kotak("logamGelap", cx - 0.025, cy - 0.28, 0.04, 0.05, 0.56, 0.035);
      break;
    }
    case "kursi-pimpinan": {
      const [cx, cy] = o.duduk;
      b.kotak("kulit", cx - 0.28, cy - 0.25, 0.42, 0.56, 0.52, 0.1);
      b.kotak("kulit", cx - 0.27, cy - 0.34, 0.5, 0.54, 0.09, o.tinggi - 0.5);
      for (const s of [-1, 1]) b.kotak("kulit", cx + 0.28 * s - 0.03, cy - 0.25, 0.52, 0.06, 0.42, 0.18);
      b.silinder("logam", cx, cy, 0.08, 0.03, 0.34);
      b.kotak("logamGelap", cx - 0.3, cy - 0.025, 0.04, 0.6, 0.05, 0.035); b.kotak("logamGelap", cx - 0.025, cy - 0.3, 0.04, 0.05, 0.6, 0.035);
      break;
    }
    case "kursi-tamu": {
      b.kotak("sofa", x, y, 0.14, w, d, 0.28);
      b.kotak("sofa", x, y + d - 0.13, 0.42, w, 0.13, 0.42);
      for (const s of [x, x + w - 0.08]) b.kotak("sofa", s, y, 0.42, 0.08, d, 0.18);
      for (const [lx, ly] of [[x + 0.05, y + 0.05], [x + w - 0.08, y + 0.05], [x + 0.05, y + d - 0.08], [x + w - 0.08, y + d - 0.08]]) b.kotak("logamGelap", lx, ly, 0, 0.03, 0.03, 0.14);
      break;
    }
    case "rak-buku": {
      const h = o.h, warnaBuku = ["bukuMerah", "bukuBiru", "bukuKuning", "bukuHijau"];
      b.kotak("kayuGelap", x, y, 0, w, d, 0.06);
      b.kotak("kayuGelap", x, y, h - 0.04, w, d, 0.04);
      const sepanjangY = o.sumbu === "y";
      if (sepanjangY) { b.kotak("kayuGelap", x, y, 0, w, 0.04, h); b.kotak("kayuGelap", x, y + d - 0.04, 0, w, 0.04, h); b.kotak("kayuGelap", x, y, 0, 0.04, d, h); }
      else { b.kotak("kayuGelap", x, y, 0, 0.04, d, h); b.kotak("kayuGelap", x + w - 0.04, y, 0, 0.04, d, h); b.kotak("kayuGelap", x, y, 0, w, 0.04, h); }
      const r = acakTetap(Math.round(x * 31 + y * 7));
      for (let rak = 0; rak < 3; rak++) {
        const z = 0.06 + rak * (h - 0.1) / 3;
        b.kotak("kayuGelap", x, y, z + (h - 0.1) / 3 - 0.03, w, d, 0.03);
        const panjang = sepanjangY ? d : w;
        for (let t = 0.08; t < panjang - 0.12;) {
          const tebal = 0.04 + r() * 0.04, tg = 0.18 + r() * 0.12, warna = warnaBuku[Math.floor(r() * 4)];
          // buku di dalam rak tidak ikut peta bayangan (bayangannya jatuh di dalam rak; hemat 4 draw call saat bayangan dihitung ulang)
          if (sepanjangY) b.kotak(warna, x + 0.06, y + t, z, w - 0.14, tebal, tg, { bayang: false }); else b.kotak(warna, x + t, y + 0.08, z, tebal, d - 0.14, tg, { bayang: false });
          t += tebal + 0.01;
        }
      }
      break;
    }
    case "sofa-tunggal": {
      b.kotak("sofa", x, y, 0.12, w, d, 0.32);
      b.kotak("sofa", x + w - 0.3, y, 0.44, 0.3, d, 0.55);
      for (const s of [y, y + d - 0.12]) b.kotak("sofa", x, s, 0.44, w - 0.3, 0.12, 0.2);
      break;
    }
    case "tanaman": {
      const cx = x + w / 2, cy = y + d / 2, s = o.besar ?? 1;
      b.tambah("pot", SILINDER, cx, 0.22, cy, { sx: 0.22, sy: 0.44, sz: 0.22 });
      b.silinder("tanah", cx, cy, 0.43, 0.19, 0.02, { bayang: false });
      const r = acakTetap(Math.round(cx * 13 + cy * 17));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r(), j = 0.1 + r() * 0.12;
        b.bola(i % 2 ? "daun" : "daun2", cx + Math.cos(a) * j * s, cy + Math.sin(a) * j * s, (0.75 + r() * 0.35) * s, (0.17 + r() * 0.07) * s);
      }
      b.bola("daun", cx, cy, 1.05 * s, 0.2 * s);
      break;
    }
    case "partisi": {
      b.kotak("partisi", x, y, 0, w, d, o.h);
      b.kotak("logam", x - 0.005, y - 0.005, o.h, w + 0.01, d + 0.01, 0.025);
      break;
    }
    case "kaca": {
      b.kotak("logam", x, y, 0, w, d, 0.08);
      b.kotak("kaca", x + (w > d ? 0 : d > w ? w / 2 - 0.01 : 0), y + (w > d ? d / 2 - 0.01 : 0), 0.08, w > d ? w : 0.02, w > d ? 0.02 : d, o.h - 0.1, { bayang: false });
      b.kotak("logam", x, y, o.h - 0.02, w, d, 0.03);
      break;
    }
    case "lemari": {
      b.kotak("partisi", x, y, 0, w, d, o.h);
      for (let k = 1; k < 3; k++) b.kotak("logamGelap", x + 0.04, y + d, k * o.h / 3, w - 0.08, 0.01, 0.015, { bayang: false });
      break;
    }
    case "panel-pantau": {
      b.kotak("rak", x, y, 0, w, d, o.h);
      layar.push({ statis: "grafik", x: x + w / 2, y: y + d + 0.005, h: o.h * 0.62, w: w - 0.2, tinggi: 0.95, ry: 0 });
      break;
    }
    case "rak-server": {
      b.kotak("rak", x, y, 0, w, d, o.h);
      for (let i = 0; i < 7; i++) b.kotak("logamGelap", x + 0.08, y + d, 0.25 + i * 0.27, w - 0.16, 0.01, 0.2, { bayang: false });
      for (let i = 0; i < 7; i++) b.kotak("led", x + w - 0.22, y + d + 0.006, 0.32 + i * 0.27, 0.05, 0.01, 0.03, { bayang: false });
      break;
    }
    case "pembatas-tanaman": {
      b.kotak("pot", x, y, 0, w, d, 0.55);
      const r = acakTetap(41);
      for (let yy = y + 0.4; yy < y + d - 0.2; yy += 0.5) b.bola(r() > 0.5 ? "daun" : "daun2", x + w / 2, yy, 0.75 + r() * 0.15, 0.26 + r() * 0.06);
      break;
    }
    case "bar-kopi": {
      b.kotak("bar", x, y, 0, w, d, 0.92);
      b.kotak("batu", x - 0.03, y - 0.03, 0.92, w + 0.06, d + 0.06, 0.05);
      b.kotak("mesin", x + 0.4, y + 0.12, 0.97, 0.6, 0.48, 0.5);
      b.kotak("logamGelap", x + 0.55, y + 0.55, 1.12, 0.3, 0.06, 0.06);
      b.kotak("mesin", x + 1.3, y + 0.18, 0.97, 0.42, 0.4, 0.38);
      for (const cx of [2.45, 2.85, 3.25]) b.silinder("putih", x + cx, y + 0.45, 0.97, 0.045, 0.1);
      break;
    }
    case "kulkas": {
      b.kotak("putih", x, y, 0, w, d, o.h);
      b.kotak("logam", x + w - 0.12, y + d, 0.7, 0.03, 0.03, 0.6, { bayang: false });
      b.kotak("logamGelap", x, y + d, 1.15, w, 0.005, 0.01, { bayang: false });
      break;
    }
    case "sofa-ujung": b.kotak("sofa", x, y, 0, w, d, 0.62); break;
    case "lampu-lantai": {
      const cx = x + w / 2, cy = y + d / 2;
      b.silinder("logamGelap", cx, cy, 0, 0.17, 0.03);
      b.silinder("logam", cx, cy, 0.03, 0.016, 1.45);
      b.tambah("kapLampu", KERUCUT, cx, 1.58, cy, { sx: 0.22, sy: 0.26, sz: 0.22 });
      ekstra.lampu.push({ x: cx, y: cy, h: 0.022, r: 1.25 });
      break;
    }
    case "sofa-dudukan": {
      b.kotak("sofa", x, y, 0.1, w, d, 0.34);
      if (o.sandaran === "y-") { b.kotak("sofa", x, y, 0.44, w, 0.26, 0.5); b.kotak("sofa", x + 0.03, y + 0.26, 0.44, w - 0.06, d - 0.3, 0.07); }
      else { b.kotak("sofa", x, y, 0.44, 0.26, d, 0.5); b.kotak("sofa", x + 0.26, y + 0.03, 0.44, w - 0.3, d - 0.06, 0.07); }
      b.kotak("logamGelap", x + 0.05, y + 0.05, 0, w - 0.1, d - 0.1, 0.1);
      break;
    }
    case "meja-kopi": {
      b.kotak("kayuTerang", x, y, 0.36, w, d, 0.05);
      for (const [lx, ly] of [[x + 0.08, y + 0.08], [x + w - 0.12, y + 0.08], [x + 0.08, y + d - 0.12], [x + w - 0.12, y + d - 0.12]]) b.kotak("logamGelap", lx, ly, 0, 0.04, 0.04, 0.36);
      b.silinder("putih", x + 0.8, y + 0.5, 0.41, 0.045, 0.1);
      b.kotak("putih", x + 1.6, y + 0.6, 0.41, 0.45, 0.32, 0.015);
      break;
    }
    case "pouf": b.silinder("sofa", x + w / 2, y + d / 2, 0, 0.33, 0.42); break;
    case "meja-bundar": {
      const cx = x + w / 2, cy = y + d / 2;
      b.silinder("kayuTerang", cx, cy, 0.72, 0.6, 0.04);
      b.silinder("logamGelap", cx, cy, 0.02, 0.05, 0.7);
      b.silinder("logamGelap", cx, cy, 0, 0.3, 0.03);
      break;
    }
    case "bangku": {
      b.kotak("kayuTerang", x, y, 0.38, w, d, 0.05);
      for (const lx of [x + 0.1, x + w - 0.14]) b.kotak("logamGelap", lx, y + 0.05, 0, 0.04, d - 0.1, 0.38);
      break;
    }
    case "meja-bantu": {
      b.kotak("kayuTerang", x, y, 0.92, w, d, 0.04);
      for (const lx of [x + 0.05, x + w - 0.09]) b.kotak("logam", lx, y + 0.1, 0, 0.04, d - 0.2, 0.92);
      for (let i = 0; i < o.layar; i++) {
        const cx = x + 0.3 + i * (w - 0.6) / Math.max(1, o.layar - 1);
        b.kotak("monitor", cx - 0.2, y + 0.12, 1.06, 0.4, 0.03, 0.26);
        b.silinder("logamGelap", cx, y + 0.13, 0.96, 0.015, 0.1);
      }
      break;
    }
    default: break;
  }
}

/** Dinding dengan lubang jendela & pintu. Sepanjang `sumbu` ("x" = dinding belakang y=0, "y" = dinding kiri x=0). */
function gambarDinding(b, sumbu, panjang, lubang) {
  const T = TINGGI_DINDING, tebal = 0.22;
  const kotak = (a0, a1, z0, z1) => (sumbu === "x"
    ? b.kotak("dinding", a0, -tebal, z0, a1 - a0, tebal, z1 - z0)
    : b.kotak("dinding", -tebal, a0, z0, tebal, a1 - a0, z1 - z0));
  const urut = [...lubang].sort((p, q) => p.a - q.a);
  let a = sumbu === "x" ? -tebal : 0;
  for (const l of urut) {
    kotak(a, l.a, 0, T);
    if (l.z0 > 0) kotak(l.a, l.b, 0, l.z0);
    kotak(l.a, l.b, l.z1, T);
    a = l.b;
  }
  kotak(a, panjang, 0, T);
  // tutup atas dinding (lis)
  if (sumbu === "x") b.kotak("dindingAtas", -tebal, -tebal - 0.02, T, panjang + tebal, tebal + 0.04, 0.05);
  else b.kotak("dindingAtas", -tebal - 0.02, 0, T, tebal + 0.04, panjang, 0.05);
}

// ---------------- adegan ----------------
export class Adegan {
  /**
   * @param {{ wadah: HTMLElement, kanvas: HTMLCanvasElement, lapis: HTMLElement, onPilih: (nama: string|null) => void,
   *           hemat: () => boolean }} opsi
   */
  constructor({ wadah, kanvas: el, lapis, onPilih, hemat }) {
    this.wadah = wadah; this.lapis = lapis; this.onPilih = onPilih; this.hemat = hemat;
    this.gelap = matchMedia("(prefers-color-scheme: dark)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));   // HP: 1,5 (brief desain 3D)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;   // perabot statis: bayangan digambar sekali (lihat perbaruiBayangan)
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 300);
    this.denah = bangunDenah();
    this.layar = {};          // nama → mesh layar monitor (warna mengikuti status)
    this.sorot = {};          // nama → bidang sorot di lantai (hover/dipilih)
    this.sasaran = [];        // mesh tak terlihat untuk pemilihan (meja & orang)
    this.label = [];          // { el, pos: Vector3, tampil: () => bool }
    this.orang = new Set();   // karakter (diatur kantor.mjs) — dipakai untuk bayangan & pemilihan
    this.perlu = true;
    this.blobM = new THREE.Matrix4();
    this.ukur = { bingkai: 0, gambar: 0, msGambar: 0, mulai: performance.now() };

    this.bangunMaterial();
    this.bangunCahaya();
    this.bangunRuang();
    this.bangunKamera();
    this.pasangPemilihan();
    new ResizeObserver(() => this.ubahUkuran()).observe(wadah);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { this.gelap = e.matches; this.terapkanTema(); });
    el.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.hilang?.(); });
    this.ubahUkuran();
    this.terapkanTema();
  }

  // ---------- material ----------
  bangunMaterial() {
    const ubin = teksturUbin(), kayu = teksturKayu(), karpet = teksturKarpet();
    const std = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
    this.tekstur = { ubin, kayu, karpet };
    this.mat = {
      lantai: std({ map: ubin, roughness: 0.82 }), lorong: std({ map: karpet, roughness: 0.95 }), sisiLantai: std({ roughness: 0.9 }),
      dinding: std({ roughness: 0.92 }), dindingAtas: std({ roughness: 0.7 }),
      kayuLantai: std({ map: kayu, roughness: 0.55 }), kayuTerang: std({ map: kayu, roughness: 0.5 }), kayuGelap: std({ map: kayu, roughness: 0.45 }),
      logam: std({ roughness: 0.35, metalness: 0.7 }), logamGelap: std({ roughness: 0.45, metalness: 0.5 }),
      kain: std({ roughness: 0.95 }), kulit: std({ roughness: 0.42 }), sofa: std({ roughness: 0.95 }),
      partisi: std({ roughness: 0.95 }), kaca: std({ roughness: 0.06, transparent: true, opacity: 0.28, depthWrite: false }),
      karpet: std({ map: karpet, roughness: 1 }), karpetLounge: std({ map: karpet, roughness: 1 }),
      monitor: std({ roughness: 0.4, metalness: 0.2 }), pot: std({ roughness: 0.6 }), tanah: std({ color: "#3b2f27", roughness: 1 }),
      daun: std({ roughness: 0.75, flatShading: true }), daun2: std({ roughness: 0.75, flatShading: true }),
      bar: std({ map: kayu, roughness: 0.5 }), batu: std({ roughness: 0.3 }), mesin: std({ roughness: 0.35, metalness: 0.6 }),
      rak: std({ roughness: 0.5, metalness: 0.3 }), putih: std({ roughness: 0.4 }),
      led: new THREE.MeshBasicMaterial({ color: "#34c38a" }),
      bukuMerah: std({ color: "#c0504d", roughness: 0.7 }), bukuBiru: std({ color: "#3d6fb8", roughness: 0.7 }),
      bukuKuning: std({ color: "#c9a227", roughness: 0.7 }), bukuHijau: std({ color: "#3e8e5c", roughness: 0.7 }),
      jendela: new THREE.MeshBasicMaterial({ toneMapped: false }),
      cahayaJendela: new THREE.MeshBasicMaterial({ map: teksturCahaya(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      blob: new THREE.MeshBasicMaterial({ map: teksturBlob(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      grafik: new THREE.MeshBasicMaterial({ map: teksturGrafik(), toneMapped: false }),
      kapLampu: std({ roughness: 0.7 }), map: std({ roughness: 0.75 }),
      kapLampuTim: Object.fromEntries(NOMOR_TIM.map((n) => [`tim${n}`, std({ roughness: 0.7 })])),
      genangan: new THREE.MeshBasicMaterial({ map: teksturGenangan(), color: "#ffcf8a", transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      zona: {},
    };
    for (const dv of [...DIVISI, { id: "lounge", warna: WARNA_LOUNGE }]) this.mat.zona[dv.id] = std({ map: ubin, roughness: 0.8 });
  }
  terapkanTema() {
    const p = PALET[this.gelap ? "gelap" : "terang"], m = this.mat;
    for (const [k, v] of Object.entries(p)) if (m[k]?.color && typeof v === "string") m[k].color.set(v);
    m.kayuLantai.color.set(p.kayuLantai); m.karpetLounge.color.set(p.karpetLounge);
    for (const dv of [...DIVISI, { id: "lounge", warna: WARNA_LOUNGE }])
      m.zona[dv.id].color.set(p.lantai).lerp(new THREE.Color(dv.warna), ZONA_TINT[this.gelap ? "gelap" : "terang"]);
    m.zona.pimpinan.map = this.tekstur.kayu; m.zona.pimpinan.color.set(p.kayuLantai); m.zona.pimpinan.roughness = 0.55; m.zona.pimpinan.needsUpdate = true;
    // suasana mengikuti jam: tint & pengali fase di atas palet tema
    const w = WAKTU[this.waktu] ?? WAKTU.siang, campur = (dasar, ke, u) => (ke && u ? new THREE.Color(dasar).lerp(new THREE.Color(ke), u) : new THREE.Color(dasar));
    m.jendela.color.copy(campur(p.jendela, w.jendela, w.tintJendela));
    m.cahayaJendela.color.copy(campur(p.cahayaJendela, w.cahayaJendela, w.cahayaJendela ? 0.7 : 0));
    m.cahayaJendela.opacity = p.kuatCahayaJendela * w.kuatCahayaJendela;
    this.hemi.color.copy(campur(p.langit, w.langit, w.tintLangit)); this.hemi.groundColor.set(p.tanah); this.hemi.intensity = p.hemi * w.hemi;
    this.matahari.color.copy(campur(p.matahari, w.matahari, w.matahari ? 0.8 : 0)); this.matahari.intensity = p.kuatMatahari * w.kuatMatahari;
    this.matahari.position.set(NX / 2 + w.pos[0], w.pos[1], NY / 2 + w.pos[2]);
    this.scene.environmentIntensity = p.env * w.env;
    this.terapkanLampu();
    for (const nama of Object.keys(this.layar)) this.aturLayar(nama, this.statusLayar?.[nama] ?? null, true);
    for (const pp of Object.values(this.papan ?? {})) pp.kunci = null;   // warna tinta papan mengikuti tema
    if (this.isiPapan) this.aturPapan(this.isiPapan);
    if (this.isiTulisan) this.aturTulisanZona(this.isiTulisan, true);
    if (this.isiBerkas) this.aturBerkas(this.isiBerkas, true);
    this.perbaruiBayangan();
  }
  /** Lampu meja & lantai menurut fase; kap lampu tim yang belum dipakai tidak menyala. Tidak menyentuh bayangan. */
  terapkanLampu() {
    const p = PALET[this.gelap ? "gelap" : "terang"], m = this.mat, w = WAKTU[this.waktu] ?? WAKTU.siang;
    for (const [dv, km] of [["", m.kapLampu], ...Object.entries(m.kapLampuTim)]) {
      const nyala = w.lampu > 0 && (!dv || !this.timTerlihat || this.timTerlihat.has(dv));
      km.color.set(p.kapLampu); km.emissive.set(nyala ? "#ffc97a" : "#000000"); km.emissiveIntensity = nyala ? w.lampu * 1.4 : 0;
    }
    m.genangan.opacity = (this.gelap ? 0.38 : 0.62) * w.lampu; this.genangan.visible = w.lampu > 0;
    this.mintaGambar();
  }
  /** Lampu meja tim engineering yang belum dipakai padam (genangan disembunyikan, kap tidak menyala). `terlihat` = Set divisi. */
  aturLampuTim(terlihat, paksa = false) {
    const kunci = terlihat ? [...terlihat].sort().join(",") : "*";
    if (!paksa && kunci === this._kunciLampu) return;
    this._kunciLampu = kunci; this.timTerlihat = terlihat;
    (this.lampu ?? []).forEach((l, i) => {
      const padam = terlihat && l.divisi?.startsWith("tim") && !terlihat.has(l.divisi);
      this.blobM.makeScale(padam ? 0 : l.r, 1, padam ? 0 : l.r).setPosition(l.x, l.h, l.y); this.genangan.setMatrixAt(i, this.blobM);
    });
    this.genangan.instanceMatrix.needsUpdate = true;
    if (!paksa) this.terapkanLampu();
  }
  /** Fase waktu (pagi · siang · sore · malam) → cahaya, jendela, lampu. Hanya menggambar ulang bila fasenya berubah. */
  aturWaktu(fase) {
    if (!WAKTU[fase] || fase === this.waktu) return;
    this.waktu = fase;
    this.terapkanTema();
  }

  // ---------- cahaya ----------
  bangunCahaya() {
    const pmrem = new THREE.PMREMGenerator(this.renderer), ruang = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(ruang, 0.04).texture;
    ruang.dispose(); pmrem.dispose();
    this.hemi = new THREE.HemisphereLight("#ffffff", "#d9d3c9", 1.1);
    this.scene.add(this.hemi);
    // matahari masuk dari jendela belakang-kiri; dinding tidak menghalangi (diorama terbuka)
    this.matahari = new THREE.DirectionalLight("#fff1dc", 2.4);
    this.matahari.position.set(NX / 2 - 13, 24, NY / 2 - 15);
    this.matahari.target.position.set(NX / 2, 0, NY / 2);
    this.matahari.castShadow = true;
    const kecil = Math.min(innerWidth, innerHeight) < 600;
    this.matahari.shadow.mapSize.set(kecil ? 1024 : 2048, kecil ? 1024 : 2048);
    const sc = this.matahari.shadow.camera;
    sc.left = -25; sc.right = 25; sc.top = 20; sc.bottom = -20; sc.near = 5; sc.far = 60; sc.updateProjectionMatrix();
    this.matahari.shadow.normalBias = 0.03; this.matahari.shadow.bias = -0.0004; this.matahari.shadow.radius = 3;
    this.scene.add(this.matahari, this.matahari.target);
  }
  perbaruiBayangan() { this.renderer.shadowMap.needsUpdate = true; this.mintaGambar(); }

  // ---------- ruang & perabot ----------
  bangunRuang() {
    const b = new Pembangun(), pakaiMat = (k) => (k.startsWith("zona:") ? this.mat.zona[k.slice(5)] : k.startsWith("kapLampu:") ? this.mat.kapLampuTim[k.slice(9)] : this.mat[k]);
    // lantai: alas (lorong) + zona; tebal lantai (diorama)
    const lantai = (kunci, x0, y0, x1, y1, z = 0) => {
      const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (y1 - y0));
      b.tambah(kunci, g, (x0 + x1) / 2, z, (y0 + y1) / 2, { bayang: false });
    };
    lantai("lorong", 0, 0, NX, NY, 0);
    for (const [id, [x0, y0, x1, y1]] of Object.entries(ZONA)) lantai(`zona:${id}`, x0, y0, x1, y1, 0.004);
    b.kotak("sisiLantai", -0.22, -0.22, -0.45, NX + 0.22, NY + 0.22, 0.449, { bayang: false });
    // lis depan diorama (sedikit lebih rendah dari lantai): tempat nama zona baris depan (label.mjs › LIS_DEPAN)
    b.kotak("sisiLantai", -0.22, LIS_DEPAN.y0, -0.45, NX + 0.22, LIS_DEPAN.y1 - LIS_DEPAN.y0, 0.45 + LIS_DEPAN.z, { bayang: false });
    for (const dk of this.denah.dekor) {
      if (dk.jenis === "karpet") lantai(dk.warna === "lounge" ? "karpetLounge" : "karpet", dk.x0, dk.y0, dk.x1, dk.y1, 0.012);
    }
    lantai("karpet", 0.9, 8.55, NX - 0.6, 9.45, 0.012);                            // karpet lorong
    lantai("kayuGelap", 0.3, PINTU[1] - 0.7, 1.3, PINTU[1] + 0.7, 0.014);           // keset
    // dinding belakang & kiri dengan jendela dan pintu
    gambarDinding(b, "x", NX, JENDELA.belakang.map(([a, c]) => ({ a, b: c, z0: 0.95, z1: 2.15 })));
    gambarDinding(b, "y", NY, [...JENDELA.kiri.map(([a, c]) => ({ a, b: c, z0: 0.95, z1: 2.15 })), { a: PINTU[1] - 0.8, b: PINTU[1] + 0.8, z0: 0, z1: 2.1 }]);
    // kusen jendela + kaca; bercak cahaya jendela di lantai (semua digabung: satu draw call per material)
    const kaca = (x, y, w, h, ry) => b.tambah("jendela", new THREE.PlaneGeometry(w, h), x, 1.55, y, { ry, bayang: false });
    const bercak = (q) => b.tambah("cahayaJendela", this.bercakCahaya(q), 0, 0, 0, { bayang: false });
    for (const [a, c] of JENDELA.belakang) {
      kaca((a + c) / 2, -0.12, c - a, 1.2, 0);
      b.kotak("dindingAtas", (a + c) / 2 - 0.03, -0.2, 0.95, 0.06, 0.16, 1.2);
      b.kotak("dindingAtas", a, -0.24, 0.9, c - a, 0.3, 0.05);
      bercak([[a + 0.3, 0.3], [c + 0.3, 0.3], [c + 2.2, 3.6], [a + 2.2, 3.6]]);
    }
    for (const [a, c] of JENDELA.kiri) {
      kaca(-0.12, (a + c) / 2, c - a, 1.2, Math.PI / 2);
      b.kotak("dindingAtas", -0.2, (a + c) / 2 - 0.03, 0.95, 0.16, 0.06, 1.2);
      b.kotak("dindingAtas", -0.24, a, 0.9, 0.3, c - a, 0.05);
      bercak([[0.3, a + 0.3], [0.3, c + 0.3], [3.3, c + 1.9], [3.3, a + 1.9]]);
    }
    // pintu masuk: kusen, daun pintu, tanda keluar
    const py = PINTU[1];
    b.kotak("kayuGelap", -0.26, py - 0.9, 0, 0.3, 0.1, 2.2); b.kotak("kayuGelap", -0.26, py + 0.8, 0, 0.3, 0.1, 2.2);
    b.kotak("kayuGelap", -0.26, py - 0.9, 2.1, 0.3, 1.8, 0.1);
    b.kotak("kayuTerang", -0.18, py - 0.8, 0, 0.06, 1.6, 2.08);
    b.kotak("logam", -0.1, py + 0.5, 0.95, 0.04, 0.16, 0.04, { bayang: false });
    b.kotak("keluar", -0.0, py - 0.31, 2.28, 0.04, 0.62, 0.2, { bayang: false });
    this.mat.keluar = new THREE.MeshBasicMaterial({ color: "#2fa86b", toneMapped: false });
    // dekor dinding: papan tulis tiap pod, papan strategi, papan tugas — isinya kanvas dari data register (aturPapan),
    // tidak ada coretan hiasan: papan kosong berarti memang tidak ada tugas berjalan
    for (const dk of this.denah.dekor) {
      if (dk.jenis === "papan-tulis") {
        b.kotak("logam", dk.a - 0.03, 0, dk.z0 - 0.03, dk.b - dk.a + 0.06, 0.04, dk.z1 - dk.z0 + 0.06, { bayang: false });
        b.kotak("putih", dk.a, 0.02, dk.z0, dk.b - dk.a, 0.03, dk.z1 - dk.z0, { bayang: false });
      }
      if (dk.jenis === "papan-strategi" || dk.jenis === "papan-tugas") {
        if (dk.jenis === "papan-tugas") b.kotak("logam", 0, dk.a - 0.03, dk.z0 - 0.03, 0.035, dk.b - dk.a + 0.06, dk.z1 - dk.z0 + 0.06, { bayang: false });
        b.kotak("putih", 0, dk.a, dk.z0, 0.04, dk.b - dk.a, dk.z1 - dk.z0, { bayang: false });
      }
    }
    // perabot
    const layar = [], ekstra = { lampu: [], berkas: {} };
    for (const o of this.denah.perabot) gambarPerabot(b, o, layar, ekstra);
    this.tempatBerkas = ekstra.berkas;
    this.statis = b.bentuk(pakaiMat);
    this.scene.add(this.statis);
    // layar monitor semua meja = satu InstancedMesh (warna per layar = status); panel grafik IT Operations terpisah
    const gLayar = new THREE.PlaneGeometry(1, 1), mejaLayar = layar.filter((l) => l.agen), o3 = new THREE.Object3D();
    this.layarInst = new THREE.InstancedMesh(gLayar, new THREE.MeshBasicMaterial({ toneMapped: false }), mejaLayar.length);
    mejaLayar.forEach((l, i) => {
      o3.position.set(l.x, l.h, l.y); o3.rotation.set(0, l.ry, 0); o3.scale.set(l.w, l.tinggi, 1); o3.updateMatrix();
      this.layarInst.setMatrixAt(i, o3.matrix); this.layarInst.setColorAt(i, new THREE.Color("#3a4652"));
      this.layar[l.agen] = i;
    });
    this.layarInst.computeBoundingSphere();
    this.scene.add(this.layarInst);
    for (const l of layar.filter((q) => q.statis)) {
      const m = new THREE.Mesh(gLayar, this.mat.grafik);
      m.position.set(l.x, l.h, l.y); m.rotation.y = l.ry; m.scale.set(l.w, l.tinggi, 1); m.matrixAutoUpdate = false; m.updateMatrix();
      this.scene.add(m);
    }
    this.bangunPapan();
    this.bangunTulisanZona();
    // berkas tugas yang selesai hari ini di meja pemiliknya = satu InstancedMesh (maks. 3 per meja)
    this.berkasInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.23, 0.012, 0.31), this.mat.map, Object.keys(this.tempatBerkas).length * 3);
    this.berkasInst.count = 0; this.berkasInst.castShadow = false; this.berkasInst.receiveShadow = true; this.scene.add(this.berkasInst);
    // genangan cahaya lampu meja & lampu lantai (hanya tampil saat lampu menyala) = satu InstancedMesh
    this.genangan = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat.genangan, ekstra.lampu.length);
    this.lampu = ekstra.lampu; this.timTerlihat ??= null;
    this.aturLampuTim(this.timTerlihat, true);
    this.genangan.visible = false; this.genangan.renderOrder = 2; this.scene.add(this.genangan);
    // bayangan kontak semua orang = satu InstancedMesh (diperbarui saat menggambar)
    this.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 0.75).rotateX(-Math.PI / 2), this.mat.blob, 48);
    this.blob.count = 0; this.blob.frustumCulled = false; this.scene.add(this.blob);
    // sorot & sasaran klik per meja
    const gSorot = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), gSasaran = new THREE.BoxGeometry(1, 1, 1);
    const tak = new THREE.MeshBasicMaterial({ visible: false });
    for (const o of this.denah.perabot.filter((q) => q.agen)) {
      const [sx, sy] = KURSI[o.agen].duduk;
      const x0 = Math.min(o.x, sx - 0.5) - 0.15, x1 = Math.max(o.x + o.w, sx + 0.5) + 0.15;
      const y0 = Math.min(o.y, sy - 0.5) - 0.15, y1 = Math.max(o.y + o.d, sy + 0.5) + 0.15;
      const s = new THREE.Mesh(gSorot, new THREE.MeshBasicMaterial({ color: TIM[o.agen].warna, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      s.position.set((x0 + x1) / 2, 0.02, (y0 + y1) / 2); s.scale.set(x1 - x0, 1, y1 - y0); s.visible = false;
      this.scene.add(s); this.sorot[o.agen] = s;
      const h = new THREE.Mesh(gSasaran, tak);
      h.position.set((x0 + x1) / 2, 0.6, (y0 + y1) / 2); h.scale.set(x1 - x0, 1.2, y1 - y0); h.userData.agen = o.agen;
      this.scene.add(h); this.sasaran.push(h);
    }
  }
  bercakCahaya([[ax, ay], [bx, by], [cx, cy], [dx, dy]]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([ax, 0.02, ay, bx, 0.02, by, cx, 0.02, cy, ax, 0.02, ay, cx, 0.02, cy, dx, 0.02, dy], 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    return g;
  }

  /** Warna layar monitor sesuai keadaan: bekerja = menyala warna peran; berpikir/menunggu = setengah; baru selesai =
   *  setengah berwarna "selesai"; siap dipanggil = sangat redup (menyala, tidak dipakai); null (tim kosong) = mati. */
  aturLayar(nama, status, paksa = false) {
    this.statusLayar ??= {};
    if (!paksa && nama in this.statusLayar && this.statusLayar[nama] === status) return;   // tidak berubah: tanpa gambar ulang
    this.statusLayar[nama] = status;
    const i = this.layar[nama]; if (i === undefined) return;
    const p = PALET[this.gelap ? "gelap" : "terang"], warna = new THREE.Color(TIM[nama].warna), c = new THREE.Color();
    if (status === "bekerja") c.copy(warna).lerp(new THREE.Color("#ffffff"), 0.35);
    else if (status === "berpikir" || status === "menunggu") c.set(p.layarMati).lerp(warna, 0.45);
    else if (status === "selesai") c.set(p.layarMati).lerp(new THREE.Color(p.selesai), 0.55);
    else if (status === "siap") c.set(p.layarMati).lerp(warna, 0.16);
    else c.set(p.layarMati);
    this.layarInst.setColorAt(i, c); this.layarInst.instanceColor.needsUpdate = true;
    this.mintaGambar();
  }
  // ---------- jejak kerja: papan (kanvas) & berkas ----------
  /** Bidang kanvas di depan tiap papan (dinding belakang: menghadap +z; dinding kiri: menghadap +x). 400 px per meter. */
  bangunPapan() {
    this.papan = {};
    for (const dk of this.denah.dekor) {
      if (!dk.id) continue;
      const lebar = dk.b - dk.a, tinggi = dk.z1 - dk.z0, PPM = 400;
      const kanvasEl = document.createElement("canvas");
      kanvasEl.width = Math.round(lebar * PPM); kanvasEl.height = Math.round(tinggi * PPM);
      const tekstur = new THREE.CanvasTexture(kanvasEl);
      tekstur.colorSpace = THREE.SRGBColorSpace; tekstur.anisotropy = 8;
      const mat = new THREE.MeshStandardMaterial({ map: tekstur, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const me = new THREE.Mesh(new THREE.PlaneGeometry(lebar, tinggi), mat);
      if (dk.dinding === "kiri") { me.position.set(0.043, (dk.z0 + dk.z1) / 2, (dk.a + dk.b) / 2); me.rotation.y = Math.PI / 2; }
      else me.position.set((dk.a + dk.b) / 2, (dk.z0 + dk.z1) / 2, 0.053);
      me.matrixAutoUpdate = false; me.updateMatrix(); me.visible = false;
      this.scene.add(me);
      this.papan[dk.id] = { jenis: dk.jenis, kanvas: kanvasEl, tekstur, me, kunci: null };
    }
    // huruf lokal baru siap setelah dimuat: gambar ulang papan sekali
    document.fonts?.ready?.then(() => { for (const pp of Object.values(this.papan)) pp.kunci = null; if (this.isiPapan) this.aturPapan(this.isiPapan); });
  }
  /**
   * Isi papan dari data register: `{ tim1: {judul, tugas:[{id, judul, status}]}, …, corp: {…}, tugas: {berjalan, lain, selesai} }`.
   * Hanya ID, judul, dan status tugas yang digambar. Kanvas hanya digambar ulang bila isinya berubah.
   */
  aturPapan(isi) {
    this.isiPapan = isi;
    const p = PALET[this.gelap ? "gelap" : "terang"];
    for (const [id, pp] of Object.entries(this.papan ?? {})) {
      const data = isi[id] ?? null, kunci = JSON.stringify([data, this.gelap]);
      if (pp.kunci === kunci) continue;
      pp.kunci = kunci;
      const g = pp.kanvas.getContext("2d");
      g.clearRect(0, 0, pp.kanvas.width, pp.kanvas.height);
      if (data) (pp.jenis === "papan-tugas" ? gambarPapanTugas : pp.jenis === "papan-strategi" ? gambarPapanCatatan : gambarPapanTulis)(g, pp.kanvas, data, p);
      pp.me.visible = !!data;
      pp.tekstur.needsUpdate = true;
      this.mintaGambar();
    }
  }
  // ---------- nama zona: tulisan di lantai (DESAIN.md › Label & keterbacaan) ----------
  /**
   * Satu mesh untuk semua zona (satu draw call, tidak ikut peta bayangan): tiap zona = satu bidang di lantai pada kotak
   * `KOTAK_TULISAN` (lorong / tepi depan), teksturnya satu kanvas atlas. Tulisan berada DI lantai: perabot dan orang
   * selalu tergambar di atasnya, jadi nama zona tidak pernah menutupi meja atau orang.
   */
  bangunTulisanZona() {
    const PPM = 150, JARAK = 8, ids = Object.keys(KOTAK_TULISAN);
    const lebar = Math.ceil(Math.max(...ids.map((id) => (KOTAK_TULISAN[id][2] - KOTAK_TULISAN[id][0]) * PPM)));
    const tempat = {}; let y = 0;
    for (const id of ids) {
      const [x0, y0, x1, y1] = KOTAK_TULISAN[id], w = Math.round((x1 - x0) * PPM), h = Math.round((y1 - y0) * PPM);
      tempat[id] = { px: 0, py: y, w, h, kotak: KOTAK_TULISAN[id] }; y += h + JARAK;
    }
    const kanvas = document.createElement("canvas"); kanvas.width = lebar; kanvas.height = y;
    const tekstur = new THREE.CanvasTexture(kanvas);
    tekstur.colorSpace = THREE.SRGBColorSpace; tekstur.anisotropy = 8;
    const pos = [], uv = [], idx = [];
    for (const id of ids) {
      const t = tempat[id], [x0, y0, x1, y1, H = 0.022] = t.kotak, n = pos.length / 3;
      const u0 = t.px / lebar, u1 = (t.px + t.w) / lebar, v0 = 1 - t.py / kanvas.height, v1 = 1 - (t.py + t.h) / kanvas.height;
      // sudut: kiri-belakang, kanan-belakang, kanan-depan, kiri-depan (atas tulisan menghadap dinding belakang)
      pos.push(x0, H, y0, x1, H, y0, x1, H, y1, x0, H, y1);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: tekstur, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const me = new THREE.Mesh(g, mat);
    me.receiveShadow = true; me.castShadow = false; me.renderOrder = 1; me.matrixAutoUpdate = false; me.visible = false;
    this.scene.add(me);
    this.tulisan = { kanvas, tekstur, me, tempat, PPM, kunci: null };
    document.fonts?.ready?.then(() => { if (this.isiTulisan) this.aturTulisanZona(this.isiTulisan, true); });
  }
  /**
   * Isi tulisan lantai: `[{ id, warna, redup, baris: [{ teks, skala }] }]` (label.mjs › tulisanZona). Baris pertama
   * tebal dengan kotak warna zona, baris berikutnya lebih kecil & redup; ukuran huruf terbesar yang muat di kotaknya.
   */
  aturTulisanZona(daftar, paksa = false) {
    this.isiTulisan = daftar;
    const tl = this.tulisan; if (!tl) return;
    const kunci = JSON.stringify([daftar, this.gelap]);
    if (!paksa && kunci === tl.kunci) return;
    tl.kunci = kunci;
    const g = tl.kanvas.getContext("2d"), tinta = new THREE.Color(this.gelap ? "#e4ebf2" : "#1d2833"), redupW = this.gelap ? "#8fa0b1" : "#5e6e7e";
    g.clearRect(0, 0, tl.kanvas.width, tl.kanvas.height);
    for (const z of daftar) {
      const t = tl.tempat[z.id]; if (!t) continue;
      const pad = 0.08 * tl.PPM, ruangW = t.w - 2 * pad, ruangH = t.h - 2 * pad;
      const hurufBaris = (b, i, px) => `${i === 0 ? 700 : 520} ${px * b.skala}px ${i === 0 ? HURUF_JUDUL : HURUF}`;
      // ukuran huruf baris pertama (px) yang muat tinggi & lebar kotak; kotak warna zona di depan baris pertama
      let px = Math.min(ruangH / z.baris.reduce((s, b) => s + b.skala * 1.18, 0), 1.0 * tl.PPM);
      for (const [i, b] of z.baris.entries()) {
        g.font = hurufBaris(b, i, 100);
        const w100 = g.measureText(b.teks).width + (i === 0 ? 100 * 0.78 : 0);
        px = Math.min(px, (ruangW / w100) * 100);
      }
      const warnaTeks = `#${tinta.clone().lerp(new THREE.Color(z.warna), this.gelap ? 0.28 : 0.32).getHexString()}`;
      g.save();
      g.globalAlpha = z.redup ? 0.45 : 0.95;
      g.textBaseline = "middle"; g.textAlign = "left";
      const tinggiTotal = z.baris.reduce((s, b) => s + b.skala * px * 1.18, 0);
      let yb = t.py + t.h / 2 - tinggiTotal / 2;
      for (const [i, b] of z.baris.entries()) {
        const ukuran = px * b.skala, tengah = yb + ukuran * 0.59;
        g.font = hurufBaris(b, i, px);
        const kotakW = i === 0 ? px * 0.78 : 0, lebarTeks = g.measureText(b.teks).width + kotakW, x = t.px + t.w / 2 - lebarTeks / 2;
        if (i === 0) { g.fillStyle = z.warna; kotakBulat(g, x, tengah - px * 0.27, px * 0.54, px * 0.54, px * 0.12); g.fill(); }
        g.fillStyle = i === 0 ? warnaTeks : redupW;
        g.fillText(b.teks, x + kotakW, tengah);
        yb += ukuran * 1.18;
      }
      g.restore();
    }
    tl.tekstur.needsUpdate = true; tl.me.visible = daftar.length > 0;
    this.mintaGambar();
  }
  /** Berkas di meja: `{ kursi: jumlah }` → tumpukan map (maks. 3) di meja pemiliknya. */
  aturBerkas(jumlah, paksa = false) {
    const kunci = JSON.stringify(jumlah);
    if (!paksa && kunci === this._kunciBerkas) return;
    this._kunciBerkas = kunci; this.isiBerkas = jumlah;
    const p = PALET[this.gelap ? "gelap" : "terang"], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let n = 0;
    for (const [nama, k] of Object.entries(jumlah)) {
      const t = this.tempatBerkas[nama]; if (!t) continue;
      for (let i = 0; i < Math.min(3, k); i++) {
        q.setFromEuler(e.set(0, (i % 2 ? 0.14 : -0.1) + i * 0.03, 0));
        m.compose(new THREE.Vector3(t.x + i * 0.012, t.h + 0.007 + i * 0.014, t.y - i * 0.01), q, new THREE.Vector3(1, 1, 1));
        this.berkasInst.setMatrixAt(n, m);
        this.berkasInst.setColorAt(n, c.set(p.map).lerp(new THREE.Color(TIM[nama].warna), 0.18 + 0.12 * i));
        n++;
      }
    }
    this.berkasInst.count = n;
    this.berkasInst.instanceMatrix.needsUpdate = true;
    if (this.berkasInst.instanceColor) this.berkasInst.instanceColor.needsUpdate = true;
    this.berkasInst.computeBoundingSphere();
    this.mintaGambar();
  }
  aturSorot(nama, tingkat) {   // 0 tidak ada · 1 hover · 2 dipilih
    const s = this.sorot[nama]; if (!s) return;
    s.visible = tingkat > 0; s.material.opacity = tingkat === 2 ? 0.26 : 0.15;
    this.mintaGambar();
  }

  // ---------- kamera ----------
  bangunKamera() {
    this.kontrol = new OrbitControls(this.camera, this.renderer.domElement);
    const k = this.kontrol;
    k.enableDamping = !this.hemat(); k.dampingFactor = 0.12;
    k.screenSpacePanning = false;          // geser sejajar lantai
    k.minPolarAngle = 0.49; k.maxPolarAngle = 1.12;   // 28°–64° dari vertikal (brief desain 3D)
    this.AZ = Math.PI / 4;                 // bawaan: dari depan-kanan (seperti denah isometrik)
    this.POLAR = 1.01;                     // 58° dari vertikal
    k.minAzimuthAngle = this.AZ - 0.52; k.maxAzimuthAngle = this.AZ + 0.52;   // 15°–75°: dinding belakang selalu di belakang
    k.minDistance = 9; k.rotateSpeed = 0.6; k.zoomSpeed = 0.9; k.panSpeed = 0.8;
    // seperti peta: seret = geser, klik kanan + seret = putar; HP: satu jari geser, dua jari cubit/putar
    k.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    // sentuh "kooperatif" (seperti peta tertanam): satu jari menggulir HALAMAN, dua jari menggeser & mencubit denah
    k.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_PAN };
    this.renderer.domElement.style.touchAction = "pan-y";
    this.pasangPetunjukSentuh();
    // keyboard (fokus di denah): panah = geser, Shift + panah = putar (OrbitControls), + / − = perbesar, 0 = seluruh denah
    this.wadah.tabIndex = 0;
    k.keyPanSpeed = 40;
    k.listenToKeyEvents(this.wadah);
    this.wadah.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=") this.zoom(0.75);
      else if (e.key === "-" || e.key === "_") this.zoom(1.33);
      else if (e.key === "0") this.seluruhDenah();
      else if (e.key === "Escape") this.onPilih(null);
      else return;
      e.preventDefault();
    });
    k.addEventListener("change", () => { this.batasiGeser(); this.mintaGambar(); this.onKamera?.(); });
    k.addEventListener("start", () => { this.digeser = false; this.kameraDiubah = true; this.awalGeser = this.camera.position.clone(); });
    k.addEventListener("end", () => { if (this.awalGeser && this.awalGeser.distanceTo(this.camera.position) > 0.05) { this.digeser = true; setTimeout(() => { this.digeser = false; }, 0); } });
  }
  /** Satu jari digeser di atas denah (HP) → petunjuk singkat "pakai dua jari" (halaman tetap bisa digulir). */
  pasangPetunjukSentuh() {
    const el = this.renderer.domElement, sentuh = new Map();
    const petunjuk = document.createElement("div"); petunjuk.className = "petunjuk-sentuh"; petunjuk.hidden = true;
    petunjuk.textContent = "Pakai dua jari untuk menggeser & memperbesar denah"; this.wadah.append(petunjuk);
    let tutup = 0;
    el.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") sentuh.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    const lepas = (e) => sentuh.delete(e.pointerId);
    el.addEventListener("pointerup", lepas); el.addEventListener("pointercancel", (e) => {
      // peramban mengambil alih (menggulir halaman) saat satu jari bergerak → tampilkan petunjuk
      if (sentuh.size === 1) { petunjuk.hidden = false; clearTimeout(tutup); tutup = setTimeout(() => { petunjuk.hidden = true; }, 1800); }
      lepas(e);
    });
  }
  batasiGeser() {
    const t = this.kontrol.target, sebelum = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, 0, NX); t.z = THREE.MathUtils.clamp(t.z, 0, NY); t.y = THREE.MathUtils.clamp(t.y, 0, 1);
    if (!t.equals(sebelum)) this.camera.position.add(t.clone().sub(sebelum));
  }
  /** Jarak kamera agar seluruh denah (lantai + dinding) masuk layar pada arah bawaan. */
  jarakPas(az = this.AZ, polar = this.POLAR) { return this.pandangPas(az, polar).jarak; }
  /** Titik pandang & jarak agar seluruh denah (lantai + dinding) masuk layar dan terpusat (kotak proyeksinya di tengah). */
  pandangPas(az = this.AZ, polar = this.POLAR) {
    const kunci = `${this.camera.aspect.toFixed(4)}|${az}|${polar}`;
    if (this._pas?.kunci === kunci) return { jarak: this._pas.jarak, target: this._pas.target.clone() };
    const hasil = this.hitungPas(az, polar);
    this._pas = { kunci, ...hasil, target: hasil.target.clone() };
    return hasil;
  }
  hitungPas(az, polar) {
    const target = new THREE.Vector3(NX / 2, 0, NY / 2), titik = [];
    for (const x of [-0.25, NX]) for (const z of [-0.25, LIS_DEPAN.y1]) for (const y of [-0.45, TINGGI_DINDING]) titik.push(new THREE.Vector3(x, y, z));
    const arah = new THREE.Vector3().setFromSphericalCoords(1, polar, az), cam = this.camera.clone(), v = new THREE.Vector3();
    const tempat = (d) => { cam.position.copy(target).addScaledVector(arah, d); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
    const batas = () => {
      const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
      for (const p of titik) { v.copy(p).project(cam); b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x); b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y); }
      return b;
    };
    let jarak = 60;
    for (let putaran = 0; putaran < 4; putaran++) {
      let lo = 5, hi = 400;
      for (let i = 0; i < 28; i++) {
        const m = (lo + hi) / 2; tempat(m); const b = batas();
        if (b.x1 - b.x0 < 1.9 && b.y1 - b.y0 < 1.86) hi = m; else lo = m;
      }
      jarak = hi; tempat(jarak);
      this._batasPas = batas();
      // geser titik pandang agar pusat kotak proyeksi di tengah layar
      const b = batas(), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const tinggiDunia = 2 * jarak * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), lebarDunia = tinggiDunia * cam.aspect;
      const kanan = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), atas = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const geser = kanan.multiplyScalar(cx * lebarDunia / 2).add(atas.multiplyScalar(cy * tinggiDunia / 2));
      // proyeksikan geseran ke lantai (sepanjang arah pandang) agar titik pandang tetap di y = 0
      const t = geser.y / arah.y; geser.addScaledVector(arah, -t);
      target.add(geser);
    }
    return { jarak, target };
  }
  /** "Seluruh denah": kembali ke sudut & jarak bawaan. */
  seluruhDenah(halus = !this.hemat()) {
    const { jarak: d, target } = this.pandangPas();
    this.kontrol.maxDistance = d * 1.2;
    this.terbangKe(target, d, this.AZ, this.POLAR, halus);
    this.kameraDiubah = false;
  }
  /** Dekatkan kamera ke titik lantai (x, y) — dipakai tautan ?tugas= dan tombol +/−. */
  dekatkan(x, y, faktor = 0.45, halus = !this.hemat()) {
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.kontrol.target));
    this.terbangKe(new THREE.Vector3(x, 0, y), Math.max(this.kontrol.minDistance, this.jarakPas() * faktor), s.theta, s.phi, halus);
  }
  /** Putar mengelilingi titik pandang (radian), tetap dalam batas azimut. */
  putar(sudut) {
    const k = this.kontrol, s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(k.target));
    const az = THREE.MathUtils.clamp(s.theta + sudut, k.minAzimuthAngle, k.maxAzimuthAngle);
    this.terbangKe(k.target.clone(), s.radius, az, s.phi, !this.hemat());
  }
  zoom(kali) {
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.kontrol.target));
    const d = THREE.MathUtils.clamp(s.radius * kali, this.kontrol.minDistance, this.kontrol.maxDistance);
    this.terbangKe(this.kontrol.target.clone(), d, s.theta, s.phi, !this.hemat());
  }
  terbangKe(target, jarak, az, polar, halus) {
    this.kameraDiubah = true;
    const akhirPos = target.clone().add(new THREE.Vector3().setFromSphericalCoords(jarak, polar, az));
    if (!halus) { this.kontrol.target.copy(target); this.camera.position.copy(akhirPos); this.kontrol.update(); this.mintaGambar(); return; }
    this.terbang = { t0: performance.now(), dari: this.camera.position.clone(), keT: target, dariT: this.kontrol.target.clone(), ke: akhirPos };
    this.mintaGambar();
  }
  dekatSeluruh() {
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.kontrol.target));
    const p = this.pandangPas();
    return Math.abs(s.radius - p.jarak) < 0.5 && this.kontrol.target.distanceTo(p.target) < 0.3;
  }

  ubahUkuran() {
    const w = this.wadah.clientWidth, h = this.wadah.clientHeight;
    if (!w || !h) return;
    const tegak = w / h < 0.9 || w < 700;   // HP: sudut lebih tegak (tetap meski tinggi kanvas disesuaikan)
    this.AZ = tegak ? Math.PI / 4 + 0.5 : Math.PI / 4;
    this.POLAR = tegak ? 0.8 : 1.01;
    this.kontrol.minAzimuthAngle = Math.PI / 4 - 0.52; this.kontrol.maxAzimuthAngle = Math.PI / 4 + 0.52;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.kontrol.maxDistance = this.jarakPas() * 1.2;
    // layar sempit: tinggi kanvas mengikuti tinggi denah (tanpa ruang kosong besar di atas/bawah) — sekali per lebar
    if (w < 700 && this._lebarTinggi !== w) {
      this._pas = null; this.pandangPas();
      const b = this._batasPas, isi = (b.y1 - b.y0) / 2;
      const ideal = Math.round(THREE.MathUtils.clamp(h * isi * 1.06, 320, innerHeight * 0.72));
      this._lebarTinggi = w;
      if (Math.abs(ideal - h) > 6) { this.wadah.style.height = `${ideal}px`; return; }   // ResizeObserver memanggil lagi
    } else if (w >= 700 && this._lebarTinggi) { this._lebarTinggi = null; this.wadah.style.height = ""; return; }
    if (!this.kameraDiubah) this.seluruhDenah(false);   // belum disentuh pengguna: tetap "Seluruh denah" untuk ukuran baru
    this.mintaGambar();
    this.onUkur?.();
  }

  // ---------- label HTML ----------
  /**
   * Daftarkan elemen label yang mengikuti titik 3D (x lantai, tinggi, y lantai); `ikut` = objek yang diikuti (opsional).
   * `prioritas` untuk tabrakan (lebih tinggi menang; 0 = tidak diperiksa); `prioritasFn` bila berubah menurut status.
   * Isi label (`.isi`) diberi transform sendiri di CSS (jangkar bawah-tengah atau atas-tengah). `dy` = geser piksel
   * vertikal tetap (mis. nama tepat di atas titik status, berapa pun zoomnya).
   */
  tambahLabel(el, x, h, y, ikut = null, { prioritas = 0, prioritasFn = null, dy = 0 } = {}) {
    const l = { el, isi: el.firstElementChild ?? el, pos: new THREE.Vector3(x, h, y), ikut, offset: h, prioritas, prioritasFn, dy };
    this.lapis.append(el); this.label.push(l);
    return l;
  }
  hapusLabel(l) { l.el.remove(); this.label.splice(this.label.indexOf(l), 1); }
  posisikanLabel() {
    const w = this.wadah.clientWidth, h = this.wadah.clientHeight, v = new THREE.Vector3();
    const tampil = [];
    for (const l of this.label) {
      if (l.el.hidden || (l.ikut && !l.ikut.visible)) continue;
      if (l.ikut) v.set(l.ikut.position.x, l.offset, l.ikut.position.z); else v.copy(l.pos);
      const jarak = v.distanceTo(this.camera.position);
      v.project(this.camera);
      if (!(v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15)) { l.el.style.visibility = "hidden"; continue; }
      l.px = (v.x * 0.5 + 0.5) * w; l.py = (-v.y * 0.5 + 0.5) * h + l.dy; l.jarak = jarak;
      tampil.push(l);
    }
    // baca semua ukuran dulu (satu kali tata letak), lalu tulis posisi
    for (const l of tampil) if (l.prioritas || l.prioritasFn) { const r = l.isi.getBoundingClientRect(); l.w = r.width; l.h = r.height; }
    // tabrakan (seperti simbol peta): label menurut prioritas (lalu jarak) mencoba posisinya sendiri, lalu digeser sedikit
    // ke atas/bawah; bila tetap bertumpuk baru disembunyikan. Label wajib (Menunggu Anda, kartu sentuh) berprioritas
    // tertinggi; nama = teks opsional, kalah lebih dulu dari titik status. Label tak berukuran (display: none) dilewati.
    const terpakai = [], kalah = new Set();
    const prio = (l) => l.prioritasFn?.() ?? l.prioritas;
    const urut = tampil.filter((l) => prio(l) > 0 && l.w > 0 && l.h > 0).sort((p, q) => (prio(q) - prio(p)) || p.jarak - q.jarak);
    const tumpuk = (r) => terpakai.some((q) => r.x0 < q.x1 - 1 && r.x1 > q.x0 + 1 && r.y0 < q.y1 - 1 && r.y1 > q.y0 + 1);
    for (const l of urut) {
      l.px = THREE.MathUtils.clamp(l.px, l.w / 2 + 4, Math.max(l.w / 2 + 4, w - l.w / 2 - 4));   // jangan terpotong tepi kanvas
      const bawah = l.el.classList.contains("tag");               // tag meja: jangkar di atas-tengah; lainnya bawah-tengah
      const kotak = (dy) => ({ x0: l.px - l.w / 2, x1: l.px + l.w / 2, y0: (bawah ? l.py : l.py - l.h) + dy, y1: (bawah ? l.py + l.h : l.py) + dy });
      const wajib = prio(l) >= 6;                                   // kartu sentuh: selalu tampil
      const coba = wajib ? [0] : bawah ? [0, l.h + 2, -(l.h + 2)] : [0, -(l.h + 2), -2 * (l.h + 2)];
      const dy = coba.find((d) => !tumpuk(kotak(d)));
      if (dy === undefined && !wajib) { kalah.add(l); continue; }
      l.py += dy ?? 0; terpakai.push(kotak(0));
    }
    for (const l of tampil) {
      l.el.style.visibility = kalah.has(l) ? "hidden" : "";
      l.el.style.transform = `translate(${l.px.toFixed(1)}px, ${l.py.toFixed(1)}px)`;
      l.el.style.zIndex = String(Math.max(1, 5000 - Math.round(l.jarak * 10)));   // selalu positif: tetap di atas kanvas
    }
  }
  /** Piksel per meter di pusat pandangan (ukuran keterbacaan). */
  skalaLantai() {
    const d = this.camera.position.distanceTo(this.kontrol.target);
    return this.wadah.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * d);
  }

  // ---------- pemilihan (klik meja/orang) ----------
  pasangPemilihan() {
    const ray = new THREE.Raycaster(), p = new THREE.Vector2(), el = this.renderer.domElement;
    const kena = (e) => {
      const r = el.getBoundingClientRect();
      p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, this.camera);
      const daftar = [...this.sasaran, ...[...this.orang].filter((o) => o.akar.visible).map((o) => o.sasaran)];
      return ray.intersectObjects(daftar, false)[0]?.object.userData.agen ?? null;
    };
    let turun = null;
    el.addEventListener("pointerdown", (e) => { turun = { x: e.clientX, y: e.clientY }; });
    el.addEventListener("pointerup", (e) => {
      if (!turun || Math.hypot(e.clientX - turun.x, e.clientY - turun.y) > 6 || this.digeser) { turun = null; return; }
      turun = null;
      this.onPilih(kena(e));
    });
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse" || !this.hover) return;
      if (this.hover !== this.dipilih) this.aturSorot(this.hover, 0);
      this.hover = null; el.style.cursor = ""; this.onHover?.(null);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      const nama = kena(e);
      if (nama !== this.hover) { if (this.hover && this.hover !== this.dipilih) this.aturSorot(this.hover, 0); this.hover = nama; if (nama && nama !== this.dipilih) this.aturSorot(nama, 1); this.onHover?.(nama); }
      el.style.cursor = nama ? "pointer" : "";
    });
  }
  pilih(nama) {
    if (this.dipilih) this.aturSorot(this.dipilih, 0);
    this.dipilih = nama;
    if (nama) this.aturSorot(nama, 2);
  }

  /** Daftarkan karakter: bayangan kontak + sasaran klik ikut objek. */
  daftarOrang(o, nama) {
    o.sasaran = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6).translate(0, 0.9, 0), new THREE.MeshBasicMaterial({ visible: false }));
    o.sasaran.userData.agen = nama; o.akar.add(o.sasaran);
    this.scene.add(o.akar); this.orang.add(o);
  }
  lepasOrang(o) { this.scene.remove(o.akar); this.orang.delete(o); }

  // ---------- gambar ----------
  mintaGambar() { this.perlu = true; }
  /** Satu langkah: animasi kamera, lalu gambar bila perlu. `adaGerak` = ada karakter/benda yang bergerak bingkai ini. */
  langkah(now, adaGerak) {
    this.ukur.bingkai++;
    if (this.terbang) {
      const u = Math.min(1, (now - this.terbang.t0) / 650), e = 1 - (1 - u) ** 3;
      this.camera.position.lerpVectors(this.terbang.dari, this.terbang.ke, e);
      this.kontrol.target.lerpVectors(this.terbang.dariT, this.terbang.keT, e);
      if (u >= 1) { this.terbang = null; this.kontrol.update(); }   // sinkronkan arah kamera ke titik pandang akhir
      this.perlu = true; this.onKamera?.();
    }
    if (this.kontrol.enableDamping && this.kontrol.update()) this.perlu = true;
    if (!this.perlu && !adaGerak) return false;
    this.perlu = false;
    const t0 = performance.now();
    let n = 0;
    for (const o of this.orang) if (o.akar.visible && n < this.blob.instanceMatrix.count) {
      this.blobM.makeScale(o.akar.scale.x, 1, o.akar.scale.x).setPosition(o.akar.position.x, 0.016, o.akar.position.z);
      this.blob.setMatrixAt(n++, this.blobM);
    }
    this.blob.count = n; this.blob.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.posisikanLabel();
    this.ukur.gambar++; this.ukur.msGambar += performance.now() - t0;
    return true;
  }
  aturHemat(hemat) { this.kontrol.enableDamping = !hemat; this.mintaGambar(); }
}
