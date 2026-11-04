// Adegan Kantor 3D semi-realistis — ruangan, perabot, cahaya, kamera terbatas, label HTML di atas kanvas, dan pemilihan.
// Perabot statis digabung per material (sedikit draw call); bayangan perabot digambar sekali (shadow map statis);
// karakter memakai bayangan kontak palsu (blob) agar shadow map tidak perlu dihitung ulang tiap bingkai.
// Gambar ulang hanya bila ada yang berubah (kamera, gerak, data) — lihat `mintaGambar` / `adaGerak`.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DIVISI, JENDELA, KURSI, NOMOR_TIM, NX, NY, OX_TIM, PINTU, TINGGI_DINDING, TIM, WARNA_LOUNGE, ZONA, bangunDenah } from "./denah.mjs";

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
  },
  gelap: {
    lantai: "#1b2530", lorong: "#18212b", sisiLantai: "#0f161d", dinding: "#222d38", dindingAtas: "#2e3e4e",
    kayuLantai: "#5a4632", kayuTerang: "#5b4a3a", kayuGelap: "#4a3222", logam: "#59636e", logamGelap: "#2b3239",
    kain: "#3a4653", kulit: "#2a2421", sofa: "#3e5a70", partisi: "#2f3d4b", kaca: "#3c6684", karpet: "#2f2923",
    karpetLounge: "#2c2721", monitor: "#151a20", layarMati: "#0b1118", pot: "#7a5a42", daun: "#3f8a5a", daun2: "#33734b",
    bar: "#3a3029", batu: "#5a4f45", mesin: "#3d454d", rak: "#1a222a", putih: "#c9cdd2", jendela: "#28405a",
    langit: "#7f9cc4", tanah: "#1a1f26", hemi: 0.8, matahari: "#ffd9a8", kuatMatahari: 1.3, env: 0.3, cahayaJendela: "#7aa6d8", kuatCahayaJendela: 0.07,
  },
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
function teksturGrafik() {   // layar panel pemantauan IT Operations
  return kanvas(128, (g, n) => {
    g.fillStyle = "#0d1a14"; g.fillRect(0, 0, n, n);
    g.strokeStyle = "#34c38a"; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 8; i++) g.lineTo(8 + i * 14, 80 - ((i * 37) % 50));
    g.stroke(); g.fillStyle = "#2a7fff"; for (let i = 0; i < 5; i++) g.fillRect(12 + i * 22, 100, 14, 18 - i * 3);
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
      me.castShadow = bayang === "1"; me.receiveShadow = true;
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

// ---------------- perabot ----------------
/** Gambar satu perabot dari data denah ke pembangun `b`. Monitor (layar per meja) dikumpulkan ke `layar`. */
function gambarPerabot(b, o, layar) {
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
          if (sepanjangY) b.kotak(warna, x + 0.06, y + t, z, w - 0.14, tebal, tg); else b.kotak(warna, x + t, y + 0.08, z, tebal, d - 0.14, tg);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    m.cahayaJendela.color.set(p.cahayaJendela); m.cahayaJendela.opacity = p.kuatCahayaJendela;
    this.hemi.color.set(p.langit); this.hemi.groundColor.set(p.tanah); this.hemi.intensity = p.hemi;
    this.matahari.color.set(p.matahari); this.matahari.intensity = p.kuatMatahari;
    this.scene.environmentIntensity = p.env;
    for (const nama of Object.keys(this.layar)) this.aturLayar(nama, this.statusLayar?.[nama] ?? null);
    this.perbaruiBayangan();
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
    const b = new Pembangun(), pakaiMat = (k) => (k.startsWith("zona:") ? this.mat.zona[k.slice(5)] : this.mat[k]);
    // lantai: alas (lorong) + zona; tebal lantai (diorama)
    const lantai = (kunci, x0, y0, x1, y1, z = 0) => {
      const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (y1 - y0));
      b.tambah(kunci, g, (x0 + x1) / 2, z, (y0 + y1) / 2, { bayang: false });
    };
    lantai("lorong", 0, 0, NX, NY, 0);
    for (const [id, [x0, y0, x1, y1]] of Object.entries(ZONA)) lantai(`zona:${id}`, x0, y0, x1, y1, 0.004);
    b.kotak("sisiLantai", -0.22, -0.22, -0.45, NX + 0.22, NY + 0.22, 0.449, { bayang: false });
    for (const dk of this.denah.dekor) {
      if (dk.jenis === "karpet") lantai(dk.warna === "lounge" ? "karpetLounge" : "karpet", dk.x0, dk.y0, dk.x1, dk.y1, 0.012);
    }
    lantai("karpet", 0.9, 8.55, NX - 0.6, 9.45, 0.012);                            // karpet lorong
    lantai("kayuGelap", 0.3, PINTU[1] - 0.7, 1.3, PINTU[1] + 0.7, 0.014);           // keset
    // dinding belakang & kiri dengan jendela dan pintu
    gambarDinding(b, "x", NX, JENDELA.belakang.map(([a, c]) => ({ a, b: c, z0: 0.95, z1: 2.15 })));
    gambarDinding(b, "y", NY, [...JENDELA.kiri.map(([a, c]) => ({ a, b: c, z0: 0.95, z1: 2.15 })), { a: PINTU[1] - 0.8, b: PINTU[1] + 0.8, z0: 0, z1: 2.1 }]);
    // kusen jendela + kaca; bercak cahaya jendela di lantai
    const jendela = new THREE.Group();
    const kaca = (x, y, w, h, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat.jendela); m.position.set(x, 1.55, y); m.rotation.y = ry; jendela.add(m); };
    for (const [a, c] of JENDELA.belakang) {
      kaca((a + c) / 2, -0.12, c - a, 1.2, 0);
      b.kotak("dindingAtas", (a + c) / 2 - 0.03, -0.2, 0.95, 0.06, 0.16, 1.2);
      b.kotak("dindingAtas", a, -0.24, 0.9, c - a, 0.3, 0.05);
      this.bercakCahaya(jendela, [[a + 0.3, 0.3], [c + 0.3, 0.3], [c + 2.2, 3.6], [a + 2.2, 3.6]]);
    }
    for (const [a, c] of JENDELA.kiri) {
      kaca(-0.12, (a + c) / 2, c - a, 1.2, Math.PI / 2);
      b.kotak("dindingAtas", -0.2, (a + c) / 2 - 0.03, 0.95, 0.16, 0.06, 1.2);
      b.kotak("dindingAtas", -0.24, a, 0.9, 0.3, c - a, 0.05);
      this.bercakCahaya(jendela, [[0.3, a + 0.3], [0.3, c + 0.3], [3.3, c + 1.9], [3.3, a + 1.9]]);
    }
    // pintu masuk: kusen, daun pintu, tanda keluar
    const py = PINTU[1];
    b.kotak("kayuGelap", -0.26, py - 0.9, 0, 0.3, 0.1, 2.2); b.kotak("kayuGelap", -0.26, py + 0.8, 0, 0.3, 0.1, 2.2);
    b.kotak("kayuGelap", -0.26, py - 0.9, 2.1, 0.3, 1.8, 0.1);
    b.kotak("kayuTerang", -0.18, py - 0.8, 0, 0.06, 1.6, 2.08);
    b.kotak("logam", -0.1, py + 0.5, 0.95, 0.04, 0.16, 0.04, { bayang: false });
    const keluar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.62), new THREE.MeshBasicMaterial({ color: "#2fa86b", toneMapped: false }));
    keluar.position.set(0.02, 2.38, py); jendela.add(keluar);
    // dekor dinding: papan tulis tiap pod, papan strategi
    for (const dk of this.denah.dekor) {
      if (dk.jenis === "papan-tulis") {
        b.kotak("logam", dk.a - 0.03, 0, dk.z0 - 0.03, dk.b - dk.a + 0.06, 0.04, dk.z1 - dk.z0 + 0.06, { bayang: false });
        b.kotak("putih", dk.a, 0.02, dk.z0, dk.b - dk.a, 0.03, dk.z1 - dk.z0, { bayang: false });
        for (const [p, q, z] of [[0.3, 1.3, 0.7], [1.5, 2.5, 0.5], [0.4, 1.9, 0.3]]) b.kotak("tinta", dk.a + p, 0.051, dk.z0 + z, q - p, 0.005, 0.025, { bayang: false });
      }
      if (dk.jenis === "papan-strategi") {
        b.kotak("putih", 0, dk.a, dk.z0, 0.03, dk.b - dk.a, dk.z1 - dk.z0, { bayang: false });
        ["catatanBiru", "catatanHijau", "catatanKuning"].forEach((k, kol) => {
          for (let i = 0; i < 3 - (kol === 2); i++) b.kotak(k, 0.031, dk.a + 0.25 + kol * 1.1, dk.z1 - 0.3 - i * 0.32, 0.005, 0.7, 0.22, { bayang: false });
        });
      }
    }
    this.mat.tinta = new THREE.MeshBasicMaterial({ color: "#7c5cd6" });
    this.mat.catatanBiru = new THREE.MeshStandardMaterial({ color: "#1fa3ae", roughness: 0.8 });
    this.mat.catatanHijau = new THREE.MeshStandardMaterial({ color: "#3e9e5c", roughness: 0.8 });
    this.mat.catatanKuning = new THREE.MeshStandardMaterial({ color: "#e0b030", roughness: 0.8 });
    // perabot
    const layar = [];
    for (const o of this.denah.perabot) gambarPerabot(b, o, layar);
    this.statis = b.bentuk(pakaiMat);
    this.scene.add(this.statis, jendela);
    // layar monitor per meja (material sendiri: warna = status), panel grafik
    const gLayar = new THREE.PlaneGeometry(1, 1);
    for (const l of layar) {
      const m = new THREE.Mesh(gLayar, l.statis ? this.mat.grafik : new THREE.MeshBasicMaterial({ color: "#3a4652", toneMapped: false }));
      m.position.set(l.x, l.h, l.y); m.rotation.y = l.ry; m.scale.set(l.w, l.tinggi, 1);
      m.matrixAutoUpdate = false; m.updateMatrix();
      this.scene.add(m);
      if (l.agen) this.layar[l.agen] = m;
    }
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
  bercakCahaya(grup, [[ax, ay], [bx, by], [cx, cy], [dx, dy]]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([ax, 0.02, ay, bx, 0.02, by, cx, 0.02, cy, ax, 0.02, ay, cx, 0.02, cy, dx, 0.02, dy], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    grup.add(new THREE.Mesh(g, this.mat.cahayaJendela));
  }

  /** Warna layar monitor sesuai status: bekerja = menyala warna peran; berpikir/menunggu = redup; lainnya mati. */
  aturLayar(nama, status) {
    (this.statusLayar ??= {})[nama] = status;
    const m = this.layar[nama]; if (!m) return;
    const p = PALET[this.gelap ? "gelap" : "terang"], warna = new THREE.Color(TIM[nama].warna);
    if (status === "bekerja") m.material.color.copy(warna).lerp(new THREE.Color("#ffffff"), 0.35);
    else if (status === "berpikir" || status === "menunggu") m.material.color.set(p.layarMati).lerp(warna, 0.45);
    else m.material.color.set(p.layarMati);
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
    k.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    k.addEventListener("change", () => { this.batasiGeser(); this.mintaGambar(); this.onKamera?.(); });
    k.addEventListener("start", () => { this.digeser = false; this.kameraDiubah = true; this.awalGeser = this.camera.position.clone(); });
    k.addEventListener("end", () => { if (this.awalGeser && this.awalGeser.distanceTo(this.camera.position) > 0.05) { this.digeser = true; setTimeout(() => { this.digeser = false; }, 0); } });
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
    for (const x of [-0.25, NX]) for (const z of [-0.25, NY]) for (const y of [-0.45, TINGGI_DINDING]) titik.push(new THREE.Vector3(x, y, z));
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
    const tegak = w / h < 0.9;
    this.AZ = tegak ? Math.PI / 4 + 0.5 : Math.PI / 4;
    this.POLAR = tegak ? 0.8 : 1.01;
    this.kontrol.minAzimuthAngle = Math.PI / 4 - 0.52; this.kontrol.maxAzimuthAngle = Math.PI / 4 + 0.52;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.kontrol.maxDistance = this.jarakPas() * 1.2;
    if (!this.kameraDiubah) this.seluruhDenah(false);   // belum disentuh pengguna: tetap "Seluruh denah" untuk ukuran baru
    this.mintaGambar();
  }

  // ---------- label HTML ----------
  /**
   * Daftarkan elemen label yang mengikuti titik 3D (x lantai, tinggi, y lantai); `ikut` = objek yang diikuti (opsional).
   * `prioritas` untuk tabrakan (lebih tinggi menang; 0 = tidak diperiksa); `prioritasFn` bila berubah menurut status.
   * Isi label (`.isi`) diberi transform sendiri di CSS (jangkar bawah-tengah atau atas-tengah).
   */
  tambahLabel(el, x, h, y, ikut = null, { prioritas = 0, prioritasFn = null } = {}) {
    const l = { el, isi: el.firstElementChild ?? el, pos: new THREE.Vector3(x, h, y), ikut, offset: h, prioritas, prioritasFn };
    this.lapis.append(el); this.label.push(l);
    return l;
  }
  hapusLabel(l) { l.el.remove(); this.label.splice(this.label.indexOf(l), 1); }
  posisikanLabel() {
    const w = this.wadah.clientWidth, h = this.wadah.clientHeight, v = new THREE.Vector3();
    // tingkat rincian: tag meja ringkas saat jauh (HP / seluruh denah) — diatur sebelum ukuran label dibaca
    this.lapis.classList.toggle("jauh", this.skalaLantai() <= 26);
    const tampil = [];
    for (const l of this.label) {
      if (l.el.hidden || (l.ikut && !l.ikut.visible)) continue;
      if (l.ikut) v.set(l.ikut.position.x, l.offset, l.ikut.position.z); else v.copy(l.pos);
      const jarak = v.distanceTo(this.camera.position);
      v.project(this.camera);
      if (!(v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15)) { l.el.style.visibility = "hidden"; continue; }
      l.px = (v.x * 0.5 + 0.5) * w; l.py = (-v.y * 0.5 + 0.5) * h; l.jarak = jarak;
      tampil.push(l);
    }
    // baca semua ukuran dulu (satu kali tata letak), lalu tulis posisi
    for (const l of tampil) if (l.prioritas || l.prioritasFn) { const r = l.isi.getBoundingClientRect(); l.w = r.width; l.h = r.height; }
    // tabrakan: label berprioritas lebih tinggi (lalu lebih dekat ke kamera) menang; yang kalah disembunyikan
    const terpakai = [];
    const urut = tampil.filter((l) => l.prioritas || l.prioritasFn).sort((p, q) => ((q.prioritasFn?.() ?? q.prioritas) - (p.prioritasFn?.() ?? p.prioritas)) || p.jarak - q.jarak);
    const kalah = new Set();
    for (const l of urut) {
      l.px = THREE.MathUtils.clamp(l.px, l.w / 2 + 4, Math.max(l.w / 2 + 4, w - l.w / 2 - 4));   // jangan terpotong tepi kanvas
      const bawah = l.el.classList.contains("tag");               // tag meja: jangkar di atas-tengah; lainnya bawah-tengah
      const r = { x0: l.px - l.w / 2, x1: l.px + l.w / 2, y0: bawah ? l.py : l.py - l.h, y1: bawah ? l.py + l.h : l.py };
      if (terpakai.some((q) => r.x0 < q.x1 - 1 && r.x1 > q.x0 + 1 && r.y0 < q.y1 - 1 && r.y1 > q.y0 + 1)) { kalah.add(l); continue; }
      terpakai.push(r);
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
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      const nama = kena(e);
      if (nama !== this.hover) { if (this.hover && this.hover !== this.dipilih) this.aturSorot(this.hover, 0); this.hover = nama; if (nama && nama !== this.dipilih) this.aturSorot(nama, 1); }
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
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75).rotateX(-Math.PI / 2), this.mat.blob);
    blob.position.y = 0.015; o.akar.add(blob);
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
      if (u >= 1) this.terbang = null;
      this.perlu = true; this.onKamera?.();
    }
    if (this.kontrol.enableDamping && this.kontrol.update()) this.perlu = true;
    if (!this.perlu && !adaGerak) return false;
    this.perlu = false;
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.posisikanLabel();
    this.ukur.gambar++; this.ukur.msGambar += performance.now() - t0;
    return true;
  }
  aturHemat(hemat) { this.kontrol.enableDamping = !hemat; this.mintaGambar(); }
}
