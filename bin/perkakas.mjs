#!/usr/bin/env node
// Perkakas resmi RudisOne (daftar: perkakas.json; aturan: sdlc.md › Perkakas resmi). Memastikan skill
// rudis-monorepo dan pustaka rudis-modules ada dan mutakhir di device ini, tanpa pernah menimpa
// pekerjaan pengguna di repo sumbernya. Dipanggil COO di awal setiap /rudisone dan oleh install.sh.
// Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill] [--segera] [--paksa]
//   siapkan  (default) clone bila belum ada · pull --ff-only bila bersih · pasang ulang skill bila beda dari paketnya
//   cek      laporkan keadaan tanpa mengubah apa pun (git fetch tetap jalan)
//   versi    satu baris untuk kolom "Perkakas" register tugas, mis. rudis@b444853 lib@43e552f
//   proyek   jenis <folder>: rudis-pustaka · rudis-deploy · lain
//   pastikan skill luar <skill> tersedia; bila belum, dipasang dari sumber resminya (exit 0 · 1 · 2 alternatif · 3)
//   skill    keadaan semua skill luar (perkakas.json › skill_luar) tanpa memasang apa pun
//   --segera abaikan jeda 30 menit antar-fetch · --paksa jangan menunda walau ada tugas Engineering berjalan
// Exit: 0 siap · 1 perlu perhatian (kerja tetap lanjut dengan versi yang ada) · 3 argumen salah
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bacaRegister } from "../kantor/server.mjs";
import { laporan as laporanSkillLuar, pastikan } from "./skill-luar.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = process.env.RUDISONE_PERKAKAS_MANIFEST || path.join(ROOT, "perkakas.json");
// Register tugas COO.
const REGISTER = process.env.RUDISONE_REGISTER || path.join(ROOT, "handoff", "register-tugas.md");
const STATE = process.env.RUDISONE_PERKAKAS_STATE || path.join(ROOT, "handoff", ".perkakas.json");
const JEDA_FETCH_MS = 30 * 60 * 1000;

const rumah = (p) => p.replace(/^~(?=\/|$)/, os.homedir());

function jalankan(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || r.error?.message || "").trim() };
}
const git = (dir, ...args) => jalankan("git", ["-C", dir, ...args]);
const baris1 = (t) => t.split("\n").filter(Boolean).pop() ?? "";

/** ID tugas Engineering yang sedang dikerjakan dan (mungkin) memakai perkakas — kolom Perkakas "—" berarti tidak. */
export function tugasEngineeringBerjalan(teks) {
  return bacaRegister(teks)
    .filter((t) => /^engineering/i.test(t.divisi) && /^(berjalan|ditinjau|terhambat)/i.test(t.status)
      && !/^[—-]$/.test(t.perkakas ?? ""))
    .map((t) => t.id);
}

/** rudis-pustaka (memakai pustaka modul) · rudis-deploy (standar deploy saja) · lain. */
export function jenisProyek(folder) {
  if (fs.existsSync(path.join(folder, "modules.lock.json"))) return "rudis-pustaka";
  if (fs.existsSync(path.join(folder, "infra", "deploy"))) return "rudis-deploy";
  return "lain";
}

function sidikFolder(dir) {
  const hasil = [];
  (function jalan(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".DS_Store") continue;
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) jalan(p, r);
      else hasil.push(`${r} ${crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex")}`);
    }
  })(dir, "");
  return hasil.sort().join("\n");
}

/** Apakah isi skill terpasang sama persis dengan isi paket .skill (zip) di repo sumber. */
function terpasangSamaDenganPaket(paket, terpasang) {
  if (!fs.existsSync(terpasang)) return false;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perkakas-"));
  try {
    let r = jalankan("unzip", ["-q", paket, "-d", tmp]);
    if (!r.ok) r = jalankan("python3", ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", paket, tmp]);
    if (!r.ok) throw new Error(`paket tidak bisa dibuka: ${baris1(r.err)}`);
    const isi = path.join(tmp, path.basename(terpasang));
    return fs.existsSync(isi) && sidikFolder(isi) === sidikFolder(terpasang);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function bacaState() { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { fetch: {} }; } }
function tulisState(s) { try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); } catch { /* opsional */ } }

/** Versi singkat satu perkakas: sha commit terakhir (untuk skill: yang menyentuh foldernya), + "+lokal" bila belum di-push/berubah. */
function versi(t) {
  const dir = rumah(t.lokal);
  if (!fs.existsSync(path.join(dir, ".git"))) return `${t.label}@tidak-ada`;
  const sha = git(dir, "log", "-1", "--format=%h", ...(t.folder ? ["--", t.folder] : [])).out || "?";
  const kotor = git(dir, "status", "--porcelain", "--untracked-files=no", ...(t.folder ? ["--", t.folder] : [])).out;
  const naik = git(dir, "rev-list", "--count", "@{u}..HEAD");
  return `${t.label}@${sha}${kotor || (naik.ok && naik.out !== "0") ? "+lokal" : ""}`;
}

function siapkan(t, { ubah, segera, paksa, sibuk, state }) {
  const catat = [], dir = rumah(t.lokal);
  const ok = (s) => catat.push(["ok", s]), info = (s) => catat.push(["..", s]), awas = (s) => catat.push(["!!", s]);
  const nama = t.id;

  // 1. Repo sumber
  if (!fs.existsSync(dir)) {
    if (!ubah) { awas(`${nama}: belum ada di ${t.lokal}`); return catat; }
    const r = jalankan("git", ["clone", "--quiet", t.repo, dir]);
    if (!r.ok) { awas(`${nama}: clone ${t.repo} gagal — ${baris1(r.err)}`); return catat; }
    if (t.hooks) git(dir, "config", "core.hooksPath", t.hooks);
    ok(`${nama}: di-clone ke ${t.lokal}`);
    state.fetch[nama] = Date.now();
  } else if (!fs.existsSync(path.join(dir, ".git"))) {
    awas(`${nama}: ${t.lokal} ada tetapi bukan repo git — tidak disentuh`); return catat;
  } else {
    const kotor = git(dir, "status", "--porcelain", "--untracked-files=no").out;
    const perluFetch = segera || Date.now() - (state.fetch[nama] ?? 0) > JEDA_FETCH_MS;
    if (perluFetch) {
      const f = git(dir, "fetch", "--quiet");
      if (f.ok) state.fetch[nama] = Date.now();
      else awas(`${nama}: fetch gagal (offline?) — memakai versi lokal (${baris1(f.err)})`);
    }
    const hulu = git(dir, "rev-list", "--left-right", "--count", "HEAD...@{u}");
    if (!hulu.ok) info(`${nama}: branch ${git(dir, "branch", "--show-current").out || "?"} tanpa upstream — dipakai apa adanya`);
    else {
      const [naik, turun] = hulu.out.split(/\s+/).map(Number);
      if (turun > 0 && kotor) awas(`${nama}: ${turun} commit baru di origin, tetapi ada perubahan lokal belum di-commit — tidak ditarik`);
      else if (turun > 0 && naik > 0) awas(`${nama}: bercabang dari origin (${naik} lokal, ${turun} origin) — tidak ditarik, selesaikan manual`);
      else if (turun > 0 && t.jenis === "pustaka" && sibuk.length && !paksa) awas(`${nama}: ${turun} commit baru, ditunda — tugas Engineering berjalan: ${sibuk.join(", ")}`);
      else if (turun > 0 && !ubah) awas(`${nama}: tertinggal ${turun} commit dari origin`);
      else if (turun > 0) {
        const p = git(dir, "pull", "--ff-only", "--quiet");
        if (p.ok) ok(`${nama}: diperbarui ${turun} commit (pull --ff-only)`);
        else awas(`${nama}: pull --ff-only gagal — ${baris1(p.err)}`);
      } else if (naik > 0) info(`${nama}: ${naik} commit lokal belum di-push — dipakai apa adanya`);
      else ok(`${nama}: mutakhir dengan origin`);
    }
    if (kotor && !catat.some(([, s]) => s.includes("belum di-commit"))) info(`${nama}: ada perubahan belum di-commit di ${t.lokal} — tidak disentuh`);
    if (t.hooks && git(dir, "config", "core.hooksPath").out !== t.hooks) {
      awas(`${nama}: hook pre-commit belum aktif — jalankan: git -C ${t.lokal} config core.hooksPath ${t.hooks}`);
    }
  }

  // 2. Skill: salinan terpasang harus sama dengan paket di repo sumber
  if (t.jenis === "skill") {
    const akar = t.folder ? path.join(dir, t.folder) : dir;
    const paket = path.join(akar, t.paket), terpasang = rumah(t.terpasang);
    if (!fs.existsSync(paket)) { awas(`${nama}: paket ${t.paket} tidak ada di sumber`); return catat; }
    let sama;
    try { sama = terpasangSamaDenganPaket(paket, terpasang); } catch (e) { awas(`${nama}: ${e.message}`); return catat; }
    const sumberKotor = git(dir, "status", "--porcelain", "--untracked-files=no", ...(t.folder ? ["--", t.folder] : [])).out;
    if (sama) ok(`${nama}: skill terpasang = paket sumber`);
    else if (sumberKotor) awas(`${nama}: skill terpasang beda dari paket, tetapi sumbernya sedang diubah — tidak dipasang ulang`);
    else if (sibuk.length && !paksa) awas(`${nama}: skill terpasang beda dari paket, pemasangan ditunda — tugas Engineering berjalan: ${sibuk.join(", ")}`);
    else if (!ubah) awas(`${nama}: skill terpasang ${fs.existsSync(terpasang) ? "beda dari" : "belum ada; ada"} paket sumber`);
    else {
      const r = jalankan("bash", [path.join(akar, t.pasang)], akar);
      if (r.ok && terpasangSamaDenganPaket(paket, terpasang)) ok(`${nama}: skill dipasang ulang dari paket sumber`);
      else awas(`${nama}: pemasangan gagal — ${baris1(r.err || r.out)}`);
    }
  }
  return catat;
}

function main(argv) {
  const opsi = argv.filter((a) => a.startsWith("--"));
  const [aksi = "siapkan", arg] = argv.filter((a) => !a.startsWith("--"));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const daftar = manifest.perkakas, skillLuar = manifest.skill_luar ?? [];

  if (aksi === "versi") { console.log(daftar.map(versi).join(" ")); return 0; }
  if (aksi === "proyek") {
    if (!arg) { console.error("Pemakaian: bin/perkakas.sh proyek <folder>"); return 3; }
    console.log(jenisProyek(path.resolve(rumah(arg)))); return 0;
  }
  if (aksi === "pastikan") {
    if (!arg) { console.error("Pemakaian: bin/perkakas.sh pastikan <skill>"); return 3; }
    return pastikan(skillLuar, arg);
  }
  if (aksi === "skill") {
    console.log("Skill luar RudisOne");
    for (const [tingkat, teksBaris] of laporanSkillLuar(skillLuar)) console.log(`  [${tingkat}]   ${teksBaris}`);
    return 0;
  }
  if (aksi !== "siapkan" && aksi !== "cek") { console.error(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(4, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 3; }

  let teks = "";
  try { teks = fs.readFileSync(REGISTER, "utf8"); } catch { /* belum ada register tugas */ }
  const sibuk = tugasEngineeringBerjalan(teks);
  const state = bacaState();
  state.fetch ??= {};
  const konteks = { ubah: aksi === "siapkan", segera: opsi.includes("--segera"), paksa: opsi.includes("--paksa"), sibuk, state };

  let perhatian = 0;
  console.log(`Perkakas resmi RudisOne — ${aksi}`);
  for (const t of daftar) {
    for (const [tingkat, teksBaris] of siapkan(t, konteks)) {
      if (tingkat === "!!") perhatian++;
      console.log(`  [${tingkat}]   ${teksBaris}`);
    }
  }
  // Skill luar hanya dilaporkan: dipasang saat dibutuhkan (`pastikan`), bukan di setiap /rudisone.
  for (const [tingkat, teksBaris] of laporanSkillLuar(skillLuar)) console.log(`  [${tingkat}]   ${teksBaris}`);
  tulisState(state);
  const v = daftar.map(versi).join(" ");
  console.log(perhatian ? `Perkakas: ${perhatian} perlu perhatian — kerja tetap lanjut dengan ${v}` : `Perkakas: siap — ${v}`);
  return perhatian ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
