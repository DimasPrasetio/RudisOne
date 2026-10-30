// Pembantu pengendali server: konfigurasi server per device + menjalankan skrip bash di server lewat ssh.
// Skrip jarak jauh (bin/remoto/*.sh) berjalan di server Linux; yang berjalan di device ini hanya Node + ssh.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Nilai `konfig host|playbook <alias>`; null bila konfigurasi belum ada/tak lengkap (pesannya diteruskan ke stderr). */
export function dariKonfig(sub, alias = "") {
  const r = spawnSync(process.execPath, [path.join(BIN, "konfig.mjs"), sub, alias], { encoding: "utf8" });
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0 ? r.stdout.replace(/\r?\n$/, "") : null;
}

/** Jalankan bin/remoto/<nama>.sh di `host` lewat `ssh … bash -s -- <args>`. Mengembalikan kode keluar (255 = ssh gagal). */
export function jalankanDiServer(host, nama, args = []) {
  const skrip = fs.readFileSync(path.join(BIN, "remoto", `${nama}.sh`), "utf8").replace(/\r\n/g, "\n");
  const r = spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "LogLevel=ERROR", host, "bash", "-s", "--", ...args],
    { input: skrip, stdio: ["pipe", "inherit", "inherit"] });
  if (r.error) return 255;
  return r.status ?? 255;
}
