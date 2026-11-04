// Karakter Kantor 3D — dibentuk dari bentuk dasar three.js (kapsul, bola, kotak), tanpa model unduhan.
// Satu karakter = SATU SkinnedMesh (semua bagian digabung, warna per titik, tiap bagian terikat kaku ke satu tulang) →
// satu draw call per orang berapa pun banyak bagiannya. Tulang punya nama yang sama dengan bagian badan (tubuh, paha,
// lutut, atas, lengan, kepala) sehingga pose diatur seperti objek biasa.
// Group `akar` berpivot di titik kaki; menghadap +Z lokal (rotation.y = 0 → menghadap depan denah / +y lantai).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const G = {};   // geometri bentuk dasar (dibuat sekali)
function geo() {
  if (G.ok) return G;
  G.paha = new THREE.CapsuleGeometry(0.078, 0.3, 4, 10).translate(0, -0.19, 0);      // pivot di pinggul
  G.betis = new THREE.CapsuleGeometry(0.068, 0.34, 4, 10).translate(0, -0.2, 0);     // pivot di lutut
  G.sepatu = new THREE.BoxGeometry(0.11, 0.07, 0.22).translate(0, -0.42, 0.04);
  G.panggul = new THREE.CapsuleGeometry(0.15, 0.1, 4, 12).rotateZ(Math.PI / 2);
  G.badan = new THREE.CapsuleGeometry(0.19, 0.3, 6, 16).scale(1.12, 1, 0.74);
  G.lengan = new THREE.CapsuleGeometry(0.055, 0.42, 4, 10).translate(0, -0.25, 0);   // pivot di bahu
  G.tangan = new THREE.SphereGeometry(0.058, 12, 8).translate(0, -0.52, 0);
  G.leher = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10);
  G.kepala = new THREE.SphereGeometry(0.135, 24, 18);
  G.mata = new THREE.SphereGeometry(0.017, 8, 6);
  G.tutupKepala = new THREE.SphereGeometry(0.145, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateX(-0.32);
  G.belakangKepala = new THREE.SphereGeometry(0.146, 20, 14, Math.PI * 0.5, Math.PI, 0, Math.PI * 0.85);
  G.ikal = new THREE.SphereGeometry(0.065, 10, 8);
  G.kuncir = new THREE.SphereGeometry(0.06, 10, 8);
  G.rambutPanjang = new THREE.CapsuleGeometry(0.12, 0.18, 4, 12).scale(1.15, 1, 0.55);
  G.lensa = new THREE.TorusGeometry(0.03, 0.007, 6, 16);
  G.gagang = new THREE.TorusGeometry(0.145, 0.012, 6, 24, Math.PI).rotateY(Math.PI / 2);
  G.earcup = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14).rotateZ(Math.PI / 2);
  G.topi = new THREE.SphereGeometry(0.148, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  G.lidah = new THREE.BoxGeometry(0.2, 0.015, 0.12);
  G.tudung = new THREE.TorusGeometry(0.13, 0.05, 8, 16, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI);
  G.dasi = new THREE.BoxGeometry(0.045, 0.24, 0.02);
  G.kerah = new THREE.ConeGeometry(0.075, 0.13, 3).rotateX(Math.PI).scale(1, 1, 0.4);
  G.kartu = new THREE.BoxGeometry(0.06, 0.08, 0.01);
  G.tali = new THREE.TorusGeometry(0.11, 0.006, 4, 16, Math.PI).rotateZ(Math.PI).rotateX(-0.25);
  G.kertas = new THREE.BoxGeometry(0.2, 0.012, 0.27);
  G.cangkir = new THREE.CylinderGeometry(0.04, 0.035, 0.09, 14);
  G.cincin = new THREE.RingGeometry(0.42, 0.52, 40).rotateX(-Math.PI / 2);
  G.ok = true;
  return G;
}

/** Material bersama: semua orang memakai satu material (warna per titik) → program shader sama, draw call per orang = 1. */
const BAHAN = {};
function bahan() {
  BAHAN.badan ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  BAHAN.kertas ??= new THREE.MeshStandardMaterial({ color: "#fbfbf7", roughness: 0.9 });
  BAHAN.cangkir ??= new THREE.MeshStandardMaterial({ color: "#f2eee8", roughness: 0.35 });
  BAHAN.cincin ??= new THREE.MeshBasicMaterial({ color: "#d9930b", toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  return BAHAN;
}
const KULIT = "#e9c4a8", CELANA = "#3a4756", SEPATU = "#2a2f36", MATA = "#22252b", JAS = "#2f3a46", KEMEJA = "#f2f2ee";
const gelapkan = (hex, f) => `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;

/**
 * Buat satu karakter. `t` = { warna, rambut, gaya, aksesori }. Kembalian: { akar, tubuh, atas, kaki, lengan, kepala, … } —
 * `akar` ditambahkan ke scene oleh pemanggil; `aturPose(o, pose, waktu, gerak)` menggerakkan tulang.
 */
export function buatOrang(t, { skala = 1 } = {}) {
  const g = geo(), b = bahan();
  const tulang = [], bagian = [];   // bagian: { geom, warna, tulang (indeks), x, y, z }
  const buatTulang = (induk, x, y, z) => { const t2 = new THREE.Bone(); t2.position.set(x, y, z); if (induk) induk.add(t2); tulang.push(t2); return t2; };
  const tambah = (tl, geom, warna, x = 0, y = 0, z = 0) => bagian.push({ geom, warna, tl: tulang.indexOf(tl), x, y, z });

  const tubuh = buatTulang(null, 0, 0, 0);                   // akar tulang: naik-turun saat duduk/jalan
  const warna = t.warna, baju = t.aksesori === "jas" ? JAS : warna;
  const lenganWarna = t.aksesori === "jas" ? JAS : gelapkan(warna, 0.86), rambut = t.rambut ?? "#2a2a2a";
  const kaki = [-1, 1].map((s) => {
    const paha = buatTulang(tubuh, 0.085 * s, 0.88, 0); tambah(paha, g.paha, CELANA);
    const lutut = buatTulang(paha, 0, -0.4, 0); tambah(lutut, g.betis, CELANA); tambah(lutut, g.sepatu, SEPATU);
    return { paha, lutut };
  });
  tambah(tubuh, g.panggul, CELANA, 0, 0.9, 0);
  const atas = buatTulang(tubuh, 0, 0.92, 0);               // pinggang → atas badan
  tambah(atas, g.badan, baju, 0, 0.3, 0);
  const lengan = [-1, 1].map((s) => {
    const bahu = buatTulang(atas, 0.245 * s, 0.5, 0);
    tambah(bahu, g.lengan, lenganWarna); tambah(bahu, g.tangan, KULIT);
    return bahu;
  });
  tambah(atas, g.leher, KULIT, 0, 0.61, 0);
  const kepala = buatTulang(atas, 0, 0.76, 0);
  tambah(kepala, g.kepala, KULIT);
  for (const s of [-1, 1]) tambah(kepala, g.mata, MATA, 0.048 * s, 0.015, 0.125);
  const r = t.gaya;
  if (r !== "botak") { tambah(kepala, g.tutupKepala, rambut, 0, 0.012, -0.008); tambah(kepala, g.belakangKepala, rambut, 0, 0, -0.004); }
  if (r === "samping") tambah(kepala, g.ikal.clone().scale(1.3, 0.6, 1), rambut, 0.07, 0.1, 0.06);
  if (r === "keriting") for (const [x, y, z] of [[-0.09, 0.09, 0.02], [0, 0.13, 0.03], [0.09, 0.09, 0.02], [-0.06, 0.1, -0.08], [0.06, 0.1, -0.08]]) tambah(kepala, g.ikal, rambut, x, y, z);
  if (r === "kuncir") tambah(kepala, g.kuncir, rambut, 0, 0.04, -0.17);
  if (r === "panjang") tambah(kepala, g.rambutPanjang, rambut, 0, -0.1, -0.07);
  const a = t.aksesori;
  if (a === "jas") { tambah(atas, g.kerah, KEMEJA, 0, 0.47, 0.115); tambah(atas, g.dasi, warna, 0, 0.36, 0.145); }
  if (a === "dasi") tambah(atas, g.dasi, "#2a3340", 0, 0.36, 0.145);
  if (a === "kacamata") for (const s of [-1, 1]) tambah(kepala, g.lensa, "#1d2228", 0.05 * s, 0.015, 0.132);
  if (a === "headset") { tambah(kepala, g.gagang, "#2b333b", 0, 0.01, 0); for (const s of [-1, 1]) tambah(kepala, g.earcup, "#2b333b", 0.14 * s, 0, 0); }
  if (a === "topi") { tambah(kepala, g.topi, gelapkan(warna, 0.75), 0, 0.03, 0); tambah(kepala, g.lidah, gelapkan(warna, 0.75), 0, 0.05, 0.15); }
  if (a === "hoodie") tambah(atas, g.tudung, gelapkan(warna, 0.7), 0, 0.56, -0.08);
  if (a === "lanyard") { tambah(atas, g.tali, "#e8e8e4", 0, 0.5, 0.11); tambah(atas, g.kartu, "#f6f6f2", 0, 0.37, 0.15); }

  // gabungkan semua bagian ke ruang model pada pose ikat (bind pose), ikat kaku ke tulangnya
  tubuh.updateMatrixWorld(true);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  const geoms = bagian.map((p) => {
    const gg = (p.geom.index ? p.geom.toNonIndexed() : p.geom.clone());
    for (const n of Object.keys(gg.attributes)) if (!["position", "normal"].includes(n)) gg.deleteAttribute(n);
    gg.applyMatrix4(m.makeTranslation(p.x, p.y, p.z)).applyMatrix4(tulang[p.tl].matrixWorld);
    const n = gg.attributes.position.count, warnaT = new Float32Array(n * 3), idx = new Uint16Array(n * 4), bobot = new Float32Array(n * 4);
    c.set(p.warna);
    for (let i = 0; i < n; i++) { warnaT.set([c.r, c.g, c.b], i * 3); idx[i * 4] = p.tl; bobot[i * 4] = 1; }
    gg.setAttribute("color", new THREE.BufferAttribute(warnaT, 3));
    gg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
    gg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(bobot, 4));
    return gg;
  });
  const gabung = mergeGeometries(geoms);
  for (const gg of geoms) gg.dispose();
  const mesh = new THREE.SkinnedMesh(gabung, b.badan);
  mesh.add(tubuh);
  mesh.bind(new THREE.Skeleton(tulang));
  mesh.frustumCulled = false;     // bola batas pose ikat tidak ikut pose; orang kecil & sedikit
  const akar = new THREE.Group(); akar.scale.setScalar(skala); akar.add(mesh);
  // barang di tangan kanan (kertas/cangkir) — mesh kecil terpisah, hanya digambar saat dibawa
  const barang = new THREE.Group(); barang.position.set(0, -0.56, 0.04); lengan[1].add(barang);
  const kertas = new THREE.Mesh(g.kertas, b.kertas); kertas.visible = false; barang.add(kertas);
  const cangkir = new THREE.Mesh(g.cangkir, b.cangkir); cangkir.visible = false; barang.add(cangkir);
  // cincin lantai "menunggu Anda" (status terbaca tanpa animasi: warna + bentuk)
  const cincin = new THREE.Mesh(g.cincin, b.cincin); cincin.position.y = 0.03; cincin.visible = false; cincin.renderOrder = 1; akar.add(cincin);
  return { akar, mesh, tubuh, atas, kaki, lengan, kepala, kertas, cangkir, cincin, pose: null };
}

/** Barang yang dibawa: null | "kertas" | "cangkir". */
export function aturBarang(o, jenis) {
  o.kertas.visible = jenis === "kertas";
  o.cangkir.visible = jenis === "cangkir";
}

/** Pose anggota badan. `w` = detik berjalan (fase gerak), `gerak` = animasi kecil diizinkan (bukan hemat gerak). */
export function aturPose(o, pose, w = 0, gerak = true) {
  const [ki, ka] = o.kaki, [lKi, lKa] = o.lengan;
  const duduk = ["duduk", "ketik", "baca", "pikir", "angkat", "duduk-santai"].includes(pose);
  const ayun = pose === "jalan" && gerak ? Math.sin(w * 9) : 0;
  o.tubuh.position.y = duduk ? -0.4 : pose === "jalan" && gerak ? Math.abs(Math.cos(w * 9)) * 0.025 : 0;
  o.atas.rotation.x = duduk ? -0.05 : pose === "jalan" ? 0.04 : 0;
  if (duduk) {
    for (const k of [ki, ka]) { k.paha.rotation.x = -Math.PI / 2 + 0.05; k.lutut.rotation.x = Math.PI / 2 - 0.05; }
  } else {
    ki.paha.rotation.x = ayun * 0.5; ka.paha.rotation.x = -ayun * 0.5;
    ki.lutut.rotation.x = Math.max(0, -ayun) * 0.6; ka.lutut.rotation.x = Math.max(0, ayun) * 0.6;
  }
  // lengan: rotation.x negatif = ke depan
  let kiri = 0.05, kanan = 0.05, kiriZ = 0.08, kananZ = -0.08;
  switch (pose) {
    case "jalan": kiri = -ayun * 0.45; kanan = ayun * 0.45; break;
    case "ketik": { const k = gerak ? Math.sin(w * 14) * 0.06 : 0; kiri = -1.15 + k; kanan = -1.15 - k; kiriZ = -0.25; kananZ = 0.25; break; }
    case "baca": kiri = -1.3; kanan = -1.3; kiriZ = -0.3; kananZ = 0.3; break;
    case "pikir": kiri = 0.05; kanan = -2.35; kananZ = 0.55; break;
    case "angkat": kiri = 0.05; kanan = -2.95 + (gerak ? Math.sin(w * 5) * 0.12 : 0); kananZ = -0.15; break;
    case "minum": case "duduk-santai": kanan = o.cangkir.visible ? -1.2 - (gerak ? Math.max(0, Math.sin(w * 0.9)) * 0.7 : 0) : 0.05; kananZ = 0.2; kiri = duduk ? -0.5 : 0.05; break;
    case "duduk": kiri = -0.55; kanan = -0.55; break;
    default: if (o.kertas.visible) { kanan = -1.0; kananZ = 0.1; }
  }
  lKi.rotation.set(kiri, 0, kiriZ); lKa.rotation.set(kanan, 0, kananZ);
  o.kepala.rotation.x = pose === "baca" ? 0.25 : pose === "pikir" ? -0.15 : 0;
  o.pose = pose;
}

/** Cincin lantai "menunggu Anda". */
export function aturCincin(o, tampak) { o.cincin.visible = tampak; }
