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
// log per port (7421 tetap di nama lama): Kantor uji di port lain tidak menimpa log Kantor yang sedang dipakai (T4)
const LOG = path.join(process.env.TMPDIR || os.tmpdir(), PORT === "7421" ? "kantor-rudisone.log" : `kantor-rudisone-${PORT}.log`);
const PIDFILE = path.join(os.tmpdir(), `kantor-rudisone-${PORT}.pid`);   // hanya dibersihkan (versi lama menulisnya)
const AKSI = process.argv[2] || "buka";
const PEMAKAIAN = `Pemakaian: bin/kantor.sh [buka|--tanpa-browser|mulai-ulang|berhenti|demo]`;

const sidik = () => crypto.createHash("sha1").update(fs.readFileSync(SERVER)).digest("hex").slice(0, 12);

/** Baris pertama /health (`ok <versi>`) bila server menjawab 200, selain itu null. Baris berikutnya (sumber data) hanya
 *  untuk dibaca orang. */
const sehat = () => new Promise((selesai) => {
  // agent: false → tanpa keep-alive: soket lama ke server yang baru dimatikan tidak dipakai ulang
  const req = http.get(`${ALAMAT}/health`, { timeout: 2000, agent: false }, (res) => {
    let b = "";
    res.on("data", (d) => { b += d; });
    res.on("end", () => selesai(res.statusCode === 200 ? b.split(/\r?\n/)[0].trim() : null));
  });
  req.on("timeout", () => { req.destroy(); selesai(null); });
  req.on("error", () => selesai(null));
});

/** Penanda port di baris perintah server (server.mjs mengabaikannya): bukti proses ini Kantor untuk port INI. */
const PENANDA = `--kantor-port=${PORT}`;
const angka = (t) => String(t ?? "").split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** Proses yang sedang mendengarkan port ini (mac/Linux: lsof, lalu ss). null = tidak bisa dipastikan. */
function pendengarPort() {
  const l = spawnSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  if (!l.error) return angka(l.stdout);
  const s = spawnSync("ss", ["-ltnpH", `sport = :${PORT}`], { encoding: "utf8" });
  if (!s.error) return [...String(s.stdout).matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
  return null;
}

// Windows: path tidak peka huruf besar-kecil dan pemisahnya bisa / atau \ → dibandingkan dalam bentuk baku
const baku = (t) => (WINDOWS ? String(t).replaceAll("/", "\\").toLowerCase() : String(t));
const SERVER_BAKU = baku(SERVER);
/** Server Kantor RudisOne milik checkout ini untuk port ini: baris perintahnya menjalankan SERVER dan (memuat PENANDA,
 *  atau — server versi lama tanpa penanda — prosesnya memang mendengarkan port ini). Bukan dari berkas pid: pid basi
 *  bisa sudah dipakai proses lain (T3), dan pencocokan nama skrip saja ikut mengenai Kantor di port lain (T4). */
function prosesKantor() {
  let calon;   // [{ pid, cmd, dengar }]
  if (WINDOWS) {
    // keluaran UTF-8 (PowerShell 5.1 bawaan memakai codepage OEM → path non-ASCII rusak); PowerShell hanya menyaring
    // kasar (nama berkas), pencocokan path persis di JS
    const ps = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; `
      + `$d=@(Get-NetTCPConnection -LocalPort ${Number(PORT)} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess }); `
      + `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLowerInvariant().Contains('server.mjs') } | `
      + `ForEach-Object { "$($_.ProcessId)\t$([int]($d -contains $_.ProcessId))\t$($_.CommandLine)" }`;
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8", windowsHide: true });
    calon = String(r.stdout ?? "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((b) => { const [pid, d, ...c] = b.split("\t"); return { pid: Number(pid), dengar: d === "1", cmd: c.join("\t") }; });
  } else {
    const r = spawnSync("ps", ["-A", "-ww", "-o", "pid=", "-o", "command="], { encoding: "utf8" });
    calon = String(r.stdout ?? "").split("\n").map((b) => b.trim().match(/^(\d+)\s+(.*)$/)).filter(Boolean)
      .map((m) => ({ pid: Number(m[1]), cmd: m[2] })).filter((p) => p.cmd.includes(SERVER_BAKU));
    const dengar = calon.some((p) => !p.cmd.includes("--kantor-port=")) ? pendengarPort() ?? [] : [];
    for (const p of calon) p.dengar = dengar.includes(p.pid);
  }
  return calon.filter((p) => p.pid !== process.pid && baku(p.cmd).includes(SERVER_BAKU)
    && (` ${p.cmd} `.includes(` ${PENANDA} `) || (!p.cmd.includes("--kantor-port=") && p.dengar))).map((p) => p.pid);
}

/** Hentikan server Kantor milik checkout ini di port ini → daftar pid yang dimatikan. */
function berhenti() {
  fs.rmSync(PIDFILE, { force: true });   // berkas pid versi lama: tidak dipercaya lagi, hanya dibersihkan
  const mati = [];
  for (const pid of prosesKantor()) { try { process.kill(pid); mati.push(pid); } catch { /* sudah berhenti */ } }
  return mati;
}

/** Log ditambahkan (bukan ditimpa) agar sebab Kantor mati masih terbaca setelah dinyalakan ulang; dipangkas bila > 1 MB. */
function siapkanLog() {
  try { if (fs.statSync(LOG).size > 1_000_000) fs.renameSync(LOG, `${LOG}.1`); } catch { /* belum ada */ }
  try { fs.appendFileSync(LOG, `[${new Date().toISOString()}] menyalakan Kantor (port ${PORT}, ${SERVER})\n`); } catch { /* log tidak bisa ditulis */ }
}

/** Windows: nyalakan server lewat WMI (Win32_Process.Create) → pid, atau null bila gagal (pemanggil memakai spawn biasa).
 *  Proses anak di Windows mewarisi job object induknya; sesi Claude Code/Desktop menjalankan alatnya di dalam job, dan
 *  `detached` Node tidak melepaskannya (libuv tidak memakai CREATE_BREAKAWAY_FROM_JOB). Proses yang dibuat WMI berinduk
 *  WmiPrvSE, di luar job itu, sehingga Kantor tidak mati saat sesi yang menyalakannya berhenti. WMI tidak mewariskan env
 *  dan stdio: port dan log lewat argumen (server.mjs `--kantor-port=`, `--log=`). */
function nyalakanLepas() {
  // string PowerShell berkutip tunggal; kutip tipografis ‘ ’ ‚ ‛ juga pembatas di PowerShell → digandakan
  const kutip = (t) => `'${String(t).replace(/['‘-‛]/g, "$&$&")}'`;
  // PENANDA tanpa kutip: prosesKantor() mencarinya sebagai kata utuh di baris perintah
  const baris = [`"${process.execPath}"`, `"${SERVER}"`, PENANDA, `"--log=${LOG}"`].join(" ");
  const ps = `$ErrorActionPreference='Stop'; `
    + `$s = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; `
    + `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${kutip(baris)}; `
    + `CurrentDirectory = ${kutip(ROOT)}; ProcessStartupInformation = $s }; "$($r.ReturnValue) $($r.ProcessId)"`;
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  const [kode, pid] = String(r.stdout ?? "").replace(/^﻿/, "").trim().split(/\s+/).map(Number);
  return kode === 0 && pid > 0 ? pid : null;
}

async function utama() {
  if (AKSI === "berhenti") {
    const mati = berhenti();
    if (mati.length) { console.log(`Kantor (port ${PORT}) dimatikan — pid ${mati.join(", ")}.`); return 0; }
    console.log(await sehat()
      ? `Port ${PORT} dijawab server yang tidak terbukti Kantor dari checkout ini (${SERVER}) — tidak dimatikan.`
      : `Kantor tidak sedang berjalan di port ${PORT}.`);
    return 0;
  }
  if (!["buka", "--tanpa-browser", "mulai-ulang", "demo"].includes(AKSI)) { console.log(PEMAKAIAN); return 1; }

  let jalan = await sehat();
  if (jalan && (AKSI === "mulai-ulang" || jalan !== `ok ${sidik()}`)) {
    console.log("Memulai ulang Kantor (kode server berubah atau diminta).");
    berhenti();
    for (let i = 0; i < 20; i++) { if (!(await sehat())) break; tidur(250); }
    if (await sehat()) {
      console.error(`Port ${PORT} masih dijawab server yang tidak terbukti Kantor dari checkout ini (${SERVER}) — tidak dimatikan; hentikan dari checkout asalnya atau pakai RUDISONE_KANTOR_PORT lain.`);
      return 1;
    }
    jalan = null;
  }
  if (!jalan) {
    siapkanLog();
    // Windows: lewat WMI agar server tidak ikut mati bersama proses Claude yang menyalakannya (lihat nyalakanLepas)
    const lepas = WINDOWS && process.env.RUDISONE_KANTOR_TANPA_WMI !== "1" ? nyalakanLepas() : null;
    if (!lepas) {
      const log = fs.openSync(LOG, "a");
      const anak = spawn(process.execPath, [SERVER, PENANDA], { detached: true, stdio: ["ignore", log, log], windowsHide: true,
        env: { ...process.env, RUDISONE_KANTOR_PORT: PORT } });
      anak.unref();
    }
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
