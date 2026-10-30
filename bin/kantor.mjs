// Kantor RudisOne — tampilan kantor yang memperlihatkan apa yang sedang dikerjakan tiap agent.
// Menyalakan server lokal (127.0.0.1) bila belum jalan — atau memulai ulang server yang menjalankan kode
// lama (sidik server.mjs di /health berbeda dengan file di disk) — lalu membuka browser.
// Jalan di macOS, Linux, dan Windows (tanpa bash/curl/pkill).
// Pemakaian: bin/kantor.sh [buka|--tanpa-browser|mulai-ulang|berhenti|demo]
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bukaUrl, tidur, WINDOWS } from "./lib/platform.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "kantor", "server.mjs");
const PORT = process.env.RUDISONE_KANTOR_PORT || "7421";
const ALAMAT = `http://127.0.0.1:${PORT}`;
const LOG = path.join(process.env.TMPDIR || os.tmpdir(), "kantor-rudisone.log");
const PIDFILE = path.join(os.tmpdir(), `kantor-rudisone-${PORT}.pid`);
const AKSI = process.argv[2] || "buka";
const PEMAKAIAN = `Pemakaian: bin/kantor.sh [buka|--tanpa-browser|mulai-ulang|berhenti|demo]`;

const sidik = () => crypto.createHash("sha1").update(fs.readFileSync(SERVER)).digest("hex").slice(0, 12);

/** Isi /health bila server menjawab 200, selain itu null. */
const sehat = () => new Promise((selesai) => {
  // agent: false → tanpa keep-alive: soket lama ke server yang baru dimatikan tidak dipakai ulang
  const req = http.get(`${ALAMAT}/health`, { timeout: 2000, agent: false }, (res) => {
    let b = "";
    res.on("data", (d) => { b += d; });
    res.on("end", () => selesai(res.statusCode === 200 ? b.trim() : null));
  });
  req.on("timeout", () => { req.destroy(); selesai(null); });
  req.on("error", () => selesai(null));
});

/** Hentikan server Kantor milik repo ini: lewat berkas pid, lalu cari proses dengan baris perintah yang sama. */
function berhenti() {
  let ada = false;
  try {
    const pid = Number(fs.readFileSync(PIDFILE, "utf8"));
    if (pid > 0) { process.kill(pid); ada = true; }
  } catch { /* tidak ada berkas pid / proses sudah mati */ }
  fs.rmSync(PIDFILE, { force: true });
  if (WINDOWS) {
    const jalur = SERVER.replaceAll("'", "''");
    const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${jalur}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }`;
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) ada = true;
  } else {
    const r = spawnSync("pkill", ["-f", SERVER], { stdio: "ignore" });
    if (r.status === 0) ada = true;
  }
  return ada;
}

async function utama() {
  if (AKSI === "berhenti") { console.log(berhenti() ? "Kantor dimatikan." : "Kantor tidak sedang berjalan."); return 0; }
  if (!["buka", "--tanpa-browser", "mulai-ulang", "demo"].includes(AKSI)) { console.log(PEMAKAIAN); return 1; }

  let jalan = await sehat();
  if (jalan && (AKSI === "mulai-ulang" || jalan !== `ok ${sidik()}`)) {
    console.log("Memulai ulang Kantor (kode server berubah atau diminta).");
    berhenti();
    for (let i = 0; i < 20; i++) { if (!(await sehat())) break; tidur(250); }
    jalan = null;
  }
  if (!jalan) {
    const log = fs.openSync(LOG, "w");
    const anak = spawn(process.execPath, [SERVER], { detached: true, stdio: ["ignore", log, log], windowsHide: true,
      env: { ...process.env, RUDISONE_KANTOR_PORT: PORT } });
    anak.unref();
    if (anak.pid) fs.writeFileSync(PIDFILE, String(anak.pid));
    for (let i = 0; i < 20; i++) { if (await sehat()) break; tidur(250); }
  }
  if (!(await sehat())) {
    console.error(`Kantor gagal menyala. Log: ${LOG}`);
    try { console.error(fs.readFileSync(LOG, "utf8").split("\n").slice(-6).join("\n")); } catch { /* log tidak terbaca */ }
    return 1;
  }

  const url = AKSI === "demo" ? `${ALAMAT}/?demo=1` : ALAMAT;
  console.log(`Kantor RudisOne: ${url}`);
  if (AKSI === "--tanpa-browser" || AKSI === "mulai-ulang") return 0;
  // gagal membuka browser bukan galat: URL sudah dicetak di atas untuk dibuka manual
  bukaUrl(url);
  return 0;
}

process.exitCode = await utama();
