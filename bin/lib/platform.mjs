// Pembantu lintas OS (macOS, Linux, Windows) untuk perkakas RudisOne. Hanya bergantung pada Node.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const WINDOWS = process.platform === "win32";
/** OS logis: darwin | linux | win32. RUDISONE_OS menggantikannya (uji). */
export const osLogis = () => process.env.RUDISONE_OS || process.platform;

/** Path dengan garis miring ke depan (dipakai git/sh di Windows dan untuk tampilan). */
export const posix = (p) => String(p).replaceAll("\\", "/");

/** Tidur sinkron (ms) tanpa sibuk-menunggu. */
export const tidur = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const kutip = (a) => (/[\s"&|<>^%()]/.test(a) || a === "" ? `"${String(a).replace(/"/g, '""')}"` : String(a));

/** spawnSync yang juga bisa menjalankan skrip .cmd/.bat dan shim npm (mis. claude.cmd) di Windows — Node tidak
 *  mau men-spawn berkas itu langsung. Di OS lain sama dengan spawnSync. */
export function jalankan(cmd, args = [], opsi = {}) {
  const lewatCmd = () => spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", [cmd, ...args].map(kutip).join(" ")],
    { ...opsi, windowsVerbatimArguments: true });
  if (WINDOWS && /\.(cmd|bat)$/i.test(cmd)) return lewatCmd();
  const r = spawnSync(cmd, args, opsi);
  if (WINDOWS && r.error?.code === "ENOENT" && !/[\\/]/.test(cmd)) {
    const r2 = lewatCmd();
    // cmd.exe selalu ada: "bukan perintah" berarti memang tidak ada → laporkan ENOENT seperti spawnSync biasa
    if (r2.status === 9009 || (r2.status === 1 && /not recognized|tidak dikenali/i.test(String(r2.stderr ?? "")))) return r;
    return r2;
  }
  return r;
}

/** Buka URL di browser bawaan. true bila perintah pembuka berhasil dijalankan. */
export function bukaUrl(url, os = osLogis()) {
  const coba = os === "darwin" ? [["open", [url]]]
    : os === "win32" ? [["cmd.exe", ["/d", "/c", "start", "", url]]]
      : [["xdg-open", [url]], ["wslview", [url]]];
  for (const [c, a] of coba) {
    const r = spawnSync(c, a, { stdio: "ignore", windowsHide: true });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

/** bash yang dipakai menjalankan skrip .sh: RUDISONE_BASH; di Windows Git Bash (turunan `git --exec-path`),
 *  bukan `bash` di PATH yang bisa menunjuk ke WSL tanpa distro. null bila tidak ada. */
export function cariBash() {
  if (process.env.RUDISONE_BASH) return process.env.RUDISONE_BASH;
  if (!WINDOWS) return "bash";
  const g = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
  if (g.status === 0) {
    const ep = g.stdout.trim().replace(/\//g, path.sep);
    for (const rel of [["..", "..", "..", "bin", "bash.exe"], ["..", "..", "bin", "bash.exe"], ["..", "..", "..", "usr", "bin", "bash.exe"]]) {
      const c = path.resolve(ep, ...rel);
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

/** Path untuk tampilan: di bawah folder rumah ditulis `~/…`; selalu garis miring ke depan (aman ditempel ke Git Bash). */
export function tampilPath(p) {
  const h = os.homedir();
  return posix(p === h || p.startsWith(h + path.sep) || p.startsWith(h + "/") ? `~${p.slice(h.length)}` : p);
}

/** tar yang bisa membuka/membuat zip: di Windows bsdtar bawaan sistem (System32\tar.exe), bukan GNU tar milik Git Bash
 *  yang menganggap `C:` nama host; di OS lain `tar` biasa. */
export function tarZip() {
  if (WINDOWS) {
    const bsd = path.join(process.env.SystemRoot || "C:\Windows", "System32", "tar.exe");
    if (fs.existsSync(bsd)) return bsd;
  }
  return "tar";
}
