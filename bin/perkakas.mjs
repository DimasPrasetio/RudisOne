#!/usr/bin/env node
// Perkakas resmi RudisOne (daftar: perkakas.json; aturan: sdlc.md › Perkakas resmi). Memastikan skill
// rudis-monorepo, pustaka rudis-modules, dan RUDIS SDD ada dan mutakhir di device ini, tanpa pernah menimpa
// pekerjaan pengguna di repo sumbernya. Dipanggil COO di awal setiap /rudisone dan oleh install.sh.
// Pemakaian: bin/perkakas.sh [siapkan|cek|versi|proyek <folder>|pastikan <skill>|skill|marketplace cek [<sumber>]|sdd <argumen rudis…>] [--segera] [--paksa]
//   siapkan  (default) clone bila belum ada · pull --ff-only bila bersih · pasang ulang skill bila beda dari paketnya
//   cek      laporkan keadaan tanpa mengubah apa pun (git fetch tetap jalan)
//   versi    satu baris untuk kolom "Perkakas" register tugas, mis. rudis@b444853 lib@43e552f sdd@e216888
//   proyek   jenis <folder>: rudis-pustaka · rudis-deploy · lain
//   pastikan skill luar <skill> tersedia; bila belum, dipasang dari sumber resminya (exit 0 · 1 · 2 alternatif · 3)
//   skill    keadaan semua skill luar (perkakas.json › skill_luar) tanpa memasang apa pun
//   marketplace cek [<sumber>]  validasi allowlist (perkakas.json › kebijakan_marketplace); dengan <sumber>: 0 diizinkan · 1 tidak
//   sdd      jalankan CLI rudis lewat `uvx --from <lokal>` (= bin/rudis-sdd.sh); --no-marketplace selalu, kecuali allowlist
//   --segera abaikan jeda 30 menit antar-fetch · --paksa jangan menunda walau ada tugas Engineering berjalan
// Exit: 0 siap · 1 perlu perhatian (kerja tetap lanjut dengan versi yang ada) · 3 argumen salah
// Override (uji): RUDISONE_LOKAL_<ID> (mis. RUDISONE_LOKAL_RUDIS_SDD) mengganti `lokal` satu entri;
//   RUDISONE_KEYCHAIN_BIN mengganti `security`; RUDISONE_UVX_BIN mengganti `uvx`.
// PAT repo privat (entri ber-`auth`) tidak pernah dicetak, ditulis ke berkas, atau masuk argumen: git memanggil
//   bin/perkakas.sh sebagai GIT_ASKPASS, dan skrip itu membaca Keychain sendiri.
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
const ASKPASS = path.join(ROOT, "bin", "perkakas.sh");
const binKeychain = () => process.env.RUDISONE_KEYCHAIN_BIN || "security";

const rumah = (p) => p.replace(/^~(?=\/|$)/, os.homedir());

function jalankan(cmd, args, cwd, envTambah = {}, timeout = 120_000) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...envTambah } });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || r.error?.message || "").trim() };
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

// ---- Keychain (macOS `security`) --------------------------------------------------------------------------------

/** Apakah layanan Keychain ada — tanpa membaca nilainya. */
export function adaDiKeychain(layanan) {
  return spawnSync(binKeychain(), ["find-generic-password", "-s", layanan], { stdio: "ignore", timeout: 15_000 }).status === 0;
}
/** Nilai PAT, hanya untuk lingkungan proses anak (GL_TOKEN rudis); null bila tidak ada. */
function bacaKeychain(layanan) {
  const r = spawnSync(binKeychain(), ["find-generic-password", "-s", layanan, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 });
  return r.status === 0 && r.stdout.trim() ? r.stdout.replace(/\r?\n$/, "") : null;
}
/** Perintah untuk pengguna: `-w` di akhir tanpa nilai → `security` meminta PAT secara interaktif. */
export const perintahKeychain = (layanan, perbarui = false) =>
  `security add-generic-password${perbarui ? " -U" : ""} -s ${layanan} -a "$USER" -w`;

/** Argumen + env git untuk entri ber-`auth`. PAT ada di Keychain → helper kredensial pengguna dimatikan untuk
 *  perintah itu (tidak ada yang tersimpan) dan git meminta PAT ke bin/perkakas.sh (mode GIT_ASKPASS). PAT belum
 *  ada → git biasa (helper kredensial milik pengguna bila ada, tanpa prompt). */
function aksesGit(t) {
  const layanan = t.auth?.keychain;
  if (!layanan || !adaDiKeychain(layanan)) return { pat: false, args: [], env: {} };
  return { pat: true, args: ["-c", "credential.helper="],
    env: { GIT_ASKPASS: ASKPASS, RUDISONE_ASKPASS_LAYANAN: layanan, RUDISONE_ASKPASS_PENGGUNA: t.auth.pengguna || "oauth2" } };
}
const GALAT_AUTH = /could not read (Username|Password)|Authentication failed|terminal prompts disabled|HTTP Basic: Access denied|returned error: 40[13]|\b40[13]\b/i;
function pesanAuth(t, akses) {
  const l = t.auth.keychain;
  return akses.pat
    ? `PAT di Keychain (${l}) ditolak — pengguna memperbaruinya (PAT diketik saat diminta, tidak di argumen): ${perintahKeychain(l, true)}`
    : `butuh PAT — belum ada di Keychain (${l}). Pengguna menjalankan (PAT GitLab read_repository + read_api, diketik saat diminta, tidak di argumen): ${perintahKeychain(l)}`;
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
    if (!v.ok) awas(`${nama}: \`${t.jalan[0]}\` tidak ditemukan — pasang uv dulu (mis. \`brew install uv\`)`);
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
      const r = jalankan("bash", [path.join(akar, t.pasang)], akar);
      if (r.ok && terpasangSamaDenganPaket(paket, terpasang)) ok(`${nama}: skill dipasang ulang dari paket sumber`);
      else awas(`${nama}: pemasangan gagal — ${baris1(r.err || r.out)}`);
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
 *  - `dilarang` (run ultimate/deploy/operate, tui) ditolak; --gitlab-token ditolak (PAT di argumen terlihat di `ps`).
 *  - --help/-h diteruskan apa adanya. */
export function rencanaSdd(t, kebijakan, args, { env = process.env, lokal } = {}) {
  const bantuan = args.includes("--help") || args.includes("-h");
  const p1 = args[0] ?? "", p2 = args[1] && !args[1].startsWith("-") ? args[1] : "";
  const kunci = `${p1} ${p2}`.trim();
  const catatan = [], argv = [...args];
  if (bantuan) return { argv, glToken: false, catatan };
  if (args.some((a) => a === "--gitlab-token" || a.startsWith("--gitlab-token="))) {
    return { tolak: `--gitlab-token menaruh PAT di argumen (terlihat di ps/log) — PAT dibaca dari Keychain (${t.auth?.keychain ?? "-"}) sebagai GL_TOKEN` };
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
      if (!args.includes(t.tanpa_marketplace.flag)) argv.push(t.tanpa_marketplace.flag);
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
    const pat = bacaKeychain(t.auth.keychain);
    if (pat) { env.GL_TOKEN = pat; r.catatan.push(`GL_TOKEN diambil dari Keychain (${t.auth.keychain}) untuk proses ini saja`); }
    else r.catatan.push(`GL_TOKEN tidak ada di Keychain (${t.auth.keychain}) — memakai lingkungan sesi bila ada; bila 401, pengguna menjalankan: ${perintahKeychain(t.auth.keychain)}`);
  }
  for (const c of r.catatan) console.error(`[sdd] ${c}`);
  console.error(`[sdd] ${[cmd, ...awal, ...r.argv].join(" ")}`);
  const p = spawnSync(process.env.RUDISONE_UVX_BIN || cmd, [...awal, ...r.argv], { stdio: "inherit", env });
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
