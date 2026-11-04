// Karakter Kantor 3D — dibentuk dari bentuk dasar three.js (kapsul, bola, kotak), tanpa model unduhan.
// Satu karakter = Group berpivot di titik kaki; menghadap +Z lokal (rotation.y = 0 → menghadap depan denah / +y lantai).
// Pose: berdiri · jalan · duduk · ketik · baca · pikir · angkat · minum · duduk-santai (lihat aturPose).
import * as THREE from "three";

const G = {};   // geometri bersama (dibuat sekali)
function geo() {
  if (G.ok) return G;
  G.paha = new THREE.CapsuleGeometry(0.078, 0.3, 4, 10).translate(0, -0.19, 0);      // pivot di pinggul
  G.betis = new THREE.CapsuleGeometry(0.068, 0.34, 4, 10).translate(0, -0.2, 0);     // pivot di lutut
  G.sepatu = new THREE.BoxGeometry(0.11, 0.07, 0.22).translate(0, -0.42, 0.04);
  G.panggul = new THREE.CapsuleGeometry(0.15, 0.1, 4, 12).rotateZ(Math.PI / 2);
  G.badan = new THREE.CapsuleGeometry(0.19, 0.3, 6, 16);
  G.lengan = new THREE.CapsuleGeometry(0.055, 0.42, 4, 10).translate(0, -0.25, 0);   // pivot di bahu
  G.tangan = new THREE.SphereGeometry(0.058, 12, 8).translate(0, -0.52, 0);
  G.leher = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10);
  G.kepala = new THREE.SphereGeometry(0.135, 24, 18);
  G.mata = new THREE.SphereGeometry(0.017, 8, 6);
  G.tutupKepala = new THREE.SphereGeometry(0.145, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  G.belakangKepala = new THREE.SphereGeometry(0.146, 20, 14, Math.PI * 0.5, Math.PI, 0, Math.PI * 0.85);
  G.ikal = new THREE.SphereGeometry(0.065, 10, 8);
  G.kuncir = new THREE.SphereGeometry(0.06, 10, 8);
  G.rambutPanjang = new THREE.CapsuleGeometry(0.12, 0.18, 4, 12).scale(1.15, 1, 0.55);
  G.lensa = new THREE.TorusGeometry(0.03, 0.007, 6, 16);
  G.gagang = new THREE.TorusGeometry(0.145, 0.012, 6, 24, Math.PI);
  G.earcup = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14).rotateZ(Math.PI / 2);
  G.topi = new THREE.SphereGeometry(0.148, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  G.lidah = new THREE.BoxGeometry(0.2, 0.015, 0.12);
  G.tudung = new THREE.TorusGeometry(0.13, 0.05, 8, 16, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI);
  G.dasi = new THREE.BoxGeometry(0.045, 0.24, 0.02);
  G.kerah = new THREE.ConeGeometry(0.075, 0.13, 3).rotateX(Math.PI);
  G.kartu = new THREE.BoxGeometry(0.06, 0.08, 0.01);
  G.tali = new THREE.TorusGeometry(0.11, 0.006, 4, 16, Math.PI).rotateZ(Math.PI);
  G.kertas = new THREE.BoxGeometry(0.2, 0.012, 0.27);
  G.cangkir = new THREE.CylinderGeometry(0.04, 0.035, 0.09, 14);
  G.ok = true;
  return G;
}

const MAT = new Map();   // material bersama per warna & jenis
function mat(warna, { kasar = 0.75, logam = 0, emisif = null } = {}) {
  const k = `${warna}|${kasar}|${logam}|${emisif}`;
  if (!MAT.has(k)) MAT.set(k, new THREE.MeshStandardMaterial({ color: warna, roughness: kasar, metalness: logam, ...(emisif ? { emissive: emisif, emissiveIntensity: 0.4 } : {}) }));
  return MAT.get(k);
}
const KULIT = "#e9c4a8", CELANA = "#3a4756", SEPATU = "#2a2f36", MATA = "#22252b", JAS = "#2f3a46", KEMEJA = "#f2f2ee";
const gelapkan = (hex, f) => `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;

/**
 * Buat satu karakter. `t` = { warna, rambut, gaya, aksesori }. Kembalian: { akar, ... } — `akar` ditambahkan ke scene
 * oleh pemanggil; `aturPose(o, pose, waktu, gerak)` menggerakkan anggota badan.
 */
export function buatOrang(t, { skala = 1 } = {}) {
  const g = geo();
  const akar = new THREE.Group();
  akar.scale.setScalar(skala);
  const tubuh = new THREE.Group(); akar.add(tubuh);          // naik-turun saat duduk/jalan
  const warna = t.warna, baju = t.aksesori === "jas" ? JAS : warna;
  const mKulit = mat(KULIT, { kasar: 0.6 }), mCelana = mat(CELANA, { kasar: 0.85 }), mBaju = mat(baju, { kasar: 0.8 });
  const mLengan = mat(t.aksesori === "jas" ? JAS : gelapkan(warna, 0.86), { kasar: 0.8 }), mRambut = mat(t.rambut ?? "#2a2a2a", { kasar: 0.55 });
  const tambah = (induk, geom, m, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); induk.add(me); return me; };

  // kaki: paha (pivot pinggul y .88) + betis (pivot lutut)
  const kaki = [-1, 1].map((s) => {
    const paha = new THREE.Group(); paha.position.set(0.085 * s, 0.88, 0); tubuh.add(paha);
    tambah(paha, g.paha, mCelana);
    const lutut = new THREE.Group(); lutut.position.set(0, -0.4, 0); paha.add(lutut);
    tambah(lutut, g.betis, mCelana);
    tambah(lutut, g.sepatu, mat(SEPATU, { kasar: 0.5 }));
    return { paha, lutut };
  });
  tambah(tubuh, g.panggul, mCelana, 0, 0.9, 0);
  const atas = new THREE.Group(); atas.position.set(0, 0.92, 0); tubuh.add(atas);   // pinggang → atas badan
  const badan = tambah(atas, g.badan, mBaju, 0, 0.3, 0); badan.scale.set(1.12, 1, 0.74);
  // lengan (pivot bahu)
  const lengan = [-1, 1].map((s) => {
    const bahu = new THREE.Group(); bahu.position.set(0.245 * s, 0.5, 0); atas.add(bahu);
    tambah(bahu, g.lengan, mLengan);
    tambah(bahu, g.tangan, mKulit);
    return bahu;
  });
  tambah(atas, g.leher, mKulit, 0, 0.61, 0);
  const kepala = new THREE.Group(); kepala.position.set(0, 0.76, 0); atas.add(kepala);
  tambah(kepala, g.kepala, mKulit);
  for (const s of [-1, 1]) tambah(kepala, g.mata, mat(MATA, { kasar: 0.3 }), 0.048 * s, 0.015, 0.125);
  // rambut sesuai gaya
  const r = t.gaya;
  if (r !== "botak") {
    const tutup = tambah(kepala, g.tutupKepala, mRambut, 0, 0.012, -0.008);
    tutup.rotation.x = -0.32;
    tambah(kepala, g.belakangKepala, mRambut, 0, 0, -0.004);
  }
  if (r === "samping") { const p = tambah(kepala, g.ikal, mRambut, 0.07, 0.1, 0.06); p.scale.set(1.3, 0.6, 1); }
  if (r === "keriting") for (const [x, y, z] of [[-0.09, 0.09, 0.02], [0, 0.13, 0.03], [0.09, 0.09, 0.02], [-0.06, 0.1, -0.08], [0.06, 0.1, -0.08]]) tambah(kepala, g.ikal, mRambut, x, y, z);
  if (r === "kuncir") tambah(kepala, g.kuncir, mRambut, 0, 0.04, -0.17);
  if (r === "panjang") tambah(kepala, g.rambutPanjang, mRambut, 0, -0.1, -0.07);
  // aksesori
  const a = t.aksesori;
  if (a === "jas") {
    tambah(atas, g.kerah, mat(KEMEJA), 0, 0.47, 0.115).scale.set(1, 1, 0.4);
    tambah(atas, g.dasi, mat(warna, { kasar: 0.5 }), 0, 0.36, 0.145);
  }
  if (a === "dasi") tambah(atas, g.dasi, mat("#2a3340", { kasar: 0.5 }), 0, 0.36, 0.145);
  if (a === "kacamata") {
    for (const s of [-1, 1]) tambah(kepala, g.lensa, mat("#1d2228", { kasar: 0.3, logam: 0.6 }), 0.05 * s, 0.015, 0.132);
  }
  if (a === "headset") {
    tambah(kepala, g.gagang, mat("#2b333b", { kasar: 0.4 }), 0, 0.01, 0).rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) tambah(kepala, g.earcup, mat("#2b333b", { kasar: 0.4 }), 0.14 * s, 0, 0);
  }
  if (a === "topi") {
    tambah(kepala, g.topi, mat(gelapkan(warna, 0.75), { kasar: 0.7 }), 0, 0.03, 0);
    tambah(kepala, g.lidah, mat(gelapkan(warna, 0.75), { kasar: 0.7 }), 0, 0.05, 0.15);
  }
  if (a === "hoodie") tambah(atas, g.tudung, mat(gelapkan(warna, 0.7), { kasar: 0.85 }), 0, 0.56, -0.08);
  if (a === "lanyard") {
    tambah(atas, g.tali, mat("#e8e8e4"), 0, 0.5, 0.11).rotation.x = -0.25;
    tambah(atas, g.kartu, mat("#f6f6f2", { kasar: 0.4 }), 0, 0.37, 0.15);
  }
  // barang di tangan kanan (kertas/cangkir), ditukar saat perlu
  const barang = new THREE.Group(); barang.position.set(0, -0.56, 0.04); lengan[1].add(barang);
  const kertas = tambah(barang, g.kertas, mat("#fbfbf7", { kasar: 0.9 })); kertas.visible = false;
  const cangkir = tambah(barang, g.cangkir, mat("#f2eee8", { kasar: 0.35 })); cangkir.visible = false;

  akar.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return { akar, tubuh, atas, kaki, lengan, kepala, kertas, cangkir, pose: null };
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
  // badan
  o.tubuh.position.y = duduk ? -0.4 : pose === "jalan" && gerak ? Math.abs(Math.cos(w * 9)) * 0.025 : 0;
  o.atas.rotation.x = duduk ? -0.05 : pose === "jalan" ? 0.04 : 0;
  // kaki
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
