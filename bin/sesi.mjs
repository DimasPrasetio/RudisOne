#!/usr/bin/env node
// Backend sesi RudisOne per device (protokol.md › Model sesi; skill rudisone › backend-cli.md) — hanya membaca, kecuali
// `deteksi --tulis` (dipanggil install.sh) yang membuat konfigurasi/sesi.json bila belum ada.
//   desktop  alat sesi Claude Desktop (start_session, send_message, …) — dipaksa
//   cli      Claude Code CLI/ekstensi VS Code tanpa alat sesi Desktop: `claude --bg`, `claude agents --json`, SendMessage lintas sesi
//   auto     (bawaan macOS & Windows) COO memilih per sesi: alat sesi Desktop ada → desktop, selain itu → cli. Pembaca (Kantor,
//            metrik, cek-konsistensi) membaca kedua sumber. Linux & WSL2 bawaannya cli.
// Pemakaian: bin/sesi.sh [backend|deteksi [--tulis]|daftar [--json]|cek]
//   backend   cetak backend device ini (+ sumbernya)
//   deteksi   backend menurut OS; --tulis membuat konfigurasi/sesi.json bila belum ada (tidak pernah menimpa)
//   daftar    sesi RudisOne yang hidup (backend cli: `claude agents --json --all`); sesi yang menunggu izin → perintah attach
//   cek       backend cli: Claude Code ≥ VERSI_MIN, berkas pengaman sesi latar, folder yang belum dipercaya CLI
// Exit: 0 baik · 1 perlu perhatian · 3 argumen salah.
// Override (uji): RUDISONE_ROOT, RUDISONE_SESI (berkas konfigurasi), RUDISONE_CLAUDE_BIN, RUDISONE_CLAUDE_JSON (~/.claude.json),
//   RUDISONE_KANTOR_DESKTOP (folder metadata Desktop).
import { jalankan } from "./lib/platform.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const HOME = os.homedir();
export const VERSI_MIN = "2.1.300";
export const FILE_SESI = () => process.env.RUDISONE_SESI || path.join(ROOT, "konfigurasi", "sesi.json");
/** Pengaman sesi latar (bgIsolation none, deny push/rm, bypass dimatikan) — dipasang per sesi lewat `--settings`. */
export const SETTINGS_SESI = path.join(ROOT, "konfigurasi", "sesi-cli.settings.json");
const BIN = () => process.env.RUDISONE_CLAUDE_BIN || "claude";

/** Backend menurut OS. macOS & Windows: Claude Desktop mungkin ada, tetapi CLI dan ekstensi VS Code di OS yang sama tidak
 *  punya alat sesi Desktop → `auto` (COO memilih per sesi, lihat skill rudisone). Linux/WSL2 → cli. */
export const deteksi = (platform = process.platform) => (platform === "darwin" || platform === "win32" ? "auto" : "cli");

/** { backend, sumber }: konfigurasi/sesi.json bila sah ("desktop" | "cli" | "auto"), selain itu deteksi OS. */
export function backendSesi() {
  try {
    const b = JSON.parse(fs.readFileSync(FILE_SESI(), "utf8")).backend;
    if (b === "desktop" || b === "cli" || b === "auto") return { backend: b, sumber: "konfigurasi/sesi.json" };
  } catch { /* belum ada */ }
  return { backend: deteksi(), sumber: `deteksi OS (${process.platform})` };
}

/** Sumber data sesi yang dibaca perkakas pembaca (Kantor, metrik, cek-konsistensi): "auto" membaca keduanya, sehingga sesi
 *  yang dibentuk lewat alat Desktop maupun lewat `claude --bg` tampil. */
export const sumberBaca = (backend = backendSesi().backend) => (backend === "auto" ? ["cli", "desktop"] : [backend]);

/** Folder metadata sesi Claude Desktop per OS (format internal aplikasi; boleh tidak ada). Linux: dugaan, belum terverifikasi. */
export function folderDesktop(platform = process.platform, env = process.env, home = HOME) {
  if (env.RUDISONE_KANTOR_DESKTOP) return env.RUDISONE_KANTOR_DESKTOP;
  // join menurut OS tujuan (bukan OS yang menjalankan), agar hasilnya sama dengan yang dihitung di OS itu
  if (platform === "darwin") return path.posix.join(home, "Library", "Application Support", "Claude", "claude-code-sessions");
  if (platform === "win32") return path.win32.join(env.APPDATA || path.win32.join(home, "AppData", "Roaming"), "Claude", "claude-code-sessions");
  return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, ".config"), "Claude", "claude-code-sessions");
}

// ---- backend cli: `claude agents --json` (antarmuka resmi untuk dibaca dari sesi lain) --------------------------------

/** Daftar sesi dari `claude agents --json [--all]`, atau null bila CLI tidak ada / gagal. */
export function agentsCli({ semua = true, timeout = 8000 } = {}) {
  const r = jalankan(BIN(), ["agents", "--json", ...(semua ? ["--all"] : [])], { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] });
  if (r.status !== 0) return null;
  try { const j = JSON.parse(r.stdout); return Array.isArray(j) ? j : null; } catch { return null; }
}

const JABATAN = {
  coo: "COO", "head-of-strategy": "Head of Strategy", "financial-controller": "Financial Controller",
  "research-analyst": "Research Analyst", "hr-business-partner": "HR Business Partner", "tech-lead": "Tech Lead",
  "business-systems-analyst": "Business Systems Analyst", "software-engineer": "Software Engineer",
  "program-manager": "Program Manager", "technical-writer": "Technical Writer",
  "head-of-it-operations": "Head of IT Operations", "head-of-it-ops": "Head of IT Operations",
  "system-administrator": "System Administrator", sysadmin: "System Administrator",
};
/** Nama sesi RudisOne → judul seperti di sidebar Desktop: r<n>-lead-<proyek> → "Tech Lead · <proyek>", rudis-<id> → jabatan. */
export function judulDariNama(nama) {
  const n = String(nama ?? "");
  const tl = n.match(/^r[1-3]-lead-(.+)$/);
  if (tl) return `Tech Lead · ${tl[1]}`;
  const r = n.match(/^rudis-(.+?)(?:-(?:x|lagi|\d+))?$/);
  return r && JABATAN[r[1]] ? JABATAN[r[1]] : null;
}
const di = (p, akar) => { const a = path.resolve(p), b = path.resolve(akar); return a === b || a.startsWith(b + path.sep); };
/** Sesi milik RudisOne: bernama r<n>-lead-… / rudis-…, atau berjalan di dalam repo RudisOne. */
export const milikRudisOne = (s) => /^(r[1-3]-lead-|rudis-)/.test(String(s?.name ?? "")) || (typeof s?.cwd === "string" && s.cwd ? di(s.cwd, ROOT) : false);
/** Nama yang aman disalin pengguna ke terminal; selain itu sessionId. */
const aliasAman = (s) => (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(s.name ?? "")) ? s.name : s.sessionId);

/** Entri seragam untuk Kantor/metrik/cek-konsistensi: { cli, localId, title, archived, awaiting, state, waitingFor, cwd }. */
export function normalAgents(daftar) {
  return (Array.isArray(daftar) ? daftar : []).filter((s) => s && typeof s === "object" && typeof s.sessionId === "string"
    && /^[A-Za-z0-9._-]+$/.test(s.sessionId)).map((s) => {
    const state = String(s.state ?? s.status ?? "");
    const nama = typeof s.name === "string" && s.name ? s.name : null;
    return { cli: s.sessionId, localId: nama || s.sessionId, title: judulDariNama(nama) ?? nama,
      archived: /^(stopped|done|failed)$/.test(state), awaiting: state === "blocked" || !!s.waitingFor,
      state: String(state), waitingFor: typeof s.waitingFor === "string" ? s.waitingFor : null, cwd: typeof s.cwd === "string" ? s.cwd : null,
      rudisOne: milikRudisOne(s), perintah: state === "blocked" || s.waitingFor ? `claude attach ${aliasAman(s)}` : null };
  });
}

// ---- versi & kepercayaan folder ---------------------------------------------------------------------------------

export function versiClaude() {
  const r = jalankan(BIN(), ["--version"], { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0 ? (r.stdout.match(/\d+\.\d+\.\d+/)?.[0] ?? null) : null;
}
/** a ≥ b untuk versi x.y.z. */
export function versiCukup(a, b = VERSI_MIN) {
  if (!a) return false;
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return true;
}

/** Folder tempat COO membentuk sesi latar: akar RudisOne, ruang IT Operations, folder proyek di register, dan worktree
 *  Tech Lead yang sudah ada di proyek itu (`.claude/worktrees/r<n>-lead-*`). */
export function folderSesi() {
  const f = [ROOT, path.join(ROOT, "ruang", "head-of-it-operations"), path.join(ROOT, "ruang", "system-administrator")];
  try {
    const reg = JSON.parse(fs.readFileSync(process.env.RUDISONE_REGISTER || path.join(ROOT, "handoff", "register-tugas.json"), "utf8"));
    for (const t of reg.tugas ?? []) {
      const p = String(t.folder ?? "").replace(/\s*\(.*\)\s*$/, "").trim().replace(/^~(?=\/|$)/, HOME);
      if (!p || !path.isAbsolute(p) || !fs.existsSync(p)) continue;
      f.push(path.resolve(p));
      let wt = [];
      try { wt = fs.readdirSync(path.join(p, ".claude", "worktrees")).filter((n) => /^r[1-3]-lead-/.test(n)); } catch { /* belum ada */ }
      for (const n of wt) f.push(path.join(path.resolve(p), ".claude", "worktrees", n));
    }
  } catch { /* register belum ada */ }
  return [...new Set(f)];
}
/** Folder yang belum dipercaya CLI: `hasTrustDialogAccepted` di ~/.claude.json untuk folder PERSIS itu. Kepercayaan
 *  folder induk tidak dihitung — uji asap 2.1.281: ~/Documents/Neuron dipercaya, `claude --bg` di subfoldernya tetap
 *  "Workspace not trusted". */
export function belumDipercaya(folder = folderSesi()) {
  let proyek = {};
  try { proyek = JSON.parse(fs.readFileSync(process.env.RUDISONE_CLAUDE_JSON || path.join(HOME, ".claude.json"), "utf8")).projects ?? {}; }
  catch { /* belum pernah menjalankan claude */ }
  const dipercaya = Object.entries(proyek).filter(([, v]) => v?.hasTrustDialogAccepted).map(([k]) => k);
  return folder.filter((f) => !dipercaya.some((d) => path.resolve(d) === path.resolve(f)));
}

// ---- perintah -------------------------------------------------------------------------------------------------------

const tampil = (p) => (p.startsWith(HOME + path.sep) || p.startsWith(HOME + "/") ? `~${p.slice(HOME.length).replaceAll("\\", "/")}` : p);

function main(argv) {
  const [sub = "backend", ...rest] = argv;
  if (sub === "backend") { const b = backendSesi(); console.log(`${b.backend} (${b.sumber})`); return 0; }
  if (sub === "deteksi") {
    const b = deteksi();
    if (!rest.includes("--tulis")) { console.log(b); return 0; }
    if (fs.existsSync(FILE_SESI())) { console.log(`${backendSesi().backend} (konfigurasi/sesi.json sudah ada — tidak ditimpa)`); return 0; }
    fs.mkdirSync(path.dirname(FILE_SESI()), { recursive: true });
    fs.writeFileSync(FILE_SESI(), `${JSON.stringify({ backend: b, dideteksi: new Date().toISOString().slice(0, 10), sumber: `install.sh (${process.platform})` }, null, 2)}\n`);
    console.log(`${b} (ditulis ke konfigurasi/sesi.json)`);
    return 0;
  }
  if (sub === "daftar") {
    const { backend } = backendSesi();
    if (backend === "desktop") { console.log("backend desktop — daftar sesi lewat alat Desktop (list_sessions/get_session)"); return 0; }
    const d = agentsCli();
    if (!d) {
      if (backend === "auto") { console.log("backend auto — `claude agents --json` tidak tersedia; sesi Desktop: lewat alat Desktop (list_sessions/get_session)"); return 0; }
      console.log("`claude agents --json` gagal — Claude Code CLI tidak ada atau terlalu lama"); return 1;
    }
    const s = normalAgents(d).filter((x) => x.rudisOne);
    if (rest.includes("--json")) { console.log(JSON.stringify(s, null, 2)); return 0; }
    if (!s.length) { console.log("belum ada sesi RudisOne"); return 0; }
    for (const x of s) console.log(`${x.localId} · ${x.cli} · ${x.state || "?"}${x.waitingFor ? ` (${x.waitingFor})` : ""} · ${tampil(x.cwd ?? "")}`
      + (x.awaiting ? `\n    perlu pengguna: claude attach ${x.cli}` : ""));
    if (backend === "auto") console.log("(backend auto: sesi yang dibentuk lewat alat Desktop tidak tercantum di sini — gunakan list_sessions)");
    return 0;
  }
  if (sub === "cek") {
    const { backend, sumber } = backendSesi();
    console.log(`backend sesi: ${backend} (${sumber})`);
    if (backend === "desktop") return 0;
    if (backend === "auto") console.log("  [..] backend auto: Desktop dipakai bila alat sesinya ada; pemeriksaan di bawah hanya untuk jalur CLI/VS Code (`claude --bg`) dan tidak menggagalkan");
    let perlu = 0;
    const v = versiClaude();
    if (!v) { console.log("  [!!] Claude Code CLI (`claude`) tidak ditemukan"); perlu++; }
    else if (!versiCukup(v)) { console.log(`  [!!] Claude Code ${v} < ${VERSI_MIN} — perbarui (claude update) sebelum memakai sesi latar`); perlu++; }
    else console.log(`  [ok] Claude Code ${v} (≥ ${VERSI_MIN})`);
    if (fs.existsSync(SETTINGS_SESI)) console.log(`  [ok] pengaman sesi latar: ${tampil(SETTINGS_SESI)}`);
    else { console.log(`  [!!] ${tampil(SETTINGS_SESI)} hilang (jalankan: git checkout -- konfigurasi/sesi-cli.settings.json)`); perlu++; }
    const belum = belumDipercaya();
    if (!belum.length) console.log("  [ok] semua folder sesi sudah dipercaya Claude Code CLI");
    else {
      perlu++;
      console.log("  [!!] folder belum dipercaya CLI — `claude --bg` gagal di sana. Pengguna sekali saja, di terminal:");
      for (const f of belum) console.log(`         cd ${tampil(f)} && claude   (terima prompt percaya, lalu /exit)`);
    }
    return perlu && backend === "cli" ? 1 : 0;
  }
  console.error("Pemakaian: bin/sesi.sh [backend|deteksi [--tulis]|daftar [--json]|cek]");
  return 3;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(INI)) process.exitCode = main(process.argv.slice(2));
