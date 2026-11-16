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

/** Nama alat yang aman disimpan (mis. "Bash", "mcp__srv__alat") — metadata, bukan masukan alat. */
const NAMA_ALAT = /^[A-Za-z0-9_.:-]{1,128}$/;
/**
 * Masukan hook Claude Code → kejadian ringkas, atau null bila tidak relevan. Hanya metadata: jenis (`izin` · `tanya` ·
 * `selesai` · `keluar`), waktu, id sesi, id subagent, id pemanggilan alat (PreToolUse), nama alat (PermissionRequest
 * Claude Code 2.1.317 tidak membawa id pemanggilan — Kantor mencocokkannya lewat nama alat), dan apakah ia pemberitahuan
 * (`notif`: Notification datang ±6 dtk setelah jendela izin muncul, hanya bila belum dijawab). Isi pesan, perintah, path,
 * dan keluaran tidak pernah diambil.
 */
export function kejadianDari(input, t = Date.now()) {
  if (!input || typeof input !== "object") return null;
  const sesi = input.session_id, agen = input.agent_id, alat = input.tool_use_id, namaAlat = input.tool_name;
  if (typeof sesi !== "string" || !ID_AMAN.test(sesi)) return null;
  let k = null;
  switch (input.hook_event_name) {
    // AskUserQuestion juga melewati pemeriksaan izin (PermissionRequest) — pertanyaannya sudah dicatat PreToolUse sebagai "tanya"
    case "PermissionRequest": k = input.tool_name === "AskUserQuestion" ? null : "izin"; break;
    case "Notification": k = NOTIF_IZIN.has(input.notification_type) ? "izin" : NOTIF_TANYA.has(input.notification_type) ? "tanya" : null; break;
    case "PreToolUse": k = input.tool_name === "AskUserQuestion" ? "tanya" : null; break;
    case "Stop": case "StopFailure": case "SubagentStop": k = "selesai"; break;
    case "SessionEnd": k = "keluar"; break;
    default: k = null;
  }
  if (!k) return null;
  return { sesi, agen: typeof agen === "string" && ID_AMAN.test(agen) ? agen : null, k, t,
    u: typeof alat === "string" && ID_AMAN.test(alat) ? alat : null,
    a: input.hook_event_name !== "Notification" && typeof namaAlat === "string" && NAMA_ALAT.test(namaAlat) ? namaAlat : null,
    notif: input.hook_event_name === "Notification" };
}

/** Nama berkas satu sesi (`<sesi>.json`) atau satu subagent di sesi itu (`<sesi>~<subagent>.json`). */
export const namaBerkas = (sesi, agen = null) => `${sesi}${agen ? `~${agen}` : ""}.json`;
/** Kebalikan namaBerkas: { sesi, agen } atau null. */
export function uraiNama(nama) {
  const m = /^([A-Za-z0-9_-]{1,128})(?:~([A-Za-z0-9_-]{1,128}))?\.json$/.exec(String(nama));
  return m ? { sesi: m[1], agen: m[2] ?? null } : null;
}

const angka = (x) => (Number.isFinite(x) ? x : null);
/** Isi berkas kejadian → { k, t, u, a, n, s, x, bt } tervalidasi, atau null. u = id pemanggilan alat · a = nama alat ·
 *  n = waktu pemberitahuan izin untuk jendela ini · s = waktu "selesai" terakhir · x = waktu "keluar" (SessionEnd) terakhir ·
 *  bt = waktu terakhir sesi ini terbukti mengirim pemberitahuan izin yang TERTUNDA (≥ 5 dtk setelah jendelanya muncul,
 *  perilaku Claude Code 2.1.317) · p = jendela izin/tanya sebelumnya { k, t, u, a, n } yang mungkin masih terbuka saat
 *  pemberitahuan jendela lain tercatat (Kantor menilainya dengan aturan alatnya sendiri), atau null. */
export function uraiIsi(teks) {
  let j; try { j = JSON.parse(teks); } catch { return null; }
  if (!j || !["izin", "tanya", "selesai", "keluar"].includes(j.k) || !Number.isFinite(j.t)) return null;
  const p = j.p && typeof j.p === "object" && ["izin", "tanya"].includes(j.p.k) && Number.isFinite(j.p.t) ? jendela(j.p) : null;
  return { ...jendela(j), s: angka(j.s), x: angka(j.x), bt: angka(j.bt), p };
}
/** Bagian "jendela" sebuah rekaman: jenis, waktu, id/nama alat, waktu pemberitahuan — tervalidasi. */
const jendela = (j) => ({ k: j.k, t: j.t, u: typeof j.u === "string" && ID_AMAN.test(j.u) ? j.u : null,
  a: typeof j.a === "string" && NAMA_ALAT.test(j.a) ? j.a : null, n: angka(j.n) });
const tanpaKosong = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
/** Claude Code 2.1.317 memasang pengatur waktu pemberitahuan izin (6 dtk) bersamaan dengan hook PermissionRequest: pemberitahuan
 *  yang jatuh ≤ TUNDA_MAKS_MS sesudah izin/tanya yang cocok jenisnya = jendela yang sama (dicatat sebagai tanda "jendela ini masih
 *  terbuka", tanpa menimpa jenis, id/nama alat, dan waktunya); yang jatuh di TUNDA_MIN_MS–TUNDA_MAKS_MS juga bukti sesi mengirim
 *  pemberitahuan tertunda. Lebih lambat dari itu = jendela lain (mis. tanpa PermissionRequest) → dicatat sebagai jendela baru. */
const TUNDA_MIN_MS = 5000, TUNDA_MAKS_MS = 9000;

/** Tulis kejadian ke berkas sesinya (atomik: berkas sementara lalu ganti nama). `s` mengingat "selesai" terakhir: bukti
 *  bahwa sesi ini memang mengirim sinyal selesai (Kantor lalu berhenti menebak dari jeda waktu); `bt` mengingat bahwa sesi
 *  ini mengirim pemberitahuan izin yang tertunda ±6 dtk (Kantor lalu boleh menyimpulkan izin yang tak kunjung diberitahukan
 *  sudah dijawab). Pemberitahuan yang datang seketika (bersamaan dengan jendela) tidak pernah menjadi bukti. */
const bacaKejadian = (f) => {
  try { const st = fs.lstatSync(f); return st.isFile() && st.size <= 4096 ? uraiIsi(fs.readFileSync(f, "utf8")) : null; } catch { return null; }
};
/** Jenis cocok: sama, atau pemberitahuan izin untuk pertanyaan (AskUserQuestion juga melewati pemeriksaan izin — 2.1.317). */
const jenisCocok = (lama, e) => lama.k === e.k || (e.k === "izin" && lama.k === "tanya" && lama.a === "AskUserQuestion");
const jendelaTerbuka = (lama, e) => !!lama && jenisCocok(lama, e) && e.t - lama.t >= 0 && e.t - lama.t <= TUNDA_MAKS_MS;
const tepatTunda = (lama, e) => e.t - lama.t >= TUNDA_MIN_MS && e.t - lama.t <= TUNDA_MAKS_MS;
/** Berkas tujuan kejadian. Notification Claude Code 2.1.317 tidak membawa agent_id walau jendelanya milik subagent → pemberitahuan
 *  tanpa id subagent dicatat pada jendela yang cocok di sesi itu (induk atau subagentnya) yang belum punya pemberitahuan dan
 *  muncul 5–9 dtk sebelumnya (paling dekat ke 6 dtk). Tidak ada → berkas sesi: digabung dengan jendela induk yang muncul ≤ 9 dtk
 *  sebelumnya, atau dicatat sebagai izin baru tanpa id/nama alat (jendela tanpa PermissionRequest, mis. konfirmasi keamanan;
 *  Kantor menganggapnya dijawab begitu sesi atau subagentnya melangkah lagi). */
export function berkasTujuan(e, folder = FOLDER_KEJADIAN) {
  const sendiri = namaBerkas(e.sesi, e.agen);
  if (!e.notif || e.agen) return sendiri;
  let nama = [];
  try { nama = fs.readdirSync(folder); } catch { return sendiri; }
  let pilih = null;
  for (const n of nama) {
    if (!n.startsWith(e.sesi) || uraiNama(n)?.sesi !== e.sesi) continue;
    const isi = bacaKejadian(path.join(folder, n));
    if (!jendelaTerbuka(isi, e) || isi.n != null || !tepatTunda(isi, e)) continue;
    const jarak = Math.abs(e.t - isi.t - 6000);
    if (!pilih || jarak < pilih.jarak) pilih = { n, jarak };
  }
  return pilih?.n ?? sendiri;
}

export function catatKejadian(e, folder = FOLDER_KEJADIAN) {
  fs.mkdirSync(folder, { recursive: true });
  const f = path.join(folder, berkasTujuan(e, folder));
  const lama = bacaKejadian(f);
  const s = e.k === "selesai" ? e.t : lama?.s ?? null;
  const x = e.k === "keluar" ? e.t : lama?.x ?? null;
  const jendelaSama = e.notif && jendelaTerbuka(lama, e);
  const bt = jendelaSama && e.k === "izin" && tepatTunda(lama, e) ? e.t : lama?.bt ?? null;
  const dasar = jendelaSama ? { k: lama.k, t: lama.t, u: lama.u, a: lama.a } : { k: e.k, t: e.t, u: e.u, a: e.a };
  const n = e.notif ? e.t : null;
  // pemberitahuan jendela lain sementara jendela izin/tanya sebelumnya mungkin masih terbuka: jendela itu disimpan (p), bukan
  // ditimpa — yang ber-id/nama alat didahulukan agar tetap bisa dinilai dari transkrip
  const lamaJendela = lama && ["izin", "tanya"].includes(lama.k) ? { k: lama.k, t: lama.t, u: lama.u, a: lama.a, n: lama.n } : null;
  const p = jendelaSama ? lama.p : e.notif && lamaJendela ? (lama.u || lama.a || !lama.p ? lamaJendela : lama.p) : null;
  const isi = JSON.stringify({ k: dasar.k, t: dasar.t, ...(dasar.u ? { u: dasar.u } : {}), ...(dasar.a ? { a: dasar.a } : {}),
    ...(n ? { n } : {}), ...(s ? { s } : {}), ...(x ? { x } : {}), ...(bt ? { bt } : {}), ...(p ? { p: tanpaKosong(p) } : {}) });
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
