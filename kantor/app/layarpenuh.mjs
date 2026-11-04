// Tombol "Layar penuh" untuk denah 3D (kantor/DESAIN.md › Layar penuh). Tanpa DOM global: elemen & dokumen dioper,
// sehingga logikanya diuji di Node (kantor/layarpenuh.test.mjs).
// - Fullscreen API (juga awalan webkit untuk Safari iPad/Mac lama) pada wadah denah — kontrol ikut tampil karena ada di dalamnya.
// - Mode cadangan bila API tidak ada atau ditolak (mis. Safari iPhone): wadah diperbesar memenuhi jendela (kelas CSS),
//   gulir halaman dikunci, Esc atau tombol yang sama untuk keluar.

/** Teks tombol: tampil (pendek), label aksesibel (memuat teks tampil — WCAG 2.5.3), dan keterangan saat diarahkan. */
export const TEKS_LAYAR_PENUH = Object.freeze({
  masuk: Object.freeze({ teks: "Layar penuh", label: "Layar penuh", judul: "Tampilkan denah memenuhi layar" }),
  keluar: Object.freeze({ teks: "Keluar", label: "Keluar dari layar penuh", judul: "Keluar dari layar penuh (Esc)" }),
});

/** Elemen yang sedang layar penuh (standar atau awalan webkit), atau null. */
export const elemenLayarPenuh = (doc) => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

/** Fullscreen API tersedia dan diizinkan untuk elemen ini? */
export function dukungLayarPenuh(doc, el) {
  const diizinkan = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  return Boolean(diizinkan) && typeof (el.requestFullscreen ?? el.webkitRequestFullscreen) === "function";
}

/**
 * Pasang perilaku tombol layar penuh.
 * @param {{ wadah: HTMLElement, tombol: HTMLButtonElement, doc?: Document, akar?: HTMLElement, paksaCadangan?: boolean,
 *           onUbah?: (aktif: boolean, mode: "asli"|"cadangan"|null) => void }} opsi
 * @returns {{ alih: () => Promise<void>, masuk: () => Promise<void>, keluar: () => Promise<void>, readonly mode: string|null,
 *             readonly aktif: boolean }}
 */
export function pasangLayarPenuh({ wadah, tombol, doc = document, akar = doc.documentElement, paksaCadangan = false, onUbah = () => {} }) {
  let mode = null;   // null | "asli" (Fullscreen API) | "cadangan" (memenuhi jendela)
  const elTeks = tombol.querySelector(".teks");

  function tulisTombol() {
    const t = mode ? TEKS_LAYAR_PENUH.keluar : TEKS_LAYAR_PENUH.masuk;
    if (elTeks) elTeks.textContent = t.teks;
    tombol.setAttribute("aria-label", t.label);
    tombol.title = t.judul;
  }
  let gulirAwal = 0;   // mode cadangan: posisi gulir halaman dikembalikan saat keluar (layar penuh asli: peramban sendiri)
  function terapkan(baru) {
    if (baru === mode) return;
    const win = doc.defaultView;
    if (baru === "cadangan") gulirAwal = win?.scrollY ?? 0;
    const dariCadangan = mode === "cadangan";
    mode = baru;
    wadah.classList.toggle("layar-penuh", mode !== null);
    wadah.classList.toggle("layar-penuh-cadangan", mode === "cadangan");
    akar.classList.toggle("kunci-gulir", mode === "cadangan");   // halaman di belakang tidak ikut tergulir
    if (dariCadangan) win?.scrollTo?.(0, gulirAwal);
    tulisTombol();
    onUbah(mode !== null, mode);
  }

  // Permintaan layar penuh sedang berjalan. Safari lama (awalan webkit saja) tidak mengembalikan promise: hasilnya datang
  // lewat event *fullscreenchange (berhasil) atau *fullscreenerror (ditolak) — sampai itu, tetap menunggu.
  let menunggu = false;
  async function masuk() {
    if (mode || menunggu) return;
    if (paksaCadangan || !dukungLayarPenuh(doc, wadah)) { terapkan("cadangan"); return; }
    menunggu = true;
    try {
      const minta = wadah.requestFullscreen ?? wadah.webkitRequestFullscreen;
      await minta.call(wadah, { navigationUI: "hide" });
    } catch {   // ditolak peramban (izin, iframe, gestur) → mode cadangan
      menunggu = false; terapkan("cadangan"); return;
    }
    if (elemenLayarPenuh(doc) === wadah) { menunggu = false; terapkan("asli"); }   // event change juga memanggil ini (idempoten)
  }
  async function keluar() {
    if (mode === "asli" && elemenLayarPenuh(doc)) {
      const lepas = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      try { await lepas.call(doc); } catch { /* sudah keluar */ }
    }
    terapkan(null);
  }
  const alih = () => (mode ? keluar() : masuk());

  // keluar lewat peramban (Esc, gestur, tombol sistem) → kembalikan tampilan
  const berubah = () => {
    if (elemenLayarPenuh(doc) === wadah) { menunggu = false; terapkan("asli"); }
    else if (mode === "asli") terapkan(null);
  };
  doc.addEventListener("fullscreenchange", berubah);
  doc.addEventListener("webkitfullscreenchange", berubah);
  // penolakan lewat event (Safari lama tidak melempar galat) → mode cadangan
  const ditolak = () => { if (menunggu && !mode) { menunggu = false; terapkan("cadangan"); } };
  doc.addEventListener("fullscreenerror", ditolak);
  doc.addEventListener("webkitfullscreenerror", ditolak);
  // Esc keluar. Layar penuh asli: peramban biasanya menanganinya sendiri (keydown tidak sampai) — bila sampai (mis. tanpa
  // UI peramban), halaman yang keluar. Mode cadangan: selalu di sini. Ditangkap lebih dulu (capture) dan tidak diteruskan:
  // Esc di sini HANYA keluar — pilihan orang & kartu tetap. Enter/Spasi/klik/ketuk = perilaku bawaan <button>.
  doc.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mode) { e.preventDefault(); e.stopPropagation(); keluar(); }
  }, true);
  tombol.addEventListener("click", () => { alih(); });
  tulisTombol();

  return { alih, masuk, keluar, get mode() { return mode; }, get aktif() { return mode !== null; } };
}
