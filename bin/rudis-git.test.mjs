// Uji pengaman git command RUDIS (T-20261030-6 · A6): node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { jalankanSh } from "./lib/uji-util.mjs";
import { checkpoint, rollback, daftar, main } from "./rudis-git.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rudis-git-")));
const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const UTAMA = path.join(tmp, "proyek"), WT = path.join(tmp, "wt");
fs.mkdirSync(UTAMA);
g(UTAMA, "init", "-q", "-b", "main");
g(UTAMA, "config", "user.email", "uji@contoh.test"); g(UTAMA, "config", "user.name", "uji"); g(UTAMA, "config", "commit.gpgsign", "false"); g(UTAMA, "config", "core.autocrlf", "false");
fs.writeFileSync(path.join(UTAMA, "a.txt"), "v1\n");
fs.writeFileSync(path.join(UTAMA, ".gitignore"), "rahasia.txt\n");
g(UTAMA, "add", "-A"); g(UTAMA, "commit", "-q", "-m", "awal");
g(UTAMA, "worktree", "add", "-q", "-b", "rudis/T-20261030-6", WT);
const tulis = (f, isi) => fs.writeFileSync(path.join(WT, f), isi);
const baca = (f) => fs.readFileSync(path.join(WT, f), "utf8");
const tolak = (fn, pola) => assert.throws(fn, (e) => pola.test(e.message));

test("ditolak di checkout utama, branch lain, ID tak sah, HEAD terlepas", () => {
  tolak(() => checkpoint(UTAMA, "T-20261030-6"), /checkout utama/);
  tolak(() => checkpoint(WT, "T-20261030-7"), /bukan branch tugas/);
  tolak(() => checkpoint(WT, "bukan-id"), /ID tugas tidak sah/);
  const lain = path.join(tmp, "wt-lain"); g(UTAMA, "worktree", "add", "-q", "--detach", lain);
  tolak(() => checkpoint(lain, "T-20261030-6"), /detached/);
  assert.equal(main(["checkpoint", "T-20261030-6"], UTAMA), 1);
  assert.equal(main(["entah"], WT), 3);
});

test("checkpoint = commit di branch tugas; tanpa perubahan → HEAD; berkas rahasia menolak", () => {
  const h0 = g(WT, "rev-parse", "HEAD");
  assert.equal(checkpoint(WT, "T-20261030-6").baru, false);
  assert.equal(g(WT, "rev-parse", "HEAD"), h0);
  tulis("a.txt", "v2\n"); tulis("baru.txt", "x\n"); tulis("rahasia.txt", "diabaikan .gitignore\n");
  const c = checkpoint(WT, "T-20261030-6", "sebelum redesign");
  assert.equal(c.baru, true);
  assert.match(g(WT, "log", "-1", "--format=%s"), /^checkpoint\(T-20261030-6\): sebelum redesign$/);
  assert.equal(g(WT, "status", "--porcelain"), "");
  assert.equal(g(UTAMA, "rev-parse", "main"), h0);                     // branch utama tidak tersentuh
  tulis(".env", "TOKEN=x\n");
  tolak(() => checkpoint(WT, "T-20261030-6"), /berkas rahasia.*\.env/);
  fs.rmSync(path.join(WT, ".env"));
  tulis(".env.example", "TOKEN=\n");
  assert.equal(checkpoint(WT, "T-20261030-6", "contoh env").baru, true);  // .env.example boleh
  assert.equal(daftar(WT, "T-20261030-6").length, 2);
});

test("rollback memulihkan path dari checkpoint sebagai commit baru; keadaan sebelumnya tetap di riwayat", () => {
  const cp = daftar(WT, "T-20261030-6").at(-1).sha;                    // "sebelum redesign": a.txt = v2
  tulis("a.txt", "v3-rusak\n"); tulis("lain.txt", "tetap\n");
  const r = rollback(WT, "T-20261030-6", cp.slice(0, 10), ["a.txt"]);
  assert.equal(baca("a.txt"), "v2\n");
  assert.equal(baca("lain.txt"), "tetap\n");                           // path lain tidak disentuh
  assert.match(g(WT, "log", "-1", "--format=%s"), /^rollback\(T-20261030-6\): a\.txt ke /);
  assert.equal(g(WT, "show", `${r.sebelum}:a.txt`), "v3-rusak");        // tidak ada yang hilang
  assert.equal(g(WT, "status", "--porcelain"), "");
});

test("rollback ditolak: bukan checkpoint, bukan leluhur, tanpa path, path di luar repo, glob", () => {
  const awal = g(WT, "rev-list", "--max-parents=0", "HEAD");
  tolak(() => rollback(WT, "T-20261030-6", awal, ["a.txt"]), /bukan checkpoint tugas/);
  tolak(() => rollback(WT, "T-20261030-6", "deadbeef", ["a.txt"]), /bukan commit/);
  const cp = daftar(WT, "T-20261030-6")[0].sha;
  tolak(() => rollback(WT, "T-20261030-6", cp, []), /sebut path/);
  tolak(() => rollback(WT, "T-20261030-6", cp, ["../luar.txt"]), /di luar repo/);
  tolak(() => rollback(WT, "T-20261030-6", cp, ["*.txt"]), /glob/);
  g(UTAMA, "commit", "-q", "--allow-empty", "-m", "checkpoint(T-20261030-6): di main");
  tolak(() => rollback(WT, "T-20261030-6", g(UTAMA, "rev-parse", "main"), ["a.txt"]), /bukan leluhur/);
  assert.equal(main(["rollback", "T-20261030-6", cp, "a.txt"], WT), 3);  // tanpa `--`
});

test("pembungkus shell memanggil modul", () => {
  const r = jalankanSh(path.join(SINI, "rudis-git.sh"), ["daftar", "T-20261030-6"], { cwd: WT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /checkpoint\(T-20261030-6\)/);
});

test("U3 M6: berkas rahasia umum ditolak checkpoint; contoh/template boleh", () => {
  for (const f of ["id_ed25519", ".git-credentials", "prod.env", ".envrc", ".pgpass", "secrets.json", "service-account.json", "config/credentials.yml", "a.keystore"]) {
    fs.mkdirSync(path.dirname(path.join(WT, f)), { recursive: true });
    tulis(f, "rahasia\n");
    tolak(() => checkpoint(WT, "T-20261030-6"), /berkas rahasia/);
    fs.rmSync(path.join(WT, f));
  }
  tulis("secrets.json.example", "{}\n");
  assert.equal(checkpoint(WT, "T-20261030-6", "contoh").baru, true);
});

test("U3 M5: rollback menolak menimpa berkas yang diabaikan git dan tidak tersimpan di commit mana pun", () => {
  fs.mkdirSync(path.join(WT, "conf"), { recursive: true });
  tulis("conf/local.cfg", "v1 tracked\n");
  const cp = checkpoint(WT, "T-20261030-6", "conf dilacak").sha;
  g(WT, "rm", "-q", "--cached", "conf/local.cfg");
  fs.appendFileSync(path.join(WT, ".gitignore"), "conf/local.cfg\n");
  g(WT, "add", "-A"); g(WT, "commit", "-q", "-m", "conf lokal diabaikan");
  tulis("conf/local.cfg", "suntingan lokal pengguna\n");
  tolak(() => rollback(WT, "T-20261030-6", cp, ["conf"]), /diabaikan git akan tertimpa/);
  assert.equal(baca("conf/local.cfg"), "suntingan lokal pengguna\n");
});
