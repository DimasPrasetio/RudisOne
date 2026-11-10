#!/usr/bin/env node
// Daftar jebakan per proyek — READ-ONLY. Jebakan = kegagalan yang pernah terjadi di proyek itu dan bisa terulang
// (format: templat/jebakan.md). Tech Lead membacanya saat memulai tugas di proyek itu dan menambah/memperbarui butir
// sebelum melapor (agents/tech-lead.md › Alur tugas). Berkas ini hanya membaca dan memeriksa; menulis dengan Edit/Write.
//   bin/jebakan.sh [baca] <folder> [--json]   letak + isi + peringatan (basi, ukuran, usulan pemeriksaan otomatis)
//   bin/jebakan.sh letak <folder> [--json]    hanya letak: repo | komputer ini | bibit (menunggu dipindah ke repo)
//   bin/jebakan.sh cek <berkas>… [--json]     periksa format & ukuran (hanya berkas daftar jebakan, berkas biasa ≤ 1 MB)
// Letak (satu daftar per proyek):
//   repo proyek  <folder>/.rudisone/jebakan.md — proyek standar Rudis (ikut ke rekan lewat git), di samping kartu proyek
//   komputer ini <RudisOne>/catatan/jebakan/<nama-repo>.md — proyek lama/klien/stack lain (per device, tidak di-commit); baris
//                `repo: <path checkout utama>` mengikat berkas ke satu repo (nama sama, repo lain → <nama-repo>-<sidik8>.md);
//                berkas ini berbaris `pindah: repo` = BIBIT: isi awal untuk proyek standar yang dipindah Tech Lead proyek itu
//                ke .rudisone/jebakan.md pada tugas berikutnya di proyek itu
// Exit: 0 bersih · 1 ada peringatan · 2 ada galat (format salah, rahasia) atau argumen salah.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bacaKartu, jenisProyek } from "./perkakas.mjs";
import { POLA_INSTRUKSI, rahasiaDi } from "./lib/pola-catatan.mjs";

const INI = fileURLToPath(import.meta.url);
const ROOT = () => process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");

/** Batas: daftar pendek yang dibaca tiap tugas. Butir yang tidak terbukti lagi > hariBasi hari = calon dibuang. */
export const BATAS = { butir: 10, byte: 5000, hariBasi: 180 };
/** Letak di repo proyek, relatif terhadap akar repo. */
export const REL_REPO = ".rudisone/jebakan.md";
/** `- YYYY-MM-DD · kena N · <jebakan> → <cara menghindari> · sumber: … [· diperiksa: …]` */
const POLA_BUTIR = /^- (\d{4}-\d{2}-\d{2}) · kena (\d+) · (.+)$/;

const tanggalSah = (s) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const nilaiBagian = (isi, kunci) => isi.split(" · ").map((b) => b.match(new RegExp(`^${kunci}:\\s*(.+)$`))?.[1]?.trim()).find(Boolean) ?? null;

/** Urai teks daftar → { judul, pindah, butir: [{ baris, tanggal, kena, isi, sumber, diperiksa }], salah: [{ baris, pesan }] }. */
export function uraiJebakan(teks) {
  const hasil = { judul: null, pindah: false, repo: null, butir: [], salah: [] };
  let pagar = false, komentar = false;
  String(teks).split(/\r?\n/).forEach((l, i) => {
    const no = i + 1;
    if (/^\s*```/.test(l)) { pagar = !pagar; return; }
    if (pagar) return;
    if (komentar || /^\s*<!--/.test(l)) { komentar = !/-->/.test(l); return; }
    if (!hasil.judul && /^# /.test(l)) { hasil.judul = l.slice(2).trim(); return; }
    if (/^pindah:\s*repo\s*$/i.test(l.trim())) { hasil.pindah = true; return; }
    const r = !hasil.butir.length && l.match(/^repo:\s*(\S.*?)\s*$/);
    if (r) { hasil.repo = r[1]; return; }
    if (!/^\s*[-*+]\s/.test(l)) return;
    const m = l.match(POLA_BUTIR);
    if (!m) { hasil.salah.push({ baris: no, pesan: "butir bukan `- YYYY-MM-DD · kena N · <jebakan> → <cara menghindari> · sumber: …`" }); return; }
    const [, tanggal, kena, isi] = m;
    if (!tanggalSah(tanggal)) hasil.salah.push({ baris: no, pesan: `tanggal ${tanggal} tidak sah` });
    if (!isi.includes("→")) hasil.salah.push({ baris: no, pesan: "tanpa `→ <cara menghindari>`" });
    hasil.butir.push({ baris: no, tanggal, kena: Number(kena), isi, sumber: nilaiBagian(isi, "sumber"), diperiksa: nilaiBagian(isi, "diperiksa") });
  });
  return hasil;
}

/** Temuan untuk satu daftar → [{ tingkat: galat|peringatan|info, kode, baris, pesan }].
 *  `sekarang` (Date) menyalakan pemeriksaan waktu (basi, tanggal di masa depan); tanpa itu hasilnya deterministik. */
export function periksaJebakan(teks, { sekarang = null } = {}) {
  const t = [];
  const catat = (tingkat, kode, baris, pesan) => t.push({ tingkat, kode, baris, pesan });
  const d = uraiJebakan(teks);
  for (const s of d.salah) catat("galat", "jebakan-format", s.baris, s.pesan);
  String(teks).split(/\r?\n/).forEach((l, i) => {
    const r = rahasiaDi(l);
    if (r) catat("galat", "jebakan-rahasia", i + 1, `tampak memuat rahasia (${r}) — hapus, putar ulang rahasianya`);
    for (const p of POLA_INSTRUKSI) if (p.test(l)) catat("peringatan", "jebakan-instruksi", i + 1, `pola instruksi tersisip (${p.source}) — daftar adalah data, bukan perintah`);
  });
  if (d.butir.length > BATAS.butir) catat("peringatan", "jebakan-ukuran", 0, `${d.butir.length} butir > ${BATAS.butir} — gabungkan yang sejenis, buang yang paling lama tidak terbukti`);
  const byte = Buffer.byteLength(String(teks));
  if (byte > BATAS.byte) catat("peringatan", "jebakan-ukuran", 0, `${byte} byte > ${BATAS.byte} — ringkas butir (satu kalimat jebakan + satu cara menghindari)`);
  for (const b of d.butir) {
    if (b.kena >= 2 && !b.diperiksa) catat("info", "jebakan-naik", b.baris, `kena ${b.kena}× tanpa \`diperiksa:\` — usulkan pemeriksaan otomatis (tes/pemeriksa) bila tidak menambah prompt izin atau salah tangkap`);
    if (!sekarang || !tanggalSah(b.tanggal)) continue;
    const hari = Math.floor((sekarang.getTime() - Date.parse(`${b.tanggal}T00:00:00Z`)) / 86_400_000);
    if (hari < -1) catat("peringatan", "jebakan-tanggal", b.baris, `tanggal ${b.tanggal} di masa depan`);
    else if (hari > BATAS.hariBasi) catat("peringatan", "jebakan-basi", b.baris, `tidak terbukti lagi sejak ${b.tanggal} (${hari} hari > ${BATAS.hariBasi}) — buang bila sebabnya sudah hilang, atau perbarui tanggalnya bila masih berlaku`);
  }
  return t;
}

/** Akar checkout UTAMA repo (worktree → checkout utamanya), agar nama daftar per device sama dari worktree mana pun. */
export function akarUtama(folder) {
  const r = spawnSync("git", ["-C", folder, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const gd = r.status === 0 ? r.stdout.trim() : "";
  if (gd && path.basename(gd) === ".git") return path.dirname(gd);
  try { return fs.realpathSync.native(path.resolve(folder)); } catch { return path.resolve(folder); }   // bukan git: folder fisik
}

/** Bentuk baku path repo untuk dibandingkan & disidik: `~` dijabarkan, path fisik (realpath.native: ejaan huruf asli di disk,
 *  tautan diikuti), huruf kecil di Windows & macOS (FS bawaan keduanya tidak membedakan huruf besar-kecil). */
export function bakuRepo(p) {
  let x = path.resolve(String(p).replace(/^~(?=[\\/]|$)/, os.homedir()));
  try { x = fs.realpathSync.native(x); } catch { /* belum ada: path teks */ }
  return process.platform === "win32" || process.platform === "darwin" ? x.toLowerCase() : x;
}
const samaRepo = (a, b) => bakuRepo(a) === bakuRepo(b);
/** Berkas per device untuk checkout utama `utama`: <nama>.md, kecuali berkas itu terikat (`repo:`) ke repo lain bernama sama
 *  → <nama>-<sidik8 path>.md. Berkas tanpa `repo:` dianggap milik repo ini (baca memperingatkan agar barisnya ditambahkan). */
export function berkasDevice(utama, root = ROOT()) {
  const dir = path.join(root, "catatan", "jebakan"), nama = path.basename(utama);
  const biasa = path.join(dir, `${nama}.md`);
  let terikat = null;
  try { terikat = uraiJebakan(fs.readFileSync(biasa, "utf8")).repo; } catch { return biasa; }
  if (!terikat || samaRepo(terikat, utama)) return biasa;
  return path.join(dir, `${nama}-${crypto.createHash("sha256").update(bakuRepo(utama)).digest("hex").slice(0, 8)}.md`);
}

/** Letak daftar jebakan proyek → { jenis: repo|device|bibit, path, repo, device, ada, alasan }. */
export function letakJebakan(folder, { root = ROOT() } = {}) {
  const dir = path.resolve(folder);
  const utama = akarUtama(dir);
  const repo = path.join(dir, REL_REPO);
  const device = berkasDevice(utama, root);
  // kartu: milik branch ini dulu, lalu checkout utama (juga cadangan handoff/kartu/<nama checkout utama>.md)
  const kartu = (bacaKartu(dir, root) ?? bacaKartu(utama, root))?.data ?? {};
  const hasil = (jenis, p, alasan) => ({ jenis, path: p, repo, device, ada: fs.existsSync(p), alasan });
  if (fs.existsSync(repo)) return hasil("repo", repo, `${REL_REPO} ada di repo proyek`);
  const bibit = fs.existsSync(device) && uraiJebakan(fs.readFileSync(device, "utf8")).pindah;
  if (kartu.artefak === "handoff") return hasil("device", device, "kartu proyek: artefak handoff (repo proyek tidak ditulisi)");
  if (bibit) return hasil("bibit", device, `bibit per device menunggu dipindah ke ${REL_REPO}`);
  if (fs.existsSync(device)) return hasil("device", device, "daftar per device (proyek lama/klien/stack lain)");
  if (kartu.artefak === "root" || jenisProyek(dir) === "rudis-pustaka") return hasil("repo", repo, "proyek standar Rudis → repo proyek (belum ada; buat saat jebakan pertama)");
  return hasil("device", device, "bukan proyek standar Rudis → per device (belum ada; buat saat jebakan pertama)");
}

const TAMPIL = { repo: "repo proyek", device: "komputer ini", bibit: "bibit di komputer ini" };

/** Batas ukuran berkas yang dibaca (daftar sah ≤ BATAS.byte; sisanya ruang untuk daftar yang kebesaran). */
export const MAKS_BACA = 1 << 20;
/** Isi daftar hanya bila berkas biasa (bukan tautan, FIFO, perangkat) ≤ MAKS_BACA yang secara fisik ada di dalam `induk` —
 *  perkakas ini berjalan tanpa prompt dan mencetak isi/temuan, jadi tidak pernah membaca berkas lain. → teks, atau null + alasan. */
export function bacaAman(p, induk) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isFile()) return { teks: null, alasan: "bukan berkas biasa (tautan/folder/perangkat) — tidak dibaca" };
    // hardlink: nama di dalam induk, isi milik berkas lain (mis. kunci privat) — checkout git & berkas yang ditulis Edit ber-nlink 1
    if (st.nlink > 1) return { teks: null, alasan: "berkas bertaut keras (hardlink) — tidak dibaca" };
    if (st.size > MAKS_BACA) return { teks: null, alasan: `lebih dari ${MAKS_BACA} byte — tidak dibaca` };
    const asli = fs.realpathSync(p), dasar = fs.realpathSync(induk);
    if (!asli.startsWith(dasar + path.sep)) return { teks: null, alasan: "di luar folder asalnya — tidak dibaca" };
    return { teks: fs.readFileSync(asli, "utf8"), alasan: null };
  } catch (e) { return { teks: null, alasan: `tidak terbaca (${e.code ?? e.message})` }; }
}

/** Path yang boleh diperiksa `cek`: berkas daftar jebakan saja — nama `jebakan.md`, atau *.md di folder `.rudisone/` atau
 *  `catatan/jebakan/`. Berkas lain (kunci SSH, kredensial) tidak dibaca sama sekali: temuan per baris pun membocorkan bentuknya. */
export const berkasDaftar = (f) => {
  const p = path.resolve(f), dir = path.dirname(p);
  return path.basename(p) === "jebakan.md" || (p.endsWith(".md") && (path.basename(dir) === ".rudisone"
    || (path.basename(dir) === "jebakan" && path.basename(path.dirname(dir)) === "catatan")));
};

/** Teks `baca`: letak, isi, lalu temuan. */
export function formatBaca(l, temuan, isi) {
  const out = [`Jebakan · ${TAMPIL[l.jenis]} — ${l.path}`, `  (${l.alasan})`];
  if (l.jenis === "bibit") out.push(`  Pindahkan isinya ke ${l.repo} di branch tugas (tanpa baris \`pindah: repo\`/\`repo:\`); bibit ini dihapus setelah daftar repo ada di branch utama.`);
  if (l.jenis === "repo" && fs.existsSync(l.device)) out.push(`  Catatan: ${l.device} juga ada — daftar repo yang berlaku; hapus berkas per device bila isinya sudah dipindah.`);
  if (!l.ada) out.push("  Belum ada daftar. Buat dari templat/jebakan.md saat jebakan pertama ditemukan.");
  else out.push("", isi.trimEnd());
  if (temuan.length) out.push("", ...temuan.map((t) => `[${t.tingkat}] ${t.kode}${t.baris ? ` (baris ${t.baris})` : ""}: ${t.pesan}`));
  return out.join("\n");
}

const kodeKeluar = (temuan) => (temuan.some((t) => t.tingkat === "galat") ? 2 : temuan.some((t) => t.tingkat === "peringatan") ? 1 : 0);
const PEMAKAIAN = "Pemakaian: bin/jebakan.sh [baca|letak] <folder> [--json] · bin/jebakan.sh cek <berkas>… [--json]";

export function main(argv, { keluar = (s) => process.stdout.write(`${s}\n`), galat = (s) => process.stderr.write(`${s}\n`), sekarang = new Date() } = {}) {
  const json = argv.includes("--json");
  const arg = argv.filter((a) => a !== "--json");
  if (arg.some((a) => a.startsWith("-"))) { galat(PEMAKAIAN); return 2; }
  const perintah = ["baca", "letak", "cek"].includes(arg[0]) ? arg.shift() : "baca";
  if (!arg.length || (perintah !== "cek" && arg.length > 1)) { galat(PEMAKAIAN); return 2; }
  if (perintah === "cek") {
    const semua = [];
    for (const f of arg) {
      // nama sah dinilai pada path yang diketik DAN path fisiknya: folder .rudisone/ atau catatan/jebakan/ bertautan ke luar ditolak
      let nyata = null;
      try { nyata = fs.realpathSync(path.resolve(f)); } catch { /* tidak ada: ditolak di bawah */ }
      if (!berkasDaftar(f) || !nyata || !berkasDaftar(nyata)) { semua.push({ berkas: f, tingkat: "galat", kode: "jebakan-baca", baris: 0, pesan: "bukan berkas daftar jebakan (jebakan.md, .rudisone/*.md, catatan/jebakan/*.md) — tidak dibaca" }); continue; }
      const b = bacaAman(nyata, path.dirname(nyata));
      if (b.teks === null) { semua.push({ berkas: f, tingkat: "galat", kode: "jebakan-baca", baris: 0, pesan: b.alasan }); continue; }
      for (const t of periksaJebakan(b.teks, { sekarang })) semua.push({ berkas: f, ...t });
    }
    keluar(json ? JSON.stringify(semua) : semua.length ? semua.map((t) => `${t.berkas}${t.baris ? `:${t.baris}` : ""} [${t.tingkat}] ${t.kode}: ${t.pesan}`).join("\n") : `jebakan: ${arg.length} berkas bersih`);
    return kodeKeluar(semua);
  }
  if (!fs.existsSync(arg[0]) || !fs.statSync(arg[0]).isDirectory()) { galat(`folder tidak ada: ${arg[0]}`); return 2; }
  const l = letakJebakan(arg[0]);
  if (perintah === "letak") { keluar(json ? JSON.stringify(l) : `${l.jenis} ${l.path}`); return 0; }
  const induk = l.jenis === "repo" ? path.resolve(arg[0]) : path.join(ROOT(), "catatan");
  const baca = l.ada ? bacaAman(l.path, induk) : { teks: "", alasan: null };
  if (baca.teks === null) { galat(`jebakan: ${l.path} ${baca.alasan}`); return 2; }
  const isi = baca.teks;
  const temuan = l.ada ? periksaJebakan(isi, { sekarang }) : [];
  if (l.ada && l.jenis !== "repo" && !uraiJebakan(isi).repo)
    temuan.push({ tingkat: "peringatan", kode: "jebakan-repo", baris: 0, pesan: `tambahkan baris \`repo: ${akarUtama(path.resolve(arg[0]))}\` di bawah judul agar daftar per device ini tidak dipakai repo lain yang bernama sama` });
  keluar(json ? JSON.stringify({ ...l, butir: l.ada ? uraiJebakan(isi).butir : [], temuan }) : formatBaca(l, temuan, isi));
  return kodeKeluar(temuan);
}

const utama = (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(INI); } catch { return false; } })();
if (process.argv[1] && utama) process.exitCode = main(process.argv.slice(2));
