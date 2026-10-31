#!/usr/bin/env node
// Perkakas resmi RudisOne (daftar: perkakas.json; aturan: skill rudis-sdlc › Perkakas resmi). Memastikan skill
// rudis-monorepo, pustaka rudis-modules, dan RUDIS SDD ada dan mutakhir di device ini, tanpa pernah menimpa
// pekerjaan pengguna di repo sumbernya. Dipanggil COO di awal setiap /rudisone dan oleh install.sh.
// Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill|marketplace cek [<sumber>]|sdd <argumen rudis…>] [--segera] [--paksa]
//   siapkan  (default) clone bila belum ada · pull --ff-only bila bersih · pasang ulang skill bila beda dari paketnya
//   cek      laporkan keadaan tanpa mengubah apa pun (git fetch tetap jalan)
//   versi    satu baris untuk kolom "Perkakas" register tugas, mis. rudis@b444853 lib@43e552f sdd@e216888
//   proyek   <folder> [--json]: rudis-pustaka · rudis-deploy · lain, lalu mode-mesin A|B|ragu, backend, bukti, kartu
//            (folder proyek baru tanpa kode tetap `lain` di baris pertama, mode-mesin A; --json: "baru": true)
//   pastikan skill luar <skill> tersedia; bila belum, dipasang dari sumber resminya (exit 0 · 1 · 2 alternatif · 3)
//   skill    keadaan semua skill luar (perkakas.json › skill_luar) tanpa memasang apa pun
//   marketplace cek [<sumber>]  validasi allowlist (perkakas.json › kebijakan_marketplace); dengan <sumber>: 0 diizinkan · 1 tidak
//   sdd      jalankan CLI rudis lewat `uvx --from <lokal>` (= bin/rudis-sdd.sh); --no-marketplace selalu, kecuali allowlist
//   --segera abaikan jeda 30 menit antar-fetch · --paksa jangan menunda walau ada tugas Engineering berjalan
// Exit: 0 siap · 1 perlu perhatian (kerja tetap lanjut dengan versi yang ada) · 3 argumen salah
// Override (uji): RUDISONE_LOKAL_<ID> (mis. RUDISONE_LOKAL_RUDIS_SDD) mengganti `lokal` satu entri;
//   RUDISONE_KEYCHAIN_BIN mengganti `security`; RUDISONE_UVX_BIN mengganti `uvx`; RUDISONE_OS mengganti
//   process.platform (darwin → Keychain, lainnya → berkas rahasia); RUDISONE_RAHASIA_DIR mengganti folder berkas rahasia.
// PAT repo privat (entri ber-`auth`) tidak pernah dicetak, masuk repo, atau masuk argumen. Penyimpannya per OS:
//   macOS → Keychain (`security`); Linux/WSL2 → berkas 0600 di ~/.config/rudisone/rahasia/<layanan> (folder 0700),
//   diisi pengguna lewat `bin/perkakas.sh pat <layanan>` (PAT diketik saat diminta). git memanggil bin/perkakas.sh
//   sebagai GIT_ASKPASS, dan skrip itu membaca penyimpan itu sendiri.
import { cariBash, jalankan as jalankanProses, posix, tampilPath, tarZip } from "./lib/platform.mjs";
import { ada as adaRahasia, baca as bacaRahasia, bacaTersembunyi, berkasRahasia as rahasiaBerkas, dirRahasia, jenisPenyimpan, layananSah,
  pakaiKeychain, simpan as simpanRahasia } from "./lib/rahasia.mjs";
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
// Program yang dipanggil git sebagai GIT_ASKPASS. Windows: .cmd (git menjalankannya langsung); lainnya: pembungkus sh.
const ASKPASS = path.join(ROOT, "bin", process.platform === "win32" ? "askpass.cmd" : "perkakas.sh");
export { pakaiKeychain, dirRahasia };
const berkasRahasia = rahasiaBerkas;

const rumah = (p) => path.normalize(p.replace(/^~(?=\/|$)/, os.homedir()));   // normalize: pemisah path sama di semua OS

function jalankan(cmd, args, cwd, envTambah = {}, timeout = 120_000) {
  const r = jalankanProses(cmd, args, { cwd, encoding: "utf8", timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...envTambah } });
  return { ok: r.status === 0, kode: r.status, out: (r.stdout || "").trim(), err: (r.stderr || r.error?.message || "").trim() };
}
const git = (dir, ...args) => jalankan("git", ["-C", dir, ...args]);
const baris1 = (t) => t.split("\n").filter(Boolean).pop() ?? "";

/** Nama env override `lokal` satu entri, mis. rudis-sdd → RUDISONE_LOKAL_RUDIS_SDD. */
export const kunciLokal = (id) => `RUDISONE_LOKAL_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;

function bacaManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const t of m.perkakas) if (process.env[kunciLokal(t.id)]) t.lokal = process.env[kunciLokal(t.id)];
  return m;
}

// ---- Penyimpan PAT: Keychain (macOS `security`) · berkas rahasia 0600 (Linux/WSL2) ----------------------------------

/** Apakah PAT layanan ada — tanpa membaca nilainya. */
export const adaPat = adaRahasia;
/** Nilai PAT, hanya untuk lingkungan proses anak (GL_TOKEN rudis); null bila tidak ada. */
const bacaPat = bacaRahasia;
/** Nama penyimpan untuk pesan, mis. "Keychain (rudisone-rudis-sdd)". */
export const namaPenyimpan = (layanan) => {
  const j = jenisPenyimpan();
  return j === "keychain" ? `Keychain (${layanan})`
    : j === "dpapi" ? `penyimpan terenkripsi Windows (${tampilPath(berkasRahasia(layanan))}, hanya akun ini)`
      : `berkas rahasia (${tampilPath(berkasRahasia(layanan))}, mode 0600)`;
};
/** Perintah untuk pengguna; PAT selalu diketik saat diminta, tidak pernah di argumen.
 *  macOS: `-w` di akhir tanpa nilai → `security` meminta PAT. Windows/Linux/WSL2: `perkakas pat` membaca tanpa gema. */
export const perintahPat = (layanan, perbarui = false) => {
  const j = jenisPenyimpan();
  if (j === "keychain") return `security add-generic-password${perbarui ? " -U" : ""} -s ${layanan} -a "$USER" -w`;
  if (j === "dpapi") return `node ${tampilPath(path.join(ROOT, "bin", "perkakas.mjs"))} pat ${layanan}`;
  return `${tampilPath(path.join(ROOT, "bin", "perkakas.sh"))} pat ${layanan}`;
};

/** Argumen + env git untuk entri ber-`auth`. PAT ada di penyimpannya → helper kredensial pengguna dimatikan untuk
 *  perintah itu (tidak ada yang tersimpan) dan git meminta PAT ke bin/perkakas.sh (mode GIT_ASKPASS). PAT belum
 *  ada → git biasa (helper kredensial milik pengguna bila ada, tanpa prompt). */
function aksesGit(t) {
  const layanan = t.auth?.keychain;
  if (!layanan || !adaPat(layanan)) return { pat: false, args: [], env: {} };
  return { pat: true, args: ["-c", "credential.helper="],
    env: { GIT_ASKPASS: ASKPASS, RUDISONE_ASKPASS_LAYANAN: layanan, RUDISONE_ASKPASS_PENGGUNA: t.auth.pengguna || "oauth2",
      // berkas polos hanya untuk jenis "berkas"; Keychain dan DPAPI dibaca langsung oleh mode askpass
      ...(jenisPenyimpan() === "berkas" ? { RUDISONE_ASKPASS_BERKAS: berkasRahasia(layanan) } : {}) } };
}
const GALAT_AUTH = /could not read (Username|Password)|Authentication failed|terminal prompts disabled|HTTP Basic: Access denied|returned error: 40[13]|\b40[13]\b/i;
function pesanAuth(t, akses) {
  const l = t.auth.keychain;
  return akses.pat
    ? `PAT di ${namaPenyimpan(l)} ditolak — pengguna memperbaruinya (PAT diketik saat diminta, tidak di argumen): ${perintahPat(l, true)}`
    : `butuh PAT — belum ada di ${namaPenyimpan(l)}. Pengguna menjalankan (PAT GitLab read_repository + read_api, diketik saat diminta, tidak di argumen): ${perintahPat(l)}`;
}

/** Apakah sumber CLI masih mendukung flag tanpa-marketplace (gagal tertutup bila tidak). */
function dukungFlag(t, dir) {
  try { return fs.readFileSync(path.join(dir, t.tanpa_marketplace.bukti), "utf8").includes(`"${t.tanpa_marketplace.flag}"`); }
  catch { return false; }
}

/** ID tugas Engineering yang sedang dikerjakan dan (mungkin) memakai perkakas — kolom Perkakas "—" berarti tidak. */
export function tugasEngineeringBerjalan(teks) {
  return bacaRegister(teks)
    .filter((t) => /^engineering/i.test(t.divisi) && /^(berjalan|ditinjau|terhambat)/i.test(t.status)
      && !/^[—-]$/.test(t.perkakas ?? ""))
    .map((t) => t.id);
}

/** rudis-pustaka (memakai pustaka modul) · rudis-deploy (standar deploy saja) · lain — baris pertama `proyek` (kompatibel). */
export function jenisProyek(folder) {
  if (fs.existsSync(path.join(folder, "modules.lock.json"))) return "rudis-pustaka";
  if (fs.existsSync(path.join(folder, "infra", "deploy"))) return "rudis-deploy";
  return "lain";
}

// ---- Deteksi mode proyek berbukti (kartu proyek: templat/kartu-proyek.md) -------------------------------------

/** Letak kartu proyek: `<folder>/.rudisone/kartu-proyek.md`, atau cadangan `handoff/kartu/<nama-folder>.md` di RudisOne. */
export function letakKartu(folder, root = process.env.RUDISONE_ROOT || ROOT) {
  return [path.join(folder, ".rudisone", "kartu-proyek.md"), path.join(root, "handoff", "kartu", `${path.basename(path.resolve(folder))}.md`)];
}

/** Frontmatter kartu (`key: value` satu baris) → { path, data }, atau null bila kartu tidak ada. */
export function bacaKartu(folder, root) {
  const p = letakKartu(folder, root).find((f) => fs.existsSync(f));
  if (!p) return null;
  const data = {};
  const fm = fs.readFileSync(p, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  for (const l of (fm?.[1] ?? "").split(/\r?\n/)) {
    const m = l.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (m) data[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return { path: p, data };
}

const adaDi = (dir, ...p) => fs.existsSync(path.join(dir, ...p));
function bacaJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } }
const repoGit = (dir) => jalankan("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"]).ok;

/** Bahasa backend satu folder → { backend, berkas } atau null. package.json tanpa @nestjs/core/express → "lain". */
export function backendFolder(dir) {
  if (adaDi(dir, "go.mod")) return { backend: "go", berkas: "go.mod" };
  if (adaDi(dir, "package.json")) {
    const j = bacaJson(path.join(dir, "package.json")) ?? {};
    const dep = { ...j.dependencies, ...j.devDependencies, ...j.peerDependencies };
    if (dep["@nestjs/core"] || dep.express) return { backend: "node", berkas: `package.json (${dep["@nestjs/core"] ? "@nestjs/core" : "express"})` };
  }
  if (adaDi(dir, "composer.json")) return { backend: "php", berkas: "composer.json" };
  for (const f of ["pom.xml", "build.gradle", "build.gradle.kts"]) if (adaDi(dir, f)) return { backend: "java", berkas: f };
  let cs;
  try { cs = fs.readdirSync(dir).find((f) => f.endsWith(".csproj")); } catch { /* bukan folder */ }
  if (cs) return { backend: "dotnet", berkas: cs };
  for (const f of ["pyproject.toml", "requirements.txt"]) if (adaDi(dir, f)) return { backend: "python", berkas: f };
  if (adaDi(dir, "package.json")) return { backend: "lain", berkas: "package.json tanpa @nestjs/core/express" };
  return null;
}

/** Subfolder app (D5): `apps/*`, `packages/*`, dan subfolder tingkat 1 yang punya go.mod/package.json sendiri. */
function folderApp(folder) {
  const abaikan = /^(\.|node_modules$|vendor$|dist$|build$|infra$|docs$|specs$|apps$|packages$)/;
  const subdir = (rel) => { try { return fs.readdirSync(path.join(folder, rel), { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return []; } };
  const hasil = [];
  for (const induk of ["apps", "packages"]) for (const e of subdir(induk)) hasil.push(`${induk}/${e.name}`);
  for (const e of subdir("")) if (!abaikan.test(e.name)) hasil.push(e.name);
  return hasil.filter((rel) => adaDi(folder, rel, "go.mod") || adaDi(folder, rel, "package.json"));
}

/** Keadaan modules.lock.json: ada, ter-track git (true/false; null = bukan repo git), JSON valid, modul aktif/detached. */
function keadaanLock(folder) {
  if (!adaDi(folder, "modules.lock.json")) return { ada: false };
  const track = repoGit(folder) ? jalankan("git", ["-C", folder, "ls-files", "--error-unmatch", "--", "modules.lock.json"]).ok : null;
  const j = bacaJson(path.join(folder, "modules.lock.json"));
  const valid = !!j && typeof j === "object" && !Array.isArray(j) && (j.modules === undefined || (typeof j.modules === "object" && j.modules !== null));
  const modul = valid ? Object.values(j.modules ?? {}) : [];
  const detached = modul.filter((m) => m?.status === "detached").length;
  return { ada: true, track, valid, aktif: modul.length - detached, detached };
}

/** Apakah docs/<nama>/ diabaikan git (check-ignore bila repo git; selain itu baris di .gitignore). Laporan tracer & tes
 *  bisa memuat data hasil penelusuran — keduanya wajib di-gitignore (standar rudis-monorepo kernel/v7.1). */
function laporanDiabaikan(folder, nama) {
  if (repoGit(folder)) return jalankan("git", ["-C", folder, "check-ignore", "-q", "--no-index", `docs/${nama}/x`]).ok;
  try { return new RegExp(`^\\/?docs\\/${nama}(\\/\\*{0,2})?\\/?\\s*$`, "m").test(fs.readFileSync(path.join(folder, ".gitignore"), "utf8")); } catch { return false; }
}
export function traceDiabaikan(folder) { return laporanDiabaikan(folder, "trace-reports") && laporanDiabaikan(folder, "test-reports"); }

/** Isi akar yang boleh ada di folder proyek baru (belum ada kode): metadata git/editor/lisensi/env, `.claude/`, dan
 *  `.rudisone/` yang kosong atau hanya berisi kartu proyek. Apa pun selain ini (kode, apps/, specs/, .rudis/, lock) =
 *  bukan proyek baru. */
const AKAR_PROYEK_BARU = [/^\.git$/, /^\.gitignore$/, /^\.gitattributes$/, /^readme/i, /^licen[cs]e/i, /^\.claude$/, /^\.vscode$/,
  /^\.idea$/, /^\.env/, /^\.editorconfig$/, /^\.DS_Store$/, /^Thumbs\.db$/i, /^desktop\.ini$/i];
export function folderProyekBaru(folder) {
  let isi;
  try { isi = fs.readdirSync(folder); } catch { return false; }
  return isi.every((n) => {
    if (n === ".rudisone") {
      try { return fs.readdirSync(path.join(folder, n)).every((f) => f === "kartu-proyek.md" || f === ".DS_Store"); } catch { return false; }
    }
    return AKAR_PROYEK_BARU.some((p) => p.test(n));
  });
}

/** Hasil deteksi berbukti untuk `perkakas.sh proyek`. Folder tidak ada → Error berkode ENOENT (CLI: exit 3, D1).
 *  mode: ragu (D3/D4/D5/D6) · A (lock sah, ter-track, ≥1 modul aktif, backend go; atau folder proyek baru tanpa kode —
 *  proyek baru dirakit dari pustaka, D2) · B (selain itu; pustaka hanya Go). */
export function deteksiProyek(folder, { root } = {}) {
  let st = null;
  try { st = fs.statSync(folder); } catch { /* tidak ada */ }
  if (!st?.isDirectory()) { const e = new Error(`folder tidak ada: ${folder}`); e.code = "ENOENT"; throw e; }
  const bukti = [], ragu = [];
  const lock = keadaanLock(folder);
  const trackTeks = lock.track === null ? "bukan repo git (track tidak bisa diperiksa)" : lock.track ? "di-track git" : "TIDAK di-track git";
  if (!lock.ada) bukti.push("modules.lock.json: tidak ada");
  else if (!lock.valid) bukti.push(`modules.lock.json: ada, ${trackTeks}, JSON rusak`);
  else bukti.push(`modules.lock.json: ada, ${trackTeks}, JSON valid, ${lock.aktif} modul aktif, ${lock.detached} detached`);
  for (const d of ["infra/deploy", "apps/api", "apps/web"]) bukti.push(`${d}: ${adaDi(folder, d) ? "ada" : "tidak ada"}`);

  const asal = adaDi(folder, "apps", "api") ? "apps/api" : ".";
  const be = backendFolder(path.join(folder, asal));
  const backend = be?.backend ?? "-";
  bukti.push(be ? `backend: ${be.backend} dari ${asal === "." ? "" : `${asal}/`}${be.berkas}` : `backend: tidak terdeteksi di ${asal}`);
  const app = folderApp(folder).filter((rel) => rel !== asal)
    .map((rel) => ({ rel, be: backendFolder(path.join(folder, rel)) })).filter((a) => a.be && a.be.backend !== "lain");
  for (const a of app) bukti.push(`app: ${a.rel} → ${a.be.backend} (${a.be.berkas})`);
  const ragam = new Set([...(be && be.backend !== "lain" ? [be.backend] : []), ...app.map((a) => a.be.backend)]);

  let nSpec = 0;
  try { nSpec = fs.readdirSync(path.join(folder, "specs"), { withFileTypes: true }).filter((e) => e.isDirectory()).length; } catch { /* tidak ada */ }
  bukti.push(`.rudis/: ${adaDi(folder, ".rudis") ? "ada" : "tidak ada"}`);
  bukti.push(`specs/: ${adaDi(folder, "specs") ? `ada (${nSpec} folder)` : "tidak ada"}`);
  bukti.push(`docs/brd/: ${adaDi(folder, "docs", "brd") ? "ada" : "tidak ada"}`);
  const traceAbai = traceDiabaikan(folder);
  const perluTrace = adaDi(folder, ".rudis") || adaDi(folder, "docs", "trace-reports");
  if (perluTrace && !traceAbai) bukti.push("peringatan: docs/trace-reports/ atau docs/test-reports/ belum di-gitignore");

  if (lock.ada && !lock.valid) ragu.push("lock rusak (D6)");
  else if (lock.ada && lock.track === false) ragu.push("lock tidak di-track git (D6)");
  else if (lock.ada && lock.track === null) ragu.push("lock di luar repo git (D6)");
  else if (lock.ada && lock.aktif < 1) ragu.push("tidak ada modul aktif di lock — semua detached/kosong (D4)");
  if (!lock.ada && adaDi(folder, "infra", "deploy") && adaDi(folder, "apps", "api") && backend === "go") ragu.push("struktur standar + backend go tanpa lock (D3)");
  if (ragam.size > 1) ragu.push(`beberapa backend: ${[...ragam].join(", ")} (D5)`);
  const baru = !ragu.length && folderProyekBaru(folder);
  const mode = ragu.length ? "ragu" : (lock.ada && backend === "go") || baru ? "A" : "B";
  for (const r of ragu) bukti.push(`ragu: ${r}`);
  if (baru) bukti.push("folder proyek baru (belum ada kode) — proyek baru dirakit dari pustaka = Mode A (konfirmasi: Persetujuan Inisiasi)");
  if (mode === "B" && lock.ada) bukti.push(`catatan: perakitan pustaka hanya Go — backend ${backend} = B kecuali kartu berkata lain`);

  const k = bacaKartu(folder, root);
  const kartu = k ? { ada: true, path: k.path, mode: k.data.mode ?? "", data: k.data } : { ada: false };
  return { folder, jenis: jenisProyek(folder), mode, baru, backend, bukti, kartu, traceDiabaikan: traceAbai, perluTrace };
}

/** Teks keluaran `perkakas.sh proyek`: baris pertama = jenis lama (kompatibel), lalu mode, backend, bukti, kartu. */
export function teksProyek(h) {
  const kartu = !h.kartu.ada ? "kartu: tidak ada"
    : `kartu: ada (mode ${/^[AB]$/.test(h.kartu.mode) ? h.kartu.mode : `tidak valid "${h.kartu.mode}"`}) — ${h.kartu.path}`;
  return [h.jenis, `mode-mesin: ${h.mode}`, `backend: ${h.backend}`, ...h.bukti.map((b) => `bukti: ${b}`), kartu].join("\n");
}

/** Sidik isi folder: "<path relatif> <sha1>" per berkas, terurut. Backslash di nama dibaca sebagai pemisah folder: paket zip
 *  ber-backslash yang dibuka apa adanya (nama berkas memuat "\") tetap sebanding dengan salinan terpasang. */
function sidikFolder(dir) {
  const hasil = [];
  (function jalan(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".DS_Store") continue;
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) jalan(p, r);
      else hasil.push(`${r.replaceAll("\\", "/")} ${crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex")}`);
    }
  })(dir, "");
  return hasil.sort();
}

const adaIsi = (dir) => { try { return fs.readdirSync(dir).length > 0; } catch { return false; } };
// Alat tidak terpasang (bukan galat paket): spawn ENOENT, shell 127, cmd.exe 9009.
const tidakAda = (r) => /\bENOENT\b/.test(r.err) || r.kode === 127 || r.kode === 9009;

/** Buka paket zip ke `tujuan` (folder kosong). Urutan: unzip → python3 (bukan Windows: alias WindowsApps bisa menggantung)
 *  → tar (bsdtar membuka zip: macOS, Windows 10+) → PowerShell Expand-Archive (Windows).
 *  unzip kode 1 = peringatan (mis. entri ber-backslash), berkas tetap terbuka → diterima bila folder terisi.
 *  Hasil: { alat, peringatan } · semua cara gagal → Error "paket tidak bisa dibuka: …" (galat alat pertama yang benar-benar jalan). */
export function bukaPaket(paket, tujuan, { jalankan: run = jalankan, platform = process.platform } = {}) {
  const cara = [["unzip", "unzip", ["-q", "-o", paket, "-d", tujuan]]];
  if (platform !== "win32") cara.push(["python3", "python3", ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", paket, tujuan]]);
  cara.push(["tar", tarZip(), ["-xf", paket, "-C", tujuan]]);
  if (platform === "win32") {
    cara.push(["Expand-Archive", "powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `Expand-Archive -LiteralPath '${paket.replaceAll("'", "''")}' -DestinationPath '${tujuan.replaceAll("'", "''")}' -Force`]]);
  }
  const galat = [];
  for (const [alat, cmd, args] of cara) {
    fs.rmSync(tujuan, { recursive: true, force: true });
    fs.mkdirSync(tujuan, { recursive: true });
    const r = run(cmd, args);
    if (r.ok) return { alat, peringatan: "" };
    if (alat === "unzip" && r.kode === 1 && adaIsi(tujuan)) return { alat, peringatan: baris1(r.err || r.out) };
    const pesan = baris1(r.err || r.out).trim().replace(/\s+/g, " ") || `kode ${r.kode}`;
    if (!tidakAda(r)) galat.push(pesan.startsWith(`${alat}:`) ? pesan : `${alat}: ${pesan}`);
  }
  fs.rmSync(tujuan, { recursive: true, force: true });
  throw new Error(`paket tidak bisa dibuka: ${galat[0] ?? "tidak ada unzip/tar/Expand-Archive"}`);
}

/** Apakah isi skill terpasang sama persis dengan isi paket .skill (zip) di repo sumber. */
export function terpasangSamaDenganPaket(paket, terpasang, opsi) {
  if (!fs.existsSync(terpasang)) return false;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "perkakas-"));
  try {
    const isi = path.join(tmp, "isi");
    bukaPaket(paket, isi, opsi);
    const awal = `${path.basename(terpasang)}/`;
    const dariPaket = sidikFolder(isi).filter((s) => s.startsWith(awal)).map((s) => s.slice(awal.length));
    return dariPaket.length > 0 && dariPaket.join("\n") === sidikFolder(terpasang).join("\n");
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
  const akses = t.auth ? aksesGit(t) : { pat: false, args: [], env: {} };
  const gitJaringan = (...args) => jalankan("git", [...akses.args, "-C", dir, ...args], undefined, akses.env, 600_000);
  const ditolak = (apa, err) => (t.auth && GALAT_AUTH.test(err) ? `${nama}: ${apa} ditolak — ${pesanAuth(t, akses)}` : null);

  // 1. Repo sumber
  if (!fs.existsSync(dir)) {
    if (!ubah) { awas(`${nama}: belum ada di ${t.lokal}`); return catat; }
    const r = jalankan("git", [...akses.args, "clone", "--quiet", t.repo, dir], undefined, akses.env, 600_000);
    if (!r.ok) { awas(ditolak(`clone ${t.repo}`, r.err) ?? `${nama}: clone ${t.repo} gagal — ${baris1(r.err)}`); return catat; }
    if (t.hooks) git(dir, "config", "core.hooksPath", t.hooks);
    ok(`${nama}: di-clone ke ${t.lokal}`);
    state.fetch[nama] = Date.now();
  } else if (!fs.existsSync(path.join(dir, ".git"))) {
    awas(`${nama}: ${t.lokal} ada tetapi bukan repo git — tidak disentuh`); return catat;
  } else {
    const kotor = git(dir, "status", "--porcelain", "--untracked-files=no").out;
    const perluFetch = segera || Date.now() - (state.fetch[nama] ?? 0) > JEDA_FETCH_MS;
    if (perluFetch) {
      const f = gitJaringan("fetch", "--quiet");
      if (f.ok) state.fetch[nama] = Date.now();
      else awas(ditolak("fetch", f.err) ?? `${nama}: fetch gagal (offline?) — memakai versi lokal (${baris1(f.err)})`);
    }
    const hulu = git(dir, "rev-list", "--left-right", "--count", "HEAD...@{u}");
    if (!hulu.ok) info(`${nama}: branch ${git(dir, "branch", "--show-current").out || "?"} tanpa upstream — dipakai apa adanya`);
    else {
      const [naik, turun] = hulu.out.split(/\s+/).map(Number);
      if (turun > 0 && kotor) awas(`${nama}: ${turun} commit baru di origin, tetapi ada perubahan lokal belum di-commit — tidak ditarik`);
      else if (turun > 0 && naik > 0) awas(`${nama}: bercabang dari origin (${naik} lokal, ${turun} origin) — tidak ditarik, selesaikan manual`);
      // Pustaka & CLI dipakai langsung dari repo lokal → ditunda di sini; skill dibaca dari salinan terpasang (langkah 3).
      else if (turun > 0 && (t.jenis === "pustaka" || t.jenis === "cli") && sibuk.length && !paksa) awas(`${nama}: ${turun} commit baru, ditunda — tugas Engineering berjalan: ${sibuk.join(", ")}`);
      else if (turun > 0 && !ubah) awas(`${nama}: tertinggal ${turun} commit dari origin`);
      else if (turun > 0) {
        const p = gitJaringan("pull", "--ff-only", "--quiet");
        if (p.ok) ok(`${nama}: diperbarui ${turun} commit (pull --ff-only)`);
        else awas(ditolak("pull --ff-only", p.err) ?? `${nama}: pull --ff-only gagal — ${baris1(p.err)}`);
      } else if (naik > 0) info(`${nama}: ${naik} commit lokal belum di-push — dipakai apa adanya`);
      else ok(`${nama}: mutakhir dengan origin`);
    }
    if (kotor && !catat.some(([, s]) => s.includes("belum di-commit"))) info(`${nama}: ada perubahan belum di-commit di ${t.lokal} — tidak disentuh`);
    if (t.hooks && git(dir, "config", "core.hooksPath").out !== t.hooks) {
      awas(`${nama}: hook pre-commit belum aktif — jalankan: git -C ${t.lokal} config core.hooksPath ${t.hooks}`);
    }
  }

  // 2. CLI (RUDIS SDD): pelarinya ada, dan sumbernya masih mendukung flag tanpa-marketplace
  if (t.jenis === "cli") {
    const v = jalankan(process.env.RUDISONE_UVX_BIN || t.jalan[0], ["--version"]);
    if (!v.ok) awas(`${nama}: \`${t.jalan[0]}\` tidak ditemukan — pasang uv dulu (${pakaiKeychain() ? "mis. \`brew install uv\`" : "mis. \`curl -LsSf https://astral.sh/uv/install.sh | sh\`"})`);
    if (t.tanpa_marketplace && !dukungFlag(t, dir)) {
      awas(`${nama}: ${t.tanpa_marketplace.flag} tidak ditemukan di ${t.tanpa_marketplace.bukti} — bin/rudis-sdd.sh menolak ${t.tanpa_marketplace.perintah.join("/")} sampai ditinjau`);
    } else if (v.ok) ok(`${nama}: jalan lewat bin/rudis-sdd.sh (${t.jalan.join(" ").replace("{lokal}", t.lokal)}${t.tanpa_marketplace ? `, ${t.tanpa_marketplace.flag}` : ""})`);
  }

  // 3. Skill: salinan terpasang harus sama dengan paket di repo sumber
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
      // Ukurannya isi terpasang, bukan kode keluar skrip: unzip di skrip pasang keluar 1 untuk peringatan (mis. paket ber-backslash).
      const r = jalankan(cariBash() ?? "bash", [posix(path.join(akar, t.pasang))], akar);
      let samaKini;
      try { samaKini = terpasangSamaDenganPaket(paket, terpasang); } catch (e) { awas(`${nama}: ${e.message}`); return catat; }
      if (samaKini && r.ok) ok(`${nama}: skill dipasang ulang dari paket sumber`);
      else if (samaKini) awas(`${nama}: skill dipasang ulang (terpasang = paket sumber), tetapi ${t.pasang} keluar dengan kode ${r.kode ?? "?"} — ${baris1(r.err || r.out) || "tanpa pesan"}`);
      else awas(`${nama}: pemasangan gagal — ${r.ok ? "skill terpasang masih beda dari paket sumber" : baris1(r.err || r.out) || `${t.pasang} keluar dengan kode ${r.kode ?? "?"}`}`);
    }
  }
  return catat;
}

// ---- Kebijakan marketplace (perkakas.json › kebijakan_marketplace) -------------------------------------------

/** Bentuk pembanding sumber: tanpa skema/kredensial/.git; GitHub → "pemilik/repo" (sama dengan singkatan marketplace). */
export function normalSumber(s) {
  const x = String(s ?? "").trim().toLowerCase().replace(/^git\+/, "").replace(/\/+$/, "").replace(/\.git$/, "");
  const gh = x.match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?github\.com[/:]([^/]+\/[^/]+)$/);
  if (gh) return gh[1];
  return x.replace(/^[a-z+]+:\/\//, "").replace(/^[^@/]+@/, "");
}

/** Validasi tiap entri allowlist: [{ entri, galat: [...] }] — entri sah bila galat kosong. */
export function periksaAllowlist(kebijakan) {
  return (kebijakan?.allowlist ?? []).map((e) => {
    const galat = [];
    if (typeof e?.sumber !== "string" || !e.sumber.trim()) galat.push("sumber kosong");
    if (typeof e?.pin !== "string" || !/^[0-9a-f]{40}$/i.test(e.pin)) galat.push("pin wajib sha commit penuh (40 hex)");
    if (e?.auto_update !== false) galat.push("auto_update wajib false");
    if (typeof e?.disetujui !== "string" || !e.disetujui.trim()) galat.push("disetujui wajib memuat kutipan keputusan pemilik");
    return { entri: e, galat };
  });
}

/** Entri allowlist yang sah untuk `sumber`, atau null (tidak diizinkan). */
export function sumberDiizinkan(kebijakan, sumber) {
  if (!sumber) return null;
  const n = normalSumber(sumber);
  return periksaAllowlist(kebijakan).find((h) => !h.galat.length && normalSumber(h.entri.sumber) === n)?.entri ?? null;
}

function cekMarketplace(kebijakan, sumber) {
  if (!kebijakan) { console.log("perkakas.json tidak memuat kebijakan_marketplace — semua sumber marketplace ditolak"); return 1; }
  const hasil = periksaAllowlist(kebijakan);
  console.log(`Kebijakan marketplace: ${kebijakan.default ?? "tanpa-marketplace"} · allowlist ${hasil.length} entri`);
  let rusak = 0;
  for (const { entri, galat } of hasil) {
    if (galat.length) { rusak++; console.log(`  [!!]   ${entri?.sumber || "?"}: ${galat.join("; ")}`); }
    else console.log(`  [ok]   ${entri.sumber} @ ${entri.pin} · auto_update mati · disetujui: "${entri.disetujui}"`);
  }
  if (sumber === undefined) return rusak ? 1 : 0;
  const e = sumberDiizinkan(kebijakan, sumber);
  console.log(e ? `Diizinkan: ${sumber} (pin ${e.pin}) — tinjau hooks/, .mcp.json, bin/ pada pin itu sebelum pasang`
    : `Tidak diizinkan: ${sumber} — tidak ada entri sah di allowlist (default ${kebijakan.default ?? "tanpa-marketplace"})`);
  return e ? 0 : 1;
}

// ---- Pembungkus RUDIS SDD (bin/rudis-sdd.sh = perkakas.sh sdd) -------------------------------------------------

/** Rencana menjalankan `rudis <args>`: { tolak } atau { argv, glToken, catatan }. Murni (tanpa efek) agar teruji.
 *  - init: tambah --no-marketplace kecuali sumber marketplace-nya ada di allowlist; --profile dari katalog = marketplace.
 *  - skill/governance/profile/utilities: memakai marketplace → hanya bila sumbernya di allowlist.
 *  - `dilarang` (seluruh `run`, tui) ditolak; --gitlab-token ditolak (PAT di argumen terlihat di `ps`).
 *  - --help/-h diteruskan apa adanya. */
export function rencanaSdd(t, kebijakan, args, { env = process.env, lokal } = {}) {
  // Tanpa argumen, rudis bisa membuka antarmuka interaktif (TUI, dilarang) — tolak.
  if (!args.length) return { tolak: "rudis tanpa subperintah tidak dipakai (bisa membuka TUI interaktif) — sebut subperintahnya, mis. `--help`" };
  // Gagal tertutup: opsi global sebelum subperintah (mis. `--verbose run ultimate`) bisa melewati pemeriksaan per subperintah.
  if (args[0]?.startsWith("-") && !(args.length === 1 && ["--help", "-h"].includes(args[0])))
    return { tolak: `opsi sebelum subperintah (${args[0]}) tidak didukung pembungkus — tulis subperintahnya dulu, mis. \`init --here …\`` };
  // Bantuan hanya bila --help/-h satu-satunya opsi; selain itu argumen diperiksa seperti biasa.
  const opsi = args.filter((a) => a.startsWith("-"));
  const bantuan = opsi.length === 1 && ["--help", "-h"].includes(opsi[0]);
  const p1 = args[0] ?? "", p2 = args[1] && !args[1].startsWith("-") ? args[1] : "";
  const kunci = `${p1} ${p2}`.trim();
  const catatan = [], argv = [...args];
  if (bantuan) return { argv, glToken: false, catatan };
  if (args.some((a) => a === "--gitlab-token" || a.startsWith("--gitlab-token="))) {
    return { tolak: `--gitlab-token menaruh PAT di argumen (terlihat di ps/log) — PAT dibaca dari ${namaPenyimpan(t.auth?.keychain ?? "-")} sebagai GL_TOKEN` };
  }
  const larang = t.dilarang?.[kunci] ?? t.dilarang?.[p1];
  if (larang) return { tolak: `rudis ${t.dilarang?.[kunci] ? kunci : p1} tidak dipakai di RudisOne — ${larang}` };

  const mp = t.marketplace ?? {};
  const nilai = (f) => {
    if (!f) return undefined;
    const i = args.indexOf(f);
    if (i >= 0) return args[i + 1];
    return args.find((a) => a.startsWith(`${f}=`))?.slice(f.length + 1);
  };
  const sumberUtama = () => nilai(mp.flag) || env[mp.env] || mp.bawaan;
  let sumber = null;
  if ((mp.perintah ?? []).includes(p1)) {
    const k = mp.khusus?.[kunci];
    sumber = k ? (env[k.env] || k.bawaan) : sumberUtama();
  } else if ((t.tanpa_marketplace?.perintah ?? []).includes(p1)) {
    const s = sumberUtama();
    const profilKatalog = args.some((a) => a === "--profile" || a.startsWith("--profile="))
      && !args.some((a) => a === "--profile-path" || a.startsWith("--profile-path="));
    if (sumberDiizinkan(kebijakan, s) || profilKatalog) sumber = s;
    else {
      if (lokal && !dukungFlag(t, lokal)) {
        return { tolak: `${t.tanpa_marketplace.flag} tidak ditemukan di ${t.tanpa_marketplace.bukti} versi ini — ${p1} tanpa flag itu akan mendaftarkan marketplace; tinjau dulu` };
      }
      if (!args.includes(t.tanpa_marketplace.flag)) argv.splice(1, 0, t.tanpa_marketplace.flag);   // tepat setelah subperintah (bukan sesudah `--`)
    }
  }
  if (sumber) {
    const e = sumberDiizinkan(kebijakan, sumber);
    if (!e) return { tolak: `rudis ${kunci} memakai marketplace ${sumber}, yang tidak ada di allowlist (perkakas.json › kebijakan_marketplace; cek: bin/perkakas.sh marketplace cek ${sumber})` };
    catatan.push(`marketplace ${sumber} diizinkan allowlist (pin ${e.pin}); rudis sendiri tidak menegakkan pin — periksa .claude/settings.json sesudahnya`);
  }
  return { argv, glToken: (t.auth?.gl_token_untuk ?? []).includes(p1), catatan };
}

function sdd(manifest, args) {
  const t = manifest.perkakas.find((x) => x.label === "sdd");
  if (!t) { console.error("[sdd] perkakas.json tidak memuat entri berlabel sdd"); return 3; }
  const dir = rumah(t.lokal);
  if (!fs.existsSync(dir)) { console.error(`[sdd] RUDIS belum ada di ${t.lokal} — jalankan bin/perkakas.sh siapkan`); return 1; }
  const r = rencanaSdd(t, manifest.kebijakan_marketplace, args, { lokal: dir });
  if (r.tolak) { console.error(`[sdd] ditolak: ${r.tolak}`); return 1; }
  const [cmd, ...awal] = t.jalan.map((x) => x.replaceAll("{lokal}", dir));
  const env = { ...process.env };
  if (r.glToken && t.auth?.keychain) {
    const pat = bacaPat(t.auth.keychain);
    if (pat) { env.GL_TOKEN = pat; r.catatan.push(`GL_TOKEN diambil dari ${namaPenyimpan(t.auth.keychain)} untuk proses ini saja`); }
    else r.catatan.push(`GL_TOKEN tidak ada di ${namaPenyimpan(t.auth.keychain)} — memakai lingkungan sesi bila ada; bila 401, pengguna menjalankan: ${perintahPat(t.auth.keychain)}`);
  }
  for (const c of r.catatan) console.error(`[sdd] ${c}`);
  console.error(`[sdd] ${[cmd, ...awal, ...r.argv].join(" ")}`);
  const p = jalankanProses(process.env.RUDISONE_UVX_BIN || cmd, [...awal, ...r.argv], { stdio: "inherit", env });
  if (p.error) { console.error(`[sdd] ${cmd} gagal dijalankan: ${p.error.message}`); return 1; }
  return p.status ?? 1;
}

function main(argv) {
  // sdd: argumen diteruskan apa adanya ke rudis (termasuk --flag miliknya).
  if (argv[0] === "sdd") return sdd(bacaManifest(), argv.slice(1));
  const opsi = argv.filter((a) => a.startsWith("--"));
  const [aksi = "siapkan", arg, arg2] = argv.filter((a) => !a.startsWith("--"));
  const manifest = bacaManifest();
  const daftar = manifest.perkakas, skillLuar = manifest.skill_luar ?? [];

  if (aksi === "versi") { console.log(daftar.map(versi).join(" ")); return 0; }
  if (aksi === "proyek") {
    if (!arg) { console.error("Pemakaian: bin/perkakas.sh proyek <folder> [--json]"); return 3; }
    let h;
    try { h = deteksiProyek(path.resolve(rumah(arg))); } catch (e) { console.error(`[proyek] ${e.message}`); return 3; }
    console.log(opsi.includes("--json") ? JSON.stringify(h, null, 2) : teksProyek(h)); return 0;
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
  if (aksi === "marketplace") {
    if (arg !== "cek") { console.error("Pemakaian: bin/perkakas.sh marketplace cek [<sumber>]"); return 3; }
    return cekMarketplace(manifest.kebijakan_marketplace, arg2);
  }
  if (aksi !== "siapkan" && aksi !== "cek") { console.error(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(4, 15).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); return 3; }

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

/** Mode GIT_ASKPASS — hanya saat perkakas.mjs menjalankan git untuk repo privat (env RUDISONE_ASKPASS_LAYANAN di proses git itu
 *  saja). PAT dibaca dari penyimpannya di proses ini dan hanya diserahkan ke git lewat stdout: tidak pernah lewat argumen, env, atau log. */
function askpass(prompt) {
  if (/^Username/i.test(prompt)) { console.log(process.env.RUDISONE_ASKPASS_PENGGUNA || "oauth2"); return 0; }
  const berkas = process.env.RUDISONE_ASKPASS_BERKAS;
  const v = berkas ? (fs.readFileSync(berkas, "utf8").split(/\r?\n/)[0] || null) : bacaRahasia(process.env.RUDISONE_ASKPASS_LAYANAN);
  if (!v) return 1;
  console.log(v);
  return 0;
}

/** `pat <layanan>` — PAT diketik saat diminta (tanpa gema), tidak pernah di argumen. macOS → Keychain (`security` meminta sendiri);
 *  Windows → penyimpan terenkripsi DPAPI; lainnya → berkas 0600 di ~/.config/rudisone/rahasia/<layanan>. Dijalankan PENGGUNA. */
async function pat(layanan) {
  if (!layananSah(layanan)) { console.error("Pemakaian: bin/perkakas.sh pat <layanan>   (mis. rudisone-rudis-sdd)"); return 3; }
  if (pakaiKeychain()) {
    const r = jalankanProses(process.env.RUDISONE_KEYCHAIN_BIN || "security", ["add-generic-password", "-U", "-s", layanan, "-a", process.env.USER || os.userInfo().username, "-w"], { stdio: "inherit" });
    return r.status ?? 1;
  }
  const v = (await bacaTersembunyi(`PAT untuk ${layanan} (tidak ditampilkan): `)).replace(/\r$/, "");
  if (!v) { console.error("PAT kosong — tidak disimpan."); return 1; }
  try { simpanRahasia(layanan, v); } catch (e) { console.error(`PAT gagal disimpan: ${e.message}`); return 1; }
  const j = jenisPenyimpan();
  console.error(`PAT ${layanan} tersimpan di ${tampilPath(rahasiaBerkas(layanan))} (${j === "dpapi" ? "terenkripsi DPAPI, hanya terbaca akun ini" : `mode 0600, hanya terbaca ${os.userInfo().username}`}).`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (process.env.RUDISONE_ASKPASS_LAYANAN) process.exitCode = askpass(argv[0] ?? "");
  else if (argv[0] === "pat") process.exitCode = await pat(argv[1]);
  else process.exitCode = main(argv);
}
