// Kantor RudisOne — halaman pemantauan: data dari server (SSE /events), panel samping, dan denah 3D (adegan.mjs).
// Perilaku orang mengikuti status & pesan (DESAIN.md › Cerita gerak); jalur dihitung di grid lantai (denah.mjs).
import { CHIEF, DIVISI, KURSI, NOMOR_TIM, PINTU, TIM, URUT, atasanDari, bangunGrid, cariJalur, hadapMeja, kursiTim, pusat, selBebas } from "./denah.mjs";

const SIMBOL = { bekerja: "▶", berpikir: "…", menunggu: "!", santai: "–", absen: "", katalog: "" };
const LABEL_STATUS = { bekerja: "Bekerja", berpikir: "Berpikir", menunggu: "Menunggu Anda", santai: "Siaga", absen: "Belum masuk", katalog: "Katalog, dipanggil saat perlu" };
/** Keadaan peran dari server (aktif · siaga · katalog · absen); server lama/mode demo tanpa `mode` → diturunkan dari status. */
const modeDari = (ag) => ag.mode ?? (!ag.present ? "absen" : ag.status === "santai" ? "siaga" : "aktif");
/** Kelas tampilan: status kerja saat hadir; peran katalog dibedakan dari sesi tetap yang belum masuk. */
const kelasDari = (ag) => (ag.present ? ag.status : modeDari(ag) === "katalog" ? "katalog" : "absen");
const PARAM = new URLSearchParams(location.search);
let HEMAT_GERAK = matchMedia("(prefers-reduced-motion: reduce)").matches;
try { if (localStorage.getItem("kantor-jeda") === "1") HEMAT_GERAK = true; } catch { /* penyimpanan tidak tersedia */ }

// ================= util =================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const potong = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? "");
const fmtJam = (ts) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(ts);
const acak = (a, b) => a + Math.random() * (b - a);
const pilihAcak = (xs) => xs[Math.floor(Math.random() * xs.length)];
function lalu(ts) {
  if (!ts) return "";
  const d = Math.max(0, (Date.now() - ts) / 1000);
  if (d < 60) return "baru saja";
  if (d < 3600) return `${Math.floor(d / 60)} mnt lalu`;
  return `${Math.floor(d / 3600)} jam lalu`;
}
const div = (kelas, html = "") => { const e = document.createElement("div"); e.className = kelas; e.innerHTML = html; return e; };
const sudutBeda = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ================= adegan 3D (atau pesan tanpa WebGL) =================
const elPanggung = document.getElementById("panggung"), elLapis = document.getElementById("lapis-label");
let adegan = null, O3 = null;
const elTanpa3d = document.getElementById("tanpa-3d");
async function siapkanAdegan() {
  const { Adegan, adaWebGL2 } = await import("./adegan.mjs");
  if (PARAM.has("uji-tanpa-webgl") || !adaWebGL2()) throw new Error("WebGL2 tidak tersedia");
  O3 = await import("./orang.mjs");
  adegan = new Adegan({ wadah: elPanggung, kanvas: document.getElementById("kanvas"), lapis: elLapis, hemat: () => HEMAT_GERAK,
    onPilih: (nama) => pilih(nama && dipilih === nama ? null : nama) });
  adegan.hilang = () => tampilkanTanpa3d("Grafis 3D berhenti (konteks WebGL hilang). Muat ulang halaman untuk menampilkan denah lagi.");
}
function tampilkanTanpa3d(alasan) {
  elPanggung.hidden = true; elTanpa3d.hidden = false;
  if (alasan) elTanpa3d.querySelector(".alasan").textContent = alasan;
  document.getElementById("petunjuk").hidden = true;
  for (const id of ["zoom-kecil", "zoom-besar", "zoom-pas", "putar-kiri", "putar-kanan"]) document.getElementById(id).disabled = true;
}

// ================= denah: grid jalan, kursi, tempat santai =================
let DENAH = null, BLOK = null;
const jalur = (a, b) => cariJalur(BLOK, a, b) ?? [b];
const bebasDekat = (x, y) => pusat(...selBebas(BLOK, x, y));

// ================= meja (tag HTML di atas lantai) =================
const MEJA = {};   // nama → { tag, namaT, aksiT }
function bangunMeja() {
  for (const nama of URUT) {
    const t = TIM[nama], k = KURSI[nama], [sx, sy] = k.duduk;
    const tag = document.createElement("button");
    tag.type = "button"; tag.className = "tag absen"; tag.style.setProperty("--warna", t.warna); tag.dataset.agen = nama;
    tag.innerHTML = `<span class="isi"><span class="nama-meja"><i class="simbol absen" aria-hidden="true"></i><b></b></span><span class="aksi-meja"></span></span>`;
    tag.addEventListener("click", () => pilih(dipilih === nama ? null : nama));
    const namaT = tag.querySelector("b"), aksiT = tag.querySelector(".aksi-meja"), simbol = tag.querySelector(".simbol");
    namaT.textContent = t.pendek;
    const depan = k.pimpinan ? sy + 2.0 : sy + 0.6;     // tepi depan meja (pimpinan: mejanya di depan kursi)
    adegan?.tambahLabel(tag, sx, 0, depan, null, { prioritasFn: () => (tag.classList.contains("menunggu") || tag.classList.contains("dipilih") ? 4 : 2) });
    MEJA[nama] = { tag, namaT, aksiT, simbol };
  }
}
function papanZona() {
  const PAPAN = {};
  const tambah = (id, dv, [x, h, y]) => {
    const el = div("papan-zona", `<span class="isi"><i aria-hidden="true"></i><span><b>${esc(dv.nama)}</b><small>${esc(dv.sub ?? "")}</small></span></span>`);
    el.style.setProperty("--warna", dv.warna);
    adegan?.tambahLabel(el, x, h, y, null, { prioritas: 2.2 });   // di atas tag meja: struktur organisasi selalu terbaca
    PAPAN[id] = { el, sub: el.querySelector("small") };
  };
  tambah("pimpinan", DIVISI[0], [4.1, 3.3, 0]);
  tambah("corp", DIVISI[1], [0, 3.3, 15.6]);
  for (const n of NOMOR_TIM) tambah(`tim${n}`, DIVISI.find((d) => d.tim === n), [{ 1: 13.5, 2: 24, 3: 34.6 }[n], 3.3, 0]);
  tambah("bersama", DIVISI.find((d) => d.id === "bersama"), [14.25, 0, 20.9]);
  tambah("ops", DIVISI.find((d) => d.id === "ops"), [21.5, 0, 20.9]);
  tambah("lounge", { nama: "Lounge", sub: "Kopi, sofa, ngobrol", warna: "#d39a5b" }, [32.8, 0, 20.9]);
  return PAPAN;
}

// ================= karakter =================
const ORANG = {};
/** Satu karakter (anggota tetap atau asisten). `t` = data tampilan: warna, rambut, pendek, gaya, aksesori. */
function buatOrang(nama, t, skala = 1) {
  const m = O3 ? O3.buatOrang(t, { skala }) : null;
  const kepala = div("kepala-label", `<span class="isi"><i class="simbol santai" aria-hidden="true"></i><span class="nama-orang"></span></span>`);
  kepala.style.setProperty("--warna", t.warna);
  kepala.querySelector(".nama-orang").textContent = t.pendek;
  const ucapan = div("ucapan", `<span class="isi"></span>`); ucapan.style.setProperty("--warna", t.warna); ucapan.hidden = true;
  const o = {
    nama, m, kepala, ucapan, simbolEl: kepala.querySelector(".simbol"), ucapanTeks: ucapan.querySelector(".isi"),
    x: PINTU[0], y: PINTU[1], rute: [], kunci: null, arah: Math.PI / 2, arahDiam: null,
    kecepatan: acak(1.25, 1.45), tampak: false, status: "absen", ikon: null, skrip: [], tunggu: 0, pose: "berdiri",
    bawa: null, tempat: null, tamu: null, jeda: acak(10, 20), ngopiSampai: 0, sudahNgopi: false, ucapSampai: 0,
    fase: Math.random() * 10, terakhirKirim: 0, skala, warna: t.warna,
  };
  if (m) {
    adegan.daftarOrang(m, nama.startsWith("asisten:") ? t.induk ?? null : nama);
    m.akar.visible = false;
    o.lKepala = adegan.tambahLabel(kepala, 0, 1.95 * skala, 0, m.akar, { prioritasFn: () => (kepala.dataset.status === "menunggu" ? 4 : kepala.classList.contains("di-meja") ? 2.5 : 3) });
    o.lUcapan = adegan.tambahLabel(ucapan, 0, 2.3 * skala, 0, m.akar, { prioritas: 5 });
  }
  kepala.hidden = true;
  return o;
}
const SKALA_ORANG = 1.2;   // sedikit lebih besar dari skala perabot agar terbaca dari kamera atas-miring
function bangunOrang(nama) { ORANG[nama] = buatOrang(nama, TIM[nama], SKALA_ORANG); }
function setBarang(o, jenis) {
  if (o.bawa === jenis) return;
  o.bawa = jenis;
  if (o.m) O3.aturBarang(o.m, jenis);
}
function ucap(o, teks, ms = 1900, panggil = false) {
  if (!o?.tampak) return;
  o.ucapanTeks.textContent = teks;
  o.ucapan.classList.toggle("panggil", panggil);
  o.ucapan.hidden = false; o.ucapSampai = performance.now() + ms;
  adegan?.mintaGambar();
}
function tampakkan(o, ya) {
  o.tampak = ya;
  if (o.m) o.m.akar.visible = ya;
  o.kepala.hidden = !ya;
  if (!ya) o.ucapan.hidden = true;
  adegan?.mintaGambar();
}

const sedangKerja = (st) => st === "bekerja" || st === "berpikir" || st === "menunggu";
const diKursi = (o) => { const [x, y] = KURSI[o.nama].duduk; return Math.hypot(o.x - x, o.y - y) < 0.06 && !o.rute.length; };
function lepasTempat(o) { if (o.tempat) { o.tempat.dipakai = null; o.tempat = null; } }
function pesanTempat(o, jenis) {
  const bebas = DENAH.tempat.filter((t) => !t.dipakai && (jenis ? jenis.includes(t.jenis) : true));
  if (!bebas.length) return null;
  const t = pilihAcak(bebas); t.dipakai = o.nama; o.tempat = t;
  return t;
}
/** Tujuan bawaan sesuai status: meja saat bekerja; lounge saat santai (ngopi dulu di bar, lalu duduk). */
function tujuanBawaan(o, now) {
  if (o.status === "absen") { lepasTempat(o); return { kunci: "pintu", xy: PINTU }; }
  const meja = { kunci: "meja", xy: KURSI[o.nama].duduk };
  if (o.nama === CHIEF || sedangKerja(o.status) || o.siapKerjaSampai > now) { lepasTempat(o); return meja; }
  if (!o.tempat) pesanTempat(o, o.sudahNgopi ? ["sofa", "pouf", "meja", "bangku", "berdiri"] : ["bar"]) || pesanTempat(o);
  return o.tempat ? { kunci: `t${DENAH.tempat.indexOf(o.tempat)}`, xy: [o.tempat.x, o.tempat.y] } : meja;
}
function jalanKe(o, xy) { o.rute = jalur([o.x, o.y], xy); o.arahDiam = null; }

// --- cerita kerja ---
/** Hentikan perjalanan di titik berikutnya agar cerita baru segera dimulai. */
const sela = (o) => { if (o.rute.length > 1) o.rute = o.rute.slice(0, 1); };
/** Pilih titik tamu di meja atasan (dipesan agar dua bawahan tidak berdiri di titik yang sama). */
function pesanTamu(o, atasan) {
  const daftar = KURSI[atasan].tamu ?? [[KURSI[atasan].duduk[0] + 1.1, KURSI[atasan].duduk[1] + 1.4]];
  const bebas = daftar.find((t) => !t.dipakai) ?? daftar[0];
  bebas.dipakai = o.nama; o.tamu = bebas;
  return bebas;
}
function lepasTamu(o) { if (o.tamu) { o.tamu.dipakai = null; o.tamu = null; } }
const hadapKe = (o, target) => { o.arahDiam = Math.atan2(target.x - o.x, target.y - o.y); };

/** Atasan memanggil dari mejanya; bawahan datang ke kursi tamu, menerima berkas, lalu kembali bekerja. */
function panggil(atasan, bawahan, label = "Ada tugas") {
  const a = ORANG[atasan], b = ORANG[bawahan];
  if (!b?.tampak) return;
  if (!a?.tampak) { b.siapKerjaSampai = performance.now() + 25000; return; }
  ucap(a, `${TIM[bawahan].pendek}, ke meja saya`, 2200, true);
  sela(b);
  b.siapKerjaSampai = performance.now() + 40000;
  b.skrip.push(
    { aksi: () => ucap(b, "Baik"), tunggu: 550 },
    { ke: () => { lepasTempat(b); const t = pesanTamu(b, atasan); return [t[0], t[1]]; } },
    { aksi: () => { hadapKe(b, a); hadapKe(a, b); ucap(a, label); }, tunggu: 1000 },
    { aksi: () => { serahBerkas(a, b); }, tunggu: 650 },
    { aksi: () => { ucap(b, "Siap ✓", 1200); a.arahDiam = null; }, tunggu: 700 },
    { aksi: () => { lepasTamu(b); b.siapKerjaSampai = performance.now() + 25000; } },
  );
}
/** Bawahan membawa laporan ke kursi tamu atasan. */
function lapor(bawahan, atasan, kata = "Laporan selesai") {
  const a = ORANG[atasan], b = ORANG[bawahan];
  if (!b?.tampak || !a?.tampak || b.skrip.some((s) => s.lapor)) return;
  b.siapKerjaSampai = 0;
  sela(b);
  b.skrip.push(
    { lapor: true, ke: () => { lepasTempat(b); const t = pesanTamu(b, atasan); return [t[0], t[1]]; }, mulai: () => setBarang(b, "kertas") },
    { aksi: () => { hadapKe(b, a); hadapKe(a, b); ucap(b, kata); }, tunggu: 1100 },
    { aksi: () => { setBarang(b, null); serahBerkas(b, a); }, tunggu: 600 },
    { aksi: () => ucap(a, "Terima kasih", 1300), tunggu: 900 },
    { aksi: () => { lepasTamu(b); a.arahDiam = null; } },
  );
}
/** Rekan menghampiri meja (atau tempat santai) rekan lain untuk bertanya. */
function kunjungi(dari, ke) {
  const p = ORANG[dari], q = ORANG[ke];
  if (!p?.tampak || !q?.tampak) return;
  sela(p);
  p.skrip.push(
    { ke: () => { lepasTempat(p); return bebasDekat(q.x + 0.9, q.y + 0.35); } },   // di samping, tidak di dalam perabot
    { aksi: () => { hadapKe(p, q); ucap(p, "Boleh tanya?"); q.tahanSampai = performance.now() + 3200; }, tunggu: 1500 },
    { aksi: () => ucap(q, "Begini…", 1600), tunggu: 1700 },
    { aksi: () => ucap(p, "Terima kasih", 1200), tunggu: 700 },
  );
}
const berkasTerbang = [];
function serahBerkas(dari, ke) {
  if (HEMAT_GERAK || !adegan) return;
  const el = div("berkas"); el.style.setProperty("--warna", dari.warna ?? TIM[dari.nama]?.warna);
  const l = adegan.tambahLabel(el, dari.x, 1.3, dari.y);
  berkasTerbang.push({ l, dari, ke, mulai: performance.now(), lama: 650 });
}
const OBROLAN = [["Kopinya enak", "Baru diganti bijinya"], ["Deploy lancar?", "Aman, hijau semua"], ["Sudah makan?", "Nanti, habis ini"],
  ["Tesnya lulus?", "Lulus semua"], ["Rapat jam berapa?", "Habis makan siang"], ["Capek juga ya", "Istirahat dulu"]];
function obrolSantai(o) {
  const teman = Object.values(ORANG).find((p) => p !== o && p.tampak && p.tempat && !p.rute.length && p.status === "santai"
    && Math.hypot(p.x - o.x, p.y - o.y) < 4.2);
  if (!teman) return false;
  const [a, b] = pilihAcak(OBROLAN);
  hadapKe(o, teman); hadapKe(teman, o);
  ucap(o, a, 1700);
  setTimeout(() => { if (teman.status === "santai" && teman.tempat && !teman.rute.length) ucap(teman, b, 1700); }, 1300);
  return true;
}

// --- pembaruan per bingkai ---
/** Bergerak sepanjang rute; kembalian: sedang berjalan? */
function melangkah(o, dt, now) {
  if (!o.rute.length || o.tahanSampai > now) return false;
  if (HEMAT_GERAK) { [o.x, o.y] = o.rute.at(-1); o.rute = []; return false; }
  const [tx, ty] = o.rute[0], dx = tx - o.x, dy = ty - o.y, jarak = Math.hypot(dx, dy), langkah = o.kecepatan * dt;
  if (jarak > 0.01) o.arahTuju = Math.atan2(dx, dy);
  if (jarak <= langkah) { o.x = tx; o.y = ty; o.rute.shift(); return o.rute.length > 0; }
  o.x += (dx / jarak) * langkah; o.y += (dy / jarak) * langkah;
  return true;
}
function majukan(o, dt, now) {
  // 1) skrip cerita didahulukan
  if (!o.rute.length && o.tunggu <= 0 && o.skrip.length && !(o.tahanSampai > now)) {
    const s = o.skrip[0];
    if (s.ke && !s.berangkat) { s.berangkat = true; o.kunci = null; s.mulai?.(); jalanKe(o, s.ke()); }
    else { o.skrip.shift(); s.aksi?.(); o.tunggu = s.tunggu ?? 0; }
  }
  if (o.tunggu > 0) o.tunggu -= dt * 1000;
  // 2) perilaku bawaan
  const bebas = !o.skrip.length && o.tunggu <= 0 && !(o.tahanSampai > now);
  if (bebas) {
    const tujuan = tujuanBawaan(o, now);
    if (o.kunci !== tujuan.kunci) { o.kunci = tujuan.kunci; jalanKe(o, tujuan.xy); }
    else if (!o.rute.length) {
      if (o.status === "absen" && o.kunci === "pintu") tampakkan(o, false);
      else if (o.tempat?.jenis === "bar" && !o.sudahNgopi) {
        if (!o.ngopiSampai) o.ngopiSampai = now + acak(4500, 7500);
        else if (now > o.ngopiSampai) { o.sudahNgopi = true; o.ngopiSampai = 0; lepasTempat(o); o.kunci = null; }
      } else if (o.tempat && (o.jeda -= dt) <= 0) {
        o.jeda = acak(12, 26);
        const r = Math.random();
        if (r < 0.5) obrolSantai(o);
        else if (r < 0.75) { lepasTempat(o); o.kunci = null; }
        else if (r < 0.85) { o.sudahNgopi = false; lepasTempat(o); o.kunci = null; }
      }
    }
  }
  // 3) bergerak sepanjang rute
  const bergerak = melangkah(o, dt, now);
  // 4) pose & arah diam
  const diMeja = !bergerak && diKursi(o);
  const tp = !bergerak && o.tempat && Math.hypot(o.x - o.tempat.x, o.y - o.tempat.y) < 0.06 ? o.tempat : null;
  const diTamu = !bergerak && o.tamu && Math.hypot(o.x - o.tamu[0], o.y - o.tamu[1]) < 0.06;
  let pose = bergerak ? "jalan" : "berdiri", arah = o.arahTuju ?? o.arah;
  if (diMeja) {
    pose = o.status === "menunggu" ? "angkat" : o.status === "berpikir" ? "pikir" : o.status === "bekerja" ? (["baca", "web"].includes(o.ikon) ? "baca" : "ketik") : "duduk";
    arah = hadapMeja(o.nama);
  } else if (tp) {
    pose = tp.jenis === "bar" || tp.jenis === "berdiri" ? "minum" : "duduk-santai";
    arah = tp.hadap;
  } else if (diTamu) { pose = o.tamu[2] ? "duduk" : "berdiri"; arah = Math.PI; }   // kursi tamu di depan meja atasan: menghadap −y
  if (!bergerak && o.arahDiam != null) arah = o.arahDiam;
  if (!o.bawa || o.bawa === "cangkir") setBarang(o, ["minum", "duduk-santai"].includes(pose) || (pose === "jalan" && o.sudahNgopi && o.status === "santai" && !o.skrip.length) ? "cangkir" : null);
  o.pose = pose;
  return gambarOrang(o, now, bergerak, diMeja, arah, dt);
}
/** Terapkan posisi, arah, dan pose ke model 3D; kembalian: perlu digambar ulang bingkai ini? */
function gambarOrang(o, now, bergerak, diMeja, arah, dt) {
  const m = o.m;
  if (o.ucapSampai && now > o.ucapSampai) { o.ucapan.hidden = true; o.ucapSampai = 0; adegan?.mintaGambar(); }
  o.kepala.classList.toggle("di-meja", diMeja);
  if (!m) return false;
  // putar halus ke arah tujuan
  const beda = sudutBeda(o.arah, arah);
  o.arah = HEMAT_GERAK || Math.abs(beda) < 0.01 ? arah : o.arah + beda * Math.min(1, dt * 10);
  const animasi = !HEMAT_GERAK && (bergerak || ["ketik", "angkat", "minum", "duduk-santai"].includes(o.pose));
  const berubah = m.akar.position.x !== o.x || m.akar.position.z !== o.y || m.akar.rotation.y !== o.arah || m.pose !== o.pose;
  m.akar.position.set(o.x, 0, o.y);
  m.akar.rotation.y = o.arah;
  O3.aturPose(m, o.pose, now / 1000 + o.fase, !HEMAT_GERAK);
  return animasi || berubah;
}
function majukanBerkas(now) {
  for (let i = berkasTerbang.length - 1; i >= 0; i--) {
    const b = berkasTerbang[i], u = Math.min(1, (now - b.mulai) / b.lama);
    b.l.pos.set(b.dari.x + (b.ke.x - b.dari.x) * u, 1.3 + Math.sin(u * Math.PI) * 0.7, b.dari.y + (b.ke.y - b.dari.y) * u);
    if (u >= 1) { adegan.hapusLabel(b.l); berkasTerbang.splice(i, 1); }
  }
  return berkasTerbang.length > 0;
}

let tSebelum = performance.now();
function bingkai(now) {
  const dt = Math.min(0.08, Math.max(0, (now - tSebelum) / 1000)); tSebelum = now;
  let gerak = false;
  for (const o of Object.values(ORANG)) if (o.tampak) gerak = majukan(o, dt, now) || gerak;
  for (const o of Object.values(ASISTEN)) gerak = majukanAsisten(o, dt, now) || gerak;
  gerak = majukanBerkas(now) || gerak;
  adegan?.langkah(now, gerak);
}

// ================= asisten (subagent) =================
const ASISTEN = {};   // id → karakter asisten
const MAKS_ASISTEN = 12;
function kelompokBantu(induk) { const dv = TIM[induk]?.divisi; return dv && dv.startsWith("tim") ? dv : "umum"; }
function terapkanAsisten(daftar = []) {
  const ada = new Set();
  for (const a of daftar) {
    ada.add(a.id);
    let o = ASISTEN[a.id];
    if (!o && a.status === "aktif" && ORANG[a.induk]?.tampak && Object.keys(ASISTEN).length < MAKS_ASISTEN) {
      const titik = (DENAH.mejaBantu[kelompokBantu(a.induk)] ?? []).find((t) => !t.dipakai) ?? DENAH.mejaBantu.umum.find((t) => !t.dipakai);
      if (!titik) continue;                                   // meja bantuan penuh: tetap tercatat di panel
      const t = TIM[a.induk];
      o = buatOrang(`asisten:${a.id}`, { ...t, induk: a.induk, pendek: `Asisten ${t.pendek}`, gaya: "cepak", aksesori: "lanyard" }, SKALA_ORANG * 0.88);
      o.asisten = a; o.induk = a.induk; o.titik = titik; titik.dipakai = a.id;
      const induk = ORANG[a.induk];
      [o.x, o.y] = HEMAT_GERAK ? [titik.x, titik.y] : bebasDekat(induk.x + 0.7, induk.y + 0.6);
      tampakkan(o, true); o.status = "bekerja"; o.simbolEl.className = "simbol bekerja"; o.simbolEl.textContent = SIMBOL.bekerja;
      o.kepala.classList.add("asisten"); o.kepala.dataset.status = "bekerja";
      if (!HEMAT_GERAK) { ucap(induk, "Tolong bantu ya", 1500); jalanKe(o, [titik.x, titik.y]); }
      ASISTEN[a.id] = o;
    }
    if (o) { o.asisten = a; o.ikon = a.icon; }
  }
  for (const [id, o] of Object.entries(ASISTEN)) {
    if (o.pulang) continue;
    if (o.asisten.status === "selesai" || !ada.has(id)) pulangkanAsisten(o);
  }
}
/** Asisten selesai: membawa hasil ke pemanggil, menyerahkannya, lalu pergi. */
function pulangkanAsisten(o) {
  o.pulang = true;
  if (o.titik) { o.titik.dipakai = null; o.titik = null; }
  const induk = ORANG[o.induk];
  if (!induk?.tampak || HEMAT_GERAK) { hapusAsisten(o); return; }
  setBarang(o, "kertas");
  o.skrip.push(
    { ke: () => bebasDekat(induk.x + 0.8, induk.y + 0.5) },
    { aksi: () => { hadapKe(o, induk); ucap(o, "Selesai, ini hasilnya", 1300); setBarang(o, null); serahBerkas(o, induk); }, tunggu: 1200 },
    { aksi: () => hapusAsisten(o) },
  );
}
function hapusAsisten(o) {
  if (o.titik) o.titik.dipakai = null;
  if (o.m) { adegan.lepasOrang(o.m); adegan.hapusLabel(o.lKepala); adegan.hapusLabel(o.lUcapan); }
  delete ASISTEN[o.asisten.id];
  adegan?.mintaGambar();
}
function majukanAsisten(o, dt, now) {
  if (!o.rute.length && o.tunggu <= 0 && o.skrip.length) {
    const s = o.skrip[0];
    if (s.ke && !s.berangkat) { s.berangkat = true; jalanKe(o, s.ke()); }
    else { o.skrip.shift(); s.aksi?.(); o.tunggu = s.tunggu ?? 0; }
  }
  if (o.tunggu > 0) o.tunggu -= dt * 1000;
  if (!ASISTEN[o.asisten?.id]) return true;                     // sudah dihapus oleh skrip
  const bergerak = melangkah(o, dt, now);
  const diMeja = !bergerak && o.titik && Math.hypot(o.x - o.titik.x, o.y - o.titik.y) < 0.06;
  let arah = o.arahTuju ?? o.arah;
  if (diMeja) arah = o.titik.hadap;
  if (!bergerak && o.arahDiam != null) arah = o.arahDiam;
  o.pose = bergerak ? "jalan" : diMeja ? (["baca", "web"].includes(o.ikon) ? "baca" : "ketik") : "berdiri";
  return gambarOrang(o, now, bergerak, true, arah, dt);
}

// ================= penerapan status dari server =================
function terapkanStatus(ag, awal) {
  const o = ORANG[ag.name], st = ag.present ? ag.status : "absen", sebelum = o.status;
  o.status = st; o.ikon = ag.icon;
  o.simbolEl.className = `simbol ${st}`; o.simbolEl.textContent = SIMBOL[st];
  o.kepala.dataset.status = st;
  if (o.m) O3.aturCincin(o.m, st === "menunggu");
  if (st !== "absen" && !o.tampak) {
    tampakkan(o, true); o.kunci = null;
    if (awal || HEMAT_GERAK) { const t = tujuanBawaan(o, performance.now()); [o.x, o.y] = t.xy; o.kunci = t.kunci; if (o.tempat?.jenis === "bar") o.sudahNgopi = true; }
    else [o.x, o.y] = PINTU;
    o.rute = [];
  }
  if (sedangKerja(st) && !sedangKerja(sebelum)) o.sudahNgopi = false;
  // selesai satu giliran kerja tanpa laporan eksplisit → bawa laporan ke atasan
  if (!awal && sedangKerja(sebelum) && st === "santai" && TIM[ag.name].atasan && performance.now() - o.terakhirKirim > 60000)
    lapor(ag.name, TIM[ag.name].atasan);
  if (sebelum !== st) adegan?.mintaGambar();
}
const KATA_LAPOR = { laporan: "Laporan selesai", terhambat: "Saya terhambat", eskalasi: "Darurat, SEV1!", info: "Sekadar info", jawaban: "Ini jawabannya" };
/** Kejadian pesan → cerita sesuai hubungan atasan–bawahan dan jenis pesan. */
function ceritakan(f) {
  const dari = f.agent, ke = f.to;
  if (!ke || !TIM[ke] || ke === dari || !ORANG[dari]) return;
  ORANG[dari].terakhirKirim = performance.now();
  const jenis = f.jenis ?? (f.label === "Memanggil agent" ? "tugas" : null);
  if (atasanDari(dari, ke)) {
    if (jenis === "diterima") { ucap(ORANG[dari], "Diterima ✓"); setTimeout(() => ucap(ORANG[ke], "Terima kasih", 1300), 900); }
    else if (jenis === "info") { ucap(ORANG[dari], `Info untuk ${TIM[ke].pendek}`); setTimeout(() => ucap(ORANG[ke], "Oke", 1100), 900); }
    else panggil(dari, ke, jenis === "revisi" ? "Ada revisi" : jenis === "tinjau" ? "Tolong tinjau kode saya" : f.label === "Memanggil agent" ? "Selamat datang, ini tugasmu" : "Ada tugas");
  } else if (atasanDari(ke, dari)) lapor(dari, ke, KATA_LAPOR[jenis] ?? "Laporan selesai");
  else kunjungi(dari, ke);
}

// ================= panel =================
const elTim = document.getElementById("tim"), elAkt = document.getElementById("aktivitas");
const elJalur = document.getElementById("jalur"), elPerhatian = document.getElementById("perhatian");
const LI = {}, SEL = {}, KELOMPOK = {}, LABEL_JALUR = {};
let state = null, dipilih = null, diterimaPada = 0, pertama = true, PAPAN = {};
const sudahLihat = new Set();

function bangunPanel() {
  for (const dv of DIVISI) {
    const h = document.createElement("li"); h.className = "kelompok"; h.style.setProperty("--warna", dv.warna);
    h.innerHTML = `<i aria-hidden="true"></i><span>${esc(dv.nama)}</span>`; elTim.append(h); KELOMPOK[dv.id] = h;
    for (const nama of URUT.filter((n) => TIM[n].divisi === dv.id)) {
      const t = TIM[nama], li = document.createElement("li");
      li.dataset.agen = nama; li.style.setProperty("--warna", t.warna); li.className = "absen";
      const leader = KURSI[nama].pimpinan && nama !== CHIEF ? "<small>leader</small>" : "";
      const idRinci = `rinci-${URUT.indexOf(nama)}`;
      li.innerHTML = `<button type="button" aria-expanded="false" aria-controls="${idRinci}">
          <span class="avatar">${t.inisial}<i class="simbol absen" aria-hidden="true"></i></span>
          <span class="nama">${esc(nama)}${leader}</span><span class="waktu"></span><span class="keadaan">Belum masuk</span></button>
        <div class="rincian" id="${idRinci}" hidden></div>`;
      li.querySelector("button").addEventListener("click", () => pilih(dipilih === nama ? null : nama));
      elTim.append(li); LI[nama] = li;
      const label = document.createElement("span"); label.className = "label"; label.textContent = t.pendek; label.title = nama;
      const sel2 = document.createElement("div"); sel2.className = "sel"; sel2.style.setProperty("--warna", t.warna);
      sel2.innerHTML = "<i></i>".repeat(60); sel2.setAttribute("role", "img");
      elJalur.append(label, sel2); SEL[nama] = sel2; LABEL_JALUR[nama] = label;
    }
  }
}
function pilih(nama) {
  dipilih = nama;
  adegan?.pilih(nama);
  for (const [n, m] of Object.entries(MEJA)) m.tag.classList.toggle("dipilih", n === nama);
  if (state) render(state, true);
  for (const [n, li] of Object.entries(LI)) {
    const buka = n === nama;
    li.querySelector("button").setAttribute("aria-expanded", String(buka));
    li.querySelector(".rincian").hidden = !buka;
  }
  if (state) isiRincian();
}
function isiRincian() {
  if (!dipilih) return;
  const ag = state.agents.find((a) => a.name === dipilih);
  if (!ag) return;
  const akt = state.feed.filter((f) => f.agent === dipilih).slice(0, 6);
  LI[dipilih].querySelector(".rincian").innerHTML = `
    <h3>Sesi</h3>${ag.sessions.length ? `<ul>${ag.sessions.map((s) => `<li>${s.subagent ? `Subagent dari ${esc(s.subagent.dari)}: ` : ""}${esc(s.title)} — ${esc(s.label)}<br><span class="lokasi">${esc(s.cwd)}</span></li>`).join("")}</ul>`
      : modeDari(ag) === "katalog" ? "<p class=\"kosong\">Peran katalog: tidak punya sesi tetap. Dipanggil sebagai subagent saat dibutuhkan, lalu bekerja di kursi ini.</p>"
      : "<p class=\"kosong\">Belum ada sesi aktif. COO membentuknya saat kamu memanggil /rudisone.</p>"}
    <h3>Aktivitas</h3>${akt.length ? `<ul>${akt.map((f) => `<li>${fmtJam(f.ts)} · ${esc(f.label)}${f.detail ? ` — ${esc(f.detail)}` : ""}</li>`).join("")}</ul>`
      : "<p class=\"kosong\">Belum ada aktivitas dalam 24 jam.</p>"}`;
}

const WARNA_STATUS = { berjalan: "var(--bekerja)", antre: "var(--santai)", diparkir: "var(--santai)", ditinjau: "var(--berpikir)",
  terhambat: "var(--menunggu)", baru: "var(--berpikir)", penyelarasan: "var(--menunggu)" };
const TUGAS_SOROT = PARAM.get("tugas");
let sudahSorot = false;
/** Id teknis di kolom Pemilik register → nama peran. */
const NAMA_ID = {
  coo: "COO", "tech-lead": "Tech Lead", "business-systems-analyst": "Business Systems Analyst",
  "software-engineer": "Software Engineer", "program-manager": "Program Manager", "technical-writer": "Technical Writer",
  "head-of-strategy": "Head of Strategy", "financial-controller": "Financial Controller", "research-analyst": "Research Analyst",
  "hr-business-partner": "HR Business Partner", "head-of-it-operations": "Head of IT Operations",
  "system-administrator": "System Administrator",
};
/** Pemilik di register ("Tech Lead · kasir", "Tech Lead · Tim 1", "Head of IT Operations", "COO",
 *  "Software Engineer #2 · toko", atau id teknis seperti "tech-lead") → kursi. */
function kursiPemilik(pemilik, tim) {
  if (!pemilik) return null;
  if (TIM[pemilik]) return pemilik;
  const [peran0, sisa = ""] = pemilik.split(" · ");
  const bernomor = /^(.*?)\s*#(\d)$/.exec(peran0.trim());
  const dasar = bernomor ? bernomor[1] : peran0.trim();
  const peran = Object.hasOwn(NAMA_ID, dasar) ? NAMA_ID[dasar] : dasar;
  if (TIM[peran]) return peran;
  const n = Number(/Tim\s*(\d)/.exec(sisa)?.[1] ?? tim?.find((t) => t.proyek === sisa.trim())?.n ?? 1);
  const k = kursiTim(peran === "Software Engineer" ? `Software Engineer #${bernomor?.[2] === "2" ? 2 : 1}` : peran, n);
  return TIM[k] ? k : null;
}
/** Tautan `?tugas=<ID>` dari jawaban COO: tandai tugasnya, pilih pemiliknya, dan dekatkan kamera ke mejanya. */
function sorotTugasDariTautan(s) {
  if (sudahSorot || !TUGAS_SOROT || !s.tugas) return;
  sudahSorot = true;
  const t = s.tugas.find((x) => x.id === TUGAS_SOROT);
  const k = t && kursiPemilik(t.pemilik, s.tim);
  if (!k) return;
  pilih(k);
  adegan?.dekatkan(...KURSI[k].duduk);
  perbaruiTombolZoom();
  document.querySelector(`.tugas li[data-id="${CSS.escape(TUGAS_SOROT)}"]`)?.scrollIntoView({ block: "nearest" });
}

/** " · <fase> · 12/25 mnt" — menit berjalan di fase ini terhadap anggarannya (server: ANGGARAN_FASE). */
function faseTeks(t) {
  if (!t.fase || t.fase === "—") return "";
  const k = t.kemajuan;
  if (!k) return ` · ${esc(t.fase)}`;
  const angka = k.anggaran ? `${k.menit}/${k.anggaran} mnt` : `${k.menit} mnt`;
  return ` · ${esc(t.fase)} · <span class="${k.lewat ? "lewat" : ""}" title="${k.lewat ? "melewati anggaran waktu fase" : "dalam anggaran waktu fase"}">${angka}${k.lewat ? " ⚠" : ""}</span>`;
}

function renderTugas(tugas = []) {
  const el = document.getElementById("tugas");
  document.getElementById("hitung-tugas").textContent = tugas.length ? `${tugas.length}` : "";
  el.innerHTML = tugas.length ? tugas.map((t) => {
    const st = (t.status || "baru").split(/[\s(]/)[0].toLowerCase();
    const folder = t.folder ? t.folder.split("/").filter(Boolean).at(-1) : "";
    return `<li data-id="${esc(t.id)}"${t.id === TUGAS_SOROT ? ' class="sorot"' : ""}><span class="st" style="--warna:${WARNA_STATUS[st] ?? "var(--santai)"}">${esc(t.status || "baru")}</span>
      <span class="judul${t.prioritas === "segera" ? " segera" : ""}">${esc(t.tugas)}</span>
      <span class="meta">${esc(t.id)}${folder ? ` · ${esc(folder)}` : ""}${t.pemilik ? ` · ${esc(t.pemilik)}` : ""}${faseTeks(t)}</span></li>`;
  }).join("") : `<li><p class="kosong">Tidak ada tugas berjalan. Tugas yang diterima COO muncul di sini.</p></li>`;
}

/** Tim engineering per proyek: papan nama & judul kelompok memakai nama proyek; tim yang belum dipakai disembunyikan. */
function renderTim(s) {
  for (const n of NOMOR_TIM) {
    const proyek = s.tim?.find((t) => t.n === n)?.proyek ?? null;
    const anggota = URUT.filter((x) => TIM[x].divisi === `tim${n}`);
    const aktif = !!proyek || anggota.some((x) => s.agents.find((a) => a.name === x)?.present);
    const papan = PAPAN[`tim${n}`], baru = proyek ? `Proyek: ${proyek}` : aktif ? "Proyek belum terdaftar" : "Belum ada proyek";
    if (papan && papan.sub.textContent !== baru) { papan.sub.textContent = baru; adegan?.mintaGambar(); }
    papan?.el.classList.toggle("redup", !aktif);
    KELOMPOK[`tim${n}`].querySelector("span").textContent = `Engineering · Tim ${n}${proyek ? ` — ${proyek}` : ""}`;
    for (const el2 of [KELOMPOK[`tim${n}`], ...anggota.flatMap((x) => [LI[x], LABEL_JALUR[x], SEL[x]])]) el2.hidden = !aktif;
    for (const x of anggota) if (MEJA[x]) MEJA[x].tag.classList.toggle("tim-kosong", !aktif);
  }
}

function render(s, ulang = false) {
  state = s;
  if (!ulang) diterimaPada = Date.now();
  const perhatian = [];
  for (const nama of URUT) {
    const ag = s.agents.find((a) => a.name === nama) ?? { name: nama, present: false, status: "absen", label: "Belum masuk", detail: "", sessions: [], timeline: [] };
    const st = kelasDari(ag), mode = modeDari(ag), dari = ag.subagent?.dari;
    terapkanStatus(ag, pertama);
    adegan?.aturLayar(nama, ag.present ? ag.status : null);
    const m = MEJA[nama];
    // papan meja ringkas: nama pendek; baris aksi hanya saat menunggu Anda, subagent/asisten, atau saat meja dipilih
    const jumlahSesi = ag.sessions?.length ?? 0;
    const jumlahAsisten = (s.asisten ?? []).filter((a) => a.induk === nama && a.status === "aktif").length;
    const namaBaru = jumlahSesi > 1 ? `${TIM[nama].pendek} ×${jumlahSesi}` : TIM[nama].pendek;
    const aksiBaru = st === "menunggu" ? "Menunggu Anda" : dari ? potong(`subagent dari ${TIM[dari]?.pendek ?? dari}`, 30)
      : jumlahAsisten ? `+${jumlahAsisten} asisten` : dipilih === nama && ag.present
      ? potong(st === "santai" ? "Di lounge" : ag.detail ? `${ag.label} · ${ag.detail}` : ag.label, 30)
      : dipilih === nama && mode === "katalog" ? "Dipanggil saat perlu" : "";
    const kelasTag = `tag ${st}${dipilih === nama ? " dipilih" : ""}${m.tag.classList.contains("tim-kosong") ? " tim-kosong" : ""}`;
    if (m.namaT.textContent !== namaBaru || m.aksiT.textContent !== aksiBaru || m.tag.className !== kelasTag) {
      m.namaT.textContent = namaBaru; m.aksiT.textContent = aksiBaru; m.tag.className = kelasTag;
      m.simbol.className = `simbol ${st}`; m.simbol.textContent = SIMBOL[st];
      adegan?.mintaGambar();
    }
    m.tag.setAttribute("aria-label", `${nama}, ${LABEL_STATUS[st]}${ag.present ? `: ${ag.label}${ag.detail ? `, ${ag.detail}` : ""}${dari ? `, subagent dari ${dari}` : ""}` : ""}`);
    m.tag.setAttribute("aria-pressed", String(dipilih === nama));
    if (st === "menunggu") perhatian.push(ag);
    const li = LI[nama];
    li.className = st;
    li.querySelector(".simbol").className = `simbol ${st}`;
    li.querySelector(".simbol").textContent = SIMBOL[st];
    li.querySelector(".keadaan").innerHTML = ag.present
      ? `${dari ? `<span class="sub" title="Subagent dari ${esc(dari)}">subagent · ${esc(TIM[dari]?.pendek ?? dari)}</span> ` : ""}<b>${esc(ag.label)}</b>${ag.detail ? ` · ${esc(ag.detail)}` : ""}${jumlahSesi > 1 ? ` · ${jumlahSesi} sesi` : ""}${jumlahAsisten ? ` · ${jumlahAsisten} asisten` : ""}`
      : mode === "katalog" ? `Dipanggil saat perlu · ${esc(TIM[nama].peran)}` : `Belum masuk · ${esc(TIM[nama].peran)}`;
    li.querySelector(".waktu").textContent = ag.present ? lalu(ag.lastTs) : "";
    let aktif = 0;
    [...SEL[nama].children].forEach((c, i) => { const n = ag.timeline?.[i]?.n ?? 0; if (n) aktif++; c.dataset.n = n >= 4 ? 3 : n >= 2 ? 2 : n; });
    SEL[nama].setAttribute("aria-label", `${nama}: aktif ${aktif} dari 60 menit terakhir`);
  }
  renderTugas(s.tugas);
  renderTim(s);
  terapkanAsisten(s.asisten);
  sorotTugasDariTautan(s);
  elPerhatian.hidden = perhatian.length === 0;
  document.getElementById("daftar-perhatian").innerHTML = perhatian.map((a) =>
    `<li><i class="simbol menunggu" aria-hidden="true">!</i><b>${esc(a.name)} — ${esc(a.label)}</b>
     <span class="sesi">Buka sesi “${esc(a.sessions[0]?.title ?? a.name)}” di sidebar Claude.</span></li>`).join("");
  elAkt.innerHTML = s.feed.length ? s.feed.slice(0, 40).map((f) => `<li style="--warna:${TIM[f.agent]?.warna}">
      <time>${fmtJam(f.ts)}</time><i class="titik" aria-hidden="true"></i>
      <span><b>${esc(f.agent)}</b> ${esc(f.label)}${f.detail ? `<span class="rinci"> — ${esc(f.detail)}</span>` : ""}</span></li>`).join("")
    : `<li><p class="kosong">Belum ada aktivitas dalam 24 jam terakhir.</p></li>`;
  if (dipilih) isiRincian();
  for (const f of ulang ? [] : [...s.feed].reverse()) {
    const kunci = `${f.ts}|${f.agent}|${f.label}|${f.to ?? ""}`;
    if (sudahLihat.has(kunci)) continue;
    sudahLihat.add(kunci);
    if (pertama || Date.now() - f.ts > 90e3) continue;
    if (f.icon === "pesan" && f.to) ceritakan(f);
  }
  if (!ulang) pertama = false;
  const hitung = (st) => s.agents.filter((a) => a.present && a.status === st).length;
  const katalog = s.agents.filter((a) => !a.present && modeDari(a) === "katalog").length;
  elPanggung.setAttribute("aria-label", `Denah kantor 3D: ${hitung("bekerja")} bekerja, ${hitung("menunggu")} menunggu Anda, ${hitung("berpikir")} berpikir, ${hitung("santai")} siaga, ${katalog} katalog (dipanggil saat perlu), ${s.agents.filter((a) => !a.present).length - katalog} sesi tetap belum masuk. Rincian tiap orang ada di panel Tim per divisi.`);
}

// ================= koneksi, jam, kamera, jeda gerak =================
const elKon = document.getElementById("koneksi"), elKonT = document.getElementById("koneksi-teks");
let modeDemo = false, putus = false;
function detik() {
  document.getElementById("jam").textContent = `${fmtJam(Date.now())} WIB`;
  if (modeDemo) return;
  const umur = diterimaPada ? Math.round((Date.now() - diterimaPada) / 1000) : null;
  elKon.classList.toggle("putus", putus);
  elKon.classList.toggle("basi", !putus && umur !== null && umur > 30);
  if (putus) elKonT.textContent = "Terputus dari server kantor — mencoba lagi. Jalankan bin/kantor.sh bila server mati.";
  else if (umur !== null) elKonT.textContent = umur > 30 ? `Data terakhir ${umur} dtk lalu` : "Terhubung · langsung";
  if (state) for (const [n, li] of Object.entries(LI)) { const a = state.agents.find((x) => x.name === n); li.querySelector(".waktu").textContent = a?.present ? lalu(a.lastTs) : ""; }
}
function sambung() {
  const es = new EventSource("/events");
  es.onopen = () => { putus = false; detik(); };
  es.onmessage = (e) => { putus = false; render(JSON.parse(e.data)); detik(); };
  es.onerror = () => { putus = true; detik(); };
}
const tbKecil = document.getElementById("zoom-kecil"), tbBesar = document.getElementById("zoom-besar"), tbPas = document.getElementById("zoom-pas");
function perbaruiTombolZoom() { if (adegan) tbPas.disabled = adegan.dekatSeluruh() && !adegan.terbang; }
tbBesar.addEventListener("click", () => adegan?.zoom(0.7));
tbKecil.addEventListener("click", () => adegan?.zoom(1.4));
tbPas.addEventListener("click", () => adegan?.seluruhDenah());
document.getElementById("putar-kiri").addEventListener("click", () => adegan?.putar(-Math.PI / 12));
document.getElementById("putar-kanan").addEventListener("click", () => adegan?.putar(Math.PI / 12));

const tombolJeda = document.getElementById("jeda");
function aturJeda() {
  tombolJeda.setAttribute("aria-pressed", String(HEMAT_GERAK)); tombolJeda.textContent = HEMAT_GERAK ? "Lanjutkan gerak" : "Jeda gerak";
  adegan?.aturHemat(HEMAT_GERAK);
}
tombolJeda.addEventListener("click", () => {
  HEMAT_GERAK = !HEMAT_GERAK; aturJeda();
  try { localStorage.setItem("kantor-jeda", HEMAT_GERAK ? "1" : "0"); } catch { /* abaikan */ }
});
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (e) => { if (e.matches && !HEMAT_GERAK) { HEMAT_GERAK = true; aturJeda(); } });

// ================= ukur kinerja (?ukur=1): bingkai/dtk, gambar/dtk, ms per gambar, draw call =================
function pasangUkur() {
  const el = div("ukur"); el.setAttribute("aria-hidden", "true"); elPanggung.append(el);
  let b0 = 0, g0 = 0, ms0 = 0, t0 = performance.now();
  setInterval(() => {
    const u = adegan.ukur, dt = (performance.now() - t0) / 1000;
    const fps = (u.bingkai - b0) / dt, gps = (u.gambar - g0) / dt, ms = (u.gambar - g0) ? (u.msGambar - ms0) / (u.gambar - g0) : 0;
    const info = adegan.renderer.info.render;
    el.textContent = `${fps.toFixed(0)} bingkai/dtk · ${gps.toFixed(0)} gambar/dtk · ${ms.toFixed(1)} ms/gambar · ${info.calls} draw call · ${(info.triangles / 1000).toFixed(0)} rb segitiga`;
    window.__kantorUkur = { fps, gambarPerDetik: gps, msPerGambar: ms, drawCall: info.calls, segitiga: info.triangles, piksel: adegan.renderer.getPixelRatio() };
    b0 = u.bingkai; g0 = u.gambar; ms0 = u.msGambar; t0 = performance.now();
  }, 1000);
}

// ================= mode demo (?demo=1): skenario contoh berulang tiap 70 detik =================
function demo() {
  modeDemo = true;
  elKonT.textContent = "Mode demo — data contoh, bukan aktivitas nyata"; elKon.classList.add("basi");
  const L1 = kursiTim("Tech Lead", 1), S1 = kursiTim("Business Systems Analyst", 1), P1 = kursiTim("Software Engineer #1", 1);
  const L2 = kursiTim("Tech Lead", 2), S2 = kursiTim("Business Systems Analyst", 2), Q2 = kursiTim("Software Engineer #1", 2);
  const STRAT = "Head of Strategy", FIN = "Financial Controller", RISET = "Research Analyst", PM = "Program Manager",
    TW = "Technical Writer", ITOPS = "Head of IT Operations", SYSADM = "System Administrator";
  const SKEN = [ // [detik, agent, status, label, detail, ikon] atau [detik, "pesan", dari, ke, jenis]
    [2, "pesan", CHIEF, L1, "tugas"],
    [8, L1, "bekerja", "Membaca kode", "use-pos-cart.ts", "baca"],
    [11, "pesan", L1, P1, "tugas"],
    [16, P1, "bekerja", "Menulis", "CartLineRow.tsx", "kode"],
    [6, "pesan", CHIEF, L2, "tugas"],
    [12, L2, "bekerja", "Menyusun rencana", "landing toko-b", "rencana"],
    [14, "pesan", L2, S2, "tugas"],
    [19, S2, "bekerja", "Menulis", "user-story.md", "kode"],
    [18, "pesan", CHIEF, ITOPS, "tugas"],
    [23, ITOPS, "bekerja", "Menjalankan perintah", "Selidiki stok minus cabang 2", "terminal"],
    [25, "pesan", ITOPS, SYSADM, "tugas"],
    [30, SYSADM, "bekerja", "Bekerja di server", "Cek kesehatan server", "server"],
    [27, "pesan", CHIEF, STRAT, "tugas"],
    [32, STRAT, "bekerja", "Riset di web", "harga paket toko-b", "web"],
    [34, "pesan", STRAT, FIN, "konsultasi"],
    [33, S1, "menunggu", "Menunggu jawaban Anda", "", "tunggu"],
    [40, P1, "santai", "Santai", "", "santai"], [40, "pesan", P1, L1, "laporan"],
    [44, "pesan", L1, P1, "tinjau"],
    [47, SYSADM, "santai", "Santai", "", "santai"], [47, "pesan", SYSADM, ITOPS, "laporan"],
    [51, L1, "santai", "Santai", "", "santai"], [51, "pesan", L1, CHIEF, "laporan"],
    [55, ITOPS, "santai", "Santai", "", "santai"], [55, "pesan", ITOPS, CHIEF, "laporan"],
    [58, S2, "santai", "Santai", "", "santai"], [58, "pesan", S2, L2, "laporan"],
    [62, STRAT, "santai", "Santai", "", "santai"], [62, "pesan", STRAT, CHIEF, "laporan"],
    [66, S1, "santai", "Santai", "", "santai"],
  ];
  const hadirAwal = new Set([CHIEF, STRAT, FIN, RISET, PM, TW, ITOPS, SYSADM, L1, S1, P1, L2, S2, Q2]);
  const awal = () => Object.fromEntries(URUT.map((n) => [n,
    !hadirAwal.has(n) ? { status: "absen" }
      : n === PM ? { status: "bekerja", label: "Menyusun rencana", detail: "status lintas proyek", icon: "rencana" }
        : { status: "santai", label: "Santai", detail: "", icon: "santai" }]));
  let keadaan = awal(), feed = [], terakhir = -1;
  const mulai = performance.now();
  const kirim = () => {
    const now = Date.now();
    const agents = URUT.map((name, i) => {
      const k = keadaan[name], timeline = Array.from({ length: 60 }, (_, m) => ({ n: (m * 7 + i * 13) % 9 < 3 ? ((m + i) % 5) : 0 }));
      return k.status === "absen"
        ? { name, present: false, status: "absen", mode: name === CHIEF || name === ITOPS || name.startsWith("Tech Lead") ? "absen" : "katalog",
            label: "Belum masuk", detail: "", icon: "absen", lastTs: 0, sessions: [], timeline }
        : { name, present: true, ...k, lastTs: now - i * 30e3, timeline, sessions: [{ title: `${name} · contoh`, label: k.label, cwd: "~/contoh" }] };
    });
    // asisten contoh: Tech Lead Tim 1 menambah dua asisten engineer, Head of Strategy satu asisten riset
    const asisten = [["d1", L1, 20, 42, "Menulis", "kode", "Asisten: tes qty"], ["d2", L1, 22, 46, "Menjalankan tes", "tes", "Asisten: cek regresi"],
      ["d3", STRAT, 33, 50, "Riset di web", "web", "Asisten: harga pesaing"]]
      .filter(([, , a, b]) => terakhir >= a && terakhir < b + 8)
      .map(([id, induk, a, b, label, icon, deskripsi]) => ({ id, induk, status: terakhir >= b ? "selesai" : "aktif", label, icon, deskripsi, jenis: "general-purpose" }));
    render({ now, agents, feed: [...feed].reverse(), asisten, tim: [{ n: 1, proyek: "kasir" }, { n: 2, proyek: "toko-b" }], tugas: [
      { id: "T-20260101-3", tugas: "Insiden stok minus cabang 2", folder: "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations", pemilik: "Head of IT Operations", prioritas: "segera", status: "berjalan" },
      { id: "T-20260101-2", tugas: "Perbaikan cetak SJ paging", folder: "~/Documents/kasir", pemilik: "Tech Lead · Tim 1", prioritas: "normal", status: "berjalan" },
      { id: "T-20260101-4", tugas: "Landing page toko-b", folder: "~/Documents/toko-b", pemilik: "Tech Lead · Tim 2", prioritas: "normal", status: "berjalan" },
      { id: "T-20260101-5", tugas: "Kelayakan paket harga toko-b", folder: "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-strategy", pemilik: "Head of Strategy", prioritas: "normal", status: "berjalan" },
    ] });
  };
  const putar = (dtk) => {
    if (dtk < terakhir) { keadaan = awal(); feed = []; }
    for (const e of SKEN) if ((e[0] > terakhir && e[0] <= dtk) || (dtk < terakhir && e[0] <= dtk)) {
      if (e[1] === "pesan") feed.push({ ts: Date.now(), agent: e[2], label: `Mengirim pesan ke ${e[3]}`, detail: e[4][0].toUpperCase() + e[4].slice(1), icon: "pesan", to: e[3], jenis: e[4] });
      else { keadaan[e[1]] = { status: e[2], label: e[3], detail: e[4], icon: e[5] }; feed.push({ ts: Date.now(), agent: e[1], label: e[3], detail: e[4], icon: e[5] }); }
    }
    terakhir = dtk; kirim();
  };
  // ?demo=<detik>: mulai dari detik tertentu skenario (untuk tangkapan layar yang dapat diulang)
  const awalDetik = Number(PARAM.get("demo")) || 0;
  if (awalDetik > 0) { pertama = true; putar(awalDetik); pertama = false; }
  setInterval(() => putar((Math.floor((performance.now() - mulai) / 1000) + awalDetik) % 70), 500);
  kirim();
}

// ================= mulai =================
try { await siapkanAdegan(); } catch (e) { tampilkanTanpa3d(e?.message === "WebGL2 tidak tersedia" ? null : `Grafis 3D gagal dimuat (${e?.message ?? e}).`); }
DENAH = adegan?.denah ?? (await import("./denah.mjs")).bangunDenah();
BLOK = bangunGrid(DENAH.perabot);
bangunMeja();   // tanpa WebGL pun: tag meja tetap ada (tidak ditampilkan) agar render panel tidak bergantung pada denah
if (adegan) { PAPAN = papanZona(); adegan.onKamera = perbaruiTombolZoom; }
for (const nama of URUT) bangunOrang(nama);
bangunPanel();
aturJeda();
detik(); setInterval(detik, 1000);
if (adegan) {
  adegan.renderer.setAnimationLoop(bingkai);
  document.addEventListener("visibilitychange", () => { adegan.renderer.setAnimationLoop(document.hidden ? null : bingkai); tSebelum = performance.now(); });
  if (PARAM.has("ukur")) pasangUkur();
  window.__kantor = { adegan };
}
if (PARAM.has("demo")) demo(); else sambung();
