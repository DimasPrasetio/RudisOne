#!/usr/bin/env node
// Konfigurasi per device RudisOne (server, aplikasi, DNS, GitHub) — hanya membaca, tidak pernah menulis.
// Fakta server TIDAK ditanam di repo: diisi COO atas persetujuan pengguna di konfigurasi/server.json (git-ignored),
// mengikuti konfigurasi/server.contoh.json. Alur bila belum ada: penyedia.md › Konfigurasi server.
// Pemakaian:
//   cek               valid & lengkap? keluar 0; belum ada / kurang → keluar 3 + daftar yang perlu ditanyakan
//   get <jalur>       nilai satu kunci, mis. get server_bawaan · get aplikasi.<slug>.folder
//   host [alias]      Host ssh server (bawaan bila alias kosong) · playbook [alias]  path playbook server ("" bila tidak ada)
//   contoh            tampilkan berkas contoh
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INI = fileURLToPath(import.meta.url);
const ROOT = process.env.RUDISONE_ROOT || path.resolve(path.dirname(INI), "..");
export const FILE_KONFIG = process.env.RUDISONE_SERVER || path.join(ROOT, "konfigurasi", "server.json");
const FILE_CONTOH = path.join(path.dirname(INI), "..", "konfigurasi", "server.contoh.json");

/** Isi konfigurasi, atau null bila belum ada / tidak terbaca. */
export function bacaKonfig(file = FILE_KONFIG) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

/** Daftar kekurangan (kosong = lengkap untuk kerja server). */
export function periksa(cfg) {
  if (!cfg) return ["berkas konfigurasi/server.json belum ada"];
  const kurang = [];
  const server = cfg.server ?? {};
  if (!Object.keys(server).length) kurang.push("server: belum ada satu pun (alias, Host ssh)");
  if (!cfg.server_bawaan) kurang.push("server_bawaan: alias server yang dipakai bila tidak disebut");
  else if (!server[cfg.server_bawaan]) kurang.push(`server_bawaan "${cfg.server_bawaan}" tidak ada di server`);
  for (const [a, s] of Object.entries(server)) if (!s?.ssh_host) kurang.push(`server.${a}.ssh_host: nama Host di ~/.ssh/config`);
  for (const [a, app] of Object.entries(cfg.aplikasi ?? {})) {
    if (!server[app?.server]) kurang.push(`aplikasi.${a}.server: alias server tidak dikenal`);
    if (!app?.folder) kurang.push(`aplikasi.${a}.folder: folder aplikasi di server`);
  }
  if (!cfg.diisi?.persetujuan) kurang.push("diisi.persetujuan: kutipan persetujuan pengguna");
  (function placeholder(o, jalur) {
    for (const [k, v] of Object.entries(o ?? {})) {
      const j = jalur ? `${jalur}.${k}` : k;
      if (/<[^>]+>/.test(k)) kurang.push(`${j}: nilai contoh belum diganti`);
      else if (typeof v === "string" && /<[^>]+>/.test(v)) kurang.push(`${j}: nilai contoh belum diganti`);
      else if (v && typeof v === "object") placeholder(v, j);
    }
  })(cfg, "");
  return kurang;
}

export function ambil(cfg, jalur) {
  return String(jalur).split(".").reduce((o, k) => (o == null ? undefined : o[k]), cfg);
}

function server(cfg, alias) { return cfg?.server?.[alias || cfg?.server_bawaan]; }

export function main(argv) {
  const [perintah, arg] = argv;
  const cfg = bacaKonfig();
  if (perintah === "cek") {
    const kurang = periksa(cfg);
    if (!kurang.length) { console.log(`Konfigurasi server lengkap: ${FILE_KONFIG}`); return 0; }
    console.log(`Konfigurasi server belum lengkap (${FILE_KONFIG}) — minta COO menanyakan pengguna:`);
    for (const k of kurang) console.log(`  - ${k}`);
    return 3;
  }
  if (perintah === "get") {
    const v = cfg ? ambil(cfg, arg ?? "") : undefined;
    if (v === undefined) { console.error(`Tidak ada: ${arg} (${cfg ? "kunci tidak ditemukan" : "konfigurasi belum ada"})`); return 3; }
    console.log(typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? ""));
    return 0;
  }
  if (perintah === "host" || perintah === "playbook") {
    const s = server(cfg, arg);
    if (!s) { console.error("Konfigurasi server belum ada — minta COO menanyakan pengguna (penyedia.md › Konfigurasi server)."); return 3; }
    console.log(perintah === "host" ? s.ssh_host : (s.playbook ?? ""));
    return 0;
  }
  if (perintah === "contoh") { process.stdout.write(fs.readFileSync(FILE_CONTOH, "utf8")); return 0; }
  console.error(fs.readFileSync(INI, "utf8").split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  return 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === INI) process.exitCode = main(process.argv.slice(2));
