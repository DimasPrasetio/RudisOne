// Uji lapisan lintas-OS (lib/platform, lokasi, tautan, rahasia) dan perkakas Node pengganti skrip bash.
// Jalan di macOS, Linux, dan Windows: node --test bin/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { palsu } from "./lib/uji-util.mjs";

const SINI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SINI, "..");
const WIN = process.platform === "win32";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "portabel-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const node = (skrip, args = [], env = {}) => spawnSync(process.execPath, [skrip, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

// HOME sementara (os.homedir() membaca USERPROFILE di Windows, HOME di lainnya)
const RUMAH = path.join(tmp, "rumah");
fs.mkdirSync(RUMAH, { recursive: true });
process.env.HOME = RUMAH; process.env.USERPROFILE = RUMAH;

const platform = await import("./lib/platform.mjs");
const lokasi = await import("./lib/lokasi.mjs");
const tautan = await import("./lib/tautan.mjs");
const rahasia = await import("./lib/rahasia.mjs");

test("lokasi: rumah repo di bawah folder rumah; samaPath tidak peka huruf/pemisah di Windows dan mengikuti tautan", () => {
  assert.equal(lokasi.rumahRepo(RUMAH), path.join(RUMAH, "Documents", "Neuron", "ai-agent", "RudisOne"));
  assert.equal(lokasi.RUMAH_TAMPIL, "~/Documents/Neuron/ai-agent/RudisOne");
  const a = path.join(tmp, "a"); fs.mkdirSync(a);
  assert.ok(lokasi.samaPath(a, a));
  assert.ok(!lokasi.samaPath(a, path.join(tmp, "b")));
  if (WIN) assert.ok(lokasi.samaPath(a, a.toUpperCase().replaceAll("\\", "/")));
  try {
    const t = path.join(tmp, "tautan-a"); fs.symlinkSync(a, t, "junction");
    assert.ok(lokasi.samaPath(t, a), "junction/symlink = folder yang sama");
  } catch (e) { if (!["EPERM", "EACCES"].includes(e.code)) throw e; }
});

test("platform: posix, tampilPath, dariBash (hanya Windows), tarZip", () => {
  assert.equal(platform.posix("C:\\a\\b"), "C:/a/b");
  assert.equal(platform.tampilPath(path.join(os.homedir(), "x", "y")), "~/x/y");
  assert.equal(platform.tampilPath("/tidak/di/rumah"), "/tidak/di/rumah");
  assert.equal(platform.dariBash("/tmp/x"), "/tmp/x");
  if (WIN) {
    const d = path.parse(tmp).root[0];
    assert.equal(platform.dariBash(`/${d.toLowerCase()}/Users/x`), `${d.toUpperCase()}:/Users/x`);
    assert.equal(platform.dariBash("/tidakada-xyz/a"), "/tidakada-xyz/a", "bukan drive → tidak diubah");
    assert.match(platform.tarZip(), /tar\.exe$/i);
  } else {
    assert.equal(platform.dariBash("/c/Users/x"), "/c/Users/x");
    assert.equal(platform.tarZip(), "tar");
  }
});

test("platform.jalankan: executable palsu (.cmd di Windows, sh di lainnya) dan program tidak ada", () => {
  const p = palsu(tmp, "halo", 'console.log("halo " + process.argv.slice(2).join("|")); process.exit(7);');
  const r = platform.jalankan(p, ["a b", "c"], { encoding: "utf8" });
  assert.equal(r.status, 7);
  assert.equal(r.stdout.trim(), "halo a b|c");
  const tidakAda = platform.jalankan("program-tidak-ada-xyz", [], { encoding: "utf8" });
  assert.ok(tidakAda.error || tidakAda.status !== 0);
});

test("tautan: baru → sama → diperbarui (symlink/junction); yang bukan milik repo tidak disentuh", () => {
  const repo = path.join(tmp, "repo-t"); fs.mkdirSync(path.join(repo, "skills", "s1"), { recursive: true });
  fs.writeFileSync(path.join(repo, "skills", "s1", "SKILL.md"), "v1");
  const sumber = path.join(repo, "skills", "s1"), tujuan = path.join(RUMAH, ".claude", "skills", "s1");
  let r = tautan.pasangTautan(sumber, tujuan, repo, { folder: true });
  assert.equal(r.status, "baru");
  assert.ok(["symlink", "junction", "salinan"].includes(r.mode));
  assert.equal(fs.readFileSync(path.join(tujuan, "SKILL.md"), "utf8"), "v1");
  assert.equal(tautan.pasangTautan(sumber, tujuan, repo, { folder: true }).status, "sama");
  assert.ok(tautan.periksaTautan(tujuan, repo).milik);
  // folder milik sistem lain di ~/.claude/skills: tidak disentuh
  const asing = path.join(RUMAH, ".claude", "skills", "asing"); fs.mkdirSync(asing, { recursive: true }); fs.writeFileSync(path.join(asing, "x"), "x");
  fs.mkdirSync(path.join(repo, "skills", "asing"), { recursive: true });
  assert.equal(tautan.pasangTautan(path.join(repo, "skills", "asing"), asing, repo, { folder: true }).status, "asing");
  assert.equal(fs.readFileSync(path.join(asing, "x"), "utf8"), "x");
});

test("tautan: jalur salinan terlacak (Windows tanpa hak symlink) — mutakhir, basi, diperbarui, yatim dibersihkan", () => {
  process.env.RUDISONE_TAUTAN_SALIN = "1";
  try {
    const repo = path.join(tmp, "repo-s"); fs.mkdirSync(path.join(repo, "agen"), { recursive: true });
    const sumber = path.join(repo, "agen", "rudis-x.md"), tujuan = path.join(RUMAH, ".claude", "agents", "rudis-x.md");
    fs.writeFileSync(sumber, "satu");
    let r = tautan.pasangTautan(sumber, tujuan, repo);
    assert.deepEqual([r.status, r.mode], ["baru", "salinan"]);
    assert.equal(fs.readFileSync(tujuan, "utf8"), "satu");
    assert.deepEqual([tautan.periksaTautan(tujuan, repo).milik, tautan.periksaTautan(tujuan, repo).mutakhir], ["salinan", true]);
    assert.equal(tautan.pasangTautan(sumber, tujuan, repo).status, "sama");
    fs.writeFileSync(sumber, "dua");
    assert.equal(tautan.periksaTautan(tujuan, repo).mutakhir, false, "sumber berubah → salinan basi");
    assert.equal(tautan.pasangTautan(sumber, tujuan, repo).status, "diperbarui");
    assert.equal(fs.readFileSync(tujuan, "utf8"), "dua");
    fs.writeFileSync(tujuan, "diedit-pengguna");
    assert.equal(tautan.periksaTautan(tujuan, repo).mutakhir, false, "salinan yang diubah di tujuan dianggap basi");
    fs.rmSync(sumber);
    assert.equal(tautan.bersihkanYatim(tujuan, repo), true);
    assert.equal(fs.existsSync(tujuan), false);
  } finally { delete process.env.RUDISONE_TAUTAN_SALIN; }
});

test("rahasia: simpan → ada → baca → tidak tercetak di berkas polos (DPAPI) / mode 0600 (POSIX)", () => {
  const dir = path.join(tmp, "rahasia");
  process.env.RUDISONE_RAHASIA_DIR = dir;
  const asli = process.env.RUDISONE_OS;
  if (!WIN) process.env.RUDISONE_OS = "linux";   // jalur berkas; macOS memakai Keychain (diuji dengan `security` palsu di perkakas.test)
  try {
    assert.equal(rahasia.ada("layanan-x"), false);
    const f = rahasia.simpan("layanan-x", "PAT-Rahasia-1!");
    assert.equal(rahasia.ada("layanan-x"), true);
    assert.equal(rahasia.baca("layanan-x"), "PAT-Rahasia-1!");
    assert.equal(rahasia.baca("tidak-ada"), null);
    if (WIN) assert.ok(!fs.readFileSync(f, "utf8").includes("PAT-Rahasia"), "DPAPI: terenkripsi");
    else { assert.equal(fs.statSync(f).mode & 0o777, 0o600); assert.equal(fs.statSync(dir).mode & 0o777, 0o700); }
    assert.throws(() => rahasia.simpan("../x", "a"), /tidak sah/);
    assert.throws(() => rahasia.simpan("ok", ""), /kosong/);
    assert.equal(rahasia.jenisPenyimpan(), WIN ? "dpapi" : "berkas");
  } finally { delete process.env.RUDISONE_RAHASIA_DIR; if (asli === undefined) delete process.env.RUDISONE_OS; else process.env.RUDISONE_OS = asli; }
});

test("rahasia: jenis penyimpan mengikuti OS logis (darwin → keychain, win32 → dpapi, lainnya → berkas)", () => {
  const asli = process.env.RUDISONE_OS;
  try {
    for (const [os_, jenis] of [["darwin", "keychain"], ["win32", "dpapi"], ["linux", "berkas"]]) {
      process.env.RUDISONE_OS = os_;
      assert.equal(rahasia.jenisPenyimpan(), jenis);
    }
  } finally { if (asli === undefined) delete process.env.RUDISONE_OS; else process.env.RUDISONE_OS = asli; }
});

test("rilis-cek.mjs: argumen tidak sah → exit 3 tanpa menyentuh jaringan", () => {
  for (const args of [[], ["bukan-repo", "abc1234"], ["a/b", "ZZZ"], ["a/b"]]) {
    const r = node(path.join(SINI, "rilis-cek.mjs"), args);
    assert.equal(r.status, 3, args.join(" "));
    assert.match(r.stderr, /Pemakaian/);
  }
});

test("pasca-deploy.mjs & server-cek.mjs: argumen/konfigurasi tidak sah → exit 3", () => {
  const env = { RUDISONE_SERVER: path.join(tmp, "tidak-ada.json") };
  assert.equal(node(path.join(SINI, "pasca-deploy.mjs"), ["Bukan App", "abc1234"], env).status, 3);
  assert.equal(node(path.join(SINI, "pasca-deploy.mjs"), ["app", "xyz"], env).status, 3);
  assert.equal(node(path.join(SINI, "pasca-deploy.mjs"), ["app", "abc1234"], env).status, 3, "konfigurasi server belum ada");
  assert.equal(node(path.join(SINI, "server-cek.mjs"), [], env).status, 3, "konfigurasi server belum ada");
});

test("skrip jarak jauh bin/remoto/*.sh: sintaks bash sah dan berakhiran LF", { skip: !platform.cariBash() && "bash tidak tersedia" }, () => {
  for (const n of ["server-cek", "pasca-deploy"]) {
    const f = path.join(SINI, "remoto", `${n}.sh`);
    assert.ok(!fs.readFileSync(f, "utf8").includes("\r"), `${n}.sh harus LF`);
    const r = spawnSync(platform.cariBash(), ["-n", platform.posix(f)], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
});

test("kantor.mjs: nyala (tanpa browser), tidak memulai ulang bila kode sama, mulai-ulang, berhenti", async () => {
  const port = String(20000 + Math.floor(Math.random() * 30000));
  const env = { RUDISONE_KANTOR_PORT: port };
  const kantor = (aksi) => node(path.join(SINI, "kantor.mjs"), [aksi], env);
  const sehat = () => new Promise((ok) => { http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000, agent: false }, (res) => { let b = ""; res.on("data", (d) => { b += d; }); res.on("end", () => ok(res.statusCode === 200 ? b.trim() : null)); }).on("error", () => ok(null)); });
  try {
    let r = kantor("--tanpa-browser");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, new RegExp(`Kantor RudisOne: http://127.0.0.1:${port}`));
    assert.match(await sehat() ?? "", /^ok [0-9a-f]{12}$/);
    r = kantor("--tanpa-browser");
    assert.doesNotMatch(r.stdout, /Memulai ulang/, "sidik sama → tidak dimulai ulang");
    r = kantor("mulai-ulang");
    assert.match(r.stdout, /Memulai ulang Kantor/);
    assert.match(await sehat() ?? "", /^ok /);
    assert.equal(kantor("tidak-dikenal").status, 1);
  } finally {
    const r = kantor("berhenti");
    assert.equal(r.status, 0);
  }
  await new Promise((ok) => setTimeout(ok, 800));
  assert.equal(await sehat(), null, "server sudah berhenti");
});

// T3/T4: `kantor berhenti` hanya mematikan server Kantor checkout ini untuk port yang diminta.
const portAcak = () => String(20000 + Math.floor(Math.random() * 30000));
const sehatDi = (port) => new Promise((ok) => { http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000, agent: false }, (res) => { let b = ""; res.on("data", (d) => { b += d; }); res.on("end", () => ok(res.statusCode === 200 ? b.trim() : null)); }).on("error", () => ok(null)); });
const tunggu = async (syarat, ms = 8000) => { const akhir = Date.now() + ms; while (Date.now() < akhir) { if (await syarat()) return true; await new Promise((r) => setTimeout(r, 200)); } return false; };
const hidup = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const SERVER_KANTOR = path.join(REPO, "kantor", "server.mjs");

test("T3: berkas pid basi yang menunjuk proses lain tidak pernah membuat `kantor berhenti` mematikannya", async () => {
  const port = portAcak();
  // proses lain milik pengguna: biasa, dan yang baris perintahnya kebetulan memuat path server.mjs (tanpa port ini)
  const korban = [spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" }),
    spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", SERVER_KANTOR], { stdio: "ignore" }),
    spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", SERVER_KANTOR, `--kantor-port=${port}0`], { stdio: "ignore" })];
  try {
    await tunggu(async () => korban.every((k) => k.pid && hidup(k.pid)));
    for (const k of korban) {
      fs.writeFileSync(path.join(os.tmpdir(), `kantor-rudisone-${port}.pid`), String(k.pid));
      const r = node(path.join(SINI, "kantor.mjs"), ["berhenti"], { RUDISONE_KANTOR_PORT: port });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, new RegExp(`Kantor tidak sedang berjalan di port ${port}\\.`), "pesan jujur: tidak ada yang dimatikan");
      assert.ok(hidup(k.pid), `proses ${k.pid} tidak boleh ikut mati`);
      assert.ok(!fs.existsSync(path.join(os.tmpdir(), `kantor-rudisone-${port}.pid`)), "berkas pid basi dibersihkan");
    }
  } finally { for (const k of korban) k.kill(); }
});

test("T4: berhenti/mulai-ulang Kantor uji tidak mematikan Kantor di port lain dan tidak menimpa lognya", async () => {
  const [p1, p2] = [portAcak(), portAcak()];
  const kantor = (port, aksi) => node(path.join(SINI, "kantor.mjs"), [aksi], { RUDISONE_KANTOR_PORT: port });
  // "Kantor yang sedang dipakai": dinyalakan versi lama (tanpa penanda port di baris perintah), seperti 7421 di device
  const lain = spawn(process.execPath, [SERVER_KANTOR], { stdio: "ignore", env: { ...process.env, RUDISONE_KANTOR_PORT: p2 } });
  const logLain = path.join(process.env.TMPDIR || os.tmpdir(), `kantor-rudisone-${p2}.log`);
  try {
    assert.ok(await tunggu(async () => /^ok /.test(await sehatDi(p2) ?? "")), "Kantor lain menyala");
    fs.writeFileSync(logLain, "log kantor lain\n");
    let r = kantor(p1, "--tanpa-browser");
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(fs.existsSync(path.join(process.env.TMPDIR || os.tmpdir(), `kantor-rudisone-${p1}.log`)), "log per port");
    r = kantor(p1, "mulai-ulang");
    assert.match(r.stdout, /Memulai ulang Kantor/);
    r = kantor(p1, "berhenti");
    assert.match(r.stdout, new RegExp(`Kantor \\(port ${p1}\\) dimatikan — pid \\d+`));
    assert.ok(await tunggu(async () => (await sehatDi(p1)) === null), "Kantor uji berhenti");
    assert.match(await sehatDi(p2) ?? "", /^ok /, "Kantor di port lain tetap hidup");
    assert.ok(hidup(lain.pid));
    assert.equal(fs.readFileSync(logLain, "utf8"), "log kantor lain\n", "log Kantor lain tidak tertimpa");
    // Kantor versi lama tetap bisa dihentikan dari port-nya sendiri (bukti: proses itu mendengarkan port tsb.)
    const bisaPort = WIN || !spawnSync("lsof", ["-v"]).error || !spawnSync("ss", ["-V"]).error;
    if (bisaPort) {
      r = kantor(p2, "berhenti");
      assert.match(r.stdout, new RegExp(`Kantor \\(port ${p2}\\) dimatikan — pid ${lain.pid}\\.`), r.stdout);
      assert.ok(await tunggu(async () => (await sehatDi(p2)) === null));
    }
  } finally { lain.kill(); kantor(p1, "berhenti"); fs.rmSync(logLain, { force: true }); }
});

test("install.mjs di HOME sementara: peran, subagent & skill tertaut; konsisten dengan jalur salinan (Windows tanpa symlink)", () => {
  for (const salin of ["0", "1"]) {
    const home = path.join(tmp, `home-install-${salin}`); fs.mkdirSync(home, { recursive: true });
    const env = { HOME: home, USERPROFILE: home, RUDISONE_INSTALL_PAKSA: "1", RUDISONE_TAUTAN_SALIN: salin,
      RUDISONE_SESI: path.join(tmp, `sesi-${salin}.json`), RUDISONE_RAHASIA_DIR: path.join(tmp, "rahasia-i") };
    const r = node(path.join(REPO, "install.mjs"), ["--tanpa-perkakas"], env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[ok\]\s+peran coo ada di ruang sesi/);
    assert.match(r.stdout, /\[ok\]\s+subagent rudis-tech-lead tertaut/);
    assert.match(r.stdout, /\[ok\]\s+skill rudisone tertaut/);
    assert.doesNotMatch(r.stdout, /\[!!\]\s+(peran|subagent|skill)/, r.stdout);
    assert.ok(fs.existsSync(path.join(home, ".claude", "skills", "rudisone", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(home, ".claude", "agents", "rudis-tech-lead.md")));
    if (salin === "1") assert.match(r.stdout, /tertaut \(salinan/);
    // pemasangan ulang idempoten
    const r2 = node(path.join(REPO, "install.mjs"), ["--tanpa-perkakas"], env);
    assert.match(r2.stdout, /sudah mutakhir/);
    // pemeriksa konsistensi paham semua jenis tautan: tidak ada peringatan skill/subagent terpasang
    const c = node(path.join(SINI, "cek-konsistensi.mjs"), [], env);
    assert.doesNotMatch(c.stdout, /\[peringatan\] (skill|subagent)-terpasang/, c.stdout);
  }
});
