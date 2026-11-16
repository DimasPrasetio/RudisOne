// Sinyal langsung dari Claude Code ke Kantor RudisOne — hook + perintah pengelola.
// Hook ini mencatat KEJADIAN (bukan isi): "minta izin", "bertanya", "selesai", "keluar" + waktu + id sesi/subagent, satu
// berkas kecil per sesi (dan per subagent) di handoff/.kantor/. Kantor (kantor/server.mjs) membacanya agar status
// "Menunggu Anda" dan "Selesai" pasti & seketika; tanpa berkas ini Kantor tetap menebak dari transkrip seperti dulu.
// Hook dipasang `async` (Claude tidak menunggu), tidak pernah mencetak apa pun, tidak pernah menghalangi, dan diam bila gagal.
//   hook            dibaca Claude Code (stdin JSON) — dipasang oleh `pasang`
//   cek             status pemasangan (0 terpasang & mutakhir · 1 belum)
//   pasang [--ya]   tambahkan/perbarui hook di ~/.claude/settings.json (dijalankan PEMASANG/pemilik; cadangan dibuat dulu)
//   lepas [--ya]    hapus hook dari ~/.claude/settings.json
//   status          kejadian terbaru (hanya metadata) — untuk memeriksa bahwa sinyal sampai
//   uji '<json>'    tampilkan kejadian yang akan dicatat untuk satu masukan hook (tanpa menulis)
// Env uji: RUDISONE_KANTOR_KEJADIAN = folder kejadian; RUDISONE_SETTINGS_USER = settings yang dipasangi.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
const SETTINGS = process.env.RUDISONE_SETTINGS_USER || path.join(os.homedir(), ".claude", "settings.json");
/** Folder kejadian: per device (handoff/ tidak di-commit), bukan berkas terlindung hook kebijakan. */
export const FOLDER_KEJADIAN = process.env.RUDISONE_KANTOR_KEJADIAN || path.join(ROOT, "handoff", ".kantor");
const INI_LURUS = INI.replaceAll("\\", "/");   // Windows: perintah hook ditulis dengan `/`
const dikenaliMilik = (c) => { const s = String(c ?? ""); return s.includes(`"${INI}"`) || s.includes(`"${INI_LURUS}"`); };
/** Berkas kejadian yang tidak disentuh lebih dari ini dibuang (oleh hook, sesekali) — Kantor hanya memakai 48 jam terakhir. */
export const UMUR_MAKS_MS = 3 * 24 * 3600e3;
/** Id sesi / subagent / alat yang aman dipakai sebagai nama berkas & nilai (tanpa path, tanpa spasi). */
const ID_AMAN = /^[A-Za-z0-9_-]{1,128}$/;
const NOTIF_IZIN = new Set(["permission_prompt", "worker_permission_prompt"]);
const NOTIF_TANYA = new Set(["elicitation_dialog", "elicitation_url_dialog", "agent_needs_input"]);

/** Hook yang dipasang: kejadian Claude Code → matcher. `async` = Claude tidak menunggu hook ini selesai. */
export const KEJADIAN_HOOK = {
  PermissionRequest: { async: true },
  Notification: { matcher: [...NOTIF_IZIN, ...NOTIF_TANYA].join("|"), async: true },
  PreToolUse: { matcher: "^AskUserQuestion$", async: true },
  Stop: { async: true },
  StopFailure: { async: true },
  SubagentStop: { async: true },
  // sesi berakhir: proses Claude keluar — tidak async agar sempat tercatat sebelum prosesnya selesai
  SessionEnd: { async: false },
};

/**
 * Masukan hook Claude Code → kejadian ringkas, atau null bila tidak relevan. Hanya metadata: jenis (`izin` · `tanya` ·
 * `selesai` · `keluar`), waktu, id sesi, id subagent, id pemanggilan alat. Isi pesan, perintah, path, dan keluaran tidak
 * pernah diambil.
 */
export function kejadianDari(input, t = Date.now()) {
  if (!input || typeof input !== "object") return null;
  const sesi = input.session_id, agen = input.agent_id, alat = input.tool_use_id;
  if (typeof sesi !== "string" || !ID_AMAN.test(sesi)) return null;
  let k = null;
  switch (input.hook_event_name) {
    case "PermissionRequest": k = "izin"; break;
    case "Notification": k = NOTIF_IZIN.has(input.notification_type) ? "izin" : NOTIF_TANYA.has(input.notification_type) ? "tanya" : null; break;
    case "PreToolUse": k = input.tool_name === "AskUserQuestion" ? "tanya" : null; break;
    case "Stop": case "StopFailure": case "SubagentStop": k = "selesai"; break;
    case "SessionEnd": k = "keluar"; break;
    default: k = null;
  }
  if (!k) return null;
  return { sesi, agen: typeof agen === "string" && ID_AMAN.test(agen) ? agen : null, k, t,
    u: typeof alat === "string" && ID_AMAN.test(alat) ? alat : null };
}

/** Nama berkas satu sesi (`<sesi>.json`) atau satu subagent di sesi itu (`<sesi>~<subagent>.json`). */
export const namaBerkas = (sesi, agen = null) => `${sesi}${agen ? `~${agen}` : ""}.json`;
/** Kebalikan namaBerkas: { sesi, agen } atau null. */
export function uraiNama(nama) {
  const m = /^([A-Za-z0-9_-]{1,128})(?:~([A-Za-z0-9_-]{1,128}))?\.json$/.exec(String(nama));
  return m ? { sesi: m[1], agen: m[2] ?? null } : null;
}

/** Isi berkas kejadian → { k, t, u, s } tervalidasi (s = waktu "selesai" terakhir), atau null. */
export function uraiIsi(teks) {
  let j; try { j = JSON.parse(teks); } catch { return null; }
  if (!j || !["izin", "tanya", "selesai", "keluar"].includes(j.k) || !Number.isFinite(j.t)) return null;
  return { k: j.k, t: j.t, u: typeof j.u === "string" && ID_AMAN.test(j.u) ? j.u : null, s: Number.isFinite(j.s) ? j.s : null };
}

/** Tulis kejadian ke berkas sesinya (atomik: berkas sementara lalu ganti nama). `s` mengingat "selesai" terakhir: bukti
 *  bahwa sesi ini memang mengirim sinyal selesai (Kantor lalu berhenti menebak dari jeda waktu). */
export function catatKejadian(e, folder = FOLDER_KEJADIAN) {
  fs.mkdirSync(folder, { recursive: true });
  const f = path.join(folder, namaBerkas(e.sesi, e.agen));
  let s = null;
  try { s = uraiIsi(fs.readFileSync(f, "utf8"))?.s ?? null; } catch { /* belum ada */ }
  if (e.k === "selesai") s = e.t;
  const isi = JSON.stringify({ k: e.k, t: e.t, ...(e.u ? { u: e.u } : {}), ...(s ? { s } : {}) });
  const sementara = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(sementara, isi);
  try { fs.renameSync(sementara, f); } catch (err) { fs.rmSync(sementara, { force: true }); throw err; }
  return f;
}

/** Buang berkas kejadian yang sudah lama (dan sisa berkas sementara). Hanya di folder kejadian, hanya pola nama kita. */
export function bersihkanLama(folder = FOLDER_KEJADIAN, kini = Date.now()) {
  let n = 0;
  for (const nama of fs.readdirSync(folder)) {
    if (!uraiNama(nama) && !/^[A-Za-z0-9_~-]{1,260}\.json\.\d+\.tmp$/.test(nama)) continue;
    const f = path.join(folder, nama);
    try {
      const st = fs.lstatSync(f);
      if (st.isFile() && kini - st.mtimeMs > (nama.endsWith(".tmp") ? 60e3 : UMUR_MAKS_MS)) { fs.rmSync(f, { force: true }); n++; }
    } catch { /* sudah hilang */ }
  }
  return n;
}

/** Kejadian terbaru di folder (untuk `status` dan pemeriksaan): [{ sesi, agen, k, t }], terbaru dulu. */
export function daftarKejadian(folder = FOLDER_KEJADIAN, batas = 20) {
  let nama = [];
  try { nama = fs.readdirSync(folder); } catch { return []; }
  const hasil = [];
  for (const n of nama) {
    const id = uraiNama(n);
    if (!id) continue;
    try { const e = uraiIsi(fs.readFileSync(path.join(folder, n), "utf8")); if (e) hasil.push({ ...id, ...e }); } catch { /* sedang ditulis */ }
  }
  return hasil.sort((a, b) => b.t - a.t).slice(0, batas);
}

// ---------- pemasangan (dijalankan pemasang/pemilik) ----------
const perintahHook = () => `"${process.execPath.replaceAll("\\", "/")}" "${INI_LURUS}" hook`;
/** Entri settings yang diharapkan untuk satu kejadian. */
export function entriHook(kejadian) {
  const c = KEJADIAN_HOOK[kejadian];
  return { ...(c.matcher ? { matcher: c.matcher } : {}),
    hooks: [{ type: "command", command: perintahHook(), timeout: 10, ...(c.async ? { async: true } : {}) }] };
}
const milikKita = (e) => (e?.hooks ?? []).some((h) => dikenaliMilik(h?.command));
function bacaSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS, "utf8")); } catch (e) { if (e.code === "ENOENT") return {}; throw e; } }
/** Settings dengan hook kita dipasang/diperbarui (entri lain tidak disentuh, urutannya tetap). Entri kita di DEPAN: pemasang
 *  kebijakan (bin/kebijakan.mjs › settingsTerpasang) memindah entrinya ke akhir PreToolUse setiap kali — bila entri kita di
 *  belakangnya, kedua pemasang saling menggeser dan settings ditulis ulang di setiap pemasangan. Urutan tidak mengubah
 *  perilaku (hook yang cocok dijalankan bersamaan). */
export function denganHook(s) {
  const baru = structuredClone(s ?? {});
  baru.hooks ??= {};
  for (const k of Object.keys(KEJADIAN_HOOK)) baru.hooks[k] = [entriHook(k), ...(baru.hooks[k] ?? []).filter((e) => !milikKita(e))];
  return baru;
}
/** Settings tanpa hook kita. */
export function tanpaHook(s) {
  const baru = structuredClone(s ?? {});
  for (const k of Object.keys(baru.hooks ?? {})) {
    baru.hooks[k] = baru.hooks[k].filter((e) => !milikKita(e));
    if (!baru.hooks[k].length) delete baru.hooks[k];
  }
  if (baru.hooks && !Object.keys(baru.hooks).length) delete baru.hooks;
  return baru;
}
/** Terpasang & mutakhir: setiap kejadian punya tepat satu entri kita, sama persis dengan yang diharapkan. */
export function statusPasang(s = bacaSettings()) {
  return Object.keys(KEJADIAN_HOOK).every((k) => {
    const milik = (s.hooks?.[k] ?? []).filter(milikKita);
    return milik.length === 1 && JSON.stringify(milik[0]) === JSON.stringify(entriHook(k));
  });
}
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
  const s = bacaSettings();
  if (statusPasang(s)) { console.log(`Sudah terpasang di ${SETTINGS}.`); return 0; }
  console.log(`Akan memasang hook sinyal Kantor (${Object.keys(KEJADIAN_HOOK).join(", ")}) di ${SETTINGS}:`);
  console.log(`  ${perintahHook()}`);
  console.log("Hanya mencatat jenis kejadian, waktu, dan id sesi (tanpa isi); tidak pernah menghalangi Claude. Cadangan settings dibuat dulu.");
  if (!(await konfirmasi("Pasang sekarang?", opsi))) { console.log("Dibatalkan."); return 1; }
  tulisSettings(denganHook(s));
  console.log("Terpasang. Berlaku untuk sesi yang dimulai/dilanjutkan sesudah ini.");
  return 0;
}
async function lepas(opsi) {
  const s = bacaSettings();
  if (!Object.values(s.hooks ?? {}).some((xs) => xs.some(milikKita))) { console.log("Tidak terpasang."); return 0; }
  if (!(await konfirmasi(`Hapus hook sinyal Kantor dari ${SETTINGS}?`, opsi))) { console.log("Dibatalkan."); return 1; }
  tulisSettings(tanpaHook(s));
  console.log("Dilepas.");
  return 0;
}

// ---------- hook ----------
/** Masukan hook paling besar yang dibaca (PermissionRequest untuk Write bisa memuat isi berkas besar). */
const BATAS_MASUKAN = 8 * 1024 * 1024;
async function bacaStdin() {
  const bagian = []; let n = 0;
  for await (const c of process.stdin) { n += c.length; if (n <= BATAS_MASUKAN) bagian.push(c); }
  return n <= BATAS_MASUKAN ? Buffer.concat(bagian).toString("utf8") : null;
}
export function jalankanHook(teks, folder = FOLDER_KEJADIAN, t = Date.now()) {
  let input; try { input = JSON.parse(teks); } catch { return null; }
  const e = kejadianDari(input, t);
  if (!e) return null;
  const f = catatKejadian(e, folder);
  if (Math.random() < 0.02) bersihkanLama(folder, t);   // sesekali: folder tidak tumbuh walau Kantor tak pernah dibuka
  return f;
}

async function utama(argv) {
  const [cmd = "cek", ...opsi] = argv;
  if (cmd === "hook") {
    // gagal diam-diam: tanpa keluaran, exit 0 — agent tidak pernah terganggu oleh Kantor
    try { const t = Date.now(); const teks = await bacaStdin(); if (teks) jalankanHook(teks, FOLDER_KEJADIAN, t); } catch { /* abaikan */ }
    return 0;
  }
  if (cmd === "uji") { let j = null; try { j = JSON.parse(opsi[0] ?? "{}"); } catch { /* bukan JSON */ } console.log(JSON.stringify(kejadianDari(j), null, 2)); return 0; }
  if (cmd === "status") {
    const d = daftarKejadian();
    console.log(`Hook: ${statusPasang() ? "terpasang" : "BELUM terpasang"} (${SETTINGS}) · folder: ${FOLDER_KEJADIAN}`);
    if (!d.length) console.log("Belum ada kejadian tercatat.");
    for (const e of d) console.log(`${new Date(e.t).toISOString()}  ${e.k.padEnd(7)}  sesi ${e.sesi.slice(0, 8)}${e.agen ? ` · subagent ${e.agen.slice(0, 8)}` : ""}`);
    return 0;
  }
  if (cmd === "cek") {
    if (statusPasang()) { console.log(`Terpasang (${SETTINGS}).`); return 0; }
    console.log(`Belum terpasang atau belum mutakhir — pemilik menjalankan pemasang: ${path.join(ROOT, "install.sh")}`);
    return 1;
  }
  if (cmd === "pasang") return pasang(opsi);
  if (cmd === "lepas") return lepas(opsi);
  console.error("Pemakaian: bin/kantor-kejadian.sh cek | status | pasang [--ya] | lepas [--ya] | hook | uji '<json>'");
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = await utama(process.argv.slice(2));
