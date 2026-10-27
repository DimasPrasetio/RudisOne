// Uji konfigurasi per device (bin/konfig.mjs): node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { periksa, ambil } from "./konfig.mjs";

const SKRIP = path.join(path.dirname(fileURLToPath(import.meta.url)), "konfig.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "konfig-uji-"));
const FILE = path.join(tmp, "server.json");
const cli = (...a) => spawnSync(process.execPath, [SKRIP, ...a], { env: { ...process.env, RUDISONE_SERVER: FILE }, encoding: "utf8" });
const LENGKAP = {
  versi: 1, diisi: { tanggal: "2026-01-01", oleh: "COO", persetujuan: "uji" }, server_bawaan: "vps-uji",
  server: { "vps-uji": { ssh_host: "vps-uji", playbook: "/srv/PLAYBOOK.md" }, cadangan: { ssh_host: "vps-dua", playbook: null } },
  aplikasi: { "app-uji": { server: "vps-uji", folder: "~/app-uji", repo: "contoh/app-uji" } },
};

test("belum ada konfigurasi: cek & host keluar 3 dengan arahan ke COO", () => {
  const r = cli("cek");
  assert.equal(r.status, 3);
  assert.match(r.stdout, /belum ada/);
  assert.match(r.stdout, /minta COO menanyakan pengguna/);
  assert.equal(cli("host").status, 3);
});

test("konfigurasi lengkap: cek 0, host & playbook bawaan / per alias, get jalur", () => {
  fs.writeFileSync(FILE, JSON.stringify(LENGKAP));
  assert.equal(cli("cek").status, 0);
  assert.equal(cli("host").stdout.trim(), "vps-uji");
  assert.equal(cli("host", "cadangan").stdout.trim(), "vps-dua");
  assert.equal(cli("playbook").stdout.trim(), "/srv/PLAYBOOK.md");
  assert.equal(cli("playbook", "cadangan").stdout.trim(), "");
  assert.equal(cli("get", "aplikasi.app-uji.folder").stdout.trim(), "~/app-uji");
  assert.equal(cli("get", "tidak.ada").status, 3);
});

test("kekurangan dilaporkan per kunci", () => {
  const kurang = periksa({ server: { a: {} }, server_bawaan: "b", aplikasi: { x: { server: "c" } } });
  assert.ok(kurang.some((k) => k.startsWith("server_bawaan \"b\"")));
  assert.ok(kurang.some((k) => k.startsWith("server.a.ssh_host")));
  assert.ok(kurang.some((k) => k.startsWith("aplikasi.x.server")));
  assert.ok(kurang.some((k) => k.startsWith("aplikasi.x.folder")));
  assert.ok(kurang.some((k) => k.startsWith("diisi.persetujuan")));
  assert.equal(ambil(LENGKAP, "server.vps-uji.ssh_host"), "vps-uji");
});

test("contoh yang di-commit terbaca dan bukan konfigurasi siap pakai", () => {
  const c = JSON.parse(fs.readFileSync(path.join(path.dirname(SKRIP), "..", "konfigurasi", "server.contoh.json"), "utf8"));
  assert.equal(c.versi, 1);
  assert.ok(periksa(c).length > 0);   // placeholder <alias> tidak boleh lolos sebagai konfigurasi lengkap
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
