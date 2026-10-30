// Pembantu uji lintas OS: executable palsu, bash, pembuat zip. Hanya dipakai berkas *.test.mjs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { cariBash, jalankan, WINDOWS } from "./platform.mjs";

/** Executable palsu bernama `nama` di `dir` yang menjalankan `kodeJs` (modul ESM; argumen di process.argv.slice(2)).
 *  Mengembalikan path peluncurnya: skrip sh (macOS/Linux) atau .cmd (Windows). */
export function palsu(dir, nama, kodeJs) {
  fs.mkdirSync(dir, { recursive: true });
  const js = path.join(dir, `${nama}.palsu.mjs`);
  fs.writeFileSync(js, kodeJs);
  if (WINDOWS) {
    const cmd = path.join(dir, `${nama}.cmd`);
    fs.writeFileSync(cmd, `@echo off\r\n"${process.execPath}" "${js}" %*\r\n`);
    return cmd;
  }
  const sh = path.join(dir, nama);
  fs.writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`, { mode: 0o755 });
  return sh;
}

/** Jalankan skrip .sh lewat bash (Git Bash di Windows). */
export function jalankanSh(skrip, args = [], opsi = {}) {
  const bash = cariBash();
  if (!bash) throw new Error("bash tidak ditemukan (Windows: pasang Git for Windows)");
  return spawnSync(bash, [WINDOWS ? skrip.replaceAll("\\", "/") : skrip, ...args], opsi);
}

/** Zip isi folder `sumber` (entri berawalan nama folder) ke `keluar`: `zip` bila ada, selain itu bsdtar (`tar -a`). */
export function zipFolder(induk, namaFolder, keluar) {
  fs.mkdirSync(path.dirname(keluar), { recursive: true });
  let r = spawnSync("zip", ["-qr", keluar, namaFolder], { cwd: induk });
  if (r.error || r.status !== 0) r = spawnSync("tar", ["-a", "-cf", keluar, namaFolder], { cwd: induk });
  if (r.error || r.status !== 0) throw new Error(`gagal membuat zip: ${r.error?.message ?? r.stderr}`);
}

export { jalankan, WINDOWS };
