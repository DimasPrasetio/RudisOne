// Kantor RudisOne — halaman pemantauan: data dari server (SSE /events), panel samping, dan denah 3D (adegan.mjs).
// Perilaku orang mengikuti status & pesan (DESAIN.md › Cerita gerak); jalur dihitung di grid lantai (denah.mjs).
import { CHIEF, DIVISI, WARNA_LOUNGE, KURSI, NOMOR_TIM, PINTU, TIM, URUT, atasanDari, bangunGrid, cariJalur, hadapMeja, kursiTim, pusat, selBebas } from "./denah.mjs";
import { barisTersembunyi, berkasMeja, pembantuTugas, waktuSelesai, faseDariParam, faseWaktu, jamWIB, keadaanTampil, keteranganSiap, kursiPemilik, papanDivisi, papanTugas, statusTugas, teksSelesai } from "./jejak.mjs";
import { KUNCI_SIMPAN_LABEL, MODE_LABEL, isiPapanZona, modeLabelDari, tampilanOrang, tingkatRincian, tulisanZona, ucapanTampil } from "./label.mjs";
import { DAFTAR_SINGKATAN, STATUS, durasi, kalimatWaktuTahap, kataStatusTugas, kelompokAktivitas, kerjaAktivitas, pimpinan, rincianAman, ringkasan, singkatan, tahapTugas } from "./istilah.mjs";

// Keadaan tampil (jejak.mjs › keadaanTampil): bekerja/berpikir/menunggu hanya dari sesi/subagent yang berjalan;
// "selesai" = pekerjaan nyata berakhir < 10 menit lalu; selain itu "siap" (Siap dipanggil). "kosong" = tim tanpa proyek.
// Label & simbol satu sumber: istilah.mjs › STATUS.
const SIMBOL = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.simbol]));
const LABEL_STATUS = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]));
/** Kalimat kerja orang (huruf besar di awal) dari label status server: "Membaca 1 berkas" → "Membaca berkas". */
const kalimatKerja = (ag) => { const k = kerjaAktivitas(ag); return k[0].toUpperCase() + k.slice(1); };
const besar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Keadaan peran dari server (aktif · siaga · katalog · absen); server lama/mode demo tanpa `mode` → diturunkan dari status. */
const modeDari = (ag) => ag.mode ?? (!ag.present ? "absen" : ag.status === "santai" ? "siaga" : "aktif");
const PARAM = new URLSearchParams(location.search);
let HEMAT_GERAK = matchMedia("(prefers-reduced-motion: reduce)").matches;
try { if (localStorage.getItem("kantor-jeda") === "1") HEMAT_GERAK = true; } catch { /* penyimpanan tidak tersedia */ }
// label (DESAIN.md › Label & keterbacaan): mode tombol Label, tingkat rincian ikut zoom, dan siapa yang sedang disentuh
let MODE = "ringkas";
try { MODE = modeLabelDari(PARAM.get("label"), localStorage.getItem(KUNCI_SIMPAN_LABEL)); } catch { MODE = modeLabelDari(PARAM.get("label"), null); }
let TINGKAT = "jauh", SEMPIT = false;
let HOVER = null, FOKUS = null, SENTUH = null;   // SENTUH = kartu tampil untuk siapa (fokus keyboard > hover > dipilih)

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
  const orang = await import("./orang.mjs");
  if (PARAM.has("uji-adegan-gagal")) throw new Error("uji: adegan gagal dibuat");   // uji jalur gagal setelah modul dimuat
  const a = new Adegan({ wadah: elPanggung, kanvas: document.getElementById("kanvas"), lapis: elLapis, hemat: () => HEMAT_GERAK,
    onPilih: (nama) => pilih(nama && dipilih === nama ? null : nama) });
  adegan = a; O3 = orang;   // keduanya hanya diisi bila adegan benar-benar jadi
  adegan.hilang = () => tampilkanTanpa3d("Grafis 3D berhenti (konteks WebGL hilang). Muat ulang halaman untuk menampilkan denah lagi.");
}
function tampilkanTanpa3d(alasan) {
  elPanggung.hidden = true; elTanpa3d.hidden = false;
  if (alasan) elTanpa3d.querySelector(".alasan").textContent = alasan;
  document.getElementById("petunjuk").hidden = true; document.getElementById("tombol-bantuan").hidden = true;
  for (const id of ["zoom-kecil", "zoom-besar", "zoom-pas", "putar-kiri", "putar-kanan"]) document.getElementById(id).disabled = true;
  document.getElementById("pilih-label").disabled = true;   // tombol Label hanya berlaku untuk denah 3D
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
    // tag meja = padanan yang bisa difokus (Tab) & dibaca pembaca layar; tidak tampil di denah — fokus menampilkan kartu
    adegan?.tambahLabel(tag, sx, 0, depan);
    tag.addEventListener("focus", () => { FOKUS = tag.matches(":focus-visible") ? nama : null; perbaruiKartu(); });
    tag.addEventListener("blur", () => { if (FOKUS === nama) { FOKUS = null; perbaruiKartu(); } });
    MEJA[nama] = { tag, namaT, aksiT, simbol };
  }
}

// ================= karakter =================
const ORANG = {};
/** Satu karakter (anggota tetap atau asisten). `t` = data tampilan: warna, rambut, pendek, gaya, aksesori. */
function buatOrang(nama, t, skala = 1) {
  const m = O3 && adegan ? O3.buatOrang(t, { skala }) : null;
  // label kepala: titik status (warna + simbol) — atau label penuh "<nama> · Menunggu Anda"; nama kecil = label terpisah
  // (teks opsional: kalah lebih dulu saat bertabrakan, titiknya tetap). Semua aria-hidden: padanannya tag meja & panel.
  const kepala = div("kepala-label", `<span class="isi"><i class="simbol santai"></i><span class="teks-penuh"><b class="nama-orang"></b> · Menunggu Anda</span></span>`);
  kepala.style.setProperty("--warna", t.warna); kepala.setAttribute("aria-hidden", "true");
  kepala.querySelector(".nama-orang").textContent = t.pendek;
  const namaL = div("nama-label", `<span class="isi"></span>`); namaL.setAttribute("aria-hidden", "true");
  namaL.firstElementChild.textContent = t.pendek; namaL.hidden = true;
  const ucapan = div("ucapan", `<span class="isi"></span>`); ucapan.style.setProperty("--warna", t.warna); ucapan.hidden = true;
  const o = {
    nama, m, kepala, namaL, ucapan, simbolEl: kepala.querySelector(".simbol"), ucapanTeks: ucapan.querySelector(".isi"),
    x: PINTU[0], y: PINTU[1], rute: [], kunci: null, arah: Math.PI / 2, arahDiam: null,
    kecepatan: acak(1.25, 1.45), tampak: false, status: "kosong", ikon: null, skrip: [], tunggu: 0, pose: "berdiri", istirahat: null, istirahatBerikut: performance.now() + acak(20e3, 240e3),
    bawa: null, tempat: null, tamu: null, jeda: acak(10, 20), ngopiSampai: 0, sudahNgopi: false, ucapSampai: 0,
    fase: Math.random() * 10, terakhirKirim: 0, skala, warna: t.warna,
  };
  if (m) {
    adegan.daftarOrang(m, nama.startsWith("asisten:") ? t.induk ?? null : nama);
    m.akar.visible = false;
    o.lKepala = adegan.tambahLabel(kepala, 0, 1.95 * skala, 0, m.akar, { prioritasFn: () => (kepala.classList.contains("penuh") ? 5.5 : 3) });
    o.lNama = adegan.tambahLabel(namaL, 0, 1.95 * skala, 0, m.akar, { prioritas: 2, dy: -16 });
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
/** Label kepala & nama menurut mode Label, tingkat rincian (zoom), dan status (label.mjs › tampilanOrang). */
function segarkanKepala(o) {
  const t = tampilanOrang({ status: o.status, mode: MODE, tingkat: TINGKAT, disentuh: !o.induk && SENTUH === o.nama });
  const kepalaTampil = o.tampak && (t.titik || t.penuh), namaTampil = o.tampak && t.nama;
  if (o.kepala.hidden === kepalaTampil || o.kepala.classList.contains("penuh") !== t.penuh || o.namaL.hidden === namaTampil) adegan?.mintaGambar();
  o.kepala.hidden = !kepalaTampil; o.kepala.classList.toggle("penuh", t.penuh); o.namaL.hidden = !namaTampil;
}
function tampakkan(o, ya) {
  o.tampak = ya;
  if (o.m) o.m.akar.visible = ya;
  segarkanKepala(o);
  if (!ya) o.ucapan.hidden = true;
  if (!ya && !o.induk && o.nama === SENTUH) perbaruiKartu();   // orang yang kartunya tampil pergi → kartu ikut tutup
  adegan?.mintaGambar();
}

const sedangKerja = (st) => st === "bekerja" || st === "berpikir" || st === "menunggu";
/** Siap dipanggil: kebanyakan di meja; sesekali beberapa orang istirahat ke lounge (paling banyak MAKS_ISTIRAHAT bersamaan). */
const MAKS_ISTIRAHAT = 3;
const jedaIstirahat = () => acak(180e3, 480e3);
function mulaiIstirahat(o, now) { o.istirahat = { sampai: now + acak(30e3, 70e3) }; o.sudahNgopi = false; o.kunci = null; }
function akhiriIstirahat(o, now) {
  if (!o.istirahat) return;
  o.istirahat = null; lepasTempat(o); o.kunci = null; o.ngopiSampai = 0;
  o.istirahatBerikut = now + jedaIstirahat();
}
const diKursi = (o) => { const [x, y] = KURSI[o.nama].duduk; return Math.hypot(o.x - x, o.y - y) < 0.06 && !o.rute.length; };
function lepasTempat(o) { if (o.tempat) { o.tempat.dipakai = null; o.tempat = null; } }
function pesanTempat(o, jenis) {
  const bebas = DENAH.tempat.filter((t) => !t.dipakai && (jenis ? jenis.includes(t.jenis) : true));
  if (!bebas.length) return null;
  const t = pilihAcak(bebas); t.dipakai = o.nama; o.tempat = t;
  return t;
}
/** Tujuan bawaan: meja (bekerja, baru selesai, siap dipanggil); saat istirahat ke lounge (ngopi dulu di bar, lalu duduk);
 *  tim tanpa proyek → keluar lewat pintu. */
function tujuanBawaan(o, now) {
  if (o.status === "kosong") { lepasTempat(o); return { kunci: "pintu", xy: PINTU }; }
  const meja = { kunci: "meja", xy: KURSI[o.nama].duduk };
  if (!o.istirahat || o.siapKerjaSampai > now) { lepasTempat(o); return meja; }
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
  if (!adegan) return;   // tanpa denah tidak ada cerita gerak (skrip tidak menumpuk)
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
  if (!adegan) return;
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
  if (!adegan) return;
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
// obrolan ringan saat istirahat — sengaja tanpa klaim pekerjaan (status kerja hanya dari data nyata)
const OBROLAN = [["Kopinya enak", "Baru diganti bijinya"], ["Sudah makan?", "Nanti, habis ini"], ["Mau kopi lagi?", "Satu cukup"],
  ["Capek juga ya", "Istirahat dulu"], ["Tanamannya segar", "Baru disiram"], ["Gulanya habis?", "Ada di laci"]];
function obrolSantai(o) {
  const teman = Object.values(ORANG).find((p) => p !== o && p.tampak && p.tempat && !p.rute.length && p.istirahat
    && Math.hypot(p.x - o.x, p.y - o.y) < 4.2);
  if (!teman) return false;
  const [a, b] = pilihAcak(OBROLAN);
  hadapKe(o, teman); hadapKe(teman, o);
  ucap(o, a, 1700);
  setTimeout(() => { if (teman.istirahat && teman.tempat && !teman.rute.length) ucap(teman, b, 1700); }, 1300);
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
    // istirahat: hanya yang siap dipanggil, tidak saat hemat gerak, COO tetap di mejanya
    if (o.istirahat && (o.status !== "siap" || HEMAT_GERAK)) akhiriIstirahat(o, now);
    else if (o.istirahat && now > o.istirahat.sampai && !(o.tempat?.jenis === "bar" && !o.sudahNgopi)) akhiriIstirahat(o, now);
    else if (!o.istirahat && o.status === "siap" && !HEMAT_GERAK && o.nama !== CHIEF && now > o.istirahatBerikut && diKursi(o)) {
      if (Object.values(ORANG).filter((p) => p.istirahat).length < MAKS_ISTIRAHAT) mulaiIstirahat(o, now);
      else o.istirahatBerikut = now + acak(30e3, 90e3);
    }
    const tujuan = tujuanBawaan(o, now);
    if (o.kunci !== tujuan.kunci) { o.kunci = tujuan.kunci; jalanKe(o, tujuan.xy); }
    else if (!o.rute.length) {
      if (o.status === "kosong" && o.kunci === "pintu") tampakkan(o, false);
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
    pose = o.status === "menunggu" ? "angkat" : o.status === "berpikir" ? "pikir" : o.status === "bekerja" ? (["baca", "web"].includes(o.ikon) ? "baca" : "ketik")
      : o.status === "selesai" ? "selesai" : "siap";
    arah = hadapMeja(o.nama);
  } else if (tp) {
    pose = tp.jenis === "bar" || tp.jenis === "berdiri" ? "minum" : "duduk-santai";
    arah = tp.hadap;
  } else if (diTamu) { pose = o.tamu[2] ? "duduk" : "berdiri"; arah = Math.PI; }   // kursi tamu di depan meja atasan: menghadap −y
  if (!bergerak && o.arahDiam != null) arah = o.arahDiam;
  if (!o.bawa || o.bawa === "cangkir") setBarang(o, ["minum", "duduk-santai"].includes(pose) || (pose === "jalan" && o.sudahNgopi && o.istirahat && !o.skrip.length) ? "cangkir" : null);
  o.pose = pose;
  return gambarOrang(o, now, bergerak, diMeja, arah, dt);
}
/** Terapkan posisi, arah, dan pose ke model 3D; kembalian: perlu digambar ulang bingkai ini? */
function gambarOrang(o, now, bergerak, diMeja, arah, dt) {
  const m = o.m;
  if (o.ucapSampai && now > o.ucapSampai) { o.ucapan.hidden = true; o.ucapSampai = 0; adegan?.mintaGambar(); }
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
  if (!adegan) return;   // jumlah asisten tetap tampil di panel & tag meja
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
      o.status = "bekerja"; o.simbolEl.className = "simbol bekerja"; o.simbolEl.textContent = SIMBOL.bekerja; tampakkan(o, true);
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
  if (o.m) { adegan.lepasOrang(o.m); adegan.hapusLabel(o.lKepala); adegan.hapusLabel(o.lNama); adegan.hapusLabel(o.lUcapan); }
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
/** `st` = keadaan tampil (bekerja · berpikir · menunggu · selesai · siap · kosong). Semua jabatan tim yang dipakai hadir. */
function terapkanStatus(ag, awal, st) {
  const o = ORANG[ag.name], sebelum = o.status, now = performance.now();
  o.status = st; o.ikon = ag.icon;
  o.simbolEl.className = `simbol ${st}`; o.simbolEl.textContent = SIMBOL[st];
  o.kepala.dataset.status = st;
  if (o.m) O3.aturCincin(o.m, st === "menunggu");
  segarkanKepala(o);
  if (st !== "kosong" && !o.tampak) {
    tampakkan(o, true); o.kunci = null;
    // muat awal / hemat gerak: langsung di meja; tim yang baru mendapat proyek: masuk lewat pintu
    if (awal || HEMAT_GERAK) { [o.x, o.y] = KURSI[o.nama].duduk; o.kunci = "meja"; }
    else [o.x, o.y] = PINTU;
    o.rute = [];
  }
  if (st !== "siap") akhiriIstirahat(o, now);
  // selesai satu giliran kerja tanpa laporan eksplisit → bawa laporan ke atasan
  if (!awal && sedangKerja(sebelum) && !sedangKerja(st) && st !== "kosong" && TIM[ag.name].atasan && now - o.terakhirKirim > 60000)
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
const LI = {}, SEL = {}, KELOMPOK = {}, LABEL_JALUR = {}, RINGKAS_SIAP = {};
let state = null, dipilih = null, diterimaPada = 0, pertama = true;
const sudahLihat = new Set();
/** Divisi yang ringkasan "siap dipanggil"-nya dibuka pengguna (DESAIN.md › Panel Tim). */
const TERBUKA = new Set();

function bangunPanel() {
  for (const dv of DIVISI) {
    const h = document.createElement("li"); h.className = "kelompok"; h.style.setProperty("--warna", dv.warna);
    h.innerHTML = `<i aria-hidden="true"></i><span>${esc(dv.nama)}</span>`; elTim.append(h); KELOMPOK[dv.id] = h;
    for (const nama of URUT.filter((n) => TIM[n].divisi === dv.id)) {
      const t = TIM[nama], li = document.createElement("li");
      li.dataset.agen = nama; li.style.setProperty("--warna", t.warna); li.className = "siap";
      const tanda = pimpinan(nama) ? `<span class="pimpinan">Pimpinan</span>` : "";
      const idRinci = `rinci-${URUT.indexOf(nama)}`;
      li.innerHTML = `<button type="button" class="orang" aria-expanded="false" aria-controls="${idRinci}">
          <span class="avatar" aria-hidden="true">${t.inisial}<i class="simbol siap"></i></span>
          <span class="nama">${esc(nama)}${tanda}</span><span class="waktu"></span><span class="keadaan">Siap dipanggil</span></button>
        <div class="rincian" id="${idRinci}" hidden></div>`;
      li.querySelector("button").addEventListener("click", () => pilih(dipilih === nama ? null : nama));
      elTim.append(li); LI[nama] = li;
      const label = document.createElement("abbr"); label.className = "label"; label.textContent = t.pendek; label.title = nama;
      const sel2 = document.createElement("div"); sel2.className = "sel"; sel2.style.setProperty("--warna", t.warna);
      sel2.innerHTML = "<i></i>".repeat(60); sel2.setAttribute("role", "img");
      elJalur.append(label, sel2); SEL[nama] = sel2; LABEL_JALUR[nama] = label;
    }
    // ringkasan anggota yang siap dipanggil: avatar kecil + jumlah; dibuka → baris lengkapnya tampil
    const r = document.createElement("li"); r.className = "siap-ringkas"; r.hidden = true;
    r.innerHTML = `<button type="button" aria-expanded="false"><span class="tumpuk" aria-hidden="true"></span><span class="teks"></span><span class="panah" aria-hidden="true">▸</span></button>`;
    r.querySelector("button").addEventListener("click", () => { TERBUKA.has(dv.id) ? TERBUKA.delete(dv.id) : TERBUKA.add(dv.id); if (state) render(state, true); });
    elTim.append(r); RINGKAS_SIAP[dv.id] = r;
  }
  const sumbu = document.createElement("div"); sumbu.className = "sumbu"; sumbu.setAttribute("aria-hidden", "true");
  sumbu.innerHTML = "<span>60 mnt lalu</span><span>30 mnt</span><span>sekarang</span>";
  elJalur.append(sumbu);
  document.getElementById("daftar-singkatan").innerHTML = DAFTAR_SINGKATAN.map(([s, n]) => `<dt>${esc(s)}</dt><dd>${esc(n)}</dd>`).join("");
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
  perbaruiKartu();
}
function isiRincian() {
  if (!dipilih) return;
  const ag = state.agents.find((a) => a.name === dipilih);
  if (!ag) return;
  const akt = state.feed.filter((f) => f.agent === dipilih).slice(0, 6);
  const berkas = BERKAS[dipilih] ?? [];
  const st = ORANG[dipilih]?.status ?? "siap";
  LI[dipilih].querySelector(".rincian").innerHTML = `
    <h3>Keadaan</h3><p class="kosong">${esc(LABEL_STATUS[st])}${st === "siap" ? ` — ${esc(keteranganSiap(ag))}` : ""}${ag.subagent?.dari ? ` — dipanggil oleh ${esc(ag.subagent.dari)}` : ""}</p>
    ${ag.sessions.length ? `<h3>Sedang dikerjakan</h3><ul>${ag.sessions.map((s) => `<li>${esc(s.subagent?.deskripsi || s.title)} — ${esc(kalimatKerja(s))}</li>`).join("")}</ul>` : ""}
    ${berkas.length ? `<h3>Selesai hari ini</h3><ul>${berkas.map((b) => `<li>${esc(b.id)} — ${esc(b.judul)}</li>`).join("")}</ul>` : ""}
    <h3>Aktivitas terakhir</h3>${akt.length ? `<ul>${akt.map((f) => { const r = rincianAman(f.detail, f.label);
      return `<li>${fmtJam(f.ts)} · ${esc(besar(kerjaAktivitas(f)))}${r ? ` <span title="Rincian">(${esc(r)})</span>` : ""}</li>`; }).join("")}</ul>`
      : "<p class=\"kosong\">Belum ada aktivitas dalam 24 jam.</p>"}`;
}

const WARNA_STATUS = { berjalan: "var(--bekerja)", antre: "var(--santai)", diparkir: "var(--santai)", ditinjau: "var(--berpikir)",
  terhambat: "var(--menunggu)", baru: "var(--berpikir)", penyelarasan: "var(--menunggu)" };
const TUGAS_SOROT = PARAM.get("tugas");
let sudahSorot = false;
/** Tautan `?tugas=<ID>` dari jawaban COO: tandai tugasnya, pilih pemiliknya, dan dekatkan kamera ke mejanya. */
function sorotTugasDariTautan(s) {
  if (sudahSorot || !TUGAS_SOROT || !s.tugas) return;
  sudahSorot = true;
  const t = s.tugas.find((x) => x.id === TUGAS_SOROT);
  if (t && s.tugas.indexOf(t) >= MAKS_KARTU_TUGAS) { SEMUA_TUGAS = true; render(s, true); }
  const k = t && kursiPemilik(t.pemilik, s.tim);
  if (!k) return;
  pilih(k);
  adegan?.dekatkan(...KURSI[k].duduk);
  perbaruiTombolZoom();
  document.querySelector(`.tugas li[data-id="${CSS.escape(TUGAS_SOROT)}"]`)?.scrollIntoView({ block: "nearest" });
}

/** Siapa yang mengerjakan tugas: pemiliknya (kursi dari kolom Pemilik) + orang lain yang sedang bekerja dan langkah
 *  terakhirnya milik tugas itu (ID tugas per aktivitas dari server). */
function pelakuTugas(t, s, keadaan) {
  const pemilik = kursiPemilik(t.pemilik, s.tim);
  const terakhir = new Map();
  for (const f of s.feed) if (!terakhir.has(f.agent)) terakhir.set(f.agent, f.tugas ?? null);
  const milik = (id) => id && (id === t.id || id.startsWith(`${t.id}.`));
  const kandidat = URUT.filter((n) => n !== pemilik && ["bekerja", "berpikir", "menunggu"].includes(keadaan[n]) && milik(terakhir.get(n)))
    .map((nama) => ({ nama, dari: s.agents.find((a) => a.name === nama)?.subagent?.dari ?? null }));
  const bantu = pembantuTugas(pemilik, kandidat);
  const idPemilik = pemilik ? terakhir.get(pemilik) : null;
  const pemilikDiSini = !!pemilik && (milik(idPemilik) || (!idPemilik && statusTugas(t.status) === "berjalan"));
  return { pemilik, bantu, pemilikDiSini };
}
const MAKS_KARTU_TUGAS = 4;
let SEMUA_TUGAS = false;
const tombolSemuaTugas = document.getElementById("lihat-semua-tugas");
tombolSemuaTugas.addEventListener("click", () => { SEMUA_TUGAS = !SEMUA_TUGAS; if (state) render(state, true); });
function renderTugas(s, keadaan) {
  const tugas = s.tugas ?? [], selesai = s.selesaiHariIni ?? [], now = Date.now();
  const el = document.getElementById("tugas");
  document.getElementById("hitung-tugas").textContent = tugas.length ? `${tugas.length}` : "";
  const elS = document.getElementById("selesai-hari-ini");
  elS.hidden = !selesai.length;
  const MAKS_SELESAI = 6;
  elS.querySelector("ul").innerHTML = selesai.slice(0, MAKS_SELESAI).map((t) => `<li><time${t.ts ? ` datetime="${new Date(t.ts).toISOString()}"` : ""}>${t.ts ? fmtJam(t.ts) : "✓"}</time>
      <span class="judul" title="${esc(t.id)} · ${esc(t.tugas)}">${esc(t.tugas)}</span></li>`).join("")
    + (selesai.length > MAKS_SELESAI ? `<li class="lain"><span></span><span class="kosong">dan ${selesai.length - MAKS_SELESAI} tugas lainnya</span></li>` : "");
  elS.querySelector(".hitung").textContent = selesai.length ? `${selesai.length}` : "";
  const tampil = SEMUA_TUGAS ? tugas : tugas.slice(0, MAKS_KARTU_TUGAS);
  tombolSemuaTugas.hidden = tugas.length <= MAKS_KARTU_TUGAS;
  tombolSemuaTugas.setAttribute("aria-expanded", String(SEMUA_TUGAS));
  tombolSemuaTugas.textContent = SEMUA_TUGAS ? "Tampilkan lebih sedikit" : `Lihat semua tugas (${tugas.length})`;
  el.innerHTML = tugas.length ? tampil.map((t) => {
    const st = statusTugas(t.status), tahap = tahapTugas(t.fase), waktu = kalimatWaktuTahap(t.kemajuan);
    const { pemilik, bantu, pemilikDiSini } = pelakuTugas(t, s, keadaan);
    const stPemilik = pemilik && pemilikDiSini ? keadaan[pemilik] : null;
    const proyek = t.folder && !/[\\/]ruang[\\/]/.test(t.folder) ? t.folder.split(/[\\/]/).filter(Boolean).at(-1) : "";
    const seg = tahap ? `<span class="seg" aria-hidden="true">${Array.from({ length: tahap.dari }, (_, i) => `<i class="${i < tahap.ke ? "lewat-tahap" : i === tahap.ke ? "kini" : ""}"></i>`).join("")}</span>` : "";
    const lama = t.dibuat ? `Berjalan ${durasi((now - t.dibuat) / 60e3)}` : "";
    const siapa = pemilik
      ? `${stPemilik && stPemilik !== "siap" ? `<i class="simbol ${stPemilik}" aria-hidden="true">${SIMBOL[stPemilik]}</i>` : ""}<span><b>${esc(pemilik)}</b>${stPemilik && !["siap", "kosong"].includes(stPemilik) ? ` · ${esc(LABEL_STATUS[stPemilik].toLowerCase())}` : ""}${bantu.length ? ` · dibantu ${bantu.map((n) => `<abbr title="${esc(n)}">${esc(TIM[n].pendek)}</abbr>`).join(", ")}` : ""}</span>`
      : t.pemilik ? `<span><b>${esc(t.pemilik)}</b></span>` : "";
    return `<li data-id="${esc(t.id)}"${t.id === TUGAS_SOROT ? ' class="sorot"' : ""}>
      <span class="atas-kartu"><span class="st" style="--warna:${WARNA_STATUS[st] ?? "var(--santai)"}">${esc(kataStatusTugas(st))}</span>${t.prioritas === "segera" ? `<span class="segera">Segera</span>` : ""}<span class="id">${esc(t.id)}${proyek ? ` · ${esc(proyek)}` : ""}</span></span>
      <span class="judul">${esc(t.tugas)}</span>
      ${tahap ? `<span class="tahap">${seg}<span>Tahap <b>${esc(tahap.nama)}</b> · ${tahap.ke + 1} dari ${tahap.dari}</span></span>` : ""}
      ${siapa ? `<span class="siapa">${siapa}</span>` : ""}
      ${lama || waktu ? `<span class="waktu">${esc(lama)}${lama && waktu ? " · " : ""}${waktu ? `<span class="${waktu.lewat ? "lewat" : ""}">${waktu.lewat ? "⏱ " : ""}${esc(waktu.teks)}</span>` : ""}</span>` : ""}</li>`;
  }).join("") : `<li><p class="kosong">Belum ada tugas berjalan. Tugas yang diterima COO muncul di sini.</p></li>`;
}

/** Tim engineering yang dipakai: punya proyek, atau ada anggotanya yang hadir. Tim lain: meja kosong & redup. */
function timTerlihat(s) {
  const hasil = new Set();
  for (const n of NOMOR_TIM) {
    const proyek = s.tim?.find((t) => t.n === n)?.proyek;
    if (proyek || URUT.some((x) => TIM[x].divisi === `tim${n}` && s.agents.find((a) => a.name === x)?.present)) hasil.add(`tim${n}`);
  }
  return hasil;
}
/** Tim engineering per proyek: papan nama & judul kelompok memakai nama proyek; tim yang belum dipakai disembunyikan. */
function renderTim(s, terlihat) {
  for (const n of NOMOR_TIM) {
    const proyek = s.tim?.find((t) => t.n === n)?.proyek ?? null;
    const anggota = URUT.filter((x) => TIM[x].divisi === `tim${n}`);
    const aktif = terlihat.has(`tim${n}`);
    KELOMPOK[`tim${n}`].querySelector("span").textContent = `Engineering · Tim ${n}${proyek ? ` — ${proyek}` : ""}`;
    for (const el2 of [KELOMPOK[`tim${n}`], ...anggota.flatMap((x) => [LI[x], LABEL_JALUR[x], SEL[x]])]) el2.hidden = !aktif;
    for (const x of anggota) if (MEJA[x]) MEJA[x].tag.classList.toggle("tim-kosong", !aktif);
  }
}
/** Nama zona (adegan 3D): papan berdiri + tulisan lantai — nama divisi, proyek tim; tim tanpa proyek diredupkan. */
function perbaruiTulisanZona(s, terlihat) {
  const tim = NOMOR_TIM.map((n) => ({ n, proyek: s.tim?.find((t) => t.n === n)?.proyek ?? null, aktif: terlihat.has(`tim${n}`) }));
  adegan?.aturTulisanZona(tulisanZona(DIVISI, { tim, sempit: SEMPIT, warnaLounge: WARNA_LOUNGE }));
  adegan?.aturPapanZona(isiPapanZona(DIVISI, { tim, warnaLounge: WARNA_LOUNGE }));
}
/** Jejak kerja nyata di 3D: papan tulis tiap tim & Corporate Strategy, papan tugas, berkas di meja (hanya ID + judul). */
let BERKAS = {};
function renderJejak(s, terlihat) {
  const perDivisi = papanDivisi(s.tugas, s.tim), isi = { tugas: papanTugas(s.tugas, s.selesaiHariIni ?? []) };
  for (const n of NOMOR_TIM) {
    if (!terlihat.has(`tim${n}`)) continue;   // tim tanpa proyek: papan kosong
    const proyek = s.tim?.find((t) => t.n === n)?.proyek;
    isi[`tim${n}`] = { judul: `Tim ${n}${proyek ? ` · ${proyek}` : ""} — tugas berjalan`, tugas: perDivisi[`tim${n}`] ?? [] };
  }
  isi.corp = { judul: "Corporate Strategy — tugas berjalan", tugas: perDivisi.corp ?? [] };
  adegan?.aturPapan(isi);
  adegan?.aturLampuTim(new Set([...terlihat]));
  BERKAS = Object.fromEntries(Object.entries(berkasMeja(s.selesaiHariIni ?? [], s.tim))
    .filter(([k]) => !TIM[k].divisi.startsWith("tim") || terlihat.has(TIM[k].divisi)));
  adegan?.aturBerkas(Object.fromEntries(Object.entries(BERKAS).map(([k, v]) => [k, v.length])));
}

/** Keadaan tampil semua kursi; kursi tim tanpa proyek = "kosong". */
function keadaanSemua(s, terlihat, now = Date.now()) {
  return Object.fromEntries(URUT.map((nama) => {
    const ag = s.agents.find((a) => a.name === nama), dv = TIM[nama].divisi;
    return [nama, !dv.startsWith("tim") || terlihat.has(dv) ? keadaanTampil(ag, now) : "kosong"];
  }));
}
/** Tim ringkas: anggota yang bekerja/berpikir/menunggu/baru selesai tampil lengkap; yang siap dipanggil diringkas per
 *  divisi (avatar kecil + jumlah) dan baru tampil lengkap bila ringkasannya dibuka atau orangnya dipilih. */
function ringkasTim(keadaan, terlihat) {
  let jumlahSiap = 0;
  for (const dv of DIVISI) {
    const anggota = URUT.filter((n) => TIM[n].divisi === dv.id);
    const r = RINGKAS_SIAP[dv.id], tampil = !dv.id.startsWith("tim") || terlihat.has(dv.id);
    const siap = tampil ? anggota.filter((n) => keadaan[n] === "siap") : [];
    jumlahSiap += siap.length;
    const buka = TERBUKA.has(dv.id);
    if (tampil) { const sembunyi = barisTersembunyi(anggota, keadaan, { buka, dipilih }); for (const n of anggota) LI[n].hidden = sembunyi.has(n); }
    const ringkas = siap.filter((n) => dipilih !== n || buka);
    r.hidden = !ringkas.length;
    if (!ringkas.length) continue;
    const b = r.querySelector("button");
    b.setAttribute("aria-expanded", String(buka));
    b.setAttribute("aria-label", buka ? `Ringkas lagi anggota ${dv.nama} yang siap dipanggil` : `${dv.nama}: ${ringkas.length} siap dipanggil — ${ringkas.join(", ")}. Tampilkan`);
    r.querySelector(".tumpuk").innerHTML = buka ? "" : ringkas.slice(0, 5).map((n) => `<i style="--warna:${TIM[n].warna}">${TIM[n].inisial}</i>`).join("") + (ringkas.length > 5 ? `<i style="--warna:var(--santai)">+${ringkas.length - 5}</i>` : "");
    r.querySelector(".teks").textContent = buka ? "Ringkas lagi" : `${ringkas.length} siap dipanggil`;
    r.querySelector(".panah").textContent = buka ? "▾" : "▸";
  }
  const aktif = Object.values(keadaan).filter((st) => st !== "siap" && st !== "kosong").length;
  document.getElementById("tim-sub").textContent = `${aktif} aktif · ${jumlahSiap} siap dipanggil`;
}

/** Ringkasan atas (DESAIN.md › Ringkasan): Menunggu Anda · Sedang bekerja · Tugas berjalan · Selesai hari ini. */
let kalimatRingkasLama = "";
function renderRingkasan(s, keadaan) {
  const r = ringkasan(keadaan, s.tugas ?? [], s.selesaiHariIni ?? [], statusTugas);
  const isi = (id, nilai, ket) => { const el = document.getElementById(id); el.querySelector(".nilai").textContent = nilai; el.querySelector(".ket").textContent = ket; return el; };
  const daftar = (xs) => xs.slice(0, 3).map((n) => TIM[n].pendek).join(", ") + (xs.length > 3 ? ` +${xs.length - 3}` : "");
  isi("angka-menunggu", r.menunggu.length, r.menunggu.length === 1 ? `${TIM[r.menunggu[0]].pendek} menunggu jawaban Anda`
    : r.menunggu.length ? `${daftar(r.menunggu)} menunggu jawaban Anda` : "Tidak ada yang menunggu Anda").classList.toggle("ada", r.menunggu.length > 0);
  isi("angka-bekerja", r.bekerja.length, r.bekerja.length ? daftar(r.bekerja) : "Tidak ada yang bekerja");
  isi("angka-tugas", r.tugas.semua, r.tugas.semua ? [r.tugas.berjalan && `${r.tugas.berjalan} dikerjakan`, r.tugas.lain && `${r.tugas.lain} lainnya`].filter(Boolean).join(" · ") : "Belum ada tugas");
  const akhir = (s.selesaiHariIni ?? [])[0];
  isi("angka-selesai", r.selesai, akhir ? `Terakhir: ${akhir.tugas}` : "Belum ada").title = akhir ? `Terakhir selesai: ${akhir.tugas}` : "";
  document.getElementById("angka-menunggu").setAttribute("href", r.menunggu.length ? "#perhatian" : "#judul-tim");
  const kalimat = `${r.menunggu.length} menunggu Anda, ${r.bekerja.length} sedang bekerja, ${r.tugas.semua} tugas berjalan, ${r.selesai} selesai hari ini.`;
  if (kalimat !== kalimatRingkasLama) { kalimatRingkasLama = kalimat; document.getElementById("ringkas-kalimat").textContent = kalimat; }
  document.title = r.menunggu.length ? `(${r.menunggu.length}) Kantor RudisOne` : "Kantor RudisOne";
}

/** Aktivitas: kalimat kerja per tugas, 10 baris terbaru (+ "Lihat semua"); rincian teknis singkat di "rincian". */
const BARIS_AKTIVITAS = 10;
let SEMUA_AKTIVITAS = false;
const tombolSemua = document.getElementById("lihat-semua");
tombolSemua.addEventListener("click", () => { SEMUA_AKTIVITAS = !SEMUA_AKTIVITAS; if (state) renderAktivitas(state); });
function renderAktivitas(s) {
  const judul = Object.fromEntries([...(s.tugas ?? []), ...(s.selesaiHariIni ?? [])].map((t) => [t.id, t.tugas]));
  const semua = kelompokAktivitas(s.feed, judul);
  const total = semua.reduce((n, g) => n + g.baris.length, 0);
  const grup = SEMUA_AKTIVITAS ? semua : kelompokAktivitas(s.feed, judul, { maksBaris: BARIS_AKTIVITAS });
  const terbuka = new Set([...elAkt.querySelectorAll("details[open]")].map((d) => d.dataset.k));
  elAkt.innerHTML = grup.length ? grup.map((g) => `<section class="grup">
      <h3>${g.id ? `<span class="id">${esc(g.id)}</span><span class="j">${esc(g.judul ?? "")}</span>` : `<span class="j">Di luar tugas terdaftar</span>`}</h3>
      <ol>${g.baris.map((b) => { const k = `${b.ts}|${b.agent}`;
        return `<li style="--warna:${TIM[b.agent]?.warna ?? "var(--santai)"}"><time datetime="${new Date(b.ts).toISOString()}" title="${esc(new Date(b.ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }))} WIB">${fmtJam(b.ts)}</time><i class="titik" aria-hidden="true"></i>
        <span><b>${esc(b.agent)}</b> ${esc(b.kerja)}${b.rincian.length ? `<details data-k="${esc(k)}"${terbuka.has(k) ? " open" : ""}><summary>rincian</summary><ul>${b.rincian.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></details>` : ""}</span></li>`; }).join("")}</ol></section>`).join("")
    : `<p class="kosong">Belum ada aktivitas dalam 24 jam terakhir.</p>`;
  tombolSemua.hidden = total <= BARIS_AKTIVITAS;
  tombolSemua.setAttribute("aria-expanded", String(SEMUA_AKTIVITAS));
  tombolSemua.textContent = SEMUA_AKTIVITAS ? "Tampilkan 10 terbaru saja" : `Lihat semua aktivitas (${total})`;
}

function render(s, ulang = false) {
  state = s;
  if (!ulang) diterimaPada = Date.now();
  const perhatian = [], terlihat = timTerlihat(s), now = Date.now(), keadaan = keadaanSemua(s, terlihat, now);
  for (const nama of URUT) {
    const ag = s.agents.find((a) => a.name === nama) ?? { name: nama, present: false, status: "absen", label: "Belum masuk", detail: "", sessions: [], timeline: [] };
    const st = keadaan[nama], dari = ag.subagent?.dari;
    terapkanStatus(ag, pertama, st);
    adegan?.aturLayar(nama, st === "kosong" ? null : st);
    const m = MEJA[nama];
    // papan meja ringkas: nama pendek; baris aksi saat menunggu Anda, baru selesai, subagent/asisten, atau saat meja dipilih
    const jumlahSesi = ag.sessions?.length ?? 0;
    const jumlahAsisten = (s.asisten ?? []).filter((a) => a.induk === nama && a.status === "aktif").length;
    const namaBaru = jumlahSesi > 1 ? `${TIM[nama].pendek} ×${jumlahSesi}` : TIM[nama].pendek;
    const kerja = st === "bekerja" || st === "berpikir";
    const aksiBaru = st === "menunggu" ? "Menunggu Anda" : st === "selesai" ? teksSelesai(ag.selesai.ts, now)
      : dari && kerja ? potong(`dipanggil ${TIM[dari]?.pendek ?? dari}`, 30)
      : jumlahAsisten ? `+${jumlahAsisten} asisten`
      : dipilih === nama && kerja ? potong(kalimatKerja(ag), 30)
      : dipilih === nama && st === "siap" ? (ORANG[nama]?.istirahat ? "Siap dipanggil · istirahat" : "Siap dipanggil") : "";
    const kelasTag = `tag ${st}${dipilih === nama ? " dipilih" : ""}${m.tag.classList.contains("tim-kosong") ? " tim-kosong" : ""}`;
    if (m.namaT.textContent !== namaBaru || m.aksiT.textContent !== aksiBaru || m.tag.className !== kelasTag) {
      m.namaT.textContent = namaBaru; m.aksiT.textContent = aksiBaru; m.tag.className = kelasTag;
      m.simbol.className = `simbol ${st}`; m.simbol.textContent = SIMBOL[st];
      adegan?.mintaGambar();
    }
    const rinciAman = rincianAman(ag.detail, ag.label);
    const rinciKerja = kerja || st === "menunggu" ? `: ${kalimatKerja(ag)}${rinciAman ? `, ${rinciAman}` : ""}${dari ? `, dipanggil oleh ${dari}` : ""}`
      : st === "selesai" ? `: ${waktuSelesai(ag.selesai.ts, now)}` : st === "siap" ? `: ${keteranganSiap(ag)}` : "";
    m.tag.setAttribute("aria-label", `${nama}, ${LABEL_STATUS[st]}${rinciKerja}`);
    m.tag.setAttribute("aria-pressed", String(dipilih === nama));
    if (st === "menunggu") perhatian.push(ag);
    const li = LI[nama];
    li.className = st;
    li.querySelector(".simbol").className = `simbol ${st}`;
    li.querySelector(".simbol").textContent = SIMBOL[st];
    li.querySelector(".keadaan").innerHTML = kerja || st === "menunggu"
      ? `<b>${esc(st === "menunggu" ? "Menunggu jawaban Anda" : kalimatKerja(ag))}</b>${dari ? ` <span class="bantu-dari">· dipanggil <abbr title="${esc(dari)}">${esc(TIM[dari]?.pendek ?? dari)}</abbr></span>` : ""}${jumlahAsisten ? ` · ${jumlahAsisten} asisten` : ""}`
      : st === "selesai" ? `<b>${esc(teksSelesai(ag.selesai.ts, now))}</b>`
      : `Siap dipanggil`;
    li.title = st === "siap" ? keteranganSiap(ag) : "";
    li.querySelector(".waktu").textContent = ag.present ? lalu(ag.lastTs) : "";
    let aktif = 0;
    [...SEL[nama].children].forEach((c, i) => { const n = ag.timeline?.[i]?.n ?? 0; if (n) aktif++; c.dataset.n = n >= 4 ? 3 : n >= 2 ? 2 : n; });
    SEL[nama].setAttribute("aria-label", `${nama}: aktif ${aktif} dari 60 menit terakhir`);
  }
  renderTugas(s, keadaan);
  renderTim(s, terlihat);
  ringkasTim(keadaan, terlihat);
  renderRingkasan(s, keadaan);
  perbaruiTulisanZona(s, terlihat);
  renderJejak(s, terlihat);
  terapkanAsisten(s.asisten);
  sorotTugasDariTautan(s);
  elPerhatian.hidden = perhatian.length === 0;
  document.getElementById("daftar-perhatian").innerHTML = perhatian.map((a) =>
    `<li><i class="simbol menunggu" aria-hidden="true">!</i><b>${esc(a.name)} menunggu jawaban Anda</b>
     <span class="cara">Buka percakapan “${esc(a.sessions[0]?.title ?? a.name)}” di Claude untuk menjawab.</span></li>`).join("");
  renderAktivitas(s);
  if (dipilih) isiRincian();
  if (SENTUH) isiKartu(SENTUH);
  for (const f of ulang ? [] : [...s.feed].reverse()) {
    const kunci = `${f.ts}|${f.agent}|${f.label}|${f.to ?? ""}`;
    if (sudahLihat.has(kunci)) continue;
    sudahLihat.add(kunci);
    if (pertama || Date.now() - f.ts > 90e3) continue;
    if (f.icon === "pesan" && f.to) ceritakan(f);
  }
  if (!ulang) pertama = false;
  const hitung = (k) => Object.values(keadaan).filter((x) => x === k).length;
  elPanggung.setAttribute("aria-label", `Denah kantor 3D: ${hitung("bekerja")} bekerja, ${hitung("menunggu")} menunggu Anda, ${hitung("berpikir")} berpikir, ${hitung("selesai")} baru selesai, ${hitung("siap")} siap dipanggil. Papan tulis tim dan papan tugas menampilkan tugas dari register. Rincian tiap orang ada di panel Tim.`);
}

// ================= koneksi, jam, kamera, jeda gerak =================
const elKon = document.getElementById("koneksi"), elKonT = document.getElementById("koneksi-teks");
let modeDemo = false, putus = false;
// suasana mengikuti jam WIB (pagi · siang · sore · malam); `?jam=sore` / `?jam=19:30` memaksa fase untuk uji
const FASE_UJI = faseDariParam(PARAM.get("jam"));
const NAMA_FASE = { pagi: "pagi", siang: "siang", sore: "sore", malam: "malam" };
let faseKini = null, terakhirSelesaiCek = 0;
function perbaruiWaktu() {
  const f = FASE_UJI ?? faseWaktu(jamWIB());
  if (f === faseKini) return;
  faseKini = f;
  document.documentElement.dataset.waktu = f;
  adegan?.aturWaktu(f);
}
function detik() {
  perbaruiWaktu();
  document.getElementById("jam").textContent = `${fmtJam(Date.now())} WIB · ${NAMA_FASE[faseKini]}${FASE_UJI ? " (jam uji)" : ""}`;
  // "Baru selesai N mnt lalu" berganti menit & berakhir setelah 10 menit tanpa menunggu data baru dari server
  if (state && Date.now() - terakhirSelesaiCek > 15e3) { terakhirSelesaiCek = Date.now(); render(state, true); }
  if (modeDemo) return;
  const umur = diterimaPada ? Math.round((Date.now() - diterimaPada) / 1000) : null;
  elKon.classList.toggle("putus", putus);
  elKon.classList.toggle("basi", !putus && umur !== null && umur > 30);
  if (putus) elKonT.textContent = "Terputus dari server Kantor · mencoba lagi";
  else if (umur !== null) elKonT.textContent = umur > 30 ? `Data mungkin basi · diperbarui ${umur} dtk lalu` : "Terhubung · data terkini";
  if (state) for (const [n, li] of Object.entries(LI)) { const a = state.agents.find((x) => x.name === n); li.querySelector(".waktu").textContent = a?.present ? lalu(a.lastTs) : ""; }
}
function sambung() {
  const es = new EventSource("/events");
  es.onopen = () => { putus = false; detik(); };
  es.onmessage = (e) => { putus = false; render(JSON.parse(e.data)); detik(); };
  es.onerror = () => { putus = true; detik(); };
}
const tbKecil = document.getElementById("zoom-kecil"), tbBesar = document.getElementById("zoom-besar"), tbPas = document.getElementById("zoom-pas");
/** Tombol kamera "tidak aktif" di batasnya — aria-disabled (bukan disabled) agar fokus keyboard tidak hilang. */
function perbaruiTombolZoom() {
  if (!adegan) return;
  const k = adegan.kontrol, d = adegan.camera.position.distanceTo(k.target);
  const set = (el, mati) => { el.setAttribute("aria-disabled", String(mati)); el.classList.toggle("mati", mati); };
  set(tbPas, adegan.dekatSeluruh() && !adegan.terbang);
  set(tbBesar, d <= k.minDistance + 0.05); set(tbKecil, d >= k.maxDistance - 0.05);
}
tbBesar.addEventListener("click", () => adegan?.zoom(0.7));
tbKecil.addEventListener("click", () => adegan?.zoom(1.4));
tbPas.addEventListener("click", () => adegan?.seluruhDenah());
document.getElementById("putar-kiri").addEventListener("click", () => adegan?.putar(-Math.PI / 12));
document.getElementById("putar-kanan").addEventListener("click", () => adegan?.putar(Math.PI / 12));

const tombolBantuan = document.getElementById("tombol-bantuan"), elPetunjuk = document.getElementById("petunjuk");
tombolBantuan.addEventListener("click", () => { const buka = elPetunjuk.hidden; elPetunjuk.hidden = !buka; tombolBantuan.setAttribute("aria-expanded", String(buka)); });
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

// ================= label: tingkat rincian ikut zoom, kartu sentuh, tombol Label =================
/** Tingkat rincian (jauh/dekat) dari jarak kamera terhadap "Seluruh denah"; layar sempit mengubah tulisan lantai. */
function aturRincian(paksa = false) {
  if (!adegan) return;
  const t = tingkatRincian(adegan.camera.position.distanceTo(adegan.kontrol.target), adegan.jarakPas());
  const sempit = elPanggung.clientWidth < 600, ubahSempit = sempit !== SEMPIT;
  SEMPIT = sempit;
  if (t !== TINGKAT || ubahSempit || paksa) {
    TINGKAT = t;
    elLapis.dataset.tingkat = t; elLapis.dataset.label = MODE;
    elLapis.classList.toggle("tanpa-ucapan", !ucapanTampil(MODE, t));
    for (const o of [...Object.values(ORANG), ...Object.values(ASISTEN)]) segarkanKepala(o);
    adegan.mintaGambar();
  }
  if (ubahSempit && state) perbaruiTulisanZona(state, timTerlihat(state));
}
// kartu sentuh: nama + status orang yang di-hover, difokus (Tab ke tag meja), atau dipilih (klik/ketuk). Dapat di-hover,
// menetap, dan ditutup dengan Esc tanpa memindah fokus (WCAG 1.4.13); padanan pembaca layarnya aria-label tag meja.
let KARTU = null, kartuDiAtas = false, tundaHover = 0;
function bangunKartu() {
  const el = div("kartu-orang", `<span class="isi"><b class="k-nama"></b><span class="k-status"></span><small class="k-petunjuk"></small></span>`);
  el.setAttribute("aria-hidden", "true"); el.hidden = true;
  el.addEventListener("mouseenter", () => { kartuDiAtas = true; clearTimeout(tundaHover); });
  el.addEventListener("mouseleave", () => { kartuDiAtas = false; aturHover(null); });
  el.addEventListener("click", () => { if (SENTUH) pilih(SENTUH); });
  el.addEventListener("pointerdown", (e) => e.preventDefault());   // fokus tetap di tag meja: kartu dari Tab tetap bisa diklik
  KARTU = { el, l: adegan.tambahLabel(el, 0, 0, 0, null, { prioritasFn: () => (el.hidden ? 0 : 6) }) };
}
function aturHover(nama) {
  clearTimeout(tundaHover);
  if (nama) { if (HOVER !== nama) { HOVER = nama; perbaruiKartu(); } return; }
  tundaHover = setTimeout(() => { if (!kartuDiAtas && HOVER) { HOVER = null; perbaruiKartu(); } }, 300);   // waktu untuk pindah ke kartu
}
function isiKartu(nama) {
  if (!KARTU || !state) return;
  const ag = state.agents.find((a) => a.name === nama) ?? { name: nama }, st = ORANG[nama]?.status ?? "siap", now = Date.now();
  const rinci = st === "bekerja" || st === "berpikir" ? (ag.label ? ` · ${potong(kalimatKerja(ag), 46)}` : "")
    : st === "selesai" ? ` · ${waktuSelesai(ag.selesai?.ts, now)}` : st === "siap" ? ` · ${keteranganSiap(ag)}` : "";
  const el = KARTU.el, dari = ag.subagent?.dari;
  el.style.setProperty("--warna", TIM[nama].warna);
  el.querySelector(".k-nama").textContent = nama;
  el.querySelector(".k-status").innerHTML = `<i class="simbol ${st}">${SIMBOL[st]}</i>${esc(LABEL_STATUS[st])}${esc(rinci)}${dari ? ` <span class="sub">· dipanggil ${esc(TIM[dari]?.pendek ?? dari)}</span>` : ""}`;
  el.querySelector(".k-petunjuk").textContent = dipilih === nama ? "Rincian ada di panel Tim" : "Klik untuk rincian";
}
function perbaruiKartu() {
  const calon = FOKUS ?? HOVER ?? dipilih ?? null;
  const target = calon && ORANG[calon]?.tampak && ORANG[calon]?.m ? calon : null;
  const lama = SENTUH;
  SENTUH = target;
  if (lama && ORANG[lama]) segarkanKepala(ORANG[lama]);
  if (target) segarkanKepala(ORANG[target]);
  if (!KARTU) return;
  KARTU.el.hidden = !target;
  if (!target) kartuDiAtas = false;   // mouseleave tidak dijamin terkirim untuk elemen yang disembunyikan
  if (target) {
    KARTU.l.ikut = ORANG[target].m.akar; KARTU.l.offset = 1.95 * SKALA_ORANG;
    KARTU.el.classList.toggle("fokus", FOKUS === target);
    isiKartu(target);
  }
  adegan?.mintaGambar();
}
// Esc menutup kartu (hover/fokus) tanpa memindah fokus; denah yang difokus juga membatalkan pilihan (adegan.mjs)
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !(HOVER || FOKUS)) return;
  HOVER = null; FOKUS = null; perbaruiKartu();
});
// tombol Label: Ringkas (bawaan) · Lengkap · Tanpa — grup radio (panah kiri/kanan berpindah), pilihan diingat per peramban
const elPilihLabel = document.getElementById("pilih-label");
function aturModeLabel(mode, simpan = true) {
  MODE = MODE_LABEL.includes(mode) ? mode : "ringkas";
  for (const r of elPilihLabel.querySelectorAll("input")) r.checked = r.value === MODE;
  if (simpan) try { localStorage.setItem(KUNCI_SIMPAN_LABEL, MODE); } catch { /* abaikan */ }
  if (adegan) aturRincian(true);
}
elPilihLabel.addEventListener("change", (e) => { if (e.target.name === "label") aturModeLabel(e.target.value); });

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
  elKonT.textContent = "Mode demo · data contoh, bukan aktivitas nyata"; elKon.classList.add("basi");
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
  let keadaan = awal(), feed = [], terakhir = -1, selesaiDemo = {};
  const TUGAS_DEMO = { [L1]: "T-20260101-2", [S1]: "T-20260101-2", [P1]: "T-20260101-2", [L2]: "T-20260101-4", [S2]: "T-20260101-4",
    [ITOPS]: "T-20260101-3", [SYSADM]: "T-20260101-3", [STRAT]: "T-20260101-5", [FIN]: "T-20260101-5", [PM]: null };
  const mulaiDemo = Date.now();
  const tahap = (fase, menitTahap, anggaran, menitTotal) => ({ fase, dibuat: mulaiDemo - menitTotal * 60e3,
    kemajuan: anggaran === null ? null : { menit: menitTahap, anggaran, lewat: menitTahap > anggaran } });
  const mulai = performance.now();
  const kirim = () => {
    const now = Date.now();
    const agents = URUT.map((name, i) => {
      const k = keadaan[name], timeline = Array.from({ length: 60 }, (_, m) => ({ n: (m * 7 + i * 13) % 9 < 3 ? ((m + i) % 5) : 0 }));
      const selesai = selesaiDemo[name] ? { ts: selesaiDemo[name] } : null;
      return k.status === "absen"
        ? { name, present: false, status: "absen", mode: name === CHIEF || name === ITOPS || name.startsWith("Tech Lead") ? "absen" : "katalog",
            label: "Belum masuk", detail: "", icon: "absen", lastTs: 0, selesai, sessions: [], timeline }
        : { name, present: true, ...k, mode: k.status === "santai" ? "siaga" : "aktif", selesai: k.status === "santai" ? selesai : null,
            lastTs: now - i * 30e3, timeline, sessions: [{ title: `${name} · contoh`, label: k.label, cwd: "~/contoh" }] };
    });
    // asisten contoh: Tech Lead Tim 1 menambah dua asisten engineer, Head of Strategy satu asisten riset
    const asisten = [["d1", L1, 20, 42, "Menulis", "kode", "Asisten: tes qty"], ["d2", L1, 22, 46, "Menjalankan tes", "tes", "Asisten: cek regresi"],
      ["d3", STRAT, 33, 50, "Riset di web", "web", "Asisten: harga pesaing"]]
      .filter(([, , a, b]) => terakhir >= a && terakhir < b + 8)
      .map(([id, induk, a, b, label, icon, deskripsi]) => ({ id, induk, status: terakhir >= b ? "selesai" : "aktif", label, icon, deskripsi, jenis: "general-purpose" }));
    const selesaiHariIni = [{ id: "T-20260101-1", tugas: "Audit modul kasir terhadap standar", pemilik: "Tech Lead · Tim 1", ts: now - 2 * 3600e3 },
      { id: "T-20260101-6", tugas: "SOP cuti karyawan", pemilik: "HR Business Partner", ts: now - 3 * 3600e3 },
      { id: "T-20260101-7", tugas: "Riset harga paket pesaing", pemilik: "Research Analyst", ts: now - 4 * 3600e3 }];
    render({ now, agents, feed: [...feed].reverse(), asisten, selesaiHariIni, tim: [{ n: 1, proyek: "kasir" }, { n: 2, proyek: "toko-b" }], tugas: [
      { id: "T-20260101-3", tugas: "Insiden stok minus cabang 2", folder: "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-it-operations", pemilik: "Head of IT Operations", prioritas: "segera", status: "berjalan", ...tahap("—", 0, null, 18) },
      { id: "T-20260101-2", tugas: "Perbaikan cetak SJ paging", folder: "~/Documents/kasir", pemilik: "Tech Lead · Tim 1", prioritas: "normal", status: "berjalan", ...tahap("Konstruksi", 31, 25, 64) },
      { id: "T-20260101-4", tugas: "Landing page toko-b", folder: "~/Documents/toko-b", pemilik: "Tech Lead · Tim 2", prioritas: "normal", status: "berjalan", ...tahap("Analisis", 6, 11, 22) },
      { id: "T-20260101-5", tugas: "Kelayakan paket harga toko-b", folder: "~/Documents/Neuron/ai-agent/RudisOne/ruang/head-of-strategy", pemilik: "Head of Strategy", prioritas: "normal", status: "berjalan", ...tahap("—", 0, null, 9) },
      { id: "T-20260101-8", tugas: "Laporan stok bulanan", folder: "~/Documents/kasir", pemilik: "Tech Lead · Tim 1", prioritas: "normal", status: "antre", ...tahap("—", 0, null, 3) },
    ] });
  };
  const putar = (dtk) => {
    if (dtk < terakhir) { keadaan = awal(); feed = []; selesaiDemo = {}; }
    for (const e of SKEN) if ((e[0] > terakhir && e[0] <= dtk) || (dtk < terakhir && e[0] <= dtk)) {
      if (e[1] === "pesan") feed.push({ ts: Date.now(), agent: e[2], label: `Mengirim pesan ke ${e[3]}`, detail: e[4][0].toUpperCase() + e[4].slice(1), icon: "pesan", to: e[3], jenis: e[4], tugas: TUGAS_DEMO[e[3]] ?? TUGAS_DEMO[e[2]] ?? null });
      else {
        // demo: yang berhenti bekerja ditandai baru selesai (di data nyata: dari server)
        if (e[2] === "santai" && keadaan[e[1]]?.status && keadaan[e[1]].status !== "santai" && keadaan[e[1]].status !== "absen") selesaiDemo[e[1]] = Date.now();
        keadaan[e[1]] = { status: e[2], label: e[3], detail: e[4], icon: e[5] }; feed.push({ ts: Date.now(), agent: e[1], label: e[3], detail: e[4], icon: e[5], tugas: TUGAS_DEMO[e[1]] ?? null }); }
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
try { await siapkanAdegan(); } catch (e) { adegan = null; O3 = null; tampilkanTanpa3d(e?.message === "WebGL2 tidak tersedia" ? null : `Grafis 3D gagal dimuat (${e?.message ?? e}).`); }
DENAH = adegan?.denah ?? (await import("./denah.mjs")).bangunDenah();
BLOK = bangunGrid(DENAH.perabot);
bangunMeja();   // tanpa WebGL pun: tag meja tetap ada (tidak ditampilkan) agar render panel tidak bergantung pada denah
for (const nama of URUT) bangunOrang(nama);
if (adegan) {
  bangunKartu();
  adegan.onKamera = () => { perbaruiTombolZoom(); aturRincian(); };
  adegan.onUkur = () => aturRincian();
  adegan.onHover = aturHover;
  perbaruiTombolZoom(); aturRincian(true);
  perbaruiTulisanZona({ tim: [] }, new Set());   // nama zona tampil sebelum data pertama datang
}
aturModeLabel(MODE, false);
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
