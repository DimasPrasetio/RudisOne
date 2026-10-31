// Persiapan RudisOne di device ini (macOS, Linux, Windows). Aman dijalankan berulang (idempoten): membuat folder per
// device dan berkas per device yang belum ada (TEAM.md, catatan/<id-peran>.md dari templat — tidak pernah menimpa),
// memeriksa prasyarat, menautkan skill & subagent ke ~/.claude, dan MEMASANG/MEMPERBARUI OTOMATIS di settings pengguna
// (T-20261031-2.3, pengguna: "di buat agar otomatis memasang saja, tidak perlu tanya"): hook kebijakan akses + penjaga
// .env (PreToolUse/PostToolUse/PostToolUseFailure), aturan permissions.deny Read .env*, dan hook pemuat ulang inti
// (SessionStart). Entri & aturan milik sistem lain tidak disentuh; settings hanya ditulis bila berubah, cadangan dulu.
// Pengganti install.sh — install.sh / install.cmd hanya memanggil berkas ini.
// Pemakaian: node install.mjs [--tanpa-perkakas] [--tanpa-hook]
//   --tanpa-perkakas : lewati bin/perkakas.sh siapkan (mis. saat menguji installer dari worktree atau HOME sementara)
//   --tanpa-hook     : jangan memasang hook/aturan izin (hanya periksa)
// Env uji: RUDISONE_INSTALL_PAKSA=1 membuat tautan & memasang hook walau repo bukan di lokasi rumahnya (HOME sementara);
// RUDISONE_SETTINGS_USER = settings yang dipasangi (bawaan ~/.claude/settings.json).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jalankan, osLogis } from "./bin/lib/platform.mjs";
import { folderClaudeUser, RUMAH_TAMPIL, rumahRepo, samaPath } from "./bin/lib/lokasi.mjs";
import { siapkanPerDevice } from "./bin/lib/per-device.mjs";
import { bersihkanYatim, pasangTautan } from "./bin/lib/tautan.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(ROOT, "bin");
const HOME = os.homedir();
const TANPA_PERKAKAS = process.argv.includes("--tanpa-perkakas");
const TANPA_HOOK = process.argv.includes("--tanpa-hook");
const AGENTS = ["system-administrator", "head-of-it-operations", "program-manager", "technical-writer", "software-engineer",
  "business-systems-analyst", "head-of-strategy", "research-analyst", "financial-controller", "hr-business-partner"];

let ok = 0; let warn = 0;
const cetak = (t) => process.stdout.write(`${t}\n`);
const pass = (t) => { cetak(`  [ok]   ${t}`); ok++; };
const fail = (t) => { cetak(`  [!!]   ${t}`); warn++; };
const info = (t) => cetak(`  [..]   ${t}`);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const node = (skrip, args = [], opsi = {}) => spawnSync(process.execPath, [path.join(BIN, skrip), ...args], { encoding: "utf8", ...opsi });
const bisaJalan = (cmd, args = ["--version"]) => { const r = jalankan(cmd, args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"] }); return !r.error && r.status === 0 ? r : null; };
const namaDi = (f) => { try { return fs.readFileSync(f, "utf8").split(/\r?\n/).slice(0, 3); } catch { return []; } };

cetak(`RudisOne — pemeriksaan di ${os.hostname()} (${osLogis()})`);

// Tautan ke ~/.claude hanya dibuat dari lokasi rumah: tautan dari worktree/salinan lain akan patah saat folder itu
// dihapus, dan install dari lokasi rumah menganggapnya milik sistem lain.
let taut = true;
if (samaPath(ROOT, rumahRepo())) pass(`lokasi repo: ${RUMAH_TAMPIL}`);
else if (process.env.RUDISONE_INSTALL_PAKSA === "1") fail(`repo ada di ${ROOT} (bukan lokasi rumah) — tautan tetap dibuat karena RUDISONE_INSTALL_PAKSA=1`);
else { taut = false; fail(`repo ada di ${ROOT} — pindahkan/clone ke ${RUMAH_TAMPIL} (peran merujuk path itu); skill & subagent TIDAK ditautkan dari lokasi ini`); }

fs.mkdirSync(path.join(ROOT, "handoff"), { recursive: true });
fs.closeSync(fs.openSync(path.join(ROOT, "handoff", ".gitkeep"), "a"));
pass("folder handoff/ siap");
fs.mkdirSync(path.join(ROOT, "catatan"), { recursive: true });
pass("folder catatan/ siap (ingatan per peran, per device — tidak di-commit)");
// TEAM.md + catatan/<id-peran>.md dari templat bila belum ada (dibaca di awal sesi) — yang sudah ada tidak pernah ditimpa.
try {
  const pd = siapkanPerDevice(ROOT, { sumber: ROOT });
  pass(`berkas per device dari templat: ${pd.dibuat.length} dibuat, ${pd.ada.length} sudah ada (TEAM.md, catatan/<id-peran>.md)`);
} catch (e) { fail(`berkas per device (TEAM.md, catatan/) tidak bisa disiapkan: ${e.message}`); }
// Berkas per device yang masih dilacak git (mis. catatan/ sebelum serah migrasi v5) — merge bisa menghapusnya dari disk.
const git = spawnSync("git", ["-C", ROOT, "ls-files", "-ci", "--exclude-standard"], { encoding: "utf8" });
const dilacak = git.status === 0 ? [...new Set(git.stdout.split(/\r?\n/).filter(Boolean).map((f) => f.split("/")[0]))].sort().join(" ") : "";
if (dilacak) fail(`berkas per device masih dilacak git: ${dilacak} — sebelum merge: git rm -r --cached ${dilacak} && git commit (README › Serah migrasi v5 ke main)`);
else pass("berkas per device tidak dilacak git");

// Berkas peran di ruang sesi: salinan terbangkit dari agents/ oleh bin/peran.mjs (dulu symlink).
const cekPeran = (f, id) => {
  if (fs.existsSync(f) && namaDi(f).includes(`name: ${id}`)) pass(`peran ${id} ada di ruang sesi`);
  else fail(`peran ${id} tidak ada/rusak di ${rel(f)} (jalankan: node bin/peran.mjs bangun)`);
};
cekPeran(path.join(ROOT, ".claude", "agents", "coo.md"), "coo");
// Tech Lead tidak punya ruang: sesinya di folder proyek (worktree), peran dari pembuka brief.
if (namaDi(path.join(ROOT, "agents", "tech-lead.md")).includes("name: tech-lead")) pass("peran tech-lead ada");
else fail("agents/tech-lead.md hilang (jalankan: git checkout -- .)");
for (const f of ["raci.md", "protokol.md", "CLAUDE.md", "templat/team.md", "templat/catatan.md", "templat/register-tugas.md"]) {
  if (fs.existsSync(path.join(ROOT, f))) pass(`${f} ada`); else fail(`${f} hilang (jalankan: git checkout -- .)`);
}
for (const a of AGENTS) cekPeran(path.join(ROOT, "ruang", a, ".claude", "agents", `${a}.md`), a);

// Subagent peran (protokol.md › Model sesi): agen/rudis-<id-peran>.md dibangkitkan dari agents/ + protokol.md,
// ditautkan ke ~/.claude/agents agar bisa dipanggil `Agent` dengan subagent_type "rudis-<id-peran>" dari sesi mana pun.
if (node("peran.mjs", ["cek"]).status === 0) pass("definisi subagent peran mutakhir (agen/)");
else fail(`agen/ basi — jalankan: node ${path.join(BIN, "peran.mjs")} bangun`);

const dirAgen = path.join(ROOT, "agen");
const subagen = fs.existsSync(dirAgen) ? fs.readdirSync(dirAgen).filter((f) => /^rudis-.*\.md$/.test(f)).sort() : [];
const claude = folderClaudeUser(HOME);
const lapor = (nama, jenis, r, tujuan) => {
  if (r.status === "asing") fail(`${tujuan} sudah dipakai sistem lain — tidak disentuh, periksa manual`);
  else pass(`${jenis} ${nama} tertaut (${r.mode}${r.status === "sama" ? ", sudah mutakhir" : ""})`);
};
if (taut) {
  for (const n of subagen) {
    const tujuan = path.join(claude, "agents", n);
    lapor(n.slice(0, -3), "subagent", pasangTautan(path.join(dirAgen, n), tujuan, ROOT), `~/.claude/agents/${n}`);
  }
  // tautan subagent yatim milik repo ini (peran dihapus) dibersihkan
  const dAgents = path.join(claude, "agents");
  if (fs.existsSync(dAgents)) for (const n of fs.readdirSync(dAgents).filter((f) => /^rudis-.*\.md$/.test(f))) {
    if (bersihkanYatim(path.join(dAgents, n), ROOT)) pass(`tautan yatim ${n} dihapus`);
  }
}

// Skill tim → ~/.claude/skills (tersedia di semua sesi, termasuk sesi tugas di folder proyek)
const dirSkill = path.join(ROOT, "skills");
if (taut && fs.existsSync(dirSkill)) {
  for (const n of fs.readdirSync(dirSkill).filter((d) => fs.statSync(path.join(dirSkill, d)).isDirectory()).sort()) {
    const tujuan = path.join(claude, "skills", n);
    lapor(n, "skill", pasangTautan(path.join(dirSkill, n), tujuan, ROOT, { folder: true }), `~/.claude/skills/${n}`);
  }
}

for (const s of ["server-cek", "rilis-cek", "pasca-deploy", "perkakas", "kebijakan", "konfig", "register", "peran", "inti", "cek-konsistensi", "sesi"]) {
  const f = path.join(BIN, `${s}.sh`);
  let bisa = fs.existsSync(f);
  if (bisa && process.platform !== "win32") { try { fs.accessSync(f, fs.constants.X_OK); } catch { bisa = false; } }
  if (bisa) pass(`perkakas bin/${s}.sh`); else fail(`bin/${s}.sh tidak ada/tidak executable (jalankan: chmod +x ${BIN}/*.sh)`);
}
if (fs.existsSync(path.join(BIN, "kantor.sh"))) pass("perkakas bin/kantor.sh"); else fail("bin/kantor.sh tidak ada");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) pass(`Node.js v${process.versions.node} — dipakai Kantor RudisOne`);
else fail("Node.js 18+ tidak ditemukan — dibutuhkan bin/kantor.sh");
// Kebijakan akses + penjaga .env + pemuat ulang inti: dipasang/diperbarui otomatis (idempoten). Hanya dari lokasi rumah:
// hook yang menunjuk worktree/salinan lain akan patah (atau diam-diam usang) saat folder itu dihapus/tertinggal.
const pasangHook = (skrip, nama) => {
  const r = node(skrip, ["pasang", "--ya"]);
  if (r.status !== 0) { fail(`${nama} gagal dipasang: ${String(r.stdout || r.stderr).trim().split(/\r?\n/).at(-1)}`); return; }
  const sudah = /Sudah terpasang/.test(r.stdout);
  pass(`${nama} ${sudah ? "sudah mutakhir" : "dipasang/diperbarui (cadangan settings dibuat)"}`);
};
if (TANPA_HOOK) info("pemasangan hook & aturan izin dilewati (--tanpa-hook)");
else if (!taut) info("hook & aturan izin tidak dipasang dari lokasi ini (bukan lokasi rumah)");
else {
  pasangHook("kebijakan.mjs", "kebijakan akses + penjaga .env (hook & permissions.deny)");
  pasangHook("inti.mjs", "hook pemuat ulang inti (SessionStart)");
}
if (node("kebijakan.mjs", ["cek"]).status === 0) pass("kebijakan akses RudisOne terpasang & mutakhir (hook + aturan .env)");
else fail(`kebijakan akses RudisOne belum terpasang/mutakhir — jalankan ulang: ${path.join(ROOT, "install.sh")} (lihat: node ${path.join(BIN, "kebijakan.mjs")} cek)`);
if (node("inti.mjs", ["cek"]).status === 0) pass("hook pemuat ulang inti RudisOne terpasang (SessionStart)");
else fail(`hook pemuat ulang inti belum terpasang — jalankan ulang: ${path.join(ROOT, "install.sh")}`);
// Perkakas resmi SDLC (skill rudis-sdlc): skill rudis-monorepo + pustaka rudis-modules (+ RUDIS SDD) — pasang/perbarui.
if (TANPA_PERKAKAS) info("perkakas resmi SDLC dilewati (--tanpa-perkakas)");
else if (bisaJalan("git")) {
  const r = node("perkakas.mjs", ["siapkan", "--segera"]);
  for (const l of String(r.stdout ?? "").split(/\r?\n/).filter(Boolean)) cetak(`  ${l}`);
  if (r.status === 0) pass("perkakas resmi SDLC siap"); else fail("perkakas resmi SDLC perlu perhatian (lihat baris di atas)");
} else fail("perkakas resmi SDLC dilewati — butuh node dan git");
if (bisaJalan("gh")) pass("GitHub CLI (gh) — dipakai rilis-cek.sh");
else fail("gh tidak ditemukan — rilis-cek.sh butuh GitHub CLI yang sudah login");

const cli = bisaJalan("claude");
if (cli) pass(`Claude Code CLI: ${cli.stdout.trim().split(/\r?\n/)[0]}`);
else fail("Claude Code CLI tidak ditemukan (opsional bila hanya memakai Claude Desktop)");

// Backend sesi per device (protokol.md › Model sesi): desktop (macOS/Windows) · cli (Linux/WSL2, tanpa Claude Desktop).
// konfigurasi/sesi.json ditulis sekali (tidak pernah ditimpa; ubah manual bila perlu). Backend cli: versi CLI ≥ 2.1.300,
// pengaman sesi latar, dan folder yang harus dipercaya sekali oleh pengguna (skills/rudisone/backend-cli.md).
{
  const d = node("sesi.mjs", ["deteksi", "--tulis"]);
  pass(`backend sesi: ${String(d.stdout).trim()}`);
  const be = String(node("sesi.mjs", ["backend"]).stdout).split(" ")[0];
  if (be === "cli" || be === "auto") {
    const c = node("sesi.mjs", ["cek"]);
    for (const l of String(c.stdout).split(/\r?\n/).slice(1).filter(Boolean)) cetak(`  ${l}`);
    if (c.status === 0) pass(be === "cli" ? "backend sesi cli siap" : "jalur CLI/VS Code (backend auto) tersedia");
    else fail("backend sesi cli perlu perhatian (lihat baris di atas) — sesi Tech Lead/IT Operations belum bisa dibentuk");
  }
}

// Server & DNS: fakta per device di konfigurasi/server.json (penyedia.md › Konfigurasi server), bukan di repo.
if (node("konfig.mjs", ["cek"]).status === 0) {
  pass("konfigurasi server lengkap (konfigurasi/server.json)");
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "konfigurasi", "server.json"), "utf8")); } catch { /* sudah divalidasi konfig cek */ }
  for (const alias of Object.keys(cfg.server ?? {})) {
    const h = String(node("konfig.mjs", ["host", alias]).stdout).trim();
    const s = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", h, "true"], { stdio: "ignore", timeout: 30_000 });
    if (s.status === 0) pass(`ssh ${h} (${alias})`);
    else fail(`ssh ${h} (${alias}) gagal — siapkan kunci SSH + entri Host ${h} di ~/.ssh/config`);
  }
  const mcp = String(node("konfig.mjs", ["get", "dns.mcp_server"]).stdout).trim();
  if (mcp && mcp !== "null") {
    let json = "";
    try { json = fs.readFileSync(path.join(HOME, ".claude.json"), "utf8"); } catch { /* belum ada */ }
    if (json.includes(`"${mcp}"`)) pass(`MCP ${mcp} terpasang`);
    else fail(`MCP ${mcp} belum terpasang/login (dipakai System Administrator untuk domain & DNS)`);
  }
} else info("konfigurasi server belum ada — diisi saat koneksi server pertama (COO menanyakan pengguna)");

let izinDeploy = false;
try { izinDeploy = fs.readFileSync(path.join(ROOT, "ruang", "system-administrator", ".claude", "settings.local.json"), "utf8").includes("deploy.sh"); } catch { /* belum ada */ }
if (izinDeploy) pass("izin deploy tetap System Administrator");
else info("izin deploy tetap belum ada (opsional) — lihat README › Izin deploy tetap");

// Agent bernama sama di ~/.claude/agents akan bentrok dengan peran RudisOne.
for (const a of AGENTS) if (fs.existsSync(path.join(claude, "agents", `${a}.md`))) fail(`~/.claude/agents/${a}.md ada — bentrok dengan peran RudisOne, pindahkan ke cadangan`);

// Pemeriksa konsistensi (drift dokumen vs yang terpasang) — read-only.
if (node("cek-konsistensi.mjs", [], { stdio: "ignore" }).status === 0) pass("pemeriksa konsistensi bersih");
else fail(`pemeriksa konsistensi menemukan drift — lihat: node ${path.join(BIN, "cek-konsistensi.mjs")}`);

cetak("");
cetak(`Hasil: ${ok} ok, ${warn} perlu perhatian.`);
cetak("Langkah berikut: buka sesi Claude Code di folder proyek mana pun, lalu ketik /rudisone <permintaan>.");
cetak("Panggilan pertama hanya menyiapkan COO; Tech Lead dibentuk per proyek saat ada tugas, IT Operations saat ada tugas server/deploy,");
cetak("peran lain dipanggil sebagai subagent rudis-<peran>. Kantor: http://127.0.0.1:7421/");
