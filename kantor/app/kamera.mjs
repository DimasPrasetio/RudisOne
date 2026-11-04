// Kamera bawaan "Seluruh denah" — hitungan murni (THREE dioper sebagai argumen) agar dipakai adegan.mjs di peramban dan
// diuji Node (kantor/label.test.mjs memakai salinan three di kantor/vendor). DESAIN.md › Kamera & interaksi.

/**
 * Jarak & titik pandang agar seluruh denah (kotak dunia `kotak`) tepat masuk layar dan terpusat pada arah (az, polar).
 * `kotak` = { x: [x0, x1], y: [bawah, atas], z: [z0, z1] } dalam koordinat three.js (z = sumbu y denah, y = tinggi).
 * `ekstra` = titik [x, y, z] lain yang harus masuk layar. Kembalian: { jarak, target, batas, posisi } — `batas` = kotak proyeksi NDC sebelum geser terakhir (tinggi kanvas HP).
 */
export function hitungPas(THREE, { aspect, fov = 30, az, polar, kotak, ekstra = [] }) {
  const target = new THREE.Vector3((kotak.x[0] + kotak.x[1]) / 2, 0, (kotak.z[0] + kotak.z[1]) / 2), titik = [];
  for (const x of kotak.x) for (const z of kotak.z) for (const y of kotak.y) titik.push(new THREE.Vector3(x, y, z));
  for (const [x, y, z] of ekstra) titik.push(new THREE.Vector3(x, y, z));   // titik tambahan yang harus ikut masuk layar
  const arah = new THREE.Vector3().setFromSphericalCoords(1, polar, az), cam = new THREE.PerspectiveCamera(fov, aspect, 0.5, 300), v = new THREE.Vector3();
  const tempat = (d) => { cam.position.copy(target).addScaledVector(arah, d); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
  const ukurBatas = () => {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const p of titik) { v.copy(p).project(cam); b.x0 = Math.min(b.x0, v.x); b.x1 = Math.max(b.x1, v.x); b.y0 = Math.min(b.y0, v.y); b.y1 = Math.max(b.y1, v.y); }
    return b;
  };
  let jarak = 60, batas = null;
  for (let putaran = 0; putaran < 4; putaran++) {
    let lo = 5, hi = 400;
    for (let i = 0; i < 28; i++) {
      const m = (lo + hi) / 2; tempat(m); const b = ukurBatas();
      if (b.x1 - b.x0 < 1.9 && b.y1 - b.y0 < 1.86) hi = m; else lo = m;
    }
    jarak = hi; tempat(jarak);
    batas = ukurBatas();
    // geser titik pandang agar pusat kotak proyeksi di tengah layar, diproyeksikan ke lantai (sepanjang arah pandang)
    const cx = (batas.x0 + batas.x1) / 2, cy = (batas.y0 + batas.y1) / 2;
    const tinggiDunia = 2 * jarak * Math.tan(THREE.MathUtils.degToRad(fov / 2)), lebarDunia = tinggiDunia * aspect;
    const kanan = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), atas = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const geser = kanan.multiplyScalar(cx * lebarDunia / 2).add(atas.multiplyScalar(cy * tinggiDunia / 2));
    const t = geser.y / arah.y; geser.addScaledVector(arah, -t);
    target.add(geser);
  }
  return { jarak, target, batas, posisi: target.clone().addScaledVector(arah, jarak) };
}

/** Piksel kanvas paling banyak (≈ 4K): di atas itu rasio piksel diturunkan — layar penuh di monitor besar tetap lancar. */
export const PIKSEL_MAKS = 3840 * 2160;
/** Rasio piksel kanvas: devicePixelRatio, maks. 2 (HP/sentuh 1,5), dan lebar × tinggi × rasio² ≤ PIKSEL_MAKS (tidak di bawah 1 karena batas itu). */
export function rasioPiksel(w, h, dpr = globalThis.devicePixelRatio || 1, sentuh = globalThis.matchMedia?.("(pointer: coarse)").matches ?? false) {
  return Math.min(dpr, sentuh ? 1.5 : 2, Math.max(1, Math.sqrt(PIKSEL_MAKS / Math.max(1, w * h))));
}
