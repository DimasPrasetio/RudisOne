// Penyimpan PAT/rahasia per OS. Nilai rahasia tidak pernah lewat argumen perintah, env, atau log.
//   macOS    Keychain (`security`)                          — diisi pengguna lewat `security add-generic-password … -w`
//   Windows  DPAPI per-pengguna (PowerShell), berkas <layanan>.dpapi di %APPDATA%\rudisone\rahasia — hanya akun ini di mesin ini bisa membukanya
//   lainnya  berkas 0600 di ~/.config/rudisone/rahasia/<layanan> (folder 0700), di luar repo
// RUDISONE_OS mengganti OS logis (uji); RUDISONE_RAHASIA_DIR mengganti folder; RUDISONE_KEYCHAIN_BIN mengganti `security`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { jalankan, osLogis } from "./platform.mjs";

const binKeychain = () => process.env.RUDISONE_KEYCHAIN_BIN || "security";
/** "keychain" | "dpapi" | "berkas". */
export const jenisPenyimpan = () => { const o = osLogis(); return o === "darwin" ? "keychain" : o === "win32" ? "dpapi" : "berkas"; };
export const pakaiKeychain = () => jenisPenyimpan() === "keychain";

export const dirRahasia = () => {
  if (process.env.RUDISONE_RAHASIA_DIR) return process.env.RUDISONE_RAHASIA_DIR;
  if (jenisPenyimpan() === "dpapi") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "rudisone", "rahasia");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "rudisone", "rahasia");
};
export const berkasRahasia = (layanan) => path.join(dirRahasia(), jenisPenyimpan() === "dpapi" ? `${layanan}.dpapi` : layanan);

/** Nama layanan yang aman dipakai sebagai nama berkas. */
export const layananSah = (l) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(l ?? ""));

const qps = (s) => `'${String(s).replaceAll("'", "''")}'`;
const powershell = (skrip, opsi = {}) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", skrip],
  { encoding: "utf8", windowsHide: true, timeout: 30_000, ...opsi });

/** Berkas rahasia sah: berkas biasa, berisi; di sistem berizin POSIX juga tidak terbaca grup/orang lain. */
function berkasSah(layanan) {
  try {
    const st = fs.statSync(berkasRahasia(layanan));
    const modeAman = process.platform === "win32" || (st.mode & 0o077) === 0;
    return st.isFile() && st.size > 0 && modeAman;
  } catch { return false; }
}

/** Apakah rahasia layanan ada — tanpa membaca nilainya. */
export function ada(layanan) {
  if (jenisPenyimpan() === "keychain") return jalankan(binKeychain(), ["find-generic-password", "-s", layanan], { stdio: "ignore", timeout: 15_000 }).status === 0;
  return berkasSah(layanan);
}

/** Nilai rahasia (untuk lingkungan proses anak saja); null bila tidak ada/tak terbaca. */
export function baca(layanan) {
  const jenis = jenisPenyimpan();
  if (jenis === "keychain") {
    const r = jalankan(binKeychain(), ["find-generic-password", "-s", layanan, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 });
    return r.status === 0 && r.stdout.trim() ? r.stdout.replace(/\r?\n$/, "") : null;
  }
  if (!berkasSah(layanan)) return null;
  if (jenis === "dpapi") {
    const r = powershell(`$ErrorActionPreference='Stop'; $e=([IO.File]::ReadAllText(${qps(berkasRahasia(layanan))})).Trim(); $s=ConvertTo-SecureString $e; `
      + "$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }");
    return r.status === 0 && r.stdout ? r.stdout : null;
  }
  return fs.readFileSync(berkasRahasia(layanan), "utf8").split(/\r?\n/)[0] || null;
}

/** Simpan rahasia (Linux: berkas 0600; Windows: DPAPI). Keychain diisi pengguna lewat `security`, bukan lewat modul ini. */
export function simpan(layanan, nilai) {
  if (!layananSah(layanan)) throw new Error(`nama layanan tidak sah: ${layanan}`);
  if (!nilai) throw new Error("rahasia kosong");
  const jenis = jenisPenyimpan();
  if (jenis === "keychain") throw new Error("macOS: simpan lewat `security add-generic-password` (Keychain)");
  fs.mkdirSync(dirRahasia(), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dirRahasia(), 0o700); } catch { /* Windows: warisan ACL profil pengguna */ }
  const tujuan = berkasRahasia(layanan);
  if (jenis === "dpapi") {
    // nilai lewat stdin: tidak muncul di argumen proses
    const r = powershell(`$ErrorActionPreference='Stop'; $v=[Console]::In.ReadLine(); if (-not $v) { exit 2 }; `
      + `$s=ConvertTo-SecureString $v -AsPlainText -Force; [IO.File]::WriteAllText(${qps(tujuan)}, (ConvertFrom-SecureString $s))`, { input: `${nilai}\n` });
    if (r.status !== 0) throw new Error(`DPAPI gagal menyimpan: ${String(r.stderr ?? "").trim().split("\n")[0] || r.status}`);
    return tujuan;
  }
  const sementara = path.join(dirRahasia(), `.${layanan}.baru`);
  fs.writeFileSync(sementara, `${nilai}\n`, { mode: 0o600 });
  try { fs.chmodSync(sementara, 0o600); } catch { /* Windows */ }
  fs.renameSync(sementara, tujuan);
  return tujuan;
}

/** Baca satu baris dari stdin; bila terminal, tanpa gema. Untuk `perkakas pat <layanan>`. */
export function bacaTersembunyi(prompt) {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return new Promise((selesai) => {
      let b = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (d) => { b += d; });
      stdin.on("end", () => selesai(b.split(/\r?\n/)[0] ?? ""));
    });
  }
  process.stderr.write(prompt);
  return new Promise((selesai) => {
    let v = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const akhir = (nilai) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); process.stderr.write("\n"); selesai(nilai); };
    const onData = (c) => {
      for (const ch of c) {
        if (ch === "\r" || ch === "\n") return akhir(v);
        if (ch === "\u0003") { stdin.setRawMode(false); process.stderr.write("\n"); process.exit(130); }
        if (ch === "\u007f" || ch === "\b") v = v.slice(0, -1); else v += ch;
      }
    };
    stdin.on("data", onData);
  });
}

export { jalankan };
