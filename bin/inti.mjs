// Pemuat ulang protokol inti RudisOne setelah kompaksi — hook SessionStart Claude Code + perintah pengelola.
// Sesi di dalam folder RudisOne memuat inti lewat CLAUDE.md (bertahan setelah kompaksi). Sesi RudisOne di folder
// proyek (COO lewat /rudisone, Tech Lead, sesi saat dibutuhkan) memuat peran & inti lewat Read, yang hilang saat
// konteks diringkas; hook ini menyuntikkan perintah baca-ulang yang spesifik peran saat sesi seperti itu dilanjutkan
// (source compact/resume). Sesi pribadi pengguna dilewati tanpa keluaran.
//   hook            dibaca Claude Code (stdin JSON) — dipasang oleh `pasang`
//   cek             status pemasangan
//   pasang [--ya]   tambahkan hook ke ~/.claude/settings.json (dijalankan PENGGUNA; cadangan dibuat dulu)
//   lepas [--ya]    hapus hook dari ~/.claude/settings.json
//   uji '<json>'    simulasikan satu masukan hook
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { posix } from "./lib/platform.mjs";

const HOME = os.homedir();
const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const SETTINGS = process.env.RUDISONE_SETTINGS_USER || path.join(HOME, ".claude", "settings.json");
const RUMAH = "~/Documents/Neuron/ai-agent/RudisOne";
const PENANDA = `"${INI}"`;   // path absolut skrip ini — hook sistem lain tidak dianggap milik kita
const INI_LURUS = posix(INI);   // Windows: perintah hook ditulis dengan `/`; bentuk `\` lama tetap dikenali
const dikenaliMilik = (c) => { const s = String(c ?? ""); return s.includes(PENANDA) || s.includes(`"${INI_LURUS}"`); };
const MATCHER = "compact|resume";
/** Batas baca transkrip (byte dari akhir dan awal) — cukup untuk pembuka peran & ID tugas terakhir. */
const BATAS = 2_000_000;

const ID_PERAN = {
  "COO": "coo", "Tech Lead": "tech-lead", "Business Systems Analyst": "business-systems-analyst",
  "Software Engineer": "software-engineer", "Program Manager": "program-manager", "Technical Writer": "technical-writer",
  "Head of Strategy": "head-of-strategy", "Financial Controller": "financial-controller", "Research Analyst": "research-analyst",
  "HR Business Partner": "hr-business-partner", "Head of IT Operations": "head-of-it-operations",
  "System Administrator": "system-administrator",
};
const NAMA = Object.keys(ID_PERAN).sort((a, b) => b.length - a.length);
const RE_KAMU = new RegExp(`Kamu adalah\\s+\\**\\s*(${NAMA.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\**(?:\\s*#\\d)?\\**\\s+di RudisOne`);
const RE_ID = /\bT-\d{8}-\d+(?:\.\d+)?\b/g;

const di = (anak, induk) => { const a = path.resolve(anak), b = path.resolve(induk); return a === b || a.startsWith(b + path.sep); };

function teksPengguna(b) {
  if (b?.type !== "user" || !b.message) return "";
  const c = b.message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((x) => x?.type === "text").map((x) => x.text).join("\n");
  return "";
}

function bacaBaris(file) {
  const st = fs.statSync(file);
  const fd = fs.openSync(file, "r");
  try {
    if (st.size <= BATAS * 2) { const b = Buffer.alloc(st.size); fs.readSync(fd, b, 0, st.size, 0); return b.toString("utf8").split("\n"); }
    const a = Buffer.alloc(BATAS), z = Buffer.alloc(BATAS);
    fs.readSync(fd, a, 0, BATAS, 0); fs.readSync(fd, z, 0, BATAS, st.size - BATAS);
    return [...a.toString("utf8").split("\n").slice(0, -1), ...z.toString("utf8").split("\n").slice(1)];
  } finally { fs.closeSync(fd); }
}

/** { jabatan, id, tugas } bila transkrip menandai sesi RudisOne; selain itu null. */
export function kenali(transcriptPath) {
  let baris = [];
  try { baris = bacaBaris(transcriptPath); } catch { return null; }
  let jabatan = null, tugas = null;
  for (const l of baris) {
    if (!l.trim()) continue;
    let b; try { b = JSON.parse(l); } catch { continue; }
    const t = teksPengguna(b);
    if (t) {
      const m = t.match(RE_KAMU);
      if (m && !jabatan) jabatan = m[1];
      if (!jabatan && t.includes("<command-name>/rudisone</command-name>")) jabatan = "COO";
      const ids = t.match(RE_ID); if (ids) tugas = ids[ids.length - 1];
    }
    if (!jabatan && b.type === "assistant" && Array.isArray(b.message?.content)
      && b.message.content.some((c) => c?.type === "tool_use" && c.name === "Skill" && c.input?.skill === "rudisone")) jabatan = "COO";
  }
  return jabatan ? { jabatan, id: ID_PERAN[jabatan], tugas } : null;
}

/** Keluaran hook (objek JSON) atau null bila tidak perlu bertindak. */
export function putuskan(input) {
  if (!input || input.hook_event_name && input.hook_event_name !== "SessionStart") return null;
  if (input.source && !["compact", "resume"].includes(input.source)) return null;
  if (input.cwd && di(String(input.cwd).replace(/^~(?=\/|$)/, HOME), ROOT)) return null;   // CLAUDE.md sudah memuat inti
  if (!input.transcript_path) return null;
  const s = kenali(input.transcript_path);
  if (!s) return null;
  const baca = [`${RUMAH}/protokol.md`];
  if (s.id === "coo") baca.push(`${RUMAH}/agents/coo.md`, `${RUMAH}/catatan/coo.md`, `${RUMAH}/TEAM.md`);
  else baca.push(`${RUMAH}/agents/${s.id}.md`, `${RUMAH}/catatan/${s.id}.md`);
  if (s.tugas) baca.push(`${RUMAH}/handoff/${s.tugas.split(".")[0]}/ (pemahaman.md, status.md bila ada)`);
  const teks = `[RudisOne] Konteks sesi ini baru saja diringkas atau dilanjutkan. Kamu adalah ${s.jabatan} di RudisOne`
    + `${s.tugas ? `; tugas terakhir yang terlihat: ${s.tugas}` : ""}. Sebelum melanjutkan, BACA ULANG berkas berikut dengan Read`
    + ` (aturan dan peranmu tidak lagi utuh di konteks): ${baca.join(" · ")}. Lalu lanjutkan tugas dari tempat terakhir.`;
  return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: teks } };
}

// ---------- pemasangan (dijalankan pengguna) ----------
function entriHook() {
  return { matcher: MATCHER, hooks: [{ type: "command", command: `"${posix(process.execPath)}" "${INI_LURUS}" hook`, timeout: 10 }] };
}
const milikKita = (e) => (e?.hooks ?? []).some((h) => dikenaliMilik(h?.command));
function bacaSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
export function statusPasang() { return (bacaSettings().hooks?.SessionStart ?? []).some(milikKita); }
async function konfirmasi(pesan, opsi) {
  if (opsi.includes("--ya")) return true;
  if (!process.stdin.isTTY) { console.error("Bukan terminal interaktif — tambahkan --ya bila memang dijalankan pemilik."); return false; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const j = await new Promise((r) => rl.question(`${pesan} [y/N] `, r)); rl.close();
  return /^y(a|es)?$/i.test(j.trim());
}
function tulisSettings(s) {
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.cadangan-rudisone-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, `${JSON.stringify(s, null, 2)}\n`);
}
async function pasang(opsi) {
  if (statusPasang()) { console.log(`Sudah terpasang di ${SETTINGS}.`); return 0; }
  console.log(`Akan menambahkan hook SessionStart (matcher "${MATCHER}") RudisOne ke ${SETTINGS}:`);
  console.log(`  ${entriHook().hooks[0].command}`);
  console.log("Hanya bertindak di sesi RudisOne di luar folder RudisOne; sesi lain tidak mendapat keluaran. Cadangan settings dibuat dulu.");
  if (!(await konfirmasi("Pasang sekarang?", opsi))) { console.log("Dibatalkan."); return 1; }
  const s = bacaSettings();
  s.hooks ??= {};
  s.hooks.SessionStart = [...(s.hooks.SessionStart ?? []).filter((e) => !milikKita(e)), entriHook()];
  tulisSettings(s);
  console.log("Terpasang. Berlaku untuk sesi yang dimulai/dilanjutkan sesudah ini.");
  return 0;
}
async function lepas(opsi) {
  const s = bacaSettings();
  if (!(s.hooks?.SessionStart ?? []).some(milikKita)) { console.log("Tidak terpasang."); return 0; }
  if (!(await konfirmasi(`Hapus hook SessionStart RudisOne dari ${SETTINGS}?`, opsi))) { console.log("Dibatalkan."); return 1; }
  s.hooks.SessionStart = s.hooks.SessionStart.filter((e) => !milikKita(e));
  if (!s.hooks.SessionStart.length) delete s.hooks.SessionStart;
  if (!Object.keys(s.hooks).length) delete s.hooks;
  tulisSettings(s);
  console.log("Dilepas.");
  return 0;
}

async function bacaStdin() { let s = ""; for await (const c of process.stdin) s += c; return s; }

async function utama(argv) {
  const [cmd = "cek", ...opsi] = argv;
  if (cmd === "hook") {
    try { const out = putuskan(JSON.parse((await bacaStdin()) || "{}")); if (out) process.stdout.write(JSON.stringify(out)); }
    catch { /* gagal terbuka: tanpa keluaran */ }
    return 0;
  }
  if (cmd === "uji") { console.log(JSON.stringify(putuskan(JSON.parse(opsi[0] ?? "{}")), null, 2)); return 0; }
  if (cmd === "cek") {
    if (statusPasang()) { console.log(`Terpasang (${SETTINGS}).`); return 0; }
    console.log(`Belum terpasang — pemilik menjalankan: ${path.join(ROOT, "bin", "inti.sh")} pasang`);
    return 1;
  }
  if (cmd === "pasang") return pasang(opsi);
  if (cmd === "lepas") return lepas(opsi);
  console.error("Pemakaian: bin/inti.sh cek | pasang [--ya] | lepas [--ya] | hook | uji '<json>'");
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = await utama(process.argv.slice(2));
